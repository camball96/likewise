"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Analysing } from "@/components/analysing";
import { SavedLists } from "@/components/lists";
import { FeedFilters, filterCount, NO_FILTERS, type Filters } from "@/components/feed-filters";
import { InspirationStrip } from "@/components/inspiration-strip";
import { OutfitForm } from "@/components/outfit-form";
import { PhotoButton } from "@/components/photo-button";
import { ProductCard, type CardProduct } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { fromCamera, toJpegBase64 } from "@/lib/photo";
import { useTRPC, useTRPCClient } from "@/lib/trpc";

export default function OutfitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const outfits = useQuery(trpc.outfits.list.queryOptions());
  const outfit = outfits.data?.find((o) => o.id === id);
  const [dialog, setDialog] = useState<"new" | "edit" | null>(null);
  // poll while pasted links are being analysed; the feed restarts when one becomes ready
  const saved = useQuery({
    ...trpc.items.saved.queryOptions({ outfitId: id }),
    enabled: !!outfit,
    refetchInterval: (q) => (q.state.data?.references.some((r) => r.status === "PENDING") ? 5000 : false),
  });
  const references = saved.data?.references ?? [];
  const ready = references.filter((r) => r.status === "READY").length;
  // filters belong to the outfit being viewed; switching outfits starts unfiltered
  const [filterState, setFilterState] = useState({ outfitId: id, value: NO_FILTERS });
  const filters = filterState.outfitId === id ? filterState.value : NO_FILTERS;
  const setFilters = (value: Filters) => setFilterState({ outfitId: id, value });

  return (
    <div className="mx-auto max-w-6xl px-3 pb-16 sm:px-5">
      <header className="sticky top-0 z-10 -mx-3 flex items-center gap-3 border-b border-foreground/5 bg-background/85 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <Link href="/" className="font-heading text-3xl font-semibold">
          like<em className="text-[#6e4a35]">wise</em>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {outfits.data?.map((o) => (
            <Link
              key={o.id}
              href={`/outfits/${o.id}`}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${o.id === id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              {o.name}
            </Link>
          ))}
          <Button variant="ghost" size="icon" aria-label="New results" onClick={() => setDialog("new")}>
            <PlusIcon />
          </Button>
        </nav>
        <Button variant="ghost" size="sm" onClick={() => authClient.signOut().then(() => router.replace("/"))}>
          Sign out
        </Button>
      </header>

      {outfit && (
        <Tabs defaultValue="feed" className="mt-8">
          <p className="eyebrow">Curated results</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="flex items-center gap-1 font-heading text-4xl font-semibold sm:text-5xl">
              {outfit.name}
              <Button variant="ghost" size="icon" aria-label="Edit results" onClick={() => setDialog("edit")}>
                <PencilIcon />
              </Button>
            </h1>
            <TabsList>
              <TabsTrigger value="feed">Picked for you</TabsTrigger>
              <TabsTrigger value="saved">Saved</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="feed" className="mt-6">
            {/* while links are being analysed, the Analysing card below shows them instead */}
            {saved.data && !references.some((r) => r.status === "PENDING") && (
              <InspirationStrip references={references} items={saved.data.items} onEdit={() => setDialog("edit")} />
            )}
            {/* feed toolbar, set apart from the outfit's header by a hairline */}
            <div className="mb-5 flex items-start justify-between gap-3 border-t border-foreground/10 pt-5">
              <FeedFilters key={id} value={filters} onChange={setFilters} />
              <p className="hidden shrink-0 pt-1.5 text-xs text-muted-foreground sm:block">Closest matches first</p>
            </div>
            <Analysing references={references.filter((r) => r.status === "PENDING")} />
            <Feed
              key={`${outfit.id}-${ready}-${JSON.stringify(filters)}`}
              outfitId={outfit.id}
              filters={filters}
              onClearFilters={() => setFilters(NO_FILTERS)}
              categories={outfit.categories}
              storeCount={outfit.stores.length}
              onEdit={() => setDialog("edit")}
              // the search's meaning is still being worked out (first visit, rename or category change)
              weighing={outfit.nameWeight === null && !references.some((r) => r.status === "PENDING") ? outfit.name : undefined}
              onWeighed={() => outfits.refetch()}
            />
          </TabsContent>
          <TabsContent value="saved" className="mt-6">
            <Saved outfitId={outfit.id} />
          </TabsContent>
        </Tabs>
      )}
      {outfits.data && !outfit && <p className="mt-10 text-center text-muted-foreground">Results not found.</p>}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent showCloseButton={false} className="max-h-[90vh] overflow-y-auto bg-transparent p-0 ring-0 sm:max-w-md">
          {dialog && (
            <OutfitForm
              key={dialog + id}
              outfit={dialog === "edit" ? outfit : undefined}
              title={dialog === "edit" ? "Edit results" : "New results"}
              onCancel={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FEED_PAGE = 24; // products per feed page (PAGE_SIZE in src/server/router.ts)

function useSetItem(outfitId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.items.set.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.items.saved.queryKey({ outfitId }) }),
    }),
  );
}

