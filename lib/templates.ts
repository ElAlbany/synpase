/**
 * Built-in note templates (stretch goal).
 *
 * Pure data + pure builders — no Dexie, no React, fully unit-testable.
 * Every block is a valid BlockNote partial block: `props` is always present
 * and every inline text run carries a `styles` object (BlockNote 0.28
 * crashes on runs without one — see BlockEditor.sanitizeBlocks).
 *
 * Icons are lucide icon NAMES (strings); the Sidebar maps them to components
 * so this module stays framework-free.
 */

export interface TemplateResult {
  title: string;
  content: unknown[];
}

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  /** Lucide icon name (e.g. "Users"). Resolved to a component by the UI. */
  icon: string;
  build(): TemplateResult;
}

/* ------------------------------------------------------------------ */
/* Block builders                                                      */
/* ------------------------------------------------------------------ */

interface Run {
  type: "text";
  text: string;
  styles: Record<string, unknown>;
}

interface Block {
  type: string;
  props: Record<string, unknown>;
  content: Run[];
  children: Block[];
}

function run(text: string, styles: Record<string, unknown> = {}): Run {
  return { type: "text", text, styles };
}

function block(
  type: string,
  text = "",
  props: Record<string, unknown> = {},
  children: Block[] = []
): Block {
  return { type, props, content: text ? [run(text)] : [], children };
}

function heading(level: 1 | 2 | 3, text: string): Block {
  return block("heading", text, { level });
}

function paragraph(text = ""): Block {
  return block("paragraph", text);
}

function bullet(text = ""): Block {
  return block("bulletListItem", text);
}

function check(text = "", checked = false): Block {
  return block("checkListItem", text, { checked });
}

function quote(text = ""): Block {
  return block("quote", text);
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export const DEFAULT_TEMPLATE_ID = "blank";

export const TEMPLATES: NoteTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "An empty note",
    icon: "File",
    build: () => ({ title: "Untitled", content: [] }),
  },
  {
    id: "meeting",
    name: "Meeting notes",
    description: "Agenda and action items",
    icon: "Users",
    build: () => ({
      title: "Meeting notes",
      content: [
        heading(2, "Agenda"),
        bullet(),
        bullet(),
        heading(2, "Action items"),
        check(),
        check(),
      ],
    }),
  },
  {
    id: "daily-journal",
    name: "Daily journal",
    description: "Mood, gratitude, and the day",
    icon: "NotebookPen",
    build: () => ({
      title: "Daily journal",
      content: [
        paragraph("Mood: "),
        paragraph("Grateful for:"),
        bullet(),
        bullet(),
        bullet(),
        heading(2, "What happened"),
        paragraph(),
      ],
    }),
  },
  {
    id: "project-brief",
    name: "Project brief",
    description: "Goals, scope, and timeline",
    icon: "Target",
    build: () => ({
      title: "Project brief",
      content: [
        heading(1, "Project title"),
        paragraph("One-sentence summary of the project."),
        heading(2, "Goals"),
        bullet("What does success look like?"),
        heading(2, "Scope"),
        bullet("In scope: "),
        bullet("Out of scope: "),
        heading(2, "Timeline"),
        bullet("Key milestones and dates"),
      ],
    }),
  },
  {
    id: "reading-notes",
    name: "Reading notes",
    description: "Summary, ideas, and quotes",
    icon: "BookOpen",
    build: () => ({
      title: "Reading notes",
      content: [
        heading(2, "Summary"),
        paragraph(),
        heading(2, "Key ideas"),
        bullet(),
        bullet(),
        heading(2, "Quotes"),
        quote(),
        heading(2, "My thoughts"),
        paragraph(),
      ],
    }),
  },
  {
    id: "weekly-review",
    name: "Weekly review",
    description: "Wins, challenges, next week",
    icon: "CalendarCheck",
    build: () => ({
      title: "Weekly review",
      content: [
        heading(2, "Wins"),
        bullet(),
        heading(2, "Challenges"),
        bullet(),
        heading(2, "Next week"),
        check(),
        check(),
        check(),
      ],
    }),
  },
];

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

/** Look up a template by id; undefined when unknown. */
export function getTemplate(templateId: string): NoteTemplate | undefined {
  return BY_ID.get(templateId);
}

/**
 * Build a note's title + content from a template id. Unknown or empty ids
 * fall back to the blank template — this helper never throws.
 */
export function applyTemplate(templateId: string): TemplateResult {
  const template = BY_ID.get(templateId) ?? BY_ID.get(DEFAULT_TEMPLATE_ID);
  return template ? template.build() : { title: "Untitled", content: [] };
}
