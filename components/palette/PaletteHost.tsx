"use client";

import { CommandPalette } from "@/components/palette/CommandPalette";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

/** Mounts the command palette + global shortcuts once at the app-shell level. */
export function PaletteHost() {
  useKeyboardShortcuts();
  return <CommandPalette />;
}
