'use strict';
/**
 * Growth: what makes a post travel, written for the desk's own sites and kept
 * inside the red lines (a human posts, no bots, no fake numbers, no bought reach).
 *
 *   playbook()          the strategy cards in eight groups, each with the steps and the desk feature that helps
 *   today(now)          three moves for today (one card from three different groups, rotating by day), the
 *                       experiment of the week, and the next moments to prepare for
 *   moments({ days })   dated hooks for the current site's regions: tax deadlines, festivals, shopping days,
 *                       exam season, monthly filing days; lunar dates carry check: true
 *   angles(itemPath)    one item's viral angles: hooks in ten formats, series ideas, a challenge, a collab,
 *                       a reply-video prompt, the moment it fits and the Reel Maker styles to make it in
 *   STYLES              the Reel Maker's story styles (engine/aivid-reel-maker.js PROMO_STYLES, same ids)
 *
 * Nothing here is a platform rule unless it says so; claims about features
 * (trial reels, collab posts, video replies) name the platform and are things
 * the platforms themselves describe. The desk never posts.
 */
const T = require('./tools');
const SITE = require('./site');

const REEL_MAKER = 'https://www.1234tools.com/ai-video/reel-maker/';

/* The Reel Maker's story styles for a tool (?tool=…&style=…). Same ids and order as PROMO_STYLES in the engine. */
const STYLES = [
  { id: 'story', label: 'Full story', about: 'Hook, the pain, the usual way, the fix, the real example, three steps, the end card.' },
  { id: 'speedrun', label: 'Speed run', about: 'Result first, three fast steps with whip pans: a 15-second reel.' },
  { id: 'beforeafter', label: 'Before / after', about: 'The usual way next to the fix, then the real example.' },
  { id: 'myth', label: 'Myth vs fact', about: 'The belief people hold, crossed out, and what is true.' },
  { id: 'mistakes', label: '3 mistakes', about: 'The usual ways as mistakes, crossed out one by one, then the fix.' },
  { id: 'pov', label: 'POV', about: 'A first-person moment: the problem, the turn, the result.' },
  { id: 'stop', label: 'Stop doing this', about: 'A pattern interrupt: stop the usual way, do this instead.' },
  { id: 'quiz', label: 'Guess first', about: 'A question the viewer answers in their head, then the reveal.' },
  { id: 'countdown', label: '3 reasons', about: 'Three reasons counted down, the best last.' },
  { id: 'hottake', label: 'Hot take', about: 'An opinion with two reasons: it invites replies.' },
  { id: 'thisorthat', label: 'This or that', about: 'The usual way against the tool, side by side.' },
  { id: 'tutorial', label: 'Step by step', about: 'One step per scene, then the result: the save-it-for-later reel.' }
];
const styleUrl = (path, style) => REEL_MAKER + '?tool=' + encodeURIComponent(path) + (style && style !== 'story' ? '&style=' + style : '');

/* ------------------------------------------------------------ playbook */

const GROUPS = [
  ['hooks', 'Hooks: the first second'],
  ['formats', 'Formats that travel'],
  ['engage', 'Engagement'],
  ['distribute', 'Distribution'],
  ['collab', 'Collaboration'],
  ['search', 'Search'],
  ['proof', 'Proof and trust'],
  ['moments', 'Moments and launches']
];

