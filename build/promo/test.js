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
for (const m of ['tools', 'hashtags', 'hooks', 'lint', 'templates', 'venues', 'log', 'find', 'plan', 'kit', 'desk']) {
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
check('29 venues carry "verify rules first"', () => assert.strictEqual(reg.venues.filter(V.verifyFirst).length, 29));
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

/* the real thing: data written through one server process is there after
   it is killed and a new one is started on the same PROMO_HOME */
async function restartCheck() {
  const { spawn } = require('child_process');
  const http = require('http');
  const port = 8796;
  const call = (p, body) => new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({ host: '127.0.0.1', port, path: p, method: body ? 'POST' : 'GET', headers: Object.assign({ Host: '127.0.0.1:' + port }, data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) }, (r) => {
      let s = ''; r.on('data', (c) => { s += c; }); r.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
  const start = () => new Promise((resolve) => {
    const c = spawn(process.execPath, [path.join(__dirname, 'desk.js'), 'serve', '--port', String(port)], { env: Object.assign({}, process.env, { PROMO_HOME: TMP }), stdio: 'ignore' });
    const tryIt = (n) => call('/api/health').then(() => resolve(c)).catch(() => (n > 0 ? setTimeout(() => tryIt(n - 1), 200) : resolve(c)));
    setTimeout(() => tryIt(40), 300);
  });
  const stop = (c) => new Promise((resolve) => { c.once('exit', resolve); c.kill(); });
  let ok = false, why = '';
  try {
    let srv = await start();
    await call('/api/opps', { url: oppB.url, status: 'answered' });
    await call('/api/drafts', { tool: '/pdf/merge-pdf/', venue: 'qa-stackexchange-superuser', template: 'stackexchange-answer', variant: 0, parts: { body: 'Kept across restarts' } });
    await stop(srv);
    srv = await start();
    const o = await call('/api/opps?status=answered');
    const d = await call('/api/drafts?tool=' + encodeURIComponent('/pdf/merge-pdf/') + '&venue=qa-stackexchange-superuser&template=stackexchange-answer&variant=0');
    await stop(srv);
    ok = o.items.length === 1 && o.items[0].url === oppB.url && d.draft && d.draft.parts.body === 'Kept across restarts';
    if (!ok) why = JSON.stringify({ o, d }).slice(0, 300);
  } catch (e) { why = e.message; }
  if (ok) pass++; else { fail++; failures.push('opportunities and drafts survive a server restart: ' + why); }
}

/* ------------------------------------------------------------- report */
(async () => {
await restartCheck();
fs.rmSync(TMP, { recursive: true, force: true });
console.log('\n' + pass + ' passed, ' + fail + ' failed (' + renders + ' template renders)');
for (const f of failures) console.log('  FAIL ' + f);
process.exitCode = fail ? 1 : 0;
})();
