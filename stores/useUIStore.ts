"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  /** Command palette — ephemeral, never persisted. */
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  /** Mobile slide-in drawer — ephemeral, never persisted. */
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      paletteOpen: false,
      setPaletteOpen: (v) => set({ paletteOpen: v }),
      mobileNavOpen: false,
      setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
    }),
    {
      name: "synapse-ui",
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
);
