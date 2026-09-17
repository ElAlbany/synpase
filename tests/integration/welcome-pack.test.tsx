import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";

/**
 * seedWelcomePack caches its promise at module level (StrictMode safety),
 * so each test gets a fresh module via vi.resetModules + dynamic import.
 */
async function freshSeed() {
  vi.resetModules(); // new module → fresh module-level promise guard
  const mod = await import("@/db/seed");
  return mod.seedWelcomePack;
}

describe("seedWelcomePack", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("creates three interlinked notes in an empty vault", async () => {
    const seedWelcomePack = await freshSeed();
    const created = await seedWelcomePack();

    expect(created).toBe(3);
    const notes = await db.notes.toArray();
    expect(notes).toHaveLength(3);
    const titles = notes.map((n) => n.title);
    expect(titles).toEqual(
      expect.arrayContaining(["Welcome to Synapse", "Linking your ideas", "The Graph"])
    );

    const welcome = notes.find((n) => n.title === "Welcome to Synapse")!;
    expect(welcome.isFavorite).toBe(true);
    expect(welcome.tags).toContain("guide");

    // The pack notes reference each other with [[wiki-links]].
    const all = notes.map((n) => JSON.stringify(n.content)).join("\n");
    expect(all).toContain("[[Linking your ideas]]");
    expect(all).toContain("[[Welcome to Synapse]]");
    expect(all).toContain("[[The Graph]]");
  });

  it("is idempotent: skips notes whose titles already exist", async () => {
    const seedWelcomePack = await freshSeed();
    await seedWelcomePack();
    const countAfterFirst = await db.notes.count();
    expect(countAfterFirst).toBe(3);

    // Fresh module (new promise) against the same populated vault.
    const again = await freshSeed();
    const created = await again();
    expect(created).toBe(0);
    expect(await db.notes.count()).toBe(3);
  });

  it("fills in only the missing pack notes in an existing vault", async () => {
    const { createNote } = await import("@/db/notes");
    await createNote({ title: "My Own Note" });
    const seedWelcomePack = await freshSeed();
    const created = await seedWelcomePack();

    expect(created).toBe(3);
    expect(await db.notes.count()).toBe(4);
    // The user's own note is untouched.
    expect((await db.notes.toArray()).some((n) => n.title === "My Own Note")).toBe(true);
  });

  it("matches existing titles case-insensitively and does not duplicate", async () => {
    const { createNote } = await import("@/db/notes");
    await createNote({ title: "welcome to synapse" });
    const seedWelcomePack = await freshSeed();
    const created = await seedWelcomePack();

    expect(created).toBe(2);
    const welcomeNotes = (await db.notes.toArray()).filter(
      (n) => n.title.toLowerCase() === "welcome to synapse"
    );
    expect(welcomeNotes).toHaveLength(1);
  });
});
