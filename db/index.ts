import Dexie, { type EntityTable } from "dexie";
import type { AppSettings, Note, NoteSnapshot } from "./schema";

export type SynapseDB = Dexie & {
  notes: EntityTable<Note, "id">;
  settings: EntityTable<AppSettings, "id">;
  snapshots: EntityTable<NoteSnapshot, "id">;
};

export const db = new Dexie("synapse") as SynapseDB;

db.version(1).stores({
  // NOTE: booleans are not valid IndexedDB keys — isFavorite is filtered in
  // memory (fine at PKM scale), never indexed.
  notes: "id, parentId, updatedAt, *tags",
  settings: "id",
});

// v2 adds local version history. All previous versions must stay declared so
// existing databases upgrade cleanly through Dexie's migration chain.
db.version(2).stores({
  notes: "id, parentId, updatedAt, *tags",
  settings: "id",
  snapshots: "id, noteId, createdAt",
});
