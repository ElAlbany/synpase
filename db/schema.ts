/**
 * Synapse data model.
 *
 * Phase 1: `content` is a plain string (temporary editor).
 * Phase 2: `content` becomes BlockNote JSON — the field is typed as `unknown`
 * so the migration requires zero schema changes (it is never indexed).
 */

export interface Note {
  id: string;
  title: string;
  content: unknown;
  parentId: string | null;
  tags: string[];
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  id: "settings";
  theme: "light" | "dark" | "system";
  sidebarCollapsed: boolean;
  lastOpenedNoteId: string | null;
}

export type CreateNoteInput = Partial<
  Pick<Note, "title" | "content" | "parentId" | "tags" | "isFavorite">
>;

export type UpdateNoteInput = Partial<
  Pick<Note, "title" | "content" | "parentId" | "tags" | "isFavorite">
>;
