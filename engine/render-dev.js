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

  function mountQR(spec, root, api) {
    /* The page used to pass (encodeQR, qrToSVG) as two functions. Accept that
       shape as well, so a cached copy of the old page still works. */
    const QR = (api && api.encode) ? api : window.QR;
    const io = root.querySelector('.tool-io');

    const state = {
      logo: null,          // { href, name }
      ecRaised: false,     // did adding a logo move the error correction up?
      swatchSample: null
    };

    /* ---- controls ---- */

    const layout = el('div', 'qr-layout');
    const controls = el('div', 'qr-controls');
    const stage = el('div', 'qr-stage');
    layout.appendChild(controls);
    layout.appendChild(stage);
    io.appendChild(layout);

    function panel(title, open) {
      const d = el('details', 'qr-panel');
      d.open = !!open;
      const s = el('summary', null, title);
      d.appendChild(s);
      const body = el('div', 'qr-panel-body');
      d.appendChild(body);
      controls.appendChild(d);
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
      const l = el('label', null, label);
      w.appendChild(l);
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
    function shapePicker(host, label, name, names, def, render) {
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
          schedule();
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

    /* content -------------------------------------------------- */

    const contentBody = panel('1. Content', true);
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

    /* shape ---------------------------------------------------- */

    const shapeBody = panel('2. Shape', false);

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
      QR.shapes.module, 'square', moduleSwatch);
    const framePick = shapePicker(shapeBody, 'Eye frame', 'eyeFrame',
      QR.shapes.eyeFrame, 'square', (n) => eyeSwatch({ eyeFrame: n }));
    const ballPick = shapePicker(shapeBody, 'Eye centre', 'eyeBall',
      QR.shapes.eyeBall, 'square', (n) => eyeSwatch({ eyeBall: n }));

    /* colour --------------------------------------------------- */

    const colourBody = panel('3. Colours', false);
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

    const logoBody = panel('4. Logo', false);
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
        state.logo = { href: String(reader.result), name: f.name };
        logoName.textContent = f.name;
        logoClear.hidden = false;
        /* A logo covers modules, so the code needs the error correction to
           spare. Medium plus a logo is the combination that fails, and it was
           the default, so move it up where the reader can see it happen and
           put it back if they want. */
        if (ecSel.value === 'L' || ecSel.value === 'M') {
          ecSel.value = 'H';
          state.ecRaised = true;
        }
        schedule();
      };
      reader.readAsDataURL(f);
    });
    logoClear.addEventListener('click', function () {
      state.logo = null;
      state.ecRaised = false;
      logoInput.value = '';
      logoName.textContent = 'No image - the code stays plain';
      logoClear.hidden = true;
      schedule();
    });
    logoBody.appendChild(logoInput);

    /* output --------------------------------------------------- */

    const outBody = panel('5. Output', false);
    const ecSel = selectControl(outBody, 'Error correction', 'ec',
      [['M', EC_LABELS.M], ['L', EC_LABELS.L], ['Q', EC_LABELS.Q], ['H', EC_LABELS.H]], 'M');
    const sizeSel = selectControl(outBody, 'PNG size', 'size',
      [['600', '600 px'], ['300', '300 px'], ['1200', '1200 px'], ['2400', '2400 px - print']], '600');
    const quietSel = selectControl(outBody, 'Quiet zone', 'quiet',
      [['4', '4 modules - standard'], ['2', '2 modules'], ['1', '1 module'], ['8', '8 modules']], '4');

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
      if (state.logo) {
        opts.logo = {
          href: state.logo.href,
          size: Number(logoSizeSel.value),
          padding: Number(logoPadSel.value),
          background: logoBgBox.checked ? (transparent ? '#ffffff' : lightIn.read()) : 'none'
        };
      }
      return opts;
    }

    /** Show or hide the controls that only apply to the current choices. */
    function syncControlVisibility() {
      const gradient = fillSel.value !== 'solid';
      dark2In.wrap.hidden = !gradient;
      angleSel.parentNode.hidden = fillSel.value !== 'linear';
      lightIn.wrap.hidden = transparentBox.checked;
      frameColIn.wrap.hidden = eyeMatchBox.checked;
      ballColIn.wrap.hidden = eyeMatchBox.checked;
      const hasLogo = !!state.logo;
      logoSizeSel.parentNode.hidden = !hasLogo;
      logoPadSel.parentNode.hidden = !hasLogo;
      logoBgBox.parentNode.hidden = !hasLogo;
    }

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
      const style = STYLE_KEYS
        .filter(function (k) {
          const v = k[1]();
          return v && (!styleDefaults || v !== styleDefaults[k[0]]);
        })
        .map(function (k) { return k[0] + ':' + k[1](); })
        .join(',');
      if (style) q.set('style', style);
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

      const style = params.get('style') || '';
      const seen = {};
      style.split(',').forEach(function (pair) {
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
     * Read the finished picture back.
     *
     * Checking the matrix only proves the encoder did its job. It says nothing
     * about the image that actually gets downloaded, where a logo sits on top
     * of real modules and can cover an alignment pattern the scanner needs to
     * find the grid at all. So the artwork is rasterised and put through the
     * same detector the scanner tool uses — twice, once at a comfortable size
     * and once small and rough, which is the difference between "it reads" and
     * "it reads on a business card in bad light".
     */
    function readBack(svg, text, modules) {
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
        const got = await readBack(svg, data, qr.size + trialOpts.quiet * 2);
        if (got && got.clean) return c;
      }
      return null;
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
      syncControlVisibility();

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
      const basic = staticNotes();
      paintVerdict('check', 'Reading the code back…', basic.notes);

      readBack(currentSVG, data, qr.size + opts.quiet * 2).then(async function (got) {
        if (stamp !== verifySeq) return;                 // a newer render won

        if (!got) {
          paintVerdict(basic.ok ? 'pass' : 'warn',
            'Encoded and checked against the standard', basic.notes);
          return;
        }

        if (!got.clean) {
          const notes = [
            state.logo
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
        if (state.ecRaised) {
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

  /* ---------------- QR scanner ---------------- */

  /**
   * What a scanned payload actually is, and what can usefully be done with it.
   * A scanner that only prints the raw string makes the reader do the parsing,
   * which is the one job they wanted done for them.
   */
  function classifyPayload(text) {
    const s = String(text || '');
    const lower = s.toLowerCase();

    if (/^wifi:/i.test(s)) {
      const field = (key) => {
        const m = new RegExp(key + ':((?:\\\\.|[^;])*);', 'i').exec(s);
        return m ? m[1].replace(/\\(.)/g, '$1') : '';
      };
      return {
        kind: 'WiFi network',
        fields: [
          ['Network (SSID)', field('S')],
          ['Security', ({ WPA: 'WPA / WPA2 / WPA3', WEP: 'WEP', nopass: 'Open, no password' })[field('T')] || field('T') || 'Unspecified'],
          ['Password', field('P') || '(none)'],
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
        warn: 'Check the payee and amount in your payment app before confirming. A payment code can be swapped on a printed sticker.',
        fields: [['Pay to', q.pa || ''], ['Payee name', q.pn || ''],
                 ['Amount', q.am ? (q.cu || 'INR') + ' ' + q.am : 'Not set'],
                 ['Note', q.tn || '']].filter((f) => f[1]),
        link: s
      };
    }

    if (/^bitcoin:/i.test(s)) {
      const addr = s.slice(8).split('?')[0];
      const amount = /[?&]amount=([^&]*)/i.exec(s);
      return {
        kind: 'Bitcoin payment request',
        warn: 'Check the address in your wallet before sending. Payments cannot be reversed.',
        fields: [['Address', addr], ['Amount', amount ? amount[1] + ' BTC' : 'Not set']],
        link: s
      };
    }

    if (/^mailto:/i.test(s)) {
      return { kind: 'Email', fields: [['To', s.slice(7).split('?')[0]]], link: s };
    }
    if (/^(sms|smsto):/i.test(s)) {
      const rest = s.replace(/^(sms|smsto):/i, '');
      const parts = rest.split(':');
      return { kind: 'SMS', fields: [['Number', parts[0]], ['Message', parts.slice(1).join(':')]].filter((f) => f[1]) };
    }
    if (/^tel:/i.test(s)) {
      return { kind: 'Phone number', fields: [['Number', s.slice(4)]], link: s };
    }
    if (/^geo:/i.test(s)) {
      const c = s.slice(4).split(/[,;]/);
      return {
        kind: 'Map location',
        fields: [['Latitude', c[0]], ['Longitude', c[1] || '']],
        link: 'https://www.openstreetmap.org/?mlat=' + encodeURIComponent(c[0]) + '&mlon=' + encodeURIComponent(c[1] || '')
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
        fields: [['Goes to', host], ['Full address', s]],
        notes: notes,
        link: safe ? s : null
      };
    }

    if (/^(javascript|data|vbscript|file):/i.test(lower)) {
      return {
        kind: 'Suspicious link',
        warn: 'This code contains a script or file address rather than an ordinary link. Nothing here will open it. Codes like this are used to attack the device that reads them.',
        fields: [['Content', s]]
      };
    }

    return { kind: 'Plain text', fields: [], link: null };
  }

  function mountQRScanner(spec, root, api) {
    const QR = (api && api.encode) ? api : window.QR;
    const Detect = window.QRDetect;
    const io = root.querySelector('.tool-io');

    const state = {
      stream: null, track: null, running: false, native: null,
      devices: [], deviceIndex: 0, torchOn: false, last: '', history: []
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
    reticle.innerHTML = '<span></span><span></span><span></span><span></span>';
    const placeholder = el('div', 'scan-placeholder');
    placeholder.appendChild(el('p', null, 'The camera preview appears here. Nothing is recorded, and no frame leaves your device.'));
    frame.appendChild(video);
    frame.appendChild(reticle);
    frame.appendChild(placeholder);
    stage.appendChild(frame);

    const controls = el('div', 'io-actions scan-controls');
    const startBtn = el('button', 'btn-primary', 'Start camera');
    startBtn.type = 'button';
    const switchBtn = el('button', 'btn-ghost', 'Switch camera');
    switchBtn.type = 'button';
    switchBtn.hidden = true;
    const torchBtn = el('button', 'btn-ghost', 'Torch');
    torchBtn.type = 'button';
    torchBtn.hidden = true;
    controls.appendChild(startBtn);
    controls.appendChild(switchBtn);
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

    /* ---- result ---- */

    const result = el('div', 'scan-result');
    io.appendChild(result);

    const historyWrap = el('section', 'scan-history');
    io.appendChild(historyWrap);

    /* ---- scanning ---- */

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    /** Read one frame. Uses the browser's own detector where there is one. */
    async function readFrame(source, width, height) {
      if (state.native) {
        try {
          const found = await state.native.detect(source);
          if (found && found.length) return { text: found[0].rawValue, native: true };
        } catch (e) { state.native = null; }
      }
      const max = 640;
      const scale = Math.min(1, max / Math.max(width, height));
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return Detect.scan(data);
    }

    let looping = false;
    async function loop() {
      if (!state.running) { looping = false; return; }
      looping = true;
      if (video.readyState >= 2 && video.videoWidth) {
        try {
          const got = await readFrame(video, video.videoWidth, video.videoHeight);
          if (got && got.text && got.text !== state.last) showResult(got, 'camera');
        } catch (e) { /* a dropped frame is not worth reporting */ }
      }
      requestAnimationFrame(loop);
    }

    async function start() {
      if (state.running) return stop();
      note('Asking for camera permission…', 'note');
      try {
        state.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      } catch (e) {
        const name = e && e.name;
        note(
          name === 'NotAllowedError'
            ? 'Camera permission was refused. Allow it in the address bar, or scan a picture of the code below instead.'
            : name === 'NotFoundError'
              ? 'No camera was found on this device. You can still scan a picture of a code below.'
              : 'The camera could not be started: ' + (e && e.message ? e.message : 'unknown error') +
                '. Note that browsers only allow the camera on secure (https) pages.',
          'error');
        return;
      }

      video.srcObject = state.stream;
      state.track = state.stream.getVideoTracks()[0];
      await video.play().catch(function () {});
      frame.classList.add('is-live');
      placeholder.hidden = true;
      state.running = true;
      startBtn.textContent = 'Stop camera';
      note('Point the camera at a QR code. It reads automatically.', 'note');

      if ('BarcodeDetector' in window && !state.native) {
        try {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          if (formats.indexOf('qr_code') >= 0) state.native = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch (e) { state.native = null; }
      }

      try {
        const caps = state.track.getCapabilities ? state.track.getCapabilities() : {};
        torchBtn.hidden = !caps.torch;
        const devices = await navigator.mediaDevices.enumerateDevices();
        state.devices = devices.filter((d) => d.kind === 'videoinput');
        switchBtn.hidden = state.devices.length < 2;
      } catch (e) { /* capability probing is optional */ }

      if (!looping) loop();
    }

    function stop() {
      state.running = false;
      if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
      state.stream = null;
      state.track = null;
      video.srcObject = null;
      frame.classList.remove('is-live');
      placeholder.hidden = false;
      startBtn.textContent = 'Start camera';
      torchBtn.hidden = true;
      switchBtn.hidden = true;
      note('Camera stopped.', 'note');
    }

    async function switchCamera() {
      if (!state.devices.length) return;
      state.deviceIndex = (state.deviceIndex + 1) % state.devices.length;
      const id = state.devices[state.deviceIndex].deviceId;
      if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
      try {
        state.stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: id } }, audio: false });
        video.srcObject = state.stream;
        state.track = state.stream.getVideoTracks()[0];
        await video.play().catch(function () {});
        state.torchOn = false;
        const caps = state.track.getCapabilities ? state.track.getCapabilities() : {};
        torchBtn.hidden = !caps.torch;
      } catch (e) {
        note('That camera could not be opened.', 'error');
      }
    }

    async function toggleTorch() {
      if (!state.track) return;
      state.torchOn = !state.torchOn;
      try {
        await state.track.applyConstraints({ advanced: [{ torch: state.torchOn }] });
        torchBtn.classList.toggle('is-active', state.torchOn);
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

    function scanFile(file) {
      if (!file || !/^image\//.test(file.type)) {
        note('That file is not an image.', 'error');
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = async function () {
        URL.revokeObjectURL(url);
        let got = null;
        // A code that is small in a large photo survives a second look at
        // full resolution, so try both before giving up.
        for (const max of [640, 1280, 2000]) {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          if (state.native) {
            try {
              const found = await state.native.detect(canvas);
              if (found && found.length) { got = { text: found[0].rawValue, native: true }; break; }
            } catch (e) { state.native = null; }
          }
          got = Detect.scan(ctx.getImageData(0, 0, canvas.width, canvas.height));
          if (got) break;
        }
        if (got) showResult(got, 'image');
        else note('No QR code was found in that image. A sharper picture, or one with the whole code and a little space around it, usually does it.', 'warn');
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        note('That image could not be opened.', 'error');
      };
      img.src = url;
    }

    /* ---- showing what was read ---- */

    function showResult(got, source) {
      state.last = got.text;
      const info = classifyPayload(got.text);

      result.textContent = '';
      const card = el('div', 'scan-card');

      const head = el('div', 'scan-card-head');
      head.appendChild(el('span', 'scan-kind', info.kind));
      head.appendChild(el('span', 'scan-source', source === 'camera' ? 'Read from the camera' : 'Read from an image'));
      card.appendChild(head);

      if (info.warn) {
        const w = el('p', 'scan-warn', info.warn);
        card.appendChild(w);
      }
      (info.notes || []).forEach(function (n) {
        card.appendChild(el('p', 'scan-note', n));
      });

      if (info.fields && info.fields.length) {
        const grid = el('div', 'stat-grid');
        info.fields.forEach(function (f) {
          const r = el('div', 'stat-row');
          r.appendChild(el('span', 'stat-key', f[0]));
          r.appendChild(el('span', 'stat-val', f[1]));
          grid.appendChild(r);
        });
        card.appendChild(grid);
      }

      const pre = el('pre', 'scan-text');
      pre.textContent = got.text;
      card.appendChild(pre);

      const actions = el('div', 'io-actions scan-actions');
      actions.appendChild(copyButton(function () { return got.text; }, 'Copy'));

      if (info.link) {
        const a = el('a', 'btn-download', info.kind === 'Website address' ? 'Open link' : 'Open');
        a.href = info.link;
        a.rel = 'noopener noreferrer nofollow';
        a.target = '_blank';
        actions.appendChild(a);
      }
      if (info.download) {
        actions.appendChild(downloadButton('Save ' + (info.download.name.split('.').pop().toUpperCase()),
          info.download.name, function () {
            return new Blob([info.download.body], { type: info.download.type });
          }));
      }
      card.appendChild(actions);

      if (got.version) {
        const meta = el('p', 'scan-meta',
          'Version ' + got.version + ', level ' + got.ecLevel + ', mask ' + got.mask +
          (got.corrected ? ' — ' + got.corrected + ' damaged codeword' + (got.corrected === 1 ? '' : 's') + ' repaired' : '') +
          (got.mirrored ? ' — mirrored' : ''));
        card.appendChild(meta);
      } else if (got.native) {
        card.appendChild(el('p', 'scan-meta', 'Read with the browser’s built-in detector'));
      }

      result.appendChild(card);
      note('', '');
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

    startBtn.addEventListener('click', start);
    switchBtn.addEventListener('click', switchCamera);
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
    window.addEventListener('pagehide', function () { if (state.running) stop(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state.running) stop();
    });

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
  window.MVRTool.mountFile = mountFile;
  window.MVRTool._zipStore = zipStore;
})();
