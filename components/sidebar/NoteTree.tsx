"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  CornerDownRight,
  FileText,
  Star,
  Trash2,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { buildTree, type TreeNode } from "@/lib/tree";
import { useNotesStore } from "@/stores/useNotesStore";
import { cn } from "@/lib/utils";

export function NoteTree({ collapsed }: { collapsed: boolean }) {
  const notes = useLiveQuery(() => db.notes.toArray(), []);
  const tree = React.useMemo(() => (notes ? buildTree(notes) : []), [notes]);

  if (!notes) return null;

  return (
    <div className="flex flex-col gap-0.5">
      {tree.map((node) => (
        <TreeNode key={node.note.id} node={node} collapsed={collapsed} />
      ))}
    </div>
  );
}

function TreeNode({ node, collapsed }: { node: TreeNode; collapsed: boolean }) {
  const [expanded, setExpanded] = React.useState(true);
  const [confirming, setConfirming] = React.useState(false);
  const confirmTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { deleteNote, toggleFavorite, createNote } = useNotesStore();
  const router = useRouter();

  const pathname = usePathname();
  const isActive = pathname === `/app/note/${node.note.id}`;
  const hasChildren = node.children.length > 0;

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      confirmTimer.current = setTimeout(() => setConfirming(false), 2500);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    deleteNote(node.note.id);
  };

  const handleAddChild = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const child = await createNote({
      parentId: node.note.id,
      title: "Untitled",
    });
    setExpanded(true);
    router.push(`/app/note/${child.id}`);
  };

  return (
    <div>
      <div
        className={cn(
          "group relative flex items-center gap-1 rounded-lg py-1.5 pr-1 text-[13px] transition-colors duration-150 hover:bg-overlay" +
          (isActive ? " bg-accent/10 text-accent-ink" : " text-mute hover:text-ink")
        )}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse" : "Expand"}
            className="grid size-5 flex-none place-items-center rounded text-faint transition-transform duration-200 [transition-timing-function:cubic-bezier(.16,1,.3,1)] hover:text-ink"
            style={{ transform: expanded ? "rotate(90deg)" : "none" }}
          >
            <ChevronRight className="size-3.5" />
          </button>
        ) : (
          <span className="grid size-5 flex-none place-items-center">
            <FileText className="size-3.5 text-faint" />
          </span>
        )}

        <Link
          href={`/app/note/${node.note.id}`}
          title={node.note.title}
          className="min-w-0 flex-1 truncate transition-colors duration-150 hover:text-ink"
        >
          {node.note.title || "Untitled"}
        </Link>

        {/* hover-revealed actions */}
        {!collapsed && (
          <span className="flex flex-none items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            <IconBtn
              label="Add child note"
              onClick={handleAddChild}
              className="hover:text-accent"
            >
              <CornerDownRight className="size-3.5" />
            </IconBtn>
            <IconBtn
              label={node.note.isFavorite ? "Unfavorite" : "Favorite"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite(node.note.id);
              }}
              className={node.note.isFavorite ? "text-amber-400" : "hover:text-amber-400"}
            >
              <Star
                className="size-3.5"
                fill={node.note.isFavorite ? "currentColor" : "none"}
              />
            </IconBtn>
            <IconBtn
              label={confirming ? "Click again to confirm" : "Delete note"}
              onClick={handleDelete}
              className={confirming ? "text-danger" : "hover:text-danger"}
            >
              <Trash2 className="size-3.5" />
            </IconBtn>
          </span>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="ml-3.5 border-l border-line pl-1.5">
          {node.children.map((child) => (
            <TreeNode key={child.note.id} node={child} collapsed={collapsed} />
          ))}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid size-6 place-items-center rounded-md text-faint transition-colors duration-150",
        className
      )}
    >
      {children}
    </button>
  );
}
