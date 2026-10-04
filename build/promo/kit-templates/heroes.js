'use strict';
/**
 * Hero frames: the example, shown big. One function per example kind.
 *
 *   hero(ex, { rec, compact, fmt })  -> HTML that fills a .herobox
 *
 * ex is the normalised example built by kit.js (images already data: URLs):
 *   calc        { inputs:[{label,value}], results:[{label,value,primary}] }
 *   text        { input, output, inputLabel, outputLabel }
 *   document    { page, fileName }
 *   beforeAfter { before, after, alpha, variant:'photo'|'document'|'video' }
 *   image       { after }
 *   schematic   { input, output, sampleIn, sampleOut }
 */
const P = require('./parts');
const { esc, icon, glyph } = P;

function heroCalc(ex, o) {
  const inputs = (ex.inputs || []).slice(0, o.compact ? 2 : 3);
  const res = ex.results || [];
  const primary = res.find((r) => r.primary) || res[0] || { label: 'Result', value: '' };
  const others = res.filter((r) => r !== primary).slice(0, o.compact ? 1 : 3);
  const row = (r) => '<div class="tk-row"><span class="l">' + esc(r.label) + '</span><span class="v">' + esc(r.value) + '</span></div>';
  return `<div class="hero h-calc${o.compact ? ' compact' : ''}"><div class="tk-wrap"><div class="tk" data-fit="css,0.62" data-order="20" data-drop=".tk-in .tk-row, .tk-out .tk-row" data-noclamp="1">
    <div class="tk-head"><span class="tk-ico">${glyph(o.rec.glyph, 'i-' + o.rec.section)}</span><span class="tk-title">${esc(o.rec.title)}</span><span class="tk-live"><i></i>Live result</span></div>
    ${inputs.length ? '<div class="tk-in">' + inputs.map(row).join('') + '</div>' : ''}
    <div class="tk-tear"><i></i><b></b></div>
    <div class="tk-prim"><div class="tk-plabel">${esc(primary.label)}</div><div class="tk-pval" data-fit="css,0.35" data-mode="line" data-order="30"><span class="hl">${esc(primary.value)}</span></div></div>
    ${others.length ? '<div class="tk-out">' + others.map(row).join('') + '</div>' : ''}
  </div></div></div>`;
}

function heroCode(ex, o) {
  const plainIn = !P.looksLikeCode(ex.input);
  const plainOut = !P.looksLikeCode(ex.output);
  const outLabel = ex.outputLabel || 'Output';
  return `<div class="hero h-code${o.compact ? ' compact' : ''}"><div class="win">
    <div class="win-bar"><i class="d r"></i><i class="d y"></i><i class="d g"></i><span class="win-title">${esc(o.rec.title)}</span><span class="win-tag"><i></i>Live output</span></div>
    ${o.compact ? '' : `<div class="pane in"><span class="pane-label">${esc(ex.inputLabel || 'Input')}</span><div class="code" data-fit="css,0.6" data-clip="1" data-order="20">${P.codeHtml(ex.input, { plain: plainIn })}</div></div>
    <div class="pane-sep"><span>${icon('arrowDown')}${esc(outLabel)}</span></div>`}
    <div class="pane out"><span class="pane-label">${esc(outLabel)}</span><div class="code" data-fit="css,0.6" data-clip="1" data-order="21">${P.codeHtml(ex.output, { plain: plainOut })}</div></div>
  </div></div>`;
}

function heroDoc(ex, o) {
  const name = ex.fileName || (o.rec.slug + '.pdf');
  return `<div class="hero h-doc${o.compact ? ' compact' : ''}"><div class="viewer">
    <div class="v-bar"><span class="pdfb">PDF</span><span class="v-name">${esc(name)}</span><span class="v-tools"><span>Page 1</span><b>Download</b></span></div>
    <div class="v-stage" data-doc="1" data-loupe="${o.compact ? 0 : 1}"><img class="v-page" src="${ex.page}" alt=""></div>
  </div></div>`;
}

function heroSplit(ex, o) {
  const diag = o.diag;
  const seam = diag
    ? '<svg class="seam-d" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="64" y1="0" x2="36" y2="100" stroke="#fff" stroke-width="0.9" vector-effect="non-scaling-stroke" style="stroke-width:6px;filter:drop-shadow(0 0 6px rgba(0,0,0,.5))"/></svg>'
    : '<div class="seam"></div>';
  return `<div class="hero h-split"><div class="ba${diag ? ' diag' : ''}${o.fill ? ' fill' : ''}" ${o.fill ? '' : 'data-contain="' + (o.compact ? 1 : 0.98) + '"'} data-ar-from="img.before">
    <img class="before" src="${ex.before}" alt="">
    <div class="after">${ex.alpha ? '<div class="checker"></div>' : ''}<img src="${ex.after}" alt=""></div>
    ${seam}
    <div class="handle">${icon('lr')}</div>
    <span class="tag l">Before</span><span class="tag r">After</span>
  </div></div>`;
}

