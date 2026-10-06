/**
 * The GIF encoder behind /social/video-to-gif/ (engine/social-video-to-gif.js).
 *
 * A module Web Worker, so the heavy part — choosing the 256 colours,
 * mapping every pixel to one of them and LZW-compressing the frame — runs
 * off the page's main thread and the page keeps answering while a GIF is
 * made. The encoder is gifenc 1.0.3 (MIT, engine/vendor/gifenc.esm.js,
 * licence in engine/vendor/LICENSE-gifenc.txt), served from this site.
 *
 * The same file is the fallback where a browser cannot start a module
 * worker: the page imports it and calls handle() itself, a frame at a time.
 *
 * Messages (each carries an id, answered with { id, ok, … }):
 *   palette  { samples: ArrayBuffer RGBA, colours }  → { palette }
 *   start    { width, height, palette, repeat, dither } → {}
 *            repeat: -1 writes no NETSCAPE2.0 block (the GIF plays once);
 *            0 loops for ever; n > 0 asks for n repeats after the first play
 *   frame    { data: ArrayBuffer RGBA, delay (ms, a multiple of 10) } → { bytes so far }
 *   finish   {} → { bytes: Uint8Array } (the whole file)
 *   estimate { width, height, palette, dither, frames: [ArrayBuffer RGBA] } → { sizes: [cumulative bytes after each frame] }
 *   cancel   {} → {}
 */
import { GIFEncoder, quantize, applyPalette } from '/engine/vendor/gifenc.esm.js';

/* 4×4 ordered dither: a gradient quantised to 256 colours bands into
   stripes; a little threshold noise breaks the bands up. Ordered (not
   error-diffusion) so a still part of the picture stays still from frame
   to frame instead of crawling. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function dither(d, w, h, strength) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const n = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * strength;
      d[o] = Math.max(0, Math.min(255, d[o] + n));
      d[o + 1] = Math.max(0, Math.min(255, d[o + 1] + n));
      d[o + 2] = Math.max(0, Math.min(255, d[o + 2] + n));
    }
  }
}
const DITHER = 10;

let job = null;

function writeOne(enc, data, w, h, palette, first, delay, repeat, dith) {
  const d = new Uint8ClampedArray(data);
  if (d.length !== w * h * 4) throw new Error('a frame is ' + d.length + ' bytes, not ' + (w * h * 4));
  if (dith) dither(d, w, h, DITHER);
  const index = applyPalette(d, palette, 'rgb565');
  enc.writeFrame(index, w, h, first ? { palette, delay, repeat } : { delay });
}

export function handle(m) {
  switch (m.type) {
    case 'palette': {
      const s = new Uint8ClampedArray(m.samples);
      return { palette: quantize(s, Math.max(2, Math.min(256, m.colours || 256)), { format: 'rgb565' }) };
    }
    case 'start':
      job = { enc: GIFEncoder(), w: m.width, h: m.height, palette: m.palette, repeat: m.repeat, dither: !!m.dither, n: 0 };
      return {};
    case 'frame': {
      if (!job) throw new Error('no GIF started');
      writeOne(job.enc, m.data, job.w, job.h, job.palette, job.n === 0, m.delay, job.repeat, job.dither);
      job.n++;
      return { bytes: job.enc.bytesView().length, frames: job.n };
    }
    case 'finish': {
      if (!job) throw new Error('no GIF started');
      job.enc.finish();
      const bytes = job.enc.bytes();
      job = null;
      return { bytes, transfer: [bytes.buffer] };
    }
    case 'estimate': {
      const enc = GIFEncoder();
      const sizes = [];
      m.frames.forEach((f, i) => {
        writeOne(enc, f, m.width, m.height, m.palette, i === 0, 100, 0, !!m.dither);
        sizes.push(enc.bytesView().length);
      });
      return { sizes };
    }
    case 'cancel':
      job = null;
      return {};
    default:
      throw new Error('unknown message ' + m.type);
  }
}

/* in a worker: answer messages; imported on the page: do nothing */
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = (e) => {
    const m = e.data || {};
    try {
      const r = handle(m);
      const transfer = r.transfer || [];
      delete r.transfer;
      self.postMessage(Object.assign({ id: m.id, ok: true }, r), transfer);
    } catch (err) {
      self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
    }
  };
}
