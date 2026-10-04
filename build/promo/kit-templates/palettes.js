'use strict';
/**
 * Named palettes for kit images. Every palette is usable by every tool; the
 * section only weights which one is picked (variant.js).
 *
 * Tokens (all hex unless noted):
 *   bg ink ink2 muted       field text and body text; ink/ink2/muted >= 4.5:1 on bg (WCAG AA body)
 *   grad[3]                 the highlighted keyword in headlines; each stop >= 3:1 on bg (AA large)
 *   chip[3] + chipInk       filled stickers, nodes, counters; chipInk >= 4.5:1 on every stop
 *   accent                  solid accent (marker band, outline stroke, rings); >= 3:1 on bg
 *   accentInk               small accent text (eyebrows, URLs); >= 4.5:1 on bg
 *   coralInk                "the usual way" text; >= 4.5:1 on bg
 *   field + fieldInk        the solid block of split layouts; fieldInk >= 4.5:1 on field
 *   card + cardInk + cardMuted  tickets, tables, panels drawn solid; both >= 4.5:1 on card
 *   glowA glowB glowC dot   atmosphere (rgba strings)
 *   light                   true for light palettes (softer shadows)
 *
 * checkAll() runs at require time and throws if any pair falls short, so a
 * palette that fails AA can never render.
 */

