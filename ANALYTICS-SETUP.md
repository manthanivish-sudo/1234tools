# Turning analytics on

**Analytics went live on 2026-07-30.**

| Step | State |
|---|---|
| 1 — GA4 property | `G-BJWYN6QS86`, 14-month retention applied |
| 2 — Clarity project | `xunompl96y`, Strict masking applied |
| 3 — Search Console | configured and DNS-verified — **GA4 link still to do**, see 3.2 |
| 4 — ids pasted, built, pushed | done — confirmed serving on the live site |
| 5 — verify in a browser | **still worth doing**, see step 5 |

Both settings the published privacy and cookie pages assert as fact — 14-month
retention and Strict masking — are now true, so the pages are accurate.

Two things remain, neither blocking: **link Search Console to GA4** (3.2, the
highest-value five minutes left) and **walk step 5 in a real browser** to see the
consent gate hold with your own eyes.

### Pushing this repo

GitHub Pages serves `main` directly with no Actions workflow, so **a push is a
deploy.** Push as **manthanivish-sudo** — two accounts are logged into `gh` on this
machine and the active one, `vmanthani`, has read-only access, which fails with a
403 that reads like a permissions bug. The repo carries a local credential helper
pinning the right account, so a plain `git push` works. If it ever stops working,
restore it repo-locally rather than switching the global `gh` account:

```
git config --local --get-all credential.https://github.com.helper
```

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

## Step 3 — Search Console — **already configured**

You confirmed on 2026-07-30 that Search Console is set up for this domain, and the
DNS backs that up. Checked live against Google's resolver:

| Record | Value | Meaning |
|---|---|---|
| `1234tools.com` NS | `dns1.registrar-servers.com`, `dns2` | **Namecheap BasicDNS** — records are edited in the Namecheap panel |
| `1234tools.com` A | `185.199.108–111.153` | GitHub Pages, all four |
| `www.1234tools.com` CNAME | `manthanivish-sudo.github.io` | GitHub Pages |
| `1234tools.com` TXT | `google-site-verification=8wIGrc6iJkvmpS-BR5GVTSEeF_OGy_18b4bNYS-7Iu4` | the verification token, published |
| `1234tools.com` TXT | `v=spf1 include:spf.efwd.registrar-servers.com ~all` | Namecheap email forwarding — unrelated, leave alone |

Also confirmed: `https://1234tools.com/` returns **301 → `https://www.1234tools.com/`**,
which serves 200. Both hostnames are live and the apex funnels into `www`.

`CONFIG.gsc` in `build-site.js` therefore stays **blank** — it exists for the HTML
meta-tag verification method, which DNS verification makes unnecessary.

### 3.1 Never delete that TXT record

Google re-checks it periodically. Removing it does not fail loudly; the property
silently unverifies weeks later and you lose the data stream without an obvious
cause. If you ever tidy up DNS records, leave both TXT rows alone.

### 3.2 Three things left to do there

Verification is the beginning, not the end. In rough order of value:

1. **Link Search Console to GA4 — newly possible, and the biggest win.**
   GA4 → **Admin** → **Search Console links** → **Link** → pick the property.
   You could not do this before today because the GA4 property did not exist.
   It is what puts query data next to behaviour data: which search brought someone
   in, alongside what they then did. Neither tool shows that on its own, and this
   is the single highest-value five minutes in the whole setup.

   It requires the same Google account to have access to both. If GA4 was created
   under a different account from Search Console, grant that account access in
   Search Console → **Settings → Users and permissions** first.

2. **Check the sitemap is submitted and succeeding.** Search Console →
   **Sitemaps**. It should list `sitemap.xml` with status **Success**. If it is
   missing, add `sitemap.xml` — that is the index file, which points at
   `sitemap-1.xml`; submitting the index is enough.

   Even if it already says Success, **resubmit after the next push.** The sitemap
   gained 12 URLs today (see below) and resubmitting nudges Google to re-read it
   rather than waiting for its own schedule.

3. **Read Performance → Queries in about three weeks.** That report is the reason
   for all of this. Before then there is not enough data to act on, and checking
   daily only tempts you into changing things at random.

### 3.3 The sitemap gap this turned up

Checking whether the sitemap was worth submitting turned up a real hole. It listed
1,205 URLs against 1,218 pages. Excluding `404.html`, which should never be listed,
the missing ones were **all 12 conversion category hubs**:

```
conversions/angle/  area/  data/  energy/  length/  mass/
power/  pressure/  speed/  temperature/  time/  volume/
```

These are not stubs. `conversions/length/index.html` is 89 KB, titled *"Length &
Distance Converters — 306 Free Tools"*, canonical, indexable, and linked from every
page on the site. They are among the strongest category pages you have — exactly
the "category collection pages" the growth plan wants to build — and Google had to
find them by crawling alone.

Fixed in `d5fd82c`. The same commit normalises the five legal pages from the bare
directory form (`/about/`) to the `index.html` form their own canonical tags
declare, so no entry now contradicts its page. The sitemap covers every page on the
site except `404.html`: **1,217 URLs**.

Worth knowing for later: **nothing generates the bulk of this sitemap.** `build-pdf.js`
appends its own 17 URLs, and the rest is hand-maintained — which is exactly why 12
pages went missing. If you add a section without also editing `sitemap-1.xml`, it
will happen again. Generating the sitemap from the page list in `build-site.js`
would close that hole permanently; it already walks all 1,218 pages and would be a
natural home for it.

---

## Step 4 — Paste the ids and build — **done, committed as `06a4342`**

`CONFIG` in `build-site.js:31` now reads:

```js
const CONFIG = {
  ga4: 'G-BJWYN6QS86',
  clarity: 'xunompl96y',
  gsc: ''                 // DNS verification — no meta tag needed
};
```

`node build-site.js` wrote 1,219 files: the `<!-- ANALYTICS -->` block into all
1,218 pages, plus the `sw.js` version bump `1234tools-v4 → v5` so returning
visitors' service workers fetch fresh HTML instead of serving the pre-analytics
copy from cache. Verified afterwards:

- root page emits `src="assets/analytics.js"`, a page one level down emits
  `src="../assets/analytics.js"` — relative depth is right
- re-running `--check` reports **0 files would change**, so the build is idempotent
  and safe to re-run

If you ever change an id, edit those lines and run `node build-site.js` again.
Leaving one blank emits no tag for that service.

### The remaining step: push

Pages serves `main` directly — there is no Actions workflow, so **the push is the
deploy** and analytics goes live to real visitors 1–2 minutes later:

```
git push
```

Nothing else is needed. The commit is already made.

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
| GA4 Measurement ID | `G-BJWYN6QS86` — Admin → Data streams → your stream |
| Clarity project id | `xunompl96y` — Settings → Overview, or the `/tag/` URL |
| DNS | Namecheap → Domain List → Manage → Advanced DNS |
| Search Console property | Domain `1234tools.com` (DNS TXT already published) |
| Ids live in code | `build-site.js:31` |
| Consent + masking logic | `assets/analytics.js` |
| Rebuild after any id change | `node build-site.js` |
| Consent key | `localStorage['1234tools-consent']` |
| Read/change consent from console | `window.ccChoice.get()` / `.reopen()` |
