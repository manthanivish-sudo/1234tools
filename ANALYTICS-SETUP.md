# Turning analytics on

The code is finished and tested. Nothing is emitted because `CONFIG` at the top of
`build-site.js` has no ids. This is the account work only you can do, then one
paste and one command.

Work through it in order. Steps 1–3 are dashboards, step 4 is the paste and build,
step 5 proves it works. Budget about 40 minutes.

**Two dashboard settings are not optional** — the published privacy page already
states them as fact, so they must be true before you push:

| Published claim | Where you make it true |
|---|---|
| "Google Analytics data is retained for 14 months" | GA4 → Data retention → 14 months (step 1.4) |
| "every form field … masked before it is recorded" | Clarity → Masking → **Strict** (step 2.3) |

---

## Step 1 — Google Analytics 4

### 1.1 Create the property

1. Go to <https://analytics.google.com> and sign in with the Google account you
   want to own this long-term. Whichever account you pick becomes the owner; moving
   a property between accounts later is possible but tedious. Use the account that
   also owns Search Console.
2. **Admin** (gear, bottom-left) → **Create** → **Property**.
3. Property name `1234Tools`. Reporting time zone and currency: pick the ones you
   actually think in. The time zone decides where a "day" ends in every report, and
   changing it later leaves a permanent seam in the data.
4. Business details: size and industry. Only affects Google's suggestions.
5. Business objectives: choose **Examine user behaviour**. Picking a
   lead-generation or sales objective makes GA4 surface advertising reports you
   have no data for, because ad signals are permanently denied here.

### 1.2 Create the web data stream

1. Platform → **Web**.
2. Website URL: `https://www.1234tools.com` — with the `www`, that is what the
   `CNAME` file serves.
3. Stream name: `1234Tools web`.
4. Leave **Enhanced measurement** on for now; step 1.3 trims it.
5. **Create stream.** The panel shows a **Measurement ID** like `G-ABCD123XYZ`.
   Copy it. If you close the panel: Admin → **Data streams** → click the stream.

### 1.3 Trim enhanced measurement

In the stream, click the gear on the **Enhanced measurement** card. Turn **off**:

- **File downloads** — every PDF tool triggers a download named after the visitor's
  own file (`payslip-march.pdf`, `invoice-acme.pdf`). GA4's trigger keys off the
  link URL's extension and these are `blob:` URLs with no extension, so in practice
  it should never fire — but "should never fire" is a weak guarantee to rest a
  privacy promise on, and the event carries a `file_name` parameter. Turn it off
  and the question cannot arise.
- **Form interactions** — the tools are forms. This fires `form_start` on every
  keystroke session and buries the page data in noise. It captures no field values,
  so this is a signal-quality call, not a privacy one.

Leave on: page views, scrolls, outbound clicks, video (never fires), site search
(never fires either — search here is client-side and puts nothing in the URL).

### 1.4 Property settings that matter

All under **Admin**:

- **Data collection and modification → Data retention** → **Event data retention:
  14 months**. Default is 2 months. *The privacy page says 14 — set it.* Leave
  "Reset user data on new activity" on.
- **Data collection and modification → Data collection** → leave **Google signals
  off**. It is off by default. Turning it on would contradict the consent code,
  which denies `ad_storage`, `ad_user_data` and `ad_personalization` no matter what
  the visitor clicks.
- **Data streams → your stream → Configure tag settings → Show all → Redact data**
  → enable **email** redaction. Cheap insurance against a URL ever carrying one.
- **Data display → Reporting identity** → **Device-based**. Blended and observed
  identity lean on signals you have deliberately denied.
- *Optional:* **Data streams → Configure tag settings → Define internal traffic** →
  add your own IP as `internal`, then **Data settings → Data filters** → set the
  "Internal Traffic" filter to **Active**. It ships as Testing, which does nothing.
  Only worth it on a static IP.

**Do not** add a second gtag snippet, Google Tag Manager, or the "install with a
website builder" flow. `assets/analytics.js` is the only tag, and it must stay the
only one or it will load before consent.

**Keep:** `G-XXXXXXXXXX` → this goes in `CONFIG.ga4`.

---

## Step 2 — Microsoft Clarity

### 2.1 Create the project

1. Go to <https://clarity.microsoft.com> and sign in (Microsoft, Google or Facebook
   account — this does not have to match the GA4 account).
