'use strict';
/**
 * The kit stylesheet: inlined fonts, palette tokens (generated from
 * palettes.js), five heading treatments (.y-*), the brand frame, the hero
 * frames and the composition families (.L-*) of every format.
 *
 * Sizing rule: every hero lives in a size container (.herobox); its root sets
 * one font-size in cqmin and everything inside is in em, so the in-page fit
 * loop can shrink a whole frame by changing one number.
 */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./parts');
const PAL = require('./palettes');

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';
/* System serif chain for the editorial treatment: nothing is fetched. */
const SERIF = "'Palatino Linotype','Book Antiqua',Palatino,'Iowan Old Style',Georgia,'Times New Roman',serif";

let fontCss = null;
function fontFaces() {
  if (fontCss) return fontCss;
  const f = (n) => fs.readFileSync(path.join(ROOT, 'assets', 'fonts', n)).toString('base64');
  const face = (fam, w, file, range) => `@font-face{font-family:'${fam}';font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${f(file)}) format('woff2');unicode-range:${range}}`;
  fontCss = [
    face('Sora', '400 800', 'sora-latin.woff2', LATIN), face('Sora', '400 800', 'sora-latin-ext.woff2', LATIN_EXT),
    face('Inter', '400 700', 'inter-latin.woff2', LATIN), face('Inter', '400 700', 'inter-latin-ext.woff2', LATIN_EXT),
  ].join('\n');
  return fontCss;
}

