import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Synapse — Personal Knowledge Base",
    short_name: "Synapse",
    description:
      "A block-based knowledge base with bi-directional links, a living graph, and instant full-text search — fully offline, in your browser.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#0A0B0E",
    theme_color: "#0A0B0E",
    categories: ["productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
