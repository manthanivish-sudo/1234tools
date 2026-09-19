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

/* ---------- Indian money ---------- */

/** 1234567.5 -> "12,34,567.50": lakh and crore grouping, two decimals. */
function inr(n) {
  const neg = n < 0;
  const s = Math.abs(Number(n) || 0).toFixed(2);
  const i = s.slice(0, -3), d = s.slice(-2);
  const head = i.length > 3 ? i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + i.slice(-3) : i;
  return (neg ? '-' : '') + head + '.' + d;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (x) => x < 20 ? ONES[x] : TENS[Math.floor(x / 10)] + (x % 10 ? '-' + ONES[x % 10] : '');
/** Whole number -> words in the Indian system: thousand, lakh, crore, with the customary "and" before the last tens. */
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

/** 47700.5 -> "Rupees Forty-Seven Thousand Seven Hundred and Fifty Paise Only". */
function rupeesInWords(amount) {
  const neg = amount < 0;
  const paise = Math.round(Math.abs(amount) * 100);
  const r = Math.floor(paise / 100), p = paise % 100;
  let s = 'Rupees ' + indianWords(r);
  if (p) s += ' and ' + indianWords(p) + ' Paise';
  return (neg ? 'Minus ' : '') + s + ' Only';
}

/* ---------- parsing the item lists ---------- */

/** "Basic 30000" / "HRA, 12,000.00" / "PF: Rs 3600" -> { label, amount }. */
function parseItems(text) {
  const rows = [], bad = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(.*?)[\s,;:=\t]+(?:rs\.?|inr)?\s*(-?[\d,]*\d(?:\.\d+)?)\s*$/i.exec(line);
    if (!m || !m[1].trim()) { bad.push(line); continue; }
    const amount = Number(m[2].replace(/,/g, ''));
    if (!isFinite(amount)) { bad.push(line); continue; }
    rows.push({ label: m[1].trim().replace(/[,;:=\s]+$/, ''), amount });
  }
  return { rows, bad };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "2026-08-31" -> "31 August 2026". Anything else is shown as typed. */
function fmtDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return String(s || '');
  return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
}
function lastMonth() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

