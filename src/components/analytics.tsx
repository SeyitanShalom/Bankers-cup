"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import Link from "@/components/navigation-link";
import Script from "next/script";
import { useEffect, useState, useSyncExternalStore } from "react";

const configuredId = process.env.NEXT_PUBLIC_GA_ID?.trim() ?? "";
const gaId = /^G-[A-Z0-9]{10}$/.test(configuredId) ? configuredId : null;
const consentKey = "bankers-cup-analytics-consent-v1";
const consentChanged = "bankers-cup-analytics-consent-changed";
const openSettings = "bankers-cup-analytics-settings";
const consentLifetime = 180 * 24 * 60 * 60 * 1000;
type Consent = "granted" | "denied" | null;
let sessionConsent: Consent = null;

function readConsent(): Consent {
  if (sessionConsent !== null) return sessionConsent;
  try {
    const saved = JSON.parse(localStorage.getItem(consentKey) ?? "null");
    if (
      saved &&
      (saved.value === "granted" || saved.value === "denied") &&
      typeof saved.expires === "number" &&
      saved.expires > Date.now()
    ) {
      return saved.value;
    }
  } catch {
    // A visitor can still choose for this page if browser storage is unavailable.
  }
  return sessionConsent;
}

function clearAnalyticsCookies() {
  const hostnameParts = window.location.hostname.split(".");
  const domains = ["", ...hostnameParts.map((_, index) => hostnameParts.slice(index).join("."))];

  for (const cookie of document.cookie.split(";")) {
    const name = cookie.trim().split("=")[0];
    if (name !== "_ga" && !name.startsWith("_ga_")) continue;

    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

function stopAnalytics() {
  if (!gaId) return;
  // Removing a React component cannot stop an already loaded Google tag.
  Object.assign(window, { [`ga-disable-${gaId}`]: true });
  clearAnalyticsCookies();
}

function subscribe(onChange: () => void) {
  function syncConsent() {
    if (gaId && readConsent() === "granted") {
      Object.assign(window, { [`ga-disable-${gaId}`]: false });
    } else {
      stopAnalytics();
    }
    onChange();
  }
  function syncStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== consentKey) return;
    sessionConsent = null;
    syncConsent();
    if (document.getElementById("_next-ga") && readConsent() !== "granted") {
      window.location.reload();
    }
  }
  window.addEventListener("storage", syncStorage);
  window.addEventListener(consentChanged, syncConsent);
  return () => {
    window.removeEventListener("storage", syncStorage);
    window.removeEventListener(consentChanged, syncConsent);
  };
}

// No Google code or network requests run until the visitor opts in. Advertising
// remains denied. These commands precede the official component's single config.
const privacyDefaults = `
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
  gtag('consent', 'default', {
    analytics_storage: 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied'
  });
  gtag('set', {allow_google_signals: false, allow_ad_personalization_signals: false});
  gtag('consent', 'update', {analytics_storage: 'granted'});
`;

export function AnalyticsSettingsButton() {
  if (!gaId) return null;
  return (
    <button
      type="button"
      className="cursor-pointer transition hover:text-emerald-700"
      onClick={() => window.dispatchEvent(new Event(openSettings))}
    >
      Analytics settings
    </button>
  );
}

export function Analytics() {
  const consent = useSyncExternalStore(subscribe, readConsent, () => null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const showSettings = () => setSettingsOpen(true);
    window.addEventListener(openSettings, showSettings);
    return () => window.removeEventListener(openSettings, showSettings);
  }, []);

  if (!gaId) return null;

  function chooseConsent(value: "granted" | "denied") {
    const tagLoaded = Boolean(document.getElementById("_next-ga"));
    if (value === "denied") stopAnalytics();
    sessionConsent = value;
    try {
      localStorage.setItem(consentKey, JSON.stringify({ value, expires: Date.now() + consentLifetime }));
      sessionConsent = null;
    } catch {
      // Keep the choice in memory when localStorage is blocked.
    }
    window.dispatchEvent(new Event(consentChanged));
    setSettingsOpen(false);
    // A fresh document removes Google's existing history listeners and timers.
    if (value === "denied" && tagLoaded) window.location.reload();
  }

  return (
    <>
      {consent === "granted" && (
        <>
          <Script id="ga-privacy-defaults" dangerouslySetInnerHTML={{ __html: privacyDefaults }} />
          {/* Enhanced Measurement owns page views, including client navigation.
              Do not add a second config, GTM tag, or manual page_view effect. */}
          <GoogleAnalytics gaId={gaId} />
        </>
      )}
      {(consent === null || settingsOpen) && (
        <section
          aria-label="Analytics preferences"
          className="fixed inset-x-0 bottom-0 z-50 max-h-[70dvh] overflow-y-auto border-t border-zinc-200 bg-white p-4 shadow-xl sm:p-6"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl text-sm text-zinc-600">
              <h2 className="mb-1 font-black text-zinc-950">Optional analytics</h2>
              <p>
                With your permission, we use Google Analytics cookies to understand visits,
                popular pages, devices and approximate locations. You can decline and use
                every website feature, or change your choice in Analytics settings. Read our{" "}
                <Link href="/privacy" className="font-bold text-emerald-800 underline">
                  analytics privacy notice
                </Link>.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" onClick={() => chooseConsent("denied")} className="cursor-pointer rounded-md border border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-zinc-100">
                Decline analytics
              </button>
              <button type="button" onClick={() => chooseConsent("granted")} className="cursor-pointer rounded-md border border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-zinc-100">
                Allow analytics
              </button>
              {consent !== null && (
                <button type="button" onClick={() => setSettingsOpen(false)} className="cursor-pointer rounded-md px-4 py-2 text-sm font-bold text-zinc-600 hover:bg-zinc-100">
                  Close
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
