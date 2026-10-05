'use strict';
/**
 * Promotion Desk tests (node, no browser, no network).
 *   node build/promo/test.js
 * Uses a throwaway PROMO_HOME so the owner's real log is never touched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-test-'));
process.env.PROMO_HOME = TMP;
delete process.env.PROMO_NOW;

const T = require('./tools');
const TPL = require('./templates');
const V = require('./venues');
const L = require('./log');
const F = require('./find');
const P = require('./plan');
const { lint } = require('./lint');

let pass = 0;
let fail = 0;
const failures = [];
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; failures.push(name + ': ' + (e && e.message || e)); }
}
function section(title) { console.log('\n## ' + title); }
function resetLog(entries) {
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(path.join(TMP, 'log.json'), JSON.stringify({ version: 1, entries: entries || [] }));
}
const DAY = 86400000;
const iso = (d) => new Date(d).toISOString();

/* ------------------------------------------------------------ modules */
section('modules are inert on require');
for (const m of ['tools', 'hashtags', 'hooks', 'lint', 'templates', 'venues', 'log', 'find', 'plan', 'kit', 'desk', 'channels', 'guide', 'calendar', 'site', 'site-templates']) {
  check('require ' + m, () => { const x = require('./' + m); assert.ok(x && typeof x === 'object'); });
}
check('log dir is PROMO_HOME', () => assert.strictEqual(L.home(), TMP));

