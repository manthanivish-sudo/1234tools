(function(){
/* ===================== shared helpers ===================== */

function bytes(s) {
  const n = new (typeof TextEncoder !== 'undefined' ? TextEncoder : Object)();
  const len = typeof TextEncoder !== 'undefined' ? n.encode(String(s)).length : String(s).length;
  if (len < 1024) return len + ' B';
  if (len < 1048576) return (len / 1024).toFixed(1) + ' KB';
  return (len / 1048576).toFixed(2) + ' MB';
}

function describeJsonError(e, text) {
  const msg = String(e.message || e);
  const m = msg.match(/position (\d+)/);
  if (!m) return 'Invalid JSON: ' + msg;
  const pos = Number(m[1]);
  const before = text.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  const snippet = (text.split('\n')[line - 1] || '').trim().slice(0, 60);
  return `Invalid JSON at line ${line}, column ${col}.\n${snippet ? '  ' + snippet + '\n' : ''}${msg.replace(/ in JSON.*/, '')}`;
}

function countNodes(v) {
  if (Array.isArray(v)) return v.length + v.reduce((n, x) => n + countNodes(x), 0);
  if (v && typeof v === 'object') {
    const k = Object.keys(v);
    return k.length + k.reduce((n, key) => n + countNodes(v[key]), 0);
  }
  return 0;
}

function depthOf(v, d = 1) {
  if (Array.isArray(v)) return v.length ? Math.max(...v.map(x => depthOf(x, d + 1))) : d;
  if (v && typeof v === 'object') {
    const k = Object.keys(v);
    return k.length ? Math.max(...k.map(key => depthOf(v[key], d + 1))) : d;
  }
  return d;
}

function checkXmlBalance(xml) {
  const stack = [];
  let depth = 0, maxDepth = 0, elements = 0;
  const re = /<\/?([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>/g;
  let m;
  while ((m = re.exec(xml))) {
    const tag = m[0];
    if (!m[1]) continue;                       // declaration, comment, CDATA, doctype
    if (tag.startsWith('</')) {
      const open = stack.pop();
      if (open !== m[1]) {
        return { error: open === undefined
          ? `Closing tag </${m[1]}> has no matching opening tag.`
          : `Mismatched tags: <${open}> is closed by </${m[1]}>.` };
      }
      depth--;
    } else if (m[3] === '/') {
      elements++;
    } else {
      stack.push(m[1]); elements++; depth++;
      maxDepth = Math.max(maxDepth, depth);
    }
  }
  if (stack.length) return { error: `Unclosed tag: <${stack[stack.length - 1]}> is never closed.` };
  if (!elements) return { error: 'No XML elements found.' };
  return { elements, depth: maxDepth };
}

function minifyXml(xml) {
  return xml.replace(/>\s+</g, '><').replace(/^\s+|\s+$/g, '');
}

function formatXml(xml, pad) {
  const compact = minifyXml(xml);
  const tokens = compact.replace(/></g, '>\n<').split('\n');
  let depth = 0;
  return tokens.map(tok => {
    if (/^<\/[^>]+>$/.test(tok)) depth = Math.max(0, depth - 1);
    const line = pad.repeat(depth) + tok;
    const isOpen = /^<[^!?/][^>]*[^/]>$/.test(tok) || /^<[a-zA-Z][\w.:-]*>$/.test(tok);
    const selfClose = /\/>$/.test(tok) || /^<[?!]/.test(tok);
    const hasInline = /^<[^/][^>]*>.*<\/[^>]+>$/.test(tok);
    if (isOpen && !selfClose && !hasInline) depth++;
    return line;
  }).join('\n');
}

function parseCSV(text, delim) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function b64encode(str) {
  const bytes = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += T[b0 >> 2];
    out += T[((b0 & 3) << 4) | ((b1 || 0) >> 4)];
    out += b1 === undefined ? '=' : T[((b1 & 15) << 2) | ((b2 || 0) >> 6)];
    out += b2 === undefined ? '=' : T[b2 & 63];
  }
  return out;
}

function b64decode(b64) {
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = String(b64).replace(/[\r\n\s]/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error('bad base64');
  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map(k => {
      const ch = clean[i + k];
      return ch === undefined || ch === '=' ? -1 : T.indexOf(ch);
    });
    if (n[0] < 0 || n[1] < 0) break;
    bytes.push((n[0] << 2) | (n[1] >> 4));
    if (n[2] >= 0) bytes.push(((n[1] & 15) << 4) | (n[2] >> 2));
    if (n[3] >= 0) bytes.push(((n[2] & 3) << 6) | n[3]);
  }
  // UTF-8 decode
  let out = '', i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) { out += String.fromCharCode(b); i++; }
    else if (b < 0xe0) { out += String.fromCharCode(((b & 31) << 6) | (bytes[i + 1] & 63)); i += 2; }
    else if (b < 0xf0) { out += String.fromCharCode(((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3; }
    else {
      out += String.fromCodePoint(((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63));
      i += 4;
    }
  }
  return out;
}

function uuidV4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function humanDuration(sec) {
  if (sec < 60) return sec + ' s';
  if (sec < 3600) return Math.round(sec / 60) + ' min';
  if (sec < 86400) return Math.round(sec / 3600) + ' h';
  return Math.round(sec / 86400) + ' days';
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
  if (m) return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  const s = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(String(hex).trim());
  if (s) return { r: parseInt(s[1] + s[1], 16), g: parseInt(s[2] + s[2], 16), b: parseInt(s[3] + s[3], 16) };
  return null;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function rgbToHsb(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [Math.round(h), Math.round(mx === 0 ? 0 : (d / mx) * 100), Math.round(mx * 100)];
}

function relLum({ r, g, b }) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a, b) {
  const l1 = relLum(a), l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}


window.DEV_TOOLS = window.DEV_TOOLS || {};
window.DEV_TOOLS["meta-tag-generator"] = {
"title": "Meta Tag & Open Graph Generator",
"category": "developer",
"icon": "🏷️",
"kind": "generate",
"filename": "meta-tags.html",
"download": {"ext": "html", "type": "text/html"},
"highlight": "html",
"description": "Generate SEO meta tags, Open Graph and Twitter Card markup with live Google, Facebook and X previews, length warnings, robots, twitter:site, image alt text and an image size check from a file you drop.",
"keywords": ["meta tag generator","open graph generator","twitter card","seo meta tags","og tags","og:image:alt","twitter:site","robots meta tag","social share preview"],
"inputLabel": null,
"outputLabel": "Paste into <head>",
"share": ["title","desc","url","image","imgalt","site","twitter","locale","robots"],
"fields": [
  {"key":"title","label":"Page title","type":"text","default":"Free Online Tools and Calculators — 1234Tools"},
  {"key":"desc","label":"Meta description","type":"textarea","default":"Over a thousand free online tools: calculators, converters, PDF, image and AI tools. All but the AI tools run on your device and upload nothing."},
  {"key":"url","label":"Canonical URL","type":"text","default":"https://www.1234tools.com/"},
  {"key":"image","label":"Share image URL","type":"text","default":"https://www.1234tools.com/assets/img/og-image.png"},
  {"key":"imgalt","label":"Image description (og:image:alt)","type":"text","default":""},
  {"key":"site","label":"Site name","type":"text","default":"1234Tools"},
  {"key":"twitter","label":"X account (twitter:site)","type":"text","default":""},
  {"key":"locale","label":"Locale","type":"select","default":"en_GB","options":[{"value":"en_GB","label":"en_GB"},{"value":"en_US","label":"en_US"},{"value":"en_IN","label":"en_IN"}]},
  {"key":"robots","label":"Robots","type":"select","default":"","options":[{"value":"","label":"Do not write a robots tag"},{"value":"index, follow","label":"index, follow"},{"value":"noindex, follow","label":"noindex, follow"},{"value":"index, nofollow","label":"index, nofollow"},{"value":"noindex, nofollow","label":"noindex, nofollow"},{"value":"noindex, nofollow, noarchive","label":"noindex, nofollow, noarchive"},{"value":"index, follow, max-image-preview:large","label":"index, follow, max-image-preview:large"}]},
  {"key":"imgw","label":"Image width (from a dropped file)","type":"number","default":0,"min":0,"remember":false},
  {"key":"imgh","label":"Image height (from a dropped file)","type":"number","default":0,"min":0,"remember":false}
],
"generate": (f) => {
      const e = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      /* a blank field (or only spaces) writes no tag at all, never content="" */
      const has = k => String(f[k] || '').trim() !== '';
      const v = k => e(String(f[k]).trim());
      const img = has('image');
      const w = Math.floor(Number(f.imgw)) || 0, h = Math.floor(Number(f.imgh)) || 0;
      let handle = String(f.twitter || '').trim();
      const handleBad = handle !== '' && !/^@?[A-Za-z0-9_]{1,15}$/.test(handle);
      if (handle && !handleBad) handle = '@' + handle.replace(/^@/, '');
      const lines = [
        has('title') && `<title>${v('title')}</title>`,
        has('desc') && `<meta name="description" content="${v('desc')}">`,
        has('url') && `<link rel="canonical" href="${v('url')}">`,
        has('robots') && `<meta name="robots" content="${v('robots')}">`,
        ``,
        `<!-- Open Graph -->`,
        `<meta property="og:type" content="website">`,
        has('site') && `<meta property="og:site_name" content="${v('site')}">`,
        has('locale') && `<meta property="og:locale" content="${v('locale')}">`,
        has('title') && `<meta property="og:title" content="${v('title')}">`,
        has('desc') && `<meta property="og:description" content="${v('desc')}">`,
        has('url') && `<meta property="og:url" content="${v('url')}">`,
        img && `<meta property="og:image" content="${v('image')}">`,
        img && has('imgalt') && `<meta property="og:image:alt" content="${v('imgalt')}">`,
        img && w > 0 && h > 0 && `<meta property="og:image:width" content="${w}">`,
        img && w > 0 && h > 0 && `<meta property="og:image:height" content="${h}">`,
        ``,
        `<!-- Twitter -->`,
        /* without an image the large-image card has nothing to show */
        `<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">`,
        handle && !handleBad && `<meta name="twitter:site" content="${e(handle)}">`,
        has('title') && `<meta name="twitter:title" content="${v('title')}">`,
        has('desc') && `<meta name="twitter:description" content="${v('desc')}">`,
        img && `<meta name="twitter:image" content="${v('image')}">`,
        img && has('imgalt') && `<meta name="twitter:image:alt" content="${v('imgalt')}">`
      ].filter(l => l !== false);
      if (lines[0] === '') lines.shift();
      const out = lines.join('\n');
      // the tags actually written: every line that opens an element, not the comments or blanks
      const tagCount = lines.filter(l => /^<[a-z]/i.test(l)).length;

      const tl = String(f.title || '').trim().length, dl = String(f.desc || '').trim().length;
      const stats = [
        ['Title length', `${tl} — ${tl === 0 ? 'empty' : tl > 60 ? 'may be truncated' : tl < 30 ? 'quite short' : 'good'}`],
        ['Description length', `${dl} — ${dl === 0 ? 'empty' : dl > 160 ? 'may be truncated' : dl < 70 ? 'quite short' : 'good'}`],
        ['Tags generated', String(tagCount)]
      ];
      if (w > 0 && h > 0) {
        const ratio = w / h;
        const big = w >= 1200 && h >= 630;
        stats.push(['Share image', `${w} × ${h} (${ratio.toFixed(2)}:1) — ${big && Math.abs(ratio - 1.91) < 0.15 ? 'right for a large card' : w < 600 ? 'too small for a large card (600 px wide is the least)' : Math.abs(ratio - 1.91) >= 0.15 ? 'cropped to 1.91:1 on a large card' : 'works, but 1200 × 630 is sharper'}`]);
      }
      const missing = [['title', 'Page title'], ['url', 'Canonical URL'], ['image', 'Share image URL']].filter(m => !has(m[0])).map(m => m[1]);
      const warns = [];
      if (missing.length) warns.push('Blank fields write no tags. Open Graph needs og:title, og:url and og:image, so fill in: ' + missing.join(', ') + '.');
      if (handleBad) warns.push('The X account should be 1 to 15 letters, digits or underscores, such as @1234tools; no twitter:site tag was written.');
      return {
        output: out, stats, warn: warns.join(' '),
        card: { title: String(f.title || '').trim(), desc: String(f.desc || '').trim(), url: String(f.url || '').trim(), image: String(f.image || '').trim(), site: String(f.site || '').trim(), twitter: handleBad ? '' : handle, large: !!img, w: w, h: h }
      };
    },
"tips": ["Google typically shows around 60 characters of a title and 155–160 of a description. Longer is not penalised, it is just cut off.","Share images want 1200×630 pixels. Anything much smaller renders as a small square thumbnail instead of a banner. Drop the image file under the previews to check its size; it is read in your browser and not uploaded.","og:url should be the canonical, absolute address — including https:// and the www you actually serve.","The previews are approximations: each platform changes its card and its cut-off points, and the image is not fetched unless you press the button, so nothing contacts your site while you type.","The robots tag is only written if you choose one. noindex keeps a page out of search results; it does not stop the page being read."],
"faq": [{"q":"Do meta keywords still matter?","a":"No. Google publicly stopped using the keywords meta tag for ranking in 2009. It is omitted here deliberately."},{"q":"Why is there no image in the previews?","a":"Showing it would mean loading the address you typed, which would contact that site while you edit. Press Show the image to fetch it, or drop the file itself to preview it from your device."}],
"mount": (ctx) => { mtMount(ctx); },
"render": function (res, ctx) { mtRender(res, ctx); }
};

function mtMount(ctx) {
  const el = ctx.el;
  const st = { url: '', name: '', remote: false };
  ctx.mt = st;
  const box = el('div', 'mt-drop');
  const label = el('label', 'mt-drop-l', 'Check the share image file (it stays on your device)');
  const inp = el('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'mt-file';
  label.setAttribute('for', 'mt-file');
  const info = el('span', 'mt-drop-i', '');
  const clear = el('button', 'btn-ghost', 'Forget the file');
  clear.type = 'button'; clear.hidden = true;
  box.appendChild(label); box.appendChild(inp); box.appendChild(info); box.appendChild(clear);
  ctx.form.appendChild(box);
  st.info = info; st.clear = clear;
  function load(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { info.textContent = file.name + ' is not an image file.'; return; }
    const u = URL.createObjectURL(file);
    const im = new Image();
    im.onload = function () {
      if (st.url) URL.revokeObjectURL(st.url);
      st.url = u; st.name = file.name;
      ctx.setField('imgw', im.naturalWidth); ctx.setField('imgh', im.naturalHeight);
      info.textContent = file.name + ': ' + im.naturalWidth + ' × ' + im.naturalHeight + ' px';
      clear.hidden = false;
      ctx.run();
    };
    im.onerror = function () { URL.revokeObjectURL(u); info.textContent = file.name + ' could not be read as an image.'; };
    im.src = u;
  }
  inp.addEventListener('change', function () { load(inp.files[0]); inp.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { box.addEventListener(ev, function (e) { e.preventDefault(); box.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { box.addEventListener(ev, function () { box.classList.remove('over'); }); });
  box.addEventListener('drop', function (e) { e.preventDefault(); load(e.dataTransfer.files && e.dataTransfer.files[0]); });
  clear.addEventListener('click', function () {
    if (st.url) URL.revokeObjectURL(st.url);
    st.url = ''; st.name = ''; info.textContent = ''; clear.hidden = true;
    ctx.setField('imgw', 0); ctx.setField('imgh', 0); ctx.run();
  });
}

function mtCut(s, n) { s = String(s); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; }
function mtHost(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return String(u).replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, ''); } }
function mtRender(res, ctx) {
  const st = ctx.mt;
  const box = ctx.extra;
  box.textContent = '';
  /* the two size fields are filled by the file check, not typed */
  const wraps = ctx.form.querySelectorAll('.field');
  if (wraps.length >= 11) { wraps[9].hidden = true; wraps[10].hidden = true; }
  if (!res || res.error || !res.card) return;
  const c = res.card, el = ctx.el;
  const wrap = el('div', 'io-pane mt-prev');
  const head = el('div', 'io-head');
  head.appendChild(el('span', 'io-label', 'Previews (approximate)'));
  wrap.appendChild(head);
  const row = el('div', 'mt-cards');
  const imgBox = function (cls) {
    const b = el('div', 'mt-img ' + cls);
    if (st.url) { const im = el('img'); im.alt = ''; im.src = st.url; b.appendChild(im); }
    else if (st.remote && /^https?:\/\//i.test(c.image)) {
      const im = el('img'); im.alt = ''; im.referrerPolicy = 'no-referrer'; im.src = c.image;
      im.onerror = function () { b.textContent = ''; b.appendChild(el('span', 'mt-ph', 'The image at that address could not be loaded.')); };
      b.appendChild(im);
    } else if (c.image) {
      b.appendChild(el('span', 'mt-ph', 'Image: ' + mtCut(c.image, 60)));
    } else b.appendChild(el('span', 'mt-ph', 'No share image'));
    return b;
  };
  /* Google */
  const g = el('div', 'mt-card mt-google');
  g.appendChild(el('div', 'mt-label', 'Google'));
  const crumb = (function () { try { const u = new URL(c.url); return mtHost(c.url) + (u.pathname.length > 1 ? u.pathname.split('/').filter(Boolean).map(function (x) { return ' › ' + x; }).join('') : ''); } catch (e) { return c.url || 'example.com'; } })();
  g.appendChild(el('div', 'mt-g-site', (c.site ? c.site + ' · ' : '') + crumb));
  g.appendChild(el('div', 'mt-g-title', mtCut(c.title || 'Page title', 60)));
  g.appendChild(el('div', 'mt-g-desc', mtCut(c.desc || 'No description: Google will pick text from the page.', 160)));
  row.appendChild(g);
  /* Facebook, LinkedIn and others that read Open Graph */
  const fb = el('div', 'mt-card mt-fb');
  fb.appendChild(el('div', 'mt-label', 'Facebook and LinkedIn'));
  fb.appendChild(imgBox('mt-img-169'));
  const fbt = el('div', 'mt-fb-t');
  fbt.appendChild(el('div', 'mt-fb-d', mtHost(c.url || '').toUpperCase()));
  fbt.appendChild(el('div', 'mt-fb-ti', mtCut(c.title || 'Page title', 88)));
  fbt.appendChild(el('div', 'mt-fb-de', mtCut(c.desc, 110)));
  fb.appendChild(fbt);
  row.appendChild(fb);
  /* X */
  const x = el('div', 'mt-card mt-x');
  x.appendChild(el('div', 'mt-label', 'X' + (c.twitter ? ' (' + c.twitter + ')' : '')));
  if (c.large) {
    const big = el('div', 'mt-x-big');
    big.appendChild(imgBox('mt-img-2'));
    const cap = el('div', 'mt-x-cap', mtCut(c.title || 'Page title', 70));
    big.appendChild(cap);
    x.appendChild(big);
    x.appendChild(el('div', 'mt-x-dom', mtHost(c.url || '')));
  } else {
    const small = el('div', 'mt-x-small');
    small.appendChild(imgBox('mt-img-sq'));
    const tx = el('div', 'mt-x-tx');
    tx.appendChild(el('div', 'mt-x-dom', mtHost(c.url || '')));
    tx.appendChild(el('div', 'mt-x-ti', mtCut(c.title || 'Page title', 70)));
    tx.appendChild(el('div', 'mt-x-de', mtCut(c.desc, 125)));
    small.appendChild(tx);
    x.appendChild(small);
  }
  row.appendChild(x);
  wrap.appendChild(row);
  const bar = el('div', 'mt-bar');
  if (!st.url && c.image && /^https?:\/\//i.test(c.image)) {
    const b = el('button', 'btn-ghost', st.remote ? 'Hide the image' : 'Show the image from that address');
    b.type = 'button';
    b.addEventListener('click', function () { st.remote = !st.remote; ctx.run(); });
    bar.appendChild(b);
    bar.appendChild(el('span', 'mt-warn', st.remote ? 'The image is being loaded from that address.' : 'Loading it contacts that address, so it only happens when you press this.'));
  }
  wrap.appendChild(bar);
  box.appendChild(wrap);
}
})();
