/**
 * 3D Photo Parallax Video.
 *
 * The picture is laid over a dense mesh whose vertices are pushed towards
 * or away from the camera by the depth the model estimated, and a virtual
 * camera moves around it in WebGL. Near things shift more than far things;
 * that parallax is the whole effect. A softened copy of the background sits
 * behind the mesh, and the pixels that stretch across a depth edge are
 * blended into it, so a gap shows soft background rather than a smear or a
 * hole. Where there is no WebGL, a few depth-band layers slide on a plain
 * canvas instead. Every camera move is a cycle, so the exported clip loops.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A || !A.depth) return;
  const { el, clamp, field, select, range, button, sleep, fmtBytes } = A;

  const WORK_MAX = 1536;
  const DURATION = 6;
  const PREVIEW_LONG = 720;
  const GRID = 200;
  const EYE_D = 2.5;
  const FRAMES = { '9:16': [1080, 1920, '9:16 — Reels, TikTok, Shorts'], '1:1': [1080, 1080, '1:1 — square post'], '16:9': [1920, 1080, '16:9 — YouTube, landscape'] };
  const MOVES = [['sway', 'Sway — side to side'], ['dolly', 'Dolly zoom — push in and back'], ['circle', 'Circle — orbit the subject'], ['drift', 'Vertical drift'], ['tilt', 'Push-in with tilt']];
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };
  const free = (c) => { if (c) { c.width = 0; c.height = 0; } };

  /* The mesh: a point's depth pushes it along z; the eye, displaced from
     the window centre, projects it back onto the picture plane. A point on
     the plane itself (z = 0) never moves, so the frame stays put and only
     the near and far parts slide — the sheared camera of a 2.5D rig. */
  const VS_MESH = [
    'attribute vec2 aUv; attribute float aZ; attribute float aE;',
    'uniform vec2 uPlane; uniform vec2 uWin; uniform vec2 uHalf; uniform vec3 uEye; uniform float uTilt; uniform float uZ;',
    'varying vec2 vUv; varying float vE;',
    'void main() {',
    '  vec2 p = vec2((aUv.x * 2.0 - 1.0) * uPlane.x, (1.0 - aUv.y * 2.0) * uPlane.y);',
    '  float z = aZ * uZ;',
    '  float dy = p.y - uWin.y; float c = cos(uTilt); float s = sin(uTilt);',
    '  float y2 = uWin.y + dy * c - z * s; float z2 = dy * s + z * c;',
    '  float k = uEye.z / max(uEye.z - z2, 0.05);',
    '  vec2 X = uEye.xy + (vec2(p.x, y2) - uEye.xy) * k;',
    '  gl_Position = vec4((X - uWin) / uHalf, -z2 * 0.5, 1.0);',
    '  vUv = aUv; vE = aE;',
    '}'].join('\n');
  const FS_MESH = [
    'precision mediump float;',
    'varying vec2 vUv; varying float vE;',
    'uniform sampler2D uTex; uniform sampler2D uBg; uniform float uEdge;',
    'void main() {',
    '  vec4 c = texture2D(uTex, vUv); vec4 b = texture2D(uBg, vUv);',
    '  float k = smoothstep(uEdge, uEdge * 3.0, vE);',
    '  gl_FragColor = vec4(mix(c.rgb, b.rgb, k), 1.0);',
    '}'].join('\n');
  const VS_BG = 'attribute vec2 aPos; attribute vec2 aUv; varying vec2 vUv; void main() { gl_Position = vec4(aPos, 0.99, 1.0); vUv = aUv; }';
  const FS_BG = 'precision mediump float; varying vec2 vUv; uniform sampler2D uTex; void main() { gl_FragColor = vec4(texture2D(uTex, vUv).rgb, 1.0); }';

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
    return sh;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('program: ' + gl.getProgramInfoLog(p));
    return p;
  }

  /** Mean over a (2r+1)² window, separable, edges clipped. */
  function boxBlur(src, w, h, r) {
    if (r <= 0) return src;
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let acc = 0, n = 0;
      for (let k = 0; k <= Math.min(w - 1, r); k++) { acc += src[o + k]; n++; }
      for (let x = 0; x < w; x++) {
        tmp[o + x] = acc / n;
        const add = x + r + 1, rem = x - r;
        if (add < w) { acc += src[o + add]; n++; }
        if (rem >= 0) { acc -= src[o + rem]; n--; }
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0, n = 0;
      for (let k = 0; k <= Math.min(h - 1, r); k++) { acc += tmp[k * w + x]; n++; }
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc / n;
        const add = y + r + 1, rem = y - r;
        if (add < h) { acc += tmp[add * w + x]; n++; }
        if (rem >= 0) { acc -= tmp[rem * w + x]; n--; }
      }
    }
    return out;
  }

  /** The source drawn at W×H with its edge pixels extended p px outward, so a blur does not darken the borders. */
  function padded(src, W, H, p) {
    const c = el('canvas');
    c.width = W + 2 * p; c.height = H + 2 * p;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(src, p, p, W, H);
    if (p > 0) {
      x.drawImage(c, p, p, W, 1, p, 0, W, p);
      x.drawImage(c, p, p + H - 1, W, 1, p, p + H, W, p);
      x.drawImage(c, p, 0, 1, H + 2 * p, 0, 0, p, H + 2 * p);
      x.drawImage(c, p + W - 1, 0, 1, H + 2 * p, p + W, 0, p, H + 2 * p);
    }
    return c;
  }

  /** Where the eye is and how the window is zoomed at phase p (0..1) of a cycle; every move returns to its start. */
  function camera(p, a, move) {
    const travel = 0.08 + 0.3 * a;
    const Z = 0.3 + 0.6 * a;
    const s = Math.sin(2 * Math.PI * p), c = Math.cos(2 * Math.PI * p);
    const q = 0.5 - 0.5 * c;
    let ex = 0, ey = 0, zoom = 1, tilt = 0, dz = 0;
    switch (move) {
      case 'dolly': zoom = 1 + 0.22 * (0.5 + a) * q; dz = -0.6 * (0.3 + a) * q; break;
      case 'circle': ex = travel * c; ey = travel * 0.6 * s; break;
      case 'drift': ey = travel * s; zoom = 1 + 0.03 * q; break;
      case 'tilt': zoom = 1 + 0.18 * (0.5 + a) * q; tilt = (0.05 + 0.08 * a) * s; ey = travel * 0.4 * s; break;
      default: ex = travel * s; break;
    }
    return { ex, ey, zoom, tilt, dz, Z };
  }

  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = {
      image: null, depth: null, seg: null, subject: null, subjectAlpha: null, bg: null, layers2d: null, win: null, mesh: null,
      move: 'sway', amount: 45, cycles: 1, frame: '9:16', soften: 30,
      t: 0, playing: false, t0: 0, exporting: false, job: null, gl: false, timing: {}
    };

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a photo</strong><span>or drag it here — nothing is uploaded. JPEG, PNG, WebP or HEIC.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Choose a photo');

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const glCanvas = el('canvas', 'aiimg-canvas aiimg-par-canvas');
    glCanvas.setAttribute('aria-label', 'Preview of the 3D clip');
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(glCanvas, stageMsg);
    const transport = el('div', 'aiimg-transport');
    const play = button('▶ Play', 'btn-ghost');
    const scrub = el('input', 'range');
    scrub.type = 'range'; scrub.min = 0; scrub.max = 1000; scrub.step = 1; scrub.value = 0;
    scrub.setAttribute('aria-label', 'Position in the clip');
    const clock = el('span', 'range-val', '0.0 s');
    const change = button('Change photo', 'btn-ghost', () => file.click());
    transport.append(play, scrub, clock, change);
    stageCol.append(stage, transport);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['motion', 'Camera'], ['export', 'Export']]) {
      const b = button(label, 'chip', () => showPane(k));
      b.dataset.pane = k; b.setAttribute('role', 'tab');
      tabs.appendChild(b);
      const p = el('div', 'aiimg-pane'); p.dataset.pane = k; p.hidden = true; p.setAttribute('role', 'tabpanel');
      panes[k] = p;
    }
    side.appendChild(tabs);
    for (const k in panes) side.appendChild(panes[k]);
    studio.append(stageCol, side);
    const msg = el('div', 'io-msg');
    wrap.append(drop, file, studio, msg);
    io.appendChild(wrap);

    function showPane(k) {
      for (const b of tabs.children) { const onIt = b.dataset.pane === k; b.classList.toggle('is-on', onIt); b.setAttribute('aria-selected', onIt ? 'true' : 'false'); }
      for (const p in panes) panes[p].hidden = p !== k;
    }
    function say(text, kind) { msg.textContent = text || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); }
    function note(text) { stageMsg.textContent = text || ''; stageMsg.hidden = !text; }

    /* ---------------- WebGL ---------------- */
    let gl = null, G = null, ctx2d = null;
    function initGL() {
      if (gl) return true;
      const opts = { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false, depth: true, powerPreference: 'high-performance' };
      try { gl = glCanvas.getContext('webgl', opts) || glCanvas.getContext('experimental-webgl', opts); } catch (e) { gl = null; }
      if (!gl) return false;
      try {
        G = {
          mesh: program(gl, VS_MESH, FS_MESH), bg: program(gl, VS_BG, FS_BG),
          texImg: gl.createTexture(), texBg: gl.createTexture(),
          bufUv: gl.createBuffer(), bufZ: gl.createBuffer(), bufE: gl.createBuffer(), bufIdx: gl.createBuffer(), bufQuad: gl.createBuffer(), n: 0
        };
        G.a = { uv: gl.getAttribLocation(G.mesh, 'aUv'), z: gl.getAttribLocation(G.mesh, 'aZ'), e: gl.getAttribLocation(G.mesh, 'aE') };
        G.u = {};
        for (const u of ['uPlane', 'uWin', 'uHalf', 'uEye', 'uTilt', 'uZ', 'uEdge', 'uTex', 'uBg']) G.u[u] = gl.getUniformLocation(G.mesh, u);
        G.ab = { pos: gl.getAttribLocation(G.bg, 'aPos'), uv: gl.getAttribLocation(G.bg, 'aUv') };
        G.ub = { tex: gl.getUniformLocation(G.bg, 'uTex') };
      } catch (e) { gl = null; G = null; return false; }
      glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); say('The graphics context was lost. Reload the page and try again, with fewer other tabs open.', 'error'); S.playing = false; });
      S.gl = true;
      return true;
    }
    function texture(tex, src) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    /** The mesh from the (softened) depth: uv, z = depth − 0.5, and how steep the depth is at each vertex. */
    function buildMesh() {
      const D = S.depth, img = S.image;
      const r = Math.round(S.soften / 100 * 4);
      const soft = boxBlur(D.data, D.w, D.h, r);
      const landscape = img.width >= img.height;
      const nx = landscape ? GRID : Math.max(8, Math.round(GRID * img.width / img.height));
      const ny = landscape ? Math.max(8, Math.round(GRID * img.height / img.width)) : GRID;
      const vw = nx + 1, vh = ny + 1, N = vw * vh;
      const uv = new Float32Array(N * 2), z = new Float32Array(N), e = new Float32Array(N);
      const samp = (u, v) => {
        const x = clamp(u * (D.w - 1), 0, D.w - 1), y = clamp(v * (D.h - 1), 0, D.h - 1);
        const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(D.w - 1, x0 + 1), y1 = Math.min(D.h - 1, y0 + 1), fx = x - x0, fy = y - y0;
        return (soft[y0 * D.w + x0] * (1 - fx) + soft[y0 * D.w + x1] * fx) * (1 - fy) + (soft[y1 * D.w + x0] * (1 - fx) + soft[y1 * D.w + x1] * fx) * fy;
      };
      const du = 1 / nx, dv = 1 / ny;
      for (let j = 0, k = 0; j < vh; j++) {
        for (let i = 0; i < vw; i++, k++) {
          const u = i * du, v = j * dv;
          uv[k * 2] = u; uv[k * 2 + 1] = v;
          z[k] = samp(u, v) - 0.5;
          const gx = Math.abs(samp(Math.min(1, u + du), v) - samp(Math.max(0, u - du), v));
          const gy = Math.abs(samp(u, Math.min(1, v + dv)) - samp(u, Math.max(0, v - dv)));
          e[k] = Math.max(gx, gy);
        }
      }
      const idx = new Uint16Array(nx * ny * 6);
      for (let j = 0, q = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const a = j * vw + i, b = a + 1, c = a + vw, d = c + 1;
          idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
        }
      }
      S.mesh = { nx, ny, N, uv, z, e, idx, soft };
      if (gl) {
        gl.bindBuffer(gl.ARRAY_BUFFER, G.bufUv); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, G.bufZ); gl.bufferData(gl.ARRAY_BUFFER, z, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, G.bufE); gl.bufferData(gl.ARRAY_BUFFER, e, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, G.bufIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
        G.n = idx.length;
      }
    }

    /** What shows through a gap: the picture softened, and behind the subject an inpaint-by-blur of the background alone. */
    function buildBackground() {
      const D = S.depth;
      const bw = D.w, bh = D.h, L = Math.max(bw, bh);
      const r = Math.max(2, Math.round(L * 0.015)), p = r * 3 + 2;
      const c = el('canvas'); c.width = bw; c.height = bh;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      const pad = padded(S.image.canvas, bw, bh, p);
      x.filter = 'blur(' + r + 'px)';
      x.drawImage(pad, -p, -p);
      x.filter = 'none';
      free(pad);
      if (S.subjectAlpha && S.subjectAlpha.length === bw * bh) {
        const inv = new Float32Array(S.subjectAlpha.length);
        for (let i = 0; i < inv.length; i++) inv[i] = 1 - S.subjectAlpha[i];
        const m = A.maskCanvas(inv, bw, bh);
        const bgOnly = el('canvas'); bgOnly.width = bw; bgOnly.height = bh;
        const bx = bgOnly.getContext('2d');
        bx.drawImage(S.image.canvas, 0, 0, bw, bh);
        bx.globalCompositeOperation = 'destination-in';
        bx.drawImage(m, 0, 0);
        const fill = el('canvas'); fill.width = bw; fill.height = bh;
        const fx = fill.getContext('2d');
        fx.filter = 'blur(' + (r * 3) + 'px)';
        fx.drawImage(bgOnly, 0, 0);
        fx.filter = 'none';
        x.drawImage(fill, 0, 0); x.drawImage(fill, 0, 0);
        free(m); free(bgOnly); free(fill);
      }
      free(S.bg);
      S.bg = c;
      if (gl) texture(G.texBg, c);
      S.layers2d = null;
    }

    /** The crop: the biggest rectangle of the frame's shape inside the picture, a little inset, centred on the subject. */
    function computeWindow() {
      const img = S.image;
      const L = Math.max(img.width, img.height), ax = img.width / L, ay = img.height / L;
      const [fw, fh] = FRAMES[S.frame];
      const r = fw / fh;
      let hw = ax, hh = ax / r;
      if (hh > ay) { hh = ay; hw = ay * r; }
      hw *= 0.94; hh *= 0.94;
      let cx = 0, cy = 0;
      if (S.subject) { cx = (S.subject.u * 2 - 1) * ax; cy = (1 - S.subject.v * 2) * ay; }
      cx = hw < ax ? clamp(cx, -ax + hw, ax - hw) : 0;
      cy = hh < ay ? clamp(cy, -ay + hh, ay - hh) : 0;
      S.win = { cx, cy, hw, hh, ax, ay };
    }

    const phase = (t) => ((((t % DURATION) + DURATION) % DURATION) / DURATION * S.cycles) % 1;

    function renderGL(t, W, H) {
      if (glCanvas.width !== W || glCanvas.height !== H) { glCanvas.width = W; glCanvas.height = H; }
      gl.viewport(0, 0, W, H);
      const cam = camera(phase(t), S.amount / 100, S.move);
      const win = S.win;
      const hw = win.hw / cam.zoom, hh = win.hh / cam.zoom;
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      /* the far filler: the softened picture over a window 12% larger than the frame */
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(G.bg);
      const m = 1.12;
      const x0 = win.cx - hw * m, x1 = win.cx + hw * m, y0 = win.cy - hh * m, y1 = win.cy + hh * m;
      const toU = (x) => (x / win.ax + 1) / 2, toV = (y) => (1 - y / win.ay) / 2;
      const quad = new Float32Array([-m, -m, toU(x0), toV(y0), m, -m, toU(x1), toV(y0), -m, m, toU(x0), toV(y1), m, m, toU(x1), toV(y1)]);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.bufQuad);
      gl.bufferData(gl.ARRAY_BUFFER, quad, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(G.ab.pos); gl.vertexAttribPointer(G.ab.pos, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(G.ab.uv); gl.vertexAttribPointer(G.ab.uv, 2, gl.FLOAT, false, 16, 8);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.texBg); gl.uniform1i(G.ub.tex, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      /* the mesh */
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
      gl.useProgram(G.mesh);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.bufUv); gl.enableVertexAttribArray(G.a.uv); gl.vertexAttribPointer(G.a.uv, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.bufZ); gl.enableVertexAttribArray(G.a.z); gl.vertexAttribPointer(G.a.z, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.bufE); gl.enableVertexAttribArray(G.a.e); gl.vertexAttribPointer(G.a.e, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, G.bufIdx);
      gl.uniform2f(G.u.uPlane, win.ax, win.ay);
      gl.uniform2f(G.u.uWin, win.cx, win.cy);
      gl.uniform2f(G.u.uHalf, hw, hh);
      gl.uniform3f(G.u.uEye, win.cx + cam.ex, win.cy + cam.ey, EYE_D + cam.dz);
      gl.uniform1f(G.u.uTilt, cam.tilt);
      gl.uniform1f(G.u.uZ, cam.Z);
      gl.uniform1f(G.u.uEdge, 0.3 - 0.22 * S.soften / 100);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.texImg); gl.uniform1i(G.u.uTex, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, G.texBg); gl.uniform1i(G.u.uBg, 1);
      gl.drawElements(gl.TRIANGLES, G.n, gl.UNSIGNED_SHORT, 0);
    }

    /* ---------------- the 2D fallback: depth bands sliding at different speeds ---------------- */
    const BANDS2D = 5;
    function build2D() {
      const D = S.depth, img = S.image;
      const s = Math.min(1, 1024 / Math.max(img.width, img.height));
      const lw = Math.max(1, Math.round(img.width * s)), lh = Math.max(1, Math.round(img.height * s));
      const layers = [];
      for (let k = 0; k < BANDS2D; k++) {
        const a = new Float32Array(D.data.length);
        for (let i = 0; i < a.length; i++) { const b = D.data[i] * (BANDS2D - 1) - k; a[i] = Math.max(0, 1 - Math.abs(b)); }
        const m = A.maskCanvas(a, D.w, D.h);
        const c = el('canvas'); c.width = lw; c.height = lh;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        x.drawImage(m, 0, 0, lw, lh);
        x.globalCompositeOperation = 'source-in';
        x.drawImage(img.canvas, 0, 0, lw, lh);
        free(m);
        layers.push(c);
      }
      S.layers2d = layers;
    }
    function render2D(ctx, W, H, t) {
      if (!S.layers2d) build2D();
      const cam = camera(phase(t), S.amount / 100, S.move);
      const win = S.win;
      const hw = win.hw / cam.zoom, hh = win.hh / cam.zoom;
      const sx = W / (2 * hw), sy = H / (2 * hh);
      const ex = win.cx + cam.ex, ey = win.cy + cam.ey, D = EYE_D + cam.dz;
      ctx.save();
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const place = (src, z) => {
        const k = D / Math.max(D - z, 0.05);
        const X0 = ex + (-win.ax - ex) * k, X1 = ex + (win.ax - ex) * k;
        const Y0 = ey + (win.ay - ey) * k, Y1 = ey + (-win.ay - ey) * k;
        ctx.drawImage(src, (X0 - (win.cx - hw)) * sx, ((win.cy + hh) - Y0) * sy, (X1 - X0) * sx, (Y0 - Y1) * sy);
      };
      if (S.bg) place(S.bg, -cam.Z * 0.5);
      for (let k = 0; k < BANDS2D; k++) place(S.layers2d[k], (k / (BANDS2D - 1) - 0.5) * cam.Z);
      ctx.restore();
    }

    /** One frame, by whichever route this browser has. Used for the preview and for every exported frame. */
    function render(ctx, W, H, t) {
      if (gl) { renderGL(t, W, H); if (ctx) ctx.drawImage(glCanvas, 0, 0, W, H); }
      else render2D(ctx || ctx2d, W, H, t);
    }

    /* ---------------- preview loop ---------------- */
    let mounted = true, dirty = false;
    function previewSize() {
      const [fw, fh] = FRAMES[S.frame];
      const s = PREVIEW_LONG / Math.max(fw, fh);
      return { W: Math.round(fw * s), H: Math.round(fh * s) };
    }
    function sizePreview() {
      const { W, H } = previewSize();
      if (glCanvas.width !== W || glCanvas.height !== H) { glCanvas.width = W; glCanvas.height = H; }
      if (!gl && !ctx2d) ctx2d = glCanvas.getContext('2d');
      dirty = true;
    }
    function drawPreview() {
      if (!S.image || !S.depth || !S.win) return;
      const { W, H } = previewSize();
      if (gl) renderGL(S.t, W, H);
      else { if (glCanvas.width !== W || glCanvas.height !== H) { glCanvas.width = W; glCanvas.height = H; } render2D(ctx2d, W, H, S.t); }
    }
    function loop(now) {
      if (!mounted) return;
      if (!S.exporting && S.depth) {
        if (S.playing) {
          S.t = ((now - S.t0) / 1000) % DURATION;
          scrub.value = Math.round(S.t / DURATION * 1000);
          clock.textContent = S.t.toFixed(1) + ' s';
          dirty = true;
        }
        if (dirty) { drawPreview(); dirty = false; }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    function setPlaying(v) {
      S.playing = v;
      if (v) S.t0 = performance.now() - S.t * 1000;
      play.textContent = v ? '❚❚ Pause' : '▶ Play';
      play.setAttribute('aria-pressed', v ? 'true' : 'false');
    }
    play.addEventListener('click', () => setPlaying(!S.playing));
    scrub.addEventListener('input', () => { setPlaying(false); S.t = Number(scrub.value) / 1000 * DURATION; clock.textContent = S.t.toFixed(1) + ' s'; dirty = true; });

    /* ---------------- camera pane ---------------- */
    const status = el('p', 'aiimg-status', 'Choose a photo to begin.');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    const frames = el('div', 'aiimg-par-frames');
    for (const k in FRAMES) {
      const b = button(FRAMES[k][2], 'chip' + (k === S.frame ? ' is-on' : ''), () => { S.frame = k; for (const c of frames.children) c.classList.toggle('is-on', c.dataset.frame === k); if (S.image) { computeWindow(); sizePreview(); } });
      b.dataset.frame = k;
      frames.appendChild(b);
    }
    const moveSel = on(select('aiimg-par-move', MOVES, S.move), () => { S.move = moveSel.value; dirty = true; });
    const amountCtl = on(range('aiimg-par-amount', 5, 100, 1, S.amount, (v) => v + '%'), () => { S.amount = Number(amountCtl.input.value); dirty = true; });
    const cyclesSel = on(select('aiimg-par-cycles', [[1, '1 — once in six seconds'], [2, '2 — twice'], [3, '3 — three times']], S.cycles), () => { S.cycles = Number(cyclesSel.value); dirty = true; });
    const softenCtl = on(range('aiimg-par-soften', 0, 100, 5, S.soften, (v) => v + '%'), () => { S.soften = Number(softenCtl.input.value); if (S.depth) { buildMesh(); dirty = true; } });
    const h = (t) => el('p', 'aiimg-h', t);
    const grid = (...fields) => { const g = el('div', 'aiimg-grid2'); g.append(...fields); return g; };
    const glNote = el('p', 'aiimg-par-note', ''); glNote.hidden = true;
    panes.motion.append(status, progress, glNote,
      h('Frame'), frames,
      h('Camera'),
      field('Move', moveSel),
      grid(field('Amount', amountCtl), field('Cycles per clip', cyclesSel)),
      el('p', 'field-hint', 'Every move is a cycle that returns to its start, so the six-second clip loops without a join. Press Play under the preview to watch it.'),
      h('Edges'),
      field('Edge softening', softenCtl, 'Blends the pixels that stretch across a depth edge into the soft background behind them. Raise it if edges tear; lower it for crisper outlines.'));

    /* ---------------- analysis ---------------- */
    let runToken = 0;
    async function analyse() {
      const img = S.image; if (!img) return;
      const token = ++runToken;
      progress.hidden = false; bar.style.width = '0%';
      status.textContent = 'Preparing the depth model…';
      note('Estimating depth…');
      try {
        const t0 = performance.now();
        const depth = await A.depth.estimate(img, { onProgress: (p) => {
          if (token !== runToken) return;
          if (p.stage === 'download') {
            status.textContent = 'Downloading the depth model once' + (p.total ? ' — ' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) : '') + '. Your browser keeps it for next time.';
            bar.style.width = Math.round(p.fraction * 50) + '%';
          } else if (p.stage === 'run') {
            status.textContent = 'Estimating depth on your device…';
            bar.style.width = Math.round(50 + p.fraction * 50) + '%';
          }
        } });
        if (token !== runToken) return;
        S.depth = depth; S.timing.depth = performance.now() - t0; S.timing.model = depth.ms;
        if (gl) texture(G.texImg, img.canvas);
        buildBackground();
        buildMesh();
        computeWindow();
        sizePreview();
        progress.hidden = true;
        status.textContent = 'Depth ready';
        note('');
        S.t = 0; setPlaying(true);
        /* the subject, for the framing and the fill behind it; the preview is already running */
        const t1 = performance.now();
        try {
          const seg = await A.segment(img, { detail: 'standard' });
          if (token !== runToken) return;
          S.seg = seg; S.timing.seg = performance.now() - t1;
          const people = seg.layers.filter((l) => l.label === 'person');
          const pick = people.length ? people : seg.layers.filter((l) => l.subject).slice(0, 1);
          if (pick.length && seg.mw === depth.w && seg.mh === depth.h) {
            const keep = new Set(pick.map((l) => l.key));
            const bin = new Float32Array(seg.mw * seg.mh);
            let x0 = seg.mw, y0 = seg.mh, x1 = -1, y1 = -1;
            for (let i = 0, y = 0; y < seg.mh; y++) for (let x = 0; x < seg.mw; x++, i++) if (keep.has(seg.classMap[i])) { bin[i] = 1; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
            S.subject = { u: (x0 + x1) / 2 / seg.mw, v: (y0 + y1) / 2 / seg.mh, name: pick[0].name };
            await sleep(0);
            if (token !== runToken) return;
            S.subjectAlpha = A.refine(bin, A.guideOf(img, seg.mw, seg.mh), { softness: 2, shift: 1 });
            buildBackground();
            computeWindow();
            dirty = true;
            status.textContent = 'Framed on ' + pick[0].name.toLowerCase() + ' · depth and subject ready';
          } else {
            status.textContent = 'No person or object found to frame on, so the frame is centred · depth ready';
          }
        } catch (e) {
          if (token !== runToken) return;
          status.textContent = 'The subject could not be found, so the frame is centred · depth ready';
        }
      } catch (e) {
        if (token !== runToken) return;
        status.textContent = 'Depth could not be estimated.';
        say((e && e.message) || String(e), 'error');
      } finally {
        if (token === runToken) { progress.hidden = true; note(''); }
      }
    }

    /* ---------------- loading ---------------- */
    async function loadFiles(files) {
      const f = files && files[0]; if (!f) return;
      try {
        say(''); note('Reading the photo…');
        let img = await A.loadImageFile(f);
        if (Math.max(img.width, img.height) > WORK_MAX) {
          const s = WORK_MAX / Math.max(img.width, img.height);
          const c = A.scaled(img.canvas, img.width * s, img.height * s);
          free(img.canvas);
          img = Object.assign({}, img, { canvas: c, width: c.width, height: c.height });
        }
        runToken++;
        setPlaying(false);
        if (S.layers2d) S.layers2d.forEach(free);
        free(S.bg);
        S.image = img; S.depth = null; S.seg = null; S.subject = null; S.subjectAlpha = null; S.bg = null; S.layers2d = null; S.mesh = null; S.win = null; S.t = 0;
        results.innerHTML = '';
        studio.hidden = false; drop.hidden = true;
        if (!initGL()) {
          glNote.hidden = false;
          glNote.textContent = 'WebGL is not available in this browser, so the clip is drawn from a few depth layers on a plain canvas instead of the full 3D mesh.';
          ctx2d = glCanvas.getContext('2d');
        }
        sizePreview();
        showPane('motion');
        analyse();
      } catch (e) {
        note('');
        say((e && e.message) || String(e), 'error');
      }
    }
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    wrap.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
    file.addEventListener('change', () => { if (file.files.length) loadFiles(file.files); file.value = ''; });

    /* ---------------- export ---------------- */
    const clipFmt = on(select('aiimg-par-clip-fmt', [['mp4', 'MP4 video (H.264)'], ['gif', 'Animated GIF']], 'mp4'), () => { syncClipOptions(); });
    const clipSize = select('aiimg-par-clip-size', [], '1080');
    const clipBtn = button('Export the 6-second loop', 'btn-primary', exportClip);
    const cancelBtn = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); cancelBtn.hidden = true;
    const clipProgress = el('div', 'aiimg-progress'); const clipBar = el('i'); clipProgress.appendChild(clipBar); clipProgress.hidden = true;
    const clipStatus = el('p', 'aiimg-status', ''); clipStatus.hidden = true;
    const results = el('div', 'aiimg-results');
    const clipRow = el('div', 'aiimg-row'); clipRow.append(clipBtn, cancelBtn);
    function fillSelect(sel, options, value) { sel.innerHTML = ''; for (const [v, l] of options) { const op = el('option', null, l); op.value = v; sel.appendChild(op); } sel.value = options.some((o) => String(o[0]) === String(value)) ? value : options[0][0]; }
    function syncClipOptions() {
      const gif = clipFmt.value === 'gif';
      fillSelect(clipSize, gif ? [['480', '480 px'], ['560', '560 px'], ['640', '640 px'], ['720', '720 px — large files']] : [['1080', '1080 — Full HD (1080×1920, 1080×1080 or 1920×1080)'], ['720', '720 — HD, quicker on a phone']], gif ? '480' : '1080');
    }
    syncClipOptions();
    panes.export.append(
      h('Clip'),
      grid(field('Format', clipFmt), field('Size', clipSize)),
      el('p', 'field-hint', 'Six seconds in the frame chosen under Camera, 30 frames a second for MP4 and 15 for GIF. Encoded on your device: MP4 needs a browser with on-device video encoding (Chrome, Edge, Safari 16.4+); elsewhere the clip is recorded as WebM.'),
      clipRow, clipProgress, clipStatus, results
    );
    function clipSizeFor() {
      const [fw, fh] = FRAMES[S.frame];
      const gif = clipFmt.value === 'gif';
      const want = Number(clipSize.value) || 1080;
      const s = gif ? want / Math.max(fw, fh) : want / Math.min(fw, fh);
      return { width: Math.max(2, Math.round(fw * s / 2) * 2), height: Math.max(2, Math.round(fh * s / 2) * 2) };
    }
    function addResult(blob, name, label, dims) {
      const row = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      const strong = el('strong', null, name);
      const meta = el('span', null, fmtBytes(blob.size) + ' · ' + dims + (label ? ' · ' + label : ''));
      const dl = button('Download', 'btn-download', () => A.download(blob, name));
      head.append(strong, meta, dl);
      row.appendChild(head);
      const url = URL.createObjectURL(blob);
      if (/^image\//.test(blob.type)) { const img = el('img'); img.alt = 'Result preview'; img.src = url; row.appendChild(img); }
      else { const v = el('video'); v.controls = true; v.muted = true; v.loop = true; v.playsInline = true; v.src = url; row.appendChild(v); }
      results.insertBefore(row, results.firstChild);
      return row;
    }
    async function exportClip() {
      if (!S.image || !S.depth || S.job) return;
      const gif = clipFmt.value === 'gif';
      const { width, height } = clipSizeFor();
      const fps = gif ? 15 : 30;
      S.job = new AbortController();
      S.exporting = true;
      const wasPlaying = S.playing; setPlaying(false);
      clipBtn.disabled = true; cancelBtn.hidden = false; clipProgress.hidden = false; clipStatus.hidden = false; clipBar.style.width = '0%';
      clipStatus.textContent = gif ? 'Encoding the GIF…' : 'Encoding the video…';
      const started = performance.now();
      const onProgress = (f) => {
        clipBar.style.width = Math.round(f * 100) + '%';
        const spent = (performance.now() - started) / 1000;
        clipStatus.textContent = (gif ? 'Encoding the GIF' : 'Encoding the video') + ' — ' + Math.round(f * 100) + '%' + (f > 0.05 && f < 1 ? ', about ' + Math.max(1, Math.round(spent / f - spent)) + ' s left' : '') + '.';
      };
      try {
        const o = { width, height, fps, duration: DURATION, onProgress, signal: S.job.signal };
        let blob, ext, noteText;
        if (gif) { blob = await A.encodeGIF(render, o); ext = 'gif'; }
        else { const r = await A.encodeVideo(render, o); blob = r.blob; ext = r.ext; noteText = r.note; }
        S.timing.encode = performance.now() - started;
        const name = (S.image.name || 'image') + '-3d-parallax.' + ext;
        addResult(blob, name, (gif ? 'GIF' : (ext === 'mp4' ? 'MP4' : 'WebM')) + ' · ' + DURATION + ' s · ' + fps + ' fps · loops', width + '×' + height);
        A.download(blob, name);
        clipStatus.textContent = 'Done in ' + ((performance.now() - started) / 1000).toFixed(1) + ' s.';
        if (noteText && /WebM/.test(noteText)) say(noteText, 'warn'); else say('');
      } catch (e) {
        if (e && e.name === 'AbortError') clipStatus.textContent = 'Cancelled.';
        else { clipStatus.textContent = 'The export failed.'; say((e && e.message) || String(e), 'error'); }
      } finally {
        S.job = null; S.exporting = false;
        clipBtn.disabled = false; cancelBtn.hidden = true; clipProgress.hidden = true;
        sizePreview();
        if (wasPlaying) setPlaying(true);
        dirty = true;
      }
    }

    /* ---------------- go ---------------- */
    showPane('motion');
    const inst = { state: S, render, loadFiles, camera, destroy: () => { mounted = false; } };
    A.tools['3d-photo-parallax'].instance = inst;
    return inst;
  }

  A.tools['3d-photo-parallax'] = { mount };
})();
