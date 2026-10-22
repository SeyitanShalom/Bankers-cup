# Google Analytics 4

## Implementation

This project uses Next.js 16 App Router (`src/app/layout.tsx`), npm and Netlify's
Next.js adapter. The root layout mounts one consent-controlled `GoogleAnalytics`
component from `@next/third-parties/google`, pinned to the existing Next.js version.
No GTM container or second Google tag is needed. Layout metadata, fonts, public
football components, Supabase integration and `netlify.toml` are preserved.

`NEXT_PUBLIC_GA_ID` must contain a GA4 web stream Measurement ID: `G-` followed by
10 uppercase letters or digits. Whitespace around it is trimmed. An empty or
malformed value disables both Analytics and its consent controls. Validation
checks the format; it cannot verify that the stream belongs to your account.

GA4 owns automatic page views. There are no manual `page_view` events or route
effects, which would double-count visits with Enhanced Measurement enabled.
The initial page view happens when consent is granted, not before it. Earlier
visits in that browsing session are not backfilled.

Fixtures (`/fixtures`), matches (`/matches/[matchId]`), teams (`/teams` and
`/teams/[teamId]`), standings (`/standings`) and statistics (`/stats`) already have
page URLs. Page views measure these without redundant custom events. There is
no public player-profile route or public search/filter control to instrument.
Admin form contents and Supabase account data are never explicitly sent to GA.

The existing CSP now permits Google's tag script and analytics connections,
following Google's analytics-only CSP guidance. Its other restrictions remain.

## Consent and privacy

There was no existing cookie/consent system. This implementation blocks all
Google Analytics code and requests until the visitor selects **Allow analytics**
(basic consent mode). The equally presented **Decline analytics** option leaves
the site fully functional. Advertising storage, user data and personalization
remain denied; Google signals and advertising personalization are disabled.

The choice is stored locally for 180 days under
`bankers-cup-analytics-consent-v1`. No server consent record is created. Storage
failures fall back to a choice in memory. **Analytics settings** in the footer
reopens the controls. Withdrawal sets Google's `ga-disable` flag immediately,
deletes accessible `_ga`/`_ga_*` cookies for this host and parent domain scopes,
and reloads the document to remove Google's listeners and timers. Changes in
other tabs are synchronized. Previously collected data is not deleted.

`/privacy` explains this analytics behavior. Before enabling production tracking,
the site operator should review the notice alongside its complete privacy
policy, including operator identity/contact, retention, Google processing and
international transfers, visitor rights, and any jurisdiction-specific consent
or consent-record requirements. This analytics notice is not a complete policy
for tournament administration or account processing.

No custom event includes names, email addresses, phone numbers, authentication
data or form values. Automatic GA collection includes page URLs/referrers, so do
not put personal data or authentication tokens in URLs or campaign labels.
The existing `/admin` path is also part of the root layout: a consenting browser
can record generic admin page views. Do not enable automatic form, search or
outbound-link measurement as part of this traffic-only setup (see below).

## Obtain and configure the GA4 stream

1. Open Google Analytics and select your GA4 property. If you do not have one,
   create an account/property, then a **Web** data stream for your real website URL.
2. Go to **Admin > Data collection and modification > Data streams > Web**, and
   select your stream. Copy its **Measurement ID** (`G-...`), not its numeric
   stream/property ID or a `GTM-...` container ID.
3. In **Enhanced measurement > settings**, keep **Page views** enabled and expand
   its advanced settings. Enable **Page changes based on browser history events**.
   This is required for Next.js client-side links and browser Back/Forward.
4. For this traffic-only integration, disable **Form interactions**, **Site
   search**, and **Outbound clicks**. Other optional Enhanced Measurement features
   can stay off until you decide to use them. Do not add another GA tag via GTM,
   Netlify script injection, or the browser console.
5. Under the stream's **Redact data** settings, enable email redaction and redact
   any personal/sensitive query parameter keys used by your links (for example,
   `email`, `phone`, `name`, `token`, `access_token`, `refresh_token`, `code`).
   Redaction is an extra precaution, not a replacement for keeping secrets out
   of URLs. Keep campaign parameters such as `utm_source` non-personal.
6. Review property data retention, data sharing and internal-traffic filtering.
   Keep Google Ads/Signals and user-provided-data collection off for this setup.

## Local configuration

Add this line to the existing, ignored `.env.local`, substituting your ID:

