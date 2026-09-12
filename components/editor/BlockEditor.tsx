"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote, type BlockNoteEditor } from "@blocknote/react";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/core/style.css";
import "@blocknote/mantine/style.css";
import { synapseDark, synapseLight } from "@/lib/blocknote-theme";
import { transformWikiLinks } from "@/lib/wikilinks";
import { createNote, findNoteByTitle } from "@/db/notes";

function parseInitial(json: string): PartialBlock[] | undefined {
  try {
    const v: unknown = JSON.parse(json);
    if (Array.isArray(v) && v.length > 0) return v as PartialBlock[];
  } catch {
    /* fall through to undefined */
  }
  return undefined;
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
  const editor: BlockNoteEditor = useCreateBlockNote({ initialContent });

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
        onChange={(ed) => onChange(transformWikiLinks(ed.document))}
      />
    </div>
  );
}
