/**
 * Link in Bio Page Maker (/social/link-in-bio/).
 *
 * Builds ONE static HTML file — a photo, a name, a line of bio, a column
 * of link buttons and a row of icons — for the visitor to download and
 * put on any static host. The file has no script, no font file, no
 * analytics and no request of any kind: the photo is inside it as a data
 * URL (cut to a 256 px square JPEG), the icons are inline SVG drawn for
 * this tool (generic symbols, not the platforms' logos), the fonts are
 * system font stacks, and <link rel="icon" href="data:,"> stops the
 * browser asking for a favicon. Every link carries rel="noopener".
 *
 * Links must be https://. Anything with another scheme — javascript:,
 * data:, vbscript:, file:, plain http: — is refused with a reason, and
 * the address written into the file is the one the URL parser gives back.
 * Email and phone icons are built as mailto: and tel: from a checked
 * address or number; WhatsApp as https://wa.me/<number>.
 *
 * The preview is the same HTML in an <iframe srcdoc> sandboxed without
 * scripts. The project can be exported and imported as JSON, and kept in
 * this browser (localStorage '1234tools-social-link-in-bio-v1') only when
 * the visitor ticks "Remember this page in this browser"; otherwise only
 * the look (theme, buttons, corners, font) is remembered.
 *
 * Font stacks follow the CC0 Modern Font Stacks collection (no files).
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, field, select, check, button, fmtBytes } = A;

  const KEY = '1234tools-social-link-in-bio-v1';
  const APP = '1234tools-link-in-bio';
  const MAX_LINKS = 30, MAX_ICONS = 14, MAX_NAME = 60, MAX_BIO = 300, MAX_TITLE = 80, MAX_URL = 2000;
  const SIZE_LIMIT = 200 * 1024;
  const PHOTO_PX = 256;

  /* ------------------------------------------------------------------ */
  /* looks                                                              */
  /* ------------------------------------------------------------------ */
  /* Each theme: bg (or two for a gradient), text, muted text, button and
     button text. Every pair used for words is at least 4.5:1 (WCAG AA),
     against both ends of a gradient — build/social/tests/link-in-bio.js
     measures them. */
  const THEMES = {
    midnight: { label: 'Midnight', bg: ['#0f172a'], fg: '#f8fafc', muted: '#cbd5e1', btn: '#facc15', btnFg: '#111827' },
    paper: { label: 'Paper', bg: ['#fafaf7'], fg: '#111111', muted: '#4b5563', btn: '#111111', btnFg: '#ffffff' },
    sunset: { label: 'Sunset', bg: ['#7c2d12', '#831843'], fg: '#fff7ed', muted: '#fed7aa', btn: '#fff7ed', btnFg: '#7c2d12' },
    forest: { label: 'Forest', bg: ['#14532d'], fg: '#f0fdf4', muted: '#bbf7d0', btn: '#f0fdf4', btnFg: '#14532d' },
    ocean: { label: 'Ocean', bg: ['#0c4a6e', '#1e3a8a'], fg: '#f0f9ff', muted: '#bae6fd', btn: '#38bdf8', btnFg: '#0c1a2e' },
    lavender: { label: 'Lavender', bg: ['#f5f3ff'], fg: '#2e1065', muted: '#5b21b6', btn: '#6d28d9', btnFg: '#ffffff' },
    mono: { label: 'Mono', bg: ['#000000'], fg: '#ffffff', muted: '#d4d4d4', btn: '#ffffff', btnFg: '#000000' },
    peach: { label: 'Peach', bg: ['#fff1eb'], fg: '#431407', muted: '#7c2d12', btn: '#c2410c', btnFg: '#ffffff' }
  };
  const BUTTONS = [['filled', 'Filled'], ['outline', 'Outline'], ['soft', 'Soft tint'], ['shadow', 'Filled with a hard shadow']];
  const CORNERS = { rounded: ['Rounded', '14px'], pill: ['Pill', '999px'], square: ['Square', '4px'] };
  const FONTS = {
    system: ['System (the phone’s own)', 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'],
    humanist: ['Humanist sans', 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif'],
    geometric: ['Geometric sans', 'Avenir, Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif'],
    serif: ['Book serif', 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif'],
    rounded: ['Rounded', 'ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manjari, "Arial Rounded MT", "Arial Rounded MT Bold", Calibri, source-sans-pro, sans-serif'],
    mono: ['Monospace', 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace']
  };
  const LANGS = [['en', 'English'], ['en-GB', 'English (UK)'], ['en-US', 'English (US)'], ['hi', 'Hindi'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'], ['nl', 'Dutch']];

  /* generic glyphs, drawn for this tool (24 × 24, stroked): not brand logos */
  const GLYPHS = {
    camera: '<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8.5 7l1.5-3h4l1.5 3"/>',
    note: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    play: '<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9v6l5-3z"/>',
    bubble: '<path d="M4 5h16v11H9l-5 4z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14c2.8 0 5 1.9 5 5"/>',
    at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
    envelope: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 7 8.5-7"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    chat: '<path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5z"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'
  };
  /* [id, label, glyph, kind of value, placeholder] */
  const ICONS = [
    ['instagram', 'Instagram', 'camera', 'url', 'https://www.instagram.com/yourname'],
    ['tiktok', 'TikTok', 'note', 'url', 'https://www.tiktok.com/@yourname'],
    ['youtube', 'YouTube', 'play', 'url', 'https://www.youtube.com/@yourname'],
    ['x', 'X', 'bubble', 'url', 'https://x.com/yourname'],
    ['linkedin', 'LinkedIn', 'briefcase', 'url', 'https://www.linkedin.com/in/yourname'],
    ['facebook', 'Facebook', 'people', 'url', 'https://www.facebook.com/yourname'],
    ['threads', 'Threads', 'at', 'url', 'https://www.threads.net/@yourname'],
    ['pinterest', 'Pinterest', 'pin', 'url', 'https://www.pinterest.com/yourname'],
    ['website', 'Website', 'globe', 'url', 'https://example.com'],
    ['shop', 'Shop', 'bag', 'url', 'https://shop.example.com'],
    ['podcast', 'Podcast', 'mic', 'url', 'https://example.com/podcast'],
    ['email', 'Email', 'envelope', 'email', 'you@example.com'],
    ['phone', 'Phone', 'phone', 'phone', '+44 20 7946 0000'],
    ['whatsapp', 'WhatsApp', 'chat', 'whatsapp', 'Number with country code, e.g. 447700900000']
  ];
  const iconOf = (id) => ICONS.find((x) => x[0] === id) || null;

  /* ------------------------------------------------------------------ */
  /* checking what goes in                                              */
  /* ------------------------------------------------------------------ */
  /** A web address for a link: https only. Returns { url } or { error }. */
  function cleanUrl(raw) {
    let s = String(raw == null ? '' : raw).trim();
    if (!s) return { error: 'Add the address this button opens.' };
    if (s.length > MAX_URL) return { error: 'That address is over ' + MAX_URL + ' characters.' };
    const scheme = /^([a-z][a-z0-9+.\-]*):/i.exec(s);
    if (scheme && !/^https?$/i.test(scheme[1])) {
      /* "example.com:8080/x" parses as a scheme too: only refuse what is not host:port */
      if (!/^[a-z0-9.-]+\.[a-z]{2,}:\d+/i.test(s)) return { error: '“' + scheme[1].toLowerCase() + ':” addresses are refused: only https:// web addresses can be linked.' };
    }
    if (/^http:\/\//i.test(s)) return { error: 'Plain http:// addresses are refused: use the https:// address.' };
    if (!/^https:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
    let u;
    try { u = new URL(s); } catch (e) { return { error: 'That is not a web address.' }; }
    if (u.protocol !== 'https:') return { error: 'Only https:// web addresses can be linked.' };
    if (u.username || u.password) return { error: 'Addresses with a user name or password in them are refused.' };
    if (!/^[^.]+(\.[^.]+)+$/.test(u.hostname) && !/^\[[0-9a-f:]+\]$/i.test(u.hostname)) return { error: 'Use a full address with a domain, such as example.com.' };
    return { url: u.href };
  }
  /** An icon's value → { url } or { error }. */
  function iconUrl(kind, raw) {
    const s = String(raw == null ? '' : raw).trim();
    const ic = iconOf(kind);
    if (!ic) return { error: 'Unknown icon.' };
    if (!s) return { error: 'Add the ' + (ic[3] === 'email' ? 'email address' : ic[3] === 'url' ? 'address' : 'number') + ' for ' + ic[1] + '.' };
    if (ic[3] === 'email') {
      const e = s.replace(/^mailto:/i, '');
      if (!/^[^\s@<>"'()\\,;:]+@[^\s@<>"'()\\,;:]+\.[a-z]{2,}$/i.test(e) || e.length > 254) return { error: 'That is not an email address.' };
      return { url: 'mailto:' + e };
    }
    if (ic[3] === 'phone') {
      const d = s.replace(/^tel:/i, '').replace(/[\s().\-]/g, '');
      if (!/^\+?\d{6,15}$/.test(d)) return { error: 'Write the number with digits only (spaces are fine), starting with + and the country code.' };
      return { url: 'tel:' + d };
    }
    if (ic[3] === 'whatsapp') {
      const d = s.replace(/^https:\/\/wa\.me\//i, '').replace(/[\s()+.\-]/g, '');
      if (!/^\d{8,15}$/.test(d)) return { error: 'Write the WhatsApp number in full with the country code, digits only, e.g. 447700900000.' };
      return { url: 'https://wa.me/' + d };
    }
    return cleanUrl(s);
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* contrast, WCAG 2 relative luminance */
  function lum(hex) {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (a, b, t) => { const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16); const ch = (s) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t); return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join(''); };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };
  const SOFT = 0.18;
  /** Every text-on-background pair a theme and button style puts on the page, measured. */
  function themePairs(id, style) {
    const t = THEMES[id];
    const out = [];
    for (const bg of t.bg) {
      out.push(['name and icons', t.fg, bg], ['bio', t.muted, bg]);
      if (style === 'outline') out.push(['button text', t.fg, bg]);
      else if (style === 'soft') out.push(['button text', t.fg, mix(bg, t.btn, SOFT)]);
      else out.push(['button text', t.btnFg, t.btn]);
    }
    return out.map(([what, a, b]) => ({ what, fg: a, bg: b, ratio: contrast(a, b) }));
  }

  /* ------------------------------------------------------------------ */
  /* the page that is downloaded                                        */
  /* ------------------------------------------------------------------ */
  function pageCss(P) {
    const t = THEMES[P.look.theme] || THEMES.midnight;
    const r = (CORNERS[P.look.corner] || CORNERS.rounded)[1];
    const font = (FONTS[P.look.font] || FONTS.system)[1];
    const bg = t.bg.length > 1 ? 'linear-gradient(160deg,' + t.bg[0] + ' 0%,' + t.bg[1] + ' 100%)' : t.bg[0];
    const st = P.look.button;
    const btn = st === 'outline' ? 'background:transparent;color:var(--fg);border:2px solid var(--btn)'
      : st === 'soft' ? 'background:' + rgba(t.btn, SOFT) + ';color:var(--fg);border:2px solid transparent'
      : 'background:var(--btn);color:var(--btnfg);border:2px solid var(--btn)' + (st === 'shadow' ? ';box-shadow:4px 4px 0 var(--fg)' : '');
    return [
      ':root{--bg:' + t.bg[0] + ';--fg:' + t.fg + ';--muted:' + t.muted + ';--btn:' + t.btn + ';--btnfg:' + t.btnFg + '}',
      '*{box-sizing:border-box}',
      'html{background:' + t.bg[t.bg.length - 1] + '}',
      'body{margin:0;min-height:100vh;background:' + bg + ';color:var(--fg);font-family:' + font + ';font-size:17px;line-height:1.45;display:flex;justify-content:center;padding:44px 16px 56px;-webkit-text-size-adjust:100%}',
      'main{width:100%;max-width:520px;text-align:center}',
      '.avatar{display:block;width:112px;height:112px;margin:0 auto 16px;border-radius:50%;object-fit:cover;border:3px solid var(--btn)}',
      'h1{margin:0 0 6px;font-size:1.5rem;line-height:1.25;font-weight:700;overflow-wrap:anywhere}',
      '.bio{margin:0 auto 26px;max-width:36ch;color:var(--muted);white-space:pre-line;overflow-wrap:anywhere}',
      'ul{list-style:none;margin:0;padding:0}',
      '.links li{margin:0 0 12px}',
      '.links a{display:block;padding:15px 20px;border-radius:' + r + ';font-weight:600;text-decoration:none;overflow-wrap:anywhere;' + btn + '}',
      '.links a:hover{filter:brightness(1.06)}',
      '.icons{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:22px}',
      '.icons a{display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;color:var(--fg)}',
      '.icons a:hover{background:' + rgba(t.fg, 0.12) + '}',
      '.icons svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
      'a:focus-visible{outline:3px solid var(--fg);outline-offset:3px}',
      '@media (prefers-reduced-motion:no-preference){.links a{transition:transform .15s}.links a:hover{transform:translateY(-1px)}}'
    ].join('\n');
  }

  /** The project → { html, used: { links, icons }, left: [{ what, why }] }. */
  function buildPage(P) {
    const left = [];
    const links = [];
    for (const l of P.links) {
      const title = String(l.title || '').trim();
      const c = cleanUrl(l.url);
      if (c.error) { if (title || String(l.url || '').trim()) left.push({ what: title || l.url, why: c.error }); continue; }
      links.push({ title: title || new URL(c.url).hostname.replace(/^www\./, ''), url: c.url });
    }
    const icons = [];
    for (const i of P.icons) {
      const ic = iconOf(i.kind);
      const c = iconUrl(i.kind, i.value);
      if (c.error) { if (String(i.value || '').trim()) left.push({ what: ic ? ic[1] : i.kind, why: c.error }); continue; }
      icons.push({ label: ic[1], glyph: ic[2], url: c.url });
    }
    const name = String(P.profile.name || '').trim();
    const bio = String(P.profile.bio || '').trim();
    const title = name || 'Links';
    const lang = LANGS.some((x) => x[0] === P.profile.lang) ? P.profile.lang : 'en';
    const parts = [];
    parts.push('<!DOCTYPE html>');
    parts.push('<html lang="' + esc(lang) + '">');
    parts.push('<head>');
    parts.push('<meta charset="utf-8">');
    parts.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
    parts.push('<title>' + esc(title) + '</title>');
    if (bio) parts.push('<meta name="description" content="' + esc(bio.replace(/\s+/g, ' ').slice(0, 160)) + '">');
    parts.push('<meta name="referrer" content="strict-origin-when-cross-origin">');
    parts.push('<link rel="icon" href="data:,">');
    parts.push('<style>\n' + pageCss(P) + '\n</style>');
    parts.push('</head>');
    parts.push('<body>');
    parts.push('<main>');
    if (P.profile.photo) parts.push('<img class="avatar" src="' + P.profile.photo + '" alt="' + esc(name ? 'Photo of ' + name : 'Profile photo') + '" width="112" height="112">');
    if (name) parts.push('<h1>' + esc(name) + '</h1>');
    if (bio) parts.push('<p class="bio">' + esc(bio) + '</p>');
    if (links.length) {
      parts.push('<nav aria-label="Links"><ul class="links">');
      for (const l of links) parts.push('<li><a href="' + esc(l.url) + '" rel="noopener">' + esc(l.title) + '</a></li>');
      parts.push('</ul></nav>');
    }
    if (icons.length) {
      parts.push('<ul class="icons" aria-label="Elsewhere">');
      for (const i of icons) parts.push('<li><a href="' + esc(i.url) + '" rel="noopener" aria-label="' + esc(i.label) + '" title="' + esc(i.label) + '"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + GLYPHS[i.glyph] + '</svg></a></li>');
      parts.push('</ul>');
    }
    parts.push('</main>');
    parts.push('</body>');
    parts.push('</html>');
    return { html: parts.join('\n') + '\n', used: { links: links.length, icons: icons.length }, left };
  }

  /* ------------------------------------------------------------------ */
  /* the project: storage, JSON in and out                              */
  /* ------------------------------------------------------------------ */
  const EXAMPLE = () => ({
    profile: { name: 'Sam Rivera', bio: 'Ceramics, made by hand in small batches.\nNew pieces every first Friday.', lang: 'en', photo: '' },
    links: [
      { title: 'Shop the new collection', url: 'https://example.com/shop' },
      { title: 'Book a workshop', url: 'https://example.com/workshops' },
      { title: 'Read the studio notes', url: 'https://example.com/notes' }
    ],
    icons: [{ kind: 'instagram', value: 'https://www.instagram.com/example' }, { kind: 'email', value: 'hello@example.com' }],
    look: { theme: 'midnight', button: 'filled', corner: 'rounded', font: 'system' }
  });
  const okLook = (l) => ({
    theme: THEMES[l && l.theme] ? l.theme : 'midnight',
    button: BUTTONS.some((b) => b[0] === (l && l.button)) ? l.button : 'filled',
    corner: CORNERS[l && l.corner] ? l.corner : 'rounded',
    font: FONTS[l && l.font] ? l.font : 'system'
  });
  const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
  /** Anything read from storage or a file, made safe: strings cut to size, unknown keys dropped. Links are kept as typed and checked when the page is built. */
  function sanitise(p) {
    const s = (v, n) => String(v == null ? '' : v).slice(0, n);
    const prof = (p && p.profile) || {};
    const photo = typeof prof.photo === 'string' && prof.photo.length < 400000 && PHOTO_RE.test(prof.photo) ? prof.photo : '';
    return {
      profile: { name: s(prof.name, MAX_NAME), bio: s(prof.bio, MAX_BIO), lang: LANGS.some((x) => x[0] === prof.lang) ? prof.lang : 'en', photo },
      links: (Array.isArray(p && p.links) ? p.links : []).slice(0, MAX_LINKS).map((l) => ({ title: s(l && l.title, MAX_TITLE), url: s(l && l.url, MAX_URL) })),
      icons: (Array.isArray(p && p.icons) ? p.icons : []).slice(0, MAX_ICONS).filter((i) => i && iconOf(i.kind)).map((i) => ({ kind: i.kind, value: s(i.value, MAX_URL) })),
      look: okLook(p && p.look)
    };
  }
  function readStore() {
    try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); return p && p.v === 1 ? p : null; } catch (e) { return null; }
  }
  function writeStore(P, keep) {
    try {
      const o = { v: 1, look: P.look };
      if (keep) o.project = { profile: P.profile, links: P.links, icons: P.icons, look: P.look };
      localStorage.setItem(KEY, JSON.stringify(o));
      return true;
    } catch (e) { return false; }
  }
  const projectJson = (P) => JSON.stringify({ app: APP, v: 1, saved: new Date().toISOString(), profile: P.profile, links: P.links, icons: P.icons, look: P.look }, null, 2);

  /** A photo file → a 256 px square JPEG data URL, cut from the middle. */
  async function photoFromFile(f) {
    if (!/^image\//.test(f.type || '') && !/\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i.test(f.name || '')) throw new Error('not an image (choose a JPEG, PNG or WebP).');
    let bmp;
    try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); }
    catch (e) {
      bmp = await new Promise((res, rej) => {
        const u = URL.createObjectURL(f); const img = new Image();
        img.onload = () => { URL.revokeObjectURL(u); res(img); };
        img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('this browser could not read it as an image (HEIC photos need Safari; convert to JPEG).')); };
        img.src = u;
      });
    }
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
    if (!w || !h) throw new Error('the image has no size.');
    const c = el('canvas'); c.width = PHOTO_PX; c.height = PHOTO_PX;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, PHOTO_PX, PHOTO_PX);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    const s = Math.min(w, h);
    x.drawImage(bmp, (w - s) / 2, (h - s) / 2, s, s, 0, 0, PHOTO_PX, PHOTO_PX);
    if (bmp.close) bmp.close();
    return c.toDataURL('image/jpeg', 0.85);
  }

  /* ------------------------------------------------------------------ */
  /* the tool                                                           */
  /* ------------------------------------------------------------------ */
  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const stored = readStore();
    let keep = !!(stored && stored.project);
    const P = stored && stored.project ? sanitise(stored.project) : EXAMPLE();
    if (!keep && stored && stored.look) P.look = okLook(stored.look);

    const wrap = el('div', 'aiimg sv-lib');
    const grid = el('div', 'sv-lib-grid');
    const editor = el('div', 'sv-lib-editor');
    const previewCol = el('div', 'sv-lib-previewcol');
    grid.append(editor, previewCol);
    const msg = el('div', 'io-msg'); msg.setAttribute('role', 'status');
    wrap.append(msg, grid);
    io.appendChild(wrap);
    const say = (t, kind) => { msg.textContent = t || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); };

    /* ---------- profile ---------- */
    const secProfile = el('section', 'sv-lib-sec');
    secProfile.appendChild(el('h3', 'aiimg-h', 'Profile'));
    const photoRow = el('div', 'sv-lib-photo');
    const thumb = el('img', 'sv-lib-thumb'); thumb.alt = ''; thumb.width = 64; thumb.height = 64;
    const photoIn = el('input', 'visually-hidden'); photoIn.type = 'file'; photoIn.accept = 'image/*'; photoIn.id = 'lib-photo';
    photoIn.setAttribute('aria-label', 'Choose a profile photo');
    const photoB = button('Choose a photo', 'btn-ghost', () => photoIn.click());
    const photoX = button('Remove photo', 'btn-ghost', () => { P.profile.photo = ''; changed(); });
    photoRow.append(thumb, photoB, photoX, photoIn);
    const nameIn = el('input', 'control'); nameIn.type = 'text'; nameIn.id = 'lib-name'; nameIn.maxLength = MAX_NAME; nameIn.autocomplete = 'off';
    const bioIn = el('textarea', 'control'); bioIn.id = 'lib-bio'; bioIn.rows = 3; bioIn.maxLength = MAX_BIO;
    const langSel = select('lib-lang', LANGS, P.profile.lang);
    secProfile.append(photoRow, el('p', 'field-hint', 'The photo is cut to a 256-pixel square and stored inside the page, so it needs no separate file.'),
      field('Name', nameIn), field('Bio', bioIn, 'Up to ' + MAX_BIO + ' characters. A line break here is a line break on the page.'), field('Language of the page', langSel));

    /* ---------- links ---------- */
    const secLinks = el('section', 'sv-lib-sec');
    secLinks.appendChild(el('h3', 'aiimg-h', 'Links'));
    const linkList = el('ol', 'sv-lib-list');
    const addLinkB = button('+ Add a link', 'btn-ghost', () => {
      if (P.links.length >= MAX_LINKS) { say('Up to ' + MAX_LINKS + ' links.', 'warn'); return; }
      P.links.push({ title: '', url: '' }); renderLinks(); changed();
      const last = linkList.lastElementChild; if (last) last.querySelector('input').focus();
    });
    secLinks.append(linkList, addLinkB, el('p', 'field-hint', 'Only https:// addresses are accepted. Anything else — javascript:, data:, plain http:// — is refused and left out of the page.'));

    /* ---------- icons ---------- */
    const secIcons = el('section', 'sv-lib-sec');
    secIcons.appendChild(el('h3', 'aiimg-h', 'Icons'));
    const iconList = el('ol', 'sv-lib-list');
    const addIconB = button('+ Add an icon', 'btn-ghost', () => {
      if (P.icons.length >= MAX_ICONS) { say('Up to ' + MAX_ICONS + ' icons.', 'warn'); return; }
      const used = new Set(P.icons.map((i) => i.kind));
      const next = ICONS.find((i) => !used.has(i[0])) || ICONS[0];
      P.icons.push({ kind: next[0], value: '' }); renderIcons(); changed();
      const last = iconList.lastElementChild; if (last) last.querySelector('input').focus();
    });
    secIcons.append(iconList, addIconB, el('p', 'field-hint', 'The icons are simple symbols drawn for this tool — a camera, a play button, an envelope — not the platforms’ own logos, and each is labelled with the platform’s name for screen readers.'));

    /* ---------- look ---------- */
    const secLook = el('section', 'sv-lib-sec');
    secLook.appendChild(el('h3', 'aiimg-h', 'Look'));
    const themeRow = el('div', 'chip-row sv-lib-themes'); themeRow.setAttribute('role', 'group'); themeRow.setAttribute('aria-label', 'Theme');
    const themeBtns = {};
    for (const id of Object.keys(THEMES)) {
      const t = THEMES[id];
      const b = button('', 'chip sv-lib-theme', () => { P.look.theme = id; syncLook(); changed(); });
      b.dataset.theme = id;
      const sw = el('span', 'sv-lib-swatch'); sw.style.background = t.bg.length > 1 ? 'linear-gradient(135deg,' + t.bg[0] + ',' + t.bg[1] + ')' : t.bg[0]; sw.style.borderColor = t.btn;
      b.append(sw, document.createTextNode(t.label));
      themeBtns[id] = b; themeRow.appendChild(b);
    }
    const btnSel = select('lib-button', BUTTONS, P.look.button);
    const cornerSel = select('lib-corner', Object.keys(CORNERS).map((k) => [k, CORNERS[k][0]]), P.look.corner);
    const fontSel = select('lib-font', Object.keys(FONTS).map((k) => [k, FONTS[k][0]]), P.look.font);
    const lg = el('div', 'aiimg-grid2'); lg.append(field('Buttons', btnSel), field('Corners', cornerSel));
    secLook.append(themeRow, lg, field('Font', fontSel, 'Fonts already on the visitor’s phone or computer: nothing is downloaded, so the page opens instantly and works offline.'));

    /* ---------- save, export ---------- */
    const secOut = el('section', 'sv-lib-sec');
    secOut.appendChild(el('h3', 'aiimg-h', 'Download'));
    const sizeLine = el('p', 'sv-lib-size'); sizeLine.setAttribute('aria-live', 'polite');
    const leftOut = el('ul', 'sv-lib-left'); leftOut.setAttribute('aria-live', 'polite');
    const dlB = button('Download index.html', 'btn-primary', () => {
      const r = buildPage(P);
      const blob = new Blob([r.html], { type: 'text/html' });
      A.download(blob, 'index.' + ({ 'text/html': 'html' })[blob.type.split(';')[0]]);
      say('Saved index.html (' + fmtBytes(blob.size) + '). Upload it to any static host as the home page — see “Putting it online” below.');
    });
    const copyB = button('Copy the HTML', 'btn-ghost', async () => {
      const r = buildPage(P);
      let ok = false;
      try { await navigator.clipboard.writeText(r.html); ok = true; } catch (e) { ok = false; }
      say(ok ? 'The HTML is on the clipboard.' : 'Copying was blocked by the browser: use Download instead.', ok ? '' : 'warn');
    });
    const outRow = el('div', 'aiimg-row'); outRow.append(dlB, copyB);
    const keepC = check('lib-keep', 'Remember this page in this browser', keep);
    const keepHint = el('p', 'field-hint', 'Off by default. When ticked, your name, bio, photo and links are kept in this browser’s storage on this device so you can come back to them; untick to delete them. Nothing is sent anywhere.');
    const exportB = button('Export the project (.json)', 'btn-ghost', () => {
      const blob = new Blob([projectJson(P)], { type: 'application/json' });
      const name = 'link-in-bio-project.' + ({ 'application/json': 'json' })[blob.type];
      A.download(blob, name);
      say('Saved ' + name + '. Import it here later, on this device or another, to carry on editing.');
    });
    const importIn = el('input', 'visually-hidden'); importIn.type = 'file'; importIn.accept = 'application/json,.json'; importIn.id = 'lib-import';
    importIn.setAttribute('aria-label', 'Import a project file');
    const importB = button('Import a project', 'btn-ghost', () => importIn.click());
    const resetB = button('Start again', 'btn-ghost', () => {
      const look = P.look;
      Object.assign(P, { profile: { name: '', bio: '', lang: 'en', photo: '' }, links: [{ title: '', url: '' }], icons: [], look });
      syncAll(); changed(); say('Cleared. Your look is kept.');
    });
    const ioRow = el('div', 'aiimg-row'); ioRow.append(exportB, importB, resetB, importIn);
    secOut.append(sizeLine, leftOut, outRow, keepC, keepHint, ioRow);

    const help = el('details', 'sv-lib-help');
    help.innerHTML = '<summary>Putting it online</summary>' +
      '<p>The download is one file, <code>index.html</code>, that needs nothing else: no script, no font file, no images beside it. Any static web host can serve it — a free static-site host where you drag the file into a page, your own web space, or a storage bucket set to serve a website. Upload it as the site’s home page, then put that address in your bio. This site plays no part in it: the page is yours and never calls back here.</p>' +
      '<p>To change it later, import your project file here (or tick “Remember this page” before you leave), edit, download again and replace the file on your host.</p>';

    editor.append(secProfile, secLinks, secIcons, secLook, secOut, help);

    /* ---------- preview ---------- */
    const phone = el('div', 'sv-lib-phone');
    const frame = el('iframe', 'sv-lib-frame');
    frame.title = 'Preview of your page';
    frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    phone.appendChild(frame);
    const contrastLine = el('p', 'field-hint sv-lib-contrast');
    previewCol.append(el('h3', 'aiimg-h', 'Preview'), phone, contrastLine);

    /* ---------- rows ---------- */
    function rowButtons(list, i, rerender) {
      const up = button('↑', 'btn-ghost sv-mini', () => { if (i > 0) { [list[i - 1], list[i]] = [list[i], list[i - 1]]; rerender(i - 1, 'up'); changed(); } });
      const down = button('↓', 'btn-ghost sv-mini', () => { if (i < list.length - 1) { [list[i + 1], list[i]] = [list[i], list[i + 1]]; rerender(i + 1, 'down'); changed(); } });
      const del = button('✕', 'btn-ghost sv-mini', () => { list.splice(i, 1); rerender(Math.min(i, list.length - 1), null); changed(); });
      up.disabled = i === 0; down.disabled = i === list.length - 1;
      return [up, down, del];
    }
    function renderLinks(focusAt, which) {
      linkList.innerHTML = '';
      P.links.forEach((l, i) => {
        const li = el('li', 'sv-lib-row');
        const t = el('input', 'control lib-link-title'); t.type = 'text'; t.value = l.title; t.maxLength = MAX_TITLE; t.placeholder = 'Button text';
        t.setAttribute('aria-label', 'Link ' + (i + 1) + ' text');
        const u = el('input', 'control lib-link-url'); u.type = 'url'; u.value = l.url; u.placeholder = 'https://…'; u.inputMode = 'url'; u.autocomplete = 'off'; u.spellcheck = false;
        u.setAttribute('aria-label', 'Link ' + (i + 1) + ' address');
        const err = el('p', 'field-error sv-lib-err'); err.id = 'lib-link-err-' + i;
        u.setAttribute('aria-describedby', err.id);
        const [up, down, del] = rowButtons(P.links, i, renderLinks);
        up.setAttribute('aria-label', 'Move link ' + (i + 1) + ' up'); down.setAttribute('aria-label', 'Move link ' + (i + 1) + ' down'); del.setAttribute('aria-label', 'Remove link ' + (i + 1));
        const btns = el('div', 'sv-lib-rowbtns'); btns.append(up, down, del);
        t.addEventListener('input', () => { l.title = t.value; changed(); });
        u.addEventListener('input', () => { l.url = u.value; showErr(); changed(); });
        u.addEventListener('blur', showErr);
        function showErr() {
          const c = String(l.url).trim() ? cleanUrl(l.url) : {};
          err.textContent = c.error || ''; u.setAttribute('aria-invalid', c.error ? 'true' : 'false');
        }
        showErr();
        li.append(t, u, btns, err);
        linkList.appendChild(li);
      });
      if (focusAt != null && linkList.children[focusAt]) {
        const b = linkList.children[focusAt].querySelectorAll('.sv-mini');
        const want = which === 'up' ? [b[0], b[1]] : which === 'down' ? [b[1], b[0]] : [b[2]];
        (want.find((x) => x && !x.disabled) || linkList.children[focusAt].querySelector('input')).focus();
      }
    }
    function renderIcons(focusAt, which) {
      iconList.innerHTML = '';
      P.icons.forEach((ic, i) => {
        const li = el('li', 'sv-lib-row sv-lib-iconrow');
        const kindSel = select('lib-icon-kind-' + i, ICONS.map((x) => [x[0], x[1]]), ic.kind);
        kindSel.classList.add('lib-icon-kind'); kindSel.setAttribute('aria-label', 'Icon ' + (i + 1) + ' platform');
        const v = el('input', 'control lib-icon-value'); v.type = 'text'; v.value = ic.value; v.autocomplete = 'off'; v.spellcheck = false;
        v.setAttribute('aria-label', 'Icon ' + (i + 1) + ' address or number');
        const err = el('p', 'field-error sv-lib-err'); err.id = 'lib-icon-err-' + i;
        v.setAttribute('aria-describedby', err.id);
        const setPh = () => { const d = iconOf(ic.kind); v.placeholder = d ? d[4] : ''; v.inputMode = d && (d[3] === 'phone' || d[3] === 'whatsapp') ? 'tel' : d && d[3] === 'email' ? 'email' : 'url'; };
        setPh();
        const [up, down, del] = rowButtons(P.icons, i, renderIcons);
        up.setAttribute('aria-label', 'Move icon ' + (i + 1) + ' up'); down.setAttribute('aria-label', 'Move icon ' + (i + 1) + ' down'); del.setAttribute('aria-label', 'Remove icon ' + (i + 1));
        const btns = el('div', 'sv-lib-rowbtns'); btns.append(up, down, del);
        function showErr() {
          const c = String(ic.value).trim() ? iconUrl(ic.kind, ic.value) : {};
          err.textContent = c.error || ''; v.setAttribute('aria-invalid', c.error ? 'true' : 'false');
        }
        kindSel.addEventListener('change', () => { ic.kind = kindSel.value; setPh(); showErr(); changed(); });
        v.addEventListener('input', () => { ic.value = v.value; showErr(); changed(); });
        showErr();
        li.append(kindSel, v, btns, err);
        iconList.appendChild(li);
      });
      if (focusAt != null && iconList.children[focusAt]) {
        const b = iconList.children[focusAt].querySelectorAll('.sv-mini');
        const want = which === 'up' ? [b[0], b[1]] : which === 'down' ? [b[1], b[0]] : [b[2]];
        (want.find((x) => x && !x.disabled) || iconList.children[focusAt].querySelector('input')).focus();
      }
    }

    function syncLook() {
      for (const id in themeBtns) { const on = P.look.theme === id; themeBtns[id].classList.toggle('is-on', on); themeBtns[id].setAttribute('aria-pressed', on ? 'true' : 'false'); }
      btnSel.value = P.look.button; cornerSel.value = P.look.corner; fontSel.value = P.look.font;
    }
    function syncAll() {
      nameIn.value = P.profile.name; bioIn.value = P.profile.bio; langSel.value = P.profile.lang;
      renderLinks(); renderIcons(); syncLook();
    }

    /* ---------- change → preview, size, storage ---------- */
    let timer = 0;
    function changed() {
      clearTimeout(timer);
      timer = setTimeout(refresh, 120);
    }
    function refresh() {
      const r = buildPage(P);
      frame.srcdoc = r.html;
      const bytes = new Blob([r.html]).size;
      sizeLine.textContent = 'index.html · ' + fmtBytes(bytes) + ' · ' + r.used.links + ' link' + (r.used.links === 1 ? '' : 's') + ', ' + r.used.icons + ' icon' + (r.used.icons === 1 ? '' : 's') + ' · no outside requests' + (bytes > SIZE_LIMIT ? ' — over 200 KB: a smaller photo would help' : '');
      sizeLine.dataset.bytes = String(bytes);
      leftOut.innerHTML = '';
      for (const x of r.left) leftOut.appendChild(el('li', null, 'Left out — ' + x.what + ': ' + x.why));
      thumb.hidden = !P.profile.photo; photoX.hidden = !P.profile.photo;
      if (P.profile.photo) thumb.src = P.profile.photo; else thumb.removeAttribute('src');
      const low = themePairs(P.look.theme, P.look.button).filter((p) => p.ratio < 4.5);
      contrastLine.textContent = low.length ? 'Low contrast: ' + low.map((p) => p.what + ' ' + p.ratio.toFixed(1) + ':1').join(', ') + '.' : 'Text contrast in this look: at least ' + Math.min(...themePairs(P.look.theme, P.look.button).map((p) => p.ratio)).toFixed(1) + ':1 (WCAG AA asks for 4.5:1).';
      if (!writeStore(P, keep) && keep) say('This browser would not store the page (private window, or storage is full or blocked). Export the project instead.', 'warn');
    }

    nameIn.addEventListener('input', () => { P.profile.name = nameIn.value; changed(); });
    bioIn.addEventListener('input', () => { P.profile.bio = bioIn.value; changed(); });
    langSel.addEventListener('change', () => { P.profile.lang = langSel.value; changed(); });
    btnSel.addEventListener('change', () => { P.look.button = btnSel.value; changed(); });
    cornerSel.addEventListener('change', () => { P.look.corner = cornerSel.value; changed(); });
    fontSel.addEventListener('change', () => { P.look.font = fontSel.value; changed(); });
    keepC.input.addEventListener('change', () => {
      keep = keepC.input.checked;
      refresh();
      say(keep ? 'This page will be kept in this browser as you edit.' : 'Deleted from this browser. Only the look is remembered.');
    });
    photoIn.addEventListener('change', async () => {
      const f = photoIn.files[0]; photoIn.value = '';
      if (!f) return;
      try { P.profile.photo = await photoFromFile(f); changed(); say(f.name + ': added as a ' + PHOTO_PX + ' × ' + PHOTO_PX + ' photo.'); }
      catch (e) { say(f.name + ': ' + ((e && e.message) || e), 'error'); }
    });
    importIn.addEventListener('change', async () => {
      const f = importIn.files[0]; importIn.value = '';
      if (!f) return;
      try {
        if (f.size > 2 * 1048576) throw new Error('over 2 MB: that is not a project file from this tool.');
        let j;
        try { j = JSON.parse(await f.text()); } catch (e) { throw new Error('not a JSON file.'); }
        if (!j || j.app !== APP) throw new Error('not a project file from this tool.');
        if (j.v !== 1) throw new Error('made by a newer version of this tool (version ' + j.v + ').');
        const clean = sanitise(j);
        Object.assign(P, clean);
        syncAll(); refresh();
        const r = buildPage(P);
        say(f.name + ': imported ' + r.used.links + ' link' + (r.used.links === 1 ? '' : 's') + ' and ' + r.used.icons + ' icon' + (r.used.icons === 1 ? '' : 's') + '.' + (r.left.length ? ' Left out of the page: ' + r.left.map((x) => x.what + ' (' + x.why + ')').join('; ') : ''), r.left.length ? 'warn' : '');
      } catch (e) { say(f.name + ': ' + ((e && e.message) || e), 'error'); }
    });

    syncAll();
    refresh();
    if (keep) say('Restored your page from this browser.');
    return { project: P, buildPage, cleanUrl, iconUrl };
  }

  A.tools['link-in-bio'] = { mount, buildPage, cleanUrl, iconUrl, themePairs, contrast, THEMES, BUTTONS, FONTS, ICONS, sanitise };
})();
