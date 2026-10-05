#!/usr/bin/env node
'use strict';
/**
 * 1234Tools Promotion Desk: CLI and local web app.
 *
 *   node build/promo/desk.js serve [--port 8797]     http://127.0.0.1:8797
 *   node build/promo/desk.js plan
 *   node build/promo/desk.js draft <toolPath> <venueId> [--template id] [--variant n] [--question "..."]
 *   node build/promo/desk.js find <toolPath|audience:slug>
 *   node build/promo/desk.js kit <toolPath> [--seed n] [--layout x] [--palette y] [--type z] [--copy 0-2] [--theme both]
 *   node build/promo/desk.js log [--venue id] | log add <venueId> <toolPath> [--kind post|help|removed] [--url u] [--template t]
 *   node build/promo/desk.js venues [--section s] [--audience a]
 *   node build/promo/desk.js lint "<text>" [--ai] [--section s]
 *   node build/promo/desk.js guide [channel]                 vision, process, FAQ; or one channel's card
 *   node build/promo/desk.js coverage [--days 14]            which calendar targets are posted, missing or need a check
 *   node build/promo/desk.js sites                           the site profiles (1234tools, xleshop, mvr-it, attend-now, fixourtime)
 *
 * Every command takes --site <id> (default 1234tools): each site has its own items,
 * claim rules, log, calendar, drafts and kits (PROMO_HOME/sites/<id>/; 1234Tools
 * keeps PROMO_HOME itself). Kits for other sites use the profile's stories.
 *
 * A human publishes every post. This server binds 127.0.0.1 only, never logs in
 * anywhere, never submits a form and never calls a posting API: "Open composer"
 * opens a prefilled page in the owner's own browser and stops there.
 * Inert on require(); the CLI runs only when this file is invoked directly.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const T = require('./tools');
const TPL = require('./templates');
const V = require('./venues');
const L = require('./log');
const { lint } = require('./lint');
const SITE = require('./site');

const UI_DIR = path.join(__dirname, 'ui');
const PORTS = [8796, 8797, 8798, 8799];
/* The tests' own range, accepted only when PROMO_TEST=1 (test.js sets it with a temporary PROMO_HOME). */
const TEST_PORTS = [8752, 8753, 8754, 8755, 8756, 8757, 8758, 8759];
const REEL_MAKER = 'https://www.1234tools.com/ai-video/reel-maker/';

/* ------------------------------------------------------------- helpers */

function lightTool(r) {
  return { path: r.path, title: r.title, section: r.section, sectionName: r.sectionName, glyph: r.glyph, io: r.io, verb: r.verb, pricing: r.pricing, keywords: r.keywords, audiences: r.audiences };
}

function questionFrom(q) {
  if (!q || !q.question) return null;
  return { title: String(q.question).slice(0, 300), url: q.qurl ? String(q.qurl) : '' };
}

/** Everything the Draft tab needs for one (tool, venue, template, variant). */
function draft(params) {
  const rec = T.record(params.tool);
  const venue = params.venue ? V.get(params.venue) : null;
  if (params.venue && !venue) throw new Error('Unknown venue: ' + params.venue);
  const templates = venue ? V.templatesFor(venue) : TPL.TEMPLATE_IDS.slice();
  const template = params.template && TPL.META[params.template] ? params.template : (templates[0] || 'x-post');
  const variant = parseInt(params.variant, 10) || 0;
  const question = questionFrom(params);
  const result = params.result ? { summary: String(params.result).slice(0, 200) } : null;
  const d = TPL.render(template, rec, { venue, variant, question, result, angle: params.angle || undefined });
  const titlePart = d.parts.find((p) => p.key === 'title');
  const comp = V.composerForDraft(venue, d, titlePart ? titlePart.text : rec.title);
  const answerType = !!TPL.META[template].answer;
  const status = venue ? L.canPost(venue.id, { venue, toolPath: rec.path, template, text: d.text, thread: question && question.url }) : { ok: true, reasons: [], warnings: [] };
  return {
    tool: lightTool(rec), record: { relatedGuides: rec.relatedGuides, relatedCompare: rec.relatedCompare, audiences: rec.audiences },
    venue: venue ? Object.assign({}, venue, { templates, submitUrl: V.submitOf(venue), verifyFirst: V.verifyFirst(venue), autoSuggest: V.autoSuggest(venue) }) : null,
    template, templates: venue ? templates : TPL.TEMPLATE_IDS, allTemplates: TPL.TEMPLATE_IDS.map((id) => ({ id, label: TPL.META[id].label })),
    variant, draft: d,
    composerUrl: answerType ? '' : comp.url,
    threadUrl: question && question.url ? question.url : '',
    composerNote: answerType && venue && venue.submitUrl ? 'Replies are written in the thread itself: open the thread, paste, read, post.' : comp.note,
    status, redLines: V.redLinesFor(venue),
  };
}

