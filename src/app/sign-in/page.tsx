"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { Steps } from "@/components/steps";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function Page() {
  return (
    <Suspense>
      <SignInPage />
    </Suspense>
  );
}

// Google sign-in failures come back here as ?error=<code> (errorCallbackURL below)
const GOOGLE_ERRORS: Record<string, string> = {
  account_not_linked:
    "This email already has a likewise account with a password. Sign in with your email and password below. Once you've confirmed your email (it's in your welcome email), Google sign-in will work too.",
  access_denied: "Google sign-in was cancelled.",
};

function SignInPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  // /sign-in?mode=sign-up (the landing page's buttons) opens on "Create your account"
  const [mode, setMode] = useState<"sign-in" | "sign-up">(params.get("mode") === "sign-up" ? "sign-up" : "sign-in");
  const googleError = params.get("error");
  const [error, setError] = useState(
    googleError ? (GOOGLE_ERRORS[googleError] ?? "Google sign-in didn't work. Please try again, or use your email and password.") : "",
  );
  const passwordReset = params.get("reset") === "done"; // back from /reset-password
  const [agreed, setAgreed] = useState(false); // terms + privacy, required to create an account
  const blocked = mode === "sign-up" && !agreed;
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
        : await authClient.signUp.email({ email, password, name: String(form.get("name")), callbackURL: "/welcome" });
    setBusy(false);
    if (error) return setError(error.message ?? "Something went wrong");
    queryClient.clear(); // nothing cached from a previous session carries over
    router.replace("/");
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-16">
      <div className="grid w-full max-w-5xl items-center gap-12 md:grid-cols-2">
        <section className="mx-auto max-w-md">
          <Link href="/" className="font-heading text-3xl font-semibold">
            like<em className="text-[#6e4a35]">wise</em>
          </Link>
          <p className="eyebrow mt-10">Australian fashion, chosen for you</p>
          <h1 className="mt-3 font-heading text-5xl leading-[1.05] font-semibold sm:text-6xl">
            Clothes you&apos;ll <em className="text-[#6e4a35]">actually</em> love
          </h1>
          <p className="mt-4 text-muted-foreground">
            Show us a few pieces you love and we&apos;ll hand-pick more like them from Australia&apos;s best stores, tailored to your taste.
          </p>
          <Steps className="mt-6 max-md:hidden" />
        </section>

        <div className="panel mx-auto grid grid-cols-1 w-full max-w-md gap-5">
          <h2 className="font-heading text-3xl font-semibold">{mode === "sign-in" ? "Welcome back" : "Create your account"}</h2>

          {mode === "sign-up" && (
            <label className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3 text-sm">
              <Checkbox checked={agreed} onCheckedChange={setAgreed} className="mt-0.5" />
              <span>
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="underline">
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          )}

          <Button variant="outline" size="lg" disabled={blocked} onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL: "/sign-in" })}>
            Continue with Google
          </Button>
          {/* Google can create an account from here too, for someone new */}
          {mode === "sign-in" && (
            <p className="-mt-3 text-center text-xs text-muted-foreground">
              New to likewise? Continuing with Google means you agree to our{" "}
              <Link href="/terms" className="underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
            {mode === "sign-up" && (
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
            )}
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "sign-in" && (
                  <Link href="/reset-password" className="text-xs text-muted-foreground underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            {passwordReset && !error && <p className="text-sm text-muted-foreground">Your password&apos;s been updated. Sign in with your new one.</p>}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={busy || blocked}>
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
