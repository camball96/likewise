"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkIcon, Loader2Icon, PencilIcon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Analysing } from "@/components/analysing";
import { AppHeader } from "@/components/app-header";
import { SavedLists } from "@/components/lists";
import { FeedFilters, filterCount, NO_FILTERS, type Filters } from "@/components/feed-filters";
import { InspirationStrip } from "@/components/inspiration-strip";
import { InstallPrompt } from "@/components/install-prompt";
import { OutfitForm } from "@/components/outfit-form";
import { ProductCard, type CardProduct } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTRPC, useTRPCClient } from "@/lib/trpc";

export default function OutfitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  // poll while the search's meaning is being worked out (first visit, rename or category change)
  const outfits = useQuery({
    ...trpc.outfits.list.queryOptions(),
    refetchInterval: (q) => (q.state.data?.find((o) => o.id === id)?.nameWeight === null ? 3000 : false),
  });
  const outfit = outfits.data?.find((o) => o.id === id);
  // deleted (or an old link): go to their first results page instead
  useEffect(() => {
    if (outfits.data && !outfit) router.replace("/welcome");
  }, [outfits.data, outfit, router]);
  const [dialog, setDialog] = useState<"new" | "edit" | null>(null); // the results form: + in the header, or the pencil
  // "Picked for you", or the account's collections
  const [tabState, setTabState] = useState({ outfitId: id, value: "feed" });
  const tab = tabState.outfitId === id ? tabState.value : "feed"; // switching results pages starts on the feed
  // saving a piece to a collection nudges the Collections tab, leaves a dot on it until it's
  // opened, and pops up "Saved to …" at the bottom (the tabs are off screen once the feed is scrolled)
  const [collected, setCollected] = useState(0);
  const [savedTo, setSavedTo] = useState<{ name: string; at: number } | null>(null);
  useEffect(() => {
    if (!savedTo) return;
    const timer = setTimeout(() => setSavedTo(null), 6000);
    return () => clearTimeout(timer);
  }, [savedTo]);
  const showCollections = () => {
    setTab("collections");
    setSavedTo(null);
    setTimeout(() => document.getElementById("collections")?.scrollIntoView({ behavior: "smooth" }), 50);
  };
  const setTab = (value: string) => {
    setTabState({ outfitId: id, value });
    if (value === "collections") setCollected(0);
  };
  const edit = () => setDialog("edit");
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
      <AppHeader activeId={id} onNew={() => setDialog("new")} />

      {outfit && (
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mt-8">
          <p className="eyebrow">Curated results</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="flex items-center gap-1 font-heading text-4xl font-semibold sm:text-5xl">
              {outfit.name}
              <Button variant="ghost" size="icon" aria-label="Edit results" onClick={edit}>
                <PencilIcon />
              </Button>
            </h1>
            <TabsList>
              <TabsTrigger value="feed">Picked for you</TabsTrigger>
              <TabsTrigger value="collections">
                {/* re-keyed on each save so the nudge plays again */}
                <span key={collected} className={`flex items-center gap-1.5 ${collected ? "motion-safe:animate-[nudge_0.6s_ease-out]" : ""}`}>
                  Collections
                  {collected > 0 && (
                    <span aria-hidden className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#c0573f] opacity-75 [animation-iteration-count:3]" />
                      <span className="relative inline-flex size-2 rounded-full bg-[#c0573f]" />
                    </span>
                  )}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>
          {/* kept mounted, so flicking to Collections and back doesn't reload the feed or lose "Load more" pages */}
          <TabsContent value="feed" keepMounted className="mt-6">
            {/* while links are being analysed, the Analysing card below shows them instead */}
            {saved.data && !references.some((r) => r.status === "PENDING") && (
              <InspirationStrip references={references} items={saved.data.items} onEdit={edit} />
            )}
            {/* feed toolbar, set apart from the outfit's header by a hairline */}
            <div className="mb-5 flex items-start justify-between gap-3 border-t border-foreground/10 pt-5">
              <FeedFilters key={id} value={filters} onChange={setFilters} />
              <p className="hidden shrink-0 pt-1.5 text-xs text-muted-foreground sm:block">Closest matches first</p>
            </div>
            <Analysing references={references.filter((r) => r.status === "PENDING")} name={outfit.nameWeight === null ? outfit.name : undefined} />
            <Feed
              // starts again when anything that shapes the results changes: links becoming ready, the name or its weight,
              // categories, stores, filters
              key={JSON.stringify([outfit.id, ready, outfit.name, outfit.nameWeight, outfit.categories, outfit.stores, filters])}
              outfitId={outfit.id}
              filters={filters}
              onClearFilters={() => setFilters(NO_FILTERS)}
              categories={outfit.categories}
              storeCount={outfit.stores.length}
              onEdit={edit}
              onCollected={(name) => {
                setCollected((n) => n + 1);
                setSavedTo({ name, at: Date.now() });
              }}
            />
          </TabsContent>
          <TabsContent value="collections" className="mt-6">
            <SavedLists outfitId={outfit.id} />
          </TabsContent>
        </Tabs>
      )}

      {savedTo && (
        <div
          key={savedTo.at}
          role="status"
          className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm items-center gap-3 rounded-full bg-primary py-2 pr-2 pl-5 text-sm text-primary-foreground shadow-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4"
        >
          <BookmarkIcon className="size-4 shrink-0" fill="currentColor" />
          <span className="min-w-0 flex-1 truncate">
            Saved to <span className="font-semibold">{savedTo.name || "your collection"}</span>
          </span>
          <Button size="sm" variant="secondary" className="shrink-0 rounded-full" onClick={showCollections}>
            See collections
          </Button>
        </div>
      )}
      <InstallPrompt />
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
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.items.saved.queryKey({ outfitId }) });
        queryClient.invalidateQueries({ queryKey: trpc.items.hearted.queryKey() }); // the wishlist and its count
      },
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
  onCollected,
}: {
  outfitId: string;
  filters: Filters;
  onClearFilters: () => void;
  categories: string[];
  storeCount: number;
  onEdit: () => void;
  onCollected: (listName: string) => void;
}) {
  const client = useTRPCClient(); // feed pages aren't cached: each one depends on what's already been shown
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const setItem = useSetItem(outfitId);
  const [products, setProducts] = useState<CardProduct[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const shown = useRef<string[]>([]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const page = await client.feed.query({ outfitId, exclude: [...shown.current], ...filters });
      shown.current.push(...page.map((p) => p.id));
      setProducts((prev) => [...prev, ...page]);
      if (page.length < FEED_PAGE) setDone(true);
    } catch {
      setFailed(true);
      // e.g. this results page was deleted: refresh the list, and the page moves on to one that exists
      queryClient.invalidateQueries({ queryKey: trpc.outfits.list.queryKey() });
    } finally {
      setLoading(false);
    }
  }, [client, filters, outfitId, queryClient, trpc]);

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
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            outfitId={outfitId}
            liked={liked.has(p.id)}
            onLike={() => like(p.id)}
            onSkip={() => skip(p.id)}
            onListed={(listName) => {
              setLiked((s) => new Set(s).add(p.id));
              onCollected(listName);
            }}
          />
        ))}
      </div>
      {!done && (
        <div className="py-10 text-center">
          {failed && !loading ? (
            <div className="grid justify-items-center gap-3">
              <p className="text-sm text-muted-foreground">We couldn&apos;t load {products.length ? "more picks" : "your picks"} just now.</p>
              <Button variant="outline" onClick={loadMore}>
                Try again
              </Button>
            </div>
          ) : products.length > 0 ? (
            <Button variant="outline" size="lg" onClick={loadMore} disabled={loading}>
              {loading && <Loader2Icon className="animate-spin" />} {loading ? "Loading…" : "Load more"}
            </Button>
          ) : (
            <Loader2Icon className="mx-auto size-6 animate-spin text-muted-foreground" />
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
