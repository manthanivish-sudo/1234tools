'use strict';
/**
 * The look of a kit: variant = { layout, palette, type, copy, seed }.
 *
 *   layout   composition family, applied to every format of the kit:
 *            classic · poster · split · cover · device
 *   palette  one of palettes.js (8, all AA-checked)
 *   type     heading treatment: gradient · outline · marker · caps · serif
 *   copy     0..2, which alternate of each beat's copy is used
 *
 * pick(tool, seed) is a pure function: the same (tool, seed) always gives the
 * same variant, so `--seed n` reproduces a kit byte for byte. Without a seed,
 * choose() derives one from (tool, kit number) and steps it until the result
 * avoids the tool's previous 3 looks and the previous 2 looks of any tool
 * (kits/history.json), then records it.
 */
const fs = require('fs');
const path = require('path');
const PAL = require('./palettes');

const LAYOUTS = ['classic', 'poster', 'split', 'cover', 'device'];
const TYPES = ['gradient', 'outline', 'marker', 'caps', 'serif'];
const LAYOUT_LABELS = { classic: 'Classic stack', poster: 'Big-type poster', split: 'Split screen', cover: 'Magazine cover', device: 'Phone mock-up' };
const TYPE_LABELS = { gradient: 'Two-tone gradient', outline: 'Outlined keyword', marker: 'Highlighter marker', caps: 'All-caps stack', serif: 'Serif editorial' };

/* Section leanings: every palette stays possible, these only tilt the odds. */
const LEAN = {
  creator: { violet: 4, ember: 4, mint: 3, midnight: 2, block: 2, ocean: 2, daylight: 1, paper: 1 },
  money: { midnight: 4, paper: 4, daylight: 3, ocean: 3, block: 2, mint: 1, violet: 1, ember: 1 },
  dev: { mint: 4, ocean: 4, midnight: 3, violet: 2, paper: 1, daylight: 1, ember: 1, block: 1 },
  docs: { daylight: 4, paper: 4, midnight: 3, ocean: 2, block: 2, violet: 1, mint: 1, ember: 1 },
  ai: { violet: 4, midnight: 3, ocean: 3, paper: 2, daylight: 2, mint: 1, ember: 1, block: 1 },
  general: { midnight: 3, daylight: 3, violet: 2, ocean: 2, ember: 2, mint: 2, paper: 2, block: 2 },
};
const SECTION_LEAN = {
  'ai-image': 'creator', 'ai-video': 'creator', image: 'creator', design: 'creator', qr: 'creator',
  business: 'money', india: 'money', finance: 'money', time: 'money',
  developer: 'dev', engineering: 'dev', mathematics: 'dev',
  pdf: 'docs', text: 'docs', education: 'docs',
  ai: 'ai',
};
/* Type leanings by palette (editorial palettes like serif and marker). */
const TYPE_LEAN = {
  paper: { serif: 4, marker: 3, caps: 2, outline: 1, gradient: 1 },
  daylight: { marker: 3, gradient: 3, serif: 2, caps: 2, outline: 1 },
  block: { caps: 4, outline: 3, marker: 2, serif: 1, gradient: 2 },
  default: { gradient: 3, outline: 2, marker: 2, caps: 2, serif: 2 },
};
/* Combinations pruned after reviewing the contact sheet (see test-kit.js). */
const PRUNE = [
  { palette: 'block', type: 'gradient', layout: 'split' },
  { palette: 'paper', type: 'outline' },      // a thin stroke on cream reads weakly at feed size
  { palette: 'daylight', type: 'outline' },
  { layout: 'split', type: 'outline' },       // outlined words on the solid field lose the keyword
];

function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function weighted(r, weights) {
  const ks = Object.keys(weights);
  const total = ks.reduce((s, k) => s + weights[k], 0);
  let x = r() * total;
  for (const k of ks) { x -= weights[k]; if (x < 0) return k; }
  return ks[ks.length - 1];
}
function pruned(v) { return PRUNE.some((p) => Object.keys(p).every((k) => p[k] === v[k])); }
function sectionOf(tool) { return String(tool || '').split('/').filter(Boolean)[0] || ''; }

