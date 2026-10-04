# 1234Tools — Share & Promotion Copy Specification

Scope note for the implementer. The owner's request is "a share button on every tool page, with or without the calculation, with shortcuts to WhatsApp etc., with the description and OG for each tool". Part A specifies exactly that (the on-page share sheet, its text templates, URL rules and OG). Part B is the promotion-desk playbook that the workflow asked for; it reuses Part A's record, slots and truthfulness rules so there is one vocabulary. Nothing in Part B automates publishing: every template produces text that a human pastes or a prefilled composer URL that a human clicks.

Grounding (verified in the repo on 2026-10-04): every tool page already carries `<meta name="description">`, `og:title` ("{title} — Free & Private | 1234Tools"), `og:description` (= description), `og:url`, `og:image` (one site-wide `/assets/img/og-image.png`), `twitter:card=summary_large_image`. Calculators read `?key=number` (render-core `prefill()`), conversions read `?v=`, text tools read `?text=`. Shell post-processors are marker-delimited (`<!-- FONTS -->…<!-- /FONTS -->`, `<!-- PWA -->`, `<!-- ANALYTICS -->`), idempotent, `--check`-able and inert on `require()`; build-crumbs.js is the model to copy. There is no share code anywhere yet (`navigator.share`, `wa.me`, `t.me/share` only appear in two AI image/video pages' own bodies and in outbound attribution).

---

## Part A — The on-page share sheet

### A.1 Design decisions (the "best way")

1. One `Share` button in the tool header (right of the `<h1>`), on all 1,281 tool pages, hubs excluded. It opens a small sheet (not a new page). On phones with `navigator.share` the sheet shows a `Share…` row first that calls the OS share dialog; the named channels remain below it as fallbacks so WhatsApp is always one tap.
2. Two modes, chosen by state, not by the user hunting for a toggle:
   - `plain` — before any input: shares the tool.
   - `result` — once the tool has produced a result: the sheet gains a checked box "Include my numbers" and the text gains a one-line result summary; the link carries the inputs as query params so the recipient lands on the same answer. Unchecking reverts to `plain`. For tools without inputs that round-trip (PDF, image, AI tools) the box never appears.
3. The link, never the result, is the payload. The result is recomputed by the recipient's browser from the shared inputs, so the shared text can say "I got X" while the URL stays short and honest. Only inputs declared in `build/jobs.js` PREFILL (calculators), `?v=` (conversions) and `?text=` (text tools, capped at 200 chars) are serialised. Free-text and file inputs never travel.
4. Privacy line in the sheet, shown whenever the box is checked: "This link contains the numbers you entered." For the 15 statutory/payroll-type tools (salary, CTC, take-home, payslip, income tax, advance tax, HRA, EPF, NI, VAT return, MTD, GST invoice, Form 16, pension, dividend) the box defaults to **unchecked**. Everything else defaults to checked.
5. No vendor SDK buttons. Every channel is a plain intent URL opened in a new tab (`rel="noopener"`), so the page still makes no third-party request on load, and the consent-bar promise stays true.
6. Attribution: `utm_source=share&utm_medium=<channel>&utm_campaign=<section slug>&utm_content=<tool slug>`. Channel ids: `native, whatsapp, telegram, x, linkedin, facebook, reddit, email, copy, qr`. GA4 then shows share-driven sessions per tool without any server.
7. Copy link copies the **clean** URL plus params (no UTM) when the box is unchecked — people paste it into docs and chat where UTM noise looks spammy — and the UTM URL when the box is checked (that link is being sent to a person who will click it). Copy text copies the WhatsApp text.
8. QR row (desktop only): draws the share URL with the site's own QR engine so someone can scan from a phone. No network.

### A.2 Channel intents

| channel | URL pattern (all values `encodeURIComponent`) | carries |
|---|---|---|
| native | `navigator.share({title, text, url})` | title, text (without URL), url |
| whatsapp | `https://wa.me/?text={TEXT}%0A{URL}` | text + URL (WhatsApp has no separate url field) |
| telegram | `https://t.me/share/url?url={URL}&text={TEXT}` | both |
| x | `https://twitter.com/intent/tweet?text={TEXT}&url={URL}` | text ≤ 257 chars + URL |
| linkedin | `https://www.linkedin.com/sharing/share-offsite/?url={URL}` | URL only; LinkedIn reads OG |
| facebook | `https://www.facebook.com/sharer/sharer.php?u={URL}` | URL only; FB reads OG |
| reddit | `https://www.reddit.com/submit?url={URL}&title={TITLE}` | URL + title |
| email | `mailto:?subject={SUBJECT}&body={TEXT}%0A%0A{URL}` | subject, text, URL |
| copy | clipboard | URL (see A.1 §7) |
| qr | inline SVG | URL |

### A.3 Share text templates (deterministic)

Record fields: `title, path, url, section, sectionName, verb, io, description, pricing`. Runtime: `mode ('plain'|'result')`, `result.summary` (set by the tool, e.g. "£3,112/month take-home on £48,000"), `result.params` (object → querystring), `channel`.

Clauses (chosen by `pricing`; the engine never improvises):
- `PRIV` free: `runs in your browser, nothing is uploaded` · freemium (AI): `10 free runs a month, your text is sent to a server (the page says so)`
- `FREE` free: `free, no account` · freemium: `free for 10 a month`

Templates (`{T}` title, `{D}` description, `{R}` result.summary, `{URL}` share URL):

| channel | plain | result |
|---|---|---|
| whatsapp / telegram / native text | `{T} — {D} {FREE}, {PRIV}.` | `{R} — worked out with {T} on 1234Tools. Open the link to see the same numbers.` |
| x | `{T}: {D} {FREE}, {PRIV}.` (trim D at a word boundary to fit 257) | `{R}. Calculated with {T} on 1234Tools — the link opens on the same inputs.` |
| reddit title | `{T} — {D}` (≤ 300) | `{T} — {R}` |
| email subject / body | `{T} on 1234Tools` / `{D} {FREE}, {PRIV}.` | `{R}` / `I used {T} on 1234Tools. The link below opens on the numbers I entered, so you can check them or change them.` |
| linkedin, facebook | (URL only; OG does the talking) | (URL only; the params ride in the URL) |

Worked outputs:
- Merge PDF, WhatsApp, plain: `Merge PDF Files — Combine several PDFs into one, in any order, without uploading anything. free, no account, runs in your browser, nothing is uploaded.` + `https://www.1234tools.com/pdf/merge-pdf/?utm_source=share&utm_medium=whatsapp&utm_campaign=pdf&utm_content=merge-pdf`
- UK Take-Home Pay, WhatsApp, result: `£3,112 a month take-home on £48,000 — worked out with UK Take-Home Pay Calculator on 1234Tools. Open the link to see the same numbers.` + `https://www.1234tools.com/business/uk-take-home-pay/?gross=48000&utm_source=share&utm_medium=whatsapp&utm_campaign=business&utm_content=uk-take-home-pay`

### A.4 OG per tool

- Keep `og:title`, `og:description`, `og:url` as generated (they are already per tool). Add `og:image:alt` = `{T} on 1234Tools` and `twitter:image` (currently missing on the inspected page; add it in the same marker block).
- Replace the single site-wide `og-image.png` with a generated 1200×630 PNG per tool at `/assets/og/{section}-{slug}.png`, drawn from one HTML template (dark bg `#0a0e1a`, gold `#f7c948` title in Sora ≤ 2 lines at 64px, the `io` line in Inter `#b7bfd2` 34px, the section glyph from `/assets/icons.svg`, the four-square logo bottom-left, `1234tools.com` bottom-right) and screenshotted with puppeteer-core in a `build-og.js` (`--check` compares the manifest; `--only=path` regenerates one). ≈ 1,281 × 60 KB ≈ 75 MB — acceptable on Pages; conversions can share one image per family (12) to cut it to ≈ 250 images if size matters.
- Marker block `<!-- SHARE: generated by build-share.js, do not edit -->…<!-- /SHARE -->` inserted after the `<h1>` line; `engine/share.js` registered once in the shell; `render-core` calls `window.SHARE && SHARE.setResult({summary, params})` after a successful compute and `SHARE.clear()` on reset. Bump `sw.js` V.

---

## Part B — Promotion desk copy playbook

### 1. Principles

**Value first, tool once.** Every post or comment answers the question completely so that a reader who never clicks has still been helped. The tool is mentioned once, after the answer, as the way to do what you just explained faster. If the answer needs no tool, post the answer and no link; that post still builds the account.

**Disclosure phrasings (exact strings the generator uses; pick by venue):**
- Reddit, HN, Lobsters, forums: `Disclosure: I built this.` (standalone sentence at the end of the paragraph that contains the link.)
- Stack Exchange (required by the self-promotion rule): `Disclosure: I'm the author of this tool.` placed immediately before the link.
- Quora: `(I built this site, so take that into account.)`
- LinkedIn, Facebook, IndieHackers, Dev.to, Product Hunt: `I built this —` as the clause that introduces the link; no separate line needed because the author voice is the norm.
- X/Threads/Bluesky/Mastodon: `(mine)` after the link or `I made a thing:` as the hook. One or the other, never both.
- YouTube comments, Discord, Telegram, WhatsApp: `I run 1234tools.com, so obviously biased, but…`
- Email outreach: `I'm Vishal from 1234Tools (MVR IT Services, Reading).` Never pose as a fan.

**The 9:1 ratio.** For every post or comment that links to the site, the same account makes at least nine contributions on that venue with no link to 1234Tools. The desk counts both and refuses to draft a linked post when the account is below ratio. Helpful comments with no link count toward the nine; upvotes do not.

**Never cross-post identical text.** The same tool on two venues on the same day must come from different template ids or a different variant index, and the desk hashes the body and refuses a duplicate within 90 days.

**Link etiquette per platform.**
- Reddit: link in a comment, never a bare link post unless the sub is a "show your work" sub (r/SideProject, r/InternetIsBeautiful rules permit). No UTM in subreddits that strip them; use `cleanUrl` where the venue record says `utm: false`.
- HN: Show HN links go in the URL field; comments link rarely and only when the link is the answer.
- LinkedIn: no links in the body (reach penalty); first comment carries it.
- Instagram/TikTok: no clickable links; "link in bio" and the bio holds `1234tools.com`.
- X: URL at the end; one link per post; in a thread, the link sits in the last post and nowhere else.
- Stack Exchange: link plus the full method inline, so the answer survives the site going away.
- Quora: link allowed, but the answer must stand alone; one link.
- Facebook groups: check the group's pinned rules; many allow links only on "Promo Friday" threads — the desk's venue record carries the allowed weekday.
- YouTube comments: no URL (auto-held). Name the site in words.
- Discord/Telegram/WhatsApp: link OK where you are a member in good standing and the channel is for links or help.

**When NOT to post.** The thread is older than 30 days (Reddit/forums) or 48 hours (HN); you have already posted in that thread; the asker wants a specific product you are not; the sub's rules forbid self-promotion outright (do not "soften" your way around it); you are below the 9:1 ratio; the tool's claim would need a qualification you cannot fit; a tragedy or outage dominates the venue that day; it is the same tool you posted to that venue within its cap (section 5).

**Criticism.** Reply once, within 24 hours, thank them for the specific point, state what is true, say what you will change and when, and come back to the same thread when it ships. Never argue about tone, never downvote, never bring friends. If the criticism is right, the reply begins with "You're right."

**When a mod removes a post.** Do not repost. Read the removal reason and the rules again. Send one polite modmail asking what would make it acceptable, only if the reason is unclear. Log the venue as `cooldown: 90 days` in the desk. If the removal was for self-promotion, the account goes to 0:1 ratio on that venue — rebuild with help-only comments before the next linked post.

### 2. Template specifications

#### 2.0 Common machinery (every template uses these)

Input record `R = {title, path, url, section, sectionName, verb, io, description, keywords[], pricing, audiences[], relatedGuides[], relatedCompare[]}` plus optional `{question, venue, utmUrl, cleanUrl, variant}`.

Derived values:
- `URL` = `utmUrl` if the venue record allows UTM, else `cleanUrl`, else `url`.
- `SLUG` = last path segment; `HOST` = `1234tools.com`.
- `PRIV` (pricing=free): v0 `runs in your browser — nothing you type is uploaded`, v1 `everything happens on your device; nothing is sent anywhere`, v2 `works in the browser and keeps working offline once the page has loaded`. (pricing=freemium): v0 `cloud AI, 10 runs a month free with an account; it sends your text to a server and says so before you start`, v1 `the AI part runs on a server (the page is upfront about that); 10 a month are free`, v2 `needs a free account; 10 runs a month included; your text goes to the model provider`.
- `FREE` free: `free, no account, no watermark` (drop "no watermark" unless section ∈ {pdf, image, ai-image, ai-video}); freemium: `free for 10 runs a month`.
- `OFFLINE` only when pricing=free: `works offline once opened`.
- `DISC(venue)` = the disclosure string from §1.
- `pick(slot, arr)` = `arr[(variant + slotIndex) % arr.length]`, slotIndex being the slot's 0-based position in the template. This makes the variant index rotate phrasing across slots rather than picking column 0 everywhere.
- `trunc(s, n)` cuts at the last space before `n-1` and appends `…`.
- Overflow order (applied until the hard limit holds): drop hashtags → drop OFFLINE → drop PRIV → swap HOOK for its shortest variant → `trunc(description)`.
- `io` arrow is preserved as `→` on platforms that render UTF-8 (all listed).
- Verb-keyed HOOK pools and the hook library (section 4) are shared; a template that says `HOOK(verb, angle)` draws from section 4 filtered by verb and angle, index `variant`.
- Never generated: percentages, user counts, "best", "#1", "100% private", "no third-party requests", "unlimited", or any competitor name.

Example records used below:
- **MP** = `{title:"Merge PDF Files", path:"pdf/merge-pdf/", section:"pdf", sectionName:"PDF Tools", verb:"Make", io:"PDFs → PDF", description:"Combine several PDFs into one, in any order, without uploading anything.", keywords:["merge pdf","combine pdf","join pdf files","pdf merger","concatenate pdf"], pricing:"free", audiences:["small-business","students","going-paperless"], relatedGuides:["/guides/merge-pdfs-without-uploading/"], relatedCompare:[]}`, variant 0, URL `https://www.1234tools.com/pdf/merge-pdf/?utm_source=<venue>&utm_medium=<medium>&utm_campaign=pdf&utm_content=merge-pdf`.
- **TH** = `{title:"UK Take-Home Pay Calculator", path:"business/uk-take-home-pay/", section:"business", sectionName:"Business", verb:"Calculate", io:"Gross salary → UK take-home", description:"Estimate income tax, National Insurance and net pay from a gross salary. England, Wales and Northern Ireland.", keywords:["take home pay calculator","salary calculator UK","net pay","income tax calculator","PAYE calculator","after tax salary"], pricing:"free", audiences:["hr-payroll","freelancers","accountants"]}`, variant 1.
- **GST** = `{title:"GST Calculator (India)", path:"india/gst-calculator/", section:"india", verb:"Calculate", io:"Amount → GST split", description:"Add or remove GST at current 2026 slabs, with the CGST, SGST and IGST split for your invoice.", keywords:["GST calculator","CGST SGST IGST","reverse GST"], pricing:"free", audiences:["shopkeepers","accountants"]}`, variant 2 — used where an Indian venue is the natural example.

In the examples below `<URL>` stands for the computed `URL`.

---

#### reddit-comment
Structure: ANSWER (2–6 sentences that fully answer `question`; if `question` is absent, use the generic "how do I {verb.toLowerCase()} {io}" answer built from `description`) → METHOD (one concrete manual way, no tool) → TOOL (one sentence) → DISC → LINK.
Slots:
- ANSWER opener: v0 `Short version: {description}` · v1 `You can do this without installing anything.` · v2 `Two ways, depending on how often you need it.`
- METHOD: v0 `Manually: {manual}.` · v1 `If it's a one-off: {manual}.` · v2 `The long way is {manual}.` (`manual` comes from the venue question or a per-section stock line: pdf → "print each file to PDF and use your OS's print-to-PDF 'collate' trick, which is fiddly for more than two files"; business/india/finance → "the official rates tables and a spreadsheet"; developer → "a one-liner in your shell"; image → "your OS's built-in viewer"; text → "a text editor with regex".)
- TOOL: v0 `If you'd rather not, I made {title} — {PRIV}.` · v1 `I built a small page for exactly this: {title}. {PRIV}.` · v2 `Otherwise {title} does it in the browser; {PRIV}.`
Limits: ≤ 1,200 chars; markdown yes (plain paragraphs, no headers, no bold); hashtags none; link last line, bare URL in angle brackets or markdown `[title](URL)`; DISC immediately before the link.
Examples:
MP, question "How do I combine three PDFs into one without Adobe?":
```
Short version: combine several PDFs into one, in any order, without uploading anything. Manually: print each file to PDF and use your OS's print-to-PDF "collate" trick, which is fiddly for more than two files. On a Mac, Preview's sidebar also lets you drag pages between documents.

If you'd rather not, I made Merge PDF Files — runs in your browser — nothing you type is uploaded. Disclosure: I built this.
https://www.1234tools.com/pdf/merge-pdf/
```
TH, question "What's take-home on £48k in England?":
```
You can do this without installing anything. On £48,000 (2026/27, England, standard code, no student loan or pension): tax is 20% on the slice above £12,570 and 40% on the slice above £50,270 — none here — so about £7,086 tax, roughly £2,994 Class 1 NI, leaving about £37,900 a year or £3,160 a month. If it's a one-off: the official rates tables and a spreadsheet.

I built a small page for exactly this: UK Take-Home Pay Calculator. Everything happens on your device; nothing is sent anywhere. Disclosure: I built this.
https://www.1234tools.com/business/uk-take-home-pay/?gross=48000
```
(Numbers in a worked answer are computed by the tool's own engine at draft time; the generator inserts them from `result.summary`, never from memory.)

#### reddit-post
Structure: TITLE → BODY (what it does in 2 lines; why I made it; how it works technically in one paragraph; what it does not do; ask for feedback) → DISC implied (first person) → LINK.
Five title formulas (index `variant % 5`):
1. `I made a free {title.toLowerCase()} that {benefit} — {PRIV short}` e.g. "that runs entirely in the browser"
2. `{title}: {io}, no upload, no account`
3. `Tired of uploading {object} to random sites to {verb.toLowerCase()} them, so I built one that doesn't`
4. `[Free tool] {title} — {trunc(description, 80)}`
5. `Show r/{sub}: {title}, an offline-capable {sectionName.toLowerCase()} page`
Body slots: WHY v0 `I kept needing to {io.toLowerCase()} and didn't want to upload {object} to a server.` · v1 `Most {object} sites upload the file and keep it 'for 24 hours'. Mine doesn't have a server to upload to.` · v2 `Built for my own {audience} work; sharing in case it saves you a minute.` HOW v0 `It's static HTML + JS; {engine note}; {OFFLINE}.` · v1 `No framework, no build at runtime, {PRIV}.` · v2 `Everything is open in the page source if you want to check what it does.` NOT v0 `It doesn't do {limitation}.` · v1 `Known gaps: {limitation}.` · v2 `Not for {limitation} yet.` ASK v0 `What's missing?` · v1 `Happy to take requests.` · v2 `Tell me what broke.`
Limits: title ≤ 300 (aim ≤ 90); body ≤ 2,000; markdown yes (paragraphs and one bullet list max); no hashtags; link once at the end as bare URL; subs that strip UTM get `cleanUrl`.
Examples:
MP (formula 1): title `I made a free merge pdf files tool that runs entirely in the browser — nothing is uploaded`; body:
```
Drag in several PDFs, reorder them, download one file. That's it.

I kept needing to combine PDFs and didn't want to upload contracts to a server. It's static HTML + JS; pdf.js is self-hosted and the merge is done with a small in-page library; works offline once opened.

It doesn't do OCR or page-level editing — there are separate pages for split and rotate.

What's missing? https://www.1234tools.com/pdf/merge-pdf/
```
TH (formula 2): title `UK Take-Home Pay Calculator: Gross salary → UK take-home, no upload, no account`; body: "Type a gross salary, get tax, NI and monthly net for England, Wales and NI. Most salary sites upload the figure to an ad network; mine doesn't have a server to upload to. No framework, no build at runtime, everything happens on your device; nothing is sent anywhere. Known gaps: Scottish bands and student loan plans are coming. Happy to take requests. https://www.1234tools.com/business/uk-take-home-pay/"

#### hn-show
Structure: TITLE (≤ 80) → URL field = `cleanUrl` (HN strips nothing but the community dislikes UTM) → FIRST COMMENT (maker note: what, why, how, what it doesn't do, one question).
Title formula: `Show HN: {title} – {hnClause}` where hnClause v0 `{io}, entirely client-side` · v1 `{trunc(description,45)}` · v2 `a no-upload {sectionName.toLowerCase()} page`. Hard cap 80 including "Show HN: "; overflow truncates hnClause at a word.
First comment slots: WHAT v0 `{description}` · v1 `{title}: {io}.` · v2 `Static page: {description}` WHY (as reddit-post WHY) HOW v0 `Plain HTML/JS, no framework, no build step at runtime. {engine note}. {PRIV}.` · v1 `{PRIV}. Fonts and pdf.js are self-hosted; analytics only load if you accept the consent bar.` · v2 `Everything is in the page source.` NOT (as reddit-post) ASK v0 `Curious what edge cases break it.` · v1 `Would value a look at the {technical area}.` · v2 `Open to requests for the next tool.`
Limits: comment ≤ 1,500; no markdown (HN supports only paragraphs, *italics* and indent-code); no hashtags; link none in the comment (URL field has it); disclosure is implicit in "Show HN".
Examples:
MP: title `Show HN: Merge PDF Files – PDFs → PDF, entirely client-side` (58). Comment: "Combine several PDFs into one, in any order, without uploading anything. I kept needing to combine PDFs and didn't want to upload contracts to a server. Plain HTML/JS, no framework, no build step at runtime. pdf.js is self-hosted for thumbnails; the merge uses a small in-page PDF library. Runs in your browser — nothing you type is uploaded. It doesn't do OCR or page-level editing. Curious what edge cases break it — encrypted and XFA files are the ones I expect."
TH: title `Show HN: UK Take-Home Pay Calculator – Estimate income tax, National Insurance` (78). Comment: "UK Take-Home Pay Calculator: Gross salary → UK take-home. Most salary sites upload the figure to an ad network; mine doesn't have a server. Everything happens on your device; nothing is sent anywhere. Fonts are self-hosted; analytics only load if you accept the consent bar. Known gaps: Scottish bands and student loan plans. Would value a look at the NI threshold handling for annual vs monthly pay periods."

#### hn-comment
Structure: ANSWER (technical, specific, 2–5 sentences) → optional TOOL (one sentence, only if the thread is about the problem the tool solves) → DISC → LINK (only if TOOL present).
Slots: TOOL v0 `I ended up building a client-side page for this ({title}); {PRIV}.` · v1 `Shameless but relevant: {title} does this in the browser.` · v2 `I maintain {title}, which is the same idea without the server.`
Limits: ≤ 1,000; no markdown; no hashtags; link bare at the end; DISC `Disclosure: I built this.` before the link. Rule: at most 1 linked HN comment per 14 days.
Examples:
MP (thread on PDF privacy): "The leak most people miss is that 'we delete after 24h' still means the file crossed the wire and sat on disk. For merging/rotating/splitting there's no technical reason for a server; the PDF object model is simple enough to rewrite client-side. I ended up building a client-side page for this (Merge PDF Files); runs in your browser — nothing you type is uploaded. Disclosure: I built this. https://www.1234tools.com/pdf/merge-pdf/"
TH (thread on UK tax code bugs): "Most of the wrong results come from applying NI annually; HMRC applies primary thresholds per pay period, so a bonus month is taxed differently from the same amount spread over the year. Shameless but relevant: UK Take-Home Pay Calculator does this in the browser. Disclosure: I built this. https://www.1234tools.com/business/uk-take-home-pay/"

#### ph-launch
Structure: NAME = `{title} by 1234Tools` → TAGLINE (≤ 60) → DESCRIPTION (≤ 260) → FIRST COMMENT (maker story, 4 short paragraphs) → 3 GALLERY CAPTIONS → topics (from section).
Slots: TAGLINE v0 `{io} — in your browser, nothing uploaded` · v1 `{verb} {object} without an account or an upload` · v2 `Free {sectionName.toLowerCase()}: {trunc(description, 40)}`. DESCRIPTION v0 `{description} {FREE}; {PRIV}. {OFFLINE}.` · v1 `{title} does one job: {io}. {PRIV}. {FREE}.` · v2 `{description} Part of 1234Tools, {count} browser tools from a one-person shop in Reading, UK.` FIRST COMMENT paragraphs: P1 `Hi PH — I built this —` + WHY; P2 HOW; P3 NOT + what's next (one related tool from the same section); P4 ASK v0 `What would make you use it twice?` · v1 `Tell me the file that breaks it.` · v2 `Requests welcome — I ship weekly.` GALLERY CAPTIONS: C1 v0 `{io}: the whole flow` · v1 `Drop, arrange, download` · v2 `Step 1 to result in one screen`; C2 v0 `No upload: the network tab stays empty` · v1 `Works offline once opened` · v2 `Dark-first, phone-first`; C3 v0 `Share a link that carries your inputs` · v1 `Part of {count} tools in {sectionName}` · v2 `Set currency and date format once in Preferences`.
Limits: tagline 60, description 260, first comment ≤ 1,500, captions ≤ 80 each; markdown none (PH renders plain text); hashtags none; link none in body (PH has its own URL field, use `utmUrl` with `utm_medium=launch`).
Examples:
MP: tagline `PDFs → PDF — in your browser, nothing uploaded` (46). Description: `Combine several PDFs into one, in any order, without uploading anything. Free, no account, no watermark; runs in your browser — nothing you type is uploaded. Works offline once opened.` (189). First comment: "Hi PH — I built this — I kept needing to combine PDFs and didn't want to upload contracts to a server. / Plain HTML/JS, no framework; pdf.js self-hosted; everything happens on your device. / It doesn't do OCR or page edits; Split PDF and Rotate PDF are separate pages, and Compress is next. / What would make you use it twice?" Captions: "PDFs → PDF: the whole flow" / "No upload: the network tab stays empty" / "Share a link that carries your inputs".
TH: tagline `Calculate your UK take-home without an account or an upload` (58). Description: `UK Take-Home Pay Calculator does one job: Gross salary → UK take-home. Everything happens on your device; nothing is sent anywhere. Free, no account.` (147). Captions: "Drop, arrange, download" is wrong for a calculator → generator uses verb-aware pool: for Calculate, C1 v1 = `Type a salary, read the breakdown`. Captions: "Type a salary, read the breakdown" / "Works offline once opened" / "Part of 30 tools in Business".

#### x-post
Structure: HOOK → VALUE (one clause) → PRIV (short) → URL. Optional 1 hashtag only when the venue record says the tag is live (e.g. #buildinpublic).
Slots: HOOK (`HOOK(verb, angle)` from §4, filtered by `angle` = venue.angle || 'privacy') ; VALUE v0 `{io}.` · v1 `{trunc(description, 90)}` · v2 `{title}, {FREE}.`; PRIV-short free: v0 `Nothing uploaded.` · v1 `Runs in your browser.` · v2 `Works offline once loaded.`; freemium: `Cloud AI, 10 free a month.`
Limits: 280 total with the URL counted as 23; markdown no; ≤ 1 hashtag; URL last; disclosure `(mine)` after the URL only if the post reads as a recommendation rather than an announcement (HOOK angle `result-first` ⇒ add `(mine)`).
Examples:
MP (v0, angle privacy): `Your PDFs never need to leave your laptop to be merged. PDFs → PDF. Nothing uploaded. https://www.1234tools.com/pdf/merge-pdf/?utm_source=x&utm_medium=social&utm_campaign=pdf&utm_content=merge-pdf` (counted 104).
TH (v1, angle result-first): `£48k in England is about £3,160 a month in your pocket. Estimate income tax, National Insurance and net pay from a gross salary. Runs in your browser. https://www.1234tools.com/business/uk-take-home-pay/?gross=48000&utm_source=x… (mine)` (counted 196).

#### x-thread
Structure: 5 posts. P1 HOOK + promise (no link); P2 the problem (why people upload / miscalculate); P3 how the tool works (PRIV, OFFLINE); P4 a worked example or a tip from `keywords`; P5 CTA + URL + `(mine)`.
Slots: P1 v0 `{HOOK} A short thread.` · v1 `{HOOK} 1/5` · v2 `Thread: {title}, and why it has no server.`; P2 v0 `Most {object} sites work by uploading your file and promising to delete it.` · v1 `The usual way to {io.toLowerCase()} is a site that stores your data 'briefly'.` · v2 `Every upload is a copy you don't control.`; P3 v0 `{title} is a static page. {PRIV}. {OFFLINE}.` · v1 `{PRIV}. No account. The source is right there in the page.` · v2 `Open it once, and it keeps working on a train with no signal.`; P4 v0 `Tip: {keyword[1]} works best when {tip}.` · v1 `Example: {result.summary || io}.` · v2 `It also handles {keyword[2]}.`; P5 v0 `Try it: {URL} (mine)` · v1 `Here: {URL} — tell me what breaks (mine)` · v2 `Link, free, no account: {URL} (mine)`.
Limits: each ≤ 280 (URL = 23); no markdown; 0 hashtags; link only in P5; `(mine)` in P5.
Examples: MP v0: P1 `Your PDFs never need to leave your laptop to be merged. A short thread.` P2 `Most PDF sites work by uploading your file and promising to delete it.` P3 `Merge PDF Files is a static page. Runs in your browser — nothing you type is uploaded. Works offline once opened.` P4 `Tip: combine pdf works best when you name files 01-, 02- so the drop order is already right.` P5 `Try it: <URL> (mine)`. TH v1: P1 `Payslip maths shouldn't need a login. 1/5` P2 `The usual way to work out take-home is a site that stores your data 'briefly'.` P3 `Everything happens on your device; nothing is sent anywhere. No account. The source is right there in the page.` P4 `Example: £48,000 gross → about £3,160 a month take-home (England, 2026/27).` P5 `Here: <URL> — tell me what breaks (mine)`.

#### linkedin-post
Structure: HOOK line (≤ 100, stands alone above the fold) → blank line → STORY (3–5 short lines, who it is for from `audiences`) → WHAT (description + PRIV) → ASK → "Link in the first comment." → FIRST COMMENT = `{title}: {URL}`.
Slots: HOOK v0 `{HOOK(verb,'cost')}` · v1 `I built a free tool for {audienceName} this week.` · v2 `Small tool, big time saver for {audienceName}: {title}.`; STORY v0 `If you {audienceTask}, you know the drill: {painLine}.` · v1 `{audienceName} asked me for this more than once.` · v2 `Built it for my own month-end; sharing it.`; WHAT v0 `{description} {PRIV}. {FREE}.` · v1 `{title}: {io}. {PRIV}.` · v2 `{description} No login, no upload, no watermark.` (watermark only for media sections); ASK v0 `What would you want next to it?` · v1 `Which tool should I build for {audienceName} next?` · v2 `Forward it to the person who does this every month.`
Limits: body ≤ 1,300 (so the whole post shows before "see more"); no markdown (LinkedIn ignores it; use line breaks); ≤ 3 hashtags at the end, from §3 broad tier; **no link in body**; link in first comment; disclosure implicit (first person "I built").
Examples: MP v0: "Your PDFs never need to leave your laptop to be merged.\n\nIf you send contracts and statements to clients, you know the drill: three files, one email, and a 'merge PDF' site that wants your document.\n\nCombine several PDFs into one, in any order, without uploading anything. Runs in your browser — nothing you type is uploaded. Free, no account, no watermark.\n\nWhat would you want next to it? Link in the first comment.\n\n#SmallBusiness #Productivity #PDF" + first comment `Merge PDF Files: <URL>`. TH v1: "I built a free tool for HR and payroll teams this week.\n\nHR and payroll teams asked me for this more than once: 'what will £X actually be a month?'\n\nUK Take-Home Pay Calculator: Gross salary → UK take-home. Everything happens on your device; nothing is sent anywhere.\n\nWhich tool should I build for HR and payroll teams next? Link in the first comment.\n\n#Payroll #HR #UKTax" + first comment.

#### facebook-group
Structure: GREETING (group-appropriate) → CONTEXT (why this group) → WHAT (description, PRIV, FREE) → DISC → LINK (only if venue.linksAllowed; else `Search "1234tools {title}"`).
Slots: GREETING v0 `Hi all,` · v1 `Morning everyone —` · v2 `Quick one for the group:`; CONTEXT v0 `a few people here asked about {keywords[0]}.` · v1 `saw the {keywords[0]} question come up again.` · v2 `for anyone doing {audienceTask} this week.`; WHAT as linkedin WHAT; DISC `I run the site, so take that as read.`
Limits: ≤ 800; no markdown; 0–2 hashtags only if the group uses them; link last; emoji none.
Examples: GST v2 (Indian shopkeepers group): "Quick one for the group: for anyone raising invoices this week. Add or remove GST at current 2026 slabs, with the CGST, SGST and IGST split for your invoice. Works in the browser and keeps working offline once the page has loaded. Free, no account. I run the site, so take that as read. <URL>". MP v0: "Hi all, a few people here asked about merge pdf. Combine several PDFs into one, in any order, without uploading anything. Runs in your browser — nothing you type is uploaded. Free, no account, no watermark. I run the site, so take that as read. <URL>".

#### pinterest-pin
Structure: TITLE (≤ 100) → DESCRIPTION (≤ 500, keyword-rich, 2–4 sentences, ends with 3–5 hashtags) → ALT TEXT (≤ 500, describes the image) → destination = `URL` with `utm_medium=social`.
Slots: TITLE v0 `How to {verb.toLowerCase()} {object} without uploading (free)` · v1 `{title} — free, no account` · v2 `{io}: the private way`; DESCRIPTION v0 `{description} {PRIV}. {FREE}. Save this for the next time you need to {keywords[0]}.` · v1 `{title}: {keywords[0]}, {keywords[1]}, {keywords[2]} — all in your browser. {PRIV}.` · v2 `A free {sectionName.toLowerCase()} page: {description} {OFFLINE}.`; ALT v0 `Screenshot of {title} on 1234Tools showing {io} on a dark interface with gold accents` · v1 `Dark card titled "{title}" with the line "{io}" and the 1234Tools logo` · v2 `Infographic: three steps to {verb.toLowerCase()} {object} in the browser`.
Limits as stated; markdown no; hashtags 3–5 from §3 (niche tier first — Pinterest is search); link in destination only.
Examples: MP v0: title `How to make PDFs → PDF without uploading (free)` → the generator rewrites `object` for Make/pdf as "one PDF from several": `How to merge PDFs without uploading (free)`; description `Combine several PDFs into one, in any order, without uploading anything. Runs in your browser — nothing you type is uploaded. Free, no account, no watermark. Save this for the next time you need to merge pdf. #MergePDF #PDFTools #Paperless #FreeTools`; alt `Screenshot of Merge PDF Files on 1234Tools showing PDFs → PDF on a dark interface with gold accents`. TH v1: title `UK Take-Home Pay Calculator — free, no account`; description `UK Take-Home Pay Calculator: take home pay calculator, salary calculator UK, net pay — all in your browser. Everything happens on your device; nothing is sent anywhere. #TakeHomePay #UKSalary #PAYE #PersonalFinanceUK`; alt per v1.

#### youtube-comment
Structure: VALUE (answer or add to the video, 1–3 sentences) → TOOL named in words → DISC. No URL ever.
Slots: VALUE v0 `Good walkthrough. One thing worth adding: {tip}.` · v1 `For anyone who got here searching {keywords[0]}: {oneLineAnswer}.` · v2 `Thanks — this is the clearest explanation of {keywords[1]} I've seen.`; TOOL v0 `If you don't want to upload, search "1234tools {title}" — it runs in the browser.` · v1 `I keep a free browser version at 1234tools dot com ({title}).` · v2 `There's a no-upload version on 1234tools.com under {sectionName}.`; DISC `I run that site, so biased.`
Limits ≤ 500; no markdown; no hashtags; no URL.
Examples: MP v0: "Good walkthrough. One thing worth adding: name files 01-, 02- before you start so the order is right on the first try. If you don't want to upload, search \"1234tools Merge PDF Files\" — it runs in the browser. I run that site, so biased." TH v1: "For anyone who got here searching take home pay calculator: NI is worked per pay period, so a bonus month is taxed differently from the annual figure. I keep a free browser version at 1234tools dot com (UK Take-Home Pay Calculator). I run that site, so biased."

#### youtube-description
For the owner's own Shorts. Structure: LINE1 (what the video shows, ≤ 100, contains `keywords[0]`) → blank → LINK with `utm_medium=video` → blank → BULLETS (3: FREE, PRIV, OFFLINE/AI note) → "More tools: https://www.1234tools.com/?utm_source=youtube&utm_medium=video" → chapters none for Shorts → 3–5 hashtags.
Slots: LINE1 v0 `{title} in 30 seconds: {io}.` · v1 `How to {verb.toLowerCase()} {object} without uploading — {title}.` · v2 `{description}`.
Limits ≤ 5,000 (aim ≤ 600); first 100 chars show; markdown no; hashtags 3–5 (first three appear above the title).
Examples: MP: "Merge PDF Files in 30 seconds: PDFs → PDF.\n\n<URL>\n\n• Free, no account, no watermark\n• Runs in your browser — nothing you type is uploaded\n• Works offline once opened\n\nMore tools: https://www.1234tools.com/?utm_source=youtube&utm_medium=video\n\n#MergePDF #PDFTools #FreeTools". TH: "How to calculate your UK take-home without uploading — UK Take-Home Pay Calculator.\n\n<URL>\n\n• Free, no account\n• Everything happens on your device; nothing is sent anywhere\n• Works offline once opened\n\nMore tools: …\n\n#TakeHomePay #UKTax #Payroll".

#### quora-answer
Structure: DIRECT ANSWER (first sentence answers the question) → EXPLANATION (2–4 paragraphs, worked numbers where relevant) → OPTIONS (manual way; then the tool) → DISC → LINK.
Slots: OPEN v0 `Yes — and you don't need to upload anything to do it.` · v1 `{oneLineAnswer}` · v2 `It depends on one thing: {dependency}.`; TOOL v0 `If you'd rather not do it by hand, {title} does exactly this in the browser; {PRIV}.` · v1 `The browser-only option is {title} ({FREE}).` · v2 `I made {title} for this: {io}.`; DISC `(I built this site, so take that into account.)`
Limits ≤ 2,500; markdown: Quora's editor — plain paragraphs, one bold phrase allowed, bullets allowed; no hashtags; one link, last paragraph.
Examples: MP: "Yes — and you don't need to upload anything to do it.\n\nA PDF is a container of page objects, so 'merging' is just writing the pages of file A, then file B, into one new file with a fresh table of contents. Nothing about that needs a server; the sites that ask you to upload do so because that's their business model, not because the format needs it.\n\nBy hand: on macOS, Preview can drag pages between documents; on Windows, print-to-PDF with 'collate' works for two files.\n\nIf you'd rather not do it by hand, Merge PDF Files does exactly this in the browser; runs in your browser — nothing you type is uploaded. (I built this site, so take that into account.)\n<URL>". TH: "On £48,000 in England for 2026/27 you keep roughly £37,900 a year, about £3,160 a month, before pension or student loan.\n\nIncome tax: … NI: … [worked figures from the engine]\n\nBy hand: HMRC's rates and thresholds page and a spreadsheet.\n\nThe browser-only option is UK Take-Home Pay Calculator (free, no account). (I built this site, so take that into account.)\n<URL>".

#### stackexchange-answer
Structure: ANSWER with the complete method inline (code or steps that work without the link) → OPTIONAL TOOL paragraph → DISC (required, immediately before link) → LINK.
Slots: TOOL v0 `If you want a GUI for the same thing, {title} does it client-side.` · v1 `For a no-install route, {title} runs the same logic in the browser.` · v2 `A browser version: {title} ({io}).`; DISC `Disclosure: I'm the author of this tool.`
Limits ≤ 3,000; markdown yes (SE flavour: code fences, headers allowed); no hashtags; link last; the answer must be complete without the link or the desk refuses to draft (`question` required).
Examples: MP (Super User, "merge PDFs on the command line"): "```\nqpdf --empty --pages a.pdf b.pdf c.pdf -- out.pdf\n```\n`qpdf` preserves bookmarks per file and doesn't re-render pages; `pdfunite a.pdf b.pdf out.pdf` (poppler) is the shorter alternative. Both keep the original page sizes.\n\nIf you want a GUI for the same thing, Merge PDF Files does it client-side. Disclosure: I'm the author of this tool.\n<cleanUrl>". TH (Money SE, "how is NI calculated monthly"): full method with the 2026/27 primary threshold per month, 8% to the UEL and 2% above, worked on £4,000/month; then "For a no-install route, UK Take-Home Pay Calculator runs the same logic in the browser. Disclosure: I'm the author of this tool.\n<cleanUrl>".

#### forum-reply
Structure: QUOTE one line of the asker (if `question`) → ANSWER → TOOL (one sentence) → DISC → LINK or signature only.
Slots: TOOL v0 `There's also {title}, which does this in the browser ({PRIV}).` · v1 `I built {title} for this — {io}.` · v2 `Quickest no-install option I know is {title}.`; DISC `Disclosure: I built this.`
Limits ≤ 1,000; markdown: BBCode or markdown per venue record; no hashtags; link once or rely on signature if the forum restricts links (venue.linksAllowed=false ⇒ "see signature").
Examples: MP (UK Business Forums): "> three invoices into one PDF for the client\n\nIf it's two files, print-to-PDF with collate; more than that gets fiddly. There's also Merge PDF Files, which does this in the browser (runs in your browser — nothing you type is uploaded). Disclosure: I built this. <URL>". TH (AccountingWEB): "> client asks what £48k 'actually is'\n\nAbout £3,160 a month in England for 2026/27 with a standard code; NI per pay period is where most quick sums go wrong. I built UK Take-Home Pay Calculator for this — Gross salary → UK take-home. Disclosure: I built this. <URL>".

#### forum-post
Structure: TITLE (≤ 80) → INTRO (who I am, one line) → WHAT → HOW (PRIV/OFFLINE) → NOT → ASK → LINK.
Slots: TITLE v0 `Free browser tool: {title} ({io})` · v1 `Built a no-upload {sectionName.toLowerCase()} page — feedback wanted` · v2 `{title}: {trunc(description,50)}`; INTRO v0 `Long-time reader, first tool share. I run a small static tools site.` · v1 `Solo developer in Reading; I build small browser tools.` · v2 `Hello — sharing something I made for my own work.`; rest as reddit-post.
Limits ≤ 1,500; markdown per venue; no hashtags; link once at end; post only in "show your project"/"resources" boards.
Examples: MP v0 title `Free browser tool: Merge PDF Files (PDFs → PDF)`; TH v1 title `Built a no-upload business page — feedback wanted` (generator substitutes `sectionName` lowercased: "business"; acceptable). Bodies follow reddit-post examples.

#### devto-article
Structure: TITLE → canonical note (front matter `canonical_url` = the matching guide on 1234tools.com if `relatedGuides[0]` exists, else omit; the tool page itself is never the canonical) → INTRO (3–4 sentences: problem, why no server) → H2 ×3 → CTA → tags (≤ 4, dev.to style lowercase).
Slots: TITLE v0 `How {title} works without a server` · v1 `{io} in the browser: what it takes` · v2 `Why I stopped uploading {object} and wrote a static page instead`; H2 pool v0 `[The format problem, The client-side approach, What it doesn't do (yet)]` · v1 `[Why upload sites exist, The 200 lines that replace them, Offline, caching and the service worker]` · v2 `[The question people actually ask, Building it as plain HTML/JS, Shipping it on GitHub Pages]`; INTRO v0 `{description} Most sites that do this ask for an upload. Here's how a static page does it instead.` · v1 `I needed to {io.toLowerCase()} and didn't trust the upload-and-delete promise. This is the write-up.` · v2 `{title} is one of {count} tools on a static site. This post is the engineering behind one page.`; CTA v0 `Try it: {URL}. It's free, no account; the page source is the documentation.` · v1 `Live page: {URL}. Tell me what breaks in the comments.` · v2 `{URL} — and the next tool in the series is {relatedTool}.`
Limits: title ≤ 100; body outline + intro ≤ 1,200 chars (the owner writes the H2 bodies); markdown yes; tags ≤ 4 from §3 niche tier lowercased; link in CTA only; disclosure implicit (author voice).
Examples: MP v0: title `How Merge PDF Files works without a server`; `canonical_url: https://www.1234tools.com/guides/merge-pdfs-without-uploading/`; intro v0; H2s "The format problem" / "The client-side approach" / "What it doesn't do (yet)"; CTA v0; tags `webdev, javascript, pdf, privacy`. TH v1: title `Gross salary → UK take-home in the browser: what it takes`; no canonical; H2s v1; CTA v1; tags `javascript, webdev, finance, uk`.

#### indiehackers-post
Structure: TITLE (number or lesson) → CONTEXT (solo, static site, count of tools) → WHAT SHIPPED → WHAT HAPPENED (one honest metric from GA4 or "too early") → WHAT NEXT → LINK.
Slots: TITLE v0 `Shipped tool #{n}: {title}. Zero servers, zero signups.` · v1 `What a one-page {sectionName.toLowerCase()} tool taught me about SEO` · v2 `One person, {count} browser tools: this week's page`; CONTEXT v0 `I run 1234Tools solo from Reading, UK: static HTML, no backend for the browser tools.` …; HAPPENED v0 `Too early for numbers; I'll report back in 30 days.` · v1 `{metric}` (only if supplied; never invented) · v2 `Search Console shows impressions but no clicks yet — that's normal for week one.`
Limits ≤ 1,500; markdown yes; no hashtags; link once at end; disclosure implicit.
Examples: MP v0, TH v1 — bodies per slots; HAPPENED must be v0 or v2 when no metric is passed.

#### discord-message
Structure: one message, 2–4 lines: CONTEXT (reply to the channel's question) → TOOL → PRIV → LINK; DISC inline.
Slots: TOOL v0 `{title} does that in the browser — I run the site so obviously biased.` · v1 `I built a page for this: {title}. (Mine, so biased.)` · v2 `No-upload option: {title} — mine.`
Limits ≤ 600; markdown: Discord-flavoured (no headers); no hashtags; link last; ≤ 1 link; never in #general unless asked.
Examples: MP: "Merge PDF Files does that in the browser — I run the site so obviously biased. Nothing you drop in leaves your machine, and it works offline once loaded.\n<URL>". TH: "I built a page for this: UK Take-Home Pay Calculator. (Mine, so biased.) Everything happens on your device; nothing is sent anywhere.\n<URL>".

#### whatsapp-broadcast
Structure (owner's own list, opted-in): GREETING → ONE LINE what shipped → WHY YOU'D CARE (audience) → LINK → OPT-OUT line (required).
Slots: GREETING v0 `Hi —` · v1 `New this week on 1234Tools:` · v2 `Quick update:`; WHY v0 `Handy if you {audienceTask}.` · v1 `Built after a few of you asked for {keywords[0]}.` · v2 `{PRIV}.`; OPT-OUT `Reply STOP and I'll take you off this list.`
Limits ≤ 400; no markdown (WhatsApp bold with *asterisks* allowed once for the title); no hashtags; one link; one emoji max, none by default.
Examples: GST v2: "Quick update: *GST Calculator (India)* — Amount → GST split. Works in the browser and keeps working offline once the page has loaded. <URL>\nReply STOP and I'll take you off this list." MP v0: "Hi — *Merge PDF Files* is live: combine several PDFs into one without uploading anything. Handy if you send client paperwork. <URL>\nReply STOP and I'll take you off this list."

#### telegram-post
Structure: TITLE line (bold) → description → PRIV + FREE → LINK → 2–4 hashtags.
Slots: LEAD v0 `**{title}**` · v1 `New: **{title}**` · v2 `**{io}** — {title}`; rest fixed.
Limits ≤ 1,000; markdown: Telegram MarkdownV2 (escape `.`, `-`, `(`, `)`, `!` ); hashtags 2–4; link once; disclosure not needed on the owner's own channel; in others' groups add `I run the site.`
Examples: MP v0: "**Merge PDF Files**\nCombine several PDFs into one, in any order, without uploading anything\\.\nRuns in your browser — nothing you type is uploaded\\. Free, no account, no watermark\\.\n<URL>\n#pdf #merge #freetools". GST v2: "**Amount → GST split** — GST Calculator \\(India\\)\nAdd or remove GST at current 2026 slabs, with the CGST, SGST and IGST split for your invoice\\.\n…\n#gst #india #invoice".

#### instagram-caption
Structure: HOOK (line 1, ≤ 60) → 2–3 lines (what, PRIV/FREE, who for) → `Link in bio → 1234tools.com` → blank → 5–8 hashtags (3–5 relevant first, then brand). Emoji: at most 2, from `{✅, 📄, 💷, 🇮🇳, 🔒}` by section, only in the CTA line.
Slots: HOOK = `HOOK(verb, venue.angle || 'no-signup')`; LINE2 v0 `{title}: {io}.` · v1 `{trunc(description, 80)}` · v2 `Free, no account, nothing uploaded.`; LINE3 v0 `For {audienceName}.` · v1 `Save this for later.` · v2 `Works offline once opened.`
Limits ≤ 2,200 (aim ≤ 300); no markdown; hashtags 5–8; link none (bio).
Examples: MP: "Your PDFs never need to leave your laptop to be merged.\nMerge PDF Files: PDFs → PDF.\nFor small businesses and students.\nLink in bio → 1234tools.com 📄\n\n#MergePDF #PDFTools #Paperless #FreeTools #1234Tools". TH: "Payslip maths shouldn't need a login.\nEstimate income tax, National Insurance and net pay from a gross salary.\nSave this for later.\nLink in bio → 1234tools.com 💷\n\n#TakeHomePay #UKSalary #PAYE #UKTax #1234Tools".

#### tiktok-caption
Structure: HOOK (≤ 60) → one clause → `1234tools.com` in words → 3–5 hashtags; total shown ≤ 150, so everything after 150 is hashtags only.
Slots: HOOK = `HOOK(verb, 'speed')`; CLAUSE v0 `free, no account` · v1 `nothing uploaded` · v2 `works offline`.
Limits ≤ 150 shown (hard 2,200); hashtags 3–5; no link.
Examples: MP: "Merge PDFs without uploading them. Free, no account. 1234tools.com #mergepdf #pdf #freetools #lifehack" (102). TH: "What £48k really is per month. Nothing uploaded. 1234tools.com #takehomepay #uksalary #payday" (97).

#### threads-post
Structure: HOOK → VALUE → PRIV → URL (Threads shows a link card) → `(mine)`.
Limits ≤ 500; no markdown; ≤ 2 hashtags (Threads supports one topic tag; use 0–1); link once.
Examples: MP: "Your PDFs never need to leave your laptop to be merged. Merge PDF Files: PDFs → PDF, in any order. Runs in your browser — nothing you type is uploaded. <URL> (mine)". TH: "£48k in England is about £3,160 a month. Estimate income tax, National Insurance and net pay from a gross salary — everything on your device. <URL> (mine)".

#### bluesky-post
Same structure as threads-post; ≤ 300 graphemes; URL counts at its real length (no shortener), so VALUE truncates first; 0–2 hashtags; `(mine)` kept.
Examples: MP: "Your PDFs never need to leave your laptop to be merged. Merge PDF Files — nothing uploaded, no account. <cleanUrl> (mine)". TH: "Payslip maths shouldn't need a login. UK Take-Home Pay Calculator, everything on your device. <cleanUrl> (mine)".

#### mastodon-post
Structure: HOOK → VALUE → PRIV → URL → 2–4 hashtags (Mastodon discovery is hashtag-driven) → `(mine)`. CW: none. Alt text required on any attached image (use pinterest ALT).
Limits ≤ 500; URL counts as 23; no markdown; UTM allowed on the owner's instance; no boosting-for-boosts.
Examples: MP: "Your PDFs never need to leave your laptop to be merged. Merge PDF Files: PDFs → PDF. Runs in your browser — nothing you type is uploaded; works offline once opened. <URL> (mine) #PDF #FreeSoftware #Privacy #WebDev". TH: "…<URL> (mine) #UKTax #Payroll #Finance #WebDev".

#### newsletter-blurb
Structure: 40–60 words, one paragraph: TITLE in bold → what → PRIV → who for → link text "Try it".
Slots: OPEN v0 `**{title}** — {description}` · v1 `New: **{title}**. {io}.` · v2 `For {audienceName}: **{title}**.`; CLOSE v0 `[Try it]({URL}).` · v1 `[Open the tool]({URL}) — free, no account.` · v2 `[Have a look]({URL}).`
Limits 40–60 words (hard 60); markdown yes; no hashtags; link once; `utm_medium=newsletter`.
Examples: MP: "**Merge PDF Files** — Combine several PDFs into one, in any order, without uploading anything. Runs in your browser — nothing you type is uploaded, and it keeps working offline once opened. Built for anyone who sends paperwork in batches. [Try it](<URL>)." (46 words). TH: "New: **UK Take-Home Pay Calculator**. Gross salary → UK take-home. Estimate income tax, National Insurance and net pay for England, Wales and Northern Ireland, with everything computed on your device. Useful for payroll teams and anyone weighing an offer. [Open the tool](<URL>) — free, no account." (49).

#### directory-listing
Fields: NAME `1234Tools — {title}` (or `1234Tools` for site-level); TAGLINE ≤ 60 (ph-launch TAGLINE pool); SHORT ≤ 160 `{description} {FREE}.` truncated; LONG ≤ 500 `{description} {PRIV}. {FREE}. {OFFLINE}. One of {count} browser tools from MVR IT Services LTD, Reading, UK; analytics only after you accept the consent bar.`; CATEGORIES from section map (pdf → "PDF, Productivity, Privacy"; business → "Finance, Small Business, Productivity"; india → "Finance, Tax, India"; developer → "Developer Tools, Utilities"; image/ai-image → "Design, Image Editing"; ai → "AI, Productivity"; others → sectionName + "Utilities"); TAGS = first 6 keywords lowercased plus `free`, `no-signup`, `offline`.
Markdown no; hashtags none; link = `cleanUrl` plus `utm_medium=directory` where the directory keeps query strings.
Examples: MP: name `1234Tools — Merge PDF Files`; tagline `PDFs → PDF — in your browser, nothing uploaded`; short `Combine several PDFs into one, in any order, without uploading anything. Free, no account, no watermark.`; long per rule; categories PDF, Productivity, Privacy; tags merge pdf, combine pdf, join pdf files, pdf merger, concatenate pdf, free, no-signup, offline. TH: analogous with categories Finance, Small Business, Productivity.

#### email-outreach
For a backlink / round-up pitch to a blogger or resource page. Structure: SUBJECT (3 options) → BODY (≤ 90 words: who, the specific page of theirs, the one-line fit, the link, the no-pressure close) → signature → FOLLOW-UP (one, 7 days later, ≤ 50 words).
Subjects: s1 `A no-upload {keywords[0]} tool for your {pageTopic} page` · s2 `Small addition for "{theirPageTitle}"` · s3 `{title} — free, runs in the browser (for your list)`.
Body: `Hi {firstName}, I'm Vishal from 1234Tools (MVR IT Services, Reading). Your "{theirPageTitle}" page lists {pageTopic} tools, and I think one is missing: {title} — {description} It runs in the browser, so nothing is uploaded; free, no account. Link: {cleanUrl}. If it doesn't fit, no reply needed — and if there's a tool you wish existed, tell me and I'll build it. Vishal`
Follow-up: `Hi {firstName}, a quick nudge on the {title} note from last week — happy to drop it if it's not a fit. Vishal, 1234Tools`
Limits as stated; plain text; no hashtags; one link; disclosure built in.
Examples: MP → "A no-upload merge pdf tool for your PDF tools page" / "Small addition for \"Best free PDF tools 2026\"" / "Merge PDF Files — free, runs in the browser (for your list)". TH → analogous with `pageTopic` "salary calculator".

#### signature
≤ 2 lines, ≤ 120 chars total: L1 `Vishal · 1234tools.com — 1,200+ free browser tools, nothing uploaded` · L2 (optional, per forum topic) `{sectionName}: {title}` with link if the forum allows.
Examples: UK Business Forums: "Vishal · 1234tools.com — 1,200+ free browser tools, nothing uploaded / Business: UK Take-Home Pay Calculator". r/ not applicable (Reddit has no signatures).

#### bio
Each ≤ 150 chars. Instagram: `Free browser tools that don't upload your files. PDF · salary · GST · images. Solo-built in Reading, UK. Analytics only if you opt in. ↓` Variants swap the middle list by top sections of the month. X: `1,200+ free tools that run in your browser — nothing uploaded, no account. Built by one person. Posts: what shipped, what broke. 1234tools.com` TikTok: `Free tools, no upload, no signup. PDF, salary, GST, images. Link below.` Hashtags none; link in the bio field only.

### 3. Hashtag table

Ranked broad → niche. Instagram norm (2025–26): 3–5 relevant tags outperform 30; the generator takes the first 3 niche-relevant tags for the section plus 1–2 brand tags and never exceeds 8.

| section | hashtags |
|---|---|
| business | #SmallBusiness #Productivity #Accounting #Invoicing #Payroll #UKBusiness #VAT #MTD #TakeHomePay #PAYE #Bookkeeping |
| ai | #AI #Productivity #AITools #Automation #SmallBusiness #Copywriting #DocumentAI #ChatGPTAlternative #AIForWork #Summarizer |
| pdf | #PDF #Productivity #Paperless #PDFTools #MergePDF #SplitPDF #CompressPDF #PDFConverter #DocumentManagement #GoPaperless |
| education | #Teachers #EdTech #School #Timetable #TeacherLife #Classroom #SchoolAdmin #LessonPlanning #StudyTools #GradeCalculator |
| india | #India #GST #IncomeTax #Finance #CTC #InHandSalary #GSTIndia #ITR #EPF #HRA #IndianBusiness #TaxIndia |
| developer | #WebDev #Programming #JavaScript #DevTools #JSON #Regex #Base64 #Coding #100DaysOfCode #Developer #CodeNewbie |
| image | #Photography #Design #ImageEditing #PhotoEditing #ResizeImage #CompressImage #WebP #Graphics #ContentCreator #NoWatermark |
| ai-image | #AIArt #Design #ImageEditing #BackgroundRemover #Upscale #AIPhoto #OnDeviceAI #PhotoEditing #Creators #NoWatermark |
| ai-video | #Video #Captions #ContentCreator #Subtitles #Shorts #VideoEditing #Whisper #AutoCaptions #Accessibility #OfflineAI |
| text | #Writing #Productivity #WordCount #TextTools #Editing #Copywriting #Students #Writers #CaseConverter #Markdown |
| mathematics | #Maths #Math #Education #Students #Percentage #Algebra #Calculator #Homework #STEM #StudyTips |
| finance | #PersonalFinance #Investing #Savings #CompoundInterest #Loans #Mortgage #MoneyTips #Budgeting #FinancialLiteracy #UKFinance |
| time | #Productivity #TimeManagement #Timezones #Countdown #Calendar #WorkingDays #Scheduling #RemoteWork #DateCalculator #Planning |
| health | #Health #Wellness #BMI #Fitness #Nutrition #Calories #Hydration #HealthTools #Sleep #Wellbeing |
| qr | #QRCode #Marketing #SmallBusiness #QRGenerator #Menus #Payments #Events #Branding #Print #ContactlessPayment |
| utilities | #Productivity #LifeHacks #Tools #PasswordGenerator #Checklist #Utilities #Organised #Minimalism #DigitalTools #TechTips |
| engineering | #Engineering #STEM #CivilEngineering #MechanicalEngineering #Calculator #UnitConverter #Students #EngineeringLife #Construction #Design |
| design | #Design #UIDesign #GraphicDesign #ColorPalette #Typography #WebDesign #DesignTools #Branding #UX #Creative |
| conversions | #UnitConverter #Converter #Metric #Imperial #Cooking #Travel #Students #Engineering #Measurement #Conversion |

Brand/general (6): `#1234Tools #FreeTools #NoSignup #PrivacyFirst #WorksOffline #BuildInPublic` — at most 2 per post; `#BuildInPublic` only on maker posts (X, IndieHackers, Threads).

### 4. Hook library

Each hook ≤ 70 chars, works as a 7-second video opener or a post's first line. `HOOK(verb, angle)` filters by both tags and picks index `variant`; if fewer than 3 match, fall back to verb-only, then angle-only.

| # | hook | verb | angle |
|---|---|---|---|
| 1 | Your PDFs never need to leave your laptop to be merged. | Make | privacy |
| 2 | Three files, one PDF, zero uploads. | Make | speed |
| 3 | Stop paying monthly for a button. | Make | cost |
| 4 | Make it on the train with no signal. | Make | offline |
| 5 | No account. No email. Just the file. | Make | no-signup |
| 6 | Here's the finished PDF — now watch how. | Make | result-first |
| 7 | Convert it without sending it anywhere. | Convert | privacy |
| 8 | Drop, convert, done before the kettle boils. | Convert | speed |
| 9 | The converter that costs exactly nothing. | Convert | cost |
| 10 | Works in airplane mode. Really. | Convert | offline |
| 11 | Convert first, sign up never. | Convert | no-signup |
| 12 | 2.4 MB → 310 KB. Same picture. | Convert | result-first |
| 13 | Check it before you send it, not after. | Check | speed |
| 14 | Nobody else sees what you're checking. | Check | privacy |
| 15 | The free check that saves a penalty. | Check | cost |
| 16 | Validate offline; the rules are in the page. | Check | offline |
| 17 | No login to find out if it's valid. | Check | no-signup |
| 18 | Red means fix it. Green means send. | Check | result-first |
| 19 | Payslip maths shouldn't need a login. | Calculate | no-signup |
| 20 | Your salary stays on your screen. | Calculate | privacy |
| 21 | £48k in England is about £3,160 a month. | Calculate | result-first |
| 22 | Type one number. Read the whole breakdown. | Calculate | speed |
| 23 | The calculator that never asks for your card. | Calculate | cost |
| 24 | Still works when the office Wi-Fi doesn't. | Calculate | offline |
| 25 | 18% GST on ₹10,000: here's the split. | Calculate | result-first |
| 26 | Clean up the mess without uploading it. | Clean up | privacy |
| 27 | Paste. Click. Tidy. | Clean up | speed |
| 28 | Free, because tidying text shouldn't be a subscription. | Clean up | cost |
| 29 | Clean it offline; nobody reads your draft. | Clean up | offline |
| 30 | Before and after, on one screen. | Clean up | result-first |

Rules: result-first hooks (6, 12, 18, 21, 25, 30) require `result.summary` or a stock figure checked against the engine at draft time; hook 21 and 25 are regenerated each tax year by running the tool, never edited by hand.

### 5. Weekly routine (≤ 45 min/day)

| day | venue class | work | cap |
|---|---|---|---|
| Mon | Search-intent answers: Reddit comments, Quora, Stack Exchange | 20 min reading saved searches (desk matches `keywords` to new threads), 2 help-only replies, ≤ 1 linked reply | 1 link |
| Tue | Owner channels: X post or thread, Mastodon, Bluesky, Threads | one tool, one angle, 4 variants from different templates; schedule none, post by hand | 1 tool |
| Wed | Communities: 1 forum reply or Facebook group (on its allowed day), 1 Discord help | 9:1 upkeep; link only if ratio allows | 1 link |
| Thu | Professional: LinkedIn post (first-comment link) + 2 comments on others' posts | 25 min | 1 post |
| Fri | Video/visual: one Short or Pin from a tool recorded on the phone; YouTube description + Pinterest pin | 45 min | 1 asset |
| Sat | Newsletter blurb and WhatsApp/Telegram broadcast (fortnightly) + directory submissions (2) | 30 min | 2 directories |
| Sun | Off, or read removals/criticism and reply | 10 min | 0 links |

7-day launch sequence for a new tool: D0 ship + share-sheet smoke test + Search Console URL inspection; D1 owner channels (x-post, mastodon, bluesky, threads — different variants); D2 Reddit post in one "show your work" sub, HN Show only if the tool has a technical story (max 1 Show HN per month); D3 LinkedIn + newsletter blurb queued; D4 one community answer where the tool fits a live question; D5 Pinterest pin + Short; D6 directory listing ×2 + email-outreach ×3 to resource pages found by the desk; D7 read everything, reply, log.

Monthly review (first Monday, 45 min): GA4 → Acquisition → Traffic acquisition, filter `utm_source` by venue id, compare sessions and engaged sessions per `utm_content`; Search Console → Performance, filter page prefix per section, note queries with impressions > 50 and position 8–20 as next month's answer targets; prune venues with 0 engaged sessions after 3 months; update hooks 21/25 figures; re-check the 9:1 ledger per account.

Cadence caps the desk enforces (refuses to draft when exceeded): per venue — Reddit 1 linked item per sub per 14 days, 3 per week across subs; HN 1 Show per 30 days, 1 linked comment per 14 days; LinkedIn 2 posts per week; X 1 linked post per day; Facebook group 1 per group per 30 days; Quora/SE 2 linked answers per week each; forums 1 linked post per forum per 30 days; Product Hunt 1 launch per 90 days; newsletter 1 per 14 days; WhatsApp/Telegram broadcast 1 per 14 days; email outreach 5 per week, 1 follow-up each. Per thread — 1 linked reply ever. Per tool — 1 venue per day, 4 venues per week, same venue not within 60 days; the share-sheet is exempt (that's the visitor's choice, not the owner's).

### 6. Red lines

Platform rules that get accounts banned (the desk shows the relevant line before any publish click):
- Reddit: vote manipulation, alt accounts, posting the same link across subs in a day, > 10% self-promo, ignoring sub rules, editing in a link after approval, DM-spamming askers.
- HN: multiple accounts, asking for upvotes anywhere, reposting a Show HN that died within 12 months, UTM or tracking in the URL field.
- Stack Exchange: any answer that is a link without the method, missing disclosure, same link in several answers, voting rings.
- Quora: answer that is mostly a link, posting the same answer to many questions, affiliate-style wording.
- LinkedIn: automation tools, connection-blast scripts, engagement pods.
- X, Threads, Bluesky, Mastodon: automated posting, repeated identical text, follow/unfollow churn, trending-tag hijacking.
- Facebook groups: posting links on non-promo days, joining to post and leaving, cross-posting one link to many groups in a day.
- Instagram/TikTok: 30-tag spam, bot comments, link-drop comments on others' videos, buying followers.
- YouTube: URLs in comments (held and flagged), comment-spamming many videos with the same text.
- Discord/Telegram/WhatsApp: unsolicited DMs, broadcast to people who did not opt in (WhatsApp policy violation), link-dropping in help channels without helping.
- Email: no unsubscribe/opt-out, misleading subjects, pretending to be a reader (UK PECR/GDPR applies).
- Everywhere: sockpuppets, fake reviews, fake "a friend sent me this", AI-generated praise, and any automation of publishing — the desk must never implement scheduled or bulk posting.

The site's own truthfulness rules (the generator enforces as string checks and the human re-reads):
- Never "100% private", "no third-party requests", "no tracking" unqualified. Always "nothing contacts a third party on page load; analytics only after you opt in" when privacy is claimed in full.
- AI for Business tools are not free beyond 10 calls a month, need an account, and send text to a server; every AI mention uses the freemium PRIV/FREE clauses. No "offline" claim for them.
- "No watermark" only for media tools (image, pdf, ai-image, ai-video). "Works offline once opened" only for browser tools.
- Figures come from running the engine at draft time; tax-year figures carry the year; no made-up metrics or user counts.
- Comparisons never disparage: no competitor names in posts; the /compare/ pages are the only place a competitor is mentioned, and politely.
- r/privacy, r/PrivacyGuides and r/degoogle are off-limits venues (Clarity session replay after opt-in would be a fair objection there).
- Disclosure on every linked post where the author voice is not already obvious; a first-person "I built" counts, an unsigned recommendation does not.
- One link per piece, placed where the venue allows; never edit a link into a post after it is approved.
- The share sheet never serialises free text beyond 200 chars, files, or anything not declared in PREFILL/`?v=`/`?text=`; the statutory/payroll tools default to "Include my numbers" off.