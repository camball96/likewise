"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordPage />
    </Suspense>
  );
}

// Two steps on one page: ask for the reset email ("Forgot password?" on the sign-in page, or "Set a password"
// on the account page), then choose a new password from the emailed link, which lands here with ?token=.
// An expired or used link comes back with ?error=INVALID_TOKEN.
function ResetPasswordPage() {
  const params = useSearchParams();
  const token = params.get("token");
  return (
    <main className="grid min-h-screen place-items-center px-6 py-16">
      <div className="grid w-full max-w-md gap-8">
        <Link href="/" className="font-heading text-3xl font-semibold">
          like<em className="text-[#6e4a35]">wise</em>
        </Link>
        {token ? <NewPassword token={token} /> : <RequestLink email={params.get("email") ?? ""} expired={params.get("error") === "INVALID_TOKEN"} />}
      </div>
    </main>
  );
}

function RequestLink({ email, expired }: { email: string; expired: boolean }) {
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState(expired ? "That link has expired or was already used. Send yourself a new one below." : "");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const to = String(new FormData(e.currentTarget).get("email"));
    setBusy(true);
    setError("");
    const { error } = await authClient.requestPasswordReset({ email: to, redirectTo: "/reset-password" });
    setBusy(false);
    if (error) return setError(error.message ?? "Something went wrong. Please try again.");
    setSentTo(to);
  }

  if (sentTo) {
    return (
      <div className="panel grid gap-3">
        <h1 className="font-heading text-3xl font-semibold">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">
          If there&apos;s a likewise account for <span className="text-foreground">{sentTo}</span>, we&apos;ve sent it a link to choose a new
          password. It works for the next hour, and might take a minute to arrive (check your junk folder too).
        </p>
        <Link href="/sign-in" className="mt-2 text-sm text-muted-foreground underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel grid grid-cols-1 gap-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={email} required autoFocus />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Sending…" : "Send reset link"}
      </Button>
      <Link href="/sign-in" className="text-center text-sm text-muted-foreground underline">
        Back to sign in
      </Link>
    </form>
  );
}

function NewPassword({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword !== String(form.get("confirm"))) return setError("Those passwords don't match.");
    setBusy(true);
    setError("");
    const { error } = await authClient.resetPassword({ newPassword, token });
    setBusy(false);
    if (error) return setError(error.message ?? "Something went wrong. Please try again.");
    router.replace("/sign-in?reset=done"); // resetting signs out every device, so sign in again
  }

  return (
    <form onSubmit={onSubmit} className="panel grid grid-cols-1 gap-5">
      <div>
        <h1 className="font-heading text-3xl font-semibold">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">At least 8 characters. You&apos;ll be signed out on your other devices.</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" minLength={8} required autoFocus autoComplete="new-password" />
      </div>
      <div className="grid grid-cols-1 gap-2">
        <Label htmlFor="confirm">Type it again</Label>
        <Input id="confirm" name="confirm" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
