"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Focus, Network, Search, X } from "lucide-react";
import { db } from "@/db";
import type { Note } from "@/db/schema";
import {
  buildGraphData,
  layoutGraph,
  type GraphEdge,
  type GraphNode,
} from "@/lib/graph-layout";
import { tagColor } from "@/lib/tree";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Stable empty array so the notes-identity memo doesn't invalidate every render. */
const NO_NOTES: Note[] = [];

interface NoteNodeData extends Record<string, unknown> {
  graph: GraphNode;
  dimmed: boolean;
  isHere: boolean;
}

type NoteFlowNode = Node<NoteNodeData, "note">;

/** Glowing dot + mono label below (styles in globals.css, "Knowledge graph"). */
function NoteFlowNodeView({ data }: NodeProps<NoteFlowNode>) {
  const g = data.graph;
  const color = g.tag ? tagColor(g.tag) : "var(--accent)";
  const r = g.radius;
  return (
    <div className={cn("kg-node", data.dimmed && "kg-dim")}>
      <Handle type="target" position={Position.Top} className="kg-handle" isConnectable={false} />
      <div
        className="kg-halo"
        style={{
          width: r * 3.2,
          height: r * 3.2,
          background: `radial-gradient(circle, ${color}59 0%, transparent 70%)`,
        }}
      />
      <div
        className="kg-dot"
        style={{
          width: r * 1.6,
          height: r * 1.6,
          background: `radial-gradient(circle at 35% 30%, ${color}, ${color}99)`,
          // Untagged notes get a clear ring so the dot reads as a node even
          // without a tag color.
          boxShadow: g.tag
            ? `0 0 ${Math.round(r * 0.9)}px ${color}aa`
            : `0 0 ${Math.round(r * 0.9)}px ${color}aa, 0 0 0 2px var(--line-strong)`,
        }}
      />
      {data.isHere && (
        <>
          <div className="kg-ring" style={{ width: r * 2.4, height: r * 2.4 }} />
          <div className="kg-here">You are here</div>
        </>
      )}
      <div className="kg-label" style={{ maxWidth: r * 6 }}>
        {g.title}
      </div>
      <Handle type="source" position={Position.Bottom} className="kg-handle" isConnectable={false} />
    </div>
  );
}

const nodeTypes = { note: NoteFlowNodeView };

