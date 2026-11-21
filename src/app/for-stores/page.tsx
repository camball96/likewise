import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "For stores · likewise" };

// Linked from our crawler's user agent, so store owners can see who we are and how to opt out.
export default function ForStoresPage() {
  return (
    <PageShell
      eyebrow="For stores and brands"
      title={
        <>
          How likewise works with <em className="text-[#6e4a35]">your store</em>
        </>
      }
    >
      <div className="grid gap-8 text-[15px] leading-relaxed text-foreground/85 [&_h2]:mb-2 [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-1">
        <p className="text-base">
          likewise helps shoppers in Australia find clothing that looks like pieces they already love. When someone taps one of your products, we send them
          straight to your website to buy it. We don&apos;t sell anything ourselves or take payments.
        </p>

        <section>
          <h2>What we show</h2>
          <p>
            Each product&apos;s name, price, sizes in stock and main photos, with a link to the product page on your site. Photos are shown from your own image
            servers, and we only show pieces that are in stock.
          </p>
        </section>

        <section>
          <h2>Our crawler</h2>
          <ul>
            <li>
              It identifies itself as <code className="rounded bg-secondary px-1.5 py-0.5 text-sm">likewise</code> in its user agent, with a link to this page.
            </li>
            <li>It reads your public product list about once a day, at most about one request per second.</li>
            <li>
              It follows your robots.txt. To stop it, add <code className="rounded bg-secondary px-1.5 py-0.5 text-sm">User-agent: likewise</code> and{" "}
              <code className="rounded bg-secondary px-1.5 py-0.5 text-sm">Disallow: /</code>, and your products stop appearing after its next visit.
            </li>
          </ul>
        </section>

        <section>
          <h2>Removals, corrections and partnerships</h2>
          <p>
            If you&apos;d like your store removed, something corrected, or to work with us on how your products appear, send us a{" "}
            <Link href="/contact?type=store" className="underline">
              store enquiry
            </Link>{" "}
            or email{" "}
            <a href="mailto:hello@lkws.au" className="underline">
              hello@lkws.au
            </a>
            . We remove stores within one business day of a request.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
