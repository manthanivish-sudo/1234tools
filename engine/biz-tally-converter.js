/**
 * Spreadsheet <-> Tally converter.
 *
 * Excel or CSV in, Tally import XML out — vouchers, ledger masters, stock
 * items — and Tally's exported XML back into a spreadsheet. Everything runs
 * in the page: the workbook is unzipped and parsed here, the XML is written
 * here, nothing is uploaded.
 *
 * Two things this file is careful about, because they are where every
 * spreadsheet-to-Tally tool goes wrong:
 *
 * Sign convention. In Tally's XML a debit is a NEGATIVE amount and a credit
 * is positive, and every voucher must sum to zero. A Sales invoice debits
 * the party and credits Sales and the taxes; a Purchase does the reverse. The
 * generator builds each voucher from that rule and refuses to write one that
 * does not balance, naming the row.
 *
 * Dates. Excel stores a date as a serial number, Indian spreadsheets write
 * them as DD/MM/YYYY, exports write YYYY-MM-DD, and Tally wants YYYYMMDD.
 * All four are read; the preview shows what each row was taken to mean.
 */
(function () {
  'use strict';

  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  const SPEC = window.BIZ_TOOLS['tally-converter'] = {
    title: 'Excel / CSV to Tally Converter',
    short: 'Excel to Tally',
    description: 'Turn a spreadsheet of sales, purchases, receipts and payments into Tally import XML — vouchers, party ledgers and stock items — and bring Tally’s exported XML back into Excel. Runs in your browser; nothing is uploaded.',
    keywords: ['excel to tally', 'csv to tally xml', 'tally import xml', 'tally xml to excel', 'bulk voucher import tally', 'tally prime import', 'ledger import tally', 'stock item import'],
    glyph: 'i-tally',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-tally-converter.js'],
    tips: [
      'Column names are matched automatically — “Invoice No”, “Vch No” and “Voucher Number” all land on Voucher No — and you can correct any match before converting. Save a mapping once and it is remembered on this device.',
      'One row per voucher is the simplest layout: date, type, number, party, amount, and the tax columns you use. The tool debits and credits the right ledgers for Sales, Purchase, Receipt, Payment, Journal and Contra.',
      'One row per ledger line suits exports from other software: a voucher number to group by, a ledger, and Debit and Credit columns. Every voucher is checked to balance before anything is written.',
      'Tick “Create missing party ledgers” and the download includes a second file of ledger masters — import that first, then the vouchers, and Tally will not stop on an unknown party.',
      'Import into a test company first. The XML is built to Tally’s documented structure and checked for balance, but Tally’s own validation — ledger names, GST classifications, voucher numbering rules — runs only when it imports.',
      'Bringing data out: export from Tally with Gateway of Tally → Display → Day Book (or Ledger), Alt+E, format XML. Drop that file here and download it as Excel or CSV, one row per voucher or per ledger line.'
    ],
    faq: [
      { q: 'Is my accounting data uploaded anywhere?', a: 'No. The spreadsheet is unzipped and read by your own browser, the XML is written by your own browser, and the download comes from memory. Nothing is transmitted — which is why this works with the network off and why it is safe for a client’s books.' },
      { q: 'How do I import the XML into Tally?', a: 'Tally Prime: Gateway of Tally → Import → Vouchers (or Masters), choose the file, keep “Combine opening balances” for masters, and import. Tally ERP 9: Gateway of Tally → Import Data → Vouchers. Open the company you want the entries in first: the file carries no company name unless you type one in the options.' },
      { q: 'Tally says a ledger does not exist. What now?', a: 'Every ledger named in a voucher must already exist in the company — the party, the sales or purchase account, the tax ledgers, the bank. Tick “Create missing party ledgers” to get a masters file for the parties, import it first, and make sure your account and tax ledgers are spelled exactly as they are in Tally, including capitals.' },
      { q: 'Why does a voucher fail the balance check?', a: 'In Tally every voucher’s debits equal its credits. In one-row-per-voucher mode the tool works that out for you from the amount and taxes. In one-row-per-line mode it adds up your Debit and Credit columns for each voucher number and stops if they differ by more than a paisa — usually a missing line, a typo in a voucher number, or a rounding difference that needs a Round Off line.' },
      { q: 'Does it handle GST?', a: 'Sales and purchase vouchers carry CGST, SGST and IGST as separate ledger lines when you map those columns, so the amounts land on your tax ledgers exactly as typed. It does not calculate tax for you, and it does not write the GST classification details a stock item needs for Tally’s returns beyond HSN and rate — check those in Tally after import.' },
      { q: 'Which Tally versions?', a: 'The XML follows the Import Data envelope that Tally ERP 9 and Tally Prime both read. It has been checked for structure and balance, not imported into every release of Tally, so the first run should go into a test company.' }
    ]
  };

  /* Everything below needs a page. build-biz.js loads this file in Node to
     read the SPEC above, and must stop here. */
  if (typeof document === 'undefined') return;

  /* ------------------------------------------------------------------ */
  /* helpers                                                            */
  /* ------------------------------------------------------------------ */

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const fmtBytes = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
  const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  /* CSV, ZIP and XLSX live in engine/sheet.js, shared with the AI tools. */
  const S = () => { if (!window.MVRSheet) throw new Error('The spreadsheet reader did not load.'); return window.MVRSheet; };
  const download = (blob, name) => S().download(blob, name);
  const parseCSV = (text, delim) => S().parseCSV(text, delim);
  const sniffDelim = (text) => S().sniffDelim(text);
  const toCSV = (rows) => S().toCSV(rows);
  const readXlsx = (buf) => S().readXlsx(buf);
  const writeXlsx = (rows, name) => S().writeXlsx(rows, name);
  const colName = (i) => S().colName(i);

  /* ---------- dates ---------- */

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const pad = (n) => String(n).padStart(2, '0');

  /** Anything a spreadsheet might hold -> YYYYMMDD, or null. */
  function toTallyDate(v, dayFirst) {
    if (v === '' || v == null) return null;
    if (typeof v === 'number') {
      if (v > 20000 && v < 80000) {          /* Excel serial */
        const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
        return '' + d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
      }
      if (/^\d{8}$/.test(String(v))) return String(v);
      return null;
    }
    const s = String(v).trim();
    let m;
    if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s))) return m[1] + pad(m[2]) + pad(m[3]);
    if ((m = /^(\d{8})$/.exec(s))) return m[1];
    if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s))) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      const a = Number(m[1]), b = Number(m[2]);
      /* 13/04 can only be day-first; 04/13 can only be month-first; otherwise the setting decides */
      const dayFirstHere = a > 12 ? true : b > 12 ? false : dayFirst;
      return dayFirstHere ? y + pad(b) + pad(a) : y + pad(a) + pad(b);
    }
    if ((m = /^(\d{1,2})[-\s]([A-Za-z]{3,4})[-\s,]*(\d{2,4})/.exec(s))) {
      const mo = MONTHS[m[2].toLowerCase()]; if (!mo) return null;
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return y + pad(mo) + pad(m[1]);
    }
    if ((m = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/.exec(s))) {
      const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]; if (!mo) return null;
      return m[3] + pad(mo) + pad(m[2]);
    }
    const d = new Date(s);
    if (!isNaN(d)) return '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    return null;
  }
  const fromTallyDate = (s) => /^\d{8}$/.test(s) ? s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6) : s;

  function toNumber(v) {
    if (typeof v === 'number') return v;
    const s = String(v == null ? '' : v).trim().replace(/[,\s₹Rs.]/gi, (m) => (m === '.' ? '.' : ''));
    if (s === '') return 0;
    const neg = /^\(.*\)$/.test(s) || /(dr|cr)$/i.test(s) && /dr$/i.test(s) ? -1 : 1;
    const n = Number(s.replace(/[()]/g, '').replace(/(dr|cr)$/i, ''));
    return Number.isFinite(n) ? n * (neg < 0 && !/^\(/.test(s) ? 1 : neg) : NaN;
  }

  /* ------------------------------------------------------------------ */
  /* what a spreadsheet can describe                                    */
  /* ------------------------------------------------------------------ */

  /* Each target field: what it is called on screen, the header names that
     mean it in the wild, whether a row can do without it. */
  const FIELDS = {
    vouchers: [
      { key: 'date', label: 'Date', need: true, aliases: ['date', 'vchdate', 'voucherdate', 'invoicedate', 'billdate', 'trandate', 'transactiondate', 'dt'] },
      { key: 'vtype', label: 'Voucher type', aliases: ['vouchertype', 'vchtype', 'type', 'vouchertypename', 'txntype', 'transactiontype'] },
      { key: 'vno', label: 'Voucher No', aliases: ['voucherno', 'vchno', 'vouchernumber', 'invoiceno', 'invoicenumber', 'billno', 'billnumber', 'refno', 'number', 'no', 'invno', 'docno'] },
      { key: 'party', label: 'Party ledger', need: true, aliases: ['party', 'partyname', 'partyledger', 'partyledgername', 'customer', 'customername', 'supplier', 'suppliername', 'vendor', 'vendorname', 'ledgername', 'name', 'account', 'accountname', 'client'] },
      { key: 'amount', label: 'Amount (before tax)', need: true, aliases: ['amount', 'taxableamount', 'taxablevalue', 'basicamount', 'baseamount', 'netamount', 'value', 'subtotal', 'amt', 'grossamount', 'total', 'totalamount'] },
      { key: 'account', label: 'Sales / purchase / bank ledger', aliases: ['account', 'ledger', 'salesledger', 'purchaseledger', 'bankledger', 'cashbank', 'againstledger', 'incomeaccount', 'expenseaccount', 'glaccount', 'head'] },
      { key: 'cgst', label: 'CGST', aliases: ['cgst', 'cgstamount', 'cgstamt', 'centraltax'] },
      { key: 'sgst', label: 'SGST', aliases: ['sgst', 'sgstamount', 'sgstamt', 'statetax', 'utgst'] },
      { key: 'igst', label: 'IGST', aliases: ['igst', 'igstamount', 'igstamt', 'integratedtax'] },
      { key: 'round', label: 'Round off', aliases: ['roundoff', 'rounding', 'roundedoff', 'ro'] },
      { key: 'narration', label: 'Narration', aliases: ['narration', 'description', 'remarks', 'memo', 'notes', 'particulars', 'details'] },
      { key: 'ref', label: 'Reference / bill ref', aliases: ['reference', 'ref', 'billref', 'poNo', 'pono', 'ordernumber', 'orderno', 'chequeno', 'chqno', 'utr'] }
    ],
    lines: [
      { key: 'vno', label: 'Voucher No (groups the lines)', need: true, aliases: ['voucherno', 'vchno', 'vouchernumber', 'invoiceno', 'billno', 'refno', 'number', 'no', 'docno', 'entryno', 'journalno'] },
      { key: 'date', label: 'Date', need: true, aliases: ['date', 'vchdate', 'voucherdate', 'trandate', 'transactiondate', 'dt'] },
      { key: 'vtype', label: 'Voucher type', aliases: ['vouchertype', 'vchtype', 'type', 'vouchertypename'] },
      { key: 'ledger', label: 'Ledger', need: true, aliases: ['ledger', 'ledgername', 'account', 'accountname', 'glaccount', 'particulars', 'head', 'name'] },
      { key: 'debit', label: 'Debit', aliases: ['debit', 'dr', 'debitamount', 'dramount', 'debitamt'] },
      { key: 'credit', label: 'Credit', aliases: ['credit', 'cr', 'creditamount', 'cramount', 'creditamt'] },
      { key: 'amount', label: 'Amount (signed, if no Dr/Cr columns)', aliases: ['amount', 'amt', 'value'] },
      { key: 'drcr', label: 'Dr/Cr marker column', aliases: ['drcr', 'crdr', 'side', 'debitcredit', 'type2'] },
      { key: 'narration', label: 'Narration', aliases: ['narration', 'description', 'remarks', 'memo', 'notes', 'details'] }
    ],
    ledgers: [
      { key: 'name', label: 'Ledger name', need: true, aliases: ['name', 'ledgername', 'ledger', 'party', 'partyname', 'customer', 'supplier', 'account', 'accountname'] },
      { key: 'parent', label: 'Group (Sundry Debtors, Sundry Creditors…)', aliases: ['group', 'parent', 'under', 'ledgergroup', 'accountgroup', 'category'] },
      { key: 'gstin', label: 'GSTIN', aliases: ['gstin', 'gstno', 'gstnumber', 'gst', 'gstinuin'] },
      { key: 'state', label: 'State', aliases: ['state', 'statename', 'placeofsupply'] },
      { key: 'address', label: 'Address', aliases: ['address', 'address1', 'addr', 'billingaddress', 'street'] },
      { key: 'address2', label: 'Address line 2', aliases: ['address2', 'addr2', 'city', 'town'] },
      { key: 'pincode', label: 'PIN code', aliases: ['pincode', 'pin', 'postcode', 'zip', 'zipcode'] },
      { key: 'phone', label: 'Phone', aliases: ['phone', 'mobile', 'contact', 'contactno', 'phoneno', 'mobileno', 'tel'] },
      { key: 'email', label: 'Email', aliases: ['email', 'emailid', 'mail'] },
      { key: 'pan', label: 'PAN', aliases: ['pan', 'panno', 'pannumber'] },
      { key: 'opening', label: 'Opening balance (Dr negative / Cr positive)', aliases: ['openingbalance', 'opening', 'openingbal', 'balance', 'obal'] },
      { key: 'credit', label: 'Credit period (days)', aliases: ['creditperiod', 'creditdays', 'terms', 'paymentterms'] }
    ],
    items: [
      { key: 'name', label: 'Item name', need: true, aliases: ['name', 'itemname', 'item', 'stockitem', 'product', 'productname', 'description', 'sku'] },
      { key: 'unit', label: 'Unit (Nos, Kg, Pcs…)', need: true, aliases: ['unit', 'units', 'uom', 'baseunit', 'baseunits', 'measure'] },
      { key: 'parent', label: 'Stock group', aliases: ['group', 'stockgroup', 'parent', 'under', 'category', 'itemgroup'] },
      { key: 'hsn', label: 'HSN / SAC', aliases: ['hsn', 'hsncode', 'sac', 'saccode', 'hsnsac'] },
      { key: 'rate', label: 'GST rate %', aliases: ['gstrate', 'gst', 'taxrate', 'rate', 'gstpercent', 'tax'] },
      { key: 'qty', label: 'Opening quantity', aliases: ['openingqty', 'openingquantity', 'qty', 'quantity', 'openingstock', 'stock'] },
      { key: 'price', label: 'Opening rate (per unit)', aliases: ['openingrate', 'price', 'costprice', 'purchaseprice', 'unitprice', 'unitcost'] },
      { key: 'partno', label: 'Part number', aliases: ['partno', 'partnumber', 'code', 'itemcode', 'productcode', 'barcode'] }
    ]
  };

  const VTYPES = ['Sales', 'Purchase', 'Receipt', 'Payment', 'Journal', 'Contra', 'Credit Note', 'Debit Note'];
  function canonVType(s) {
    const n = norm(s);
    if (!n) return null;
    if (/^(sales?|inv(oice)?|salesinvoice|taxinvoice)$/.test(n)) return 'Sales';
    if (/^(purchases?|purchaseinvoice|bill|purchasebill)$/.test(n)) return 'Purchase';
    if (/^(receipts?|rcpt|collection|moneyin|rec)$/.test(n)) return 'Receipt';
    if (/^(payments?|pymt|pay|moneyout|expense)$/.test(n)) return 'Payment';
    if (/^(journal|jv|jrnl|adjustment)$/.test(n)) return 'Journal';
    if (/^(contra|transfer|banktransfer)$/.test(n)) return 'Contra';
    if (/^(creditnote|cn|salesreturn)$/.test(n)) return 'Credit Note';
    if (/^(debitnote|dn|purchasereturn)$/.test(n)) return 'Debit Note';
    return null;
  }

  /** Guess a mapping from the header row. */
  function autoMap(kind, headers) {
    const map = {};
    const used = new Set();
    const normed = headers.map((h) => norm(h));
    for (const f of FIELDS[kind]) {
      let hit = -1;
      for (const a of f.aliases) {
        const i = normed.findIndex((h, idx) => h === a && !used.has(idx));
        if (i >= 0) { hit = i; break; }
      }
      if (hit < 0) {
        /* a header that starts with the alias, e.g. "Amount (INR)" */
        for (const a of f.aliases) {
          const i = normed.findIndex((h, idx) => h.startsWith(a) && !used.has(idx) && a.length >= 3);
          if (i >= 0) { hit = i; break; }
        }
      }
      if (hit >= 0) { map[f.key] = hit; used.add(hit); }
    }
    return map;
  }

  /* ------------------------------------------------------------------ */
  /* building Tally XML                                                 */
  /* ------------------------------------------------------------------ */

  const envelope = (report, company, messages) =>
    '<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n <HEADER>\n  <TALLYREQUEST>Import Data</TALLYREQUEST>\n </HEADER>\n <BODY>\n  <IMPORTDATA>\n   <REQUESTDESC>\n    <REPORTNAME>' + report + '</REPORTNAME>\n' +
    (company ? '    <STATICVARIABLES>\n     <SVCURRENTCOMPANY>' + xmlEsc(company) + '</SVCURRENTCOMPANY>\n    </STATICVARIABLES>\n' : '') +
    '   </REQUESTDESC>\n   <REQUESTDATA>\n' + messages + '   </REQUESTDATA>\n  </IMPORTDATA>\n </BODY>\n</ENVELOPE>\n';

  const ledgerLine = (name, amount) =>
    '      <ALLLEDGERENTRIES.LIST>\n       <LEDGERNAME>' + xmlEsc(name) + '</LEDGERNAME>\n       <ISDEEMEDPOSITIVE>' + (amount < 0 ? 'Yes' : 'No') + '</ISDEEMEDPOSITIVE>\n       <AMOUNT>' + money(amount) + '</AMOUNT>\n      </ALLLEDGERENTRIES.LIST>\n';

  function voucherXml(v) {
    let x = '    <TALLYMESSAGE xmlns:UDF="TallyUDF">\n     <VOUCHER VCHTYPE="' + xmlEsc(v.type) + '" ACTION="Create" OBJVIEW="Accounting Voucher View">\n' +
      '      <DATE>' + v.date + '</DATE>\n      <EFFECTIVEDATE>' + v.date + '</EFFECTIVEDATE>\n      <VOUCHERTYPENAME>' + xmlEsc(v.type) + '</VOUCHERTYPENAME>\n';
    if (v.vno) x += '      <VOUCHERNUMBER>' + xmlEsc(v.vno) + '</VOUCHERNUMBER>\n';
    if (v.ref) x += '      <REFERENCE>' + xmlEsc(v.ref) + '</REFERENCE>\n';
    if (v.party) x += '      <PARTYLEDGERNAME>' + xmlEsc(v.party) + '</PARTYLEDGERNAME>\n';
    if (v.narration) x += '      <NARRATION>' + xmlEsc(v.narration) + '</NARRATION>\n';
    x += '      <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>\n';
    for (const l of v.lines) x += ledgerLine(l.ledger, l.amount);
    x += '     </VOUCHER>\n    </TALLYMESSAGE>\n';
    return x;
  }

  function ledgerXml(l) {
    let x = '    <TALLYMESSAGE xmlns:UDF="TallyUDF">\n     <LEDGER NAME="' + xmlEsc(l.name) + '" ACTION="Create">\n' +
      '      <NAME.LIST>\n       <NAME>' + xmlEsc(l.name) + '</NAME>\n      </NAME.LIST>\n      <PARENT>' + xmlEsc(l.parent || 'Sundry Debtors') + '</PARENT>\n';
    const party = /sundry/i.test(l.parent || 'Sundry Debtors');
    x += '      <ISBILLWISEON>' + (party ? 'Yes' : 'No') + '</ISBILLWISEON>\n';
    if (l.address || l.address2) {
      x += '      <ADDRESS.LIST TYPE="String">\n';
      if (l.address) x += '       <ADDRESS>' + xmlEsc(l.address) + '</ADDRESS>\n';
      if (l.address2) x += '       <ADDRESS>' + xmlEsc(l.address2) + '</ADDRESS>\n';
      x += '      </ADDRESS.LIST>\n';
    }
    if (l.state) x += '      <LEDSTATENAME>' + xmlEsc(l.state) + '</LEDSTATENAME>\n';
    if (l.pincode) x += '      <PINCODE>' + xmlEsc(l.pincode) + '</PINCODE>\n';
    if (l.gstin) x += '      <PARTYGSTIN>' + xmlEsc(l.gstin) + '</PARTYGSTIN>\n      <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>\n';
    if (l.pan) x += '      <INCOMETAXNUMBER>' + xmlEsc(l.pan) + '</INCOMETAXNUMBER>\n';
    if (l.phone) x += '      <LEDGERMOBILE>' + xmlEsc(l.phone) + '</LEDGERMOBILE>\n';
    if (l.email) x += '      <EMAIL>' + xmlEsc(l.email) + '</EMAIL>\n';
    if (l.credit) x += '      <CREDITPERIOD>' + xmlEsc(String(l.credit).replace(/[^0-9]/g, '')) + ' Days</CREDITPERIOD>\n';
    x += '      <OPENINGBALANCE>' + money(Number(l.opening) || 0) + '</OPENINGBALANCE>\n';
    x += '     </LEDGER>\n    </TALLYMESSAGE>\n';
    return x;
  }

  function itemXml(it) {
    let x = '    <TALLYMESSAGE xmlns:UDF="TallyUDF">\n     <STOCKITEM NAME="' + xmlEsc(it.name) + '" ACTION="Create">\n' +
      '      <NAME.LIST>\n       <NAME>' + xmlEsc(it.name) + '</NAME>\n      </NAME.LIST>\n';
    if (it.parent) x += '      <PARENT>' + xmlEsc(it.parent) + '</PARENT>\n';
    x += '      <BASEUNITS>' + xmlEsc(it.unit) + '</BASEUNITS>\n';
    if (it.partno) x += '      <PARTNO>' + xmlEsc(it.partno) + '</PARTNO>\n';
    const rate = Number(it.rate);
    if (it.hsn || (Number.isFinite(rate) && it.rate !== '')) {
      x += '      <GSTAPPLICABLE>&#4; Applicable</GSTAPPLICABLE>\n      <GSTDETAILS.LIST>\n       <APPLICABLEFROM>20170701</APPLICABLEFROM>\n';
      if (it.hsn) x += '       <HSNCODE>' + xmlEsc(it.hsn) + '</HSNCODE>\n';
      x += '       <TAXABILITY>' + (rate > 0 ? 'Taxable' : 'Exempt') + '</TAXABILITY>\n';
      if (rate > 0) {
        x += '       <STATEWISEDETAILS.LIST>\n        <STATENAME>&#4; Any</STATENAME>\n' +
          '        <RATEDETAILS.LIST>\n         <GSTRATEDUTYHEAD>Central Tax</GSTRATEDUTYHEAD>\n         <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>\n         <GSTRATE>' + (rate / 2) + '</GSTRATE>\n        </RATEDETAILS.LIST>\n' +
          '        <RATEDETAILS.LIST>\n         <GSTRATEDUTYHEAD>State Tax</GSTRATEDUTYHEAD>\n         <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>\n         <GSTRATE>' + (rate / 2) + '</GSTRATE>\n        </RATEDETAILS.LIST>\n' +
          '        <RATEDETAILS.LIST>\n         <GSTRATEDUTYHEAD>Integrated Tax</GSTRATEDUTYHEAD>\n         <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>\n         <GSTRATE>' + rate + '</GSTRATE>\n        </RATEDETAILS.LIST>\n' +
          '       </STATEWISEDETAILS.LIST>\n';
      }
      x += '      </GSTDETAILS.LIST>\n';
    }
    const qty = Number(it.qty);
    if (Number.isFinite(qty) && it.qty !== '' && qty !== 0) {
      x += '      <OPENINGBALANCE>' + qty + ' ' + xmlEsc(it.unit) + '</OPENINGBALANCE>\n';
      const price = Number(it.price);
      if (Number.isFinite(price) && it.price !== '') {
        x += '      <OPENINGRATE>' + money(price) + '/' + xmlEsc(it.unit) + '</OPENINGRATE>\n      <OPENINGVALUE>' + money(-(qty * price)) + '</OPENINGVALUE>\n';
      }
    }
    x += '     </STOCKITEM>\n    </TALLYMESSAGE>\n';
    return x;
  }

  /* ---------- from rows to vouchers ---------- */

  /**
   * One row = one voucher. Returns { vouchers, issues, parties }, where an
   * issue names the row it came from and the voucher it stopped.
   */
  function rowsToVouchers(rows, map, opt) {
    const vouchers = [], issues = [];
    const parties = new Map();     /* name -> group */
    const get = (r, k) => (map[k] === undefined || map[k] === '' ? '' : r[map[k]] ?? '');
    rows.forEach((r, i) => {
      const rowNo = i + 2;                   /* 1-based, after the header */
      if (r.every(v => v === '' || v == null)) return;
      const date = toTallyDate(get(r, 'date'), opt.dayFirst);
      if (!date) { issues.push('Row ' + rowNo + ': the date "' + get(r, 'date') + '" could not be read.'); return; }
      const type = canonVType(get(r, 'vtype')) || opt.defaultType;
      if (!type) { issues.push('Row ' + rowNo + ': voucher type "' + get(r, 'vtype') + '" is not one Tally knows, and no default is set.'); return; }
      const party = String(get(r, 'party')).trim();
      if (!party) { issues.push('Row ' + rowNo + ': no party ledger.'); return; }
      const amount = toNumber(get(r, 'amount'));
      if (!Number.isFinite(amount)) { issues.push('Row ' + rowNo + ': the amount "' + get(r, 'amount') + '" is not a number.'); return; }
      const tax = { cgst: toNumber(get(r, 'cgst')), sgst: toNumber(get(r, 'sgst')), igst: toNumber(get(r, 'igst')), round: toNumber(get(r, 'round')) };
      for (const k of Object.keys(tax)) if (!Number.isFinite(tax[k])) { issues.push('Row ' + rowNo + ': ' + k.toUpperCase() + ' "' + get(r, k) + '" is not a number.'); return; }
      const account = String(get(r, 'account')).trim() || opt.accounts[type] || '';
      if (!account) { issues.push('Row ' + rowNo + ': no ' + (type === 'Receipt' || type === 'Payment' || type === 'Contra' ? 'bank/cash' : type.toLowerCase()) + ' ledger — map a column or set a default below.'); return; }

      const total = amount + tax.cgst + tax.sgst + tax.igst + tax.round;
      const lines = [];
      /* debit negative, credit positive */
      const partyDr = (type === 'Sales' || type === 'Debit Note' || type === 'Payment');
      const partyAmt = partyDr ? -total : total;
      lines.push({ ledger: party, amount: partyAmt });
      lines.push({ ledger: account, amount: partyDr ? amount : -amount });
      const taxLedger = { cgst: opt.taxLedgers.cgst, sgst: opt.taxLedgers.sgst, igst: opt.taxLedgers.igst, round: opt.taxLedgers.round };
      for (const k of ['cgst', 'sgst', 'igst', 'round']) {
        if (Math.abs(tax[k]) < 0.005) continue;
        lines.push({ ledger: taxLedger[k], amount: partyDr ? tax[k] : -tax[k] });
      }
      const sum = lines.reduce((s, l) => s + l.amount, 0);
      if (Math.abs(sum) > 0.011) { issues.push('Row ' + rowNo + ': does not balance by ' + money(sum) + '.'); return; }

      const group = (type === 'Sales' || type === 'Receipt' || type === 'Credit Note') ? 'Sundry Debtors' : 'Sundry Creditors';
      if (!parties.has(party)) parties.set(party, group);
      vouchers.push({ row: rowNo, date, type, vno: String(get(r, 'vno')).trim(), party, narration: String(get(r, 'narration')).trim(), ref: String(get(r, 'ref')).trim(), lines, total });
    });
    return { vouchers, issues, parties };
  }

  /** One row = one ledger line; rows group into vouchers by number. */
  function linesToVouchers(rows, map, opt) {
    const issues = [];
    const groups = new Map();
    const get = (r, k) => (map[k] === undefined || map[k] === '' ? '' : r[map[k]] ?? '');
    rows.forEach((r, i) => {
      const rowNo = i + 2;
      if (r.every(v => v === '' || v == null)) return;
      const vno = String(get(r, 'vno')).trim();
      if (!vno) { issues.push('Row ' + rowNo + ': no voucher number to group by.'); return; }
      const ledger = String(get(r, 'ledger')).trim();
      if (!ledger) { issues.push('Row ' + rowNo + ': no ledger.'); return; }
      let amount;
      if (map.debit !== undefined || map.credit !== undefined) {
        const dr = toNumber(get(r, 'debit')), cr = toNumber(get(r, 'credit'));
        if (!Number.isFinite(dr) || !Number.isFinite(cr)) { issues.push('Row ' + rowNo + ': debit/credit is not a number.'); return; }
        amount = cr - dr;
      } else {
        amount = toNumber(get(r, 'amount'));
        if (!Number.isFinite(amount)) { issues.push('Row ' + rowNo + ': amount is not a number.'); return; }
        const side = norm(get(r, 'drcr'));
        if (side === 'dr' || side === 'debit') amount = -Math.abs(amount);
        else if (side === 'cr' || side === 'credit') amount = Math.abs(amount);
      }
      if (!groups.has(vno)) {
        const date = toTallyDate(get(r, 'date'), opt.dayFirst);
        if (!date) { issues.push('Row ' + rowNo + ': the date "' + get(r, 'date') + '" could not be read.'); return; }
        const type = canonVType(get(r, 'vtype')) || opt.defaultType;
        if (!type) { issues.push('Row ' + rowNo + ': voucher type "' + get(r, 'vtype') + '" is not one Tally knows, and no default is set.'); return; }
        groups.set(vno, { row: rowNo, date, type, vno, party: '', narration: String(get(r, 'narration')).trim(), ref: '', lines: [], total: 0 });
      }
      const g = groups.get(vno);
      g.lines.push({ ledger, amount });
      if (!g.narration) g.narration = String(get(r, 'narration')).trim();
    });
    const vouchers = [];
    for (const g of groups.values()) {
      const sum = g.lines.reduce((s, l) => s + l.amount, 0);
      if (Math.abs(sum) > 0.011) { issues.push('Voucher ' + g.vno + ' (from row ' + g.row + '): debits and credits differ by ' + money(Math.abs(sum)) + '.'); continue; }
      const first = g.lines.find(l => (g.type === 'Sales' || g.type === 'Payment') ? l.amount < 0 : l.amount > 0) || g.lines[0];
      g.party = first.ledger;
      g.total = g.lines.filter(l => l.amount < 0).reduce((s, l) => s - l.amount, 0);
      vouchers.push(g);
    }
    return { vouchers, issues, parties: new Map() };
  }

  /* ---------- from Tally XML to rows ---------- */

  function decodeXmlBytes(buf) {
    const u8 = new Uint8Array(buf);
    let enc = 'utf-8';
    if (u8[0] === 0xff && u8[1] === 0xfe) enc = 'utf-16le';
    else if (u8[0] === 0xfe && u8[1] === 0xff) enc = 'utf-16be';
    else if (u8.length > 3 && u8[0] === 0x3c && u8[1] === 0x00) enc = 'utf-16le';   /* "<\0" with no BOM */
    let text = new TextDecoder(enc).decode(u8);
    /* the declaration's encoding is about bytes we have already decoded */
    text = text.replace(/^﻿/, '').replace(/^(<\?xml[^>]*?)\sencoding="[^"]*"/i, '$1');
    /* Tally writes "&#4; Primary" and friends: control characters no XML
       parser will accept, as entities or raw. They carry no meaning a
       spreadsheet needs, so they go, and the space after them with them. */
    text = text.replace(/&#(x[0-9a-fA-F]+|[0-9]+);/g, (m, code) => {
      const n = code[0] === 'x' ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return (n < 32 && n !== 9 && n !== 10 && n !== 13) ? '' : m;
    }).replace(/[ --]/g, '');
    return text;
  }

  const t1 = (node, tag) => { const c = node.getElementsByTagName(tag)[0]; return c ? c.textContent.trim() : ''; };
  /* direct children only, so a voucher's own tag is not confused with one inside its lines */
  const own = (node, tag) => { for (const c of node.children) if (c.tagName === tag) return c.textContent.trim(); return ''; };

  function tallyToRows(xmlText, mode) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('This file is not well-formed XML. Tally’s export sometimes contains a stray control character; open it in a text editor and check the line the parser complains about.');
    const vouchers = [...doc.getElementsByTagName('VOUCHER')];
    const ledgers = [...doc.getElementsByTagName('LEDGER')].filter(l => l.getAttribute('NAME') || l.getElementsByTagName('NAME').length);
    const items = [...doc.getElementsByTagName('STOCKITEM')];

    if (vouchers.length) {
      const entriesOf = (v) => [...v.children].filter(c => c.tagName === 'ALLLEDGERENTRIES.LIST' || c.tagName === 'LEDGERENTRIES.LIST');
      if (mode === 'voucher') {
        const rows = [['Date', 'Voucher Type', 'Voucher No', 'Party', 'Amount', 'Narration', 'Reference', 'Ledger lines']];
        for (const v of vouchers) {
          const es = entriesOf(v);
          const drTotal = es.reduce((s, e) => { const a = Number(t1(e, 'AMOUNT')) || 0; return a < 0 ? s - a : s; }, 0);
          rows.push([fromTallyDate(own(v, 'DATE')), own(v, 'VOUCHERTYPENAME') || v.getAttribute('VCHTYPE') || '', own(v, 'VOUCHERNUMBER'), own(v, 'PARTYLEDGERNAME'), Math.round(drTotal * 100) / 100, own(v, 'NARRATION'), own(v, 'REFERENCE'),
            es.map(e => t1(e, 'LEDGERNAME') + ' ' + (Number(t1(e, 'AMOUNT')) < 0 ? 'Dr ' : 'Cr ') + Math.abs(Number(t1(e, 'AMOUNT')) || 0)).join('; ')]);
        }
        return { kind: 'vouchers', rows };
      }
      const rows = [['Voucher No', 'Date', 'Voucher Type', 'Party', 'Ledger', 'Debit', 'Credit', 'Narration']];
      for (const v of vouchers) {
        for (const e of entriesOf(v)) {
          const a = Number(t1(e, 'AMOUNT')) || 0;
          rows.push([own(v, 'VOUCHERNUMBER'), fromTallyDate(own(v, 'DATE')), own(v, 'VOUCHERTYPENAME') || v.getAttribute('VCHTYPE') || '', own(v, 'PARTYLEDGERNAME'), t1(e, 'LEDGERNAME'), a < 0 ? -a : '', a > 0 ? a : '', own(v, 'NARRATION')]);
        }
      }
      return { kind: 'lines', rows };
    }
    if (ledgers.length) {
      const rows = [['Ledger', 'Group', 'Opening balance', 'GSTIN', 'State', 'Address', 'PIN', 'Phone', 'Email', 'PAN']];
      for (const l of ledgers) {
        const name = (l.getAttribute('NAME') || t1(l, 'NAME')).trim();
        const addr = [...l.getElementsByTagName('ADDRESS')].map(a => a.textContent.trim()).filter(Boolean).join(', ');
        const ob = Number(own(l, 'OPENINGBALANCE'));
        rows.push([name, own(l, 'PARENT'), Number.isFinite(ob) ? ob : own(l, 'OPENINGBALANCE'), own(l, 'PARTYGSTIN') || own(l, 'GSTIN'), own(l, 'LEDSTATENAME'), addr, own(l, 'PINCODE'), own(l, 'LEDGERMOBILE') || own(l, 'LEDGERPHONE'), own(l, 'EMAIL'), own(l, 'INCOMETAXNUMBER')]);
      }
      return { kind: 'ledgers', rows };
    }
    if (items.length) {
      const rows = [['Item', 'Stock group', 'Unit', 'HSN', 'Opening balance', 'Opening rate', 'Part no']];
      for (const it of items) rows.push([(it.getAttribute('NAME') || t1(it, 'NAME')).trim(), own(it, 'PARENT'), own(it, 'BASEUNITS'), t1(it, 'HSNCODE'), own(it, 'OPENINGBALANCE'), own(it, 'OPENINGRATE'), own(it, 'PARTNO')]);
      return { kind: 'items', rows };
    }
    throw new Error('No vouchers, ledgers or stock items found. Export from Tally as XML (Alt+E on Day Book, Ledger or List of Accounts) rather than as HTML or PDF.');
  }

  /* ------------------------------------------------------------------ */
  /* the page                                                           */
  /* ------------------------------------------------------------------ */

  const STORE = '1234tools-tally-mappings';
  const loadSaved = () => { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (e) { return []; } };
  const storeSaved = (list) => { try { localStorage.setItem(STORE, JSON.stringify(list)); } catch (e) { /* private mode */ } };

  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';

    /* direction */
    const seg = el('div', 'biz-seg');
    seg.setAttribute('role', 'tablist');
    const tabIn = el('button', 'biz-seg-btn is-on', 'Spreadsheet → Tally');
    const tabOut = el('button', 'biz-seg-btn', 'Tally → Spreadsheet');
    [tabIn, tabOut].forEach(b => { b.type = 'button'; b.setAttribute('role', 'tab'); seg.appendChild(b); });
    io.appendChild(seg);

    const paneIn = el('div', 'biz-pane');
    const paneOut = el('div', 'biz-pane');
    paneOut.hidden = true;
    io.appendChild(paneIn);
    io.appendChild(paneOut);
    tabIn.addEventListener('click', () => { tabIn.classList.add('is-on'); tabOut.classList.remove('is-on'); paneIn.hidden = false; paneOut.hidden = true; });
    tabOut.addEventListener('click', () => { tabOut.classList.add('is-on'); tabIn.classList.remove('is-on'); paneOut.hidden = false; paneIn.hidden = true; });

    mountToTally(paneIn);
    mountFromTally(paneOut);
  }

  /* shared bits of UI */
  function dropzone(label, accept, multiple, onFiles) {
    const drop = el('div', 'dropzone');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    const setLabel = (strong, small) => { drop.innerHTML = '<strong>' + strong + '</strong><span>' + small + '</span>'; drop.appendChild(input); };
    const input = el('input', 'visually-hidden');
    input.type = 'file'; input.accept = accept; if (multiple) input.multiple = true;
    setLabel(label, 'or drag it here — nothing is uploaded');
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); });
    input.addEventListener('change', () => { if (input.files.length) onFiles(input.files); });
    drop.setLabel = setLabel;
    return drop;
  }
  function field(label, control, hint) {
    const w = el('div', 'field');
    const l = el('label', null, label);
    if (control.id) l.setAttribute('for', control.id);
    w.appendChild(l); w.appendChild(control);
    if (hint) w.appendChild(el('span', 'field-hint', hint));
    return w;
  }
  function select(id, options, value) {
    const s = el('select', 'control'); s.id = id;
    for (const o of options) { const op = el('option', null, o.label); op.value = o.value; if (String(o.value) === String(value)) op.selected = true; s.appendChild(op); }
    return s;
  }
  function textInput(id, value, placeholder) {
    const i = el('input', 'control'); i.type = 'text'; i.id = id; i.value = value || ''; if (placeholder) i.placeholder = placeholder;
    return i;
  }
  function msgBox() { const m = el('div', 'io-msg'); m.say = (t, k) => { m.textContent = t || ''; m.className = 'io-msg' + (k ? ' is-' + k : ''); }; return m; }

  function summaryCard(title, meta, buttons) {
    const s = el('div', 'result-summary');
    const head = el('div', 'result-summary-head');
    head.appendChild(el('span', 'result-summary-tick', '✓'));
    const what = el('div', 'result-summary-what');
    what.appendChild(el('strong', 'result-summary-name', title));
    what.appendChild(el('span', 'result-summary-meta', meta));
    head.appendChild(what);
    s.appendChild(head);
    const acts = el('div', 'result-summary-actions');
    buttons.forEach(b => acts.appendChild(b));
    s.appendChild(acts);
    return s;
  }
  function button(label, cls, fn) { const b = el('button', cls || 'btn-primary', label); b.type = 'button'; b.addEventListener('click', fn); return b; }

  function previewTable(rows, max) {
    const wrap = el('div', 'table-scroll biz-preview');
    const t = el('table', 'biz-table');
    const head = rows[0] || [];
    const thead = el('thead'); const tr = el('tr');
    head.forEach(h => tr.appendChild(el('th', null, String(h))));
    thead.appendChild(tr); t.appendChild(thead);
    const tb = el('tbody');
    rows.slice(1, 1 + max).forEach(r => { const tr2 = el('tr'); head.forEach((h, i) => tr2.appendChild(el('td', null, r[i] == null ? '' : String(r[i])))); tb.appendChild(tr2); });
    t.appendChild(tb); wrap.appendChild(t);
    if (rows.length - 1 > max) wrap.appendChild(el('p', 'biz-more', (rows.length - 1 - max).toLocaleString('en-GB') + ' more rows not shown'));
    return wrap;
  }

  /* ---------- spreadsheet -> tally ---------- */

  function mountToTally(pane) {
    let sheets = null, sheetIdx = 0, headers = [], rows = [], fileName = '';
    let kind = 'vouchers', mode = 'voucher';
    let map = {};

    const msg = msgBox();
    const drop = dropzone('Choose a spreadsheet', '.xlsx,.csv,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', false, async (files) => {
      const f = files[0];
      try {
        msg.say('Reading…', 'note');
        fileName = f.name;
        if (/\.xlsx$/i.test(f.name)) sheets = await readXlsx(await f.arrayBuffer());
        else {
          const text = await f.text();
          sheets = [{ name: f.name, rows: parseCSV(text, sniffDelim(text)) }];
        }
        sheetIdx = 0;
        drop.setLabel(f.name, 'click to choose another');
        msg.say('');
        takeSheet();
      } catch (e) { msg.say(e.message || String(e), 'error'); }
    });
    pane.appendChild(drop);

    const sheetRow = el('div', 'opt-bar'); sheetRow.hidden = true;
    pane.appendChild(sheetRow);

    const kindBar = el('div', 'opt-bar');
    const kindSel = select('tc-kind', [
      { value: 'vouchers', label: 'Vouchers — one row per voucher' },
      { value: 'lines', label: 'Vouchers — one row per ledger line' },
      { value: 'ledgers', label: 'Ledger masters (parties, accounts)' },
      { value: 'items', label: 'Stock items' }
    ], 'vouchers');
    kindBar.appendChild(field('What the rows are', kindSel));
    const saved = select('tc-saved', [{ value: '', label: '—' }], '');
    const savedField = field('Saved mapping', saved, 'Remembered on this device');
    kindBar.appendChild(savedField);
    pane.appendChild(kindBar);
    kindSel.addEventListener('change', () => { kind = kindSel.value; mode = kind === 'lines' ? 'lines' : 'voucher'; if (headers.length) { map = autoMap(kind === 'lines' ? 'lines' : kind, headers); renderMap(); } refreshSaved(); });

    const mapBox = el('div', 'biz-map'); mapBox.hidden = true;
    pane.appendChild(mapBox);

    const optBox = el('div', 'opt-bar biz-opts'); optBox.hidden = true;
    const company = textInput('tc-company', '', 'Leave blank to import into the open company');
    const dayFirst = select('tc-dayfirst', [{ value: 'dmy', label: 'Day first (31/03/2026)' }, { value: 'mdy', label: 'Month first (03/31/2026)' }], 'dmy');
    const defType = select('tc-deftype', [{ value: '', label: 'Take from the Voucher type column' }].concat(VTYPES.map(v => ({ value: v, label: v }))), '');
    const accSales = textInput('tc-acc-sales', 'Sales', 'Sales');
    const accPurchase = textInput('tc-acc-purchase', 'Purchase', 'Purchase');
    const accBank = textInput('tc-acc-bank', 'Cash', 'Cash or a bank ledger');
    const accJournal = textInput('tc-acc-journal', '', 'Debit ledger for journals');
    const cgst = textInput('tc-cgst', 'CGST', 'CGST');
    const sgst = textInput('tc-sgst', 'SGST', 'SGST');
    const igst = textInput('tc-igst', 'IGST', 'IGST');
    const roundL = textInput('tc-round', 'Round Off', 'Round Off');
    const makeParties = select('tc-parties', [{ value: 'yes', label: 'Yes — give me a masters file too' }, { value: 'no', label: 'No — they already exist in Tally' }], 'yes');
    const ledgerGroup = textInput('tc-lgroup', 'Sundry Debtors', 'Sundry Debtors');
    const itemGroup = textInput('tc-igroup', '', 'Primary');
    [
      field('Company name', company, 'Written into the file as SVCURRENTCOMPANY'),
      field('Dates like 03/04/2026 mean', dayFirst),
      field('Voucher type', defType),
      field('Sales ledger', accSales, 'Used when no ledger column is mapped'),
      field('Purchase ledger', accPurchase),
      field('Cash / bank ledger', accBank, 'For receipts, payments and contra'),
      field('Journal debit ledger', accJournal),
      field('CGST ledger', cgst), field('SGST ledger', sgst), field('IGST ledger', igst), field('Round off ledger', roundL),
      field('Create missing party ledgers', makeParties),
      field('Ledgers go under', ledgerGroup, 'For ledger masters with no group column'),
      field('Stock items go under', itemGroup, 'For stock items with no group column')
    ].forEach(f => optBox.appendChild(f));
    pane.appendChild(optBox);

    const previewBox = el('div', 'biz-preview-box'); previewBox.hidden = true;
    pane.appendChild(previewBox);

    const runBar = el('div', 'io-actions pdf-run');
    const runBtn = button('Convert to Tally XML', 'btn-primary', () => convert());
    const saveBtn = button('Save this mapping', 'btn-ghost', () => saveMapping());
    runBar.appendChild(runBtn); runBar.appendChild(saveBtn);
    pane.appendChild(runBar);
    pane.appendChild(msg);
    const result = el('div', 'biz-result');
    pane.appendChild(result);

    function takeSheet() {
      sheetRow.innerHTML = '';
      if (sheets.length > 1) {
        const s = select('tc-sheet', sheets.map((sh, i) => ({ value: i, label: sh.name + ' (' + Math.max(0, sh.rows.length - 1) + ' rows)' })), sheetIdx);
        s.addEventListener('change', () => { sheetIdx = Number(s.value); takeSheet(); });
        sheetRow.appendChild(field('Sheet', s));
        sheetRow.hidden = false;
      } else sheetRow.hidden = true;
      const sh = sheets[sheetIdx];
      /* the header is the first row with at least two filled cells */
      const hi = sh.rows.findIndex(r => r.filter(v => v !== '').length >= 2);
      if (hi < 0) { msg.say('The sheet has no header row.', 'error'); return; }
      headers = sh.rows[hi].map(h => String(h).trim());
      rows = sh.rows.slice(hi + 1);
      /* guess what the rows are from the headers */
      const n = headers.map(norm);
      if (n.some(h => /^(debit|dr|credit|cr)$/.test(h)) && n.some(h => /voucherno|vchno|vouchernumber|entryno|journalno/.test(h))) kind = 'lines';
      else if (n.some(h => /^(unit|uom|baseunit|hsn|hsncode)$/.test(h))) kind = 'items';
      else if (n.some(h => /^(gstin|group|parent|under)$/.test(h)) && !n.some(h => /amount|amt|value|total/.test(h))) kind = 'ledgers';
      else kind = 'vouchers';
      kindSel.value = kind;
      mode = kind === 'lines' ? 'lines' : 'voucher';
      map = autoMap(kind === 'lines' ? 'lines' : kind, headers);
      refreshSaved();
      renderMap();
      optBox.hidden = false;
      previewBox.hidden = true; result.innerHTML = '';
      msg.say(rows.length.toLocaleString('en-GB') + ' data rows, ' + headers.length + ' columns. Check the matches below, then convert.', 'note');
    }

    function renderMap() {
      mapBox.innerHTML = '';
      mapBox.hidden = false;
      const fk = kind === 'lines' ? 'lines' : kind;
      mapBox.appendChild(el('p', 'biz-map-title', 'Which column is which'));
      const grid = el('div', 'biz-map-grid');
      for (const f of FIELDS[fk]) {
        const s = select('tc-map-' + f.key, [{ value: '', label: f.need ? '— required —' : '— not in this sheet —' }].concat(headers.map((h, i) => ({ value: i, label: h || ('Column ' + colName(i)) }))), map[f.key] === undefined ? '' : map[f.key]);
        s.addEventListener('change', () => { if (s.value === '') delete map[f.key]; else map[f.key] = Number(s.value); previewBox.hidden = true; });
        const w = field(f.label + (f.need ? ' *' : ''), s);
        if (f.need && map[f.key] === undefined) w.classList.add('is-missing');
        grid.appendChild(w);
      }
      mapBox.appendChild(grid);
      /* only the settings that matter for this kind */
      const showV = (kind === 'vouchers' || kind === 'lines');
      for (const w of optBox.children) w.hidden = false;
      [accSales, accPurchase, accBank, accJournal, cgst, sgst, igst, roundL, makeParties, dayFirst, defType].forEach(c => { c.closest('.field').hidden = !showV; });
      [accSales, accPurchase, accBank, accJournal, cgst, sgst, igst, roundL].forEach(c => { if (kind === 'lines') c.closest('.field').hidden = true; });
      ledgerGroup.closest('.field').hidden = kind !== 'ledgers';
      itemGroup.closest('.field').hidden = kind !== 'items';
    }

    function options() {
      return {
        company: company.value.trim(), dayFirst: dayFirst.value === 'dmy', defaultType: defType.value || null,
        accounts: { Sales: accSales.value.trim(), 'Credit Note': accSales.value.trim(), Purchase: accPurchase.value.trim(), 'Debit Note': accPurchase.value.trim(), Receipt: accBank.value.trim(), Payment: accBank.value.trim(), Contra: accBank.value.trim(), Journal: accJournal.value.trim() },
        taxLedgers: { cgst: cgst.value.trim() || 'CGST', sgst: sgst.value.trim() || 'SGST', igst: igst.value.trim() || 'IGST', round: roundL.value.trim() || 'Round Off' },
        makeParties: makeParties.value === 'yes', ledgerGroup: ledgerGroup.value.trim() || 'Sundry Debtors', itemGroup: itemGroup.value.trim()
      };
    }

    function convert() {
      result.innerHTML = '';
      if (!rows.length) { msg.say('Choose a spreadsheet first.', 'note'); return; }
      const fk = kind === 'lines' ? 'lines' : kind;
      const missing = FIELDS[fk].filter(f => f.need && map[f.key] === undefined);
      if (missing.length) { msg.say('Map these columns first: ' + missing.map(f => f.label).join(', ') + '.', 'error'); renderMap(); return; }
      const opt = options();
      const base = fileName.replace(/\.[^.]+$/, '') || 'tally';
      const get = (r, k) => (map[k] === undefined ? '' : r[map[k]] ?? '');
      const files = [], stats = [];
      let previewRows = null, issues = [];

      if (kind === 'vouchers' || kind === 'lines') {
        const out = kind === 'lines' ? linesToVouchers(rows, map, opt) : rowsToVouchers(rows, map, opt);
        issues = out.issues;
        if (!out.vouchers.length) { msg.say('No voucher could be built. ' + (issues[0] || ''), 'error'); showIssues(issues); return; }
        const xml = envelope('Vouchers', opt.company, out.vouchers.map(voucherXml).join(''));
        files.push({ name: base + '-vouchers.xml', text: xml, what: out.vouchers.length + ' vouchers' });
        if (opt.makeParties && out.parties.size) {
          const lx = envelope('All Masters', opt.company, [...out.parties].map(([name, parent]) => ledgerXml({ name, parent })).join(''));
          files.push({ name: base + '-party-ledgers.xml', text: lx, what: out.parties.size + ' party ledgers' });
        }
        const byType = {};
        out.vouchers.forEach(v => { byType[v.type] = (byType[v.type] || 0) + 1; });
        stats.push(['Vouchers', String(out.vouchers.length)], ['By type', Object.entries(byType).map(([k, n]) => k + ' ' + n).join(', ')],
          ['Total value', '₹ ' + out.vouchers.reduce((s, v) => s + v.total, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })],
          ['Rows skipped', String(issues.length)]);
        previewRows = [['Row', 'Date', 'Type', 'No', 'Party', 'Debit lines', 'Credit lines', 'Balance']].concat(out.vouchers.map(v => [v.row, fromTallyDate(v.date), v.type, v.vno, v.party,
          v.lines.filter(l => l.amount < 0).map(l => l.ledger + ' ' + money(-l.amount)).join('; '), v.lines.filter(l => l.amount > 0).map(l => l.ledger + ' ' + money(l.amount)).join('; '), '✓']));
      } else if (kind === 'ledgers') {
        const ledgers = [];
        rows.forEach((r, i) => {
          if (r.every(v => v === '' || v == null)) return;
          const name = String(get(r, 'name')).trim();
          if (!name) { issues.push('Row ' + (i + 2) + ': no ledger name.'); return; }
          ledgers.push({ name, parent: String(get(r, 'parent')).trim() || opt.ledgerGroup, gstin: String(get(r, 'gstin')).trim(), state: String(get(r, 'state')).trim(), address: String(get(r, 'address')).trim(), address2: String(get(r, 'address2')).trim(), pincode: String(get(r, 'pincode')).trim(), phone: String(get(r, 'phone')).trim(), email: String(get(r, 'email')).trim(), pan: String(get(r, 'pan')).trim(), opening: toNumber(get(r, 'opening')) || 0, credit: String(get(r, 'credit')).trim() });
        });
        if (!ledgers.length) { msg.say('No ledger could be built. ' + (issues[0] || ''), 'error'); showIssues(issues); return; }
        files.push({ name: base + '-ledgers.xml', text: envelope('All Masters', opt.company, ledgers.map(ledgerXml).join('')), what: ledgers.length + ' ledgers' });
        stats.push(['Ledgers', String(ledgers.length)], ['With GSTIN', String(ledgers.filter(l => l.gstin).length)], ['Rows skipped', String(issues.length)]);
        previewRows = [['Ledger', 'Group', 'GSTIN', 'State', 'Opening']].concat(ledgers.map(l => [l.name, l.parent, l.gstin, l.state, l.opening]));
      } else {
        const items = [];
        rows.forEach((r, i) => {
          if (r.every(v => v === '' || v == null)) return;
          const name = String(get(r, 'name')).trim(), unit = String(get(r, 'unit')).trim();
          if (!name) { issues.push('Row ' + (i + 2) + ': no item name.'); return; }
          if (!unit) { issues.push('Row ' + (i + 2) + ': no unit for "' + name + '".'); return; }
          items.push({ name, unit, parent: String(get(r, 'parent')).trim() || opt.itemGroup, hsn: String(get(r, 'hsn')).trim(), rate: get(r, 'rate'), qty: get(r, 'qty'), price: get(r, 'price'), partno: String(get(r, 'partno')).trim() });
        });
        if (!items.length) { msg.say('No stock item could be built. ' + (issues[0] || ''), 'error'); showIssues(issues); return; }
        files.push({ name: base + '-stock-items.xml', text: envelope('All Masters', opt.company, items.map(itemXml).join('')), what: items.length + ' stock items' });
        stats.push(['Stock items', String(items.length)], ['With HSN', String(items.filter(i => i.hsn).length)], ['Rows skipped', String(issues.length)]);
        previewRows = [['Item', 'Unit', 'Group', 'HSN', 'GST %', 'Opening qty']].concat(items.map(i => [i.name, i.unit, i.parent, i.hsn, i.rate, i.qty]));
      }

      /* the result: summary with downloads, then preview, then the XML itself */
      const blobs = files.map(f => ({ name: f.name, blob: new Blob([f.text], { type: 'application/xml' }), what: f.what }));
      const buttons = blobs.map(b => button('Download ' + b.name, 'btn-primary', () => download(b.blob, b.name)));
      result.appendChild(summaryCard(files.length === 1 ? files[0].what : files.map(f => f.what).join(' + '),
        blobs.map(b => b.name + ' · ' + fmtBytes(b.blob.size)).join('  ·  ') + (files.length > 1 ? '  —  import the ledgers first' : ''), buttons));
      if (issues.length) showIssues(issues);
      msg.say(issues.length ? issues.length + ' row(s) were skipped — listed below. Everything else converted.' : '', issues.length ? 'warn' : '');
      const stat = el('div', 'stat-grid');
      stats.forEach(([k, v]) => { const r = el('div', 'stat-row'); r.appendChild(el('span', 'stat-key', k)); r.appendChild(el('span', 'stat-val', v)); stat.appendChild(r); });
      result.appendChild(stat);
      if (previewRows) { result.appendChild(el('h3', 'biz-h3', 'What will be imported')); result.appendChild(previewTable(previewRows, 25)); }
      const pre = el('pre', 'code-out biz-xml');
      pre.textContent = files[0].text.length > 20000 ? files[0].text.slice(0, 20000) + '\n… (' + fmtBytes(files[0].text.length) + ' in the download)' : files[0].text;
      result.appendChild(el('h3', 'biz-h3', 'The XML'));
      result.appendChild(pre);
      result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function showIssues(list) {
      if (!list.length) return;
      const box = el('div', 'biz-issues');
      box.appendChild(el('strong', null, list.length + ' row' + (list.length === 1 ? '' : 's') + ' skipped'));
      const ul = el('ul');
      list.slice(0, 40).forEach(i => ul.appendChild(el('li', null, i)));
      if (list.length > 40) ul.appendChild(el('li', null, '… and ' + (list.length - 40) + ' more'));
      box.appendChild(ul);
      result.appendChild(box);
    }

    /* saved mappings: by header signature so the right one offers itself */
    function refreshSaved() {
      const list = loadSaved().filter(m => m.kind === kind);
      saved.innerHTML = '';
      saved.appendChild(Object.assign(el('option', null, list.length ? '— choose —' : 'None saved yet'), { value: '' }));
      list.forEach((m, i) => { const o = el('option', null, m.name + ' (' + m.headers.length + ' cols)'); o.value = String(i); saved.appendChild(o); });
      savedField.hidden = !list.length;
      /* offer the one whose headers match exactly */
      const sig = headers.map(norm).join('|');
      const hit = list.findIndex(m => m.headers.map(norm).join('|') === sig);
      if (hit >= 0 && headers.length) { saved.value = String(hit); applySaved(list[hit]); }
    }
    saved.addEventListener('change', () => { const list = loadSaved().filter(m => m.kind === kind); const m = list[Number(saved.value)]; if (m) applySaved(m); });
    function applySaved(m) {
      /* by header name, so a column that moved still lands */
      map = {};
      for (const [k, h] of Object.entries(m.map)) { const i = headers.findIndex(x => norm(x) === norm(h)); if (i >= 0) map[k] = i; }
      Object.entries(m.options || {}).forEach(([id, v]) => { const c = document.getElementById(id); if (c) c.value = v; });
      renderMap();
      msg.say('Mapping “' + m.name + '” applied.', 'note');
    }
    function saveMapping() {
      if (!headers.length) { msg.say('Load a spreadsheet first.', 'note'); return; }
      const name = prompt('Name this mapping (for example the software or client it comes from):', fileName.replace(/\.[^.]+$/, ''));
      if (!name) return;
      const m = { name, kind, headers, map: Object.fromEntries(Object.entries(map).map(([k, i]) => [k, headers[i]])), options: {} };
      ['tc-company', 'tc-dayfirst', 'tc-deftype', 'tc-acc-sales', 'tc-acc-purchase', 'tc-acc-bank', 'tc-acc-journal', 'tc-cgst', 'tc-sgst', 'tc-igst', 'tc-round', 'tc-parties', 'tc-lgroup', 'tc-igroup'].forEach(id => { const c = document.getElementById(id); if (c) m.options[id] = c.value; });
      const list = loadSaved().filter(x => !(x.kind === kind && x.name === name));
      list.push(m); storeSaved(list);
      /* cloud copy, when an account with sync exists */
      if (window.Account && window.Account.enabled && typeof window.Account.saveMapping === 'function') window.Account.saveMapping('tally', m).catch(() => {});
      refreshSaved();
      msg.say('Saved. It will be offered automatically the next time a sheet with these columns is loaded.', 'note');
    }
  }

  /* ---------- tally -> spreadsheet ---------- */

  function mountFromTally(pane) {
    let xmlText = '', fileName = '';
    const msg = msgBox();
    const drop = dropzone('Choose a Tally XML export', '.xml,text/xml,application/xml', false, async (files) => {
      const f = files[0];
      try {
        msg.say('Reading…', 'note');
        xmlText = decodeXmlBytes(await f.arrayBuffer());
        fileName = f.name;
        drop.setLabel(f.name, 'click to choose another');
        msg.say('');
        run();
      } catch (e) { msg.say(e.message || String(e), 'error'); }
    });
    pane.appendChild(drop);
    const bar = el('div', 'opt-bar');
    const modeSel = select('tf-mode', [{ value: 'lines', label: 'One row per ledger line (Debit / Credit columns)' }, { value: 'voucher', label: 'One row per voucher' }], 'lines');
    bar.appendChild(field('Layout', modeSel, 'Applies to vouchers; masters have one layout'));
    pane.appendChild(bar);
    modeSel.addEventListener('change', () => { if (xmlText) run(); });
    pane.appendChild(msg);
    const result = el('div', 'biz-result');
    pane.appendChild(result);

    function run() {
      result.innerHTML = '';
      let out;
      try { out = tallyToRows(xmlText, modeSel.value); }
      catch (e) { msg.say(e.message, 'error'); return; }
      const base = fileName.replace(/\.[^.]+$/, '') || 'tally';
      const rows = out.rows;
      const csv = new Blob([toCSV(rows)], { type: 'text/csv' });
      const xlsxBtn = button('Download ' + base + '.xlsx', 'btn-primary', async () => {
        xlsxBtn.disabled = true;
        try { download(await writeXlsx(rows, out.kind), base + '.xlsx'); }
        catch (e) { msg.say(e.message, 'error'); }
        finally { xlsxBtn.disabled = false; }
      });
      const csvBtn = button('Download ' + base + '.csv', 'btn-ghost', () => download(csv, base + '.csv'));
      result.appendChild(summaryCard((rows.length - 1).toLocaleString('en-GB') + ' ' + (out.kind === 'lines' ? 'ledger lines' : out.kind), rows[0].length + ' columns · CSV ' + fmtBytes(csv.size), [xlsxBtn, csvBtn]));
      result.appendChild(el('h3', 'biz-h3', 'Preview'));
      result.appendChild(previewTable(rows, 25));
      msg.say('');
    }
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="tally-converter"]');
    if (root) mount(root);
  });

  /* exposed for the verification harness */
  window.MVRTally = { readXlsx, writeXlsx, parseCSV, toTallyDate, rowsToVouchers, linesToVouchers, tallyToRows, autoMap, FIELDS, envelope, voucherXml, ledgerXml, itemXml };
})();
