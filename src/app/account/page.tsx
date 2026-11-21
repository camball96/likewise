"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Status = { ok: boolean; text: string } | null;

// The signed-in user's details: name, email (with confirming and changing it) and password.
// Google-only accounts can add a password through the reset-password email. (Delete account will live here too.)
export default function AccountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, refetch } = authClient.useSession();
  const [methods, setMethods] = useState<string[] | null>(null); // "credential" (email + password), "google"
  useEffect(() => {
    authClient.listAccounts().then(({ data }) => setMethods(data?.map((a) => a.providerId) ?? []));
  }, []);

  const user = session?.user;
  return (
    <main className="mx-auto max-w-2xl px-6 pt-8 pb-16">
      <Link href="/" className="font-heading text-3xl font-semibold">
        like<em className="text-[#6e4a35]">wise</em>
      </Link>
      <Link href="/welcome" className="mt-10 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Back to your results
      </Link>
      <p className="eyebrow mt-6">Your account</p>
      <h1 className="mt-3 font-heading text-5xl leading-[1.05] font-semibold">Account</h1>

      {user && methods && (
        <div className="mt-8 grid gap-6">
          <NameSection name={user.name} onSaved={refetch} />
          <EmailSection email={user.email} verified={user.emailVerified} onChanged={refetch} />
          <PasswordSection email={user.email} hasPassword={methods.includes("credential")} withGoogle={methods.includes("google")} />
          <Button variant="outline" className="w-fit" onClick={async () => {
              await authClient.signOut();
              queryClient.clear(); // forget this account's results and collections, so the next sign-in starts fresh
              router.replace("/");
            }}>
            Sign out
          </Button>
        </div>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel grid gap-4">
      <h2 className="font-heading text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Message({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p role={status.ok ? "status" : "alert"} className={`text-sm ${status.ok ? "text-muted-foreground" : "text-destructive"}`}>
      {status.text}
    </p>
  );
}

function NameSection({ name, onSaved }: { name: string; onSaved: () => void }) {
  const [value, setValue] = useState(name);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await authClient.updateUser({ name: value.trim() });
    setBusy(false);
    setStatus(error ? { ok: false, text: error.message ?? "Couldn't save that. Please try again." } : { ok: true, text: "Saved." });
    if (!error) onSaved();
  }

  return (
    <Section title="Name">
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-2">
        <Label htmlFor="name">Your name</Label>
        <div className="flex gap-2">
          <Input id="name" value={value} onChange={(e) => setValue(e.target.value)} required maxLength={80} autoComplete="name" />
          <Button type="submit" disabled={busy || value.trim() === name}>
            Save
          </Button>
        </div>
        <Message status={status} />
      </form>
    </Section>
  );
}

function EmailSection({ email, verified, onChanged }: { email: string; verified: boolean; onChanged: () => void }) {
  const [newEmail, setNewEmail] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/account" });
    setStatus(error ? { ok: false, text: error.message ?? "Couldn't send it. Please try again." } : { ok: true, text: `Sent. Check ${email} for the link.` });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const to = newEmail.trim().toLowerCase();
    setBusy(true);
    const { error } = await authClient.changeEmail({ newEmail: to, callbackURL: "/account" });
    setBusy(false);
    if (error) return setStatus({ ok: false, text: error.message ?? "Couldn't change it. Please try again." });
    setNewEmail("");
    // a confirmed email only switches once the new address is confirmed; an unconfirmed one switches now
    setStatus({
      ok: true,
      text: verified
        ? `We've sent a link to ${to}. Your email changes once you tap it.`
        : `Your email is now ${to}. We've sent it a link to confirm it.`,
    });
    onChanged();
  }

  return (
    <Section title="Email">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="font-medium">{email}</span>
        {verified ? (
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-[#6e4a35]">
            <CheckIcon className="size-3" /> Confirmed
          </span>
        ) : (
          <>
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">Not confirmed</span>
            <button type="button" className="text-xs underline" onClick={resend}>
              Send the confirmation link again
            </button>
          </>
        )}
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-2">
        <Label htmlFor="new-email">Change email</Label>
        <div className="flex gap-2">
          <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email address" required autoComplete="email" />
          <Button type="submit" disabled={busy || !newEmail.trim()}>
            Change
          </Button>
        </div>
      </form>
      <Message status={status} />
    </Section>
  );
}

function PasswordSection({ email, hasPassword, withGoogle }: { email: string; hasPassword: boolean; withGoogle: boolean }) {
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  async function change(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setBusy(true);
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get("current")),
      newPassword: String(form.get("new")),
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) return setStatus({ ok: false, text: error.message ?? "Couldn't change it. Please try again." });
    formEl.reset();
    setStatus({ ok: true, text: "Password changed. You've been signed out on your other devices." });
  }

  // Google-only accounts: the reset email adds a password to the account
  async function sendSetLink() {
    setBusy(true);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setBusy(false);
    setStatus(error ? { ok: false, text: error.message ?? "Couldn't send it. Please try again." } : { ok: true, text: `Sent. Check ${email} for a link to choose a password.` });
  }

  return (
    <Section title="Password">
      <p className="-mt-2 text-sm text-muted-foreground">
        You sign in with {[withGoogle && "Google", hasPassword && "your email and password"].filter(Boolean).join(" or ") || "your email"}.
      </p>
      {hasPassword ? (
        <form onSubmit={change} className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="current">Current password</Label>
            <Input id="current" name="current" type="password" required autoComplete="current-password" />
            <Link href={`/reset-password?email=${encodeURIComponent(email)}`} className="w-fit text-xs text-muted-foreground underline">
              Forgot it?
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="new">New password</Label>
            <Input id="new" name="new" type="password" minLength={8} required autoComplete="new-password" />
          </div>
          <Button type="submit" className="w-fit" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </Button>
        </form>
      ) : (
        <div>
          <p className="text-sm">Want to sign in with your email too? We&apos;ll email you a link to choose a password.</p>
          <Button className="mt-3" variant="outline" onClick={sendSetLink} disabled={busy}>
            Email me a link
          </Button>
        </div>
      )}
      <Message status={status} />
    </Section>
  );
}
