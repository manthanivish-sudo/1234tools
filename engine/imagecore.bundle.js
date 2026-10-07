(function(){
/**
 * Image utilities — the parts that are pure functions and therefore testable
 * outside a browser. Canvas work lives in render-image.js; everything here
 * operates on bytes, strings or pixel arrays.
 */

/* ============================================================
   EXIF — parse the APP1 segment of a JPEG
   ============================================================ */

const EXIF_TAGS = {
  0x010f: 'Make', 0x0110: 'Model', 0x0112: 'Orientation',
  0x011a: 'XResolution', 0x011b: 'YResolution', 0x0128: 'ResolutionUnit',
  0x0131: 'Software', 0x0132: 'DateTime', 0x013b: 'Artist',
  0x8298: 'Copyright', 0x8769: 'ExifIFDPointer', 0x8825: 'GPSInfoIFDPointer',
  0x829a: 'ExposureTime', 0x829d: 'FNumber', 0x8827: 'ISOSpeedRatings',
  0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized',
  0x920a: 'FocalLength', 0x9209: 'Flash', 0xa002: 'PixelXDimension',
  0xa003: 'PixelYDimension', 0xa430: 'CameraOwnerName',
  0xa431: 'BodySerialNumber', 0xa433: 'LensMake', 0xa434: 'LensModel',
  0xa435: 'LensSerialNumber', 0x9286: 'UserComment', 0x010e: 'ImageDescription',
  0x8822: 'ExposureProgram', 0x9202: 'ApertureValue', 0x9204: 'ExposureBiasValue',
  0x9207: 'MeteringMode', 0xa001: 'ColorSpace', 0xa403: 'WhiteBalance',
  0xa405: 'FocalLengthIn35mmFilm', 0x9010: 'OffsetTime', 0x9011: 'OffsetTimeOriginal',
  0xa432: 'LensSpecification', 0x9000: 'ExifVersion'
};

const GPS_TAGS = {
  0x0000: 'GPSVersionID', 0x0001: 'GPSLatitudeRef', 0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef', 0x0004: 'GPSLongitude', 0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude', 0x0007: 'GPSTimeStamp', 0x001d: 'GPSDateStamp',
  0x000c: 'GPSSpeedRef', 0x000d: 'GPSSpeed', 0x0010: 'GPSImgDirectionRef', 0x0011: 'GPSImgDirection'
};

const ORIENTATION = {
  1: 'Normal', 2: 'Mirrored horizontally', 3: 'Rotated 180°',
  4: 'Mirrored vertically', 5: 'Mirrored and rotated 90° CCW',
  6: 'Rotated 90° CW', 7: 'Mirrored and rotated 90° CW',
  8: 'Rotated 90° CCW'
};

/**
 * Extract EXIF from a JPEG.
 * @param {Uint8Array} bytes
 * @returns {{found:boolean, tags:Object, gps:Object|null, warnings:string[]}}
 */
/* Where a file's EXIF (a TIFF structure) starts: in a JPEG the APP1
   "Exif" segment, in a TIFF the file itself, in a PNG the eXIf chunk, in a
   WebP the EXIF chunk, in a HEIC or AVIF the Exif item. */
function exifLocation(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i < bytes.length - 4) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      if (marker === 0xda) break;                     // start of scan — no more metadata
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker === 0xe1 &&
          bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78 &&
          bytes[i + 6] === 0x69 && bytes[i + 7] === 0x66) {
        return { bytes, at: i + 10 };                  // skip "Exif\0\0"
      }
      i += 2 + len;
    }
    return null;
  }
  const kind = containerOf(bytes);
  if (kind === 'tiff') return { bytes, at: 0 };
  if (!kind) return null;
  const m = extractMetadata(bytes);
  return m.exif ? { bytes: m.exif, at: 0 } : null;
}

