/**
 * Claims on the Video Tools' pages (/video/): each quoted sentence checked
 * against a run of the real page in Chrome. The test videos are made in the
 * page with WebCodecs and the vendored muxers called directly (see
 * build/video/tests/_kit.js makeVideo: every frame shows its number in
 * binary, the sound's pitch steps every second); every output is read back
 * by the browser's own <video> and decodeAudioData, or byte by byte here —
 * never by the engines' own code. Browser support tables and the size
 * limit's phone caveat cannot be checked automatically and are listed
 * under "manual".
 */
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function ({ claim, manual, kit: K }) {
  const B = 'browser';
  let VT = null;
  const vt = () => VT || (VT = require(path.join(K.ROOT, 'build', 'video', 'tests', '_kit.js'))({ name: 'claims-video', port: K.PORT }));
  const near = (a, b, t) => Math.abs(a - b) <= t;

  /* the test videos, made once per run */
  const fixtures = () => K.once('video-fixtures', async () => {
    const p = await K.open('/video/', { wait: 'main' });
    const T = vt();
    const F = {};
    /* in a folder of their own under their plain names: output names are built from them */
    const dir = K.out('video-fixtures');
    fs.mkdirSync(dir, { recursive: true });
    const put = (name, bytes) => { const f = path.join(dir, name); fs.writeFileSync(f, bytes); return f; };
    const mk = async (name, o) => { F[name] = put(name, await T.makeVideo(p, o)); };
    await mk('clip.mp4', { box: 'mp4' });
    await mk('big.mp4', { box: 'mp4', w: 1280, h: 720, seconds: 10, noise: true, bitrate: 5e6 });
    await mk('clip.webm', { box: 'webm' });
    await mk('vp8.webm', { box: 'webm', vcodec: 'vp8' });
    await mk('rot.mp4', { box: 'mp4', rotation: 90, audio: false });
    await mk('clip44.mp4', { box: 'mp4', rate: 44100 });
    const mov = Buffer.from(fs.readFileSync(F['clip.mp4'])); mov.write('qt  ', 8, 'latin1');
    F['clip.mov'] = put('clip.mov', mov);
    await p.close();
    return F;
  });
  /** open a tool, load a file, set controls, press the button; resolve the page, the download and the page's notes */
  async function run(url, file, sets, button, opts) {
    const F = await fixtures();
    const p = await K.open(url);
    if (opts && opts.flags) await p.evaluate((f) => Object.assign(window, f), opts.flags);
    const inp = await p.$('.tool-io input[type=file]');
    await inp.uploadFile(F[file]);
    await p.waitForFunction(() => { const s = document.querySelector('.vk-studio'); return s && !s.hidden; }, { timeout: 60000 });
    for (const [k, v] of sets || []) {
      await p.evaluate((sel, v) => { const e = document.querySelector(sel); if (e.type === 'checkbox') e.checked = !!v; else e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, k, v);
    }
    const est = await p.$eval('.vk-est', (e) => e.textContent).catch(() => '');
    if (!button) return { p, est };
    await K.clearDownloads(p);
    await K.clickText(p, '.tool-io button', button);
    await p.waitForFunction(() => { const s = document.querySelector('.tool-io .aiimg-status'); return s && /^(Done|Cancelled|It did not work)/.test(s.textContent); }, { timeout: 300000, polling: 250 });
    const status = await p.$eval('.tool-io .aiimg-status', (e) => e.textContent);
    const note = await p.$eval('.vk-result .vk-note', (e) => e.textContent).catch(() => '');
    const d = (await K.downloads(p))[0];
    const last = await p.evaluate(() => ({ last: window.VideoKit.last || null, compress: window.VideoKit.lastCompress || null, convert: window.VideoKit.lastConvert || null, trim: window.VideoKit.lastTrim || null }));
    return { p, est, status, note, d, last };
  }
  const done = async (r, fn) => { try { return await fn(r); } finally { await r.p.close(); } };
  /** does `out` contain a run of `n` bytes taken from inside the source's mdat (a copied sample) at each of k offsets? */
  function copiedBytes(src, out, k, n) {
    const at = src.indexOf(Buffer.from('mdat')) + 4;
    let found = 0;
    for (let i = 1; i <= k; i++) {
      const off = at + Math.floor((src.length - at - n - 16) * i / (k + 1));
      if (out.indexOf(src.subarray(off, off + n)) >= 0) found++;
    }
    return found;
  }

  /* ================================================================ */
  const C = '/video/video-compressor/';
  claim(C, 'works', 'Aim for a file size in MB (the Half and A quarter buttons fill it in), or for a quality level: High, Balanced or Small.', 'the size buttons and the three quality levels', B, async () => {
    const r = await run(C, 'big.mp4', []);
    return done(r, async ({ p }) => {
      await K.clickText(p, '.vk-chips button', /^Half$/);
      const half = await p.$eval('#vc-target', (e) => Number(e.value));
      const size = fs.statSync((await fixtures())['big.mp4']).size / 1048576;
      const q = await p.$$eval('#vc-quality option', (o) => o.map((x) => x.textContent.split(' ')[0]).join(','));
      return [near(half, size / 2, 0.1) && q === 'High,Balanced,Small', 'Half → ' + half + ' MB of ' + size.toFixed(2) + '; levels ' + q];
    });
  });
  claim(C, 'faq', 'when the first pass comes out over the target the page encodes again with the bitrate cut by the overshoot, up to three passes, and tells you how many it took and whether the target was met.', 'a target is met within three passes, and the passes are said', B, async () => {
    const F = await fixtures();
    const target = Number((fs.statSync(F['big.mp4']).size / 1048576 / 2).toFixed(1));
    const r = await run(C, 'big.mp4', [['#vc-mode', 'size'], ['#vc-target', target]], /^Compress the video$/);
    return done(r, async ({ d, last, note, status }) => [d && d.bytes.length <= target * 1048576 && last.compress.passes <= 3 && new RegExp('Under the .* target( after ' + last.compress.passes + ' passes)?\\.').test(note), d.bytes.length + ' bytes for ' + target + ' MB; ' + note + ' / ' + status]);
  });
  claim(C, 'faq', 'when that is too few (under 0.018 bits per pixel per frame) it says so and suggests the resolution that would look better.', 'a starved target is flagged with a resolution', B, async () => {
    const r = await run(C, 'big.mp4', [['#vc-mode', 'size'], ['#vc-target', '0.5']]);
    return done(r, async ({ est }) => {
      /* 0.5 MB over 10 s with the 128 kbit/s sound kept leaves about 283 kbit/s: 0.0102 bits per pixel per frame at 1280 × 720 × 30, 0.023 at 852 × 480 */
      return [/will look blocky/.test(est) && /480p will look better/.test(est), est];
    });
  });
  claim(C, 'tip', 'Keeping the sound as it is copies it untouched: no loss, and nothing to wait for.', 'kept sound decodes to the same samples as the original', B, async () => {
    const r = await run(C, 'clip.mp4', [['#vc-mode', 'quality'], ['#vc-quality', 'small'], ['#vc-sound', 'copy']], /^Compress the video$/);
    return done(r, async ({ p, d, last }) => {
      const same = await p.evaluate(async (a64, b64) => {
        const dec = async (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return (await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(u.buffer)).getChannelData(0); };
        const x = await dec(a64), y = await dec(b64);
        let diff = 0; const n = Math.min(x.length, y.length);
        for (let i = 0; i < n; i++) diff = Math.max(diff, Math.abs(x[i] - y[i]));
        return { diff, nx: x.length, ny: y.length };
      }, fs.readFileSync((await fixtures())['clip.mp4']).toString('base64'), d.bytes.toString('base64'));
      return [last.last.audioRoute === 'copy' && same.diff === 0 && same.nx === same.ny, 'route ' + last.last.audioRoute + '; largest sample difference ' + same.diff + ' over ' + same.nx + ' samples'];
    });
  });
  claim(C, 'faq', 'The sound is copied as it was (AAC or Opus) or re-encoded as AAC, or as Opus where the browser has no AAC encoder.', 'an H.264 MP4 with AAC sound at 96 kbit/s', B, async () => {
    const r = await run(C, 'clip.mp4', [['#vc-mode', 'quality'], ['#vc-sound', '96']], /^Compress the video$/);
    return done(r, async ({ d, last }) => [d.type === 'video/mp4' && /^avc1/.test(last.last.videoCodec) && last.last.audioCodec === 'mp4a.40.2', d.type + ' ' + last.last.videoCodec + ' + ' + last.last.audioCodec]);
  });
  claim(C, 'tip', 'If the result is not smaller, the original was already well compressed. The page says so; keep the original.', 'the not-smaller note', B, async () => {
    const r = await run(C, 'clip.mp4', [['#vc-mode', 'quality'], ['#vc-quality', 'high']]);
    return done(r, async ({ est }) => [/not smaller than the original/.test(est), est]);
  });
  claim(C, 'ui', 'The settings you choose — target size, quality, resolution, frame rate and sound — are remembered in this browser; the video and its name are not kept.', 'one versioned key, no file name', B, async () => {
    const r = await run(C, 'clip.mp4', [['#vc-mode', 'quality'], ['#vc-quality', 'small']]);
    return done(r, async ({ p }) => {
      const keys = await p.evaluate(() => Object.keys(localStorage).filter((k) => /^1234tools-video/.test(k)).map((k) => k + '=' + localStorage.getItem(k)));
      return [keys.length === 1 && /^1234tools-video-compressor-v1=\{"v":1,/.test(keys[0]) && /"quality":"small"/.test(keys[0]) && !/clip/.test(keys[0]), keys.join(' ')];
    });
  });
  claim(C, 'point', 'Where the browser has no WebCodecs video encoder, the video is played once and recorded as it plays', 'the real-time route, said on the page', B, async () => {
    const r = await run(C, 'clip.mp4', [['#vc-mode', 'quality']], /^Compress the video$/, { flags: { __vkNoWebCodecs: true } });
    return done(r, async ({ d, note }) => [d && /^video\/(webm|mp4)/.test(d.type) && /Recorded in real time/.test(note), d && d.name + ' (' + d.type + '): ' + note.slice(0, 120)]);
  });
  manual(C, 'point', 'Files up to 2 GB. The new video is assembled in memory, so phones may run short before that', 'memory on a phone cannot be measured here; the 2 GB refusal is in VideoKit.probe');
  manual(C, 'table', 'Chrome, Edge (computer)', 'browser support table: checked by hand in each browser');

  /* ================================================================ */
  const R = '/video/video-trimmer/';
  claim(R, 'works', 'With a handle selected, the arrow keys move it one frame at a time (Shift moves a second), and the ◀ ▶ buttons do the same', 'one frame per key and per button, a second with Shift', B, async () => {
    const r = await run(R, 'clip.mp4', [['#vt-start', '1.5'], ['#vt-end', '3.2']]);
    return done(r, async ({ p }) => {
      await p.focus('.sv-trim-h');
      await p.keyboard.press('ArrowRight');
      const a = await p.$eval('#vt-start', (e) => e.value);
      await p.keyboard.down('Shift'); await p.keyboard.press('ArrowRight'); await p.keyboard.up('Shift');
      const b = await p.$eval('#vt-start', (e) => e.value);
      await p.evaluate(() => [...document.querySelectorAll('.vk-step button')].find((x) => /Start: one frame earlier/.test(x.getAttribute('aria-label'))).click());
      const c = await p.$eval('#vt-start', (e) => e.value);
      return [a === '1.533' && b === '2.533' && c === '2.500', '1.5 → ' + a + ' → Shift ' + b + ' → ◀ ' + c];
    });
  });
  claim(R, 'faq', 'Exact decodes the part you keep and encodes it again, so it starts on the very frame you chose.', 'the first frame shown is the one chosen', B, async () => {
    const r = await run(R, 'clip.mp4', [['#vt-start', '1.5'], ['#vt-end', '3.2'], ['#vt-mode', 'exact']], /^Trim the video$/);
    return done(r, async ({ p, d }) => {
      const v = await vt().readVideo(p, d.bytes, [0.01, 1.68]);
      return [v.ok && v.frames[0] === 45 && v.frames[1] === 95 && near(v.duration, 1.7, 0.05), JSON.stringify(v)];
    });
  });
  claim(R, 'faq', 'so the clip starts at the keyframe at or before your start, and the page tells you how much earlier that is.', 'Fast starts on the keyframe and says how much earlier', B, async () => {
    const r = await run(R, 'clip.mp4', [['#vt-start', '1.5'], ['#vt-end', '3.2'], ['#vt-mode', 'fast']], /^Trim the video$/);
    return done(r, async ({ p, d, est, note }) => {
      const v = await vt().readVideo(p, d.bytes, [0.01]);
      return [v.frames[0] === 30 && /keyframe at 0:01\.000, 0\.500 s before your start/.test(est) && /0\.500 s before your start/.test(note), 'first frame ' + v.frames[0] + '; ' + est];
    });
  });
  claim(R, 'faq', 'Yes. In both modes the sound is copied packet by packet for the part you keep.', 'Exact copies the sound; Fast keeps it in step', B, async () => {
    const r = await run(R, 'clip.mp4', [['#vt-start', '2.0'], ['#vt-end', '4.0'], ['#vt-mode', 'exact']], /^Trim the video$/);
    return done(r, async ({ p, d, last }) => {
      const a = await vt().readAudio(p, d.bytes);
      return [last.last.audioRoute === 'copy' && a.ok && a.pitches.join() === '800,800,1000,1000', 'route ' + last.last.audioRoute + ', pitches ' + (a.pitches || []).join(',')];
    });
  });
  claim(R, 'faq', 'An MP4 for MP4, MOV and MKV videos, and a WebM for WebM videos.', 'MOV in, MP4 out; WebM in, WebM out', B, async () => {
    const a = await run(R, 'clip.mov', [['#vt-mode', 'fast']], /^Trim the video$/);
    const one = await done(a, async ({ d }) => d.name + ' ' + d.type);
    const b = await run(R, 'clip.webm', [['#vt-mode', 'fast']], /^Trim the video$/);
    const two = await done(b, async ({ d }) => d.name + ' ' + d.type + ' ' + (d.bytes.readUInt32BE(0) === 0x1A45DFA3));
    return [one === 'clip-trimmed.mp4 video/mp4' && two === 'clip-trimmed.webm video/webm true', one + ' | ' + two];
  });
  manual(R, 'table', 'Firefox 130 and later (computer)', 'browser support table: checked by hand in each browser');

  /* ================================================================ */
  const V = '/video/video-converter/';
  claim(V, 'faq', 'the page copies them into an MP4 without re-encoding: no loss, and seconds for a long video.', 'MOV to MP4 carries the original sample bytes', B, async () => {
    const r = await run(V, 'clip.mov', [['#vv-format', 'mp4'], ['#vv-copy', true]], /^Convert the video$/);
    return done(r, async ({ d, last }) => {
      const src = fs.readFileSync((await fixtures())['clip.mov']);
      const hits = copiedBytes(src, d.bytes, 12, 64);
      return [last.convert.route === 'copy' && hits === 12 && d.bytes.slice(8, 12).toString('latin1') !== 'qt  ', hits + ' of 12 byte runs from the MOV found in ' + d.name + ', brand ' + d.bytes.slice(8, 12).toString('latin1')];
    });
  });
  claim(V, 'tip', 'WebM VP9 with Opus sound can go into an MP4 untouched too', 'WebM VP9 + Opus repackaged into MP4', B, async () => {
    const r = await run(V, 'clip.webm', [['#vv-format', 'mp4'], ['#vv-copy', true]], /^Convert the video$/);
    return done(r, async ({ p, d, last }) => {
      const v = await vt().readVideo(p, d.bytes, [3.02]);
      const bx = vt().mp4Boxes(d.bytes);
      return [last.convert.route === 'copy' && bx.handlers.join() === 'vide,soun' && v.ok && v.frames[0] === 90, 'route ' + last.convert.route + ', ' + bx.handlers + ', frame ' + v.frames[0]];
    });
  });
  claim(V, 'point', 'VP8 WebM files are always re-encoded for MP4, because MP4 has no place for VP8.', 'VP8 → re-encoded, and the reason shown', B, async () => {
    const r = await run(V, 'vp8.webm', [['#vv-format', 'mp4'], ['#vv-copy', true]], /^Convert the video$/);
    return done(r, async ({ est, last }) => [/VP8 video does not go into MP4/.test(est) && last.convert.route === 'encode', est]);
  });
  claim(V, 'faq', 'It is copied when it suits the new format (AAC or Opus into MP4, Opus or Vorbis into WebM), and re-encoded when it does not.', 'AAC sound re-encoded as Opus for WebM', B, async () => {
    const r = await run(V, 'clip.mp4', [['#vv-format', 'webm']], /^Convert the video$/);
    return done(r, async ({ p, d, last }) => {
      const a = await vt().readAudio(p, d.bytes);
      return [d.type === 'video/webm' && last.last.audioRoute === 'encode' && last.last.audioCodec === 'opus' && a.ok && a.pitches[11] === 1400, d.name + ' sound ' + last.last.audioCodec + ' (' + last.last.audioRoute + ')'];
    });
  });

  /* ================================================================ */
  const M = '/video/mute-video/';
  claim(M, 'faq', 'The stored picture frames are copied into the new file byte for byte; only the sound track is left out.', 'the picture bytes are the original\'s and no sound track is left', B, async () => {
    const r = await run(M, 'clip.mp4', [], /^Remove the sound$/);
    return done(r, async ({ d }) => {
      const src = fs.readFileSync((await fixtures())['clip.mp4']);
      const bx = vt().mp4Boxes(d.bytes);
      /* the mdat interleaves picture and sound: probe the first 40% of the source, where the picture's keyframes sit */
      const at = src.indexOf(Buffer.from('mdat')) + 4;
      let hits = 0;
      for (let i = 1; i <= 8; i++) { const off = at + 64 + i * 997; if (d.bytes.indexOf(src.subarray(off, off + 48)) >= 0) hits++; }
      return [bx.handlers.join() === 'vide' && hits >= 6, 'handlers ' + bx.handlers + '; ' + hits + ' of 8 byte runs of the original found'];
    });
  });
  claim(M, 'tip', 'MOV and MKV videos come out as MP4; WebM stays WebM.', 'MOV → MP4, WebM → WebM', B, async () => {
    const a = await run(M, 'clip.mov', [], /^Remove the sound$/);
    const one = await done(a, async ({ d }) => d.name);
    const b = await run(M, 'clip.webm', [], /^Remove the sound$/);
    const two = await done(b, async ({ d }) => d.name);
    return [one === 'clip-muted.mp4' && two === 'clip-muted.webm', one + ', ' + two];
  });
  claim(M, 'works', 'A phone video’s rotation flag is carried over, so an upright video stays upright.', 'a portrait (rotated) video stays portrait', B, async () => {
    const r = await run(M, 'rot.mp4', [], /^Remove the sound$/);
    return done(r, async ({ p, d }) => { const v = await vt().readVideo(p, d.bytes, []); return [v.ok && v.w === 360 && v.h === 640, v.w + ' × ' + v.h]; });
  });

  /* ================================================================ */
  const X = '/video/extract-audio/';
  claim(X, 'faq', 'With Original sound, untouched, the AAC sound inside most MP4s is copied out as an .m4a file with no re-encoding', 'the M4A decodes to exactly the video\'s sound', B, async () => {
    const r = await run(X, 'clip.mp4', [['#va-format', 'original']], /^Extract the sound$/);
    return done(r, async ({ p, d }) => {
      const same = await p.evaluate(async (a64, b64) => {
        const dec = async (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return (await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(u.buffer)).getChannelData(1); };
        const x = await dec(a64), y = await dec(b64);
        let diff = 0; for (let i = 0; i < Math.min(x.length, y.length); i++) diff = Math.max(diff, Math.abs(x[i] - y[i]));
        return { diff, nx: x.length, ny: y.length };
      }, fs.readFileSync((await fixtures())['clip.mp4']).toString('base64'), d.bytes.toString('base64'));
      return [d.name === 'clip.m4a' && d.type === 'audio/mp4' && same.diff === 0 && same.nx === same.ny, d.name + ' ' + d.type + ', difference ' + same.diff + ', ' + same.nx + '/' + same.ny + ' samples'];
    });
  });
  claim(X, 'tip', 'WAV is about 10 MB a minute at 44.1 kHz stereo', 'a 44.1 kHz stereo WAV is 176,400 bytes a second', B, async () => {
    const r = await run(X, 'clip44.mp4', [['#va-format', 'wav']], /^Extract the sound$/);
    return done(r, async ({ d }) => {
      const rate = d.bytes.readUInt32LE(24), ch = d.bytes.readUInt16LE(22), bps = d.bytes.readUInt32LE(28);
      const perMin = bps * 60 / 1048576;
      return [rate === 44100 && ch === 2 && bps === 176400 && near(perMin, 10, 0.2), rate + ' Hz, ' + ch + ' channels, ' + bps + ' bytes/s = ' + perMin.toFixed(2) + ' MB a minute'];
    });
  });
  claim(X, 'tip', 'Opus at 96 kbit/s is about 0.7 MB a minute.', 'the Opus file\'s size per second', B, async () => {
    const r = await run(X, 'clip.mp4', [['#va-format', 'opus'], ['#va-rate', '96']], /^Extract the sound$/);
    return done(r, async ({ d }) => {
      const perMin = d.bytes.length / 6.016 * 60 / 1048576;
      return [d.bytes.slice(0, 4).toString() === 'OggS' && near(perMin, 0.7, 0.15), d.bytes.length + ' bytes for 6.016 s = ' + perMin.toFixed(2) + ' MB a minute'];
    });
  });
  claim(X, 'tip', 'A part copied untouched starts and ends on whole packets, within about 0.03 s of the times typed; WAV and Opus cut to the sample.', 'a copied part is within 0.03 s; a WAV part exact', B, async () => {
    const a = await run(X, 'clip.mp4', [['#va-format', 'original'], ['#va-from', '2'], ['#va-to', '4']], /^Extract the sound$/);
    const copied = await done(a, async ({ p, d }) => (await vt().readAudio(p, d.bytes)).duration);
    const b = await run(X, 'clip.mp4', [['#va-format', 'wav'], ['#va-from', '2'], ['#va-to', '4']], /^Extract the sound$/);
    const frames = await done(b, async ({ d }) => (d.bytes.length - 44) / 4);
    return [near(copied, 2, 0.06) && frames === 96000, 'copied part ' + copied.toFixed(4) + ' s; WAV part ' + frames + ' samples at 48 kHz'];
  });
  claim(X, 'point', 'An MP3 sound track inside a video is copied out as an MP3.', 'MP3 is offered only as a copy', B, async () => {
    const r = await run(X, 'clip.mp4', []);
    return done(r, async ({ p }) => {
      const opts = await p.$$eval('#va-format option', (o) => o.map((x) => x.textContent).join(' | '));
      return [!/MP3/i.test(opts.replace(/\(\.mp3\)/, '')) , opts];
    });
  });
  manual(X, 'table', 'Yes, for files up to 600 MB', 'the decodeAudioData route needs a browser without AudioDecoder; the 600 MB guard is in VideoKit.audioBlocks');

  /* ================================================================ */
  const Z = '/video/video-resizer/';
  claim(Z, 'faq', 'Choose 9:16 and Fit, blurred copy behind: the whole picture sits in the middle of a vertical frame with a soft, darkened copy of itself filling the space above and below.', '9:16 over a blurred copy', B, async () => {
    const r = await run(Z, 'clip.mp4', [['#vr-shape', '9:16'], ['#vr-size', '360'], ['#vr-mode', 'blur']], /^Resize the video$/);
    return done(r, async ({ p, d }) => {
      const v = await vt().readVideo(p, d.bytes, []);
      return [v.ok && v.w === 360 && v.h === 640 && d.name === 'clip-360x640.mp4', d.name + ' ' + v.w + ' × ' + v.h];
    });
  });
  claim(Z, 'point', 'The size is never made larger than the original unless you tick Allow a size larger than the original.', 'no upscaling unless ticked', B, async () => {
    const r = await run(Z, 'clip.mp4', [['#vr-shape', 'keep'], ['#vr-size', '1080'], ['#vr-up', false]]);
    return done(r, async ({ p, est }) => {
      await p.evaluate(() => { const c = document.querySelector('#vr-up'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
      const est2 = await p.$eval('.vk-est', (e) => e.textContent);
      return [/becomes 640 × 360/.test(est) && /becomes 1920 × 1080/.test(est2), est.slice(0, 40) + ' / ' + est2.slice(0, 40)];
    });
  });
  claim(Z, 'faq', 'It is turned upright first, so the new frame is laid out the way the video is shown.', 'a rotated video stays upright', B, async () => {
    const r = await run(Z, 'rot.mp4', [['#vr-shape', 'keep'], ['#vr-size', '0']], /^Resize the video$/);
    return done(r, async ({ p, d }) => { const v = await vt().readVideo(p, d.bytes, []); return [v.w === 360 && v.h === 640, v.w + ' × ' + v.h]; });
  });
  const G = '/video/video-to-frames/';
  claim(G, 'faq', 'Each picture is the frame shown at the time asked for, decoded from the file, and its file name gives its frame number and the time it starts.', 'frame numbers and names agree', B, async () => {
    const r = await run(G, 'clip.mp4', [['#vf-what', 'interval'], ['#vf-interval', '2'], ['#vf-from', '0'], ['#vf-to', '6'], ['#vf-format', 'image/png']], /^Take the frames$/);
    return done(r, async ({ d }) => {
      const names = K.zipNames(d.bytes).map((e) => e.name);
      return [names.join() === 'clip-frame-000-0_000s.png,clip-frame-060-2_000s.png,clip-frame-120-4_000s.png', names.join(', ')];
    });
  });
  claim(G, 'point', 'Up to 1,000 frames a run, at the video’s own resolution.', 'PNGs at the video’s size', B, async () => {
    const r = await run(G, 'clip.mp4', [['#vf-what', 'count'], ['#vf-count', '2'], ['#vf-format', 'image/png']], /^Take the frames$/);
    return done(r, async ({ d }) => { const e = K.zipNames(d.bytes); const ok = e.every((x) => K.isPng(x.data) && x.data.readUInt32BE(16) === 640 && x.data.readUInt32BE(20) === 360); return [e.length === 2 && ok, e.length + ' PNGs at ' + e.map((x) => x.data.readUInt32BE(16) + ' × ' + x.data.readUInt32BE(20)).join(', ')]; });
  });
  manual('/video/screen-recorder/', 'point', 'Sound from the tab is shared by Chrome and Edge, and the whole system’s sound on Windows; other browsers record the picture only.', 'browser behaviour; the recorder is checked with Chrome’s test screen in build/video/tests/video-more.js');
  manual('/video/webcam-recorder/', 'table', 'Safari 14.1 and later', 'browser support table: checked by hand');

  /* ================================================================ */
  manual('/video/', 'hub', 'Up to 2 GB.', 'the size limit: the refusal is in VideoKit.probe; a 2 GB file is not made in the test run');
  manual('/video/', 'hub', 'Chrome and Edge on a computer do everything fastest.', 'browser comparison: checked by hand');
};
