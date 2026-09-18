# Synapse — Technical Guide

> Who this is for: you, the developer who built (or is learning) Synapse, and anyone
> joining the project. It explains **how every feature works, which library powers it,
> what you should learn first, and why we built it this way.**
>
> Read `README.md` for the product overview and `synapse-design-spec.md` for the visual
> language. This document is about the machinery underneath.

---

## 0 · Prerequisites — learn these before reading the code

| Topic | Why you need it | Where it's used |
|---|---|---|
| **React 19 + Next.js App Router** | The whole app is client components inside the App Router; routing drives note pages | `app/`, every page |
| **TypeScript strict** | All data shapes are typed; BlockNote content is deliberately `unknown` at rest | `types/`, `db/schema.ts` |
| **Zustand** | Tiny, no-boilerplate global stores | `stores/` |
| **Dexie.js** (IndexedDB wrapper) | The entire local-first database, + `useLiveQuery` for reactive reads | `db/` |
| **BlockNote** (ProseMirror-based editor) | The block editor; understand its **block/inline-content/style schema** model | `components/editor/` |
| **ProseMirror basics** (nodes, marks, transactions) | We dispatch raw PM transactions for live link conversion and the `[[` suggester | `components/editor/BlockEditor.tsx` |
| **@xyflow/react** (React Flow) | The knowledge-graph canvas | `components/graph/` |
| **MiniSearch** | Client-side full-text search | `lib/search.ts` |
| **Vitest + Testing Library + fake-indexeddb** | The test strategy | `tests/` |

Optional but helpful: Framer-motion concepts (we use CSS transitions instead), PWA
service-worker lifecycle, and how `next-themes` works.

---

## 1 · Architecture at a glance

```
┌─────────────────────────── Next.js App Router ───────────────────────────┐
│  / (landing, static)   /app (shell: Sidebar + Topbar + main)             │
│                          ├─ /app            Home (recent, favorites)     │
│                          ├─ /app/note/[id]  NoteEditor (the heart)       │
│                          ├─ /app/graph      KnowledgeGraph               │
│                          ├─ /app/search     SearchPage                   │
│                          ├─ /app/daily      → today's note               │
│                          └─ /app/guide      in-app user guide            │
└───────────────────────────────────────────────────────────────────────────┘
        │ reads/writes                │ state               │ actions
        ▼                           ▼                     ▼
   ┌─────────┐               ┌────────────┐        ┌────────────┐
   │  Dexie  │◄──────────────│ Zustand    │        │ palette /  │
   │ (IDB)   │  useLiveQuery │ stores     │        │ shortcuts  │
   └─────────┘               └────────────┘        └────────────┘
        ▲ pure logic lives in lib/ (wikilinks, search, graph-layout,
          export, import-markdown, tree, sanitize-blocks) — no React, no DB
```

**Why this way:** the project is a *local-first* app, so the browser **is** the server.
The architecture follows three rules:

1. **Pure logic is separated from React.** Everything testable without rendering lives
   in `lib/`. That's why the test suite can cover the hard parts (link extraction,
   layout math, export) with plain unit tests.
2. **The database is the source of truth; UI state is ephemeral.** Components read
   through `useLiveQuery`, so any write anywhere updates every view automatically —
   no manual cache invalidation.
3. **Plain text in storage, rich objects in memory.** Note content is stored as
   BlockNote JSON, but *links are resolved from plain-text `[[titles]]`* — no links
   table, no graph index to keep consistent (see §5).

---

## 2 · Data layer (`db/`)

**Library: Dexie.js** — a promise-based wrapper over IndexedDB with a React hook
(`dexie-react-hooks`).

### Schema (`db/schema.ts`, `db/index.ts`)

```ts
interface Note {
  id: string; title: string; content: unknown;   // BlockNote JSON (or legacy string)
  parentId: string | null; tags: string[];
  isFavorite: boolean; createdAt: number; updatedAt: number;
}
interface NoteSnapshot { id; noteId; title; content; createdAt }  // v2 = version history
```

Two Dexie versions are declared so existing databases upgrade cleanly through the
migration chain.

**Decisions & why:**
- **`content: unknown`** — BlockNote's document shape evolves; typing it `unknown` means
  zero schema migrations when BlockNote changes. Everything that touches content goes
  through defensive helpers (`blocksToText`, `sanitizeBlocks`) that never throw on
  malformed data.
