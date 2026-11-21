"use client";

import { useQuery } from "@tanstack/react-query";
import { HeartIcon, PlusIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc";

// The signed-in header: wordmark, a pill for each results page, then the wishlist (with a count) and account.
// `onNew` shows the + button (results pages open the "New results" form from it).
export function AppHeader({ activeId, onNew }: { activeId?: string; onNew?: () => void }) {
  const trpc = useTRPC();
  const outfits = useQuery(trpc.outfits.list.queryOptions());
  const hearted = useQuery(trpc.items.hearted.queryOptions());
  const count = hearted.data?.length ?? 0;
  return (
    <header className="sticky top-0 z-10 -mx-3 flex items-center gap-3 border-b border-foreground/5 bg-background/85 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
      <Link href="/" className="font-heading text-3xl font-semibold">
        like<em className="text-[#6e4a35]">wise</em>
      </Link>
      <nav className="flex flex-1 gap-1 overflow-x-auto">
        {outfits.data?.map((o) => (
          <Link
            key={o.id}
            href={`/outfits/${o.id}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${o.id === activeId ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
          >
            {o.name}
          </Link>
        ))}
        {onNew && (
          <Button variant="ghost" size="icon" aria-label="New results" onClick={onNew}>
            <PlusIcon />
          </Button>
        )}
      </nav>
      <Link href="/wishlist" aria-label={`Wishlist, ${count} ${count === 1 ? "piece" : "pieces"}`} className={`${buttonVariants({ variant: "ghost", size: "icon" })} relative`}>
        <HeartIcon />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
      <Link href="/account" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <UserRoundIcon /> <span className="max-sm:sr-only">Account</span>
      </Link>
    </header>
  );
}
