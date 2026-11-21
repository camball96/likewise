import { cn } from "cn";
import { ArrowRightIcon, BookmarkIcon, Share2Icon } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Arrow, GridIcon, Hanger, Heart, PinIcon, Sparkle, TagIcon } from "@/components/doodles";
import { sized } from "@/components/product-card";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export const metadata: Metadata = {
  title: "likewise · Australian fashion, picked for your taste",
  description: "Show us a few pieces you love and we'll hand-pick more like them from Australia's best stores.",
};

type Pick = { id: string; title: string; imageUrl: string; store: string };

const cta = cn(buttonVariants({ size: "lg" }), "h-11 rounded-full px-6 text-[15px]");
const SIGN_UP = "/sign-in?mode=sign-up";

// The landing page for new visitors. Signed-in users go straight to their outfits.
export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    const outfit = await db.outfit.findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
    redirect(outfit ? `/outfits/${outfit.id}` : "/welcome");
  }

  // A real example of what likewise does, different on every visit: a random piece as "your inspiration",
  // then its closest matches by look (same category, other stores, one per store), exactly as the feed ranks them.
  const [nearest, stores] = await Promise.all([
    db.$queryRaw<(Pick & { storeId: string; isSeed: boolean })[]>`
      WITH seed AS (
        SELECT p.id, p."storeId", p.category, p.embedding FROM "Product" p JOIN "Store" s ON s.id = p."storeId"
        WHERE p."inStock" AND s.active AND p.embedding IS NOT NULL AND p.category IN ('Dresses', 'Tops', 'Sets', 'Skirts')
        ORDER BY random() LIMIT 1
      )
      (SELECT p.id, p.title, p."imageUrl", s.name AS store, p."storeId", true AS "isSeed"
       FROM "Product" p JOIN "Store" s ON s.id = p."storeId" JOIN seed ON seed.id = p.id)
      UNION ALL
      (SELECT p.id, p.title, p."imageUrl", s.name AS store, p."storeId", false AS "isSeed"
       FROM "Product" p JOIN "Store" s ON s.id = p."storeId" CROSS JOIN seed
       WHERE p."inStock" AND s.active AND p.embedding IS NOT NULL AND p.category = seed.category AND p."storeId" <> seed."storeId"
       ORDER BY p.embedding <=> seed.embedding LIMIT 40)`,
    db.store.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  // the seed first, then the closest match from each other store (hero shows 3, the Collections mock the next 4)
  const seen = new Set<string>();
  nearest.sort((a, b) => Number(b.isSeed) - Number(a.isSeed)); // stable: matches stay closest-first
  const picks = nearest.filter((p) => !seen.has(p.storeId) && seen.add(p.storeId)).slice(0, 8);

  return (
    <main className="overflow-x-clip">
      <Nav />
      <Hero picks={picks} />
      <StoreMarquee names={stores.map((s) => s.name)} />
      <HowItWorks />
      <Collections picks={picks.slice(4)} />
      <FinalCta />
    </main>
  );
}

function Nav() {
  return (
    <header className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
      <Link href="/" className="font-heading text-3xl font-semibold">
        like<em className="text-[#6e4a35]">wise</em>
      </Link>
      <nav className="hidden gap-5 text-sm text-muted-foreground sm:flex">
        <a href="#how" className="hover:text-foreground">
          How it works
        </a>
        <a href="#stores" className="hover:text-foreground">
          Stores
        </a>
        <a href="#collections" className="hover:text-foreground">
          Collections
        </a>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <Link href="/sign-in" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Sign in
        </Link>
        <Link href={SIGN_UP} className={cn(buttonVariants({ size: "sm" }), "rounded-full px-3.5")}>
          Get started free
        </Link>
      </div>
    </header>
  );
}

function Hero({ picks }: { picks: Pick[] }) {
  const [inspiration, ...matches] = picks;
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-10 pb-16 md:grid-cols-[1.05fr_1fr] md:pt-16">
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
        <p className="eyebrow">Australian fashion, chosen for you</p>
        <h1 className="mt-4 font-heading text-6xl leading-[0.98] font-semibold sm:text-7xl">
          Love a piece? We&apos;ll find <em className="text-[#6e4a35]">more</em>
        </h1>
        <p className="mt-5 max-w-md text-lg text-muted-foreground">
          Show us a few pieces you love, from any store, Pinterest or your camera roll, and we&apos;ll hand-pick more like them from Australia&apos;s best
          stores.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href={SIGN_UP} className={cta}>
            Start your edit <ArrowRightIcon />
          </Link>
          <a href="#how" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-11 rounded-full px-5 text-[15px]")}>
            See how it works
          </a>
        </div>
      </div>

      {/* your inspiration → the pieces we pick */}
      <div className="relative mx-auto h-[440px] w-full max-w-[460px] sm:h-[500px]">
        {inspiration && (
          <figure className="absolute top-2 left-0 z-10 w-32 -rotate-6 rounded-2xl bg-card p-2 pb-3 shadow-xl ring-1 ring-border sm:w-36 motion-safe:animate-[float_7s_ease-in-out_infinite]">
            <img src={sized(inspiration.imageUrl, 300)} alt="" className="aspect-[3/4] w-full rounded-xl object-cover" />
            <figcaption className="mt-2 text-center text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Your inspiration</figcaption>
          </figure>
        )}
        <Arrow className="absolute top-36 left-20 w-28 rotate-12 sm:left-24" />
        <Sparkle className="absolute top-0 right-24 size-5" />
        <Sparkle className="absolute top-1/2 -left-2 size-3.5" delay="1.2s" />
        <Sparkle className="absolute right-2 bottom-10 size-4" delay="0.6s" />

        {matches.slice(0, 3).map((p, i) => (
          <ProductTile
            key={p.id}
            pick={p}
            className={
              [
                "top-16 right-0 z-20 w-48 rotate-3 sm:w-56",
                "top-40 right-28 z-30 w-44 -rotate-3 sm:right-36 sm:w-52",
                "top-56 right-2 z-40 w-40 rotate-6 sm:top-64 sm:w-48",
              ][i]
            }
            delay={`${i * 1.3}s`}
          />
        ))}
        <span className="absolute top-12 right-40 z-50 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-lg sm:right-48">
          <Sparkle className="size-3 text-primary-foreground" /> Picked for you
        </span>
        <Heart className="absolute right-0 bottom-28 z-50 size-8 sm:bottom-20" delay="0.8s" />
      </div>
    </section>
  );
}

