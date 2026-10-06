(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

/* Scan to PDF.
   Photos of paper pages, from the file picker or the camera panel, become
   one PDF. Each photo gets a card: the photo with the page's corners drawn
   on it (found by engine/pdf-scan-vision.js, draggable, keyboard-movable),
   a small preview of the straightened page, turn, reorder and remove. The
   heavy work (decoding at full resolution, finding the edges, the
   perspective warp, the enhancement, the JPEG encoding) runs in
   engine/pdf-scan-worker.js, a dedicated worker; where a worker or
   OffscreenCanvas is missing the same code runs on the page.
   Corners are kept as fractions of the photo (EXIF orientation applied),
   so they mean the same thing on the 640 px card and on the full photo. */

const PAPER = { a4: [595.28, 841.89], letter: [612, 792] };
const PAPER_NAME = { a4: 'A4', letter: 'Letter' };
const MODES = { colour: 'Colour document', grey: 'Greyscale', bw: 'Black and white', none: 'None (as photographed)' };
const LOW = 0.75;           /* below this the card says "Check the corners" */
const MAX_SIDE = 2500;      /* the straightened page's long side, in pixels */
const CORNERS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'];

function abortError() { const e = new Error('Cancelled'); e.name = 'AbortError'; return e; }
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const whole = () => [[0, 0], [1, 0], [1, 1], [0, 1]];
const copyQuad = (q) => q.map((p) => [p[0], p[1]]);
const sameQuad = (a, b) => a && b && a.every((p, i) => Math.abs(p[0] - b[i][0]) < 1e-6 && Math.abs(p[1] - b[i][1]) < 1e-6);

/** A convex quadrilateral with its corners in turn; a crossed one (two
    handles dragged past each other) is put back in order. */
function usableQuad(q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(z) < 1e-9) continue;
    if (!sign) sign = Math.sign(z);
    else if (Math.sign(z) !== sign) return window.MVRScanVision ? window.MVRScanVision.orderCorners(q) : q;
  }
  return q;
}

/* ---------- the worker, or the page when there is none ---------- */

function makeRunner(S) {
  let w = null, ready = null, seq = 0, onPage = false;
  const pend = new Map();
  function start() {
    if (ready) return ready;
    ready = new Promise((resolve) => {
      if (typeof Worker !== 'function' || location.protocol === 'file:') { onPage = true; resolve(false); return; }
      let wk;
      try { wk = new Worker(S.base + 'pdf-scan-worker.js'); } catch (e) { onPage = true; resolve(false); return; }
      let settled = false;
      const t = setTimeout(() => { if (!settled) { settled = true; try { wk.terminate(); } catch (e) { /* */ } onPage = true; resolve(false); } }, 15000);
      wk.onmessage = (ev) => {
        const m = ev.data || {};
        if (m.hello) {
          clearTimeout(t); settled = true;
          if (m.ok) { w = wk; resolve(true); } else { try { wk.terminate(); } catch (e) { /* */ } onPage = true; resolve(false); }
          return;
        }
        const p = pend.get(m.id);
        if (!p) return;
        pend.delete(m.id);
        if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error));
      };
      wk.onerror = (ev) => {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (!settled) { clearTimeout(t); settled = true; try { wk.terminate(); } catch (e) { /* */ } onPage = true; resolve(false); return; }
        const err = new Error((ev && ev.message) || 'The scanner stopped unexpectedly.');
        pend.forEach((p) => p.reject(err)); pend.clear();
        kill();
      };
    });
    return ready;
  }
  async function call(op, blob, opts, signal) {
    if (signal && signal.aborted) throw abortError();
    const inWorker = await start();
    if (!inWorker) {
      await S.pageJobs();
      const r = await window.MVRScanJobs[op](blob, opts);
      if (signal && signal.aborted) throw abortError();
      return r;
    }
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const onAbort = () => { kill(); reject(abortError()); };
      pend.set(id, {
        resolve: (r) => { if (signal) signal.removeEventListener('abort', onAbort); resolve(r); },
        reject: (e) => { if (signal) signal.removeEventListener('abort', onAbort); reject(e); }
      });
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      w.postMessage({ id, op, blob, opts });
    });
  }
  /** Cancel: the worker is stopped outright, part-way through a page if need be. */
  function kill() {
    if (w) { try { w.terminate(); } catch (e) { /* */ } }
    w = null; ready = null;
    const p = [...pend.values()]; pend.clear();
    p.forEach((x) => x.reject(abortError()));
  }
  return { call, kill, where: () => onPage ? 'page' : (w ? 'worker' : 'not started') };
}

/* ---------- state, one tool per page ---------- */

const S = {
  api: null, io: null, shellRoot: null, base: '',
  pages: new Map(),        /* entry id -> page */
  order: [],               /* entry ids, when the shell's own list cannot be reached */
  list: null, head: null, chain: Promise.resolve(),
  detector: null, runner: null, vision: null, jobs: null
};

