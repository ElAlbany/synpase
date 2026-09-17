import { describe, expect, it } from "vitest";
import { createNote, findNoteByTitle, resolveOrCreateNote } from "@/db/notes";
import { db } from "@/db";

describe("resolveOrCreateNote (wiki-link navigation)", () => {
  it("returns the existing note for an exact title", async () => {
    const existing = await createNote({ title: "Alpha Note" });
    const result = await resolveOrCreateNote("Alpha Note");
    expect(result?.id).toBe(existing.id);
    expect(await db.notes.count()).toBe(1);
  });

  it("matches titles case-insensitively and trims whitespace", async () => {
    const existing = await createNote({ title: "Alpha Note" });
    const result = await resolveOrCreateNote("  alpha NOTE  ");
    expect(result?.id).toBe(existing.id);
    expect(await db.notes.count()).toBe(1);
  });

  it("creates a new note when the title doesn't exist (Obsidian-style)", async () => {
    const result = await resolveOrCreateNote("Brand New Idea");
    expect(result?.title).toBe("Brand New Idea");
    expect(await db.notes.count()).toBe(1);
    // A second lookup finds the created note instead of duplicating it.
    const again = await resolveOrCreateNote("brand new idea");
    expect(again?.id).toBe(result?.id);
    expect(await db.notes.count()).toBe(1);
  });

  it("never creates a note for a blank title", async () => {
    expect(await resolveOrCreateNote("   ")).toBeNull();
    expect(await resolveOrCreateNote("")).toBeNull();
    expect(await db.notes.count()).toBe(0);
  });

  it("findNoteByTitle stays case-insensitive", async () => {
    await createNote({ title: "Mixed Case" });
    expect((await findNoteByTitle("mixed case"))?.title).toBe("Mixed Case");
    expect(await findNoteByTitle("missing")).toBeUndefined();
  });
});
