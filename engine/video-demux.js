/**
 * Video files taken apart on the device (window.VideoDemux; also a CommonJS
 * module, so the tests can run it in Node).
 *
 * Reads the two container families browsers play — ISO base media (MP4,
 * MOV, M4V, M4A, 3GP; plain or fragmented) and Matroska (WebM, MKV) — and
 * returns each track's codec, in the form WebCodecs expects, and the list
 * of its samples: where each one lies in the file, how long it is, when it
 * is decoded and shown, and whether it starts a picture on its own (a
 * keyframe). Nothing is decoded here and nothing is read twice: the file is
 * read through `reader.read(offset, length)`, so a 1 GB video is never held
 * in memory whole — only the index (the MP4 `moov`, or one pass over the
 * Matroska clusters, a few megabytes at a time) and later the samples a
 * tool asks for.
 *
 * Written from the specifications, not ported: ISO/IEC 14496-12 (boxes,
 * sample tables, edit lists, movie fragments), 14496-15 (avcC, hvcC),
 * 14496-1 (esds descriptors), 14496-3 (AudioSpecificConfig), the Opus in
 * ISOBMFF and VP9/AV1 codec-ISOBMFF bindings (dOps, vpcC, av1C), the
 * QuickTime file format (sound sample description versions 1 and 2, the
 * wave atom) and the Matroska/EBML specification (RFC 8794, RFC 9559),
 * including block lacing. Codec strings follow the WebCodecs codec registry.
 *
 *   const movie = await VideoDemux.open(reader, { name })
 *   movie = { container: 'mp4'|'webm', brand, duration (s), tracks: [track] }
 *   track = { id, kind: 'video'|'audio', codec, fourcc, description?,
 *             width, height (as shown), codedWidth, codedHeight, rotation,
 *             sampleRate, channels, timescale, samples: [sample],
 *             codecDelayUs?, defaultDurationUs? }
 *   sample = { off, size, dts, pts, dur (microseconds), key }
 *   VideoDemux.read(reader, samples) → Promise<Uint8Array[]> (batched reads)
 *   VideoDemux.fileReader(file), VideoDemux.bufferReader(uint8array)
 *
 * Pictures are in decode order; `pts` is presentation time after the edit
 * list (MP4) or the block timecode (Matroska), so the first picture shown
 * is at (about) zero. Throws Error with a plain-English message for a file
 * that is neither family or is cut short.
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* readers                                                            */
  /* ------------------------------------------------------------------ */
  function fileReader(file) {
    return {
      size: file.size,
      async read(off, len) {
        const end = Math.min(file.size, off + len);
        if (end <= off) return new Uint8Array(0);
        return new Uint8Array(await file.slice(off, end).arrayBuffer());
      }
    };
  }
  function bufferReader(u8) {
    return { size: u8.length, async read(off, len) { return u8.subarray(off, Math.min(u8.length, off + len)); } };
  }

  /** Samples' bytes, reading neighbours together (up to 4 MB a read). */
  async function read(reader, samples) {
    const out = new Array(samples.length);
    let i = 0;
    while (i < samples.length) {
      let j = i, start = samples[i].off, end = start + samples[i].size;
      while (j + 1 < samples.length) {
        const n = samples[j + 1];
        if (n.off < end || n.off > end + 65536 || n.off + n.size - start > 4 * 1048576) break;
        end = n.off + n.size; j++;
      }
      const buf = await reader.read(start, end - start);
      if (buf.length < end - start) throw new Error('The file ends early: it may be cut short or still downloading.');
      for (let k = i; k <= j; k++) out[k] = buf.subarray(samples[k].off - start, samples[k].off - start + samples[k].size);
      i = j + 1;
    }
    return out;
  }

  const hex2 = (n) => (n < 16 ? '0' : '') + n.toString(16);
  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  const fourcc = (u, p) => String.fromCharCode(u[p], u[p + 1], u[p + 2], u[p + 3]);

  /* ------------------------------------------------------------------ */
  /* codec strings (WebCodecs codec registry)                           */
  /* ------------------------------------------------------------------ */
  function avcCodec(prefix, avcC) {
    if (!avcC || avcC.length < 4) return prefix;
    return prefix + '.' + hex2(avcC[1]) + hex2(avcC[2]) + hex2(avcC[3]);
  }
  function hevcCodec(prefix, h) {
    if (!h || h.length < 13) return prefix;
    const space = (h[1] >> 6) & 3, tier = (h[1] >> 5) & 1, profile = h[1] & 31;
    let compat = ((h[2] << 24) | (h[3] << 16) | (h[4] << 8) | h[5]) >>> 0;
    let rev = 0;
    for (let i = 0; i < 32; i++) { rev = (rev << 1) | (compat & 1); compat >>>= 1; }
    const cons = Array.from(h.subarray(6, 12));
    while (cons.length && cons[cons.length - 1] === 0) cons.pop();
    return prefix + '.' + ['', 'A', 'B', 'C'][space] + profile + '.' + (rev >>> 0).toString(16).toUpperCase() + '.' +
      (tier ? 'H' : 'L') + h[12] + cons.map((c) => '.' + c.toString(16).toUpperCase()).join('');
  }
  function vp9Codec(vpcC) {
    /* vpcC is a full box: version and flags first */
    if (!vpcC || vpcC.length < 7) return 'vp09.00.10.08';
    return 'vp09.' + pad2(vpcC[4]) + '.' + pad2(vpcC[5]) + '.' + pad2((vpcC[6] >> 4) & 15);
  }
  function av1Codec(c) {
    if (!c || c.length < 3) return 'av01.0.04M.08';
    const profile = (c[1] >> 5) & 7, level = c[1] & 31, tier = (c[2] >> 7) & 1;
    const depth = (c[2] >> 6) & 1 ? ((c[2] >> 5) & 1 ? 12 : 10) : 8;
    return 'av01.' + profile + '.' + pad2(level) + (tier ? 'H' : 'M') + '.' + pad2(depth);
  }
  /** VP9 from the first keyframe's uncompressed header, for a WebM that carries no CodecPrivate. */
  function vp9FromFrame(f) {
    if (!f || !f.length) return 'vp09.00.10.08';
    const b = f[0];
    const profile = ((b >> 4) & 1) | (((b >> 5) & 1) << 1);   /* frame_marker(2) profile_low_bit profile_high_bit, MSB first */
    return 'vp09.' + pad2(profile) + '.10.' + (profile >= 2 ? '10' : '08');
  }
  /** AudioSpecificConfig → { objectType, sampleRate, channels }. */
  function parseASC(a) {
    if (!a || a.length < 2) return null;
    let bit = 0;
    const bits = (n) => { let v = 0; for (let i = 0; i < n; i++, bit++) v = (v << 1) | ((a[bit >> 3] >> (7 - (bit & 7))) & 1); return v; };
    let ot = bits(5);
    if (ot === 31) ot = 32 + bits(6);
    const RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
    const fi = bits(4);
    const rate = fi === 15 ? bits(24) : RATES[fi];
    const ch = bits(4);
    return { objectType: ot, sampleRate: rate, channels: ch };
  }
  /** dOps (Opus in ISOBMFF, big-endian) → the OpusHead WebCodecs takes as the description (little-endian). */
  function opusHeadFromDOps(d) {
    if (!d || d.length < 11) return null;
    const family = d[10];
    const extra = family ? d.subarray(11) : new Uint8Array(0);
    const out = new Uint8Array(19 + extra.length);
    out.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0);   /* OpusHead */
    out[8] = 1; out[9] = d[1];
    out[10] = d[3]; out[11] = d[2];                                     /* pre-skip */
    out[12] = d[7]; out[13] = d[6]; out[14] = d[5]; out[15] = d[4];     /* input sample rate */
    out[16] = d[9]; out[17] = d[8];                                     /* output gain */
    out[18] = family;
    out.set(extra, 19);
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* ISO base media (MP4, MOV)                                          */
  /* ------------------------------------------------------------------ */
  function boxesIn(u, start, end) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    const out = [];
    let p = start;
    while (p + 8 <= end) {
      let size = dv.getUint32(p), hdr = 8;
      const type = fourcc(u, p + 4);
      if (size === 1) { if (p + 16 > end) break; size = Number(dv.getBigUint64(p + 8)); hdr = 16; }
      else if (size === 0) size = end - p;
      if (size < hdr || p + size > end) break;
      out.push({ type, start: p, end: p + size, body: p + hdr });
      p += size;
    }
    return out;
  }
  const child = (u, b, type) => boxesIn(u, b.body, b.end).find((x) => x.type === type) || null;
  const children = (u, b, type) => boxesIn(u, b.body, b.end).filter((x) => x.type === type);
  function path(u, b, types) {
    let cur = b;
    for (const t of types) { cur = cur && child(u, cur, t); if (!cur) return null; }
    return cur;
  }

  /** Top-level boxes of the file, read header by header. */
  async function topBoxes(reader) {
    const out = [];
    let p = 0;
    while (p + 8 <= reader.size) {
      const h = await reader.read(p, 16);
      if (h.length < 8) break;
      const dv = new DataView(h.buffer, h.byteOffset, h.byteLength);
      let size = dv.getUint32(0), hdr = 8;
      const type = fourcc(h, 4);
      if (!/^[\x20-\x7e©]{4}$/.test(type)) break;
      if (size === 1) { size = Number(dv.getBigUint64(8)); hdr = 16; }
      else if (size === 0) size = reader.size - p;
      if (size < hdr) break;
      out.push({ type, start: p, size, hdr });
      p += size;
    }
    return out;
  }

  function sampleEntry(u, stsd, kind) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    const entries = boxesIn(u, stsd.body + 8, stsd.end);
    const e = entries[0];
    if (!e) return null;
    const fmt = e.type;
    const r = { fourcc: fmt, entries: entries.length };
    if (kind === 'video') {
      r.codedWidth = dv.getUint16(e.body + 24); r.codedHeight = dv.getUint16(e.body + 26);
      const kids = boxesIn(u, e.body + 78, e.end);
      const k = (t) => { const b = kids.find((x) => x.type === t); return b ? u.slice(b.body, b.end) : null; };
      if (fmt === 'avc1' || fmt === 'avc3') { r.description = k('avcC'); r.codec = avcCodec(fmt, r.description); }
      else if (fmt === 'hvc1' || fmt === 'hev1') { r.description = k('hvcC'); r.codec = hevcCodec(fmt, r.description); }
      else if (fmt === 'vp09') { r.codec = vp9Codec(k('vpcC')); }
      else if (fmt === 'vp08') { r.codec = 'vp8'; }
      else if (fmt === 'av01') { const c = k('av1C'); r.codec = av1Codec(c); r.description = c && c.length > 4 ? c : null; }
      else r.codec = null;
      const pasp = k('pasp');
      if (pasp && pasp.length >= 8) {
        const pv = new DataView(pasp.buffer, pasp.byteOffset, 8);
        const h = pv.getUint32(0), v = pv.getUint32(4);
        if (h && v && h !== v) r.pixelAspect = h / v;
      }
    } else {
      const version = dv.getUint16(e.body + 8);
      r.channels = dv.getUint16(e.body + 16);
      r.sampleSize = dv.getUint16(e.body + 18);
      r.sampleRate = dv.getUint32(e.body + 24) >>> 16;
      let kidsAt = e.body + 28;
      if (version === 1) kidsAt += 16;
      else if (version === 2) {
        kidsAt = e.body + 28 + 36;
        r.sampleRate = Math.round(dv.getFloat64(e.body + 32));
        r.channels = dv.getUint32(e.body + 40);
      }
      let kids = boxesIn(u, kidsAt, e.end);
      const wave = kids.find((x) => x.type === 'wave');
      if (wave) kids = kids.concat(boxesIn(u, wave.body, wave.end));
      const k = (t) => { const b = kids.find((x) => x.type === t); return b ? u.slice(b.body, b.end) : null; };
      if (fmt === 'mp4a') {
        const es = parseEsds(k('esds'));
        if (es && es.oti === 0x40 && es.dsi) {
          const asc = parseASC(es.dsi);
          r.description = es.dsi;
          r.codec = 'mp4a.40.' + (asc ? asc.objectType : 2);
          if (asc && asc.sampleRate) r.ascRate = asc.sampleRate;
          if (asc && asc.channels) r.channels = asc.channels;
        } else if (es && (es.oti === 0x6b || es.oti === 0x69)) r.codec = 'mp3';
        else if (es && (es.oti === 0x66 || es.oti === 0x67 || es.oti === 0x68) && es.dsi) { r.description = es.dsi; r.codec = 'mp4a.67'; }
        else r.codec = null;
      } else if (fmt === 'Opus') { r.description = opusHeadFromDOps(k('dOps')); r.codec = 'opus'; r.sampleRate = 48000; }
      else if (fmt === '.mp3') r.codec = 'mp3';
      else if (fmt === 'fLaC') { const d = k('dfLa'); r.codec = 'flac'; if (d) { const fl = new Uint8Array(4 + d.length - 4); fl.set([0x66, 0x4c, 0x61, 0x43]); fl.set(d.subarray(4), 4); r.description = fl; } }
      else if (fmt === 'ulaw') r.codec = 'ulaw';
      else if (fmt === 'alaw') r.codec = 'alaw';
      else if (fmt === 'sowt' || fmt === 'twos' || fmt === 'lpcm' || fmt === 'in24' || fmt === 'raw ') r.codec = 'pcm-' + fmt.trim();
      else r.codec = null;
    }
    return r;
  }
  function parseEsds(b) {
    if (!b || b.length < 6) return null;
    let p = 4;   /* full box version and flags */
    const out = {};
    const len = () => { let n = 0; for (let i = 0; i < 4; i++) { const c = b[p++]; n = (n << 7) | (c & 0x7f); if (!(c & 0x80)) break; } return n; };
    const walk = (end) => {
      while (p + 2 <= end) {
        const tag = b[p++];
        const n = len();
        const stop = Math.min(end, p + n);
        if (tag === 3) {
          p += 2; const flags = b[p++];
          if (flags & 0x80) p += 2;
          if (flags & 0x40) p += 1 + b[p];
          if (flags & 0x20) p += 2;
          walk(stop);
        } else if (tag === 4) {
          out.oti = b[p]; p += 13;
          walk(stop);
        } else if (tag === 5) { out.dsi = b.slice(p, stop); }
        p = stop;
      }
    };
    walk(b.length);
    return out;
  }

  function rotationOf(u, tkhd) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    const v = u[tkhd.body];
    const m = tkhd.body + (v === 1 ? 4 + 8 + 8 + 4 + 4 + 8 : 4 + 4 + 4 + 4 + 4 + 4) + 8 + 2 + 2 + 2 + 2;
    const a = dv.getInt32(m) / 65536, b = dv.getInt32(m + 4) / 65536;
    const deg = Math.round(Math.atan2(b, a) * 180 / Math.PI);
    return ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
  }

  function trakInfo(u, trak, movieScale) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    const tkhd = child(u, trak, 'tkhd');
    const mdia = child(u, trak, 'mdia');
    if (!tkhd || !mdia) return null;
    const tv = u[tkhd.body];
    const id = dv.getUint32(tkhd.body + (tv === 1 ? 20 : 12));
    const hdlr = child(u, mdia, 'hdlr');
    const handler = hdlr ? fourcc(u, hdlr.body + 8) : '';
    const kind = handler === 'vide' ? 'video' : handler === 'soun' ? 'audio' : null;
    const mdhd = child(u, mdia, 'mdhd');
    const mv = u[mdhd.body];
    const timescale = dv.getUint32(mdhd.body + (mv === 1 ? 20 : 12));
    const stbl = path(u, mdia, ['minf', 'stbl']);
    const t = { id, kind, handler, timescale, stbl, samples: [] };
    if (!kind || !stbl) return t;
    const stsd = child(u, stbl, 'stsd');
    Object.assign(t, stsd ? sampleEntry(u, stsd, kind) : {});
    if (kind === 'video') {
      t.rotation = rotationOf(u, tkhd);
      let w = t.codedWidth, h = t.codedHeight;
      if (t.pixelAspect) w = Math.round(w * t.pixelAspect);
      if (t.rotation === 90 || t.rotation === 270) { const x = w; w = h; h = x; }
      t.width = w; t.height = h;
    }
    /* the edit list: an empty first edit delays the track; the first real edit's media time is where it starts */
    t.shift = 0;
    const elst = path(u, trak, ['edts', 'elst']);
    if (elst) {
      const ev = u[elst.body];
      const n = dv.getUint32(elst.body + 4);
      let p = elst.body + 8, lead = 0;
      for (let i = 0; i < n; i++) {
        const segDur = ev === 1 ? Number(dv.getBigUint64(p)) : dv.getUint32(p);
        const mediaTime = ev === 1 ? Number(dv.getBigInt64(p + 8)) : dv.getInt32(p + 4);
        p += ev === 1 ? 20 : 12;
        if (mediaTime === -1) { lead += segDur / movieScale; continue; }
        t.shift = lead - mediaTime / timescale;
        break;
      }
    }
    return t;
  }

  /** The sample table (stts, ctts, stss, stsz, stsc, stco) as a list. */
  function tableSamples(u, t) {
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    const s = t.stbl;
    const stsz = child(u, s, 'stsz'), stz2 = child(u, s, 'stz2');
    let sizes = [];
    if (stsz) {
      const fixed = dv.getUint32(stsz.body + 4), n = dv.getUint32(stsz.body + 8);
      for (let i = 0; i < n; i++) sizes.push(fixed || dv.getUint32(stsz.body + 12 + i * 4));
    } else if (stz2) {
      const fs = u[stz2.body + 7], n = dv.getUint32(stz2.body + 8);
      for (let i = 0; i < n; i++) {
        if (fs === 16) sizes.push(dv.getUint16(stz2.body + 12 + i * 2));
        else if (fs === 8) sizes.push(u[stz2.body + 12 + i]);
        else sizes.push((u[stz2.body + 12 + (i >> 1)] >> (i & 1 ? 0 : 4)) & 15);
      }
    }
    const n = sizes.length;
    if (!n) return [];
    const offsets = [];
    const stco = child(u, s, 'stco'), co64 = child(u, s, 'co64');
    if (stco) { const k = dv.getUint32(stco.body + 4); for (let i = 0; i < k; i++) offsets.push(dv.getUint32(stco.body + 8 + i * 4)); }
    else if (co64) { const k = dv.getUint32(co64.body + 4); for (let i = 0; i < k; i++) offsets.push(Number(dv.getBigUint64(co64.body + 8 + i * 8))); }
    const stsc = child(u, s, 'stsc');
    const runs = [];
    if (stsc) { const k = dv.getUint32(stsc.body + 4); for (let i = 0; i < k; i++) runs.push([dv.getUint32(stsc.body + 8 + i * 12), dv.getUint32(stsc.body + 12 + i * 12)]); }
    const out = new Array(n);
    let si = 0;
    for (let r = 0; r < runs.length && si < n; r++) {
      const first = runs[r][0], per = runs[r][1];
      const lastChunk = r + 1 < runs.length ? runs[r + 1][0] - 1 : offsets.length;
      for (let c = first; c <= lastChunk && si < n; c++) {
        let off = offsets[c - 1];
        for (let k = 0; k < per && si < n; k++) { out[si] = { off, size: sizes[si] }; off += sizes[si]; si++; }
      }
    }
    if (si < n) throw new Error('The video’s sample table is incomplete: the file may be damaged.');
    /* decode times */
    const stts = child(u, s, 'stts');
    let dts = 0, i = 0;
    if (stts) {
      const k = dv.getUint32(stts.body + 4);
      for (let e = 0; e < k; e++) {
        const cnt = dv.getUint32(stts.body + 8 + e * 8), d = dv.getUint32(stts.body + 12 + e * 8);
        for (let c = 0; c < cnt && i < n; c++, i++) { out[i].dtsT = dts; out[i].durT = d; dts += d; }
      }
    }
    for (; i < n; i++) { out[i].dtsT = dts; out[i].durT = 0; }
    const ctts = child(u, s, 'ctts');
    i = 0;
    if (ctts) {
      const cv = u[ctts.body];
      const k = dv.getUint32(ctts.body + 4);
      for (let e = 0; e < k; e++) {
        const cnt = dv.getUint32(ctts.body + 8 + e * 8);
        const off = cv === 1 ? dv.getInt32(ctts.body + 12 + e * 8) : dv.getUint32(ctts.body + 12 + e * 8);
        for (let c = 0; c < cnt && i < n; c++, i++) out[i].ctsT = out[i].dtsT + off;
      }
    }
    for (; i < n; i++) out[i].ctsT = out[i].dtsT;
    const stss = child(u, s, 'stss');
    if (stss) {
      for (const x of out) x.key = false;
      const k = dv.getUint32(stss.body + 4);
      for (let e = 0; e < k; e++) { const at = dv.getUint32(stss.body + 8 + e * 4) - 1; if (out[at]) out[at].key = true; }
    } else for (const x of out) x.key = true;
    return out;
  }

  async function openMP4(reader, tops) {
    const moovBox = tops.find((b) => b.type === 'moov');
    if (!moovBox) throw new Error('This MP4 has no index (moov box): it may be cut short, or still being recorded.');
    if (moovBox.size > 512 * 1048576) throw new Error('This file’s index is too large to read.');
    const u = await reader.read(moovBox.start, moovBox.size);
    const moov = { type: 'moov', start: 0, end: u.length, body: moovBox.hdr };
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    const mvhd = child(u, moov, 'mvhd');
    const movieScale = mvhd ? dv.getUint32(mvhd.body + (u[mvhd.body] === 1 ? 20 : 12)) : 1000;
    const ftyp = tops.find((b) => b.type === 'ftyp');
    let brand = '';
    if (ftyp) { const f = await reader.read(ftyp.start + ftyp.hdr, 4); brand = fourcc(f, 0); }
    const traks = children(u, moov, 'trak').map((tb) => trakInfo(u, tb, movieScale)).filter(Boolean);
    const trex = {};
    const mvex = child(u, moov, 'mvex');
    if (mvex) for (const tx of children(u, mvex, 'trex')) {
      trex[dv.getUint32(tx.body + 4)] = { dur: dv.getUint32(tx.body + 12), size: dv.getUint32(tx.body + 16), flags: dv.getUint32(tx.body + 20) };
    }
    for (const t of traks) if (t.stbl && t.kind) t.raw = tableSamples(u, t);
    const moofs = tops.filter((b) => b.type === 'moof');
    if (moofs.length) {
      for (const t of traks) { t.raw = t.raw || []; t.nextDts = t.raw.length ? t.raw[t.raw.length - 1].dtsT + t.raw[t.raw.length - 1].durT : 0; }
      for (const mb of moofs) {
        const m = await reader.read(mb.start, mb.size);
        const mdv = new DataView(m.buffer, m.byteOffset, m.byteLength);
        const moof = { start: 0, end: m.length, body: mb.hdr };
        let prevEnd = mb.start;
        for (const traf of children(m, moof, 'traf')) {
          const tfhd = child(m, traf, 'tfhd');
          if (!tfhd) continue;
          const fl = mdv.getUint32(tfhd.body) & 0xffffff;
          const tid = mdv.getUint32(tfhd.body + 4);
          const t = traks.find((x) => x.id === tid);
          const def = Object.assign({ dur: 0, size: 0, flags: 0 }, trex[tid] || {});
          let q = tfhd.body + 8, base = null;
          if (fl & 0x1) { base = Number(mdv.getBigUint64(q)); q += 8; }
          if (fl & 0x2) q += 4;
          if (fl & 0x8) { def.dur = mdv.getUint32(q); q += 4; }
          if (fl & 0x10) { def.size = mdv.getUint32(q); q += 4; }
          if (fl & 0x20) { def.flags = mdv.getUint32(q); q += 4; }
          if (base === null) base = (fl & 0x20000) ? mb.start : prevEnd;
          const tfdt = child(m, traf, 'tfdt');
          if (t && tfdt) t.nextDts = m[tfdt.body] === 1 ? Number(mdv.getBigUint64(tfdt.body + 4)) : mdv.getUint32(tfdt.body + 4);
          for (const trun of children(m, traf, 'trun')) {
            const tv = m[trun.body];
            const tf = mdv.getUint32(trun.body) & 0xffffff;
            const count = mdv.getUint32(trun.body + 4);
            let r = trun.body + 8;
            let off = base;
            if (tf & 0x1) { off = base + mdv.getInt32(r); r += 4; }
            let firstFlags = null;
            if (tf & 0x4) { firstFlags = mdv.getUint32(r); r += 4; }
            for (let k = 0; k < count; k++) {
              const dur = tf & 0x100 ? mdv.getUint32((r += 4) - 4) : def.dur;
              const size = tf & 0x200 ? mdv.getUint32((r += 4) - 4) : def.size;
              let flags = tf & 0x400 ? mdv.getUint32((r += 4) - 4) : def.flags;
              if (k === 0 && firstFlags !== null) flags = firstFlags;
              const cto = tf & 0x800 ? (tv === 1 ? mdv.getInt32((r += 4) - 4) : mdv.getUint32((r += 4) - 4)) : 0;
              if (t) {
                const key = t.kind === 'audio' ? true : !(flags & 0x10000);
                t.raw.push({ off, size, dtsT: t.nextDts, durT: dur, ctsT: t.nextDts + cto, key });
                t.nextDts += dur;
              }
              off += size;
            }
            prevEnd = off;
          }
        }
      }
    }
    const tracks = [];
    for (const t of traks) {
      if (!t.kind || !t.raw) continue;
      const sc = t.timescale || 1;
      const us = (v) => Math.round(v * 1e6 / sc);
      const shiftUs = Math.round(t.shift * 1e6);
      t.samples = t.raw.map((x) => ({ off: x.off, size: x.size, dts: us(x.dtsT) + shiftUs, pts: us(x.ctsT) + shiftUs, dur: us(x.durT), key: !!x.key }));
      delete t.raw; delete t.stbl; delete t.nextDts;
      if (t.kind === 'audio' && t.ascRate && !t.sampleRate) t.sampleRate = t.ascRate;
      tracks.push(t);
    }
    let duration = 0;
    for (const t of tracks) {
      for (const s of t.samples) duration = Math.max(duration, (s.pts + s.dur) / 1e6);
    }
    return { container: 'mp4', brand, duration, tracks };
  }

  /* ------------------------------------------------------------------ */
  /* Matroska and WebM                                                  */
  /* ------------------------------------------------------------------ */
  const ID = {
    EBML: 0x1A45DFA3, DocType: 0x4282, Segment: 0x18538067, Info: 0x1549A966, TimecodeScale: 0x2AD7B1, Duration: 0x4489,
    Tracks: 0x1654AE6B, TrackEntry: 0xAE, TrackNumber: 0xD7, TrackType: 0x83, CodecID: 0x86, CodecPrivate: 0x63A2,
    DefaultDuration: 0x23E383, CodecDelay: 0x56AA, Video: 0xE0, Audio: 0xE1, PixelWidth: 0xB0, PixelHeight: 0xBA,
    DisplayWidth: 0x54B0, DisplayHeight: 0x54BA, SamplingFrequency: 0xB5, Channels: 0x9F, BitDepth: 0x6264,
    Cluster: 0x1F43B675, Timecode: 0xE7, SimpleBlock: 0xA3, BlockGroup: 0xA0, Block: 0xA1, BlockDuration: 0x9B,
    ReferenceBlock: 0xFB, ContentEncodings: 0x6D80
  };
  const LEVEL1 = new Set([0x1F43B675, 0x1C53BB6B, 0x1254C367, 0x1043A770, 0x1941A469, 0x114D9B74, 0x1549A966, 0x1654AE6B]);

  /** A window over the file that grows as the parser reads on. */
  function windowed(reader) {
    let base = 0, buf = new Uint8Array(0);
    return {
      size: reader.size,
      async ensure(pos, n) {
        n = Math.min(n, reader.size - pos);
        if (pos >= base && pos + n <= base + buf.length) return;
        const len = Math.max(n, 4 * 1048576);
        buf = await reader.read(pos, len); base = pos;
      },
      byte(pos) { return buf[pos - base]; },
      bytes(pos, n) { return buf.subarray(pos - base, pos - base + n); }
    };
  }
  async function readId(w, p) {
    await w.ensure(p, 4);
    const b = w.byte(p);
    const len = b >= 0x80 ? 1 : b >= 0x40 ? 2 : b >= 0x20 ? 3 : b >= 0x10 ? 4 : 0;
    if (!len) return null;
    let v = 0; for (let i = 0; i < len; i++) v = v * 256 + w.byte(p + i);
    return { id: v, len };
  }
  async function readSize(w, p) {
    await w.ensure(p, 8);
    const b = w.byte(p);
    let len = 1, mask = 0x80;
    while (len <= 8 && !(b & mask)) { len++; mask >>= 1; }
    if (len > 8) return null;
    let v = b & (mask - 1), allOnes = v === mask - 1;
    for (let i = 1; i < len; i++) { const x = w.byte(p + i); v = v * 256 + x; if (x !== 255) allOnes = false; }
    return { size: allOnes ? -1 : v, len };
  }
  function uint(u) { let v = 0; for (const x of u) v = v * 256 + x; return v; }
  function float(u) { const dv = new DataView(u.buffer, u.byteOffset, u.byteLength); return u.length === 4 ? dv.getFloat32(0) : u.length === 8 ? dv.getFloat64(0) : 0; }
  function vintAt(u, p) {
    const b = u[p];
    let len = 1, mask = 0x80;
    while (len <= 8 && !(b & mask)) { len++; mask >>= 1; }
    let v = b & (mask - 1);
    for (let i = 1; i < len; i++) v = v * 256 + u[p + i];
    return { v, len };
  }

  async function openMKV(reader) {
    const w = windowed(reader);
    const tracksByNum = {};
    let scale = 1e6, duration = 0, docType = '';
    const clusters = { tc: 0 };
    let p = 0;
    const end = reader.size;
    /* the stack of open masters: [id, end] (end -1 when the size is unknown) */
    const stack = [];
    let curTrack = null, group = null;
    const blocks = [];
    const masters = new Set([ID.EBML, ID.Segment, ID.Info, ID.Tracks, ID.TrackEntry, ID.Video, ID.Audio, ID.Cluster, ID.BlockGroup]);
    while (p < end) {
      while (stack.length && stack[stack.length - 1][1] >= 0 && p >= stack[stack.length - 1][1]) closeMaster(stack.pop()[0]);
      const idr = await readId(w, p);
      if (!idr) {
        if (stack.some((s) => s[0] === ID.Cluster)) break;   /* junk at the end of a live recording */
        throw new Error('This file is not a video this tool can read (it is not MP4, MOV or WebM).');
      }
      const sz = await readSize(w, p + idr.len);
      if (!sz) break;
      const id = idr.id, dataAt = p + idr.len + sz.len;
      /* an element of a higher level closes an open master of unknown size */
      if (LEVEL1.has(id)) while (stack.length && stack[stack.length - 1][0] !== ID.Segment) closeMaster(stack.pop()[0]);
      if (id === ID.Cluster || id === ID.BlockGroup || id === ID.SimpleBlock) { /* fine inside a cluster */ }
      if (masters.has(id)) {
        openMaster(id);
        stack.push([id, sz.size < 0 ? -1 : dataAt + sz.size]);
        p = dataAt;
        continue;
      }
      if (sz.size < 0) break;
      const top = stack.length ? stack[stack.length - 1][0] : 0;
      if (id === ID.SimpleBlock || id === ID.Block) {
        const head = Math.min(sz.size, 64 * 1024);
        await w.ensure(dataAt, head);
        const blk = parseBlockHead(w.bytes(dataAt, head), sz.size);
        blk.off = dataAt; blk.size = sz.size; blk.cluster = clusters.tc; blk.simple = id === ID.SimpleBlock;
        if (id === ID.Block && group) { group.block = blk; }
        else blocks.push(blk);
      } else if (top === ID.BlockGroup && group && (id === ID.BlockDuration || id === ID.ReferenceBlock)) {
        await w.ensure(dataAt, sz.size);
        if (id === ID.BlockDuration) group.duration = uint(w.bytes(dataAt, sz.size));
        else group.ref = true;
      } else if (sz.size <= 1048576 && (top === ID.EBML || top === ID.Info || top === ID.TrackEntry || top === ID.Video || top === ID.Audio || top === ID.Cluster)) {
        await w.ensure(dataAt, sz.size);
        const d = w.bytes(dataAt, sz.size);
        if (top === ID.EBML && id === ID.DocType) docType = String.fromCharCode.apply(null, Array.from(d));
        else if (top === ID.Info && id === ID.TimecodeScale) scale = uint(d);
        else if (top === ID.Info && id === ID.Duration) duration = float(d);
        else if (top === ID.Cluster && id === ID.Timecode) clusters.tc = uint(d);
        else if (curTrack) {
          if (id === ID.TrackNumber) curTrack.num = uint(d);
          else if (id === ID.TrackType) curTrack.type = uint(d);
          else if (id === ID.CodecID) curTrack.codecId = String.fromCharCode.apply(null, Array.from(d)).replace(/\0+$/, '');
          else if (id === ID.CodecPrivate) curTrack.priv = d.slice();
          else if (id === ID.DefaultDuration) curTrack.defDur = uint(d);
          else if (id === ID.CodecDelay) curTrack.codecDelay = uint(d);
          else if (id === ID.PixelWidth) curTrack.pw = uint(d);
          else if (id === ID.PixelHeight) curTrack.ph = uint(d);
          else if (id === ID.DisplayWidth) curTrack.dw = uint(d);
          else if (id === ID.DisplayHeight) curTrack.dh = uint(d);
          else if (id === ID.SamplingFrequency) curTrack.rate = float(d);
          else if (id === ID.Channels) curTrack.channels = uint(d);
          else if (id === ID.BitDepth) curTrack.bits = uint(d);
          else if (id === ID.ContentEncodings) curTrack.encoded = true;
        }
      } else if (id === ID.ContentEncodings && curTrack) curTrack.encoded = true;
      p = dataAt + sz.size;
    }
    while (stack.length) closeMaster(stack.pop()[0]);
    if (!docType && !Object.keys(tracksByNum).length) throw new Error('This file is not a video this tool can read (it is not MP4, MOV or WebM).');

    function openMaster(id) {
      if (id === ID.TrackEntry) curTrack = {};
      else if (id === ID.BlockGroup) group = {};
    }
    function closeMaster(id) {
      if (id === ID.TrackEntry && curTrack) { if (curTrack.num) tracksByNum[curTrack.num] = curTrack; curTrack = null; }
      else if (id === ID.BlockGroup && group) {
        if (group.block) { group.block.key = !group.ref; if (group.duration) group.block.durTC = group.duration; blocks.push(group.block); }
        group = null;
      }
    }

    /* the tracks, then each block's frames (a laced block holds several) */
    const tracks = [];
    const byNum = {};
    for (const t of Object.values(tracksByNum)) {
      const kind = t.type === 1 ? 'video' : t.type === 2 ? 'audio' : null;
      if (!kind) continue;
      const tr = { id: t.num, kind, fourcc: t.codecId || '', timescale: 1e9 / scale, samples: [], encoded: !!t.encoded };
      if (kind === 'video') {
        tr.codedWidth = t.pw || 0; tr.codedHeight = t.ph || 0;
        tr.width = t.dw && t.dh ? Math.round(t.pw * (t.dw / t.dh) / (t.pw / t.ph)) || t.pw : t.pw;
        tr.height = t.ph; tr.rotation = 0;
        const c = t.codecId;
        if (c === 'V_VP8') tr.codec = 'vp8';
        else if (c === 'V_VP9') tr.codec = t.priv && t.priv.length >= 3 ? null : null;
        else if (c === 'V_AV1') { tr.codec = av1Codec(t.priv); tr.description = t.priv && t.priv.length > 4 ? t.priv : null; }
        else if (c === 'V_MPEG4/ISO/AVC') { tr.description = t.priv; tr.codec = avcCodec('avc1', t.priv); }
        else if (c === 'V_MPEGH/ISO/HEVC') { tr.description = t.priv; tr.codec = hevcCodec('hvc1', t.priv); }
        else tr.codec = null;
        tr.vp9 = c === 'V_VP9';
      } else {
        tr.sampleRate = Math.round(t.rate || 8000); tr.channels = t.channels || 1; tr.bits = t.bits || 0;
        const c = t.codecId;
        if (c === 'A_OPUS') { tr.codec = 'opus'; tr.description = t.priv || null; tr.sampleRate = 48000; }
        else if (c === 'A_VORBIS') { tr.codec = 'vorbis'; tr.description = t.priv || null; }
        else if (c === 'A_AAC' || /^A_AAC\//.test(c)) { tr.description = t.priv || null; const asc = parseASC(t.priv); tr.codec = 'mp4a.40.' + (asc ? asc.objectType : 2); if (asc && asc.sampleRate) tr.sampleRate = asc.sampleRate; }
        else if (c === 'A_FLAC') { tr.codec = 'flac'; tr.description = t.priv || null; }
        else if (c === 'A_MPEG/L3') tr.codec = 'mp3';
        else if (c === 'A_PCM/INT/LIT') tr.codec = 'pcm-sowt';
        else if (c === 'A_PCM/FLOAT/IEEE') tr.codec = 'pcm-float';
        else tr.codec = null;
      }
      if (t.codecDelay) tr.codecDelayUs = Math.round(t.codecDelay / 1000);
      if (t.defDur) tr.defaultDurationUs = Math.round(t.defDur / 1000);
      byNum[t.num] = tr;
      tracks.push(tr);
    }
    const tcUs = scale / 1000;
    for (const b of blocks) {
      const tr = byNum[b.track];
      if (!tr) continue;
      const t0 = Math.round((b.cluster + b.rel) * tcUs);
      const frames = b.frames;
      const per = tr.defaultDurationUs || 0;
      for (let k = 0; k < frames.length; k++) {
        const pts = t0 + k * per;
        tr.samples.push({ off: b.off + frames[k][0], size: frames[k][1], dts: pts, pts, dur: 0, key: tr.kind === 'audio' ? true : (b.simple ? b.key : b.key !== false), durTC: b.durTC });
      }
    }
    for (const tr of tracks) {
      const s = tr.samples;
      /* Matroska stores presentation order for audio and for video without B-frames; decode order is the block order. */
      if (tr.kind === 'video') {
        const sorted = s.map((x) => x.pts).sort((a, b) => a - b);
        for (let i = 0; i < s.length; i++) s[i].dts = Math.min(s[i].pts, sorted[i]);
      }
      const order = s.slice().sort((a, b) => a.pts - b.pts);
      for (let i = 0; i < order.length; i++) {
        const x = order[i];
        if (x.durTC) x.dur = Math.round(x.durTC * tcUs);
        else if (i + 1 < order.length) x.dur = Math.max(0, order[i + 1].pts - x.pts);
        else x.dur = tr.defaultDurationUs || (i > 0 ? order[i].pts - order[i - 1].pts : 0);
        delete x.durTC;
      }
      if (tr.vp9) {
        delete tr.vp9;
        const first = s.find((x) => x.key);
        let head = null;
        if (first) head = await reader.read(first.off, Math.min(first.size, 16));
        tr.codec = vp9FromFrame(head);
      }
    }
    let dur = duration ? duration * tcUs / 1e6 : 0;
    if (!dur) for (const t of tracks) for (const s of t.samples) dur = Math.max(dur, (s.pts + s.dur) / 1e6);
    return { container: docType === 'webm' ? 'webm' : 'mkv', brand: docType, duration: dur, tracks };
  }

  /** A block's header: track, timecode (relative to its cluster), flags and each laced frame as [offset in block, size]. */
  function parseBlockHead(u, total) {
    const tn = vintAt(u, 0);
    let p = tn.len;
    const rel = (u[p] << 24 >> 16) | u[p + 1];
    const flags = u[p + 2];
    p += 3;
    const lacing = (flags >> 1) & 3;
    const out = { track: tn.v, rel, key: !!(flags & 0x80), frames: [] };
    if (!lacing) { out.frames.push([p, total - p]); return out; }
    const n = u[p++] + 1;
    const sizes = [];
    if (lacing === 1) {          /* Xiph */
      for (let i = 0; i < n - 1; i++) { let s = 0, b; do { b = u[p++]; s += b; } while (b === 255); sizes.push(s); }
    } else if (lacing === 3) {   /* EBML */
      let first = vintAt(u, p); p += first.len; sizes.push(first.v);
      for (let i = 1; i < n - 1; i++) {
        const d = vintAt(u, p); p += d.len;
        const bias = Math.pow(2, 7 * d.len - 1) - 1;
        sizes.push(sizes[i - 1] + (d.v - bias));
      }
    } else {                     /* fixed */
      const each = Math.floor((total - p) / n);
      for (let i = 0; i < n - 1; i++) sizes.push(each);
    }
    const used = sizes.reduce((a, b) => a + b, 0);
    sizes.push(total - p - used);
    let q = p;
    for (const s of sizes) { out.frames.push([q, s]); q += s; }
    return out;
  }

  /* ------------------------------------------------------------------ */
  async function open(reader, opt) {
    opt = opt || {};
    if (!reader || !reader.size) throw new Error('The file is empty.');
    const head = await reader.read(0, 12);
    if (head.length >= 4 && head[0] === 0x1A && head[1] === 0x45 && head[2] === 0xDF && head[3] === 0xA3) return openMKV(reader);
    const tops = await topBoxes(reader);
    if (tops.length && tops.some((b) => b.type === 'moov' || b.type === 'ftyp' || b.type === 'mdat')) return openMP4(reader, tops);
    throw new Error('This file is not a video this tool can read (it is not MP4, MOV or WebM).');
  }

  const api = { open, read, fileReader, bufferReader, parseASC, opusHeadFromDOps, avcCodec, hevcCodec, av1Codec, vp9FromFrame, parseBlockHead, parseEsds };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VideoDemux = api;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : null));
