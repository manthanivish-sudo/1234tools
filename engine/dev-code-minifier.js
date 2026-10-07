(function () {
'use strict';
/* Code Minifier: JavaScript, CSS and HTML, on engine/code-lang.js (loaded
   first on the page). White space and comments only: nothing is renamed or
   rewritten, so the minified code does what the original did. */

window.DEV_TOOLS = window.DEV_TOOLS || {};
const CL = () => window.CODE_LANG;
const TYPES = { js: ['js', 'text/javascript', 'JavaScript'], css: ['css', 'text/css', 'CSS'], html: ['html', 'text/html', 'HTML'] };

window.DEV_TOOLS['code-minifier'] = {
  title: 'Code Minifier',
  category: 'developer',
  icon: '🗜',
  kind: 'code',
  description: 'Minify JavaScript, CSS and HTML in your browser. Comments and spare white space go; names and logic stay exactly as written, so nothing breaks. Sizes before and after, gzipped too.',
  keywords: ['minify js', 'javascript minifier', 'css minifier', 'html minifier', 'minify css', 'minify html', 'code compressor', 'compress javascript'],
  inputLabel: 'Code',
  outputLabel: 'Minified',
  placeholder: 'Paste JavaScript, CSS or HTML',
  sample: '/*! Price widget v2 | MIT */\n// work out the total with VAT\nfunction totalWithVat(items, rate) {\n  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);\n  const vat = subtotal * rate;   // rate as a fraction\n  return {\n    subtotal: subtotal,\n    vat: vat,\n    total: subtotal + vat\n  };\n}\n\nconst basket = [{ price: 12.5, qty: 2 }, { price: 4, qty: 3 }];\nconsole.log(totalWithVat(basket, 0.2));\n',
  highlight: function (o, res) { return res && res.lang === 'css' ? 'css' : res && res.lang === 'html' ? 'html' : null; },
  files: { accept: '.js,.mjs,.cjs,.css,.html,.htm,.svg,text/javascript,text/css,text/html', label: 'Open file' },
  download: { ext: 'js', type: 'text/javascript', suffix: '.min' },
  filename: function (o, res) { return 'minified.' + ((res && res.download && res.download.ext) || 'txt'); },
  options: [
    { key: 'lang', label: 'Language', type: 'select', default: 'auto', options: [{ value: 'auto', label: 'Work it out' }, { value: 'js', label: 'JavaScript' }, { value: 'css', label: 'CSS' }, { value: 'html', label: 'HTML' }] },
    { key: 'keepLicence', label: 'Keep licence comments (/*! … */, @license)', type: 'check', default: 'yes' },
    { key: 'htmlComments', label: 'HTML comments', type: 'select', default: 'drop', options: [{ value: 'drop', label: 'Remove (keep conditional ones)' }, { value: 'keep', label: 'Keep' }] },
    { key: 'inner', label: 'Inline <script> and <style>', type: 'select', default: 'min', options: [{ value: 'min', label: 'Minify them too' }, { value: 'keep', label: 'Leave as they are' }] }
  ],
  transform: function (text, o) {
    if (!CL()) return { error: 'The code engine did not load. Reload the page.' };
    const src = String(text);
    if (!src.trim()) return { output: '', note: 'Paste or open JavaScript, CSS or HTML. The language is worked out from the first lines, or set it above.' };
    const lang = o.lang === 'auto' ? CL().sniff(src) : o.lang;
    const opt = { keepLicence: o.keepLicence !== 'no', htmlComments: o.htmlComments, inner: o.inner };
    let out, notes = [];
    try {
      if (lang === 'js') out = CL().minifyJs(src, opt);
      else if (lang === 'css') out = CL().minifyCss(src, opt);
      else { const r = CL().minifyHtml(src, opt); out = r.text; notes = r.notes; }
    } catch (e) {
      return { error: 'This is not valid ' + TYPES[lang][2] + ' as far as the minifier can read it: ' + e.message + '.' + (o.lang === 'auto' ? ' If it is another language, set Language.' : '') };
    }
    const a = CL().bytes(src), b = CL().bytes(out);
    const res = {
      output: out,
      lang: lang,
      download: { ext: TYPES[lang][0], type: TYPES[lang][1], suffix: '.min' },
      stats: [['Language', TYPES[lang][2] + (o.lang === 'auto' ? ' (worked out)' : '')], ['Before', CL().size(a)], ['After', CL().size(b)], ['Saved', (a ? Math.round((1 - b / a) * 1000) / 10 : 0) + '%']]
    };
    if (notes.length) res.warn = notes.join(' ');
    return res;
  },
  render: function (res, ctx) { gzipStat(res, ctx); },
  tips: [
    'JavaScript keeps every name and every statement: only comments and white space go, and a line break stays wherever removing it could change where JavaScript ends a statement.',
    'Licence comments that start with /*! or carry @license or @preserve are kept unless you untick the box, as most open-source licences ask.',
    'CSS also loses the last semicolon in each block and empty rules, and writes #aabbcc as #abc and 0.5em as .5em.',
    'HTML keeps the text inside pre and textarea exactly, and every attribute value as typed. Spaces between words stay; spaces next to block elements, which a browser does not show, go.',
    'The Gzipped figure is what most servers send: compare that, not the raw size, to judge the saving.'
  ],
  faq: [
    { q: 'Does it rename variables like other minifiers?', a: 'No. Renaming and rewriting save more, but they need a full JavaScript parser to stay safe; this tool removes only comments and white space, so the result does exactly what your code did. For the last few per cent, use a build tool such as a bundler.' },
    { q: 'Is my code uploaded?', a: 'No. It is minified by code that runs in this page; nothing you paste or open leaves your device.' },
    { q: 'Why is a line break left in the JavaScript?', a: 'Where code relies on automatic semicolons, as in a line ending in b followed by a line starting with ++c, joining the lines would change what runs. Those breaks stay; every other one goes.' }
  ]
};

/* the gzip size, measured with the browser's own CompressionStream */
function gzipStat(res, ctx) {
  if (!res || res.error || !res.output || typeof CompressionStream !== 'function') return;
  const mine = ctx.result;
  const measure = (t) => new Response(new Blob([t]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer().then((b) => b.byteLength);
  Promise.all([measure(ctx.text), measure(res.output)]).then(function (n) {
    if (ctx.result !== mine) return;
    const row = ctx.el('div', 'stat-row');
    row.appendChild(ctx.el('span', 'stat-key', 'Gzipped'));
    row.appendChild(ctx.el('span', 'stat-val', ctx.fmtSize(n[0]) + ' → ' + ctx.fmtSize(n[1])));
    ctx.stats.appendChild(row);
  }, function () { /* no gzip figure */ });
}
})();
