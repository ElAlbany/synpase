import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { createNote, deleteNote, getNote, updateNote } from "@/db/notes";
import {
  createSnapshot,
  deleteSnapshotsForNote,
  listSnapshots,
  maybeSnapshot,
  restoreSnapshot,
  MAX_SNAPSHOTS_PER_NOTE,
} from "@/db/history";

/** BlockNote-shaped content so JSON-stringify dedupe is genuinely exercised. */
function doc(text: string) {
  return [{ type: "paragraph", content: [{ type: "text", text }] }];
}

// tests/setup.ts clears notes/settings; snapshots are this suite's own table.
beforeEach(async () => {
  await db.snapshots.clear();
});

describe("createSnapshot", () => {
  it("stores a copy of the note's title and content", async () => {
    const note = await createNote({ title: "Alpha", content: doc("hello world") });
    const snap = await createSnapshot(note.id);

    expect(snap).not.toBeNull();
    expect(snap!.noteId).toBe(note.id);
    expect(snap!.title).toBe("Alpha");
    expect(snap!.content).toEqual(doc("hello world"));

    const stored = await db.snapshots.get(snap!.id);
    expect(stored).toBeDefined();
  });

  it("returns null for a missing note", async () => {
    expect(await createSnapshot("nope")).toBeNull();
  });

  it("dedupes: identical to the newest snapshot is skipped", async () => {
    const note = await createNote({ title: "Alpha", content: doc("same") });
    const first = await createSnapshot(note.id);
    const second = await createSnapshot(note.id);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(await db.snapshots.count()).toBe(1);
  });

  it("snapshots again once the note changes", async () => {
    const note = await createNote({ title: "Alpha", content: doc("v1") });
    await createSnapshot(note.id);
    await updateNote(note.id, { content: doc("v2") });
    const second = await createSnapshot(note.id);

    expect(second).not.toBeNull();
    expect(await db.snapshots.count()).toBe(2);
  });

  it("prunes to MAX_SNAPSHOTS_PER_NOTE, keeping the newest", async () => {
    const note = await createNote({ title: "Alpha", content: doc("v0") });
    for (let i = 1; i <= MAX_SNAPSHOTS_PER_NOTE + 5; i++) {
      await updateNote(note.id, { content: doc(`v${i}`) });
      await createSnapshot(note.id);
    }

    const snaps = await listSnapshots(note.id);
    expect(snaps.length).toBe(MAX_SNAPSHOTS_PER_NOTE);
    // newest first, and the most recent version survived the prune
    expect(snaps[0].content).toEqual(doc(`v${MAX_SNAPSHOTS_PER_NOTE + 5}`));
  });
});

describe("maybeSnapshot", () => {
  it("creates a snapshot when there is none", async () => {
    const note = await createNote({ title: "Alpha", content: doc("v1") });
    expect(await maybeSnapshot(note.id)).not.toBeNull();
  });

  it("enforces the gap: a second call within minGapMs is skipped", async () => {
    const note = await createNote({ title: "Alpha", content: doc("v1") });
    await maybeSnapshot(note.id);
    await updateNote(note.id, { content: doc("v2") });

    expect(await maybeSnapshot(note.id)).toBeNull();
    expect(await db.snapshots.count()).toBe(1);
  });

  it("creates once the newest snapshot is older than the gap", async () => {
    const note = await createNote({ title: "Alpha", content: doc("v1") });
    const first = await maybeSnapshot(note.id);
    // backdate the snapshot beyond the default 60s gap
    await db.snapshots.update(first!.id, { createdAt: Date.now() - 61_000 });
    await updateNote(note.id, { content: doc("v2") });

    const second = await maybeSnapshot(note.id);
    expect(second).not.toBeNull();
    expect(await db.snapshots.count()).toBe(2);
  });
});

describe("listSnapshots", () => {
  it("returns snapshots newest first", async () => {
    const note = await createNote({ title: "Alpha", content: doc("v1") });
    const a = await createSnapshot(note.id);
    await updateNote(note.id, { content: doc("v2") });
    const b = await createSnapshot(note.id);
    // guarantee distinct timestamps
    await db.snapshots.update(a!.id, { createdAt: 1000 });
    await db.snapshots.update(b!.id, { createdAt: 2000 });

    const snaps = await listSnapshots(note.id);
    expect(snaps.map((s) => s.id)).toEqual([b!.id, a!.id]);
  });
});

describe("restoreSnapshot", () => {
  it("writes the snapshot back and safety-snapshots the current state first", async () => {
    const note = await createNote({ title: "Original", content: doc("v1") });
    const snapV1 = await createSnapshot(note.id);

    await updateNote(note.id, { title: "Changed", content: doc("v2") });
    await createSnapshot(note.id);

    await restoreSnapshot(snapV1!.id);

    const restored = await getNote(note.id);
    expect(restored!.title).toBe("Original");
    expect(restored!.content).toEqual(doc("v1"));

    // safety net: the pre-restore ("Changed"/v2) state is kept as the newest
    // snapshot (it already exists, so the restore's safety snapshot dedupes
    // against it — two snapshots total, restore is still undoable).
    const snaps = await listSnapshots(note.id);
    expect(snaps.length).toBe(2);
    expect(snaps[0].title).toBe("Changed");
    expect(snaps[0].content).toEqual(doc("v2"));
  });

  it("is a no-op for a missing snapshot", async () => {
    await expect(restoreSnapshot("nope")).resolves.toBeUndefined();
  });
});

describe("history cleanup", () => {
  it("deleteNote removes the note's snapshots", async () => {
    const note = await createNote({ title: "Alpha", content: doc("v1") });
    await createSnapshot(note.id);
    await updateNote(note.id, { content: doc("v2") });
    await createSnapshot(note.id);
    expect(await db.snapshots.count()).toBe(2);

    await deleteNote(note.id);

    expect(await db.snapshots.count()).toBe(0);
    expect(await getNote(note.id)).toBeUndefined();
  });

  it("deleteSnapshotsForNote leaves other notes' history alone", async () => {
    const a = await createNote({ title: "A", content: doc("a") });
    const b = await createNote({ title: "B", content: doc("b") });
    await createSnapshot(a.id);
    await createSnapshot(b.id);

    await deleteSnapshotsForNote(a.id);

    expect(await listSnapshots(a.id)).toEqual([]);
    expect(await listSnapshots(b.id)).toHaveLength(1);
  });
});
