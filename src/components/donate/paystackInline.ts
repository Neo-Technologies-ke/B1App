"use client";

// Lazily injects Paystack's Inline checkout script exactly once per page, caching the
// in-flight promise so concurrent donate attempts don't race multiple <script> tags.
declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: PaystackSetupOptions) => { openIframe: () => void };
    };
  }
}

export interface PaystackSetupOptions {
  key: string;
  email: string;
  amount: number; // smallest currency unit (e.g. cents/kobo)
  currency?: string;
  ref?: string;
  channels?: string[];
  metadata?: Record<string, unknown>;
  callback: (response: { reference: string }) => void;
  onClose: () => void;
}

const PAYSTACK_SCRIPT_SRC = "https://js.paystack.co/v1/inline.js";
let paystackScriptPromise: Promise<void> | null = null;

export function loadPaystackInlineScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Paystack checkout is only available in the browser."));
  if (window.PaystackPop) return Promise.resolve();
  if (paystackScriptPromise) return paystackScriptPromise;

  paystackScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PAYSTACK_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Paystack checkout script.")));
      return;
    }
    const script = document.createElement("script");
    script.src = PAYSTACK_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Paystack checkout script."));
    document.head.appendChild(script);
  }).catch((err) => {
    // Allow a later attempt to retry after a network hiccup instead of caching a failure forever.
    paystackScriptPromise = null;
    throw err;
  });

  return paystackScriptPromise;
}

export function generatePaystackReference(churchId: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `b1-${churchId || "church"}-${Date.now()}-${random}`.slice(0, 100);
}
