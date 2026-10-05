'use strict';
/**
 * The desk's Guide: why it exists, how a video goes from the calendar to
 * every channel, the questions the owner will have, and (from channels.js)
 * one card per channel with its format, limits, links, files and checklist.
 *
 * One source for the Guide tab, `node build/promo/desk.js guide [channel]`
 * and the tests. Every sentence here passes lint.js: the red lines are the
 * README's, restated so the guide never quotes a forbidden phrase.
 *
 *   payload()      -> { vision, process, faq, redLines, channels, checked }
 *   text(channel)  -> the guide (or one channel's card) as plain text; null if no such channel
 *   allText()      -> [{ where, text }] every string the guide shows, for the lint test
 */
const CH = require('./channels');

const VISION = {
  title: 'Why the desk exists',
  points: [
    'People do not go looking for a tools site. They have a problem (a PDF to merge, a GST figure to check, a photo to resize) and they use whatever solves it in front of them. The desk puts the right tool in front of the people who have that problem, through the audiences and places where the problem comes up.',
    'One problem, one tool, one real result. Every video and every kit shows a real output captured from the live tool, never a mock-up, and every caption names one tool and carries one link.',
    'A human publishes every post. The desk drafts, checks, plans and keeps records. It never logs in to a platform, never submits a form, never calls a posting API and never schedules a post.',
    'Honest claims only. The lint rules are the floor: never claim absolute privacy (for browser tools the claim is "nothing you type is uploaded"); never say there is no tracking or no third-party requests without the consent qualifier, "nothing contacts a third party on page load; analytics only after you opt in"; AI for Business tools state their allowance of 10 free runs a month and that text goes to a model; no superlatives, rankings, scarcity or invented user numbers; testimonials only as named quotes given with the client\'s written permission (the Testimonials tab); never run down another product.',
    'Help first in other people\'s spaces. In communities, forums and Q&A sites the 9:1 rule applies: nine link-free, useful contributions for every linked one.'
  ]
};

/* The README's red lines, restated in words that pass lint.js. */
const RED_LINES = [
  'One account per platform. No vote manipulation, requests for upvotes or likes, engagement pods or sockpuppets.',
  'No fake reviews, invented recommendations from friends or clients, or AI-written praise.',
  'A human publishes every post: no automated, scheduled or bulk posting.',
  'One link per post, and never the same link across several groups or subreddits in one day. Never edit a link into a post after it was approved.',
  'Never identical text twice: the desk refuses a repeat within 90 days, so change the template or variant.',
  'Disclose that you built the site wherever the author voice is not obvious.',
  'No links in YouTube comments; no unsolicited direct messages; broadcast only to people who opted in.',
  'Never claim absolute privacy; for browser tools say "nothing you type is uploaded". Privacy and analytics claims carry the consent qualifier: nothing contacts a third party on page load; analytics only after you opt in.',
  'AI for Business tools (/ai/): an account is needed, text goes to a model, and they are free for 10 runs a month. Say so wherever the word free appears; never say on your device, offline, no account or no upload about them.',
  '"No watermark" only for media tools (PDF, image, AI image, AI video).',
  'No superlatives, ranking claims, scarcity, invented user numbers or comparisons that run down another product.',
  'Testimonials only as named quotes in the client\'s own words, given with their written permission and recorded in the Testimonials tab; nothing offered in return, no wording suggested to them, and a withdrawn quote comes down everywhere.'
];

