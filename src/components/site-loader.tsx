import { BrandLogos } from "@/components/brand-logos";

function WrittenText({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <>
      <span className="sr-only">{text}</span>
      <span className="site-loader-writing" aria-hidden="true">
        {Array.from(text).map((letter, index) => (
          <span
            key={index}
            className="site-loader-letter"
            style={{ animationDelay: `${delay + index * 45}ms` }}
          >
            {letter}
          </span>
        ))}
      </span>
    </>
  );
}

export function SiteLoader({ initial = false }: { initial?: boolean }) {
  return (
    <section
      className={`site-loader${initial ? " site-loader-initial" : ""}`}
      role="status"
      aria-label="Loading Bankers Cup"
    >
      <div className="site-loader-panel flex flex-col items-center text-center">
        <BrandLogos variant="loading" />
        <p className="mt-7 max-w-full text-xl font-black tracking-tight text-zinc-950 sm:text-2xl">
          <WrittenText text="Akure Bankers' Cup 2026" />
        </p>
        <p className="mt-1 text-xs font-bold text-emerald-700 sm:text-sm">
          <WrittenText text="Football Competition" delay={1200} />
        </p>
        <div className="mt-7 flex items-center gap-2 text-xs font-semibold text-zinc-500">
          <span>Loading</span>
          <span className="inline-flex gap-1" aria-hidden="true">
            <span className="site-loader-dot" />
            <span className="site-loader-dot" />
            <span className="site-loader-dot" />
          </span>
        </div>
      </div>
    </section>
  );
}
