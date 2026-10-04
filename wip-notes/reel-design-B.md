# Reel Maker — implementation spec

`/ai-video/reel-maker/` · spec `engine/ai-video-tools-reel-maker.js` · tool `engine/aivid-reel-maker.js` · CSS fragment `C8-reel-maker` · test `build/ai-video/tests/reel-maker.js`

Everything below was checked against the repo as of commit 6da53f2e0: `AIImg` (aiimg-core.js), `AIImg.share` (aiimg-share.js), `AIImg.tools['auto-captions']` exports `{ mount, muxVideo, drawCaptions, fileCues, wordCues, toSRT, toVTT }` (`withHold` is **not** exported — it is six lines and is re-implemented locally as `hold()`), `AIVidWhisper.decodeAudio/transcribe`, `window.QR.encode(text, ecLevel, opts) → {matrix, size, …}` and `QR.toSVG(qr, opts)` (note: `encode` takes `ecLevel` as its **second** positional argument, not inside opts), `build-ai-video.js` (reads `engine/ai-video-tools-*.js` with `new Function('window', src)`, requires ≥6 FAQ, title ≤70, every `scripts` path to exist, every `related` path to exist, bumps `sw.js` V), `window.FINDER_INDEX.tools` rows `[title, path-without-leading-slash, glyph, sectionName, description, keywords, io, prefill?]` (18 section names; `keywords` may be `""`).

**Relation to the share-button request.** The share sheet that is being added to every tool page gets one extra row, "Make a Reel about this tool", linking to `/ai-video/reel-maker/?tool=<path>`. The Reel Maker reads the same `FINDER_INDEX` description the OG tags come from, so the reel, the caption and the page's OG description always say the same thing.

---

## 1. Positioning and page copy

**Who it is for.** Someone who searched "free reel maker no watermark" or "text to video reel maker" and wants a 9:16 MP4 from a script, without an app, a sign-up or a watermark. The "Promote a 1234Tools tool" mode is a preset inside that product, not the product.

**Spec object** (`window.AI_VIDEO_TOOLS['reel-maker']`):

```
order: 1
title: 'Reel Maker'
pageTitle: 'Free Reel Maker — Text to Reel, No Watermark, Offline | 1234Tools'   (65 chars)
description: 'Turn a script into a 9:16 Reel in your browser: animated text scenes, screenshots or screen recording, your voice, music and auto-captions. MP4 with sound, no upload, no watermark, no account.'
keywords: ['reel maker', 'free reel maker no watermark', 'text to video', 'text to reel', 'instagram reel maker online free',
  'youtube shorts maker', 'tiktok video maker no watermark', 'make a reel from text', 'add voiceover to video', 'faceless reels']
glyph: 'i-ai-reel'
scripts: ['/engine/aiimg-core.js', '/engine/aiimg-share.js', '/engine/aivid-whisper.js', '/engine/aivid-auto-captions.js', '/engine/qr.bundle.js', '/engine/aivid-reel-maker.js']
model: { name: 'Whisper tiny', size: '41 MB', licence: 'MIT', source: 'https://github.com/openai/whisper', files: 'engine/models/whisper-tiny/' }
related: ['/ai-image/text-behind-image/', '/ai-image/thumbnail-maker/', '/image/social-media-resizer/', '/qr/qr-code-generator/', '/text/word-counter/']
```

(`auto-captions` appears automatically as a sibling; the builder adds siblings before `related`.)

**privacy** (one paragraph):
> Your script, pictures, recordings and voice never leave your device. Scenes are drawn on a canvas and encoded to MP4 by your browser's own media engine; the voiceover and music are mixed in the browser too. If you turn on auto-captions, speech is recognised by OpenAI's Whisper tiny model (41 MB, MIT licence), served from this site and kept by your browser after the first visit — no third-party server is contacted. Nothing is uploaded, queued or logged, there is no account and there is no watermark; the small "1234tools.com" credit is off unless you switch it on.

**how[5]:**
1. Write or paste a script — one scene per line, or let the tool split sentences for you. Each line becomes a scene of animated text; a blank line starts a new scene group.
2. Add pictures or clips where words are not enough: a screenshot in a phone frame, a photo full-bleed, or a screen recording made right here with "Record my screen". Drag scenes to reorder; set how long each stays.
3. Add your voice (record from the microphone or upload a file) and, if you like, a music track. The music ducks under your voice automatically. With a voice on, captions can be transcribed word by word on your device.
4. Pick a look — colours, font, caption style — and the brand strip: a logo, your handle, a URL and a QR end card.
5. Export a 1080×1920 MP4 for Reels, Shorts and TikTok (or 1080×1080 and 1920×1080), a cover image, and copy a ready caption with hashtags. Promoting several tools from this site? Tick them and get one reel each.

**uses[5]:**
- ['Faceless explainer reels', 'A script, a few bold text scenes and a music bed is the whole format. No camera, no editor, no watermark to crop off.']
- ['Product and app demos', 'Record your screen, drop the clip into a phone frame and talk over it. The captions keep it watchable on mute.']
- ['Tips and listicles', '"5 things…" is five scenes. Type them, pick a look, export — thirty seconds of work for a thirty-second reel.']
- ['Quotes and announcements', 'A date, a price, a line from a review: one scene, four seconds, posted everywhere the 9:16 file is accepted.']
- ['Promoting a tool from this site', 'Pick any of the 1,200 tools; the script, the end card with its QR code and the caption are written for you. Pick ten and they export one after another.']

**tips[6]:**
1. Seven to thirty seconds performs best. Say one thing per scene; if a line is over twelve words, split it.
2. Keep words out of the top 13% and bottom 17% of the frame — the app's own buttons sit there. The looks here already do; the safe-area guide shows where.
3. Record the voice first, then let "Fit scenes to the voice" stretch each scene to what you actually said. Captions come from the recording, so you do not retype anything.
4. Music under speech: pick something without lyrics and leave the ducking on. The tool drops it by 12 dB while you talk and brings it back in the gaps.
5. Phone screenshots look best in the phone frame; desktop screenshots and screen recordings in the card. Full-bleed is for photos.
6. Export 1080×1920 for Instagram, TikTok and Shorts — the same file works on all three. Use the square or landscape sizes for a feed post or YouTube.

**faq[8]:**
- q: 'Is anything uploaded?' a: 'No. Your script, images, screen recording, voice and music stay in the browser; the frames are drawn on a canvas and encoded to MP4 on your device with WebCodecs. The only download is the optional 41 MB Whisper speech model for captions, served from this site and kept by your browser. We never receive your content, and there is no account.'
- q: 'Is there a watermark?' a: 'No. A small "1234tools.com" credit can be switched on in the corner if you want to say where the clip was made; it is off by default and never added without you choosing it.'
- q: 'Can it read my script aloud?' a: 'Not yet. Browsers can speak text but give no way to record what they say into a file, so a robot voice cannot be put into the MP4. Record your own voice with the microphone button — the script is shown as a teleprompter while you read — or upload a voice file made elsewhere.'
- q: 'How do the captions work?' a: 'When a voiceover is attached, Whisper tiny transcribes it on your device and the words are drawn in time with your speech, one to three at a time, in the same four styles as the Auto Captions tool. Without a voice, the scene text itself is the caption, timed to the scene. The words are editable before export.'
- q: 'Which sizes and formats?' a: '1080×1920 (9:16, Reels, Shorts, TikTok), 1080×1080 (square) and 1920×1080 (landscape), at 30 frames per second as H.264 MP4 with AAC sound, up to 90 seconds. A cover image is exported as JPG or PNG at the same size.'
- q: 'Why did I get a WebM without sound?' a: 'MP4 is encoded on the device with the browser's WebCodecs API, which Chrome, Edge, Opera, Brave and Safari 16.4+ provide. Firefox does not yet, so there the clip is recorded in real time as WebM, and the mixed sound cannot be attached — it is offered as a separate WAV instead. Open the page in Chrome or Edge for the complete MP4.'
- q: 'Can I record my screen?' a: 'On a desktop browser, yes: "Record my screen" asks the browser which tab, window or screen to share, records it until you stop, and drops the clip into a scene. Phones do not offer screen capture to web pages; record with the phone's own screen recorder and upload the file.'
- q: 'What are the limits?' a: 'Ninety seconds per reel, ten media files, 200 MB per video clip, and one export at a time (a batch runs them one after another). The limits exist because everything is held in your browser's memory. On a phone, keep reels under a minute and use the phone frame rather than full-bleed video.'

---

## 2. UX

### 2.1 Mount and skeleton

`AIImg.tools['reel-maker'] = { mount, buildScript, captionFor, mixAudio, sceneAt, renderFrame }` (the extra exports exist for the test and for the share sheet; `mount(root)` is what the page calls).

