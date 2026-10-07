/**
 * Caption Counter (/social/caption-counter/).
 *
 * Two halves. window.SocialCount is pure — no DOM — so the tests and the
 * claims run it in Node with a stub window: count(text) gives every figure
 * the page shows, rows(text, opts) the verdict per platform, xWeight(text)
 * the X count, fixInstagram(text) the line-break fix, preview(text, p) the
 * first-line cut. The second half mounts the page on the AIImg runtime.
 *
 * The limits, checked on the platforms' own pages on 6 October 2026:
 *   Instagram  2,200 characters, 30 hashtags, 20 @ tags — developers.facebook.com/
 *              documentation/instagram-platform/instagram-graph-api/reference/ig-user/media;
 *              5 hashtags announced by @creators on Threads, 18 December 2025,
 *              rolling out gradually
 *   X          280, weighted: twitter-text config v3 (code points 0–4351,
 *              8192–8205, 8208–8223 and 8242–8247 weigh 1, the rest 2; an
 *              emoji 2 however many code points; a link 23) — docs.x.com/
 *              fundamentals/counting-characters; 25,000 for Premium (help.x.com)
 *   LinkedIn   3,000 — linkedin.com/help/linkedin/answer/a528176
 *   TikTok     2,200 UTF-16 code units through TikTok's posting API —
 *              developers.tiktok.com/doc/content-posting-api-reference-direct-post
 *   YouTube    title 100 characters, description 5,000 characters (help) and
 *              5,000 bytes (Data API), < and > not allowed —
 *              support.google.com/youtube/answer/57404, developers.google.com/youtube/v3/docs/videos
 *   Facebook   63,206: no Meta page states it; the figure a Facebook engineer
 *              gave in November 2011 (blog404.com, 3 December 2011)
 *   Threads    500, an emoji counted as its UTF-8 bytes, at most 5 links —
 *              developers.facebook.com/docs/threads/posts
 * Where a platform does not say how it counts, the count is in UTF-16 code
 * units (what a web form's maxlength counts): the stricter reading, so a
 * caption that passes here is not cut there.
 */
