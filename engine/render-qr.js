/* ============================================================
   QR renderers, for the three /qr/ tools:
     mountQR         text in   -> scannable QR, SVG or PNG
     mountQRBulk     a list in -> many codes, as a ZIP or a print sheet
     mountQRScanner  camera or picture in -> what the code says
   Moved here unchanged from render-dev.js on 6 October 2026, so the
   developer and text pages no longer download the QR code and the QR
   pages no longer download the developer tools. The helpers at the top
   (el … renderStats) and loadZip below are copies of render-dev.js's,
   kept identical: build/tests/dev-fixes.js fails if one drifts.
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
    },
    paypal: {
      label: 'PayPal.Me payment',
      fields: [['user', 'PayPal.Me name', 'text', ''], ['am', 'Amount, optional', 'text', ''],
               ['cur', 'Currency, optional (GBP, EUR, USD…)', 'text', '']],
      /* paypal.me/name, or paypal.me/name/12.50GBP with an amount: the
         amount and its currency code are one path segment. */
      ready: (v) => /^[A-Za-z0-9]{1,20}$/.test(String(v.user || '').trim().replace(/^.*paypal\.me\//i, '')),
      build: (v) => {
        const user = String(v.user).trim().replace(/^.*paypal\.me\//i, '');
        const am = String(v.am || '').trim().replace(/,/g, '.').replace(/[^\d.]/g, '');
        const cur = String(v.cur || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
        return 'https://paypal.me/' + user + (am ? '/' + am + cur : '');
      }
    },
    social: {
      label: 'Social profile',
      fields: [['net', 'Network', 'select', 'instagram'], ['handle', 'User name', 'text', '']],
      options: {
        net: [['instagram', 'Instagram'], ['x', 'X'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'],
              ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['threads', 'Threads'], ['github', 'GitHub']]
      },
      ready: (v) => !!String(v.handle || '').trim().replace(/^@/, ''),
      build: (v) => {
        const h = encodeURIComponent(String(v.handle).trim().replace(/^@/, ''));
        return ({
          instagram: 'https://www.instagram.com/' + h,
          x: 'https://x.com/' + h,
          facebook: 'https://www.facebook.com/' + h,
          linkedin: 'https://www.linkedin.com/in/' + h,
          tiktok: 'https://www.tiktok.com/@' + h,
          youtube: 'https://www.youtube.com/@' + h,
          threads: 'https://www.threads.net/@' + h,
          github: 'https://github.com/' + h
        })[v.net] || 'https://www.instagram.com/' + h;
      }
    },
    appstore: {
      label: 'App store link',
      /* One code holds one address. Sending iPhones to one store and Android
         phones to the other needs a server that looks at each scan, which
         this site does not run, so the store is chosen here. */
      fields: [['store', 'Store', 'select', 'apple'], ['app', 'App ID (Apple) or package name (Google Play)', 'text', '']],
      options: { store: [['apple', 'Apple App Store'], ['google', 'Google Play']] },
      ready: (v) => v.store === 'google'
        ? /^[A-Za-z][\w]*(\.[A-Za-z_][\w]*)+$/.test(String(v.app || '').trim())
        : /^(id)?\d{6,12}$/i.test(String(v.app || '').trim()),
      build: (v) => v.store === 'google'
        ? 'https://play.google.com/store/apps/details?id=' + String(v.app).trim()
        : 'https://apps.apple.com/app/id' + String(v.app).trim().replace(/^id/i, '')
    },
    file: {
      label: 'PDF or MP3 link',
      /* The code carries the file's address, not the file: it has to be
         online already, somewhere you control. */
      fields: [['url', 'Address of the PDF or MP3', 'text', 'https://www.example.com/menu.pdf']],
      ready: (v) => !!String(v.url || '').trim(),
      build: (v) => {
        const s = String(v.url).trim();
        return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s;
      }
    },
    vcard4: {
      label: 'Contact card (vCard 4.0)',
      fields: [['first', 'First name', 'text', ''], ['last', 'Last name', 'text', ''],
               ['org', 'Organisation', 'text', ''], ['title', 'Job title', 'text', ''],
               ['phone', 'Mobile', 'text', ''], ['email', 'Email', 'text', ''],
               ['site', 'Website', 'text', ''], ['street', 'Street', 'text', ''],
               ['city', 'City', 'text', ''], ['zip', 'Postcode', 'text', ''], ['country', 'Country', 'text', '']],
      ready: (v) => !!(v.first || v.last || v.org),
      /* RFC 6350: CRLF line ends, FN required, a telephone number as a tel: URI. */
      build: (v) => [
        'BEGIN:VCARD', 'VERSION:4.0',
        'FN:' + escCard([v.first, v.last].filter(Boolean).join(' ') || v.org),
        'N:' + escCard(v.last) + ';' + escCard(v.first) + ';;;',
        v.org ? 'ORG:' + escCard(v.org) : '',
        v.title ? 'TITLE:' + escCard(v.title) : '',
        v.phone ? 'TEL;VALUE=uri;TYPE=cell:tel:' + digitsOnly(v.phone) : '',
        v.email ? 'EMAIL:' + v.email : '',
        v.site ? 'URL:' + v.site : '',
        (v.street || v.city || v.zip || v.country)
          ? 'ADR;TYPE=work:;;' + escCard(v.street) + ';' + escCard(v.city) + ';;' + escCard(v.zip) + ';' + escCard(v.country)
          : '',
        'END:VCARD'
      ].filter(Boolean).join('\r\n')
    }
  };

  /* The order the content types are offered in: the everyday ones first. */
  const TYPE_ORDER = ['url', 'text', 'file', 'wifi', 'vcard', 'vcard4', 'mecard', 'email', 'sms', 'whatsapp',
    'tel', 'social', 'appstore', 'geo', 'event', 'upi', 'paypal', 'bitcoin'];

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

  /* ---------------- small shared pieces ---------------- */

  /* Remembered settings: one versioned key per tool, in this browser only.
     Every read and write is guarded, because storage can be switched off,
     full, or (in a private window) gone on the next visit. */
  const STORE_KEYS = {
    gen: '1234tools-qr-generator-v1',
    designs: '1234tools-qr-designs-v1',
    bulk: '1234tools-qr-bulk-v1',
    scanner: '1234tools-qr-scanner-v1',
    scans: '1234tools-qr-scan-history-v1'
  };
  function readStore(key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) { return false; }
  }

  /** A script of this site's, fetched the first time it is needed. */
  const scriptLoads = {};
  function loadScript(rel, ready) {
    if (ready()) return Promise.resolve();
    if (!scriptLoads[rel]) {
      scriptLoads[rel] = new Promise(function (resolve, reject) {
        const s = document.createElement('script');
        s.src = (window.__BASE__ || '/') + rel;
        s.onload = function () { ready() ? resolve() : reject(new Error(rel + ' loaded but did not start')); };
        s.onerror = function () { delete scriptLoads[rel]; reject(new Error(rel + ' could not be loaded')); };
        document.head.appendChild(s);
      });
    }
    return scriptLoads[rel];
  }
  const loadExport = () => loadScript('engine/qr-export.js', function () { return !!window.QRExport; });

  /* A file's extension from what was actually made, not from what was asked for. */
  const EXT_FOR = {
    'image/svg+xml': 'svg', 'image/png': 'png', 'application/pdf': 'pdf',
    'application/postscript': 'eps', 'application/zip': 'zip', 'text/csv': 'csv', 'text/plain': 'txt'
  };
  const extOf = (blob) => EXT_FOR[String(blob && blob.type || '').split(';')[0]] || 'bin';

  /** A download button whose file name follows the blob it produced. */
  function typedDownload(label, base, makeBlob, cls) {
    let made = null;
    return downloadButton(label, function () { return (typeof base === 'function' ? base() : base) + '.' + extOf(made); },
      async function () { made = await makeBlob(); return made; }, cls);
  }

  /** Let the page paint and take input before the next slice of work. */
  const yieldFrame = () => new Promise(function (r) { setTimeout(r, 0); });

  /**
   * A progress bar with a Cancel button, for anything that may take more
   * than a moment. `start` returns a token whose `cancelled` flag the work
   * checks between slices; the bar only appears after 300 ms, so quick jobs
   * do not flash it.
   */
  function progressUI(host) {
    const wrap = el('div', 'qr-progress');
    wrap.hidden = true;
    const label = el('span', 'qr-progress-label', '');
    const bar = el('progress', 'qr-progress-bar');
    bar.max = 1; bar.value = 0;
    const cancel = el('button', 'btn-ghost qr-progress-cancel', 'Cancel');
    cancel.type = 'button';
    wrap.appendChild(label); wrap.appendChild(bar); wrap.appendChild(cancel);
    host.appendChild(wrap);
    let token = null, timer = 0;
    cancel.addEventListener('click', function () { if (token) token.cancelled = true; });
    return {
      el: wrap,
      start: function (text) {
        if (token) token.cancelled = true;
        token = { cancelled: false };
        label.textContent = text || 'Working…';
        bar.value = 0;
        clearTimeout(timer);
        timer = setTimeout(function () { wrap.hidden = false; }, 300);
        return token;
      },
      set: function (done, total, text) {
        bar.max = Math.max(1, total);
        bar.value = done;
        if (text) label.textContent = text;
      },
      end: function (t) {
        if (t && t !== token) return;
        clearTimeout(timer);
        wrap.hidden = true;
        token = null;
      }
    };
  }

  /** The width and height an SVG of ours declares in its viewBox. */
  function svgBox(svg) {
    const m = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);
    return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 1, h: 1 };
  }

  /**
   * A logo as raw pixels, for the PDF and EPS writers. Capped at 512 pixels
   * on its long side, which is well past print resolution at any size a
   * logo occupies inside a code.
   */
  function rasterImage(href) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        let w = img.naturalWidth || 512, h = img.naturalHeight || 512;
        const k = Math.min(1, 512 / Math.max(w, h));
        w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data;
        const rgb = new Uint8Array(w * h * 3), alpha = new Uint8Array(w * h);
        let opaque = true;
        for (let i = 0; i < w * h; i++) {
          const a = d[i * 4 + 3];
          alpha[i] = a;
          if (a < 255) opaque = false;
          /* un-premultiplied already; a fully clear pixel's colour does not matter */
          rgb[i * 3] = d[i * 4]; rgb[i * 3 + 1] = d[i * 4 + 1]; rgb[i * 3 + 2] = d[i * 4 + 2];
        }
        resolve({ w: w, h: h, rgb: rgb, alpha: opaque ? null : alpha });
      };
      img.onerror = function () { resolve(null); };
      img.src = href;
    });
  }

  /** Rasters for every <image> an SVG of ours carries, keyed by href. */
  async function imagesOf(svg) {
    const out = {};
    const re = /<image\b[^>]*\bhref="([^"]+)"/g;
    let m;
    while ((m = re.exec(svg))) {
      const href = m[1].replace(/&amp;/g, '&');
      if (!out[href]) { const r = await rasterImage(href); if (r) out[href] = r; }
    }
    return out;
  }

  /* ---------------- frames: a call to action around the code ---------------- */

  const FRAME_STYLES = [
    ['none', 'No frame'], ['banner', 'Border, label below'], ['banner-top', 'Border, label above'],
    ['bubble', 'Speech bubble below'], ['outline', 'Thin border, label inside'], ['text', 'Label only, below']
  ];

  const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n3 = (v) => String(Math.round(v * 1000) / 1000);

  /** A rounded rectangle as path data, like qr.bundle.js draws its eyes. */
  function roundRect(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    if (!r) return 'M' + n3(x) + ' ' + n3(y) + 'H' + n3(x + w) + 'V' + n3(y + h) + 'H' + n3(x) + 'Z';
    return 'M' + n3(x + r) + ' ' + n3(y) + 'H' + n3(x + w - r) + 'A' + n3(r) + ' ' + n3(r) + ' 0 0 1 ' + n3(x + w) + ' ' + n3(y + r) +
      'V' + n3(y + h - r) + 'A' + n3(r) + ' ' + n3(r) + ' 0 0 1 ' + n3(x + w - r) + ' ' + n3(y + h) +
      'H' + n3(x + r) + 'A' + n3(r) + ' ' + n3(r) + ' 0 0 1 ' + n3(x) + ' ' + n3(y + h - r) +
      'V' + n3(y + r) + 'A' + n3(r) + ' ' + n3(r) + ' 0 0 1 ' + n3(x + r) + ' ' + n3(y) + 'Z';
  }

  /* Label widths in Helvetica Bold units (Arial has the same widths), so the
     label is sized to fit before any font has loaded. */
  function labelWidth(text, size) {
    if (window.QRExport) return window.QRExport.textWidth(text, true, size);
    return String(text).length * 0.62 * size;
  }

  /**
   * Put a frame and a label round a finished code.
   *
   * The code keeps its own quiet zone inside the frame, so the frame never
   * eats into the margin a scanner needs; the whole thing is then read back
   * like any other code. Units are modules, as in the code's own SVG.
   */
  function frameSVG(codeSvg, frame, scale, light) {
    const style = frame && frame.style;
    if (!style || style === 'none') return codeSvg;
    const box = svgBox(codeSvg);
    const D = box.w;
    const inner = codeSvg.replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const fc = frame.colour || '#06080f', tc = frame.textColour || '#ffffff';
    const bg = light && light !== 'none' ? light : null;
    const label = String(frame.text || '').trim();
    const b = Math.max(0.8, D * 0.03);                  // border
    const band = Math.max(4.2, D * 0.17);                // label band
    let font = band * 0.52;
    const r = D * 0.05;
    let W = D, H = D, art = '', code = { x: 0, y: 0 }, text = null;

    const fit = function (maxW) {
      if (!label) return;
      const w = labelWidth(label, font);
      if (w > maxW) font = font * maxW / w;
    };

    if (style === 'banner' || style === 'banner-top') {
      W = D + 2 * b; H = D + 2 * b + band;
      const top = style === 'banner-top';
      code = { x: b, y: top ? b + band : b };
      const hole = roundRect(code.x, code.y, D, D, 0);
      /* no background of its own: the code brings one, and a square behind
         the frame would show at its rounded corners */
      art += '<path d="' + roundRect(0, 0, W, H, r) + hole + '" fill="' + fc + '" fill-rule="evenodd"/>';
      fit(W - 4 * b);
      text = { x: W / 2, y: (top ? b + band / 2 : b + D + (band + b) / 2) + font * 0.36, fill: tc };
    } else if (style === 'bubble') {
      const gap = D * 0.02, tri = band * 0.38, pw = D * 0.86;
      W = D; H = D + gap + tri + band;
      const py = D + gap + tri;
      if (bg) art += '<rect width="' + n3(W) + '" height="' + n3(H) + '" fill="' + bg + '"/>';
      art += '<path d="' + roundRect((W - pw) / 2, py, pw, band, band / 2) +
        'M' + n3(W / 2 - tri) + ' ' + n3(py + 0.01) + 'L' + n3(W / 2) + ' ' + n3(py - tri) + 'L' + n3(W / 2 + tri) + ' ' + n3(py + 0.01) + 'Z" fill="' + fc + '"/>';
      fit(pw - band);
      text = { x: W / 2, y: py + band / 2 + font * 0.36, fill: tc };
    } else if (style === 'outline') {
      const t = Math.max(0.5, D * 0.018);
      W = D + 2 * t; H = D + 2 * t + band * 0.9;
      code = { x: t, y: t };
      if (bg) art += '<path d="' + roundRect(t, t, W - 2 * t, H - 2 * t, Math.max(0, r - t)) + '" fill="' + bg + '"/>';
      art += '<path d="' + roundRect(0, 0, W, H, r) + roundRect(t, t, W - 2 * t, H - 2 * t, Math.max(0, r - t)) + '" fill="' + fc + '" fill-rule="evenodd"/>';
      fit(W - 6 * t - band * 0.4);
      text = { x: W / 2, y: t + D + band * 0.38 + font * 0.36, fill: fc };
    } else {
      W = D; H = D + band * 0.9;
      if (bg) art += '<rect width="' + n3(W) + '" height="' + n3(H) + '" fill="' + bg + '"/>';
      fit(W - band * 0.4);
      text = { x: W / 2, y: D + band * 0.36 + font * 0.36, fill: fc };
    }

    let out = '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.round(W * scale) + '" height="' + Math.round(H * scale) +
      '" viewBox="0 0 ' + n3(W) + ' ' + n3(H) + '">' + art +
      '<g transform="translate(' + n3(code.x) + ' ' + n3(code.y) + ')">' + inner + '</g>';
    if (text && label) {
      out += '<text x="' + n3(text.x) + '" y="' + n3(text.y) + '" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="' +
        n3(font) + '" text-anchor="middle" fill="' + text.fill + '">' + escXml(label) + '</text>';
    }
    return out + '</svg>';
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

  /** A slider with its value written beside it. `.value` reads as a string, like a select's. */
  function rangeControl(host, label, name, min, max, step, def, show) {
    const w = el('div', 'field qr-range');
    const id = 'qr-' + name;
    const l = el('label', null, label);
    l.setAttribute('for', id);
    const row = el('div', 'qr-range-row');
    const r = el('input');
    r.type = 'range';
    r.id = id;
    r.className = 'qr-range-input';
    r.min = String(min); r.max = String(max); r.step = String(step);
    r.value = String(def);
    r.dataset.name = name;
    const out = el('output', 'qr-range-value', show(def));
    out.setAttribute('for', id);
    r.addEventListener('input', function () { out.textContent = show(r.value); });
    r.addEventListener('change', function () { out.textContent = show(r.value); });
    row.appendChild(r); row.appendChild(out);
    w.appendChild(l); w.appendChild(row);
    host.appendChild(w);
    /* setting .value from code (a shared link, a saved design) shows too */
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(r, 'value', {
      get: function () { return desc.get.call(r); },
      set: function (v) { desc.set.call(r, v); out.textContent = show(desc.get.call(r)); }
    });
    return r;
  }

  /** A whole-number box with a unit after it, kept inside min..max on change. */
  function numberControl(host, label, name, min, max, def, unit) {
    const w = el('div', 'field');
    const id = 'qr-' + name;
    const l = el('label', null, label);
    l.setAttribute('for', id);
    const row = el('div', 'qr-number-row');
    const n = el('input', 'control qr-number');
    n.type = 'number';
    n.id = id;
    n.inputMode = 'numeric';
    n.min = String(min); n.max = String(max); n.step = '1';
    n.value = String(def);
    n.dataset.name = name;
    n.addEventListener('change', function () {
      const v = Math.round(Number(n.value));
      if (!isFinite(v) || v < min) n.value = String(min);
      else if (v > max) n.value = String(max);
      else n.value = String(v);
    });
    row.appendChild(n);
    if (unit) row.appendChild(el('span', 'qr-unit', unit));
    w.appendChild(l); w.appendChild(row);
    host.appendChild(w);
    return n;
  }
  const clampNum = (v, min, max, def) => { const n = Math.round(Number(v)); return isFinite(n) && n >= min && n <= max ? n : (isFinite(n) ? Math.min(max, Math.max(min, n)) : def); };

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
    /* Any angle, not four presets: 0 runs left to right, 90 top to bottom. */
    const angleSel = rangeControl(colourBody, 'Gradient angle', 'angle', 0, 359, 1, 45, (v) => v + '°');
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

    /* Width of the code the logo takes, 10% to 35%. The read-back under the
       preview says at once whether the size chosen still scans. */
    const logoSizeSel = rangeControl(logoBody, 'Logo size', 'logosize', 0.10, 0.35, 0.01, 0.22,
      (v) => Math.round(Number(v) * 100) + '% of the width');
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
      setLogo(null);
      schedule();
    });
    /** Put a logo back (from a saved design) or take it away, without a file pick. */
    function setLogo(logo) {
      store.logo = logo ? { href: logo.href, name: logo.name || 'logo' } : null;
      store.ecRaised = false;
      logoInput.value = '';
      logoName.textContent = logo ? store.logo.name : 'No image - the code stays plain';
      logoClear.hidden = !logo;
    }
    logoBody.appendChild(logoInput);

    /* output --------------------------------------------------- */

    const outBody = qrPanel(host, '5. Output', false);
    const ecSel = selectControl(outBody, 'Error correction', 'ec',
      [['M', EC_LABELS.M], ['L', EC_LABELS.L], ['Q', EC_LABELS.Q], ['H', EC_LABELS.H]], 'M');
    const sizeSel = numberControl(outBody, 'PNG width', 'size', 64, 4096, 600, 'px');
    /* Written into the PNG (its pHYs chunk) and used for the PDF and EPS page
       size, so all three open at the same physical size. */
    const dpiSel = numberControl(outBody, 'Resolution', 'dpi', 72, 1200, 300, 'dpi');
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
      angleSel.closest('.field').hidden = fillSel.value !== 'linear';
      lightIn.wrap.hidden = transparentBox.checked;
      frameColIn.wrap.hidden = eyeMatchBox.checked;
      ballColIn.wrap.hidden = eyeMatchBox.checked;
      const hasLogo = !!store.logo;
      logoSizeSel.closest('.field').hidden = !hasLogo;
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
      ecSel: ecSel, sizeSel: sizeSel, dpiSel: dpiSel, quietSel: quietSel,
      styleOptions: styleOptions, syncVisibility: syncVisibility, staticNotes: staticNotes,
      setLogo: setLogo
    };
  }

  /**
   * The frame and label panel, shared by both generators for the same reason
   * as the style panels above: a frame called "Border, label below" should be
   * the same frame whether it goes round one code or four hundred.
   */
  function qrFrameControls(host, title) {
    const frameBody = qrPanel(host, title, false);
    const cardSel = selectControl(frameBody, 'Frame', 'frame', FRAME_STYLES, 'none');
    const labelWrap = el('div', 'field');
    const labelLab = el('label', null, 'Label');
    labelLab.setAttribute('for', 'qr-label');
    const labelIn = el('input', 'control');
    labelIn.type = 'text';
    labelIn.id = 'qr-label';
    labelIn.maxLength = 40;
    labelIn.value = 'SCAN ME';
    labelWrap.appendChild(labelLab);
    labelWrap.appendChild(labelIn);
    frameBody.appendChild(labelWrap);
    const cardColIn = colourControl(frameBody, 'Frame colour', 'cardcol', '#06080f');
    const labelColIn = colourControl(frameBody, 'Label colour', 'labelcol', '#ffffff');

    function frameOf() {
      return { style: cardSel.value, text: labelIn.value, colour: cardColIn.read(), textColour: labelColIn.read() };
    }
    function syncFrame() {
      const st = cardSel.value;
      labelWrap.hidden = st === 'none';
      cardColIn.wrap.hidden = st === 'none';
      labelColIn.wrap.hidden = st === 'none' || st === 'outline' || st === 'text';
    }

    return {
      body: frameBody, cardSel: cardSel, labelWrap: labelWrap, labelIn: labelIn,
      cardColIn: cardColIn, labelColIn: labelColIn, frameOf: frameOf, syncFrame: syncFrame
    };
  }

  /** The PDF and EPS set a label in Helvetica; say so when it cannot show it. */
  function frameFontNote(frame, notes) {
    if (frame.style !== 'none' && frame.text && window.QRExport && !window.QRExport.fitsWinAnsi(frame.text)) {
      notes.push('The PDF and EPS set the label in Helvetica, which has no letters for some of these characters, so they show as question marks there. The SVG and PNG show the label as typed.');
    }
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
      /* A framed code is taller than it is wide; the viewBox is in modules
         either way, so the frame and its label are rasterised at the same
         density as the code inside them. */
      const box = /viewBox=/.test(svg) ? svgBox(svg) : { w: modules, h: modules };
      img.onload = function () {
        const at = function (pxPerModule) {
          const pw = Math.round(box.w * pxPerModule), ph = Math.round(box.h * pxPerModule);
          const c = document.createElement('canvas');
          c.width = pw; c.height = ph;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.fillStyle = '#ffffff';          // whatever is behind a transparent code
          ctx.fillRect(0, 0, pw, ph);
          ctx.drawImage(img, 0, 0, pw, ph);
          /* No inverted retry here: the scanner tool reads light-on-dark,
             but many phone scanners do not, so Verified still means "reads
             as an ordinary dark-on-light code". */
          const got = window.QRDetect.scan(ctx.getImageData(0, 0, pw, ph), { invert: false });
          return !!(got && got.text === text);
        };
        const clean = at(10);
        resolve({ clean: clean, rough: clean ? at(4) : false });
      };
      img.onerror = function () { resolve(null); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  /* Notes shown under the content fields where a type needs explaining. */
  const TYPE_NOTES = {
    appstore: 'A code holds one address, so it opens one store. Sending iPhones to one and Android phones to the other needs a server that looks at every scan, which this site does not run: make one code per store, or link to a page of your own that offers both.',
    file: 'The code carries the address of the file, not the file. Put the PDF or MP3 online somewhere you control first; this site does not host files.',
    vcard4: 'vCard 4.0 is the current standard (RFC 6350). Some older phones only read 3.0; if one will not save the contact, use the other contact type.',
    paypal: 'With an amount, the link opens PayPal with it filled in. The currency is a three-letter code such as GBP.'
  };

  function mountQR(spec, root, api) {
    /* i18n hook: a translated twin of this page (build-tools-hi.js) loads engine/i18n.js; English pages do not, so this is a no-op there */
    if (window.MVR_I18N) window.MVR_I18N.watch(root);
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
      TYPE_ORDER.map((k) => [k, QR_TYPES[k].label]), 'url');
    const fieldHost = el('div', 'gen-form gen-form-flush');
    contentBody.appendChild(fieldHost);
    const typeNote = el('p', 'qr-type-note');
    contentBody.appendChild(typeNote);

    let readers = [];
    function buildFields() {
      fieldHost.textContent = '';
      const type = QR_TYPES[typeSel.value];
      readers = type.fields.map(function (f) {
        const s = { key: f[0], label: f[1], type: f[2], default: f[3] };
        if (f[2] === 'select') {
          s.options = (type.options[f[0]] || []).map((o) => ({ value: o[0], label: o[1] }));
          s.default = f[3];
        }
        const b = buildField(s);
        fieldHost.appendChild(b.wrap);
        return b;
      });
      typeNote.textContent = TYPE_NOTES[typeSel.value] || '';
      typeNote.hidden = !TYPE_NOTES[typeSel.value];
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
    const ecSel = style.ecSel, sizeSel = style.sizeSel, dpiSel = style.dpiSel, quietSel = style.quietSel;
    const styleOptions = style.styleOptions;

    /* frame and label ----------------------------------------- */

    const frameUi = qrFrameControls(controls, '6. Frame and label');
    const cardSel = frameUi.cardSel, labelIn = frameUi.labelIn;
    const cardColIn = frameUi.cardColIn, labelColIn = frameUi.labelColIn;
    const frameOf = frameUi.frameOf, syncFrame = frameUi.syncFrame;

    /** The code as it will be downloaded: the styled code, in its frame. */
    function artwork(qr, opts) {
      return frameSVG(QR.toSVG(qr, opts), frameOf(), opts.scale, opts.light);
    }

    /* designs ------------------------------------------------ */

    const designBody = qrPanel(controls, '7. Your designs', false);
    designBody.appendChild(el('p', 'qr-design-note',
      'Every design you download is kept here, in this browser only, so you can go back to it. The look is kept, not what the code says.'));
    const designGrid = el('div', 'qr-design-grid');
    designGrid.setAttribute('role', 'list');
    designBody.appendChild(designGrid);
    const designActs = el('div', 'io-actions');
    const saveDesignBtn = el('button', 'btn-ghost', 'Save this design');
    saveDesignBtn.type = 'button';
    const clearDesignsBtn = el('button', 'btn-ghost', 'Clear designs');
    clearDesignsBtn.type = 'button';
    const resetBtn = el('button', 'btn-ghost', 'Reset to defaults');
    resetBtn.type = 'button';
    designActs.appendChild(saveDesignBtn);
    designActs.appendChild(clearDesignsBtn);
    designActs.appendChild(resetBtn);
    designBody.appendChild(designActs);

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
    const progress = progressUI(stage);
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
      ['px', () => sizeSel.value, (v) => { sizeSel.value = String(clampNum(v, 64, 4096, 600)); }],
      ['dpi', () => dpiSel.value, (v) => { dpiSel.value = String(clampNum(v, 72, 1200, 300)); }],
      ['quiet', () => quietSel.value, (v) => { quietSel.value = v; }],
      ['shape', () => shapePick.read(), (v) => shapePick.set(v)],
      ['eye', () => framePick.read(), (v) => framePick.set(v)],
      ['ball', () => ballPick.read(), (v) => ballPick.set(v)],
      ['fill', () => fillSel.value, (v) => { fillSel.value = v; }],
      ['angle', () => angleSel.value, (v) => { angleSel.value = String(clampNum(v, 0, 359, 45)); }],
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
        (v) => { eyeMatchBox.checked = false; ballColIn.write('#' + v); }],
      ['logo', () => logoSizeSel.value, (v) => { logoSizeSel.value = v; }],
      ['frame', () => cardSel.value, (v) => { if (FRAME_STYLES.some((f) => f[0] === v)) cardSel.value = v; }],
      ['cta', () => cardSel.value === 'none' ? '' : labelIn.value.replace(/[,:]/g, ' '), (v) => { labelIn.value = String(v).slice(0, 40); }],
      ['fc', () => cardSel.value === 'none' ? '' : cardColIn.read().replace('#', ''), (v) => cardColIn.write('#' + v)],
      ['lc', () => cardSel.value === 'none' ? '' : labelColIn.read().replace('#', ''), (v) => labelColIn.write('#' + v)]
    ];

    /* Snapshotted before any link is read, so "default" means what the page
       opens with rather than a list repeated in two places. */
    let styleDefaults = null;
    function captureDefaults() {
      styleDefaults = {};
      STYLE_KEYS.forEach(function (k) { styleDefaults[k[0]] = k[1](); });
    }

    /** Every style setting, for remembering and for saved designs. */
    function styleNow() {
      const o = {};
      STYLE_KEYS.forEach(function (k) { o[k[0]] = k[1](); });
      return o;
    }
    /** Put style settings back. Unknown or bad values keep what is there. */
    function applyStyle(o) {
      if (!o) return;
      /* the eye colours only exist when they differ from the code */
      eyeMatchBox.checked = !(o.eyefg || o.eyebg);
      STYLE_KEYS.forEach(function (k) {
        if (o[k[0]] !== undefined && o[k[0]] !== '') {
          try { k[2](o[k[0]]); } catch (e) { /* keep what is there */ }
        }
      });
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
      const params = linkParams();
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

    /* ---- remembered settings and saved designs ---- */

    /* The look and the content type are remembered on this device; what the
       code says is not, since it is often a password or a phone number. */
    let rememberTimer = 0;
    function remember() {
      clearTimeout(rememberTimer);
      rememberTimer = setTimeout(function () {
        writeStore(STORE_KEYS.gen, { type: typeSel.value, style: styleNow(), frameText: labelIn.value });
      }, 400);
    }
    function restoreRemembered() {
      const saved = readStore(STORE_KEYS.gen);
      if (!saved || typeof saved !== 'object') return;
      if (saved.type && QR_TYPES[saved.type]) { typeSel.value = saved.type; buildFields(); }
      applyStyle(saved.style);
    }

    function designs() {
      const d = readStore(STORE_KEYS.designs);
      return Array.isArray(d) ? d : [];
    }
    const SAMPLE = 'https://www.1234tools.com/';

    /**
     * Keep the current look. The thumbnail is drawn from a sample address, so
     * the history holds the design and never the content of anyone's code.
     */
    function saveDesign() {
      const st = styleNow();
      const logo = style.store.logo && style.store.logo.href.length < 150000 ? style.store.logo : null;
      let thumb = '';
      try {
        const q = QR.encode(SAMPLE, ecSel.value);
        const o = styleOptions(2);
        if (o.logo && !logo) delete o.logo;
        thumb = frameSVG(QR.toSVG(q, o), frameOf(), 2, o.light);
      } catch (e) { thumb = ''; }
      const key = JSON.stringify(st) + (logo ? logo.name : '');
      const list = designs().filter(function (d) { return d.key !== key; });
      list.unshift({ key: key, at: Date.now(), style: st, logo: logo, thumb: thumb });
      if (!writeStore(STORE_KEYS.designs, list.slice(0, 12))) {
        /* storage full: the thumbnails are the large part, so try without the oldest */
        writeStore(STORE_KEYS.designs, list.slice(0, 4));
      }
      paintDesigns();
    }

    function paintDesigns() {
      const list = designs();
      designGrid.textContent = '';
      clearDesignsBtn.hidden = !list.length;
      if (!list.length) {
        designGrid.appendChild(el('p', 'qr-design-empty', 'No saved designs yet. Download a code, or press Save this design.'));
        return;
      }
      list.forEach(function (d) {
        const b = el('button', 'qr-design');
        b.type = 'button';
        b.setAttribute('role', 'listitem');
        const when = new Date(d.at || Date.now());
        b.title = 'Use this design (saved ' + when.toLocaleString() + ')';
        b.setAttribute('aria-label', 'Use the design saved ' + when.toLocaleString());
        const art = el('span', 'qr-design-art');
        art.innerHTML = String(d.thumb || '').replace(/^<svg\b/, '<svg aria-hidden="true"');
        b.appendChild(art);
        b.appendChild(el('span', 'qr-design-when', when.toLocaleDateString()));
        b.addEventListener('click', function () {
          applyStyle(d.style);
          style.setLogo(d.logo || null);
          qrChanged = true;
          touched = true;
          render();
        });
        designGrid.appendChild(b);
      });
    }

    saveDesignBtn.addEventListener('click', function () { saveDesign(); note('Design saved in this browser.', 'note'); });
    clearDesignsBtn.addEventListener('click', function () { writeStore(STORE_KEYS.designs, null); paintDesigns(); });
    resetBtn.addEventListener('click', function () {
      applyStyle(styleDefaults);
      eyeMatchBox.checked = true;
      transparentBox.checked = false;
      labelIn.value = 'SCAN ME';
      style.setLogo(null);
      clearTimeout(rememberTimer);            // a change made just before must not write the look back
      writeStore(STORE_KEYS.gen, null);
      touched = false;
      render();
    });

    function note(text, kind) {
      msg.textContent = text || '';
      msg.className = 'io-msg' + (kind ? ' is-' + kind : '');
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
        if (trialOpts.logo && c.apply.logopad !== undefined) trialOpts.logo.padding = Number(c.apply.logopad);
        if (trialOpts.logo && c.apply.logosize !== undefined) trialOpts.logo.size = Number(c.apply.logosize);
        const svg = artwork(qr, trialOpts);
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

    /* ---- the files ---- */

    const pngWidth = () => clampNum(sizeSel.value, 64, 4096, 600);
    const dpiNow = () => clampNum(dpiSel.value, 72, 1200, 300);
    /** Page size for PDF and EPS: the PNG's pixels at the chosen resolution, in points. */
    function pagePt(svg) {
      const box = svgBox(svg);
      const w = pngWidth() / dpiNow() * 72;
      return { w: w, h: w * box.h / box.w };
    }
    /** What a logo is flattened onto in the EPS, which has no transparency. */
    function flattenColour() {
      const o = styleOptions(8);
      if (o.logo && o.logo.background && o.logo.background !== 'none') return o.logo.background;
      return o.light && o.light !== 'none' ? o.light : '#ffffff';
    }

    async function makeSvg(qr) {
      return new Blob([artwork(qr, styleOptions(8))], { type: 'image/svg+xml' });
    }
    async function makePng() {
      const b = await svgToPngBlob(currentSVG, pngWidth(), dpiNow());
      if (!b) note('This browser could not make a PNG ' + pngWidth() + ' pixels wide. Try a smaller width.', 'error');
      return b;
    }
    async function makePdf() {
      await loadExport();
      const svg = currentSVG, p = pagePt(svg);
      const bytes = await window.QRExport.svgToPdf(svg, { widthPt: p.w, heightPt: p.h, images: await imagesOf(svg), title: 'QR code: ' + currentText.slice(0, 60) });
      return new Blob([bytes], { type: 'application/pdf' });
    }
    async function makeEps() {
      await loadExport();
      const svg = currentSVG, p = pagePt(svg);
      const text = window.QRExport.svgToEps(svg, { widthPt: p.w, heightPt: p.h, images: await imagesOf(svg), flatten: flattenColour(), title: 'QR code' });
      return new Blob([text], { type: 'application/postscript' });
    }
    /** Every format in one archive, each file named from what it turned out to be. */
    async function makeAll(qr) {
      const token = progress.start('Making SVG, PNG, PDF and EPS…');
      try {
        await loadZip();
        const makers = [() => makeSvg(qr), makePng, makePdf, makeEps];
        const files = [];
        for (let i = 0; i < makers.length; i++) {
          if (token.cancelled) { note('Cancelled. Nothing was downloaded.', 'note'); return null; }
          const b = await makers[i]();
          if (b) files.push({ name: 'qr-code.' + extOf(b), blob: b });
          progress.set(i + 1, makers.length);
          await yieldFrame();
        }
        if (token.cancelled) { note('Cancelled. Nothing was downloaded.', 'note'); return null; }
        return window.MVRZip(files);
      } catch (e) {
        note('The archive could not be made: ' + e.message, 'error');
        return null;
      } finally { progress.end(token); }
    }
    /** A download also keeps the design, which is what makes the history useful. */
    const andKeep = (fn) => async function () { const b = await fn(); if (b) saveDesign(); return b; };

    function render() {
      style.syncVisibility();
      syncFrame();

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
        announce({ kind: 'qr', params: {}, summary: null, changed: qrChanged });
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
        announce({ kind: 'qr', params: {}, summary: null, changed: qrChanged });
        return;
      }

      currentText = data;
      sharedContent.textContent = data;
      const pngW = pngWidth();
      const opts = styleOptions(Math.max(2, Math.round(pngW / (qr.size + Number(quietSel.value) * 2))));
      currentSVG = artwork(qr, opts);
      qrBox.innerHTML = currentSVG;
      const box = svgBox(currentSVG);
      const pngH = Math.round(pngW * box.h / box.w);

      /* Read the finished artwork back before letting anyone download it.
         This runs on every change, so the badge under the preview is a
         statement about the image on screen, frame and label included, not
         about the matrix behind it. */
      const stamp = ++verifySeq;
      const basic = style.staticNotes();
      frameFontNote(frameOf(), basic.notes);
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
              : 'The rendered image did not decode. The colours, shapes or frame are getting in the way.'
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

      acts.appendChild(typedDownload('Download SVG', 'qr-code', andKeep(function () { return makeSvg(qr); })));
      acts.appendChild(typedDownload('Download PNG', 'qr-code', andKeep(makePng)));
      acts.appendChild(typedDownload('Download PDF', 'qr-code', andKeep(makePdf)));
      acts.appendChild(typedDownload('Download EPS', 'qr-code', andKeep(makeEps)));
      acts.appendChild(typedDownload('All formats (ZIP)', 'qr-code', andKeep(function () { return makeAll(qr); }), 'btn-ghost'));
      acts.appendChild(copyButton(function () { return currentText; }, 'Copy content'));
      acts.appendChild(copyButton(shareLink, 'Copy share link'));

      const modes = qr.segments.map(function (s) {
        return ({ numeric: 'numeric', alnum: 'alphanumeric', byte: 'byte' })[s.mode] + ' x' + s.length;
      }).join(', ');
      const mmPerModule = 0.5;
      const printMm = Math.ceil((qr.size + Number(quietSel.value) * 2) * mmPerModule);
      const dpi = dpiNow();
      const mm = (px) => (Math.round(px / dpi * 25.4 * 10) / 10).toFixed(1);

      document.dispatchEvent(new CustomEvent('mvr:tool-used'));

      renderStats(stats, [
        ['Version', qr.version + ' (' + qr.size + ' x ' + qr.size + ' modules)'],
        ['Error correction', EC_LABELS[qr.ecLevel]],
        ['Mask pattern', String(qr.mask)],
        ['Encoding', modes],
        ['Content length', data.length + ' characters'],
        ['PNG export', pngW + ' x ' + pngH + ' px'],
        ['Print size', mm(pngW) + ' x ' + mm(pngH) + ' mm at ' + dpi + ' dpi'],
        ['Smallest safe print', printMm + ' mm wide']
      ]);

      if (touched) remember();

      /* The share bar sends the same parameters as "Copy share link", after
         a # rather than a ?, so the code's content reaches no server. */
      let params = {};
      try { params = Object.fromEntries(new URL(shareLink()).searchParams); } catch (e) { params = {}; }
      announce({ kind: 'qr', params: params, summary: null, changed: qrChanged });
    }

    /* Re-render on the next frame so a fast typist does not queue up work. */
    let pending = 0;
    function schedule() {
      if (pending) return;
      pending = requestAnimationFrame(function () { pending = 0; render(); });
    }

    /* Whether the code on screen is somebody's own rather than the page's
       example: a change made here, or a code that arrived in the link. */
    let qrChanged = false;
    /* Only a change made here is remembered: a shared link's look is not. */
    let touched = false;
    const changed = function () { qrChanged = true; touched = true; schedule(); };
    typeSel.addEventListener('change', function () { qrChanged = true; touched = true; buildFields(); schedule(); });
    fieldHost.addEventListener('input', changed);
    fieldHost.addEventListener('change', changed);
    controls.addEventListener('input', changed);
    controls.addEventListener('change', changed);

    buildFields();
    syncFrame();
    captureDefaults();
    /* A link like ?t=wifi&ssid=Cafe&style=ec:H rebuilds the code on arrival,
       so a code can be sent as a URL rather than as a picture — and the person
       who receives it can see what it contains before trusting it. The share
       bar's links carry the same after a #, which is read here as well. A
       link wins over the look remembered on this device. */
    let fromLink = false;
    try { fromLink = applyShare(linkParams()); if (fromLink) qrChanged = true; } catch (e) { /* a malformed link just shows the default */ }
    if (!fromLink) restoreRemembered();
    applyViewMode();
    paintDesigns();
    render();
    /* the label is sized from Helvetica's widths, which arrive with qr-export.js */
    if (!window.QRExport) loadExport().then(function () { if (frameOf().style !== 'none') schedule(); }).catch(function () {});
  }

  /* ---------------- QR in bulk ---------------- */

  /* Above this the tab stops being a web page and starts being a batch job.
     Every code is encoded, rasterised and read back in slices between
     frames, with a progress bar and a Cancel button, so the page keeps
     answering while two thousand codes go through. */
  const BULK_LIMIT = 2000;
  const BULK_PREVIEW = 60;

  /* Column headers that name the file rather than feed the code. */
  const NAME_KEYS = ['name', 'label', 'filename', 'file name', 'file', 'id', 'ref'];
  /* Column headers with a job of their own. */
  const ROLE_KEYS = {
    type: ['type', 'content type', 'kind'],
    fg: ['colour', 'color', 'fg', 'foreground', 'foreground colour', 'dark'],
    bg: ['bg', 'background', 'background colour', 'light'],
    caption: ['caption', 'text under', 'label text', 'print text'],
    frame: ['frame text', 'frame label', 'frame', 'call to action', 'cta']
  };

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

  /** Every field of every content type, for a list that mixes types. */
  function allFields() {
    const out = [];
    TYPE_ORDER.forEach(function (t) {
      QR_TYPES[t].fields.forEach(function (f) {
        if (!out.some(function (o) { return o[0] === f[0]; })) out.push(f);
      });
    });
    return out;
  }

  /** What a header cell asks for: a field, the file name, or one of the roles. */
  function roleOfHeader(cell, keys, labels) {
    const c = tidyHead(cell);
    for (const role in ROLE_KEYS) if (ROLE_KEYS[role].indexOf(c) >= 0) return { role: role };
    let i = keys.indexOf(c);
    if (i < 0) i = labels.indexOf(c);
    if (i >= 0) return { field: keys[i] };
    if (NAME_KEYS.indexOf(c) >= 0) return { name: true };
    return null;
  }

  /**
   * Which column feeds which field.
   *
   * A header row is used when its cells name the fields; otherwise columns are
   * taken in the order the content type lists them. Guessing this silently is
   * the classic bulk-generator failure — four hundred contact cards with the
   * phone number in the name field — so whatever was matched is spelled out on
   * the page, and every column's job can be changed there, before printing.
   * A "type" column lets one list mix content types; its fields are then
   * matched against every type's.
   */
  function mapColumns(rows, type) {
    const head = rows[0] || [];
    const mixed = head.length > 1 && head.some(function (h) { return ROLE_KEYS.type.indexOf(tidyHead(h)) >= 0; });
    const fields = mixed ? allFields() : type.fields;
    const keys = fields.map(function (f) { return f[0]; });
    const labels = fields.map(function (f) { return tidyHead(f[1]); });

    let matched = 0;
    const map = head.map(function (cell) {
      const m = roleOfHeader(cell, keys, labels);
      if (m) matched++;
      return m;
    });

    /* A header needs at least two cells. A one-column list has nothing to
       map, so treating its first line as a header buys nothing and risks
       silently eating somebody's first value. */
    if (head.length > 1 && matched >= Math.ceil(head.length / 2)) {
      return { header: head, map: map, body: rows.slice(1), mixed: mixed };
    }
    return {
      header: null,
      map: type.fields.map(function (f) { return { field: f[0] }; }),
      body: rows,
      mixed: false
    };
  }

  function rowValues(cells, map, keys) {
    const v = {};
    keys.forEach(function (k) { v[k] = ''; });
    const out = { values: v, name: '', type: '', fg: '', bg: '', caption: '', frame: '' };
    map.forEach(function (m, i) {
      if (!m) return;
      const cell = cells[i] === undefined ? '' : cells[i];
      if (m.name) out.name = cell;
      else if (m.role) out[m.role] = cell;
      else v[m.field] = cell;
    });
    return out;
  }

  const hexColour = (s) => {
    const t = String(s || '').trim();
    if (/^#?[0-9a-f]{6}$/i.test(t)) return '#' + t.replace('#', '').toLowerCase();
    if (/^#?[0-9a-f]{3}$/i.test(t)) return '#' + t.replace('#', '').split('').map((h) => h + h).join('').toLowerCase();
    return null;
  };

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
    vcard4: (v) => [v.first, v.last].filter(Boolean).join(' ') || v.org,
    mecard: (v) => v.name || v.phone || v.email,
    email: (v) => v.to,
    sms: (v) => v.num,
    whatsapp: (v) => v.num,
    geo: (v) => v.lat + ' ' + v.lon,
    event: (v) => [v.title, v.start].filter(Boolean).join(' '),
    upi: (v) => [v.vpa, v.tn].filter(Boolean).join(' '),
    bitcoin: (v) => v.label || v.addr,
    paypal: (v) => [v.user, v.am].filter(Boolean).join(' '),
    social: (v) => v.net + ' ' + v.handle,
    appstore: (v) => v.store + ' ' + v.app
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

  const csvCell = (s) => /[",\n\r]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s);

  /* A worked example per content type: the header line the parser expects and
     a couple of rows in it. Far quicker to read than a paragraph explaining
     that columns come in field order unless there is a header. */
  const BULK_EXAMPLES = {
    url: 'https://www.1234tools.com/\nhttps://www.1234tools.com/qr/\nhttps://www.1234tools.com/pdf/',
    text: 'Bay A-01\nBay A-02\nBay A-03',
    file: 'https://www.example.com/menu.pdf\nhttps://www.example.com/tour/stop-1.mp3\nhttps://www.example.com/tour/stop-2.mp3',
    wifi: 'ssid,pass,enc,name\nRio Cafe Guest,flatwhite22,WPA,rio-guest\nRio Cafe Staff,backofhouse9,WPA,rio-staff',
    vcard: 'first,last,org,phone,email,name\nPriya,Nair,MVR IT Services,+441189000111,priya@example.com,priya-nair\nSam,Okafor,MVR IT Services,+441189000112,sam@example.com,sam-okafor',
    vcard4: 'first,last,org,phone,email,name\nPriya,Nair,MVR IT Services,+441189000111,priya@example.com,priya-nair\nSam,Okafor,MVR IT Services,+441189000112,sam@example.com,sam-okafor',
    mecard: 'name,phone,email\nPriya Nair,+441189000111,priya@example.com\nSam Okafor,+441189000112,sam@example.com',
    email: 'to,subj\nsales@example.com,Price list\nsupport@example.com,Warranty claim',
    sms: 'num,msg\n+441189000111,Table 4 needs service\n+441189000112,Table 5 needs service',
    whatsapp: 'num,msg\n447700900111,Hello from stand 12\n447700900112,Hello from stand 13',
    tel: '+441189000111\n+441189000112\n+441189000113',
    social: 'net,handle,caption\ninstagram,riocafe,Follow us\ngithub,mvr-it,Our code',
    appstore: 'store,app,caption\napple,284882215,iPhone\ngoogle,com.example.app,Android',
    geo: 'lat,lon,name\n51.4543,-0.9781,reading\n51.5074,-0.1278,london',
    event: 'title,loc,start,name\nSite induction,Gate 2,2026-10-01T09:00,induction-morning\nSite induction,Gate 2,2026-10-01T14:00,induction-afternoon',
    upi: 'vpa,name,am,tn\nshop@okbank,Rio Cafe,120,Table 1\nshop@okbank,Rio Cafe,250,Table 2',
    paypal: 'user,am,cur,name\nriocafe,4.50,GBP,flat-white\nriocafe,3.20,GBP,espresso',
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
      TYPE_ORDER.map((k) => [k, QR_TYPES[k].label]), 'url');

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

    /* 6. frame and label: one call to action, or a brand, round every code;
       a "frame text" column gives a row its own label ------------------- */

    const frameUi = qrFrameControls(controls, '6. Frame and label');

    /* 7. the label sheet ---------------------------------------- */

    const sheetBody = qrPanel(controls, '7. Label sheet (PDF)', false);
    const presetSel = selectControl(sheetBody, 'Sheet', 'sheet',
      Object.keys(LABEL_PRESETS_UI).map((k) => [k, LABEL_PRESETS_UI[k].name]).concat([['custom', 'Custom grid']]), 'a4-21');
    const pageSel = selectControl(sheetBody, 'Paper', 'paper', [['a4', 'A4 (210 x 297 mm)'], ['letter', 'US Letter (215.9 x 279.4 mm)']], 'a4');
    const grid2 = el('div', 'qr-sheet-grid');
    sheetBody.appendChild(grid2);
    const mmIn = function (label, name, def, min, max, step) {
      const w = el('div', 'field');
      const id = 'qr-' + name;
      const l = el('label', null, label);
      l.setAttribute('for', id);
      const n = el('input', 'control qr-number');
      n.type = 'number'; n.id = id; n.inputMode = 'decimal';
      n.min = String(min); n.max = String(max); n.step = String(step || 0.01);
      n.value = String(def);
      w.appendChild(l); w.appendChild(n);
      grid2.appendChild(w);
      return n;
    };
    const colsIn = mmIn('Columns', 'cols', 3, 1, 20, 1);
    const rowsIn = mmIn('Rows', 'rows', 7, 1, 40, 1);
    const lwIn = mmIn('Label width, mm', 'lw', 63.5, 5, 300);
    const lhIn = mmIn('Label height, mm', 'lh', 38.1, 5, 300);
    const topIn = mmIn('Top margin, mm', 'top', 15.15, 0, 100);
    const leftIn = mmIn('Left margin, mm', 'left', 7.21, 0, 100);
    const gxIn = mmIn('Gap across, mm', 'gx', 2.54, 0, 50);
    const gyIn = mmIn('Gap down, mm', 'gy', 0, 0, 50);
    const underSel = selectControl(sheetBody, 'Text under each code', 'under',
      [['name', 'Its name (or caption column)'], ['content', 'What the code says'], ['none', 'No text']], 'name');
    const fontIn = numberControl(sheetBody, 'Text size', 'font', 5, 16, 8, 'pt');
    const outlineBox = checkControl(sheetBody, 'Draw label outlines (for a test print on plain paper)', 'outline', false);
    const sheetNote = el('p', 'bulk-hint qr-sheet-note');
    sheetBody.appendChild(sheetNote);

    function applyPreset(k) {
      const p = LABEL_PRESETS_UI[k];
      if (!p) return;
      pageSel.value = p.page;
      colsIn.value = p.cols; rowsIn.value = p.rows; lwIn.value = p.w; lhIn.value = p.h;
      topIn.value = p.top; leftIn.value = p.left; gxIn.value = p.gapX; gyIn.value = p.gapY;
    }
    presetSel.addEventListener('change', function () { applyPreset(presetSel.value); syncSheet(); });
    [pageSel, colsIn, rowsIn, lwIn, lhIn, topIn, leftIn, gxIn, gyIn].forEach(function (c) {
      c.addEventListener('input', function () { presetSel.value = 'custom'; syncSheet(); });
    });
    [underSel, fontIn].forEach(function (c) { c.addEventListener('input', syncSheet); c.addEventListener('change', syncSheet); });

    function layoutNow() {
      const pg = (window.QRExport ? window.QRExport.PAGES : PAGES_UI)[pageSel.value] || [210, 297];
      return {
        pageW: pg[0], pageH: pg[1],
        cols: Math.round(Number(colsIn.value)), rows: Math.round(Number(rowsIn.value)),
        w: Number(lwIn.value), h: Number(lhIn.value), top: Number(topIn.value), left: Number(leftIn.value),
        gapX: Number(gxIn.value), gapY: Number(gyIn.value),
        text: underSel.value !== 'none', fontPt: clampNum(fontIn.value, 5, 16, 8), outlines: outlineBox.checked
      };
    }
    /** What the sheet will hold, or what is wrong with it, under the fields. */
    function syncSheet() {
      const L = layoutNow();
      const bad = checkLayoutUI(L);
      const per = (L.cols || 0) * (L.rows || 0);
      const pad = 1.5, textMm = L.text ? L.fontPt / (72 / 25.4) * 1.3 : 0;
      const codeMm = Math.max(0, Math.min(L.w - pad * 2, L.h - pad * 2 - textMm));
      sheetNote.textContent = bad || (per + ' labels a sheet; each code is printed ' + codeMm.toFixed(1) + ' mm wide' +
        (batch.length ? ', so this batch takes ' + Math.ceil(batch.length / per) + ' sheet' + (Math.ceil(batch.length / per) === 1 ? '' : 's') : '') + '.');
      sheetNote.classList.toggle('is-error', !!bad);
      return { L: L, bad: bad, codeMm: codeMm };
    }

    /* ---- stage ---- */

    const summary = el('div', 'bulk-summary');
    const verdict = el('div', 'qr-verdict');
    const msg = el('div', 'io-msg');
    const mapNote = el('p', 'bulk-map');
    const mapEdit = el('details', 'bulk-columns');
    const acts = el('div', 'io-actions qr-actions');
    const grid = el('div', 'bulk-grid');
    const gridNote = el('p', 'bulk-map');
    const skipWrap = el('div', 'bulk-skipped-wrap');
    const stats = el('div', 'stat-grid');
    stage.appendChild(summary);
    const progress = progressUI(stage);
    stage.appendChild(verdict);
    stage.appendChild(msg);
    stage.appendChild(mapNote);
    stage.appendChild(mapEdit);
    stage.appendChild(acts);
    stage.appendChild(grid);
    stage.appendChild(gridNote);
    stage.appendChild(skipWrap);
    stage.appendChild(stats);

    let batch = [];            // every usable code in the current run
    let skipped = [];          // rows that could not become a code, and why
    let runSeq = 0;            // cancels a pass a newer run replaced
    let generated = '';        // the list text the current batch was built from
    let overrides = null;      // column jobs changed by hand: { key, roles: [] }
    let lastPlan = null;

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
          header: null, mixed: false,
          map: [{ field: type.fields[0][0] }],
          body: String(area.value).replace(/\r\n?/g, '\n').split('\n')
            .map(function (l) { return [l.trim()]; })
            .filter(function (r) { return r[0] !== ''; })
        };
      }
      plan.delim = parsed.delim;
      plan.width = Math.max.apply(null, [plan.map.length].concat(plan.body.slice(0, 50).map(function (r) { return r.length; })));
      /* jobs changed by hand win, for as long as the columns are the same ones */
      const key = (plan.header ? plan.header.join('\u0001') : 'cols:' + plan.width) + '|' + typeSel.value;
      if (overrides && overrides.key === key) {
        plan.map = overrides.roles.slice();
        plan.mixed = plan.map.some(function (m) { return m && m.role === 'type'; });
        plan.manual = true;
      } else overrides = null;
      plan.key = key;
      return plan;
    }

    const ROLE_LABELS = { type: 'content type', fg: 'colour', bg: 'background', caption: 'text under the code', frame: 'frame label' };

    function labelForField(key) {
      const f = allFields().filter(function (x) { return x[0] === key; })[0];
      return f ? f[1] : key;
    }

    function describeMapping(plan, type) {
      if (!plan.body.length) return '';
      const say = function (m) {
        if (!m) return 'ignored';
        if (m.name) return 'file name';
        if (m.role) return ROLE_LABELS[m.role];
        return labelForField(m.field);
      };
      if (plan.header) {
        const named = plan.map.map(function (m, i) { return plan.header[i] + ' → ' + say(m); });
        return (plan.manual ? 'Columns as you set them: ' : 'Header row read: ') + named.join(', ') + '.';
      }
      if (type.fields.length === 1 && plan.map.length === 1 && !plan.manual) return 'Each line is one ' + labelForField(type.fields[0][0]).toLowerCase() + '.';
      return (plan.manual ? 'Columns as you set them: ' : 'No header row, so columns are taken in order: ') +
        plan.map.map(function (m, i) { return 'column ' + (i + 1) + ' → ' + say(m); }).join(', ') +
        (plan.manual ? '.' : '. Add a header line to name them instead, or change them below.');
    }

    /** One select per column, to change what each column is for. */
    function paintColumnEditor(plan, type) {
      mapEdit.textContent = '';
      if (!plan.body.length) { mapEdit.hidden = true; return; }
      mapEdit.hidden = false;
      mapEdit.appendChild(el('summary', null, 'Change what each column is for'));
      const box = el('div', 'bulk-columns-grid');
      const fields = plan.mixed ? allFields() : type.fields;
      const n = Math.max(plan.map.length, plan.width || 0);
      for (let i = 0; i < n; i++) {
        const m = plan.map[i];
        const id = 'qr-col-' + i;
        const w = el('div', 'field');
        const sample = (plan.body[0] || [])[i] || '';
        const l = el('label', null, (plan.header ? plan.header[i] || ('Column ' + (i + 1)) : 'Column ' + (i + 1)) + (sample ? ' (' + (sample.length > 24 ? sample.slice(0, 24) + '…' : sample) + ')' : ''));
        l.setAttribute('for', id);
        const s = el('select', 'control');
        s.id = id;
        const opts = [['', 'Ignore']].concat(fields.map(function (f) { return ['field:' + f[0], f[1]]; }))
          .concat([['name', 'File name'], ['role:caption', 'Text under the code'], ['role:frame', 'Frame label (per row)'], ['role:type', 'Content type (per row)'],
            ['role:fg', 'Colour (#rrggbb)'], ['role:bg', 'Background (#rrggbb)']]);
        const cur = !m ? '' : m.name ? 'name' : m.role ? 'role:' + m.role : 'field:' + m.field;
        opts.forEach(function (o) {
          const op = el('option', null, o[1]);
          op.value = o[0];
          if (o[0] === cur) op.selected = true;
          s.appendChild(op);
        });
        s.addEventListener('change', function () {
          const roles = [];
          for (let k = 0; k < n; k++) {
            const v = k === i ? s.value : (function () { const x = plan.map[k]; return !x ? '' : x.name ? 'name' : x.role ? 'role:' + x.role : 'field:' + x.field; })();
            roles.push(!v ? null : v === 'name' ? { name: true } : v.indexOf('role:') === 0 ? { role: v.slice(5) } : { field: v.slice(6) });
          }
          overrides = { key: plan.key, roles: roles };
          build();
        });
        w.appendChild(l); w.appendChild(s);
        box.appendChild(w);
      }
      mapEdit.appendChild(box);
      if (plan.manual) {
        const reset = el('button', 'btn-ghost', 'Back to the columns as read');
        reset.type = 'button';
        reset.addEventListener('click', function () { overrides = null; build(); });
        mapEdit.appendChild(reset);
      }
    }

    /* ---- building the batch ---- */

    /**
     * Encode every row, in slices of about 30 ms between frames, then check
     * every one. A newer run, or Cancel, stops the old one where it stands.
     */
    async function build() {
      style.syncVisibility();
      const baseType = QR_TYPES[typeSel.value];
      const plan = readBatch(baseType);
      lastPlan = plan;
      const ec = style.ecSel.value;
      const base = style.styleOptions(8);
      const frameBase = frameUi.frameOf();
      const stamp = ++runSeq;

      generated = area.value;
      genBtn.classList.remove('is-stale');
      batch = [];
      skipped = [];
      verdict.textContent = '';
      verdict.className = 'qr-verdict';
      remember();

      if (!plan.body.length) {
        grid.textContent = '';
        gridNote.textContent = '';
        skipWrap.textContent = '';
        acts.textContent = '';
        mapNote.textContent = '';
        mapEdit.textContent = '';
        mapEdit.hidden = true;
        setSummary('');
        progress.end();
        renderStats(stats, null);
        syncSheet();
        note('Paste or type your values above, one code per line, then press Generate codes.', 'note');
        return;
      }

      const rows = plan.body.slice(0, BULK_LIMIT);
      const over = plan.body.length - rows.length;
      const keysAll = (plan.mixed ? allFields() : baseType.fields).map(function (f) { return f[0]; });
      const token = progress.start('Encoding ' + rows.length + ' codes…');
      const made = [];
      let t0 = performance.now();

      for (let i = 0; i < rows.length; i++) {
        if (performance.now() - t0 > 30) {
          progress.set(i, rows.length, 'Encoding ' + i + ' of ' + rows.length + ' codes…');
          setSummary('Encoding ' + i + ' of ' + rows.length, true);
          await yieldFrame();
          if (stamp !== runSeq) return;
          if (token.cancelled) { cancelled(i, rows.length, 'encoded'); return; }
          t0 = performance.now();
        }
        const cells = rows[i];
        const got = rowValues(cells, plan.map, keysAll);
        const line = cells.join(' ').trim();
        let tkey = typeSel.value;
        if (plan.mixed && got.type) {
          const want = String(got.type).trim().toLowerCase();
          const hit = TYPE_ORDER.filter(function (k) { return k === want || QR_TYPES[k].label.toLowerCase() === want; })[0];
          if (!hit) { skipped.push({ line: i + 1, text: line, why: 'unknown content type "' + got.type + '" (use one of ' + TYPE_ORDER.join(', ') + ')' }); continue; }
          tkey = hit;
        }
        const type = QR_TYPES[tkey];
        if (!type.ready(got.values)) {
          skipped.push({ line: i + 1, text: line, why: 'not enough to make a code' + (plan.mixed ? ' of type ' + tkey : '') });
          continue;
        }
        let opts = base;
        if (got.fg || got.bg) {
          const fg = got.fg ? hexColour(got.fg) : null, bg = got.bg ? hexColour(got.bg) : null;
          if ((got.fg && !fg) || (got.bg && !bg)) {
            skipped.push({ line: i + 1, text: line, why: 'colour "' + (got.fg && !fg ? got.fg : got.bg) + '" is not a #rrggbb hex colour' });
            continue;
          }
          opts = Object.assign({}, base);
          if (fg) {
            opts.dark = fg;
            if (base.gradient) opts.gradient = Object.assign({}, base.gradient, { from: fg });
          }
          if (bg) {
            opts.light = bg;
            if (base.logo && base.logo.background !== 'none') opts.logo = Object.assign({}, base.logo, { background: bg });
          }
        }
        const content = type.build(got.values);
        let qr;
        try { qr = QR.encode(content, ec); }
        catch (e) {
          skipped.push({ line: i + 1, text: line, why: e.message });
          continue;
        }
        const fromFields = BULK_NAME[tkey] ? BULK_NAME[tkey](got.values) : content;
        /* a row's own frame text replaces the panel's label, never the frame:
           with "No frame" chosen a column cannot sneak one in */
        const frame = got.frame && frameBase.style !== 'none'
          ? Object.assign({}, frameBase, { text: String(got.frame).trim().slice(0, 40) }) : frameBase;
        made.push({
          name: slugName(got.name || fromFields, 'qr-' + String(i + 1).padStart(3, '0')),
          caption: got.caption || got.name || fromFields,
          type: tkey,
          content: content,
          qr: qr,
          svg: frameSVG(QR.toSVG(qr, opts), frame, opts.scale, opts.light),
          frame: frame,
          modules: qr.size + opts.quiet * 2,
          colours: opts !== base ? (opts.dark + ' on ' + (opts.light === 'none' ? 'transparent' : opts.light)) : '',
          status: 'checking',
          node: null
        });
      }
      if (stamp !== runSeq) return;
      batch = made;

      const names = uniqueNames(batch.map(function (b) { return b.name; }));
      batch.forEach(function (b, i) { b.name = names[i]; });

      mapNote.textContent = describeMapping(plan, baseType);
      paintColumnEditor(plan, baseType);
      note(over > 0
        ? 'Only the first ' + BULK_LIMIT.toLocaleString('en-GB') + ' rows were used — ' + over + ' more were left out. Split the list and run it twice.'
        : '', over > 0 ? 'warn' : '');

      paintGrid();
      paintActions();
      paintStats();
      syncSheet();
      document.dispatchEvent(new CustomEvent('mvr:tool-used'));

      /* Every row rejected is a real outcome, not an empty page. It almost
         always means the columns were read differently from how they were
         meant, so say which reading was used and point at the reasons. */
      if (!batch.length) {
        progress.end(token);
        setSummary('No codes made', false);
        verdict.className = 'qr-verdict is-fail';
        verdict.appendChild(el('p', 'qr-verdict-head',
          'None of those ' + plan.body.length + ' rows could be turned into a code'));
        const why = el('ul', 'qr-verdict-notes');
        why.appendChild(el('li', null, describeMapping(plan, baseType) +
          ' Check that against the columns you actually pasted.'));
        why.appendChild(el('li', null,
          'Every rejected row is listed below with the reason it was rejected.'));
        verdict.appendChild(why);
        return;
      }

      setSummary('0 of ' + batch.length + ' checked', true);
      verifyAll(stamp, token);
    }

    function cancelled(done, total, what) {
      progress.end();
      runSeq++;
      batch.forEach(function (b) { if (b.status === 'checking') markStatus(b, 'unchecked'); });
      setSummary('Cancelled: ' + done + ' of ' + total + ' ' + what, false);
      note('Stopped. Press Generate codes to run the list again.', 'warn');
      refreshActions();
    }

    /* ---- the preview grid ---- */

    function statusLabel(s) {
      return ({
        checking: 'Checking…', ok: 'Verified', tight: 'Tight', fail: 'Will not scan', unchecked: 'Not checked'
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
      row.appendChild(typedDownload('SVG', function () { return item.name; }, function () {
        return new Blob([item.svg], { type: 'image/svg+xml' });
      }));
      row.appendChild(typedDownload('PNG', function () { return item.name; }, function () {
        return svgToPngBlob(item.svg, pngW(), dpiNow());
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
        if (skipped.length > 40) ul.appendChild(el('li', null, 'and ' + (skipped.length - 40) + ' more, all listed in the CSV.'));
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
     * URL can cover an alignment pattern on a long one. Each read is its own
     * task, with a frame between every few, so the page stays usable.
     */
    async function verifyAll(stamp, token) {
      if (!batch.length) return;
      if (!window.QRDetect) {
        /* Nothing here to check the artwork with. The matrix is still sound —
           the encoder decodes its own output — but say which claim is being
           made rather than the stronger one. */
        batch.forEach(function (item) { markStatus(item, 'ok'); });
        progress.end(token);
        setSummary(batch.length + ' codes encoded', false);
        refreshActions();
        paintVerdict(batch.length, 0, 0, stamp, true);
        return;
      }
      let ok = 0, tight = 0, bad = 0;
      let t0 = performance.now();
      for (let i = 0; i < batch.length; i++) {
        if (stamp !== runSeq) return;
        if (token.cancelled) { cancelled(i, batch.length, 'checked'); return; }
        const item = batch[i];
        const got = await qrReadBack(item.svg, item.content, item.modules);
        if (stamp !== runSeq) return;
        if (!got) { markStatus(item, 'ok'); ok++; }
        else if (!got.clean) { markStatus(item, 'fail'); bad++; }
        else if (!got.rough) { markStatus(item, 'tight'); tight++; }
        else { markStatus(item, 'ok'); ok++; }

        if (performance.now() - t0 > 40 || i === batch.length - 1) {
          progress.set(i + 1, batch.length, 'Checking ' + (i + 1) + ' of ' + batch.length + ' codes…');
          setSummary(counted(i + 1, ok, tight, bad), true);
          refreshActions();
          await yieldFrame();   // let the page breathe
          t0 = performance.now();
        }
      }
      if (stamp !== runSeq) return;
      progress.end(token);
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
        const got = await qrReadBack(frameSVG(QR.toSVG(qr, trial), failing.frame, trial.scale, trial.light), failing.content, qr.size + trial.quiet * 2);
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
      if (batch.some(function (b) { return b.colours; })) {
        notes.push('Some rows set their own colours, and each was read back in them.');
      }
      const odd = batch.filter(function (b) { return b.frame.style !== 'none'; })
        .map(function (b) { return b.frame; })
        .filter(function (f) { return window.QRExport && !window.QRExport.fitsWinAnsi(f.text || ''); })[0];
      if (odd) frameFontNote(odd, notes);

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

    const pngW = () => clampNum(style.sizeSel.value, 64, 4096, 600);
    const dpiNow = () => clampNum(style.dpiSel.value, 72, 1200, 300);

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
            const got = window.QRDetect.scan(ctx.getImageData(0, 0, px, px), { invert: false });
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
      await loadZip();
      const kept = lastCount;
      const size = pngW(), dpi = dpiNow();
      /* The download is shut until the batch has been checked, so anything
         still marked failing here failed that check. */
      const usable = batch.filter(function (b) { return b.status === 'ok' || b.status === 'tight'; });
      const excluded = batch.length - usable.length;
      const files = [];
      const dropped = [];
      const token = progress.start('Checking and packing ' + usable.length + ' ' + ext.toUpperCase() + ' files…');
      let t0 = performance.now();

      for (let i = 0; i < usable.length; i++) {
        if (token.cancelled) {
          progress.end(token);
          setSummary(kept, false);
          note('Cancelled. Nothing was downloaded.', 'note');
          return null;
        }
        const item = usable[i];
        const blob = ext === 'svg'
          ? new Blob([item.svg], { type: 'image/svg+xml' })
          : await svgToPngBlob(item.svg, size, dpi);
        const ok = blob ? await decodePackaged(blob, item.content) : false;
        if (ok) files.push({ name: item.name + '.' + extOf(blob), blob: blob });
        else { dropped.push(item); markStatus(item, 'fail'); }

        if (performance.now() - t0 > 40) {
          progress.set(i + 1, usable.length);
          setSummary('Checking and packing ' + (i + 1) + ' of ' + usable.length + ' ' + ext.toUpperCase() + ' files…', true);
          await yieldFrame();
          t0 = performance.now();
        }
      }
      progress.end(token);

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
          (ext === 'png' ? ' at ' + size + ' px, so raise the PNG width in the Output panel' : '') + ': ' +
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

    /**
     * The label sheet: every code that passed, in the grid set in panel 6,
     * as vector artwork. Written a page at a time with a frame between, so a
     * hundred sheets keep the page responsive and can be cancelled.
     */
    async function sheetPdf() {
      const s = syncSheet();
      if (s.bad) { note(s.bad, 'error'); return null; }
      if (s.codeMm < 8) { note('At ' + s.codeMm.toFixed(1) + ' mm the codes would be too small to scan. Use bigger labels, a smaller text size or no text.', 'error'); return null; }
      await loadExport();
      const usable = batch.filter(function (b) { return b.status === 'ok' || b.status === 'tight'; });
      const items = usable.map(function (b) {
        return { svg: b.svg, text: underSel.value === 'content' ? b.content.replace(/\s+/g, ' ') : underSel.value === 'name' ? b.caption : '' };
      });
      const per = s.L.cols * s.L.rows;
      const token = progress.start('Writing ' + Math.ceil(items.length / per) + ' sheets…');
      try {
        const images = style.store.logo ? await imagesOf(usable[0] ? usable[0].svg : '') : {};
        const bytes = await window.QRExport.labelSheetPdf(items, s.L, images, async function (done, total) {
          progress.set(done, total, 'Writing sheet ' + done + ' of ' + total + '…');
          await yieldFrame();
          if (token.cancelled) throw new Error('cancelled');
        }, 'QR code labels');
        const excluded = batch.length - usable.length;
        note(items.length + ' codes on ' + Math.ceil(items.length / per) + ' sheet' + (Math.ceil(items.length / per) === 1 ? '' : 's') + ', each ' + s.codeMm.toFixed(1) + ' mm wide, as vector artwork.' +
          (excluded ? ' ' + excluded + ' that do not scan were left out.' : ''), excluded ? 'warn' : 'note');
        return new Blob([bytes], { type: 'application/pdf' });
      } catch (e) {
        note(e.message === 'cancelled' ? 'Cancelled. Nothing was downloaded.' : 'The sheet could not be written: ' + e.message, e.message === 'cancelled' ? 'note' : 'error');
        return null;
      } finally { progress.end(token); }
    }

    function listCsv() {
      const rows = [['file', 'type', 'content', 'check']];
      batch.forEach(function (b) { rows.push([b.name, b.type, b.content, statusLabel(b.status)]); });
      skipped.forEach(function (k) { rows.push(['', '', k.text, 'skipped (line ' + k.line + '): ' + k.why]); });
      return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    }

    let zipButtons = [];
    let printBtn = null;

    function paintActions() {
      acts.textContent = '';
      zipButtons = [];
      printBtn = null;
      if (!batch.length) return;

      const png = typedDownload('Download PNG (ZIP)',
        function () { return 'qr-codes-png'; }, function () { return zipOf('png'); });
      const svg = typedDownload('Download SVG (ZIP)',
        function () { return 'qr-codes-svg'; }, function () { return zipOf('svg'); });
      const pdf = typedDownload('Label sheet (PDF)',
        function () { return 'qr-labels'; }, sheetPdf);
      zipButtons = [['PNG', png], ['SVG', svg], ['PDF', pdf]];
      acts.appendChild(png);
      acts.appendChild(svg);
      acts.appendChild(pdf);

      /* The list is a record of the run, failures included, so it is never
         gated: knowing which rows did not make it is the point of it. */
      acts.appendChild(typedDownload('Download the list (CSV)',
        function () { return 'qr-codes'; },
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
      const unchecked = batch.some(function (b) { return b.status === 'unchecked'; });
      const bad = batch.filter(function (b) { return b.status === 'fail'; }).length;
      const good = batch.length - bad;
      zipButtons.forEach(function (pair) {
        const b = pair[1];
        const what = pair[0] === 'PDF' ? 'label sheet (PDF)' : pair[0] + ' (ZIP)';
        b.disabled = checking || unchecked || !good;
        b.textContent = checking ? 'Checking every code…'
          : unchecked ? 'Not every code was checked'
          : !good ? 'No code passed the check'
          : bad ? 'Download the ' + good + ' that passed (' + pair[0] + ')'
          : pair[0] === 'PDF' ? 'Label sheet (PDF)' : 'Download ' + what;
      });
      if (printBtn) {
        printBtn.disabled = checking || unchecked || !good;
        printBtn.textContent = bad && good ? 'Print the ' + good + ' that passed' : 'Print sheet';
      }
    }

    function paintStats() {
      if (!batch.length) { renderStats(stats, null); return; }
      const versions = batch.map(function (b) { return b.qr.version; });
      const lo = Math.min.apply(null, versions), hi = Math.max.apply(null, versions);
      const longest = batch.reduce(function (a, b) { return b.content.length > a.content.length ? b : a; });
      const densest = batch.reduce(function (a, b) { return b.qr.size > a.qr.size ? b : a; });
      const px = pngW();
      const types = {};
      batch.forEach(function (b) { types[b.type] = (types[b.type] || 0) + 1; });
      const rows = [
        ['Codes', String(batch.length)],
        ['Rows skipped', String(skipped.length)],
        ['Version', lo === hi ? String(lo) : lo + ' to ' + hi],
        ['Error correction', EC_LABELS[style.ecSel.value]],
        ['Longest content', longest.content.length + ' characters'],
        ['PNG export', px + ' x ' + px + ' px each, ' + dpiNow() + ' dpi'],
        ['Smallest safe print', Math.ceil((densest.qr.size + Number(style.quietSel.value) * 2) * 0.5) + ' mm wide']
      ];
      if (Object.keys(types).length > 1) {
        rows.splice(2, 0, ['Content types', Object.keys(types).map(function (t) { return types[t] + ' ' + QR_TYPES[t].label; }).join(', ')]);
      }
      renderStats(stats, rows);
    }

    /* ---- remembered settings ---- */

    /* Every setting in the panels, by id, plus the three shape pickers. The
       list itself is never stored: it is often names and phone numbers. */
    function settingsNow() {
      const o = { type: typeSel.value, shape: style.shapePick.read(), eye: style.framePick.read(), ball: style.ballPick.read(), v: {} };
      controls.querySelectorAll('input[id^="qr-"], select[id^="qr-"], .colour-swatch[data-name]').forEach(function (c) {
        if (c.id === 'qr-values' || c.id === 'qr-batch-file' || c.id === 'qr-logo' || c.type === 'file') return;
        const k = c.id || ('swatch-' + c.dataset.name);
        o.v[k] = c.type === 'checkbox' ? !!c.checked : c.value;
      });
      return o;
    }
    let rememberTimer = 0;
    let touched = false;
    function remember() {
      if (!touched) return;
      clearTimeout(rememberTimer);
      rememberTimer = setTimeout(function () { writeStore(STORE_KEYS.bulk, settingsNow()); }, 400);
    }
    function restoreSettings() {
      const s = readStore(STORE_KEYS.bulk);
      if (!s || typeof s !== 'object' || !s.v) return;
      if (s.type && QR_TYPES[s.type]) typeSel.value = s.type;
      Object.keys(s.v).forEach(function (k) {
        let c = null;
        if (k.indexOf('swatch-') === 0) {
          c = controls.querySelector('.colour-swatch[data-name="' + k.slice(7) + '"]');
          if (c && /^#[0-9a-f]{6}$/i.test(s.v[k])) {
            c.value = s.v[k];
            c.dispatchEvent(new Event('input'));    // the hex box beside it follows
          }
          return;
        }
        c = document.getElementById(k);
        if (!c || !controls.contains(c)) return;
        if (c.type === 'checkbox') c.checked = !!s.v[k];
        else c.value = s.v[k];
      });
      ['shape', 'eye', 'ball'].forEach(function (k, i) {
        const pick = [style.shapePick, style.framePick, style.ballPick][i];
        if (s[k]) pick.set(s[k]);
      });
    }

    /* ---- wiring ---- */

    let pending = 0;
    /** A change to the look rebuilds the batch; a change to the list waits for
        the button, because re-encoding two thousand codes on every keystroke
        would make the textarea unusable. */
    function scheduleRestyle() {
      style.syncVisibility();
      frameUi.syncFrame();
      remember();
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
      hint.textContent += ' Optional columns: type (to mix content types in one list), colour and background (#rrggbb, per row), caption (the text under each code on a label sheet).';
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
      overrides = null;
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
      reader.onerror = function () { note('“' + f.name + '” could not be read.', 'error'); };
      reader.readAsText(f);
      fileIn.value = '';
    });

    /* The logo input is left out on purpose: picking a file fires `change`
       before the file has been read, so reacting to it would rebuild the whole
       batch once without the logo and again with it. The style controls call
       back themselves once the image is actually in hand. The label sheet
       fields only shape the PDF, so they do not rebuild the batch either. */
    const ownEvents = [typeSel, area, fileIn];
    const mine = (t) => ownEvents.indexOf(t) >= 0 || (t && t.id === 'qr-logo') || sheetBody.contains(t);
    controls.addEventListener('change', function (e) { touched = true; if (!mine(e.target)) scheduleRestyle(); else remember(); });
    controls.addEventListener('input', function (e) { touched = true; if (!mine(e.target)) scheduleRestyle(); else remember(); });

    restoreSettings();
    style.syncVisibility();
    frameUi.syncFrame();
    syncHint();
    build();
  }

  /* The label presets live in qr-export.js; the page needs their names
     before that file has arrived, so the grid figures are repeated here.
     build/tests/qr-fixes.js checks the two lists match. */
  const LABEL_PRESETS_UI = {
    'a4-21': { name: 'A4, 21 per sheet, 63.5 x 38.1 mm (as L7160)', page: 'a4', cols: 3, rows: 7, w: 63.5, h: 38.1, top: 15.15, left: 7.21, gapX: 2.54, gapY: 0 },
    'a4-24': { name: 'A4, 24 per sheet, 63.5 x 33.9 mm (as L7159)', page: 'a4', cols: 3, rows: 8, w: 63.5, h: 33.9, top: 12.9, left: 7.21, gapX: 2.54, gapY: 0 },
    'a4-14': { name: 'A4, 14 per sheet, 99.1 x 38.1 mm (as L7163)', page: 'a4', cols: 2, rows: 7, w: 99.1, h: 38.1, top: 15.15, left: 4.65, gapX: 2.5, gapY: 0 },
    'a4-10': { name: 'A4, 10 per sheet, 99.1 x 57 mm (as L7173)', page: 'a4', cols: 2, rows: 5, w: 99.1, h: 57, top: 6, left: 4.65, gapX: 2.5, gapY: 0 },
    'a4-65': { name: 'A4, 65 per sheet, 38.1 x 21.2 mm (as L7651)', page: 'a4', cols: 5, rows: 13, w: 38.1, h: 21.2, top: 10.7, left: 4.67, gapX: 2.54, gapY: 0 },
    'letter-30': { name: 'US Letter, 30 per sheet, 2.625 x 1 in (as 5160)', page: 'letter', cols: 3, rows: 10, w: 66.675, h: 25.4, top: 12.7, left: 4.7625, gapX: 3.175, gapY: 0 },
    'letter-10': { name: 'US Letter, 10 per sheet, 4 x 2 in (as 5163)', page: 'letter', cols: 2, rows: 5, w: 101.6, h: 50.8, top: 12.7, left: 3.96875, gapX: 4.7625, gapY: 0 }
  };
  const PAGES_UI = { a4: [210, 297], letter: [215.9, 279.4] };
  function checkLayoutUI(L) {
    if (window.QRExport) return window.QRExport.checkLayout(L);
    const needW = L.left + L.cols * L.w + (L.cols - 1) * L.gapX, needH = L.top + L.rows * L.h + (L.rows - 1) * L.gapY;
    if (!(L.cols >= 1 && L.rows >= 1 && L.w > 0 && L.h > 0)) return 'Columns, rows and the label size must all be above zero.';
    if (needW > L.pageW + 0.01) return 'The labels run ' + (Math.round((needW - L.pageW) * 100) / 100) + ' mm off the right of the page.';
    if (needH > L.pageH + 0.01) return 'The labels run ' + (Math.round((needH - L.pageH) * 100) / 100) + ' mm off the bottom of the page.';
    return '';
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
      mode: 'idle', last: '', misses: 0, altPass: false, history: [],
      nativeFormats: [], screen: false, lastSource: 'camera', keep: true
    };
    const Bars = window.QRBarcode || null;

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

    /* A code on this computer's own screen — in an email, a PDF, a meeting
       — is read by sharing the screen or one window with the page, which
       reads it the same way as a camera. Phones cannot share a screen with
       a page, so the button only appears where the browser offers it. */
    const screenBtn = el('button', 'btn-ghost', 'Scan from screen');
    screenBtn.type = 'button';
    screenBtn.dataset.act = 'screen';
    screenBtn.hidden = !(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

    controls.appendChild(startBtn);
    controls.appendChild(screenBtn);
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
    drop.appendChild(el('strong', null, 'Or scan pictures of codes'));
    drop.appendChild(el('span', null, 'Drop one image or many here, paste one, or tap to choose files'));
    const fileInput = el('input', 'visually-hidden');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = true;
    drop.appendChild(fileInput);
    io.appendChild(drop);

    /* Which formats this browser reads, and by what, said plainly: the
       browser's own detector reads more symbologies than this site's
       readers do, and pretending otherwise would send someone away with a
       Data Matrix code nobody read. */
    const formatsNote = el('p', 'scan-formats');
    io.appendChild(formatsNote);

    /* ---- many pictures at once ---- */

    const batchWrap = el('section', 'scan-batch');
    batchWrap.hidden = true;
    io.appendChild(batchWrap);

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
      camWrap.hidden = mode !== 'live' || state.devices.length < 2 || state.screen;
      torchBtn.hidden = mode !== 'live' || !state.hasTorch || state.screen;
      screenBtn.hidden = mode !== 'idle' || !(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
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
    const WANT_FORMATS = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93',
      'codabar', 'itf', 'data_matrix', 'pdf417', 'aztec'];
    const OWN_FORMATS = ['qr_code'].concat(Bars ? Bars.formats : []);
    const formatName = (f) => (Bars && Bars.names[f]) || (f === 'qr_code' ? 'QR code' : String(f || ''));

    async function initNative() {
      if (state.nativeTried) return;
      state.nativeTried = true;
      if ('BarcodeDetector' in window) {
        try {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          const use = WANT_FORMATS.filter(function (f) { return formats.indexOf(f) >= 0; });
          if (use.length) {
            state.native = new window.BarcodeDetector({ formats: use });
            state.nativeFormats = use;
          }
        } catch (e) { state.native = null; state.nativeFormats = []; }
      }
      paintFormats();
    }

    /** What this browser can read, and which reader does it. */
    function paintFormats() {
      const own = OWN_FORMATS.map(formatName);
      const nativeOnly = state.nativeFormats.filter(function (f) { return OWN_FORMATS.indexOf(f) < 0; }).map(formatName);
      const missing = WANT_FORMATS.filter(function (f) { return OWN_FORMATS.indexOf(f) < 0 && state.nativeFormats.indexOf(f) < 0; }).map(formatName);
      const and = (l) => l.length > 1 ? l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1] : l.join('');
      let t = 'Reads ' + and(own) + ' with this site’s own readers';
      if (state.native) t += ', using the browser’s built-in detector first' + (nativeOnly.length ? ', which also reads ' + and(nativeOnly) : '');
      t += '. ';
      if (missing.length) {
        t += and(missing) + ' need a browser with a built-in barcode detector (Chrome on Android, ChromeOS or a Mac), and ' +
          (state.native ? 'this one does not offer them.' : 'this browser has none.');
      }
      formatsNote.textContent = t;
    }

    function nativeOwnsLinear() {
      return state.nativeFormats.indexOf('ean_13') >= 0 && state.nativeFormats.indexOf('code_128') >= 0;
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
          const good = (found || []).filter(function (f) { return f.rawValue; });
          if (good.length) {
            const first = { text: good[0].rawValue, format: good[0].format, native: true, corners: good[0].cornerPoints || null };
            first.more = good.slice(1).map(function (f) { return { text: f.rawValue, format: f.format, native: true }; });
            return first;
          }
        } catch (e) { state.native = null; }
      }
      state.altPass = !state.altPass;
      const side = Math.min(width, height);
      let view;
      if (state.screen) {
        /* a shared screen is wide and its codes small: read it whole, sharper */
        view = [0, 0, width, height, 1600];
      } else if (state.altPass && side > 520) {
        const box = Math.round(side * 0.62);
        view = [Math.round((width - box) / 2), Math.round((height - box) / 2), box, box, CROP_MAX];
      } else {
        view = [0, 0, width, height, FULL_MAX];
      }
      /* Every third frame is read with its grey levels flipped, for a
         light-on-dark code (a phone in dark mode, white print on navy).
         Trying both on every frame would double the cost of each empty
         look; this way a frame still costs one read, and with the views
         alternating, the flipped read lands on each view in turn. */
      state.frameNo = (state.frameNo || 0) + 1;
      const flipped = state.frameNo % 3 === 0;
      const data = grab(source, view[0], view[1], view[2], view[3], view[4]);
      const got = Detect.scan(data, { invert: flipped ? 'only' : false });
      if (got) { got.format = 'qr_code'; return got; }
      /* Every other frame, the same pixels are searched for a product
         barcode, unless the browser's detector already looks for them. */
      if (Bars && !nativeOwnsLinear() && state.frameNo % 2 === 0) {
        const bars = Bars.scan(data, { lines: 14 });
        if (bars.length) {
          const first = Object.assign({}, bars[0]);
          first.more = bars.slice(1);
          return first;
        }
      }
      return null;
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
            const from = state.screen ? 'screen' : 'camera';
            stop('', 'note', true);
            showResult(got, from, shot, got.more);
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
      /* a hidden tab gets no animation frames, and a shared screen is often
         read while another window is in front */
      if (state.screen && document.hidden) setTimeout(loop, 250);
      else requestAnimationFrame(loop);
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

    const AIM = 'Point the camera at a QR code or barcode. It reads on its own.';

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
      state.screen = false;
      state.lastSource = 'camera';
      state.resumeOnShow = false;
      startBtn.textContent = 'Stop camera';
      setMode('live');
      note(AIM, 'note');
      state.busy = false;
      initNative();
      if (!looping) loop();
    }

    /**
     * Read codes off this computer's screen: the browser asks which screen,
     * window or tab to share, and its frames go through the same loop as a
     * camera's. Nothing is recorded; sharing ends when a code is read, when
     * Stop is pressed, or from the browser's own Stop sharing bar.
     */
    async function startScreen() {
      if (state.busy) return;
      state.busy = true;
      note('Choose the screen, window or tab that shows the code…', 'note');
      let stream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 10 } }, audio: false });
      } catch (e) {
        state.busy = false;
        stop(e && e.name === 'NotAllowedError' ? 'Screen sharing was cancelled, so there is nothing to read.' : 'The screen could not be shared: ' + ((e && e.message) || 'unknown error') + '.', 'warn');
        return;
      }
      releaseStream();
      state.stream = stream;
      state.track = stream.getVideoTracks()[0] || null;
      if (state.track) {
        state.track.addEventListener('ended', function () {
          if (state.running && state.screen) stop('Screen sharing ended.', 'note');
        });
      }
      video.srcObject = stream;
      try { await video.play(); } catch (e) { /* frames still arrive */ }
      await firstFrame();
      frame.classList.remove('is-mirrored');
      frame.classList.add('is-live');
      placeholder.hidden = true;
      state.last = '';
      state.misses = 0;
      state.screen = true;
      state.lastSource = 'screen';
      state.running = true;
      state.resumeOnShow = false;
      startBtn.textContent = 'Stop sharing';
      setMode('live');
      note('Reading the shared screen. Bring the code into view; it reads on its own.', 'note');
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
      const wasScreen = state.screen;
      state.screen = false;
      if (!keepMode) setMode('idle');
      note(message === undefined ? (wasScreen ? 'Screen sharing stopped.' : 'Camera stopped.') : message, kind || 'note');
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

    /* The pictures are searched in a worker, so a large photo, or a hundred
       of them, never holds up the page. Where workers are not available the
       same readers run here instead. */
    let worker = null, workerSeq = 0;
    const workerWaits = {};
    function getWorker() {
      if (worker !== null) return worker;
      try {
        worker = new Worker((window.__BASE__ || '/') + 'engine/qr-scan-worker.js');
        worker.onmessage = function (e) {
          const w = workerWaits[e.data.id];
          if (w) { delete workerWaits[e.data.id]; w(e.data); }
        };
        worker.onerror = function () {
          worker = false;                                   // run in the page from now on
          Object.keys(workerWaits).forEach(function (k) { const w = workerWaits[k]; delete workerWaits[k]; w(null); });
        };
      } catch (e) { worker = false; }
      return worker;
    }
    function searchPixels(views, bars) {
      const w = getWorker();
      const here = function () {
        const codes = [];
        for (const v of views) {
          const list = Detect.scanAll ? Detect.scanAll(v.data) : [Detect.scan(v.data)].filter(Boolean);
          if (list.length) { list.forEach(function (g) { g.format = 'qr_code'; g.view = v.view; codes.push(g); }); break; }
        }
        if (bars && Bars) Bars.scan(bars).forEach(function (b) { codes.push(b); });
        return codes;
      };
      if (!w) return Promise.resolve(here());
      return new Promise(function (resolve) {
        const id = ++workerSeq;
        workerWaits[id] = function (msg) { resolve(msg && !msg.error ? msg.codes : here()); };
        try { w.postMessage({ id: id, views: views, bars: bars }); }
        catch (e) { delete workerWaits[id]; resolve(here()); }
      });
    }

    /** Pixels of part of a picture, with the window they came from. */
    function viewOf(img, sx, sy, sw, sh, max) {
      const data = grab(img, sx, sy, sw, sh, max);
      return { data: data, view: lastView };
    }
    const mapCorners = (corners, v) => corners && v ? corners.map(function (pt) {
      return { x: v.sx + pt.x * (v.sw / v.cw), y: v.sy + pt.y * (v.sh / v.ch) };
    }) : null;

    /**
     * Every code in one picture: the browser's detector first where there is
     * one, then this site's readers for whatever it does not cover. A code
     * small in a large photo survives a second look at full resolution, so a
     * few sizes, and the middle of the picture on its own, are tried before
     * giving up on QR codes; linear barcodes are searched once, sharp.
     */
    async function readPicture(img) {
      await initNative();
      const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
      const codes = [];
      const seen = {};
      const add = function (c) {
        const k = (c.format || 'qr_code') + '\u0000' + c.text;
        if (seen[k]) return;
        seen[k] = 1;
        codes.push(c);
      };
      if (state.native) {
        try {
          grab(img, 0, 0, W, H, 2200);
          const v = lastView;
          const found = await state.native.detect(canvas);
          (found || []).forEach(function (f) {
            if (f.rawValue) add({ text: f.rawValue, format: f.format, native: true, corners: mapCorners(f.cornerPoints, v) });
          });
        } catch (e) { state.native = null; }
      }
      const nativeQr = codes.some(function (c) { return c.format === 'qr_code'; });
      const side = Math.min(W, H), box = Math.round(side * 0.7);
      const views = nativeQr ? [] : [
        viewOf(img, 0, 0, W, H, 700),
        viewOf(img, 0, 0, W, H, 1400),
        viewOf(img, Math.round((W - box) / 2), Math.round((H - box) / 2), box, box, 1400),
        viewOf(img, 0, 0, W, H, 2200)
      ];
      const bars = Bars && !nativeOwnsLinear() ? grab(img, 0, 0, W, H, 1800) : null;
      const own = await searchPixels(views, bars);
      own.forEach(function (c) {
        if (c.corners) c.corners = mapCorners(c.corners, c.view);
        add(c);
      });
      return { codes: codes, W: W, H: H };
    }

    function openImage(file) {
      return new Promise(function (resolve) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });
    }

    async function scanFile(file) {
      if (!file || !/^image\//.test(file.type)) {
        note((file && file.name ? '“' + file.name + '” is' : 'That file is') + ' not an image.', 'error');
        return;
      }
      if (state.running) stop('', 'note', true);
      note('Looking for codes in that picture…', 'note');
      const img = await openImage(file);
      if (!img) { note('That image could not be opened.', 'error'); return; }
      const got = await readPicture(img);
      if (got.codes.length) {
        const first = got.codes[0];
        showResult(first, 'image', freezeFrame(img, got.W, got.H, first.corners || null), got.codes.slice(1));
      } else {
        note('No QR code or barcode was found in that image. A sharper picture, or one with the whole code and a little space around it, usually does it.', 'warn');
      }
    }

    /* ---- many pictures ---- */

    let batchRows = [];
    let batchToken = null;

    /**
     * Read a pile of pictures one after another and list every code in
     * every one, with a CSV of the lot. A file that is not a picture, will
     * not open, or holds no code is listed by name with the reason — never
     * skipped quietly.
     */
    async function scanBatch(files) {
      if (state.running) stop('', 'note', true);
      if (batchToken) batchToken.cancelled = true;
      const token = { cancelled: false };
      batchToken = token;
      batchRows = [];
      batchWrap.hidden = false;
      batchWrap.textContent = '';
      batchWrap.appendChild(el('h2', null, 'Pictures read'));
      const bar = progressUI(batchWrap);
      const t = bar.start('Reading ' + files.length + ' pictures…');
      bar.el.querySelector('.qr-progress-cancel').addEventListener('click', function () { token.cancelled = true; });
      const tableWrap = el('div', 'scan-batch-table');
      const table = el('table');
      const head = el('tr');
      ['Picture', 'Format', 'What it is', 'Content'].forEach(function (h) { head.appendChild(el('th', null, h)); });
      const thead = el('thead'); thead.appendChild(head); table.appendChild(thead);
      const tbody = el('tbody'); table.appendChild(tbody);
      tableWrap.appendChild(table);
      const sum = el('p', 'scan-batch-sum');
      const acts2 = el('div', 'io-actions');
      batchWrap.appendChild(sum);
      batchWrap.appendChild(acts2);
      batchWrap.appendChild(tableWrap);

      const addRow = function (r) {
        batchRows.push(r);
        const tr = el('tr', r.error ? 'is-error' : '');
        tr.appendChild(el('td', null, r.file));
        tr.appendChild(el('td', null, r.error ? '—' : formatName(r.format)));
        tr.appendChild(el('td', null, r.error ? r.error : r.kind));
        const td = el('td', 'scan-batch-text', r.error ? '' : (r.text.length > 120 ? r.text.slice(0, 120) + '…' : r.text));
        tr.appendChild(td);
        tbody.appendChild(tr);
      };

      let codes = 0, failed = 0;
      for (let i = 0; i < files.length; i++) {
        if (token.cancelled) break;
        const f = files[i];
        bar.set(i, files.length, 'Reading ' + (i + 1) + ' of ' + files.length + ': ' + f.name);
        if (!/^image\//.test(f.type)) { addRow({ file: f.name, error: 'not an image' }); failed++; continue; }
        const img = await openImage(f);
        if (!img) { addRow({ file: f.name, error: 'could not be opened' }); failed++; continue; }
        const got = await readPicture(img);
        if (!got.codes.length) { addRow({ file: f.name, error: 'no code found' }); failed++; }
        got.codes.forEach(function (c) {
          const info = infoFor(c);
          addRow({ file: f.name, format: c.format || 'qr_code', kind: info.kind, text: c.text });
          addHistory(c.text, info.kind, c.format);
          codes++;
        });
        await yieldFrame();
      }
      bar.end(t);
      const stopped = token.cancelled;
      sum.textContent = (stopped ? 'Stopped. ' : '') + codes + ' code' + (codes === 1 ? '' : 's') + ' read from ' +
        (files.length - failed) + ' of ' + files.length + ' pictures' + (failed ? '; ' + failed + ' gave nothing, listed with the reason' : '') + '.';
      acts2.appendChild(typedDownload('Download the list (CSV)', 'scanned-codes', function () {
        const rows = [['file', 'format', 'kind', 'content', 'error']].concat(batchRows.map(function (r) {
          return [r.file, r.error ? '' : formatName(r.format), r.error ? '' : r.kind, r.error ? '' : r.text, r.error || ''];
        }));
        return new Blob(['﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      }));
      acts2.appendChild(copyButton(function () { return batchRows.filter(function (r) { return !r.error; }).map(function (r) { return r.text; }).join('\n'); }, 'Copy every code'));
      note(codes ? codes + ' code' + (codes === 1 ? '' : 's') + ' read. The list is below.' : 'No code was found in those pictures.', codes ? 'note' : 'warn');
      document.dispatchEvent(new CustomEvent('mvr:tool-used'));
    }

    function takeFiles(list) {
      const files = Array.prototype.slice.call(list || []);
      if (!files.length) return;
      if (files.length === 1) scanFile(files[0]);
      else scanBatch(files);
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
          (got.mirrored ? ' · mirrored' : '') +
          (got.inverted ? ' · light on dark' : '');
      }
      const how = got.native ? 'Read with the browser’s built-in detector' : 'Read with this site’s own reader';
      if (got.format && got.format !== 'qr_code') {
        return formatName(got.format) + ' · ' + how.charAt(0).toLowerCase() + how.slice(1) +
          (got.lines ? ' · matched on ' + got.lines + ' scan line' + (got.lines === 1 ? '' : 's') : '');
      }
      return got.native ? how : '';
    }

    /**
     * A product number is not text to copy blindly: say what kind it is and
     * whether its check digit adds up, which is what tells a misread from a
     * real code. Nothing here looks the number up anywhere.
     */
    /* 978 + nine digits + check: the ten-digit ISBN is the nine with a
       mod-11 check, weights 10 down to 2, where 10 is written X */
    function isbn10(d13) {
      const core = d13.slice(3, 12);
      let s = 0;
      for (let i = 0; i < 9; i++) s += Number(core[i]) * (10 - i);
      const c = (11 - s % 11) % 11;
      return core + (c === 10 ? 'X' : String(c));
    }

    function infoFor(got) {
      const f = got.format || 'qr_code';
      if (f === 'qr_code' || !/^(ean_13|ean_8|upc_a|upc_e|itf)$/.test(f)) {
        const info = classifyPayload(got.text);
        if (f !== 'qr_code') info.kind = info.kind + ' · ' + formatName(f);
        return info;
      }
      const digits = String(got.text);
      const ok = /^\d+$/.test(digits) && (Bars ? Bars.gs1Check(digits.slice(0, -1).split('').map(Number)) === Number(digits.slice(-1)) : true);
      const isbn = f === 'ean_13' && /^97[89]/.test(digits);
      return {
        kind: isbn ? 'Book number (ISBN) · EAN-13' : f === 'itf' ? 'Shipping or carton number · ITF' : 'Product barcode · ' + formatName(f),
        headline: digits,
        icon: 'text',
        fields: [['Format', formatName(f)], ['Number', digits],
          ['Check digit', /^(ean_13|ean_8|upc_a)$/.test(f) || digits.length === 14 ? (ok ? 'Correct' : 'Does not add up') : 'This format has none']]
          /* ISBN-13 as printed without hyphens (placing them needs the
             registration-group tables), and for 978 the old ten-digit form */
          .concat(isbn ? [['ISBN-13', digits]] : [])
          .concat(isbn && ok && /^978/.test(digits) ? [['ISBN-10', isbn10(digits)]] : []),
        copy: { label: 'Copy the number', value: digits }
      };
    }

    /**
     * What was read, where the camera was.
     *
     * The shape is deliberate: what it is, then whether it is safe, then the
     * one thing you probably want to do, and only then the detail. The old
     * card led with a table of fields and buried the action under it.
     */
    function showResult(got, source, shot, more) {
      state.last = got.text;
      state.misses = 0;
      result.textContent = '';
      result.appendChild(buildCard(got, source, shot));
      const extra = (more || []).filter(function (m) { return m && m.text; });
      if (extra.length) {
        result.appendChild(el('p', 'scan-more', 'Also in this ' + (source === 'image' ? 'picture' : 'frame') + ': ' +
          extra.length + ' more code' + (extra.length === 1 ? '' : 's') + '.'));
        extra.forEach(function (m) { result.appendChild(buildCard(m, source, null)); });
      }
      finishResult([got].concat(extra));
    }

    function buildCard(got, source, shot) {
      const info = infoFor(got);
      const card = el('div', 'scan-card');

      /* what it is, with the thing it was read from beside it */
      const head = el('div', 'scan-head');
      head.appendChild(kindIcon(info.icon));
      const headText = el('div', 'scan-head-text');
      headText.appendChild(el('span', 'scan-kind',
        info.kind + (source === 'image' ? ' · from your picture' : source === 'screen' ? ' · from your screen' : '')));
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
      return card;
    }

    function finishResult(list) {
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

      list.slice().reverse().forEach(function (g) { addHistory(g.text, infoFor(g).kind, g.format); });
      document.dispatchEvent(new CustomEvent('mvr:tool-used'));

      if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
    }

    /* ---- the history ---- */

    /* Scans are kept in this browser's storage, newest first, so a code read
       yesterday can be found again. It never leaves the device, the switch
       below turns it off (and empties it), and Clear empties it at once. */
    const HISTORY_MAX = 100;
    function loadHistory() {
      const prefs = readStore(STORE_KEYS.scanner);
      state.keep = !(prefs && prefs.keep === false);
      const saved = state.keep ? readStore(STORE_KEYS.scans) : null;
      state.history = Array.isArray(saved) ? saved.filter(function (h) { return h && typeof h.text === 'string'; })
        .map(function (h) { return { text: h.text, kind: String(h.kind || ''), format: h.format || 'qr_code', at: new Date(h.at || Date.now()) }; }) : [];
    }
    function saveHistory() {
      if (!state.keep) return;
      writeStore(STORE_KEYS.scans, state.history.map(function (h) { return { text: h.text, kind: h.kind, format: h.format, at: h.at.getTime() }; }));
    }

    function addHistory(text, kind, format) {
      if (state.history.length && state.history[0].text === text) return;
      state.history.unshift({ text: text, kind: kind, format: format || 'qr_code', at: new Date() });
      state.history = state.history.slice(0, HISTORY_MAX);
      saveHistory();
      renderHistory();
    }

    function renderHistory() {
      historyWrap.textContent = '';
      const h = el('h2', null, 'Scan history');
      historyWrap.appendChild(h);
      const keepRow = el('div', 'field field-check scan-keep');
      const keepBox = el('input');
      keepBox.type = 'checkbox';
      keepBox.id = 'scan-keep';
      keepBox.checked = state.keep;
      const keepLab = el('label', null, 'Keep a history of scans on this device');
      keepLab.setAttribute('for', 'scan-keep');
      keepRow.appendChild(keepBox);
      keepRow.appendChild(keepLab);
      historyWrap.appendChild(keepRow);
      keepBox.addEventListener('change', function () {
        state.keep = keepBox.checked;
        writeStore(STORE_KEYS.scanner, { keep: state.keep });
        if (state.keep) saveHistory();
        else writeStore(STORE_KEYS.scans, null);
        renderHistory();
      });
      historyWrap.appendChild(el('p', 'scan-history-note', state.keep
        ? 'Kept in this browser’s storage on this device, the last ' + HISTORY_MAX + ' scans, until you clear them. Nothing is sent anywhere.'
        : 'Off: scans are listed for this visit only and nothing is stored.'));
      if (!state.history.length) {
        historyWrap.appendChild(el('p', 'scan-history-empty', 'Nothing scanned yet.'));
        return;
      }
      const list = el('ul', 'scan-history-list');
      state.history.forEach(function (item) {
        const li = el('li');
        const sameDay = item.at.toDateString() === new Date().toDateString();
        const time = sameDay ? item.at.toLocaleTimeString() : item.at.toLocaleString();
        li.appendChild(el('span', 'scan-history-kind', item.kind));
        const t = el('span', 'scan-history-text', item.text.length > 90 ? item.text.slice(0, 90) + '…' : item.text);
        li.appendChild(t);
        li.appendChild(el('span', 'scan-history-time', time));
        li.appendChild(copyButton(function () { return item.text; }, 'Copy'));
        list.appendChild(li);
      });
      historyWrap.appendChild(list);
      const row = el('div', 'io-actions');
      const clear = el('button', 'btn-ghost', 'Clear history');
      clear.type = 'button';
      clear.addEventListener('click', function () {
        state.history = [];
        writeStore(STORE_KEYS.scans, null);
        renderHistory();
      });
      row.appendChild(typedDownload('Download history (CSV)', 'scan-history', function () {
        const rows = [['when', 'format', 'kind', 'content']].concat(state.history.map(function (x) {
          return [x.at.toISOString(), formatName(x.format), x.kind, x.text];
        }));
        return new Blob(['﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      }));
      row.appendChild(clear);
      historyWrap.appendChild(row);
    }

    /* ---- wiring ---- */

    startBtn.addEventListener('click', function () {
      if (state.running) stop();
      else start(state.devices.length > 1 ? (camSel.value || null) : null);
    });

    /* Back to the camera that just worked, not to a cold start; or back to
       sharing the screen, if that is what read the last code. */
    againBtn.addEventListener('click', function () {
      result.textContent = '';
      setMode('idle');
      if (state.lastSource === 'screen') startScreen();
      else start(state.deviceId || null);
    });
    screenBtn.addEventListener('click', function () { if (!state.running) startScreen(); });
    camSel.addEventListener('change', function () { switchTo(camSel.value); });
    torchBtn.addEventListener('click', toggleTorch);

    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files.length) takeFiles(fileInput.files);
      fileInput.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) takeFiles(e.dataTransfer.files);
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
        if (!state.running || state.screen) return;   // sharing the screen means looking elsewhere
        const id = state.deviceId;
        stop('Camera released while this tab was in the background. It comes back when you return.', 'note');
        state.resumeOnShow = true;
        state.resumeId = id;
      } else if (state.resumeOnShow) {
        state.resumeOnShow = false;
        start(state.resumeId || null);
      }
    });

    loadHistory();
    renderHistory();
    paintFormats();
    initNative();
    setMode('idle');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      startBtn.disabled = true;
      note('This browser will not give a page access to the camera. You can still scan a picture of a code below.', 'warn');
    } else if (!window.isSecureContext) {
      startBtn.disabled = true;
      note('Browsers only allow camera access on secure (https) pages. Scanning a picture of a code still works here.', 'warn');
    } else {
      note('Point the camera at a QR code or barcode, or scan pictures of them below.', 'note');
    }
  }

  /**
   * The SVG as a PNG `size` pixels wide (a framed code is taller, in
   * proportion). With `dpi`, the PNG's pHYs chunk says so, so a layout
   * program places it at the intended physical size. Resolves null when the
   * browser cannot make a canvas that large.
   */
  function svgToPngBlob(svg, size, dpi) {
    return new Promise(function (resolve) {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const box = svgBox(svg);
      img.onload = async function () {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = Math.max(1, Math.round(size * box.h / box.w));
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
        if (!blob || !dpi) { resolve(blob); return; }
        try {
          await loadExport();
          const bytes = window.QRExport.pngSetDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
          resolve(new Blob([bytes], { type: 'image/png' }));
        } catch (e) { resolve(blob); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
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

  window.MVRTool = window.MVRTool || {};
  window.MVRTool.mountQR = mountQR;
  window.MVRTool.mountQRScanner = mountQRScanner;
  window.MVRTool.mountQRBulk = mountQRBulk;
})();
