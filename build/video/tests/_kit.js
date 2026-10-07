/*
 * What the /video/ and /audio/ browser tests share: flags, the static
 * server (build/tests/serve.js), headless Chrome through puppeteer-core, a
 * page opener that records downloads and refuses every request that leaves
 * 127.0.0.1, check() counting — and the fixtures and the readers, written
 * here and never taken from the engines:
 *
 *   makeVideo(p, o) — a test video made in the page with WebCodecs and the
 *     vendored muxers called directly (not engine/render-video.js):
 *     o = { box: 'mp4'|'webm', w, h, fps, seconds, audio: bool, video: bool
 *     (false: an M4A, sound only), rotation, keyEvery (frames), rate (audio),
 *     noise, bitrate }. Each frame shows its own number in
 *     binary as 10 black or white squares along the top; the sound is a
 *     sine whose pitch steps every whole second, 400 + 200 × s Hz, on both
 *     channels — so any frame says which moment it is, and any stretch of
 *     sound says which second it came from.
 *   readVideo(p, bytes, times) — the browser's own <video> plays the file
 *     back: duration, size, and the frame number shown at each time.
 *   readAudio(p, bytes) — the browser's own decodeAudioData: duration,
 *     channels, rate, and the pitch heard in each half second (Goertzel
 *     over the candidate pitches).
 *   mp4Boxes(bytes) — top-level boxes and the handler of each trak, read
 *     here from ISO/IEC 14496-12; webmHead(bytes) — the EBML DocType.
 *
 * Flags every suite takes: --root <site> (default: this checkout),
 * --port <n> (9020–9039 for this wave), --out <dir>, --chrome <exe>.
 */
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function (o) {
  const args = process.argv.slice(2);
  const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
  const ROOT = path.resolve(flag('root', path.join(__dirname, '..', '..', '..')));
  const PORT = Number(flag('port', o.port));
  const OUT = path.resolve(flag('out', path.join('E:/tmp/w6new-out/tests', o.name)));
  const CHROME = flag('chrome', null) || process.env.CHROME || process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const BASE = 'http://127.0.0.1:' + PORT;
  fs.mkdirSync(OUT, { recursive: true });
  let puppeteer;
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), 'E:/projects/1234Tools/node_modules/puppeteer-core', 'puppeteer-core']) {
    try { puppeteer = require(p); break; } catch (e) { /* next */ }
  }
  const T = { ROOT, PORT, OUT, BASE, flag, passes: 0, fails: [], outside: [], errors: [] };
  T.check = (ok, what) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what); if (ok) T.passes++; else T.fails.push(what); return !!ok; };
  T.section = (s) => console.log('\n' + s);
  T.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  T.start = async (extraArgs) => {
    if (!puppeteer) throw new Error('puppeteer-core not found');
    const { serve } = require(path.join(ROOT, 'build/tests/serve.js'));
    T.server = await serve(ROOT, PORT);
    T.browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--font-render-hinting=none', '--autoplay-policy=no-user-gesture-required'].concat(extraArgs || []), protocolTimeout: 600000 });
    console.log(o.name + ': ' + ROOT + ' on ' + BASE);
  };

  T.open = async (url, opt) => {
    opt = opt || {};
    const p = await T.browser.newPage();
    await p.setViewport({ width: opt.width || 1400, height: opt.height || 1000, deviceScaleFactor: 1 });
    await p.setBypassServiceWorker(true);
    /* interception pauses a dedicated worker's own requests and can leave them paused (the voice and speech
       models load in workers), so pages with a worker are opened with intercept: false: an outside request is
       then still recorded, and fails the run, but is not refused */
    const icpt = opt.intercept !== false;
    if (icpt) await p.setRequestInterception(true);
    p.on('request', (r) => {
      const u = r.url();
      if (/^(data|blob):/.test(u) || u.startsWith(BASE)) return icpt ? r.continue() : undefined;
      T.outside.push(url + ' -> ' + u);
      return icpt ? r.abort() : undefined;
    });
    p.on('pageerror', (e) => T.errors.push(url + ': ' + String(e && e.message || e)));
    if (opt.console) p.on('console', (m) => console.log('    [page] ' + m.text()));
    await p.evaluateOnNewDocument((theme, keep, flags) => {
      try { localStorage.setItem('1234tools-consent', 'denied'); if (theme) localStorage.setItem('1234tools-theme', theme); } catch (e) { /* */ }
      if (!keep) { try { Object.keys(localStorage).filter((k) => /^1234tools-/.test(k) && !/^1234tools-(consent|theme)$/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* */ } }
      window.__downloads = [];
      for (const k of Object.keys(flags || {})) window[k] = flags[k];
      HTMLAnchorElement.prototype.click = function () {
        const a = this;
        if (a.download) window.__downloads.push(fetch(a.href).then((r) => r.blob()).then(async (b) => ({ name: a.download, type: b.type, b64: await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(b); }) })));
      };
    }, opt.theme || null, !!opt.keepStorage, opt.flags || {});
    await p.goto(BASE + url, { waitUntil: 'load', timeout: 120000 });
    await p.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
    await p.waitForSelector(opt.wait || '.tool-io > *', { timeout: 30000 });
    return p;
  };
  T.downloads = async (p) => (await p.evaluate(() => Promise.all(window.__downloads))).map((d) => ({ name: d.name, type: d.type, bytes: Buffer.from(d.b64, 'base64') }));
  T.clearDownloads = (p) => p.evaluate(() => { window.__downloads = []; });
  T.waitDownloads = async (p, n, ms) => { await p.waitForFunction((n) => window.__downloads.length >= n, { timeout: ms || 300000, polling: 200 }, n); return T.downloads(p); };
  T.save = (name, bytes) => { const f = path.join(OUT, name); fs.writeFileSync(f, bytes); return f; };
  T.upload = async (p, file, sel) => { const inp = await p.$(sel || '.tool-io input[type=file]'); await inp.uploadFile(file); };
  T.status = (p) => p.evaluate(() => { const s = document.querySelector('.tool-io .aiimg-status'); return s ? s.textContent : ''; });
  T.msg = (p) => p.evaluate(() => { const s = document.querySelector('.tool-io .io-msg'); return s ? { text: s.textContent, cls: s.className } : null; });
  T.setVal = (p, sel, v) => p.evaluate((sel, v) => { const e = document.querySelector(sel); if (!e) throw new Error('no ' + sel); if (e.type === 'checkbox') e.checked = !!v; else e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
  T.press = (p, re, scope) => p.evaluate((src, scope) => { const b = [...document.querySelectorAll((scope || '.tool-io') + ' button')].find((x) => new RegExp(src).test(x.textContent) && !x.hidden); if (!b) throw new Error('no button ' + src); b.click(); }, re.source, scope || null);
  T.waitDone = (p, ms) => p.waitForFunction(() => { const s = document.querySelector('.tool-io .aiimg-status'); return s && /^(Done|Cancelled|It did not work)/.test(s.textContent); }, { timeout: ms || 300000, polling: 250 });

  /* ---------------------------------------------------------------- */
  /* fixtures, made with WebCodecs and the muxers directly             */
  /* ---------------------------------------------------------------- */
  T.makeVideo = async (p, o) => {
    const b64 = await p.evaluate(async (o) => {
      const W = o.w || 640, H = o.h || 360, fps = o.fps || 30, secs = o.seconds || 6, rate = o.rate || 48000;
      const box = o.box || 'mp4';
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d');
      const draw = (i) => {
        x.fillStyle = '#2050c0'; x.fillRect(0, 0, W, H);
        x.fillStyle = '#d02020'; x.fillRect(0, H * 0.55, W / 3, H * 0.45);
        x.fillStyle = '#20a040'; x.fillRect(((i * 7) % W), H * 0.35, W / 10, H / 10);
        if (o.noise) {
          /* a band of moving noise, so the encoder needs its whole bitrate (seeded: the same clip every run) */
          let seed = (i + 1) * 2654435761 >>> 0;
          const nw = 32, nh = 8, img = x.createImageData(nw, nh);
          for (let k = 0; k < img.data.length; k += 4) { seed = (seed * 1664525 + 1013904223) >>> 0; const g = seed >>> 24; img.data[k] = g; img.data[k + 1] = (g * 3) & 255; img.data[k + 2] = 255 - g; img.data[k + 3] = 255; }
          const tmp = document.createElement('canvas'); tmp.width = nw; tmp.height = nh; tmp.getContext('2d').putImageData(img, 0, 0);
          x.imageSmoothingEnabled = false; x.drawImage(tmp, W / 3, H * 0.55, W * 2 / 3, H * 0.45);
        }
        const sq = Math.floor(W / 12);
        for (let b = 0; b < 10; b++) { x.fillStyle = (i >> (9 - b)) & 1 ? '#ffffff' : '#000000'; x.fillRect(sq * 0.5 + b * sq * 1.1, 4, sq, sq * 0.8); }
      };
      let mux, target;
      const vcodec = box === 'webm' ? (o.vcodec || 'vp09.00.10.08') : (W * H > 414720 ? 'avc1.42002a' : 'avc1.42001f');
      if (box === 'webm') {
        const M = await import('/engine/vendor/webm-muxer.mjs');
        target = new M.ArrayBufferTarget();
        mux = new M.Muxer({ target, type: 'webm', video: { codec: vcodec === 'vp8' ? 'V_VP8' : 'V_VP9', width: W, height: H, frameRate: fps }, audio: o.audio === false ? undefined : { codec: 'A_OPUS', numberOfChannels: 2, sampleRate: 48000 } });
      } else {
        const M = await import('/engine/vendor/mp4-muxer.mjs');
        target = new M.ArrayBufferTarget();
        mux = new M.Muxer({ target, fastStart: 'in-memory', video: o.video === false ? undefined : { codec: 'avc', width: W, height: H, frameRate: fps, rotation: o.rotation || 0 }, audio: o.audio === false ? undefined : { codec: 'aac', numberOfChannels: 2, sampleRate: rate } });
      }
      if (o.video !== false) {
      const venc = new VideoEncoder({ output: (ch, m) => mux.addVideoChunk(ch, m), error: (e) => { throw e; } });
      const cfg = { codec: vcodec, width: W, height: H, bitrate: o.bitrate || 1.5e6, framerate: fps };
      if (box !== 'webm') cfg.avc = { format: 'avc' };
      venc.configure(cfg);
      const n = Math.round(secs * fps);
      for (let i = 0; i < n; i++) {
        draw(i);
        const f = new VideoFrame(c, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        venc.encode(f, { keyFrame: i % (o.keyEvery || 30) === 0 });
        f.close();
        while (venc.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 2));
      }
      await venc.flush();
      }
      if (o.audio !== false) {
        const ar = box === 'webm' ? 48000 : rate;
        const aenc = new AudioEncoder({ output: (ch, m) => mux.addAudioChunk(ch, m), error: (e) => { throw e; } });
        aenc.configure({ codec: box === 'webm' ? 'opus' : 'mp4a.40.2', sampleRate: ar, numberOfChannels: 2, bitrate: 128000 });
        const total = Math.round(secs * ar);
        const STEP = 4800;
        let phase = 0;
        for (let i = 0; i < total; i += STEP) {
          const k = Math.min(STEP, total - i);
          const d = new Float32Array(k * 2);
          for (let j = 0; j < k; j++) {
            const t = (i + j) / ar;
            const f = 400 + 200 * Math.floor(t);
            phase += 2 * Math.PI * f / ar;
            const v = 0.3 * Math.sin(phase);
            d[j] = v; d[k + j] = v;
          }
          const ad = new AudioData({ format: 'f32-planar', sampleRate: ar, numberOfFrames: k, numberOfChannels: 2, timestamp: Math.round(i * 1e6 / ar), data: d });
          aenc.encode(ad); ad.close();
        }
        await aenc.flush();
      }
      mux.finalize();
      const u8 = new Uint8Array(target.buffer);
      let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    }, o);
    return Buffer.from(b64, 'base64');
  };

  /** The browser's own player: duration, size and the frame number shown at each time. */
  T.readVideo = (p, bytes, times, type) => p.evaluate(async (b64, times, type) => {
    const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([u8], { type: type || 'video/mp4' }));
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url;
    const ok = await new Promise((res) => { v.onloadeddata = () => res(true); v.onerror = () => res(false); setTimeout(() => res(false), 20000); });
    if (!ok) return { ok: false };
    if (!isFinite(v.duration)) { v.currentTime = 1e9; await new Promise((r) => { v.onseeked = r; setTimeout(r, 3000); }); }
    const out = { ok: true, duration: v.duration, w: v.videoWidth, h: v.videoHeight, frames: [] };
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    const x = c.getContext('2d', { willReadFrequently: true });
    for (const t of times || []) {
      v.currentTime = t;
      await new Promise((r) => { v.onseeked = r; setTimeout(r, 4000); });
      /* after a seek the new frame is painted a moment later: wait for it */
      if (v.requestVideoFrameCallback) await new Promise((r) => { v.requestVideoFrameCallback(() => r()); setTimeout(r, 1500); });
      x.drawImage(v, 0, 0);
      const W = c.width, sq = Math.floor(W / 12);
      let n = 0;
      for (let b = 0; b < 10; b++) {
        const px = x.getImageData(Math.round(sq * 0.5 + b * sq * 1.1 + sq / 2), Math.round(4 + sq * 0.4), 1, 1).data;
        n = (n << 1) | ((px[0] + px[1] + px[2]) / 3 > 128 ? 1 : 0);
      }
      out.frames.push(n);
    }
    URL.revokeObjectURL(url);
    return out;
  }, Buffer.from(bytes).toString('base64'), times || [], type || null);

  /** The browser's own audio decoder: duration, channels, rate and the pitch in each half second. */
  T.readAudio = (p, bytes) => p.evaluate(async (b64) => {
    const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    let ab;
    try { ab = await ctx.decodeAudioData(u8.buffer); } catch (e) { return { ok: false, why: String(e && e.message || e) }; }
    const r = ab.sampleRate, d = ab.getChannelData(0);
    const pitches = [];
    const cands = []; for (let f = 400; f <= 3000; f += 200) cands.push(f);
    for (let s0 = 0; s0 + r * 0.2 <= d.length; s0 += Math.round(r * 0.5)) {
      const a = s0 + Math.round(r * 0.15), n = Math.round(r * 0.2);
      let best = 0, bestP = 0, energy = 0;
      for (let i = a; i < Math.min(d.length, a + n); i++) energy += d[i] * d[i];
      for (const f of cands) {
        const w = 2 * Math.PI * f / r, cw = 2 * Math.cos(w);
        let s1 = 0, s2 = 0;
        for (let i = a; i < Math.min(d.length, a + n); i++) { const s = d[i] + cw * s1 - s2; s2 = s1; s1 = s; }
        const pw = s1 * s1 + s2 * s2 - cw * s1 * s2;
        if (pw > bestP) { bestP = pw; best = f; }
      }
      pitches.push(energy / n > 1e-4 ? best : 0);
    }
    let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    return { ok: true, duration: ab.duration, channels: ab.numberOfChannels, rate: r, pitches, peak };
  }, Buffer.from(bytes).toString('base64'));

  /** ISO BMFF top-level boxes, and each trak's handler type, read from the bytes. */
  T.mp4Boxes = (b) => {
    const top = [];
    let p = 0;
    while (p + 8 <= b.length) {
      let size = b.readUInt32BE(p); const type = b.slice(p + 4, p + 8).toString('latin1');
      if (size === 1) size = Number(b.readBigUInt64BE(p + 8)); else if (size === 0) size = b.length - p;
      if (size < 8) break;
      top.push({ type, start: p, size });
      p += size;
    }
    /* moov → trak → mdia → hdlr: the handler type sits 8 bytes into the hdlr body (after version, flags and pre_defined) */
    const kids = (start, end) => { const out = []; let q = start; while (q + 8 <= end) { const n = b.readUInt32BE(q); if (n < 8 || q + n > end) break; out.push({ type: b.slice(q + 4, q + 8).toString('latin1'), body: q + 8, end: q + n }); q += n; } return out; };
    const handlers = [];
    const moov = top.find((x) => x.type === 'moov');
    if (moov) for (const trak of kids(moov.start + 8, moov.start + moov.size).filter((x) => x.type === 'trak')) {
      const mdia = kids(trak.body, trak.end).find((x) => x.type === 'mdia');
      const hdlr = mdia && kids(mdia.body, mdia.end).find((x) => x.type === 'hdlr');
      if (hdlr) handlers.push(b.slice(hdlr.body + 8, hdlr.body + 12).toString('latin1'));
    }
    return { top: top.map((x) => x.type), handlers, brand: b.slice(8, 12).toString('latin1') };
  };
  T.webmHead = (b) => {
    if (b.readUInt32BE(0) !== 0x1A45DFA3) return null;
    const s = b.slice(0, 64).toString('latin1');
    return { webm: s.indexOf('webm') > 0 };
  };

  /** 390 / 1400 px, dark and light: no sideways scroll; a screenshot of each, optionally after `prep`. */
  T.layouts = async (url, prep) => {
    for (const [w, theme] of [[390, 'dark'], [1400, 'dark'], [390, 'light'], [1400, 'light']]) {
      const p = await T.open(url, { width: w, height: 900, theme });
      await p.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); }, theme);
      if (prep) await prep(p);
      await T.sleep(400);
      const m = await p.evaluate(() => {
        const wide = [...document.querySelectorAll('main *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1) && !e.closest('.vk-support-wrap, pre, .crumbs'); }).slice(0, 3).map((e) => e.tagName + '.' + e.className);
        return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, wide };
      });
      T.check(m.sw <= m.iw && !m.wide.length, url + ' at ' + w + ' px, ' + theme + ': no sideways scroll (page ' + m.sw + ' of ' + m.iw + ' px' + (m.wide.length ? '; too wide: ' + m.wide.join(', ') : '') + ')');
      await p.screenshot({ path: path.join(OUT, url.replace(/\W+/g, '_') + w + '-' + theme + '.png'), fullPage: false });
      await p.close();
    }
  };
  /** Every control in the tool reachable by Tab, with a label. */
  T.keyboard = (p) => p.evaluate(() => {
    const io = document.querySelector('.tool-io');
    const ctl = [...io.querySelectorAll('button, input, select, textarea, [role=button], [role=slider]')].filter((e) => e.offsetParent !== null && e.type !== 'file');
    const bad = ctl.filter((e) => e.tabIndex < 0);
    const unlabelled = ctl.filter((e) => /INPUT|SELECT|TEXTAREA/.test(e.tagName) && e.type !== 'checkbox' && !(e.labels && e.labels.length) && !e.getAttribute('aria-label'));
    const nameless = ctl.filter((e) => e.tagName === 'BUTTON' && !(e.textContent.trim() || e.getAttribute('aria-label')));
    return { n: ctl.length, bad: bad.map((e) => e.outerHTML.slice(0, 80)), unlabelled: unlabelled.map((e) => e.id || e.outerHTML.slice(0, 60)), nameless: nameless.length };
  });

  T.finish = async () => {
    try { if (T.browser) await T.browser.close(); } catch (e) { /* */ }
    if (T.server) T.server.close();
    T.section('requests outside 127.0.0.1: ' + (T.outside.length ? T.outside.join(' | ') : 'none'));
    if (T.errors.length) console.log('page errors: ' + T.errors.join(' | '));
    T.check(!T.outside.length, 'no request left 127.0.0.1');
    T.check(!T.errors.length, 'no page error');
    console.log('\n' + o.name + ': ' + T.passes + ' passed, ' + T.fails.length + ' failed');
    if (T.fails.length) T.fails.forEach((f) => console.log('  FAIL ' + f));
    process.exit(T.fails.length ? 1 : 0);
  };
  return T;
};
