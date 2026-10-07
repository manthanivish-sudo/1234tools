#!/usr/bin/env node
/**
 * The last 90 days of currency rates, for the converter's history chart.
 *
 *   node build/rates-history.js              add today's assets/rates.json to
 *                                            assets/rates-history.json
 *   node build/rates-history.js --check      say what would change, write nothing
 *   node build/rates-history.js --seed-from-git [--repo DIR]
 *                                            rebuild it from every committed
 *                                            assets/rates.json in the last 90
 *                                            days (read with `git log` and
 *                                            `git show`, which change nothing)
 *
 * build/fetch-rates.js calls update() after it writes a new rates.json, on
 * the same GitHub runner, so the history is exactly the daily files the site
 * served, one a day, the oldest dropped after 90. Nothing new is fetched for
 * it and the browser loads it from this site only when somebody opens the
 * chart.
 *
 * Shape, kept small (about 160 currencies × 90 days):
 *   { "base": "USD", "days": ["2026-07-30", …], "rates": { "AED": [3.6725, …], … } }
 * every rate to 6 significant figures, null on a day a currency had none.
 * Inert on require.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DAYS = 90;
const ROOT = path.join(__dirname, '..');
const RATES = path.join(ROOT, 'assets', 'rates.json');
const OUT = path.join(ROOT, 'assets', 'rates-history.json');

const sig = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? Number(v.toPrecision(6)) : null);
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

/** history + one day's rates file -> history (pure; the input is not changed) */
function addDay(history, payload) {
  if (!payload || !payload.rates || !isDay(payload.date)) return history;
  const base = payload.base || 'USD';
  const h = history && history.base === base ? history : { base, days: [], rates: {} };
  const byDay = new Map();
  h.days.forEach((d, i) => {
    const row = {};
    Object.keys(h.rates).forEach((c) => { const v = h.rates[c][i]; if (v !== null && v !== undefined) row[c] = v; });
    byDay.set(d, row);
  });
  const row = {};
  Object.keys(payload.rates).forEach((c) => { const v = sig(payload.rates[c]); if (v !== null) row[c] = v; });
  byDay.set(payload.date, row);
  const days = [...byDay.keys()].sort().slice(-DAYS);
  const codes = new Set();
  days.forEach((d) => Object.keys(byDay.get(d)).forEach((c) => codes.add(c)));
  const rates = {};
  [...codes].sort().forEach((c) => { rates[c] = days.map((d) => (byDay.get(d)[c] === undefined ? null : byDay.get(d)[c])); });
  return { base, days, rates };
}

const read = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const text = (h) => JSON.stringify(h) + '\n';

/** add assets/rates.json to the history file; returns true when it changed */
function update(opts) {
  const o = opts || {};
  const now = read(o.rates || RATES);
  const prev = read(o.out || OUT);
  const next = addDay(prev, now);
  const changed = text(next) !== (prev ? text(prev) : '');
  if (changed && !o.check) fs.writeFileSync(o.out || OUT, text(next));
  return changed;
}

function seedFromGit(repo) {
  const { execFileSync } = require('child_process');
  const git = (args) => execFileSync('git', ['-C', repo].concat(args), { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
  const shas = git(['log', '--format=%H', '--', 'assets/rates.json']).trim().split('\n').filter(Boolean).reverse();
  let h = null;
  for (const sha of shas) {
    let p = null;
    try { p = JSON.parse(git(['show', sha + ':assets/rates.json'])); } catch (e) { continue; }
    h = addDay(h, p);
  }
  return addDay(h, read(RATES));
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.includes('--seed-from-git')) {
    const i = argv.indexOf('--repo');
    const h = seedFromGit(path.resolve(i >= 0 ? argv[i + 1] : ROOT));
    if (!argv.includes('--check')) fs.writeFileSync(OUT, text(h));
    console.log('rates-history: ' + h.days.length + ' days (' + h.days[0] + ' to ' + h.days[h.days.length - 1] + '), ' + Object.keys(h.rates).length + ' currencies' + (argv.includes('--check') ? ' (not written)' : ''));
  } else {
    const changed = update({ check: argv.includes('--check') });
    console.log('rates-history: ' + (changed ? (argv.includes('--check') ? 'would change' : 'updated') : 'unchanged'));
  }
}

module.exports = { addDay, update, DAYS };
