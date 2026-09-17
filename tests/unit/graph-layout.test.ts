import { describe, expect, it } from "vitest";
import { buildGraphData, layoutGraph } from "@/lib/graph-layout";
import type { GraphNode } from "@/lib/graph-layout";
import type { Note } from "@/db/schema";

function note(partial: Partial<Note> & { id: string }): Note {
  return {
    title: partial.id,
    content: "",
    parentId: null,
    tags: [],
    isFavorite: false,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe("buildGraphData", () => {
  it("creates one node per note and no edges for unlinked notes", () => {
    const { nodes, edges } = buildGraphData([note({ id: "a" }), note({ id: "b" })]);
    expect(nodes).toHaveLength(2);
    expect(edges).toEqual([]);
  });

  it("resolves links case-insensitively by title", () => {
    const notes = [
      note({ id: "target", title: "Target Note" }),
      note({ id: "src", title: "Source", content: "go read [[target NOTE]]" }),
    ];
    const { edges } = buildGraphData(notes);
    expect(edges).toEqual([{ source: "src", target: "target" }]);
  });

  it("builds edges from native link inline content (saved BlockNote docs)", () => {
    const notes = [
      note({ id: "target", title: "Target Note" }),
      note({
        id: "src",
        title: "Source",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "go read ", styles: {} },
              {
                type: "link",
                href: "synapse:Target%20Note",
                content: [{ type: "text", text: "[[Target Note]]", styles: {} }],
              },
            ],
          },
        ],
      }),
    ];
    const { edges } = buildGraphData(notes);
    expect(edges).toEqual([{ source: "src", target: "target" }]);
  });

  it("drops self-links", () => {
    const { edges } = buildGraphData([
      note({ id: "a", title: "Self", content: "[[Self]]" }),
    ]);
    expect(edges).toEqual([]);
  });

  it("drops dangling links to missing notes", () => {
    const { edges } = buildGraphData([
      note({ id: "a", title: "A", content: "[[Ghost]] and [[Also Missing]]" }),
    ]);
    expect(edges).toEqual([]);
  });

  it("dedupes repeated links between the same pair", () => {
    const notes = [
      note({ id: "a", title: "A" }),
      note({ id: "b", title: "B", content: "[[A]] [[A]] [[a]]" }),
    ];
    const { edges } = buildGraphData(notes);
    expect(edges).toEqual([{ source: "b", target: "a" }]);
  });

  it("counts degree as incoming links and maps radius 10..26", () => {
    const notes = [
      note({ id: "hub", title: "Hub" }),
      note({ id: "s1", title: "S1", content: "[[Hub]]" }),
      note({ id: "s2", title: "S2", content: "[[Hub]]" }),
      note({ id: "lonely", title: "Lonely" }),
    ];
    const { nodes } = buildGraphData(notes);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(byId.get("hub")).toMatchObject({ degree: 2, radius: 26 });
    expect(byId.get("s1")).toMatchObject({ degree: 0, radius: 10 });
    expect(byId.get("lonely")).toMatchObject({ degree: 0, radius: 10 });
  });

  it("gives a degree-1 node a radius between the extremes", () => {
    const notes = [
      note({ id: "a", title: "A" }),
      note({ id: "b", title: "B", content: "[[A]]" }),
      note({ id: "c", title: "C", content: "[[A]] [[B]]" }),
    ];
    const { nodes } = buildGraphData(notes);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(byId.get("a")!.degree).toBe(2); // backlinks from b and c
    expect(byId.get("b")!.degree).toBe(1);
    expect(byId.get("b")!.radius).toBe(18); // halfway between 10 and 26
    expect(byId.get("c")!.degree).toBe(0); // degree counts backlinks only
  });

  it("falls back to MIN_RADIUS for all nodes when there are no edges", () => {
    const { nodes } = buildGraphData([note({ id: "a" }), note({ id: "b" })]);
    expect(nodes.every((n) => n.radius === 10)).toBe(true);
  });

  it("uses the first tag for the node color and trims titles", () => {
    const { nodes } = buildGraphData([
      note({ id: "a", title: "   ", tags: ["work", "extra"] }),
    ]);
    expect(nodes[0]).toMatchObject({ title: "Untitled", tag: "work" });
  });
});

