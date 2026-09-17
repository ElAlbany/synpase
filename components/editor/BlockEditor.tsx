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
import { sanitizeBlocks } from "@/lib/sanitize-blocks";
import { resolveOrCreateNote } from "@/db/notes";
import { WikiLinkSuggest, type SuggestRect } from "@/components/editor/WikiLinkSuggest";

function parseInitial(json: string): PartialBlock[] | undefined {
  try {
    const v: unknown = JSON.parse(json);
    if (Array.isArray(v) && v.length > 0) return sanitizeBlocks(v);
  } catch {
    /* fall through to undefined */
  }
  return undefined;
}

/**
 * The Synapse block editor.
 *
 * Wiki-link flow: typing `[[` opens a suggestion dropdown (WikiLinkSuggest)
 * that inserts native link inline content (synapse:<title> hrefs). Manually
 * typed [[links]] are upgraded on save by `transformWikiLinks`. Clicks on
 * synapse: links are intercepted here: navigate if the note exists, otherwise
 * create it Obsidian-style, then navigate.
 */
export function BlockEditor({
  initialJson,
  noteTitles = [],
  onChange,
}: {
  initialJson: string;
  /** Titles offered by the [[ suggestion dropdown (exclude the open note). */
  noteTitles?: string[];
  onChange: (blocks: unknown) => void;
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const initialContent = React.useMemo(
    () => parseInitial(initialJson),
    [initialJson]
  );
  // BlockNote 0.28 crashes on `initialContent: undefined` (Object.entries) —
  // omit the key entirely for empty/legacy docs so new notes start blank.
  const editor = useCreateBlockNote(
    initialContent ? { initialContent } : undefined
  );

  const [suggest, setSuggest] = React.useState<{
    query: string;
    rect: SuggestRect;
  } | null>(null);

  /** Recompute the open `[[query` (if any) at the caret. */
  const refreshSuggest = React.useCallback(() => {
    const view = editor.prosemirrorView;
    if (!view) return;
    const { state } = view;
    if (!state.selection.empty) {
      setSuggest(null);
      return;
    }
    const from = state.selection.from;
    const textBefore = state.doc.textBetween(Math.max(0, from - 160), from, "\n", "\0");
    const m = /\[\[([^\[\]]*)$/.exec(textBefore);
    if (!m) {
      setSuggest(null);
      return;
    }
    const coords = view.coordsAtPos(from);
    setSuggest({ query: m[1], rect: { left: coords.left, bottom: coords.bottom } });
  }, [editor]);

  React.useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    node.addEventListener("keyup", refreshSuggest);
    node.addEventListener("click", refreshSuggest);
    document.addEventListener("selectionchange", refreshSuggest);
    return () => {
      node.removeEventListener("keyup", refreshSuggest);
      node.removeEventListener("click", refreshSuggest);
      document.removeEventListener("selectionchange", refreshSuggest);
    };
  }, [refreshSuggest]);

  const applySuggest = React.useCallback(
    (title: string) => {
      const view = editor.prosemirrorView;
      if (view && suggest) {
        const { from } = view.state.selection;
        const start = Math.max(0, from - (suggest.query.length + 2));
        view.dispatch(view.state.tr.delete(start, from));
      }
      type InlineInsert = Parameters<typeof editor.insertInlineContent>[0];
      const inline: InlineInsert = [
        {
          type: "link",
          href: `synapse:${encodeURIComponent(title)}`,
          content: [{ type: "text", text: `[[${title}]]`, styles: {} }],
        },
        { type: "text", text: " ", styles: {} },
      ];
      editor.insertInlineContent(inline);
      setSuggest(null);
    },
    [editor, suggest]
  );

  const handleClickCapture = async (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest?.('a[href^="synapse:"]');
    if (!anchor) return;
    e.preventDefault();
    e.stopPropagation();
    const href = anchor.getAttribute("href") ?? "";
    if (!href.startsWith("synapse:")) return; // defense in depth
    let title = href.slice("synapse:".length);
    try {
      title = decodeURIComponent(title);
    } catch {
      /* keep the raw title */
    }
    const target = await resolveOrCreateNote(title);
    if (target) router.push(`/app/note/${target.id}`);
  };

  return (
    <div ref={wrapRef} className="bn-wrapper -mx-2" onClickCapture={handleClickCapture}>
      <BlockNoteView
        editor={editor}
        theme={resolvedTheme === "dark" ? synapseDark : synapseLight}
        onChange={() => onChange(transformWikiLinks(editor.document))}
      />
      {suggest && (
        <WikiLinkSuggest
          query={suggest.query}
          titles={noteTitles}
          rect={suggest.rect}
          onSelect={applySuggest}
          onClose={() => setSuggest(null)}
        />
      )}
    </div>
  );
}
