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
node build/promo/desk.js guide                       # vision, process, red lines, channel list, FAQ
node build/promo/desk.js guide linkedin-document     # one channel's card: format, limits, files, checklist
node build/promo/desk.js coverage [--days 14]        # calendar targets posted, missing or needing a check
node build/promo/desk.js sites                       # the site profiles; add --site <id> to any command
node build/promo/desk.js coverage --site xleshop
node build/promo/desk.js testimonials --site xleshop [list|add|email|export|status|set|takedown|suggest]
```

Tool paths work with or without the leading slash. Git Bash rewrites `/pdf/...` into a Windows path; the desk undoes that, but `pdf/merge-pdf/` avoids the problem.

The web app has ten tabs:

- **Today**: the day's routine as tasks, each with the tool, the venue, the draft, the venue's red lines and a composer link where one exists. **Done…** asks for the post URL and logs it; **Skip** logs a skip. High-risk venues are never suggested here; venues whose rules the register could not confirm carry a **verify rules first** badge. Above the tasks, **Today's videos** lists the day's calendar slots and the channels still to post, with "wait" where a channel's cadence is used up.
- **Draft**: pick any of the 232 finder tools, then a venue (ranked by fit, with risk, self-promotion rule, cadence status, rules link, notes and how the register verified them), a template and a variant. Every part has a live character count against its limit, red lint errors and its own Copy button. While a venue is blocked by the log, Copy and Open composer are disabled until you tick the override (logged as an override).
- **Opportunities**: open questions for a tool or an audience. Every question found is saved (`opportunities.json`) with its status — new, drafted, answered, dismissed — so a restart loses nothing and a dismissed question stays dismissed when it turns up again. **Draft answer** opens Draft with the question in the answer template; **Mark answered** and **Dismiss** file it.
- **Drafts survive restarts**: an edited draft is saved as you type (`drafts.json`) and comes back when the same tool, venue, template and variant are opened again, with **Reset to the generated text**.
- **Kits**: generates a launch kit that tells the tool's story — the pain, the usual way, the fix with a REAL example captured from the live tool, three steps, a QR call to action — as a 5-slide carousel (plus `carousel.pdf` for LinkedIn documents), a square, a story, a Pinterest pin and a link-preview card. Every kit gets a different look (5 layouts × 8 palettes × 5 type styles × 3 copy variants, never repeating the tool's last 3 or the last 2 overall); **Shuffle look**, the Layout / Palette / Type / Copy menus, a seed and six alternative-look thumbnails let you choose.
- **Calendar**: a 90-day short-video plan, about nine a week in five formats (problem → solution, before / after, 10-second developer tricks, India finance, AI at work), no tool repeated within 21 days. Each slot carries the tool's own hook and the Reel's beats, with **Make the Reel** (opens the Reel Maker on that tool), **Kit**, **Caption**, and **Made / Posted / Skip**; statuses live in `calendar.json` and survive re-planning; **Download CSV** for a shared planner. See *The per-channel checklist* below.
- **Testimonials**: named client quotes for the site in the picker, each published only with the client's written permission. See *Testimonials* below.
- **Guide**: why the desk exists, the process from slot to every channel (with the Today routine, cadence, the 9:1 rule, missed days, removals and skips), the red lines, one card per channel and the FAQ. The same text prints with `desk.js guide`.
- **Venues**: the register as a filterable table, plus the excluded venues with reasons and the research insights.
- **Log**: history with filters, a form for help-only replies and removals, and cadence status per venue.
- **Reels**: the top tools per section with a link to the Reel Maker (`/ai-video/reel-maker/?tool=<path>`), which works once that page is deployed.

## The per-channel checklist and coverage

Every calendar slot has **targets**, one per channel and format it should go to (`FORMATS` in `calendar.js`):

| Format | Targets |
|---|---|
| Problem → solution | Instagram Reel, YouTube Shorts, TikTok, Facebook Reel (native, no link), Instagram feed carousel (the kit's slides), LinkedIn document (`carousel.pdf`) |
| Before / after | Instagram Reel, TikTok, Facebook Reel (native), Pinterest video pin |
| 10-second developer trick | YouTube Shorts, X, LinkedIn post |
| India finance | Instagram Reel, YouTube Shorts, Facebook Reel (native), WhatsApp Status, Instagram feed carousel, LinkedIn document |
| AI at work | LinkedIn post, YouTube Shorts, Instagram Reel |

For each target you paste the post's own link and press **Record**, or press **Posted (tick)** where a post has no lasting link (WhatsApp Status, an Instagram Story, a WhatsApp Channel update), or **Skip…** with a reason. **Add a channel** records a channel the slot did not list. **How to post** opens that channel's card in the Guide.

**Verification is local and honest.** The desk reads the link's text only, never opens it, and never contacts the platform. It flags a link that is not https, belongs to another platform, or has the wrong format for the target (an `instagram.com/p/…` link on a Reel target: "wrong format: this is a feed post (instagram.com/p/…), the slot asked for a Reel (instagram.com/reel/…)"; a `watch?v=` link on a Shorts target), and the same link recorded on two targets. A link recorded before the slot's date only warns. A flagged link does not count until you press **It is right**. Short links (`pin.it`, `vm.tiktok.com`, `fb.watch`, `lnkd.in`) are accepted with a note that the desk cannot see behind them; it also cannot tell a video pin from an image pin, or see that a LinkedIn post carries the PDF.

A slot is **posted** only when every target is posted or skipped with a reason; otherwise **partly posted** with the count ("3 of 5 channels"). The manual Made / Posted / Skip statuses still work; Skip on the slot takes the whole slot out of coverage.

Recording a post (link or tick) on a channel that has a venue in `venues.json` also appends one log entry (`kind: post`, the tool, the link, `note: calendar <slot> · <channel>`), so the cadence rules and Today see it. Recording again after a Clear does not log twice, and Clear never deletes a log entry. WhatsApp Status logs to its own venue, `social-whatsapp-status` (at most one a day).

**Linked posts and profile-link posts.** Only a post that itself carries a clickable link counts toward the linked-post caps and the day's routine cap: LinkedIn, X, a Facebook link post, Threads, Bluesky, Mastodon, Telegram, the WhatsApp Channel and Status, a Pinterest pin with its destination link, an Instagram Story with a link sticker. An Instagram Reel or feed post, a TikTok, a YouTube Short (YouTube's help says Shorts links are not clickable) and a native Facebook Reel are logged with `linked: false, profileLink: true`: kept in the history, counted toward no linked-post cap. For them the desk shows advice, never a block: at most 2 a day per account (`ADVICE` in `channels.js`). A pin or a Facebook Page post recorded with **no link** ticked is logged the same way. `LINK_IN_POST` in `channels.js` holds the split.

**Facebook Page link budget.** Meta confirmed a "limited test" of a cap on link posts for Pages and professional-mode profiles (TechCrunch, 17 December 2025); reports put it at 2 a calendar month without a paid plan (Meta One since 15 September 2026). The desk counts linked posts on `social-facebook` this calendar month and shows "x of 2 used this month" in Coverage, on the Facebook card and in Draft; a third linked Page post waits until the 1st (overridable in Draft). Set the number in the site's `config.json`: `{"facebook": {"linkPostsPerMonth": 2}}`. The guidance: Facebook native by default (Reels and images, no link, "search 1234Tools"), link posts only for the tools that bring the most visits, a first-comment link as a fallback only (reports disagree on whether it counts), Story link stickers, groups by their own rules. A paid Meta plan is listed as an option with its published US price, never as the default.

**Coverage** (the panel at the top of the Calendar tab, or `desk.js coverage --days 14`): for past and today's slots, every target still missing, every link that fails the check, unassigned links, and per channel what was posted, is due today and was missed in the last 7 and 30 days.

**Old calendars** (v1: one status and one `postedUrl` per slot) load unchanged: the link goes to the target whose rules it matches, or stays on the slot as an unassigned link, the old file is copied to `calendar.v1.json`, and nothing is written to the log. Re-planning keeps every slot with a status or any target record, even outside the new 90 days. Writes stay atomic (temporary file, then rename).

## Channel specs: where they live and how to refresh them

`channels.js` is the one source for the channel cards, the link rules and the Guide's numbers. Each spec row has a `value`, the official page it came from (`src`) and the date it was read (`CHECKED`, 2026-10-04). Figures from a platform's publishing API or ads guide are labelled so, because the app can allow more. Where no official page states a figure, or the page renders only with JavaScript (several Instagram, Facebook, TikTok and WhatsApp help pages), `value` is `null` and the card says **not confirmed — check in the app**, with the page that was tried.

Platforms change their limits and links. To refresh: open each `src`, compare, edit `value`, and set `CHECKED` (or a row's own `checked`) to the day you read it; adjust a channel's `url` rules and its `samples` if the link shape changed, then run `node build/promo/test.js`, which checks every sample link (valid, wrong format, wrong platform) and lints every Guide sentence. The vision, process and FAQ text lives in `guide.js`.

## Several sites

The desk promotes fourteen sites, one at a time. Under **Sites**: **1234Tools** (the default), **XLeShop**, **MVR IT Services**, **Attend Now** and **FixOurTime**. Under **XLeShop shops**, the nine client shops hosted on XLeShop: Gajanan Home Foods, Sri Balaji Stores, SouthBasket, Natural Cure Ayurveda, KBK Dairy Products, KBK Mart, Aarvik Dairy Products, DairyZest and RAP CLUB. Pick one in the header (the picker is grouped under those two headings; each browser tab keeps its own), or pass `--site <id>` to any command (`node build/promo/desk.js sites` lists them by group).

**The shops** (`sites/<shop>.js`, `kind: 'shop'`, `pickerGroup: 'XLeShop shops'`) share `sites/_shop.js` (not a profile: site.js loads only `[a-z0-9-]+.js`):

- Stories only from what the shop's own pages show: named products and categories, delivery area and terms, payment options, hours, how to order. No prices, offers, reviews, ratings, "bestseller", organic or certification claims, guarantees, or delivery times the pages do not state (the common shop rules).
- Health rules for every food, grocery, dairy and Ayurveda shop: no "cures", "heals", "treats", "prevents", "boosts immunity", "medicine for…", "healthy", "good for…", nutrition claims. Natural Cure Ayurveda also refuses every disease in the Drugs and Magic Remedies (Objectionable Advertisements) Act 1954 Schedule, the section 3 purposes and any treatment language; the shop's name itself is not matched. Indian food shops follow the FSSAI Advertising and Claims Regulations 2018: "home-made" is refused; "fresh", "natural", "traditional", "authentic" show as owner-to-confirm warnings. Dairy shops: "pure", "chemical-free", "preservative-free", "no adulteration", "A2" are errors unless the shop's own page uses the word, and then a warning (owner to confirm); "100% pure" is always an error. The sources (India Code / Tamil Nadu Drugs Control copy of the Act, CAP Code sections 12 and 15, the FSSAI compendium) are cited in `_shop.js` with the date read.
- A lint rule with `level: 'warn'` in a profile's `forbid` is shown, not refused. A profile's `forbid` rules read the words, not the links: a page path such as `/c/fresh` is not a claim.
- Shop item paths are the shops' clean URLs (`/c/sweets`, `/product/fresh-paneer`, `/faq`). Git Bash turns `/c/sweets` into `C:/sweets`; the desk puts it back, or type `c/sweets`.
- A shop whose catalogue the owner has not supplied is a **skeleton**: no items, its TODOs say what is missing, the picker shows "(skeleton)" (RAP CLUB on 2026-10-05: the live products are a developer sample range).
- Disclosure: the owner builds and hosts these shops but does not run them, so shop copy says "Disclosure: I build and host the <shop> online shop on XLeShop." (profile `disclosure`), never "I run".
- Calendar: three slots a week to **WhatsApp Status, Instagram Reel, Facebook Page post (native) and Instagram feed** (`_shop.js` `TARGETS`, also the default for any profile with `kind: 'shop'`). The Facebook target is preset "native": its **no link** box starts ticked, so it spends no linked-post cap and no Facebook link budget unless you untick it. A `calendarTargets` entry may be a channel id or `{ channel, native: true }`.
- Venue: **Google Business Profile posts** (`social-google-business-profile`, `siteKinds: ["shop"]`) is offered to shops only, with "verify first": post only once the owner confirms the shop has a verified Profile.

- `site.js` holds the switch. Each request and each command runs in one site (Node's AsyncLocalStorage), so two tabs on two sites never mix.
- `sites/<id>.js` is a site's profile: base URL (and how it was confirmed), UTM medium, brand words, colours and logo from its repo, audiences, the items it promotes (products, services or app features, each with hook, pain, the usual way, promise, steps, call to action, the facts the site states and the file that shows it), what was seen but left out (`notConfirmed`), and its claim rules: `free` and `freePhrases` (a site is never called free unless it says so), `browserClaims` (the 1234Tools "nothing you type is uploaded" claims are refused elsewhere), `allowClaims`, and `forbid` regexes for that kind of site. Every profile was read from the site's own repo, read-only, on 2026-10-05.
- `lint.js` applies the common honesty rules everywhere (no absolute privacy, superlatives, scarcity, testimonials, user counts, disparaged competitors) and then the active site's own rules; the 1234Tools rules (AI allowance, media-only "no watermark") are unchanged for 1234Tools.
- `site-templates.js` writes all 31 templates for another site from its stories; `templates.js` hands over to it. `tools.js` answers with the site's items, so Draft, Today, the finder, venue fit and the calendar work unchanged.
- Data: 1234Tools keeps `PROMO_HOME` as it always was; each other site has `PROMO_HOME\sites\<id>\` with its own `log.json`, `calendar.json`, `drafts.json`, `opportunities.json`, `config.json`, `cache\` and `kits\`. Community venues (Reddit, forums, Q&A, communities) are posted from one personal account, so their rules read every site's log; owned channels read only the site's own.
- Calendar for another site: three slots a week (Monday, Wednesday, Friday), the profile's items, targets `instagram-reel, facebook-reel, youtube-shorts, linkedin-post, instagram-carousel` unless the profile sets `calendarTargets`.
- Kits for another site use the item's story, the site's name, host and logo, and the palette whose accent is nearest the brand colour; the live example capture drives 1234Tools pages only, so they draw the "how it works" schematic. The Reel Maker opens without a tool: paste the slot's beats.

To add a site: write `sites/<id>.js` in the same shape (only things the site itself shows), then run `node build/promo/test.js`, which renders every template for every item and fails on any claim the site's rules refuse.

## Testimonials

Owner decision, 2026-10-05: testimonials may come back on any MVR site only as **named quotes given with each client's written permission**. The **Testimonials** tab (or `desk.js testimonials --site <id>`) holds them, per site, in that site's `testimonials.json`; one site never sees another's.

- **A record**: name, role, business, the client's contact details (kept, never shown), the quote in their exact words, what it is about, where it may be used (site pages, social posts, kits), the permission (given yes or no, how: email reply, signed form or message; the date; where you keep the evidence), an optional rating, an optional site key (XLeShop's store key), and the status: **requested → received → approved → published → withdrawn**, with every published URL.
- **The gate.** A quote is approved, published or exported only when permission is "yes" with a real date that is not in the future, how it was given, the evidence you keep and the client's contact details (CAP Code 3.47), a name and a business (a shop's customers: the business only if they give one), at least one use, and no incentive. The desk refuses otherwise and says why. Approved words, names and uses are frozen: a change needs the client's OK again (set it back to received before it is published, or withdraw it). Publishing needs the URL where it went up.
- **Withdrawn** is final. The quote leaves every export at once, and the desk lists each URL it was published at until you press **Taken down** on each.
- **Request email.** One short email and a WhatsApp version per site, in plain British English, for you to send yourself: one or two sentences in the client's own words, "whatever is true for you, good or bad"; exactly where it will appear (the site's address, its social posts, its promotion images, as chosen); that their name and business are shown; nothing offered in return; no is a fine answer; they can have it taken down at any time by replying; and the reply "Yes, you may publish this" with their final wording. No suggested wording, so no praise is put in their mouth. Every version is linted with `lint.js` and the site's own rules (the recipient's own name and business are not promotion copy, so they are left out of that check); `test.js` checks every site.
- **Export** (approved and published quotes for one use): an HTML snippet (`<figure>` per quote, the name, role and business in the caption, "Quoted with each person's permission"), a JSON array of `{ name, role, business, quote, date }` (the date is the permission date) for a site's quotes list, and, where records carry a site key, a keyed `QUOTES` object. Stars appear only when the client gave a rating in writing (stored with where that is). XLeShop's `js/site.js` renders `QUOTES[shot]` as a bare string today; it needs the name, role and business shown beside each quote before these go in.
- **Suggested first requests** (you send them; the desk contacts nobody): for XLeShop, the owners of its nine client shops (from `sites/*.js`, with each store's key); for MVR IT Services, the seven clients on its products page's client list (XLeShop and Attend Now there are MVR's own platforms). Other sites: none.
- **Words in a quote** that the site's rules would refuse in promotion copy show as "check before publishing" notes; the desk never edits the client's words, so ask the client if a claim in them cannot be shown to be true.

Sources, read 2026-10-05 and cited in `testimonials.js`: the CAP Code section 3, rules 3.45–3.48 (<https://www.asa.org.uk/type/non_broadcast/code_section/03.html>); the Digital Markets, Competition and Consumers Act 2024, Schedule 20 paragraph 13, in force 6 April 2025 (<https://www.legislation.gov.uk/ukpga/2024/13/schedule/20>); the CMA's Fake reviews guidance CMA208, 4 April 2025 (<https://assets.publishing.service.gov.uk/media/67eeb64fe9c76fa33048c790/CMA208_-_Fake_reviews_guidance.pdf>), which the CMA's unfair commercial practices guidance CMA207 points to for banned practice 13.

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
- Truthfulness, enforced by `lint.js`: never "100% private", never "no tracking" or "no third-party requests" without the consent qualifier ("nothing contacts a third party on page load; analytics only after you opt in"), never "nothing is sent anywhere". For browser tools the claim is "nothing you type is uploaded". AI for Business tools (`/ai/`) need an account, send text to a model and are free only for 10 runs a month, so the words "free", "offline", "on your device", "no account" and "no upload" are errors there unless the allowance is stated. No "best", "#1", "unlimited", scarcity, social-proof claims ("trusted by", star ratings), invented user counts or disparaged competitors. Testimonials only as named quotes with the client's written permission, through the Testimonials tab (below), never written into promotion copy. "No watermark" is only for media tools (pdf, image, ai-image, ai-video, social).

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
- `testimonials.json`: the site's named client quotes, with each client's permission record, status and where each quote was published.
- `calendar.json`: the 90-day plan with every slot's targets and what you recorded (v2); `calendar.v1.json` is the untouched copy of a calendar made before targets existed.
- `seo\`: SEO control centre spreadsheets (`node build/seo/control-centre.js`).
- `cache\`: finder responses, kept 30 minutes.
- `config.json` (optional): `{"accounts": {"reddit": "yourname", "hn": "yourname"}, "facebook": {"linkPostsPerMonth": 2}}`: the finder skips your own posts; the Facebook Page link budget (default 2).
- `sites\<id>\`: the same files for each other site (XLeShop, MVR IT Services, Attend Now, FixOurTime and each of the nine XLeShop shops); 1234Tools keeps the folder itself.

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
| `testimonials.js` | named client quotes per site: the permission gate, statuses, withdrawals, the request email and WhatsApp text, the export, suggested first requests; its sources are cited at the top |
| `calendar.js` | the 90-day video calendar: slots, targets, link verification, coverage, v1 migration |
| `channels.js` | every channel's format, limits, links, files, checklist and red lines, with sources and check dates; the link rules |
| `guide.js` | the Guide's vision, process, red lines and FAQ (lint-clean), and the `guide` CLI text |
| `site.js`, `sites/` | the site switch, the four other sites' profiles, the nine XLeShop shops' profiles and `sites/_shop.js` (their shared claim rules, sources, calendar targets and disclosure) |
| `site-templates.js` | promotion copy for the other sites, from their stories, linted with their rules |
| `fixtures/` | one saved response per search API (Reddit JSON is a documented-shape synthetic: Reddit answered 403 from the network the fixtures were captured on) |
| `test.js`, `test-ui.js`, `test-kit.js`, `test-examples.js` | `node build/promo/test.js` (no browser, no network; channel link rules, guide lint, calendar targets, coverage and migration; a real server-restart check on port 8753, `PROMO_TEST_PORT` to change, which `serve` accepts only with `PROMO_TEST=1`); `test-ui.js` (puppeteer on port 8751, `PROMO_UI_PORT` to change; includes the Guide, target recording, the wrong-format warning and coverage); `test-kit.js` (kits, looks, overflow matrix); `test-examples.js` (live capture) |
