import { LogoMark } from "@/components/landing/nav";

export function Footer() {
  return (
    <footer
      id="privacy"
      className="border-t border-line px-8 py-15 text-center text-[13.5px] text-faint"
    >
      <div className="mb-3.5 inline-flex items-center gap-2.5 font-semibold text-ink">
        <LogoMark size={22} />
        Synapse
      </div>
      <div>Your knowledge graph. Write, connect, explore — fully offline.</div>
      <div className="my-4.5 flex justify-center gap-6">
        {["GitHub", "Features", "Privacy", "Changelog"].map((l) => (
          <a
            key={l}
            href="#"
            className="text-mute transition-colors duration-200 hover:text-ink"
          >
            {l}
          </a>
        ))}
      </div>
      <div>© 2026 Synapse · Built with Next.js, BlockNote &amp; Dexie</div>
    </footer>
  );
}
