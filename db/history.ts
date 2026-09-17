import { v4 as uuidv4 } from "uuid";
import { db } from "./index";
import { getNote, updateNote } from "./notes";
import type { NoteSnapshot } from "./schema";

export const MAX_SNAPSHOTS_PER_NOTE = 30;

async function newestSnapshot(noteId: string): Promise<NoteSnapshot | undefined> {
  const snaps = await db.snapshots.where("noteId").equals(noteId).sortBy("createdAt");
  return snaps[snaps.length - 1];
}

/**
 * Store a point-in-time copy of the note, then prune so each note keeps at
 * most MAX_SNAPSHOTS_PER_NOTE snapshots (newest survive).
 *
 * Skipped (returns null) when the note is missing or identical to the newest
 * snapshot — same title and JSON-identical content — so repeated saves of
 * unchanged content never spam the history.
 */
export async function createSnapshot(noteId: string): Promise<NoteSnapshot | null> {
  const note = await getNote(noteId);
  if (!note) return null;

  const latest = await newestSnapshot(noteId);
  if (
    latest &&
    latest.title === note.title &&
    JSON.stringify(latest.content) === JSON.stringify(note.content)
  ) {
    return null;
  }

  const snapshot: NoteSnapshot = {
    id: uuidv4(),
    noteId,
    title: note.title,
    content: note.content,
    createdAt: Date.now(),
  };

  await db.transaction("rw", db.snapshots, async () => {
    await db.snapshots.add(snapshot);
    const all = await db.snapshots.where("noteId").equals(noteId).sortBy("createdAt");
    const excess = all.length - MAX_SNAPSHOTS_PER_NOTE;
    if (excess > 0) {
      await db.snapshots.bulkDelete(all.slice(0, excess).map((s) => s.id));
    }
  });

  return snapshot;
}

/**
 * Snapshot at most once per minGapMs — wired into the save path so rapid
 * typing doesn't flood the history with one snapshot per debounce.
 */
export async function maybeSnapshot(
  noteId: string,
  minGapMs = 60_000
): Promise<NoteSnapshot | null> {
  const latest = await newestSnapshot(noteId);
  if (latest && Date.now() - latest.createdAt < minGapMs) return null;
  return createSnapshot(noteId);
}

/** Newest first. */
export async function listSnapshots(noteId: string): Promise<NoteSnapshot[]> {
  const snaps = await db.snapshots.where("noteId").equals(noteId).sortBy("createdAt");
  return snaps.reverse();
}

/**
 * Write a snapshot's title + content back onto its note. The note's current
 * state is snapshotted first, so a restore is itself undoable.
 */
export async function restoreSnapshot(snapshotId: string): Promise<void> {
  const snapshot = await db.snapshots.get(snapshotId);
  if (!snapshot) return;
  await createSnapshot(snapshot.noteId);
  await updateNote(snapshot.noteId, {
    title: snapshot.title,
    content: snapshot.content,
  });
}

/** Remove a note's entire history — called from deleteNote's transaction. */
export async function deleteSnapshotsForNote(noteId: string): Promise<void> {
  await db.snapshots.where("noteId").equals(noteId).delete();
}
