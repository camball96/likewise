"use client";

import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Turnstile, turnstileEnabled } from "@/components/turnstile";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

const KINDS = [
  { value: "GENERAL", label: "General enquiry", prompt: "How can we help?" },
  { value: "FEATURE", label: "Feature request", prompt: "What would make likewise better for you?" },
] as const;

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Contact"
      title={
        <>
          Get in <em className="text-[#6e4a35]">touch</em>
        </>
      }
    >
      <p className="mb-6 text-muted-foreground">
        Questions, problems or ideas for what we should build next: we read every message. You can also email{" "}
        <a href="mailto:hello@lkws.au" className="underline">
          hello@lkws.au
        </a>
        .
      </p>
      <Suspense>
        <ContactForm />
      </Suspense>
    </PageShell>
  );
}

function ContactForm() {
  const trpc = useTRPC();
  const send = useMutation(trpc.contact.mutationOptions());
  const session = authClient.useSession().data;
  // /contact?type=feature opens on a feature request
  const [kind, setKind] = useState<"GENERAL" | "FEATURE">(useSearchParams().get("type") === "feature" ? "FEATURE" : "GENERAL");
  const current = KINDS.find((k) => k.value === kind)!;
  const [token, setToken] = useState("");
  const [check, setCheck] = useState(0); // bumped to get a fresh spam check after a failed send

  // after a successful send, show the thank-you for a few seconds, then a fresh form
  const { isSuccess, reset } = send;
  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(() => {
      reset();
      setToken("");
    }, 6000);
    return () => clearTimeout(timer);
  }, [isSuccess, reset]);

  if (send.isSuccess) {
    return (
      <div className="panel">
        <p className="eyebrow">Message sent</p>
        <h2 className="mt-1 font-heading text-3xl font-semibold">{kind === "FEATURE" ? "Thanks for the idea" : "Thanks for getting in touch"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {kind === "FEATURE" ? "Every request helps us decide what to build next." : "We'll reply to your email as soon as we can."}
        </p>
      </div>
    );
  }

  return (
    <form
      className="panel grid grid-cols-1 gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        send.mutate(
          {
            kind,
            name: String(form.get("name")),
            email: String(form.get("email")),
            message: String(form.get("message")),
            website: String(form.get("website") ?? ""),
            turnstile: token,
          },
          {
            onError: () => {
              setToken("");
              setCheck((c) => c + 1);
            },
          },
        );
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              kind === k.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-1 gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={session?.user.name} required maxLength={100} />
        </div>
        <div className="grid grid-cols-1 gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={session?.user.email} required maxLength={200} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <Label htmlFor="message">{current.prompt}</Label>
        <textarea
          id="message"
          name="message"
          required
          maxLength={5000}
          rows={6}
          className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {/* hidden from people; bots that fill it in are ignored */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Turnstile key={check} onToken={setToken} />
      {send.error && (
        <p className="text-sm text-destructive">
          {send.error.data?.code === "BAD_REQUEST" ? send.error.message : "Something went wrong. Please try again, or email hello@lkws.au."}
        </p>
      )}
      <Button type="submit" size="lg" disabled={send.isPending || (turnstileEnabled && !token)}>
        {send.isPending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