S.pageJobs = () => S.jobs || (S.jobs = S.api.loadScript('pdf-scan-vision.js').then(() => S.api.loadScript('pdf-scan-worker.js')));
S.loadVision = () => S.vision || (S.vision = S.api.loadScript('pdf-scan-vision.js').catch(() => null));

function shellEntries() {
  if (!S.shellRoot) {
    let n = S.api && S.api.root;
    while (n && !n.__pdfShell) n = n.parentElement;
    S.shellRoot = n || null;
  }
  return S.shellRoot && S.shellRoot.__pdfShell.entries ? S.shellRoot.__pdfShell.entries() : null;
}

/** The photos in the order they will be pages: the shell's own list where
    it can be reached (so its order and this panel's are one), else ours. */
function ordered() {
  const live = shellEntries();
  if (live) return live.slice();
  const all = S.api.allEntries();
  const ids = all.map((e) => e.id);
  S.order = S.order.filter((id) => ids.indexOf(id) >= 0);
  ids.forEach((id) => { if (S.order.indexOf(id) < 0) S.order.push(id); });
  return S.order.map((id) => all.find((e) => e.id === id));
}

function move(pg, dir) {
  const live = shellEntries();
  if (live) {
    const i = live.findIndex((e) => e.id === pg.id), j = i + dir;
    if (i < 0 || j < 0 || j >= live.length) return;
    const [e] = live.splice(i, 1);
    live.splice(j, 0, e);
    S.api.refreshFiles();
  } else {
    const i = S.order.indexOf(pg.id), j = i + dir;
    if (i < 0 || j < 0 || j >= S.order.length) return;
    S.order.splice(i, 1);
    S.order.splice(j, 0, pg.id);
  }
  sync();
  const b = pg.card.querySelector(dir < 0 ? '.scan-up' : '.scan-down');
  const other = pg.card.querySelector(dir < 0 ? '.scan-down' : '.scan-up');
  if (b && !b.disabled) b.focus(); else if (other) other.focus();
}

/* ---------- the cards ---------- */

function sync() {
  if (!S.api || !S.list) return;
  const entries = ordered();
  const ids = new Set(entries.map((e) => e.id));
  for (const [id, pg] of S.pages) {
    if (!ids.has(id)) { pg.gone = true; pg.card.remove(); S.pages.delete(id); }
  }
  entries.forEach((e, i) => {
    let pg = S.pages.get(e.id);
    if (!pg) { pg = newPage(e); S.pages.set(e.id, pg); }
    pg.entry = e;
    pg.index = i;
    if (e.state === 'ready' && pg.status === 'waiting') queueDetect(pg);
    if (e.state === 'error' && pg.status !== 'error') { pg.status = 'error'; pg.error = e.error || 'This file could not be read.'; }
    S.list.appendChild(pg.card);
    paintCard(pg, entries.length);
  });
  S.wrap.hidden = !entries.length;
  S.head.textContent = entries.length === 1 ? '1 page' : entries.length + ' pages';
}

