# Wave S (social media) — hand-back notes

Branch `wave/wsoc-2026-10-06`, from `main` a90208e9d. Worked in a local worktree on the owner's Windows machine (not the cloud); Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`; test ports 8870–8899. Kept current after every item.

## Drop 1 complete (2026-10-06)

### A. Reel Maker versus CapCut — `engine/aivid-reel-maker.js`, new `engine/aivid-reel-fx.js`

1. **Transitions** — eleven, plus Auto: cut, crossfade, slide left/right/up/down, zoom in, zoom out, whip pan with motion blur (16-sample smear along the move), dip to black, dip to white. Chosen per scene (a select on every scene after the first), for the whole reel (Effects → "All scenes arrive with"), or Auto = the template's plan for that scene, else the look's crossfade (the old behaviour, unchanged). A chosen transition draws both scenes whole on scratch canvases at the frame's real pixel size and composes them; header, captions, AI label and credit are drawn over, unmoved.
2. **Text animations** — six more, per scene: word by word, line bounce, highlight sweep (a band in the palette's AA-checked chip colour with chip ink), glitch (magenta/cyan split, strong for 0.45 s then a blip every 1.3 s, deterministic per frame), scale punch per word, karaoke fill (dim words fill with the accent ink). **Caption looks**: Auto Captions now exports four more looks (word box, bold capitals, neon, one word) and the Reel Maker's caption swatches read that list, so both tools offer the same eight.
3. **Beat detection** — `detectBeats()`: decimate to ~11 kHz, 512-point Hann STFT every 11.6 ms, spectral flux of log magnitude, adaptive threshold (local mean ×1.3 + 0.1 × median), peak picking with 100 ms minimum gap; tempo from the onset-envelope autocorrelation with a log-normal prior on 120 BPM and a half-lag check (no 150→75 octave errors); beat grid by phase search, each beat snapped to the envelope peak within ±35 ms; grid trimmed where the music has not started or has stopped. Runs in a Web Worker (the same file, started with `new Worker`), with Cancel. Beats are marked on the timeline; **Cut to the beat** snaps every cut to the nearest beat (scenes kept 1–15 s), with Undo.
4. **Timeline-lite** under the preview — one block per scene: drag a block's right edge to change the length (sticks to a beat within 0.08 s; Shift drag is free), drag a block to reorder, keyboard: the edge is a slider (arrows ±0.1 s, Shift ±0.5 s), Alt+arrows move a scene. A **clip trimmer** for the selected clip: in and out handles (pointer and keyboard), the length follows at the clip's speed.
5. **Colour grades** — eight (warm, cool, vintage, black and white, high contrast, faded, teal and orange, vivid) for the reel or per scene (Media → Colour grade). A per-pixel transform (gain/offset, saturation about Rec. 709 luma, split tone, S-curve, black/white point), identical in every browser (no `ctx.filter`, which Safari lacks). **Grades colour pictures and clips only**; text keeps the look's contrast-checked colours (decision, see below). **Per-clip speed** 0.5×–2× (Media → Speed): the clip is read at start + local × speed in preview, export and real-time recording; its own sound plays at that rate (and so pitch) — the page says so.
6. **Stickers** — 336 Noto Emoji (vendored subset, Apache-2.0, 1.0 MB, fetched only when a picker opens; shared with the Thumbnail Maker) with search, 8 shapes, 6 arrows, 7 badges (incl. your own word). Drag on the preview to move, drag the corner to resize; sliders for across/down/size/turn per sticker (keyboard). They pop in at their scene's start and travel with the scene through transitions.
7. **Twelve new templates** — listicle (4 quick things), POV, a day in the life, FAQ, quote card, countdown, product demo, tutorial, hot take, this or that, things I wish I knew, behind the scenes (my choice). Each carries a plan of transition + animation per scene.
8. **Export destinations** — Instagram Reels, TikTok, YouTube Shorts, Instagram Stories, LinkedIn, X (and Custom): size, bitrate, frame rates and safe area, each with its source on the page. Meta's Reels/Stories guides: keep 14% top, 35% bottom, 6% sides clear (applied to the layout, not only shown); YouTube: 8 Mbps at 30 fps, 12 at 60 for 1080p; X: 1280×720, ≥5,000 kbps, 30/60 fps (new 1280×720 size); LinkedIn: 1080×1080, its spec says under 30 fps so 60 is not offered. TikTok and Shorts publish no single organic safe zone, so they use Meta's margins and say "approximate". **60 fps option**. **GIF of one scene**: vendored gifenc, 540 px wide (9:16 → 540×960), 15 fps, one palette from four frames, looping, frames read exactly like the MP4 export.

Kept working: voice-over (recorded, uploaded, generated), captions, QR end card, AI label, removable credit, batch, promote mode, drafts (now also keep transitions, grade, destination, frame rate and stickers).

### B. The /social/ section — `build-social.js` (new generator, copy of build-ai-video.js, plus the depth block)

- **carousel-maker** — 7 templates, 1080×1350 / 1080×1080, 1–20 slides, photo per slide, progress styles, swipe cue, handle/logo; ZIP of PNGs (`carousel-01.png` …) and a one-JPEG-per-page PDF for LinkedIn.
- **social-post-maker** — 9 templates, brand kit (colours, logo, heading/body fonts; saved only on Save, in localStorage, logo ≤512 px PNG), all 8 platform sizes at once as a ZIP or one by one; text shrinks to fit (or is cut with "…" and named), story size keeps 250 px top/bottom clear.
- **caption-counter** — Instagram, X (weighted: links 23, emoji/CJK 2; matched twitter-text on 39/39 captions), LinkedIn, TikTok, YouTube title + description, Facebook, Threads; graphemes, UTF-16 units, bytes, words, lines, emoji, hashtags, mentions, links; first-line "… more" previews (labelled approximate); the Instagram blank-line fix (U+2800, its cost stated); draft kept only if ticked. Every limit's source URL and date is in `build/content/social.js`.
- **engagement-rate-calculator** — five formulas side by side (by followers, by reach, by impressions, likes+comments by followers, average per post), each with its formula and sum; validation; no benchmarks.

### Test counts (exact, all run by me in this worktree)

| Suite | Result |
|---|---|
| `build/ai-video/tests/reel-maker.js --root . --port 8872` | **200 passed, 0 failed** (the 188 plus 12: one "makes its scenes, no overflow" check per new template) |
| `build/ai-video/tests/reel-fx.js --port 8873` (new) | **80 passed, 0 failed** (27 in Node, 53 in Chrome) |
| `build/ai-video/tests/reel-voice.js --root . --port 8874` | 86 passed, 0 failed |
| `build/ai-video/tests/tts-g2p.js --root .` | 45 passed, 0 failed |
| `build/social/tests/carousel-maker.js` | 42 passed, 0 failed |
| `build/social/tests/social-post-maker.js` | 29 passed, 0 failed |
| `build/social/tests/caption-counter.js` | 75 passed, 0 failed |
| `build/social/tests/engagement-rate-calculator.js` | 41 passed, 0 failed |
| `build/tests/claims.js --only social --port 8878` | 48 claims checked, 48 passed, 0 failed, 4 manual |
| `build/content/_check.js` (site-wide) | 152 pages, 0 errors, 0 warnings |
| `build/tests/hubs-nav.js --port 8879` | 122 passed, 0 failed |
| `build/tests/home-finder.js --port 8879` | 84 passed, **2 failed** — expected until the release: the home `<title>` and descriptions still say 1,283 while the register (search index, with the new tools) says more. Those two are written by `build-home.js`, a post-processor I may not run; `node build-home.js --check` reports it would rewrite them. |

Existing checks changed by design (reel-maker.js): "the template select offers 7 templates" now counts the 19 templates in its own hand-written TEMPLATE_TYPES table (12 rows added, read off each template's lines), and the voice-over check's message says 19. No check was removed or loosened.

Untested: Firefox and Safari (all browser runs are Chrome); the Reel Maker's real-time recorder path (`--recorder`) was not run; drag-and-drop of photos into the carousel (the file input is tested).

## Shared files changed

- `assets/app.css` — the `/* WAVE-S start */ … /* WAVE-S end */` block at the very end, one sub-block per part (reel, social, thumbnail, captions). No existing rule edited.
- `build/sections.js` — the `/social/` entry ("Social Media Tools", head "Social Media", noun `tool`).
- `build-sidebar.js` — `['/social/', 'i-social']` in ORDER after AI Video (the generator refuses to run without it).
- `build/release.js` — `['social', 'build-social.js']` in GENERATORS, after ai-video.
- `build-site.js` — `social` in the sitemap section list; REL_AFFINITY for `social`, and `social` added to ai-video's.
- `build-pwa.js` — CATEGORY for `social`.
- `build-hubs.js` — the /social/ hub intro and its three finder starters.
- `build/jobs.js` — section default, verb/io line, card description and START for the /social/ tools.
- `build/content/_check.js` — `social` in FILE_SECTIONS, so /social/ pages are held to the file-and-text depth rules.
- `build/tests/claims.js` — `social` in SECTIONS and `social.js` in the claims file list.
- `engine/vendor/README.txt` — a line for `noto-emoji/`.

## Decisions taken (reversible)

- Generated files that every generator rewrites (sw.js, assets/search-index.js, sitemap-1.xml, assets/icons.svg, index.html's home card, 404.html and the site total on ~1,400 pages) are NOT committed: the release's generators (now including `social`) write them, and committing them would collide with every other wave. Only pages under `/social/` and `/ai-video/` are committed. The home card for /social/ is placed by build-social.js beside the AI Video card (as build-ai-video.js does); no hero tile was added.
- Grades apply to pictures and clips only, not to text scenes, so the eight palettes keep their WCAG AA contrast.
- Existing seven templates keep the look's crossfade as their Auto transition (so every existing frame, and every existing check, is unchanged); only the twelve new templates carry transition plans.
- Destination safe areas change the layout (content box), not only the guide. Custom (the default) keeps the old 250/340 px margins.
- X preset is 1280×720 landscape (X's recommended size); a 9:16 reel posts to X fine as 1080×1920 via Custom.
- Social drop-1 decisions by the helper (all reversible): X image 1920×1080 and LinkedIn 1200×628 (each platform's own figure rather than the brief's 1600×900 / 1200×627); TikTok caption 2,200 (the documented API limit; the app's reported 4,000 appears on no TikTok page); Instagram hashtags warn above 5 (Instagram's December 2025 announcement), over above 30; counting in UTF-16 units where a platform does not say; one brand kit shared by Carousel and Post Makers; own ZIP writer in `engine/social-kit.js` (pauses, UTF-8 names).
- The drop-1 commit's social pages already list the drop-2 social tools (the generator lists every spec present); their pages arrive in the drop-2 commit.

## Notes for the release

- **Bump sw.js V**: engine-only changes (Reel Maker, Thumbnail Maker, Auto Captions) and new Whisper decoder bytes under the same file names (a stale cache would refuse the new decoder).
- Run the `ai-image` generator too: `engine/ai-image-tools-thumbnail-maker.js` copy changed and its page is not regenerated on this branch.
