import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "Privacy · likewise" };

const EMAIL = "hello@lkws.au";

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Last updated 21 November 2026"
      title={
        <>
          Your <em className="text-[#6e4a35]">privacy</em>
        </>
      }
    >
      <div className="grid gap-8 text-[15px] leading-relaxed text-foreground/85 [&_h2]:mb-2 [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-1">
        <p className="text-base">
          likewise is operated by The Concept Lab (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains what personal information we collect when you use
          likewise, why, and the choices you have. We handle it in line with the Australian Privacy Principles in the Privacy Act 1988 (Cth).
        </p>

        <section>
          <h2>What we collect</h2>
          <ul>
            <li>
              <b>Your account:</b> your name, email address and password (stored scrambled, never in plain text). If you sign in with Google, we receive your name,
              email address and profile picture from Google.
            </li>
            <li>
              <b>Your searches and taste:</b> what you tell us you&apos;re shopping for, the links you paste, the photos you upload, and the pieces you heart, skip or save to collections.
            </li>
            <li>
              <b>Your activity:</b> when you tap a product to visit a store, we record which product, so we can understand what&apos;s useful.
            </li>
            <li>
              <b>Messages:</b> what you send us through the contact page, including your name and email address.
            </li>
            <li>
              <b>Technical information:</b> a sign-in cookie that keeps you logged in, and standard server logs (such as IP address and browser type) kept by our
              hosting providers for security.
            </li>
          </ul>
        </section>

        <section>
          <h2>Photos you upload</h2>
          <p>
            Before a photo leaves your device, it&apos;s resized and the hidden details your camera adds (such as location) are removed. We store it so you can see
            it in your results, and our style model turns it into a numeric &ldquo;fingerprint&rdquo; of its look to find similar clothing. We don&apos;t use your
            photos to identify you or anyone else, and we don&apos;t use facial recognition. We may mark a photo as likely personal (for example a selfie) so we
            can handle it with extra care. We keep uploaded photos after you remove them from your results, to help us improve likewise, and delete them when you
            ask us to.
          </p>
        </section>

        <section>
          <h2>How we use it</h2>
          <ul>
            <li>To run likewise: your account, your searches, and the feed of pieces we pick for you.</li>
            <li>To improve the service, for example looking at which stores and styles people link to so we can decide which stores to add.</li>
            <li>To reply when you contact us.</li>
            <li>To keep likewise secure and prevent misuse.</li>
          </ul>
          <p className="mt-2">We don&apos;t sell your personal information, and we don&apos;t use it for advertising.</p>
        </section>

        <section>
          <h2>Who we share it with</h2>
          <p>We use a small number of service providers to run likewise. They handle your information only to provide their service to us:</p>
          <ul className="mt-2">
            <li>Render: hosts the app and its database.</li>
            <li>Cloudflare: stores uploaded photos, handles our domain and email, and checks contact-form messages for spam (Turnstile).</li>
            <li>Modal: runs the style model that fingerprints your photos and links.</li>
            <li>GitHub: runs our scheduled jobs that update the catalogue.</li>
            <li>Google: if you choose Google sign-in.</li>
            <li>Resend: delivers contact-page messages to our inbox.</li>
          </ul>
          <p className="mt-2">
            Some of these providers store or process information outside Australia, including in the United States. When you tap through to a store, you leave
            likewise and that store&apos;s own privacy policy applies.
          </p>
        </section>

        <section>
          <h2>How long we keep it</h2>
          <p>
            We keep your information while you have an account. Uploaded photos are kept even after you remove them from an outfit. If you ask us to delete your
            photos or your account, we delete them, including every photo you&apos;ve uploaded.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
          <p>
            You can ask to see the personal information we hold about you, correct it, or delete it. Email us at{" "}
            <a href={`mailto:${EMAIL}`} className="underline">
              {EMAIL}
            </a>{" "}
            or use our{" "}
            <Link href="/contact" className="underline">
              contact page
            </Link>
            , and we&apos;ll respond within 30 days.
          </p>
        </section>

        <section>
          <h2>Cookies</h2>
          <p>We only use the cookie that keeps you signed in. We don&apos;t use advertising or tracking cookies.</p>
        </section>

        <section>
          <h2>Complaints</h2>
          <p>
            If you&apos;re unhappy with how we&apos;ve handled your information, please contact us first so we can put it right. If you&apos;re not satisfied with
            our response, you can complain to the Office of the Australian Information Commissioner (OAIC) at{" "}
            <a href="https://www.oaic.gov.au" className="underline">
              oaic.gov.au
            </a>{" "}
            or on 1300 363 992.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>If we change this policy, we&apos;ll update it here and change the date at the top.</p>
        </section>
      </div>
    </PageShell>
  );
}
