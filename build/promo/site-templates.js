'use strict';
/**
 * Promotion copy for sites other than 1234Tools (site.js), from the profile's own
 * stories: hook, pain, the usual way, promise, steps, call to action and the facts
 * the site states. Same template ids, limits and result shape as templates.js, so
 * Draft, Today and the calendar work unchanged; none of the 1234Tools wording
 * ("runs in your browser", "free") is used, and every part is linted with the
 * site's own claim rules.
 *
 *   render(templateId, record, opts) -> { id, text, title?, parts[], chars, limit, countMode, url, cleanUrl,
 *                                         utmUrl, medium, linkInReply, warnings[], errors[], ok, hash, step }
 * Deterministic: the same (template, record, opts) gives the same text.
 */
const S = require('./site');
const { lint, count } = require('./lint');

function META() { return require('./templates').META; }
const KIND_MEDIUM = { social: 'social', video: 'video', community: 'community', reddit: 'community', forum: 'forum', qa: 'community', launch: 'launch', directory: 'directory', newsletter: 'newsletter', email: 'email', share: 'social' };

function hash32(s) { let h = 2166136261; s = String(s || '').replace(/\s+/g, ' ').trim(); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
function trunc(s, n) { s = String(s); if (Array.from(s).length <= n) return s; return Array.from(s).slice(0, Math.max(0, n - 1)).join('').replace(/\s+\S*$/, '') + '…'; }
const sentence = (s) => { s = String(s || '').trim(); return s && !/[.!?…]$/.test(s) ? s + '.' : s; };
const tag = (s) => '#' + String(s).replace(/[^A-Za-z0-9]+(.)?/g, (m, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase());

/** The pieces every template is built from, for one variant and one shortening step. */
function ctx(templateId, rec, opts, step) {
  const site = S.current();
  const st = rec.story || {};
  const venue = opts.venue || null;
  const medium = (venue && KIND_MEDIUM[venue.kind]) || META()[templateId].medium || 'social';
  const venueId = (venue && venue.id) || opts.venueId || 'promo';
  const utm = S.utmUrl(rec.path, venueId, medium);
  const clean = rec.url;
  const URL = META()[templateId].clean ? clean : utm;
  const v = parseInt(opts.variant, 10) || 0;
  const leads = [st.hook, st.pain, st.promise].filter(Boolean);
  const lead = leads.length ? leads[v % leads.length] : rec.title;
  const steps = (st.steps || []).filter(Boolean);
  const disclose = 'Disclosure: I run ' + site.name + '.';
  const tags = step >= 1 ? [] : [tag(site.name), tag(rec.section)].filter((x) => x.length > 2);
  return {
    site, st, rec, venue, medium, URL, utm, clean, v, step, lead, steps, disclose, tags,
    hook: st.hook || rec.title, pain: step >= 2 ? '' : (st.pain || ''), promise: st.promise || rec.description,
    usual: step >= 2 ? [] : (st.usual || []), cta: st.cta || ('See it on ' + site.name), facts: step >= 1 ? [] : (rec.facts || []).slice(0, 2),
    profileOnly: !!(venue && venue.linkPolicy === 'profile-only'), commentOnly: !!(venue && venue.linkPolicy === 'comment-only'), noLink: !!(venue && venue.linkPolicy === 'none'),
    q: opts.question && (opts.question.title || opts.question) ? String(opts.question.title || opts.question) : ''
  };
}

/* '' is a blank line between paragraphs; runs of blank lines collapse to one. */
const lines = (...xs) => xs.flat().filter((x) => x != null && x !== false).map((x) => String(x).trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
/* "1) Customers…", not "1. Customers…": a number followed by "customers" reads as a user count to lint.js. */
const numbered = (arr) => arr.map((s, i) => (i + 1) + ') ' + sentence(s));

/* Each builder returns { parts: [{ key, label, text }], main, linkInReply? }. */
const B = {
  social(C, withTags) {
    const body = [sentence(C.lead), C.lead !== C.promise ? sentence(C.promise) : ''].filter(Boolean).join(' ');
    if (C.commentOnly) return { parts: [{ key: 'text', label: 'Post', text: lines(body, withTags ? C.tags.join(' ') : '') }, { key: 'reply', label: 'First reply (the link)', text: C.URL }], main: 'text', linkInReply: true };
    return { parts: [{ key: 'text', label: 'Post', text: lines(body, C.noLink ? 'Search for ' + C.site.name + '.' : C.URL, withTags ? C.tags.join(' ') : '') }], main: 'text' };
  },
  caption(C) {
    const link = C.profileOnly || C.noLink ? 'Link in bio: ' + C.site.name : C.URL;
    return { parts: [{ key: 'text', label: 'Caption', text: lines(sentence(C.lead), '', C.pain && C.lead !== C.pain ? sentence(C.pain) : '', sentence(C.promise), C.steps.length && C.step < 1 ? ['', ...numbered(C.steps)] : [], '', sentence(C.cta) + ' ' + link, C.tags.length ? '\n' + C.tags.join(' ') : '') }], main: 'text' };
  },
  long(C, withTitle, opts) {
    const body = lines(sentence(C.lead), '', C.pain && C.lead !== C.pain ? sentence(C.pain) : '',
      C.usual.length ? 'The usual way: ' + C.usual.join('; ') + '.' : '', sentence(C.promise), '',
      C.steps.length ? ['How it works:', ...numbered(C.steps), ''] : [], C.facts.length ? C.facts.map((f) => '• ' + f) : [],
      (opts && opts.disclose) ? C.disclose : '', C.commentOnly ? '' : sentence(C.cta) + ' ' + (C.noLink ? '' : C.URL));
    const parts = [];
    if (withTitle) parts.push({ key: 'title', label: 'Title', text: trunc(C.rec.title + ': ' + C.hook.replace(/[.!?]$/, ''), 120) });
    parts.push({ key: 'body', label: 'Post', text: body.trim() });
    if (C.commentOnly) parts.push({ key: 'comment', label: 'First comment (the link)', text: sentence(C.cta) + ' ' + C.URL });
    return { parts, main: 'body', linkInReply: C.commentOnly };
  },
  answer(C, opts) {
    const q = C.q ? 'On "' + trunc(C.q, 120) + '": ' : '';
    const text = lines(q + (C.usual.length ? 'The usual way is ' + C.usual.join(', or ') + '.' : sentence(C.pain)), '',
      sentence(C.promise), C.steps.length ? numbered(C.steps) : [], '', (opts && opts.noUrl) ? 'It is on ' + C.site.name + ' (search the name).' : C.URL, C.disclose);
    return { parts: [{ key: 'body', label: 'Reply', text: text.trim() }], main: 'body' };
  }
};

function build(id, C) {
  switch (id) {
    case 'x-post': case 'threads-post': case 'bluesky-post': case 'mastodon-post': return B.social(C, id !== 'bluesky-post');
    case 'x-thread': {
      const posts = [sentence(C.lead), C.pain ? sentence(C.pain) : sentence(C.hook), sentence(C.promise), C.steps.length ? numbered(C.steps).join('\n') : sentence(C.cta), sentence(C.cta) + ' ' + C.URL];
      return { parts: posts.map((t, i) => ({ key: 'p' + (i + 1), label: 'Post ' + (i + 1) + ' of 5', text: t })), main: 'p1', joined: posts.join('\n\n') };
    }
    case 'instagram-caption': case 'tiktok-caption': return B.caption(C);
    case 'linkedin-post': { C.commentOnly = true; return B.long(C, false); }
    case 'facebook-group': case 'forum-post': case 'reddit-post': return B.long(C, id !== 'facebook-group', { disclose: true });
    case 'hn-show': case 'ph-launch': case 'indiehackers-post': case 'devto-article': return B.long(C, true, { disclose: id !== 'ph-launch' });
    case 'telegram-post': case 'youtube-description': return B.long(C, false);
    case 'reddit-comment': case 'hn-comment': case 'quora-answer': case 'stackexchange-answer': case 'forum-reply': case 'discord-message': return B.answer(C);
    case 'youtube-comment': return B.answer(C, { noUrl: true });
    case 'pinterest-pin': return { parts: [
      { key: 'title', label: 'Pin title', text: trunc(C.rec.title + ': ' + C.hook.replace(/[.!?]$/, ''), 100) },
      { key: 'description', label: 'Description', text: lines(sentence(C.promise), C.steps.length ? numbered(C.steps).join(' ') : '', C.tags.join(' ')).replace(/\n/g, ' ') },
      { key: 'alt', label: 'Alt text', text: C.rec.title + ' from ' + C.site.name },
      { key: 'url', label: 'Destination link', text: C.utm }], main: 'description' };
    case 'whatsapp-broadcast': return { parts: [{ key: 'text', label: 'Message', text: lines('Hi — *' + C.rec.title + '*. ' + sentence(C.promise), C.URL, 'Reply STOP and I\'ll take you off this list.') }], main: 'text' };
    case 'newsletter-blurb': return { parts: [{ key: 'text', label: 'Blurb', text: [C.step < 2 ? sentence(C.hook) : '', sentence(C.promise), C.steps.length && C.step < 1 ? 'In short: ' + C.steps.join(', ') + '.' : '', C.step < 2 ? sentence(C.cta) : '', C.URL].filter(Boolean).join(' ') }], main: 'text' };
    case 'directory-listing': return { parts: [
      { key: 'name', label: 'Name', text: C.rec.title + ' — ' + C.site.name },
      { key: 'short', label: 'Short description', text: trunc(sentence(C.promise), 160) },
      { key: 'long', label: 'Long description', text: lines(sentence(C.hook), sentence(C.promise), C.steps.length ? numbered(C.steps) : []) },
      { key: 'url', label: 'URL', text: C.clean }], main: 'long' };
    case 'email-outreach': return { parts: [
      { key: 'subject', label: 'Subject', text: trunc(C.rec.title + ' for ' + (opts0(C).theirPageTitle || 'your readers'), 80) },
      { key: 'body', label: 'Email', text: lines('Hi' + (opts0(C).firstName ? ' ' + opts0(C).firstName : '') + ',', '', sentence(C.promise) + ' ' + C.clean, '', 'I run ' + C.site.name + '; happy to answer questions. If this is not useful, ignore this note and I will not write again.') }], main: 'body' };
    case 'signature': return { parts: [{ key: 'text', label: 'Signature', text: C.site.name + ' — ' + trunc(C.rec.title, 50) + ' · ' + C.clean }], main: 'text' };
    case 'bio': return { parts: [{ key: 'text', label: 'Bio', text: trunc(C.site.name + ': ' + (C.site.promotes === 'products' ? 'shop ' : '') + C.rec.title + '. ' + C.site.baseUrl.replace(/^https?:\/\//, ''), 150) }], main: 'text' };
    default: return B.long(C, false);
  }
}
function opts0(C) { return C.opts || {}; }

const STEPS = 3;

function limitOf(id, part, main, venue) {
  const m = META()[id];
  if (/^(url|clean)$/.test(part.key)) return { lim: 0, mode: 'chars' };
  if (id === 'pinterest-pin') return { lim: part.key === 'title' ? 100 : part.key === 'description' ? 500 : 0, mode: 'chars' };
  if (id === 'directory-listing') return { lim: part.key === 'short' ? 160 : part.key === 'long' ? 500 : 0, mode: 'chars' };
  if (id === 'email-outreach') return { lim: part.key === 'body' ? 90 : 0, mode: part.key === 'body' ? 'words' : 'chars' };
  if (part.key === 'title') return { lim: (venue && venue.titleMax) || 300, mode: 'chars' };
  if (part.key === main || /^p\d$/.test(part.key)) return { lim: Math.min(m.limit, (venue && venue.maxChars) || m.limit), mode: m.countMode || 'chars' };
  return { lim: 0, mode: 'chars' };
}

function render(templateId, rec, opts) {
  opts = opts || {};
  const M = META();
  if (!M[templateId]) throw new Error('Unknown template: ' + templateId);
  if (typeof rec === 'string') rec = S.record(rec);
  const venue = opts.venue || null;
  let built = null;
  let C = null;
  let step = 0;
  for (; step < STEPS; step++) {
    C = ctx(templateId, rec, opts, step);
    C.opts = opts;
    built = build(templateId, C);
    if (built.parts.every((p) => { const { lim, mode } = limitOf(templateId, p, built.main, venue); return !lim || count(p.text, mode) <= lim; })) break;
  }
  const warnings = [];
  if (step >= STEPS) {
    step = STEPS - 1;
    warnings.push({ rule: 'hard-trunc', msg: 'Cut to fit the limit; read it before posting.' });
    for (const p of built.parts) { const { lim, mode } = limitOf(templateId, p, built.main, venue); if (lim && mode !== 'words' && count(p.text, mode) > lim) p.text = trunc(p.text, lim - (mode === 'x' ? 22 : 0)); }
  } else if (step > 0) warnings.push({ rule: 'overflow', msg: 'Shortened to fit: ' + (step === 1 ? 'hashtags, steps and facts dropped.' : 'the pain and the usual way dropped too.') });
  if (M[templateId].needsQuestion && !C.q) warnings.push({ rule: 'question-required', msg: 'Answers need a real question: draft from the Opportunities tab.' });
  const errors = [];
  const parts = built.parts.map((p) => {
    const { lim, mode } = limitOf(templateId, p, built.main, venue);
    const isUrl = /^(url|clean)$/.test(p.key);
    const res = lint(p.text, { site: S.current(), limit: lim, countMode: mode === 'chars' ? undefined : mode, requireDisclosure: !!M[templateId].disclose && p.key === built.main && !isUrl, multiLinkOk: !!M[templateId].multiLink, cleanOnly: !!M[templateId].clean && !isUrl });
    for (const e of res.errors) errors.push(Object.assign({ part: p.key }, e));
    for (const w of res.warnings) warnings.push(Object.assign({ part: p.key }, w));
    return { key: p.key, label: p.label, text: p.text, chars: res.count, limit: lim, countMode: mode };
  });
  const main = parts.find((p) => p.key === built.main) || parts[0];
  const title = parts.find((p) => p.key === 'title' || p.key === 'name');
  const text = built.joined || main.text;
  return {
    id: templateId, label: M[templateId].label, tool: rec.path, variant: C.v, site: S.currentId(),
    text, title: title ? title.text : undefined, parts, chars: main.chars, limit: main.limit, countMode: main.countMode,
    url: C.URL, cleanUrl: C.clean, utmUrl: C.utm, medium: C.medium, linkInReply: !!built.linkInReply,
    warnings, errors, ok: errors.length === 0, hash: hash32(text), step
  };
}

module.exports = { render };
