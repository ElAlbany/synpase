import { db } from "./index";
import { createNote, updateNote } from "./notes";

/**
 * Seeds a small, interlinked welcome pack so a first-time user (or reviewer)
 * immediately sees the tree, favorites, tags and wiki-link syntax.
 * Guarded by a module-level promise so StrictMode double-invocation is safe.
 */
let seeding: Promise<void> | null = null;

export function seedNotesIfEmpty(): Promise<void> {
  if (!seeding) {
    seeding = (async () => {
      const count = await db.notes.count();
      if (count > 0) return;

      const welcome = await createNote({
        title: "Welcome to Synapse",
        tags: ["welcome", "guide"],
        isFavorite: true,
        content:
          "This is your knowledge base. Everything you write lives in your browser — no account, no cloud.\n\nA few things to try:\n\n- Press the New note button in the sidebar\n- Type [[ to link to another note (coming fully alive with the block editor in Phase 2)\n- Read [[Linking your ideas]] to learn how connections work\n- Open the graph view to see your thinking take shape",
      });

      const linking = await createNote({
        title: "Linking your ideas",
        tags: ["guide"],
        content:
          "Knowledge compounds when ideas connect. Every [[wiki-link]] you create is a two-way street: the linked note knows you referenced it.\n\nThat's what the backlinks panel shows — every path that leads to the note you're reading.\n\nStart small: link [[Welcome to Synapse]] back, then branch out.",
      });

      const graph = await createNote({
        title: "The Graph",
        tags: ["guide"],
        content:
          "Every note is a node; every link is an edge. Over time your notes stop being a list and start being a map.\n\nThe graph view (Phase 3) renders this map as an interactive constellation — hover to isolate a cluster, click to dive into a note.\n\nIt all begins with [[Linking your ideas]].",
      });

      // interlink: make the backlinks panel meaningful on day one
      await updateNote(linking.id, {
        content:
          "Knowledge compounds when ideas connect. Every [[wiki-link]] you create is a two-way street: the linked note knows you referenced it.\n\nThat's what the backlinks panel shows — every path that leads to the note you're reading.\n\nStart small: link [[Welcome to Synapse]] back, then branch out to [[The Graph]].",
      });
      await updateNote(welcome.id, {
        content:
          "This is your knowledge base. Everything you write lives in your browser — no account, no cloud.\n\nA few things to try:\n\n- Press the New note button in the sidebar\n- Type [[ to link to another note (coming fully alive with the block editor in Phase 2)\n- Read [[Linking your ideas]] to learn how connections work\n- Explore [[The Graph]] to see your thinking take shape",
      });
      void graph;
    })();
  }
  return seeding;
}
