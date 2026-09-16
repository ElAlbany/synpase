"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { House, Network, Plus, Search } from "lucide-react";
import { useNotesStore } from "@/stores/useNotesStore";
import { useUIStore } from "@/stores/useUIStore";
import { cn } from "@/lib/utils";

/** Fixed bottom quick bar — visible only below the `md` breakpoint. */
export function MobileQuickBar() {
  const pathname = usePathname();
  const router = useRouter();
  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen);
  const createNote = useNotesStore((s) => s.createNote);

  const handleNew = () => {
    void createNote().then((n) => router.push(`/app/note/${n.id}`));
  };

  const itemCls = (active: boolean) =>
    cn(
      "grid flex-1 place-items-center rounded-lg py-2 transition-colors duration-150",
      active ? "text-accent-ink" : "text-faint hover:text-mute"
    );

  return (
    <nav
      aria-label="Quick navigation"
      className="glass fixed inset-x-0 bottom-0 z-30 flex items-center gap-1 border-t border-line px-3 pt-1.5 md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}
    >
      <Link href="/app" aria-label="Home" className={itemCls(pathname === "/app")}>
        <House className="size-5" />
      </Link>
      <Link
        href="/app/graph"
        aria-label="Graph"
        className={itemCls(pathname === "/app/graph")}
      >
        <Network className="size-5" />
      </Link>
      <button
        onClick={() => setPaletteOpen(true)}
        aria-label="Search"
        className={itemCls(false)}
      >
        <Search className="size-5" />
      </button>
      <button onClick={handleNew} aria-label="New note" className={itemCls(false)}>
        <Plus className="size-5" />
      </button>
    </nav>
  );
}
