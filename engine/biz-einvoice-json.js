/**
 * Invoices in a spreadsheet -> the e-invoice JSON the IRP takes.
 *
 * The Invoice Registration Portal accepts a JSON document in its published
 * schema (version 1.1) and returns the IRN and QR code; the offline tool and
 * every GSP bulk-upload accept the same shape as an array. This writes that
 * shape from ordinary rows — one per line item — with the seller typed once,
 * and validates the fields the portal rejects most: GSTIN checksum, PIN
 * codes, HSN length, dates, and the intra/inter-state tax split, which is
 * derived from the state codes so it cannot disagree with the GSTINs.
 */
(function () {
  'use strict';
  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['einvoice-json'] = {
    title: 'E-Invoice JSON Generator (IRP schema)',
    short: 'E-Invoice JSON',
    description: 'Turn a spreadsheet of invoices into the JSON the GST e-invoice portal accepts — schema 1.1, one file for bulk upload — with GSTINs, PINs, HSN codes and the CGST/SGST or IGST split checked before you upload. Runs in your browser; nothing is uploaded here.',
    keywords: ['e-invoice json generator', 'irp json format', 'e-invoice bulk upload json', 'einvoice schema 1.1', 'excel to e-invoice json', 'gst e-invoice offline tool alternative'],
    glyph: 'i-einvoice',
    glyphSvg: '<symbol id="i-einvoice" viewBox="0 0 24 24">\n  <path d="M6 3h8l4 4v14H6z"/>\n  <path d="M14 3v4h4" class="thin"/>\n  <path d="M10.5 11c-1.2 0-1.5.5-1.5 1.5v1c0 .8-.4 1.2-1 1.5.6.3 1 .7 1 1.5v1c0 1 .3 1.5 1.5 1.5" class="thin"/>\n  <path d="M13.5 11c1.2 0 1.5.5 1.5 1.5v1c0 .8.4 1.2 1 1.5-.6.3-1 .7-1 1.5v1c0 1-.3 1.5-1.5 1.5" class="thin"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/biz-einvoice-json.js'],
    tips: ['One row per line item: invoice number, date, buyer GSTIN and name, item description, HSN, quantity, unit, unit price, GST rate. Rows with the same invoice number become one invoice.', 'The tax split is decided by the state codes — the first two digits of the seller’s and buyer’s GSTINs (or the place of supply you give). Same state, CGST + SGST; different, IGST. You cannot get this wrong by typing.', 'Every GSTIN is checked against its checksum digit, PINs must be six digits, HSN four to eight, and totals are computed from the items, so what you upload is arithmetically consistent.', 'Upload the file on the e-invoice portal (Bulk upload → JSON) or through your GSP. The portal returns the IRN, acknowledgement and signed QR for each invoice.'],
    faq: [{ q: 'Which schema version is this?', a: 'E-invoice schema version 1.1, the one the IRP has accepted since 2020 and still does. The output is an array of invoice objects, which is what the bulk upload takes; a single invoice is an array of one.' }, { q: 'Can it generate the IRN or QR code?', a: 'No, and nothing offline can: the IRN is issued by the portal when it accepts the JSON. This produces the JSON the portal issues it against.' }, { q: 'What about B2C, exports, SEZ?', a: 'Supply type can be set to B2B, SEZ with or without payment, export with or without payment, or deemed export. B2C invoices do not need an IRN (unless the dynamic QR rules apply to you) and are not e-invoiced.' }]
  };
  if (typeof document === 'undefined') return;
  const K = () => window.MVRBizKit;

  const FIELDS = [
    { key: 'inv', label: 'Invoice number', need: true, aliases: ['invoiceno', 'invoicenumber', 'invno', 'docno', 'billno', 'number'] },
    { key: 'date', label: 'Invoice date', need: true, aliases: ['invoicedate', 'date', 'docdate', 'billdate'] },
    { key: 'bgstin', label: 'Buyer GSTIN', need: true, aliases: ['buyergstin', 'gstin', 'customergstin', 'partygstin', 'recipientgstin'] },
    { key: 'bname', label: 'Buyer legal name', need: true, aliases: ['buyername', 'buyer', 'customer', 'customername', 'party', 'partyname', 'legalname', 'billto'] },
    { key: 'baddr', label: 'Buyer address', aliases: ['buyeraddress', 'address', 'billingaddress', 'addr'] },
    { key: 'bloc', label: 'Buyer city', aliases: ['buyercity', 'city', 'location', 'place'] },
    { key: 'bpin', label: 'Buyer PIN', aliases: ['buyerpin', 'pin', 'pincode', 'postcode'] },
    { key: 'pos', label: 'Place of supply (state code)', aliases: ['placeofsupply', 'pos', 'statecode', 'posstate'] },
    { key: 'desc', label: 'Item description', need: true, aliases: ['description', 'item', 'itemname', 'product', 'productname', 'particulars'] },
    { key: 'hsn', label: 'HSN / SAC', need: true, aliases: ['hsn', 'hsncode', 'sac', 'saccode', 'hsnsac'] },
    { key: 'qty', label: 'Quantity', need: true, aliases: ['qty', 'quantity'] },
    { key: 'unit', label: 'Unit', aliases: ['unit', 'uom', 'units'] },
    { key: 'price', label: 'Unit price', need: true, aliases: ['unitprice', 'rate', 'price', 'itemprice'] },
    { key: 'rate', label: 'GST rate %', need: true, aliases: ['gstrate', 'taxrate', 'gst', 'rate%', 'taxpercent', 'itemtax'] },
    { key: 'disc', label: 'Discount (amount)', aliases: ['discount', 'disc'] },
    { key: 'service', label: 'Is service? (Y/N)', aliases: ['isservice', 'service', 'isservc'] }
  ];
  const UNITS = { NOS: 'NOS', NO: 'NOS', PCS: 'PCS', PC: 'PCS', KG: 'KGS', KGS: 'KGS', G: 'GMS', GM: 'GMS', L: 'LTR', LTR: 'LTR', MTR: 'MTR', M: 'MTR', BOX: 'BOX', SET: 'SET', PAC: 'PAC', DOZ: 'DOZ', HRS: 'OTH', OTH: 'OTH' };

  function gstinOk(g) {
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; let sum = 0;
    for (let i = 0; i < 14; i++) { const v = chars.indexOf(g[i]); const f = (i % 2 === 0) ? 1 : 2; const p = v * f; sum += Math.floor(p / 36) + (p % 36); }
    return chars[(36 - (sum % 36)) % 36] === g[14];
  }
  const ddmmyyyy = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
  const r2 = (n) => Math.round(n * 100) / 100;

  function build(rows, map, seller, opt) {
    const k = K(); const get = (r, key) => map[key] === undefined ? '' : r[map[key]];
    const issues = []; const byInv = new Map();
    rows.forEach((r, i) => {
      const inv = String(get(r, 'inv')).trim(); if (!inv) { issues.push('Row ' + (i + 2) + ': no invoice number.'); return; }
      if (!byInv.has(inv)) byInv.set(inv, { rows: [], first: i + 2 });
      byInv.get(inv).rows.push({ r, i });
    });
    const out = [];
    for (const [inv, g] of byInv) {
      const r0 = g.rows[0].r;
      const date = k.toISODate(get(r0, 'date'), true); if (!date) { issues.push('Invoice ' + inv + ': date not readable.'); continue; }
      const bg = String(get(r0, 'bgstin')).trim().toUpperCase(); if (!gstinOk(bg)) { issues.push('Invoice ' + inv + ': buyer GSTIN "' + bg + '" fails the checksum.'); continue; }
      const pos = String(get(r0, 'pos') || '').replace(/\D/g, '').slice(0, 2) || bg.slice(0, 2);
      const intra = pos === seller.gstin.slice(0, 2);
      const bpin = String(get(r0, 'bpin') || '').replace(/\D/g, '');
      const items = []; let ass = 0, cg = 0, sg = 0, ig = 0, tot = 0;
      g.rows.forEach(({ r, i }, n) => {
        const qty = k.toNumber(get(r, 'qty')), price = k.toNumber(get(r, 'price')), rate = k.toNumber(get(r, 'rate')), disc = k.toNumber(get(r, 'disc')) || 0;
        const hsn = String(get(r, 'hsn')).replace(/\D/g, '');
        if (!(qty > 0) || !Number.isFinite(price) || !Number.isFinite(rate)) { issues.push('Row ' + (i + 2) + ' (' + inv + '): quantity, price or rate is not a number.'); return; }
        if (hsn.length < 4 || hsn.length > 8) issues.push('Row ' + (i + 2) + ' (' + inv + '): HSN "' + get(r, 'hsn') + '" must be 4–8 digits.');
        const total = r2(qty * price), assAmt = r2(total - disc);
        const tax = r2(assAmt * rate / 100);
        const item = { SlNo: String(n + 1), PrdDesc: String(get(r, 'desc')).trim().slice(0, 300), IsServc: /^y/i.test(String(get(r, 'service') || (hsn.startsWith('99') ? 'Y' : 'N'))) ? 'Y' : 'N', HsnCd: hsn, Qty: qty, Unit: UNITS[String(get(r, 'unit') || 'NOS').toUpperCase()] || 'OTH', UnitPrice: r2(price), TotAmt: total, Discount: r2(disc), PreTaxVal: assAmt, AssAmt: assAmt, GstRt: rate, IgstAmt: 0, CgstAmt: 0, SgstAmt: 0, CesRt: 0, CesAmt: 0, CesNonAdvlAmt: 0, StateCesRt: 0, StateCesAmt: 0, StateCesNonAdvlAmt: 0, OthChrg: 0, TotItemVal: 0 };
        if (intra) { item.CgstAmt = r2(tax / 2); item.SgstAmt = r2(tax - item.CgstAmt); cg += item.CgstAmt; sg += item.SgstAmt; }
        else { item.IgstAmt = tax; ig += tax; }
        item.TotItemVal = r2(assAmt + item.IgstAmt + item.CgstAmt + item.SgstAmt);
        ass += assAmt; tot += item.TotItemVal; items.push(item);
      });
      if (!items.length) continue;
      const totInv = r2(tot), rnd = r2(Math.round(totInv) - totInv);
      out.push({
        Version: '1.1',
        TranDtls: { TaxSch: 'GST', SupTyp: opt.supTyp || 'B2B', RegRev: opt.regRev ? 'Y' : 'N', IgstOnIntra: 'N' },
        DocDtls: { Typ: opt.docTyp || 'INV', No: inv.slice(0, 16), Dt: ddmmyyyy(date) },
        SellerDtls: { Gstin: seller.gstin, LglNm: seller.name, TrdNm: seller.trade || seller.name, Addr1: seller.addr, Loc: seller.loc, Pin: Number(seller.pin), Stcd: seller.gstin.slice(0, 2), Ph: seller.phone || undefined, Em: seller.email || undefined },
        BuyerDtls: { Gstin: bg, LglNm: String(get(r0, 'bname')).trim().slice(0, 100), Pos: pos, Addr1: String(get(r0, 'baddr') || get(r0, 'bloc') || 'As per records').trim().slice(0, 100), Loc: String(get(r0, 'bloc') || '').trim().slice(0, 50) || 'As per records', Pin: bpin.length === 6 ? Number(bpin) : undefined, Stcd: bg.slice(0, 2) },
        ItemList: items,
        ValDtls: { AssVal: r2(ass), CgstVal: r2(cg), SgstVal: r2(sg), IgstVal: r2(ig), CesVal: 0, StCesVal: 0, Discount: 0, OthChrg: 0, RndOffAmt: opt.round ? rnd : 0, TotInvVal: opt.round ? r2(totInv + rnd) : totInv }
      });
      if (bpin.length !== 6) issues.push('Invoice ' + inv + ': buyer PIN "' + bpin + '" is not six digits — the portal requires it; the field is left out.');
    }
    return { invoices: out, issues };
  }

  function mount(root) {
    const k = K(); const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const st = { headers: [], rows: [], map: {} }; const msg = k.msgBox();
    io.appendChild(k.h3('1 · The seller (you), typed once'));
    const bar = k.el('div', 'opt-bar');
    const sGstin = k.textInput('ei-gstin', '', '27AABCS1234A1Z1'), sName = k.textInput('ei-name', '', 'Legal name as on the GST certificate'), sTrade = k.textInput('ei-trade', '', 'Trade name (optional)'), sAddr = k.textInput('ei-addr', '', 'Building, street'), sLoc = k.textInput('ei-loc', '', 'City'), sPin = k.textInput('ei-pin', '', '411001'), sPhone = k.textInput('ei-phone', '', 'optional'), sEmail = k.textInput('ei-email', '', 'optional');
    [k.field('Seller GSTIN *', sGstin), k.field('Legal name *', sName), k.field('Trade name', sTrade), k.field('Address *', sAddr), k.field('City *', sLoc), k.field('PIN *', sPin), k.field('Phone', sPhone), k.field('Email', sEmail)].forEach(f => bar.appendChild(f));
    const supTyp = k.select('ei-suptyp', [{ value: 'B2B', label: 'B2B' }, { value: 'SEZWP', label: 'SEZ with payment' }, { value: 'SEZWOP', label: 'SEZ without payment' }, { value: 'EXPWP', label: 'Export with payment' }, { value: 'EXPWOP', label: 'Export without payment' }, { value: 'DEXP', label: 'Deemed export' }], 'B2B');
    const docTyp = k.select('ei-doctyp', [{ value: 'INV', label: 'Invoice' }, { value: 'CRN', label: 'Credit note' }, { value: 'DBN', label: 'Debit note' }], 'INV');
    const round = k.select('ei-round', [{ value: 'yes', label: 'Round the invoice total' }, { value: 'no', label: 'Keep paise' }], 'yes');
    bar.appendChild(k.field('Supply type', supTyp)); bar.appendChild(k.field('Document type', docTyp)); bar.appendChild(k.field('Rounding', round));
    io.appendChild(bar);
    try { const saved = JSON.parse(localStorage.getItem('1234tools-einvoice-seller') || 'null'); if (saved) { sGstin.value = saved.gstin || ''; sName.value = saved.name || ''; sTrade.value = saved.trade || ''; sAddr.value = saved.addr || ''; sLoc.value = saved.loc || ''; sPin.value = saved.pin || ''; sPhone.value = saved.phone || ''; sEmail.value = saved.email || ''; } } catch (e) { /* none */ }

    io.appendChild(k.h3('2 · The invoices, one row per line item'));
    const mapBox = k.el('div');
    const drop = k.dropzone('Choose the invoice spreadsheet (Excel or CSV)', '.xlsx,.csv', async (f) => {
      try { msg.say('Reading…', 'note'); const t = await k.readTable(f); const h = k.splitHeader(t.sheets[0].rows); st.headers = h.headers; st.rows = h.rows; st.map = k.autoMap(FIELDS, h.headers); mapBox.innerHTML = ''; mapBox.appendChild(k.mapPanel('Invoice columns', FIELDS, h.headers, st.map)); drop.say(f.name, h.rows.length + ' rows'); msg.say(''); }
      catch (e) { msg.say(e.message, 'error'); }
    });
    io.appendChild(drop); io.appendChild(mapBox);
    const run = k.el('div', 'io-actions pdf-run'); run.appendChild(k.button('Generate e-invoice JSON', 'btn-primary', go)); io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    function go() {
      result.innerHTML = '';
      const seller = { gstin: sGstin.value.trim().toUpperCase(), name: sName.value.trim(), trade: sTrade.value.trim(), addr: sAddr.value.trim(), loc: sLoc.value.trim(), pin: sPin.value.replace(/\D/g, ''), phone: sPhone.value.trim(), email: sEmail.value.trim() };
      if (!gstinOk(seller.gstin)) { msg.say('The seller GSTIN fails its checksum — check it.', 'error'); return; }
      if (!seller.name || !seller.addr || !seller.loc || seller.pin.length !== 6) { msg.say('Fill in the seller’s legal name, address, city and six-digit PIN.', 'error'); return; }
      try { localStorage.setItem('1234tools-einvoice-seller', JSON.stringify(seller)); } catch (e) { /* private mode */ }
      if (!st.rows.length) { msg.say('Choose the invoice spreadsheet.', 'note'); return; }
      const miss = k.missing(FIELDS, st.map); if (miss.length) { msg.say('Map ' + miss.join(', ') + ' first.', 'error'); return; }
      const R = build(st.rows, st.map, seller, { supTyp: supTyp.value, docTyp: docTyp.value, round: round.value === 'yes' });
      if (!R.invoices.length) { msg.say('No invoice could be built. ' + (R.issues[0] || ''), 'error'); if (R.issues.length) result.appendChild(k.issues(R.issues)); return; }
      const json = JSON.stringify(R.invoices, null, 2);
      const total = R.invoices.reduce((s, x) => s + x.ValDtls.TotInvVal, 0);
      const items = R.invoices.reduce((s, x) => s + x.ItemList.length, 0);
      result.appendChild(k.summaryCard(R.invoices.length + ' invoice' + (R.invoices.length === 1 ? '' : 's') + ', ' + items + ' line items', 'Total ' + k.inr(total) + ' · ' + R.invoices.filter(x => x.ValDtls.IgstVal > 0).length + ' inter-state (IGST), ' + R.invoices.filter(x => x.ValDtls.IgstVal === 0).length + ' intra-state (CGST+SGST)', [k.downloadButton('einvoice-' + R.invoices[0].DocDtls.Dt.replace(/\//g, '-') + '.json', () => new Blob([json], { type: 'application/json' }))]));
      if (R.issues.length) result.appendChild(k.issues(R.issues, 'issue'));
      const preview = R.invoices.map(x => ({ invoice: x.DocDtls.No, date: x.DocDtls.Dt, buyer: x.BuyerDtls.LglNm, buyer_gstin: x.BuyerDtls.Gstin, pos: x.BuyerDtls.Pos, items: x.ItemList.length, taxable: x.ValDtls.AssVal, cgst: x.ValDtls.CgstVal, sgst: x.ValDtls.SgstVal, igst: x.ValDtls.IgstVal, total: x.ValDtls.TotInvVal }));
      result.appendChild(k.h3('What will be uploaded')); result.appendChild(k.previewTable(k.S().objectsToRows(preview), 25));
      const pre = k.el('pre', 'code-out biz-xml'); pre.textContent = json.length > 20000 ? json.slice(0, 20000) + '\n…' : json; result.appendChild(k.h3('The JSON')); result.appendChild(pre);
      msg.say(''); result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="einvoice-json"]'); if (r) mount(r); });
  window.MVREInvoice = { build, gstinOk };
})();
