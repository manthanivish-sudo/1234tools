/**
 * PDFFont — Unicode text for the PDF engine: TrueType parsing, subsetting and
 * embedding as a Type0 / CIDFontType2 font (Identity-H) with a ToUnicode map.
 *
 * pdfcore.js writes only the base-14 fonts, which stop at WinAnsi. This module
 * embeds a real font instead — Noto Sans for Latin, Greek and Cyrillic, Noto
 * Sans Devanagari for Hindi — subset to the glyphs a document uses.
 *
 * It is concatenated into the browser bundle after pdfcore.js, so everything
 * lives inside the one declaration below and pdfcore's classes arrive as a
 * `deps` argument ({ Name, Ref, PDFStream }) rather than by name. Synchronous;
 * runs in a page, a Web Worker or Node.
 *
 * ---------------------------------------------------------------------------
 * How text is drawn and how it extracts
 * ---------------------------------------------------------------------------
 * Glyphs come from shapeSimple() (one glyph per character, for scripts that
 * need no shaping) or from HarfBuzz through engine/pdf-shaper.js and
 * fromShaper(). The first glyph of each cluster carries the cluster's source
 * text as `cl`; the cluster's other glyphs carry ''.
 *
 * A complex-script cluster is a run of glyphs that together stand for a run of
 * characters, and the two orders differ: "कि" is stored क + ि but drawn ि-glyph
 * then क-glyph; "क्ष" is three characters and one glyph. A per-glyph ToUnicode
 * map cannot say that. So:
 *
 *   - CIDs are not glyph ids. Each distinct (glyph, text, width) gets its own
 *     CID from a per-font, per-document registry, and a /CIDToGIDMap stream
 *     maps CIDs back to glyphs. The same glyph can carry different text in
 *     different places.
 *   - showGlyphs() deals each cluster's characters out over its glyphs in
 *     drawing order, so that read in content-stream order — which is what
 *     every extractor does — the strings concatenate to the logical text. For
 *     "कि" the i-matra glyph (drawn first) maps to "क" and the consonant glyph
 *     to "ि".
 *   - pdf.js judges each glyph by its string (see dealCluster): one containing
 *     a nonspacing mark (virama, nukta, most matras) is a zero-width diacritic
 *     whose position is ignored — so "क्ष" mapped whole on its conjunct glyph
 *     is glued to the end of the previous line. So a glyph that advances the
 *     pen only ever maps to text with no nonspacing mark; the marks go on
 *     zero-width glyphs, or on a zero-width "carrier" CID that draws a blank
 *     glyph: "क्ष" is the conjunct glyph mapped to "क" plus a carrier mapped
 *     to "्ष". Strings never end in ZWJ/ZWNJ/soft hyphen, which pdf.js skips.
 *
 * What was tried and rejected (pdf.js 5 and MuPDF 1.28 both checked):
 *   - one CID per glyph, mapped to the glyph's own characters: both readers
 *     return "िक" for "कि" and "कर्" for "र्क";
 *   - the whole cluster on its first glyph and nothing on the others, whether
 *     by an empty destination (<>) or by leaving the CID out: both readers
 *     then emit the raw CID as a control character (U+0002 …);
 *   - /Span <</ActualText …>> BDC … EMC round each line: pdf.js ignores it
 *     (same output as one-CID-per-glyph) and MuPDF repeats part of the text.
 *
 * Positioning: glyph widths in the CIDFont's /W array are the font's own
 * advances. Where HarfBuzz's advance differs (kerning, mark zeroing) a TJ
 * adjustment makes up the difference. A glyph with an x offset (a mark placed
 * over the previous glyph, such as the reph) gets its own CID whose /W width
 * is (advance − x offset), preceded by a TJ move of the offset: the pen moves
 * back, the glyph is drawn, and its width brings the pen back to where
 * HarfBuzz wants it — no rightward jump, which extractors that look for gaps
 * could read as a word space. A y offset uses Ts (text rise) around that one
 * glyph (Noto Sans Devanagari positions its marks with x offsets only).
 *
 * ---------------------------------------------------------------------------
 * API
 * ---------------------------------------------------------------------------
 *   parse(bytes)                         → font
 *   subset(font, gids)                   → Uint8Array (TrueType, glyph ids kept)
 *   subsetCompact(font, gids)            → { bytes, gidMap } (glyphs renumbered)
 *   closure(font, gids)                  → Set of gids incl. .notdef and composite parts
 *   shapeSimple(font, text)              → [{ gid, adv, cl }]
 *   fromShaper(font, text, shaped)       → [{ gid, adv, dx, dy, cl }]
 *   createRegistry(font)                 → { font, blankGid, cidFor(gid, text, width?), entries(), gids() }
 *   showGlyphs(registry, glyphs, size)   → operators to place inside BT … ET
 *   embedType0(writer, deps, { font, registry, baseName?, ref?, subset? }) → Ref
 *   measure(font, text, size)            → width in points (simple scripts)
 *   wrap(font, text, size, maxWidth, measureFn?) → lines
 *   needsUnicode(text) / scriptOf(text) / pickFont(text, bold)
 *   toUnicodeCMap(entries) / widthsArray(entries) — exposed for the tests
 */
