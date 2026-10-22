import { BrandLogos } from "@/components/brand-logos";

export default function Loading() {
  return (
    <section className="site-loader" role="status" aria-label="Loading Bankers Cup">
      <div className="flex flex-col items-center text-center">
        <BrandLogos variant="loading" />
        <p className="mt-7 text-xl font-black tracking-tight text-zinc-950 sm:text-2xl">
          Akure Bankers&apos; Cup
        </p>
        <p className="mt-1 text-xs font-bold text-emerald-700 sm:text-sm">
          Football Competition
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
