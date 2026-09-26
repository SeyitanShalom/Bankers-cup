import Image from "next/image";
import { Mail, Phone } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 px-4 py-5 text-center text-xs font-semibold text-zinc-500 sm:px-6 lg:flex-row lg:justify-between lg:px-8 lg:text-left">
        <div className="flex min-w-0 flex-col items-center lg:flex-row lg:gap-3">
          <Image
            src="/Apex Logo.png"
            alt="Apex League logo"
            width={44}
            height={44}
            className="h-15 w-15 shrink-0 rounded-md object-contain"
          />
          <p className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-wide text-zinc-400">
              Competition consultant
            </span>
            <span className="block font-black text-zinc-800">Apex League</span>
          </p>
        </div>

        <div className="flex flex-col items-center gap-2 lg:items-end lg:text-right">
          <p>
            Developed by{" "}
            <span className="font-black text-zinc-800">Seyitan Shalom</span>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 lg:justify-end">
            <a
              href="mailto:seyitanoluwapelumi@gmail.com"
              className="inline-flex items-center gap-1.5 transition hover:text-emerald-700"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              seyitanoluwapelumi@gmail.com
            </a>
            <a
              href="tel:+2349064750948"
              className="inline-flex items-center gap-1.5 transition hover:text-emerald-700"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              +234 906 475 0948
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
