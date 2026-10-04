'use strict';
/**
 * Story data for kits: merges every build/promo/stories/<shard>.js (except this
 * file) and answers storyFor(path).
 *
 *   storyFor('/india/gst-calculator/') -> { persona, hook, pain, usual[3], promise,
 *        steps[3], proof[], example, howTo, cta, source: 'story'|'fallback', shard }
 *
 * A written story wins field by field; anything it leaves out (or any tool with
 * no story yet) comes from a fallback built from the tool's own data: the
 * finder-index description and io line, build/jobs.js, and per-section copy
 * that follows the truth rules in kit2-schema.md (generic "usual way" lines,
 * pricing-true proof pills, no invented numbers). Shards are re-read when a
 * file changes, so a running desk picks up new copy.
 */
const fs = require('fs');
const path = require('path');
const T = require('../tools');

const DIR = __dirname;

let cache = { sig: '', map: {}, shardOf: {}, errors: [] };

function shardFiles() {
  let names = [];
  try { names = fs.readdirSync(DIR).filter((n) => /\.js$/.test(n) && n !== 'index.js' && !n.startsWith('_')); } catch (e) { names = []; }
  return names.sort();
}

/** Every shard merged; the first shard (alphabetically) to define a path wins. */
function all() {
  const files = shardFiles();
  const sig = files.map((n) => { try { return n + ':' + fs.statSync(path.join(DIR, n)).mtimeMs; } catch (e) { return n; } }).join('|');
  if (sig === cache.sig) return cache;
  const map = {};
  const shardOf = {};
  const errors = [];
  for (const n of files) {
    const file = path.join(DIR, n);
    try {
      delete require.cache[require.resolve(file)];
      const mod = require(file);
      for (const [k, v] of Object.entries(mod || {})) {
        if (!v || typeof v !== 'object') continue;
        const p = T.normPath(k);
        if (map[p]) { errors.push(n + ': ' + p + ' is also in ' + shardOf[p] + ' (kept the first)'); continue; }
        map[p] = v;
        shardOf[p] = n;
      }
    } catch (e) {
      errors.push(n + ': ' + (e && e.message || e));
    }
  }
  cache = { sig, map, shardOf, errors };
  return cache;
}

/* ------------------------------------------------------------ fallback */

const PERSONA = {
  business: 'Small businesses and freelancers', ai: 'Busy teams and small businesses', pdf: 'Anyone who works with PDFs',
  education: 'Teachers and school staff', india: 'Indian businesses and taxpayers', developer: 'Developers',
  image: 'Creators and designers', 'ai-image': 'Creators, sellers and designers', 'ai-video': 'Creators and video editors',
  text: 'Writers and students', mathematics: 'Students and teachers', finance: 'Anyone planning their money',
  time: 'Planners and remote teams', health: 'Anyone tracking their health', qr: 'Shops, events and marketers',
  utilities: 'Anyone with a quick job to do', engineering: 'Engineers and students', design: 'Designers and makers',
  conversions: 'Students, cooks and travellers',
};

const PAIN = {
  pdf: 'You need one quick change to a PDF, and every route seems to want an upload, an account or a watermark.',
  ai: 'The paperwork piles up, and doing this part by hand eats the hour you meant for real work.',
  business: 'The numbers have to be right today, and the spreadsheet you built last time is gone or broken.',
  india: 'The figure has to match this year\'s rules, and working it out by hand invites a costly slip.',
  developer: 'You need this done in a second, without pasting your data into a site you do not trust.',
  image: 'You need this image fixed now, and the quick route usually means an app, an upload or a watermark.',
  'ai-image': 'You need this photo edit now, and the quick route usually means an upload, an account or a watermark.',
  'ai-video': 'Your video is shot, but the editing is not, and most apps want an upload or a subscription first.',
  text: 'You need a quick answer about your text, without pasting it into an app that wants an account.',
  mathematics: 'You need the answer and the working, and doing it by hand twice still leaves you unsure.',
  finance: 'A big money decision deserves real numbers, not a guess or a rule of thumb.',
  time: 'Counting days, hours or time zones by hand is exactly where the mistakes creep in.',
  health: 'You want a quick, honest number to start from, without handing your details to an app.',
  qr: 'You need a QR code that scans, today, without signing up or paying to keep it working.',
  utilities: 'It is a small job, and it should not need an app, an account or ten minutes.',
  engineering: 'One wrong unit or formula and the whole calculation is off.',
  design: 'Getting sizes and values right by eye takes longer than it should.',
  conversions: 'You need the conversion now, exactly, without wading through a page full of ads.',
  education: 'Marks, grades and timetables take hours by hand, and one slip means doing it twice.',
};