/* ---------------------------------------------------------- templates */
section('every template x every tool x variants 0-2');
const tools = T.listTools();
check('finder has the expected tools', () => assert.ok(tools.length >= 230, 'only ' + tools.length));
const ALLOW = /(\b(10|ten)\b[^.\n]{0,30}\b(runs?|calls?|a month|per month|free|included)\b|\bfree (for|tier of) (10|ten)\b)/i;
let renders = 0;
let renderFails = 0;
let aiFreeFails = 0;
const firstErr = {};
for (const rec of tools) {
  for (const id of TPL.TEMPLATE_IDS) {
    for (let v = 0; v < 3; v++) {
      renders++;
      let r;
      try { r = TPL.render(id, rec, { variant: v }); } catch (e) { renderFails++; firstErr.throw = firstErr.throw || id + ' ' + rec.path + ' ' + e.message; continue; }
      for (const p of r.parts) {
        if (p.limit && p.chars > p.limit) { renderFails++; firstErr.limit = firstErr.limit || id + ' ' + rec.path + ' v' + v + ' ' + p.key + ' ' + p.chars + '>' + p.limit; }
      }
      if (r.errors.length) { renderFails++; firstErr.lint = firstErr.lint || id + ' ' + rec.path + ' v' + v + ' ' + r.errors.map((e) => e.rule + ':' + e.match).join(','); }
      if (rec.pricing === 'freemium' && id !== 'bio') {
        for (const p of r.parts) {
          const free = /\bfree\b/i.test(p.text.replace(/#(\w+)/g, (m, w) => (/free/i.test(w) ? ' free ' : ' ')));
          if (free && !ALLOW.test(p.text)) { aiFreeFails++; firstErr.ai = firstErr.ai || id + ' ' + rec.path + ' [' + p.key + '] ' + p.text.slice(0, 120); }
          if (/\b(on your device|offline|no account|no sign-?up|nothing (you type )?(is )?uploaded)\b/i.test(p.text)) { aiFreeFails++; firstErr.aiClaim = firstErr.aiClaim || id + ' ' + rec.path + ' ' + p.key; }
        }
      }
    }
  }
}
check(renders + ' renders: no throw, within hard limits, lint-clean', () => assert.strictEqual(renderFails, 0, JSON.stringify(firstErr)));
check('AI tools: "free" always carries the 10-a-month allowance; no device/offline/no-account claims', () => assert.strictEqual(aiFreeFails, 0, JSON.stringify(firstErr)));
check('31 templates', () => assert.strictEqual(TPL.TEMPLATE_IDS.length, 31));
check('deterministic', () => assert.strictEqual(TPL.render('x-thread', '/pdf/merge-pdf/', { variant: 2 }).text, TPL.render('x-thread', '/pdf/merge-pdf/', { variant: 2 }).text));
check('variants differ', () => assert.notStrictEqual(TPL.render('reddit-comment', '/pdf/merge-pdf/', { variant: 0 }).text, TPL.render('reddit-comment', '/pdf/merge-pdf/', { variant: 1 }).text));
check('question is injected into answer templates', () => {
  for (const id of ['reddit-comment', 'hn-comment', 'quora-answer', 'stackexchange-answer', 'forum-reply']) {
    const r = TPL.render(id, '/pdf/merge-pdf/', { question: { title: 'How do I combine three PDFs into one?', url: 'https://example.com/q' } });
    assert.ok(r.text.includes('How do I combine three PDFs into one?'), id);
  }
});
check('stackexchange-answer without a question warns', () => assert.ok(TPL.render('stackexchange-answer', '/pdf/merge-pdf/').warnings.some((w) => w.rule === 'question-required')));
check('disclosure present where required', () => {
  for (const id of ['reddit-comment', 'reddit-post', 'hn-comment', 'quora-answer', 'stackexchange-answer', 'forum-reply', 'facebook-group', 'discord-message', 'youtube-comment']) {
    assert.ok(/Disclosure|I built|I run|mine|biased|take that into account/i.test(TPL.render(id, '/business/uk-take-home-pay/').text), id);
  }
});
check('no-watermark only in media sections', () => {
  assert.ok(!/watermark/i.test(TPL.render('linkedin-post', '/business/uk-take-home-pay/', { variant: 2 }).text));
  assert.ok(/watermark/i.test(TPL.render('directory-listing', '/pdf/merge-pdf/').parts.find((p) => p.key === 'short').text));
});
check('x-post on a comment-only venue puts the link in the first reply', () => {
  const r = TPL.render('x-post', '/pdf/merge-pdf/', { venue: V.get('social-x') });
  assert.ok(!/https?:/.test(r.parts[0].text) && /https:/.test(r.parts.find((p) => p.key === 'reply').text) && r.linkInReply);
});
check('result figure becomes the result-first hook, never invented', () => {
  const r = TPL.render('x-post', '/business/uk-take-home-pay/', { angle: 'result-first', result: { summary: '£3,160 a month take-home on £48,000 (2026/27)', params: { gross: 48000 } } });
  assert.ok(r.text.startsWith('£3,160 a month take-home on £48,000 (2026/27).') && r.text.includes('gross=48000') && r.text.includes('(mine)'));
  assert.ok(!/£48k in England/.test(TPL.render('x-post', '/business/uk-take-home-pay/', { angle: 'result-first' }).text));
});

/* ---------------------------------------------------------------- utm */
section('utmUrl');
check('format', () => assert.strictEqual(T.utmUrl('/pdf/merge-pdf/', 'social-x', 'social'), 'https://www.1234tools.com/pdf/merge-pdf/?utm_source=social-x&utm_medium=social&utm_campaign=pdf&utm_content=merge-pdf'));
check('normalises paths', () => assert.strictEqual(T.utmUrl('pdf/merge-pdf', 'x', 'social'), T.utmUrl('/pdf/merge-pdf/', 'x', 'social')));
check('Git Bash mangled path', () => assert.strictEqual(T.normPath('C:/Program Files/Git/pdf/merge-pdf/'), '/pdf/merge-pdf/'));
check('every tool: campaign = section, content = slug', () => {
  const re = /^https:\/\/www\.1234tools\.com\/[a-z0-9-]+\/(?:[a-z0-9-]+\/)+\?utm_source=v&utm_medium=m&utm_campaign=([a-z0-9-]+)&utm_content=([a-z0-9-]+)$/;
  for (const r of tools) { const m = T.utmUrl(r.path, 'v', 'm').match(re); assert.ok(m && m[1] === r.section && m[2] === r.slug, r.path); }
});
check('record fields', () => {
  const r = T.record('/ai/invoice-extractor/');
  assert.strictEqual(r.pricing, 'freemium');
  assert.strictEqual(T.record('/pdf/merge-pdf/').pricing, 'free');
  for (const k of ['title', 'url', 'description', 'verb', 'io', 'section', 'keywords', 'audiences', 'relatedGuides', 'relatedCompare']) assert.ok(k in r, k);
  assert.ok(T.record('/business/bank-reconciliation/').relatedGuides.includes('/guides/bank-reconciliation/'));
});

/* ------------------------------------------------------------- venues */
section('venues');
const reg = V.load();
check('register loaded', () => assert.ok(reg.venues.length >= 70 && reg.excluded.length > 0 && reg.insights.length > 0));
check('excluded subs are not post venues', () => assert.ok(!V.postVenues().some((v) => /privacyguides|r-privacy$|degoogle/i.test(v.id))));
const sectionSlugs = reg.meta.sectionSlugs || [];
check('fit() returns >= 3 venues for every section', () => {
  const sample = {};
  for (const r of tools) if (!sample[r.section]) sample[r.section] = r.path;
  sample.conversions = sample.conversions || T.listAll().find((x) => x.path.startsWith('/conversions/')).path;
  const thin = [];
  for (const s of sectionSlugs) {
    if (!sample[s]) { thin.push(s + ' (no tool)'); continue; }
    const n = V.fit(sample[s], { noLog: true }).filter((f) => V.get(f.id).sections.includes(s)).length;
    if (n < 3) thin.push(s + ':' + n);
  }
  assert.deepStrictEqual(thin, []);
});
check('fitAudience', () => assert.ok(V.fitAudience('accountants', { noLog: true }).length >= 3));
/* 29 in the 2026-10-04 register, plus Google Business Profile posts (2026-10-05: verify the shop has a Profile first) */
check('30 venues carry "verify rules first"', () => assert.strictEqual(reg.venues.filter(V.verifyFirst).length, 30));
check('7 high-risk venues are never auto-suggested', () => {
  const hi = reg.venues.filter((v) => v.risk === 'high');
  assert.strictEqual(hi.length, 7);
  assert.ok(hi.every((v) => !V.autoSuggest(v)));
});
check('composer URL is encoded and does not repeat the link', () => {
  const v = V.get('reddit-r-sideproject');
  const u = V.composerUrl(v, { title: 'A & B → C', text: 'Line one\nhttps://x.y/', url: 'https://x.y/' });
  assert.strictEqual(u, 'https://www.reddit.com/r/SideProject/submit?title=A%20%26%20B%20%E2%86%92%20C&text=Line%20one%0Ahttps%3A%2F%2Fx.y%2F');
  const x = V.composerUrl(V.get('social-x'), { text: 'Hello https://x.y/', url: 'https://x.y/' });
  assert.strictEqual(x, 'https://x.com/intent/post?text=Hello&url=https%3A%2F%2Fx.y%2F');
});
check('LinkedIn link-only composer is not offered for a no-link-in-body post', () => {
  const d = TPL.render('linkedin-post', '/pdf/merge-pdf/', { venue: V.get('social-linkedin') });
  assert.strictEqual(V.composerForDraft(V.get('social-linkedin'), d, 'x').url, '');
});

/* ---------------------------------------------------------------- log */
section('canPost (fake log in a temp PROMO_HOME)');
const TUE = new Date('2026-10-06T10:00:00');
const sp = V.get('reddit-r-sideproject'); // reddit, cadence 30, 1 a week
check('empty log: ok, with a first-post note', () => { resetLog(); const c = L.canPost(sp.id, { toolPath: '/pdf/merge-pdf/', template: 'reddit-post', now: TUE }); assert.ok(c.ok, c.reasons.join()); assert.ok(c.warnings.length); });
check('cadence: a post 5 days ago blocks, with nextAt', () => {
  resetLog([{ at: iso(TUE - 5 * DAY), venueId: sp.id, toolPath: '/pdf/split-pdf/', kind: 'post', linked: true }]);
  const c = L.canPost(sp.id, { toolPath: '/pdf/merge-pdf/', now: TUE });
  assert.ok(!c.ok && c.reasons.some((r) => /Cadence/.test(r)) && c.nextAt);
  assert.strictEqual(new Date(c.nextAt).getTime(), TUE - 5 * DAY + sp.cadenceDays * DAY);
});
check('cadence: after the window it opens (ratio aside)', () => {
  resetLog([{ at: iso(TUE - 40 * DAY), venueId: sp.id, toolPath: '/pdf/split-pdf/', kind: 'post', linked: true }]
    .concat(Array.from({ length: 9 }, (_, i) => ({ at: iso(TUE - (30 - i) * DAY), venueId: sp.id, kind: 'help', linked: false }))));
  const c = L.canPost(sp.id, { toolPath: '/pdf/merge-pdf/', now: TUE });
  assert.ok(c.ok, c.reasons.join(' | '));
});
check('9:1 ratio: 8 helps since the last linked post blocks', () => {
  resetLog([{ at: iso(TUE - 40 * DAY), venueId: sp.id, kind: 'post', linked: true }]
    .concat(Array.from({ length: 8 }, (_, i) => ({ at: iso(TUE - (20 - i) * DAY), venueId: sp.id, kind: 'help', linked: false }))));
  const c = L.canPost(sp.id, { now: TUE });
  assert.ok(!c.ok && c.reasons.some((r) => /9:1/.test(r)));
});
const x = V.get('social-x'); // cadence 1, 7 a week
check('maxPerWeek', () => {
  resetLog(Array.from({ length: x.maxPerWeek }, (_, i) => ({ at: iso(TUE - (i + 1) * DAY + 3600000), venueId: x.id, toolPath: '/t' + i + '/', kind: 'post', linked: true })));
  const c = L.canPost(x.id, { now: TUE });
  assert.ok(!c.ok && c.reasons.some((r) => /Weekly cap/.test(r)), c.reasons.join());
});
check('same tool on the same venue within 30 days', () => {
  resetLog([{ at: iso(TUE - 10 * DAY), venueId: x.id, toolPath: '/pdf/merge-pdf/', kind: 'post', linked: true }]);
  assert.ok(!L.canPost(x.id, { toolPath: '/pdf/merge-pdf/', now: TUE }).ok);
  assert.ok(L.canPost(x.id, { toolPath: '/pdf/split-pdf/', now: TUE }).ok);
});
check('help and skip entries do not count as posts', () => {
  resetLog([{ at: iso(TUE - 3600000), venueId: x.id, kind: 'help', linked: false }, { at: iso(TUE - 3600000), venueId: x.id, kind: 'skip', note: 'x' }]);
  assert.ok(L.canPost(x.id, { now: TUE }).ok);
});
check('daily cap from the routine (Monday = 1 linked post)', () => {
  const MON = new Date('2026-10-05T15:00:00');
  resetLog([{ at: iso(MON - 3600000), venueId: 'social-mastodon', toolPath: '/a/b/', kind: 'post', linked: true }]);
  const c = L.canPost(x.id, { now: MON });
  assert.ok(!c.ok && c.reasons.some((r) => /Monday cap/.test(r)));
});
check('Sunday is off', () => { resetLog(); assert.ok(!L.canPost(x.id, { now: new Date('2026-10-04T12:00:00') }).ok); });
check('removal: 90-day cooldown', () => {
  resetLog([{ at: iso(TUE - 20 * DAY), venueId: x.id, kind: 'removed', linked: false }]);
  assert.ok(L.canPost(x.id, { now: TUE }).reasons.some((r) => /removal/.test(r)));
});
check('identical text within 90 days is refused', () => {
  resetLog([{ at: iso(TUE - 50 * DAY), venueId: 'social-mastodon', toolPath: '/a/b/', kind: 'post', linked: true, hash: L.hash32('Same words here') }]);
  assert.ok(!L.canPost(x.id, { text: 'Same  words here', now: TUE }).ok);
});
check('launch-once venue refuses a second launch of the same tool', () => {
  const hn = V.get('launch-hacker-news');
  resetLog([{ at: iso(TUE - 400 * DAY), venueId: hn.id, toolPath: '/pdf/merge-pdf/', kind: 'post', linked: true }]);
  assert.ok(!L.canPost(hn.id, { toolPath: '/pdf/merge-pdf/', now: TUE }).ok);
});
check('one linked reply per thread', () => {
  resetLog([{ at: iso(TUE - 60 * DAY), venueId: sp.id, kind: 'post', linked: true, thread: 'https://r/x' }]);
  assert.ok(L.canPost('qa-quora', { thread: 'https://r/x', now: TUE }).reasons.some((r) => /thread/.test(r)));
});
check('append writes the log file', () => {
  resetLog();
  L.append({ venueId: x.id, toolPath: '/pdf/merge-pdf/', template: 'x-post', url: 'https://x.com/p/1', text: 'hello' });
  const j = JSON.parse(fs.readFileSync(path.join(TMP, 'log.json'), 'utf8'));
  assert.ok(j.entries.length === 1 && j.entries[0].kind === 'post' && j.entries[0].hash);
});

/* --------------------------------------------------------------- plan */
section('Today plan');
check('a week of plans never suggests a high-risk venue', () => {
  resetLog();
  for (let d = 4; d <= 10; d++) {
    const p = P.plan({ now: new Date('2026-10-' + String(d).padStart(2, '0') + 'T09:00:00') });
    for (const t of p.tasks) if (t.venueId) assert.notStrictEqual(V.get(t.venueId).risk, 'high', p.weekday + ' ' + t.venueId);
  }
});
check('Tuesday: four owner channels, one tool, different templates', () => {
  resetLog();
  const p = P.plan({ now: new Date('2026-10-06T09:00:00') });
  const linked = p.tasks.filter((t) => t.kind === 'linked');
  assert.ok(linked.length >= 3 && new Set(linked.map((t) => t.toolPath)).size === 1 && new Set(linked.map((t) => t.template)).size === linked.length);
  assert.ok(linked.every((t) => t.draft && t.draft.ok));
});
check('a logged task shows as done', () => {
  resetLog();
  const now = new Date('2026-10-06T09:00:00');
  const t = P.plan({ now }).tasks.find((x) => x.kind === 'linked');
  L.append({ venueId: t.venueId, toolPath: t.toolPath, template: t.template, at: iso(now.getTime() + 60000) });
  assert.ok(P.plan({ now: new Date(now.getTime() + 120000) }).tasks.find((x) => x.venueId === t.venueId).done);
});
check('verify-first flag reaches Today tasks', () => {
  resetLog();
  const p = P.plan({ now: new Date('2026-10-08T09:00:00') });
  assert.ok(p.tasks.some((t) => t.verifyFirst === true));
});

/* --------------------------------------------------------------- find */
section('find.js parsers (offline fixtures)');
const FX = path.join(__dirname, 'fixtures');
const rv = { id: 'reddit-r-smallbusiness', name: 'r/smallbusiness', kind: 'reddit', template: 'reddit-comment' };
check('Reddit RSS (real response)', () => {
  const items = F.parseRedditRss(fs.readFileSync(path.join(FX, 'reddit-search.rss'), 'utf8'), rv);
  assert.ok(items.length >= 5);
  for (const it of items) { assert.ok(it.title && /^https:\/\/www\.reddit\.com\/r\//.test(it.url) && !isNaN(new Date(it.created))); assert.ok(!/<|&lt;/.test(it.body)); }
});
check('Reddit JSON (synthetic Listing): skips locked, archived and non-questions', () => {
  const raw = F.parseRedditJson(fs.readFileSync(path.join(FX, 'reddit-search.synthetic.json'), 'utf8'), rv);
  assert.strictEqual(raw.length, 4);
  const shaped = F.shape(raw, rv, ['merge pdf', 'combine pdf'], T.record('/pdf/merge-pdf/'), 'reddit', { keepOld: true });
  assert.strictEqual(shaped.length, 1);
  assert.strictEqual(shaped[0].title, 'How do I combine three PDFs into one without Adobe?');
  assert.ok(shaped[0].matchScore > 50 && shaped[0].suggestedTemplate === 'reddit-comment');
});
check('HN Algolia (real response)', () => {
  const items = F.parseHn(fs.readFileSync(path.join(FX, 'hn-search-by-date.json'), 'utf8'), { id: 'launch-hacker-news', kind: 'launch' });
  assert.ok(items.length >= 5 && items.every((i) => /^https:\/\/news\.ycombinator\.com\/item\?id=\d+$/.test(i.url)));
});
check('Stack Exchange (real response)', () => {
  const items = F.parseSe(fs.readFileSync(path.join(FX, 'se-search-advanced.json'), 'utf8'), { id: 'qa-stackexchange-superuser', kind: 'qa' });
  assert.ok(items.length >= 5 && items.every((i) => /^https:\/\/superuser\.com\/questions\//.test(i.url) && typeof i.score === 'number'));
  assert.ok(!items.some((i) => /&#39;|&quot;/.test(i.title)));
});
check('shape(): drops old threads and own accounts; sorts are stable', () => {
  const items = F.parseSe(fs.readFileSync(path.join(FX, 'se-search-advanced.json'), 'utf8'), { id: 'qa', kind: 'qa' });
  assert.strictEqual(F.shape(items, { id: 'qa', kind: 'qa' }, ['merge pdf'], null, 'se', { now: '2030-01-01' }).length, 0);
});
check('API URLs follow the brief', () => {
  assert.strictEqual(F.apiUrl(V.get('reddit-r-smallbusiness'), 'merge pdf'), 'https://www.reddit.com/r/smallbusiness/search.json?q=merge%20pdf&restrict_sr=1&sort=new&t=month');
  assert.strictEqual(F.apiUrl(V.get('launch-hacker-news'), 'pdf'), 'https://hn.algolia.com/api/v1/search_by_date?query=pdf&tags=story');
  assert.strictEqual(F.apiUrl(V.get('qa-stackexchange-superuser'), 'merge pdf'), 'https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=creation&q=merge%20pdf&site=superuser&accepted=False');
});
check('polite User-Agent', () => assert.strictEqual(F.UA, process.env.PROMO_UA || '1234Tools-promo-desk/1.0 (contact@xleshop.com)'));
check('isQuestion', () => { assert.ok(F.isQuestion('How do I merge PDFs')); assert.ok(F.isQuestion('Anyone know a payroll tool?')); assert.ok(!F.isQuestion('I launched my bakery')); });

/* --------------------------------------------------------------- lint */
section('lint');
const bad = [
  ['100% private and secure', {}], ['No tracking at all.', {}], ['We make no third-party requests.', {}], ['Nothing is sent anywhere.', {}],
  ['The best free PDF tool.', {}], ['Unlimited conversions.', {}], ['Only 3 spots left, hurry!', {}], ['Trusted by 5,000 users.', {}],
  ['A friend sent me this.', {}], ['Smallpdf is overpriced, use this.', {}], ['Free AI invoice reader.', { pricing: 'freemium' }],
  ['Runs offline on your device.', { pricing: 'freemium' }], ['Free, no account, no watermark.', { section: 'business' }],
  ['https://www.1234tools.com/pdf/merge-pdf/ check it out', { requireDisclosure: true }],
];
for (const [t, ctx] of bad) check('flags: ' + t, () => assert.ok(!lint(t, ctx).ok));
const good = [
  ['Runs in your browser — nothing you type is uploaded.', {}],
  ['Nothing contacts a third party on page load; analytics only after you opt in.', {}],
  ['Free for 10 runs a month; your text goes to the model provider.', { pricing: 'freemium' }],
  ['Tip: combine pdf works best when files are numbered.', {}],
];
for (const [t, ctx] of good) check('allows: ' + t, () => assert.ok(lint(t, ctx).ok, JSON.stringify(lint(t, ctx).errors)));
check('X counts a URL as 23', () => assert.strictEqual(lint('a https://www.1234tools.com/pdf/merge-pdf/?utm_source=x', { countMode: 'x' }).count, 25));

/* ------------------------------------------------------------- store */
section('store: saved opportunities and drafts');
const ST = require('./store');
const oppA = { url: 'https://news.ycombinator.com/item?id=1', title: 'How do I merge PDFs offline?', venueId: 'launch-hacker-news', matchScore: 80, created: '2026-10-01T10:00:00Z', suggestedTemplate: 'hn-comment' };
const oppB = { url: 'https://superuser.com/q/2', title: 'Merge two PDFs without uploading', venueId: 'qa-stackexchange-superuser', matchScore: 70, created: '2026-10-02T10:00:00Z', suggestedTemplate: 'stackexchange-answer' };
check('merge saves new opportunities as "new"', () => {
  const out = ST.mergeOpps([oppA, oppB], { tool: '/pdf/merge-pdf/' });
  assert.strictEqual(out.length, 2);
  assert.ok(out.every((x) => x.status === 'new' && x.firstSeen && x.query.tool === '/pdf/merge-pdf/'));
  assert.ok(fs.existsSync(path.join(TMP, 'opportunities.json')));
});
check('a status survives the same question turning up again', () => {
  ST.setOppStatus(oppA.url, 'dismissed');
  const again = ST.mergeOpps([Object.assign({}, oppA, { matchScore: 90 })], { tool: '/pdf/merge-pdf/' });
  assert.strictEqual(again[0].status, 'dismissed');
  assert.strictEqual(again[0].matchScore, 90);
});
check('list filters by status and counts every status', () => {
  const r = ST.listOpps({ status: 'new' });
  assert.deepStrictEqual(r.items.map((x) => x.url), [oppB.url]);
  assert.strictEqual(r.counts.all, 2); assert.strictEqual(r.counts.dismissed, 1);
});
check('an unknown status is refused', () => assert.throws(() => ST.setOppStatus(oppB.url, 'maybe')));
check('drafts save, reload and delete by tool + venue + template + variant', () => {
  const id = { tool: '/pdf/merge-pdf/', venue: 'launch-hacker-news', template: 'hn-comment', variant: 1, qurl: oppA.url };
  ST.saveDraft(id, { body: 'My edited reply' });
  assert.strictEqual(ST.getDraft(id).parts.body, 'My edited reply');
  assert.strictEqual(ST.getDraft(Object.assign({}, id, { variant: 2 })), null);
  ST.saveDraft(id, {});
  assert.strictEqual(ST.getDraft(id), null);
});
check('a corrupt store file is treated as empty, not as a crash', () => {
  fs.writeFileSync(path.join(TMP, 'drafts.json'), '{oops');
  assert.deepStrictEqual(ST.listDrafts(), []);
});

section('calendar: the 90-day short-video plan');
const CAL = require('./calendar');
check('a plan has about 1-2 videos a day for 90 days, in all five formats', () => {
  const c = CAL.plan('2026-10-05');
  assert.ok(c.items.length >= 100 && c.items.length <= 140, 'items ' + c.items.length);
  const formats = new Set(c.items.map((x) => x.format));
  for (const f of ['problem', 'before', 'dev', 'india', 'ai']) assert.ok(formats.has(f), 'missing ' + f);
});
check('no tool repeats within 21 days', () => {
  const seen = {};
  for (const it of CAL.get().items) {
    const d = new Date(it.date);
    if (seen[it.tool]) assert.ok((d - seen[it.tool]) / 864e5 >= 21, it.tool + ' on ' + it.date);
    seen[it.tool] = d;
  }
});
check('AI tools only in the AI format, and every slot has a hook and a Reel Maker link', () => {
  for (const it of CAL.get().items) {
    if (it.tool.indexOf('/ai/') === 0) assert.strictEqual(it.format, 'ai');
    assert.ok(it.hook && it.reel.indexOf('/ai-video/reel-maker/?tool=') > 0, it.id);
  }
});
check('re-planning keeps what was made or posted', () => {
  const first = CAL.get().items[0];
  CAL.setStatus(first.id, 'posted', 'https://www.instagram.com/p/example/');
  const again = CAL.plan('2026-10-05').items.find((x) => x.id === first.id);
  assert.strictEqual(again.status, 'posted');
  assert.strictEqual(again.postedUrl, 'https://www.instagram.com/p/example/');
});
check('the CSV has a header and a row per slot', () => {
  const lines = CAL.csv().trim().split('\r\n');
  assert.strictEqual(lines.length, CAL.get().items.length + 1);
  assert.ok(/^"Date","Format","Tool"/.test(lines[0]));
});
check('the slot-level Posted link went to the target it matches (an /p/ link is the Instagram feed carousel)', () => {
  const first = CAL.get().items[0];
  const t = first.targets.find((x) => x.channel === 'instagram-carousel');
  assert.ok(t && t.state === 'posted' && t.url === 'https://www.instagram.com/p/example/', JSON.stringify(first.targets));
});

/* ------------------------------------------------- channels and guide */
section('channels: specs, sources and link rules');
const CH = require('./channels');
const G = require('./guide');
const WANT = ['instagram-reel', 'instagram-carousel', 'instagram-story', 'facebook-reel', 'facebook-post', 'youtube-shorts', 'tiktok', 'pinterest-video', 'pinterest-image',
  'linkedin-post', 'linkedin-document', 'x', 'threads', 'bluesky', 'mastodon', 'whatsapp-status', 'whatsapp-channel', 'telegram'];
check('every channel the brief names has a card', () => assert.deepStrictEqual(WANT.filter((id) => !CH.get(id)), []));
check('every spec is a sourced value with a check date, or null ("not confirmed")', () => {
  for (const c of CH.list()) {
    assert.ok(c.specs.length >= 5, c.id + ' has few specs');
    for (const sp of c.specs) {
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(sp.checked), c.id + ' ' + sp.label + ' check date');
      if (sp.value != null) assert.ok(/^https:\/\//.test(sp.src), c.id + ' ' + sp.label + ' has a value but no source');
    }
    for (const k of ['summary', 'template', 'upload', 'steps', 'redLines']) assert.ok(c[k] && c[k].length, c.id + ' ' + k);
    assert.ok(require('./templates').META[c.template], c.id + ' template ' + c.template);
    if (c.venue) assert.ok(V.get(c.venue), c.id + ' venue ' + c.venue + ' is not in venues.json');
  }
});
check('the files a card asks for are the files kit.js and the Reel Maker make', () => {
  const kitSrc = fs.readFileSync(path.join(__dirname, 'kit.js'), 'utf8');
  for (const c of CH.list()) for (const u of c.upload) {
    for (const m of u.matchAll(/(?:^|[\s(])([a-z0-9][a-z0-9-]*\.(?:png|pdf))\b/g)) assert.ok(kitSrc.includes(m[1]), c.id + ': ' + m[1] + ' is not a kit file');
  }
  assert.ok(/carousel\.pdf/.test(CH.get('linkedin-document').upload.join(' ')));
  assert.ok(/story-1080x1920\.png/.test(CH.get('instagram-story').upload.join(' ')));
  assert.ok(/pin-1000x1500\.png/.test(CH.get('pinterest-image').upload.join(' ')));
});
let samples = 0;
for (const c of CH.list()) {
  check(c.id + ': valid links pass', () => {
    if (c.url.tickOnly) { assert.ok(c.tick && !c.linkShape, 'tick-only channel'); return; }
    assert.ok(c.samples.valid.length >= 1);
    for (const u of c.samples.valid) { samples++; const r = CH.check(c.id, u); assert.ok(r.ok, u + ' ' + JSON.stringify(r.issues)); }
  });
  check(c.id + ': a wrong-format link is flagged', () => {
    assert.ok(c.samples.wrongFormat.length >= 1);
    for (const u of c.samples.wrongFormat) { samples++; const r = CH.check(c.id, u); assert.ok(!r.ok && r.issues.some((x) => x.code === 'wrong-format' || x.code === 'no-link-channel'), u + ' ' + JSON.stringify(r.issues)); }
  });
  check(c.id + ': a wrong-platform link is flagged', () => {
    assert.ok(c.samples.wrongPlatform.length >= 1);
    for (const u of c.samples.wrongPlatform) { samples++; const r = CH.check(c.id, u); assert.ok(!r.ok && r.issues.some((x) => x.code === 'wrong-platform' || x.code === 'no-link-channel'), u + ' ' + JSON.stringify(r.issues)); }
  });
}
check('the brief\'s examples read as they should', () => {
  const r = CH.check('instagram-reel', 'https://www.instagram.com/p/C1a2B3c4D5e/');
  assert.ok(r.issues.some((x) => x.code === 'wrong-format' && /feed post/.test(x.msg) && /Reel/.test(x.msg)), JSON.stringify(r));
  assert.ok(CH.check('youtube-shorts', 'https://www.youtube.com/watch?v=aBcDeFgHiJk').issues.some((x) => x.code === 'wrong-format'));
  assert.strictEqual(CH.classify('https://www.pinterest.de/pin/123456789/').kind, 'pin');
  assert.strictEqual(CH.classify('https://www.threads.com/@you/post/C1a2B3c4D5e').kind, 'threads-post');
  assert.strictEqual(CH.classify('https://t.me/c/1234567/89').kind, 'tg-private-post');
});
check('a link that is not https is flagged; text that is not a link is refused', () => {
  assert.ok(CH.check('x', 'http://x.com/you/status/1712345678901234567').issues.some((x) => x.code === 'not-https'));
  assert.ok(CH.check('x', 'my post on x').issues.some((x) => x.code === 'not-a-link'));
});
check('short links are accepted with a note that the desk cannot see behind them', () => {
  const r = CH.check('tiktok', 'https://vm.tiktok.com/ZMabc123/');
  assert.ok(r.ok && r.issues.some((x) => x.level === 'warn'));
});

section('guide: vision, process, FAQ');
check('every guide string passes lint.js', () => {
  const errs = [];
  for (const x of G.allText()) { const r = lint(x.text, {}); if (!r.ok) errs.push(x.where + ': ' + r.errors.map((e) => e.rule + ' "' + e.match + '"').join(', ')); }
  assert.deepStrictEqual(errs, []);
});
check('at least 12 FAQ answers, the process covers missed days, removals and skips', () => {
  assert.ok(G.FAQ.length >= 12, 'faq ' + G.FAQ.length);
  const titles = G.PROCESS.cases.map((c) => c.title).join(' | ');
  assert.ok(/missed/.test(titles) && /removed/.test(titles) && /skipped/.test(titles), titles);
  for (const q of ['Can the desk post for me?', 'Why only one link per post?', 'Where is my data?', 'Does re-planning lose my records?']) assert.ok(G.FAQ.some((f) => f.q === q), q);
});
check('the CLI guide prints every channel and a single card', () => {
  const all = G.text();
  for (const c of CH.list()) assert.ok(all.includes(c.id), c.id);
  assert.ok(/instagram\.com\/reel/.test(G.text('instagram-reel')) && G.text('nope') === null);
});

section('calendar targets, verification, coverage and migration');
function withNow(at, fn) { process.env.PROMO_NOW = at; try { return fn(); } finally { delete process.env.PROMO_NOW; } }
const calFile = () => path.join(TMP, 'calendar.json');
const logCount = () => { try { return JSON.parse(fs.readFileSync(path.join(TMP, 'log.json'), 'utf8')).entries.length; } catch (e) { return 0; } };
check('every slot gets targets from its format; problem and India finance carry the carousel and the LinkedIn document', () => {
  fs.rmSync(calFile(), { force: true });
  const c = CAL.plan('2026-10-05');
  for (const it of c.items) assert.deepStrictEqual(it.targets.map((t) => t.channel), CAL.FORMATS[it.format].targets, it.id);
  assert.ok(CAL.FORMATS.problem.targets.includes('linkedin-document') && CAL.FORMATS.india.targets.includes('instagram-carousel'));
  assert.ok(CAL.get().items.every((it) => it.state === 'planned' && /^0 of \d channels$/.test(it.progress.label)));
});
const slot = () => CAL.get().items.find((x) => x.format === 'problem');
const NP = CAL.FORMATS.problem.targets.length;
const of = (n) => n + ' of ' + NP + ' channels';
check('a valid link counts: "1 of N channels", partly posted, and one log entry on the venue', () => {
  resetLog();
  const s0 = slot();
  const r = withNow('2026-10-05T18:00:00', () => CAL.target(s0.id, 'instagram-reel', 'post', { url: 'https://www.instagram.com/reel/C1a2B3c4D5e/' }));
  assert.strictEqual(r.item.progress.label, of(1));
  assert.strictEqual(r.item.state, 'partly');
  assert.ok(r.logged && r.logged.venueId === 'social-instagram' && r.logged.toolPath === s0.tool && r.logged.kind === 'post' && r.logged.channel === 'instagram-reel', JSON.stringify(r.logged));
  assert.strictEqual(logCount(), 1);
});
check('cadence split: a Reel is a profile-link post (no linked cap, no routine cap); a LinkedIn post still counts', () => {
  const e = JSON.parse(fs.readFileSync(path.join(TMP, 'log.json'), 'utf8')).entries[0];
  assert.ok(e.linked === false && e.profileLink === true, JSON.stringify(e));
  // Monday's routine cap is 1 linked post: the Reel does not use it
  assert.ok(!L.canPost('social-x', { now: new Date('2026-10-05T18:30:00') }).reasons.some((x) => /Monday cap/.test(x)), 'reel used the Monday cap');
  const s0 = slot();
  const li = withNow('2026-10-05T18:40:00', () => CAL.target(s0.id, 'linkedin-document', 'post', { url: 'https://www.linkedin.com/feed/update/urn:li:activity:7101234567890123499/' }));
  assert.ok(li.logged.linked === true && !li.logged.profileLink);
  assert.ok(L.canPost('social-x', { now: new Date('2026-10-05T18:50:00') }).reasons.some((x) => /Monday cap/.test(x)), 'the LinkedIn post uses the Monday cap');
  CAL.target(s0.id, 'linkedin-document', 'clear');
  for (const id of ['instagram-reel', 'instagram-carousel', 'tiktok', 'youtube-shorts', 'facebook-reel']) assert.strictEqual(CH.get(id).linkInPost, false, id);
  for (const id of ['linkedin-post', 'x', 'facebook-post', 'threads', 'bluesky', 'mastodon', 'telegram', 'whatsapp-channel', 'pinterest-image']) assert.strictEqual(CH.get(id).linkInPost, true, id);
});
check('advice, not a block: a third Reel in a day is noted on today\'s slot', () => {
  resetLog(['a', 'b'].map((x, i) => ({ at: iso(new Date('2026-10-07T08:00:00').getTime() + i * 60000), venueId: 'social-instagram', kind: 'post', linked: false, profileLink: true, channel: 'instagram-reel', toolPath: '/' + x + '/' })));
  const c = withNow('2026-10-07T12:00:00', () => CAL.coverage({ days: 1 }));
  const m = c.todaySlots.flatMap((s) => s.missing).find((x) => x.channel === 'instagram-reel');
  if (m) assert.ok(m.advice && m.advice.over && /advice/.test(m.advice.text) && !m.cadence, JSON.stringify(m));
  const card = CH.cards().find((x) => x.id === 'instagram-reel');
  assert.ok(/profile-link post/.test(card.cadence) && /at most 2 Reels a day/.test(card.cadence), card.cadence);
  resetLog();
});
check('clearing and recording again does not log twice', () => {
  const s0 = slot();
  CAL.target(s0.id, 'instagram-reel', 'clear');
  const before = logCount();
  const r = withNow('2026-10-05T18:05:00', () => CAL.target(s0.id, 'instagram-reel', 'post', { url: 'https://www.instagram.com/reel/C1a2B3c4D5e/' }));
  assert.ok(!r.logged && logCount() === before);
});
check('a wrong-format link is recorded but flagged and not counted, until the owner confirms it', () => {
  const s0 = slot();
  const r = withNow('2026-10-05T18:10:00', () => CAL.target(s0.id, 'youtube-shorts', 'post', { url: 'https://www.youtube.com/watch?v=aBcDeFgHiJk' }));
  assert.ok(r.target.flagged && r.target.issues.some((x) => x.code === 'wrong-format'));
  assert.strictEqual(r.item.progress.label, of(1));
  const a = CAL.target(s0.id, 'youtube-shorts', 'accept');
  assert.ok(!a.target.flagged && a.target.done && a.item.progress.label === of(2));
});
check('the same link on two targets is flagged on both', () => {
  const s0 = slot();
  const r = withNow('2026-10-05T18:20:00', () => CAL.target(s0.id, 'instagram-carousel', 'post', { url: 'https://instagram.com/reel/C1a2B3c4D5e' }));
  assert.ok(r.target.issues.some((x) => x.code === 'wrong-format'));
  const it = CAL.get().items.find((x) => x.id === s0.id);
  assert.ok(it.targets.find((t) => t.channel === 'instagram-reel').issues.some((x) => x.code === 'duplicate'), 'reel row shows the duplicate');
  CAL.target(s0.id, 'instagram-carousel', 'clear');
});
check('a link recorded before the slot\'s date warns only', () => {
  const later = CAL.get().items.find((x) => x.date > '2026-10-10' && x.targets.some((t) => t.channel === 'youtube-shorts'));
  const r = withNow('2026-10-06T09:00:00', () => CAL.target(later.id, 'youtube-shorts', 'post', { url: 'https://youtube.com/shorts/zYxWvUtSrQp' }));
  assert.ok(r.target.done && r.target.issues.some((x) => x.code === 'early' && x.level === 'warn'));
});
check('a skip needs a reason; a tick only where a post has no link; WhatsApp Status is ticked and logged on its new venue', () => {
  const s0 = slot();
  assert.throws(() => CAL.target(s0.id, 'tiktok', 'skip', { reason: '  ' }), /reason/);
  assert.throws(() => CAL.target(s0.id, 'tiktok', 'post', { tick: true }), /link/);
  const india = CAL.get().items.find((x) => x.format === 'india');
  assert.throws(() => CAL.target(india.id, 'whatsapp-status', 'post', { url: 'https://wa.me/447700900123' }), /tick/);
  const before = logCount();
  const r = CAL.target(india.id, 'whatsapp-status', 'post', { tick: true, note: 'family and clients' });
  assert.ok(!r.noVenue && r.logged && r.logged.venueId === 'social-whatsapp-status' && logCount() === before + 1 && r.target.done, JSON.stringify(r.logged));
  const v = V.get('social-whatsapp-status');
  assert.ok(v && v.cadenceDays === 1 && V.isPostVenue(v));
});
check('every target posted or skipped with a reason makes the slot "posted"', () => {
  const s0 = slot();
  withNow('2026-10-05T19:00:00', () => {
    CAL.target(s0.id, 'tiktok', 'skip', { reason: 'cadence' });
    CAL.target(s0.id, 'facebook-reel', 'post', { url: 'https://www.facebook.com/reel/1234567890123499' });
    CAL.target(s0.id, 'instagram-carousel', 'post', { url: 'https://www.instagram.com/p/Zz9Yy8Xx7Ww/' });
  });
  let it = CAL.get().items.find((x) => x.id === s0.id);
  assert.strictEqual(it.progress.label, of(NP - 1));
  const r = withNow('2026-10-05T19:05:00', () => CAL.target(s0.id, 'linkedin-document', 'post', { url: 'https://www.linkedin.com/feed/update/urn:li:activity:7101234567890123456/' }));
  assert.strictEqual(r.item.state, 'posted');
  assert.strictEqual(r.item.progress.label, of(NP));
});
check('a channel can be added to a slot and removed again while unrecorded', () => {
  const s0 = slot();
  const r = CAL.target(s0.id, 'threads', 'add');
  assert.ok(r.item.targets.some((t) => t.channel === 'threads' && t.extra) && r.item.progress.total === NP + 1);
  const back = CAL.target(s0.id, 'threads', 'remove');
  assert.strictEqual(back.item.progress.total, NP);
  assert.throws(() => CAL.target(s0.id, 'tiktok', 'remove'), /skip/);
});
check('re-planning keeps every slot with a target record, untouched', () => {
  const before = CAL.get().items.filter((x) => x.targets.some((t) => t.state !== 'due')).map((x) => JSON.stringify(x.targets.map((t) => [t.channel, t.state, t.url || '', t.reason || ''])));
  CAL.plan('2026-10-05');
  const after = CAL.get().items.filter((x) => x.targets.some((t) => t.state !== 'due')).map((x) => JSON.stringify(x.targets.map((t) => [t.channel, t.state, t.url || '', t.reason || ''])));
  assert.deepStrictEqual(after, before);
  assert.ok(before.length >= 3);
  CAL.plan('2026-10-12');
  assert.ok(CAL.get().items.some((x) => x.date < '2026-10-12' && x.targets.some((t) => t.state !== 'due')), 'a recorded slot before the new start is kept');
  CAL.plan('2026-10-05');
});
check('coverage: missing targets, flagged links, per-channel counts and today\'s slots', () => {
  const s0 = slot();
  CAL.target(s0.id, 'linkedin-document', 'clear');
  withNow('2026-10-05T19:30:00', () => CAL.target(s0.id, 'linkedin-document', 'post', { url: 'https://www.linkedin.com/pulse/how-merge-pdfs/' }));
  const c = withNow('2026-10-07T12:00:00', () => CAL.coverage({ days: 14 }));
  assert.strictEqual(c.today, '2026-10-07');
  const tue = c.slots.find((x) => x.date === '2026-10-06');
  assert.ok(tue && tue.missing.length === tue.progress.total, JSON.stringify(tue));
  const mon = c.slots.find((x) => x.id === s0.id);
  assert.ok(mon.flagged.some((f) => f.channel === 'linkedin-document' && f.issues.some((i) => i.code === 'wrong-format')));
  const reel = c.channels.find((r) => r.id === 'instagram-reel');
  assert.ok(reel.week.posted >= 1 && reel.week.missed >= 1, JSON.stringify(reel));
  assert.ok(c.todaySlots.length >= 1 && c.todaySlots[0].missing.length >= 1);
  assert.deepStrictEqual(c.noVenue, [], 'every channel now has a venue');
  assert.ok(c.facebook && c.facebook.limit === 2, JSON.stringify(c.facebook));
  const txt = require('./desk').coverageText(c);
  assert.ok(/Per channel/.test(txt) && /CHECK LinkedIn document/.test(txt), txt.slice(0, 400));
});
check('migration: a v1 calendar loads with nothing lost', () => {
  const v1 = { v: 1, start: '2026-10-05', made: '2026-10-01T10:00:00.000Z', items: [
    { id: '2026-10-05:0', date: '2026-10-05', slot: 0, format: 'problem', formatLabel: 'Problem → solution', tool: '/pdf/merge-pdf/', title: 'Merge PDF Files', hook: 'h', pain: '', promise: '', beats: ['b'], platforms: ['Instagram Reels', 'YouTube Shorts', 'TikTok'], reel: 'r', status: 'posted', postedUrl: 'https://www.instagram.com/reel/C9z8Y7x6W5v/', note: 'went well', statusAt: '2026-10-05T20:00:00.000Z' },
    { id: '2026-10-06:0', date: '2026-10-06', slot: 0, format: 'before', formatLabel: 'Before / after', tool: '/image/image-compressor/', title: 'Image Compressor', hook: 'h', pain: '', promise: '', beats: ['b'], platforms: ['Instagram Reels', 'TikTok', 'Pinterest idea pin'], reel: 'r', status: 'posted', postedUrl: 'https://example.com/somewhere', note: '', statusAt: '2026-10-06T20:00:00.000Z' },
    { id: '2026-10-07:0', date: '2026-10-07', slot: 0, format: 'india', formatLabel: 'India finance', tool: '/india/gst-calculator/', title: 'GST', hook: 'h', pain: '', promise: '', beats: ['b'], platforms: ['Instagram Reels'], reel: 'r', status: 'made', postedUrl: '', note: 'draft ready' }
  ] };
  fs.writeFileSync(calFile(), JSON.stringify(v1));
  const before = logCount();
  const c = CAL.get();
  assert.strictEqual(c.v, 2);
  const a = c.items.find((x) => x.id === '2026-10-05:0');
  const t = a.targets.find((x) => x.channel === 'instagram-reel');
  assert.ok(t.state === 'posted' && t.url === v1.items[0].postedUrl && t.migrated && a.postedUrl === v1.items[0].postedUrl && a.note === 'went well' && a.status === 'posted');
  assert.strictEqual(a.state, 'partly');
  const b = c.items.find((x) => x.id === '2026-10-06:0');
  assert.ok(b.unassigned.length === 1 && b.unassigned[0].url === 'https://example.com/somewhere' && b.targets.every((x) => x.state === 'due'));
  assert.deepStrictEqual(b.platformsV1, v1.items[1].platforms);
  assert.ok(c.items.find((x) => x.id === '2026-10-07:0').status === 'made');
  assert.strictEqual(logCount(), before, 'migration writes no log entries');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(TMP, 'calendar.v1.json'), 'utf8')), v1);
  assert.strictEqual(JSON.parse(fs.readFileSync(calFile(), 'utf8')).v, 2);
  assert.ok(!fs.readdirSync(TMP).some((f) => /\.tmp$/.test(f)), 'atomic writes leave no temp file');
  const cov = withNow('2026-10-07T12:00:00', () => CAL.coverage({ days: 7 }));
  assert.ok(cov.slots.find((x) => x.id === '2026-10-06:0').unassigned.length === 1);
});

/* ------------------------------------------------- Facebook link budget */
section('Facebook Page link-post budget');
check('2 a month by default; a third linked Page post waits, a native post does not count', () => {
  resetLog([0, 1].map((i) => ({ at: iso(new Date('2026-10-02T10:00:00').getTime() + i * DAY), venueId: 'social-facebook', toolPath: '/t' + i + '/', kind: 'post', linked: true })));
  const b = L.fbBudget(new Date('2026-10-20T10:00:00'));
  assert.ok(b.used === 2 && b.limit === 2 && b.label === '2 of 2 used this month', JSON.stringify(b));
  const c = L.canPost('social-facebook', { now: new Date('2026-10-20T10:00:00') });
  assert.ok(!c.ok && c.reasons.some((r) => /Facebook link budget/.test(r)) && c.nextAt.slice(0, 7) >= '2026-10', JSON.stringify(c));
  assert.ok(!L.canPost('social-facebook', { now: new Date('2026-10-20T10:00:00'), linked: false }).reasons.some((r) => /budget/.test(r)), 'a native post is never held by the budget');
  assert.strictEqual(L.fbBudget(new Date('2026-11-03T10:00:00')).used, 0, 'a new month starts at 0');
});
check('the budget is configurable in config.json and shown on the Facebook cards', () => {
  fs.writeFileSync(path.join(TMP, 'config.json'), JSON.stringify({ facebook: { linkPostsPerMonth: 4 } }));
  assert.strictEqual(L.fbBudget(new Date('2026-10-20T10:00:00')).limit, 4);
  assert.ok(L.canPost('social-facebook', { now: new Date('2026-10-20T10:00:00') }).warnings.some((w) => /2 of 4 used/.test(w)));
  const card = CH.cards().find((x) => x.id === 'facebook-post');
  assert.ok(card.budget && /used this month/.test(card.budget.label) && card.noLinkOption);
  fs.rmSync(path.join(TMP, 'config.json'));
  resetLog();
});
check('a Page post recorded with "no link" is native: logged without touching the budget', () => {
  fs.rmSync(calFile(), { force: true });
  CAL.plan('2026-10-05');
  const s0 = slot();
  CAL.target(s0.id, 'facebook-post', 'add');
  const r = withNow('2026-10-05T20:00:00', () => CAL.target(s0.id, 'facebook-post', 'post', { url: 'https://www.facebook.com/20531316728/posts/10154009990506799/', noLink: true }));
  assert.ok(r.logged.linked === false && r.logged.profileLink === true && r.target.noLink);
  assert.strictEqual(withNow('2026-10-06T10:00:00', () => L.fbBudget()).used, 0);
  assert.throws(() => CAL.target(s0.id, 'tiktok', 'post', { url: 'https://www.tiktok.com/@you/video/7301234567890123456', noLink: true }), /does not apply/);
  assert.ok(CAL.FORMATS.problem.targets.includes('facebook-reel') && CH.get('facebook-reel').linkInPost === false);
});
check('the Facebook guidance: native first, no Meta One push, reported figures labelled', () => {
  const fb = CH.get('facebook-post');
  const txt = fb.steps.join(' ') + ' ' + fb.specs.map((x) => x.label + ' ' + (x.value || '')).join(' ');
  assert.ok(/natively/.test(txt) && /first comment/.test(txt) && /link sticker/.test(txt) && /reported/i.test(txt));
  assert.ok(/Meta One/.test(txt) && !/\bbuy\b/i.test(fb.steps.join(' ')), 'never tells the owner to buy');
  const faq = G.FAQ.map((f) => f.q + ' ' + f.a).join(' ');
  assert.ok(/link budget/i.test(faq) && /profile-link/i.test(faq) && /other sites|every site|site picker/i.test(faq));
});

/* ---------------------------------------------------------- multi-site */
section('sites: profiles, isolation, rules, migration');
const SITE = require('./site');
const SHOPS = ['aarvik-dairy-products', 'dairyzest', 'gajanan-home-foods', 'kbk-dairy-products', 'kbk-mart', 'natural-cure-ayurveda', 'rap-club', 'sri-balaji-stores', 'southbasket'];
check('fourteen sites: 1234tools built in, four own sites with at least 10 items, nine XLeShop shops with at least 8', () => {
  const ids = SITE.list().map((s) => s.id).sort();
  assert.deepStrictEqual(ids, ['1234tools', 'attend-now', 'fixourtime', 'mvr-it', 'xleshop'].concat(SHOPS).sort());
  for (const s of SITE.list()) {
    if (s.id === '1234tools') continue;
    const p = SITE.get(s.id);
    assert.ok(!p.error, s.id + ' ' + p.error);
    assert.ok(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/.test(p.baseUrl) && !/example\.|localhost|todo/i.test(p.baseUrl), s.id + ' baseUrl ' + p.baseUrl);
    const shop = SHOPS.includes(s.id);
    /* a shop whose catalogue could not be confirmed may be a skeleton: then it must say so in its TODOs */
    const skeleton = shop && p.items.length < 8;
    if (skeleton) assert.ok((p.todo || []).some((t) => /TODO/.test(t)), s.id + ' is a skeleton without TODO markers');
    else assert.ok(p.items.length >= (shop ? 8 : 10), s.id + ' items ' + p.items.length);
    assert.ok(p.rules && Array.isArray(p.rules.forbid) && p.rules.forbid.length >= 1, s.id + ' forbid rules');
    for (const it of p.items) for (const k of ['id', 'path', 'title', 'hook', 'promise', 'cta', 'source']) assert.ok(it[k], s.id + ' ' + it.id + ' ' + k);
    assert.strictEqual(new Set(SITE.run(s.id, () => SITE.listItems().map((x) => x.path))).size, p.items.length, s.id + ' item keys are unique');
    SITE.run(s.id, () => { for (const r of SITE.listItems()) assert.ok(r.url.startsWith(p.baseUrl + '/') && SITE.record(r.path).slug === r.slug, s.id + ' ' + r.path); });
  }
});
check('1234Tools keeps its data where it was; another site writes under sites/<id>/ only', () => {
  resetLog();
  L.append({ venueId: 'social-x', toolPath: '/pdf/merge-pdf/', kind: 'post', url: 'https://x.com/a/status/1' });
  SITE.run('xleshop', () => {
    assert.strictEqual(L.home(), path.join(TMP, 'sites', 'xleshop'));
    assert.strictEqual(L.entries().length, 0, 'xleshop sees none of the 1234Tools log');
    L.append({ venueId: 'social-x', toolPath: '/features.html#storefront', kind: 'post', url: 'https://x.com/b/status/2' });
    CAL.plan('2026-10-05');
    require('./store').saveDraft({ tool: '/features.html#storefront', venue: 'social-x', template: 'x-post', variant: 0 }, { text: 'xle draft' });
  });
  assert.strictEqual(L.home(), TMP);
  assert.strictEqual(L.entries().length, 1, '1234Tools sees only its own entry');
  assert.ok(fs.existsSync(path.join(TMP, 'log.json')) && fs.existsSync(path.join(TMP, 'calendar.json')));
  for (const f of ['log.json', 'calendar.json', 'drafts.json']) assert.ok(fs.existsSync(path.join(TMP, 'sites', 'xleshop', f)), 'xleshop ' + f);
  assert.ok(CAL.get().items.every((x) => x.tool.startsWith('/') && !/features\.html/.test(x.tool)), '1234Tools calendar untouched');
  assert.strictEqual(require('./store').getDraft({ tool: '/features.html#storefront', venue: 'social-x', template: 'x-post', variant: 0 }), null);
});
check('a site calendar: three slots a week, the profile\'s items and stories, its own targets', () => {
  SITE.run('mvr-it', () => {
    const c = CAL.plan('2026-10-05');
    const items = new Set(SITE.listItems().map((x) => x.path));
    assert.ok(c.items.length >= 36 && c.items.length <= 42, 'slots ' + c.items.length);
    assert.ok(c.items.every((x) => items.has(x.tool) && new Date(x.date + 'T12:00:00').getDay() % 2 === 1), 'Mon/Wed/Fri, own items');
    assert.ok(c.items.every((x) => x.targets.map((t) => t.channel).join() === 'instagram-reel,facebook-reel,youtube-shorts,linkedin-post,instagram-carousel'));
    assert.ok(/reel-maker\/$/.test(c.items[0].reel) && !/tool=/.test(c.items[0].reel), 'the plain Reel Maker, no 1234Tools tool');
    assert.ok(c.items[0].hook === SITE.record(c.items[0].tool).story.hook);
  });
});
check('site copy: every template renders lint-clean for every item of every site, with the site\'s own link', () => {
  let n = 0;
  const bad = [];
  for (const s of SITE.list()) {
    if (s.id === '1234tools') continue;
    SITE.run(s.id, () => {
      for (const r of T.listTools()) for (const id of TPL.TEMPLATE_IDS) {
        n++;
        const d = TPL.render(id, r, { variant: n % 3 });
        if (!d.ok) bad.push(s.id + ' ' + r.slug + ' ' + id + ' ' + d.errors.map((e) => e.rule + ':' + e.match).join(','));
        for (const p of d.parts) if (p.limit && p.chars > p.limit) bad.push(s.id + ' ' + id + ' over ' + p.key);
        if (/1234tools/i.test(d.text)) bad.push(s.id + ' ' + id + ' mentions 1234Tools');
      }
    });
  }
  assert.ok(n > 2000, 'renders ' + n);
  assert.deepStrictEqual(bad.slice(0, 5), []);
  SITE.run('xleshop', () => {
    const d = TPL.render('x-post', T.listTools()[0], { venue: V.get('social-x') });
    assert.ok(d.utmUrl.startsWith('https://xleshop.com/') && /utm_source=social-x/.test(d.utmUrl), d.utmUrl);
  });
});
check('claim rules are per site: a shop is not "free", 1234Tools claims are refused, the site\'s own rules apply', () => {
  SITE.run('xleshop', () => {
    assert.ok(lint('Your store, free for a month.').errors.some((e) => e.rule === 'site-free' || e.rule === 'no-free-trial'));
    assert.ok(lint('Catalogue migration and domain set-up are free on every plan.').ok, 'a stated free thing is fine');
    assert.ok(lint('Runs in your browser, nothing you type is uploaded.').errors.some((e) => e.rule === 'site-claim'));
    assert.ok(!lint('The best app for your shop, trusted by thousands.').ok, 'the common honesty rules still apply');
  });
  SITE.run('fixourtime', () => {
    assert.ok(lint('Free plan: create your free link.').ok, 'FixOurTime has a free plan');
    assert.ok(lint('Customers book with no account.').ok, 'the site states customers need no account');
  });
  assert.ok(lint('Free, runs in your browser — nothing you type is uploaded.').ok, '1234Tools rules are unchanged');
});
check('kits for another site: the profile\'s story, no live capture, a palette near the brand colour, the site\'s host', () => {
  const K = require('./kit');
  const P = require('./kit-templates/parts');
  SITE.run('attend-now', () => {
    assert.ok(/^attend-now\.com\//.test(P.cleanHost('/about.html#x')), P.cleanHost('/about.html#x'));
    assert.strictEqual(P.brandName(), 'Attend Now');
    assert.ok(/<img|<svg/.test(P.brandLogo()));
  });
  assert.strictEqual(P.cleanHost('/pdf/merge-pdf/'), '1234tools.com/pdf/merge-pdf/');
  assert.strictEqual(P.brandName(), '1234Tools');
  assert.ok(typeof K.kit === 'function');
});

/* ------------------------------------------------------ the XLeShop shops */
section('XLeShop shops: profiles, real domains, health-claim rules, calendar, isolation');
check('every shop: kind shop, grouped "XLeShop shops", its own domain (matching its brand-config.js when the workspace is here), unique names and keys', () => {
  const names = new Set();
  const hosts = new Set();
  for (const id of SHOPS) {
    const p = SITE.get(id);
    assert.ok(p && p.kind === 'shop' && p.promotes === 'products' && p.platform === 'xleshop', id + ' kind');
    assert.strictEqual(SITE.list().find((s) => s.id === id).group, 'XLeShop shops');
    assert.ok(!names.has(p.name) && !hosts.has(p.baseUrl), id + ' name and domain are its own');
    names.add(p.name); hosts.add(p.baseUrl);
    assert.ok(p.domainSource && p.repo && /XLeShop/.test(p.repo), id + ' domain source and repo');
    assert.ok(p.checked === '2026-10-05', id + ' checked');
    assert.ok(Array.isArray(p.calendarTargets) && p.disclosure && /Disclosure/.test(p.disclosure.line), id + ' targets and disclosure');
    for (const it of p.items) assert.ok(it.source && it.facts && it.facts.length >= 1, id + ' ' + it.id + ' has its source and facts');
    const cfg = path.join(p.repo, 'public', 'brand-config.js');
    if (fs.existsSync(cfg)) {
      const m = fs.readFileSync(cfg, 'utf8').match(/\bdomain:\s*["']([^"']+)["']/);
      if (m) assert.strictEqual(new URL(p.baseUrl).hostname.replace(/^www\./, ''), m[1].replace(/^www\./, ''), id + ' baseUrl matches brand-config.js domain');
    }
    if (p.logo && /^[A-Z]:\//.test(p.logo) && fs.existsSync(p.repo)) assert.ok(fs.existsSync(p.logo), id + ' logo file ' + p.logo);
  }
  assert.strictEqual(SITE.list().filter((s) => s.group === 'XLeShop shops').length, 9);
  assert.deepStrictEqual(SITE.list().slice(0, 5).map((s) => s.group), ['Sites', 'Sites', 'Sites', 'Sites', 'Sites'], 'own sites first, then the shops');
});
check('Natural Cure Ayurveda refuses cure, disease, treatment and immunity copy; the shop name itself is fine', () => {
  SITE.run('natural-cure-ayurveda', () => {
    for (const bad of ['Our churna cures diabetes.', 'Ayurvedic medicine for joint pain.', 'Treats acidity naturally.', 'Boosts immunity this winter.', 'Relief from cough and cold.',
      'Controls blood pressure.', 'For arthritis and rheumatism.', 'Improves stamina and vigour.', 'Heals skin fast.', 'A remedy for piles.', 'No side effects, 100% herbal.', 'Doctor recommended.']) {
      const r = lint(bad);
      assert.ok(!r.ok && r.errors.some((e) => /^(health|ayurveda)-/.test(e.rule) || e.rule === 'shop-certified'), bad + ' ' + JSON.stringify(r.errors));
    }
    assert.ok(lint('Cures diabetes').errors.some((e) => e.rule === 'ayurveda-disease'), 'a Schedule disease is named');
    const name = SITE.current().name;
    assert.ok(lint(name + ' #NaturalCureAyurveda').ok, 'the shop name is not a claim: ' + JSON.stringify(lint(name).errors));
  });
});
check('food, grocery and dairy shops refuse health claims; dairy "pure" needs the shop\'s own word and is still owner-to-confirm', () => {
  const food = SHOPS.filter((id) => id !== 'rap-club' && id !== 'natural-cure-ayurveda');
  for (const id of food) SITE.run(id, () => {
    for (const bad of ['Cures diabetes.', 'Boosts immunity.', 'Medicine for a cold.', 'Good for digestion.', 'Lowers cholesterol.', 'Rich in protein.']) assert.ok(!lint(bad).ok, id + ': ' + bad);
    assert.ok(!lint('Order now, 20% off, rated 5 stars.').ok, id + ' offers and ratings');
    assert.ok(!lint('Same-day delivery guaranteed.').ok, id + ' delivery promise');
  });
  for (const id of SHOPS.filter((x) => SITE.get(x).rules.forbid.some((f) => /^dairy-/.test(f.rule)))) SITE.run(id, () => {
    assert.ok(!lint('100% pure milk.').ok, id + ' 100% pure');
    const pure = SITE.current().rules.forbid.find((f) => f.rule === 'dairy-pure');
    const r = lint('Pure and simple.');
    if (pure.level === 'warn') assert.ok(r.ok && r.warnings.some((w) => w.rule === 'dairy-pure' && /owner to confirm/i.test(w.msg)), id + ' evidenced pure warns');
    else assert.ok(!r.ok, id + ' unevidenced pure is refused');
  });
  SITE.run('rap-club', () => assert.ok(lint('A new shirt for the weekend.').ok && !lint('20% off this weekend.').ok, 'menswear: no health rules, common shop rules'));
});
check('a shop calendar: three slots a week to WhatsApp Status, Instagram Reel, a native Facebook post and Instagram feed; the Facebook post logs as no-link', () => {
  const id = SHOPS.find((x) => SITE.get(x).items.length >= 8);
  SITE.run(id, () => {
    const c = CAL.plan('2026-10-05');
    assert.ok(c.items.length >= 36 && c.items.length <= 42, 'slots ' + c.items.length);
    assert.ok(c.items.every((x) => x.targets.map((t) => t.channel).join() === 'whatsapp-status,instagram-reel,facebook-post,instagram-carousel'), 'shop targets');
    assert.ok(c.items.every((x) => x.targets.find((t) => t.channel === 'facebook-post').native === true), 'the Facebook post is native');
    assert.ok(/^Product story$/.test(c.items[0].formatLabel));
    const r = CAL.target(c.items[0].id, 'facebook-post', 'post', { url: 'https://www.facebook.com/20531316728/posts/10154009990506729/' });
    assert.ok(r.logged && r.logged.linked === false && r.logged.profileLink === true && r.target.noLink === true, JSON.stringify(r.logged));
    const r2 = CAL.target(c.items[1].id, 'facebook-post', 'post', { url: 'https://www.facebook.com/20531316728/posts/10154009990506730/', noLink: false });
    assert.ok(r2.logged && r2.logged.linked === true, 'unticking "no link" makes it a link post');
    assert.ok(fs.existsSync(path.join(TMP, 'sites', id, 'calendar.json')) && fs.existsSync(path.join(TMP, 'sites', id, 'log.json')));
  });
});
check('shops keep their data apart: one shop\'s log, drafts and calendar are invisible to another, to XLeShop and to 1234Tools', () => {
  const [a, b] = SHOPS.filter((x) => SITE.get(x).items.length >= 1).slice(0, 2);
  const before = L.entries().length;
  const xle = SITE.run('xleshop', () => L.entries().length);
  SITE.run(a, () => {
    const it = SITE.listItems()[0];
    L.append({ venueId: 'social-instagram', toolPath: it.path, kind: 'post', url: 'https://www.instagram.com/p/C1a2B3c4D5e/' });
    require('./store').saveDraft({ tool: it.path, venue: 'social-instagram', template: 'instagram-caption', variant: 0 }, { text: a + ' draft' });
    assert.strictEqual(L.home(), path.join(TMP, 'sites', a));
  });
  SITE.run(b, () => {
    assert.ok(L.entries().every((e) => !SITE.get(a).items.some((i) => i.key === e.toolPath) || SITE.get(b).items.some((i) => i.key === e.toolPath)), b + ' sees none of ' + a);
    assert.strictEqual(L.home(), path.join(TMP, 'sites', b));
  });
  assert.strictEqual(SITE.run('xleshop', () => L.entries().length), xle, 'XLeShop log unchanged');
  assert.strictEqual(L.entries().length, before, '1234Tools log unchanged');
  SITE.run(a, () => assert.ok(L.entries().some((e) => e.url === 'https://www.instagram.com/p/C1a2B3c4D5e/')));
});
check('venues: Google Business Profile is offered to shops only; shop copy discloses who posts', () => {
  const gbp = V.get('social-google-business-profile');
  assert.ok(gbp && gbp.siteKinds.includes('shop') && /support\.google\.com\/business/.test(gbp.rulesUrl), 'venue registered');
  const shop = SHOPS.find((x) => SITE.get(x).items.length >= 1);
  SITE.run(shop, () => {
    assert.ok(V.postVenues().some((v) => v.id === gbp.id));
    const d = TPL.render('facebook-group', T.listTools()[0], {});
    assert.ok(/Disclosure: I build and host the /.test(d.text) && !/I run /.test(d.text), d.text.slice(-200));
  });
  for (const id of ['1234tools', 'xleshop', 'mvr-it']) SITE.run(id, () => assert.ok(!V.postVenues().some((v) => v.id === gbp.id), id + ' has no Business Profile venue'));
});

/* the real thing: data written through one server process is there after
   it is killed and a new one is started on the same PROMO_HOME */
async function restartCheck() {
  const { spawn } = require('child_process');
  const http = require('http');
  /* a test port (8752-8759), which serve() accepts only with PROMO_TEST=1;
     refuse to run if something already answers there, so a stray desk with
     the owner's data is never written to */
  const port = +process.env.PROMO_TEST_PORT || 8753;
  const call = (p, body) => new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({ host: '127.0.0.1', port, path: p, method: body ? 'POST' : 'GET', headers: Object.assign({ Host: '127.0.0.1:' + port }, data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) }, (r) => {
      let s = ''; r.on('data', (c) => { s += c; }); r.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
  const start = () => new Promise((resolve) => {
    const c = spawn(process.execPath, [path.join(__dirname, 'desk.js'), 'serve', '--port', String(port)], { env: Object.assign({}, process.env, { PROMO_HOME: TMP, PROMO_TEST: '1' }), stdio: 'ignore' });
    const tryIt = (n) => call('/api/health').then(() => resolve(c)).catch(() => (n > 0 ? setTimeout(() => tryIt(n - 1), 200) : resolve(c)));
    setTimeout(() => tryIt(40), 300);
  });
  const stop = (c) => new Promise((resolve) => { c.once('exit', resolve); c.kill(); });
  let ok = false, why = '';
  try {
    const busy = await call('/api/health').then(() => true, () => false);
    if (busy) throw new Error('port ' + port + ' is already in use; set PROMO_TEST_PORT to a free port in 8752-8759');
    let srv = await start();
    const h = await call('/api/health');
    if (h.home !== TMP) { await stop(srv); throw new Error('the server on ' + port + ' is not ours (home ' + h.home + ')'); }
    await call('/api/opps', { url: oppB.url, status: 'answered' });
    await call('/api/drafts', { tool: '/pdf/merge-pdf/', venue: 'qa-stackexchange-superuser', template: 'stackexchange-answer', variant: 0, parts: { body: 'Kept across restarts' } });
    await stop(srv);
    srv = await start();
    const o = await call('/api/opps?status=answered');
    const d = await call('/api/drafts?tool=' + encodeURIComponent('/pdf/merge-pdf/') + '&venue=qa-stackexchange-superuser&template=stackexchange-answer&variant=0');
    await stop(srv);
    ok = o.items.length === 1 && o.items[0].url === oppB.url && d.draft && d.draft.parts.body === 'Kept across restarts';
    if (!ok) why = JSON.stringify({ o, d }).slice(0, 300);
    // per-site requests on a live server: ?site= and the header pick the site; an unknown one is refused
    if (ok) {
      srv = await start();
      const a = await call('/api/site?site=fixourtime');
      const b = await call('/api/tools?site=xleshop');
      const c = await call('/api/tools');
      const bad = await call('/api/tools?site=nope');
      const cov = await call('/api/calendar/coverage?site=attend-now');
      await stop(srv);
      const siteOk = a.site.id === 'fixourtime' && a.home === path.join(TMP, 'sites', 'fixourtime') && b.tools.every((t) => !t.path.startsWith('/pdf/')) && b.tools.length === SITE.get('xleshop').items.length
        && c.tools.length > 200 && /Unknown site/.test(bad.error) && cov.site === 'attend-now';
      if (siteOk) pass++; else { fail++; failures.push('server per site: ' + JSON.stringify({ a: a.site && a.site.id, home: a.home, b: b.tools && b.tools.length, c: c.tools && c.tools.length, bad, cov: cov.site }).slice(0, 300)); }
    }
  } catch (e) { why = e.message; }
  if (ok) pass++; else { fail++; failures.push('opportunities and drafts survive a server restart: ' + why); }
  // the CLI: --site on any command, and `sites`
  const run = (args) => require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'desk.js')].concat(args), { env: Object.assign({}, process.env, { PROMO_HOME: TMP }), encoding: 'utf8' });
  const s1 = run(['sites']);
  const s2 = run(['coverage', '--site', 'xleshop', '--days', '7']);
  const s3 = run(['venues', '--site', 'nope']);
  const s4 = run(['draft', '/features.html#storefront', 'social-x', '--site', 'xleshop']);
  const cliOk = s1.status === 0 && /xleshop/.test(s1.stdout) && /fixourtime/.test(s1.stdout) && s2.status === 0 && /Site: XLeShop/.test(s2.stdout)
    && s3.status === 2 && /Unknown site/.test(s3.stderr) && /xleshop\.com/.test(s4.stdout) && !/1234tools\.com/.test(s4.stdout);
  if (cliOk) pass++; else { fail++; failures.push('CLI --site: ' + JSON.stringify([s1.status, s2.status, s2.stdout.slice(0, 80), s3.status, s3.stderr.slice(0, 80), s4.status, s4.stdout.slice(0, 200), s4.stderr.slice(0, 200)])); }
}

/* ------------------------------------------------------------- report */
(async () => {
await restartCheck();
fs.rmSync(TMP, { recursive: true, force: true });
console.log('\n' + pass + ' passed, ' + fail + ' failed (' + renders + ' template renders, ' + samples + ' channel link samples)');
for (const f of failures) console.log('  FAIL ' + f);
process.exitCode = fail ? 1 : 0;
})();