`mount(root)` empties `root.querySelector('.tool-io')` and builds:

```
.aiimg.aivid.reel
  .reel-start                      (shown until there are scenes)
    .aiimg-tabs[role=tablist]      chips: data-mode=script "Write my own script" · data-mode=promote "Promote a 1234Tools tool"
    .reel-mode[data-mode=script]   textarea#reel-script.control (rows 7, placeholder below) · .aiimg-row: button.btn-primary "Make my reel" · button.btn-ghost "Try an example"
    .reel-mode[data-mode=promote]  (section 2.3)
  .aiimg-studio[hidden]
    .aiimg-stagecol
      .aiimg-stage > canvas.aiimg-canvas.reel-canvas[aria-label="Preview of the reel"] + .reel-safe (overlay div, toggled) + .aiimg-stagemsg
      .aiimg-transport: button "▶ Play" · input.range[aria-label="Position in the reel"] · span.range-val (clock "0.0 / 18.5 s") · button.btn-ghost "Start over"
    .aiimg-side
      .aiimg-tabs[role=tablist] chips data-pane = scenes · media · sound · captions · brand · export
      .aiimg-pane[data-pane=…] ×6
  .io-msg
```

Placeholder for the textarea: "One scene per line, for example:\n\nStop guessing your GST.\nType the amount, pick the slab.\nCGST, SGST and IGST split — in a second.\nFree. Runs in your browser." "Try an example" fills exactly that.

"Make my reel" → `S.scenes = scenesFromScript(text)` (section 3.6), appends an end card if Brand → "End card" is on (default on), hides `.reel-start`, shows the studio, opens the **scenes** pane, draws frame 0.

### 2.2 Script mode

`scenesFromScript(text)`: split on `\n`; trim; drop empties; a line longer than 110 characters is split at the sentence boundary nearest the middle; each line → `{type:'text', text, seconds: secondsFor(text), anim: look.textAnim}`. Lines starting with `#` set the scene's `emphasis` (words to colour in the accent): `#GST` on its own line is not a scene but marks the previous scene. Keep this one rule; do not invent a markup language.

### 2.3 Promote mode

- On first switch to the tab (or when `?tool=` is present) load the index on demand: `loadFinderIndex()` appends `<script src="/assets/finder-index.js">` once, resolves when `window.FINDER_INDEX` exists (rejects after 15 s with "The tool list could not be loaded — you may be offline." in `.io-msg.is-warn`). The service worker caches it cache-first (`.js` rule), so it works offline after one load.
- `.reel-picker`: `input#reel-find.control[type=search][placeholder="Search 1,200 tools…"]`, a `.reel-filter` chip row ("Popular" + one chip per section name, "Popular" on by default), and `ul.reel-tools[role=listbox]` of up to 40 rows `li.reel-tool[role=option]` each: glyph `<svg><use href="/assets/icons.svg#<glyph>">`, `strong` title, `small` section · io line, and a `input[type=checkbox].reel-pick[aria-label="Select <title>"]`.
- "Popular" = `POPULAR_PATHS` constant in the tool file (keep in step with build-site.js POPULAR plus the high-interest list): `image/image-compressor/, pdf/merge-pdf/, developer/json-formatter/, image/passport-photo/, qr/qr-code-generator/, business/currency-converter/, india/gst-calculator/, text/word-counter/, ai-image/background-remover/, ai-video/auto-captions/, ai-image/text-behind-image/, pdf/split-pdf/, india/emi-calculator/, india/sip-calculator/, india/india-income-tax/, business/uk-take-home-pay/, health/bmi/, time/age-calculator/, time/date-difference/, pdf/payslip-generator/, pdf/invoice-generator/` — filter the constant through the index at runtime and drop paths that do not exist (slugs for EMI/SIP/payslip/invoice must be verified against `assets/search-index.js` when building; use whatever the register says).
- Search: case-insensitive match on title, keywords, section, path; rank title-prefix first.
- Clicking a row (not the checkbox) = "Use this tool": `S.promote = row; S.scenes = buildScript(row, S.brand)` (section 3), slug = last path segment, studio opens. Ticking checkboxes enables the footer `button.btn-primary#reel-batch` "Make N reels" (section 2.10) and `button.btn-ghost` "Clear".
- Deep links, read once in `mount`: `?tool=<path>` (with or without leading slash; `decodeURIComponent`) → load index, select the row, build, open studio; if no row matches, `.io-msg.is-warn` "No tool at <path> — pick one below" and the promote tab opens with the picker. `?preset=<look>` is applied by `share.presets(...).applyFromUrl()` after the scenes exist (the TOOL calls it, as the share module requires).
- The `.reel-tool` row for the chosen tool stays visible in the **scenes** pane as `.reel-chosen` with "Change tool" and "Rewrite script" (re-runs `buildScript`, discarding edits after a `confirm`).

### 2.4 Scenes pane

- `ol.reel-scenes` — one `li.reel-scene[data-id]` per scene: a `.reel-scene-head` row (index badge, type chip "Text"/"Media"/"End card", duration `input.control.reel-secs[type=number][min=1][max=15][step=.5]` with suffix "s", buttons `↑` `↓` (aria-labels "Move up"/"Move down"), `⧉` duplicate, `✕` delete), then `textarea.control.reel-scene-text` (text scenes: the lines; media scenes: optional caption line; end card: the title line), then a `select.control` for `anim` on text scenes: `[['zoom','Pop in'],['slide','Slide in'],['typewriter','Type on'],['fade','Fade'],['none','Still']]`.
- Buttons under the list: "+ Text scene", "+ Media scene" (opens the media pane with the picker), "+ End card" (disabled when one exists).
- `.aiimg-status#reel-total` ("5 scenes · 18.5 s") turns `is-warn` above 90 s with "Over 90 s — Reels are cut at 90 s; shorten a scene".
- Clicking a scene seeks the preview to its start + 0.6 s and marks it `is-live`. During play the live scene follows `t`.
- "Fit scenes to the voice" (checkbox, only shown when a voice exists): scales every non-endcard scene by `voice.duration / sum(text+media seconds)`, clamped to [1.0, 15] each; the end card keeps its own length. Recomputed when the voice changes while the box is ticked.

### 2.5 Media pane

- `.dropzone` ("Add pictures or clips — nothing is uploaded. JPG, PNG, WebP, MP4, MOV, WebM; up to 10 files, 200 MB each.") + hidden `input[type=file][multiple][accept="image/*,video/*"]`.
- Each file → a media scene appended after the currently live scene (or before the end card): `{type:'media', media:{kind:'image'|'video', name, file, canvas? (image via AIImg.loadImageFile), video? (hidden `<video muted playsinline preload=auto>` with an object URL), width, height, duration}, fit, seconds, text:'', sound:false}`. Default `fit`: `'phone'` if `width/height < 0.7`, else `'card'`. Default `seconds`: video → `min(duration, 15)`; image → 3.
- Per media scene controls (shown for the live scene): `fit` select `[['card','Card — fits the width, rounded'],['phone','Phone frame'],['cover','Full-bleed']]`; `start` range (video only, 0..duration−1, "Start at"); `sound` check "Use the clip's own sound" (video only); `motion` check "Slow zoom" (Ken Burns 1.0→1.06 over the scene, default on for images, off for video).
- **Record my screen** button, rendered only when `navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && !PHONE`: calls `getDisplayMedia({ video: { frameRate: 30 }, audio: true })` (audio is a request, not a requirement — Chrome offers tab audio; `audio:true` is ignored where unsupported); `MediaRecorder` with the first supported of `video/webm;codecs=vp9,opus`, `video/webm;codecs=vp8,opus`, `video/webm` at 8 Mbps; a `.reel-rec` strip appears: red dot, running clock, "Stop recording"; stops on the button, on the track's `ended` event (user clicked the browser's "Stop sharing") or at 90 s. The blob becomes a `File` named `screen-recording.webm` and goes through the same path as an upload (fit `'card'`, `sound` on if an audio track was recorded). `NotAllowedError` → `.io-msg.is-warn` "Screen recording was cancelled or not allowed."; any other error → `.is-error` with the message.

### 2.6 Sound pane

