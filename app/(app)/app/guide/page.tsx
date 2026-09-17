"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  House,
  Keyboard,
  Link2,
  Network,
  Search,
  Sparkles,
  Tag,
  Type,
} from "lucide-react";

/**
 * User guide — how to actually use Synapse, step by step.
 * Linked from Home ("How to use Synapse") and the sidebar.
 */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card !p-6">
      <h2 className="flex items-center gap-2.5 text-base font-semibold">
        <span className="grid size-8 flex-none place-items-center rounded-lg border border-accent/25 bg-accent/12 text-accent-ink">
          {icon}
        </span>
        {title}
      </h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-mute">{children}</div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/app"
        className="inline-flex items-center gap-2 rounded-lg border border-line bg-overlay px-3 py-1.5 text-[13px] text-mute transition-colors duration-150 hover:border-line-strong hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Back home
      </Link>

      <h1 className="mt-6 text-3xl font-bold tracking-[-0.02em]">How to use Synapse</h1>
      <p className="mt-2 text-sm leading-relaxed text-mute">
        Synapse is your personal knowledge graph: write notes in your browser,
        connect them with{" "}
        <span className="font-mono text-[13px] text-wiki">[[wiki-links]]</span>, and
        watch your ideas form a map. Everything is stored locally — no account,
        no cloud. This guide walks you through it in five minutes.
      </p>

      <div className="mt-8 space-y-4">
        <Section icon={<Type className="size-4" />} title="1 · Write your first note">
          <p>
            Click <span className="font-medium text-ink">New note</span> in the
            sidebar (or press <Kbd>C</Kbd> anywhere in the app). Type a title,
            then write — paragraphs, headings, lists, to-dos, quotes and code
            blocks all work, and the slash menu (<Kbd>/</Kbd>) inserts any block.
          </p>
          <p>
            Your work saves automatically about a second after you stop typing —
            the <span className="text-teal">Saved</span> chip in the top bar
            confirms it. You never need to press save.
          </p>
        </Section>

        <Section icon={<Link2 className="size-4" />} title="2 · Link notes together">
          <p>
            While writing, type{" "}
            <span className="font-mono text-[13px] text-wiki">[[</span> and a
            suggestion list pops up with your note titles. Pick one (or keep
            typing a new title, close with{" "}
            <span className="font-mono text-[13px] text-wiki">]]</span>) — the
            link instantly turns{" "}
            <span className="font-mono text-[13px] text-wiki">[[blue]]</span>,
            which means it points to another note.
          </p>
          <p>
            Clicking a link jumps to that note. If it doesn&apos;t exist yet,
            Synapse creates it for you — that&apos;s how knowledge graphs grow:
            link first, fill in the note later.
          </p>
        </Section>

        <Section icon={<Network className="size-4" />} title="3 · See your backlinks & graph">
          <p>
            Open any note and click the{" "}
            <span className="font-medium text-ink">backlinks button</span> (the
            link icon with a number in the note&apos;s meta row) to see every
            note that references the one you&apos;re reading, with a snippet of
            the surrounding text.
          </p>
          <p>
            The <span className="font-medium text-ink">Graph</span> page in the
            sidebar renders your whole vault as a constellation: linked notes
            cluster together on the left, unlinked notes wait in a tidy grid on
            the right. Node size grows with backlinks; colors come from tags.
            Hover to isolate a cluster, click any node to open that note.
          </p>
        </Section>

        <Section icon={<Tag className="size-4" />} title="4 · Organize: tags & favorites">
          <p>
            In a note&apos;s meta row, click <span className="font-medium text-ink">Add tag</span>{" "}
            to label it — tags get stable colors and you can filter by them in
            search, the graph, and the command palette.
          </p>
          <p>
            Tap the star on any note card on Home to favorite it — favorites
            appear in the sidebar and on Home, so your daily notes are one click
            away.
          </p>
        </Section>

        <Section icon={<Search className="size-4" />} title="5 · Find anything instantly">
          <p>
            Press <Kbd>Cmd K</Kbd> (or <Kbd>Ctrl K</Kbd>) to open the command
            palette: fuzzy-search every note, jump anywhere, create notes from
            the query, switch theme, or go to Graph / Search / Home — all
            without touching the mouse.
          </p>
          <p>
            The <span className="font-medium text-ink">Search</span> page (sidebar
            or the quick bar on mobile) does full-text search across every
            note&apos;s title and content, with highlighted matches, tag filters,
            and suggestions for misspellings.
          </p>
        </Section>

        <Section icon={<CalendarDays className="size-4" />} title="Everyday extras">
          <p>
            <span className="font-medium text-ink">Daily notes</span> — the
            sidebar&apos;s Daily button opens (or creates) today&apos;s note,
            ready for journaling.
          </p>
          <p>
            <span className="font-medium text-ink">Version history</span> — the
            clock icon on a note opens local snapshots; restore any past version
            with two clicks. History is kept per note (up to 30 versions).
          </p>
          <p>
            <span className="font-medium text-ink">Export & import</span> — the
            Export menu in the top bar downloads any note (or your whole vault)
            as Markdown or JSON. The sidebar&apos;s{" "}
            <span className="font-medium text-ink">Import Markdown</span> brings
            existing <Kbd>.md</Kbd> files in as notes.
          </p>
          <p>
            <span className="font-medium text-ink">Themes & offline</span> — the
            moon icon switches dark / light / system. Synapse works fully
            offline and is installable as an app from your browser&apos;s
            address bar.
          </p>
        </Section>

        <Section icon={<Keyboard className="size-4" />} title="Keyboard shortcuts">
          <ul className="grid gap-2 sm:grid-cols-2">
            <li className="flex items-center justify-between gap-3">
              <span>Command palette</span>
              <span className="flex gap-1"><Kbd>Cmd</Kbd><Kbd>K</Kbd></span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>New note</span>
              <Kbd>C</Kbd>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Link to a note</span>
              <span className="font-mono text-[13px] text-wiki">[[</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Insert a block</span>
              <Kbd>/</Kbd>
            </li>
          </ul>
        </Section>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-accent/25 bg-accent/8 p-5">
        <p className="flex items-center gap-2 text-sm text-mute">
          <Sparkles className="size-4 text-accent-ink" />
          Start small: one note, one link. The graph does the rest.
        </p>
        <Link
          href="/app"
          className="flex items-center gap-2 rounded-[10px] bg-aurora px-4 py-2 text-sm font-medium text-white transition-transform duration-200 [transition-timing-function:cubic-bezier(.16,1,.3,1)] hover:-translate-y-0.5"
        >
          <House className="size-4" /> Back home
        </Link>
      </div>
    </div>
  );
}
