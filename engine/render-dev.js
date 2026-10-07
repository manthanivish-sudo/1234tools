/* ============================================================
   Renderer extensions for developer / web-build tools.
   Three mount modes on top of the calculator renderer:
     mountCode      text in  -> formatted text out
     mountGenerate  form in  -> markup out
     mountFile      image in -> favicons or resized bitmaps
   The QR generator, bulk generator and scanner are in render-qr.js.
   ============================================================ */
(function () {
  'use strict';

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function copyButton(getText, label) {
    const b = el('button', 'btn-copy', label || 'Copy');
    b.type = 'button';
    b.addEventListener('click', function () {
      const txt = getText();
      if (!txt) return;
      navigator.clipboard?.writeText(txt).then(function () {
        const was = b.textContent;
        b.textContent = 'Copied';
        b.classList.add('ok');
        setTimeout(function () { b.textContent = was; b.classList.remove('ok'); }, 1400);
      });
    });
    return b;
  }

  function downloadButton(label, filename, makeBlob, cls) {
    const b = el('button', cls || 'btn-download', label);
    b.type = 'button';
    b.addEventListener('click', async function () {
      const blob = await makeBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = el('a');
      a.href = url;
      a.download = typeof filename === 'function' ? filename() : filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });
    return b;
  }

  function buildField(f) {
    const wrap = el('div', 'field');
    const id = 'f-' + f.key;
    const lab = el('label', null, f.label);
    lab.setAttribute('for', id);
    wrap.appendChild(lab);

    let input;
    if (f.type === 'select') {
      input = el('select', 'control');
      (f.options || []).forEach(function (o) {
        const opt = el('option', null, o.label);
        opt.value = o.value;
        if (String(o.value) === String(f.default)) opt.selected = true;
        input.appendChild(opt);
      });
    } else if (f.type === 'textarea') {
      input = el('textarea', 'control');
      input.rows = 3;
      input.value = f.default || '';
    } else if (f.type === 'color') {
      input = el('div', 'colour-field');
      const swatch = el('input');
      swatch.type = 'color';
      swatch.className = 'colour-swatch';
      swatch.value = f.default || '#000000';
      const hex = el('input', 'control colour-hex');
      hex.type = 'text';
      hex.value = f.default || '#000000';
      hex.spellcheck = false;
      swatch.addEventListener('input', function () {
        hex.value = swatch.value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      hex.addEventListener('input', function () {
        if (/^#[0-9a-f]{6}$/i.test(hex.value)) swatch.value = hex.value;
      });
      input.appendChild(swatch);
      input.appendChild(hex);
      input._value = function () { return hex.value; };
      input.dataset.name = f.key;
      wrap.appendChild(input);
      return {
        wrap: wrap, key: f.key,
        read: function () { return hex.value; },
        write: function (v) { hex.value = v; swatch.value = v; }
      };
    } else {
      input = el('input', 'control');
      const NATIVE = ['number', 'date', 'time', 'datetime-local', 'email', 'tel', 'url'];
      input.type = NATIVE.indexOf(f.type) >= 0 ? f.type : 'text';
      if (f.type === 'number') {
        input.inputMode = 'numeric';
        if (f.min !== undefined) input.min = f.min;
        if (f.max !== undefined) input.max = f.max;
      }
      input.value = f.default !== undefined ? f.default : '';
    }
    input.id = id;
    input.name = f.key;
    wrap.appendChild(input);
    return {
      wrap: wrap, key: f.key,
      read: function () { return input.value; },
      write: function (v) { input.value = v; }
    };
  }

  /* The query string and the fragment of the link, the fragment winning. The
     share bar puts what it carries after the #, which never reaches a server
     or analytics; the Tool Finder still sends ?text=. */
  const linkParams = () => { const q = new URLSearchParams(location.search); try { const h = new URLSearchParams(location.hash.replace(/^#/, '')); for (const [k, v] of h) q.set(k, v); } catch (e) {} return q; };

  /* The share bar's hand-off: the same three lines in every engine. */
  function announce(state) {
    (window.MVRTool = window.MVRTool || {}).shareState = function () { return state; };
    document.dispatchEvent(new CustomEvent('mvr:result', { detail: state }));
  }

  function renderStats(container, stats) {
    container.textContent = '';
    if (!stats || !stats.length) return;
    stats.forEach(function (row) {
      const r = el('div', 'stat-row');
      r.appendChild(el('span', 'stat-key', row[0]));
      r.appendChild(el('span', 'stat-val', row[1]));
      container.appendChild(r);
    });
  }

  /* ---------------- a rendered preview that cannot run anything ----------------

     The Markdown converter's HTML, shown rendered. The engine already escapes
     raw HTML and refuses unsafe addresses, but the preview does not take its
     word for it. The markup is parsed by DOMParser into a separate, inert
     document — scripts there never run, handlers never fire, nothing loads —
     and then rebuilt here node by node with createElement:
       - only the tags a Markdown converter writes are kept; script, style,
         iframe, svg, form and the like are dropped with their content, and any
         other unknown tag is replaced by its text;
       - no attribute is copied except a link's address, checked by the
         browser's own URL parser (http, https, mailto, tel; a relative one
         resolves to this site), and a code block's language-… class;
       - a picture is never fetched: a remote image would tell its server who
         looked, so it becomes a labelled box naming the address;
       - links open in a new tab, with no referrer and no opener. */
  const PREVIEW_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
    'pre', 'code', 'em', 'strong', 'b', 'i', 'del', 's', 'hr', 'br', 'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td']);
  const PREVIEW_DROP = new Set(['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
    'template', 'noscript', 'svg', 'math', 'link', 'meta', 'base', 'title', 'head', 'form', 'input', 'button',
    'textarea', 'select', 'option', 'audio', 'video', 'source', 'track', 'canvas', 'portal', 'xmp', 'plaintext', 'noembed', 'noframes']);

  function previewHref(href) {
    try {
      const u = new URL(String(href), location.href);
      return ['http:', 'https:', 'mailto:', 'tel:'].indexOf(u.protocol) >= 0 ? u.href : null;
    } catch (e) { return null; }
  }

  function sanitisedPreview(html) {
    const frag = document.createDocumentFragment();
    let doc;
    try { doc = new DOMParser().parseFromString('<!DOCTYPE html><body>' + String(html || ''), 'text/html'); }
    catch (e) { return frag; }
    (function copy(from, to) {
      Array.prototype.forEach.call(from.childNodes, function (n) {
        if (n.nodeType === 3) { to.appendChild(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;                       // comments, processing instructions
        const tag = n.localName;
        if (PREVIEW_DROP.has(tag)) return;
        if (!PREVIEW_TAGS.has(tag)) { copy(n, to); return; }
        if (tag === 'img') {
          const alt = n.getAttribute('alt') || '';
          const box = el('span', 'md-img', 'Image: ' + (alt || 'no description') + ' (not loaded in the preview)');
          const src = n.getAttribute('src');
          if (src) box.title = src;
          to.appendChild(box);
          return;
        }
        const out = document.createElement(tag);
        if (tag === 'a') {
          const href = previewHref(n.getAttribute('href'));
          if (href) {
            out.href = href;
            out.target = '_blank';
            out.rel = 'noopener noreferrer nofollow';
            out.referrerPolicy = 'no-referrer';
          }
        } else if (tag === 'code') {
          const cls = n.getAttribute('class') || '';
          if (/^language-[\w+-]+$/.test(cls)) out.className = cls;
        } else if (tag === 'th' || tag === 'td') {
          // a table column's alignment, from three fixed values only
          const al = /^text-align:(left|center|right)$/.exec(n.getAttribute('style') || '');
          if (al) out.style.textAlign = al[1];
        }
        copy(n, out);
        to.appendChild(out);
      });
    })(doc.body, frag);
    return frag;
  }

  /* ---------------- text in, code out ---------------- */

  function mountCode(spec, root) {
    const io = root.querySelector('.tool-io');

    const optBar = el('div', 'opt-bar');
    const readers = (spec.options || []).map(function (o) {
      const f = buildField(o);
      optBar.appendChild(f.wrap);
      return f;
    });

    const inWrap = el('div', 'io-pane');
    const inHead = el('div', 'io-head');
    inHead.appendChild(el('span', 'io-label', spec.inputLabel || 'Input'));
    const inTools = el('div', 'io-actions');
    if (spec.sample) {
      const s = el('button', 'btn-ghost', 'Load example');
      s.type = 'button';
      s.addEventListener('click', function () { touched = true; ta.value = spec.sample; run(); });
      inTools.appendChild(s);
    }
    const clr = el('button', 'btn-ghost', 'Clear');
    clr.type = 'button';
    clr.addEventListener('click', function () { touched = true; ta.value = ''; run(); ta.focus(); });
    inTools.appendChild(clr);
    inHead.appendChild(inTools);
    const ta = el('textarea', 'code-area');
    ta.rows = 10;
    ta.spellcheck = false;
    ta.placeholder = spec.placeholder || '';
    inWrap.appendChild(inHead);
    inWrap.appendChild(ta);

    /* A tool whose spec has `files: { accept, label }` also takes a file:
       an Open button and a drop on the text box both read it as text into
       the box. Nothing is uploaded; the file is read by this page. */
    let openedName = null;
    if (spec.files) {
      const picker = el('input', 'visually-hidden');
      picker.type = 'file';
      picker.accept = spec.files.accept || '';
      picker.tabIndex = -1;
      picker.setAttribute('aria-hidden', 'true');
      const readInto = function (f) {
        if (!f) return;
        f.text().then(function (t) { openedName = f.name; touched = true; ta.value = t; run(); });
      };
      const ob = el('button', 'btn-ghost', spec.files.label || 'Open file');
      ob.type = 'button';
      ob.addEventListener('click', function () { picker.click(); });
      picker.addEventListener('change', function () { readInto(picker.files[0]); picker.value = ''; });
      inTools.insertBefore(ob, inTools.firstChild);
      inWrap.appendChild(picker);
      ['dragenter', 'dragover'].forEach(function (ev) {
        ta.addEventListener(ev, function (e) {
          if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); ta.classList.add('over'); }
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) { ta.addEventListener(ev, function () { ta.classList.remove('over'); }); });
      ta.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); readInto(e.dataTransfer.files[0]); }
      });
    }

    const outWrap = el('div', 'io-pane');
    const outHead = el('div', 'io-head');
    outHead.appendChild(el('span', 'io-label', spec.outputLabel || 'Output'));
    const outTools = el('div', 'io-actions');
    outTools.appendChild(copyButton(function () { return out.textContent; }));
    /* `download: { ext, type, suffix }` saves the output as that file type,
       named after the opened file when there is one (icon.svg →
       icon-optimised.svg); otherwise a plain-text <tool>-output.txt. */
    const dlSpec = spec.download || { ext: 'txt', type: 'text/plain' };
    outTools.appendChild(downloadButton('Download', function () {
      const base = openedName && spec.download ? openedName.replace(/\.[^.]+$/, '') + (dlSpec.suffix || '') : spec.id + '-output';
      return base + '.' + dlSpec.ext;
    }, function () { return new Blob([out.textContent], { type: dlSpec.type }); }));
    outHead.appendChild(outTools);
    const out = el('pre', 'code-out');
    const msg = el('div', 'io-msg');
    const stats = el('div', 'stat-grid');
    outWrap.appendChild(outHead);
    outWrap.appendChild(msg);
    outWrap.appendChild(out);
    outWrap.appendChild(stats);

    io.appendChild(optBar);
    io.appendChild(inWrap);
    io.appendChild(outWrap);

    /* A tool that writes HTML (the Markdown converter) also shows it
       rendered, through sanitisedPreview: never as innerHTML. */
    let preview = null;
    if (spec.livePreview) {
      const pWrap = el('div', 'io-pane');
      const pHead = el('div', 'io-head');
      pHead.appendChild(el('span', 'io-label', 'Preview'));
      preview = el('div', 'md-preview');
      pWrap.appendChild(pHead);
      pWrap.appendChild(preview);
      io.appendChild(pWrap);
    }

    /* Text travels in a shared link only while it is short: past 300
       characters the link stops being a link, and long text is the kind most
       likely to be somebody's draft. The output never travels. */
    let touched = false, fromLink = false;
    function run() {
      paint();
      announce({
        kind: 'code',
        params: (ta.value && ta.value.length <= 300) ? { text: ta.value } : {},
        summary: null,
        changed: touched || fromLink
      });
    }

    function paint() {
      const opts = {};
      readers.forEach(function (r) { opts[r.key] = r.read(); });
      let res;
      try { res = spec.transform(ta.value, opts) || {}; }
      catch (e) { res = { error: 'Something went wrong processing that input.' }; }

      msg.textContent = '';
      msg.className = 'io-msg';
      if (preview) preview.textContent = '';
      if (res.error) {
        out.textContent = '';
        msg.textContent = res.error;
        msg.className = 'io-msg is-error';
        renderStats(stats, null);
        return;
      }
      if (res.note) { msg.textContent = res.note; msg.className = 'io-msg is-note'; }
      if (res.warn) { msg.textContent = res.warn; msg.className = 'io-msg is-warn'; }
      out.textContent = res.output || '';
      if (preview && res.preview) preview.appendChild(sanitisedPreview(res.preview));
      renderStats(stats, res.stats);
    }

    /* A link can carry the text to work on: ?text=one%20two%20three opens
       the word counter already counted. Up to 4,000 characters, read here in
       the browser and sent nowhere; nothing else is taken from the URL. */
    try {
      const given = linkParams().get('text');
      if (given !== null) ta.value = given.slice(0, 4000).replace(/[\uD800-\uDBFF]$/, '');
      fromLink = given !== null && given !== '';
    } catch (e) { /* no URL, no prefill */ }

    const used = function () { touched = true; run(); };
    ta.addEventListener('input', used);
    optBar.addEventListener('input', used);
    optBar.addEventListener('change', used);
    run();
  }

  /* ---------------- form in, markup out ---------------- */

  function mountGenerate(spec, root) {
    const io = root.querySelector('.tool-io');

    const form = el('div', 'gen-form');
    const readers = (spec.fields || []).map(function (f) {
      const b = buildField(f);
      form.appendChild(b.wrap);
      return b;
    });
    if (spec.regenerate) {
      const again = el('button', 'btn-primary', 'Generate again');
      again.type = 'button';
      again.addEventListener('click', run);
      form.appendChild(again);
    }

    const outWrap = el('div', 'io-pane');
    const head = el('div', 'io-head');
    head.appendChild(el('span', 'io-label', spec.outputLabel || 'Output'));
    const acts = el('div', 'io-actions');
    acts.appendChild(copyButton(function () { return out.textContent; }));
    acts.appendChild(downloadButton('Download', spec.filename || 'output.txt',
      function () { return new Blob([out.textContent], { type: 'text/plain' }); }));
    head.appendChild(acts);

    const swatch = el('div', 'swatch-preview');
    swatch.hidden = true;
    const gradient = el('div', 'gradient-preview');
    gradient.hidden = true;
    const msg = el('div', 'io-msg');
    const out = el('pre', 'code-out');
    const stats = el('div', 'stat-grid');

    outWrap.appendChild(head);
    outWrap.appendChild(swatch);
    outWrap.appendChild(gradient);
    outWrap.appendChild(msg);
    outWrap.appendChild(out);
    outWrap.appendChild(stats);

    io.appendChild(form);
    io.appendChild(outWrap);

    function run() {
      const f = {};
      readers.forEach(function (r) { f[r.key] = r.read(); });
      let res;
      try { res = spec.generate(f) || {}; }
      catch (e) { res = { error: 'Could not generate output from those values.' }; }

      msg.textContent = '';
      msg.className = 'io-msg';
      swatch.hidden = true;
      gradient.hidden = true;

      if (res.error) {
        out.textContent = '';
        msg.textContent = res.error;
        msg.className = 'io-msg is-error';
        renderStats(stats, null);
        return;
      }
      if (res.warn) { msg.textContent = res.warn; msg.className = 'io-msg is-warn'; }

      if (res.swatch) {
        swatch.hidden = false;
        swatch.style.background = res.swatch.bg;
        swatch.style.color = res.swatch.fg;
        swatch.textContent = 'Sample text on this background — 21px';
      }
      if (res.preview) {
        gradient.hidden = false;
        gradient.style.background = res.preview;
      }

      out.textContent = res.output || '';
      renderStats(stats, res.stats);
    }

    form.addEventListener('input', run);
    form.addEventListener('change', run);
    run();
  }

  /* ---------------- file in, images out ---------------- */

  const FAVICON_SIZES = [
    [16, 'favicon-16x16.png', 'Browser tab'],
    [32, 'favicon-32x32.png', 'Tab, retina'],
    [48, 'favicon-48x48.png', 'Windows shortcut'],
    [96, 'favicon-96x96.png', 'Android tab'],
    [180, 'apple-touch-icon.png', 'iOS home screen'],
    [192, 'icon-192.png', 'Android / PWA'],
    [512, 'icon-512.png', 'PWA splash'],
    [512, 'icon-maskable-512.png', 'Android maskable']
  ];

  function mountFile(spec, root) {
    const io = root.querySelector('.tool-io');
    const isFavicon = spec.kind === 'favicon';

    const drop = el('div', 'dropzone');
    drop.tabIndex = 0;
    drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose an image</strong><span>or drag one here — it stays on your device</span>';
    const file = el('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.className = 'visually-hidden';
    drop.appendChild(file);

    const opts = el('div', 'opt-bar');
    let readers = [];
    if (!isFavicon) {
      [
        { key: 'width', label: 'Width (px, 0 = auto)', type: 'number', default: 1200, min: 0 },
        { key: 'height', label: 'Height (px, 0 = auto)', type: 'number', default: 0, min: 0 },
        { key: 'format', label: 'Format', type: 'select', default: 'image/webp',
          options: [{ value: 'image/webp', label: 'WebP (smallest)' }, { value: 'image/jpeg', label: 'JPEG' }, { value: 'image/png', label: 'PNG' }] },
        { key: 'quality', label: 'Quality (1–100)', type: 'number', default: 80, min: 1, max: 100 }
      ].forEach(function (f) {
        const b = buildField(f);
        opts.appendChild(b.wrap);
        readers.push(b);
      });
    } else {
      const b = buildField({ key: 'bg', label: 'Background (for transparent images)', type: 'color', default: '#ffffff' });
      opts.appendChild(b.wrap);
      readers.push(b);
      const n = buildField({ key: 'appname', label: 'Site name (for site.webmanifest)', type: 'text', default: '' });
      opts.appendChild(n.wrap);
      readers.push(n);
    }

    const msg = el('div', 'io-msg');
    const results = el('div', 'file-results');
    const acts = el('div', 'io-actions');
    const stats = el('div', 'stat-grid');

    io.appendChild(drop);
    io.appendChild(opts);
    io.appendChild(msg);
    io.appendChild(results);
    io.appendChild(acts);
    io.appendChild(stats);

    let sourceImg = null, sourceFile = null;

    drop.addEventListener('click', function () { file.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); }
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) load(f);
    });
    file.addEventListener('change', function () { if (file.files[0]) load(file.files[0]); });
    opts.addEventListener('input', function () { if (sourceImg) render(); });
    opts.addEventListener('change', function () { if (sourceImg) render(); });

    function load(f) {
      if (!/^image\//.test(f.type)) {
        msg.textContent = 'That is not an image file. Choose a PNG, JPEG, SVG or WebP.';
        msg.className = 'io-msg is-error';
        return;
      }
      sourceFile = f;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = function () {
        sourceImg = img;
        drop.innerHTML = '<strong>' + f.name + '</strong><span>' +
          img.naturalWidth + '×' + img.naturalHeight + ' · ' + fmtBytes(f.size) +
          ' — click to choose another</span>';
        drop.appendChild(file);
        render();
      };
      img.onerror = function () {
        msg.textContent = 'That image could not be read. It may be corrupt or an unsupported format.';
        msg.className = 'io-msg is-error';
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }

    function drawTo(size, bg, maskable) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size); }
      ctx.imageSmoothingQuality = 'high';
      // contain, centred; maskable icons get an 80% safe zone
      const inset = maskable ? size * 0.1 : 0;
      const box = size - inset * 2;
      const r = Math.min(box / sourceImg.naturalWidth, box / sourceImg.naturalHeight);
      const w = sourceImg.naturalWidth * r, h = sourceImg.naturalHeight * r;
      ctx.drawImage(sourceImg, (size - w) / 2, (size - h) / 2, w, h);
      return c;
    }

    async function render() {
      results.textContent = '';
      acts.textContent = '';
      msg.textContent = '';
      msg.className = 'io-msg';

      if (isFavicon) {
        const bg = readers[0].read();
        const files = [];
        for (const [size, name, use] of FAVICON_SIZES) {
          const canvas = drawTo(size, bg, name.indexOf('maskable') > -1);
          const blob = await new Promise(function (r) { canvas.toBlob(r, 'image/png'); });
          files.push({ name: name, blob: blob, size: size });

          const card = el('div', 'file-card');
          const thumb = el('div', 'file-thumb');
          thumb.appendChild(canvas);
          canvas.style.width = Math.min(64, size) + 'px';
          canvas.style.height = Math.min(64, size) + 'px';
          card.appendChild(thumb);
          card.appendChild(el('strong', null, size + '×' + size));
          card.appendChild(el('span', 'file-use', use));
          card.appendChild(el('span', 'file-size', fmtBytes(blob.size)));
          const d = downloadButton('Save', name, function () { return blob; });
          d.className = 'btn-ghost';
          card.appendChild(d);
          results.appendChild(card);
        }

        /* favicon.ico and site.webmanifest are made here too, so the snippet
           below names exactly the files in the ZIP and nothing else. */
        const ico = await makeIco(files.filter(function (f) { return f.size <= 48; }));
        const appName = String(readers[1].read() || '').trim();
        const manifest = { };
        if (appName) { manifest.name = appName; manifest.short_name = appName; }
        manifest.icons = [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ];
        if (/^#[0-9a-f]{6}$/i.test(bg)) { manifest.theme_color = bg; manifest.background_color = bg; }
        manifest.start_url = '/';
        manifest.display = 'standalone';
        const webmanifest = new Blob([JSON.stringify(manifest, null, 2) + '\n'], { type: 'application/manifest+json' });
        const extras = [
          { name: 'favicon.ico', blob: ico, tag: 'ICO', use: '16, 32 and 48 px inside' },
          { name: 'site.webmanifest', blob: webmanifest, tag: 'JSON', use: appName ? 'Lists the app icons' : 'Lists the app icons; no site name yet' }
        ];
        extras.forEach(function (x) {
          const card = el('div', 'file-card');
          const thumb = el('div', 'file-thumb');
          thumb.appendChild(el('span', 'file-type', x.tag));
          card.appendChild(thumb);
          card.appendChild(el('strong', null, x.name));
          card.appendChild(el('span', 'file-use', x.use));
          card.appendChild(el('span', 'file-size', fmtBytes(x.blob.size)));
          const d = downloadButton('Save', x.name, function () { return x.blob; });
          d.className = 'btn-ghost';
          card.appendChild(d);
          results.appendChild(card);
        });
        const zipFiles = files.map(function (f) { return { name: f.name, blob: f.blob }; })
          .concat(extras.map(function (x) { return { name: x.name, blob: x.blob }; }));

        acts.appendChild(downloadButton('Download all as ZIP', 'favicons.zip', function () {
          return zipStore(zipFiles);
        }));

        const html = [
          '<link rel="icon" href="/favicon.ico" sizes="any">',
          '<link rel="icon" href="/favicon-96x96.png" type="image/png" sizes="96x96">',
          '<link rel="icon" href="/favicon-48x48.png" type="image/png" sizes="48x48">',
          '<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32">',
          '<link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16">',
          '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">',
          '<link rel="manifest" href="/site.webmanifest">'
        ].join('\n');
        const pane = el('div', 'io-pane');
        const head = el('div', 'io-head');
        head.appendChild(el('span', 'io-label', 'Add this to your <head>'));
        const hacts = el('div', 'io-actions');
        hacts.appendChild(copyButton(function () { return html; }));
        head.appendChild(hacts);
        const pre = el('pre', 'code-out', html);
        pane.appendChild(head);
        pane.appendChild(pre);
        results.parentNode.insertBefore(pane, stats);

        renderStats(stats, [
          ['Icons generated', String(files.length)],
          ['Files in the ZIP', String(zipFiles.length)],
          ['Source', sourceImg.naturalWidth + '×' + sourceImg.naturalHeight],
          ['Icons total size', fmtBytes(files.reduce(function (n, f) { return n + f.blob.size; }, 0))]
        ]);
        /* An icon is enlarged when the box the source is fitted into is bigger
           than the source's longer side; name those sizes rather than hint. */
        const longSide = Math.max(sourceImg.naturalWidth, sourceImg.naturalHeight);
        const enlarged = [];
        FAVICON_SIZES.forEach(function (s) {
          const box = s[1].indexOf('maskable') > -1 ? s[0] * 0.8 : s[0];
          const label = (s[1].indexOf('maskable') > -1 ? 'maskable ' : '') + s[0] + ' px';
          if (box > longSide) enlarged.push(label);
        });
        const notes = [];
        if (enlarged.length) {
          const list = enlarged.length > 1 ? enlarged.slice(0, -1).join(', ') + ' and ' + enlarged[enlarged.length - 1] : enlarged[0];
          notes.push('Your source is smaller than 512px, so it is scaled up to make the ' + list + ' icons, and those will look soft. A square image of 512×512 or larger keeps every size sharp.');
        }
        if (!appName) notes.push('Type a site name above to add it to site.webmanifest; browsers want a name before they offer to install a site as an app.');
        if (notes.length) {
          msg.textContent = notes.join(' ');
          msg.className = enlarged.length ? 'io-msg is-warn' : 'io-msg';
        }
        return;
      }

      // resizer
      const o = {};
      readers.forEach(function (r) { o[r.key] = r.read(); });
      let w = Number(o.width) || 0, h = Number(o.height) || 0;
      const nw = sourceImg.naturalWidth, nh = sourceImg.naturalHeight;
      if (!w && !h) { w = nw; h = nh; }
      else if (!h) h = Math.round(nh * (w / nw));
      else if (!w) w = Math.round(nw * (h / nh));

      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      if (o.format === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(sourceImg, 0, 0, w, h);

      const q = Math.max(1, Math.min(100, Number(o.quality) || 80)) / 100;
      const blob = await new Promise(function (r) { c.toBlob(r, o.format, q); });
      if (!blob) {
        msg.textContent = 'This browser could not encode that format. Try PNG or JPEG.';
        msg.className = 'io-msg is-error';
        return;
      }

      const card = el('div', 'file-card file-card-wide');
      const thumb = el('div', 'file-thumb');
      const prev = el('img');
      prev.src = URL.createObjectURL(blob);
      prev.alt = 'Resized preview';
      thumb.appendChild(prev);
      card.appendChild(thumb);
      results.appendChild(card);

      const ext = o.format.split('/')[1].replace('jpeg', 'jpg');
      acts.appendChild(downloadButton('Download image', function () {
        return (sourceFile.name.replace(/\.[^.]+$/, '') || 'image') + '-' + w + 'x' + h + '.' + ext;
      }, function () { return blob; }));

      const saved = sourceFile.size - blob.size;
      renderStats(stats, [
        ['Original', nw + '×' + nh + ' · ' + fmtBytes(sourceFile.size)],
        ['Result', w + '×' + h + ' · ' + fmtBytes(blob.size)],
        ['Change', (saved > 0 ? '−' : '+') + fmtBytes(Math.abs(saved)) + ' (' +
                   (saved > 0 ? '−' : '+') + Math.abs(Math.round(saved / sourceFile.size * 100)) + '%)'],
        ['Format', ext.toUpperCase()]
      ]);
      if (saved < 0) {
        msg.textContent = 'The result is larger than the original. Lower the quality, reduce the dimensions, or keep the original format.';
        msg.className = 'io-msg is-warn';
      }
    }
  }

  /* A Windows icon file whose images are stored as PNG: a 6-byte header, a
     16-byte entry per image with its size, byte length and offset, then the
     PNGs unchanged. */
  async function makeIco(pngs) {
    const bufs = await Promise.all(pngs.map(function (p) { return p.blob.arrayBuffer(); }));
    const head = new ArrayBuffer(6 + 16 * bufs.length);
    const v = new DataView(head);
    v.setUint16(0, 0, true);
    v.setUint16(2, 1, true);
    v.setUint16(4, bufs.length, true);
    let offset = head.byteLength;
    bufs.forEach(function (b, i) {
      const at = 6 + 16 * i, px = pngs[i].size >= 256 ? 0 : pngs[i].size;
      v.setUint8(at, px);
      v.setUint8(at + 1, px);
      v.setUint8(at + 2, 0);
      v.setUint8(at + 3, 0);
      v.setUint16(at + 4, 1, true);
      v.setUint16(at + 6, 32, true);
      v.setUint32(at + 8, b.byteLength, true);
      v.setUint32(at + 12, offset, true);
      offset += b.byteLength;
    });
    return new Blob([head].concat(bufs), { type: 'image/x-icon' });
  }

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  /* ZIP writing lives in engine/zip.js, shared with the image tools. The page
     loads it; if a page does not (the favicon generator once did not, so
     "Download all as ZIP" did nothing), it is fetched from this site on
     first use rather than failing silently. */
  let zipLoading = null;
  function loadZip() {
    if (window.MVRZip) return Promise.resolve();
    if (!zipLoading) {
      zipLoading = new Promise(function (resolve, reject) {
        const s = document.createElement('script');
        s.src = (window.__BASE__ || '/') + 'engine/zip.js';
        s.onload = function () { window.MVRZip ? resolve() : reject(new Error('zip.js loaded but defined no MVRZip')); };
        s.onerror = function () { zipLoading = null; reject(new Error('zip.js could not be loaded')); };
        document.head.appendChild(s);
      });
    }
    return zipLoading;
  }
  async function zipStore(files) {
    await loadZip();
    return window.MVRZip(files);
  }

  window.MVRTool = window.MVRTool || {};
  window.MVRTool.mountCode = mountCode;
  window.MVRTool.mountGenerate = mountGenerate;
  window.MVRTool.mountFile = mountFile;
  window.MVRTool._zipStore = zipStore;
})();
