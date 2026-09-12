import { v4 as uuidv4 } from "uuid";
import { db } from "./index";
import type { CreateNoteInput, Note, UpdateNoteInput } from "./schema";
import { blocksToText } from "@/lib/wikilinks";

export async function getNote(id: string): Promise<Note | undefined> {
  return db.notes.get(id);
}

export async function listNotes(): Promise<Note[]> {
  return db.notes.orderBy("updatedAt").reverse().toArray();
}

export async function listFavorites(): Promise<Note[]> {
  const notes = await db.notes.toArray();
  return notes.filter((n) => n.isFavorite);
}

export async function listRecent(limit = 8): Promise<Note[]> {
  const notes = await listNotes();
  return notes.slice(0, limit);
}

export async function createNote(input: CreateNoteInput = {}): Promise<Note> {
  const now = Date.now();
  const note: Note = {
    id: uuidv4(),
    title: input.title ?? "Untitled",
    content: input.content ?? "",
    parentId: input.parentId ?? null,
    tags: input.tags ?? [],
    isFavorite: input.isFavorite ?? false,
    createdAt: now,
    updatedAt: now,
  };
  await db.notes.add(note);
  return note;
}

export async function updateNote(id: string, changes: UpdateNoteInput): Promise<void> {
  await db.notes.update(id, { ...changes, updatedAt: Date.now() });
}

/**
 * Deletes a note and re-parents its children onto the deleted note's parent,
 * so the tree never orphans subtrees.
 */
export async function deleteNote(id: string): Promise<void> {
  const note = await db.notes.get(id);
  if (!note) return;
  const children = await db.notes.where("parentId").equals(id).toArray();
  await db.transaction("rw", db.notes, async () => {
    await db.notes.where("parentId").equals(id).modify({ parentId: note.parentId });
    await db.notes.delete(id);
  });
  void children;
}

export async function toggleFavorite(id: string): Promise<void> {
  const note = await db.notes.get(id);
  if (!note) return;
  await updateNote(id, { isFavorite: !note.isFavorite });
}

/** Plain-text view of a note: legacy strings and BlockNote docs both work. */
export function noteText(note: Note): string {
  return blocksToText(note.content);
}

export function noteExcerpt(note: Note, max = 140): string {
  const text = noteText(note).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Case-insensitive title lookup — used by [[wiki-link]] navigation. */
export async function findNoteByTitle(title: string): Promise<Note | undefined> {
  const t = title.trim().toLowerCase();
  if (!t) return undefined;
  const all = await db.notes.toArray();
  return all.find((n) => n.title.trim().toLowerCase() === t);
}
