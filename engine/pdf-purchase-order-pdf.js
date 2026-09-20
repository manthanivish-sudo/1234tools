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
function fmtDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return String(s || '');
  return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
}
function plusDays(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  const x = Date.parse(String(a) + 'T00:00:00Z'), y = Date.parse(String(b) + 'T00:00:00Z');
  if (!isFinite(x) || !isFinite(y)) return null;
  return Math.round((y - x) / 86400000);
}

/* ---------- line items ---------- */

/**
 * One item per line, read from the right the way the Invoice and Quotation
 * tools read it:
 *
 *   description, HSN/SAC, quantity, unit, rate, discount%
 *
 * Only the quantity and the rate are required. The description may contain
 * commas, because nothing is read from the left.
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

/** "Freight and insurance, 4500" / "Packing 1800" -> { label, amount }. */
function parseCharges(text) {
  const rows = [], bad = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(.*?)[\s,;:=\t]+(?:rs\.?|inr)?\s*(-?[\d,]*\d(?:\.\d+)?)\s*$/i.exec(line);
    if (!m || !m[1].trim()) { bad.push(line); continue; }
    const amount = num(m[2], NaN);
    if (!isFinite(amount)) { bad.push(line); continue; }
    rows.push({ label: m[1].trim().replace(/[,;:=\s]+$/, ''), amount });
  }
  return { rows, bad };
}

/* ---------- tax ---------- */

function taxPlan(mode, rate) {
  const r = Math.max(0, num(rate, 0));
  if (mode === 'gst-intra') return { label: 'GST', parts: [['CGST', r / 2], ['SGST', r / 2]], rate: r, idLabel: 'GSTIN' };
  if (mode === 'gst-inter') return { label: 'IGST', parts: [['IGST', r]], rate: r, idLabel: 'GSTIN' };
  if (mode === 'vat20') return { label: 'VAT', parts: [['VAT', 20]], rate: 20, idLabel: 'VAT No.' };
  if (mode === 'vat5') return { label: 'VAT', parts: [['VAT', 5]], rate: 5, idLabel: 'VAT No.' };
  if (mode === 'vat0') return { label: 'VAT', parts: [['VAT', 0]], rate: 0, idLabel: 'VAT No.' };
  return { label: '', parts: [], rate: 0, idLabel: 'Tax ID' };
}

/* ---------- Incoterms 2020 ---------- */

const INCOTERMS = {
  'EXW': 'EXW — Ex Works: the buyer collects and carries every cost and risk from the supplier’s door.',
  'FCA': 'FCA — Free Carrier: the supplier hands the goods to the buyer’s carrier at the named place.',
  'FOB': 'FOB — Free On Board: the supplier bears cost and risk until the goods are on board at the named port.',
  'CIF': 'CIF — Cost, Insurance and Freight: the supplier pays carriage and insurance to the named port of destination.',
  'DAP': 'DAP — Delivered At Place: the supplier delivers to the named place, ready for unloading.',
  'DDP': 'DDP — Delivered Duty Paid: the supplier delivers cleared for import, with all duties paid.',
  'AGREED': 'Delivery on the terms separately agreed between the parties.'
};

