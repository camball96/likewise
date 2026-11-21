import type { MetadataRoute } from "next";

// Lets phone users add likewise to their home screen (see components/install-prompt.tsx).
// Opens at /welcome, which goes straight to their first results page (or sign-in).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "likewise",
    short_name: "likewise",
    description: "Australian women's fashion, picked for your taste.",
    start_url: "/welcome",
    display: "standalone",
    background_color: "#f5efe6",
    theme_color: "#f5efe6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
