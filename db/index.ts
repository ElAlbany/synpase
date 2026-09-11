import Dexie, { type EntityTable } from "dexie";
import type { AppSettings, Note } from "./schema";

export type SynapseDB = Dexie & {
  notes: EntityTable<Note, "id">;
  settings: EntityTable<AppSettings, "id">;
};

export const db = new Dexie("synapse") as SynapseDB;

db.version(1).stores({
  // NOTE: booleans are not valid IndexedDB keys — isFavorite is filtered in
  // memory (fine at PKM scale), never indexed.
  notes: "id, parentId, updatedAt, *tags",
  settings: "id",
});
