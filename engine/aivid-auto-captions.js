/**
 * Auto Captions (offline).
 *
 * A video or audio file goes in; Whisper tiny (engine/aivid-whisper.js)
 * turns the sound into timed words on the device, in the language chosen
 * or detected; the words are drawn over the frames in one of eight looks
 * and the clip is re-encoded with its own sound. SRT, VTT and ASS come from
 * the same words and timings. Nothing leaves the browser.
 *
 * The frame is drawn by one function whether it is the preview or a frame
 * of the export, so what is exported is what was seen — keyword colours,
 * emoji and a dragged position included. Muxing is isolated behind
 * muxVideo(): the shared runtime's encodeVideoFrames() when it has one,
 * else WebCodecs + mp4-muxer here, else MediaRecorder.
 *
 * Public API (the Reel Maker uses it; every new option is optional and
 * defaults to the old behaviour): drawCaptions(ctx, W, H, t, cues, style),
 * fileCues(segments), wordCues(segments, n), toSRT, toVTT, toASS, STYLES.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, field, select, range, colour, check, button, sleep, fmtBytes } = A;

  const MAX_SECONDS = 600;
  const PHONE_WARN_SECONDS = 180;
  const PREVIEW_MAX = 720;
  const MAX_LINE = 42;
  /* a line of Chinese or Japanese holds far fewer characters: 16 is the
     common subtitle limit for Simplified Chinese */
  const MAX_LINE_CJK = 16;
  const MAX_LINES = 2;
  const AUDIO_RATE = 48000;
  const STORE = 'aivid-auto-captions:v1';
  const FONTS = [['Sora', 'Sora — bold, modern'], ['Inter', 'Inter'], ['Impact', 'Impact'], ['Arial Black', 'Arial Black'], ['Verdana', 'Verdana'], ['Georgia', 'Georgia'], ['system-ui', 'System font']];
  /* [id, label, hint]. The first four draw exactly as they always have. */
  const STYLES = [
    ['karaoke', 'Karaoke', 'Words light up as they are spoken'],
    ['pop', 'Pop', 'The current word jumps in size'],
    ['outline', 'Bold outline', 'White, heavy, black edge'],
    ['minimal', 'Minimal', 'A dark box under one line'],
    ['box', 'Word box', 'The current word sits on a box in the highlight colour'],
    ['yellow', 'Bold capitals', 'Heavy white capitals, the current word in the highlight colour'],
    ['neon', 'Neon', 'The current word glows in the highlight colour'],
    ['stack', 'One word', 'One big word at a time, bouncing in']
  ];
  const STYLE_IDS = STYLES.map((s) => s[0]);
  const MODES = [['1', '1 word at a time'], ['2', '2 words at a time'], ['3', '3 words at a time'], ['line', 'Whole line, up to 2 lines']];
  const POSITIONS = [['bottom', 'Bottom, inside the safe area'], ['middle', 'Middle'], ['top', 'Top'], ['custom', 'Where you dragged it']];
  /* The languages offered by name. English and Hindi first, then the
     eleven that follow them in Ethnologue's ranking of the most spoken
     languages by total (first- plus second-language) speakers,
     https://www.ethnologue.com/insights/most-spoken-language/ (its top-200
     list, 2025): Mandarin Chinese, Spanish, Standard Arabic, French, Bengali,
     Portuguese, Russian, Urdu, Indonesian, Standard German, Japanese (Urdu
     and Indonesian are close and trade places between editions). Codes are
     Whisper's; Auto-detect can return any of its 99 languages. */
  const LANGS = [
    ['auto', 'Auto-detect'], ['en', 'English'], ['hi', 'Hindi — हिन्दी'], ['zh', 'Mandarin Chinese — 中文'], ['es', 'Spanish — Español'],
    ['ar', 'Arabic — العربية'], ['fr', 'French — Français'], ['bn', 'Bengali — বাংলা'], ['pt', 'Portuguese — Português'],
    ['ru', 'Russian — Русский'], ['ur', 'Urdu — اردو'], ['id', 'Indonesian — Bahasa Indonesia'], ['de', 'German — Deutsch'], ['ja', 'Japanese — 日本語']
  ];
  /* What our own test run found (build/ai-video/tests/auto-captions-langs.js,
     five short Common Voice sentences per language): said plainly where the
     smallest Whisper fails, so nobody is surprised by it. */
  const LANG_NOTES = {
    hi: 'Whisper tiny is weak in Hindi: on our test sentences it wrote the speech in English, not Devanagari, and Auto-detect heard Urdu. Expect to retype the captions.',
    bn: 'Whisper tiny cannot write Bengali usefully: on our test sentences it produced no readable Bengali. Expect to type the captions yourself.',
    pt: 'Whisper tiny was unreliable on our short Portuguese test sentences (it repeated one word). Longer, clearer speech does better; check every line.'
  };
  /* Auto emoji: a small built-in table, English words only. The word is
     matched lower-case without punctuation, and without a plural -s. */
  const EMOJI = {
    love: '❤️', heart: '❤️', fire: '🔥', hot: '🔥', money: '💰', cash: '💰', rich: '💰', happy: '😀', smile: '😀', laugh: '😂', funny: '😂',
    sad: '😢', cry: '😢', wow: '😮', amazing: '🤩', cool: '😎', idea: '💡', think: '🤔', rocket: '🚀', launch: '🚀', growth: '📈', grow: '📈',
    time: '⏰', clock: '⏰', music: '🎵', song: '🎵', food: '🍕', pizza: '🍕', coffee: '☕', phone: '📱', video: '🎬', videos: '🎬', camera: '📷',
    photo: '📷', star: '⭐', win: '🏆', winner: '🏆', sun: '☀️', sunny: '☀️', rain: '🌧️', world: '🌍', earth: '🌍', book: '📚', learn: '📚',
    home: '🏠', house: '🏠', car: '🚗', cat: '🐱', dog: '🐶', fox: '🦊', party: '🎉', celebrate: '🎉', birthday: '🎂', gift: '🎁',
    warning: '⚠️', yes: '✅', done: '✅', no: '❌', stop: '🛑', fast: '⚡', quick: '⚡', strong: '💪', thanks: '🙏', thank: '🙏',
    hello: '👋', hi: '👋', welcome: '👋', secret: '🤫', free: '🆓', new: '🆕', eyes: '👀', look: '👀', captions: '💬', caption: '💬',
    browser: '🌐', internet: '🌐', email: '📧', mail: '📧', lock: '🔒', private: '🔒', key: '🔑', target: '🎯', goal: '🎯', check: '✅',
    sleep: '😴', tired: '😴', water: '💧', tree: '🌳', flower: '🌸', run: '🏃', travel: '✈️', plane: '✈️', game: '🎮', play: '▶️'
  };
  const PHONE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || !!(navigator.userAgentData && navigator.userAgentData.mobile);
  const abortError = () => { const e = new Error('Cancelled.'); e.name = 'AbortError'; return e; };
  const evenDown = (n) => Math.max(2, Math.floor(n / 2) * 2);
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtSec = (s) => s < 60 ? Math.round(s) + ' s' : Math.floor(s / 60) + ' min ' + pad2(Math.round(s % 60)) + ' s';
  const clock = (s) => { s = Math.max(0, s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = Math.floor(s % 60), ms = Math.round((s - Math.floor(s)) * 1000); return { h, m, sec, ms: ms === 1000 ? 999 : ms }; };
  const srtTime = (s) => { const c = clock(s); return pad2(c.h) + ':' + pad2(c.m) + ':' + pad2(c.sec) + ',' + String(c.ms).padStart(3, '0'); };
  const vttTime = (s) => srtTime(s).replace(',', '.');
  /* ASS: H:MM:SS.cc, centiseconds rounded once from the whole time so they never read 100 */
  const assTime = (s) => { const cs = Math.max(0, Math.round(s * 100)); return Math.floor(cs / 360000) + ':' + pad2(Math.floor(cs / 6000) % 60) + ':' + pad2(Math.floor(cs / 100) % 60) + '.' + pad2(cs % 100); };
  const on = (ctrl, fn) => { const t = ctrl.input || ctrl; t.addEventListener('input', fn); t.addEventListener('change', fn); return ctrl; };

  /* ------------------------------------------------------------------ */
  /* words, scripts and keywords                                        */
  /* ------------------------------------------------------------------ */
  const Wh = () => window.AIVidWhisper || null;
  const CJK = /[\u0E00-\u0EFF\u1000-\u109F\u1780-\u17FF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
  /** Written without spaces between words? (Chinese, Japanese, Thai…) */
  function isNoSpace(lang, text) {
    const w = Wh();
    if (w && w.noSpace) return w.noSpace(lang, text);
    const t = String(text || '').trim();
    return !!t && CJK.test(t) && !/\s/.test(t);
  }
  const joinerOf = (nospace) => nospace ? '' : ' ';
  const RTL_CH = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
  const LTR_CH = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0900-\u0DFF\u3040-\u9FFF]/g;
  /** Right-to-left when the text holds more Arabic/Hebrew letters than left-to-right ones. */
  function isRtl(text) {
    const s = String(text || '');
    const r = (s.match(RTL_CH) || []).length;
    return r > 0 && r >= (s.match(LTR_CH) || []).length;
  }
  /** A word as compared for keywords and emoji: lower case, letters and digits only. */
  const normWord = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');
  function emojiFor(word) {
    const k = normWord(word);
    if (!k) return '';
    if (Object.prototype.hasOwnProperty.call(EMOJI, k)) return EMOJI[k];
    if (k.length > 3 && /s$/.test(k) && Object.prototype.hasOwnProperty.call(EMOJI, k.slice(0, -1))) return EMOJI[k.slice(0, -1)];
    return '';
  }
  let keyCache = { src: null, set: new Set() };
  function keySetOf(list) {
    if (keyCache.src === list) return keyCache.set;
    const set = new Set();
    for (const k of (Array.isArray(list) ? list : [])) { const n = normWord(k); if (n) set.add(n); }
    keyCache = { src: list, set };
    return set;
  }

  /* ------------------------------------------------------------------ */
  /* cues: words → what is on screen, and what goes in the files        */
  /* ------------------------------------------------------------------ */
  /** Greedy line fill: arrays of words, each line at most maxChars (joined by joiner, a space unless the script has none). */
  function wrapWords(words, maxChars, joiner) {
    const gap = joiner === undefined ? 1 : joiner.length;
    const lines = [];
    let cur = [], len = 0;
    for (const w of words) {
      const add = (cur.length ? gap : 0) + w.text.length;
      if (cur.length && len + add > maxChars) { lines.push(cur); cur = [w]; len = w.text.length; }
      else { cur.push(w); len += add; }
    }
    if (cur.length) lines.push(cur);
    return lines;
  }
  const segNoSpace = (s) => isNoSpace(s.lang, s.text || (s.words || []).map((w) => w.text).join(''));
  /** Cues for SRT/VTT/ASS and for line mode: ≤ 2 lines of ≤ 42 characters (16 for Chinese and Japanese), strictly increasing, never overlapping. */
  function fileCues(segments) {
    const cues = [];
    for (const s of segments) {
      if (!s.words || !s.words.length) continue;
      const ns = segNoSpace(s), j = joinerOf(ns);
      const lines = wrapWords(s.words, ns ? MAX_LINE_CJK : MAX_LINE, j);
      for (let i = 0; i < lines.length; i += MAX_LINES) {
        const part = lines.slice(i, i + MAX_LINES);
        const ws = part.flat();
        const c = { start: ws[0].start, end: ws[ws.length - 1].end, lines: part.map((l) => l.map((w) => w.text).join(j)), words: ws };
        if (ns) c.nospace = true;
        if (s.lang) c.lang = s.lang;
        cues.push(c);
      }
    }
    let prev = 0;
    for (const c of cues) {
      if (c.start < prev) c.start = prev;
      if (c.end <= c.start + 0.04) c.end = c.start + 0.05;
      prev = c.end;
    }
    return cues;
  }
  /** Cues for word mode: n consecutive words of a segment at a time. */
  function wordCues(segments, n) {
    const cues = [];
    for (const s of segments) {
      const ws = s.words || [];
      const ns = ws.length ? segNoSpace(s) : false;
      for (let i = 0; i < ws.length; i += n) {
        const part = ws.slice(i, i + n);
        const c = { start: part[0].start, end: part[part.length - 1].end, lines: [part.map((w) => w.text).join(joinerOf(ns))], words: part };
        if (ns) c.nospace = true;
        if (s.lang) c.lang = s.lang;
        cues.push(c);
      }
    }
    return cues;
  }
  /** Hold a cue on screen through a short gap so single words do not flicker. */
  function withHold(cues) {
    for (let i = 0; i < cues.length; i++) {
      const next = cues[i + 1];
      cues[i].until = next ? Math.min(cues[i].end + 0.35, next.start) : cues[i].end + 0.35;
      if (cues[i].until < cues[i].end) cues[i].until = cues[i].end;
    }
    return cues;
  }
  function toSRT(cues) {
    return cues.map((c, i) => (i + 1) + '\n' + srtTime(c.start) + ' --> ' + srtTime(c.end) + '\n' + c.lines.join('\n') + '\n').join('\n');
  }
  function toVTT(cues) {
    return 'WEBVTT\n\n' + cues.map((c) => vttTime(c.start) + ' --> ' + vttTime(c.end) + '\n' + c.lines.join('\n') + '\n').join('\n');
  }

  /* ------------------------------------------------------------------ */
  /* layout shared by the drawing and the ASS file                      */
  /* ------------------------------------------------------------------ */
  const fontFor = (st, px) => (st.preset === 'minimal' ? 600 : (st.preset === 'yellow' || st.preset === 'stack') ? 900 : 800) + ' ' + px + 'px "' + (st.font || 'Sora') + '", "Inter", Arial, sans-serif';
  const hexA = (hex, a) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || ''); return m ? 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')' : 'rgba(0,0,0,' + a + ')'; };
  const rgbOf = (hex, d) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '') || /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(d); return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]; };
  /** Dark or light text for a box of this colour. */
  const inkOn = (hex) => { const [r, g, b] = rgbOf(hex, '#f7c948'); return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 150 ? '#0b1020' : '#ffffff'; };
  const sizePx = (st, W) => Math.max(8, (Number(st.size) || 7) / 100 * W) * (st.preset === 'stack' ? 1.6 : 1);
  /** The centre line of the caption block before any clamping: the preset band, or the dragged point. */
  function anchorOf(st, W, H) {
    const portrait = H > W;
    if (st.position === 'custom' && isFinite(st.y)) return { cx: clamp(isFinite(st.x) ? st.x : 0.5, 0, 1) * W, cy: clamp(st.y, 0, 1) * H, custom: true };
    const cy = st.position === 'top' ? H * (portrait ? 0.16 : 0.13) : st.position === 'middle' ? H * 0.5 : H * (portrait ? 0.78 : 0.86);
    return { cx: W / 2, cy, custom: false };
  }
  /* back-out easing for the One word look: overshoots, then settles */
  const backOut = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

  /* ------------------------------------------------------------------ */
  /* drawing the captions                                               */
  /* ------------------------------------------------------------------ */
  /**
   * Draw the active cue at time t on a W×H frame. Returns the block's box
   * { x, y, w, h } in frame pixels, or null when no cue is on screen.
   * style: preset (one of STYLES), position ('bottom' | 'middle' | 'top' |
   * 'custom' with x, y as fractions of the frame), size, font, fill,
   * accent, stroke, box, uppercase, maxBottom; and, all optional:
   * keywords (array of words drawn in keyColour), autoEmoji (adds an emoji
   * after words in the built-in English table).
   */
  function drawCaptions(ctx, W, H, t, cues, st) {
    st = st || {};
    let cue = null;
    for (const c of cues) { if (t >= c.start && t < (c.until !== undefined ? c.until : c.end)) { cue = c; break; } }
    if (!cue) return null;
    const preset = st.preset;
    const safeW = W * 0.86;
    let px = sizePx(st, W);
    const nospace = cue.nospace || isNoSpace(cue.lang, cue.lines.join(''));
    const rtl = isRtl(cue.lines.join(' '));
    const upper = st.uppercase || preset === 'yellow';
    const text = (w) => (upper ? w.text.toUpperCase() : w.text);
    const keys = keySetOf(st.keywords);
    const isKey = (w) => keys.size > 0 && keys.has(normWord(w.text));
    const emo = (w) => (st.autoEmoji ? emojiFor(w.text) : '');
    let words = cue.words;
    /* One word: the word being spoken (or the last one spoken) alone */
    if (preset === 'stack') { let k = 0; for (let i = 0; i < words.length; i++) if (t >= words[i].start) k = i; words = [words[k]]; }
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (rtl) ctx.direction = 'rtl';
    /* lines of words: the cue's own lines in line mode, one line in word mode */
    let lines = cue.lines.length > 1 && preset !== 'stack' ? wrapWords(words, nospace ? MAX_LINE_CJK : MAX_LINE, joinerOf(nospace)) : [words];
    const gapK = nospace ? 0 : 0.28;
    const itemW = (w) => { const e = emo(w); return ctx.measureText(text(w)).width + (e ? px * 0.18 + ctx.measureText(e).width : 0); };
    /* shrink to fit the safe width */
    const widest = () => { ctx.font = fontFor(st, px); return Math.max(...lines.map((l) => l.reduce((s, w) => s + itemW(w), 0) + (l.length - 1) * px * gapK)); };
    for (let k = 0; k < 8 && widest() > safeW; k++) px *= 0.9;
    ctx.font = fontFor(st, px);
    const lineH = px * 1.22;
    const blockH = lineH * lines.length;
    const anc = anchorOf(st, W, H);
    let cy = anc.cy;
    if (anc.custom) cy = clamp(cy, blockH / 2 + px * 0.3, H - blockH / 2 - px * 0.3);
    /* a caller may reserve the strip below the captions (the Reel Maker's credit line): the block's bottom, outline included, stays above maxBottom */
    if (st.maxBottom && st.position !== 'top' && st.position !== 'middle') cy = Math.min(cy, st.maxBottom - blockH / 2 - px * 0.3);
    const y0 = cy - blockH / 2 + lineH / 2;
    const strokeW = px * (preset === 'outline' ? 0.17 : preset === 'minimal' || preset === 'neon' ? 0 : preset === 'yellow' ? 0.16 : preset === 'box' ? 0.09 : preset === 'stack' ? 0.12 : 0.11);
    const keyFill = st.keyColour || '#ff4d6d';
    const accent = st.accent || '#f7c948';
    let minX = Infinity, maxX = -Infinity;
    lines.forEach((line, li) => {
      const widths = line.map((w) => ctx.measureText(text(w)).width);
      const emojis = line.map(emo);
      const ew = emojis.map((e) => (e ? ctx.measureText(e).width : 0));
      const iw = widths.map((w, i) => w + (emojis[i] ? px * 0.18 + ew[i] : 0));
      const gap = px * gapK;
      const lineW = iw.reduce((s, w) => s + w, 0) + gap * (line.length - 1);
      let x = anc.cx - lineW / 2;
      if (anc.custom) x = clamp(x, W * 0.02, Math.max(W * 0.02, W * 0.98 - lineW));
      minX = Math.min(minX, x); maxX = Math.max(maxX, x + lineW);
      const y = y0 + li * lineH;
      if (preset === 'minimal') {
        const padX = px * 0.4, padY = px * 0.22, r = px * 0.28;
        ctx.fillStyle = hexA(st.box || '#0b1020', 0.78);
        ctx.beginPath();
        ctx.roundRect(x - padX, y - lineH / 2 + px * 0.02 - padY / 2, lineW + padX * 2, lineH + padY - px * 0.04, r);
        ctx.fill();
      }
      /* right-to-left lines are laid out from the right: the first word is the rightmost */
      const order = line.map((w, i) => i);
      if (rtl) order.reverse();
      order.forEach((i) => {
        const w = line[i];
        const spoken = t >= w.start, current = t >= w.start && t < w.end;
        const s = text(w);
        const icx = x + iw[i] / 2, wy = y;
        /* where the word and its emoji sit inside the item, from its centre */
        const wordOff = emojis[i] ? (rtl ? iw[i] / 2 - widths[i] / 2 : widths[i] / 2 - iw[i] / 2) : 0;
        const emoOff = emojis[i] ? (rtl ? ew[i] / 2 - iw[i] / 2 : iw[i] / 2 - ew[i] / 2) : 0;
        let scale = 1, fill = st.fill || '#ffffff';
        if (preset === 'karaoke' && spoken) fill = accent;
        if (preset === 'pop' && current) { fill = accent; scale = 1.18; }
        if (preset === 'yellow' && current) { fill = accent; scale = 1.1; }
        if (preset === 'neon' && current) fill = accent;
        if (isKey(w)) fill = keyFill;
        if (preset === 'stack') scale = 0.55 + 0.45 * backOut(clamp((t - w.start) / 0.22, 0, 1));
        ctx.save();
        ctx.translate(icx, wy); ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        if (preset === 'box' && current) {
          const padX = px * 0.16, h = px * 1.12;
          ctx.fillStyle = accent;
          ctx.beginPath(); ctx.roundRect(wordOff - widths[i] / 2 - padX, -h / 2 + px * 0.03, widths[i] + padX * 2, h, px * 0.22); ctx.fill();
          ctx.fillStyle = isKey(w) ? keyFill : inkOn(accent);
          ctx.fillText(s, wordOff, 0);
        } else if (preset === 'neon') {
          ctx.shadowColor = current ? accent : hexA(accent, 0.55);
          ctx.shadowBlur = px * (current ? 0.75 : 0.28);
          ctx.fillStyle = fill; ctx.fillText(s, wordOff, 0);
          if (current) ctx.fillText(s, wordOff, 0);
          ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
          ctx.fillStyle = fill; ctx.fillText(s, wordOff, 0);
        } else {
          if (preset !== 'minimal') {
            ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = px * 0.22; ctx.shadowOffsetY = px * 0.05;
            ctx.fillStyle = fill; ctx.fillText(s, wordOff, 0);
            ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            if (strokeW > 0) { ctx.lineWidth = strokeW * 2; ctx.strokeStyle = st.stroke || '#000000'; ctx.strokeText(s, wordOff, 0); }
          }
          ctx.fillStyle = fill; ctx.fillText(s, wordOff, 0);
        }
        /* an emoji is drawn as itself: no outline, a soft shadow */
        if (emojis[i]) {
          ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = px * 0.16; ctx.shadowOffsetY = px * 0.04;
          ctx.fillStyle = '#ffffff'; ctx.fillText(emojis[i], emoOff, 0);
        }
        ctx.restore();
        x += iw[i] + gap;
      });
    });
    ctx.restore();
    return { x: minX, y: cy - blockH / 2, w: maxX - minX, h: blockH };
  }

  /* ------------------------------------------------------------------ */
  /* ASS (Advanced SubStation Alpha)                                    */
  /* ------------------------------------------------------------------ */
  /** &HAABBGGRR from #rrggbb, alpha 0 = opaque. */
  const assColour = (hex, alpha, d) => { const [r, g, b] = rgbOf(hex, d || '#ffffff'); const h2 = (n) => n.toString(16).toUpperCase().padStart(2, '0'); return '&H' + h2(alpha || 0) + h2(b) + h2(g) + h2(r); };
  /* ASS has no escape for braces or backslashes in dialogue text */
  const assText = (s) => String(s).replace(/\\/g, '∖').replace(/\{/g, '(').replace(/\}/g, ')').replace(/[\r\n]+/g, ' ');
  /**
   * An .ass file for the cues (fileCues), for a W×H video (o.width,
   * o.height). The one style carries the font, size, colours, outline and
   * position of the burned-in captions; a dragged position is set on every
   * line with \an5\pos. Karaoke gets a \k tag per word, so players that
   * render ASS light each word as it is spoken; keywords get their colour.
   * The animated looks (Pop, Word box, Neon, One word) and emoji are drawn
   * into the video only.
   */
  function toASS(cues, st, o) {
    st = st || {}; o = o || {};
    const W = Math.round(o.width || 1080), H = Math.round(o.height || 1920);
    const preset = st.preset;
    const px = sizePx(st, W);
    const lineH = px * 1.22;
    const karaoke = preset === 'karaoke';
    const fill = st.fill || '#ffffff', accent = st.accent || '#f7c948';
    const primary = assColour(karaoke ? accent : fill), secondary = assColour(karaoke ? fill : accent);
    const minimal = preset === 'minimal';
    const strokeW = px * (preset === 'outline' ? 0.17 : minimal || preset === 'neon' ? 0 : preset === 'yellow' ? 0.16 : preset === 'box' ? 0.09 : preset === 'stack' ? 0.12 : 0.11);
    const outlineCol = minimal ? assColour(st.box || '#0b1020', 0x38) : assColour(st.stroke || '#000000');
    const backCol = minimal ? assColour(st.box || '#0b1020', 0x38) : assColour('#000000', 0x70);
    const anc = anchorOf(st, W, H);
    const align = st.position === 'top' ? 8 : st.position === 'middle' ? 5 : 2;
    const marginV = align === 5 ? 0 : align === 8 ? Math.max(0, Math.round(anc.cy - lineH / 2)) : Math.max(0, Math.round(H - (anchorOf(Object.assign({}, st, { position: 'bottom' }), W, H).cy + lineH / 2)));
    const font = String(st.font === 'system-ui' ? 'Arial' : (st.font || 'Sora')).replace(/,/g, ' ');
    const style = ['Default', font, Math.round(px), primary, secondary, outlineCol, backCol, -1, 0, 0, 0, 100, 100, 0, 0,
      minimal ? 3 : 1, minimal ? Math.round(px * 0.3) : Math.round(strokeW * 10) / 10, minimal || preset === 'neon' ? 0 : Math.round(px * 0.05 * 10) / 10,
      align, Math.round(W * 0.07), Math.round(W * 0.07), marginV, 1];
    const upper = st.uppercase || preset === 'yellow';
    const keys = keySetOf(st.keywords);
    const keyCol = assColour(st.keyColour || '#ff4d6d');
    const out = [
      '[Script Info]',
      '; Made on the device by 1234Tools Auto Captions (Whisper tiny); nothing was uploaded.',
      'Title: ' + assText(o.title || 'Captions'),
      'ScriptType: v4.00+',
      'WrapStyle: 0',
      'ScaledBorderAndShadow: yes',
      'YCbCr Matrix: None',
      'PlayResX: ' + W,
      'PlayResY: ' + H,
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      'Style: ' + style.join(','),
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
    ];
    for (const c of cues) {
      const ns = c.nospace || isNoSpace(c.lang, c.lines.join(''));
      const lines = wrapWords(c.words, ns ? MAX_LINE_CJK : MAX_LINE, joinerOf(ns));
      const flat = lines.flat();
      /* \k durations from cumulative centiseconds, so they add up to the line exactly */
      const startCs = Math.round(c.start * 100), endCs = Math.round(c.end * 100);
      const at = flat.map((w, i) => i === 0 ? startCs : clamp(Math.round(w.start * 100), startCs, endCs));
      for (let i = 1; i < at.length; i++) if (at[i] < at[i - 1]) at[i] = at[i - 1];
      let k = 0;
      const body = lines.map((line) => line.map((w) => {
        const i = k++;
        const next = i + 1 < at.length ? at[i + 1] : endCs;
        let tag = karaoke ? '\\k' + Math.max(0, next - at[i]) : '';
        const isKey = keys.size > 0 && keys.has(normWord(w.text));
        if (isKey) tag += '\\1c' + keyCol.replace('&H00', '&H') + '&' + (karaoke ? '\\2c' + keyCol.replace('&H00', '&H') + '&' : '');
        const txt = assText(upper ? w.text.toUpperCase() : w.text);
        const after = isKey ? '{\\1c' + primary.replace('&H00', '&H') + '&' + (karaoke ? '\\2c' + secondary.replace('&H00', '&H') + '&' : '') + '}' : '';
        return (tag ? '{' + tag + '}' : '') + txt + after;
      }).join(joinerOf(ns))).join('\\N');
      let pos = '';
      if (anc.custom) {
        const blockH = lineH * lines.length;
        const cy = clamp(anc.cy, blockH / 2 + px * 0.3, H - blockH / 2 - px * 0.3);
        pos = '{\\an5\\pos(' + Math.round(anc.cx) + ',' + Math.round(cy) + ')}';
      }
      out.push('Dialogue: 0,' + assTime(c.start) + ',' + assTime(c.end) + ',Default,,0,0,0,,' + pos + body);
    }
    return '\uFEFF' + out.join('\r\n') + '\r\n';
  }

  /** The backdrop for an audio-only file: a quiet gradient and a title. */
  function drawBackdrop(ctx, W, H, name) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1020'); g.addColorStop(1, '#06080f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.fillStyle = 'rgba(247,201,72,.08)';
    ctx.beginPath(); ctx.arc(W * 0.5, H * 0.42, Math.min(W, H) * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(244,246,251,.55)';
    ctx.font = '600 ' + Math.round(W * 0.034) + 'px "Inter", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(name || '').slice(0, 48), W / 2, H * 0.09);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* muxing: one door, whichever encoder is behind it                   */
  /* ------------------------------------------------------------------ */
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
  async function pickAudio(buffer) {
    if (!buffer || typeof AudioEncoder === 'undefined' || !AudioEncoder.isConfigSupported) return null;
    const ch = Math.min(2, buffer.numberOfChannels), sr = buffer.sampleRate;
    for (const [codec, name] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
      const cfg = { codec, sampleRate: sr, numberOfChannels: ch, bitrate: ch > 1 ? 160000 : 96000 };
      try { const r = await AudioEncoder.isConfigSupported(cfg); if (r && r.supported) return { config: r.config || cfg, name }; }
      catch (e) { /* next */ }
    }
    return null;
  }
  /** Can this browser put sound in the export at all? Answered once, for the hint under the export button. */
  async function audioSupport() {
    if (typeof AudioEncoder === 'undefined') return typeof MediaRecorder !== 'undefined' ? 'recorder' : 'none';
    try { const r = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: AUDIO_RATE, numberOfChannels: 2, bitrate: 160000 }); if (r && r.supported) return 'aac'; } catch (e) { /* */ }
    try { const r = await AudioEncoder.isConfigSupported({ codec: 'opus', sampleRate: AUDIO_RATE, numberOfChannels: 2, bitrate: 160000 }); if (r && r.supported) return 'opus'; } catch (e) { /* */ }
    return typeof MediaRecorder !== 'undefined' ? 'recorder' : 'none';
  }

  /**
   * Frames in, a file out. `frames` is an async iterator of
   * { frame: VideoFrame } | { bitmap: ImageBitmap } | { canvas }, each with
   * timestampUs and durationUs. Returns { blob, ext, note, silent }.
   */
  async function muxVideo(o) {
    const forced = A.__forceRecorder === true;
    if (!forced && typeof A.encodeVideoFrames === 'function') {
      const r = await A.encodeVideoFrames(o.frames, { width: o.width, height: o.height, fps: o.fps, audio: o.audioBuffer ? { buffer: o.audioBuffer } : null, onProgress: o.onProgress, signal: o.signal, duration: o.duration });
      return Object.assign({ silent: !o.audioBuffer }, r);
    }
    if (!forced && typeof VideoEncoder !== 'undefined') {
      const r = await encodeWithWebCodecs(o);
      if (r) return r;
    }
    return recordFrames(o);
  }

  async function encodeWithWebCodecs(o) {
    const w = evenDown(o.width), h = evenDown(o.height), fps = o.fps;
    const bitrate = Math.round(clamp(w * h * fps * 0.1, 1.5e6, 12e6));
    const vconfig = await pickAvc(w, h, fps, bitrate);
    if (!vconfig) return null;
    const audio = await pickAudio(o.audioBuffer);
    const M = await import('/engine/vendor/mp4-muxer.mjs');
    const target = new M.ArrayBufferTarget();
    const muxer = new M.Muxer({
      target,
      video: { codec: 'avc', width: w, height: h, frameRate: fps },
      audio: audio ? { codec: audio.name, numberOfChannels: audio.config.numberOfChannels, sampleRate: audio.config.sampleRate } : undefined,
      fastStart: 'in-memory', firstTimestampBehavior: 'offset'
    });
    let failure = null;
    const venc = new VideoEncoder({ output: (c, m) => { try { muxer.addVideoChunk(c, m); } catch (e) { failure = e; } }, error: (e) => { failure = e; } });
    venc.configure(vconfig);
    const report = o.onProgress || (() => {});
    const dur = o.duration || 0;
    let lastKey = -Infinity, n = 0, lastTs = -1;
    try {
      for await (const item of o.frames) {
        if (o.signal && o.signal.aborted) throw abortError();
        if (failure) throw failure;
        let ts = item.timestampUs;
        if (ts <= lastTs) ts = lastTs + 1;
        lastTs = ts;
        const vf = item.frame ? item.frame : new VideoFrame(item.bitmap || item.canvas, { timestamp: ts, duration: item.durationUs });
        const key = ts - lastKey >= 2e6;
        if (key) lastKey = ts;
        venc.encode(vf, { keyFrame: key });
        vf.close();
        if (item.bitmap) item.bitmap.close();
        n++;
        while (venc.encodeQueueSize > 6) await sleep(4);
        if (dur && (n & 3) === 0) report({ fraction: Math.min(0.9, ts / 1e6 / dur * 0.9), stage: 'video', seconds: ts / 1e6 });
      }
      await venc.flush();
      if (failure) throw failure;
    } finally {
      try { if (venc.state !== 'closed') venc.close(); } catch (e) { /* done */ }
    }
    if (audio) {
      report({ fraction: 0.92, stage: 'audio' });
      const buf = o.audioBuffer, ch = audio.config.numberOfChannels, sr = buf.sampleRate;
      const aenc = new AudioEncoder({ output: (c, m) => { try { muxer.addAudioChunk(c, m); } catch (e) { failure = e; } }, error: (e) => { failure = e; } });
      aenc.configure(audio.config);
      const planes = []; for (let c = 0; c < ch; c++) planes.push(buf.getChannelData(c));
      const total = dur ? Math.min(buf.length, Math.ceil(dur * sr) + sr / 10) : buf.length;
      try {
        for (let pos = 0; pos < total; pos += 1024) {
          if (o.signal && o.signal.aborted) throw abortError();
          if (failure) throw failure;
          const len = Math.min(1024, total - pos);
          const data = new Float32Array(len * ch);
          for (let c = 0; c < ch; c++) data.set(planes[c].subarray(pos, pos + len), c * len);
          const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: len, numberOfChannels: ch, timestamp: Math.round(pos * 1e6 / sr), data });
          aenc.encode(ad); ad.close();
          if (aenc.encodeQueueSize > 24) await sleep(2);
        }
        await aenc.flush();
        if (failure) throw failure;
      } finally {
        try { if (aenc.state !== 'closed') aenc.close(); } catch (e) { /* done */ }
      }
    }
    muxer.finalize();
    report({ fraction: 1, stage: 'done' });
    const note = audio ? 'H.264 MP4 with ' + (audio.name === 'aac' ? 'AAC' : 'Opus') + ' sound' : (o.audioBuffer ? 'H.264 MP4 — this browser could not encode the sound, so the clip is silent' : 'H.264 MP4');
    return { blob: new Blob([target.buffer], { type: 'video/mp4' }), ext: 'mp4', note, silent: !audio };
  }

  /* No WebCodecs (Firefox): MediaRecorder captures the canvas in real time,
     with the decoded sound played into the same stream. */
  async function recordFrames(o) {
    if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot encode video on the device. Chrome, Edge or Safari 16.4+ can.');
    const w = evenDown(o.width), h = evenDown(o.height), fps = o.fps;
    const canvas = el('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0];
    let ac = null, start = null, withAudio = false;
    if (o.audioBuffer && (window.AudioContext || window.webkitAudioContext)) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: o.audioBuffer.sampleRate });
        const dest = ac.createMediaStreamDestination();
        const src = ac.createBufferSource(); src.buffer = o.audioBuffer; src.connect(dest);
        for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
        start = () => src.start(0);
        withAudio = true;
      } catch (e) { ac = null; }
    }
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    const mime = types.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } });
    if (!mime) throw new Error('This browser cannot record video.');
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(clamp(w * h * fps * 0.1, 1.5e6, 12e6)) });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res) => { rec.onstop = res; });
    const report = o.onProgress || (() => {});
    rec.start(250);
    const t0 = performance.now();
    if (start) start();
    try {
      for await (const item of o.frames) {
        if (o.signal && o.signal.aborted) throw abortError();
        const due = t0 + item.timestampUs / 1000;
        const wait = due - performance.now();
        if (wait > 0) await sleep(wait);
        ctx.drawImage(item.frame || item.bitmap || item.canvas, 0, 0, w, h);
        if (item.frame) item.frame.close();
        if (item.bitmap) item.bitmap.close();
        if (track.requestFrame) track.requestFrame();
        if (o.duration) report({ fraction: Math.min(0.98, item.timestampUs / 1e6 / o.duration), stage: 'video', seconds: item.timestampUs / 1e6 });
      }
      await sleep(150);
    } finally {
      try { rec.stop(); } catch (e) { /* */ }
      await stopped;
      if (ac) { try { ac.close(); } catch (e) { /* */ } }
    }
    report({ fraction: 1, stage: 'done' });
    const mp4 = /mp4/.test(mime);
    return { blob: new Blob(chunks, { type: mp4 ? 'video/mp4' : 'video/webm' }), ext: mp4 ? 'mp4' : 'webm', silent: !withAudio,
      note: (mp4 ? 'MP4' : 'WebM') + ' recorded in real time' + (withAudio ? ' with sound' : ' — this browser could not add the sound, so the clip is silent') + (mp4 ? '' : '. This browser has no on-device MP4 encoder; WebM plays everywhere a browser does.') };
  }

  /* ------------------------------------------------------------------ */
  /* frame sources                                                      */
  /* ------------------------------------------------------------------ */
  /** Play the hidden video once and hand over every presented frame, drawn with captions, at its real media time. */
  async function* framesFromPlayback(video, width, height, fps, draw, signal) {
    const canvas = el('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const queue = [];
    let waiting = null, ended = false, lastT = -1, handle = 0, dropped = 0;
    const wake = () => { if (waiting) { const w = waiting; waiting = null; w(); } };
    const onEnded = () => { ended = true; wake(); };
    const onError = () => { ended = true; wake(); };
    const snap = (t) => {
      ctx.drawImage(video, 0, 0, width, height);
      draw(ctx, width, height, t);
      const ts = Math.round(t * 1e6), du = Math.round(1e6 / fps);
      if (typeof VideoFrame !== 'undefined') return { frame: new VideoFrame(canvas, { timestamp: ts, duration: du }), timestampUs: ts, durationUs: du };
      const copy = el('canvas'); copy.width = width; copy.height = height; copy.getContext('2d').drawImage(canvas, 0, 0);
      return { canvas: copy, timestampUs: ts, durationUs: du };
    };
    const cb = (now, meta) => {
      let t = meta.mediaTime;
      if (lastT < 0 && t < 1 / fps) t = 0;
      if (t > lastT + 1e-4) {
        if (queue.length < 8) { queue.push(snap(t)); lastT = t; wake(); }
        else { dropped++; if (dropped === 12 && video.playbackRate > 0.5) video.playbackRate = 0.5; }
      }
      if (!ended) handle = video.requestVideoFrameCallback(cb);
    };
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.muted = true; video.playbackRate = 1; video.currentTime = 0;
    handle = video.requestVideoFrameCallback(cb);
    await video.play();
    try {
      for (;;) {
        if (signal && signal.aborted) throw abortError();
        if (queue.length) { yield queue.shift(); continue; }
        if (ended) break;
        await new Promise((r) => { waiting = r; setTimeout(r, 400); });
      }
      while (queue.length) yield queue.shift();
    } finally {
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      try { video.cancelVideoFrameCallback(handle); } catch (e) { /* */ }
      video.pause(); video.playbackRate = 1;
      for (const q of queue) { if (q.frame) q.frame.close(); }
    }
  }
  /** Step through time at the chosen rate: for audio-only files, and for browsers without requestVideoFrameCallback. */
  async function* framesStepped(video, width, height, fps, duration, draw, signal) {
    const canvas = el('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const total = Math.max(1, Math.round(duration * fps));
    for (let i = 0; i < total; i++) {
      if (signal && signal.aborted) throw abortError();
      const t = i / fps;
      if (video) {
        await new Promise((res) => {
          const done = () => { video.removeEventListener('seeked', done); res(); };
          video.addEventListener('seeked', done);
          video.currentTime = Math.min(t, Math.max(0, duration - 0.001));
          setTimeout(done, 1500);
        });
        ctx.drawImage(video, 0, 0, width, height);
      }
      draw(ctx, width, height, t);
      yield { canvas, timestampUs: Math.round(i * 1e6 / fps), durationUs: Math.round(1e6 / fps) };
      if ((i & 3) === 3) await sleep(0);
    }
  }

  /* ------------------------------------------------------------------ */
  /* remembered settings (one versioned key; no words, no file names)   */
  /* ------------------------------------------------------------------ */
  const HEX = /^#[0-9a-f]{6}$/i;
  function loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!p || p.v !== 1) return null;
      const st = {}, s = p.style || {};
      if (STYLE_IDS.indexOf(s.preset) >= 0) st.preset = s.preset;
      if (MODES.some((m) => m[0] === s.mode)) st.mode = s.mode;
      if (POSITIONS.some((m) => m[0] === s.position)) st.position = s.position;
      if (isFinite(s.x) && isFinite(s.y)) { st.x = clamp(Number(s.x), 0, 1); st.y = clamp(Number(s.y), 0, 1); }
      if (st.position === 'custom' && !isFinite(st.y)) st.position = 'bottom';
      if (isFinite(s.size)) st.size = clamp(Number(s.size), 4, 12);
      if (FONTS.some((f) => f[0] === s.font)) st.font = s.font;
      for (const k of ['fill', 'accent', 'stroke', 'box', 'keyColour']) if (HEX.test(s[k] || '')) st[k] = s[k];
      if (typeof s.uppercase === 'boolean') st.uppercase = s.uppercase;
      if (typeof s.autoEmoji === 'boolean') st.autoEmoji = s.autoEmoji;
      return { lang: LANGS.some((l) => l[0] === p.lang) ? p.lang : null, style: st };
    } catch (e) { return null; }
  }
  function savePrefs(lang, style) {
    const keep = {};
    for (const k of ['preset', 'mode', 'position', 'x', 'y', 'size', 'font', 'fill', 'accent', 'stroke', 'box', 'keyColour', 'uppercase', 'autoEmoji']) if (style[k] !== undefined) keep[k] = style[k];
    try { localStorage.setItem(STORE, JSON.stringify({ v: 1, lang, style: keep })); } catch (e) { /* private window or storage blocked: the settings still apply to this visit */ }
  }
  const langName = (code) => {
    const own = LANGS.find((l) => l[0] === code);
    if (own) return own[1].split(' — ')[0];
    try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code; } catch (e) { return code; }
  };
  /* blob type → extension, so a file's name always matches what it holds */
  const EXT = { 'application/x-subrip': 'srt', 'text/vtt': 'vtt', 'text/x-ass': 'ass', 'video/mp4': 'mp4', 'video/webm': 'webm' };
  const extOf = (blob) => EXT[String(blob.type).split(';')[0]] || 'bin';

  /* ------------------------------------------------------------------ */
  /* the tool                                                           */
  /* ------------------------------------------------------------------ */
  function mount(root) {
    const Wh = window.AIVidWhisper;
    if (!Wh) throw new Error('aivid-whisper.js did not load');
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const prefs = loadPrefs() || { lang: null, style: {} };
    const S = {
      file: null, name: 'clip', url: null, media: null, hasVideo: false, vw: 0, vh: 0, duration: 0,
      audio: null, segments: [], original: [], cues: [], lang: null, detection: null, lastBox: null,
      style: Object.assign({ preset: 'karaoke', mode: '2', position: 'bottom', size: 7, font: 'Sora', fill: '#ffffff', accent: '#f7c948', stroke: '#000000', box: '#0b1020', uppercase: false, keyColour: '#ff4d6d', autoEmoji: false, keywords: [] }, prefs.style, { keywords: [] }),
      t: 0, playing: false, job: null, busy: false, transcribed: false, exporting: false, live: -1
    };

    /* ---------------- skeleton ---------------- */
    const wrap = el('div', 'aiimg aivid');
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose a video or audio file</strong><span>or drag it here — nothing is uploaded. MP4, MOV, WebM, MP3, WAV or M4A, up to 10 minutes. English, Hindi and 11 other languages by name; Auto-detect for the rest.</span>';
    const file = el('input', 'visually-hidden');
    file.type = 'file'; file.accept = 'video/*,audio/*'; file.setAttribute('aria-label', 'Choose a video or audio file');
    /* the language: chosen before the file, and changeable after it */
    const langSel = select('aivid-lang', LANGS, prefs.lang || 'auto');
    langSel.setAttribute('aria-describedby', 'aivid-lang-hint');
    const again = button('Transcribe again', 'btn-ghost', () => { if (S.audio && !S.busy && !S.job && !S.exporting) runTranscribe(); });
    again.disabled = true;
    const langHint = el('p', 'field-hint', 'Auto-detect listens to the first 30 seconds. Whisper tiny is most accurate in English; check other languages carefully.');
    langHint.id = 'aivid-lang-hint';
    const langRow = el('div', 'aiimg-row aivid-langrow');
    langRow.append(field('Language spoken', langSel), again);
    const langBox = el('div', 'aivid-langbox'); langBox.append(langRow, langHint);
    const langBase = langHint.textContent;
    function syncLangHint() { langHint.textContent = LANG_NOTES[langSel.value] ? LANG_NOTES[langSel.value] + ' ' + langBase : langBase; }
    syncLangHint();
    langSel.addEventListener('change', () => { savePrefs(langSel.value, S.style); syncLangHint(); again.disabled = !S.audio || S.busy; });
    const studio = el('div', 'aiimg-studio'); studio.hidden = true;
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage');
    const canvas = el('canvas', 'aiimg-canvas aivid-canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Preview of the captioned video. Drag the captions to move them, or focus here and use the arrow keys (Shift for bigger steps).');
    const stageMsg = el('div', 'aiimg-stagemsg'); stageMsg.hidden = true;
    stage.append(canvas, stageMsg);
    const transport = el('div', 'aiimg-transport');
    const play = button('▶ Play', 'btn-ghost');
    const scrub = el('input', 'range'); scrub.type = 'range'; scrub.min = 0; scrub.max = 1000; scrub.step = 1; scrub.value = 0; scrub.setAttribute('aria-label', 'Position in the clip');
    const clockEl = el('span', 'range-val', '0.0 s');
    const change = button('Change file', 'btn-ghost', () => file.click());
    transport.append(play, scrub, clockEl, change);
    stageCol.append(stage, transport);
    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['words', 'Transcript'], ['style', 'Style'], ['export', 'Export']]) {
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
    wrap.append(langBox, drop, file, studio, msg);
    io.appendChild(wrap);
    function showPane(k) {
      for (const b of tabs.children) { const onIt = b.dataset.pane === k; b.classList.toggle('is-on', onIt); b.setAttribute('aria-selected', onIt ? 'true' : 'false'); }
      for (const p in panes) panes[p].hidden = p !== k;
    }
    function say(text, kind) { msg.textContent = text || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); }
    function note(text) { stageMsg.textContent = text || ''; stageMsg.hidden = !text; }
    const grid = (...fields) => { const g = el('div', 'aiimg-grid2'); g.append(...fields); return g; };
    const h = (t) => el('p', 'aiimg-h', t);

    /* ---------------- drawing ---------------- */
    const pctx = canvas.getContext('2d');
    let dirty = true;
    const invalidate = () => { dirty = true; };
    function frameSize(longEdge) {
      let w, hh;
      if (S.hasVideo) { w = S.vw; hh = S.vh; } else { w = 1080; hh = 1920; }
      const portrait = hh >= w;
      const maxW = portrait ? 1080 : 1920, maxH = portrait ? 1920 : 1080;
      let s = Math.min(1, maxW / w, maxH / hh);
      if (longEdge === '720') s = Math.min(s, 720 / Math.min(w, hh));
      return { width: evenDown(w * s), height: evenDown(hh * s) };
    }
    function sizePreview() {
      const { width, height } = frameSize('1080');
      const s = Math.min(1, PREVIEW_MAX / Math.max(width, height));
      canvas.width = Math.max(2, Math.round(width * s)); canvas.height = Math.max(2, Math.round(height * s));
    }
    /** The style as drawn: emoji only for English, the keywords as marked. */
    function drawStyle() { return Object.assign({}, S.style, { autoEmoji: !!S.style.autoEmoji && emojiAllowed() }); }
    const emojiAllowed = () => (S.lang || (langSel.value === 'auto' ? 'en' : langSel.value)) === 'en';
    /** The frame at time t: the video (or the backdrop), then the captions. */
    function drawOverlay(ctx, Wd, Ht, t) { return drawCaptions(ctx, Wd, Ht, t, S.cues, drawStyle()); }
    function renderFrame(ctx, Wd, Ht, t) {
      ctx.save();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      if (S.hasVideo && S.media && S.media.readyState >= 2) ctx.drawImage(S.media, 0, 0, Wd, Ht);
      else if (S.hasVideo) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, Wd, Ht); }
      else drawBackdrop(ctx, Wd, Ht, S.name);
      const box = drawOverlay(ctx, Wd, Ht, t);
      ctx.restore();
      return box;
    }
    function draw() {
      if (!S.file) return;
      S.lastBox = renderFrame(pctx, canvas.width, canvas.height, S.t);
      dirty = false;
    }
    let mounted = true;
    function loop() {
      if (!mounted) return;
      if (S.playing && S.media && !S.exporting) {
        S.t = S.media.currentTime;
        if (S.duration) scrub.value = Math.round(S.t / S.duration * 1000);
        clockEl.textContent = S.t.toFixed(1) + ' s';
        markLive();
        dirty = true;
        if (S.media.ended) setPlaying(false);
      }
      if (dirty) draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    function setPlaying(v) {
      if (!S.media) v = false;
      S.playing = v;
      if (S.media) {
        if (v) { S.media.muted = false; S.media.play().catch(() => { S.playing = false; play.textContent = '▶ Play'; }); }
        else S.media.pause();
      }
      play.textContent = v ? '❚❚ Pause' : '▶ Play';
      play.setAttribute('aria-pressed', v ? 'true' : 'false');
    }
    play.addEventListener('click', () => { if (S.exporting) return; setPlaying(!S.playing); });
    scrub.addEventListener('input', () => {
      if (S.exporting) return;
      setPlaying(false);
      S.t = Number(scrub.value) / 1000 * S.duration;
      clockEl.textContent = S.t.toFixed(1) + ' s';
      if (S.media) S.media.currentTime = S.t;
      markLive();
      invalidate();
    });

    /* ---------------- dragging the captions ---------------- */
    let drag = null;
    const toFrame = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / Math.max(1, r.width), y: (e.clientY - r.top) * canvas.height / Math.max(1, r.height) }; };
    /** The block's box now, or where it would be: the anchor band when no cue is on screen. */
    function grabBox() {
      if (S.lastBox) return S.lastBox;
      const a = anchorOf(S.style, canvas.width, canvas.height), px = sizePx(S.style, canvas.width);
      return { x: canvas.width * 0.07, y: a.cy - px, w: canvas.width * 0.86, h: px * 2 };
    }
    const inBox = (p, b, m) => p.x >= b.x - m && p.x <= b.x + b.w + m && p.y >= b.y - m && p.y <= b.y + b.h + m;
    function placeAt(cx, cy) {
      S.style.position = 'custom';
      S.style.x = clamp(cx / canvas.width, 0.04, 0.96);
      S.style.y = clamp(cy / canvas.height, 0.04, 0.96);
      if (posSel.value !== 'custom') posSel.value = 'custom';
      invalidate();
    }
    canvas.addEventListener('pointerdown', (e) => {
      if (!S.file || S.exporting || (e.button !== undefined && e.button !== 0)) return;
      const p = toFrame(e), b = grabBox();
      /* a finger gets a wider margin than a mouse */
      if (!inBox(p, b, canvas.width * (e.pointerType === 'touch' ? 0.07 : 0.03))) return;
      e.preventDefault();
      const a = anchorOf(S.style, canvas.width, canvas.height);
      const cx = S.style.position === 'custom' ? a.cx : b.x + b.w / 2, cy = b.y + b.h / 2;
      drag = { id: e.pointerId, dx: p.x - cx, dy: p.y - cy };
      try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
      canvas.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (drag && e.pointerId === drag.id) { const p = toFrame(e); placeAt(p.x - drag.dx, p.y - drag.dy); return; }
      if (e.pointerType === 'mouse' && S.file) canvas.classList.toggle('is-grab', inBox(toFrame(e), grabBox(), canvas.width * 0.03));
    });
    const endDrag = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      drag = null;
      canvas.classList.remove('is-dragging');
      styleChanged();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d || !S.file) return;
      e.preventDefault();
      const a = anchorOf(S.style, canvas.width, canvas.height);
      const step = (e.shiftKey ? 0.05 : 0.01);
      placeAt(a.cx + d[0] * step * canvas.width, a.cy + d[1] * step * canvas.height);
      styleChanged();
    });

    /* ---------------- transcript pane ---------------- */
    const status = el('p', 'aiimg-status', 'Choose a video or audio file to begin.');
    status.setAttribute('aria-live', 'polite');
    const progress = el('div', 'aiimg-progress'); const bar = el('i'); progress.appendChild(bar); progress.hidden = true;
    const stopBtn = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); stopBtn.hidden = true;
    const progRow = el('div', 'aiimg-row aivid-progrow'); progRow.append(progress, stopBtn);
    const splitN = select('aivid-split-n', [['3', '3 words'], ['4', '4 words'], ['6', '6 words'], ['8', '8 words'], ['12', '12 words']], '6');
    const splitBtn = button('Re-split', 'btn-ghost', () => resplit(Number(splitN.value)));
    const restoreBtn = button('Restore', 'btn-ghost', () => { if (!S.original.length) return; S.segments = cloneSegs(S.original); refreshAll(); });
    const splitRow = el('div', 'aiimg-row aivid-splitrow');
    const splitField = field('Segments of', splitN);
    splitRow.append(splitField, splitBtn, restoreBtn);
    const srtLink = el('a', 'btn-download', 'Download SRT'); srtLink.download = 'captions.srt'; srtLink.href = '#';
    const vttLink = el('a', 'btn-download', 'Download VTT'); vttLink.download = 'captions.vtt'; vttLink.href = '#';
    const assLink = el('a', 'btn-download', 'Download ASS'); assLink.download = 'captions.ass'; assLink.href = '#';
    const links = el('div', 'aivid-links'); links.append(srtLink, vttLink, assLink); links.hidden = true;
    const segList = el('div', 'aivid-segs');
    /* keywords: a list to type, or words to click in the transcript */
    const keyInput = el('input', 'control');
    keyInput.type = 'text'; keyInput.id = 'aivid-keywords'; keyInput.placeholder = 'e.g. free, offline, captions'; keyInput.autocomplete = 'off';
    const markBtn = button('Mark keywords in the transcript', 'btn-ghost', () => setMarking(!marking));
    markBtn.setAttribute('aria-pressed', 'false');
    const keyRow = el('div', 'aiimg-row aivid-keyrow');
    keyRow.append(field('Keywords', keyInput), markBtn);
    const wordView = el('div', 'aivid-wordview'); wordView.hidden = true;
    const timingNote = el('p', 'field-hint aivid-timing', '');
    const hint = el('p', 'field-hint', 'Edit any line — names and numbers are where the smallest Whisper slips. ±0.1 s moves a segment; Split halves it; Re-split reflows the whole transcript into shorter segments with the same word timings. Keywords are drawn in the keyword colour (Style tab) wherever they appear.');
    panes.words.append(status, progRow, segList, wordView, keyRow, splitRow, links, timingNote, hint);

    const cloneSegs = (segs) => segs.map((s) => ({ start: s.start, end: s.end, text: s.text, lang: s.lang, timing: s.timing, words: s.words.map((w) => ({ text: w.text, start: w.start, end: w.end })) }));
    let urls = [];
    let filesTimer = 0;
    function refreshFiles() {
      clearTimeout(filesTimer);
      for (const u of urls) URL.revokeObjectURL(u);
      urls = [];
      const cues = fileCues(S.segments);
      const { width, height } = frameSize(sizeSel.value);
      const blobs = [
        [srtLink, new Blob([toSRT(cues)], { type: 'application/x-subrip' })],
        [vttLink, new Blob([toVTT(cues)], { type: 'text/vtt' })],
        [assLink, new Blob([toASS(cues, S.style, { width, height, title: S.name })], { type: 'text/x-ass' })]
      ];
      for (const [a, blob] of blobs) { a.href = URL.createObjectURL(blob); a.download = S.name + '.' + extOf(blob); urls.push(a.href); }
      links.hidden = !cues.length;
      S.fileCues = cues;
    }
    const scheduleFiles = () => { clearTimeout(filesTimer); if (S.segments.length) filesTimer = setTimeout(refreshFiles, 250); };
    function refreshCues() {
      const m = S.style.mode;
      S.cues = withHold(m === 'line' ? fileCues(S.segments) : wordCues(S.segments, Number(m) || 2));
      invalidate();
    }
    function refreshAll() { renderSegs(); refreshFiles(); refreshCues(); if (marking) renderWordView(); }
    function styleChanged() { invalidate(); scheduleFiles(); savePrefs(langSel.value, S.style); }
    const timeLabel = (s) => s.start.toFixed(2) + ' → ' + s.end.toFixed(2) + ' s';
    function renderSegs() {
      segList.innerHTML = '';
      S.segments.forEach((s, i) => {
        const row = el('div', 'aivid-seg'); row.dataset.i = i;
        const head = el('div', 'aivid-seg-head');
        const time = el('span', 'aivid-seg-time', timeLabel(s));
        const minus = button('−0.1 s', 'btn-ghost', () => nudge(i, -0.1));
        const plus = button('+0.1 s', 'btn-ghost', () => nudge(i, 0.1));
        const split = button('Split', 'btn-ghost', () => splitSeg(i));
        const del = button('×', 'btn-ghost', () => { S.segments.splice(i, 1); refreshAll(); });
        del.setAttribute('aria-label', 'Remove this segment');
        head.append(time, minus, plus, split, del);
        const ta = el('textarea', 'control aivid-seg-text'); ta.rows = 2; ta.value = s.text; ta.setAttribute('aria-label', 'Caption text ' + (i + 1));
        ta.dir = 'auto';
        if (s.lang) ta.lang = s.lang;
        ta.addEventListener('input', () => {
          /* the same number of words keeps every word's measured time; a different number re-splits this line by length */
          const old = s.words;
          s.text = ta.value;
          const fresh = Wh.wordsFor(s);
          if (old && old.length === fresh.length && s.timing !== 'proportional') fresh.forEach((w, k) => { w.start = old[k].start; w.end = old[k].end; });
          else if (s.timing === 'aligned') s.timing = 'proportional';
          s.words = fresh;
          scheduleFiles(); refreshCues();
        });
        ta.addEventListener('focus', () => { if (!S.playing) { S.t = s.start + 0.01; if (S.media) S.media.currentTime = S.t; scrub.value = S.duration ? Math.round(S.t / S.duration * 1000) : 0; clockEl.textContent = S.t.toFixed(1) + ' s'; invalidate(); } });
        row.append(head, ta);
        segList.appendChild(row);
      });
    }
    function nudge(i, d) {
      const s = S.segments[i]; if (!s) return;
      const lo = -s.start, hi = Math.max(0, S.duration - s.end);
      d = clamp(d, lo, hi);
      if (!d) return;
      s.start += d; s.end += d; for (const w of s.words) { w.start += d; w.end += d; }
      refreshAll();
    }
    const segJoin = (s) => joinerOf(isNoSpace(s.lang, s.text));
    function splitSeg(i) {
      const s = S.segments[i]; if (!s || s.words.length < 2) return;
      const k = Math.ceil(s.words.length / 2);
      const a = s.words.slice(0, k), b = s.words.slice(k);
      const j = segJoin(s);
      const mk = (ws) => ({ start: ws[0].start, end: ws[ws.length - 1].end, text: ws.map((w) => w.text).join(j), lang: s.lang, timing: s.timing, words: ws.map((w) => ({ text: w.text, start: w.start, end: w.end })) });
      S.segments.splice(i, 1, mk(a), mk(b));
      refreshAll();
    }
    /** Reflow every word into segments of at most n words, breaking early at the end of a sentence. */
    function resplit(n) {
      const words = S.segments.flatMap((s) => s.words.map((w) => ({ w, s })));
      if (!words.length) return;
      const out = [];
      let cur = [];
      const flush = () => {
        if (!cur.length) return;
        const s0 = cur[0].s, j = segJoin(s0);
        out.push({ start: cur[0].w.start, end: cur[cur.length - 1].w.end, text: cur.map((x) => x.w.text).join(j), lang: s0.lang, timing: s0.timing, words: cur.map((x) => ({ text: x.w.text, start: x.w.start, end: x.w.end })) });
        cur = [];
      };
      for (const x of words) {
        cur.push(x);
        if (cur.length >= n || /[.!?…。！？]["”’)」』]?$/.test(x.w.text)) flush();
      }
      flush();
      S.segments = out;
      refreshAll();
    }
    function markLive() {
      let live = -1;
      for (let i = 0; i < S.segments.length; i++) { const s = S.segments[i]; if (S.t >= s.start && S.t < s.end) { live = i; break; } }
      if (live === S.live) return;
      S.live = live;
      for (const row of segList.children) row.classList.toggle('is-live', Number(row.dataset.i) === live);
    }

    /* ---------------- keywords ---------------- */
    let marking = false;
    function keywordsChanged() {
      keyInput.value = S.style.keywords.join(', ');
      if (marking) for (const b of wordView.querySelectorAll('.aivid-word')) { const k = keySetOf(S.style.keywords).has(normWord(b.textContent)); b.classList.toggle('is-key', k); b.setAttribute('aria-pressed', k ? 'true' : 'false'); }
      invalidate(); scheduleFiles();
    }
    keyInput.addEventListener('input', () => {
      S.style.keywords = keyInput.value.split(/[,，、\n]+/).map((x) => x.trim()).filter(Boolean);
      const v = keyInput.value;
      keywordsChanged();
      keyInput.value = v;
    });
    function toggleKeyword(word) {
      const n = normWord(word);
      if (!n) return;
      const list = S.style.keywords.filter((k) => normWord(k) !== n);
      if (list.length === S.style.keywords.length) list.push(word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}\p{M}]+$/gu, ''));
      S.style.keywords = list;
      keywordsChanged();
    }
    function renderWordView() {
      wordView.innerHTML = '';
      const keys = keySetOf(S.style.keywords);
      S.segments.forEach((s) => {
        const p = el('p', 'aivid-wordline');
        p.dir = 'auto';
        if (s.lang) p.lang = s.lang;
        const j = segJoin(s);
        s.words.forEach((w, k) => {
          const b = button(w.text, 'aivid-word', () => toggleKeyword(w.text));
          const on = keys.has(normWord(w.text));
          b.classList.toggle('is-key', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
          p.appendChild(b);
          if (j && k < s.words.length - 1) p.appendChild(document.createTextNode(' '));
        });
        wordView.appendChild(p);
      });
    }
    function setMarking(v) {
      marking = !!v && S.segments.length > 0;
      markBtn.setAttribute('aria-pressed', marking ? 'true' : 'false');
      markBtn.textContent = marking ? 'Back to editing the text' : 'Mark keywords in the transcript';
      segList.hidden = marking; wordView.hidden = !marking;
      if (marking) renderWordView();
    }

    /* ---------------- style pane ---------------- */
    const swatches = el('div', 'aivid-swatches');
    const swatchBtns = {};
    for (const [k, label, desc] of STYLES) {
      const b = button('', 'aivid-swatch', () => { S.style.preset = k; syncSwatches(); styleChanged(); });
      b.dataset.preset = k; b.title = desc;
      const sample = el('span', 'aivid-sample is-' + k);
      sample.innerHTML = k === 'karaoke' ? '<em>Word by</em> word' : (k === 'pop' || k === 'box' || k === 'neon') ? 'Word <em>by</em> word' : k === 'yellow' ? 'WORD <em>BY</em> WORD' : k === 'stack' ? '<em>Word</em>' : 'Word by word';
      b.append(sample, el('span', 'aivid-swatch-name', label));
      swatches.appendChild(b); swatchBtns[k] = b;
    }
    function syncSwatches() { for (const k in swatchBtns) { const onIt = k === S.style.preset; swatchBtns[k].classList.toggle('is-on', onIt); swatchBtns[k].setAttribute('aria-pressed', onIt ? 'true' : 'false'); } }
    syncSwatches();
    const modeSel = on(select('aivid-mode', MODES, S.style.mode), () => { S.style.mode = modeSel.value; refreshCues(); styleChanged(); });
    const posSel = on(select('aivid-pos', POSITIONS, S.style.position), () => {
      if (posSel.value === 'custom' && !isFinite(S.style.y)) { const a = anchorOf(S.style, canvas.width || 1, canvas.height || 1); S.style.x = 0.5; S.style.y = a.cy / (canvas.height || 1); }
      S.style.position = posSel.value; styleChanged();
    });
    const sizeCtl = on(range('aivid-size', 4, 12, 0.5, S.style.size, (v) => v.toFixed(1) + '%'), () => { S.style.size = Number(sizeCtl.input.value); styleChanged(); });
    const fontSel = on(select('aivid-font', FONTS, S.style.font), () => { S.style.font = fontSel.value; A.ensureFont({ font: S.style.font, weight: 800 }).then(invalidate); styleChanged(); });
    const upper = on(check('aivid-upper', 'UPPERCASE', S.style.uppercase), () => { S.style.uppercase = upper.input.checked; styleChanged(); });
    const fillC = on(colour('aivid-fill', S.style.fill), () => { S.style.fill = fillC.value; styleChanged(); });
    const accentC = on(colour('aivid-accent', S.style.accent), () => { S.style.accent = accentC.value; styleChanged(); });
    const strokeC = on(colour('aivid-stroke', S.style.stroke), () => { S.style.stroke = strokeC.value; styleChanged(); });
    const boxC = on(colour('aivid-box', S.style.box), () => { S.style.box = boxC.value; styleChanged(); });
    const keyC = on(colour('aivid-keycolour', S.style.keyColour), () => { S.style.keyColour = keyC.value; styleChanged(); });
    const emojiCk = on(check('aivid-emoji', 'Auto emoji', S.style.autoEmoji), () => { S.style.autoEmoji = emojiCk.input.checked; styleChanged(); });
    const emojiHint = el('p', 'field-hint', '');
    function syncEmoji() {
      const ok = emojiAllowed();
      emojiCk.input.disabled = !ok;
      emojiHint.textContent = ok ? 'Adds an emoji after about ninety common English words (love, fire, money, idea…). Drawn into the video only, not into the caption files.'
        : 'Auto emoji works with English only — its word list is English. This clip is ' + langName(S.lang || langSel.value) + '.';
    }
    syncEmoji();
    const posRow = el('div', 'aiimg-row aivid-posrow'); posRow.append(field('Position', posSel));
    panes.style.append(
      h('Style'), swatches,
      grid(field('Words on screen', modeSel), field('Size', sizeCtl, 'As a share of the frame width. 6–8% suits a 9:16 Reel.')),
      posRow,
      el('p', 'field-hint', 'Drag the captions on the preview to place them anywhere (with a finger too), or focus the preview and use the arrow keys — Shift for bigger steps. The export and the ASS file use the same place.'),
      grid(field('Font', fontSel), upper),
      h('Colours'),
      grid(field('Text', fillC), field('Highlight', accentC)),
      grid(field('Outline', strokeC), field('Box (Minimal)', boxC)),
      h('Keywords and emoji'),
      grid(field('Keyword colour', keyC), emojiCk),
      emojiHint
    );

    /* ---------------- export pane ---------------- */
    const sizeSel = select('aivid-out-size', [['1080', 'Up to 1080 × 1920 (Full HD)'], ['720', '720 px — smaller, faster']], '1080');
    sizeSel.addEventListener('change', scheduleFiles);
    const fpsSel = select('aivid-fps', [['30', '30'], ['24', '24']], '30');
    const exportBtn = button('Export the captioned video', 'btn-primary', exportVideo);
    const cancelBtn = button('Cancel', 'btn-ghost', () => { if (S.job) S.job.abort(); }); cancelBtn.hidden = true;
    const exProgress = el('div', 'aiimg-progress'); const exBar = el('i'); exProgress.appendChild(exBar); exProgress.hidden = true;
    const exStatus = el('p', 'aiimg-status aivid-exstatus', ''); exStatus.hidden = true;
    const results = el('div', 'aiimg-results');
    const exRow = el('div', 'aiimg-row'); exRow.append(exportBtn, cancelBtn);
    const audioHint = el('p', 'field-hint', 'Encoded on your device with the original sound.');
    panes.export.append(
      h('Captioned video'),
      grid(field('Size', sizeSel), field('Frames per second', fpsSel)),
      audioHint,
      el('p', 'field-hint', 'Playing the clip through once is how the frames are read, so the export takes about as long as the clip. MP4 needs a browser with on-device video encoding (Chrome, Edge, Safari 16.4+); elsewhere the clip is recorded as WebM.'),
      exRow, exProgress, exStatus, results,
      h('Caption files'),
      el('p', 'field-hint', 'The SRT, VTT and ASS on the Transcript tab carry the same words and timings as the burned-in captions, in cues of at most two lines of 42 characters (16 for Chinese and Japanese). The ASS also carries the font, colours, outline and position, keyword colours, and for Karaoke a timing tag on every word; the animated looks and emoji are in the video only.')
    );
    audioSupport().then((kind) => {
      S.audioKind = kind;
      if (kind === 'aac' || kind === 'opus') audioHint.textContent = 'Encoded on your device with the original sound (' + (kind === 'aac' ? 'AAC' : 'Opus') + ').';
      else if (kind === 'recorder') audioHint.textContent = 'Recorded on your device as WebM with the original sound.';
      else { audioHint.textContent = 'This browser cannot encode sound, so the exported clip will be silent. Chrome, Edge or Safari 16.4+ keep the sound.'; audioHint.className = 'io-msg is-warn'; }
    });

    function addResult(blob, name, label, dims, extra) {
      const row = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      const strong = el('strong', null, name);
      const meta = el('span', null, fmtBytes(blob.size) + ' · ' + dims + (label ? ' · ' + label : ''));
      const dl = button('Download', 'btn-download', () => A.download(blob, name));
      head.append(strong, meta, dl);
      row.appendChild(head);
      const url = URL.createObjectURL(blob);
      const v = el('video'); v.controls = true; v.playsInline = true; v.src = url; v.preload = 'metadata';
      row.appendChild(v);
      const l = el('div', 'aivid-links');
      const a = el('a', 'btn-download', 'Download ' + name.split('.').pop().toUpperCase()); a.href = url; a.download = name;
      l.appendChild(a);
      if (extra) for (const x of extra) l.appendChild(x);
      row.appendChild(l);
      results.insertBefore(row, results.firstChild);
      return row;
    }

    /* ---------------- loading a file ---------------- */
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => wrap.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    wrap.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) loadFiles(e.dataTransfer.files); });
    file.addEventListener('change', () => { if (file.files.length) loadFiles(file.files); file.value = ''; });

    function reset() {
      if (S.job) S.job.abort();
      setPlaying(false);
      if (S.media) { try { S.media.pause(); S.media.removeAttribute('src'); S.media.load(); } catch (e) { /* */ } S.media.remove(); }
      if (S.url) URL.revokeObjectURL(S.url);
      Object.assign(S, { file: null, url: null, media: null, hasVideo: false, vw: 0, vh: 0, duration: 0, audio: null, segments: [], original: [], cues: [], t: 0, transcribed: false, live: -1, lang: null, detection: null, lastBox: null });
      S.style.keywords = []; keyInput.value = ''; setMarking(false);
      segList.innerHTML = ''; links.hidden = true; progress.hidden = true; stopBtn.hidden = true; timingNote.textContent = ''; say(''); note('');
      again.disabled = true; syncEmoji();
    }
    async function loadFiles(files) {
      const f = files[0];
      if (!f || S.busy) return;
      const isVideo = /^video\//.test(f.type) || /\.(mp4|m4v|mov|webm|mkv|avi|ogv)$/i.test(f.name);
      const isAudio = /^audio\//.test(f.type) || /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|weba)$/i.test(f.name);
      if (!isVideo && !isAudio) { say('“' + f.name + '” does not look like a video or an audio file. Choose an MP4, MOV, WebM, MP3, WAV or M4A.', 'error'); return; }
      reset();
      S.busy = true;
      S.file = f; S.name = String(f.name || 'clip').replace(/\.[^.]+$/, '') || 'clip';
      S.url = URL.createObjectURL(f);
      drop.hidden = true; studio.hidden = false;
      panes.words.insertBefore(langBox, status.nextSibling);
      showPane('words');
      status.textContent = 'Reading ' + f.name + ' (' + fmtBytes(f.size) + ')…';
      try {
        /* the media element: a video for video, an audio for audio — both drive the preview clock */
        const media = el(isVideo ? 'video' : 'audio', 'aivid-video');
        media.muted = true; media.playsInline = true; media.preload = 'auto'; media.setAttribute('aria-hidden', 'true');
        media.src = S.url;
        stage.appendChild(media);
        S.media = media;
        const meta = await new Promise((res) => {
          const done = () => res(true);
          media.addEventListener('loadedmetadata', done, { once: true });
          media.addEventListener('error', () => res(false), { once: true });
          setTimeout(() => res(media.readyState >= 1), 8000);
        });
        S.hasVideo = isVideo && meta && media.videoWidth > 0 && media.videoHeight > 0;
        if (S.hasVideo) { S.vw = media.videoWidth; S.vh = media.videoHeight; }
        /* the sound: decoded at 48 kHz for the encoders, then 16 kHz mono for Whisper */
        status.textContent = 'Decoding the sound…';
        S.audio = await Wh.decodeAudio(f, { sampleRate: AUDIO_RATE });
        S.duration = S.audio.duration;
        if (isFinite(media.duration) && media.duration > 0 && Math.abs(media.duration - S.duration) < 0.5) S.duration = Math.min(S.duration, media.duration);
        sizePreview();
        A.ensureFont({ font: S.style.font, weight: 800 }).then(invalidate);
        media.addEventListener('loadeddata', invalidate);
        media.addEventListener('seeked', invalidate);
        try { media.currentTime = 0.001; } catch (e) { /* */ }
        invalidate();
        if (S.duration > MAX_SECONDS) {
          status.textContent = f.name + ' is ' + fmtSec(S.duration) + ' long.';
          say('Clips of up to 10 minutes are supported — everything is held in your browser’s memory. Trim this one first.', 'error');
          S.busy = false;
          return;
        }
        if (PHONE && S.duration > PHONE_WARN_SECONDS) say('On a phone a clip this long (' + fmtSec(S.duration) + ') will take several minutes to transcribe and to re-encode. It will work; a laptop is quicker.', 'warn');
        await transcribe();
      } catch (e) {
        status.textContent = f.name + ' could not be used.';
        say(f.name + ': ' + ((e && e.message) || String(e)), 'error');
      } finally { S.busy = false; again.disabled = !S.audio; }
    }

    /* ---------------- transcription ---------------- */
    function runTranscribe() {
      S.busy = true; again.disabled = true;
      transcribe().finally(() => { S.busy = false; again.disabled = !S.audio; });
    }
    async function transcribe() {
      S.job = new AbortController();
      const signal = S.job.signal;
      progress.hidden = false; stopBtn.hidden = false; bar.style.width = '0%';
      const started = performance.now();
      const live = [];
      const choice = langSel.value;
      S.lang = choice === 'auto' ? null : choice; S.detection = null;
      S.segments = []; renderSegs(); setMarking(false);
      syncEmoji();
      try {
        const res = await Wh.transcribe(S.audio.samples, {
          signal, language: choice,
          onLoad: (p) => {
            if (p.stage === 'ready') return;
            bar.style.width = Math.round((p.fraction || 0) * 100) + '%';
            status.textContent = p.stage === 'compile' ? 'Starting the speech model…' : 'Downloading the speech model — ' + fmtBytes(p.loaded || 0) + ' of ' + fmtBytes(p.total || 0) + '. It is kept for next time.';
          },
          onLanguage: (d) => { S.detection = d; S.lang = d.code; syncEmoji(); },
          onProgress: (p) => {
            bar.style.width = Math.round((p.fraction || 0) * 100) + '%';
            const lang = S.detection ? ' (' + langName(S.detection.code) + ')' : '';
            if (p.stage === 'detect') status.textContent = 'Listening for the language…';
            else if (p.stage === 'window' && p.eta !== null && p.eta !== undefined) status.textContent = 'Transcribing' + lang + ' — ' + fmtSec(p.seconds) + ' of ' + fmtSec(p.total) + ', about ' + fmtSec(Math.max(1, p.eta)) + ' left.';
            else if (p.window === 0) status.textContent = 'Transcribing the first 30 seconds' + lang + (p.stage === 'decode' && p.tokens ? ' — ' + p.tokens + ' words so far…' : '…');
            else status.textContent = 'Transcribing' + lang + ' — ' + fmtSec(p.seconds) + ' of ' + fmtSec(p.total) + '…';
          },
          onSegment: (seg) => { live.push(seg); S.segments = cloneSegs(live); renderSegs(); refreshCues(); }
        });
        S.lang = res.language;
        S.segments = cloneSegs(res.segments);
        S.original = cloneSegs(res.segments);
        S.transcribed = true;
        syncEmoji();
        refreshAll();
        const words = res.words.length;
        const took = ((performance.now() - started) / 1000);
        bar.style.width = '100%';
        const langNote = res.detection ? langName(res.language) + ' (detected, ' + Math.round(res.detection.probability * 100) + '% sure)' : langName(res.language);
        if (!S.segments.length) { status.textContent = 'No speech was recognised in ' + fmtSec(res.seconds) + ' of sound. Check the clip has a clear voice, or pick its language — ready'; }
        else status.textContent = 'Transcribed ' + fmtSec(res.seconds) + ' of ' + langNote + ' in ' + took.toFixed(1) + ' s: ' + S.segments.length + ' segment' + (S.segments.length === 1 ? '' : 's') + ', ' + words + ' word' + (words === 1 ? '' : 's') + ' — ready';
        const aligned = S.segments.some((s) => s.timing === 'aligned');
        timingNote.textContent = aligned
          ? 'Word timings come from the model itself: each word is placed where the decoder was listening when it wrote it (alignment of its cross-attention to the sound). Edit a line into a different number of words and that line goes back to sharing its time out by word length.'
          : 'Word timings are estimated: each phrase’s time is shared out between its words by their length.';
        const wrong = res.detection && res.detection.probability < 0.6 ? ' The language was hard to tell — if it is wrong, choose it above and transcribe again.' : '';
        const issues = res.issues || [];
        if (issues.length) {
          const what = { garbled: 'wrote characters that are not text', repetitive: 'got stuck repeating itself', script: 'wrote in a different script from ' + langName(res.language) };
          const parts = issues.map((x) => fmtSec(x.start) + '–' + fmtSec(x.end) + ': the model ' + what[x.kind]);
          say('Whisper tiny struggled with this clip (' + parts.join('; ') + '). It is the smallest Whisper and weak in some languages — check those lines, or choose the language by hand and transcribe again.' + wrong, 'warn');
        } else say(S.segments.length ? 'Read the transcript through before you export. Names, brands and numbers are where the smallest Whisper slips.' + wrong : '', S.segments.length ? 'note' : '');
      } catch (e) {
        if (e && e.name === 'AbortError') status.textContent = 'Cancelled.';
        else { status.textContent = 'Transcription failed.'; say(S.name + ': ' + ((e && e.message) || String(e)), 'error'); }
      } finally {
        S.job = null;
        stopBtn.hidden = true;
        setTimeout(() => { progress.hidden = true; }, 600);
      }
    }

    /* ---------------- export ---------------- */
    async function exportVideo() {
      if (!S.file || S.job || !S.audio) return;
      if (!S.segments.length) { say('There are no captions to burn in yet.', 'warn'); return; }
      const { width, height } = frameSize(sizeSel.value);
      const fps = Number(fpsSel.value);
      S.job = new AbortController();
      S.exporting = true;
      setPlaying(false);
      exportBtn.disabled = true; cancelBtn.hidden = false; exProgress.hidden = false; exStatus.hidden = false; exBar.style.width = '0%';
      exStatus.textContent = 'Encoding the video…';
      note('Exporting — the preview is paused');
      const started = performance.now();
      const onProgress = (p) => {
        const f = p.fraction || 0;
        exBar.style.width = Math.round(f * 100) + '%';
        const spent = (performance.now() - started) / 1000;
        exStatus.textContent = (p.stage === 'audio' ? 'Encoding the sound' : 'Encoding the video') + ' — ' + Math.round(f * 100) + '%' + (f > 0.04 && f < 1 ? ', about ' + fmtSec(Math.max(1, spent / f - spent)) + ' left' : '') + '.';
      };
      try {
        refreshFiles();
        const draw = drawOverlay;
        const media = S.media;
        const useRvfc = S.hasVideo && media && 'requestVideoFrameCallback' in media;
        const frames = S.hasVideo
          ? (useRvfc ? framesFromPlayback(media, width, height, fps, draw, S.job.signal) : framesStepped(media, width, height, fps, S.duration, draw, S.job.signal))
          : framesStepped(null, width, height, fps, S.duration, (ctx, Wd, Ht, t) => { drawBackdrop(ctx, Wd, Ht, S.name); draw(ctx, Wd, Ht, t); }, S.job.signal);
        const r = await muxVideo({ width, height, fps, frames, audioBuffer: S.audio.audioBuffer, duration: S.duration, onProgress, signal: S.job.signal });
        const name = S.name + '-captions.' + (EXT[String(r.blob.type).split(';')[0]] || r.ext);
        const copy = (a, label) => { const x = el('a', 'btn-download', label); x.href = a.href; x.download = a.download; return x; };
        addResult(r.blob, name, (r.note || (r.ext === 'mp4' ? 'MP4' : 'WebM')) + ' · ' + S.duration.toFixed(1) + ' s · ' + fps + ' fps' + (r.silent ? ' · no sound' : ''), width + '×' + height, [copy(srtLink, 'Download SRT'), copy(vttLink, 'Download VTT'), copy(assLink, 'Download ASS')]);
        A.download(r.blob, name);
        exStatus.textContent = 'Done in ' + fmtSec((performance.now() - started) / 1000) + '.' + (r.silent ? ' The sound could not be encoded by this browser, so the clip is silent.' : '');
        if (r.silent) say('This browser could not encode the sound track, so the exported clip has no sound. Chrome, Edge or Safari 16.4+ keep it.', 'warn');
        else if (r.ext === 'webm') say(r.note, 'warn');
        else say('');
      } catch (e) {
        if (e && e.name === 'AbortError') exStatus.textContent = 'Cancelled.';
        else { exStatus.textContent = 'The export failed.'; say(S.name + ': ' + ((e && e.message) || String(e)), 'error'); }
      } finally {
        S.job = null; S.exporting = false;
        exportBtn.disabled = false; cancelBtn.hidden = true; exProgress.hidden = true;
        note('');
        if (S.media) { try { S.media.pause(); S.media.currentTime = S.t; } catch (e) { /* */ } }
        invalidate();
      }
    }

    showPane('words');
    return { state: S, renderFrame, loadFiles, muxVideo, destroy: () => { mounted = false; reset(); } };
  }

  A.tools['auto-captions'] = { mount, muxVideo, drawCaptions, fileCues, wordCues, withHold, toSRT, toVTT, toASS, emojiFor, STYLES, LANGS };
})();
