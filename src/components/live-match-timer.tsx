"use client";

import { useEffect, useState } from "react";
import { Clock3, Radio } from "lucide-react";
import { getTimerSnapshot, getTimerPhase } from "@/lib/match-timer";
import type { Match } from "@/lib/types";
import { useLiveMatch } from "./use-live-match";

type LiveMatchTimerProps = {
  match: Match;
  variant?: "compact" | "large";
};

export function LiveMatchTimer({ match, variant = "compact" }: LiveMatchTimerProps) {
  const liveMatch = useLiveMatch(match);
  const [now, setNow] = useState<number | undefined>(undefined);
  const snapshot = getTimerSnapshot(liveMatch, now);
  const shouldShow =
    variant === "large" ||
    liveMatch.status === "live" ||
    getTimerPhase(liveMatch) !== "not_started";

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setNow(Date.now());
    }, 0);

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  if (!shouldShow) {
    return null;
  }

  if (variant === "compact") {
    return (
      <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md bg-zinc-950 px-3 py-2 text-white">
        <span className="inline-flex min-w-0 items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-200">
          {snapshot.running ? (
            <Radio className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Clock3 className="h-4 w-4" aria-hidden="true" />
          )}
          {snapshot.phaseLabel}
        </span>
        <span className="shrink-0 text-lg font-black">{snapshot.label}</span>
      </div>
    );
  }

  return (
    <section className="max-w-full rounded-lg border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-200">
            Match clock
          </p>
          <h2 className="mt-1 text-lg font-black">{snapshot.phaseLabel}</h2>
        </div>
        <div className="min-w-0 text-left sm:text-right">
          <p className="text-4xl font-black leading-none sm:text-5xl">{snapshot.label}</p>
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-emerald-400 transition-all"
          style={{ width: `${snapshot.progress}%` }}
        />
      </div>
    </section>
  );
}
