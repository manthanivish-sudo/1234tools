#!/usr/bin/env node
/**
 * build/version-record.js — the version record in assets/version.js, which
 * the footer of every page shows ("Version 191 · 5 Oct 2026").
 *
 * build/release.js calls write() right after it sets sw.js's cache name, so
 * the record and the cache that serves it carry the same number:
 *
 *   { v: <sw.js 1234tools-vNNN>, date: 'YYYY-MM-DD' (the day of the run),
 *     built_on: <short id of the commit the release was built on> }
 *
 * built_on is the release commit's parent: release.js builds the tree before
 * committing, so the release commit's own id is not known yet. Nothing else
 * in the file changes.
 *
 * From the command line (an export, never the repo), for a build that is not
 * a release or to check one:
 *
 *   node build/version-record.js --root <site> [--v <n>] [--date YYYY-MM-DD] [--built-on <sha>]
 *   node build/version-record.js --root <site> --print
 *
 * --v defaults to sw.js's number in --root, --date to today (local time).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = 'assets/version.js';
const REC_RE = /var REC = (\{[^}\n]*\});/;
const SW_RE = /var V = '1234tools-v(\d+)';/;

/** The record in a version.js source, or throws. */
function parse(src) {
  const m = REC_RE.exec(src);
  if (!m) throw new Error('no "var REC = {...};" line in ' + FILE);
  return JSON.parse(m[1]);
}

function check(rec) {
  if (!Number.isInteger(rec.v) || rec.v < 1) throw new Error('version record: v must be a whole number, got ' + rec.v);
  if (!/^\d{4}-\d\d-\d\d$/.test(rec.date || '') || isNaN(Date.parse(rec.date))) throw new Error('version record: date must be YYYY-MM-DD, got ' + rec.date);
  if (rec.built_on != null && !/^[0-9a-f]{7,40}$/.test(rec.built_on)) throw new Error('version record: built_on must be a commit id, got ' + rec.built_on);
}

/** The source with its record replaced; only the REC line changes. */
function apply(src, rec) {
  check(rec);
  const out = { v: rec.v, date: rec.date };
  if (rec.built_on) out.built_on = rec.built_on;
  parse(src);
  return src.replace(REC_RE, () => 'var REC = ' + JSON.stringify(out) + ';');
}

const today = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const swVersion = (root) => {
  const m = SW_RE.exec(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'));
  if (!m) throw new Error("no var V = '1234tools-vNNN' in sw.js");
  return Number(m[1]);
};
const read = (root) => parse(fs.readFileSync(path.join(root, FILE), 'utf8'));

/** Writes the record into <root>/assets/version.js; returns what it wrote. */
function write(root, rec) {
  const abs = path.join(root, FILE);
  const src = fs.readFileSync(abs, 'utf8');
  const next = apply(src, rec);
  if (next !== src) fs.writeFileSync(abs, next);
  return read(root);
}

module.exports = { FILE, REC_RE, parse, check, apply, write, read, today, swVersion };

if (require.main === module) {
  const a = process.argv.slice(2);
  const arg = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (a.includes('--help') || a.includes('-h') || !arg('--root')) {
    const src = fs.readFileSync(__filename, 'utf8');
    console.error(src.slice(src.indexOf('/**') + 4, src.indexOf('*/')).replace(/^ \* ?/gm, ''));
    process.exit(a.includes('--help') || a.includes('-h') ? 0 : 2);
  }
  const root = path.resolve(arg('--root'));
  try {
    if (a.includes('--print')) { console.log(JSON.stringify(read(root))); process.exit(0); }
    const rec = { v: arg('--v') ? Number(arg('--v')) : swVersion(root), date: arg('--date') || today(), built_on: arg('--built-on') };
    console.log(FILE + ' ' + JSON.stringify(write(root, rec)));
  } catch (e) { console.error('version-record: ' + e.message); process.exit(1); }
}
