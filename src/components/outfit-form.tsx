"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoButton } from "@/components/photo-button";
import { fromCamera, toJpegBase64 } from "@/lib/photo";
import { useTRPC } from "@/lib/trpc";

// must match the categories the ingest pipeline assigns (pipeline/shopify.py)
const CATEGORIES = ["Tops", "Dresses", "Skirts", "Shorts", "Pants", "Sets", "Knitwear", "Outerwear", "Jumpsuits", "Swim", "Activewear", "Sleepwear", "Lingerie"];

type Outfit = { id: string; name: string; categories: string[]; stores: { id: string }[] };

// Create or edit an outfit: name, inspiration links, categories and stores (edit also has delete).
// Used on the welcome page and in the outfit page's dialog.
export function OutfitForm({ outfit, title, onCancel }: { outfit?: Outfit; title?: string; onCancel: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const stores = useQuery(trpc.stores.queryOptions());
  const saved = useQuery({ ...trpc.items.saved.queryOptions({ outfitId: outfit?.id ?? "" }), enabled: !!outfit });
  const save = useMutation(trpc.outfits.save.mutationOptions());
  const remove = useMutation(trpc.outfits.delete.mutationOptions());
  const addExample = useMutation(trpc.items.addExample.mutationOptions());
  const uploadExample = useMutation(trpc.items.uploadExample.mutationOptions());
  const removeReference = useMutation(trpc.items.removeReference.mutationOptions());
  const setItem = useMutation(trpc.items.set.mutationOptions());
  const { mutate: warm } = useMutation(trpc.outfits.warm.mutationOptions());
  useEffect(() => warm(), [warm]); // wake the fingerprint service while the form is filled in

  const [name, setName] = useState(outfit?.name ?? "");
  const [categories, setCategories] = useState<string[]>(outfit?.categories ?? []);
  const [links, setLinks] = useState([""]);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [removed, setRemoved] = useState<string[]>([]); // ids of existing references/examples to drop on save
  const [storeIds, setStoreIds] = useState<string[]>(outfit?.stores.map((s) => s.id) ?? []);
  const [pickStores, setPickStores] = useState(storeIds.length > 0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ outfitId: string; urls: string[] } | null>(null);

  // what's already inspiring this outfit: pasted links + catalogue products
  const inspiration = [
    ...(saved.data?.references ?? []).map((r) => ({ id: r.id, kind: "reference" as const, image: r.imageUrl, label: r.sourceUrl ? new URL(r.sourceUrl).hostname.replace(/^www\./, "") : "Your photo" })),
    ...(saved.data?.items ?? [])
      .filter((i) => i.kind === "EXAMPLE")
      .map((i) => ({ id: i.productId, kind: "example" as const, image: i.product.imageUrl, label: i.product.title })),
  ];
  const existing = inspiration.filter((e) => !removed.includes(e.id));

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  async function goTo(path: string) {
    await queryClient.invalidateQueries({ queryKey: trpc.outfits.list.queryKey() });
    await queryClient.invalidateQueries({ queryKey: trpc.items.saved.queryKey() });
    router.push(path);
    onCancel();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await save.mutateAsync({ id: outfit?.id, name, categories, storeIds: pickStores ? storeIds : [] });
      const outfitId = result.id;
      await Promise.all(
        inspiration
          .filter((x) => removed.includes(x.id))
          .map((x) =>
            x.kind === "reference" ? removeReference.mutateAsync({ id: x.id }) : setItem.mutateAsync({ outfitId, productId: x.id, kind: null }),
          ),
      );
      const urls = links.map((l) => l.trim()).filter(Boolean);
      const results = await Promise.allSettled([
        ...urls.map((url) => addExample.mutateAsync({ outfitId, url })),
        ...photos.map(async ({ file }) => uploadExample.mutateAsync({ outfitId, camera: await fromCamera(file), jpeg: await toJpegBase64(file) })),
      ]);
      const bad = [...urls, ...photos.map((p) => p.file.name)].filter((_, i) => results[i].status === "rejected");
      if (bad.length) setFailed({ outfitId, urls: bad });
      else await goTo(`/outfits/${outfitId}`);
    } finally {
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <div className="panel">
        <h2 className="font-heading text-3xl font-semibold">Almost there</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your results are saved, but we couldn&apos;t add {failed.urls.length === 1 ? "this one" : "these"}:
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-1 text-sm">
          {failed.urls.map((url) => (
            <li key={url} className="truncate text-destructive">
              {url}
            </li>
          ))}
        </ul>
        <Button className="mt-6 w-full" size="lg" onClick={() => goTo(`/outfits/${failed.outfitId}`)}>
          Go to my results <ArrowRightIcon />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel grid min-w-0 grid-cols-1 gap-6">
      {title && <h2 className="font-heading text-3xl font-semibold">{title}</h2>}

      <div className="grid grid-cols-1 gap-2">
        <Label htmlFor="outfit-name">What are you shopping for?</Label>
        <Input id="outfit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Formal dresses" required maxLength={40} />
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Label>Inspiration</Label>
        <p className="-mt-1 text-xs text-muted-foreground">Links to pieces you love (any store, Pinterest or Instagram) or your own photos. A few is plenty.</p>
        {existing.map((e) => (
          <div key={e.id} className="flex items-center gap-3 rounded-xl border bg-background/50 p-1.5 pr-1 text-sm">
            <img src={e.image} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0 flex-1 truncate">{e.label}</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setRemoved([...removed, e.id])}>
              <XIcon />
            </Button>
          </div>
        ))}
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
        {photos.map((p) => (
          <div key={p.preview} className="flex items-center gap-3 rounded-xl border bg-background/50 p-1.5 pr-1 text-sm">
            <img src={p.preview} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0 flex-1 truncate">{p.file.name}</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove photo" onClick={() => setPhotos(photos.filter((x) => x !== p))}>
              <XIcon />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setLinks([...links, ""])}>
            <PlusIcon /> Add another link
          </Button>
          <PhotoButton size="sm" onPick={(files) => setPhotos([...photos, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))])}>
            Upload photos
          </PhotoButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <Label>What kind of pieces?</Label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategories(toggle(categories, c))}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                categories.includes(c) ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{categories.length ? `Only ${categories.join(", ")}` : "None picked: everything"}</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
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
                <Checkbox checked={storeIds.includes(s.id)} onCheckedChange={() => setStoreIds(toggle(storeIds, s.id))} />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}

      <div className="flex items-center gap-3">
        {outfit && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={async () => {
              await remove.mutateAsync({ id: outfit.id });
              await goTo("/welcome"); // opens their first results page, or the create form if that was the last one
            }}
          >
            Delete
          </Button>
        )}
        <Button type="button" variant="ghost" className={outfit ? "ml-auto" : ""} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className={outfit ? "" : "flex-1"} disabled={busy}>
          {busy ? "Saving…" : outfit ? "Save" : "Show my results"}
        </Button>
      </div>
    </form>
  );
}
