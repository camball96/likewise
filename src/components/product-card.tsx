import { HeartIcon, XIcon } from "lucide-react";

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

// Shopify CDNs resize on the fly via ?width=
const sized = (url: string, w: number) => `${url}${url.includes("?") ? "&" : "?"}width=${w}`;
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function ProductCard({
  product,
  outfitId,
  liked,
  onLike,
  onSkip,
}: {
  product: CardProduct;
  outfitId: string;
  liked: boolean;
  onLike: () => void;
  onSkip?: () => void;
}) {
  const href = `/go/${product.id}?outfit=${outfitId}`;
  const onSale = product.compareAt && product.compareAt > product.price;
  const badge = onSale ? `−${Math.round((1 - product.price / product.compareAt!) * 100)}%` : product.isNew ? "New" : null;

  return (
    <article className="min-w-0">
      <div className="relative">
        <a href={href} target="_blank" rel="noopener" className="group relative block aspect-[3/4] overflow-hidden rounded-2xl bg-secondary">
          <img src={sized(product.imageUrl, 540)} alt={product.title} loading="lazy" className="size-full object-cover" />
          {/* second photo fades in on hover (desktop) */}
          {product.hoverImageUrl && (
            <img
              src={sized(product.hoverImageUrl, 540)}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
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
            <button onClick={onSkip} aria-label="Not for me" className="grid size-9 place-items-center rounded-full bg-card/90 shadow">
              <XIcon className="size-4" />
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onLike}
            aria-label="Save"
            className={`grid size-9 place-items-center rounded-full shadow ${liked ? "bg-destructive text-white" : "bg-card/90"}`}
          >
            <HeartIcon className="size-4" fill={liked ? "currentColor" : "none"} />
          </button>
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
