/**
 * The figures a quarterly update asks for, out of the sheet you already keep.
 *
 * Under Making Tax Digital for Income Tax the quarterly update is not a
 * tax return: it is your income and expenses for the period, split into
 * HMRC's own categories, for one business. Most people already have every
 * row of that in a spreadsheet with their own category names on it. This
 * reads that sheet, maps the names onto the standard category set, cuts
 * the year into the four quarterly periods, and gives both the cumulative
 * year-to-date figure the update carries and the standalone quarter, so
 * you can see the one and check the other. Anything it cannot match is
 * put in a bucket with its own name and listed row by row - never folded
 * into "other" behind your back.
 *
 * It produces the figures. It does not file them: that needs software
 * HMRC has recognised, and this is not that.
 *
 * Every category, period date and deadline lives in the MTD constant
 * below. Nothing else in this file hard-codes one.
 */
(function () {
  'use strict';

  /* ==================================================================
   * MTD QUARTERLY UPDATES - THE RULES AND CATEGORIES THIS TOOL APPLIES
   * ------------------------------------------------------------------
   * Written  : 2026-09-20
   * Verified : NO. Not checked against a live gov.uk page. These are the
   *            rules and category names as understood on that date,
   *            written in one place so they can be reviewed and
   *            corrected in one place. gov.uk is the authority.
   *
   * The category sets are the commonly used self-employment (SA103-style)
   * and property (SA105-style) headings. HMRC's own quarterly update
   * specification uses its own field names, and software will show its
   * own wording; these are the headings a person recognises from the
   * paper pages. CHECK THEM against your software before you file.
   *
   * Overseas property uses the same set as UK property here. The foreign
   * property pages (SA106-style) carry extra boxes a UK letting does not
   * have - foreign tax paid among them - and this does not model those.
   *
   * POINTS I AM LEAST SURE OF are in `recheck` and are printed on the page.
   * ================================================================== */
  const MTD = {
    checked: '2026-09-20',
    authority: 'https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax',
    authorityLabel: 'gov.uk: use Making Tax Digital for Income Tax',
    softwareAuthority: 'https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax',
    softwareAuthorityLabel: 'gov.uk: find software compatible with Making Tax Digital for Income Tax',

    /* A quarterly update carries CUMULATIVE year-to-date totals, not the
       quarter standing alone. Both are produced here either way. */
    cumulative: true,
    finalDeclaration: { day: '31 January', note: 'The Final Declaration after the tax year replaces the Self Assessment return.' },

    taxYear: { startsMD: '04-06', endsMD: '04-05' },
    /* `startY`/`endY`/`dueY` are offsets in whole years from the calendar
       year the tax year begins in: 2026 means the 2026-27 tax year. */
    quarterSets: {
      standard: {
        label: 'Standard quarters',
        blurb: 'Periods ending 5 July, 5 October, 5 January and 5 April.',
        periods: [
          { startMD: '04-06', startY: 0, endMD: '07-05', endY: 0, dueMD: '08-07', dueY: 0 },
          { startMD: '07-06', startY: 0, endMD: '10-05', endY: 0, dueMD: '11-07', dueY: 0 },
          { startMD: '10-06', startY: 0, endMD: '01-05', endY: 1, dueMD: '02-07', dueY: 1 },
          { startMD: '01-06', startY: 1, endMD: '04-05', endY: 1, dueMD: '05-07', dueY: 1 }
        ]
      },
      calendar: {
        label: 'Calendar quarters (by election)',
        blurb: 'Periods ending 30 June, 30 September, 31 December and 31 March. You elect for these in your software.',
        periods: [
          { startMD: '04-06', startY: 0, endMD: '06-30', endY: 0, dueMD: '08-07', dueY: 0 },
          { startMD: '07-01', startY: 0, endMD: '09-30', endY: 0, dueMD: '11-07', dueY: 0 },
          { startMD: '10-01', startY: 0, endMD: '12-31', endY: 0, dueMD: '02-07', dueY: 1 },
          { startMD: '01-01', startY: 1, endMD: '03-31', endY: 1, dueMD: '05-07', dueY: 1 }
        ]
      }
    },

    /* The bucket for anything that could not be matched. Named so that it
       can never be mistaken for one of HMRC's own headings. */
    unmatchedKey: 'NOT_CATEGORISED',
    unmatchedLabel: 'NOT CATEGORISED - decide these yourself',

    businessTypes: {
      selfEmployment: {
        label: 'Self-employment (a trade)',
        basis: 'Self-employment categories, SA103-style, as at 2026-09-20 - check against your software',
        categories: [
          { key: 'turnover', side: 'income', label: 'Turnover - takings, fees, sales or money earned', aliases: ['turnover', 'sales', 'revenue', 'income', 'fees', 'takings', 'salesincome', 'tradingincome', 'invoices', 'invoiced', 'receipts', 'salesinvoice'] },
          { key: 'otherIncome', side: 'income', label: 'Any other business income', aliases: ['otherincome', 'otherbusinessincome', 'miscincome', 'sundryincome', 'grants', 'grantincome', 'otherreceipts', 'interestreceived'] },
          { key: 'goods', side: 'expense', label: 'Cost of goods bought for resale or goods used', aliases: ['costofgoods', 'costofsales', 'cogs', 'purchases', 'stock', 'materials', 'goods', 'rawmaterials', 'directcosts', 'subcontractors', 'subcontractor'] },
          { key: 'carVan', side: 'expense', label: 'Car, van and travel expenses', aliases: ['carvantravel', 'travel', 'motor', 'motorexpenses', 'fuel', 'mileage', 'vehicle', 'transport', 'parking', 'train', 'taxi', 'carandvan', 'vanexpenses'] },
          { key: 'wages', side: 'expense', label: 'Wages, salaries and other staff costs', aliases: ['wages', 'salaries', 'staff', 'staffcosts', 'payroll', 'employeecosts', 'wagesandsalaries', 'nationalinsurance', 'pensioncontributions'] },
          { key: 'premises', side: 'expense', label: 'Rent, rates, power and insurance costs', aliases: ['premises', 'rent', 'rates', 'businessrates', 'utilities', 'electricity', 'power', 'water', 'insurance', 'premisescosts', 'heatandlight'] },
          { key: 'repairs', side: 'expense', label: 'Repairs and maintenance of property and equipment', aliases: ['repairs', 'maintenance', 'repairsandmaintenance', 'equipmentrepairs', 'servicing'] },
          { key: 'admin', side: 'expense', label: 'Phone, stationery and other office costs', aliases: ['office', 'officecosts', 'stationery', 'phone', 'telephone', 'mobile', 'postage', 'printing', 'software', 'internet', 'broadband', 'subscriptions', 'adminexpenses', 'sundries'] },
          { key: 'advertising', side: 'expense', label: 'Advertising and business entertainment costs', aliases: ['advertising', 'marketing', 'promotion', 'entertainment', 'advertisingcosts', 'websitecosts', 'website'] },
          { key: 'interest', side: 'expense', label: 'Interest on bank and other loans', aliases: ['loaninterest', 'interest', 'interestpaid', 'bankinterest', 'mortgageinterest'] },
          { key: 'bankCharges', side: 'expense', label: 'Bank, credit card and other financial charges', aliases: ['bankcharges', 'financecharges', 'cardfees', 'merchantfees', 'paymentfees', 'bankfees', 'stripefees', 'paypalfees'] },
          { key: 'badDebts', side: 'expense', label: 'Irrecoverable debts written off', aliases: ['baddebts', 'baddebt', 'irrecoverabledebts', 'debtswrittenoff', 'writtenoff'] },
          { key: 'professional', side: 'expense', label: 'Accountancy, legal and other professional fees', aliases: ['professionalfees', 'accountancy', 'accountant', 'legal', 'solicitor', 'consultancy', 'bookkeeping', 'audit', 'legalfees'] },
          { key: 'depreciation', side: 'expense', label: 'Depreciation and loss or profit on sale of assets', aliases: ['depreciation', 'amortisation', 'lossonsale', 'assetwriteoff'] },
          { key: 'otherExpenses', side: 'expense', label: 'Other business expenses', aliases: ['otherexpenses', 'other', 'miscellaneous', 'misc', 'sundryexpenses', 'otherbusinessexpenses', 'general'] }
        ]
      },
      ukProperty: {
        label: 'UK property business',
        basis: 'UK property categories, SA105-style, as at 2026-09-20 - check against your software',
        categories: [
          { key: 'rents', side: 'income', label: 'Rent and other income from property', aliases: ['rent', 'rents', 'rentreceived', 'rentsreceived', 'rentalincome', 'rentincome', 'lettings', 'income', 'tenantrent'] },
          { key: 'premiums', side: 'income', label: 'Premiums for the grant of a lease', aliases: ['premiums', 'premium', 'leasepremium', 'grantoflease'] },
          { key: 'otherPropertyIncome', side: 'income', label: 'Other property income', aliases: ['otherincome', 'otherpropertyincome', 'miscincome', 'insuranceclaim', 'servicecharge', 'servicecharges'] },
          { key: 'ratesInsurance', side: 'expense', label: 'Rent, rates, insurance and ground rents', aliases: ['groundrent', 'groundrents', 'rates', 'counciltax', 'insurance', 'buildinginsurance', 'landlordinsurance', 'ratesinsurance', 'utilities'] },
          { key: 'propertyRepairs', side: 'expense', label: 'Property repairs and maintenance', aliases: ['repairs', 'maintenance', 'repairsandmaintenance', 'propertyrepairs', 'decorating', 'gardening', 'boilerservice', 'plumbing'] },
          { key: 'loanInterest', side: 'expense', label: 'Loan interest and other financial costs', aliases: ['mortgageinterest', 'loaninterest', 'interest', 'financecosts', 'mortgage', 'bankcharges'] },
          { key: 'legalManagement', side: 'expense', label: 'Legal, management and other professional fees', aliases: ['management', 'managementfees', 'lettingagent', 'agentfees', 'agent', 'legal', 'professionalfees', 'accountancy', 'solicitor'] },
          { key: 'services', side: 'expense', label: 'Costs of services provided, including wages', aliases: ['services', 'servicecosts', 'cleaning', 'cleaner', 'wages', 'gardener', 'staff', 'caretaker'] },
          { key: 'otherPropertyExpenses', side: 'expense', label: 'Other property expenses', aliases: ['otherexpenses', 'other', 'otherpropertyexpenses', 'sundry', 'miscellaneous', 'misc'] }
        ]
      },
      overseasProperty: {
        label: 'Overseas property business',
        basis: 'The same headings as UK property. Foreign property pages carry extra boxes, foreign tax among them, which this does not model',
        sameAs: 'ukProperty'
      }
    },

    recheck: [
      'The exact category names your software uses. These are the paper-page headings a person recognises; HMRC\'s update specification and every package word them slightly differently. Match them up before you file.',
      'Whether the update carries cumulative year-to-date figures or the quarter on its own. Cumulative is assumed here, and both are produced, so you can send whichever your software asks for.',
      'The end of the fourth calendar quarter under a calendar quarter election. It is set here as 31 March, while the tax year runs to 5 April - rows dated 1 to 5 April are counted into Q4 and flagged, but check how your software treats them.',
      'Overseas property: the same headings as UK property are used here, and the foreign-specific boxes are not modelled.'
    ]
  };

  const YR = (y) => y + '-' + String((y + 1) % 100).padStart(2, '0');
  const catsFor = (type) => { const t = MTD.businessTypes[type]; return (t && t.sameAs ? MTD.businessTypes[t.sameAs] : t).categories; };

  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['mtd-quarterly-update'] = {
    title: 'MTD Quarterly Update Builder',
    short: 'MTD Quarterly Update',
    description: 'Turn the income and expense spreadsheet you already keep into the figures a Making Tax Digital quarterly update asks for. It maps your own category names onto the standard self-employment or property headings, cuts the tax year into its four quarterly periods - standard or calendar - and gives the cumulative year-to-date total alongside the standalone quarter, with every unmatched row listed by name. It produces the figures; filing them needs software HMRC has recognised. Runs in your browser.',
    keywords: ['mtd quarterly update', 'making tax digital quarterly update', 'mtd income and expenses spreadsheet', 'sa103 categories', 'sa105 property categories', 'mtd for landlords', 'mtd sole trader records', 'quarterly update deadlines', 'cumulative year to date mtd', 'mtd digital records'],
    glyph: 'i-mtd-quarter',
    glyphSvg: '<symbol id="i-mtd-quarter" viewBox="0 0 24 24">\n  <rect x="2.8" y="2.8" width="8" height="8" rx="1.4"/>\n  <rect x="13.2" y="2.8" width="8" height="8" rx="1.4"/>\n  <rect x="2.8" y="13.2" width="8" height="8" rx="1.4"/>\n  <rect x="13.2" y="13.2" width="8" height="8" rx="1.4"/>\n  <path d="M5 7.2l1.4 1.4 2.4-3" class="thin"/>\n  <path d="M15.4 7.2l1.4 1.4 2.4-3" class="thin"/>\n  <path d="M5 17.6l1.4 1.4 2.4-3" class="thin"/>\n  <path d="M15.6 15.6h3.4M15.6 18.8h3.4" class="thin"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/biz-mtd-quarterly.js'],
    tips: [
      'Keep your own category names. The mapping is by name and by the words inside it, so "Motor expenses - fuel" finds car, van and travel on its own. What it cannot place goes into a bucket called NOT CATEGORISED and is listed row by row, with the category you actually wrote.',
      'A quarterly update carries the cumulative year-to-date figure, not the quarter on its own. Both columns are here side by side: send the one your software asks for, and use the other to see what the quarter itself actually did.',
      'Negative amounts work the way you would want. A refund on an expense row reduces that expense; a credit note on an income row reduces turnover. Nothing is turned into its absolute value behind your back.',
      'One run covers one business. A sole trader who also lets a flat runs it twice - once with the self-employment categories, once with the property ones - because they are two businesses with two sets of quarterly updates.',
      'Rows dated outside the tax year are not counted and not hidden: they are listed so you can see whether they belong in the year before or the year after.',
      'The category sets and all four period dates sit in one clearly-marked block at the top of the engine file, labelled ' + MTD.checked + '. They were not verified against a live gov.uk page, and the points least certain are printed with your results.',
      'This produces the figures. It cannot send them. Filing a quarterly update needs software HMRC has recognised, and nothing on this site is that.'
    ],
    faq: [
      { q: 'Can this file my quarterly update?', a: 'No, and it will not pretend otherwise. A quarterly update has to go through software HMRC has recognised, connected to your HMRC account. This produces the figures that software needs and hands them to you as a workbook and a CSV. You still type or import them into the package you file with. Check gov.uk\'s list of compatible software for what will actually send them.' },
      { q: 'Cumulative or standalone - which figure do I send?', a: 'The update is understood to carry the cumulative year-to-date total, so Q2 shows Q1 plus Q2 and Q4 equals the whole year. Both columns are produced because packages differ and because the standalone quarter is the number that tells you anything about the business. If your software asks for the quarter alone, that column is there.' },
      { q: 'What happens to a category it cannot match?', a: 'It goes into a bucket named NOT CATEGORISED, which is kept out of both the income and the expense totals, shown on screen, and written to its own sheet with the date, the description, the amount and the words you actually used. It is never dropped into "other", because "other" is a real HMRC box and putting a guess in it is how a wrong figure gets filed.' },
      { q: 'Which categories does it use?', a: 'The commonly used self-employment headings for a trade, and the property headings for a letting - the wording a person recognises from the paper pages. Overseas property uses the same headings as UK property here, which the constant block says plainly; the foreign pages have extra boxes this does not model. Every package words them a little differently, so match them up before you file.' },
      { q: 'Standard or calendar quarters?', a: 'Standard periods end 5 July, 5 October, 5 January and 5 April. Calendar periods end 30 June, 30 September, 31 December and 31 March, and you have to elect for them in your software. The deadlines are the same either way: 7 August, 7 November, 7 February and 7 May. If you pick calendar quarters, anything dated 1 to 5 April is counted into Q4 and flagged, because the tax year runs to 5 April.' },
      { q: 'Is my spreadsheet uploaded?', a: 'No. It is read, split and totalled by your own browser, and the workbook is written there too. Your turnover, your customers and your costs never leave the device.' }
    ]
  };
  if (typeof document === 'undefined') return;

  const K = () => window.MVRBizKit;

  /* ---------------- pure logic ---------------- */

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1] : String(iso || ''); };
  const gbp = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const r2 = (n) => Math.round(n * 100) / 100;
  const dayGap = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '');

  const FIELDS = [
    { key: 'date', label: 'Date', need: true, aliases: ['date', 'transactiondate', 'invoicedate', 'paymentdate', 'when', 'day', 'postingdate'] },
    { key: 'description', label: 'Description', aliases: ['description', 'details', 'narrative', 'particulars', 'memo', 'reference', 'payee', 'note', 'item'] },
    { key: 'amount', label: 'Amount', need: true, aliases: ['amount', 'value', 'total', 'net', 'sum', 'gross', 'amountgbp'] },
    { key: 'category', label: 'Category', need: true, aliases: ['category', 'type', 'account', 'nominal', 'head', 'classification', 'expensetype', 'group'] }
  ];

  /** The four quarterly periods of a tax year, with deadlines. */
  function quarterPeriods(taxYearStart, mode) {
    const set = MTD.quarterSets[mode] || MTD.quarterSets.standard;
    return set.periods.map((p, i) => ({
      n: i + 1,
      start: (taxYearStart + p.startY) + '-' + p.startMD,
      end: (taxYearStart + p.endY) + '-' + p.endMD,
      due: (taxYearStart + p.dueY) + '-' + p.dueMD
    }));
  }
  const taxYearBounds = (taxYearStart) => ({ start: taxYearStart + '-' + MTD.taxYear.startsMD, end: (taxYearStart + 1) + '-' + MTD.taxYear.endsMD });

  /**
   * A user's category name onto a standard one. Exact on the key, the
   * label or an alias first; then the longest alias of four or more
   * characters found inside the name. Null when nothing fits - the caller
   * must put it in the NOT CATEGORISED bucket, never in "other".
   */
  function mapCategory(text, cats) {
    const n = norm(text);
    if (!n) return null;
    for (const c of cats) {
      if (n === norm(c.key) || n === norm(c.label)) return c;
      if (c.aliases.some(a => a === n)) return c;
    }
    let best = null, bestLen = 0;
    for (const c of cats) for (const a of c.aliases) {
      if (a.length >= 4 && a.length > bestLen && n.indexOf(a) >= 0) { best = c; bestLen = a.length; }
    }
    return best;
  }

  /**
   * Split the rows into the four periods and total them by category.
   * opt: { taxYearStart, mode, businessType, businessName, today }
   */
  function build(rows, map, opt) {
    const k = K();
    const cats = catsFor(opt.businessType);
    const periods = quarterPeriods(opt.taxYearStart, opt.mode);
    const bounds = taxYearBounds(opt.taxYearStart);
    const get = (r, key) => map[key] === undefined ? '' : r[map[key]];

    const blank = () => { const o = {}; cats.forEach(c => { o[c.key] = 0; }); o[MTD.unmatchedKey] = 0; return o; };
    const quarter = [blank(), blank(), blank(), blank()];
    const counts = [0, 0, 0, 0];
    const used = new Map();           /* the user's wording -> what it became */
    const uncategorised = [], outside = [], lateApril = [], issues = [];

    rows.forEach((r, i) => {
      const rowNo = i + 2;
      const date = k.toISODate(get(r, 'date'), true);
      if (!date) { issues.push('Row ' + rowNo + ': the date could not be read.'); return; }
      const amount = k.toNumber(get(r, 'amount'));
      if (!Number.isFinite(amount)) { issues.push('Row ' + rowNo + ': the amount is not a number.'); return; }
      const written = String(get(r, 'category') || '').trim();
      const desc = String(get(r, 'description') || '').trim();

      if (date < bounds.start || date > bounds.end) {
        outside.push({ row: rowNo, date, desc, written, amount: r2(amount) });
        return;
      }
      /* Which period. A calendar-quarter year stops on 31 March while the
         tax year runs to 5 April, so those few days go into Q4 and are
         flagged rather than lost. */
      let q = periods.findIndex(p => date >= p.start && date <= p.end);
      let late = false;
      if (q < 0) { q = periods.length - 1; late = true; lateApril.push({ row: rowNo, date, desc, written, amount: r2(amount) }); }

      const hit = mapCategory(written, cats);
      const key = hit ? hit.key : MTD.unmatchedKey;
      quarter[q][key] += amount;
      counts[q]++;
      const uk = written || '(blank)';
      if (!used.has(uk)) used.set(uk, { written: uk, to: hit ? hit.label : MTD.unmatchedLabel, side: hit ? hit.side : 'unknown', rows: 0, total: 0 });
      const u = used.get(uk); u.rows++; u.total = r2(u.total + amount);
      if (!hit) uncategorised.push({ row: rowNo, date, desc, written: uk, amount: r2(amount), quarter: q + 1, late });
    });

    /* Round the standalone quarters first, then make the cumulative
       column the running total of exactly those rounded figures - so the
       two columns on screen always agree with each other. */
    Object.keys(quarter[0]).forEach(key => quarter.forEach(qq => { qq[key] = r2(qq[key]); }));
    const cumulative = [];
    for (let q = 0; q < 4; q++) {
      const o = q === 0 ? blank() : Object.assign({}, cumulative[q - 1]);
      Object.keys(quarter[q]).forEach(key => { o[key] = r2((o[key] || 0) + quarter[q][key]); });
      cumulative.push(o);
    }

    const sideTotal = (obj, side) => r2(cats.filter(c => c.side === side).reduce((s, c) => s + (obj[c.key] || 0), 0));
    const summarise = (obj) => ({ income: sideTotal(obj, 'income'), expenses: sideTotal(obj, 'expense'), unmatched: r2(obj[MTD.unmatchedKey] || 0) });
    const totals = { quarter: quarter.map(summarise), cumulative: cumulative.map(summarise) };
    totals.quarter.forEach(t => { t.net = r2(t.income - t.expenses); });
    totals.cumulative.forEach(t => { t.net = r2(t.income - t.expenses); });

    const today = opt.today || new Date().toISOString().slice(0, 10);
    const schedule = periods.map((p, i) => ({
      n: p.n, start: p.start, end: p.end, due: p.due,
      daysLeft: dayGap(today, p.due),
      rows: counts[i]
    }));

    return {
      cats, periods, schedule, bounds, today,
      quarter, cumulative, totals,
      year: cumulative[3], yearTotals: totals.cumulative[3],
      used: [...used.values()].sort((a, b) => a.to.localeCompare(b.to) || a.written.localeCompare(b.written)),
      uncategorised, outside, lateApril, issues,
      counted: counts.reduce((s, n) => s + n, 0),
      businessLabel: (MTD.businessTypes[opt.businessType] || {}).label || opt.businessType,
      businessName: opt.businessName || '',
      taxYearLabel: YR(opt.taxYearStart),
      quarterLabel: (MTD.quarterSets[opt.mode] || MTD.quarterSets.standard).label
    };
  }

  /** The wide on-screen and CSV table: standalone beside cumulative. */
  function table(B) {
    const head = ['Category', 'Type'];
    B.schedule.forEach(p => { head.push('Q' + p.n + ' quarter'); head.push('Q' + p.n + ' cumulative'); });
    head.push('Year total');
    const line = (label, type, key) => {
      const row = [label, type];
      B.schedule.forEach((p, i) => { row.push(B.quarter[i][key]); row.push(B.cumulative[i][key]); });
      row.push(B.cumulative[3][key]);
      return row;
    };
    const rows = [head];
    B.cats.filter(c => c.side === 'income').forEach(c => rows.push(line(c.label, 'Income', c.key)));
    rows.push(['Total income', '', ...B.schedule.map((p, i) => [B.totals.quarter[i].income, B.totals.cumulative[i].income]).flat(), B.yearTotals.income]);
    B.cats.filter(c => c.side === 'expense').forEach(c => rows.push(line(c.label, 'Expense', c.key)));
    rows.push(['Total expenses', '', ...B.schedule.map((p, i) => [B.totals.quarter[i].expenses, B.totals.cumulative[i].expenses]).flat(), B.yearTotals.expenses]);
    rows.push(['Income less expenses', '', ...B.schedule.map((p, i) => [B.totals.quarter[i].net, B.totals.cumulative[i].net]).flat(), B.yearTotals.net]);
    rows.push(line(MTD.unmatchedLabel, 'Not in either total', MTD.unmatchedKey));
    return rows;
  }

  function sheets(B) {
    const cumHead = ['Category', 'Type'].concat(B.schedule.map(p => 'Q' + p.n + ' cumulative to ' + p.end)).concat(['Year total']);
    const qHead = ['Category', 'Type'].concat(B.schedule.map(p => 'Q' + p.n + ' ' + p.start + ' to ' + p.end)).concat(['Year total']);
    const body = (source) => {
      const out = [];
      const line = (label, type, key) => [label, type].concat(source.map(o => o[key])).concat([B.cumulative[3][key]]);
      B.cats.filter(c => c.side === 'income').forEach(c => out.push(line(c.label, 'Income', c.key)));
      out.push(['Total income', ''].concat(source.map(o => r2(B.cats.filter(c => c.side === 'income').reduce((s, c) => s + o[c.key], 0)))).concat([B.yearTotals.income]));
      B.cats.filter(c => c.side === 'expense').forEach(c => out.push(line(c.label, 'Expense', c.key)));
      out.push(['Total expenses', ''].concat(source.map(o => r2(B.cats.filter(c => c.side === 'expense').reduce((s, c) => s + o[c.key], 0)))).concat([B.yearTotals.expenses]));
      out.push([MTD.unmatchedLabel, 'Not in either total'].concat(source.map(o => o[MTD.unmatchedKey])).concat([B.cumulative[3][MTD.unmatchedKey]]));
      return out;
    };
    const banner = (what) => [
      [what + ' - ' + (B.businessName || 'this business') + ' (' + B.businessLabel + '), ' + B.taxYearLabel + ', ' + B.quarterLabel],
      ['Figures produced by 1234tools.com. This does not file anything: a quarterly update needs software HMRC has recognised.'],
      ['Guidance and category names as at ' + MTD.checked + ', not verified against a live gov.uk page.'],
      []
    ];
    return [
      { name: 'Cumulative', rows: banner('Cumulative year-to-date figures - this is what a quarterly update carries').concat([cumHead]).concat(body(B.cumulative)) },
      { name: 'Per quarter', rows: banner('The quarter standing alone - for reading the business, not for filing').concat([qHead]).concat(body(B.quarter)) },
      {
        name: 'Uncategorised rows', rows: [['Every row whose category could not be matched. Decide each one yourself - they are in no total above.'], []]
          .concat([['Row', 'Date', 'Description', 'Category as you wrote it', 'Amount', 'Quarter']])
          .concat(B.uncategorised.map(u => [u.row, u.date, u.desc, u.written, u.amount, 'Q' + u.quarter]))
          .concat(B.uncategorised.length ? [] : [['-', '-', 'Nothing - every category was matched', '-', '', '-']])
      },
      {
        name: 'Categories used', rows: [['How each of your category names was read.'], []]
          .concat([['Category as you wrote it', 'Mapped to', 'Income or expense', 'Rows', 'Total']])
          .concat(B.used.map(u => [u.written, u.to, u.side === 'unknown' ? 'neither - not counted' : u.side, u.rows, u.total]))
      },
      {
        name: 'Periods and deadlines', rows: [['Tax year ' + B.taxYearLabel + ' (' + B.bounds.start + ' to ' + B.bounds.end + '), ' + B.quarterLabel], []]
          .concat([['Update', 'Period start', 'Period end', 'Deadline', 'Days from ' + B.today, 'Rows in this quarter']])
          .concat(B.schedule.map(p => ['Q' + p.n, p.start, p.end, p.due, p.daysLeft, p.rows]))
          .concat([[], ['Final Declaration for ' + B.taxYearLabel, 'by ' + MTD.finalDeclaration.day + ' ' + (Number(B.taxYearLabel.slice(0, 4)) + 2), MTD.finalDeclaration.note]])
          .concat([[], ['What to re-check against gov.uk']]).concat(MTD.recheck.map(x => [x]))
      }
    ];
  }

  /* ---------------- the page ---------------- */

  function mount(root) {
    const k = K();
    const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const st = { headers: [], rows: [], map: {}, name: '' };
    const msg = k.msgBox();

    const mapBox = k.el('div');
    const drop = k.dropzone('Choose your income and expenses (Excel or CSV)', '.xlsx,.csv', async (f) => {
      try {
        msg.say('Reading…', 'note');
        const t = await k.readTable(f); const h = k.splitHeader(t.sheets[0].rows);
        st.headers = h.headers; st.rows = h.rows; st.name = f.name; st.map = k.autoMap(FIELDS, h.headers);
        mapBox.innerHTML = ''; mapBox.appendChild(k.mapPanel('Your columns', FIELDS, h.headers, st.map));
        drop.say(f.name, h.rows.length + ' rows'); msg.say('');
      } catch (e) { msg.say(e.message, 'error'); }
    });
    io.appendChild(k.h3('1 · The records you already keep'));
    io.appendChild(drop); io.appendChild(mapBox);

    io.appendChild(k.h3('2 · Which business, which year'));
    const bar = k.el('div', 'opt-bar');
    const bName = k.textInput('mq-name', '', 'e.g. J Patel Joinery, or 14 Grove Road');
    const bType = k.select('mq-type', Object.keys(MTD.businessTypes).map(x => ({ value: x, label: MTD.businessTypes[x].label })), 'selfEmployment');
    const thisYear = new Date().getMonth() > 2 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const years = []; for (let y = thisYear + 2; y >= thisYear - 3; y--) years.push({ value: y, label: YR(y) + ' tax year' });
    const yr = k.select('mq-year', years, thisYear);
    const mode = k.select('mq-mode', Object.keys(MTD.quarterSets).map(x => ({ value: x, label: MTD.quarterSets[x].label })), 'standard');
    bar.appendChild(k.field('Business name', bName, 'Printed on the workbook - one run covers one business'));
    bar.appendChild(k.field('Business type', bType, 'The category set differs between a trade and a letting'));
    bar.appendChild(k.field('Tax year', yr, 'Runs 6 April to 5 April'));
    bar.appendChild(k.field('Quarterly periods', mode, 'Calendar quarters need an election in your software'));
    io.appendChild(bar);

    const warn = k.el('div', 'io-msg is-warn');
    warn.textContent = 'This produces the figures. It cannot send them: a quarterly update has to go through software HMRC has recognised, and this is not that - yet. Category names and period dates are guidance as at ' + MTD.checked + ' and were not verified against a live gov.uk page.';
    io.appendChild(warn);

    const run = k.el('div', 'io-actions pdf-run');
    run.appendChild(k.button('Build the quarterly figures', 'btn-primary', go));
    io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    function go() {
      result.innerHTML = '';
      if (!st.rows.length) { msg.say('Choose your income and expenses file first.', 'note'); return; }
      const miss = k.missing(FIELDS, st.map);
      if (miss.length) { msg.say('Map ' + miss.join(', ') + ' first.', 'error'); return; }

      let B;
      try {
        B = build(st.rows, st.map, {
          taxYearStart: Number(yr.value), mode: mode.value,
          businessType: bType.value, businessName: bName.value.trim()
        });
      } catch (e) { msg.say(e.message, 'error'); return; }

      if (!B.counted) {
        msg.say('No row in that file falls inside the ' + B.taxYearLabel + ' tax year (' + fmtDate(B.bounds.start) + ' to ' + fmtDate(B.bounds.end) + '). Pick a different tax year, or check the date column is mapped to the right one.', 'error');
        if (B.outside.length) result.appendChild(k.issues(B.outside.slice(0, 20).map(o => 'Row ' + o.row + ': ' + o.date + ' ' + o.desc + ' ' + gbp(o.amount)), 'out-of-year row'));
        return;
      }

      const T = table(B);
      const S = k.S();
      const buttons = [
        k.downloadButton('mtd-quarterly-update.xlsx', () => S.writeXlsx(sheets(B))),
        k.downloadButton('mtd-quarterly-update.csv', () => new Blob([S.toCSV(T)], { type: 'text/csv' }), false)
      ];
      result.appendChild(k.summaryCard(
        (B.businessName || B.businessLabel) + ' — ' + B.taxYearLabel + ' — ' + gbp(B.yearTotals.income) + ' income, ' + gbp(B.yearTotals.expenses) + ' expenses',
        B.counted + ' rows counted · ' + B.quarterLabel + ' · ' + B.uncategorised.length + ' row' + (B.uncategorised.length === 1 ? '' : 's') + ' not categorised · figures only, filing needs recognised software',
        buttons));

      result.appendChild(k.statGrid(B.schedule.map(p => [
        'Q' + p.n + ' — ' + fmtDate(p.start) + ' to ' + fmtDate(p.end) + ', due ' + fmtDate(p.due),
        gbp(B.totals.cumulative[p.n - 1].net) + ' cumulative net · ' + (p.daysLeft > 0 ? p.daysLeft.toLocaleString('en-GB') + ' days left' : Math.abs(p.daysLeft).toLocaleString('en-GB') + ' days ago')
      ]).concat([
        ['Year: total income', gbp(B.yearTotals.income)],
        ['Year: total expenses', gbp(B.yearTotals.expenses)],
        ['Year: income less expenses', gbp(B.yearTotals.net)],
        ['Not categorised (in neither total)', gbp(B.yearTotals.unmatched)]
      ])));

      if (B.issues.length) {
        result.appendChild(k.h3('Rows that could not be read at all'));
        result.appendChild(k.issues(B.issues, 'unreadable row'));
      }
      if (B.uncategorised.length) {
        result.appendChild(k.h3('Rows nothing could be matched to — decide these yourself, they are in no total'));
        result.appendChild(k.issues(B.uncategorised.map(u =>
          'Row ' + u.row + ' — ' + u.date + ' — "' + u.written + '" — ' + (u.desc || 'no description') + ' — ' + gbp(u.amount) + ' (Q' + u.quarter + ')'
        ), 'uncategorised row'));
      }
      if (B.outside.length) {
        result.appendChild(k.h3('Rows dated outside the ' + B.taxYearLabel + ' tax year — not counted, and not hidden'));
        result.appendChild(k.issues(B.outside.map(o =>
          'Row ' + o.row + ' — ' + o.date + ' — ' + (o.desc || o.written) + ' — ' + gbp(o.amount)
        ), 'out-of-year row'));
      }
      if (B.lateApril.length) {
        result.appendChild(k.h3('Rows after the last calendar period ends but inside the tax year — counted into Q4, check your software'));
        result.appendChild(k.issues(B.lateApril.map(o =>
          'Row ' + o.row + ' — ' + o.date + ' — ' + (o.desc || o.written) + ' — ' + gbp(o.amount)
        ), 'late-April row'));
      }

      result.appendChild(k.h3('Periods and deadlines — ' + B.quarterLabel));
      result.appendChild(k.previewTable([['Update', 'Period', 'Deadline', 'Days from today', 'Rows in the quarter']]
        .concat(B.schedule.map(p => ['Q' + p.n, fmtDate(p.start) + ' to ' + fmtDate(p.end), fmtDate(p.due), p.daysLeft > 0 ? p.daysLeft.toLocaleString('en-GB') : 'passed', p.rows])), 6));

      result.appendChild(k.h3('Cumulative, with the standalone quarter beside it'));
      result.appendChild(k.previewTable(T, 40));

      result.appendChild(k.h3('How your category names were read'));
      result.appendChild(k.previewTable([['Category as you wrote it', 'Mapped to', 'Income or expense', 'Rows', 'Total']]
        .concat(B.used.map(u => [u.written, u.to, u.side === 'unknown' ? 'neither - not counted' : u.side, u.rows, gbp(u.total)])), 40));

      result.appendChild(k.h3('What to re-check against gov.uk'));
      result.appendChild(k.issues(MTD.recheck, 'unverified point'));
      const src = k.el('p', 'field-hint');
      src.innerHTML = 'Guidance as at ' + MTD.checked + ', not verified against a live gov.uk page. The authority is gov.uk: '
        + '<a href="' + MTD.authority + '" rel="noopener">' + MTD.authorityLabel + '</a>. '
        + 'To actually file, you need <a href="' + MTD.softwareAuthority + '" rel="noopener">' + MTD.softwareAuthorityLabel + '</a>.';
      result.appendChild(src);

      msg.say('');
      result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="mtd-quarterly-update"]'); if (r) mount(r); });
  window.MVRQuarterly = { MTD, YR, catsFor, fmtDate, gbp, r2, dayGap, norm, FIELDS, quarterPeriods, taxYearBounds, mapCategory, build, table, sheets };
})();
