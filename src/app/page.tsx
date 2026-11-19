"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OutfitDialog } from "@/components/outfit-dialog";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc";

// Opens the first outfit, or invites the user to create one.
export default function Home() {
  const trpc = useTRPC();
  const router = useRouter();
  const outfits = useQuery(trpc.outfits.list.queryOptions());
  const [open, setOpen] = useState(false);
  const first = outfits.data?.[0];

  useEffect(() => {
    if (first) router.replace(`/outfits/${first.id}`);
  }, [first, router]);

  if (!outfits.data || first) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-heading text-4xl font-semibold">Start your first outfit</h1>
      <p className="text-muted-foreground">An outfit is a look you&apos;re shopping for, like &ldquo;Formal dresses&rdquo; or &ldquo;PJs&rdquo;. Add a few pieces you love and we&apos;ll find more like them.</p>
      <Button size="lg" onClick={() => setOpen(true)}>
        Create an outfit
      </Button>
      {open && <OutfitDialog open onOpenChange={setOpen} />}
    </main>
  );
}