const PROCESS = {
  title: 'From a calendar slot to every channel',
  steps: [
    { title: '1. Open the slot', text: 'Calendar tab: today\'s slot has a gold edge. It names the tool, the story\'s hook, the beats for the video and its targets: one row per channel and format it should go to (for example Instagram Reel, YouTube Shorts, TikTok, Instagram feed carousel, LinkedIn document). The Today tab lists today\'s slots and the channels still missing.' },
    { title: '2. Make the Reel', text: 'Make the Reel opens the Reel Maker with the tool chosen and the script written from its story. Keep the 1080×1920 size, record your voice if you like, export, and keep the file it saves (reel-<tool>.mp4) and its cover image (reel-<tool>-cover.png or .jpg). Press Made on the slot.' },
    { title: '3. Make the kit', text: 'Kit generates the carousel (carousel-1.png to carousel-5.png, 1080×1350), carousel.pdf (the same five slides, for a LinkedIn document), square-1080.png, story-1080x1920.png (with a QR code to the tool), pin-1000x1500.png, wide-1200x630.png and kit.md (captions, venues and UTM links) in your kits folder.' },
    { title: '4. Draft the caption', text: 'Caption opens the Draft tab with the tool. Each channel card names the template to pick (Instagram caption, YouTube Short description, TikTok caption, LinkedIn post and so on). Lint must be clean before you copy; red text means the words must change.' },
    { title: '5. Post to each target, in its format', text: 'Open the channel card in this Guide and follow its checklist: the right file, the right size, the caption within the limit, the link where that channel lets it work. Post by hand in the app or on the site. One channel at a time.' },
    { title: '6. Record each post', text: 'Back on the slot, paste each post\'s own link into its target row and press Record. For a channel that gives a post no permanent link (WhatsApp Status) press Posted (tick) and add a note if you like. If you decided not to post somewhere, press Skip and give the reason. Recording a post on a channel with a venue also writes it to the posting log, so the cadence rules see it.' },
    { title: '7. Check coverage', text: 'The Coverage panel at the top of the Calendar tab (or node build/promo/desk.js coverage) lists, for past and today\'s slots, every target still missing, every link whose shape does not match its channel or format, and per channel how many went out, are due and were missed this week and in the last 30 days.' }
  ],
  fit: [
    { title: 'How it fits the Today routine', text: 'The calendar is the video side of the week; the Today tab is the daily routine (Monday answers, Tuesday owner channels, Wednesday communities, Thursday LinkedIn, Friday visual, Saturday broadcasts, Sunday off). Both write to the same posting log, so a calendar post uses up that channel\'s cadence and counts toward the day\'s linked-post cap.' },
    { title: 'Cadence rules', text: 'Each venue has a cadence and a weekly maximum in the venue register, and some templates add a stricter cap (LinkedIn twice a week, WhatsApp and Telegram broadcasts once a fortnight). Today\'s targets show "wait" with the reason when the log says a channel has had enough. Respect it: skip the target with the reason "cadence" rather than post anyway.' },
    { title: 'Linked posts and profile-link posts', text: 'Only a post that itself carries a clickable link counts toward the linked-post caps and the day\'s routine cap: LinkedIn, X, a Facebook link post, Threads, Bluesky, Mastodon, Telegram, the WhatsApp Channel and Status, a Pinterest pin with its destination link, an Instagram Story with a link sticker. An Instagram Reel or feed post, a TikTok, a YouTube Short and a native Facebook Reel carry no clickable link (the link lives in the profile), so the desk logs them as profile-link posts: they stay in the history but use no linked-post cap. For them the desk gives advice instead, never a block: at most 2 Reels (or Shorts, TikToks, feed posts) a day per account.' },
    { title: 'Facebook: native first', text: 'Meta has been testing a limit on link posts for Pages without a paid plan (reported as 2 a calendar month). The desk keeps a link budget, shown as "x of 2 used this month" (change it in config.json, facebook.linkPostsPerMonth). Post to Facebook natively by default: the Reel or the images with "search 1234Tools" or "link on our Page", no link. Spend the link posts on the tools that bring the most visits. A link in the first comment is a fallback only, and reports disagree on whether it counts. Stories with a link sticker and groups (by their own rules) are other routes. A paid Meta plan is an option, not the plan.' },
    { title: 'The 9:1 rule', text: 'Your own accounts (Instagram, YouTube, TikTok, LinkedIn, X and the rest) are not other people\'s spaces, so the 9:1 rule does not apply to calendar posts. It applies to Reddit, forums, Q&A sites and communities in the Today routine: nine link-free helpful contributions for every linked one.' },
    { title: 'Sunday', text: 'The routine keeps Sunday free of links. Use Sunday\'s slot to make the Reel and the kit, post it on Monday and record the links on Sunday\'s slot (recording later than the slot date is fine), or skip its targets with the reason "Sunday".' }
  ],
  cases: [
    { title: 'A day is missed', text: 'Post the missed slot on the next free day if the tool still suits, and record the links on the original slot: the desk only warns when a link is recorded before the slot\'s date, never after. Do not stack two slots on the same channel in one day; the cadence rules will say wait. If it is more than a few days late, skip its targets with the reason "missed" and move on. The Coverage panel shows what is still open.' },
    { title: 'A post is removed', text: 'Add a "removed by a moderator" entry in the Log tab (that venue then cools down for 90 days). On the calendar, Clear the target\'s link and Skip it with the reason "removed by the platform on <date>: <why>", so the record stays true. Read the platform\'s message, fix what it objected to, and do not repost the same thing elsewhere that day.' },
    { title: 'A channel is skipped', text: 'Skip with a reason: cadence, not right for this tool, the account is not set up yet, the format does not suit. A skip with a reason counts as done for the slot; a skip without one does not. Reasons are kept in calendar.json and in the CSV.' },
    { title: 'You posted somewhere the slot did not list', text: 'Use Add a channel on the slot, then record the link. It counts toward the slot and toward that channel\'s totals in Coverage.' }
  ]
};

