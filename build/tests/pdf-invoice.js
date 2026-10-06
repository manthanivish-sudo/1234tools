/**
 * The Invoice generator, proved: line items with thousands separators (and
 * ambiguity reported, never guessed), GST split by place of supply with
 * mixed per-line rates, VAT, discount and shipping, amounts in words, the
 * three layouts, the logo, the PAID stamp, and on the real page autosave,
 * saved clients, JSON export and import, the next invoice number and a
 * phone-width layout.
 *
 *   node build/tests/pdf-invoice.js [--root <site>] [--port 8865] [--no-browser]
 *
 * --root defaults to the site this file sits in; it is served on --port
 * (8865–8867) by build/tests/serve.js. The node part loads the shipped
 * specs the way the page's worker does (pdf-quotation-pdf.js, then
 * pdf-invoice-pdf.js, into one window) on the shipped pdfcore.bundle.js,
 * and reads every PDF back with pdf.js from engine/vendor/pdfjs: its text
 * and its operator list. Every figure is worked out here from the inputs,
 * never taken from the tool's own stats. The browser part drives
 * /pdf/invoice-pdf/ in headless Chrome. Exit code 2 when an assertion
 * fails, 1 when the run itself breaks.
 *
 *   N1  line items: thousands separators, ambiguity named by line, bad lines named by line
 *   N2  GST: CGST = SGST = half within a state, IGST = full between states, rates 0–40 mixed
 *   N3  VAT: one rate, per-line rates, a custom tax name; no tax
 *   N4  discount (percent and amount, before tax, shared by value) and shipping (taxed or not)
 *   N5  amounts in words: lakh and crore for rupees, thousands otherwise
 *   N6  the three layouts, page sizes, long invoices over pages
 *   N7  the logo: an image XObject, drawn at its own proportions, top left
 *   N8  the PAID stamp, and its absence
 *   N9  the file name, the Title, and loading alone
 *   B1–B9  the page: fill and create, autosave, saved clients, the worked example,
 *       export and import, the next number, the logo rendered, 390 px and 1400 px,
 *       keyboard, both themes, the site's preferences, no request leaves 127.0.0.1
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const { pathToFileURL } = require('url');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', 8865));
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const OUT = path.join(os.tmpdir(), '1234tools-pdf-invoice');
const BROWSER = !process.argv.includes('--no-browser');
const BASE = 'http://127.0.0.1:' + PORT;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });
if (PORT < 8865 || PORT > 8867) { console.error('--port must be 8865, 8866 or 8867'); process.exit(1); }

let pass = 0, fail = 0;
const failures = [];
function check(ok, what, detail) {
  if (ok) { pass++; console.log('  ok    ' + what); }
  else { fail++; failures.push(what + (detail ? '  (' + detail + ')' : '')); console.log('  FAIL  ' + what + (detail ? '  -> ' + detail : '')); }
}
const group = (t) => console.log('\n' + t);

/* ---------- the engine, as the page's worker loads it ---------- */

function loadCore() {
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'engine/pdfcore.bundle.js'), 'utf8'))(w);
  return w.MVRPdfCore;
}
const core = loadCore();
/** the files a spec's worker loads, into one window, in order */
function loadWorker(id) {
  const alone = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'engine/pdf-' + id + '.js'), 'utf8'))(alone);
  const w = {};
  for (const s of alone.PDF_TOOLS[id].workerScripts || ['pdf-' + id + '.js']) new Function('window', fs.readFileSync(path.join(ROOT, 'engine', s), 'utf8'))(w);
  return w.PDF_TOOLS[id];
}
const spec = loadWorker('invoice-pdf');
const DEFAULTS = {};
spec.controls.forEach((c) => { DEFAULTS[c.key] = c.default === 'TODAY' ? '2026-10-05' : c.default; });
const run = (o) => spec.run({ docs: [], opts: Object.assign({}, DEFAULTS, o || {}), core, text: '' });

/* ---------- an independent reader: pdf.js ---------- */

let pdfjs = null;
async function reader() {
  if (pdfjs) return pdfjs;
  pdfjs = await import(pathToFileURL(path.join(ROOT, 'engine/vendor/pdfjs/pdf.min.mjs')).href);
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(ROOT, 'engine/vendor/pdfjs/pdf.worker.min.mjs')).href;
  return pdfjs;
}
/** per page: its size, its text items in order (empty ones dropped), the pictures it paints and where */
async function read(bytes) {
  const lib = await reader();
  const pdf = await lib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, verbosity: 0,
    standardFontDataUrl: path.join(ROOT, 'engine/vendor/pdfjs/standard_fonts') + path.sep }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const pg = await pdf.getPage(p);
    const tc = await pg.getTextContent();
    const items = tc.items.filter((i) => i.str.trim()).map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], m: i.transform }));
    const ops = await pg.getOperatorList();
    const images = [];
    const stack = [[1, 0, 0, 1, 0, 0]];
    const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
    let alphaSet = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i], a = ops.argsArray[i];
      if (fn === lib.OPS.save) stack.push(stack[stack.length - 1].slice());
      else if (fn === lib.OPS.restore) stack.pop();
      else if (fn === lib.OPS.transform) stack[stack.length - 1] = mul(stack[stack.length - 1], a);
      else if (fn === lib.OPS.paintImageXObject) { const m = stack[stack.length - 1]; images.push({ x: m[4], y: m[5], w: m[0], h: m[3] }); }
      else if (fn === lib.OPS.setGState) alphaSet = alphaSet.concat((a[0] || []).filter((g) => g[0] === 'ca' || g[0] === 'CA').map((g) => g[1]));
    }
    pages.push({ w: pg.view[2], h: pg.view[3], items, text: items.map((i) => i.str), images, alpha: alphaSet });
  }
  await pdf.destroy();
  return { pages, all: pages.map((p) => p.text.join(' ')).join(' \f ') };
}
const latin = (b) => Buffer.from(b).toString('latin1');

/* ---------- figures, worked out here ---------- */

const pen = (v) => Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-7) / 100;
const west = (v) => pen(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const lakh = (v) => { const s = pen(v).toFixed(2), i = s.slice(0, -3); return (i.length > 3 ? i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + i.slice(-3) : i) + '.' + s.slice(-2); };
const stat = (r, k) => { const x = ((r && r.stats) || []).find((s) => s[0] === k); return x ? x[1] : undefined; };
const KA = '29AABCA1234C1Z5', KA2 = '29AAFN5678D1ZK', MH = '27AAFN5678D1ZK';
/** the row of a line item, as pdf.js reads it: the items from its description onwards */
const rowOf = (pg, desc, n) => { const i = pg.text.indexOf(desc); return i < 0 ? [] : pg.text.slice(i, i + (n || 8)); };

function rawLogo(w, h) {
  const rgb = new Uint8Array(w * h * 3), alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    rgb[k * 3] = 20; rgb[k * 3 + 1] = 40; rgb[k * 3 + 2] = 140;
    alpha[k] = (x > w * 0.05 && x < w * 0.95 && y > h * 0.1 && y < h * 0.9) ? 255 : 0;
  }
  return { kind: 'raw', name: 'logo.png', width: w, height: h, rgb, alpha, preview: '' };
}
function png(w, h, rgb) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* ================================================================== */
/* node                                                               */
/* ================================================================== */