/* fits: which kinds of site a card suits ('tools' is 1234Tools; 'app', 'shop', 'services' are the profiles' kinds; '*' all). */
const CARDS = [
  { id: 'result-first', group: 'hooks', fits: '*', title: 'Show the result in the first second',
    why: 'People decide in about a second whether to keep watching. The finished result answers "is this for me?" before they can scroll.',
    how: ['Open on the output (the merged PDF, the take-home figure, the cut-out photo), then rewind to how.', 'Put the hook as text on screen: most people watch with the sound off.', 'Reel Maker: the Speed run and Before / after styles start on the result.'], desk: 'reels' },
  { id: 'pattern-interrupt', group: 'hooks', fits: '*', title: 'Break the pattern',
    why: 'A feed is a rhythm; a hard cut, a "Stop" or a surprising first frame breaks it.',
    how: ['Start mid-action, or with "Stop doing this" over the usual way.', 'Change something every 1–2 seconds in the first five: a cut, a zoom, a word.', 'Reel Maker: the Stop doing this style uses a glitch open and quick cuts.'], desk: 'reels' },
  { id: 'call-out', group: 'hooks', fits: '*', title: 'Name the viewer',
    why: 'A post for everyone is for no one. "Teachers:" or "If you run a shop…" stops the right people.',
    how: ['Lead with the audience in three words: "Payroll people:", "Shop owners in Kent:".', 'Make one cut of the same reel per audience: same video, a different first line.', 'The Opportunities tab shows where each audience asks questions.'], desk: 'opps' },
  { id: 'curiosity', group: 'hooks', fits: '*', title: 'Open a loop, close it honestly',
    why: 'A question the viewer wants answered keeps them to the end, as long as the answer is real.',
    how: ['Ask the question the video answers: "Guess how many steps this takes."', 'Answer it before the end card, never in the comments only.', 'Reel Maker: the Guess first style is built for this.'], desk: 'reels' },

  { id: 'series', group: 'formats', fits: '*', title: 'Make it a series',
    why: 'A numbered series gives people a reason to follow: they want episode 12.',
    how: ['Pick one fixed opening ("10-second tricks, number 7") and one fixed slot in the week.', 'Group them in a YouTube playlist and an Instagram series or highlight.', 'The Calendar tab already plans one problem, one tool, one result about nine times a week.'], desk: 'calendar' },
  { id: 'rotate-styles', group: 'formats', fits: '*', title: 'Never the same shape twice in a row',
    why: 'Followers see the pattern before the content. Rotating the shape keeps the same message fresh.',
    how: ['Rotate the twelve Reel Maker styles: full story, speed run, before / after, myth vs fact, POV, 3 reasons …', 'Each calendar slot opens the Reel Maker in a different style; Shuffle picks another.', 'Re-make your best performer in three new styles before making a new tool.'], desk: 'reels' },
  { id: 'reply-videos', group: 'formats', fits: '*', title: 'Answer comments with videos',
    why: 'A video reply to a real comment is a new post with a built-in hook: someone asked.',
    how: ['TikTok and Instagram let you reply to a comment with a reel; YouTube lets you make a Short from a comment.', 'Pick questions that start "how do I…" and answer in under 20 seconds.', 'Pin the original question so the next viewer sees it.'], desk: 'pack' },
  { id: 'duet-stitch', group: 'formats', fits: '*', title: 'Invite remixes',
    why: 'A stitch or remix puts your video in front of the other creator\'s followers.',
    how: ['End with an open invitation: "Stitch this with your fastest way to do it."', 'Leave remixing on (TikTok Duet and Stitch, Instagram Remix).', 'Remix others only when you add something real; never a link drop.'], desk: '' },
  { id: 'trend-audio', group: 'formats', fits: '*', title: 'Ride a sound, not a hashtag',
    why: 'A rising sound brings its own audience; riding a trending tag your post has nothing to do with is a red line.',
    how: ['Pick sounds from the platform\'s own library inside the app (a business account gets its commercial-use library).', 'Keep the sound low under your voice-over; captions carry the message.', 'Never use a sound the platform does not offer you.'], desk: '' },

  { id: 'first-hour', group: 'engage', fits: '*', title: 'Own the first hour',
    why: 'Early replies tell the platform the post is worth showing to more people.',
    how: ['Post when you can stay for an hour, and answer every comment in that hour.', 'Pin the best question (each pack has one ready).', 'Never ask friends or groups to like on cue: engagement pods are a red line.'], desk: 'pack' },
  { id: 'easy-question', group: 'engage', fits: '*', title: 'End with a question anyone can answer',
    why: 'One-word answers are the easiest comments to leave.',
    how: ['"Work or home?" beats "What do you think?"', 'Put the question on the end card and in the caption.', 'Reply to every answer with something specific.'], desk: 'pack' },
  { id: 'save-share', group: 'engage', fits: '*', title: 'Ask for the save',
    why: 'Useful posts get saved and sent. A "save this for later" earns both.',
    how: ['Steps, checklists and how-tos: end with "Save this for your next …".', 'The Step by step and 3 reasons styles are made to be saved.', 'Carousels: the last slide asks for the save.'], desk: 'kits' },
  { id: 'keyword-reply', group: 'engage', fits: '*', title: 'Comment a word, get the link, from you',
    why: 'People who ask for the link chose to hear from you; answering them yourself is not spam.',
    how: ['"Comment PDF and I\'ll reply with the link." Reply by hand to each one who asked.', 'No auto-DM tools: a human sends every reply (red line).', 'Reply in the comments where links are allowed; on YouTube, name the site in words.'], desk: '' },

  { id: 'one-to-eight', group: 'distribute', fits: '*', title: 'One reel, eight places',
    why: 'The same video meets different people on each platform; a fresh caption each time keeps it native.',
    how: ['Order: TikTok → Instagram Reels → YouTube Shorts → Facebook Reels → Pinterest → LinkedIn → X → Threads.', 'Use the clean export (no other app\'s watermark) and each platform\'s pack: title, tags, hashtags and caption differ.', 'Record each link in the calendar slot; the coverage view shows what is missing.'], desk: 'pack' },
  { id: 'answer-where-asked', group: 'distribute', fits: '*', title: 'Answer where people ask',
    why: 'A good answer on a question thread keeps bringing visitors for months.',
    how: ['Opportunities finds open questions on Reddit, Hacker News and Stack Exchange.', 'Help first: nine helpful replies for each one that links (the 9:1 rule).', 'Disclose that you built it, every time.'], desk: 'opps' },
  { id: 'evergreen-pins', group: 'distribute', fits: '*', title: 'Pin for the long tail',
    why: 'Pins are found through search for months, long after a reel has had its week.',
    how: ['Every kit has a 1000×1500 pin; use the Pinterest pack for title, description, alt text and board.', 'One board per section or product group, named in plain search words.', 'Re-pin the best ones to a second board a month later.'], desk: 'kits' },
  { id: 'chat-channels', group: 'distribute', fits: '*', title: 'Use the chat apps people already open',
    why: 'In India especially, WhatsApp and Telegram channels are where updates are read.',
    how: ['A WhatsApp Channel post plus a poll; a Status with the video, then the link.', 'Only people who chose to follow: no unsolicited messages (red line).', 'Shops: put the channel link on the receipt, the bag and the shop counter.'], desk: 'pack' },

  { id: 'micro-creators', group: 'collab', fits: '*', title: 'Work with small creators in the niche',
    why: 'A teacher with 5,000 teacher followers beats a celebrity: their audience trusts them on this.',
    how: ['Find creators who already post about the job (teachers, payroll, small shops, students).', 'Send them the kit and the reel to use as they like, no script; ask them to disclose any partnership.', 'Instagram Collab posts show on both profiles and share the likes and comments.'], desk: 'kits' },
  { id: 'spotlight', group: 'collab', fits: ['app', 'shop', 'services'], title: 'Spotlight a real customer',
    why: 'A customer\'s own words do what no ad can, with their written permission.',
    how: ['The Testimonials tab sends the permission request and keeps the evidence.', 'Film the customer\'s own result; never invent a quote or a number.', 'Tag them, so their followers see it too.'], desk: 'testimonials' },
  { id: 'neighbour-shops', group: 'collab', fits: ['shop'], title: 'Cross-promote with neighbour shops',
    why: 'A dairy and a bakery share customers but not products.',
    how: ['Swap a story mention or a counter flyer with a shop that sells something you do not.', 'Each shop says only what the other actually offers.', 'Run it around a moment (Diwali, Christmas) when people buy from both.'], desk: '' },

  { id: 'say-show-caption', group: 'search', fits: '*', title: 'Say it, show it, caption it',
    why: 'TikTok, Instagram and YouTube are search engines now: people type "how to merge pdf".',
    how: ['Say the search phrase in the first sentence, show it on screen, put it in the caption.', 'Each pack has the phrase ready (TikTok: Search phrase; YouTube: Title and Tags).', 'One phrase per video: the one people actually type.'], desk: 'pack' },
  { id: 'how-to-titles', group: 'search', fits: '*', title: 'Title for the search box',
    why: 'Titles that match what people type get found for years.',
    how: ['"How to … without …" beats a clever pun.', 'Add the free tag only where it is true (AI tools: 10 free runs a month).', 'Playlists named by job: "PDF in 10 seconds".'], desk: 'pack' },

  { id: 'real-numbers', group: 'proof', fits: '*', title: 'Show real numbers, never invented ones',
    why: 'A real figure ("£3,160 a month on £48,000") is shareable; an invented one is a lie that gets found.',
    how: ['Kits use examples captured from the live tool.', 'For a shop: a real price, a real delivery time, from the shop\'s own pages.', 'The linter blocks numbers the site does not state.'], desk: 'kits' },
  { id: 'airplane-test', group: 'proof', fits: ['tools'], title: 'The airplane-mode test',
    why: '"Nothing is uploaded" is a claim; switching the Wi-Fi off on camera is proof.',
    how: ['Load a browser tool, turn on airplane mode on camera, run it, show the result.', 'Works for tools that run in the browser; never for the AI for Business tools.', 'Caption: "Works with the internet off. Try it."'], desk: 'reels' },
  { id: 'build-in-public', group: 'proof', fits: '*', title: 'Build in public',
    why: 'People root for something they watched being made.',
    how: ['A weekly "what we shipped" post: one screen, one sentence.', 'Show the messy middle, not just launches.', 'For a product in pilot (XLePOS): show the work, never a launch date or a price you have not set.'], desk: '' },

  { id: 'moment-marketing', group: 'moments', fits: '*', title: 'Be early for the moment',
    why: 'A post about the tax deadline or Diwali orders a week before is useful; on the day it is late.',
    how: ['The moments list below says when to start for each date.', 'Make the reel and kit a week ahead; post three to five days before.', 'Only moments the item genuinely helps with.'], desk: 'grow' },
  { id: 'launch-week', group: 'moments', fits: '*', title: 'Launch new things loudly, once',
    why: 'A new tool or feature is news once: use every channel that week.',
    how: ['New-thing Tuesday: the reel, the kit, a "Show HN" or Product Hunt post where it fits.', 'Tell the people who asked for it first (the Opportunities you answered).', 'After a week it becomes a normal calendar slot.'], desk: 'calendar' },
  { id: 'challenge', group: 'moments', fits: '*', title: 'Start a small challenge',
    why: 'A challenge turns viewers into makers, and every entry is a post you did not have to make.',
    how: ['"Can you do it in under 10 seconds?" with one hashtag of your own.', 'Feature the best entries (with permission) in a weekly round-up.', 'Never offer money or prizes for engagement; that buys fake reach.'], desk: '' },
  { id: 'test-one-thing', group: 'moments', fits: '*', title: 'Test one thing at a time',
    why: 'Doubling down on what works beats posting more of what does not.',
    how: ['Same reel, two hooks: post one as an Instagram trial reel (shown to non-followers first).', 'Change one thing per test: the hook, the cover or the style.', 'Note the winner in the calendar slot; make the next three in its style.'], desk: 'calendar' }
];

