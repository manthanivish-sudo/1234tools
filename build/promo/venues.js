'use strict';
/**
 * The venue register (build/promo/venues.json) and fit ranking.
 *
 *   load()               -> { venues, excluded, insights[{topic,text}], meta }
 *   get(id)
 *   postVenues()         venues the owner posts on (roles includes 'post')
 *   fit(toolPath)        venues ranked for a tool: section match, audience overlap,
 *                        risk, link policy and whether the log allows a post today
 *   fitAudience(slug)    venues ranked for an audience (collection slug or venue audience tag)
 *   templatesFor(venue)  the templates that make sense on a venue, preferred first
 *   composerUrl(venue, {title, text, url})  prefilled composer for a human to finish, or ''
 *
 * PROMO_VENUES overrides the path (tests).
 */
const fs = require('fs');
const path = require('path');
const T = require('./tools');

let cache = null;
let cachePath = null;
let cacheMtime = 0;

function file() { return process.env.PROMO_VENUES || path.join(__dirname, 'venues.json'); }

function load() {
  const f = file();
  let st;
  try { st = fs.statSync(f); } catch (e) { throw new Error('Venue register not found: ' + f); }
  if (cache && cachePath === f && cacheMtime === st.mtimeMs) return cache;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const venues = (j.venues || []).map((v) => Object.assign({
    roles: ['post'], audiences: [], sections: [], cadenceDays: 0, maxPerWeek: 0, maxChars: 0, risk: 'medium',
    linkPolicy: 'inline', selfPromo: 'disclosed', submitUrl: '', searchUrl: '', apiSearch: '', rulesUrl: '', notes: '', verifiedHow: '',
  }, v));
  let insights = [];
  if (Array.isArray(j.insights)) insights = j.insights.map((x) => (typeof x === 'string' ? { topic: '', text: x } : x));
  else if (j.insights && typeof j.insights === 'object') {
    for (const [topic, arr] of Object.entries(j.insights)) for (const text of [].concat(arr)) insights.push({ topic, text: String(text) });
  }
  const excluded = (j.excluded || []).map((x) => (typeof x === 'string' ? { name: x, why: '' } : x));
  const meta = {};
  for (const k of Object.keys(j)) if (!['venues', 'excluded', 'insights'].includes(k)) meta[k] = j[k];
  cache = { venues, excluded, insights, meta, byId: new Map(venues.map((v) => [v.id, v])) };
  cachePath = f; cacheMtime = st.mtimeMs;
  return cache;
}

function all() { return load().venues; }
function get(id) { return load().byId.get(id) || null; }
function isPostVenue(v) { return (v.roles || ['post']).includes('post') && v.kind !== 'share'; }
function postVenues() { return all().filter(isPostVenue); }

/* Extra templates per venue, after the venue's own. */
function templatesFor(v) {
  const out = [];
  const add = (id) => { if (id && !out.includes(id)) out.push(id); };
  add(v.template);
  const id = v.id || '';
  if (v.kind === 'reddit') { add('reddit-comment'); add('reddit-post'); }
  if (/hacker-news|^hn$/.test(id)) { add('hn-show'); add('hn-comment'); }
  if (/product-hunt/.test(id)) add('ph-launch');
  if (/(^|-)x$/.test(id)) { add('x-post'); add('x-thread'); add('bio'); }
  if (/linkedin/.test(id)) add('linkedin-post');
  if (/instagram/.test(id)) { add('instagram-caption'); add('bio'); }
  if (/tiktok/.test(id)) { add('tiktok-caption'); add('bio'); }
  if (/youtube/.test(id)) { add('youtube-description'); add('youtube-comment'); }
  if (v.kind === 'forum') { add('forum-reply'); add('forum-post'); add('signature'); }
  if (/quora/.test(id)) add('quora-answer');
  if (/stackexchange/.test(id)) add('stackexchange-answer');
  if (v.kind === 'directory') add('directory-listing');
  if (/whatsapp/.test(id)) add('whatsapp-broadcast');
  if (/telegram/.test(id)) add('telegram-post');
  if (/newsletter/.test(id)) add('newsletter-blurb');
  if (/email/.test(id)) add('email-outreach');
  if (/discord/.test(id)) add('discord-message');
  if (/facebook/.test(id)) add('facebook-group');
  return out;
}

