import { RipplePulseLoader } from "@/components/ui/ripple-pulse-loader";

export default function SettingsLoading() {
  return (
    <div
      className="relative mx-auto w-full max-w-[730px] overflow-hidden rounded-3xl lg:max-w-[860px] xl:max-w-[1000px]"
      style={{ background: "var(--ui-modal-bg)", boxShadow: "var(--ui-modal-shadow)" }}
    >
      <div className="flex flex-col gap-3 p-6 sm:p-8">
        {/* Country / Language / Theme rows */}
        <div className="skeleton-shimmer h-[74px] rounded-2xl border border-[var(--ui-card-border)] bg-[var(--ui-subtle-bg)]" />
        <div className="skeleton-shimmer h-[74px] rounded-2xl border border-[var(--ui-card-border)] bg-[var(--ui-subtle-bg)]" />
        <div className="skeleton-shimmer h-[74px] rounded-2xl border border-[var(--ui-card-border)] bg-[var(--ui-subtle-bg)]" />
      </div>

      <div
        className="absolute inset-0 flex items-center justify-center backdrop-blur-md"
        style={{ background: "var(--ui-scrim-bg)" }}
      >
        <div className="rounded-2xl border border-[var(--ui-card-border)] bg-[var(--ui-modal-bg)] px-8 py-7 shadow-2xl">
          <RipplePulseLoader
            caption="Loading your settings…"
            subCaption="Fetching your preferences"
          />
        </div>
      </div>
    </div>
  );
}