2. **New project**. Name `1234Tools`, website `https://www.1234tools.com`, category
   whatever fits closest.

### 2.2 Find the project id

Clarity shows an install snippet containing:

```
https://www.clarity.ms/tag/abcdefghij
```

That trailing string is the project id — about ten lowercase alphanumeric
characters. It is also in the dashboard URL (`/projects/view/abcdefghij/...`) and
under **Settings → Overview**.

**Ignore the snippet itself.** Do not paste it into any page. `assets/analytics.js`
loads the same tag, but only after consent.

### 2.3 Set masking to Strict — required

**Settings → Setup → Masking → Strict**, then save.

- *Balanced* (the default) masks fields it recognises as sensitive. It guesses.
- *Strict* masks all text by default.

The page-level masking in `assets/analytics.js` already tags every input, textarea,
select, canvas and result panel with `data-clarity-mask`, including ones created
after load, via a MutationObserver. Strict mode is the second layer: if a new tool
ships with a class the selector list doesn't know about, Strict still covers it.
The cookie policy makes an unconditional promise here, so both layers stay on.

### 2.4 Cookie consent

**Settings → Setup → Cookie consent** → enable. Clarity then writes no cookies
until it receives a consent call. `assets/analytics.js:117` makes that call
immediately after loading the tag.

This is belt and braces — the tag isn't even fetched before the visitor clicks
Allow — but it means a mistake in the gating code degrades to "no cookies" rather
than "cookies set silently".

### 2.5 What to skip

- **GA4 integration** (Settings → Overview → integrations) sends Clarity session
  data into GA4 and needs Google account access. Skip it. It adds a data flow the
  privacy page does not describe.
- **Third-party integrations** generally — each one is a processor you would then
  have to name in the privacy policy.

Clarity retains recordings for 30 days on Microsoft's side; that is their policy,
not a setting, and it is what the privacy page states.

**Keep:** `abcdefghij` → this goes in `CONFIG.clarity`.

---

## Step 3 — Search Console

### The trap first

Do **not** use the "Google Analytics" or "Google Tag Manager" verification methods.
They look convenient now that GA4 exists. They will fail. Google's verifier fetches
the page without clicking anything, so the consent banner is never answered, so
gtag never loads, so there is no tag to find. Same reason the GA4 setup assistant's
"verify installation" check will report the tag as missing — that is the gating
working, not a bug.

Two methods do work.

### Option A — DNS, one Domain property (recommended)

Covers `www.1234tools.com`, `1234tools.com`, http and https, in one property. No
site change, nothing to keep in the build, and it survives any future host move.

1. <https://search.google.com/search-console> → **Add property** → **Domain** →
   enter `1234tools.com` (no `https://`, no `www`).
2. Google gives a TXT record: `google-site-verification=xxxxxxxx`.
3. At your DNS provider add a TXT record on the **root/apex** — host `@` or blank,
   depending on the provider — with that value. Leave the existing `CNAME`
   pointing at GitHub Pages alone.
4. Wait for propagation (usually minutes, up to a few hours) → **Verify**.
5. Leave `CONFIG.gsc` empty. This method needs nothing in the HTML.

### Option B — HTML meta tag

Use this if you don't control DNS.

1. **Add property** → **URL prefix** → `https://www.1234tools.com/`.
2. Choose **HTML tag**. Google shows
   `<meta name="google-site-verification" content="LONGSTRING">`.
3. Copy **only** `LONGSTRING`, not the whole tag → `CONFIG.gsc`.
4. Do steps 4 and 5 below (paste, build, push) **before** clicking Verify — the tag
   has to be live on the site first.
5. A URL-prefix property covers exactly that prefix. Traffic to the bare
   `1234tools.com` would need its own property.

### After verification, either way

- **Sitemaps** → submit `sitemap.xml`. It is a sitemap index pointing at
  `sitemap-1.xml`; submitting the index is enough.
- **URL inspection** on `https://www.1234tools.com/` → **Request indexing**, to
  prime the first crawl.
- Data starts appearing in 2–3 days and is only useful after two or three weeks.
  This is the point of the whole exercise — real queries — so start it today even
  if you postpone steps 1 and 2.

---

## Step 4 — Paste the ids and build

Edit `build-site.js`, lines 31–39:

