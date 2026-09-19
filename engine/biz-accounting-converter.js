/**
 * Between accounting packages.
 *
 * QuickBooks and Zoho Books import and export CSV; Tally imports and exports
 * XML. The shapes differ but the content is the same thing — a voucher is a
 * date, a number, a narration and lines that sum to zero — so everything
 * goes through that one intermediate and out the other side. The Tally
 * builders and parser come from the Excel-to-Tally converter, loaded here
 * for its functions only. On the device throughout.
 */
(function () {
  'use strict';
  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['accounting-converter'] = {
    title: 'QuickBooks / Zoho Books / Tally Converter',
    short: 'Accounting Converter',
    description: 'Move journals and invoices between QuickBooks, Zoho Books and Tally: a QuickBooks or Zoho journal CSV becomes Tally vouchers, a Zoho invoice export becomes Tally sales vouchers, and a Tally day-book export becomes the journal CSV QuickBooks or Zoho imports. Every voucher is checked to balance. Runs in your browser.',
    keywords: ['quickbooks to tally', 'zoho books to tally', 'tally to quickbooks', 'tally to zoho books', 'accounting data migration', 'journal csv converter', 'switch from tally to zoho'],
    glyph: 'i-acct-convert',
    glyphSvg: '<symbol id="i-acct-convert" viewBox="0 0 24 24">\n  <rect x="3" y="4" width="7.5" height="7.5" rx="1.5"/>\n  <rect x="13.5" y="12.5" width="7.5" height="7.5" rx="1.5"/>\n  <path d="M14 7.75h4.5a1.5 1.5 0 0 1 1.5 1.5v2.5M17.5 10l2.5 2-2.5 2" class="thin"/>\n  <path d="M10 16.25H5.5A1.5 1.5 0 0 1 4 14.75v-2.5M6.5 14l-2.5-2 2.5-2" class="thin"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/biz-tally-converter.js', '/engine/biz-accounting-converter.js'],
    tips: ['QuickBooks journal export: Reports → Journal → Export to Excel; the columns are Date, Transaction Type, Num, Name, Memo, Account, Debit, Credit. Its import wants the same shape with a JournalNo, which is what this writes.', 'Zoho Books: Reports → Journal Report → Export, or Sales → Invoices → Export as CSV for invoices. The manual-journal import wants Journal Date, Journal Number, Account, Debit, Credit, Description.', 'Tally: export the Day Book as XML (Alt+E, XML) for the way out; for the way in, import the file this makes with Gateway of Tally → Import → Vouchers.', 'Ledger and account names travel as they are. Where the two packages spell an account differently — "Sales" and "Sales Accounts" — rename in a spreadsheet first or after; the tool does not guess.', 'Every voucher is checked to sum to zero before it is written, and an unbalanced one is reported by number rather than silently dropped.'],
    faq: [{ q: 'Which direction and which documents?', a: 'Journals in every direction between the three, and Zoho invoices into Tally sales vouchers (party debited, sales and tax ledgers credited by rate). Invoices into QuickBooks or Zoho need their invoice import format with items and customers, which is a bigger job — say if you need it.' }, { q: 'Will the imported entries look right?', a: 'They will balance and carry the date, number, narration and lines. What each package does with an unknown account name differs: QuickBooks and Zoho create or ask; Tally refuses the import until the ledger exists. Check account names first.' }, { q: 'Is my accounting data uploaded?', a: 'No. Files are read, converted and written in your browser.' }]
  };
  if (typeof document === 'undefined') return;
  const K = () => window.MVRBizKit; const T = () => window.MVRTally;

  const JOURNAL = [
    { key: 'vno', label: 'Journal / transaction number', need: true, aliases: ['journalno', 'journalnumber', 'num', 'no', 'number', 'transactionno', 'refno', 'entryno', 'voucherno', 'vchno'] },
    { key: 'date', label: 'Date', need: true, aliases: ['date', 'journaldate', 'transactiondate', 'txndate'] },
    { key: 'ledger', label: 'Account', need: true, aliases: ['account', 'accountname', 'ledger', 'ledgername', 'accountfullname', 'glaccount'] },
    { key: 'debit', label: 'Debit', aliases: ['debit', 'debits', 'dr', 'debitamount'] },
    { key: 'credit', label: 'Credit', aliases: ['credit', 'credits', 'cr', 'creditamount'] },
    { key: 'amount', label: 'Amount (signed, if no Dr/Cr)', aliases: ['amount', 'amt'] },
    { key: 'narration', label: 'Memo / description', aliases: ['memo', 'description', 'narration', 'memodescription', 'notes'] },
    { key: 'name', label: 'Name / contact', aliases: ['name', 'contact', 'contactname', 'customer', 'vendor', 'party'] },
    { key: 'vtype', label: 'Transaction type', aliases: ['transactiontype', 'type', 'vouchertype', 'journaltype'] }
  ];
  const ZOHO_INV = [
    { key: 'inv', label: 'Invoice number', need: true, aliases: ['invoicenumber', 'invoiceno', 'invoice'] },
    { key: 'date', label: 'Invoice date', need: true, aliases: ['invoicedate', 'date'] },
    { key: 'party', label: 'Customer name', need: true, aliases: ['customername', 'customer', 'displayname', 'party'] },
    { key: 'item', label: 'Item name', aliases: ['itemname', 'item', 'productname', 'description'] },
    { key: 'qty', label: 'Quantity', aliases: ['quantity', 'qty'] },
    { key: 'price', label: 'Item price', aliases: ['itemprice', 'rate', 'price', 'unitprice'] },
    { key: 'total', label: 'Item total (before tax)', need: true, aliases: ['itemtotal', 'amount', 'subtotal', 'linetotal', 'taxableamount'] },
    { key: 'taxpct', label: 'Item tax %', aliases: ['itemtax', 'itemtaxpercent', 'taxpercentage', 'taxrate', 'gstrate'] },
    { key: 'taxamt', label: 'Item tax amount', aliases: ['itemtaxamount', 'taxamount', 'tax'] },
    { key: 'pos', label: 'Place of supply / state', aliases: ['placeofsupply', 'pos', 'state', 'gsttreatment'] }
  ];

  const r2 = (n) => Math.round(n * 100) / 100;

  /** QuickBooks/Zoho journal rows -> vouchers (lines mode via the Tally converter). */
  function journalToVouchers(rows, map, defType) {
    const k = K();
    const get = (r, key) => map[key] === undefined ? '' : r[map[key]];
    /* reshape into what MVRTally.linesToVouchers expects: a map onto columns */
    const cols = ['vno', 'date', 'vtype', 'ledger', 'debit', 'credit', 'amount', 'narration'];
    const shaped = rows.map(r => cols.map(c => c === 'vtype' ? (get(r, 'vtype') || '') : get(r, c)));
    const m = {}; cols.forEach((c, i) => { if (c === 'vtype' || map[c] !== undefined) m[c] = i; });
    if (map.debit === undefined && map.credit === undefined) { delete m.debit; delete m.credit; } else { delete m.amount; }
    const out = T().linesToVouchers(shaped, m, { dayFirst: true, defaultType: defType || 'Journal' });
    /* a Name that is also one of the voucher's ledgers is a party: creditor if credited, debtor if debited */
    const names = new Set(rows.map(r => String(get(r, 'name') || '').trim()).filter(Boolean));
    out.parties = out.parties || new Map();
    for (const v of out.vouchers) for (const l of v.lines) if (names.has(l.ledger) && !out.parties.has(l.ledger)) out.parties.set(l.ledger, l.amount > 0 ? 'Sundry Creditors' : 'Sundry Debtors');
    return out;
  }

  /** Zoho invoice rows -> Sales vouchers: party Dr total, Sales Cr taxable, tax ledgers Cr by rate. */
  function zohoInvoicesToVouchers(rows, map, opt) {
    const k = K(); const get = (r, key) => map[key] === undefined ? '' : r[map[key]];
    const groups = new Map(); const issues = [];
    rows.forEach((r, i) => { const inv = String(get(r, 'inv')).trim(); if (!inv) { issues.push('Row ' + (i + 2) + ': no invoice number.'); return; } if (!groups.has(inv)) groups.set(inv, { row: i + 2, rows: [] }); groups.get(inv).rows.push(r); });
    const vouchers = []; const parties = new Map();
    for (const [inv, g] of groups) {
      const r0 = g.rows[0]; const date = T().toTallyDate(get(r0, 'date'), true); if (!date) { issues.push('Invoice ' + inv + ': date not readable.'); continue; }
      const party = String(get(r0, 'party')).trim(); if (!party) { issues.push('Invoice ' + inv + ': no customer.'); continue; }
      let taxable = 0; const taxByRate = {};
      for (const r of g.rows) {
        const t = k.toNumber(get(r, 'total')); if (!Number.isFinite(t)) { issues.push('Invoice ' + inv + ': item total not a number.'); continue; }
        taxable += t;
        let ta = k.toNumber(get(r, 'taxamt')); const pct = k.toNumber(get(r, 'taxpct'));
        if (!Number.isFinite(ta) || (ta === 0 && Number.isFinite(pct) && pct > 0)) ta = r2(t * (Number.isFinite(pct) ? pct : 0) / 100);
        if (ta) { const key = Number.isFinite(pct) && pct ? pct : 'tax'; taxByRate[key] = r2((taxByRate[key] || 0) + ta); }
      }
      taxable = r2(taxable); const tax = r2(Object.values(taxByRate).reduce((a, b) => a + b, 0)); const total = r2(taxable + tax);
      const lines = [{ ledger: party, amount: -total }, { ledger: opt.sales || 'Sales', amount: taxable }];
      const interstate = opt.igst === 'auto' ? /igst|inter|other/i.test(String(get(r0, 'pos'))) : opt.igst === 'yes';
      for (const [rate, amt] of Object.entries(taxByRate)) {
        if (interstate) lines.push({ ledger: (opt.igstLedger || 'IGST') + (rate !== 'tax' ? ' ' + rate + '%' : ''), amount: amt });
        else { const half = r2(amt / 2); lines.push({ ledger: (opt.cgstLedger || 'CGST') + (rate !== 'tax' ? ' ' + (rate / 2) + '%' : ''), amount: half }); lines.push({ ledger: (opt.sgstLedger || 'SGST') + (rate !== 'tax' ? ' ' + (rate / 2) + '%' : ''), amount: r2(amt - half) }); }
      }
      const sum = r2(lines.reduce((s, l) => s + l.amount, 0)); if (Math.abs(sum) > 0.011) { issues.push('Invoice ' + inv + ': does not balance by ' + sum + '.'); continue; }
      parties.set(party, 'Sundry Debtors');
      vouchers.push({ row: g.row, date, type: 'Sales', vno: inv, party, narration: 'Invoice ' + inv + (get(r0, 'item') ? ' — ' + g.rows.map(r => get(r, 'item')).filter(Boolean).slice(0, 3).join(', ') : ''), ref: inv, lines, total });
    }
    return { vouchers, issues, parties };
  }

  /** Tally day-book XML -> journal rows in a package's shape. */
  function tallyToJournal(xmlText, target) {
    const parsed = T().tallyToRows(xmlText, 'lines');
    if (parsed.kind !== 'lines') throw new Error('This Tally file holds masters, not vouchers.');
    const rows = parsed.rows.slice(1); /* Voucher No, Date, Type, Party, Ledger, Debit, Credit, Narration */
    const iso = (d) => d;
    const usd = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d); return m ? m[2] + '/' + m[3] + '/' + m[1] : d; };
    if (target === 'quickbooks') return [['*JournalNo', '*JournalDate', '*Currency', 'Memo', '*AccountName', 'Debits', 'Credits', 'Description', 'Name', 'Location', 'Class']].concat(rows.map(r => [r[0], usd(r[1]), 'INR', r[7], r[4], r[5] === '' ? '' : r[5], r[6] === '' ? '' : r[6], r[7], r[3], '', '']));
    return [['Journal Date', 'Journal Number', 'Reference Number', 'Notes', 'Account', 'Debit', 'Credit', 'Description', 'Contact Name', 'Currency']].concat(rows.map(r => [iso(r[1]), r[0], r[0], r[7], r[4], r[5] === '' ? '' : r[5], r[6] === '' ? '' : r[6], r[7], r[3], 'INR']));
  }

  function mount(root) {
    const k = K(); const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const st = { headers: [], rows: [], map: {}, xml: '', name: '' }; const msg = k.msgBox();
    const dir = k.select('ac-dir', [
      { value: 'qb2tally', label: 'QuickBooks journal CSV → Tally vouchers XML' },
      { value: 'zohojournal2tally', label: 'Zoho Books journal CSV → Tally vouchers XML' },
      { value: 'zohoinv2tally', label: 'Zoho Books invoices CSV → Tally sales vouchers XML' },
      { value: 'tally2qb', label: 'Tally day-book XML → QuickBooks journal CSV' },
      { value: 'tally2zoho', label: 'Tally day-book XML → Zoho Books journal CSV' }
    ], 'qb2tally');
    const bar = k.el('div', 'opt-bar'); bar.appendChild(k.field('Conversion', dir)); io.appendChild(bar);
    const mapBox = k.el('div');
    const drop = k.dropzone('Choose the export file', '.csv,.xlsx,.xml', async (f) => {
      try {
        msg.say('Reading…', 'note'); st.name = f.name;
        if (/\.xml$/i.test(f.name)) { const buf = await f.arrayBuffer(); const u8 = new Uint8Array(buf); const enc = (u8[0] === 0xff && u8[1] === 0xfe) ? 'utf-16le' : (u8[0] === 0x3c && u8[1] === 0x00) ? 'utf-16le' : 'utf-8'; st.xml = new TextDecoder(enc).decode(u8).replace(/^﻿/, '').replace(/^(<\?xml[^>]*?)\sencoding="[^"]*"/i, '$1').replace(/&#(x[0-9a-fA-F]+|[0-9]+);/g, (m, c) => { const n = c[0] === 'x' ? parseInt(c.slice(1), 16) : parseInt(c, 10); return (n < 32 && n !== 9 && n !== 10 && n !== 13) ? '' : m; }); st.rows = []; mapBox.innerHTML = ''; drop.say(f.name, 'Tally XML, ' + (st.xml.match(/<VOUCHER\b/g) || []).length + ' vouchers'); }
        else { const t = await k.readTable(f); const h = k.splitHeader(t.sheets[0].rows); st.headers = h.headers; st.rows = h.rows; st.xml = ''; const fields = dir.value === 'zohoinv2tally' ? ZOHO_INV : JOURNAL; st.map = k.autoMap(fields, h.headers); mapBox.innerHTML = ''; mapBox.appendChild(k.mapPanel('Columns', fields, h.headers, st.map)); drop.say(f.name, h.rows.length + ' rows'); }
        msg.say('');
      } catch (e) { msg.say(e.message, 'error'); }
    });
    io.appendChild(drop); io.appendChild(mapBox);
    const opts = k.el('div', 'opt-bar');
    const company = k.textInput('ac-company', '', 'Leave blank to import into the open company'), sales = k.textInput('ac-sales', 'Sales', 'Sales'), igst = k.select('ac-igst', [{ value: 'auto', label: 'Decide from place of supply' }, { value: 'no', label: 'CGST + SGST' }, { value: 'yes', label: 'IGST' }], 'auto'), defType = k.select('ac-type', [{ value: 'Journal', label: 'Journal' }, { value: 'Payment', label: 'Payment' }, { value: 'Receipt', label: 'Receipt' }, { value: 'Contra', label: 'Contra' }], 'Journal');
    opts.appendChild(k.field('Tally company name', company)); opts.appendChild(k.field('Sales ledger (invoices)', sales)); opts.appendChild(k.field('Tax on invoices', igst)); opts.appendChild(k.field('Voucher type when the file does not say', defType));
    io.appendChild(opts);
    dir.addEventListener('change', () => { if (st.rows.length) { const fields = dir.value === 'zohoinv2tally' ? ZOHO_INV : JOURNAL; st.map = k.autoMap(fields, st.headers); mapBox.innerHTML = ''; mapBox.appendChild(k.mapPanel('Columns', fields, st.headers, st.map)); } });
    const run = k.el('div', 'io-actions pdf-run'); run.appendChild(k.button('Convert', 'btn-primary', go)); io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    function go() {
      result.innerHTML = ''; const S = k.S();
      try {
        const d = dir.value;
        if (d === 'tally2qb' || d === 'tally2zoho') {
          if (!st.xml) { msg.say('Choose a Tally XML export first.', 'note'); return; }
          const rows = tallyToJournal(st.xml, d === 'tally2qb' ? 'quickbooks' : 'zoho');
          const name = (d === 'tally2qb' ? 'quickbooks-journal' : 'zoho-journal');
          result.appendChild(k.summaryCard((rows.length - 1) + ' journal lines for ' + (d === 'tally2qb' ? 'QuickBooks' : 'Zoho Books'), 'from ' + st.name, [k.downloadButton(name + '.csv', () => new Blob([S.toCSV(rows)], { type: 'text/csv' })), k.downloadButton(name + '.xlsx', () => S.writeXlsx(rows, 'Journal'), false)]));
          result.appendChild(k.h3('Preview')); result.appendChild(k.previewTable(rows, 20));
        } else {
          if (!st.rows.length) { msg.say('Choose the CSV or Excel export first.', 'note'); return; }
          const fields = d === 'zohoinv2tally' ? ZOHO_INV : JOURNAL;
          const miss = k.missing(fields, st.map); if (miss.length) { msg.say('Map ' + miss.join(', ') + ' first.', 'error'); return; }
          const out = d === 'zohoinv2tally' ? zohoInvoicesToVouchers(st.rows, st.map, { sales: sales.value.trim(), igst: igst.value }) : journalToVouchers(st.rows, st.map, defType.value);
          if (!out.vouchers.length) { msg.say('No voucher could be built. ' + (out.issues[0] || ''), 'error'); if (out.issues.length) result.appendChild(k.issues(out.issues)); return; }
          const xml = T().envelope('Vouchers', company.value.trim(), out.vouchers.map(T().voucherXml).join(''));
          const buttons = [k.downloadButton(st.name.replace(/\.[^.]+$/, '') + '-tally.xml', () => new Blob([xml], { type: 'application/xml' }))];
          if (out.parties && out.parties.size) buttons.push(k.downloadButton('party-ledgers.xml', () => new Blob([T().envelope('All Masters', company.value.trim(), [...out.parties].map(([name, parent]) => T().ledgerXml({ name, parent })).join(''))], { type: 'application/xml' }), false));
          result.appendChild(k.summaryCard(out.vouchers.length + ' Tally voucher' + (out.vouchers.length === 1 ? '' : 's'), 'total ' + k.inr(out.vouchers.reduce((s, v) => s + v.total, 0)) + (out.issues.length ? ' · ' + out.issues.length + ' skipped' : ''), buttons));
          if (out.issues.length) result.appendChild(k.issues(out.issues, 'row skipped'));
          const prev = out.vouchers.map(v => ({ no: v.vno, date: v.date.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'), type: v.type, party: v.party, debit_lines: v.lines.filter(l => l.amount < 0).map(l => l.ledger + ' ' + k.money(-l.amount)).join('; '), credit_lines: v.lines.filter(l => l.amount > 0).map(l => l.ledger + ' ' + k.money(l.amount)).join('; ') }));
          result.appendChild(k.h3('Vouchers')); result.appendChild(k.previewTable(S.objectsToRows(prev), 20));
          const pre = k.el('pre', 'code-out biz-xml'); pre.textContent = xml.length > 20000 ? xml.slice(0, 20000) + '\n…' : xml; result.appendChild(k.h3('The XML')); result.appendChild(pre);
        }
        msg.say(''); result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) { msg.say(e.message, 'error'); }
    }
  }
  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="accounting-converter"]'); if (r) mount(r); });
  window.MVRAcctConvert = { journalToVouchers, zohoInvoicesToVouchers, tallyToJournal };
})();