const RISK = { low: 15, medium: 5, high: -12 };
const LINK = { inline: 10, 'comment-only': 6, 'profile-only': 0, none: -6 };

function logApi() { try { return require('./log'); } catch (e) { return null; } }

function scoreVenue(v, rec, opts) {
  const why = [];
  let s = 0;
  if (rec) {
    if (v.sections.includes(rec.section)) { s += 40; why.push('section ' + rec.section); }
    else if (!v.sections.length) s += 8;
    const overlap = v.audiences.filter((a) => rec.audienceTags.includes(a));
    if (overlap.length) { s += Math.min(32, overlap.length * 8); why.push('audience ' + overlap.join(', ')); }
    if (v.audiences.includes('general')) s += 3;
  }
  if (opts && opts.tags) {
    const overlap = v.audiences.filter((a) => opts.tags.includes(a));
    if (overlap.length) { s += 30 + overlap.length * 6; why.push('audience ' + overlap.join(', ')); }
  }
  s += RISK[v.risk] != null ? RISK[v.risk] : 0;
  s += LINK[v.linkPolicy] != null ? LINK[v.linkPolicy] : 0;
  if (v.risk === 'high') why.push('high risk');
  return { s, why };
}

function decorate(v, score, why, status) {
  return {
    id: v.id, name: v.name, kind: v.kind, url: v.url, rulesUrl: v.rulesUrl, risk: v.risk, selfPromo: v.selfPromo,
    linkPolicy: v.linkPolicy, promoThread: v.promoThread, cadenceDays: v.cadenceDays, maxPerWeek: v.maxPerWeek,
    template: v.template, templates: templatesFor(v), submitUrl: v.submitUrl, searchUrl: v.searchUrl, hasApi: !!v.apiSearch,
    notes: v.notes, verifiedHow: v.verifiedHow, tone: v.tone, bestTimesUTC: v.bestTimesUTC, estimatedReach: v.estimatedReach,
    score, why, status,
  };
}

/** Rank the post venues for a tool. */
function fit(toolPath, opts) {
  opts = opts || {};
  const rec = T.record(toolPath);
  const L = opts.noLog ? null : logApi();
  const out = [];
  for (const v of postVenues()) {
    const { s, why } = scoreVenue(v, rec);
    if (!v.sections.includes(rec.section) && !v.audiences.some((a) => rec.audienceTags.includes(a))) continue;
    let st = { ok: true, reasons: [], warnings: [], nextAt: null };
    if (L) st = L.canPost(v.id, { venue: v, toolPath: rec.path, template: v.template, now: opts.now });
    out.push(decorate(v, s + (st.ok ? 0 : -50), why, st));
  }
  out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return opts.limit ? out.slice(0, opts.limit) : out;
}

/** Venue audience tags for a collection slug or a venue audience word. */
function audienceTags(slug) {
  const vocab = (load().meta.audienceVocabulary) || [];
  if (T.AUDIENCE_TAGS[slug]) return T.AUDIENCE_TAGS[slug].slice();
  if (vocab.includes(slug)) return [slug];
  return [slug];
}

function fitAudience(slug, opts) {
  opts = opts || {};
  const tags = audienceTags(slug);
  const L = opts.noLog ? null : logApi();
  const out = [];
  for (const v of postVenues()) {
    if (!v.audiences.some((a) => tags.includes(a))) continue;
    const { s, why } = scoreVenue(v, null, { tags });
    let st = { ok: true, reasons: [], warnings: [], nextAt: null };
    if (L) st = L.canPost(v.id, { venue: v, template: v.template, now: opts.now });
    out.push(decorate(v, s + (st.ok ? 0 : -50), why, st));
  }
  out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return opts.limit ? out.slice(0, opts.limit) : out;
}

/**
 * A prefilled composer URL for the human to finish and publish, or '' when the
 * venue has none. Placeholders: {title} {text} {url} (any other placeholder is
 * emptied). If the composer has its own url field, the URL is taken out of the
 * text so it is not pasted twice.
 */
function composerUrl(v, d) {
  if (!v || !v.submitUrl) return '';
  let text = String(d.text || '');
  const url = String(d.url || '');
  if (/\{url\}/.test(v.submitUrl) && url) {
    text = text.split(url).join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  }
  const map = { title: d.title || '', text, url };
  return v.submitUrl.replace(/\{(\w+)\}/g, (m, k) => encodeURIComponent(map[k] != null ? map[k] : ''));
}

