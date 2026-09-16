"use client";

import { Menu } from "lucide-react";
import { LogoMark } from "@/components/landing/nav";
import { useUIStore } from "@/stores/useUIStore";

/**
 * Slim mobile-only header bar with the drawer toggle. Sits above the Topbar
 * below `md` (the Topbar itself is owned by another phase).
 */
export function MobileMenuBar() {
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);

  return (
    <div className="flex h-12 flex-none items-center gap-2.5 border-b border-line px-3 md:hidden">
      <button
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open menu"
        className="grid size-9 place-items-center rounded-lg text-mute transition-colors duration-150 hover:bg-overlay hover:text-ink"
      >
        <Menu className="size-5" />
      </button>
      <LogoMark size={20} />
      <span className="text-[14px] font-semibold">Synapse</span>
    </div>
  );
}
