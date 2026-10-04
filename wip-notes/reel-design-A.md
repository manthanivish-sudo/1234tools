Scope note for the orchestrator: the computed task asked for a Reel Maker spec, but the relayed user request — which the harness says wins — is a share button on every tool page (with/without the calculation, WhatsApp-style shortcuts, per-tool description/OG). The spec below is for that feature. All repo facts were verified in E:/projects/1234Tools (render-core.js prefill/mount, build-crumbs.js post-processor pattern, aiimg-share.js, build/make-og.js, build/make-pwa-icons.js, sw.js, assets/icons.svg, build/jobs.js).

# Share on every tool page — implementation spec

## 0. What "best" means here, and the decisions that follow from it

| Decision | Why |
|---|---|
| **One component, one post-processor** (`build-share.js`, same shape as `build-crumbs.js`), not 1,281 hand-edits and not 11 generator patches | Marker-delimited, idempotent, `--check`-able, exported `render()` for generators that write pages. Order: `build-pdf-ship → build-sections → build-crumbs → build-share → build-outbound → build-pwa`. |
| **Targets are built in the browser** by `assets/share.js`, not as static `wa.me` anchors | The link must carry the visitor's numbers, the UTM tags and a per-target message; none of that exists at build time. Every tool already needs JS. |
| **"With my numbers" rides in the URL**, using the `?key=value` prefill render-core already reads for every input | No new state format: `prefill()`/`fromQuery()` validate and ignore unknown keys; converters already read `?v=`; text tools read `?text=`. The recipient opens the page on the same figures. |
| **Values are included by default only once the visitor has touched a calculator**, and the exact message is previewed before anything is sent; text tools are opt-in; AI tools and file tools never include input | `mvr:tool-used` already marks "touched". Numbers in a link are the feature; surprises are not. |
| **No third-party SDKs, ever.** Targets are plain intent URLs opened on click; icons are monochrome outlines in our own sprite; the QR code is drawn by `/engine/qr.bundle.js` | Keeps "nothing contacts a third party on page load" true. |
| **Per-tool OG image** for the 233 named tools + one per conversion family (12), flat colours, generated like `build/make-og.js` | WhatsApp, LinkedIn, Facebook, Telegram, iMessage and Slack show the card, not the tool. One site-wide card made every shared tool look the same. Flat PNGs stay ~20–30 KB (make-pwa-icons' finding: gradients make PNGs six times bigger). |
| **Native share sheet first on phones**, explicit targets on desktop | On Android/iOS `navigator.share` is WhatsApp/Telegram/SMS/anything in one tap. On Windows Chrome the OS sheet is poor, so desktop gets WhatsApp Web, Telegram, X, LinkedIn, Facebook, Reddit, Email, Copy, QR. |
| **UTM on every shared link**: `utm_source=<target>&utm_medium=share&utm_campaign=<section>&utm_content=<slug>` | GA4 Source/Medium shows `whatsapp / share` etc., distinct from the owner's promotion (`utm_medium=social|community|…`) and from outbound (`utm_source=1234tools.com`). Survives copy-paste, which referrers do not. |

Two phases. **Phase 1** (one PR): bar + menu + targets + state links + per-tool OG + tests. **Phase 2**: "Share as image" result card (canvas PNG through `navigator.share({files})`).

## 1. What the visitor sees

### 1.1 The bar
Directly under `p.lede` on every tool page (inside `article.tool`, before `.calc` / `.tool-io`):

```
[ ⇪ Share ]  (WhatsApp) (Telegram) (Copy link) (⋯)      [✓ Include my numbers]    Link copied
```

- `.share-main` — `.btn-ghost` with `#i-share` icon and the word "Share". Phone: opens the OS share sheet. Desktop: opens the menu.
- `.share-quick` — three 36×36 icon buttons (44×44 on `pointer: coarse`): WhatsApp, Telegram, Copy link, then `⋯ More` (opens the menu). Each has `aria-label` and `title` ("Share on WhatsApp").
- `.share-values` — a `role="switch"` chip, present only on `calc`/`convert`/`text` kinds; hidden until `mvr:tool-used` fires (calc/convert) or the textarea is non-empty (text). Label: "Include my numbers" (calc/convert) / "Include my text" (text). Default: **checked** for calc/convert, **unchecked** for text. Hint (menu only): "Your numbers travel only inside the link, so the person you send it to opens the calculator on the same figures."
- `.share-status` — `role="status" aria-live="polite"`, shows "Link copied" / "Message copied" / "Could not copy — select the text in the preview" for 2 s.

### 1.2 The menu (`.share-menu`, `role="dialog" aria-label="Share this tool"`, non-modal)
Anchored below the bar (absolute, `.share { position: relative }`), `width: min(380px, calc(100vw - 32px))`, `.panel` styling (bg `--bg-2`, 1px `--border`, radius 18px, shadow).

1. **Preview** — `<pre class="share-preview" tabindex="0">` with the exact message that will be sent for the "Copy message" target (see §2). Updates live on input and on the switch. Max 7 lines visible, scrolls.
2. **Switch row** (kinds calc/convert/text) — the same switch as the bar (one element moved, or two synchronised; implement as two buttons bound to one state) + the hint.
3. **Targets grid** `.share-targets` (2 columns, each `a.share-target` with icon + label): WhatsApp · Telegram · X · LinkedIn · Facebook · Reddit · Email · SMS (SMS only when `coarse` pointer). `target="_blank" rel="noopener noreferrer nofollow"`. `href` is recomputed on `pointerdown`/`focus` so the click is a synchronous navigation (popup blockers) with current values.
4. **Actions row** — `Copy link` · `Copy message` · `QR code` (`.btn-ghost`). QR shows `.share-qr` (inline SVG 180×180 + "Scan to open this on your phone"), using `/engine/qr.bundle.js` loaded on demand exactly as `/qr/qr-code-generator/` loads it (read `window.QR`'s exports there; encode the `qr` link; module 0 shape; EC level M).
5. **Close** — `×` button top-right, Escape, click outside. Focus goes to the preview on open and back to the opener on close.

### 1.3 Per-kind behaviour

| `data-share-kind` | Pages | Values in link | Message body |
|---|---|---|---|
| `calc` | 1,218 pages mounted with `MVRTool.mount(` minus conversions | All inputs whose value differs from the spec default, after touch, switch default ON | Title, up to 4 result lines, "For: …" input line, link |
| `convert` | 1,048 `/conversions/<family>/<pair>/` (`mountConverter(`) | `?v=` when ≠ 1 | "5 km = 3.1069 mi — Convert Kilometre to Mile", link |
| `text` | pages loading `/engine/render-dev.js` whose `.tool-io` holds a `textarea` (text tools, dev formatters) | `?text=` (≤1,500 chars) only when the switch is ON (default OFF) | Tool-only message; with switch ON, the link carries the text |
| `file` | pdf, image, ai-image, ai-video, qr, utilities with file input | never | Tool-only |
| `ai` | 49 `/ai/*` (`render-ai.js`) | never | Tool-only, "Free to try" wording |
| `page` | `/guides/*`, `/compare/*`, `/for/*` (Phase 1 optional, same block) | never | Title + description |

## 2. Message and link templates

Context read at runtime, no new data files:
- `title` = `article h1` textContent with the glyph removed (e.g. "GST Calculator (India)")
- `desc` = `meta[name=description]` content (per tool, already written by the generators)
- `base` = `link[rel=canonical]` href (absolute, no query)
- `section` = `body[data-sec]` (fallback: first path segment); `slug` = `article[data-tool]` (fallback: last path segment; conversions: `<family>-<pair>`)
- `kind` = `[data-share][data-share-kind]`

### 2.1 Links
```
link(target, withValues) =
  base
  + '?' + [ ...stateParams(withValues), 'utm_source=' + SOURCE[target], 'utm_medium=share',
            'utm_campaign=' + section, 'utm_content=' + slug ].join('&')
```
`SOURCE`: whatsapp, telegram, x, linkedin, facebook, reddit, email, sms, copy, `share-sheet` (native), qr. State params are produced by `MVRTool.state()` (§3) and come first so a reader sees `?amount=1200&rate=18&utm_…`. Values are `encodeURIComponent`'d. For `text` kind: `text=<encoded>` only if `withValues && ta.value.length <= 1500`.

### 2.2 Message text (`message(target, withValues)`)
Pills by kind: `free` → "Free, runs in your browser, no account." · `ai` → "Free to try." · `convert` → "Free, works offline once opened."

**Tool only** (every kind when no values):
```
{title} — {desc} {pills}
{link}
```
**calc with values** (lines from `MVRTool.state().lines`, primary first, max 4; inputs max 4, non-default only, raw `el.value`, label from the spec):
```
{title}
{line1.label}: {line1.value}
{line2.label}: {line2.value}
…
For: {input1.label} {value}, {input2.label} {value}
Check it yourself: {link}
```
Example: `GST Calculator (India)\nGST amount: ₹216.00\nTotal (incl. GST): ₹1,416.00\nCGST: ₹108.00\nSGST: ₹108.00\nFor: Amount 1200, GST rate 18\nCheck it yourself: https://www.1234tools.com/india/gst-calculator/?amount=1200&rate=18&utm_source=whatsapp&utm_medium=share&utm_campaign=india&utm_content=gst-calculator`

**convert with values**: `{v} {fromSymbol} = {result} {toSymbol} — {title}\n{link}`

**Per-target shaping**

| Target | URL | Notes |
|---|---|---|
| WhatsApp | `https://wa.me/?text={msg}` | `msg` includes the link (WhatsApp previews the first URL → OG card). Desktop opens WhatsApp Web. |
| Telegram | `https://t.me/share/url?url={link}&text={msgWithoutLink}` | |
| X | `https://x.com/intent/post?text={short}&url={link}` | `short` = `{title}: {desc}` cut at a word boundary to 280 − 24 − 1 chars with "…"; no hashtags, no values (results do not fit). |
| LinkedIn | `https://www.linkedin.com/sharing/share-offsite/?url={link}` | Text not accepted; the OG card does the talking. |
| Facebook | `https://www.facebook.com/sharer/sharer.php?u={link}` | Same. |
| Reddit | `https://www.reddit.com/submit?url={link}&title={title} — {desc}` | |
| Email | `mailto:?subject={title} — a free tool&body={msg}` | `\n` → `%0D%0A`. |
| SMS | `sms:?&body={msg}` | The `?&` form works on iOS and Android. |
| Copy link | clipboard ← `link` | status "Link copied" |
| Copy message | clipboard ← `msg` | status "Message copied" |
| Native | `navigator.share({ title, text: msgWithoutLink, url: link })` | Only when `navigator.share` and (`navigator.userAgentData?.mobile` or `/Android|iPhone|iPad/.test(ua)` or `matchMedia('(pointer: coarse)').matches`). `AbortError` is silent. |
| QR | SVG of `link` (source `qr`) | |

## 3. Shareable state — one small addition to render-core

Add to `engine/render-core.js` (and bump `sw.js` `V`): `window.MVRTool.state()`.

```js
// inside the IIFE, next to mount()
let live = null;   // { kind, spec|dim, form, out, touched: () => bool, defaults: {key: string} }

mount(spec, root) { … live = { kind: 'calc', spec, form, out, touched: () => touched }; … }
mountConverter(dim, dimData, convert, root, preset) { … live = { kind: 'convert', form, out, dimData, touched: () => wasUsed }; … }

state() {
  if (!live) return null;
  const inputs = [];                       // [{ key, label, value }]
  if (live.kind === 'calc') {
    live.spec.inputs.forEach(inp => {
      const el = live.form.querySelector('[name="' + inp.key + '"]');
      if (!el || el.value === '') return;
      let def = inp.default; if (def === 'TODAY') def = new Date().toISOString().slice(0, 10);
      if (String(def ?? '') === String(el.value)) return;              // default: not worth a byte
      if (inp.type === 'text' && el.value.length > 200) return;        // fromQuery() caps text at 200
      inputs.push({ key: inp.key, label: inp.label, value: String(el.value) });
    });
  } else {
    const v = live.form.querySelector('#u-value').value;
    if (v !== '' && v !== '1') inputs.push({ key: 'v', label: 'Value', value: v });
  }
  const lines = [...live.out.querySelectorAll('.result')]
    .map(r => ({ label: r.querySelector('.result-label')?.textContent.trim() || '',
                 value: r.querySelector('.result-value')?.textContent.trim() || '',
                 primary: r.classList.contains('result-primary') }))
    .filter(l => l.value && l.value !== '—')
    .sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0))
    .slice(0, 4);
  return { kind: live.kind, touched: live.touched(), inputs, lines };
}
```
Round trip is guaranteed by the existing `fromQuery()`: numbers as `String(n)`, dates `YYYY-MM-DD`, selects by option value, text ≤ 200. The converter's "All units" table rows are also `.result`; `slice(0,4)` after the primary sort keeps the headline first — for `convert` the message uses only `lines[0]`.

`share.js` re-reads `state()` on every `input`/`change` on `.tool-form` (debounced 150 ms) and on `mvr:tool-used`; it also re-reads on `Prefs.onChange` if present (currency repaint changes the formatted lines). Caveat to accept: the message carries the sender's formatted values (their currency preference); the link carries raw numbers, which the recipient sees in their own preference. Values differ in symbol, never in number.

Text kind: `share.js` finds `document.querySelector('.tool-io textarea')` (render-dev `mountCode` owns `ta`), reads it on `input`; `?text=` is read by render-dev at `given.slice(0, 4000)`.

## 4. Per-tool Open Graph

### 4.1 Generator `build/make-og-cards.js` (puppeteer-core, same technique as `build/make-og.js`)
- Reads `assets/finder-index.js` (`window.FINDER_INDEX.tools` → `[title, path, 'i-glyph', sectionName, description, …]`, 233 rows) and `build/sections.js` for the 12 conversion families (`/conversions/<family>/`: name, glyph via `pwa-glyphs.json`/sprite `i-<family>`), pricing via `require('./collections.js').pricingFor(path)`.
- Glyph body pulled from `assets/icons.svg` with the same `glyphBody()` as `build/make-pwa-icons.js`.
- Writes `assets/og/<section>-<slug>.png` (tools) and `assets/og/conversions-<family>.png` (families), 1200×630, `deviceScaleFactor: 1`. Flags: `--check` (render, compare bytes, write nothing), `--only <path>`, `--verbose`. Fonts inlined as base64 as make-og.js does. Inert on `require()`; exports `ogFileFor(path)`.
- **Layout, flat colours only** (no radial glows): body `#06080f`. Padding 64/72. Top row: logo.svg inline 44px + "1234Tools" Sora 700 26px `#f4f6fb`; right: section pill (Inter 600 20px `#f7c948` on `#1a1a12`, radius 999). Middle: glyph plate 168×168, `#101627`, radius 36, 1px `#2a2f44`, glyph stroked `#f7c948` 1.75 scaled 24→108; to its right (gap 40): title Sora 800 60px `#ffe29a`, letter-spacing −.03em, max 2 lines (fit: try 60/52/44 px), then description Inter 400 28px `#b7bfd2` max 2 lines, ellipsised. Bottom row: pills Inter 600 20px `#f4f6fb` on `#101627` — free tools: "Free" · "Runs in your browser" · "No account"; freemium (AI): "Free to try" · "Needs an account"; conversions family: "Free" · "Works offline" · "1,048 conversions" (count from `searchIndexTools()`); right-aligned `www.1234tools.com<path>` Inter 22px `#8790a5`.
- Expected weight 20–35 KB each, ≈245 files, ≤ 8 MB total.

### 4.2 Tags (written by `build-share.js`, only when the PNG exists on disk)
```html
<meta property="og:image" content="https://www.1234tools.com/assets/og/india-gst-calculator.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="GST Calculator (India) — free tool on 1234Tools">
<meta name="twitter:image" content="https://www.1234tools.com/assets/og/india-gst-calculator.png">
```
Replace the existing `og:image` line; insert width/height/alt immediately after it (replace if already present); insert `twitter:image` after `twitter:description` (replace if present). Conversions map `/conversions/<family>/<pair>/` → `conversions-<family>.png`. Pages without a card keep `og-image.png` untouched. `twitter:card` stays `summary_large_image`.

### 4.3 After deploy
WhatsApp and Facebook cache cards per URL. Shared links from the bar carry UTM query strings, so they are new URLs and show the new card at once; for bare URLs the owner uses Facebook's Sharing Debugger "Scrape again" on the eight POPULAR tools. Nothing else to do.

## 5. Markup inserted by `build-share.js`

After the first `</p>` of `p.lede` inside `<article class="tool…">` (if no lede: after `</h1>`):

```html
<!-- SHARE: generated by build-share.js, do not edit -->
<div class="share" data-share data-share-kind="calc" role="group" aria-label="Share this tool">
  <button type="button" class="btn-ghost share-main" aria-haspopup="dialog" aria-expanded="false" aria-controls="share-menu"><svg class="ico" aria-hidden="true" focusable="false"><use href="/assets/icons.svg#i-share"></use></svg><span>Share</span></button>
  <span class="share-quick"></span>
  <span class="share-status" role="status" aria-live="polite"></span>
</div>
<script src="/assets/share.js" defer></script>
<!-- /SHARE -->
```
`share.js` builds `.share-quick` children, the switch and `#share-menu` (appended inside `.share`). Kind rules, evaluated on the page source in this order: contains `MVRTool.mountConverter(` → `convert`; contains `MVRTool.mount(` → `calc`; loads `/engine/render-ai.js` → `ai`; loads `/engine/render-dev.js` → `text`; otherwise article has `data-tool` → `file`; `/guides/`, `/compare/`, `/for/` with `.lede` → `page`. Skipped: home, 404, redirect stubs, untracked HTML (same `unpublished()` as crumbs), `/account/`, `/settings/`, `/pricing/`, `/privacy/`, `/terms/`, `/cookies/`, `/contact/`, `/about/`, `/trust/`, `/practice/`, hub index pages.

Idempotent: an existing block is replaced wholesale, so a change to the template propagates on the next run. Report format as `build-crumbs.js`: pages scanned, blocks added/rewritten, kinds histogram, og:image set/kept, `N file(s) would change`. Exports `{ render(kind), kindOf(html, rel), ogImageFor(rel), applyHead(html, rel) }`; `if (require.main === module) main();`. `build-site.js`'s tool template should call `render()` where it emits the lede (so the first pass is already right); the other generators may rely on the pass — the two-pass rule (second run reports 0) is the proof either way.

## 6. `assets/share.js` (~7 KB, plain ES2017, IIFE, no dependencies)

```
window.Share = {
  ctx,                       // { title, desc, base, section, slug, kind }
  state(),                   // { inputs, lines, touched, text } normalised across kinds
  withValues(get/set),       // persisted per page load only (never localStorage: a shared number is a decision each time)
  link(target, withValues),  // §2.1
  message(target, withValues),
  open(target),              // native | copy | copymsg | qr | an <a> navigation
  copyText(text),            // navigator.clipboard, else hidden textarea + execCommand (copy the 12 lines from aiimg-share.js)
  track(method, withValues)  // if (typeof window.gtag === 'function') gtag('event', 'share', { method, content_type: 'tool', item_id: section + '/' + slug, with_values: withValues ? 1 : 0 })
}
```
- Boot on `DOMContentLoaded`; render-core's own `DOMContentLoaded` handler mounts the tool — share.js must tolerate `MVRTool.state()` being `null` until then (poll on first `input` event / `mvr:tool-used`, not on load).
- Live preview: `requestAnimationFrame`-batched re-render of `.share-preview` and all target `href`s on `input`, `change`, `mvr:tool-used`, switch toggle.
- Menu open/close: `aria-expanded`, `hidden` attribute, `keydown` Escape, `pointerdown` outside, focus management (open → `.share-preview`; close → opener). Arrow keys inside `.share-targets` move between targets (`roving tabindex`).
- `track()` is called on every target activation (including copy and native). `gtag` exists only after consent; before that the call is a no-op.
- Quick WhatsApp/Telegram chips are `<a>` elements whose `href` is refreshed on `pointerdown`/`focus` (synchronous navigation on click).
- QR: inject `<script src="/engine/qr.bundle.js" defer>` once (same lazy pattern as `ensureIndex()` in app.js), render on load; failure → status "QR unavailable offline".
- Nothing here uses `fetch`; the only requests are the lazy `qr.bundle.js` and the sprite already on the page.

## 7. Icons to add to `assets/icons.svg` (24×24, stroke 1.75, round caps; monochrome so brands are only named, never coloured)
- `i-share`: three 2.4-radius circles at (6,12) (17,6) (17,18) joined by two lines (`.thin`).
- `i-whatsapp`: speech bubble circle r 8.5 at (12,12) with a tail to (4,20); inside, a small handset curve (`M9.3 8.6c.3-.3.8-.3 1 .1l.9 1.6c.2.3.1.7-.2.9l-.6.5c.6 1.2 1.6 2.2 2.8 2.8l.5-.6c.2-.3.6-.4.9-.2l1.6.9c.4.2.4.7.1 1-.6.9-1.7 1.3-2.7.9-2.5-.9-4.4-2.8-5.3-5.3-.4-1 0-2.1.9-2.7z`).
- `i-telegram`: paper plane `M21 4 3 11.5l6.5 2.2L12 20l3-4.6L21 4zM9.5 13.7 21 4`.
- `i-x`: `M5 4l14 16M19 4 5 20`.
- `i-linkedin`: rounded square 3–21 rx 3; `M8 11v5M8 8v.01M12 16v-5M12 13.5c0-1.4 1-2.5 2.3-2.5S16.5 12 16.5 13.5V16`.
- `i-facebook`: `M14 8h2V5h-2a3.5 3.5 0 0 0-3.5 3.5V11H8.5v3H10.5v6h3v-6h2.3l.5-3H13.5V9c0-.6.4-1 .5-1z` (as a stroke path).
- `i-reddit`: ellipse body cx12 cy14 rx8 ry5.5; small circles (9.5,13.5) (14.5,13.5) r .6 `.fill`; antenna `M12 8.5l1-4 3.5 1`; head circle (17,5.2) r 1.2.
- `i-mail`: rect 3,5–21,19 rx 2.5 + `M3 7l9 6 9-6`.
- `i-sms`: bubble `M4 5h16v11H9l-5 4z` + three `.fill` dots.
- `i-link`: two chain links `M10 14a4 4 0 0 1 0-5.6l2.5-2.5a4 4 0 1 1 5.6 5.6L17 12.6M14 10a4 4 0 0 1 0 5.6L11.5 18.1a4 4 0 1 1-5.6-5.6L7 11.4`.
- `i-qr` and `i-close` exist.

## 8. CSS fragment (append to `assets/app.css` as `/* ==== B4-share ==== */ … /* ==== /B4-share ==== */`)
```css
.share { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: -14px 0 24px; }
.share-main .ico { width: 16px; height: 16px; margin-right: 6px; }
.share-quick { display: inline-flex; gap: 6px; }
.share-quick a, .share-quick button { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--bg-2); color: var(--text-2); }
.share-quick a:hover, .share-quick a:focus-visible, .share-quick button:hover, .share-quick button:focus-visible { border-color: var(--accent); color: var(--accent); }
.share-quick .ico { width: 18px; height: 18px; }
@media (pointer: coarse) { .share-quick a, .share-quick button { width: 44px; height: 44px; } }
.share-values { margin-left: auto; }                    /* the .chip switch; .is-on when checked */
.share-status { font-size: .85rem; color: var(--text-3); min-height: 1.2em; flex-basis: 100%; }
.share-status:empty { display: none; }
.share-menu { position: absolute; z-index: 30; top: calc(100% + 8px); left: 0; width: min(380px, calc(100vw - 32px));
  background: var(--bg-2); border: 1px solid var(--border); border-radius: 18px; padding: 14px; box-shadow: 0 18px 48px rgba(0,0,0,.45); }
.share-menu[hidden] { display: none; }
.share-menu .share-close { position: absolute; top: 8px; right: 8px; }
.share-preview { font: .82rem/1.45 Inter, system-ui, sans-serif; white-space: pre-wrap; word-break: break-word; max-height: 10.5em; overflow: auto;
  background: var(--recess); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; margin: 0 0 10px; color: var(--text-2); }
.share-hint { font-size: .78rem; color: var(--text-3); margin: 6px 0 10px; }
.share-targets { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; }
.share-target { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 12px; border: 1px solid var(--border);
  color: var(--text-1); text-decoration: none; font-size: .9rem; }
.share-target:hover, .share-target:focus-visible { border-color: var(--accent); color: var(--accent); }
.share-target .ico { width: 18px; height: 18px; flex: none; }
.share-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.share-qr { display: grid; justify-items: center; gap: 6px; margin-top: 12px; }
.share-qr svg { width: 180px; height: 180px; background: #fff; border-radius: 12px; padding: 8px; }
@media (max-width: 640px) { .share { margin-top: -8px; } .share-menu { left: auto; right: 0; } }
```
Light theme inherits through the tokens; nothing hard-coded except the QR's white plate (QR needs it).

## 9. Build and ship checklist
1. `assets/icons.svg` glyphs (§7). `assets/share.js` (§6). CSS fragment (§8). `engine/render-core.js` `state()` (§3).
2. `build/make-og-cards.js` → `assets/og/*.png` (§4.1); run `--check` twice (byte-stable).
3. `build-share.js` (§5, §4.2). Run on a clean HEAD export, never the working tree; run the chain twice; every script reports 0 on pass two.
4. `sw.js`: add `'./assets/share.js'` to `SHELL`, bump `V` to the next number (render-core changed too).
5. `build-site.js` tool template: emit `require('./build-share.js').render(kind)` under the lede, so generated pages are right on first write. Other generators: optional in Phase 1 (the pass covers them).
6. `node build/consent-check.js --sweep-only` on a sample (one page per kind): no request leaves the origin on load.
7. Verify a live card with the Facebook Sharing Debugger and by sending one WhatsApp message to yourself.

## 10. Tests — `build/tests/share.js` (puppeteer-core, `build/tests/serve.js`, `--out <dir>`, collect every request and assert none left `127.0.0.1`)
1. `/india/gst-calculator/`: `.lede + .share` exists; `.share-main[aria-expanded=false]`; quick chips have `aria-label` for WhatsApp, Telegram, Copy link; `.share-values` absent.
2. Open the menu (click): `#share-menu` visible, focus on `.share-preview`; preview === `"GST Calculator (India) — " + metaDesc + " Free, runs in your browser, no account.\nhttp://127.0.0.1:…/india/gst-calculator/?utm_source=copy&utm_medium=share&utm_campaign=india&utm_content=gst-calculator"`. Escape → hidden, focus back on `.share-main`.
3. Type `1200` into `[name=amount]`: switch appears, `aria-checked=true`; decoded WhatsApp `href` contains `amount=1200`, the text of `.result-primary .result-value`, `utm_source=whatsapp`, and no `utm_` key before the state keys; no param whose value equals its spec default.
4. Open that decoded link in a second page: `[name=amount]` value is `1200` and `.result-primary .result-value` text equals step 3's.
5. Toggle the switch off: `href` has no `amount=`; message is the tool-only form.
6. Clipboard (`overridePermissions(origin, ['clipboard-read','clipboard-write'])`): click Copy link → `navigator.clipboard.readText()` equals `link('copy', true)`; `.share-status` reads "Link copied".
7. `/conversions/length/kilometre-to-mile/?v=5` (or any existing pair): kind `convert`, message starts with `5 ` and contains the `.result-primary .result-value` text; link has `v=5`.
8. `/developer/json-formatter/`: kind `text`; switch unchecked by default; after typing, `href` lacks `text=`; after checking, `href` has `text=`; with 1,600 chars typed, `text=` is omitted and the hint says so.
9. `/ai/ad-copy-writer/`: kind `ai`; no switch after typing in the textarea; message says "Free to try."
10. `/pdf/merge-pdf/`: kind `file`; no switch; tool-only message.
11. QR: click "QR code" → `.share-qr svg` present; exactly one request for `/engine/qr.bundle.js`.
12. Native: `evaluateOnNewDocument` defines `navigator.share = d => (window.__shared = d, Promise.resolve())` and a coarse-pointer media stub; click `.share-main` → `__shared.url` contains `utm_source=share-sheet`, `__shared.title === h1 text`.
13. Analytics: `window.gtag` undefined → clicking WhatsApp throws nothing (no `pageerror`); define `window.gtag = (...a) => calls.push(a)` → click → `['event','share',{method:'whatsapp', content_type:'tool', item_id:'india/gst-calculator', with_values:1}]`.
14. Static (no browser): for every page with a SHARE block, `og:image` file exists; PNG IHDR says 1200×630; `og:image:alt` present; `twitter:image === og:image`; conversions pages point at `conversions-<family>.png`.
15. Keyboard: Tab reaches `.share-main`, Enter opens, ArrowDown moves through `.share-target`s, Escape closes.
16. Screenshots: bar closed (1280×800), menu open, mobile 390×844 with menu open.
17. Idempotence (in the ship checklist, not the browser test): `node build-share.js --check` reports 0 after an apply.

## 11. Phase 2 — "Share as image" (result card)
`assets/share-card.js`, loaded on demand from a "Share as image" action (calc/convert kinds only, after touch). Canvas 1080×1080: bg `#0a0e1a`; logo + "1234Tools" top-left; title Sora 800 56px `#ffe29a` (2 lines max); result lines Inter 400 40px label `#b7bfd2` / 700 44px value `#f4f6fb`, up to 4; "For: …" Inter 32px `#8790a5`; bottom-left pill "Free · runs in your browser"; bottom-right QR 220px of the `qr` link (qr.bundle.js). `await document.fonts.load('800 56px Sora'); await document.fonts.load('700 44px Inter')` before drawing. `canvas.toBlob('image/png')` → `new File([blob], '1234tools-<slug>.png')` → `navigator.canShare({files})` ? `navigator.share({files, text, title})` : `AIImg`-style download. Track `method: 'image'`.

## 12. Risks and how the design handles them
- **Personal figures in a link** (salary, loan): preview shows the exact text; switch is one tap; text tools opt-in; AI/file never; the hint states where the numbers travel. Static hosting means the query string is part of the request to the host and nothing more — no server of ours stores it.
- **Popup blockers / `await` before `window.open`**: targets are `<a target=_blank>` with `href` refreshed before the click; copy and native run inside the click handler.
- **WhatsApp/Facebook OG cache**: UTM'd share links are new URLs; bare URLs need one "Scrape again" for the popular eight.
- **Repo weight**: flat PNGs ≈ 20–35 KB × 245 ≤ 8 MB; `--check` catches drift; a Chrome update may change bytes — rerun and commit, as with `make-og.js`.
- **Brand marks**: monochrome outline glyphs in our sprite, labels use the service names nominatively; no official coloured logos, no third-party scripts.
- **`navigator.share` on Windows desktop Chrome**: gated behind the coarse-pointer/mobile check so desktop gets the explicit menu.
- **`sms:` differences**: the `sms:?&body=` form; shown only on coarse pointers.
- **Currency preference mismatch**: message carries the sender's formatted values, link carries raw numbers; numbers agree, symbols may differ — documented, accepted.
- **Converter "All units" rows are `.result`**: `convert` uses only the primary line.
- **Clipboard in insecure contexts**: fallback textarea + `execCommand`; final fallback status tells the visitor to select the preview text.
- **Cascade from generators emitting pages without the block**: the two-pass rule and `build-site.js` calling `render()` directly.
- **Service worker staleness**: `V` bump; share.js precached in SHELL; `render-core.js` already in SHELL.

## 13. Files
| File | Responsibility |
|---|---|
| `E:/projects/1234Tools/assets/share.js` | new; §6 |
| `E:/projects/1234Tools/assets/app.css` | append `B4-share` fence; §8 |
| `E:/projects/1234Tools/assets/icons.svg` | 10 new symbols; §7 |
| `E:/projects/1234Tools/engine/render-core.js` | `live` + `MVRTool.state()`; §3 |
| `E:/projects/1234Tools/build-share.js` | new post-processor + exports; §5, §4.2 |
| `E:/projects/1234Tools/build/make-og-cards.js` | new card generator → `assets/og/*.png`; §4.1 |
| `E:/projects/1234Tools/build-site.js` | tool template emits `share.render(kind)` under the lede |
| `E:/projects/1234Tools/sw.js` | SHELL + `V` bump |
| `E:/projects/1234Tools/build/tests/share.js` | new puppeteer suite; §10 |
| `E:/projects/1234Tools/assets/share-card.js` | Phase 2; §11 |