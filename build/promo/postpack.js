'use strict';
/**
 * The copy-paste pack for one item on one platform: every box the platform's
 * upload screen asks for (YouTube: title, description, tags, hashtags, pinned
 * comment, category; Pinterest: title, description, alt text, link, board,
 * topics; Instagram: caption, up to 5 hashtags, cover text, first comment …),
 * each with its own limit, character count and lint result, plus the
 * platform's official how-to-post guides and upload page (channels.js HOWTO),
 * the files to upload, the steps, and a short "before you post" checklist.
 *
 *   pack(itemPath, channelId, { variant })  -> { channel, tool, fields[], howTo, upload[], steps[], checklist[], ok, all }
 *   text(pack)                               -> the pack as plain text (desk.js pack)
 *   channelIds() / channelList()
 *
 * The main text comes from the channel's own template (templates.js, or
 * site-templates.js for another site), so a pack says what the Draft tab says;
 * the extra boxes are built from the item's story and lint-checked with the
 * same claim rules. Nothing here posts: a human pastes each box.
 */
const T = require('./tools');
const TPL = require('./templates');
const TAGS = require('./hashtags');
const CH = require('./channels');
const SITE = require('./site');
const { lint, count } = require('./lint');

/* Hashtag counts: Instagram's own cap (5, December 2025; channels.js), YouTube shows
   up to three by the title, X recommends at most two, a Threads post takes one topic.
   The rest are the desk's advice, not platform rules. */
const TAG_N = {
  'instagram-reel': 5, 'instagram-carousel': 5, 'instagram-story': 0, 'facebook-reel': 3, 'facebook-post': 2,
  'youtube-shorts': 3, tiktok: 4, 'pinterest-video': 0, 'pinterest-image': 0, 'linkedin-post': 3, 'linkedin-document': 3,
  x: 1, bluesky: 2, mastodon: 3, telegram: 0, threads: 0, 'whatsapp-status': 0, 'whatsapp-channel': 0
};

/* YouTube's category for a section (the upload screen's "Category" menu). */
const YT_CATEGORY = {
  developer: 'Science & Technology', ai: 'Science & Technology', 'ai-image': 'Science & Technology', 'ai-video': 'Science & Technology', engineering: 'Science & Technology',
  education: 'Education', mathematics: 'Education', finance: 'Education', india: 'Education', business: 'Education', health: 'Howto & Style',
  pdf: 'Howto & Style', image: 'Howto & Style', text: 'Howto & Style', design: 'Howto & Style', qr: 'Howto & Style', utilities: 'Howto & Style',
  games: 'Entertainment', live: 'Education', time: 'Howto & Style', conversions: 'Howto & Style', audio: 'Howto & Style', video: 'Howto & Style', social: 'Howto & Style'
};

const CHECK_COMMON = [
  'The first second shows the hook as text on screen (most people watch with the sound off).',
  'One idea, one tool, one result: cut anything that is not the result.',
  'Reply to the first comments within the hour: replies are what keep a post travelling.'
];
const CHECK = {
  'youtube-shorts': ['Title says the search words people type ("how to …"); the first three hashtags in the description show by the title.', 'Add the Short to a series playlist so one view leads to the next.', 'If Related video is on for your channel, point it at the walkthrough.', 'Pin the comment below; no links in YouTube comments.'],
  tiktok: ['Put the search phrase in the caption and on screen: TikTok search reads both.', 'Use a sound from TikTok\'s own library, quietly under your voice.', 'Pin the comment below, and answer questions with a video reply (that is a second post).'],
  'instagram-reel': ['At most 5 hashtags, all relevant (Instagram\'s cap); the caption\'s first line is the hook.', 'Choose the cover text below so the grid reads as a series.', 'Try it as a trial reel (shown to non-followers first) when the hook is new.', 'Share it to your story with a poll sticker an hour after posting.'],
  'instagram-carousel': ['Slide 1 is the hook, the last slide asks for a save.', 'Add alt text to each slide (Advanced settings).', 'Add music to the carousel if the app offers it.'],
  'instagram-story': ['Add the link sticker with the link below.', 'Add a poll or question sticker: a tap is a reply.', 'Save it to a Highlight named after the section.'],
  'facebook-reel': ['Native video, no link in the caption: the link goes in the first comment.', 'Keep the first frame readable on its own.'],
  'facebook-post': ['Pages get 2 link posts a calendar month without Meta Verified: post without the link and put it in the first comment.'],
  'pinterest-video': ['Title and description carry the search words; the link is the tool page.', 'Save it to the board below; one board per section.'],
  'pinterest-image': ['Title and description carry the search words; the link is the tool page.', 'Save it to the board below; one board per section.'],
  'linkedin-post': ['First two lines are the hook: the rest hides behind "…more".', 'Link in the first comment, not the post.'],
  'linkedin-document': ['The document title shows on the carousel: keep it the hook.', 'Link in the first comment, not the post.'],
  x: ['Post without the link; the link goes in your first reply.', 'Add alt text to the image or video.'],
  bluesky: ['Add alt text to the image or video.', 'One or two hashtags at most.'],
  mastodon: ['Hashtags in CamelCase (#MergePDF) so screen readers say them right.', 'Add alt text to every image.'],
  telegram: ['Pin the post if it is the week\'s best one.'],
  threads: ['Pick the one topic below in the topic box.', 'End with a question: replies are the reach on Threads.'],
  'whatsapp-status': ['Only your contacts see it: post the video, then the link as a second text status.'],
  'whatsapp-channel': ['Add a poll after the post: "Did this save you time?"']
};

