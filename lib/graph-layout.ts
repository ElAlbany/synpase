import type { Note } from "@/db/schema";
import { blocksToText, extractWikiLinks } from "@/lib/wikilinks";

/**
 * Knowledge-graph data model + deterministic force-directed layout.
 *
 * Pure functions only — no React, no DOM — so the layout can be unit-tested
 * and memoized on notes-array identity. At PKM scale (<500 notes) running
 * ~300 fixed iterations synchronously is effectively free.
 */

/** A note rendered as a glowing dot on the graph canvas. */
export interface GraphNode {
  id: string;
  title: string;
  /** First tag (drives the dot color), or null for untagged notes. */
  tag: string | null;
  /** Number of incoming wiki-links (backlinks). Drives dot size. */
  degree: number;
  /** Dot radius in graph units, mapped from degree 0..max → 10..26. */
  radius: number;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const MIN_RADIUS = 10;
const MAX_RADIUS = 26;

/**
 * Build nodes + edges from notes. Links come from [[wiki-links]] in the note
 * text; targets resolve case-insensitively by title. Self-links and links to
 * missing notes are skipped; duplicate (source → target) edges are deduped.
 */
export function buildGraphData(notes: Note[]): GraphData {
  const byTitle = new Map<string, Note>();
  for (const note of notes) {
    const key = note.title.trim().toLowerCase();
    if (key && !byTitle.has(key)) byTitle.set(key, note);
  }

  const seen = new Set<string>();
  const degree = new Map<string, number>();
  const edges: GraphEdge[] = [];

  for (const note of notes) {
    const links = extractWikiLinks(blocksToText(note.content));
    for (const raw of links) {
      const target = byTitle.get(raw.trim().toLowerCase());
      if (!target || target.id === note.id) continue;
      const key = `${note.id}->${target.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: note.id, target: target.id });
      degree.set(target.id, (degree.get(target.id) ?? 0) + 1);
    }
  }

  let max = 0;
  for (const note of notes) max = Math.max(max, degree.get(note.id) ?? 0);

  const nodes: GraphNode[] = notes.map((note) => {
    const d = degree.get(note.id) ?? 0;
    return {
      id: note.id,
      title: note.title.trim() || "Untitled",
      tag: note.tags[0] ?? null,
      degree: d,
      radius:
        max > 0 ? MIN_RADIUS + (d / max) * (MAX_RADIUS - MIN_RADIUS) : MIN_RADIUS,
      x: 0,
      y: 0,
    };
  });

  return { nodes, edges };
}

export interface LayoutOptions {
  /** Fixed simulation iterations (default 300). */
  iterations?: number;
  /** PRNG seed — identical inputs always produce identical layouts. */
  seed?: number;
  /** Resting length of an edge spring in graph units. */
  idealLength?: number;
  /** Pairwise repulsion strength (Fruchterman–Reingold k²/d flavor). */
  repulsion?: number;
  /** Edge spring stiffness, force per unit of stretch. */
  attraction?: number;
  /** Centering gravity, force per unit distance from the origin. */
  gravity?: number;
}

/** mulberry32 — tiny deterministic PRNG for stable jitter. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic force-directed placement: repulsion between all pairs,
 * spring attraction along edges, centering gravity. Nodes start on a
 * golden-angle spiral with PRNG jitter (stable across renders, no exact
 * overlaps). Returns a new array; input nodes are not mutated.
 */
export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  opts: LayoutOptions = {}
): GraphNode[] {
  const {
    iterations = 300,
    seed = 1337,
    idealLength = 150,
    repulsion = 1,
    attraction = 0.3,
    gravity = 0.02,
  } = opts;

  const n = nodes.length;
  if (n === 0) return [];

  const rand = mulberry32(seed);
  const pos: [number, number][] = nodes.map((_, i) => {
    const angle = i * 2.399963229728653 + rand() * 0.5;
    const r = 40 + Math.sqrt(i) * 60 + rand() * 30;
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  });

  const indexOf = new Map(nodes.map((node, i) => [node.id, i] as const));
  const springs: [number, number][] = [];
  for (const e of edges) {
    const s = indexOf.get(e.source);
    const t = indexOf.get(e.target);
    if (s !== undefined && t !== undefined) springs.push([s, t]);
  }

  const k2 = idealLength * idealLength;
  let temp = idealLength * 1.5;
  const cool = temp / iterations;
  const disp: [number, number][] = nodes.map(() => [0, 0]);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < n; i++) {
      disp[i][0] = 0;
      disp[i][1] = 0;
    }
    // repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i][0] - pos[j][0];
        let dy = pos[i][1] - pos[j][1];
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          // coincident nodes: deterministic nudge
          dx = rand() - 0.5;
          dy = rand() - 0.5;
          d2 = dx * dx + dy * dy + 0.01;
        }
        const d = Math.sqrt(d2);
        const f = (repulsion * k2) / d2;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        disp[i][0] += fx;
        disp[i][1] += fy;
        disp[j][0] -= fx;
        disp[j][1] -= fy;
      }
    }
    // spring attraction along edges (rest length = idealLength)
    for (const [i, j] of springs) {
      const dx = pos[j][0] - pos[i][0];
      const dy = pos[j][1] - pos[i][1];
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - idealLength) * attraction;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      disp[i][0] += fx;
      disp[i][1] += fy;
      disp[j][0] -= fx;
      disp[j][1] -= fy;
    }
    // centering gravity
    for (let i = 0; i < n; i++) {
      disp[i][0] -= pos[i][0] * gravity;
      disp[i][1] -= pos[i][1] * gravity;
    }
    // apply displacement, capped by the cooling temperature
    for (let i = 0; i < n; i++) {
      const dx = disp[i][0];
      const dy = disp[i][1];
      const d = Math.sqrt(dx * dx + dy * dy);
      const scale = d > temp ? temp / d : 1;
      pos[i][0] += dx * scale;
      pos[i][1] += dy * scale;
    }
    temp -= cool;
  }

  // recenter on the centroid
  let cx = 0;
  let cy = 0;
  for (const [x, y] of pos) {
    cx += x;
    cy += y;
  }
  cx /= n;
  cy /= n;

  return nodes.map((node, i) => ({
    ...node,
    x: Math.round((pos[i][0] - cx) * 100) / 100,
    y: Math.round((pos[i][1] - cy) * 100) / 100,
  }));
}