function readExif(bytes) {
  const out = { found: false, tags: {}, gps: null, warnings: [] };
  if (!bytes || bytes.length < 4) return out;
  if (!containerOf(bytes)) {
    out.warnings.push('Not a format this viewer reads metadata from: it reads JPEG, PNG, WebP, HEIC, AVIF and TIFF.');
    return out;
  }
  const loc = exifLocation(bytes);
  if (!loc || loc.at + 8 > loc.bytes.length) return out;
  bytes = loc.bytes;

  const tiff = loc.at;
  const b0 = bytes[tiff], b1 = bytes[tiff + 1];
  let little;
  if (b0 === 0x49 && b1 === 0x49) little = true;
  else if (b0 === 0x4d && b1 === 0x4d) little = false;
  else { out.warnings.push('EXIF header found but the byte order marker is invalid.'); return out; }

  const u16 = (o) => little ? (bytes[o] | (bytes[o + 1] << 8)) : ((bytes[o] << 8) | bytes[o + 1]);
  const u32 = (o) => little
    ? ((bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0)
    : (((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0);

  if (u16(tiff + 2) !== 0x002a) { out.warnings.push('EXIF TIFF header is malformed.'); return out; }

  const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

  function readValue(entry) {
    const type = u16(entry + 2);
    const count = u32(entry + 4);
    const size = (SIZES[type] || 1) * count;
    const at = size > 4 ? tiff + u32(entry + 8) : entry + 8;
    if (at < 0 || at + size > bytes.length) return null;

    if (type === 2) {                                  // ASCII
      let s = '';
      for (let k = 0; k < count && bytes[at + k] !== 0; k++) s += String.fromCharCode(bytes[at + k]);
      return s.trim();
    }
    if (type === 3) return count === 1 ? u16(at) : Array.from({ length: count }, (_, k) => u16(at + k * 2));
    if (type === 4) return count === 1 ? u32(at) : Array.from({ length: count }, (_, k) => u32(at + k * 4));
    if (type === 5 || type === 10) {                   // rational
      const vals = [];
      for (let k = 0; k < count; k++) {
        const n = u32(at + k * 8), d = u32(at + k * 8 + 4);
        vals.push(d === 0 ? 0 : n / d);
      }
      return count === 1 ? vals[0] : vals;
    }
    if (type === 1 || type === 6 || type === 7) {
      return count === 1 ? bytes[at] : Array.from({ length: Math.min(count, 64) }, (_, k) => bytes[at + k]);
    }
    return null;
  }

  function readIFD(offset, dict, target) {
    if (offset < 0 || offset + 2 > bytes.length) return -1;
    const n = u16(offset);
    if (n > 512) return -1;                            // implausible; treat as corrupt
    for (let e = 0; e < n; e++) {
      const entry = offset + 2 + e * 12;
      if (entry + 12 > bytes.length) break;
      const tag = u16(entry);
      const name = dict[tag];
      if (!name) continue;
      const v = readValue(entry);
      if (v !== null && v !== '') target[name] = v;
    }
    return u32(offset + 2 + n * 12);
  }

  const ifd0 = tiff + u32(tiff + 4);
  const next = readIFD(ifd0, EXIF_TAGS, out.tags);
  out.found = Object.keys(out.tags).length > 0;

  if (out.tags.ExifIFDPointer) {
    readIFD(tiff + out.tags.ExifIFDPointer, EXIF_TAGS, out.tags);
    delete out.tags.ExifIFDPointer;
  }
  if (out.tags.GPSInfoIFDPointer) {
    const gps = {};
    readIFD(tiff + out.tags.GPSInfoIFDPointer, GPS_TAGS, gps);
    delete out.tags.GPSInfoIFDPointer;
    if (Object.keys(gps).length) {
      out.gps = gps;
      const dms = (a) => Array.isArray(a) && a.length === 3 ? a[0] + a[1] / 60 + a[2] / 3600 : null;
      const lat = dms(gps.GPSLatitude), lon = dms(gps.GPSLongitude);
      if (lat !== null && lon !== null) {
        out.gps.latitude = gps.GPSLatitudeRef === 'S' ? -lat : lat;
        out.gps.longitude = gps.GPSLongitudeRef === 'W' ? -lon : lon;
      }
      out.found = true;
    }
  }

  if (out.tags.Orientation) {
    out.tags.OrientationLabel = ORIENTATION[out.tags.Orientation] || String(out.tags.Orientation);
  }
  return out;
}

/** Count metadata segments in a JPEG — used to show what stripping removed. */
function metadataSegments(bytes) {
  const found = [];
  if (!bytes || bytes[0] !== 0xff || bytes[1] !== 0xd8) return found;
  let i = 2;
  while (i < bytes.length - 4) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const m = bytes[i + 1];
    if (m === 0xda) break;
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (m === 0xe1) {
      const isExif = bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78;
      found.push({ name: isExif ? 'EXIF' : 'XMP', bytes: len });
    } else if (m === 0xed) found.push({ name: 'IPTC / Photoshop', bytes: len });
    else if (m === 0xe2) found.push({ name: 'ICC colour profile', bytes: len });
    else if (m === 0xfe) found.push({ name: 'Comment', bytes: len });
    else if (m >= 0xe0 && m <= 0xef) found.push({ name: 'APP' + (m - 0xe0), bytes: len });
    i += 2 + len;
  }
  return found;
}

/* ============================================================
   PDF — minimal writer that embeds JPEGs without re-encoding
   ============================================================ */

/**
 * Build a PDF from JPEG byte arrays, one image per page.
 * JPEGs are embedded with /DCTDecode: the bytes given go into the file as
 * they are, so the PDF adds no compression of its own and needs no
 * compressor to ship. Whether those bytes are the original file or a fresh
 * encode is the caller's choice (render-image.js passes an original JPEG
 * through whenever it can).
 *
 * @param {Array<{bytes:Uint8Array,width:number,height:number,
 *   colorSpace?:'DeviceRGB'|'DeviceGray', icc?:Uint8Array}>} images
 *   icc, when given, is the JPEG's own ICC profile, embedded as an
 *   /ICCBased colour space so a Display P3 phone photo keeps its colours.
 * @param {{pageSize?:string, margin?:number, orientation?:string}} opts
 * @returns {Uint8Array}
 */
function buildPDF(images, opts = {}) {
  const PAGE = {
    a4:     [595.28, 841.89],
    letter: [612, 792],
    legal:  [612, 1008],
    a5:     [419.53, 595.28],
    fit:    null
  };
  const margin = opts.margin === undefined ? 28 : Number(opts.margin);
  const enc = (s) => {
    const a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xff;
    return a;
  };

  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (data) => {
    const a = typeof data === 'string' ? enc(data) : data;
    chunks.push(a);
    length += a.length;
  };
  const startObj = (n) => { offsets[n] = length; push(`${n} 0 obj\n`); };
  const endObj = () => push('endobj\n');

  /* an ICC v4 profile wants PDF 1.6 or later; v2 is fine in 1.4 */
  const v4 = images.some((im) => im.icc && im.icc.length > 8 && im.icc[8] >= 4);
  push((v4 ? '%PDF-1.6' : '%PDF-1.4') + '\n%\xE2\xE3\xCF\xD3\n');

  const n = images.length;
  // 1 catalog, 2 pages, then per image: page, content, xobject, and its ICC profile if it has one
  const pageIds = [], contentIds = [], imgIds = [], iccIds = [], maskIds = [];
  let nextId = 3;
  for (let i = 0; i < n; i++) {
    pageIds.push(nextId++);
    contentIds.push(nextId++);
    imgIds.push(nextId++);
    const comps = images[i].colorSpace === 'DeviceGray' ? 1 : 3;
    const icc = images[i].icc;
    iccIds.push(icc && icc.length > 128 && iccChannels(icc) === comps ? nextId++ : 0);
    maskIds.push(images[i].smask ? nextId++ : 0);
  }

  startObj(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\n');
  endObj();

  startObj(2);
  push(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${n} >>\n`);
  endObj();

  images.forEach((img, i) => {
    let pw, ph;
    const base = PAGE[opts.pageSize || 'a4'];
    /* a page turned a quarter shows the image on its side: its width and height swap */
    const rot = ((Number(img.rotate) || 0) % 360 + 360) % 360;
    const iw = rot % 180 ? img.height : img.width, ih = rot % 180 ? img.width : img.height;
    if (!base) {                                  // "fit": page matches the image
      pw = iw; ph = ih;
    } else if (opts.orientation === 'landscape' ||
              (opts.orientation === 'auto' && iw > ih)) {
      pw = base[1]; ph = base[0];
    } else {
      pw = base[0]; ph = base[1];
    }

    const availW = Math.max(1, pw - margin * 2);
    const availH = Math.max(1, ph - margin * 2);
    /* fit: all of the image inside the margins; fill: the margin box covered, the overflow cut off */
    const fill = !!base && (img.fill || opts.fill === 'fill');
    const scale = base ? (fill ? Math.max(availW / iw, availH / ih) : Math.min(availW / iw, availH / ih)) : 1;
    const dw = iw * scale, dh = ih * scale;
    const dx = (pw - dw) / 2, dy = (ph - dh) / 2;
    const f2 = (v) => v.toFixed(2);
    const cm = rot === 90 ? `0 ${f2(-dh)} ${f2(dw)} 0 ${f2(dx)} ${f2(dy + dh)}`
      : rot === 180 ? `${f2(-dw)} 0 0 ${f2(-dh)} ${f2(dx + dw)} ${f2(dy + dh)}`
      : rot === 270 ? `0 ${f2(dh)} ${f2(-dw)} 0 ${f2(dx + dw)} ${f2(dy)}`
      : `${f2(dw)} 0 0 ${f2(dh)} ${f2(dx)} ${f2(dy)}`;
    const clip = fill ? `${f2(margin)} ${f2(margin)} ${f2(availW)} ${f2(availH)} re W n\n` : '';

    startObj(pageIds[i]);
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] ` +
         `/Resources << /XObject << /Im0 ${imgIds[i]} 0 R >> >> /Contents ${contentIds[i]} 0 R >>\n`);
    endObj();

    const stream = `q\n${clip}${cm} cm\n/Im0 Do\nQ\n`;
    startObj(contentIds[i]);
    push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream\n`);
    endObj();

    const device = img.colorSpace === 'DeviceGray' ? 'DeviceGray' : 'DeviceRGB';
    const cs = iccIds[i] ? `[/ICCBased ${iccIds[i]} 0 R]` : '/' + device;
    /* a JPEG's own bytes (DCTDecode), or pixels compressed losslessly
       (FlateDecode, with PNG row filters when predictor is set) and their
       transparency as a soft mask */
    const flate = img.filter === 'FlateDecode';
    const comps = device === 'DeviceGray' ? 1 : 3;
    const parms = flate && img.predictor ? ` /DecodeParms << /Predictor 15 /Colors ${comps} /BitsPerComponent 8 /Columns ${img.width} >>` : '';
    startObj(imgIds[i]);
    push(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} ` +
         `/ColorSpace ${cs} /BitsPerComponent 8 /Filter /${flate ? 'FlateDecode' : 'DCTDecode'}${parms}` +
         (maskIds[i] ? ` /SMask ${maskIds[i]} 0 R` : '') + ` /Length ${img.bytes.length} >>\nstream\n`);
    push(img.bytes);
    push('\nendstream\n');
    endObj();

    if (maskIds[i]) {
      const m = img.smask;
      const mp = m.predictor ? ` /DecodeParms << /Predictor 15 /Colors 1 /BitsPerComponent 8 /Columns ${img.width} >>` : '';
      startObj(maskIds[i]);
      push(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode${mp} /Length ${m.bytes.length} >>\nstream\n`);
      push(m.bytes);
      push('\nendstream\n');
      endObj();
    }

    if (iccIds[i]) {
      startObj(iccIds[i]);
      push(`<< /N ${device === 'DeviceGray' ? 1 : 3} /Alternate /${device} /Length ${img.icc.length} >>\nstream\n`);
      push(img.icc);
      push('\nendstream\n');
      endObj();
    }
  });

  const xrefStart = length;
  const total = nextId - 1;
  push(`xref\n0 ${total + 1}\n`);
  push('0000000000 65535 f \n');
  for (let i = 1; i <= total; i++) {
    push(String(offsets[i] || 0).padStart(10, '0') + ' 00000 n \n');
  }
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}

/**
 * PNG row filtering (the adaptive choice of None, Sub, Up, Average and
 * Paeth per row, by the smallest sum of absolute values), the step before
 * deflate that a PDF's /Predictor 15 undoes. data: rows of width × channels
 * bytes. Returns the filtered bytes, one filter-type byte before each row.
 */
function pngFilterRows(data, width, height, channels) {
  const stride = width * channels;
  const out = new Uint8Array((stride + 1) * height);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  const at = (t, y, i) => {
    const row = y * stride, prev = row - stride;
    const x = data[row + i];
    const a = i >= channels ? data[row + i - channels] : 0;
    const b = y ? data[prev + i] : 0;
    const c = y && i >= channels ? data[prev + i - channels] : 0;
    return (t === 0 ? x : t === 1 ? x - a : t === 2 ? x - b : t === 3 ? x - ((a + b) >> 1) : x - paeth(a, b, c)) & 255;
  };
  for (let y = 0; y < height; y++) {
    let best = 0, bestSum = Infinity;
    for (let t = 0; t < 5; t++) {
      let sum = 0;
      for (let i = 0; i < stride && sum < bestSum; i++) { const v = at(t, y, i); sum += v < 128 ? v : 256 - v; }
      if (sum < bestSum) { bestSum = sum; best = t; }
    }
    const o = y * (stride + 1);
    out[o] = best;
    for (let i = 0; i < stride; i++) out[o + 1 + i] = at(best, y, i);
  }
  return out;
}

/** Read width/height from a JPEG's SOF marker — needed to size PDF pages. */
function jpegSize(bytes) {
  if (!bytes || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i < bytes.length - 8) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const m = bytes[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd9)) { i += 2; continue; }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  return null;
}

/* ============================================================
   JPEG passthrough — what a PDF can carry as it is
   ============================================================ */

const ascii = (bytes, at, n) => {
  let s = '';
  for (let k = 0; k < n && at + k < bytes.length; k++) s += String.fromCharCode(bytes[at + k]);
  return s;
};

/** Walk a JPEG's marker segments up to the first start-of-scan. */
function jpegSegments(bytes) {
  const segs = [];
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i < bytes.length - 3) {
    if (bytes[i] !== 0xff) return null;                // not a marker where one must be: corrupt
    const m = bytes[i + 1];
    if (m === 0xff) { i++; continue; }                 // fill byte
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    segs.push({ marker: m, at: i, len, end: i + 2 + len });
    if (m === 0xda) break;
    i += 2 + len;
  }
  return segs;
}

/**
 * What a JPEG is made of, as far as embedding it in a PDF untouched is
 * concerned: size, coding process, sample precision, channel count, the
 * EXIF orientation, and whether it can go in as it is.
 */
function jpegInfo(bytes) {
  const segs = jpegSegments(bytes);
  if (!segs) return null;
  const info = { width: 0, height: 0, components: 0, precision: 0, sof: 0, orientation: 1, adobe: null, passthrough: false, why: '' };
  for (const s of segs) {
    const m = s.marker;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && !info.sof) {
      info.sof = m;
      info.precision = bytes[s.at + 4];
      info.height = (bytes[s.at + 5] << 8) | bytes[s.at + 6];
      info.width = (bytes[s.at + 7] << 8) | bytes[s.at + 8];
      info.components = bytes[s.at + 9];
    }
    if (m === 0xee && ascii(bytes, s.at + 4, 5) === 'Adobe') info.adobe = { transform: bytes[s.at + 15] };
  }
  const ex = readExif(bytes);
  if (ex.tags && ex.tags.Orientation) info.orientation = ex.tags.Orientation;
  const seen = segs.some((s) => s.marker === 0xda);
  if (!info.sof || !seen) info.why = 'no image data found';
  else if ([0xc0, 0xc1, 0xc2].indexOf(info.sof) < 0) info.why = 'arithmetic or lossless coding, which PDF readers do not all decode';
  else if (info.precision !== 8) info.why = info.precision + '-bit samples';
  else if (info.components !== 3 && info.components !== 1) info.why = info.components === 4 ? 'CMYK colour' : info.components + ' colour channels';
  else if (info.orientation !== 1) info.why = 'turned by its EXIF orientation tag';
  else info.passthrough = true;
  return info;
}

/** The ICC profile a JPEG carries in its APP2 "ICC_PROFILE" segments, joined in order, or null. */
function jpegICC(bytes) {
  const segs = jpegSegments(bytes);
  if (!segs) return null;
  const parts = [];
  for (const s of segs) {
    if (s.marker !== 0xe2 || ascii(bytes, s.at + 4, 12) !== 'ICC_PROFILE\0') continue;
    parts.push({ seq: bytes[s.at + 16], data: bytes.subarray(s.at + 18, s.end) });
  }
  if (!parts.length) return null;
  parts.sort((a, b) => a.seq - b.seq);
  const n = parts.reduce((t, p) => t + p.data.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p.data, o); o += p.data.length; }
  return out;
}

/** Channels an ICC profile describes: 3 for RGB, 1 for grey, 4 for CMYK, 0 if unknown. */
function iccChannels(icc) {
  const cs = ascii(icc, 16, 4);
  return cs === 'RGB ' ? 3 : cs === 'GRAY' ? 1 : cs === 'CMYK' ? 4 : 0;
}

/** True when an ICC profile names itself sRGB (its description, in ASCII or UTF-16). */
function iccIsSRGB(icc) {
  if (!icc) return false;
  const s = ascii(icc, 0, Math.min(icc.length, 4096));
  return /sRGB/.test(s) || /s\0R\0G\0B/.test(s);
}

/**
 * A copy of a JPEG with the segments that can identify a person or a
 * device taken out — EXIF and XMP (APP1), IPTC (APP13), comments, maker
 * blocks in APP3–APP12 and APP15, and anything after the end-of-image
 * marker (phones append preview and depth images there) — and the image
 * data itself byte for byte as it was. JFIF (APP0), the ICC profile (APP2)
 * and Adobe's colour-transform marker (APP14) stay: a decoder needs them.
 * Returns the very same array when there was nothing to take out.
 */
function stripJpegMetadata(bytes) {
  const segs = jpegSegments(bytes);
  if (!segs) return bytes;
  const keepSeg = (s) => {
    const m = s.marker;
    if (m === 0xe0 || m === 0xee) return true;
    if (m === 0xe2) return ascii(bytes, s.at + 4, 12) === 'ICC_PROFILE\0';
    if (m === 0xfe || (m >= 0xe1 && m <= 0xef)) return false;
    return true;
  };
  const sos = segs[segs.length - 1];
  if (!sos || sos.marker !== 0xda) return bytes;
  /* the first FF D9 after the scan header ends the image: inside entropy-coded
     data every FF is followed by 00 or a restart marker */
  let eoi = bytes.length;
  for (let k = sos.end; k < bytes.length - 1; k++) {
    if (bytes[k] === 0xff && bytes[k + 1] === 0xd9) { eoi = k + 2; break; }
  }
  const dropped = segs.filter((s) => !keepSeg(s));
  if (!dropped.length && eoi === bytes.length) return bytes;
  const out = new Uint8Array(bytes.length);
  out[0] = 0xff; out[1] = 0xd8;
  let o = 2;
  for (const s of segs) {
    if (!keepSeg(s)) continue;
    const end = s === sos ? eoi : s.end;
    out.set(bytes.subarray(s.at, end), o); o += end - s.at;
  }
  return out.slice(0, o);
}

/* ============================================================
   What metadata a file carries — read from its bytes
   ============================================================ */

/**
 * Every metadata block in a JPEG, PNG or WebP, sorted into what can say
 * something about a person or a device (`personal`) and what only tells a
 * decoder how to show the pixels (`technical`). Used to report what a
 * cleaned file really contains, rather than to assume it.
 * @returns {{format:string, personal:string[], technical:string[]}}
 */
function metadataReport(bytes) {
  const rep = { format: 'unknown', personal: [], technical: [] };
  const add = (list, name) => { if (rep[list].indexOf(name) < 0) rep[list].push(name); };
  if (!bytes || bytes.length < 12) return rep;

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    rep.format = 'JPEG';
    const segs = jpegSegments(bytes) || [];
    for (const s of segs) {
      const m = s.marker;
      if (m === 0xe0) add('technical', ascii(bytes, s.at + 4, 4) === 'JFIF' ? 'standard JFIF header' : 'APP0 header');
      else if (m === 0xe1) {
        if (ascii(bytes, s.at + 4, 4) === 'Exif') {
          add('personal', 'EXIF');
          const ex = readExif(bytes);
          if (ex.gps) add('personal', 'GPS');
        } else add('personal', 'XMP');
      } else if (m === 0xe2) {
        if (ascii(bytes, s.at + 4, 12) === 'ICC_PROFILE\0') add('technical', iccIsSRGB(jpegICC(bytes)) ? 'sRGB colour profile' : 'colour profile');
        else add('personal', 'APP2 block');
      } else if (m === 0xed) add('personal', 'IPTC / Photoshop');
      else if (m === 0xee) add('technical', 'Adobe colour marker');
      else if (m === 0xfe) add('personal', 'comment');
      else if (m >= 0xe3 && m <= 0xef) add('personal', 'APP' + (m - 0xe0) + ' block');
    }
    return rep;
  }

  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') {
    rep.format = 'PNG';
    let i = 8;
    while (i + 8 <= bytes.length) {
      const len = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
      const type = ascii(bytes, i + 4, 4);
      if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') add('personal', 'text chunks');
      else if (type === 'eXIf') add('personal', 'EXIF');
      else if (type === 'tIME') add('personal', 'time stamp');
      else if (type === 'iCCP') add('technical', 'colour profile');
      else if (type === 'sRGB') add('technical', 'sRGB colour tag');
      else if (type === 'gAMA' || type === 'cHRM') add('technical', 'gamma and colour values');
      else if (type === 'pHYs') add('technical', 'print resolution');
      if (type === 'IEND') break;
      i += 12 + len;
    }
    return rep;
  }

  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    rep.format = 'WebP';
    let i = 12;
    while (i + 8 <= bytes.length) {
      const type = ascii(bytes, i, 4);
      const len = (bytes[i + 4] | (bytes[i + 5] << 8) | (bytes[i + 6] << 16) | (bytes[i + 7] << 24)) >>> 0;
      if (type === 'EXIF') add('personal', 'EXIF');
      else if (type === 'XMP ') add('personal', 'XMP');
      else if (type === 'ICCP') add('technical', 'colour profile');
      i += 8 + len + (len & 1);
    }
  }
  return rep;
}

/** One line for a person: what is (and is not) left in a cleaned file. */
function metadataSummary(rep) {
  const join = (l) => l.length > 1 ? l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1] : l[0];
  if (rep.personal.length) return 'Still present: ' + join(rep.personal);
  return 'No EXIF, GPS or camera data; ' + (rep.technical.length ? join(rep.technical) + ' kept' : 'no other metadata either');
}

/* ============================================================
   Print resolution — so a file prints at the size it was made for
   ============================================================ */

let CRC_TABLE = null;
function crc32(bytes, from, to) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = from; i < to; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Write a print resolution into an encoded JPEG (the JFIF APP0 density, in
 * dots per inch) or PNG (a pHYs chunk, in pixels per metre: 300 DPI is
 * round(300 / 0.0254) = 11,811). The pixels are not touched. Other formats
 * come back unchanged.
 */
function setDPI(bytes, dpi) {
  dpi = Math.max(1, Math.min(65535, Math.round(dpi)));
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    if (bytes[2] === 0xff && bytes[3] === 0xe0 && ascii(bytes, 6, 5) === 'JFIF\0') {
      const out = bytes.slice();
      out[13] = 1;                                         // units: dots per inch
      out[14] = dpi >> 8; out[15] = dpi & 0xff;
      out[16] = dpi >> 8; out[17] = dpi & 0xff;
      return out;
    }
    const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, dpi >> 8, dpi & 0xff, dpi >> 8, dpi & 0xff, 0x00, 0x00];
    const out = new Uint8Array(bytes.length + app0.length);
    out.set(bytes.subarray(0, 2), 0); out.set(app0, 2); out.set(bytes.subarray(2), 2 + app0.length);
    return out;
  }
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') {
    const ppm = Math.round(dpi / 0.0254);
    const parts = [bytes.subarray(0, 8)];
    let i = 8, placed = false;
    while (i + 8 <= bytes.length) {
      const len = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
      const type = ascii(bytes, i + 4, 4);
      const end = i + 12 + len;
      if (type !== 'pHYs') parts.push(bytes.subarray(i, end));
      if (type === 'IHDR' && !placed) {
        const c = new Uint8Array(21);
        c[3] = 9;
        c.set([0x70, 0x48, 0x59, 0x73], 4);              // "pHYs"
        for (const at of [8, 12]) { c[at] = ppm >>> 24; c[at + 1] = (ppm >>> 16) & 0xff; c[at + 2] = (ppm >>> 8) & 0xff; c[at + 3] = ppm & 0xff; }
        c[16] = 1;                                         // unit: metre
        const crc = crc32(c, 4, 17);
        c[17] = crc >>> 24; c[18] = (crc >>> 16) & 0xff; c[19] = (crc >>> 8) & 0xff; c[20] = crc & 0xff;
        parts.push(c);
        placed = true;
      }
      if (type === 'IEND') break;
      i = end;
    }
    const n = parts.reduce((t, p) => t + p.length, 0);
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  return bytes;
}

/** The print resolution a JPEG or PNG declares, in DPI (rounded to 0.01), or null. */
function readDPI(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const segs = jpegSegments(bytes) || [];
    const s = segs.find((x) => x.marker === 0xe0 && ascii(bytes, x.at + 4, 5) === 'JFIF\0');
    if (!s) return null;
    const unit = bytes[s.at + 11], x = (bytes[s.at + 12] << 8) | bytes[s.at + 13], y = (bytes[s.at + 14] << 8) | bytes[s.at + 15];
    if (unit === 1) return { x, y };
    if (unit === 2) return { x: Math.round(x * 254) / 100, y: Math.round(y * 254) / 100 };
    return null;
  }
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') {
    let i = 8;
    while (i + 8 <= bytes.length) {
      const len = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
      const type = ascii(bytes, i + 4, 4);
      if (type === 'pHYs' && bytes[i + 16] === 1) {
        const u32 = (o) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
        return { x: Math.round(u32(i + 8) * 0.0254 * 100) / 100, y: Math.round(u32(i + 12) * 0.0254 * 100) / 100 };
      }
      if (type === 'IEND' || type === 'IDAT') break;
      i += 12 + len;
    }
  }
  return null;
}

/* ============================================================
   Colour palette — median cut, deterministic and testable
   ============================================================ */

/**
 * Extract a palette from RGBA pixel data using median cut.
 * Deterministic, unlike k-means with random seeding, so the same image
 * always yields the same palette.
 *
 * @param {Uint8ClampedArray|Array} rgba
 * @param {number} count  palette size (rounded up to a power of two internally)
 */
function medianCut(rgba, count = 6) {
  const pixels = [];
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 125) continue;                   // ignore transparent
    pixels.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  }
  if (!pixels.length) return [];

  let boxes = [pixels];
  while (boxes.length < count) {
    // split the box with the widest single channel
    let bestIdx = -1, bestRange = -1, bestChannel = 0;
    boxes.forEach((box, idx) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255, hi = 0;
        for (const p of box) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
        if (hi - lo > bestRange) { bestRange = hi - lo; bestIdx = idx; bestChannel = c; }
      }
    });
    if (bestIdx < 0 || bestRange <= 0) break;

    const box = boxes[bestIdx];
    box.sort((a, b) => a[bestChannel] - b[bestChannel]);

    /* Classic median cut splits at the halfway *pixel count*, which merges
       two distinct colours whenever their populations are unequal — 20 blue
       and 30 green pixels come back as one muddy blue-green. Splitting at
       the largest gap along the channel instead keeps distinct colours
       apart, and still falls back to the median when the data is a smooth
       gradient with no real boundary. */
    let cut = Math.floor(box.length / 2), widest = -1;
    for (let k = 1; k < box.length; k++) {
      const gap = box[k][bestChannel] - box[k - 1][bestChannel];
      if (gap > widest) { widest = gap; cut = k; }
    }
    if (widest < 8) cut = Math.floor(box.length / 2);   // no real boundary
    if (cut === 0 || cut === box.length) cut = Math.floor(box.length / 2);

    boxes.splice(bestIdx, 1, box.slice(0, cut), box.slice(cut));
  }

  return boxes.filter(b => b.length).map(box => {
    let r = 0, g = 0, b = 0;
    for (const p of box) { r += p[0]; g += p[1]; b += p[2]; }
    const n = box.length;
    return {
      r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n),
      share: n / pixels.length
    };
  }).sort((a, b) => b.share - a.share);
}

const toHex = ({ r, g, b }) =>
  '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');

function relLuminance({ r, g, b }) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/* The same maths as the site's Colour Converter & Contrast Checker
   (engine/dev-color-converter.js): HSL rounded to whole degrees and
   percentages, and the WCAG 2 contrast ratio (L1 + 0.05) / (L2 + 0.05). */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function contrastRatio(a, b) {
  const l1 = relLuminance(a), l2 = relLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** WCAG 2 grade for normal text: AAA at 7:1, AA at 4.5:1, "AA large" (large text only) at 3:1. */
const wcagGrade = (ratio) => ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'fail';

/* ============================================================
   SVG optimiser — text transforms, no parser dependency
   ============================================================ */

/**
 * The ids an SVG refers to from inside itself, which must survive any
 * clean-up: url(#id) in attributes and styles (gradients, clip paths, masks,
 * filters, markers), href / xlink:href="#id" (<use>, <textPath>, animation
 * targets), aria-labelledby / aria-describedby (often a <title>'s id),
 * SMIL begin/end timing such as "fade.end", and any #id selector in a
 * <style> block.
 */
function referencedIds(svg) {
  const keep = new Set();
  const add = (v) => { if (v) keep.add(v); };
  let m;
  const url = /url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g;
  while ((m = url.exec(svg))) add(m[1]);
  const href = /\s(?:xlink:)?href\s*=\s*["']#([^"']+)["']/g;
  while ((m = href.exec(svg))) add(m[1]);
  const aria = /\saria-(?:labelledby|describedby)\s*=\s*["']([^"']+)["']/g;
  while ((m = aria.exec(svg))) m[1].split(/\s+/).forEach(add);
  const timing = /\s(?:begin|end)\s*=\s*["']([^"']+)["']/g;
  while ((m = timing.exec(svg))) {
    const t = /([A-Za-z_][\w.-]*?)\.(?:begin|end|repeat|click|mouse\w*|focus\w*)/g;
    let k;
    while ((k = t.exec(m[1]))) add(k[1]);
  }
  const style = /<style[^>]*>([\s\S]*?)<\/style>/g;
  while ((m = style.exec(svg))) {
    const sel = /#([A-Za-z_][\w-]*)/g;
    let k;
    while ((k = sel.exec(m[1]))) add(k[1]);
  }
  return keep;
}

/* Markup tokens for the SVG optimiser's tag scanner: comments, CDATA,
   processing instructions, DOCTYPE, end tags (group 1: name) and start tags
   (group 2: name, group 3: attributes, group 4: "/" when self-closed). It
   walks the tags in order with a stack of open element names; it does not
   build a tree. */
const SVG_TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^\[>]*(?:\[[\s\S]*?\]\s*)?>|<\/([A-Za-z_][\w.:-]*)\s*>|<([A-Za-z_][\w.:-]*)((?:\s+[^\s=\/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
const SVG_START_TAG = /<([A-Za-z_][\w.:-]*)((?:\s+[^\s=\/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)(\s*\/?>)/g;

/* Namespaces only editors read: Inkscape, Sodipodi, Sketch, Illustrator,
   Serif (Affinity), Krita, and the RDF / Dublin Core / Creative Commons
   vocabularies of a <metadata> block. Matched by URI, so whatever prefix a
   file binds them to is caught, and by the usual prefix names as well. */
const SVG_EDITOR_NS = [
  'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd', 'http://www.inkscape.org/namespaces/inkscape',
  'http://www.bohemiancoding.com/sketch/ns', 'http://www.serif.com/', 'http://krita.org/namespaces/svg/krita',
  'http://ns.adobe.com/AdobeIllustrator/10.0/', 'http://ns.adobe.com/Graphs/1.0/', 'http://ns.adobe.com/Variables/1.0/',
  'http://ns.adobe.com/SaveForWeb/1.0/', 'http://ns.adobe.com/Extensibility/1.0/', 'http://ns.adobe.com/AdobeSVGViewerExtensions/3.0/',
  'http://ns.adobe.com/ImageReplacement/1.0/', 'http://ns.adobe.com/GenericCustomNamespace/1.0/', 'http://ns.adobe.com/XPath/1.0/',
  'adobe:ns:meta/', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'http://purl.org/dc/elements/1.1/', 'http://creativecommons.org/ns#',
  'http://web.resource.org/cc/'
];
const SVG_EDITOR_PREFIXES = ['inkscape', 'sodipodi', 'sketch', 'illustrator', 'adobe', 'serif', 'krita', 'dc', 'cc', 'rdf'];

/* Remove whole elements, children and all, whether self-closed or not.
   test(name, attrs) picks them; returns [markup, how many went]. */
function svgRemoveElements(s, test) {
  let out = '', last = 0, count = 0, m;
  const skip = [];
  SVG_TOKEN.lastIndex = 0;
  while ((m = SVG_TOKEN.exec(s))) {
    if (!skip.length) out += s.slice(last, m.index);
    last = SVG_TOKEN.lastIndex;
    if (skip.length) {
      if (m[2] && !m[4]) skip.push(m[2]);
      else if (m[1]) {
        /* an end tag that does not close the open element means broken
           markup: change nothing rather than drop the wrong part */
        if (m[1] !== skip[skip.length - 1]) return [s, 0];
        skip.pop();
      }
      continue;
    }
    if (m[2] && test(m[2], m[3] || '')) { count++; if (!m[4]) skip.push(m[2]); continue; }
    out += m[0];
  }
  if (skip.length) return [s, 0];
  out += s.slice(last);
  return [out, count];
}

/* Remove empty <g> and <defs>: nothing inside but whitespace, and no id that
   something in the file points at. Their other attributes (transform, fill,
   class) have nothing to act on. An empty group inside <switch> stays,
   because <switch> would pick it and draw nothing instead of the next
   child. Groups that only held empty groups go too. */
function svgRemoveEmpty(s, keep) {
  const pieces = [], stack = [];
  let last = 0, count = 0, m;
  const top = () => stack[stack.length - 1];
  const filled = () => { const t = top(); if (t) t.empty = false; };
  const removable = (name, attrs) => {
    if (name !== 'g' && name !== 'defs') return false;
    const t = top(); if (t && t.name === 'switch') return false;
    const id = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(attrs);
    return !(id && keep.has(id[1] !== undefined ? id[1] : id[2]));
  };
  SVG_TOKEN.lastIndex = 0;
  while ((m = SVG_TOKEN.exec(s))) {
    const text = s.slice(last, m.index);
    if (text) { if (/\S/.test(text)) filled(); pieces.push(text); }
    last = SVG_TOKEN.lastIndex;
    if (m[2]) {
      if (m[4] && removable(m[2], m[3] || '')) { count++; continue; }
      const t = top(), was = t ? t.empty : true;
      filled();
      pieces.push(m[0]);
      if (!m[4]) stack.push({ name: m[2], attrs: m[3] || '', at: pieces.length - 1, empty: true, parentWas: was });
    } else if (m[1]) {
      const f = stack.pop();
      if (f && f.empty && removable(f.name, f.attrs)) {
        pieces.length = f.at; count++;
        const t = top(); if (t) t.empty = f.parentWas;
        continue;
      }
      pieces.push(m[0]);
    } else { filled(); pieces.push(m[0]); }
  }
  pieces.push(s.slice(last));
  return [pieces.join(''), count];
}

/**
 * Strip editor cruft and shrink an SVG.
 * Conservative by design: it never touches path geometry beyond rounding
 * coordinates, because aggressive path rewriting is where SVG optimisers
 * silently break artwork. It keeps every id something in the file points
 * at, and keeps <title>, which is what a screen reader announces; <desc> is
 * kept too unless it is an editor's "Created with …" line. The output stays
 * well-formed: an editor element goes whole (self-closed or not), and a
 * namespace declaration goes only when no element or attribute uses it.
 */
function optimiseSVG(src, opts = {}) {
  const precision = opts.precision === undefined ? 2 : Math.max(0, Math.min(8, Number(opts.precision)));
  const removed = [];
  let out = String(src);
  const before = out.length;

  const drop = (re, label) => {
    const hits = out.match(re);
    if (hits && hits.length) { removed.push(`${label} (${hits.length})`); out = out.replace(re, ''); }
  };
  const note = (n, label) => { if (n) removed.push(`${label} (${n})`); };

  drop(/<!--[\s\S]*?-->/g, 'comments');
  /* the XML declaration only: <?xml-stylesheet …?> links styling and stays */
  drop(/<\?xml\s[^>]*\?>\s*/g, 'XML declaration');
  /* A DOCTYPE can declare entities that the file then uses, as Illustrator
     does with xmlns="&ns_svg;". Those are written out in full first; if one
     cannot be (its text holds markup), the DOCTYPE stays. */
  {
    const dt = /<!DOCTYPE[^\[>]*(?:\[([\s\S]*?)\]\s*)?>\s*/.exec(out);
    if (dt) {
      const ents = {};
      let safe = true, e;
      const decl = /<!ENTITY\s+([A-Za-z_][\w.-]*)\s+(?:"([^"]*)"|'([^']*)')\s*>/g;
      while ((e = decl.exec(dt[1] || ''))) {
        const v = e[2] !== undefined ? e[2] : e[3];
        if (/[<&]/.test(v)) safe = false; else ents[e[1]] = v;
      }
      const rest = out.slice(dt.index + dt[0].length);
      if (safe) {
        const body = rest.replace(/&([A-Za-z_][\w.-]*);/g, (all, n) => Object.prototype.hasOwnProperty.call(ents, n) ? ents[n].replace(/"/g, '&quot;').replace(/'/g, '&apos;') : all);
        out = out.slice(0, dt.index) + body;
        removed.push('DOCTYPE (1)');
      }
    }
  }

  const junk = new Set(SVG_EDITOR_PREFIXES);
  {
    const ns = /\sxmlns:([A-Za-z_][\w.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let n;
    while ((n = ns.exec(out))) if (SVG_EDITOR_NS.indexOf(n[2] !== undefined ? n[2] : n[3]) >= 0) junk.add(n[1]);
  }
  const prefixOf = (name) => { const i = name.indexOf(':'); return i > 0 ? name.slice(0, i) : ''; };
  let r;
  r = svgRemoveElements(out, (name) => name === 'metadata' || name.endsWith(':metadata') && junk.has(prefixOf(name)));
  out = r[0]; note(r[1], 'metadata');
  drop(/<desc>\s*(?:Created with|Generator:)[^<]*<\/desc>/gi, 'editor desc');
  r = svgRemoveElements(out, (name) => junk.has(prefixOf(name)));
  out = r[0]; note(r[1], 'editor elements');
  {
    let n = 0;
    out = out.replace(SVG_START_TAG, (tag, name, attrs, end) => '<' + name + attrs.replace(/\s+([A-Za-z_][\w.-]*):[\w.-]+\s*=\s*(?:"[^"]*"|'[^']*')/g, (a, p) => {
      if (p === 'xmlns' || !junk.has(p)) return a;
      n++; return '';
    }) + end);
    note(n, 'editor attributes');
  }
  {
    /* every prefix still used by an element or attribute name */
    const used = new Set();
    let t;
    SVG_START_TAG.lastIndex = 0;
    while ((t = SVG_START_TAG.exec(out))) {
      if (prefixOf(t[1])) used.add(prefixOf(t[1]));
      const a = /\s([A-Za-z_][\w.-]*):[\w.-]+\s*=/g;
      let k;
      while ((k = a.exec(t[2]))) if (k[1] !== 'xmlns') used.add(k[1]);
    }
    let n = 0;
    out = out.replace(SVG_START_TAG, (tag, name, attrs, end) => '<' + name + attrs.replace(/\s+xmlns:([A-Za-z_][\w.-]*)\s*=\s*(?:"[^"]*"|'[^']*')/g, (a, p) => {
      if (!junk.has(p) || used.has(p)) return a;
      n++; return '';
    }) + end);
    note(n, 'unused namespaces');
  }
  drop(/\sdata-name="[^"]*"/g, 'data-name');
  /* An id goes only when nothing in the file refers to it: deleting the id of
     a gradient, clip path, mask or <use> target while url(#…) or href="#…"
     still points at it makes that part of the drawing vanish. */
  const keep = referencedIds(out);
  let unused = 0;
  out = out.replace(/\sid="([^"]*)"/g, (all, id) => {
    if (keep.has(id)) return all;
    unused++;
    return '';
  });
  if (unused) removed.push(`unreferenced ids (${unused})`);
  r = svgRemoveEmpty(out, keep);
  out = r[0]; note(r[1], 'empty elements');

  if (opts.roundCoords !== false) {
    const round = (m) => {
      const n = parseFloat(m);
      if (!isFinite(n)) return m;
      const r = Number(n.toFixed(precision));
      return String(r);
    };
    /* numbers are rounded inside tags (attribute values) only, so the text
       of a <title>, <desc>, <text> or <style> is never changed */
    out = out.replace(/<[A-Za-z][^>]*>/g, (tag) => tag
      .replace(/(\sd=")([^"]+)(")/g, (all, a, d, c) => a + d.replace(/-?\d+\.\d+/g, round) + c)
      .replace(/(?<=[\s",=(])-?\d+\.\d+/g, round));
  }

  /* Whitespace between tags goes, except inside <text> (a space between two
     <tspan>s is drawn; only the spacing inside its tags is tidied), <script>
     and CDATA, which are left exactly as they are. */
  const kept = [];
  out = out.replace(/<(text|script)(?:\s[^>]*?)?(?<!\/)>[\s\S]*?<\/\1\s*>|<!\[CDATA\[[\s\S]*?\]\]>/g, (b, el) => {
    if (el === 'text') b = b.replace(/<[A-Za-z][^>]*>/g, (tag) => tag.replace(/\s+/g, ' ').replace(/\s+(\/?>)$/, '$1'));
    kept.push(b); return '<\u0000' + (kept.length - 1) + '\u0000>';
  });
  out = out
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+(\/?>)/g, '$1')
    .replace(/;\s*"/g, '"')
    .trim()
    .replace(/<\u0000(\d+)\u0000>/g, (all, i) => kept[Number(i)]);

  return {
    output: out,
    before,
    after: out.length,
    saved: before - out.length,
    savedPct: before ? ((before - out.length) / before) * 100 : 0,
    removed,
    keptIds: [...keep].filter((id) => out.indexOf('id="' + id + '"') >= 0)
  };
}

/* ============================================================
   Social & print presets
   ============================================================ */

/* Each platform's recommended upload size as of SOCIAL_AS_OF. Platforms
   change these; the social media resizer shows the date beside them. */
const SOCIAL_AS_OF = '2026-10-06';
const SOCIAL_PRESETS = [
  { group: 'Instagram', name: 'Square post',      w: 1080, h: 1080 },
  { group: 'Instagram', name: 'Portrait post',    w: 1080, h: 1350 },
  { group: 'Instagram', name: 'Story / Reel',     w: 1080, h: 1920 },
  { group: 'Facebook',  name: 'Feed post',        w: 1200, h: 630 },
  { group: 'Facebook',  name: 'Cover photo',      w: 851,  h: 315 },
  { group: 'X',         name: 'Post image',       w: 1600, h: 900 },
  { group: 'X',         name: 'Header',           w: 1500, h: 500 },
  { group: 'LinkedIn',  name: 'Post image',       w: 1200, h: 627 },
  { group: 'LinkedIn',  name: 'Cover',            w: 1584, h: 396 },
  { group: 'YouTube',   name: 'Thumbnail',        w: 1280, h: 720 },
  { group: 'YouTube',   name: 'Channel art',      w: 2560, h: 1440 },
  { group: 'Pinterest', name: 'Standard pin',     w: 1000, h: 1500 },
  { group: 'TikTok',    name: 'Video cover',      w: 1080, h: 1920 },
  { group: 'WhatsApp',  name: 'Status',           w: 1080, h: 1920 },
  { group: 'Web',       name: 'Open Graph image', w: 1200, h: 630 },
  { group: 'Web',       name: 'Email header',     w: 600,  h: 200 }
];

const PHOTO_PRESETS = [
  { name: 'India passport / visa', w: 51, h: 51, unit: 'mm', dpi: 300 },
  { name: 'UK passport',           w: 35, h: 45, unit: 'mm', dpi: 300 },
  { name: 'US passport',           w: 51, h: 51, unit: 'mm', dpi: 300 },
  { name: 'Schengen visa',         w: 35, h: 45, unit: 'mm', dpi: 300 },
  { name: 'India PAN card',        w: 25, h: 35, unit: 'mm', dpi: 300 },
  { name: 'Stamp size',            w: 20, h: 25, unit: 'mm', dpi: 300 }
];

/* Pixels are whole, so a size in millimetres is rounded to the nearest
   pixel: 51 mm at 300 DPI is 602.36 px and becomes 602, which prints at
   50.97 mm; 35 mm is 413.39 → 413 (34.97 mm), 45 mm 531.50 → 531 (44.96 mm).
   No side is ever off by more than half a pixel, 0.04 mm at 300 DPI. */
const mmToPx = (mm, dpi) => Math.round((mm / 25.4) * dpi);
const pxToMm = (px, dpi) => px / dpi * 25.4;


/* ============================================================
   Containers and their metadata — read, edit and write back
   (wave 1, 2026-10-06). Pure functions on bytes, so the tests
   can check them in Node against independent readers.
   ============================================================ */

const u32be = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u32le = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const concatBytes = (parts) => {
  const n = parts.reduce((t, p) => t + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const latin1 = (s) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; };
const utf8Bytes = (s) => new TextEncoder().encode(s);
const utf8Text = (b) => new TextDecoder('utf-8').decode(b);

/** What kind of file the bytes are, from their signature: jpeg, png, webp,
 *  gif, bmp, tiff, heic, avif, ico, or '' when none of these. */
function containerOf(b) {
  if (!b || b.length < 12) return '';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'png';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
  if (ascii(b, 0, 3) === 'GIF') return 'gif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 42 && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 42)) return 'tiff';
  if (ascii(b, 4, 4) === 'ftyp') {
    const major = ascii(b, 8, 4);
    const brands = ascii(b, 8, Math.max(4, Math.min(64, u32be(b, 0)) - 8));
    if (major === 'avif' || major === 'avis') return 'avif';
    if (/heic|heix|hevc|hevx|heim|heis/.test(brands)) return 'heic';
    if (/avif/.test(brands)) return 'avif';
    if (major === 'mif1' || major === 'msf1') return 'heic';
  }
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'ico';
  return '';
}

const MIME_OF = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
  tiff: 'image/tiff', heic: 'image/heic', avif: 'image/avif', ico: 'image/x-icon' };
/** The MIME type the bytes really are, or ''. */
const mimeOf = (b) => MIME_OF[containerOf(b)] || '';
const EXT_OF = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/bmp': 'bmp',
  'image/tiff': 'tif', 'image/heic': 'heic', 'image/avif': 'avif', 'image/x-icon': 'ico' };
/** The file extension for a MIME type, without the dot. */
const extOf = (mime) => EXT_OF[mime] || 'bin';

/* ---- ISOBMFF (HEIC, AVIF): boxes, the Exif and XMP items, the ICC profile ---- */
function isoBoxes(b, from, to) {
  const out = [];
  let i = from;
  while (i + 8 <= to) {
    let size = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    let head = 8;
    if (size === 1) { size = u32be(b, i + 8) * 4294967296 + u32be(b, i + 12); head = 16; }
    else if (size === 0) size = to - i;
    if (size < head || i + size > to) break;
    out.push({ type, at: i, start: i + head, end: i + size });
    i += size;
  }
  return out;
}
function isoMetadata(b) {
  const res = { exif: null, xmp: null, icc: null, width: 0, height: 0 };
  const top = isoBoxes(b, 0, b.length);
  const meta = top.find((x) => x.type === 'meta');
  if (!meta) return res;
  const kids = isoBoxes(b, meta.start + 4, meta.end);          // meta is a full box: 4 bytes of version and flags
  const iinf = kids.find((x) => x.type === 'iinf');
  const iloc = kids.find((x) => x.type === 'iloc');
  const iprp = kids.find((x) => x.type === 'iprp');
  const items = {};
  if (iinf) {
    const v = b[iinf.start];
    const first = iinf.start + 4 + (v === 0 ? 2 : 4);
    for (const e of isoBoxes(b, first, iinf.end)) {
      if (e.type !== 'infe') continue;
      const ver = b[e.start];
      if (ver < 2) continue;
      let p = e.start + 4;
      const id = ver === 2 ? (b[p] << 8) | b[p + 1] : u32be(b, p);
      p += ver === 2 ? 2 : 4;
      p += 2;                                                  // protection index
      const type = ascii(b, p, 4); p += 4;
      while (p < e.end && b[p]) p++;                           // item name
      p++;
      let ctype = '';
      if (type === 'mime') { while (p < e.end && b[p]) ctype += String.fromCharCode(b[p++]); }
      items[id] = { type, ctype };
    }
  }
  if (iloc) {
    const ver = b[iloc.start];
    let p = iloc.start + 4;
    const offSize = b[p] >> 4, lenSize = b[p] & 15, baseSize = b[p + 1] >> 4, idxSize = ver >= 1 ? b[p + 1] & 15 : 0;
    p += 2;
    const readN = (n) => { let v = 0; for (let k = 0; k < n; k++) v = v * 256 + b[p++]; return v; };
    const count = ver < 2 ? readN(2) : readN(4);
    for (let k = 0; k < count && p < iloc.end; k++) {
      const id = ver < 2 ? readN(2) : readN(4);
      if (ver >= 1) p += 2;                                    // construction method
      p += 2;                                                  // data reference index
      const base = readN(baseSize);
      const extents = readN(2);
      const parts = [];
      for (let e = 0; e < extents; e++) {
        if (idxSize) readN(idxSize);
        const off = readN(offSize), len = readN(lenSize);
        parts.push(b.subarray(base + off, base + off + len));
      }
      const it = items[id];
      if (!it) continue;
      const data = parts.length === 1 ? parts[0] : concatBytes(parts);
      if (it.type === 'Exif' && data.length > 4) {
        const skip = u32be(data, 0);                            // offset of the TIFF header after these 4 bytes
        res.exif = data.subarray(4 + skip);
      } else if (it.type === 'mime' && /rdf\+xml/.test(it.ctype)) res.xmp = utf8Text(data);
    }
  }
  if (iprp) {
    const ipco = isoBoxes(b, iprp.start, iprp.end).find((x) => x.type === 'ipco');
    if (ipco) for (const pbox of isoBoxes(b, ipco.start, ipco.end)) {
      const kind = ascii(b, pbox.start, 4);
      if (pbox.type === 'colr' && (kind === 'prof' || kind === 'rICC') && !res.icc) res.icc = b.subarray(pbox.start + 4, pbox.end);
      if (pbox.type === 'ispe' && !res.width) { res.width = u32be(b, pbox.start + 4); res.height = u32be(b, pbox.start + 8); }
    }
  }
  return res;
}

/* ---- TIFF: the file is the EXIF; ICC, XMP and IPTC are tags of IFD0 ---- */
function tiffTagBytes(b, tag) {
  const little = b[0] === 0x49;
  const u16 = (o) => little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1];
  const u32 = (o) => little ? u32le(b, o) : u32be(b, o);
  const ifd = u32(4);
  if (ifd + 2 > b.length) return null;
  const n = u16(ifd);
  for (let e = 0; e < n; e++) {
    const at = ifd + 2 + e * 12;
    if (at + 12 > b.length) break;
    if (u16(at) !== tag) continue;
    const type = u16(at + 2), count = u32(at + 4);
    const size = (({ 1: 1, 2: 1, 3: 2, 4: 4, 7: 1 })[type] || 1) * count;
    const off = size > 4 ? u32(at + 8) : at + 8;
    return off + size <= b.length ? b.subarray(off, off + size) : null;
  }
  return null;
}

const XMP_SIG = 'http://ns.adobe.com/xap/1.0/\0';
/**
 * Every metadata block a file carries, as raw bytes: exif (a TIFF
 * structure, without JPEG's "Exif\0\0" prefix), icc (the profile), xmp
 * (the XML as text), iptc (a JPEG's Photoshop APP13 block, or a TIFF's
 * IPTC tag). A PNG's iCCP profile is compressed: it comes back as
 * iccDeflated (a zlib stream) for the caller to inflate. Missing blocks
 * are null. width and height are filled where the container says them
 * without decoding (PNG, WebP, HEIC and AVIF).
 */
function extractMetadata(b) {
  const m = { format: containerOf(b), exif: null, icc: null, iccDeflated: null, xmp: null, iptc: null, width: 0, height: 0 };
  if (m.format === 'jpeg') {
    const segs = jpegSegments(b) || [];
    for (const s of segs) {
      if (s.marker === 0xe1 && ascii(b, s.at + 4, 6) === 'Exif\0\0' && !m.exif) m.exif = b.subarray(s.at + 10, s.end);
      else if (s.marker === 0xe1 && ascii(b, s.at + 4, XMP_SIG.length) === XMP_SIG && !m.xmp) m.xmp = utf8Text(b.subarray(s.at + 4 + XMP_SIG.length, s.end));
      else if (s.marker === 0xed && !m.iptc) m.iptc = b.subarray(s.at + 4, s.end);
    }
    m.icc = jpegICC(b);
    const sz = jpegSize(b);
    if (sz) { m.width = sz.width; m.height = sz.height; }
  } else if (m.format === 'png') {
    let i = 8;
    while (i + 8 <= b.length) {
      const len = u32be(b, i), type = ascii(b, i + 4, 4), d = i + 8;
      if (d + len > b.length) break;
      if (type === 'IHDR') { m.width = u32be(b, d); m.height = u32be(b, d + 4); }
      if (type === 'eXIf' && !m.exif) m.exif = b.subarray(d, d + len);
      else if (type === 'iCCP') {
        let k = d; while (k < d + len && b[k]) k++;
        m.iccDeflated = b.subarray(k + 2, d + len);           // after the name, its 0 and the method byte
      } else if (type === 'iTXt') {
        let k = d; while (k < d + len && b[k]) k++;
        if (ascii(b, d, k - d) === 'XML:com.adobe.xmp' && b[k + 1] === 0) {
          let q = k + 3;                                         // compression flag, method
          while (q < d + len && b[q]) q++; q++;                  // language tag
          while (q < d + len && b[q]) q++; q++;                  // translated keyword
          m.xmp = utf8Text(b.subarray(q, d + len));
        }
      }
      if (type === 'IEND') break;
      i = d + len + 4;
    }
  } else if (m.format === 'webp') {
    let i = 12;
    while (i + 8 <= b.length) {
      const type = ascii(b, i, 4), len = u32le(b, i + 4), d = i + 8;
      if (d + len > b.length) break;
      if (type === 'EXIF') {
        const x = b.subarray(d, d + len);
        m.exif = ascii(x, 0, 6) === 'Exif\0\0' ? x.subarray(6) : x;
      } else if (type === 'ICCP') m.icc = b.subarray(d, d + len);
      else if (type === 'XMP ') m.xmp = utf8Text(b.subarray(d, d + len));
      else if (type === 'VP8X') { m.width = 1 + (b[d + 4] | (b[d + 5] << 8) | (b[d + 6] << 16)); m.height = 1 + (b[d + 7] | (b[d + 8] << 8) | (b[d + 9] << 16)); }
      i = d + len + (len & 1);
    }
  } else if (m.format === 'heic' || m.format === 'avif') {
    const r = isoMetadata(b);
    m.exif = r.exif; m.xmp = r.xmp; m.icc = r.icc; m.width = r.width; m.height = r.height;
  } else if (m.format === 'tiff') {
    m.exif = b;
    m.icc = tiffTagBytes(b, 34675);
    const x = tiffTagBytes(b, 700);
    if (x) m.xmp = utf8Text(x);
    m.iptc = tiffTagBytes(b, 33723);
  }
  return m;
}

/* ---- XMP and IPTC as readable fields ---- */
const XMP_FIELDS = [
  ['dc:creator', 'Creator'], ['dc:rights', 'Rights'], ['dc:title', 'Title'], ['dc:description', 'Description'],
  ['dc:subject', 'Keywords'], ['xmp:CreatorTool', 'Creator tool'], ['xmp:CreateDate', 'Created'],
  ['xmp:ModifyDate', 'Modified'], ['xmp:Rating', 'Rating'], ['photoshop:Credit', 'Credit'],
  ['photoshop:Source', 'Source'], ['photoshop:City', 'City'], ['photoshop:State', 'State'],
  ['photoshop:Country', 'Country'], ['photoshop:Headline', 'Headline'], ['photoshop:DateCreated', 'Date created'],
  ['Iptc4xmpCore:Location', 'Location'], ['xmpRights:UsageTerms', 'Usage terms'], ['xmpRights:WebStatement', 'Copyright URL'],
  ['xmpMM:DocumentID', 'Document ID'], ['xmpMM:OriginalDocumentID', 'Original document ID'],
  ['exif:GPSLatitude', 'GPS latitude'], ['exif:GPSLongitude', 'GPS longitude'], ['tiff:Make', 'Make'], ['tiff:Model', 'Model'],
  ['aux:SerialNumber', 'Serial number'], ['aux:Lens', 'Lens'], ['exifEX:LensModel', 'Lens model'], ['exifEX:BodySerialNumber', 'Body serial number']
];
const xmlText = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
/** The XMP fields people look for, as [label, value] pairs, in a fixed order. */
function parseXMP(xmp) {
  const out = [];
  if (!xmp) return out;
  for (const [name, label] of XMP_FIELDS) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let v = null;
    const attr = new RegExp('\\s' + esc + '\\s*=\\s*"([^"]*)"').exec(xmp) || new RegExp('\\s' + esc + "\\s*=\\s*'([^']*)'").exec(xmp);
    if (attr) v = xmlText(attr[1]);
    else {
      const elm = new RegExp('<' + esc + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + esc + '>').exec(xmp);
      if (elm) {
        const li = elm[1].match(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/g);
        v = li ? li.map((x) => xmlText(x)).filter(Boolean).join('; ') : xmlText(elm[1]);
      }
    }
    if (v) out.push([label, v]);
  }
  return out;
}

const IPTC_FIELDS = { 5: 'Object name', 15: 'Category', 25: 'Keywords', 40: 'Special instructions', 55: 'Date created',
  80: 'By-line (author)', 85: 'By-line title', 90: 'City', 92: 'Sub-location', 95: 'Province / state', 101: 'Country',
  103: 'Original transmission reference', 105: 'Headline', 110: 'Credit', 115: 'Source', 116: 'Copyright notice',
  118: 'Contact', 120: 'Caption / abstract', 122: 'Caption writer' };
/** IPTC-IIM fields from a JPEG's Photoshop APP13 block (resource 0x0404) or a raw IIM block, as [label, value] pairs. */
function parseIPTC(block) {
  const out = [];
  if (!block) return out;
  let iim = block;
  if (ascii(block, 0, 14) === 'Photoshop 3.0\0') {
    iim = null;
    let i = 14;
    while (i + 12 <= block.length && ascii(block, i, 4) === '8BIM') {
      const id = (block[i + 4] << 8) | block[i + 5];
      const nameLen = block[i + 6];
      let p = i + 7 + nameLen; if ((nameLen + 1) & 1) p++;
      const size = u32be(block, p); p += 4;
      if (id === 0x0404) { iim = block.subarray(p, p + size); break; }
      i = p + size + (size & 1);
    }
    if (!iim) return out;
  }
  const seen = {};
  let i = 0;
  while (i + 5 <= iim.length && iim[i] === 0x1c) {
    const rec = iim[i + 1], ds = iim[i + 2], len = (iim[i + 3] << 8) | iim[i + 4];
    const v = utf8Text(iim.subarray(i + 5, i + 5 + len)).replace(/\0+$/, '').trim();
    if (rec === 2 && IPTC_FIELDS[ds] && v) {
      if (seen[ds] !== undefined) out[seen[ds]][1] += '; ' + v;
      else { seen[ds] = out.length; out.push([IPTC_FIELDS[ds], v]); }
    }
    i += 5 + len;
  }
  return out;
}

/* ---- EXIF: set orientation, drop GPS and the thumbnail; build a small one ---- */
/**
 * A copy of an EXIF block (TIFF bytes) for a file whose pixels have been
 * redrawn: Orientation set to 1 (the pixels are already upright), the
 * thumbnail in IFD1 blanked and unlinked (it would show the old picture),
 * and, with dropGps, every GPS value blanked and the pointer to the GPS
 * block taken out, so no location survives anywhere in the bytes. The
 * pixel width and height tags are updated when given.
 */
function exifForRedraw(tiff, opts = {}) {
  if (!tiff || tiff.length < 8) return null;
  const b = tiff.slice();
  const little = b[0] === 0x49;
  if (!little && b[0] !== 0x4d) return null;
  const u16 = (o) => little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1];
  const u32 = (o) => little ? u32le(b, o) : u32be(b, o);
  const w16 = (o, v) => { if (little) { b[o] = v & 255; b[o + 1] = v >> 8; } else { b[o] = v >> 8; b[o + 1] = v & 255; } };
  const w32 = (o, v) => { if (little) { b[o] = v & 255; b[o + 1] = (v >>> 8) & 255; b[o + 2] = (v >>> 16) & 255; b[o + 3] = v >>> 24; } else { b[o] = v >>> 24; b[o + 1] = (v >>> 16) & 255; b[o + 2] = (v >>> 8) & 255; b[o + 3] = v & 255; } };
  const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
  const ifd0 = u32(4);
  if (ifd0 + 2 > b.length) return null;
  const walk = (ifd, fn) => {
    if (!ifd || ifd + 2 > b.length) return;
    const n = u16(ifd);
    for (let e = 0; e < n && ifd + 2 + e * 12 + 12 <= b.length; e++) fn(ifd + 2 + e * 12, e, n);
  };
  let exifIfd = 0, gpsIfd = 0, gpsEntry = -1;
  walk(ifd0, (at, e) => {
    const tag = u16(at);
    if (tag === 0x0112) w16(at + 8, 1);                          // Orientation: Normal
    else if (tag === 0x8769) exifIfd = u32(at + 8);
    else if (tag === 0x8825) { gpsIfd = u32(at + 8); gpsEntry = e; }
  });
  if (opts.width && opts.height) walk(exifIfd, (at) => {
    const tag = u16(at), type = u16(at + 2);
    if (tag === 0xa002 || tag === 0xa003) {
      const v = tag === 0xa002 ? opts.width : opts.height;
      if (type === 3) w16(at + 8, Math.min(65535, v)); else if (type === 4) w32(at + 8, v);
    }
  });
  if (opts.dropGps && gpsIfd) {
    /* blank every value the GPS block points at, then the block itself */
    walk(gpsIfd, (at) => {
      const size = (SIZES[u16(at + 2)] || 1) * u32(at + 4);
      if (size > 4) { const off = u32(at + 8); if (off + size <= b.length) b.fill(0, off, off + size); }
    });
    const n = u16(gpsIfd);
    b.fill(0, gpsIfd, Math.min(b.length, gpsIfd + 2 + n * 12 + 4));
    /* and take the pointer out of IFD0: the later entries, and the link to
       the next IFD, move up one place */
    const n0 = u16(ifd0);
    const from = ifd0 + 2 + (gpsEntry + 1) * 12, end = ifd0 + 2 + n0 * 12 + 4;
    b.copyWithin(from - 12, from, end);
    b.fill(0, end - 12, end);
    w16(ifd0, n0 - 1);
  }
  if (opts.dropThumb !== false) {
    const n0 = u16(ifd0);
    const next = ifd0 + 2 + n0 * 12;
    const ifd1 = next + 4 <= b.length ? u32(next) : 0;
    if (ifd1 && ifd1 + 2 <= b.length) {
      let thumbOff = 0, thumbLen = 0;
      walk(ifd1, (at) => { const t = u16(at); if (t === 0x0201) thumbOff = u32(at + 8); if (t === 0x0202) thumbLen = u32(at + 8); });
      if (thumbOff && thumbLen && thumbOff + thumbLen <= b.length) b.fill(0, thumbOff, thumbOff + thumbLen);
      w32(next, 0);
    }
  }
  return b;
}

/**
 * A new, minimal EXIF block (big-endian TIFF) holding only the fields
 * given: Orientation (a number), Artist and Copyright (text). Used to keep
 * just those when everything else is stripped.
 */
function buildExif(fields) {
  const entries = [];
  if (fields.Orientation) entries.push({ tag: 0x0112, type: 3, short: fields.Orientation });
  if (fields.Artist) entries.push({ tag: 0x013b, type: 2, text: fields.Artist });
  if (fields.Copyright) entries.push({ tag: 0x8298, type: 2, text: fields.Copyright });
  entries.sort((a, b) => a.tag - b.tag);
  const n = entries.length;
  let dataAt = 8 + 2 + n * 12 + 4;
  const data = [];
  const head = new Uint8Array(dataAt);
  head.set([0x4d, 0x4d, 0, 42, 0, 0, 0, 8]);
  head[8] = n >> 8; head[9] = n & 255;
  entries.forEach((e, k) => {
    const at = 10 + k * 12;
    head[at] = e.tag >> 8; head[at + 1] = e.tag & 255; head[at + 2] = 0; head[at + 3] = e.type;
    if (e.type === 3) {
      head.set([0, 0, 0, 1], at + 4);
      head[at + 8] = e.short >> 8; head[at + 9] = e.short & 255;
    } else {
      const t = concatBytes([utf8Bytes(String(e.text)), new Uint8Array([0])]);
      const c = t.length;
      head.set([c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255, c & 255], at + 4);
      if (c <= 4) head.set(t, at + 8);
      else {
        head.set([dataAt >>> 24, (dataAt >>> 16) & 255, (dataAt >>> 8) & 255, dataAt & 255], at + 8);
        data.push(t); dataAt += c;
        if (c & 1) { data.push(new Uint8Array(1)); dataAt++; }
      }
    }
  });
  return concatBytes([head].concat(data));
}

/* ---- zlib without compression, for a PNG's iCCP chunk ---- */
function adler32(b) {
  let a = 1, c = 0;
  for (let i = 0; i < b.length; i++) { a = (a + b[i]) % 65521; c = (c + a) % 65521; }
  return ((c << 16) | a) >>> 0;
}
/** A valid zlib stream made of stored (uncompressed) deflate blocks. */
function zlibStored(data) {
  const parts = [new Uint8Array([0x78, 0x01])];
  let i = 0;
  do {
    const chunk = data.subarray(i, Math.min(data.length, i + 65535));
    const last = i + 65535 >= data.length ? 1 : 0;
    const len = chunk.length;
    parts.push(new Uint8Array([last, len & 255, len >> 8, ~len & 255, (~len >> 8) & 255]), chunk);
    i += 65535;
  } while (i < data.length);
  const s = adler32(data);
  parts.push(new Uint8Array([s >>> 24, (s >>> 16) & 255, (s >>> 8) & 255, s & 255]));
  return concatBytes(parts);
}
function pngChunk(type, data) {
  const c = new Uint8Array(12 + data.length);
  const n = data.length;
  c.set([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255], 0);
  c.set(latin1(type), 4);
  c.set(data, 8);
  const crc = crc32(c, 4, 8 + n);
  c.set([crc >>> 24, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255], 8 + n);
  return c;
}
function riffChunk(type, data) {
  const pad = data.length & 1;
  const c = new Uint8Array(8 + data.length + pad);
  c.set(latin1(type), 0);
  const n = data.length;
  c.set([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24], 4);
  c.set(data, 8);
  return c;
}

/**
 * Metadata out, pixels untouched: a JPEG keeps its scan byte for byte
 * (stripJpegMetadata); a PNG keeps only the chunks that say how to draw it
 * (the image data, palette, transparency, colour and print-size chunks, and
 * an animation's frames), dropping text, EXIF and time stamps; a WebP drops
 * its EXIF and XMP chunks and the VP8X flags that announced them. Anything
 * else comes back unchanged. Returns the new bytes (the same array when
 * there was nothing to take out).
 */
const PNG_KEEP = ['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'pHYs', 'bKGD', 'acTL', 'fcTL', 'fdAT', 'cICP'];
function stripMetadata(bytes) {
  const kind = containerOf(bytes);
  if (kind === 'jpeg') return stripJpegMetadata(bytes);
  if (kind === 'png') {
    const parts = [bytes.subarray(0, 8)];
    let i = 8, dropped = 0;
    while (i + 8 <= bytes.length) {
      const len = u32be(bytes, i), type = ascii(bytes, i + 4, 4), end = i + 12 + len;
      if (end > bytes.length) return bytes;
      if (PNG_KEEP.indexOf(type) >= 0) parts.push(bytes.subarray(i, end)); else dropped++;
      i = end;
      if (type === 'IEND') break;
    }
    return dropped ? concatBytes(parts) : bytes;
  }
  if (kind === 'webp') {
    const parts = [];
    let i = 12, dropped = 0, vp8x = -1;
    while (i + 8 <= bytes.length) {
      const type = ascii(bytes, i, 4), len = u32le(bytes, i + 4), end = i + 8 + len + (len & 1);
      if (end > bytes.length + 1) return bytes;
      if (type === 'EXIF' || type === 'XMP ') dropped++;
      else { if (type === 'VP8X') vp8x = parts.length; parts.push(bytes.slice(i, Math.min(end, bytes.length))); }
      i = end;
    }
    if (!dropped) return bytes;
    if (vp8x >= 0) parts[vp8x][8] &= ~(0x08 | 0x04);          // the EXIF and XMP flags
    const body = concatBytes(parts);
    const out = new Uint8Array(12 + body.length);
    out.set(bytes.subarray(0, 12));
    const n = 4 + body.length;
    out.set([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24], 4);
    out.set(body, 12);
    return out;
  }
  return bytes;
}

/**
 * Write metadata into an encoded JPEG, PNG or WebP: meta.exif (TIFF bytes),
 * meta.icc (profile bytes), meta.xmp (text). Blocks of those kinds the file
 * already has are replaced. Returns { bytes, written, skipped }: a block
 * too big for its container (a JPEG segment holds 64 KB) is skipped and
 * named. Any other format comes back unchanged, with everything asked for
 * in skipped.
 */
function embedMetadata(bytes, meta) {
  const kind = containerOf(bytes);
  const want = ['exif', 'icc', 'xmp'].filter((k) => meta && meta[k]);
  const written = [], skipped = [];
  if (!want.length) return { bytes, written, skipped };
  if (kind === 'jpeg') {
    const segs = jpegSegments(bytes);
    if (!segs) return { bytes, written, skipped: want };
    const sos = segs[segs.length - 1];
    const keep = segs.filter((s) => {
      if (s.marker === 0xe1 && meta.exif && ascii(bytes, s.at + 4, 6) === 'Exif\0\0') return false;
      if (s.marker === 0xe1 && meta.xmp && ascii(bytes, s.at + 4, XMP_SIG.length) === XMP_SIG) return false;
      if (s.marker === 0xe2 && meta.icc && ascii(bytes, s.at + 4, 12) === 'ICC_PROFILE\0') return false;
      return true;
    });
    const seg = (marker, payload) => {
      const len = payload.length + 2;
      return concatBytes([new Uint8Array([0xff, marker, len >> 8, len & 255]), payload]);
    };
    const add = [];
    if (meta.exif) {
      const p = concatBytes([latin1('Exif\0\0'), meta.exif]);
      if (p.length + 2 <= 65535) { add.push(seg(0xe1, p)); written.push('exif'); } else skipped.push('exif');
    }
    if (meta.xmp) {
      const p = concatBytes([latin1(XMP_SIG), utf8Bytes(meta.xmp)]);
      if (p.length + 2 <= 65535) { add.push(seg(0xe1, p)); written.push('xmp'); } else skipped.push('xmp');
    }
    if (meta.icc) {
      const per = 65519;
      const n = Math.ceil(meta.icc.length / per);
      if (n <= 255) {
        for (let k = 0; k < n; k++) add.push(seg(0xe2, concatBytes([latin1('ICC_PROFILE\0'), new Uint8Array([k + 1, n]), meta.icc.subarray(k * per, (k + 1) * per)])));
        written.push('icc');
      } else skipped.push('icc');
    }
    /* after the JFIF header when there is one, as the EXIF standard asks */
    const parts = [new Uint8Array([0xff, 0xd8])];
    let placed = false;
    for (const s of keep) {
      if (!placed && s.marker !== 0xe0) { parts.push(...add); placed = true; }
      parts.push(bytes.subarray(s.at, s === sos ? bytes.length : s.end));
    }
    if (!placed) parts.push(...add);
    return { bytes: concatBytes(parts), written, skipped };
  }
  if (kind === 'png') {
    const parts = [bytes.subarray(0, 8)];
    let i = 8;
    while (i + 8 <= bytes.length) {
      const len = u32be(bytes, i), type = ascii(bytes, i + 4, 4), end = i + 12 + len;
      const drop = (meta.icc && (type === 'iCCP' || type === 'sRGB' || type === 'gAMA' || type === 'cHRM'))
        || (meta.exif && type === 'eXIf')
        || (meta.xmp && type === 'iTXt' && ascii(bytes, i + 8, 17) === 'XML:com.adobe.xmp');
      if (!drop) parts.push(bytes.subarray(i, end));
      if (type === 'IHDR') {
        if (meta.icc) { parts.push(pngChunk('iCCP', concatBytes([latin1('ICC profile\0\0'), zlibStored(meta.icc)]))); written.push('icc'); }
        if (meta.exif) { parts.push(pngChunk('eXIf', meta.exif)); written.push('exif'); }
        if (meta.xmp) { parts.push(pngChunk('iTXt', concatBytes([latin1('XML:com.adobe.xmp\0\0\0\0\0'), utf8Bytes(meta.xmp)]))); written.push('xmp'); }
      }
      if (type === 'IEND') break;
      i = end;
    }
    return { bytes: concatBytes(parts), written, skipped };
  }
  if (kind === 'webp') {
    let w = 0, h = 0, alpha = false, anim = false;
    const chunks = [];
    let i = 12;
    while (i + 8 <= bytes.length) {
      const type = ascii(bytes, i, 4), len = u32le(bytes, i + 4), d = i + 8;
      if (d + len > bytes.length) break;
      const data = bytes.subarray(d, d + len);
      if (type === 'VP8X') {
        alpha = !!(data[0] & 0x10); anim = !!(data[0] & 0x02);
        w = 1 + (data[4] | (data[5] << 8) | (data[6] << 16)); h = 1 + (data[7] | (data[8] << 8) | (data[9] << 16));
      } else if (type === 'VP8 ' && !w) {
        w = (data[6] | (data[7] << 8)) & 0x3fff; h = (data[8] | (data[9] << 8)) & 0x3fff;
      } else if (type === 'VP8L' && !w) {
        const bits = u32le(data, 1);
        w = (bits & 0x3fff) + 1; h = ((bits >> 14) & 0x3fff) + 1; alpha = !!((bits >> 28) & 1);
      }
      if (type === 'ALPH') alpha = true;
      const replaced = (meta.icc && type === 'ICCP') || (meta.exif && type === 'EXIF') || (meta.xmp && type === 'XMP ');
      if (type !== 'VP8X' && !replaced) chunks.push({ type, data });
      i = d + len + (len & 1);
    }
    const has = (t) => chunks.some((c) => c.type === t);
    const flags = (meta.icc || has('ICCP') ? 0x20 : 0) | (alpha ? 0x10 : 0) | (meta.exif || has('EXIF') ? 0x08 : 0) | (meta.xmp || has('XMP ') ? 0x04 : 0) | (anim ? 0x02 : 0);
    const vp8x = new Uint8Array(10);
    vp8x[0] = flags;
    vp8x.set([(w - 1) & 255, ((w - 1) >> 8) & 255, ((w - 1) >> 16) & 255, (h - 1) & 255, ((h - 1) >> 8) & 255, ((h - 1) >> 16) & 255], 4);
    /* the order the WebP container asks for: VP8X, ICCP, image data, EXIF, XMP */
    const out = [riffChunk('VP8X', vp8x)];
    if (meta.icc) { out.push(riffChunk('ICCP', meta.icc)); written.push('icc'); }
    for (const c of chunks) if (c.type === 'ICCP') out.push(riffChunk(c.type, c.data));
    for (const c of chunks) if (c.type !== 'ICCP' && c.type !== 'EXIF' && c.type !== 'XMP ') out.push(riffChunk(c.type, c.data));
    for (const c of chunks) if (c.type === 'EXIF') out.push(riffChunk(c.type, c.data));
    if (meta.exif) { out.push(riffChunk('EXIF', meta.exif)); written.push('exif'); }
    for (const c of chunks) if (c.type === 'XMP ') out.push(riffChunk(c.type, c.data));
    if (meta.xmp) { out.push(riffChunk('XMP ', utf8Bytes(meta.xmp))); written.push('xmp'); }
    const body = concatBytes(out);
    const head = new Uint8Array(12);
    head.set(latin1('RIFF'), 0);
    const size = body.length + 4;
    head.set([size & 255, (size >>> 8) & 255, (size >>> 16) & 255, size >>> 24], 4);
    head.set(latin1('WEBP'), 8);
    return { bytes: concatBytes([head, body]), written, skipped };
  }
  return { bytes, written, skipped: want };
}

/* ---- writers the browser does not have: BMP and ICO ---- */
/**
 * A BMP of RGBA pixels: 24-bit when every pixel is opaque (what every
 * program opens), otherwise 32-bit with an alpha channel (a BITMAPV4HEADER
 * with bit masks). Rows bottom-up, as BMP stores them; the resolution
 * fields carry dpi (96 when not given).
 */
function encodeBMP(rgba, width, height, dpi) {
  let opaque = true;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) { opaque = false; break; }
  const bpp = opaque ? 24 : 32;
  const rowBytes = opaque ? (width * 3 + 3) & ~3 : width * 4;
  const headSize = opaque ? 40 : 108;
  const off = 14 + headSize;
  const size = off + rowBytes * height;
  const b = new Uint8Array(size);
  const dv = new DataView(b.buffer);
  b[0] = 0x42; b[1] = 0x4d;
  dv.setUint32(2, size, true); dv.setUint32(10, off, true);
  dv.setUint32(14, headSize, true);
  dv.setInt32(18, width, true); dv.setInt32(22, height, true);
  dv.setUint16(26, 1, true); dv.setUint16(28, bpp, true);
  dv.setUint32(30, opaque ? 0 : 3, true);                      // BI_RGB, or BI_BITFIELDS
  dv.setUint32(34, rowBytes * height, true);
  const ppm = Math.round((dpi || 96) / 0.0254);
  dv.setInt32(38, ppm, true); dv.setInt32(42, ppm, true);
  if (!opaque) {
    dv.setUint32(54, 0x00ff0000, true); dv.setUint32(58, 0x0000ff00, true);
    dv.setUint32(62, 0x000000ff, true); dv.setUint32(66, 0xff000000, true);
    b.set(latin1('BGRs'), 70);                                   // LCS_sRGB ('sRGB' read as a little-endian number)
  }
  for (let y = 0; y < height; y++) {
    let o = off + (height - 1 - y) * rowBytes;
    for (let x = 0; x < width; x++) {
      const j = (y * width + x) * 4;
      b[o++] = rgba[j + 2]; b[o++] = rgba[j + 1]; b[o++] = rgba[j];
      if (!opaque) b[o++] = rgba[j + 3];
    }
  }
  return b;
}

/**
 * An ICO holding the given PNG files, one entry per size (PNG entries are
 * what Windows Vista onwards and every browser read). images: [{ width,
 * height, bytes }], each side at most 256.
 */
function encodeICO(images) {
  const n = images.length;
  const head = new Uint8Array(6 + n * 16);
  const dv = new DataView(head.buffer);
  dv.setUint16(2, 1, true); dv.setUint16(4, n, true);
  let off = head.length;
  images.forEach((im, k) => {
    const at = 6 + k * 16;
    head[at] = im.width >= 256 ? 0 : im.width;
    head[at + 1] = im.height >= 256 ? 0 : im.height;
    dv.setUint16(at + 4, 1, true); dv.setUint16(at + 6, 32, true);
    dv.setUint32(at + 8, im.bytes.length, true); dv.setUint32(at + 12, off, true);
    off += im.bytes.length;
  });
  return concatBytes([head].concat(images.map((im) => im.bytes)));
}

/* ---- animation: GIF, WebP and APNG ---- */
/** { animated, frames } for a GIF, WebP or PNG, frames counted from the file's own structure. */
function animationInfo(b) {
  const kind = containerOf(b);
  if (kind === 'gif') {
    let frames = 0;
    let i = 13;
    const flags = b[10];
    if (flags & 0x80) i += 3 * (1 << ((flags & 7) + 1));
    while (i < b.length) {
      const t = b[i];
      if (t === 0x3b) break;                                     // trailer
      if (t === 0x21) {                                          // extension: label, then sub-blocks
        i += 2;
        while (i < b.length && b[i]) i += b[i] + 1;
        i++;
      } else if (t === 0x2c) {                                   // an image
        frames++;
        const f = b[i + 9];
        i += 10;
        if (f & 0x80) i += 3 * (1 << ((f & 7) + 1));
        i++;                                                     // LZW minimum code size
        while (i < b.length && b[i]) i += b[i] + 1;
        i++;
      } else break;
    }
    return { animated: frames > 1, frames };
  }
  if (kind === 'webp') {
    let frames = 0, flag = false;
    let i = 12;
    while (i + 8 <= b.length) {
      const type = ascii(b, i, 4), len = u32le(b, i + 4);
      if (type === 'VP8X') flag = !!(b[i + 8] & 0x02);
      if (type === 'ANMF') frames++;
      i += 8 + len + (len & 1);
    }
    return { animated: flag && frames > 1, frames: frames || 1 };
  }
  if (kind === 'png') {
    let i = 8;
    while (i + 8 <= b.length) {
      const len = u32be(b, i), type = ascii(b, i + 4, 4);
      if (type === 'acTL') { const f = u32be(b, i + 8); return { animated: f > 1, frames: f }; }
      if (type === 'IDAT') break;
      i += 12 + len;
    }
  }
  return { animated: false, frames: 1 };
}

window.MVRImage={readExif:readExif,metadataSegments:metadataSegments,buildPDF:buildPDF,jpegSize:jpegSize,jpegInfo:jpegInfo,jpegICC:jpegICC,iccChannels:iccChannels,iccIsSRGB:iccIsSRGB,stripJpegMetadata:stripJpegMetadata,metadataReport:metadataReport,metadataSummary:metadataSummary,setDPI:setDPI,readDPI:readDPI,crc32:crc32,medianCut:medianCut,toHex:toHex,relLuminance:relLuminance,rgbToHsl:rgbToHsl,contrastRatio:contrastRatio,wcagGrade:wcagGrade,optimiseSVG:optimiseSVG,referencedIds:referencedIds,SOCIAL_PRESETS:SOCIAL_PRESETS,SOCIAL_AS_OF:SOCIAL_AS_OF,PHOTO_PRESETS:PHOTO_PRESETS,mmToPx:mmToPx,pxToMm:pxToMm,containerOf:containerOf,mimeOf:mimeOf,extOf:extOf,extractMetadata:extractMetadata,parseXMP:parseXMP,parseIPTC:parseIPTC,exifForRedraw:exifForRedraw,buildExif:buildExif,zlibStored:zlibStored,embedMetadata:embedMetadata,encodeBMP:encodeBMP,encodeICO:encodeICO,animationInfo:animationInfo,pngFilterRows:pngFilterRows,stripMetadata:stripMetadata};
})();