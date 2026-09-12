"use client";

import { useEffect, useRef } from "react";
import { useDebounce } from "./useDebounce";
import { useNotesStore } from "@/stores/useNotesStore";
import { updateNote } from "@/db/notes";

export interface AutoSaveValues {
  title: string;
  /** Serialized BlockNote document (JSON string). */
  json: string;
}

/**
 * Debounced auto-save, redesigned for correctness:
 *
 * 1. CONTENT-AWARE — debounces a string *signature*, so identity changes from
 *    live-query refreshes no longer reset the timer (the old bug that could
 *    silently drop edits and loop saves).
 * 2. FLUSH ON LEAVE — when the note unmounts (user navigates away), any edits
 *    still pending in the debounce window are written immediately. Nothing
 *    typed is ever lost by clicking "New note".
 *
 * Mount inside a component keyed by note id.
 */
export function useAutoSave(noteId: string, values: AutoSaveValues) {
  const saveNote = useNotesStore((s) => s.saveNote);

  const latest = useRef(values);
  latest.current = values;
  const lastSaved = useRef(JSON.stringify(values));

  const sig = JSON.stringify(values);
  const debouncedSig = useDebounce(sig, 800);

  // periodic save — only when the content actually changed
  useEffect(() => {
    if (debouncedSig === lastSaved.current) return;
    lastSaved.current = debouncedSig;
    const parsed = JSON.parse(debouncedSig) as AutoSaveValues;
    saveNote(noteId, { title: parsed.title, content: JSON.parse(parsed.json) });
  }, [debouncedSig, noteId, saveNote]);

  // flush pending edits when leaving the note
  useEffect(() => {
    return () => {
      const pending = JSON.stringify(latest.current);
      if (pending === lastSaved.current) return;
      lastSaved.current = pending;
      const parsed = JSON.parse(pending) as AutoSaveValues;
      void updateNote(noteId, {
        title: parsed.title,
        content: JSON.parse(parsed.json),
      });
    };
  }, [noteId]);
}