function heroVideo(ex, o) {
  return `<div class="hero h-video"><div class="player${o.fill ? ' fill' : ''}" ${o.fill ? '' : 'data-contain="' + (o.compact ? 1 : 0.96) + '"'} data-ar-from="img.main" data-inset="${ex.before ? 1 : 0}">
    <img class="main" src="${ex.after}" alt="">
    <div class="ctrl">${icon('play')}<div class="scrub"><i></i><b></b></div><span class="ccb">CC</span></div>
  </div>${ex.before ? `<div class="inset" data-inset-of=".player"><img src="${ex.before}" alt=""><span>Before</span></div>` : ''}</div>`;
}

function heroPages(ex, o) {
  return `<div class="hero h-pages" data-pages="1">
    <figure class="pg before"><img src="${ex.before}" alt=""><figcaption>Before</figcaption></figure>
    <div class="arrowchip">${icon('arrow')}</div>
    <figure class="pg after"><img src="${ex.after}" alt=""><figcaption>After</figcaption></figure>
  </div>`;
}

function heroImage(ex, o) {
  return `<div class="hero h-image"><div class="imgtile${o.fill ? ' fill' : ''}" ${o.fill ? '' : 'data-contain="' + (o.compact ? 0.98 : 0.9) + '"'} data-ar-from="img"><img src="${ex.after}" alt=""></div></div>`;
}

/* ---- schematic ---- */
function kindOf(words, side) {
  const w = String(words || '').toLowerCase();
  if (side === 'out') {
    if (/table|csv|excel|spreadsheet|rows|sheet|columns/.test(w)) return 'table';
    if (/chart|graph/.test(w)) return 'chart';
    if (/png|jpe?g|image|photo|picture/.test(w)) return 'photo';
    if (/video|mp4|clip/.test(w)) return 'film';
    if (/qr/.test(w)) return 'qr';
    if (/email|reply|message/.test(w)) return 'mail';
    if (/pdf|document|letter|report|contract|invoice|plan|cv|résumé|resume/.test(w)) return 'doc';
    return 'text';
  }
  if (/photo|image|picture|selfie|scan|screenshot/.test(w)) return 'photo';
  if (/video|clip|mp4/.test(w)) return 'film';
  if (/audio|voice|recording|speech/.test(w)) return 'wave';
  if (/pdf|invoice|receipt|document|contract|letter|statement|cv|résumé|resume|form|bill|payslip/.test(w)) return 'doc';
  if (/csv|excel|spreadsheet|table|data/.test(w)) return 'table';
  return 'text';
}
/**
 * Table rows from sample text. "Vendor: Sharma; Total: ₹11,800" -> [[k,v]...];
 * "INV-0417 | Steel brackets | qty 12 | CGST 9%" -> [['','INV-0417'],['','Steel brackets'],['qty','12'],['CGST','9%']].
 * null when nothing in it looks like a field.
 */