function trunc(s, n) { s = String(s || '').trim(); if (Array.from(s).length <= n) return s; return Array.from(s).slice(0, Math.max(0, n - 1)).join('').replace(/\s+\S*$/, '').replace(/[,;:—–-]+$/, '') + '…'; }
const sentence = (s) => { s = String(s || '').trim(); return s && !/[.!?…]$/.test(s) ? s + '.' : s; };
const lc = (s) => String(s || '').replace(/\b([A-Z])([a-z])/g, (m, a, b) => a.toLowerCase() + b);
const camel = (s) => '#' + String(s).replace(/[^A-Za-z0-9]+(.)?/g, (m, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase());
const uniq = (a) => { const seen = new Set(); return a.filter((x) => { const k = String(x).toLowerCase(); if (!x || seen.has(k)) return false; seen.add(k); return true; }); };

function channelIds() { return CH.list().map((c) => c.id); }
function channelList() { return CH.list().map((c) => ({ id: c.id, name: c.name, short: c.short, platform: c.platform, howTo: c.howTo })); }

function storyOf(rec) {
  if (rec.story) return rec.story;
  try { return require('./stories').storyFor(rec.path) || {}; } catch (e) { return {}; }
}

/** The item's hashtags: the 1234Tools table for a tool; for another site, its brand words and the item's own words. */
function hashtags(rec, n, platform) {
  if (!n) return [];
  if (SITE.isDefault()) {
    const brand = platform === 'youtube' || platform === 'x' ? 0 : 1;
    return TAGS.tagsFor(rec, { n: Math.max(1, n - brand), tier: platform === 'linkedin' ? 'broad' : 'niche', brand, lower: platform === 'tiktok' }).slice(0, n);
  }
  const site = SITE.current();
  const own = [camel(site.name)].concat((rec.keywords || []).slice(0, 4).map(camel)).concat([camel(rec.sectionName || '')]);
  const out = uniq(own.filter((t) => t.length > 2 && t.length <= 30));
  return (platform === 'tiktok' ? out.map((t) => t.toLowerCase()) : out).slice(0, n);
}

function freeLine(rec) {
  if (!SITE.isDefault()) return '';
  return rec.pricing === 'free' ? (rec.media ? 'free, no account, no watermark' : 'free, no account') : 'free for 10 runs a month';
}

/** Search words for a YouTube tags box: comma-separated, at most 500 characters. */
function ytTags(rec, story) {
  const how = String(story.howTo || '').replace(/^how to /i, '').trim();
  const sec = lc(rec.sectionName || '');
  const words = uniq([lc(rec.title)].concat((rec.keywords || []).map(lc), how ? ['how to ' + lc(how)] : [], [sec + (SITE.isDefault() && !/\btools?$/i.test(sec) ? ' tools' : ''), SITE.isDefault() ? '1234tools' : SITE.current().name.toLowerCase()]))
    .map((w) => w.replace(/[<>,#]/g, ' ').replace(/\s+/g, ' ').trim()).filter((w) => w && w.length <= 100);
  const out = [];
  for (const w of words) { if ((out.concat([w]).join(', ')).length > 500) break; out.push(w); }
  return out.join(', ');
}

function coverText(story, rec) {
  const hook = String(story.hook || rec.title).replace(/\s+/g, ' ').trim();
  const first = hook.split(/(?<=[.!?])\s+/)[0];
  return trunc(first.length >= 12 ? first : hook, 42);
}

function pinnedQuestion(rec, ch, v) {
  const site = SITE.current();
  if (!SITE.isDefault()) return ['Questions about ' + lc(rec.title) + '? Ask below and ' + site.name + ' will answer here.', 'Would this help your shop? Tell us what you sell.', 'What should we show next?'][v % 3];
  const named = ch.platform === 'youtube' ? ' It\'s on 1234tools.com, search "' + rec.title + '".' : '';
  return ['What job do you still do by hand? I\'ll make the next 10-second demo about it.' + named,
    'Would you use this for work or at home? Tell me below.' + named,
    'Which tool should I show next? Reply with the job you need done.' + named][v % 3];
}

function altText(rec, story, what) {
  const base = what + ': ' + rec.title + (SITE.isDefault() ? ' on 1234Tools' : ' on ' + SITE.current().name) + '. ' + sentence(story.promise || rec.description || '');
  return trunc(base, 480);
}

function boardName(rec) {
  if (!SITE.isDefault()) return SITE.current().name + ': ' + (rec.sectionName || 'ideas');
  const sec = String(rec.sectionName || 'Online tools').replace(/\s+tools?$/i, '');
  // an AI-for-Business tool is not simply "free" (10 runs a month): its board says what it is for
  return rec.pricing === 'free' ? 'Free ' + sec + ' tools' : sec + ' tools for work';
}

/** One box: its text, limit, count and lint result, linted with the item's own rules. */
function field(rec, key, label, text, o) {
  o = o || {};
  const t = String(text == null ? '' : text);
  const ctx = Object.assign({}, SITE.lintCtx(), { pricing: rec.pricing, section: rec.section, limit: o.limit || undefined, countMode: o.countMode || undefined, multiLinkOk: !!o.multiLink });
  const l = t ? lint(t, ctx) : { ok: true, errors: [], warnings: [] };
  return { key, label, text: t, limit: o.limit || 0, countMode: o.countMode || 'chars', count: count(t, o.countMode || 'chars'), note: o.note || '', ok: l.ok, errors: l.errors, warnings: l.warnings };
}

function mainParts(rec, ch, variant) {
  let V = null;
  try { V = require('./venues').get(ch.venue); } catch (e) { V = null; }
  const r = TPL.render(ch.template, rec, { venue: V || undefined, venueId: ch.venue, variant });
  return r;
}

function pack(itemPath, channelId, opts) {
  opts = opts || {};
  const ch = CH.get(channelId);
  if (!ch) throw new Error('Unknown channel: ' + channelId + '. Channels: ' + channelIds().join(', '));
  if (!itemPath) throw new Error('Pick an item first.');
  const rec = T.record(itemPath);
  const v = Math.abs(parseInt(opts.variant, 10) || 0);
  const story = storyOf(rec);
  const r = mainParts(rec, ch, v);
  const part = (k) => (r.parts.find((p) => p.key === k) || {}).text || '';
  const mainText = r.text;
  const url = r.utmUrl || r.url || rec.url;
  const tags = hashtags(rec, TAG_N[ch.id] || 0, ch.platform);
  const tagLine = tags.join(' ');
  const F = (key, label, text, o) => field(rec, key, label, text, o);
  const free = freeLine(rec);
  const fields = [];
  const stripTags = (s) => String(s).replace(/(^|\s)#[\w-]+/g, '').replace(/[ \t]+\n/g, '\n').trim();

  switch (ch.id) {
    case 'youtube-shorts': {
      /* the search words first: a 1234Tools story's "how to" line; another site's own hook */
      const how = SITE.isDefault() ? (story.howTo || 'How to ' + TPL.taskPhrase(rec)) : (story.hook || rec.title);
      const full = how + (free ? ' (' + free + ')' : '');
      const title = Array.from(full).length <= 100 ? full : trunc(how, 100);
      const inDesc = tags.length && tags.every((t) => mainText.includes(t));
      fields.push(F('title', 'Title', title, { limit: 100, note: 'Shown on the Short and in search. The search words first.' }));
      fields.push(F('description', 'Description', mainText, { limit: 5000, multiLink: true, note: 'Links are not clickable on Shorts, so the video names the address too.' }));
      fields.push(F('tags', 'Tags (comma-separated)', ytTags(rec, story), { limit: 500, note: 'Studio → Show more → Tags. The Studio box counts to 500 characters.' }));
      fields.push(F('hashtags', inDesc ? 'Hashtags (already at the end of the description)' : 'Hashtags (paste at the end of the description)', tagLine, { note: 'YouTube shows up to three by the title.' }));
      fields.push(F('pinned', 'Pinned comment (no links on YouTube)', pinnedQuestion(rec, ch, v), { limit: 500 }));
      fields.push(F('category', 'Category · Audience', (YT_CATEGORY[rec.section] || 'Howto & Style') + ' · No, it\'s not made for kids'));
      fields.push(F('cover', 'Cover text (pick the frame in the app)', coverText(story, rec), { limit: 42 }));
      break;
    }
    case 'tiktok': {
      fields.push(F('caption', 'Caption', mainText, { limit: 2200 }));
      fields.push(F('onscreen', 'On-screen hook (first second)', trunc(story.hook || rec.title, 90), { limit: 90 }));
      fields.push(F('search', 'Search phrase (say it, show it, caption it)', lc(story.howTo || rec.title), { limit: 80 }));
      fields.push(F('cover', 'Cover text', coverText(story, rec), { limit: 42 }));
      fields.push(F('pinned', 'Pinned comment', pinnedQuestion(rec, ch, v), { limit: 150 }));
      break;
    }
    case 'instagram-reel':
    case 'instagram-carousel':
    case 'facebook-reel': {
      const cap = stripTags(mainText);
      fields.push(F('caption', 'Caption', cap + (tagLine ? '\n\n' + tagLine : ''), { limit: 2200 }));
      fields.push(F('hashtags', 'Hashtags (' + tags.length + ', ' + (ch.platform === 'instagram' ? 'Instagram allows 5' : 'the desk\'s advice: 3') + ')', tagLine));
      if (ch.id !== 'instagram-carousel') fields.push(F('cover', 'Cover text', coverText(story, rec), { limit: 42 }));
      if (ch.id === 'instagram-carousel') {
        const slides = [story.hook, story.pain, (story.usual || []).join(' · '), story.promise, (story.steps || []).join(' → ')].map((s, i) => 'Slide ' + (i + 1) + ': ' + trunc(String(s || rec.title), 180));
        fields.push(F('alt', 'Alt text, one per slide', slides.join('\n'), { note: 'Advanced settings → Write alt text, slide by slide.' }));
      }
      fields.push(F('comment', ch.platform === 'facebook' ? 'First comment (the link)' : 'First comment', ch.platform === 'facebook' ? rec.title + ': ' + url : pinnedQuestion(rec, ch, v), { limit: 800 }));
      break;
    }
    case 'instagram-story': {
      fields.push(F('text', 'Text on the story', trunc(story.hook || rec.title, 90), { limit: 90 }));
      fields.push(F('link', 'Link sticker URL', url));
      fields.push(F('sticker', 'Link sticker label', trunc(story.cta || 'Try it', 30), { limit: 30 }));
      fields.push(F('poll', 'Poll sticker', 'Would you use this? · Yes · Show me more', { limit: 80 }));
      break;
    }
    case 'facebook-post': {
      fields.push(F('text', 'Post (no link in it)', stripTags(mainText).replace(/https?:\/\/\S+/g, '').replace(/\s*\(mine\)\s*$/, '').trim(), { limit: 800 }));
      fields.push(F('comment', 'First comment (the link)', rec.title + ': ' + url, { limit: 800 }));
      break;
    }
    case 'pinterest-video':
    case 'pinterest-image': {
      fields.push(F('title', 'Title', part('title') || trunc(story.howTo || rec.title, 100), { limit: 100 }));
      fields.push(F('description', 'Description', part('description') || mainText, { limit: 500 }));
      fields.push(F('alt', 'Alt text', part('alt') || altText(rec, story, ch.id === 'pinterest-video' ? 'Video pin' : 'Pin'), { limit: 500 }));
      fields.push(F('link', 'Destination link', part('url') || url));
      fields.push(F('board', 'Board', boardName(rec), { limit: 50 }));
      fields.push(F('topics', 'Related topics (up to 10)', uniq((rec.keywords || []).map(lc)).slice(0, 10).join(', ')));
      break;
    }
    case 'linkedin-post':
    case 'linkedin-document': {
      if (ch.id === 'linkedin-document') fields.push(F('doctitle', 'Document title (shows on the carousel)', trunc(story.hook || rec.title, 58), { limit: 58 }));
      fields.push(F('text', 'Post', stripTags(part('body') || mainText) + (tagLine ? '\n\n' + tagLine : ''), { limit: 3000, note: 'The first two lines show before "…more".' }));
      fields.push(F('comment', 'First comment (the link)', part('comment') || rec.title + ': ' + url, { limit: 1250 }));
      break;
    }
    case 'x': {
      const t = part('text') || mainText;
      fields.push(F('text', r.linkInReply ? 'Post (no link)' : 'Post', t, { limit: 280, countMode: 'x' }));
      if (part('reply')) fields.push(F('reply', 'First reply (the link)', part('reply'), { limit: 280, countMode: 'x' }));
      fields.push(F('alt', 'Alt text for the image or video', altText(rec, story, 'Image'), { limit: 1000 }));
      break;
    }
    case 'bluesky':
    case 'mastodon':
    case 'threads':
    case 'telegram': {
      const lim = { bluesky: 300, mastodon: 500, threads: 500, telegram: 1000 }[ch.id];
      const mode = ch.id === 'bluesky' ? 'graphemes' : ch.id === 'mastodon' ? 'x' : 'chars';
      const withTags = tagLine && !/#\w/.test(mainText) ? mainText + ' ' + tagLine : mainText;
      // the hashtags go on only while the post still fits
      fields.push(F('text', 'Post', count(withTags, mode) <= lim ? withTags : mainText, { limit: lim, countMode: mode }));
      if (ch.id === 'threads') fields.push(F('topic', 'Topic (one per post)', SITE.isDefault() ? (rec.sectionName || 'Productivity') : SITE.current().name, { limit: 50 }));
      if (ch.id !== 'telegram') fields.push(F('alt', 'Alt text for the image or video', altText(rec, story, 'Image'), { limit: ch.id === 'bluesky' ? 2000 : 1500 }));
      break;
    }
    case 'whatsapp-status': {
      fields.push(F('text', 'Text on the video', trunc(story.hook || rec.title, 90), { limit: 90 }));
      fields.push(F('caption', 'Second status: the link', trunc((story.cta || rec.title) + ' → ' + url, 700), { limit: 700 }));
      break;
    }
    case 'whatsapp-channel': {
      fields.push(F('text', 'Channel update', mainText, { limit: 400 }));
      fields.push(F('poll', 'Poll to send after it', 'Did this help? · Yes, saved me time · Show me another', { limit: 120 }));
      break;
    }
    default:
      fields.push(F('text', 'Text', mainText, { limit: (TPL.META[ch.template] || {}).limit || 0 }));
  }

  const slug = rec.slug || String(rec.path || '').replace(/\/$/, '').split('/').pop();
  const steps = (ch.steps || []).map((s) => s.replace(/<tool>/g, slug));
  const upload = (ch.upload || []).map((s) => s.replace(/<tool>/g, slug));
  const out = {
    channel: { id: ch.id, name: ch.name, short: ch.short, platform: ch.platform, template: ch.template },
    tool: { path: rec.path, title: rec.title, url, site: SITE.currentId() },
    variant: v,
    fields,
    howTo: ch.howTo,
    upload, steps,
    checklist: CHECK_COMMON.concat(CHECK[ch.id] || []),
    redLines: ch.redLines || [],
    ok: fields.every((f) => f.ok)
  };
  out.all = fields.filter((f) => f.text).map((f) => f.label + ':\n' + f.text).join('\n\n');
  return out;
}

function text(p) {
  const out = ['# ' + p.tool.title + ' → ' + p.channel.name + (p.ok ? '' : '   (LINT ERRORS: fix before posting)')];
  for (const f of p.fields) {
    out.push('\n## ' + f.label + (f.limit ? '  [' + f.count + '/' + f.limit + ']' : '') + (f.note ? '  — ' + f.note : ''));
    out.push(f.text || '(empty)');
    for (const e of f.errors) out.push('  ! ' + e.msg);
  }
  out.push('\nUpload: ' + (p.upload.join(' | ') || 'see the steps'));
  if (p.howTo.upload) out.push('Upload page: ' + p.howTo.upload + (p.howTo.uploadLabel ? '  (' + p.howTo.uploadLabel + ')' : ''));
  for (const gd of p.howTo.guides) out.push('How to post: ' + gd.label + ' — ' + gd.url + (gd.read ? '' : '  (needs JavaScript; check the steps there)'));
  return out.join('\n');
}

module.exports = { pack, text, channelIds, channelList, TAG_N, CHECK };
