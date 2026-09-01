import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { InactivityLock } from "./InactivityLock";
import { WarmBackground } from "./WarmBackground";
import { RenewalBanner } from "@/components/subscription/RenewalBanner";

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AppShell({ children, title, subtitle }: AppShellProps) {
  return (
    <div className="relative mt-14 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden" style={{ background: "var(--warm-page-bg)" }}>
      <InactivityLock />
      <WarmBackground />

      {/* Sidebar + content area */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <RenewalBanner />
          <Header title={title} subtitle={subtitle} />
          <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
