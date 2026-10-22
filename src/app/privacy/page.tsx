import type { Metadata } from "next";
import { AnalyticsSettingsButton } from "@/components/analytics";

export const metadata: Metadata = {
  title: "Analytics privacy | Bankers Cup",
  description: "How optional Google Analytics measurement works on the Bankers Cup website.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-zinc-700 sm:px-6">
      <h1 className="text-3xl font-black text-zinc-950">Analytics and privacy</h1>
      <p>
        We use optional Google Analytics 4 to understand visits to the Bankers Cup website.
        Google Analytics only loads after you select Allow analytics. Declining does not
        affect fixtures, results, standings, team information or other website features.
      </p>
      <section className="space-y-2">
        <h2 className="text-xl font-bold text-zinc-950">What analytics measures</h2>
        <p>
          After you opt in, Google processes page URLs, referring websites and campaign
          information, device and browser information, approximate geographic location,
          and engagement with pages. Analytics cookies such as _ga and _ga_* use identifiers
          to distinguish browsers and sessions. Location is approximate; this website does
          not request your device&apos;s precise location for analytics.
        </p>
        <p>
          We do not add names, phone numbers, email addresses, account identifiers, passwords,
          or form contents to analytics events. Advertising consent stays disabled.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold text-zinc-950">Your choice</h2>
        <p>
          We remember your choice in this browser&apos;s local storage for up to 180 days.
          You can change it using Analytics settings in the footer. Withdrawing consent
          stops measurement, removes accessible Google Analytics cookies for this website,
          and reloads the page. It does not delete data previously collected by Google.
          Clearing browser storage resets your choice. If storage is unavailable, your
          choice applies to the current page session.
        </p>
        <div className="font-bold text-emerald-800 underline"><AnalyticsSettingsButton /></div>
      </section>
      <p>
        Google processes analytics data under its{" "}
        <a href="https://policies.google.com/privacy" className="font-bold text-emerald-800 underline">
          Privacy Policy
        </a>. See also{" "}
        <a href="https://policies.google.com/technologies/partner-sites" className="font-bold text-emerald-800 underline">
          how Google uses information from partner sites
        </a>.
      </p>
      <p className="text-sm text-zinc-500">
        This notice covers optional audience analytics. Tournament administration and
        account access are separate website functions.
      </p>
    </main>
  );
}
