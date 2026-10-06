(function(){
/* ---------- shared helpers ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}

/* ---------- what the invoice borrows from the quotation ----------
   The line reader (thousands separators, ambiguity reported rather than
   guessed), the money formats and the amount in words are the Quotation
   tool's own functions, not copies: pdf-quotation-pdf.js is loaded first,
   on the page and in the worker (workerScripts below), and puts them on its
   spec as `lib`. They are looked up when an invoice is made, never when
   this file loads, so it still loads on its own. */
function lib() {
  const q = (window.PDF_TOOLS || {})['quotation-pdf'];
  if (!q || !q.lib) throw new Error('The quotation engine, which reads the line items, did not load. Reload the page and try again.');
  return q.lib;
}
function ownControl(key) {
  const s = (window.PDF_TOOLS || {})['invoice-pdf'];
  return ((s && s.controls) || []).find((c) => c.key === key) || null;
}

/* Every currency the site's preferences offer. The sign is what WinAnsi can
   print: no rupee or dirham sign in the standard fonts, so Rs and AED. */
const CURRENCY = {
  GBP: { sym: '£', major: 'Pounds', minor: 'Pence', group: 'west' },
  USD: { sym: '$', major: 'Dollars', minor: 'Cents', group: 'west' },
  EUR: { sym: '€', major: 'Euros', minor: 'Cents', group: 'west' },
  INR: { sym: 'Rs ', major: 'Rupees', minor: 'Paise', group: 'indian' },
  AED: { sym: 'AED ', major: 'Dirhams', minor: 'Fils', group: 'west' },
  SGD: { sym: 'S$', major: 'Dollars', minor: 'Cents', group: 'west' },
  AUD: { sym: 'A$', major: 'Dollars', minor: 'Cents', group: 'west' },
  CAD: { sym: 'C$', major: 'Dollars', minor: 'Cents', group: 'west' },
  ZAR: { sym: 'R ', major: 'Rand', minor: 'Cents', group: 'west' }
};

/* A line may end with its own tax rate: ", GST 18%", ", VAT 5%",
   ", tax 12%" or ", @28%". It is taken off before the quotation's reader
   sees the rest, which it reads exactly as it reads a quotation line. */
const TAX_AT_END = /,\s*(?:(?:gst|igst|vat|tax)\s*@?\s*(\d+(?:\.\d+)?)\s*%?|@\s*(\d+(?:\.\d+)?)\s*%)\s*$/i;

/** To the penny or the paisa, half away from zero. */
const r2 = (v) => Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-7) / 100;

/** "2026-10-05" plus n days, as an ISO date; '' if the date is unreadable. */
function addDays(iso, n) {
  const t = Date.parse(String(iso || '') + 'T00:00:00Z');
  if (!isFinite(t)) return '';
  return new Date(t + n * 86400000).toISOString().slice(0, 10);
}

/** The state code a GSTIN starts with, or null. */
const gstinState = (s) => { const m = /^\s*(\d{2})[A-Z0-9]{3}/i.exec(String(s || '')); return m ? m[1] : null; };

function luminance(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!m) return 0;
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** An accent darkened towards black by f (0..1), for text on white. */
function shade(hex, f) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!m) return '#333333';
  return '#' + [1, 2, 3].map((i) => Math.round(parseInt(m[i], 16) * (1 - f)).toString(16).padStart(2, '0')).join('');
}