async function nodePart() {
  group('N1 line items: thousands separators, ambiguity, bad lines named');
  {
    const r = await run({ items: 'Item, 2, 2,650', tax: 0 });
    const row = rowOf((await read(r.files[0].bytes)).pages[0], 'Item');
    check(row[1] === '2' && row[2] === '2,650.00' && row[3] === west(2 * 2650), '"Item, 2, 2,650" is 2 at 2,650.00 = 5,300.00', row.join(' | '));
    const r2 = await run({ items: 'Fit-out, 1, 1,25,000', tax: 0, currency: 'INR' });
    const row2 = rowOf((await read(r2.files[0].bytes)).pages[0], 'Fit-out');
    check(row2[2] === '1,25,000.00' && row2[3] === lakh(125000), '"Fit-out, 1, 1,25,000" (Indian grouping) is 1 at 1,25,000.00', row2.join(' | '));
    const r3 = await run({ items: 'Steel, 7308, 1,000, Kg, 1,234,567.50, 5%', tax: 0 });
    const row3 = rowOf((await read(r3.files[0].bytes)).pages[0], 'Steel');
    check(row3.slice(1, 7).join('|') === ['7308', '1000', 'Kg', '1,234,567.50', '5', west(1000 * 1234567.5 * 0.95)].join('|'),
      'western grouping in quantity and rate, with HSN, unit and discount', row3.join(' | '));
    const r4 = await run({ items: 'Consulting x2 @ 1,200', tax: 0 });
    check(stat(r4, 'Subtotal') === '£' + west(2400), '"Consulting x2 @ 1,200" is read as written', stat(r4, 'Subtotal'));
    const amb = await run({ items: 'Hosting, 12, 45\nDomain, 1, 15\nItem,2,2,650' });
    check(!amb.files && /^Line 3: /.test(amb.error || '') && /can be read 2 ways/.test(amb.error) && /2 at 650/.test(amb.error) && /2 at 2650/.test(amb.error),
      '"Item,2,2,650" on line 3 is reported with the line and both readings, and nothing is made', amb.error);
    const odd = await run({ items: 'A, 1, 10\nItem, 2, 2,65' });
    check(!odd.files && /^Line 2: /.test(odd.error || '') && /“2,65” is not a number with thousands separators/.test(odd.error), '"2,65" is not a grouped number: line 2 is named', odd.error);
    const bad = await run({ items: 'A, 1, 10\n\nJust a description' });
    check(!bad.files && /^Line 3, “Just a description”, could not be read/.test(bad.error || '') && /description, quantity, unit price/.test(bad.error), 'an unreadable line is named by its number (blank lines counted) and the format given', bad.error);
    const neg = await run({ items: 'A, 1, 10\nRefund, 1, -5' });
    check(!neg.files && /^Line 2, “Refund, 1, -5”: the price is negative/.test(neg.error || ''), 'a negative price is refused, naming the line', neg.error);
    const big = await run({ items: 'A, 1, 10, GST 150%', taxMode: 'gst', fromTax: KA, toTax: KA2 });
    check(!big.files && /^Line 1, .*150% is more than 100%/.test(big.error || ''), 'a tax rate over 100% is refused, naming the line', big.error);
    const none = await run({ items: '' });
    check(!none.files && /Add at least one line item/.test(none.error || ''), 'no items: asked for one', none.error);
    const words = await run({ items: 'Design, build and test, 2, 500', tax: 0 });
    const roww = rowOf((await read(words.files[0].bytes)).pages[0], 'Design, build and test');
    check(roww[1] === '2' && roww[2] === '500.00', 'commas in the description stay in the description', roww.join(' | '));
  }

  group('N2 GST: CGST and SGST at half within a state, IGST at the full rate between states');
  {
    const lines = [[0, 1000], [5, 2500.5], [12, 1499.99], [18, 4000], [28, 801], [40, 333.33], [0.25, 10000]];
    const items = lines.map(([r, p], k) => 'Item ' + (k + 1) + ', 1, ' + p + ', GST ' + r + '%').join('\n');
    const net = lines.reduce((s, [, p]) => s + p, 0);
    const intra = await run({ items, taxMode: 'gst', fromTax: KA, toTax: KA2, currency: 'INR' });
    const inter = await run({ items, taxMode: 'gst', fromTax: KA, toTax: MH, currency: 'INR' });
    check(stat(intra, 'Supply') === 'Intra-state, Karnataka' && stat(inter, 'Supply') === 'Inter-state, Karnataka to Maharashtra',
      'the place of supply is read from the GSTINs: 29 to 29 is intra-state, 29 to 27 inter-state', stat(intra, 'Supply') + ' / ' + stat(inter, 'Supply'));
    const ti = (await read(intra.files[0].bytes)).pages[0], te = (await read(inter.files[0].bytes)).pages[0];
    let badIntra = [], badInter = [];
    for (const [r, p] of lines.filter((x) => x[0])) {
      const half = lakh(p * r / 200), full = lakh(p * r / 100);
      const c = ti.text.indexOf('CGST ' + (r / 2) + '% on ' + lakh(p)), s = ti.text.indexOf('SGST ' + (r / 2) + '% on ' + lakh(p));
      if (c < 0 || s < 0 || ti.text[c + 1] !== half || ti.text[s + 1] !== half) badIntra.push(r + '%: ' + ti.text[c + 1] + '/' + ti.text[s + 1] + ' want ' + half);
      const g = te.text.indexOf('IGST ' + r + '% on ' + lakh(p));
      if (g < 0 || te.text[g + 1] !== full) badInter.push(r + '%: ' + te.text[g + 1] + ' want ' + full);
    }
    check(!badIntra.length, 'within Karnataka every rate (0.25, 5, 12, 18, 28, 40) prints CGST and SGST, each half the rate on that rate\'s value', badIntra.join('; '));
    check(!badInter.length, 'to Maharashtra every rate prints IGST at the full rate', badInter.join('; '));
    check(!/IGST/.test(ti.text.join(' ')) && !/[CS]GST \d/.test(te.text.join(' ')), 'no IGST within a state, no CGST or SGST between states');
    const totIn = net + lines.reduce((s, [r, p]) => s + 2 * pen(p * r / 200), 0), totOut = net + lines.reduce((s, [r, p]) => s + pen(p * r / 100), 0);
    check(ti.text.indexOf('Rs ' + lakh(totIn)) >= 0 && te.text.indexOf('Rs ' + lakh(totOut)) >= 0, 'the totals are the items plus each rounded tax figure: Rs ' + lakh(totIn) + ' and Rs ' + lakh(totOut), ti.text.filter((x) => /^Rs /.test(x)).join(',') + ' / ' + te.text.filter((x) => /^Rs /.test(x)).join(','));
    check(ti.text.indexOf('TAX INVOICE') >= 0 && ti.text.some((x) => /^29 .*Karnataka$/.test(x)) && ti.text.indexOf('HSN/SAC') < 0, 'headed TAX INVOICE with the place of supply; no HSN column when no line has a code');
    const def = await run({ items: 'A, 1, 100\nB, 1, 100, GST 5%', taxMode: 'gst', tax: 18, fromTax: KA, toTax: KA2, currency: 'INR' });
    check(stat(def, 'CGST 9%') === 'Rs 9.00' && stat(def, 'CGST 2.5%') === 'Rs 2.50', 'a line without a rate takes the default (18%), one with "GST 5%" its own', stat(def, 'CGST 9%') + ', ' + stat(def, 'CGST 2.5%'));
    const chosen = await run({ taxMode: 'gst', fromTax: KA, toTax: MH, placeOfSupply: '29', currency: 'INR' });
    check(stat(chosen, 'Supply') === 'Intra-state, Karnataka' && /set to 29/.test(chosen.warn || ''), 'a chosen place of supply wins over the GSTIN, and the tool says so', chosen.warn);
    const exp = await run({ taxMode: 'gst', fromTax: KA, toTax: '', placeOfSupply: '96', currency: 'INR' });
    check(stat(exp, 'Supply') === 'Inter-state, Karnataka to Outside India (export)' && !!stat(exp, 'IGST 20%'), 'place of supply 96 (outside India) is IGST', stat(exp, 'Supply'));
    const noPos = await run({ taxMode: 'gst', fromTax: KA, toTax: '' });
    check(!noPos.files && /Choose the place of supply/.test(noPos.error || ''), 'no client GSTIN and no place of supply: asked, not guessed', noPos.error);
    const noSeller = await run({ taxMode: 'gst', fromTax: '', toTax: MH });
    check(!noSeller.files && /Choose your state/.test(noSeller.error || ''), 'no seller GSTIN and no state: asked for it', noSeller.error);
    const hsn = await run({ items: 'Rack, 7308, 4, Nos, 12,500, GST 18%', taxMode: 'gst', fromTax: KA, toTax: KA2, currency: 'INR' });
    const th = (await read(hsn.files[0].bytes)).pages[0];
    check(th.text.indexOf('HSN/SAC') >= 0 && rowOf(th, 'Rack').slice(1, 7).join('|') === ['7308', '4', 'Nos', '12,500.00', '18', lakh(50000)].join('|'), 'an HSN/SAC code gets its column, with the GST % per line', rowOf(th, 'Rack').join(' | '));
  }

  group('N3 VAT: one rate, rates per line, a name of your own; no tax');
  {
    const one = await run({ items: 'A, 3, 33.33\nB, 1, 0.01', taxMode: 'vat', tax: 20 });
    const sub = 3 * 33.33 + 0.01;
    check(stat(one, 'Subtotal') === '£' + west(sub) && stat(one, 'VAT 20%') === '£' + west(sub * 0.2) && stat(one, 'Total due') === '£' + west(sub + pen(sub * 0.2)), 'one rate: VAT 20% on the subtotal', [stat(one, 'VAT 20%'), stat(one, 'Total due')].join(', '));
    const t1 = (await read(one.files[0].bytes)).pages[0];
    check(t1.text.indexOf('GST %') < 0 && t1.text.indexOf('VAT %') < 0, 'one rate: no tax column');
    const per = await run({ items: 'Book, 1, 12.99, VAT 0%\nLamp, 1, 40, VAT 5%\nDesk, 1, 199', taxMode: 'vat', tax: 20 });
    const tp = (await read(per.files[0].bytes)).pages[0];
    check(stat(per, 'VAT 20%') === '£' + west(199 * 0.2) && stat(per, 'VAT 5%') === '£' + west(2) && stat(per, 'VAT 0%') === '£0.00' &&
      tp.text.indexOf('VAT %') >= 0 && tp.text.indexOf('VAT 20% on ' + west(199)) >= 0, 'rates per line: 20, 5 and 0%, each on its own value, with a VAT % column', [stat(per, 'VAT 20%'), stat(per, 'VAT 5%'), stat(per, 'VAT 0%')].join(', '));
    const named = await run({ items: 'A, 1, 100', taxMode: 'vat', tax: 8.25, taxLabel: 'Sales tax', currency: 'USD' });
    check(stat(named, 'Sales tax 8.25%') === '$' + west(8.25), 'a tax name of your own, at 8.25%', JSON.stringify(named.stats.slice(2, 4)));
    const nt = await run({ items: 'A, 1, 100, VAT 20%', taxMode: 'none' });
    check(stat(nt, 'Total due') === '£100.00' && /line 1 was not charged/.test(nt.warn || ''), 'no tax: a line\'s rate is ignored and the tool says so', nt.warn);
  }

  group('N4 discount before tax, shared by value; shipping taxed or not');
  {
    const items = 'A, 1, 1000, VAT 20%\nB, 2, 1500, VAT 5%';
    const pct = await run({ items, discount: '10', discountType: 'percent' });
    const amt = await run({ items, discount: '400', discountType: 'amount' });
    const want = (r, d, label) => {
      const share = d / 4000;
      return stat(r, label) === '-£' + west(d) && stat(r, 'VAT 20%') === '£' + west(1000 * (1 - share) * 0.2) && stat(r, 'VAT 5%') === '£' + west(3000 * (1 - share) * 0.05) &&
        stat(r, 'Total due') === '£' + west(4000 - d + pen(1000 * (1 - share) * 0.2) + pen(3000 * (1 - share) * 0.05));
    };
    check(want(pct, 400, 'Discount 10%'), '10% off 4,000: VAT 20% on 900 and 5% on 2,700', JSON.stringify(pct.stats.slice(2, 8)));
    check(want(amt, 400, 'Discount'), '400 off: the same, shared by value', JSON.stringify(amt.stats.slice(2, 8)));
    const odd = await run({ items: 'A, 1, 100, VAT 20%\nB, 1, 200, VAT 5%', discount: '7', discountType: 'amount' });
    check(stat(odd, 'VAT 20%') === '£' + west(100 * (1 - 7 / 300) * 0.2) && stat(odd, 'VAT 5%') === '£' + west(200 * (1 - 7 / 300) * 0.05), 'an amount that does not divide evenly: each rate on its exact share, rounded once', stat(odd, 'VAT 20%') + ', ' + stat(odd, 'VAT 5%'));
    const tx = await run({ items: 'A, 1, 100', tax: 20, shipping: '1,250', shippingTax: 'taxable' });
    const ex = await run({ items: 'A, 1, 100', tax: 20, shipping: '1,250', shippingTax: 'exempt' });
    const ttx = (await read(tx.files[0].bytes)).pages[0], tex = (await read(ex.files[0].bytes)).pages[0];
    check(stat(tx, 'VAT 20%') === '£' + west(1350 * 0.2) && ttx.text.indexOf('Shipping (taxed at 20%)') >= 0 && ttx.text.indexOf('Taxable value') >= 0, 'shipping "1,250" taxed: VAT on 1,350, labelled "taxed at 20%"', stat(tx, 'VAT 20%'));
    check(stat(ex, 'VAT 20%') === '£' + west(20) && tex.text.indexOf('Shipping (not taxed)') >= 0 && stat(ex, 'Total due') === '£' + west(1370), 'shipping not taxed: VAT on 100 only, labelled "not taxed", total 1,370.00', stat(ex, 'Total due'));
    const gs = await run({ items: 'A, 1, 1000, GST 5%', tax: 18, taxMode: 'gst', fromTax: KA, toTax: KA2, shipping: '200', currency: 'INR' });
    check(stat(gs, 'CGST 9%') === 'Rs ' + lakh(200 * 0.09) && stat(gs, 'CGST 2.5%') === 'Rs ' + lakh(25), 'GST: taxed shipping joins the default rate (18%), the goods keep their own', stat(gs, 'CGST 9%') + ', ' + stat(gs, 'CGST 2.5%'));
    const tooMuch = await run({ items: 'A, 1, 100', discount: '150', discountType: 'amount' });
    check(!tooMuch.files && /more than the items come to/.test(tooMuch.error || ''), 'a discount larger than the items is refused', tooMuch.error);
    const nan = await run({ items: 'A, 1, 100', discount: 'ten' });
    check(!nan.files && /The discount, “ten”, is not a number/.test(nan.error || ''), 'a discount that is not a number is named', nan.error);
    const rnd = await run({ items: 'A, 1, 99.99', tax: 18, rounding: 'near' });
    const raw = 99.99 + pen(99.99 * 0.18);
    check(stat(rnd, 'Total due') === '£' + west(Math.round(raw)) && stat(rnd, 'Rounding') === '+£' + west(Math.round(raw) - raw), 'rounded to the nearest pound, with the rounding shown', stat(rnd, 'Rounding'));
  }

  group('N5 amounts in words');
  {
    const inr = await run({ items: 'Work, 1, 123456.50', tax: 0, currency: 'INR' });
    const wi = (await read(inr.files[0].bytes)).all.replace(/\s+/g, ' ');
    check(wi.indexOf('Amount in words: Rupees One Lakh Twenty-Three Thousand Four Hundred and Fifty-Six and Fifty Paise Only') >= 0, 'Rs 1,23,456.50 in words, in lakhs, printed (rupees: words by default)', (wi.match(/Amount in words: [^\f]{0,120}/) || ['none'])[0]);
    const crore = await run({ items: 'Plant, 1, 1,23,45,678', tax: 0, currency: 'INR' });
    check(stat(crore, 'In words') === 'Rupees One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred and Seventy-Eight Only', 'Rs 1,23,45,678 in crore and lakh', stat(crore, 'In words'));
    const gbpAuto = await run({ items: 'Work, 1, 2650.5', tax: 0, currency: 'GBP' });
    check(!(await read(gbpAuto.files[0].bytes)).all.includes('Amount in words'), 'pounds: no words unless asked');
    const gbp = await run({ items: 'Work, 1, 2650.5', tax: 0, currency: 'GBP', words: 'yes' });
    check(stat(gbp, 'In words') === 'Pounds Two Thousand Six Hundred and Fifty and Fifty Pence Only', 'pounds when asked, in thousands', stat(gbp, 'In words'));
    const aed = await run({ items: 'Work, 1, 1001.25', tax: 0, currency: 'AED', words: 'yes' });
    check(stat(aed, 'In words') === 'Dirhams One Thousand and One and Twenty-Five Fils Only' && stat(aed, 'Total due') === 'AED 1,001.25', 'dirhams and fils, through the quotation\'s own words', stat(aed, 'In words'));
  }

  group('N6 three layouts, three page sizes, long invoices');
  {
    const shapes = {};
    for (const template of ['modern', 'classic', 'compact']) {
      const r = await run({ template, accent: '#123456' });
      const c = latin(r.files[0].bytes);
      const pg = (await read(r.files[0].bytes)).pages[0];
      shapes[template] = {
        band: /0\.0706 0\.2039 0\.3373 rg\n0 ([\d.]+) 595\.28 ([\d.]+) re f/.test(c),
        times: /\/BaseFont\s*\/Times-Roman/.test(c), courier: /\/BaseFont\s*\/Courier/.test(c),
        strip: /0\.0706 0\.2039 0\.3373 rg\n0 0 5 841\.89 re f/.test(c),
        heading: pg.items.find((i) => i.str === 'INVOICE'), grid: (c.match(/ m [\d.]+ [\d.]+ l S/g) || []).length
      };
      check(pg.text.indexOf('Website design and build') >= 0 && pg.text.indexOf('£' + west(6066)) >= 0, template + ': the default invoice reads back, total £6,066.00');
    }
    check(shapes.modern.band && !shapes.modern.times && !shapes.modern.courier, 'modern: an accent band across the top', JSON.stringify(shapes.modern));
    check(shapes.classic.times && !shapes.classic.band && shapes.classic.grid > shapes.modern.grid, 'classic: serif type and a ruled table', JSON.stringify(shapes.classic));
    check(shapes.compact.courier && shapes.compact.strip && !shapes.compact.band, 'compact: figures in a monospace face, an accent strip down the edge', JSON.stringify(shapes.compact));
    const sizes = new Set(['modern', 'classic', 'compact'].map((t) => Math.round(shapes[t].heading.m[0])));
    check(sizes.size === 3, 'the INVOICE heading is a different size in each layout', [...sizes].join(', '));
    for (const [pageSize, w, h] of [['a4', 595.28, 841.89], ['letter', 612, 792], ['legal', 612, 1008]]) {
      const got = [];
      for (const template of ['modern', 'classic', 'compact']) {
        const rd = await read((await run({ template, pageSize, logo: rawLogo(200, 80), paid: true })).files[0].bytes);
        const pg = rd.pages[0];
        const outside = pg.items.filter((i) => i.x < 20 || i.x > pg.w - 20 || i.y < 20 || i.y > pg.h - 20);
        got.push(Math.abs(pg.w - w) < 0.01 && Math.abs(pg.h - h) < 0.01 && !outside.length ? '' : template + ' ' + pg.w + 'x' + pg.h + ' outside: ' + outside.map((i) => i.str).join(','));
      }
      check(got.every((x) => !x), pageSize + ': every layout at ' + w + ' × ' + h + ', no text within 20 pt of an edge', got.filter(Boolean).join('; '));
    }
    const many = Array.from({ length: 90 }, (_, i) => 'Line item number ' + (i + 1) + ' with a description long enough to matter, 1, ' + (i + 1));
    const sum = many.reduce((s, _, i) => s + i + 1, 0);
    for (const template of ['modern', 'classic', 'compact']) {
      const r = await run({ template, items: many.join('\n'), tax: 20 });
      const rd = await read(r.files[0].bytes);
      const n = rd.pages.length;
      const each = many.map((_, i) => rd.all.split('Line item number ' + (i + 1) + ' with').length - 1);
      const heads = rd.pages.every((p, i) => p.text.indexOf('Page ' + (i + 1) + ' of ' + n) >= 0 && (!p.text.some((x) => /^Line item number/.test(x)) || p.text.indexOf('DESCRIPTION') >= 0));
      check(n > 1 && heads && each.every((c) => c === 1) && rd.all.indexOf('£' + west(sum * 1.2)) >= 0,
        template + ': 90 lines over ' + n + ' pages, "Page n of ' + n + '" on each, headings on every page with lines, every line once, total £' + west(sum * 1.2),
        'heads ' + heads + ', counts ' + each.filter((c) => c !== 1).length + ' off, total ' + (rd.all.indexOf('£' + west(sum * 1.2)) >= 0));
      shapes[template].pages = n;
    }
    check(shapes.compact.pages < shapes.modern.pages, 'compact fits the 90 lines on fewer pages than modern', shapes.compact.pages + ' < ' + shapes.modern.pages);
  }

  group('N7 the logo');
  {
    for (const template of ['modern', 'classic', 'compact']) {
      const r = await run({ template, logo: rawLogo(240, 80) });
      const b = latin(r.files[0].bytes);
      const pg = (await read(r.files[0].bytes)).pages[0];
      const im = pg.images[0] || {};
      check(/\/Subtype\s*\/Image/.test(b) && /\/SMask/.test(b) && pg.images.length === 1 && Math.abs(im.w / im.h - 3) < 0.01 && im.x < 60 && im.y + im.h > pg.h - 110,
        template + ': one image XObject with its transparency, painted at 3:1, at the top left', JSON.stringify(im));
    }
    const none = await run({});
    check(!/\/Subtype\s*\/Image/.test(latin(none.files[0].bytes)), 'no logo, no image');
  }

  group('N8 the PAID stamp');
  {
    const paid = await run({ paid: true, paidDate: '2026-10-05', paidMethod: 'Bank transfer' });
    const rd = await read(paid.files[0].bytes);
    const stamp = rd.pages[0].items.find((i) => i.str === 'PAID');
    const angle = stamp ? Math.atan2(stamp.m[1], stamp.m[0]) * 180 / Math.PI : 0;
    check(!!stamp && Math.abs(angle - 18) < 0.5, 'PAID is drawn turned 18° (pdf.js reads it)', stamp ? angle.toFixed(2) : 'no PAID');
    check(rd.pages[0].alpha.length && rd.pages[0].alpha.every((a) => a > 0 && a < 1), 'it is translucent (an ExtGState opacity below 1)', rd.pages[0].alpha.join(','));
    check(rd.pages[0].text.indexOf('5 OCTOBER 2026 · BANK TRANSFER') >= 0 && rd.pages[0].text.indexOf('TOTAL PAID') >= 0 && rd.all.indexOf('Paid in full on 5 October 2026 by bank transfer. Balance due: £0.00') >= 0,
      'with the date and method, TOTAL PAID and a balance of £0.00');
    const unpaid = await read((await run({ paid: false })).files[0].bytes);
    check(!/PAID/.test(unpaid.all) && !unpaid.pages[0].alpha.length && unpaid.all.indexOf('TOTAL DUE') >= 0, 'not paid: no stamp, no opacity, TOTAL DUE');
    const long = await read((await run({ paid: true, items: Array.from({ length: 80 }, (_, i) => 'Row ' + i + ', 1, 1').join('\n') })).files[0].bytes);
    check(long.pages[0].text.indexOf('PAID') >= 0 && long.pages.slice(1).every((p) => p.text.indexOf('PAID') < 0), 'on a long invoice the stamp is on the first page only');
  }

  group('N9 names, Title, and loading alone');
  {
    const r = await run({ number: 'INV-2026-0042', fromName: 'Riverside Joinery', toName: 'Harbour Cafe' });
    const lib = await reader();
    const doc = await lib.getDocument({ data: new Uint8Array(r.files[0].bytes), verbosity: 0 }).promise;
    const meta = await doc.getMetadata();
    check(r.files[0].name === 'INV-2026-0042.pdf' && meta.info.Title === 'Invoice INV-2026-0042' && meta.info.Author === 'Riverside Joinery', 'INV-2026-0042.pdf, Title "Invoice INV-2026-0042", Author the business', r.files[0].name + ' ' + JSON.stringify(meta.info.Title));
    await doc.destroy();
    check((await run({ number: 'INV/2026 42' })).files[0].name === 'INV-2026-42.pdf' && (await run({ number: '' })).files[0].name === 'invoice.pdf', 'characters a file name cannot hold become hyphens; no number gives invoice.pdf');
    const alone = {};
    new Function('window', fs.readFileSync(path.join(ROOT, 'engine/pdf-invoice-pdf.js'), 'utf8'))(alone);
    let msg = '';
    try { await alone.PDF_TOOLS['invoice-pdf'].run({ docs: [], opts: DEFAULTS, core }); } catch (e) { msg = e.message; }
    check(Object.keys(alone.PDF_TOOLS).join() === 'invoice-pdf' && /quotation engine/.test(msg), 'the invoice file loads on its own (defines only itself) and, run without the quotation, says what is missing', msg);
    check(JSON.stringify(spec.workerScripts) === JSON.stringify(['pdf-quotation-pdf.js', 'pdf-invoice-pdf.js']), 'its worker loads the quotation first');
    const html = fs.readFileSync(path.join(ROOT, 'pdf/invoice-pdf/index.html'), 'utf8');
    const qa = html.indexOf('<script src="/engine/pdf-quotation-pdf.js" defer></script>'), ia = html.indexOf('<script src="/engine/pdf-invoice-pdf.js" defer></script>');
    check(qa > 0 && ia > qa && qa < html.indexOf('</head>'), 'the page loads the quotation before the invoice, in its head');
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
    const faqLd = ld['@graph'].find((x) => x['@type'] === 'FAQPage').mainEntity.filter((q) => !/#depth-q/.test(q['@id'] || '')).map((q) => q.name + '\u0000' + q.acceptedAnswer.text);
    check(JSON.stringify(faqLd) === JSON.stringify(spec.faq.map((f) => f.q + '\u0000' + f.a)), 'the FAQPage JSON-LD is the visible FAQ, question for question');
    const tips = /<ul class="tips">([\s\S]*?)<\/ul>/.exec(html)[1].split('</li>').filter(Boolean).length;
    check(tips === spec.tips.length && html.indexOf('<p class="lede">' + spec.description.replace(/&/g, '&amp;') + '</p>') > 0, 'the page shows the spec\'s lede and all ' + spec.tips.length + ' tips');
    check(!/100% private/i.test(html) && /Nothing you add is uploaded/.test(html), 'the privacy line is "nothing you add is uploaded", never "100% private"');
  }
}

/* ================================================================== */
/* browser                                                            */
/* ================================================================== */

let browser, server;
function loadPuppeteer() {
  for (const p of [path.join(ROOT, 'node_modules/puppeteer-core'), 'E:/projects/1234Tools/node_modules/puppeteer-core', 'puppeteer-core']) {
    try { return require(p); } catch (e) { /* next */ }
  }
  throw new Error('puppeteer-core not found');
}
const requests = new Set();
function hook() {
  window.__downloads = [];
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const a = this;
    if (a.download && /^blob:/.test(a.href)) window.__downloads.push(fetch(a.href).then((r) => r.arrayBuffer()).then((b) => ({ name: a.download, bytes: Array.from(new Uint8Array(b)) })));
    else return click.call(this);
  };
}
async function open(width, opts) {
  const o = opts || {};
  const page = await (o.context || browser).newPage();
  await page.setViewport({ width: width || 1280, height: 1000, isMobile: !!o.mobile, hasTouch: !!o.mobile, deviceScaleFactor: o.mobile ? 2 : 1 });
  page.on('request', (r) => { try { const u = new URL(r.url()); if (/^https?:/.test(u.protocol)) requests.add(u.host); } catch (e) { /* */ } });
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(String(e.message || e)));
  await page.evaluateOnNewDocument(hook);
  if (o.theme) await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('1234tools-theme', t); } catch (e) { /* */ } }, o.theme);
  await page.goto(BASE + '/pdf/invoice-pdf/', { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
  await page.waitForSelector('#inv-new', { timeout: 30000 });
  return page;
}
async function wipe(page) {
  await page.evaluate(() => Object.keys(localStorage).filter((k) => /^1234tools-pdf-invoice-pdf|^1234tools\.prefs/.test(k)).forEach((k) => localStorage.removeItem(k)));
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
  await page.waitForSelector('#inv-new');
}
async function set(page, c) {
  const missing = await page.evaluate((c) => Object.keys(c).filter((k) => {
    const el = document.getElementById('pc-' + k);
    if (!el) return true;
    if (el.type === 'checkbox') el.checked = !!c[k];
    else if (el.tagName === 'SELECT') el.value = String(c[k]);
    else { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, String(c[k])); }
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    return false;
  }), c);
  if (missing.length) throw new Error('controls not found: ' + missing.join(', '));
}
const val = (page, k) => page.$eval('#pc-' + k, (e) => e.type === 'checkbox' ? e.checked : e.value);
async function press(page) {
  await page.click('.pdf-run .btn-primary');
  await page.waitForFunction(() => { const s = document.querySelector('.pdf-summary'); const m = document.querySelector('.tool-io > .io-msg'); return (s && !s.hidden) || (m && m.classList.contains('is-error')); }, { timeout: 120000 });
  return page.evaluate(() => {
    const m = document.querySelector('.tool-io > .io-msg');
    const stats = [...document.querySelectorAll('.stat-grid .stat-row')].map((r) => [r.querySelector('.stat-key').textContent, r.querySelector('.stat-val').textContent]);
    return { cls: m.className, msg: m.textContent, stats };
  });
}
async function lastDownload(page) {
  const d = await page.evaluate(async () => { const all = await Promise.all(window.__downloads); return all[all.length - 1] || null; });
  return d ? { name: d.name, bytes: Buffer.from(d.bytes) } : null;
}
async function downloadPdf(page) {
  const n0 = await page.evaluate(() => window.__downloads.length);
  await page.$eval('.pdf-summary-actions .btn-primary', (b) => b.click());
  await page.waitForFunction((n) => window.__downloads.length > n, { timeout: 30000 }, n0);
  return lastDownload(page);
}
/** pdf.js in the page: text per page, and ink in the given rectangles (top-left origin, points) */
async function pdfjsInPage(page, bytes, probes) {
  return page.evaluate(async (b64, probes) => {
    const lib = await import('/engine/vendor/pdfjs/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = '/engine/vendor/pdfjs/pdf.worker.min.mjs';
    const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const pdf = await lib.getDocument({ data: u8, standardFontDataUrl: '/engine/vendor/pdfjs/standard_fonts/' }).promise;
    const pg = await pdf.getPage(1);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    const ink = probes.map(([x, y, w, h]) => {
      const d = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data;
      let n = 0, blue = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] < 600) n++; if (d[i + 2] > 100 && d[i] < 60 && d[i + 1] < 90) blue++; }
      return { ink: n / (d.length / 4), blue: blue / (d.length / 4) };
    });
    return { h: vp.height, text: tc.items.map((i) => i.str).filter((s) => s.trim()), ink };
  }, bytes.toString('base64'), probes || []);
}

