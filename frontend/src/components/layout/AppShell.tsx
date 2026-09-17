import { Sidebar } from "./Sidebar";
import { CategoryMenuBar } from "./CategoryMenuBar";
import { InactivityLock } from "./InactivityLock";
import { WarmBackground } from "./WarmBackground";
import { RenewalBanner } from "@/components/subscription/RenewalBanner";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative mt-14 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden" style={{ background: "var(--warm-page-bg)" }}>
      <InactivityLock />
      <WarmBackground />

      {/* Floating nav — both overlay the content, neither reserves a column.
          Categories float top-center; account controls float bottom-left. */}
      <CategoryMenuBar />
      <Sidebar />

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <RenewalBanner />
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
