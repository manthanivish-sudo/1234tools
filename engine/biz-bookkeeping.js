/**
 * Bookkeeping: a set of transactions in, a set of accounts out.
 *
 * The ledger itself lives in engine/ledger.js and knows nothing about this
 * page. What happens here is the part a bookkeeper actually spends the day
 * on: getting a spreadsheet into the right accounts, seeing what would not
 * go, and reading the statements that come out.
 *
 * It is deliberately the far end of the other tools on this site. The AI
 * bank statement categoriser writes a sheet with a ledger name per row;
 * that sheet imports here without being touched. What comes out is a trial
 * balance, a profit and loss, a balance sheet and the VAT or GST figures.
 */
(function () {
  'use strict';
  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['bookkeeping'] = {
    title: 'Bookkeeping: Trial Balance, P&L and Balance Sheet',
    short: 'Bookkeeping',
    description: 'Bring a bank statement, a sales day book or a set of journals into a real double-entry ledger and get the trial balance, profit and loss, balance sheet, VAT or GST figures and every account’s ledger back. Charts of accounts for the UK and India. Runs in your browser — a client’s books are never uploaded.',
    keywords: ['free bookkeeping software', 'double entry bookkeeping online', 'trial balance generator', 'profit and loss from bank statement', 'balance sheet generator', 'bookkeeping for accountants', 'nominal ledger software', 'vat return figures from bookkeeping'],
    glyph: 'i-ledger',
    glyphSvg: '<symbol id="i-ledger" viewBox="0 0 24 24">\n  <path d="M4 4.5h13a2 2 0 0 1 2 2v13H6a2 2 0 0 1-2-2z"/>\n  <path d="M4 17.5a2 2 0 0 1 2-2h13" class="thin"/>\n  <path d="M8 8.5h7M8 11.5h7" class="thin"/>\n  <circle cx="16.8" cy="8" r="3.4" class="thin"/>\n  <path d="M16.8 6.2v3.6M15.4 8h2.8" class="thin"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/ledger.js', '/engine/biz-bookkeeping.js'],
    tips: [
      'Start a book, choose the chart of accounts and the financial year, then bring transactions in. Save the book to a file when you stop; open it again to carry on. Nothing is stored on our side, so the file is the book.',
      'Four kinds of import are understood: bank lines, sales invoices, purchase invoices, and plain journals with a debit and a credit column. Journals are grouped by their reference, so a multi-line entry stays one entry.',
      'The AI Bank Statement Categoriser on this site writes a sheet with a ledger name against every row. Import that sheet as bank lines and the names are matched to your accounts; anything it cannot match goes to Suspense and is listed, never guessed.',
      'Every journal must sum to zero and every amount is whole pence or paise. A row that would break either is refused with the reason, and the rest of the file still posts — no half-written import.',
      'The VAT or GST figures are computed from the tax recorded on each line, and the report shows them beside the balances on the tax accounts. If those two ever disagreed the book would be wrong; they cannot, because both come from the same postings.',
      'Locking a date closes everything on or before it. That is what stops a corrected invoice quietly changing a quarter you have already reported.'
    ],
    faq: [
      { q: 'Can this file my VAT return?', a: 'No. It works out the nine box figures from your own postings, and shows them beside the ledger balances so you can check them. Filing under Making Tax Digital has to go through software HMRC has recognised, which involves registering as a vendor, passing their tests and sending fraud prevention headers with every call. That is a licence and an approval, not a feature, and this tool does not pretend to have it.' },
      { q: 'Are these statutory accounts?', a: 'No. The profit and loss and the balance sheet here are management accounts: correct arithmetic, your own account names, no statutory formats and no iXBRL tagging. Accounts filed at Companies House must follow FRS 105 or FRS 102 Section 1A and be tagged to the FRC taxonomy, which is a separate piece of work.' },
      { q: 'Where is the book kept?', a: 'In the page, while it is open, and in the file you save. Nothing is uploaded, which is why an accountant can put a client’s ledger through it without a data processing agreement. The trade is that you look after the file — close the tab without saving and the work is gone.' },
      { q: 'How is money handled?', a: 'As whole pence or paise, never as decimals. Binary floating point cannot represent 0.1 exactly, which is how ledgers end up a penny out; this one adds integers, and splits a tax amount so the parts always add back to the whole.' },
      { q: 'Which charts of accounts are there?', a: 'A UK small-company chart in the usual nominal ranges, and an Indian one in Tally’s groups with separate CGST, SGST and IGST accounts. You can add your own accounts to either. The tax split for an Indian sale follows whether you mark it intra-state or inter-state, so it cannot disagree with the GSTINs.' }
    ]
  };
  if (typeof document === 'undefined') return;

  const K = () => window.MVRBizKit;
  const L = () => window.MVRLedger;

  const FIELDS = {
    bank: [
      { key: 'date', label: 'Date', need: true, aliases: ['date', 'txndate', 'transactiondate', 'valuedate', 'postingdate'] },
      { key: 'desc', label: 'Description', aliases: ['description', 'narration', 'particulars', 'details', 'memo', 'remarks'] },
      { key: 'ref', label: 'Reference', aliases: ['reference', 'refno', 'chequeno', 'utr', 'transactionid'] },
      { key: 'in', label: 'Money in', need: true, aliases: ['credit', 'creditamount', 'moneyin', 'deposit', 'receipts', 'amount'] },
      { key: 'out', label: 'Money out', aliases: ['debit', 'debitamount', 'moneyout', 'withdrawal', 'payments'] },
      { key: 'account', label: 'Account or ledger name', aliases: ['ledger', 'account', 'accountname', 'category', 'nominal', 'head', 'ledgername'] },
      { key: 'party', label: 'Customer or supplier', aliases: ['counterparty', 'party', 'customer', 'supplier', 'payee', 'name'] }
    ],
    sales: [
      { key: 'date', label: 'Invoice date', need: true, aliases: ['invoicedate', 'date', 'billdate'] },
      { key: 'ref', label: 'Invoice number', need: true, aliases: ['invoiceno', 'invoicenumber', 'ref', 'billno', 'docno'] },
      { key: 'party', label: 'Customer', need: true, aliases: ['customer', 'customername', 'party', 'client', 'buyer'] },
      { key: 'net', label: 'Net amount', need: true, aliases: ['net', 'netamount', 'taxablevalue', 'subtotal', 'amount', 'taxable'] },
      { key: 'tax', label: 'Tax amount', aliases: ['tax', 'taxamount', 'vat', 'vatamount', 'gst', 'gstamount'] },
      { key: 'taxCode', label: 'Tax code', aliases: ['taxcode', 'vatcode', 'code', 'rate', 'gstrate', 'taxrate'] },
      { key: 'account', label: 'Income account', aliases: ['account', 'nominal', 'ledger', 'incomeaccount', 'category'] },
      { key: 'state', label: 'Intra-state? (Y/N, India)', aliases: ['intrastate', 'intra', 'sameestate', 'samestate', 'placeofsupply', 'pos'] }
    ],
    purchases: [
      { key: 'date', label: 'Invoice date', need: true, aliases: ['invoicedate', 'date', 'billdate'] },
      { key: 'ref', label: 'Invoice number', need: true, aliases: ['invoiceno', 'invoicenumber', 'ref', 'billno', 'docno'] },
      { key: 'party', label: 'Supplier', need: true, aliases: ['supplier', 'suppliername', 'party', 'vendor', 'creditor'] },
      { key: 'net', label: 'Net amount', need: true, aliases: ['net', 'netamount', 'taxablevalue', 'subtotal', 'amount', 'taxable'] },
      { key: 'tax', label: 'Tax amount', aliases: ['tax', 'taxamount', 'vat', 'vatamount', 'gst', 'gstamount'] },
      { key: 'taxCode', label: 'Tax code', aliases: ['taxcode', 'vatcode', 'code', 'rate', 'gstrate', 'taxrate'] },
      { key: 'account', label: 'Expense account', aliases: ['account', 'nominal', 'ledger', 'expenseaccount', 'category', 'head'] },
      { key: 'state', label: 'Intra-state? (Y/N, India)', aliases: ['intrastate', 'intra', 'samestate', 'placeofsupply', 'pos'] }
    ],
    journal: [
      { key: 'date', label: 'Date', need: true, aliases: ['date', 'journaldate', 'transactiondate', 'vchdate'] },
      { key: 'ref', label: 'Journal number', need: true, aliases: ['journalno', 'journalnumber', 'ref', 'refno', 'voucherno', 'vchno', 'entryno', 'num'] },
      { key: 'account', label: 'Account', need: true, aliases: ['account', 'accountname', 'ledger', 'ledgername', 'nominal', 'glaccount'] },
      { key: 'debit', label: 'Debit', aliases: ['debit', 'dr', 'debitamount', 'debits'] },
      { key: 'credit', label: 'Credit', aliases: ['credit', 'cr', 'creditamount', 'credits'] },
      { key: 'narration', label: 'Narration', aliases: ['narration', 'memo', 'description', 'details', 'particulars'] },
      { key: 'party', label: 'Party', aliases: ['party', 'name', 'contact', 'customer', 'supplier'] }
    ]
  };
  const KINDS = [
    { value: 'bank', label: 'Bank lines (date, in, out, account)' },
    { value: 'sales', label: 'Sales invoices' },
    { value: 'purchases', label: 'Purchase invoices' },
    { value: 'journal', label: 'Journals (debit and credit columns)' }
  ];

  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  /** Match a written account name or code to an account in the chart. */
  function matchAccount(book, text) {
    const s = String(text == null ? '' : text).trim();
    if (!s) return null;
    if (book.accounts[s]) return book.accounts[s];
    const n = norm(s);
    const all = Object.values(book.accounts);
    let hit = all.find(a => norm(a.name) === n);
    if (hit) return hit;
    hit = all.find(a => norm(a.code) === n);
    if (hit) return hit;
    hit = all.find(a => norm(a.name).indexOf(n) === 0 || n.indexOf(norm(a.name)) === 0);
    if (hit) return hit;
    /* a couple of names everyone writes differently */
    const ALIAS = {
      salaries: ['salaries', 'salary', 'wages', 'payroll', 'staffcosts'],
      rent: ['rent', 'rentpaid', 'officerent', 'premises'],
      bankcharges: ['bankcharges', 'bankfees', 'charges', 'smscharges'],
      telephoneandinternet: ['telephone', 'internet', 'phone', 'broadband', 'mobile'],
      lightandheat: ['electricity', 'power', 'utilities', 'lightandheat', 'gas'],
      sales: ['sales', 'salesreceipt', 'revenue', 'turnover', 'income'],
      purchases: ['purchases', 'purchase', 'costofsales', 'materials', 'stockpurchase'],
      travellingandconveyance: ['travel', 'conveyance', 'travelling', 'taxi'],
      travelandsubsistence: ['travel', 'subsistence', 'travelling']
    };
    for (const a of all) {
      const list = ALIAS[norm(a.name)];
      if (list && list.some(x => x === n || n.indexOf(x) === 0)) return a;
    }
    return null;
  }

  const yes = (v) => /^(y|yes|true|1|intra|same)/i.test(String(v == null ? '' : v).trim());

  /** Turn mapped rows into journals. Returns { posted, failed, unmatched }. */
  function importRows(book, kind, rows, map, opt) {
    const l = L(), k = K();
    const get = (r, key) => map[key] === undefined ? '' : r[map[key]];
    const posted = [], failed = [], unmatched = new Map();
    const suspense = (l.accountWhere(book, 'suspense') || {}).code;

    const resolve = (text, fallback, row) => {
      const a = matchAccount(book, text);
      if (a) return a.code;
      const name = String(text || '').trim();
      if (name) {
        const u = unmatched.get(name) || { name, rows: [], to: fallback || suspense };
        u.rows.push(row); unmatched.set(name, u);
      }
      return fallback || suspense;
    };

    if (kind === 'journal') {
      const groups = new Map();
      rows.forEach((r, i) => {
        const ref = String(get(r, 'ref') || '').trim() || ('(row ' + (i + 2) + ')');
        if (!groups.has(ref)) groups.set(ref, { ref, rows: [], first: i + 2 });
        groups.get(ref).rows.push({ r, i });
      });
      for (const g of groups.values()) {
        const first = g.rows[0].r;
        const lines = g.rows.map(({ r, i }) => ({
          account: resolve(get(r, 'account'), null, i + 2),
          debit: get(r, 'debit'), credit: get(r, 'credit'),
          memo: String(get(r, 'narration') || '').trim()
        }));
        const res = l.tryPost(book, {
          date: k.toISODate(get(first, 'date'), true), ref: g.ref,
          narration: String(get(first, 'narration') || '').trim(), party: String(get(first, 'party') || '').trim(),
          source: 'journal', lines
        });
        if (res.ok) posted.push(res.journal); else failed.push({ row: g.first, ref: g.ref, error: res.error });
      }
      return { posted, failed, unmatched: [...unmatched.values()] };
    }

    rows.forEach((r, i) => {
      const row = i + 2;
      const date = k.toISODate(get(r, 'date'), true);
      try {
        if (kind === 'bank') {
          const inn = l.money.parse(get(r, 'in') || 0);
          const out = map.out === undefined ? 0 : l.money.parse(get(r, 'out') || 0);
          if (!Number.isFinite(inn) || !Number.isFinite(out)) throw new Error('the money in or out is not a number');
          const amount = (inn || 0) - (out || 0);
          if (amount === 0) return;                       /* a nil line is not an entry */
          const acc = resolve(get(r, 'account'), null, row);
          const j = l.bankLine(book, {
            date, amount, account: acc, bank: opt.bank,
            ref: String(get(r, 'ref') || '').trim(),
            narration: String(get(r, 'desc') || '').trim(),
            party: String(get(r, 'party') || '').trim(), source: 'bank'
          });
          posted.push(j);
        } else {
          const net = l.money.parse(get(r, 'net'));
          if (!Number.isFinite(net)) throw new Error('the net amount is not a number');
          const taxCodeRaw = String(get(r, 'taxCode') || '').trim();
          const code = book.taxCodes[taxCodeRaw.toUpperCase()] ? taxCodeRaw.toUpperCase() : (opt.taxCode || 'NO');
          const taxGiven = map.tax === undefined || get(r, 'tax') === '' ? undefined : l.money.parse(get(r, 'tax'));
          const intra = map.state === undefined ? opt.intra : yes(get(r, 'state'));
          const common = {
            date, ref: String(get(r, 'ref') || '').trim(), party: String(get(r, 'party') || '').trim(),
            net, tax: taxGiven, taxCode: code, interState: !intra, source: kind
          };
          const j = kind === 'sales'
            ? l.sale(book, Object.assign(common, { income: resolve(get(r, 'account'), opt.income, row) }))
            : l.purchase(book, Object.assign(common, { expense: resolve(get(r, 'account'), opt.expense, row) }));
          posted.push(j);
        }
      } catch (e) { failed.push({ row, ref: String(get(r, 'ref') || ''), error: e.message }); }
    });
    return { posted, failed, unmatched: [...unmatched.values()] };
  }

  /* ---------------------------------------------------------------- */

  function mount(root) {
    const k = K(), l = L();
    const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const msg = k.msgBox();
    let book = null;
    const st = { headers: [], rows: [], map: {}, kind: 'bank', name: '' };

    /* ---- 1. the book ---- */
    io.appendChild(k.h3('1 · The book'));
    const bar = k.el('div', 'opt-bar');
    const bkName = k.textInput('bk-name', 'Client Ltd', 'Client or company name');
    const chart = k.select('bk-chart', Object.keys(l.CHARTS).map(c => ({ value: c, label: l.CHARTS[c].name })), 'uk');
    const yStart = k.textInput('bk-start', '2026-04-01', '', 'date');
    const yEnd = k.textInput('bk-end', '2027-03-31', '', 'date');
    const lockTo = k.textInput('bk-lock', '', '', 'date');
    bar.appendChild(k.field('Name', bkName));
    bar.appendChild(k.field('Chart of accounts', chart));
    bar.appendChild(k.field('Year from', yStart));
    bar.appendChild(k.field('Year to', yEnd));
    bar.appendChild(k.field('Locked to and including', lockTo, 'Leave blank while the year is open'));
    io.appendChild(bar);

    const bookBar = k.el('div', 'io-actions');
    bookBar.appendChild(k.button('Start a new book', 'btn-primary', () => { makeBook(); msg.say('New book started — ' + Object.keys(book.accounts).length + ' accounts in the chart.', 'note'); paint(); }));
    const openIn = k.el('input', 'visually-hidden'); openIn.type = 'file'; openIn.accept = '.json';
    openIn.addEventListener('change', async () => {
      if (!openIn.files.length) return;
      try {
        book = l.fromJSON(await openIn.files[0].text());
        bkName.value = book.name; chart.value = book.chart; yStart.value = book.start || ''; yEnd.value = book.end || ''; lockTo.value = book.lockedTo || '';
        msg.say('Opened ' + book.name + ' — ' + book.journals.length + ' journals.', 'note'); paint();
      } catch (e) { msg.say(e.message, 'error'); }
      openIn.value = '';
    });
    bookBar.appendChild(k.button('Open a saved book (.json)', 'btn-ghost', () => openIn.click()));
    bookBar.appendChild(openIn);
    bookBar.appendChild(k.button('Save the book', 'btn-ghost', () => {
      if (!need()) return;
      readBookSettings();
      k.S().download(new Blob([l.toJSON(book)], { type: 'application/json' }), (book.name || 'book').replace(/[^\w-]+/g, '-').toLowerCase() + '.json');
    }));
    bookBar.appendChild(k.button('Load a worked example', 'btn-ghost', example));
    io.appendChild(bookBar);

    function makeBook() {
      book = l.newBook({ name: bkName.value.trim() || 'Untitled', chart: chart.value, start: yStart.value || null, end: yEnd.value || null });
      return book;
    }
    function readBookSettings() {
      if (!book) return;
      book.name = bkName.value.trim() || book.name;
      book.lockedTo = lockTo.value || null;
    }
    const need = () => { if (!book) { msg.say('Start a new book, or open one, first.', 'note'); return false; } return true; };

    /* ---- 2. bring transactions in ---- */
    io.appendChild(k.h3('2 · Bring transactions in'));
    const kindSel = k.select('bk-kind', KINDS, 'bank');
    const kindBar = k.el('div', 'opt-bar');
    const dTax = k.select('bk-taxcode', [], 'NO');
    const dIntra = k.select('bk-intra', [{ value: 'yes', label: 'Intra-state (CGST + SGST)' }, { value: 'no', label: 'Inter-state (IGST)' }], 'yes');
    const dBank = k.select('bk-bank', [], '');
    kindBar.appendChild(k.field('What is in the file', kindSel));
    kindBar.appendChild(k.field('Bank account', dBank, 'Which side of a bank line is the bank'));
    kindBar.appendChild(k.field('Tax code when the file has none', dTax));
    kindBar.appendChild(k.field('Place of supply when the file has none', dIntra, 'India only'));
    io.appendChild(kindBar);

    const mapBox = k.el('div');
    const drop = k.dropzone('Choose the transactions (Excel or CSV)', '.xlsx,.csv', async (f) => {
      try {
        msg.say('Reading…', 'note');
        const t = await k.readTable(f); const h = k.splitHeader(t.sheets[0].rows);
        st.headers = h.headers; st.rows = h.rows; st.name = f.name;
        remap();
        drop.say(f.name, h.rows.length + ' rows'); msg.say('');
      } catch (e) { msg.say(e.message, 'error'); }
    });
    io.appendChild(drop); io.appendChild(mapBox);
    kindSel.addEventListener('change', () => { st.kind = kindSel.value; if (st.rows.length) remap(); });
    function remap() {
      st.kind = kindSel.value;
      const f = FIELDS[st.kind];
      st.map = k.autoMap(f, st.headers);
      mapBox.innerHTML = '';
      mapBox.appendChild(k.mapPanel('Columns', f, st.headers, st.map));
    }

    const run = k.el('div', 'io-actions pdf-run');
    run.appendChild(k.button('Post to the ledger', 'btn-primary', go));
    io.appendChild(run); io.appendChild(msg);

    /* ---- 3. what came back ---- */
    const result = k.el('div', 'biz-result'); io.appendChild(result);
    const reportBox = k.el('div'); io.appendChild(reportBox);

    function go() {
      if (!need()) return;
      if (!st.rows.length) { msg.say('Choose a file of transactions first.', 'note'); return; }
      const f = FIELDS[st.kind];
      const miss = k.missing(f, st.map);
      if (miss.length) { msg.say('Map ' + miss.join(', ') + ' first.', 'error'); return; }
      readBookSettings();
      const opt = { bank: dBank.value, taxCode: dTax.value, intra: dIntra.value === 'yes' };
      let R;
      try { R = importRows(book, st.kind, st.rows, st.map, opt); }
      catch (e) { msg.say(e.message, 'error'); return; }

      result.innerHTML = '';
      result.appendChild(k.summaryCard(
        R.posted.length + ' journal' + (R.posted.length === 1 ? '' : 's') + ' posted' + (R.failed.length ? ', ' + R.failed.length + ' refused' : ''),
        book.name + ' · ' + book.journals.length + ' journals in the book · ' + Object.keys(book.accounts).length + ' accounts',
        [k.downloadButton('accounts.xlsx', () => k.S().writeXlsx(sheets())),
          k.downloadButton((book.name || 'book').replace(/[^\w-]+/g, '-').toLowerCase() + '.json', () => new Blob([l.toJSON(book)], { type: 'application/json' }), false)]));
      if (R.failed.length) result.appendChild(k.issues(R.failed.map(f2 => 'Row ' + f2.row + (f2.ref ? ' (' + f2.ref + ')' : '') + ': ' + f2.error), 'row refused'));
      if (R.unmatched.length) {
        result.appendChild(k.issues(R.unmatched.map(u => '“' + u.name + '” is not an account in this chart — ' + u.rows.length + ' row(s) went to Suspense. Add the account, or rename it in the file, and post again.'), 'name not matched'));
      }
      paint();
      msg.say('');
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ---- the statements ---- */
    const REPORTS = [
      { key: 'tb', label: 'Trial balance' }, { key: 'pl', label: 'Profit and loss' }, { key: 'bs', label: 'Balance sheet' },
      { key: 'tax', label: 'VAT / GST' }, { key: 'led', label: 'Ledgers' }, { key: 'party', label: 'Debtors and creditors' }
    ];
    let showing = 'tb';

    function paint() {
      reportBox.innerHTML = '';
      if (!book) return;
      readBookSettings();
      dBank.innerHTML = ''; dTax.innerHTML = '';
      for (const a of l.accountsWhere(book, 'bank')) { const o = k.el('option', null, a.code + ' ' + a.name); o.value = a.code; dBank.appendChild(o); }
      for (const c of Object.keys(book.taxCodes)) { const o = k.el('option', null, c + ' — ' + book.taxCodes[c][0]); o.value = c; dTax.appendChild(o); }
      dTax.value = book.chart === 'uk' ? 'SR' : 'G18';

      const problems = l.check(book);
      const seg = k.el('div', 'biz-seg');
      for (const r of REPORTS) {
        const btn = k.button(r.label, 'biz-seg-btn' + (showing === r.key ? ' is-on' : ''), () => { showing = r.key; paint(); });
        seg.appendChild(btn);
      }
      reportBox.appendChild(seg);
      if (problems.length) reportBox.appendChild(k.issues(problems, 'problem with the book'));
      else if (book.journals.length) reportBox.appendChild(k.issues(['Every journal balances, the trial balance agrees and the balance sheet balances.'], 'check passed — '));

      const money = (n) => l.money.pretty(n, book.locale);
      const view = k.el('div');
      if (showing === 'tb') {
        const tb = l.trialBalance(book, {});
        view.appendChild(k.h3('Trial balance at ' + (book.end || 'today')));
        view.appendChild(k.previewTable([['Code', 'Account', 'Group', 'Debit', 'Credit']]
          .concat(tb.rows.map(r => [r.code, r.name, r.group, r.debit ? money(r.debit) : '', r.credit ? money(r.credit) : '']))
          .concat([['', 'Total', '', money(tb.debit), money(tb.credit)]]), 200));
      } else if (showing === 'pl') {
        const pl = l.profitAndLoss(book, {});
        const rows = [['', 'Account', 'Amount']];
        for (const g of pl.groups) { rows.push([g.group, '', '']); for (const r of g.rows) rows.push(['', r.code + ' ' + r.name, money(r.amount)]); rows.push(['', 'Total ' + g.group, money(g.total)]); }
        rows.push([], ['', 'Turnover and other income', money(pl.income)], ['', 'Expenses', money(pl.expense)], ['', pl.profit >= 0 ? 'Profit for the period' : 'Loss for the period', money(pl.profit)]);
        view.appendChild(k.h3('Profit and loss, ' + (pl.from || '') + ' to ' + (pl.to || '')));
        view.appendChild(k.previewTable(rows, 200));
        view.appendChild(k.statGrid([['Income', money(pl.income)], ['Expenses', money(pl.expense)], [pl.profit >= 0 ? 'Profit' : 'Loss', money(pl.profit)]]));
      } else if (showing === 'bs') {
        const bs = l.balanceSheet(book, {});
        const rows = [['', 'Account', 'Amount']];
        const block = (title, list, total) => { rows.push([title, '', '']); for (const r of list) rows.push(['', (r.code ? r.code + ' ' : '') + r.name, money(r.amount)]); rows.push(['', 'Total ' + title.toLowerCase(), money(total)]); };
        block('Assets', bs.assets, bs.totalAssets);
        block('Liabilities', bs.liabilities, bs.totalLiabilities);
        block('Capital and reserves', bs.equity, bs.totalEquity);
        view.appendChild(k.h3('Balance sheet at ' + bs.asOn));
        view.appendChild(k.previewTable(rows, 200));
        view.appendChild(k.statGrid([['Assets', money(bs.totalAssets)], ['Liabilities plus capital', money(bs.totalLiabilities + bs.totalEquity)], ['Difference', money(bs.difference)]]));
      } else if (showing === 'tax') {
        const t = l.taxReturn(book, {});
        view.appendChild(k.h3(book.taxName + ' for ' + (t.from || '') + ' to ' + (t.to || '')));
        if (t.kind === 'uk-vat') {
          const names = { 1: 'VAT due on sales and other outputs', 2: 'VAT due on acquisitions from Northern Ireland', 3: 'Total VAT due', 4: 'VAT reclaimed on purchases', 5: 'Net VAT to pay or reclaim', 6: 'Total value of sales excluding VAT', 7: 'Total value of purchases excluding VAT', 8: 'Supplies to Northern Ireland', 9: 'Acquisitions from Northern Ireland' };
          view.appendChild(k.previewTable([['Box', 'What it is', 'Amount']].concat(Object.keys(names).map(n => [n, names[n], money(t.boxes[n])])), 20));
          view.appendChild(k.issues(['These are the figures, not a submission. Filing under Making Tax Digital requires software recognised by HMRC; this is not that.'], 'note — '));
        } else {
          view.appendChild(k.previewTable([['', 'Output (on sales)', 'Input (on purchases)'],
            ['CGST', money(t.parts.cgst.out), money(t.parts.cgst.in)],
            ['SGST', money(t.parts.sgst.out), money(t.parts.sgst.in)],
            ['IGST', money(t.parts.igst.out), money(t.parts.igst.in)],
            ['Total', money(t.outputTax), money(t.inputTax)],
            ['Net payable', money(t.payable), '']], 20));
        }
        view.appendChild(k.h3('By tax code'));
        view.appendChild(k.previewTable([['Code', 'Rate', 'Sales net', 'Sales tax', 'Purchases net', 'Purchases tax']]
          .concat(t.byCode.map(c => [c.code, c.label, money(c.outputNet), money(c.outputTax), money(c.inputNet), money(c.inputTax)])), 30));
      } else if (showing === 'led') {
        const used = {};
        for (const j of book.journals) for (const ln of j.lines) used[ln.account] = true;
        const pick = k.select('bk-ledger', Object.keys(used).sort().map(c => ({ value: c, label: c + ' ' + book.accounts[c].name })), Object.keys(used).sort()[0] || '');
        pick.addEventListener('change', () => { drawLedger(pick.value); });
        view.appendChild(k.field('Account', pick));
        const holder = k.el('div'); view.appendChild(holder);
        function drawLedger(code) {
          holder.innerHTML = '';
          if (!code) return;
          const g = l.generalLedger(book, code, {});
          holder.appendChild(k.previewTable([['Date', 'Journal', 'Reference', 'Narration', 'Debit', 'Credit', 'Balance']]
            .concat(g.rows.map(r => [r.date, r.id, r.ref, r.narration, r.debit ? money(r.debit) : '', r.credit ? money(r.credit) : '', money(r.balance)]))
            .concat([['', '', '', 'Closing', '', '', money(g.closing)]]), 200));
        }
        drawLedger(pick.value);
      } else {
        for (const kind of ['receivable', 'payable']) {
          const a = l.ageing(book, { kind, asOn: book.end });
          view.appendChild(k.h3(kind === 'receivable' ? 'Debtors' : 'Creditors'));
          view.appendChild(k.previewTable([['Party', 'Balance', 'Items']]
            .concat(a.parties.map(p => [p.party, money(p.balance), p.items.length]))
            .concat([['Total', money(a.total), '']]), 60));
        }
      }
      reportBox.appendChild(view);
    }

    function sheets() {
      const money = (n) => l.money.fmt(n);
      const tb = l.trialBalance(book, {});
      const pl = l.profitAndLoss(book, {});
      const bs = l.balanceSheet(book, {});
      const t = l.taxReturn(book, {});
      const out = [
        { name: 'Trial balance', rows: [['Code', 'Account', 'Group', 'Debit', 'Credit']].concat(tb.rows.map(r => [r.code, r.name, r.group, r.debit / 100, r.credit / 100])).concat([['', 'Total', '', tb.debit / 100, tb.credit / 100]]) },
        { name: 'Profit and loss', rows: [['Group', 'Code', 'Account', 'Amount']].concat(pl.groups.flatMap(g => g.rows.map(r => [g.group, r.code, r.name, r.amount / 100]).concat([[g.group, '', 'Total', g.total / 100]]))).concat([[], ['', '', 'Profit', pl.profit / 100]]) },
        { name: 'Balance sheet', rows: [['Side', 'Code', 'Account', 'Amount']]
          .concat(bs.assets.map(r => ['Assets', r.code, r.name, r.amount / 100]))
          .concat(bs.liabilities.map(r => ['Liabilities', r.code, r.name, r.amount / 100]))
          .concat(bs.equity.map(r => ['Capital and reserves', r.code, r.name, r.amount / 100]))
          .concat([[], ['Total assets', '', '', bs.totalAssets / 100], ['Total liabilities and capital', '', '', (bs.totalLiabilities + bs.totalEquity) / 100]]) },
        { name: book.taxName, rows: t.kind === 'uk-vat'
          ? [['Box', 'Amount']].concat(Object.keys(t.boxes).map(n => [Number(n), t.boxes[n] / 100]))
          : [['Component', 'Output', 'Input']].concat(['cgst', 'sgst', 'igst'].map(p => [p.toUpperCase(), t.parts[p].out / 100, t.parts[p].in / 100])).concat([['Net payable', t.payable / 100, '']]) },
        { name: 'Journals', rows: [['Journal', 'Date', 'Reference', 'Party', 'Narration', 'Account', 'Name', 'Debit', 'Credit']]
          .concat(book.journals.flatMap(j => j.lines.map(ln => [j.id, j.date, j.ref, j.party, ln.memo || j.narration, ln.account, (book.accounts[ln.account] || {}).name || '', ln.amount > 0 ? ln.amount / 100 : '', ln.amount < 0 ? -ln.amount / 100 : '']))) }
      ];
      return out;
    }

    /* ---- the worked example ---- */
    function example() {
      chart.value = 'uk'; bkName.value = 'Northwind Joinery Ltd'; yStart.value = '2026-04-01'; yEnd.value = '2027-03-31'; lockTo.value = '';
      makeBook();
      l.post(book, { date: '2026-04-01', ref: 'OB', narration: 'Opening capital', source: 'journal', lines: [{ account: '1200', debit: '18000.00' }, { account: '3000', credit: '18000.00' }] });
      l.sale(book, { date: '2026-04-04', ref: 'INV-101', party: 'Harper & Co', net: '6400.00', taxCode: 'SR' });
      l.sale(book, { date: '2026-04-18', ref: 'INV-102', party: 'Northline Offices LLP', net: '2250.00', taxCode: 'SR' });
      l.sale(book, { date: '2026-05-06', ref: 'INV-103', party: 'Milton Schools Trust', net: '1800.00', taxCode: 'ZR' });
      l.purchase(book, { date: '2026-04-06', ref: 'TIM-88', party: 'Timber Direct', net: '3100.00', taxCode: 'SR', expense: '5000' });
      l.purchase(book, { date: '2026-04-11', ref: 'RENT-1', party: 'Brookfield Estates', net: '1400.00', taxCode: 'EX', expense: '7100' });
      l.purchase(book, { date: '2026-05-02', ref: 'INS-9', party: 'Hallam Insurance', net: '820.00', taxCode: 'EX', expense: '7700' });
      l.bankLine(book, { date: '2026-04-30', amount: '-4200.00', account: '7000', narration: 'April wages' });
      l.bankLine(book, { date: '2026-05-08', amount: '7680.00', account: '1100', party: 'Harper & Co', narration: 'INV-101 settled' });
      l.bankLine(book, { date: '2026-05-12', amount: '-3720.00', account: '2100', party: 'Timber Direct', narration: 'TIM-88 paid' });
      l.bankLine(book, { date: '2026-05-29', amount: '-63.40', account: '7900', narration: 'Bank charges' });
      msg.say('Worked example loaded — 11 journals. The reports are below; try the tabs.', 'note');
      result.innerHTML = '';
      result.appendChild(k.summaryCard('Northwind Joinery Ltd — 11 journals posted',
        'A quarter of trading: three sales, three purchases, wages, two settlements and a bank charge',
        [k.downloadButton('accounts.xlsx', () => k.S().writeXlsx(sheets())),
          k.downloadButton('northwind-joinery-ltd.json', () => new Blob([l.toJSON(book)], { type: 'application/json' }), false)]));
      paint();
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="bookkeeping"]'); if (r) mount(r); });
  window.MVRBookkeeping = { importRows, matchAccount };
})();