async function browserPart() {
  const puppeteer = loadPuppeteer();
  const { serve } = require('./serve.js');
  server = await serve(ROOT, PORT);
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'], protocolTimeout: 120000 });

  group('B1 the page fills and makes the invoice');
  const p = await open(1400);
  await wipe(p);
  const scripts = await p.$$eval('script[src]', (l) => l.map((s) => s.getAttribute('src')));
  check(scripts.indexOf('/engine/pdf-quotation-pdf.js') >= 0 && scripts.indexOf('/engine/pdf-quotation-pdf.js') < scripts.indexOf('/engine/pdf-invoice-pdf.js'), 'the page loads the quotation, then the invoice');
  await set(p, { fromName: 'Riverside Joinery', fromAddress: '4 Mill Lane\nLeeds LS1 4AB', fromTax: 'GB 123 4567 89', toName: 'Harbour Cafe Ltd', toAddress: '3 Quay Street\nWhitby YO21 1PU', toTax: 'GB 987 6543 21',
    number: 'INV-2026-0042', date: '2026-10-05', items: 'Oak shelves, 2, 1,250\nFitting, 3, Hours, 45, VAT 5%', tax: '20', template: 'classic' });
  const r1 = await press(p);
  const s1 = Object.fromEntries(r1.stats);
  check(!/is-error/.test(r1.cls) && s1['VAT 20%'] === '£' + west(2500 * 0.2) && s1['VAT 5%'] === '£' + west(135 * 0.05) && s1['Total due'] === '£' + west(2635 + 500 + 6.75),
    'filled on the page: VAT at 20% and 5%, total £' + west(2635 + 506.75), r1.msg + ' ' + JSON.stringify(r1.stats.slice(0, 8)));
  check(!p.__errors.length, 'no script errors on the page', p.__errors.join(' | '));
  await K_sleep(500);

  group('B2 the next number after a download');
  const d1 = await downloadPdf(p);
  check(d1 && d1.name === 'INV-2026-0042.pdf', 'the download is named from the number: INV-2026-0042.pdf', d1 && d1.name);
  check(await val(p, 'number') === 'INV-2026-0043' && /INV-2026-0042 downloaded\. The number is now INV-2026-0043/.test(await p.$eval('.inv-status', (e) => e.textContent)), 'the number is then INV-2026-0043, and the panel says so');
  const t1 = await pdfjsInPage(p, d1.bytes);
  check(t1.text.indexOf('INV-2026-0042') >= 0 && t1.text.indexOf('INV-2026-0043') < 0, 'the downloaded file carries the number it was made with');
  await p.click('.inv-status .btn-link');
  check(await val(p, 'number') === 'INV-2026-0042', '"Put INV-2026-0042 back" restores it');
  await set(p, { number: 'INV-0999' });
  await press(p); await downloadPdf(p);
  check(await val(p, 'number') === 'INV-1000', 'INV-0999 goes to INV-1000', await val(p, 'number'));
  await downloadPdf(p);
  check(await val(p, 'number') === 'INV-1000', 'downloading the same file twice does not skip a number', await val(p, 'number'));
  await set(p, { number: 'INV-2026-0043' });

  group('B3 autosave: the form comes back after a reload');
  await K_sleep(600);
  await p.reload({ waitUntil: 'load' }); await p.waitForSelector('#inv-new');
  const back = { toName: await val(p, 'toName'), toAddress: await val(p, 'toAddress'), items: await val(p, 'items'), number: await val(p, 'number'), template: await val(p, 'template'), fromTax: await val(p, 'fromTax') };
  check(back.toName === 'Harbour Cafe Ltd' && back.toAddress === '3 Quay Street\nWhitby YO21 1PU' && back.items === 'Oak shelves, 2, 1,250\nFitting, 3, Hours, 45, VAT 5%' && back.number === 'INV-2026-0043' && back.template === 'classic' && back.fromTax === 'GB 123 4567 89',
    'client, items, number, layout and tax number are all back', JSON.stringify(back));
  check(/Your invoice from last time is back/.test(await p.$eval('.inv-status', (e) => e.textContent)), 'with a note saying so');

  group('B4 saved clients');
  await p.click('#inv-save-client');
  await set(p, { toName: 'Castle Primary School', toAddress: 'School Office\nHereford HR1 2NN', toTax: '' });
  await p.click('#inv-save-client');
  const names = await p.$$eval('#inv-clients option', (l) => l.map((x) => x.textContent));
  check(names.join('|') === 'Choose a saved client…|Castle Primary School|Harbour Cafe Ltd', 'two clients saved, listed by name', names.join('|'));
  const harbour = await p.$$eval('#inv-clients option', (l) => l.find((x) => x.textContent === 'Harbour Cafe Ltd').value);
  await p.select('#inv-clients', harbour);
  await K_sleep(150);
  check(await val(p, 'toName') === 'Harbour Cafe Ltd' && await val(p, 'toAddress') === '3 Quay Street\nWhitby YO21 1PU' && await val(p, 'toTax') === 'GB 987 6543 21', 'choosing one fills name, address and tax number');
  await p.select('#inv-clients', await p.$$eval('#inv-clients option', (l) => l.find((x) => x.textContent === 'Castle Primary School').value));
  await p.click('#inv-delete-client');
  const left = await p.$$eval('#inv-clients option', (l) => l.map((x) => x.textContent));
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('1234tools-pdf-invoice-pdf-v1-customers') || '[]').map((c) => c.name));
  check(left.join('|') === 'Choose a saved client…|Harbour Cafe Ltd' && stored.join() === 'Harbour Cafe Ltd', 'Delete removes the chosen one, from the list and from storage', left.join('|'));

  group('B5 the logo: uploaded, embedded, rendered');
  const logoFile = path.join(OUT, 'logo-blue.png');
  fs.writeFileSync(logoFile, png(120, 40, [20, 40, 160]));
  await (await p.$('#pc-logo')).uploadFile(logoFile);
  await p.waitForFunction(() => !document.querySelector('.image-pick-thumb').hidden, { timeout: 20000 });
  const geo = {};
  for (const template of ['modern', 'classic', 'compact']) {
    await set(p, { template });
    await press(p);
    const d = await downloadPdf(p);
    await set(p, { number: 'INV-2026-0043' });
    const b = latin(d.bytes);
    const m = /([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\s*\/Im\d+ Do/.exec(b + '\n' + zlibAll(d.bytes));
    const box = m ? { w: +m[1], h: +m[2], x: +m[3], y: +m[4] } : null;
    const rd = box ? await pdfjsInPage(p, d.bytes, [[box.x + box.w * 0.2, 841.89 - box.y - box.h * 0.8, box.w * 0.6, box.h * 0.6], [box.x + box.w + 400, 841.89 - box.y - box.h * 0.8, 20, 10]]) : null;
    geo[template] = box;
    check(/\/Subtype\s*\/Image/.test(b) && box && Math.abs(box.w / box.h - 3) < 0.01 && rd.ink[0].blue > 0.9, template + ': the logo is an image XObject at 3:1, and pdf.js paints it blue where it is placed', JSON.stringify(box) + ' ' + JSON.stringify(rd && rd.ink));
  }
  check(await p.evaluate(() => !!localStorage.getItem('1234tools-pdf-invoice-pdf-v1-logo')), 'the logo is kept on this device');

  group('B6 export, then import, round-trips the whole invoice');
  await set(p, { paid: true, paidDate: '2026-10-05', paidMethod: 'Card', discount: '5', shipping: '12.50', notes: 'Line one\nLine two', currency: 'EUR' });
  await K_sleep(400);
  const before = await p.evaluate(() => { const o = {}; document.querySelectorAll('[id^="pc-"]').forEach((e) => { if (e.type !== 'file' && e.tagName !== 'CANVAS') o[e.id] = e.type === 'checkbox' ? e.checked : e.value; }); return o; });
  const n0 = await p.evaluate(() => window.__downloads.length);
  await p.click('#inv-export');
  await p.waitForFunction((n) => window.__downloads.length > n, { timeout: 10000 }, n0);
  const exp = await lastDownload(p);
  const doc = JSON.parse(exp.bytes.toString('utf8'));
  check(exp.name === 'INV-2026-0043.json' && doc.format === '1234tools-invoice' && doc.version === 1 && doc.logo && doc.logo.width === 120 && doc.fields.paid === true && doc.fields.currency === 'EUR',
    'Export writes INV-2026-0043.json: every field, the paid flag and the logo', exp.name + ' ' + Object.keys(doc.fields || {}).length + ' fields');
  const jsonFile = path.join(OUT, 'INV-2026-0043.json');
  fs.writeFileSync(jsonFile, exp.bytes);
  const q = await open(1400, { context: await newContext() });
  await (await q.$('#inv-import-file')).uploadFile(jsonFile);
  await q.waitForFunction(() => /Imported/.test(document.querySelector('.inv-status').textContent), { timeout: 10000 });
  const after = await q.evaluate(() => { const o = {}; document.querySelectorAll('[id^="pc-"]').forEach((e) => { if (e.type !== 'file' && e.tagName !== 'CANVAS') o[e.id] = e.type === 'checkbox' ? e.checked : e.value; }); return o; });
  const diff = Object.keys(before).filter((k) => before[k] !== after[k]);
  check(!diff.length && await q.$eval('.image-pick-thumb', (e) => !e.hidden), 'imported in another browser profile: every field equal, the logo back', diff.map((k) => k + ': ' + JSON.stringify(before[k]) + ' vs ' + JSON.stringify(after[k])).join('; '));
  const ri = await press(q);
  check(!/is-error/.test(ri.cls) && Object.fromEntries(ri.stats)['Status'] === 'Paid on 5 October 2026 by Card', 'and it makes the same invoice, paid by card', JSON.stringify(ri.stats.slice(-4)));
  const bads = [
    ['not-json.json', 'this is not json', /it is not JSON/],
    ['other.json', JSON.stringify({ format: 'something-else', fields: {} }), /not an invoice exported by this tool/],
    ['newer.json', JSON.stringify({ format: '1234tools-invoice', version: 2, fields: {} }), /newer version/],
    ['bad-currency.json', JSON.stringify({ format: '1234tools-invoice', version: 1, fields: { currency: 'XYZ' } }), /“currency” holds “XYZ”, which is not one of its choices/],
    ['unknown.json', JSON.stringify({ format: '1234tools-invoice', version: 1, fields: { colour: 'red' } }), /a field this tool does not know, “colour”/],
    ['bad-logo.json', JSON.stringify({ format: '1234tools-invoice', version: 1, fields: {}, logo: { kind: 'raw', width: 10, height: 10, rgb: 'AAAA', preview: '' } }), /its logo has the wrong number of pixels/]
  ];
  const num0 = await val(q, 'number');
  for (const [name, body, re] of bads) {
    const f = path.join(OUT, name);
    fs.writeFileSync(f, body);
    await (await q.$('#inv-import-file')).uploadFile(f);
    await q.waitForFunction((n) => document.querySelector('.inv-status').textContent.indexOf(n) >= 0, { timeout: 10000 }, name);
    const st = await q.$eval('.inv-status', (e) => e.textContent);
    check(re.test(st) && /Nothing was changed/.test(st) && await val(q, 'number') === num0, 'a bad file (' + name + ') is refused with a clear reason, and nothing changes', st.slice(0, 140));
  }
  await q.close();

  group('B7 start a new invoice');
  await p.click('#inv-new');
  const fresh = { fromName: await val(p, 'fromName'), fromTax: await val(p, 'fromTax'), toName: await val(p, 'toName'), toAddress: await val(p, 'toAddress'), items: await val(p, 'items'), paid: await val(p, 'paid'), discount: await val(p, 'discount'), number: await val(p, 'number'), currency: await val(p, 'currency'), logo: await p.$eval('.image-pick-thumb', (e) => !e.hidden), focus: await p.evaluate(() => document.activeElement && document.activeElement.id) };
  check(fresh.fromName === 'Riverside Joinery' && fresh.fromTax === 'GB 123 4567 89' && fresh.logo && fresh.currency === 'EUR' && fresh.toName === '' && fresh.toAddress === '' && fresh.items === '' && fresh.paid === false && fresh.discount === '' && fresh.focus === 'pc-toName',
    'seller, logo and currency kept; client, items, discount and stamp cleared; the focus on Bill to', JSON.stringify(fresh));
  check(fresh.number === 'INV-2026-0044', 'the number carries on from the last one downloaded (INV-2026-0043)', fresh.number);

  group('B8 the worked example on the page (build/content/pdf.js)');
  await set(p, { fromName: 'Sahyadri Print House', fromAddress: '14 Karve Road, Pune 411004', fromTax: '27AAKFS4821M1Z3', toName: 'Lalbagh Learning Centre', toAddress: '22 Lalbagh Road, Bengaluru 560027', toTax: '29AACCL7310Q1ZP',
    number: 'SPH-2026-0117', date: '2026-10-05', due: '15', currency: 'INR', taxMode: 'gst', tax: '18', items: 'Brochures, 500, Nos, 18.50\nHardbound registers, 20, Nos, 2,450, GST 5%', discount: '10', discountType: 'percent', shipping: '1,500', shippingTax: 'taxable', template: 'modern', notes: '' });
  const wr = await press(p);
  const ws = Object.fromEntries(wr.stats);
  const sub = 500 * 18.5 + 20 * 2450, b18 = 500 * 18.5 * 0.9 + 1500, b5 = 20 * 2450 * 0.9, tot = sub * 0.9 + 1500 + pen(b18 * 0.18) + pen(b5 * 0.05);
  const wd = await downloadPdf(p);
  const wt = (await pdfjsInPage(p, wd.bytes)).text;
  check(ws['Subtotal'] === 'Rs ' + lakh(sub) && ws['Discount 10%'] === '-Rs ' + lakh(sub * 0.1) && ws['Taxable value'] === 'Rs ' + lakh(b18 + b5) && ws['IGST 18%'] === 'Rs ' + lakh(b18 * 0.18) &&
    ws['IGST 5%'] === 'Rs ' + lakh(b5 * 0.05) && ws['Total due'] === 'Rs ' + lakh(tot) && ws['Due date'] === '20 October 2026' && wd.name === 'SPH-2026-0117.pdf' &&
    wt.indexOf('IGST 18% on ' + lakh(b18)) >= 0 && wt.indexOf('IGST 5% on ' + lakh(b5)) >= 0, 'Rs ' + lakh(sub) + ' less 10%, IGST 18% on ' + lakh(b18) + ' and 5% on ' + lakh(b5) + ': Rs ' + lakh(tot), JSON.stringify(wr.stats));
  await set(p, { toAddress: '9 FC Road, Pune 411005', toTax: '27AAACL7310Q1ZQ', number: 'SPH-2026-0117' });
  const wr2 = Object.fromEntries((await press(p)).stats);
  check(wr2['CGST 9%'] === 'Rs ' + lakh(b18 * 0.09) && wr2['SGST 9%'] === wr2['CGST 9%'] && wr2['CGST 2.5%'] === 'Rs ' + lakh(b5 * 0.025) && wr2['Total due'] === 'Rs ' + lakh(tot), 'billed within Maharashtra: CGST = SGST, the same total', JSON.stringify(wr2));
  check(!(await p.$eval('#pc-sellerState', (e) => e.closest('.field').hidden)) && await p.$eval('#pc-taxLabel', (e) => e.closest('.field').hidden), 'under GST the state fields show and the tax name hides');
  await set(p, { taxMode: 'vat' });
  check(await val(p, 'tax') === '20' && await p.$eval('#pc-sellerState', (e) => e.closest('.field').hidden), 'back to VAT: the rate goes from 18 to 20 and the state fields hide', await val(p, 'tax'));
  await set(p, { taxMode: 'gst' });
  check(await val(p, 'tax') === '18', 'and to GST: 20 becomes 18');

  group('B9 the site\'s preferences, Forget, widths, keyboard, themes');
  await p.click('#inv-forget');
  const keysLeft = await p.evaluate(() => Object.keys(localStorage).filter((k) => /^1234tools-pdf-invoice-pdf-v1-/.test(k)));
  check(!keysLeft.length, '"Forget what this device keeps" removes the form, logo, clients and last number', keysLeft.join());
  await p.evaluate(() => { localStorage.setItem('1234tools.prefs', JSON.stringify({ values: { currency: 'INR', taxRegion: 'in', paper: 'Letter' }, updatedAt: 1 })); localStorage.removeItem('1234tools-pdf-invoice-pdf-v1'); });
  await p.reload({ waitUntil: 'load' }); await p.waitForSelector('#inv-new');
  const pref = { currency: await val(p, 'currency'), taxMode: await val(p, 'taxMode'), tax: await val(p, 'tax'), pageSize: await val(p, 'pageSize'), saved: await p.evaluate(() => !!localStorage.getItem('1234tools-pdf-invoice-pdf-v1-form')) };
  check(pref.currency === 'INR' && pref.taxMode === 'gst' && pref.tax === '18' && pref.pageSize === 'letter' && !pref.saved, 'a first visit follows the site settings: rupees, GST at 18%, Letter, and nothing saved until you type', JSON.stringify(pref));
  await wipe(p);
  await p.close();

  for (const [w, mobile] of [[390, true], [1400, false]]) {
    const ph = await open(w, { mobile });
    await set(ph, { paid: true, taxMode: 'gst', items: 'A very long description of a line item that has to wrap on a phone, 1, 10' });
    await (await ph.$('#pc-logo')).uploadFile(logoFile);
    await K_sleep(600);
    await set(ph, { fromTax: KA, toTax: MH });
    await press(ph);
    await K_sleep(400);
    const m = await ph.evaluate(() => {
      const wide = [...document.querySelectorAll('.tool-io *')].filter((n) => { const r = n.getBoundingClientRect(); return r.width && !n.closest('.pdf-view') && r.right > window.innerWidth + 1; }).map((n) => n.className || n.tagName).slice(0, 5);
      return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, wide };
    });
    check(m.sw <= m.iw && !m.wide.length, w + ' px: no horizontal scroll with the panel, the logo and a result on screen', JSON.stringify(m));
    await ph.close();
  }

  const kb = await open(1280);
  await wipe(kb);
  check(await kb.$eval('#inv-delete-client', (e) => e.disabled), 'with no saved clients, Delete is disabled (and so skipped by Tab)');
  await set(kb, { toName: 'Keyboard Client' });
  await kb.focus('#inv-save-client');
  await kb.keyboard.press('Enter');
  check((await kb.$$eval('#inv-clients option', (l) => l.map((x) => x.textContent))).indexOf('Keyboard Client') >= 0, 'Enter on "Save the client above" saves it');
  const tabbable = await kb.evaluate(() => ['inv-clients', 'inv-save-client', 'inv-delete-client', 'inv-new', 'inv-export', 'inv-import', 'inv-forget'].map((id) => {
    const e = document.getElementById(id); if (!e) return id + ' missing';
    e.focus(); return document.activeElement === e && e.tabIndex >= 0 ? '' : id;
  }).filter(Boolean));
  const fileTab = await kb.$eval('#inv-import-file', (e) => e.tabIndex);
  check(!tabbable.length && fileTab === -1, 'every control in the panel takes the keyboard focus; the hidden file input does not', tabbable.join());
  await kb.focus('#inv-new');
  await kb.keyboard.press('Tab');
  check(await kb.evaluate(() => document.activeElement.id) === 'inv-export', 'Tab moves from Start a new invoice to Export');
  await kb.focus('#inv-clients');
  await kb.keyboard.press('ArrowDown');
  await K_sleep(150);
  check(await val(kb, 'toName') === 'Keyboard Client', 'the saved-clients list works from the keyboard (arrow down picks the client)', await val(kb, 'toName'));
  await wipe(kb);
  await kb.close();

  for (const theme of ['light', 'dark']) {
    const th = await open(1280, { theme });
    const c = await th.evaluate(() => {
      const lum = (s) => { const m = s.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const bar = document.querySelector('.inv-extras');
      const bg = getComputedStyle(bar).backgroundColor;
      const label = getComputedStyle(bar.querySelector('label')).color;
      const button = getComputedStyle(document.getElementById('inv-new')).color;
      return { theme: document.documentElement.getAttribute('data-theme'), bg, label: ratio(label, bg), button: ratio(button, bg) };
    });
    check(c.theme === theme && c.label >= 3 && c.button >= 3, theme + ' theme: the panel\'s labels and buttons stand out from its background', JSON.stringify(c));
    await th.close();
  }

  const foreign = [...requests].filter((h) => !/^127\.0\.0\.1(:\d+)?$/.test(h));
  check(!foreign.length, 'no request left 127.0.0.1', foreign.join(', '));
}

let contexts = [];
async function newContext() {
  const ctx = await (browser.createBrowserContext ? browser.createBrowserContext() : browser.createIncognitoBrowserContext());
  contexts.push(ctx);
  return ctx;
}
const K_sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** every Flate stream of a PDF inflated and joined, for reading the drawing operators */
function zlibAll(bytes) {
  const b = Buffer.from(bytes);
  let out = '';
  const s = b.toString('latin1');
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf('endstream', start);
    try { out += zlib.inflateSync(b.subarray(start, end)).toString('latin1') + '\n'; } catch (e) { /* not deflated, or not ours */ }
  }
  return out;
}

(async () => {
  console.log('pdf-invoice: ' + ROOT + (BROWSER ? ' on ' + BASE : ' (node only)'));
  try {
    await nodePart();
    if (BROWSER) await browserPart();
  } catch (e) {
    console.error('\nthe run broke: ' + (e && e.stack || e));
    if (browser) await browser.close();
    if (server) server.close();
    process.exit(1);
  }
  for (const c of contexts) { try { await c.close(); } catch (e) { /* */ } }
  if (browser) await browser.close();
  if (server) server.close();
  console.log('\n' + (pass + fail) + ' assertions   ' + pass + ' passed   ' + fail + ' failed');
  if (fail) { console.log('\nFailures:\n  ' + failures.join('\n  ')); process.exit(2); }
})();
