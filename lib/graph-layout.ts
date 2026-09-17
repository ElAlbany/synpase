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
 * Deterministic placement in two zones:
 *
 * 1. CONNECTED CLUSTERS (left) — every component of 2+ linked notes runs its
 *    own force simulation, then the cluster is centered in a reading-order
 *    grid slot. Related notes stay physically together.
 * 2. SINGLETONS (right) — unlinked notes sit in a tidy grid so they read as
 *    "not yet connected" instead of scattering noise across the canvas.
 *
 * Identical inputs always produce identical layouts (seeded PRNG, sorted
 * ordering). Returns a new array; input nodes are not mutated.
 */
export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  opts: LayoutOptions = {}
): GraphNode[] {
  const n = nodes.length;
  if (n === 0) return [];

  const comps = connectedComponents(nodes, edges);
  const clusters = comps
    .filter((c) => c.length > 1)
    .sort(
      (a, b) => b.length - a.length || minId(a).localeCompare(minId(b))
    );
  const singles = comps
    .filter((c) => c.length === 1)
    .map((c) => c[0])
    .sort((a, b) => a.id.localeCompare(b.id));

  const placed = new Map<string, [number, number]>();
  const SLOT_W = 560;
  const SLOT_H = 460;
  const SLOT_PAD = 150;

  // Zone 1: clusters, two per row, anchored left.
  const clusterCols = 2;
  clusters.forEach((comp, i) => {
    const localEdges = edges.filter(
      (e) =>
        comp.some((nd) => nd.id === e.source) &&
        comp.some((nd) => nd.id === e.target)
    );
    const pos = simulate(comp, localEdges, opts);
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const [x, y] of pos) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const bw = Math.max(maxX - minX, 1);
    const bh = Math.max(maxY - minY, 1);
    const col = i % clusterCols;
    const row = Math.floor(i / clusterCols);
    const ox = col * (SLOT_W + SLOT_PAD);
    const oy = row * (SLOT_H + SLOT_PAD);
    comp.forEach((node, j) => {
      placed.set(node.id, [
        ox + (pos[j][0] - minX) + (SLOT_W - bw) / 2,
        oy + (pos[j][1] - minY) + (SLOT_H - bh) / 2,
      ]);
    });
  });

  // Zone 2: singletons in a grid on the right, clearly separated.
  const clustersRight =
    clusters.length > 0 ? clusterCols * (SLOT_W + SLOT_PAD) - SLOT_PAD : 0;
  const singlesX = clusters.length > 0 ? clustersRight + 260 : 0;
  const CELL_W = 190;
  const CELL_H = 130;
  const cols = Math.max(1, Math.ceil(Math.sqrt(singles.length)));
  singles.forEach((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    placed.set(node.id, [singlesX + col * CELL_W, row * CELL_H]);
  });

  return nodes.map((node) => {
    const p = placed.get(node.id);
    if (!p) return { ...node, x: 0, y: 0 };
    return {
      ...node,
      x: Math.round(p[0] * 100) / 100,
      y: Math.round(p[1] * 100) / 100,
    };
  });
}

/** Connected components over note ids (union-find); every node appears once. */
function connectedComponents(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    // path halving
    let c = x;
    while (parent.get(c) !== c) {
      const next = parent.get(c)!;
      parent.set(c, r);
      c = next;
    }
    return r;
  };
  const ids = new Set(nodes.map((nd) => nd.id));
  for (const nd of nodes) parent.set(nd.id, nd.id);
  for (const e of edges) {
    if (ids.has(e.source) && ids.has(e.target)) {
      parent.set(find(e.source), find(e.target));
    }
  }
  const groups = new Map<string, GraphNode[]>();
  for (const nd of nodes) {
    const r = find(nd.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(nd);
  }
  return [...groups.values()];
}

function minId(comp: GraphNode[]): string {
  return comp.reduce((a, b) => (a.id < b.id ? a : b)).id;
}

/**
 * Fruchterman–Reingold on a local node set: repulsion between all pairs,
 * spring attraction along edges, centering gravity. Nodes start on a
 * golden-angle spiral with PRNG jitter (stable, no exact overlaps).
 * Returns raw (uncentered) positions.
 */
function simulate(
  nodes: GraphNode[],
  edges: GraphEdge[],
  opts: LayoutOptions
): [number, number][] {
  const {
    iterations = 300,
    seed = 1337,
    idealLength = 150,
    repulsion = 1,
    attraction = 0.3,
    gravity = 0.02,
  } = opts;

  const len = nodes.length;
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
    for (let i = 0; i < len; i++) {
      disp[i][0] = 0;
      disp[i][1] = 0;
    }
    // repulsion between all pairs
    for (let i = 0; i < len; i++) {
      for (let j = i + 1; j < len; j++) {
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
    for (let i = 0; i < len; i++) {
      disp[i][0] -= pos[i][0] * gravity;
      disp[i][1] -= pos[i][1] * gravity;
    }
    // apply displacement, capped by the cooling temperature
    for (let i = 0; i < len; i++) {
      const dx = disp[i][0];
      const dy = disp[i][1];
      const d = Math.sqrt(dx * dx + dy * dy);
      const scale = d > temp ? temp / d : 1;
      pos[i][0] += dx * scale;
      pos[i][1] += dy * scale;
    }
    temp -= cool;
  }

  return pos;
}
