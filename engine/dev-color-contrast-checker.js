(function () {
'use strict';
/* Colour contrast checker: WCAG 2.x contrast for one pair or a list of pairs.
   The colour maths is the Colour Converter's (engine/dev-color-converter.js,
   loaded first on the page: window.MVR_COLOUR); this file adds the checks,
   the list mode and the page's own previews. */

window.DEV_TOOLS = window.DEV_TOOLS || {};
const C = () => window.MVR_COLOUR;

/** WCAG says a ratio must not be rounded up to pass: cut to two decimals. */
const shown = (r) => (Math.floor(r * 100 + 1e-9) / 100).toFixed(2);

/** a colour, blended: a see-through foreground onto the background, a see-through background onto white */
function pair(fgText, bgText) {
  const cc = C();
  const f = cc.parse(fgText);
  let b;
  try { b = cc.parse(bgText); } catch (e) { throw new Error('Background: ' + e.message); }
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  let bg = b.rgb.map(clamp);
  const notes = [];
  if (b.a < 1) { bg = bg.map((v) => clamp(v * b.a + 255 * (1 - b.a))); notes.push('The background is see-through; it was blended onto white.'); }
  let fg = f.rgb.map(clamp);
  if (f.a < 1) { fg = fg.map((v, i) => clamp(v * f.a + bg[i] * (1 - f.a))); notes.push('The text colour is see-through; it was blended onto the background, ' + cc.hex(fg) + ' as shown.'); }
  if (f.clipped || b.clipped) notes.push('A colour outside the sRGB screen range was moved to the nearest one inside it.');
  const ratio = cc.ratio(fg, bg);
  return { fg: fg, bg: bg, ratio: ratio, notes: notes, fgLum: cc.lum(fg), bgLum: cc.lum(bg) };
}

const LEVELS = [
  ['Normal text AA', 4.5], ['Normal text AAA', 7], ['Large text AA', 3], ['Large text AAA', 4.5], ['Interface parts and graphics', 3]
];
const verdict = (r, t) => (r >= t ? 'Pass' : 'Fail');

/** the colours in a line of the list: two CSS colours, split by "on", a tab, | ; or spaces */
const COLOUR_RE = /#[0-9a-f]{3,8}\b|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|cmyk|device-cmyk)\([^)]*\)|\b[a-z]{3,20}\b/gi;
function splitPair(line) {
  const s = line.trim();
  let parts = s.split(/\s+on\s+|\t|\s*\|\s*|\s*;\s*/i).filter(Boolean);
  if (parts.length === 2) return parts;
  parts = (s.match(COLOUR_RE) || []).filter((t) => t.toLowerCase() !== 'on');
  return parts.length >= 2 ? parts.slice(0, 2) : null;
}

window.DEV_TOOLS['color-contrast-checker'] = {
  title: 'Colour Contrast Checker',
  category: 'developer',
  icon: '◐',
  kind: 'generate',
  description: 'Check text and background colours against WCAG 2 AA and AAA, see them on real text and buttons, get the nearest colours that pass, and check a whole list of pairs at once.',
  keywords: ['color contrast checker', 'colour contrast checker', 'wcag contrast checker', 'contrast ratio', 'accessibility color checker', 'aa aaa contrast', 'text contrast'],
  outputLabel: 'Contrast report',
  filename: 'contrast-report.txt',
  download: { ext: 'txt', type: 'text/plain' },
  fields: [
    { key: 'fg', label: 'Text colour (any CSS colour)', type: 'text', default: '#767676' },
    { key: 'bg', label: 'Background colour', type: 'text', default: '#ffffff' },
    { key: 'pairs', label: 'More pairs to check, one per line (text colour, then background)', type: 'textarea', default: '' }
  ],
  generate: function (f) {
    if (!C()) return { error: 'The colour engine did not load. Reload the page.' };
    let p;
    try { p = pair(f.fg, f.bg); } catch (e) { return { error: e.message }; }
    const cc = C();
    const r = p.ratio;
    const lines = [
      'Text        ' + cc.hex(p.fg).toUpperCase() + '   relative luminance ' + p.fgLum.toFixed(4),
      'Background  ' + cc.hex(p.bg).toUpperCase() + '   relative luminance ' + p.bgLum.toFixed(4),
      'Contrast    ' + shown(r) + ':1',
      ''
    ].concat(LEVELS.map((l) => (l[0] + ' (' + l[1] + ':1)').padEnd(36) + verdict(r, l[1])));
    /* the nearest passing colours, either way round */
    const fixes = [];
    [['Normal text AA', 4.5], ['Normal text AAA', 7], ['Large text and interface parts', 3]].forEach((t) => {
      if (r >= t[1]) return;
      const a = cc.fix(p.fg, p.bg, t[1]);
      const b = cc.fix(p.bg, p.fg, t[1]);
      fixes.push({ label: t[0], target: t[1], fg: a && !a.same ? cc.hex(a.rgb) : null, fgRatio: a ? cc.ratio(a.rgb, p.bg) : 0, bg: b && !b.same ? cc.hex(b.rgb) : null, bgRatio: b ? cc.ratio(p.fg, b.rgb) : 0 });
    });
    if (fixes.length) {
      lines.push('', 'Nearest colours that pass (same hue, lightness moved in OKLCH):');
      fixes.forEach((x) => {
        lines.push('  ' + x.label + ' (' + x.target + ':1): text ' + (x.fg ? x.fg + ' (' + shown(x.fgRatio) + ':1)' : 'none of this hue') + ', or background ' + (x.bg ? x.bg + ' (' + shown(x.bgRatio) + ':1)' : 'none of this hue'));
      });
    }
    /* the list */
    const rows = [], bad = [];
    String(f.pairs || '').split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return;
      const two = splitPair(line);
      if (!two) { bad.push('Line ' + (i + 1) + ': two colours are needed, such as #333 on #fff.'); return; }
      try {
        const q = pair(two[0], two[1]);
        rows.push({ line: i + 1, fgText: two[0], bgText: two[1], fg: cc.hex(q.fg), bg: cc.hex(q.bg), ratio: q.ratio });
      } catch (e) { bad.push('Line ' + (i + 1) + ': ' + e.message); }
    });
    if (rows.length) {
      lines.push('', 'List (' + rows.length + ' pair' + (rows.length === 1 ? '' : 's') + '):');
      rows.forEach((x) => {
        lines.push('  ' + (x.fg + ' on ' + x.bg).padEnd(20) + (shown(x.ratio) + ':1').padStart(8) + '   normal ' + (x.ratio >= 7 ? 'AAA ' : x.ratio >= 4.5 ? 'AA  ' : 'fail') + '   large ' + (x.ratio >= 4.5 ? 'AAA' : x.ratio >= 3 ? 'AA' : 'fail'));
      });
    }
    const stats = [['Contrast ratio', shown(r) + ':1']].concat(LEVELS.map((l) => [l[0], verdict(r, l[1])]));
    if (rows.length) stats.push(['Pairs in the list passing AA', rows.filter((x) => x.ratio >= 4.5).length + ' of ' + rows.length]);
    const warn = bad.concat(p.notes).join(' ');
    const res = { output: lines.join('\n'), stats: stats, pair: { fg: cc.hex(p.fg), bg: cc.hex(p.bg), ratio: r }, fixes: fixes, rows: rows };
    if (warn) res.warn = warn;
    return res;
  },
  tips: [
    'WCAG 2 asks for 4.5:1 for normal text and 3:1 for large text, which is 24 px, or 18.66 px in bold. AAA raises these to 7:1 and 4.5:1.',
    'Icons, form field borders, focus rings and chart lines need 3:1 against what is next to them (WCAG 1.4.11).',
    'The ratio is cut to two decimals, never rounded up, so 4.499:1 shows as 4.49:1 and fails, as WCAG intends.',
    'Paste a list of pairs, one per line, such as #555 on #f5f5f5, to check a whole palette or a theme’s tokens at once.',
    'A see-through text colour, such as rgb(0 0 0 / 60%), is blended onto the background first, which is how it is seen.',
    'A link to this page can carry the pair: add ?fg=1a1a1a&bg=f7c948, and fcolor and bcolor are read too.'
  ],
  faq: [
    { q: 'Why does my pair fail when it looks readable?', a: 'Contrast is worked out from relative luminance, not from how strong a colour looks. Saturated yellow, orange and cyan are much lighter than they seem, so they fail on white, while the same hues pass easily on near-black.' },
    { q: 'What counts as large text?', a: 'At least 18 point (24 CSS pixels) at normal weight, or 14 point (about 18.66 CSS pixels) in bold. Everything smaller is normal text and needs the higher ratio.' },
    { q: 'Does passing the ratio make my page accessible?', a: 'It covers one success criterion. Colour must also not be the only way information is shown, and real users, including people with low vision, are the final test.' }
  ],
  mount: function (ctx) { ccxMount(ctx); },
  render: function (res, ctx) { ccxRender(res, ctx); }
};

