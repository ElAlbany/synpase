"use client";

import { create } from "zustand";
import {
  createNote,
  deleteNote as dbDeleteNote,
  toggleFavorite as dbToggleFavorite,
  updateNote,
} from "@/db/notes";
import type { CreateNoteInput, Note, UpdateNoteInput } from "@/db/schema";

export type SaveStatus = "idle" | "saving" | "saved";

interface NotesState {
  saveStatus: SaveStatus;
  /** Create a note and return it (so callers can navigate to it). */
  createNote: (input?: CreateNoteInput) => Promise<Note>;
  /** Persist changes + drive the topbar save-status chip. */
  saveNote: (id: string, changes: UpdateNoteInput) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  renameNote: (id: string, title: string) => Promise<void>;
}

let savedTimer: ReturnType<typeof setTimeout> | null = null;

export const useNotesStore = create<NotesState>((set) => ({
  saveStatus: "idle",

  createNote: async (input) => {
    return createNote(input);
  },

  saveNote: async (id, changes) => {
    if (savedTimer) clearTimeout(savedTimer);
    set({ saveStatus: "saving" });
    await updateNote(id, changes);
    set({ saveStatus: "saved" });
    savedTimer = setTimeout(() => set({ saveStatus: "idle" }), 1600);
  },

  deleteNote: async (id) => {
    await dbDeleteNote(id);
  },

  toggleFavorite: async (id) => {
    await dbToggleFavorite(id);
  },

  renameNote: async (id, title) => {
    await updateNote(id, { title });
  },
}));
