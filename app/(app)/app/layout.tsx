import { Sidebar } from "@/components/sidebar/Sidebar";
import { MobileMenuBar } from "@/components/sidebar/MobileMenuBar";
import { MobileQuickBar } from "@/components/sidebar/MobileQuickBar";
import { PaletteHost } from "@/components/palette/PaletteHost";
import { Topbar } from "@/components/topbar/Topbar";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileMenuBar />
        <Topbar />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>
      <MobileQuickBar />
      <PaletteHost />
    </div>
  );
}
