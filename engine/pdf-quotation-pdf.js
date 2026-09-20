(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document';
}

/** A control value that should be a number. Commas are tolerated. */
function num(v, d) {
  const x = parseFloat(String(v == null ? '' : v).replace(/,/g, '').trim());
  return isFinite(x) ? x : (d === undefined ? 0 : d);
}

const isNumTok = (s) => /^-?(?:\d[\d,]*)(?:\.\d+)?$/.test(String(s).trim());
/* A unit is the one word in a line that is never a number: "Nos", "Sqm",
   "Hours", "Lot". It is what separates the quantity from the rate. */
const isUnitTok = (s) => /^[A-Za-z][A-Za-z.\-\/ ]{0,13}$/.test(String(s).trim());

/* ---------- money ---------- */

const CURRENCIES = {
  GBP: { sym: '£', major: 'Pounds', minor: 'Pence', group: 'west', tax: 'VAT No.' },
  USD: { sym: '$', major: 'Dollars', minor: 'Cents', group: 'west', tax: 'Tax ID' },
  EUR: { sym: '€', major: 'Euros', minor: 'Cents', group: 'west', tax: 'VAT No.' },
  INR: { sym: 'Rs ', major: 'Rupees', minor: 'Paise', group: 'indian', tax: 'GSTIN' }
};

/** 1234567.5 -> "12,34,567.50" in India, "1,234,567.50" everywhere else. */
function amt(v, cur) {
  const c = CURRENCIES[cur] || CURRENCIES.INR;
  const neg = Number(v) < 0;
  const s = Math.abs(Number(v) || 0).toFixed(2);
  const i = s.slice(0, -3), d = s.slice(-2);
  const head = c.group === 'indian'
    ? (i.length > 3 ? i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + i.slice(-3) : i)
    : i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + head + '.' + d;
}
const money = (v, cur) => (CURRENCIES[cur] || CURRENCIES.INR).sym + amt(v, cur);

/* 0 decimals where a quantity is whole, up to 3 where it is not */
function qtyText(v) {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
}

/* ---------- amounts in words ---------- */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (x) => x < 20 ? ONES[x] : TENS[Math.floor(x / 10)] + (x % 10 ? '-' + ONES[x % 10] : '');
const three = (x) => (x >= 100 ? ONES[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' and ' + two(x % 100) : '') : two(x));

/** Lakh and crore, the grouping a bank or an auditor in India expects. */
function indianWords(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(indianWords(crore) + ' Crore');
  if (lakh) parts.push(two(lakh) + ' Lakh');
  if (thousand) parts.push(two(thousand) + ' Thousand');
  if (n >= 100) parts.push(ONES[Math.floor(n / 100)] + ' Hundred');
  const rest = n % 100;
  let s = parts.join(' ');
  if (rest) s += (s ? ' and ' : '') + two(rest);
  return s;
}

/** Thousand, million, billion. */
function westWords(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'Zero';
  const scale = [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']];
  const parts = [];
  for (const [v, name] of scale) {
    if (n >= v) { parts.push(three(Math.floor(n / v)) + ' ' + name); n %= v; }
  }
  let s = parts.join(' ');
  if (n) s += (s ? ' and ' : '') + three(n);
  return s;
}

function amountWords(value, cur) {
  const c = CURRENCIES[cur] || CURRENCIES.INR;
  const w = c.group === 'indian' ? indianWords : westWords;
  const neg = value < 0;
  const minor = Math.round(Math.abs(value) * 100);
  const big = Math.floor(minor / 100), small = minor % 100;
  let s = c.major + ' ' + w(big);
  if (small) s += ' and ' + w(small) + ' ' + c.minor;
  return (neg ? 'Minus ' : '') + s + ' Only';
}

/* ---------- dates ---------- */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
/** "2026-09-20" -> "20 September 2026". Anything else is shown as typed. */
function fmtDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return String(s || '');
  return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
}
function plusDays(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Whole days from a to b, or null if either date is unreadable. */
function daysBetween(a, b) {
  const x = Date.parse(String(a) + 'T00:00:00Z'), y = Date.parse(String(b) + 'T00:00:00Z');
  if (!isFinite(x) || !isFinite(y)) return null;
  return Math.round((y - x) / 86400000);
}

/* ---------- line items ---------- */

/**
 * One item per line, read from the right the way the Invoice tool reads it:
 *
 *   description, HSN/SAC, quantity, unit, rate, discount%
 *
 * Only the rate and the quantity are required, so "Consulting, 2, 500" —
 * exactly what the Invoice tool takes — still works. The description may
 * contain commas, because nothing is read from the left.
 */
function parseLineItems(text, defUnit) {
  const rows = [], bad = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(',').map(s => s.trim());
    while (parts.length && parts[parts.length - 1] === '') parts.pop();

    let disc = 0;
    if (parts.length && /%$/.test(parts[parts.length - 1])) {
      const d = parts.pop().replace(/%$/, '').trim();
      if (!isNumTok(d)) { bad.push(line); continue; }
      disc = num(d);
    }
    if (parts.length < 2 || !isNumTok(parts[parts.length - 1])) { bad.push(line); continue; }
    const rate = num(parts.pop());

    let unit = defUnit;
    if (parts.length >= 2 && !isNumTok(parts[parts.length - 1]) && isUnitTok(parts[parts.length - 1])) {
      unit = parts.pop();
    }
    if (parts.length < 2 || !isNumTok(parts[parts.length - 1])) { bad.push(line); continue; }
    const qty = num(parts.pop());

    let hsn = '';
    if (parts.length >= 2 && /^\d{4,8}$/.test(parts[parts.length - 1])) hsn = parts.pop();

    const desc = parts.join(', ').trim();
    if (!desc) { bad.push(line); continue; }

    const gross = qty * rate;
    const discAmt = gross * disc / 100;
    rows.push({ desc, hsn, qty, unit, rate, disc, gross, discAmt, amount: gross - discAmt });
  }
  return { rows, bad };
}

