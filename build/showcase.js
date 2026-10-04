/**
 * The showcase queue, from the owner's terminal.
 *
 *   node build/showcase.js list [--all]            what is waiting (or everything)
 *   node build/showcase.js approve <id> [--feature]
 *   node build/showcase.js reject <id> [reason]
 *   node build/showcase.js remove <id>             take a listed entry down
 *   node build/showcase.js pull                    approved entries -> build/showcase.json
 *   node build/showcase.js add --name … --url … --platform … --tool …
 *                          [--handle …] [--note …] [--audience …] [--feature]
 *                          (--tool pdf/merge-pdf is fine: the slashes are added)
 *
 *   --emulator        talk to the Firestore emulator on 127.0.0.1:8181 (or
 *                     FIRESTORE_EMULATOR_HOST) as project demo-1234tools,
 *                     with no token
 *   --project <id>    another project (default mvr-1234tools, or
 *                     demo-1234tools with --emulator)
 *
 * People send what they made through the form on /showcase/; the function
 * that receives it (submitShowcase) stores it as pending and nothing more.
 * This is the hand that decides. `approve` and `reject` change the stored
 * entry; `pull` copies the approved ones, without their email or anything
 * else that was never meant to be public, into build/showcase.json, which
 * is what build-showcase.js turns into pages. `add` writes an entry straight
 * into that file, for somebody found rather than submitted — only ever with
 * their permission. `remove` takes one down: out of the file, and marked
 * removed in the queue so the nightly prune deletes it.
 *
 * Every entry is checked again on the way into the file, by the same rules
 * the form and the function use (assets/showcase.js), plus one only this
 * side can know: that the tool it names is a page on this site.
 *
 * Firestore is reached through its REST API with the token gcloud already
 * holds (`gcloud auth print-access-token`), billed to mvr-1234tools. Nothing
 * here needs a service-account key on disk.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const rules = require('../assets/showcase.js');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(__dirname, 'showcase.json');

/* ------------------------------------------------------------------ */
/* the file                                                           */
/* ------------------------------------------------------------------ */

function load() {
  if (!fs.existsSync(FILE)) return { updated: null, entries: [] };
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!data || !Array.isArray(data.entries)) throw new Error(path.relative(ROOT, FILE) + ' has no entries list');
  return data;
}

/* Featured first, then the most recently approved, then by id so two runs
   on the same data write the same file. */
function sortEntries(list) {
  return list.slice().sort((a, b) =>
    (b.featured ? 1 : 0) - (a.featured ? 1 : 0) ||
    String(b.approvedAt || '').localeCompare(String(a.approvedAt || '')) ||
    String(a.id).localeCompare(String(b.id)));
}

/* One entry per line, so a diff of this file reads as a list of who was
   added and who came down. The date moves only when the list does. */
function serialise(updated, entries) {
  return entries.length
    ? '{"updated":"' + updated + '","entries":[\n' + entries.map((e) => JSON.stringify(e)).join(',\n') + '\n]}\n'
    : '{"updated":"' + updated + '","entries":[]}\n';
}
function save(entries) {
  const was = load();
  const next = sortEntries(entries);
  const same = JSON.stringify(sortEntries(was.entries)) === JSON.stringify(next);
  const updated = same && was.updated ? was.updated : new Date().toISOString().slice(0, 10);
  const out = serialise(updated, next);
  const before = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : null;
  if (before !== out) fs.writeFileSync(FILE, out);
  return { changed: before !== out, updated, count: next.length };
}

/** Only what the page prints. Email, the address hash and the consent
    record stay in Firestore. */
function publicEntry(e) {
  const out = {
    id: String(e.id),
    name: e.name,
    handle: e.handle || null,
    platform: e.platform,
    url: e.url,
    tool: e.tool,
    audience: e.audience || null,
    note: e.note || '',
    featured: !!e.featured,
    /* the full time, not the day: "newest first" has to order two approved on the same afternoon */
    approvedAt: e.approvedAt ? new Date(e.approvedAt).toISOString() : null,
    source: e.source || 'form'
  };
  return out;
}

