/**
 * Claims on the QR tools' pages (/qr/): the encoder and reader in Node
 * (engine/qr.bundle.js and engine/qr-detect.js, as the pages load them), and
 * the generator, scanner and bulk pages in Chrome.
 */
'use strict';

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node', B = 'browser';
  const Q = () => K.qr();
  const enc = (t, l) => Q().QR.encode(t, l || 'M');
  const fits = (t, l) => { try { return enc(t, l).version; } catch (e) { return null; } };

  /* ================================================================ */
  const G = '/qr/qr-code-generator/';
  claim(G, 'faq', 'Up to 2,953 bytes at error-correction level L, or 1,273 at level H.', '2,953 fit at L, 2,954 do not; 1,273 / 1,274 at H', N, async () => {
    const a = fits('x'.repeat(2953), 'L'), b = fits('x'.repeat(2954), 'L'), c = fits('x'.repeat(1273), 'H'), d = fits('x'.repeat(1274), 'H');
    return [a === 40 && b === null && c === 40 && d === null, [a, b, c, d].join(', ')];
  });
  claim(G, 'what', 'At level L, version 40 holds 7,089 digits but only 4,296 upper-case characters.', 'capacity(40, L)', N, async () => {
    const c = Q().QR.capacity(40, 'L'); return [c.numeric === 7089 && c.alnum === 4296 && fits('1'.repeat(7089), 'L') === 40 && fits('A'.repeat(4296), 'L') === 40 && fits('A'.repeat(4297), 'L') === null, K.j(c)];
  });
  claim(G, 'dfaq', 'HTTPS://MENU.EXAMPLE.COM/TABLE/12 fits version 2 at level M, while in lower case it needs version 3.', 'both cases at M', N, async () => {
    const a = fits('HTTPS://MENU.EXAMPLE.COM/TABLE/12', 'M'), b = fits('https://menu.example.com/table/12', 'M'); return [a === 2 && b === 3, a + ' / ' + b];
  });
  claim(G, 'point', 'A cheapest-path search splits the text into numeric, alphanumeric and byte segments; byte mode writes UTF-8.', 'mixed content gets mixed segments; é round-trips', N, async () => {
    const q = enc('order 0123456789012345 ABC');
    const modes = q.segments.map((s) => s.mode).join(',');
    const d = Q().QR.decode(enc('café').matrix);
    return [/numeric/.test(modes) && d.text === 'café', modes + '; café → ' + d.text];
  });
  claim(G, 'dfaq', 'Yes, as UTF-8 in byte mode, at 4 bytes for most emoji.', '3 emoji fit version 1 at M (14 bytes), 4 need version 2', N, async () => {
    const a = fits('😀😀😀', 'M'), b = fits('😀😀😀😀', 'M'); const d = Q().QR.decode(enc('😀').matrix).text;
    return [a === 1 && b === 2 && d === '😀', a + ' / ' + b + ', decoded ' + d];
  });
  claim(G, 'point', 'The smallest version that fits the chosen level is used', 'one character more than v1-M holds moves to v2', N, async () => {
    const cap = Q().QR.capacity(1, 'M').bytes; const a = fits('x'.repeat(cap), 'M'), b = fits('x'.repeat(cap + 1), 'M');
    return [a === 1 && b === 2, cap + ' bytes → v' + a + ', ' + (cap + 1) + ' → v' + b];
  });
  claim(G, 'faq', 'After the matrix is built it is decoded again — format information, mask, de-interleaving and every Reed-Solomon block — and the result is compared with the text you entered.', 'verify() decodes the matrix and compares', N, async () => {
    const q = enc('https://www.1234tools.com/'); const v = Q().QR.verify(q);
    const bad = JSON.parse(JSON.stringify(q)); bad.text = 'something else';
    const v2 = Q().QR.verify(bad);
    return [v.ok === true && v.decoded === q.text && v2.ok === false, 'ok ' + v.ok + ', tampered ' + v2.ok];
  });
  const genPage = async (fn) => { const p = await K.open(G, { wait: '#qr-type' }); try { return await fn(p); } finally { await p.close(); } };
  const setField = (p, sel, v) => p.evaluate((sel, v) => { const e = document.querySelector(sel); if (!e) throw new Error('no ' + sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
  const verdict = async (p) => { await p.waitForFunction(() => { const v = document.querySelector('.qr-verdict'); return v && v.textContent && !/Checking/.test(v.textContent); }, { timeout: 30000 }); await K.sleep(300); return p.$eval('.qr-verdict', (e) => e.textContent); };
  claim(G, 'faq', 'Semicolons, commas and backslashes in a password are escaped for you.', 'WiFi password a;b,c\\d is written a\\;b\\,c\\\\d', B, async () => genPage(async (p) => {
    await setField(p, '#qr-type', 'wifi');
    await p.waitForSelector('#f-ssid');
    await setField(p, '#f-ssid', 'Cafe'); await setField(p, '#f-pass', 'a;b,c\\d');
    await verdict(p);
    await p.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } } }); });
    await K.clickText(p, '.qr-actions button', /Copy content/);
    const t = await p.evaluate(() => window.__copied);
    return [t === 'WIFI:T:WPA;S:Cafe;P:a\\;b\\,c\\\\d;;', K.j(t)];
  }));
  claim(G, 'tip', 'which is why the check warns when you drop below four modules.', 'quiet zone 2 brings the warning', B, async () => genPage(async (p) => {
    const q = await p.$('#qr-quiet');
    if (!q) return [false, 'no quiet-zone control'];
    const vals = await p.$$eval('#qr-quiet option', (l) => l.map((o) => o.value));
    const small = vals.map(Number).filter((v) => v < 4).sort((a, b) => b - a)[0];
    await setField(p, '#qr-quiet', String(small));
    const v = await verdict(p);
    return [/quiet zone under 4 modules/i.test(v), 'quiet ' + small + ': ' + v.slice(0, 160)];
  }));
  claim(G, 'mistake', 'This site\'s scanner reads it, but many phone cameras do not, so only a dark-on-light code earns Verified.', 'swapped colours are not Verified', B, async () => genPage(async (p) => {
    const ok = await verdict(p);
    await p.evaluate(() => {
      const set = (lab, v) => { const i = [...document.querySelectorAll('.colour-hex')].find((x) => new RegExp(lab, 'i').test(x.getAttribute('aria-label') || '')); if (!i) return false; i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); return true; };
      set('^(Dark|Foreground|Code)', '#ffffff'); set('^(Light|Background)', '#000000');
    });
    const v = await verdict(p);
    return [/^Verified/.test(ok) && !/^Verified/.test(v), 'default: ' + ok.slice(0, 60) + ' | swapped: ' + v.slice(0, 120)];
  }));
  claim(G, 'card', 'Download as SVG or PNG.', 'both downloads are offered and are an SVG and a PNG', B, async () => genPage(async (p) => {
    await verdict(p);
    await K.clearDownloads(p);
    await K.clickText(p, '.qr-actions button', /Download SVG/); await K.clickText(p, '.qr-actions button', /Download PNG/);
    await p.waitForFunction(() => window.__downloads.length >= 2, { timeout: 30000 });
    const d = await K.downloads(p);
    const svg = d.find((x) => /\.svg$/.test(x.name)), png = d.find((x) => /\.png$/.test(x.name));
    return [!!svg && /^<svg/.test(svg.bytes.toString('utf8')) && !!png && K.isPng(png.bytes), d.map((x) => x.name + ' ' + x.type).join(', ')];
  }));

  /* ================================================================ */
  const SC = '/qr/qr-code-scanner/';
  claim(SC, 'point', 'the grid is also tried transposed, for mirrored codes.', 'a mirrored code reads', N, async () => {
    const q = enc('MIRROR TEST 123'); const m = q.matrix.map((r) => r.slice().reverse());
    const r = Q().QRDetect.scan(K.raster(m, 6, 0, 255, 4)); return [r && r.text === 'MIRROR TEST 123', r ? r.text + ' (mirrored ' + r.mirrored + ')' : 'not read'];
  });
  claim(SC, 'point', 'A picture that gives nothing is read again with its grey levels flipped, for light-on-dark codes', 'a light-on-dark code reads', N, async () => {
    const q = enc('INVERTED'); const r = Q().QRDetect.scan(K.raster(q.matrix, 6, 255, 0, 4)); return [r && r.text === 'INVERTED', r ? r.text : 'not read'];
  });
  claim(SC, 'faq', 'this reader uses it, repairing up to 7% to 30% of the code depending on the level it was made with. The result tells you how many damaged codewords were repaired.',
    'a code at H with damaged data modules reads and reports the repairs', N, async () => {
      const q = enc('Reed-Solomon repair test 0123456789', 'H');
      const m = q.matrix.map((r) => r.slice()); const n = m.length;
      let flipped = 0;
      for (let y = 12; y < n - 12 && flipped < 30; y++) for (let x = 12; x < n - 12 && flipped < 30; x += 3) { if (q.fn && q.fn[y] && q.fn[y][x]) continue; m[y][x] = !m[y][x]; flipped++; }
      const r = Q().QRDetect.scan(K.raster(m, 6, 0, 255, 4));
      return [r && r.text === q.text && r.corrected > 0, r ? 'read, ' + r.corrected + ' codewords corrected (' + flipped + ' modules flipped)' : 'not read'];
    });
  claim(SC, 'dfaq', 'The site\'s own reader decodes byte-mode data as UTF-8', 'UTF-8 byte mode reads back', N, async () => {
    const q = enc('Grüße 日本'); const r = Q().QRDetect.scan(K.raster(q.matrix, 6, 0, 255, 4)); return [r && r.text === 'Grüße 日本', r ? r.text : 'not read'];
  });
  /* the scanner page, fed a picture of a code made in the page */
  const scanPicture = async (text) => {
    const p = await K.open(SC);
    try {
      const png = Buffer.from(await p.evaluate(async (t) => {
        const q = window.QR.encode(t, 'M'); const svg = window.QR.toSVG(q, { scale: 8, quiet: 4 });
        const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
        const c = document.createElement('canvas'); c.width = img.width || 400; c.height = img.height || 400;
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/png').split(',')[1];
      }, text), 'base64');
      const f = K.write('scan-' + Math.random().toString(36).slice(2) + '.png', png);
      const href0 = p.url();
      const inputs = await p.$$('.tool-io input[type=file]');
      await inputs[inputs.length - 1].uploadFile(f);
      await p.waitForSelector('.scan-headline', { timeout: 30000 });
      await K.sleep(400);
      const info = await p.evaluate(() => ({
        headline: document.querySelector('.scan-headline').textContent,
        text: document.querySelector('.tool-io').innerText,
        go: [...document.querySelectorAll('.scan-go')].map((a) => ({ tag: a.tagName, href: a.getAttribute('href') || '', text: a.textContent }))
      }));
      info.navigated = p.url() !== href0;
      info.pages = (await K.browser.pages()).length;
      return info;
    } finally { await p.close(); }
  };
  claim(SC, 'point', 'After a read the camera stops, and a link\'s headline is its URL.hostname; nothing opens until you press the button.', 'a long tracking URL: headline is the host, nothing opened', B, async () => {
    const i = await scanPicture('https://pay.example.com/park/meter?id=12345&utm_source=sticker');
    return [i.headline === 'pay.example.com' && !i.navigated && /Goes to/.test(i.text), 'headline ' + i.headline + ', navigated ' + i.navigated + ', open button ' + K.j(i.go.map((g) => g.text))];
  });
  claim(SC, 'faq', 'and refuses to open script addresses.', 'a javascript: code has no open button', B, async () => {
    const i = await scanPicture('javascript:alert(1)');
    const open = i.go.filter((g) => /open/i.test(g.text) || /^javascript:/i.test(g.href));
    return [!open.length && /script or file address/i.test(i.text), 'headline ' + i.headline + ', open buttons ' + open.length];
  });
  claim(SC, 'faq', 'it shows the domain the link really goes to, warns when a domain uses look-alike characters', 'a Cyrillic "а" in the host brings the warning', B, async () => {
    const i = await scanPicture('https://аpple.com/login');
    return [/look-alike/i.test(i.text) && /xn--/.test(i.headline), 'headline ' + i.headline + '; warning ' + /look-alike/i.test(i.text)];
  });
  claim(SC, 'privacy', 'The camera stream and any image you choose are read in this page and never leave the device.', 'scanning a picture sends nothing', B, async () => {
    const p = await K.open(SC);
    try {
      const f = K.write('scan-priv.png', await K.img.makePng(p, 50, 50, "x.fillStyle='#fff';x.fillRect(0,0,w,h);"));
      const inputs = await p.$$('.tool-io input[type=file]'); await inputs[inputs.length - 1].uploadFile(f);
      await K.sleep(1500);
      const bad = p.__requests.filter((r) => r.method !== 'GET' || !r.url.startsWith(K.BASE));
      return [!bad.length, bad.map((r) => r.method + ' ' + r.url).join(', ') || 'no upload'];
    } finally { await p.close(); }
  });

  /* ================================================================ */
  const BU = '/qr/qr-bulk-generator/';
  const bulk = async (list, typeVal) => {
    const p = await K.open(BU, { wait: '#qr-values' });
    if (typeVal) await setField(p, '#qr-type', typeVal);
    await setField(p, '#qr-values', list);
    await K.clickText(p, '.tool-io button', /^Generate codes$/);
    await p.waitForFunction(() => { const v = document.querySelector('.qr-stage .qr-verdict'); const m = document.querySelector('.qr-stage .io-msg'); return (v && /Verified|will not|fail|could not/i.test(v.textContent)) || (m && /error/.test(m.className) && m.textContent); }, { timeout: 180000 });
    await K.sleep(500);
    return p;
  };
  claim(BU, 'point', 'Tabs, commas or semicolons are detected from the first 20 lines, and quoted fields are handled.', 'a semicolon list with a header maps name and url', B, async () => {
    const p = await bulk('name;url\nTable one;https://example.com/t/1\nTable two;"https://example.com/t/2"', 'url');
    try {
      const map = await p.$eval('.bulk-map', (e) => e.textContent).catch(() => '');
      const cards = await p.$$eval('.bulk-card', (l) => l.length);
      return [cards === 2 && /name/i.test(map) && /url|address/i.test(map), cards + ' codes; ' + map];
    } finally { await p.close(); }
  });
  claim(BU, 'faq', 'A column named name, label, filename, id or ref sets the file name. Failing that the name is made from the content itself, lower-cased and hyphenated, with duplicates numbered so nothing overwrites anything inside the ZIP.',
    'ZIP names from the name column, and from content with duplicates numbered', B, async () => {
      const p = await bulk('https://Example.com/A\nhttps://Example.com/A\nhttps://example.com/b', 'url');
      try {
        await K.clearDownloads(p);
        if (!await K.clickText(p, '.qr-actions button', /PNG/)) return [false, 'no PNG download'];
        await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 120000 });
        const [d] = await K.downloads(p);
        const z = K.zipNames(d.bytes);
        const names = z.map((x) => x.name);
        return [names.length === 3 && new Set(names).size === 3 && names.every((n) => n === n.toLowerCase()), names.join(', ')];
      } finally { await p.close(); }
    });
  claim(BU, 'dfaq', 'The site\'s ZIP writer stores files uncompressed, because PNG data is already compressed.', 'every entry has method 0 (stored)', B, async () => {
    const p = await bulk('ONE\nTWO', 'text');
    try {
      await K.clearDownloads(p);
      await K.clickText(p, '.qr-actions button', /PNG/);
      await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 120000 });
      const [d] = await K.downloads(p);
      const z = K.zipNames(d.bytes);
      return [z.length === 2 && z.every((x) => x.method === 0) && z.every((x) => K.isPng(x.data)), z.map((x) => x.name + ' m' + x.method).join(', ')];
    } finally { await p.close(); }
  });
  claim(BU, 'faq', 'Five hundred in one run.', '501 rows: only 500 are made, or the run says so', B, async () => {
    const p = await bulk(Array.from({ length: 501 }, (_, i) => 'ITEM ' + (i + 1)).join('\n'), 'text');
    try {
      const cards = await p.$$eval('.bulk-card', (l) => l.length);
      const t = await p.evaluate(() => document.querySelector('.qr-stage').innerText);
      return [cards <= 500 && /500/.test(t), cards + ' codes; ' + (t.match(/[^\n]*500[^\n]*/) || [''])[0]];
    } finally { await p.close(); }
  });
  claim(BU, 'tip', 'Every code is rasterised and read back, not just the first.', 'the verdict covers every code', B, async () => {
    const p = await bulk('A1\nB2\nC3\nD4', 'text');
    try { const v = await p.$eval('.qr-stage .qr-verdict', (e) => e.textContent); return [/all 4 codes/.test(v), v.slice(0, 120)]; } finally { await p.close(); }
  });

  /* ---------- manual ---------- */
  manual(G, 'tip', 'In print, allow roughly half a millimetre per module.', 'Printing guidance; needs real prints and phones.');
  manual(G, 'faq', 'WPA3-only networks are also unreliable with older phone cameras.', 'Device behaviour.');
  manual(G, 'point', 'All eight masks are scored with the standard\'s four penalty rules, and the lowest wins.', 'The penalty function is internal to the encoder and not exported; checking it needs an independent ISO 18004 penalty implementation.');
  manual(SC, 'tip', 'The camera only works on a secure (https) page, and only after you allow it.', 'Browser permission behaviour; dev-fixes.js drives the scanner with a stubbed camera.');
  manual(SC, 'point', 'About every 80 milliseconds a frame is read, alternating between the whole frame at 800 pixels and its central 62% in detail.', 'Camera loop timing; needs a fake camera and timing instrumentation.');
  manual(SC, 'dfaq', 'Kanji mode is not read at all.', 'The site\'s encoder never writes Kanji mode; a Kanji-mode fixture from another encoder is needed.');
  manual(SC, 'dfaq', 'It asks only for QR codes, so EAN product barcodes are ignored.', 'Needs BarcodeDetector in a browser that has it, and an EAN image.');
};
