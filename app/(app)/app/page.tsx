"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { format, formatDistanceToNow } from "date-fns";
import {
  Clock,
  FileText,
  Network,
  Plus,
  Sparkles,
  Star,
  Tag,
} from "lucide-react";
import { db } from "@/db";
import { noteExcerpt } from "@/db/notes";
import { seedWelcomePack } from "@/db/seed";
import { tagColor } from "@/lib/tree";
import { useNotesStore } from "@/stores/useNotesStore";

export default function HomePage() {
  const router = useRouter();
  const notes = useLiveQuery(() => db.notes.toArray(), []);
  const { createNote, toggleFavorite } = useNotesStore();
  const [seeding, setSeeding] = React.useState(false);

  // Seed the welcome pack on first-ever visit (guarded, StrictMode-safe).
  React.useEffect(() => {
    if (notes && notes.length === 0) {
      setSeeding(true);
      seedWelcomePack().finally(() => setSeeding(false));
    }
  }, [notes]);

  if (!notes) {
    return (
      <div className="grid h-full place-items-center text-sm text-faint">
        Loading your workspace…
      </div>
    );
  }

  const recent = [...notes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);
  const favorites = notes.filter((n) => n.isFavorite);
  const allTags = [...new Set(notes.flatMap((n) => n.tags))];

  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "Working late"
      : hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";

  const handleNew = async () => {
    const note = await createNote();
    router.push(`/app/note/${note.id}`);
  };

  const handleSeed = async () => {
    setSeeding(true);
    await seedWelcomePack();
    setSeeding(false);
  };

  if (notes.length === 0 && !seeding) {
    return <EmptyState onSeed={handleSeed} onNew={handleNew} />;
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      {/* greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.02em]">{greeting}.</h1>
          <p className="mt-1.5 text-sm text-faint">
            {format(new Date(), "EEEE, MMMM d")} · {notes.length} note
            {notes.length === 1 ? "" : "s"}
            {allTags.length > 0 && ` · ${allTags.length} tags`}
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 rounded-[10px] border border-accent/25 bg-accent/12 px-4 py-2 text-sm font-medium text-accent transition-all duration-150 hover:border-accent/40 hover:bg-accent/20"
        >
          <Plus className="size-4" /> New note
        </button>
      </div>

      {/* new here? → guide */}
      <Link
        href="/app/guide"
        className="card group mt-10 flex flex-col items-stretch gap-4 !p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 sm:flex-row sm:items-center"
      >
        <span className="grid size-11 flex-none place-items-center rounded-xl border border-accent/25 bg-accent/12">
          <Sparkles className="size-5 stroke-[#B9B7FF]" />
        </span>
        <span className="w-full min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">New to Synapse?</span>
          <span className="mt-0.5 block text-[13px] leading-relaxed text-mute">
            Learn how to write notes, link them with{" "}
            <span className="font-mono text-[12px] text-wiki">[[wiki-links]]</span>, and
            explore your graph — in five minutes.
          </span>
        </span>
        <span className="flex w-full flex-none items-center justify-center gap-1.5 rounded-[10px] bg-aurora px-4 py-2 text-sm font-medium text-white transition-transform duration-200 [transition-timing-function:cubic-bezier(.16,1,.3,1)] group-hover:-translate-y-0.5 sm:w-auto">
          How to use Synapse
          <Network className="size-4" />
        </span>
      </Link>

      {/* recent */}
      <SectionTitle icon={<Clock className="size-4" />} title="Jump back in" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recent.map((note) => (
          <NoteCard
            key={note.id}
            id={note.id}
            title={note.title}
            excerpt={noteExcerpt(note)}
            updatedAt={note.updatedAt}
            tags={note.tags}
            isFavorite={note.isFavorite}
            onToggleFavorite={() => toggleFavorite(note.id)}
          />
        ))}
      </div>

      {/* favorites */}
      {favorites.length > 0 && (
        <>
          <SectionTitle icon={<Star className="size-4" />} title="Favorites" />
          <div className="flex flex-col gap-1">
            {favorites.map((n) => (
              <Link
                key={n.id}
                href={`/app/note/${n.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-mute transition-colors duration-150 hover:bg-overlay hover:text-ink"
              >
                <Star className="size-3.5 flex-none fill-amber-400 text-amber-400" />
                <span className="min-w-0 flex-1 truncate font-medium text-ink">
                  {n.title || "Untitled"}
                </span>
                <span className="flex-none text-xs text-faint">
                  {formatDistanceToNow(n.updatedAt, { addSuffix: true })}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* tag cloud */}
      {allTags.length > 0 && (
        <>
          <SectionTitle icon={<Tag className="size-4" />} title="Tags" />
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border px-3 py-1 text-xs font-medium"
                style={{
                  color: tagColor(tag),
                  borderColor: `${tagColor(tag)}44`,
                  backgroundColor: `${tagColor(tag)}14`,
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <h2 className="mt-12 mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-faint uppercase">
      {icon}
      {title}
    </h2>
  );
}

function NoteCard({
  id,
  title,
  excerpt,
  updatedAt,
  tags,
  isFavorite,
  onToggleFavorite,
}: {
  id: string;
  title: string;
  excerpt: string;
  updatedAt: number;
  tags: string[];
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="group card !p-5">
      <Link href={`/app/note/${id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-[15px] font-semibold">
            {title || "Untitled"}
          </span>
          <button
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite();
            }}
            aria-label="Toggle favorite"
            className="flex-none text-faint transition-colors duration-150 hover:text-amber-400"
          >
            <Star
              className="size-4"
              fill={isFavorite ? "#fbbf24" : "none"}
              stroke={isFavorite ? "#fbbf24" : "currentColor"}
            />
          </button>
        </div>
        <p className="mt-2 line-clamp-3 min-h-[3.75em] text-[13px] leading-relaxed text-mute">
          {excerpt || "No content yet — start writing."}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="flex flex-wrap gap-1.5">
            {tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                style={{
                  color: tagColor(t),
                  backgroundColor: `${tagColor(t)}18`,
                }}
              >
                #{t}
              </span>
            ))}
          </span>
          <span className="flex-none text-[11px] text-faint">
            {formatDistanceToNow(updatedAt, { addSuffix: true })}
          </span>
        </div>
      </Link>
    </div>
  );
}

function EmptyState({
  onSeed,
  onNew,
}: {
  onSeed: () => void;
  onNew: () => void;
}) {
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-raised p-10 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-accent/25 bg-accent/12">
          <Sparkles className="size-6 stroke-[#B9B7FF]" />
        </div>
        <h2 className="mt-5 text-xl font-semibold">A blank canvas</h2>
        <p className="mt-2 text-sm leading-relaxed text-mute">
          Your knowledge base is empty. Start from scratch, or explore with a
          few sample notes that show off links, tags and the tree.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={onSeed}
            className="rounded-[10px] bg-aurora px-4 py-2.5 text-sm font-medium text-white transition-transform duration-200 [transition-timing-function:cubic-bezier(.16,1,.3,1)] hover:-translate-y-0.5"
          >
            Explore sample notes
          </button>
          <button
            onClick={onNew}
            className="flex items-center justify-center gap-2 rounded-[10px] border border-line bg-overlay px-4 py-2.5 text-sm font-medium transition-colors duration-150 hover:border-line-strong"
          >
            Create your first note
            <kbd className="kbd">C</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
