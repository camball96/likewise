"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { sized } from "@/components/product-card";
import { Button } from "@/components/ui/button";

type Reference = { id: string; imageUrl: string; status: string };
type Item = { productId: string; kind: string; product: { imageUrl: string; title: string } };

const SHOWN = 10;

// Above the feed: the inspiration the picks are matched to, as a reminder of what's shaping them.
export function InspirationStrip({ references, items, onEdit }: { references: Reference[]; items: Item[]; onEdit: () => void }) {
  const tiles = [
    ...references
      .filter((r) => r.status !== "FAILED") // images we couldn't read aren't shaping the picks
      .map((r) => ({ key: r.id, src: r.imageUrl, title: "Your inspiration", pending: r.status === "PENDING" })),
    ...items
      .filter((i) => i.kind === "EXAMPLE")
      .map((i) => ({ key: i.productId, src: sized(i.product.imageUrl, 160), title: i.product.title, pending: false })),
  ];
  const hearts = items.filter((i) => i.kind === "LIKE").length;

  if (tiles.length === 0) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-foreground/15 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Add a few pieces you love and your picks will match them.</span>
        <Button size="sm" onClick={onEdit}>
          <PlusIcon /> Add inspiration
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl bg-card/60 px-4 py-3 ring-1 ring-foreground/5">
      <p className="eyebrow">Matched to</p>
      <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
        {tiles.slice(0, SHOWN).map((t) => (
          <div
            key={t.key}
            title={t.title}
            className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-lg bg-secondary ring-1 ring-foreground/10 sm:w-14"
          >
            <img src={t.src} alt="" className="size-full object-cover" />
            {t.pending && (
              <span className="absolute inset-0 grid place-items-center bg-card/50">
                <Loader2Icon className="size-4 animate-spin text-[#6e4a35]" />
              </span>
            )}
          </div>
        ))}
        {tiles.length > SHOWN && (
          <span className="grid aspect-[3/4] w-12 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-medium sm:w-14">
            +{tiles.length - SHOWN}
          </span>
        )}
        {hearts > 0 && (
          <span className="ml-1 shrink-0 text-sm text-muted-foreground">
            + {hearts} {hearts === 1 ? "piece" : "pieces"} you&apos;ve hearted
          </span>
        )}
      </div>
    </div>
  );
}