function newPage(e) {
  const pg = { id: e.id, entry: e, status: 'waiting', error: '', quad: null, det: null, turns: 0, moved: false, thumb: null, promise: null };
  const el = S.api.el, btn = S.api.btn;
  const card = el('li', 'scan-card');
  card.dataset.id = String(e.id);
  const head = el('div', 'scan-card-head');
  pg.num = el('span', 'scan-num', '1');
  pg.name = el('span', 'scan-name', e.name);
  pg.flag = el('span', 'scan-flag', 'Check the corners');
  pg.flag.hidden = true;
  head.appendChild(pg.num); head.appendChild(pg.name); head.appendChild(pg.flag);
  card.appendChild(head);

  const body = el('div', 'scan-card-body');
  const stage = el('div', 'scan-stage');
  pg.photo = el('canvas', 'scan-photo');
  pg.photo.width = 4; pg.photo.height = 3;
  pg.photo.setAttribute('role', 'img');
  pg.photo.setAttribute('aria-label', 'Photo ' + e.name + ' with the page\'s corners marked');
  stage.appendChild(pg.photo);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'scan-quad');
  svg.setAttribute('viewBox', '0 0 1000 1000');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  pg.shade = document.createElementNS(NS, 'path');
  pg.shade.setAttribute('class', 'scan-quad-shade');
  pg.shade.setAttribute('fill-rule', 'evenodd');
  pg.outline = document.createElementNS(NS, 'polygon');
  pg.outline.setAttribute('class', 'scan-quad-line');
  pg.outline.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.appendChild(pg.shade); svg.appendChild(pg.outline);
  stage.appendChild(svg);
  pg.handles = CORNERS.map((label, k) => {
    const h = el('button', 'scan-handle');
    h.type = 'button';
    h.dataset.corner = String(k);
    h.title = label + ' corner: drag it, or use the arrow keys (Shift for bigger steps)';
    h.addEventListener('pointerdown', (ev) => dragStart(pg, k, ev));
    h.addEventListener('keydown', (ev) => nudge(pg, k, ev));
    stage.appendChild(h);
    return h;
  });
  pg.busy = el('div', 'scan-busy', 'Finding the edges…');
  stage.appendChild(pg.busy);
  pg.stage = stage;
  body.appendChild(stage);

  const side = el('div', 'scan-side');
  const fig = el('figure', 'scan-result');
  pg.preview = el('canvas', 'scan-preview');
  pg.preview.width = 3; pg.preview.height = 4;
  pg.preview.setAttribute('role', 'img');
  fig.appendChild(pg.preview);
  fig.appendChild(el('figcaption', null, 'Straightened'));
  side.appendChild(fig);
  pg.status_ = el('p', 'scan-status');
  pg.status_.setAttribute('aria-live', 'polite');
  side.appendChild(pg.status_);
  body.appendChild(side);
  card.appendChild(body);

  const tools = el('div', 'scan-tools');
  const mk = (label, cls, title, fn) => { const b = btn(label, 'btn-ghost ' + cls); b.title = title; b.addEventListener('click', fn); tools.appendChild(b); return b; };
  pg.bLeft = mk('↺ Turn left', 'scan-left', 'Turn the page a quarter turn anticlockwise', () => { pg.turns = (pg.turns + 3) % 4; afterEdit(pg); });
  pg.bRight = mk('↻ Turn right', 'scan-right', 'Turn the page a quarter turn clockwise', () => { pg.turns = (pg.turns + 1) % 4; afterEdit(pg); });
  pg.bReset = mk('Reset to detected', 'scan-reset', 'Put the corners back where they were found', () => { if (pg.det) { pg.quad = copyQuad(pg.det.quad); pg.moved = false; afterEdit(pg); } });
  pg.bWhole = mk('Use the whole photo', 'scan-whole', 'Put the corners at the photo\'s own corners', () => { pg.quad = whole(); pg.moved = true; afterEdit(pg); });
  pg.bUp = mk('↑', 'scan-up', 'Move this page up', () => move(pg, -1));
  pg.bDown = mk('↓', 'scan-down', 'Move this page down', () => move(pg, 1));
  pg.bRemove = mk('Remove', 'scan-remove', 'Remove this page', () => { S.api.removeEntry(pg.entry); setTimeout(sync, 0); });
  card.appendChild(tools);
  pg.card = card;
  return pg;
}

function paintCard(pg, total) {
  const n = pg.index + 1;
  pg.num.textContent = String(n);
  pg.name.textContent = pg.entry.name;
  pg.bUp.disabled = pg.index === 0;
  pg.bDown.disabled = pg.index >= total - 1;
  pg.bUp.setAttribute('aria-label', 'Move page ' + n + ' up');
  pg.bDown.setAttribute('aria-label', 'Move page ' + n + ' down');
  pg.bLeft.setAttribute('aria-label', 'Turn page ' + n + ' left');
  pg.bRight.setAttribute('aria-label', 'Turn page ' + n + ' right');
  pg.bReset.setAttribute('aria-label', 'Page ' + n + ': reset the corners to the detected ones');
  pg.bWhole.setAttribute('aria-label', 'Page ' + n + ': use the whole photo');
  pg.bRemove.setAttribute('aria-label', 'Remove page ' + n + ', ' + pg.entry.name);
  pg.handles.forEach((h, k) => h.setAttribute('aria-label', CORNERS[k] + ' corner of page ' + n + '. Arrow keys move it; Shift moves it further.'));
  pg.preview.setAttribute('aria-label', 'Page ' + n + ' as it will be in the PDF');
  const ready = pg.status === 'ready';
  pg.busy.hidden = !(pg.status === 'waiting' || pg.status === 'queued' || pg.status === 'detecting');
  pg.busy.textContent = pg.entry.state === 'loading' ? 'Reading…' : 'Finding the edges…';
  pg.handles.forEach((h) => { h.hidden = !ready; });
  [pg.bLeft, pg.bRight, pg.bReset, pg.bWhole].forEach((b) => { b.disabled = !ready; });
  pg.bReset.disabled = !ready || !pg.det || sameQuad(pg.quad, pg.det.quad);
  pg.card.classList.toggle('is-error', pg.status === 'error');
  if (pg.status === 'error') {
    pg.status_.textContent = pg.entry.name + ': ' + pg.error;
    pg.status_.className = 'scan-status io-msg is-error';
    pg.flag.hidden = true;
    return;
  }
  pg.status_.className = 'scan-status';
  if (!ready) { pg.status_.textContent = pg.busy.textContent; pg.flag.hidden = true; return; }
  drawQuad(pg);
  const d = pg.det, turn = pg.turns ? (pg.turns === 2 ? ' Turned upside down.' : pg.turns === 1 ? ' Turned right.' : ' Turned left.') : '';
  let text, low = false;
  if (pg.moved) text = sameQuad(pg.quad, whole()) ? 'The whole photo is used.' : 'Corners set by hand.';
  else if (d.method === 'fallback') { text = 'No page edge found, so the whole photo is used. Drag the corners onto the page.'; low = true; }
  else if (d.method === 'lines+border') { text = 'The page runs off the photo, whose edge closes it. Check the corners.'; low = true; }
  else if (d.confidence < LOW) { text = 'Edges found, but not clearly (confidence ' + d.confidence.toFixed(2) + '). Check the corners.'; low = true; }
  else text = 'Edges found (confidence ' + d.confidence.toFixed(2) + ').';
  pg.low = low;
  pg.flag.hidden = !low;
  pg.status_.textContent = text + turn;
}