/**
 * Everything wrong with an entry, as sentences; an empty list is a pass.
 * The rules the form and the function apply, and then that the tool is a
 * real tool page on this site: not a section hub, not a redirect stub.
 */
function problems(e, root) {
  const r = rules.check(Object.assign({}, e, { consent: true }));
  const out = Object.keys(r.errors).map((k) => k + ': ' + r.errors[k]);
  if (!r.errors.tool) {
    const abs = path.join(root || ROOT, e.tool.replace(/^\/+/, ''), 'index.html');
    if (!fs.existsSync(abs)) out.push('tool: ' + e.tool + ' is not a page on this site');
    else {
      const html = fs.readFileSync(abs, 'utf8');
      if (/name="robots" content="noindex,follow"/.test(html) && /http-equiv="refresh"/.test(html)) out.push('tool: ' + e.tool + ' is a redirect; use the address it points to');
      const { SECTIONS } = require('./sections.js');
      if (SECTIONS[e.tool]) out.push('tool: ' + e.tool + ' is a section, not a tool; name the tool that was used');
    }
  }
  if (!r.errors.url && r.value.url !== e.url) out.push('url: stored as ' + e.url + ' but reads as ' + r.value.url);
  return out;
}

/* ------------------------------------------------------------------ */
/* Firestore, over REST                                               */
/* ------------------------------------------------------------------ */

function connection(flags) {
  if (flags.emulator) {
    const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8181';
    const project = flags.project || 'demo-1234tools';
    /* the emulator's admin bypass, the same one the backend tests use */
    return { base: 'http://' + host + '/v1/projects/' + project + '/databases/(default)/documents', headers: { Authorization: 'Bearer owner' }, project };
  }
  const project = flags.project || 'mvr-1234tools';
  let token;
  try {
    token = require('child_process').execSync('gcloud auth print-access-token', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    throw new Error('gcloud could not give a token (' + String(e.stderr || e.message).trim().split('\n')[0] + '). Run `gcloud auth login urvisu@gmail.com` first.');
  }
  return { base: 'https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default)/documents', headers: { Authorization: 'Bearer ' + token, 'X-Goog-User-Project': 'mvr-1234tools' }, project };
}

async function call(conn, method, url, body) {
  const r = await fetch(url, { method, headers: Object.assign({ 'content-type': 'application/json' }, conn.headers), body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch (e) { data = text; }
  if (!r.ok) {
    const why = (data && data.error && (data.error.message || data.error.status)) || String(text).slice(0, 200);
    const err = new Error(method + ' ' + url.replace(conn.base, '') + ' -> ' + r.status + ': ' + why);
    err.status = r.status;
    throw err;
  }
  return data;
}

function decode(v) {
  if (!v || typeof v !== 'object') return undefined;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  return undefined;
}
function fromFields(fields) {
  const o = {};
  for (const k of Object.keys(fields || {})) o[k] = decode(fields[k]);
  return o;
}
const fromDoc = (doc) => Object.assign({ id: doc.name.split('/').pop() }, fromFields(doc.fields));

async function query(conn, status) {
  const structuredQuery = { from: [{ collectionId: 'showcase' }] };
  if (status) structuredQuery.where = { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: status } } };
  const rows = await call(conn, 'POST', conn.base + ':runQuery', { structuredQuery });
  return (rows || []).filter((r) => r.document).map((r) => fromDoc(r.document))
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}

async function getDoc(conn, id) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id || '')) throw new Error('that does not look like an id: ' + id);
  try { return fromDoc(await call(conn, 'GET', conn.base + '/showcase/' + id)); }
  catch (e) { if (e.status === 404) throw new Error('no showcase entry with id ' + id); throw e; }
}

async function patch(conn, id, fields) {
  const mask = Object.keys(fields).map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  return call(conn, 'PATCH', conn.base + '/showcase/' + id + '?' + mask + '&currentDocument.exists=true', { fields });
}
const S = (s) => ({ stringValue: String(s) });
const T = () => ({ timestampValue: new Date().toISOString() });

