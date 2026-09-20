/**
 * A double-entry ledger, in the browser.
 *
 * This is the spine every other accounting feature hangs from: a chart of
 * accounts, journals whose lines sum to zero, and the statements derived
 * from them rather than stored beside them. Nothing here knows about the
 * page, so it can be tested on its own and later moved behind a login
 * without being rewritten.
 *
 * Two decisions worth knowing before you read the rest.
 *
 * MONEY IS INTEGER MINOR UNITS. Every amount in this file is a whole number
 * of pence or paise. 0.1 + 0.2 is not 0.3 in binary floating point, and a
 * ledger that is out by a penny is a ledger nobody trusts. Parse with
 * money.parse, print with money.fmt, and never put a fraction in a journal.
 *
 * DEBITS ARE POSITIVE. A line's `amount` is signed: positive debits the
 * account, negative credits it, and a journal is valid only when its lines
 * sum to exactly zero. (The Tally converter on this site uses the opposite
 * sign because Tally's XML demands it; that is a format, this is the book.)
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- */
  /* money                                                            */
  /* ---------------------------------------------------------------- */

  const money = {
    /** "1,234.56" | 1234.56 | "(45.00)" | "45 Cr" -> integer minor units. */
    parse(v, minor) {
      const m = minor === undefined ? 100 : minor;
      if (typeof v === 'number') {
        if (!Number.isFinite(v)) return NaN;
        return Math.round(v * m);
      }
      let s = String(v == null ? '' : v).trim();
      if (!s || s === '-') return 0;
      let sign = 1;
      if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
      if (/(^|\s)cr\.?$/i.test(s)) sign = -1;
      if (/(^|\s)dr\.?$/i.test(s)) sign = 1;
      s = s.replace(/[,\s]/g, '').replace(/[₹$£€]/g, '').replace(/^rs\.?/i, '').replace(/(cr|dr)\.?$/i, '');
      if (/^-/.test(s)) { sign = -sign; s = s.slice(1); }
      if (!/^\d*(\.\d*)?$/.test(s) || s === '' || s === '.') return NaN;
      /* split on the point so no float ever touches the value */
      const [whole, frac = ''] = s.split('.');
      const pad = (frac + '0000000000').slice(0, String(m).length - 1);
      const n = Number(whole || '0') * m + Number(pad || '0');
      return Number.isFinite(n) ? sign * n : NaN;
    },
    /** 123456 -> "1234.56" */
    fmt(n, minor) {
      const m = minor === undefined ? 100 : minor;
      const neg = n < 0, a = Math.abs(Math.round(n));
      const d = String(m).length - 1;
      return (neg ? '-' : '') + Math.floor(a / m) + (d ? '.' + String(a % m).padStart(d, '0') : '');
    },
    /** 123456 -> "1,234.56" (or "1,23,456.00" in the Indian system) */
    pretty(n, locale, minor) {
      const m = minor === undefined ? 100 : minor;
      const d = String(m).length - 1;
      return (n < 0 ? '-' : '') + (Math.abs(n) / m).toLocaleString(locale || 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
    },
    /** Split `n` in the given ratios so the parts always add back to `n`. */
    split(n, parts) {
      const total = parts.reduce((a, b) => a + b, 0) || 1;
      const out = parts.map(p => Math.trunc(n * p / total));
      let rest = n - out.reduce((a, b) => a + b, 0);
      for (let i = 0; rest !== 0; i = (i + 1) % out.length) { const step = rest > 0 ? 1 : -1; out[i] += step; rest -= step; }
      return out;
    },
    /** Tax on a net amount, or the tax inside a gross one. */
    taxOn(net, rateBp) { return Math.round(net * rateBp / 10000); },
    taxIn(gross, rateBp) { return gross - Math.round(gross * 10000 / (10000 + rateBp)); }
  };

  /* ---------------------------------------------------------------- */
  /* charts of accounts                                               */
  /* ---------------------------------------------------------------- */

  /* [code, name, type, group, flags] — flags: bank, receivable, payable,
     taxOutput, taxInput, retained, suspense */
  const CHARTS = {
    uk: {
      name: 'United Kingdom — small company',
      currency: 'GBP', locale: 'en-GB', taxName: 'VAT',
      accounts: [
        ['0050', 'Plant and machinery', 'asset', 'Fixed assets'],
        ['0060', 'Plant and machinery depreciation', 'asset', 'Fixed assets', { contra: true }],
        ['0090', 'Office equipment', 'asset', 'Fixed assets'],
        ['1000', 'Stock', 'asset', 'Current assets'],
        ['1100', 'Trade debtors', 'asset', 'Current assets', { receivable: true }],
        ['1200', 'Bank current account', 'asset', 'Current assets', { bank: true }],
        ['1230', 'Petty cash', 'asset', 'Current assets', { bank: true }],
        ['2100', 'Trade creditors', 'liability', 'Current liabilities', { payable: true }],
        ['2200', 'VAT on sales', 'liability', 'Current liabilities', { taxOutput: true }],
        ['2201', 'VAT on purchases', 'asset', 'Current liabilities', { taxInput: true, contra: true }],
        ['2210', 'PAYE and National Insurance', 'liability', 'Current liabilities'],
        ['2300', 'Loans', 'liability', 'Long-term liabilities'],
        ['3000', 'Share capital', 'equity', 'Capital and reserves'],
        ['3200', 'Retained earnings', 'equity', 'Capital and reserves', { retained: true }],
        ['4000', 'Sales', 'income', 'Turnover'],
        ['4009', 'Sales — zero rated', 'income', 'Turnover'],
        ['4900', 'Other income', 'income', 'Other income'],
        ['5000', 'Purchases', 'expense', 'Cost of sales'],
        ['5100', 'Carriage', 'expense', 'Cost of sales'],
        ['6000', 'Subcontractors', 'expense', 'Direct costs'],
        ['7000', 'Salaries', 'expense', 'Administrative expenses'],
        ['7006', 'Employer National Insurance', 'expense', 'Administrative expenses'],
        ['7100', 'Rent', 'expense', 'Administrative expenses'],
        ['7200', 'Light and heat', 'expense', 'Administrative expenses'],
        ['7300', 'Motor expenses', 'expense', 'Administrative expenses'],
        ['7400', 'Travel and subsistence', 'expense', 'Administrative expenses'],
        ['7500', 'Telephone and internet', 'expense', 'Administrative expenses'],
        ['7501', 'Software and subscriptions', 'expense', 'Administrative expenses'],
        ['7600', 'Accountancy and legal', 'expense', 'Administrative expenses'],
        ['7700', 'Insurance', 'expense', 'Administrative expenses'],
        ['7800', 'Repairs and maintenance', 'expense', 'Administrative expenses'],
        ['7900', 'Bank charges and interest', 'expense', 'Administrative expenses'],
        ['8000', 'Depreciation', 'expense', 'Administrative expenses'],
        ['9998', 'Suspense', 'asset', 'Current assets', { suspense: true }]
      ],
      /* code -> [label, rate in basis points, direction] */
      taxCodes: {
        SR: ['Standard rated 20%', 2000, 'both'],
        RR: ['Reduced rated 5%', 500, 'both'],
        ZR: ['Zero rated 0%', 0, 'both'],
        EX: ['Exempt', 0, 'both'],
        OS: ['Outside the scope', 0, 'both'],
        NO: ['No VAT', 0, 'both']
      }
    },
    in: {
      name: 'India — trading and services',
      currency: 'INR', locale: 'en-IN', taxName: 'GST',
      accounts: [
        ['1000', 'Fixed assets', 'asset', 'Fixed Assets'],
        ['1010', 'Accumulated depreciation', 'asset', 'Fixed Assets', { contra: true }],
        ['1100', 'Stock-in-hand', 'asset', 'Current Assets'],
        ['1200', 'Sundry debtors', 'asset', 'Current Assets', { receivable: true }],
        ['1300', 'Bank accounts', 'asset', 'Current Assets', { bank: true }],
        ['1310', 'Cash-in-hand', 'asset', 'Current Assets', { bank: true }],
        ['1400', 'Input CGST', 'asset', 'Duties and Taxes', { taxInput: true, contra: true, part: 'cgst' }],
        ['1401', 'Input SGST', 'asset', 'Duties and Taxes', { taxInput: true, contra: true, part: 'sgst' }],
        ['1402', 'Input IGST', 'asset', 'Duties and Taxes', { taxInput: true, contra: true, part: 'igst' }],
        ['2000', 'Sundry creditors', 'liability', 'Current Liabilities', { payable: true }],
        ['2100', 'Output CGST', 'liability', 'Duties and Taxes', { taxOutput: true, part: 'cgst' }],
        ['2101', 'Output SGST', 'liability', 'Duties and Taxes', { taxOutput: true, part: 'sgst' }],
        ['2102', 'Output IGST', 'liability', 'Duties and Taxes', { taxOutput: true, part: 'igst' }],
        ['2200', 'TDS payable', 'liability', 'Duties and Taxes'],
        ['2300', 'Secured loans', 'liability', 'Loans'],
        ['3000', 'Capital account', 'equity', 'Capital Account'],
        ['3200', 'Reserves and surplus', 'equity', 'Capital Account', { retained: true }],
        ['4000', 'Sales', 'income', 'Sales Accounts'],
        ['4900', 'Other income', 'income', 'Indirect Incomes'],
        ['5000', 'Purchases', 'expense', 'Purchase Accounts'],
        ['6000', 'Direct expenses', 'expense', 'Direct Expenses'],
        ['7000', 'Salaries and wages', 'expense', 'Indirect Expenses'],
        ['7100', 'Rent', 'expense', 'Indirect Expenses'],
        ['7200', 'Electricity', 'expense', 'Indirect Expenses'],
        ['7300', 'Travelling and conveyance', 'expense', 'Indirect Expenses'],
        ['7500', 'Telephone and internet', 'expense', 'Indirect Expenses'],
        ['7600', 'Professional fees', 'expense', 'Indirect Expenses'],
        ['7900', 'Bank charges', 'expense', 'Indirect Expenses'],
        ['8000', 'Depreciation', 'expense', 'Indirect Expenses'],
        ['9998', 'Suspense', 'asset', 'Current Assets', { suspense: true }]
      ],
      taxCodes: {
        G28: ['GST 28%', 2800, 'both'], G18: ['GST 18%', 1800, 'both'], G12: ['GST 12%', 1200, 'both'],
        G5: ['GST 5%', 500, 'both'], G0: ['Nil rated 0%', 0, 'both'],
        EX: ['Exempt', 0, 'both'], NG: ['Non-GST', 0, 'both']
      }
    }
  };

  const TYPES = { asset: 1, expense: 1, liability: -1, equity: -1, income: -1 };  /* natural side */
  const isProfitAndLoss = (t) => t === 'income' || t === 'expense';

  /* ---------------------------------------------------------------- */
  /* the book                                                         */
  /* ---------------------------------------------------------------- */

  function newBook(opts) {
    const o = opts || {};
    const chartKey = o.chart || 'uk';
    const chart = CHARTS[chartKey];
    if (!chart) throw new Error('No chart of accounts called "' + chartKey + '".');
    const book = {
      version: 1,
      name: o.name || 'Untitled book',
      chart: chartKey,
      currency: o.currency || chart.currency,
      locale: chart.locale,
      taxName: chart.taxName,
      taxCodes: Object.assign({}, chart.taxCodes),
      /* the state the business trades in, for the India intra/inter split */
      homeState: o.homeState || '',
      start: o.start || null,
      end: o.end || null,
      lockedTo: o.lockedTo || null,
      accounts: {},
      journals: [],
      nextId: 1
    };
    for (const a of chart.accounts) addAccount(book, { code: a[0], name: a[1], type: a[2], group: a[3] }, a[4] || {});
    return book;
  }

  function addAccount(book, a, flags) {
    const code = String(a.code || '').trim();
    if (!code) throw new Error('An account needs a code.');
    if (book.accounts[code]) throw new Error('Account ' + code + ' already exists (' + book.accounts[code].name + ').');
    if (!TYPES[a.type]) throw new Error('Account ' + code + ': type must be asset, liability, equity, income or expense.');
    book.accounts[code] = Object.assign({
      code, name: String(a.name || code).trim(), type: a.type,
      group: a.group || '', taxCode: a.taxCode || null
    }, flags || {}, a.flags || {});
    return book.accounts[code];
  }

  const account = (book, code) => book.accounts[String(code).trim()];
  const accountsWhere = (book, flag) => Object.values(book.accounts).filter(a => a[flag]);
  const accountWhere = (book, flag) => accountsWhere(book, flag)[0] || null;

  const ISO = /^\d{4}-\d{2}-\d{2}$/;

  /**
   * Post a journal. Throws rather than storing anything questionable: a
   * ledger that accepts a broken entry is worse than one that refuses.
   *   { date, ref, narration, source, lines: [{account, amount, memo, tax}] }
   * `amount` is signed integer minor units; debits positive. A line may
   * instead give `debit` / `credit` as amounts, which is what a spreadsheet
   * has, and they are converted here.
   */
  function post(book, entry) {
    const e = entry || {};
    const date = String(e.date || '').slice(0, 10);
    if (!ISO.test(date)) throw new Error('A journal needs a date as YYYY-MM-DD (got "' + e.date + '").');
    if (book.lockedTo && date <= book.lockedTo) throw new Error('The books are locked to ' + book.lockedTo + '; ' + date + ' is on or before that.');
    if (book.start && date < book.start) throw new Error(date + ' is before the period start (' + book.start + ').');
    if (book.end && date > book.end) throw new Error(date + ' is after the period end (' + book.end + ').');
    const raw = Array.isArray(e.lines) ? e.lines : [];
    if (raw.length < 2) throw new Error('A journal needs at least two lines.');

    const lines = raw.map((l, i) => {
      const code = String(l.account == null ? '' : l.account).trim();
      const acc = book.accounts[code];
      if (!acc) throw new Error('Line ' + (i + 1) + ': there is no account ' + (code ? '"' + code + '"' : '(blank)') + ' in this book.');
      let amount = l.amount;
      if (amount === undefined) {
        const d = l.debit === undefined || l.debit === '' ? 0 : money.parse(l.debit);
        const c = l.credit === undefined || l.credit === '' ? 0 : money.parse(l.credit);
        if (!Number.isFinite(d) || !Number.isFinite(c)) throw new Error('Line ' + (i + 1) + ': the debit or credit is not a number.');
        amount = d - c;
      }
      if (!Number.isInteger(amount)) throw new Error('Line ' + (i + 1) + ': amounts are whole minor units (pence or paise), got ' + amount + '.');
      const out = { account: code, amount, memo: l.memo ? String(l.memo).slice(0, 200) : '' };
      if (l.tax) {
        const t = book.taxCodes[l.tax.code];
        if (!t) throw new Error('Line ' + (i + 1) + ': unknown tax code "' + l.tax.code + '".');
        out.tax = { code: l.tax.code, rate: t[1], net: l.tax.net | 0, amount: l.tax.amount | 0, direction: l.tax.direction === 'input' ? 'input' : 'output' };
      }
      return out;
    });

    const sum = lines.reduce((s, l) => s + l.amount, 0);
    if (sum !== 0) throw new Error('This journal does not balance: debits less credits is ' + money.fmt(sum) + '. Every journal must sum to zero.');
    if (lines.every(l => l.amount === 0)) throw new Error('Every line of this journal is zero.');

    const j = {
      id: 'J' + String(book.nextId++).padStart(6, '0'),
      date, ref: String(e.ref || '').slice(0, 60), narration: String(e.narration || '').slice(0, 300),
      source: String(e.source || 'manual').slice(0, 40),
      party: e.party ? String(e.party).slice(0, 120) : '',
      attachments: Array.isArray(e.attachments) ? e.attachments.slice(0, 20) : [],
      lines
    };
    book.journals.push(j);
    return j;
  }

  /** Post and return the error instead of throwing — for bulk imports. */
  function tryPost(book, entry) {
    try { return { ok: true, journal: post(book, entry) }; }
    catch (err) { return { ok: false, error: err.message }; }
  }

  /* ---------------------------------------------------------------- */
  /* reading the book                                                 */
  /* ---------------------------------------------------------------- */

  const inRange = (d, from, to) => (!from || d >= from) && (!to || d <= to);

  /** code -> { debit, credit, net } over a date range. Net is debit-positive. */
  function balances(book, opt) {
    const o = opt || {};
    const out = {};
    for (const code of Object.keys(book.accounts)) out[code] = { debit: 0, credit: 0, net: 0 };
    for (const j of book.journals) {
      if (!inRange(j.date, o.from, o.to)) continue;
      for (const l of j.lines) {
        const b = out[l.account];
        if (l.amount >= 0) b.debit += l.amount; else b.credit += -l.amount;
        b.net += l.amount;
      }
    }
    return out;
  }

  /** Rows for a trial balance at a date, plus its totals. */
  function trialBalance(book, opt) {
    const o = opt || {};
    const b = balances(book, { from: o.from, to: o.to });
    const rows = [];
    let debit = 0, credit = 0;
    for (const code of Object.keys(book.accounts).sort()) {
      const a = book.accounts[code], n = b[code].net;
      if (n === 0 && !o.showZero) continue;
      rows.push({ code, name: a.name, type: a.type, group: a.group, debit: n > 0 ? n : 0, credit: n < 0 ? -n : 0, net: n });
      if (n > 0) debit += n; else credit += -n;
    }
    return { rows, debit, credit, balanced: debit === credit, difference: debit - credit };
  }

  /** Income and expenses for a period, grouped, with the profit. */
  function profitAndLoss(book, opt) {
    const o = opt || {};
    const b = balances(book, { from: o.from || book.start, to: o.to || book.end });
    const groups = {};
    let income = 0, expense = 0;
    for (const code of Object.keys(book.accounts).sort()) {
      const a = book.accounts[code];
      if (!isProfitAndLoss(a.type)) continue;
      const n = b[code].net;
      if (n === 0 && !o.showZero) continue;
      /* income is credit-natural, so present it positive */
      const amount = a.type === 'income' ? -n : n;
      (groups[a.group] = groups[a.group] || { group: a.group, type: a.type, total: 0, rows: [] });
      groups[a.group].rows.push({ code, name: a.name, amount });
      groups[a.group].total += amount;
      if (a.type === 'income') income += amount; else expense += amount;
    }
    return { groups: Object.values(groups), income, expense, profit: income - expense, from: o.from || book.start, to: o.to || book.end };
  }

  /**
   * Assets, liabilities and equity at a date. The profit for the period is
   * shown inside equity rather than posted, which is what makes the sheet
   * balance without a year-end journal having been made yet.
   */
  function balanceSheet(book, opt) {
    const o = opt || {};
    const asOn = o.asOn || book.end;
    const b = balances(book, { to: asOn });
    const side = { asset: [], liability: [], equity: [] };
    let assets = 0, liabilities = 0, equity = 0, pl = 0;
    for (const code of Object.keys(book.accounts).sort()) {
      const a = book.accounts[code], n = b[code].net;
      if (isProfitAndLoss(a.type)) { pl += a.type === 'income' ? -n : n * -1; continue; }
      if (n === 0 && !o.showZero) continue;
      const amount = a.type === 'asset' ? n : -n;   /* present each side positive */
      side[a.type].push({ code, name: a.name, group: a.group, amount });
      if (a.type === 'asset') assets += amount; else if (a.type === 'liability') liabilities += amount; else equity += amount;
    }
    /* pl accumulated as income - expense */
    const profit = pl;
    if (profit !== 0) side.equity.push({ code: '', name: 'Profit for the period', group: 'Capital and reserves', amount: profit, derived: true });
    const equityTotal = equity + profit;
    return {
      asOn, assets: side.asset, liabilities: side.liability, equity: side.equity,
      totalAssets: assets, totalLiabilities: liabilities, totalEquity: equityTotal,
      difference: assets - (liabilities + equityTotal),
      balanced: assets === liabilities + equityTotal
    };
  }

  /** Every posting to one account, running balance included. */
  function generalLedger(book, code, opt) {
    const o = opt || {};
    const a = account(book, code);
    if (!a) throw new Error('There is no account ' + code + '.');
    let opening = 0;
    const rows = [];
    for (const j of book.journals) {
      for (const l of j.lines) {
        if (l.account !== a.code) continue;
        if (o.from && j.date < o.from) { opening += l.amount; continue; }
        if (o.to && j.date > o.to) continue;
        rows.push({ date: j.date, id: j.id, ref: j.ref, narration: l.memo || j.narration, party: j.party, debit: l.amount > 0 ? l.amount : 0, credit: l.amount < 0 ? -l.amount : 0, amount: l.amount });
      }
    }
    rows.sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : (x.id < y.id ? -1 : 1));
    let run = opening;
    for (const r of rows) { run += r.amount; r.balance = run; }
    return { account: a, opening, rows, closing: run };
  }

  /**
   * The VAT or GST figures for a period, from the tax recorded on lines.
   * UK: the nine boxes as HMRC numbers them. India: the CGST/SGST/IGST
   * split for output and input, and the net payable.
   *
   * This computes the figures. It does not file anything: filing a VAT
   * return under Making Tax Digital needs software recognised by HMRC, and
   * this is not that.
   */
  function taxReturn(book, opt) {
    const o = opt || {};
    const from = o.from || book.start, to = o.to || book.end;
    let outputTax = 0, inputTax = 0, outputNet = 0, inputNet = 0;
    const parts = { cgst: { out: 0, in: 0 }, sgst: { out: 0, in: 0 }, igst: { out: 0, in: 0 } };
    const byCode = {};
    for (const j of book.journals) {
      if (!inRange(j.date, from, to)) continue;
      for (const l of j.lines) {
        /* the split by component is read off the tax accounts themselves,
           not off the line that carries the tax code — that line is the
           income or expense one, and it never touches a CGST account */
        const acc = book.accounts[l.account];
        if (acc && acc.part) {
          if (acc.taxOutput) parts[acc.part].out += -l.amount;
          else if (acc.taxInput) parts[acc.part].in += l.amount;
        }
        if (!l.tax) continue;
        const t = l.tax;
        const rec = byCode[t.code] = byCode[t.code] || { code: t.code, label: (book.taxCodes[t.code] || [t.code])[0], outputNet: 0, outputTax: 0, inputNet: 0, inputTax: 0 };
        if (t.direction === 'output') { outputTax += t.amount; outputNet += t.net; rec.outputNet += t.net; rec.outputTax += t.amount; }
        else { inputTax += t.amount; inputNet += t.net; rec.inputNet += t.net; rec.inputTax += t.amount; }
      }
    }
    const common = { from, to, outputNet, outputTax, inputNet, inputTax, net: outputTax - inputTax, byCode: Object.values(byCode) };
    if (book.chart === 'uk') {
      return Object.assign(common, {
        kind: 'uk-vat',
        boxes: {
          1: outputTax, 2: 0, 3: outputTax, 4: inputTax, 5: Math.abs(outputTax - inputTax),
          6: Math.round(outputNet / 100) * 100, 7: Math.round(inputNet / 100) * 100, 8: 0, 9: 0
        },
        payable: outputTax - inputTax
      });
    }
    return Object.assign(common, { kind: 'india-gst', parts, payable: outputTax - inputTax });
  }

  /** Outstanding balances by party, from the receivable or payable account. */
  function ageing(book, opt) {
    const o = opt || {};
    const flag = o.kind === 'payable' ? 'payable' : 'receivable';
    const accs = accountsWhere(book, flag).map(a => a.code);
    if (!accs.length) return { parties: [], total: 0 };
    const asOn = o.asOn || book.end || new Date().toISOString().slice(0, 10);
    const by = new Map();
    for (const j of book.journals) {
      if (j.date > asOn) continue;
      for (const l of j.lines) {
        if (accs.indexOf(l.account) < 0) continue;
        const name = j.party || '(no party named)';
        const p = by.get(name) || { party: name, balance: 0, items: [] };
        p.balance += flag === 'receivable' ? l.amount : -l.amount;
        p.items.push({ date: j.date, id: j.id, ref: j.ref, amount: flag === 'receivable' ? l.amount : -l.amount });
        by.set(name, p);
      }
    }
    const parties = [...by.values()].filter(p => p.balance !== 0).sort((a, b) => b.balance - a.balance);
    return { parties, total: parties.reduce((s, p) => s + p.balance, 0), asOn };
  }

  /**
   * Everything that would make an accountant distrust the book. Run it
   * before producing anything; an empty list is the only acceptable result.
   */
  function check(book) {
    const problems = [];
    for (const j of book.journals) {
      const sum = j.lines.reduce((s, l) => s + l.amount, 0);
      if (sum !== 0) problems.push(j.id + ' (' + j.date + ') does not balance by ' + money.fmt(sum) + '.');
      for (const l of j.lines) if (!book.accounts[l.account]) problems.push(j.id + ' posts to account ' + l.account + ', which is not in the chart.');
      if (!ISO.test(j.date)) problems.push(j.id + ' has an unreadable date.');
    }
    const tb = trialBalance(book, { showZero: false });
    if (!tb.balanced) problems.push('The trial balance is out by ' + money.fmt(tb.difference) + '.');
    const bs = balanceSheet(book, {});
    if (!bs.balanced) problems.push('The balance sheet is out by ' + money.fmt(bs.difference) + '.');
    const susp = accountWhere(book, 'suspense');
    if (susp) {
      const n = balances(book, {})[susp.code].net;
      if (n !== 0) problems.push('Suspense holds ' + money.fmt(n) + ' — every entry in it is one nobody has identified yet.');
    }
    const ids = new Set();
    for (const j of book.journals) { if (ids.has(j.id)) problems.push('Two journals share the id ' + j.id + '.'); ids.add(j.id); }
    return problems;
  }

  /* ---------------------------------------------------------------- */
  /* posting helpers — the four entries that make up most of a book    */
  /* ---------------------------------------------------------------- */

  /* Amounts reaching these helpers are either a string off a spreadsheet,
     which still has to be parsed, or a number, which by this file's rule
     is ALREADY minor units. Parsing a number again multiplies it by a
     hundred, which is exactly what it did before this existed. */
  const amt = (v) => typeof v === 'number' ? Math.round(v) : money.parse(v);

  /** A sale: debtor (or bank) debited gross, income credited net, tax credited. */
  function sale(book, s) {
    const chart = CHARTS[book.chart];
    const net = amt(s.net !== undefined ? s.net : s.amount);
    const code = s.taxCode || 'NO';
    const rate = (book.taxCodes[code] || [null, 0])[1];
    const tax = s.tax !== undefined ? amt(s.tax) : money.taxOn(net, rate);
    const to = s.paid ? (s.bank || (accountWhere(book, 'bank') || {}).code) : (s.debtor || (accountWhere(book, 'receivable') || {}).code);
    const incomeCode = s.income || '4000';
    const lines = [{ account: to, amount: net + tax }, { account: incomeCode, amount: -net, tax: { code, net, amount: tax, direction: 'output' } }];
    if (tax) {
      const outs = accountsWhere(book, 'taxOutput');
      if (book.chart === 'in' && s.interState === false && outs.length >= 2) {
        const [c, sg] = money.split(tax, [1, 1]);
        lines.push({ account: outs.find(a => a.part === 'cgst').code, amount: -c });
        lines.push({ account: outs.find(a => a.part === 'sgst').code, amount: -sg });
      } else {
        const acc = book.chart === 'in' ? outs.find(a => a.part === 'igst') : outs[0];
        lines.push({ account: acc.code, amount: -tax });
      }
    }
    return post(book, { date: s.date, ref: s.ref, narration: s.narration || ('Sale' + (s.party ? ' to ' + s.party : '')), party: s.party, source: s.source || 'sales', attachments: s.attachments, lines });
  }

  /** A purchase: expense debited net, tax debited, creditor (or bank) credited. */
  function purchase(book, s) {
    const net = amt(s.net !== undefined ? s.net : s.amount);
    const code = s.taxCode || 'NO';
    const rate = (book.taxCodes[code] || [null, 0])[1];
    const tax = s.tax !== undefined ? amt(s.tax) : money.taxOn(net, rate);
    const from = s.paid ? (s.bank || (accountWhere(book, 'bank') || {}).code) : (s.creditor || (accountWhere(book, 'payable') || {}).code);
    const expenseCode = s.expense || '5000';
    const lines = [{ account: expenseCode, amount: net, tax: { code, net, amount: tax, direction: 'input' } }, { account: from, amount: -(net + tax) }];
    if (tax) {
      const ins = accountsWhere(book, 'taxInput');
      if (book.chart === 'in' && s.interState === false && ins.length >= 2) {
        const [c, sg] = money.split(tax, [1, 1]);
        lines.splice(1, 0, { account: ins.find(a => a.part === 'cgst').code, amount: c });
        lines.splice(2, 0, { account: ins.find(a => a.part === 'sgst').code, amount: sg });
      } else {
        const acc = book.chart === 'in' ? ins.find(a => a.part === 'igst') : ins[0];
        lines.splice(1, 0, { account: acc.code, amount: tax });
      }
    }
    return post(book, { date: s.date, ref: s.ref, narration: s.narration || ('Purchase' + (s.party ? ' from ' + s.party : '')), party: s.party, source: s.source || 'purchases', attachments: s.attachments, lines });
  }

  /** Money in or out of the bank against one other account. */
  function bankLine(book, s) {
    const amount = amt(s.amount);
    const bank = s.bank || (accountWhere(book, 'bank') || {}).code;
    const other = s.account || (accountWhere(book, 'suspense') || {}).code;
    const lines = amount >= 0
      ? [{ account: bank, amount }, { account: other, amount: -amount }]
      : [{ account: other, amount: -amount }, { account: bank, amount }];
    return post(book, { date: s.date, ref: s.ref, narration: s.narration, party: s.party, source: s.source || 'bank', attachments: s.attachments, lines });
  }

  /* ---------------------------------------------------------------- */
  /* saving                                                           */
  /* ---------------------------------------------------------------- */

  const toJSON = (book) => JSON.stringify(book);
  function fromJSON(text) {
    const b = typeof text === 'string' ? JSON.parse(text) : text;
    if (!b || b.version !== 1 || !b.accounts || !Array.isArray(b.journals)) throw new Error('That is not a book this version can read.');
    return b;
  }

  const api = {
    money, CHARTS, TYPES, isProfitAndLoss,
    newBook, addAccount, account, accountsWhere, accountWhere,
    post, tryPost, sale, purchase, bankLine,
    balances, trialBalance, profitAndLoss, balanceSheet, generalLedger, taxReturn, ageing, check,
    toJSON, fromJSON
  };
  if (typeof window !== 'undefined') window.MVRLedger = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