const FAQ = [
  { q: 'Can the desk post for me?', a: 'No, by design. A human publishes every post: the desk never logs in, never submits a form, never calls a posting API and never schedules anything. Platforms treat automated posting as spam, and a person reading the post before it goes out is what keeps the claims honest. The desk prepares the files and the words, opens prefilled composers where a platform offers one, and records what you posted.' },
  { q: 'Why only one link per post?', a: 'It is one of the red lines. One problem, one tool, one link keeps the post honest and readable, and several links in one post read as spam to people and to platform filters. The Draft tab warns when a text carries more than one link. Channels where a caption link does not work (Instagram, TikTok, YouTube Shorts) get the link in your profile instead, and the video names the address in words.' },
  { q: 'What counts as "posted"?', a: 'A target counts as done when you recorded its post\'s link and the link passes the shape check (or you confirmed a flagged link with "It is right"), when you ticked a channel that has no permanent post link (WhatsApp Status), or when you skipped it with a reason. A slot shows "posted" only when every target is done; until then it shows "partly posted" with the count, for example "3 of 5 channels".' },
  { q: 'How is posting verified, and what can it not see?', a: 'Locally, from the link you paste: the desk checks that it is https, that it belongs to the right platform, that its path is the right format (an Instagram Reel is instagram.com/reel/<id>; instagram.com/p/<id> is a feed post), that the same link is not recorded on two targets, and it warns when a link is recorded before the slot\'s date. It never opens the link. So it cannot see whether the post exists, is public, was removed, how long the video is, what the caption says, whether a LinkedIn post really carries the PDF, whether a pin is a video or an image, or what a short link (pin.it, vm.tiktok.com, fb.watch, lnkd.in) points to.' },
  { q: 'What if I post to a channel the slot did not list?', a: 'Use "Add a channel" on the slot and record the link there. The added channel counts toward the slot\'s total and appears in Coverage. A channel you added and have not recorded yet can be removed again; a listed channel you do not want is skipped with a reason instead.' },
  { q: 'Does re-planning lose my records?', a: 'No. Re-planning keeps every slot that has a status other than planned or any target record (a link, a tick, a skip, an added channel), with its targets as they were, even when the slot falls outside the new 90 days. Only untouched planned slots are replaced.' },
  { q: 'Where is my data?', a: 'On this computer, in the desk\'s data folder (%USERPROFILE%\\.1234tools-promo, or PROMO_HOME): calendar.json holds the plan and every target record, log.json the posting log, kits\\ the kit files. Nothing of it is in the repository, and the desk does not upload it anywhere. Writes go to a temporary file first and are renamed into place, so a crash cannot leave half a file.' },
  { q: 'Do I need the same video everywhere?', a: 'One 1080×1920 MP4 from the Reel Maker suits Instagram Reels, YouTube Shorts, TikTok, Facebook Reels and a Pinterest video pin, as long as it is within each channel\'s length limit (see its card). The words should differ: each channel has its own caption template and limits, and the desk refuses identical text twice. The feed carousel, the LinkedIn document and the Pinterest image pin use the kit\'s images instead of the video.' },
  { q: 'Which channels need the AI-tool allowance wording?', a: 'All of them, whenever the tool is an AI for Business tool (/ai/, the "AI at work" slots). Wherever a caption says free it must also say free for 10 runs a month, and that text is sent to a model; it must never say on your device, offline, no account or no upload. That includes text burned into the video, the pin title and the first line people see before "more". The Draft tab\'s lint marks a missing allowance in red.' },
  { q: 'Why does a link say "wrong format"?', a: 'Because its shape belongs to another kind of post on the same platform: a feed post where the slot asked for a Reel, a watch?v= link where it asked for a Short, a profile instead of a post. Open the post itself, use its own Share or Copy link, and record that. If you are sure the link is right (platforms change their links), press "It is right" and it counts, marked as confirmed by you.' },
  { q: 'Does recording a link write to the posting log?', a: 'Yes, once per target: every channel now has a venue in the venue register (WhatsApp Status has its own, at most one a day). The entry carries the tool, the channel, the link and the slot, and whether the post itself carried a link, so the cadence rules and the Today routine see it. Clearing a target does not delete its log entry, and recording it again does not add a second one; the log is a history.' },
  { q: 'My calendar was made before targets existed. What happened to my links?', a: 'The old file loads as it is. A slot\'s single posted link is given to the target whose link rules it matches (an instagram.com/p/ link goes to the Instagram feed target, for example); a link that matches none is kept on the slot as an unassigned link and shown in Coverage. A copy of the old file is kept as calendar.v1.json beside the new one.' },
  { q: 'Why does a channel card say "not confirmed"?', a: 'Every number on a card comes from the platform\'s own help or business pages, with the page and the date it was read. Where no official page states a figure, or the page could not be read, the card says "not confirmed, check in the app" instead of guessing. The app\'s own upload screen is the final word.' },
  { q: 'What do I do when a platform changes its limits or links?', a: 'Trust what the app shows you, then update build/promo/channels.js: each spec has its value, its source page and the date it was checked, and the link rules for each channel sit beside them. The Guide, the CLI and the checks all read that one file, and node build/promo/test.js checks every rule against its sample links.' },
  { q: 'Which posts count toward the linked-post caps?', a: 'Posts that carry a clickable link in the post itself: LinkedIn, X, a Facebook link post, Threads, Bluesky, Mastodon, Telegram, the WhatsApp Channel and Status, a Pinterest pin with its destination link and an Instagram Story with a link sticker. Instagram Reels and feed posts, TikToks, YouTube Shorts (Shorts links are not clickable, YouTube\'s own help says) and native Facebook Reels are profile-link posts: logged with the tool and the channel, but they use no linked-post cap and not the day\'s routine cap. The desk advises at most 2 of each a day per account and shows it next to today\'s targets; it is advice, not a platform rule and not a block.' },
  { q: 'How does the Facebook link budget work?', a: 'Meta confirmed in December 2025 that it was running a limited test on link posts by Pages and professional-mode profiles; reports put the limit at 2 link posts a calendar month without a paid plan, and say that over it the link can show as plain text. Meta\'s own figures are not published, reports disagree on whether links in comments count, and it may not apply to every Page. The desk counts linked posts on your Page this month and shows "x of 2 used this month"; a third linked post waits until the 1st (override in Draft if you must). Record a native post with "no link" and it never touches the budget. Change the number in config.json in the site\'s data folder: {"facebook": {"linkPostsPerMonth": 2}}.' },
  { q: 'Should I pay for Meta One or Meta Verified to post more links?', a: 'Only if the numbers say so. Meta One (launched 15 September 2026) replaced Meta Verified for new subscribers; Meta lists the Advanced plan, from $49.99 a month, as the one with links in organic posts and Reels, and says plans and prices vary by region. UK prices were not published by Meta when this was checked; older reports put individual Meta Verified at £9.99 a month (reported). Native posts plus two well-chosen link posts a month come first.' },
  { q: 'Can I use the desk for my other sites?', a: 'Yes. The site picker in the header (or --site on any command) switches between 1234Tools, XLeShop, MVR IT Services, Attend Now and FixOurTime. Each site has its own profile in build/promo/sites/<id>.js (base address, brand words, audiences, the products, services or features it promotes with their stories, and its own claim rules), and its own calendar, log, drafts, opportunities, config and kits in the data folder under sites\\<id>. 1234Tools keeps its data where it always was. A shop is never called free unless the site says so, and the 1234Tools claims ("nothing you type is uploaded") are refused for the other sites.' },
  { q: 'What works for the other sites, and what is 1234Tools only?', a: 'Draft, Today, Opportunities, the calendar with its targets and coverage, the log and the cadence rules work for every site, from its profile. Kits work too: they use the item\'s story, the site\'s name, address and logo, and the palette nearest its brand colour, and draw a "how it works" schematic, because the live example capture drives 1234Tools pages only. The Reel Maker opens without a tool for other sites: paste the beats from the calendar slot. Communities (Reddit, forums, Q&A) are posted from your one personal account whichever site it is for, so their rules read every site\'s log.' },
  { q: 'How do I add a testimonial?', a: 'Open the Testimonials tab on the site the quote is for; each site keeps its own. First ask: write the request under Request email (or press Write request on a suggested first request), copy it and send it yourself by email or WhatsApp. It asks for one or two sentences in the client\'s own words, says exactly where they will appear and that their name and business are shown, offers nothing in return, and says they can say no or withdraw at any time by replying. Ask your clients generally, not only the happiest ones, and never suggest words. When they reply, record their name, role, business, contact details and their exact words, then the permission: yes, how it was given (email reply, signed form or message), the date, and where you keep their reply. The desk approves a quote only when all of that is there and nothing was offered for it, and approved words cannot be edited. Export gives an HTML snippet and a JSON list (name, role, business, quote, date) for the site, with stars only where the client gave a rating in writing. Put it on the site, then press Mark published with the page\'s address. If a client withdraws, press Withdraw: the quote leaves every export at once and the desk lists every page or post it is on, so you can take it down and tick each one. The same works on the command line: node build/promo/desk.js testimonials --site <id> with list, add, email, export or status.' },
  { q: 'How do the Today routine and the calendar share a day?', a: 'Both write to one posting log, so each knows what the other did. When the calendar\'s posts use up a channel\'s cadence or the day\'s linked-post cap, Today\'s tasks for that channel show "wait", and today\'s calendar targets show the same reasons. Do the calendar slot first on its own channels, then the routine\'s community work, which is mostly link-free.' }
];