const USUAL = {
  pdf: ['Desktop software you have to install', 'Upload sites that keep your file a while', 'Free plans that stamp a watermark'],
  ai: ['Copying it all out by hand', 'General chat tools that need careful prompts', 'Hours lost to admin, not real work'],
  business: ['A spreadsheet you rebuild every time', 'Calculator apps buried in ads', 'Waiting for someone to check it'],
  india: ['A spreadsheet you rebuild every time', 'Calculator apps buried in ads', 'Asking your accountant again'],
  developer: ['Pasting data into a random site', 'Installing a package for one job', 'Squinting at it by eye'],
  image: ['Heavy editing software for a tiny job', 'Upload sites that keep your file a while', 'Free plans that stamp a watermark'],
  'ai-image': ['Fiddly manual masking in an editor', 'Apps that upload your photo first', 'Free plans that stamp a watermark'],
  'ai-video': ['Typing every caption by hand', 'Apps that upload your video first', 'Free plans that stamp a watermark'],
  text: ['Counting or fixing it by hand', 'Apps that want an account first', 'Pages so full of ads you lose your place'],
  mathematics: ['Working it out on paper twice', 'Calculators that skip the working', 'Pages crowded with ads'],
  finance: ['A rough guess in your head', 'A spreadsheet that takes an evening', 'Calculators that ask for your email'],
  time: ['Counting on a calendar by hand', 'Mental maths across time zones', 'Apps that want an account first'],
  health: ['Guessing from a chart on a wall', 'Apps that want your details first', 'Pages crowded with ads'],
  qr: ['Generators that expire your code later', 'Sign-up walls before the download', 'Logos stamped on the free version'],
  utilities: ['An app you will use once', 'A sign-up for a two-minute job', 'Pages crowded with ads'],
  engineering: ['Hunting for the formula again', 'Unit slips in a spreadsheet', 'Heavy software for a quick check'],
  design: ['Eyeballing it and hoping', 'Heavy software for a quick check', 'Pages crowded with ads'],
  conversions: ['Mental maths and a rough guess', 'Search results full of ads', 'An app you will use once'],
  education: ['Hours of marking by hand', 'Spreadsheets that break mid-term', 'Tools that want every pupil signed up'],
};

const CALC_SECTIONS = ['business', 'india', 'finance', 'mathematics', 'health', 'time', 'utilities', 'engineering', 'design', 'education', 'conversions'];