/* Kept for callers of the first kit API: the two original looks. */
const THEMES = {
  midnight: { label: 'Midnight Gold', note: 'the dark brand: Instagram, X, Threads, stories' },
  daylight: { label: 'Daylight', note: 'warm off-white: LinkedIn, Pinterest, feeds where light posts stand out' },
};

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#888}
body{font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{margin:0}
.cv{position:relative;overflow:hidden;background:var(--bg);color:var(--ink);break-after:page;page-break-after:always;--ok:#4ade80;--notch:var(--bg)}
.cv:last-child{break-after:auto;page-break-after:auto}
.p-daylight,.p-paper,.p-block{--ok:#15803d}

/* ---------- atmosphere ---------- */
.deco{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0}
.deco i{position:absolute;display:block}
.deco .g1{left:-38%;top:-32%;width:115%;height:88%;background:radial-gradient(closest-side,var(--glowA),transparent)}
.deco .g2{right:-42%;bottom:-34%;width:118%;height:92%;background:radial-gradient(closest-side,var(--glowB),transparent)}
.deco .g3{right:-24%;top:28%;width:62%;height:46%;background:radial-gradient(closest-side,var(--glowC),transparent)}
.deco .dots{inset:0;background-image:radial-gradient(var(--dot) 1.5px,transparent 1.7px);background-size:30px 30px;-webkit-mask-image:radial-gradient(ellipse 75% 60% at 78% 18%,#000 0%,transparent 75%)}
.deco .wm{position:absolute;right:-7%;bottom:-5%;width:58%;opacity:var(--wm);transform:rotate(-12deg);color:var(--ink)}
.deco .wm.big{right:-22%;bottom:6%;width:92%;opacity:calc(var(--wm) * 1.4)}
.deco .wm svg{width:100%;height:auto;display:block;fill:none;stroke:currentColor;stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round}
.deco .wm svg .fill{fill:currentColor;stroke:none}
.deco .xwm{position:absolute;right:-10%;bottom:4%;width:56%;opacity:.07;color:var(--coral);transform:rotate(-8deg)}
.deco .xwm svg{width:100%;height:auto;stroke-width:1.6}
.deco .hatch{inset:0;background:repeating-linear-gradient(-28deg,transparent 0 46px,var(--coral-bg) 46px 48px);-webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 35%,#000 70%,transparent 100%)}
.deco .bignum{position:absolute;right:-40px;top:70px;font:800 600px/.8 'Sora';letter-spacing:-.07em;color:transparent;-webkit-text-stroke:3px var(--line2)}
.f-story .deco .bignum{top:250px;font-size:760px}
.p-block .deco .dots{-webkit-mask-image:radial-gradient(ellipse 85% 70% at 80% 20%,#000 0%,transparent 75%)}

/* ---------- frame ---------- */
.inner{position:absolute;display:flex;flex-direction:column;z-index:1}
.cv.row>.inner{flex-direction:row}
.ic{width:1em;height:1em;display:block;flex:0 0 auto}
.glyph{display:block;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
.glyph .fill{fill:currentColor;stroke:none}.glyph .thin{stroke-width:1.25}
.bar{display:flex;align-items:center;gap:16px;flex:0 0 auto}
.logo{display:flex;align-items:center;gap:14px}
.logo svg{width:52px;height:52px;display:block}
.logo span{font:700 30px/1 'Sora';letter-spacing:-.02em;color:var(--ink)}
.sec{margin-left:auto;font:600 21px/1 'Inter';color:var(--ink2);padding:12px 20px;border-radius:999px;border:1px solid var(--line2);background:var(--panel);white-space:nowrap}
.count{font:800 22px/1 'Sora';letter-spacing:-.01em;padding:12px 16px;border-radius:999px;background:var(--chip);color:var(--chip-ink);white-space:nowrap}
.count span{opacity:.6}
.eyebrow{display:flex;align-items:center;gap:12px;font:700 22px/1.15 'Inter';letter-spacing:.16em;text-transform:uppercase;color:var(--accent-ink);flex:0 0 auto}
.eyebrow .ic{width:30px;height:30px;stroke-width:2.4}
.eyebrow.coral{color:var(--coral-ink)}
.eyebrow.muted,.eyebrow.persona{color:var(--muted)}
.eyebrow.violet{color:var(--accent-ink)}
.hd{font-family:'Sora';font-weight:800;letter-spacing:-.045em;line-height:1.03;color:var(--ink)}
.fitbox{display:flex;flex-direction:column;min-height:0;overflow:hidden;flex:0 0 auto}
.fitbox>.t{margin:auto 0;display:block;padding:.13em 0 .17em}
.fitbox.bottom>.t{margin:auto 0 0}
.pills{display:flex;flex-wrap:wrap;gap:12px;min-width:0;flex-shrink:1;overflow:hidden;padding:2px}
.pills.center{justify-content:center}
.pills.stack{flex-direction:column;align-items:flex-start;flex-wrap:nowrap}
.pill{display:inline-flex;align-items:center;gap:11px;font:600 24px/1 'Inter';padding:14px 22px;border-radius:999px;border:1.5px solid var(--accent-a55);background:var(--accent-a10);color:var(--ink);white-space:nowrap}
.pill i{width:10px;height:10px;border-radius:50%;background:var(--accent);flex:0 0 auto}
.pill:nth-child(2) i{background:var(--ink2)}
.pill:nth-child(3) i{background:var(--coral)}
.foot{flex:0 0 auto;display:flex;flex-direction:column;gap:20px;margin-top:auto}
.foot-row{display:flex;align-items:center;justify-content:space-between;gap:20px}
.foot-url{font:600 22px/1 'Inter';color:var(--muted);white-space:nowrap;overflow:hidden}
.swipe{display:inline-flex;align-items:center;gap:14px;font:700 24px/1 'Sora';color:var(--ink);white-space:nowrap}
.swipe b{display:grid;place-items:center;width:54px;height:54px;border-radius:50%;background:var(--chip);color:var(--chip-ink)}
.swipe b .ic{width:28px;height:28px;stroke-width:2.6}
.prog{display:flex;gap:10px}
.prog i{flex:1;height:7px;border-radius:7px;background:var(--line2)}
.prog i.on{background:var(--chip)}
.url{color:var(--ink)}
.nw{white-space:nowrap}
.url b{color:var(--accent-ink);font-weight:inherit}

/* ---------- heading treatments ---------- */
.hl{-webkit-box-decoration-break:clone;box-decoration-break:clone}
.y-gradient .hl{background-image:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}
.y-outline .hl{-webkit-text-fill-color:transparent;color:transparent;-webkit-text-stroke:max(.032em,2px) var(--accent);paint-order:stroke fill}
.y-outline .bn{-webkit-text-fill-color:transparent;-webkit-text-stroke:3px var(--accent);background:none!important}
.y-marker .hlw{background:linear-gradient(transparent 56%,var(--marker) 56%,var(--marker) 92%,transparent 92%);-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:0 .04em}
.y-marker .hl{color:inherit}
.y-caps .hd,.y-caps .kicker,.y-caps .mast-name{text-transform:uppercase;letter-spacing:-.025em;line-height:.95}
.y-caps .hl{color:var(--accent-ink);-webkit-text-fill-color:var(--accent-ink)}
.y-caps .qtext,.y-caps .pain2{text-transform:none;letter-spacing:-.035em;line-height:1.12}
.y-serif .hd,.y-serif .kicker,.y-serif .mast-name,.y-serif .qmark,.y-serif .bn,.y-serif .standfirst{font-family:${SERIF}}
.y-serif .hd{font-weight:700;letter-spacing:-.02em;line-height:1.06}
.y-serif .hl{font-style:italic;color:var(--accent-ink);-webkit-text-fill-color:var(--accent-ink)}
.hl.coral{-webkit-text-fill-color:var(--coral-ink)!important;color:var(--coral-ink);background:none!important;-webkit-text-stroke:0}
.y-outline .hl.coral{-webkit-text-fill-color:transparent!important;-webkit-text-stroke:.032em var(--coral-ink)}
.y-marker .hlw:has(.coral){background:linear-gradient(transparent 56%,rgba(255,107,107,.38) 56%,rgba(255,107,107,.38) 92%,transparent 92%)}
.y-marker .hl.coral{-webkit-text-fill-color:currentColor!important;color:inherit}

/* ---------- the colour field of split layouts ---------- */
.fieldzone{position:relative;flex:0 0 auto;min-width:0;display:flex;flex-direction:column;background:var(--field);color:var(--field-ink);
  --ink:var(--field-ink);--ink2:var(--field-ink);--muted:var(--field-ink);--accent-ink:var(--field-ink);--coral-ink:var(--field-ink);
  --line2:color-mix(in srgb,var(--field-ink) 26%,transparent);--panel:color-mix(in srgb,var(--field-ink) 8%,transparent);--accent:var(--field-ink);--marker:color-mix(in srgb,var(--bg) 30%,transparent)}
.fieldzone .hl,.fieldzone .hl.coral{background:none!important;-webkit-text-fill-color:currentColor!important;color:inherit;-webkit-text-stroke:0;text-decoration:underline;text-decoration-thickness:.05em;text-underline-offset:.12em;text-decoration-color:currentColor}
.y-outline .fieldzone .hl{-webkit-text-fill-color:transparent!important;-webkit-text-stroke:.032em var(--field-ink);text-decoration:none}
.y-marker .fieldzone .hlw{background:none}
.fieldzone .eyebrow{color:var(--field-ink)}
.fieldzone .count{background:var(--field-ink);color:var(--field)}

/* ---------- hero container + badges ---------- */
.herobox{position:relative;flex:1 1 0;min-height:0;container-type:size}
.hero{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.herobox.tilt .hero{transform:rotate(-2.2deg)}
.badge{position:absolute;z-index:5;display:inline-flex;align-items:center;gap:10px;font:700 21px/1 'Inter';padding:13px 18px;border-radius:14px;white-space:nowrap;box-shadow:0 14px 30px -8px rgba(0,0,0,.45)}
.badge .ic{width:22px;height:22px;stroke-width:2.8}
.badge.real{background:var(--chip);color:var(--chip-ink);transform:rotate(2.5deg)}
.badge.illus{background:#5b3cf0;color:#fff;transform:rotate(-2deg)}
.badge.tr{top:-16px;right:14px}.badge.tl{top:-16px;left:14px}

/* ---------- calc: the result ticket ---------- */
.h-calc .tk-wrap{width:min(100cqw,142cqh);max-height:100cqh;display:flex;filter:drop-shadow(0 36px 40px var(--drop))}
.tk{width:100%;max-height:100cqh;overflow:hidden;font-size:4.2cqmin;background:var(--card);color:var(--card-ink);border:1.5px solid var(--accent-a35);border-bottom:0;border-radius:1em 1em 0 0;padding:1.15em 1.35em 1.9em;display:flex;flex-direction:column;gap:.55em;
  -webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/1.3em 100%;mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/1.3em 100%}
.tk-head{display:flex;align-items:center;gap:.6em;padding-bottom:.25em}
.tk-ico{width:2em;height:2em;border-radius:.6em;display:grid;place-items:center;background:var(--accent-a10);border:1px solid var(--accent-a35);color:var(--accent);flex:0 0 auto}
.tk-ico svg{width:62%;height:62%}
.tk-title{font:700 1em/1.15 'Sora';letter-spacing:-.015em;color:var(--card-ink);flex:1;min-width:0}
.tk-live{display:inline-flex;align-items:center;gap:.45em;font:700 .62em/1 'Inter';color:var(--ok);text-transform:uppercase;letter-spacing:.14em;white-space:nowrap}
.tk-live i{width:.7em;height:.7em;border-radius:50%;background:var(--ok);box-shadow:0 0 0 .28em color-mix(in srgb,var(--ok) 22%,transparent)}
.tk-row{display:flex;align-items:baseline;justify-content:space-between;gap:1em;padding:.36em 0;border-bottom:1.5px dotted color-mix(in srgb,var(--card-ink) 18%,transparent);font-size:.86em;line-height:1.25}
.tk-row:last-child{border-bottom:0}
.tk-row .l{color:var(--card-muted);min-width:0}
.tk-row .v{font-weight:600;color:var(--card-ink);white-space:nowrap;font-variant-numeric:tabular-nums;max-width:62%;overflow:hidden;text-overflow:ellipsis}
.tk-tear{position:relative;height:1.3em;margin:0 -1.35em;flex:0 0 auto;overflow:hidden}
.tk-tear::before{content:'';position:absolute;left:1.2em;right:1.2em;top:50%;border-top:.13em dashed color-mix(in srgb,var(--card-ink) 22%,transparent)}
.tk-tear i,.tk-tear b{position:absolute;top:50%;width:1.3em;height:1.3em;margin-top:-.65em;border-radius:50%;background:var(--notch)}
.tk-tear i{left:-.65em}.tk-tear b{right:-.65em}
.tk-plabel{font:700 .66em/1 'Inter';letter-spacing:.16em;text-transform:uppercase;color:var(--card-muted);margin-bottom:.3em}
.tk-pval{display:block;font:800 3.3em/1.3 'Sora';letter-spacing:-.045em;white-space:nowrap;overflow:hidden;font-variant-numeric:tabular-nums}
.tk-pval .hl{background-image:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;-webkit-text-stroke:0}
.p-paper .tk-pval .hl,.p-block .tk-pval .hl,.p-daylight .tk-pval .hl{background-image:var(--grad)}
.h-calc.compact .tk{font-size:5.2cqmin}
.ph-body .h-calc .tk{font-size:7.2cqw}
.ph-body .tk-live{display:none}
.ph-body .fl-row{font-size:7.6cqw}
.y-outline .kicker .hl{-webkit-text-fill-color:var(--accent-ink);color:var(--accent-ink);-webkit-text-stroke:0}
.ph-body .h-code .win{font-size:5.4cqw}
.ph-body .h-doc .viewer{font-size:5.4cqw}

/* ---------- text: the editor frame ---------- */
.h-code .win{width:100%;height:100%;display:flex;flex-direction:column;border-radius:.9em;overflow:hidden;background:#0a0e18;box-shadow:var(--sh);font-size:3.1cqmin;color:#d8dded}
.win-bar{display:flex;align-items:center;gap:.5em;padding:.78em 1em;background:#121828;border-bottom:1px solid rgba(255,255,255,.06);flex:0 0 auto}
.win-bar .d{width:.78em;height:.78em;border-radius:50%;flex:0 0 auto}
.win-bar .r{background:#ff6b6b}.win-bar .y{background:#f7c948}.win-bar .g{background:#34d399}
.win-title{margin-left:.7em;font:600 .78em/1 'Inter';color:#8a93a8;white-space:nowrap;overflow:hidden}
.win-tag{margin-left:auto;font:700 .6em/1 'Inter';letter-spacing:.14em;text-transform:uppercase;color:#4ade80;display:inline-flex;align-items:center;gap:.5em;white-space:nowrap}
.win-tag i{width:.75em;height:.75em;border-radius:50%;background:#4ade80;box-shadow:0 0 0 .3em rgba(74,222,128,.18)}
.pane{position:relative;display:flex;flex-direction:column;min-height:0}
.pane.in{flex:0 1 auto;max-height:34%;background:#0d1220;border-bottom:1px solid rgba(255,255,255,.06)}
.pane.out{flex:1 1 0}
.pane-label{position:absolute;top:.75em;right:.9em;z-index:2;font:700 .58em/1 'Inter';letter-spacing:.15em;text-transform:uppercase;padding:.55em .85em;border-radius:.6em;background:rgba(255,255,255,.08);color:#9aa3b8}
.pane.out .pane-label{background:linear-gradient(120deg,#ffe29a,#f7c948 40%,#ff9d2e);color:#1a1206}
.code{flex:1 1 auto;min-height:0;overflow:hidden;font-family:'Cascadia Code','Cascadia Mono',Consolas,'Courier New',monospace;font-size:1em;line-height:1.5;padding:.85em 5.5em .85em .9em;display:grid;grid-template-columns:auto 1fr;column-gap:1em;align-content:start;white-space:pre-wrap;word-break:break-word}
.pane.in .code{font-size:.82em;color:#aab2c6}
.code .ln{color:#3f4860;text-align:right;font-variant-numeric:tabular-nums}
.code.clipped,.smp.clipped,.tblwrap.clipped{-webkit-mask-image:linear-gradient(#000 78%,transparent 100%);mask-image:linear-gradient(#000 78%,transparent 100%)}
.tk-k{color:#5fd4ff}.tk-s{color:#ffd57a}.tk-n{color:#b9a2ff}.tk-b{color:#ff8f8f}.tk-p{color:#7d869b}.tk-c{color:#5c677d;font-style:italic}.tk-w{color:#ff9d2e}.tk-t{color:#7dd3fc}
.pane-sep{position:relative;height:0;z-index:4;flex:0 0 auto}
.pane-sep span{position:absolute;left:50%;top:0;transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:.45em;font:700 .74em/1 'Sora';padding:.6em 1em;border-radius:999px;background:linear-gradient(120deg,#ffe29a,#f7c948 40%,#ff9d2e);color:#1a1206;white-space:nowrap;box-shadow:0 .5em 1.4em rgba(0,0,0,.45)}
.pane-sep .ic{width:1.1em;height:1.1em;stroke-width:2.8}
.h-code.compact .win{font-size:3.6cqmin}

/* ---------- document: the PDF viewer ---------- */
.h-doc .viewer{width:100%;height:100%;display:flex;flex-direction:column;border-radius:.9em;overflow:hidden;background:var(--viewer);box-shadow:var(--sh);font-size:3cqmin}
.v-bar{display:flex;align-items:center;gap:.6em;padding:.72em 1em;background:var(--viewer-bar);color:var(--viewer-ink);border-bottom:1px solid var(--line);flex:0 0 auto}
.pdfb{font:800 .66em/1 'Sora';letter-spacing:.04em;padding:.45em .6em;border-radius:.35em;background:#d93636;color:#fff}
.v-name{font:600 .82em/1 'Inter';white-space:nowrap;overflow:hidden}
.v-tools{margin-left:auto;display:flex;align-items:center;gap:.9em;color:var(--viewer-ink);font:600 .74em/1 'Inter';white-space:nowrap}
.v-tools b{display:inline-block;padding:.35em .6em;border-radius:.4em;background:var(--chip);color:var(--chip-ink)}
.v-stage{position:relative;flex:1 1 0;min-height:0;overflow:hidden}
.v-page{position:absolute;display:block;background:#fff;border-radius:.25em;box-shadow:0 1.1em 2.2em rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.06)}
.v-ghost{position:absolute;background:#fff;border-radius:.25em;opacity:.5;box-shadow:0 1em 2em rgba(0,0,0,.25)}
.loupe{position:absolute;z-index:3;border-radius:.9em;border:.2em solid var(--accent);background-color:#fff;background-repeat:no-repeat;box-shadow:0 1.4em 3em -0.6em rgba(0,0,0,.55),0 0 0 .5em var(--accent-a16)}
.loupe-tag{position:absolute;z-index:4;font:700 .62em/1 'Inter';letter-spacing:.14em;text-transform:uppercase;padding:.5em .8em;border-radius:.5em;background:var(--chip);color:var(--chip-ink);white-space:nowrap}
.h-doc.compact .viewer{font-size:3.6cqmin}

/* ---------- photo: before / after ---------- */
.ba{position:relative;overflow:hidden;border-radius:3cqmin;box-shadow:var(--sh);background:#111}
.ba.fill,.player.fill,.imgtile.fill{width:100%;height:100%}
.ba img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.ba .after{position:absolute;inset:0;clip-path:inset(0 0 0 50%)}
.ba.diag .after{clip-path:polygon(64% 0,100% 0,100% 100%,36% 100%)}
.checker{position:absolute;inset:0;background:conic-gradient(#e6e7ee 25%,#ffffff 0 50%,#e6e7ee 0 75%,#ffffff 0) 0 0/4.2cqmin 4.2cqmin}
.ba .seam{position:absolute;top:0;bottom:0;left:50%;width:.7cqmin;margin-left:-.35cqmin;background:#fff;box-shadow:0 0 2cqmin rgba(0,0,0,.45)}
.ba svg.seam-d{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.ba .handle{position:absolute;left:50%;top:50%;width:12cqmin;height:12cqmin;transform:translate(-50%,-50%);border-radius:50%;background:#fff;color:#06080f;display:grid;place-items:center;box-shadow:0 1.2cqmin 3.5cqmin rgba(0,0,0,.4),0 0 0 1.1cqmin rgba(255,255,255,.28)}
.ba .handle .ic{width:58%;height:58%;stroke-width:2.6}
.ba .tag{position:absolute;bottom:3.2cqmin;font:700 2.9cqmin/1 'Inter';padding:1.4cqmin 2.3cqmin;border-radius:999px;white-space:nowrap}
.ba .tag.l{left:3.2cqmin;background:rgba(6,8,15,.78);color:#fff}
.ba .tag.r{right:3.2cqmin;background:var(--chip);color:var(--chip-ink)}

/* ---------- video: the player ---------- */
.player{position:relative;overflow:hidden;border-radius:3cqmin;box-shadow:var(--sh);background:#000}
.player>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.player .ctrl{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:2.2cqmin;padding:5cqmin 3cqmin 2.6cqmin;background:linear-gradient(transparent,rgba(0,0,0,.75));color:#fff}
.player .ctrl .ic{width:4.6cqmin;height:4.6cqmin}
.player .scrub{flex:1;height:1cqmin;border-radius:1cqmin;background:rgba(255,255,255,.3);position:relative}
.player .scrub i{position:absolute;left:0;top:0;bottom:0;width:42%;border-radius:1cqmin;background:var(--chip)}
.player .scrub b{position:absolute;left:42%;top:50%;width:2.6cqmin;height:2.6cqmin;border-radius:50%;background:#fff;transform:translate(-50%,-50%)}
.player .ccb{font:800 2.4cqmin/1 'Sora';padding:.9cqmin 1.3cqmin;border-radius:.8cqmin;background:var(--chip);color:var(--chip-ink)}
.inset{position:absolute;z-index:4;overflow:hidden;border-radius:2cqmin;border:.6cqmin solid #fff;box-shadow:0 2cqmin 4cqmin rgba(0,0,0,.5);transform:rotate(-4deg);background:#000}
.inset img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;filter:saturate(.75)}
.inset span{position:absolute;left:1.4cqmin;bottom:1.4cqmin;font:700 2.4cqmin/1 'Inter';padding:1cqmin 1.6cqmin;border-radius:999px;background:rgba(6,8,15,.78);color:#fff}

/* ---------- pdf edits: two pages ---------- */
.h-pages{gap:4cqmin}
.pg{position:relative;flex:0 0 auto}
.pg img{display:block;width:100%;height:100%;background:#fff;border-radius:.8cqmin;box-shadow:var(--sh)}
.pg.before{transform:rotate(-3deg);opacity:.92}
.pg.after{transform:rotate(1.5deg)}
.pg figcaption{position:absolute;left:50%;bottom:-2.4cqmin;transform:translateX(-50%);font:700 2.8cqmin/1 'Inter';padding:1.3cqmin 2.2cqmin;border-radius:999px;white-space:nowrap}
.pg.before figcaption{background:rgba(6,8,15,.8);color:#fff}
.pg.after figcaption{background:var(--chip);color:var(--chip-ink)}
.arrowchip{flex:0 0 auto;width:11cqmin;height:11cqmin;border-radius:50%;display:grid;place-items:center;background:var(--chip);color:var(--chip-ink);box-shadow:0 1cqmin 3cqmin rgba(0,0,0,.35);z-index:3}
.arrowchip .ic{width:55%;height:55%;stroke-width:2.6}

/* ---------- single image (QR and similar) ---------- */
.imgtile{position:relative;background:#fff;border-radius:3cqmin;box-shadow:var(--sh);padding:4cqmin;display:flex;align-items:center;justify-content:center}
.imgtile img{display:block;width:100%;height:100%;object-fit:contain}

/* ---------- schematic: how it works ---------- */
.h-flow{flex-direction:column;gap:3cqmin}
.fl-row{position:relative;display:flex;align-items:center;justify-content:center;width:100%;flex:1 1 0;min-height:0;font-size:2.9cqmin}
.fl-node{display:flex;flex-direction:column;align-items:center;gap:.9em;flex:0 0 36%;max-height:100%;min-height:0}
.fl-card{position:relative;width:100%;aspect-ratio:.78;max-height:calc(100cqh - 11em);border-radius:.8em;overflow:hidden;box-shadow:var(--sh)}
.fl-card.paper{background:#fbf8f1;color:#1d2030;padding:1.1em 1em}
.fl-card.dark{background:var(--card);color:var(--card-ink);border:1px solid var(--line2)}
.fl-card .hd2{display:flex;align-items:center;gap:.5em;margin-bottom:.8em}
.fl-card .hd2 i{width:1.7em;height:1.7em;border-radius:.4em;background:linear-gradient(135deg,#f7c948,#ff9d2e);flex:0 0 auto}
.fl-card .hd2 b{font:800 .95em/1 'Sora';letter-spacing:.06em;text-transform:uppercase}
.fl-card .sk{height:.55em;border-radius:.3em;background:rgba(29,32,48,.12);margin:.55em 0}
.fl-card.dark .sk{background:color-mix(in srgb,var(--card-ink) 16%,transparent)}
.fl-card .smp{font:500 .82em/1.45 'Cascadia Code',Consolas,monospace;color:#3a3f52;white-space:pre-wrap;word-break:break-word;overflow:hidden;max-height:100%}
.fl-card.dark .smp{color:var(--card-ink)}
.tblwrap{height:100%;overflow:hidden}
.fl-card .tbl{width:100%;border-collapse:collapse;font:500 .8em/1.25 'Inter'}
.fl-card .tbl th{font:700 .82em/1 'Inter';letter-spacing:.1em;text-transform:uppercase;text-align:left;color:var(--chip-ink);background:var(--chip);padding:.7em .6em}
.fl-card .tbl td{padding:.55em .6em;border-bottom:1px solid color-mix(in srgb,var(--card-ink) 14%,transparent);vertical-align:top;word-break:break-word}
.fl-card .tbl td:first-child{color:var(--card-muted);white-space:nowrap}
.fl-card .tbl td:last-child{font-weight:600}
.fl-card .tbl td.span{color:var(--card-ink);font-weight:700;white-space:normal}
.fl-card .big{position:absolute;inset:0;display:grid;place-items:center;color:var(--card-muted)}
.fl-card .big .ic{width:42%;height:42%;stroke-width:1.4}
.fl-card .illus{position:absolute;right:.6em;bottom:.6em;font:700 .62em/1 'Inter';letter-spacing:.12em;text-transform:uppercase;padding:.5em .7em;border-radius:.5em;background:#ede9fe;color:#4c1d95;border:1px dashed #7c5cff}
.fl-lab{font:700 1.05em/1.2 'Sora';letter-spacing:-.01em;color:var(--ink);text-align:center;max-width:100%}
.fl-lab small{display:block;font:700 .62em/1 'Inter';letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:.45em}
.fl-mid{flex:1 1 0;display:flex;align-items:center;justify-content:center;position:relative;align-self:stretch;margin-bottom:3em}
.fl-mid svg.wire{position:absolute;left:0;right:0;top:50%;width:100%;height:2em;transform:translateY(-50%);overflow:visible;color:var(--accent)}
.fl-engine{position:relative;z-index:2;width:5.6em;height:5.6em;border-radius:1.4em;display:grid;place-items:center;background:var(--chip);color:var(--chip-ink);box-shadow:0 0 0 .55em var(--accent-a16),0 1em 2.4em -0.4em rgba(0,0,0,.5)}
.fl-engine .glyph{width:52%;height:52%;stroke-width:2}
.fl-engine em{position:absolute;right:-.7em;top:-.7em;font:800 .7em/1 'Sora';font-style:normal;padding:.45em .55em;border-radius:.5em;background:#5b3cf0;color:#fff}
.fl-how{display:flex;align-items:center;gap:.6em;font:700 2.6cqmin/1 'Inter';letter-spacing:.16em;text-transform:uppercase;color:var(--accent-ink);flex:0 0 auto}
.fl-how .ic{width:1.3em;height:1.3em}
.h-flow.compact .fl-row{font-size:3.4cqmin}
@container (max-aspect-ratio: 4/5){
  .fl-row{flex-direction:column;font-size:4.6cqw}
  .fl-node{flex:1 1 0;width:100%;flex-direction:column;gap:.4em}
  .fl-card{aspect-ratio:auto;width:100%;max-height:none;flex:1 1 0;min-height:0}
  .fl-lab{flex:0 0 auto;font-size:.9em}
  .fl-lab small{display:none}
  .fl-mid{flex:0 0 auto;height:4.6em;margin:0;align-self:center;width:100%}
  .fl-engine{width:4.2em;height:4.2em}
  .fl-how{display:none}
  .fl-mid svg.wire{left:50%;top:0;bottom:0;width:2em;height:100%;transform:translateX(-50%) rotate(90deg);transform-origin:center}
}

/* ---------- phone mock-up ---------- */
.phonezone{position:relative;flex:1 1 0;min-height:0;display:flex;align-items:center;justify-content:center}
.phone{position:relative;flex:0 0 auto;background:#0b0d14;border-radius:13% / 6.4%;padding:2.4%;box-shadow:0 50px 90px -30px var(--drop),0 0 0 2px #2a2f3d,0 0 0 9px var(--accent-a16);container-type:size}
.ph-screen{position:absolute;inset:2.4%;border-radius:11% / 5.4%;overflow:hidden;background:var(--bg);display:flex;flex-direction:column;--notch:var(--bg)}
.ph-status{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:3.2cqw 7cqw 1cqw;font:700 3.6cqw/1 'Inter';color:var(--ink)}
.ph-status i{width:9cqw;height:3.4cqw;border-radius:2cqw;border:.5cqw solid var(--ink);opacity:.8}
.ph-url{flex:0 0 auto;display:flex;align-items:center;gap:1.6cqw;margin:2cqw 4cqw 3cqw;padding:2.2cqw 3.2cqw;border-radius:99px;background:var(--panel2);border:1px solid var(--line2);font:600 3.4cqw/1 'Inter';color:var(--ink2);white-space:nowrap;overflow:hidden}
.ph-url .ic{width:3.6cqw;height:3.6cqw;color:var(--ok);stroke-width:3}
.ph-url span{overflow:hidden;text-overflow:ellipsis}
.ph-body{position:relative;flex:1 1 0;min-height:0;display:flex;flex-direction:column;padding:2cqw 4cqw 5cqw}
.ph-qr{flex:1;display:flex;align-items:center;justify-content:center}
.ph-qr .qrtile{width:88%;padding:4cqw 4cqw 3cqw;box-shadow:none;border-radius:6cqw}
.ph-qr .qrtile svg{width:100%!important;height:auto!important}
.ph-qr .qrcap{font-size:3.6cqw}

/* ================= formats ================= */

/* ----- carousel 1080x1350 ----- */
.f-carousel .inner{inset:64px}
.f-carousel .body{flex:1 1 0;min-height:0;display:flex;flex-direction:column;padding:44px 0 34px}
.f-carousel .body.center{align-items:center;text-align:center}
.s1 .persona{margin-bottom:6px}
.hookbox{flex:1 1 0}
.f-carousel .hookbox{font-size:118px}
.bubble{position:relative;flex:0 0 auto;margin-top:34px;padding:38px 42px 40px 44px;border-radius:34px 34px 34px 10px;background:var(--panel);border:1px solid var(--line2);box-shadow:0 30px 60px -30px rgba(0,0,0,.5)}
.bubble .q{position:absolute;right:30px;top:-46px;font:800 150px/1 'Sora';color:var(--accent)}
.bubble-label{font:700 21px/1 'Inter';letter-spacing:.16em;text-transform:uppercase;color:var(--accent-ink);margin-bottom:18px}
.pain{font:500 40px/1.32 'Inter';color:var(--ink);max-height:280px;overflow:hidden;letter-spacing:-.01em}
.titlebox{max-height:290px;margin-top:22px}
.usual{list-style:none;flex:1 1 0;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:30px;padding:16px 0}
.chip{display:flex;align-items:center;gap:30px;padding:30px 36px;border-radius:28px;background:var(--coral-bg);border:1.5px solid var(--coral-line);box-shadow:0 24px 50px -30px rgba(0,0,0,.5)}
.chip:nth-child(1){transform:rotate(-1.2deg)}
.chip:nth-child(2){transform:rotate(.9deg);margin-left:34px}
.chip:nth-child(3){transform:rotate(-.5deg);margin-left:12px}
.xm{flex:0 0 auto;width:78px;height:78px;border-radius:50%;display:grid;place-items:center;background:#ff6b6b;color:#fff;box-shadow:0 0 0 9px rgba(255,107,107,.16)}
.xm .ic{width:44px;height:44px;stroke-width:3.2}
.ctext{flex:1;min-width:0;font:600 42px/1.2 'Inter';letter-spacing:-.015em;color:var(--ink);max-height:154px;overflow:hidden;text-decoration:line-through;text-decoration-color:rgba(255,107,107,.62);text-decoration-thickness:3px}
.turn{display:flex;align-items:center;gap:14px;font:700 34px/1.1 'Sora';letter-spacing:-.02em;color:var(--accent-ink);flex:0 0 auto}
.turn .ic{width:40px;height:40px;stroke-width:2.6}
.fixhead{flex:0 0 auto;display:flex;flex-direction:column;gap:14px;margin-bottom:46px}
.tnamebox{max-height:170px}
.tnamebox.big{max-height:250px;margin:14px 0 36px}
.promise{font:500 34px/1.3 'Inter';color:var(--ink2);max-height:92px;overflow:hidden}
.promise.under{margin-top:36px;flex:0 0 auto}
.cap{flex:0 0 auto;margin-top:22px;font:500 22px/1.3 'Inter';color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.steps{position:relative;list-style:none;flex:1 1 0;min-height:0;display:flex;flex-direction:column;justify-content:space-around;padding:10px 0}
.steps svg.path{position:absolute;inset:0;width:100%;height:100%;overflow:visible;z-index:0;color:var(--accent)}
.step{position:relative;z-index:1;display:flex;align-items:center;gap:34px}
.step:nth-child(3){margin-left:150px}.step:nth-child(4){margin-left:50px}
.node{flex:0 0 auto;width:128px;height:128px;border-radius:50%;display:grid;place-items:center;font:800 62px/1 'Sora';letter-spacing:-.04em;background:var(--chip);color:var(--chip-ink);box-shadow:0 0 0 12px var(--accent-a16),0 24px 40px -14px rgba(0,0,0,.55)}
.stext{flex:1;min-width:0;font:700 50px/1.12 'Sora';letter-spacing:-.03em;color:var(--ink);max-height:120px;overflow:hidden}
.youget{flex:0 0 auto;display:flex;align-items:center;gap:16px;margin-top:6px;padding:20px 26px;border-radius:22px;background:var(--panel);border:1px dashed var(--line2);font:600 28px/1.2 'Inter';color:var(--ink2)}
.youget b{color:var(--ink);font-weight:700}
.youget .ic{width:34px;height:34px;color:var(--ok);stroke-width:2.8}
.ctabox{max-height:210px;width:100%}
.ctabox.big{max-height:360px}
.body.center .cta{text-align:center}
.ctool{font:600 34px/1.2 'Inter';color:var(--ink2);margin-top:12px;max-width:100%;max-height:88px;overflow:hidden;flex:0 0 auto}
.qrzone{flex:1 1 0;min-height:0;display:flex;align-items:center;justify-content:center;width:100%}
.qrtile{position:relative;background:#fff;border-radius:40px;padding:26px 26px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;box-shadow:0 0 0 12px var(--accent-a16),0 40px 80px -30px rgba(0,0,0,.6);flex:0 0 auto}
.qrtile svg{display:block}
.qrtile .qrcap{font:700 22px/1 'Inter';letter-spacing:.14em;text-transform:uppercase;color:#3f4456}
.f-carousel .url{font:700 42px/1.12 'Sora';letter-spacing:-.025em;white-space:nowrap;overflow:hidden;max-width:100%;flex:0 0 auto}
.f-carousel .pills{margin-top:24px}
.save{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:16px;margin-top:30px;font:700 30px/1 'Sora';letter-spacing:-.02em;color:var(--ink)}
.save b{display:grid;place-items:center;width:62px;height:62px;border-radius:18px;background:var(--panel2);border:1.5px solid var(--line2);color:var(--accent-ink)}
.save b .ic{width:32px;height:32px;stroke-width:2.4}
.save b .ic path{fill:currentColor;fill-opacity:.18}

/* carousel · poster */
.L-poster.f-carousel .hookbox{font-size:150px}
.rule-pain{flex:0 0 auto;margin-top:40px;padding-left:30px;border-left:8px solid var(--accent);display:flex;flex-direction:column;gap:14px}
.rule-pain .pain{font-size:38px;max-height:230px}
.urows{list-style:none;flex:1 1 0;min-height:0;display:flex;flex-direction:column;justify-content:center;margin:20px 0}
.urows li{display:flex;align-items:center;gap:28px;padding:30px 0;border-top:2px solid var(--line2)}
.urows li:last-child{border-bottom:2px solid var(--line2)}
.ux{flex:0 0 auto;color:var(--coral);width:70px;height:70px}
.ux .ic{width:70px;height:70px;stroke-width:3}
.utext{flex:1;min-width:0;font:700 46px/1.15 'Sora';letter-spacing:-.03em;color:var(--ink);max-height:112px;overflow:hidden;text-decoration:line-through;text-decoration-color:rgba(255,107,107,.65);text-decoration-thickness:4px}
.urows em{flex:0 0 auto;font:800 30px/1 'Sora';font-style:normal;color:var(--muted)}
.bsteps{list-style:none;flex:1 1 0;min-height:0;display:flex;flex-direction:column;justify-content:space-evenly}
.bsteps li{display:flex;align-items:center;gap:34px}
.bn{flex:0 0 auto;width:160px;font:800 200px/.82 'Sora';letter-spacing:-.06em;text-align:center;background-image:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}
.y-caps .bn,.y-serif .bn,.y-marker .bn{background:none;-webkit-text-fill-color:var(--accent-ink);color:var(--accent-ink)}
.btext{flex:1;min-width:0;font:700 52px/1.1 'Sora';letter-spacing:-.03em;color:var(--ink);max-height:120px;overflow:hidden}
.bsteps.ruled li{border-top:2px solid var(--line2);padding:18px 0}
.bsteps.ruled li:last-child{border-bottom:2px solid var(--line2)}
.bsteps.ruled .bn{font-size:150px;width:130px}
.herobox.tilt{margin:0 10px}
.qrrow{flex:1 1 0;min-height:0;display:flex;align-items:center;gap:44px}
.qrside{flex:1;min-width:0;display:flex;flex-direction:column;gap:20px;align-items:flex-start}
.qrside .ctool{margin:0;font:700 40px/1.1 'Sora';color:var(--ink);max-height:140px}
.qrside .url{font:700 34px/1.2 'Sora';white-space:normal;overflow-wrap:anywhere;max-height:130px;overflow:hidden}
.qrside .pills{margin-top:6px}
.qrrow .qrtile svg{width:340px!important;height:340px!important}

/* carousel · split */
.L-split.f-carousel .fieldzone{margin:-64px -64px 0;padding:64px 64px 46px}
.L-split.f-carousel .fz-tall{height:700px}
.L-split.f-carousel .fz-hero{padding-bottom:190px}
.L-split.f-carousel .fz-cta{padding-bottom:250px}
.L-split .fieldzone .eyebrow{margin-top:40px}
.L-split .fieldzone .titlebox{margin-top:18px}
.L-split .fieldzone .hookbox{margin-top:10px}
.body.after-field{padding-top:44px}
.body.straddle{margin-top:-170px;padding-top:0;position:relative;z-index:2}
.L-split.f-carousel .s5 .body.straddle{margin-top:-230px}
.L-split .fieldzone .tnamebox{margin-top:12px}
.L-split .fieldzone .promise{margin-top:10px}

/* carousel · cover */
.mast{flex:0 0 auto;padding-bottom:12px;border-bottom:4px solid var(--ink)}
.mast-name{font:800 196px/.84 'Sora';letter-spacing:-.065em;color:var(--ink);white-space:nowrap;overflow:hidden}
.mast-line{display:flex;justify-content:space-between;gap:16px;margin-top:14px;font:700 19px/1 'Inter';letter-spacing:.18em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.mast.compact .mast-name{font-size:120px}
.mast.compact{padding-bottom:10px;border-bottom-width:3px}
.mast.compact .mast-line{font-size:16px;margin-top:10px}
.kicker2{flex:0 0 auto;display:flex;align-items:center;gap:14px;font:700 24px/1.1 'Inter';letter-spacing:.14em;text-transform:uppercase;color:var(--accent-ink)}
.kicker2::before{content:'';width:46px;height:6px;background:var(--accent);flex:0 0 auto}
.L-cover .s1 .body{padding-top:36px}
.L-cover .s1 .hookbox{margin-top:16px}
.standfirst{flex:0 0 auto;font:500 36px/1.32 'Inter';font-style:italic;color:var(--ink2);margin-top:26px;max-height:200px;overflow:hidden}
.standfirst.sm{font-size:32px;max-height:94px;margin:10px 0 34px}
.coverlines{flex:0 0 auto;display:flex;align-items:center;gap:26px;margin-top:30px;padding-top:20px;border-top:3px solid var(--ink);font:700 24px/1.1 'Inter';color:var(--ink);white-space:nowrap}
.coverlines b{font:800 22px/1 'Inter';letter-spacing:.18em;text-transform:uppercase;color:var(--accent-ink)}
.coverlines span{display:flex;align-items:center;gap:10px}
.coverlines em{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--chip);color:var(--chip-ink);font:800 20px/1 'Sora';font-style:normal}
.runhead{flex:0 0 auto;display:flex;align-items:baseline;gap:22px;padding-bottom:16px;border-bottom:3px solid var(--ink);white-space:nowrap}
.runhead b{font:800 30px/1 'Sora';letter-spacing:-.04em;color:var(--ink)}
.runhead span{font:700 20px/1 'Inter';letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.runhead em{margin-left:auto;font:italic 600 26px/1 ${SERIF};color:var(--accent-ink)}
.figcap{flex:0 0 auto;margin-top:26px;padding-top:14px;border-top:1px solid var(--line2);font:500 24px/1.3 'Inter';color:var(--muted)}
.figcap b{color:var(--accent-ink);margin-right:12px;font-weight:700}
.backrow{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;margin-top:24px}
.backrow .save{margin:0}
.barcode{width:210px;height:74px;background:repeating-linear-gradient(90deg,var(--ink) 0 3px,transparent 3px 6px,var(--ink) 6px 7px,transparent 7px 11px,var(--ink) 11px 15px,transparent 15px 17px);opacity:.85}

/* carousel · device */
.phonerow{flex:1 1 0;min-height:0;display:flex;align-items:center;gap:46px}
.phonerow .phone{height:100%}
.phonerow .qrside{gap:22px}

/* ----- square 1080x1080 ----- */
.f-square .inner{inset:60px 64px}
.f-square .hookbox{flex:0 0 auto;max-height:200px;margin:30px 0 30px;font-size:84px}
.f-square .herobox{margin:6px 0 30px}
.sq-foot{flex:0 0 auto;display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding-top:24px;border-top:1px solid var(--line)}
.sq-name{min-width:0;display:flex;flex-direction:column;gap:10px}
.sq-name b{font:800 34px/1.05 'Sora';letter-spacing:-.03em;color:var(--ink);white-space:nowrap;overflow:hidden}
.sq-name span,.sq-url{font:600 22px/1.1 'Inter';color:var(--accent-ink);white-space:nowrap;overflow:hidden}
.f-square .pills{flex-wrap:nowrap;gap:10px}
.f-square .pill{font-size:20px;padding:12px 16px}
.f-square .pills.stack{flex-wrap:nowrap}
/* square · poster (quote card) */
.quote{flex:1 1 0;min-height:0;display:flex;flex-direction:column;margin-top:26px}
.qmark{flex:0 0 auto;font:800 230px/.62 'Sora';color:var(--accent);height:118px}
.quotebox{flex:1 1 0;max-height:none}
.qtext{font-weight:700;letter-spacing:-.035em;line-height:1.12}
.attr{flex:0 0 auto;margin-top:14px;font:600 24px/1.2 'Inter';color:var(--muted)}
.attr::before{content:'— '}
.sq-row{flex:0 0 330px;display:flex;align-items:stretch;gap:34px;margin-top:30px;padding-top:26px;border-top:1px solid var(--line)}
.sq-fix{flex:1;min-width:0;display:flex;flex-direction:column;gap:14px;justify-content:flex-end}
.sq-promise{font:700 32px/1.18 'Sora';letter-spacing:-.025em;color:var(--ink);max-height:160px;overflow:hidden}
.herobox.thumb{flex:0 0 440px;margin:0}
/* square · split and device (rows) */
.f-square.L-split .inner{inset:0}
.f-square .fz-side{flex:0 0 47%;padding:60px 48px 56px 60px}
.f-square .fz-side .hookbox{flex:1 1 0;max-height:none;margin:30px 0 24px}
.f-square .fz-side .sq-name span{color:var(--field-ink)}
.sideright{flex:1 1 0;min-width:0;display:flex;flex-direction:column;padding:76px 60px 56px 46px}
.sideright .herobox{margin:0 0 30px}
.f-square.L-device .inner{gap:40px}
.sideleft{flex:1 1 0;min-width:0;display:flex;flex-direction:column}
.sideleft .hookbox{flex:1 1 0;max-height:none;margin:34px 0 20px}
.sideleft .sq-promise{flex:0 0 auto;margin-bottom:24px;max-height:120px;font-weight:600;font-family:'Inter';letter-spacing:-.01em;color:var(--ink2)}
.sideleft .pills{margin-bottom:22px}
.f-square.L-device .phonezone{flex:0 0 420px}
/* square · cover */
.f-square.L-cover .herobox.coverimg{margin:26px 0 22px}
.f-square.L-cover .hookbox{margin:0 0 22px;max-height:180px}

/* ----- story 1080x1920 (safe area 250 top, 340 bottom) ----- */
.f-story .inner{top:250px;bottom:340px;left:72px;right:72px}
.f-story .bar .logo svg{width:46px;height:46px}.f-story .bar .logo span{font-size:27px}
.st-pain{flex:0 0 auto;margin-top:40px}
.st-painbox{max-height:250px;margin-top:16px}
.st-painbox.sm{max-height:190px;margin-top:36px}
.pain2{font-weight:700;letter-spacing:-.035em;line-height:1.14}
.f-story .herobox{margin:44px 0 40px}
.st-promisebox{max-height:150px}
.st-promisebox.sm{max-height:126px}
.st-cta{flex:0 0 auto;display:flex;align-items:center;gap:40px;margin-top:40px}
.sticker{flex:0 0 auto;transform:rotate(-4deg);background:#fff;border-radius:34px;padding:20px 20px 16px;display:flex;flex-direction:column;align-items:center;gap:12px;box-shadow:0 0 0 10px var(--accent-a35),0 30px 60px -20px rgba(0,0,0,.6)}
.sticker .lab{font:800 28px/1 'Sora';letter-spacing:-.02em;color:#06080f;display:flex;align-items:center;gap:10px;white-space:nowrap}
.sticker .lab i{display:block;width:16px;height:16px;border-radius:50%;background:linear-gradient(120deg,#f7c948,#ff9d2e)}
.st-right{flex:1;min-width:0;display:flex;flex-direction:column;gap:18px}
.st-right .lead{font:700 24px/1 'Inter';letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.st-right .url{font:700 34px/1.15 'Sora';letter-spacing:-.025em;overflow:hidden;max-height:82px}
.f-story .pills{gap:10px}.f-story .pill{font-size:21px;padding:12px 16px}
.st-hookbox{max-height:400px;margin-top:40px}
.st-painline{flex:0 0 auto;margin-top:22px;font:500 32px/1.3 'Inter';color:var(--ink2);max-height:126px;overflow:hidden}
.f-story .fz-story{margin:-250px -72px 0;padding:250px 72px 210px}
.f-story .fz-story .eyebrow{margin-top:44px}
.st-mid{flex:1 1 0;min-height:0;display:flex;flex-direction:column;margin-top:-170px;position:relative;z-index:2}
.st-mid .herobox{margin:0 0 36px}
.f-story.L-device .phonezone{margin:40px 0 36px}

/* ----- pin 1000x1500 ----- */
.f-pin .inner{inset:58px 62px}
.pin-head{flex:0 0 auto;margin-top:34px}
.kicker{font:800 46px/1 'Sora';letter-spacing:-.03em;margin-bottom:10px;color:var(--ink)}
.pin-hbox{max-height:262px}
.pin-h{letter-spacing:-.045em}
.f-pin .herobox{margin:40px 0 40px}
.f-pin .herobox.short{flex:0 0 470px}
.psteps{flex:0 0 auto;position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:22px;list-style:none}
.psteps::before{content:'';position:absolute;left:16%;right:16%;top:39px;border-top:4px dotted var(--accent);opacity:.7}
.pstep{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px}
.pnode{width:80px;height:80px;border-radius:50%;display:grid;place-items:center;font:800 38px/1 'Sora';background:var(--chip);color:var(--chip-ink);box-shadow:0 0 0 9px var(--bg),0 0 0 11px var(--accent-a35)}
.ptext{font:700 27px/1.18 'Sora';letter-spacing:-.02em;color:var(--ink);max-height:96px;overflow:hidden;width:100%}
.pin-foot{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px 20px;margin-top:34px;padding-top:24px;border-top:1px solid var(--line)}
.pin-foot .url{font:700 30px/1.1 'Sora';letter-spacing:-.02em;white-space:nowrap;overflow:hidden;min-width:0}
.pin-foot .pills{flex-wrap:nowrap;gap:8px}.pin-foot .pill{font-size:19px;padding:11px 14px}
.bsteps.pin .bn{font-size:130px;width:110px}
.bsteps.pin .btext{font-size:40px;max-height:96px}
.bsteps.pin li{gap:26px}
.f-pin .fz-pin{margin:-58px -62px 0;padding:58px 62px 190px}
.f-pin .fz-pin .kicker{margin-top:36px}
.pin-mid{flex:1 1 0;min-height:0;display:flex;flex-direction:column;margin-top:-160px;position:relative;z-index:2}
.pin-mid .herobox{margin:0 0 36px}
.f-pin.L-cover .pin-head{margin-top:26px}
.f-pin.L-cover .herobox{margin:30px 0 26px}
.clines{flex:0 0 auto;list-style:none;border-top:3px solid var(--ink)}
.clines li{display:flex;align-items:center;gap:18px;padding:13px 0;border-bottom:1px solid var(--line2)}
.clines em{flex:0 0 auto;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:var(--chip);color:var(--chip-ink);font:800 24px/1 'Sora';font-style:normal}
.clines span{flex:1;min-width:0;font:700 30px/1.15 'Sora';letter-spacing:-.02em;color:var(--ink);max-height:70px;overflow:hidden}
.f-pin.L-device .phonezone{margin:34px 0 36px}

/* ----- wide 1200x630 ----- */
.f-wide .inner{inset:46px 52px;gap:44px}
.w-left{flex:0 0 560px;min-width:0;display:flex;flex-direction:column}
.w-left.wide{flex:0 0 640px}
.w-right{flex:1 1 0;min-width:0;display:flex;flex-direction:column;padding:8px 0}
.w-right.col{padding:46px 52px 40px 44px}
.f-wide .logo svg{width:44px;height:44px}.f-wide .logo span{font-size:26px}
.w-prob{margin-top:30px;flex:0 0 auto}
.f-wide .eyebrow{font-size:17px;gap:9px}.f-wide .eyebrow .ic{width:24px;height:24px}
.w-pain{margin-top:10px;font:500 24px/1.32 'Inter';color:var(--ink2);max-height:96px;overflow:hidden;flex:0 0 auto}
.w-fix{margin-top:22px;flex:1 1 0;min-height:0;display:flex;flex-direction:column}
.w-promisebox{flex:1 1 0;margin-top:10px;font-size:46px}
.w-promisebox.sm{flex:0 0 auto;max-height:96px;margin:10px 0 16px}
.w-foot{flex:0 0 auto;display:flex;align-items:center;gap:14px;margin-top:14px}
.w-foot .url{font:700 23px/1.1 'Sora';letter-spacing:-.02em;white-space:nowrap;overflow:hidden;min-width:0}
.w-foot .go{flex:0 0 auto;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:var(--chip);color:var(--chip-ink)}
.w-foot .go .ic{width:24px;height:24px;stroke-width:2.6}
.f-wide .badge{font-size:16px;padding:10px 13px}.f-wide .badge .ic{width:17px;height:17px}
.f-wide .sec{font-size:17px;padding:9px 14px}
.w-quote{flex:1 1 0;min-height:0;display:flex;flex-direction:column;margin-top:20px}
.f-wide .qmark{font-size:150px;height:72px}
.w-qbox{flex:1 1 0}
.w-answer{flex:0 0 auto;display:flex;align-items:center;gap:14px;margin-top:12px;color:var(--accent-ink)}
.w-answer .ic{width:30px;height:30px;stroke-width:2.6}
.w-answer p{font:700 26px/1.2 'Sora';letter-spacing:-.02em;color:var(--ink);max-height:64px;overflow:hidden}
.w-right.narrow{padding:20px 6px}
.f-wide.L-split .inner{inset:0;gap:0}
.f-wide .fz-wide{flex:0 0 500px;padding:46px 44px 46px 52px}
.w-pain2{margin-top:14px;font:700 30px/1.22 'Sora';letter-spacing:-.025em;max-height:250px;overflow:hidden}
.f-wide.L-split .herobox{margin:0 0 4px}
.w-hookbox{flex:1 1 0;margin:20px 0 10px}
.f-wide.L-device .phonezone{flex:0 0 330px}
`;

function css() { return fontFaces() + PAL.css() + CSS; }

module.exports = { css, THEMES, SERIF };
