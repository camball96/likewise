export { cn } from "cn"

// Product photos at a given width: Shopify's CDN resizes on the fly via ?width=
export const sized = (url: string, w: number) => `${url}${url.includes("?") ? "&" : "?"}width=${w}`;
