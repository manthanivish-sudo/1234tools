(function () {
'use strict';
/* Code Beautifier: JavaScript, CSS and HTML laid out and indented, on
   engine/code-lang.js (loaded first on the page). Only white space changes. */

window.DEV_TOOLS = window.DEV_TOOLS || {};
const CL = () => window.CODE_LANG;
const TYPES = { js: ['js', 'text/javascript', 'JavaScript'], css: ['css', 'text/css', 'CSS'], html: ['html', 'text/html', 'HTML'] };

window.DEV_TOOLS['code-beautifier'] = {
  title: 'Code Beautifier',
  category: 'developer',
  icon: '✨',
  kind: 'code',
  description: 'Make minified or messy JavaScript, CSS and HTML readable again: one statement, rule or block per line, indented as you like. Only white space changes, so the code still works.',
  keywords: ['beautify js', 'javascript beautifier', 'css beautifier', 'html beautifier', 'unminify', 'code formatter', 'pretty print javascript', 'format css'],
  inputLabel: 'Code',
  outputLabel: 'Beautified',
  placeholder: 'Paste minified JavaScript, CSS or HTML',
  sample: 'function totalWithVat(items,rate){const subtotal=items.reduce((sum,item)=>sum+item.price*item.qty,0);const vat=subtotal*rate;if(vat>100){console.warn("large VAT")}return{subtotal:subtotal,vat:vat,total:subtotal+vat}}const basket=[{price:12.5,qty:2},{price:4,qty:3}];console.log(totalWithVat(basket,.2));',
  highlight: function (o, res) { return res && res.lang === 'css' ? 'css' : res && res.lang === 'html' ? 'html' : null; },
  files: { accept: '.js,.mjs,.cjs,.css,.html,.htm,.svg,text/javascript,text/css,text/html', label: 'Open file' },
  download: { ext: 'js', type: 'text/javascript', suffix: '.pretty' },
  filename: function (o, res) { return 'beautified.' + ((res && res.download && res.download.ext) || 'txt'); },
  options: [
    { key: 'lang', label: 'Language', type: 'select', default: 'auto', options: [{ value: 'auto', label: 'Work it out' }, { value: 'js', label: 'JavaScript' }, { value: 'css', label: 'CSS' }, { value: 'html', label: 'HTML' }] },
    { key: 'indent', label: 'Indent', type: 'select', default: '2', options: [{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }, { value: 'tab', label: 'Tab' }] }
  ],
  transform: function (text, o) {
    if (!CL()) return { error: 'The code engine did not load. Reload the page.' };
    const src = String(text);
    if (!src.trim()) return { output: '', note: 'Paste or open JavaScript, CSS or HTML. The language is worked out from the first lines, or set it above.' };
    const lang = o.lang === 'auto' ? CL().sniff(src) : o.lang;
    const opt = { indent: o.indent === 'tab' ? '\t' : o.indent === '4' ? '    ' : '  ' };
    let out, notes = [];
    try {
      if (lang === 'js') out = CL().beautifyJs(src, opt);
      else if (lang === 'css') out = CL().beautifyCss(src, opt);
      else { const r = CL().beautifyHtml(src, opt); out = r.text; notes = r.notes; }
    } catch (e) {
      return { error: 'This is not valid ' + TYPES[lang][2] + ' as far as the beautifier can read it: ' + e.message + '.' + (o.lang === 'auto' ? ' If it is another language, set Language.' : '') };
    }
    const res = {
      output: out,
      lang: lang,
      download: { ext: TYPES[lang][0], type: TYPES[lang][1], suffix: '.pretty' },
      stats: [['Language', TYPES[lang][2] + (o.lang === 'auto' ? ' (worked out)' : '')], ['Lines before', String(src.split('\n').length)], ['Lines after', String(out.replace(/\n$/, '').split('\n').length)], ['Size', CL().size(CL().bytes(src)) + ' → ' + CL().size(CL().bytes(out))]]
    };
    if (notes.length) res.warn = notes.join(' ');
    return res;
  },
  tips: [
    'Minified JavaScript comes back one statement per line, blocks indented, operators spaced; strings, regular expressions and template literals are left exactly as they were.',
    'Every line break already in your JavaScript is kept (at most one blank line), so code written without semicolons runs exactly as before.',
    'CSS gets one declaration per line and one selector per line in a list; HTML gets block elements on their own lines, while short runs of inline text stay together.',
    'List items and table cells move to new lines only where your HTML already had a space between them, because menus and breadcrumbs often show them side by side.',
    'Script and style blocks inside HTML are beautified as JavaScript and CSS; pre, textarea and code are left exactly as they are.',
    'Ctrl+Enter runs it again and Ctrl+S downloads the result with .pretty in the name.'
  ],
  faq: [
    { q: 'Can it undo minification completely?', a: 'It restores the layout, not the names. If a minifier renamed variables to a, b and c, they stay a, b and c; comments that were removed cannot come back.' },
    { q: 'Will the beautified code still run?', a: 'Yes. Only white space changes: the tool never adds or removes a semicolon, a bracket or a word, and it keeps every line break that JavaScript could need.' },
    { q: 'Why is a line in my HTML not split?', a: 'Spaces inside a paragraph show on the page, so text and inline tags such as b, a and span are kept on one line rather than split where a new line would add a visible space.' }
  ]
};
})();