/* ---------- the page: pickers, swap, eyedropper, link parameters ---------- */
function ccxMount(ctx) {
  const el = ctx.el;
  /* fcolor / bcolor, as other checkers write them, are read like fg / bg */
  try {
    const q = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
    const hexish = (v) => (/^#?[0-9a-f]{3,8}$/i.test(v || '') ? (v[0] === '#' ? v : '#' + v) : null);
    const fc = hexish(q.get('fcolor')), bc = hexish(q.get('bcolor'));
    if (fc && !q.get('fg')) ctx.setField('fg', fc);
    if (bc && !q.get('bg')) ctx.setField('bg', bc);
    const fg = q.get('fg'), bg = q.get('bg');
    if (fg && hexish(fg) && hexish(fg) !== fg) ctx.setField('fg', hexish(fg));
    if (bg && hexish(bg) && hexish(bg) !== bg) ctx.setField('bg', hexish(bg));
  } catch (e) { /* no link parameters */ }
  const row = el('div', 'cc-tools ccx-tools');
  const mk = (key, label) => {
    const w = el('label', 'cc-pick');
    const inp = el('input');
    inp.type = 'color';
    inp.setAttribute('aria-label', 'Choose the ' + label.toLowerCase() + ' with a colour chooser');
    inp.addEventListener('input', function () { ctx.setField(key, inp.value); ctx.run(); });
    w.appendChild(el('span', null, label + ':'));
    w.appendChild(inp);
    row.appendChild(w);
    return inp;
  };
  ctx.ccx = { fg: mk('fg', 'Text'), bg: mk('bg', 'Background') };
  const swap = el('button', 'btn-ghost', 'Swap colours');
  swap.type = 'button';
  swap.addEventListener('click', function () { const f = ctx.fields(); ctx.setField('fg', f.bg); ctx.setField('bg', f.fg); ctx.run(); });
  row.appendChild(swap);
  if (window.EyeDropper) {
    ['fg', 'bg'].forEach(function (k) {
      const b = el('button', 'btn-ghost', 'Pick ' + (k === 'fg' ? 'text' : 'background') + ' from the screen');
      b.type = 'button';
      b.addEventListener('click', function () {
        new window.EyeDropper().open().then(function (r) { ctx.setField(k, r.sRGBHex); ctx.run(); }, function () { /* cancelled */ });
      });
      row.appendChild(b);
    });
  }
  /* the pickers sit right under the two colour fields */
  const third = ctx.form.querySelectorAll('.field')[2];
  if (third) ctx.form.insertBefore(row, third); else ctx.form.appendChild(row);
  const preview = el('div', 'ccx-preview');
  preview.setAttribute('aria-label', 'Preview of the pair');
  ctx.outputPane.insertBefore(preview, ctx.outputPane.querySelector('.io-msg'));
  ctx.ccx.preview = preview;
}

function ccxRender(res, ctx) {
  const el = ctx.el, cc = C();
  const box = ctx.extra;
  box.textContent = '';
  const pv = ctx.ccx && ctx.ccx.preview;
  if (pv) pv.textContent = '';
  if (!res || res.error || !res.pair) return;
  const P = res.pair;
  if (ctx.ccx) { ctx.ccx.fg.value = P.fg; ctx.ccx.bg.value = P.bg; }
  if (pv) {
    pv.style.background = P.bg;
    pv.style.color = P.fg;
    const big = el('div', 'ccx-ratio');
    big.appendChild(el('strong', null, shown(P.ratio) + ':1'));
    big.appendChild(el('span', null, P.ratio >= 7 ? 'AAA for all text' : P.ratio >= 4.5 ? 'AA for all text' : P.ratio >= 3 ? 'Large text and interface parts only' : 'Fails for text'));
    pv.appendChild(big);
    pv.appendChild(el('p', 'ccx-normal', 'Normal text, 16 px: the quick brown fox jumps over the lazy dog.'));
    pv.appendChild(el('p', 'ccx-large', 'Large text, 24 px'));
    pv.appendChild(el('p', 'ccx-bold', 'Bold text, 18.66 px'));
    const ui = el('div', 'ccx-ui');
    const btn = el('span', 'ccx-btn', 'Button');
    btn.style.borderColor = P.fg;
    const inp = el('span', 'ccx-input', 'Form field');
    inp.style.borderColor = P.fg;
    const icon = el('span', 'ccx-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.style.background = P.fg;
    ui.appendChild(btn); ui.appendChild(inp); ui.appendChild(icon);
    pv.appendChild(ui);
  }
  if (res.fixes && res.fixes.length) {
    const pane = el('div', 'io-pane cc-group');
    const head = el('div', 'io-head');
    head.appendChild(el('span', 'io-label', 'Nearest colours that pass'));
    pane.appendChild(head);
    const row = el('div', 'cc-row');
    res.fixes.forEach(function (x) {
      [['fg', 'text'], ['bg', 'background']].forEach(function (k) {
        const hex = x[k[0]];
        if (!hex) return;
        const c = el('div', 'cc-fix');
        const s = el('div', 'cc-fix-sample', 'Sample text');
        s.style.color = k[0] === 'fg' ? hex : P.fg;
        s.style.background = k[0] === 'bg' ? hex : P.bg;
        c.appendChild(s);
        const use = el('button', 'btn-ghost', 'Use ' + hex);
        use.type = 'button';
        use.setAttribute('aria-label', 'Use ' + hex + ' as the ' + k[1] + ' colour');
        use.addEventListener('click', function () { ctx.setField(k[0], hex); ctx.run(); });
        c.appendChild(use);
        c.appendChild(el('span', 'cc-cap', x.label + ': new ' + k[1] + ', ' + shown(x[k[0] + 'Ratio']) + ':1'));
        row.appendChild(c);
      });
    });
    pane.appendChild(row);
    box.appendChild(pane);
  }
  /* the pair as people with colour blindness see it, each with its own ratio */
  const pane = el('div', 'io-pane cc-group');
  const head = el('div', 'io-head');
  head.appendChild(el('span', 'io-label', 'The pair with colour blindness (simulated)'));
  pane.appendChild(head);
  const row = el('div', 'cc-row');
  const fs = cc.simulate(cc.parse(P.fg).rgb), bs = cc.simulate(cc.parse(P.bg).rgb);
  cc.cvdNames.forEach(function (name, i) {
    const c = el('div', 'cc-fix');
    const s = el('div', 'cc-fix-sample', 'Sample text');
    s.style.color = cc.hex(fs[i]);
    s.style.background = cc.hex(bs[i]);
    c.appendChild(s);
    c.appendChild(el('span', 'cc-cap', name + ': ' + shown(cc.ratio(fs[i].map(Math.round), bs[i].map(Math.round))) + ':1'));
    row.appendChild(c);
  });
  pane.appendChild(row);
  pane.appendChild(el('p', 'cc-note', 'Machado, Oliveira and Fernandes (2009), full severity. An approximation, not a test with real users.'));
  box.appendChild(pane);
  if (res.rows && res.rows.length) {
    const lp = el('div', 'io-pane cc-group');
    const lh = el('div', 'io-head');
    lh.appendChild(el('span', 'io-label', 'Your list'));
    lp.appendChild(lh);
    const wrap = el('div', 'ccx-table-wrap');
    const t = el('table', 'ccx-table');
    const tr0 = el('tr');
    ['Line', 'Sample', 'Text', 'Background', 'Ratio', 'Normal text', 'Large text'].forEach(function (h) { const th = el('th', null, h); th.scope = 'col'; tr0.appendChild(th); });
    const thead = el('thead'); thead.appendChild(tr0); t.appendChild(thead);
    const tb = el('tbody');
    res.rows.forEach(function (x) {
      const tr = el('tr');
      tr.appendChild(el('td', null, String(x.line)));
      const sc = el('td');
      const sm = el('span', 'ccx-sample', 'Aa');
      sm.style.color = x.fg; sm.style.background = x.bg;
      sc.appendChild(sm); tr.appendChild(sc);
      tr.appendChild(el('td', 'ccx-mono', x.fg));
      tr.appendChild(el('td', 'ccx-mono', x.bg));
      tr.appendChild(el('td', 'ccx-mono', shown(x.ratio) + ':1'));
      const lv = (r, a, b) => r >= b ? 'AAA' : r >= a ? 'AA' : 'Fail';
      const n = lv(x.ratio, 4.5, 7), l = lv(x.ratio, 3, 4.5);
      tr.appendChild(el('td', n === 'Fail' ? 'ccx-fail' : 'ccx-pass', n));
      tr.appendChild(el('td', l === 'Fail' ? 'ccx-fail' : 'ccx-pass', l));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    lp.appendChild(wrap);
    box.appendChild(lp);
  }
}

window.DEV_TOOLS['color-contrast-checker']._lib = { shown: shown, splitPair: splitPair, pair: pair };
})();