/** The variant for (tool, seed). Pure. */
function pick(tool, seed) {
  const r = rng(hashStr(String(tool)) ^ (seed >>> 0));
  const lean = LEAN[SECTION_LEAN[sectionOf(tool)] || 'general'];
  for (let i = 0; i < 40; i++) {
    const palette = weighted(r, lean);
    const layout = LAYOUTS[Math.floor(r() * LAYOUTS.length)];
    const type = weighted(r, TYPE_LEAN[palette] || TYPE_LEAN.default);
    const copy = Math.floor(r() * 3);
    const v = { layout, palette, type, copy, seed: seed >>> 0 };
    if (!pruned(v)) return v;
  }
  return { layout: 'classic', palette: 'midnight', type: 'gradient', copy: 0, seed: seed >>> 0 };
}

function combo(v) { return v.layout + '|' + v.palette + '|' + v.type; }

/* ---- history ---- */
function historyFile(home) { return path.join(home, 'kits', 'history.json'); }
function loadHistory(home) {
  try { const h = JSON.parse(fs.readFileSync(historyFile(home), 'utf8')); if (h && Array.isArray(h.entries)) return h; } catch (e) { /* new */ }
  return { entries: [] };
}
function saveHistory(home, h) {
  fs.mkdirSync(path.dirname(historyFile(home)), { recursive: true });
  h.entries = h.entries.slice(-500);
  fs.writeFileSync(historyFile(home), JSON.stringify(h, null, 1));
}
function record(home, tool, v, n) {
  const h = loadHistory(home);
  h.entries.push({ tool, n, seed: v.seed, layout: v.layout, palette: v.palette, type: v.type, copy: v.copy, at: new Date().toISOString() });
  saveHistory(home, h);
}

/** Which looks to avoid for this tool: its last 3, and the last 2 of all tools. */
function avoidSets(h, tool) {
  const mine = h.entries.filter((e) => e.tool === tool).slice(-3).map(combo);
  const any = h.entries.slice(-2).map(combo);
  return new Set(mine.concat(any));
}

/** Override fields after the pick, keeping only known values. */
function applyOverrides(v, o) {
  const out = Object.assign({}, v);
  if (o.layout && LAYOUTS.includes(o.layout)) out.layout = o.layout;
  if (o.palette && PAL.IDS.includes(o.palette)) out.palette = o.palette;
  if (o.type && TYPES.includes(o.type)) out.type = o.type;
  if (o.copy != null && o.copy !== '' && !isNaN(+o.copy)) out.copy = Math.abs(+o.copy | 0) % 3;
  return out;
}

/**
 * The variant for a new kit. opts: seed (pure, reproducible), layout, palette,
 * type, copy (overrides), record (default true when no seed is given).
 * Returns { variant, n, how }.
 */
function choose(tool, opts, home) {
  opts = opts || {};
  const h = loadHistory(home);
  const n = h.entries.filter((e) => e.tool === tool).length + 1;
  let v;
  let how;
  if (opts.seed != null && opts.seed !== '' && !isNaN(+opts.seed)) {
    v = pick(tool, +opts.seed >>> 0);
    how = 'seed ' + v.seed;
  } else {
    const avoid = avoidSets(h, tool);
    const last = h.entries.filter((e) => e.tool === tool).slice(-1)[0];
    const lastAny = h.entries.slice(-1)[0];
    // differs from this tool's previous kit in at least two of layout/palette/type
    // (unless overrides pin them), and from the previous kit of any tool in at least one
    const diff = (a, b) => (b ? ['layout', 'palette', 'type'].filter((k) => a[k] !== b[k]).length : 3);
    const free = ['layout', 'palette', 'type'].filter((k) => !opts[k]).length;
    const recentPalettes = opts.palette ? [] : h.entries.slice(-2).map((e) => e.palette);
    const s0 = hashStr(tool + '#' + n);
    // strict first (a feed of kits should not repeat a palette or a layout back to back), then relaxed
    const strict = (w) => !avoid.has(combo(w)) && diff(w, last) >= Math.min(2, free) && diff(w, lastAny) >= Math.min(2, free) && !recentPalettes.includes(w.palette);
    const relaxed = (w) => !avoid.has(combo(w)) && diff(w, last) >= Math.min(2, free) && diff(w, lastAny) >= Math.min(1, free);
    let found = null;
    for (const ok of [strict, relaxed]) {
      for (let k = 0; k < 400 && !found; k++) {
        const c = pick(tool, (s0 + k) >>> 0);
        if (ok(applyOverrides(c, opts))) found = c;
      }
      if (found) break;
    }
    v = found || pick(tool, s0);
    how = 'kit ' + n + ' for this tool (seed ' + v.seed + '; avoided ' + avoid.size + ' recent look' + (avoid.size === 1 ? '' : 's') + ')';
  }
  v = applyOverrides(v, opts);
  if (opts.record !== false) record(home, tool, v, n);
  return { variant: v, n, how };
}

