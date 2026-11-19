"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

// Opens the first outfit, or walks a new user through creating one.
export default function Home() {
  const trpc = useTRPC();
  const router = useRouter();
  const session = authClient.useSession();
  const outfits = useQuery(trpc.outfits.list.queryOptions());
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const first = outfits.data?.[0];

  useEffect(() => {
    if (first) router.replace(`/outfits/${first.id}`);
  }, [first, router]);

  if (!outfits.data || first) return null;
  const firstName = session.data?.user.name?.split(" ")[0];

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6 py-16">
      <div aria-hidden className="pointer-events-none absolute -top-48 left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-secondary/70 blur-3xl" />

      {/* the right-hand column grows from nothing when the form opens */}
      <div
        className={`relative grid w-full max-w-5xl items-center gap-10 transition-[grid-template-columns] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] md:gap-0 ${
          open ? "md:grid-cols-[1fr_1fr]" : "md:grid-cols-[1fr_0fr]"
        }`}
      >
        <section className="mx-auto max-w-md">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Welcome{firstName ? `, ${firstName}` : ""}
          </p>
          <h1 className="mt-3 font-heading text-5xl leading-[1.05] font-semibold sm:text-6xl">
            Start your first <em className="text-[#6e4a35]">outfit</em>
          </h1>
          <p className="mt-4 text-muted-foreground">
            An outfit is a look you&apos;re shopping for, like &ldquo;Formal dresses&rdquo; or &ldquo;PJs&rdquo;. Show us a few pieces you love and we&apos;ll
            find more like them from Australian stores.
          </p>
          <ol className="mt-6 grid gap-2 text-sm">
            {["Name the look", "Add pieces you love", "Scroll your matches"].map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full border border-foreground/20 text-xs">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <Button
            size="lg"
            onClick={() => {
              setOpen(true);
              // on phones the form opens below the text, so bring it into view
              setTimeout(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
            }}
            className={`mt-8 transition-opacity duration-300 ${open ? "pointer-events-none opacity-0 max-md:hidden" : ""}`}
          >
            Create an outfit <ArrowRightIcon />
          </Button>
        </section>

        <div ref={panel} className={`min-w-0 overflow-hidden ${open ? "" : "hidden md:block"}`} inert={!open}>
          <div
            className={`mx-auto max-w-md p-4 transition duration-500 md:w-[28rem] ${open ? "translate-x-0 opacity-100 delay-200" : "translate-x-10 opacity-0"}`}
          >
            <NewOutfitForm onCancel={() => setOpen(false)} />
          </div>
        </div>
      </div>
    </main>
  );
}

function NewOutfitForm({ onCancel }: { onCancel: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const stores = useQuery(trpc.stores.queryOptions());
  const save = useMutation(trpc.outfits.save.mutationOptions());
  const addExample = useMutation(trpc.items.addExample.mutationOptions());

  const [name, setName] = useState("");
  const [links, setLinks] = useState([""]);
  const [pickStores, setPickStores] = useState(false);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);

  // the home page sends the user to their outfit as soon as the list refreshes
  const finish = () => queryClient.invalidateQueries({ queryKey: trpc.outfits.list.queryKey() });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const outfit = await save.mutateAsync({ name, storeIds: pickStores ? storeIds : [] });
      const urls = links.map((l) => l.trim()).filter(Boolean);
      const results = await Promise.allSettled(urls.map((url) => addExample.mutateAsync({ outfitId: outfit.id, url })));
      const bad = urls.filter((_, i) => results[i].status === "rejected");
      if (bad.length) setFailed(bad);
      else await finish();
    } finally {
      setBusy(false);
    }
  }

  if (failed.length) {
    return (
      <div className="rounded-3xl bg-card p-6 shadow-xl shadow-[#6e4a35]/5 ring-1 ring-border">
        <h2 className="font-heading text-3xl font-semibold">Almost there</h2>
        <p className="mt-2 text-sm text-muted-foreground">Your outfit is ready, but we couldn&apos;t find a photo on {failed.length === 1 ? "this link" : "these links"}:</p>
        <ul className="mt-3 grid gap-1 text-sm">
          {failed.map((url) => (
            <li key={url} className="truncate text-destructive">
              {url}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">You can add other links from the Saved tab.</p>
        <Button className="mt-6 w-full" size="lg" onClick={finish}>
          Go to my outfit <ArrowRightIcon />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 rounded-3xl bg-card p-6 shadow-xl shadow-[#6e4a35]/5 ring-1 ring-border">
      <div className="grid gap-2">
        <Label htmlFor="name">What are you shopping for?</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Formal dresses" required maxLength={40} />
      </div>

      <div className="grid gap-2">
        <Label>Inspiration</Label>
        <p className="-mt-1 text-xs text-muted-foreground">Links to pieces you love: any store, Pinterest or Instagram. A few is plenty.</p>
        {links.map((link, i) => (
          <div key={i} className="flex gap-2">
            <Input
              type="url"
              value={link}
              onChange={(e) => setLinks(links.map((l, j) => (j === i ? e.target.value : l)))}
              placeholder="https://…"
            />
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
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg" className="flex-1" disabled={busy}>
          {busy ? "Creating…" : "Create outfit"}
        </Button>
      </div>
    </form>
  );
}
