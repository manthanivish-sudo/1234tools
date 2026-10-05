/**
 * The "Example" panel on every calculator page (build-proof.js calcPanel,
 * from assets/examples.js): what it says you enter and what it says you
 * get, put through the page's engine as it is now. The panel was captured
 * from the live tool on its `captured` date; an engine fixed since then
 * leaves a panel showing the old answer, and this is where that shows.
 *
 * For each panel, in Node:
 *   - every input it shows ("Weight 70") is what its "Try these numbers"
 *     link sets: the same input, the same value (a select's option label);
 *   - every result it shows (the primary and up to two more) is what the
 *     engine gives for the link's inputs today, with the clock held at the
 *     capture date, as the page shows it or to the decimals shown.
 */
'use strict';
const path = require('path');
const fs = require('fs');

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node';
  const file = path.join(K.ROOT, 'assets', 'examples.js');
  if (!fs.existsSync(file)) return;
  const w = {};
  new Function('window', fs.readFileSync(file, 'utf8'))(w);
  const all = w.TOOL_EXAMPLES || {};
  const pageHas = (url) => fs.existsSync(path.join(K.ROOT, url.replace(/^\/+/, ''), 'index.html'));

  for (const [url, ex] of Object.entries(all)) {
    if (ex.kind !== 'calc' || !pageHas(url)) continue;
    if (ex.form === 'currency') {
      manual(url, 'example', ex.results && ex.results[0] ? ex.results[0].value : url, 'rates move daily; the currency example is captured with that day\'s rates (the converter itself is checked against assets/rates.json by the engine tests)');
      continue;
    }
    const now = (ex.captured || '2026-10-04') + 'T12:00:00';
    let spec;
    try { spec = K.calcSpec(url, { now }); } catch (e) {
      claim(url, 'example', ex.title || url, 'the page mounts its engine', N, async () => [false, e.message]);
      continue;
    }
    const given = K.calcHash(spec, ex.try);

    /* what you enter */
    for (const shown of (ex.inputs || []).slice(0, 8)) {
      claim(url, 'example', shown.value, 'Example input "' + shown.label + '" is what Try sets', N, async () => {
        const i = (spec.inputs || []).find((x) => x.label === shown.label || x.label + ' (' + x.unit + ')' === shown.label);
        if (!i) return [false, 'no input labelled "' + shown.label + '" in the engine (labels: ' + (spec.inputs || []).map((x) => x.label).join(', ') + ')'];
        const v = i.key in given ? given[i.key] : K.calcDefaults(spec)[i.key];
        if (i.type === 'select') {
          const opt = (i.options || []).find((o) => String(o.value !== undefined ? o.value : o) === String(v));
          const label = opt === undefined ? undefined : (opt.label !== undefined ? opt.label : String(opt));
          return [label === shown.value, i.key + '=' + v + ' is "' + label + '"'];
        }
        if (i.type === 'number') {
          /* a blank box is a value too: the one Ohm's law solves for */
          if (v === null || v === '' || v === undefined) return [String(shown.value).trim() === '', i.key + ' left blank'];
          return [Number(v) === K.num(shown.value), i.key + '=' + v];
        }
        return [String(v) === String(shown.value), i.key + '=' + K.j(v)];
      });
    }

    /* what you get; a tool that draws random numbers gives another draw each
       time, so its panel is one possible answer and is checked in its own
       section file instead */
    const run = () => spec.compute(Object.assign(K.calcDefaults(spec), given));
    if (K.j(run()) !== K.j(run()) && K.j(run()) !== K.j(run())) {
      manual(url, 'example', (ex.results[0] || {}).value || url, 'a random draw: the panel shows one possible result (checked for range and shape in the section file)');
      continue;
    }
    const primary = ex.results.find((r) => r.primary) || ex.results[0];
    const shownResults = [primary].concat(ex.results.filter((r) => r !== primary).slice(0, 2));
    for (const r of shownResults) {
      claim(url, 'example', r.value, 'Example result "' + r.label + '" matches the engine today', N, async () => {
        const res = run();
        /* several outputs can share a label (Area in sq ft, m² and sq yd):
           the panel's nth "Area" is the nth one the page shows */
        const shownOuts = (spec.outputs || []).filter((x) => x.label === r.label && res[x.key] !== undefined && !(x.format === 'text' && (res[x.key] === '' || res[x.key] === null)));
        const nth = ex.results.filter((x) => x.label === r.label).indexOf(r);
        const o = shownOuts[nth];
        if (!o) return [false, 'the engine shows no ' + (nth ? 'output number ' + (nth + 1) + ' ' : 'output ') + 'labelled "' + r.label + '" for ' + ex.try];
        const v = res[o.key];
        const s = K.calcShow(spec, o.key, v);
        if (s === r.value) return [true, s];
        if (typeof v === 'number' && K.near(r.value, v)) return [true, s + ' (shown as ' + r.value + ')'];
        return [false, 'the engine now gives ' + K.j(s) + ' (' + K.j(v) + ') for ' + ex.try];
      });
    }
  }
};