function siteKind() { return SITE.isDefault() ? 'tools' : (SITE.current().kind || 'services'); }
function fitsHere(c) { return c.fits === '*' || (Array.isArray(c.fits) && c.fits.includes(siteKind())); }

function playbook() {
  const cards = CARDS.filter(fitsHere);
  return GROUPS.map(([id, label]) => ({ id, label, cards: cards.filter((c) => c.group === id) })).filter((g) => g.cards.length);
}

/* ------------------------------------------------------------- moments */

/* region: 'uk', 'india' or 'global'. sections: the 1234Tools sections the moment suits (empty = any).
   lead: how many days before to start posting. check: a lunar or announced date that moves; check it. */
const FIXED = [
  { date: '2026-10-31', name: 'Halloween', region: 'global', kind: 'festival', sections: ['design', 'image', 'ai-image', 'games', 'live'], lead: 5 },
  { date: '2026-11-05', name: 'Bonfire Night (UK): a family evening in', region: 'uk', kind: 'festival', sections: ['games'], lead: 5 },
  { date: '2026-11-08', name: 'Diwali', region: 'india', kind: 'festival', sections: ['qr', 'design', 'image', 'business', 'india', 'games', 'live'], lead: 10, check: true, shop: true },
  { date: '2026-11-20', name: 'Wedding season opens (India), after Dev Uthani Ekadashi', region: 'india', kind: 'festival', sections: ['live'], lead: 10, check: true },
  { date: '2026-11-14', name: 'Children\'s Day (India)', region: 'india', kind: 'education', sections: ['education', 'mathematics', 'games', 'live'], lead: 4 },
  { date: '2026-11-27', name: 'Black Friday', region: 'global', kind: 'shopping', sections: ['qr', 'image', 'business', 'design'], lead: 10, shop: true },
  { date: '2026-11-30', name: 'Cyber Monday', region: 'global', kind: 'shopping', sections: ['qr', 'image', 'business'], lead: 5, shop: true },
  { date: '2026-12-15', name: 'Advance tax, third instalment (India)', region: 'india', kind: 'tax', sections: ['india', 'finance'], lead: 7 },
  { date: '2026-12-10', name: 'Year-end team meetings and all-hands', region: 'global', kind: 'season', sections: ['live'], lead: 7, check: true },
  { date: '2026-12-25', name: 'Christmas', region: 'global', kind: 'festival', sections: ['design', 'image', 'qr', 'time', 'games', 'live'], lead: 14, shop: true },
  { date: '2026-12-31', name: "New Year's Eve: a night in with the family", region: 'global', kind: 'festival', sections: ['games', 'live'], lead: 10 },
  { date: '2026-12-31', name: 'Belated and revised ITR deadline (AY 2026-27)', region: 'india', kind: 'tax', sections: ['india', 'finance'], lead: 10 },
  { date: '2027-01-01', name: 'New Year: new-system resolutions', region: 'global', kind: 'season', sections: ['business', 'utilities', 'time', 'finance'], lead: 5 },
  { date: '2027-01-05', name: 'Spring term starts (UK): first week back', region: 'uk', kind: 'education', sections: ['education', 'games', 'live'], lead: 7, check: true },
  { date: '2027-01-14', name: 'Makar Sankranti and Pongal', region: 'india', kind: 'festival', sections: ['design', 'image'], lead: 7, check: true, shop: true },
  { date: '2027-01-26', name: 'Republic Day (India)', region: 'india', kind: 'festival', sections: ['design', 'india', 'live'], lead: 5 },
  { date: '2027-01-31', name: 'Self Assessment deadline (UK, 2025-26 returns)', region: 'uk', kind: 'tax', sections: ['business', 'finance'], lead: 21 },
  { date: '2027-02-01', name: 'Union Budget (India)', region: 'india', kind: 'tax', sections: ['india', 'finance'], lead: 3, check: true },
  { date: '2027-02-14', name: 'Valentine\'s Day', region: 'global', kind: 'shopping', sections: ['design', 'image', 'ai-image'], lead: 10, shop: true },
  { date: '2027-02-15', name: 'Board exams begin (India)', region: 'india', kind: 'education', sections: ['education', 'mathematics', 'time', 'live'], lead: 14, check: true },
  { date: '2027-03-07', name: 'Mothering Sunday (UK)', region: 'uk', kind: 'shopping', sections: ['design', 'image'], lead: 10, shop: true },
  { date: '2027-03-10', name: 'Eid al-Fitr', region: 'global', kind: 'festival', sections: ['design', 'image', 'games'], lead: 10, check: true, shop: true },
  { date: '2027-03-15', name: 'Advance tax, last instalment (India)', region: 'india', kind: 'tax', sections: ['india', 'finance'], lead: 7 },
  { date: '2027-03-22', name: 'Holi', region: 'india', kind: 'festival', sections: ['design', 'image', 'games'], lead: 7, shop: true },
  { date: '2027-03-28', name: 'Easter Sunday', region: 'global', kind: 'festival', sections: ['games'], lead: 10 },
  { date: '2027-03-31', name: 'Financial year end (India): tax-saving deadline', region: 'india', kind: 'tax', sections: ['india', 'finance', 'business'], lead: 14 },
  { date: '2027-04-01', name: 'New financial year (India)', region: 'india', kind: 'tax', sections: ['india', 'finance', 'business'], lead: 3 },
  { date: '2027-04-01', name: 'New school year starts (India): first weeks of term', region: 'india', kind: 'education', sections: ['education', 'live'], lead: 7, check: true },
  { date: '2027-04-05', name: 'UK tax year ends', region: 'uk', kind: 'tax', sections: ['business', 'finance'], lead: 14 },
  { date: '2027-04-06', name: 'New UK tax year: new payslips and thresholds', region: 'uk', kind: 'tax', sections: ['business', 'finance'], lead: 3 },
  { date: '2027-05-10', name: 'Exam season (UK GCSEs and A levels)', region: 'uk', kind: 'education', sections: ['education', 'mathematics', 'time', 'live'], lead: 14, check: true },
  { date: '2027-05-17', name: 'Eid al-Adha (about 16 to 17 May)', region: 'global', kind: 'festival', sections: ['games'], lead: 10, check: true },
  { date: '2027-07-31', name: 'ITR due date for most individuals (India)', region: 'india', kind: 'tax', sections: ['india', 'finance'], lead: 21, check: true },
  { date: '2027-08-15', name: 'Independence Day (India)', region: 'india', kind: 'festival', sections: ['design', 'india', 'live'], lead: 5, shop: true },
  { date: '2027-08-17', name: 'Raksha Bandhan', region: 'india', kind: 'festival', sections: ['design', 'games'], lead: 7, check: true, shop: true },
  { date: '2027-09-01', name: 'Back to school (UK)', region: 'uk', kind: 'education', sections: ['education', 'mathematics', 'time', 'pdf', 'games', 'live'], lead: 14 },
  { date: '2027-09-05', name: "Teachers' Day (India)", region: 'india', kind: 'education', sections: ['education', 'live'], lead: 7 }
];
/* Monthly filing days: GSTR-1 (11th) and GSTR-3B (20th) for monthly GST filers; PAYE paid electronically by the 22nd (UK). */
const MONTHLY = [
  { day: 11, name: 'GSTR-1 due (monthly GST filers)', region: 'india', kind: 'tax', sections: ['india', 'business'], lead: 3 },
  { day: 20, name: 'GSTR-3B due (monthly GST filers)', region: 'india', kind: 'tax', sections: ['india', 'business'], lead: 3 },
  { day: 22, name: 'PAYE and NIC payment due (UK, paid electronically)', region: 'uk', kind: 'tax', sections: ['business'], lead: 3 }
];