function drawQuad(pg) {
  const q = pg.quad;
  const pts = q.map((p) => (p[0] * 1000).toFixed(1) + ',' + (p[1] * 1000).toFixed(1));
  pg.outline.setAttribute('points', pts.join(' '));
  pg.shade.setAttribute('d', 'M0,0H1000V1000H0Z M' + pts.join(' L') + 'Z');
  pg.handles.forEach((h, k) => { h.style.left = (q[k][0] * 100) + '%'; h.style.top = (q[k][1] * 100) + '%'; });
}

let previewQueued = new Set(), previewRaf = 0;
function schedulePreview(pg) {
  previewQueued.add(pg);
  if (previewRaf) return;
  previewRaf = requestAnimationFrame(() => {
    previewRaf = 0;
    const list = [...previewQueued]; previewQueued.clear();
    list.forEach(drawPreview);
  });
}
function drawPreview(pg) {
  const V = window.MVRScanVision;
  if (!V || !pg.thumb || pg.gone) return;
  const t = pg.thumb;
  try {
    const q = usableQuad(pg.quad).map((p) => [p[0] * t.width, p[1] * t.height]);
    const size = V.suggestSize(q, { imageWidth: t.width, imageHeight: t.height, maxSide: 240 });
    let out = V.warp(t, q, size.width, size.height);
    if (pg.turns) out = V.rotate90(out, pg.turns);
    const mode = (S.api.get().enhance) || 'colour';
    if (mode !== 'none') out = V.enhance(out, mode);
    pg.preview.width = out.width; pg.preview.height = out.height;
    pg.preview.getContext('2d').putImageData(new ImageData(out.data, out.width, out.height), 0, 0);
  } catch (e) { /* a degenerate quad while dragging: keep the last preview */ }
}

function afterEdit(pg) {
  paintCard(pg, S.pages.size);
  schedulePreview(pg);
}

/* Drag a corner with a mouse, a pen or a finger; the handle captures the
   pointer, so a drag that leaves the photo keeps going, pinned to its edge. */
function dragStart(pg, k, ev) {
  if (ev.button !== undefined && ev.button > 0) return;
  ev.preventDefault();
  const h = pg.handles[k];
  try { h.setPointerCapture(ev.pointerId); } catch (e) { /* */ }
  h.focus({ preventScroll: true });
  h.classList.add('is-dragging');
  const r = pg.stage.getBoundingClientRect();
  const move = (e) => {
    pg.quad[k] = [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)];
    pg.moved = true;
    drawQuad(pg);
    schedulePreview(pg);
  };
  const end = () => {
    h.classList.remove('is-dragging');
    h.removeEventListener('pointermove', move);
    h.removeEventListener('pointerup', end);
    h.removeEventListener('pointercancel', end);
    afterEdit(pg);
  };
  h.addEventListener('pointermove', move);
  h.addEventListener('pointerup', end);
  h.addEventListener('pointercancel', end);
}

function nudge(pg, k, ev) {
  const step = ev.shiftKey ? 0.02 : 0.004;
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
  if (!d) return;
  ev.preventDefault();
  pg.quad[k] = [clamp(pg.quad[k][0] + d[0], 0, 1), clamp(pg.quad[k][1] + d[1], 0, 1)];
  pg.moved = true;
  afterEdit(pg);
}

/* ---------- finding the edges, one photo at a time ---------- */

function queueDetect(pg) {
  pg.status = 'queued';
  pg.promise = S.chain = S.chain.then(() => detectOne(pg));
}

