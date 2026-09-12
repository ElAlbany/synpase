"use client";

import * as React from "react";

const sidebarItems = [
  { label: "Reading list", depth: 0, active: false },
  { label: "Design principles", depth: 0, active: true },
  { label: "Color systems", depth: 1, active: false },
  { label: "Motion design", depth: 1, active: false },
  { label: "Thesis draft", depth: 0, active: false },
  { label: "Competitive analysis", depth: 0, active: false },
];

const backlinks = [
  { title: "Thesis draft", excerpt: "…as argued in the principles, hierarchy emerges from…" },
  { title: "Motion design", excerpt: "…easing curves must follow the same principles…" },
  { title: "Weekly notes", excerpt: "…revisited the core principles before shipping…" },
];

export function Showcase() {
  const tiltRef = React.useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${x * 7}deg) rotateX(${-y * 6}deg)`;
  };

  const onLeave = () => {
    if (tiltRef.current) tiltRef.current.style.transform = "";
  };

  return (
    <section
      className="px-6 pb-30 [perspective:1600px]"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div
        ref={tiltRef}
        className="relative mx-auto max-w-[1080px] transition-transform duration-200 [transform-style:preserve-3d] [transition-timing-function:cubic-bezier(.16,1,.3,1)]"
      >
        <div className="chip-float cf1">
          <span className="g" />
          [[Knowledge Graph]]
        </div>
        <div className="chip-float cf2">
          <span className="g" />
          100% offline — IndexedDB
        </div>
        <div className="chip-float cf3 hidden lg:flex">
          <span className="g" />
          <span className="kbd mr-0.5">Cmd</span> K — command palette
        </div>

        <div className="dark-window overflow-hidden rounded-2xl border border-line-strong bg-[rgba(15,16,22,0.82)] shadow-[0_40px_120px_rgba(0,0,0,.6),0_0_80px_rgba(110,107,255,.12)] backdrop-blur-xl">
          {/* window bar */}
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="size-[11px] rounded-full bg-[#FF5F57]" />
            <span className="size-[11px] rounded-full bg-[#FEBC2E]" />
            <span className="size-[11px] rounded-full bg-[#28C840]" />
            <span className="ml-3.5 max-w-[340px] flex-1 rounded-md border border-line bg-overlay py-1 text-center font-mono text-[11px] text-faint">
              synapse.app/note/design-principles
            </span>
          </div>

          <div className="grid min-h-[420px] grid-cols-[170px_1fr] md:grid-cols-[210px_1fr_250px]">
            {/* sidebar */}
            <div className="flex flex-col gap-1.5 border-r border-line px-3 py-4">
              <div className="px-2.5 pt-2 pb-1 text-[10px] tracking-[0.08em] text-faint uppercase">
                Favorites
              </div>
              {sidebarItems.slice(0, 1).map((it) => (
                <SideItem key={it.label} {...it} />
              ))}
              <div className="px-2.5 pt-2.5 pb-1 text-[10px] tracking-[0.08em] text-faint uppercase">
                Workspace
              </div>
              {sidebarItems.slice(1).map((it) => (
                <SideItem key={it.label} {...it} />
              ))}
            </div>

            {/* editor */}
            <div className="px-7 py-6.5 md:px-7.5">
              <div className="mb-1 text-[19px] font-semibold">Design principles</div>
              <div className="mb-4.5 text-[11px] text-faint">
                Edited 2m ago · 4 backlinks · #design #craft
              </div>
              <div className="mb-2 rounded-lg px-2.5 py-2 text-[15px] font-semibold">
                Good design is invisible
              </div>
              <div className="mb-2 rounded-lg px-2.5 py-2 text-[13px] leading-relaxed text-[#C9CBD2]">
                Every interface is a conversation. When the chrome disappears, the{" "}
                <span className="wl">[[Content is the hero]]</span> principle emerges
                naturally.
              </div>
              <div className="mb-2 flex items-center gap-2.25 rounded-lg px-2.5 py-2 text-[13px] text-mute">
                <span className="grid size-3.5 flex-none place-items-center rounded-[5px] bg-teal" />
                Audit contrast ratios across themes
              </div>
              <div className="flex items-center gap-2.25 rounded-lg px-2.5 py-2 text-[13px] text-mute">
                <span className="grid size-3.5 flex-none place-items-center rounded-[5px] border-[1.5px] border-line-strong" />
                Connect research from <span className="wl">[[Motion design]]</span>{" "}
                <span className="caret" />
              </div>
            </div>

            {/* backlinks */}
            <div className="hidden border-l border-line px-4 py-4 md:block">
              <h4 className="mb-3 text-[10px] tracking-[0.08em] text-faint uppercase">
                Backlinks · 4
              </h4>
              {backlinks.map((b) => (
                <div
                  key={b.title}
                  className="mb-2 rounded-lg border border-line bg-overlay px-2.75 py-2.25 transition-colors duration-200 hover:border-accent/40"
                >
                  <div className="text-xs font-medium">{b.title}</div>
                  <div className="mt-0.75 text-[11px] leading-snug text-faint">
                    {b.excerpt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SideItem({
  label,
  depth,
  active,
}: {
  label: string;
  depth: number;
  active: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.75 text-[12.5px] ${
        active ? "bg-accent/14 text-[#C7C5FF]" : "text-mute"
      }`}
      style={depth ? { paddingLeft: 26 } : undefined}
    >
      <span
        className={`size-3 flex-none rounded-[4px] ${active ? "bg-accent" : "bg-overlay"}`}
      />
      {label}
    </div>
  );
}