function pairs(s) {
  const parts = String(s || '').split(/\s*(?:;|\n|\||·)\s*/).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const kv = parts.map((p) => {
    let m = p.match(/^([^:=]{1,28}?)\s*[:=]\s*(.+)$/);
    if (m) return [m[1].trim(), m[2].trim()];
    m = p.match(/^([A-Za-z][A-Za-z .#/-]{0,16}?)\s+([₹£$€]?\d[\d,.]*\s?%?|@\s?[\d,.]+)$/);
    if (m) return [m[1].trim(), m[2].trim()];
    return ['', p];
  });
  return kv.some((r) => r[0]) ? kv : null;
}
function lines(s) { return String(s || '').split(/\s*(?:;|\n|·)\s*/).map((x) => x.trim()).filter(Boolean); }

function cardIn(ex) {
  const k = kindOf(ex.input, 'in');
  const sample = ex.sampleIn ? '<div class="smp" data-fit="css,0.6" data-clip="1" data-order="22">' + esc(lines(ex.sampleIn).join('\n')) + '</div><span class="illus">Illustration</span>' : '';
  if (k === 'doc' || (k === 'text' && ex.sampleIn)) {
    const head = /invoice/i.test(ex.input + ' ' + ex.sampleIn) ? 'Invoice' : /receipt/i.test(ex.input + ' ' + ex.sampleIn) ? 'Receipt' : /contract/i.test(ex.input) ? 'Contract' : /statement/i.test(ex.input) ? 'Statement' : /cv|résumé|resume/i.test(ex.input) ? 'CV' : k === 'doc' ? 'Document' : 'Text';
    return `<div class="fl-card paper"><div class="hd2"><i></i><b>${esc(head)}</b></div>${sample || '<div class="sk" style="width:86%"></div><div class="sk" style="width:64%"></div><div class="sk" style="width:92%"></div><div class="sk" style="width:48%"></div><div class="sk" style="width:78%"></div><div class="sk" style="width:58%"></div>'}</div>`;
  }
  return `<div class="fl-card dark">${sample ? '<div style="padding:1em">' + sample + '</div>' : '<div class="big">' + icon(k === 'film' ? 'film' : k === 'wave' ? 'wave' : k === 'photo' ? 'photo' : k === 'table' ? 'table' : 'text') + '</div>'}</div>`;
}
function cardOut(ex) {
  const k = kindOf(ex.output, 'out');
  const kv = pairs(ex.sampleOut);
  if (k === 'table' || kv) {
    const rows = kv || (ex.sampleOut ? lines(ex.sampleOut).map((l) => [l, '']) : [['', ''], ['', ''], ['', ''], ['', '']]);
    const body = rows.slice(0, 7).map((r) => (r[0] ? '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'
      : r[1] ? '<tr><td colspan="2" class="span">' + esc(r[1]) + '</td></tr>'
        : '<tr><td><div class="sk" style="width:3.5em;margin:.2em 0"></div></td><td><div class="sk" style="width:5em;margin:.2em 0"></div></td></tr>')).join('');
    return `<div class="fl-card dark"><div class="tblwrap" data-fit="css,0.6" data-clip="1" data-order="23"><table class="tbl"><tr><th>Field</th><th>Value</th></tr>${body}</table></div>${ex.sampleOut ? '<span class="illus">Illustration</span>' : ''}</div>`;
  }
  if (ex.sampleOut) return `<div class="fl-card dark"><div style="padding:1em;height:100%;display:flex;flex-direction:column"><div class="smp" data-fit="css,0.6" data-clip="1" data-order="23">${esc(lines(ex.sampleOut).join('\n'))}</div></div><span class="illus">Illustration</span></div>`;
  const ic = { chart: 'chart', photo: 'photo', film: 'film', qr: 'qr', mail: 'mail', doc: 'doc', text: 'text' }[k] || 'text';
  return `<div class="fl-card dark"><div class="big">${icon(ic)}</div></div>`;
}
function heroFlow(ex, o) {
  const ai = o.rec.section === 'ai' || o.rec.section === 'ai-image' || o.rec.section === 'ai-video';
  const wire = '<svg class="wire" viewBox="0 0 100 20" preserveAspectRatio="none"><line x1="2" y1="10" x2="96" y2="10" stroke="currentColor" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
  return `<div class="hero h-flow${o.compact ? ' compact' : ''}">
    <div class="fl-how">${icon('spark')}How it works</div>
    <div class="fl-row">
      <div class="fl-node">${cardIn(ex)}<div class="fl-lab"><small>You give it</small>${esc(ex.input)}</div></div>
      <div class="fl-mid">${wire}<div class="fl-engine">${glyph(o.rec.glyph, 'i-' + o.rec.section)}${ai ? '<em>AI</em>' : ''}</div></div>
      <div class="fl-node">${cardOut(ex)}<div class="fl-lab"><small>You get</small>${esc(ex.output)}</div></div>
    </div>
  </div>`;
}

function hero(ex, o) {
  o = Object.assign({ compact: false }, o);
  switch (ex.kind) {
    case 'calc': return heroCalc(ex, o);
    case 'text': return heroCode(ex, o);
    case 'document': return heroDoc(ex, o);
    case 'beforeAfter':
      if (ex.variant === 'video') return heroVideo(ex, o);
      if (ex.variant === 'document') return heroPages(ex, o);
      return heroSplit(ex, o);
    case 'image': return heroImage(ex, o);
    default: return heroFlow(ex, o);
  }
}

/** The sticker on the hero: real output, or an honest "illustration". */
function badge(ex, pos) {
  if (ex.kind === 'schematic') return '<span class="badge illus ' + (pos || 'tr') + '">' + icon('spark') + 'Illustration</span>';
  return '<span class="badge real ' + (pos || 'tr') + '">' + icon('check') + 'Real result from the tool</span>';
}

module.exports = { hero, badge, kindOf, pairs };