async function detectOne(pg) {
  if (pg.gone) return;
  pg.status = 'detecting';
  paintCard(pg, S.pages.size);
  try {
    const r = await S.detector.call('detect', pg.entry.file || new Blob([pg.entry.bytes]), {});
    if (pg.gone) return;
    pg.thumb = { width: r.thumb.width, height: r.thumb.height, data: new Uint8ClampedArray(r.thumb.data.buffer, r.thumb.data.byteOffset, r.thumb.data.length) };
    pg.photoW = r.photoW; pg.photoH = r.photoH;
    pg.det = { quad: r.quad, confidence: r.confidence, method: r.method, ms: r.ms };
    pg.quad = copyQuad(r.quad);
    pg.status = 'ready';
    pg.photo.width = r.thumb.width; pg.photo.height = r.thumb.height;
    pg.photo.getContext('2d').putImageData(new ImageData(pg.thumb.data, pg.thumb.width, pg.thumb.height), 0, 0);
    pg.stage.style.aspectRatio = r.thumb.width + ' / ' + r.thumb.height;
    await S.loadVision();
    schedulePreview(pg);
  } catch (e) {
    pg.status = 'error';
    pg.error = 'could not be opened: ' + ((e && e.message) || 'unknown error') + '.';
  }
  if (!pg.gone) paintCard(pg, S.pages.size);
}

/* ---------- the camera ---------- */

function mountCamera(api) {
  const el = api.el, btn = api.btn;
  const box = el('div', 'scan-camera');
  const bar = el('div', 'scan-camera-bar');
  const start = btn('Use the camera', 'btn-ghost scan-cam-start');
  start.title = 'Open a live view from this device\'s camera and photograph the pages one by one';
  bar.appendChild(start);
  bar.appendChild(el('span', 'scan-camera-note', 'The camera starts only when you press this. Nothing is recorded or sent.'));
  box.appendChild(bar);

  const live = el('div', 'scan-camera-live');
  live.hidden = true;
  const view = el('div', 'scan-camera-view');
  view.tabIndex = 0;
  view.setAttribute('aria-label', 'Camera view. Press Space or Enter to take the photo.');
  const video = el('video', 'scan-camera-video');
  video.muted = true; video.playsInline = true; video.autoplay = true;
  video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
  view.appendChild(video);
  live.appendChild(view);
  const acts = el('div', 'scan-camera-actions');
  const shoot = btn('Take the photo', 'btn-primary scan-cam-shoot');
  const count = el('span', 'scan-camera-count', 'No pages taken yet.');
  count.setAttribute('aria-live', 'polite');
  const done = btn('Done', 'btn-ghost scan-cam-done');
  done.title = 'Turn the camera off';
  acts.appendChild(shoot); acts.appendChild(count); acts.appendChild(done);
  live.appendChild(acts);
  box.appendChild(live);

  const fb = el('div', 'scan-camera-fallback');
  fb.hidden = true;
  const fbMsg = el('p', 'io-msg is-note scan-camera-msg');
  fbMsg.setAttribute('role', 'status');
  const fbInput = el('input', 'visually-hidden');
  fbInput.type = 'file'; fbInput.accept = 'image/*'; fbInput.multiple = true;
  fbInput.setAttribute('capture', 'environment');
  fbInput.tabIndex = -1;
  const fbBtn = btn('Open the phone\'s camera', 'btn-ghost scan-cam-native');
  fbBtn.title = 'On a phone this opens its camera app; elsewhere it opens the file picker';
  fbBtn.addEventListener('click', () => fbInput.click());
  fbInput.addEventListener('change', () => { if (fbInput.files.length) { const l = [...fbInput.files]; fbInput.value = ''; api.addFiles(l); } });
  fb.appendChild(fbMsg); fb.appendChild(fbBtn); fb.appendChild(fbInput);
  box.appendChild(fb);

  let stream = null, capture = null, taken = 0, shooting = false;
  const showFallback = (why) => { fbMsg.textContent = why; fb.hidden = false; };

  function stop() {
    if (stream) stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* */ } });
    stream = null; capture = null;
    video.pause && video.pause();
    video.srcObject = null;
    live.hidden = true;
    start.hidden = false;
  }

  start.addEventListener('click', async () => {
    fb.hidden = true;
    const md = navigator.mediaDevices;
    if (!md || typeof md.getUserMedia !== 'function') {
      showFallback(window.isSecureContext === false
        ? 'This page is not on a secure connection, so the browser keeps the camera from it. Use your phone\'s camera instead:'
        : 'This browser does not let pages use the camera. Use your phone\'s camera instead:');
      fbBtn.focus();
      return;
    }
    start.disabled = true;
    try {
      stream = await md.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } } });
    } catch (e) {
      start.disabled = false;
      const n = e && e.name;
      showFallback(n === 'NotAllowedError' || n === 'SecurityError'
        ? 'The camera was not allowed, so nothing was opened. You can allow it in the browser\'s site settings and press Use the camera again, or use your phone\'s camera instead:'
        : n === 'NotFoundError' || n === 'OverconstrainedError'
          ? 'No camera was found on this device. Choose photos above, or use your phone\'s camera:'
          : 'The camera could not be started (' + ((e && e.message) || n || 'unknown error') + '). Use your phone\'s camera instead:');
      fbBtn.focus();
      return;
    }
    start.disabled = false;
    start.hidden = true;
    live.hidden = false;
    video.srcObject = stream;
    try { await video.play(); } catch (e) { /* autoplay with muted video is allowed; the frame still arrives */ }
    const track = stream.getVideoTracks()[0];
    capture = (typeof window.ImageCapture === 'function' && track) ? new window.ImageCapture(track) : null;
    count.textContent = taken ? taken + (taken === 1 ? ' page' : ' pages') + ' taken.' : 'No pages taken yet.';
    shoot.focus();
  });

  async function grab() {
    if (!video.videoWidth) await new Promise((r) => { video.addEventListener('loadeddata', r, { once: true }); setTimeout(r, 3000); });
    const c = document.createElement('canvas');
    c.width = video.videoWidth; c.height = video.videoHeight;
    if (!c.width) return null;
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
    c.width = c.height = 1;
    return b;
  }

  async function takePhoto() {
    if (!stream || shooting) return;
    shooting = true; shoot.disabled = true;
    view.classList.add('is-flash');
    setTimeout(() => view.classList.remove('is-flash'), 180);
    try {
      let blob = null;
      if (capture) { try { blob = await capture.takePhoto(); } catch (e) { blob = null; } }
      if (!blob || !blob.size || !/^image\//.test(blob.type)) blob = await grab();
      if (!blob) { count.textContent = 'The camera gave no picture. Try again.'; return; }
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      const n = api.allEntries().length + 1;
      taken++;
      count.textContent = 'Page ' + n + ' added. ' + taken + (taken === 1 ? ' page' : ' pages') + ' taken.';
      await api.addFiles([new File([blob], 'page-' + n + '.' + ext, { type: blob.type || 'image/jpeg' })]);
    } finally {
      shooting = false; shoot.disabled = false;
    }
  }
  shoot.addEventListener('click', takePhoto);
  view.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); takePhoto(); } });
  done.addEventListener('click', () => {
    stop();
    count.textContent = '';
    api.say(taken ? 'Camera off. ' + taken + (taken === 1 ? ' page' : ' pages') + ' taken: check the corners below, then make the PDF.' : 'Camera off.', 'note');
    start.focus();
  });
  window.addEventListener('pagehide', stop);
  return box;
}

