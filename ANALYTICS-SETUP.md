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

### Your DNS as it actually stands

Checked live against Google's resolver on 30 July 2026:

| Record | Value | Meaning |
|---|---|---|
| `1234tools.com` NS | `dns1.registrar-servers.com`, `dns2` | **Namecheap BasicDNS** — you edit records in the Namecheap panel, not Cloudflare or anywhere else |
| `1234tools.com` A | `185.199.108–111.153` | GitHub Pages, all four |
| `www.1234tools.com` CNAME | `manthanivish-sudo.github.io` | GitHub Pages |
| `1234tools.com` TXT | `google-site-verification=8wIGrc6iJkvmpS-BR5GVTSEeF_OGy_18b4bNYS-7Iu4` | **a Google verification token is already published** |
| `1234tools.com` TXT | `v=spf1 include:spf.efwd.registrar-servers.com ~all` | Namecheap email forwarding — unrelated, leave alone |

Confirmed by request: `https://1234tools.com/` returns **301 → `https://www.1234tools.com/`**,
which serves 200. Both hostnames are live and the apex funnels into `www`.

**So the DNS half of this step may already be done.** That token was published by
someone with access to this domain — almost certainly you, at some point. Before
adding anything, open Search Console and look at the property list.

### 3.1 Check what already exists

Go to <https://search.google.com/search-console> and open the property dropdown,
top-left. One of three things is true:

- **A Domain property `1234tools.com` is listed** → verification is done. Skip to
  3.3. Note that Google re-checks the TXT periodically, so **never delete that
  record** — removing it silently unverifies the property weeks later.
- **Nothing is listed, or only a URL-prefix property** → the token exists but the
  Domain property was never completed, or it belongs to a *different Google
  account*. Verification is per-account: a token verified under one account does
  nothing for another. Do 3.2.
- **You're signed into the wrong Google account** → check the avatar, top-right.
  Use the same account that owns the GA4 property from step 1. Having them on one
  account is what makes the Search Console ↔ GA4 link in 3.4 possible.

### 3.2 Verify a Domain property (Namecheap)

A Domain property covers `www` and apex, http and https, and every subdomain, in
one place. Given that your apex and `www` both resolve, this is the right choice —
a URL-prefix property on `www` alone would silently miss anything that lands on the
bare domain.

1. Search Console → **Add property** → left-hand box, **Domain** → enter
   `1234tools.com`. No `https://`, no `www`, no trailing slash.
2. Google shows a TXT record to add. **Compare it to
   `...8wIGrc6iJkvmpS...` above.** If it is identical, the record is already
   published — click **Verify** immediately and you are done. If it differs, Google
   has issued a new token; continue.
3. Namecheap → sign in → **Domain List** → **Manage** next to `1234tools.com` →
   **Advanced DNS** tab.
4. Under **Host Records** → **Add New Record**:
   - Type: **TXT Record**
   - Host: **`@`** (this means the apex; not `www`, not blank)
   - Value: the full `google-site-verification=...` string, nothing else — no
     quotes, no `<meta>` wrapper
   - TTL: **Automatic**
5. Click the green tick to save the row. **Leave every other record alone** — the
   four A records and the `www` CNAME are what serve the site; deleting one takes
   the site down. Adding a second Google TXT alongside the existing one is fine;
   multiple verification tokens coexist happily.
6. Wait. Namecheap usually propagates in minutes; allow up to a few hours. Check
   from your machine with:

   ```
   nslookup -type=TXT 1234tools.com 8.8.8.8
   ```

   When your new value appears there, go back to Search Console → **Verify**.
   Verifying too early fails and is harmless — just click it again later.

### 3.3 Do not use the tag-based verification methods

Now that GA4 exists, Search Console will offer **Google Analytics** and **Google
Tag Manager** as verification options. Both will fail on this site, and the reason
is the consent gating working correctly:

Google's verifier fetches the page as an anonymous client. It does not click
"Allow". `assets/analytics.js` therefore never injects the gtag script, so there is
no measurement tag on the page for Google to find, so verification fails.

The same mechanism means **GA4's own "Test your website" / installation check will
report the tag as missing.** That is expected. It is not a broken install — step 5
verifies it properly, by consenting first.

`CONFIG.gsc` in `build-site.js` is for the **HTML tag** method, which is a static
`<meta>` in the head and does work. You do not need it: DNS verification is
already in place and covers more. It stays blank.

### 3.4 After verification — the part that actually matters

Verification alone gives you nothing. These four do:

1. **Sitemaps** → **Add a new sitemap** → enter `sitemap.xml`. It is a sitemap
   *index* pointing at `sitemap-1.xml`; submitting the index is enough, Google
   follows it. Status should read **Success** with 1,218-ish discovered URLs within
   a day or two. If it says "Couldn't fetch", wait 24 hours before worrying —
   that message is often premature.
2. **URL inspection** → paste `https://www.1234tools.com/` → **Request indexing**.
   Prime the homepage crawl. Do the same for `/pdf/index.html`, your newest
   section. There is a quota of a handful per day; spend it on hubs, not on all
   1,218 pages — Google finds the rest through the sitemap and internal links.
3. **Settings → Associations** (or GA4 → Admin → **Search Console links**) → link
   the property to the GA4 property from step 1. This is the piece most people
   skip. It puts landing-page-level query data into GA4, so you can see *which
   search brought someone in* alongside *what they did* — neither tool shows that
   alone. Requires the same Google account owning both, which is why 3.1 nagged
   about it.
4. Set a reminder for **~3 weeks out** to read **Performance → Queries**. That
   report is the entire reason for this exercise: it tells you which of the 1,218
   pages are one position away from real traffic, which is what per-page SEO work
   should be aimed at. Before then there is not enough data to act on, and looking
   daily will only tempt you into changing things at random.

### 3.5 What "done" looks like

- Property `1234tools.com` shows a green **Ownership verified**.
- Sitemap `sitemap.xml` shows **Success**.
- **Coverage / Pages** shows indexed pages climbing over the following fortnight.
  It will not reach 1,218. Google indexes a fraction of any large site; a slow
  climb is normal and the number is not a target.

Do this step today even if steps 1 and 2 wait. Search Console data only starts
accruing from the day you verify — it is not backfilled, so every day unverified is
a day of query data you can never recover.

---

## Step 4 — Paste the ids and build — **done, committed as `06a4342`**

`CONFIG` in `build-site.js:31` now reads:

```js
const CONFIG = {
  ga4: 'G-2CGQLD4H5E',
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
| GA4 Measurement ID | `G-2CGQLD4H5E` — Admin → Data streams → your stream |
| Clarity project id | `xunompl96y` — Settings → Overview, or the `/tag/` URL |
| DNS | Namecheap → Domain List → Manage → Advanced DNS |
| Search Console property | Domain `1234tools.com` (DNS TXT already published) |
| Ids live in code | `build-site.js:31` |
| Consent + masking logic | `assets/analytics.js` |
| Rebuild after any id change | `node build-site.js` |
| Consent key | `localStorage['1234tools-consent']` |
| Read/change consent from console | `window.ccChoice.get()` / `.reopen()` |
