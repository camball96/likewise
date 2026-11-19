"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/lib/trpc";

type Outfit = { id: string; name: string; stores: { id: string }[] };

// Create an outfit (name, inspiration links, stores) or edit one (name, stores, delete).
// Used on the welcome page and in the outfit page's dialog.
export function OutfitForm({ outfit, title, onCancel }: { outfit?: Outfit; title?: string; onCancel: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const stores = useQuery(trpc.stores.queryOptions());
  const save = useMutation(trpc.outfits.save.mutationOptions());
  const remove = useMutation(trpc.outfits.delete.mutationOptions());
  const addExample = useMutation(trpc.items.addExample.mutationOptions());

  const [name, setName] = useState(outfit?.name ?? "");
  const [links, setLinks] = useState([""]);
  const [storeIds, setStoreIds] = useState<string[]>(outfit?.stores.map((s) => s.id) ?? []);
  const [pickStores, setPickStores] = useState(storeIds.length > 0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ outfitId: string; urls: string[] } | null>(null);

  async function goTo(path: string) {
    await queryClient.invalidateQueries({ queryKey: trpc.outfits.list.queryKey() });
    router.push(path);
    onCancel();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await save.mutateAsync({ id: outfit?.id, name, storeIds: pickStores ? storeIds : [] });
      const urls = outfit ? [] : links.map((l) => l.trim()).filter(Boolean);
      const results = await Promise.allSettled(urls.map((url) => addExample.mutateAsync({ outfitId: saved.id, url })));
      const bad = urls.filter((_, i) => results[i].status === "rejected");
      if (bad.length) setFailed({ outfitId: saved.id, urls: bad });
      else await goTo(`/outfits/${saved.id}`);
    } finally {
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <div className="panel">
        <h2 className="font-heading text-3xl font-semibold">Almost there</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your outfit is ready, but we couldn&apos;t find a photo on {failed.urls.length === 1 ? "this link" : "these links"}:
        </p>
        <ul className="mt-3 grid gap-1 text-sm">
          {failed.urls.map((url) => (
            <li key={url} className="truncate text-destructive">
              {url}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">You can add other links from the Saved tab.</p>
        <Button className="mt-6 w-full" size="lg" onClick={() => goTo(`/outfits/${failed.outfitId}`)}>
          Go to my outfit <ArrowRightIcon />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel grid gap-6">
      {title && <h2 className="font-heading text-3xl font-semibold">{title}</h2>}

      <div className="grid gap-2">
        <Label htmlFor="outfit-name">What are you shopping for?</Label>
        <Input id="outfit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Formal dresses" required maxLength={40} />
      </div>

      {/* links for an existing outfit are managed on its Saved tab */}
      {!outfit && (
        <div className="grid gap-2">
          <Label>Inspiration</Label>
          <p className="-mt-1 text-xs text-muted-foreground">Links to pieces you love: any store, Pinterest or Instagram. A few is plenty.</p>
          {links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <Input type="url" value={link} onChange={(e) => setLinks(links.map((l, j) => (j === i ? e.target.value : l)))} placeholder="https://…" />
              {links.length > 1 && (
                <Button type="button" variant="ghost" size="icon" aria-label="Remove link" onClick={() => setLinks(links.filter((_, j) => j !== i))}>
                  <XIcon />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setLinks([...links, ""])}>
            <PlusIcon /> Add another link
          </Button>
        </div>
      )}

      <div className="grid gap-2">
        <Label>Stores</Label>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {pickStores ? (storeIds.length ? `${storeIds.length} selected` : "None ticked yet") : `All ${stores.data?.length ?? ""} Australian stores`}
          </span>
          <button type="button" className="underline" onClick={() => setPickStores(!pickStores)}>
            {pickStores ? "Use all stores" : "Choose stores"}
          </button>
        </div>
        {pickStores && (
          <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-xl border p-3">
            {stores.data?.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={storeIds.includes(s.id)}
                  onCheckedChange={() => setStoreIds((ids) => (ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}

      <div className="flex items-center gap-3">
        {outfit ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={async () => {
              await remove.mutateAsync({ id: outfit.id });
              await goTo("/");
            }}
          >
            Delete
          </Button>
        ) : null}
        <Button type="button" variant="ghost" className={outfit ? "ml-auto" : ""} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className={outfit ? "" : "flex-1"} disabled={busy}>
          {busy ? "Saving…" : outfit ? "Save" : "Create outfit"}
        </Button>
      </div>
    </form>
  );
}
