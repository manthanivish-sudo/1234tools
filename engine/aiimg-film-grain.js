/**
 * Film Grain & VHS Effect.
 *
 * One fragment shader does the look — grain, light leaks, scan lines,
 * tracking, colour fringing, vignette, fade, halation, the CRT frame — on
 * the device's graphics chip; the date stamp is drawn over it on a 2D
 * canvas as seven-segment digits. The same function draws the preview, the
 * still and every frame of a GIF or MP4, so what is exported is what was
 * seen. No model, no download, no upload. Where WebGL is missing, a plain
 * canvas draws a simpler version of the look.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, field, select, range, colour, check, button, fmtBytes } = A;

  const PREVIEW_MAX = 1280;
  const NOISE = 512;          /* side of the random texture the grain is read from */
  const GRAIN_FPS = 24;       /* how often the grain changes while playing */
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };
  const pct = (v) => Math.round(v) + '%';
  const px = (v) => (Math.round(v * 10) / 10) + ' px';
  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  const nowTime = () => { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const hexToRgb = (hex) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || ''); return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1]; };
  const rgbToHex = (c) => '#' + c.map((v) => ('0' + Math.round(clamp(v, 0, 1) * 255).toString(16)).slice(-2)).join('');
  const hexToRgba = (hex, a) => { const c = hexToRgb(hex); return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + a + ')'; };
  /** A well-mixed number in 0..1 for an integer, so a frame always gets the same grain. */
  function hash(n) {
    let x = Math.imul(n | 0, 0x9E3779B1) ^ 0x85EBCA6B;
    x = Math.imul(x ^ (x >>> 15), 0x2C1B3C6D);
    x = Math.imul(x ^ (x >>> 12), 0x297A2D39);
    x ^= x >>> 15;
    return (x >>> 0) / 4294967296;
  }

  /* ------------------------------------------------------------------ */
  /* the look                                                           */
  /* ------------------------------------------------------------------ */
  const DEFAULT = {
    grain: 0.3, grainSize: 1.5, grainColour: 0.3,
    leak: 0.5, leaks: [], leakCount: 0, palette: 'warm',
    scan: 0, scanCount: 300, track: 0, trackWidth: 0.08, trackCycles: 1,
    chroma: 0.5, soft: 0, jitter: 0, dropout: 0,
    vignette: 0.4, fade: 0.2, sat: 1, warm: 0, contrast: 1, mono: 0, tint: [1, 1, 1], halation: 0.2,
    stamp: false, stampColour: '#ff8c1a', stampSize: 1, stampCorner: 'br', showTime: false, date: today(), time: nowTime(),
    crop43: false, corner: 0, curve: 0
  };
  const PRESETS = {
    disposable: { name: 'Disposable', p: { grain: 0.38, grainSize: 1.6, grainColour: 0.35, leak: 0.6, leakCount: 1, palette: 'warm', chroma: 0.7, vignette: 0.45, fade: 0.18, sat: 1.15, warm: 0.35, contrast: 1.08, halation: 0.25, stamp: true, crop43: true } },
    vhs: { name: 'VHS 1994', p: { grain: 0.22, grainSize: 1.2, grainColour: 0.5, leak: 0, scan: 0.35, scanCount: 260, track: 0.6, trackWidth: 0.07, chroma: 2.2, soft: 1.6, jitter: 2, dropout: 0.6, vignette: 0.3, fade: 0.25, sat: 0.85, warm: 0.1, contrast: 1.02, halation: 0.15, stamp: true, showTime: true, crop43: true, corner: 0.05, curve: 0.3 } },
    super8: { name: 'Super 8', p: { grain: 0.5, grainSize: 2.2, grainColour: 0.15, leak: 0.4, leakCount: 2, palette: 'warm', chroma: 0.8, soft: 1, jitter: 3, vignette: 0.6, fade: 0.35, sat: 0.9, warm: 0.5, contrast: 1.1, halation: 0.4, crop43: true, corner: 0.09 } },
    polaroid: { name: 'Faded Polaroid', p: { grain: 0.15, grainSize: 1.8, grainColour: 0.2, leak: 0.3, leakCount: 1, palette: 'pale', chroma: 0.3, vignette: 0.35, fade: 0.7, sat: 0.7, warm: 0.25, contrast: 0.9, tint: [1, 0.98, 0.9], halation: 0.2 } },
    cinematic: { name: 'Cinematic grain', p: { grain: 0.3, grainSize: 1.4, grainColour: 0.1, leak: 0, chroma: 0.4, vignette: 0.5, fade: 0.15, sat: 0.8, warm: -0.15, contrast: 1.15, halation: 0.3 } },
    nightvision: { name: 'Night-vision green', p: { grain: 0.55, grainSize: 1.2, grainColour: 0, leak: 0, scan: 0.4, scanCount: 320, chroma: 0, vignette: 0.75, fade: 0.1, sat: 1, contrast: 1.2, mono: 1, tint: [0.3, 1, 0.35], halation: 0.5, stamp: true, showTime: true, stampColour: '#7dff7d', corner: 0.12 } },
    kodachrome: { name: 'Kodachrome', p: { grain: 0.18, grainSize: 1.3, grainColour: 0.25, leak: 0, chroma: 0.3, vignette: 0.3, fade: 0.1, sat: 1.3, warm: 0.3, contrast: 1.12, tint: [1.03, 0.99, 0.95], halation: 0.2 } }
  };
  const PALETTES = {
    warm: [[1, 0.45, 0.1], [1, 0.25, 0.15], [1, 0.75, 0.2], [1, 0.3, 0.5]],
    pale: [[0.45, 0.8, 1], [0.95, 0.55, 0.9], [1, 0.85, 0.6]]
  };
  const RANGES = { grain: [0, 1], grainSize: [1, 4], grainColour: [0, 1], leak: [0, 1], scan: [0, 1], track: [0, 1], chroma: [0, 6], soft: [0, 4], jitter: [0, 8], dropout: [0, 1], vignette: [0, 1], fade: [0, 1], sat: [0, 2], warm: [-1, 1], contrast: [0.7, 1.4], halation: [0, 1], corner: [0, 0.2], curve: [0, 1] };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /** A leak at an edge of the frame: a soft ellipse of coloured light, elongated along that edge. */
  function makeLeak(paletteKey) {
    const pal = PALETTES[paletteKey] || PALETTES.warm;
    const side = Math.floor(Math.random() * 4);
    const along = 0.1 + Math.random() * 0.8;
    const L = { r: 0.28 + Math.random() * 0.3, s: 0.55 + Math.random() * 0.45, col: pal[Math.floor(Math.random() * pal.length)] };
    if (side === 0) { L.x = -0.08; L.y = along; L.e = 0.35 + Math.random() * 0.3; }
    else if (side === 1) { L.x = 1.08; L.y = along; L.e = 0.35 + Math.random() * 0.3; }
    else if (side === 2) { L.x = along; L.y = -0.1; L.e = 1.8 + Math.random() * 1.2; }
    else { L.x = along; L.y = 1.1; L.e = 1.8 + Math.random() * 1.2; }
    return L;
  }
  function withLeaks(p) { p.leaks = []; for (let i = 0; i < (p.leakCount || 0); i++) p.leaks.push(makeLeak(p.palette)); return p; }
  function fromPreset(key, keep) {
    const p = Object.assign(clone(DEFAULT), clone(PRESETS[key].p));
    if (keep) { p.date = keep.date; p.time = keep.time; }
    return withLeaks(p);
  }
  /** The same preset, rolled: every amount it uses nudged, the leaks re-cast. */
  function roll(key, keep) {
    const p = fromPreset(key, keep);
    const jit = (k, amt) => { const v = p[k]; if (!v) return; const [lo, hi] = RANGES[k]; p[k] = clamp(v * (1 + (Math.random() * 2 - 1) * amt), lo, hi); };
    const shift = (k, amt) => { const [lo, hi] = RANGES[k]; p[k] = clamp(p[k] + (Math.random() * 2 - 1) * amt, lo, hi); };
    ['grain', 'grainSize', 'grainColour', 'leak', 'scan', 'track', 'chroma', 'soft', 'jitter', 'dropout', 'vignette', 'fade', 'halation', 'curve'].forEach((k) => jit(k, 0.4));
    shift('sat', 0.15); shift('warm', 0.2); shift('contrast', 0.08);
    if (p.corner) jit('corner', 0.3);
    p.scanCount = Math.round(p.scanCount * (0.8 + Math.random() * 0.5));
    p.trackWidth = clamp(p.trackWidth * (0.6 + Math.random() * 0.9), 0.02, 0.25);
    return p;
  }

  /* ------------------------------------------------------------------ */
  /* the shader                                                         */
  /* ------------------------------------------------------------------ */
  const VS = 'attribute vec2 aPos; varying vec2 vUv; void main() { vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }';
  const FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'varying vec2 vUv;',
    'uniform sampler2D uImage; uniform sampler2D uNoise;',
    'uniform vec2 uRes; uniform vec2 uCropOff; uniform vec2 uCropScale;',
    'uniform float uTime; uniform float uSeed; uniform vec2 uNoiseOff;',
    'uniform float uGrain; uniform float uGrainSize; uniform float uGrainColour;',
    'uniform float uLeak; uniform vec4 uLeakA0; uniform vec4 uLeakB0; uniform vec4 uLeakA1; uniform vec4 uLeakB1; uniform vec4 uLeakA2; uniform vec4 uLeakB2;',
    'uniform float uScan; uniform float uScanCount; uniform float uTrack; uniform float uTrackPos; uniform float uTrackWidth;',
    'uniform float uChroma; uniform float uSoft; uniform float uJitter; uniform float uDropout;',
    'uniform float uVignette; uniform float uFade; uniform float uSat; uniform float uWarm; uniform float uContrast; uniform float uMono; uniform vec3 uTint; uniform float uHalation;',
    'uniform float uCorner; uniform float uCurve;',
    'float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }',
    'float rnd(vec2 p) { return texture2D(uNoise, p).r; }',
    'vec3 tap(vec2 p) { return texture2D(uImage, clamp(p, uCropOff + 0.0005, uCropOff + uCropScale - 0.0005)).rgb; }',
    'vec3 soft(vec2 p, vec2 px) {',
    '  if (uSoft <= 0.01) return tap(p);',
    '  vec2 d = vec2(uSoft * px.x, 0.0);',
    '  return (tap(p - d) + tap(p - 0.5 * d) + tap(p) + tap(p + 0.5 * d) + tap(p + d)) * 0.2;',
    '}',
    'void main() {',
    '  vec2 uv = vUv;',
    /* the CRT: a little barrel curve, rounded corners, black beyond */
    '  vec2 p = uv * 2.0 - 1.0;',
    '  p *= 1.0 + uCurve * 0.09 * dot(p, p);',
    '  vec2 q = abs(p) - (1.0 - uCorner);',
    '  float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uCorner;',
    '  float mask = 1.0 - smoothstep(-0.003, 0.003, dist);',
    '  uv = p * 0.5 + 0.5;',
    /* the whole frame jumps a little every frame */
    '  uv.y += uJitter / uRes.y * (rnd(vec2(uSeed, 0.37)) - 0.5) * 2.0;',
    /* the tracking band: rows torn sideways, drifting up the picture */
    '  float band = abs(fract(uv.y - uTrackPos + 0.5) - 0.5);',
    '  float e = 1.0 - smoothstep(0.0, uTrackWidth, band);',
    '  float rowN = rnd(vec2(floor(uv.y * uRes.y * 0.5) * 0.0021 + uSeed, uSeed * 0.71));',
    '  float dx = e * uTrack * ((rowN - 0.5) * 0.16 + 0.04 * sin(uv.y * 40.0 + uTime * 7.0));',
    '  dx += uTrack * 0.004 * sin(uv.y * 25.0 + uTime * 5.0) * rnd(vec2(uSeed * 0.3, 0.11));',
    '  uv.x += dx;',
    /* into the picture: the three channels a little apart, each softened sideways */
    '  vec2 iuv = uCropOff + uv * uCropScale;',
    '  vec2 px = uCropScale / uRes;',
    '  vec2 co = vec2(uChroma * px.x, 0.0);',
    '  vec3 c;',
    '  c.r = soft(iuv + co, px).r;',
    '  c.g = soft(iuv, px).g;',
    '  c.b = soft(iuv - co, px).b;',
    /* colour */
    '  float l = lum(c);',
    '  c = mix(c, vec3(l), uMono);',
    '  c *= uTint;',
    '  c.r *= 1.0 + 0.14 * uWarm; c.b *= 1.0 - 0.14 * uWarm;',
    '  l = lum(c);',
    '  c = mix(vec3(l), c, uSat);',
    '  c = (c - 0.5) * uContrast + 0.5;',
    '  c = c * (1.0 - 0.2 * uFade) + 0.13 * uFade;',
    '  c += uFade * 0.05 * vec3(-0.3, 0.05, 0.35) * (1.0 - l);',
    /* halation: the highlights around this pixel glow into it */
    '  if (uHalation > 0.001) {',
    '    float rp = 0.02 * uRes.y;',
    '    float halo = 0.0;',
    '    for (int i = 0; i < 12; i++) {',
    '      float a = float(i) * 0.5236;',
    '      vec2 o = vec2(cos(a) * rp / uRes.x, sin(a) * rp / uRes.y) * uCropScale;',
    '      halo += max(lum(tap(iuv + o)) - 0.62, 0.0);',
    '    }',
    '    halo /= 12.0 * 0.38;',
    '    c += uHalation * halo * mix(vec3(1.0, 0.55, 0.3), uTint, uMono) * 0.9;',
    '  }',
    /* light leaks, screened over the picture */
    '  vec3 leak = vec3(0.0);',
    '  vec2 asp = vec2(uRes.x / uRes.y, 1.0);',
    '  { vec2 d = (uv - uLeakA0.xy) * asp; d.y *= uLeakB0.w; leak += uLeakB0.rgb * uLeakA0.w * exp(-dot(d, d) / (uLeakA0.z * uLeakA0.z)); }',
    '  { vec2 d = (uv - uLeakA1.xy) * asp; d.y *= uLeakB1.w; leak += uLeakB1.rgb * uLeakA1.w * exp(-dot(d, d) / (uLeakA1.z * uLeakA1.z)); }',
    '  { vec2 d = (uv - uLeakA2.xy) * asp; d.y *= uLeakB2.w; leak += uLeakB2.rgb * uLeakA2.w * exp(-dot(d, d) / (uLeakA2.z * uLeakA2.z)); }',
    '  leak = clamp(leak * uLeak, 0.0, 1.0);',
    '  c = 1.0 - (1.0 - c) * (1.0 - leak);',
    /* the band is noisy, bright and drained of colour */
    '  c += e * uTrack * (rowN - 0.5) * 0.5;',
    '  c = mix(c, vec3(lum(c)), e * uTrack * 0.6);',
    /* dropouts: short white dashes on the odd row */
    '  if (uDropout > 0.001) {',
    '    float row = floor(uv.y * uRes.y);',
    '    float rn = rnd(vec2(row * 0.0137 + uSeed * 0.5, 0.63 + uSeed * 0.2));',
    '    if (rn > 1.0 - uDropout * 0.02) {',
    '      float sx = rnd(vec2(row * 0.0071 + 0.2, uSeed));',
    '      float len = 0.02 + 0.1 * rnd(vec2(row * 0.0031 + 0.7, uSeed * 0.9));',
    '      if (uv.x > sx && uv.x < sx + len) c = mix(c, vec3(1.0), 0.8);',
    '    }',
    '  }',
    /* scan lines, vignette */
    '  c *= 1.0 - uScan * 0.45 * (0.5 + 0.5 * sin(uv.y * uScanCount * 6.28318));',
    '  float vd = distance(uv, vec2(0.5)) * 1.41421;',
    '  c *= 1.0 - uVignette * smoothstep(0.35, 1.15, vd);',
    /* grain: two reads of the random texture, strongest in the mid-tones */
    '  vec2 gp = (gl_FragCoord.xy / uGrainSize + uNoiseOff) / ' + NOISE + '.0;',
    '  vec3 n1 = texture2D(uNoise, gp).rgb;',
    '  vec3 n2 = texture2D(uNoise, gp * 1.73 + vec2(0.31, 0.57)).rgb;',
    '  vec3 g = n1 + n2 - 1.0;',
    '  vec3 grain = mix(vec3(g.r), g, uGrainColour);',
    '  float lg = lum(clamp(c, 0.0, 1.0));',
    '  float wgt = 1.0 - 0.65 * abs(2.0 * lg - 1.0);',
    '  c += grain * uGrain * 0.55 * wgt;',
    '  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) mask = 0.0;',
    '  gl_FragColor = vec4(clamp(c, 0.0, 1.0) * mask, 1.0);',
    '}'
  ].join('\n');
  const UNIFORMS = ['uImage', 'uNoise', 'uRes', 'uCropOff', 'uCropScale', 'uTime', 'uSeed', 'uNoiseOff', 'uGrain', 'uGrainSize', 'uGrainColour',
    'uLeak', 'uLeakA0', 'uLeakB0', 'uLeakA1', 'uLeakB1', 'uLeakA2', 'uLeakB2', 'uScan', 'uScanCount', 'uTrack', 'uTrackPos', 'uTrackWidth',
    'uChroma', 'uSoft', 'uJitter', 'uDropout', 'uVignette', 'uFade', 'uSat', 'uWarm', 'uContrast', 'uMono', 'uTint', 'uHalation', 'uCorner', 'uCurve'];

  /** Where the frame sits in the picture: all of it, or the centred 4:3. */
  function cropOf(iw, ih, P) {
    let sx = 1, sy = 1, ox = 0, oy = 0;
    if (P.crop43) {
      const a = iw / ih, target = 4 / 3;
      if (a > target) { sx = target / a; ox = (1 - sx) / 2; }
      else if (a < target) { sy = a / target; oy = (1 - sy) / 2; }
    }
    return { sx, sy, ox, oy };
  }

  function makeGL() {
    const canvas = el('canvas');
    const opts = { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false, depth: false, stencil: false };
    const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return null;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('program: ' + gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    for (const n of UNIFORMS) U[n] = gl.getUniformLocation(prog, n);
    const noise = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, noise);
    const nd = new Uint8Array(NOISE * NOISE * 4);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 256;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, NOISE, NOISE, 0, gl.RGBA, gl.UNSIGNED_BYTE, nd);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U.uImage, 0);
    gl.uniform1i(U.uNoise, 1);
    const G = { canvas, gl, iw: 1, ih: 1, lost: false };
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); G.lost = true; });
    G.setImage = function (src) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      G.iw = src.width; G.ih = src.height;
    };
    /** One frame of W×H at time t into the GL canvas. */
    G.draw = function (P, W, H, t, frame, D) {
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      gl.viewport(0, 0, W, H);
      gl.useProgram(prog);
      const c = cropOf(G.iw, G.ih, P);
      gl.uniform2f(U.uRes, W, H);
      gl.uniform2f(U.uCropOff, c.ox, c.oy);
      gl.uniform2f(U.uCropScale, c.sx, c.sy);
      gl.uniform1f(U.uTime, t);
      gl.uniform1f(U.uSeed, hash(frame * 3 + 1));
      gl.uniform2f(U.uNoiseOff, Math.floor(hash(frame * 3 + 2) * NOISE), Math.floor(hash(frame * 3 + 3) * NOISE));
      gl.uniform1f(U.uGrain, P.grain);
      gl.uniform1f(U.uGrainSize, Math.max(1, P.grainSize));
      gl.uniform1f(U.uGrainColour, P.grainColour);
      const breathe = 1 + 0.12 * Math.sin(2 * Math.PI * t / Math.max(0.5, D)) + 0.08 * (hash(frame * 5 + 7) - 0.5);
      gl.uniform1f(U.uLeak, P.leak * breathe);
      for (let i = 0; i < 3; i++) {
        const L = P.leaks[i] || { x: -9, y: -9, r: 0.1, s: 0, col: [0, 0, 0], e: 1 };
        gl.uniform4f(U['uLeakA' + i], L.x, L.y, L.r, L.s);
        gl.uniform4f(U['uLeakB' + i], L.col[0], L.col[1], L.col[2], L.e);
      }
      gl.uniform1f(U.uScan, P.scan);
      gl.uniform1f(U.uScanCount, P.scanCount);
      gl.uniform1f(U.uTrack, P.track);
      const tp = t / Math.max(0.5, D) * Math.max(1, Math.round(P.trackCycles)) + 0.15;
      gl.uniform1f(U.uTrackPos, tp - Math.floor(tp));
      gl.uniform1f(U.uTrackWidth, P.trackWidth);
      gl.uniform1f(U.uChroma, P.chroma);
      gl.uniform1f(U.uSoft, P.soft);
      gl.uniform1f(U.uJitter, P.jitter);
      gl.uniform1f(U.uDropout, P.dropout);
      gl.uniform1f(U.uVignette, P.vignette);
      gl.uniform1f(U.uFade, P.fade);
      gl.uniform1f(U.uSat, P.sat);
      gl.uniform1f(U.uWarm, P.warm);
      gl.uniform1f(U.uContrast, P.contrast);
      gl.uniform1f(U.uMono, P.mono);
      gl.uniform3f(U.uTint, P.tint[0], P.tint[1], P.tint[2]);
      gl.uniform1f(U.uHalation, P.halation);
      gl.uniform1f(U.uCorner, P.corner);
      gl.uniform1f(U.uCurve, P.curve);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    return G;
  }

  /* ------------------------------------------------------------------ */
  /* the plain-canvas version, for a browser without WebGL              */
  /* ------------------------------------------------------------------ */
  const noise2d = el('canvas'); noise2d.width = 256; noise2d.height = 256;
  function render2D(ctx, W, H, t, frame, P, img) {
    const c = cropOf(img.width, img.height, P);
    ctx.save();
    const filters = [];
    if (P.mono > 0) filters.push('grayscale(' + P.mono.toFixed(2) + ')');
    if (P.sat !== 1) filters.push('saturate(' + P.sat.toFixed(2) + ')');
    if (P.contrast !== 1) filters.push('contrast(' + P.contrast.toFixed(2) + ')');
    if (P.warm > 0) filters.push('sepia(' + (P.warm * 0.35).toFixed(2) + ')');
    if (filters.length && 'filter' in ctx) ctx.filter = filters.join(' ');
    ctx.drawImage(img, c.ox * img.width, c.oy * img.height, c.sx * img.width, c.sy * img.height, 0, 0, W, H);
    if ('filter' in ctx) ctx.filter = 'none';
    if (P.tint[0] !== 1 || P.tint[1] !== 1 || P.tint[2] !== 1) {
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = rgbToHex(P.tint); ctx.fillRect(0, 0, W, H);
    }
    if (P.fade > 0) {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = P.fade * 0.2; ctx.fillStyle = '#d9d2c4'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    }
    if (P.leak > 0) {
      ctx.globalCompositeOperation = 'screen';
      for (const L of P.leaks) {
        const g = ctx.createRadialGradient(L.x * W, L.y * H, 0, L.x * W, L.y * H, L.r * Math.max(W, H) * 1.2);
        g.addColorStop(0, 'rgba(' + Math.round(L.col[0] * 255) + ',' + Math.round(L.col[1] * 255) + ',' + Math.round(L.col[2] * 255) + ',' + (L.s * P.leak).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    }
    if (P.scan > 0) {
      ctx.globalCompositeOperation = 'source-over';
      const period = Math.max(2, H / P.scanCount);
      ctx.fillStyle = 'rgba(0,0,0,' + (P.scan * 0.45).toFixed(3) + ')';
      for (let y = period / 2; y < H; y += period) ctx.fillRect(0, y, W, Math.max(1, period / 2));
    }
    if (P.vignette > 0) {
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + P.vignette.toFixed(3) + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (P.grain > 0) {
      const nctx = noise2d.getContext('2d');
      const id = nctx.createImageData(256, 256);
      const d = id.data;
      const col = P.grainColour;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255;
        d[i] = col ? v * (1 - col) + Math.random() * 255 * col : v;
        d[i + 1] = col ? v * (1 - col) + Math.random() * 255 * col : v;
        d[i + 2] = col ? v * (1 - col) + Math.random() * 255 * col : v;
        d[i + 3] = 255;
      }
      nctx.putImageData(id, 0, 0);
      const gs = Math.max(1, P.grainSize);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = clamp(P.grain * 0.9, 0, 1);
      ctx.save();
      ctx.scale(gs, gs);
      ctx.translate(-(hash(frame * 3 + 2) * 256), -(hash(frame * 3 + 3) * 256));
      ctx.fillStyle = ctx.createPattern(noise2d, 'repeat');
      ctx.fillRect(0, 0, W / gs + 256, H / gs + 256);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (P.corner > 0) {
      ctx.globalCompositeOperation = 'destination-in';
      const r = P.corner * Math.min(W, H) / 2;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.lineTo(W - r, 0); ctx.quadraticCurveTo(W, 0, W, r); ctx.lineTo(W, H - r); ctx.quadraticCurveTo(W, H, W - r, H);
      ctx.lineTo(r, H); ctx.quadraticCurveTo(0, H, 0, H - r); ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* the date stamp: seven-segment digits with a glow                   */
  /* ------------------------------------------------------------------ */
  const SEG = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg' };
  function stampText(P) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(P.date || '');
    let s = m ? m[3] + ' ' + m[2] + " '" + m[1].slice(2) : '';
    if (P.showTime && /^\d{2}:\d{2}/.test(P.time || '')) s += (s ? '  ' : '') + P.time.slice(0, 5);
    return s;
  }
  function drawStamp(ctx, W, H, P) {
    const text = stampText(P);
    if (!text) return;
    const h = Math.max(8, W * 0.032 * P.stampSize);
    const w = h * 0.5, lw = h * 0.14, gap = lw * 0.75, adv = w + h * 0.32;
    const advance = (ch) => (ch === ' ' ? h * 0.4 : ch === "'" ? w * 0.5 + h * 0.1 : ch === ':' ? w * 0.45 + h * 0.1 : adv);
    let width = 0;
    for (const ch of text) width += advance(ch);
    width -= h * 0.32;
    const m = Math.max(8, W * 0.035);
    const right = P.stampCorner === 'br' || P.stampCorner === 'tr';
    const bottom = P.stampCorner === 'br' || P.stampCorner === 'bl';
    const x0 = right ? W - m - width : m;
    const y0 = bottom ? H - m - h : m;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = lw;
    ctx.strokeStyle = P.stampColour; ctx.fillStyle = P.stampColour;
    ctx.globalAlpha = 0.94;
    ctx.transform(1, 0, -0.1, 1, 0.1 * (y0 + h), 0);
    const seg = (x, y, which) => {
      ctx.beginPath();
      if (which === 'a') { ctx.moveTo(x + gap, y); ctx.lineTo(x + w - gap, y); }
      else if (which === 'b') { ctx.moveTo(x + w, y + gap); ctx.lineTo(x + w, y + h / 2 - gap); }
      else if (which === 'c') { ctx.moveTo(x + w, y + h / 2 + gap); ctx.lineTo(x + w, y + h - gap); }
      else if (which === 'd') { ctx.moveTo(x + gap, y + h); ctx.lineTo(x + w - gap, y + h); }
      else if (which === 'e') { ctx.moveTo(x, y + h / 2 + gap); ctx.lineTo(x, y + h - gap); }
      else if (which === 'f') { ctx.moveTo(x, y + gap); ctx.lineTo(x, y + h / 2 - gap); }
      else { ctx.moveTo(x + gap, y + h / 2); ctx.lineTo(x + w - gap, y + h / 2); }
      ctx.stroke();
    };
    const pass = () => {
      let x = x0;
      for (const ch of text) {
        if (SEG[ch]) for (const s of SEG[ch]) seg(x, y0, s);
        else if (ch === "'") { ctx.beginPath(); ctx.moveTo(x + w * 0.25, y0); ctx.lineTo(x + w * 0.25, y0 + h * 0.22); ctx.stroke(); }
        else if (ch === ':') { ctx.beginPath(); ctx.arc(x + w * 0.2, y0 + h * 0.3, lw * 0.6, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x + w * 0.2, y0 + h * 0.7, lw * 0.6, 0, 7); ctx.fill(); }
        x += advance(ch);
      }
    };
    ctx.shadowColor = hexToRgba(P.stampColour, 0.9); ctx.shadowBlur = h * 0.5;
    pass();
    ctx.shadowBlur = h * 0.12;
    pass();
    ctx.restore();
  }

  /** The date a JPEG carries, read from the first bytes of the file; null when there is none. */
  async function exifDate(file) {
    try {
      const buf = new DataView(await file.slice(0, 262144).arrayBuffer());
      if (buf.byteLength < 4 || buf.getUint16(0) !== 0xFFD8) return null;
      let o = 2;
      while (o + 4 <= buf.byteLength) {
        const marker = buf.getUint16(o), len = buf.getUint16(o + 2);
        if (marker === 0xFFE1 && o + 10 <= buf.byteLength && buf.getUint32(o + 4) === 0x45786966) {
          const t = o + 10;
          const le = buf.getUint16(t) === 0x4949;
          const u16 = (p) => buf.getUint16(p, le), u32 = (p) => buf.getUint32(p, le);
          if (u16(t + 2) !== 42) return null;
          const str = (p, n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(buf.getUint8(p + i)); return s; };
          const scan = (ifd, want) => {
            const n = u16(ifd), found = {};
            for (let i = 0; i < n; i++) {
              const e = ifd + 2 + i * 12;
              const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
              if (!want.has(tag)) continue;
              if (type === 2 && count >= 19) found[tag] = str(t + u32(e + 8), 19);
              else if (type === 4) found[tag] = u32(e + 8);
            }
            return found;
          };
          const f0 = scan(t + u32(t + 4), new Set([0x0132, 0x8769]));
          let dt = null;
          if (f0[0x8769]) { const fx = scan(t + f0[0x8769], new Set([0x9003, 0x9004])); dt = fx[0x9003] || fx[0x9004]; }
          dt = dt || f0[0x0132];
          const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/.exec(dt || '');
          return m && m[1] !== '0000' ? { date: m[1] + '-' + m[2] + '-' + m[3], time: m[4] + ':' + m[5] } : null;
        }
        if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) return null;
        o += 2 + len;
      }
    } catch (e) { /* no date, then */ }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* the tool                                                           */
  /* ------------------------------------------------------------------ */
  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const S = { image: null, preset: 'disposable', p: fromPreset('disposable'), duration: 2.5, t: 0, playing: false, t0: 0, exporting: false, job: null };
    let G = null;
    try { G = makeGL(); } catch (e) { G = null; console.warn('[film-grain] WebGL unavailable, drawing on a plain canvas:', e && e.message); }

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg aiimg-grain');
    wrap.dataset.renderer = G ? 'webgl' : '2d';
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a photo</strong><span>or drag it here — nothing is uploaded. JPEG, PNG, WebP or HEIC.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'image/*'; file.setAttribute('aria-label', 'Choose a photo');

    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const canvas = el('canvas', 'aiimg-canvas aiimg-grain-canvas');
    canvas.setAttribute('aria-label', 'Preview');
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(canvas, stageMsg);
    const transport = el('div', 'aiimg-transport');
    const play = button('▶ Play', 'btn-ghost');
    const scrub = el('input', 'range');
    scrub.type = 'range'; scrub.min = 0; scrub.max = 1000; scrub.step = 1; scrub.value = 0;
    scrub.setAttribute('aria-label', 'Position in the loop');
    const clock = el('span', 'range-val', '0.0 s');
    const change = button('Change photo', 'btn-ghost', () => file.click());
    transport.append(play, scrub, clock, change);
    stageCol.append(stage, transport);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['look', 'Look'], ['colour', 'Colour'], ['stamp', 'Stamp & frame'], ['export', 'Export']]) {
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

    /* ---------------- drawing ---------------- */
    const pctx = canvas.getContext('2d');
    let dirty = true, lastFrame = -1;
    const invalidate = () => { dirty = true; };
    function frameDims() {
      const img = S.image;
      const c = cropOf(img.width, img.height, S.p);
      return { w: img.width * c.sx, h: img.height * c.sy };
    }
    function sizePreview() {
      if (!S.image) return;
      const d = frameDims();
      const s = Math.min(1, PREVIEW_MAX / Math.max(d.w, d.h));
      const w = Math.max(1, Math.round(d.w * s)), h = Math.max(1, Math.round(d.h * s));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    /** The frame at time t: the look, then the stamp. Used by the preview and every export alike. */
    function renderFrame(ctx, W, H, t) {
      const frame = Math.floor(t * GRAIN_FPS + 1e-6);
      ctx.save();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      if (G && !G.lost) {
        G.draw(S.p, W, H, t, frame, S.duration);
        ctx.drawImage(G.canvas, 0, 0, W, H);
      } else {
        render2D(ctx, W, H, t, frame, S.p, S.image.canvas);
      }
      if (S.p.stamp) drawStamp(ctx, W, H, S.p);
      ctx.restore();
    }
    function draw() {
      if (!S.image) return;
      sizePreview();
      renderFrame(pctx, canvas.width, canvas.height, S.t);
      dirty = false;
      lastFrame = Math.floor(S.t * GRAIN_FPS + 1e-6);
    }
    let mounted = true;
    function loop(now) {
      if (!mounted) return;
      if (S.playing && !S.exporting) {
        S.t = ((now - S.t0) / 1000) % S.duration;
        scrub.value = Math.round(S.t / S.duration * 1000);
        clock.textContent = S.t.toFixed(1) + ' s';
        if (Math.floor(S.t * GRAIN_FPS + 1e-6) !== lastFrame) dirty = true;
      }
      if (dirty) draw();
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
    scrub.addEventListener('input', () => { setPlaying(false); S.t = Number(scrub.value) / 1000 * S.duration; clock.textContent = S.t.toFixed(1) + ' s'; invalidate(); });

    /* ---------------- controls, bound to the look ---------------- */
    const syncs = [];
    const h = (t) => el('p', 'aiimg-h', t);
    const grid = (...fields) => { const g = el('div', 'aiimg-grid2'); g.append(...fields); return g; };
    function bindRange(id, key, min, max, step, scale, fmt) {
      const r = range(id, min, max, step, S.p[key] * scale, fmt);
      on(r, () => { S.p[key] = Number(r.input.value) / scale; invalidate(); });
      syncs.push(() => r.set(Math.round(S.p[key] * scale * 100) / 100));
      return r;
    }
    function bindCheck(id, key, label) {
      const c = check(id, label, !!S.p[key]);
      on(c, () => { S.p[key] = c.input.checked; invalidate(); });
      syncs.push(() => { c.input.checked = !!S.p[key]; });
      return c;
    }
    function bindSelect(id, key, options) {
      const s = select(id, options, S.p[key]);
      on(s, () => { S.p[key] = s.value; invalidate(); });
      syncs.push(() => { s.value = String(S.p[key]); });
      return s;
    }
    function bindColour(id, key, asVec) {
      const c = colour(id, asVec ? rgbToHex(S.p[key]) : S.p[key]);
      on(c, () => { S.p[key] = asVec ? hexToRgb(c.value) : c.value; invalidate(); });
      syncs.push(() => { c.value = asVec ? rgbToHex(S.p[key]) : S.p[key]; });
      return c;
    }
    function bindText(id, key, type) {
      const i = el('input', 'control'); i.type = type; i.id = id; i.value = S.p[key] || '';
      on(i, () => { S.p[key] = i.value; invalidate(); });
      syncs.push(() => { i.value = S.p[key] || ''; });
      return i;
    }
    function syncUI() { for (const f of syncs) f(); renderPresets(); invalidate(); }

    /* ---------------- the look pane ---------------- */
    const status = el('p', 'aiimg-status', 'Choose a photo to begin.');
    const presetList = el('div', 'aiimg-textlist aiimg-grain-presets');
    function renderPresets() {
      presetList.innerHTML = '';
      for (const k in PRESETS) {
        const b = button(PRESETS[k].name, 'chip' + (k === S.preset ? ' is-on' : ''), () => applyPreset(k));
        b.id = 'aiimg-grain-preset-' + k;
        b.setAttribute('aria-pressed', k === S.preset ? 'true' : 'false');
        presetList.appendChild(b);
      }
    }
    function applyPreset(k, rolled) {
      S.preset = k;
      S.p = rolled ? roll(k, S.p) : fromPreset(k, S.p);
      if (S.image) status.textContent = PRESETS[k].name + (rolled ? ', rolled' : '') + ' — ready';
      syncUI();
      if (!S.playing && (S.p.track > 0 || S.p.jitter > 0)) setPlaying(true);
    }
    const rollBtn = button('🎲 Random roll', 'btn-primary', () => applyPreset(S.preset, true)); rollBtn.id = 'aiimg-grain-roll';
    const leaksBtn = button('New leaks', 'btn-ghost', () => { withLeaks(S.p); invalidate(); }); leaksBtn.id = 'aiimg-grain-newleaks';
    const resetBtn = button('Reset', 'btn-ghost', () => applyPreset(S.preset, false)); resetBtn.id = 'aiimg-grain-reset';
    const presetRow = el('div', 'aiimg-row'); presetRow.append(rollBtn, leaksBtn, resetBtn);
    const grain = bindRange('aiimg-grain-amount', 'grain', 0, 100, 1, 100, pct);
    const grainSize = bindRange('aiimg-grain-size', 'grainSize', 1, 4, 0.1, 1, (v) => v.toFixed(1) + ' px');
    const grainColour = bindRange('aiimg-grain-colour', 'grainColour', 0, 100, 1, 100, pct);
    const leak = bindRange('aiimg-grain-leak', 'leak', 0, 100, 1, 100, pct);
    const scan = bindRange('aiimg-grain-scan', 'scan', 0, 100, 1, 100, pct);
    const track = bindRange('aiimg-grain-track', 'track', 0, 100, 1, 100, pct);
    const soft = bindRange('aiimg-grain-soft', 'soft', 0, 4, 0.1, 1, px);
    const jitter = bindRange('aiimg-grain-jitter', 'jitter', 0, 8, 0.5, 1, px);
    const dropout = bindRange('aiimg-grain-dropout', 'dropout', 0, 100, 1, 100, pct);
    const chroma = bindRange('aiimg-grain-chroma', 'chroma', 0, 6, 0.1, 1, px);
    const vignette = bindRange('aiimg-grain-vignette', 'vignette', 0, 100, 1, 100, pct);
    panes.look.append(status, presetList, presetRow,
      h('Grain'), field('Amount', grain), grid(field('Size', grainSize), field('Colour grain', grainColour)),
      h('Light leaks'), field('Amount', leak, 'Where they fall is part of the roll; New leaks casts them again.'),
      h('Tape'), grid(field('Scan lines', scan), field('Tracking', track)), grid(field('Softness', soft), field('Frame jitter', jitter)),
      grid(field('Dropouts', dropout), field('Colour fringing', chroma)),
      h('Frame'), field('Vignette', vignette));

    /* ---------------- the colour pane ---------------- */
    const mono = bindRange('aiimg-grain-mono', 'mono', 0, 100, 1, 100, pct);
    const tint = bindColour('aiimg-grain-tint', 'tint', true);
    const warm = bindRange('aiimg-grain-warm', 'warm', -100, 100, 1, 100, (v) => (v > 0 ? '+' : '') + Math.round(v));
    const sat = bindRange('aiimg-grain-sat', 'sat', 0, 200, 1, 100, pct);
    const contrast = bindRange('aiimg-grain-contrast', 'contrast', 70, 140, 1, 100, pct);
    const fade = bindRange('aiimg-grain-fade', 'fade', 0, 100, 1, 100, pct);
    const halation = bindRange('aiimg-grain-halation', 'halation', 0, 100, 1, 100, pct);
    panes.colour.append(h('Colour'), grid(field('Monochrome', mono), field('Tint', tint)), grid(field('Warmth', warm), field('Saturation', sat)),
      grid(field('Contrast', contrast), field('Fade', fade, 'Lifts the blacks and cools the shadows, like a print left in the sun.')),
      field('Halation', halation, 'The warm glow film gives to bright lights and windows.'));

    /* ---------------- the stamp and frame pane ---------------- */
    const stampOn = bindCheck('aiimg-grain-stamp', 'stamp', 'Date stamp');
    const date = bindText('aiimg-grain-date', 'date', 'date');
    const time = bindText('aiimg-grain-time', 'time', 'time');
    const showTime = bindCheck('aiimg-grain-showtime', 'showTime', 'Show the time too');
    const cornerSel = bindSelect('aiimg-grain-corner', 'stampCorner', [['br', 'Bottom right'], ['bl', 'Bottom left'], ['tr', 'Top right'], ['tl', 'Top left']]);
    const stampSize = bindRange('aiimg-grain-stampsize', 'stampSize', 50, 200, 5, 100, pct);
    const stampColour = bindColour('aiimg-grain-stampcolour', 'stampColour', false);
    const crop = bindCheck('aiimg-grain-crop', 'crop43', 'Crop to 4:3');
    on(crop, () => { sizePreview(); });
    const crt = bindRange('aiimg-grain-crt', 'corner', 0, 20, 1, 100, pct);
    const curve = bindRange('aiimg-grain-curve', 'curve', 0, 100, 1, 100, pct);
    const dateHint = el('p', 'field-hint', '');
    panes.stamp.append(h('Date stamp'), stampOn, grid(field('Date', date), field('Time', time)), showTime, dateHint,
      grid(field('Corner', cornerSel), field('Size', stampSize)), field('Colour', stampColour),
      h('Frame'), crop, grid(field('CRT corners', crt), field('Screen curve', curve)));

    /* ---------------- the export pane ---------------- */
    const stillFmt = on(select('aiimg-grain-still-fmt', [['image/png', 'PNG'], ['image/jpeg', 'JPEG'], ['image/webp', 'WebP']], 'image/png'), () => { qualityField.hidden = stillFmt.value === 'image/png'; });
    const stillSize = select('aiimg-grain-still-size', [['0', 'Original size'], ['2048', 'Up to 2048 px'], ['1080', 'Up to 1080 px'], ['720', 'Up to 720 px']], '0');
    const quality = range('aiimg-grain-quality', 50, 100, 1, 92, pct);
    const qualityField = field('Quality', quality); qualityField.hidden = true;
    const stillBtn = button('Download the image', 'btn-primary', exportStill); stillBtn.id = 'aiimg-grain-still';
    const clipFmt = on(select('aiimg-grain-clip-fmt', [['gif', 'Animated GIF'], ['mp4', 'MP4 video (H.264)']], 'gif'), () => syncClipOptions());
    const clipSize = select('aiimg-grain-clip-size', [], '640');
    const clipFps = select('aiimg-grain-clip-fps', [], '12');
    const durCtl = on(range('aiimg-grain-dur', 1, 5, 0.5, S.duration, (v) => v.toFixed(1) + ' s'), () => { S.duration = Number(durCtl.input.value); S.t = Math.min(S.t, S.duration); invalidate(); });
    const clipBtn = button('Export the loop', 'btn-primary', exportClip); clipBtn.id = 'aiimg-grain-clip';
    const cancelBtn = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); cancelBtn.hidden = true;
    const clipProgress = el('div', 'aiimg-progress'); const clipBar = el('i'); clipProgress.appendChild(clipBar); clipProgress.hidden = true;
    const clipStatus = el('p', 'aiimg-status aiimg-grain-clipstatus', ''); clipStatus.hidden = true;
    const results = el('div', 'aiimg-results');
    const clipRow = el('div', 'aiimg-row'); clipRow.append(clipBtn, cancelBtn);
    function fillSelect(sel, options, value) { sel.innerHTML = ''; for (const [v, l] of options) { const op = el('option', null, l); op.value = v; sel.appendChild(op); } sel.value = options.some((o) => String(o[0]) === String(value)) ? value : options[0][0]; }
    function syncClipOptions() {
      const gif = clipFmt.value === 'gif';
      fillSelect(clipSize, gif ? [['480', '480 px'], ['640', '640 px'], ['800', '800 px — large files']] : [['720', '720 px'], ['1080', '1080 px (Full HD)'], ['1440', '1440 px'], ['1920', '1920 px']], gif ? '640' : '1080');
      fillSelect(clipFps, gif ? [['10', '10'], ['12', '12'], ['15', '15']] : [['24', '24'], ['30', '30']], gif ? '12' : '24');
    }
    syncClipOptions();
    panes.export.append(
      h('Still image'), grid(field('Format', stillFmt), field('Size', stillSize)), qualityField,
      el('p', 'field-hint', 'The still is the frame on the preview. Scrub to the moment you want first.'),
      (() => { const r = el('div', 'aiimg-row'); r.append(stillBtn); return r; })(),
      h('Flicker loop'), grid(field('Format', clipFmt), field('Long edge', clipSize)), grid(field('Frames per second', clipFps), field('Length', durCtl)),
      el('p', 'field-hint', 'Every frame has its own grain, and the tracking drifts. Encoded on your device; MP4 needs Chrome, Edge or Safari 16.4+, elsewhere the clip is recorded as WebM. Keep GIFs at 640 px or under.'),
      clipRow, clipProgress, clipStatus, results);

    const outName = (ext) => (S.image ? S.image.name : 'image') + '-' + S.preset + '.' + ext;
    function sizeFor(longEdge) {
      const d = frameDims();
      const cap = Number(longEdge) || 0;
      const s = cap ? Math.min(1, cap / Math.max(d.w, d.h)) : 1;
      return { width: Math.max(2, Math.round(d.w * s)), height: Math.max(2, Math.round(d.h * s)) };
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
    async function exportStill() {
      if (!S.image) return;
      try {
        S.exporting = true;
        const type = stillFmt.value;
        const { width, height } = sizeFor(stillSize.value);
        const blob = await A.exportStill(renderFrame, { width, height, format: type, quality: Number(quality.input.value) / 100, t: S.t });
        if (!blob) throw new Error('This browser could not encode that format. Try PNG.');
        const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
        const name = outName(ext);
        addResult(blob, name, null, width + '×' + height);
        A.download(blob, name);
        say('');
      } catch (e) { say((e && e.message) || String(e), 'error'); }
      finally { S.exporting = false; invalidate(); }
    }
    async function exportClip() {
      if (!S.image || S.job) return;
      const gif = clipFmt.value === 'gif';
      const { width, height } = sizeFor(clipSize.value);
      const fps = Number(clipFps.value);
      const frames = Math.round(S.duration * fps);
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
        const o = { width, height, fps, duration: S.duration, onProgress, signal: S.job.signal };
        let blob, ext, noteText;
        if (gif) { blob = await A.encodeGIF(renderFrame, o); ext = 'gif'; }
        else { const r = await A.encodeVideo(renderFrame, o); blob = r.blob; ext = r.ext; noteText = r.note; }
        const name = outName(ext);
        addResult(blob, name, (gif ? 'GIF' : (ext === 'mp4' ? 'MP4' : 'WebM')) + ' · ' + S.duration.toFixed(1) + ' s · ' + fps + ' fps', width + '×' + height);
        A.download(blob, name);
        clipStatus.textContent = (gif ? 'GIF' : ext.toUpperCase()) + ', ' + frames + ' frames — done in ' + ((performance.now() - started) / 1000).toFixed(1) + ' s.';
        if (noteText && /WebM/.test(noteText)) say(noteText, 'warn'); else say('');
      } catch (e) {
        if (e && e.name === 'AbortError') clipStatus.textContent = 'Cancelled.';
        else { clipStatus.textContent = 'The export failed.'; say((e && e.message) || String(e), 'error'); }
      } finally {
        S.job = null; S.exporting = false;
        clipBtn.disabled = false; cancelBtn.hidden = true; clipProgress.hidden = true;
        if (wasPlaying) setPlaying(true);
        invalidate();
      }
    }

    /* ---------------- loading ---------------- */
    async function loadFiles(files) {
      const f = files && files[0]; if (!f) return;
      try {
        say(''); note('Reading the photo…');
        const [img, when] = await Promise.all([A.loadImageFile(f), exifDate(f)]);
        S.image = img;
        if (G && !G.lost) G.setImage(img.canvas);
        S.p.date = when ? when.date : today();
        S.p.time = when ? when.time : nowTime();
        dateHint.textContent = when ? 'The photo carries the date ' + when.date + ' ' + when.time + ', so the stamp starts there.' : 'The photo carries no date, so the stamp starts at today.';
        studio.hidden = false; drop.hidden = true;
        results.innerHTML = '';
        S.t = 0; scrub.value = 0; clock.textContent = '0.0 s';
        sizePreview();
        syncUI();
        status.textContent = PRESETS[S.preset].name + ' — ready';
        if (!G) say('WebGL is not available in this browser, so a simpler version of the look is drawn: no tracking wobble, colour fringing or halation.', 'note');
        showPane('look');
        note('');
        if (!S.playing) setPlaying(true);
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

    /* ---------------- go ---------------- */
    renderPresets();
    showPane('look');
    return { state: S, renderFrame, loadFiles, applyPreset, destroy: () => { mounted = false; } };
  }

  A.tools['film-grain'] = { mount };
})();
