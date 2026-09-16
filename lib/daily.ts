import { format } from "date-fns";
import { createNote, findNoteByTitle } from "@/db/notes";
import type { Note } from "@/db/schema";

/** Canonical daily-note title, e.g. "Jun 21, 2025". */
export function getDailyNoteTitle(date: Date = new Date()): string {
  return format(date, "MMM d, yyyy");
}

/** A couple of starter blocks (BlockNote shape) so the page isn't blank. */
function dailyStarterContent(title: string): unknown[] {
  return [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: `Daily note for ${title}. Capture what happened, what you learned, what's next.`,
        },
      ],
    },
    { type: "paragraph", content: [{ type: "text", text: "## Log" }] },
    { type: "paragraph", content: [{ type: "text", text: "- " }] },
  ];
}

/** Returns today's note, creating it on first visit for the day. */
export async function getOrCreateDailyNote(date: Date = new Date()): Promise<Note> {
  const title = getDailyNoteTitle(date);
  const existing = await findNoteByTitle(title);
  if (existing) return existing;
  return createNote({ title, content: dailyStarterContent(title) });
}
