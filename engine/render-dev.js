/* ============================================================
   Renderer extensions for developer / web-build tools.
   Four new mount modes on top of the calculator renderer:
     mountCode      text in  -> formatted text out
     mountGenerate  form in  -> markup out
     mountQR        text in  -> scannable QR, SVG or PNG
     mountFile      image in -> favicons or resized bitmaps
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

  function downloadButton(label, filename, makeBlob) {
    const b = el('button', 'btn-download', label);
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
      return { wrap: wrap, read: function () { return hex.value; }, key: f.key };
    } else {
      input = el('input', 'control');
      input.type = f.type === 'number' ? 'number' : 'text';
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
    return { wrap: wrap, read: function () { return input.value; }, key: f.key };
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
      s.addEventListener('click', function () { ta.value = spec.sample; run(); });
      inTools.appendChild(s);
    }
    const clr = el('button', 'btn-ghost', 'Clear');
    clr.type = 'button';
    clr.addEventListener('click', function () { ta.value = ''; run(); ta.focus(); });
    inTools.appendChild(clr);
    inHead.appendChild(inTools);
    const ta = el('textarea', 'code-area');
    ta.rows = 10;
    ta.spellcheck = false;
    ta.placeholder = spec.placeholder || '';
    inWrap.appendChild(inHead);
    inWrap.appendChild(ta);

    const outWrap = el('div', 'io-pane');
    const outHead = el('div', 'io-head');
    outHead.appendChild(el('span', 'io-label', spec.outputLabel || 'Output'));
    const outTools = el('div', 'io-actions');
    outTools.appendChild(copyButton(function () { return out.textContent; }));
    outTools.appendChild(downloadButton('Download', function () {
      return spec.id + '-output.txt';
    }, function () { return new Blob([out.textContent], { type: 'text/plain' }); }));
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

    function run() {
      const opts = {};
      readers.forEach(function (r) { opts[r.key] = r.read(); });
      let res;
      try { res = spec.transform(ta.value, opts) || {}; }
      catch (e) { res = { error: 'Something went wrong processing that input.' }; }

      msg.textContent = '';
      msg.className = 'io-msg';
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
      renderStats(stats, res.stats);
    }

    ta.addEventListener('input', run);
    optBar.addEventListener('input', run);
    optBar.addEventListener('change', run);
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

  /* ---------------- QR ---------------- */

  function mountQR(spec, root, encodeQR, qrToSVG) {
    const io = root.querySelector('.tool-io');

    const TYPES = {
      url:   { label: 'Website / URL', fields: [['url', 'Address', 'text', 'https://www.mvritservices.com']] },
      text:  { label: 'Plain text',    fields: [['text', 'Text', 'textarea', 'MVR IT Services — Technology · Delivered']] },
      wifi:  { label: 'WiFi network',  fields: [['ssid', 'Network name (SSID)', 'text', ''], ['pass', 'Password', 'text', ''],
                                                ['enc', 'Security', 'select', 'WPA'], ['hidden', 'Hidden network', 'select', 'no']] },
      vcard: { label: 'Contact card',  fields: [['name', 'Full name', 'text', ''], ['org', 'Organisation', 'text', 'MVR IT Services LTD'],
                                                ['phone', 'Phone', 'text', ''], ['email', 'Email', 'text', ''], ['site', 'Website', 'text', '']] },
      email: { label: 'Email',         fields: [['to', 'To', 'text', ''], ['subj', 'Subject', 'text', ''], ['body', 'Message', 'textarea', '']] },
      sms:   { label: 'SMS',           fields: [['num', 'Number', 'text', ''], ['msg', 'Message', 'textarea', '']] },
      tel:   { label: 'Phone call',    fields: [['num', 'Number', 'text', '']] },
      geo:   { label: 'Map location',  fields: [['lat', 'Latitude', 'text', '51.4543'], ['lon', 'Longitude', 'text', '-0.9781']] }
    };

    const bar = el('div', 'opt-bar');
    const typeWrap = el('div', 'field');
    const typeLab = el('label', null, 'Content type');
    typeLab.setAttribute('for', 'qr-type');
    const typeSel = el('select', 'control');
    typeSel.id = 'qr-type';
    Object.keys(TYPES).forEach(function (k) {
      const o = el('option', null, TYPES[k].label);
      o.value = k;
      typeSel.appendChild(o);
    });
    typeWrap.appendChild(typeLab);
    typeWrap.appendChild(typeSel);
    bar.appendChild(typeWrap);

    ['ec', 'scale'].forEach(function (k) {
      const w = el('div', 'field');
      const l = el('label', null, k === 'ec' ? 'Error correction' : 'Size');
      const s = el('select', 'control');
      const opts = k === 'ec'
        ? [['M', 'Medium — 15% (screens)'], ['L', 'Low — 7% (max data)'], ['Q', 'Quartile — 25% (print)'], ['H', 'High — 30% (logo / harsh)']]
        : [['8', 'Standard'], ['4', 'Small'], ['12', 'Large'], ['20', 'Extra large (print)']];
      opts.forEach(function (o) {
        const op = el('option', null, o[1]);
        op.value = o[0];
        s.appendChild(op);
      });
      s.dataset.name = k;
      w.appendChild(l);
      w.appendChild(s);
      bar.appendChild(w);
    });

    const colWrap = el('div', 'field');
    colWrap.appendChild(el('label', null, 'Colours'));
    const colRow = el('div', 'colour-field');
    const darkIn = el('input');
    darkIn.type = 'color'; darkIn.className = 'colour-swatch'; darkIn.value = '#06080f';
    const lightIn = el('input');
    lightIn.type = 'color'; lightIn.className = 'colour-swatch'; lightIn.value = '#ffffff';
    colRow.appendChild(darkIn);
    colRow.appendChild(lightIn);
    colWrap.appendChild(colRow);
    bar.appendChild(colWrap);

    const fieldHost = el('div', 'gen-form');
    const preview = el('div', 'qr-stage');
    const qrBox = el('div', 'qr-box');
    const msg = el('div', 'io-msg');
    const acts = el('div', 'io-actions qr-actions');
    const stats = el('div', 'stat-grid');
    preview.appendChild(qrBox);
    preview.appendChild(msg);
    preview.appendChild(acts);
    preview.appendChild(stats);

    io.appendChild(bar);
    io.appendChild(fieldHost);
    io.appendChild(preview);

    let readers = [];
    function buildFields() {
      fieldHost.textContent = '';
      readers = TYPES[typeSel.value].fields.map(function (f) {
        const spec2 = { key: f[0], label: f[1], type: f[2], default: f[3] };
        if (f[2] === 'select') {
          spec2.options = f[0] === 'enc'
            ? [{ value: 'WPA', label: 'WPA / WPA2 / WPA3' }, { value: 'WEP', label: 'WEP' }, { value: 'nopass', label: 'Open (no password)' }]
            : [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }];
        }
        const b = buildField(spec2);
        fieldHost.appendChild(b.wrap);
        return b;
      });
    }

    function payload() {
      const v = {};
      readers.forEach(function (r) { v[r.key] = r.read(); });
      const esc = s => String(s || '').replace(/([\\;,:"])/g, '\\$1');
      switch (typeSel.value) {
        case 'url':   return String(v.url || '').trim();
        case 'text':  return v.text || '';
        case 'wifi':  return v.ssid ? `WIFI:T:${v.enc};S:${esc(v.ssid)};${v.enc !== 'nopass' ? 'P:' + esc(v.pass) + ';' : ''}${v.hidden === 'yes' ? 'H:true;' : ''};` : '';
        case 'vcard': return v.name || v.phone || v.email
          ? ['BEGIN:VCARD', 'VERSION:3.0', `FN:${v.name || ''}`, v.org ? `ORG:${v.org}` : '',
             v.phone ? `TEL;TYPE=WORK,VOICE:${v.phone}` : '', v.email ? `EMAIL:${v.email}` : '',
             v.site ? `URL:${v.site}` : '', 'END:VCARD'].filter(Boolean).join('\n')
          : '';
        case 'email': return v.to ? `mailto:${v.to}${v.subj || v.body ? '?' : ''}${v.subj ? 'subject=' + encodeURIComponent(v.subj) : ''}${v.body ? (v.subj ? '&' : '') + 'body=' + encodeURIComponent(v.body) : ''}` : '';
        case 'sms':   return v.num ? `SMSTO:${v.num}:${v.msg || ''}` : '';
        case 'tel':   return v.num ? `tel:${v.num}` : '';
        case 'geo':   return (v.lat && v.lon) ? `geo:${v.lat},${v.lon}` : '';
        default:      return '';
      }
    }

    let currentSVG = '', currentQR = null;

    function run() {
      const data = payload();
      const ec = bar.querySelector('[data-name="ec"]').value;
      const scale = Number(bar.querySelector('[data-name="scale"]').value);

      qrBox.textContent = '';
      acts.textContent = '';
      msg.textContent = '';
      msg.className = 'io-msg';

      if (!data) {
        msg.textContent = 'Fill in the fields above and your QR code will appear here.';
        msg.className = 'io-msg is-note';
        renderStats(stats, null);
        return;
      }

      let qr;
      try { qr = encodeQR(data, ec); }
      catch (e) {
        msg.textContent = e.message;
        msg.className = 'io-msg is-error';
        renderStats(stats, null);
        return;
      }

      currentQR = qr;
      currentSVG = qrToSVG(qr, { scale: scale, dark: darkIn.value, light: lightIn.value });
      qrBox.innerHTML = currentSVG;

      acts.appendChild(downloadButton('Download SVG', 'qr-code.svg', function () {
        return new Blob([currentSVG], { type: 'image/svg+xml' });
      }));
      acts.appendChild(downloadButton('Download PNG', 'qr-code.png', function () {
        return svgToPngBlob(currentSVG, (qr.size + 8) * scale);
      }));
      acts.appendChild(copyButton(function () { return data; }, 'Copy content'));

      renderStats(stats, [
        ['Version', `${qr.version} (${qr.size}×${qr.size} modules)`],
        ['Error correction', { L: 'Low, 7%', M: 'Medium, 15%', Q: 'Quartile, 25%', H: 'High, 30%' }[qr.ecLevel]],
        ['Mask pattern', String(qr.mask)],
        ['Content length', data.length + ' characters'],
        ['Image size', `${(qr.size + 8) * scale}×${(qr.size + 8) * scale} px`]
      ]);
    }

    typeSel.addEventListener('change', function () { buildFields(); run(); });
    fieldHost.addEventListener('input', run);
    fieldHost.addEventListener('change', run);
    bar.addEventListener('input', run);
    bar.addEventListener('change', run);

    buildFields();
    run();
  }

  function svgToPngBlob(svg, size) {
    return new Promise(function (resolve) {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      img.onload = function () {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        c.toBlob(resolve, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
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

        acts.appendChild(downloadButton('Download all as ZIP', 'favicons.zip', function () {
          return zipStore(files.map(function (f) { return { name: f.name, blob: f.blob }; }));
        }));

        const html = [
          '<link rel="icon" href="/favicon.ico" sizes="any">',
          '<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32">',
          '<link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16">',
          '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
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
          ['Source', sourceImg.naturalWidth + '×' + sourceImg.naturalHeight],
          ['Total size', fmtBytes(files.reduce(function (n, f) { return n + f.blob.size; }, 0))]
        ]);
        if (Math.min(sourceImg.naturalWidth, sourceImg.naturalHeight) < 512) {
          msg.textContent = 'Your source is smaller than 512px, so the largest icons are upscaled and will look soft. A 512×512 or larger square image gives the best result.';
          msg.className = 'io-msg is-warn';
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

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  /* ZIP writing lives in engine/zip.js, shared with the image tools. */
  async function zipStore(files) {
    if (!window.MVRZip) throw new Error('zip.js not loaded');
    return window.MVRZip(files);
  }

  window.MVRTool = window.MVRTool || {};
  window.MVRTool.mountCode = mountCode;
  window.MVRTool.mountGenerate = mountGenerate;
  window.MVRTool.mountQR = mountQR;
  window.MVRTool.mountFile = mountFile;
  window.MVRTool._zipStore = zipStore;
})();