describe("layoutGraph", () => {
  const sample = () => {
    const notes = [
      note({ id: "a", title: "A" }),
      note({ id: "b", title: "B", content: "[[A]]" }),
      note({ id: "c", title: "C", content: "[[A]] [[B]]" }),
    ];
    return buildGraphData(notes);
  };

  it("is deterministic for identical inputs", () => {
    const g1 = sample();
    const g2 = sample();
    const l1 = layoutGraph(g1.nodes, g1.edges);
    const l2 = layoutGraph(g2.nodes, g2.edges);
    expect(JSON.stringify(l1)).toBe(JSON.stringify(l2));
  });

  it("produces finite coordinates", () => {
    const { nodes, edges } = sample();
    const laid = layoutGraph(nodes, edges);
    for (const n of laid) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });

  it("does not mutate the input nodes", () => {
    const { nodes, edges } = sample();
    const snapshot = JSON.parse(JSON.stringify(nodes)) as GraphNode[];
    layoutGraph(nodes, edges);
    expect(JSON.stringify(nodes)).toBe(JSON.stringify(snapshot));
    expect(nodes.every((n) => n.x === 0 && n.y === 0)).toBe(true);
  });

  it("returns one positioned node per input node", () => {
    const { nodes, edges } = sample();
    const laid = layoutGraph(nodes, edges);
    expect(laid).toHaveLength(nodes.length);
    expect(new Set(laid.map((n) => n.id))).toEqual(new Set(nodes.map((n) => n.id)));
  });

  it("handles duplicate-position starts (coincident nodes) without NaN", () => {
    const nodes: GraphNode[] = [
      { id: "a", title: "A", tag: null, degree: 0, radius: 10, x: 0, y: 0 },
      { id: "b", title: "B", tag: null, degree: 0, radius: 10, x: 0, y: 0 },
    ];
    const laid = layoutGraph(nodes, [], { iterations: 50 });
    for (const n of laid) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });

  it("ignores edges that reference unknown nodes", () => {
    const { nodes } = sample();
    const laid = layoutGraph(nodes, [{ source: "nope", target: "alsonope" }]);
    expect(laid).toHaveLength(nodes.length);
  });

  it("returns an empty array for no nodes", () => {
    expect(layoutGraph([], [])).toEqual([]);
  });

  it("keeps connected clusters on the left and singletons on the right", () => {
    // Cluster: a — b — c (linked). Singles: s1, s2, s3.
    const notes = [
      note({ id: "a", title: "A" }),
      note({ id: "b", title: "B", content: "[[A]]" }),
      note({ id: "c", title: "C", content: "[[B]]" }),
      note({ id: "s1", title: "S1" }),
      note({ id: "s2", title: "S2" }),
      note({ id: "s3", title: "S3" }),
    ];
    const { nodes, edges } = buildGraphData(notes);
    const laid = layoutGraph(nodes, edges);
    const byId = new Map(laid.map((n) => [n.id, n]));

    const clusterXs = ["a", "b", "c"].map((id) => byId.get(id)!.x);
    const singleXs = ["s1", "s2", "s3"].map((id) => byId.get(id)!.x);
    const clusterMax = Math.max(...clusterXs);
    const singleMin = Math.min(...singleXs);
    // Clear left/right separation between the two zones.
    expect(clusterMax).toBeLessThan(singleMin);
    // Singletons sit on a tidy grid: identical y for the first row.
    expect(byId.get("s1")!.y).toBe(byId.get("s2")!.y);
  });

  it("places every singleton on the grid even with no edges at all", () => {
    const notes = [note({ id: "w" }), note({ id: "x" }), note({ id: "y" }), note({ id: "z" })];
    const { nodes, edges } = buildGraphData(notes);
    const laid = layoutGraph(nodes, edges);
    const byId = new Map(laid.map((n) => [n.id, n]));
    // 4 singles → 2x2 grid (sorted by id): w,x share the first row, y,z the next.
    expect(byId.get("w")!.y).toBe(byId.get("x")!.y);
    expect(byId.get("y")!.y).toBe(byId.get("z")!.y);
    expect(byId.get("w")!.y).not.toBe(byId.get("y")!.y);
  });

  it("separates two independent clusters into different slots", () => {
    const notes = [
      note({ id: "a", title: "A" }),
      note({ id: "b", title: "B", content: "[[A]]" }),
      note({ id: "p", title: "P" }),
      note({ id: "q", title: "Q", content: "[[P]]" }),
    ];
    const { nodes, edges } = buildGraphData(notes);
    const laid = layoutGraph(nodes, edges);
    const byId = new Map(laid.map((n) => [n.id, n]));
    // Cluster {a,b} occupies slot column 0, cluster {p,q} column 1 —
    // so a and p land in different slot x-ranges.
    const clusterAB = (byId.get("a")!.x + byId.get("b")!.x) / 2;
    const clusterPQ = (byId.get("p")!.x + byId.get("q")!.x) / 2;
    expect(Math.abs(clusterAB - clusterPQ)).toBeGreaterThan(200);
  });
});
