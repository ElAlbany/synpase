"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Copy, Download, FileDown, FileJson, Files } from "lucide-react";
import { db } from "@/db";
import type { Note } from "@/db/schema";
import { cn } from "@/lib/utils";
import {
  downloadFile,
  noteToJson,
  noteToMarkdown,
  slugify,
  vaultToJson,
  vaultToMarkdown,
} from "@/lib/export";

interface ExportMenuProps {
  /** The note currently open in the editor, if any. */
  note: Note | undefined;
  noteId: string | null;
}

function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for non-secure contexts.
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy") ? resolve() : reject(new Error("copy failed"));
    } catch (err) {
      reject(err instanceof Error ? err : new Error("copy failed"));
    } finally {
      ta.remove();
    }
  });
}

export function ExportMenu({ note, noteId }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allNotes = useLiveQuery(() => db.notes.toArray(), []) ?? [];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const exportNoteMarkdown = () => {
    if (!note) return;
    downloadFile(
      `${slugify(note.title)}.md`,
      noteToMarkdown(note),
      "text/markdown;charset=utf-8"
    );
    close();
  };

  const exportNoteJson = () => {
    if (!note) return;
    downloadFile(`${slugify(note.title)}.json`, noteToJson(note), "application/json");
    close();
  };

  const exportVaultJson = () => {
    downloadFile("synapse-vault.json", vaultToJson(allNotes), "application/json");
    close();
  };

  const exportVaultMarkdown = () => {
    downloadFile(
      "synapse-vault.md",
      vaultToMarkdown(allNotes),
      "text/markdown;charset=utf-8"
    );
    close();
  };

  const copyMarkdown = () => {
    if (!note) return;
    copyText(noteToMarkdown(note))
      .then(() => {
        setCopied(true);
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => setCopied(false));
  };

  const itemClass = cn(
    "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-mute",
    "transition-colors duration-150 hover:bg-overlay hover:text-ink",
    "disabled:pointer-events-none disabled:opacity-40"
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] text-mute",
          "transition-colors duration-150 hover:bg-overlay hover:text-ink",
          open && "bg-overlay text-ink"
        )}
      >
        <Download className="size-3.5" />
        <span className="hidden sm:inline">Export</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Export options"
          className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-line bg-raised p-1 shadow-[0_12px_40px_rgba(0,0,0,.35)]"
        >
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={!noteId || !note}
            onClick={exportNoteMarkdown}
          >
            <FileDown className="size-3.5 flex-none" />
            This note as Markdown
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={!noteId || !note}
            onClick={exportNoteJson}
          >
            <FileJson className="size-3.5 flex-none" />
            This note as JSON
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={!noteId || !note}
            onClick={copyMarkdown}
          >
            {copied ? (
              <Check className="size-3.5 flex-none text-teal" />
            ) : (
              <Copy className="size-3.5 flex-none" />
            )}
            {copied ? "Copied!" : "Copy markdown"}
          </button>

          <div className="mx-1 my-1 border-t border-line" />

          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={allNotes.length === 0}
            onClick={exportVaultMarkdown}
          >
            <Files className="size-3.5 flex-none" />
            Entire vault as Markdown
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={allNotes.length === 0}
            onClick={exportVaultJson}
          >
            <Files className="size-3.5 flex-none" />
            Entire vault as JSON
          </button>
        </div>
      )}
    </div>
  );
}