/** n distinct alternative looks starting at seed (for the thumbnail strip). */
function alternatives(tool, seed, n) {
  const out = [];
  const seen = new Set();
  for (let s = seed >>> 0, k = 0; out.length < n && k < n * 20; k++, s = (s + 1) >>> 0) {
    const v = pick(tool, s);
    const c = combo(v);
    if (seen.has(c) || [...seen].some((x) => x.split('|')[1] === v.palette && x.split('|')[0] === v.layout)) continue;
    seen.add(c);
    out.push(v);
  }
  return out;
}

/* ---- copy alternates ---- */

function firstSentence(s) { const m = String(s || '').match(/^[^.!?]+[.!?]/); return m ? m[0].trim() : ''; }

/**
 * The words on the images for copy index c. Every alternate goes through
 * lint.js with the tool's pricing; any that fails (or is too long) is skipped
 * and the story's own line is used instead.
 */
function copyFor(rec, story, c, ex) {
  const { lint } = require('../lint');
  const H = require('../hooks');
  const ok = (t, max) => t && [...t].length <= max && lint(t, { pricing: rec.pricing, section: rec.section, record: rec }).ok;
  const choice = (list, max) => { const good = list.filter((t) => ok(t, max)); return good.length ? good[c % good.length] : list[0]; };
  const ai = rec.pricing === 'freemium';
  const painHook = firstSentence(story.pain);
  // library hooks only where they are about this kind of tool: written for its
  // section, or generic ('*' verb) ones; never a text-tool line on a photo tool
  const pool = H.HOOKS.filter((h) => H.allowed(h, rec, {}) && ((h.sections && h.sections.includes(rec.section)) || h.verb === '*')
    && !(h.angle === 'offline' && /^ai/.test(rec.section)));
  // only lines written for this section (or for AI tools): the generic ones read flat next to a written hook
  const own = pool.filter((h) => h.sections || h.ai);
  const lib = own.length ? own[(c + (rec.path.length % 3)) % own.length].text : '';
  let resultHook = '';
  if (ex && ex.kind === 'calc' && ex.real) {
    const p = (ex.results || []).find((r) => r.primary) || (ex.results || [])[0];
    if (p && p.label && p.value) resultHook = p.label.replace(/[:.]$/, '') + ': ' + p.value + '. Worked out for you.';
  }
  const firstOk = (list, max) => list.find((t) => ok(t, max)) || story.hook;
  const hook = c === 0 ? story.hook
    : c === 1 ? firstOk([painHook.length >= 12 ? painHook : '', lib, story.hook], 64)
      : firstOk([resultHook, lib, story.hook], 64);
  const defCta = ai ? 'Try 10 free runs' : 'Try it free';
  const pick3 = (arr) => arr[c % arr.length];
  return {
    hook,
    hookHighlight: hook === story.hook ? story.highlight : null,
    promise: story.promise,
    painLabel: pick3(['Sound familiar?', 'The problem', 'You know this one']),
    usualTitle: pick3([['Still doing it the hard way?', 'the hard way?'], ['The usual way is a detour.', 'a detour'], ['Why is this still so fiddly?', 'so fiddly?']]),
    turn: pick3(['There is a simpler way', 'There is a better way', 'Here is the fix']),
    fixEyebrow: pick3(['The fix', 'The better way', 'Meet the fix']),
    stepsTitle: pick3([['Three steps. Done.', 'Done.'], ['How it works, in three steps.', 'three steps.'], ['As easy as 1, 2, 3.', '1, 2, 3.']]),
    cta: choice([story.cta, defCta, 'Open the tool'], 24),
  };
}

module.exports = {
  LAYOUTS, TYPES, LAYOUT_LABELS, TYPE_LABELS, PRUNE, LEAN, SECTION_LEAN,
  pick, pruned, choose, alternatives, combo, copyFor, hashStr, rng, loadHistory, historyFile, applyOverrides,
};
