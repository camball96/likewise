"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OutfitForm } from "@/components/outfit-form";
import { Steps } from "@/components/steps";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

// Opens the first outfit, or walks a new user through creating one.
export default function Home() {
  const trpc = useTRPC();
  const router = useRouter();
  const session = authClient.useSession();
  const outfits = useQuery(trpc.outfits.list.queryOptions());
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const first = outfits.data?.[0];

  useEffect(() => {
    if (first) router.replace(`/outfits/${first.id}`);
  }, [first, router]);

  if (!outfits.data || first) return null;
  const firstName = session.data?.user.name?.split(" ")[0];

  return (
    <main className="grid min-h-screen place-items-center overflow-hidden px-6 py-16">
      {/* the right-hand column grows from nothing when the form opens */}
      <div
        className={`grid w-full max-w-5xl items-center gap-10 transition-[grid-template-columns] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] md:gap-0 ${
          open ? "md:grid-cols-[1fr_1fr]" : "md:grid-cols-[1fr_0fr]"
        }`}
      >
        <section className="mx-auto max-w-md">
          <p className="eyebrow">Welcome{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="mt-3 font-heading text-5xl leading-[1.05] font-semibold sm:text-6xl">
            Start your first <em className="text-[#6e4a35]">outfit</em>
          </h1>
          <p className="mt-4 text-muted-foreground">
            An outfit is a look you&apos;re shopping for, like &ldquo;Formal dresses&rdquo; or &ldquo;PJs&rdquo;. Show us a few pieces you love and we&apos;ll
            build an edit of pieces chosen just for you.
          </p>
          <Steps className="mt-6" />
          <Button
            size="lg"
            onClick={() => {
              setOpen(true);
              // on phones the form opens below the text, so bring it into view
              setTimeout(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
            }}
            className={`mt-8 transition-opacity duration-300 ${open ? "pointer-events-none opacity-0 max-md:hidden" : ""}`}
          >
            Create an outfit <ArrowRightIcon />
          </Button>
        </section>

        <div ref={panel} className={`min-w-0 overflow-hidden ${open ? "" : "hidden md:block"}`} inert={!open}>
          <div
            className={`mx-auto max-w-md p-4 transition duration-500 md:w-[28rem] ${open ? "translate-x-0 opacity-100 delay-200" : "translate-x-10 opacity-0"}`}
          >
            <OutfitForm onCancel={() => setOpen(false)} />
          </div>
        </div>
      </div>
    </main>
  );
}
