"use client";

import * as React from "react";
import { Type, Link2, Search, CalendarDays, Download } from "lucide-react";

/* Deterministic pseudo-random (stable across renders, no hydration mismatch) */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Heatmap() {
  const cells = React.useMemo(() => {
    const rand = mulberry32(42);
    return Array.from({ length: 4 * 14 }, () => rand());
  }, []);

  return (
    <div className="heat">
      {Array.from({ length: 4 }, (_, r) => (
        <div key={r} className="r">
          {cells.slice(r * 14, r * 14 + 14).map((v, i) => (
            <div
              key={i}
              className={`c ${v > 0.85 ? "l3" : v > 0.6 ? "l2" : v > 0.35 ? "l1" : ""}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div ref={ref} className={`card ${className}`} onMouseMove={onMove}>
      {children}
    </div>
  );
}

const iconClass =
  "grid size-9.5 place-items-center rounded-[10px] border border-accent/25 bg-accent/12";

export function Bento() {
  return (
    <section id="features" className="mx-auto max-w-[1120px] px-6 py-[110px]">
      <div className="mb-3.5 font-mono text-xs tracking-[0.1em] text-accent uppercase">
        {"// capabilities"}
      </div>
      <h2 className="text-[clamp(28px,4vw,44px)] leading-[1.15] font-bold tracking-[-0.02em]">
        Everything a second brain needs.
        <br />
        <span className="text-aurora">Nothing it doesn&apos;t.</span>
      </h2>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <div className={iconClass}>
            <Type className="size-4.5 stroke-accent-ink" />
          </div>
          <h3 className="mb-2 mt-4 text-base font-semibold">
            A block editor that thinks in ideas
          </h3>
          <p className="text-[13.5px] leading-relaxed text-mute">
            Notion-grade editing with slash commands, drag-and-drop nesting, and
            markdown shortcuts — restyled to feel like a native part of Synapse.
          </p>
          <div className="mini">
            /heading&nbsp;&nbsp;<span className="hl">/todo</span>&nbsp;&nbsp;/quote&nbsp;&nbsp;/code
            <br />
            Type <span className="hl">[[</span> to link any note, instantly.
          </div>
        </Card>

        <Card>
          <div className={iconClass}>
            <Link2 className="size-4.5 stroke-accent-ink" />
          </div>
          <h3 className="mb-2 mt-4 text-base font-semibold">Links that link back</h3>
          <p className="text-[13.5px] leading-relaxed text-mute">
            Every <span className="font-medium text-ink">[[wiki-link]]</span> builds a
            two-way street. A backlinks panel shows who references any note.
          </p>
        </Card>

        <Card>
          <div className={iconClass}>
            <Search className="size-4.5 stroke-accent-ink" />
          </div>
          <h3 className="mb-2 mt-4 text-base font-semibold">Search that keeps up</h3>
          <p className="text-[13.5px] leading-relaxed text-mute">
            MiniSearch-powered full-text search across titles and content, with
            highlighted matches — all client-side, all instant.
          </p>
        </Card>

        <Card>
          <div className={iconClass}>
            <CalendarDays className="size-4.5 stroke-accent-ink" />
          </div>
          <h3 className="mb-2 mt-4 text-base font-semibold">Daily notes &amp; streaks</h3>
          <p className="text-[13.5px] leading-relaxed text-mute">
            A fresh page every day. Your activity heatmap makes consistency visible —
            and addictive.
          </p>
          <Heatmap />
        </Card>

        <Card>
          <div className={iconClass}>
            <Download className="size-4.5 stroke-accent-ink" />
          </div>
          <h3 className="mb-2 mt-4 text-base font-semibold">Yours, even offline</h3>
          <p className="text-[13.5px] leading-relaxed text-mute">
            Everything lives in IndexedDB on your device. Export your whole vault as
            Markdown or JSON anytime. No lock-in, ever.
          </p>
        </Card>
      </div>
    </section>
  );
}
