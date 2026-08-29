import { formatMoney } from "@/lib/utils";

describe("formatMoney", () => {
  test("formats whole INR with the ₹ symbol and no decimals", () => {
    expect(formatMoney(1600, "INR")).toBe("₹1,600");
    expect(formatMoney(12000, "INR")).toBe("₹12,000");
    expect(formatMoney(0, "INR")).toBe("₹0");
  });

  test("groups Indian-style by default (en-IN)", () => {
    expect(formatMoney(1800000, "INR")).toBe("₹18,00,000");
  });

  test("honours an explicit locale + currency", () => {
    expect(formatMoney(1600, "USD", "en-US")).toBe("$1,600");
  });
});