/* Whether the Reel Maker is live yet. The buttons used to link to it
   unconditionally and landed on the 404 page before it shipped. One HEAD
   request to the public page, remembered for ten minutes; offline counts
   as "do not know", which leaves the buttons usable. */
let reelLive = { at: 0, ok: null };
function reelMakerLive() {
  if (Date.now() - reelLive.at < 600000 && reelLive.ok !== null) return Promise.resolve(reelLive.ok);
  return new Promise((resolve) => {
    const req = require('https').request(REEL_MAKER, { method: 'HEAD', timeout: 6000, headers: { 'User-Agent': '1234Tools-promo-desk/1.0' } }, (res) => {
      res.resume();
      reelLive = { at: Date.now(), ok: res.statusCode >= 200 && res.statusCode < 400 };
      resolve(reelLive.ok);
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function reels() {
  if (!SITE.isDefault()) {
    // the Reel Maker writes its script from a 1234Tools tool page; another site uses it with its own text
    return { available: true, live: null, base: REEL_MAKER, sections: [],
      note: 'The Reel Maker\'s ready-made scripts come from 1234Tools tool pages. For ' + SITE.current().name + ', open ' + REEL_MAKER + ' and paste the beats from the calendar slot (Calendar tab, "Beats for the Reel").' };
  }
  const bySection = {};
  for (const r of T.listTools()) {
    if (!bySection[r.section]) bySection[r.section] = { section: r.section, name: r.sectionName, tools: [] };
    if (bySection[r.section].tools.length < 5) bySection[r.section].tools.push(Object.assign(lightTool(r), { reelUrl: REEL_MAKER + '?tool=' + encodeURIComponent(r.path) }));
  }
  const live = await reelMakerLive();
  const note = live === true ? 'The Reel Maker is live. Each button opens it with the tool chosen and the script written; adjust, export, post.'
    : live === false ? 'The Reel Maker is not live on the site yet, so these buttons are switched off. They come on by themselves once it is deployed.'
    : 'Could not check whether the Reel Maker is live (offline?). The buttons are left on; a 404 means it has not been deployed yet.';
  return { available: live !== false, live, note, base: REEL_MAKER, sections: Object.values(bySection) };
}

/** Kit look options from a request body or CLI flags: seed and overrides, empty = automatic. */
function kitOpts(b) {
  const o = {};
  if (b.seed != null && b.seed !== '' && b.seed !== true && !isNaN(+b.seed)) o.seed = +b.seed >>> 0;
  for (const k of ['layout', 'palette', 'type', 'theme']) if (b[k] && b[k] !== true && b[k] !== 'auto') o[k] = String(b[k]);
  if (b.copy != null && b.copy !== '' && b.copy !== 'auto' && b.copy !== true) o.copy = +b.copy;
  return o;
}

function venuesPayload() {
  const reg = V.load();
  const venues = reg.venues.map((v) => {
    const isPost = V.isPostVenue(v);
    return Object.assign({}, v, { templates: V.templatesFor(v), isPost, verifyFirst: V.verifyFirst(v), autoSuggest: V.autoSuggest(v), status: isPost ? L.status(v) : null });
  });
  return {
    venues, excluded: reg.excluded, insights: reg.insights,
    meta: { updated: reg.meta.updated, sectionSlugs: reg.meta.sectionSlugs || [], audienceVocabulary: reg.meta.audienceVocabulary || [], kinds: reg.meta.kinds || [] },
  };
}

function logPayload(q) {
  const entries = L.entries({ venue: q.venue || undefined, tool: q.tool ? T.normPath(q.tool) : undefined }).slice().reverse();
  const statuses = V.postVenues().map((v) => Object.assign({ name: v.name, kind: v.kind, cadenceDays: v.cadenceDays, maxPerWeek: v.maxPerWeek }, L.status(v)));
  return { file: L.logFile(), entries, statuses, routine: L.ROUTINE, today: L.routineFor() };
}

/* -------------------------------------------------------------- server */

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8' };

function send(res, code, body, type) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8', 'Content-Length': buf.length, 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  });
  res.end(buf);
}

function sendFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { error: 'not found' });
    send(res, 200, buf, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
}

/** Resolve rel inside base, refusing anything that escapes it. */
function inside(base, rel) {
  const p = path.resolve(base, '.' + path.sep + rel);
  return p.startsWith(path.resolve(base) + path.sep) ? p : null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > 1e6) { reject(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(new Error('bad JSON')); } });
    req.on('error', reject);
  });
}

