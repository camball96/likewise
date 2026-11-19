"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/lib/trpc";

type Outfit = { id: string; name: string; stores: { id: string }[] };

// Create a new outfit, or edit/delete an existing one.
export function OutfitDialog({ outfit, open, onOpenChange }: { outfit?: Outfit; open: boolean; onOpenChange: (open: boolean) => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const stores = useQuery(trpc.stores.queryOptions());
  const [name, setName] = useState(outfit?.name ?? "");
  const [storeIds, setStoreIds] = useState<string[]>(outfit?.stores.map((s) => s.id) ?? []);

  const done = () => {
    queryClient.invalidateQueries({ queryKey: trpc.outfits.list.queryKey() });
    onOpenChange(false);
  };
  const save = useMutation(
    trpc.outfits.save.mutationOptions({
      onSuccess: (saved) => {
        done();
        router.push(`/outfits/${saved.id}`);
      },
    }),
  );
  const remove = useMutation(
    trpc.outfits.delete.mutationOptions({
      onSuccess: () => {
        done();
        router.push("/");
      },
    }),
  );

  const toggle = (id: string) => setStoreIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{outfit ? "Edit outfit" : "New outfit"}</DialogTitle>
        </DialogHeader>
        <form
          id="outfit-form"
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ id: outfit?.id, name, storeIds });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="outfit-name">Name</Label>
            <Input id="outfit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Formal dresses" required maxLength={40} />
          </div>
          <div className="grid gap-2">
            <Label>Stores {storeIds.length === 0 && <span className="font-normal text-muted-foreground">(none ticked = all)</span>}</Label>
            <div className="grid grid-cols-2 gap-2">
              {stores.data?.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={storeIds.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
        </form>
        <DialogFooter>
          {outfit && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={() => remove.mutate({ id: outfit.id })}>
              Delete
            </Button>
          )}
          <Button type="submit" form="outfit-form" disabled={save.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
