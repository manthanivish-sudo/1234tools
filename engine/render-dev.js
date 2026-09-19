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

  /* Escapes for the payload formats that carry their own quoting rules.
     Getting these wrong is the usual reason a WiFi or contact code scans but
     then hands the phone a mangled password or name. */
  const escWifi = (s) => String(s == null ? '' : s).replace(/([\\;,:"])/g, '\\$1');
  const escCard = (s) => String(s == null ? '' : s).replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');
  const digitsOnly = (s) => String(s == null ? '' : s).replace(/[^\d+]/g, '');

  /** VCALENDAR wants 20260911T140000, from an <input type="datetime-local">. */
  function icsStamp(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(v || ''));
    return m ? m[1] + m[2] + m[3] + 'T' + m[4] + m[5] + '00' : '';
  }

  const queryString = (o) => Object.keys(o)
    .filter((k) => o[k] !== '' && o[k] != null)
    .map((k) => k + '=' + encodeURIComponent(o[k]))
    .join('&');

  /* Content types: which fields to show, and how to turn them into the exact
     string a scanner expects. `ready` decides whether there is enough to
     encode yet, so the preview does not flash errors while someone types. */
  const QR_TYPES = {
    url: {
      label: 'Website / URL',
      fields: [['url', 'Address', 'text', 'https://www.1234tools.com']],
      ready: (v) => !!String(v.url || '').trim(),
      build: (v) => {
        const s = String(v.url).trim();
        return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s;
      }
    },
    text: {
      label: 'Plain text',
      fields: [['text', 'Text', 'textarea', 'MVR IT Services - Technology, Delivered']],
      ready: (v) => !!v.text,
      build: (v) => v.text
    },
    wifi: {
      label: 'WiFi network',
      fields: [['ssid', 'Network name (SSID)', 'text', ''], ['pass', 'Password', 'text', ''],
               ['enc', 'Security', 'select', 'WPA'], ['hidden', 'Hidden network', 'select', 'no']],
      options: {
        enc: [['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP'], ['nopass', 'Open (no password)']],
        hidden: [['no', 'No'], ['yes', 'Yes']]
      },
      ready: (v) => !!v.ssid,
      build: (v) => 'WIFI:T:' + (v.enc || 'WPA') + ';S:' + escWifi(v.ssid) + ';' +
        (v.enc !== 'nopass' ? 'P:' + escWifi(v.pass) + ';' : '') +
        (v.hidden === 'yes' ? 'H:true;' : '') + ';'
    },
    vcard: {
      label: 'Contact card (vCard)',
      fields: [['first', 'First name', 'text', ''], ['last', 'Last name', 'text', ''],
               ['org', 'Organisation', 'text', ''], ['title', 'Job title', 'text', ''],
               ['phone', 'Mobile', 'text', ''], ['work', 'Work phone', 'text', ''],
               ['email', 'Email', 'text', ''], ['site', 'Website', 'text', ''],
               ['street', 'Street', 'text', ''], ['city', 'City', 'text', ''],
               ['zip', 'Postcode', 'text', ''], ['country', 'Country', 'text', '']],
      ready: (v) => !!(v.first || v.last || v.phone || v.email),
      build: (v) => [
        'BEGIN:VCARD', 'VERSION:3.0',
        'N:' + escCard(v.last) + ';' + escCard(v.first) + ';;;',
        'FN:' + escCard([v.first, v.last].filter(Boolean).join(' ')),
        v.org ? 'ORG:' + escCard(v.org) : '',
        v.title ? 'TITLE:' + escCard(v.title) : '',
        v.phone ? 'TEL;TYPE=CELL:' + v.phone : '',
        v.work ? 'TEL;TYPE=WORK,VOICE:' + v.work : '',
        v.email ? 'EMAIL;TYPE=INTERNET:' + v.email : '',
        v.site ? 'URL:' + v.site : '',
        (v.street || v.city || v.zip || v.country)
          ? 'ADR;TYPE=WORK:;;' + escCard(v.street) + ';' + escCard(v.city) + ';;' + escCard(v.zip) + ';' + escCard(v.country)
          : '',
        'END:VCARD'
      ].filter(Boolean).join('\n')
    },
    mecard: {
      label: 'Contact card (MeCard)',
      fields: [['name', 'Full name', 'text', ''], ['phone', 'Phone', 'text', ''],
               ['email', 'Email', 'text', ''], ['url', 'Website', 'text', ''],
               ['note', 'Note', 'text', '']],
      ready: (v) => !!(v.name || v.phone || v.email),
      build: (v) => 'MECARD:' + [
        v.name ? 'N:' + escCard(v.name) : '',
        v.phone ? 'TEL:' + digitsOnly(v.phone) : '',
        v.email ? 'EMAIL:' + escCard(v.email) : '',
        v.url ? 'URL:' + escCard(v.url) : '',
        v.note ? 'NOTE:' + escCard(v.note) : ''
      ].filter(Boolean).join(';') + ';;'
    },
    email: {
      label: 'Email',
      fields: [['to', 'To', 'text', ''], ['subj', 'Subject', 'text', ''], ['body', 'Message', 'textarea', '']],
      ready: (v) => !!v.to,
      build: (v) => {
        const q = queryString({ subject: v.subj, body: v.body });
        return 'mailto:' + String(v.to).trim() + (q ? '?' + q : '');
      }
    },
    sms: {
      label: 'SMS',
      fields: [['num', 'Number', 'text', ''], ['msg', 'Message', 'textarea', '']],
      ready: (v) => !!v.num,
      build: (v) => 'SMSTO:' + digitsOnly(v.num) + ':' + (v.msg || '')
    },
    whatsapp: {
      label: 'WhatsApp',
      fields: [['num', 'Number, with country code', 'text', ''], ['msg', 'Message', 'textarea', '']],
      ready: (v) => !!v.num,
      build: (v) => 'https://wa.me/' + digitsOnly(v.num).replace(/^\+/, '') +
        (v.msg ? '?' + queryString({ text: v.msg }) : '')
    },
    tel: {
      label: 'Phone call',
      fields: [['num', 'Number', 'text', '']],
      ready: (v) => !!v.num,
      build: (v) => 'tel:' + digitsOnly(v.num)
    },
    geo: {
      label: 'Map location',
      fields: [['lat', 'Latitude', 'text', '51.4543'], ['lon', 'Longitude', 'text', '-0.9781']],
      ready: (v) => v.lat !== '' && v.lon !== '',
      build: (v) => 'geo:' + String(v.lat).trim() + ',' + String(v.lon).trim()
    },
    event: {
      label: 'Calendar event',
      fields: [['title', 'Event name', 'text', ''], ['loc', 'Location', 'text', ''],
               ['start', 'Starts', 'datetime-local', ''], ['end', 'Ends', 'datetime-local', ''],
               ['desc', 'Description', 'textarea', '']],
      ready: (v) => !!(v.title && v.start),
      build: (v) => [
        'BEGIN:VEVENT',
        'SUMMARY:' + escCard(v.title),
        v.loc ? 'LOCATION:' + escCard(v.loc) : '',
        'DTSTART:' + icsStamp(v.start),
        v.end ? 'DTEND:' + icsStamp(v.end) : '',
        v.desc ? 'DESCRIPTION:' + escCard(v.desc) : '',
        'END:VEVENT'
      ].filter(Boolean).join('\n')
    },
    upi: {
      label: 'UPI payment (India)',
      fields: [['vpa', 'UPI ID (VPA)', 'text', ''], ['name', 'Payee name', 'text', ''],
               ['am', 'Amount, optional', 'text', ''], ['tn', 'Note, optional', 'text', '']],
      ready: (v) => /.+@.+/.test(String(v.vpa || '')),
      build: (v) => 'upi://pay?' + queryString({ pa: String(v.vpa).trim(), pn: v.name, am: v.am, cu: 'INR', tn: v.tn })
    },
    bitcoin: {
      label: 'Bitcoin payment',
      fields: [['addr', 'Address', 'text', ''], ['am', 'Amount in BTC, optional', 'text', ''],
               ['label', 'Label, optional', 'text', '']],
      ready: (v) => !!String(v.addr || '').trim(),
      build: (v) => {
        const q = queryString({ amount: v.am, label: v.label });
        return 'bitcoin:' + String(v.addr).trim() + (q ? '?' + q : '');
      }
    }
  };

  const SHAPE_LABELS = {
    square: 'Square', rounded: 'Rounded', fluid: 'Fluid', dots: 'Dots',
    classy: 'Classy', vertical: 'Vertical', horizontal: 'Horizontal',
    leaf: 'Leaf', petal: 'Petal'
  };

  const EC_LABELS = {
    L: 'Low - recovers 7%', M: 'Medium - recovers 15%',
    Q: 'Quartile - recovers 25%', H: 'High - recovers 30%'
  };

  /* Contrast, so the page can say why a pretty colour pair will not scan.
     Scanners look for a dark-on-light pattern; low contrast or an inverted
     code is the second most common reason a good matrix fails in the wild. */
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function luminance(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  function contrastOf(darkHex, lightHex) {
    const a = hexToRgb(darkHex), b = hexToRgb(lightHex);
    if (!a || !b) return null;
    const la = luminance(a), lb = luminance(b);
    return {
      ratio: (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05),
      inverted: la > lb
    };
  }

  /* ---------------- shared QR styling controls ---------------- */

  /* The look of a code — shape, colour, logo, error correction, size — is the
     same question whether you are making one code or four hundred, so both
     generators build these controls from here. A second copy would drift, and
     then the two tools would quietly disagree about what "medium logo, level
     H" means. */

  function qrPanel(host, title, open) {
    const d = el('details', 'qr-panel');
    d.open = !!open;
    d.appendChild(el('summary', null, title));
    const body = el('div', 'qr-panel-body');
    d.appendChild(body);
    host.appendChild(d);
    return body;
  }

  function selectControl(host, label, name, options, def) {
    const w = el('div', 'field');
    const id = 'qr-' + name;
    const l = el('label', null, label);
    l.setAttribute('for', id);
    const s = el('select', 'control');
    s.id = id;
    s.dataset.name = name;
    options.forEach(function (o) {
      const op = el('option', null, o[1]);
      op.value = o[0];
      if (o[0] === def) op.selected = true;
      s.appendChild(op);
    });
    w.appendChild(l);
    w.appendChild(s);
    host.appendChild(w);
    return s;
  }

  function colourControl(host, label, name, def) {
    const w = el('div', 'field');
    w.appendChild(el('label', null, label));
    const row = el('div', 'colour-field');
    const swatch = el('input');
    swatch.type = 'color';
    swatch.className = 'colour-swatch';
    swatch.value = def;
    swatch.dataset.name = name;
    const hex = el('input', 'control colour-hex');
    hex.type = 'text';
    hex.value = def;
    hex.spellcheck = false;
    hex.setAttribute('aria-label', label + ' hex value');
    swatch.addEventListener('input', function () { hex.value = swatch.value; });
    hex.addEventListener('input', function () {
      if (/^#[0-9a-f]{6}$/i.test(hex.value)) {
        swatch.value = hex.value;
        swatch.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    row.appendChild(swatch);
    row.appendChild(hex);
    w.appendChild(row);
    host.appendChild(w);
    return {
      read: function () { return swatch.value; },
      write: function (v) {
        if (!/^#[0-9a-f]{6}$/i.test(v)) return;
        swatch.value = v;
        hex.value = v;
      },
      wrap: w
    };
  }

  function checkControl(host, label, name, def) {
    const w = el('div', 'field field-check');
    const id = 'qr-' + name;
    const box = el('input');
    box.type = 'checkbox';
    box.id = id;
    box.checked = !!def;
    box.dataset.name = name;
    const l = el('label', null, label);
    l.setAttribute('for', id);
    w.appendChild(box);
    w.appendChild(l);
    host.appendChild(w);
    return box;
  }

  /* A shape picker whose swatches are real QR codes rendered in that shape,
     so the choice is visible rather than a word in a dropdown. */
  function shapePicker(host, label, name, names, def, render, onChange) {
    const w = el('div', 'field field-wide');
    w.appendChild(el('label', null, label));
    const grid = el('div', 'shape-grid');
    grid.setAttribute('role', 'radiogroup');
    grid.setAttribute('aria-label', label);
    let current = def;
    names.forEach(function (n) {
      const b = el('button', 'shape-btn');
      b.type = 'button';
      b.dataset.value = n;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', n === def ? 'true' : 'false');
      b.title = SHAPE_LABELS[n] || n;
      b.innerHTML = render(n);
      b.appendChild(el('span', 'shape-name', SHAPE_LABELS[n] || n));
      if (n === def) b.classList.add('is-active');
      b.addEventListener('click', function () {
        current = n;
        grid.querySelectorAll('.shape-btn').forEach(function (o) {
          o.classList.toggle('is-active', o === b);
          o.setAttribute('aria-checked', o === b ? 'true' : 'false');
        });
        onChange();
      });
      grid.appendChild(b);
    });
    w.appendChild(grid);
    host.appendChild(w);
    return {
      read: function () { return current; },
      set: function (v) {
        const b = grid.querySelector('.shape-btn[data-value="' + v + '"]');
        if (b) b.click();
      }
    };
  }

  /**
   * Panels 2 to 5 — shape, colours, logo, output — plus everything that reads
   * them back: the options object handed to the renderer, which controls to
   * hide, and the checks that need no rendering.
   */
  function qrStyleControls(config) {
    const QR = config.QR;
    const host = config.host;
    const schedule = config.schedule;
    const store = { logo: null, ecRaised: false };

    /* shape ---------------------------------------------------- */

    const shapeBody = qrPanel(host, '2. Shape', false);

    /* The swatches are real QR codes drawn in the style on offer, zoomed into
       one detail. Shown whole at this size every option looks the same, which
       is the failing of most style pickers. The viewBox is in module units,
       so cropping is just a different window onto the same path data. */
    const sample = QR.encode('1234Tools', 'M');
    const SAMPLE_QUIET = 1;

    /** The 6x6 window of data modules closest to half filled, for contrast. */
    const detail = (function () {
      let best = { r: 8, c: 8, score: Infinity };
      for (let r = 8; r <= sample.size - 14; r++) {
        for (let c = 8; c <= sample.size - 14; c++) {
          let dark = 0;
          for (let dr = 0; dr < 6; dr++) for (let dc = 0; dc < 6; dc++) dark += sample.matrix[r + dr][c + dc];
          const score = Math.abs(dark - 18);
          if (score < best.score) best = { r: r, c: c, score: score };
        }
      }
      return best;
    })();

    function crop(svg, x, y, w, h) {
      return svg.replace(/viewBox="[^"]*"/, 'viewBox="' + x + ' ' + y + ' ' + w + ' ' + h + '"')
                .replace(/width="\d+" height="\d+"/, 'width="48" height="48"');
    }

    const swatch = (opts) => QR.toSVG(sample, Object.assign({
      scale: 3, quiet: SAMPLE_QUIET, dark: 'currentColor', light: 'none'
    }, opts));

    const moduleSwatch = (n) =>
      crop(swatch({ shape: n }), detail.c + SAMPLE_QUIET, detail.r + SAMPLE_QUIET, 6, 6);
    const eyeSwatch = (opts) =>
      crop(swatch(opts), SAMPLE_QUIET - 0.5, SAMPLE_QUIET - 0.5, 8, 8);

    const shapePick = shapePicker(shapeBody, 'Module shape', 'shape',
      QR.shapes.module, 'square', moduleSwatch, schedule);
    const framePick = shapePicker(shapeBody, 'Eye frame', 'eyeFrame',
      QR.shapes.eyeFrame, 'square', (n) => eyeSwatch({ eyeFrame: n }), schedule);
    const ballPick = shapePicker(shapeBody, 'Eye centre', 'eyeBall',
      QR.shapes.eyeBall, 'square', (n) => eyeSwatch({ eyeBall: n }), schedule);

    /* colour --------------------------------------------------- */

    const colourBody = qrPanel(host, '3. Colours', false);
    const fillSel = selectControl(colourBody, 'Foreground', 'fill',
      [['solid', 'Solid colour'], ['linear', 'Linear gradient'], ['radial', 'Radial gradient']], 'solid');
    const darkIn = colourControl(colourBody, 'Foreground colour', 'dark', '#06080f');
    const dark2In = colourControl(colourBody, 'Gradient second colour', 'dark2', '#6c4bd8');
    const angleSel = selectControl(colourBody, 'Gradient angle', 'angle',
      [['45', '45 degrees'], ['0', 'Left to right'], ['90', 'Top to bottom'], ['135', '135 degrees']], '45');
    const lightIn = colourControl(colourBody, 'Background colour', 'light', '#ffffff');
    const transparentBox = checkControl(colourBody, 'Transparent background (SVG and PNG)', 'transparent', false);
    const eyeMatchBox = checkControl(colourBody, 'Eyes match the foreground', 'eyematch', true);
    const frameColIn = colourControl(colourBody, 'Eye frame colour', 'framecol', '#06080f');
    const ballColIn = colourControl(colourBody, 'Eye centre colour', 'ballcol', '#06080f');

    /* logo ----------------------------------------------------- */

    const logoBody = qrPanel(host, '4. Logo', false);
    const logoRow = el('div', 'field field-wide');
    logoRow.appendChild(el('label', null, 'Centre image'));
    const logoPick = el('div', 'logo-pick');
    const logoInput = el('input');
    logoInput.type = 'file';
    logoInput.accept = 'image/png,image/jpeg,image/svg+xml,image/webp,image/gif';
    logoInput.className = 'visually-hidden';
    logoInput.id = 'qr-logo';
    const logoLabel = el('label', 'btn-ghost logo-choose', 'Choose image');
    logoLabel.setAttribute('for', 'qr-logo');
    const logoName = el('span', 'logo-name', 'No image - the code stays plain');
    const logoClear = el('button', 'btn-ghost', 'Remove');
    logoClear.type = 'button';
    logoClear.hidden = true;
    logoPick.appendChild(logoLabel);
    logoPick.appendChild(logoClear);
    logoPick.appendChild(logoName);
    logoRow.appendChild(logoPick);
    logoBody.appendChild(logoRow);

    const logoSizeSel = selectControl(logoBody, 'Logo size', 'logosize',
      [['0.16', 'Small - 16%'], ['0.22', 'Medium - 22%'], ['0.28', 'Large - 28%']], '0.22');
    const logoPadSel = selectControl(logoBody, 'Clear space around it', 'logopad',
      [['1', '1 module'], ['0', 'None'], ['2', '2 modules']], '1');
    const logoBgBox = checkControl(logoBody, 'Knock out the code behind the logo', 'logobg', true);

    logoInput.addEventListener('change', function () {
      const f = logoInput.files && logoInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function () {
        store.logo = { href: String(reader.result), name: f.name };
        logoName.textContent = f.name;
        logoClear.hidden = false;
        /* A logo covers modules, so the code needs the error correction to
           spare. Medium plus a logo is the combination that fails, and it was
           the default, so move it up where the reader can see it happen and
           put it back if they want. */
        if (ecSel.value === 'L' || ecSel.value === 'M') {
          ecSel.value = 'H';
          store.ecRaised = true;
        }
        schedule();
      };
      reader.readAsDataURL(f);
    });
    logoClear.addEventListener('click', function () {
      store.logo = null;
      store.ecRaised = false;
      logoInput.value = '';
      logoName.textContent = 'No image - the code stays plain';
      logoClear.hidden = true;
      schedule();
    });
    logoBody.appendChild(logoInput);

    /* output --------------------------------------------------- */

    const outBody = qrPanel(host, '5. Output', false);
    const ecSel = selectControl(outBody, 'Error correction', 'ec',
      [['M', EC_LABELS.M], ['L', EC_LABELS.L], ['Q', EC_LABELS.Q], ['H', EC_LABELS.H]], 'M');
    const sizeSel = selectControl(outBody, 'PNG size', 'size',
      [['600', '600 px'], ['300', '300 px'], ['1200', '1200 px'], ['2400', '2400 px - print']], '600');
    const quietSel = selectControl(outBody, 'Quiet zone', 'quiet',
      [['4', '4 modules - standard'], ['2', '2 modules'], ['1', '1 module'], ['8', '8 modules']], '4');

    /* ---- reading the controls back ---- */

    function styleOptions(scale) {
      const solidDark = darkIn.read();
      const transparent = transparentBox.checked;
      const light = transparent ? 'none' : lightIn.read();
      const opts = {
        scale: scale,
        quiet: Number(quietSel.value),
        dark: solidDark,
        light: light,
        shape: shapePick.read(),
        eyeFrame: framePick.read(),
        eyeBall: ballPick.read()
      };
      if (fillSel.value !== 'solid') {
        opts.gradient = {
          type: fillSel.value === 'radial' ? 'radial' : 'linear',
          from: solidDark,
          to: dark2In.read(),
          angle: Number(angleSel.value)
        };
      }
      if (!eyeMatchBox.checked) {
        opts.eyeFrameColour = frameColIn.read();
        opts.eyeBallColour = ballColIn.read();
      }
      if (store.logo) {
        opts.logo = {
          href: store.logo.href,
          size: Number(logoSizeSel.value),
          padding: Number(logoPadSel.value),
          background: logoBgBox.checked ? (transparent ? '#ffffff' : lightIn.read()) : 'none'
        };
      }
      return opts;
    }

    /** Show or hide the controls that only apply to the current choices. */
    function syncVisibility() {
      const gradient = fillSel.value !== 'solid';
      dark2In.wrap.hidden = !gradient;
      angleSel.parentNode.hidden = fillSel.value !== 'linear';
      lightIn.wrap.hidden = transparentBox.checked;
      frameColIn.wrap.hidden = eyeMatchBox.checked;
      ballColIn.wrap.hidden = eyeMatchBox.checked;
      const hasLogo = !!store.logo;
      logoSizeSel.parentNode.hidden = !hasLogo;
      logoPadSel.parentNode.hidden = !hasLogo;
      logoBgBox.parentNode.hidden = !hasLogo;
    }

    /** Colour and quiet-zone checks, which need no rendering. */
    function staticNotes() {
      const notes = [];
      let ok = true;
      const bg = transparentBox.checked ? '#ffffff' : lightIn.read();
      const con = contrastOf(darkIn.read(), bg);
      if (con) {
        if (con.inverted) {
          ok = false;
          notes.push('The foreground is lighter than the background. Many scanners only read dark-on-light, so swap the two colours.');
        } else if (con.ratio < 3) {
          ok = false;
          notes.push('Contrast is only ' + con.ratio.toFixed(1) + ':1. Aim for 4.5:1 or more, or phones will struggle in poor light.');
        } else if (con.ratio < 4.5) {
          notes.push('Contrast is ' + con.ratio.toFixed(1) + ':1, which works on a screen but is tight for print. 7:1 is a safer target.');
        }
      }
      if (fillSel.value !== 'solid') {
        const con2 = contrastOf(dark2In.read(), bg);
        if (con2 && (con2.inverted || con2.ratio < 3)) {
          ok = false;
          notes.push('The second gradient colour has too little contrast against the background, so one end of the code will fade out.');
        }
      }
      if (transparentBox.checked) {
        notes.push('A transparent background inherits whatever sits behind it. Place it on a plain light area only.');
      }
      if (Number(quietSel.value) < 4) {
        notes.push('A quiet zone under 4 modules is outside the standard. Codes butted against artwork often fail.');
      }
      /* Decoration is not free. Every shape here was measured against a second
         decoder before it shipped, but a shape that is not a plain square
         still costs some of the margin a scanner works with, and that shows up
         first on a small print in poor light. */
      if (shapePick.read() !== 'square' || framePick.read() !== 'square' || ballPick.read() !== 'square') {
        notes.push('Shaped modules and eyes cost a little of the margin a scanner has to work with. This one reads, but print it a size up and test the print itself.');
      }
      return { ok: ok, notes: notes };
    }

    return {
      store: store,
      shapePick: shapePick, framePick: framePick, ballPick: ballPick,
      fillSel: fillSel, angleSel: angleSel,
      darkIn: darkIn, dark2In: dark2In, lightIn: lightIn,
      transparentBox: transparentBox, eyeMatchBox: eyeMatchBox,
      frameColIn: frameColIn, ballColIn: ballColIn,
      logoSizeSel: logoSizeSel, logoPadSel: logoPadSel, logoBgBox: logoBgBox,
      ecSel: ecSel, sizeSel: sizeSel, quietSel: quietSel,
      styleOptions: styleOptions, syncVisibility: syncVisibility, staticNotes: staticNotes
    };
  }

  /**
   * Read a finished picture back.
   *
   * Checking the matrix only proves the encoder did its job. It says nothing
   * about the image that actually gets downloaded, where a logo sits on top of
   * real modules and can cover an alignment pattern the scanner needs to find
   * the grid at all. So the artwork is rasterised and put through the same
   * detector the scanner tool uses — twice, once at a comfortable size and
   * once small and rough, which is the difference between "it reads" and "it
   * reads on a business card in bad light".
   */
  function qrReadBack(svg, text, modules) {
    return new Promise(function (resolve) {
      if (!window.QRDetect) { resolve(null); return; }
      const img = new Image();
      img.onload = function () {
        const at = function (pxPerModule) {
          const px = Math.round(modules * pxPerModule);
          const c = document.createElement('canvas');
          c.width = c.height = px;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.fillStyle = '#ffffff';          // whatever is behind a transparent code
          ctx.fillRect(0, 0, px, px);
          ctx.drawImage(img, 0, 0, px, px);
          const got = window.QRDetect.scan(ctx.getImageData(0, 0, px, px));
          return !!(got && got.text === text);
        };
        const clean = at(10);
        resolve({ clean: clean, rough: clean ? at(4) : false });
      };
      img.onerror = function () { resolve(null); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  function mountQR(spec, root, api) {
    /* The page used to pass (encodeQR, qrToSVG) as two functions. Accept that
       shape as well, so a cached copy of the old page still works. */
    const QR = (api && api.encode) ? api : window.QR;
    const io = root.querySelector('.tool-io');

    /* ---- controls ---- */

    const layout = el('div', 'qr-layout');
    const controls = el('div', 'qr-controls');
    const stage = el('div', 'qr-stage');
    layout.appendChild(controls);
    layout.appendChild(stage);
    io.appendChild(layout);

    /* content -------------------------------------------------- */

    const contentBody = qrPanel(controls, '1. Content', true);
    const typeSel = selectControl(contentBody, 'Content type', 'type',
      Object.keys(QR_TYPES).map((k) => [k, QR_TYPES[k].label]), 'url');
    const fieldHost = el('div', 'gen-form gen-form-flush');
    contentBody.appendChild(fieldHost);

    let readers = [];
    function buildFields() {
      fieldHost.textContent = '';
      const type = QR_TYPES[typeSel.value];
      readers = type.fields.map(function (f) {
        const s = { key: f[0], label: f[1], type: f[2], default: f[3] };
        if (f[2] === 'select') {
          s.options = (type.options[f[0]] || []).map((o) => ({ value: o[0], label: o[1] }));
        }
        const b = buildField(s);
        fieldHost.appendChild(b.wrap);
        return b;
      });
    }

    function values() {
      const v = {};
      readers.forEach(function (r) { v[r.key] = r.read(); });
      return v;
    }

    /* shape, colour, logo, output ------------------------------ */

    const style = qrStyleControls({ QR: QR, host: controls, schedule: function () { schedule(); } });
    const shapePick = style.shapePick, framePick = style.framePick, ballPick = style.ballPick;
    const fillSel = style.fillSel, angleSel = style.angleSel;
    const darkIn = style.darkIn, dark2In = style.dark2In, lightIn = style.lightIn;
    const transparentBox = style.transparentBox, eyeMatchBox = style.eyeMatchBox;
    const frameColIn = style.frameColIn, ballColIn = style.ballColIn;
    const logoSizeSel = style.logoSizeSel, logoPadSel = style.logoPadSel;
    const ecSel = style.ecSel, sizeSel = style.sizeSel, quietSel = style.quietSel;
    const styleOptions = style.styleOptions;

    /* ---- stage ---- */

    const qrBox = el('div', 'qr-box');
    /* Only shown on a shared link. Someone who is sent a code should be able to
       read what it points at before pointing a camera at it — the same reason
       the scanner names the domain instead of just opening it. */
    const sharedContent = el('p', 'shared-content');
    const verdict = el('div', 'qr-verdict');
    const msg = el('div', 'io-msg');
    const acts = el('div', 'io-actions qr-actions');
    const stats = el('div', 'stat-grid');
    stage.appendChild(qrBox);
    stage.appendChild(sharedContent);
    stage.appendChild(verdict);
    stage.appendChild(msg);
    stage.appendChild(acts);
    stage.appendChild(stats);

    let currentSVG = '', currentText = '';
    let verifySeq = 0;

    /* ---- sharing a code as a link ---- */

    /**
     * A code lives in its own URL.
     *
     * Content fields keep their own names, so a link can be written by hand:
     * ?t=url&url=https://example.com. The look travels in one `style`
     * parameter instead of a dozen more, which keeps the two namespaces apart
     * — `body` is a field on the email type and would otherwise collide with
     * anything named for the body of the code.
     */
    const STYLE_KEYS = [
      ['ec', () => ecSel.value, (v) => { ecSel.value = v; }],
      ['px', () => sizeSel.value, (v) => { sizeSel.value = v; }],
      ['quiet', () => quietSel.value, (v) => { quietSel.value = v; }],
      ['shape', () => shapePick.read(), (v) => shapePick.set(v)],
      ['eye', () => framePick.read(), (v) => framePick.set(v)],
      ['ball', () => ballPick.read(), (v) => ballPick.set(v)],
      ['fill', () => fillSel.value, (v) => { fillSel.value = v; }],
      ['angle', () => angleSel.value, (v) => { angleSel.value = v; }],
      ['fg', () => darkIn.read().replace('#', ''), (v) => darkIn.write('#' + v)],
      ['fg2', () => dark2In.read().replace('#', ''), (v) => dark2In.write('#' + v)],
      ['bg', () => transparentBox.checked ? 'none' : lightIn.read().replace('#', ''),
        (v) => {
          transparentBox.checked = (v === 'none');
          if (v !== 'none') lightIn.write('#' + v);
        }],
      ['eyefg', () => eyeMatchBox.checked ? '' : frameColIn.read().replace('#', ''),
        (v) => { eyeMatchBox.checked = false; frameColIn.write('#' + v); }],
      ['eyebg', () => eyeMatchBox.checked ? '' : ballColIn.read().replace('#', ''),
        (v) => { eyeMatchBox.checked = false; ballColIn.write('#' + v); }]
    ];

    /* Snapshotted before any link is read, so "default" means what the page
       opens with rather than a list repeated in two places. */
    let styleDefaults = null;
    function captureDefaults() {
      styleDefaults = {};
      STYLE_KEYS.forEach(function (k) { styleDefaults[k[0]] = k[1](); });
    }

    /**
     * The link for a finished code.
     *
     * Only settings that differ from the default travel, so an ordinary black
     * code is a short link rather than a screenful of ec:M,px:600,quiet:4 and
     * so on that all say "unchanged". And it opens showing the code, because
     * someone sending a QR code is sending the code, not an editing session —
     * the controls are one tap away for anyone who wants them.
     */
    function shareLink() {
      const q = new URLSearchParams();
      q.set('t', typeSel.value);
      readers.forEach(function (r) {
        const v = r.read();
        if (v !== '' && v != null) q.set(r.key, v);
      });
      const styleParam = STYLE_KEYS
        .filter(function (k) {
          const v = k[1]();
          return v && (!styleDefaults || v !== styleDefaults[k[0]]);
        })
        .map(function (k) { return k[0] + ':' + k[1](); })
        .join(',');
      if (styleParam) q.set('style', styleParam);
      q.set('v', '1');
      return location.origin + location.pathname + '?' + q.toString();
    }

    /** Put a shared link back into the controls. Unknown values are ignored. */
    function applyShare(params) {
      const t = params.get('t');
      if (!t || !QR_TYPES[t]) return false;
      typeSel.value = t;
      buildFields();
      readers.forEach(function (r) {
        const v = params.get(r.key);
        if (v !== null) r.write(v);
      });

      const styleParam = params.get('style') || '';
      const seen = {};
      styleParam.split(',').forEach(function (pair) {
        const i = pair.indexOf(':');
        if (i > 0) seen[pair.slice(0, i)] = pair.slice(i + 1);
      });
      STYLE_KEYS.forEach(function (k) {
        if (seen[k[0]] !== undefined && seen[k[0]] !== '') {
          try { k[2](seen[k[0]]); } catch (e) { /* a bad value just keeps the default */ }
        }
      });
      return true;
    }

    /**
     * `view=code` strips the page back to the code itself, for someone opening
     * a link that was shared with them rather than building one. The controls
     * are still there, one tap away, because a shared code is usually the
     * start of making your own.
     */
    function applyViewMode() {
      const params = new URLSearchParams(location.search);
      // `v=1` is what links carry now; `view=code` was the first spelling and
      // still works, because links already sent to people have to keep working.
      if (params.get('v') !== '1' && params.get('view') !== 'code') return;
      // on the document, not the article: the breadcrumbs and the page heading
      // sit outside the tool and have to go too, or the code lands below the
      // fold on the phone it was sent to
      document.documentElement.classList.add('is-shared-view');

      const open = el('button', 'btn-ghost shared-edit', 'Edit this code');
      open.type = 'button';
      open.addEventListener('click', function () {
        document.documentElement.classList.remove('is-shared-view');
        open.remove();
      });
      stage.parentNode.insertBefore(open, stage.nextSibling);
    }

    /**
     * When a logo stops the code reading, say which single change fixes it
     * rather than leaving someone to guess. The candidates are tried in the
     * order that costs the least: error correction first, since it changes
     * nothing about how the code looks.
     */
    async function findFix(data, opts) {
      const ec = ecSel.value;
      const candidates = [];
      if (ec !== 'H') candidates.push({ label: 'raising error correction to High', apply: { ec: 'H' } });
      if (Number(logoPadSel.value) > 0) candidates.push({ label: 'removing the clear space around the logo', apply: { logopad: '0' } });
      if (Number(logoSizeSel.value) > 0.16) candidates.push({ label: 'making the logo smaller', apply: { logosize: '0.16' } });
      if (ec !== 'H' && Number(logoSizeSel.value) > 0.16) {
        candidates.push({ label: 'level High and a smaller logo', apply: { ec: 'H', logosize: '0.16' } });
      }

      for (const c of candidates) {
        const trialEc = c.apply.ec || ec;
        let qr;
        try { qr = QR.encode(data, trialEc); } catch (e) { continue; }
        const trialOpts = styleOptions(8);
        if (c.apply.logopad !== undefined) trialOpts.logo.padding = Number(c.apply.logopad);
        if (c.apply.logosize !== undefined) trialOpts.logo.size = Number(c.apply.logosize);
        const svg = QR.toSVG(qr, trialOpts);
        const got = await qrReadBack(svg, data, qr.size + trialOpts.quiet * 2);
        if (got && got.clean) return c;
      }
      return null;
    }

    function paintVerdict(kind, headline, notes, fix) {
      verdict.textContent = '';
      verdict.className = 'qr-verdict is-' + kind;
      verdict.appendChild(el('p', 'qr-verdict-head', headline));
      if (notes && notes.length) {
        const ul = el('ul', 'qr-verdict-notes');
        notes.forEach(function (n) { ul.appendChild(el('li', null, n)); });
        verdict.appendChild(ul);
      }
      if (fix) {
        const b = el('button', 'btn-primary qr-fix', 'Fix it: ' + fix.label);
        b.type = 'button';
        b.addEventListener('click', function () {
          if (fix.apply.ec) ecSel.value = fix.apply.ec;
          if (fix.apply.logopad !== undefined) logoPadSel.value = fix.apply.logopad;
          if (fix.apply.logosize !== undefined) logoSizeSel.value = fix.apply.logosize;
          render();
        });
        verdict.appendChild(b);
      }
    }

    function render() {
      style.syncVisibility();

      const type = QR_TYPES[typeSel.value];
      const v = values();
      qrBox.textContent = '';
      acts.textContent = '';
      verdict.textContent = '';
      verdict.className = 'qr-verdict';
      msg.textContent = '';
      msg.className = 'io-msg';

      if (!type.ready(v)) {
        msg.textContent = 'Fill in the fields above and your QR code will appear here.';
        msg.className = 'io-msg is-note';
        renderStats(stats, null);
        return;
      }

      const data = type.build(v);
      const ec = ecSel.value;

      let qr;
      try { qr = QR.encode(data, ec); }
      catch (e) {
        msg.textContent = e.message;
        msg.className = 'io-msg is-error';
        renderStats(stats, null);
        return;
      }

      currentText = data;
      sharedContent.textContent = data;
      const opts = styleOptions(Math.max(2, Math.round(Number(sizeSel.value) / (qr.size + Number(quietSel.value) * 2))));
      currentSVG = QR.toSVG(qr, opts);
      qrBox.innerHTML = currentSVG;

      /* Read the finished artwork back before letting anyone download it.
         This runs on every change, so the badge under the preview is a
         statement about the image on screen, not about the matrix behind it. */
      const stamp = ++verifySeq;
      const basic = style.staticNotes();
      paintVerdict('check', 'Reading the code back…', basic.notes);

      qrReadBack(currentSVG, data, qr.size + opts.quiet * 2).then(async function (got) {
        if (stamp !== verifySeq) return;                 // a newer render won

        if (!got) {
          paintVerdict(basic.ok ? 'pass' : 'warn',
            'Encoded and checked against the standard', basic.notes);
          return;
        }

        if (!got.clean) {
          const notes = [
            style.store.logo
              ? 'The logo is covering more of the code than its error correction can repair. ' +
                'On a small code the middle also holds an alignment pattern, which a scanner needs to find the grid at all.'
              : 'The rendered image did not decode. The colours or shapes are getting in the way.'
          ].concat(basic.notes);
          paintVerdict('fail', 'This will not scan — do not use it yet', notes);
          const fix = await findFix(data, opts);
          if (stamp === verifySeq && fix) {
            paintVerdict('fail', 'This will not scan — do not use it yet', notes, fix);
          }
          return;
        }

        const notes = basic.notes.slice();
        if (style.store.ecRaised) {
          notes.push('Error correction was raised to High when you added the logo, so there is room to repair what it covers. Lower it above if you would rather have a less dense code.');
        }
        if (!got.rough) {
          notes.unshift('It reads at a comfortable size but not when small or low quality, so print it large and keep it sharp.');
        }
        paintVerdict(basic.ok ? 'pass' : 'warn',
          got.rough
            ? 'Verified: this exact image was scanned and read back correctly'
            : 'Scanned and read back correctly, with little margin to spare',
          notes);
      });

      const pngSize = Number(sizeSel.value);
      acts.appendChild(downloadButton('Download SVG', 'qr-code.svg', function () {
        return new Blob([QR.toSVG(qr, styleOptions(8))], { type: 'image/svg+xml' });
      }));
      acts.appendChild(downloadButton('Download PNG', 'qr-code.png', function () {
        return svgToPngBlob(currentSVG, pngSize);
      }));
      acts.appendChild(copyButton(function () { return currentText; }, 'Copy content'));
      acts.appendChild(copyButton(shareLink, 'Copy share link'));

      const modes = qr.segments.map(function (s) {
        return ({ numeric: 'numeric', alnum: 'alphanumeric', byte: 'byte' })[s.mode] + ' x' + s.length;
      }).join(', ');
      const mmPerModule = 0.5;
      const printMm = Math.ceil((qr.size + Number(quietSel.value) * 2) * mmPerModule);

      document.dispatchEvent(new CustomEvent('mvr:tool-used'));

      renderStats(stats, [
        ['Version', qr.version + ' (' + qr.size + ' x ' + qr.size + ' modules)'],
        ['Error correction', EC_LABELS[qr.ecLevel]],
        ['Mask pattern', String(qr.mask)],
        ['Encoding', modes],
        ['Content length', data.length + ' characters'],
        ['PNG export', pngSize + ' x ' + pngSize + ' px'],
        ['Smallest safe print', printMm + ' mm wide']
      ]);
    }

    /* Re-render on the next frame so a fast typist does not queue up work. */
    let pending = 0;
    function schedule() {
      if (pending) return;
      pending = requestAnimationFrame(function () { pending = 0; render(); });
    }

    typeSel.addEventListener('change', function () { buildFields(); schedule(); });
    fieldHost.addEventListener('input', schedule);
    fieldHost.addEventListener('change', schedule);
    controls.addEventListener('input', schedule);
    controls.addEventListener('change', schedule);

    buildFields();
    captureDefaults();
    /* A link like ?t=wifi&ssid=Cafe&style=ec:H rebuilds the code on arrival,
       so a code can be sent as a URL rather than as a picture — and the person
       who receives it can see what it contains before trusting it. */
    try { applyShare(new URLSearchParams(location.search)); } catch (e) { /* a malformed link just shows the default */ }
    applyViewMode();
    render();
  }

  /* ---------------- QR in bulk ---------------- */

  /* Above this the tab stops being a web page and starts being a batch job:
     five hundred codes is already a wall of artwork, and every one of them is
     rasterised and read back before it is offered for download. */
  const BULK_LIMIT = 500;
  const BULK_PREVIEW = 60;

  /* Column headers that name the file rather than feed the code. */
  const NAME_KEYS = ['name', 'label', 'filename', 'file name', 'file', 'id', 'ref'];

  /**
   * A pasted batch, as rows of cells.
   *
   * The separator is worked out from the text rather than asked for. People
   * paste out of a spreadsheet (tabs), out of a CSV (commas) and out of a
   * European CSV (semicolons), and "which delimiter is your file?" is a
   * question a tool should answer for itself.
   */
  function parseDelimited(text) {
    const s = String(text || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    if (!s.trim()) return { rows: [], delim: ',' };

    const sample = s.split('\n').slice(0, 20).join('\n');
    const counts = { '\t': 0, ',': 0, ';': 0 };
    let quoted = false;
    for (let i = 0; i < sample.length; i++) {
      const c = sample[i];
      if (c === '"') quoted = !quoted;
      else if (!quoted && counts[c] !== undefined) counts[c]++;
    }
    let delim = ',';
    if (counts['\t'] > 0 && counts['\t'] >= counts[','] && counts['\t'] >= counts[';']) delim = '\t';
    else if (counts[';'] > counts[',']) delim = ';';

    const rows = [];
    let row = [], field = '', inQ = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inQ) {
        if (c === '"') {
          if (s[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += c;
      } else if (c === '"' && field === '') inQ = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
    row.push(field);
    rows.push(row);

    return {
      delim: delim,
      rows: rows
        .map(function (r) { return r.map(function (c) { return c.trim(); }); })
        .filter(function (r) { return r.some(function (c) { return c !== ''; }); })
    };
  }

  const tidyHead = (s) => String(s).toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').replace(/[_-]+/g, ' ').trim();

  /**
   * Which column feeds which field.
   *
   * A header row is used when its cells name the fields; otherwise columns are
   * taken in the order the content type lists them. Guessing this silently is
   * the classic bulk-generator failure — four hundred contact cards with the
   * phone number in the name field — so whatever was matched is spelled out on
   * the page rather than left to be discovered after printing.
   */
  function mapColumns(rows, type) {
    const keys = type.fields.map(function (f) { return f[0]; });
    const labels = type.fields.map(function (f) { return tidyHead(f[1]); });
    const head = rows[0] || [];

    let matched = 0;
    const map = head.map(function (cell) {
      const c = tidyHead(cell);
      let i = keys.indexOf(c);
      if (i < 0) i = labels.indexOf(c);
      if (i >= 0) { matched++; return { field: keys[i] }; }
      if (NAME_KEYS.indexOf(c) >= 0) { matched++; return { name: true }; }
      return null;
    });

    /* A header needs at least two cells. A one-column list has nothing to
       map, so treating its first line as a header buys nothing and risks
       silently eating somebody's first value. */
    if (head.length > 1 && matched >= Math.ceil(head.length / 2)) {
      return { header: head, map: map, body: rows.slice(1) };
    }
    return {
      header: null,
      map: keys.map(function (k) { return { field: k }; }),
      body: rows
    };
  }

  function rowValues(cells, map, keys) {
    const v = {};
    keys.forEach(function (k) { v[k] = ''; });
    let name = '';
    map.forEach(function (m, i) {
      if (!m) return;
      const cell = cells[i] === undefined ? '' : cells[i];
      if (m.name) name = cell;
      else v[m.field] = cell;
    });
    return { values: v, name: name };
  }

  /**
   * What to call a code when the list did not say.
   *
   * The whole payload is the wrong answer for anything structured: it made the
   * WiFi file names carry the password, and turned a contact card into
   * begin-vcard-version-3-0-n-nair-priya. Name it after the field a person
   * would call it by. Types not listed here have one field, so the content
   * itself is already the sensible name.
   */
  const BULK_NAME = {
    wifi: (v) => v.ssid,
    vcard: (v) => [v.first, v.last].filter(Boolean).join(' ') || v.org || v.email,
    mecard: (v) => v.name || v.phone || v.email,
    email: (v) => v.to,
    sms: (v) => v.num,
    whatsapp: (v) => v.num,
    geo: (v) => v.lat + ' ' + v.lon,
    event: (v) => [v.title, v.start].filter(Boolean).join(' '),
    upi: (v) => [v.vpa, v.tn].filter(Boolean).join(' '),
    bitcoin: (v) => v.label || v.addr
  };

  /** A file name that survives a ZIP, a Windows share and an email client. */
  function slugName(s, fallback) {
    const t = String(s || '')
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')      // drop the scheme from a URL
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '');
    return t || fallback;
  }

  function uniqueNames(list) {
    const seen = Object.create(null);
    return list.map(function (n) {
      if (!seen[n]) { seen[n] = 1; return n; }
      seen[n]++;
      return n + '-' + seen[n];
    });
  }

  const csvCell = (s) => /[",\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s);

  /* A worked example per content type: the header line the parser expects and
     a couple of rows in it. Far quicker to read than a paragraph explaining
     that columns come in field order unless there is a header. */
  const BULK_EXAMPLES = {
    url: 'https://www.1234tools.com/\nhttps://www.1234tools.com/qr/\nhttps://www.mvritservices.com/',
    text: 'Bay A-01\nBay A-02\nBay A-03',
    wifi: 'ssid,pass,enc,name\nRio Cafe Guest,flatwhite22,WPA,rio-guest\nRio Cafe Staff,backofhouse9,WPA,rio-staff',
    vcard: 'first,last,org,phone,email,name\nPriya,Nair,MVR IT Services,+441189000111,priya@example.com,priya-nair\nSam,Okafor,MVR IT Services,+441189000112,sam@example.com,sam-okafor',
    mecard: 'name,phone,email\nPriya Nair,+441189000111,priya@example.com\nSam Okafor,+441189000112,sam@example.com',
    email: 'to,subj\nsales@example.com,Price list\nsupport@example.com,Warranty claim',
    sms: 'num,msg\n+441189000111,Table 4 needs service\n+441189000112,Table 5 needs service',
    whatsapp: 'num,msg\n447700900111,Hello from stand 12\n447700900112,Hello from stand 13',
    tel: '+441189000111\n+441189000112\n+441189000113',
    geo: 'lat,lon,name\n51.4543,-0.9781,reading\n51.5074,-0.1278,london',
    event: 'title,loc,start,name\nSite induction,Gate 2,2026-10-01T09:00,induction-morning\nSite induction,Gate 2,2026-10-01T14:00,induction-afternoon',
    upi: 'vpa,name,am,tn\nshop@okbank,Rio Cafe,120,Table 1\nshop@okbank,Rio Cafe,250,Table 2',
    bitcoin: 'addr,label\nbc1qexampleaddress000000000000000000000000,Donation A\nbc1qexampleaddress111111111111111111111111,Donation B'
  };

  function mountQRBulk(spec, root, api) {
    const QR = (api && api.encode) ? api : window.QR;
    const io = root.querySelector('.tool-io');

    const layout = el('div', 'qr-layout qr-bulk');
    const controls = el('div', 'qr-controls');
    const stage = el('div', 'qr-stage');
    layout.appendChild(controls);
    layout.appendChild(stage);
    io.appendChild(layout);

    /* 1. the batch --------------------------------------------- */

    const listBody = qrPanel(controls, '1. Values', true);
    const typeSel = selectControl(listBody, 'Content type', 'type',
      Object.keys(QR_TYPES).map((k) => [k, QR_TYPES[k].label]), 'url');

    const listWrap = el('div', 'field field-wide');
    const listLabel = el('label', null, 'Your list');
    listLabel.setAttribute('for', 'qr-values');
    const area = el('textarea', 'control bulk-input');
    area.id = 'qr-values';
    area.rows = 9;
    area.spellcheck = false;
    listWrap.appendChild(listLabel);
    listWrap.appendChild(area);
    const hint = el('p', 'bulk-hint');
    listWrap.appendChild(hint);
    listBody.appendChild(listWrap);

    const listActs = el('div', 'io-actions field-wide bulk-source');
    const genBtn = el('button', 'btn-primary', 'Generate codes');
    genBtn.type = 'button';
    const exampleBtn = el('button', 'btn-ghost', 'Fill an example');
    exampleBtn.type = 'button';
    const fileIn = el('input', 'visually-hidden');
    fileIn.type = 'file';
    fileIn.id = 'qr-batch-file';
    fileIn.accept = '.csv,.tsv,.txt,text/plain,text/csv,text/tab-separated-values';
    const fileLabel = el('label', 'btn-ghost', 'Load a file');
    fileLabel.setAttribute('for', 'qr-batch-file');
    const clearBtn = el('button', 'btn-ghost', 'Clear');
    clearBtn.type = 'button';
    listActs.appendChild(genBtn);
    listActs.appendChild(exampleBtn);
    listActs.appendChild(fileLabel);
    listActs.appendChild(fileIn);
    listActs.appendChild(clearBtn);
    listBody.appendChild(listActs);

    /* 2-5. the look -------------------------------------------- */

    const style = qrStyleControls({
      QR: QR, host: controls, schedule: function () { scheduleRestyle(); }
    });

    /* ---- stage ---- */

    const summary = el('div', 'bulk-summary');
    const verdict = el('div', 'qr-verdict');
    const msg = el('div', 'io-msg');
    const mapNote = el('p', 'bulk-map');
    const acts = el('div', 'io-actions qr-actions');
    const grid = el('div', 'bulk-grid');
    const gridNote = el('p', 'bulk-map');
    const skipWrap = el('div', 'bulk-skipped-wrap');
    const stats = el('div', 'stat-grid');
    stage.appendChild(summary);
    stage.appendChild(verdict);
    stage.appendChild(msg);
    stage.appendChild(mapNote);
    stage.appendChild(acts);
    stage.appendChild(grid);
    stage.appendChild(gridNote);
    stage.appendChild(skipWrap);
    stage.appendChild(stats);

    let batch = [];            // every usable code in the current run
    let skipped = [];          // rows that could not become a code, and why
    let runSeq = 0;            // cancels a verification pass a newer run replaced
    let generated = '';        // the list text the current batch was built from

    function note(text, kind) {
      msg.textContent = text || '';
      msg.className = 'io-msg' + (kind ? ' is-' + kind : '');
    }

    let lastCount = '';
    function setSummary(text, busy) {
      if (!busy) lastCount = text || '';
      summary.textContent = '';
      summary.classList.toggle('is-busy', !!busy);
      if (!text) return;
      summary.appendChild(el('span', 'bulk-count', text));
    }

    /* ---- reading the list ---- */

    /**
     * The list, as rows mapped onto the chosen type's fields.
     *
     * A single-field type with no header is read a line at a time rather than
     * split on commas: "one per line" has to mean the whole line, or every URL
     * with a query string in it loses half of itself.
     */
    function readBatch(type) {
      const parsed = parseDelimited(area.value);
      let plan = mapColumns(parsed.rows, type);
      if (!plan.header && type.fields.length === 1) {
        plan = {
          header: null,
          map: [{ field: type.fields[0][0] }],
          body: String(area.value).replace(/\r\n?/g, '\n').split('\n')
            .map(function (l) { return [l.trim()]; })
            .filter(function (r) { return r[0] !== ''; })
        };
      }
      plan.delim = parsed.delim;
      return plan;
    }

    function describeMapping(plan, type) {
      if (!plan.body.length) return '';
      const labelFor = function (key) {
        const f = type.fields.filter(function (x) { return x[0] === key; })[0];
        return f ? f[1] : key;
      };
      if (plan.header) {
        const named = plan.map.map(function (m, i) {
          const h = plan.header[i];
          if (!m) return h + ' → ignored';
          return h + ' → ' + (m.name ? 'file name' : labelFor(m.field));
        });
        return 'Header row read: ' + named.join(', ') + '.';
      }
      if (type.fields.length === 1) return 'Each line is one ' + labelFor(type.fields[0][0]).toLowerCase() + '.';
      return 'No header row, so columns are taken in order: ' +
        plan.map.map(function (m) { return labelFor(m.field); }).join(', ') +
        '. Add a header line to name them instead.';
    }

    /* ---- building the batch ---- */

    function build() {
      style.syncVisibility();
      const type = QR_TYPES[typeSel.value];
      const plan = readBatch(type);
      const ec = style.ecSel.value;
      const opts = style.styleOptions(8);

      generated = area.value;
      genBtn.classList.remove('is-stale');
      batch = [];
      skipped = [];
      verdict.textContent = '';
      verdict.className = 'qr-verdict';

      if (!plan.body.length) {
        grid.textContent = '';
        gridNote.textContent = '';
        skipWrap.textContent = '';
        acts.textContent = '';
        mapNote.textContent = '';
        setSummary('');
        renderStats(stats, null);
        note('Paste or type your values above, one code per line, then press Generate codes.', 'note');
        return;
      }

      const rows = plan.body.slice(0, BULK_LIMIT);
      const over = plan.body.length - rows.length;

      rows.forEach(function (cells, i) {
        const got = rowValues(cells, plan.map, type.fields.map(function (f) { return f[0]; }));
        const line = cells.join(' ').trim();
        if (!type.ready(got.values)) {
          skipped.push({ line: i + 1, text: line, why: 'not enough to make a code' });
          return;
        }
        const content = type.build(got.values);
        let qr;
        try { qr = QR.encode(content, ec); }
        catch (e) {
          skipped.push({ line: i + 1, text: line, why: e.message });
          return;
        }
        const fromFields = BULK_NAME[typeSel.value] ? BULK_NAME[typeSel.value](got.values) : content;
        batch.push({
          name: slugName(got.name || fromFields, 'qr-' + String(i + 1).padStart(3, '0')),
          content: content,
          qr: qr,
          svg: QR.toSVG(qr, opts),
          modules: qr.size + opts.quiet * 2,
          status: 'checking',
          node: null
        });
      });

      const names = uniqueNames(batch.map(function (b) { return b.name; }));
      batch.forEach(function (b, i) { b.name = names[i]; });

      mapNote.textContent = describeMapping(plan, type);
      note(over > 0
        ? 'Only the first ' + BULK_LIMIT + ' rows were used — ' + over + ' more were left out. Split the list and run it twice.'
        : '', over > 0 ? 'warn' : '');

      paintGrid();
      paintActions();
      paintStats();
      document.dispatchEvent(new CustomEvent('mvr:tool-used'));

      /* Every row rejected is a real outcome, not an empty page. It almost
         always means the columns were read differently from how they were
         meant, so say which reading was used and point at the reasons. */
      if (!batch.length) {
        setSummary('No codes made', false);
        verdict.className = 'qr-verdict is-fail';
        verdict.appendChild(el('p', 'qr-verdict-head',
          'None of those ' + plan.body.length + ' rows could be turned into a code'));
        const why = el('ul', 'qr-verdict-notes');
        why.appendChild(el('li', null, describeMapping(plan, type) +
          ' Check that against the columns you actually pasted.'));
        why.appendChild(el('li', null,
          'Every rejected row is listed below with the reason it was rejected.'));
        verdict.appendChild(why);
        runSeq++;
        return;
      }

      setSummary('0 of ' + batch.length + ' checked', true);
      const stamp = ++runSeq;
      verifyAll(stamp);
    }

    /* ---- the preview grid ---- */

    function statusLabel(s) {
      return ({
        checking: 'Checking…', ok: 'Verified', tight: 'Tight', fail: 'Will not scan'
      })[s] || s;
    }

    function card(item) {
      const c = el('div', 'bulk-card is-' + item.status);
      const art = el('div', 'bulk-art');
      art.innerHTML = item.svg;
      c.appendChild(art);
      const body = el('div', 'bulk-card-body');
      body.appendChild(el('strong', 'bulk-name', item.name));
      body.appendChild(el('span', 'bulk-content', item.content.length > 70 ? item.content.slice(0, 70) + '…' : item.content));
      const badge = el('span', 'bulk-status', statusLabel(item.status));
      body.appendChild(badge);
      const row = el('div', 'bulk-card-acts');
      row.appendChild(downloadButton('SVG', function () { return item.name + '.svg'; }, function () {
        return new Blob([item.svg], { type: 'image/svg+xml' });
      }));
      row.appendChild(downloadButton('PNG', function () { return item.name + '.png'; }, function () {
        return svgToPngBlob(item.svg, Number(style.sizeSel.value));
      }));
      body.appendChild(row);
      c.appendChild(body);
      item.node = c;
      item.badge = badge;
      return c;
    }

    function paintGrid() {
      grid.textContent = '';
      const shown = batch.slice(0, BULK_PREVIEW);
      shown.forEach(function (item) { grid.appendChild(card(item)); });
      batch.slice(BULK_PREVIEW).forEach(function (item) { item.node = null; item.badge = null; });
      gridNote.textContent = batch.length > BULK_PREVIEW
        ? 'Showing the first ' + BULK_PREVIEW + ' of ' + batch.length + ' codes. Every one of them is checked, and every one is in the download.'
        : '';
      skipWrap.textContent = '';
      if (skipped.length) {
        const s = el('details', 'bulk-skipped');
        s.appendChild(el('summary', null, skipped.length + ' row' + (skipped.length === 1 ? '' : 's') + ' could not be used'));
        const ul = el('ul');
        skipped.slice(0, 40).forEach(function (k) {
          ul.appendChild(el('li', null, 'Line ' + k.line + ': ' + (k.text || '(empty)') + ' — ' + k.why));
        });
        s.appendChild(ul);
        skipWrap.appendChild(s);
      }
    }

    function markStatus(item, status) {
      item.status = status;
      if (!item.node) return;
      item.node.className = 'bulk-card is-' + status;
      item.badge.textContent = statusLabel(status);
    }

    /* ---- checking the artwork ---- */

    /**
     * Every code in the batch is rasterised and read back, the same check the
     * single generator runs. Doing it on one code and assuming the rest follow
     * would be wrong in exactly the case that matters: rows differ in length,
     * so they differ in version, and a logo that fits comfortably on a short
     * URL can cover an alignment pattern on a long one.
     */
    async function verifyAll(stamp) {
      if (!batch.length) return;
      if (!window.QRDetect) {
        /* Nothing here to check the artwork with. The matrix is still sound —
           the encoder decodes its own output — but say which claim is being
           made rather than the stronger one. */
        batch.forEach(function (item) { markStatus(item, 'ok'); });
        setSummary(batch.length + ' codes encoded', false);
        refreshActions();
        paintVerdict(batch.length, 0, 0, stamp, true);
        return;
      }
      let ok = 0, tight = 0, bad = 0;
      for (let i = 0; i < batch.length; i++) {
        if (stamp !== runSeq) return;
        const item = batch[i];
        const got = await qrReadBack(item.svg, item.content, item.modules);
        if (stamp !== runSeq) return;
        if (!got) { markStatus(item, 'ok'); ok++; }
        else if (!got.clean) { markStatus(item, 'fail'); bad++; }
        else if (!got.rough) { markStatus(item, 'tight'); tight++; }
        else { markStatus(item, 'ok'); ok++; }

        if (i % 4 === 3) {
          setSummary(counted(i + 1, ok, tight, bad), true);
          refreshActions();
          await new Promise(function (r) { setTimeout(r, 0); });   // let the page breathe
        }
      }
      if (stamp !== runSeq) return;
      setSummary(counted(batch.length, ok, tight, bad), false);
      refreshActions();
      paintVerdict(ok, tight, bad, stamp);
    }

    function tally() {
      const n = { ok: 0, tight: 0, bad: 0 };
      batch.forEach(function (b) {
        if (b.status === 'fail') n.bad++;
        else if (b.status === 'tight') n.tight++;
        else n.ok++;
      });
      return n;
    }

    function counted(done, ok, tight, bad) {
      const parts = [done + ' of ' + batch.length + ' checked'];
      if (ok) parts.push(ok + ' verified');
      if (tight) parts.push(tight + ' tight');
      if (bad) parts.push(bad + ' will not scan');
      return parts.join(' · ');
    }

    /**
     * When a batch fails, say which single change fixes it rather than leaving
     * someone to guess — the same ladder the single generator climbs, tried
     * against the code that failed hardest, which is the longest one.
     */
    async function findBatchFix(stamp) {
      const failing = batch.filter(function (b) { return b.status === 'fail'; })
        .sort(function (a, b) { return b.content.length - a.content.length; })[0];
      if (!failing) return null;

      const ec = style.ecSel.value;
      const hasLogo = !!style.store.logo;
      const candidates = [];
      if (ec !== 'H') candidates.push({ label: 'raising error correction to High', apply: { ec: 'H' } });
      if (hasLogo && Number(style.logoPadSel.value) > 0) candidates.push({ label: 'removing the clear space around the logo', apply: { logopad: '0' } });
      if (hasLogo && Number(style.logoSizeSel.value) > 0.16) candidates.push({ label: 'making the logo smaller', apply: { logosize: '0.16' } });
      if (hasLogo && ec !== 'H' && Number(style.logoSizeSel.value) > 0.16) {
        candidates.push({ label: 'level High and a smaller logo', apply: { ec: 'H', logosize: '0.16' } });
      }

      for (const c of candidates) {
        if (stamp !== runSeq) return null;
        let qr;
        try { qr = QR.encode(failing.content, c.apply.ec || ec); } catch (e) { continue; }
        const trial = style.styleOptions(8);
        if (trial.logo && c.apply.logopad !== undefined) trial.logo.padding = Number(c.apply.logopad);
        if (trial.logo && c.apply.logosize !== undefined) trial.logo.size = Number(c.apply.logosize);
        const got = await qrReadBack(QR.toSVG(qr, trial), failing.content, qr.size + trial.quiet * 2);
        if (got && got.clean) return c;
      }
      return null;
    }

    async function paintVerdict(ok, tight, bad, stamp, unchecked) {
      const basic = style.staticNotes();
      const notes = basic.notes.slice();
      if (style.store.ecRaised) {
        notes.push('Error correction was raised to High when you added the logo, so there is room to repair what it covers. Lower it above if you would rather have less dense codes.');
      }

      let kind, head;
      if (bad) {
        kind = 'fail';
        head = bad + ' of ' + batch.length + ' codes will not scan — do not print this batch yet';
        notes.unshift(style.store.logo
          ? 'On the codes that failed, the logo covers more than their error correction can repair. Longer content means a denser code, so the same logo eats more of it.'
          : 'The codes that failed did not decode from their own artwork. The colours or shapes are getting in the way.');
      } else if (tight) {
        kind = 'warn';
        head = 'All ' + batch.length + ' read back, but ' + tight + ' only at a comfortable size';
        notes.unshift('Print those larger and keep them sharp — they did not survive being scaled down and roughened.');
      } else if (unchecked) {
        kind = basic.ok ? 'pass' : 'warn';
        head = 'Encoded and checked against the standard';
      } else {
        kind = basic.ok ? 'pass' : 'warn';
        head = 'Verified: all ' + batch.length + ' codes were rasterised and read back correctly';
      }

      verdict.textContent = '';
      verdict.className = 'qr-verdict is-' + kind;
      verdict.appendChild(el('p', 'qr-verdict-head', head));
      if (notes.length) {
        const ul = el('ul', 'qr-verdict-notes');
        notes.forEach(function (n) { ul.appendChild(el('li', null, n)); });
        verdict.appendChild(ul);
      }

      if (bad) {
        const fix = await findBatchFix(stamp);
        if (fix && stamp === runSeq) {
          const b = el('button', 'btn-primary qr-fix', 'Fix the batch: ' + fix.label);
          b.type = 'button';
          b.addEventListener('click', function () {
            if (fix.apply.ec) style.ecSel.value = fix.apply.ec;
            if (fix.apply.logopad !== undefined) style.logoPadSel.value = fix.apply.logopad;
            if (fix.apply.logosize !== undefined) style.logoSizeSel.value = fix.apply.logosize;
            build();
          });
          verdict.appendChild(b);
        }
      }
    }

    /* ---- getting them out ---- */

    /**
     * Decode a file from the bytes that are about to be written.
     *
     * A smaller pass first, because it is both the cheaper test and the harder
     * one; a 2400 px print file is only read at full size if the small read
     * fails, so a pass there is not a pass bought with resolution.
     */
    function decodePackaged(blob, expected) {
      return new Promise(function (resolve) {
        if (!window.QRDetect) { resolve(true); return; }
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = function () {
          URL.revokeObjectURL(url);
          const native = Math.max(img.naturalWidth || 0, img.naturalHeight || 0) || 600;
          const read = function (px) {
            const c = document.createElement('canvas');
            c.width = c.height = px;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.fillStyle = '#ffffff';          // whatever sits behind a transparent code
            ctx.fillRect(0, 0, px, px);
            ctx.drawImage(img, 0, 0, px, px);
            const got = window.QRDetect.scan(ctx.getImageData(0, 0, px, px));
            return !!(got && got.text === expected);
          };
          const small = Math.min(native, 1000);
          resolve(read(small) || (native > small && read(native)));
        };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(false); };
        img.src = url;
      });
    }

    /**
     * Build an archive, checking every file on the way in.
     *
     * The badge under a card is a statement about that code's SVG. A PNG is a
     * different artefact — a raster at whatever size the Output panel is set
     * to — and a dense code at 300 px can lose modules the same code keeps at
     * 600. Checking the SVG and then shipping the PNG would be checking one
     * thing and delivering another, so each file is decoded again from the
     * exact bytes about to be written, and nothing that fails to read is
     * packed. A batch that leaves this page has been scanned, file by file.
     */
    async function zipOf(ext) {
      if (!window.MVRZip) throw new Error('zip.js not loaded');
      const kept = lastCount;
      const size = Number(style.sizeSel.value);
      /* The download is shut until the batch has been checked, so anything
         still marked failing here failed that check. */
      const usable = batch.filter(function (b) { return b.status !== 'fail'; });
      const excluded = batch.length - usable.length;
      const files = [];
      const dropped = [];

      for (let i = 0; i < usable.length; i++) {
        const item = usable[i];
        const blob = ext === 'svg'
          ? new Blob([item.svg], { type: 'image/svg+xml' })
          : await svgToPngBlob(item.svg, size);
        const ok = blob ? await decodePackaged(blob, item.content) : false;
        if (ok) files.push({ name: item.name + '.' + ext, blob: blob });
        else { dropped.push(item); markStatus(item, 'fail'); }

        if (i % 3 === 2) {
          setSummary('Checking and packing ' + (i + 1) + ' of ' + usable.length + ' ' + ext.toUpperCase() + ' files…', true);
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      }

      /* A file dropped here changes the verdict that is on screen, so the
         headline and the count go back to being true about the batch. */
      if (dropped.length) {
        const n = tally();
        setSummary(counted(batch.length, n.ok, n.tight, n.bad), false);
        paintVerdict(n.ok, n.tight, n.bad, runSeq);
      } else {
        setSummary(kept, false);
      }
      reportPacking(ext, files.length, dropped, excluded, size);
      refreshActions();
      if (!files.length) return null;
      return window.MVRZip(files);
    }

    function reportPacking(ext, packed, dropped, excluded, size) {
      const why = [];
      if (excluded) {
        why.push(excluded + (excluded === 1 ? ' code was' : ' codes were') +
          ' left out because ' + (excluded === 1 ? 'it does' : 'they do') + ' not scan.');
      }
      if (dropped.length) {
        why.push(dropped.length + (dropped.length === 1 ? ' code' : ' codes') +
          ' read as artwork but not as a finished ' + ext.toUpperCase() +
          (ext === 'png' ? ' at ' + size + ' px, so raise the PNG size in the Output panel' : '') + ': ' +
          dropped.slice(0, 5).map(function (d) { return d.name; }).join(', ') +
          (dropped.length > 5 ? ' and ' + (dropped.length - 5) + ' more' : '') + '.');
      }
      if (!packed) {
        note('Nothing was packed. ' + why.join(' '), 'error');
        return;
      }
      note(why.length
        ? packed + (packed === 1 ? ' file was' : ' files were') + ' packed, each one decoded from the exact bytes in the archive. ' + why.join(' ')
        : 'All ' + packed + ' files were decoded again from the exact bytes in the archive before it was built.',
        why.length ? 'warn' : 'note');
    }

    function listCsv() {
      const rows = [['file', 'content', 'check']];
      batch.forEach(function (b) { rows.push([b.name, b.content, statusLabel(b.status)]); });
      skipped.forEach(function (k) { rows.push(['', k.text, 'skipped: ' + k.why]); });
      return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    }

    let zipButtons = [];
    let printBtn = null;

    function paintActions() {
      acts.textContent = '';
      zipButtons = [];
      printBtn = null;
      if (!batch.length) return;

      const png = downloadButton('Download PNG (ZIP)',
        function () { return 'qr-codes-png.zip'; }, function () { return zipOf('png'); });
      const svg = downloadButton('Download SVG (ZIP)',
        function () { return 'qr-codes-svg.zip'; }, function () { return zipOf('svg'); });
      zipButtons = [['PNG', png], ['SVG', svg]];
      acts.appendChild(png);
      acts.appendChild(svg);

      /* The list is a record of the run, failures included, so it is never
         gated: knowing which rows did not make it is the point of it. */
      acts.appendChild(downloadButton('Download the list (CSV)',
        function () { return 'qr-codes.csv'; },
        function () { return new Blob([listCsv()], { type: 'text/csv;charset=utf-8' }); }));

      printBtn = el('button', 'btn-ghost', 'Print sheet');
      printBtn.type = 'button';
      printBtn.addEventListener('click', function () {
        document.documentElement.classList.add('is-bulk-print');
        window.print();
        setTimeout(function () { document.documentElement.classList.remove('is-bulk-print'); }, 500);
      });
      acts.appendChild(printBtn);
      refreshActions();
    }

    /**
     * Nothing can be downloaded until every code in the batch has been read
     * back. Handing over an archive mid-check would mean handing over files
     * nobody has looked at yet, which is the one thing this tool is for.
     */
    function refreshActions() {
      if (!zipButtons.length) return;
      const checking = batch.some(function (b) { return b.status === 'checking'; });
      const bad = batch.filter(function (b) { return b.status === 'fail'; }).length;
      const good = batch.length - bad;
      zipButtons.forEach(function (pair) {
        const b = pair[1];
        b.disabled = checking || !good;
        b.textContent = checking ? 'Checking every code…'
          : !good ? 'No code passed the check'
          : bad ? 'Download the ' + good + ' that passed (' + pair[0] + ')'
          : 'Download ' + pair[0] + ' (ZIP)';
      });
      if (printBtn) {
        printBtn.disabled = checking || !good;
        printBtn.textContent = bad && good ? 'Print the ' + good + ' that passed' : 'Print sheet';
      }
    }

    function paintStats() {
      if (!batch.length) { renderStats(stats, null); return; }
      const versions = batch.map(function (b) { return b.qr.version; });
      const lo = Math.min.apply(null, versions), hi = Math.max.apply(null, versions);
      const longest = batch.reduce(function (a, b) { return b.content.length > a.content.length ? b : a; });
      const densest = batch.reduce(function (a, b) { return b.qr.size > a.qr.size ? b : a; });
      const px = Number(style.sizeSel.value);
      renderStats(stats, [
        ['Codes', String(batch.length)],
        ['Rows skipped', String(skipped.length)],
        ['Version', lo === hi ? String(lo) : lo + ' to ' + hi],
        ['Error correction', EC_LABELS[style.ecSel.value]],
        ['Longest content', longest.content.length + ' characters'],
        ['PNG export', px + ' x ' + px + ' px each'],
        ['Smallest safe print', Math.ceil((densest.qr.size + Number(style.quietSel.value) * 2) * 0.5) + ' mm wide']
      ]);
    }

    /* ---- wiring ---- */

    let pending = 0;
    /** A change to the look rebuilds the batch; a change to the list waits for
        the button, because re-encoding five hundred codes on every keystroke
        would make the textarea unusable. */
    function scheduleRestyle() {
      style.syncVisibility();
      if (!batch.length && !generated) return;
      if (pending) clearTimeout(pending);
      pending = setTimeout(function () { pending = 0; build(); }, 220);
    }

    function syncHint() {
      const type = QR_TYPES[typeSel.value];
      if (type.fields.length === 1) {
        hint.textContent = 'One ' + type.fields[0][1].toLowerCase() + ' per line. Add a header line like “' +
          type.fields[0][0] + ',name” if you want to choose the file names.';
      } else {
        hint.textContent = 'One row per code. Columns are ' +
          type.fields.map(function (f) { return f[0]; }).join(', ') +
          ' in that order, or put a header line naming them — add a “name” column to set the file names.';
      }
      genBtn.classList.toggle('is-stale', area.value !== generated && !!area.value.trim());
    }

    typeSel.addEventListener('change', function () {
      syncHint();
      if (batch.length || generated) build();
    });
    area.addEventListener('input', syncHint);
    genBtn.addEventListener('click', build);
    exampleBtn.addEventListener('click', function () {
      area.value = BULK_EXAMPLES[typeSel.value] || '';
      syncHint();
      build();
    });
    clearBtn.addEventListener('click', function () {
      area.value = '';
      generated = '';
      batch = [];
      skipped = [];
      runSeq++;
      syncHint();
      build();
    });
    fileIn.addEventListener('change', function () {
      const f = fileIn.files && fileIn.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function () {
        area.value = String(reader.result);
        syncHint();
        build();
      };
      reader.onerror = function () { note('That file could not be read.', 'error'); };
      reader.readAsText(f);
      fileIn.value = '';
    });

    /* The logo input is left out on purpose: picking a file fires `change`
       before the file has been read, so reacting to it would rebuild the whole
       batch once without the logo and again with it. The style controls call
       back themselves once the image is actually in hand. */
    const ownEvents = [typeSel, area, fileIn];
    const mine = (t) => ownEvents.indexOf(t) >= 0 || (t && t.id === 'qr-logo');
    controls.addEventListener('change', function (e) { if (!mine(e.target)) scheduleRestyle(); });
    controls.addEventListener('input', function (e) { if (!mine(e.target)) scheduleRestyle(); });

    style.syncVisibility();
    syncHint();
    build();
  }

  /* ---------------- QR scanner ---------------- */

  /**
   * What a scanned payload actually is, and what can usefully be done with it.
   * A scanner that only prints the raw string makes the reader do the parsing,
   * which is the one job they wanted done for them.
   */
  function classifyPayload(text) {
    const s = String(text || '');
    const lower = s.toLowerCase();
    const clip = (v, n) => (v && v.length > n ? v.slice(0, n) + '…' : v || '');

    if (/^wifi:/i.test(s)) {
      const field = (key) => {
        const m = new RegExp(key + ':((?:\\\\.|[^;])*);', 'i').exec(s);
        return m ? m[1].replace(/\\(.)/g, '$1') : '';
      };
      const ssid = field('S'), pass = field('P'), enc = field('T');
      return {
        kind: 'WiFi network',
        headline: ssid || 'Unnamed network',
        icon: 'wifi',
        /* A web page cannot join a network — only the phone's own camera app
           can. Saying so beats a button that quietly does nothing, and the
           password is the thing you actually need in hand. */
        copy: pass ? { label: 'Copy the password', value: pass } : null,
        aside: pass
          ? 'A web page cannot join a network for you. Copy the password, then pick the network in your WiFi settings.'
          : 'This is an open network with no password. Pick it in your WiFi settings.',
        fields: [
          ['Network (SSID)', ssid],
          ['Security', ({ WPA: 'WPA / WPA2 / WPA3', WEP: 'WEP', nopass: 'Open, no password' })[enc] || enc || 'Unspecified'],
          ['Password', pass || '(none)'],
          ['Hidden', /H:true/i.test(s) ? 'Yes' : 'No']
        ]
      };
    }

    if (/^BEGIN:VCARD/i.test(s)) {
      const line = (key) => {
        const m = new RegExp('^' + key + '[^:\\r\\n]*:(.*)$', 'im').exec(s);
        return m ? m[1].replace(/\\n/g, ' ').replace(/\\(.)/g, '$1').trim() : '';
      };
      return {
        kind: 'Contact card',
        headline: line('FN') || line('ORG') || 'Contact',
        icon: 'contact',
        downloadLabel: 'Save to contacts',
        fields: [
          ['Name', line('FN')], ['Organisation', line('ORG')], ['Title', line('TITLE')],
          ['Phone', line('TEL')], ['Email', line('EMAIL')], ['Website', line('URL')]
        ].filter((f) => f[1]),
        download: { name: 'contact.vcf', type: 'text/vcard', body: s }
      };
    }

    if (/^MECARD:/i.test(s)) {
      const field = (key) => {
        const m = new RegExp(key + ':((?:\\\\.|[^;])*);', 'i').exec(s);
        return m ? m[1].replace(/\\(.)/g, '$1') : '';
      };
      const name = field('N'), tel = field('TEL'), email = field('EMAIL'), url = field('URL');
      const vcard = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + name,
        tel ? 'TEL:' + tel : '', email ? 'EMAIL:' + email : '', url ? 'URL:' + url : '',
        'END:VCARD'].filter(Boolean).join('\n');
      return {
        kind: 'Contact card',
        headline: name || tel || 'Contact',
        icon: 'contact',
        downloadLabel: 'Save to contacts',
        fields: [['Name', name], ['Phone', tel], ['Email', email], ['Website', url]].filter((f) => f[1]),
        download: { name: 'contact.vcf', type: 'text/vcard', body: vcard }
      };
    }

    if (/^BEGIN:(VEVENT|VCALENDAR)/i.test(s)) {
      const line = (key) => {
        const m = new RegExp('^' + key + '[^:\\r\\n]*:(.*)$', 'im').exec(s);
        return m ? m[1].trim() : '';
      };
      const when = (v) => {
        const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(v || '');
        return m ? m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] + ':' + m[5] : v;
      };
      const body = /^BEGIN:VCALENDAR/i.test(s) ? s
        : 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//1234Tools//QR//EN\n' + s + '\nEND:VCALENDAR';
      return {
        kind: 'Calendar event',
        headline: line('SUMMARY') || 'Event',
        icon: 'calendar',
        downloadLabel: 'Add to calendar',
        fields: [['Event', line('SUMMARY')], ['Location', line('LOCATION')],
                 ['Starts', when(line('DTSTART'))], ['Ends', when(line('DTEND'))],
                 ['Details', line('DESCRIPTION')]].filter((f) => f[1]),
        download: { name: 'event.ics', type: 'text/calendar', body: body }
      };
    }

    if (/^upi:\/\//i.test(s)) {
      const q = {};
      (s.split('?')[1] || '').split('&').forEach((kv) => {
        const i = kv.indexOf('=');
        if (i > 0) q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
      });
      return {
        kind: 'UPI payment request',
        headline: q.pn || q.pa || 'Payment request',
        icon: 'pay',
        warn: 'Check the payee and amount in your payment app before confirming. A payment code can be swapped on a printed sticker.',
        fields: [['Pay to', q.pa || ''], ['Payee name', q.pn || ''],
                 ['Amount', q.am ? (q.cu || 'INR') + ' ' + q.am : 'Not set'],
                 ['Note', q.tn || '']].filter((f) => f[1]),
        link: s,
        linkLabel: 'Open in a payment app'
      };
    }

    if (/^bitcoin:/i.test(s)) {
      const addr = s.slice(8).split('?')[0];
      const amount = /[?&]amount=([^&]*)/i.exec(s);
      return {
        kind: 'Bitcoin payment request',
        headline: clip(addr, 24),
        icon: 'pay',
        warn: 'Check the address in your wallet before sending. Payments cannot be reversed.',
        fields: [['Address', addr], ['Amount', amount ? amount[1] + ' BTC' : 'Not set']],
        link: s,
        linkLabel: 'Open in a wallet'
      };
    }

    if (/^mailto:/i.test(s)) {
      const to = s.slice(7).split('?')[0];
      return {
        kind: 'Email',
        headline: decodeURIComponent(to) || 'Email',
        icon: 'mail',
        fields: [['To', decodeURIComponent(to)]],
        link: s,
        linkLabel: 'Write an email'
      };
    }

    if (/^(sms|smsto):/i.test(s)) {
      const rest = s.replace(/^(sms|smsto):/i, '');
      const parts = rest.split(':');
      const num = parts[0];
      const body = parts.slice(1).join(':');
      return {
        kind: 'Text message',
        headline: num,
        icon: 'message',
        fields: [['Number', num], ['Message', body]].filter((f) => f[1]),
        /* RFC 5724 spells the prefilled body this way. Phones that ignore it
           still open the right conversation, and the text is on screen to
           copy, so nothing is lost either way. */
        link: 'sms:' + num + (body ? '?body=' + encodeURIComponent(body) : ''),
        linkLabel: 'Open a message'
      };
    }

    if (/^tel:/i.test(s)) {
      return {
        kind: 'Phone number',
        headline: s.slice(4),
        icon: 'phone',
        fields: [['Number', s.slice(4)]],
        link: s,
        linkLabel: 'Call this number'
      };
    }

    if (/^geo:/i.test(s)) {
      const c = s.slice(4).split(/[,;]/);
      return {
        kind: 'Map location',
        headline: c[0] + (c[1] ? ', ' + c[1] : ''),
        icon: 'pin',
        fields: [['Latitude', c[0]], ['Longitude', c[1] || '']],
        link: 'https://www.openstreetmap.org/?mlat=' + encodeURIComponent(c[0]) + '&mlon=' + encodeURIComponent(c[1] || ''),
        linkLabel: 'Show on a map',
        aside: 'The map opens on OpenStreetMap, which is the one link here that leaves this site.'
      };
    }

    if (/^https?:\/\//i.test(s)) {
      let host = '', safe = true, notes = [];
      try {
        const u = new URL(s);
        host = u.hostname;
        // An address bar shows the decoded form; the code carries the raw one.
        // Mixed scripts in a host name are the classic look-alike trick.
        if (/^xn--/i.test(host) || /[^\x00-\x7F]/.test(host)) {
          notes.push('This address uses non-Latin characters in the domain, which is how look-alike sites imitate a real one. Read it carefully.');
        }
        if (u.protocol === 'http:') {
          notes.push('This is a plain http address, so anything you send to it travels unencrypted.');
        }
      } catch (e) { safe = false; }
      return {
        kind: 'Website address',
        /* The domain is the headline, not the whole URL: it is the part that
           decides whether opening this is a good idea, and a long tracking
           tail would push it off a phone screen. */
        headline: host || clip(s, 40),
        sub: s,
        icon: 'link',
        fields: [['Goes to', host], ['Full address', s]],
        notes: notes,
        link: safe ? s : null,
        linkLabel: 'Open this link'
      };
    }

    if (/^(javascript|data|vbscript|file):/i.test(lower)) {
      return {
        kind: 'Suspicious link',
        headline: (lower.split(':')[0] || '') + ': address',
        icon: 'alert',
        warn: 'This code contains a script or file address rather than an ordinary link. Nothing here will open it. Codes like this are used to attack the device that reads them.',
        fields: [['Content', s]]
      };
    }

    return {
      kind: 'Plain text',
      headline: clip(s.split('\n')[0], 60) || 'Empty',
      icon: 'text',
      fields: [],
      link: null,
      copy: { label: 'Copy the text', value: s }
    };
  }

  function mountQRScanner(spec, root, api) {
    const QR = (api && api.encode) ? api : window.QR;
    const Detect = window.QRDetect;
    const io = root.querySelector('.tool-io');

    const state = {
      stream: null, track: null, running: false, busy: false,
      native: null, nativeTried: false,
      devices: [], deviceId: null, resumeId: null, facing: 'environment',
      torchOn: false, hasTorch: false, resumeOnShow: false,
      mode: 'idle', last: '', misses: 0, altPass: false, history: []
    };

    /* ---- camera panel ---- */

    const stage = el('div', 'scan-stage');
    const frame = el('div', 'scan-frame');
    const video = el('video');
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-label', 'Camera preview');
    const reticle = el('div', 'scan-reticle');
    reticle.innerHTML = '<span></span><span></span><span></span><span></span><i class="scan-beam"></i>';
    const placeholder = el('div', 'scan-placeholder');
    placeholder.appendChild(el('p', null, 'The camera preview appears here. Nothing is recorded, and no frame leaves your device.'));
    frame.appendChild(video);
    frame.appendChild(reticle);
    frame.appendChild(placeholder);
    stage.appendChild(frame);

    /* The answer goes where the camera was.
       It used to be appended below the whole stage, which on a phone put it
       under the fold: the camera kept running, nothing visibly happened, and
       the only clue that the scan had worked was off screen. */
    const result = el('div', 'scan-result');
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');
    stage.appendChild(result);

    const controls = el('div', 'io-actions scan-controls');
    const startBtn = el('button', 'btn-primary', 'Start camera');
    startBtn.type = 'button';
    startBtn.dataset.act = 'start';

    /* A named list rather than a "switch" button. On a current phone "the
       back camera" is three or four lenses, and blind cycling lands on the
       ultra-wide, where a code is a smudge. Naming them lets someone go
       straight back to the one that worked. */
    const camWrap = el('label', 'scan-camera');
    camWrap.hidden = true;
    camWrap.appendChild(el('span', 'visually-hidden', 'Camera'));
    const camSel = el('select', 'control scan-camera-select');
    camWrap.appendChild(camSel);

    const torchBtn = el('button', 'btn-ghost', 'Torch');
    torchBtn.type = 'button';
    torchBtn.dataset.act = 'torch';
    torchBtn.hidden = true;

    const againBtn = el('button', 'btn-primary', 'Scan another code');
    againBtn.type = 'button';
    againBtn.dataset.act = 'again';
    againBtn.hidden = true;

    controls.appendChild(startBtn);
    controls.appendChild(againBtn);
    controls.appendChild(camWrap);
    controls.appendChild(torchBtn);
    stage.appendChild(controls);

    const msg = el('div', 'io-msg');
    stage.appendChild(msg);
    io.appendChild(stage);

    /* ---- image fallback ---- */

    const drop = el('div', 'dropzone scan-drop');
    drop.tabIndex = 0;
    drop.appendChild(el('strong', null, 'Or scan a picture of a code'));
    drop.appendChild(el('span', null, 'Drop an image here, paste one, or tap to choose a file'));
    const fileInput = el('input', 'visually-hidden');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    drop.appendChild(fileInput);
    io.appendChild(drop);

    /* ---- earlier scans ---- */

    const historyWrap = el('section', 'scan-history');
    io.appendChild(historyWrap);

    /**
     * Three states, and every control belongs to exactly one of them.
     *
     *   idle    nothing running, "Start camera"
     *   live    preview and reticle, camera list and torch
     *   result  the camera is off and its space holds the answer
     */
    function setMode(mode) {
      state.mode = mode;
      stage.dataset.mode = mode;
      frame.hidden = mode === 'result';
      result.hidden = mode !== 'result';
      startBtn.hidden = mode === 'result';
      againBtn.hidden = mode !== 'result';
      camWrap.hidden = mode !== 'live' || state.devices.length < 2;
      torchBtn.hidden = mode !== 'live' || !state.hasTorch;
      if (mode !== 'live') {
        torchBtn.classList.remove('is-active');
      }
    }

    /* ---- scanning ---- */

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    /**
     * The browser's own detector, set up on load rather than when the camera
     * starts: it reads a dropped picture too, and building it only inside
     * start() meant a picture scanned before the camera was ever switched on
     * never got the benefit of it.
     */
    async function initNative() {
      if (state.nativeTried || !('BarcodeDetector' in window)) return;
      state.nativeTried = true;
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (formats.indexOf('qr_code') >= 0) {
          state.native = new window.BarcodeDetector({ formats: ['qr_code'] });
        }
      } catch (e) { state.native = null; }
    }

    /**
     * Draw part of a source into the work canvas and hand back its pixels.
     *
     * The window it drew is remembered, because the detector reports the
     * code's corners in canvas coordinates and the frozen frame shown
     * afterwards is in source coordinates.
     */
    let lastView = null;
    function grab(source, sx, sy, sw, sh, max) {
      const scale = Math.min(1, max / Math.max(sw, sh));
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      lastView = { sx: sx, sy: sy, sw: sw, sh: sh, cw: canvas.width, ch: canvas.height };
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    /** Corners, from wherever the detector found them, in source pixels. */
    function cornersInSource(got) {
      if (got.native) return got.corners || null;         // already source space
      if (!got.corners || !lastView) return null;
      const v = lastView;
      return got.corners.map(function (pt) {
        return { x: v.sx + pt.x * (v.sw / v.cw), y: v.sy + pt.y * (v.sh / v.ch) };
      });
    }

    const FULL_MAX = 800;      // whole frame, scaled down
    const CROP_MAX = 800;      // the middle of it, near full detail

    /**
     * Read one frame. The browser's detector gets first look; after that the
     * frame is examined two ways in turn — the whole thing scaled down, then
     * the middle of it at close to full detail.
     *
     * One downscaled pass was the old behaviour, and it is why a code across
     * the room never read: squeezing a 1080p frame into 640px leaves its
     * modules two or three pixels wide, which no threshold recovers. Only
     * ever cropping would miss a code held close, so the two alternate and
     * each frame still costs one pass.
     */
    async function readFrame(source, width, height) {
      if (state.native) {
        try {
          const found = await state.native.detect(source);
          if (found && found.length && found[0].rawValue) {
            return { text: found[0].rawValue, native: true, corners: found[0].cornerPoints || null };
          }
        } catch (e) { state.native = null; }
      }
      state.altPass = !state.altPass;
      const side = Math.min(width, height);
      let view;
      if (state.altPass && side > 520) {
        const box = Math.round(side * 0.62);
        view = [Math.round((width - box) / 2), Math.round((height - box) / 2), box, box, CROP_MAX];
      } else {
        view = [0, 0, width, height, FULL_MAX];
      }
      return Detect.scan(grab(source, view[0], view[1], view[2], view[3], view[4]));
    }

    let looping = false;
    let lastPass = 0;

    /* Roughly twelve looks a second. Running flat out on every animation
       frame sounds better and reads worse: a decode pass takes long enough to
       starve the main thread, so the preview stutters and the camera drops
       frames — and a blurred frame is the one thing the decoder cannot fix. */
    const PASS_MS = 80;

    /* How many empty passes mean the code has left the frame. Without this
       `state.last` never cleared, so a code could be read once and never
       again: pointing the same code at a freshly switched camera looked
       exactly like a scanner that had stopped working. */
    const MISSES_TO_FORGET = 12;

    async function loop() {
      looping = true;
      if (!state.running) { looping = false; return; }
      const now = (window.performance && performance.now) ? performance.now() : Date.now();
      if (now - lastPass >= PASS_MS && !state.busy && video.readyState >= 2 && video.videoWidth) {
        lastPass = now;
        try {
          const got = await readFrame(video, video.videoWidth, video.videoHeight);
          if (got && got.text) {
            /* Freeze the frame before the stream is torn down, so the answer
               can show what was actually read rather than a black rectangle. */
            const shot = freezeFrame(video, video.videoWidth, video.videoHeight, cornersInSource(got));
            state.misses = 0;
            stop('', 'note', true);
            showResult(got, 'camera', shot);
            /* The loop ends with the camera. Clearing the flag matters:
               `start()` only restarts the loop when nothing is looping, so
               leaving it set gave a live preview that scanned nothing. */
            looping = false;
            return;
          }
          if (state.last && ++state.misses > MISSES_TO_FORGET) {
            state.last = '';
            state.misses = 0;
          }
        } catch (e) { /* a dropped frame is not worth reporting */ }
      }
      requestAnimationFrame(loop);
    }

    /* ---- the camera ---- */

    const facingFromLabel = (label) =>
      /front|user|face|selfie/i.test(String(label || '')) ? 'user' : 'environment';

    function capabilities() {
      try {
        return (state.track && state.track.getCapabilities) ? (state.track.getCapabilities() || {}) : {};
      } catch (e) { return {}; }
    }

    /**
     * One shape of request for every camera.
     *
     * The old code asked for 1280x720 when it opened the back camera and
     * asked for nothing at all when it switched, so the second camera often
     * came up at 640x480 — enough on its own to stop a code reading that had
     * read a second earlier.
     */
    function videoConstraints(deviceId) {
      const v = { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } };
      if (deviceId) v.deviceId = { exact: deviceId };
      else v.facingMode = { ideal: 'environment' };
      return v;
    }

    async function openStream(deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: videoConstraints(deviceId), audio: false });
      } catch (e) {
        const name = e && e.name;
        /* That exact camera is gone — a webcam unplugged, or a lens another
           app has taken. Any camera beats no camera. */
        if (deviceId && (name === 'OverconstrainedError' || name === 'NotFoundError')) {
          return navigator.mediaDevices.getUserMedia({ video: videoConstraints(null), audio: false });
        }
        throw e;
      }
    }

    function releaseStream() {
      if (state.stream) state.stream.getTracks().forEach(function (t) { t.stop(); });
      state.stream = null;
      state.track = null;
      state.torchOn = false;
      state.hasTorch = false;
      torchBtn.classList.remove('is-active');
    }

    /**
     * Wait for a frame that actually has pixels in it. Decoding a stream that
     * has not produced one reads a blank canvas, which is the other half of
     * "it stopped recognising anything after I switched camera".
     */
    function firstFrame() {
      if (video.readyState >= 2 && video.videoWidth) return Promise.resolve();
      return new Promise(function (resolve) {
        const done = function () {
          clearTimeout(timer);
          video.removeEventListener('loadeddata', done);
          resolve();
        };
        const timer = setTimeout(done, 3000);
        video.addEventListener('loadeddata', done);
      });
    }

    /* Ask for continuous autofocus where the camera offers it. A stream stuck
       on a fixed focus is the usual reason a code fills the frame and still
       will not read: sharp enough on the preview, mush to the decoder. */
    function applyFocus() {
      if (!state.track || !state.track.applyConstraints) return;
      const caps = capabilities();
      const adv = [];
      if (caps.focusMode && caps.focusMode.indexOf('continuous') >= 0) adv.push({ focusMode: 'continuous' });
      if (adv.length) state.track.applyConstraints({ advanced: adv }).catch(function () {});
    }

    /* Android fills in a track's capabilities a beat after it goes live, so
       ask twice before deciding there is no torch on this camera. */
    function probeTorch() {
      const look = function () {
        if (!state.track) return;
        state.hasTorch = !!capabilities().torch;
        if (state.mode === 'live') torchBtn.hidden = !state.hasTorch;
      };
      look();
      setTimeout(look, 600);
    }

    /* Labels are blank until permission is granted, which is why the list is
       filled in after the camera starts rather than when the page loads. */
    async function refreshDevices() {
      if (!navigator.mediaDevices.enumerateDevices) return;
      let list;
      try { list = await navigator.mediaDevices.enumerateDevices(); }
      catch (e) { return; }
      state.devices = list.filter(function (d) { return d.kind === 'videoinput'; });
      camSel.textContent = '';
      state.devices.forEach(function (d, i) {
        const o = el('option', null, d.label || ('Camera ' + (i + 1)));
        o.value = d.deviceId;
        camSel.appendChild(o);
      });
      if (state.deviceId && state.devices.some(function (d) { return d.deviceId === state.deviceId; })) {
        camSel.value = state.deviceId;
      }
      if (state.mode === 'live') camWrap.hidden = state.devices.length < 2;
    }

    async function attach(stream) {
      releaseStream();
      state.stream = stream;
      state.track = stream.getVideoTracks()[0] || null;
      video.srcObject = stream;
      try { await video.play(); } catch (e) { /* a refused autoplay still decodes */ }
      await firstFrame();

      let settings = {};
      try { settings = (state.track && state.track.getSettings) ? (state.track.getSettings() || {}) : {}; }
      catch (e) { settings = {}; }
      state.deviceId = settings.deviceId || null;
      state.facing = settings.facingMode || facingFromLabel(state.track && state.track.label);

      /* A selfie camera shows the world back to front, so the preview is
         mirrored to make aiming work. The frame handed to the decoder is the
         untouched one — CSS does not reach into drawImage — and the decoder
         reads a genuinely mirrored code anyway. */
      frame.classList.toggle('is-mirrored', state.facing === 'user');
      frame.classList.add('is-live');
      placeholder.hidden = true;

      /* A new camera is a fresh chance to read whatever is already in front
         of it, including the code that was just read. */
      state.last = '';
      state.misses = 0;

      applyFocus();
      probeTorch();
      await refreshDevices();
    }

    function cameraError(e) {
      const name = e && e.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        return 'Camera permission was refused. Allow it from the padlock or camera icon in the address bar, or scan a picture of the code below instead.';
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        return 'No camera was found on this device. You can still scan a picture of a code below.';
      }
      if (name === 'NotReadableError' || name === 'TrackStartError') {
        return 'The camera is busy — another app or tab already has it open. Close that, then try again.';
      }
      return 'The camera could not be started: ' + ((e && e.message) ? e.message : 'unknown error') +
             '. Browsers only allow the camera on secure (https) pages.';
    }

    const AIM = 'Point the camera at a QR code. It reads on its own.';

    async function start(deviceId) {
      if (state.busy) return;
      state.busy = true;
      note('Asking for camera permission…', 'note');
      let stream;
      try {
        stream = await openStream(deviceId || null);
      } catch (e) {
        state.busy = false;
        stop(cameraError(e), 'error');
        return;
      }
      try {
        await attach(stream);
      } catch (e) {
        state.busy = false;
        stop(cameraError(e), 'error');
        return;
      }
      state.running = true;
      state.resumeOnShow = false;
      startBtn.textContent = 'Stop camera';
      setMode('live');
      note(AIM, 'note');
      state.busy = false;
      initNative();
      if (!looping) loop();
    }

    /**
     * Turn the camera off.
     *
     * `keepMode` is passed when a successful scan is what stopped it: the
     * stage is about to become the result, and flipping it back to idle first
     * would blink the placeholder through.
     */
    function stop(message, kind, keepMode) {
      state.running = false;
      state.resumeOnShow = false;
      state.last = '';
      state.misses = 0;
      releaseStream();
      video.srcObject = null;
      frame.classList.remove('is-live', 'is-mirrored');
      placeholder.hidden = false;
      startBtn.textContent = 'Start camera';
      if (!keepMode) setMode('idle');
      note(message === undefined ? 'Camera stopped.' : message, kind || 'note');
    }

    /**
     * Switching is a full restart on the chosen camera rather than a swap of
     * the device id on the existing track: reusing the track keeps the
     * resolution, torch and focus mode of the camera you just left, which is
     * how a working scanner turns into one that reads nothing.
     */
    async function switchTo(deviceId) {
      if (state.busy || !deviceId) return;
      const previous = state.deviceId;
      state.busy = true;
      note('Switching camera…', 'note');
      try {
        await attach(await openStream(deviceId));
        note(AIM, 'note');
      } catch (e) {
        if (previous && previous !== deviceId) {
          try {
            await attach(await openStream(previous));
            camSel.value = previous;
            note('That camera could not be opened, so the previous one is back.', 'warn');
          } catch (e2) {
            state.busy = false;
            stop(cameraError(e2), 'error');
            return;
          }
        } else {
          state.busy = false;
          stop(cameraError(e), 'error');
          return;
        }
      }
      state.busy = false;
      if (state.running && !looping) loop();
    }

    async function toggleTorch() {
      if (!state.track) return;
      const want = !state.torchOn;
      try {
        await state.track.applyConstraints({ advanced: [{ torch: want }] });
        state.torchOn = want;
        torchBtn.classList.toggle('is-active', want);
      } catch (e) {
        note('This camera will not let the page control the torch.', 'warn');
        torchBtn.hidden = true;
      }
    }

    function note(text, kind) {
      msg.textContent = text;
      msg.className = 'io-msg' + (kind ? ' is-' + kind : '');
    }

    /* ---- reading a still image ---- */

    async function scanFile(file) {
      if (!file || !/^image\//.test(file.type)) {
        note('That file is not an image.', 'error');
        return;
      }
      if (state.running) stop('', 'note', true);
      note('Looking for a code in that picture…', 'note');
      await initNative();
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = async function () {
        URL.revokeObjectURL(url);
        let got = null;
        // A code that is small in a large photo survives a second look at
        // full resolution, so try a few sizes, and the middle of the picture
        // on its own, before giving up.
        const side = Math.min(img.width, img.height);
        const box = Math.round(side * 0.7);
        const views = [
          [0, 0, img.width, img.height, 700],
          [0, 0, img.width, img.height, 1400],
          [Math.round((img.width - box) / 2), Math.round((img.height - box) / 2), box, box, 1400],
          [0, 0, img.width, img.height, 2200]
        ];
        for (const v of views) {
          const data = grab(img, v[0], v[1], v[2], v[3], v[4]);
          if (state.native) {
            try {
              const found = await state.native.detect(canvas);
              if (found && found.length && found[0].rawValue) {
                /* The native detector read the work canvas, so its corners
                   are in that window's coordinates, same as ours. */
                got = { text: found[0].rawValue, nativeOnCanvas: true, corners: found[0].cornerPoints || null };
                break;
              }
            } catch (e) { state.native = null; }
          }
          got = Detect.scan(data);
          if (got) break;
        }
        if (got) {
          const marks = got.nativeOnCanvas
            ? cornersInSource({ corners: got.corners })
            : cornersInSource(got);
          if (got.nativeOnCanvas) { got.native = true; delete got.nativeOnCanvas; }
          showResult(got, 'image', freezeFrame(img, img.width, img.height, marks));
        } else {
          note('No QR code was found in that image. A sharper picture, or one with the whole code and a little space around it, usually does it.', 'warn');
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        note('That image could not be opened.', 'error');
      };
      img.src = url;
    }

    /* ---- showing what was read ---- */

    /* A small line drawing per payload kind, so the answer is recognisable
       before a word of it is read. Two colours at most, and no brand marks:
       these have to work at 28px in both themes. */
    const KIND_ICONS = {
      link: '<path d="M9.5 14.5a4 4 0 0 1 0-5.7l2.8-2.8a4 4 0 1 1 5.7 5.7l-1.3 1.3"/><path d="M14.5 9.5a4 4 0 0 1 0 5.7l-2.8 2.8a4 4 0 1 1-5.7-5.7l1.3-1.3"/>',
      wifi: '<path d="M2.5 8.8a15 15 0 0 1 19 0"/><path d="M6 12.4a10 10 0 0 1 12 0"/><path d="M9.4 15.9a5 5 0 0 1 5.2 0"/><circle cx="12" cy="19.4" r="1.1" fill="currentColor" stroke="none"/>',
      contact: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20.2a7.6 7.6 0 0 1 14.4 0"/>',
      calendar: '<rect x="3.2" y="4.8" width="17.6" height="16" rx="2.2"/><path d="M3.2 9.6h17.6M8 3.2v3.2M16 3.2v3.2"/><circle cx="8.4" cy="13.6" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="13.6" r="1" fill="currentColor" stroke="none"/>',
      pay: '<rect x="2.8" y="5.6" width="18.4" height="12.8" rx="2.2"/><path d="M2.8 10h18.4"/><path d="M6.4 14.4h3.2"/>',
      mail: '<rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2.2"/><path d="M3.4 7 12 13l8.6-6"/>',
      message: '<path d="M20.8 12.8a7.6 7.6 0 0 1-7.6 7.6H8.4L3.2 23v-5.2a7.6 7.6 0 0 1 5.2-11.8h4.8a7.6 7.6 0 0 1 7.6 7.6z"/>',
      phone: '<path d="M7 3.6h3l1.6 4-2 1.4a11 11 0 0 0 5.4 5.4l1.4-2 4 1.6v3A2.4 2.4 0 0 1 18 19.4 14.4 14.4 0 0 1 4.6 6 2.4 2.4 0 0 1 7 3.6z"/>',
      pin: '<path d="M12 21.4s6.8-6.1 6.8-11a6.8 6.8 0 1 0-13.6 0c0 4.9 6.8 11 6.8 11z"/><circle cx="12" cy="10.2" r="2.4"/>',
      alert: '<path d="M12 3.6 22 20.4H2z"/><path d="M12 9.6v4.4"/><circle cx="12" cy="17.2" r="1.1" fill="currentColor" stroke="none"/>',
      text: '<path d="M5 5.6h14M5 10.4h14M5 15.2h9"/>'
    };

    function kindIcon(name) {
      const wrap = document.createElement('span');
      wrap.className = 'scan-kind-icon';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
        'stroke-linecap="round" stroke-linejoin="round">' + (KIND_ICONS[name] || KIND_ICONS.text) + '</svg>';
      return wrap;
    }

    /**
     * A thumbnail of what was read: the code, with a little of what surrounded
     * it, cut from the frame at the instant of the read and outlined.
     *
     * It is not decoration. Point a camera at a menu with four codes on it and
     * "here is a link" raises the obvious question of which one — this answers
     * it, and it makes the freeze believable rather than a sudden switch to a
     * page of text. It is a small square rather than the whole frame because
     * on a phone the whole frame was the single biggest thing pushing the
     * action below the fold.
     */
    function freezeFrame(source, width, height, corners) {
      const out = 220;
      const c = document.createElement('canvas');
      c.width = c.height = out;
      const g = c.getContext('2d');

      let side, sx, sy;
      if (corners && corners.length === 4) {
        const xs = corners.map(function (pt) { return pt.x; });
        const ys = corners.map(function (pt) { return pt.y; });
        const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
        const y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
        side = Math.max(x1 - x0, y1 - y0) * 1.45;     // the code, plus its setting
        sx = (x0 + x1) / 2 - side / 2;
        sy = (y0 + y1) / 2 - side / 2;
      } else {
        side = Math.min(width, height);
        sx = (width - side) / 2;
        sy = (height - side) / 2;
      }
      side = Math.max(8, Math.min(side, Math.min(width, height)));
      sx = Math.max(0, Math.min(sx, width - side));
      sy = Math.max(0, Math.min(sy, height - side));

      g.fillStyle = '#05070c';
      g.fillRect(0, 0, out, out);
      try { g.drawImage(source, sx, sy, side, side, 0, 0, out, out); }
      catch (e) { return null; }

      if (corners && corners.length === 4) {
        const k = out / side;
        g.strokeStyle = '#f7c948';
        g.lineWidth = Math.max(2, out / 70);
        g.lineJoin = 'round';
        g.beginPath();
        corners.forEach(function (pt, i) {
          const x = (pt.x - sx) * k, y = (pt.y - sy) * k;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        });
        g.closePath();
        g.stroke();
      }
      return c;
    }

    /** Two lines on the technique used, for anyone who wants them. */
    function readMeta(got) {
      if (got.version) {
        return 'Version ' + got.version + ' · level ' + got.ecLevel + ' · mask ' + got.mask +
          (got.corrected ? ' · ' + got.corrected + ' damaged codeword' + (got.corrected === 1 ? '' : 's') + ' repaired' : '') +
          (got.mirrored ? ' · mirrored' : '');
      }
      return got.native ? 'Read with the browser’s built-in detector' : '';
    }

    /**
     * What was read, where the camera was.
     *
     * The shape is deliberate: what it is, then whether it is safe, then the
     * one thing you probably want to do, and only then the detail. The old
     * card led with a table of fields and buried the action under it.
     */
    function showResult(got, source, shot) {
      state.last = got.text;
      state.misses = 0;
      const info = classifyPayload(got.text);

      result.textContent = '';
      const card = el('div', 'scan-card');

      /* what it is, with the thing it was read from beside it */
      const head = el('div', 'scan-head');
      head.appendChild(kindIcon(info.icon));
      const headText = el('div', 'scan-head-text');
      headText.appendChild(el('span', 'scan-kind',
        info.kind + (source === 'image' ? ' · from your picture' : '')));
      headText.appendChild(el('strong', 'scan-headline', info.headline || got.text));
      if (info.sub && info.sub !== info.headline) {
        headText.appendChild(el('span', 'scan-sub', info.sub));
      }
      head.appendChild(headText);
      if (shot) {
        const figure = el('div', 'scan-shot');
        shot.className = 'scan-shot-img';
        shot.setAttribute('role', 'img');
        shot.setAttribute('aria-label', 'The code that was read, cut from the frame it was read in');
        figure.appendChild(shot);
        head.appendChild(figure);
      }
      card.appendChild(head);

      /* whether it is safe */
      if (info.warn) card.appendChild(el('p', 'scan-warn', info.warn));
      (info.notes || []).forEach(function (n) { card.appendChild(el('p', 'scan-note', n)); });
      if (info.aside) card.appendChild(el('p', 'scan-aside', info.aside));

      /* the one thing you probably want to do */
      const doRow = el('div', 'scan-do');
      if (info.link && info.linkLabel) {
        const a = el('a', 'btn-primary scan-go', info.linkLabel);
        a.href = info.link;
        a.rel = 'noopener noreferrer nofollow';
        a.target = '_blank';
        doRow.appendChild(a);
      } else if (info.download) {
        doRow.appendChild(downloadButton(info.downloadLabel || 'Save the file',
          info.download.name, function () {
            return new Blob([info.download.body], { type: info.download.type });
          }, 'btn-primary scan-go'));
      } else if (info.copy) {
        const b = copyButton(function () { return info.copy.value; }, info.copy.label);
        b.className = 'btn-primary scan-go';
        doRow.appendChild(b);
      }
      /* Copying the whole payload is always available, and is the fallback
         when a kind has no action of its own — but not twice: on plain text
         the primary action already copies exactly this. */
      const primaryCopiesAll = info.copy && info.copy.value === got.text;
      if (!primaryCopiesAll) {
        const copyAll = copyButton(function () { return got.text; },
          doRow.children.length ? 'Copy the code' : 'Copy the text');
        copyAll.className = doRow.children.length ? 'btn-ghost' : 'btn-primary scan-go';
        doRow.appendChild(copyAll);
      }
      if (info.download && info.link) {
        doRow.appendChild(downloadButton('Save ' + info.download.name.split('.').pop().toUpperCase(),
          info.download.name, function () {
            return new Blob([info.download.body], { type: info.download.type });
          }));
      }
      card.appendChild(doRow);

      /* the detail */
      if (info.fields && info.fields.length) {
        const grid = el('div', 'stat-grid scan-facts');
        info.fields.forEach(function (f) {
          const r = el('div', 'stat-row');
          r.appendChild(el('span', 'stat-key', f[0]));
          r.appendChild(el('span', 'stat-val', f[1]));
          grid.appendChild(r);
        });
        card.appendChild(grid);
      }

      const raw = el('details', 'scan-raw');
      raw.appendChild(el('summary', null, 'Exactly what the code contains'));
      const pre = el('pre', 'scan-text');
      pre.textContent = got.text;
      raw.appendChild(pre);
      const meta = readMeta(got);
      if (meta) raw.appendChild(el('p', 'scan-meta', meta));
      card.appendChild(raw);

      result.appendChild(card);
      setMode('result');
      note('', '');

      /* Bring the answer into view.
         The site header is sticky, so "top is above zero" is not the same as
         "you can see it": someone who had scrolled a little got a result
         whose first 50px sat under the header, which is the bug this whole
         change is about. Measure the header rather than encoding its height,
         since it is a different size on a phone. */
      const headerHeight = function () {
        const h = document.querySelector('.site-header');
        if (!h) return 0;
        const box = h.getBoundingClientRect();
        return getComputedStyle(h).position === 'sticky' ? box.height : 0;
      };
      const clear = headerHeight() + 12;
      const top = stage.getBoundingClientRect().top;
      if (top < clear || top > window.innerHeight * 0.4) {
        const want = Math.max(0, top + window.scrollY - clear);
        window.scrollTo({ top: want, behavior: 'smooth' });
      }

      addHistory(got.text, info.kind);
      document.dispatchEvent(new CustomEvent('mvr:tool-used'));

      if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
    }

    function addHistory(text, kind) {
      if (state.history.length && state.history[0].text === text) return;
      state.history.unshift({ text: text, kind: kind, at: new Date() });
      state.history = state.history.slice(0, 10);
      renderHistory();
    }

    function renderHistory() {
      historyWrap.textContent = '';
      if (!state.history.length) return;
      const h = el('h2', null, 'This session');
      historyWrap.appendChild(h);
      historyWrap.appendChild(el('p', 'scan-history-note',
        'Kept in this tab only, and gone when you close it. Nothing is stored on the device or sent anywhere.'));
      const list = el('ul', 'scan-history-list');
      state.history.forEach(function (item) {
        const li = el('li');
        const time = item.at.toLocaleTimeString();
        li.appendChild(el('span', 'scan-history-kind', item.kind));
        const t = el('span', 'scan-history-text', item.text.length > 90 ? item.text.slice(0, 90) + '…' : item.text);
        li.appendChild(t);
        li.appendChild(el('span', 'scan-history-time', time));
        li.appendChild(copyButton(function () { return item.text; }, 'Copy'));
        list.appendChild(li);
      });
      historyWrap.appendChild(list);
      const clear = el('button', 'btn-ghost', 'Clear list');
      clear.type = 'button';
      clear.addEventListener('click', function () { state.history = []; renderHistory(); });
      historyWrap.appendChild(clear);
    }

    /* ---- wiring ---- */

    startBtn.addEventListener('click', function () {
      if (state.running) stop();
      else start(state.devices.length > 1 ? (camSel.value || null) : null);
    });

    /* Back to the camera that just worked, not to a cold start. */
    againBtn.addEventListener('click', function () {
      result.textContent = '';
      setMode('idle');
      start(state.deviceId || null);
    });
    camSel.addEventListener('change', function () { switchTo(camSel.value); });
    torchBtn.addEventListener('click', toggleTorch);

    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) scanFile(fileInput.files[0]);
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) scanFile(f);
    });
    document.addEventListener('paste', function (e) {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf('image') === 0) {
          scanFile(items[i].getAsFile());
          break;
        }
      }
    });

    /* A camera appearing or disappearing while the tool is open — plugging in
       a webcam, or another app releasing one — should change the list. */
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', function () {
        if (state.running && !state.busy) refreshDevices();
      });
    }

    window.addEventListener('pagehide', function () { if (state.running) stop(); });

    /* Leaving the tab releases the camera — a page has no business holding one
       it cannot show — and coming back opens the same camera again. Permission
       has already been given, so nothing is asked for twice. The old code only
       did the first half, so returning to the tab left a dead preview and the
       Start button doing the opposite of what it said. */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (!state.running) return;
        const id = state.deviceId;
        stop('Camera released while this tab was in the background. It comes back when you return.', 'note');
        state.resumeOnShow = true;
        state.resumeId = id;
      } else if (state.resumeOnShow) {
        state.resumeOnShow = false;
        start(state.resumeId || null);
      }
    });

    initNative();
    setMode('idle');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      startBtn.disabled = true;
      note('This browser will not give a page access to the camera. You can still scan a picture of a code below.', 'warn');
    } else if (!window.isSecureContext) {
      startBtn.disabled = true;
      note('Browsers only allow camera access on secure (https) pages. Scanning a picture of a code still works here.', 'warn');
    } else {
      note('Point the camera at a QR code, or scan a picture of one below.', 'note');
    }
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
  window.MVRTool.mountQRScanner = mountQRScanner;
  window.MVRTool.mountQRBulk = mountQRBulk;
  window.MVRTool.mountFile = mountFile;
  window.MVRTool._zipStore = zipStore;
})();