function createServer(port) {
  const allowedHosts = new Set(['127.0.0.1:' + port, 'localhost:' + port]);
  return http.createServer(async (req, res) => {
    try {
      // DNS-rebinding guard: only answer to our own host name
      if (!allowedHosts.has(String(req.headers.host || ''))) return send(res, 421, { error: 'wrong host' });
      const u = new URL(req.url, 'http://127.0.0.1:' + port);
      const q = Object.fromEntries(u.searchParams.entries());
      const p = u.pathname;
      if (req.method === 'POST') {
        const origin = req.headers.origin;
        if (origin && !allowedHosts.has(origin.replace(/^https?:\/\//, ''))) return send(res, 403, { error: 'cross-origin' });
        if (!/application\/json/.test(String(req.headers['content-type'] || ''))) return send(res, 415, { error: 'JSON only' });
      }
      /* every request runs in one site (site.js): its items, rules, log, calendar and kits */
      const site = String(req.headers['x-promo-site'] || q.site || SITE.DEFAULT);
      if (!SITE.exists(site)) return send(res, 400, { error: 'Unknown site: ' + site });
      return await SITE.run(site, () => route(req, res, u, q, p));
    } catch (e) {
      return send(res, 500, { error: String(e && e.message || e) });
    }
  });
}

/* The routes, run inside the request's site. (Indented as they were inside createServer.) */
async function route(req, res, u, q, p) {
  /* eslint-disable-next-line no-lone-blocks */ {
      if (p === '/'|| p === '/index.html') return sendFile(res, path.join(UI_DIR, 'index.html'));
      if (p === '/api/sites') return send(res, 200, { current: SITE.currentId(), sites: SITE.list() });
      if (p === '/api/site') { const s = SITE.current(); return send(res, 200, { site: Object.assign({}, s, { items: s.builtin ? null : s.items }), home: L.home(), facebook: L.fbBudget() }); }
      if (p === '/ui.js' || p === '/ui.css') return sendFile(res, path.join(UI_DIR, p.slice(1)));
      if (p.startsWith('/fonts/')) { const f = inside(path.join(T.ROOT, 'assets', 'fonts'), p.slice(7)); return f ? sendFile(res, f) : send(res, 404, {}); }
      if (p === '/icons.svg') return sendFile(res, path.join(T.ROOT, 'assets', 'icons.svg'));
      if (p.startsWith('/kits/')) { const f = inside(path.join(L.home(), 'kits'), decodeURIComponent(p.slice(6))); return f ? sendFile(res, f) : send(res, 404, {}); }

      if (p === '/api/tools') return send(res, 200, { tools: T.listTools().map(lightTool), count: T.toolCount() });
      if (p === '/api/audiences') return send(res, 200, { collections: T.collections().map((c) => ({ slug: c.slug, name: c.name, kind: c.kind, tools: c.tools.length })), vocabulary: (V.load().meta.audienceVocabulary || []) });
      if (p === '/api/venues') return send(res, 200, venuesPayload());
      if (p === '/api/fit') return send(res, 200, { tool: T.normPath(q.tool), venues: V.fit(q.tool) });
      if (p === '/api/fit-audience') return send(res, 200, { audience: q.audience, venues: V.fitAudience(q.audience) });
      if (p === '/api/draft') return send(res, 200, draft(q));
      if (p === '/api/templates') return send(res, 200, { templates: TPL.TEMPLATE_IDS.map((id) => Object.assign({ id }, TPL.META[id])) });
      if (p === '/api/find') {
        const F = require('./find');
        const r = await F.find({ tool: q.tool || undefined, audience: q.audience || undefined, fresh: q.fresh === '1', maxVenues: q.max ? parseInt(q.max, 10) : undefined });
        /* every result is kept (store.js), so a restart loses nothing and a
           question you dismissed stays dismissed when it turns up again */
        r.items = require('./store').mergeOpps(r.items, { tool: q.tool ? T.normPath(q.tool) : undefined, audience: q.audience || undefined });
        return send(res, 200, r);
      }
      if (p === '/api/opps' && req.method === 'GET') return send(res, 200, require('./store').listOpps({ status: q.status, tool: q.tool ? T.normPath(q.tool) : '', audience: q.audience }));
      if (p === '/api/opps' && req.method === 'POST') {
        const b = await readBody(req);
        try { return send(res, 200, { item: require('./store').setOppStatus(b.url, b.status, b.note) }); }
        catch (e) { return send(res, 400, { error: e.message }); }
      }
      if (p === '/api/drafts' && req.method === 'GET') {
        if (q.tool) return send(res, 200, { draft: require('./store').getDraft({ tool: T.normPath(q.tool), venue: q.venue, template: q.template, variant: q.variant, qurl: q.qurl }) });
        return send(res, 200, { drafts: require('./store').listDrafts() });
      }
      if (p === '/api/drafts' && req.method === 'POST') {
        const b = await readBody(req);
        if (!b.tool) return send(res, 400, { error: 'tool required' });
        return send(res, 200, { draft: require('./store').saveDraft(Object.assign({}, b, { tool: T.normPath(b.tool) }), b.parts || {}) });
      }
      if (p === '/api/kits' && req.method === 'GET') return send(res, 200, { dir: path.join(L.home(), 'kits'), kits: require('./kit').list() });
      if (p === '/api/kit' && req.method === 'POST') {
        const b = await readBody(req);
        const r = await require('./kit').kit(b.tool, kitOpts(b));
        return send(res, 200, r);
      }
      if (p === '/api/kit-options') return send(res, 200, require('./kit').options());
      if (p === '/api/kit-looks' && req.method === 'POST') {
        const b = await readBody(req);
        return send(res, 200, await require('./kit').looks(b.tool, Object.assign(kitOpts(b), { n: Math.min(Math.max(parseInt(b.n, 10) || 6, 1), 12), format: b.format })));
      }
      if (p === '/api/reveal' && req.method === 'POST') {
        // open a kit folder in Explorer: a local convenience, never a network action
        const b = await readBody(req);
        const dir = inside(path.join(L.home(), 'kits'), String(b.slug || ''));
        if (!dir || !fs.existsSync(dir)) return send(res, 404, { error: 'no such kit' });
        if (process.platform === 'win32') require('child_process').spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' }).unref();
        return send(res, 200, { dir });
      }
      if (p === '/api/log' && req.method === 'GET') return send(res, 200, logPayload(q));
      if (p === '/api/log' && req.method === 'POST') {
        const b = await readBody(req);
        if (!b.venueId) return send(res, 400, { error: 'venueId required' });
        if (b.toolPath) b.toolPath = T.normPath(b.toolPath);
        const entry = L.append(b);
        return send(res, 200, { entry });
      }
      if (p === '/api/plan') return send(res, 200, require('./plan').plan());
      /* the 90-day short-video calendar (calendar.js), kept in calendar.json */
      if (p === '/api/calendar' && req.method === 'GET') return send(res, 200, require('./calendar').get());
      if (p === '/api/calendar.csv') { res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="1234tools-video-calendar.csv"' }); return res.end(require('./calendar').csv()); }
      if (p === '/api/calendar/plan' && req.method === 'POST') { const b = await readBody(req); return send(res, 200, require('./calendar').plan(b.start || undefined)); }
      if (p === '/api/calendar/status' && req.method === 'POST') {
        const b = await readBody(req);
        try { return send(res, 200, { item: require('./calendar').setStatus(b.id, b.status, b.postedUrl, b.note) }); }
        catch (e) { return send(res, 400, { error: e.message }); }
      }
      /* one target of a slot: record a link or a tick, skip with a reason, clear, accept, add or remove */
      if (p === '/api/calendar/target' && req.method === 'POST') {
        const b = await readBody(req);
        try { return send(res, 200, require('./calendar').target(b.id, b.channel, b.action, { url: b.url, tick: !!b.tick, note: b.note, reason: b.reason, noLink: !!b.noLink })); }
        catch (e) { return send(res, 400, { error: e.message }); }
      }
      if (p === '/api/calendar/coverage') return send(res, 200, require('./calendar').coverage({ days: q.days }));
      if (p === '/api/guide') return send(res, 200, require('./guide').payload());
      if (p === '/api/channels/check') return send(res, 200, require('./channels').check(q.channel, q.url || ''));
      if (p === '/api/reels') return send(res, 200, await reels());
      if (p === '/api/lint') {
        const b = req.method === 'POST' ? await readBody(req) : q;
        return send(res, 200, lint(b.text || '', { pricing: b.pricing || undefined, section: b.section || undefined, limit: b.limit ? +b.limit : undefined }));
      }
      if (p === '/api/health') return send(res, 200, { ok: true, home: L.home(), venues: V.file() });
      return send(res, 404, { error: 'not found' });
  }
}

function serve(port) {
  port = port || 8797;
  if (!PORTS.includes(port) && !(process.env.PROMO_TEST === '1' && TEST_PORTS.includes(port))) throw new Error('Use a port between 8796 and 8799.');
  const server = createServer(port);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

/* ----------------------------------------------------------------- CLI */

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const nxt = argv[i + 1];
      if (nxt != null && !nxt.startsWith('--')) { out[k] = nxt; i++; } else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

function printDraft(d) {
  const out = [];
  out.push('# ' + d.tool.title + ' → ' + (d.venue ? d.venue.name : '(no venue)') + ' · ' + d.template + ' v' + d.variant);
  if (d.venue) out.push('risk ' + d.venue.risk + ' · self-promo ' + d.venue.selfPromo + ' · links ' + d.venue.linkPolicy + ' · every ' + d.venue.cadenceDays + ' d / ' + d.venue.maxPerWeek + ' a week · rules ' + (d.venue.rulesUrl || '-'));
  if (d.venue && d.venue.verifyFirst) out.push('VERIFY RULES FIRST: the register could not confirm this venue\'s rules (' + d.venue.verifiedHow + ')');
  if (d.venue && d.venue.risk === 'high') out.push('HIGH RISK: never suggested by Today; post only deliberately.');
  out.push(d.status.ok ? 'Status: OK to post today' : 'Status: WAIT — ' + d.status.reasons.join(' | '));
  for (const w of d.status.warnings || []) out.push('Note: ' + w);
  for (const p of d.draft.parts) {
    out.push('');
    out.push('--- ' + p.label + ' (' + p.chars + (p.limit ? '/' + p.limit : '') + (p.countMode && p.countMode !== 'chars' ? ' ' + p.countMode : '') + ')');
    out.push(p.text);
  }
  out.push('');
  for (const e of d.draft.errors) out.push('LINT ERROR [' + e.part + '] ' + e.rule + ': ' + e.msg);
  for (const w of d.draft.warnings) out.push('note [' + (w.part || '-') + '] ' + w.rule + ': ' + w.msg);
  if (d.composerUrl) out.push('Composer (you finish and post): ' + d.composerUrl);
  else if (d.composerNote) out.push(d.composerNote);
  out.push('Red lines: ' + d.redLines.join(' / '));
  return out.join('\n');
}

/** The coverage report for the terminal. */
function coverageText(c) {
  const out = [];
  out.push('Site: ' + SITE.current().name + '. Coverage of the video calendar, ' + c.from + ' to ' + c.today + ' (' + c.days + ' days). The desk checks each link\'s shape only; it never opens it.');
  const n = (b) => b.posted + ' posted, ' + b.due + ' due today, ' + b.missed + ' missed' + (b.flagged ? ', ' + b.flagged + ' to check' : '') + (b.skipped ? ', ' + b.skipped + ' skipped' : '');
  out.push('\nPer channel (last 7 days | last 30 days):');
  if (!c.channels.length) out.push('  nothing due yet');
  for (const r of c.channels) out.push('  ' + r.name.padEnd(34) + n(r.week) + ' | ' + n(r.d30) + (r.venue ? '' : '  [no venue: not in the log]'));
  out.push('\nToday:');
  if (!c.todaySlots.length) out.push('  no video slot today');
  for (const s of c.todaySlots) {
    out.push('  ' + s.id + ' ' + s.title + ' (' + s.formatLabel + '): ' + s.progress.label);
    for (const m of s.missing) out.push('    - ' + m.name + (m.flagged ? ': link needs a check' : '') + (m.cadence && !m.cadence.ok ? ': WAIT, ' + m.cadence.reasons[0] : '') + (m.linkInPost === false ? ' (profile-link post: not counted toward linked caps' + (m.advice ? '; ' + m.advice.text : '') + ')' : ''));
  }
  const open = c.slots.filter((s) => s.missing.length || s.flagged.length || s.warnings.length || s.unassigned.length);
  out.push('\nSlots with something open:');
  if (!open.length) out.push('  none: every past and today\'s target is posted or skipped with a reason');
  for (const s of open) {
    out.push('  ' + s.id + ' ' + s.title + ': ' + s.progress.label);
    if (s.missing.length) out.push('    missing: ' + s.missing.map((m) => m.name).join(', '));
    for (const f of s.flagged) out.push('    CHECK ' + f.name + ' ' + f.url + ': ' + f.issues.map((i) => i.msg).join(' '));
    for (const w of s.warnings) out.push('    note ' + w.name + ': ' + w.issues.map((i) => i.msg).join(' '));
    for (const u of s.unassigned) out.push('    unassigned link: ' + u.url);
  }
  if (c.noVenue.length) out.push('\nRecorded without a log entry (no venue in venues.json): ' + c.noVenue.join(', ') + '.');
  if (c.facebook) out.push('\nFacebook Page link posts: ' + c.facebook.label + ' (config.json facebook.linkPostsPerMonth). Native posts without a link do not use it.');
  return out.join('\n');
}

/** Every command takes --site <id> (default 1234tools, or PROMO_SITE); `sites` lists them. */
async function cli(argv) {
  const a = args(argv);
  const site = a.site && a.site !== true ? String(a.site) : (process.env.PROMO_SITE || SITE.DEFAULT);
  if (!SITE.exists(site)) { console.error('Unknown site: ' + site + '. Sites: ' + SITE.list().map((s) => s.id).join(', ')); return 2; }
  if (a._[0] === 'serve') process.env.PROMO_SITE = site; // the web app opens on this site; the header picker switches per tab
  return SITE.run(site, () => cliInSite(a));
}

async function cliInSite(a) {
  const cmd = a._[0];
  if (cmd === 'sites') {
    let group = '';
    for (const s of SITE.list()) {
      if (s.group !== group) { group = s.group; console.log(group + ':'); }
      console.log((s.id === SITE.currentId() ? '* ' : '  ') + s.id.padEnd(22) + s.name.padEnd(24) + (s.baseUrl || '(no URL)').padEnd(34) + (s.items == null ? 'the 1234Tools catalogue' : s.items + ' ' + (s.promotes || 'items')) + (s.todo ? '  TODO: ' + s.todo : '') + (s.error ? '  ERROR: ' + s.error : ''));
    }
    console.log('Data folder for ' + SITE.currentId() + ': ' + L.home());
    return 0;
  }
  if (!cmd || cmd === 'help' || a.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^[\s\S]*?\/\*\*/, '').replace(/^ \* ?/gm, ''));
    return 0;
  }
  if (cmd === 'serve') {
    const port = a.port ? parseInt(a.port, 10) : 8797;
    await serve(port);
    console.log('Promotion Desk on http://127.0.0.1:' + port + '  (log: ' + L.logFile() + ')');
    return null;
  }
  if (cmd === 'plan') {
    const p = require('./plan').plan();
    console.log(p.weekday + ' ' + p.date + ' — ' + p.routine.work + ' (linked posts: ' + p.used + ' of ' + p.cap + ')');
    p.tasks.forEach((t, i) => {
      console.log('\n' + (i + 1) + '. [' + t.kind + (t.done ? ', done' : t.skipped ? ', skipped' : '') + '] ' + (t.venueName || '') + (t.toolTitle ? ' · ' + t.toolTitle : '') + (t.template ? ' · ' + t.template : ''));
      if (t.verifyFirst) console.log('   VERIFY RULES FIRST: ' + (t.rulesUrl || 'read the venue rules'));
      if (t.what) console.log('   ' + t.what);
      if (t.status && !t.status.ok) console.log('   WAIT: ' + t.status.reasons.join(' | '));
      if (t.draft) console.log(t.draft.text.split('\n').map((x) => '   > ' + x).join('\n'));
      if (t.composerUrl) console.log('   composer: ' + t.composerUrl);
      if (t.searchUrl) console.log('   search: ' + t.searchUrl);
    });
    return 0;
  }
  if (cmd === 'draft') {
    const d = draft({ tool: a._[1], venue: a._[2], template: a.template, variant: a.variant, question: a.question, qurl: a.qurl, result: a.result });
    console.log(printDraft(d));
    return d.draft.ok ? 0 : 1;
  }
  if (cmd === 'find') {
    const target = a._[1] || '';
    const F = require('./find');
    const r = await F.find(target.startsWith('audience:') ? { audience: target.slice(9) } : { tool: target, fresh: !!a.fresh });
    console.log('Queries: ' + r.queries.join(' | ') + '\nVenues: ' + r.venues.join(', '));
    for (const e of r.errors) console.log('  ! ' + e);
    for (const it of r.items) console.log('\n[' + it.matchScore + '] ' + it.title + '\n    ' + it.url + '\n    ' + it.venueId + ' · ' + it.created.slice(0, 10) + (it.score != null ? ' · score ' + it.score : '') + (it.comments != null ? ' · ' + it.comments + ' replies' : '') + ' · ' + it.suggestedTemplate);
    if (!r.items.length) console.log('\nNo open questions found in the window.');
    return 0;
  }
  if (cmd === 'kit') {
    const r = await require('./kit').kit(a._[1], kitOpts(a));
    console.log('Kit written to ' + r.dir);
    console.log('  look: layout ' + r.variant.layout + ' · palette ' + r.variant.palette + ' · type ' + r.variant.type + ' · copy ' + r.variant.copy + ' · seed ' + r.variant.seed + ' (' + r.how + ')');
    console.log('  example: ' + r.example.kind + (r.example.real ? ', real' : ', illustration') + ' · ' + r.example.how);
    if (r.fit.overflow.length) console.log('  TEXT DID NOT FIT:\n    ' + r.fit.overflow.join('\n    '));
    for (const f of r.files) console.log('  ' + (f.file || path.basename(f.path)) + (f.actual ? ' ' + f.actual.w + '×' + f.actual.h : '') + ' ' + f.bytes + ' bytes');
    if (r.qr) console.log('  story QR: ' + r.qr.text + (r.qr.verified ? ' (read back OK)' : ' (NOT verified)'));
    return 0;
  }
  if (cmd === 'log') {
    if (a._[1] === 'add') {
      const e = L.append({ venueId: a._[2], toolPath: a._[3] ? T.normPath(a._[3]) : '', kind: a.kind || 'post', url: a.url, template: a.template, note: a.note });
      console.log('Logged: ' + JSON.stringify(e));
      return 0;
    }
    const r = logPayload({ venue: a.venue });
    console.log('Log: ' + r.file + ' (' + r.entries.length + ' entries)');
    for (const e of r.entries.slice(0, 50)) console.log(e.at.slice(0, 16).replace('T', ' ') + '  ' + e.kind.padEnd(7) + ' ' + e.venueId.padEnd(34) + ' ' + (e.toolPath || '').padEnd(34) + ' ' + (e.template || '') + (e.url ? ' ' + e.url : ''));
    console.log('\nVenues that are waiting:');
    for (const s of r.statuses.filter((x) => !x.ok && (!a.venue || x.venueId === a.venue))) console.log('  ' + s.venueId + ': ' + s.reasons[0] + (s.nextAt ? ' (from ' + s.nextAt.slice(0, 10) + ')' : ''));
    return 0;
  }
  if (cmd === 'venues') {
    let vs = V.postVenues();
    if (a.section) vs = vs.filter((v) => v.sections.includes(a.section));
    if (a.audience) { const tags = V.audienceTags(a.audience); vs = vs.filter((v) => v.audiences.some((x) => tags.includes(x))); }
    for (const v of vs) console.log(v.id.padEnd(40) + ' ' + v.kind.padEnd(10) + ' risk ' + v.risk.padEnd(6) + ' ' + v.selfPromo.padEnd(13) + ' ' + v.linkPolicy.padEnd(12) + ' every ' + String(v.cadenceDays).padStart(3) + ' d  ' + v.template);
    console.log(vs.length + ' venues');
    return 0;
  }
  if (cmd === 'lint') {
    const r = lint(a._.slice(1).join(' '), { pricing: a.ai ? 'freemium' : undefined, section: a.section });
    for (const e of r.errors) console.log('ERROR ' + e.rule + ': ' + e.msg + (e.match ? ' ("' + e.match + '")' : ''));
    for (const w of r.warnings) console.log('note ' + w.rule + ': ' + w.msg);
    console.log(r.ok ? 'clean (' + r.count + ' chars)' : r.errors.length + ' problem(s)');
    return r.ok ? 0 : 1;
  }
  if (cmd === 'guide') {
    const G = require('./guide');
    const out = G.text(a._[1]);
    if (out == null) { console.error('No channel ' + a._[1] + '. Channels: ' + require('./channels').list().map((c) => c.id).join(', ')); return 2; }
    console.log(out);
    return 0;
  }
  if (cmd === 'coverage') {
    console.log(coverageText(require('./calendar').coverage({ days: a.days })));
    return 0;
  }
  console.error('Unknown command: ' + cmd + '. Try: node build/promo/desk.js help');
  return 2;
}

module.exports = { createServer, serve, draft, reels, venuesPayload, logPayload, cli, kitOpts, coverageText, PORTS, TEST_PORTS };

if (require.main === module) {
  cli(process.argv.slice(2)).then((code) => { if (code != null) process.exitCode = code; }).catch((e) => { console.error(e.message || e); process.exitCode = 1; });
}