/* ---------------------------------------------------------------- views */

function payload() {
  return { vision: VISION, process: PROCESS, faq: FAQ, redLines: RED_LINES, channels: CH.cards(), checked: CH.CHECKED, notConfirmed: CH.NC };
}

function wrap(s, ind) {
  const out = [];
  const rest = ' '.repeat(ind.length);
  let line = '';
  for (const w of String(s).split(/\s+/)) {
    if ((line + ' ' + w).trim().length > 96) { out.push((out.length ? rest : ind) + line.trim()); line = w; } else line += ' ' + w;
  }
  if (line.trim()) out.push((out.length ? rest : ind) + line.trim());
  return out.join('\n');
}

function cardText(c) {
  const out = [];
  out.push('== ' + c.name + ' (' + c.id + ')' + (c.venue ? '  venue ' + c.venue : '  no venue: recorded without a log entry'));
  if (c.cadence) out.push('   cadence: ' + c.cadence);
  for (const s of c.specs) out.push('   ' + (s.label + ':').padEnd(26) + (s.value || CH.NC) + (s.src ? '\n   ' + ' '.repeat(26) + (s.value ? 'source: ' : 'official page tried: ') + s.src + ' (checked ' + s.checked + ')' : ''));
  out.push('   Upload:');
  for (const f of c.upload) out.push(wrap(f, '     - '));
  out.push('   Draft with the template: ' + c.template);
  out.push('   A right link looks like: ' + (c.linkExample || 'no link: tick it as posted'));
  out.push('   Checklist:');
  c.steps.forEach((s, i) => out.push(wrap(s, '     ' + (i + 1) + '. ')));
  out.push('   Red lines here:');
  for (const r of c.redLines) out.push(wrap(r, '     - '));
  return out.join('\n');
}

