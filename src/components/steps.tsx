// The three-step "how it works" list used on the welcome and sign-in pages.
export function Steps({ className = "" }: { className?: string }) {
  return (
    <ol className={`grid gap-2 text-sm ${className}`}>
      {["Name the look", "Add pieces you love", "Browse your personal edit"].map((step, i) => (
        <li key={step} className="flex items-center gap-3">
          <span className="grid size-6 place-items-center rounded-full border border-foreground/20 text-xs">{i + 1}</span>
          {step}
        </li>
      ))}
    </ol>
  );
}
