/**
 * MVRTextLayout: turns what pdf.js reports about a page's text into lines,
 * paragraphs, headings and list items in reading order, and writes the
 * result as plain text or as a small Word (.docx) file.
 *
 * Pure and synchronous; no DOM, no third-party code. A classic script: it
 * attaches MVRTextLayout to `self` (a page or a Web Worker) and to
 * module.exports under Node.
 *
 * Input, one entry per page, straight from pdf.js:
 *   {
 *     pages: [{
 *       width, height,          // page.getViewport({ scale: 1 })
 *       transform,              // optional: that viewport's .transform; pass
 *                               // it so /Rotate and odd MediaBox origins work
 *       items, styles,          // page.getTextContent()
 *       fonts                   // optional { [item.fontName]: real font name },
 *                               // e.g. from page.commonObjs.get(id).name after
 *                               // page.getOperatorList(); lets bold-named
 *                               // fonts mark headings
 *     }]
 *   }
 *
 * API:
 *   layout(input, { order: 'reading' | 'stream', furniture: 'keep' | 'drop' }) -> result
 *     'stream' keeps pdf.js's item order (content-stream order) but still
 *     builds lines and paragraphs; 'reading' (the default) rebuilds the order.
 *     furniture: 'drop' leaves out running headers, footers and page numbers.
 *     result = { pages: [{ number, width, height, blocks, columns, bodySize }],
 *                stats: { pages, words, lines, headings, columns: [per page] } }
 *     block  = { type: 'heading' | 'paragraph' | 'list-item', level (headings,
 *                1..3), lines: [string], text, size (pt), bold (every line),
 *                marker (list items), bullet (list items: true for a glyph or
 *                dash, false for 1. / a)), lineBreaks (true when the lines are
 *                kept apart, as in an address), rotated (true for text that
 *                was not in the page's main direction), furniture (true for a
 *                running header, footer or page number) }
 *   toText(result, { pageBreaks: true, pageBreak: 'marker' | 'formfeed' })
 *     -> string. Blocks are separated by a blank line; between pages a
 *     "--- Page N ---" line (the default) or a form feed.
 *   toDocx(result, { title, author, date, titleStyle }) -> Uint8Array
 *     A minimal OOXML document: Heading 1-3 styles for headings (so Word's
 *     navigation pane lists them), Normal for paragraphs, a bulleted List
 *     Paragraph for list items, a page break between PDF pages.
 *     titleStyle: true puts the first level-1 heading in the Title style.
 *
 * Reading order, in outline: items are put into the dominant text direction's
 * frame; items on one baseline that sit close together become runs; the page
 * is then cut recursively (an XY cut): first at very wide horizontal gaps
 * (and a header or footer cut off by a moderate one), then at vertical
 * gutters that run the full height of the block, then around the few rows
 * that cross an otherwise clear gutter (titles, full-width figures), then at
 * the widest horizontal gap when columns may lie below. Each leaf is one
 * column's worth of text; lines are rebuilt there, split into paragraphs,
 * and a paragraph that runs on from one column into the next is joined again.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.MVRTextLayout = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* ---------------- tunables (fractions of an em unless stated) ---------------- */
  var SPACE_EM = 0.17;        // an item gap wider than this is a word space
  var RUN_GAP_EM = 0.85;      // wider than this, two items are not one run
  var GUTTER_EM = 0.9;        // the narrowest column gutter
  var MIN_COL_EM = 3.5;       // the narrowest column
  var PARA_PITCH = 1.4;       // a baseline step above this x pitch ends a paragraph
  var INDENT_EM = 0.8;        // an indent change bigger than this matters
  var HEAD_RATIO = 1.15;      // a line this much larger than body text is a heading
  var ANGLE_TOL = 0.05;       // radians, about 3 degrees

  var BOLD_RE = /bold|black|heavy|semibold|demibold|demi\b|extrabold|ultrabold|[-,]bd\b|\bbd$|-b$/i;
  // A glyph bullet always starts a list item; dashes, asterisks and numbers only
  // where a list item could start (see weakOk).
  var STRONG_MARK = /^([\u2022\u2023\u2043\u2219\u25AA\u25AB\u25CF\u25CB\u25E6\u25A0\u25A1\u25C6\u25C7\u27A2\u2794\u2713\u2714\u00B7\uF0B7\uF0A7\uF076\uF0D8\uF0FC\uF0A8\uF06E\uF071])\s*/;
  var WEAK_MARK = /^([-\u2013\u2014*]|\(?(?:\d{1,3}|[A-Za-z]|[ivxlcdm]{1,6}|[IVXLCDM]{1,6})[.)])\s+/;
  var TERMINAL = /[.!?:;]["'\u201D\u2019)\]]*$/;
  var SENTENCE_END = /[.!?]["'\u201D\u2019)\]]*$/;
  var LOWER_START = /^["'\u2018\u201C(]*\p{Ll}/u;
  var HAS_LETTER = /\p{L}/u;
  // C0 controls (not tab or newline), lone surrogates and the two non-characters
  var BAD_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

  /* ---------------- small helpers ---------------- */
  function mul(m, n) {
    return [
      m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
    ];
  }
  function median(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }
  // the value carrying the most weight, values rounded to `step`
  function weightedMode(pairs, step) {
    var w = {}, best = null, bestW = -1;
    pairs.forEach(function (p) {
      var k = Math.round(p[0] / step) * step;
      w[k] = (w[k] || 0) + p[1];
      if (w[k] > bestW || (w[k] === bestW && k < best)) { bestW = w[k]; best = k; }
    });
    return best === null ? 0 : best;
  }
  function cleanStr(s) {
    return String(s).replace(BAD_CHARS, function (m) {
      // keep the character before a lone low surrogate
      return m.length === 2 && !/[\uDC00-\uDFFF]/.test(m[0]) ? m[0] : '';
    }).replace(/[\t\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
  }
  function wordCount(s) { var m = s.match(/\S+/g); return m ? m.length : 0; }
  function charWeight(s) { return s.replace(/\s+/g, '').length; }

  /* ---------------- items ---------------- */

  // Every non-empty item in device space (y down), with its angle and size.
  function readItems(page) {
    var H = +page.height || 0;
    var vt = page.transform && page.transform.length === 6 ? page.transform : [1, 0, 0, -1, 0, H];
    var styles = page.styles || {}, fonts = page.fonts || {};
    var out = [], items = page.items || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || typeof it.str !== 'string') continue;          // marked-content entries
      var str = cleanStr(it.str);
      if (!str.trim()) {
        if (it.hasEOL && out.length) out[out.length - 1].eol = true;
        continue;
      }
      var m = mul(vt, it.transform || [1, 0, 0, 1, 0, 0]);
      var adv = Math.hypot(m[0], m[1]);
      var size = Math.hypot(m[2], m[3]) || +it.height || adv || 1;
      var st = styles[it.fontName] || {};
      var fname = String(fonts[it.fontName] || st.name || '') + ' ' + String(st.fontFamily || '');
      var width = +it.width > 0 ? +it.width : str.length * 0.5 * size;
      out.push({
        str: str, seq: out.length, e: m[4], f: m[5], size: size, width: width,
        angle: Math.atan2(m[1], m[0]), flipped: (m[0] * m[3] - m[1] * m[2]) > 0,
        vertical: !!st.vertical, bold: BOLD_RE.test(fname),
        rtl: it.dir === 'rtl', eol: !!it.hasEOL
      });
    }
    return out;
  }

  function quantAngle(a) {
    var q = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
    return Math.abs(a - q) < ANGLE_TOL ? q : null;
  }

  // Put items into the frame of angle q: x along the text, y down the page.
  function toFrame(list, q) {
    var c = Math.cos(q), s = Math.sin(q);
    return list.map(function (it) {
      var x = it.e * c + it.f * s, y = -it.e * s + it.f * c;
      return {
        str: it.str, seq: it.seq, x0: x, x1: x + it.width, base: y, size: it.size,
        bold: it.bold, rtl: it.rtl, eol: it.eol,
        top: y - 0.8 * it.size, bottom: y + 0.25 * it.size
      };
    });
  }

  // Drop the second copy of an item drawn twice in the same place (fake bold, shadows).
  function dedupe(list) {
    var seen = {};
    return list.filter(function (it) {
      var k = it.str + '|' + Math.round(it.base / Math.max(1, it.size * 0.3));
      var arr = seen[k] || (seen[k] = []);
      for (var i = 0; i < arr.length; i++) if (Math.abs(arr[i] - it.x0) < 0.15 * it.size) return false;
      arr.push(it.x0);
      return true;
    });
  }

  /* ---------------- rows, runs and joining ---------------- */

  function sameRow(a, aSize, b, bSize) {
    var lo = Math.min(aSize, bSize), hi = Math.max(aSize, bSize);
    return Math.abs(a - b) <= 0.5 * lo + 0.15 * (hi - lo);
  }

  // Cluster things with .base/.size into rows; each row gets a dominant baseline.
  function clusterRows(things) {
    var s = things.slice().sort(function (a, b) { return a.base - b.base || a.x0 - b.x0; });
    var rows = [], cur = null;
    s.forEach(function (t) {
      if (cur && sameRow(t.base, t.size, cur.base0, cur.size0)) cur.members.push(t);
      else { cur = { base0: t.base, size0: t.size, members: [t] }; rows.push(cur); }
    });
    rows.forEach(function (r) {
      r.base = weightedMode(r.members.map(function (m) { return [m.base, charWeight(m.str || 'x') || 1]; }), 0.25);
      r.size = weightedMode(r.members.map(function (m) { return [m.size, charWeight(m.str || 'x') || 1]; }), 0.5);
    });
    return rows;
  }

  function joinItems(items) {
    var out = '', prev = null;
    var rtl = 0, all = 0;
    items.forEach(function (it) { var w = charWeight(it.str); all += w; if (it.rtl) rtl += w; });
    var list = items.slice().sort(function (a, b) { return a.x0 - b.x0; });
    if (all && rtl / all > 0.5) list.reverse();
    list.forEach(function (it) {
      var s = it.str;
      if (prev) {
        var gap = rtl / all > 0.5 ? prev.x0 - it.x1 : it.x0 - prev.x1;
        var em = Math.max(prev.size, it.size);
        if (gap > SPACE_EM * em && !/\s$/.test(out) && !/^\s/.test(s)) out += ' ';
      }
      out += s;
      prev = it;
    });
    return out.replace(/\s+/g, ' ').trim();
  }

  // Split a row's items into runs at gaps too wide for a word space.
  function rowRuns(row) {
    var its = row.members.slice().sort(function (a, b) { return a.x0 - b.x0; });
    var runs = [], cur = null;
    its.forEach(function (it) {
      if (cur && it.x0 - cur.x1 <= RUN_GAP_EM * Math.max(it.size, cur.size)) {
        cur.items.push(it); cur.x1 = Math.max(cur.x1, it.x1); cur.size = Math.max(cur.size, it.size);
        cur.top = Math.min(cur.top, it.top); cur.bottom = Math.max(cur.bottom, it.bottom);
      } else {
        cur = { items: [it], x0: it.x0, x1: it.x1, size: it.size, top: it.top, bottom: it.bottom, row: row };
        runs.push(cur);
      }
    });
    return runs;
  }

  /* ---------------- page metrics ---------------- */

  function bodySizeOf(items) {
    return weightedMode(items.map(function (it) { return [it.size, charWeight(it.str)]; }), 0.5) || 10;
  }

  // The usual baseline step between a line and the next line below it in the
  // same column (found by horizontal overlap, so columns that do not share
  // baselines still give the right answer).
  function pitchOf(runs, body) {
    var s = runs.slice().sort(function (a, b) { return a.row.base - b.row.base; });
    var diffs = [];
    for (var i = 0; i < s.length; i++) {
      var a = s[i];
      if (Math.abs(a.size - body) > 0.15 * body) continue;
      for (var j = i + 1; j < s.length; j++) {
        var b = s[j], d = b.row.base - a.row.base;
        if (d <= 0.3 * a.size) continue;
        if (d > 3 * a.size) break;
        var ov = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        if (ov > 0.5 * Math.min(a.x1 - a.x0, b.x1 - b.x0) && Math.abs(b.size - body) <= 0.15 * body) { diffs.push(d); break; }
      }
    }
    return diffs.length ? median(diffs) : 1.2 * body;
  }

  /* ---------------- the XY cut ---------------- */

  function blockRows(runs) {
    var map = new Map();
    runs.forEach(function (r) {
      var e = map.get(r.row);
      if (!e) { e = { row: r.row, runs: [], top: Infinity, bottom: -Infinity, x0: Infinity, x1: -Infinity }; map.set(r.row, e); }
      e.runs.push(r);
      e.top = Math.min(e.top, r.top); e.bottom = Math.max(e.bottom, r.bottom);
      e.x0 = Math.min(e.x0, r.x0); e.x1 = Math.max(e.x1, r.x1);
    });
    var rows = Array.from(map.values());
    rows.sort(function (a, b) { return a.row.base - b.row.base; });
    return rows;
  }

  // Horizontal whitespace between consecutive rows: [{ at, gap }], at = index of first row below.
  function yGaps(rows) {
    var out = [], maxBottom = -Infinity;
    for (var i = 0; i < rows.length; i++) {
      if (i > 0) {
        var g = rows[i].top - maxBottom;
        if (g > 0) out.push({ at: i, gap: g });
      }
      maxBottom = Math.max(maxBottom, rows[i].bottom);
    }
    return out;
  }

  function cutBlock(rows, ctx, P, depth, leaves) {
    if (!rows.length) return;
    if (rows.length === 1 || depth > 60) { leaves.push({ rows: rows, col: ctx }); return; }
    var body = P.body, pitch = P.pitch;
    var x0 = Infinity, x1 = -Infinity;
    rows.forEach(function (r) { x0 = Math.min(x0, r.x0); x1 = Math.max(x1, r.x1); });

    // A: a very wide horizontal gap, or a header/footer set off by a moderate one
    var gaps = yGaps(rows), best = null;
    gaps.forEach(function (g) {
      var ok = g.gap >= 2.5 * pitch;
      if (!ok && g.gap >= 1.4 * pitch) {
        var k, edge;
        if (g.at <= 3) {                                   // at most three rows above, all in the top band
          for (k = 0, edge = -Infinity; k < g.at; k++) edge = Math.max(edge, rows[k].bottom);
          if (edge <= P.frameTop + 0.12 * P.frameH) ok = true;
        }
        if (rows.length - g.at <= 3) {                     // at most three rows below, all in the bottom band
          for (k = g.at, edge = Infinity; k < rows.length; k++) edge = Math.min(edge, rows[k].top);
          if (edge >= P.frameTop + 0.88 * P.frameH) ok = true;
        }
      }
      if (ok && (!best || g.gap > best.gap)) best = g;
    });
    if (best) {
      cutBlock(rows.slice(0, best.at), ctx, P, depth + 1, leaves);
      cutBlock(rows.slice(best.at), ctx, P, depth + 1, leaves);
      return;
    }

    // B: gutters that run the full height of the block
    var parts = xCut(rows, x0, x1, body);
    if (parts) {
      var counted = parts.filter(function (p) { return p.rows.length >= 2; }).length;
      if (counted >= 2) P.columns = Math.max(P.columns, parts.length);
      parts.forEach(function (p) { cutBlock(p.rows, { x0: p.x0, x1: p.x1 }, P, depth + 1, leaves); });
      return;
    }

    // C: a gutter crossed by only a few rows (titles, full-width figures): cut around them
    var near = nearGutter(rows, x0, x1, body, 0.25);
    if (near && near.crossing.size > 0) {
      var bands = [], cur = null;
      rows.forEach(function (r) {
        var c = near.crossing.has(r);
        if (!cur || cur.c !== c) { cur = { c: c, rows: [] }; bands.push(cur); }
        cur.rows.push(r);
      });
      if (bands.length > 1) {
        bands.forEach(function (b) { cutBlock(b.rows, ctx, P, depth + 1, leaves); });
        return;
      }
    }

    // D: columns may start further down: cut at the widest horizontal gap
    if (nearGutter(rows, x0, x1, body, 0.6)) {
      var wide = null;
      gaps.forEach(function (g) { if (g.gap > 0.6 * body && (!wide || g.gap > wide.gap)) wide = g; });
      if (wide) {
        cutBlock(rows.slice(0, wide.at), ctx, P, depth + 1, leaves);
        cutBlock(rows.slice(wide.at), ctx, P, depth + 1, leaves);
        return;
      }
    }
    leaves.push({ rows: rows, col: ctx });
  }

  // Split rows at vertical gaps that no run crosses; null when that would not be columns.
  function xCut(rows, x0, x1, body) {
    var iv = [];
    rows.forEach(function (r) { r.runs.forEach(function (u) { iv.push([u.x0, u.x1]); }); });
    iv.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    iv.forEach(function (v) {
      var m = merged[merged.length - 1];
      if (m && v[0] <= m[1]) m[1] = Math.max(m[1], v[1]);
      else merged.push([v[0], v[1]]);
    });
    var minGap = rows.length < 3 ? 2 * body : Math.max(GUTTER_EM * body, 4);
    var cuts = [];
    for (var i = 1; i < merged.length; i++) {
      if (merged[i][0] - merged[i - 1][1] >= minGap) cuts.push((merged[i][0] + merged[i - 1][1]) / 2);
    }
    if (!cuts.length) return null;
    var bounds = [-Infinity].concat(cuts, [Infinity]);
    var parts = [];
    for (var k = 0; k < bounds.length - 1; k++) parts.push({ lo: bounds[k], hi: bounds[k + 1], rows: [] });
    // assign each row's runs to parts (a row may sit in several)
    rows.forEach(function (r) {
      parts.forEach(function (p) {
        var rs = r.runs.filter(function (u) { var c = (u.x0 + u.x1) / 2; return c > p.lo && c < p.hi; });
        if (rs.length) p.rows.push(subRow(r, rs));
      });
    });
    parts = parts.filter(function (p) { return p.rows.length; });
    parts.forEach(measurePart);
    // merge neighbours that are not real columns
    var changed = true;
    while (changed && parts.length > 1) {
      changed = false;
      for (var j = 0; j < parts.length - 1; j++) {
        var a = parts[j], b = parts[j + 1];
        var ov = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        var minH = Math.min(a.bottom - a.top, b.bottom - b.top);
        if (a.x1 - a.x0 < MIN_COL_EM * body || b.x1 - b.x0 < MIN_COL_EM * body || ov < 0.5 * minH) {
          parts.splice(j, 2, mergeParts(a, b));
          changed = true;
          break;
        }
      }
    }
    if (parts.length < 2) return null;
    // Columns of running text are mostly full lines; a table, or code with its
    // comments lined up on the right, is not, and is better read row by row.
    for (var q = 0; q < parts.length; q++) {
      var pt = parts[q], pw = pt.x1 - pt.x0;
      if (pt.rows.length < 4) continue;
      var full = pt.rows.filter(function (r) { return r.x1 >= pt.x0 + 0.8 * pw; }).length;
      if (full < 0.4 * pt.rows.length) return null;
    }
    return parts;
  }

  function subRow(r, runs) {
    var e = { row: r.row, runs: runs, top: Infinity, bottom: -Infinity, x0: Infinity, x1: -Infinity };
    runs.forEach(function (u) {
      e.top = Math.min(e.top, u.top); e.bottom = Math.max(e.bottom, u.bottom);
      e.x0 = Math.min(e.x0, u.x0); e.x1 = Math.max(e.x1, u.x1);
    });
    return e;
  }
  function measurePart(p) {
    p.x0 = Infinity; p.x1 = -Infinity; p.top = Infinity; p.bottom = -Infinity;
    p.rows.forEach(function (r) {
      p.x0 = Math.min(p.x0, r.x0); p.x1 = Math.max(p.x1, r.x1);
      p.top = Math.min(p.top, r.top); p.bottom = Math.max(p.bottom, r.bottom);
    });
  }
  function mergeParts(a, b) {
    var map = new Map();
    a.rows.concat(b.rows).forEach(function (r) {
      var e = map.get(r.row);
      if (e) map.set(r.row, subRow(e, e.runs.concat(r.runs)));
      else map.set(r.row, r);
    });
    var rows = Array.from(map.values()).sort(function (x, y) { return x.row.base - y.row.base; });
    var p = { lo: a.lo, hi: b.hi, rows: rows };
    measurePart(p);
    return p;
  }

  // An x band at least a gutter wide that at most `frac` of the rows cross,
  // with text on both sides of it; returns { crossing: Set } or null.
  function nearGutter(rows, x0, x1, body, frac) {
    var n = rows.length;
    if (n < 4) return null;
    var lo = Math.floor(x0), W = Math.ceil(x1) - lo + 1;
    if (W < 3 || W > 20000) return null;
    var cnt = new Int32Array(W);
    var closeGap = 0.5 * body;
    rows.forEach(function (r) {
      var iv = r.runs.map(function (u) { return [u.x0, u.x1]; }).sort(function (a, b) { return a[0] - b[0]; });
      var m = [];
      iv.forEach(function (v) {
        var t = m[m.length - 1];
        if (t && v[0] - t[1] < closeGap) t[1] = Math.max(t[1], v[1]); else m.push([v[0], v[1]]);
      });
      m.forEach(function (v) {
        for (var x = Math.max(0, Math.floor(v[0]) - lo); x <= Math.min(W - 1, Math.ceil(v[1]) - lo); x++) cnt[x]++;
      });
    });
    var maxCross = Math.max(1, Math.floor(frac * n));
    var minW = Math.max(GUTTER_EM * body, 4);
    var best = null;
    var start = -1;
    for (var x = 0; x <= W; x++) {
      var low = x < W && cnt[x] <= maxCross;
      if (low && start < 0) start = x;
      if (!low && start >= 0) {
        var g0 = start + lo, g1 = x - 1 + lo;
        if (start > 0 && x < W && g1 - g0 >= minW) {
          var crossing = new Set(), left = 0, right = 0;
          rows.forEach(function (r) {
            var cross = r.runs.some(function (u) { return u.x0 < g1 - 0.5 && u.x1 > g0 + 0.5; });
            if (cross) crossing.add(r);
            else {
              if (r.runs.some(function (u) { return u.x1 <= g0 + 0.5; })) left++;
              if (r.runs.some(function (u) { return u.x0 >= g1 - 0.5; })) right++;
            }
          });
          if (left >= 2 && right >= 2 && crossing.size <= maxCross &&
              (!best || crossing.size < best.crossing.size)) best = { g0: g0, g1: g1, crossing: crossing };
        }
        start = -1;
      }
    }
    return best;
  }

  /* ---------------- lines and paragraphs ---------------- */

  function makeLine(items) {
    var x0 = Infinity, x1 = -Infinity, all = 0, boldW = 0;
    items.forEach(function (it) {
      x0 = Math.min(x0, it.x0); x1 = Math.max(x1, it.x1);
      var w = charWeight(it.str); all += w; if (it.bold) boldW += w;
    });
    var base = weightedMode(items.map(function (m) { return [m.base, charWeight(m.str) || 1]; }), 0.25);
    var size = weightedMode(items.map(function (m) { return [m.size, charWeight(m.str) || 1]; }), 0.5);
    var text = joinItems(items);
    var line = { items: items, x0: x0, x1: x1, base: base, size: size, bold: all > 0 && boldW === all, text: text };
    var mk = STRONG_MARK.exec(text) || WEAK_MARK.exec(text);
    line.mark = mk ? { marker: mk[1], strong: STRONG_MARK.test(text), rest: text.slice(mk[0].length) } : null;
    if (line.mark && !line.mark.rest) line.mark = null;           // a bare "1." is not a list item
    if (line.mark) {
      var sorted = items.slice().sort(function (a, b) { return a.x0 - b.x0; });
      if (sorted.length > 1 && sorted[0].str.trim() === line.mark.marker) line.textX = sorted[1].x0;
      else line.textX = x0 + (x1 - x0) * (mk[0].length / Math.max(1, text.length));
    }
    // a numbered heading's text start ("8.3  Spot colours"): a wrapped second line hangs there
    var num = /^((?:\d+\.)*\d+\.?|[A-Z]\.|[IVXLC]+\.)\s+\S/.exec(text);
    if (num && !line.mark) {
      var srt = items.slice().sort(function (a, b) { return a.x0 - b.x0; });
      if (srt.length > 1 && srt[0].str.trim() === num[1]) line.hangX = srt[1].x0;
      else line.hangX = x0 + (x1 - x0) * ((num[0].length - 1) / Math.max(1, text.length));
    }
    return line;
  }

  // Lines of a leaf, in reading order: rows rebuilt from its runs.
  function leafLines(leaf) {
    var items = [];
    leaf.rows.forEach(function (r) { r.runs.forEach(function (u) { items.push.apply(items, u.items); }); });
    return clusterRows(items).map(function (row) { return makeLine(row.members); });
  }

  function isCentred(a, b, col) {
    var cw = col.x1 - col.x0;
    var ca = (a.x0 + a.x1) / 2, cb = (b.x0 + b.x1) / 2, cc = (col.x0 + col.x1) / 2;
    var em = Math.max(a.size, b.size);
    return Math.abs(ca - cb) < em && Math.abs(ca - cc) < 2 * em &&
      (a.x0 - col.x0) > 1.5 * em && (b.x0 - col.x0) > 1.5 * em && (a.x1 - a.x0) < 0.9 * cw;
  }

  function weakOk(prevLine, para) {
    if (!prevLine) return true;
    if (para && para.list) return true;
    return TERMINAL.test(prevLine.text) || /[:,]$/.test(prevLine.text);
  }

  // Paragraphs (raw: arrays of lines with flags) of one leaf.
  function paragraphs(lines, col, body) {
    if (!lines.length) return [];
    var diffs = [];
    for (var i = 1; i < lines.length; i++) {
      var d = lines[i].base - lines[i - 1].base;
      if (d > 0.3 * lines[i].size && Math.abs(lines[i].size - lines[i - 1].size) <= 0.12 * lines[i].size &&
          Math.abs(lines[i].size - body) <= 0.15 * body) diffs.push(d);
    }
    var pitch = diffs.length ? median(diffs) : 1.2 * body;
    // a leaf with only paragraph gaps (one-line paragraphs) would make the pitch too wide
    pitch = Math.min(pitch, 1.35 * body);
    pitch = Math.max(pitch, 0.95 * body);
    var cw = Math.max(1, col.x1 - col.x0);
    var out = [], P = null;
    lines.forEach(function (L2, idx) {
      var L1 = idx ? lines[idx - 1] : null;
      var brk = !P;
      if (P) {
        var d = L2.base - L1.base;
        var scale = Math.max(L1.size, L2.size) / body;
        var em = Math.max(L1.size, L2.size);
        var centred = isCentred(L1, L2, col);
        if (d <= 0.3 * Math.min(L1.size, L2.size) || d > PARA_PITCH * pitch * Math.max(1, scale)) brk = true;
        else if (Math.abs(L1.size - L2.size) > 0.12 * Math.max(L1.size, L2.size)) brk = true;
        else if (L1.bold !== L2.bold) brk = true;
        else if (L2.mark && (L2.mark.strong || weakOk(L1, P))) brk = true;
        else if (!centred) {
          var dx = L2.x0 - L1.x0;
          if (P.list) {
            if (L2.x0 < P.textX - 0.5 * body) brk = true;
          } else if (Math.abs(L1.x1 - L2.x1) < 0.5 * em && L1.x0 - col.x0 > 1.5 * em && L2.x0 - col.x0 > 1.5 * em) {
            brk = false;                                   // right-aligned lines (an address)
          } else if (dx > INDENT_EM * em) {
            // a first-line indent starts a paragraph, unless the line hangs under a numbered heading's text
            brk = !(P.lines.length === 1 && L1.hangX !== undefined && Math.abs(L2.x0 - L1.hangX) < 0.5 * em);
          } else if (dx < -INDENT_EM * em) {
            brk = !(P.lines.length === 1);
          }
          if (!brk && lines.length >= 3 && L1.x1 < col.x0 + 0.7 * cw && SENTENCE_END.test(L1.text)) brk = true;
        }
      }
      if (brk) {
        P = { lines: [L2], list: !!(L2.mark && (L2.mark.strong || weakOk(L1, null))), col: col };
        if (P.list) { P.mark = L2.mark; P.textX = L2.textX; }
        out.push(P);
      } else P.lines.push(L2);
    });
    // lines kept apart: every line short (an address, a verse)
    out.forEach(function (p) {
      p.lineBreaks = !p.list && p.lines.length >= 2 && cw > 0 &&
        p.lines.every(function (l) { return (l.x1 - l.x0) < 0.6 * cw && !/[-\u00AD\u2010]$/.test(l.text); });
    });
    return out;
  }

  // Join lines of a paragraph into running text, mending hyphenated line ends.
  function joinLines(texts) {
    var out = '';
    texts.forEach(function (t, i) {
      if (!t) return;
      if (!i || !out) { out += t; return; }
      if (/\u00AD$/.test(out)) { out = out.slice(0, -1) + t; return; }
      if (/\p{L}[-\u2010]$/u.test(out)) {
        if (LOWER_START.test(t)) out = out.slice(0, -1) + t;
        else out += t;                                   // Anglo-\nSaxon -> Anglo-Saxon
        return;
      }
      out += ' ' + t;
    });
    return out;
  }

  /* ---------------- per page ---------------- */

  function layoutPage(page, order, number, docBody) {
    var raw = readItems(page);
    // the dominant direction, by characters
    var byAngle = {};
    raw.forEach(function (it) {
      if (it.vertical || it.flipped) return;
      var q = quantAngle(it.angle);
      if (q === null) return;
      byAngle[q] = (byAngle[q] || 0) + charWeight(it.str);
    });
    var dom = 0, domW = -1;
    Object.keys(byAngle).forEach(function (k) {
      var w = byAngle[k];
      if (w > domW || (w === domW && Math.abs(+k) < Math.abs(dom))) { domW = w; dom = +k; }
    });
    var main = [], others = [];
    raw.forEach(function (it) {
      var d = Math.atan2(Math.sin(it.angle - dom), Math.cos(it.angle - dom));
      if (!it.vertical && !it.flipped && Math.abs(d) < ANGLE_TOL) main.push(it); else others.push(it);
    });

    var items = dedupe(toFrame(main, dom));
    var body = bodySizeOf(items);
    // the page in this frame
    var W = +page.width || 0, H = +page.height || 0;
    var corners = toFrame([{ e: 0, f: 0, width: 0 }, { e: W, f: 0, width: 0 }, { e: 0, f: H, width: 0 }, { e: W, f: H, width: 0 }]
      .map(function (c) { return { str: '', e: c.e, f: c.f, width: 0, size: 0 }; }), dom);
    var fTop = Math.min.apply(null, corners.map(function (c) { return c.base; }));
    var fBot = Math.max.apply(null, corners.map(function (c) { return c.base; }));

    var rows = clusterRows(items);
    var runs = [];
    rows.forEach(function (r) { runs.push.apply(runs, rowRuns(r)); });
    var P = { body: body, pitch: pitchOf(runs, body), columns: items.length ? 1 : 0, frameTop: fTop, frameH: Math.max(1, fBot - fTop) };
    var tx0 = Infinity, tx1 = -Infinity;
    runs.forEach(function (u) { tx0 = Math.min(tx0, u.x0); tx1 = Math.max(tx1, u.x1); });
    var pageCol = { x0: tx0, x1: tx1 };

    var leaves = [];
    if (runs.length) cutBlock(blockRows(runs), pageCol, P, 0, leaves);   // also fills P.columns

    var leafParas = [];
    if (order === 'stream') {
      leafParas = streamParagraphs(items, pageCol, body);
    } else {
      leaves.forEach(function (lf) { leafParas.push(paragraphs(leafLines(lf), lf.col, body)); });
    }
    var paras = joinAcrossLeaves(leafParas, body, [fTop + 0.1 * P.frameH, fBot - 0.1 * P.frameH]);

    // text that is not in the main direction: its own frames, at the end of the page
    var groups = {};
    others.forEach(function (it) {
      var k = it.vertical ? 'v' : String(Math.round(it.angle * 180 / Math.PI));
      (groups[k] || (groups[k] = [])).push(it);
    });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      var ang = k === 'v' ? 0 : +k * Math.PI / 180;
      var fr = dedupe(toFrame(g, ang));
      if (k === 'v') fr = g.map(function (it) {   // vertical writing: one column per item, top to bottom
        return { str: it.str, seq: it.seq, x0: -it.e, x1: -it.e + it.size, base: it.f, size: it.size, bold: it.bold, top: it.f, bottom: it.f + it.width };
      });
      var gl = clusterRows(fr).map(function (r) { return makeLine(r.members); });
      var gx0 = Infinity, gx1 = -Infinity;
      gl.forEach(function (l) { gx0 = Math.min(gx0, l.x0); gx1 = Math.max(gx1, l.x1); });
      paragraphs(gl, { x0: gx0, x1: gx1 }, bodySizeOf(fr)).forEach(function (p) { p.rotated = true; paras.push(p); });
    });

    // headings are judged against the larger of this page's and the document's body
    // size, so a diagram page set in tiny labels does not turn its running header
    // into a heading
    var hBody = Math.max(body, docBody || 0);
    var blocks = paras.map(function (p) { return toBlock(p, hBody); });
    // blocks wholly inside the top or bottom tenth of the page: candidates for
    // running headers, footers and page numbers (decided across pages later)
    var zTop = fTop + 0.1 * P.frameH, zBot = fBot - 0.1 * P.frameH;
    paras.forEach(function (p, i) {
      if (p.rotated) return;
      var top = Infinity, bottom = -Infinity;
      p.lines.forEach(function (l) { top = Math.min(top, l.base - 0.8 * l.size); bottom = Math.max(bottom, l.base + 0.25 * l.size); });
      if (bottom <= zTop) blocks[i]._edge = 'top';
      else if (top >= zBot) blocks[i]._edge = 'bottom';
    });
    return { number: number, width: W, height: H, blocks: blocks, columns: P.columns, bodySize: body };
  }

  // Stream order: lines in content-stream order; a step back up the page starts a new leaf.
  function streamParagraphs(items, col, body) {
    var lines = [], cur = null, prev = null;
    items.slice().sort(function (a, b) { return a.seq - b.seq; }).forEach(function (it) {
      var newLine = !cur || prev.eol || !sameRow(it.base, it.size, cur.base, cur.size) ||
        it.x0 < prev.x1 - 0.5 * it.size || it.x0 - prev.x1 > RUN_GAP_EM * Math.max(it.size, prev.size);
      if (newLine) { cur = { base: it.base, size: it.size, items: [] }; lines.push(cur); }
      cur.items.push(it);
      prev = it;
    });
    var built = lines.map(function (l) { return makeLine(l.items); });
    var segs = [], seg = null;
    built.forEach(function (l, i) {
      if (!seg || l.base < built[i - 1].base - 0.3 * l.size) { seg = []; segs.push(seg); }
      seg.push(l);
    });
    return segs.map(function (s) { return paragraphs(s, col, body); });
  }

  // A paragraph cut by a column (or stream segment) break is one paragraph again.
  // Not when the first piece lies wholly in the top or bottom tenth of the page
  // (zones: [zTop, zBot]) and the second does not: a running header is not the
  // start of a sentence that a page beginning in lower case finishes.
  function joinAcrossLeaves(leafParas, body, zones) {
    var out = [];
    var band = function (p) {
      if (!zones) return 'body';
      var top = Infinity, bottom = -Infinity;
      p.lines.forEach(function (l) { top = Math.min(top, l.base - 0.8 * l.size); bottom = Math.max(bottom, l.base + 0.25 * l.size); });
      return bottom <= zones[0] ? 'top' : top >= zones[1] ? 'bottom' : 'body';
    };
    leafParas.forEach(function (ps) {
      ps.forEach(function (p, i) {
        var last = out[out.length - 1];
        if (i === 0 && last && !last.lineBreaks && !p.list && !p.lineBreaks && (band(last) === 'body' || band(last) === band(p))) {
          var lt = last.lines[last.lines.length - 1].text, nt = p.lines[0].text;
          var ls = last.lines[last.lines.length - 1].size, ns = p.lines[0].size;
          var lb = last.lines[last.lines.length - 1].bold, nb = p.lines[0].bold;
          if (!SENTENCE_END.test(lt) && !/[:;]$/.test(lt) && LOWER_START.test(nt) &&
              Math.abs(ls - ns) <= 0.12 * Math.max(ls, ns) && lb === nb) {
            last.lines = last.lines.concat(p.lines);
            return;
          }
        }
        out.push(p);
      });
    });
    return out;
  }

  function toBlock(p, body) {
    var lines = p.lines.map(function (l) { return l.text; });
    var size = 0, chars = 0, boldAll = true;
    p.lines.forEach(function (l) { size = Math.max(size, l.size); chars += l.text.length; if (!l.bold) boldAll = false; });
    var text = p.lineBreaks ? lines.join('\n') : joinLines(lines);
    var b = { type: 'paragraph', lines: lines, text: text, size: Math.round(size * 2) / 2, bold: boldAll };
    if (p.list) {
      b.type = 'list-item';
      b.marker = p.mark.marker;
      b.bullet = !!p.mark.strong || /^[-\u2013\u2014*]$/.test(p.mark.marker);
    } else if (HAS_LETTER.test(text) && !p.rotated) {
      if (size >= HEAD_RATIO * body && p.lines.length <= 3 && text.length <= 200) {
        b.type = 'heading'; b._size = size;
      } else if (boldAll && p.lines.length === 1 && text.length <= 80 && Math.abs(size - body) <= 0.15 * body &&
                 !/[.,;]$/.test(text)) {
        b.type = 'heading'; b._bodyBold = true;
      }
    }
    if (p.lineBreaks && b.type === 'paragraph') b.lineBreaks = true;
    if (p.rotated) b.rotated = true;
    return b;
  }

  // Heading levels by size across the document. Sizes within 1pt are one
  // cluster; the three clusters used by the most headings are ranked by size
  // (so a one-off large label in a figure does not push the real section
  // headings down a level); anything larger than the top rank is level 1, any
  // other size takes the level of the nearest ranked size; bold body-size
  // headings come after every ranked size.
  function assignLevels(pages) {
    var sizes = [];
    pages.forEach(function (pg) { pg.blocks.forEach(function (b) { if (b._size) sizes.push(b._size); }); });
    sizes.sort(function (a, b) { return b - a; });
    var clusters = [];
    sizes.forEach(function (s) {
      var c = clusters[clusters.length - 1];
      if (c && c.lo - s <= 1) { c.lo = s; c.n++; } else clusters.push({ hi: s, lo: s, n: 1 });
    });
    var ranked = clusters.slice().sort(function (a, b) { return b.n - a.n || b.hi - a.hi; }).slice(0, 3)
      .sort(function (a, b) { return b.hi - a.hi; });
    function levelOf(size) {
      if (!ranked.length || size > ranked[0].hi) return 1;
      var best = 0, bestD = Infinity;
      ranked.forEach(function (c, i) {
        var d = size >= c.lo && size <= c.hi ? 0 : Math.min(Math.abs(size - c.lo), Math.abs(size - c.hi));
        if (d < bestD) { bestD = d; best = i; }
      });
      return best + 1;
    }
    pages.forEach(function (pg) {
      pg.blocks.forEach(function (b) {
        if (b.type !== 'heading') return;
        b.level = Math.min(3, b._bodyBold ? ranked.length + 1 : levelOf(b._size));
        delete b._size; delete b._bodyBold;
      });
    });
  }

  // Page furniture: a block in the top or bottom tenth of the page that is a
  // page number ("7", "Page 7", "7 of 12", "- 7 -") or whose text, digits
  // aside, recurs at the same edge on at least half the pages (two at least).
  // It is marked furniture: true, is never a heading, and with
  // { furniture: 'drop' } is left out altogether.
  var PAGE_NO = /^[-\u2013\u2014\s]*(?:page\s*)?(?:#|[ivxlc]+)(?:\s*(?:of|\/)\s*#)?[-\u2013\u2014\s]*$/i;
  function markFurniture(pages, drop) {
    var key = function (b) { return b._edge + '|' + b.text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim(); };
    var seen = {};
    pages.forEach(function (pg) {
      var once = {};
      pg.blocks.forEach(function (b) { if (b._edge && !once[key(b)]) { once[key(b)] = 1; seen[key(b)] = (seen[key(b)] || 0) + 1; } });
    });
    var need = Math.max(2, Math.ceil(pages.length / 2));
    pages.forEach(function (pg) {
      pg.blocks.forEach(function (b) {
        if (b._edge) {
          var t = b.text.toLowerCase().replace(/\d+/g, '#');
          if (PAGE_NO.test(t) || seen[key(b)] >= need) {
            b.furniture = true;
            if (b.type === 'heading') { b.type = 'paragraph'; delete b._size; delete b._bodyBold; }
          }
        }
        delete b._edge;
      });
      if (drop) pg.blocks = pg.blocks.filter(function (b) { return !b.furniture; });
    });
  }

  /* ---------------- public: layout ---------------- */

  function layout(input, opts) {
    var order = opts && opts.order === 'stream' ? 'stream' : 'reading';
    var src = (input && input.pages) || [];
    var sizes = [];
    src.forEach(function (pg) {
      ((pg && pg.items) || []).forEach(function (it) {
        if (it && typeof it.str === 'string' && it.transform) sizes.push([Math.hypot(it.transform[2], it.transform[3]) || +it.height || 0, charWeight(it.str)]);
      });
    });
    var docBody = weightedMode(sizes, 0.5);
    var pages = src.map(function (pg, i) { return layoutPage(pg || {}, order, i + 1, docBody); });
    markFurniture(pages, opts && opts.furniture === 'drop');
    assignLevels(pages);
    var stats = { pages: pages.length, words: 0, lines: 0, headings: 0, columns: [] };
    pages.forEach(function (pg) {
      stats.columns.push(pg.columns);
      pg.blocks.forEach(function (b) {
        stats.words += wordCount(b.text);
        stats.lines += b.lines.length;
        if (b.type === 'heading') stats.headings++;
      });
    });
    return { pages: pages, stats: stats };
  }

  /* ---------------- public: text ---------------- */

  function toText(result, opts) {
    opts = opts || {};
    var breaks = opts.pageBreaks !== false;
    var ff = opts.pageBreak === 'formfeed';
    var parts = [];
    (result.pages || []).forEach(function (pg, i) {
      var body = (pg.blocks || []).map(function (b) { return b.text; }).filter(Boolean).join('\n\n');
      if (i > 0) {
        if (breaks) parts.push(ff ? '\f' : '\n\n--- Page ' + (pg.number || i + 1) + ' ---\n\n');
        else parts.push('\n\n');
      }
      parts.push(body);
    });
    var s = parts.join('');
    if (ff) s = s.replace(/\n*\f\n*/g, '\n\f');
    return s.replace(/^\n+/, '') + '\n';
  }

  /* ---------------- public: docx ---------------- */

  function xmlEsc(s) {
    return cleanStr(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  var R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  function runXml(lines) {
    var parts = lines.map(function (t) { return '<w:t xml:space="preserve">' + xmlEsc(t) + '</w:t>'; });
    return '<w:r>' + parts.join('<w:br/>') + '</w:r>';
  }

  function documentXml(result, opts) {
    var body = [];
    var usedTitle = false;
    var pages = result.pages || [];
    pages.forEach(function (pg, i) {
      if (i > 0) body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      (pg.blocks || []).forEach(function (b) {
        var ppr = '', text = b.lineBreaks ? b.lines : [b.text];
        if (b.type === 'heading') {
          var st = 'Heading' + Math.min(3, Math.max(1, b.level || 1));
          if (opts.titleStyle && !usedTitle && b.level === 1) { st = 'Title'; usedTitle = true; }
          ppr = '<w:pPr><w:pStyle w:val="' + st + '"/></w:pPr>';
        } else if (b.type === 'list-item') {
          if (b.bullet) {
            var t = b.text.replace(STRONG_MARK, '').replace(/^[-\u2013\u2014*]\s+/, '');
            text = [t];
            ppr = '<w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>';
          } else ppr = '<w:pPr><w:pStyle w:val="ListParagraph"/></w:pPr>';
        }
        body.push('<w:p>' + ppr + runXml(text) + '</w:p>');
      });
    });
    var first = pages[0] && pages[0].width ? pages[0] : null;
    var pw = Math.round(((opts.pageWidth || (first && first.width)) || 595.28) * 20);
    var ph = Math.round(((opts.pageHeight || (first && first.height)) || 841.89) * 20);
    var sect = '<w:sectPr><w:pgSz w:w="' + pw + '" w:h="' + ph + '"' + (pw > ph ? ' w:orient="landscape"' : '') + '/>' +
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';
    return XML_HEAD + '<w:document xmlns:w="' + W_NS + '" xmlns:r="' + R_NS + '"><w:body>' +
      body.join('') + sect + '</w:body></w:document>';
  }

  function stylesXml() {
    function head(id, name, lvl, sz, before) {
      return '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/>' +
        '<w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/>' +
        '<w:spacing w:before="' + before + '" w:after="120"/><w:outlineLvl w:val="' + lvl + '"/></w:pPr>' +
        '<w:rPr><w:b/><w:bCs/><w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/></w:rPr></w:style>';
    }
    return XML_HEAD + '<w:styles xmlns:w="' + W_NS + '">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>' +
      '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/>' +
      '<w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>' +
      '<w:uiPriority w:val="10"/><w:qFormat/><w:pPr><w:spacing w:after="240"/><w:contextualSpacing/></w:pPr>' +
      '<w:rPr><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr></w:style>' +
      head('Heading1', 'heading 1', 0, 36, 360) + head('Heading2', 'heading 2', 1, 30, 240) + head('Heading3', 'heading 3', 2, 26, 200) +
      '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/>' +
      '<w:uiPriority w:val="34"/><w:qFormat/><w:pPr><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>' +
      '</w:styles>';
  }

  function numberingXml() {
    return XML_HEAD + '<w:numbering xmlns:w="' + W_NS + '">' +
      '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/>' +
      '<w:numFmt w:val="bullet"/><w:lvlText w:val="\u2022"/><w:lvlJc w:val="left"/>' +
      '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
      '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';
  }

  function isoDate(d) { return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); }

  function toDocx(result, opts) {
    opts = opts || {};
    var date = opts.date instanceof Date && !isNaN(opts.date) ? opts.date : new Date();
    var title = opts.title ? String(opts.title) : '';
    var author = opts.author ? String(opts.author) : '';
    var npages = (result.pages || []).length;
    var CT = 'application/vnd.openxmlformats-';
    var parts = [
      ['[Content_Types].xml', XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="' + CT + 'package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="' + CT + 'officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="' + CT + 'officedocument.wordprocessingml.styles+xml"/>' +
        '<Override PartName="/word/numbering.xml" ContentType="' + CT + 'officedocument.wordprocessingml.numbering+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="' + CT + 'package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="' + CT + 'officedocument.extended-properties+xml"/>' +
        '</Types>'],
      ['_rels/.rels', XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="' + R_NS + '/officeDocument" Target="word/document.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '<Relationship Id="rId3" Type="' + R_NS + '/extended-properties" Target="docProps/app.xml"/>' +
        '</Relationships>'],
      ['word/document.xml', documentXml(result, opts)],
      ['word/styles.xml', stylesXml()],
      ['word/numbering.xml', numberingXml()],
      ['word/_rels/document.xml.rels', XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="' + R_NS + '/styles" Target="styles.xml"/>' +
        '<Relationship Id="rId2" Type="' + R_NS + '/numbering" Target="numbering.xml"/>' +
        '</Relationships>'],
      ['docProps/core.xml', XML_HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        (title ? '<dc:title>' + xmlEsc(title) + '</dc:title>' : '') +
        (author ? '<dc:creator>' + xmlEsc(author) + '</dc:creator><cp:lastModifiedBy>' + xmlEsc(author) + '</cp:lastModifiedBy>' : '') +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' + isoDate(date) + '</dcterms:created>' +
        '<dcterms:modified xsi:type="dcterms:W3CDTF">' + isoDate(date) + '</dcterms:modified>' +
        '</cp:coreProperties>'],
      ['docProps/app.xml', XML_HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
        '<Application>' + xmlEsc(opts.application || '1234Tools PDF to Word') + '</Application>' +
        '<Pages>' + npages + '</Pages></Properties>']
    ];
    return zipStore(parts.map(function (p) { return { name: p[0], data: utf8(p[1]) }; }), date);
  }

  /* ---------------- zip (STORE) ---------------- */

  function utf8(s) {
    var out = [], i = 0;
    for (; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
        var d = s.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; }
        else c = 0xFFFD;
      } else if (c >= 0xD800 && c <= 0xDFFF) c = 0xFFFD;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zipStore(files, date) {
    var y = Math.min(2107, Math.max(1980, date.getFullYear()));
    var dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
    var dosDate = ((y - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    var chunks = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = utf8(f.name), crc = crc32(f.data), size = f.data.length;
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), name, f.data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true);
      ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true);
      ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
      ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + size;
    });
    var cdSize = central.reduce(function (n, c) { return n + c.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
    end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
    var all = chunks.concat(central, [new Uint8Array(end.buffer)]);
    var total = all.reduce(function (n, c) { return n + c.length; }, 0);
    var out = new Uint8Array(total), p = 0;
    all.forEach(function (c) { out.set(c, p); p += c.length; });
    return out;
  }

  return {
    layout: layout,
    toText: toText,
    toDocx: toDocx,
    // exposed for tests and for callers that want them
    _zipStore: function (files, date) { return zipStore(files.map(function (f) { return { name: f.name, data: typeof f.data === 'string' ? utf8(f.data) : f.data }; }), date || new Date()); },
    _crc32: crc32,
    version: 1
  };
});