const PALETTES = {
  midnight: {
    label: 'Midnight Gold', light: false,
    bg: '#06080f', ink: '#f4f6fb', ink2: '#c3c9d9', muted: '#8a93a8',
    grad: ['#ffe29a', '#f7c948', '#ff9d2e'], chip: ['#ffe29a', '#f7c948', '#ff9d2e'], chipInk: '#1a1206',
    accent: '#f7c948', accentInk: '#f7c948', coralInk: '#ff8f8f',
    field: '#f7c948', fieldInk: '#120d02', card: '#0f1422', cardInk: '#f4f6fb', cardMuted: '#8f98ad',
    glowA: 'rgba(247,201,72,.19)', glowB: 'rgba(124,92,255,.24)', glowC: 'rgba(45,212,255,.08)', dot: 'rgba(255,255,255,.055)',
  },
  daylight: {
    label: 'Daylight', light: true,
    bg: '#fbf7ee', ink: '#15171f', ink2: '#3c4050', muted: '#5f6375',
    grad: ['#b86e00', '#c2570c', '#b8321a'], chip: ['#ffe29a', '#f7c948', '#ff9d2e'], chipInk: '#1a1206',
    accent: '#b86e00', accentInk: '#9a5300', marker: '#f7c948', coralInk: '#c22f2f',
    field: '#6d4aff', fieldInk: '#ffffff', card: '#ffffff', cardInk: '#15171f', cardMuted: '#5f6375',
    glowA: 'rgba(247,201,72,.40)', glowB: 'rgba(124,92,255,.15)', glowC: 'rgba(45,212,255,.12)', dot: 'rgba(21,23,31,.075)',
  },
  violet: {
    label: 'Violet Night', light: false,
    bg: '#0e0a24', ink: '#f5f3ff', ink2: '#d0c9f2', muted: '#a197cf',
    grad: ['#f5d0fe', '#c4b5fd', '#a78bfa'], chip: ['#f5d0fe', '#c4b5fd', '#a78bfa'], chipInk: '#1b0f3a',
    accent: '#a78bfa', accentInk: '#c4b5fd', coralInk: '#ff9a9a',
    field: '#6d4aff', fieldInk: '#ffffff', card: '#171135', cardInk: '#f5f3ff', cardMuted: '#a79ed6',
    glowA: 'rgba(167,139,250,.26)', glowB: 'rgba(240,171,252,.16)', glowC: 'rgba(45,212,255,.07)', dot: 'rgba(255,255,255,.055)',
  },
  ocean: {
    label: 'Ocean', light: false,
    bg: '#041526', ink: '#eefaff', ink2: '#b7d3e3', muted: '#7fa3ba',
    grad: ['#cffafe', '#67e8f9', '#2dd4ff'], chip: ['#a5f3fc', '#2dd4ff', '#38bdf8'], chipInk: '#04121f',
    accent: '#2dd4ff', accentInk: '#5fe0ff', coralInk: '#ff9a9a',
    field: '#2dd4ff', fieldInk: '#04121f', card: '#0a2238', cardInk: '#eefaff', cardMuted: '#8cb0c6',
    glowA: 'rgba(45,212,255,.20)', glowB: 'rgba(56,189,248,.14)', glowC: 'rgba(124,92,255,.10)', dot: 'rgba(255,255,255,.05)',
  },
  ember: {
    label: 'Ember', light: false,
    bg: '#17110d', ink: '#fff6ee', ink2: '#ecd5c6', muted: '#b8998a',
    grad: ['#ffd08a', '#ff9d2e', '#ff6b6b'], chip: ['#ffd08a', '#ff9d2e', '#ff7a5c'], chipInk: '#1f0d04',
    accent: '#ff9d2e', accentInk: '#ffb15c', coralInk: '#ff9a8a',
    field: '#ff9d2e', fieldInk: '#1f0d04', card: '#231a14', cardInk: '#fff6ee', cardMuted: '#c3a596',
    glowA: 'rgba(255,157,46,.22)', glowB: 'rgba(255,107,107,.18)', glowC: 'rgba(247,201,72,.08)', dot: 'rgba(255,255,255,.05)',
  },
  mint: {
    label: 'Mint', light: false,
    bg: '#04100c', ink: '#eefff7', ink2: '#c2ead9', muted: '#86b6a4',
    grad: ['#d1fae5', '#6ee7b7', '#2dd4bf'], chip: ['#d1fae5', '#6ee7b7', '#2dd4bf'], chipInk: '#03140e',
    accent: '#6ee7b7', accentInk: '#6ee7b7', coralInk: '#ff9a9a',
    field: '#6ee7b7', fieldInk: '#03140e', card: '#0a1d17', cardInk: '#eefff7', cardMuted: '#8fbfad',
    glowA: 'rgba(110,231,183,.18)', glowB: 'rgba(45,212,191,.14)', glowC: 'rgba(247,201,72,.06)', dot: 'rgba(255,255,255,.05)',
  },
  paper: {
    label: 'Paper', light: true,
    bg: '#f4efe3', ink: '#1c1a17', ink2: '#45403a', muted: '#6b645a',
    grad: ['#b42318', '#c2410c', '#9a3412'], chip: ['#b42318', '#c2410c', '#9a3412'], chipInk: '#ffffff',
    accent: '#c2410c', accentInk: '#9a3412', marker: '#f2c14e', coralInk: '#a61b1b',
    field: '#1c1a17', fieldInk: '#f4efe3', card: '#fffdf7', cardInk: '#1c1a17', cardMuted: '#665f55',
    glowA: 'rgba(194,65,12,.07)', glowB: 'rgba(28,26,23,.05)', glowC: 'rgba(194,65,12,.04)', dot: 'rgba(28,26,23,.07)',
  },
  block: {
    label: 'Bold Block', light: true,
    bg: '#f7c948', ink: '#0b0b0f', ink2: '#2b2410', muted: '#4d4215',
    grad: ['#4c1d95', '#5b21b6', '#3b0764'], chip: ['#0b0b0f', '#1f1a10', '#0b0b0f'], chipInk: '#f7c948',
    accent: '#5b21b6', accentInk: '#4c1d95', marker: '#ffffff', coralInk: '#9f1239',
    field: '#0b0b0f', fieldInk: '#f7c948', card: '#fffbef', cardInk: '#0b0b0f', cardMuted: '#5c5236',
    glowA: 'rgba(255,255,255,.30)', glowB: 'rgba(255,157,46,.35)', glowC: 'rgba(255,255,255,.12)', dot: 'rgba(11,11,15,.10)',
  },
};

