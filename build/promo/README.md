# 1234Tools Promotion Desk

A local tool for promoting the site's tools by hand, in about 45 minutes a day. It drafts copy that fits each venue, finds live questions the tools answer, opens prefilled composers, makes launch-kit images, and keeps a posting log that enforces each venue's cadence.

**A human publishes every post.** The desk never logs in to a platform, never submits a form, never calls a posting API and never drives a browser against a social site. "Open composer" opens a prefilled page in your own browser and stops there. The only network calls are read-only public searches: Reddit, Hacker News Algolia and the Stack Exchange API.

## Run it

```
node build/promo/desk.js serve            # http://127.0.0.1:8797  (ports 8796-8799 only)
node build/promo/desk.js plan             # today's tasks in the terminal
node build/promo/desk.js draft pdf/merge-pdf/ reddit-r-sideproject --template reddit-post --variant 1
node build/promo/desk.js draft pdf/merge-pdf/ qa-stackexchange-superuser --question "How do I merge PDFs on the command line?"
node build/promo/desk.js find pdf/merge-pdf/          # or: find audience:accountants
node build/promo/desk.js kit pdf/merge-pdf/
node build/promo/desk.js log [--venue social-x]
node build/promo/desk.js log add reddit-r-smallbusiness --kind help --url https://...
node build/promo/desk.js venues [--section pdf] [--audience accountants]
node build/promo/desk.js lint "Free, 100% private PDF merger"
```

Tool paths work with or without the leading slash. Git Bash rewrites `/pdf/...` into a Windows path; the desk undoes that, but `pdf/merge-pdf/` avoids the problem.

The web app has seven tabs:

- **Today**: the day's routine as tasks, each with the tool, the venue, the draft, the venue's red lines and a composer link where one exists. **Done…** asks for the post URL and logs it; **Skip** logs a skip. High-risk venues are never suggested here; venues whose rules the register could not confirm carry a **verify rules first** badge.
- **Draft**: pick any of the 232 finder tools, then a venue (ranked by fit, with risk, self-promotion rule, cadence status, rules link, notes and how the register verified them), a template and a variant. Every part has a live character count against its limit, red lint errors and its own Copy button. While a venue is blocked by the log, Copy and Open composer are disabled until you tick the override (logged as an override).
- **Opportunities**: open questions for a tool or an audience. Every question found is saved (`opportunities.json`) with its status — new, drafted, answered, dismissed — so a restart loses nothing and a dismissed question stays dismissed when it turns up again. **Draft answer** opens Draft with the question in the answer template; **Mark answered** and **Dismiss** file it.
- **Drafts survive restarts**: an edited draft is saved as you type (`drafts.json`) and comes back when the same tool, venue, template and variant are opened again, with **Reset to the generated text**.
- **Kits**: generates a launch kit that tells the tool's story — the pain, the usual way, the fix with a REAL example captured from the live tool, three steps, a QR call to action — as a 5-slide carousel (plus `carousel.pdf` for LinkedIn documents), a square, a story, a Pinterest pin and a link-preview card. Every kit gets a different look (5 layouts × 8 palettes × 5 type styles × 3 copy variants, never repeating the tool's last 3 or the last 2 overall); **Shuffle look**, the Layout / Palette / Type / Copy menus, a seed and six alternative-look thumbnails let you choose.
- **Calendar**: a 90-day short-video plan, about nine a week in five formats (problem → solution, before / after, 10-second developer tricks, India finance, AI at work), no tool repeated within 21 days. Each slot carries the tool's own hook and the Reel's beats, with **Make the Reel** (opens the Reel Maker on that tool), **Kit**, **Caption**, and **Made / Posted / Skip**; statuses live in `calendar.json` and survive re-planning; **Download CSV** for a shared planner.
- **Venues**: the register as a filterable table, plus the excluded venues with reasons and the research insights.
- **Log**: history with filters, a form for help-only replies and removals, and cadence status per venue.
- **Reels**: the top tools per section with a link to the Reel Maker (`/ai-video/reel-maker/?tool=<path>`), which works once that page is deployed.

## The daily routine (spec Part B section 5)

| Day | Work | Linked posts |
|---|---|---|
| Mon | Search-intent answers: Reddit, Quora, Stack Exchange. 2 help-only replies, at most 1 linked reply | 1 |
| Tue | Owner channels: X, Mastodon, Bluesky, Threads. One tool, four templates | 4 |
| Wed | One forum reply or Facebook group post, one Discord help | 1 |
| Thu | LinkedIn post (link in the first comment) and 2 comments on other posts | 1 |
| Fri | Pinterest pin and YouTube Short description, using the kit images | 2 |
| Sat | Newsletter blurb, WhatsApp/Telegram broadcast (fortnightly), directory listings | 4 |
| Sun | Off. Read replies and removals, answer criticism once | 0 |

## Red lines

- One account per platform. No vote manipulation, upvote requests, engagement pods, sockpuppets, fake reviews, "a friend sent me this" or AI-generated praise.
- Never the same link across subreddits or groups in one day, never identical text twice (the desk refuses a repeat within 90 days), one link per piece, never edit a link in after approval.
- Disclose ownership wherever the author voice is not obvious. Stack Exchange answers must be complete without the link.
- No URLs in YouTube comments; no unsolicited DMs; broadcast only to people who opted in.
- r/privacy, r/PrivacyGuides and r/degoogle are off limits (see the excluded list in `venues.json`).
- Truthfulness, enforced by `lint.js`: never "100% private", never "no tracking" or "no third-party requests" without the consent qualifier ("nothing contacts a third party on page load; analytics only after you opt in"), never "nothing is sent anywhere". For browser tools the claim is "nothing you type is uploaded". AI for Business tools (`/ai/`) need an account, send text to a model and are free only for 10 runs a month, so the words "free", "offline", "on your device", "no account" and "no upload" are errors there unless the allowance is stated. No "best", "#1", "unlimited", scarcity, testimonials, invented user counts or disparaged competitors. "No watermark" is only for media tools (pdf, image, ai-image, ai-video).