/* ---------- the spec ---------- */

window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["scan-to-pdf"] = {
"title": "Scan to PDF (Camera)",
"kind": "create",
"action": "Make the PDF",
"multiple": true,
"files": true,
"loadAs": "image",
"accept": "image/*",
"acceptTest": (f) => /^image\//.test(f.type || '') || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name || ''),
"fileNoun": "photos of pages",
"fileKind": "a photo",
"wrongType": "Those are not photos. Choose JPEG, PNG or WebP pictures of the pages, or use the camera.",
"needFile": "Add a photo of a page first, or press Use the camera.",
"progressLabel": "Straightening",
"description": "Photograph paper pages with your phone or webcam; the edges are found and straightened, the paper whitened, and the pages made into one PDF on your device.",
"keywords": ["scan to pdf","camera to pdf","phone scanner pdf","document scanner online","photo to pdf scanner"],
"glyph": "i-scan-to-pdf",
"glyphSvg": "<symbol id=\"i-scan-to-pdf\" viewBox=\"0 0 24 24\">\n  <path d=\"M3.4 8.2V5.4a2 2 0 0 1 2-2h2.8M15.8 3.4h2.8a2 2 0 0 1 2 2v2.8M20.6 15.8v2.8a2 2 0 0 1-2 2h-2.8M8.2 20.6H5.4a2 2 0 0 1-2-2v-2.8\"/>\n  <path d=\"M7.4 7.6l9.2-0.6 0.4 9.6-9.8 0.4z\" class=\"thin\"/>\n</symbol>",
"controls": [
  {"key":"pageSize","label":"Page size","type":"select","default":"a4","options":[{"value":"a4","label":"A4"},{"value":"letter","label":"US Letter"},{"value":"fit","label":"Fit to the photo"}]},
  {"key":"enhance","label":"Enhancement","type":"select","default":"colour","options":[{"value":"colour","label":"Colour document"},{"value":"grey","label":"Greyscale"},{"value":"bw","label":"Black and white"},{"value":"none","label":"None (as photographed)"}]},
  {"key":"quality","label":"Picture quality","type":"select","default":"0.85","options":[{"value":"0.92","label":"High (JPEG quality 92)"},{"value":"0.85","label":"Standard (JPEG quality 85)"},{"value":"0.7","label":"Smaller file (JPEG quality 70)"}],"hint":"Black and white pages are stored without JPEG, so this does not change them."}
],
"tips": [
  "Lay the page on something darker than the paper and fill most of the frame. The edges are found from the contrast between page and table, and a page that runs off the photo is closed with the photo's own edge.",
  "Each photo gets a card with the page's corners drawn on it. If one is wrong, drag it, or focus it and use the arrow keys; a page the edge finder is unsure of says Check the corners.",
  "The page keeps its own proportions: an A4 sheet photographed at an angle comes out A4-shaped, measured through the perspective rather than taken from the photo's slant.",
  "Colour document evens out shadows and makes the paper white while keeping coloured ink. Black and white suits plain text and is stored without JPEG blur.",
  "Nothing you add is uploaded: the photos are straightened and made into a PDF by your browser, and the camera runs only after you press Use the camera."
],
"faq": [
  {"q":"Can I scan straight from my phone's camera?","a":"Yes. Press Use the camera for a live view in the page, take one photo per page, and press Done, which turns the camera off. If the browser will not share the camera, the page offers your phone's own camera app instead."},
  {"q":"Is the text in the PDF searchable?","a":"No. Each page is a picture of the paper. To make the words searchable or copyable, run the PDF through OCR PDF afterwards."},
  {"q":"What about curled or folded pages?","a":"The page is fitted with four straight edges, so the corners land in place but a curl in a book page or a crease in a receipt stays. Flatten the paper, under a sheet of glass if need be, before you take the photo."},
  {"q":"Are my photos uploaded?","a":"No. They are decoded, straightened and written into the PDF by your own browser, in a background worker on this page. Nothing you add is uploaded, and no photo is kept after you close the page."}
],

mountExtras: (api) => {
  S.api = api;
  S.base = api.ENGINE_BASE;
  S.io = api.root.closest ? api.root.closest('.tool-io') : null;
  if (S.io) S.io.classList.add('scan-io');
  S.detector = makeRunner(S);
  S.runner = makeRunner(S);
  const el = api.el;
  api.root.classList.add('scan-tool');
  api.root.appendChild(mountCamera(api));
  S.wrap = el('section', 'scan-pages');
  S.wrap.hidden = true;
  S.wrap.setAttribute('aria-label', 'Pages');
  const top = el('div', 'scan-pages-head');
  S.head = el('strong', null, '');
  top.appendChild(S.head);
  top.appendChild(el('span', 'scan-pages-hint', 'Check each page\'s corners, then make the PDF. The pages go in this order.'));
  S.wrap.appendChild(top);
  S.list = el('ol', 'scan-list');
  S.wrap.appendChild(S.list);
  api.root.appendChild(S.wrap);
  /* the shell redraws its file list on every add, remove and move,
     including removing the last file, when onFiles is not called */
  const fl = S.io && S.io.querySelector('.file-list');
  if (fl && typeof MutationObserver === 'function') new MutationObserver(() => sync()).observe(fl, { childList: true });
  const mode = document.getElementById('pc-enhance');
  if (mode) mode.addEventListener('change', () => S.pages.forEach((pg) => schedulePreview(pg)));
},

onFiles: () => { sync(); },

mainRun: async (api) => {
  const t0 = Date.now();
  sync();
  const entries = ordered().filter((e) => e.state === 'ready');
  if (!entries.length) return { error: 'Add a photo of a page first, or press Use the camera.' };
  const o = api.opts;
  const mode = MODES[o.enhance] ? o.enhance : 'colour';
  const quality = clamp(Number(o.quality) || 0.85, 0.3, 1);
  const size = PAPER[o.pageSize] || o.pageSize === 'fit' ? o.pageSize : 'a4';
  const N = entries.length;
  const pages = [], used = [], left = [];
  let largest = null, kinds = new Set();

  const untilAbort = (p) => new Promise((resolve, reject) => {
    if (api.signal && api.signal.aborted) { reject(abortError()); return; }
    const on = () => reject(abortError());
    if (api.signal) api.signal.addEventListener('abort', on, { once: true });
    p.then((v) => { if (api.signal) api.signal.removeEventListener('abort', on); resolve(v); },
      (e) => { if (api.signal) api.signal.removeEventListener('abort', on); reject(e); });
  });

  for (let i = 0; i < N; i++) {
    if (api.cancelled()) throw abortError();
    const e = entries[i];
    const pg = S.pages.get(e.id);
    if (!pg) continue;
    if (pg.status !== 'ready' && pg.status !== 'error') {
      api.progress(i, N, 'Pages'); api.progress(0, 0, 'Finding the edges of page ' + (i + 1) + ' of ' + N);
      if (pg.status === 'waiting') queueDetect(pg);
      await untilAbort(pg.promise || Promise.resolve());
    }
    if (pg.status === 'error') { left.push(e.name + ' (' + pg.error.replace(/\.$/, '') + ')'); continue; }
    api.progress(i, N, 'Pages'); api.progress(0, 0, 'Straightening page ' + (i + 1) + ' of ' + N);
    const quad = usableQuad(pg.quad);
    let r;
    try {
      r = await S.runner.call('process', e.file || new Blob([e.bytes]), { quad, turns: pg.turns, mode, quality, maxSide: MAX_SIDE }, api.signal);
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      left.push(e.name + ' (' + ((err && err.message) || 'could not be processed') + ')');
      continue;
    }
    if (api.cancelled()) throw abortError();
    let img;
    if (r.kind === 'jpeg') img = await api.core.prepareImage({ kind: 'jpeg', bytes: r.bytes, width: r.width, height: r.height, components: 3 });
    else if (r.kind === 'grey') img = await api.core.prepareImage({ kind: 'grey', width: r.width, height: r.height, grey: r.grey });
    else img = await api.core.prepareImage({ kind: 'raw', width: r.width, height: r.height, rgb: r.rgb, alpha: null });
    kinds.add(r.kind);
    const land = r.width > r.height;
    let W, H, label;
    if (size === 'fit') {
      const p = r.snapped === 'A4' ? PAPER.a4 : r.snapped === 'Letter' ? PAPER.letter : null;
      if (p) { W = land ? p[1] : p[0]; H = land ? p[0] : p[1]; label = r.snapped + (land ? ' landscape' : '') + ' (matched)'; }
      else {
        const k = 841.89 / Math.max(r.width, r.height);
        W = Math.round(r.width * k * 100) / 100; H = Math.round(r.height * k * 100) / 100;
        label = Math.round(W) + ' × ' + Math.round(H) + ' pt';
      }
    } else {
      const p = PAPER[size];
      W = land ? p[1] : p[0]; H = land ? p[0] : p[1];
      label = PAPER_NAME[size] + (land ? ' landscape' : '');
    }
    const s = Math.min(W / r.width, H / r.height), dw = r.width * s, dh = r.height * s;
    pages.push({ size: [W, H], ops: [{ image: img, x: (W - dw) / 2, y: (H - dh) / 2, w: dw, h: dh }] });
    used.push({ n: i + 1, pg, label, w: r.width, h: r.height });
    if (!largest || r.width * r.height > largest.w * largest.h) largest = { w: r.width, h: r.height };
  }
  if (!pages.length) return { error: 'No page could be made: ' + left.join('; ') + '.' };
  api.progress(N, N, 'Pages'); api.progress(0, 0, 'Writing the PDF');
  const bytes = api.core.createPDF(pages, { info: { Title: 'Scan ' + today(), Creator: '1234Tools Scan to PDF' } });

  /* the summary: page sizes, and how each page's corners were set */
  const sizes = {};
  used.forEach((u) => { sizes[u.label] = (sizes[u.label] || 0) + 1; });
  const sizeText = Object.keys(sizes).map((k) => Object.keys(sizes).length > 1 || sizes[k] > 1 ? k + ' × ' + sizes[k] : k).join(', ');
  const auto = used.filter((u) => !u.pg.moved && u.pg.det && u.pg.det.method !== 'fallback');
  const byHand = used.filter((u) => u.pg.moved && !sameQuad(u.pg.quad, whole()));
  const wholeP = used.filter((u) => (u.pg.moved && sameQuad(u.pg.quad, whole())) || (!u.pg.moved && u.pg.det && u.pg.det.method === 'fallback'));
  const unsure = auto.filter((u) => u.pg.low);
  const confs = auto.map((u) => u.pg.det.confidence);
  const pl = (l) => (l.length === 1 ? 'page ' : 'pages ') + l.map((u) => u.n).join(', ');
  const stats = [
    ['Pages', String(pages.length)],
    ['File size', fmtBytes(bytes.length)],
    ['Page size', sizeText],
    ['Edges found', auto.length + ' of ' + used.length + (confs.length ? ' (confidence ' + (Math.min.apply(null, confs) === Math.max.apply(null, confs) ? Math.min.apply(null, confs).toFixed(2) : Math.min.apply(null, confs).toFixed(2) + ' to ' + Math.max.apply(null, confs).toFixed(2)) + ')' : '')]
  ];
  if (byHand.length) stats.push(['Corners set by hand', pl(byHand)]);
  if (wholeP.length) stats.push(['Whole photo used', pl(wholeP)]);
  stats.push(['Enhancement', MODES[mode]]);
  stats.push(['Pictures', (kinds.has('grey') ? 'lossless black and white' : kinds.has('raw') ? 'lossless (this browser wrote no JPEG)' : 'JPEG quality ' + Math.round(quality * 100)) + ', up to ' + largest.w + ' × ' + largest.h + ' px']);
  stats.push(['Time', ((Date.now() - t0) / 1000).toFixed(1) + ' s']);
  const warn = [];
  if (left.length) warn.push('Left out: ' + left.join('; ') + '.');
  if (unsure.length) warn.push('The edges of ' + pl(unsure) + ' were not certain: check ' + (unsure.length === 1 ? 'it' : 'them') + ' in the preview below.');
  return {
    files: [{ name: 'scan-' + today() + '.pdf', bytes, type: 'application/pdf' }],
    stats,
    warn: warn.length ? warn.join(' ') : undefined
  };
}
};
})();
