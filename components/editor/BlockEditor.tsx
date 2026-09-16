"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/core/style.css";
import "@blocknote/mantine/style.css";
import { synapseDark, synapseLight } from "@/lib/blocknote-theme";
import { transformWikiLinks } from "@/lib/wikilinks";
import { createNote, findNoteByTitle } from "@/db/notes";

function parseInitial(json: string): PartialBlock[] | undefined {
  try {
    const v: unknown = JSON.parse(json);
    if (Array.isArray(v) && v.length > 0) return sanitizeBlocks(v);
  } catch {
    /* fall through to undefined */
  }
  return undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Normalizes stored blocks before BlockNote sees them. Legacy docs (Phase 1
 * strings, `{type:"paragraph", content:"text"}`) and runs saved without a
 * `styles` object crash BlockNote 0.28's `Object.entries(styledText.styles)`.
 * Fill the gaps: props {}, string content → styled runs, missing styles → {}.
 */
function sanitizeBlocks(blocks: unknown[]): PartialBlock[] {
  return blocks.map((raw) => {
    if (!isRecord(raw)) return raw as PartialBlock;
    const block: Record<string, unknown> = { ...raw };
    if (!isRecord(block.props)) block.props = {};
    if (typeof block.content === "string") {
      block.content = block.content
        ? [{ type: "text", text: block.content, styles: {} }]
        : [];
    } else if (Array.isArray(block.content)) {
      block.content = block.content.map((run) =>
        isRecord(run) && run.type === "text" && !isRecord(run.styles)
          ? { ...run, styles: {} }
          : run,
      );
    }
    if (Array.isArray(block.children)) {
      block.children = sanitizeBlocks(block.children);
    }
    return block as PartialBlock;
  });
}

/**
 * The Synapse block editor.
 *
 * Wiki-link flow: on every change we normalize [[links]] into real link marks
 * (synapse:<title> hrefs) before persisting. Clicks on those links are
 * intercepted here: navigate if the note exists, otherwise create it
 * Obsidian-style, then navigate.
 */
export function BlockEditor({
  initialJson,
  onChange,
}: {
  initialJson: string;
  onChange: (blocks: unknown) => void;
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const initialContent = React.useMemo(
    () => parseInitial(initialJson),
    [initialJson],
  );
  // BlockNote 0.28 crashes on `initialContent: undefined` (Object.entries) —
  // omit the key entirely for empty/legacy docs so new notes start blank.
  const editor = useCreateBlockNote(
    initialContent ? { initialContent } : undefined,
  );

  const handleClickCapture = async (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest?.('a[href^="synapse:"]');
    if (!anchor) return;
    e.preventDefault();
    e.stopPropagation();
    const title = decodeURIComponent(
      anchor.getAttribute("href")!.slice("synapse:".length),
    );
    const existing = await findNoteByTitle(title);
    const target = existing ?? (await createNote({ title }));
    router.push(`/app/note/${target.id}`);
  };

  return (
    <div className="bn-wrapper -mx-2" onClickCapture={handleClickCapture}>
      <BlockNoteView
        editor={editor}
        theme={resolvedTheme === "dark" ? synapseDark : synapseLight}
        onChange={() => onChange(transformWikiLinks(editor.document))}
      />
    </div>
  );
}
