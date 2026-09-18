# Synapse

Your personal knowledge graph. Write, connect, and explore ideas — fully offline.

> Design language: **"Graphite Aurora"** — dark-first, calm on the surface, alive underneath.
> Full spec: `synapse-design-spec.md` · Deep technical guide: `SYNAPSE-TECH-GUIDE.md`

## Features

- **Block editor** (BlockNote, Synapse-themed) with autosave — writes live in
  IndexedDB, works fully offline
- **[[Wiki-links]] + backlinks** — type `[[` for autocomplete; links turn into
  clickable blue pills instantly (and on load for older notes); backlinks panel
  with context snippets; links auto-create notes Obsidian-style
- **Knowledge graph** — force-directed canvas (@xyflow/react): linked clusters
  grouped on the left, unlinked notes in a tidy grid on the right; node size by
  backlink count, color by tag, hollow rings for untagged notes; click to select,
  double-click to open, click empty space to deselect
- **Full-text search** (MiniSearch) with title boosting, prefix/fuzzy match,
  tag filters and match highlighting
- **Command palette** — `Cmd/Ctrl+K` fuzzy jump/create/actions — including
  Import Markdown and Add welcome notes, reachable on mobile too
- **Tags** with a stable hashed color palette, plus **daily notes** and
  **Markdown/JSON export**
- **Version history** — local snapshots per note (up to 30), two-click restore
- **Markdown import** — defensive parser with unsafe-scheme rejection
- **Note templates** — meeting, journal, project brief, reading, weekly review
- **User guide** — built-in how-to at `/app/guide` (also linked from Home)
- **PWA** — installable, service worker, works offline
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
  extraction/transformation, sanitize migration, BlockNote round-trip regression,
  backlinks, graph data + deterministic two-zone layout, MiniSearch
  indexing/highlighting/excerpts, Markdown/JSON export & import, version
  history, templates, tree building + tag colors, daily-note titles.
- **Integration tests** (`tests/integration/`) — Dexie runs on
  `fake-indexeddb` (in-memory IndexedDB) and components are rendered with
  Testing Library: notes CRUD, the ⌘K command palette (filter, navigate,
  create, keyboard), tag editor, backlinks panel, wiki-link navigation,
  suggestion dropdown, welcome pack, guide page.
- The database is cleared between tests (`db.notes` + `db.settings`), so
  suites are order-independent.

## Roadmap (phases)

- [x] **Phase 0 — Foundation & landing**: tokens, theme system, aurora background, landing page
- [x] **Phase 1 — Data layer**: Dexie schema + CRUD, Zustand stores, collapsible sidebar with live tree, auto-save, home & note views
- [x] **Phase 2 — Editor**: BlockNote (Synapse-themed), clickable [[wiki-links]] with auto-create, live backlinks panel
- [x] **Phase 3 — Graph & search**: React Flow graph, MiniSearch, command palette
- [x] **Phase 4 — Power features**: daily notes, export, tags
- [x] **Phase 5 — Quality**: test harness (Vitest + Testing Library + fake-indexeddb), unit & integration coverage
- [x] **Phase 6 — Linking & graph repair**: native link storage (crash fix + self-healing migration), `[[` autocomplete, visible graph edges, idempotent welcome pack
- [x] **Phase 7 — UX polish**: live link conversion + link colors, two-zone graph layout, select/double-click graph interactions, guide page, topbar home button, identity copy, responsive fixes

## Docs

- `synapse-design-spec.md` — the visual language (tokens, motion, screens)
- `SYNAPSE-TECH-GUIDE.md` — how every feature works: libraries, architecture, design decisions, and what to learn before reading the code

## Structure

```
app/
  page.tsx      landing page at /
  (app)/app/    the app: home, note/[id], graph, search, daily, guide
  layout.tsx    root layout (fonts, theme, aurora, grain, PWA register)
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

- `Note.content` is BlockNote JSON (typed `unknown`, never indexed — zero schema
  migrations when BlockNote evolves). Legacy Phase-1 plain strings are still
  accepted everywhere via defensive helpers.
- Booleans are not valid IndexedDB keys: `isFavorite` is filtered in memory.
- Deletes re-parent children instead of orphaning subtrees.
- Auto-save debounces 800ms after the last keystroke (content-signature based,
  immune to live-query identity storms), flushes pending edits on unmount so
  navigating away never loses typed work, and drives the topbar Saving → Saved chip.
- `[[wiki-links]]` are stored as BlockNote **native link inline content**
  (`synapse:<title>` hrefs, visible text kept as `[[Title]]`). Plain-text links are
  upgraded live while typing, at load, and on save; legacy pseudo-style links
  self-heal through `lib/sanitize-blocks.ts`. Clicking a link navigates, or creates
  the note Obsidian-style if it doesn't exist yet. Backlinks and graph edges are
  computed by scanning note text — no links table needed at this scale.

All motion uses `--ease-out-expo` (`cubic-bezier(.16,1,.3,1)`) with 120–400ms durations,
and everything decorative is disabled under `prefers-reduced-motion`.
