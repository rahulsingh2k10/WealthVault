import { RipplePulseLoader } from "@/components/ui/ripple-pulse-loader";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-2xl border border-[var(--ui-card-border)] bg-[var(--ui-modal-bg)] px-8 py-7 shadow-2xl">
        <RipplePulseLoader
          caption="Loading your portfolio…"
          subCaption="Fetching your latest holdings"
        />
      </div>
    </div>
  );
}