/* ---------- tax ---------- */

/** Which tax lines a mode produces, and at what rate each. */
function taxPlan(mode, rate) {
  const r = Math.max(0, num(rate, 0));
  if (mode === 'gst-intra') return { label: 'GST', parts: [['CGST', r / 2], ['SGST', r / 2]], rate: r, idLabel: 'GSTIN' };
  if (mode === 'gst-inter') return { label: 'IGST', parts: [['IGST', r]], rate: r, idLabel: 'GSTIN' };
  if (mode === 'vat20') return { label: 'VAT', parts: [['VAT', 20]], rate: 20, idLabel: 'VAT No.' };
  if (mode === 'vat5') return { label: 'VAT', parts: [['VAT', 5]], rate: 5, idLabel: 'VAT No.' };
  if (mode === 'vat0') return { label: 'VAT', parts: [['VAT', 0]], rate: 0, idLabel: 'VAT No.' };
  return { label: '', parts: [], rate: 0, idLabel: 'Tax ID' };
}

/** Text or ink on an accent fill: dark on a light colour, white on a dark one. */
function onAccent(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  const [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16) / 255);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.55 ? '#1a1400' : '#ffffff';
}


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["quotation-pdf"] = {
"title": "Quotation & Proforma Invoice Generator (PDF)",
"kind": "create",
"multiple": false,
"description": "Create a quotation, proforma invoice or estimate as a clean PDF: line items with HSN/SAC and discounts, GST or VAT worked out for you, terms, bank details and an acceptance block for the client to sign and return.",
"keywords": ["quotation generator","proforma invoice format","quotation format in pdf","create quotation online","estimate template","proforma invoice generator","quotation maker"],
"glyph": "i-quotation",
"glyphSvg": "<symbol id=\"i-quotation\" viewBox=\"0 0 24 24\">\n  <path d=\"M13.2 2.9H6.4a1.5 1.5 0 0 0-1.5 1.5v15.2a1.5 1.5 0 0 0 1.5 1.5h4.2\"/>\n  <path d=\"M13.2 2.9l5.4 5.4v3\"/>\n  <path d=\"M12.9 3.2v5.2h5.2\" class=\"thin\"/>\n  <path d=\"M8.2 11.6h5.2M8.2 14.6h3.2\" class=\"thin\"/>\n  <circle cx=\"17\" cy=\"17.4\" r=\"4\"/>\n  <path d=\"M15.3 17.4l1.3 1.3 2.3-2.5\" class=\"thin\"/>\n</symbol>",
"controls": [
  {"key":"docType","label":"Document type","type":"select","default":"Quotation","options":[
    {"value":"Quotation","label":"Quotation"},
    {"value":"Proforma Invoice","label":"Proforma Invoice"},
    {"value":"Estimate","label":"Estimate"}]},

  {"key":"fromName","label":"Your business — name","type":"text","default":"Acme Interiors Pvt Ltd"},
  {"key":"fromAddress","label":"Your business — address","type":"textarea","default":"14 Industrial Estate, Peenya\nBengaluru 560058, Karnataka"},
  {"key":"fromTax","label":"Your GSTIN / VAT number","type":"text","default":"29AABCA1234C1Z5"},
  {"key":"fromPhone","label":"Your phone","type":"text","default":"+91 80 4000 1234"},
  {"key":"fromEmail","label":"Your email","type":"text","default":"sales@acmeinteriors.example"},
  {"key":"fromWeb","label":"Your website","type":"text","default":"www.acmeinteriors.example"},

  {"key":"toName","label":"Client — name","type":"text","default":"Northline Offices LLP"},
  {"key":"toAddress","label":"Client — address","type":"textarea","default":"7th Floor, Prestige Tower\n12 Residency Road\nBengaluru 560025, Karnataka"},
  {"key":"toTax","label":"Client GSTIN / VAT number","type":"text","default":"29AAFN5678D1ZK"},

  {"key":"number","label":"Quotation number","type":"text","default":"QT-0001"},
  {"key":"date","label":"Date","type":"date","default":"TODAY"},
  {"key":"validUntil","label":"Valid until","type":"date","default":plusDays(30)},

  {"key":"items","label":"Line items — description, HSN/SAC, quantity, unit, rate, discount%","type":"textarea","default":"Site survey and structural report, 998346, 1, Job, 25000\nAluminium partition, 3 m x 2.4 m panels, 76109010, 18, Nos, 8450, 5%\nToughened glass 10 mm, 70071900, 42, Sqm, 2150\nInstallation and finishing, 995478, 1, Lot, 36000, 2.5%"},

  {"key":"currency","label":"Currency","type":"select","default":"INR","options":[
    {"value":"INR","label":"Indian rupee (Rs)"},
    {"value":"GBP","label":"Pound sterling (£)"},
    {"value":"USD","label":"US dollar ($)"},
    {"value":"EUR","label":"Euro (€)"}]},
  {"key":"taxMode","label":"Tax","type":"select","default":"gst-intra","options":[
    {"value":"gst-intra","label":"GST — intra-state (CGST + SGST)"},
    {"value":"gst-inter","label":"GST — inter-state (IGST)"},
    {"value":"vat20","label":"UK VAT — 20% standard rate"},
    {"value":"vat5","label":"UK VAT — 5% reduced rate"},
    {"value":"vat0","label":"UK VAT — 0% zero-rated"},
    {"value":"none","label":"No tax"}]},
  {"key":"taxRate","label":"GST rate %","type":"number","default":18,"min":0,"max":100,"step":0.25,"hint":"Used by the two GST modes; the VAT rates are fixed by the choice above"},
  {"key":"rounding","label":"Round the total","type":"select","default":"near","options":[
    {"value":"none","label":"Do not round"},
    {"value":"near","label":"To the nearest whole unit"},
    {"value":"up","label":"Up to the whole unit"},
    {"value":"down","label":"Down to the whole unit"}]},
  {"key":"words","label":"Print the total in words","type":"select","default":"yes","options":[
    {"value":"yes","label":"Yes"},{"value":"no","label":"No"}]},

  {"key":"delivery","label":"Delivery period","type":"text","default":"4 to 6 weeks from a confirmed order"},
  {"key":"payTerms","label":"Payment terms","type":"text","default":"50% with the order, balance before dispatch"},
  {"key":"warranty","label":"Warranty","type":"text","default":"12 months against manufacturing defects"},
  {"key":"bank","label":"Bank details","type":"textarea","default":"Account name: Acme Interiors Pvt Ltd\nBank: HDFC Bank, Peenya, Bengaluru\nAccount number: 50200012345678\nIFSC: HDFC0001234"},
  {"key":"terms","label":"Terms and conditions — one per line, numbered on the page","type":"textarea","default":"Prices hold until the valid-until date above and are subject to confirmation after it.\nTax is charged at the rate in force on the date of supply.\nThe delivery period runs from a confirmed order and cleared advance payment.\nGoods remain our property until they have been paid for in full.\nAny change to the specification will be quoted separately before work starts."},
  {"key":"acceptance","label":"Acceptance wording — leave blank to omit the acceptance block","type":"textarea","default":"We accept this quotation and authorise you to proceed on the terms set out above."},
  {"key":"notes","label":"Notes","type":"textarea","default":"Thank you for the opportunity to quote. Please quote the number above on your purchase order."},

  {"key":"accent","label":"Accent colour","type":"color","default":"#1f3a5f"},
  {"key":"pageSize","label":"Page size","type":"select","default":"a4","options":[
    {"value":"a4","label":"A4"},{"value":"letter","label":"US Letter"},{"value":"legal","label":"US Legal"}]}
],
"run": async ({ opts, core }) => {
      const cur = CURRENCIES[opts.currency] ? opts.currency : 'INR';
      const parsed = parseLineItems(opts.items, 'Nos');
      if (parsed.bad.length) {
        return { error: 'Could not read "' + parsed.bad[0].slice(0, 46) + '". Each line is: description, HSN/SAC, quantity, unit, rate, discount% — and only the quantity and the rate are required.' };
      }
      if (!parsed.rows.length) return { error: 'Add at least one line item.' };
      if (parsed.rows.length > 200) return { error: 'That is more than 200 line items. Split the quotation.' };
      if (!String(opts.fromName || '').trim()) return { error: 'Enter your business name.' };
      if (!String(opts.toName || '').trim()) return { error: 'Enter the client’s name.' };

      const rows = parsed.rows;
      const docType = ['Quotation', 'Proforma Invoice', 'Estimate'].indexOf(opts.docType) >= 0 ? opts.docType : 'Quotation';
      const isProforma = docType === 'Proforma Invoice';

      /* ---------- the arithmetic ---------- */
      const gross = rows.reduce((s, r) => s + r.gross, 0);
      const discount = rows.reduce((s, r) => s + r.discAmt, 0);
      const taxable = gross - discount;
      const plan = taxPlan(opts.taxMode, opts.taxRate);
      const taxLines = plan.parts.map(([name, pct]) => [name, pct, taxable * pct / 100]);
      const taxTotal = taxLines.reduce((s, t) => s + t[2], 0);
      const raw = taxable + taxTotal;
      const rounded = opts.rounding === 'near' ? Math.round(raw)
        : opts.rounding === 'up' ? Math.ceil(raw)
        : opts.rounding === 'down' ? Math.floor(raw) : raw;
      const roundOff = rounded - raw;
      const total = rounded;
      const words = amountWords(total, cur);

      const validDays = daysBetween(opts.date, opts.validUntil);

      /* ---------- the page ---------- */
      const accent = /^#[0-9a-f]{6}$/i.test(opts.accent || '') ? opts.accent : '#1f3a5f';
      const ink = onAccent(accent);
      const GREY = '#666666', LIGHT = '#f4f5f7', RULE = '#e2e4e8', DARK = '#333333', LINE = '#9aa1a9';
      const [W, H] = core.PAGE_SIZES[opts.pageSize] || core.PAGE_SIZES.a4;
      const m = 42, inner = W - m * 2, BOTTOM = 64;

      const fit = (text, font, size, maxW) => {
        let t = String(text == null ? '' : text);
        if (core.textWidth(t, font, size) <= maxW) return t;
        while (t.length > 1 && core.textWidth(t + '…', font, size) > maxW) t = t.slice(0, -1);
        return t + '…';
      };
      const lines = (s) => String(s == null ? '' : s).split('\n').map(x => x.trim()).filter(Boolean);

      const fromName = String(opts.fromName || '').trim();
      const fromAddr = lines(opts.fromAddress);
      const toName = String(opts.toName || '').trim();
      const toAddr = lines(opts.toAddress);
      const number = String(opts.number || '').trim();

      const pagesOut = [];
      let ops = [], y = 0;

      function letterheadFull() {
        ops.push({ rect: [0, H - 6, W, 6], fill: accent });
        const half = W * 0.54;
        let ly = H - 52;
        /* The right-hand block occupies the top two lines only; anything
           below its last baseline may use the full width. */
        const clear = ly - 26;
        const maxW = (at) => at < clear ? inner : half;
        ops.push({ text: fit(fromName, 'Helvetica-Bold', 15, half), x: m, y: ly, size: 15, font: 'Helvetica-Bold' });
        let l = ly - 16;
        for (const ln of fromAddr) { ops.push({ text: fit(ln, 'Helvetica', 9, maxW(l)), x: m, y: l, size: 9, colour: GREY }); l -= 11.5; }
        if (String(opts.fromTax || '').trim()) {
          ops.push({ text: fit(plan.idLabel + ': ' + String(opts.fromTax).trim(), 'Helvetica', 9, maxW(l)), x: m, y: l, size: 9, colour: GREY }); l -= 11.5;
        }
        const contact = [opts.fromPhone, opts.fromEmail, opts.fromWeb].map(x => String(x || '').trim()).filter(Boolean).join('  ·  ');
        if (contact) { ops.push({ text: fit(contact, 'Helvetica', 9, maxW(l)), x: m, y: l, size: 9, colour: GREY }); l -= 11.5; }

        ops.push({ text: docType.toUpperCase(), x: W - m, y: ly, size: 19, font: 'Helvetica-Bold', align: 'right', colour: accent });
        let r = ly - 18;
        ops.push({ text: 'No. ' + (number || '—'), x: W - m, y: r, size: 10.5, font: 'Helvetica-Bold', align: 'right' });
        r -= 14;
        y = Math.min(l, r) - 8;
        ops.push({ line: [m, y, W - m, y], stroke: accent, lineWidth: 1.2 });
        y -= 22;
      }

      function letterheadCompact() {
        ops.push({ rect: [0, H - 6, W, 6], fill: accent });
        y = H - 40;
        ops.push({ text: fit(fromName, 'Helvetica-Bold', 10, W * 0.5), x: m, y, size: 10, font: 'Helvetica-Bold' });
        ops.push({ text: docType + ' ' + number + ' · continued', x: W - m, y, size: 9, align: 'right', colour: GREY });
        y -= 9;
        ops.push({ line: [m, y, W - m, y], stroke: accent, lineWidth: 0.8 });
        y -= 22;
      }

      function newPage(first) {
        ops = [];
        pagesOut.push({ size: [W, H], ops });
        if (first) letterheadFull(); else letterheadCompact();
      }
      function need(h) { if (y - h < BOTTOM) { newPage(false); return true; } return false; }

      newPage(true);

      /* ---------- who it is for, and the dates ---------- */
      const metaRows = [
        [docType.toUpperCase() + ' NO.', number || '—'],
        ['DATE', fmtDate(opts.date) || '—'],
        ['VALID UNTIL', fmtDate(opts.validUntil) || '—']
      ];
      if (validDays !== null && validDays >= 0) metaRows.push(['VALID FOR', validDays + (validDays === 1 ? ' day' : ' days')]);
      const toBlock = [toName].concat(toAddr);
      if (String(opts.toTax || '').trim()) toBlock.push(plan.idLabel + ': ' + String(opts.toTax).trim());
      const panelH = Math.max(24 + toBlock.length * 12.5, 24 + metaRows.length * 14) + 12;
      need(panelH + 12);
      ops.push({ rect: [m, y - panelH, inner, panelH], fill: LIGHT });
      const leftW = inner * 0.56;
      ops.push({ text: (isProforma ? 'PROFORMA INVOICE TO' : 'QUOTATION FOR'), x: m + 12, y: y - 16, size: 7, font: 'Helvetica-Bold', colour: GREY });
      toBlock.forEach((ln, i) => ops.push({
        text: fit(ln, i === 0 ? 'Helvetica-Bold' : 'Helvetica', i === 0 ? 11 : 9, leftW - 24),
        x: m + 12, y: y - 30 - i * 12.5, size: i === 0 ? 11 : 9,
        font: i === 0 ? 'Helvetica-Bold' : 'Helvetica', colour: i === 0 ? '#000000' : DARK
      }));
      metaRows.forEach(([k, v], i) => {
        const my = y - 18 - i * 14;
        ops.push({ text: k, x: m + leftW + 12, y: my, size: 7, font: 'Helvetica-Bold', colour: GREY });
        ops.push({ text: fit(v, 'Helvetica-Bold', 9.5, inner - leftW - 24 - 96), x: W - m - 12, y: my, size: 9.5, font: 'Helvetica-Bold', align: 'right' });
      });
      y -= panelH + 16;

      /* ---------- what this document is not ---------- */
      let band = '';
      if (isProforma) {
        band = 'This is a proforma invoice, not a tax invoice. It is issued so that the buyer can raise an order or arrange payment; no input tax credit may be claimed against it, and a tax invoice will follow the supply.';
      } else if (docType === 'Estimate') {
        band = 'This is an estimate. It is our best indication of the price on the information available and is not a fixed offer; the final charge may differ once the work is specified.';
      }
      if (band) {
        const bl = core.wrapText(band, 'Helvetica', 8.5, inner - 24);
        const bh = bl.length * 11 + 14;
        need(bh + 10);
        ops.push({ rect: [m, y - bh, inner, bh], fill: '#fff6e0' });
        ops.push({ rect: [m, y - bh, 3.5, bh], fill: '#d98900' });
        bl.forEach((ln, i) => ops.push({ text: ln, x: m + 14, y: y - 14 - i * 11, size: 8.5, colour: '#5a4100' }));
        y -= bh + 16;
      }

      /* ---------- the item table ---------- */
      const showHsn = rows.some(r => r.hsn);
      const showDisc = rows.some(r => r.disc);
      const cols = [{ key: 'n', label: '#', w: 20, align: 'left' }, { key: 'desc', label: 'DESCRIPTION', w: 0, align: 'left' }];
      if (showHsn) cols.push({ key: 'hsn', label: 'HSN/SAC', w: 54, align: 'left' });
      cols.push({ key: 'qty', label: 'QTY', w: 40, align: 'right' });
      cols.push({ key: 'unit', label: 'UNIT', w: 36, align: 'left' });
      cols.push({ key: 'rate', label: 'RATE', w: 62, align: 'right' });
      if (showDisc) cols.push({ key: 'disc', label: 'DISC %', w: 36, align: 'right' });
      cols.push({ key: 'amt', label: 'AMOUNT', w: 74, align: 'right' });
      const fixed = cols.reduce((s, c) => s + c.w, 0);
      cols[1].w = Math.max(110, inner - fixed);
      let cx = m;
      cols.forEach(c => { c.x = cx; cx += c.w; });
      const cellX = (c) => c.align === 'right' ? c.x + c.w - 6 : c.x + 6;
      const descW = cols[1].w - 12;

      function tableHead() {
        ops.push({ rect: [m, y - 19, inner, 19], fill: accent });
        cols.forEach(c => ops.push({
          text: c.key === 'rate' || c.key === 'amt' ? c.label + ' (' + (cur === 'INR' ? 'Rs' : CURRENCIES[cur].sym.trim()) + ')' : c.label,
          x: cellX(c), y: y - 13, size: 7, font: 'Helvetica-Bold', colour: ink, align: c.align
        }));
        y -= 19;
      }
      tableHead();

      rows.forEach((r, i) => {
        const wrapped = core.wrapText(r.desc, 'Helvetica', 9, descW);
        const rowH = Math.max(1, wrapped.length) * 11 + 8;
        if (y - rowH < BOTTOM) { newPage(false); tableHead(); }
        const top = y - 12;
        ops.push({ text: String(i + 1), x: cellX(cols[0]), y: top, size: 8.5, colour: GREY });
        wrapped.forEach((ln, k) => ops.push({ text: ln, x: cols[1].x + 6, y: top - k * 11, size: 9 }));
        const put = (key, text, font) => {
          const c = cols.find(x => x.key === key);
          if (!c) return;
          ops.push({ text: text, x: cellX(c), y: top, size: 9, align: c.align, font: font || 'Helvetica' });
        };
        put('hsn', r.hsn || '—');
        put('qty', qtyText(r.qty));
        put('unit', fit(r.unit, 'Helvetica', 9, 30));
        put('rate', amt(r.rate, cur));
        put('disc', r.disc ? qtyText(r.disc) : '—');
        put('amt', amt(r.amount, cur), 'Helvetica-Bold');
        y -= rowH;
        ops.push({ line: [m, y + 4, W - m, y + 4], stroke: RULE, lineWidth: 0.5 });
      });
      y -= 12;

      /* ---------- totals ---------- */
      const totalRows = [['Subtotal', amt(gross, cur), false]];
      if (discount) totalRows.push(['Discount', '-' + amt(discount, cur), false]);
      if (discount) totalRows.push(['Taxable value', amt(taxable, cur), false]);
      taxLines.forEach(([name, pct, v]) => totalRows.push([name + ' ' + qtyText(pct) + '%', amt(v, cur), false]));
      if (Math.abs(roundOff) >= 0.005) totalRows.push(['Rounding', (roundOff > 0 ? '+' : '-') + amt(Math.abs(roundOff), cur), false]);
      const totW = 250, totX = W - m - totW;
      const blockH = totalRows.length * 15 + 52;
      need(blockH + 6);
      totalRows.forEach(([k, v], i) => {
        const ty = y - 12 - i * 15;
        ops.push({ text: k, x: totX + 10, y: ty, size: 9, colour: DARK });
        ops.push({ text: v, x: W - m - 10, y: ty, size: 9, align: 'right' });
      });
      /* The band clears the descenders of the last plain row above it. */
      const lastBase = y - 12 - (totalRows.length - 1) * 15;
      const bandTop = lastBase - 8;
      ops.push({ rect: [totX, bandTop - 26, totW, 26], fill: accent });
      ops.push({ text: 'TOTAL', x: totX + 10, y: bandTop - 17, size: 11, font: 'Helvetica-Bold', colour: ink });
      ops.push({ text: money(total, cur), x: W - m - 10, y: bandTop - 17.5, size: 12, font: 'Helvetica-Bold', align: 'right', colour: ink });
      y = bandTop - 26 - 18;

      if (opts.words !== 'no') {
        const wl = core.wrapText('Amount in words: ' + words, 'Helvetica-Bold', 9, inner);
        need(wl.length * 12 + 8);
        wl.forEach((ln, i) => ops.push({ text: ln, x: m, y: y - i * 12, size: 9, font: 'Helvetica-Bold', colour: DARK }));
        y -= wl.length * 12 + 10;
      }

      /* ---------- commercial terms strip ---------- */
      const strip = [['DELIVERY PERIOD', opts.delivery], ['PAYMENT TERMS', opts.payTerms], ['WARRANTY', opts.warranty]]
        .map(([k, v]) => [k, String(v || '').trim()]).filter(x => x[1]);
      if (strip.length) {
        const sw = inner / strip.length;
        const wrapEach = strip.map(([, v]) => core.wrapText(v, 'Helvetica', 8.5, sw - 20));
        const sh = Math.max.apply(null, wrapEach.map(w => w.length)) * 11 + 26;
        need(sh + 10);
        strip.forEach(([k], i) => {
          const x0 = m + i * sw;
          ops.push({ rect: [x0, y - sh, sw, sh], stroke: RULE, lineWidth: 0.6 });
          ops.push({ text: k, x: x0 + 10, y: y - 14, size: 7, font: 'Helvetica-Bold', colour: GREY });
          wrapEach[i].forEach((ln, j) => ops.push({ text: ln, x: x0 + 10, y: y - 27 - j * 11, size: 8.5 }));
        });
        y -= sh + 16;
      }

      /* ---------- bank details ---------- */
      const bankLines = lines(opts.bank);
      if (bankLines.length) {
        const bh = bankLines.length * 11 + 24;
        need(bh + 10);
        ops.push({ rect: [m, y - bh, inner, bh], fill: LIGHT });
        ops.push({ text: 'BANK DETAILS', x: m + 12, y: y - 14, size: 7, font: 'Helvetica-Bold', colour: GREY });
        bankLines.forEach((ln, i) => ops.push({ text: fit(ln, 'Helvetica', 8.5, inner - 24), x: m + 12, y: y - 27 - i * 11, size: 8.5 }));
        y -= bh + 16;
      }

      /* ---------- terms, numbered ---------- */
      const termLines = lines(opts.terms);
      if (termLines.length) {
        /* Do not start a numbered list that only has room for one item. */
        need(30 + Math.min(2, termLines.length) * 15);
        ops.push({ text: 'TERMS AND CONDITIONS', x: m, y, size: 7.5, font: 'Helvetica-Bold', colour: GREY });
        y -= 14;
        termLines.forEach((t, i) => {
          const wrapped = core.wrapText(t, 'Helvetica', 8.5, inner - 22);
          if (y - wrapped.length * 11 < BOTTOM) { newPage(false); }
          ops.push({ text: (i + 1) + '.', x: m, y, size: 8.5, colour: GREY });
          wrapped.forEach((ln, k) => ops.push({ text: ln, x: m + 20, y: y - k * 11, size: 8.5, colour: DARK }));
          y -= wrapped.length * 11 + 4;
        });
        y -= 12;
      }

      /* ---------- acceptance ---------- */
      const accept = String(opts.acceptance || '').trim();
      if (accept) {
        const halfW = inner / 2 - 8;
        const aw = core.wrapText(accept, 'Helvetica', 8.5, halfW - 24);
        /* header (29) + wording + a gap, then three ruled lines 24 apart,
           each with its caption under it, then the bottom padding. */
        const sigTop = 29 + aw.length * 11 + 20;
        const ah = sigTop + 2 * 24 + 20;
        need(ah + 10);
        const box = (x0, w, label) => {
          ops.push({ rect: [x0, y - ah, w, ah], stroke: LINE, lineWidth: 0.7 });
          ops.push({ text: label, x: x0 + 12, y: y - 15, size: 7, font: 'Helvetica-Bold', colour: GREY });
        };
        const ruled = (x0, w, rows) => rows.forEach(([lab], i) => {
          const rowY = y - sigTop - i * 24;
          ops.push({ line: [x0 + 12, rowY, x0 + w - 12, rowY], stroke: LINE, lineWidth: 0.6 });
          ops.push({ text: lab, x: x0 + 12, y: rowY - 9, size: 6.5, colour: GREY });
        });
        box(m, halfW, 'ACCEPTED BY THE CLIENT');
        aw.forEach((ln, i) => ops.push({ text: ln, x: m + 12, y: y - 29 - i * 11, size: 8.5, colour: DARK }));
        ruled(m, halfW, [['Name and designation'], ['Signature and company stamp'], ['Date']]);
        const rx = m + halfW + 16, rw = inner - halfW - 16;
        box(rx, rw, 'FOR ' + fit(fromName.toUpperCase(), 'Helvetica-Bold', 7, rw - 50));
        ruled(rx, rw, [['Name and designation'], ['Authorised signatory'], ['Date']]);
        y -= ah + 16;
      }

      /* ---------- notes ---------- */
      const noteText = String(opts.notes || '').trim();
      if (noteText) {
        const nl = core.wrapText(noteText, 'Helvetica', 8.5, inner);
        need(nl.length * 11 + 18);
        ops.push({ text: 'NOTES', x: m, y, size: 7, font: 'Helvetica-Bold', colour: GREY });
        y -= 13;
        nl.forEach((ln, i) => ops.push({ text: ln, x: m, y: y - i * 11, size: 8.5, colour: DARK }));
        y -= nl.length * 11;
      }

      /* ---------- footers, once the page count is known ---------- */
      const footLeft = fit(fromName + ' · ' + docType + ' ' + number, 'Helvetica', 7.5, inner - 130);
      pagesOut.forEach((p, i) => {
        p.ops.push({ line: [m, 48, W - m, 48], stroke: RULE, lineWidth: 0.5 });
        p.ops.push({ text: footLeft, x: m, y: 36, size: 7.5, colour: GREY });
        p.ops.push({ text: 'Page ' + (i + 1) + ' of ' + pagesOut.length, x: W - m, y: 36, size: 7.5, align: 'right', colour: GREY });
      });

      const bytes = core.createPDF(pagesOut, {
        /* Info strings go out as raw bytes, so keep them to Latin-1 */
        info: {
          Title: docType + ' ' + number + ' - ' + toName,
          Author: fromName,
          Subject: docType + ' for ' + toName
        }
      });

      let warn = '';
      if (validDays !== null && validDays < 0) {
        warn = 'The valid-until date is before the document date, so this quotation has already expired.';
      } else if (opts.taxMode === 'gst-intra' && String(opts.fromTax || '').trim().slice(0, 2) &&
                 String(opts.toTax || '').trim().slice(0, 2) &&
                 /^\d{2}/.test(String(opts.fromTax).trim()) && /^\d{2}/.test(String(opts.toTax).trim()) &&
                 String(opts.fromTax).trim().slice(0, 2) !== String(opts.toTax).trim().slice(0, 2)) {
        warn = 'The two GSTINs start with different state codes, which usually means IGST rather than CGST + SGST. The document prints the split you chose.';
      }

      const stats = [
        ['Document', docType],
        ['Line items', String(rows.length)],
        ['Subtotal', money(gross, cur)]
      ];
      if (discount) stats.push(['Discount', '-' + money(discount, cur)], ['Taxable value', money(taxable, cur)]);
      stats.push([plan.parts.length ? plan.label + ' ' + qtyText(plan.rate) + '%' : 'Tax', money(taxTotal, cur)]);
      stats.push(['Total', money(total, cur)]);
      if (opts.words !== 'no') stats.push(['In words', words]);
      stats.push(['Valid until', fmtDate(opts.validUntil) + (validDays !== null && validDays >= 0 ? ' (' + validDays + ' days)' : '')]);
      stats.push(['Pages', String(pagesOut.length)]);
      stats.push(['Output size', fmtBytes(bytes.length)]);

      return {
        files: [{ name: slug(docType) + '-' + slug(number || 'quotation') + '.pdf', bytes }],
        warn: warn || undefined,
        stats: stats
      };
    },
"tips": [
  "Line items read from the right: description, HSN/SAC, quantity, unit, rate, discount%. Only the quantity and the rate are required, so \"Consulting, 2, 500\" works exactly as it does in the Invoice tool — and the description may contain commas, because nothing is read from the left.",
  "The unit word is what separates the quantity from the rate. \"Glass 10 mm, 70071900, 42, Sqm, 2150\" gives 42 Sqm at 2,150; leave the unit out and the last two numbers are read as quantity and rate.",
  "Intra-state GST splits the rate into CGST and SGST at half each; inter-state charges IGST at the full rate. If the two GSTINs start with different state codes it is normally inter-state, and the tool says so.",
  "A proforma invoice is not a tax invoice. The document says so on its face, because a buyer cannot claim input tax credit against it and an auditor will ask.",
  "The standard PDF fonts cover Western European characters only, so the rupee sign cannot be drawn. Amounts are marked Rs, which every bank and auditor reads the same way. Pound, dollar and euro signs do print.",
  "A quotation is an offer. Until the client accepts it, either side can walk away; once they sign the acceptance block and return it, you have a contract on these terms. That is why the valid-until date matters.",
  "Everything is drawn on your device, so client names, rates and bank details never leave it."
],
"faq": [
  {"q":"What is the difference between a quotation, an estimate and a proforma invoice?","a":"A quotation is a firm offer to supply at a stated price, open until it expires. An estimate is an indication of the likely price and is not binding. A proforma invoice is a full invoice-shaped document sent before the supply, usually so the buyer can raise a purchase order, open a letter of credit or pay in advance — but it is not a tax invoice and no input tax credit arises from it."},
  {"q":"Does a proforma invoice need a GST invoice number series?","a":"No. Only tax invoices must run in an unbroken serial series. A proforma is best given its own prefix — PI- or QT- — so it can never be mistaken for a tax invoice in your books or the buyer's."},
  {"q":"Can I use this for a UK VAT quotation?","a":"Yes. Choose a UK VAT rate in the tax list, switch the currency to pounds and put your VAT registration number in the tax field; the HSN/SAC column disappears if none of your lines carry one. Whether a quotation must show VAT separately is a commercial choice, but showing it avoids an argument later about whether the price was VAT-inclusive."},
  {"q":"Why does the total sometimes end in .00 when the tax does not?","a":"Because rounding is set to the nearest whole unit, which is the convention on Indian invoices. The rounding line shows exactly how much was added or taken off, so the arithmetic still reconciles. Set rounding to \"Do not round\" to keep the paise or pence."},
  {"q":"Can different line items carry different tax rates?","a":"Not in this version. One rate applies to the whole document, which covers most quotations but not a mixed basket where, say, a 5% item and an 18% item sit on the same page. Where the rates differ, raise one quotation per rate, or quote the goods net and state the rates in the terms. The arithmetic on the page always reconciles to the rate it shows."},
  {"q":"How many line items fit?","a":"As many as you need, up to 200. The table continues onto further pages with the column headings repeated and \"Page n of m\" in the footer; the totals, terms and acceptance block print once, at the end."}
]
};
})();
