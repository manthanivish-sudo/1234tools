/**
 * AI Image tools — the shared runtime.
 *
 * Everything the tools under /ai-image/ have in common: decoding a photo,
 * running the segmentation model on the device, turning what it finds into
 * soft-edged layers, drawing styled and animated text, and encoding stills,
 * GIFs and MP4s without a server.
 *
 * Nothing is uploaded. The model weights come from the Hugging Face Hub and
 * the runtime from jsDelivr, once, on first use, and the browser caches
 * both. The picture itself never leaves the page. Both downloads happen
 * strictly on demand: a plain load of a tool page contacts nobody.
 */
(function () {
  'use strict';
  const AIImg = window.AIImg = window.AIImg || {};
  AIImg.tools = AIImg.tools || {};

  /* ------------------------------------------------------------------ */
  /* small helpers                                                      */
  /* ------------------------------------------------------------------ */
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms || 0));
  const fmtBytes = (n) => n < 1024 ? n + ' B'
    : n < 1048576 ? (n / 1024).toFixed(1) + ' KB'
    : (n / 1048576).toFixed(2) + ' MB';
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function scaled(src, w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  /* ------------------------------------------------------------------ */
  /* form controls, in the site's own markup                            */
  /* ------------------------------------------------------------------ */
  function field(label, control, hint) {
    const f = el('div', 'field');
    if (label) {
      const l = el('label', null, label);
      const target = control.input || control;
      if (target.id) l.htmlFor = target.id;
      f.appendChild(l);
    }
    f.appendChild(control);
    if (hint) f.appendChild(el('p', 'field-hint', hint));
    return f;
  }
  function select(id, options, value) {
    const s = el('select', 'control');
    s.id = id;
    for (const o of options) {
      const op = el('option', null, Array.isArray(o) ? o[1] : (o.label || o));
      op.value = Array.isArray(o) ? o[0] : (o.value !== undefined ? o.value : o);
      s.appendChild(op);
    }
    if (value !== undefined) s.value = String(value);
    return s;
  }
  function range(id, min, max, step, value, fmt) {
    const wrap = el('div', 'range-row');
    const r = el('input', 'range');
    r.type = 'range'; r.id = id; r.min = min; r.max = max; r.step = step; r.value = value;
    const show = fmt || ((v) => String(v));
    const v = el('span', 'range-val', show(Number(value)));
    r.addEventListener('input', () => { v.textContent = show(Number(r.value)); });
    wrap.append(r, v);
    wrap.input = r;
    wrap.set = (val) => { r.value = val; v.textContent = show(Number(val)); };
    return wrap;
  }
  function colour(id, value) {
    const i = el('input', 'aiimg-colour');
    i.type = 'color'; i.id = id; i.value = value || '#ffffff';
    return i;
  }
  function check(id, label, value) {
    const w = el('div', 'field-check');
    const i = el('input'); i.type = 'checkbox'; i.id = id; i.checked = !!value;
    const l = el('label', null, label); l.htmlFor = id;
    w.append(i, l);
    w.input = i;
    return w;
  }
  function button(label, cls, onClick) {
    const b = el('button', cls || 'btn-ghost', label);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  /* ------------------------------------------------------------------ */
  /* decoding                                                           */
  /* ------------------------------------------------------------------ */
  /* Big enough for a print-quality still; small enough that a phone can
     hold the image, the cut-out and a preview at once. */
  const MAX_WORK = 4096;

  async function loadImageFile(file) {
    if (!/^image\//.test(file.type || '') && !/\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(file.name || '')) {
      throw new Error('That does not look like an image. Choose a JPEG, PNG, WebP or HEIC photo.');
    }
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) {
      bmp = await new Promise((res, rej) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); res(img); };
        img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file could not be read as an image. HEIC photos need Safari, or convert them to JPEG first.')); };
        img.src = url;
      });
    }
    const sw = bmp.width || bmp.naturalWidth, sh = bmp.height || bmp.naturalHeight;
    if (!sw || !sh) throw new Error('That image has no size — it may be corrupt.');
    const s = Math.min(1, MAX_WORK / Math.max(sw, sh));
    const canvas = scaled(bmp, sw * s, sh * s);
    if (bmp.close) bmp.close();
    return {
      canvas, width: canvas.width, height: canvas.height,
      name: String(file.name || 'image').replace(/\.[^.]+$/, '') || 'image',
      type: file.type, sourceWidth: sw, sourceHeight: sh, bytes: file.size
    };
  }

  /* ------------------------------------------------------------------ */
  /* the model                                                          */
  /* ------------------------------------------------------------------ */
  /* EfficientViT-Seg B1 trained on ADE20K (MIT HAN Lab, Apache-2.0): 150
     classes of thing and stuff, which is what lets a reader put text behind
     a car, a building or the sky and not only behind a person. 4.8 million
     parameters, 18 MB, exported to ONNX by build/ai-image/export-seg-model.py
     and served from this site, where ONNX Runtime's WebAssembly build runs
     it. Nothing is fetched from a third party. Chosen over SegFormer, whose
     weights are under NVIDIA's non-commercial licence. */
  const ORT_DIR = '/engine/vendor/ort/';
  const MODEL_URL = '/engine/models/efficientvit-seg-b1-ade20k.onnx';
  const MODEL_BYTES = 19300000;
  /* The network takes any size that is a multiple of 32. More pixels in
     means finer boundaries out and a longer wait; the download is the same. */
  const DETAIL = {
    standard: { size: 512, mask: 768, label: 'Standard — about a second' },
    high:     { size: 768, mask: 1024, label: 'High — finer edges, a few seconds' },
    max:      { size: 1024, mask: 1280, label: 'Maximum — finest, slowest' }
  };
  AIImg.DETAIL = DETAIL;
  const ADE20K = ('wall|building|sky|floor|tree|ceiling|road|bed|windowpane|grass|cabinet|sidewalk|person|earth|door|table|mountain|plant|curtain|chair|car|water|painting|sofa|shelf|house|sea|mirror|rug|field|armchair|seat|fence|desk|rock|wardrobe|lamp|bathtub|railing|cushion|base|box|column|signboard|chest of drawers|counter|sand|sink|skyscraper|fireplace|refrigerator|grandstand|path|stairs|runway|case|pool table|pillow|screen door|stairway|river|bridge|bookcase|blind|coffee table|toilet|flower|book|hill|bench|countertop|stove|palm|kitchen island|computer|swivel chair|boat|bar|arcade machine|hovel|bus|towel|light|truck|tower|chandelier|awning|streetlight|booth|television receiver|airplane|dirt track|apparel|pole|land|bannister|escalator|ottoman|bottle|buffet|poster|stage|van|ship|fountain|conveyer belt|canopy|washer|plaything|swimming pool|stool|barrel|basket|waterfall|tent|bag|minibike|cradle|oven|ball|food|step|tank|trade name|microwave|pot|animal|bicycle|lake|dishwasher|screen|blanket|sculpture|hood|sconce|vase|traffic light|tray|ashcan|fan|pier|crt screen|plate|monitor|bulletin board|shower|radiator|glass|clock|flag').split('|');
  const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];

  let ortLib = null;
  function runtime() {
    if (!ortLib) {
      ortLib = import(ORT_DIR + 'ort.wasm.min.mjs').then((m) => {
        const ort = m.default && m.default.InferenceSession ? m.default : m;
        ort.env.wasm.wasmPaths = ORT_DIR;
        ort.env.wasm.numThreads = 1;
        return ort;
      }).catch(() => {
        ortLib = null;
        throw new Error('The AI runtime could not be loaded. You may be offline — the first run needs the 14 MB runtime and the 18 MB model, after which both are cached.');
      });
    }
    return ortLib;
  }

  /* Read the weights with progress, so the first run can say how far it is. */
  async function fetchModel(onProgress) {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error('The model could not be downloaded (HTTP ' + res.status + ').');
    const total = Number(res.headers.get('content-length')) || MODEL_BYTES;
    if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length;
      if (onProgress) onProgress({ stage: 'download', fraction: Math.min(1, got / Math.max(total, got)), loaded: got, total: Math.max(total, got) });
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  let sessionPromise = null;
  /** The loaded network, once per page. */
  function segmenter(onProgress) {
    if (sessionPromise) return sessionPromise;
    sessionPromise = (async () => {
      const ort = await runtime();
      const bytes = await fetchModel(onProgress);
      const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      return { ort, session, id2label: ADE20K, device: 'wasm' };
    })().catch((e) => { sessionPromise = null; throw e; });
    return sessionPromise;
  }

  /* What tends to be the subject of a photograph, and so sits in front of
     the text by default. Everything else — sky, buildings, road, walls,
     grass — starts behind it, and every layer has a switch. */
  const SUBJECTS = new Set(['person', 'car', 'bicycle', 'minibike', 'bus', 'truck', 'van', 'boat', 'ship',
    'airplane', 'animal', 'sculpture', 'plaything', 'ball', 'bag', 'apparel', 'chair', 'armchair', 'sofa',
    'bottle', 'food', 'flower', 'vase', 'book', 'bench', 'streetlight', 'pole', 'traffic light', 'signboard',
    'flag', 'fountain', 'tent', 'basket', 'box', 'plate', 'glass', 'lamp', 'computer', 'monitor', 'swivel chair',
    'stool', 'barrel', 'pot', 'tray', 'ashcan', 'clock', 'television receiver']);
  const PRETTY = {
    person: 'People', car: 'Cars', bicycle: 'Bicycles', minibike: 'Motorbikes', bus: 'Buses', truck: 'Trucks',
    van: 'Vans', boat: 'Boats', ship: 'Ships', airplane: 'Aeroplanes', animal: 'Animals', sculpture: 'Statues',
    plaything: 'Toys', ball: 'Balls', bag: 'Bags', apparel: 'Clothing', building: 'Buildings', skyscraper: 'Skyscrapers',
    house: 'Houses', sky: 'Sky', tree: 'Trees', palm: 'Palm trees', plant: 'Plants', grass: 'Grass', road: 'Road',
    sidewalk: 'Pavement', earth: 'Ground', land: 'Ground', mountain: 'Mountains', hill: 'Hills', sea: 'Sea',
    water: 'Water', river: 'River', lake: 'Lake', wall: 'Walls', floor: 'Floor', ceiling: 'Ceiling',
    windowpane: 'Windows', door: 'Doors', signboard: 'Signs', 'trade name': 'Signs', streetlight: 'Street lights',
    pole: 'Poles', 'traffic light': 'Traffic lights', fence: 'Fences', railing: 'Railings', flag: 'Flags',
    bridge: 'Bridge', tower: 'Towers', field: 'Field', sand: 'Sand', rock: 'Rocks', path: 'Path', stairs: 'Stairs',
    stairway: 'Stairs', step: 'Steps', painting: 'Pictures', 'television receiver': 'TV', screen: 'Screens',
    monitor: 'Monitors', 'crt screen': 'Screens', computer: 'Computers', book: 'Books', flower: 'Flowers',
    vase: 'Vases', chair: 'Chairs', armchair: 'Armchairs', 'swivel chair': 'Chairs', table: 'Tables',
    'coffee table': 'Tables', desk: 'Desks', sofa: 'Sofas', bed: 'Bed', lamp: 'Lamps', light: 'Lights',
    curtain: 'Curtains', rug: 'Rugs', cabinet: 'Cabinets', shelf: 'Shelves', bottle: 'Bottles', food: 'Food',
    plate: 'Plates', glass: 'Glasses', bench: 'Benches', fountain: 'Fountain', tent: 'Tents', awning: 'Awnings',
    canopy: 'Canopy', column: 'Columns', 'dirt track': 'Track', runway: 'Runway', pier: 'Pier', 'swimming pool': 'Pool',
    waterfall: 'Waterfall', grandstand: 'Stands', stage: 'Stage', clock: 'Clocks', box: 'Boxes', basket: 'Baskets',
    barrel: 'Barrels', pot: 'Pots', tray: 'Trays', ashcan: 'Bins', stool: 'Stools', cushion: 'Cushions',
    pillow: 'Pillows', blanket: 'Blankets', towel: 'Towels', mirror: 'Mirrors', hood: 'Hood', fan: 'Fans',
    radiator: 'Radiators', sconce: 'Wall lights', chandelier: 'Chandelier', bannister: 'Bannister', escalator: 'Escalator',
    'conveyer belt': 'Conveyor', 'arcade machine': 'Arcade machine', hovel: 'Hut', booth: 'Booth', 'bulletin board': 'Noticeboard',
    poster: 'Posters', 'kitchen island': 'Kitchen island', countertop: 'Worktop', counter: 'Counter', stove: 'Cooker',
    oven: 'Oven', microwave: 'Microwave', refrigerator: 'Fridge', dishwasher: 'Dishwasher', washer: 'Washing machine',
    sink: 'Sink', bathtub: 'Bath', shower: 'Shower', toilet: 'Toilet', 'pool table': 'Pool table', cradle: 'Cot',
    wardrobe: 'Wardrobe', 'chest of drawers': 'Drawers', bookcase: 'Bookcase', buffet: 'Sideboard', case: 'Display case',
    'screen door': 'Screen door', blind: 'Blinds', ottoman: 'Footstool', seat: 'Seats', base: 'Pedestal', tank: 'Tank'
  };
  const prettyName = (label) => PRETTY[label] || (label.charAt(0).toUpperCase() + label.slice(1));

  /* A colour per class, for the layer swatches and the overlay. */
  function classHue(classId) { return (classId * 47) % 360; }
  function hslToRgb(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }

  /* Classes under this share of the picture are noise: a 128×128 map has
     16,384 cells, and three of them are not a layer anyone wants a row for. */
  const KEEP_MIN = 0.0025;

  /**
   * Split a picture into its classes.
   *
   * Returns a class map at a working "mask resolution" (768 on the long
   * edge by default), the layers present with their share of the frame,
   * and which device did the work. Boundaries come from the model's
   * logits upsampled bilinearly before the argmax, so they are curves, not
   * the staircase of a nearest-neighbour upscale; refine() sharpens them
   * against the real pixels afterwards.
   */
  async function segment(image, opts) {
    opts = opts || {};
    const detail = DETAIL[opts.detail] || DETAIL.standard;
    const report = opts.onProgress || (() => {});
    const S = await segmenter(report);
    report({ stage: 'run', fraction: 0, device: S.device });

    /* The long edge goes to the chosen size and the short edge follows,
       rounded to the multiple of 32 the network's strides need, so the
       picture is not squashed square on the way in. */
    const long = Math.max(image.width, image.height);
    const sc = detail.size / long;
    const r32 = (v) => Math.max(64, Math.round(v / 32) * 32);
    const iw = r32(image.width * sc), ih = r32(image.height * sc);
    const px = scaled(image.canvas, iw, ih).getContext('2d').getImageData(0, 0, iw, ih).data;
    const n = iw * ih;
    const input = new Float32Array(3 * n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      input[i] = (px[j] / 255 - MEAN[0]) / STD[0];
      input[n + i] = (px[j + 1] / 255 - MEAN[1]) / STD[1];
      input[2 * n + i] = (px[j + 2] / 255 - MEAN[2]) / STD[2];
    }
    await sleep(0);
    const out = await S.session.run({ pixel_values: new S.ort.Tensor('float32', input, [1, 3, ih, iw]) });
    const logits = out.logits;
    const C = logits.dims[1], lh = logits.dims[2], lw = logits.dims[3];
    const data = logits.data;
    const plane = lh * lw;

    /* which classes are actually here */
    const counts = new Uint32Array(C);
    for (let i = 0; i < plane; i++) {
      let best = 0, bv = data[i];
      for (let c = 1; c < C; c++) { const v = data[c * plane + i]; if (v > bv) { bv = v; best = c; } }
      counts[best]++;
    }
    const keep = [];
    for (let c = 0; c < C; c++) if (counts[c] >= Math.max(3, KEEP_MIN * plane)) keep.push(c);
    if (!keep.length) keep.push(0);
    const K = keep.length;

    /* the class map at mask resolution, from bilinearly upsampled logits */
    const ms = Math.min(1, (opts.maskLongEdge || detail.mask) / Math.max(image.width, image.height));
    const mw = Math.max(1, Math.round(image.width * ms)), mh = Math.max(1, Math.round(image.height * ms));
    const classMap = new Uint8Array(mw * mh);
    const offs = keep.map((c) => c * plane);
    for (let y = 0; y < mh; y++) {
      const sy = clamp((y + 0.5) / mh * lh - 0.5, 0, lh - 1);
      const y0 = Math.floor(sy), y1 = Math.min(lh - 1, y0 + 1), fy = sy - y0;
      for (let x = 0; x < mw; x++) {
        const sx = clamp((x + 0.5) / mw * lw - 0.5, 0, lw - 1);
        const x0 = Math.floor(sx), x1 = Math.min(lw - 1, x0 + 1), fx = sx - x0;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        const i00 = y0 * lw + x0, i10 = y0 * lw + x1, i01 = y1 * lw + x0, i11 = y1 * lw + x1;
        let best = 0, bv = -Infinity;
        for (let k = 0; k < K; k++) {
          const o = offs[k];
          const v = data[o + i00] * w00 + data[o + i10] * w10 + data[o + i01] * w01 + data[o + i11] * w11;
          if (v > bv) { bv = v; best = k; }
        }
        classMap[y * mw + x] = best;
      }
      if ((y & 63) === 63) { report({ stage: 'run', fraction: y / mh, device: S.device }); await sleep(0); }
    }

    /* the layers, largest first */
    const area = new Uint32Array(K);
    const bb = keep.map(() => [mw, mh, -1, -1]);
    for (let i = 0, y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++, i++) {
        const k = classMap[i]; area[k]++;
        const b = bb[k];
        if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
      }
    }
    const layers = keep.map((c, k) => {
      const label = String(S.id2label[c] || c).trim();
      const hue = classHue(c);
      return { key: k, classId: c, label, name: prettyName(label), area: area[k] / (mw * mh), bbox: bb[k],
               subject: SUBJECTS.has(label), colour: 'hsl(' + hue + ' 85% 60%)', rgb: hslToRgb(hue, 0.85, 0.6) };
    }).filter((l) => l.area > 0).sort((a, b) => b.area - a.area);

    report({ stage: 'done', fraction: 1, device: S.device });
    return { mw, mh, classMap, layers, device: S.device, detail: opts.detail || 'standard', input: [iw, ih] };
  }

  /* ------------------------------------------------------------------ */
  /* refining a mask against the picture                                */
  /* ------------------------------------------------------------------ */
  /** The picture at mask resolution, as three float planes. */
  function guideOf(image, mw, mh) {
    const d = scaled(image.canvas, mw, mh).getContext('2d').getImageData(0, 0, mw, mh).data;
    const n = mw * mh;
    const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) { r[i] = d[j] / 255; g[i] = d[j + 1] / 255; b[i] = d[j + 2] / 255; }
    return { r, g, b, w: mw, h: mh };
  }

  /** Mean over a (2r+1)² window, clipped at the borders, via a summed-area table. */
  function boxMean(src, w, h, r) {
    const W1 = w + 1;
    const sat = new Float64Array(W1 * (h + 1));
    for (let y = 1; y <= h; y++) {
      let row = 0;
      const o = y * W1, so = (y - 1) * w;
      for (let x = 1; x <= w; x++) { row += src[so + x - 1]; sat[o + x] = sat[o - W1 + x] + row; }
    }
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      const ro0 = y0 * W1, ro1 = y1 * W1, dy = y1 - y0;
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        out[y * w + x] = (sat[ro1 + x1] - sat[ro0 + x1] - sat[ro1 + x0] + sat[ro0 + x0]) / (dy * (x1 - x0));
      }
    }
    return out;
  }
  const mul = (a, b) => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] * b[i]; return o; };

  /**
   * He, Sun & Tang's guided filter, colour guide. The mask is re-expressed
   * as a local linear function of the pixel colours, which is what makes a
   * blobby model boundary snap to the real edge of a sleeve or a car door
   * and go soft exactly where hair does.
   */
  function guidedFilter(p, G, r, eps) {
    const { w, h } = G, n = w * h;
    const box = (a) => boxMean(a, w, h, r);
    const Ir = G.r, Ig = G.g, Ib = G.b;
    const mr = box(Ir), mg = box(Ig), mb = box(Ib), mp = box(p);
    const mrp = box(mul(Ir, p)), mgp = box(mul(Ig, p)), mbp = box(mul(Ib, p));
    const mrr = box(mul(Ir, Ir)), mrg = box(mul(Ir, Ig)), mrb = box(mul(Ir, Ib));
    const mgg = box(mul(Ig, Ig)), mgb = box(mul(Ig, Ib)), mbb = box(mul(Ib, Ib));
    const ar = new Float32Array(n), ag = new Float32Array(n), ab = new Float32Array(n), bb = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const vrr = mrr[i] - mr[i] * mr[i] + eps, vrg = mrg[i] - mr[i] * mg[i], vrb = mrb[i] - mr[i] * mb[i];
      const vgg = mgg[i] - mg[i] * mg[i] + eps, vgb = mgb[i] - mg[i] * mb[i], vbb = mbb[i] - mb[i] * mb[i] + eps;
      const cr = mrp[i] - mr[i] * mp[i], cg = mgp[i] - mg[i] * mp[i], cb = mbp[i] - mb[i] * mp[i];
      const det = vrr * (vgg * vbb - vgb * vgb) - vrg * (vrg * vbb - vgb * vrb) + vrb * (vrg * vgb - vgg * vrb);
      if (Math.abs(det) < 1e-12) { bb[i] = mp[i]; continue; }
      const inv = 1 / det;
      const i00 = (vgg * vbb - vgb * vgb) * inv, i01 = (vrb * vgb - vrg * vbb) * inv, i02 = (vrg * vgb - vrb * vgg) * inv;
      const i11 = (vrr * vbb - vrb * vrb) * inv, i12 = (vrg * vrb - vrr * vgb) * inv, i22 = (vrr * vgg - vrg * vrg) * inv;
      ar[i] = i00 * cr + i01 * cg + i02 * cb;
      ag[i] = i01 * cr + i11 * cg + i12 * cb;
      ab[i] = i02 * cr + i12 * cg + i22 * cb;
      bb[i] = mp[i] - ar[i] * mr[i] - ag[i] * mg[i] - ab[i] * mb[i];
    }
    const Ar = box(ar), Ag = box(ag), Ab = box(ab), B = box(bb);
    const q = new Float32Array(n);
    for (let i = 0; i < n; i++) q[i] = clamp(Ar[i] * Ir[i] + Ag[i] * Ig[i] + Ab[i] * Ib[i] + B[i], 0, 1);
    return q;
  }

  /**
   * Binary mask in, soft alpha out. `softness` 0–10 widens the band the
   * filter may bend in; `shift` −5…5 grows or shrinks the cut a little per
   * step, for haloes and for lost fringes.
   */
  function refine(binary, G, opts) {
    opts = opts || {};
    const soft = clamp(Number(opts.softness) || 0, 0, 10);
    const r = Math.round(1 + soft * 0.9);
    const eps = 0.0015 + 0.002 * soft;
    const q = guidedFilter(binary, G, r, eps);
    const shift = clamp(Number(opts.shift) || 0, -5, 5) * 0.06;
    const lo = 0.3 - shift, span = 0.4;
    for (let i = 0; i < q.length; i++) q[i] = clamp((q[i] - lo) / span, 0, 1);
    return q;
  }

  /** A canvas whose alpha is the mask, at mask resolution. */
  function maskCanvas(alpha, mw, mh) {
    const c = document.createElement('canvas');
    c.width = mw; c.height = mh;
    const id = new ImageData(mw, mh);
    const d = id.data;
    for (let i = 0, j = 3; i < alpha.length; i++, j += 4) d[j] = Math.round(alpha[i] * 255);
    c.getContext('2d').putImageData(id, 0, 0);
    return c;
  }

  /** The picture where the mask is, transparent elsewhere, at full working size. */
  function cutOut(image, alpha, mw, mh) {
    const m = maskCanvas(alpha, mw, mh);
    const c = document.createElement('canvas');
    c.width = image.width; c.height = image.height;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(m, 0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-in';
    x.drawImage(image.canvas, 0, 0);
    return c;
  }

  /* ------------------------------------------------------------------ */
  /* text                                                               */
  /* ------------------------------------------------------------------ */
  const DIRS = {
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    'up-left': { x: -1, y: -1 }, 'up-right': { x: 1, y: -1 }, 'down-left': { x: -1, y: 1 }, 'down-right': { x: 1, y: 1 }
  };
  AIImg.DIRS = DIRS;

  const fontString = (L, px) => (L.italic ? 'italic ' : '') + (L.weight || 700) + ' ' + px + 'px "' + (L.font || 'Sora') + '", "Inter", Arial, sans-serif';

  const fontCache = new Set();
  /** Ask the browser for the face before it is drawn, so a web font is not painted as Arial on its first frame. */
  function ensureFont(L) {
    const key = (L.italic ? 'i' : 'n') + (L.weight || 700) + '|' + (L.font || 'Sora');
    if (fontCache.has(key) || !document.fonts || !document.fonts.load) return Promise.resolve();
    fontCache.add(key);
    return document.fonts.load(fontString(L, 40)).catch(() => {});
  }

  /** Where every glyph goes, relative to the block's centre. */
  function layout(ctx, L, W) {
    const px = Math.max(1, (Number(L.size) || 20) / 100 * W);
    ctx.font = fontString(L, px);
    const raw = String(L.text || '');
    const lines = (L.uppercase ? raw.toUpperCase() : raw).split('\n');
    const ls = (Number(L.letterSpacing) || 0) * px;
    const lineH = px * (Number(L.lineHeight) || 1.1);
    const widths = new Map();
    const wOf = (ch) => { let w = widths.get(ch); if (w === undefined) { w = ctx.measureText(ch).width; widths.set(ch, w); } return w; };
    const lineChars = lines.map((line) => Array.from(line));
    const lineW = lineChars.map((cs) => cs.reduce((s, ch) => s + wOf(ch) + ls, 0) - (cs.length ? ls : 0));
    const blockW = Math.max(0, ...lineW), blockH = lineH * lines.length;
    const chars = [];
    lineChars.forEach((cs, li) => {
      let x = L.align === 'left' ? -blockW / 2 : L.align === 'right' ? blockW / 2 - lineW[li] : -lineW[li] / 2;
      const y = -blockH / 2 + lineH * (li + 0.5);
      for (const ch of cs) { const w = wOf(ch); chars.push({ ch, x: x + w / 2, y, w }); x += w + ls; }
    });
    return { px, chars, blockW, blockH, lineH, n: chars.length };
  }

  /**
   * Where the block is, how big, how turned and how visible at time t,
   * plus a per-glyph offset for the wave. Cyclic motions complete whole
   * cycles in a clip, so an exported loop joins up.
   */
  function motion(L, t, D, W, H, lay) {
    const A = L.anim || { type: 'none' };
    const type = A.type || 'none';
    const p = D > 0 ? (((t % D) + D) % D) / D : 0;
    const sp = Math.max(1, Math.round(Number(A.speed) || 1));
    const amp = clamp(Number(A.amplitude) || 0, 0, 2);
    const waves = clamp(Number(A.waves) || 1.5, 0.25, 6);
    const dir = DIRS[A.direction] || DIRS.left;
    const m = { cx: L.x * W, cy: L.y * H, rot: 0, scale: 1, alpha: 1, visible: Infinity, glyph: null };
    const bw = lay.blockW, bh = lay.blockH;
    const wave = (i, n) => ({ dx: 0, dy: Math.sin(2 * Math.PI * (waves * i / Math.max(1, n) + p * sp)) * amp * lay.px * 0.5 });

    switch (type) {
      case 'scroll':
      case 'wave-scroll': {
        const s = (p * sp) % 1;
        if (dir.x) m.cx = dir.x < 0 ? W + bw / 2 - s * (W + bw) : -bw / 2 + s * (W + bw);
        if (dir.y) m.cy = dir.y < 0 ? H + bh / 2 - s * (H + bh) : -bh / 2 + s * (H + bh);
        if (type === 'wave-scroll') m.glyph = wave;
        break;
      }
      case 'wave': m.glyph = wave; break;
      case 'slide': {
        /* in from the far edge, hold, out through the near one */
        const sx = dir.x ? (dir.x < 0 ? W + bw / 2 : -bw / 2) : m.cx;
        const sy = dir.y ? (dir.y < 0 ? H + bh / 2 : -bh / 2) : m.cy;
        const ex = dir.x ? (dir.x < 0 ? -bw / 2 : W + bw / 2) : m.cx;
        const ey = dir.y ? (dir.y < 0 ? -bh / 2 : H + bh / 2) : m.cy;
        if (p < 0.3) { const e = easeOut(p / 0.3); m.cx = lerp(sx, m.cx, e); m.cy = lerp(sy, m.cy, e); }
        else if (p > 0.82) { const e = easeIn((p - 0.82) / 0.18); m.cx = lerp(m.cx, ex, e); m.cy = lerp(m.cy, ey, e); }
        break;
      }
      case 'zoom': {
        if (p < 0.35) { const e = easeOut(p / 0.35); m.scale = lerp(0.1, 1, e); m.alpha = e; }
        else if (p > 0.9) { const e = (p - 0.9) / 0.1; m.alpha = 1 - e; }
        break;
      }
      case 'typewriter': m.visible = Math.floor(lay.n * Math.min(1, p / 0.75) + 1e-6); break;
      case 'bounce': m.cy -= Math.abs(Math.sin(Math.PI * p * sp)) * amp * lay.px; break;
      case 'pulse': m.scale = 1 + amp * 0.35 * Math.sin(2 * Math.PI * p * sp); break;
      case 'fade': m.alpha = 0.5 - 0.5 * Math.cos(2 * Math.PI * p * sp); break;
      case 'float': m.cx += amp * lay.px * 0.6 * Math.sin(2 * Math.PI * p * sp); m.cy += amp * lay.px * 0.35 * Math.cos(2 * Math.PI * p * sp); break;
      case 'spin': m.rot = 360 * p * sp; break;
      default: break;
    }
    return m;
  }

  const hexToRgba = (hex, a) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return 'rgba(0,0,0,' + a + ')';
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')';
  };

  /** Draw one text layer at time t on a W×H canvas. */
  function drawText(ctx, L, t, W, H, D) {
    if (!L || !String(L.text || '').trim()) return;
    ctx.save();
    const lay = layout(ctx, L, W);
    const m = motion(L, t, D, W, H, lay);
    const opacity = L.opacity === 0 || L.opacity === '0' ? 0 : (Number(L.opacity) || 1);
    const alpha = clamp(opacity * m.alpha, 0, 1);
    if (alpha <= 0 || m.visible <= 0) { ctx.restore(); return; }
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = L.blend || 'source-over';
    ctx.translate(m.cx, m.cy);
    ctx.rotate(((Number(L.rotation) || 0) + m.rot) * Math.PI / 180);
    ctx.scale(m.scale, m.scale);
    ctx.font = fontString(L, lay.px);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    let fill = L.fill || '#ffffff';
    if (L.fillMode === 'gradient') {
      const a = ((Number(L.gradientAngle) || 0) - 90) * Math.PI / 180;
      const hx = Math.cos(a) * lay.blockW / 2, hy = Math.sin(a) * lay.blockH / 2;
      const g = ctx.createLinearGradient(-hx, -hy, hx, hy);
      g.addColorStop(0, L.fill || '#ffffff');
      g.addColorStop(1, L.fill2 || '#f7c948');
      fill = g;
    }
    const n = Math.min(lay.n, m.visible);
    const each = (fn) => {
      for (let i = 0; i < n; i++) {
        const c = lay.chars[i];
        const o = m.glyph ? m.glyph(i, lay.n) : null;
        fn(c.ch, c.x + (o ? o.dx : 0), c.y + (o ? o.dy : 0));
      }
    };
    const strokeW = (Number(L.strokeWidth) || 0) / 100 * lay.px;
    const glow = (Number(L.glow) || 0) / 100 * lay.px;
    const shBlur = (Number(L.shadowBlur) || 0) / 100 * lay.px;
    const shX = (Number(L.shadowX) || 0) / 100 * lay.px, shY = (Number(L.shadowY) || 0) / 100 * lay.px;
    const shOpacity = L.shadowOpacity === 0 || L.shadowOpacity === '0' ? 0 : (Number(L.shadowOpacity) || 0.6);

    /* glow and shadow are passes of their own, so a stroke does not get a
       second shadow and the glow sits under everything */
    if (glow > 0) {
      ctx.shadowColor = typeof fill === 'string' ? fill : (L.fill || '#ffffff');
      ctx.shadowBlur = glow; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = fill;
      each((ch, x, y) => ctx.fillText(ch, x, y));
      each((ch, x, y) => ctx.fillText(ch, x, y));
      ctx.shadowBlur = 0;
    }
    if (shBlur > 0 || shX || shY) {
      ctx.shadowColor = hexToRgba(L.shadowColor || '#000000', clamp(shOpacity, 0, 1));
      ctx.shadowBlur = shBlur; ctx.shadowOffsetX = shX; ctx.shadowOffsetY = shY;
      ctx.fillStyle = fill;
      each((ch, x, y) => ctx.fillText(ch, x, y));
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    }
    if (strokeW > 0) {
      ctx.lineWidth = strokeW * 2;   /* half of it is covered by the fill */
      ctx.strokeStyle = L.stroke || '#000000';
      each((ch, x, y) => ctx.strokeText(ch, x, y));
    }
    ctx.fillStyle = fill;
    each((ch, x, y) => ctx.fillText(ch, x, y));
    ctx.restore();
  }

  /** The block's corners at time t, in canvas pixels, for hit-testing and the selection outline. */
  function textBox(ctx, L, t, W, H, D) {
    const lay = layout(ctx, L, W);
    const m = motion(L, t, D, W, H, lay);
    const a = ((Number(L.rotation) || 0) + m.rot) * Math.PI / 180;
    const cos = Math.cos(a), sin = Math.sin(a);
    const hw = Math.max(lay.blockW / 2 + lay.px * 0.15, 12) * m.scale, hh = Math.max(lay.blockH / 2 + lay.px * 0.1, 12) * m.scale;
    const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [m.cx + x * cos - y * sin, m.cy + x * sin + y * cos]);
    return { cx: m.cx, cy: m.cy, pts, w: hw * 2, h: hh * 2 };
  }
  function pointInBox(box, x, y) {
    const p = box.pts;
    let inside = false;
    for (let i = 0, j = 3; i < 4; j = i++) {
      const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  /* ------------------------------------------------------------------ */
  /* encoders                                                           */
  /* ------------------------------------------------------------------ */
  const evenDown = (n) => Math.max(2, Math.floor(n / 2) * 2);

  /** PNG, JPEG or WebP of one frame. */
  function exportStill(render, o) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(o.width)); c.height = Math.max(1, Math.round(o.height));
    const ctx = c.getContext('2d');
    if (o.format === 'image/jpeg') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height); }
    render(ctx, c.width, c.height, o.t || 0);
    return new Promise((res) => c.toBlob((b) => res(b), o.format || 'image/png', clamp(Number(o.quality) || 0.92, 0.1, 1)));
  }

  /* 4×4 ordered dither: with no error diffusion, a 256-colour sky is a
     staircase. A few levels of threshold noise turn it back into a sky. */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function dither(data, w, h, strength) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const d = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * strength;
        data[o] = clamp(data[o] + d, 0, 255);
        data[o + 1] = clamp(data[o + 1] + d, 0, 255);
        data[o + 2] = clamp(data[o + 2] + d, 0, 255);
      }
    }
  }

  const abortError = () => { const e = new Error('Cancelled.'); e.name = 'AbortError'; return e; };

  /** An animated GIF: one palette for the whole clip, so nothing flickers. */
  async function encodeGIF(render, o) {
    const g = await import('/engine/vendor/gifenc.esm.js');
    const w = Math.max(2, Math.round(o.width)), h = Math.max(2, Math.round(o.height));
    const fps = clamp(Math.round(o.fps) || 15, 5, 30);
    const total = Math.max(1, Math.round(o.duration * fps));
    const report = o.onProgress || (() => {});
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });

    /* palette from four spread frames, each shrunk: 256 colours decided on
       300k pixels look the same as on 3M and take a tenth of the time */
    const sw = Math.max(1, Math.round(w * Math.min(1, 320 / Math.max(w, h))));
    const sh = Math.max(1, Math.round(h * Math.min(1, 320 / Math.max(w, h))));
    const sample = new Uint8ClampedArray(sw * sh * 4 * 4);
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      render(ctx, w, h, (k / 4) * o.duration);
      const s = scaled(c, sw, sh).getContext('2d').getImageData(0, 0, sw, sh).data;
      sample.set(s, k * sw * sh * 4);
    }
    const palette = g.quantize(sample, 256, { format: 'rgb565' });
    const gif = g.GIFEncoder();
    const delay = Math.round(1000 / fps);

    for (let i = 0; i < total; i++) {
      if (o.signal && o.signal.aborted) throw abortError();
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      render(ctx, w, h, i / fps);
      const id = ctx.getImageData(0, 0, w, h);
      dither(id.data, w, h, 6);
      const index = g.applyPalette(id.data, palette, 'rgb565');
      gif.writeFrame(index, w, h, i === 0 ? { palette, delay, repeat: 0 } : { delay });
      report(i / total);
      if ((i & 1) === 1) await sleep(0);
    }
    gif.finish();
    report(1);
    return new Blob([gif.bytes()], { type: 'image/gif' });
  }

  /* H.264 through WebCodecs, boxed by mp4-muxer. Levels in ascending
     order: the first the browser accepts for this size is the most widely
     playable one that fits. */
  const AVC = ['avc1.42001f', 'avc1.4d001f', 'avc1.640028', 'avc1.64002a', 'avc1.640032', 'avc1.640033'];
  async function pickAvc(width, height, fps, bitrate) {
    if (typeof VideoEncoder === 'undefined' || !VideoEncoder.isConfigSupported) return null;
    for (const codec of AVC) {
      const config = { codec, width, height, bitrate, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' };
      try { const r = await VideoEncoder.isConfigSupported(config); if (r && r.supported) return r.config || config; }
      catch (e) { /* next */ }
    }
    return null;
  }

  async function encodeMP4(render, o) {
    const w = evenDown(o.width), h = evenDown(o.height);
    const fps = clamp(Math.round(o.fps) || 30, 5, 60);
    const total = Math.max(1, Math.round(o.duration * fps));
    const report = o.onProgress || (() => {});
    const bitrate = Math.round(clamp(w * h * fps * 0.12, 1.2e6, 24e6));
    const config = await pickAvc(w, h, fps, bitrate);
    if (!config) return null;
    const M = await import('/engine/vendor/mp4-muxer.mjs');
    const target = new M.ArrayBufferTarget();
    const muxer = new M.Muxer({ target, video: { codec: 'avc', width: w, height: h, frameRate: fps }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
    let failure = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { failure = e; } },
      error: (e) => { failure = e; }
    });
    encoder.configure(config);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    try {
      for (let i = 0; i < total; i++) {
        if (o.signal && o.signal.aborted) throw abortError();
        if (failure) throw failure;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        render(ctx, w, h, i / fps);
        const frame = new VideoFrame(c, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
        frame.close();
        while (encoder.encodeQueueSize > 6) await sleep(4);
        if ((i & 3) === 3) { report(i / total); await sleep(0); }
      }
      await encoder.flush();
      if (failure) throw failure;
    } finally {
      try { if (encoder.state !== 'closed') encoder.close(); } catch (e) { /* done */ }
    }
    muxer.finalize();
    report(1);
    return new Blob([target.buffer], { type: 'video/mp4' });
  }

  /* Where WebCodecs is missing (Firefox), MediaRecorder captures the canvas
     in real time: a six-second clip takes six seconds. MP4 if the browser
     records it, otherwise WebM. */
  async function encodeRecorded(render, o) {
    if (typeof MediaRecorder === 'undefined') return null;
    const w = evenDown(o.width), h = evenDown(o.height);
    const fps = clamp(Math.round(o.fps) || 30, 5, 60);
    const total = Math.max(1, Math.round(o.duration * fps));
    const report = o.onProgress || (() => {});
    const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mime = types.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } });
    if (!mime) return null;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    render(ctx, w, h, 0);
    const stream = c.captureStream(0);
    const track = stream.getVideoTracks()[0];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(clamp(w * h * fps * 0.12, 1.2e6, 24e6)) });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res) => { rec.onstop = res; });
    rec.start(250);
    const t0 = performance.now();
    for (let i = 0; i < total; i++) {
      if (o.signal && o.signal.aborted) { rec.stop(); throw abortError(); }
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      render(ctx, w, h, i / fps);
      if (track.requestFrame) track.requestFrame();
      report(i / total);
      const due = t0 + (i + 1) * 1000 / fps;
      const wait = due - performance.now();
      if (wait > 0) await sleep(wait);
    }
    await sleep(120);
    rec.stop();
    await stopped;
    report(1);
    const isMp4 = /mp4/.test(mime);
    return new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' });
  }

  /** Video by the best route the browser offers. Returns { blob, ext, note }. */
  async function encodeVideo(render, o) {
    let blob = null;
    try { blob = await encodeMP4(render, o); }
    catch (e) { if (e && e.name === 'AbortError') throw e; blob = null; }
    if (blob) return { blob, ext: 'mp4', note: 'H.264 MP4' };
    blob = await encodeRecorded(render, o);
    if (!blob) throw new Error('This browser cannot encode video on the device. Chrome, Edge or Safari 16.4+ can; or export a GIF instead.');
    const mp4 = blob.type === 'video/mp4';
    return { blob, ext: mp4 ? 'mp4' : 'webm', note: mp4 ? 'MP4 (recorded in real time)' : 'WebM — this browser has no on-device MP4 encoder, so the clip was recorded in real time as WebM. It plays everywhere a browser does; convert it if a site insists on MP4.' };
  }

  /* ------------------------------------------------------------------ */
  Object.assign(AIImg, {
    el, clamp, lerp, sleep, fmtBytes, download, scaled,
    field, select, range, colour, check, button,
    loadImageFile, segment, segmenter, prettyName,
    guideOf, refine, maskCanvas, cutOut,
    fontString, ensureFont, layout, motion, drawText, textBox, pointInBox,
    exportStill, encodeGIF, encodeVideo,
    MAX_WORK
  });

  /** Mount the tool a page asks for into its article. */
  AIImg.mount = function (id, root) {
    const tool = AIImg.tools[id];
    if (!tool) throw new Error('no such tool: ' + id);
    return tool.mount(root);
  };
})();