/* ---- WCAG 2 contrast ---- */
function lum(hex) {
  const h = String(hex).replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  const [r, g, b] = v.map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Every pair a palette must pass: [label, fg, bg, minimum]. */
function pairs(p) {
  const out = [
    ['ink on bg', p.ink, p.bg, 4.5], ['ink2 on bg', p.ink2, p.bg, 4.5], ['muted on bg', p.muted, p.bg, 4.5],
    ['accentInk on bg', p.accentInk, p.bg, 4.5], ['coralInk on bg', p.coralInk, p.bg, 4.5],
    ['accent on bg', p.accent, p.bg, 3], ['ink on marker', p.ink, p.marker || p.bg, 4.5], ['fieldInk on field', p.fieldInk, p.field, 4.5],
    ['cardInk on card', p.cardInk, p.card, 4.5], ['cardMuted on card', p.cardMuted, p.card, 4.5],
  ];
  p.grad.forEach((c, i) => out.push(['grad[' + i + '] on bg (large text)', c, p.bg, 3]));
  p.chip.forEach((c, i) => out.push(['chipInk on chip[' + i + ']', p.chipInk, c, 4.5]));
  return out;
}

/** [{ palette, pair, ratio, min, ok }] for every palette. */
function audit() {
  const rows = [];
  for (const [id, p] of Object.entries(PALETTES)) {
    for (const [pair, fg, bg, min] of pairs(p)) {
      const ratio = contrast(fg, bg);
      rows.push({ palette: id, pair, fg, bg, ratio: Math.round(ratio * 100) / 100, min, ok: ratio >= min });
    }
  }
  return rows;
}
function checkAll() {
  const bad = audit().filter((r) => !r.ok);
  if (bad.length) throw new Error('Palette contrast below WCAG AA: ' + bad.map((r) => r.palette + ' ' + r.pair + ' ' + r.ratio + ' < ' + r.min).join('; '));
  return true;
}
checkAll();

function hexA(hex, a) {
  const h = hex.replace('#', '');
  return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
}

/** One CSS rule per palette: .p-<id>{--bg:…} */
function css() {
  return Object.entries(PALETTES).map(([id, p]) => {
    const L = p.light;
    const v = {
      bg: p.bg, ink: p.ink, ink2: p.ink2, muted: p.muted,
      line: hexA(p.ink, L ? 0.10 : 0.09), line2: hexA(p.ink, L ? 0.17 : 0.16),
      panel: L ? 'rgba(255,255,255,.62)' : hexA(p.ink, 0.045), panel2: L ? '#ffffff' : hexA(p.ink, 0.075),
      grad: 'linear-gradient(120deg,' + p.grad[0] + ' 0%,' + p.grad[1] + ' 42%,' + p.grad[2] + ' 92%)',
      chip: 'linear-gradient(120deg,' + p.chip[0] + ' 0%,' + p.chip[1] + ' 42%,' + p.chip[2] + ' 92%)',
      'chip-ink': p.chipInk, accent: p.accent, 'accent-ink': p.accentInk,
      'accent-a10': hexA(p.accent, 0.10), 'accent-a16': hexA(p.accent, 0.16), 'accent-a35': hexA(p.accent, 0.35), 'accent-a55': hexA(p.accent, L ? 0.42 : 0.5), marker: p.marker ? hexA(p.marker, .85) : hexA(p.accent, .38),
      'coral-ink': p.coralInk, coral: '#ff6b6b', 'coral-bg': L ? 'rgba(255,107,107,.10)' : 'rgba(255,107,107,.075)', 'coral-line': L ? 'rgba(229,72,77,.38)' : 'rgba(255,107,107,.34)',
      field: p.field, 'field-ink': p.fieldInk, card: p.card, 'card-ink': p.cardInk, 'card-muted': p.cardMuted,
      glowA: p.glowA, glowB: p.glowB, glowC: p.glowC, dot: p.dot, wm: L ? '.07' : '.05',
      sh: L ? '0 40px 70px -26px rgba(60,40,8,.30),0 0 0 1px ' + hexA(p.ink, 0.08) : '0 44px 90px -24px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.07)',
      'drop': L ? 'rgba(80,56,10,.22)' : 'rgba(0,0,0,.5)',
      viewer: L ? '#e9e3d5' : '#161b29', 'viewer-bar': L ? '#ffffff' : '#10141f', 'viewer-ink': L ? '#3c4050' : '#c3c9d9',
    };
    return '.p-' + id + '{' + Object.entries(v).map(([k, x]) => '--' + k + ':' + x).join(';') + '}';
  }).join('\n');
}

module.exports = { PALETTES, IDS: Object.keys(PALETTES), contrast, lum, audit, checkAll, css };