function text(channel) {
  if (channel) { const c = CH.cards().find((x) => x.id === channel); return c ? cardText(c) : null; }
  const out = [];
  out.push('# ' + VISION.title);
  for (const p of VISION.points) out.push(wrap(p, '  '));
  out.push('\n# ' + PROCESS.title);
  for (const s of PROCESS.steps) out.push(s.title + '\n' + wrap(s.text, '   '));
  for (const s of PROCESS.fit.concat(PROCESS.cases)) out.push('\n' + s.title + '\n' + wrap(s.text, '   '));
  out.push('\n# Red lines');
  for (const r of RED_LINES) out.push(wrap(r, '  - '));
  out.push('\n# Channels (node build/promo/desk.js guide <id> for the full card; specs checked ' + CH.CHECKED + ')');
  for (const c of CH.cards()) out.push('  ' + c.id.padEnd(20) + c.name + ' · ' + c.summary);
  out.push('\n# FAQ');
  for (const f of FAQ) out.push('\nQ. ' + f.q + '\n' + wrap(f.a, '   '));
  return out.join('\n');
}

/** Every string the guide shows, for the lint test. */
function allText() {
  const out = [];
  VISION.points.forEach((t, i) => out.push({ where: 'vision ' + i, text: t }));
  PROCESS.steps.concat(PROCESS.fit, PROCESS.cases).forEach((s) => out.push({ where: 'process ' + s.title, text: s.title + '. ' + s.text }));
  RED_LINES.forEach((t, i) => out.push({ where: 'red line ' + i, text: t }));
  FAQ.forEach((f) => out.push({ where: 'faq ' + f.q, text: f.q + ' ' + f.a }));
  for (const c of CH.cards()) {
    out.push({ where: c.id + ' summary', text: c.summary });
    for (const s of c.specs) if (s.value) out.push({ where: c.id + ' ' + s.label, text: s.value });
    c.upload.forEach((t) => out.push({ where: c.id + ' upload', text: t }));
    c.steps.forEach((t) => out.push({ where: c.id + ' step', text: t }));
    c.redLines.forEach((t) => out.push({ where: c.id + ' red line', text: t }));
  }
  return out;
}

module.exports = { VISION, PROCESS, FAQ, RED_LINES, payload, text, allText };
