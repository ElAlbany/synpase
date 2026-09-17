"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  File as FileIcon,
  FileUp,
  House,
  Loader2,
  Network,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sparkles,
  Star,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { db } from "@/db";
import { seedWelcomePack } from "@/db/seed";
import { LogoMark } from "@/components/landing/nav";
import { NoteTree } from "@/components/sidebar/NoteTree";
import { ThemeToggle } from "@/components/theme-toggle";
import { useNotesStore } from "@/stores/useNotesStore";
import { useUIStore } from "@/stores/useUIStore";
import {
  MarkdownImportError,
  MAX_MARKDOWN_BYTES,
  markdownToNote,
} from "@/lib/import-markdown";
import { applyTemplate, TEMPLATES } from "@/lib/templates";
import { cn } from "@/lib/utils";

/** Template icon names (lib/templates) -> lucide components. */
const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  File: FileIcon,
  Users,
  NotebookPen,
  Target,
  BookOpen,
  CalendarCheck,
};

const EASE = "cubic-bezier(.16,1,.3,1)";

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen);
  const pathname = usePathname();
  const router = useRouter();
  const { createNote } = useNotesStore();
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const favorites = useLiveQuery(
    async () => (await db.notes.toArray()).filter((n) => n.isFavorite),
    []
  );

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Template menu: outside-click and Escape close (ExportMenu pattern).
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
        menuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, closeMenu]);

  useEffect(
    () => () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    },
    []
  );

  const showImportError = (message: string) => {
    setImportError(message);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setImportError(null), 4000);
  };

  const handleNewNote = async () => {
    setCreating(true);
    const note = await createNote();
    setCreating(false);
    router.push(`/app/note/${note.id}`);
  };

  const handleTemplate = async (templateId: string) => {
    closeMenu();
    setCreating(true);
    const { title, content } = applyTemplate(templateId);
    const note = await createNote({ title, content });
    setCreating(false);
    router.push(`/app/note/${note.id}`);
  };

  const handleWelcomePack = async () => {
    closeMenu();
    setCreating(true);
    await seedWelcomePack();
    setCreating(false);
  };

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-importing the same file
    closeMenu();
    let firstId: string | null = null;
    for (const file of files) {
      try {
        if (file.size > MAX_MARKDOWN_BYTES) {
          throw new MarkdownImportError(
            `"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 2 MB.`
          );
        }
        const text = await file.text();
        const { title, content } = markdownToNote(text, file.name);
        const note = await createNote({ title, content });
        firstId ??= note.id;
      } catch (err) {
        const message =
          err instanceof MarkdownImportError
            ? err.message
            : `Couldn't import "${file.name}".`;
        showImportError(message);
      }
    }
    if (firstId) router.push(`/app/note/${firstId}`);
  };

  return (
    <>
      {/* mobile scrim */}
      <div
        aria-hidden
        onClick={() => setMobileNavOpen(false)}
        className={cn(
          "fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] transition-opacity duration-[240ms] md:hidden",
          mobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        style={{ transitionTimingFunction: EASE }}
      />

      <aside
        className={cn(
          "z-40 flex h-screen flex-none flex-col border-r border-line bg-raised transition-[transform,width] duration-[240ms] md:bg-raised/60",
          "fixed inset-y-0 left-0 w-[280px] md:static md:w-auto",
          collapsed ? "md:w-[68px]" : "md:w-[264px]",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ transitionTimingFunction: EASE }}
      >
        {/* brand */}
        <div className="flex h-14 flex-none items-center gap-2.5 overflow-hidden border-b border-line px-4">
          <LogoMark size={24} />
          {!collapsed && (
            <span className="truncate text-[15px] font-semibold">Synapse</span>
          )}
          <button
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
            className="ml-auto grid size-8 place-items-center rounded-lg text-faint transition-colors duration-150 hover:bg-overlay hover:text-ink md:hidden"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        {/* search trigger → command palette */}
        <div className="flex-none px-3 pt-3">
          <button
            onClick={() => setPaletteOpen(true)}
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
            href="/app/daily"
            icon={<CalendarDays className="size-4" />}
            label="Daily"
            active={pathname === "/app/daily"}
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

        {/* new note (split button: blank note + template/import menu) */}
        <div ref={menuRef} className="relative flex-none px-3 pt-3">
          <div className="flex items-stretch gap-1">
            <button
              onClick={handleNewNote}
              disabled={creating}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-lg border border-accent/25 bg-accent/12 text-[13px] font-medium text-accent transition-all duration-150 hover:border-accent/40 hover:bg-accent/20 disabled:opacity-60",
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
            {!collapsed && (
              <button
                ref={menuTriggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="New from template or import"
                title="New from template or import"
                onClick={() => setMenuOpen((v) => !v)}
                className={cn(
                  "grid w-8 flex-none place-items-center rounded-lg border border-accent/25 bg-accent/12 text-accent transition-all duration-150 hover:border-accent/40 hover:bg-accent/20",
                  menuOpen && "border-accent/40 bg-accent/20"
                )}
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform duration-150",
                    menuOpen && "rotate-180"
                  )}
                />
              </button>
            )}
          </div>

          {menuOpen && !collapsed && (
            <div
              role="menu"
              aria-label="New note options"
              className="absolute right-3 left-3 top-full z-50 mt-1.5 rounded-xl border border-line bg-raised p-1 shadow-[0_12px_40px_rgba(0,0,0,.35)]"
            >
              <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-medium tracking-[0.08em] text-faint uppercase">
                New from template
              </div>
              {TEMPLATES.map((t) => {
                const Icon = TEMPLATE_ICONS[t.icon] ?? FileIcon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="menuitem"
                    onClick={() => handleTemplate(t.id)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-mute transition-colors duration-150 hover:bg-overlay hover:text-ink"
                  >
                    <Icon className="size-3.5 flex-none" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{t.name}</span>
                      <span className="block truncate text-[11px] text-faint">
                        {t.description}
                      </span>
                    </span>
                  </button>
                );
              })}

              <div className="mx-1 my-1 border-t border-line" />

              <button
                type="button"
                role="menuitem"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-mute transition-colors duration-150 hover:bg-overlay hover:text-ink"
              >
                <FileUp className="size-3.5 flex-none" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">Import Markdown</span>
                  <span className="block truncate text-[11px] text-faint">
                    .md or .txt files as notes
                  </span>
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleWelcomePack}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-mute transition-colors duration-150 hover:bg-overlay hover:text-ink"
              >
                <Sparkles className="size-3.5 flex-none" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">Add welcome & guide notes</span>
                  <span className="block truncate text-[11px] text-faint">
                    Three linked notes that show the ropes
                  </span>
                </span>
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            multiple
            className="hidden"
            onChange={handleImportFiles}
          />

          {importError && (
            <div
              role="alert"
              className="mt-2 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-[11px] text-danger"
            >
              {importError}
            </div>
          )}
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
            className="hidden size-9 flex-none place-items-center rounded-lg text-faint transition-colors duration-150 hover:bg-overlay hover:text-ink md:grid"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
          {!collapsed && <div className="flex-1" />}
          <ThemeToggle />
        </div>
      </aside>
    </>
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
          ? "bg-accent/14 text-accent-ink"
          : "text-mute hover:bg-overlay hover:text-ink"
      )}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
