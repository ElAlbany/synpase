import { Button } from "@/components/ui/button";

function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-lg bg-aurora"
      style={{ width: size, height: size, boxShadow: "0 0 24px rgba(110,107,255,.5)" }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        style={{ width: size * 0.58, height: size * 0.58 }}
      >
        <circle cx="5" cy="12" r="2.4" />
        <circle cx="19" cy="6" r="2.4" />
        <circle cx="19" cy="18" r="2.4" />
        <path d="M7 11l10-4M7 13l10 4" />
      </svg>
    </div>
  );
}

export { LogoMark };

export function Nav() {
  return (
    <nav className="glass fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-line px-8 py-4">
      <div className="flex items-center gap-2.5 text-base font-semibold">
        <LogoMark />
        Synapse
      </div>
      <div className="hidden items-center gap-7 text-sm text-mute md:flex">
        <a href="#features" className="transition-colors duration-200 hover:text-ink">
          Features
        </a>
        <a href="#graph" className="transition-colors duration-200 hover:text-ink">
          Graph
        </a>
        <a href="#privacy" className="transition-colors duration-200 hover:text-ink">
          Privacy
        </a>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm">
          GitHub
        </Button>
        <a href="/app">
          <Button variant="primary" size="sm">
            Open App
          </Button>
        </a>
      </div>
    </nav>
  );
}