## How cadence is enforced

`log.js` judges every linked post against the log before Draft or Today offers it:

- the venue's `cadenceDays` and `maxPerWeek`, combined with the spec's template caps (for example Show HN once in 30 days, newsletter and broadcasts once in 14 days, LinkedIn twice a week); the stricter wins;
- the same tool on the same venue at most once in 30 days, and a tool on at most 4 venues a week and one community a day;
- the day's linked-post cap from the routine above (Sunday is 0);
- the 9:1 rule in other people's spaces (Reddit, forums, Q&A, communities): after a linked post, nine help-only contributions must be logged on that venue before the next one;
- launch-once venues, one linked reply per thread, a 90-day cooldown after a moderator removal, and a refusal of identical text within 90 days.

Visitor share targets (`roles: ["share"]`) are never limited and never suggested.

## Where things live

Nothing personal is in the repo (everything committed is published). Your data lives in `%USERPROFILE%\.1234tools-promo\`:

- `log.json`: every post, help-only reply, skip and removal you log.
- `kits\<slug>\`: `kit.md` (every template rendered with counts, the best-fit venues with their rules notes and links, a UTM link per venue) the story and the look used (with the command that reproduces it), `carousel-1.png`…`carousel-5.png` (1080×1350), `carousel.pdf`, `square-1080.png`, `story-1080x1920.png` (QR to the `instagram-story` UTM link, read back by the site's own QR engine), `pin-1000x1500.png` and `wide-1200x630.png`. `kits\history.json` remembers the looks used so the next kit differs.
- `examples\<tool>\`: real examples captured from the live tools by `node build/promo/examples.js capture-all` (published to the site by `build-examples.js`).
- `opportunities.json`, `drafts.json`: saved questions with their status, and your edited drafts.
- `seo\`: SEO control centre spreadsheets (`node build/seo/control-centre.js`).
- `cache\`: finder responses, kept 30 minutes.
- `config.json` (optional): `{"accounts": {"reddit": "yourname", "hn": "yourname"}}` so the finder skips your own posts.

Set `PROMO_HOME` to use another folder (the tests do). `PROMO_NOW` pins the clock, for planning ahead.

## The finder

Reddit (`/r/<sub>/search.json … t=month`, falling back to the same search as RSS when Reddit refuses JSON from your network), Hacker News (`search_by_date`) and Stack Exchange (`search/advanced … accepted=False`). It sends a descriptive `User-Agent` with a contact address (set in `find.js`; override it with `PROMO_UA`), makes at most one request a second, follows Reddit's own rate-limit headers, searches at most three subreddits per run and caches for 30 minutes. It keeps questions only, newest and most relevant first, and drops locked, archived and stickied threads, threads older than 30 days (48 hours on Hacker News), and the off-limits subreddits.

## Reading the results in GA4

Every link the desk writes carries `utm_source=<venue id>&utm_medium=<social|community|forum|video|launch|directory|newsletter|email>&utm_campaign=<section slug>&utm_content=<tool slug>`. Reddit, Hacker News, Stack Exchange, Bluesky and email outreach use the clean URL, because UTM there looks like spam; the referrer still names the site.

In GA4: **Reports → Acquisition → Traffic acquisition**, set the primary dimension to **Session source / medium**, and filter **Session medium** with the regex `social|community|forum|video|launch|directory|newsletter|email`. Add **Session campaign** (the section) and **Session manual ad content** (the tool) as secondary dimensions to see which tool and venue brought engaged sessions. Once a month, drop venues with no engaged sessions after three months.

## Files

| File | What |
|---|---|
| `desk.js` | CLI and the local server (Node `http`, binds 127.0.0.1, Host-header guard, JSON API) |
| `ui/` | the single-page app (plain JS, site fonts, works offline except the finder) |
| `templates.js` | `render(templateId, record, opts)` for all 31 templates; `record()`, `utmUrl()` |
| `tools.js` | tool records from the site's finder index, search index, jobs, collections, guides and comparisons |
| `hashtags.js`, `hooks.js` | the spec's hashtag table and hook library, with truth constraints per hook |
| `lint.js` | truthfulness and limit checks |
| `venues.js` | the register, fit ranking, composer URLs, red lines |
| `venues.json` | the venue register (maintained separately) |
| `log.js` | the posting log and every cadence rule |
| `plan.js` | Today |
| `find.js` | the opportunity finder |
| `kit.js`, `kit-templates/` | launch kits: layouts, palettes (WCAG AA checked on load), type styles, example frames, the look picker |
| `stories/` | the story for every tool (pain, usual way, fix, steps, proof, example spec); `index.js` merges the shards |
| `examples.js`, `samples/` | captures real examples by driving the live tools; CC0 sample photos with their licences |
| `store.js` | saved opportunities and drafts |
| `fixtures/` | one saved response per search API (Reddit JSON is a documented-shape synthetic: Reddit answered 403 from the network the fixtures were captured on) |
| `test.js`, `test-ui.js`, `test-kit.js`, `test-examples.js` | `node build/promo/test.js` (no browser, no network; includes a real server-restart check); `test-ui.js` (puppeteer on port 8751); `test-kit.js` (kits, looks, overflow matrix); `test-examples.js` (live capture) |
