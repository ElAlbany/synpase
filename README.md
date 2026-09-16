# Synapse

Your personal knowledge graph. Write, connect, and explore ideas — fully offline.

> Design language: **"Graphite Aurora"** — dark-first, calm on the surface, alive underneath.
> Full spec: `synapse-design-spec.md`.

## Features

- **Block editor** (BlockNote, Synapse-themed) with autosave — writes live in
  IndexedDB, works fully offline
- **[[Wiki-links]] + backlinks** — plain-text links upgraded to clickable marks
  on save; backlinks panel with context snippets; links auto-create notes
- **Knowledge graph** — force-directed canvas (@xyflow/react), node size by
  backlink count, color by tag
- **Full-text search** (MiniSearch) with title boosting, prefix/fuzzy match,
  tag filters and match highlighting
- **Command palette** — `Cmd/Ctrl+K` fuzzy jump/create/actions
- **Tags** with a stable hashed color palette, plus **daily notes** and
  **Markdown/JSON export**
- **Themes** — dark / light / system via next-themes

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** — tokens in `app/globals.css` (`@theme inline`)
- **next-themes** — dark / light / system (dark is default)
- Geist + Geist Mono via `next/font`

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000

> Note: `next/font/google` downloads fonts at build time — first `dev`/`build`
> needs a network connection.

## Testing

```bash
npm test               # one-shot run (vitest run)
npm run test:watch     # watch mode
npm run test:coverage  # coverage report (v8)
```

- **Unit tests** (`tests/unit/`) — pure logic, no rendering: wiki-link
  extraction/transformation, backlinks, tree building + tag colors, MiniSearch
  indexing/highlighting/excerpts, deterministic graph layout, Markdown/JSON
  export, daily-note titles.
- **Integration tests** (`tests/integration/`) — Dexie runs on
  `fake-indexeddb` (in-memory IndexedDB) and components are rendered with
  Testing Library: notes CRUD helpers, the ⌘K command palette (filter,
  navigate, create, keyboard), and the tag editor (add/remove/limits).
- The database is cleared between tests (`db.notes` + `db.settings`), so
  suites are order-independent.

## Roadmap (phases)

- [x] **Phase 0 — Foundation & landing**: tokens, theme system, aurora background, landing page
- [x] **Phase 1 — Data layer**: Dexie schema + CRUD, Zustand stores, collapsible sidebar with live tree, auto-save, home & note views
- [x] **Phase 2 — Editor**: BlockNote (Synapse-themed), clickable [[wiki-links]] with auto-create, live backlinks panel
- [x] **Phase 3 — Graph & search**: React Flow graph, MiniSearch, command palette
- [x] **Phase 4 — Power features**: daily notes, export, tags
- [x] **Phase 5 — Quality**: test harness (Vitest + Testing Library + fake-indexeddb), unit & integration coverage

## Structure

```
app/
  (marketing)/  landing page at /
  (app)/app/    the app: home, note/[id], graph, search
  layout.tsx    root layout (fonts, theme, aurora, grain)
  globals.css   design tokens (Tailwind v4 @theme)
components/
  ui/           button (cva variants)
  landing/      nav, hero, showcase, marquee, bento, graph-section, footer
  sidebar/      Sidebar (collapsible shell) + NoteTree (recursive, live)
  topbar/       breadcrumb + save-status chip
  palette/      ⌘K command palette (fuzzy jump / create / actions / tags)
  graph/        knowledge-graph canvas (@xyflow/react)
  editor/       NoteEditor (BlockNote), TagEditor, backlinks panel
  theme-*.tsx   next-themes provider + toggle
  aurora.tsx / grain.tsx   living background + film grain
db/             Dexie instance, schema, CRUD helpers, settings
hooks/          useDebounce, useAutoSave, useKeyboardShortcuts
lib/            wiki-links, search (MiniSearch), graph layout, export, tree, daily
stores/         useNotesStore (save status + actions), useUIStore (persisted)
types/          shared model types
```

## Design tokens (quick reference)

| Utility | Token |
|---|---|
| `bg-base` / `bg-raised` | app background / cards & sidebar |
| `text-ink` / `text-mute` / `text-faint` | primary / secondary / tertiary text |
| `border-line` / `border-line-strong` | subtle / hover borders |
| `bg-accent` `text-accent` | indigo accent (#6E6BFF dark) |
| `bg-aurora` `text-aurora` | signature gradient |
| `glass` | blur(16px) glass surface |
| `font-mono` | Geist Mono (wiki links, kbd) |

## Notes & conventions

- `Note.content` is a plain string in Phase 1; Phase 2 swaps in BlockNote JSON
  (typed `unknown`, never indexed — zero schema migration needed).
- Booleans are not valid IndexedDB keys: `isFavorite` is filtered in memory.
- Deletes re-parent children instead of orphaning subtrees.
- Auto-save debounces 800ms after the last keystroke (content-signature based,
  immune to live-query identity storms), flushes pending edits on unmount so
  navigating away never loses typed work, and drives the topbar Saving → Saved chip.
- `[[wiki-links]]` are plain text in storage; on save they're upgraded to
  BlockNote link marks (`synapse:<title>` hrefs). Clicking one navigates, or
  creates the note Obsidian-style if it doesn't exist yet. Backlinks are
  computed by scanning note text — no links table needed at this scale.

All motion uses `--ease-out-expo` (`cubic-bezier(.16,1,.3,1)`) with 120–400ms durations,
and everything decorative is disabled under `prefers-reduced-motion`.
