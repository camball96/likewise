import Link from "next/link";

// Layout for simple content pages (privacy, contact): the wordmark, a heading and a readable column.
export function PageShell({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 pt-8 pb-8">
      <Link href="/" className="font-heading text-3xl font-semibold">
        like<em className="text-[#6e4a35]">wise</em>
      </Link>
      <p className="eyebrow mt-14">{eyebrow}</p>
      <h1 className="mt-3 font-heading text-5xl leading-[1.05] font-semibold">{title}</h1>
      <div className="mt-8">{children}</div>
    </main>
  );
}
