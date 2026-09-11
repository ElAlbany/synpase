import { db } from "./index";
import type { AppSettings } from "./schema";

const DEFAULTS: AppSettings = {
  id: "settings",
  theme: "system",
  sidebarCollapsed: false,
  lastOpenedNoteId: null,
};

export async function getSettings(): Promise<AppSettings> {
  const stored = await db.settings.get("settings");
  return stored ?? DEFAULTS;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch });
}
