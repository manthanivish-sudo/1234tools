/**
 * Test files for the image tools, built byte by byte here (never with the
 * site's own imagecore), so a test of the metadata reader or remover checks
 * it against something it did not make:
 *
 *   exifTiff(orientation)        an EXIF block (big-endian TIFF): Make
 *                                DemoCam, Orientation, GPS 44°6'30.6"S
 *                                170°9'15"E — the layout claims/kit.js uses
 *   heicWithExif(tiff, w, h)     a HEIF file (ftyp heic) whose only item is
 *                                that EXIF, located by iloc in an mdat, with
 *                                an ispe of w×h; no picture, which is the
 *                                point: a browser cannot decode it either way
 *   pngWithExif(png, tiff)       a PNG with an eXIf chunk after IHDR
 *   webpWithExif(webp, tiff, w, h)  a simple (VP8) WebP turned extended: VP8X
 *                                with the EXIF flag, the image chunk, EXIF
 *   ase(list) is NOT here: the palette test parses an .ase file instead.
 */
'use strict';

function exifTiff(orientation) {
  const t = [];
  const u16 = (v) => t.push(v >> 8, v & 255);
  const u32 = (v) => t.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  const make = Buffer.from('DemoCam\0', 'latin1');
  t.push(0x4d, 0x4d); u16(42); u32(8);
  u16(3);
  u16(0x010f); u16(2); u32(make.length); u32(50);
  u16(0x0112); u16(3); u32(1); u16(orientation || 1); u16(0);
  u16(0x8825); u16(4); u32(1); u32(58);
  u32(0);
  for (const c of make) t.push(c);
  u16(4);
  u16(1); u16(2); u32(2); t.push(0x53, 0, 0, 0);
  u16(2); u16(5); u32(3); u32(112);
  u16(3); u16(2); u32(2); t.push(0x45, 0, 0, 0);
  u16(4); u16(5); u32(3); u32(136);
  u32(0);
  [[44, 1], [6, 1], [3060, 100], [170, 1], [9, 1], [1500, 100]].forEach(([n, d]) => { u32(n); u32(d); });
  return Buffer.from(t);
}

const box = (type, ...parts) => {
  const body = Buffer.concat(parts);
  const h = Buffer.alloc(8);
  h.writeUInt32BE(8 + body.length, 0); h.write(type, 4, 'latin1');
  return Buffer.concat([h, body]);
};
const full = (type, version, flags, ...parts) => {
  const vf = Buffer.alloc(4); vf.writeUInt32BE(((version & 255) << 24) | (flags & 0xffffff), 0);
  return box(type, vf, ...parts);
};
const u16b = (v) => { const b = Buffer.alloc(2); b.writeUInt16BE(v); return b; };
const u32b = (v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v); return b; };

function heicWithExif(tiff, w, h) {
  const ftyp = box('ftyp', Buffer.from('heic', 'latin1'), u32b(0), Buffer.from('mif1heic', 'latin1'));
  const hdlr = full('hdlr', 0, 0, u32b(0), Buffer.from('pict', 'latin1'), Buffer.alloc(12), Buffer.from('\0', 'latin1'));
  /* infe version 2: item_ID (16), protection index (16), item_type, name '\0' */
  const infe = full('infe', 2, 0, u16b(1), u16b(0), Buffer.from('Exif', 'latin1'), Buffer.from('\0', 'latin1'));
  const iinf = full('iinf', 0, 0, u16b(1), infe);
  const ispe = full('ispe', 0, 0, u32b(w), u32b(h));
  const iprp = box('iprp', box('ipco', ispe), full('ipma', 0, 0, u32b(1), u16b(1), Buffer.from([1]), Buffer.from([0x81])));
  const payload = Buffer.concat([u32b(0), tiff]);              // the EXIF item: 4 bytes saying the TIFF header starts at once
  /* iloc version 0: offset_size 4, length_size 4, base_offset_size 0; one item, one extent at an absolute offset */
  const mkIloc = (off) => full('iloc', 0, 0, Buffer.from([0x44, 0x00]), u16b(1), u16b(1), u16b(0), u16b(1), u32b(off), u32b(payload.length));
  const metaOf = (off) => full('meta', 0, 0, hdlr, mkIloc(off), iinf, iprp);
  const size = ftyp.length + metaOf(0).length + 8;
  return Buffer.concat([ftyp, metaOf(size), box('mdat', payload)]);
}

const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let r = 0xffffffff; for (const x of buf) r = CRC[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
function pngChunk(type, data) {
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  return Buffer.concat([u32b(data.length), td, u32b(crc32(td))]);
}
function pngWithExif(png, tiff) {
  const ihdrEnd = 8 + 12 + png.readUInt32BE(8);
  return Buffer.concat([png.slice(0, ihdrEnd), pngChunk('eXIf', tiff), png.slice(ihdrEnd)]);
}
function webpWithExif(webp, tiff, w, h) {
  /* the image chunks (ALPH, VP8, VP8L) of the source, whether it was simple or already extended */
  const keep = [];
  let alpha = false;
  for (let i = 12; i + 8 <= webp.length;) {
    const type = webp.slice(i, i + 4).toString('latin1'), len = webp.readUInt32LE(i + 4), end = i + 8 + len + (len & 1);
    if (type === 'ALPH' || type === 'VP8 ' || type === 'VP8L') keep.push(webp.slice(i, Math.min(end, webp.length)));
    if (type === 'ALPH') alpha = true;
    i = end;
  }
  const first = Buffer.concat(keep);
  const le32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
  const le24 = (v) => Buffer.from([v & 255, (v >> 8) & 255, (v >> 16) & 255]);
  const chunk = (type, data) => Buffer.concat([Buffer.from(type, 'latin1'), le32(data.length), data, data.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  const vp8x = chunk('VP8X', Buffer.concat([Buffer.from([0x08 | (alpha ? 0x10 : 0), 0, 0, 0]), le24(w - 1), le24(h - 1)]));
  const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), vp8x, first, chunk('EXIF', tiff)]);
  return Buffer.concat([Buffer.from('RIFF', 'latin1'), le32(body.length), body]);
}

module.exports = { exifTiff, heicWithExif, pngWithExif, webpWithExif, crc32 };