/** The file name an invoice number gives: INV-2026-0042 -> INV-2026-0042.pdf. */
function fileStem(number) {
  const s = String(number || '').trim()
    .replace(/[\\/:*?"<>|\s]+/g, '-').replace(/[^\x20-\x7e]/g, '')
    .replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return s || 'invoice';
}

/** The next invoice number: the last run of digits goes up by one and keeps its width. */
function nextNumber(n) {
  const s = String(n || '').trim();
  const m = /(\d+)(?!.*\d)/.exec(s);
  if (!m) return s ? s + '-2' : 'INV-0001';
  const d = m[1].split('');
  let i = d.length - 1;
  while (i >= 0 && d[i] === '9') { d[i] = '0'; i--; }
  if (i < 0) d.unshift('1'); else d[i] = String(Number(d[i]) + 1);
  return s.slice(0, m.index) + d.join('') + s.slice(m.index + m[1].length);
}

/* ---------- the saved form: what may come back from storage or a file ---------- */

const FORMAT = '1234tools-invoice';

/** Check a saved or imported set of fields against the controls; never trust either. */
function cleanFields(fields, controls) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return { error: 'it has no "fields" object' };
  const byKey = {};
  controls.forEach((c) => { byKey[c.key] = c; });
  const values = {};
  for (const k of Object.keys(fields)) {
    const c = byKey[k], v = fields[k];
    if (!c) return { error: 'it has a field this tool does not know, “' + k + '”' };
    if (c.type === 'image') continue;
    if (c.type === 'checkbox') {
      if (typeof v !== 'boolean') return { error: '“' + k + '” should be true or false' };
      values[k] = v; continue;
    }
    if (typeof v !== 'string' && typeof v !== 'number') return { error: '“' + k + '” should be text' };
    const s = String(v);
    if (s.length > 20000) return { error: '“' + k + '” is longer than any invoice needs' };
    if (c.type === 'select' && !(c.options || []).some((o) => String(o.value) === s)) {
      return { error: '“' + k + '” holds “' + s.slice(0, 40) + '”, which is not one of its choices' };
    }
    if (c.type === 'number' && s.trim() && !isFinite(Number(s))) return { error: '“' + k + '” should be a number' };
    if (c.type === 'date' && s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return { error: '“' + k + '” should be a date written 2026-10-05' };
    if (c.type === 'color' && !/^#[0-9a-f]{6}$/i.test(s)) return { error: '“' + k + '” should be a colour written #1f3a5f' };
    values[k] = s;
  }
  return { values };
}

/* the logo, as text that survives JSON and localStorage */
function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s) {
  const b = atob(String(s));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}
function packLogo(v) {
  if (!v) return null;
  const base = { kind: v.kind, name: String(v.name || 'logo'), width: v.width, height: v.height, preview: String(v.preview || '') };
  if (v.kind === 'jpeg') return Object.assign(base, { components: v.components, bytes: b64(v.bytes) });
  return Object.assign(base, { rgb: b64(v.rgb), alpha: v.alpha ? b64(v.alpha) : null });
}
/** A packed logo back to what the image control holds; null and a reason if it is not one. */
function unpackLogo(p) {
  if (p === null || p === undefined) return { value: null };
  const bad = (why) => ({ error: 'its logo ' + why });
  if (typeof p !== 'object') return bad('is not a picture');
  const w = Number(p.width), h = Number(p.height);
  if (!(w > 0 && h > 0 && w <= 6000 && h <= 6000 && Number.isInteger(w) && Number.isInteger(h))) return bad('has no usable size');
  if (typeof p.preview !== 'string' || (p.preview && !/^data:image\/(png|jpeg|webp|gif);base64,/.test(p.preview))) return bad('has a preview that is not a picture');
  try {
    if (p.kind === 'jpeg') {
      const bytes = unb64(p.bytes);
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bad('is not a JPEG');
      if ([1, 3].indexOf(Number(p.components)) < 0) return bad('has an unusual colour layout');
      return { value: { kind: 'jpeg', name: String(p.name || 'logo.jpg'), bytes, width: w, height: h, components: Number(p.components), preview: p.preview } };
    }
    if (p.kind === 'raw') {
      const rgb = unb64(p.rgb);
      if (rgb.length !== w * h * 3) return bad('has the wrong number of pixels');
      const alpha = p.alpha ? unb64(p.alpha) : null;
      if (alpha && alpha.length !== w * h) return bad('has the wrong number of transparency values');
      return { value: { kind: 'raw', name: String(p.name || 'logo.png'), width: w, height: h, rgb, alpha, preview: p.preview } };
    }
  } catch (e) { return bad('could not be decoded'); }
  return bad('is in a format this tool does not know');
}


window.PDF_TOOLS = window.PDF_TOOLS || {};
window.PDF_TOOLS["invoice-pdf"] = {
"title": "Invoice Generator (PDF)",
"kind": "create",
"multiple": false,
"description": "Make an invoice PDF in three layouts, with your logo, GST (CGST and SGST, or IGST) or VAT at each line’s rate, a discount, shipping and a PAID stamp. Nothing you add is uploaded.",
"keywords": ["invoice generator","create invoice pdf","free invoice template","make an invoice","invoice maker","gst invoice format","vat invoice template","tax invoice generator"],
"action": "Create invoice",
"workerScripts": ["pdf-quotation-pdf.js", "pdf-invoice-pdf.js"],
"controls": [
  {"key":"fromName","label":"Your business — name","type":"text","default":"MVR IT Services LTD"},
  {"key":"fromAddress","label":"Your business — address","type":"textarea","rows":3,"default":"Reading, United Kingdom\nCompany No. 10251131"},
  {"key":"fromTax","label":"Your VAT number or GSTIN","type":"text","default":""},
  {"key":"fromContact","label":"Your phone or email","type":"text","default":""},
  {"key":"logo","label":"Your logo (optional)","type":"image","maxSide":480,"button":"Choose a logo","hint":"PNG, JPEG, WebP or GIF; nothing is uploaded"},

  {"key":"toName","label":"Bill to — name","type":"text","default":"Client Name Ltd"},
  {"key":"toAddress","label":"Bill to — address","type":"textarea","rows":3,"default":"1 Example Street\nLondon, EC1A 1AA"},
  {"key":"toTax","label":"Client VAT number or GSTIN","type":"text","default":""},

  {"key":"number","label":"Invoice number","type":"text","default":"INV-0001","hint":"Goes up by one after each download"},
  {"key":"date","label":"Invoice date","type":"date","default":"TODAY"},
  {"key":"due","label":"Payment terms","type":"select","default":"30","options":[
    {"value":"0","label":"Due on receipt"},{"value":"7","label":"Net 7"},{"value":"14","label":"Net 14"},{"value":"15","label":"Net 15"},
    {"value":"30","label":"Net 30"},{"value":"45","label":"Net 45"},{"value":"60","label":"Net 60"},{"value":"90","label":"Net 90"}]},

  {"key":"items","label":"Line items — description, quantity, unit price (one per line)","type":"textarea","rows":6,"wide":true,
   "hint":"Or: description, HSN/SAC, quantity, unit, rate, discount%, GST 18%","default":"Website design and build, 1, 4500\nHosting and support (12 months), 12, 45\nDomain registration, 1, 15"},

  {"key":"currency","label":"Currency","type":"select","default":"GBP","options":[
    {"value":"GBP","label":"Pound sterling (£)"},{"value":"USD","label":"US dollar ($)"},{"value":"EUR","label":"Euro (€)"},
    {"value":"INR","label":"Indian rupee (Rs)"},{"value":"AED","label":"UAE dirham (AED)"},{"value":"SGD","label":"Singapore dollar (S$)"},
    {"value":"AUD","label":"Australian dollar (A$)"},{"value":"CAD","label":"Canadian dollar (C$)"},{"value":"ZAR","label":"South African rand (R)"}]},
  {"key":"taxMode","label":"Tax","type":"select","default":"vat","options":[
    {"value":"vat","label":"VAT or sales tax — one rate, or each line’s own"},
    {"value":"gst","label":"GST — CGST + SGST or IGST, by place of supply"},
    {"value":"none","label":"No tax"}]},
  {"key":"tax","label":"Tax rate % (lines without their own)","type":"number","default":20,"min":0,"max":100,"step":0.25,"hint":"GST: 0, 5, 12, 18 or 28. UK VAT: 20, 5 or 0"},
  {"key":"taxLabel","label":"Tax name","type":"text","default":"VAT","remember":true},
  {"key":"sellerState","label":"Your state (GST)","type":"select","default":"auto","options":[
    {"value":"auto","label":"From your GSTIN"},
    {"value":"01","label":"01 — Jammu and Kashmir"},{"value":"02","label":"02 — Himachal Pradesh"},{"value":"03","label":"03 — Punjab"},
    {"value":"04","label":"04 — Chandigarh"},{"value":"05","label":"05 — Uttarakhand"},{"value":"06","label":"06 — Haryana"},
    {"value":"07","label":"07 — Delhi"},{"value":"08","label":"08 — Rajasthan"},{"value":"09","label":"09 — Uttar Pradesh"},
    {"value":"10","label":"10 — Bihar"},{"value":"11","label":"11 — Sikkim"},{"value":"12","label":"12 — Arunachal Pradesh"},
    {"value":"13","label":"13 — Nagaland"},{"value":"14","label":"14 — Manipur"},{"value":"15","label":"15 — Mizoram"},
    {"value":"16","label":"16 — Tripura"},{"value":"17","label":"17 — Meghalaya"},{"value":"18","label":"18 — Assam"},
    {"value":"19","label":"19 — West Bengal"},{"value":"20","label":"20 — Jharkhand"},{"value":"21","label":"21 — Odisha"},
    {"value":"22","label":"22 — Chhattisgarh"},{"value":"23","label":"23 — Madhya Pradesh"},{"value":"24","label":"24 — Gujarat"},
    {"value":"26","label":"26 — Dadra and Nagar Haveli and Daman and Diu"},{"value":"27","label":"27 — Maharashtra"},
    {"value":"29","label":"29 — Karnataka"},{"value":"30","label":"30 — Goa"},{"value":"31","label":"31 — Lakshadweep"},
    {"value":"32","label":"32 — Kerala"},{"value":"33","label":"33 — Tamil Nadu"},{"value":"34","label":"34 — Puducherry"},
    {"value":"35","label":"35 — Andaman and Nicobar Islands"},{"value":"36","label":"36 — Telangana"},{"value":"37","label":"37 — Andhra Pradesh"},
    {"value":"38","label":"38 — Ladakh"},{"value":"97","label":"97 — Other Territory"}]},
  {"key":"placeOfSupply","label":"Place of supply (GST)","type":"select","default":"auto","options":[
    {"value":"auto","label":"From the client’s GSTIN"},
    {"value":"01","label":"01 — Jammu and Kashmir"},{"value":"02","label":"02 — Himachal Pradesh"},{"value":"03","label":"03 — Punjab"},
    {"value":"04","label":"04 — Chandigarh"},{"value":"05","label":"05 — Uttarakhand"},{"value":"06","label":"06 — Haryana"},
    {"value":"07","label":"07 — Delhi"},{"value":"08","label":"08 — Rajasthan"},{"value":"09","label":"09 — Uttar Pradesh"},
    {"value":"10","label":"10 — Bihar"},{"value":"11","label":"11 — Sikkim"},{"value":"12","label":"12 — Arunachal Pradesh"},
    {"value":"13","label":"13 — Nagaland"},{"value":"14","label":"14 — Manipur"},{"value":"15","label":"15 — Mizoram"},
    {"value":"16","label":"16 — Tripura"},{"value":"17","label":"17 — Meghalaya"},{"value":"18","label":"18 — Assam"},
    {"value":"19","label":"19 — West Bengal"},{"value":"20","label":"20 — Jharkhand"},{"value":"21","label":"21 — Odisha"},
    {"value":"22","label":"22 — Chhattisgarh"},{"value":"23","label":"23 — Madhya Pradesh"},{"value":"24","label":"24 — Gujarat"},
    {"value":"26","label":"26 — Dadra and Nagar Haveli and Daman and Diu"},{"value":"27","label":"27 — Maharashtra"},
    {"value":"29","label":"29 — Karnataka"},{"value":"30","label":"30 — Goa"},{"value":"31","label":"31 — Lakshadweep"},
    {"value":"32","label":"32 — Kerala"},{"value":"33","label":"33 — Tamil Nadu"},{"value":"34","label":"34 — Puducherry"},
    {"value":"35","label":"35 — Andaman and Nicobar Islands"},{"value":"36","label":"36 — Telangana"},{"value":"37","label":"37 — Andhra Pradesh"},
    {"value":"38","label":"38 — Ladakh"},{"value":"97","label":"97 — Other Territory"},{"value":"96","label":"96 — Outside India (export)"}]},

  {"key":"discount","label":"Discount — a percentage or an amount","type":"text","default":""},
  {"key":"discountType","label":"The discount is","type":"select","default":"percent","options":[
    {"value":"percent","label":"A percentage of the items"},{"value":"amount","label":"An amount off the items"}]},
  {"key":"shipping","label":"Shipping or delivery charge","type":"text","default":""},
  {"key":"shippingTax","label":"Shipping is","type":"select","default":"taxable","options":[
    {"value":"taxable","label":"Taxed at the default rate"},{"value":"exempt","label":"Not taxed"}]},
  {"key":"rounding","label":"Round the total","type":"select","default":"none","options":[
    {"value":"none","label":"Do not round"},{"value":"near","label":"To the nearest whole unit"},
    {"value":"up","label":"Up to the whole unit"},{"value":"down","label":"Down to the whole unit"}]},
  {"key":"words","label":"Total in words","type":"select","default":"auto","options":[
    {"value":"auto","label":"For rupees only"},{"value":"yes","label":"Always"},{"value":"no","label":"Never"}]},

  {"key":"bank","label":"Payment details (bank, UPI, sort code)","type":"textarea","rows":3,"default":""},
  {"key":"notes","label":"Notes","type":"textarea","rows":3,"default":"Payment by bank transfer.\nThank you for your business."},

  {"key":"paid","label":"Mark as paid (adds a PAID stamp)","type":"checkbox","default":false},
  {"key":"paidDate","label":"Paid on","type":"date","default":"TODAY"},
  {"key":"paidMethod","label":"Paid by","type":"text","default":"Bank transfer"},

  {"key":"template","label":"Layout","type":"select","default":"modern","options":[
    {"value":"modern","label":"Modern — a colour band across the top"},
    {"value":"classic","label":"Classic — a ruled table, serif type"},
    {"value":"compact","label":"Compact — small type for long invoices"}]},
  {"key":"accent","label":"Accent colour","type":"color","default":"#1f3a5f"},
  {"key":"pageSize","label":"Page size","type":"select","default":"a4","options":[
    {"value":"a4","label":"A4"},{"value":"letter","label":"US Letter"},{"value":"legal","label":"US Legal"}]}
],
"run": async ({ opts, core }) => {
      const L = lib();
      const o = opts || {};
      const curCode = CURRENCY[o.currency] ? o.currency : 'GBP';
      const CUR = CURRENCY[curCode];
      const amt = (v) => L.amt(v, CUR);
      const money = (v) => L.money(v, CUR);
      const q = (v) => L.qtyText(v);
      const toNum = (s) => Number(String(s).trim().replace(/,/g, ''));
      const short = (s) => { const t = String(s); return t.length > 60 ? t.slice(0, 57) + '…' : t; };

      /* ---------- tax mode and the default rate ---------- */
      const mode = ['vat', 'gst', 'none'].indexOf(o.taxMode) >= 0 ? o.taxMode : 'vat';
      const defRate = Number(o.tax);
      if (mode !== 'none' && !(isFinite(defRate) && defRate >= 0 && defRate <= 100)) {
        return { error: 'The tax rate must be a number from 0 to 100.' };
      }
      const label = mode === 'gst' ? 'GST' : (String(o.taxLabel || '').trim() || 'VAT');

      /* ---------- the lines, read by the quotation's reader ---------- */
      const rows = [], ignoredTax = [];
      const lines = String(o.items || '').split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const n = i + 1;
        let rate = null, body = line;
        const t = TAX_AT_END.exec(line);
        if (t) { rate = Number(t[1] || t[2]); body = line.slice(0, t.index); }
        const p = L.parseLineItems(body, '');
        /* a line that could mean two prices is shown, not guessed at */
        if (p.ambiguous.length) return { error: 'Line ' + n + ': ' + p.ambiguous[0].message };
        if (!p.rows.length) {
          return { error: 'Line ' + n + ', “' + short(line) + '”, could not be read. Write each item as description, quantity, unit price — or description, HSN/SAC, quantity, unit, rate, discount%, GST 18% — where only the quantity and the price are required.' };
        }
        const r = p.rows[0];
        if (!(r.qty > 0)) return { error: 'Line ' + n + ', “' + short(line) + '”: the quantity must be more than 0.' };
        if (r.rate < 0) return { error: 'Line ' + n + ', “' + short(line) + '”: the price is negative. Put a reduction in the Discount box; money owed back belongs on a credit note.' };
        if (r.disc < 0 || r.disc > 100) return { error: 'Line ' + n + ', “' + short(line) + '”: a line discount runs from 0% to 100%.' };
        if (rate !== null && rate > 100) return { error: 'Line ' + n + ', “' + short(line) + '”: a tax rate of ' + q(rate) + '% is more than 100%.' };
        if (mode === 'none' && rate !== null) ignoredTax.push(n);
        r.taxRate = mode === 'none' ? 0 : (rate === null ? defRate : rate);
        r.n = n;
        rows.push(r);
      }
      if (!rows.length) return { error: 'Add at least one line item.' };
      if (rows.length > 300) return { error: 'That is more than 300 line items. Split it into two invoices.' };
      const fromName = String(o.fromName || '').trim();
      const toName = String(o.toName || '').trim();
      if (!fromName) return { error: 'Enter your business name.' };
      if (!toName) return { error: 'Enter who the invoice is to, under Bill to.' };

      /* ---------- discount and shipping ---------- */
      const itemsTotal = rows.reduce((s, r) => s + r.amount, 0);
      const moneyField = (v, what) => {
        const s = String(v == null ? '' : v).trim().replace(CUR.sym.trim(), '').replace(/%$/, '').trim();
        if (!s) return { value: 0 };
        if (!L.isNumTok(s)) return { error: 'The ' + what + ', “' + short(v) + '”, is not a number. Write 1250 or 1,250.' };
        const x = toNum(s);
        if (x < 0) return { error: 'The ' + what + ' cannot be negative.' };
        return { value: x };
      };
      const dIn = moneyField(o.discount, 'discount');
      if (dIn.error) return { error: dIn.error };
      let discount = 0, discLabel = 'Discount';
      if (dIn.value) {
        if (o.discountType === 'amount') {
          discount = r2(dIn.value);
          if (discount > r2(itemsTotal)) return { error: 'The discount, ' + money(discount) + ', is more than the items come to (' + money(itemsTotal) + ').' };
        } else {
          if (dIn.value > 100) return { error: 'A percentage discount runs from 0 to 100.' };
          discount = r2(itemsTotal * dIn.value / 100);
          discLabel = 'Discount ' + q(dIn.value) + '%';
        }
      }
      const sIn = moneyField(o.shipping, 'shipping charge');
      if (sIn.error) return { error: sIn.error };
      const shipping = r2(sIn.value);
      const shipTaxed = shipping > 0 && mode !== 'none' && o.shippingTax !== 'exempt';

      /* ---------- GST: which state supplies which ---------- */
      let intra = true, sellerCode = null, posCode = null;
      const stateName = (code) => {
        const c = ownControl('placeOfSupply');
        const hit = c && c.options.find((x) => x.value === code);
        return hit ? hit.label.replace(/^\d+\s*—\s*/, '') : code;
      };
      const known = (code) => { const c = ownControl('placeOfSupply'); return !!(code && c && c.options.some((x) => x.value === code && x.value !== 'auto')); };
      if (mode === 'gst') {
        sellerCode = o.sellerState && o.sellerState !== 'auto' ? o.sellerState : gstinState(o.fromTax);
        posCode = o.placeOfSupply && o.placeOfSupply !== 'auto' ? o.placeOfSupply : gstinState(o.toTax);
        if (!known(sellerCode) || sellerCode === '96') return { error: 'Choose your state under “Your state (GST)”: GST needs it, and ' + (String(o.fromTax || '').trim() ? 'your GSTIN does not start with a state code this tool knows.' : 'there is no GSTIN to read it from.') };
        if (!known(posCode)) return { error: 'Choose the place of supply: ' + (String(o.toTax || '').trim() ? 'the client’s GSTIN does not start with a state code this tool knows' : 'the client has no GSTIN to read it from') + ', and it decides between CGST + SGST and IGST.' };
        intra = sellerCode === posCode;
      }

      /* ---------- the arithmetic ----------
         The invoice discount is shared across the lines in proportion to
         their value, so each rate is charged on its share of the discounted
         total; taxable shipping joins the default rate. Each tax figure is
         rounded to the penny once, on its rate's whole taxable value. */
      const share = itemsTotal > 0 ? discount / itemsTotal : 0;
      const groups = new Map();
      const addTo = (rate, v) => groups.set(rate, (groups.get(rate) || 0) + v);
      rows.forEach((r) => addTo(r.taxRate, r.amount * (1 - share)));
      if (shipTaxed) addTo(defRate, shipping);
      const rates = Array.from(groups.keys()).sort((a, b) => b - a);
      const multi = rates.length > 1;
      const taxLines = [];
      if (mode !== 'none' && !(rates.length === 1 && rates[0] === 0)) {
        for (const rate of rates) {
          const base = groups.get(rate);
          if (mode === 'gst' && intra) {
            const half = r2(base * rate / 200);
            taxLines.push({ name: 'CGST', rate: rate / 2, base, amount: half });
            taxLines.push({ name: 'SGST', rate: rate / 2, base, amount: half });
          } else {
            taxLines.push({ name: mode === 'gst' ? 'IGST' : label, rate, base, amount: r2(base * rate / 100) });
          }
        }
      }
      const taxTotal = r2(taxLines.reduce((s, t) => s + t.amount, 0));
      const taxable = r2(Array.from(groups.values()).reduce((s, v) => s + v, 0));
      const net = r2(itemsTotal) - discount + shipping;
      const raw = r2(net + taxTotal);
      const rounded = o.rounding === 'near' ? Math.round(raw)
        : o.rounding === 'up' ? Math.ceil(raw - 1e-9)
        : o.rounding === 'down' ? Math.floor(raw + 1e-9) : raw;
      const roundOff = r2(rounded - raw);
      const total = rounded;
      const showWords = o.words === 'yes' || (o.words !== 'no' && curCode === 'INR');
      const words = L.amountWords(total, CUR);

      /* ---------- dates ---------- */
      const dueDays = Math.max(0, Number(o.due) || 0);
      const dueIso = addDays(o.date, dueDays);
      const terms = dueDays ? 'Net ' + dueDays : 'Due on receipt';
      const paid = o.paid === true || o.paid === 'true';
      const paidDate = paid ? L.fmtDate(o.paidDate) : '';
      const paidMethod = paid ? String(o.paidMethod || '').trim() : '';

      /* ---------- the page: every word goes through T(), so a font is
         changed in one place (FONT) ---------- */
      const FONT = { r: 'Helvetica', b: 'Helvetica-Bold', serif: 'Times-Roman', mono: 'Courier' };
      const tw = (s, st, size) => core.textWidth(String(s), FONT[st] || FONT.r, size);
      const wrap = (s, st, size, w) => core.wrapText(String(s), FONT[st] || FONT.r, size, w);
      const fit = (s, st, size, w) => {
        let t = String(s == null ? '' : s);
        if (tw(t, st, size) <= w) return t;
        while (t.length > 1 && tw(t + '…', st, size) > w) t = t.slice(0, -1);
        return t + '…';
      };
      /** the size, at most `size`, at which a figure fits: amounts are shrunk, never cut */
      const fitSize = (s, st, size, w) => { let z = size; while (z > 6 && tw(s, st, z) > w) z -= 0.5; return z; };
      const lowerFirst = (s) => /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
      let ops = [];
      const INK ='#111111', GREY = '#5f6670', RULE = '#dfe2e6';
      const T = (text, x, y, size, st, colour, align) => ops.push({ text: String(text), x, y, size, font: FONT[st] || FONT.r, colour: colour || INK, align: align || 'left' });

      const tpl = ['modern', 'classic', 'compact'].indexOf(o.template) >= 0 ? o.template : 'modern';
      const [W, H] = core.PAGE_SIZES[o.pageSize] || core.PAGE_SIZES.a4;
      const accent = /^#[0-9a-f]{6}$/i.test(o.accent || '') ? o.accent : '#1f3a5f';
      const ink = L.onAccent(accent);
      const accentText = luminance(accent) > 0.55 ? shade(accent, 0.55) : accent;
      const S = {
        modern:  { m: 42, body: 'r', num: 'r', size: 9, lead: 11.5, pad: 5, headFill: accent, headInk: ink, zebra: '#f5f6f8', rule: null },
        classic: { m: 50, body: 'serif', num: 'serif', size: 10, lead: 12, pad: 4, headFill: '#ececec', headInk: INK, zebra: null, rule: '#9a9a9a' },
        compact: { m: 34, body: 'r', num: 'mono', size: 8, lead: 9.8, pad: 3, headFill: null, headInk: accentText, zebra: null, rule: '#d9dce0', strip: 5 }
      }[tpl];
      const m = S.m, inner = W - 2 * m, BOTTOM = 62;

      const logo = o.logo ? await core.prepareImage(o.logo) : null;
      const logoFit = (maxW, maxH) => {
        const s = Math.min(maxW / logo.width, maxH / logo.height);
        return [logo.width * s, logo.height * s];
      };
      let logoAt = null;
      const drawLogo = (x, y, w, h) => { ops.push({ image: logo, x, y, w, h }); logoAt = [x, y, w, h]; };

      const textLines = (s) => String(s == null ? '' : s).split('\n').map((x) => x.trim()).filter(Boolean);
      const number = String(o.number || '').trim();
      const title = mode === 'gst' ? 'TAX INVOICE' : 'INVOICE';
      const idLabel = mode === 'gst' ? 'GSTIN' : mode === 'vat' ? (label === 'VAT' ? 'VAT No.' : label + ' No.') : 'Tax ID';
      const sellerLines = textLines(o.fromAddress);
      if (String(o.fromTax || '').trim()) sellerLines.push(idLabel + ': ' + String(o.fromTax).trim());
      if (String(o.fromContact || '').trim()) sellerLines.push(String(o.fromContact).trim());
      const clientLines = textLines(o.toAddress);
      if (String(o.toTax || '').trim()) clientLines.push(idLabel + ': ' + String(o.toTax).trim());
      const dateText = L.fmtDate(o.date) || '—';
      const dueText = L.fmtDate(dueIso) || '—';
      const meta = [['Invoice no.', number || '—'], ['Invoice date', dateText], ['Due date', dueText], ['Terms', terms]];
      if (mode === 'gst') meta.push(['Place of supply', posCode + ' — ' + stateName(posCode)]);

      const pages = [];
      let y = 0;

      /* ---------- the three tops ---------- */
      function topModern() {
        const bh = logo ? 112 : 96;
        ops.push({ rect: [0, H - bh, W, bh], fill: accent });
        let x = m;
        if (logo) {
          const [lw, lh] = logoFit(120, 56);
          const ly = H - bh / 2 - lh / 2;
          ops.push({ rect: [m - 6, ly - 6, lw + 12, lh + 12], fill: '#ffffff' });
          drawLogo(m, ly, lw, lh);
          x = m + lw + 22;
        }
        const nameW = W * 0.6 - x;
        T(fit(fromName, 'b', 16, nameW), x, H - bh / 2 + 7, 16, 'b', ink);
        wrap(sellerLines.join('  ·  '), 'r', 8, nameW).slice(0, 3)
          .forEach((ln, i) => T(ln, x, H - bh / 2 - 8 - i * 10, 8, 'r', ink));
        T(title, W - m, H - bh / 2 + 4, 24, 'b', ink, 'right');
        if (number) T(fit(number, 'r', 10, W * 0.35), W - m, H - bh / 2 - 13, 10, 'r', ink, 'right');
        y = H - bh - 26;
        const cw = inner / 3;
        let a = y, b = y, c = y;
        T('BILL TO', m, a, 7, 'b', accentText); a -= 15;
        T(fit(toName, 'b', 10.5, cw - 14), m, a, 10.5, 'b'); a -= 12.5;
        clientLines.forEach((ln) => { T(fit(ln, 'r', 8.5, cw - 14), m, a, 8.5, 'r', '#333333'); a -= 11; });
        const x2 = m + cw + 6;
        T('DETAILS', x2, b, 7, 'b', accentText); b -= 15;
        meta.forEach(([k, v]) => { T(k, x2, b, 8, 'r', GREY); T(fit(v, 'b', 8.5, cw - 82), m + 2 * cw - 10, b, 8.5, 'b', INK, 'right'); b -= 12.5; });
        T(paid ? 'AMOUNT PAID' : 'AMOUNT DUE', W - m, c, 7, 'b', accentText, 'right'); c -= 22;
        T(money(total), W - m, c, fitSize(money(total), 'b', 18, cw - 6), 'b', accentText, 'right'); c -= 14;
        T(paid ? 'Paid' + (paidDate ? ' ' + paidDate : '') : 'Due ' + dueText, W - m, c, 8.5, 'r', GREY, 'right'); c -= 11;
        y = Math.min(a, b, c) - 14;
      }
      function topClassic() {
        let ly = H - m;
        if (logo) {
          const [lw, lh] = logoFit(150, 54);
          drawLogo(m, ly - lh, lw, lh);
          ly -= lh + 14;
        }
        T(fit(fromName, 'serif', 17, W * 0.52), m, ly - 14, 17, 'serif'); ly -= 14 + 14;
        sellerLines.forEach((ln) => { T(fit(ln, 'serif', 9.5, W * 0.5), m, ly, 9.5, 'serif', '#333333'); ly -= 12; });
        let ry = H - m;
        T(title, W - m, ry - 24, 28, 'serif', accentText, 'right'); ry -= 24 + 20;
        meta.forEach(([k, v]) => {
          T(k.toUpperCase(), W - m - 205, ry, 7, 'b', GREY);
          T(fit(v, 'serif', 10, 120), W - m, ry, 10, 'serif', INK, 'right');
          ry -= 13.5;
        });
        y = Math.min(ly, ry) - 6;
        ops.push({ line: [m, y, W - m, y], stroke: INK, lineWidth: 1.4 });
        ops.push({ line: [m, y - 3, W - m, y - 3], stroke: INK, lineWidth: 0.5 });
        y -= 24;
        T('BILL TO', m, y, 7, 'b', GREY); y -= 15;
        T(fit(toName, 'serif', 13, W * 0.6), m, y, 13, 'serif'); y -= 13.5;
        clientLines.forEach((ln) => { T(fit(ln, 'serif', 10, W * 0.6), m, y, 10, 'serif', '#333333'); y -= 12; });
        y -= 12;
      }
      function topCompact() {
        const top = H - m;
        let x = m, lh = 0;
        if (logo) {
          const f = logoFit(80, 30);
          lh = f[1];
          drawLogo(m, top - lh, f[0], lh);
          x = m + f[0] + 10;
        }
        T(fit(fromName, 'b', 11, W * 0.58 - x), x, top - 10, 11, 'b');
        const sl = wrap(sellerLines.join(' · '), 'r', 7, W * 0.6 - x).slice(0, 3);
        sl.forEach((ln, i) => T(ln, x, top - 21 - i * 8.5, 7, 'r', GREY));
        T(title, W - m, top - 11, 13, 'b', accentText, 'right');
        if (number) T(fit(number, 'mono', 9, W * 0.3), W - m, top - 23, 9, 'mono', INK, 'right');
        y = top - Math.max(lh, 21 + 8.5 * Math.max(1, sl.length), 26) - 6;
        ops.push({ line: [m, y, W - m, y], stroke: INK, lineWidth: 0.6 });
        y -= 13;
        const cells = [['BILL TO', [toName].concat(clientLines)]].concat(meta.slice(1).map(([k, v]) => [k.toUpperCase(), [v]]));
        const firstW = inner * 0.38, restW = (inner - firstW) / (cells.length - 1);
        let deepest = 0;
        cells.forEach(([k, vals], i) => {
          const x0 = i === 0 ? m : m + firstW + (i - 1) * restW;
          const w0 = (i === 0 ? firstW : restW) - 8;
          T(k, x0, y, 6.5, 'b', GREY);
          vals.slice(0, 6).forEach((v, j) => T(fit(v, j === 0 ? 'b' : 'r', 8, w0), x0, y - 10 - j * 9.5, 8, j === 0 ? 'b' : 'r'));
          deepest = Math.max(deepest, Math.min(6, vals.length));
        });
        y -= 10 + deepest * 9.5 + 2;
        ops.push({ line: [m, y, W - m, y], stroke: RULE, lineWidth: 0.5 });
        y -= 14;
      }
      function topNext() {
        const top = H - m + 4;
        if (tpl === 'modern') ops.push({ rect: [0, H - 8, W, 8], fill: accent });
        T(fit(fromName, 'b', 9, W * 0.5), m, top - 12, 9, 'b');
        T('Invoice ' + (number || '') + ' · continued', W - m, top - 12, 8.5, S.body === 'serif' ? 'serif' : 'r', GREY, 'right');
        ops.push({ line: [m, top - 19, W - m, top - 19], stroke: RULE, lineWidth: 0.6 });
        y = top - 36;
      }
      function newPage(first) {
        ops = [];
        pages.push({ size: [W, H], ops });
        if (S.strip) ops.push({ rect: [0, 0, S.strip, H], fill: accent });
        if (!first) topNext();
        else if (tpl === 'classic') topClassic();
        else if (tpl === 'compact') topCompact();
        else topModern();
      }
      function need(h) { if (y - h < BOTTOM) { newPage(false); return true; } return false; }
      newPage(true);

      /* ---------- the item table ---------- */
      const sz = S.size;
      const showHsn = rows.some((r) => r.hsn), showUnit = rows.some((r) => r.unit), showDisc = rows.some((r) => r.disc);
      const lineRates = Array.from(new Set(rows.map((r) => r.taxRate)));
      const showTax = mode !== 'none' && (mode === 'gst' || lineRates.length > 1);
      const sym = CUR.sym.trim();
      const widest = (list, st, size) => list.reduce((w, s) => Math.max(w, tw(s, st, size)), 0);
      const cols = [{ k: 'n', l: '#', w: 20, a: 'left' }, { k: 'desc', l: 'DESCRIPTION', w: 0, a: 'left' }];
      if (showHsn) cols.push({ k: 'hsn', l: 'HSN/SAC', w: Math.max(46, widest(rows.map((r) => r.hsn), S.num, sz) + 12), a: 'left' });
      cols.push({ k: 'qty', l: 'QTY', w: Math.max(34, widest(rows.map((r) => q(r.qty)), S.num, sz) + 12), a: 'right' });
      if (showUnit) cols.push({ k: 'unit', l: 'UNIT', w: 38, a: 'left' });
      cols.push({ k: 'rate', l: 'RATE (' + sym + ')', w: Math.max(58, widest(rows.map((r) => amt(r.rate)), S.num, sz) + 12), a: 'right' });
      if (showDisc) cols.push({ k: 'disc', l: 'DISC %', w: 38, a: 'right' });
      if (showTax) cols.push({ k: 'tax', l: (mode === 'gst' ? 'GST' : label.toUpperCase().slice(0, 8)) + ' %', w: 40, a: 'right' });
      cols.push({ k: 'amt', l: 'AMOUNT (' + sym + ')', w: Math.max(70, widest(rows.map((r) => amt(r.amount)), S.num, sz) + 12), a: 'right' });
      const fixed = cols.reduce((s, c) => s + c.w, 0);
      cols[1].w = Math.max(110, inner - fixed);
      let cx = m;
      cols.forEach((c) => { c.x = cx; cx += c.w; });
      const cellX = (c) => c.a === 'right' ? c.x + c.w - 6 : c.x + 6;
      const descW = cols[1].w - 12;
      let tableTop = 0;

      function tableHead() {
        const hh = 19;
        if (S.headFill) ops.push({ rect: [m, y - hh, inner, hh], fill: S.headFill });
        cols.forEach((c) => T(c.l, cellX(c), y - 12.5, 6.8, 'b', S.headInk, c.a));
        tableTop = y;
        y -= hh;
        if (tpl === 'compact') ops.push({ line: [m, y, W - m, y], stroke: INK, lineWidth: 0.7 });
      }
      function closeTable() {
        if (tpl !== 'classic') return;
        ops.push({ rect: [m, y, inner, tableTop - y], stroke: INK, lineWidth: 0.8 });
        cols.slice(1).forEach((c) => ops.push({ line: [c.x, tableTop, c.x, y], stroke: S.rule, lineWidth: 0.4 }));
      }
      need(19 + 40);
      tableHead();
      rows.forEach((r, i) => {
        const wl = wrap(r.desc, S.body, sz, descW);
        const rowH = Math.max(1, wl.length) * S.lead + S.pad * 2;
        if (y - rowH < BOTTOM) { closeTable(); newPage(false); tableHead(); }
        if (S.zebra && i % 2 === 1) ops.push({ rect: [m, y - rowH, inner, rowH], fill: S.zebra });
        const top = y - S.pad - sz * 0.82;
        T(String(i + 1), cellX(cols[0]), top, sz - 0.5, S.body, GREY);
        wl.forEach((ln, k) => T(ln, cols[1].x + 6, top - k * S.lead, sz, S.body));
        const put = (k, text, st) => {
          const c = cols.find((x) => x.k === k);
          if (c) T(text, cellX(c), top, sz, st || S.num, INK, c.a);
        };
        put('hsn', r.hsn || '—');
        put('qty', q(r.qty));
        put('unit', fit(r.unit || '', S.body, sz, 30), S.body);
        put('rate', amt(r.rate));
        put('disc', r.disc ? q(r.disc) : '—');
        put('tax', q(r.taxRate));
        put('amt', amt(r.amount), S.num === 'mono' ? 'mono' : 'b');
        y -= rowH;
        if (S.rule) ops.push({ line: [m, y, W - m, y], stroke: S.rule, lineWidth: 0.4 });
        else ops.push({ line: [m, y, W - m, y], stroke: RULE, lineWidth: 0.5 });
      });
      closeTable();
      y -= 14;

      /* ---------- totals ---------- */
      const tRows = [['Subtotal', amt(itemsTotal)]];
      if (discount) tRows.push([discLabel, '-' + amt(discount)]);
      if (shipping) tRows.push([mode === 'none' ? 'Shipping' : 'Shipping (' + (shipTaxed ? 'taxed at ' + q(defRate) + '%' : 'not taxed') + ')', amt(shipping)]);
      if (taxLines.length && (discount || shipping || multi)) tRows.push(['Taxable value', amt(taxable)]);
      taxLines.forEach((t) => tRows.push([t.name + ' ' + q(t.rate) + '%' + (multi ? ' on ' + amt(t.base) : ''), amt(t.amount)]));
      if (Math.abs(roundOff) >= 0.005) tRows.push(['Rounding', (roundOff > 0 ? '+' : '-') + amt(Math.abs(roundOff))]);
      const totW = tpl === 'compact' ? 230 : 260, totX = W - m - totW;
      const rh = S.lead + 3;
      const wordsLines = showWords ? wrap('Amount in words: ' + words, 'b', 8.5, inner) : [];
      need(tRows.length * rh + 52);
      const totalsTop = y, totalsPage = pages.length;
      tRows.forEach(([k, v], i) => {
        const ty = y - 10 - i * rh;
        T(fit(k, S.body, sz, totW - 100), totX + 8, ty, sz, S.body, '#333333');
        T(v, W - m - 8, ty, sz, S.num, INK, 'right');
      });
      y = y - 10 - (tRows.length - 1) * rh - 9;
      const bandLabel = paid ? 'TOTAL PAID' : 'TOTAL DUE';
      if (tpl === 'modern') {
        ops.push({ rect: [totX, y - 26, totW, 26], fill: accent });
        T(bandLabel, totX + 10, y - 17, 10.5, 'b', ink);
        T(money(total), W - m - 10, y - 17.5, 12, 'b', ink, 'right');
        y -= 26 + 16;
      } else if (tpl === 'classic') {
        ops.push({ line: [totX, y, W - m, y], stroke: INK, lineWidth: 1 });
        T(bandLabel, totX + 8, y - 16, 10.5, 'b');
        T(money(total), W - m - 8, y - 16, 12, 'b', INK, 'right');
        ops.push({ line: [totX, y - 24, W - m, y - 24], stroke: INK, lineWidth: 0.6 });
        ops.push({ line: [totX, y - 26.5, W - m, y - 26.5], stroke: INK, lineWidth: 0.6 });
        y -= 26.5 + 18;
      } else {
        T(bandLabel, totX + 8, y - 12, 9, 'b');
        T(money(total), W - m - 8, y - 12, 10, 'b', accentText, 'right');
        ops.push({ line: [totX, y - 18, W - m, y - 18], stroke: accent, lineWidth: 1.6 });
        y -= 18 + 16;
      }
      /* the stamp goes in the empty space beside the totals, when they are on the first page */
      const stampAt = totalsPage === 1 ? [m + (totX - m) / 2, (totalsTop + y) / 2] : [W * 0.64, H * 0.6];
      if (paid) {
        T('Paid in full' + (paidDate ? ' on ' + paidDate : '') + (paidMethod ? ' by ' + lowerFirst(paidMethod) : '') + '. Balance due: ' + money(0),
          W - m, y, 8.5, 'b', '#1e6b37', 'right');
        y -= 16;
      }
      if (wordsLines.length) {
        need(wordsLines.length * 11 + 8);
        wordsLines.forEach((ln, i) => T(ln, m, y - i * 11, 8.5, 'b', '#333333'));
        y -= wordsLines.length * 11 + 10;
      }

      /* ---------- payment details and notes ---------- */
      const bankLines = textLines(o.bank);
      if (bankLines.length) {
        const bh = bankLines.length * 11.5 + 26;
        need(bh + 10);
        if (tpl === 'modern') ops.push({ rect: [m, y - bh, inner, bh], fill: '#f4f5f7' });
        else if (tpl === 'classic') ops.push({ rect: [m, y - bh, inner, bh], stroke: '#777777', lineWidth: 0.6 });
        else ops.push({ line: [m, y - bh, W - m, y - bh], stroke: RULE, lineWidth: 0.5 });
        T('PAYMENT DETAILS', m + 10, y - 14, 7, 'b', GREY);
        bankLines.forEach((ln, i) => T(fit(ln, S.body, 9, inner - 20), m + 10, y - 28 - i * 11.5, 9, S.body));
        y -= bh + 16;
      }
      const noteText = String(o.notes || '').trim();
      if (noteText) {
        const nl = wrap(noteText, S.body, 8.5, inner);
        need(Math.min(nl.length, 3) * 11 + 18);
        T('NOTES', m, y, 7, 'b', GREY);
        y -= 13;
        nl.forEach((ln) => { if (y - 11 < BOTTOM) newPage(false); T(ln, m, y, 8.5, S.body, '#333333'); y -= 11; });
      }

      /* ---------- the PAID stamp: rotated, translucent, on the first page ---------- */
      if (paid) {
        const p = pages[0];
        const sub = [paidDate, paidMethod].filter(Boolean).join(' · ').toUpperCase();
        const big = 46, small = 8.5;
        const w1 = tw('PAID', 'b', big), w2 = sub ? tw(sub, 'b', small) : 0;
        const bw = Math.max(w1, w2) + 36, bh = big * 0.72 + (sub ? small + 12 : 0) + 26;
        const ang = 18 * Math.PI / 180, cs = Math.cos(ang), sn = Math.sin(ang);
        const [cxs, cys] = stampAt;
        const f = (v) => String(Math.round(v * 1000) / 1000);
        const RED = '0.776 0.157 0.157';
        const fk = FONT.b.replace(/[^A-Za-z0-9]/g, '');
        p.gs = Object.assign({}, p.gs || {}, { GS1: 0.32 });
        /* the raw text below needs the bold font in the page's resources */
        p.ops.push({ text: '', x: 0, y: 0, size: 1, font: FONT.b });
        const cmds = ['q', '/GS1 gs', [cs, sn, -sn, cs, cxs, cys].map(f).join(' ') + ' cm', RED + ' RG', RED + ' rg',
          '3 w', [-bw / 2, -bh / 2, bw, bh].map(f).join(' ') + ' re S',
          '1 w', [-bw / 2 + 5, -bh / 2 + 5, bw - 10, bh - 10].map(f).join(' ') + ' re S',
          'BT /' + fk + ' ' + big + ' Tf ' + f(-w1 / 2) + ' ' + f(-bh / 2 + 13 + (sub ? small + 12 : 0)) + ' Td (' + core.contentEscape('PAID') + ') Tj ET'];
        if (sub) cmds.push('BT /' + fk + ' ' + small + ' Tf ' + f(-w2 / 2) + ' ' + f(-bh / 2 + 15) + ' Td (' + core.contentEscape(sub) + ') Tj ET');
        cmds.push('Q');
        p.ops.push({ raw: cmds.join('\n') });
      }

      /* ---------- footers, once the page count is known ---------- */
      const footLeft = fit(fromName + ' · Invoice ' + (number || ''), 'r', 7.5, inner - 120);
      pages.forEach((p, i) => {
        ops = p.ops;
        ops.push({ line: [m, 46, W - m, 46], stroke: RULE, lineWidth: 0.5 });
        T(footLeft, m, 34, 7.5, 'r', GREY);
        T('Page ' + (i + 1) + ' of ' + pages.length, W - m, 34, 7.5, 'r', GREY, 'right');
      });

      const bytes = core.createPDF(pages, {
        info: { Title: ('Invoice ' + number).trim(), Author: fromName, Subject: 'Invoice for ' + toName }
      });

      const warns = [];
      if (ignoredTax.length) warns.push('Tax is set to none, so the rate on line' + (ignoredTax.length > 1 ? 's ' : ' ') + ignoredTax.join(', ') + ' was not charged.');
      if (mode === 'gst' && !String(o.fromTax || '').trim()) warns.push('Your GSTIN is blank; a GST tax invoice must show it.');
      if (mode === 'gst' && o.sellerState !== 'auto' && gstinState(o.fromTax) && gstinState(o.fromTax) !== sellerCode) warns.push('Your GSTIN starts with ' + gstinState(o.fromTax) + ', but your state is set to ' + sellerCode + '. The invoice uses ' + sellerCode + '.');
      if (mode === 'gst' && o.placeOfSupply !== 'auto' && gstinState(o.toTax) && gstinState(o.toTax) !== posCode) warns.push('The client’s GSTIN starts with ' + gstinState(o.toTax) + ', but the place of supply is set to ' + posCode + '. The invoice uses ' + posCode + '.');
      if (paid && !String(o.paidDate || '').trim()) warns.push('Marked as paid with no date: the stamp shows the method only.');

      const stats = [
        ['Layout', tpl.charAt(0).toUpperCase() + tpl.slice(1)],
        ['Line items', String(rows.length)],
        ['Subtotal', money(itemsTotal)]
      ];
      if (discount) stats.push([discLabel, '-' + money(discount)]);
      if (shipping) stats.push(['Shipping', money(shipping) + (mode === 'none' ? '' : shipTaxed ? ' (taxed)' : ' (not taxed)')]);
      if (taxLines.length && (discount || shipping || multi)) stats.push(['Taxable value', money(taxable)]);
      if (mode === 'gst') stats.push(['Supply', intra ? 'Intra-state, ' + stateName(sellerCode) : 'Inter-state, ' + stateName(sellerCode) + ' to ' + stateName(posCode)]);
      taxLines.forEach((t) => stats.push([t.name + ' ' + q(t.rate) + '%', money(t.amount)]));
      if (Math.abs(roundOff) >= 0.005) stats.push(['Rounding', (roundOff > 0 ? '+' : '-') + money(Math.abs(roundOff))]);
      stats.push(['Total due', money(total)]);
      if (showWords) stats.push(['In words', words]);
      stats.push(['Due date', dueText]);
      if (paid) stats.push(['Status', 'Paid' + (paidDate ? ' on ' + paidDate : '') + (paidMethod ? ' by ' + paidMethod : '')]);
      stats.push(['Pages', String(pages.length)]);
      stats.push(['Output size', fmtBytes(bytes.length)]);

      return {
        files: [{ name: fileStem(number) + '.pdf', bytes }],
        warn: warns.length ? warns.join(' ') : undefined,
        stats
      };
    },
"mountExtras": (api) => {
      const { root, el, btn, store } = api;
      const spec = window.PDF_TOOLS['invoice-pdf'];
      const controls = spec.controls;
      const io = root.parentNode || root;
      const KEY = { form: api.storageKey('form'), logo: api.storageKey('logo'), customers: api.storageKey('customers'), issued: api.storageKey('issued') };
      const today = () => new Date().toISOString().slice(0, 10);
      const SELLER = ['fromName', 'fromAddress', 'fromTax', 'fromContact', 'logo', 'bank', 'notes', 'currency', 'taxMode', 'tax', 'taxLabel',
        'sellerState', 'discountType', 'shippingTax', 'rounding', 'words', 'due', 'paidMethod', 'template', 'accent', 'pageSize'];

      /* ---------- the panel: saved clients, and this invoice ---------- */
      const bar = el('div', 'opt-bar inv-extras');
      const fC = el('div', 'field');
      const lC = el('label', null, 'Saved clients');
      lC.htmlFor = 'inv-clients';
      const pick = el('select', 'control');
      pick.id = 'inv-clients';
      const rowC = el('div', 'io-actions');
      rowC.style.marginTop = '8px';
      const saveC = btn('Save the client above', 'btn-ghost');
      saveC.id = 'inv-save-client';
      const delC = btn('Delete', 'btn-ghost', 'Delete the chosen client');
      delC.id = 'inv-delete-client';
      rowC.appendChild(saveC); rowC.appendChild(delC);
      fC.appendChild(lC); fC.appendChild(pick); fC.appendChild(rowC);

      const fI = el('div', 'field');
      const lI = el('label', null, 'This invoice');
      const rowI = el('div', 'io-actions');
      const fresh = btn('Start a new invoice', 'btn-ghost');
      fresh.id = 'inv-new';
      lI.htmlFor = 'inv-new';
      const exp = btn('Export as JSON', 'btn-ghost');
      exp.id = 'inv-export';
      const imp = btn('Import JSON', 'btn-ghost');
      imp.id = 'inv-import';
      const file = el('input', 'visually-hidden');
      file.type = 'file'; file.accept = '.json,application/json'; file.id = 'inv-import-file'; file.tabIndex = -1;
      file.setAttribute('aria-hidden', 'true');
      rowI.appendChild(fresh); rowI.appendChild(exp); rowI.appendChild(imp); rowI.appendChild(file);
      fI.appendChild(lI); fI.appendChild(rowI);

      const status = el('p', 'pdf-remembered inv-status');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      const forget = btn('Forget what this device keeps', 'btn-link');
      forget.id = 'inv-forget';
      const tell = (text, action) => {
        status.textContent = text ? text + ' ' : '';
        if (action) status.appendChild(action);
        status.appendChild(document.createTextNode(text ? ' · ' : ''));
        status.appendChild(forget);
      };
      bar.appendChild(fC); bar.appendChild(fI); bar.appendChild(status);
      root.appendChild(bar);
      tell('');

      /* ---------- which fields matter for which choices ---------- */
      const show = (k, on) => { const r = api.reader(k); if (r && r.wrap) r.wrap.hidden = !on; };
      const sync = () => {
        const o = api.get();
        show('taxLabel', o.taxMode === 'vat');
        show('sellerState', o.taxMode === 'gst');
        show('placeOfSupply', o.taxMode === 'gst');
        show('tax', o.taxMode !== 'none');
        show('shippingTax', o.taxMode !== 'none');
        show('paidDate', !!o.paid);
        show('paidMethod', !!o.paid);
      };
      let lastMode = api.get().taxMode;
      const modeChanged = () => {
        const o = api.get();
        /* the usual standard rate for the system just chosen */
        if (o.taxMode === 'gst' && lastMode !== 'gst' && String(o.tax) === '20') api.set({ tax: '18' });
        if (o.taxMode === 'vat' && lastMode === 'gst' && String(o.tax) === '18') api.set({ tax: '20' });
        lastMode = o.taxMode;
      };

      /* ---------- the form on this device ---------- */
      const snapshot = () => {
        const o = api.get();
        const f = {};
        controls.forEach((c) => { if (c.type !== 'image') f[c.key] = c.type === 'checkbox' ? !!o[c.key] : String(o[c.key] == null ? '' : o[c.key]); });
        return f;
      };
      let quiet = false, paused = false, timer = null;
      const saveForm = () => { if (!paused) store.set(KEY.form, { format: FORMAT, version: 1, fields: snapshot() }); };
      const saveLogo = () => {
        if (paused) return;
        const v = api.get().logo;
        if (!v) { store.del(KEY.logo); return; }
        if (!store.set(KEY.logo, packLogo(v))) tell('The logo is too large to keep on this device; everything else is saved. A smaller picture will be kept.');
      };
      const logoReader = api.reader('logo');
      io.addEventListener('input', (e) => {
        if (quiet) return;
        if (logoReader && e.target === logoReader.input) saveLogo();
        if (e.target && (e.target.id === 'pc-taxMode' || e.target.id === 'pc-paid')) { if (e.target.id === 'pc-taxMode') modeChanged(); sync(); }
        clearTimeout(timer);
        timer = setTimeout(saveForm, 350);
      });
      io.addEventListener('change', (e) => {
        if (e.target && (e.target.id === 'pc-taxMode' || e.target.id === 'pc-paid')) { if (e.target.id === 'pc-taxMode') modeChanged(); sync(); }
      });

      const fill = (values, keep) => {
        quiet = true;
        try { api.set(values); } finally { quiet = false; }
        lastMode = api.get().taxMode;
        sync();
        if (keep !== false) saveForm();
      };

      const saved = store.get(KEY.form);
      let restored = false;
      if (saved && saved.format === FORMAT && saved.fields) {
        const c = cleanFields(saved.fields, controls);
        if (c.values) { fill(c.values, false); restored = true; }
      }
      const lp = store.get(KEY.logo);
      if (lp) {
        const u = unpackLogo(lp);
        if (u.value) { quiet = true; try { logoReader.set(u.value); } finally { quiet = false; } restored = true; }
      }
      if (!restored) {
        /* first visit: the site's preferences, where the visitor chose them
           and has not since changed the setting on this page */
        const P = window.Prefs;
        const kept = store.get(api.storageKey('')) || {};
        const pre = {};
        if (P) {
          try {
            const region = P.taxRegion && P.taxRegion();
            if (region === 'in' && kept.taxMode === undefined) { pre.taxMode = 'gst'; if (kept.tax === undefined) pre.tax = '18'; }
            if (region === 'uk' && kept.taxMode === undefined) pre.taxMode = 'vat';
            const cur = P.chosen && P.chosen('currency') ? P.currency() : (region === 'in' ? 'INR' : null);
            if (cur && kept.currency === undefined && ownControl('currency').options.some((x) => x.value === cur)) pre.currency = cur;
            const paper = { A4: 'a4', Letter: 'letter', Legal: 'legal' }[P.paper && P.paper()];
            if (paper && P.chosen && P.chosen('paper') && kept.pageSize === undefined) pre.pageSize = paper;
          } catch (e) { /* preferences are a convenience */ }
        }
        if (Object.keys(pre).length) fill(pre, false);
        else sync();
      } else {
        const again = btn('Start a new invoice', 'btn-link');
        again.addEventListener('click', () => fresh.click());
        tell('Your invoice from last time is back.', again);
      }

      /* ---------- saved clients ---------- */
      const clients = () => { const l = store.get(KEY.customers); return Array.isArray(l) ? l.filter((c) => c && typeof c.name === 'string') : []; };
      const listClients = (selected) => {
        const l = clients();
        pick.innerHTML = '';
        const none = el('option', null, l.length ? 'Choose a saved client…' : 'No saved clients yet');
        none.value = '';
        pick.appendChild(none);
        l.forEach((c, i) => { const op = el('option', null, c.name); op.value = String(i); if (c.name === selected) op.selected = true; pick.appendChild(op); });
        delC.disabled = !l.length;
      };
      listClients();
      pick.addEventListener('change', () => {
        const c = clients()[Number(pick.value)];
        if (!pick.value || !c) return;
        const v = { toName: c.name, toAddress: String(c.address || ''), toTax: String(c.tax || '') };
        const pos = ownControl('placeOfSupply');
        if (c.place && pos.options.some((x) => x.value === c.place)) v.placeOfSupply = c.place;
        fill(v);
        tell('Filled the client from your saved list: ' + c.name + '.');
      });
      saveC.addEventListener('click', () => {
        const o = api.get();
        const name = String(o.toName || '').trim();
        if (!name) { tell('Type the client’s name under Bill to first.'); return; }
        const l = clients().filter((c) => c.name.toLowerCase() !== name.toLowerCase());
        l.push({ name, address: String(o.toAddress || ''), tax: String(o.toTax || ''), place: o.placeOfSupply || 'auto' });
        l.sort((a, b) => a.name.localeCompare(b.name));
        if (!store.set(KEY.customers, l.slice(0, 500))) { tell('This browser would not keep the list; it may be in private mode.'); return; }
        listClients(name);
        tell('Saved ' + name + ' on this device.');
      });
      delC.addEventListener('click', () => {
        const l = clients();
        const c = l[Number(pick.value)];
        if (!pick.value || !c) { tell('Choose a saved client to delete.'); pick.focus(); return; }
        l.splice(Number(pick.value), 1);
        store.set(KEY.customers, l);
        listClients();
        tell('Deleted ' + c.name + ' from this device.');
      });

      /* ---------- numbers: the next one after each download ---------- */
      let runNumber = null;
      document.addEventListener('click', (e) => {
        const b = e.target && e.target.closest ? e.target.closest('button') : null;
        if (!b) return;
        if (b.closest('.pdf-run, .pdf-run-sticky')) { runNumber = String(api.get().number || '').trim(); return; }
        if (b.closest('.pdf-summary-actions') && io.contains(b)) {
          const issued = runNumber !== null ? runNumber : String(api.get().number || '').trim();
          if (!issued) return;
          store.set(KEY.issued, issued);
          if (String(api.get().number || '').trim() === issued) {
            const next = nextNumber(issued);
            fill({ number: next });
            const back = btn('Put ' + issued + ' back', 'btn-link');
            back.addEventListener('click', () => { fill({ number: issued }); tell('The number is ' + issued + ' again.'); });
            tell(issued + ' downloaded. The number is now ' + next + ', ready for the next invoice.', back);
          }
        }
      }, true);

      fresh.addEventListener('click', () => {
        const o = api.get();
        const issued = store.get(KEY.issued);
        const v = {};
        controls.forEach((c) => {
          if (SELLER.indexOf(c.key) >= 0 || c.type === 'image') return;
          if (c.type === 'checkbox') v[c.key] = false;
          else if (c.default === 'TODAY') v[c.key] = today();
          else if (c.type === 'text' || c.type === 'textarea') v[c.key] = '';
          else v[c.key] = String(c.default);
        });
        const cur = String(o.number || '').trim();
        v.number = typeof issued === 'string' && issued && cur === issued ? nextNumber(issued) : cur;
        fill(v);
        tell('A new invoice, ' + v.number + ', with your business details kept.');
        const t = api.reader('toName');
        if (t && t.input) t.input.focus();
      });

      /* ---------- the whole invoice as a file ---------- */
      exp.addEventListener('click', () => {
        const o = api.get();
        const doc = { format: FORMAT, version: 1, saved: new Date().toISOString(), fields: snapshot(), logo: packLogo(o.logo) };
        api.download(JSON.stringify(doc, null, 1), fileStem(o.number) + '.json', 'application/json');
        tell('Exported ' + fileStem(o.number) + '.json.');
      });
      imp.addEventListener('click', () => file.click());
      file.addEventListener('change', async () => {
        const f = file.files && file.files[0];
        file.value = '';
        if (!f) return;
        const no = (why) => tell('Could not import ' + f.name + ': ' + why + '. Nothing was changed.');
        if (f.size > 25 * 1048576) { no('it is larger than any saved invoice'); return; }
        let doc;
        try { doc = JSON.parse(await f.text()); } catch (e) { no('it is not JSON'); return; }
        if (!doc || doc.format !== FORMAT) { no('it is not an invoice exported by this tool (it has no "format": "' + FORMAT + '")'); return; }
        if (doc.version !== 1) { no('it was saved by a newer version of this tool'); return; }
        const c = cleanFields(doc.fields, controls);
        if (c.error) { no(c.error); return; }
        const u = unpackLogo(doc.logo);
        if (u.error) { no(u.error); return; }
        fill(c.values);
        quiet = true;
        try { logoReader.set(u.value); } finally { quiet = false; }
        saveLogo();
        tell('Imported ' + f.name + ': invoice ' + (c.values.number || '') + '.');
      });

      forget.addEventListener('click', () => {
        [KEY.form, KEY.logo, KEY.customers, KEY.issued].forEach((k) => store.del(k));
        listClients();
        clearTimeout(timer);
        paused = true;
        tell('This device no longer keeps the form, the logo, the saved clients or the last number, and this form is not saved again until the page is reloaded.');
      });
    },
"tips": [
  "Write one item per line: description, quantity, unit price. The longer form is description, HSN/SAC, quantity, unit, rate, discount%, and a line may end with its own tax rate, such as \"GST 5%\" or \"VAT 0%\"; a line without one is charged the default rate.",
  "Prices may keep their thousands commas, western or Indian: \"Consulting, 1, 1,200\" is 1 at 1,200 and \"Fit-out, 1, 1,25,000\" is 1 at 1,25,000. A line that could mean two different prices is not guessed at: the tool names the line and the readings, and asks.",
  "Under GST the place of supply decides the split. In your own state each rate is charged as CGST and SGST at half the rate each; in another state, as IGST at the full rate. Both states are read from the GSTINs unless you choose them.",
  "The discount comes off before tax and is shared across the lines in proportion to their value, so each rate is charged on the discounted amount. Shipping is either taxed at the default rate or not taxed, and the invoice says which.",
  "Three layouts: Modern puts your accent colour in a band across the top, Classic sets a ruled table in a serif face, and Compact uses small type to fit long invoices. Each prints on A4, US Letter or US Legal.",
  "Mark as paid adds a translucent PAID stamp, turned at an angle, with the date and the method, and the total then reads TOTAL PAID with a balance of zero.",
  "The form is saved on this device as you type and comes back when you return. After each download the number goes up by one: INV-2026-0042 becomes INV-2026-0043. Start a new invoice keeps your business details and logo and clears the client, the items and the stamp.",
  "Save a client to pick them from the list next time. Export writes the whole invoice, logo included, to a JSON file that Import reads back on any device. Nothing you add is uploaded: the PDF, the saved clients and the autosave stay in this browser."
],
"faq": [
  {"q":"Is this a legally compliant invoice?","a":"It produces the layout. Whether it is compliant depends on your jurisdiction and what you include — VAT registration number, tax point, reverse charge wording where relevant. Check the requirements for your country, or ask your accountant, before issuing."},
  {"q":"Can one invoice carry items at different GST or VAT rates?","a":"Yes. End a line with its rate, such as \"GST 12%\", and the totals show the tax at each rate on its own taxable value, from the highest rate down. The amount column is always before tax."},
  {"q":"Can I put my logo on the invoice?","a":"Yes. Choose a PNG, JPEG, WebP or GIF. It is drawn at the top left in every layout, scaled to fit without stretching, and saved on this device with the rest of the form."},
  {"q":"Where are my saved clients and the autosaved invoice kept?","a":"In this browser's storage on this device, and nowhere else: another browser or computer starts empty. Export and Import move an invoice between them, and \"Forget what this device keeps\" clears it all."},
  {"q":"Which currencies can I invoice in?","a":"Pounds, US dollars, euros, rupees, UAE dirhams, Singapore, Australian and Canadian dollars, and rand. Rupees are grouped in lakhs and crores, as 12,34,567.00, and the rest in thousands, as 1,234,567.00. The currency starts as the one in your site settings."}
]
};
})();
