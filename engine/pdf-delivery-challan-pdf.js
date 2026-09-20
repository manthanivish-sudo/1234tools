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
   "Cartons". It is what separates the quantity from the weight. */
const isUnitTok = (s) => /^[A-Za-z][A-Za-z.\-\/ ]{0,13}$/.test(String(s).trim());

/* ---------- money ---------- */

const CURRENCIES = {
  GBP: { sym: '£', major: 'Pounds', minor: 'Pence', group: 'west' },
  USD: { sym: '$', major: 'Dollars', minor: 'Cents', group: 'west' },
  EUR: { sym: '€', major: 'Euros', minor: 'Cents', group: 'west' },
  INR: { sym: 'Rs ', major: 'Rupees', minor: 'Paise', group: 'indian' }
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

/** 0 decimals where the number is whole, up to 3 where it is not. */
function numText(v) {
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
  const minor = Math.round(Math.abs(value) * 100);
  const big = Math.floor(minor / 100), small = minor % 100;
  let s = c.major + ' ' + w(big);
  if (small) s += ' and ' + w(small) + ' ' + c.minor;
  return (value < 0 ? 'Minus ' : '') + s + ' Only';
}

/* ---------- dates ---------- */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
function fmtDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return String(s || '');
  return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
}

/* ---------- line items ---------- */

/**
 * One item per line, read from the right the way the Invoice, Quotation and
 * Purchase Order tools read theirs:
 *
 *   description, HSN, quantity, unit, weight, packages
 *
 * The unit is the anchor: it is the one field that is never a number, so
 * whatever follows it is the weight and the package count, and whatever sits
 * in front of it is the quantity and, before that, the HSN code. Without a
 * unit the line is read as "description, HSN, quantity" — the shortest form
 * that still means something.
 */
function parseChallanItems(text, defUnit) {
  const rows = [], bad = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(',').map(s => s.trim());
    while (parts.length && parts[parts.length - 1] === '') parts.pop();
    if (parts.length < 2) { bad.push(line); continue; }

    /* the last non-numeric token in the tail, if it looks like a unit */
    let unitIdx = -1;
    for (let i = parts.length - 1; i >= 1; i--) {
      if (isNumTok(parts[i])) continue;
      if (isUnitTok(parts[i])) unitIdx = i;
      break;
    }
    if (unitIdx >= 0) {
      const after = parts.slice(unitIdx + 1);
      if (after.length > 2 || !after.every(isNumTok)) unitIdx = -1;
    }

    let desc, hsn = '', qty, unit = defUnit, weight = 0, packages = 0;
    let weightGiven = false, pkgGiven = false;

    if (unitIdx >= 0) {
      unit = parts[unitIdx];
      if (!isNumTok(parts[unitIdx - 1])) { bad.push(line); continue; }
      qty = num(parts[unitIdx - 1]);
      const after = parts.slice(unitIdx + 1);
      if (after.length >= 1) { weight = num(after[0]); weightGiven = true; }
      if (after.length >= 2) { packages = num(after[1]); pkgGiven = true; }
      let end = unitIdx - 1;
      if (end >= 2 && /^\d{4,8}$/.test(parts[end - 1])) { hsn = parts[end - 1]; end -= 1; }
      desc = parts.slice(0, end).join(', ').trim();
    } else {
      const tail = parts.slice();
      if (!isNumTok(tail[tail.length - 1])) { bad.push(line); continue; }
      qty = num(tail.pop());
      if (tail.length >= 2 && /^\d{4,8}$/.test(tail[tail.length - 1])) hsn = tail.pop();
      desc = tail.join(', ').trim();
    }
    if (!desc) { bad.push(line); continue; }
    rows.push({ desc, hsn, qty, unit, weight, packages, weightGiven, pkgGiven });
  }
  return { rows, bad };
}

/* ---------- why the goods are moving ---------- */

/* The categories the GST rules and the e-way bill portal actually name. */
const PURPOSES = {
  supply:    { label: 'Supply', supply: true },
  jobwork:   { label: 'Job work', supply: false },
  approval:  { label: 'Goods sent on approval', supply: false },
  exhibition:{ label: 'Exhibition or fairs', supply: false },
  ownuse:    { label: 'For own use', supply: false },
  linesales: { label: 'Line sales', supply: false },
  other:     { label: 'Reasons other than supply', supply: false }
};