/**
 * Composer for a rendered draft, honouring "link in the first reply/comment":
 * returns { url, note }. A composer that only takes a link (LinkedIn, Facebook
 * sharer) would turn a no-link post into a link post, so none is offered then.
 */
function composerForDraft(v, d, title) {
  if (!v || !v.submitUrl) return { url: '', note: v ? 'This venue has no prefill URL: copy the text and paste it in the venue.' : 'Pick a venue to get a composer.' };
  const takesText = /\{text\}/.test(v.submitUrl);
  if (d.linkInReply) {
    if (!takesText) return { url: '', note: 'This composer only takes a link, which would make a link post. Start a new post, paste the text, then put the link in the first comment.' };
    return { url: composerUrl(v, { title, text: d.text, url: '' }), note: 'Post the text, then add the link as your first reply.' };
  }
  return { url: composerUrl(v, { title, text: d.text, url: d.url }), note: takesText ? '' : 'This composer takes the link only; the page preview does the talking. Add the text yourself if the venue allows it.' };
}

/* Spec Part B section 6: the platform rules that get accounts banned. Shown before any composer click. */
const RED_LINES = {
  reddit: ['No vote manipulation or alt accounts.', 'Never the same link across subs in one day.', 'Keep self-promotion under 10% of activity.', 'Follow the sub\'s own rules; never edit a link in after approval.', 'Never DM people who asked a question.'],
  hn: ['One account. Never ask for upvotes anywhere.', 'Do not repost a Show HN that died within 12 months.', 'No UTM or tracking in the URL field.'],
  stackexchange: ['The answer must be complete without the link.', 'Disclose that you wrote the tool, right before the link.', 'Never the same link in several answers; no voting rings.'],
  quora: ['The answer must stand alone: never mostly a link.', 'Never post the same answer to many questions; no affiliate-style wording.'],
  linkedin: ['No automation tools, connection-blast scripts or engagement pods.'],
  social: ['No automated posting, no repeated identical text.', 'No follow/unfollow churn; never hijack a trending tag.'],
  facebook: ['Links only on the group\'s allowed day.', 'Never join to post and leave; never one link to many groups in a day.'],
  video: ['No 30-tag spam, no bot comments, no link-drop comments on other videos.', 'No URLs in YouTube comments: name the site in words.'],
  chat: ['No unsolicited DMs.', 'Broadcast only to people who opted in (WhatsApp policy).', 'Help first: no link-dropping in help channels.'],
  email: ['Always an opt-out; no misleading subjects.', 'Never pretend to be a reader (UK PECR/GDPR applies).'],
  all: ['No sockpuppets, fake reviews, "a friend sent me this" or AI-generated praise.', 'A human publishes every post: no scheduled or bulk posting.', 'One link per piece; disclose ownership wherever the author voice is not obvious.'],
};

function redLinesFor(v) {
  const id = (v && v.id) || '';
  const out = [];
  if (!v) return RED_LINES.all.slice();
  if (v.kind === 'reddit') out.push(...RED_LINES.reddit);
  if (/hacker-news|^hn$/.test(id)) out.push(...RED_LINES.hn);
  if (/stackexchange/.test(id)) out.push(...RED_LINES.stackexchange);
  if (/quora/.test(id)) out.push(...RED_LINES.quora);
  if (/linkedin/.test(id)) out.push(...RED_LINES.linkedin);
  if (/facebook/.test(id)) out.push(...RED_LINES.facebook);
  if (v.kind === 'video' || /instagram|tiktok|youtube/.test(id)) out.push(...RED_LINES.video);
  if (/discord|telegram|whatsapp/.test(id)) out.push(...RED_LINES.chat);
  if (/email/.test(id)) out.push(...RED_LINES.email);
  if (v.kind === 'social' && !out.length) out.push(...RED_LINES.social);
  out.push(...RED_LINES.all);
  return out;
}

module.exports = { load, all, get, postVenues, isPostVenue, templatesFor, fit, fitAudience, audienceTags, composerUrl, composerForDraft, file, RED_LINES, redLinesFor };