(function () {
  'use strict';
  const W = window;

  /* ------------------------------------------------------------------ */
  /* graphemes                                                          */
  /* ------------------------------------------------------------------ */
  let seg = null;
  try { if (typeof Intl !== 'undefined' && Intl.Segmenter) seg = new Intl.Segmenter('en', { granularity: 'grapheme' }); } catch (e) { seg = null; }
  const EXTEND = /^(?:[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u0610-\u061a\u064b-\u065f\u0900-\u0903\u093a-\u094f\u0951-\u0957\u0962\u0963\u0981-\u0983\u09bc-\u09d7\u0a01-\u0a03\u0a3c-\u0a51\u0a81-\u0a83\u0abc-\u0acd\u0b01-\u0b03\u0b3c-\u0b57\u0b82\u0bbe-\u0bcd\u0bd7\u0c00-\u0c04\u0c3c-\u0c56\u0c81-\u0c83\u0cbc-\u0cd6\u0d00-\u0d03\u0d3b-\u0d57\u0d81-\u0d83\u0dca-\u0ddf\u0f71-\u0f84\u102b-\u103e\u1712-\u1714\u17b4-\u17d3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u1ab0-\u1aff\u1dc0-\u1dff\u200c\u20d0-\u20ff\ufe00-\ufe0f\ufe20-\ufe2f]|\ud83c[\udffb-\udfff]|\udb40[\udc20-\udc7f])$/;
  const isRI = (c) => { const n = c.codePointAt(0); return n >= 0x1f1e6 && n <= 0x1f1ff; };
  /* Unicode's conjunct rule (GB9c): a virama of Devanagari, Bengali,
     Gujarati, Oriya, Telugu or Malayalam joins the consonant after it */
  const VIRAMA = new Set([0x094d, 0x09cd, 0x0acd, 0x0b4d, 0x0c4d, 0x0d4d]);
  let LETTER;
  try { LETTER = new RegExp('^\\p{L}$', 'u'); } catch (e) { LETTER = /^[\u0900-\u0dff]$/; }
  const conjunct = (prev, c) => {
    const v = prev.charCodeAt(prev.length - 1);
    if (!VIRAMA.has(v)) return false;
    const n = c.codePointAt(0);
    return (n >> 7) === (v >> 7) && LETTER.test(c);
  };
  /** Grapheme clusters without Intl.Segmenter: marks, variation selectors,
      skin tones and tag characters extend; ZWJ glues; a virama joins the
      next consonant; two regional indicators make one flag; CR LF is one. */
  function graphemesFallback(s) {
    const out = [];
    let riRun = 0;
    for (const c of Array.from(s)) {
      if (out.length) {
        const prev = out[out.length - 1];
        const glued = prev.charCodeAt(prev.length - 1) === 0x200d;
        if (EXTEND.test(c) || c === '\u200d' || glued || conjunct(prev, c) || (c === '\n' && prev === '\r') || (isRI(c) && riRun === 1)) {
          out[out.length - 1] = prev + c;
          riRun = isRI(c) && riRun === 1 ? 2 : (glued ? 0 : riRun);
          continue;
        }
      }
      out.push(c);
      riRun = isRI(c) ? 1 : 0;
    }
    return out;
  }
  function graphemes(s, forceFallback) {
    s = String(s || '');
    if (seg && !forceFallback) { const out = []; for (const g of seg.segment(s)) out.push(g.segment); return out; }
    return graphemesFallback(s);
  }

  /* ------------------------------------------------------------------ */
  /* what counts as an emoji, a link, a hashtag, a mention               */
  /* ------------------------------------------------------------------ */
  let PICT, PRES;
  try { PICT = new RegExp('\\p{Extended_Pictographic}', 'u'); PRES = new RegExp('\\p{Emoji_Presentation}', 'u'); }
  catch (e) { PICT = /[©®‼-㊙]|[\ud83c-\ud83e][\udc00-\udfff]/; PRES = /[\ud83c-\ud83e][\udc00-\udfff]/; }
  /** One grapheme drawn as an emoji: a pictograph in emoji style (its
      default, or asked for with U+FE0F), a keycap or a flag. */
  function isEmoji(g) {
    if (!g) return false;
    if (/\u20e3/.test(g)) return true;
    if (Array.from(g).length >= 2 && isRI(g) && isRI(Array.from(g)[1])) return true;
    if (!PICT.test(g)) return false;
    return PRES.test(g) || /\ufe0f/.test(g);
  }

  /* Web addresses without https:// are counted as links when they end in
     one of these endings. X's own list is longer (every top-level domain);
     these are the ones captions use. */
  const TLDS = ('com|org|net|edu|gov|int|mil|io|co|ai|app|dev|me|tv|ly|gg|xyz|info|biz|shop|store|online|site|blog|news|link|page|live|tech|club|art|design|studio|media|agency|social|tools|pro|uk|in|us|ca|au|nz|ie|de|fr|es|it|nl|be|ch|at|se|no|dk|fi|pl|pt|br|mx|ar|jp|cn|kr|sg|hk|my|id|ph|th|vn|za|ng|ke|ae|sa|pk|bd|lk|np|ru|ua|tr|gr|cz|eu|asia|to|fm|so|is|ws|cc|la|sh|ac|bar|foo')
    .split('|');
  const TLD_SET = new Set(TLDS);
  const URL_RE = /(?:https?:\/\/[^\s<>"]+|(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?:\/[^\s<>"]*)?)/gi;
  /** Links as X finds them: with a scheme, or a bare domain with a known ending.
      Trailing punctuation is not part of the link. */
  function links(text) {
    const out = [];
    const s = String(text || '');
    URL_RE.lastIndex = 0;
    let m;
    while ((m = URL_RE.exec(s))) {
      let u = m[0];
      const start = m.index;
      const before = start > 0 ? s[start - 1] : '';
      if (before && /[A-Za-z0-9@#$_.\-/]/.test(before)) continue;
      if (!/^https?:\/\//i.test(u)) {
        const host = u.split('/')[0].toLowerCase();
        const tld = host.split('.').pop();
        if (!TLD_SET.has(tld)) continue;
      }
      /* trailing punctuation and an unbalanced closing bracket stay outside */
      for (;;) {
        const last = u[u.length - 1];
        if (/[.,!?:;'"’”…]/.test(last)) { u = u.slice(0, -1); continue; }
        if (last === ')' && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length) { u = u.slice(0, -1); continue; }
        break;
      }
      if (!/^https?:\/\//i.test(u) && !/\.[a-z]{2,24}(\/|$)/i.test(u)) continue;
      out.push({ url: u, start, end: start + u.length });
      URL_RE.lastIndex = start + u.length;
    }
    return out;
  }
  let HASH_RE, MENTION_RE;
  try {
    HASH_RE = new RegExp('(^|[^\\p{L}\\p{M}\\p{N}_&/])[#＃]([\\p{L}\\p{M}\\p{N}_]*[\\p{L}\\p{M}_][\\p{L}\\p{M}\\p{N}_]*)', 'gu');
  } catch (e) { HASH_RE = /(^|[^A-Za-z0-9_&/])[#＃]([A-Za-z0-9_]*[A-Za-z_][A-Za-z0-9_]*)/g; }
  MENTION_RE = /(^|[^A-Za-z0-9_.@])[@＠]([A-Za-z0-9_](?:[A-Za-z0-9_.]{0,28}[A-Za-z0-9_])?)/g;
  /** #tags: a # then letters, digits or _ with at least one letter (#2026 alone is not a tag). */
  function hashtags(text) {
    const s = String(text || ''); const out = []; let m;
    HASH_RE.lastIndex = 0;
    while ((m = HASH_RE.exec(s))) out.push('#' + m[2]);
    return out;
  }
  /** @mentions: a username of up to 30 letters, digits, dots and underscores, not inside an email address. */
  function mentions(text) {
    const s = String(text || ''); const out = []; let m;
    MENTION_RE.lastIndex = 0;
    while ((m = MENTION_RE.exec(s))) out.push('@' + m[2]);
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* X: twitter-text's weighting                                        */
  /* ------------------------------------------------------------------ */
  const X_RANGES = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]];
  const xCharWeight = (cp) => (X_RANGES.some((r) => cp >= r[0] && cp <= r[1]) ? 1 : 2);
  /**
   * The X count: normalised to NFC, each link 23, each emoji 2 however many
   * code points it is built from, every other code point 1 if it is in the
   * light ranges and 2 if not. Returns { weight, links, emoji, heavy }.
   */
  function xWeight(text) {
    const s = String(text || '').normalize ? String(text || '').normalize('NFC') : String(text || '');
    const ls = links(s);
    let weight = 0, emoji = 0, heavy = 0, i = 0, li = 0;
    while (i < s.length) {
      if (li < ls.length && ls[li].start === i) { weight += 23; i = ls[li].end; li++; continue; }
      const nextLink = li < ls.length ? ls[li].start : s.length;
      const chunk = s.slice(i, nextLink);
      for (const g of graphemes(chunk)) {
        if (isEmoji(g)) { weight += 2; emoji++; continue; }
        for (const c of Array.from(g)) { const w = xCharWeight(c.codePointAt(0)); weight += w; if (w === 2) heavy++; }
      }
      i = nextLink;
    }
    return { weight, links: ls.length, emoji, heavy };
  }

  /* ------------------------------------------------------------------ */
  /* units                                                              */
  /* ------------------------------------------------------------------ */
  const utf8 = (s) => { let n = 0; for (const c of String(s)) { const cp = c.codePointAt(0); n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4; } return n; };
  /** Threads: 500, with each emoji counted as the number of its UTF-8 bytes; every other character one. */
  function threadsCount(text) {
    let n = 0;
    for (const g of graphemes(text)) n += isEmoji(g) ? utf8(g) : Array.from(g).length;
    return n;
  }

  /** Every figure the page shows for a caption. */
  function count(text) {
    const s = String(text || '');
    const gs = graphemes(s);
    const x = xWeight(s);
    const lines = s === '' ? 0 : s.split(/\r\n|\r|\n/).length;
    return {
      characters: gs.length,
      codePoints: Array.from(s).length,
      utf16: s.length,
      bytes: utf8(s),
      words: (s.match(/[^\s]+/g) || []).filter((w) => /[\p{L}\p{N}]/u.test(w)).length,
      lines,
      blankLines: s === '' ? 0 : s.split(/\r\n|\r|\n/).filter((l) => !l.trim()).length,
      emoji: gs.filter(isEmoji).length,
      hashtags: hashtags(s),
      mentions: mentions(s),
      links: links(s).map((l) => l.url),
      x: x.weight,
      threads: threadsCount(s),
      ytInvalid: (s.match(/[<>]/g) || []).length
    };
  }

  /* ------------------------------------------------------------------ */
  /* the platforms                                                      */
  /* ------------------------------------------------------------------ */
  /* `more` is roughly how much shows before "… more": none of the
     platforms publishes it, it moves with the screen, so it is marked
     approximate wherever it is shown. LinkedIn's 150 is the length its ad
     specs give "to avoid truncation". */
  const PLATFORMS = [
    { id: 'instagram', name: 'Instagram caption', limit: 2200, unit: 'utf16', more: 125, moreLines: 2 },
    { id: 'x', name: 'X post', limit: 280, unit: 'x', more: 280 },
    { id: 'linkedin', name: 'LinkedIn post', limit: 3000, unit: 'utf16', more: 150, moreLines: 3 },
    { id: 'tiktok', name: 'TikTok caption', limit: 2200, unit: 'utf16', more: 100, moreLines: 1 },
    { id: 'youtube-title', name: 'YouTube title', limit: 100, unit: 'utf16', more: null },
    { id: 'youtube-desc', name: 'YouTube description', limit: 5000, unit: 'bytes', more: 150, moreLines: 3 },
    { id: 'facebook', name: 'Facebook post', limit: 63206, unit: 'utf16', more: 125, moreLines: 2 },
    { id: 'threads', name: 'Threads post', limit: 500, unit: 'threads', more: null }
  ];
  const UNIT_LABEL = { utf16: 'UTF-16 units', x: 'weighted', bytes: 'UTF-8 bytes', threads: 'characters, emoji as bytes' };
  const fmt = (n) => Number(n).toLocaleString('en-GB');

  /** The verdict per platform. opts.xPremium raises X to 25,000. */
  function rows(text, opts) {
    const c = count(text);
    const o = opts || {};
    return PLATFORMS.map((p) => {
      const used = p.unit === 'x' ? c.x : p.unit === 'bytes' ? c.bytes : p.unit === 'threads' ? c.threads : c.utf16;
      const limit = p.id === 'x' && o.xPremium ? 25000 : p.limit;
      const notes = [];
      let state = used > limit ? 'over' : used > limit * 0.9 ? 'near' : 'ok';
      if (p.id === 'instagram') {
        const h = c.hashtags.length;
        if (h > 30) { state = 'over'; notes.push(h + ' hashtags: more than the 30 Instagram’s developer docs allow'); }
        else if (h > 5) { if (state === 'ok') state = 'near'; notes.push(h + ' hashtags: Instagram is moving to a limit of 5'); }
        if (c.mentions.length > 20) { state = 'over'; notes.push(c.mentions.length + ' @ tags: Instagram allows 20'); }
      }
      if (p.id === 'threads' && c.links.length > 5) { state = 'over'; notes.push(c.links.length + ' links: Threads allows 5'); }
      if ((p.id === 'youtube-title' || p.id === 'youtube-desc') && c.ytInvalid) { state = 'over'; notes.push('YouTube does not allow < or >'); }
      if (p.id === 'youtube-title' && /\n/.test(String(text || ''))) notes.push('a title is one line: the line breaks will go');
      return { id: p.id, name: p.name, used, limit, unit: p.unit, unitLabel: UNIT_LABEL[p.unit], left: limit - used, state, notes };
    });
  }

  /**
   * Roughly what shows before "… more" on a platform: up to p.more visible
   * characters or p.moreLines lines, whichever ends first. Returns
   * { shown, cut } — cut false when the whole caption shows.
   */
  function preview(text, id) {
    const p = PLATFORMS.find((x) => x.id === id);
    const s = String(text || '');
    if (!p || !p.more) return { shown: s, cut: false };
    let shown = s;
    if (p.moreLines) {
      const ls = s.split('\n');
      if (ls.length > p.moreLines) shown = ls.slice(0, p.moreLines).join('\n');
    }
    const gs = graphemes(shown);
    if (gs.length > p.more) shown = gs.slice(0, p.more).join('');
    return { shown: shown.replace(/\s+$/, ''), cut: shown.length < s.length };
  }

  /** The invisible character the line-break fix puts on empty lines: U+2800, Braille Pattern Blank. */
  const BLANK = '\u2800';
  /**
   * Instagram can drop empty lines between paragraphs. The usual fix: put a
   * character that prints as nothing on each empty line, and take the spaces
   * off the end of lines. Empty lines at the very start or end are removed.
   */
  function fixInstagram(text) {
    const ls = String(text || '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t\u00a0]+$/, ''));
    while (ls.length && ls[0].trim() === '') ls.shift();
    while (ls.length && ls[ls.length - 1].trim() === '') ls.pop();
    return ls.map((l) => (l.trim() === '' ? BLANK : l)).join('\n');
  }

  W.SocialCount = { graphemes, graphemesFallback, isEmoji, links, hashtags, mentions, xWeight, threadsCount, utf8, count, rows, preview, fixInstagram, PLATFORMS, BLANK, X_RANGES, TLDS };

  /* ================================================================== */
  /* the page                                                           */
  /* ================================================================== */
  const A = W.AIImg;
  if (!A || !A.tools) return;
  const SK = W.SocialKit;
  const { el, button, check } = A;
  const KEY = '1234tools-social-caption-counter-v1';
  const DRAFT = '1234tools-social-caption-draft-v1';
  const SAMPLE = 'New in the shop this week ☕\ufe0f our oat flat white, £3.20.\n\nPop in before 10 and the second one is half price 🎉 — tag a friend who needs it @smallbatchcafe\n\nMenu: smallbatch.example.com/menu\n#coffee #flatwhite #oatmilk #localcafe';

  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const store = SK ? SK.store : { get: (k, d) => d, set: () => false, remove: () => {} };
    const set = Object.assign({ keepDraft: false, xPremium: false, platform: 'instagram' }, store.get(KEY, {}) || {});
    const save = () => store.set(KEY, { keepDraft: set.keepDraft, xPremium: set.xPremium, platform: set.platform });

    const wrap = el('div', 'aiimg social-cc');
    const area = el('textarea', 'control social-cc-text');
    area.id = 'cc-text'; area.rows = 9; area.spellcheck = true;
    area.setAttribute('placeholder', 'Type or paste a caption. It stays in this tab unless you ask for a draft to be kept.');
    const areaField = A.field('Your caption', area);
    const actions = el('div', 'aiimg-row social-cc-actions');
    const sampleBtn = button('Try an example', 'btn-ghost', () => { area.value = SAMPLE; update(); area.focus(); });
    const clearBtn = button('Clear', 'btn-ghost', () => { area.value = ''; update(); area.focus(); });
    const copyBtn = button('Copy text', 'btn-ghost', async () => flash(copyBtn, await SK.copy(area.value), 'Copy text'));
    actions.append(sampleBtn, clearBtn, copyBtn);
    const keep = check('cc-keep', 'Keep this text as a draft on this device', set.keepDraft);
    const premium = check('cc-premium', 'I post on X with Premium (25,000 instead of 280)', set.xPremium);

    const stats = el('div', 'social-cc-stats'); stats.setAttribute('aria-live', 'polite');
    const table = el('div', 'social-cc-rows');
    const prevHead = el('h3', 'aiimg-h', 'Before “… more” (approximate)');
    const prevSel = A.select('cc-platform', PLATFORMS.filter((p) => p.more).map((p) => [p.id, p.name]), set.platform);
    const prevBox = el('div', 'social-cc-preview');
    const prevNote = el('p', 'field-hint', 'Roughly what shows in the feed before the caption is cut. No platform publishes the exact point: it moves with the screen size and the line breaks, so treat it as a guide.');

    const fixHead = el('h3', 'aiimg-h', 'Instagram line breaks');
    const fixNote = el('p', 'field-hint', '');
    const fixBtn = button('Copy with the line-break fix', 'btn-primary', async () => {
      const fixed = fixInstagram(area.value);
      flash(fixBtn, await SK.copy(fixed), 'Copy with the line-break fix');
    });
    const fixOut = el('pre', 'social-cc-fixed'); fixOut.setAttribute('aria-label', 'The caption with the fix applied');

    wrap.append(areaField, actions, keep, stats, el('h3', 'aiimg-h', 'Limits per platform'), table, premium,
      prevHead, A.field('Platform', prevSel), prevBox, prevNote,
      fixHead, fixNote, fixOut, (() => { const r = el('div', 'aiimg-row'); r.append(fixBtn); return r; })());
    io.appendChild(wrap);

    function flash(b, ok, label) {
      b.textContent = ok ? 'Copied' : 'Copy failed — select the text and copy it';
      setTimeout(() => { b.textContent = label; }, 1600);
    }
    const stat = (k, v, title) => { const d = el('div', 'stat-row'); d.append(el('span', 'stat-key', k), el('span', 'stat-val', v)); if (title) d.title = title; return d; };

    function update() {
      const text = area.value;
      const c = count(text);
      stats.replaceChildren(
        stat('Characters', fmt(c.characters), 'What you see: an emoji, a flag or an accented letter is one'),
        stat('UTF-16 units', fmt(c.utf16), 'What a web form counts: most emoji are 2, a family emoji up to 11'),
        stat('Bytes (UTF-8)', fmt(c.bytes)),
        stat('Words', fmt(c.words)),
        stat('Lines', fmt(c.lines)),
        stat('Emoji', fmt(c.emoji)),
        stat('Hashtags', fmt(c.hashtags.length)),
        stat('Mentions', fmt(c.mentions.length)),
        stat('Links', fmt(c.links.length))
      );
      const rs = rows(text, { xPremium: set.xPremium });
      table.replaceChildren(...rs.map((r) => {
        const row = el('div', 'social-cc-row is-' + r.state);
        row.dataset.platform = r.id;
        const head = el('div', 'social-cc-rowhead');
        head.append(el('strong', null, r.name),
          el('span', 'social-cc-num', fmt(r.used) + ' / ' + fmt(r.limit)),
          el('span', 'social-cc-left', r.left >= 0 ? fmt(r.left) + ' left' : fmt(-r.left) + ' over'));
        const meter = el('div', 'social-cc-meter'); const fill = el('i');
        fill.style.width = Math.min(100, r.limit ? (r.used / r.limit) * 100 : 0).toFixed(1) + '%';
        meter.appendChild(fill);
        meter.setAttribute('role', 'meter'); meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', String(r.limit)); meter.setAttribute('aria-valuenow', String(r.used));
        meter.setAttribute('aria-label', r.name + ': ' + r.used + ' of ' + r.limit);
        row.append(head, meter, el('span', 'social-cc-unit', 'Counted in ' + r.unitLabel + (r.notes.length ? ' — ' + r.notes.join('; ') : '')));
        return row;
      }));
      const pv = preview(text, prevSel.value);
      prevBox.replaceChildren(el('span', null, pv.shown || ' '));
      if (pv.cut) prevBox.appendChild(el('span', 'social-cc-more', '… more'));
      const blank = c.blankLines;
      fixNote.textContent = blank
        ? 'Your caption has ' + blank + ' empty line' + (blank === 1 ? '' : 's') + '. Instagram can remove empty lines between paragraphs, so the paragraphs run together. The usual fix, applied below: an invisible character (U+2800, Braille Pattern Blank) on each empty line, and no spaces at the end of a line. Each one counts as a character, and some screen readers announce it as “blank”.'
        : 'No empty lines, so nothing to fix. When a caption has blank lines between paragraphs, this puts an invisible character (U+2800) on each so Instagram keeps the gap.';
      fixOut.textContent = blank ? fixInstagram(text).replace(new RegExp(BLANK, 'g'), '\u2800') : '';
      fixOut.hidden = !blank; fixBtn.disabled = !blank;
      if (set.keepDraft) store.set(DRAFT, { text, at: Date.now() });
    }

    keep.input.addEventListener('change', () => {
      set.keepDraft = keep.input.checked; save();
      if (set.keepDraft) store.set(DRAFT, { text: area.value, at: Date.now() }); else store.remove(DRAFT);
    });
    premium.input.addEventListener('change', () => { set.xPremium = premium.input.checked; save(); update(); });
    prevSel.addEventListener('change', () => { set.platform = prevSel.value; save(); update(); });
    let t = 0;
    area.addEventListener('input', () => { clearTimeout(t); t = setTimeout(update, 60); });

    /* ?text= opens with a caption, the way the text tools take one */
    let start = '';
    try { start = new URLSearchParams(location.search).get('text') || ''; } catch (e) { start = ''; }
    if (!start && set.keepDraft) { const d = store.get(DRAFT, null); if (d && typeof d.text === 'string') start = d.text; }
    area.value = start;
    update();
    return { update, area, count, rows };
  }

  A.tools['caption-counter'] = { mount };
})();
