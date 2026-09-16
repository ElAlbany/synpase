"use client";

import * as React from "react";
import { Plus, Tag, X } from "lucide-react";
import type { Note } from "@/db/schema";
import { updateNote } from "@/db/notes";
import { tagColor } from "@/lib/tree";

const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 24;

/**
 * Tag pills with inline add/remove, for the editor meta row.
 *
 * Tags live on the note record but outside the autosaved title/content draft,
 * so edits persist directly via updateNote instead of the useAutoSave flow.
 */
export function TagEditor({ note }: { note: Note }) {
  const [adding, setAdding] = React.useState(false);
  const [value, setValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const persist = (tags: string[]) => updateNote(note.id, { tags });

  const addTag = () => {
    const tag = value.trim().toLowerCase().replace(/\s+/g, "-");
    setValue("");
    if (!tag || tag.length > MAX_TAG_LENGTH) return;
    if (note.tags.length >= MAX_TAGS || note.tags.includes(tag)) return;
    void persist([...note.tags, tag]).then(() => inputRef.current?.focus());
  };

  const removeTag = (tag: string) => {
    void persist(note.tags.filter((t) => t !== tag));
  };

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Tag className="size-3.5" />
      {note.tags.length === 0 && !adding && <span>No tags</span>}
      {note.tags.map((t) => (
        <span
          key={t}
          className="group flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-[10.5px] font-medium"
          style={{
            color: tagColor(t),
            backgroundColor: `${tagColor(t)}18`,
          }}
        >
          #{t}
          <button
            onClick={() => removeTag(t)}
            aria-label={`Remove tag ${t}`}
            className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            } else if (e.key === "Escape") {
              setValue("");
              setAdding(false);
            }
          }}
          onBlur={() => {
            if (!value.trim()) setAdding(false);
          }}
          placeholder={note.tags.length >= MAX_TAGS ? "Max 8 tags" : "Add tag…"}
          disabled={note.tags.length >= MAX_TAGS}
          aria-label="New tag name"
          className="w-24 rounded-md border border-line bg-overlay px-2 py-0.5 text-[10.5px] text-ink outline-none transition-colors duration-150 placeholder:text-faint/60 focus:border-accent/50"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          aria-label="Add tag"
          title="Add tag"
          className="flex items-center rounded-full border border-dashed border-line px-1.5 py-0.5 text-faint transition-colors duration-150 hover:border-line-strong hover:text-mute"
        >
          <Plus className="size-3" />
        </button>
      )}
    </span>
  );
}
