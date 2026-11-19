"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Steps } from "@/components/steps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setBusy(true);
    setError("");
    const { error } =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: String(form.get("name")) });
    setBusy(false);
    if (error) return setError(error.message ?? "Something went wrong");
    router.replace("/");
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-16">
      <div className="grid w-full max-w-5xl items-center gap-12 md:grid-cols-2">
        <section className="mx-auto max-w-md">
          <p className="font-heading text-3xl font-semibold">
            like<em className="text-[#6e4a35]">wise</em>
          </p>
          <p className="eyebrow mt-10">Australian fashion, matched to you</p>
          <h1 className="mt-3 font-heading text-5xl leading-[1.05] font-semibold sm:text-6xl">
            Clothes you&apos;ll <em className="text-[#6e4a35]">actually</em> love
          </h1>
          <p className="mt-4 text-muted-foreground">
            Show us a few pieces you love and we&apos;ll find more like them across 29 Australian stores, ranked by how they look.
          </p>
          <Steps className="mt-6 max-md:hidden" />
        </section>

        <div className="panel mx-auto grid w-full max-w-md gap-5">
          <h2 className="font-heading text-3xl font-semibold">{mode === "sign-in" ? "Welcome back" : "Create your account"}</h2>

          <Button variant="outline" size="lg" onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="grid gap-4">
            {mode === "sign-up" && (
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" disabled={busy}>
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button className="text-sm text-muted-foreground underline" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>
            {mode === "sign-in" ? "New here? Create an account" : "Have an account? Sign in"}
          </button>
        </div>
      </div>
    </main>
  );
}