/** Text or ink on an accent fill: dark on a light colour, white on a dark one. */
function onAccent(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  const [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16) / 255);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.55 ? '#1a1400' : '#ffffff';
}


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["delivery-challan-pdf"] = {
"title": "Delivery Challan & Packing List Generator (PDF)",
"kind": "create",
"multiple": false,
"description": "Create the document that travels with the goods: consignor and consignee, purpose of movement, vehicle and transporter details, items with weights and package counts, and an acknowledgement for the receiver to sign — printed as Original, Duplicate and Triplicate copies.",
"keywords": ["delivery challan format","delivery challan generator","packing list template","challan pdf","job work challan","delivery note maker","goods challan format"],
"glyph": "i-challan",
"glyphSvg": "<symbol id=\"i-challan\" viewBox=\"0 0 24 24\">\n  <path d=\"M1.9 5.9h11.3v11.3H1.9z\"/>\n  <path d=\"M13.2 9.5h3.9l3 3.2v4.5h-6.9z\"/>\n  <circle cx=\"6.6\" cy=\"18.9\" r=\"1.8\"/>\n  <circle cx=\"17.3\" cy=\"18.9\" r=\"1.8\"/>\n  <path d=\"M5.2 9.4h4.6\" class=\"thin\"/>\n</symbol>",
"controls": [
  {"key":"docType","label":"Document type","type":"select","default":"challan","options":[
    {"value":"challan","label":"Delivery Challan"},
    {"value":"packing","label":"Packing List"},
    {"value":"both","label":"Both on one page"}]},

  {"key":"consignorName","label":"Consignor (who is sending) — name","type":"text","default":"Acme Interiors Pvt Ltd"},
  {"key":"consignorAddress","label":"Consignor — address","type":"textarea","default":"14 Industrial Estate, Peenya\nBengaluru 560058, Karnataka"},
  {"key":"consignorGstin","label":"Consignor GSTIN","type":"text","default":"29AABCA1234C1Z5"},
  {"key":"consignorContact","label":"Consignor — phone and email","type":"text","default":"+91 80 4000 1234  ·  dispatch@acmeinteriors.example"},

  {"key":"consigneeName","label":"Consignee (who is receiving) — name","type":"text","default":"Northline Offices LLP"},
  {"key":"consigneeAddress","label":"Consignee — address","type":"textarea","default":"Site Office, Plot 22\nWhitefield Main Road\nBengaluru 560066, Karnataka"},
  {"key":"consigneeGstin","label":"Consignee GSTIN","type":"text","default":"29AAFN5678D1ZK"},

  {"key":"number","label":"Challan number","type":"text","default":"DC-0001"},
  {"key":"date","label":"Date","type":"date","default":"TODAY"},
  {"key":"purpose","label":"Purpose of movement","type":"select","default":"supply","options":[
    {"value":"supply","label":"Supply"},
    {"value":"jobwork","label":"Job work"},
    {"value":"approval","label":"Goods sent on approval"},
    {"value":"exhibition","label":"Exhibition or fairs"},
    {"value":"ownuse","label":"For own use"},
    {"value":"linesales","label":"Line sales"},
    {"value":"other","label":"Reasons other than supply"}]},
  {"key":"reference","label":"Reference invoice or purchase order number","type":"text","default":"PO-0001 dated 20 September 2026"},

  {"key":"dispatchFrom","label":"Place of dispatch","type":"text","default":"Peenya, Bengaluru 560058"},
  {"key":"deliverTo","label":"Place of delivery","type":"text","default":"Whitefield, Bengaluru 560066"},
  {"key":"vehicle","label":"Vehicle number","type":"text","default":"KA 01 AB 4321"},
  {"key":"transporter","label":"Transporter name","type":"text","default":"Sharma Roadlines"},
  {"key":"lrNumber","label":"LR / GR number","type":"text","default":"SRL-88214"},
  {"key":"ewayBill","label":"E-way bill number","type":"text","default":"","hint":"Generated on the government portal, not here — type it in once you have it"},
  {"key":"caseMarks","label":"Case or package marks","type":"text","default":"NL/BLR/1-14"},

  {"key":"items","label":"Line items — description, HSN, quantity, unit, weight, packages","type":"textarea","default":"Aluminium partition panels 3 m x 2.4 m, 76109010, 18, Nos, 21.5, 6\nToughened glass 10 mm, 70071900, 42, Sqm, 26, 7\nFixings, trims and sealant kit, 76101000, 1, Set, 14, 1"},

  {"key":"declaredValue","label":"Declared value of the goods","type":"number","default":347976,"min":0,"step":0.01,"hint":"Leave at 0 to leave the value off the document"},
  {"key":"currency","label":"Currency","type":"select","default":"INR","options":[
    {"value":"INR","label":"Indian rupee (Rs)"},
    {"value":"GBP","label":"Pound sterling (£)"},
    {"value":"USD","label":"US dollar ($)"},
    {"value":"EUR","label":"Euro (€)"}]},

  {"key":"copies","label":"Copies to print","type":"select","default":"3","options":[
    {"value":"1","label":"Original for the consignee only"},
    {"value":"2","label":"Original and Duplicate for the transporter"},
    {"value":"3","label":"Original, Duplicate and Triplicate"}]},
  {"key":"acknowledgement","label":"Receiver’s acknowledgement wording — leave blank to omit the block","type":"textarea","default":"Received the goods described above in good condition, in the number of packages stated, and checked against this challan."},
  {"key":"notes","label":"Notes and conditions — one per line, numbered on the page","type":"textarea","default":"Check the number of packages and the condition of the seals before signing.\nAny shortage or damage must be noted on this challan at the time of delivery.\nThis challan must travel with the goods and be produced on demand."},

  {"key":"accent","label":"Accent colour","type":"color","default":"#4a2b5f"},
  {"key":"pageSize","label":"Page size","type":"select","default":"a4","options":[
    {"value":"a4","label":"A4"},{"value":"letter","label":"US Letter"},{"value":"legal","label":"US Legal"}]}
],
"run": async ({ opts, core }) => {
      const cur = CURRENCIES[opts.currency] ? opts.currency : 'INR';
      const parsed = parseChallanItems(opts.items, 'Nos');
      if (parsed.bad.length) {
        return { error: 'Could not read "' + parsed.bad[0].slice(0, 46) + '". Each line is: description, HSN, quantity, unit, weight, packages — and only the quantity is required.' };
      }
      if (!parsed.rows.length) return { error: 'Add at least one line item.' };
      if (parsed.rows.length > 200) return { error: 'That is more than 200 line items. Split the consignment.' };
      if (!String(opts.consignorName || '').trim()) return { error: 'Enter the consignor’s name — that is who is sending the goods.' };
      if (!String(opts.consigneeName || '').trim()) return { error: 'Enter the consignee’s name — that is who is receiving them.' };

      const rows = parsed.rows;
      const mode = ['challan', 'packing', 'both'].indexOf(opts.docType) >= 0 ? opts.docType : 'challan';
      const title = mode === 'packing' ? 'PACKING LIST'
        : mode === 'both' ? 'DELIVERY CHALLAN & PACKING LIST' : 'DELIVERY CHALLAN';
      const showValue = mode !== 'packing';
      const purpose = PURPOSES[opts.purpose] || PURPOSES.supply;

      const totalQty = rows.reduce((s, r) => s + r.qty, 0);
      const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
      const totalPkgs = rows.reduce((s, r) => s + r.packages, 0);
      const anyWeight = rows.some(r => r.weightGiven);
      const anyPkgs = rows.some(r => r.pkgGiven);
      const value = Math.max(0, num(opts.declaredValue, 0));
      const units = [];
      rows.forEach(r => { if (units.indexOf(r.unit) < 0) units.push(r.unit); });

      const copyCount = [1, 2, 3].indexOf(Number(opts.copies)) >= 0 ? Number(opts.copies) : 3;
      const COPY_NAMES = ['ORIGINAL FOR CONSIGNEE', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR CONSIGNOR'];
      const copyLabels = COPY_NAMES.slice(0, copyCount);

      /* ---------- the page ---------- */
      const accent = /^#[0-9a-f]{6}$/i.test(opts.accent || '') ? opts.accent : '#4a2b5f';
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

      const consignorName = String(opts.consignorName || '').trim();
      const consignorAddr = lines(opts.consignorAddress);
      const consigneeName = String(opts.consigneeName || '').trim();
      const number = String(opts.number || '').trim();

      /* ---------- one copy of the document ---------- */
      function buildCopy(copyLabel) {
        const out = [];
        let ops = [], y = 0;

        function letterheadFull() {
          ops.push({ rect: [0, H - 6, W, 6], fill: accent });
          /* the copy name in the corner, which is how these are filed */
          const cw = 190;
          ops.push({ rect: [W - m - cw, H - 58, cw, 16], fill: accent });
          ops.push({ text: fit(copyLabel, 'Helvetica-Bold', 7.5, cw - 12), x: W - m - cw / 2, y: H - 53, size: 7.5, font: 'Helvetica-Bold', align: 'center', colour: ink });
          /* "Delivery challan and packing list" is too long for one line at
             this size, so it stacks rather than being cut short. */
          const titleLines = mode === 'both' ? ['DELIVERY CHALLAN', '& PACKING LIST'] : [title];
          titleLines.forEach((t, i) => ops.push({
            text: fit(t, 'Helvetica-Bold', 16, inner * 0.52), x: W - m, y: H - 80 - i * 18,
            size: 16, font: 'Helvetica-Bold', align: 'right', colour: accent
          }));
          const rBottom = H - 80 - (titleLines.length - 1) * 18 - 16;
          ops.push({ text: 'No. ' + (number || '—'), x: W - m, y: rBottom, size: 10.5, font: 'Helvetica-Bold', align: 'right' });

          const half = W * 0.5;
          const clear = rBottom - 8;
          const maxW = (at) => at < clear ? inner : half;
          ops.push({ text: 'CONSIGNOR', x: m, y: H - 40, size: 7, font: 'Helvetica-Bold', colour: GREY });
          ops.push({ text: fit(consignorName, 'Helvetica-Bold', 14, half), x: m, y: H - 56, size: 14, font: 'Helvetica-Bold' });
          let l = H - 71;
          for (const ln of consignorAddr) { ops.push({ text: fit(ln, 'Helvetica', 9, maxW(l)), x: m, y: l, size: 9, colour: GREY }); l -= 11.5; }
          if (String(opts.consignorGstin || '').trim()) {
            ops.push({ text: fit('GSTIN: ' + String(opts.consignorGstin).trim(), 'Helvetica', 9, maxW(l)), x: m, y: l, size: 9, colour: GREY }); l -= 11.5;
          }
          const contact = String(opts.consignorContact || '').trim();
          if (contact) { ops.push({ text: fit(contact, 'Helvetica', 9, maxW(l)), x: m, y: l, size: 9, colour: GREY }); l -= 11.5; }

          y = Math.min(l, rBottom - 14) - 6;
          ops.push({ line: [m, y, W - m, y], stroke: accent, lineWidth: 1.2 });
          y -= 18;
        }

        function letterheadCompact() {
          ops.push({ rect: [0, H - 6, W, 6], fill: accent });
          y = H - 40;
          ops.push({ text: fit(consignorName, 'Helvetica-Bold', 10, W * 0.42), x: m, y, size: 10, font: 'Helvetica-Bold' });
          ops.push({ text: fit(title + ' ' + number + ' · ' + copyLabel, 'Helvetica', 8.5, inner * 0.55), x: W - m, y, size: 8.5, align: 'right', colour: GREY });
          y -= 9;
          ops.push({ line: [m, y, W - m, y], stroke: accent, lineWidth: 0.8 });
          y -= 22;
        }

        function newPage(first) {
          ops = [];
          out.push({ size: [W, H], ops });
          if (first) letterheadFull(); else letterheadCompact();
        }
        function need(h) { if (y - h < BOTTOM) { newPage(false); return true; } return false; }

        newPage(true);

        /* ---------- consignee and the challan's own facts ---------- */
        const cneBlock = [consigneeName].concat(lines(opts.consigneeAddress));
        if (String(opts.consigneeGstin || '').trim()) cneBlock.push('GSTIN: ' + String(opts.consigneeGstin).trim());
        const metaRows = [
          ['CHALLAN NO.', number || '—'],
          ['DATE', fmtDate(opts.date) || '—'],
          ['PURPOSE OF MOVEMENT', purpose.label]
        ];
        if (String(opts.reference || '').trim()) metaRows.push(['REFERENCE', String(opts.reference).trim()]);
        const panelH = Math.max(24 + cneBlock.length * 12.5, 24 + metaRows.length * 14) + 10;
        need(panelH + 12);
        ops.push({ rect: [m, y - panelH, inner, panelH], fill: LIGHT });
        const leftW = inner * 0.44;
        ops.push({ text: 'CONSIGNEE', x: m + 12, y: y - 16, size: 7, font: 'Helvetica-Bold', colour: GREY });
        cneBlock.forEach((ln, i) => ops.push({
          text: fit(ln, i === 0 ? 'Helvetica-Bold' : 'Helvetica', i === 0 ? 11 : 9, leftW - 24),
          x: m + 12, y: y - 30 - i * 12.5, size: i === 0 ? 11 : 9,
          font: i === 0 ? 'Helvetica-Bold' : 'Helvetica', colour: i === 0 ? '#000000' : DARK
        }));
        metaRows.forEach(([k, v], i) => {
          const my = y - 18 - i * 14;
          ops.push({ text: k, x: m + leftW + 12, y: my, size: 7, font: 'Helvetica-Bold', colour: GREY });
          ops.push({ text: fit(v, 'Helvetica-Bold', 9.5, inner - leftW - 24 - 88), x: W - m - 12, y: my, size: 9.5, font: 'Helvetica-Bold', align: 'right' });
        });
        y -= panelH + 12;

        /* ---------- movement and transport ---------- */
        const moveRows = [
          ['Place of dispatch', opts.dispatchFrom],
          ['Place of delivery', opts.deliverTo],
          ['Case or package marks', opts.caseMarks]
        ].map(([k, v]) => [k, String(v || '').trim()]).filter(x => x[1]);
        const transRows = [
          ['Vehicle number', opts.vehicle],
          ['Transporter', opts.transporter],
          ['LR / GR number', opts.lrNumber],
          ['E-way bill number', String(opts.ewayBill || '').trim() || 'Not generated']
        ].map(([k, v]) => [k, String(v || '').trim()]).filter(x => x[1]);
        const boxW = inner / 2 - 8;
        const boxH = Math.max(moveRows.length, transRows.length) * 12 + 28;
        need(boxH + 12);
        const twoBox = (x0, label, rowsIn) => {
          ops.push({ rect: [x0, y - boxH, boxW, boxH], stroke: RULE, lineWidth: 0.7 });
          ops.push({ text: label, x: x0 + 12, y: y - 15, size: 7, font: 'Helvetica-Bold', colour: GREY });
          rowsIn.forEach(([k, v], i) => {
            const ry = y - 29 - i * 12;
            ops.push({ text: k, x: x0 + 12, y: ry, size: 8.5, colour: GREY });
            ops.push({ text: fit(v, 'Helvetica-Bold', 8.5, boxW - 102), x: x0 + boxW - 12, y: ry, size: 8.5, font: 'Helvetica-Bold', align: 'right' });
          });
        };
        twoBox(m, 'MOVEMENT', moveRows);
        twoBox(m + boxW + 16, 'TRANSPORT', transRows);
        y -= boxH + 12;

        /* ---------- the item table ---------- */
        const showHsn = rows.some(r => r.hsn);
        const cols = [{ key: 'n', label: '#', w: 20, align: 'left' }, { key: 'desc', label: 'DESCRIPTION OF GOODS', w: 0, align: 'left' }];
        if (showHsn) cols.push({ key: 'hsn', label: 'HSN', w: 56, align: 'left' });
        cols.push({ key: 'qty', label: 'QTY', w: 44, align: 'right' });
        cols.push({ key: 'unit', label: 'UNIT', w: 38, align: 'left' });
        if (anyWeight) cols.push({ key: 'wt', label: 'WEIGHT (KG)', w: 62, align: 'right' });
        if (anyPkgs) cols.push({ key: 'pkg', label: 'PACKAGES', w: 56, align: 'right' });
        const fixed = cols.reduce((s, c) => s + c.w, 0);
        cols[1].w = Math.max(120, inner - fixed);
        let cx = m;
        cols.forEach(c => { c.x = cx; cx += c.w; });
        const cellX = (c) => c.align === 'right' ? c.x + c.w - 6 : c.x + 6;
        const descW = cols[1].w - 12;

        function tableHead() {
          ops.push({ rect: [m, y - 19, inner, 19], fill: accent });
          cols.forEach(c => ops.push({ text: c.label, x: cellX(c), y: y - 13, size: 7, font: 'Helvetica-Bold', colour: ink, align: c.align }));
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
          put('qty', numText(r.qty), 'Helvetica-Bold');
          put('unit', fit(r.unit, 'Helvetica', 9, 32));
          put('wt', r.weightGiven ? numText(r.weight) : '—');
          put('pkg', r.pkgGiven ? numText(r.packages) : '—');
          y -= rowH;
          ops.push({ line: [m, y + 4, W - m, y + 4], stroke: RULE, lineWidth: 0.5 });
        });
        y -= 8;

        /* ---------- the consignment in totals ---------- */
        const cells = [['TOTAL QUANTITY', numText(totalQty) + (units.length === 1 ? ' ' + units[0] : '')]];
        if (anyPkgs) cells.push(['TOTAL PACKAGES', numText(totalPkgs)]);
        if (anyWeight) cells.push(['TOTAL WEIGHT', numText(totalWeight) + ' kg']);
        if (showValue && value) cells.push(['DECLARED VALUE', money(value, cur)]);
        const cwd = inner / cells.length, ch = 38;
        need(ch + 12);
        cells.forEach(([k, v], i) => {
          const x0 = m + i * cwd;
          ops.push({ rect: [x0, y - ch, cwd, ch], fill: LIGHT });
          ops.push({ text: k, x: x0 + 10, y: y - 15, size: 7, font: 'Helvetica-Bold', colour: GREY });
          ops.push({ text: fit(v, 'Helvetica-Bold', 12, cwd - 20), x: x0 + 10, y: y - 31, size: 12, font: 'Helvetica-Bold' });
        });
        y -= ch + 12;

        /* ---------- what this document is, and is not ---------- */
        const declares = [];
        if (showValue && value) {
          declares.push(purpose.supply
            ? 'The value shown is the value of the goods supplied against the invoice or order referenced above. This challan is not a tax invoice.'
            : 'The value shown is declared for the purposes of transport only. This movement is not a supply, so no tax is charged on it and this challan is not a tax invoice.');
          declares.push('Amount in words: ' + amountWords(value, cur) + '.');
        } else {
          declares.push('This challan is not a tax invoice. It records the movement of the goods described above.');
        }
        if (!String(opts.ewayBill || '').trim()) {
          declares.push('An e-way bill, where the consignment value and the distance require one, is generated on the government portal and its number written above before the goods move.');
        }
        const dw = [].concat.apply([], declares.map(t => core.wrapText(t, 'Helvetica', 8.5, inner - 28)));
        const dh = dw.length * 11 + 20;
        need(dh + 10);
        ops.push({ rect: [m, y - dh, inner, dh], fill: '#fff6e0' });
        ops.push({ rect: [m, y - dh, 3.5, dh], fill: '#d98900' });
        dw.forEach((ln, i) => ops.push({ text: ln, x: m + 14, y: y - 15 - i * 11, size: 8.5, colour: '#5a4100' }));
        y -= dh + 12;

        /* ---------- notes, numbered ---------- */
        const noteLines = lines(opts.notes);
        if (noteLines.length) {
          /* Do not start a numbered list that only has room for one item. */
          need(30 + Math.min(2, noteLines.length) * 15);
          ops.push({ text: 'CONDITIONS', x: m, y, size: 7.5, font: 'Helvetica-Bold', colour: GREY });
          y -= 12;
          noteLines.forEach((t, i) => {
            const wrapped = core.wrapText(t, 'Helvetica', 8.5, inner - 22);
            if (y - wrapped.length * 11 < BOTTOM) newPage(false);
            ops.push({ text: (i + 1) + '.', x: m, y, size: 8.5, colour: GREY });
            wrapped.forEach((ln, k) => ops.push({ text: ln, x: m + 20, y: y - k * 11, size: 8.5, colour: DARK }));
            y -= wrapped.length * 11 + 3;
          });
          y -= 10;
        }

        /* ---------- signatures ---------- */
        const ack = String(opts.acknowledgement || '').trim();
        const halfW = inner / 2 - 8;
        const aw = ack ? core.wrapText(ack, 'Helvetica', 8.5, halfW - 24) : [];
        const sigTop = 29 + (aw.length ? aw.length * 11 + 20 : 8);
        const ah = sigTop + 2 * 22 + 18;
        need(ah + 10);
        const box = (x0, w, label) => {
          ops.push({ rect: [x0, y - ah, w, ah], stroke: LINE, lineWidth: 0.7 });
          ops.push({ text: label, x: x0 + 12, y: y - 15, size: 7, font: 'Helvetica-Bold', colour: GREY });
        };
        const ruled = (x0, w, labels) => labels.forEach((lab, i) => {
          const rowY = y - sigTop - i * 22;
          ops.push({ line: [x0 + 12, rowY, x0 + w - 12, rowY], stroke: LINE, lineWidth: 0.6 });
          ops.push({ text: lab, x: x0 + 12, y: rowY - 9, size: 6.5, colour: GREY });
        });
        box(m, halfW, 'RECEIVED BY THE CONSIGNEE');
        aw.forEach((ln, i) => ops.push({ text: ln, x: m + 12, y: y - 29 - i * 11, size: 8.5, colour: DARK }));
        ruled(m, halfW, ['Name in block capitals', 'Signature and stamp', 'Date and time of receipt']);
        const rx = m + halfW + 16, rw = inner - halfW - 16;
        box(rx, rw, 'FOR ' + fit(consignorName.toUpperCase(), 'Helvetica-Bold', 7, rw - 50));
        ruled(rx, rw, ['Prepared by', 'Authorised signatory', 'Date']);
        y -= ah + 16;

        /* ---------- footers ---------- */
        const footLeft = fit(consignorName + ' · ' + title.replace(/&/g, 'and') + ' ' + number, 'Helvetica', 7.5, inner - 190);
        out.forEach((p, i) => {
          p.ops.push({ line: [m, 48, W - m, 48], stroke: RULE, lineWidth: 0.5 });
          p.ops.push({ text: footLeft, x: m, y: 36, size: 7.5, colour: GREY });
          p.ops.push({ text: copyLabel + '  ·  Page ' + (i + 1) + ' of ' + out.length, x: W - m, y: 36, size: 7.5, align: 'right', colour: GREY });
        });
        return out;
      }

      let pagesOut = [];
      const perCopy = [];
      for (const label of copyLabels) {
        const built = buildCopy(label);
        perCopy.push(built.length);
        pagesOut = pagesOut.concat(built);
      }

      const bytes = core.createPDF(pagesOut, {
        info: {
          Title: title + ' ' + number + ' - ' + consigneeName,
          Author: consignorName,
          Subject: title + ' for ' + purpose.label
        }
      });

      let warn = '';
      if (!String(opts.ewayBill || '').trim() && value >= 50000) {
        warn = 'No e-way bill number has been entered and the declared value is ' + money(value, cur) +
          '. In India a consignment over Rs 50,000 usually needs one before the goods move; it is generated on the government portal, not here.';
      } else if (!anyPkgs) {
        warn = 'No package counts were given, so the packing columns are left off. Add a sixth field to each line to count the packages.';
      }

      const stats = [
        ['Document', title === 'DELIVERY CHALLAN & PACKING LIST' ? 'Delivery challan and packing list' : (title.charAt(0) + title.slice(1).toLowerCase())],
        ['Purpose of movement', purpose.label],
        ['Line items', String(rows.length)],
        ['Total quantity', numText(totalQty) + (units.length === 1 ? ' ' + units[0] : ' (mixed units)')],
        ['Packages', anyPkgs ? numText(totalPkgs) : 'not stated'],
        ['Total weight', anyWeight ? numText(totalWeight) + ' kg' : 'not stated']
      ];
      stats.push(['Declared value', showValue && value ? money(value, cur) : 'not shown']);
      stats.push(['Copies', String(copyCount) + ' × ' + perCopy[0] + (perCopy[0] === 1 ? ' page' : ' pages')]);
      stats.push(['Pages', String(pagesOut.length)]);
      stats.push(['Output size', fmtBytes(bytes.length)]);

      return {
        files: [{ name: (mode === 'packing' ? 'packing-list-' : 'delivery-challan-') + slug(number || 'challan') + '.pdf', bytes }],
        warn: warn || undefined,
        stats: stats
      };
    },
"tips": [
  "Line items read from the right: description, HSN, quantity, unit, weight, packages. The unit is the anchor — it is the one field that is never a number — so \"Glass 10 mm, 70071900, 42, Sqm, 26, 7\" means 42 Sqm weighing 26 kg in 7 packages. Only the quantity is required.",
  "A delivery challan is not a tax invoice. It travels with the goods so that the consignee, the transporter and an inspecting officer can all see what is in the vehicle; the tax invoice is a separate document and only a supply produces one.",
  "The purposes offered are the ones the GST rules and the e-way bill portal name: supply, job work, goods sent on approval, exhibition or fairs, own use and line sales. Choosing anything other than supply prints the declaration that the value shown is for transport purposes only.",
  "An e-way bill is generated on the government portal, never here. The field is there so that the number can be written on the challan before the goods move; the tool warns if the declared value is over Rs 50,000 and the field is still empty.",
  "Three copies are the convention: Original for the consignee, Duplicate for the transporter, Triplicate for the consignor. Each is printed as its own page with its name in the corner and in the footer, so they can be separated after printing.",
  "Print the challan on paper and hand a signed copy back. The acknowledgement block — received in good condition, name, signature, date — is the only evidence you will have if a shortage is claimed a week later.",
  "The standard PDF fonts cover Western European characters only, so the rupee sign cannot be drawn. Amounts are marked Rs, which every bank and auditor reads the same way.",
  "Everything is drawn on your device, so consignee names, values and vehicle numbers never leave it."
],
"faq": [
  {"q":"When can goods move on a delivery challan instead of a tax invoice?","a":"Under the Indian GST rules a challan covers movement that is not a supply, or where the invoice cannot be issued yet: job work, goods sent on approval, exhibition stock, transfers for your own use, line sales from a vehicle, and supply of liquid gas where the quantity is not known when the goods leave. Where there is a supply, the tax invoice is the document and the challan simply travels with it as a delivery note."},
  {"q":"Is a delivery challan the same as a packing list?","a":"They overlap but answer different questions. A challan says who is sending what to whom and why the goods are moving; a packing list says how the consignment is made up — how many packages, what is in each, what it weighs. Choose “Both on one page” when one sheet has to do both jobs, which is the usual arrangement for a single-vehicle delivery."},
  {"q":"Does this generate an e-way bill?","a":"No, and nothing that runs in a browser can. An e-way bill is issued by the government portal against your registration, and the number it returns is what makes the movement lawful. This tool gives you a field to write that number on the challan, and warns you when the declared value suggests one is needed."},
  {"q":"Why are there three copies, and who keeps which?","a":"The original goes to the consignee, who signs the acknowledgement and keeps it. The duplicate stays with the transporter and is what an inspecting officer asks for. The triplicate comes back to the consignor as proof of dispatch and of receipt. Each page here is marked in the corner and in the footer so they cannot be confused after printing."},
  {"q":"What should the declared value be for job work?","a":"The value of the goods themselves — what they would cost to replace — not a sale price, because no sale is happening. The document prints that declaration in as many words, which is what stops the figure being read as consideration for a supply."}
]
};
})();
