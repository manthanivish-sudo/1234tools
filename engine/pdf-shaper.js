/**
 * MVRShaper — text shaping with HarfBuzz, for the PDF engine's Unicode text.
 *
 * Hindi and the other Indic scripts cannot be drawn one character at a time:
 * consonants fuse into conjuncts, the short-i matra (ि) is drawn before the
 * consonant it follows in memory, a reph (र् at the start of a cluster) sits on
 * top of the next consonant. HarfBuzz does all of that from the font's own
 * GSUB/GPOS tables; this file is the thin wrapper that drives it.
 *
 * It drives the exports of harfbuzzjs's harfbuzz.wasm directly instead of
 * shipping the emscripten loader (harfbuzz.js), which is an ES module and so
 * cannot be pulled into a classic Web Worker with importScripts. The wasm needs
 * only five imports, all trivial, and the wrapper allocates through the wasm's
 * own malloc/free.
 *
 * Classic script, UMD:
 *   - in a page:      <script src="/engine/pdf-shaper.js"></script> → window.MVRShaper
 *   - in a worker:    importScripts('/engine/pdf-shaper.js')         → self.MVRShaper
 *   - in Node:        require('.../engine/pdf-shaper.js')             → module.exports
 *
 *   MVRShaper.load(baseUrl) → Promise<shaper>
 *     baseUrl: the folder that holds vendor/harfbuzz/ (the engine folder), as a
 *     URL in a browser or a path / file: URL in Node. Optional; defaults to the
 *     folder this script was loaded from.
 *   shaper.shape(fontBytes, text, { features, direction, script, language })
 *     → [{ g, cl, ax, ay, dx, dy }]   glyph id, cluster (UTF-16 index into
 *       text), x/y advance, x/y offset — all in font units (the font's scale is
 *       left at its unitsPerEm).
 *     features: HarfBuzz feature strings, e.g. ['-kern', 'liga=0'].
 *     script: an ISO 15924 tag ('Deva'). Without one, the text is split into
 *       runs of one script each (Latin, Devanagari, …; spaces, digits and
 *       punctuation join the run around them), each shaped with its own script
 *       and the whole text as context, and the results are concatenated in
 *       text order. HarfBuzz would otherwise guess one script for the whole
 *       buffer from its first letter, and "Rupee नमस्ते" would lose its
 *       conjuncts. Right-to-left runs come out in HarfBuzz's visual order;
 *       there is no bidi reordering between runs.
 *   shaper.glyphName(fontBytes, gid) → the font's own name for the glyph
 *   shaper.version → HarfBuzz version string
 *
 * The wasm is fetched on the first load() only, and one instance is shared.
 * Each font is turned into a HarfBuzz face once and cached against the bytes
 * object passed in (a WeakMap), so pass the same Uint8Array each time.
 *
 * Nothing here contacts a third party: the wasm comes from this site.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MVRShaper = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null), function () {
  'use strict';

  const IS_NODE = typeof process === 'object' && !!(process.versions && process.versions.node) &&
    typeof require === 'function' && typeof window === 'undefined' && typeof self === 'undefined';

  /* Where this script came from, captured while it is being evaluated (the
     only moment document.currentScript is set). */
  let scriptBase = null;
  try {
    if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) {
      scriptBase = new URL('./', document.currentScript.src).href;
    } else if (typeof self !== 'undefined' && self.location && typeof importScripts === 'function') {
      scriptBase = null;                  // a worker: its own URL says nothing about ours
    }
  } catch (e) { scriptBase = null; }

  const DIR = 'vendor/harfbuzz/';
  let loading = null;

  /* ---------- fetching the wasm ---------- */

  function readWasm(baseUrl) {
    if (IS_NODE) {
      const fs = require('fs');
      const path = require('path');
      let base = baseUrl || __dirname;
      if (/^file:/i.test(base)) base = require('url').fileURLToPath(base);
      return Promise.resolve(new Uint8Array(fs.readFileSync(path.join(base, DIR, 'harfbuzz.wasm'))));
    }
    let base = baseUrl || scriptBase || '/engine/';
    if (!/\/$/.test(base)) base += '/';
    const url = new URL(DIR + 'harfbuzz.wasm',
      new URL(base, typeof location !== 'undefined' ? location.href : 'http://localhost/')).href;
    return fetch(url, { credentials: 'same-origin' }).then((r) => {
      if (!r.ok) throw new Error('The text shaper could not be loaded (' + r.status + ').');
      return r.arrayBuffer();
    }).then((b) => new Uint8Array(b));
  }

  /* ---------- splitting text into script runs ---------- */

  // [first, last, ISO 15924 tag]. Anything not listed — spaces, digits,
  // punctuation, symbols, combining marks, ZWJ/ZWNJ, the danda — is Common
  // and joins the run around it.
  const SCRIPTS = [
    [0x0041, 0x005a, 'Latn'], [0x0061, 0x007a, 'Latn'], [0x00aa, 0x00aa, 'Latn'], [0x00ba, 0x00ba, 'Latn'],
    [0x00c0, 0x00d6, 'Latn'], [0x00d8, 0x00f6, 'Latn'], [0x00f8, 0x024f, 'Latn'], [0x0250, 0x02af, 'Latn'],
    [0x1d00, 0x1d7f, 'Latn'], [0x1e00, 0x1eff, 'Latn'], [0x2c60, 0x2c7f, 'Latn'], [0xa720, 0xa7ff, 'Latn'],
    [0xab30, 0xab6f, 'Latn'], [0xfb00, 0xfb06, 'Latn'], [0xff21, 0xff3a, 'Latn'], [0xff41, 0xff5a, 'Latn'],
    [0x0370, 0x03ff, 'Grek'], [0x1f00, 0x1fff, 'Grek'],
    [0x0400, 0x052f, 'Cyrl'], [0x1c80, 0x1c8f, 'Cyrl'], [0x2de0, 0x2dff, 'Cyrl'], [0xa640, 0xa69f, 'Cyrl'],
    [0x0530, 0x058f, 'Armn'], [0x0590, 0x05ff, 'Hebr'], [0xfb1d, 0xfb4f, 'Hebr'],
    [0x0600, 0x0660, 'Arab'], [0x066a, 0x06ff, 'Arab'], [0x0750, 0x077f, 'Arab'], [0x08a0, 0x08ff, 'Arab'],
    [0xfb50, 0xfdff, 'Arab'], [0xfe70, 0xfeff, 'Arab'],
    [0x0900, 0x0963, 'Deva'], [0x0966, 0x097f, 'Deva'], [0xa8e0, 0xa8ff, 'Deva'],
    [0x0980, 0x09ff, 'Beng'], [0x0a00, 0x0a7f, 'Guru'], [0x0a80, 0x0aff, 'Gujr'], [0x0b00, 0x0b7f, 'Orya'],
    [0x0b80, 0x0bff, 'Taml'], [0x0c00, 0x0c7f, 'Telu'], [0x0c80, 0x0cff, 'Knda'], [0x0d00, 0x0d7f, 'Mlym'],
    [0x0d80, 0x0dff, 'Sinh'], [0x0e00, 0x0e7f, 'Thai'], [0x0e80, 0x0eff, 'Laoo'], [0x0f00, 0x0fff, 'Tibt'],
    [0x1000, 0x109f, 'Mymr'], [0x10a0, 0x10ff, 'Geor'], [0x1100, 0x11ff, 'Hang'], [0xac00, 0xd7af, 'Hang'],
    [0x1780, 0x17ff, 'Khmr'], [0x3040, 0x309f, 'Hira'], [0x30a0, 0x30ff, 'Kana'],
    [0x4e00, 0x9fff, 'Hani'], [0x3400, 0x4dbf, 'Hani']
  ];

  function scriptOfCp(cp) {
    // The table is short; a linear scan is as quick as anything cleverer.
    for (const r of SCRIPTS) if (cp >= r[0] && cp <= r[1]) return r[2];
    return null;
  }

  /** Runs of [start, end) UTF-16 indices, each in one script. Common
      characters join the run before them (or, at the start, the first run). */
  function itemise(str) {
    const runs = [];
    let cur = null;
    for (let i = 0; i < str.length;) {
      const cp = str.codePointAt(i);
      const len = cp > 0xffff ? 2 : 1;
      const sc = scriptOfCp(cp);
      if (!cur) cur = { start: i, end: i + len, script: sc };
      else if (sc && cur.script && sc !== cur.script) {
        runs.push(cur);
        cur = { start: i, end: i + len, script: sc };
      } else {
        cur.end = i + len;
        if (sc && !cur.script) cur.script = sc;
      }
      i += len;
    }
    if (cur) runs.push(cur);
    if (!runs.length) runs.push({ start: 0, end: 0, script: null });
    return runs;
  }

  /* ---------- the instance ---------- */

  function instantiate(bytes) {
    let memory = null;
    const imports = {
      env: {
        _abort_js: () => { throw new Error('HarfBuzz aborted'); },
        _emscripten_runtime_keepalive_clear: () => {},
        _setitimer_js: () => 0,
        // emscripten's growth policy, simplified: grow to what is asked for,
        // plus a fifth, in whole 64 KiB pages; 2 GiB is the ceiling.
        emscripten_resize_heap: (requested) => {
          requested >>>= 0;
          const old = memory.buffer.byteLength;
          if (requested > 2147483648) return 0;
          const want = Math.min(2147483648, Math.max(requested, Math.ceil(old * 1.2)));
          const pages = Math.ceil((want - old) / 65536);
          try { memory.grow(pages); return 1; } catch (e) {
            try { memory.grow(Math.ceil((requested - old) / 65536)); return 1; } catch (e2) { return 0; }
          }
        }
      },
      wasi_snapshot_preview1: {
        proc_exit: (code) => { throw new Error('HarfBuzz exited with code ' + code); }
      }
    };
    return WebAssembly.instantiate(bytes, imports).then((res) => {
      const x = res.instance.exports;
      memory = x.memory;
      if (x.__wasm_call_ctors) x.__wasm_call_ctors();
      return makeShaper(x, memory);
    });
  }

  function makeShaper(x, memory) {
    // Views go stale whenever the memory grows, so take a fresh one each time.
    const u8 = () => new Uint8Array(memory.buffer);
    const u16 = () => new Uint16Array(memory.buffer);
    const u32 = () => new Uint32Array(memory.buffer);
    const i32 = () => new Int32Array(memory.buffer);

    function cString(ptr) {
      const h = u8();
      let end = ptr;
      while (h[end]) end++;
      let s = '';
      for (let i = ptr; i < end; i++) s += String.fromCharCode(h[i]);
      try { return new TextDecoder('utf-8').decode(h.slice(ptr, end)); } catch (e) { return s; }
    }

    function withAscii(str, fn) {
      const p = x.malloc(str.length + 1);
      const h = u8();
      for (let i = 0; i < str.length; i++) h[p + i] = str.charCodeAt(i) & 0x7f;
      h[p + str.length] = 0;
      try { return fn(p, str.length); } finally { x.free(p); }
    }

    const faces = new WeakMap();

    function fontFor(fontBytes) {
      if (!fontBytes || typeof fontBytes !== 'object') throw new Error('shape() needs the font bytes');
      let f = faces.get(fontBytes);
      if (f) return f;
      const src = fontBytes instanceof Uint8Array ? fontBytes : new Uint8Array(fontBytes);
      const data = x.malloc(src.length);
      u8().set(src, data);
      const blob = x.hb_blob_create(data, src.length, 1 /* READONLY */, 0, 0);
      const face = x.hb_face_create(blob, 0);
      const font = x.hb_font_create(face);
      x.hb_blob_destroy(blob);              // the face holds its own reference
      f = { data, face, font, upem: x.hb_face_get_upem(face) };
      faces.set(fontBytes, f);
      return f;
    }

    function shape(fontBytes, text, opts) {
      const o = opts || {};
      const f = fontFor(fontBytes);
      const str = String(text);
      // With no script given, split the text into runs of one script each:
      // HarfBuzz guesses a single script per buffer from its first letter, so
      // "Rupee ₹500 नमस्ते" would otherwise be shaped as Latin throughout.
      const runs = o.script ? [{ start: 0, end: str.length, script: String(o.script) }] : itemise(str);
      let tp = 0, fp = 0;
      try {
        tp = x.malloc(Math.max(2, str.length * 2));
        const h16 = u16();
        for (let i = 0; i < str.length; i++) h16[(tp >> 1) + i] = str.charCodeAt(i);

        const feats = (o.features || []).map(String);
        let nf = 0;
        if (feats.length) {
          fp = x.malloc(16 * feats.length);
          for (const s of feats) {
            const okay = withAscii(s, (p, n) => x.hb_feature_from_string(p, n, fp + 16 * nf));
            if (okay) nf++;
          }
        }

        const out = [];
        for (const run of runs) {
          const buf = x.hb_buffer_create();
          try {
            // The whole text goes in, so HarfBuzz sees the context either side;
            // cluster values come back as UTF-16 indices into the whole text.
            x.hb_buffer_add_utf16(buf, tp, str.length, run.start, run.end - run.start);
            if (o.direction) {
              const d = { ltr: 4, rtl: 5, ttb: 6, btt: 7 }[String(o.direction).toLowerCase()];
              if (d) x.hb_buffer_set_direction(buf, d);
            }
            if (run.script) {
              withAscii(run.script, (p, n) => x.hb_buffer_set_script(buf, x.hb_script_from_string(p, n)));
            }
            if (o.language) {
              withAscii(String(o.language), (p, n) => x.hb_buffer_set_language(buf, x.hb_language_from_string(p, n)));
            }
            x.hb_buffer_guess_segment_properties(buf);
            x.hb_shape(f.font, buf, fp, nf);

            const n = x.hb_buffer_get_length(buf);
            const ip = x.hb_buffer_get_glyph_infos(buf, 0) >> 2;
            const pp = x.hb_buffer_get_glyph_positions(buf, 0) >> 2;
            const U = u32(), I = i32();
            for (let i = 0; i < n; i++) {
              // hb_glyph_info_t: codepoint, mask, cluster, var1, var2 (5 × u32)
              // hb_glyph_position_t: x_advance, y_advance, x_offset, y_offset, var
              out.push({
                g: U[ip + i * 5], cl: U[ip + i * 5 + 2],
                ax: I[pp + i * 5], ay: I[pp + i * 5 + 1],
                dx: I[pp + i * 5 + 2], dy: I[pp + i * 5 + 3]
              });
            }
          } finally {
            x.hb_buffer_destroy(buf);
          }
        }
        return out;
      } finally {
        if (tp) x.free(tp);
        if (fp) x.free(fp);
      }
    }

    function glyphName(fontBytes, gid) {
      const f = fontFor(fontBytes);
      const p = x.malloc(256);
      try {
        u8()[p] = 0;
        x.hb_font_glyph_to_string(f.font, gid, p, 256);
        return cString(p);
      } finally { x.free(p); }
    }

    function upem(fontBytes) { return fontFor(fontBytes).upem; }

    return { shape, glyphName, upem, version: cString(x.hb_version_string()) };
  }

  function load(baseUrl) {
    if (!loading) {
      loading = readWasm(baseUrl).then(instantiate);
      loading.catch(() => { loading = null; });   // let a later call retry
    }
    return loading;
  }

  return { load };
});