```dotenv
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

`G-XXXXXXXXXX` is only an example. This public identifier is included in browser
code by Next.js; it is not a secret. Keep all existing Supabase values intact.
Never copy service-role keys, database credentials or your whole `.env.local`
into documentation, source code, chat or analytics settings.

Restart `npm run dev` after changing the variable. To disable Analytics, leave
the value blank and restart/rebuild. `.env.example` intentionally has no real ID.

## Netlify deployment

1. Open your existing Netlify project.
2. Go to **Project configuration > Environment variables > Add a variable > Add
   a single variable**.
3. Set the key to **`NEXT_PUBLIC_GA_ID`**, and paste your GA4 Measurement ID as the
   value. Include the **Builds** scope if your plan offers scope controls; the
   default all-scopes setting also works. This is a public browser identifier.
4. Set the value for **Production**. Leave Deploy Previews/branch deploys unset
   or use a separate test property to keep test visits out of production reports.
5. Save. Commit/push these code changes to the project's existing deploy branch,
   or use its established deployment workflow. If the code is already deployed,
   use **Deploys > Trigger deploy > Deploy site** to rebuild with the new value.
6. Wait for the deploy to succeed and be published. Next.js embeds `NEXT_PUBLIC_*`
   values at build time; saving the variable alone does not update a deployment.

Keep the current build command `npm run build`, publish directory `.next`,
Node 22, and `NETLIFY_NEXT_SKEW_PROTECTION=true`. No `netlify.toml` change is needed.
No Netlify or Google dashboard settings were changed by this implementation.

## Verify after deployment

1. Open the published website in a clean browser profile. Disable any tracker
   blocker for your test. In DevTools > Network, filter for `gtag` and `collect`:
   there should be no Analytics script or collection requests before consent.
   Decline, reload and navigate; this should remain true.
2. Open **Analytics settings** and allow analytics. There should be one
   `gtag/js?id=G-...` script and one initial `page_view` event. Requests may batch
   events, so count `page_view` payloads, not just network rows. Check for CSP and
   hydration errors in the console.
3. Use the site's links to navigate Home > Fixtures > a match > Teams > a team >
   Standings > Stats. Test browser Back/Forward. Expect one `page_view` per actual
   page transition and no second config. Navigating to the same URL should not
   count as a new page. Live-score polling should not produce page views.
4. In **GA4 > Reports > Realtime**, confirm your active visitor and page/event
   activity. Reports such as Pages and screens, Traffic acquisition, User
   attributes and Tech provide pages, sources, geography and device categories.
   Standard users/new users, sessions and engagement metrics need no custom
   event code. Geography depends on Google's available precision and thresholds;
   engagement time measures active engagement, not all elapsed time on a tab.
5. For event-level inspection, connect your own browser using
   [Google Tag Assistant](https://tagassistant.google.com/), allow analytics, and
   open **Admin > Data display > DebugView**. Inspect each `page_view` and its
   `page_location`/`page_referrer`. Do not enable debug mode for all visitors.
6. Reopen Analytics settings and decline. The page reloads, GA cookies should be
   removed, and new navigation should send no Analytics traffic. Re-allow and
   confirm exactly one new initial page view. Repeat on mobile and another tab.
7. Check that forms, phone/email links, and admin authentication produce no
   custom analytics events or personal event parameters. Standard reports may
   take 24-48 hours to populate; Realtime and DebugView are the initial checks.

Counts reflect consenting, unblocked browsers. They will not include every visit.

## Validation performed during implementation

- `npm.cmd run lint`, `node node_modules/typescript/bin/tsc --noEmit`, and
  `npm.cmd run build` passed.
- Chrome checks used a synthetic Measurement ID and a stubbed Google tag: no
  real analytics hits were sent. Verified consent/default ordering, one
  script/config through client navigation and Back/Forward, persisted decline,
  withdrawal and cookie cleanup, re-consent, cross-tab withdrawal, blocked
  localStorage, and a 390px mobile viewport. No hydration or CSP errors occurred
  in the checked analytics flow.
- Missing and malformed Measurement IDs were checked in the browser: no prompt,
  settings control, Google tag or Google requests appeared.
- The enabled navigation check used the existing local-data mode in an isolated
  process; no saved environment files or tournament data were changed. It covered
  fixtures, a team detail, standings and statistics. The local dataset had no
  match link, so a match-detail click was not exercised. Hosted Supabase behavior
  was not verified.
- A production response served the privacy page successfully with the expected
  CSP. Live Google page-view delivery, Enhanced Measurement settings, GA4
  Realtime/DebugView, and the Netlify deployment still require the checks above.

## Official references

- [Next.js Google Analytics integration and automatic page views](https://nextjs.org/docs/app/guides/third-party-libraries#google-analytics)
- [GA4 Measurement ID](https://support.google.com/analytics/answer/12270356)
- [Enhanced Measurement settings](https://support.google.com/analytics/answer/9216061)
- [Basic consent mode](https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic)
- [Google privacy parameters and disabling analytics](https://developers.google.com/tag-platform/security/guides/privacy)
- [Google Analytics CSP requirements](https://developers.google.com/tag-platform/security/guides/csp#google_analytics)
- [Data redaction](https://support.google.com/analytics/answer/13544947)
- [Netlify environment variables](https://docs.netlify.com/build/environment-variables/get-started/)
- [DebugView and Tag Assistant](https://support.google.com/analytics/answer/7201382)
