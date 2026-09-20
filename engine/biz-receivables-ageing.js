/**
 * Who owes you, for how long, and the letter that asks for it.
 *
 * Every small business has this spreadsheet and almost none of them have
 * the report: invoices sorted into age brackets, a total per customer, and
 * a reminder that names the invoices rather than saying "your account is
 * overdue". The arithmetic is trivial; doing it every month is not, which
 * is why the money sits there. This does both, on the device, because a
 * debtors list is the most commercially sensitive file a business owns.
 */
(function () {
  'use strict';
  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['receivables-ageing'] = {
    title: 'Receivables Ageing & Payment Reminders',
    short: 'Receivables Ageing',
    description: 'Turn a list of unpaid invoices into a proper ageing report — 0–30, 31–60, 61–90, over 90 days, by customer — and get a reminder letter for each debtor that names their invoices and their total, with the tone stepping up the longer it has been. Runs in your browser; your debtors list is not uploaded.',
    keywords: ['accounts receivable ageing report', 'debtors ageing analysis excel', 'aging report generator', 'payment reminder letter generator', 'overdue invoice chasing', 'outstanding invoice tracker', 'dso calculator', 'invoice dunning letters'],
    glyph: 'i-ageing',
    glyphSvg: '<symbol id="i-ageing" viewBox="0 0 24 24">\n  <path d="M3 20V9M8.5 20V5M14 20v-8M19.5 20v-5"/>\n  <path d="M2 20h20" class="thin"/>\n  <circle cx="17.5" cy="6.5" r="4"/>\n  <path d="M17.5 4.4v2.1l1.5 1" class="thin"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/pdfcore.bundle.js', '/engine/biz-receivables-ageing.js'],
    tips: [
      'The file can be anything your accounting package exports: a customer, an invoice number, a date and an amount is the minimum. Columns are matched by name and can be corrected.',
      'If there is no due date column, give the credit days you sell on and the due date is worked out from the invoice date. Where a row has its own due date, that one wins.',
      'Map the received or paid column and the balance is invoice minus received, so part payments age correctly instead of the whole invoice sitting in the oldest bucket.',
      'The buckets are yours to change. Businesses selling on 30 days usually want 0–30, 31–60, 61–90, 90+; on 60-day terms, shift them all. Anything not yet due is counted separately and never chased.',
      'The reminder letters step up on their own: a note for something a fortnight late, a firmer letter after six weeks, a final one beyond that. Read them before sending — they are drafts with your name on them, not ours.',
      'Nothing here is sent anywhere. The letters come back as a PDF to print or attach, and as a CSV if you would rather mail-merge them through your own email.'
    ],
    faq: [
      { q: 'What counts as overdue?', a: 'Days between the due date and the date you set as "as on", counting only whole days past. An invoice due today is not overdue; one due yesterday is one day overdue. Anything with a due date in the future sits under "Not yet due" and is left out of every reminder.' },
      { q: 'How is the average age worked out?', a: 'It is weighted by money, not by invoice count: a lakh sixty days late moves it far more than a thousand rupees ninety days late. That is the number worth watching month to month, and it is the one a bank asks about.' },
      { q: 'Are the letters legally safe to send?', a: 'They state facts — the invoices, the amounts, the dates, and what you would like to happen — and they make no threat. The final letter says the account will be put on hold and recovery considered, which is a statement of intent, not a legal notice. If you need a statutory demand or a notice under your own contract terms, that is a job for your solicitor or chartered accountant.' },
      { q: 'Can I add my payment terms or interest clause?', a: 'Yes — whatever you type into the terms line is printed under every letter, so an interest or late-payment clause from your own invoice terms goes in exactly as you word it. The tool does not calculate interest, because the rate and the entitlement depend on your contract and your jurisdiction.' },
      { q: 'Is my debtors list uploaded?', a: 'No. It is read, aged and written back out by your own browser. Customer names, amounts and contact details never leave the device.' }
    ]
  };
  if (typeof document === 'undefined') return;

  const K = () => window.MVRBizKit;

  const FIELDS = [
    { key: 'customer', label: 'Customer', need: true, aliases: ['customer', 'customername', 'party', 'partyname', 'client', 'account', 'accountname', 'debtor', 'name', 'ledger', 'buyer'] },
    { key: 'inv', label: 'Invoice number', need: true, aliases: ['invoiceno', 'invoicenumber', 'invoice', 'billno', 'docno', 'documentnumber', 'reference', 'refno', 'vchno'] },
    { key: 'date', label: 'Invoice date', need: true, aliases: ['invoicedate', 'date', 'billdate', 'docdate', 'issuedate'] },
    { key: 'due', label: 'Due date', aliases: ['duedate', 'paymentdue', 'dueon', 'maturitydate'] },
    { key: 'credit', label: 'Credit days', aliases: ['creditdays', 'terms', 'paymentterms', 'creditperiod', 'days'] },
    { key: 'amount', label: 'Invoice amount', need: true, aliases: ['invoiceamount', 'amount', 'total', 'invoicevalue', 'grandtotal', 'billamount', 'gross'] },
    { key: 'received', label: 'Amount received', aliases: ['received', 'amountreceived', 'paid', 'amountpaid', 'receipts', 'settled', 'adjusted'] },
    { key: 'balance', label: 'Balance outstanding', aliases: ['balance', 'outstanding', 'balancedue', 'amountdue', 'pending', 'closingbalance', 'netbalance'] },
    { key: 'email', label: 'Email (for the reminders)', aliases: ['email', 'emailaddress', 'mail', 'contactemail'] },
    { key: 'phone', label: 'Phone', aliases: ['phone', 'mobile', 'contact', 'phoneno', 'contactnumber'] }
  ];

  const DAY = 86400000;
  const r2 = (n) => Math.round(n * 100) / 100;
  const parseBuckets = (text) => {
    const out = [];
    for (const part of String(text || '').split(',')) {
      const s = part.trim(); if (!s) continue;
      let m = /^(\d+)\s*[-–]\s*(\d+)$/.exec(s);
      if (m) { out.push({ label: m[1] + '–' + m[2] + ' days', from: Number(m[1]), to: Number(m[2]) }); continue; }
      m = /^(?:over\s*)?(\d+)\s*\+?$/.exec(s);
      if (m) { out.push({ label: 'Over ' + m[1] + ' days', from: Number(m[1]) + 1, to: Infinity }); continue; }
    }
    return out.length ? out : [{ label: '0–30 days', from: 0, to: 30 }, { label: '31–60 days', from: 31, to: 60 }, { label: '61–90 days', from: 61, to: 90 }, { label: 'Over 90 days', from: 91, to: Infinity }];
  };

  /** Age the rows. Returns invoices, per-customer totals and the headline numbers. */
  function age(rows, map, opt) {
    const k = K();
    const get = (r, key) => map[key] === undefined ? '' : r[map[key]];
    const asOn = Date.parse(opt.asOn);
    const buckets = opt.buckets;
    const invoices = [], issues = [];
    rows.forEach((r, i) => {
      const customer = String(get(r, 'customer') || '').trim();
      const inv = String(get(r, 'inv') || '').trim();
      if (!customer || !inv) { issues.push('Row ' + (i + 2) + ': customer and invoice number are both needed.'); return; }
      const date = k.toISODate(get(r, 'date'), true);
      if (!date) { issues.push('Row ' + (i + 2) + ' (' + inv + '): the invoice date could not be read.'); return; }
      const amount = k.toNumber(get(r, 'amount'));
      if (!Number.isFinite(amount)) { issues.push('Row ' + (i + 2) + ' (' + inv + '): the amount is not a number.'); return; }
      const received = map.received === undefined ? 0 : (k.toNumber(get(r, 'received')) || 0);
      let balance = map.balance === undefined ? amount - received : k.toNumber(get(r, 'balance'));
      if (!Number.isFinite(balance)) balance = amount - received;
      balance = r2(balance);
      const creditDays = map.credit === undefined ? opt.creditDays : (Math.round(k.toNumber(get(r, 'credit'))) || opt.creditDays);
      const due = k.toISODate(get(r, 'due'), true) || new Date(Date.parse(date) + creditDays * DAY).toISOString().slice(0, 10);
      const overdue = Math.floor((asOn - Date.parse(due)) / DAY);
      invoices.push({ row: i + 2, customer, inv, date, due, amount: r2(amount), received: r2(received), balance, overdue, email: String(get(r, 'email') || '').trim(), phone: String(get(r, 'phone') || '').trim() });
    });

    const live = invoices.filter(x => x.balance > 0.005);
    const credits = invoices.filter(x => x.balance < -0.005);
    const bucketOf = (x) => x.overdue <= 0 ? -1 : buckets.findIndex(b => x.overdue >= b.from && x.overdue <= b.to);
    const byCustomer = new Map();
    for (const x of live) {
      if (!byCustomer.has(x.customer)) byCustomer.set(x.customer, { customer: x.customer, email: x.email, phone: x.phone, notDue: 0, total: 0, buckets: buckets.map(() => 0), invoices: [], oldest: 0 });
      const c = byCustomer.get(x.customer);
      const b = bucketOf(x);
      if (b < 0) c.notDue += x.balance; else c.buckets[b] += x.balance;
      c.total += x.balance;
      c.oldest = Math.max(c.oldest, x.overdue);
      c.invoices.push(x);
      if (!c.email && x.email) c.email = x.email;
      if (!c.phone && x.phone) c.phone = x.phone;
    }
    byCustomer.forEach(c => { c.notDue = r2(c.notDue); c.total = r2(c.total); c.buckets = c.buckets.map(r2); c.overdue = r2(c.total - c.notDue); c.invoices.sort((a, b) => b.overdue - a.overdue); });
    const customers = [...byCustomer.values()].sort((a, b) => b.overdue - a.overdue || b.total - a.total);

    const total = r2(live.reduce((s, x) => s + x.balance, 0));
    const overdueTotal = r2(live.filter(x => x.overdue > 0).reduce((s, x) => s + x.balance, 0));
    const weighted = overdueTotal > 0 ? Math.round(live.filter(x => x.overdue > 0).reduce((s, x) => s + x.balance * x.overdue, 0) / overdueTotal) : 0;
    const oldest = live.reduce((m, x) => Math.max(m, x.overdue), 0);
    return { invoices, live, credits, customers, buckets, total, overdueTotal, notDue: r2(total - overdueTotal), weighted, oldest, issues };
  }

  /* ---------- the letters ---------- */

  const TONES = [
    { key: 'note', head: 'A note about your account', open: 'We are writing about the invoices below, which appear to be outstanding. If payment has been sent in the last few days, please ignore this note — it may have crossed with it.', ask: 'If it has been overlooked, we would be grateful if you could arrange payment at your convenience.' },
    { key: 'reminder', head: 'Payment reminder', open: 'The invoices below are now past their due date and remain unpaid.', ask: 'Please arrange payment within seven days, or let us know when we may expect it. If there is a query on any invoice, tell us which one and we will look into it straight away.' },
    { key: 'firm', head: 'Overdue account — please respond', open: 'The invoices below are significantly overdue and we have not had a payment or a reply.', ask: 'Please arrange payment within seven days or contact us to agree a schedule. We would much rather settle this between us than take it further.' },
    { key: 'final', head: 'Final reminder', open: 'Despite earlier reminders the invoices below remain unpaid.', ask: 'Unless payment reaches us within seven days, or you contact us to agree a schedule, we will place the account on hold and consider what recovery steps are open to us. We would prefer not to.' }
  ];
  const toneFor = (days, steps) => days >= steps[2] ? TONES[3] : days >= steps[1] ? TONES[2] : days >= steps[0] ? TONES[1] : TONES[0];

  function letterLines(c, opt) {
    const tone = toneFor(c.oldest, opt.steps);
    const money = (n) => opt.symbol + ' ' + Number(n).toLocaleString(opt.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const chase = c.invoices.filter(x => x.overdue > 0);
    return {
      tone,
      subject: tone.head + ' — ' + money(r2(chase.reduce((s, x) => s + x.balance, 0))) + ' outstanding',
      body: [
        'Dear ' + c.customer + ',',
        '',
        tone.open,
        '',
        ...chase.map(x => '  ' + x.inv + '   dated ' + x.date + '   due ' + x.due + '   ' + money(x.balance) + '   ' + x.overdue + ' day' + (x.overdue === 1 ? '' : 's') + ' overdue'),
        '',
        'Total overdue: ' + money(r2(chase.reduce((s, x) => s + x.balance, 0))) + (c.notDue > 0 ? '   (a further ' + money(c.notDue) + ' is not yet due)' : ''),
        '',
        tone.ask,
        ...(opt.terms ? ['', opt.terms] : []),
        '',
        'Yours sincerely,',
        opt.fromName || '',
        opt.fromContact || ''
      ].filter(x => x !== undefined)
    };
  }

  function lettersPdf(customers, opt) {
    const core = window.MVRPdfCore;
    const [W, H] = core.PAGE_SIZES.a4;
    const m = 56, pages = [];
    for (const c of customers) {
      if (!c.invoices.some(x => x.overdue > 0)) continue;
      const L = letterLines(c, opt);
      let ops = [], y = H - m;
      const line = (text, size, font, colour) => {
        for (const part of core.wrapText(String(text), font || 'Helvetica', size || 10.5, W - m * 2)) {
          if (y < m + 40) { pages.push({ size: [W, H], ops }); ops = []; y = H - m; }
          ops.push({ text: part, x: m, y, size: size || 10.5, font: font || 'Helvetica', colour });
          y -= (size || 10.5) + 4;
        }
      };
      ops.push({ rect: [0, H - 5, W, 5], fill: '#8a1c1c' });
      if (opt.fromName) { ops.push({ text: opt.fromName, x: m, y, size: 13, font: 'Helvetica-Bold' }); y -= 18; }
      if (opt.fromContact) { ops.push({ text: opt.fromContact, x: m, y, size: 9, colour: '#666666' }); y -= 16; }
      ops.push({ text: opt.asOn, x: W - m, y: y, size: 9, align: 'right', colour: '#666666' });
      y -= 22;
      ops.push({ line: [m, y, W - m, y], stroke: '#cfc7bb', lineWidth: 0.6 }); y -= 24;
      line(L.tone.head, 13, 'Helvetica-Bold'); y -= 8;
      for (const t of L.body) { if (t === '') { y -= 7; continue; } line(t, /^\s\s/.test(t) ? 9.5 : 10.5, /^Total overdue/.test(t) ? 'Helvetica-Bold' : 'Helvetica'); }
      ops.push({ text: 'Prepared with 1234tools.com — check before sending.', x: m, y: 30, size: 6.5, colour: '#aaaaaa' });
      pages.push({ size: [W, H], ops });
    }
    if (!pages.length) return null;
    return new Blob([core.createPDF(pages, { info: { Title: 'Payment reminders', Creator: '1234Tools' } })], { type: 'application/pdf' });
  }

  /* ---------------------------------------------------------------- */

  function mount(root) {
    const k = K();
    const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const st = { headers: [], rows: [], map: {}, name: '' };
    const msg = k.msgBox();

    const mapBox = k.el('div');
    const drop = k.dropzone('Choose the outstanding invoices (Excel or CSV)', '.xlsx,.csv', async (f) => {
      try {
        msg.say('Reading…', 'note');
        const t = await k.readTable(f); const h = k.splitHeader(t.sheets[0].rows);
        st.headers = h.headers; st.rows = h.rows; st.name = f.name; st.map = k.autoMap(FIELDS, h.headers);
        mapBox.innerHTML = ''; mapBox.appendChild(k.mapPanel('Invoice columns', FIELDS, h.headers, st.map));
        drop.say(f.name, h.rows.length + ' rows'); msg.say('');
      } catch (e) { msg.say(e.message, 'error'); }
    });
    io.appendChild(k.h3('1 · What is outstanding'));
    io.appendChild(drop); io.appendChild(mapBox);

    io.appendChild(k.h3('2 · How you age it'));
    const bar = k.el('div', 'opt-bar');
    const asOn = k.textInput('ra-ason', new Date().toISOString().slice(0, 10), '', 'date');
    const creditDays = k.textInput('ra-credit', '30', '', 'number'); creditDays.min = 0; creditDays.max = 365;
    const buckets = k.textInput('ra-buckets', '0-30, 31-60, 61-90, 90+', '0-30, 31-60, 61-90, 90+');
    const currency = k.select('ra-cur', [{ value: 'INR', label: 'Rupees ₹' }, { value: 'GBP', label: 'Pounds £' }, { value: 'USD', label: 'Dollars $' }, { value: 'EUR', label: 'Euro €' }, { value: 'AED', label: 'Dirham AED' }], 'INR');
    const minChase = k.textInput('ra-min', '0', '', 'number'); minChase.min = 0;
    bar.appendChild(k.field('As on', asOn, 'Overdue days are counted to this date'));
    bar.appendChild(k.field('Credit days when the sheet has no due date', creditDays));
    bar.appendChild(k.field('Buckets', buckets, 'Ranges of days overdue, comma separated'));
    bar.appendChild(k.field('Currency', currency));
    bar.appendChild(k.field('Do not chase below', minChase, 'Small balances are still reported'));
    io.appendChild(bar);

    io.appendChild(k.h3('3 · The reminders'));
    const bar2 = k.el('div', 'opt-bar');
    const fromName = k.textInput('ra-from', '', 'Your business name');
    const fromContact = k.textInput('ra-contact', '', 'Phone, email — printed under the signature');
    const terms = k.textInput('ra-terms', '', 'Your payment terms line, printed under every letter');
    const s1 = k.textInput('ra-s1', '15', '', 'number'), s2 = k.textInput('ra-s2', '45', '', 'number'), s3 = k.textInput('ra-s3', '75', '', 'number');
    bar2.appendChild(k.field('From', fromName));
    bar2.appendChild(k.field('Contact', fromContact));
    bar2.appendChild(k.field('Terms line', terms));
    bar2.appendChild(k.field('Reminder after (days)', s1, 'Below this, a gentle note'));
    bar2.appendChild(k.field('Firmer after (days)', s2));
    bar2.appendChild(k.field('Final after (days)', s3));
    io.appendChild(bar2);

    const run = k.el('div', 'io-actions pdf-run');
    run.appendChild(k.button('Age the ledger', 'btn-primary', go));
    io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    function go() {
      result.innerHTML = '';
      if (!st.rows.length) { msg.say('Choose the outstanding invoices first.', 'note'); return; }
      const miss = k.missing(FIELDS, st.map);
      if (miss.length) { msg.say('Map ' + miss.join(', ') + ' first.', 'error'); return; }
      const SYM = { INR: '₹', GBP: '£', USD: '$', EUR: '€', AED: 'AED' }[currency.value] || '₹';
      const LOC = currency.value === 'INR' ? 'en-IN' : 'en-GB';
      const steps = [Number(s1.value) || 15, Number(s2.value) || 45, Number(s3.value) || 75].sort((a, b) => a - b);
      const opt = {
        asOn: asOn.value || new Date().toISOString().slice(0, 10),
        creditDays: Math.max(0, Number(creditDays.value) || 30),
        buckets: parseBuckets(buckets.value),
        symbol: SYM, locale: LOC, steps,
        fromName: fromName.value.trim(), fromContact: fromContact.value.trim(), terms: terms.value.trim()
      };
      const money = (n) => SYM + ' ' + Number(n || 0).toLocaleString(LOC, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      let A;
      try { A = age(st.rows, st.map, opt); } catch (e) { msg.say(e.message, 'error'); return; }
      if (!A.live.length) { msg.say('Nothing is outstanding in that file — every balance is zero or a credit.', 'note'); if (A.issues.length) result.appendChild(k.issues(A.issues)); return; }

      const floor = Number(minChase.value) || 0;
      const chaseable = A.customers.filter(c => c.overdue > floor && c.invoices.some(x => x.overdue > 0));

      /* sheets */
      const S = k.S();
      const head = ['Customer'].concat(A.buckets.map(b => b.label)).concat(['Overdue total', 'Not yet due', 'Total outstanding', 'Oldest (days)', 'Email', 'Phone']);
      const ageRows = [head].concat(A.customers.map(c => [c.customer].concat(c.buckets).concat([c.overdue, c.notDue, c.total, c.oldest, c.email, c.phone])));
      ageRows.push(['Total'].concat(A.buckets.map((b, i) => r2(A.customers.reduce((s, c) => s + c.buckets[i], 0)))).concat([A.overdueTotal, A.notDue, A.total, A.oldest, '', '']));
      const detail = [['Customer', 'Invoice', 'Invoice date', 'Due date', 'Invoice amount', 'Received', 'Balance', 'Days overdue', 'Bucket', 'Row']]
        .concat(A.live.sort((a, b) => b.overdue - a.overdue).map(x => {
          const b = x.overdue <= 0 ? 'Not yet due' : (A.buckets.find(bb => x.overdue >= bb.from && x.overdue <= bb.to) || { label: '—' }).label;
          return [x.customer, x.inv, x.date, x.due, x.amount, x.received, x.balance, x.overdue > 0 ? x.overdue : 0, b, x.row];
        }));
      const reminders = [['Customer', 'Email', 'Phone', 'Level', 'Subject', 'Overdue amount', 'Invoices', 'Body']]
        .concat(chaseable.map(c => {
          const L = letterLines(c, opt);
          return [c.customer, c.email, c.phone, L.tone.key, L.subject, c.overdue, c.invoices.filter(x => x.overdue > 0).map(x => x.inv).join('; '), L.body.join('\n')];
        }));
      const summary = [['Measure', 'Amount', 'Note'],
        ['Total outstanding', A.total, A.live.length + ' invoices, ' + A.customers.length + ' customers'],
        ['Overdue', A.overdueTotal, (A.total ? Math.round(A.overdueTotal / A.total * 100) : 0) + '% of the book'],
        ['Not yet due', A.notDue, ''],
        ['Average age of overdue money', A.weighted, 'days, weighted by amount'],
        ['Oldest unpaid invoice', A.oldest, 'days overdue'],
        ['Customers to chase', chaseable.length, 'above the ' + money(floor) + ' floor'],
        ['As on', opt.asOn, 'credit days ' + opt.creditDays]];
      const sheets = [{ name: 'Summary', rows: summary }, { name: 'Ageing by customer', rows: ageRows }, { name: 'Invoice detail', rows: detail }, { name: 'Reminders', rows: reminders }];
      if (A.credits.length) sheets.push({ name: 'Credit balances', rows: [['Customer', 'Invoice', 'Balance', 'Row']].concat(A.credits.map(x => [x.customer, x.inv, x.balance, x.row])) });

      const buttons = [k.downloadButton('receivables-ageing.xlsx', () => S.writeXlsx(sheets))];
      const pdfBlob = () => lettersPdf(chaseable, opt);
      if (chaseable.length) {
        buttons.push(k.downloadButton('reminder-letters.pdf', () => { const b = pdfBlob(); if (!b) throw new Error('There is nothing overdue to write about.'); return b; }, false));
        buttons.push(k.downloadButton('reminders.csv', () => new Blob([S.toCSV(reminders)], { type: 'text/csv' }), false));
      }
      result.appendChild(k.summaryCard(
        money(A.overdueTotal) + ' overdue of ' + money(A.total) + ' outstanding',
        A.customers.length + ' customers · ' + chaseable.length + ' to chase · average ' + A.weighted + ' days late · oldest ' + A.oldest + ' days',
        buttons));
      result.appendChild(k.statGrid(
        A.buckets.map((b, i) => [b.label, money(r2(A.customers.reduce((s, c) => s + c.buckets[i], 0)))])
          .concat([['Not yet due', money(A.notDue)], ['Average age of overdue money', A.weighted + ' days'], ['Oldest unpaid invoice', A.oldest + ' days']])));

      if (A.issues.length) result.appendChild(k.issues(A.issues, 'row skipped'));
      if (A.credits.length) result.appendChild(k.issues([A.credits.length + ' row(s) show a credit balance — an overpayment or an unapplied receipt. They are listed on their own sheet and are not chased.'], 'note worth checking'));

      result.appendChild(k.h3('Ageing by customer'));
      result.appendChild(k.previewTable(ageRows, 30));
      result.appendChild(k.h3('Invoices, oldest first'));
      result.appendChild(k.previewTable(detail, 25));
      if (chaseable.length) {
        result.appendChild(k.h3('The first reminder, as it will read'));
        const pre = k.el('pre', 'code-out');
        pre.textContent = letterLines(chaseable[0], opt).body.join('\n');
        result.appendChild(pre);
      }
      msg.say('');
      result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="receivables-ageing"]'); if (r) mount(r); });
  window.MVRAgeing = { age, parseBuckets, letterLines, toneFor };
})();