function ProductTile({ pick, className, delay }: { pick: Pick; className: string; delay: string }) {
  return (
    <figure
      className={cn("absolute rounded-2xl bg-card p-2 pb-2.5 shadow-xl ring-1 ring-border motion-safe:animate-[float_6s_ease-in-out_infinite]", className)}
      style={{ animationDelay: delay }}
    >
      <img src={sized(pick.imageUrl, 420)} alt={pick.title} className="aspect-[3/4] w-full rounded-xl object-cover" />
      <figcaption className="px-1 pt-2">
        <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{pick.store}</p>
        <p className="truncate text-xs">{pick.title}</p>
      </figcaption>
    </figure>
  );
}

function StoreMarquee({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const row = (hidden?: boolean) => (
    <div aria-hidden={hidden} className="flex shrink-0 items-center gap-8 pr-8">
      {names.map((n) => (
        <span key={n} className="flex items-center gap-8 font-heading text-2xl whitespace-nowrap italic">
          {n} <span className="text-sm text-[#6e4a35] not-italic">✦</span>
        </span>
      ))}
    </div>
  );
  return (
    <section id="stores" className="scroll-mt-8 border-y border-foreground/10 bg-card/50 py-8">
      <p className="eyebrow text-center">Searching Australia&apos;s favourite stores, every morning</p>
      <div className="mt-5 flex [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="flex motion-safe:animate-[marquee_90s_linear_infinite]">
          {row()}
          {row(true)}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: TagIcon, title: "Name the look", text: "Formal dresses for a wedding, PJs, a new work wardrobe. Each look gets its own edit." },
    { icon: PinIcon, title: "Add pieces you love", text: "Paste a link from any store, a Pinterest pin or an Instagram post, or upload a photo. A few is plenty." },
    { icon: GridIcon, title: "Browse your edit", text: "We study how each piece looks and hand-pick the closest matches. Heart what you love and it gets sharper." },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-8 px-5 py-24">
      <div className="text-center">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-3 font-heading text-5xl font-semibold">
          Three steps to your <em className="text-[#6e4a35]">edit</em>
        </h2>
        <p className="mt-3 text-muted-foreground">Free, and it takes about a minute.</p>
      </div>
      <ol className="mt-12 grid gap-5 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="panel group relative transition-transform duration-300 hover:-translate-y-1">
            <span className="absolute top-5 right-6 font-heading text-5xl text-foreground/10">{i + 1}</span>
            <div className="grid size-16 place-items-center rounded-2xl bg-secondary transition-transform duration-300 group-hover:-rotate-6">
              <Icon className="size-10" />
            </div>
            <h3 className="mt-5 font-heading text-2xl font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-10 text-center">
        <Link href={SIGN_UP} className={cta}>
          Create your first look <ArrowRightIcon />
        </Link>
      </div>
    </section>
  );
}

