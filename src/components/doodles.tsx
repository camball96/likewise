// Small hand-drawn style accents in the mocha line style, used on the landing page and the Analysing card.
// Decorative only (aria-hidden). Animations come from the keyframes in globals.css and respect reduced motion.

const line = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// A dress on a hanger, swinging gently.
export function Hanger({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 64" aria-hidden className={`origin-top text-[#6e4a35] motion-safe:animate-[sway_2.4s_ease-in-out_infinite] ${className}`} {...line}>
      <path d="M21 7a3 3 0 1 1 3 3v4" />
      <path d="M24 14 6 25h36z" />
      <path d="M18 25v5M30 25v5" />
      <path d="M15 30q9 4 18 0l-2 10 8 19q-15 4-30 0l8-19z" fill="#ecdcc8" />
      <path d="M17 40h14" />
    </svg>
  );
}

// Four-point sparkle that twinkles.
export function Sparkle({ className = "", delay = "0s" }: { className?: string; delay?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`text-[#6e4a35] motion-safe:animate-[twinkle_2.8s_ease-in-out_infinite] ${className}`}
      style={{ animationDelay: delay }}
    >
      <path d="M12 2c.6 5.2 2.8 7.4 8 8-5.2.6-7.4 2.8-8 8-.6-5.2-2.8-7.4-8-8 5.2-.6 7.4-2.8 8-8z" fill="currentColor" />
    </svg>
  );
}

// Outline heart with a little pop.
export function Heart({ className = "", delay = "0s" }: { className?: string; delay?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`text-[#c0573f] motion-safe:animate-[pop_3.2s_ease-in-out_infinite] ${className}`}
      style={{ animationDelay: delay }}
      {...line}
    >
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="#f3d3c8" />
    </svg>
  );
}

// Loose dashed arrow, drawn left to right with a downward curve.
export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" aria-hidden className={`text-[#6e4a35]/70 ${className}`} {...line}>
      <path d="M4 10c30-6 62 2 84 30" strokeDasharray="4 6" />
      <path d="M78 42l11 1 1-11" />
    </svg>
  );
}

// Step icons for "How it works".
export function TagIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={`text-[#6e4a35] ${className}`} {...line}>
      <path d="M6 24 22 8h18v18L24 42z" fill="#ecdcc8" />
      <circle cx="33" cy="15" r="3" />
      <path d="M15 27l6 6M19 23l6 6" />
    </svg>
  );
}

export function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={`text-[#6e4a35] ${className}`} {...line}>
      <rect x="8" y="10" width="20" height="26" rx="3" fill="#ecdcc8" transform="rotate(-8 18 23)" />
      <rect x="20" y="12" width="20" height="26" rx="3" fill="#fbf6ef" transform="rotate(6 30 25)" />
      <path d="M26 30l4-5 3 3 3-4 3 6" />
      <circle cx="28" cy="20" r="2" />
    </svg>
  );
}

export function GridIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={`text-[#6e4a35] ${className}`} {...line}>
      <rect x="7" y="7" width="15" height="19" rx="3" fill="#ecdcc8" />
      <rect x="26" y="7" width="15" height="19" rx="3" />
      <rect x="7" y="30" width="15" height="11" rx="3" />
      <rect x="26" y="30" width="15" height="11" rx="3" fill="#ecdcc8" />
      <path d="M33 14l1.2 2.6L37 17l-2.8 1.2L33 21l-1.2-2.8L29 17l2.8-.4z" fill="currentColor" stroke="none" />
    </svg>
  );
}
