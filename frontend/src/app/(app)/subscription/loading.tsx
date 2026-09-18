import { RipplePulseLoader } from "@/components/ui/ripple-pulse-loader";

export default function SubscriptionLoading() {
  return (
    <div
      className="relative mx-auto w-full max-w-[960px] overflow-hidden rounded-3xl lg:max-w-[1100px] xl:max-w-[1280px]"
      style={{ background: "var(--ui-modal-bg)", boxShadow: "var(--ui-modal-shadow)" }}
    >
      {/* Hero — icon, "Your wealth fully unlocked" heading, description */}
      <div className="px-6 pb-5 pt-7 sm:px-8">
        <div className="skeleton-shimmer h-11 w-11 rounded-xl bg-[var(--ui-card-bg)]" />
        <div className="skeleton-shimmer mt-4 h-6 w-2/3 rounded-md bg-[var(--ui-card-bg)] sm:w-1/2" />
        <div className="skeleton-shimmer mt-2 h-4 w-3/4 rounded-md bg-[var(--ui-card-bg)] sm:w-1/2" />
      </div>

      <div className="px-6 pb-8 pt-6 sm:px-8">
        {/* Launch offer banner */}
        <div className="skeleton-shimmer mb-5 h-10 rounded-xl bg-[var(--ui-card-bg)]" />

        {/* Reserve / Treasury / Sovereign tab bar */}
        <div
          className="mb-5 flex gap-1 rounded-xl border p-1"
          style={{ borderColor: "var(--ui-card-border)", background: "var(--ui-subtle-bg)" }}
        >
          <div className="skeleton-shimmer h-11 flex-1 rounded-lg bg-[var(--ui-card-bg)]" />
          <div className="skeleton-shimmer h-11 flex-1 rounded-lg bg-[var(--ui-card-bg)]" />
          <div className="skeleton-shimmer h-11 flex-1 rounded-lg bg-[var(--ui-card-bg)]" />
        </div>

        {/* Reserve / Treasury / Sovereign plan cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="skeleton-shimmer h-64 rounded-2xl border border-[var(--ui-card-border)] bg-[var(--ui-card-bg)]" />
          <div className="skeleton-shimmer h-64 rounded-2xl border border-[var(--ui-card-border)] bg-[var(--ui-card-bg)]" />
          <div className="skeleton-shimmer h-64 rounded-2xl border border-[var(--ui-card-border)] bg-[var(--ui-card-bg)]" />
        </div>
      </div>

      {/* Center box — the whole picker gets blurred, loader on top */}
      <div
        className="absolute inset-0 flex items-center justify-center backdrop-blur-md"
        style={{ background: "var(--ui-scrim-bg)" }}
      >
        <div className="rounded-2xl border border-[var(--ui-card-border)] bg-[var(--ui-modal-bg)] px-8 py-7 shadow-2xl">
          <RipplePulseLoader
            caption="Loading your subscription…"
            subCaption="Fetching your plan details"
          />
        </div>
      </div>
    </div>
  );
}
