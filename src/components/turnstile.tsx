"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile: a privacy-friendly spam check (usually invisible, sometimes a single click).
// Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; the server only checks tokens when TURNSTILE_SECRET_KEY is set.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = { render: (el: HTMLElement, options: object) => string; remove: (id: string) => void };
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function loadScript(): Promise<TurnstileApi> {
  return new Promise((resolve) => {
    if (window.turnstile) return resolve(window.turnstile);
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve(window.turnstile!));
  });
}

// onToken gets the token once the check passes, and "" when it expires or fails. Remount (change `key`) to get a fresh check.
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  });

  useEffect(() => {
    if (!SITE_KEY) return;
    let id: string | undefined;
    let cancelled = false;
    loadScript().then((turnstile) => {
      if (cancelled || !box.current) return;
      id = turnstile.render(box.current, {
        sitekey: SITE_KEY,
        theme: "light",
        callback: (token: string) => callback.current(token),
        "expired-callback": () => callback.current(""),
        "error-callback": () => callback.current(""),
      });
    });
    return () => {
      cancelled = true;
      if (id) window.turnstile?.remove(id);
    };
  }, []);

  return SITE_KEY ? <div ref={box} className="min-h-[65px]" /> : null;
}

export const turnstileEnabled = Boolean(SITE_KEY);