- **No boolean indexes** — IndexedDB keys can't be booleans, so `isFavorite` is filtered
  in memory (fine at PKM scale).
- **No links table** — links are *derived* from note text at read time (see §5). One
  source of truth, nothing to keep in sync on edit/delete/rename.
- **Deletes re-parent children** onto the deleted note's parent — the tree never
  orphans a subtree (`db/notes.ts: deleteNote`).

### CRUD (`db/notes.ts`)

Standard helpers (`createNote`, `updateNote`, `findNoteByTitle`,
`resolveOrCreateNote`). Title lookup is a case-insensitive full-table scan — O(n) but
negligible under a few thousand notes; an index on a normalized title column is the
first optimization if a vault ever grows huge.

### Seed (`db/seed.ts`)

`seedWelcomePack()` inserts three interlinked guide notes, **idempotent by title**
(case-insensitive), guarded by a module-level promise (StrictMode double-run safe).
Available from the sidebar menu, the home empty state, and the command palette.

---

## 3 · State (`stores/`)

**Library: Zustand.**

- `useNotesStore` — `saveStatus` ("saving" / "saved") + note actions. The topbar chip
  reads this.
- `useUIStore` — persisted UI state (sidebar collapsed, mobile drawer, palette open).

**Why Zustand and not Context/Redux:** the app has two small pieces of shared state;
Zustand gives selectors and persistence middleware with ~zero boilerplate and no
provider re-render storms.

---

## 4 · Editor & the wiki-link engine (`components/editor/`, `lib/wikilinks.ts`)

**Library: BlockNote** (built on ProseMirror/Tiptap), themed via `lib/blocknote-theme.ts`.

This is the most important subsystem and the one with the most history — read this
section fully before touching linking code.

### 4.1 The storage format lesson (why `sanitize-blocks.ts` exists)

An early version stored wiki-links as a **text run with a pseudo-style**:
`{ styles: { link: "synapse:Title" } }`. This was wrong: in BlockNote 0.28 a link is
**inline content** (`{ type: "link", href, content: [...] }`), and at the ProseMirror
level it is a **mark** named `link` (schema marks: `link, bold, italic, underline,
strike, code, textColor, backgroundColor`). Feeding `styles.link` to BlockNote throws
`style link not found in styleSchema` — **every note containing a link crashed on
reopen.**

`lib/sanitize-blocks.ts` therefore normalizes every stored document before BlockNote
sees it: fills missing `props`/`styles`, strips unknown style keys, and **migrates
legacy `styles.link` runs into native link inline content**. Old notes self-heal on
open — no database migration needed.

> **Learn:** BlockNote's three-layer model — *blocks* (paragraph, heading…),
> *inline content* (text, link), *styles* (bold…). Links are NOT styles. The PM schema
> has no "link" **node**; it is a **mark** on text.

### 4.2 The full link lifecycle

1. **Typing** — `BlockEditor.refreshSuggest` listens to `keyup`/`click`/`selectionchange`
   on the editor wrapper. It reads the ProseMirror selection directly
   (`editor.prosemirrorView.state`), finds an unclosed `[[query` before the caret, and
   opens `WikiLinkSuggest` — a floating dropdown positioned at the caret via
   `view.coordsAtPos`.
2. **Autocomplete select** — `editor.insertInlineContent([{type:"link", href:"synapse:…",
   content:[…]}])` inserts the native link at the caret. Keyboard (↑↓ Enter Tab Esc) is
   captured at the document level so Enter never reaches the editor while open.
3. **Manual typing** — the moment you close `]]`, `refreshSuggest` detects the completed
   `[[title]]` in the text node before the caret and swaps it for a **link-marked text
   run** via a raw PM transaction (`tr.replaceWith`), appending a trailing space. Guarded
   by `!linkMark.isInSet(nodeBefore.marks)` so it never loops. This is why links turn
   blue *while typing*, not after save.
4. **On save** — `transformWikiLinks` (pure, in `lib/wikilinks.ts`) walks the document
   and upgrades any remaining plain-text `[[...]]` runs to link inline content. It also
   runs **at load time** in `parseInitial`, so notes written before the live-conversion
   feature appear as links immediately.
5. **On click** — a capture-phase click handler in `BlockEditor` intercepts
   `a[href^="synapse:"]`, decodes the title, and calls `resolveOrCreateNote`: navigate
   if a note with that title exists (case-insensitive), otherwise create it
   Obsidian-style and navigate. The href scheme is validated by prefix — external URLs
   are never auto-followed.

