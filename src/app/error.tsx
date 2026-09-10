"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
          Bankers Cup
        </p>
        <h1 className="mt-2 text-3xl font-black text-zinc-950">
          Competition data is temporarily unavailable
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-zinc-600">
          The site could not load the latest tournament data. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </section>
    </main>
  );
}
