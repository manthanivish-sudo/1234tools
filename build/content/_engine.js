/**
 * Load a calculator's own engine outside the browser, so the figures in
 * build/content/*.js can be computed — and re-checked by
 * build/tests/depth.js — with the very code the page runs.
 *
 *   const { tool } = require('./build/content/_engine.js');
 *   tool('/india/emi-calculator/').compute({ principal: 1500000, rate: 8.5, years: 15 })
 *
 * Each engine is a plain browser script that assigns window.TOOLS[slug];
 * it is run in a fresh vm context with a stub window and nothing else.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const cache = new Map();

/** The engine file and slug a page mounts, read from the page itself. */
function pageEngine(url, root) {
  const base = root || ROOT;
  const abs = path.join(base, url.replace(/^\/+/, ''), 'index.html');
  const html = fs.readFileSync(abs, 'utf8');
  const m = /MVRTool\.mount\(window\.TOOLS\[['"]([^'"]+)['"]\]/.exec(html);
  const slug = m ? m[1] : (/MVRTool\.mountCurrency\(/.test(html) ? 'currency-converter' : null);
  if (!slug) throw new Error('_engine.js: ' + url + ' mounts no calculator');
  const scripts = [];
  const re = /<script src="\/engine\/((?:calc|tool)[^"]*\.js)"/g;
  let s;
  while ((s = re.exec(html))) scripts.push(s[1]);
  const file = scripts.find((f) => f === 'calc-' + slug + '.js') || ('calc-' + slug + '.js');
  /* engine/holidays.js is data the date tools' specs read (window.HOLIDAYS):
     a page that loads it gets it in the same context, before the spec */
  const pre = /<script src="\/engine\/holidays\.js"/.test(html) ? [path.join(base, 'engine', 'holidays.js')] : [];
  return { slug, file: path.join(base, 'engine', file), pre };
}

function load(file, pre) {
  if (cache.has(file)) return cache.get(file);
  const window = { TOOLS: {} };
  const ctx = vm.createContext({ window, console, Intl, Math, Date, Number, String, Array, Object, JSON, isFinite, isNaN, parseFloat, parseInt });
  for (const f of (pre || []).concat(file)) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  cache.set(file, window.TOOLS);
  return window.TOOLS;
}

/** The tool spec (title, inputs, outputs, compute …) a page mounts. */
function tool(url, root) {
  const e = pageEngine(url, root);
  const t = load(e.file, e.pre)[e.slug];
  if (!t) throw new Error('_engine.js: ' + path.basename(e.file) + ' defines no TOOLS["' + e.slug + '"]');
  return t;
}

/** compute() with the spec's defaults filled in under the given inputs. */
function compute(url, inputs, root) {
  const t = tool(url, root);
  const vals = {};
  (t.inputs || []).forEach((i) => {
    let d = i.default;
    if (i.type === 'number') d = d === null || d === undefined || d === '' ? null : Number(d);
    vals[i.key] = d;
  });
  Object.assign(vals, inputs || {});
  return t.compute(vals);
}

module.exports = { tool, compute, pageEngine };
