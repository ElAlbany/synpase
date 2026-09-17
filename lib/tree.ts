import type { Note } from "@/db/schema";

export interface TreeNode {
  note: Note;
  children: TreeNode[];
}

/** Builds a nested tree from a flat note list (children sorted by title). */
export function buildTree(notes: Note[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const note of notes) {
    map.set(note.id, { note, children: [] });
  }
  for (const note of notes) {
    const node = map.get(note.id)!;
    if (note.parentId && map.has(note.parentId)) {
      map.get(note.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.note.title.localeCompare(b.note.title));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/** Tag color palette — auto-assigned by hashing the tag name (design spec §5). */
const TAG_PALETTE = [
  "#6E6BFF", "#A78BFA", "#2DD4BF", "#F59E0B",
  "#F87171", "#34D399", "#60A5FA", "#F472B6",
];

/** Stable palette index (0–7) for a tag name. Pair with the .tag-N /
    .tag-pill CSS classes, which resolve to per-theme --tag-N tokens. */
export function tagIndex(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) | 0;
  return Math.abs(h) % TAG_PALETTE.length;
}

/** Dark-tuned hex from TAG_PALETTE. Canvas/graph rendering only (SVG/canvas
    can't use CSS classes) — DOM tag pills should use tagIndex + .tag-pill. */
export function tagColor(tag: string): string {
  return TAG_PALETTE[tagIndex(tag)];
}
