import type { Theme } from "@blocknote/mantine";

/**
 * Synapse themes for BlockNote — mirrors the "Graphite Aurora" tokens.
 * (Static hexes; BlockNote needs JS values, not CSS vars.)
 */

export const synapseDark: Theme = {
  colors: {
    editor: {
      text: "#F2F3F5",
      background: "transparent",
    },
    menu: { text: "#F2F3F5", background: "#111318" },
    tooltip: { text: "#F2F3F5", background: "#111318" },
    hovered: { text: "#F2F3F5", background: "rgba(255,255,255,0.07)" },
    selected: { text: "#F2F3F5", background: "rgba(110,107,255,0.2)" },
    disabled: { text: "#7E828B", background: "rgba(255,255,255,0.04)" },
    shadow: "rgba(0,0,0,0.55)",
    border: "rgba(255,255,255,0.12)",
    sideMenu: "#0A0B0E",
  },
  borderRadius: 8,
  fontFamily: "inherit",
};

export const synapseLight: Theme = {
  colors: {
    editor: {
      text: "#16171B",
      background: "transparent",
    },
    menu: { text: "#16171B", background: "#FFFFFF" },
    tooltip: { text: "#16171B", background: "#FFFFFF" },
    hovered: { text: "#16171B", background: "rgba(0,0,0,0.05)" },
    selected: { text: "#16171B", background: "rgba(79,76,216,0.14)" },
    disabled: { text: "#6D7179", background: "rgba(0,0,0,0.03)" },
    shadow: "rgba(0,0,0,0.18)",
    border: "rgba(0,0,0,0.14)",
    sideMenu: "#FAFAFB",
  },
  borderRadius: 8,
  fontFamily: "inherit",
};
