import { createNote, findNoteByTitle } from "./notes";

/**
 * Seeds a small, interlinked welcome pack so a first-time user (or reviewer)
 * immediately sees the tree, favorites, tags and wiki-link syntax.
 * Idempotent: pack notes whose titles already exist are skipped, so the pack
 * can also top up an existing vault (sidebar → "Add welcome & guide notes").
 * Guarded by a module-level promise so StrictMode double-invocation is safe.
 */

const PACK_WELCOME = "Welcome to Synapse";
const PACK_LINKING = "Linking your ideas";
const PACK_GRAPH = "The Graph";

let packSeeding: Promise<number> | null = null;

/**
 * Insert the welcome pack, skipping any note whose title already exists
 * (case-insensitive). Resolves to the number of notes created — 0 when the
 * pack is already fully present.
 */
export function seedWelcomePack(): Promise<number> {
  if (!packSeeding) {
    packSeeding = (async () => {
      let created = 0;
      if (!(await findNoteByTitle(PACK_WELCOME))) {
        await createNote({
          title: PACK_WELCOME,
          tags: ["welcome", "guide"],
          isFavorite: true,
          content: WELCOME_CONTENT,
        });
        created++;
      }
      if (!(await findNoteByTitle(PACK_LINKING))) {
        await createNote({
          title: PACK_LINKING,
          tags: ["guide"],
          content: LINKING_CONTENT,
        });
        created++;
      }
      if (!(await findNoteByTitle(PACK_GRAPH))) {
        await createNote({
          title: PACK_GRAPH,
          tags: ["guide"],
          content: GRAPH_CONTENT,
        });
        created++;
      }
      return created;
    })();
  }
  return packSeeding;
}

const WELCOME_CONTENT =
  "This is your knowledge base. Everything you write lives in your browser — no account, no cloud.\n\nA few things to try:\n\n- Press the New note button in the sidebar\n- Type [[Linking your ideas]] — wiki-links are clickable and build your backlinks automatically\n- Read [[Linking your ideas]] to learn how connections work\n- Explore [[The Graph]] to see your thinking take shape";

const LINKING_CONTENT =
  "Knowledge compounds when ideas connect. Every [[wiki-link]] you create is a two-way street: the linked note knows you referenced it.\n\nThat's what the backlinks panel shows — every path that leads to the note you're reading.\n\nStart small: link [[Welcome to Synapse]] back, then branch out to [[The Graph]].";

const GRAPH_CONTENT =
  "Every note is a node; every link is an edge. Over time your notes stop being a list and start being a map.\n\nThe graph view renders this map as an interactive constellation — hover to isolate a cluster, click to dive into a note.\n\nIt all begins with [[Linking your ideas]].";