/** Text or ink on an accent fill: dark on a light colour, white on a dark one. */
function onAccent(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  const [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16) / 255);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.55 ? '#1a1400' : '#ffffff';
}


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["payslip-pdf"] = {
"title": "Payslip Generator (PDF)",
"kind": "create",
"multiple": false,
"description": "Create a clean, print-ready payslip PDF: company and employee details, attendance, earnings and deductions, and the net pay in figures and words.",
"keywords": ["payslip generator","salary slip pdf","salary slip format","payslip maker india","free payslip template","create payslip online"],
"glyph": "i-payslip",
"glyphSvg": "<symbol id=\"i-payslip\" viewBox=\"0 0 24 24\">\n  <path d=\"M5.5 2.8h13v18.4l-2.2-1.6-2.1 1.6-2.2-1.6-2.1 1.6-2.2-1.6-2.2 1.6z\"/>\n  <path d=\"M8.5 7.4h7M8.5 10.4h7M8.5 13.4h4\" class=\"thin\"/>\n  <path d=\"M13.2 16.2h2.3\" class=\"thin\"/>\n</symbol>",
"controls": [
  {"key":"company","label":"Company (name, address)","type":"textarea","default":"Acme Software Pvt Ltd\n12 MG Road, Bengaluru 560001\nKarnataka, India"},
  {"key":"companyIds","label":"CIN / GSTIN (optional)","type":"text","default":"","hint":"e.g. CIN U72200KA2015PTC080123"},
  {"key":"period","label":"Pay period","type":"text","default":lastMonth(),"hint":"e.g. August 2026"},
  {"key":"payDate","label":"Payment date","type":"date","default":"TODAY"},
  {"key":"empName","label":"Employee name","type":"text","default":"Priya Sharma"},
  {"key":"empId","label":"Employee ID","type":"text","default":"EMP-0042"},
  {"key":"designation","label":"Designation","type":"text","default":"Senior Developer"},
  {"key":"department","label":"Department","type":"text","default":"Engineering"},
  {"key":"doj","label":"Date of joining","type":"date","default":"2022-04-01"},
  {"key":"pan","label":"PAN","type":"text","default":"ABCPS1234K"},
  {"key":"uan","label":"UAN (PF)","type":"text","default":"100123456789"},
  {"key":"bank","label":"Bank account (last 4) or UPI","type":"text","default":"XXXX XXXX 4321","hint":"Print only the last four digits"},
  {"key":"daysInMonth","label":"Days in month","type":"number","default":31,"min":28,"max":31,"step":1},
  {"key":"paidDays","label":"Paid days","type":"number","default":31,"min":0,"max":31,"step":0.5},
  {"key":"lop","label":"Loss of pay (days)","type":"number","default":0,"min":0,"max":31,"step":0.5},
  {"key":"earnings","label":"Earnings — one per line: label, then amount","type":"textarea","default":"Basic 40000\nHouse rent allowance 16000\nConveyance allowance 1600\nSpecial allowance 12400"},
  {"key":"deductions","label":"Deductions — one per line: label, then amount","type":"textarea","default":"Provident fund (employee) 4800\nProfessional tax 200\nIncome tax (TDS) 3500"},
  {"key":"notes","label":"Notes","type":"textarea","default":"This is a computer-generated payslip and does not need a signature.\nQueries about this payslip: payroll@example.com"},
  {"key":"accent","label":"Accent colour","type":"color","default":"#1f3a5f"}
],
"run": async ({ opts, core }) => {
      const earn = parseItems(opts.earnings);
      const ded = parseItems(opts.deductions);
      const bad = earn.bad.concat(ded.bad);
      if (bad.length) return { error: `Could not read "${bad[0].slice(0, 40)}". Each line is a label, then the amount: "Basic 30000".` };
      if (!earn.rows.length) return { error: 'Add at least one earnings line.' };
      if (earn.rows.length > 22 || ded.rows.length > 22) return { error: 'Up to 22 lines of earnings and 22 of deductions fit on one A4 page. Combine some items.' };
      if (!String(opts.empName || '').trim()) return { error: 'Enter the employee’s name.' };

      const gross = earn.rows.reduce((s, r) => s + r.amount, 0);
      const totalDed = ded.rows.reduce((s, r) => s + r.amount, 0);
      const net = gross - totalDed;
      const words = rupeesInWords(net);
      const accent = /^#[0-9a-f]{6}$/i.test(opts.accent || '') ? opts.accent : '#1f3a5f';
      const ink = onAccent(accent);
      const GREY = '#666666', LIGHT = '#f3f4f6', RULE = '#e2e4e8';

      const [W, H] = core.PAGE_SIZES.a4;
      const m = 46;
      const ops = [];
      const fit = (text, font, size, maxW) => {
        let t = String(text);
        if (core.textWidth(t, font, size) <= maxW) return t;
        while (t.length > 1 && core.textWidth(t + '…', font, size) > maxW) t = t.slice(0, -1);
        return t + '…';
      };

      /* header: accent bar, company on the left, the word PAYSLIP and the period on the right */
      ops.push({ rect: [0, H - 6, W, 6], fill: accent });
      const company = String(opts.company || '').split('\n').map(s => s.trim()).filter(Boolean);
      let y = H - 58;
      ops.push({ text: fit(company[0] || 'Company', 'Helvetica-Bold', 15, W / 2), x: m, y, size: 15, font: 'Helvetica-Bold' });
      let yl = y - 16;
      for (const ln of company.slice(1)) { ops.push({ text: fit(ln, 'Helvetica', 9, W / 2), x: m, y: yl, size: 9, colour: GREY }); yl -= 12; }
      if (String(opts.companyIds || '').trim()) { ops.push({ text: fit(opts.companyIds.trim(), 'Helvetica', 9, W / 2), x: m, y: yl, size: 9, colour: GREY }); yl -= 12; }

      ops.push({ text: 'PAYSLIP', x: W - m, y, size: 22, font: 'Helvetica-Bold', align: 'right', colour: accent });
      ops.push({ text: 'Pay period: ' + (String(opts.period || '').trim() || '—'), x: W - m, y: y - 18, size: 10, align: 'right' });
      let yr = y - 32;
      if (opts.payDate) { ops.push({ text: 'Paid on ' + fmtDate(opts.payDate), x: W - m, y: yr, size: 9, align: 'right', colour: GREY }); yr -= 12; }
      y = Math.min(yl, yr) - 8;
      ops.push({ line: [m, y, W - m, y], stroke: accent, lineWidth: 1.2 });
      y -= 18;

      /* employee block: a shaded panel, three columns of label-over-value */
      const items = [
        ['EMPLOYEE NAME', opts.empName], ['EMPLOYEE ID', opts.empId], ['DESIGNATION', opts.designation],
        ['DEPARTMENT', opts.department], ['DATE OF JOINING', fmtDate(opts.doj)], ['PAN', opts.pan],
        ['UAN', opts.uan], ['BANK ACCOUNT / UPI', opts.bank]
      ].map(([k, v]) => [k, String(v == null ? '' : v).trim() || '—']);
      const cols = 3, colW = (W - m * 2 - 24) / cols, rowH = 30;
      const rowsN = Math.ceil(items.length / cols);
      const boxH = rowsN * rowH + 14;
      ops.push({ rect: [m, y - boxH, W - m * 2, boxH], fill: LIGHT });
      items.forEach(([k, v], i) => {
        const cx = m + 12 + (i % cols) * colW, cy = y - 20 - Math.floor(i / cols) * rowH;
        ops.push({ text: k, x: cx, y: cy, size: 7, font: 'Helvetica-Bold', colour: GREY });
        ops.push({ text: fit(v, 'Helvetica', 10, colW - 14), x: cx, y: cy - 12, size: 10 });
      });
      y -= boxH + 14;

      /* attendance strip */
      const att = [['DAYS IN MONTH', opts.daysInMonth], ['PAID DAYS', opts.paidDays], ['LOSS OF PAY', opts.lop]]
        .map(([k, v]) => [k, String(v === '' || v == null ? '—' : v)]);
      const aw = (W - m * 2) / att.length;
      att.forEach(([k, v], i) => {
        const x0 = m + i * aw;
        ops.push({ rect: [x0, y - 34, aw, 34], stroke: RULE, lineWidth: 0.6 });
        ops.push({ text: k, x: x0 + 10, y: y - 13, size: 7, font: 'Helvetica-Bold', colour: GREY });
        ops.push({ text: v, x: x0 + aw - 10, y: y - 25, size: 12, font: 'Helvetica-Bold', align: 'right' });
      });
      y -= 34 + 18;

      /* earnings and deductions, side by side, totals on the same line */
      const gap = 16, tw = (W - m * 2 - gap) / 2, lineH = 15;
      const table = (x0, title, rows) => {
        ops.push({ rect: [x0, y - 20, tw, 20], fill: accent });
        ops.push({ text: title, x: x0 + 8, y: y - 14, size: 8, font: 'Helvetica-Bold', colour: ink });
        ops.push({ text: 'AMOUNT (Rs)', x: x0 + tw - 8, y: y - 14, size: 8, font: 'Helvetica-Bold', align: 'right', colour: ink });
        let yy = y - 20 - 14;
        for (const r of rows) {
          ops.push({ text: fit(r.label, 'Helvetica', 10, tw - 100), x: x0 + 8, y: yy, size: 10 });
          ops.push({ text: inr(r.amount), x: x0 + tw - 8, y: yy, size: 10, align: 'right' });
          ops.push({ line: [x0, yy - 5, x0 + tw, yy - 5], stroke: RULE, lineWidth: 0.5 });
          yy -= lineH;
        }
      };
      table(m, 'EARNINGS', earn.rows);
      table(m + tw + gap, 'DEDUCTIONS', ded.rows);
      const nRows = Math.max(earn.rows.length, ded.rows.length, 1);
      const yt = y - 20 - 14 - nRows * lineH - 4;
      const totalRow = (x0, label, val) => {
        ops.push({ line: [x0, yt + 12, x0 + tw, yt + 12], stroke: '#333333', lineWidth: 0.8 });
        ops.push({ text: label, x: x0 + 8, y: yt, size: 10, font: 'Helvetica-Bold' });
        ops.push({ text: inr(val), x: x0 + tw - 8, y: yt, size: 10, font: 'Helvetica-Bold', align: 'right' });
      };
      totalRow(m, 'Gross earnings', gross);
      totalRow(m + tw + gap, 'Total deductions', totalDed);
      y = yt - 22;

      /* net pay band, then the amount in words */
      ops.push({ rect: [m, y - 34, W - m * 2, 34], fill: accent });
      ops.push({ text: 'NET PAY', x: m + 12, y: y - 21, size: 11, font: 'Helvetica-Bold', colour: ink });
      ops.push({ text: 'Rs ' + inr(net), x: W - m - 12, y: y - 22, size: 14, font: 'Helvetica-Bold', align: 'right', colour: ink });
      y -= 34 + 16;
      const wl = core.wrapText('In words: ' + words, 'Helvetica', 9, W - m * 2);
      wl.forEach((ln, k) => ops.push({ text: ln, x: m, y: y - k * 12, size: 9, colour: '#333333' }));
      y -= wl.length * 12 + 10;

      /* notes */
      const notes = String(opts.notes || '').trim();
      if (notes) {
        ops.push({ text: 'NOTES', x: m, y, size: 7, font: 'Helvetica-Bold', colour: GREY });
        y -= 12;
        const nl = core.wrapText(notes, 'Helvetica', 9, W - m * 2);
        nl.forEach((ln, k) => ops.push({ text: ln, x: m, y: y - k * 12, size: 9, colour: '#555555' }));
        y -= nl.length * 12;
      }
      if (y < 58) return { error: 'This payslip does not fit on one A4 page. Shorten the notes or combine some items.' };

      /* footer */
      ops.push({ line: [m, 44, W - m, 44], stroke: RULE, lineWidth: 0.5 });
      ops.push({ text: fit((company[0] || '') + ' · Payslip for ' + String(opts.period || '').trim(), 'Helvetica', 7.5, W - m * 2 - 120), x: m, y: 32, size: 7.5, colour: GREY });
      ops.push({ text: 'Confidential', x: W - m, y: 32, size: 7.5, align: 'right', colour: GREY });

      const bytes = core.createPDF([{ size: [W, H], ops }], {
        /* Info strings are written as raw bytes, so keep them to Latin-1: a hyphen, not a dash */
        info: { Title: 'Payslip ' + String(opts.period || '').trim() + ' - ' + opts.empName.trim(), Author: company[0] || '', Subject: 'Payslip' }
      });

      let warn = '';
      const dim = Number(opts.daysInMonth), paid = Number(opts.paidDays), lop = Number(opts.lop);
      if ([dim, paid, lop].every(isFinite) && Math.abs(paid + lop - dim) > 0.001) {
        warn = `Paid days (${paid}) plus loss of pay (${lop}) is not the days in the month (${dim}). The payslip prints what you typed.`;
      }
      if (net < 0 && !warn) warn = 'Deductions exceed earnings, so the net pay is negative.';

      return {
        files: [{ name: `payslip-${slug(opts.empName)}-${slug(opts.period || 'period')}.pdf`, bytes }],
        warn: warn || undefined,
        stats: [
          ['Employee', opts.empName.trim()],
          ['Pay period', String(opts.period || '').trim()],
          ['Gross earnings', 'Rs ' + inr(gross)],
          ['Total deductions', 'Rs ' + inr(totalDed)],
          ['Net pay', 'Rs ' + inr(net)],
          ['In words', words],
          ['Output size', fmtBytes(bytes.length)]
        ]
      };
    },
"tips": ["Earnings and deductions take one item per line: a label, then the amount — \"Basic 30000\" or \"HRA, 12,000.00\". Only the last number on the line is read as the amount, so a label may contain digits.","Nothing statutory is calculated. PF, ESI, professional tax and TDS depend on the state, the salary band and what the employee has opted into. Type the figures your payroll arrived at; this lays them out.","Paid days plus loss-of-pay days would normally add up to the days in the month. The tool warns if they do not, but prints what you typed.","The net pay in words uses the Indian system — lakh and crore — which is what a bank or an auditor expects to read on a payslip.","Print only the last four digits of the bank account. A payslip travels further than you think: landlords, lenders and visa officers all ask for them.","Everything is drawn on your device, so salaries, PAN and bank details never leave it."],
"faq": [{"q":"Is this a valid payslip under Indian law?","a":"It produces a clear, complete layout. Whether an employer must issue payslips, and what they must show, depends on the state's Shops and Establishments Act, the Payment of Wages Act and the Code on Wages rules as adopted there. Most expect the employer's name, the period, days worked, each earning and deduction, and the net paid — all of which this includes — but check your state's rules or ask your accountant."},{"q":"Why does the rupee symbol not appear?","a":"The standard PDF fonts cover Western European characters only, so the ₹ sign cannot be drawn without embedding a font. Amounts are marked Rs instead, which every bank and auditor reads the same way."},{"q":"Can it make payslips for a whole team at once?","a":"Not in this version — it creates one payslip per run. Keep the figures in a spreadsheet and paste each row in; the fields keep their values between runs, so a batch of similar slips is quick."}]
};
})();