function cut(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if ([...s].length <= n) return s;
  const head = [...s].slice(0, n + 1).join('');
  const sp = head.lastIndexOf(' ');
  return (sp > n * 0.5 ? head.slice(0, sp) : [...s].slice(0, n).join('')).replace(/[\s,;:—–-]+$/, '');
}
function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
function low(s) { s = String(s || ''); return /^[A-Z]{2,}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1); }
function shortTitle(t) { return String(t || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim(); }

/** The first sentence (or clause) of the description that fits in n. */
function promiseFrom(desc, n) {
  const d = String(desc || '').replace(/\s+/g, ' ').trim();
  if (!d) return '';
  const first = (d.match(/^[^.!?]+[.!?]/) || [d])[0].trim();
  if ([...first].length <= n) return first;
  const parts = first.split(/,\s+|\s+—\s+|;\s+/);
  if (parts[0] && [...parts[0]].length >= 24 && [...parts[0]].length <= n - 1) return parts[0].replace(/[.!?]$/, '') + '.';
  return cut(first, n - 1) + '.';
}

function exampleFallback(rec, io) {
  const s = rec.section;
  if (s === 'ai') return { kind: 'schematic', input: cut(io[0], 60), output: cut(io[1], 60) };
  if (s === 'ai-video') return { kind: 'video', sample: 'speech' };
  if (s === 'ai-image') return { kind: 'image', sample: 'portrait' };
  if (s === 'image') return { kind: 'image', sample: 'landscape' };
  if (s === 'qr') return { kind: 'qr', text: rec.cleanUrl };
  if (s === 'pdf') return /make|create|generat/i.test(rec.verb + ' ' + rec.title) ? { kind: 'pdf-make' } : { kind: 'pdf-edit', sample: 'report' };
  if (CALC_SECTIONS.includes(s) && /calculat|convert/i.test(rec.verb + ' ' + rec.title + ' ' + rec.io)) return { kind: 'calc' };
  return { kind: 'schematic', input: cut(io[0], 60), output: cut(io[1], 60) };
}

function fallback(rec) {
  const io = String(rec.io || 'Your input → result').split('→').map((x) => x.trim());
  io[1] = io[1] || 'result';
  const ai = rec.pricing === 'freemium';
  const onDevice = rec.section === 'ai-image' || rec.section === 'ai-video';
  const left = io[0] || 'your input';
  const right = io[1];
  const lowLeft = low(left);
  const lowRight = low(right);
  const verb = rec.verb || 'Make';
  const add = rec.section === 'pdf' ? 'Drop in your ' + (/pdf/i.test(left) ? 'PDF' : lowLeft)
    : /photo|image/i.test(left) ? 'Drop in your ' + lowLeft
      : /video/i.test(left) ? 'Drop in your video'
        : 'Add your ' + lowLeft;
  const getStep = /pdf|png|jpe?g|mp4|webp|gif|srt|csv|file/i.test(right) ? 'Download the ' + lowRight : 'Copy the ' + lowRight;
  return {
    persona: PERSONA[rec.section] || 'Anyone with a quick job to do',
    hook: cut(cap(left) + ' in. ' + cap(right) + ' out.', 64),
    pain: PAIN[rec.section] || PAIN.utilities,
    usual: (USUAL[rec.section] || USUAL.utilities).slice(),
    promise: promiseFrom(rec.description, 70) || cut(verb + ' ' + lowRight + ' from ' + lowLeft + '.', 70),
    steps: [cut(add, 32), cut(verb + (ai ? ' with one click' : ' in one click'), 32), cut(getStep, 32)],
    proof: ai ? ['10 free runs a month', 'Account needed', 'Says what it sends'] : onDevice ? ['Free', 'Runs on your device', 'No upload'] : ['Free', 'No sign-up', 'Runs in your browser'],
    example: exampleFallback(rec, io),
    howTo: cut('How to use the ' + shortTitle(rec.title) + (ai ? '' : ', free'), 60),
    cta: ai ? 'Try 10 free runs' : 'Try it free',
  };
}

/** The story for a tool path: written copy, completed by the fallback. */
function storyFor(toolPath) {
  const rec = T.record(toolPath);
  const fb = fallback(rec);
  const c = all();
  const written = c.map[rec.path];
  if (!written) return Object.assign(fb, { source: 'fallback', shard: null });
  const out = Object.assign({}, fb);
  for (const k of Object.keys(written)) {
    const v = written[k];
    if (v == null || v === '') continue;
    if (Array.isArray(v) && !v.length) continue;
    out[k] = v;
  }
  if (!Array.isArray(out.usual) || out.usual.length < 3) out.usual = (out.usual || []).concat(fb.usual).slice(0, 3);
  if (!Array.isArray(out.steps) || out.steps.length < 3) out.steps = (out.steps || []).concat(fb.steps).slice(0, 3);
  if (!Array.isArray(out.proof) || !out.proof.length) out.proof = fb.proof;
  if (!out.example || !out.example.kind) out.example = fb.example;
  return Object.assign(out, { source: 'story', shard: c.shardOf[rec.path] });
}

/** Paths that have written stories. */
function written() { return Object.keys(all().map); }
function errors() { return all().errors.slice(); }

module.exports = { storyFor, fallback, written, errors, all };
