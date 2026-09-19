/**
 * Bank statement vs the bank ledger in your books.
 *
 * Two spreadsheets in, four sheets out: what matched, what is on the
 * statement but not in the books, what is in the books but not on the
 * statement, and the closing figures side by side. Matching is on amount
 * and direction, then the nearest date within a window, with a reference
 * shared by both descriptions breaking ties. On the device throughout.
 */
(function () {
  'use strict';
  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['bank-reconciliation'] = {
    title: 'Bank Reconciliation',
    short: 'Bank Reconcile',
    description: 'Match a bank statement against the bank ledger from your books — Tally, Zoho, QuickBooks or a spreadsheet — and get the unmatched entries on each side, the matched pairs, and the closing balances explained. Runs in your browser; nothing is uploaded.',
    keywords: ['bank reconciliation tool', 'bank reconciliation statement excel', 'match bank statement with ledger', 'brs automation', 'reconcile bank statement free', 'tally bank reconciliation'],
    glyph: 'i-bank-recon',
    glyphSvg: '<symbol id="i-bank-recon" viewBox="0 0 24 24">\n  <path d="M3 9.5l9-5 9 5H3z"/>\n  <path d="M6 9.5v7M12 9.5v7M18 9.5v7" class="thin"/>\n  <path d="M3 19.5h18"/>\n  <path d="M9 13.5h6M13 11.5l2 2-2 2" class="thin"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/biz-bank-reconciliation.js'],
    tips: ['Export the bank ledger from your books with dates, particulars and the debit and credit columns; download the statement from the bank as Excel or CSV. Columns are matched by name and can be corrected.', 'Direction matters and the tool keeps it straight: money in on the statement (a credit) matches money in on the ledger (a debit to the bank account). Map "money in" and "money out" on each side and the rest follows.', 'A date window of three days covers cheques and weekend clearing. Widen it for a statement from a slow-clearing account; narrow it if you get false matches.', 'Where two entries share an amount, a reference that appears in both descriptions — an invoice number, a UTR, a cheque number — decides which pairs with which.', 'The "Only on statement" sheet is usually bank charges, interest and direct debits nobody entered. The "Only in books" sheet is usually cheques issued but not yet presented.'],
    faq: [{ q: 'What counts as a match?', a: 'Same amount to the paisa, same direction, dates within the window, and — if several candidates qualify — the one sharing a reference with the description, then the nearest date. Each entry matches at most once.' }, { q: 'Does it handle a ledger with a single signed amount column?', a: 'Yes. Map that column as money in and leave money out empty; negative values are taken as money out. The same works for the statement.' }, { q: 'Is my bank data uploaded?', a: 'No. Both files are read and compared in your browser and the report is written there. Nothing leaves your device.' }]
  };
  if (typeof document === 'undefined') return;
  const K = () => window.MVRBizKit;

  const FIELDS = (side) => [
    { key: 'date', label: 'Date', need: true, aliases: ['date', 'txndate', 'transactiondate', 'valuedate', 'vchdate', 'voucherdate', 'postingdate'] },
    { key: 'desc', label: 'Description / particulars', aliases: ['description', 'particulars', 'narration', 'details', 'transactiondetails', 'remarks', 'memo', 'payee', 'name'] },
    { key: 'ref', label: 'Reference / cheque no', aliases: ['reference', 'refno', 'chequeno', 'chqno', 'utr', 'transactionid', 'txnid', 'vchno', 'voucherno', 'instrumentno'] },
    { key: 'in', label: side === 'statement' ? 'Money in (credit column)' : 'Money in (debit to bank in books)', need: true, aliases: side === 'statement' ? ['credit', 'creditamount', 'deposit', 'deposits', 'cr', 'moneyin', 'amount', 'creditinr'] : ['debit', 'debitamount', 'dr', 'receipt', 'receipts', 'moneyin', 'amount', 'inflow'] },
    { key: 'out', label: side === 'statement' ? 'Money out (debit column)' : 'Money out (credit to bank in books)', aliases: side === 'statement' ? ['debit', 'debitamount', 'withdrawal', 'withdrawals', 'dr', 'moneyout', 'debitinr'] : ['credit', 'creditamount', 'cr', 'payment', 'payments', 'moneyout', 'outflow'] },
    { key: 'bal', label: 'Balance', aliases: ['balance', 'closingbalance', 'runningbalance'] }
  ];

  function entries(rows, map, side) {
    const k = K(); const get = (r, key) => map[key] === undefined ? '' : r[map[key]];
    return rows.map((r, i) => {
      const inn = k.toNumber(get(r, 'in')), out = map.out === undefined ? 0 : k.toNumber(get(r, 'out'));
      let amount = 0;
      if (map.out === undefined) amount = Number.isFinite(inn) ? inn : 0;       /* single signed column */
      else amount = (Number.isFinite(inn) ? inn : 0) - (Number.isFinite(out) ? out : 0);
      amount = Math.round(amount * 100) / 100;
      const desc = String(get(r, 'desc') || '').trim(), ref = String(get(r, 'ref') || '').trim();
      const tokens = new Set((ref + ' ' + desc).toUpperCase().match(/[A-Z]*\d{3,}[A-Z0-9-]*/g) || []);
      return { side, row: i + 2, date: k.toISODate(get(r, 'date'), true), desc, ref, amount, tokens, bal: k.toNumber(get(r, 'bal')) };
    }).filter(e => e.amount !== 0 && e.date);
  }

  function reconcile(stmt, book, windowDays) {
    const k = K();
    const usedB = new Set(); const matched = [];
    stmt.forEach((s, si) => {
      let best = -1, bestScore = Infinity;
      book.forEach((b, bi) => {
        if (usedB.has(bi) || b.amount !== s.amount) return;
        const days = k.dayDiff(s.date, b.date); if (days > windowDays) return;
        let shared = 0; s.tokens.forEach(t => { if (b.tokens.has(t)) shared++; });
        const score = days - shared * 10;
        if (score < bestScore) { bestScore = score; best = bi; }
      });
      if (best >= 0) { usedB.add(best); s.match = best; matched.push({ date_statement: s.date, date_books: book[best].date, amount: s.amount, direction: s.amount > 0 ? 'in' : 'out', statement: s.desc, books: book[best].desc, reference: s.ref || book[best].ref, days_apart: k.dayDiff(s.date, book[best].date), statement_row: s.row, books_row: book[best].row }); }
    });
    const onlyStmt = stmt.filter(s => s.match === undefined).map(s => ({ date: s.date, amount: s.amount, direction: s.amount > 0 ? 'in' : 'out', description: s.desc, reference: s.ref, statement_row: s.row, likely: /charge|fee|gst|interest|int\.|sms|amc/i.test(s.desc) ? 'bank charge or interest — not entered' : s.amount > 0 ? 'receipt not entered' : 'payment not entered' }));
    const onlyBook = book.filter((b, bi) => !usedB.has(bi)).map(b => ({ date: b.date, amount: b.amount, direction: b.amount > 0 ? 'in' : 'out', particulars: b.desc, reference: b.ref, books_row: b.row, likely: b.amount < 0 ? 'cheque issued, not yet presented' : 'deposit in transit or wrong date' }));
    return { matched, onlyStmt, onlyBook };
  }

  function mount(root) {
    const k = K(); const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const st = { s: { headers: [], rows: [], map: {} }, b: { headers: [], rows: [], map: {} } };
    const msg = k.msgBox();
    const two = k.el('div', 'biz-two');
    const side = (key, title, label, fields) => {
      const col = k.el('div', 'biz-col'); col.appendChild(k.h3(title));
      const mapBox = k.el('div');
      const drop = k.dropzone(label, '.xlsx,.csv', async (f) => {
        try { msg.say('Reading…', 'note'); const t = await k.readTable(f); const h = k.splitHeader(t.sheets[0].rows); st[key].headers = h.headers; st[key].rows = h.rows; st[key].map = k.autoMap(fields, h.headers); mapBox.innerHTML = ''; mapBox.appendChild(k.mapPanel(title, fields, h.headers, st[key].map)); drop.say(f.name, h.rows.length + ' rows'); msg.say(''); }
        catch (e) { msg.say(e.message, 'error'); }
      });
      col.appendChild(drop); col.appendChild(mapBox); return col;
    };
    two.appendChild(side('s', '1 · Bank statement', 'Choose the bank statement (Excel or CSV)', FIELDS('statement')));
    two.appendChild(side('b', '2 · Bank ledger from your books', 'Choose the ledger export (Excel or CSV)', FIELDS('books')));
    io.appendChild(two);
    const bar = k.el('div', 'opt-bar');
    const win = k.textInput('br-window', '3', '', 'number'); win.min = 0; win.max = 60;
    bar.appendChild(k.field('Date window (days)', win, 'How far apart the two dates may be'));
    io.appendChild(bar);
    const run = k.el('div', 'io-actions pdf-run'); run.appendChild(k.button('Reconcile', 'btn-primary', go)); io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    function go() {
      result.innerHTML = '';
      if (!st.s.rows.length || !st.b.rows.length) { msg.say('Choose both files first.', 'note'); return; }
      for (const [key, fields, name] of [['s', FIELDS('statement'), 'Statement'], ['b', FIELDS('books'), 'Books']]) { const m = k.missing(fields, st[key].map); if (m.length) { msg.say(name + ': map ' + m.join(', ') + ' first.', 'error'); return; } }
      const stmt = entries(st.s.rows, st.s.map, 'statement'), book = entries(st.b.rows, st.b.map, 'books');
      const R = reconcile(stmt, book, Math.max(0, Number(win.value) || 0));
      const S = k.S();
      const sum = (l, f) => Math.round(l.reduce((a, x) => a + (Number(x[f]) || 0), 0) * 100) / 100;
      const inS = sum(stmt, 'amount'), inB = sum(book, 'amount');
      const summary = [['Measure', 'Statement', 'Books'], ['Entries', stmt.length, book.length], ['Net movement', inS, inB], ['Matched entries', R.matched.length, R.matched.length], ['Unmatched entries', R.onlyStmt.length, R.onlyBook.length], ['Unmatched amount (net)', sum(R.onlyStmt, 'amount'), sum(R.onlyBook, 'amount')], ['Difference in net movement (statement minus books)', Math.round((inS - inB) * 100) / 100, '']];
      const sheets = [{ name: 'Summary', rows: summary }, { name: 'Matched', rows: S.objectsToRows(R.matched) }, { name: 'Only on statement', rows: S.objectsToRows(R.onlyStmt) }, { name: 'Only in books', rows: S.objectsToRows(R.onlyBook) }];
      result.appendChild(k.summaryCard('Reconciled: ' + R.matched.length + ' matched, ' + R.onlyStmt.length + ' only on the statement, ' + R.onlyBook.length + ' only in the books', 'Net movement differs by ' + k.inr(inS - inB), [k.downloadButton('bank-reconciliation.xlsx', () => S.writeXlsx(sheets))]));
      result.appendChild(k.statGrid(summary.slice(1).map(r => [r[0], (typeof r[1] === 'number' && r[0] !== 'Entries' && r[0] !== 'Matched entries' && r[0] !== 'Unmatched entries' ? k.inr(r[1]) : r[1]) + (r[2] !== '' ? ' / ' + (typeof r[2] === 'number' && !/entries/i.test(r[0]) ? k.inr(r[2]) : r[2]) : '')])));
      for (const [title, rows] of [['Only on statement', sheets[2].rows], ['Only in books', sheets[3].rows], ['Matched', sheets[1].rows]]) if (rows.length > 1) { result.appendChild(k.h3(title + ' (' + (rows.length - 1) + ')')); result.appendChild(k.previewTable(rows, 15)); }
      msg.say(''); result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="bank-reconciliation"]'); if (r) mount(r); });
  window.MVRBankRecon = { reconcile, entries };
})();