function Collections({ picks }: { picks: Pick[] }) {
  return (
    <section id="collections" className="mx-auto grid max-w-6xl scroll-mt-8 items-center gap-12 px-5 py-16 md:grid-cols-2">
      {/* a mock collection with its share message */}
      <div className="relative order-2 mx-auto w-full max-w-md md:order-1">
        <div className="panel -rotate-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">4 pieces</p>
              <p className="mt-1 font-heading text-3xl font-semibold">Sarah&apos;s wedding</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs">
              <Share2Icon className="size-3.5" /> Share
            </span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {picks.slice(0, 4).map((p) => (
              <div key={p.id} className="relative">
                <img src={sized(p.imageUrl, 200)} alt="" className="aspect-[3/4] w-full rounded-xl object-cover" />
                <span className="absolute right-1 bottom-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                  <BookmarkIcon className="size-2.5" fill="currentColor" />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -right-2 -bottom-10 w-60 rotate-2 rounded-2xl rounded-br-sm bg-[#6e4a35] p-3 text-xs leading-relaxed text-white shadow-xl motion-safe:animate-[float_7s_ease-in-out_infinite] sm:-right-8">
          <p className="font-semibold">Sarah&apos;s wedding</p>
          {picks.slice(0, 2).map((p) => (
            <p key={p.id} className="mt-1 truncate opacity-90">
              {p.title} · {p.store}
            </p>
          ))}
          <p className="mt-1 opacity-75">Shared with likewise</p>
        </div>
        <Heart className="absolute -top-4 -left-3 size-7" />
      </div>

      <div className="order-1 md:order-2">
        <p className="eyebrow">Collections for every occasion</p>
        <h2 className="mt-3 font-heading text-5xl leading-[1.05] font-semibold">
          Save it for <em className="text-[#6e4a35]">Sarah&apos;s wedding</em>
        </h2>
        <p className="mt-4 text-muted-foreground">
          Bookmark pieces from any of your looks into a collection for an event or trip, then share the whole collection in one tap. Every piece links straight to the store.
        </p>
        <ul className="mt-6 grid gap-3 text-sm">
          {["Collections hold pieces from any look", "One tap copies every link, ready for a group chat", "Hearting a piece also sharpens your picks"].map((t) => (
            <li key={t} className="flex items-center gap-3">
              <Sparkle className="size-3.5 shrink-0" /> {t}
            </li>
          ))}
        </ul>
        <Link href={SIGN_UP} className={cn(cta, "mt-8")}>
          Start a collection <ArrowRightIcon />
        </Link>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-20 pb-8">
      <div className="panel relative overflow-hidden px-6 py-14 text-center sm:px-12">
        <Hanger className="absolute top-6 left-8 hidden h-20 sm:block" />
        <Sparkle className="absolute top-10 right-12 size-5" />
        <Sparkle className="absolute right-24 bottom-10 size-3.5" delay="1s" />
        <p className="eyebrow">Free to use</p>
        <h2 className="mx-auto mt-3 max-w-2xl font-heading text-5xl leading-[1.05] font-semibold">
          Your next favourite piece is <em className="text-[#6e4a35]">already out there</em>
        </h2>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">It takes a minute to start. Bring a few pieces you love and we&apos;ll do the searching.</p>
        <Link href={SIGN_UP} className={cn(cta, "mt-8")}>
          Start your edit <ArrowRightIcon />
        </Link>
      </div>
    </section>
  );
}