```js
const CONFIG = {
  /* Google Analytics 4, looks like G-XXXXXXXXXX */
  ga4: 'G-ABCD123XYZ',
  /* Microsoft Clarity project id, looks like abcdefghij */
  clarity: 'abcdefghij',
  /* Search Console: the content="..." value of the meta tag Google offers
     under "HTML tag" verification. DNS verification needs nothing here. */
  gsc: ''
};
```

Quotes are single, each line ends in a comma except the last. Any id you leave
blank simply emits no tag, so you can do GA4 now and Clarity later.

Dry run first — writes nothing:

```
node build-site.js --check
```

Expect `analytics: GA4 G-ABCD123XYZ, Clarity abcdefghij` and roughly 1,218 pages
listed as would-be-patched. If it says *no ids configured*, the paste didn't take.

Then apply:

```
node build-site.js
```

It rewrites the `<!-- ANALYTICS -->` block in every page, leaves the font block
alone, and bumps the version string in `sw.js` so returning visitors' service
workers fetch fresh copies instead of serving the pre-analytics HTML from cache.

Check one page before committing — every page gets the same block:

```
grep -A3 "ANALYTICS:" index.html
```

Then deploy. Pages serves `main` directly (no Actions workflow), so a push is the
deploy:

```
git add -A
git commit -m "Enable GA4 and Clarity"
git push
```

Live in 1–2 minutes.

---

## Step 5 — Verify on the live site

In a browser with **no ad blocker** (uBlock and Brave block both tags outright and
will make a correct install look broken):

1. Open `https://www.1234tools.com` in a **private window** — a clean
   `localStorage` is what triggers the banner.
2. DevTools → **Network**, filter box: `clarity`. Then again: `googletagmanager`.
   **Both must show zero requests** while the banner is up.
3. Click **No thanks**. Reload. Still zero, and no banner. That is a stored decline.
4. New private window → **Allow**. Both requests appear immediately, status 200.
5. Console: `window.ccChoice.get()` → `"granted"`. Application → Local Storage →
   `1234tools-consent`.
6. GA4 → **Reports → Realtime**: your visit within ~30 seconds. Standard reports
   lag 24–48 hours — Realtime is the only same-day proof.
7. Clarity → **Recordings**: allow a couple of hours for the first session. When it
   arrives, **open it and watch it.** Type something into a tool first, then check
   that field is a grey block in the replay. This is the one check worth doing by
   eye rather than trusting configuration.
8. Cookie policy page → the status line reads your choice and the button clears it.
9. *If you can:* enable Global Privacy Control (Brave, DuckDuckGo, or the GPC
   extension) → reload → **no banner at all** and no requests. Not asking is the
   correct behaviour for a machine-readable refusal.

---

## Things that will confuse you later

**Your own traffic dominates early numbers.** With single-digit daily visitors your
own testing is most of the data. Decline consent in your working browser — that
keeps you out of both tools permanently, and unlike GA4's IP filter it also covers
Clarity, which has no equivalent exclusion.

**Ad blockers mean under-reporting.** A privacy-tools audience blocks more than
average — expect GA4 to show meaningfully fewer sessions than Search Console shows
clicks. Neither is wrong. Use Search Console for "how many people", GA4 and Clarity
for "what did they do".

**Search Console and GA4 will never agree.** Different definitions, different loss.
Don't reconcile them.

**Only `assets/analytics.js` may load a tag.** If you ever paste a snippet from a
dashboard into a page, it runs before consent and every claim on the privacy and
cookie pages becomes false. The dashboards will keep offering.

**Adding a tool with new markup?** The masking selector list is
`assets/analytics.js:48`. Strict mode covers you by default, but a result panel
with an unrecognised class won't get `data-clarity-mask`, which is the belt to
Strict's braces. Add the class when you add the tool.

**A third generator writing `app.css` or page heads** must be checked for
convergence against `build-site.js` and `build-pdf.js` — run them alternately a few
times and confirm nothing changes after the first pass. Two of them already
silently undid each other once.

---

## Quick reference

| Thing | Where |
|---|---|
| GA4 Measurement ID | Admin → Data streams → your stream |
| Clarity project id | Settings → Overview, or the `/tag/` URL in the snippet |
| Ids live in code | `build-site.js:31` |
| Consent + masking logic | `assets/analytics.js` |
| Rebuild after any id change | `node build-site.js` |
| Consent key | `localStorage['1234tools-consent']` |
| Read/change consent from console | `window.ccChoice.get()` / `.reopen()` |
