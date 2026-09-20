/**
 * A UK VAT return, worked out from the spreadsheet you already keep.
 *
 * Nine boxes. That is the whole of a VAT return, and almost every small
 * business already holds the figures that make them — a sales list and a
 * purchase list — in a spreadsheet. What they do not have is something
 * that turns those two lists into the nine boxes, shows which rows went
 * into each box, and tells them when the sheet disagrees with itself.
 *
 * This does that, on the device. It is deliberately the whole of bridging
 * software except the submission: read the spreadsheet, get the nine boxes
 * right, show the working. It does NOT file anything with HMRC, and the
 * page says so in the first thing you read.
 *
 * Money is whole pence throughout, via window.MVRLedger.money. A VAT
 * return that is out by a penny is a VAT return nobody trusts, and binary
 * floating point will put it out by a penny given half a chance.
 */
(function () {
  'use strict';
  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['vat-return'] = {
    title: 'VAT Return from a Spreadsheet (the nine boxes)',
    short: 'VAT Return',
    description: 'Turn a spreadsheet of sales and purchases into the nine boxes of a UK VAT return — standard accrual, cash accounting or the flat rate scheme — with every box opened up to show the rows behind it, and the sheet checked for net-plus-VAT that does not equal gross, duplicate invoice numbers and rows outside the period. It computes the figures; it does not file them. Runs entirely in your browser.',
    keywords: ['vat return from spreadsheet', 'mtd bridging software', 'vat return calculator', 'nine boxes vat', 'flat rate scheme calculator', 'cash accounting vat return', 'vat return template', 'uk vat return nine boxes excel'],
    glyph: 'i-vat-boxes',
    glyphSvg: '<symbol id="i-vat-boxes" viewBox="0 0 24 24">\n  <path d="M4.5 2.5h9L19.5 8v13.5h-15z"/>\n  <path d="M13.5 2.5V8h6" class="thin"/>\n  <path d="M7.5 11h9v9h-9z"/>\n  <path d="M10.5 11v9M13.5 11v9M7.5 14h9M7.5 17h9" class="thin"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/ledger.js', '/engine/pdfcore.bundle.js', '/engine/biz-vat-return.js'],
    tips: [
      'This works out the nine boxes. It does not submit them. Filing a VAT return under Making Tax Digital has to go through software HMRC has recognised, and this is not on that list — copy the figures into whatever you file with, or keep them as the working behind the return.',
      'Every rate, threshold and scheme rule sits in one marked constants block at the top of the engine file, with the date it was written on it. It was written from memory and has not been checked against a live gov.uk page, so treat the figures as a calculation you still have to verify against VAT Notice 700/12.',
      'Where your sheet has net, VAT and gross, all three are checked against each other and every row where they disagree is listed by row number and invoice reference. Nothing is quietly corrected — the tool tells you and uses the net and the VAT as written.',
      'Cash accounting needs a paid or received date column. If you have not mapped one, the tool refuses to run rather than handing you accrual figures with a cash accounting label on them. Map a paid amount column too and a part payment counts in proportion.',
      'Under the flat rate scheme you type your own sector percentage. The full sector list is not built in, because getting one of those fifty-odd percentages wrong would be worse than asking — it is on gov.uk under VAT Notice 733, and the first-year discount and the 16.5% limited cost trader rate are both switches here.',
      'Click "Show rows" on any box and you get exactly the rows that make it up, with what each one contributed. That is the part an accountant asks for when a box looks wrong, and it is the part a spreadsheet formula never gives you.',
      'Boxes 6, 7, 8 and 9 are whole pounds; boxes 1 to 5 are pounds and pence. Box 3 is worked out as box 1 plus box 2, box 5 as the difference between box 3 and box 4, and both identities are re-checked after the fact and shown to you rather than assumed.',
      'Nothing is uploaded. Your sales ledger is read, added up and written back out by your own browser, which is the only sane place for it.'
    ],
    faq: [
      { q: 'Can I file my VAT return with this?', a: 'No. Under Making Tax Digital a VAT return must be submitted through software that HMRC has recognised, using their API. This tool produces the nine figures and the working behind them; it has no connection to HMRC and sends nothing anywhere. Bridging software is the recognised category for exactly this job — software that reads a spreadsheet and submits the nine boxes without being a full accounting package — and adding the submission is the intended next step. Until it is on HMRC’s list, use these figures as your working and file through whatever you already use.' },
      { q: 'Are the rates and thresholds up to date?', a: 'They are written down in one place, dated, and honestly labelled as unverified. The engine file carries a constants block with the standard, reduced and zero rates, the registration and scheme thresholds, the flat rate first-year discount and the limited cost trader percentage, each with the date it was written and a note that it was not checked against a live gov.uk page. Check them against VAT Notice 700/12 and VAT Notice 733 before you rely on a pound figure. If something has moved, the fix is one block in one file.' },
      { q: 'What do boxes 2, 8 and 9 actually cover now?', a: 'Since the Northern Ireland Protocol they are about goods moving between Northern Ireland and EU member states, not between Great Britain and the EU. Box 2 is the VAT due on goods acquired in Northern Ireland from an EU member state, box 8 is the value of goods supplied from Northern Ireland to EU member states, and box 9 is the value of those acquisitions. If your business does not move goods that way, leave the Northern Ireland switch off and those three boxes stay at nil, which is correct for most businesses. When the switch is on, the tool uses your country column and the list of the twenty-seven member states to decide which rows count.' },
      { q: 'How does cash accounting change the figures?', a: 'Under the standard scheme a sale counts when you invoice it. Under cash accounting it counts when the customer actually pays, and a purchase when you pay it. So the tool uses the paid date, not the invoice date, to decide whether a row falls in the period — which means an invoice raised in March and paid in April moves from one return to the next. It insists on a paid date column for exactly that reason. Map a paid amount as well and a part payment is counted in proportion, with the pence made to add back to the amount actually received.' },
      { q: 'Why does box 4 come out at nil under the flat rate scheme?', a: 'That is how the scheme works: you pay a flat percentage of your VAT-inclusive turnover and, in exchange, you do not reclaim VAT on ordinary purchases. The exception is a single capital purchase of £2,000 or more including VAT, which you can reclaim. Map a capital asset column, or use a VAT code containing CAP, and those rows are picked up; otherwise box 4 is nil and the tool says why on screen rather than leaving you to wonder.' },
      { q: 'What does it check my spreadsheet for?', a: 'Rows where net plus VAT does not equal the gross you typed; rows where the VAT is not the stated rate of the net, separating a genuine mismatch from a penny of rounding; duplicate invoice references; rows dated outside the period, which are excluded and counted; negative rows, which are usually credit notes and are perfectly legitimate but worth seeing; and rows with no rate or VAT code at all. Every one names the row number and the reference, so you can go and look at it.' },
      { q: 'Is my sales ledger uploaded anywhere?', a: 'No. The file is read by your own browser, the arithmetic happens there, and the workbook and PDF are written there too. A VAT period’s sales and purchases is a complete picture of a business, which is precisely why it should not be sitting on somebody else’s server.' }
    ]
  };
  if (typeof document === 'undefined') return;

  const K = () => window.MVRBizKit;
  const M = () => { if (!window.MVRLedger) throw new Error('The ledger module did not load.'); return window.MVRLedger.money; };

  /* ==================================================================
   * UK VAT CONSTANTS — RATES, THRESHOLDS AND SCHEME RULES
   * ------------------------------------------------------------------
   * Written       : 2026-09-20
   * Verified      : NO. Written from memory. NOT checked against a live
   *                 gov.uk page, because the machine that wrote it had no
   *                 network. Treat every figure below as something to
   *                 confirm, not as authority.
   * Authority     : VAT Notice 700/12 "How to fill in and submit your VAT
   *                 Return" for the boxes and the rounding; VAT Notice 733
   *                 for the flat rate scheme; VAT Notice 731 for cash
   *                 accounting. gov.uk is the authority, not this file.
   *
   * NOTHING ELSE IN THIS FILE HARD-CODES A RATE, A THRESHOLD OR A BOX
   * RULE. If a rate moves or a threshold changes, edit this block only.
   *
   * Rates are in basis points (2000 = 20.00%) so that no percentage ever
   * becomes a float. Money thresholds are in whole pence for the same
   * reason; the pound figure is in the comment beside each one.
   * ================================================================== */
  const VAT = {
    written: '2026-09-20',
    verified: false,
    guidanceNote: 'Guidance as at 20 September 2026, written from memory and not verified against gov.uk. gov.uk is the authority.',
    authority: {
      returnNotice: 'https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012',
      flatRateNotice: 'https://www.gov.uk/guidance/flat-rate-scheme-for-small-businesses-vat-notice-733',
      cashNotice: 'https://www.gov.uk/guidance/vat-cash-accounting-scheme-notice-731',
      mtd: 'https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-vat'
    },

    /* The UK VAT rates. `inBox6` says whether a supply at this rate is part
       of the box 6 / box 7 totals: exempt supplies are, supplies outside
       the scope of UK VAT are not. */
    rates: [
      { key: 'standard', label: 'Standard rate 20%', bp: 2000, inBox6: true, note: '20% since 4 January 2011' },
      { key: 'reduced', label: 'Reduced rate 5%', bp: 500, inBox6: true, note: 'domestic fuel and power, and other listed supplies' },
      { key: 'zero', label: 'Zero rate 0%', bp: 0, inBox6: true, note: 'taxable at 0% — still goes in box 6' },
      { key: 'exempt', label: 'Exempt', bp: 0, inBox6: true, note: 'exempt supplies belong in box 6 but carry no VAT' },
      { key: 'outside', label: 'Outside the scope of UK VAT', bp: 0, inBox6: false, note: 'left out of boxes 1, 4, 6 and 7' }
    ],

    /* Registration. Figures believed to apply from 1 April 2024. */
    registration: {
      registerAbovePence: 9000000,      /* £90,000 rolling 12 months  */
      deregisterBelowPence: 8800000,    /* £88,000                     */
      from: '2024-04-01'
    },

    /* Cash accounting scheme (VAT Notice 731). */
    cashAccounting: {
      joinUpToPence: 135000000,         /* £1,350,000 estimated taxable turnover */
      leaveAbovePence: 160000000,       /* £1,600,000                             */
      basis: 'money received and money paid in the period, not the invoice date'
    },

    /* Flat rate scheme (VAT Notice 733). */
    flatRate: {
      joinUpToPenceExVat: 15000000,     /* £150,000 excluding VAT       */
      leaveAbovePenceIncVat: 23000000,  /* £230,000 including VAT       */
      firstYearDiscountBp: 100,         /* 1 percentage point off in the first year of registration */
      limitedCostTraderBp: 1650,        /* 16.5% */
      /* A limited cost trader spends less than this on relevant goods. */
      limitedCostGoodsBelowBp: 200,     /* 2% of VAT-inclusive turnover */
      limitedCostGoodsFloorPencePerYear: 100000,  /* £1,000 a year (£250 a quarter) */
      /* A single purchase of capital expenditure goods at or above this
         VAT-inclusive value may be reclaimed in box 4 despite the scheme. */
      capitalGoodsMinGrossPence: 200000,          /* £2,000 including VAT */
      /* Box 7 under the flat rate scheme: Notice 733 treats it as nil
         unless there is a box 4 capital entry, in which case it carries
         the value of that purchase excluding VAT. Offered as an option
         because this is the point of the scheme's guidance I am least
         sure of. */
      box7Default: 'capital',
      /* The fifty-odd sector percentages are deliberately NOT listed. I do
         not know the whole table well enough to put a number on a tax
         return, and a wrong sector percentage is a wrong box 1. The user
         types theirs; gov.uk publishes the table in Notice 733. */
      sectorPercentages: null
    },

    /* The nine boxes, as HMRC numbers and words them. `pounds` marks the
       boxes entered in whole pounds with the pence ignored. */
    boxes: [
      { n: 1, hmrc: 'VAT due in the period on sales and other outputs', plain: 'VAT you charged on sales', pounds: false },
      { n: 2, hmrc: 'VAT due in the period on acquisitions of goods made in Northern Ireland from EU Member States', plain: 'VAT due on Northern Ireland acquisitions', pounds: false },
      { n: 3, hmrc: 'Total VAT due (the sum of boxes 1 and 2)', plain: 'Total VAT due — boxes 1 and 2', pounds: false },
      { n: 4, hmrc: 'VAT reclaimed in the period on purchases and other inputs (including acquisitions in Northern Ireland from EU Member States)', plain: 'VAT you are reclaiming', pounds: false },
      { n: 5, hmrc: 'Net VAT to pay to HMRC or reclaim (the difference between boxes 3 and 4)', plain: 'What actually changes hands', pounds: false },
      { n: 6, hmrc: 'Total value of sales and all other outputs excluding any VAT', plain: 'Everything you sold, before VAT', pounds: true },
      { n: 7, hmrc: 'Total value of purchases and all other inputs excluding any VAT', plain: 'Everything you bought, before VAT', pounds: true },
      { n: 8, hmrc: 'Total value of despatches of goods and related costs (excluding VAT) from Northern Ireland to EU Member States', plain: 'Goods from Northern Ireland to the EU', pounds: true },
      { n: 9, hmrc: 'Total value of acquisitions of goods and related costs (excluding VAT) made in Northern Ireland from EU Member States', plain: 'Goods into Northern Ireland from the EU', pounds: true }
    ],
    /* Believed to be HMRC's instruction for boxes 6 to 9: whole pounds,
       pence ignored. Offered as an option because "round down" and "round
       to the nearest pound" are both in circulation. */
    roundingDefault: 'down',

    /* The twenty-seven EU member states, for boxes 2, 8 and 9 under the
       Northern Ireland Protocol. ISO 3166-1 alpha-2, with EL as Greece's
       VAT prefix alongside GR. */
    euMemberStates: {
      at: 'Austria', be: 'Belgium', bg: 'Bulgaria', hr: 'Croatia', cy: 'Cyprus', cz: 'Czechia',
      dk: 'Denmark', ee: 'Estonia', fi: 'Finland', fr: 'France', de: 'Germany', gr: 'Greece', el: 'Greece',
      hu: 'Hungary', ie: 'Ireland', it: 'Italy', lv: 'Latvia', lt: 'Lithuania', lu: 'Luxembourg',
      mt: 'Malta', nl: 'Netherlands', pl: 'Poland', pt: 'Portugal', ro: 'Romania', sk: 'Slovakia',
      si: 'Slovenia', es: 'Spain', se: 'Sweden'
    },

    /* VAT codes as the common UK packages write them, mapped to a rate key
       above. Sage's T4/T7/T8 were the EU codes and now only make sense for
       Northern Ireland movements; they are here so a legacy export still
       reads, not as advice on which to use. */
    codes: {
      t0: 'zero', t1: 'standard', t2: 'exempt', t4: 'zero', t5: 'reduced', t7: 'zero', t8: 'standard', t9: 'outside',
      s: 'standard', r: 'reduced', z: 'zero', e: 'exempt', o: 'outside',
      std: 'standard', standard: 'standard', standardrate: 'standard', standardrated: 'standard',
      reduced: 'reduced', reducedrate: 'reduced', reducedrated: 'reduced',
      zero: 'zero', zerorate: 'zero', zerorated: 'zero', zr: 'zero',
      exempt: 'exempt', exemptsupply: 'exempt', ex: 'exempt',
      outside: 'outside', outsidescope: 'outside', outsidethescope: 'outside', outofscope: 'outside',
      novat: 'outside', nonvat: 'outside', nonvatable: 'outside', noneoftheabove: 'outside'
    },

    /* Words that mean "this is a capital asset" in a code or a flag column. */
    capitalWords: ['cap', 'capital', 'capitalasset', 'capex', 'fixedasset', 'asset', 'yes', 'y', 'true', '1']
  };
  /* ===================== END OF CONSTANTS BLOCK ===================== */

  const box = (n) => VAT.boxes.find(b => b.n === n);
  const rate = (key) => VAT.rates.find(r => r.key === key);
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const CODE_KEYS = Object.keys(VAT.codes).sort((a, b) => b.length - a.length);

  const FIELDS = [
    { key: 'direction', label: 'Sale or purchase', aliases: ['direction', 'type', 'kind', 'saleorpurchase', 'inout', 'transactiontype', 'category', 'side'] },
    { key: 'date', label: 'Invoice date (tax point)', need: true, aliases: ['date', 'invoicedate', 'taxpoint', 'taxpointdate', 'documentdate', 'docdate', 'billdate', 'issuedate', 'transactiondate'] },
    { key: 'paid', label: 'Paid or received date', aliases: ['paiddate', 'datepaid', 'paymentdate', 'receiveddate', 'datereceived', 'settleddate', 'cleareddate', 'bankdate'] },
    { key: 'ref', label: 'Reference', aliases: ['reference', 'invoiceno', 'invoicenumber', 'invoice', 'ref', 'refno', 'documentno', 'docno', 'billno', 'number'] },
    { key: 'party', label: 'Customer or supplier', aliases: ['customer', 'supplier', 'name', 'customername', 'suppliername', 'party', 'account', 'client', 'vendor', 'contact'] },
    { key: 'net', label: 'Net', aliases: ['net', 'netamount', 'nett', 'amountexvat', 'exvat', 'excludingvat', 'goods', 'subtotal', 'netvalue', 'amountexcludingvat'] },
    { key: 'vat', label: 'VAT', aliases: ['vat', 'vatamount', 'tax', 'taxamount', 'vatvalue', 'outputvat', 'inputvat', 'vatcharged'] },
    { key: 'gross', label: 'Gross', aliases: ['gross', 'grossamount', 'total', 'amount', 'invoicetotal', 'incvat', 'includingvat', 'grandtotal', 'totalincvat'] },
    { key: 'rate', label: 'VAT rate or code', aliases: ['vatrate', 'rate', 'vatcode', 'taxcode', 'code', 'taxrate', 'vattype', 'ratecode'] },
    { key: 'country', label: 'Country or place of supply', aliases: ['country', 'countrycode', 'placeofsupply', 'place', 'region', 'destination', 'origin', 'territory'] },
    { key: 'capital', label: 'Capital asset (flat rate only)', aliases: ['capital', 'capitalasset', 'capex', 'fixedasset', 'assetpurchase', 'iscapital'] },
    { key: 'paidamount', label: 'Amount paid or received', aliases: ['amountpaid', 'paidamount', 'received', 'amountreceived', 'receipt', 'settled', 'cashreceived'] }
  ];
  const TWO_FILE_FIELDS = FIELDS.filter(f => f.key !== 'direction');

  const SALE_WORDS = ['sale', 'sales', 'salesinvoice', 'saleinvoice', 'out', 'output', 'outputs', 'outgoing', 'income', 'revenue', 'turnover', 'customer', 'sold', 'salesledger', 'debtor'];
  const BUY_WORDS = ['purchase', 'purchases', 'purchaseinvoice', 'in', 'input', 'inputs', 'incoming', 'expense', 'expenses', 'cost', 'costs', 'supplier', 'bought', 'buy', 'bill', 'bills', 'purchaseledger', 'creditor'];
  function directionOf(v) {
    const s = norm(v);
    if (!s) return null;
    if (SALE_WORDS.includes(s)) return 'sale';
    if (BUY_WORDS.includes(s)) return 'purchase';
    for (const w of SALE_WORDS) if (w.length >= 3 && s.startsWith(w)) return 'sale';
    for (const w of BUY_WORDS) if (w.length >= 3 && s.startsWith(w)) return 'purchase';
    return null;
  }

  /** A rate cell or a VAT code -> { bp, key } in basis points, or null. */
  function rateOf(v) {
    if (v === '' || v == null) return null;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return null;
      if (v === 0) return { bp: 0, key: 'zero' };
      const bp = (v > 0 && v < 1) ? Math.round(v * 10000) : Math.round(v * 100);
      return { bp, key: keyForBp(bp) };
    }
    const s = String(v).trim();
    if (!s) return null;
    const pc = /^([-+]?\d*\.?\d+)\s*%$/.exec(s);
    if (pc) { const bp = Math.round(Number(pc[1]) * 100); return { bp, key: keyForBp(bp) }; }
    if (/^[-+]?\d*\.?\d+$/.test(s)) return rateOf(Number(s));
    const c = norm(s);
    if (!c) return null;
    if (VAT.codes[c]) { const r = rate(VAT.codes[c]); return { bp: r.bp, key: r.key }; }
    for (const ck of CODE_KEYS) if (ck.length >= 3 && c.startsWith(ck)) { const r = rate(VAT.codes[ck]); return { bp: r.bp, key: r.key }; }
    const inner = /(\d+(?:\.\d+)?)\s*%/.exec(s);
    if (inner) { const bp = Math.round(Number(inner[1]) * 100); return { bp, key: keyForBp(bp) }; }
    return null;
  }
  function keyForBp(bp) {
    const r = VAT.rates.find(x => x.bp === bp && x.key !== 'exempt' && x.key !== 'outside');
    return r ? r.key : 'other';
  }
  const isCapitalWord = (v) => VAT.capitalWords.includes(norm(v));

  /* ---------- reading the sheet ---------- */

  /**
   * Raw spreadsheet rows -> entries, without judging the period or the
   * scheme. `fixedDirection` is set when the file is a sales-only or
   * purchases-only file; otherwise the direction column decides.
   */
  function readRows(rows, map, fixedDirection, firstRowNo) {
    const k = K(), m = M();
    const base = firstRowNo === undefined ? 2 : firstRowNo;
    const get = (r, key) => (map[key] === undefined ? '' : r[map[key]]);
    const amt = (v) => {
      if (v === '' || v == null) return undefined;
      const n = m.parse(v);
      return Number.isFinite(n) ? n : NaN;
    };
    const entries = [], bad = [];
    rows.forEach((r, i) => {
      const rowNo = base + i;
      const ref = String(get(r, 'ref') == null ? '' : get(r, 'ref')).trim();
      const direction = fixedDirection || directionOf(get(r, 'direction'));
      if (!direction) { bad.push({ kind: 'direction', row: rowNo, ref, text: 'Row ' + rowNo + (ref ? ' (' + ref + ')' : '') + ': the sale-or-purchase column does not say which this is, so the row is left out.' }); return; }
      const date = k.toISODate(get(r, 'date'), true);
      if (!date) { bad.push({ kind: 'unreadable', row: rowNo, ref, text: 'Row ' + rowNo + (ref ? ' (' + ref + ')' : '') + ': the invoice date could not be read, so the row is left out.' }); return; }
      const paidCell = get(r, 'paid');
      const paidDate = (paidCell === '' || paidCell == null) ? null : k.toISODate(paidCell, true);
      const net = amt(get(r, 'net')), vat = amt(get(r, 'vat')), gross = amt(get(r, 'gross'));
      if ([net, vat, gross].some(x => typeof x === 'number' && Number.isNaN(x))) {
        bad.push({ kind: 'unreadable', row: rowNo, ref, text: 'Row ' + rowNo + (ref ? ' (' + ref + ')' : '') + ': one of the net, VAT or gross cells is not a number, so the row is left out.' });
        return;
      }
      if (net === undefined && vat === undefined && gross === undefined) {
        bad.push({ kind: 'unreadable', row: rowNo, ref, text: 'Row ' + rowNo + (ref ? ' (' + ref + ')' : '') + ': it has no net, VAT or gross figure at all, so the row is left out.' });
        return;
      }
      const rc = rateOf(get(r, 'rate'));
      const capCell = get(r, 'capital');
      const paidAmount = amt(get(r, 'paidamount'));
      entries.push({
        row: rowNo, direction, date, paidDate,
        paidRaw: paidCell === '' || paidCell == null ? '' : String(paidCell),
        ref, party: String(get(r, 'party') == null ? '' : get(r, 'party')).trim(),
        netGiven: net, vatGiven: vat, grossGiven: gross,
        rateBp: rc ? rc.bp : null, rateKey: rc ? rc.key : null, rateGiven: !!rc,
        rateText: String(get(r, 'rate') == null ? '' : get(r, 'rate')).trim(),
        country: String(get(r, 'country') == null ? '' : get(r, 'country')).trim(),
        capital: isCapitalWord(capCell) || /cap/.test(norm(get(r, 'rate'))),
        paidAmount: (typeof paidAmount === 'number' && Number.isNaN(paidAmount)) ? undefined : paidAmount
      });
    });
    return { entries, bad };
  }

  /* ---------- the nine boxes ---------- */

  /** Whole pounds, HMRC style: `down` ignores the pence, `nearest` rounds. */
  function toPounds(pence, mode) {
    if (mode === 'nearest') return Math.round(pence / 100) * 100;
    return Math.trunc(pence / 100) * 100;
  }

  /** The effective flat rate percentage in basis points. */
  function flatRateBp(opt) {
    let bp = opt.limitedCost ? VAT.flatRate.limitedCostTraderBp : Math.round(Number(opt.frsPercent || 0) * 100);
    if (opt.firstYear) bp = Math.max(0, bp - VAT.flatRate.firstYearDiscountBp);
    return bp;
  }

  /**
   * Entries + options -> the nine boxes, the rows behind each one, the
   * checks and the identities, all in whole pence.
   *
   * opt: { from, to, scheme, rounding, ni, frsPercent, firstYear,
   *        limitedCost, frsBox7, defaultRateBp, hasPaidColumn }
   */
  function compute(entries, opt) {
    const m = M();
    const from = opt.from, to = opt.to;
    const scheme = opt.scheme || 'standard';
    const rounding = opt.rounding || VAT.roundingDefault;
    const checks = [], warnings = [];
    const push = (kind, e, text) => checks.push({ kind, row: e ? e.row : 0, ref: e ? e.ref : '', text });
    const where = (e) => 'Row ' + e.row + (e.ref ? ' (' + e.ref + ')' : '') + ' ' + (e.date || '');
    const p = (n) => m.fmt(n);

    if (scheme === 'cash' && !opt.hasPaidColumn) {
      return { error: 'Cash accounting counts money received and money paid, not invoice dates — so it needs a paid or received date column. Map one, or switch the scheme to standard (accrual). Nothing is being guessed for you.' };
    }
    if (scheme === 'flatrate' && !flatRateBp(opt)) {
      return { error: 'The flat rate scheme needs your sector percentage. Type the percentage your trade sector uses — it is in VAT Notice 733 on gov.uk, and this tool does not guess it.' };
    }

    const all = [];
    const seen = new Map();
    const euName = (c) => VAT.euMemberStates[norm(c)] || null;

    for (const e0 of entries) {
      const e = Object.assign({}, e0);
      all.push(e);
      e.c = { 1: 0, 2: 0, 4: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
      e.notes = [];
      e.eu = !!(opt.ni && e.country && euName(e.country));

      /* ---- resolve net, VAT and gross ---- */
      let net = e.netGiven, vat = e.vatGiven, gross = e.grossGiven;
      let bp = e.rateBp;
      if (bp === null && opt.defaultRateBp != null) bp = opt.defaultRateBp;

      if (net !== undefined && vat !== undefined) {
        if (gross !== undefined && gross !== net + vat) {
          push('gross', e, where(e) + ': net ' + p(net) + ' + VAT ' + p(vat) + ' = ' + p(net + vat) + ' but the gross column says ' + p(gross) + ' — ' + p(Math.abs(gross - (net + vat))) + ' out. The net and the VAT as written are what have been used, so the gross has been taken as ' + p(net + vat) + '.');
          gross = net + vat;
          e.notes.push('gross disagreed with net + VAT; net + VAT used');
        }
      } else if (net !== undefined && gross !== undefined) {
        vat = gross - net; e.notes.push('VAT taken as gross minus net');
      } else if (vat !== undefined && gross !== undefined) {
        net = gross - vat; e.notes.push('net taken as gross minus VAT');
      } else if (net !== undefined) {
        if (bp === null) { push('unreadable', e, where(e) + ': it has a net figure only and no rate or code, so the VAT cannot be worked out. The row is left out.'); e.out = 'nofigure'; continue; }
        vat = m.taxOn(net, bp); e.notes.push('VAT computed at ' + (bp / 100) + '% of the net');
      } else if (gross !== undefined) {
        if (bp === null) { push('unreadable', e, where(e) + ': it has a gross figure only and no rate or code, so the net cannot be worked out. The row is left out.'); e.out = 'nofigure'; continue; }
        vat = m.taxIn(gross, bp); net = gross - vat; e.notes.push('net and VAT taken out of the gross at ' + (bp / 100) + '%');
      } else {
        if (!bp) { push('unreadable', e, where(e) + ': it has a VAT figure only and no rate, so the net cannot be worked out. The row is left out.'); e.out = 'nofigure'; continue; }
        net = Math.round(vat * 10000 / bp); e.notes.push('net computed back from the VAT at ' + (bp / 100) + '%');
      }
      if (gross === undefined) gross = net + vat;
      e.net = net; e.vat = vat; e.gross = gross; e.bp = bp;

      /* ---- the checks ---- */
      if (!e.rateGiven) {
        push('norate', e, where(e) + ': no VAT rate or code on the row' + (opt.defaultRateBp != null ? ' — ' + (opt.defaultRateBp / 100) + '% has been assumed.' : ' — the rate has been worked back from the figures.'));
      } else if (e.eu && e.direction === 'purchase') {
        /* An acquisition carries no VAT from the supplier; the rate on the
           row is the UK rate you self-account at, so it is not a mismatch. */
        e.notes.push('acquisition from ' + euName(e.country) + ' — no VAT on the supplier’s invoice; box 2 VAT is worked out at the rate on the row');
      } else if (bp !== null && net !== undefined) {
        const expected = m.taxOn(net, bp);
        const d = vat - expected;
        if (d !== 0) {
          if (Math.abs(d) <= 1) push('rounding', e, where(e) + ': VAT of ' + p(vat) + ' against ' + (bp / 100) + '% of ' + p(net) + ' (' + p(expected) + ') — a penny of rounding, which is normal.');
          else push('rate', e, where(e) + ': VAT of ' + p(vat) + ' is not ' + (bp / 100) + '% of the net ' + p(net) + ', which would be ' + p(expected) + ' — ' + p(Math.abs(d)) + ' out.');
        }
      }
      if (e.ref) {
        const key = e.direction + '|' + e.ref.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (seen.has(key)) push('duplicate', e, where(e) + ': the reference ' + e.ref + ' is already used by row ' + seen.get(key) + ' on the ' + (e.direction === 'sale' ? 'sales' : 'purchases') + ' side. One of them may be entered twice.');
        else seen.set(key, e.row);
      }
      if (net < 0 || gross < 0) push('credit', e, where(e) + ': a negative row of ' + p(gross) + ' — a credit note, which is legitimate and has been netted off.');

      /* ---- is it in the period? ---- */
      const effective = scheme === 'cash' ? e.paidDate : e.date;
      e.effective = effective;
      if (scheme === 'cash' && !effective) {
        e.out = 'unpaid';
        push('unpaid', e, where(e) + ': not paid yet' + (e.paidRaw ? ' (the paid date "' + e.paidRaw + '" could not be read)' : '') + ', so under cash accounting it is not on this return.');
        continue;
      }
      if (effective < from || effective > to) {
        e.out = 'outside';
        push('outside', e, where(e) + ': the ' + (scheme === 'cash' ? 'paid date ' + effective : 'invoice date ' + effective) + ' is outside ' + from + ' to ' + to + ', so it is not on this return.');
        continue;
      }

      /* ---- cash accounting part payments ---- */
      if (scheme === 'cash' && e.paidAmount !== undefined && gross !== 0 && Math.abs(e.paidAmount) < Math.abs(gross)) {
        const vatPart = Math.round(vat * e.paidAmount / gross);
        e.net = e.paidAmount - vatPart; e.vat = vatPart; e.gross = e.paidAmount;
        e.notes.push('part payment of ' + p(e.paidAmount) + ' of ' + p(gross) + ' — counted in proportion');
        e.partPaid = true;
      }
    }

    const live = all.filter(e => !e.out);
    const inBox6 = (e) => !(e.rateKey === 'outside');
    const isEu = (e) => !!e.eu;

    const B = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    const raw = { 6: 0, 7: 0, 8: 0, 9: 0 };
    const rowsFor = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] };
    const into = (n, e, amount, note) => { if (!amount && !note) return; e.c[n] = (e.c[n] || 0) + amount; rowsFor[n].push({ e, amount, note: note || '' }); };

    const frsBp = scheme === 'flatrate' ? flatRateBp(opt) : 0;
    const sales = live.filter(e => e.direction === 'sale');
    const buys = live.filter(e => e.direction === 'purchase');

    if (scheme === 'flatrate') {
      /* Flat rate turnover is VAT-inclusive and includes zero-rated and
         exempt supplies; supplies outside the scope are left out. */
      for (const e of sales) {
        if (!inBox6(e)) { e.notes.push('outside the scope — left out of the turnover'); continue; }
        raw[6] += e.gross;
        into(6, e, e.gross, 'gross, because flat rate turnover includes the VAT');
        if (isEu(e)) { raw[8] += e.net; into(8, e, e.net, 'goods to ' + euName(e.country)); }
      }
      B[1] = m.taxOn(raw[6], frsBp);
      rowsFor[1].push({ e: null, amount: B[1], note: (frsBp / 100) + '% of the VAT-inclusive turnover of ' + p(raw[6]) });
      const capitals = buys.filter(e => e.capital && Math.abs(e.gross) >= VAT.flatRate.capitalGoodsMinGrossPence);
      for (const e of capitals) { B[4] += e.vat; into(4, e, e.vat, 'capital asset of ' + p(e.gross) + ' including VAT'); }
      const box7Rows = opt.frsBox7 === 'all' ? buys.filter(inBox6) : capitals;
      for (const e of box7Rows) { raw[7] += e.net; into(7, e, e.net, opt.frsBox7 === 'all' ? 'purchase, net' : 'capital asset, net'); }
      for (const e of buys) {
        if (!isEu(e)) continue;
        const acq = e.vat !== 0 ? e.vat : (e.bp === null ? 0 : m.taxOn(e.net, e.bp));
        B[2] += acq; into(2, e, acq, 'acquisition VAT on goods from ' + euName(e.country));
        raw[9] += e.net; into(9, e, e.net, 'acquisition from ' + euName(e.country));
      }
      if (!capitals.length) warnings.push('Box 4 is nil, which is normal under the flat rate scheme. It only carries VAT on a single capital purchase of £' + m.pretty(VAT.flatRate.capitalGoodsMinGrossPence, 'en-GB') + ' or more including VAT, and no purchase row is marked as a capital asset.');
      if (B[2]) warnings.push('Acquisition VAT in box 2 is not reclaimed in box 4 under the flat rate scheme. Check Notice 733 against your own case.');
    } else {
      for (const e of sales) {
        B[1] += e.vat; into(1, e, e.vat, e.partPaid ? 'VAT on the part received' : 'VAT charged');
        if (inBox6(e)) { raw[6] += e.net; into(6, e, e.net, e.partPaid ? 'net of the part received' : 'net'); }
        else e.notes.push('outside the scope — left out of box 6');
        if (isEu(e)) { raw[8] += e.net; into(8, e, e.net, 'goods to ' + euName(e.country)); }
      }
      for (const e of buys) {
        if (isEu(e)) {
          const acq = e.vat !== 0 ? e.vat : (e.bp === null ? 0 : m.taxOn(e.net, e.bp));
          B[2] += acq; into(2, e, acq, 'acquisition VAT on goods from ' + euName(e.country));
          B[4] += acq; into(4, e, acq, 'the same acquisition VAT, reclaimed');
          raw[9] += e.net; into(9, e, e.net, 'acquisition from ' + euName(e.country));
          raw[7] += e.net; into(7, e, e.net, 'acquisition, net');
        } else {
          B[4] += e.vat; into(4, e, e.vat, e.partPaid ? 'VAT on the part paid' : 'VAT paid');
          if (inBox6(e)) { raw[7] += e.net; into(7, e, e.net, e.partPaid ? 'net of the part paid' : 'net'); }
          else e.notes.push('outside the scope — left out of box 7');
        }
      }
    }

    /* The identities, computed as identities. */
    B[3] = B[1] + B[2];
    B[4] = B[4];
    B[5] = Math.abs(B[3] - B[4]);
    const payable = B[3] >= B[4];
    B[6] = toPounds(raw[6], rounding);
    B[7] = toPounds(raw[7], rounding);
    B[8] = toPounds(raw[8], rounding);
    B[9] = toPounds(raw[9], rounding);
    rowsFor[3].push({ e: null, amount: B[3], note: 'box 1 (' + p(B[1]) + ') plus box 2 (' + p(B[2]) + ')' });
    rowsFor[5].push({ e: null, amount: B[5], note: 'box 3 (' + p(B[3]) + ') ' + (payable ? 'less' : 'against') + ' box 4 (' + p(B[4]) + ') — ' + (payable ? 'payable to HMRC' : 'reclaimable from HMRC') });

    const sumOf = (n) => rowsFor[n].reduce((s, x) => s + (x.e ? x.amount : 0), 0);
    const identities = [
      { label: 'Box 3 equals box 1 plus box 2', ok: B[3] === B[1] + B[2], detail: p(B[3]) + ' = ' + p(B[1]) + ' + ' + p(B[2]) },
      { label: 'Box 5 is the difference between boxes 3 and 4', ok: B[5] === Math.abs(B[3] - B[4]) && B[5] >= 0, detail: p(B[5]) + ' = |' + p(B[3]) + ' − ' + p(B[4]) + '|' },
      { label: 'Boxes 6, 7, 8 and 9 are whole pounds', ok: [6, 7, 8, 9].every(n => B[n] % 100 === 0), detail: [6, 7, 8, 9].map(n => n + ': ' + p(B[n])).join(', ') },
      { label: 'Box 6 is the sum of the sales rows behind it', ok: sumOf(6) === raw[6] && toPounds(raw[6], rounding) === B[6], detail: rowsFor[6].length + ' rows add to ' + p(raw[6]) + ', shown as ' + p(B[6]) },
      { label: 'Box 7 is the sum of the purchase rows behind it', ok: sumOf(7) === raw[7] && toPounds(raw[7], rounding) === B[7], detail: rowsFor[7].length + ' rows add to ' + p(raw[7]) + ', shown as ' + p(B[7]) },
      { label: 'Box 1 is the sum of the rows behind it', ok: scheme === 'flatrate' ? B[1] === m.taxOn(raw[6], frsBp) : sumOf(1) === B[1], detail: scheme === 'flatrate' ? (frsBp / 100) + '% of ' + p(raw[6]) + ' = ' + p(B[1]) : rowsFor[1].length + ' rows add to ' + p(B[1]) },
      { label: 'Box 4 is the sum of the rows behind it', ok: sumOf(4) === B[4], detail: rowsFor[4].length + ' rows add to ' + p(B[4]) }
    ];

    if (!opt.ni) warnings.push('Boxes 2, 8 and 9 are nil because the Northern Ireland Protocol switch is off. That is right for a business that does not move goods between Northern Ireland and the EU.');
    else if (!opt.hasCountryColumn) warnings.push('The Northern Ireland switch is on but no country column is mapped, so boxes 2, 8 and 9 stay nil. Map the column that holds the country or the place of supply.');
    if (scheme === 'cash') warnings.push('Cash accounting: rows are on this return by their paid or received date. ' + all.filter(e => e.out === 'unpaid').length + ' row(s) are not paid yet and are on no return until they are.');

    return {
      scheme, from, to, rounding, frsBp, payable,
      boxes: VAT.boxes.map(b => ({ n: b.n, hmrc: b.hmrc, plain: b.plain, pounds: b.pounds, pence: B[b.n] })),
      box: B, raw, rowsFor, checks, identities, warnings,
      entries: all, live,
      counts: {
        rows: all.length, counted: live.length,
        outside: all.filter(e => e.out === 'outside').length,
        unpaid: all.filter(e => e.out === 'unpaid').length,
        dropped: all.filter(e => e.out === 'nofigure').length,
        sales: sales.length, purchases: buys.length
      }
    };
  }

  /* ---------- the downloads ---------- */

  const SCHEME_LABEL = { standard: 'Standard (accrual)', cash: 'Cash accounting', flatrate: 'Flat rate scheme' };

  function workbookSheets(R, opt) {
    const m = M();
    const n2 = (pence) => Number(m.fmt(pence));
    const nine = [['Box', 'What it is', 'Amount (£)']]
      .concat(R.boxes.map(b => [b.n, b.hmrc, n2(b.pence)]))
      .concat([[], ['Period', R.from + ' to ' + R.to],
        ['Scheme', SCHEME_LABEL[R.scheme] + (R.scheme === 'flatrate' ? ' at ' + (R.frsBp / 100) + '%' : '')],
        ['Box 5', R.payable ? 'payable to HMRC' : 'reclaimable from HMRC'],
        ['Business', opt.business || ''], ['VAT registration number', opt.vatNo || ''],
        ['Rows read', R.counts.rows], ['Rows on this return', R.counts.counted],
        ['Rows outside the period', R.counts.outside], ['Rows not yet paid', R.counts.unpaid],
        ['Guidance', VAT.guidanceNote],
        ['Not a filing', 'These are the figures only. Filing under Making Tax Digital needs software HMRC has recognised; this is not.']]);

    const side = (dir, boxNet, boxVat) => {
      const head = ['Row', 'Date', 'Paid date', 'Reference', dir === 'sale' ? 'Customer' : 'Supplier', 'Rate', 'Code as written', 'Net (£)', 'VAT (£)', 'Gross (£)', 'Country', 'On this return', 'In box ' + boxNet + ' (£)', 'In box ' + boxVat + ' (£)', 'Notes'];
      const body = R.entries.filter(e => e.direction === dir).map(e => [
        e.row, e.date, e.paidDate || '', e.ref, e.party,
        e.bp === null || e.bp === undefined ? '' : (e.bp / 100) + '%', e.rateText,
        e.net === undefined ? '' : n2(e.net), e.vat === undefined ? '' : n2(e.vat), e.gross === undefined ? '' : n2(e.gross),
        e.country, e.out ? (e.out === 'outside' ? 'no — outside the period' : e.out === 'unpaid' ? 'no — not paid yet' : 'no — could not be read') : 'yes',
        n2((e.c && e.c[boxNet]) || 0), n2((e.c && e.c[boxVat]) || 0), (e.notes || []).join('; ')
      ]);
      const totNet = R.entries.filter(e => e.direction === dir).reduce((s, e) => s + ((e.c && e.c[boxNet]) || 0), 0);
      const totVat = R.entries.filter(e => e.direction === dir).reduce((s, e) => s + ((e.c && e.c[boxVat]) || 0), 0);
      body.push(['', '', '', 'TOTAL', '', '', '', '', '', '', '', '', n2(totNet), n2(totVat), 'before the whole-pound rounding of box ' + boxNet]);
      return [head].concat(body);
    };

    const CHECK_LABEL = {
      gross: 'Net + VAT does not equal gross', rate: 'VAT is not the stated rate of the net',
      rounding: 'A penny of rounding', duplicate: 'Duplicate reference', outside: 'Outside the period',
      credit: 'Credit note (negative)', norate: 'No VAT rate or code', unpaid: 'Not paid in the period',
      unreadable: 'Could not be read', direction: 'No sale-or-purchase marker'
    };
    const checks = [['Check', 'Row', 'Reference', 'What was found']]
      .concat(R.checks.map(c => [CHECK_LABEL[c.kind] || c.kind, c.row, c.ref, c.text]));
    if (checks.length === 1) checks.push(['Nothing to report', '', '', 'Every row read cleanly and fell inside the period.']);
    const ident = R.identities.map(i => ['Identity', '', '', (i.ok ? 'PASS — ' : 'FAIL — ') + i.label + ': ' + i.detail]);

    return [
      { name: 'Nine boxes', rows: nine },
      { name: 'Sales', rows: side('sale', 6, 1) },
      { name: 'Purchases', rows: side('purchase', 7, 4) },
      { name: 'Checks', rows: checks.concat([[]]).concat(ident) }
    ];
  }

  function returnPdf(R, opt) {
    const core = window.MVRPdfCore, m = M();
    const [W, H] = core.PAGE_SIZES.a4;
    const mg = 52, GREY = '#666666', RULE = '#cccccc', ACCENT = '#123f6d';
    const ops = [];
    let y = H - mg;
    const fit = (t, font, size, maxW) => { t = String(t); if (core.textWidth(t, font, size) <= maxW) return t; while (t.length > 1 && core.textWidth(t + '…', font, size) > maxW) t = t.slice(0, -1); return t + '…'; };
    ops.push({ rect: [0, H - 6, W, 6], fill: ACCENT });
    ops.push({ text: 'VAT Return — the nine boxes', x: mg, y, size: 17, font: 'Helvetica-Bold' });
    y -= 20;
    ops.push({ text: (opt.business || 'Business not named') + (opt.vatNo ? '   ·   VAT no ' + opt.vatNo : ''), x: mg, y, size: 10.5 });
    y -= 14;
    ops.push({ text: 'Period ' + R.from + ' to ' + R.to + '   ·   ' + SCHEME_LABEL[R.scheme] + (R.scheme === 'flatrate' ? ' at ' + (R.frsBp / 100) + '%' : ''), x: mg, y, size: 10.5, colour: GREY });
    y -= 20;
    ops.push({ line: [mg, y, W - mg, y], stroke: ACCENT, lineWidth: 1.2 });
    y -= 22;

    const colAmt = W - mg;
    const textW = W - mg - 48 - 110 - mg;
    for (const b of R.boxes) {
      const lines = core.wrapText(b.hmrc, 'Helvetica', 9, textW).slice(0, 2);
      ops.push({ text: 'Box ' + b.n, x: mg, y, size: 9, font: 'Helvetica-Bold', colour: ACCENT });
      lines.forEach((ln, i) => ops.push({ text: fit(ln, 'Helvetica', 9, textW), x: mg + 48, y: y - i * 11, size: 9 }));
      ops.push({ text: '£ ' + m.pretty(b.pence, 'en-GB'), x: colAmt, y, size: 10.5, font: 'Helvetica-Bold', align: 'right' });
      y -= (lines.length - 1) * 11;
      ops.push({ line: [mg, y - 6, W - mg, y - 6], stroke: RULE, lineWidth: 0.5 });
      y -= 24;
    }
    y -= 4;
    ops.push({ rect: [mg, y - 26, W - mg * 2, 26], fill: '#eef3f8' });
    ops.push({ text: R.payable ? 'Box 5 — to pay to HMRC' : 'Box 5 — to reclaim from HMRC', x: mg + 12, y: y - 17, size: 10.5, font: 'Helvetica-Bold' });
    ops.push({ text: '£ ' + m.pretty(R.box[5], 'en-GB'), x: colAmt - 12, y: y - 17, size: 12, font: 'Helvetica-Bold', align: 'right' });
    y -= 40;

    const failed = R.identities.filter(i => !i.ok);
    ops.push({ text: 'CHECKS', x: mg, y, size: 7.5, font: 'Helvetica-Bold', colour: GREY }); y -= 13;
    const lines = [
      failed.length ? failed.length + ' of the ' + R.identities.length + ' arithmetic identities FAILED — do not use these figures.' : 'All ' + R.identities.length + ' arithmetic identities hold: box 3 = box 1 + box 2, box 5 is the difference between boxes 3 and 4, boxes 6 to 9 are whole pounds, and each box adds up to the rows behind it.',
      R.counts.rows + ' rows read; ' + R.counts.counted + ' on this return; ' + R.counts.outside + ' outside the period' + (R.counts.unpaid ? '; ' + R.counts.unpaid + ' not yet paid' : '') + '.',
      R.checks.length ? R.checks.length + ' point(s) flagged on the spreadsheet — see the Checks sheet of the workbook.' : 'Nothing was flagged on the spreadsheet.'
    ];
    for (const t of lines) for (const part of core.wrapText(t, 'Helvetica', 9, W - mg * 2)) { ops.push({ text: part, x: mg, y, size: 9 }); y -= 12; }

    y -= 10;
    ops.push({ line: [mg, y, W - mg, y], stroke: RULE, lineWidth: 0.5 }); y -= 16;
    ops.push({ text: 'Approved by', x: mg, y, size: 8, colour: GREY });
    ops.push({ text: 'Date', x: W / 2 + 20, y, size: 8, colour: GREY });
    y -= 26;
    ops.push({ line: [mg, y, W / 2 - 10, y], stroke: '#333333', lineWidth: 0.6 });
    ops.push({ line: [W / 2 + 20, y, W - mg, y], stroke: '#333333', lineWidth: 0.6 });

    const foot = 'These are the figures only. Filing a VAT return under Making Tax Digital must be done with software HMRC has recognised; this tool is not, and has sent nothing to anyone. ' + VAT.guidanceNote;
    let fy = 62;
    for (const part of core.wrapText(foot, 'Helvetica', 7.5, W - mg * 2)) { ops.push({ text: part, x: mg, y: fy, size: 7.5, colour: GREY }); fy -= 10; }
    ops.push({ text: 'Prepared with 1234tools.com', x: mg, y: 26, size: 6.5, colour: '#aaaaaa' });

    return new Blob([core.createPDF([{ size: [W, H], ops }], {
      info: { Title: 'VAT return ' + R.from + ' to ' + R.to, Author: opt.business || '', Subject: 'VAT return figures - not a submission', Creator: '1234Tools' }
    })], { type: 'application/pdf' });
  }

  /* ---------------------------------------------------------------- */

  function quarters(today) {
    const d = today ? new Date(today) : new Date();
    const out = [];
    let y = d.getFullYear(), q = Math.floor(d.getMonth() / 3);
    for (let i = 0; i < 9; i++) {
      q -= 1; if (q < 0) { q = 3; y -= 1; }
      const s = new Date(Date.UTC(y, q * 3, 1)), e = new Date(Date.UTC(y, q * 3 + 3, 0));
      out.push({ value: s.toISOString().slice(0, 10) + '|' + e.toISOString().slice(0, 10), label: ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'][q] + ' ' + y });
    }
    return out;
  }

  function mount(root) {
    const k = K();
    const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const msg = k.msgBox();

    /* The kit's issues() builds its own heading; these panels need to say
       exactly what they say, so they are built here from the same parts. */
    function panel(heading, list) {
      const p = k.el('div', 'biz-issues');
      p.appendChild(k.el('strong', null, heading));
      const ul = k.el('ul');
      list.slice(0, 40).forEach(x => ul.appendChild(k.el('li', null, x)));
      if (list.length > 40) ul.appendChild(k.el('li', null, '… and ' + (list.length - 40) + ' more'));
      p.appendChild(ul);
      return p;
    }
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

    /* the notice, first thing on the page */
    io.appendChild(panel('This works out the figures. It does not file them.', [
      'Under Making Tax Digital a VAT return has to be submitted through software HMRC has recognised, using their API. This tool has no connection to HMRC and sends nothing anywhere.',
      '“Bridging software” is HMRC’s name for software that reads a spreadsheet and submits the nine boxes without being a full accounting package. This is everything such a tool does except the submission, and the submission is what we intend to add.',
      VAT.guidanceNote + ' The VAT return notice is the authority: ' + VAT.authority.returnNotice
    ]));

    /* ---- 1 · the spreadsheet ---- */
    io.appendChild(k.h3('1 · The spreadsheet'));
    const seg = k.el('div', 'biz-seg');
    const st = { mode: 'one', one: null, sales: null, buys: null };
    const oneBox = k.el('div'), twoBox = k.el('div');
    const segBtns = [];
    [['one', 'One sheet, with a sale-or-purchase column'], ['two', 'Two files: sales and purchases']].forEach(([key, label]) => {
      const b = k.button(label, 'biz-seg-btn' + (key === 'one' ? ' is-on' : ''), () => {
        st.mode = key;
        segBtns.forEach(x => x.el.className = 'biz-seg-btn' + (x.key === key ? ' is-on' : ''));
        oneBox.hidden = key !== 'one'; twoBox.hidden = key !== 'two';
      });
      segBtns.push({ key, el: b }); seg.appendChild(b);
    });
    io.appendChild(seg);

    function loader(fields, label, onLoaded) {
      const holder = k.el('div');
      const mapBox = k.el('div');
      const state = { headers: [], rows: [], map: {}, name: '' };
      const drop = k.dropzone(label, '.xlsx,.csv', async (f) => {
        try {
          msg.say('Reading…', 'note');
          const t = await k.readTable(f);
          const h = k.splitHeader(t.sheets[0].rows);
          state.headers = h.headers; state.rows = h.rows; state.name = f.name;
          state.map = k.autoMap(fields, h.headers);
          mapBox.innerHTML = '';
          mapBox.appendChild(k.mapPanel(label, fields, h.headers, state.map));
          drop.say(f.name, h.rows.length + ' rows · ' + h.headers.length + ' columns');
          msg.say('');
          if (onLoaded) onLoaded(state);
        } catch (e) { msg.say(e.message, 'error'); }
      });
      holder.appendChild(drop); holder.appendChild(mapBox);
      return { holder, state };
    }

    const one = loader(FIELDS, 'Choose the sheet of sales and purchases (Excel or CSV)');
    oneBox.appendChild(one.holder); st.one = one.state;
    io.appendChild(oneBox);

    const two = k.el('div', 'biz-two');
    const colS = k.el('div', 'biz-col'), colP = k.el('div', 'biz-col');
    colS.appendChild(k.h3('Sales'));
    colP.appendChild(k.h3('Purchases'));
    const ls = loader(TWO_FILE_FIELDS, 'Sales (Excel or CSV)'), lp = loader(TWO_FILE_FIELDS, 'Purchases (Excel or CSV)');
    colS.appendChild(ls.holder); colP.appendChild(lp.holder);
    st.sales = ls.state; st.buys = lp.state;
    two.appendChild(colS); two.appendChild(colP);
    twoBox.appendChild(two); twoBox.hidden = true;
    io.appendChild(twoBox);

    /* ---- 2 · the period and the scheme ---- */
    io.appendChild(k.h3('2 · The period and the scheme'));
    const bar = k.el('div', 'opt-bar');
    const qs = quarters();
    const quarter = k.select('vat-quarter', [{ value: '', label: 'Custom dates' }].concat(qs), qs[0].value);
    const from = k.textInput('vat-from', qs[0].value.split('|')[0], '', 'date');
    const to = k.textInput('vat-to', qs[0].value.split('|')[1], '', 'date');
    quarter.addEventListener('change', () => { if (!quarter.value) return; const [a, b] = quarter.value.split('|'); from.value = a; to.value = b; });
    from.addEventListener('change', () => { quarter.value = ''; });
    to.addEventListener('change', () => { quarter.value = ''; });
    const scheme = k.select('vat-scheme', [
      { value: 'standard', label: 'Standard (accrual) — by invoice date' },
      { value: 'cash', label: 'Cash accounting — by money in and out' },
      { value: 'flatrate', label: 'Flat rate scheme' }
    ], 'standard');
    const rounding = k.select('vat-rounding', [
      { value: 'down', label: 'Whole pounds, pence ignored' },
      { value: 'nearest', label: 'Whole pounds, rounded to the nearest' }
    ], VAT.roundingDefault);
    const defRate = k.select('vat-default', [{ value: '', label: 'Work it back from the figures' }]
      .concat(VAT.rates.filter(r => r.key !== 'exempt' && r.key !== 'outside')
        .map(r => ({ value: String(r.bp), label: 'Assume the ' + r.label.toLowerCase() }))), '');
    const ni = k.select('vat-ni', [
      { value: 'no', label: 'No — boxes 2, 8 and 9 stay nil' },
      { value: 'yes', label: 'Yes — use the country column' }
    ], 'no');
    bar.appendChild(k.field('VAT period', quarter, 'Or set the dates yourself'));
    bar.appendChild(k.field('From', from));
    bar.appendChild(k.field('To', to));
    bar.appendChild(k.field('Scheme', scheme));
    bar.appendChild(k.field('Boxes 6 to 9', rounding, 'HMRC asks for whole pounds in these four'));
    bar.appendChild(k.field('When a row has no rate or code', defRate));
    bar.appendChild(k.field('Moves goods between Northern Ireland and the EU?', ni, 'Boxes 2, 8 and 9 are about the Northern Ireland Protocol'));
    io.appendChild(bar);

    const frsBar = k.el('div', 'opt-bar');
    const frsPct = k.textInput('vat-frs-pct', '', 'e.g. 14.5', 'number'); frsPct.min = 0; frsPct.max = 30; frsPct.step = '0.5';
    const frsFirst = k.select('vat-frs-first', [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes — take 1% off' }], 'no');
    const frsLimited = k.select('vat-frs-limited', [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes — use ' + (VAT.flatRate.limitedCostTraderBp / 100) + '%' }], 'no');
    const frsBox7 = k.select('vat-frs-box7', [
      { value: 'capital', label: 'Capital purchases only (Notice 733)' },
      { value: 'all', label: 'All purchases excluding VAT' }
    ], VAT.flatRate.box7Default);
    frsBar.appendChild(k.field('Your sector percentage', frsPct, 'From VAT Notice 733 — this tool does not guess it'));
    frsBar.appendChild(k.field('First year of registration?', frsFirst, '1 percentage point off in the first year'));
    frsBar.appendChild(k.field('Limited cost trader?', frsLimited, 'Goods below 2% of turnover, or below £250 a quarter'));
    frsBar.appendChild(k.field('Box 7 under the flat rate', frsBox7));
    /* A bare wrapper, because .opt-bar sets display:grid and would beat the
       browser's own [hidden] rule. Hiding the plain div works everywhere. */
    const frsWrap = k.el('div');
    frsWrap.appendChild(frsBar);
    frsWrap.hidden = true;
    io.appendChild(frsWrap);
    scheme.addEventListener('change', () => { frsWrap.hidden = scheme.value !== 'flatrate'; });

    /* ---- 3 · for the summary ---- */
    io.appendChild(k.h3('3 · For the summary sheet (optional)'));
    const bar3 = k.el('div', 'opt-bar');
    const business = k.textInput('vat-business', '', 'Business name');
    const vatNo = k.textInput('vat-number', '', 'GB123456789');
    bar3.appendChild(k.field('Business', business));
    bar3.appendChild(k.field('VAT registration number', vatNo));
    io.appendChild(bar3);

    const run = k.el('div', 'io-actions pdf-run');
    run.appendChild(k.button('Work out the nine boxes', 'btn-primary', go));
    io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    function gather() {
      if (st.mode === 'one') {
        if (!st.one.rows.length) throw new Error('Choose the sheet of sales and purchases first.');
        if (st.one.map.date === undefined) throw new Error('Map the invoice date column first.');
        if (st.one.map.direction === undefined) throw new Error('This sheet needs a column saying whether each row is a sale or a purchase. Map it, or switch to two files.');
        const r = readRows(st.one.rows, st.one.map, null);
        return { entries: r.entries, bad: r.bad, map: st.one.map, map2: null };
      }
      if (!st.sales.rows.length && !st.buys.rows.length) throw new Error('Choose the sales file, the purchases file, or both.');
      const out = [], bad = [];
      if (st.sales.rows.length) {
        if (st.sales.map.date === undefined) throw new Error('Map the invoice date column on the sales file.');
        const r = readRows(st.sales.rows, st.sales.map, 'sale'); out.push.apply(out, r.entries); bad.push.apply(bad, r.bad);
      }
      if (st.buys.rows.length) {
        if (st.buys.map.date === undefined) throw new Error('Map the invoice date column on the purchases file.');
        const r = readRows(st.buys.rows, st.buys.map, 'purchase'); out.push.apply(out, r.entries); bad.push.apply(bad, r.bad);
      }
      return { entries: out, bad, map: st.sales.map, map2: st.buys.map };
    }

    const mapped = (key, a, b) => (a && a[key] !== undefined) || (b && b[key] !== undefined);

    function go() {
      result.innerHTML = '';
      let G;
      try { G = gather(); } catch (e) { msg.say(e.message, 'error'); return; }
      const opt = {
        from: from.value, to: to.value,
        scheme: scheme.value, rounding: rounding.value,
        ni: ni.value === 'yes',
        frsPercent: frsPct.value, firstYear: frsFirst.value === 'yes', limitedCost: frsLimited.value === 'yes',
        frsBox7: frsBox7.value,
        defaultRateBp: defRate.value === '' ? null : Number(defRate.value),
        hasPaidColumn: mapped('paid', G.map, G.map2),
        hasCountryColumn: mapped('country', G.map, G.map2),
        business: business.value.trim(), vatNo: vatNo.value.trim()
      };
      if (!opt.from || !opt.to) { msg.say('Set the VAT period — a from date and a to date.', 'error'); return; }
      if (opt.from > opt.to) { msg.say('The period starts after it ends. Check the two dates.', 'error'); return; }

      let R;
      try { R = compute(G.entries, opt); } catch (e) { msg.say(e.message, 'error'); return; }
      if (R.error) { msg.say(R.error, 'error'); return; }
      if (G.bad.length) R.checks = G.bad.concat(R.checks);
      const m = M();
      const money = (n) => '£' + m.pretty(n, 'en-GB');

      /* ---- the card ---- */
      const sheets = workbookSheets(R, opt);
      const buttons = [
        k.downloadButton('vat-return.xlsx', () => k.S().writeXlsx(sheets)),
        k.downloadButton('vat-return.pdf', () => returnPdf(R, opt), false)
      ];
      result.appendChild(k.summaryCard(
        'Box 5: ' + money(R.box[5]) + ' ' + (R.payable ? 'to pay to HMRC' : 'to reclaim from HMRC'),
        R.from + ' to ' + R.to + ' · ' + SCHEME_LABEL[R.scheme] + (R.scheme === 'flatrate' ? ' at ' + (R.frsBp / 100) + '%' : '') +
        ' · ' + R.counts.counted + ' of ' + R.counts.rows + ' rows on this return · figures only, not filed',
        buttons));

      /* ---- the nine boxes ---- */
      result.appendChild(k.h3('The nine boxes'));
      const detail = k.el('div');
      const wrap = k.el('div', 'table-scroll');
      const t = k.el('table', 'biz-table');
      const thead = k.el('thead'), htr = k.el('tr');
      ['Box', 'What HMRC calls it', 'Amount', ''].forEach(h => htr.appendChild(k.el('th', null, h)));
      thead.appendChild(htr); t.appendChild(thead);
      const tb = k.el('tbody');
      for (const b of R.boxes) {
        const tr = k.el('tr');
        tr.appendChild(k.el('td', null, String(b.n)));
        const td = k.el('td'); td.appendChild(k.el('strong', null, b.plain));
        td.appendChild(k.el('div', 'field-hint', b.hmrc));
        tr.appendChild(td);
        tr.appendChild(k.el('td', null, money(b.pence) + (b.pounds ? '' : '')));
        const act = k.el('td');
        act.appendChild(k.button('Show rows', 'biz-seg-btn', () => showBox(b.n)));
        tr.appendChild(act);
        tb.appendChild(tr);
      }
      t.appendChild(tb); wrap.appendChild(t);
      result.appendChild(wrap);
      result.appendChild(detail);

      function showBox(n) {
        detail.innerHTML = '';
        const b = R.boxes.find(x => x.n === n);
        detail.appendChild(k.h3('Box ' + n + ' — ' + b.plain + ' — ' + money(b.pence)));
        detail.appendChild(k.el('p', 'field-hint', 'HMRC’s own wording: ' + b.hmrc));
        const list = R.rowsFor[n];
        if (!list.length) {
          detail.appendChild(k.el('p', 'field-hint', 'Nothing goes into box ' + n + ' on this return.' +
            (n === 2 || n === 8 || n === 9 ? ' These three boxes are about goods moving between Northern Ireland and EU member states.' : '')));
          return;
        }
        const rows = [['Row', 'Date', 'Reference', 'Name', 'Amount', 'Why it is here']]
          .concat(list.map(x => x.e
            ? [x.e.row, x.e.effective || x.e.date, x.e.ref, x.e.party, m.fmt(x.amount), x.note]
            : ['—', '', '', '', m.fmt(x.amount), x.note]));
        if (list.filter(x => x.e).length > 1) rows.push(['', '', 'TOTAL', '', m.fmt(list.reduce((s, x) => s + (x.e ? x.amount : 0), 0)), b.pounds ? 'before the whole-pound rounding' : '']);
        detail.appendChild(k.previewTable(rows, 200));
        detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      /* ---- identities ---- */
      const failed = R.identities.filter(i => !i.ok);
      result.appendChild(panel(
        failed.length
          ? plural(failed.length, 'arithmetic identity has FAILED', 'arithmetic identities have FAILED') + ' — do not use these figures'
          : 'Arithmetic check passed — all ' + R.identities.length + ' identities hold',
        (failed.length ? failed : R.identities).map(i => (i.ok ? '' : 'FAILED: ') + i.label + ' — ' + i.detail)));

      /* ---- the stat grid ---- */
      result.appendChild(k.statGrid([
        ['Rows read', R.counts.rows + ' (' + R.counts.sales + ' sales, ' + R.counts.purchases + ' purchases)'],
        ['On this return', String(R.counts.counted)],
        ['Outside the period', String(R.counts.outside)],
        ['Not paid in the period', String(R.counts.unpaid)],
        ['Could not be used', String(R.counts.dropped + G.bad.length)],
        ['Box 6 before rounding', money(R.raw[6])],
        ['Box 7 before rounding', money(R.raw[7])],
        ['Box 5', money(R.box[5]) + ' ' + (R.payable ? 'payable' : 'reclaimable')]
      ]));

      /* ---- the checks ---- */
      const CH = [
        ['gross', 'where net + VAT does not equal the gross'],
        ['rate', 'where the VAT is not the stated rate of the net'],
        ['duplicate', 'with a duplicate reference'],
        ['unreadable', 'that could not be used'],
        ['direction', 'with no sale-or-purchase marker'],
        ['norate', 'with no VAT rate or code'],
        ['rounding', 'a penny off the stated rate'],
        ['outside', 'outside the period, excluded'],
        ['unpaid', 'not paid in the period, excluded'],
        ['credit', 'that are negative — credit notes', 'that is negative — a credit note']
      ];
      let anyCheck = false;
      for (const [kind, many, one] of CH) {
        const list = R.checks.filter(c => c.kind === kind);
        if (!list.length) continue;
        anyCheck = true;
        result.appendChild(panel(plural(list.length, 'row ' + (one || many), 'rows ' + many), list.map(c => c.text)));
      }
      if (!anyCheck) result.appendChild(panel('Spreadsheet check passed — nothing to report',
        ['Every row read cleanly, the rates agree with the VAT, no reference is repeated and nothing fell outside the period.']));
      if (R.warnings.length) result.appendChild(panel(plural(R.warnings.length, 'note worth reading', 'notes worth reading'), R.warnings));

      /* ---- what is in the return ---- */
      result.appendChild(k.h3('Sales on this return'));
      result.appendChild(k.previewTable(sheets[1].rows, 25));
      result.appendChild(k.h3('Purchases on this return'));
      result.appendChild(k.previewTable(sheets[2].rows, 25));

      msg.say('');
      result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="vat-return"]'); if (r) mount(r); });
  window.MVRVatReturn = { VAT, readRows, compute, rateOf, directionOf, toPounds, flatRateBp, workbookSheets, returnPdf, quarters, FIELDS, TWO_FILE_FIELDS };
})();
