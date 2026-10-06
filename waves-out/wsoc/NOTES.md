# Wave S (social media) — hand-back notes

Branch `wave/wsoc-2026-10-06`, from `main` a90208e9d. Kept current after every item.

## Status

In progress. Drop 1 not yet complete.

## Baseline (before any change)

- `build/ai-video/tests/reel-maker.js --root . --port 8870`: 188 passed, 0 failed (242 s).

## Shared files changed

- `assets/app.css` — the `/* WAVE-S start */ … /* WAVE-S end */` block at the very end, with one sub-block per part of the wave (reel, social, thumbnail, captions). No existing rule is edited.
- `build/sections.js` — the `/social/` entry ("Social Media Tools", head "Social Media", noun `tool`).
- `build-sidebar.js` — `['/social/', 'i-social']` in ORDER, after AI Video (the generator refuses to run without it).
- `build/release.js` — `['social', 'build-social.js']` in GENERATORS, after ai-video.
- `build-site.js` — `social` in the sitemap section list; REL_AFFINITY for `social` (and `social` added to ai-video's).
- `build-pwa.js` — CATEGORY for `social`.
- `build-hubs.js` — the /social/ hub intro and its three finder starters.
- `build/jobs.js` — section default, verb/io line, card description and START for the /social/ tools.
- `build/content/_check.js` — `social` in FILE_SECTIONS, so /social/ pages are held to the file-and-text depth rules.
- `build/tests/claims.js` — `social` in SECTIONS and `social.js` in the claims file list.

## Decisions taken (reversible)

- Generated files that every generator rewrites (sw.js, assets/search-index.js, sitemap-1.xml, assets/icons.svg, index.html's home card and the site total on every page) are NOT committed on this branch: the release's generators (now including `social`) write them, and committing them would collide with every other wave. Only the pages under `/social/` and `/ai-video/` are committed.
