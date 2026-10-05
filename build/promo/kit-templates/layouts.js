'use strict';
/**
 * The kit formats, each in five composition families (variant.layout):
 *
 *   classic  stacked: headline, framed example, footer
 *   poster   big type: giant numerals, the headline as the hero, quote cards
 *   split    a solid colour field (palette.field) against the base, the example straddling the seam
 *   cover    magazine cover: masthead, cover lines, running heads and page numbers
 *   device   the example inside a phone
 *
 * Every family tells the same beats (contract section 3):
 *   carousel  1 hook+pain · 2 the usual way · 3 the fix + example · 4 steps · 5 CTA
 *   square    hook · example · tool name · proof
 *   story     pain · example · promise · QR sticker · URL   (safe 250 top / 340 bottom)
 *   pin       "How to" headline · example · 3 steps · URL
 *   wide      pain → fix · example · URL
 *
 * ctx = { rec, story, ex, v: variant, c: copy (variant.copyFor), qr: { carousel, story }, n }
 * Where a format has no design of its own for a family it uses the nearest one
 * (FAMILY_OF below), so every variant renders every format.
 */
const P = require('./parts');
const H = require('./heroes');
const { esc, icon, glyph, hlHtml } = P;

const FORMATS = {
  carousel: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  pin: { w: 1000, h: 1500 },
  wide: { w: 1200, h: 630 },
};
/* format -> family -> the family actually drawn */
const FAMILY_OF = {
  carousel: { classic: 'classic', poster: 'poster', split: 'split', cover: 'cover', device: 'device' },
  square: { classic: 'classic', poster: 'poster', split: 'split', cover: 'cover', device: 'device' },
  story: { classic: 'classic', poster: 'poster', split: 'split', cover: 'poster', device: 'device' },
  pin: { classic: 'classic', poster: 'poster', split: 'split', cover: 'cover', device: 'device' },
  wide: { classic: 'classic', poster: 'poster', split: 'split', cover: 'poster', device: 'device' },
};

/* ---------------- shared blocks ---------------- */

function deco(ctx, extra) {
  return '<div class="deco"><i class="g1"></i><i class="g2"></i><i class="g3"></i><i class="dots"></i>' + (extra || '') + '</div>';
}
function wm(ctx) { return '<div class="wm">' + glyph(ctx.rec.glyph, 'i-' + ctx.rec.section) + '</div>'; }
function bigNum(n) { return '<div class="bignum">0' + n + '</div>'; }

