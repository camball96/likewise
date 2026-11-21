import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "Terms of Use · likewise" };

const EMAIL = "hello@lkws.au";

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Last updated 21 November 2026"
      title={
        <>
          Terms of <em className="text-[#6e4a35]">use</em>
        </>
      }
    >
      <div className="grid gap-8 text-[15px] leading-relaxed text-foreground/85 [&_h2]:mb-2 [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-1">
        <p className="text-base">
          likewise is operated by The Concept Lab (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using likewise, you agree to these terms and our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          . If you don&apos;t agree, please don&apos;t use likewise.
        </p>

        <section>
          <h2>What likewise is</h2>
          <p>
            likewise helps you discover clothing from Australian stores that looks like pieces you love. We don&apos;t sell anything ourselves: when you tap a product,
            you go to the store&apos;s own website, and any purchase is between you and that store, on its terms. We may earn a commission from some stores when
            you buy through likewise, at no extra cost to you.
          </p>
        </section>

        <section>
          <h2>Product information</h2>
          <p>
            Product names, photos, prices, sizes and stock come from each store and can change at any time. We do our best to keep them current, but the
            store&apos;s website is always the final word. Our picks are suggestions made by software, not personal styling advice.
          </p>
        </section>

        <section>
          <h2>Your account</h2>
          <ul>
            <li>You must be at least 16 to use likewise.</li>
            <li>Give us accurate details and keep your password safe. You&apos;re responsible for what happens under your account.</li>
            <li>Let us know straight away if you think someone else has used your account.</li>
          </ul>
        </section>

        <section>
          <h2>What you add</h2>
          <p>
            The links and photos you add stay yours. You give us permission to store, display and process them (including turning photos into style
            fingerprints) to run and improve likewise, as described in our Privacy Policy. Only add photos you have the right to use, and don&apos;t upload
            photos of other people without their permission.
          </p>
        </section>

        <section>
          <h2>Fair use</h2>
          <p>Please don&apos;t:</p>
          <ul className="mt-2">
            <li>upload anything unlawful, offensive, or that infringes someone else&apos;s rights</li>
            <li>scrape, copy or resell likewise or its content, or use automated tools to access it</li>
            <li>try to break, overload or get around the security of likewise</li>
            <li>use likewise to send spam or to mislead anyone</li>
          </ul>
          <p className="mt-2">We may remove content or suspend accounts that break these terms.</p>
        </section>

        <section>
          <h2>Our content</h2>
          <p>
            The likewise name, design and software belong to us. Product photos and descriptions belong to the stores and brands that publish them, and are shown
            to help you find their products.
          </p>
        </section>

        <section>
          <h2>Your rights under Australian law</h2>
          <p>
            Nothing in these terms limits any rights you have under the Australian Consumer Law. Apart from those rights, likewise is provided &ldquo;as is&rdquo;,
            and to the extent the law allows, we aren&apos;t liable for losses arising from your use of likewise, from stores&apos; products or websites, or from
            likewise being unavailable. Where our liability can&apos;t be excluded but can be limited, it&apos;s limited to supplying the service again.
          </p>
        </section>

        <section>
          <h2>Ending things</h2>
          <p>
            You can stop using likewise at any time, and ask us to delete your account by emailing{" "}
            <a href={`mailto:${EMAIL}`} className="underline">
              {EMAIL}
            </a>
            . We may change or stop likewise, or close accounts that break these terms.
          </p>
        </section>

        <section>
          <h2>Changes and law</h2>
          <p>
            If we update these terms, we&apos;ll change the date at the top; continuing to use likewise means you accept the update. These terms are governed by
            the laws of Queensland, Australia.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Questions about these terms? Email{" "}
            <a href={`mailto:${EMAIL}`} className="underline">
              {EMAIL}
            </a>{" "}
            or use our{" "}
            <Link href="/contact" className="underline">
              contact page
            </Link>
            .
          </p>
        </section>
      </div>
    </PageShell>
  );
}