**Why keep the visible text as `[[Title]]` inside the link?** Because every consumer —
backlinks (`getBacklinks`), graph edges (`extractWikiLinks`), search, Markdown export —
extracts links by scanning plain text for `\[\[(.+?)\]\]`. One convention, zero
dedicated indexes.

**Why a capture-phase click handler instead of BlockNote's `onClick`?** BlockNote links
render with `target="_blank"`; we must preventDefault before the browser interprets the
unknown `synapse:` scheme, and one wrapper handler covers all links including ones
inserted later.

### 4.3 Autosave (`hooks/useAutoSave.ts`)

Debounces 800 ms after the last change, keyed on a **content signature** (immune to
`useLiveQuery` identity storms), flushes on unmount, and snapshots version history
(§8). The `Saving → Saved` chip in the topbar mirrors `useNotesStore.saveStatus`.

### 4.4 Backlinks (`components/editor/BacklinksPanel.tsx`)

Pure in-memory scan: flatten every note with `blocksToText`, case-insensitive search
for `[[title]]`, exclude self, sort by `updatedAt`. Shows a ±60-char context snippet
(`contextAround`). O(total text) per render — fine at this scale; a links table would
be the optimization if profiling ever demands it.

---

## 5 · Knowledge graph (`lib/graph-layout.ts`, `components/graph/KnowledgeGraph.tsx`)

**Library: @xyflow/react** (React Flow). Custom node = glowing dot + halo + mono label.

### Data

`buildGraphData(notes)` — one node per note (size ∝ backlink count, color = first tag),
edges from `[[links]]` resolved **case-insensitively by title**. Self-links, dangling
links, and duplicate pairs are dropped. All pure and deterministic → unit-tested.

### Layout — two organized zones

`layoutGraph` no longer throws everything into one force simulation:

1. **Connected clusters (left)** — union-find over edges finds components; each
   2+ node component runs its own Fruchterman–Reingold simulation (repulsion +
   springs + gravity, seeded PRNG, golden-angle start) and is centered in a grid slot.
   Related notes stay physically together.
2. **Singletons (right)** — unlinked notes get a tidy deterministic grid, so they read
   as "not yet connected" instead of visual noise.

Deterministic = identical inputs always produce identical layouts (seeded PRNG +
sorted ordering), which makes the layout memoizable on notes-array identity and
unit-testable. Everything is pure — no React, no DOM.

### Interaction model

- **Single click** selects: the node scales up with a color ring and its edges brighten.
  Nothing else on the canvas reacts (no hover-driven dimming of the whole graph).
- **Double click** opens the note.
- **Click empty canvas** (pane) deselects.
- Floating glass controls: text filter, tag chips (with counts, doubling as the color
  legend), reset view, and a zones hint.
- Untagged notes render as **hollow indigo rings** (the landing-page constellation
  look) so they're visible without a tag color.

**Why custom layout instead of React Flow's `dagre`/`elk`?** Those are hierarchical
(DAG) algorithms — wrong shape for a cyclic knowledge graph. FR force-directed is the
standard for this, and implementing it ourselves (~100 lines) keeps it deterministic,
dependency-free, and testable.

---

## 6 · Search (`lib/search.ts`, `app/(app)/app/search/page.tsx`, palette)

**Library: MiniSearch** — a client-side full-text index with prefix/fuzzy matching and
field boosting.

One index instance is built/rebuilt from notes (title boosted ×3 over content) and
powers **two UIs**: the full search page (highlighted snippets, multi-tag filters,
suggestions) and the ⌘K palette. Match highlighting is pure string-run splitting, so
it's safe by construction (no `dangerouslySetInnerHTML` anywhere in the app).

**Why MiniSearch over Fuse.js:** better ranking control (field weights, prefix vs
fuzzy), tiny bundle, and index-as-data (we can rebuild deterministically per notes
array identity).

---

## 7 · Command palette (`components/palette/CommandPalette.tsx`)

The signature interaction: ⌘/Ctrl+K opens a glass modal (capture-phase listener works
from anywhere in the app). Grouped results — **Jump to** (fuzzy notes, recents when
empty), **Create**, **Actions**, **Tags** — with a custom subsequence scorer
(`fuzzyScore`) and match highlighting. ARIA combobox/listbox/option roles throughout.

