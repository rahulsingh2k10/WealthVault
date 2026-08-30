import { buildPlanCardView } from "@/lib/services/UpgradePromptService";
// Type-only import from the frontend's generated client (same approach as tests/helpers/testDb.ts).
// Erased at compile time, so it does not require the tests/ dir to have a generated Prisma client.
import type { SubscriptionPlan } from "../../../frontend/node_modules/@prisma/client";

// Minimal SubscriptionPlan-shaped row. buildPlanCardView only reads tier / price /
// offerPrice / currency / offerStartDate / offerEndDate, and coerces prices with Number(),
// so plain numbers stand in for Prisma.Decimal.
function plan(overrides: Partial<Record<keyof SubscriptionPlan, unknown>>): SubscriptionPlan {
  return {
    tier: "QUARTERLY",
    price: 6000,
    offerPrice: null,
    currency: "INR",
    offerStartDate: null,
    offerEndDate: null,
    ...overrides,
  } as unknown as SubscriptionPlan;
}

const NOW = new Date("2026-09-01T00:00:00Z");

describe("buildPlanCardView", () => {
  test("no offerPrice → offer inactive, effective = base, 0% discount", () => {
    const v = buildPlanCardView(plan({ tier: "MONTHLY", price: 3000 }), NOW);
    expect(v).toMatchObject({
      tier: "MONTHLY",
      billingMonths: 1,
      currency: "INR",
      basePerPeriod: 3000,
      effectivePerPeriod: 3000,
      offerActive: false,
      discountPercent: 0,
      offerEndsAt: null,
    });
  });

  test("offerPrice + now inside the window → offer active", () => {
    const v = buildPlanCardView(
      plan({
        tier: "ANNUAL",
        price: 18000,
        offerPrice: 14400,
        offerStartDate: new Date("2026-08-01T00:00:00Z"),
        offerEndDate: new Date("2026-09-30T23:59:59Z"),
      }),
      NOW,
    );
    expect(v.offerActive).toBe(true);
    expect(v.billingMonths).toBe(12);
    expect(v.effectivePerPeriod).toBe(14400);
    expect(v.discountPercent).toBe(20);
    expect(v.offerEndsAt).toBe("2026-09-30T23:59:59.000Z");
  });

  test("now after offerEndDate → offer inactive", () => {
    const v = buildPlanCardView(
      plan({
        offerPrice: 4800,
        offerStartDate: new Date("2026-08-01T00:00:00Z"),
        offerEndDate: new Date("2026-08-31T23:59:59Z"),
      }),
      NOW,
    );
    expect(v.offerActive).toBe(false);
    expect(v.effectivePerPeriod).toBe(6000);
    expect(v.discountPercent).toBe(0);
    expect(v.offerEndsAt).toBeNull();
  });

  test("now before offerStartDate → offer inactive", () => {
    const v = buildPlanCardView(
      plan({
        offerPrice: 4800,
        offerStartDate: new Date("2026-10-01T00:00:00Z"),
        offerEndDate: new Date("2026-12-31T23:59:59Z"),
      }),
      NOW,
    );
    expect(v.offerActive).toBe(false);
  });

  test("offer is active on the exact window boundaries (now === start, now === end)", () => {
    const start = new Date("2026-08-01T00:00:00Z");
    const end = new Date("2026-09-30T23:59:59Z");
    const common = { price: 6000, offerPrice: 4800, offerStartDate: start, offerEndDate: end };

    expect(buildPlanCardView(plan(common), start).offerActive).toBe(true);
    expect(buildPlanCardView(plan(common), end).offerActive).toBe(true);
  });

  test("open-ended window (both dates null) with an offerPrice → offer active", () => {
    const v = buildPlanCardView(plan({ offerPrice: 5100 }), NOW);
    expect(v.offerActive).toBe(true);
    expect(v.discountPercent).toBe(15); // round(1 - 5100/6000) = 15
  });

  test("discount percent is rounded", () => {
    const v = buildPlanCardView(plan({ price: 1000, offerPrice: 853 }), NOW);
    expect(v.discountPercent).toBe(15); // 14.7 → 15
  });
});
