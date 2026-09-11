# Synapse

Your personal knowledge graph. Write, connect, and explore ideas — fully offline.

> Design language: **"Graphite Aurora"** — dark-first, calm on the surface, alive underneath.
> Full spec lives in `DESIGN.md` (see `/mnt/agents/output/synapse-design-spec.md`).

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

## Roadmap (phases)

- [x] **Phase 0 — Foundation & landing**: tokens, theme system, aurora background, landing page
- [x] **Phase 1 — Data layer**: Dexie schema + CRUD, Zustand stores, collapsible sidebar with live tree, auto-save, home & note views
- [ ] **Phase 2 — Editor**: BlockNote integration, wiki-links, backlinks
- [ ] **Phase 3 — Graph & search**: React Flow graph, MiniSearch, command palette
- [ ] **Phase 4 — Power features**: daily notes, export, tags
- [ ] **Phase 5 — Portfolio ready**: seed data, README, performance audit, deploy

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
  editor/       NoteEditor (temporary plain editor; BlockNote in Phase 2)
  theme-*.tsx   next-themes provider + toggle
  aurora.tsx / grain.tsx   living background + film grain
db/             Dexie instance, schema, CRUD helpers, seed
stores/         useNotesStore (save status + actions), useUIStore (persisted)
hooks/          useDebounce, useAutoSave
lib/            tree builder, tag palette, cn()
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
- Auto-save debounces 800ms after the last keystroke; the topbar chip shows
  Saving → Saved. Known refinement: opening a note triggers one redundant
  no-op write (same content, bumps `updatedAt`) — cosmetic, fixed in Phase 2.

All motion uses `--ease-out-expo` (`cubic-bezier(.16,1,.3,1)`) with 120–400ms durations,
and everything decorative is disabled under `prefers-reduced-motion`.
