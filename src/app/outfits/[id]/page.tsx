"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { OutfitDialog } from "@/components/outfit-dialog";
import { ProductCard, type CardProduct } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

export default function OutfitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const outfits = useQuery(trpc.outfits.list.queryOptions());
  const outfit = outfits.data?.find((o) => o.id === id);
  const [dialog, setDialog] = useState<"new" | "edit" | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-3 pb-16 sm:px-5">
      <header className="sticky top-0 z-10 -mx-3 flex items-center gap-3 border-b bg-background/90 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <Link href="/" className="font-heading text-3xl font-semibold">
          style<em className="text-[#6e4a35]">it</em>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {outfits.data?.map((o) => (
            <Link
              key={o.id}
              href={`/outfits/${o.id}`}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${o.id === id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {o.name}
            </Link>
          ))}
          <Button variant="ghost" size="icon" aria-label="New outfit" onClick={() => setDialog("new")}>
            <PlusIcon />
          </Button>
        </nav>
        <Button variant="ghost" size="sm" onClick={() => authClient.signOut().then(() => router.replace("/sign-in"))}>
          Sign out
        </Button>
      </header>

      {outfit && (
        <Tabs defaultValue="feed" className="mt-4">
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="feed">For you</TabsTrigger>
              <TabsTrigger value="saved">Saved</TabsTrigger>
            </TabsList>
            <Button variant="ghost" size="sm" onClick={() => setDialog("edit")}>
              <PencilIcon /> Edit outfit
            </Button>
          </div>
          <TabsContent value="feed" className="mt-4">
            <Feed key={outfit.id} outfitId={outfit.id} />
          </TabsContent>
          <TabsContent value="saved" className="mt-4">
            <Saved outfitId={outfit.id} />
          </TabsContent>
        </Tabs>
      )}
      {outfits.data && !outfit && <p className="mt-10 text-center text-muted-foreground">Outfit not found.</p>}

      {dialog && (
        <OutfitDialog
          key={dialog + id}
          outfit={dialog === "edit" ? outfit : undefined}
          open
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
    </div>
  );
}

function useSetItem(outfitId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.items.set.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.items.saved.queryKey({ outfitId }) }),
    }),
  );
}

// Infinite feed: each page asks the server for the next best matches, excluding what's already shown.
// Hearts and skips are saved immediately, so later pages reflect them.
function Feed({ outfitId }: { outfitId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const setItem = useSetItem(outfitId);
  const [products, setProducts] = useState<CardProduct[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const loading = useRef(false);
  const shown = useRef<string[]>([]);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading.current || done) return;
    loading.current = true;
    const page = await queryClient.fetchQuery({ ...trpc.feed.queryOptions({ outfitId, exclude: shown.current }), staleTime: 0 });
    shown.current.push(...page.map((p) => p.id));
    setProducts((prev) => [...prev, ...page]);
    if (page.length === 0) setDone(true);
    loading.current = false;
  }, [done, outfitId, queryClient, trpc]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: "800px" });
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loadMore]);

  function like(id: string) {
    const isLiked = liked.has(id);
    setLiked((s) => {
      const next = new Set(s);
      if (isLiked) next.delete(id);
      else next.add(id);
      return next;
    });
    setItem.mutate({ outfitId, productId: id, kind: isLiked ? null : "LIKE" });
  }

  function skip(id: string) {
    setProducts((ps) => ps.filter((p) => p.id !== id));
    setItem.mutate({ outfitId, productId: id, kind: "SKIP" });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} outfitId={outfitId} liked={liked.has(p.id)} onLike={() => like(p.id)} onSkip={() => skip(p.id)} />
        ))}
      </div>
      <div ref={sentinel} />
      {done && products.length === 0 && <p className="py-16 text-center text-muted-foreground">Nothing to show yet.</p>}
    </>
  );
}

// Style references (catalogue products + links from anywhere) and hearted pieces.
function Saved({ outfitId }: { outfitId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.items.saved.queryKey({ outfitId }) });
  const saved = useQuery({
    ...trpc.items.saved.queryOptions({ outfitId }),
    // poll while a pasted link is still being analysed
    refetchInterval: (q) => (q.state.data?.references.some((r) => r.status === "PENDING") ? 5000 : false),
  });
  const setItem = useSetItem(outfitId);
  const removeReference = useMutation(trpc.items.removeReference.mutationOptions({ onSuccess: refresh }));
  const [url, setUrl] = useState("");
  const addExample = useMutation(
    trpc.items.addExample.mutationOptions({
      onSuccess: () => {
        setUrl("");
        refresh();
      },
    }),
  );

  const items = saved.data?.items ?? [];
  const examples = items.filter((i) => i.kind === "EXAMPLE");
  const likes = items.filter((i) => i.kind === "LIKE");
  const toCard = (i: (typeof items)[number]): CardProduct => ({ ...i.product, store: i.product.store.name });
  const unsave = (productId: string) => setItem.mutate({ outfitId, productId, kind: null });

  return (
    <div className="grid gap-8">
      <section>
        <h2 className="font-heading text-2xl font-semibold">Style references</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Paste a link to anything you love: a product page from any store, a Pinterest pin, an Instagram post. The feed ranks everything by how close it looks.
        </p>
        <form
          className="flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addExample.mutate({ outfitId, url });
          }}
        >
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" type="url" required />
          <Button type="submit" disabled={addExample.isPending}>
            {addExample.isPending ? "Adding…" : "Add"}
          </Button>
        </form>
        {addExample.error && <p className="mt-2 text-sm text-destructive">{addExample.error.message}</p>}
        <Grid>
          {saved.data?.references.map((r) => (
            <article key={r.id} className="min-w-0">
              <a href={r.sourceUrl} target="_blank" rel="noopener" className="relative block aspect-[3/4] overflow-hidden rounded-2xl bg-secondary">
                <img src={r.imageUrl} alt="" className="size-full object-cover" />
                {r.status !== "READY" && (
                  <span className="absolute inset-x-2 top-2 rounded-full bg-card/90 px-2 py-1 text-center text-xs">
                    {r.status === "PENDING" ? "Analysing…" : "Couldn't read this image"}
                  </span>
                )}
              </a>
              <div className="flex items-center justify-between pt-2 text-sm">
                <span className="truncate text-muted-foreground">{new URL(r.sourceUrl).hostname.replace(/^www\./, "")}</span>
                <button className="text-xs underline" onClick={() => removeReference.mutate({ id: r.id })}>
                  Remove
                </button>
              </div>
            </article>
          ))}
          {examples.map((i) => (
            <ProductCard key={i.productId} product={toCard(i)} outfitId={outfitId} liked onLike={() => unsave(i.productId)} />
          ))}
        </Grid>
      </section>
      <section>
        <h2 className="font-heading text-2xl font-semibold">Hearted</h2>
        {likes.length === 0 && <p className="text-sm text-muted-foreground">Tap the heart on anything you like in the feed.</p>}
        <Grid>
          {likes.map((i) => (
            <ProductCard key={i.productId} product={toCard(i)} outfitId={outfitId} liked onLike={() => unsave(i.productId)} />
          ))}
        </Grid>
      </section>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">{children}</div>;
}