// The feed: the first page loads straight away, then a "Load more" button asks the server for the next best matches,
// excluding what's already shown (a button rather than infinite scroll, so the footer stays reachable).
// Hearts and skips are saved immediately, so later pages reflect them.
function Feed({
  outfitId,
  filters,
  onClearFilters,
  categories,
  storeCount,
  onEdit,
  weighing,
  onWeighed,
}: {
  outfitId: string;
  filters: Filters;
  onClearFilters: () => void;
  categories: string[];
  storeCount: number;
  onEdit: () => void;
  weighing?: string;
  onWeighed: () => void;
}) {
  const client = useTRPCClient(); // feed pages aren't cached: each one depends on what's already been shown
  const setItem = useSetItem(outfitId);
  const [products, setProducts] = useState<CardProduct[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const started = useRef(false);
  const shown = useRef<string[]>([]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const page = await client.feed.query({ outfitId, exclude: [...shown.current], ...filters });
      shown.current.push(...page.map((p) => p.id));
      setProducts((prev) => [...prev, ...page]);
      if (page.length < FEED_PAGE) setDone(true);
      if (weighing) onWeighed();
    } finally {
      setLoading(false);
    }
  }, [client, filters, outfitId, weighing, onWeighed]);

  // first page (once, even when React runs effects twice in development)
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadMore();
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
      {weighing && loading && products.length === 0 && <Analysing references={[]} name={weighing} />}
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            outfitId={outfitId}
            liked={liked.has(p.id)}
            onLike={() => like(p.id)}
            onSkip={() => skip(p.id)}
            onListed={() => setLiked((s) => new Set(s).add(p.id))}
          />
        ))}
      </div>
      {!done && (
        <div className="py-10 text-center">
          {products.length > 0 ? (
            <Button variant="outline" size="lg" onClick={loadMore} disabled={loading}>
              {loading && <Loader2Icon className="animate-spin" />} {loading ? "Loading…" : "Load more"}
            </Button>
          ) : (
            !weighing && <Loader2Icon className="mx-auto size-6 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
      {done && products.length === 0 && filterCount(filters) > 0 && (
        <div className="mx-auto max-w-md py-20 text-center">
          <p className="eyebrow">Nothing in this edit</p>
          <p className="mt-2 font-heading text-3xl font-semibold">Nothing matches these filters right now</p>
          <p className="mt-3 text-sm text-muted-foreground">Try loosening a filter or two. Fresh picks land every morning.</p>
          <Button className="mt-6" onClick={onClearFilters}>
            Clear filters
          </Button>
        </div>
      )}
      {done && products.length === 0 && filterCount(filters) === 0 && (
        <div className="mx-auto max-w-md py-20 text-center">
          <p className="eyebrow">Still searching</p>
          <p className="mt-2 font-heading text-3xl font-semibold">
            We couldn&apos;t find any {categories.length ? categories.join(", ").toLowerCase() : "pieces"} in{" "}
            {storeCount === 0 ? "our stores" : storeCount === 1 ? "the store you picked" : `the ${storeCount} stores you picked`} right now
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Every morning we go through the new arrivals for you. In the meantime, try fine-tuning your inspiration links or categories.
          </p>
          <Button className="mt-6" onClick={onEdit}>
            <PencilIcon /> Edit results
          </Button>
        </div>
      )}
      {done && products.length > 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          That&apos;s your full edit for now. Fresh picks land every morning.
        </p>
      )}
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

  const uploadExample = useMutation(trpc.items.uploadExample.mutationOptions({ onSuccess: refresh }));
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  async function upload(files: File[]) {
    setUploading(true);
    setUploadFailed(false);
    const results = await Promise.allSettled(files.map(async (file) => uploadExample.mutateAsync({ outfitId, camera: await fromCamera(file), jpeg: await toJpegBase64(file) })));
    setUploadFailed(results.some((r) => r.status === "rejected"));
    setUploading(false);
  }

  const items = saved.data?.items ?? [];
  const examples = items.filter((i) => i.kind === "EXAMPLE");
  const likes = items.filter((i) => i.kind === "LIKE");
  const toCard = (i: (typeof items)[number]): CardProduct => ({ ...i.product, store: i.product.store.name });
  const unsave = (productId: string) => setItem.mutate({ outfitId, productId, kind: null });

  return (
    <div className="grid gap-10">
      <SavedLists outfitId={outfitId} />
      <section className="border-t border-foreground/10 pt-10">
        <p className="eyebrow">Your taste</p>
        <h2 className="mt-1 font-heading text-3xl font-semibold">Style references</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Paste a link to anything you love (a product page from any store, a Pinterest pin, an Instagram post) or upload a photo. Everything you add
          here shapes what we pick for you.
        </p>
        <form
          className="flex max-w-2xl flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addExample.mutate({ outfitId, url });
          }}
        >
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" type="url" required className="min-w-48 flex-1" />
          <Button type="submit" disabled={addExample.isPending}>
            {addExample.isPending ? "Adding…" : "Add"}
          </Button>
          <PhotoButton onPick={upload} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload photo"}
          </PhotoButton>
        </form>
        {addExample.error && <p className="mt-2 text-sm text-destructive">{addExample.error.message}</p>}
        {uploadFailed && <p className="mt-2 text-sm text-destructive">Couldn&apos;t upload that photo. Try a JPG, PNG or WebP.</p>}
        <Grid>
          {saved.data?.references.map((r) => (
            <article key={r.id} className="min-w-0">
              <a href={r.sourceUrl ?? r.imageUrl} target="_blank" rel="noopener" className="relative block aspect-[3/4] overflow-hidden rounded-2xl bg-secondary">
                <img src={r.imageUrl} alt="" className="size-full object-cover" />
                {r.status !== "READY" && (
                  <span className="absolute inset-x-2 top-2 flex items-center justify-center gap-1.5 rounded-full bg-card/90 px-2 py-1 text-xs">
                    {r.status === "PENDING" && <Loader2Icon className="size-3.5 animate-spin" />}
                    {r.status === "PENDING" ? "Analysing…" : "Couldn't read this image"}
                  </span>
                )}
              </a>
              <div className="flex items-center justify-between pt-2 text-sm">
                <span className="truncate text-muted-foreground">{r.sourceUrl ? new URL(r.sourceUrl).hostname.replace(/^www\./, "") : "Your photo"}</span>
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
      <section className="border-t border-foreground/10 pt-10">
        <p className="eyebrow">Saved from your picks</p>
        <h2 className="mt-1 font-heading text-3xl font-semibold">Hearted</h2>
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
