import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { InactivityLock } from "./InactivityLock";
import { WarmBackground } from "./WarmBackground";
import { RenewalBanner } from "@/components/subscription/RenewalBanner";
import { MobileNavProvider } from "@/context/MobileNavContext";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative mt-14 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden" style={{ background: "var(--warm-page-bg)" }}>
      <InactivityLock />
      <WarmBackground />

      <MobileNavProvider>
        <div className="relative z-10 flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <RenewalBanner />
            <Header />
            <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              {children}
            </main>
          </div>
        </div>
      </MobileNavProvider>
    </div>
  );
}
