/**
 * YouTube Thumbnail Maker.
 *
 * The people (or any chosen layer) are cut out on the device and placed on
 * a frame over a punched-up background, with a glow outline. On top of that
 * sits a stack of layers the visitor edits: any number of text layers, Noto
 * emoji stickers, and shapes, arrows and badges drawn with canvas paths. The
 * cut-out is one layer of that stack, so anything can go in front of it or
 * behind it.
 *
 * One function draws the frame for the preview and every export, and the
 * same function with a few settings swapped draws the A, B and C variants
 * and the template previews. Every position is a fraction of the frame, so
 * a design moves between 16:9, 9:16, 1:1 and 4:5; text is fitted inside
 * each size's safe area.
 *
 * The editable state (the "doc": size, background, cut-out placement, glow
 * and layers — never the pixels) is what undo snapshots and what a saved
 * project keeps, beside the photo itself, in this browser's IndexedDB.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, field, select, range, colour, check, button, sleep, fmtBytes } = A;

  const W0 = 1280, H0 = 720;
  /* The sizes, and the part of each that the platforms leave alone. The
     vertical one keeps clear of the caption and buttons that Shorts, Reels
     and TikTok draw over a cover; the 4:5 one of the 3:4 grid crop. These
     are working margins, not published figures. */
  const SIZES = {
    yt: { w: 1280, h: 720, label: 'YouTube — 1280 × 720', note: '1280 × 720 — what YouTube shows' },
    short: { w: 1080, h: 1920, label: 'Shorts, Reels, TikTok cover — 1080 × 1920', note: '1080 × 1920 — vertical cover' },
    square: { w: 1080, h: 1080, label: 'Instagram post — 1080 × 1080', note: '1080 × 1080 — square post' },
    portrait: { w: 1080, h: 1350, label: 'Instagram portrait — 1080 × 1350', note: '1080 × 1350 — 4:5 post' }
  };
  const SAFE = {
    yt: { l: 0.04, r: 0.04, t: 0.04, b: 0.04 },
    short: { l: 0.06, r: 0.14, t: 0.11, b: 0.22 },
    square: { l: 0.05, r: 0.05, t: 0.05, b: 0.05 },
    portrait: { l: 0.07, r: 0.07, t: 0.05, b: 0.05 }
  };
  const FONTS = ['Impact', 'Arial Black', 'Sora', 'Inter', 'Verdana', 'Georgia'];
  const BG_MODES = [['blur', 'Original, blurred and darkened'], ['sharp', 'Original, punchier'], ['halves', 'Original, dull half and vivid half'],
    ['solid', 'Solid colour'], ['gradient', 'Gradient'], ['split', 'Two colours, split'], ['pattern', 'Pattern']];
  const PHOTO_BG = new Set(['blur', 'sharp', 'halves']);
  const PATTERNS = [['dots', 'Dots'], ['stripes', 'Diagonal stripes'], ['grid', 'Grid']];
  const GLOWS = [['both', 'Outline and glow'], ['hard', 'Hard outline'], ['soft', 'Soft glow'], ['none', 'None']];
  const SHAPES = [['arrow', 'Arrow'], ['curve', 'Curved arrow'], ['circle', 'Circle'], ['box', 'Box'], ['underline', 'Underline'], ['tick', 'Tick'],
    ['cross', 'Cross'], ['star', 'Star'], ['badge', 'Badge'], ['burst', 'Burst'], ['disc', 'Number disc'], ['bar', 'Banner bar']];
  const SHAPE_NAME = Object.fromEntries(SHAPES);
  const LINE_SHAPES = new Set(['arrow', 'curve', 'circle', 'box', 'underline', 'tick', 'cross']);
  const TEXT_SHAPES = new Set(['badge', 'burst', 'disc', 'bar']);
  const SHAPE_SIZE = { arrow: 0.42, curve: 0.42, circle: 0.45, box: 0.5, underline: 0.5, tick: 0.3, cross: 0.3, star: 0.2, badge: 0.26, burst: 0.32, disc: 0.26, bar: 0.26 };
  const SHAPE_TEXT = { badge: 'NEW', burst: 'VS', disc: '1', bar: 'BREAKING NEWS' };
  const PALETTE = ['#f7c948', '#ff3b3b', '#2dd4ff', '#39ff88', '#ff5cf0', '#ffffff'];
  const YT_LIMIT = 2000000;
  const HISTORY_MAX = 100;
  const SETTINGS_KEY = '1234tools-thumbnail-maker-v1';
  const DB_NAME = '1234tools-thumbnail-maker', DB_STORE = 'projects';
  const NOTO_URL = '/engine/vendor/noto-emoji/noto-subset.json';
  const GROUP_NAMES = { smileys: 'Smileys and hearts', people: 'Hands and people', animals: 'Animals and nature', food: 'Food and drink',
    activities: 'Activities', travel: 'Weather, travel and places', objects: 'Objects', symbols: 'Symbols', flags: 'Flags' };
  const GEOM = ['x', 'y', 'size', 'rotation', 'align', 'span'];
  /* Layers that are never picked as the subject by default. */
  const BACKDROP = new Set(['sky', 'wall', 'floor', 'ceiling', 'road', 'sidewalk', 'earth', 'grass', 'field', 'sand', 'sea', 'water', 'mountain', 'hill', 'land', 'building', 'tree', 'path', 'river', 'lake', 'curtain', 'rug', 'windowpane', 'door', 'fence', 'railing']);

  const pct = (v) => Math.round(v) + '%';
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const rad = (d) => (Number(d) || 0) * Math.PI / 180;
  const opac = (L) => { const v = Number(L.opacity); return Number.isFinite(v) ? clamp(v, 0, 1) : 1; };
  const nextColour = (c, n) => { const i = PALETTE.indexOf(String(c).toLowerCase()); return PALETTE[((i < 0 ? -1 : i) + n + PALETTE.length) % PALETTE.length]; };
  const errText = (e) => (e && e.message) || String(e);
  const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
  const extOf = (blob) => EXT[blob && blob.type] || 'png';
  const svgUrl = (body, w, h) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + (w || 128) + ' ' + (h || 128) + '" width="512" height="512">' + body + '</svg>');

  let seq = 0;
  const newId = (type) => type + '-' + Date.now().toString(36) + '-' + (++seq);
  function newText(partial) {
    return Object.assign({
      id: newId('text'), type: 'text', role: null, hidden: false,
      text: 'YOUR TITLE\nHERE', font: 'Impact', weight: 900, italic: false, uppercase: true,
      size: 15, letterSpacing: 0.01, lineHeight: 1.0, align: 'left', x: 0.3, y: 0.42, rotation: 0, opacity: 1,
      fillMode: 'solid', fill: '#ffffff', fill2: '#f7c948', gradientAngle: 90,
      strokeWidth: 7, stroke: '#000000', shadowBlur: 10, shadowX: 0, shadowY: 3, shadowColor: '#000000', shadowOpacity: 0.7,
      glow: 0, blend: 'source-over',
      anim: { type: 'none', direction: 'left', speed: 1, amplitude: 0.5, waves: 1.5 }
    }, partial || {});
  }
  function newEmoji(partial) {
    return Object.assign({ id: newId('emoji'), type: 'emoji', role: null, hidden: false, key: 'fire', x: 0.5, y: 0.4, size: 0.28, rotation: 0, opacity: 1,
      flip: false, shadow: true, outline: 0, outlineColour: '#ffffff' }, partial || {});
  }
  function newShape(partial) {
    const kind = (partial && partial.kind) || 'arrow';
    return Object.assign({ id: newId('shape'), type: 'shape', role: null, hidden: false, kind, colour: '#ff3b3b', colour2: '#ffffff',
      text: SHAPE_TEXT[kind] || '', font: 'Impact', x: 0.5, y: 0.5, size: SHAPE_SIZE[kind] || 0.3, rotation: 0, width: 9, opacity: 1, flip: false, span: 1 }, partial || {});
  }
  const SUBJECT_LAYER = () => ({ id: 'subject', type: 'subject', hidden: false });
  const defBg = () => ({ mode: 'blur', c1: '#141a33', c2: '#7c5cff', dark: 0.45, blur: 14, zoom: 1.1, pattern: 'dots' });
  const defSubject = () => ({ scale: 1, x: 0.68, y: 1.02, mirror: false, twin: false });
  const defGlow = () => ({ style: 'both', colour: '#f7c948', width: 14, strength: 0.9 });
  function materialise(L) {
    if (L.type === 'subject') return SUBJECT_LAYER();
    if (L.type === 'text') return newText(Object.assign({ align: 'center' }, L));
    if (L.type === 'emoji') return newEmoji(L);
    return newShape(L);
  }

  /* ---------------- templates ----------------
     build(P) returns a design; P(wide, tall, square) picks a value for the
     frame's shape (square falls back to tall). Each layer has a role, so a
     template's pieces can be moved again when the size changes. */
  const T = (o) => Object.assign({ type: 'text' }, o);
  const TEMPLATES = [
    { id: 'reaction', name: 'Reaction and a big word', build: (P) => ({
      bg: { mode: 'blur', dark: 0.5, blur: 16, zoom: 1.1, c1: '#1b1036', c2: '#ff3b3b' },
      glow: { style: 'both', colour: '#f7c948', width: 14, strength: 0.9 },
      subject: { x: P(0.7, 0.5), y: 1.02, scale: P(1, 0.92) },
      layers: [
        T({ role: 'title', text: 'NO WAY!', size: P(19, 22), x: P(0.28, 0.5), y: P(0.42, 0.22), rotation: -5, fillMode: 'gradient', fill: '#ffffff', fill2: '#f7c948', strokeWidth: 8 }),
        { type: 'subject' },
        { type: 'emoji', role: 'emoji', key: 'face-screaming-in-fear', x: P(0.12, 0.8), y: P(0.8, 0.42), size: P(0.3, 0.24), rotation: -12 }
      ] }) },
    { id: 'versus', name: 'Versus split', build: (P) => ({
      bg: { mode: 'split', c1: '#e11d48', c2: '#2563eb' },
      glow: { style: 'hard', colour: '#ffffff', width: 10, strength: 1 },
      subject: { x: P(0.25, 0.5, 0.27), y: P(1.02, 0.5, 1.02), scale: P(0.9, 0.5, 0.75) },
      layers: [
        { type: 'subject' },
        T({ role: 'left', text: 'THIS', size: P(13, 16, 14), x: P(0.25, 0.5, 0.27), y: P(0.14, 0.12, 0.13) }),
        T({ role: 'right', text: 'THAT', size: P(13, 16, 14), x: P(0.75, 0.5, 0.73), y: P(0.14, 0.64, 0.13) }),
        { type: 'shape', role: 'vs', kind: 'burst', text: 'VS', colour: '#f7c948', colour2: '#111111', x: 0.5, y: 0.5, size: P(0.42, 0.3, 0.32), rotation: -8 }
      ] }) },
    { id: 'listicle', name: 'Top-N list', build: (P) => ({
      bg: { mode: 'gradient', c1: '#0f172a', c2: '#b45309', dark: 0.45 },
      glow: { style: 'hard', colour: '#f7c948', width: 10, strength: 1 },
      subject: { x: P(0.8, 0.5), y: 1.02, scale: P(0.95, 0.85) },
      layers: [
        { type: 'subject' },
        T({ role: 'number', text: '7', size: P(40, 46), x: P(0.15, 0.5), y: P(0.5, 0.22), fill: '#f7c948', strokeWidth: 5, rotation: -6 }),
        T({ role: 'title', text: 'THINGS I WISH\nI KNEW', size: P(8.5, 11), x: P(0.47, 0.5), y: P(0.5, 0.45), align: P('left', 'center') })
      ] }) },
    { id: 'beforeafter', name: 'Before and after', build: (P) => ({
      bg: { mode: 'halves', dark: 0.25, zoom: 1.05, c1: '#334155', c2: '#16a34a' },
      glow: { style: 'hard', colour: '#ffffff', width: 8, strength: 1 },
      subject: { x: P(0.75, 0.5, 0.75), y: P(1.02, 1.02, 1.02), scale: P(0.9, 0.45, 0.7) },
      layers: [
        { type: 'subject' },
        { type: 'shape', role: 'before', kind: 'badge', text: 'BEFORE', colour: '#111827', colour2: '#ffffff', x: P(0.25, 0.5, 0.25), y: P(0.12, 0.15, 0.1), size: P(0.22, 0.2) },
        { type: 'shape', role: 'after', kind: 'badge', text: 'AFTER', colour: '#16a34a', colour2: '#ffffff', x: P(0.75, 0.5, 0.75), y: P(0.12, 0.57, 0.1), size: P(0.22, 0.2) },
        { type: 'shape', role: 'arrow', kind: 'arrow', colour: '#ffffff', x: 0.5, y: 0.5, size: P(0.3, 0.26), rotation: P(0, 90, 0), width: 12 }
      ] }) },
    { id: 'tutorial', name: 'Tutorial with an arrow', build: (P) => ({
      bg: { mode: 'sharp', dark: 0.5, zoom: 1.05, c1: '#0f172a', c2: '#1e3a8a' },
      glow: { style: 'both', colour: '#ffffff', width: 12, strength: 0.9 },
      subject: { x: P(0.74, 0.5), y: 1.02, scale: P(0.95, 0.9) },
      layers: [
        { type: 'subject' },
        T({ role: 'title', text: 'HOW TO\nDO THIS', size: P(13, 16), x: P(0.27, 0.5), y: P(0.3, 0.2), align: P('left', 'center'), fillMode: 'gradient', fill: '#ffffff', fill2: '#f7c948' }),
        { type: 'shape', role: 'arrow', kind: 'curve', colour: '#ff3b3b', x: P(0.48, 0.3), y: P(0.62, 0.45), size: P(0.36, 0.3), rotation: P(10, 70), width: 12 },
        { type: 'shape', role: 'badge', kind: 'badge', text: 'STEP BY STEP', colour: '#ff3b3b', colour2: '#ffffff', x: P(0.22, 0.5), y: P(0.78, 0.33), size: P(0.17, 0.16), rotation: -3 }
      ] }) },
    { id: 'news', name: 'Breaking news bar', build: (P) => ({
      bg: { mode: 'blur', dark: 0.35, blur: 12, zoom: 1.1, c1: '#111827', c2: '#7f1d1d' },
      glow: { style: 'soft', colour: '#ffffff', width: 10, strength: 0.6 },
      subject: { x: P(0.6, 0.5), y: P(0.9, 0.78), scale: P(1, 0.85) },
      layers: [
        { type: 'subject' },
        { type: 'shape', role: 'bar', kind: 'bar', text: 'THE STORY EVERYONE MISSED', colour: '#c1121f', colour2: '#ffffff', x: 0.5, y: P(0.86, 0.74, 0.86), size: P(0.17, 0.11, 0.13), span: 1 },
        { type: 'shape', role: 'badge', kind: 'badge', text: 'BREAKING', colour: '#f7c948', colour2: '#111111', x: P(0.17, 0.3, 0.2), y: P(0.72, 0.68, 0.76), size: P(0.15, 0.1, 0.12), rotation: -3 },
        { type: 'shape', role: 'live', kind: 'badge', text: 'LIVE', colour: '#ff3b3b', colour2: '#ffffff', x: P(0.9, 0.78, 0.88), y: P(0.1, 0.15, 0.1), size: P(0.12, 0.09) }
      ] }) },
    { id: 'quote', name: 'Minimal quote', build: (P) => ({
      bg: { mode: 'solid', c1: '#111827', c2: '#f7c948' },
      glow: { style: 'none', colour: '#ffffff', width: 6, strength: 0.6 },
      subject: { x: P(0.82, 0.5), y: 1.02, scale: P(0.85, 0.7) },
      layers: [
        { type: 'subject' },
        T({ role: 'mark', text: '“', font: 'Georgia', weight: 700, size: P(22, 30), x: P(0.1, 0.16), y: P(0.24, 0.17), fill: '#f7c948', strokeWidth: 0, shadowBlur: 0, shadowY: 0, uppercase: false }),
        T({ role: 'title', text: 'Make it simple,\nbut significant.', font: 'Georgia', weight: 700, italic: true, uppercase: false, size: P(6.5, 9), x: P(0.36, 0.5), y: P(0.45, 0.32), align: P('left', 'center'), strokeWidth: 0, shadowBlur: 6, shadowY: 2, lineHeight: 1.15 }),
        T({ role: 'credit', text: '— YOUR NAME', font: 'Inter', weight: 700, size: P(3.2, 4.5), x: P(0.36, 0.5), y: P(0.68, 0.48), align: P('left', 'center'), fill: '#f7c948', strokeWidth: 0, shadowBlur: 0, shadowY: 0, letterSpacing: 0.08 })
      ] }) },
    { id: 'neon', name: 'Gaming neon', build: (P) => ({
      bg: { mode: 'pattern', pattern: 'grid', c1: '#0b0420', c2: '#ff2bd6' },
      glow: { style: 'soft', colour: '#2dd4ff', width: 22, strength: 1 },
      subject: { x: P(0.7, 0.5), y: 1.02, scale: P(1, 0.85) },
      layers: [
        T({ role: 'title', text: 'GAME\nOVER?', size: P(17, 20), x: P(0.27, 0.5), y: P(0.45, 0.22), rotation: -4, fillMode: 'gradient', fill: '#ff5cf0', fill2: '#2dd4ff', strokeWidth: 3, stroke: '#1a0033', glow: 40, shadowBlur: 0 }),
        { type: 'subject' },
        { type: 'emoji', role: 'emoji', key: 'video-game', x: P(0.9, 0.82), y: P(0.18, 0.44), size: P(0.26, 0.2), rotation: 14 },
        { type: 'shape', role: 'star', kind: 'star', colour: '#f7c948', x: P(0.08, 0.15), y: P(0.85, 0.46), size: P(0.16, 0.11), rotation: 12 }
      ] }) },
    { id: 'review', name: 'Product review', build: (P) => ({
      bg: { mode: 'gradient', c1: '#0f172a', c2: '#334155' },
      glow: { style: 'hard', colour: '#ffffff', width: 10, strength: 1 },
      subject: { x: P(0.72, 0.5), y: 1.02, scale: P(0.95, 0.8) },
      layers: [
        { type: 'subject' },
        T({ role: 'title', text: 'WORTH IT?', size: P(13, 17), x: P(0.28, 0.5), y: P(0.32, 0.19), fill: '#ffffff' }),
        { type: 'shape', role: 'star1', kind: 'star', colour: '#f7c948', x: P(0.1, 0.26), y: P(0.58, 0.31), size: P(0.12, 0.09) },
        { type: 'shape', role: 'star2', kind: 'star', colour: '#f7c948', x: P(0.19, 0.38), y: P(0.58, 0.31), size: P(0.12, 0.09) },
        { type: 'shape', role: 'star3', kind: 'star', colour: '#f7c948', x: P(0.28, 0.5), y: P(0.58, 0.31), size: P(0.12, 0.09) },
        { type: 'shape', role: 'star4', kind: 'star', colour: '#f7c948', x: P(0.37, 0.62), y: P(0.58, 0.31), size: P(0.12, 0.09) },
        { type: 'shape', role: 'star5', kind: 'star', colour: '#475569', x: P(0.46, 0.74), y: P(0.58, 0.31), size: P(0.12, 0.09) },
        { type: 'shape', role: 'score', kind: 'disc', text: '4/5', colour: '#16a34a', colour2: '#ffffff', x: P(0.24, 0.82), y: P(0.8, 0.42), size: P(0.2, 0.15), rotation: -8 }
      ] }) }
  ];

  /* ---------------- device storage ---------------- */
  function readSettings() {
    try { const j = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); return j && typeof j === 'object' ? j : {}; }
    catch (e) { return {}; }
  }
  function idb() {
    return new Promise((res, rej) => {
      let req;
      try {
        if (!window.indexedDB) throw new Error('This browser has no on-device database (IndexedDB), so projects cannot be saved here.');
        req = indexedDB.open(DB_NAME, 1);
      } catch (e) { rej(e); return; }
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'name' }); };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error || new Error('The browser refused to open its on-device database.'));
      req.onblocked = () => rej(new Error('The on-device database is busy in another tab. Close that tab and try again.'));
    });
  }
  async function dbRun(mode, fn) {
    const db = await idb();
    try {
      return await new Promise((res, rej) => {
        let t, r, out;
        try { t = db.transaction(DB_STORE, mode); r = fn(t.objectStore(DB_STORE)); } catch (e) { rej(e); return; }
        if (r) r.onsuccess = () => { out = r.result; };
        t.oncomplete = () => res(out);
        t.onerror = () => rej(t.error || (r && r.error) || new Error('The on-device database failed.'));
        t.onabort = () => rej(t.error || new Error('The on-device database gave up — the device may be short of space.'));
      });
    } finally { db.close(); }
  }
  const listProjects = () => dbRun('readonly', (st) => st.getAll());
  /** The saved projects, without creating the database when there is none yet. */
  async function listIfAny() {
    if (window.indexedDB && indexedDB.databases) {
      const dbs = await indexedDB.databases();
      if (!dbs.some((d) => d.name === DB_NAME)) return [];
    }
    return listProjects();
  }
  const getProject = (name) => dbRun('readonly', (st) => st.get(name));
  const putProject = (rec) => dbRun('readwrite', (st) => st.put(rec));
  const deleteProject = (name) => dbRun('readwrite', (st) => st.delete(name));

  /* ---------------- the emoji set, fetched when first wanted ---------------- */
  let noto = null, notoJob = null;
  function loadNoto(onProgress) {
    if (noto) return Promise.resolve(noto);
    if (notoJob) { if (onProgress) notoJob.listeners.push(onProgress); return notoJob.promise; }
    const ctl = new AbortController();
    const job = notoJob = { ctl, listeners: onProgress ? [onProgress] : [] };
    job.promise = (async () => {
      try {
        const r = await fetch(NOTO_URL, { signal: ctl.signal });
        if (!r.ok) throw new Error('The emoji set could not be loaded (HTTP ' + r.status + ').');
        const total = Number(r.headers.get('content-length')) || 0;
        let text;
        if (r.body && r.body.getReader) {
          const reader = r.body.getReader(); const parts = []; let got = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            parts.push(value); got += value.length;
            for (const f of job.listeners) f(got, total);
          }
          text = await new Blob(parts).text();
        } else text = await r.text();
        const j = JSON.parse(text);
        if (!j || !j.icons) throw new Error('The emoji set is damaged.');
        noto = j;
        return j;
      } finally { if (notoJob === job) notoJob = null; }
    })();
    return job.promise;
  }
  const cancelNoto = () => { if (notoJob) notoJob.ctl.abort(); };

  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const settings = readSettings();
    const S = {
      image: null, photoBlob: null, seg: null, guide: null, keys: new Set(), alpha: null, cut: null, tint: null, crop: null,
      softness: 3, shift: 0, detail: 'standard', mainOnly: true,
      fmt: SIZES[settings.fmt] ? settings.fmt : 'yt',
      bg: defBg(), subject: Object.assign(defSubject(), { baseH: 0.95 }), glow: defGlow(),
      layers: [newText({ role: 'title' }), SUBJECT_LAYER()], tpl: null,
      variant: null, bgCache: {}, pvCache: {}, scratch: {}, showLayers: false, exporting: false, sel: 'subject', lastText: null,
      started: false, showSafe: !!settings.safe, snap: null
    };
    const layerById = (id) => (id ? S.layers.find((l) => l.id === id) : null) || null;

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg aiimg-thumb');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a photo of yourself or your subject</strong><span>or drag it here — nothing is uploaded. Any shape; the frame is cropped around the subject.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Choose a photo');
    const blank = el('div', 'aiimg-thumb-blank');
    const blankBtn = button('Start from a template without a photo', 'btn-ghost', () => startBlank());
    const openSaved = button('Open a saved project', 'btn-ghost', () => { startBlank(); showPane('projects'); });
    openSaved.hidden = true;
    const blankNote = el('p', 'aiimg-thumb-note', ''); blankNote.hidden = true;
    blank.append(blankBtn, openSaved, blankNote);

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const canvas = el('canvas', 'aiimg-canvas');
    canvas.width = SIZES[S.fmt].w; canvas.height = SIZES[S.fmt].h;
    canvas.tabIndex = 0;
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(canvas, stageMsg);
    const transport = el('div', 'aiimg-transport aiimg-thumb-bar');
    const fmtSel = select('aiimg-thumb-format', Object.entries(SIZES).map(([k, s]) => [k, s.label]), S.fmt);
    fmtSel.classList.add('aiimg-thumb-fmt'); fmtSel.setAttribute('aria-label', 'Size');
    const undoBtn = button('Undo', 'btn-ghost aiimg-thumb-undo', () => undo());
    const redoBtn = button('Redo', 'btn-ghost aiimg-thumb-redo', () => redo());
    undoBtn.title = 'Undo (Ctrl+Z)'; redoBtn.title = 'Redo (Ctrl+Shift+Z or Ctrl+Y)';
    const change = button('Change photo', 'btn-ghost', () => file.click());
    const safeChk = on(check('aiimg-thumb-safe', 'Show the safe area', S.showSafe), () => { S.showSafe = safeChk.input.checked; saveSettings(); invalidate(); });
    const sizeNote = el('span', 'aiimg-thumb-size', SIZES[S.fmt].note);
    transport.append(fmtSel, undoBtn, redoBtn, change, safeChk, sizeNote);
    const keysHint = el('p', 'aiimg-thumb-keys', 'Click a layer on the preview to select it; drag it, or drag its corner handle to resize. With the preview focused: arrow keys nudge (Shift for more), + and − resize, Delete removes, Ctrl+D duplicates.');
    stageCol.append(stage, transport, keysHint);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    const onPane = {};
    for (const [k, label] of [['templates', 'Templates'], ['layers', 'Subject'], ['background', 'Background'], ['glow', 'Glow'], ['text', 'Text'],
      ['accent', 'Stickers'], ['stack', 'Layers'], ['projects', 'Projects'], ['export', 'Export']]) {
      const b = button(label, 'chip', () => showPane(k));
      b.dataset.pane = k; b.setAttribute('role', 'tab');
      tabs.appendChild(b);
      const p = el('div', 'aiimg-pane'); p.dataset.pane = k; p.hidden = true; p.setAttribute('role', 'tabpanel');
      panes[k] = p;
    }
    side.appendChild(tabs);
    for (const k in panes) side.appendChild(panes[k]);
    studio.append(stageCol, side);
    const msg = el('div', 'io-msg'); msg.setAttribute('role', 'status');
    wrap.append(drop, blank, file, studio, msg);
    io.appendChild(wrap);

    function showPane(k) {
      for (const b of tabs.children) { const onIt = b.dataset.pane === k; b.classList.toggle('is-on', onIt); b.setAttribute('aria-selected', onIt ? 'true' : 'false'); }
      for (const p in panes) panes[p].hidden = p !== k;
      if (onPane[k]) onPane[k]();
    }
    function say(text, kind) { msg.textContent = text || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); }
    function note(text) { stageMsg.textContent = text || ''; stageMsg.hidden = !text; }
    let settingsWarned = false;
    function saveSettings() {
      const prev = readSettings();
      const s = { fmt: S.fmt, out: outSize ? outSize.value : '1280', safe: S.showSafe, recent: Array.isArray(prev.recent) ? prev.recent.slice(0, 16) : [] };
      if (recentKeys) s.recent = recentKeys.slice(0, 16);
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
      catch (e) { if (!settingsWarned) { settingsWarned = true; say('This browser would not keep your settings (' + errText(e) + '). Everything still works; the settings reset next visit.', 'warn'); } }
    }

    /* ---------------- the frame ---------------- */
    const pctx = canvas.getContext('2d');
    const hasFilter = 'filter' in pctx;
    let dirty = true;
    const invalidate = () => { dirty = true; };
    const rebg = () => { S.bgCache = {}; S.pvCache = {}; dirty = true; };
    const view = () => S.variant || S;
    const frame = () => SIZES[S.fmt] || SIZES.yt;

    /** One working canvas per purpose, resized as needed, so dragging a resize does not pile up canvases. */
    function scratch(name, W, H) {
      let c = S.scratch[name];
      if (!c) c = S.scratch[name] = el('canvas');
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      return c;
    }

    /** The window of the photo, at the frame's proportions, centred on the subject. */
    function cropFor(ar) {
      const img = S.image;
      if (!img) return null;
      let w = img.width, h = Math.round(w / ar);
      if (h > img.height) { h = img.height; w = Math.round(h * ar); }
      let cx = img.width / 2, cy = img.height / 2;
      if (S.cut) { cx = S.cut.x + S.cut.w / 2; cy = S.cut.y + S.cut.h / 2; }
      return { x: clamp(Math.round(cx - w / 2), 0, img.width - w), y: clamp(Math.round(cy - h / 2), 0, img.height - h), w, h };
    }
    function computeCrop() { const f = frame(); S.crop = cropFor(f.w / f.h); }

    function background(W, H, B) {
      const small = W * H <= 90000;
      const cache = small ? S.pvCache : S.bgCache;
      const cr = S.image ? (small || Math.abs(W / H - frame().w / frame().h) > 0.01 ? cropFor(W / H) : S.crop) : null;
      const key = W + 'x' + H + '|' + JSON.stringify(B) + '|' + (cr ? cr.x + ',' + cr.y + ',' + cr.w : '-');
      if (cache[key]) return cache[key];
      const keys = Object.keys(cache);
      if (keys.length >= (small ? 24 : 4)) delete cache[keys[0]];
      const c = el('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d');
      const k = W / W0;
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      let mode = B.mode;
      if (PHOTO_BG.has(mode) && !S.image) mode = 'gradient';
      const photo = (dx, dy, dw, dh) => x.drawImage(S.image.canvas, cr.x, cr.y, cr.w, cr.h, dx, dy, dw, dh);
      if (mode === 'blur' || mode === 'sharp') {
        const blur = mode === 'blur' ? B.blur * k : 0;
        const over = blur * 2.5;
        const zoom = Math.max(1, Number(B.zoom) || 1);
        const dw = (W + 2 * over) * zoom, dh = (H + 2 * over) * zoom;
        x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
        x.save();
        if (hasFilter) x.filter = mode === 'blur' ? 'blur(' + blur.toFixed(1) + 'px)' : 'contrast(1.15) saturate(1.3)';
        if (mode === 'blur' && !hasFilter) {
          /* no filter support: a cheap blur by shrinking and growing */
          const sm = A.scaled(S.image.canvas, Math.max(8, Math.round(W / 16)), Math.max(8, Math.round(H / 16)));
          x.drawImage(sm, 0, 0, sm.width, sm.height, (W - dw) / 2, (H - dh) / 2, dw, dh);
        } else photo((W - dw) / 2, (H - dh) / 2, dw, dh);
        x.restore();
        const dark = clamp(Number(B.dark) || 0, 0, 0.9) * (mode === 'sharp' ? 0.5 : 1);
        if (dark > 0) { x.fillStyle = 'rgba(0,0,0,' + dark + ')'; x.fillRect(0, 0, W, H); }
      } else if (mode === 'halves') {
        /* before and after from one photo: a dull, grey half and a vivid one */
        const zoom = Math.max(1, Number(B.zoom) || 1);
        const dw = W * zoom, dh = H * zoom;
        const across = W >= H * 0.9;
        x.save();
        if (hasFilter) x.filter = 'contrast(1.15) saturate(1.4)';
        photo((W - dw) / 2, (H - dh) / 2, dw, dh);
        x.restore();
        x.save();
        x.beginPath(); if (across) x.rect(0, 0, W / 2, H); else x.rect(0, 0, W, H / 2); x.clip();
        x.globalCompositeOperation = 'saturation'; x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
        x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(0,0,0,' + clamp(0.2 + (Number(B.dark) || 0), 0, 0.85) + ')'; x.fillRect(0, 0, W, H);
        x.restore();
        x.fillStyle = '#ffffff';
        if (across) x.fillRect(W / 2 - 3 * k, 0, 6 * k, H); else x.fillRect(0, H / 2 - 3 * k, W, 6 * k);
      } else if (mode === 'solid') {
        x.fillStyle = B.c1; x.fillRect(0, 0, W, H);
        const g = x.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, Math.max(W, H) * 0.9);
        g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
      } else if (mode === 'gradient') {
        const g = x.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, B.c1); g.addColorStop(1, B.c2);
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        const r = x.createRadialGradient(W * 0.3, H * 0.15, 0, W * 0.3, H * 0.15, Math.max(W, H) * 0.7);
        r.addColorStop(0, 'rgba(255,255,255,0.2)'); r.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = r; x.fillRect(0, 0, W, H);
      } else if (mode === 'split') {
        const across = W >= H * 0.9;
        x.fillStyle = B.c2; x.fillRect(0, 0, W, H);
        x.fillStyle = B.c1; x.beginPath();
        if (across) { x.moveTo(0, 0); x.lineTo(W * 0.55, 0); x.lineTo(W * 0.45, H); x.lineTo(0, H); }
        else { x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, H * 0.47); x.lineTo(0, H * 0.53); }
        x.closePath(); x.fill();
        x.strokeStyle = '#ffffff'; x.lineWidth = 8 * Math.min(W, H) / 720;
        x.beginPath(); if (across) { x.moveTo(W * 0.55, 0); x.lineTo(W * 0.45, H); } else { x.moveTo(W, H * 0.47); x.lineTo(0, H * 0.53); } x.stroke();
        const r = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
        r.addColorStop(0, 'rgba(255,255,255,0.12)'); r.addColorStop(1, 'rgba(0,0,0,0.3)');
        x.fillStyle = r; x.fillRect(0, 0, W, H);
      } else {
        x.fillStyle = B.c1; x.fillRect(0, 0, W, H);
        x.save();
        x.globalAlpha = 0.35; x.fillStyle = B.c2; x.strokeStyle = B.c2;
        const step = 48 * k;
        if (B.pattern === 'dots') {
          for (let yy = step / 2; yy < H; yy += step) for (let xx = step / 2; xx < W; xx += step) { x.beginPath(); x.arc(xx, yy, 4 * k, 0, Math.PI * 2); x.fill(); }
        } else if (B.pattern === 'stripes') {
          x.lineWidth = 14 * k;
          for (let d = -H; d < W + H; d += step * 1.4) { x.beginPath(); x.moveTo(d, 0); x.lineTo(d + H, H); x.stroke(); }
        } else {
          x.lineWidth = 2 * k;
          for (let xx = 0; xx < W; xx += step) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, H); x.stroke(); }
          for (let yy = 0; yy < H; yy += step) { x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
        }
        x.restore();
      }
      return (cache[key] = c);
    }

    /** Fit by height, unless that would make a wide subject wider than the frame. */
    const baseHOf = (W, H) => (S.cut ? Math.min(0.95, 0.9 * (W / H) * S.cut.h / S.cut.w) : 0.95);
    /** Where the cut-out sits on a W×H frame. */
    function subjectRect(W, H, SU) {
      const cut = S.cut; if (!cut) return null;
      const sh = H * baseHOf(W, H) * SU.scale;
      const sw = sh * cut.w / cut.h;
      return { x: SU.x * W - sw / 2, y: SU.y * H - sh, w: sw, h: sh };
    }
    function drawCut(ctx, R, mirror) {
      ctx.save();
      if (mirror) { ctx.translate(R.x + R.w, R.y); ctx.scale(-1, 1); ctx.drawImage(S.cut.canvas, 0, 0, R.w, R.h); }
      else ctx.drawImage(S.cut.canvas, R.x, R.y, R.w, R.h);
      ctx.restore();
    }
    /** The glow or outline under the cut-out, then the cut-out itself. */
    /* The cut-out with its outline and glow, drawn once per size and kept:
       dragging anything then costs one drawImage instead of 36 stamps and a
       blur of the silhouette, which took about 100 ms a frame at 1080×1920. */
    const sprites = new Map();
    function subjectSprite(W, R, mirror, G) {
      const k = W / W0, r = G.width * k;
      const glow = G.style !== 'none' && G.width > 0 && G.strength > 0;
      const pad = glow ? Math.ceil(r * 4 + 4) : 1;
      const w = Math.max(1, Math.round(R.w)), h = Math.max(1, Math.round(R.h));
      const key = [S.cut.gen, w, h, mirror ? 1 : 0, G.style, G.colour, G.width, G.strength, k.toFixed(4), hasFilter ? 1 : 0].join('|');
      let sp = sprites.get(key);
      if (sp) { sprites.delete(key); sprites.set(key, sp); return sp; }
      const sw = w + pad * 2, sh = h + pad * 2;
      const c = el('canvas'); c.width = sw; c.height = sh;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      const at = { x: pad, y: pad, w, h };
      if (glow) {
        const sil = scratch('sil', sw, sh);
        const sx = sil.getContext('2d');
        sx.globalCompositeOperation = 'source-over';
        sx.clearRect(0, 0, sw, sh);
        drawCut(sx, at, mirror);
        sx.globalCompositeOperation = 'source-in';
        sx.fillStyle = G.colour; sx.fillRect(0, 0, sw, sh);
        const strength = clamp(G.strength, 0, 1);
        if (G.style === 'hard' || G.style === 'both') {
          x.globalAlpha = strength;
          for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; x.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r); }
          if (r > 6 * k) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.drawImage(sil, Math.cos(a) * r / 2, Math.sin(a) * r / 2); }
        }
        if (G.style === 'soft' || G.style === 'both') {
          x.globalAlpha = strength;
          if (hasFilter) { x.filter = 'blur(' + (r * 1.4).toFixed(1) + 'px)'; x.drawImage(sil, 0, 0); x.drawImage(sil, 0, 0); x.filter = 'none'; }
          else { x.globalAlpha = strength * 0.5; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; x.drawImage(sil, Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6); } }
        }
        x.globalAlpha = 1;
      }
      drawCut(x, at, mirror);
      sp = { c, pad };
      sprites.set(key, sp);
      while (sprites.size > 5) sprites.delete(sprites.keys().next().value);
      return sp;
    }
    function drawSubject(ctx, W, H, R, mirror, G, alpha) {
      if (R.w * R.h <= 4 * W * H) {
        const sp = subjectSprite(W, R, mirror, G);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(sp.c, Math.round(R.x) - sp.pad, Math.round(R.y) - sp.pad);
        ctx.restore();
        return;
      }
      /* a cut-out blown up far past the frame: draw only the part that shows */
      const k = W / W0;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (G.style !== 'none' && G.width > 0 && G.strength > 0) {
        const r = G.width * k;
        /* the silhouette, on a canvas only as big as the cut-out and its
           glow rather than the whole frame — a 1080×1920 frame stamped 36
           times made dragging slow */
        const pad = Math.ceil(r * 4 + 4);
        const ox = Math.floor(Math.max(R.x - pad, -pad)), oy = Math.floor(Math.max(R.y - pad, -pad));
        const sw = Math.max(1, Math.ceil(Math.min(R.x + R.w + pad, W + pad)) - ox), sh = Math.max(1, Math.ceil(Math.min(R.y + R.h + pad, H + pad)) - oy);
        const sil = scratch('sil', sw, sh);
        const sx = sil.getContext('2d');
        sx.globalCompositeOperation = 'source-over';
        sx.clearRect(0, 0, sw, sh);
        drawCut(sx, { x: R.x - ox, y: R.y - oy, w: R.w, h: R.h }, mirror);
        sx.globalCompositeOperation = 'source-in';
        sx.fillStyle = G.colour; sx.fillRect(0, 0, sw, sh);
        if (G.style === 'hard' || G.style === 'both') {
          ctx.save();
          ctx.globalAlpha = alpha * clamp(G.strength, 0, 1);
          const n = 24;
          for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; ctx.drawImage(sil, ox + Math.cos(a) * r, oy + Math.sin(a) * r); }
          if (r > 6 * k) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.drawImage(sil, ox + Math.cos(a) * r / 2, oy + Math.sin(a) * r / 2); }
          ctx.restore();
        }
        if (G.style === 'soft' || G.style === 'both') {
          ctx.save();
          ctx.globalAlpha = alpha * clamp(G.strength, 0, 1);
          if (hasFilter) { ctx.filter = 'blur(' + (r * 1.4).toFixed(1) + 'px)'; ctx.drawImage(sil, ox, oy); ctx.drawImage(sil, ox, oy); }
          else { ctx.globalAlpha = alpha * G.strength * 0.5; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.drawImage(sil, ox + Math.cos(a) * r * 1.6, oy + Math.sin(a) * r * 1.6); } }
          ctx.restore();
        }
      }
      drawCut(ctx, R, mirror);
      ctx.restore();
    }

    /* ---- shapes, arrows and badges: canvas paths, no files ---- */
    const shapeFont = (L, px) => A.fontString({ font: L.font || 'Impact', weight: 900 }, px);
    function shapeGeom(ctx, L, W, H) {
      const u = Math.min(W, H), s = Math.max(4, (Number(L.size) || 0.3) * u);
      const lw = Math.max(1, (Number(L.width) || 9) * u / 720);
      const kind = L.kind;
      if (kind === 'arrow') return { s, lw, hw: s / 2 + lw, hh: Math.max(lw * 2.2, s * 0.22) * 0.8 + lw };
      if (kind === 'curve') return { s, lw, hw: s / 2 + lw, hh: s * 0.32 + lw };
      if (kind === 'circle') return { s, lw, hw: s / 2 + lw, hh: s / 2 * 0.72 + lw };
      if (kind === 'box') return { s, lw, hw: s / 2 + lw, hh: s * 0.31 + lw };
      if (kind === 'underline') return { s, lw, hw: s / 2 + lw, hh: s * 0.06 + lw };
      if (kind === 'tick' || kind === 'cross') return { s, lw, hw: s / 2 + lw, hh: s / 2 + lw };
      if (kind === 'star') return { s, lw, hw: s / 2, hh: s / 2 };
      const px = s * 0.3;
      const text = String(L.text || '').toUpperCase();
      ctx.save(); ctx.font = shapeFont(L, px); const tw = ctx.measureText(text).width; ctx.restore();
      if (kind === 'badge') { const w = tw + px * 1.2, h = px * 1.55; return { s, lw, px, text, hw: w / 2, hh: h / 2 }; }
      if (kind === 'bar') { const w = Math.max(tw + px * 1.6, (Number(L.span) || 1) * W), h = px * 1.75; return { s, lw, px, text, hw: w / 2, hh: h / 2 }; }
      const r = Math.max(tw, px) / 2 + px * 0.55;
      if (kind === 'disc') return { s, lw, px, text, r, hw: r, hh: r };
      return { s, lw, px, text, r: r * 1.32, hw: r * 1.32, hh: r * 1.32 };
    }
    function starPath(ctx, n, ro, ri) {
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? ri : ro; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath();
    }
    function drawShape(ctx, L, W, H) {
      const g = shapeGeom(ctx, L, W, H);
      const s = g.s, lw = g.lw, kind = L.kind;
      ctx.save();
      ctx.globalAlpha = opac(L);
      ctx.translate(L.x * W, L.y * H);
      ctx.rotate(rad(L.rotation));
      if (L.flip && !TEXT_SHAPES.has(kind)) ctx.scale(-1, 1);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (LINE_SHAPES.has(kind)) {
        const path = () => {
          ctx.beginPath();
          if (kind === 'arrow') {
            const head = Math.max(lw * 2.2, s * 0.22);
            ctx.moveTo(-s / 2, 0); ctx.lineTo(s / 2, 0);
            ctx.moveTo(s / 2 - head, -head * 0.8); ctx.lineTo(s / 2, 0); ctx.lineTo(s / 2 - head, head * 0.8);
          } else if (kind === 'curve') {
            const head = Math.max(lw * 2.2, s * 0.2);
            const sx = -s / 2, sy = s * 0.22, cx = -s * 0.05, cy = -s * 0.5, ex = s / 2, ey = 0;
            ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx, cy, ex, ey);
            const a = Math.atan2(ey - cy, ex - cx);
            ctx.moveTo(ex + Math.cos(a + Math.PI - 0.5) * head, ey + Math.sin(a + Math.PI - 0.5) * head);
            ctx.lineTo(ex, ey);
            ctx.lineTo(ex + Math.cos(a + Math.PI + 0.5) * head, ey + Math.sin(a + Math.PI + 0.5) * head);
          } else if (kind === 'circle') {
            ctx.ellipse(0, 0, s / 2, s / 2 * 0.72, 0, 0, Math.PI * 2);
          } else if (kind === 'box') {
            const w = s, h = s * 0.62, r = lw * 1.5;
            if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, r); else ctx.rect(-w / 2, -h / 2, w, h);
          } else if (kind === 'underline') {
            ctx.moveTo(-s / 2, s * 0.03); ctx.quadraticCurveTo(0, -s * 0.06, s / 2, 0);
          } else if (kind === 'tick') {
            ctx.moveTo(-s * 0.4, s * 0.02); ctx.lineTo(-s * 0.12, s * 0.32); ctx.lineTo(s * 0.42, -s * 0.36);
          } else {
            ctx.moveTo(-s * 0.36, -s * 0.36); ctx.lineTo(s * 0.36, s * 0.36); ctx.moveTo(s * 0.36, -s * 0.36); ctx.lineTo(-s * 0.36, s * 0.36);
          }
        };
        const pass = (stroke, extra) => { ctx.strokeStyle = stroke; ctx.lineWidth = lw + extra; path(); ctx.stroke(); };
        pass('rgba(0,0,0,0.55)', lw * 0.9);
        pass(L.colour, 0);
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = s * 0.05; ctx.shadowOffsetY = s * 0.02;
        ctx.fillStyle = L.colour;
        if (kind === 'star') {
          starPath(ctx, 5, s / 2, s / 2 * 0.46); ctx.fill();
          ctx.shadowColor = 'transparent'; ctx.lineWidth = Math.max(1, lw * 0.5); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
        } else {
          ctx.beginPath();
          if (kind === 'badge' || kind === 'bar') {
            const r = kind === 'badge' ? g.hh * 0.45 : 0;
            if (ctx.roundRect) ctx.roundRect(-g.hw, -g.hh, g.hw * 2, g.hh * 2, r); else ctx.rect(-g.hw, -g.hh, g.hw * 2, g.hh * 2);
          } else if (kind === 'disc') ctx.arc(0, 0, g.r, 0, Math.PI * 2);
          else starPath(ctx, 12, g.r, g.r * 0.8);
          ctx.fill();
          ctx.shadowColor = 'transparent';
          if (g.text) {
            ctx.font = shapeFont(L, g.px); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = L.colour2 || '#ffffff';
            ctx.fillText(g.text, 0, g.px * 0.04);
          }
        }
      }
      ctx.restore();
    }

    /* ---- emoji: Noto SVGs drawn as images, so an export looks the same everywhere ---- */
    const emo = new Map();
    function emojiImg(key) {
      let e = emo.get(key);
      if (e) return e.ok ? e.img : null;
      if (!noto || !noto.icons[key]) return null;
      const img = new Image();
      e = { img, ok: false };
      e.p = new Promise((res) => {
        img.onload = () => { e.ok = true; invalidate(); res(true); };
        img.onerror = () => { e.failed = true; res(false); };
      });
      img.src = svgUrl(noto.icons[key].body, noto.width, noto.height);
      emo.set(key, e);
      return null;
    }
    const emojiName = (key) => (noto && noto.icons[key] ? noto.icons[key].name : String(key || '').replace(/-/g, ' '));
    const emojiChar = (key) => (noto && noto.icons[key] ? noto.icons[key].char : '');
    function drawEmoji(ctx, L, W, H) {
      const img = emojiImg(L.key);
      if (!img) return;
      const s = Math.max(4, (Number(L.size) || 0.25) * Math.min(W, H));
      ctx.save();
      ctx.globalAlpha = opac(L);
      ctx.translate(L.x * W, L.y * H);
      ctx.rotate(rad(L.rotation));
      if (L.flip) ctx.scale(-1, 1);
      if (L.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = s * 0.06; ctx.shadowOffsetY = s * 0.03; }
      const o = (Number(L.outline) || 0) / 100 * s;
      if (o > 0.5) {
        /* a die-cut sticker edge: the emoji's silhouette in the edge colour, stamped round a circle */
        const pad = Math.ceil(o) + 2, n = Math.ceil(s) + pad * 2;
        const sil = scratch('emo-sil', n, n), stk = scratch('emo-stk', n, n);
        const sx = sil.getContext('2d'), kx = stk.getContext('2d');
        sx.globalCompositeOperation = 'source-over'; sx.clearRect(0, 0, n, n); sx.drawImage(img, pad, pad, s, s);
        sx.globalCompositeOperation = 'source-in'; sx.fillStyle = L.outlineColour || '#ffffff'; sx.fillRect(0, 0, n, n);
        kx.clearRect(0, 0, n, n);
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; kx.drawImage(sil, Math.cos(a) * o, Math.sin(a) * o); }
        kx.drawImage(sil, 0, 0);
        kx.drawImage(img, pad, pad, s, s);
        ctx.drawImage(stk, -n / 2, -n / 2);
      } else ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    async function readyEmoji(layers) {
      const keys = layers.filter((l) => l.type === 'emoji' && !l.hidden).map((l) => l.key);
      if (!keys.length) return;
      await ensureNoto();
      for (const k of keys) emojiImg(k);
      await Promise.all(keys.map((k) => (emo.get(k) ? emo.get(k).p : null)));
    }

    /* The title as it will be drawn: shrunk until it fits inside the size's
       safe area, then moved just far enough to stay inside it. Without this
       a title longer than about six characters ran off the left edge at the
       default size and position — "30 DAYS LATER" lost its first letter —
       and the exported thumbnail was cropped. The stroke and the rotation
       are counted, since half the stroke sits outside the letters. */
    function fitted(ctx, L, W, H, fmt) {
      const sa = SAFE[fmt] || SAFE.yt;
      const stroke = (Number(L.strokeWidth) || 0) / 100;
      const F = Object.assign({}, L);
      let lay = A.layout(ctx, F, W);
      const r = rad(L.rotation), c = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r));
      const ext = (l) => { const w = l.blockW + l.px * stroke * 2, h = l.blockH + l.px * stroke * 2; return { w: w * c + h * sn, h: w * sn + h * c }; };
      const maxW = W * (1 - sa.l - sa.r), maxH = H * (1 - sa.t - sa.b);
      let e = ext(lay);
      const k = Math.min(1, maxW / Math.max(1, e.w), maxH / Math.max(1, e.h));
      if (k < 1) { F.size = (Number(L.size) || 15) * k * 0.995; lay = A.layout(ctx, F, W); e = ext(lay); }
      const hw = e.w / 2 / W, hh = e.h / 2 / H;
      F.x = clamp(Number(L.x), sa.l + hw, 1 - sa.r - hw);
      F.y = clamp(Number(L.y), sa.t + hh, 1 - sa.b - hh);
      return F;
    }
    function renderFrame(ctx, W, H) {
      const V = view();
      ctx.save();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(background(W, H, V.bg), 0, 0, W, H);
      for (const L of V.layers) {
        if (L.hidden) continue;
        if (L.type === 'subject') {
          if (!S.cut) continue;
          if (V.subject.twin) {
            const TW = Object.assign({}, V.subject, { x: 1 - V.subject.x, scale: V.subject.scale * 0.92 });
            drawSubject(ctx, W, H, subjectRect(W, H, TW), !V.subject.mirror, V.glow, 0.85);
          }
          drawSubject(ctx, W, H, subjectRect(W, H, V.subject), V.subject.mirror, V.glow, 1);
        } else if (L.type === 'text') A.drawText(ctx, fitted(ctx, L, W, H, V.fmt), 0, W, H, 1);
        else if (L.type === 'emoji') drawEmoji(ctx, L, W, H);
        else if (L.type === 'shape') drawShape(ctx, L, W, H);
      }
      ctx.restore();
    }

    /** A layer's box on the frame: centre, half sizes and turn, for hit-testing and the selection outline. */
    function boxOf(L, W, H) {
      if (!L || L.hidden) return null;
      if (L.type === 'text') {
        const F = fitted(pctx, L, W, H, S.fmt);
        const b = A.textBox(pctx, F, 0, W, H, 1);
        return { cx: b.cx, cy: b.cy, hw: b.w / 2, hh: b.h / 2, rot: rad(F.rotation), F };
      }
      if (L.type === 'subject') {
        const R = S.cut ? subjectRect(W, H, S.subject) : null;
        return R ? { cx: R.x + R.w / 2, cy: R.y + R.h / 2, hw: R.w / 2, hh: R.h / 2, rot: 0, R } : null;
      }
      if (L.type === 'emoji') { const s = (Number(L.size) || 0.25) * Math.min(W, H); return { cx: L.x * W, cy: L.y * H, hw: s / 2, hh: s / 2, rot: rad(L.rotation) }; }
      const g = shapeGeom(pctx, L, W, H);
      return { cx: L.x * W, cy: L.y * H, hw: g.hw, hh: g.hh, rot: rad(L.rotation) };
    }
    function inBox(b, x, y, pad) {
      const dx = x - b.cx, dy = y - b.cy, c = Math.cos(b.rot), s = Math.sin(b.rot);
      const lx = dx * c + dy * s, ly = -dx * s + dy * c;
      return Math.abs(lx) <= b.hw + (pad || 0) && Math.abs(ly) <= b.hh + (pad || 0);
    }
    const corner = (b, sx, sy) => { const c = Math.cos(b.rot), s = Math.sin(b.rot), x = sx * b.hw, y = sy * b.hh; return [b.cx + x * c - y * s, b.cy + x * s + y * c]; };
    const handleR = () => Math.max(8, 11 * canvas.width / Math.max(1, canvas.getBoundingClientRect().width || canvas.width));
    /** Is the cut-out opaque at this point of the preview? */
    function subjectOpaque(x, y) {
      const R = subjectRect(canvas.width, canvas.height, S.subject);
      if (!R) return false;
      let u = (x - R.x) / R.w; if (S.subject.mirror) u = 1 - u;
      const v = (y - R.y) / R.h;
      if (u < 0 || v < 0 || u >= 1 || v >= 1) return false;
      try {
        const d = S.cut.canvas.getContext('2d').getImageData(Math.floor(u * S.cut.w), Math.floor(v * S.cut.h), 1, 1).data;
        return d[3] > 128;
      } catch (e) { return true; }
    }
    function hitTest(x, y) {
      const W = canvas.width, H = canvas.height;
      const pad = handleR() * 0.4;
      for (let i = S.layers.length - 1; i >= 0; i--) {
        const L = S.layers[i];
        const b = boxOf(L, W, H);
        if (!b || !inBox(b, x, y, L.type === 'subject' ? 0 : pad)) continue;
        if (L.type === 'subject') {
          /* the cut-out's box is mostly air: take it only where it is solid,
             or when nothing else is under the pointer */
          if (subjectOpaque(x, y)) return L;
          for (let j = i - 1; j >= 0; j--) { const M = S.layers[j]; const bb = M.type !== 'subject' && boxOf(M, W, H); if (bb && inBox(bb, x, y, pad)) return M; }
          return L;
        }
        return L;
      }
      return null;
    }

    function draw() {
      if (!S.started) return;
      const W = canvas.width, H = canvas.height;
      renderFrame(pctx, W, H);
      if (!S.exporting) {
        pctx.save();
        const lw = Math.max(1.5, W / 800);
        if (S.showSafe) {
          const sa = SAFE[S.fmt];
          pctx.setLineDash([10, 8]); pctx.lineWidth = lw; pctx.strokeStyle = 'rgba(45,212,255,.9)';
          pctx.strokeRect(sa.l * W, sa.t * H, W * (1 - sa.l - sa.r), H * (1 - sa.t - sa.b));
        }
        if (S.snap) {
          pctx.setLineDash([]); pctx.lineWidth = lw; pctx.strokeStyle = 'rgba(255,92,240,.9)';
          pctx.beginPath();
          if (S.snap.x) { pctx.moveTo(W / 2, 0); pctx.lineTo(W / 2, H); }
          if (S.snap.y) { pctx.moveTo(0, H / 2); pctx.lineTo(W, H / 2); }
          pctx.stroke();
        }
        const L = layerById(S.sel);
        const b = L && boxOf(L, W, H);
        if (b) {
          pctx.setLineDash([6 * W / W0 + 2, 5 * W / W0 + 2]); pctx.lineWidth = lw; pctx.strokeStyle = 'rgba(247,201,72,.95)';
          pctx.beginPath();
          [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], i) => { const p = corner(b, sx, sy); if (i) pctx.lineTo(p[0], p[1]); else pctx.moveTo(p[0], p[1]); });
          pctx.closePath(); pctx.stroke();
          const hp = corner(b, 1, 1), r = handleR();
          pctx.setLineDash([]); pctx.fillStyle = '#f7c948'; pctx.strokeStyle = '#111111';
          pctx.beginPath(); pctx.rect(hp[0] - r / 2, hp[1] - r / 2, r, r); pctx.fill(); pctx.stroke();
        }
        pctx.restore();
      }
      dirty = false;
    }
    let mounted = true;
    function loop() {
      if (!mounted) return;
      if (dirty) draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    /* ---------------- undo and redo: snapshots of the doc, never pixels ---------------- */
    function docOf() {
      const subject = Object.assign({}, S.subject); delete subject.baseH;
      return clone({ v: 1, fmt: S.fmt, bg: S.bg, subject, glow: S.glow, layers: S.layers, tpl: S.tpl || null });
    }
    const docJSON = () => JSON.stringify(docOf());
    const hist = { stack: [], i: -1 };
    let commitTimer = 0;
    function commitNow() {
      clearTimeout(commitTimer); commitTimer = 0;
      const j = docJSON();
      if (hist.stack[hist.i] === j) { syncUndo(); return false; }
      hist.stack = hist.stack.slice(0, hist.i + 1);
      hist.stack.push(j);
      if (hist.stack.length > HISTORY_MAX) hist.stack.shift();
      hist.i = hist.stack.length - 1;
      syncUndo();
      return true;
    }
    const scheduleCommit = () => { clearTimeout(commitTimer); commitTimer = setTimeout(commitNow, 400); };
    /** Something the visitor did changed the design. */
    const edit = () => { invalidate(); scheduleCommit(); };
    const editBg = () => { rebg(); scheduleCommit(); };
    function undo() {
      if (commitTimer) commitNow();
      if (hist.i <= 0) return false;
      hist.i--;
      restore(JSON.parse(hist.stack[hist.i]));
      syncUndo();
      return true;
    }
    function redo() {
      if (commitTimer) commitNow();
      if (hist.i >= hist.stack.length - 1) return false;
      hist.i++;
      restore(JSON.parse(hist.stack[hist.i]));
      syncUndo();
      return true;
    }
    function syncUndo() {
      undoBtn.disabled = hist.i <= 0;
      redoBtn.disabled = hist.i >= hist.stack.length - 1;
    }
    function sanitiseLayers(list) {
      const out = [];
      for (const L of Array.isArray(list) ? list : []) {
        if (!L || typeof L !== 'object') continue;
        if (L.type === 'subject') { if (!out.some((l) => l.type === 'subject')) out.push(Object.assign(SUBJECT_LAYER(), L)); }
        else if (L.type === 'text' || L.type === 'emoji' || L.type === 'shape') out.push(clone(L));
      }
      if (!out.some((l) => l.type === 'subject')) out.unshift(SUBJECT_LAYER());
      return out;
    }
    function restore(d) {
      if (!d || typeof d !== 'object') return;
      S.fmt = SIZES[d.fmt] ? d.fmt : 'yt';
      S.bg = Object.assign(defBg(), d.bg || {});
      S.subject = Object.assign(defSubject(), d.subject || {});
      S.glow = Object.assign(defGlow(), d.glow || {});
      S.layers = sanitiseLayers(d.layers);
      S.tpl = d.tpl || null;
      if (!layerById(S.sel)) S.sel = null;
      applyFormat();
      afterLayersChanged();
    }
    function afterLayersChanged() {
      for (const L of S.layers) if (L.type === 'text') A.ensureFont(L).then(invalidate);
      if (S.layers.some((l) => l.type === 'emoji')) ensureNoto().then(invalidate, () => {});
      rebg();
      syncAll();
    }

    /* ---------------- the stack ---------------- */
    function selectLayer(id) {
      S.sel = id;
      const L = layerById(id);
      if (L && L.type === 'text') S.lastText = id;
      syncSelection();
      invalidate();
    }
    function addLayer(L, at) {
      const i = at === undefined ? S.layers.length : at;
      S.layers.splice(i, 0, L);
      selectLayer(L.id);
      renderStack();
      commitNow();
      return L;
    }
    /** Somewhere free near the middle, so a second layer does not sit exactly on the first. */
    function freeSpot(x, y) {
      let n = 0;
      while (n < 8 && S.layers.some((l) => l.type !== 'subject' && Math.abs(l.x - x) < 0.02 && Math.abs(l.y - y) < 0.02)) { x += 0.04; y += 0.04; n++; }
      return { x: clamp(x, 0.1, 0.9), y: clamp(y, 0.1, 0.9) };
    }
    function addText(partial) {
      const p = freeSpot(0.5, 0.5);
      const L = newText(Object.assign({ text: 'NEW TEXT', size: 9, x: p.x, y: p.y, align: 'center' }, partial || {}));
      A.ensureFont(L).then(invalidate);
      return addLayer(L);
    }
    function addEmoji(key) {
      const p = freeSpot(0.5, 0.4);
      const L = addLayer(newEmoji({ key, x: p.x, y: p.y }));
      ensureNoto().then(invalidate, () => {});
      return L;
    }
    function addShape(kind) {
      const p = freeSpot(0.5, 0.5);
      return addLayer(newShape({ kind, x: p.x, y: p.y }));
    }
    function removeLayer(id) {
      const i = S.layers.findIndex((l) => l.id === id);
      if (i < 0) return false;
      if (S.layers[i].type === 'subject') { say('The cut-out stays in the stack; hide it in Layers, or untick its layers in Subject.', 'note'); return false; }
      S.layers.splice(i, 1);
      if (S.sel === id) S.sel = null;
      if (S.lastText === id) S.lastText = null;
      syncAll();
      invalidate();
      commitNow();
      return true;
    }
    function duplicateLayer(id) {
      const i = S.layers.findIndex((l) => l.id === id);
      if (i < 0 || S.layers[i].type === 'subject') return null;
      const L = clone(S.layers[i]);
      L.id = newId(L.type); L.role = null;
      L.x = clamp(L.x + 0.04, 0, 1); L.y = clamp(L.y + 0.04, 0, 1);
      return addLayer(L, i + 1);
    }
    function moveLayer(id, dir) {
      const i = S.layers.findIndex((l) => l.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= S.layers.length) return false;
      const t = S.layers[i]; S.layers[i] = S.layers[j]; S.layers[j] = t;
      syncAll();
      invalidate();
      commitNow();
      return true;
    }
    const sizeOf = (L) => (L.type === 'subject' ? S.subject.scale : Number(L.size) || 0);
    function setSize(L, v) {
      if (L.type === 'subject') S.subject.scale = clamp(v, 0.2, 3);
      else if (L.type === 'text') L.size = clamp(v, 1, 80);
      else L.size = clamp(v, 0.03, 2);
    }
    const posOf = (L) => (L.type === 'subject' ? S.subject : L);

    /* ---------------- pointer: select, drag, resize ---------------- */
    let drag = null;
    const toCanvas = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * canvas.width, y: (e.clientY - r.top) / r.height * canvas.height }; };
    canvas.addEventListener('pointerdown', (e) => {
      if (!S.started || S.exporting) return;
      const p = toCanvas(e);
      const W = canvas.width, H = canvas.height;
      const cur = layerById(S.sel);
      const cb = cur && boxOf(cur, W, H);
      if (cb) {
        const hp = corner(cb, 1, 1);
        if (Math.hypot(p.x - hp[0], p.y - hp[1]) <= handleR() * 1.4) {
          const anchor = cur.type === 'subject' ? [S.subject.x * W, S.subject.y * H] : [cb.cx, cb.cy];
          if (cur.type === 'text') { cur.x = cb.F.x; cur.y = cb.F.y; }
          drag = { mode: 'resize', id: cur.id, anchor, d0: Math.max(1, Math.hypot(p.x - anchor[0], p.y - anchor[1])), v0: sizeOf(cur), moved: false };
          canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true }); e.preventDefault();
          return;
        }
      }
      const L = hitTest(p.x, p.y);
      if (!L) { if (S.sel) { S.sel = null; syncSelection(); invalidate(); } return; }
      selectLayer(L.id);
      /* start from where it is drawn, so a title the fit has moved does not jump under the pointer */
      if (L.type === 'text') { const F = fitted(pctx, L, W, H, S.fmt); L.x = F.x; L.y = F.y; }
      const P = posOf(L);
      drag = { mode: 'move', id: L.id, dx: p.x - P.x * W, dy: p.y - P.y * H, moved: false };
      canvas.setPointerCapture(e.pointerId);
      canvas.focus({ preventScroll: true });
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const L = layerById(drag.id); if (!L) return;
      const p = toCanvas(e);
      const W = canvas.width, H = canvas.height;
      drag.moved = true;
      if (drag.mode === 'resize') {
        setSize(L, drag.v0 * Math.hypot(p.x - drag.anchor[0], p.y - drag.anchor[1]) / drag.d0);
      } else {
        let x = (p.x - drag.dx) / W, y = (p.y - drag.dy) / H;
        S.snap = null;
        if (L.type !== 'subject' && !e.shiftKey) {
          /* snap the centre to the middle of the frame */
          const sx = Math.abs(x - 0.5) < 0.012, sy = Math.abs(y - 0.5) < 0.012;
          if (sx) x = 0.5; if (sy) y = 0.5;
          if (sx || sy) S.snap = { x: sx, y: sy };
        }
        if (L.type === 'subject') { S.subject.x = clamp(x, -0.3, 1.3); S.subject.y = clamp(y, 0.2, 1.6); }
        else { L.x = clamp(x, -0.3, 1.3); L.y = clamp(y, -0.3, 1.3); }
      }
      syncPositions();
      invalidate();
    });
    const endDrag = () => { if (drag && drag.moved) commitNow(); drag = null; if (S.snap) { S.snap = null; invalidate(); } };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('dblclick', (e) => {
      const L = hitTest(toCanvas(e).x, toCanvas(e).y);
      if (L && L.type === 'text') { selectLayer(L.id); showPane('text'); textArea.focus(); }
      else if (L && L.type !== 'subject') showPane('accent');
    });
    canvas.addEventListener('keydown', (e) => {
      if (!S.started || e.ctrlKey || e.metaKey || e.altKey) return;
      const L = layerById(S.sel);
      if (!L) return;
      const W = canvas.width, H = canvas.height;
      const step = e.shiftKey ? 0.05 : 0.005;
      const nudge = (dx, dy) => {
        if (L.type === 'text') { const F = fitted(pctx, L, W, H, S.fmt); L.x = F.x; L.y = F.y; }
        const P = posOf(L); P.x = clamp(P.x + dx, -0.3, 1.3); P.y = clamp(P.y + dy, -0.3, 1.6);
      };
      switch (e.key) {
        case 'ArrowLeft': nudge(-step, 0); break;
        case 'ArrowRight': nudge(step, 0); break;
        case 'ArrowUp': nudge(0, -step); break;
        case 'ArrowDown': nudge(0, step); break;
        case '+': case '=': setSize(L, sizeOf(L) * 1.05); break;
        case '-': case '_': setSize(L, sizeOf(L) / 1.05); break;
        case 'Delete': case 'Backspace': e.preventDefault(); removeLayer(L.id); return;
        case 'Escape': S.sel = null; syncSelection(); invalidate(); return;
        default: return;
      }
      e.preventDefault();
      syncPositions();
      edit();
    });
    const onDocKey = (e) => {
      if (!mounted || studio.hidden || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      const t = e.target;
      /* inside a text box the browser's own undo is the right one */
      if (t && (t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && /^(text|search|number|email|url)$/i.test(t.type)))) return;
      if (!wrap.contains(t) && t !== document.body && t !== document.documentElement) return;
      const k = String(e.key).toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
      else if (k === 'd' && t === canvas && S.sel) { e.preventDefault(); duplicateLayer(S.sel); }
    };
    document.addEventListener('keydown', onDocKey);

    /* ---------------- the cut-out ---------------- */
    /** Keep only the largest 8-connected blob of a 0/1 mask: the main subject, not every passer-by. */
    function keepLargest(bin, w, h) {
      const lab = new Int32Array(w * h), stack = new Int32Array(w * h);
      let best = 0, bestSize = 0, next = 0;
      for (let i = 0; i < bin.length; i++) {
        if (!bin[i] || lab[i]) continue;
        next++; let size = 0, sp = 0; stack[sp++] = i; lab[i] = next;
        while (sp) {
          const j = stack[--sp]; size++;
          const x = j % w, y = (j - x) / w;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const k = yy * w + xx;
            if (bin[k] && !lab[k]) { lab[k] = next; stack[sp++] = k; }
          }
        }
        if (size > bestSize) { bestSize = size; best = next; }
      }
      for (let i = 0; i < bin.length; i++) if (lab[i] !== best) bin[i] = 0;
    }
    /** Fill holes the background cannot reach from the frame's edge — a nose the model called something else. */
    function fillHoles(bin, w, h) {
      const seen = new Uint8Array(w * h), stack = new Int32Array(w * h);
      let sp = 0;
      const push = (k) => { if (!bin[k] && !seen[k]) { seen[k] = 1; stack[sp++] = k; } };
      for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
      while (sp) {
        const j = stack[--sp], x = j % w;
        if (x > 0) push(j - 1); if (x < w - 1) push(j + 1);
        if (j >= w) push(j - w); if (j < (h - 1) * w) push(j + w);
      }
      for (let i = 0; i < bin.length; i++) if (!bin[i] && !seen[i]) bin[i] = 1;
    }
    let maskTimer = 0, maskToken = 0, cutGen = 0;
    function scheduleMask() { clearTimeout(maskTimer); maskTimer = setTimeout(rebuildMask, 120); }
    async function rebuildMask() {
      if (!S.seg || !S.image) return;
      const token = ++maskToken;
      const { mw, mh, classMap } = S.seg;
      const inKeep = new Uint8Array(256);
      for (const k of S.keys) inKeep[k] = 1;
      const bin = new Float32Array(mw * mh);
      let any = false;
      for (let i = 0; i < bin.length; i++) if (inKeep[classMap[i]]) { bin[i] = 1; any = true; }
      if (any && S.mainOnly) keepLargest(bin, mw, mh);
      if (any) fillHoles(bin, mw, mh);
      if (!any) { S.alpha = null; S.cut = null; }
      else {
        note('Refining the edge…');
        setStatus('refining the edge…');
        await sleep(0);
        if (token !== maskToken) return;
        if (!S.guide) S.guide = A.guideOf(S.image, mw, mh);
        S.alpha = A.refine(bin, S.guide, { softness: S.softness, shift: S.shift });
        if (token !== maskToken) return;
        /* the cut-out, cropped to what it contains */
        let x0 = mw, y0 = mh, x1 = -1, y1 = -1;
        for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) if (S.alpha[y * mw + x] > 0.02) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
        if (x1 < 0) { S.alpha = null; S.cut = null; }
        else {
          const full = A.cutOut(S.image, S.alpha, mw, mh);
          const sx = S.image.width / mw, sy = S.image.height / mh;
          const pad = Math.round(Math.max(S.image.width, S.image.height) * 0.01);
          const cx = clamp(Math.floor(x0 * sx) - pad, 0, S.image.width - 1), cy = clamp(Math.floor(y0 * sy) - pad, 0, S.image.height - 1);
          const cw = clamp(Math.ceil((x1 + 1) * sx) + pad, cx + 1, S.image.width) - cx, ch = clamp(Math.ceil((y1 + 1) * sy) + pad, cy + 1, S.image.height) - cy;
          const c = el('canvas'); c.width = cw; c.height = ch;
          c.getContext('2d', { willReadFrequently: true }).drawImage(full, cx, cy, cw, ch, 0, 0, cw, ch);
          S.cut = { canvas: c, x: cx, y: cy, w: cw, h: ch, gen: ++cutGen };
        }
        note('');
      }
      S.subject.baseH = baseHOf(canvas.width, canvas.height);
      computeCrop();
      rebg();
      renderStack();
      schedulePreviews();
      setStatus('ready');
    }
    function setStatus(tail) {
      if (!S.seg) return;
      const n = S.seg.layers.length;
      const kept = S.seg.layers.filter((l) => S.keys.has(l.key)).map((l) => l.name);
      status.textContent = n + ' layer' + (n === 1 ? '' : 's') + ' found' + (kept.length ? '. Cut out: ' + kept.slice(0, 3).join(', ') + (kept.length > 3 ? '…' : '') : '. Nothing cut out yet') + ' — ' + tail;
    }

    /* ---------------- panes ---------------- */
    const h = (t) => el('p', 'aiimg-h', t);
    const grid = (...fields) => { const g = el('div', 'aiimg-grid2'); g.append(...fields); return g; };
    const row = (...kids) => { const r = el('div', 'aiimg-row'); r.append(...kids); return r; };
    const palette = (id, get, set) => {
      const r = el('div', 'aiimg-thumb-palette');
      for (const c of PALETTE) {
        const b = button('', 'aiimg-thumb-chip', () => { set(c); sync(); });
        b.style.background = c; b.dataset.colour = c; b.title = c; b.setAttribute('aria-label', 'Colour ' + c);
        r.appendChild(b);
      }
      const pick = on(colour(id, get()), () => { set(pick.value); sync(); });
      r.appendChild(pick);
      function sync() { const v = String(get() || '#ffffff').toLowerCase(); pick.value = v; for (const b of r.children) if (b.dataset.colour) b.classList.toggle('is-on', b.dataset.colour === v); }
      r.sync = sync;
      sync();
      return r;
    };
    const ICONS = {
      up: '<path d="M12 5l-6 7h4v7h4v-7h4z"/>', down: '<path d="M12 19l6-7h-4V5h-4v7H6z"/>',
      copy: '<path d="M8 8h11v11H8z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 16V5h11" fill="none" stroke="currentColor" stroke-width="2"/>',
      eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3"/>',
      hide: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="2"/>',
      del: '<path d="M6 7h12l-1 13H7zM9 4h6v2H9z"/>'
    };
    const iconBtn = (icon, label, fn) => {
      const b = button('', 'btn-ghost aiimg-thumb-ib', fn);
      b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' + ICONS[icon] + '</svg>';
      b.setAttribute('aria-label', label); b.title = label;
      return b;
    };

    /* templates */
    const tplGrid = el('div', 'aiimg-thumb-tpls');
    const tplPreviews = [];
    for (const t of TEMPLATES) {
      const b = button('', 'aiimg-thumb-tpl', () => applyTemplate(t.id));
      b.dataset.tpl = t.id;
      const c = el('canvas'); c.setAttribute('aria-hidden', 'true');
      b.append(c, el('span', null, t.name));
      b.setAttribute('aria-label', 'Template: ' + t.name);
      tplGrid.appendChild(b);
      tplPreviews.push({ t, c, b });
    }
    panes.templates.append(
      el('p', 'field-hint', 'One click lays out the words, stickers and cut-out for the current size. Everything stays editable, and Undo brings back what you had. Works with or without a photo.'),
      tplGrid);
    const P_of = (fmt) => { const f = SIZES[fmt]; const ar = f.w / f.h; const cls = ar > 1.3 ? 'wide' : ar < 0.7 ? 'tall' : 'square'; return (w, t, s) => (cls === 'wide' ? w : cls === 'tall' ? t : (s === undefined ? t : s)); };
    function buildTemplate(id, fmt) {
      const t = TEMPLATES.find((x) => x.id === id);
      return t ? t.build(P_of(fmt)) : null;
    }
    function templateDoc(id, fmt) {
      const d = buildTemplate(id, fmt);
      return { fmt, bg: Object.assign(defBg(), d.bg || {}), subject: Object.assign(defSubject(), d.subject || {}), glow: Object.assign(defGlow(), d.glow || {}), layers: d.layers.map(materialise), tpl: id };
    }
    function mainText(layers) { return layers.find((l) => l.type === 'text' && l.role === 'title') || layers.find((l) => l.type === 'text') || null; }
    async function applyTemplate(id) {
      if (!S.started) startBlank();
      const d = templateDoc(id, S.fmt);
      /* a title the visitor has typed survives the change of template; the
         placeholder words of the default title or of the last template do not */
      const was = mainText(S.layers);
      const prevTpl = S.tpl ? mainText(buildTemplate(S.tpl, S.fmt).layers) : null;
      const typed = was && was.text && was.text !== newText().text && !(prevTpl && prevTpl.text === was.text) ? was.text : null;
      S.bg = d.bg; S.glow = d.glow;
      S.subject = Object.assign(d.subject, { mirror: S.subject.mirror, baseH: S.subject.baseH });
      S.layers = d.layers; S.tpl = id;
      const title = mainText(S.layers);
      if (typed && title && title.role === 'title') title.text = typed;
      S.sel = title ? title.id : null; S.lastText = title ? title.id : null;
      afterLayersChanged();
      commitNow();
      for (const p of tplPreviews) p.b.classList.toggle('is-on', p.t.id === id);
      if (S.layers.some((l) => l.type === 'emoji')) {
        try { await readyEmoji(S.layers); }
        catch (e) { if (e && e.name !== 'AbortError') say('The template is in place, but its emoji could not be loaded: ' + errText(e), 'warn'); }
      }
      invalidate();
    }
    /** After a change of size, put a template's pieces where that template wants them on the new shape. */
    function relayout() {
      if (!S.tpl) return;
      const d = buildTemplate(S.tpl, S.fmt);
      if (!d) return;
      if (d.subject) for (const k of ['x', 'y', 'scale']) if (d.subject[k] !== undefined) S.subject[k] = d.subject[k];
      for (const N of d.layers) {
        if (!N.role) continue;
        const L = S.layers.find((l) => l.role === N.role && l.type === N.type);
        if (!L) continue;
        for (const k of GEOM) if (N[k] !== undefined) L[k] = N[k];
      }
    }
    let pvTimer = 0;
    function schedulePreviews() { clearTimeout(pvTimer); pvTimer = setTimeout(drawPreviews, 60); }
    function drawPreviews() {
      if (panes.templates.hidden || !S.started) return;
      const f = frame(), ar = f.w / f.h;
      const w = ar >= 1 ? 192 : Math.round(192 * ar * 0.75), hgt = Math.round(w / ar);
      for (const p of tplPreviews) {
        if (p.c.width !== w || p.c.height !== hgt) { p.c.width = w; p.c.height = hgt; }
        p.c.style.aspectRatio = f.w + ' / ' + f.h;
        const d = templateDoc(p.t.id, S.fmt);
        d.subject.mirror = S.subject.mirror;
        S.variant = d;
        try { renderFrame(p.c.getContext('2d'), w, hgt); } finally { S.variant = null; }
      }
    }
    onPane.templates = schedulePreviews;

    /* subject */
    const status = el('p', 'aiimg-status', 'Choose a photo to begin.');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    /* the model cannot be stopped mid-run, but the page stops waiting for it and lets go */
    const segCancel = button('Cancel', 'btn-ghost aiimg-thumb-segcancel', () => {
      segToken++; progress.hidden = true; segCancel.hidden = true; note('');
      status.textContent = 'Cancelled — no cut-out was made. Choose the photo again, or change Detail, to try again.';
    });
    segCancel.hidden = true;
    const layerList = el('div', 'aiimg-layers');
    const layersHint = el('p', 'field-hint', 'The ticked layers are cut out and placed on the thumbnail. People are ticked for you.');
    const soft = on(range('aiimg-soft', 0, 10, 1, S.softness), () => { S.softness = Number(soft.input.value); scheduleMask(); });
    const shiftCtl = on(range('aiimg-shift', -5, 5, 1, S.shift, (v) => (v > 0 ? '+' : '') + v), () => { S.shift = Number(shiftCtl.input.value); scheduleMask(); });
    const detailSel = on(select('aiimg-detail', Object.entries(A.DETAIL).map(([k, m]) => [k, m.label]), S.detail), () => { if (detailSel.value !== S.detail) { S.detail = detailSel.value; runSegmentation(); } });
    const sScale = on(range('aiimg-thumb-scale', 20, 300, 2, 100, pct), () => { S.subject.scale = Number(sScale.input.value) / 100; edit(); });
    const sX = on(range('aiimg-thumb-x', -20, 120, 1, Math.round(S.subject.x * 100), pct), () => { S.subject.x = Number(sX.input.value) / 100; edit(); });
    const sY = on(range('aiimg-thumb-y', 20, 160, 1, Math.round(S.subject.y * 100), pct), () => { S.subject.y = Number(sY.input.value) / 100; edit(); });
    const mirror = on(check('aiimg-thumb-mirror', 'Mirror the cut-out', false), () => { S.subject.mirror = mirror.input.checked; edit(); });
    const twin = on(check('aiimg-thumb-twin', 'Add a mirrored twin on the other side', false), () => { S.subject.twin = twin.input.checked; edit(); });
    const front = on(check('aiimg-thumb-front', 'Cut-out in front of the text', true), () => { setFront(front.input.checked); edit(); });
    const mainOnly = on(check('aiimg-thumb-main', 'Largest subject only', true), () => { S.mainOnly = mainOnly.input.checked; scheduleMask(); });
    const fSoft = field('Edge softness', soft, 'Higher follows hair more loosely; lower keeps a crisp cut.');
    panes.layers.append(status, progress, segCancel, layerList, layersHint,
      h('Placement'),
      field('Size', sScale), grid(field('Across', sX), field('Bottom edge', sY, 'Over 100% hides the cut edge below the frame.')),
      mainOnly, el('p', 'field-hint', 'Keeps the biggest person or object and drops the passers-by. Untick to cut out everyone in the ticked layers.'),
      mirror, twin, front,
      h('Edge'),
      fSoft,
      field('Grow or shrink the cut', shiftCtl, 'Grow it to hide a halo of background; shrink it if a fringe is being clipped.'),
      field('Detail', detailSel, 'High and Maximum look at the picture at a higher resolution, which is sharper on hair and small parts and takes longer.'));
    /** The cut-out in front of every text layer, or behind all of them. */
    function setFront(inFront) {
      const i = S.layers.findIndex((l) => l.type === 'subject');
      const sub = S.layers.splice(i, 1)[0];
      const texts = S.layers.map((l, k) => (l.type === 'text' ? k : -1)).filter((k) => k >= 0);
      if (!texts.length) S.layers.splice(inFront ? S.layers.length : 0, 0, sub);
      else if (inFront) S.layers.splice(texts[texts.length - 1] + 1, 0, sub);
      else S.layers.splice(texts[0], 0, sub);
      renderStack();
    }
    const isFront = () => { const i = S.layers.findIndex((l) => l.type === 'subject'); return !S.layers.some((l, k) => l.type === 'text' && k > i); };
    function renderLayers() {
      layerList.innerHTML = '';
      if (!S.seg) return;
      for (const L of S.seg.layers) {
        const r = el('label', 'aiimg-layer');
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = S.keys.has(L.key);
        cb.addEventListener('change', () => { if (cb.checked) S.keys.add(L.key); else S.keys.delete(L.key); scheduleMask(); });
        const sw = el('span', 'aiimg-swatch'); sw.style.background = L.colour;
        const name = el('span', 'aiimg-lname', L.name);
        const area = el('span', 'aiimg-area', (L.area * 100).toFixed(L.area < 0.1 ? 1 : 0) + '%');
        r.append(cb, sw, name, area);
        layerList.appendChild(r);
      }
    }
    function syncSubject() {
      sScale.set(Math.round(S.subject.scale * 100)); sX.set(Math.round(S.subject.x * 100)); sY.set(Math.round(S.subject.y * 100));
      mirror.input.checked = !!S.subject.mirror; twin.input.checked = !!S.subject.twin; front.input.checked = isFront();
    }

    /* background */
    const bgMode = on(select('aiimg-thumb-bg', BG_MODES, S.bg.mode), () => { S.bg.mode = bgMode.value; syncBg(); editBg(); });
    const bgDark = on(range('aiimg-thumb-dark', 0, 90, 5, Math.round(S.bg.dark * 100), pct), () => { S.bg.dark = Number(bgDark.input.value) / 100; editBg(); });
    const bgBlur = on(range('aiimg-thumb-blur', 0, 40, 1, S.bg.blur, (v) => v + ' px'), () => { S.bg.blur = Number(bgBlur.input.value); editBg(); });
    const bgZoom = on(range('aiimg-thumb-zoom', 100, 125, 1, Math.round(S.bg.zoom * 100), pct), () => { S.bg.zoom = Number(bgZoom.input.value) / 100; editBg(); });
    const bgC1 = on(colour('aiimg-thumb-c1', S.bg.c1), () => { S.bg.c1 = bgC1.value; editBg(); });
    const bgC2 = on(colour('aiimg-thumb-c2', S.bg.c2), () => { S.bg.c2 = bgC2.value; editBg(); });
    const bgPattern = on(select('aiimg-thumb-pattern', PATTERNS, S.bg.pattern), () => { S.bg.pattern = bgPattern.value; editBg(); });
    const fDark = field('Darken', bgDark), fBlur = field('Blur', bgBlur), fZoom = field('Zoom', bgZoom, 'A little zoom hides the blurred edge of the frame.');
    const fC1 = field('Colour', bgC1), fC2 = field('Second colour', bgC2), fPattern = field('Pattern', bgPattern);
    const bgNoPhoto = el('p', 'field-hint', 'There is no photo yet, so the photo backgrounds show the two colours as a gradient.');
    panes.background.append(field('Background', bgMode), bgNoPhoto, fDark, fBlur, fZoom, grid(fC1, fC2), fPattern);
    function syncBg() {
      const m = S.bg.mode, photo = PHOTO_BG.has(m) && !!S.image;
      bgMode.value = m;
      bgNoPhoto.hidden = !(PHOTO_BG.has(m) && !S.image);
      fDark.hidden = !(photo); fBlur.hidden = !(photo && m === 'blur'); fZoom.hidden = !photo;
      fC1.hidden = photo; fC2.hidden = !(m === 'gradient' || m === 'pattern' || m === 'split' || !photo && PHOTO_BG.has(m)); fPattern.hidden = m !== 'pattern';
      bgDark.set(Math.round(S.bg.dark * 100)); bgBlur.set(S.bg.blur); bgZoom.set(Math.round(S.bg.zoom * 100)); bgC1.value = S.bg.c1; bgC2.value = S.bg.c2; bgPattern.value = S.bg.pattern;
    }

    /* glow */
    const glowStyle = on(select('aiimg-thumb-glow', GLOWS, S.glow.style), () => { S.glow.style = glowStyle.value; edit(); });
    const glowPalette = palette('aiimg-thumb-glowc', () => S.glow.colour, (c) => { S.glow.colour = c; edit(); });
    const glowWidth = on(range('aiimg-thumb-glomw', 2, 60, 1, S.glow.width, (v) => v + ' px'), () => { S.glow.width = Number(glowWidth.input.value); edit(); });
    const glowStrength = on(range('aiimg-thumb-glows', 0, 100, 5, Math.round(S.glow.strength * 100), pct), () => { S.glow.strength = Number(glowStrength.input.value) / 100; edit(); });
    panes.glow.append(field('Style', glowStyle, 'A hard outline reads on a busy background; a soft glow reads on a dark or blurred one.'),
      field('Colour', glowPalette), grid(field('Width', glowWidth), field('Strength', glowStrength)));
    function syncGlow() { glowStyle.value = S.glow.style; glowPalette.sync(); glowWidth.set(S.glow.width); glowStrength.set(Math.round(S.glow.strength * 100)); }

    /* text */
    const curText = () => {
      const L = layerById(S.sel); if (L && L.type === 'text') return L;
      const M = layerById(S.lastText); if (M && M.type === 'text') return M;
      return S.layers.find((l) => l.type === 'text') || null;
    };
    /** The text layer the Text pane is editing, made if there is none —
        quietly, so the control being changed keeps the value just typed. */
    const tw = () => {
      let L = curText();
      if (L) return L;
      L = newText({ text: 'NEW TEXT', size: 9, x: 0.5, y: 0.5, align: 'center' });
      S.layers.push(L); S.sel = L.id; S.lastText = L.id;
      A.ensureFont(L).then(invalidate);
      renderChips(); renderStack(); syncSticker();
      dupTextBtn.disabled = delTextBtn.disabled = false;
      return L;
    };
    const textChips = el('div', 'aiimg-textlist'); textChips.setAttribute('aria-label', 'Text layers');
    const addTextBtn = button('Add text', 'btn-ghost', () => { addText(); showPane('text'); textArea.focus(); textArea.select(); });
    const dupTextBtn = button('Duplicate', 'btn-ghost', () => { const T0 = curText(); if (T0) duplicateLayer(T0.id); });
    const delTextBtn = button('Delete', 'btn-ghost', () => { const T0 = curText(); if (T0) removeLayer(T0.id); });
    const textArea = el('textarea', 'control'); textArea.id = 'aiimg-text'; textArea.rows = 2; textArea.placeholder = 'Three to five words. A new line starts another row.';
    on(textArea, () => { tw().text = textArea.value.split('\n').slice(0, 4).join('\n'); renderChips(); renderStack(); edit(); });
    const fontSel = on(select('aiimg-font', FONTS.map((f) => [f, f]), 'Impact'), () => { const L = tw(); L.font = fontSel.value; A.ensureFont(L).then(invalidate); edit(); });
    const tSize = on(range('aiimg-size', 2, 70, 0.5, 15, (v) => v + '%'), () => { tw().size = Number(tSize.input.value); edit(); });
    const tAlign = on(select('aiimg-align', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], 'left'), () => { tw().align = tAlign.value; edit(); });
    const tX = on(range('aiimg-x', -20, 120, 1, 30, pct), () => { tw().x = Number(tX.input.value) / 100; edit(); });
    const tY = on(range('aiimg-y', -20, 120, 1, 42, pct), () => { tw().y = Number(tY.input.value) / 100; edit(); });
    const tRot = on(range('aiimg-rot', -180, 180, 1, 0, (v) => v + '°'), () => { tw().rotation = Number(tRot.input.value); edit(); });
    const tFillMode = on(select('aiimg-fillmode', [['solid', 'One colour'], ['gradient', 'Two-colour gradient']], 'solid'), () => { tw().fillMode = tFillMode.value; fFill2.hidden = tFillMode.value !== 'gradient'; edit(); });
    const tFill = on(colour('aiimg-fill', '#ffffff'), () => { tw().fill = tFill.value; edit(); });
    const tFill2 = on(colour('aiimg-fill2', '#f7c948'), () => { tw().fill2 = tFill2.value; edit(); });
    const tStrokeW = on(range('aiimg-strokew', 0, 20, 0.5, 7, (v) => v + '%'), () => { tw().strokeWidth = Number(tStrokeW.input.value); edit(); });
    const tStroke = on(colour('aiimg-stroke', '#000000'), () => { tw().stroke = tStroke.value; edit(); });
    const tShadow = on(range('aiimg-shblur', 0, 40, 1, 10, (v) => v + '%'), () => { tw().shadowBlur = Number(tShadow.input.value); edit(); });
    const tShadowY = on(range('aiimg-shy', -20, 20, 1, 3, (v) => v + '%'), () => { tw().shadowY = Number(tShadowY.input.value); edit(); });
    const tShadowC = on(colour('aiimg-shcol', '#000000'), () => { tw().shadowColor = tShadowC.value; edit(); });
    const tGlow = on(range('aiimg-tglow', 0, 60, 1, 0, (v) => v + '%'), () => { tw().glow = Number(tGlow.input.value); edit(); });
    const tOpacity = on(range('aiimg-topacity', 10, 100, 5, 100, pct), () => { tw().opacity = Number(tOpacity.input.value) / 100; edit(); });
    const tUpper = on(check('aiimg-upper', 'UPPERCASE', true), () => { tw().uppercase = tUpper.input.checked; edit(); });
    const tItalic = on(check('aiimg-italic', 'Italic', false), () => { const L = tw(); L.italic = tItalic.input.checked; A.ensureFont(L).then(invalidate); edit(); });
    const fFill2 = field('Second colour', tFill2); fFill2.hidden = true;
    const textEditor = el('div', 'aiimg-thumb-texted');
    textEditor.append(
      field('Text', textArea, 'Up to four lines. Click any text on the preview to select it, then drag it.'),
      grid(field('Font', fontSel), field('Alignment', tAlign)), grid(tUpper, tItalic),
      field('Size', tSize, 'As a share of the width. 12–18% reads at thumbnail size; it shrinks to fit the safe area.'),
      grid(field('Across', tX), field('Down', tY)), field('Rotation', tRot),
      h('Fill'), field('Fill', tFillMode), grid(field('Colour', tFill), fFill2), field('Opacity', tOpacity),
      h('Outline, shadow and glow'), grid(field('Outline width', tStrokeW), field('Outline colour', tStroke)),
      grid(field('Shadow blur', tShadow), field('Shadow down', tShadowY)), grid(field('Shadow colour', tShadowC), field('Glow', tGlow)));
    panes.text.append(textChips, row(addTextBtn, dupTextBtn, delTextBtn), textEditor);
    function renderChips() {
      textChips.innerHTML = '';
      const T0 = curText();
      for (const L of S.layers) {
        if (L.type !== 'text') continue;
        const b = button((L.text || '(empty)').replace(/\n/g, ' ').slice(0, 28), 'chip', () => { selectLayer(L.id); });
        b.classList.toggle('is-on', T0 === L);
        b.setAttribute('aria-pressed', T0 === L ? 'true' : 'false');
        textChips.appendChild(b);
      }
    }
    function syncText() {
      renderChips();
      const L = curText();
      dupTextBtn.disabled = delTextBtn.disabled = !L;
      const D = L || newText();
      textArea.value = L ? D.text : '';
      fontSel.value = D.font; tAlign.value = D.align; tUpper.input.checked = !!D.uppercase; tItalic.input.checked = !!D.italic;
      tSize.set(D.size); tX.set(Math.round(D.x * 100)); tY.set(Math.round(D.y * 100)); tRot.set(Math.round(Number(D.rotation) || 0));
      tFillMode.value = D.fillMode; fFill2.hidden = D.fillMode !== 'gradient'; tFill.value = D.fill; tFill2.value = D.fill2;
      tStrokeW.set(D.strokeWidth); tStroke.value = D.stroke; tShadow.set(D.shadowBlur); tShadowY.set(D.shadowY); tShadowC.value = D.shadowColor || '#000000';
      tGlow.set(Number(D.glow) || 0); tOpacity.set(Math.round(opac(D) * 100));
    }

    /* stickers: emoji and shapes */
    const curSticker = () => { const L = layerById(S.sel); return L && (L.type === 'emoji' || L.type === 'shape') ? L : null; };
    let pickMode = 'add';
    const emojiBtn = button('Choose an emoji…', 'btn-primary', () => openPicker('add'));
    emojiBtn.setAttribute('aria-expanded', 'false');
    const notoRow = el('div', 'aiimg-thumb-busy'); notoRow.hidden = true;
    const notoText = el('span', null, ''); const notoBar = el('div', 'aiimg-progress'); const notoFill = el('i'); notoBar.appendChild(notoFill);
    const notoCancel = button('Cancel', 'btn-ghost', () => cancelNoto());
    notoRow.append(notoText, notoBar, notoCancel);
    const picker = el('div', 'aiimg-thumb-picker'); picker.hidden = true;
    const pickSearch = el('input', 'control'); pickSearch.type = 'search'; pickSearch.id = 'aiimg-thumb-esearch';
    pickSearch.placeholder = 'Search: fire, laugh, money, arrow…'; pickSearch.setAttribute('aria-label', 'Search the emoji');
    const pickRecent = el('div', 'aiimg-thumb-emoji-grid aiimg-thumb-recent');
    const pickGrid = el('div', 'aiimg-thumb-emoji-grid');
    const pickClose = button('Close the emoji list', 'btn-ghost', () => closePicker());
    picker.append(pickSearch, pickRecent, pickGrid, row(pickClose));
    let recentKeys = Array.isArray(settings.recent) ? settings.recent.filter((k) => typeof k === 'string').slice(0, 16) : [];
    const shapeGrid = el('div', 'aiimg-thumb-shapes');
    for (const [kind, label] of SHAPES) {
      const b = button('', 'aiimg-thumb-shape', () => addShape(kind));
      b.dataset.shape = kind;
      const c = el('canvas'); c.width = 72; c.height = 44; c.setAttribute('aria-hidden', 'true');
      const cx = c.getContext('2d');
      const demo = newShape({ kind, x: 0.5, y: 0.5, colour: '#f7c948', colour2: '#111111', size: kind === 'bar' ? 0.75 : kind === 'badge' ? 1.05 : kind === 'disc' ? 0.95 : kind === 'burst' ? 0.75 : kind === 'star' ? 0.8 : 0.85, width: kind === 'star' ? 4 : 40, span: 0.9 });
      drawShape(cx, demo, 72, 44);
      b.append(c, el('span', null, label));
      b.setAttribute('aria-label', 'Add a shape: ' + label);
      shapeGrid.appendChild(b);
    }
    /* the selected sticker */
    const stEd = el('div', 'aiimg-thumb-sted');
    const stHead = el('p', 'aiimg-thumb-note', '');
    const acKind = on(select('aiimg-thumb-accent', SHAPES, 'arrow'), () => {
      const L = curSticker();
      if (L && L.type === 'shape') { L.kind = acKind.value; if (TEXT_SHAPES.has(L.kind) && !L.text) L.text = SHAPE_TEXT[L.kind]; syncSticker(); renderStack(); edit(); }
      else addShape(acKind.value);
    });
    const fKind = field('Shape', acKind, 'An arrow at the thing the video is about, a circle around it, or a badge that says what it is.');
    const swapEmoji = button('Change this emoji…', 'btn-ghost', () => openPicker('replace'));
    const acText = el('input', 'control'); acText.type = 'text'; acText.id = 'aiimg-thumb-atext'; acText.maxLength = 40;
    on(acText, () => { const L = curSticker(); if (L && L.type === 'shape') { L.text = acText.value; renderStack(); edit(); } });
    const fText = field('Badge text', acText);
    const acPalette = palette('aiimg-thumb-acc', () => { const L = curSticker(); return L && L.type === 'shape' ? L.colour : '#ff3b3b'; }, (c) => { const L = curSticker(); if (L && L.type === 'shape') { L.colour = c; edit(); } });
    const fColour = field('Colour', acPalette);
    const acInk = on(colour('aiimg-thumb-aink', '#ffffff'), () => { const L = curSticker(); if (L && L.type === 'shape') { L.colour2 = acInk.value; edit(); } });
    const fInk = field('Text colour', acInk);
    const acX = on(range('aiimg-thumb-ax', 0, 100, 1, 50, pct), () => { const L = curSticker(); if (L) { L.x = Number(acX.input.value) / 100; edit(); } });
    const acY = on(range('aiimg-thumb-ay', 0, 100, 1, 50, pct), () => { const L = curSticker(); if (L) { L.y = Number(acY.input.value) / 100; edit(); } });
    const acSize = on(range('aiimg-thumb-asize', 3, 120, 1, 30, pct), () => { const L = curSticker(); if (L) { L.size = Number(acSize.input.value) / 100; edit(); } });
    const acRot = on(range('aiimg-thumb-arot', -180, 180, 5, 0, (v) => v + '°'), () => { const L = curSticker(); if (L) { L.rotation = Number(acRot.input.value); edit(); } });
    const acWidth = on(range('aiimg-thumb-awidth', 3, 30, 1, 9, (v) => v + ' px'), () => { const L = curSticker(); if (L && L.type === 'shape') { L.width = Number(acWidth.input.value); edit(); } });
    const fWidth = field('Line width', acWidth);
    const acOpacity = on(range('aiimg-thumb-aopacity', 10, 100, 5, 100, pct), () => { const L = curSticker(); if (L) { L.opacity = Number(acOpacity.input.value) / 100; edit(); } });
    const acOutline = on(range('aiimg-thumb-aoutline', 0, 12, 1, 0, (v) => v + '%'), () => { const L = curSticker(); if (L && L.type === 'emoji') { L.outline = Number(acOutline.input.value); edit(); } });
    const acOutlineC = on(colour('aiimg-thumb-aoutc', '#ffffff'), () => { const L = curSticker(); if (L && L.type === 'emoji') { L.outlineColour = acOutlineC.value; edit(); } });
    const fOutline = grid(field('Sticker edge', acOutline), field('Edge colour', acOutlineC));
    const acShadow = on(check('aiimg-thumb-ashadow', 'Drop shadow', true), () => { const L = curSticker(); if (L && L.type === 'emoji') { L.shadow = acShadow.input.checked; edit(); } });
    const acFlip = on(check('aiimg-thumb-aflip', 'Flip left to right', false), () => { const L = curSticker(); if (L) { L.flip = acFlip.input.checked; edit(); } });
    const stButtons = row(button('Duplicate', 'btn-ghost', () => { const L = curSticker(); if (L) duplicateLayer(L.id); }),
      button('Delete', 'btn-ghost', () => { const L = curSticker(); if (L) removeLayer(L.id); }));
    stEd.append(stHead, fKind, swapEmoji, fText, fColour, fInk, grid(field('Across', acX), field('Down', acY)), grid(field('Size', acSize), field('Rotation', acRot)),
      fWidth, field('Opacity', acOpacity), fOutline, acShadow, acFlip, stButtons);
    const stNone = el('p', 'field-hint', 'Select a sticker on the preview, or add one above, to change it here.');
    panes.accent.append(h('Emoji'), row(emojiBtn), notoRow, picker,
      el('p', 'field-hint', 'Noto Emoji artwork, drawn the same on every device. The set (about 1 MB) loads from this site the first time you open it.'),
      h('Shapes, arrows and badges'), shapeGrid, h('Selected sticker'), stNone, stEd);
    function syncSticker() {
      const L = curSticker();
      stNone.hidden = !!L; stEd.hidden = !L;
      if (!L) return;
      const isShape = L.type === 'shape', hasText = isShape && TEXT_SHAPES.has(L.kind);
      stHead.textContent = isShape ? SHAPE_NAME[L.kind] || 'Shape' : 'Emoji: ' + (emojiChar(L.key) ? emojiChar(L.key) + ' ' : '') + emojiName(L.key);
      fKind.hidden = !isShape; swapEmoji.hidden = isShape; fText.hidden = !hasText; fColour.hidden = !isShape; fInk.hidden = !hasText;
      fWidth.hidden = !(isShape && LINE_SHAPES.has(L.kind)); fOutline.hidden = isShape; acShadow.hidden = isShape;
      acFlip.hidden = hasText;
      if (isShape) { acKind.value = L.kind; acText.value = L.text || ''; acPalette.sync(); acInk.value = L.colour2 || '#ffffff'; acWidth.set(L.width); }
      else { acOutline.set(Number(L.outline) || 0); acOutlineC.value = L.outlineColour || '#ffffff'; acShadow.input.checked = L.shadow !== false; }
      acX.set(Math.round(L.x * 100)); acY.set(Math.round(L.y * 100)); acSize.set(Math.round(L.size * 100)); acRot.set(Math.round(Number(L.rotation) || 0));
      acOpacity.set(Math.round(opac(L) * 100)); acFlip.input.checked = !!L.flip;
    }
    function showNotoProgress(got, total) {
      notoRow.hidden = false;
      notoText.textContent = 'Loading the emoji set — ' + fmtBytes(got) + (total ? ' of ' + fmtBytes(total) : '') + '…';
      notoFill.style.width = total ? Math.round(got / total * 100) + '%' : '30%';
    }
    async function ensureNoto() {
      if (noto) return noto;
      showNotoProgress(0, 0);
      note('Loading the emoji set…');
      try { return await loadNoto(showNotoProgress); }
      catch (e) {
        if (e && e.name === 'AbortError') say('Loading the emoji set was cancelled. Open the emoji list to try again.', 'note');
        else say('The emoji set could not be loaded: ' + errText(e), 'error');
        throw e;
      } finally { notoRow.hidden = true; note(''); }
    }
    let pickerBuilt = false;
    async function openPicker(mode) {
      pickMode = mode;
      try { await ensureNoto(); } catch (e) { return; }
      if (!pickerBuilt) buildPicker();
      renderRecent();
      picker.hidden = false;
      emojiBtn.setAttribute('aria-expanded', 'true');
      pickSearch.focus();
    }
    function closePicker() { picker.hidden = true; emojiBtn.setAttribute('aria-expanded', 'false'); emojiBtn.focus(); }
    const emojiButton = (key) => {
      const ic = noto.icons[key];
      const b = button('', 'aiimg-thumb-emo', () => chooseEmoji(key));
      b.dataset.key = key; b.dataset.name = ic.name; b.title = ic.name; b.setAttribute('aria-label', ic.name);
      const img = el('img'); img.alt = ''; img.width = 28; img.height = 28; img.loading = 'lazy'; img.decoding = 'async';
      img.src = svgUrl(ic.body, noto.width, noto.height);
      b.appendChild(img);
      return b;
    };
    function buildPicker() {
      pickerBuilt = true;
      pickGrid.innerHTML = '';
      let group = null;
      for (const key of Object.keys(noto.icons)) {
        const ic = noto.icons[key];
        if (ic.group !== group) { group = ic.group; const hd = el('p', 'aiimg-thumb-egroup', GROUP_NAMES[group] || group); hd.dataset.group = group; pickGrid.appendChild(hd); }
        const b = emojiButton(key); b.dataset.group = group;
        pickGrid.appendChild(b);
      }
    }
    function renderRecent() {
      pickRecent.innerHTML = '';
      const keys = recentKeys.filter((k) => noto && noto.icons[k]);
      pickRecent.hidden = !keys.length;
      if (!keys.length) return;
      const hd = el('p', 'aiimg-thumb-egroup', 'Recent'); pickRecent.appendChild(hd);
      for (const k of keys) pickRecent.appendChild(emojiButton(k));
    }
    pickSearch.addEventListener('input', () => {
      const q = pickSearch.value.trim().toLowerCase();
      const seen = new Set();
      for (const n of pickGrid.children) {
        if (n.dataset.key) { const hit = !q || n.dataset.name.includes(q); n.hidden = !hit; if (hit) seen.add(n.dataset.group); }
      }
      for (const n of pickGrid.children) if (!n.dataset.key) n.hidden = !seen.has(n.dataset.group);
      pickRecent.hidden = !!q || !pickRecent.children.length;
    });
    picker.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closePicker(); } });
    function chooseEmoji(key) {
      const L = curSticker();
      if (pickMode === 'replace' && L && L.type === 'emoji') { L.key = key; syncSticker(); renderStack(); edit(); }
      else addEmoji(key);
      recentKeys = [key].concat(recentKeys.filter((k) => k !== key)).slice(0, 16);
      saveSettings();
      pickMode = 'add';
      renderRecent();
    }

    /* layers */
    const stack = el('div', 'aiimg-thumb-stack'); stack.setAttribute('role', 'list');
    panes.stack.append(
      row(button('Add text', 'btn-ghost', () => { addText(); }), button('Add emoji', 'btn-ghost', () => { showPane('accent'); openPicker('add'); }),
        button('Add arrow', 'btn-ghost', () => addShape('arrow'))),
      el('p', 'field-hint', 'Top of the list is drawn on top. Select a layer here or on the preview; the arrows move it up or down.'),
      stack);
    function layerLabel(L) {
      if (L.type === 'subject') return 'Cut-out' + (S.cut ? '' : S.image ? ' (nothing cut out)' : ' (no photo yet)');
      if (L.type === 'text') return 'Text: ' + (String(L.text || '').replace(/\n/g, ' ').slice(0, 30) || '(empty)');
      if (L.type === 'emoji') return 'Emoji: ' + (emojiChar(L.key) ? emojiChar(L.key) + ' ' : '') + emojiName(L.key);
      return (SHAPE_NAME[L.kind] || 'Shape') + (TEXT_SHAPES.has(L.kind) && L.text ? ': ' + L.text : '');
    }
    function renderStack() {
      stack.innerHTML = '';
      for (let i = S.layers.length - 1; i >= 0; i--) {
        const L = S.layers[i];
        const r = el('div', 'aiimg-thumb-stackrow'); r.setAttribute('role', 'listitem'); r.dataset.id = L.id;
        r.classList.toggle('is-sel', L.id === S.sel); r.classList.toggle('is-hidden', !!L.hidden);
        const name = button(layerLabel(L), 'aiimg-thumb-stackname', () => { selectLayer(L.id); canvas.focus({ preventScroll: true }); });
        name.setAttribute('aria-pressed', L.id === S.sel ? 'true' : 'false');
        const up = iconBtn('up', 'Move up: ' + layerLabel(L), () => moveLayer(L.id, 1)); up.disabled = i === S.layers.length - 1;
        const down = iconBtn('down', 'Move down: ' + layerLabel(L), () => moveLayer(L.id, -1)); down.disabled = i === 0;
        const vis = iconBtn(L.hidden ? 'hide' : 'eye', (L.hidden ? 'Show: ' : 'Hide: ') + layerLabel(L), () => { L.hidden = !L.hidden; renderStack(); edit(); });
        r.append(name, up, down, vis);
        if (L.type !== 'subject') {
          r.append(iconBtn('copy', 'Duplicate: ' + layerLabel(L), () => duplicateLayer(L.id)), iconBtn('del', 'Delete: ' + layerLabel(L), () => removeLayer(L.id)));
        }
        stack.appendChild(r);
      }
    }

    /* projects */
    const projName = el('input', 'control'); projName.type = 'text'; projName.id = 'aiimg-thumb-pname'; projName.maxLength = 80; projName.placeholder = 'My thumbnail';
    const projSave = button('Save project', 'btn-primary', () => saveProject());
    const projStatus = el('p', 'aiimg-thumb-note', ''); projStatus.setAttribute('role', 'status');
    const projList = el('div', 'aiimg-thumb-projects');
    panes.projects.append(
      h('Save this design'), field('Project name', projName), row(projSave),
      el('p', 'field-hint', 'Projects are kept in this browser, never uploaded: the layout, the words, the stickers and the photo itself. They stay on this device until you delete them here or clear this site’s data.'),
      projStatus, h('Saved in this browser'), projList);
    const projMsg = (t, kind) => { projStatus.textContent = t || ''; projStatus.className = 'aiimg-thumb-note' + (kind ? ' is-' + kind : ''); };
    const projUrls = [];
    async function refreshProjects() {
      let recs;
      try { recs = await listIfAny(); }
      catch (e) { projMsg('Saved projects could not be read: ' + errText(e), 'error'); return []; }
      for (const u of projUrls.splice(0)) URL.revokeObjectURL(u);
      projList.innerHTML = '';
      recs.sort((a, b) => (b.saved || 0) - (a.saved || 0));
      if (!recs.length) projList.appendChild(el('p', 'field-hint', 'Nothing saved yet.'));
      for (const rec of recs) {
        const r = el('div', 'aiimg-thumb-proj'); r.dataset.name = rec.name;
        if (rec.thumb instanceof Blob) { const img = el('img'); img.alt = ''; const u = URL.createObjectURL(rec.thumb); projUrls.push(u); img.src = u; r.appendChild(img); }
        const meta = el('div', 'aiimg-thumb-projmeta');
        const size = (rec.photo && rec.photo.size ? rec.photo.size : 0) + (rec.thumb && rec.thumb.size ? rec.thumb.size : 0);
        meta.append(el('strong', null, rec.name), el('span', null, new Date(rec.saved || 0).toLocaleString() + ' · ' + (SIZES[rec.doc && rec.doc.fmt] || SIZES.yt).note.split(' — ')[0] + (size ? ' · ' + fmtBytes(size) : '') + (rec.photo ? '' : ' · no photo')));
        const load = button('Open', 'btn-ghost', () => loadProject(rec.name));
        load.setAttribute('aria-label', 'Open project ' + rec.name);
        const del = button('Delete', 'btn-ghost', () => {
          if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = 'Delete — sure?'; setTimeout(() => { del.dataset.armed = ''; del.textContent = 'Delete'; }, 4000); return; }
          removeProject(rec.name);
        });
        del.setAttribute('aria-label', 'Delete project ' + rec.name);
        r.append(meta, load, del);
        projList.appendChild(r);
      }
      return recs;
    }
    onPane.projects = () => { refreshProjects(); };
    async function saveProject() {
      if (!S.started) return null;
      const name = (projName.value.trim() || (S.image ? S.image.name : 'Untitled design')).slice(0, 80);
      projSave.disabled = true;
      projMsg('Saving “' + name + '”…');
      try {
        if (commitTimer) commitNow();
        const doc = docOf();
        let thumb = null;
        try {
          await readyEmoji(S.layers).catch(() => {});
          S.exporting = true;
          const f = frame(), tw0 = f.w >= f.h ? 320 : 180;
          thumb = await A.exportStill(renderFrame, { width: tw0, height: Math.round(tw0 * f.h / f.w), format: 'image/jpeg', quality: 0.8 });
        } finally { S.exporting = false; invalidate(); }
        const rec = {
          name, saved: Date.now(), v: 1, doc,
          photo: S.photoBlob || null, photoName: S.photoBlob ? S.photoBlob.name || 'photo' : null,
          cut: { keys: Array.from(S.keys), softness: S.softness, shift: S.shift, detail: S.detail, mainOnly: S.mainOnly },
          thumb
        };
        await putProject(rec);
        projName.value = name;
        projMsg('Saved “' + name + '” in this browser.', 'ok');
        await refreshProjects();
        return rec;
      } catch (e) {
        projMsg('The project could not be saved: ' + errText(e) + (e && e.name === 'QuotaExceededError' ? ' — this browser is out of room for site data.' : ''), 'error');
        return null;
      } finally { projSave.disabled = false; }
    }
    async function loadProject(name) {
      let rec;
      try { rec = await getProject(name); }
      catch (e) { projMsg('The project could not be read: ' + errText(e), 'error'); return false; }
      if (!rec || !rec.doc) { projMsg('“' + name + '” is not in this browser any more.', 'error'); refreshProjects(); return false; }
      projMsg('Opening “' + name + '”…');
      const c = rec.cut || {};
      if (rec.photo instanceof Blob) {
        S.softness = Number.isFinite(c.softness) ? c.softness : 3; S.shift = Number.isFinite(c.shift) ? c.shift : 0;
        S.detail = A.DETAIL[c.detail] ? c.detail : 'standard'; S.mainOnly = c.mainOnly !== false;
        soft.set(S.softness); shiftCtl.set(S.shift); detailSel.value = S.detail; mainOnly.input.checked = S.mainOnly;
        const f = new File([rec.photo], rec.photoName || 'photo', { type: rec.photo.type || 'image/jpeg' });
        const ok = await loadFiles([f], { keys: Array.isArray(c.keys) ? c.keys : null, keepPane: true });
        if (!ok) { projMsg('The photo in “' + name + '” could not be read.', 'error'); return false; }
      } else { clearPhoto(); if (!S.started) openStudio(); }
      restore(rec.doc);
      commitNow();
      projName.value = rec.name;
      projMsg('Opened “' + name + '”.', 'ok');
      return true;
    }
    async function removeProject(name) {
      try { await deleteProject(name); projMsg('Deleted “' + name + '”.', 'ok'); }
      catch (e) { projMsg('The project could not be deleted: ' + errText(e), 'error'); }
      await refreshProjects();
    }

    /* export */
    const outSize = select('aiimg-thumb-outsize', [['1280', '1280 × 720 (YouTube)'], ['1920', '1920 × 1080']], settings.out === '1920' ? '1920' : '1280');
    on(outSize, () => saveSettings());
    const pngBtn = button('Download PNG', 'btn-primary', () => exportOne('image/png'));
    const jpgBtn = button('Download JPEG under 2 MB', 'btn-ghost', () => exportOne('image/jpeg'));
    const variantsBtn = button('Export 3 variants (A, B, C)', 'btn-primary', exportVariants);
    const cancelBtn = button('Cancel', 'btn-ghost', () => { cancelVariants = true; }); cancelBtn.hidden = true;
    const cutBtn = button('Download the cut-out as a transparent PNG', 'btn-ghost', exportCutout);
    const results = el('div', 'aiimg-results');
    const exportStatus = el('p', 'aiimg-status', ''); exportStatus.hidden = true;
    const fOut = field('Size', outSize);
    const variantHint = el('p', 'field-hint', '');
    panes.export.append(
      h('This design'), fOut,
      row(pngBtn, jpgBtn),
      h('A/B test'),
      variantHint,
      (() => { const r = el('div', 'aiimg-row aiimg-thumb-variants'); r.append(variantsBtn, cancelBtn); return r; })(),
      h('Pieces'),
      row(cutBtn),
      exportStatus, results
    );
    function syncExport() {
      const f = frame();
      fOut.hidden = S.fmt !== 'yt';
      variantHint.textContent = 'A is what you see. B mirrors the layout and swaps the accent colour and the background. C moves the main text to the top over a solid or patterned background with a third colour. Three ' + f.w + '×' + f.h + ' PNGs, named -a, -b and -c.';
    }

    const baseName = () => (S.image ? S.image.name : 'design') + '-thumbnail' + (S.fmt === 'yt' ? '' : '-' + frame().w + 'x' + frame().h);
    function dims() {
      const f = frame();
      if (S.fmt !== 'yt') return { width: f.w, height: f.h };
      const W = Number(outSize.value) || W0; return { width: W, height: Math.round(W * H0 / W0) };
    }
    function addResult(blob, name, label, d) {
      const r = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      const strong = el('strong', null, name);
      const meta = el('span', null, fmtBytes(blob.size) + ' · ' + d + (label ? ' · ' + label : ''));
      const dl = button('Download', 'btn-download', () => A.download(blob, name));
      head.append(strong, meta, dl);
      r.appendChild(head);
      const img = el('img'); img.alt = 'Result preview'; img.src = URL.createObjectURL(blob); r.appendChild(img);
      results.insertBefore(r, results.firstChild);
      return r;
    }
    async function prepareExport() {
      for (const L of S.layers) if (L.type === 'text') await A.ensureFont(L);
      try { await readyEmoji(S.layers); }
      catch (e) { throw new Error('The emoji could not be loaded, so the export would miss them: ' + errText(e)); }
    }
    async function exportOne(fmt) {
      if (!S.started || S.exporting) return;
      try {
        await prepareExport();
        S.exporting = true;
        const { width, height } = dims();
        let blob, q = 0.92;
        if (fmt === 'image/png') blob = await A.exportStill(renderFrame, { width, height, format: fmt });
        else {
          for (;;) {
            blob = await A.exportStill(renderFrame, { width, height, format: fmt, quality: q });
            if (!blob || blob.size <= YT_LIMIT || q <= 0.4) break;
            q = Math.round((q - 0.07) * 100) / 100;
          }
        }
        if (!blob) throw new Error('This browser could not encode that format. Try PNG.');
        const name = baseName() + '.' + extOf(blob);
        const isPng = blob.type === 'image/png';
        addResult(blob, name, isPng ? 'PNG' : blob.type === 'image/jpeg' ? 'JPEG, quality ' + Math.round(q * 100) + '%' + (blob.size <= YT_LIMIT ? ' · under 2 MB' : ' · still over 2 MB') : blob.type, width + '×' + height);
        A.download(blob, name);
        say('');
      } catch (e) { say(errText(e), 'error'); }
      finally { S.exporting = false; invalidate(); }
    }
    function variantOf(v) {
      const f = frame();
      const V = { fmt: S.fmt, bg: clone(S.bg), subject: clone(S.subject), glow: clone(S.glow), layers: clone(S.layers) };
      if (v === 'b') {
        V.glow.colour = nextColour(S.glow.colour, 1);
        V.bg.mode = S.image ? (S.bg.mode === 'gradient' ? 'blur' : 'gradient') : (S.bg.mode === 'gradient' ? 'pattern' : 'gradient');
        for (const L of V.layers) {
          if (L.type === 'subject') continue;
          L.x = 1 - L.x;
          L.rotation = -(Number(L.rotation) || 0);
          if (L.type === 'text') { L.align = L.align === 'left' ? 'right' : L.align === 'right' ? 'left' : 'center'; L.fill2 = V.glow.colour; }
          else if (L.type === 'shape') { if (!TEXT_SHAPES.has(L.kind)) L.flip = !L.flip; L.colour = V.glow.colour; }
        }
        V.subject.x = 1 - S.subject.x; V.subject.mirror = !S.subject.mirror;
      } else if (v === 'c') {
        V.glow.colour = nextColour(S.glow.colour, 2);
        V.bg.mode = S.bg.mode === 'solid' ? 'pattern' : 'solid'; V.bg.c1 = '#0b0f1e'; V.bg.c2 = V.glow.colour;
        for (const L of V.layers) if (L.type === 'shape') L.colour = V.glow.colour;
        const M = mainText(V.layers);
        if (M) {
          M.x = 0.5; M.align = 'center'; M.fillMode = 'gradient'; M.fill2 = V.glow.colour; M.rotation = 0;
          M.y = Math.max(0.2, A.layout(pctx, M, f.w).blockH / 2 / f.h + 0.05);
        }
        /* the cut-out in front of the words */
        const i = V.layers.findIndex((l) => l.type === 'subject');
        const sub = V.layers.splice(i, 1)[0];
        let last = -1; V.layers.forEach((l, k) => { if (l.type === 'text') last = k; });
        V.layers.splice(last + 1, 0, sub);
        V.glow.style = S.glow.style === 'soft' ? 'hard' : 'both';
      }
      return V;
    }
    let cancelVariants = false;
    async function exportVariants() {
      if (!S.started || S.exporting) return;
      const f = frame();
      try {
        await prepareExport();
        S.exporting = true; cancelVariants = false;
        cancelBtn.hidden = false; variantsBtn.disabled = true;
        exportStatus.hidden = false;
        for (const v of ['a', 'b', 'c']) {
          if (cancelVariants) { exportStatus.textContent = 'Cancelled. The variants already made are below.'; return; }
          exportStatus.textContent = 'Rendering variant ' + v.toUpperCase() + '…';
          S.variant = v === 'a' ? null : variantOf(v);
          const blob = await A.exportStill(renderFrame, { width: f.w, height: f.h, format: 'image/png' });
          S.variant = null;
          if (!blob) throw new Error('This browser could not encode a PNG.');
          const name = baseName() + '-' + v + '.' + extOf(blob);
          addResult(blob, name, 'variant ' + v.toUpperCase(), f.w + '×' + f.h);
          A.download(blob, name);
          await sleep(300);
        }
        exportStatus.textContent = 'Three variants exported.';
        say('');
      } catch (e) { S.variant = null; exportStatus.hidden = false; exportStatus.textContent = 'The export failed.'; say(errText(e), 'error'); }
      finally { S.exporting = false; S.variant = null; cancelBtn.hidden = true; variantsBtn.disabled = false; invalidate(); }
    }
    async function exportCutout() {
      if (!S.cut) { say('Nothing is cut out yet. Add a photo and tick a layer in Subject first.', 'warn'); return; }
      const blob = await new Promise((r) => S.cut.canvas.toBlob(r, 'image/png'));
      if (!blob) { say('This browser could not encode a PNG.', 'error'); return; }
      const name = (S.image.name || 'image') + '-cutout.' + extOf(blob);
      addResult(blob, name, 'transparent PNG', S.cut.w + '×' + S.cut.h);
      A.download(blob, name);
    }

    /* ---------------- size ---------------- */
    function applyFormat() {
      const f = frame();
      if (canvas.width !== f.w || canvas.height !== f.h) { canvas.width = f.w; canvas.height = f.h; }
      canvas.style.setProperty('--thumb-ar', f.w + ' / ' + f.h);
      canvas.style.setProperty('--thumb-arn', (f.w / f.h).toFixed(4));
      canvas.classList.toggle('is-tall', f.h > f.w);
      canvas.setAttribute('aria-label', 'Thumbnail preview at ' + f.w + ' by ' + f.h + '. Click a layer to select it, drag it to move it; with the preview focused, arrow keys nudge the selected layer.');
      fmtSel.value = S.fmt;
      sizeNote.textContent = f.note;
      S.scratch = {};
      computeCrop();
      S.subject.baseH = baseHOf(f.w, f.h);
      rebg();
      syncExport();
      schedulePreviews();
    }
    on(fmtSel, () => {
      if (fmtSel.value === S.fmt || !SIZES[fmtSel.value]) return;
      S.fmt = fmtSel.value;
      relayout();
      applyFormat();
      syncAll();
      commitNow();
      saveSettings();
    });

    /* ---------------- keeping the controls in step ---------------- */
    function syncPositions() {
      const L = layerById(S.sel);
      if (!L) return;
      if (L.type === 'subject') { sX.set(Math.round(S.subject.x * 100)); sY.set(Math.round(S.subject.y * 100)); sScale.set(Math.round(S.subject.scale * 100)); }
      else if (L.type === 'text') { tX.set(Math.round(L.x * 100)); tY.set(Math.round(L.y * 100)); tSize.set(Math.round(L.size * 2) / 2); }
      else { acX.set(Math.round(L.x * 100)); acY.set(Math.round(L.y * 100)); acSize.set(Math.round(L.size * 100)); }
    }
    function syncSelection() { syncText(); syncSticker(); renderStack(); }
    function syncAll() {
      syncBg(); syncGlow(); syncSubject(); syncText(); syncSticker(); renderStack(); syncExport(); syncUndo();
      change.textContent = S.image ? 'Change photo' : 'Add a photo';
      schedulePreviews();
    }

    /* ---------------- segmentation and loading ---------------- */
    let segToken = 0;
    async function runSegmentation(keys) {
      if (!S.image) return;
      const token = ++segToken;
      progress.hidden = false; segCancel.hidden = false; bar.style.width = '0%';
      status.textContent = 'Preparing the AI model…';
      note('Finding the subject…');
      try {
        const seg = await A.segment(S.image, { detail: S.detail, onProgress: (p) => {
          if (token !== segToken) return;
          if (p.stage === 'download') {
            status.textContent = 'Downloading the model once' + (p.total ? ' — ' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) : '') + '. Your browser keeps it for next time.';
            bar.style.width = Math.round(p.fraction * 60) + '%';
          } else if (p.stage === 'run') {
            status.textContent = 'Finding the layers on your device…';
            bar.style.width = Math.round(60 + p.fraction * 40) + '%';
          }
        } });
        if (token !== segToken) return;
        S.seg = seg; S.guide = null; S.tint = null; S.alpha = null; S.cut = null;
        const people = seg.layers.filter((l) => l.label === 'person');
        const subjects = seg.layers.filter((l) => l.subject);
        const other = seg.layers.filter((l) => !BACKDROP.has(l.label));
        const known = Array.isArray(keys) ? seg.layers.filter((l) => keys.includes(l.key)) : [];
        const pick = known.length ? known : people.length ? people : subjects.length ? [subjects[0]] : other.length ? [other[0]] : [seg.layers[0]];
        S.keys = new Set(pick.map((l) => l.key));
        renderLayers();
        if (!known.length && !people.length) say('No people were found, so the ' + pick[0].name.toLowerCase() + ' layer is the cut-out. Tick any layer to change that.', 'note');
        else say('');
        await rebuildMask();
      } catch (e) {
        if (token !== segToken) return;
        status.textContent = 'The layers could not be found.';
        say(errText(e), 'error');
      } finally {
        if (token === segToken) { progress.hidden = true; segCancel.hidden = true; note(''); }
      }
    }
    function openStudio() {
      S.started = true;
      studio.hidden = false; drop.hidden = true; blank.hidden = true;
      applyFormat();
      syncAll();
      if (!hist.stack.length) commitNow();
      invalidate();
    }
    function clearPhoto() {
      segToken++;
      S.image = null; S.photoBlob = null; S.seg = null; S.guide = null; S.alpha = null; S.cut = null; S.keys = new Set(); S.tint = null; S.crop = null;
      layerList.innerHTML = '';
      status.textContent = 'No photo yet. Add one to cut out a subject; the templates, text and stickers work without it.';
      progress.hidden = true;
      rebg(); syncAll();
    }
    function startBlank() {
      if (!S.started) {
        if (!S.image) {
          S.bg.mode = 'gradient';
          status.textContent = 'No photo yet. Add one to cut out a subject; the templates, text and stickers work without it.';
        }
        openStudio();
      }
      showPane('templates');
    }
    async function loadFiles(files, opts) {
      const f = files && files[0]; if (!f) return false;
      opts = opts || {};
      try {
        say(''); note('Reading the photo…'); status.textContent = 'Reading the photo…';
        const img = await A.loadImageFile(f);
        segToken++;
        S.image = img; S.photoBlob = f; S.seg = null; S.guide = null; S.alpha = null; S.cut = null; S.keys = new Set(); S.tint = null; S.bgCache = {}; S.variant = null;
        computeCrop();
        layerList.innerHTML = '';
        results.innerHTML = '';
        for (const L of S.layers) if (L.type === 'text') await A.ensureFont(L);
        openStudio();
        if (!opts.keepPane) showPane('layers');
        const job = runSegmentation(opts.keys);
        if (opts.keys) await job;
        return true;
      } catch (e) {
        note('');
        say(f.name ? f.name + ': ' + errText(e) : errText(e), 'error');
        return false;
      }
    }
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    wrap.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
    file.addEventListener('change', () => { if (file.files.length) loadFiles(file.files); file.value = ''; });

    /* ---------------- go ---------------- */
    applyFormat();
    syncAll();
    showPane('layers');
    /* saved projects live in this browser; offer them before a photo is
       chosen — asking first whether the database exists, so a first visit
       does not create an empty one */
    listIfAny().then((recs) => {
      if (!mounted || !recs.length) return;
      openSaved.hidden = false;
      openSaved.textContent = 'Open a saved project (' + recs.length + ')';
    }, (e) => { blankNote.hidden = false; blankNote.className = 'aiimg-thumb-note is-error'; blankNote.textContent = 'Saved projects could not be read in this browser: ' + errText(e); });
    const api = {
      state: S, renderFrame, loadFiles, variantOf, results, panes, templates: TEMPLATES.map((t) => t.id), sizes: Object.keys(SIZES), safe: SAFE,
      docOf, docJSON, restore, undo, redo, commit: commitNow, history: () => ({ length: hist.stack.length, index: hist.i, max: HISTORY_MAX }),
      applyTemplate, addText, addEmoji, addShape, removeLayer, duplicateLayer, moveLayer, selectLayer, boxOf: (id) => boxOf(layerById(id), canvas.width, canvas.height),
      fitted: (id) => fitted(pctx, layerById(id), canvas.width, canvas.height, S.fmt), ensureNoto, openPicker, startBlank,
      saveProject, loadProject, listProjects, deleteProject: removeProject, refreshProjects, settingsKey: SETTINGS_KEY,
      destroy: () => { mounted = false; document.removeEventListener('keydown', onDocKey); clearTimeout(commitTimer); }
    };
    root.aiimgTool = api;
    return api;
  }

  A.tools['thumbnail-maker'] = { mount };
})();
