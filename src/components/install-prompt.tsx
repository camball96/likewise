"use client";

import { ShareIcon, SquarePlusIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// "Add to home screen" card for phone users, shown a few seconds into a visit.
// Android (Chrome, Samsung, Edge) gets a one-tap Install button; iPhone Safari can't be prompted,
// so it shows the two taps to do it by hand. Hidden once installed, in apps' built-in browsers
// (Instagram etc. can't install), and for 30 days after it's closed.
const DISMISSED_KEY = "likewise:install-dismissed";
const QUIET_FOR_MS = 30 * 24 * 60 * 60 * 1000;
const DELAY_MS = 4000;

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const phone = /iPhone|iPod|Android.*Mobile/i.test(ua);
    const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    const inAppBrowser = /Instagram|FBAN|FBAV|TikTok|Line\/|Snapchat/i.test(ua);
    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem(DISMISSED_KEY)) || 0;
    } catch {}
    if (!phone || installed || inAppBrowser || Date.now() - dismissedAt < QUIET_FOR_MS) return;

    // iPhone Safari only (other iPhone browsers can't add to the home screen the same way)
    const iosSafari = /iPhone|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    const timer = iosSafari ? setTimeout(() => setMode("ios"), DELAY_MS) : undefined;

    // Android: the browser offers this event when the site can be installed
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
      setTimeout(() => setMode("android"), DELAY_MS);
    };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function close() {
    setMode(null);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {}
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setMode(null);
    else close();
  }

  if (!mode) return null;
  return (
    <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500">
      <div role="dialog" aria-label="Add likewise to your home screen" className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-xl ring-1 ring-border">
        <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-heading text-xl leading-tight font-semibold">Add likewise to your home screen</p>
          {mode === "android" ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">Your picks, one tap away, like an app.</p>
              <Button size="sm" className="mt-3 rounded-full px-4" onClick={install}>
                Install
              </Button>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Tap <ShareIcon aria-label="Share" className="inline size-4 -translate-y-0.5 text-foreground" /> below, then{" "}
              <span className="whitespace-nowrap text-foreground">
                <SquarePlusIcon aria-hidden className="inline size-4 -translate-y-0.5" /> Add to Home Screen
              </span>
              .
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" className="-mt-1 -mr-1 shrink-0" onClick={close}>
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
