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
  0xa435: 'LensSerialNumber', 0x9286: 'UserComment', 0x010e: 'ImageDescription'
};

const GPS_TAGS = {
  0x0000: 'GPSVersionID', 0x0001: 'GPSLatitudeRef', 0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef', 0x0004: 'GPSLongitude', 0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude', 0x0007: 'GPSTimeStamp', 0x001d: 'GPSDateStamp'
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
function readExif(bytes) {
  const out = { found: false, tags: {}, gps: null, warnings: [] };
  if (!bytes || bytes.length < 4) return out;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    out.warnings.push('Not a JPEG — EXIF is only read from JPEG files here.');
    return out;
  }

  // walk the segment markers looking for APP1/Exif
  let i = 2;
  let app1 = -1, app1Len = 0;
  while (i < bytes.length - 4) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xda) break;                       // start of scan — no more metadata
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1 &&
        bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78 &&
        bytes[i + 6] === 0x69 && bytes[i + 7] === 0x66) {
      app1 = i + 10;                                   // skip "Exif\0\0"
      app1Len = len;
      break;
    }
    i += 2 + len;
  }
  if (app1 < 0) return out;

  const tiff = app1;
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
 * JPEGs are embedded with /DCTDecode, so there is no quality loss and no
 * compressor to ship.
 *
 * @param {Array<{bytes:Uint8Array,width:number,height:number}>} images
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

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const n = images.length;
  // 1 catalog, 2 pages, then per image: page, content, xobject
  const pageIds = [], contentIds = [], imgIds = [];
  for (let i = 0; i < n; i++) {
    pageIds.push(3 + i * 3);
    contentIds.push(4 + i * 3);
    imgIds.push(5 + i * 3);
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
    if (!base) {                                  // "fit": page matches the image
      pw = img.width; ph = img.height;
    } else if (opts.orientation === 'landscape' ||
              (opts.orientation === 'auto' && img.width > img.height)) {
      pw = base[1]; ph = base[0];
    } else {
      pw = base[0]; ph = base[1];
    }

    const availW = Math.max(1, pw - margin * 2);
    const availH = Math.max(1, ph - margin * 2);
    const scale = base ? Math.min(availW / img.width, availH / img.height) : 1;
    const dw = img.width * scale, dh = img.height * scale;
    const dx = (pw - dw) / 2, dy = (ph - dh) / 2;

    startObj(pageIds[i]);
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] ` +
         `/Resources << /XObject << /Im0 ${imgIds[i]} 0 R >> >> /Contents ${contentIds[i]} 0 R >>\n`);
    endObj();

    const stream = `q\n${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm\n/Im0 Do\nQ\n`;
    startObj(contentIds[i]);
    push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream\n`);
    endObj();

    startObj(imgIds[i]);
    push(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} ` +
         `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`);
    push(img.bytes);
    push('\nendstream\n');
    endObj();
  });

  const xrefStart = length;
  const total = 2 + n * 3;
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

/* ============================================================
   SVG optimiser — text transforms, no parser dependency
   ============================================================ */

/**
 * Strip editor cruft and shrink an SVG.
 * Conservative by design: it never touches path geometry beyond rounding
 * coordinates, because aggressive path rewriting is where SVG optimisers
 * silently break artwork.
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

  drop(/<!--[\s\S]*?-->/g, 'comments');
  drop(/<\?xml[^>]*\?>\s*/g, 'XML declaration');
  drop(/<!DOCTYPE[^>]*>\s*/g, 'DOCTYPE');
  drop(/<metadata>[\s\S]*?<\/metadata>/g, 'metadata');
  drop(/<title>[\s\S]*?<\/title>/g, 'title elements');
  drop(/<desc>[\s\S]*?<\/desc>/g, 'desc elements');
  drop(/<(sodipodi|inkscape)[^>]*>[\s\S]*?<\/\1[^>]*>/g, 'editor elements');
  drop(/\s(inkscape|sodipodi|sketch|illustrator|adobe|serif|krita):[\w-]+="[^"]*"/g, 'editor attributes');
  drop(/\sxmlns:(inkscape|sodipodi|sketch|serif|krita|dc|cc|rdf)="[^"]*"/g, 'unused namespaces');
  drop(/\s(data-name|id)="[^"]*"/g, 'ids and data-name');
  drop(/<defs\s*\/>|<g\s*\/>|<defs>\s*<\/defs>/g, 'empty elements');

  if (opts.roundCoords !== false) {
    const round = (m) => {
      const n = parseFloat(m);
      if (!isFinite(n)) return m;
      const r = Number(n.toFixed(precision));
      return String(r);
    };
    out = out.replace(/(?<=[\s",=(])-?\d+\.\d+/g, round);
    out = out.replace(/(\sd=")([^"]+)(")/g, (all, a, d, c) =>
      a + d.replace(/-?\d+\.\d+/g, round) + c);
  }

  out = out
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+(\/?>)/g, '$1')
    .replace(/;\s*"/g, '"')
    .trim();

  return {
    output: out,
    before,
    after: out.length,
    saved: before - out.length,
    savedPct: before ? ((before - out.length) / before) * 100 : 0,
    removed
  };
}

/* ============================================================
   Social & print presets
   ============================================================ */

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

const mmToPx = (mm, dpi) => Math.round((mm / 25.4) * dpi);


window.MVRImage={readExif:readExif,metadataSegments:metadataSegments,buildPDF:buildPDF,jpegSize:jpegSize,medianCut:medianCut,toHex:toHex,relLuminance:relLuminance,optimiseSVG:optimiseSVG,SOCIAL_PRESETS:SOCIAL_PRESETS,PHOTO_PRESETS:PHOTO_PRESETS,mmToPx:mmToPx};
})();