Actions include navigation, new note, theme toggle, **Import Markdown** (fires a
`synapse:import-markdown` window event that the Sidebar's hidden file input listens
for — keeps file picking in one place while the action is reachable everywhere,
including mobile), and **Add welcome & guide notes** (`seedWelcomePack()`).

The **backdrop closes on tap/click** (mobile-critical: before, only Esc worked).

**Why a custom scorer instead of fzf-for-js?** 40 lines, zero deps, tuned bonuses
(substring +24, prefix +16, word-start +8), and it returns match indices for free.

---

## 8 · Power features

### 8.1 Version history (`db/history.ts`, `HistoryPanel.tsx`)
Local snapshots on save (throttled by `maybeSnapshot`, 60 s min gap), capped at 30 per
note, deduped by JSON-identical title+content. Restore snapshots the current state
first, so a restore is itself undoable.

### 8.2 Export (`lib/export.ts`)
Pure Markdown/JSON renderers — never throw, handle legacy string content, and
normalize `synapse:` hrefs back to `[[wiki-links]]`. `downloadFile` is an SSR no-op.

### 8.3 Import (`lib/import-markdown.ts`)
A defensive line-based Markdown→BlockNote parser (no eval, 2 MB cap, NUL/CRLF hygiene).
`[text](url)` becomes **native link inline content** — but only for safe schemes
(`https?:`, `mailto:`, `#`, `/`); anything else (e.g. `javascript:`) degrades to plain
text. Imported files are treated as hostile input.

### 8.4 Daily notes (`lib/daily.ts`)
`/app/daily` resolves to (or creates) the note titled with today's date, with starter
content.

### 8.5 Templates (`lib/templates.ts`)
Six templates producing valid BlockNote partial blocks, applied from the sidebar menu.

### 8.6 Tags (`lib/tree.ts: tagColor`)
An 8-color palette hashed from the tag name — deterministic, stable across sessions,
no per-tag storage. 24-char / 8-tag limits enforced in `TagEditor`.

### 8.7 PWA (`public/sw.js`, `app/manifest.ts`, `components/pwa/`)
Hand-written service worker: precache shell, network-first navigations, cache-first
static assets. Registers **only in production** (`ServiceWorkerRegister.tsx`).

### 8.8 Themes (`next-themes`)
`attribute="class"`, dark default; tokens live in `app/globals.css` as CSS variables
mapped into Tailwind v4 via `@theme inline` — one source of truth for both Tailwind
utilities and raw CSS.

---

## 9 · Testing strategy (`tests/`)

- **Unit** (`tests/unit/`) — pure logic, no rendering: wikilinks, sanitize migration,
  BlockNote round-trip regression (loads transformed docs headlessly), graph data +
  layout (determinism, clustering, zones), search, export, import, history, templates,
  tree.
- **Integration** (`tests/integration/`) — real Dexie on **fake-indexeddb** + Testing
  Library: CRUD, tag editor, command palette (open/filter/create/keyboard), backlinks
  panel, wiki-link navigation (`resolveOrCreateNote`), suggestion dropdown, welcome
  pack idempotency, guide page.
- `tests/setup.ts` clears the DB between tests (order-independent suites) and stubs
  the jsdom APIs BlockNote/Dexie touch.

**The most valuable test in the repo** is `tests/unit/blocknote-roundtrip.test.ts`:
it loads transformed documents into a real headless BlockNote editor and fails loudly
if the storage format ever becomes invalid again. Run `npm test` before every commit.

---

## 10 · Security notes

- No `dangerouslySetInnerHTML`; all user text renders as React text nodes.
- `synapse:` hrefs are validated by prefix before navigation; markdown import rejects
  unsafe URL schemes.
- Import is size-capped (2 MB) and NUL-stripped.
- Everything is client-side; there is no server, no auth surface, no secrets.

---

## 11 · Where to go next (Future Extensibility)

The seams are already cut for the documented future work:

- **Cloud sync** — add a `syncedAt` field + a push/pull layer over Dexie; the pure
  `lib/` logic and `unknown` content type mean no format changes.
- **Auth** — would gate sync only; the app shell never needs to know.
- **Collaboration** — BlockNote supports Yjs providers; the editor is already isolated
  in one component.
- **AI features** — `blocksToText` is exactly the chunker an auto-linker/summarizer
  needs; `resolveOrCreateNote` is the write path.
