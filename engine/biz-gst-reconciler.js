/**
 * GSTR-2B vs purchase register.
 *
 * The question every month is not "what did we buy" but "which of it can we
 * claim": input tax credit exists only for invoices the supplier has filed,
 * and the portal's GSTR-2B is the list of those. This reads the 2B (the
 * portal's JSON or its Excel) and your purchase register, matches invoice to
 * invoice, and says which credit is safe, which is at risk because the
 * supplier has not filed, which is in 2B but not in your books, and where
 * the amounts disagree. All of it on the device.
 */
(function () {
  'use strict';
  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['gst-reconciler'] = {
    title: 'GSTR-2B Reconciliation',
    short: 'GSTR-2B Reconcile',
    description: 'Match your purchase register against GSTR-2B — the portal’s JSON or Excel — and see which input tax credit is safe to claim, which suppliers have not filed, what is in 2B but not in your books, and where the tax amounts differ. Runs in your browser; nothing is uploaded.',
    keywords: ['gstr-2b reconciliation', 'gstr 2b vs purchase register', 'itc reconciliation tool', 'gst input credit matching', 'gstr2b json to excel', 'gst reconciliation free'],
    glyph: 'i-gst-recon',
    glyphSvg: '<symbol id="i-gst-recon" viewBox="0 0 24 24">\n  <path d="M4 4h8l3 3v5.5"/>\n  <path d="M12 4v3h3" class="thin"/>\n  <path d="M6.5 9.5h4M6.5 12.5h3" class="thin"/>\n  <rect x="11" y="12" width="9" height="8" rx="1.5"/>\n  <path d="M13.5 16.2l1.6 1.6 3-3.4"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/biz-gst-reconciler.js'],
    tips: ['Download GSTR-2B from the portal as JSON (Returns → GSTR-2B → Download → Generate JSON) — it carries everything, including credit notes. The Excel download works too.', 'The purchase register can be any spreadsheet with a supplier GSTIN, an invoice number, a date and the tax amounts; columns are matched by name and can be corrected.', 'Invoice numbers are compared loosely: INV/2026/0417, inv-2026-0417 and 0417 are treated as the same document, and a date within five days is tolerated. The tolerance on tax is one rupee.', '"Only in books" is the sheet that costs money: those suppliers have not filed, so the credit is not available until they do. Chase them before the 3B is due.', '"Only in 2B" is credit you are entitled to and have not recorded — a missing purchase entry, or an invoice that went to a different branch.'],
    faq: [{ q: 'Which GSTR-2B formats are read?', a: 'The JSON the portal generates (with B2B, B2BA, CDNR and CDNRA sections) and the Excel it offers, using the B2B sheet. Credit notes reduce the supplier’s total and are matched separately.' }, { q: 'How does matching work?', a: 'First on supplier GSTIN plus a normalised invoice number. Then, for what is left, on GSTIN plus the numeric tail of the invoice number with the date within five days and the taxable value within a rupee — which catches INV-0417 against 417. Anything still unmatched is reported on the side it appears.' }, { q: 'Is the result the ITC I can claim in 3B?', a: 'The Matched sheet is the credit that is both in your books and filed by the supplier, which is the condition for claiming it. Whether a particular line is eligible — blocked credit under section 17(5), reverse charge, personal use — is still your call and your CA’s; the tool reconciles, it does not adjudicate.' }, { q: 'Is any of this uploaded?', a: 'No. Both files are read and compared by your own browser, and the report is written there too. Nothing leaves your device.' }]
  };
  if (typeof document === 'undefined') return;

  const K = () => window.MVRBizKit;

  const F2B = [
    { key: 'gstin', label: 'Supplier GSTIN', need: true, aliases: ['gstinofsupplier', 'suppliergstin', 'gstin', 'ctin', 'gstinuinofsupplier'] },
    { key: 'name', label: 'Supplier name', aliases: ['tradelegalname', 'tradename', 'legalname', 'suppliername', 'name', 'trdnm'] },
    { key: 'inv', label: 'Invoice number', need: true, aliases: ['invoicenumber', 'invoiceno', 'inum', 'documentnumber', 'docno', 'invno'] },
    { key: 'date', label: 'Invoice date', need: true, aliases: ['invoicedate', 'idt', 'documentdate', 'date'] },
    { key: 'val', label: 'Invoice value', aliases: ['invoicevalue', 'val', 'documentvalue', 'totalvalue'] },
    { key: 'txval', label: 'Taxable value', need: true, aliases: ['taxablevalue', 'txval', 'taxableamount'] },
    { key: 'igst', label: 'IGST', aliases: ['integratedtax', 'igst', 'igstamount'] },
    { key: 'cgst', label: 'CGST', aliases: ['centraltax', 'cgst', 'cgstamount'] },
    { key: 'sgst', label: 'SGST', aliases: ['stateuttax', 'statetax', 'sgst', 'sgstamount', 'utgst'] },
    { key: 'cess', label: 'Cess', aliases: ['cess', 'cessamount'] }
  ];
  const FREG = [
    { key: 'gstin', label: 'Supplier GSTIN', need: true, aliases: ['gstin', 'suppliergstin', 'partygstin', 'gstinofsupplier', 'gstno'] },
    { key: 'name', label: 'Supplier name', aliases: ['supplier', 'suppliername', 'party', 'partyname', 'vendor', 'name', 'ledger'] },
    { key: 'inv', label: 'Invoice number', need: true, aliases: ['invoiceno', 'invoicenumber', 'billno', 'supplierinvoiceno', 'vchno', 'voucherno', 'refno', 'docno'] },
    { key: 'date', label: 'Invoice date', need: true, aliases: ['invoicedate', 'billdate', 'date', 'vchdate', 'voucherdate'] },
    { key: 'txval', label: 'Taxable value', need: true, aliases: ['taxablevalue', 'taxableamount', 'basicamount', 'amount', 'taxable'] },
    { key: 'igst', label: 'IGST', aliases: ['igst', 'igstamount', 'integratedtax'] },
    { key: 'cgst', label: 'CGST', aliases: ['cgst', 'cgstamount', 'centraltax'] },
    { key: 'sgst', label: 'SGST', aliases: ['sgst', 'sgstamount', 'statetax', 'utgst'] },
    { key: 'cess', label: 'Cess', aliases: ['cess'] },
    { key: 'total', label: 'Invoice total', aliases: ['total', 'invoicevalue', 'grandtotal', 'billamount', 'netamount'] }
  ];

  /** A document, whichever side it came from. */
  function doc(side, r, get, i) {
    const k = K();
    const gstin = String(get(r, 'gstin')).trim().toUpperCase();
    const inv = String(get(r, 'inv')).trim();
    const date = k.toISODate(get(r, 'date'), true);
    const n = (key) => { const v = k.toNumber(get(r, key)); return Number.isFinite(v) ? v : 0; };
    return { side, row: i + 2, gstin, name: String(get(r, 'name') || '').trim(), inv, key: k.invKey(inv), tail: k.invTail(inv), date, txval: n('txval'), igst: n('igst'), cgst: n('cgst'), sgst: n('sgst'), cess: n('cess'), tax: 0, note: '' };
  }
  const withTax = (d) => { d.tax = Math.round((d.igst + d.cgst + d.sgst + d.cess) * 100) / 100; return d; };

  /** GSTR-2B JSON, in the shapes the portal has produced. */
  function docsFromJson(j) {
    const out = [], root = j.data && j.data.docdata ? j.data.docdata : (j.docdata || j.data || j);
    const dd = (s) => { const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(s || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : K().toISODate(s, true); };
    const push = (ctin, trdnm, x, sign, kind) => {
      const num = x.inum || x.ntnum || x.num || '';
      const k = K();
      out.push(withTax({ side: '2B', row: kind, gstin: String(ctin || '').toUpperCase(), name: trdnm || '', inv: num, key: k.invKey(num), tail: k.invTail(num), date: dd(x.idt || x.ntdt || x.dt), txval: sign * (Number(x.txval) || 0), igst: sign * (Number(x.igst) || 0), cgst: sign * (Number(x.cgst) || 0), sgst: sign * (Number(x.sgst) || 0), cess: sign * (Number(x.cess) || 0), tax: 0, note: kind === 'CDNR' ? 'credit/debit note' : '' }));
    };
    for (const sec of ['b2b', 'b2ba']) for (const s of (root[sec] || [])) for (const inv of (s.inv || [])) push(s.ctin, s.trdnm, inv, 1, 'B2B');
    for (const sec of ['cdnr', 'cdnra']) for (const s of (root[sec] || [])) for (const nt of (s.nt || [])) push(s.ctin, s.trdnm, nt, (nt.typ === 'D' ? 1 : -1), 'CDNR');
    return out;
  }

  /** Match books to 2B. Returns { matched, mismatched, only2b, onlyBooks }. */
  function reconcile(b2b, books, tol) {
    const k = K();
    const T = { tax: 1, days: 5, txval: 1 };
    const used2b = new Set(), usedBk = new Set();
    const matched = [], mismatched = [];
    const byKey = new Map();
    b2b.forEach((d, i) => { const key = d.gstin + '|' + d.key; if (!byKey.has(key)) byKey.set(key, []); byKey.get(key).push(i); });
    const pair = (bi, ti) => {
      const b = books[bi], t = b2b[ti];
      usedBk.add(bi); used2b.add(ti);
      const dTax = Math.round((b.tax - t.tax) * 100) / 100, dTx = Math.round((b.txval - t.txval) * 100) / 100;
      const days = (b.date && t.date) ? k.dayDiff(b.date, t.date) : null;
      const row = { gstin: t.gstin, supplier: t.name || b.name, invoice_books: b.inv, invoice_2b: t.inv, date_books: b.date, date_2b: t.date, taxable_books: b.txval, taxable_2b: t.txval, tax_books: b.tax, tax_2b: t.tax, difference_tax: dTax, difference_taxable: dTx, days_apart: days, note: t.note };
      if (Math.abs(dTax) <= T.tax && Math.abs(dTx) <= T.txval) { row.status = 'Matched'; matched.push(row); }
      else { row.status = Math.abs(dTax) > T.tax ? 'Tax differs' : 'Taxable value differs'; mismatched.push(row); }
    };
    /* pass 1: exact key */
    books.forEach((b, bi) => {
      const c = (byKey.get(b.gstin + '|' + b.key) || []).find(ti => !used2b.has(ti));
      if (c !== undefined) pair(bi, c);
    });
    /* pass 2: same supplier, numeric tail, date near, taxable near */
    books.forEach((b, bi) => {
      if (usedBk.has(bi)) return;
      let best = -1, bestScore = Infinity;
      b2b.forEach((t, ti) => {
        if (used2b.has(ti) || t.gstin !== b.gstin) return;
        if (t.tail !== b.tail && Math.abs(t.txval - b.txval) > T.txval) return;
        const days = (b.date && t.date) ? k.dayDiff(b.date, t.date) : 99;
        if (days > T.days) return;
        const score = days + Math.abs(t.txval - b.txval) / 1000 + (t.tail === b.tail ? 0 : 3);
        if (score < bestScore) { bestScore = score; best = ti; }
      });
      if (best >= 0) pair(bi, best);
    });
    const only2b = b2b.filter((t, ti) => !used2b.has(ti)).map(t => ({ gstin: t.gstin, supplier: t.name, invoice: t.inv, date: t.date, taxable: t.txval, igst: t.igst, cgst: t.cgst, sgst: t.sgst, cess: t.cess, tax: t.tax, note: t.note || 'in 2B, not in books' }));
    const onlyBooks = books.filter((b, bi) => !usedBk.has(bi)).map(b => ({ row: b.row, gstin: b.gstin, supplier: b.name, invoice: b.inv, date: b.date, taxable: b.txval, igst: b.igst, cgst: b.cgst, sgst: b.sgst, cess: b.cess, tax: b.tax, note: b.gstin ? 'in books, not in 2B — supplier has not filed' : 'no GSTIN in books' }));
    return { matched, mismatched, only2b, onlyBooks };
  }

  function mount(root) {
    const k = K(); const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const state = { b2b: null, books: null, mapB: {}, mapR: {}, headersB: [], rowsB: [], headersR: [], rowsR: [], jsonDocs: null };
    const msg = k.msgBox();
    const two = k.el('div', 'biz-two');

    const colA = k.el('div', 'biz-col');
    colA.appendChild(k.h3('1 · GSTR-2B from the portal'));
    const dropA = k.dropzone('Choose GSTR-2B (JSON or Excel)', '.json,.xlsx,.csv', async (f) => {
      try {
        msg.say('Reading 2B…', 'note');
        if (/\.json$/i.test(f.name)) { state.jsonDocs = docsFromJson(JSON.parse(await f.text())); state.headersB = []; state.rowsB = []; mapA.innerHTML = ''; dropA.say(f.name, state.jsonDocs.length + ' documents (B2B + credit notes)'); }
        else { const t = await k.readTable(f); const h = k.splitHeader(t.sheets.find(s => /b2b/i.test(s.name)) ? t.sheets.find(s => /b2b/i.test(s.name)).rows : t.sheets[0].rows); state.headersB = h.headers; state.rowsB = h.rows; state.jsonDocs = null; state.mapB = k.autoMap(F2B, h.headers); mapA.innerHTML = ''; mapA.appendChild(k.mapPanel('2B columns', F2B, h.headers, state.mapB)); dropA.say(f.name, h.rows.length + ' rows'); }
        msg.say('');
      } catch (e) { msg.say('2B: ' + e.message, 'error'); }
    });
    colA.appendChild(dropA);
    const mapA = k.el('div'); colA.appendChild(mapA);

    const colB = k.el('div', 'biz-col');
    colB.appendChild(k.h3('2 · Your purchase register'));
    const dropB = k.dropzone('Choose the purchase register (Excel or CSV)', '.xlsx,.csv', async (f) => {
      try {
        msg.say('Reading register…', 'note');
        const t = await k.readTable(f); const h = k.splitHeader(t.sheets[0].rows);
        state.headersR = h.headers; state.rowsR = h.rows; state.mapR = k.autoMap(FREG, h.headers);
        mapB.innerHTML = ''; mapB.appendChild(k.mapPanel('Register columns', FREG, h.headers, state.mapR)); dropB.say(f.name, h.rows.length + ' rows'); msg.say('');
      } catch (e) { msg.say('Register: ' + e.message, 'error'); }
    });
    colB.appendChild(dropB);
    const mapB = k.el('div'); colB.appendChild(mapB);
    two.appendChild(colA); two.appendChild(colB); io.appendChild(two);

    const run = k.el('div', 'io-actions pdf-run');
    run.appendChild(k.button('Reconcile', 'btn-primary', go));
    io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    function go() {
      result.innerHTML = '';
      let b2b;
      if (state.jsonDocs) b2b = state.jsonDocs;
      else if (state.rowsB.length) {
        const miss = k.missing(F2B, state.mapB); if (miss.length) { msg.say('2B: map ' + miss.join(', ') + ' first.', 'error'); return; }
        const get = (r, key) => state.mapB[key] === undefined ? '' : r[state.mapB[key]];
        b2b = state.rowsB.map((r, i) => withTax(doc('2B', r, get, i)));
      } else { msg.say('Choose the GSTR-2B file first.', 'note'); return; }
      if (!state.rowsR.length) { msg.say('Choose the purchase register.', 'note'); return; }
      const missR = k.missing(FREG, state.mapR); if (missR.length) { msg.say('Register: map ' + missR.join(', ') + ' first.', 'error'); return; }
      const getR = (r, key) => state.mapR[key] === undefined ? '' : r[state.mapR[key]];
      const books = state.rowsR.map((r, i) => withTax(doc('books', r, getR, i)));
      const badGstin = books.filter(b => !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(b.gstin)).length;

      const R = reconcile(b2b, books);
      const sum = (list, f) => Math.round(list.reduce((s, x) => s + (Number(x[f]) || 0), 0) * 100) / 100;
      const itc2b = sum(b2b, 'tax'), itcBooks = sum(books, 'tax'), safe = sum(R.matched, 'tax_2b'), risk = sum(R.onlyBooks, 'tax'), unbooked = sum(R.only2b, 'tax'), diff = sum(R.mismatched, 'difference_tax');
      const summaryRows = [['Measure', 'Amount (₹)', 'Documents'], ['ITC as per GSTR-2B', itc2b, b2b.length], ['ITC as per purchase register', itcBooks, books.length], ['Matched — safe to claim', safe, R.matched.length], ['Amount mismatches (books minus 2B, tax)', diff, R.mismatched.length], ['Only in books — supplier not filed, at risk', risk, R.onlyBooks.length], ['Only in 2B — not recorded in books', unbooked, R.only2b.length]];
      const S = k.S();
      const sheets = [{ name: 'Summary', rows: summaryRows }, { name: 'Matched', rows: S.objectsToRows(R.matched) }, { name: 'Mismatched', rows: S.objectsToRows(R.mismatched) }, { name: 'Only in 2B', rows: S.objectsToRows(R.only2b) }, { name: 'Only in books', rows: S.objectsToRows(R.onlyBooks) }];
      result.appendChild(k.summaryCard('Reconciled: ' + R.matched.length + ' matched, ' + R.mismatched.length + ' differ, ' + R.onlyBooks.length + ' not filed, ' + R.only2b.length + ' unbooked',
        'Safe ITC ' + k.inr(safe) + ' · at risk ' + k.inr(risk) + ' · not yet booked ' + k.inr(unbooked), [k.downloadButton('gstr2b-reconciliation.xlsx', () => S.writeXlsx(sheets)), k.downloadButton('only-in-books.csv', () => new Blob([S.toCSV(sheets[4].rows)], { type: 'text/csv' }), false)]));
      result.appendChild(k.statGrid(summaryRows.slice(1).map(r => [r[0], k.inr(r[1]) + ' · ' + r[2]])));
      if (badGstin) result.appendChild(k.issues([badGstin + ' register row(s) have a malformed or missing GSTIN and can only match by nothing — they appear under Only in books.'], 'warning'));
      for (const [title, rows] of [['Only in books — chase these suppliers', sheets[4].rows], ['Mismatched', sheets[2].rows], ['Only in 2B', sheets[3].rows], ['Matched', sheets[1].rows]]) {
        if (rows.length > 1) { result.appendChild(k.h3(title + ' (' + (rows.length - 1) + ')')); result.appendChild(k.previewTable(rows, 15)); }
      }
      msg.say('');
      result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="gst-reconciler"]'); if (r) mount(r); });
  window.MVRGstRecon = { reconcile, docsFromJson };
})();