function GraphInner() {
  const router = useRouter();
  const pathname = usePathname();
  const { fitView } = useReactFlow();

  // undefined while the live query resolves for the first time
  const liveNotes = useLiveQuery(() => db.notes.toArray(), []);
  const notes = liveNotes ?? NO_NOTES;

  const [hoverId, setHoverId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [activeTags, setActiveTags] = React.useState<ReadonlySet<string>>(new Set());

  const reducedMotion = React.useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  /** Currently open note (from /app/note/<id>), highlighted with a ring. */
  const hereId = React.useMemo(() => {
    const m = /\/app\/note\/([^/]+)/.exec(pathname ?? "");
    return m?.[1] ?? null;
  }, [pathname]);

  // Build + layout the graph once per notes-array identity (kept out of the render hot path).
  const { gNodes, gEdges, neighborMap } = React.useMemo(() => {
    const data = buildGraphData(notes);
    const nodes = layoutGraph(data.nodes, data.edges);
    const neighborMap = new Map<string, Set<string>>();
    for (const e of data.edges) {
      if (!neighborMap.has(e.source)) neighborMap.set(e.source, new Set());
      if (!neighborMap.has(e.target)) neighborMap.set(e.target, new Set());
      neighborMap.get(e.source)!.add(e.target);
      neighborMap.get(e.target)!.add(e.source);
    }
    return { gNodes: nodes, gEdges: data.edges, neighborMap };
  }, [notes]);

  /** Tag list with note counts, most common first — doubles as the color legend. */
  const tags = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of gNodes) {
      if (n.tag) counts.set(n.tag, (counts.get(n.tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [gNodes]);

  /**
   * Lit set from the search/tag filters. `null` = nothing filtered,
   * everything lit. Hover isolation is layered on top.
   */
  const matchSet = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && activeTags.size === 0) return null;
    const set = new Set<string>();
    for (const n of gNodes) {
      const okQuery = !q || n.title.toLowerCase().includes(q);
      const okTag = activeTags.size === 0 || (n.tag !== null && activeTags.has(n.tag));
      if (okQuery && okTag) set.add(n.id);
    }
    return set;
  }, [gNodes, query, activeTags]);

  const flowNodes: NoteFlowNode[] = React.useMemo(
    () =>
      gNodes.map((g) => {
        let dimmed = matchSet !== null && !matchSet.has(g.id);
        if (hoverId) {
          dimmed = hoverId !== g.id && !neighborMap.get(hoverId)?.has(g.id);
        }
        return {
          id: g.id,
          type: "note" as const,
          position: { x: g.x, y: g.y },
          data: { graph: g, dimmed, isHere: g.id === hereId },
        };
      }),
    [gNodes, matchSet, hoverId, hereId, neighborMap]
  );

  const flowEdges: Edge[] = React.useMemo(
    () =>
      gEdges.map((e: GraphEdge, i) => {
        const filteredOut =
          matchSet !== null && (!matchSet.has(e.source) || !matchSet.has(e.target));
        // Hover isolation: edges not touching the hovered node fade to almost
        // nothing; edges on the active path brighten with the accent.
        const onActivePath = hoverId !== null && (e.source === hoverId || e.target === hoverId);
        return {
          id: `e${i}`,
          source: e.source,
          target: e.target,
          style: {
            stroke: onActivePath ? "var(--accent)" : "var(--line-strong)",
            strokeWidth: onActivePath ? 1.6 : 1.2,
            strokeOpacity: filteredOut ? 0.1 : onActivePath ? 0.9 : 1,
          },
        };
      }),
    [gEdges, matchSet, hoverId]
  );

  // Fit the view once, when the first nodes arrive after mount.
  const hasFit = React.useRef(false);
  React.useEffect(() => {
    if (!hasFit.current && flowNodes.length > 0) {
      hasFit.current = true;
      fitView({ padding: 0.15, duration: reducedMotion ? 0 : 350 });
    }
  }, [flowNodes.length, fitView, reducedMotion]);

  const resetView = React.useCallback(() => {
    fitView({ padding: 0.15, duration: reducedMotion ? 0 : 350 });
  }, [fitView, reducedMotion]);

  const toggleTag = React.useCallback((tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  // Still resolving the first live query — don't flash the empty state.
  if (liveNotes === undefined) {
    return (
      <div className="grid h-full place-items-center text-sm text-faint">
        Loading graph…
      </div>
    );
  }

  // 0–1 notes: nothing to connect yet.
  if (notes.length < 2) {
    return (
      <div className="grid h-full place-items-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-line bg-raised p-10 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-accent/25 bg-accent/12">
            <Network className="size-6 stroke-accent-ink" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">Your constellation needs more stars</h2>
          <p className="mt-2 text-sm leading-relaxed text-mute">
            The graph maps [[wiki-links]] between notes. Create a second note and
            link them — the connection will light up here.
          </p>
          <Link href="/app" className="mt-6 inline-block">
            <Button>Back home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {/* Floating glass controls (design spec §3.5) */}
      <div className="absolute top-4 left-4 z-10 w-[260px] rounded-xl border border-line bg-raised/80 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-[16px]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Filter notes…"
            aria-label="Filter graph nodes"
            className="w-full rounded-lg border border-line bg-overlay py-1.5 pr-7 pl-7 text-[13px] outline-none placeholder:text-faint/70 focus:border-accent/50"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear filter"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded p-0.5 text-faint transition-colors hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {tags.map(([tag, count]) => {
              const active = activeTags.has(tag);
              const color = tagColor(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  aria-pressed={active}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] transition-colors duration-150",
                    active
                      ? "border-accent/60 bg-accent/12 text-ink"
                      : "border-line text-mute hover:border-line-strong hover:text-ink"
                  )}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: color, boxShadow: `0 0 6px ${color}88` }}
                  />
                  #{tag}
                  <span className="text-faint">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
          <span className="font-mono text-[10.5px] text-faint">
            {gNodes.length} notes · {gEdges.length} links
          </span>
          <button
            onClick={resetView}
            title="Reset view"
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-overlay px-2 py-1 text-[11px] text-mute transition-colors duration-150 hover:border-line-strong hover:text-ink"
          >
            <Focus className="size-3.5" />
            Reset view
          </button>
        </div>
        {gEdges.length > 0 && (
          <p className="mt-1.5 text-[10.5px] leading-snug text-faint">
            Linked clusters on the left · unlinked notes on the right
          </p>
        )}
      </div>

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => router.push(`/app/note/${node.id}`)}
        onNodeMouseEnter={(_, node) => setHoverId(node.id)}
        onNodeMouseLeave={() => setHoverId(null)}
        minZoom={0.05}
        maxZoom={2.5}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        className="kg-canvas"
        style={{ background: "var(--bg)" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="var(--line)" />
      </ReactFlow>
    </div>
  );
}

export function KnowledgeGraph() {
  return (
    <ReactFlowProvider>
      <GraphInner />
    </ReactFlowProvider>
  );
}