- **Voiceover**: `button.btn-primary#reel-rec-voice` "● Record voice" / "■ Stop" (getUserMedia `{audio:{echoCancellation:true,noiseSuppression:true}}` → MediaRecorder `audio/webm;codecs=opus` else `audio/mp4` else default; decoded with `AIVidWhisper.decodeAudio(file, {sampleRate:48000})` → `{samples, duration, audioBuffer}`); `button.btn-ghost` "Upload voice" (hidden input, `audio/*,video/*`; a video's sound track is used); while recording, a `.reel-prompter` shows the scene texts large, highlighting the scene whose start time has passed (scene timings → teleprompter pace); a `.reel-level` meter (AnalyserNode, 20 fps) shows the mic is live. After a recording: name, duration, "Remove", `input.range#reel-voice-offset` "Starts at" −2..+5 s (default 0.3 s), `input.range#reel-voice-gain` −12..+12 dB (default 0, on top of the auto-normalise).
- **Music**: "Upload music" (`audio/*`), name + duration, `range#reel-music-gain` −30..0 dB (default −16 dB with a voice, −8 dB without), `check#reel-duck` "Duck under speech" (default on, shown only with a voice), `check#reel-loop` "Loop if shorter than the reel" (default on), hint "Use a track you have the rights to; the file never leaves your device."
- **Preview sound** check (default on): plays the mixed buffer with the preview (section 6.4).
- `.aiimg-status#reel-sound-status` describes the mix: "Voice 17.2 s from 0.3 s · music −16 dB, ducked · clip 18.5 s".

### 2.7 Captions pane

- `select#reel-cap-source`: `[['auto','From the voiceover (Whisper, on this device)'],['scene','The scene text, timed to the scene'],['none','No captions']]`. Default: `auto` when a voice exists, else `scene`. Choosing `auto` with no voice shows the hint "Record or upload a voice first" and falls back to `scene`.
- Whisper block (section 7): `.aiimg-progress`, `.aiimg-status#reel-cap-status[aria-live=polite]`, "Transcribe again", then `.aivid-segs` editable segments reusing the Auto Captions markup (`.aivid-seg`, `.aivid-seg-head`, `.aivid-seg-time`, `textarea.aivid-seg-text`) — same CSS, already in C7.
- Style: the four swatches from Auto Captions (`.aivid-swatches` / `.aivid-swatch` markup, presets `karaoke|pop|outline|minimal`), `select#reel-cap-mode` `[['1','1 word'],['2','2 words'],['3','3 words'],['line','Whole line']]` (default `2`), `select#reel-cap-pos` `[['bottom','Bottom (safe)'],['middle','Middle']]` — no `top` here (brand strip lives there), `range#reel-cap-size` 5–10 (default 7), colours `fill`, `accent`, `stroke`, `check` uppercase. In `scene` mode the style still applies (the scene text is drawn as a line cue instead of a text layer? **No** — the text layer is the scene; scene-mode captions are drawn only on **media** scenes, as the media caption line. Text scenes never double up.)

### 2.8 Brand pane

- `share.presets({ list: LOOKS, root })` → chips + "Copy link to this look"; the chip row sits first (`.aiimg-looks`).
- `input.control#reel-handle` "Handle" (default `@1234tools` in promote mode, empty otherwise; max 32 chars), `input.control#reel-url` "URL" (default `1234tools.com/<path>` in promote mode; read-only display of what the end card shows), `check#reel-endcard` "End card" (default on), `check#reel-qr` "QR code on the end card" (default on in promote mode, off otherwise; disabled with hint when the URL is empty), `check#reel-progress` "Progress bar" (default on), `check#reel-safe` "Show safe area in the preview" (default on; preview only — never exported).
- Logo: `.reel-logo-row` with a 48 px preview, "Upload logo" (`image/*`, PNG/SVG), "Use the 1234Tools logo" (promote default), "No logo". The site logo is loaded with `loadSiteLogo()`: `fetch('/assets/img/logo.svg')` → text → ensure the root has `width="512" height="512"` (it has only a viewBox; Firefox draws a size-less SVG as 0×0) → `Blob` → `Image` → draw into a 256×256 canvas kept in `S.brand.logo`.
- `share.creditControl()` (the shared checkbox; default off, remembered in localStorage).
- Colour overrides: `colour#reel-accent`, `colour#reel-text`, `colour#reel-bg1`, `colour#reel-bg2` (preset chips reset these).

### 2.9 Export pane

- `select#reel-size`: `[['1080x1920','1080 × 1920 — Reels, Shorts, TikTok'],['1080x1080','1080 × 1080 — square post'],['1920x1080','1920 × 1080 — landscape']]`.
- `select#reel-quality`: `[['standard','Standard — 8 Mbps'],['high','High — 12 Mbps'],['small','Small — 5 Mbps']]`.
- `button.btn-primary#reel-export` "Export the reel" · `button.btn-ghost#reel-cancel[hidden]` "Cancel" · `.aiimg-progress` · `.aiimg-status.reel-exstatus[aria-live=polite]`.
- Cover: `button.btn-ghost#reel-cover-now` "Use this frame as cover" (takes the preview `t`), `.reel-cover-thumb` 90 px preview, `select` JPG/PNG, `button.btn-ghost#reel-cover` "Export cover".
- `share.captionButton(() => captionFor(S))` labelled by the module ("Copy caption"); beside it `button.btn-ghost#reel-copy-link` "Copy link for bio" (the UTM URL, section 4), both inside `.aiimg-share` with `.field-hint` "Instagram does not link captions; put the link in your bio and say so."
- `.aiimg-results` rows: `.aiimg-result` with `.aiimg-result-head` (strong name · "H.264 MP4 with AAC audio · 18.5 s · 30 fps · 1080×1920 · 4.2 MB" · `a.btn-download`) above `<video controls playsinline>` or `<img>`.
- Export flow: section 8.

### 2.10 Batch — "Make reels for several tools"

- From the picker footer with ≥2 ticked (max 25). Opens `.reel-batch` in the export pane (studio shown with the first tool's reel as preview): list of ticked tools, the current look/brand/size settings apply to all, `check#reel-batch-folder` "Save into a folder (asks once)" shown only when `window.showDirectoryPicker` exists, `check#reel-batch-captions` "Also save reel-captions.txt" (default on), "Start" / "Cancel".
- Runs sequentially: for each tool → `buildScript(row, brand)` → `prepareFonts()` → `encode()` → save (`writable = await dir.getFileHandle(name, {create:true})` → `createWritable()` → `write(blob)` → `close()`; else `AIImg.download(blob, name)` — Chrome will ask once to allow multiple downloads, say so in the status before the second file) → cover JPG → append caption to the text file. Status: "Reel 3 of 8 — GST Calculator (India) — encoding 45%"; the progress bar is `(i + frac) / n`. Cancel aborts the current `AbortController` and stops the loop; finished files stay. Voiceover and media are not used in batch mode (the scenes are text + end card); music is used if loaded. Results appear as rows as they finish. At the end: "8 reels, 8 covers and reel-captions.txt saved to <folder>" or "…downloaded".

---

## 3. The auto-script generator

`buildScript(row, brand) → Scene[]` where `row = {title, path, glyph, section, description, keywords, io}` (from a FINDER_INDEX array via `rowObj(arr)`).

### 3.1 Derived facts

- `slug` = last non-empty path segment; `sectionSlug` = first segment; `url` = `'1234tools.com/' + path` (shown); `qrUrl` (section 4).
- `verb` = first regex to match the **title**, else `SECTION_DEFAULT[sectionSlug]`:

| order | regex (case-insensitive) | verb |
|---|---|---|
| 1 | `checker|tester|validator|counter|diff|compare|readab|scanner|analy[sz]er|decoder|parser|lookup|inspector|viewer` | Check |
| 2 | `compressor|remover|cleaner|strip|blur|eraser|upscal|dedup|optimi[sz]er|unblur` | Clean up |
| 3 | `converter|convert|\bto\b|encoder|resizer|rotate|crop|merge|split|extract|transcri|translator|formatter|minif|beautif` | Convert |
| 4 | `generator|maker|builder|creator|designer|signature|watermark|captions|timetable|seating|payslip|invoice|certificate|planner|resume|card|writer` | Make |
| 5 | `calculator|calc\b|estimator|interest|tax|emi|sip|salary|pay\b|bmi|age|difference|percent` | Calculate |

`SECTION_DEFAULT`: business Calculate · ai Make · pdf Convert · education Calculate · india Calculate · developer Convert · image Convert · ai-image Make · ai-video Make · text Check · mathematics Calculate · finance Calculate · time Calculate · health Calculate · qr Make · utilities Calculate · engineering Calculate · design Calculate.

- `noun` = title with `/\s*\((.*?)\)\s*/` removed (keep the parenthetical as `region`, e.g. "India"), then with the trailing verb-word stripped: `/\s+(Calculator|Converter|Generator|Maker|Checker|Tester|Counter|Formatter|Validator|Decoder|Encoder|Compressor|Remover|Resizer|Solver|Tool|Tools|Online)$/i` → "GST", "Merge PDF Files", "Word", "JSON", "Passport & ID Photo". Lower-case it unless it is an acronym (all caps ≤5 letters) or contains `&`. `aNoun` = article + noun ("a QR code", "an invoice") using `/^[aeiou]/i`.
- `inPart`, `outPart` = `io.split('→').map(trim)`; if no arrow, `inPart = 'Your input'`, `outPart = noun`.
- `first` = description's first sentence (`/^.*?[.!?](\s|$)/`), stripped of "— nothing is uploaded"-type tails (`/[—-]\s*nothing (is|you type is) uploaded.*$/i`), trimmed to ≤95 chars at a word boundary with "…" never used — cut at the last comma or " and " instead, then add a full stop.
- `pick(list)` = `list[hash(path) % list.length]` where `hash` is a 32-bit FNV-1a of the path — deterministic per tool, varied across tools (batch reels do not all open the same way).

### 3.2 Scene 1 — hook (verb-keyed)

| verb | templates (pick by hash) |
|---|---|
| Calculate | `Stop guessing your {noun}.` · `{noun} in ten seconds. Free.` · `Still working out {noun} by hand?` |
| Convert | `{inPart} → {outPart}.\nNo upload.` · `Convert {inPart} to {outPart}\nwithout an app.` · `{title}:\ndrop it in, it's done.` |
| Check | `Check your {noun}\nbefore you send it.` · `{title} —\npaste, done.` · `Not sure about the {noun}?\nCheck it free.` |
| Make | `Make {aNoun}\nin your browser. Free.` · `Need {aNoun}?\nNo account, no watermark.` · `{title}:\nmade on your device.` |
| Clean up | `{title},\nwithout uploading the photo.` · `Clean it up.\nKeep it private.` · `{title} —\nfree, offline, no watermark.` |

Capitalise the first letter. `\n` is a hard line break in the layer. anim `zoom`, size 9.5% of U (section 5.6), weight 800, emphasis word = `noun` or `Free` drawn in the accent.

### 3.3 Scene 2 — what it does

Text = `first`. anim `slide` (direction left), size 6.8%, weight 700. Region hint: when `region` exists append a second line `({region})` only if the sentence does not already contain it.

### 3.4 Scene 3 — in → out

Text = `{inPart}\n↓\n{outPart}` with the arrow glyph on its own line in the accent at 60% size (drawn as a second layer, see 5.6 — the scene holds `layers` rather than one text). If `inPart === outPart` or the io line is missing, use `{sectionLine}` from 3.5 instead and skip 3.5. anim `typewriter` (p completes at 75% of the scene, so give this scene +0.5 s). Size 7.5%.

### 3.5 Scene 4 — trust and flavour (section-keyed)

Two lines: `trustLine` then `sectionLine` (smaller, text-2 colour).

| sectionSlug | trustLine | sectionLine |
|---|---|---|
| **ai** (cloud) | `Ten free runs a month.\nIt says what it sends before you press go.` | `A language model does the reading; you do the checking.` |
| everything else | `Runs in your browser.\nNothing you type is uploaded.` | see below |

`sectionLine` by section name (FINDER row field 3):

| section name | sectionLine |
|---|---|
| India | `Rates follow the current financial year.` |
| Business | `Built for UK small businesses. No account.` |
| PDF Tools | `No file-size limit. No watermark.` |
| Image & Photo Tools | `Your photos stay on your phone.` |
| AI Image Tools | `The AI model runs on your device, not a server.` |
| AI Video Tools | `Speech recognition offline, in the browser.` |
| Developer & Web Tools | `Paste, convert, copy. Nothing is sent.` |
| Text & Writing Tools | `Nothing you paste is stored.` |
| Education & Exams | `Made for students and schools. Free.` |
| Mathematics | `Shows the working, not just the answer.` |
| Finance & Accounting | `Shows the formula it used.` |
| Time & Dates | `Leap years and daylight saving handled.` |
| Health | `An estimate, with the formula explained.` |
| QR Tools | `SVG and PNG out. No sign-up.` |
| Utilities | `Free. Works offline once opened.` |
| Engineering & Electronics | `Formula shown. Units converted.` |
| Design & Media | `Free, in the browser, no account.` |
| AI for Business | *(trustLine above already covers it; sectionLine as in row 1)* |

anim `fade` is cyclic in the core (`0.5−0.5cos`), so use `zoom` with `amplitude: 0` and local `D = seconds` so it pops once and stays; size 6.2%.

### 3.6 Scene 5 — end card

`{type:'endcard', title, url, qr: brand.qr, seconds: 3.5, text: 'Link in bio'}` → drawn by `drawEndCard` (5.5). For a non-promote script the end card uses `brand.handle` / `brand.url`; if both are empty the "+ End card" button is still offered but the card shows only the logo (or nothing and the scene is skipped on export with a status note).

### 3.7 Durations

`secondsFor(text) = clamp(words / 2.75 + 0.6, 2.0, 4.5)`, where `words = text.split(/\s+/).length`; the hook has a floor of 2.4; the typewriter scene gets +0.5; the end card 3.5 (3.0 without QR). Typical promote reel: 2.6 + 3.6 + 3.3 + 3.9 + 3.5 ≈ 17 s. The total is checked against `MAX_SECONDS = 90` and scenes are scaled down proportionally (never below 1.5 s) when a user script exceeds it, with a `.is-warn` status.

---

## 4. Caption + hashtag generator

`captionFor(S) → string`:

```
<hook line, newlines → space>

<first>  <trustSentence>
<sectionLine>

Free, no sign-up → <url>   (link in bio)

#tag1 #tag2 … (5–8)
```

- `trustSentence` = `'Runs in your browser; nothing is uploaded.'` for browser tools, `'Ten free runs a month; it tells you what it sends.'` for `/ai/`.
- Script mode (no `row`): hook = scene 1 text, body = scenes 2–3 text joined by a space (≤180 chars), CTA only if `brand.url` is set, hashtags = `GLOBAL_TAGS` + up to 5 nouns from the script (words ≥5 letters, deduped, most frequent first, `#` + lowercase alnum) capped at 8.
- `share.captionButton` appends `"\nMade free, on my device: " + pageUrl()` itself; that line stays (it is the tool's own credit, and truthful).

Hashtags: `SECTION_TAGS[sectionName]` (3) + `toolTags` (up to 3: the title's words slugged into one `#gstcalculator`, plus the first two `keywords` items slugged, each ≤ 24 chars, skipping any that duplicate) + `GLOBAL_TAGS = ['#freetools', '#1234tools']`; dedupe case-insensitively; cap at 8; all lowercase.

| section name | three tags |
|---|---|
| India | `#gst #incometaxindia #personalfinanceindia` |
| Business | `#smallbusinessuk #selfemployed #bookkeeping` |
| AI for Business | `#aitools #smallbusiness #productivity` |
| PDF Tools | `#pdf #paperless #productivitytools` |
| Developer & Web Tools | `#webdev #developertools #coding` |
| Image & Photo Tools | `#photoediting #phototools #contentcreator` |
| AI Image Tools | `#aiphoto #photoediting #backgroundremover` |
| AI Video Tools | `#reels #videoediting #captions` |
| Text & Writing Tools | `#writingtools #writingtips #students` |
| Education & Exams | `#students #examtips #studygram` |
| Mathematics | `#maths #mathhelp #students` |
| Finance & Accounting | `#personalfinance #moneytips #savings` |
| Time & Dates | `#productivity #planning #lifehacks` |
| Health | `#healthtips #fitness #wellbeing` |
| QR Tools | `#qrcode #smallbusiness #marketingtools` |
| Utilities | `#lifehacks #productivity #usefultools` |
| Engineering & Electronics | `#engineering #electronics #stem` |
| Design & Media | `#designtools #graphicdesign #contentcreator` |

**Link for bio** (`#reel-copy-link`) and the **QR payload**: `https://www.1234tools.com/<path>?utm_source=instagram&utm_medium=social&utm_campaign=<sectionSlug>&utm_content=<slug>`. The end card and caption show the readable `1234tools.com/<path>`; the QR carries the UTM form so a scan is attributable. `utm_source` follows the export size: `instagram` for 9:16 and 1:1, `youtube` for 16:9 (owner can edit the field `input#reel-utm-source` in Brand, default per size).

---

## 5. Data model and rendering

### 5.1 State

```js
S = {
  mode: 'script'|'promote', promote: row|null, slug: 'reel',
  scenes: Scene[],                       // ordered
  look: Look, brand: Brand,
  voice: null | { file, name, duration, audioBuffer (48 kHz), samples (16 kHz mono), offset: 0.3, gainDb: 0 },
  music: null | { file, name, duration, audioBuffer, gainDb: -16, duck: true, loop: true },
  captions: { source: 'auto'|'scene'|'none', segments: [], cues: [], style: {preset:'karaoke', mode:'2', position:'bottom', size:7, font:'Sora', fill:'#ffffff', accent:'#f7c948', stroke:'#000000', box:'#0b1020', uppercase:false}, status: 'idle'|'loading'|'running'|'ready'|'empty'|'failed' },
  mix: null | AudioBuffer,               // cached; invalidated by any sound change
  size: { w: 1080, h: 1920 }, quality: 'standard',
  t: 0, playing: false, live: 0, coverT: null,
  job: null (AbortController), busy: false, batch: null
}
```

### 5.2 Scene schema

```js
{ id, type: 'text'|'media'|'endcard', seconds,
  // text
  text, lines?: [{text, size, weight, colour:'text'|'accent'|'muted'}],  // 3.4 builds multi-layer scenes; plain scenes have one
  anim: 'zoom'|'slide'|'typewriter'|'fade'|'none', emphasis: [words],
  // media
  media: { kind, name, file, canvas?, video?, width, height, duration }, fit: 'card'|'phone'|'cover', start: 0, sound: false, motion: true, text (caption line),
  // endcard
  title, url, qr: bool }
```

### 5.3 Look schema and the five looks

```js
{ id, label, swatch, bg: [top, bottom], glow: 'rgba(...)', text, muted, accent, font: 'Sora',
  textAnim: 'zoom', caption: { preset, accent, fill, box }, bar: colour, plate: 'rgba(...)' /* media caption plate */, uppercase: false }
```

| id | label | bg | text / muted | accent | caption | notes |
|---|---|---|---|---|---|---|
| midnight (default) | Midnight gold | `#0e1428 → #06080f` | `#f4f6fb` / `#b7bfd2` | `#f7c948` | karaoke, accent gold | glow `rgba(247,201,72,.14)` radial behind text (same idiom as `makingOf` backdrop) |
| violet | Violet neon | `#1a1240 → #06080f` | `#f4f6fb` / `#b7bfd2` | `#7c5cff` | pop, accent `#2dd4ff` | text glow 6 |
| sunrise | Sunrise | `#3a2208 → #0a0e1a` | `#fff7e6` / `#e8c9a0` | `#ff9d2e` | karaoke, accent `#ff9d2e` | |
| paper | Paper | `#fbf7ee → #efe6d2` | `#1a1400` / `#5a5040` | `#e8a020` | minimal, box `#1a1400` | logo drawn on a dark pill so the gold squares stay visible |
| bold | Bold | `#000000 → #000000` | `#ffffff` / `#cccccc` | `#ffe600` | outline | `uppercase: true`, stroke 0 |

Preset chips come from `share.presets`; `apply()` copies the look into `S.look`, resets the colour overrides and the caption style's `preset/accent/fill/box`, then `invalidate()`.

### 5.4 Time → scene

Scenes are laid end to end: `start[i] = Σ seconds[0..i-1]`, `D = Σ seconds`. Transition `X = 0.35 s` belongs to the **incoming** scene: during `[start[i], start[i]+X)` the previous scene is drawn at its final local time with `alpha = 1 − u` (u = (t − start[i]) / X eased with `easeOut`) and the incoming scene with `alpha = u`, its text motion running from local time 0. `sceneAt(t) → { i, scene, local: t − start[i], prev: scene i−1 | null, blend: u | 1 }`. Scene 0 fades up from the background over 0.3 s. The last frame holds (no fade to black — Instagram loops).

### 5.5 `renderFrame(ctx, W, H, t)` — the one render function

Called by the preview, `exportStill`, `encodeVideo` and the frame generator alike. Order:

1. **Background**: vertical gradient `look.bg`; radial glow centred at `(W/2, H*0.45)` radius `max(W,H)*0.6`; two slow blobs (`sin`-driven ellipses in `accent` at alpha .06, period 9 s, cyclic in `D`) for a little life on text scenes. Paper look: no blobs.
2. **Scene content** (`drawScene(ctx, W, H, scene, local, alpha)` for the outgoing and incoming scene):
   - `text`: for each layer `L` (built once per scene and cached in `scene._layers`, invalidated on edit): `AIImg.drawText(ctx, L, local, W, H, scene.seconds)` with `L = { text, x: 0.5, y: Y, size: sizeEff, font: look.font, weight, uppercase: look.uppercase, align:'center', lineHeight: 1.12, fill: colour, stroke: look.stroke, strokeWidth: look.strokeWidth, shadowBlur: 10, shadowY: 3, shadowOpacity: .45, glow: look.glow? 6 : 0, anim: { type, speed: 1, amplitude: 0, direction: 'left' } }`. Emphasis words: the layer is split into runs and drawn as separate layers positioned by `AIImg.layout` widths — simpler and sufficient: emphasis applies only when the emphasised word is alone on a line, otherwise it is ignored (document this). `Y` centres the block in the content box `[H*0.20, H*0.70]` for 9:16; multi-layer scenes stack with 0.9×lineH gaps.
   - `media`: `fit:'cover'` — drawImage scaled to cover the full frame, Ken Burns scale `1 + 0.06*local/seconds` when `motion`; `'card'` — fit to `W*0.88` width, max height `contentBox`, rounded 36 px (`roundRect`), shadow `rgba(0,0,0,.55) blur W*0.06`; `'phone'` — a 9:19.5 rounded rectangle `W*0.62` wide, 2 px stroke in `muted` at .5, notch pill, image drawn `cover` inside with `clip`. Source for video = the hidden `<video>` element (prepared to `start + local` by the frame producer, see 8.3); preview just draws whatever frame the element has. Media caption line (`scene.text`) → `drawCaptions`-like plate at `H*0.80` using `look.plate` and `text` colour, 4.6% size, max 2 lines (reuse `wrapWords` idiom locally).
   - `endcard`: logo 22% of U centred at `H*0.30` (scale-in `easeOut(local/0.5)`), `title` 7% weight 800 at `H*0.44`, `url` 4.4% in accent at `H*0.51`, QR `U*0.34` square at `H*0.62` on a white rounded plate (`QR.encode(qrUrl, 'M')` → `QR.toSVG(qr, {scale: 8, quiet: 2, dark: '#06080f', light: '#ffffff', eyeFrame: 'rounded', eyeBall: 'rounded'})` → `Image` from a blob URL → cached canvas `S.brand._qr`; built once per URL, async, before export via `prepareAssets()`), `text` ("Link in bio") 4% muted at `H*0.79`, handle 3.6% at `H*0.835`. Fade in over 0.4 s.
3. **Captions** (`S.captions.source !== 'none'`): `AIImg.tools['auto-captions'].drawCaptions(ctx, W, H, t, S.captions.cues, S.captions.style)` — `t` is global because cues are in reel time (voice offset already added, 7.3). Not drawn on the end card. `size` is scaled by `U/W` for landscape.
4. **Progress bar** (`brand.progress`): 6 px bar at `y = H − safeBottom − 10`, `look.bar` at .9 over `muted` at .25, width `t/D·W*0.86` centred.
5. **Brand strip**: logo 5% of U at `(W*0.07, safeTop + 0.01H)` and handle text 3.4% in `text` colour beside it — drawn on every scene except the end card; hidden if neither exists.
6. **Credit**: `AIImg.share.drawCredit(ctx, W, H)` last.

### 5.6 Sizes and safe areas

`U = min(W, H)`; `sizeEff = size * U / W` (core sizes are % of W). Safe areas (fractions of H): 9:16 → top 0.13, bottom 0.167, content box `[0.20, 0.70]`; 1:1 → top 0.06, bottom 0.10, content `[0.14, 0.78]`, phone-frame height capped at `H*0.8`; 16:9 → top 0.08, bottom 0.12, content `[0.16, 0.76]`, text max width `W*0.7`. `drawCaptions` puts the bottom cue at `0.78H` (portrait) which is inside the 9:16 safe zone (ends at `0.833H`); for 16:9 it uses `0.86H` which is inside `0.88H`. Preview `.reel-safe` overlay shades the two bands with diagonal hatching and labels "covered by app UI".

### 5.7 Preview

Canvas backing size: `PREVIEW_MAX = PHONE ? 540 : 720` along the long edge, `ctx.scale` so `renderFrame` always gets the export `W,H` (text metrics then match export exactly). A `requestAnimationFrame` loop runs only while `playing` or `dirty`; `invalidate()` sets `dirty`. Play: `t0 = performance.now() − S.t*1000`; stops at `D` (and rewinds to 0 on the next Play). Scrub updates `S.t`, pauses playback audio and reseeks media.

---

## 6. Audio pipeline

### 6.1 `mixAudio(S) → Promise<AudioBuffer|null>`

Returns null when there is no voice, no music and no media `sound`. Otherwise:

```js
const SR = 48000, D = totalSeconds(S), n = Math.ceil(D * SR);
const octx = new OfflineAudioContext(2, n, SR);
```

- **Voice**: `src = octx.createBufferSource(); src.buffer = voice.audioBuffer;` → `voiceGain` (GainNode) → destination. `start(max(0, offset), max(0, −offset), min(duration, D − offset))`. Auto-normalise: `peak = max |sample|` over all channels (computed once at load, cached in `voice.peak`); `voiceGain.gain.value = min(4, 0.7 / peak) * dB(voice.gainDb)`. A 10 ms fade-in and 60 ms fade-out via `setValueAtTime/linearRampToValueAtTime` on a second gain node avoid clicks at the cut.
- **Media sound** (video scenes with `sound`): decoded on load with `AIVidWhisper.decodeAudio(file)` into `media.audioBuffer`; one BufferSource per scene, `start(sceneStart, media.start, scene.seconds)`, gain 1 (counts as "speech" for ducking).
- **Music**: BufferSource with `loop = music.loop`, `loopStart 0 / loopEnd duration`, `start(0, 0, D)` → `musicGain` → destination. Base level `g0 = dB(music.gainDb)`. Fade in 0.5 s from 0 to `g0`, fade out over the last 1.2 s to 0 (`linearRampToValueAtTime` at `D − 1.2 → D`).
- **Ducking** (`music.duck && (voice || mediaSound)`): build the speech envelope — RMS of the voice's 16 kHz mono `samples` in 50 ms windows (320 samples) laid onto reel time (offset applied); a window is "speech" when RMS > `−40 dBFS` (0.01). Convert the boolean series into gain targets `g0` (silence) and `g0 × 0.25` (−12 dB, speech), with 120 ms attack (ramp down) and 400 ms release (ramp up), and schedule them as one `Float32Array` with `musicGain.gain.setValueCurveAtTime(curve, 0, D)` sampled at 100 Hz (`curve.length = D*100`), the fades multiplied into the same curve so there is exactly one automation on the node. `dB(x) = Math.pow(10, x/20)`.
- `return octx.startRendering()`. Cached in `S.mix`; invalidated by any change to voice, music, media sound, scene durations or order (`soundDirty()`).
- Soft-limit: after rendering, scan the peak; if > 0.98, scale all channels by `0.98/peak` in place.

### 6.2 What goes to the encoder

`AIImg.encodeVideo(renderFrame, { width, height, fps: 30, duration: D, bitrate, audio: mix ? { buffer: mix, bitrate: 128000 } : undefined, onProgress, signal })` — the core trims audio to the picture (`encodeAudio` uses `min(seconds, buffer.duration)`), picks AAC and falls back to Opus, and reports the choice in `note`. For media-video reels on WebCodecs browsers the tool uses `encodeVideoFrames(frames, {…same audio…})` (8.3). `r.note` is shown in the result head verbatim.

### 6.3 Firefox / no WebCodecs

`encodeVideo` falls back to `encodeRecorded` (MediaRecorder, real time, **no audio**). Detect before export: `const canMp4 = typeof VideoEncoder !== 'undefined' && !!(await AIImg.encodeVideo && pickable)` — simplest reliable check is `typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined'` → `S.recorderOnly = true`. Then:
- Export button hint (`.field-hint` under it): "This browser has no on-device MP4 encoder. The reel will be recorded in real time as WebM, and the sound is saved as a separate WAV. Chrome, Edge or Safari 16.4+ make the complete MP4."
- Media-video scenes: the hidden video element is `play()`ed at the scene start and the preview draws its current frame (approximate sync; acceptable for the fallback).
- After the export, if `mix` exists: `wavBlob = encodeWAV(mix)` (16-bit PCM, 44-byte header, interleaved) and a second result row "reel-<slug>-sound.wav · the mixed voice and music" with `.io-msg.is-warn`: "The clip was recorded as WebM without its sound; the sound is in the WAV beside it. Open this page in Chrome or Edge to get one MP4 with both."
- `AIImg.__forceRecorder` is honoured in the tool's own `encode()` the same way auto-captions does (`forced → skip encodeVideoFrames and call encodeVideo`, which the core then routes to the recorder only if WebCodecs is missing — so for a forced test, the tool calls `encodeRecorded` behaviour by passing a render through `encodeVideo` with `VideoEncoder` shadowed: set `window.VideoEncoder = undefined` in the test page instead; document that in the test).

### 6.4 Preview audio

Created lazily on the first Play click: `S.actx = new (AudioContext||webkitAudioContext)({ sampleRate: 48000 })`; `await actx.resume()`. Play = `src = actx.createBufferSource(); src.buffer = await mixAudio(S); src.connect(actx.destination); src.start(0, S.t)`; pause/scrub/end → `src.stop()`; `src` is recreated on every play. If `mixAudio` is still rendering when Play is pressed, the picture starts and the sound joins at the next frame boundary (`src.start(0, S.t_now)`). Autoplay policy is satisfied because the context is made inside the click handler; on iOS also call `actx.resume()` inside every Play click.

---

## 7. Whisper integration

### 7.1 When

Only when `captions.source === 'auto'` and a voice exists; triggered on voice set/replace and on "Transcribe again". Never in batch mode, never on page load. The run is cancellable (`S.capJob = new AbortController()`); replacing the voice aborts the previous run.

### 7.2 UI states (`#reel-cap-status`, aria-live)

- `loading`: "Downloading the speech model — 12 of 41 MB" (from `onLoad({stage, loaded, total})`; `compile` → "Starting the speech model…").
- `running`: "Listening… 40% · about 12 s left" (from `onProgress({fraction, eta})`); progress bar `fraction`.
- `ready`: "Captions ready — 31 words"; segments listed and editable.
- `empty`: "No speech was found in the recording, so captions are off. The on-screen text stays." → `captions.source` set to `'scene'` visually (select shows it), cues `[]`.
- `failed`: the error message in `.io-msg.is-error`; captions off.
- Model note under the select: "First use downloads Whisper tiny (41 MB) from this site; it is kept for next time."

### 7.3 Words → cues

`segs = result.segments` (each `{start, end, text, words:[{text,start,end}]}` in **voice** time). Shift to reel time: `seg.start += voice.offset`, likewise `end` and every word; drop words with `start ≥ D`; clamp `end ≤ D`. Then `cues = hold(mode === 'line' ? AC.fileCues(segs) : AC.wordCues(segs, Number(mode)))` where `AC = AIImg.tools['auto-captions']` and

```js
function hold(cues) { for (let i = 0; i < cues.length; i++) { const nx = cues[i+1]; let u = nx ? Math.min(cues[i].end + 0.35, nx.start) : cues[i].end + 0.35; cues[i].until = Math.max(u, cues[i].end); } return cues; }
```

Segment edits (text, ±0.1 s nudges) re-run `wordsFor`-style proportional splitting locally: `reword(seg)` splits `seg.text` on whitespace and shares `[start, end]` by character length (the same rule the Whisper file uses) — then rebuild cues. Scene-mode cues (media captions) are not Whisper cues; they are drawn by the media branch.

### 7.4 Edge cases

- Voice longer than the reel: the transcript is complete, but cues past `D` are dropped and the status adds "· the voice runs 6.2 s past the reel — tick Fit scenes to the voice or shorten it".
- Voice longer than 90 s: `decodeAudio` result is cut to 90 s (`samples.subarray`, `audioBuffer` copied via OfflineAudioContext of 90 s) with `.is-warn` "Voice recordings are cut at 90 s, the Reels limit."
- Music only (no voice) with `auto`: hint, fall back to `scene`.
- `transcribe` throws (offline on first use): `failed` with the Whisper file's own message, which already explains the 14 MB + 41 MB first download.
- Whisper takes roughly real time; the status shows the ETA from the first window; the user can keep editing scenes meanwhile (the run is independent of the render loop).

---

## 8. Export

### 8.1 Parameters

| size | fps | bitrate standard / high / small | utm_source default |
|---|---|---|---|
| 1080×1920 | 30 | 8 / 12 / 5 Mbps | instagram |
| 1080×1080 | 30 | 6 / 9 / 4 Mbps | instagram |
| 1920×1080 | 30 | 8 / 12 / 5 Mbps | youtube |

Audio 128 kbps AAC (core default is 96 k mono/128 k stereo; pass `bitrate: 128000`). Duration = `D` (≤ 90). `PHONE && D > 60` → `.is-warn` before starting: "Over a minute on a phone can run out of memory; it will try."

### 8.2 Before the first frame

`prepareFonts()`: `await Promise.all(['800 40px "Sora"', '700 40px "Sora"', '600 20px "Sora"', '500 20px "Inter"'].map(f => document.fonts.load(f).catch(()=>{})))` plus `AIImg.ensureFont(L)` for every text layer; then render one frame to an offscreen 2×2 canvas (forces glyph rasterisation). `prepareAssets()`: logo canvas, QR canvas, every image media `canvas`, every video media `readyState ≥ 2`. Both also run before the first preview frame so the preview is not Arial for one frame.

### 8.3 Frame production

- **No video media** → `AIImg.encodeVideo(renderFrame, opts)` (synchronous render per frame; core handles the WebM fallback).
- **With video media and WebCodecs** → `AIImg.encodeVideoFrames(frames(), { width, height, fps, total: round(D*fps), audio, bitrate, onProgress, signal })` where

```js
async function* frames() {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
  for (let i = 0; i < total; i++) {
    if (signal.aborted) throw AIImg.abortError();
    const t = i / fps;
    await prepareMedia(t);            // seek each visible <video> to start+local when |currentTime − want| > 0.5/fps; await 'seeked' (timeout 2 s → draw what is there)
    renderFrame(ctx, w, h, t);
    yield { canvas: c, timestampUs: Math.round(i * 1e6 / fps), durationUs: Math.round(1e6 / fps) };
  }
}
```

`prepareMedia` looks at `sceneAt(t)` and the outgoing scene during a transition, so both videos are positioned. Stepped seeking at 30 fps costs ~15–40 ms a frame on desktop: a 20 s reel exports in ~30 s.

### 8.4 Cover

`coverT` default: `start[0] + seconds[0] * 0.75` (hook fully on). `exportStill(renderNoUI, { width, height, format, quality: 0.92, t: coverT })` where `renderNoUI` is `renderFrame` with `progress` and the safe overlay off (captions and brand strip stay; the credit follows its toggle). Centre 1080×1350 of a 9:16 cover is what the grid shows — the hook sits in the content box, so it is inside.

### 8.5 Names and result rows

`slug` = promote slug, else `slugify(first 4 words of scene 1)` (`[a-z0-9]+` joined by `-`, ≤ 40 chars) or `reel`. Files: `reel-<slug>.mp4` (or `.webm`), `reel-<slug>-cover.jpg|png`, `reel-<slug>-sound.wav` (fallback only), `reel-captions.txt` (batch). Result head: `<strong>name</strong> · note · D s · 30 fps · W×H · size`; the row holds `<video controls playsinline src=blobURL>` (revoke on "Start over"). `AIImg.download` fires automatically for the reel (as auto-captions does) and the row keeps a Download button.

### 8.6 Limits

`MAX_SECONDS 90`, `MAX_MEDIA 10`, `MAX_VIDEO_BYTES 200e6`, `MAX_IMAGE_BYTES 40e6`, `MAX_VOICE_SECONDS 90`, batch ≤ 25 tools. Memory: one export canvas, one scratch; images are held at ≤ 2048 px long edge (`AIImg.scaled` after `loadImageFile`); on `PHONE`, preview 540 px and media images at ≤ 1440 px; blob URLs revoked when a scene is deleted.

---

## 9. Accessibility and keyboard

- Every control through `AIImg.field(label, control, hint)` so labels bind by `id`; checkboxes through `AIImg.check`.
- Tabs: `role=tablist/tab/tabpanel`, `aria-selected`, Left/Right arrows move between tabs (same handler as the chips' click).
- `.aiimg-status` elements that change during work carry `aria-live="polite"`; the export progress bar is `role=progressbar aria-valuemin=0 aria-valuemax=100 aria-valuenow` updated at most 4×/s; `.aiimg-stagemsg` is `aria-live="polite"` for "Encoding…".
- Canvas `tabindex=0`, `aria-label` "Preview of the reel; Space plays and pauses, Left and Right arrows move one second, Shift for five"; the scrub range has `aria-valuetext` "6.2 of 18.5 seconds".
- Scene list: reorder with the ↑/↓ buttons (no drag-only path), Delete asks nothing but offers an "Undo" chip for 6 s in the status; the live scene has `aria-current="true"`.
- Dropzone `role=button tabindex=0`, Enter/Space opens the input; `over` class on drag.
- Recording buttons toggle `aria-pressed`; the mic level meter is `aria-hidden` with the status text saying "Recording — 0:07".
- Picker: `role=listbox` with `aria-activedescendant` following Up/Down in the search box; Enter uses the active row; Space toggles its checkbox.
- All colour inputs have visible labels; contrast of each look's text on its bg ≥ 7:1 (checked by hand: midnight, violet, sunrise, bold all white-on-dark; paper `#1a1400` on `#fbf7ee`).
- Focus is moved to the scenes pane heading after "Make my reel", and to the first result row after an export.
- `prefers-reduced-motion`: the preview still animates (it is the product) but the background blobs are stilled.

---

## 10. Files and responsibilities

1. **`engine/ai-video-tools-reel-maker.js`** — the spec from section 1 in the `(function(){ window.AI_VIDEO_TOOLS = …; window.AI_VIDEO_TOOLS['reel-maker'] = {…}; })()` shape. Touches only `window`. `glyphSvg`:
   `<symbol id="i-ai-reel" viewBox="0 0 24 24">` — a portrait phone/reel frame `rect x=6.5 y=3 w=11 h=18 rx=2.2`; a play triangle `path d="M10.6 9.4v5.2l4.4-2.6z" class="fill"`; two short caption lines under it `path d="M9 17.3h6" class="thin"`; three film-sprocket ticks on the left edge `path d="M4 7h1.2M4 12h1.2M4 17h1.2" class="thin"`; the section's four-point sparkle top-right `path d="M19.4 2.9l.55 1.25 1.25.55-1.25.55-.55 1.25-.55-1.25-1.25-.55 1.25-.55z" class="fill"` (same sparkle path the other AI glyphs use).
2. **`engine/aivid-reel-maker.js`** — IIFE guarded by `const A = window.AIImg; if (!A) return;`. Sections in order: constants (limits, looks, tables from §3–4), `rowObj`, `verbOf/nounOf`, `buildScript`, `scenesFromScript`, `captionFor`, `qrUrlFor`, `loadFinderIndex`, `loadSiteLogo`, `qrCanvas`, `sceneAt`, `renderFrame` + draw helpers (`roundRect`, `drawMedia`, `drawEndCard`, `drawBrand`, `drawBar`), `mixAudio` + `encodeWAV`, Whisper glue (`transcribeVoice`, `hold`, `rebuildCues`), recording (`recordVoice`, `recordScreen`), `encode` (+ `frames`), `exportCover`, `runBatch`, `mount` (DOM, panes, handlers, preview loop, deep links), and finally `A.tools['reel-maker'] = { mount, buildScript, captionFor, mixAudio, sceneAt, renderFrame }`. Must parse under `node --check` **and** load without throwing when `window.AIImg` is absent (the IIFE returns).
3. **CSS fragment** — written to `build/ai-video/css/C8-reel-maker.css` for the integrator to append to `assets/app.css`, fenced `/* ==== C8-reel-maker ==== */ … /* ==== /C8-reel-maker ==== */`. Classes: `.reel-start`, `.reel-mode[hidden]`, `.reel-picker`, `.reel-filter`, `.reel-tools` (max-height 46vh, overflow auto, grid gap 6px), `.reel-tool` (grid `24px 1fr auto`, `.is-active` gold border), `.reel-chosen`, `.reel-scenes`, `.reel-scene` (`.is-live` gold inset like `.aivid-seg.is-live`), `.reel-scene-head`, `.reel-secs` (width 64px), `.reel-safe` (absolute overlay, two hatched bands via `repeating-linear-gradient`, `pointer-events:none`), `.reel-rec` (red dot `@keyframes reel-blink`), `.reel-prompter` (max-height 30vh, `.is-now` highlighted), `.reel-level` (6 px bar), `.reel-logo-row`, `.reel-cover-thumb`, `.reel-batch`, `.reel-batch-list`, `.reel-exstatus:empty{display:none}`; responsive at 480 px (`.reel-tools` 40vh, `.reel-filter` scrolls horizontally). Reuse `.aiimg-*`, `.aivid-segs/.aivid-seg*`, `.aivid-swatches/.aivid-swatch/.aivid-sample`, `.aiimg-looks/.aiimg-presets/.aiimg-share`, `.btn-*`, `.chip`, `.io-msg` unchanged.
4. **`build/jobs.js`** — `JOBS['/ai-video/reel-maker/'] = ['Make', 'Script → 9:16 MP4 reel']` (24 chars ≤ IO_MAX 32); `DESCS['/ai-video/reel-maker/'] = 'A script becomes a 9:16 reel: animated text, screenshots or screen recording, your voice, music, captions. MP4 out.'` (110 chars — trim to ≤110 if the register's `cut` complains); `START['/ai-video/'] = ['/ai-video/reel-maker/', '/ai-video/auto-captions/']`. Run `node build/jobs.js` to confirm no problems are listed.
5. **`build-hubs.js`** — `INTRO['/ai-video/']`: 'AI video tools that run on your own device. Reel Maker turns a script into a 9:16 Reel with animated text, your screenshots or screen recording, voice, music and captions; Auto Captions transcribes speech with Whisper inside your browser and burns word-by-word captions into a video, with SRT and VTT alongside. Nothing leaves your device; no upload, no account, no watermark.' `STARTERS['/ai-video/'] = ['make a reel from text', 'captions for a video', 'add a voiceover to a reel']`.
6. **`build-ai-video.js`** — `hubPage`: `description` → 'Free AI video tools that run on your own device: a reel maker that turns a script into a 9:16 MP4 with text, voice, music and captions, and automatic word-by-word captions with SRT and VTT. No upload, no account, no watermark.'; the `ai-how` paragraph's "the speech recogniser is 41 MB" stays true; in "What is coming" remove nothing but add nothing either (Reel Maker is now a card). The `patchHome` card count updates itself. Lede sentence stays ("… 2 tools so far …" is computed).
7. **`sw.js`** — bumped by the builder when a page changes; if only `engine/aivid-reel-maker.js` changes later, bump `V` by hand (memory rule).
8. **`assets/search-index.js`, `sitemap-1.xml`, `assets/icons.svg`, homepage card** — all patched by `node build-ai-video.js`; then the usual post-processors (sidebar, sections, crumbs, pwa, totals) in the documented order, then `node build/jobs.js`, then regenerate `assets/finder-index.js` with whatever script owns it (so the Reel Maker appears in its own picker).
9. **`build/ai-video/tests/reel-maker.js`** — same frame as `auto-captions.js` (flags `--root --port 8728 --wav --out --skip-video --recorder`, `serve()`, puppeteer-core, Chrome path, `check()`, no-third-party net filter, console log to `--out`). Assertions, in order:
   1. page loads; `<title>` ≤ 70 chars and starts "Free Reel Maker"; h1 contains "Reel Maker"; `.side-link.is-active` is `/ai-video/`; crumbs include "AI Video"; ≥ 8 `article details`; `.privacy-line` mentions "Whisper", "MB", "MIT", "watermark".
   2. `.aiimg .reel-start` mounted; script textarea present; "Try an example" fills ≥ 3 lines; "Make my reel" shows `.aiimg-studio` with ≥ 4 `.reel-scene` (3 text + end card may be absent without a URL → assert ≥ 3) and `#reel-total` text matches `/\d+ scenes · [\d.]+ s/`.
   3. **Deep link**: `goto('/ai-video/reel-maker/?tool=india/gst-calculator/')` → `.reel-chosen` names "GST Calculator"; scenes ≥ 5; the last is `data-type=endcard`; `renderFrame` mid-frame check: `page.evaluate` draws `AIImg.tools['reel-maker'].renderFrame` at `t = start[0] + 0.75*seconds[0]` on a 1080×1920 canvas and the band `[0.20H, 0.70H]` has luminance std > 25 while `[0.02H, 0.10H]` (above the brand strip) has std < 8; the pixel colour `#f7c948` (±12) occurs ≥ 200 times in the frame (accent used).
   4. `?preset=paper` → `.aiimg-presets .chip[data-preset=paper][aria-pressed=true]` and the frame's mean luminance > 180.
   5. **Caption**: click "Copy caption"; read the clipboard via `page.evaluate(() => navigator.clipboard.readText())` after granting `clipboard-read`/`clipboard-write` through `browser.defaultBrowserContext().overridePermissions(origin, [...])`; assert it contains "1234tools.com/india/gst-calculator/", 5–8 `#` tokens, "#gst", "#1234tools" and "Made free, on my device:". "Copy link for bio" yields a URL containing `utm_source=instagram&utm_medium=social&utm_campaign=india&utm_content=gst-calculator`.
   6. **Voice + Whisper**: upload the TTS WAV (same `speechSample()` helper; SENTENCE = 'Stop guessing your GST. Type the amount, pick the slab, and the split is done in your browser.') through the "Upload voice" input; wait for `#reel-cap-status` ending in "ready" or `/No speech|failed/` (600 s); assert "ready", recall ≥ 70% against SENTENCE, ≥ 2 `.aivid-seg`; `#reel-sound-status` mentions "Voice".
   7. **Export MP4 with sound**: `Page.setDownloadBehavior deny`; click "Export the reel"; wait for `.aiimg-result` or `/failed|Cancelled/` in `.reel-exstatus` (600 s); fetch the result blob; magic `ftyp`; ≥ 2 `trak` boxes; probe duration within 0.5 s of `#reel-total`'s seconds; 1080×1920; a frame at 45% of the duration has caption-band std > 12 in `[0.70H, 0.86H]` (captions drawn) — skip this sub-check if the Whisper status was "No speech".
   8. **Cover**: click "Export cover" (PNG); result `<img>` natural size 1080×1920; PNG magic `\x89PNG`.
   9. **Batch**: open the promote tab, tick `india/gst-calculator/` and `pdf/merge-pdf/`, click "Make 2 reels" then "Start"; wait until `.reel-batch` status says "2 reels" or fails (900 s); assert 2 new `.aiimg-result video` rows named `reel-gst-calculator.mp4` and `reel-merge-pdf.mp4`, each `ftyp`, each duration 12–30 s; the captions text (read from the result row's `a[download="reel-captions.txt"]`) contains both tool titles.
   10. `--recorder`: before the page scripts run, `page.evaluateOnNewDocument(() => { delete window.VideoEncoder; delete window.AudioEncoder; })`; export yields EBML (WebM), a `reel-…-sound.wav` row exists with `RIFF` magic, and the `.io-msg` is `.is-warn` mentioning "WAV".
   11. Zero third-party requests (`net.length === 0`); no `pageerror`.
   12. Screenshots: `1-start.png`, `2-promote.png`, `3-studio.png`, `4-export.png`, `5-midframe.png`, `6-batch.png`.

---

## 11. Risks and how the design avoids them

- **Fonts not loaded on the first frame** → `prepareFonts()` (document.fonts.load for the exact weights + `ensureFont` per layer + a warm-up render) runs before the first preview frame and before every export; the share module already preloads Sora 600/700 on load.
- **VideoFrame memory** → frames are yielded as the same reused canvas; the core wraps and closes one `VideoFrame` per frame and throttles at `encodeQueueSize > 6`; images are downscaled on load; no frame array is ever held. Phones: smaller preview, 60 s warning, stepped seeking (never decode-all).
- **Long exports** → progress + ETA, Cancel (`AbortController` checked every frame in both the generator and the core), the page stays responsive (`sleep(0)` every 4 frames in the core; `await` on each seek). 90 s hard cap. Batch is strictly sequential with one canvas.
- **Video media seeking stalls** → `prepareMedia` waits on `seeked` with a 2 s timeout and otherwise draws the current frame; the element is `preload=auto` and `muted` so decoding starts early; WebM from `getDisplayMedia` lacks a duration header in Chrome — read `duration` after `currentTime = 1e9` trick (`loadedmetadata` → set huge time → `durationchange`) at load, or fall back to the recording clock.
- **getDisplayMedia** → button only where the API exists and not on phones; the user chooses tab/window/screen in the browser's own dialog; `NotAllowedError` is a calm warning; stopping from the browser bar is caught through the track's `ended`; recording stops at 90 s; tab audio is requested, never required.
- **Microphone** → `NotAllowedError` → "Microphone access was refused — upload a voice file instead."; `NotFoundError` → "No microphone found."; the level meter proves it is live before the user reads a whole script into nothing.
- **Autoplay** → the AudioContext is created and resumed inside the Play click; preview without sound still works if resume is refused; export never needs playback.
- **Whisper first-run download / offline** → status shows the download; the Whisper file's own error copy explains the 14 MB + 41 MB; the tool works fully without captions.
- **Firefox** → WebM + separate WAV, explained before the export in the hint and after it in the result; never a silent file passed off as complete.
- **Truthfulness** → the promote trust line is section-aware: `/ai/` tools say "sends your text to a server, says so first, ten free a month"; everything else says "runs in your browser, nothing is uploaded"; no "no third-party requests" claim anywhere; the credit is opt-in; nothing posts anywhere — the owner clicks publish in Instagram.
- **FINDER_INDEX drift** → the tool reads whatever the current index says (title, description, io), so a renamed tool renames its reel; `POPULAR_PATHS` is filtered through the index so a removed tool silently drops out of the quick picks; the test asserts on two tools that exist today.
- **Caption/UTM leakage** → the readable URL has no UTM; the QR and the "link for bio" carry `utm_source/medium/campaign/content` exactly as the site's attribution scheme requires.
- **CSS collisions** → all new classes are `reel-` prefixed; existing `.aivid-*` and `.aiimg-*` are reused unchanged; the fragment is fenced so the integrator can replace it idempotently.