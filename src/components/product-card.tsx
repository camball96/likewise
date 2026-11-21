"use client";

import { HeartIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { ListPicker } from "@/components/lists";
import { burstRing, cardButton, springIn } from "@/components/card-button";
import { sized } from "@/lib/utils";

export type CardProduct = {
  id: string;
  title: string;
  imageUrl: string;
  hoverImageUrl?: string | null;
  price: number;
  compareAt: number | null;
  isNew?: boolean; // published in the last week (worked out by the feed query)
  store: string;
};

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function ProductCard({
  product,
  outfitId,
  liked = false,
  onLike,
  onSkip,
  skipLabel = "Not for me",
  onListed,
}: {
  product: CardProduct;
  outfitId: string;
  liked?: boolean;
  onLike?: () => void; // no heart button when missing (e.g. inside a list)
  onSkip?: () => void;
  skipLabel?: string;
  onListed?: (listName: string) => void; // added to a collection, which also hearts it
}) {
  const [hearted, setHearted] = useState(0); // taps that hearted it, to replay the animation
  const href = `/go/${product.id}?outfit=${outfitId}`;
  const onSale = product.compareAt && product.compareAt > product.price;
  const badge = onSale ? `−${Math.round((1 - product.price / product.compareAt!) * 100)}%` : product.isNew ? "New" : null;

  return (
    <article className="min-w-0">
      <div className="relative">
        {/* photos zoom in slightly on hover, or while pressed on touch screens (iOS only applies :active with a touch listener) */}
        <a
          href={href}
          target="_blank"
          rel="noopener"
          onTouchStart={() => {}}
          className="group relative block aspect-[3/4] overflow-hidden rounded-2xl bg-secondary"
        >
          <img src={sized(product.imageUrl, 540)} alt={product.title} loading="lazy" className="size-full object-cover transition duration-500 ease-out group-hover:scale-105 group-active:scale-105" />
          {/* second photo fades in on hover (desktop) */}
          {product.hoverImageUrl && (
            <img
              src={sized(product.hoverImageUrl, 540)}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover opacity-0 transition duration-500 ease-out group-hover:scale-105 group-active:scale-105 group-hover:opacity-100"
            />
          )}
          {badge && (
            <span
              className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                onSale ? "bg-destructive text-white" : "bg-card text-foreground"
              }`}
            >
              {badge}
            </span>
          )}
        </a>
        <div className="absolute inset-x-2 bottom-2 flex justify-between">
          {onSkip ? (
            <button onClick={onSkip} aria-label={skipLabel} title={skipLabel} className="grid size-9 place-items-center rounded-full bg-card/90 shadow">
              <XIcon className="size-4" />
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-1.5">
            <ListPicker productId={product.id} outfitId={outfitId} onAdd={onListed} />
            {onLike && (
              <button
                onClick={() => {
                  if (!liked) setHearted((n) => n + 1);
                  onLike();
                }}
                onTouchStart={() => {}} // lets iOS show the pressed state
                aria-label="Save"
                aria-pressed={liked}
                className={`${cardButton} ${liked ? "bg-destructive text-white" : "bg-card/90 hover:text-destructive"}`}
              >
                {/* springs in (with a burst) when tapped on, not when a page loads with it already hearted */}
                <HeartIcon key={hearted} className={`size-4 ${liked && hearted ? springIn : ""}`} fill={liked ? "currentColor" : "none"} />
                {liked && hearted > 0 && <span key={`burst-${hearted}`} className={`${burstRing} ring-destructive`} />}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="px-0.5 pt-2">
        <p className="text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">{product.store}</p>
        <a href={href} target="_blank" rel="noopener" className="block truncate text-sm">
          {product.title}
        </a>
        <p className="text-sm font-semibold">
          {onSale ? (
            <>
              <span className="text-destructive">{money(product.price)}</span>{" "}
              <s className="font-normal text-muted-foreground">{money(product.compareAt!)}</s>
            </>
          ) : (
            money(product.price)
          )}
        </p>
      </div>
    </article>
  );
}
