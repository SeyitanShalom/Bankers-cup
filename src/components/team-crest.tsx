/* eslint-disable @next/next/no-img-element */
import type { Team } from "@/lib/types";

type TeamCrestProps = {
  team: Team;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
};

function getInitials(name: string) {
  return name
    .replace(/\b(fc|bank|united)\b/gi, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function TeamCrest({ team, size = "md" }: TeamCrestProps) {
  return (
    <div
      className={`${sizeClasses[size]} grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/70 bg-gradient-to-br from-emerald-600 via-zinc-900 to-amber-400 font-black text-white shadow-sm`}
      aria-label={`${team.name} logo`}
      title={team.name}
    >
      {team.logoUrl ? (
        <img src={team.logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{getInitials(team.name)}</span>
      )}
    </div>
  );
}