const PDFFont = (function () {
  'use strict';

  /* ============================================================
     Reading
     ============================================================ */

  const tagAt = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

  function reader(bytes) {
    const b = bytes;
    return {
      u8: (o) => b[o],
      u16: (o) => (b[o] << 8) | b[o + 1],
      i16: (o) => { const v = (b[o] << 8) | b[o + 1]; return v & 0x8000 ? v - 0x10000 : v; },
      u32: (o) => ((b[o] << 24) >>> 0) + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]),
      i32: (o) => (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]
    };
  }

  function parse(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const r = reader(bytes);
    const ver = r.u32(0);
    if (ver !== 0x00010000 && tagAt(bytes, 0) !== 'true') {
      if (tagAt(bytes, 0) === 'OTTO') throw new Error('CFF-flavoured OpenType fonts are not supported; use a TrueType (glyf) font.');
      if (tagAt(bytes, 0) === 'ttcf') throw new Error('Font collections (.ttc) are not supported.');
      throw new Error('Not a TrueType font.');
    }
    const numTables = r.u16(4);
    const tables = Object.create(null);
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      const tag = tagAt(bytes, o);
      const offset = r.u32(o + 8), length = r.u32(o + 12);
      if (offset + length > bytes.length) throw new Error('Font table ' + tag + ' runs past the end of the file.');
      tables[tag] = { offset, length };
    }
    for (const t of ['head', 'hhea', 'maxp', 'hmtx', 'loca', 'glyf', 'cmap']) {
      if (!tables[t]) throw new Error('The font has no ' + t + ' table.');
    }

    const head = tables.head.offset;
    const unitsPerEm = r.u16(head + 18);
    const bbox = [r.i16(head + 36), r.i16(head + 38), r.i16(head + 40), r.i16(head + 42)];
    const macStyle = r.u16(head + 44);
    const indexToLocFormat = r.i16(head + 50);

    const hh = tables.hhea.offset;
    const hhea = { ascent: r.i16(hh + 4), descent: r.i16(hh + 6), lineGap: r.i16(hh + 8),
      numberOfHMetrics: r.u16(hh + 34) };
    const numGlyphs = r.u16(tables.maxp.offset + 4);

    // advances and left side bearings
    const advances = new Uint16Array(numGlyphs);
    const lsbs = new Int16Array(numGlyphs);
    {
      const o = tables.hmtx.offset, nh = Math.max(1, Math.min(hhea.numberOfHMetrics, numGlyphs));
      let last = 0;
      for (let g = 0; g < numGlyphs; g++) {
        if (g < nh) { last = r.u16(o + g * 4); advances[g] = last; lsbs[g] = r.i16(o + g * 4 + 2); }
        else {
          advances[g] = last;
          const p = o + nh * 4 + (g - nh) * 2;
          lsbs[g] = p + 2 <= tables.hmtx.offset + tables.hmtx.length ? r.i16(p) : 0;
        }
      }
    }

    // glyph locations
    const loca = new Uint32Array(numGlyphs + 1);
    {
      const o = tables.loca.offset;
      for (let g = 0; g <= numGlyphs; g++) {
        loca[g] = indexToLocFormat ? r.u32(o + g * 4) : r.u16(o + g * 2) * 2;
      }
    }

    const cmap = parseCmap(bytes, r, tables.cmap.offset);

    // OS/2: weight, cap height, typographic metrics
    let weight = 400, capHeight = 0, xHeight = 0, typoAscender = null, typoDescender = null, fsSelection = 0;
    if (tables['OS/2']) {
      const o = tables['OS/2'].offset, v = r.u16(o);
      weight = r.u16(o + 4);
      fsSelection = r.u16(o + 62);
      typoAscender = r.i16(o + 68); typoDescender = r.i16(o + 70);
      if (v >= 2 && tables['OS/2'].length >= 90) { xHeight = r.i16(o + 86); capHeight = r.i16(o + 88); }
    }

    let italicAngle = 0, isFixedPitch = false, underlinePosition = 0, underlineThickness = 0;
    if (tables.post) {
      const o = tables.post.offset;
      italicAngle = r.i32(o + 4) / 65536;
      underlinePosition = r.i16(o + 8);
      underlineThickness = r.i16(o + 10);
      isFixedPitch = r.u32(o + 12) !== 0;
    }

    const names = tables.name ? parseNames(bytes, r, tables.name.offset) : {};
    const postScriptName = (names[6] || names[4] || 'Font').replace(/[^\x21-\x7e]|[\[\](){}<>\/%#\s]/g, '');

    const font = {
      bytes, tables, unitsPerEm, numGlyphs, bbox, macStyle, indexToLocFormat, hhea,
      advances, lsbs, loca, cmap, weight, fsSelection, italicAngle, isFixedPitch,
      underlinePosition, underlineThickness, postScriptName,
      familyName: names[1] || '', fullName: names[4] || '',
      ascent: hhea.ascent, descent: hhea.descent,
      typoAscender, typoDescender, xHeight,
      capHeight: 0, flags: 0,
      glyphForCodePoint: (cp) => cmap.lookup(cp),
      advance: (gid) => (gid >= 0 && gid < numGlyphs ? advances[gid] : 0)
    };
    // Cap height from OS/2, or measured from the H if the table is too old.
    font.capHeight = capHeight || glyphYMax(font, cmap.lookup(0x48)) || Math.round(hhea.ascent * 0.7);
    // PDF FontDescriptor flags: 1 FixedPitch, 4 Symbolic, 64 Italic, 262144 ForceBold.
    // Symbolic, because the glyph set is not the standard Latin one — which is
    // what every CIDFontType2 producer writes.
    font.flags = (isFixedPitch ? 1 : 0) | 4 | (italicAngle !== 0 || (macStyle & 2) ? 64 : 0);
    return font;
  }

  function glyphYMax(font, gid) {
    if (!gid) return 0;
    const s = font.tables.glyf.offset + font.loca[gid];
    if (font.loca[gid + 1] - font.loca[gid] < 10) return 0;
    const b = font.bytes;
    const v = (b[s + 8] << 8) | b[s + 9];
    return v & 0x8000 ? v - 0x10000 : v;
  }

  function parseCmap(bytes, r, base) {
    const n = r.u16(base + 2);
    let best = null, bestScore = -1;
    for (let i = 0; i < n; i++) {
      const pid = r.u16(base + 4 + i * 8), eid = r.u16(base + 6 + i * 8);
      const off = base + r.u32(base + 8 + i * 8);
      const fmt = r.u16(off);
      let score = -1;
      if (fmt === 12 && ((pid === 3 && eid === 10) || pid === 0)) score = 4;
      else if (fmt === 4 && ((pid === 3 && eid === 1) || pid === 0)) score = 3;
      else if (fmt === 12) score = 2;
      else if (fmt === 4) score = 1;
      if (score > bestScore) { best = { off, fmt }; bestScore = score; }
    }
    if (!best) throw new Error('The font has no Unicode cmap (format 4 or 12).');
    const cache = new Map();
    let lookupRaw;

    if (best.fmt === 12) {
      const o = best.off, groups = r.u32(o + 12);
      const starts = new Uint32Array(groups), ends = new Uint32Array(groups), gids = new Uint32Array(groups);
      for (let i = 0; i < groups; i++) {
        starts[i] = r.u32(o + 16 + i * 12); ends[i] = r.u32(o + 20 + i * 12); gids[i] = r.u32(o + 24 + i * 12);
      }
      lookupRaw = (cp) => {
        let lo = 0, hi = groups - 1;
        while (lo <= hi) {
          const m = (lo + hi) >> 1;
          if (cp < starts[m]) hi = m - 1;
          else if (cp > ends[m]) lo = m + 1;
          else return gids[m] + (cp - starts[m]);
        }
        return 0;
      };
    } else {
      const o = best.off, segX2 = r.u16(o + 6), segs = segX2 / 2;
      const endO = o + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
      lookupRaw = (cp) => {
        if (cp > 0xffff) return 0;
        let lo = 0, hi = segs - 1;
        while (lo <= hi) {
          const m = (lo + hi) >> 1;
          const end = r.u16(endO + m * 2), start = r.u16(startO + m * 2);
          if (cp > end) lo = m + 1;
          else if (cp < start) hi = m - 1;
          else {
            const delta = r.u16(deltaO + m * 2), ro = r.u16(rangeO + m * 2);
            if (!ro) return (cp + delta) & 0xffff;
            const ga = rangeO + m * 2 + ro + (cp - start) * 2;
            const g = r.u16(ga);
            return g ? (g + delta) & 0xffff : 0;
          }
        }
        return 0;
      };
    }
    return {
      format: best.fmt,
      lookup(cp) {
        let g = cache.get(cp);
        if (g === undefined) { g = lookupRaw(cp); cache.set(cp, g); }
        return g;
      }
    };
  }

  function parseNames(bytes, r, base) {
    const count = r.u16(base + 2), strBase = base + r.u16(base + 4);
    const out = {}, rank = {};
    for (let i = 0; i < count; i++) {
      const o = base + 6 + i * 12;
      const pid = r.u16(o), eid = r.u16(o + 2), lang = r.u16(o + 4), id = r.u16(o + 6);
      const len = r.u16(o + 8), off = strBase + r.u16(o + 10);
      let s = null, score = 0;
      if (pid === 3 && (eid === 1 || eid === 0)) {
        s = '';
        for (let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(r.u16(off + k));
        score = lang === 0x409 ? 3 : 2;
      } else if (pid === 1 && eid === 0) {
        s = '';
        for (let k = 0; k < len; k++) s += String.fromCharCode(bytes[off + k]);
        score = 1;
      }
      if (s !== null && (rank[id] || 0) < score) { out[id] = s; rank[id] = score; }
    }
    return out;
  }

  /* ============================================================
     Subsetting
     ============================================================ */

  // Composite glyph component flags
  const ARG_1_AND_2_ARE_WORDS = 0x0001, WE_HAVE_A_SCALE = 0x0008, MORE_COMPONENTS = 0x0020,
    WE_HAVE_AN_X_AND_Y_SCALE = 0x0040, WE_HAVE_A_TWO_BY_TWO = 0x0080;

  function components(font, gid) {
    const out = [];
    const start = font.loca[gid], end = font.loca[gid + 1];
    if (end - start < 10) return out;
    const b = font.bytes, base = font.tables.glyf.offset + start;
    const nc = (b[base] << 8) | b[base + 1];
    if (!(nc & 0x8000)) return out;                       // simple glyph
    let p = base + 10;
    for (let guard = 0; guard < 1000; guard++) {
      const flags = (b[p] << 8) | b[p + 1];
      out.push((b[p + 2] << 8) | b[p + 3]);
      p += 4 + (flags & ARG_1_AND_2_ARE_WORDS ? 4 : 2);
      if (flags & WE_HAVE_A_SCALE) p += 2;
      else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) p += 4;
      else if (flags & WE_HAVE_A_TWO_BY_TWO) p += 8;
      if (!(flags & MORE_COMPONENTS)) break;
    }
    return out;
  }

  /** The glyph set a subset must keep: what was asked for, .notdef, and every
      component of every composite glyph, recursively. */
  function closure(font, gids) {
    const keep = new Set([0]);
    const stack = [];
    for (const g of gids) {
      const n = g | 0;
      if (n >= 0 && n < font.numGlyphs && !keep.has(n)) { keep.add(n); stack.push(n); }
    }
    stack.push(0);
    while (stack.length) {
      for (const c of components(font, stack.pop())) {
        if (c < font.numGlyphs && !keep.has(c)) { keep.add(c); stack.push(c); }
      }
    }
    return keep;
  }

  function checksum(bytes, off, len) {
    let sum = 0;
    const n = (len + 3) & ~3;
    for (let i = 0; i < n; i += 4) {
      const a = off + i;
      sum = (sum + (((bytes[a] || 0) << 24) >>> 0) + ((bytes[a + 1] || 0) << 16) +
        ((bytes[a + 2] || 0) << 8) + (bytes[a + 3] || 0)) >>> 0;
    }
    return sum >>> 0;
  }

  const copyTable = (font, tag) => {
    const t = font.tables[tag];
    return t ? font.bytes.slice(t.offset, t.offset + t.length) : null;
  };
  const put16 = (a, o, v) => { a[o] = (v >> 8) & 255; a[o + 1] = v & 255; };
  const put32 = (a, o, v) => { a[o] = (v >>> 24) & 255; a[o + 1] = (v >>> 16) & 255; a[o + 2] = (v >>> 8) & 255; a[o + 3] = v & 255; };

  /**
   * A TrueType file with only the glyphs in `gids` (plus composites' parts and
   * .notdef). Glyph ids are unchanged: unused glyphs are kept as empty entries
   * in loca, and the glyph count is cut to the highest glyph kept, so the
   * metrics and loca tables stop there too.
   *
   * Kept: head, hhea, maxp, loca, glyf, hmtx, cvt, fpgm, prep (the tables the
   * PDF specification lists for an embedded TrueType font), OS/2 (vertical
   * metrics for viewers that look) and post as format 3 (no glyph names).
   * Dropped: cmap — a CIDFontType2 reaches glyphs through CIDToGIDMap — and
   * name, GSUB, GPOS, GDEF, STAT, gasp, kern and the like, which only shaping
   * and font installers use.
   */
  function subset(font, gids) {
    const keep = closure(font, gids);
    let maxGid = 0;
    keep.forEach((g) => { if (g > maxGid) maxGid = g; });
    const slots = [];
    for (let g = 0; g <= maxGid; g++) slots.push(keep.has(g) ? g : -1);
    return buildSfnt(font, slots, null);
  }

  /**
   * As subset(), but the kept glyphs are renumbered 0, 1, 2… (in their
   * original order, so .notdef stays 0) and composite glyphs' references are
   * rewritten to match. Far smaller for fonts with thousands of glyphs, as
   * loca and hmtx shrink to the glyphs kept. Returns { bytes, gidMap } where
   * gidMap maps an original glyph id to its new one. embedType0 uses this,
   * since its CIDToGIDMap stream can point anywhere.
   */
  function subsetCompact(font, gids) {
    const keep = Array.from(closure(font, gids)).sort((a, b) => a - b);
    const gidMap = new Map();
    keep.forEach((g, i) => gidMap.set(g, i));
    return { bytes: buildSfnt(font, keep, gidMap), gidMap };
  }

  /** slots[newGid] = original gid, or −1 for an empty glyph. */
  function buildSfnt(font, slots, gidMap) {
    const nGlyphs = slots.length;
    const glyfBase = font.tables.glyf.offset;
    const lenOf = (g) => (g < 0 ? 0 : font.loca[g + 1] - font.loca[g]);

    // glyf and loca
    let glyfLen = 0;
    const offsets = new Uint32Array(nGlyphs + 1);
    for (let i = 0; i < nGlyphs; i++) {
      offsets[i] = glyfLen;
      glyfLen += (lenOf(slots[i]) + 3) & ~3;
    }
    offsets[nGlyphs] = glyfLen;
    const glyf = new Uint8Array(Math.max(glyfLen, 4));   // a zero-length glyf upsets some readers
    for (let i = 0; i < nGlyphs; i++) {
      const g = slots[i];
      if (g < 0 || !lenOf(g)) continue;
      const s = glyfBase + font.loca[g];
      glyf.set(font.bytes.subarray(s, s + lenOf(g)), offsets[i]);
      if (gidMap) remapComponents(glyf, offsets[i], lenOf(g), gidMap);
    }
    const longLoca = glyfLen > 0x1fffe;
    const loca = new Uint8Array((nGlyphs + 1) * (longLoca ? 4 : 2));
    for (let i = 0; i <= nGlyphs; i++) {
      if (longLoca) put32(loca, i * 4, offsets[i]);
      else put16(loca, i * 2, offsets[i] >> 1);
    }

    // hmtx: empty slots get zero metrics; trailing equal advances collapse
    const adv = new Uint16Array(nGlyphs), lsb = new Int16Array(nGlyphs);
    for (let i = 0; i < nGlyphs; i++) {
      const g = slots[i];
      if (g >= 0) { adv[i] = font.advances[g]; lsb[i] = font.lsbs[g]; }
    }
    let nh = nGlyphs;
    while (nh > 1 && adv[nh - 2] === adv[nGlyphs - 1]) nh--;
    const hmtx = new Uint8Array(nh * 4 + (nGlyphs - nh) * 2);
    for (let i = 0; i < nGlyphs; i++) {
      if (i < nh) { put16(hmtx, i * 4, adv[i]); put16(hmtx, i * 4 + 2, lsb[i] & 0xffff); }
      else put16(hmtx, nh * 4 + (i - nh) * 2, lsb[i] & 0xffff);
    }

    const head = copyTable(font, 'head');
    put32(head, 8, 0);                                    // checkSumAdjustment, set below
    put16(head, 50, longLoca ? 1 : 0);

    const hhea = copyTable(font, 'hhea');
    put16(hhea, 34, nh);

    const maxp = copyTable(font, 'maxp');
    put16(maxp, 4, nGlyphs);

    const post = new Uint8Array(32);
    put32(post, 0, 0x00030000);
    if (font.tables.post) post.set(font.bytes.subarray(font.tables.post.offset + 4, font.tables.post.offset + 16), 4);

    const out = { head, hhea, maxp, loca, glyf, hmtx, post };
    for (const t of ['cvt ', 'fpgm', 'prep', 'OS/2']) {
      const c = copyTable(font, t);
      if (c) out[t] = c;
    }
    return assembleSfnt(out);
  }

  /** Rewrite the glyph references of a composite glyph copied to buf[off…]. */
  function remapComponents(buf, off, len, gidMap) {
    if (len < 10 || !(buf[off] & 0x80)) return;             // simple glyph
    let p = off + 10;
    for (let guard = 0; guard < 1000 && p + 4 <= off + len; guard++) {
      const flags = (buf[p] << 8) | buf[p + 1];
      const old = (buf[p + 2] << 8) | buf[p + 3];
      const nu = gidMap.get(old);
      if (nu === undefined) throw new Error('Composite glyph refers to glyph ' + old + ', which the subset lost.');
      put16(buf, p + 2, nu);
      p += 4 + (flags & ARG_1_AND_2_ARE_WORDS ? 4 : 2);
      if (flags & WE_HAVE_A_SCALE) p += 2;
      else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) p += 4;
      else if (flags & WE_HAVE_A_TWO_BY_TWO) p += 8;
      if (!(flags & MORE_COMPONENTS)) break;
    }
  }

  function assembleSfnt(tables) {
    const tags = Object.keys(tables).sort();              // binary order: ASCII sort suffices
    const n = tags.length;
    let es = 0;
    while ((1 << (es + 1)) <= n) es++;
    const sr = (1 << es) * 16;
    let size = 12 + n * 16;
    for (const t of tags) size += (tables[t].length + 3) & ~3;
    const f = new Uint8Array(size);
    put32(f, 0, 0x00010000);
    put16(f, 4, n); put16(f, 6, sr); put16(f, 8, es); put16(f, 10, n * 16 - sr);
    let off = 12 + n * 16, headAt = -1;
    tags.forEach((t, i) => {
      const data = tables[t], rec = 12 + i * 16;
      for (let k = 0; k < 4; k++) f[rec + k] = t.charCodeAt(k);
      f.set(data, off);
      put32(f, rec + 4, checksum(f, off, data.length));
      put32(f, rec + 8, off);
      put32(f, rec + 12, data.length);
      if (t === 'head') headAt = off;
      off += (data.length + 3) & ~3;
    });
    if (headAt >= 0) put32(f, headAt + 8, (0xb1b0afba - checksum(f, 0, f.length)) >>> 0);
    return f;
  }

  /* ============================================================
     Glyphs from text
     ============================================================ */

  // Default-ignorable characters (ZWJ, ZWNJ, soft hyphen, variation
  // selectors…). They draw nothing; their text joins the next glyph's cluster.
  const isIgnorable = (cp) => cp === 0xad || cp === 0x34f || cp === 0x61c ||
    (cp >= 0x115f && cp <= 0x1160) || (cp >= 0x17b4 && cp <= 0x17b5) || (cp >= 0x180b && cp <= 0x180f) ||
    (cp >= 0x200b && cp <= 0x200f) || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2060 && cp <= 0x206f) ||
    cp === 0x3164 || (cp >= 0xfe00 && cp <= 0xfe0f) || cp === 0xfeff || cp === 0xffa0 ||
    (cp >= 0xfff0 && cp <= 0xfff8) || (cp >= 0x1bca0 && cp <= 0x1bca3) ||
    (cp >= 0x1d173 && cp <= 0x1d17a) || (cp >= 0xe0000 && cp <= 0xe0fff);

  /**
   * One glyph per character, straight from the cmap — for scripts that need
   * no shaping. Combining marks keep their own (zero-advance) glyph. Each
   * glyph's `cl` is its character; tab, CR and LF draw as a space.
   */
  function shapeSimple(font, text) {
    const out = [];
    let carry = '';
    for (const ch of String(text)) {
      const cp = ch.codePointAt(0);
      let gid = font.glyphForCodePoint(cp);
      if (cp === 0x0a || cp === 0x0d || cp === 0x09) gid = font.glyphForCodePoint(0x20);
      // Hidden as HarfBuzz hides them, even where the font has a glyph (a
      // soft hyphen's glyph is a visible hyphen).
      if (isIgnorable(cp)) { carry += ch; continue; }
      out.push({ gid, adv: font.advance(gid), cl: carry + ch });
      carry = '';
    }
    if (carry) {
      if (out.length) out[out.length - 1].cl += carry;
      else out.push({ gid: 0, adv: 0, cl: carry, invisible: true });
    }
    return out;
  }

  /**
   * Shaper output → drawable glyphs. `shaped` is MVRShaper's
   * [{ g, cl, ax, ay, dx, dy }] or HarfBuzz-style [{ gid|codepoint, cluster,
   * x_advance, x_offset, y_offset }]; cluster values are UTF-16 indices into
   * `text`. Left-to-right text only.
   *
   * The first glyph of each cluster, in drawing order, carries the whole
   * cluster's text as `cl`; the other glyphs of the cluster carry ''.
   * showGlyphs() decides how that text is spread over the glyphs.
   */
  function fromShaper(font, text, shaped) {
    const s = String(text);
    const norm = shaped.map((g) => ({
      gid: g.g !== undefined ? g.g : (g.gid !== undefined ? g.gid : g.codepoint),
      c: g.cl !== undefined ? g.cl : g.cluster,
      adv: g.ax !== undefined ? g.ax : (g.x_advance !== undefined ? g.x_advance : g.adv),
      dx: g.dx !== undefined ? g.dx : (g.x_offset || 0),
      dy: g.dy !== undefined ? g.dy : (g.y_offset || 0)
    }));
    const starts = Array.from(new Set(norm.map((g) => g.c))).sort((a, b) => a - b);
    const endOf = new Map();
    starts.forEach((c, i) => endOf.set(c, i + 1 < starts.length ? starts[i + 1] : s.length));
    if (starts.length && starts[0] > 0) {          // text before the first cluster joins it
      const first = starts[0];
      endOf.set(0, endOf.get(first)); endOf.delete(first);
      norm.forEach((g) => { if (g.c === first) g.c = 0; });
    }
    return norm.map((g, i) => ({
      gid: g.gid, adv: g.adv, dx: g.dx || 0, dy: g.dy || 0,
      cl: i === 0 || norm[i - 1].c !== g.c ? s.slice(g.c, endOf.get(g.c)) : ''
    }));
  }

  /* ============================================================
     CID registry and content-stream operators
     ============================================================ */

  const wUnits = (font, adv) => Math.round(adv * 1000 / font.unitsPerEm);
  const num = (v) => {
    const r = Math.round(v * 1000) / 1000;
    return Object.is(r, -0) ? '0' : String(r);
  };
  const hex4 = (v) => ('000' + v.toString(16).toUpperCase()).slice(-4);
  const isBlankGlyph = (font, gid) => gid > 0 && gid < font.numGlyphs && font.loca[gid + 1] === font.loca[gid];

  function createRegistry(font) {
    const byKey = new Map();
    const list = [{ cid: 0, gid: 0, text: '', width: wUnits(font, font.advance(0)) }];
    byKey.set('0\u0000\u0000' + list[0].width, 0);
    // A glyph with no outline, for the zero-width "carrier" CIDs below.
    let blank = 0;
    for (const g of [font.glyphForCodePoint(0x200b), font.glyphForCodePoint(0x200c),
      font.glyphForCodePoint(0x200d), font.glyphForCodePoint(0x20), 1, 2, 3]) {
      if (isBlankGlyph(font, g)) { blank = g; break; }
    }
    return {
      font,
      blankGid: blank,
      /** CID for this glyph standing for this text, drawn with this /W width
          (in 1/1000 em; defaults to the glyph's own advance). */
      cidFor(gid, text, width) {
        const w = width === undefined ? wUnits(font, font.advance(gid)) : Math.round(width);
        const t = text || '';
        const key = gid + '\u0000' + t + '\u0000' + w;
        let cid = byKey.get(key);
        if (cid === undefined) {
          cid = list.length;
          if (cid > 0xffff) throw new Error('Too many distinct glyphs for one embedded font.');
          list.push({ cid, gid, text: t, width: w });
          byKey.set(key, cid);
        }
        return cid;
      },
      entries: () => list.slice(),
      gids: () => new Set(list.map((e) => e.gid))
    };
  }

  /*
   * Spreading a cluster's text over its glyphs.
   *
   * Text extractors read ToUnicode strings in content-stream order, so the
   * pieces must concatenate to the logical text — but pdf.js also judges each
   * glyph by its string (pdf.js 5, getCharUnicodeCategory:
   * /^(\s)|(\p{Mn})|(\p{Cf})$/u): a string containing a nonspacing mark is a
   * "zero-width diacritic" whose position and width are ignored (so it is
   * glued to whatever came before — even the previous line), and a string
   * ending in a format character (ZWJ, ZWNJ, soft hyphen) is skipped outright.
   * An empty or missing mapping makes both pdf.js and MuPDF emit the raw CID.
   *
   * So: every glyph that advances the pen gets a string with no nonspacing
   * mark; nonspacing marks ride on zero-width glyphs, and where there is none
   * to carry them, on a "carrier" — a zero-width CID mapped to a blank glyph
   * that draws nothing; no string ends in a format character (those move on
   * to the start of the next string).
   */
  const MN = /\p{Mn}/u, CF_END = /\p{Cf}+$/u;

  function dealCluster(chars, glyphs, widths, out) {
    let p = 0;
    const n = chars.length, m = glyphs.length;
    const mnRunEnd = (q) => { while (q < n && MN.test(chars[q])) q++; return q; };
    for (let i = 0; i < m; i++) {
      const last = i === m - 1;
      let take = '';
      if (widths[i] !== 0) {
        if (p < n && MN.test(chars[p])) {
          const q = mnRunEnd(p);
          if (q < n) { out.push({ carrier: true, text: chars.slice(p, q).join('') }); p = q; }
        }
        if (p < n) take = chars[p++];
        if (last) while (p < n && !MN.test(chars[p])) take += chars[p++];
      } else if (p < n) {
        take = chars[p++];
        const q = mnRunEnd(p);
        take += chars.slice(p, q).join(''); p = q;
      }
      out.push({ glyph: glyphs[i], width: widths[i], text: take });
    }
    if (p < n) {
      const rest = chars.slice(p).join('');
      const tail = out[out.length - 1];
      if (tail && (tail.carrier || tail.width === 0 || !MN.test(rest))) tail.text += rest;
      else out.push({ carrier: true, text: rest });
    }
  }

  /**
   * Operators that draw `glyphs` at `size`, for use inside BT … ET after Tf and
   * the text position have been set. Glyphs are { gid, adv, cl, dx?, dy? } in
   * font units, from shapeSimple() or fromShaper(): a glyph with non-empty
   * `cl` starts a cluster and glyphs with '' continue it.
   */
  function showGlyphs(registry, glyphs, size) {
    const font = registry.font, k = 1000 / font.unitsPerEm;

    // 1. widths, clusters, and the text of each piece
    const items = [];
    let i = 0;
    while (i < glyphs.length) {
      let j = i;
      while (j + 1 < glyphs.length && !glyphs[j + 1].cl) j++;
      const group = glyphs.slice(i, j + 1).filter((g) => !g.invisible);
      const widths = group.map((g) => {
        const target = (g.adv === undefined ? font.advance(g.gid) : g.adv) * k;
        return g.dx ? Math.round(target - g.dx * k) : wUnits(font, font.advance(g.gid));
      });
      const chars = Array.from(glyphs[i].cl || '');
      if (group.length) dealCluster(chars, group, widths, items);
      else if (chars.length) items.push({ carrier: true, text: chars.join('') });
      i = j + 1;
    }
    // 2. no string may end in a format character: move such tails forward
    let carry = '';
    for (const it of items) {
      it.text = carry + it.text;
      const m = CF_END.exec(it.text);
      carry = m ? m[0] : '';
      if (carry) it.text = it.text.slice(0, it.text.length - carry.length);
    }
    if (carry) items.push({ carrier: true, text: carry });   // pdf.js drops it; MuPDF keeps it

    // 3. operators
    let ops = '';
    let arr = [];               // pending TJ elements: strings of hex, or numbers
    const pushHex = (h) => {
      if (arr.length && typeof arr[arr.length - 1] === 'string') arr[arr.length - 1] += h;
      else arr.push(h);
    };
    // A TJ number n moves the pen by −n/1000 em, so a move of m units is −m.
    const pushNum = (n) => {
      if (Math.abs(n) < 0.0005) return;
      if (arr.length && typeof arr[arr.length - 1] === 'number') {
        arr[arr.length - 1] += n;
        if (Math.abs(arr[arr.length - 1]) < 0.0005) arr.pop();
      } else arr.push(n);
    };
    // Trailing numbers are kept: they place whatever is drawn next.
    const flush = () => {
      if (!arr.length) return;
      if (arr.length === 1 && typeof arr[0] === 'string') ops += '<' + arr[0] + '> Tj\n';
      else ops += '[' + arr.map((e) => typeof e === 'number' ? num(e) : '<' + e + '>').join(' ') + '] TJ\n';
      arr = [];
    };
    for (const it of items) {
      if (it.carrier) {
        if (it.text) pushHex(hex4(registry.cidFor(registry.blankGid, it.text, 0)));
        continue;
      }
      const g = it.glyph;
      const target = (g.adv === undefined ? font.advance(g.gid) : g.adv) * k;
      const dx = (g.dx || 0) * k, dy = (g.dy || 0) * k;
      if (!it.text && isBlankGlyph(font, g.gid)) {          // nothing to draw, nothing to say
        pushNum(-target);
        continue;
      }
      // A glyph left with no text (a cluster with more glyphs than characters)
      // maps to U+200B, which pdf.js skips; an empty mapping would leak the CID.
      const text = it.text || '\u200b';
      // With an x offset, move by it, draw, and let this CID's own /W width
      // land the pen at the shaped advance: no rightward jump after a mark.
      const cid = dx ? registry.cidFor(g.gid, text, it.width) : registry.cidFor(g.gid, text);
      pushNum(-dx);
      if (dy) {
        flush();
        ops += num(dy * size / 1000) + ' Ts\n<' + hex4(cid) + '> Tj\n0 Ts\n';
      } else {
        pushHex(hex4(cid));
      }
      pushNum(-(target - dx - it.width));
    }
    flush();
    return ops;
  }

  /* ============================================================
     Embedding
     ============================================================ */

  function subsetTag(entries) {
    // Deterministic: the same glyph set gives the same tag.
    let h = 0x811c9dc5;
    for (const e of entries) {
      h ^= e.gid & 0xffff; h = Math.imul(h, 0x01000193) >>> 0;
      h ^= e.cid & 0xffff; h = Math.imul(h, 0x01000193) >>> 0;
    }
    let s = '';
    for (let i = 0; i < 6; i++) { s += String.fromCharCode(65 + (h % 26)); h = (Math.floor(h / 26) ^ (i * 7919)) >>> 0; }
    return s;
  }

  function bytesOfAscii(str) {
    const a = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) a[i] = str.charCodeAt(i) & 0xff;
    return a;
  }

  function utf16Hex(text) {
    let h = '';
    for (let i = 0; i < text.length; i++) h += hex4(text.charCodeAt(i));   // surrogates pass through as pairs
    return h;
  }

  function widthsArray(entries) {
    const W = [];
    let i = 0;
    while (i < entries.length) {
      // a run of equal widths over consecutive CIDs: c1 c2 w
      let j = i;
      while (j + 1 < entries.length && entries[j + 1].cid === entries[j].cid + 1 &&
        entries[j + 1].width === entries[i].width) j++;
      if (j - i >= 2) { W.push(entries[i].cid, entries[j].cid, entries[i].width); i = j + 1; continue; }
      // otherwise a list: c [w1 w2 …] up to the next long equal run or gap
      const start = i, ws = [];
      while (i < entries.length && (i === start || entries[i].cid === entries[i - 1].cid + 1)) {
        let r = i;
        while (r + 1 < entries.length && entries[r + 1].cid === entries[r].cid + 1 &&
          entries[r + 1].width === entries[i].width) r++;
        if (r - i >= 2 && i !== start) break;
        ws.push(entries[i].width); i++;
      }
      W.push(entries[start].cid, ws);
    }
    return W;
  }

  function toUnicodeCMap(entries) {
    const mapped = entries.filter((e) => e.text);
    const single = [], ranges = [];
    let i = 0;
    while (i < mapped.length) {
      // bfrange: consecutive CIDs (same high byte) to consecutive single BMP characters
      let j = i;
      const one = (e) => e.text.length === 1;
      if (one(mapped[i])) {
        while (j + 1 < mapped.length && one(mapped[j + 1]) &&
          mapped[j + 1].cid === mapped[j].cid + 1 && (mapped[j + 1].cid >> 8) === (mapped[i].cid >> 8) &&
          mapped[j + 1].text.charCodeAt(0) === mapped[j].text.charCodeAt(0) + 1 &&
          (mapped[j + 1].text.charCodeAt(0) & 0xff) !== 0) j++;
      }
      if (j - i >= 2) {
        ranges.push('<' + hex4(mapped[i].cid) + '> <' + hex4(mapped[j].cid) + '> <' + utf16Hex(mapped[i].text) + '>');
        i = j + 1;
      } else {
        single.push('<' + hex4(mapped[i].cid) + '> <' + utf16Hex(mapped[i].text) + '>');
        i++;
      }
    }
    let s = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n' +
      '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n' +
      '/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n' +
      '1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
    for (let k = 0; k < single.length; k += 100) {
      const part = single.slice(k, k + 100);
      s += part.length + ' beginbfchar\n' + part.join('\n') + '\nendbfchar\n';
    }
    for (let k = 0; k < ranges.length; k += 100) {
      const part = ranges.slice(k, k + 100);
      s += part.length + ' beginbfrange\n' + part.join('\n') + '\nendbfrange\n';
    }
    s += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n';
    return s;
  }

  /**
   * Add the font to a pdfcore PDFWriter and return the Ref of its Type0 font
   * dictionary. Call once per font, after every page that uses the registry
   * has been drawn. `ref` (a Ref or object number) fills a pre-allocated slot.
   */
  function embedType0(writer, deps, opts) {
    const { Name, Ref, PDFStream } = deps;
    const font = opts.font, registry = opts.registry;
    const entries = registry.entries().sort((a, b) => a.cid - b.cid);
    const k = 1000 / font.unitsPerEm;
    const sc = (v) => Math.round(v * k);
    const tag = subsetTag(entries);
    const base = String(opts.baseName || font.postScriptName || 'Font').replace(/[^\x21-\x7e]|[\[\](){}<>\/%#\s]/g, '');
    const fontName = opts.subset === false ? base : tag + '+' + base;

    // The font program: by default a compact subset with renumbered glyphs.
    // { subset: 'ids' } keeps original glyph ids (subset()); { subset: false }
    // embeds the whole font (for comparison in the tests).
    let sub, gidOf;
    if (opts.subset === false) { sub = font.bytes; gidOf = (g) => g; }
    else if (opts.subset === 'ids') { sub = subset(font, entries.map((e) => e.gid)); gidOf = (g) => g; }
    else {
      const c = subsetCompact(font, entries.map((e) => e.gid));
      sub = c.bytes; gidOf = (g) => c.gidMap.get(g);
    }
    const fileDict = Object.create(null);
    fileDict.Length1 = sub.length;
    const fileRef = new Ref(writer.add(new PDFStream(fileDict, sub)), 0);

    const desc = Object.create(null);
    Object.assign(desc, {
      Type: new Name('FontDescriptor'), FontName: new Name(fontName), Flags: font.flags,
      FontBBox: font.bbox.map(sc), ItalicAngle: font.italicAngle,
      Ascent: sc(font.ascent), Descent: sc(font.descent), CapHeight: sc(font.capHeight),
      StemV: font.weight >= 600 ? 120 : 80, FontFile2: fileRef
    });
    if (font.xHeight) desc.XHeight = sc(font.xHeight);
    const descRef = new Ref(writer.add(desc), 0);

    // CIDToGIDMap: two bytes per CID, CID 0 upwards
    let maxCid = 0;
    for (const e of entries) if (e.cid > maxCid) maxCid = e.cid;
    const map = new Uint8Array((maxCid + 1) * 2);
    for (const e of entries) { const g = gidOf(e.gid); map[e.cid * 2] = g >> 8; map[e.cid * 2 + 1] = g & 255; }
    const mapRef = new Ref(writer.add(new PDFStream(Object.create(null), map)), 0);

    const cidFont = Object.create(null);
    Object.assign(cidFont, {
      Type: new Name('Font'), Subtype: new Name('CIDFontType2'), BaseFont: new Name(fontName),
      CIDSystemInfo: { Registry: { __string: bytesOfAscii('Adobe') }, Ordering: { __string: bytesOfAscii('Identity') }, Supplement: 0 },
      FontDescriptor: descRef, DW: sc(font.advance(0)), W: widthsArray(entries), CIDToGIDMap: mapRef
    });
    const cidRef = new Ref(writer.add(cidFont), 0);

    const tuRef = new Ref(writer.add(new PDFStream(Object.create(null), bytesOfAscii(toUnicodeCMap(entries)))), 0);

    const type0 = Object.create(null);
    Object.assign(type0, {
      Type: new Name('Font'), Subtype: new Name('Type0'), BaseFont: new Name(fontName),
      Encoding: new Name('Identity-H'), DescendantFonts: [cidRef], ToUnicode: tuRef
    });
    if (opts.ref !== undefined && opts.ref !== null) {
      const numRef = typeof opts.ref === 'number' ? opts.ref : opts.ref.num;
      writer.set(numRef, type0);
      return new Ref(numRef, 0);
    }
    return new Ref(writer.add(type0), 0);
  }

  /* ============================================================
     Measuring and wrapping
     ============================================================ */

  function measure(font, text, size) {
    let units = 0;
    for (const g of shapeSimple(font, text)) units += g.adv;
    return units * size / font.unitsPerEm;
  }

  /** pdfcore's wrapText, measured with the font. For shaped scripts pass a
      measureFn(text) → points built on the shaper, as conjuncts are narrower
      than the sum of their parts. */
  function wrap(font, text, size, maxWidth, measureFn) {
    const width = measureFn || ((t) => measure(font, t, size));
    const lines = [];
    for (const para of String(text).split('\n')) {
      if (!para.trim()) { lines.push(''); continue; }
      let line = '';
      for (const word of para.split(/\s+/)) {
        const test = line ? line + ' ' + word : word;
        if (width(test) > maxWidth && line) { lines.push(line); line = word; }
        else line = test;
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  /* ============================================================
     Choosing a font
     ============================================================ */

  // pdfcore's WINANSI and FALLBACK keys: what contentEscape can show.
  const WINANSI_EXTRA = new Set([0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
    0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc,
    0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178]);
  const FALLBACK_KEYS = new Set([0x2212, 0x2010, 0x2011, 0x2015, 0x00a0, 0x2009, 0x200a, 0x2002, 0x2003,
    0x2032, 0x2033, 0x00ad]);

  /** True when pdfcore's contentEscape would print '?' for some character. */
  function needsUnicode(text) {
    for (const ch of String(text)) {
      const c = ch.codePointAt(0);
      if (c < 256 || WINANSI_EXTRA.has(c) || FALLBACK_KEYS.has(c)) continue;
      return true;
    }
    return false;
  }

  const isDevanagari = (c) => (c >= 0x0900 && c <= 0x097f) || (c >= 0xa8e0 && c <= 0xa8ff) ||
    (c >= 0x1cd0 && c <= 0x1cff) || (c >= 0x11b00 && c <= 0x11b5f);
  // What Noto Sans serves with no shaping: Latin, IPA, Greek, Cyrillic, and the
  // shared punctuation, symbol and currency blocks.
  const isLatinish = (c) => c < 0x0530 || (c >= 0x1d00 && c <= 0x1fff) || (c >= 0x2000 && c <= 0x2bff) ||
    (c >= 0x2c60 && c <= 0x2c7f) || (c >= 0x2de0 && c <= 0x2e7f) || (c >= 0xa640 && c <= 0xa69f) ||
    (c >= 0xa700 && c <= 0xa7ff) || (c >= 0xab30 && c <= 0xab6f) || (c >= 0xfb00 && c <= 0xfb06) ||
    (c >= 0xfe00 && c <= 0xfe0f) || (c >= 0xfe20 && c <= 0xfe2f) || c === 0xfeff || (c >= 0xfff0 && c <= 0xfffd);

  /** 'devanagari' if any Devanagari is present, 'latin' if everything is
      Latin/Greek/Cyrillic/common, otherwise 'other'. */
  function scriptOf(text) {
    let other = false;
    for (const ch of String(text)) {
      const c = ch.codePointAt(0);
      if (isDevanagari(c)) return 'devanagari';
      if (!isLatinish(c)) other = true;
    }
    return other ? 'other' : 'latin';
  }

  // Non-Devanagari code points in NotoSansDevanagari 2.006 (both weights):
  // ASCII, most of Latin-1, part of Latin Extended-A, common punctuation, € ₹ ™.
  const NSD_EXTRA = [0xd, 0xd, 0x20, 0x7e, 0xa0, 0xa3, 0xa5, 0xa5, 0xa7, 0xab, 0xad, 0xb0, 0xb4, 0xb4,
    0xb6, 0xb8, 0xba, 0xbb, 0xbf, 0x107, 0x10a, 0x113, 0x116, 0x11b, 0x11e, 0x123, 0x126, 0x127, 0x12a,
    0x12b, 0x12e, 0x131, 0x136, 0x137, 0x139, 0x13e, 0x141, 0x148, 0x150, 0x155, 0x158, 0x15b, 0x15e,
    0x161, 0x164, 0x165, 0x16a, 0x16b, 0x16e, 0x17e, 0x218, 0x21b, 0x237, 0x237, 0x2bc, 0x2bc, 0x2c6,
    0x2c7, 0x2c9, 0x2c9, 0x2d8, 0x2dd, 0x300, 0x304, 0x306, 0x308, 0x30a, 0x30c, 0x326, 0x328, 0x1e80,
    0x1e85, 0x1e9e, 0x1e9e, 0x1ef2, 0x1ef3, 0x200b, 0x200d, 0x2010, 0x2010, 0x2013, 0x2014, 0x2018,
    0x201a, 0x201c, 0x201e, 0x2022, 0x2022, 0x2026, 0x2026, 0x2039, 0x203a, 0x20ac, 0x20ac, 0x20b9,
    0x20b9, 0x20f0, 0x20f0, 0x2122, 0x2122, 0x2212, 0x2212, 0x25cc, 0x25cc, 0xa830, 0xa839];
  const inNSD = (c) => {
    if (isDevanagari(c) || c === 0x09 || c === 0x0a) return true;
    for (let i = 0; i < NSD_EXTRA.length; i += 2) if (c >= NSD_EXTRA[i] && c <= NSD_EXTRA[i + 1]) return true;
    return false;
  };

  /**
   * Which vendored font serves `text`. Devanagari — alone or mixed with the
   * Latin that Noto Sans Devanagari also carries (ASCII, most of Latin-1,
   * common punctuation, ₹ €) — takes Noto Sans Devanagari. Devanagari mixed
   * with characters it lacks (Greek, Cyrillic, ā ō and other Latin Extended
   * letters) takes Noto Sans, whose Google Fonts build also contains the full
   * Devanagari block and its shaping tables.
   */
  function pickFont(text, bold) {
    const w = bold ? 'Bold' : 'Regular';
    if (scriptOf(text) === 'devanagari') {
      for (const ch of String(text)) {
        if (!inNSD(ch.codePointAt(0))) return 'NotoSans-' + w + '.ttf';
      }
      return 'NotoSansDevanagari-' + w + '.ttf';
    }
    return 'NotoSans-' + w + '.ttf';
  }

  return {
    parse, subset, subsetCompact, closure, shapeSimple, fromShaper, createRegistry, showGlyphs, embedType0,
    measure, wrap, needsUnicode, scriptOf, pickFont,
    toUnicodeCMap, widthsArray
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PDFFont };
}
