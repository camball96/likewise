import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { Providers } from "@/lib/trpc";
import "./globals.css";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
const serif = Cormorant_Garamond({ variable: "--font-serif", subsets: ["latin"], weight: ["500", "600"] });

// Link previews (iMessage, WhatsApp, Slack, socials) use these plus opengraph-image.png / twitter-image.png in this folder.
// The favicon is icon.svg (favicon.ico for older browsers, apple-icon.png for home screens).
const preview = {
  title: "likewise · Love a piece? We'll find more",
  description: "Show us what you love and we'll pick more like it from Australia's favourite women's fashion stores.",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://lkws.au"),
  title: "likewise",
  description: "Australian women's fashion, picked for your taste.",
  openGraph: { ...preview, siteName: "likewise", locale: "en_AU", type: "website" },
  twitter: { ...preview, card: "summary_large_image" },
  // added to an iPhone home screen: opens full screen with this name (the icon is apple-icon.png)
  appleWebApp: { capable: true, title: "likewise", statusBarStyle: "default" },
  verification: { other: { "commission-factory-verification": "d3f25358ac22409d863e693d9d8c19bc" } },
};

export const viewport: Viewport = { themeColor: "#f5efe6" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
