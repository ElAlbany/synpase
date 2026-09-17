import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

function Words({
  words,
  offset,
  gradient = false,
}: {
  words: string[];
  offset: number;
  gradient?: boolean;
}) {
  return (
    <>
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          className={`word ${gradient ? "text-aurora" : ""}`}
          style={{ animationDelay: `${0.15 + (offset + i) * 0.07}s` }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

export function Hero() {
  return (
    <header className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-36 pb-20 text-center">
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-line bg-overlay px-4 py-[7px] text-[13px] text-mute backdrop-blur-md">
        <span className="live-dot" />
        Local-first · Your data never leaves your device
      </div>

      <h1 className="max-w-[14ch] text-[clamp(42px,6.4vw,84px)] leading-[1.05] font-bold tracking-[-0.03em]">
        <Words words={["Your", "second", "brain,"]} offset={0} />{" "}
        <Words words={["beautifully", "connected."]} offset={3} gradient />
      </h1>

      <p className="mt-6.5 max-w-[52ch] text-lg leading-relaxed text-mute">
        Synapse is a block-based knowledge base with bi-directional links, a living
        graph, and instant full-text search — fully offline, in your browser. No
        accounts. No cloud. Just your ideas.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3.5">
        <Link href="/app" className={buttonVariants({ variant: "primary", size: "lg" })}>
          Open Synapse
          <ArrowRight className="size-3.75" />
        </Link>
        <a href="#demo" className={buttonVariants({ variant: "ghost", size: "lg" })}>
          <Play className="size-3.75" />
          Watch demo
        </a>
      </div>

      <div className="mt-8.5 flex items-center gap-2 text-[13px] text-faint">
        Press <span className="kbd">Cmd</span>
        <span className="kbd">K</span> to fly through your notes
      </div>

      <div className="scroll-hint absolute bottom-7 left-1/2 -translate-x-1/2 text-xs text-faint">
        scroll
      </div>
    </header>
  );
}
