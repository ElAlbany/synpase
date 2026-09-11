"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  House,
  Loader2,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Star,
} from "lucide-react";
import { db } from "@/db";
import { LogoMark } from "@/components/landing/nav";
import { NoteTree } from "@/components/sidebar/NoteTree";
import { ThemeToggle } from "@/components/theme-toggle";
import { useNotesStore } from "@/stores/useNotesStore";
import { useUIStore } from "@/stores/useUIStore";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const pathname = usePathname();
  const router = useRouter();
  const { createNote } = useNotesStore();
  const [creating, setCreating] = useState(false);

  const favorites = useLiveQuery(
    async () => (await db.notes.toArray()).filter((n) => n.isFavorite),
    []
  );

  const handleNewNote = async () => {
    setCreating(true);
    const note = await createNote();
    setCreating(false);
    router.push(`/app/note/${note.id}`);
  };

  return (
    <aside
      className={cn(
        "flex h-screen flex-none flex-col border-r border-line bg-raised/60 transition-[width] duration-[240ms] [transition-timing-function:cubic-bezier(.16,1,.3,1)]",
        collapsed ? "w-[68px]" : "w-[264px]"
      )}
    >
      {/* brand */}
      <div className="flex h-14 flex-none items-center gap-2.5 overflow-hidden border-b border-line px-4">
        <LogoMark size={24} />
        {!collapsed && (
          <span className="truncate text-[15px] font-semibold">Synapse</span>
        )}
      </div>

      {/* search trigger (command palette lands in Phase 3) */}
      <div className="flex-none px-3 pt-3">
        <button
          onClick={() =>
            alert("Command palette arrives in Phase 3 — for now, browse the tree.")
          }
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-line bg-overlay text-[13px] text-faint transition-colors duration-150 hover:border-line-strong hover:text-mute",
            collapsed ? "justify-center px-0 py-2" : "px-3 py-2"
          )}
          title="Search (Cmd+K)"
        >
          <Search className="size-3.5 flex-none" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search</span>
              <span className="kbd">Cmd K</span>
            </>
          )}
        </button>
      </div>

      {/* primary nav */}
      <nav className="flex flex-col gap-0.5 px-3 pt-3">
        <NavItem
          href="/app"
          icon={<House className="size-4" />}
          label="Home"
          active={pathname === "/app"}
          collapsed={collapsed}
        />
        <NavItem
          href="/app/graph"
          icon={<Network className="size-4" />}
          label="Graph"
          active={pathname === "/app/graph"}
          collapsed={collapsed}
        />
      </nav>

      <div className="mx-3 mt-3 flex-none border-t border-line" />

      {/* new note */}
      <div className="flex-none px-3 pt-3">
        <button
          onClick={handleNewNote}
          disabled={creating}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-accent/25 bg-accent/12 text-[13px] font-medium text-accent transition-all duration-150 hover:border-accent/40 hover:bg-accent/20 disabled:opacity-60",
            collapsed ? "justify-center px-0 py-2" : "px-3 py-2"
          )}
          title="New note"
        >
          {creating ? (
            <Loader2 className="size-4 flex-none animate-spin" />
          ) : (
            <Plus className="size-4 flex-none" />
          )}
          {!collapsed && <span>New note</span>}
        </button>
      </div>

      {/* scrollable workspace */}
      <div className="mt-3 flex-1 overflow-y-auto px-3 pb-3 [scrollbar-width:thin]">
        {!collapsed && favorites && favorites.length > 0 && (
          <>
            <div className="px-1 pt-2 pb-1.5 text-[10px] font-medium tracking-[0.08em] text-faint uppercase">
              Favorites
            </div>
            <div className="flex flex-col gap-0.5">
              {favorites.map((n) => (
                <Link
                  key={n.id}
                  href={`/app/note/${n.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-mute transition-colors duration-150 hover:bg-overlay hover:text-ink"
                >
                  <Star className="size-3.5 flex-none fill-amber-400 text-amber-400" />
                  <span className="truncate">{n.title || "Untitled"}</span>
                </Link>
              ))}
            </div>
          </>
        )}

        {!collapsed && (
          <div className="px-1 pt-3 pb-1.5 text-[10px] font-medium tracking-[0.08em] text-faint uppercase">
            Workspace
          </div>
        )}
        <NoteTree collapsed={collapsed} />
      </div>

      {/* bottom bar */}
      <div className="flex flex-none items-center border-t border-line p-2">
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid size-9 flex-none place-items-center rounded-lg text-faint transition-colors duration-150 hover:bg-overlay hover:text-ink"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
        {!collapsed && <div className="flex-1" />}
        {!collapsed && <ThemeToggle />}
      </div>
    </aside>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
  collapsed,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        "flex items-center gap-2.5 rounded-lg py-2 text-[13px] font-medium transition-colors duration-150",
        collapsed ? "justify-center px-0" : "px-2.5",
        active
          ? "bg-accent/14 text-accent"
          : "text-mute hover:bg-overlay hover:text-ink"
      )}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