/** Text or ink on an accent fill: dark on a light colour, white on a dark one. */
function onAccent(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  const [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16) / 255);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.55 ? '#1a1400' : '#ffffff';
}


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["purchase-order-pdf"] = {
"title": "Purchase Order Generator (PDF)",
"kind": "create",
"multiple": false,
"description": "Create a purchase order PDF from the buyer’s side: supplier and delivery details, line items with HSN/SAC, freight and packing charges, GST or VAT, Incoterms, an inspection clause and an authorised signatory block.",
"keywords": ["purchase order generator","purchase order format pdf","po template","create purchase order online","purchase order maker","po format in excel alternative"],
"glyph": "i-purchase-order",
"glyphSvg": "<symbol id=\"i-purchase-order\" viewBox=\"0 0 24 24\">\n  <path d=\"M13.2 2.9H6.4a1.5 1.5 0 0 0-1.5 1.5v15.2a1.5 1.5 0 0 0 1.5 1.5h3.8\"/>\n  <path d=\"M13.2 2.9l5.4 5.4v2.2\"/>\n  <path d=\"M12.9 3.2v5.2h5.2\" class=\"thin\"/>\n  <path d=\"M8.2 11.4h4\" class=\"thin\"/>\n  <path d=\"M11.9 13.2h1.6l1.5 5.1h4.3l1.3-3.6h-6.3\"/>\n  <circle cx=\"15.4\" cy=\"20.4\" r=\".95\" class=\"fill\"/>\n  <circle cx=\"18.9\" cy=\"20.4\" r=\".95\" class=\"fill\"/>\n</symbol>",
"controls": [
  {"key":"buyerName","label":"Your business (the buyer) — name","type":"text","default":"Northline Offices LLP"},
  {"key":"buyerAddress","label":"Buyer — address","type":"textarea","default":"7th Floor, Prestige Tower\n12 Residency Road\nBengaluru 560025, Karnataka"},
  {"key":"buyerTax","label":"Buyer GSTIN / VAT number","type":"text","default":"29AAFN5678D1ZK"},
  {"key":"buyerContact","label":"Buyer — phone and email","type":"text","default":"+91 80 2299 0100  ·  purchase@northline.example"},

  {"key":"supplierName","label":"Supplier — name","type":"text","default":"Acme Interiors Pvt Ltd"},
  {"key":"supplierAddress","label":"Supplier — address","type":"textarea","default":"14 Industrial Estate, Peenya\nBengaluru 560058, Karnataka"},
  {"key":"supplierTax","label":"Supplier GSTIN / VAT number","type":"text","default":"29AABCA1234C1Z5"},

  {"key":"number","label":"Purchase order number","type":"text","default":"PO-0001"},
  {"key":"date","label":"Date","type":"date","default":"TODAY"},
  {"key":"quoteRef","label":"Supplier’s quotation reference","type":"text","default":"QT-0001 dated 20 September 2026"},
  {"key":"requiredBy","label":"Required by","type":"date","default":plusDays(21)},

  {"key":"sameAddress","label":"Delivery address","type":"select","default":"same","options":[
    {"value":"same","label":"Same as the buyer’s address"},
    {"value":"other","label":"Use the address below"}]},
  {"key":"deliveryAddress","label":"Deliver to (used only when “Use the address below” is chosen)","type":"textarea","default":"Northline Offices LLP — Site Office\nPlot 22, Whitefield Main Road\nBengaluru 560066, Karnataka\nContact: Site Manager, +91 98450 00000"},

  {"key":"items","label":"Line items — description, HSN/SAC, quantity, unit, rate, discount%","type":"textarea","default":"Aluminium partition, 3 m x 2.4 m panels, 76109010, 18, Nos, 8450\nToughened glass 10 mm, 70071900, 42, Sqm, 2150\nInstallation and finishing, 995478, 1, Lot, 36000"},
  {"key":"charges","label":"Freight, packing and other charges — one per line: label, amount","type":"textarea","default":"Freight and insurance, 4500\nPacking and forwarding, 1800"},

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
  {"key":"words","label":"Print the committed value in words","type":"select","default":"yes","options":[
    {"value":"yes","label":"Yes"},{"value":"no","label":"No"}]},

  {"key":"payTerms","label":"Payment terms","type":"text","default":"30 days from acceptance of the goods"},
  {"key":"incoterm","label":"Delivery terms (Incoterms 2020)","type":"select","default":"DAP","options":[
    {"value":"EXW","label":"EXW — Ex Works"},
    {"value":"FCA","label":"FCA — Free Carrier"},
    {"value":"FOB","label":"FOB — Free On Board"},
    {"value":"CIF","label":"CIF — Cost, Insurance and Freight"},
    {"value":"DAP","label":"DAP — Delivered At Place"},
    {"value":"DDP","label":"DDP — Delivered Duty Paid"},
    {"value":"AGREED","label":"As separately agreed"}]},
  {"key":"incotermPlace","label":"Named place or port","type":"text","default":"Bengaluru 560025","hint":"An Incoterm means nothing without the place that follows it"},
  {"key":"validity","label":"Purchase order validity","type":"text","default":"Acknowledge within 7 days. This order lapses 30 days after the date above if it has not been accepted."},
  {"key":"inspection","label":"Inspection and acceptance clause","type":"textarea","default":"Goods are received subject to inspection at the delivery address within 7 working days.\nShort, damaged or non-conforming goods may be rejected and returned at the supplier’s cost.\nPayment falls due on acceptance, not on delivery."},
  {"key":"terms","label":"Terms and conditions — one per line, numbered on the page","type":"textarea","default":"Quote this purchase order number on every invoice, delivery challan and packing list.\nPartial deliveries are accepted only with our written agreement.\nThe prices above are firm and include every charge shown; nothing further will be paid.\nThe supplier warrants the goods are new, of merchantable quality and fit for the purpose stated.\nThis order is placed on these terms alone. Terms printed on an acknowledgement or invoice do not apply."},
  {"key":"signatory","label":"Authorised signatory — name and title","type":"textarea","default":"Rajiv Menon\nPurchase Manager"},
  {"key":"notes","label":"Notes","type":"textarea","default":"Please acknowledge this order by return, confirming the price and the delivery date."},

  {"key":"accent","label":"Accent colour","type":"color","default":"#20423a"},
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
      if (parsed.rows.length > 200) return { error: 'That is more than 200 line items. Split the order.' };
      const charges = parseCharges(opts.charges);
      if (charges.bad.length) {
        return { error: 'Could not read the charge "' + charges.bad[0].slice(0, 46) + '". Each line is a label, then the amount: "Freight and insurance, 4500".' };
      }
      if (!String(opts.buyerName || '').trim()) return { error: 'Enter the buyer’s name — that is your business.' };
      if (!String(opts.supplierName || '').trim()) return { error: 'Enter the supplier’s name.' };

      const rows = parsed.rows;

      /* ---------- the arithmetic ---------- */
      const gross = rows.reduce((s, r) => s + r.gross, 0);
      const discount = rows.reduce((s, r) => s + r.discAmt, 0);
      const chargeTotal = charges.rows.reduce((s, r) => s + r.amount, 0);
      /* Freight and packing recovered by the supplier form part of the
         consideration, so they are taxed with the goods. */
      const taxable = gross - discount + chargeTotal;
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
      const leadDays = daysBetween(opts.date, opts.requiredBy);

      /* ---------- the page ---------- */
      const accent = /^#[0-9a-f]{6}$/i.test(opts.accent || '') ? opts.accent : '#20423a';
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

      const buyerName = String(opts.buyerName || '').trim();
      const buyerAddr = lines(opts.buyerAddress);
      const supplierName = String(opts.supplierName || '').trim();
      const number = String(opts.number || '').trim();
      const deliverTo = opts.sameAddress === 'other'
        ? [buyerName].concat(lines(opts.deliveryAddress))
        : [buyerName].concat(buyerAddr);
      const incoKey = INCOTERMS[opts.incoterm] ? opts.incoterm : 'DAP';
      const place = String(opts.incotermPlace || '').trim();
      const incoShort = incoKey === 'AGREED' ? 'As agreed' : (incoKey + (place ? ' ' + place : ''));

      const pagesOut = [];
      let ops = [], y = 0;

      function letterheadFull() {
        ops.push({ rect: [0, H - 6, W, 6], fill: accent });
        const half = W * 0.54;
        const ly = H - 52;
        const clear = ly - 26;
        const maxW = (at) => at < clear ? inner : half;
        ops.push({ text: fit(buyerName, 'Helvetica-Bold', 15, half), x: m, y: ly, size: 15, font: 'Helvetica-Bold' });
        let l = ly - 16;
        for (const ln of buyerAddr) { ops.push({ text: fit(ln, 'Helvetica', 9, maxW(l)), x: m, y: l, size: 9, colour: GREY }); l -= 11.5; }
        if (String(opts.buyerTax || '').trim()) {
          ops.push({ text: fit(plan.idLabel + ': ' + String(opts.buyerTax).trim(), 'Helvetica', 9, maxW(l)), x: m, y: l, size: 9, colour: GREY }); l -= 11.5;
        }
        const contact = String(opts.buyerContact || '').trim();
        if (contact) { ops.push({ text: fit(contact, 'Helvetica', 9, maxW(l)), x: m, y: l, size: 9, colour: GREY }); l -= 11.5; }

        ops.push({ text: 'PURCHASE ORDER', x: W - m, y: ly, size: 19, font: 'Helvetica-Bold', align: 'right', colour: accent });
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
        ops.push({ text: fit(buyerName, 'Helvetica-Bold', 10, W * 0.5), x: m, y, size: 10, font: 'Helvetica-Bold' });
        ops.push({ text: 'Purchase order ' + number + ' · continued', x: W - m, y, size: 9, align: 'right', colour: GREY });
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

      /* ---------- supplier and the order's own facts ---------- */
      const supBlock = [supplierName].concat(lines(opts.supplierAddress));
      if (String(opts.supplierTax || '').trim()) supBlock.push(plan.idLabel + ': ' + String(opts.supplierTax).trim());
      const metaRows = [
        ['PO NUMBER', number || '—'],
        ['DATE', fmtDate(opts.date) || '—'],
        ['REQUIRED BY', fmtDate(opts.requiredBy) || '—']
      ];
      if (String(opts.quoteRef || '').trim()) metaRows.push(['YOUR QUOTATION', String(opts.quoteRef).trim()]);
      const panelH = Math.max(24 + supBlock.length * 12.5, 24 + metaRows.length * 14) + 12;
      need(panelH + 12);
      ops.push({ rect: [m, y - panelH, inner, panelH], fill: LIGHT });
      const leftW = inner * 0.46;
      ops.push({ text: 'TO (SUPPLIER)', x: m + 12, y: y - 16, size: 7, font: 'Helvetica-Bold', colour: GREY });
      supBlock.forEach((ln, i) => ops.push({
        text: fit(ln, i === 0 ? 'Helvetica-Bold' : 'Helvetica', i === 0 ? 11 : 9, leftW - 24),
        x: m + 12, y: y - 30 - i * 12.5, size: i === 0 ? 11 : 9,
        font: i === 0 ? 'Helvetica-Bold' : 'Helvetica', colour: i === 0 ? '#000000' : DARK
      }));
      metaRows.forEach(([k, v], i) => {
        const my = y - 18 - i * 14;
        ops.push({ text: k, x: m + leftW + 12, y: my, size: 7, font: 'Helvetica-Bold', colour: GREY });
        ops.push({ text: fit(v, 'Helvetica-Bold', 9.5, inner - leftW - 24 - 72), x: W - m - 12, y: my, size: 9.5, font: 'Helvetica-Bold', align: 'right' });
      });
      y -= panelH + 14;

      /* ---------- deliver to / delivery terms ---------- */
      const dtLines = deliverTo;
      const termLinesBox = [
        'Incoterms 2020: ' + incoShort,
        'Required by: ' + (fmtDate(opts.requiredBy) || '—') +
          (leadDays !== null && leadDays >= 0 ? '  (' + leadDays + (leadDays === 1 ? ' day' : ' days') + ')' : ''),
        'Payment: ' + (String(opts.payTerms || '').trim() || '—')
      ];
      const boxW = inner / 2 - 8;
      const dtWrapped = [].concat.apply([], dtLines.map(t => core.wrapText(t, 'Helvetica', 9, boxW - 24)));
      const dtermWrapped = [].concat.apply([], termLinesBox.map(t => core.wrapText(t, 'Helvetica', 9, boxW - 24)));
      const boxH = Math.max(dtWrapped.length, dtermWrapped.length) * 12 + 30;
      need(boxH + 12);
      const twoBox = (x0, label, rowsIn) => {
        ops.push({ rect: [x0, y - boxH, boxW, boxH], stroke: RULE, lineWidth: 0.7 });
        ops.push({ text: label, x: x0 + 12, y: y - 15, size: 7, font: 'Helvetica-Bold', colour: GREY });
        rowsIn.forEach((ln, i) => ops.push({ text: ln, x: x0 + 12, y: y - 29 - i * 12, size: 9, colour: DARK }));
      };
      twoBox(m, 'DELIVER TO', dtWrapped);
      twoBox(m + boxW + 16, 'DELIVERY AND PAYMENT', dtermWrapped);
      y -= boxH + 16;

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
      const symbol = cur === 'INR' ? 'Rs' : CURRENCIES[cur].sym.trim();

      function tableHead() {
        ops.push({ rect: [m, y - 19, inner, 19], fill: accent });
        cols.forEach(c => ops.push({
          text: (c.key === 'rate' || c.key === 'amt') ? c.label + ' (' + symbol + ')' : c.label,
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
      const totalRows = [['Goods and services', amt(gross, cur)]];
      if (discount) totalRows.push(['Discount', '-' + amt(discount, cur)]);
      charges.rows.forEach(c => totalRows.push([c.label, amt(c.amount, cur)]));
      if (chargeTotal || discount) totalRows.push(['Taxable value', amt(taxable, cur)]);
      taxLines.forEach(([name, pct, v]) => totalRows.push([name + ' ' + qtyText(pct) + '%', amt(v, cur)]));
      if (Math.abs(roundOff) >= 0.005) totalRows.push(['Rounding', (roundOff > 0 ? '+' : '-') + amt(Math.abs(roundOff), cur)]);
      const totW = 260, totX = W - m - totW;
      need(totalRows.length * 15 + 52);
      totalRows.forEach(([k, v], i) => {
        const ty = y - 12 - i * 15;
        ops.push({ text: fit(k, 'Helvetica', 9, totW - 110), x: totX + 10, y: ty, size: 9, colour: DARK });
        ops.push({ text: v, x: W - m - 10, y: ty, size: 9, align: 'right' });
      });
      const lastBase = y - 12 - (totalRows.length - 1) * 15;
      const bandTop = lastBase - 8;
      ops.push({ rect: [totX, bandTop - 26, totW, 26], fill: accent });
      ops.push({ text: 'ORDER VALUE', x: totX + 10, y: bandTop - 17, size: 10, font: 'Helvetica-Bold', colour: ink });
      ops.push({ text: money(total, cur), x: W - m - 10, y: bandTop - 17.5, size: 12, font: 'Helvetica-Bold', align: 'right', colour: ink });
      y = bandTop - 26 - 18;

      if (opts.words !== 'no') {
        const wl = core.wrapText('Committed value in words: ' + words, 'Helvetica-Bold', 9, inner);
        need(wl.length * 12 + 8);
        wl.forEach((ln, i) => ops.push({ text: ln, x: m, y: y - i * 12, size: 9, font: 'Helvetica-Bold', colour: DARK }));
        y -= wl.length * 12 + 12;
      }

      /* ---------- Incoterm in full, and the validity ---------- */
      const noteBits = [INCOTERMS[incoKey] + (incoKey !== 'AGREED' && place ? ' Named place: ' + place + '.' : '')];
      if (String(opts.validity || '').trim()) noteBits.push(String(opts.validity).trim());
      const nbWrapped = [].concat.apply([], noteBits.map(t => core.wrapText(t, 'Helvetica', 8.5, inner - 24)));
      const nbH = nbWrapped.length * 11 + 24;
      need(nbH + 10);
      ops.push({ rect: [m, y - nbH, inner, nbH], fill: LIGHT });
      ops.push({ text: 'DELIVERY TERMS AND VALIDITY', x: m + 12, y: y - 14, size: 7, font: 'Helvetica-Bold', colour: GREY });
      nbWrapped.forEach((ln, i) => ops.push({ text: ln, x: m + 12, y: y - 27 - i * 11, size: 8.5, colour: DARK }));
      y -= nbH + 16;

      /* ---------- inspection and acceptance ---------- */
      const insp = lines(opts.inspection);
      if (insp.length) {
        const iw = [].concat.apply([], insp.map(t => core.wrapText(t, 'Helvetica', 8.5, inner - 28)));
        const ih = iw.length * 11 + 26;
        need(ih + 10);
        ops.push({ rect: [m, y - ih, inner, ih], stroke: RULE, lineWidth: 0.7 });
        ops.push({ rect: [m, y - ih, 3.5, ih], fill: accent });
        ops.push({ text: 'INSPECTION AND ACCEPTANCE', x: m + 14, y: y - 15, size: 7, font: 'Helvetica-Bold', colour: GREY });
        iw.forEach((ln, i) => ops.push({ text: ln, x: m + 14, y: y - 28 - i * 11, size: 8.5, colour: DARK }));
        y -= ih + 16;
      }

      /* ---------- terms, numbered ---------- */
      const tLines = lines(opts.terms);
      if (tLines.length) {
        /* Do not start a numbered list that only has room for one item. */
        need(30 + Math.min(2, tLines.length) * 15);
        ops.push({ text: 'TERMS AND CONDITIONS', x: m, y, size: 7.5, font: 'Helvetica-Bold', colour: GREY });
        y -= 14;
        tLines.forEach((t, i) => {
          const wrapped = core.wrapText(t, 'Helvetica', 8.5, inner - 22);
          if (y - wrapped.length * 11 < BOTTOM) newPage(false);
          ops.push({ text: (i + 1) + '.', x: m, y, size: 8.5, colour: GREY });
          wrapped.forEach((ln, k) => ops.push({ text: ln, x: m + 20, y: y - k * 11, size: 8.5, colour: DARK }));
          y -= wrapped.length * 11 + 4;
        });
        y -= 12;
      }

      /* ---------- authorised signatory ---------- */
      const sig = lines(opts.signatory);
      const sigW = inner / 2 - 8, sigX = W - m - sigW;
      const sigH = 100;
      need(sigH + 10);
      ops.push({ rect: [sigX, y - sigH, sigW, sigH], stroke: LINE, lineWidth: 0.7 });
      ops.push({ text: 'FOR ' + fit(buyerName.toUpperCase(), 'Helvetica-Bold', 7, sigW - 50), x: sigX + 12, y: y - 15, size: 7, font: 'Helvetica-Bold', colour: GREY });
      ops.push({ line: [sigX + 12, y - 58, sigX + sigW - 12, y - 58], stroke: LINE, lineWidth: 0.6 });
      sig.forEach((ln, i) => ops.push({
        text: fit(ln, i === 0 ? 'Helvetica-Bold' : 'Helvetica', i === 0 ? 9.5 : 8.5, sigW - 24),
        x: sigX + 12, y: y - 72 - i * 12, size: i === 0 ? 9.5 : 8.5,
        font: i === 0 ? 'Helvetica-Bold' : 'Helvetica', colour: i === 0 ? '#000000' : GREY
      }));
      ops.push({ text: 'Authorised signatory', x: sigX + sigW - 12, y: y - 72, size: 6.5, align: 'right', colour: GREY });
      y -= sigH + 16;

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
      const footLeft = fit(buyerName + ' · Purchase order ' + number, 'Helvetica', 7.5, inner - 130);
      pagesOut.forEach((p, i) => {
        p.ops.push({ line: [m, 48, W - m, 48], stroke: RULE, lineWidth: 0.5 });
        p.ops.push({ text: footLeft, x: m, y: 36, size: 7.5, colour: GREY });
        p.ops.push({ text: 'Page ' + (i + 1) + ' of ' + pagesOut.length, x: W - m, y: 36, size: 7.5, align: 'right', colour: GREY });
      });

      const bytes = core.createPDF(pagesOut, {
        info: {
          Title: 'Purchase order ' + number + ' - ' + supplierName,
          Author: buyerName,
          Subject: 'Purchase order to ' + supplierName
        }
      });

      let warn = '';
      if (leadDays !== null && leadDays < 0) {
        warn = 'The required-by date is before the order date. The order prints what you typed.';
      } else if (incoKey !== 'AGREED' && !place) {
        warn = 'An Incoterm without a named place is incomplete — "DAP" alone does not say where delivery happens. Add the place or port.';
      }

      const stats = [
        ['Line items', String(rows.length)],
        ['Goods and services', money(gross, cur)]
      ];
      if (discount) stats.push(['Discount', '-' + money(discount, cur)]);
      if (chargeTotal) stats.push(['Freight and other charges', money(chargeTotal, cur)]);
      stats.push(['Taxable value', money(taxable, cur)]);
      stats.push([plan.parts.length ? plan.label + ' ' + qtyText(plan.rate) + '%' : 'Tax', money(taxTotal, cur)]);
      stats.push(['Committed value', money(total, cur)]);
      if (opts.words !== 'no') stats.push(['In words', words]);
      stats.push(['Delivery terms', incoShort]);
      stats.push(['Required by', fmtDate(opts.requiredBy) + (leadDays !== null && leadDays >= 0 ? ' (' + leadDays + ' days)' : '')]);
      stats.push(['Pages', String(pagesOut.length)]);
      stats.push(['Output size', fmtBytes(bytes.length)]);

      return {
        files: [{ name: 'purchase-order-' + slug(number || 'purchase-order') + '.pdf', bytes }],
        warn: warn || undefined,
        stats: stats
      };
    },
"tips": [
  "A purchase order is an offer to buy. It becomes a binding contract the moment the supplier accepts it — by acknowledging it, or simply by starting to supply against it. Everything you would want in that contract has to be on the order, which is why the terms, the Incoterm and the inspection clause are printed rather than assumed.",
  "Line items read from the right: description, HSN/SAC, quantity, unit, rate, discount%. Only the quantity and the rate are required, so \"Consulting, 2, 500\" works here exactly as it does in the Invoice and Quotation tools, and the description may contain commas.",
  "Freight, packing and other charges are listed separately but added to the taxable value before tax, because a charge the supplier recovers from you is part of the consideration for the supply.",
  "An Incoterm means nothing without the place that follows it. “DAP” does not say where delivery happens; “DAP Bengaluru 560025” does, and that is the line an insurer or a court will read.",
  "Quote your own PO number, not the supplier’s reference, on the order. Every invoice, challan and packing list that comes back should carry it, which is what makes a three-way match possible later.",
  "The standard PDF fonts cover Western European characters only, so the rupee sign cannot be drawn. Amounts are marked Rs, which every bank and auditor reads the same way. Pound, dollar and euro signs do print.",
  "Everything is drawn on your device, so supplier names, prices and delivery addresses never leave it."
],
"faq": [
  {"q":"Is a purchase order legally binding?","a":"On its own it is an offer, not a contract. It binds both sides once the supplier accepts it — by acknowledging it in writing, or by acting on it. That is why this order carries an acknowledgement deadline and a validity period: an offer left open for ever is a liability, and an order accepted on the supplier’s terms rather than yours is a different contract from the one you meant to make."},
  {"q":"What is the difference between a purchase order and a proforma invoice?","a":"They face in opposite directions. A proforma invoice comes from the seller, offering to supply; a purchase order comes from the buyer, offering to buy. In practice a supplier sends a quotation or proforma, the buyer raises a PO quoting its reference, and the supplier then issues a tax invoice against the PO."},
  {"q":"Does the delivery address have to match the buyer’s address?","a":"No, and it often should not. Goods are frequently delivered to a site, a warehouse or a third party while the invoice goes to the registered office. Under Indian GST that is a “bill to — ship to” supply, and the delivery address on the order is what the supplier must put on the e-way bill. Switch the delivery address control to “Use the address below” and type it in."},
  {"q":"Should tax be shown on a purchase order at all?","a":"Showing it is the safer habit. The tax is the supplier’s to charge and account for, but putting the expected rate and split on the order means an invoice that arrives with a different figure gets questioned before it is paid, not after."},
  {"q":"Can different line items carry different tax rates?","a":"Not in this version. One rate applies to the whole order, which covers most orders but not a mixed basket where a 5% item and an 18% item sit on the same page. Where the rates differ, raise one order per rate, or order the goods net and state the expected rates in the terms. The arithmetic on the page always reconciles to the rate it shows."},
  {"q":"How many line items fit?","a":"As many as you need, up to 200. The table continues onto further pages with the column headings repeated and “Page n of m” in the footer; the totals, terms and signature block print once, at the end."}
]
};
})();