/* ------------------------------------------------------------------ */
/* commands                                                           */
/* ------------------------------------------------------------------ */

function show(e) {
  const label = (rules.PLATFORMS[e.platform] || {}).label || e.platform;
  console.log('\n  ' + e.id + '   ' + (e.status || '') + (e.featured ? ' (featured)' : '') + '   ' + String(e.at || '').replace('T', ' ').slice(0, 16));
  console.log('    ' + e.name + (e.handle ? '  @' + e.handle : '') + '  on ' + label);
  console.log('    ' + e.url);
  console.log('    tool ' + e.tool + (e.audience ? '   audience ' + e.audience : ''));
  if (e.note) console.log('    "' + e.note + '"');
  if (e.email) console.log('    email ' + e.email + '  (never published)');
  if (e.reason) console.log('    reason ' + e.reason);
  const p = problems(e);
  if (p.length) console.log('    ! ' + p.join('\n    ! '));
}

async function cmdList(conn, flags) {
  const rows = await query(conn, flags.all ? null : 'pending');
  console.log('\n' + rows.length + (flags.all ? ' showcase entr' + (rows.length === 1 ? 'y' : 'ies') : ' waiting') + ' in ' + conn.project);
  rows.forEach(show);
  if (rows.length && !flags.all) console.log('\n  approve <id> [--feature] · reject <id> [reason]\n');
}

async function cmdApprove(conn, id, flags) {
  const e = await getDoc(conn, id);
  const p = problems(e);
  if (p.length) throw new Error('not approved — ' + id + ' would not pass the build:\n  ' + p.join('\n  ') + '\nReject it, or ask the sender to send it again.');
  if (e.consent !== true) throw new Error('not approved — ' + id + ' has no consent recorded');
  await patch(conn, id, { status: S('approved'), approvedAt: T(), featured: { booleanValue: !!flags.feature } });
  console.log('approved ' + id + (flags.feature ? ' (featured)' : '') + ' — ' + e.name + '. Run `node build/showcase.js pull` and then build-showcase.js to put it on the site.');
}

async function cmdReject(conn, id, reason) {
  const e = await getDoc(conn, id);
  await patch(conn, id, { status: S('rejected'), rejectedAt: T(), reason: S(reason || '') });
  console.log('rejected ' + id + ' — ' + e.name + (reason ? ' (' + reason + ')' : '') + '. It is deleted ninety days after it came in.');
  if (e.status === 'approved') console.log('It was approved before: run pull, then build-showcase.js, to take it off the site.');
}

async function cmdRemove(conn, id) {
  const file = load();
  const kept = file.entries.filter((e) => e.id !== id);
  const inFile = kept.length !== file.entries.length;
  if (inFile) save(kept);
  let inQueue = false;
  if (!/^added-/.test(id) && conn) {
    try { await getDoc(conn, id); await patch(conn, id, { status: S('removed'), removedAt: T() }); inQueue = true; }
    catch (e) { if (!/no showcase entry/.test(e.message)) throw e; }
  }
  if (!inFile && !inQueue) throw new Error('nothing called ' + id + ' in build/showcase.json or the queue');
  console.log('removed ' + id + (inFile ? ' from build/showcase.json' : '') + (inQueue ? (inFile ? ' and' : '') + ' marked removed in the queue' : '') + '. Run build-showcase.js to take it off the pages.');
}