const iso = (d) => d.toISOString().slice(0, 10);
const dayMs = 86400000;
function nowDate(now) {
  if (now) return new Date(now);
  if (process.env.PROMO_NOW) return new Date(process.env.PROMO_NOW);
  return new Date();
}

function regionsHere() {
  if (SITE.isDefault()) return ['uk', 'india', 'global'];
  const r = SITE.current().regions || [];
  return (r.length ? r : ['uk', 'india']).concat(['global']);
}

function moments(o) {
  o = o || {};
  const now = nowDate(o.now);
  const today = new Date(iso(now) + 'T00:00:00Z');
  const end = new Date(today.getTime() + (o.days || 120) * dayMs);
  const regions = regionsHere();
  const shopish = !SITE.isDefault() && ['shop', 'app'].includes(SITE.current().kind);
  const list = FIXED.slice();
  for (let m = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)); m <= end; m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
    for (const r of MONTHLY) list.push(Object.assign({}, r, { date: iso(new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), r.day))), monthly: true }));
  }
  return list
    .filter((x) => regions.includes(x.region))
    .filter((x) => SITE.isDefault() || x.shop || !shopish || x.kind === 'tax')
    .map((x) => {
      const d = new Date(x.date + 'T00:00:00Z');
      const start = new Date(d.getTime() - (x.lead || 7) * dayMs);
      return Object.assign({}, x, { inDays: Math.round((d - today) / dayMs), startBy: iso(start), startIn: Math.round((start - today) / dayMs) });
    })
    .filter((x) => x.inDays >= 0 && new Date(x.date) <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/* --------------------------------------------------------------- today */

function dayIndex(now) { return Math.floor(nowDate(now).getTime() / dayMs); }

function today(o) {
  o = o || {};
  const n = dayIndex(o.now);
  const groups = playbook();
  /* three cards from three different groups, rotating with the day */
  const moves = [];
  for (let i = 0; i < Math.min(3, groups.length); i++) {
    const g = groups[(n + i * 3) % groups.length];
    const c = g.cards[Math.floor(n / groups.length) % g.cards.length];
    if (!moves.includes(c)) moves.push(c);
  }
  const tests = CARDS.filter((c) => fitsHere(c) && ['rotate-styles', 'test-one-thing', 'result-first', 'call-out', 'curiosity', 'series'].includes(c.id));
  const week = Math.floor(n / 7);
  const ms = moments({ now: o.now, days: 45 });
  const labelled = (c) => Object.assign({ groupLabel: (GROUPS.find((x) => x[0] === c.group) || [])[1] }, c);
  return {
    date: iso(nowDate(o.now)),
    site: SITE.currentId(),
    moves: moves.map(labelled),
    experiment: tests.length ? labelled(tests[week % tests.length]) : null,
    style: STYLES[n % STYLES.length],
    prepare: ms.filter((m) => m.startIn <= 0 && !m.monthly).slice(0, 3),
    next: ms.slice(0, 6)
  };
}

/* -------------------------------------------------------------- angles */

const lc = (s) => String(s || '').replace(/\b([A-Z])([a-z])/g, (m, a, b) => a.toLowerCase() + b);
const lcFirst = (s) => String(s || '').replace(/^([A-Z])([a-z])/, (m, a, b) => a.toLowerCase() + b);
const firstSentence = (s) => (String(s || '').match(/^.*?[.!?](?=\s|$)/) || [String(s || '')])[0];
const strip = (s) => String(s || '').replace(/[.!?…]+$/, '').trim();
const camel = (s) => '#' + String(s).replace(/[^A-Za-z0-9]+(.)?/g, (m, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase());

/* Angles that suit the games (/games/): a game is a night out, so the hooks are about the night, not the chore.
   Same ten styles; a hook here replaces the generic one of its style. The wording makes no promise the
   game does not keep (the wheel's draw is fair; the Tambola caller checks a claim from the ticket number). */
const GAME_ANGLES = [
  { re: /tambola|housie|90-ball|bingo-caller/, hooks: {
    pov: 'POV: it is Diwali night, the whole family is round the TV, and the numbers call themselves.',
    speedrun: 'A live Tambola reel: call the numbers, and check a Full House from the ticket number.',
    quiz: 'Guess which Tambola number comes next. Nobody can: every call is a fair draw.',
    hottake: 'Hot take: the host of a Tambola night should get to play too.' },
    series: ['"Tambola night, number by number": a live reel of the board filling up.', '"Early Five to Full House": one prize explained a week.'],
    moment: /Diwali/,
    challenge: 'TambolaNight: film the moment your family shouts Full House, and tag it.' },
  { re: /wheel|picker/, hooks: {
    pov: 'POV: three of you want the front seat, so we let a wheel decide.',
    speedrun: 'We let a wheel decide: who goes first, who washes up, who picks the film.',
    stop: 'Stop arguing about whose turn it is. Spin the wheel.',
    thisorthat: 'Rock paper scissors, or let a wheel decide?' },
    series: ['"We let a wheel decide": one family choice a week, spun on camera.', '"Prize wheel": the party prizes, rare and common.'],
    challenge: 'WheelDecides: let a wheel make one small choice today, and show the spin.' },
  { re: /team|group/, hooks: {
    pov: 'POV: you hold up the class list and the groups appear on the board.',
    speedrun: 'Classroom team reveal: fifteen names, four fair teams, one press.',
    stop: 'Stop picking teams by hand. Let the groups appear on the board.',
    thisorthat: 'Captains picking teams, or a fair shuffle?' },
    series: ['"The team reveal": a new class or family split into teams each episode.', '"Cousins, split up": quiz-night teams, mixed.'],
    moment: /Back to school|Children/,
    challenge: 'TeamReveal: film your teams appearing on the TV, one at a time.' },
  { re: /quiz|buzzer|scoreboard|board|survey|top-answers|picture|points/, hooks: {
    pov: 'POV: your quiz night has a buzzer, a leaderboard and the answers on your phone.',
    speedrun: 'Quiz night set-up in a few presses: teams, buzzer, scores on the TV.',
    stop: 'Stop adding up the quiz scores on a napkin.',
    thisorthat: 'Scores on scrap paper, or a leaderboard on the TV?' },
    series: ['"Quiz night, behind the scenes": one round built on screen each week.', '"The fastest finger": a buzzer round with a family.'],
    moment: /Christmas|Diwali/,
    challenge: 'QuizNightChallenge: host a ten-question round for your family and show the leaderboard.' },
  { re: /charades|antakshari|icebreaker|would-you-rather|bingo/, hooks: {
    pov: 'POV: the family game night where the host finally gets to play.',
    speedrun: 'Game night in three presses: pick, start, play.',
    stop: 'Stop saying "what shall we play?" Open a game.',
    thisorthat: 'Another evening of phones, or one good game on the TV?' },
    series: ['"Game night in a minute": one family game set up per episode.', '"Pass the phone": the charades turn, filmed from the actor side.'],
    moment: /Diwali|Christmas/,
    challenge: 'GameNightChallenge: play one game with the family with phones in a basket.' }
];
function gameAngles(rec) {
  if (rec.section !== 'games') return null;
  return GAME_ANGLES.find((g) => g.re.test(rec.path)) || null;
}

/* Angles that suit the live tools (/live/): a live tool is a moment in a room (a lesson, a meeting, a quiz night), so
   the hooks are about the room. Same ten styles; a hook here replaces the generic one of its style. Nothing here says
   the answers stay on a device: they pass through our server to the presenter's screen (build/tests/claims/live.js). */
const LIVE_ANGLES = [
  { re: /quiz-night/, hooks: {
    pov: 'POV: it is quiz night, the TV shows the question, and every phone in the room is answering.',
    speedrun: 'Quiz night in three steps: edit the deck, show the code, present.',
    quiz: 'Guess who wins quiz night when faster right answers score more.',
    stop: 'Stop marking quiz answer sheets by hand. Put the leaderboard on the TV.' },
    series: ['"Quiz night, round by round": one deck built and played each week.', '"The podium": the last question and the confetti, filmed from the sofa.'],
    moment: /Diwali|Christmas|New Year/,
    challenge: 'QuizNightLive: host a ten-question quiz for your family on the TV and show the podium.' },
  { re: /live-quiz-for-classroom|classroom-understanding|live-poll-for-classroom|word-cloud-for-classroom/, hooks: {
    pov: 'POV: you ask the class a question and every pupil answers, not just the front row.',
    speedrun: 'A class check in three steps: pick the question, share the code, ask.',
    stop: 'Stop asking “does everyone understand?” and hearing nothing back.',
    thisorthat: 'Hands up for the bold few, or every pupil on a phone?' },
    series: ['"Exit ticket Friday": one class question a week, answered on phones.', '"Quiz Friday": a timed class quiz, filmed from the back of the room.'],
    moment: /Teachers|Exam|Back to school|Children|term/i,
    challenge: 'ClassCheck: ask your class one question on phones this week and show the reveal.' },
  { re: /wedding/, hooks: {
    pov: 'POV: the wedding guests are asking the couple questions from their phones.',
    speedrun: 'Guest questions for the couple: open, share the code, approve the best.',
    stop: 'Stop passing a microphone round the reception. Let guests ask from their seats.',
    thisorthat: 'Questions on table cards, or from every guest’s phone?' },
    series: ['"Ask the couple": the funniest guest questions of the week.', '"The reception, live": a Q&A board on the big screen.'],
    moment: /Wedding/,
    challenge: 'AskTheCouple: let your guests send the questions, and film the board filling up.' },
  { re: /live-presentation/, hooks: {
    pov: 'POV: your slides ask the room a question, and every phone answers.',
    speedrun: 'A deck the room answers in three steps: prepare, share the code, present.',
    stop: 'Stop switching between your slides and a separate quiz tool.',
    thisorthat: 'Slides in one tool and a quiz in another, or one code for both?' },
    series: ['"Slides that answer back": one deck with six kinds of question.', '"The podium": the last quiz question and the winner finale.'],
    moment: /Teachers|Exam|Year-end/i,
    challenge: 'SlidesThatAnswer: present one deck to phones and show the winner finale.' },
  { re: /meeting|town-hall|team/, hooks: {
    pov: 'POV: the team meeting where everyone answers, not just the loud few.',
    speedrun: 'A team check-in in three steps: pick the question, share the code, ask.',
    stop: 'Stop running meetings where only the loud few speak.',
    thisorthat: 'Going round the room, or one question on every phone?' },
    series: ['"The five-minute check-in": a word cloud to open every meeting.', '"All-hands, answered": a town-hall Q&A on the big screen.'],
    moment: /Year-end|New Year|term/i,
    challenge: 'MeetingPulse: open your next meeting with one question on phones and show the cloud.' },
  { re: /live-poll|word-cloud|audience-qa|rating-scale|rate-a-session/, hooks: {
    pov: 'POV: you ask the room a question and the answers arrive on the screen.',
    speedrun: 'A live poll in three steps: type it, share the code, ask.',
    stop: 'Stop counting hands. Let the room answer on their phones.',
    thisorthat: 'A show of hands, or every phone in the room?' },
    series: ['"Ask the room": one live question a week, answered on phones.', '"Before and after the reveal": what the room said, and what you guessed.'],
    moment: /Teachers|Year-end|Exam/i,
    challenge: 'AskTheRoom: run one live question in your next session and show the result.' }
];
function liveAngles(rec) {
  if (rec.section !== 'live') return null;
  return LIVE_ANGLES.find((g) => g.re.test(rec.path)) || null;
}

function angles(itemPath) {
  const rec = T.record(itemPath);
  let story = rec.story;
  if (!story) { try { story = require('./stories').storyFor(rec.path) || {}; } catch (e) { story = {}; } }
  const usual = (story.usual || []).filter(Boolean);
  const steps = (story.steps || []).filter(Boolean);
  const proof = (story.proof || []).filter(Boolean);
  const own = SITE.isDefault();
  const task = own ? require('./templates').taskPhrase(rec) : lc(rec.title);
  const persona = story.persona || (own ? '' : 'shop owners');
  const name = rec.title;
  const u0 = lc(strip(usual[0] || 'doing it the long way')).replace(/^(A|An|The) (?=[a-z])/, (m) => m.toLowerCase());
  const hooks = [
    { style: 'speedrun', text: own ? 'Watch me ' + task + ' in three steps.' : name + ', in three steps.' },
    { style: 'beforeafter', text: 'Before: ' + u0 + '. After: ' + lcFirst(strip(story.promise || name)) + '.' },
    { style: 'myth', text: 'Myth: you\'re stuck with ' + u0 + '. Fact: you\'re not.' },
    { style: 'pov', text: 'POV: ' + lcFirst(strip(firstSentence(story.pain || story.hook || name))) + '.' },
    { style: 'stop', text: 'Stop scrolling if you still put up with ' + u0 + '.' },
    { style: 'quiz', text: 'Guess how many steps it takes to ' + (own ? task : 'use ' + lc(name)) + '.' },
    { style: 'countdown', text: '3 reasons to try ' + name + (persona ? ', for ' + lc(persona) : '') + '.' },
    { style: 'hottake', text: 'Hot take: nobody should need ' + u0 + (own ? ' to ' + task : '') + '.' },
    { style: 'thisorthat', text: strip(usual[0] || 'The old way') + ', or ' + name + '?' },
    { style: 'tutorial', text: strip(story.howTo || ('How to ' + task)) + ', step by step.' }
  ]
    /* every suggestion passes the same claim rules as a post; one that does not is left out */
    .filter((h) => require('./lint').lint(h.text, Object.assign({ pricing: rec.pricing, section: rec.section }, SITE.lintCtx())).ok)
    .map((h) => Object.assign(h, { reel: own ? styleUrl(rec.path, h.style) : '' }));
  const ga = own ? (gameAngles(rec) || liveAngles(rec)) : null;
  if (ga) for (const h of hooks) { const t = ga.hooks[h.style]; if (t && require('./lint').lint(t, Object.assign({ pricing: rec.pricing, section: rec.section }, SITE.lintCtx())).ok) h.text = t; }
  const tag = own ? camel(task.replace(/^(work out|make|create|convert|check|find|calculate)\s+/i, '')) : camel(SITE.current().name);
  const series = ga ? ga.series.concat(['"' + (rec.sectionName || (rec.section === 'live' ? 'Live tools' : 'Games')) + '": ' + name + ' is one.']) : own
    ? ['"' + (rec.sectionName || 'Tools') + ' in 10 seconds", episode by episode: ' + name + ' is one.', '"The job I stopped doing by hand": one tool a week, the same opening line.', '"You asked, I answered": each episode answers one real question about ' + lc(rec.sectionName || 'the tools') + '.']
    : ['"How ' + SITE.current().name + ' works", one feature per episode: ' + name + ' is one.', '"A day at the shop": the real work, with ' + lc(name) + ' in it.', '"You asked": answer one customer question a week on camera.'];
  const ms = moments({ days: 180 }).filter((m) => !m.monthly && (!own || !m.sections || !m.sections.length || m.sections.includes(rec.section)));
  return {
    tool: { path: rec.path, title: name, section: rec.section, sectionName: rec.sectionName },
    hooks,
    series,
    challenge: ga ? ga.challenge : own ? tag + 'Challenge: ' + task + ' in under 10 seconds. Stitch this with your time.' : tag + ': show how you use ' + lc(name) + ' in your shop.',
    collab: 'Send the kit and the reel to a creator whose followers ' + (own ? 'need to ' + task : 'are ' + (persona ? lc(persona) : 'your customers')) + ': they post it their way, as a Collab, and disclose the partnership.',
    reply: 'Find a comment or a question that asks how to ' + (own ? task : 'do this') + ', and answer it with a video reply in the ' + (STYLES[1].label) + ' style.',
    proof: proof.slice(0, 3),
    moment: (ga && ga.moment && ms.find((m) => ga.moment.test(m.name))) || ms[0] || null,
    styles: STYLES.map((s) => Object.assign({}, s, { reel: own ? styleUrl(rec.path, s.id) : '' }))
  };
}

/* ---------------------------------------------------------------- text */

function todayText(t) {
  const out = ['Growth moves for ' + t.date + ' (' + t.site + ')'];
  t.moves.forEach((c, i) => { out.push('\n' + (i + 1) + '. ' + c.title + '  [' + c.groupLabel + ']'); out.push('   ' + c.why); c.how.forEach((h) => out.push('   - ' + h)); });
  if (t.experiment) out.push('\nExperiment of the week: ' + t.experiment.title + ' — ' + t.experiment.how[0]);
  out.push('Reel style of the day: ' + t.style.label + ' — ' + t.style.about);
  if (t.next.length) {
    out.push('\nComing up:');
    for (const m of t.next) out.push('  ' + m.date + '  ' + m.name + (m.check ? ' (check the date)' : '') + (m.startIn <= 0 ? '  — start now' : '  — start by ' + m.startBy));
  }
  return out.join('\n');
}

function anglesText(a) {
  const out = ['Viral angles for ' + a.tool.title];
  out.push('\nHooks (one per style):');
  for (const h of a.hooks) out.push('  [' + h.style + '] ' + h.text + (h.reel ? '\n      ' + h.reel : ''));
  out.push('\nSeries ideas:'); a.series.forEach((s) => out.push('  - ' + s));
  out.push('\nChallenge: ' + a.challenge);
  out.push('Collab: ' + a.collab);
  out.push('Reply video: ' + a.reply);
  if (a.moment) out.push('Next moment it fits: ' + a.moment.date + ' ' + a.moment.name + ' (start by ' + a.moment.startBy + ')');
  return out.join('\n');
}

module.exports = { STYLES, GROUPS, CARDS, playbook, moments, today, angles, todayText, anglesText, styleUrl };