function bar(ctx, counter) {
  return '<div class="bar"><div class="logo">' + P.brandLogo() + '<span>' + esc(P.brandName()) + '</span></div>'
    + '<div class="sec">' + esc(ctx.rec.sectionName) + '</div>'
    + (counter ? '<div class="count">' + counter + '<span>/5</span></div>' : '') + '</div>';
}
function runhead(ctx, label, page) {
  return '<div class="runhead"><b>' + esc(P.brandName().toUpperCase()) + '</b><span>' + esc(label) + '</span><em>p. ' + page + '</em></div>';
}
function masthead(ctx, compact) {
  return '<div class="mast' + (compact ? ' compact' : '') + '"><div class="mast-name" data-fit="' + (compact ? '120,60' : '196,90') + '" data-mode="line" data-order="1">' + esc(P.brandName().toUpperCase()) + '</div>'
    + '<div class="mast-line"><span>Issue No. ' + (ctx.n || 1) + '</span><span>' + esc(ctx.rec.sectionName) + '</span><span>' + (P.siteOf() ? esc(P.siteOf().promotes || '') : ctx.rec.pricing === 'freemium' ? 'AI edition' : 'Free tools') + '</span></div></div>';
}
/** A fitted headline. o: { tag, cls, box, fit, order, phrase, coral } */
function head(text, o) {
  o = o || {};
  return '<div class="fitbox ' + (o.box || '') + '" data-fit="' + (o.fit || '96,48') + '" data-order="' + (o.order || 10) + '"><' + (o.tag || 'h2') + ' class="hd t ' + (o.cls || '') + '">'
    + (o.plain ? esc(text) : hlHtml(text, o.phrase, o.coral ? 'coral' : '')) + '</' + (o.tag || 'h2') + '></div>';
}
function heroBox(ctx, o) {
  o = o || {};
  return '<div class="herobox ' + (o.cls || '') + '">' + H.hero(ctx.ex, { rec: ctx.rec, compact: !!o.compact, diag: !!o.diag, fill: !!o.fill, fmt: o.fmt }) + (o.badge === false ? '' : H.badge(ctx.ex, o.badge || 'tr')) + '</div>';
}
function phone(ctx, o) {
  o = o || {};
  return '<div class="phone ' + (o.cls || '') + '"><div class="ph-screen"><div class="ph-status"><span>9:41</span><i></i></div>'
    + '<div class="ph-url">' + icon('check') + '<span>' + esc(P.cleanHost(ctx.rec.path)) + '</span></div>'
    + '<div class="ph-body">' + (o.inner || heroBox(ctx, { compact: true, fill: true, badge: false, fmt: 'phone' })) + '</div></div></div>';
}
function pills(list, cls) { return '<div class="pills ' + (cls || '') + '" data-chk="1">' + list.slice(0, 3).map((p) => '<span class="pill"><i></i>' + esc(p) + '</span>').join('') + '</div>'; }
/* breaks only after a slash: each path segment stays whole */
function urlHtml(ctx) {
  const segs = String(ctx.rec.path).replace(/#.*$/, '').split('/').filter(Boolean);
  return '<span class="nw">' + esc(P.hostOf(P.siteOf())) + '/</span><wbr><b>' + segs.map((s) => '<span class="nw">' + esc(s) + '/</span>').join('<wbr>') + '</b>';
}
function qrTile(svg, cap) { return '<div class="qrtile">' + svg + '<div class="qrcap">' + esc(cap || 'Scan to open') + '</div></div>'; }
function sticker(ctx) { return '<div class="sticker">' + ctx.qr.story + '<div class="lab"><i></i>' + esc(ctx.c.cta) + '</div></div>'; }
function save() { return '<div class="save"><b>' + icon('bookmark') + '</b>Save this for later</div>'; }
function chips(ctx) {
  return '<ul class="usual">' + ctx.story.usual.slice(0, 3).map((u) => '<li class="chip"><span class="xm">' + icon('x') + '</span><span class="ctext" data-fit="42,28" data-order="5">' + esc(u) + '</span></li>').join('') + '</ul>';
}
function usualRows(ctx) {
  return '<ol class="urows">' + ctx.story.usual.slice(0, 3).map((u, i) => '<li><span class="ux">' + icon('x') + '</span><span class="utext" data-fit="46,28" data-order="5">' + esc(u) + '</span><em>0' + (i + 1) + '</em></li>').join('') + '</ol>';
}
function stepsPath(ctx) {
  const svg = '<svg class="path" data-path="1"><path d="" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="3 16" stroke-linecap="round" opacity=".75"/></svg>';
  return '<ol class="steps">' + svg + ctx.story.steps.slice(0, 3).map((t, i) => '<li class="step"><span class="node">' + (i + 1) + '</span><span class="stext" data-fit="50,32" data-order="5">' + esc(t) + '</span></li>').join('') + '</ol>';
}
function stepsBig(ctx, cls) {
  return '<ol class="bsteps ' + (cls || '') + '">' + ctx.story.steps.slice(0, 3).map((t, i) => '<li><span class="bn">' + (i + 1) + '</span><span class="btext" data-fit="52,26" data-order="5">' + esc(t) + '</span></li>').join('') + '</ol>';
}
function stepsGrid(ctx) {
  return '<ol class="psteps">' + ctx.story.steps.slice(0, 3).map((t, i) => '<li class="pstep"><span class="pnode">' + (i + 1) + '</span><span class="ptext" data-fit="27,18" data-order="5">' + esc(t) + '</span></li>').join('') + '</ol>';
}
function youGet(ctx) {
  const io = String(ctx.rec.io || '').split('→').map((x) => x.trim());
  return io[1] ? '<div class="youget" data-chk="1">' + icon('check') + '<span>You get: <b>' + esc(io[1]) + '</b></span></div>' : '';
}
function eyebrow(text, ic, cls) { return '<div class="eyebrow ' + (cls || '') + '">' + icon(ic) + esc(text) + '</div>'; }

function canvas(fmt, ctx, cls, inner, decoExtra) {
  const f = FORMATS[fmt];
  const fam = FAMILY_OF[fmt][ctx.v.layout] || 'classic';
  return `<section class="cv f-${fmt} L-${fam} p-${ctx.v.palette} y-${ctx.v.type} ${cls || ''}" data-fmt="${fmt}" style="width:${f.w}px;height:${f.h}px">${deco(ctx, decoExtra)}<div class="inner">${inner}</div></section>`;
}

/* ---------------- carousel ---------------- */
const SWIPE = { 1: 'Swipe', 2: 'See the fix', 3: 'How it works', 4: 'Try it' };
function cfoot(ctx, n) {
  return '<div class="foot"><div class="foot-row"><span class="foot-url">' + esc(P.cleanHost(ctx.rec.path)) + '</span>'
    + (SWIPE[n] ? '<span class="swipe">' + SWIPE[n] + '<b>' + icon('arrow') + '</b></span>' : '<span class="swipe">Save &amp; share</span>')
    + '</div><div class="prog">' + [1, 2, 3, 4, 5].map((i) => '<i' + (i <= n ? ' class="on"' : '') + '></i>').join('') + '</div></div>';
}
const PAGE_LABEL = { 1: 'Cover', 2: 'The usual way', 3: 'The fix', 4: 'How it works', 5: 'Back page' };

const CAROUSEL = {
  classic: [
    (ctx) => canvas('carousel', ctx, 's1', bar(ctx, 1) + `<div class="body">
      ${eyebrow(ctx.story.persona, 'user', 'persona')}
      ${head(ctx.c.hook, { tag: 'h1', box: 'hookbox', fit: '118,58', phrase: ctx.c.hookHighlight })}
      <div class="bubble"><span class="q">&ldquo;</span><div class="bubble-label">${esc(ctx.c.painLabel)}</div><p class="pain" data-fit="40,27" data-order="5">${esc(ctx.story.pain)}</p></div>
    </div>` + cfoot(ctx, 1), wm(ctx)),
    (ctx) => canvas('carousel', ctx, 's2', bar(ctx, 2) + `<div class="body">
      ${eyebrow('The usual way', 'x', 'coral')}
      ${head(ctx.c.usualTitle[0], { box: 'titlebox', fit: '96,56', phrase: ctx.c.usualTitle[1], coral: true })}
      ${chips(ctx)}
      <div class="turn">${esc(ctx.c.turn)}${icon('arrow')}</div>
    </div>` + cfoot(ctx, 2), '<i class="hatch"></i><div class="xwm">' + icon('x') + '</div>'),
    (ctx) => canvas('carousel', ctx, 's3', bar(ctx, 3) + `<div class="body">
      <div class="fixhead">${eyebrow(ctx.c.fixEyebrow, 'check')}
        ${head(ctx.rec.title, { box: 'tnamebox', fit: '70,40', order: 6, plain: true, cls: 'tname' })}
        <p class="promise" data-fit="34,24" data-order="7">${esc(ctx.c.promise)}</p></div>
      ${heroBox(ctx, { fmt: 'carousel' })}
      ${ctx.ex.caption ? '<div class="cap">' + esc(ctx.ex.caption) + '</div>' : ''}
    </div>` + cfoot(ctx, 3)),
    (ctx) => canvas('carousel', ctx, 's4', bar(ctx, 4) + `<div class="body">
      ${eyebrow(ctx.rec.title, 'spark')}
      ${head(ctx.c.stepsTitle[0], { box: 'titlebox', fit: '104,56', phrase: ctx.c.stepsTitle[1] })}
      ${stepsPath(ctx)}
      ${youGet(ctx)}
    </div>` + cfoot(ctx, 4), wm(ctx)),
    (ctx) => canvas('carousel', ctx, 's5', bar(ctx, 5) + `<div class="body center">
      ${head(ctx.c.cta, { box: 'ctabox', fit: '118,60', cls: 'cta' })}
      <p class="ctool" data-fit="34,22" data-order="6">${esc(ctx.rec.title)}</p>
      <div class="qrzone">${qrTile(ctx.qr.carousel)}</div>
      <div class="url" data-fit="42,22" data-mode="line" data-order="7">${urlHtml(ctx)}</div>
      ${pills(ctx.story.proof, 'center')}
      ${save()}
    </div>` + cfoot(ctx, 5)),
  ],

  poster: [
    (ctx) => canvas('carousel', ctx, 's1', bar(ctx, 1) + `<div class="body">
      ${head(ctx.c.hook, { tag: 'h1', box: 'hookbox bottom', fit: '150,64', phrase: ctx.c.hookHighlight })}
      <div class="rule-pain">${eyebrow(ctx.story.persona, 'user', 'persona')}<p class="pain" data-fit="38,26" data-order="5">${esc(ctx.story.pain)}</p></div>
    </div>` + cfoot(ctx, 1), bigNum(1)),
    (ctx) => canvas('carousel', ctx, 's2', bar(ctx, 2) + `<div class="body">
      ${eyebrow('The usual way', 'x', 'coral')}
      ${head(ctx.c.usualTitle[0], { box: 'titlebox', fit: '112,56', phrase: ctx.c.usualTitle[1], coral: true })}
      ${usualRows(ctx)}
      <div class="turn">${esc(ctx.c.turn)}${icon('arrow')}</div>
    </div>` + cfoot(ctx, 2), bigNum(2)),
    (ctx) => canvas('carousel', ctx, 's3', bar(ctx, 3) + `<div class="body">
      ${eyebrow(ctx.c.fixEyebrow, 'check')}
      ${head(ctx.rec.title, { box: 'tnamebox big', fit: '104,48', order: 6, plain: true, cls: 'tname' })}
      ${heroBox(ctx, { fmt: 'carousel', cls: 'tilt' })}
      <p class="promise under" data-fit="34,24" data-order="7">${esc(ctx.c.promise)}</p>
    </div>` + cfoot(ctx, 3), bigNum(3)),
    (ctx) => canvas('carousel', ctx, 's4', bar(ctx, 4) + `<div class="body">
      ${head(ctx.c.stepsTitle[0], { box: 'titlebox', fit: '96,52', phrase: ctx.c.stepsTitle[1] })}
      ${stepsBig(ctx)}
      ${youGet(ctx)}
    </div>` + cfoot(ctx, 4), bigNum(4)),
    (ctx) => canvas('carousel', ctx, 's5', bar(ctx, 5) + `<div class="body">
      ${head(ctx.c.cta, { box: 'ctabox big', fit: '150,64', cls: 'cta' })}
      <div class="qrrow">${qrTile(ctx.qr.carousel)}<div class="qrside">
        <p class="ctool" data-fit="40,24" data-order="6">${esc(ctx.rec.title)}</p>
        <div class="url" data-fit="34,18" data-order="7">${urlHtml(ctx)}</div>
        ${pills(ctx.story.proof, 'stack')}</div></div>
      ${save()}
    </div>` + cfoot(ctx, 5), bigNum(5)),
  ],

  split: [
    (ctx) => canvas('carousel', ctx, 's1', `<div class="fieldzone fz-tall">${bar(ctx, 1)}
      ${eyebrow(ctx.story.persona, 'user', 'persona')}
      ${head(ctx.c.hook, { tag: 'h1', box: 'hookbox', fit: '112,56', phrase: ctx.c.hookHighlight })}</div>
      <div class="body after-field">
      <div class="bubble"><span class="q">&ldquo;</span><div class="bubble-label">${esc(ctx.c.painLabel)}</div><p class="pain" data-fit="38,26" data-order="5">${esc(ctx.story.pain)}</p></div>
    </div>` + cfoot(ctx, 1)),
    (ctx) => canvas('carousel', ctx, 's2', `<div class="fieldzone">${bar(ctx, 2)}
      ${eyebrow('The usual way', 'x')}
      ${head(ctx.c.usualTitle[0], { box: 'titlebox', fit: '92,50', phrase: ctx.c.usualTitle[1] })}</div>
      <div class="body after-field">${chips(ctx)}<div class="turn">${esc(ctx.c.turn)}${icon('arrow')}</div></div>` + cfoot(ctx, 2)),
    (ctx) => canvas('carousel', ctx, 's3', `<div class="fieldzone fz-hero">${bar(ctx, 3)}
      ${eyebrow(ctx.c.fixEyebrow, 'check')}
      ${head(ctx.rec.title, { box: 'tnamebox', fit: '72,40', order: 6, plain: true, cls: 'tname' })}
      <p class="promise" data-fit="32,22" data-order="7">${esc(ctx.c.promise)}</p></div>
      <div class="body straddle">${heroBox(ctx, { fmt: 'carousel' })}</div>` + cfoot(ctx, 3)),
    (ctx) => canvas('carousel', ctx, 's4', `<div class="fieldzone">${bar(ctx, 4)}
      ${eyebrow(ctx.rec.title, 'spark')}
      ${head(ctx.c.stepsTitle[0], { box: 'titlebox', fit: '96,50', phrase: ctx.c.stepsTitle[1] })}</div>
      <div class="body after-field">${stepsPath(ctx)}${youGet(ctx)}</div>` + cfoot(ctx, 4)),
    (ctx) => canvas('carousel', ctx, 's5', `<div class="fieldzone fz-cta">${bar(ctx, 5)}
      ${head(ctx.c.cta, { box: 'ctabox', fit: '112,56', cls: 'cta' })}
      <p class="ctool" data-fit="32,22" data-order="6">${esc(ctx.rec.title)}</p></div>
      <div class="body straddle center">
      <div class="qrzone">${qrTile(ctx.qr.carousel)}</div>
      <div class="url" data-fit="40,22" data-mode="line" data-order="7">${urlHtml(ctx)}</div>
      ${pills(ctx.story.proof, 'center')}
      ${save()}</div>` + cfoot(ctx, 5)),
  ],

  cover: [
    (ctx) => canvas('carousel', ctx, 's1', `${masthead(ctx)}<div class="body">
      <div class="kicker2">${esc(ctx.story.persona)}</div>
      ${head(ctx.c.hook, { tag: 'h1', box: 'hookbox', fit: '128,56', phrase: ctx.c.hookHighlight })}
      <p class="standfirst" data-fit="36,24" data-order="5">${esc(ctx.story.pain)}</p>
      <div class="coverlines"><b>Inside</b><span><em>2</em>The usual way</span><span><em>3</em>The fix</span><span><em>4</em>Three steps</span></div>
    </div>` + cfoot(ctx, 1), '<div class="wm big">' + glyph(ctx.rec.glyph, 'i-' + ctx.rec.section) + '</div>'),
    (ctx) => canvas('carousel', ctx, 's2', runhead(ctx, PAGE_LABEL[2], 2) + `<div class="body">
      ${head(ctx.c.usualTitle[0], { box: 'titlebox', fit: '100,52', phrase: ctx.c.usualTitle[1], coral: true })}
      ${usualRows(ctx)}
      <div class="turn">${esc(ctx.c.turn)}${icon('arrow')}</div>
    </div>` + cfoot(ctx, 2)),
    (ctx) => canvas('carousel', ctx, 's3', runhead(ctx, PAGE_LABEL[3], 3) + `<div class="body">
      ${head(ctx.rec.title, { box: 'tnamebox', fit: '80,44', order: 6, plain: true, cls: 'tname' })}
      <p class="standfirst sm" data-fit="32,22" data-order="7">${esc(ctx.c.promise)}</p>
      ${heroBox(ctx, { fmt: 'carousel', badge: false })}
      <div class="figcap"><b>Fig. 1</b>${ctx.ex.kind === 'schematic' ? 'How it works, illustrated: nothing here was run.' : 'A real result, made by the tool itself.'}</div>
    </div>` + cfoot(ctx, 3)),
    (ctx) => canvas('carousel', ctx, 's4', runhead(ctx, PAGE_LABEL[4], 4) + `<div class="body">
      ${head(ctx.c.stepsTitle[0], { box: 'titlebox', fit: '100,52', phrase: ctx.c.stepsTitle[1] })}
      ${stepsBig(ctx, 'ruled')}
      ${youGet(ctx)}
    </div>` + cfoot(ctx, 4)),
    (ctx) => canvas('carousel', ctx, 's5', runhead(ctx, PAGE_LABEL[5], 5) + `<div class="body">
      ${head(ctx.c.cta, { box: 'ctabox big', fit: '140,60', cls: 'cta' })}
      <div class="qrrow">${qrTile(ctx.qr.carousel)}<div class="qrside">
        <p class="ctool" data-fit="40,24" data-order="6">${esc(ctx.rec.title)}</p>
        <div class="url" data-fit="34,18" data-order="7">${urlHtml(ctx)}</div>
        ${pills(ctx.story.proof, 'stack')}</div></div>
      <div class="backrow">${save()}<div class="barcode"></div></div>
    </div>` + cfoot(ctx, 5)),
  ],
};
/* device: the classic story with the example and the CTA on a phone */
CAROUSEL.device = CAROUSEL.classic.slice();
CAROUSEL.device[2] = (ctx) => canvas('carousel', ctx, 's3', bar(ctx, 3) + `<div class="body">
  <div class="fixhead">${eyebrow(ctx.c.fixEyebrow, 'check')}
    ${head(ctx.rec.title, { box: 'tnamebox', fit: '70,40', order: 6, plain: true, cls: 'tname' })}
    <p class="promise" data-fit="34,24" data-order="7">${esc(ctx.c.promise)}</p></div>
  <div class="phonezone">${phone(ctx)}${H.badge(ctx.ex, 'tr')}</div>
</div>` + cfoot(ctx, 3), wm(ctx));
CAROUSEL.device[4] = (ctx) => canvas('carousel', ctx, 's5', bar(ctx, 5) + `<div class="body">
  ${head(ctx.c.cta, { box: 'ctabox', fit: '112,56', cls: 'cta' })}
  <div class="phonerow">${phone(ctx, { cls: 'small', inner: '<div class="ph-qr">' + qrTile(ctx.qr.carousel, 'Scan to open') + '</div>' })}
    <div class="qrside"><p class="ctool" data-fit="40,24" data-order="6">${esc(ctx.rec.title)}</p>
    <div class="url" data-fit="34,18" data-order="7">${urlHtml(ctx)}</div>${pills(ctx.story.proof, 'stack')}${save()}</div></div>
</div>` + cfoot(ctx, 5));

function carousel(ctx) { return CAROUSEL[FAMILY_OF.carousel[ctx.v.layout] || 'classic'].map((f) => f(ctx)); }

/* ---------------- square ---------------- */
const SQUARE = {
  classic: (ctx) => canvas('square', ctx, '', bar(ctx) + `
    ${head(ctx.c.hook, { tag: 'h1', box: 'hookbox', fit: '84,46', phrase: ctx.c.hookHighlight })}
    ${heroBox(ctx, { compact: true, diag: true, fmt: 'square' })}
    <div class="sq-foot"><div class="sq-name"><b data-fit="34,22" data-mode="line" data-order="6">${esc(ctx.rec.title)}</b><span>${esc(P.cleanHost(ctx.rec.path))}</span></div>${pills(ctx.story.proof)}</div>`),
  poster: (ctx) => canvas('square', ctx, '', bar(ctx) + `
    <div class="quote">
      <span class="qmark">&ldquo;</span>
      ${head(ctx.story.pain, { box: 'quotebox', fit: '62,32', plain: true, cls: 'qtext' })}
      <div class="attr">${esc(ctx.story.persona)}</div>
    </div>
    <div class="sq-row">
      <div class="sq-fix">${eyebrow(ctx.c.fixEyebrow, 'check')}<p class="sq-promise" data-fit="34,22" data-order="7">${esc(ctx.c.promise)}</p><span class="sq-url">${esc(P.cleanHost(ctx.rec.path))}</span></div>
      ${heroBox(ctx, { compact: true, fmt: 'square', cls: 'thumb tilt', badge: 'tl' })}
    </div>`),
  split: (ctx) => canvas('square', ctx, 'row', `<div class="fieldzone fz-side">${bar(ctx)}
      ${head(ctx.c.hook, { tag: 'h1', box: 'hookbox', fit: '76,40', phrase: ctx.c.hookHighlight })}
      <div class="sq-name"><b data-fit="28,18" data-mode="line" data-order="6">${esc(ctx.rec.title)}</b><span>${esc(P.cleanHost(ctx.rec.path))}</span></div></div>
    <div class="sideright">${heroBox(ctx, { compact: true, fmt: 'square', badge: 'tl' })}${pills(ctx.story.proof, 'stack')}</div>`),
  cover: (ctx) => canvas('square', ctx, '', masthead(ctx, true) + `
    ${heroBox(ctx, { compact: true, fmt: 'square', badge: false, cls: 'coverimg' })}
    ${head(ctx.c.hook, { tag: 'h1', box: 'hookbox', fit: '72,40', phrase: ctx.c.hookHighlight })}
    <div class="sq-foot"><div class="sq-name"><b data-fit="30,20" data-mode="line" data-order="6">${esc(ctx.rec.title)}</b><span>${esc(P.cleanHost(ctx.rec.path))}</span></div>${pills(ctx.story.proof)}</div>`),
  device: (ctx) => canvas('square', ctx, 'row', `<div class="sideleft">${bar(ctx)}
      ${head(ctx.c.hook, { tag: 'h1', box: 'hookbox', fit: '78,40', phrase: ctx.c.hookHighlight })}
      <p class="sq-promise" data-fit="30,20" data-order="7">${esc(ctx.c.promise)}</p>
      ${pills(ctx.story.proof, 'stack')}
      <span class="sq-url">${esc(P.cleanHost(ctx.rec.path))}</span></div>
    <div class="phonezone">${phone(ctx)}</div>`, wm(ctx)),
};
function square(ctx) { return SQUARE[FAMILY_OF.square[ctx.v.layout] || 'classic'](ctx); }

/* ---------------- story ---------------- */
function storyCta(ctx) {
  return `<div class="st-cta">${sticker(ctx)}<div class="st-right"><div class="lead">Scan or visit</div><div class="url" data-fit="34,22" data-order="8">${urlHtml(ctx)}</div>${pills(ctx.story.proof.slice(0, 2))}</div></div>`;
}
const STORY = {
  classic: (ctx) => canvas('story', ctx, '', bar(ctx) + `
    <div class="st-pain">${eyebrow(ctx.c.painLabel, 'user', 'violet')}
      ${head(ctx.story.pain, { box: 'st-painbox', fit: '54,34', order: 6, plain: true, cls: 'pain2' })}</div>
    ${heroBox(ctx, { fmt: 'story' })}
    ${head(ctx.c.promise, { box: 'st-promisebox', fit: '58,36', order: 7 })}
    ${storyCta(ctx)}`),
  poster: (ctx) => canvas('story', ctx, '', bar(ctx) + `
    ${head(ctx.c.hook, { tag: 'h1', box: 'st-hookbox', fit: '128,60', phrase: ctx.c.hookHighlight })}
    <p class="st-painline" data-fit="34,24" data-order="6">${esc(ctx.story.pain)}</p>
    ${heroBox(ctx, { fmt: 'story', cls: 'tilt' })}
    ${storyCta(ctx)}`, bigNum(1)),
  split: (ctx) => canvas('story', ctx, '', `<div class="fieldzone fz-story">${bar(ctx)}
      ${eyebrow(ctx.c.painLabel, 'user')}
      ${head(ctx.story.pain, { box: 'st-painbox', fit: '58,34', order: 6, plain: true, cls: 'pain2' })}</div>
    <div class="straddle st-mid">${heroBox(ctx, { fmt: 'story' })}</div>
    ${head(ctx.c.promise, { box: 'st-promisebox', fit: '56,34', order: 7 })}
    ${storyCta(ctx)}`),
  device: (ctx) => canvas('story', ctx, '', bar(ctx) + `
    ${head(ctx.story.pain, { box: 'st-painbox sm', fit: '46,30', order: 6, plain: true, cls: 'pain2' })}
    <div class="phonezone">${phone(ctx)}${H.badge(ctx.ex, 'tr')}</div>
    ${head(ctx.c.promise, { box: 'st-promisebox sm', fit: '48,30', order: 7 })}
    ${storyCta(ctx)}`, wm(ctx)),
};
function story(ctx) { return STORY[FAMILY_OF.story[ctx.v.layout] || 'classic'](ctx); }

/* ---------------- pin ---------------- */
function howText(ctx) { const h = String(ctx.story.howTo || '').replace(/^how to\s+/i, ''); return h.charAt(0).toUpperCase() + h.slice(1); }
function pinFoot(ctx) { return `<div class="pin-foot"><div class="url" data-fit="30,20" data-mode="line" data-order="6">${urlHtml(ctx)}</div>${pills(ctx.story.proof.slice(0, 2))}</div>`; }
const PIN = {
  classic: (ctx) => canvas('pin', ctx, '', bar(ctx) + `
    <div class="pin-head"><div class="kicker"><span class="hlw"><span class="hl">How to</span></span></div>
      ${head(howText(ctx), { tag: 'h1', box: 'pin-hbox', fit: '84,46', plain: true, cls: 'pin-h' })}</div>
    ${heroBox(ctx, { compact: true, fmt: 'pin' })}
    ${stepsGrid(ctx)}
    ${pinFoot(ctx)}`, wm(ctx)),
  poster: (ctx) => canvas('pin', ctx, '', bar(ctx) + `
    <div class="pin-head"><div class="kicker"><span class="hlw"><span class="hl">How to</span></span></div>
      ${head(howText(ctx), { tag: 'h1', box: 'pin-hbox', fit: '92,46', plain: true, cls: 'pin-h' })}</div>
    ${heroBox(ctx, { compact: true, fmt: 'pin', cls: 'short' })}
    ${stepsBig(ctx, 'pin')}
    ${pinFoot(ctx)}`),
  split: (ctx) => canvas('pin', ctx, '', `<div class="fieldzone fz-pin">${bar(ctx)}
      <div class="kicker">How to</div>
      ${head(howText(ctx), { tag: 'h1', box: 'pin-hbox', fit: '80,44', plain: true, cls: 'pin-h' })}</div>
    <div class="straddle pin-mid">${heroBox(ctx, { compact: true, fmt: 'pin' })}</div>
    ${stepsGrid(ctx)}
    ${pinFoot(ctx)}`),
  cover: (ctx) => canvas('pin', ctx, '', masthead(ctx, true) + `
    <div class="pin-head"><div class="kicker2">How to</div>
      ${head(howText(ctx), { tag: 'h1', box: 'pin-hbox', fit: '84,44', plain: true, cls: 'pin-h' })}</div>
    ${heroBox(ctx, { compact: true, fmt: 'pin', badge: false, cls: 'coverimg' })}
    <ol class="clines">${ctx.story.steps.slice(0, 3).map((t, i) => '<li><em>' + (i + 1) + '</em><span data-fit="30,20" data-order="5">' + esc(t) + '</span></li>').join('')}</ol>
    ${pinFoot(ctx)}`),
  device: (ctx) => canvas('pin', ctx, '', bar(ctx) + `
    <div class="pin-head"><div class="kicker"><span class="hlw"><span class="hl">How to</span></span></div>
      ${head(howText(ctx), { tag: 'h1', box: 'pin-hbox', fit: '80,44', plain: true, cls: 'pin-h' })}</div>
    <div class="phonezone">${phone(ctx)}${H.badge(ctx.ex, 'tr')}</div>
    ${stepsGrid(ctx)}
    ${pinFoot(ctx)}`, wm(ctx)),
};
function pin(ctx) { return PIN[FAMILY_OF.pin[ctx.v.layout] || 'classic'](ctx); }

/* ---------------- wide ---------------- */
function wfoot(ctx) { return `<div class="w-foot"><span class="go">${icon('arrow')}</span><span class="url" data-fit="23,15" data-mode="line" data-order="6">${urlHtml(ctx)}</span></div>`; }
const WIDE = {
  classic: (ctx) => canvas('wide', ctx, 'row', `<div class="w-left">${bar(ctx)}
      <div class="w-prob">${eyebrow('The problem', 'x', 'coral')}<p class="w-pain" data-fit="24,16" data-order="5">${esc(ctx.story.pain)}</p></div>
      <div class="w-fix">${eyebrow(ctx.c.fixEyebrow, 'check')}
        ${head(ctx.c.promise, { box: 'w-promisebox', fit: '46,26' })}</div>
      ${wfoot(ctx)}</div>
    <div class="w-right">${heroBox(ctx, { compact: true, diag: true, fmt: 'wide' })}</div>`),
  poster: (ctx) => canvas('wide', ctx, 'row', `<div class="w-left wide">${bar(ctx)}
      <div class="w-quote"><span class="qmark">&ldquo;</span>${head(ctx.story.pain, { box: 'w-qbox', fit: '40,22', order: 5, plain: true, cls: 'qtext' })}</div>
      <div class="w-answer">${icon('arrow')}<p data-fit="26,17" data-order="7">${esc(ctx.c.promise)}</p></div>
      ${wfoot(ctx)}</div>
    <div class="w-right narrow">${heroBox(ctx, { compact: true, fmt: 'wide', cls: 'tilt' })}</div>`),
  split: (ctx) => canvas('wide', ctx, 'row', `<div class="fieldzone fz-wide">${bar(ctx)}
      <div class="w-prob">${eyebrow('The problem', 'x')}<p class="w-pain2" data-fit="30,18" data-order="5">${esc(ctx.story.pain)}</p></div></div>
    <div class="w-right col">${eyebrow(ctx.c.fixEyebrow, 'check')}
      ${head(ctx.c.promise, { box: 'w-promisebox sm', fit: '34,22' })}
      ${heroBox(ctx, { compact: true, fmt: 'wide' })}
      ${wfoot(ctx)}</div>`),
  device: (ctx) => canvas('wide', ctx, 'row', `<div class="w-left wide">${bar(ctx)}
      ${head(ctx.c.hook, { tag: 'h1', box: 'w-hookbox', fit: '58,30', phrase: ctx.c.hookHighlight })}
      <p class="w-pain" data-fit="22,15" data-order="5">${esc(ctx.c.promise)}</p>
      ${wfoot(ctx)}</div>
    <div class="phonezone">${phone(ctx, { cls: 'wide' })}</div>`, wm(ctx)),
};
function wide(ctx) { return WIDE[FAMILY_OF.wide[ctx.v.layout] || 'classic'](ctx); }

module.exports = { FORMATS, FAMILY_OF, carousel, square, story, pin, wide };
