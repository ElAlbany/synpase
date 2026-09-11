"use client";

import { useEffect, useRef } from "react";
import { useDebounce } from "./useDebounce";
import { useNotesStore } from "@/stores/useNotesStore";

export interface AutoSaveValues {
  title: string;
  content: string;
}

/**
 * Debounced auto-save: persists 800ms after the user stops typing.
 * Mount with key={noteId} so switching notes resets the first-render guard.
 */
export function useAutoSave(noteId: string, values: AutoSaveValues) {
  const saveNote = useNotesStore((s) => s.saveNote);
  const debounced = useDebounce(values, 800);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    saveNote(noteId, debounced);
  }, [debounced, noteId, saveNote]);
}
