"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Heart } from "@/components/doodles";
import { ProductCard } from "@/components/product-card";
import { buttonVariants } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc";

// Every hearted piece, from all of the user's results pages (opened from the heart in the header).
export default function WishlistPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const hearted = useQuery(trpc.items.hearted.queryOptions());
  const key = trpc.items.hearted.queryKey();
  // taken off the page straight away; the hearts on every results page go too
  const unheart = useMutation(
    trpc.items.unheart.mutationOptions({
      onMutate: ({ productId }) => queryClient.setQueryData(key, (items) => items?.filter((i) => i.productId !== productId)),
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: key });
        queryClient.invalidateQueries({ queryKey: trpc.items.saved.queryKey() });
      },
    }),
  );
  const items = hearted.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-3 pb-16 sm:px-5">
      <AppHeader />
      <p className="eyebrow mt-8">Saved</p>
      <h1 className="font-heading text-4xl font-semibold sm:text-5xl">Wishlist</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {items.length > 0
          ? `${items.length} ${items.length === 1 ? "piece" : "pieces"} you've hearted, from all your results.`
          : "Everything you heart, from all your results, in one place."}
      </p>

      {hearted.data && items.length === 0 && (
        <div className="mx-auto max-w-md py-20 text-center">
          <Heart className="mx-auto size-10" />
          <p className="mt-4 font-heading text-3xl font-semibold">Nothing saved yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Tap the heart on any piece you love and it&apos;ll wait for you here.</p>
          <Link href="/welcome" className={`${buttonVariants()} mt-6 rounded-full px-5`}>
            Back to your results
          </Link>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((i) => (
          <ProductCard
            key={i.productId}
            product={{ ...i.product, store: i.product.store.name }}
            outfitId={i.outfitId}
            liked
            onLike={() => unheart.mutate({ productId: i.productId })}
          />
        ))}
      </div>
    </div>
  );
}