async function cmdPull(conn) {
  const approved = await query(conn, 'approved');
  const kept = load().entries.filter((e) => e.source === 'added');
  const out = [], skipped = [];
  for (const e of approved) {
    const pub = publicEntry(Object.assign({}, e, { source: 'form' }));
    const p = problems(pub);
    if (p.length) { skipped.push(e.id + ': ' + p.join('; ')); continue; }
    out.push(pub);
  }
  const res = save(out.concat(kept));
  console.log('\nbuild/showcase.js pull  (' + conn.project + ')');
  console.log('  approved in the queue  ' + approved.length);
  console.log('  added by hand          ' + kept.length);
  console.log('  written                ' + res.count + ' entr' + (res.count === 1 ? 'y' : 'ies') + ', ' + load().entries.filter((e) => e.featured).length + ' featured');
  if (skipped.length) { console.log('  skipped                ' + skipped.length + ' that would not pass the build:'); skipped.forEach((s) => console.log('    ! ' + s)); }
  console.log('  build/showcase.json    ' + (res.changed ? 'updated (' + res.updated + ')' : 'unchanged'));
  console.log('\n  next: node build-showcase.js\n');
}

/* Git Bash rewrites an argument that starts with a slash into a Windows
   path ("/pdf/merge-pdf/" arrives as "C:/Program Files/Git/pdf/merge-pdf/"),
   so take the tool with or without its slashes and undo that rewrite. */
function toolArg(v) {
  let t = String(v).replace(/\\/g, '/');
  const msys = /^[A-Za-z]:\/.*?\/Git\/(.*)$/.exec(t);
  if (msys) t = msys[1];
  return '/' + t.replace(/^\/+|\/+$/g, '') + '/';
}

function cmdAdd(flags) {
  for (const k of ['name', 'url', 'platform', 'tool']) if (!flags[k] || flags[k] === true) throw new Error('add needs --' + k);
  const r = rules.check({ name: flags.name, handle: flags.handle || '', platform: flags.platform, url: flags.url, tool: toolArg(flags.tool), audience: flags.audience || '', note: flags.note || '', consent: true });
  if (Object.keys(r.errors).length) throw new Error('not added:\n  ' + Object.keys(r.errors).map((k) => k + ': ' + r.errors[k]).join('\n  '));
  const file = load();
  if (file.entries.some((e) => e.url === r.value.url)) throw new Error('not added: ' + r.value.url + ' is already listed');
  const e = publicEntry(Object.assign({}, r.value, {
    id: 'added-' + crypto.createHash('sha256').update(r.value.url).digest('hex').slice(0, 10),
    featured: !!flags.feature, approvedAt: new Date().toISOString(), source: 'added'
  }));
  const p = problems(e);
  if (p.length) throw new Error('not added:\n  ' + p.join('\n  '));
  const res = save(file.entries.concat([e]));
  console.log('added ' + e.id + ' — ' + e.name + ' (' + res.count + ' listed). Run build-showcase.js to put it on the site.');
}

/* ------------------------------------------------------------------ */

function parse(argv) {
  const flags = {}, pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.indexOf('--') === 0) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (['all', 'feature', 'emulator'].indexOf(k) >= 0 || next === undefined || next.indexOf('--') === 0) flags[k] = true;
      else { flags[k] = next; i++; }
    } else pos.push(a);
  }
  return { cmd: pos[0], args: pos.slice(1), flags };
}

async function main() {
  const { cmd, args, flags } = parse(process.argv.slice(2));
  switch (cmd) {
    case 'list': return cmdList(connection(flags), flags);
    case 'approve': if (!args[0]) throw new Error('approve <id>'); return cmdApprove(connection(flags), args[0], flags);
    case 'reject': if (!args[0]) throw new Error('reject <id> [reason]'); return cmdReject(connection(flags), args[0], args.slice(1).join(' '));
    case 'remove': if (!args[0]) throw new Error('remove <id>'); return cmdRemove(/^added-/.test(args[0]) ? null : connection(flags), args[0]);
    case 'pull': return cmdPull(connection(flags));
    case 'add': return cmdAdd(flags);
    default:
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('\n').slice(1, 17).map((l) => l.replace(/^ \* ?/, '')).join('\n'));
      if (cmd) throw new Error('unknown command: ' + cmd);
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('\nbuild/showcase.js: ' + (e && e.message || e) + '\n'); process.exit(1); });
}
module.exports = { load, sortEntries, publicEntry, problems, serialise, FILE };
