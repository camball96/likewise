"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkIcon, CheckIcon, PencilIcon, PlusIcon, Share2Icon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { ProductCard, sized } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTRPC } from "@/lib/trpc";

function useToggle(outfitId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.lists.toggle.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.lists.all.queryKey() });
        queryClient.invalidateQueries({
          queryKey: trpc.items.saved.queryKey({ outfitId }),
        });
      },
    }),
  );
}

// Bookmark button on a product card: tick the lists it belongs in, or start a new one.
export function ListPicker({ productId, outfitId, onAdd }: { productId: string; outfitId: string; onAdd?: () => void }) {
  const trpc = useTRPC();
  const lists = useQuery(trpc.lists.all.queryOptions());
  const toggle = useToggle(outfitId);
  const create = useMutation(trpc.lists.create.mutationOptions());
  const [name, setName] = useState("");
  const inList = (l: NonNullable<typeof lists.data>[number]) => l.items.some((i) => i.productId === productId);
  const saved = lists.data?.some(inList);

  function set(listId: string, add: boolean) {
    toggle.mutate({ listId, productId, outfitId, add });
    if (add) onAdd?.();
  }

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Add to list"
        className={`grid size-9 place-items-center rounded-full shadow ${saved ? "bg-primary text-primary-foreground" : "bg-card/90"}`}
      >
        <BookmarkIcon className="size-4" fill={saved ? "currentColor" : "none"} />
      </PopoverTrigger>
      <PopoverContent align="end" className="grid grid-cols-1 w-72 gap-3 rounded-2xl bg-card p-4">
        <p className="eyebrow">Save to a list</p>
        {lists.data?.map((l) => (
          <label key={l.id} className="flex cursor-pointer items-center gap-3 text-sm">
            <Checkbox checked={inList(l)} onCheckedChange={(checked) => set(l.id, checked)} />
            <span className="flex-1 truncate">{l.name}</span>
            <span className="text-xs text-muted-foreground">{l.items.length}</span>
          </label>
        ))}
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const list = await create.mutateAsync({ name });
            setName("");
            set(list.id, true);
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New list, e.g. Sarah's wedding" maxLength={40} required />
          <Button type="submit" size="icon" aria-label="Create list" disabled={create.isPending}>
            <PlusIcon />
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

// "Lists" section of the Saved tab: a cover for each list, and the pieces of the one that's open.
export function SavedLists({ outfitId }: { outfitId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.lists.all.queryKey() });
  const lists = useQuery(trpc.lists.all.queryOptions());
  const toggle = useToggle(outfitId);
  const rename = useMutation(trpc.lists.rename.mutationOptions({ onSuccess: refresh }));
  const remove = useMutation(trpc.lists.delete.mutationOptions({ onSuccess: refresh }));
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // new name while renaming
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const open = lists.data?.find((l) => l.id === openId);

  function select(id: string) {
    setOpenId(id === openId ? null : id);
    setEditing(null);
    setConfirmDelete(false);
    setCopied(false);
  }

  // Copies the list: each piece's name and store, then its link on the store's own site, signed off with a link to us.
  // Plain text for messaging apps; email and notes apps get the HTML version, where "likewise" is a link.
  async function share(list: NonNullable<typeof open>) {
    const site = window.location.origin;
    const text = [
      list.name,
      ...list.items.map((i) => `${i.product.title} · ${i.product.store.name}\n${i.product.url}`),
      `Shared with likewise · ${site}`,
    ].join("\n\n");
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    const html = [
      `<p><b>${esc(list.name)}</b></p>`,
      ...list.items.map((i) => `<p><a href="${esc(i.product.url)}">${esc(i.product.title)}</a> · ${esc(i.product.store.name)}</p>`),
      `<p>Shared with <a href="${site}">likewise</a></p>`,
    ].join("");
    if (typeof ClipboardItem === "undefined") await navigator.clipboard.writeText(text);
    else
      await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) }),
      ]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section>
      <p className="eyebrow">For an occasion</p>
      <h2 className="mt-1 font-heading text-3xl font-semibold">Lists</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {lists.data?.length === 0
          ? "Tap the bookmark on any piece to start a list, like \u201cSarah's wedding\u201d or \u201cBali trip\u201d."
          : "Pieces you've bookmarked for an event or trip, from any outfit."}
      </p>
      {/* padding keeps the selected ring from being clipped by the scroller */}
      <div className="-mx-2 mt-3 flex gap-4 overflow-x-auto p-2">
        {lists.data?.map((l) => (
          <button key={l.id} onClick={() => select(l.id)} className="group w-32 shrink-0 text-left outline-none sm:w-36">
            <div
              className={`grid aspect-square overflow-hidden rounded-2xl bg-secondary ring-2 ring-offset-2 ring-offset-background transition group-focus-visible:ring-ring ${
                l.items.length >= 4 ? "grid-cols-2 gap-0.5" : ""
              } ${l.id === openId ? "ring-primary" : "ring-transparent group-hover:ring-foreground/15"}`}
            >
              {l.items.slice(0, l.items.length >= 4 ? 4 : 1).map((i) => (
                <img key={i.productId} src={sized(i.product.imageUrl, 240)} alt="" className="size-full object-cover" />
              ))}
            </div>
            <p className={`mt-2 truncate text-sm ${l.id === openId ? "font-semibold" : "font-medium"}`}>{l.name}</p>
            <p className="text-xs text-muted-foreground">
              {l.items.length} {l.items.length === 1 ? "piece" : "pieces"}
            </p>
          </button>
        ))}
      </div>

      {open && (
        <div className="panel mt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            {editing === null ? (
              <div>
                <p className="eyebrow">
                  {open.items.length} {open.items.length === 1 ? "piece" : "pieces"}
                </p>
                <h3 className="mt-1 font-heading text-3xl font-semibold">{open.name}</h3>
              </div>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  rename.mutate({ id: open.id, name: editing });
                  setEditing(null);
                }}
              >
                <Input value={editing} onChange={(e) => setEditing(e.target.value)} maxLength={40} required autoFocus />
                <Button type="submit">Save</Button>
              </form>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={open.items.length === 0} onClick={() => share(open)}>
                {copied ? <CheckIcon /> : <Share2Icon />} {copied ? "Links copied" : "Share"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(open.name)}>
                <PencilIcon /> Rename
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={confirmDelete ? "border-destructive text-destructive" : ""}
                onClick={() => {
                  if (!confirmDelete) return setConfirmDelete(true);
                  remove.mutate({ id: open.id });
                  setOpenId(null);
                }}
              >
                <Trash2Icon /> {confirmDelete ? "Tap again to delete" : "Delete"}
              </Button>
            </div>
          </div>
          {open.items.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing in this list yet.</p>}
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-5">
            {open.items.map((i) => (
              <ProductCard
                key={i.productId}
                product={{ ...i.product, store: i.product.store.name }}
                outfitId={outfitId}
                onSkip={() =>
                  toggle.mutate({
                    listId: open.id,
                    productId: i.productId,
                    outfitId,
                    add: false,
                  })
                }
                skipLabel="Remove from list"
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
