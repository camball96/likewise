"use client";

import { ClockIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

// Links are usually fingerprinted within this long of being added (longer if the service was asleep).
const TYPICAL_MS = 60_000;

type Pending = { id: string; imageUrl: string; createdAt: Date | string };

// Shown above the feed while pasted links are still being fingerprinted.
export function Analysing({ references }: { references: Pending[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);
  if (references.length === 0) return null;

  const oldest = Math.min(...references.map((r) => new Date(r.createdAt).getTime()));
  const minutesLeft = Math.ceil((oldest + TYPICAL_MS - now) / 60_000);
  const n = references.length;

  return (
    <div className="panel mb-6 grid gap-5">
      <div className="flex items-center gap-5">
        <div className="grid size-20 shrink-0 place-items-center rounded-full bg-secondary">
          <Hanger />
        </div>
        <div className="min-w-0">
          <p className="eyebrow">Tailoring your feed</p>
          <h3 className="mt-1 font-heading text-2xl font-semibold">
            Learning your style from {n} new {n === 1 ? "link" : "links"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;re studying each photo to learn exactly what you&apos;re drawn to. This usually takes under a minute, and your feed will
            refresh by itself when it&apos;s done. Keep browsing in the meantime.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">
            <ClockIcon className="size-4" />
            {minutesLeft > 1 ? `About ${minutesLeft} minutes left` : minutesLeft === 1 ? "About a minute left" : "Nearly there…"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {references.map((r) => (
          <div key={r.id} className="relative aspect-[3/4] w-16 overflow-hidden rounded-xl bg-secondary sm:w-20">
            <img src={r.imageUrl} alt="" className="size-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-card/50">
              <Loader2Icon className="size-5 animate-spin text-[#6e4a35]" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// A dress on a hanger, swinging gently.
function Hanger() {
  return (
    <svg
      viewBox="0 0 48 64"
      className="h-14 origin-top animate-[sway_2.4s_ease-in-out_infinite] text-[#6e4a35]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 7a3 3 0 1 1 3 3v4" />
      <path d="M24 14 6 25h36z" />
      <path d="M18 25v5M30 25v5" />
      <path d="M15 30q9 4 18 0l-2 10 8 19q-15 4-30 0l8-19z" fill="#ecdcc8" />
      <path d="M17 40h14" />
    </svg>
  );
}
