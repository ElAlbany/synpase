"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNotesStore } from "@/stores/useNotesStore";

/** True when the event target is a text field or the BlockNote editor. */
function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  return (
    t.tagName === "INPUT" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable
  );
}

/**
 * Global app shortcuts (mounted once in the app shell):
 *   C        → new note (ignored while typing in an input/editor)
 *   Cmd/Ctrl+K is handled by the command palette itself.
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const createNote = useNotesStore((s) => s.createNote);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e)) return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        void createNote().then((note) => router.push(`/app/note/${note.id}`));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [createNote, router]);
}
