/**
 * A month's payroll, from the salary sheet, in the browser.
 *
 * One spreadsheet in — a row per employee, earnings, deductions and
 * attendance — and out come the payslips as one PDF each inside a zip, a
 * combined PDF to print, the bank's bulk-transfer CSV, and a register
 * workbook with the PF, ESI, professional tax and TDS summaries that tie
 * back to the slips. PF, ESI and professional tax can be computed here or
 * taken from the sheet. Nothing is uploaded: a salary sheet is the most
 * sensitive file a small business owns.
 */
(function () {
  'use strict';
  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['payroll-run'] = {
    title: 'Monthly Payroll Run: Payslips, Bank File & Statutory Summary',
    short: 'Payroll Run',
    description: 'Drop in a salary sheet and get the whole month\'s payroll: a payslip PDF for every employee in a zip, a combined PDF, the bank bulk-transfer CSV, and a register workbook with PF, ESI, professional tax and TDS summaries. Pro-rates by paid days, computes the statutory deductions or takes them from your sheet, and refuses to run if anyone\'s net pay is negative. Runs in your browser; nothing is uploaded.',
    keywords: ['payroll software free india', 'bulk payslip generator excel', 'salary sheet to payslips', 'payroll register excel', 'bank salary transfer file', 'pf esi professional tax calculator payroll', 'monthly payroll run', 'payslip pdf bulk'],
    glyph: 'i-payroll-run',
    glyphSvg: '<symbol id="i-payroll-run" viewBox="0 0 24 24">\n  <path d="M3.5 3.5h11v12.5l-1.8-1.3-1.8 1.3-1.8-1.3-1.8 1.3-1.9-1.3-1.9 1.3z"/>\n  <path d="M6 7.2h6M6 10.2h6M6 12.9h3.5" class="thin"/>\n  <path d="M17 8.5h3.5v12h-11v-3" class="thin"/>\n  <circle cx="17.5" cy="15" r="3.2"/>\n  <path d="M17.5 13.4v3.2l1.7 1" class="thin"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/pdfcore.bundle.js', '/engine/biz-kit.js', '/engine/biz-payroll-run.js'],
    tips: [
      'One row per employee. Column names are matched for you — Employee ID, Name, Basic, HRA, Paid Days, PF, TDS and so on — and every match is shown in a dropdown you can correct. Only the employee name is genuinely required; everything else can be blank.',
      'Any numeric column the mapping did not claim is offered back to you as an extra earning or an extra deduction, so an "Arrears", "Shift allowance" or "Canteen recovery" column prints on the payslip under its own name without any setup.',
      'Pro-rating applies to Basic, DA, HRA, conveyance and other allowances, at paid days ÷ days in the month. Overtime, incentive and any extra earning column are paid as typed, because those figures are already for the days worked.',
      'Statutory rates and the professional tax slabs are written in one clearly-marked constant at the top of this file with the date they were last checked. PF is 12%, the employer\'s 12% splits 8.33% to the pension scheme (on wages up to Rs 15,000) and the rest to EPF, EDLI is 0.5%, ESI is 0.75% and 3.25% on gross wages up to Rs 21,000, and ESI contributions are rounded up to the next rupee. Check all of it against the current rules before you file.',
      'The run stops, and writes nothing, if anyone\'s deductions exceed their earnings — those people are named. It warns, but still runs, when paid days plus loss of pay do not add up to the days in the month, or when a bank account or IFSC is missing from someone whose net pay is positive.',
      'Banks differ on the bulk-transfer format: some want a header row, some a fixed column order, some a debit-account line on top. The CSV here has the five fields every format is built from — account number, IFSC, name, amount and narration — and the register workbook repeats them with a note, so you can reorder for your bank in a minute.',
      'The rupee sign cannot be drawn with the standard PDF fonts, so the payslips print "Rs". Every bank and auditor reads it the same way.'
    ],
    faq: [
      { q: 'What does it actually produce from one run?', a: 'Four downloads: payslips.zip with one PDF per employee named by employee ID, name and month; payslips-combined.pdf with every slip in order for printing; bank-transfer.csv with the account number, IFSC, beneficiary name, amount and narration; and payroll-register.xlsx with a Register sheet listing every component for every employee, plus PF, ESI, professional tax, TDS and bank-transfer summary sheets whose totals tie back to the slips.' },
      { q: 'Does it compute PF, ESI and professional tax, or do I supply them?', a: 'Either. Leave it on "compute" and PF is 12% of Basic+DA (capped at the Rs 15,000 wage ceiling if you choose), ESI applies while gross wages are Rs 21,000 or less, and professional tax comes from the state you pick. Switch it to "take from the sheet" and your own columns are used untouched — useful when your consultant has already computed them.' },
      { q: 'Is TDS calculated?', a: 'No. Monthly TDS depends on each employee\'s projected annual income, their regime, their declarations and what has already been deducted this year — none of which is in a salary sheet. Put your computed TDS in a column and it is carried through to the payslip, the register and the TDS summary. The CTC calculator on this site will estimate a year\'s tax if you need a starting figure.' },
      { q: 'How many employees can it handle?', a: 'It is arithmetic and PDF drawing in your browser, so a few hundred rows is comfortable. Every payslip is one A4 page; a very long list of components will be trimmed to what fits the page and the register workbook still carries everything.' },
      { q: 'Does the salary sheet leave my device?', a: 'No. It is read by your own browser, the PDFs and the workbook are written there, and the downloads come from memory. Nothing is uploaded, queued or logged.' }
    ]
  };
  if (typeof document === 'undefined') return;
  const K = () => window.MVRBizKit;
  const core = () => { if (!window.MVRPdfCore) throw new Error('The PDF engine did not load.'); return window.MVRPdfCore; };

  /* ============================================================
   * STATUTORY CONSTANTS — CHECK THESE BEFORE YOU FILE
   * Last checked: 2026-09-20
   * ============================================================ */
  const PF = { wageCeiling: 15000, employeeRate: 0.12, employerRate: 0.12, epsRate: 0.0833, edliRate: 0.005, adminRate: 0.005 };
  const ESI = { wageLimit: 21000, employeeRate: 0.0075, employerRate: 0.0325 };
  /* [gross up to and including, per month, per year]; Tamil Nadu is levied on
     half-yearly wages, so its bands are half-yearly and the month is one sixth.
     Karnataka charges from Rs 25,000, hence the nil band stopping a paisa short. */
  const PT_STATES = [
    { code: 'none', label: 'No professional tax (Delhi, Haryana, UP, Rajasthan, …)', basis: 'month', bands: [[Infinity, 0, 0]] },
    { code: 'MH', label: 'Maharashtra', basis: 'month', bands: [[7500, 0, 0], [10000, 175, 2100], [Infinity, 200, 2500]] },
    { code: 'KA', label: 'Karnataka', basis: 'month', bands: [[24999.99, 0, 0], [Infinity, 200, 2400]] },
    { code: 'WB', label: 'West Bengal', basis: 'month', bands: [[10000, 0, 0], [15000, 110, 1320], [25000, 130, 1560], [40000, 150, 1800], [Infinity, 200, 2400]] },
    { code: 'TN', label: 'Tamil Nadu (half-yearly)', basis: 'halfyear', bands: [[21000, 0, 0], [30000, 135, 270], [45000, 315, 630], [60000, 690, 1380], [75000, 1025, 2050], [Infinity, 1250, 2500]] },
    { code: 'AP', label: 'Andhra Pradesh / Telangana', basis: 'month', bands: [[15000, 0, 0], [20000, 150, 1800], [Infinity, 200, 2400]] },
    { code: 'GJ', label: 'Gujarat', basis: 'month', bands: [[12000, 0, 0], [Infinity, 200, 2400]] },
    { code: 'MP', label: 'Madhya Pradesh', basis: 'month', bands: [[18750, 0, 0], [25000, 125, 1500], [33333, 166.67, 2000], [Infinity, 208.33, 2500]] }
  ];
  const ptState = (code) => PT_STATES.find(s => s.code === code) || PT_STATES[0];
  function professionalTax(monthlyGross, code) {
    const st = ptState(code);
    const basis = st.basis === 'halfyear' ? monthlyGross * 6 : monthlyGross;
    for (const [upTo, perMonth] of st.bands) if (basis <= upTo) return st.basis === 'halfyear' ? r2(perMonth / 6) : r2(perMonth);
    return 0;
  }

  /* ---------- money, dates and words ---------- */

  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const rupee = (n) => Math.round(Number(n) || 0);
  /** 1234567.5 -> "12,34,567.50": lakh and crore grouping. */
  function inr(n) {
    const neg = n < 0;
    const s = Math.abs(Number(n) || 0).toFixed(2);
    const i = s.slice(0, -3), d = s.slice(-2);
    const head = i.length > 3 ? i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + i.slice(-3) : i;
    return (neg ? '-' : '') + head + '.' + d;
  }
  /* Copied from the single-payslip tool rather than shared, so that a change
     to one tool can never silently move the other's numbers. */
  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => x < 20 ? ONES[x] : TENS[Math.floor(x / 10)] + (x % 10 ? '-' + ONES[x % 10] : '');
  function indianWords(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'Zero';
    const parts = [];
    const crore = Math.floor(n / 1e7); n %= 1e7;
    const lakh = Math.floor(n / 1e5); n %= 1e5;
    const thousand = Math.floor(n / 1000); n %= 1000;
    if (crore) parts.push(indianWords(crore) + ' Crore');
    if (lakh) parts.push(two(lakh) + ' Lakh');
    if (thousand) parts.push(two(thousand) + ' Thousand');
    if (n >= 100) parts.push(ONES[Math.floor(n / 100)] + ' Hundred');
    const rest = n % 100;
    let s = parts.join(' ');
    if (rest) s += (s ? ' and ' : '') + two(rest);
    return s;
  }
  function rupeesInWords(amount) {
    const neg = amount < 0;
    const paise = Math.round(Math.abs(amount) * 100);
    const rs = Math.floor(paise / 100), p = paise % 100;
    let s = 'Rupees ' + indianWords(rs);
    if (p) s += ' and ' + indianWords(p) + ' Paise';
    return (neg ? 'Minus ' : '') + s + ' Only';
  }
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const daysIn = (monthIndex, year) => new Date(year, monthIndex + 1, 0).getDate();
  const slug = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
  /** Dark ink on a light accent, white on a dark one. */
  function onAccent(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
    if (!m) return '#ffffff';
    const [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16) / 255);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.55 ? '#1a1400' : '#ffffff';
  }

  /* ---------- the sheet ---------- */

  const FIELDS = [
    { key: 'empId', label: 'Employee ID', aliases: ['employeeid', 'empid', 'employeecode', 'empcode', 'staffid', 'employeeno', 'empno', 'code', 'id'] },
    { key: 'name', label: 'Employee name', need: true, aliases: ['employeename', 'empname', 'staffname', 'fullname', 'name'] },
    { key: 'designation', label: 'Designation', aliases: ['designation', 'jobtitle', 'title', 'role', 'position'] },
    { key: 'department', label: 'Department', aliases: ['department', 'dept', 'division'] },
    { key: 'pan', label: 'PAN', aliases: ['pan', 'panno', 'pannumber'] },
    { key: 'uan', label: 'UAN / PF number', aliases: ['uan', 'uanno', 'uannumber', 'pfnumber', 'pfno', 'pfaccountnumber', 'epfno'] },
    { key: 'esiNo', label: 'ESI number', aliases: ['esinumber', 'esino', 'esicno', 'esicnumber', 'esiicnumber', 'insurancenumber'] },
    { key: 'bankAcc', label: 'Bank account number', aliases: ['bankaccountnumber', 'bankaccount', 'accountnumber', 'accountno', 'bankacno', 'acnumber', 'acno'] },
    { key: 'ifsc', label: 'IFSC', aliases: ['ifsc', 'ifsccode', 'neftcode', 'rtgscode'] },
    { key: 'daysInMonth', label: 'Days in month', aliases: ['daysinmonth', 'monthdays', 'totaldays', 'days'] },
    { key: 'paidDays', label: 'Paid days', aliases: ['paiddays', 'payabledays', 'dayspaid', 'presentdays', 'workingdays'] },
    { key: 'lopDays', label: 'Loss of pay (days)', aliases: ['lopdays', 'lop', 'lossofpay', 'losspaydays', 'lwpdays', 'lwp', 'absentdays', 'unpaidleave'] },
    { key: 'basic', label: 'Basic', aliases: ['basicsalary', 'basicpay', 'basicwage', 'basic'] },
    { key: 'da', label: 'Dearness allowance', aliases: ['dearnessallowance', 'da'] },
    { key: 'hra', label: 'House rent allowance', aliases: ['houserentallowance', 'houserent', 'hra'] },
    { key: 'conveyance', label: 'Conveyance', aliases: ['conveyanceallowance', 'conveyance', 'transportallowance', 'travelallowance'] },
    { key: 'allowances', label: 'Other / special allowances', aliases: ['specialallowance', 'otherallowances', 'otherallowance', 'allowances', 'allowance', 'special'] },
    { key: 'overtime', label: 'Overtime', aliases: ['overtimeamount', 'overtime', 'otamount', 'ot'] },
    { key: 'incentive', label: 'Incentive', aliases: ['incentives', 'incentive', 'performancepay', 'commission', 'bonus'] },
    { key: 'pf', label: 'PF deducted', aliases: ['pfdeduction', 'employeepf', 'pfemployee', 'providentfund', 'epf', 'pf'] },
    { key: 'esi', label: 'ESI deducted', aliases: ['esideduction', 'esiemployee', 'esicontribution', 'esiamount', 'esi'] },
    { key: 'pt', label: 'Professional tax', aliases: ['professionaltax', 'ptdeduction', 'ptax', 'pt'] },
    { key: 'tds', label: 'TDS / income tax', aliases: ['tdsdeduction', 'incometax', 'tds'] },
    { key: 'advance', label: 'Advance', aliases: ['salaryadvance', 'advancededuction', 'advances', 'advance'] },
    { key: 'loan', label: 'Loan / EMI', aliases: ['loandeduction', 'loanrecovery', 'loanemi', 'loan', 'emi'] }
  ];
  const PRORATED = ['basic', 'da', 'hra', 'conveyance', 'allowances'];
  const EARNING_LABELS = { basic: 'Basic', da: 'Dearness allowance', hra: 'House rent allowance', conveyance: 'Conveyance allowance', allowances: 'Other allowances', overtime: 'Overtime', incentive: 'Incentive' };
  const EARNING_KEYS = ['basic', 'da', 'hra', 'conveyance', 'allowances', 'overtime', 'incentive'];
  const DEDUCTION_LABELS = { pf: 'Provident fund (employee)', esi: 'ESI (employee)', pt: 'Professional tax', tds: 'Income tax (TDS)', advance: 'Advance', loan: 'Loan / EMI' };
  const DEDUCTION_KEYS = ['pf', 'esi', 'pt', 'tds', 'advance', 'loan'];

  /**
   * One month of payroll. Pure arithmetic on already-read rows, so the
   * Python check can reproduce every figure from the same fixture.
   */
  function runPayroll(rows, map, extras, o) {
    const k = K();
    const get = (row, key) => map[key] === undefined ? '' : row[map[key]];
    const num = (row, key) => { if (map[key] === undefined) return 0; const n = k.toNumber(get(row, key)); return Number.isFinite(n) ? n : 0; };
    const txt = (row, key) => String(get(row, key) == null ? '' : get(row, key)).trim();
    const defaultDays = daysIn(o.monthIndex, o.year);

    const people = [], negatives = [], dayWarnings = [], bankWarnings = [];
    rows.forEach((row, i) => {
      const name = txt(row, 'name');
      if (!name) return;
      const dim = num(row, 'daysInMonth') || defaultDays;
      /* A blank attendance cell means "not told", not "zero days paid". */
      const given = (key) => { if (map[key] === undefined) return NaN; const raw = get(row, key); if (String(raw == null ? '' : raw).trim() === '') return NaN; const n = k.toNumber(raw); return Number.isFinite(n) ? n : NaN; };
      let paid = given('paidDays');
      let lop = given('lopDays');
      if (!Number.isFinite(paid)) paid = Number.isFinite(lop) ? dim - lop : dim;
      if (!Number.isFinite(lop)) lop = dim - paid;
      const factor = o.prorate && dim > 0 ? Math.min(1, Math.max(0, paid / dim)) : 1;

      const earnings = [];
      for (const key of EARNING_KEYS) {
        if (map[key] === undefined) continue;
        const full = num(row, key);
        if (!full) continue;
        earnings.push({ key, label: EARNING_LABELS[key], amount: r2(PRORATED.indexOf(key) >= 0 ? full * factor : full) });
      }
      for (const ex of extras.filter(x => x.role === 'earning')) {
        const n = k.toNumber(row[ex.col]);
        if (Number.isFinite(n) && n) earnings.push({ key: 'x' + ex.col, label: ex.label, amount: r2(n) });
      }
      const gross = r2(earnings.reduce((s, e) => s + e.amount, 0));

      /* statutory */
      const basicEarned = r2((map.basic === undefined ? 0 : num(row, 'basic') * (o.prorate ? factor : 1)));
      const daEarned = r2((map.da === undefined ? 0 : num(row, 'da') * (o.prorate ? factor : 1)));
      const pfWage = o.pfCapped ? Math.min(basicEarned + daEarned, PF.wageCeiling) : (basicEarned + daEarned);
      const esiApplies = gross > 0 && gross <= ESI.wageLimit;
      let pfEmployee, pfEmployer, eps, epfEmployer, edli, admin, esiEmployee, esiEmployer, pt;
      if (o.statutory === 'compute') {
        pfEmployee = rupee(pfWage * PF.employeeRate);
        pfEmployer = rupee(pfWage * PF.employerRate);
        eps = rupee(Math.min(pfWage, PF.wageCeiling) * PF.epsRate);
        epfEmployer = pfEmployer - eps;
        edli = rupee(Math.min(pfWage, PF.wageCeiling) * PF.edliRate);
        admin = rupee(pfWage * PF.adminRate);
        esiEmployee = esiApplies ? Math.ceil(gross * ESI.employeeRate) : 0;
        esiEmployer = esiApplies ? Math.ceil(gross * ESI.employerRate) : 0;
        pt = professionalTax(gross, o.state);
      } else {
        pfEmployee = r2(num(row, 'pf'));
        pfEmployer = pfEmployee;
        eps = rupee(Math.min(pfWage, PF.wageCeiling) * PF.epsRate);
        epfEmployer = r2(pfEmployer - eps);
        edli = rupee(Math.min(pfWage, PF.wageCeiling) * PF.edliRate);
        admin = rupee(pfWage * PF.adminRate);
        esiEmployee = r2(num(row, 'esi'));
        esiEmployer = esiEmployee ? Math.ceil(gross * ESI.employerRate) : 0;
        pt = r2(num(row, 'pt'));
      }

      const deductions = [];
      const pushDed = (key, amount) => { if (amount) deductions.push({ key, label: DEDUCTION_LABELS[key], amount: r2(amount) }); };
      pushDed('pf', pfEmployee);
      pushDed('esi', esiEmployee);
      pushDed('pt', pt);
      pushDed('tds', num(row, 'tds'));
      pushDed('advance', num(row, 'advance'));
      pushDed('loan', num(row, 'loan'));
      for (const ex of extras.filter(x => x.role === 'deduction')) {
        const n = k.toNumber(row[ex.col]);
        if (Number.isFinite(n) && n) deductions.push({ key: 'x' + ex.col, label: ex.label, amount: r2(n) });
      }
      const totalDeductions = r2(deductions.reduce((s, d) => s + d.amount, 0));
      const net = r2(gross - totalDeductions);

      const p = {
        row: i + 2,
        empId: txt(row, 'empId') || String(i + 1),
        name, designation: txt(row, 'designation'), department: txt(row, 'department'),
        pan: txt(row, 'pan'), uan: txt(row, 'uan'), esiNo: txt(row, 'esiNo'),
        bankAcc: txt(row, 'bankAcc'), ifsc: txt(row, 'ifsc').toUpperCase(),
        daysInMonth: dim, paidDays: paid, lopDays: lop, factor,
        earnings, deductions, gross, totalDeductions, net,
        basicEarned, daEarned, pfWage: r2(pfWage),
        pfEmployee, pfEmployer, eps, epfEmployer, edli, admin,
        esiApplies, esiEmployee, esiEmployer, pt,
        tds: r2(num(row, 'tds')),
        employerCost: r2(gross + pfEmployer + edli + admin + esiEmployer)
      };
      people.push(p);
      if (net < -0.005) negatives.push(p.name + ' (' + p.empId + '): deductions ' + inr(p.totalDeductions) + ' exceed earnings ' + inr(p.gross) + ' — net ' + inr(net));
      if (Math.abs(paid + lop - dim) > 0.001) dayWarnings.push(p.name + ' (' + p.empId + '): paid ' + paid + ' + LOP ' + lop + ' is not ' + dim + ' days');
      if (net > 0 && (!p.bankAcc || !p.ifsc)) bankWarnings.push(p.name + ' (' + p.empId + '): ' + (!p.bankAcc && !p.ifsc ? 'no account number and no IFSC' : !p.bankAcc ? 'no account number' : 'no IFSC') + ' — left out of the bank file');
    });

    const sum = (f) => r2(people.reduce((s, p) => s + (Number(f(p)) || 0), 0));
    const totals = {
      headcount: people.length,
      gross: sum(p => p.gross), deductions: sum(p => p.totalDeductions), net: sum(p => p.net),
      pfEmployee: sum(p => p.pfEmployee), pfEmployer: sum(p => p.pfEmployer), eps: sum(p => p.eps), epfEmployer: sum(p => p.epfEmployer),
      edli: sum(p => p.edli), admin: sum(p => p.admin),
      esiEmployee: sum(p => p.esiEmployee), esiEmployer: sum(p => p.esiEmployer),
      pt: sum(p => p.pt), tds: sum(p => p.tds),
      employerCost: sum(p => p.employerCost)
    };
    return { people, totals, negatives, dayWarnings, bankWarnings, period: MONTHS[o.monthIndex] + ' ' + o.year };
  }

  /* ---------- the payslip page ---------- */

  function payslipPage(p, o) {
    const c = core();
    const [W, H] = c.PAGE_SIZES[o.pageSize] || c.PAGE_SIZES.a4;
    const accent = /^#[0-9a-f]{6}$/i.test(o.accent || '') ? o.accent : '#1f3a5f';
    const ink = onAccent(accent);
    const GREY = '#666666', LIGHT = '#f3f4f6', RULE = '#e2e4e8';
    const m = 46, ops = [];
    const fit = (text, font, size, maxW) => {
      let t = String(text == null ? '' : text);
      if (c.textWidth(t, font, size) <= maxW) return t;
      while (t.length > 1 && c.textWidth(t + '…', font, size) > maxW) t = t.slice(0, -1);
      return t + '…';
    };

    ops.push({ rect: [0, H - 6, W, 6], fill: accent });
    const company = String(o.company || '').split('\n').map(s => s.trim()).filter(Boolean);
    let y = H - 58;
    ops.push({ text: fit(company[0] || 'Company', 'Helvetica-Bold', 15, W / 2), x: m, y, size: 15, font: 'Helvetica-Bold' });
    let yl = y - 16;
    for (const ln of company.slice(1)) { ops.push({ text: fit(ln, 'Helvetica', 9, W / 2), x: m, y: yl, size: 9, colour: GREY }); yl -= 12; }
    if (String(o.companyIds || '').trim()) { ops.push({ text: fit(o.companyIds.trim(), 'Helvetica', 9, W / 2), x: m, y: yl, size: 9, colour: GREY }); yl -= 12; }
    if (String(o.tagline || '').trim()) { ops.push({ text: fit(o.tagline.trim(), 'Helvetica', 8.5, W / 2), x: m, y: yl, size: 8.5, colour: accent }); yl -= 12; }

    ops.push({ text: 'PAYSLIP', x: W - m, y, size: 22, font: 'Helvetica-Bold', align: 'right', colour: accent });
    ops.push({ text: 'Pay period: ' + o.period, x: W - m, y: y - 18, size: 10, align: 'right' });
    let yr = y - 32;
    if (o.payDate) { ops.push({ text: 'Paid on ' + o.payDate, x: W - m, y: yr, size: 9, align: 'right', colour: GREY }); yr -= 12; }
    y = Math.min(yl, yr) - 8;
    ops.push({ line: [m, y, W - m, y], stroke: accent, lineWidth: 1.2 });
    y -= 18;

    const items = [
      ['EMPLOYEE NAME', p.name], ['EMPLOYEE ID', p.empId], ['DESIGNATION', p.designation],
      ['DEPARTMENT', p.department], ['PAN', p.pan], ['UAN', p.uan],
      ['ESI NUMBER', p.esiNo], ['BANK ACCOUNT', p.bankAcc ? 'XXXX' + String(p.bankAcc).slice(-4) : ''], ['IFSC', p.ifsc]
    ].map(([kk, v]) => [kk, String(v == null ? '' : v).trim() || '—']);
    const cols = 3, colW = (W - m * 2 - 24) / cols, rowH = 30;
    const boxH = Math.ceil(items.length / cols) * rowH + 14;
    ops.push({ rect: [m, y - boxH, W - m * 2, boxH], fill: LIGHT });
    items.forEach(([kk, v], i) => {
      const cx = m + 12 + (i % cols) * colW, cy = y - 20 - Math.floor(i / cols) * rowH;
      ops.push({ text: kk, x: cx, y: cy, size: 7, font: 'Helvetica-Bold', colour: GREY });
      ops.push({ text: fit(v, 'Helvetica', 10, colW - 14), x: cx, y: cy - 12, size: 10 });
    });
    y -= boxH + 14;

    const att = [['DAYS IN MONTH', p.daysInMonth], ['PAID DAYS', p.paidDays], ['LOSS OF PAY', p.lopDays]];
    const aw = (W - m * 2) / att.length;
    att.forEach(([kk, v], i) => {
      const x0 = m + i * aw;
      ops.push({ rect: [x0, y - 34, aw, 34], stroke: RULE, lineWidth: 0.6 });
      ops.push({ text: kk, x: x0 + 10, y: y - 13, size: 7, font: 'Helvetica-Bold', colour: GREY });
      ops.push({ text: String(v), x: x0 + aw - 10, y: y - 25, size: 12, font: 'Helvetica-Bold', align: 'right' });
    });
    y -= 34 + 18;

    const gap = 16, tw = (W - m * 2 - gap) / 2, lineH = 15;
    const maxLines = Math.max(1, Math.floor((y - 190) / lineH));
    const trim = (list) => list.length <= maxLines ? list
      : list.slice(0, maxLines - 1).concat([{ label: 'Other items (' + (list.length - maxLines + 1) + ')', amount: r2(list.slice(maxLines - 1).reduce((s, x) => s + x.amount, 0)) }]);
    const earn = trim(p.earnings), ded = trim(p.deductions);
    const table = (x0, title, list) => {
      ops.push({ rect: [x0, y - 20, tw, 20], fill: accent });
      ops.push({ text: title, x: x0 + 8, y: y - 14, size: 8, font: 'Helvetica-Bold', colour: ink });
      ops.push({ text: 'AMOUNT (Rs)', x: x0 + tw - 8, y: y - 14, size: 8, font: 'Helvetica-Bold', align: 'right', colour: ink });
      let yy = y - 20 - 14;
      for (const r of list) {
        ops.push({ text: fit(r.label, 'Helvetica', 10, tw - 100), x: x0 + 8, y: yy, size: 10 });
        ops.push({ text: inr(r.amount), x: x0 + tw - 8, y: yy, size: 10, align: 'right' });
        ops.push({ line: [x0, yy - 5, x0 + tw, yy - 5], stroke: RULE, lineWidth: 0.5 });
        yy -= lineH;
      }
    };
    table(m, 'EARNINGS', earn);
    table(m + tw + gap, 'DEDUCTIONS', ded);
    const nRows = Math.max(earn.length, ded.length, 1);
    const yt = y - 20 - 14 - nRows * lineH - 4;
    const totalRow = (x0, label, val) => {
      ops.push({ line: [x0, yt + 12, x0 + tw, yt + 12], stroke: '#333333', lineWidth: 0.8 });
      ops.push({ text: label, x: x0 + 8, y: yt, size: 10, font: 'Helvetica-Bold' });
      ops.push({ text: inr(val), x: x0 + tw - 8, y: yt, size: 10, font: 'Helvetica-Bold', align: 'right' });
    };
    totalRow(m, 'Gross earnings', p.gross);
    totalRow(m + tw + gap, 'Total deductions', p.totalDeductions);
    y = yt - 22;

    ops.push({ rect: [m, y - 34, W - m * 2, 34], fill: accent });
    ops.push({ text: 'NET PAY', x: m + 12, y: y - 21, size: 11, font: 'Helvetica-Bold', colour: ink });
    ops.push({ text: 'Rs ' + inr(p.net), x: W - m - 12, y: y - 22, size: 14, font: 'Helvetica-Bold', align: 'right', colour: ink });
    y -= 34 + 16;
    const wl = c.wrapText('In words: ' + rupeesInWords(p.net), 'Helvetica', 9, W - m * 2);
    wl.forEach((ln, i) => ops.push({ text: ln, x: m, y: y - i * 12, size: 9, colour: '#333333' }));
    y -= wl.length * 12 + 10;

    if (o.statutory === 'compute') {
      const er = 'Employer contributions this month: PF Rs ' + inr(p.pfEmployer) + ' (pension Rs ' + inr(p.eps) + ', EPF Rs ' + inr(p.epfEmployer) + '), EDLI Rs ' + inr(p.edli) +
        (p.esiApplies ? ', ESI Rs ' + inr(p.esiEmployer) : '') + '. These are not deducted from you.';
      const el = c.wrapText(er, 'Helvetica', 8, W - m * 2);
      el.forEach((ln, i) => ops.push({ text: ln, x: m, y: y - i * 11, size: 8, colour: GREY }));
      y -= el.length * 11 + 6;
    }
    const notes = String(o.notes || '').trim();
    if (notes && y > 70) {
      const nl = c.wrapText(notes, 'Helvetica', 8.5, W - m * 2);
      nl.forEach((ln, i) => ops.push({ text: ln, x: m, y: y - i * 11, size: 8.5, colour: '#555555' }));
    }

    ops.push({ line: [m, 44, W - m, 44], stroke: RULE, lineWidth: 0.5 });
    ops.push({ text: fit((company[0] || '') + ' · Payslip for ' + o.period, 'Helvetica', 7.5, W - m * 2 - 120), x: m, y: 32, size: 7.5, colour: GREY });
    ops.push({ text: 'Confidential', x: W - m, y: 32, size: 7.5, align: 'right', colour: GREY });
    return { size: [W, H], ops };
  }

  /* ---------- the workbook and the bank file ---------- */

  function registerRows(R, o) {
    const earnKeys = [], dedKeys = [];
    const label = {};
    R.people.forEach(p => {
      p.earnings.forEach(e => { if (earnKeys.indexOf(e.key) < 0) { earnKeys.push(e.key); label[e.key] = e.label; } });
      p.deductions.forEach(d => { if (dedKeys.indexOf(d.key) < 0) { dedKeys.push(d.key); label[d.key] = d.label; } });
    });
    const head = ['Employee ID', 'Name', 'Designation', 'Department', 'PAN', 'UAN', 'ESI number', 'Bank account', 'IFSC', 'Days in month', 'Paid days', 'LOP days']
      .concat(earnKeys.map(kk => label[kk]), ['Gross earnings'], dedKeys.map(kk => label[kk]), ['Total deductions', 'Net pay', 'Employer PF', 'Employer ESI', 'EDLI', 'Employer cost']);
    const rows = [head];
    const amountOf = (list, kk) => { const hit = list.find(x => x.key === kk); return hit ? hit.amount : 0; };
    R.people.forEach(p => {
      rows.push([p.empId, p.name, p.designation, p.department, p.pan, p.uan, p.esiNo, p.bankAcc, p.ifsc, p.daysInMonth, p.paidDays, p.lopDays]
        .concat(earnKeys.map(kk => amountOf(p.earnings, kk)), [p.gross], dedKeys.map(kk => amountOf(p.deductions, kk)),
          [p.totalDeductions, p.net, p.pfEmployer, p.esiEmployer, p.edli, p.employerCost]));
    });
    const totalRow = ['TOTAL (' + R.people.length + ' employees)', '', '', '', '', '', '', '', '', '', '', '']
      .concat(earnKeys.map(kk => r2(R.people.reduce((s, p) => s + amountOf(p.earnings, kk), 0))), [R.totals.gross],
        dedKeys.map(kk => r2(R.people.reduce((s, p) => s + amountOf(p.deductions, kk), 0))),
        [R.totals.deductions, R.totals.net, R.totals.pfEmployer, R.totals.esiEmployer, R.totals.edli, R.totals.employerCost]);
    rows.push(totalRow);
    return rows;
  }

  function pfRows(R) {
    const rows = [['Employee ID', 'Name', 'UAN', 'PF wage (Rs)', 'Employee 12% (Rs)', 'Employer EPS 8.33% (Rs)', 'Employer EPF 3.67% (Rs)', 'Employer total 12% (Rs)', 'EDLI 0.5% (Rs)', 'Admin 0.5% (Rs)', 'Total remittance (Rs)']];
    R.people.filter(p => p.pfWage > 0).forEach(p => rows.push([p.empId, p.name, p.uan, p.pfWage, p.pfEmployee, p.eps, p.epfEmployer, p.pfEmployer, p.edli, p.admin,
      r2(p.pfEmployee + p.pfEmployer + p.edli + p.admin)]));
    rows.push(['TOTAL', '', '', r2(R.people.reduce((s, p) => s + p.pfWage, 0)), R.totals.pfEmployee, R.totals.eps, R.totals.epfEmployer, R.totals.pfEmployer, R.totals.edli, R.totals.admin,
      r2(R.totals.pfEmployee + R.totals.pfEmployer + R.totals.edli + R.totals.admin)]);
    rows.push([]);
    rows.push(['Employee 12% and employer 12% are of the PF wage. The pension share is 8.33% of the PF wage capped at Rs 15,000, and the EPF share is the balance of the employer 12%. EDLI is 0.5% of the capped wage. Administration charges are 0.5% of the PF wage and carry a Rs 500 monthly floor for the establishment as a whole, which is not applied per employee here.']);
    return rows;
  }

  function esiRows(R) {
    const covered = R.people.filter(p => p.esiApplies);
    const rows = [['Employee ID', 'Name', 'ESI number', 'Gross wages (Rs)', 'Employee 0.75% (Rs)', 'Employer 3.25% (Rs)', 'Total (Rs)']];
    covered.forEach(p => rows.push([p.empId, p.name, p.esiNo, p.gross, p.esiEmployee, p.esiEmployer, r2(p.esiEmployee + p.esiEmployer)]));
    rows.push(['TOTAL (' + covered.length + ' covered)', '', '', r2(covered.reduce((s, p) => s + p.gross, 0)), R.totals.esiEmployee, R.totals.esiEmployer, r2(R.totals.esiEmployee + R.totals.esiEmployer)]);
    rows.push([]);
    rows.push(['ESI applies while monthly gross wages are Rs ' + ESI.wageLimit.toLocaleString('en-IN') + ' or less (Rs 25,000 for an employee with a disability). Contributions are rounded up to the next rupee. An employee who crosses the limit mid-period stays covered to the end of the contribution period; that run-out is not modelled here.']);
    return rows;
  }

  function ptRows(R, o) {
    const stateLabel = o.statutory === 'compute' ? ptState(o.state).label : 'as supplied in the sheet';
    const rows = [['State', 'Employees paying', 'Total professional tax (Rs)']];
    const paying = R.people.filter(p => p.pt > 0);
    rows.push([stateLabel, paying.length, R.totals.pt]);
    rows.push([]);
    rows.push(['Employee ID', 'Name', 'State', 'Gross (Rs)', 'Professional tax (Rs)']);
    R.people.forEach(p => rows.push([p.empId, p.name, stateLabel, p.gross, p.pt]));
    rows.push(['TOTAL', '', '', R.totals.gross, R.totals.pt]);
    return rows;
  }

  function tdsRows(R) {
    const rows = [['Employee ID', 'Name', 'PAN', 'Gross (Rs)', 'TDS deducted (Rs)']];
    R.people.forEach(p => rows.push([p.empId, p.name, p.pan, p.gross, p.tds]));
    rows.push(['TOTAL', '', '', R.totals.gross, R.totals.tds]);
    rows.push([]);
    rows.push(['TDS is taken from your sheet, not computed: a month\'s deduction depends on each employee\'s projected annual income, chosen regime, declarations and what has already been deducted this year.']);
    return rows;
  }

  function bankRows(R, o) {
    const rows = [['Account Number', 'IFSC', 'Beneficiary Name', 'Amount', 'Narration']];
    R.people.filter(p => p.net > 0 && p.bankAcc && p.ifsc).forEach(p =>
      rows.push([String(p.bankAcc), p.ifsc, p.name, r2(p.net), 'SAL ' + o.shortPeriod + ' ' + p.empId]));
    return rows;
  }

  /* ---------- UI ---------- */

  function mount(root) {
    const k = K(); const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const st = { headers: [], rows: [], map: {}, extras: [] };
    const msg = k.msgBox();
    const mapBox = k.el('div');
    const extraBox = k.el('div');
    const now = new Date(); now.setDate(1); now.setMonth(now.getMonth() - 1);

    const drop = k.dropzone('Choose the salary sheet (Excel or CSV)', '.xlsx,.csv', async (f) => {
      try {
        msg.say('Reading…', 'note');
        const t = await k.readTable(f);
        const h = k.splitHeader(t.sheets[0].rows);
        st.headers = h.headers; st.rows = h.rows; st.map = k.autoMap(FIELDS, h.headers);
        mapBox.innerHTML = '';
        mapBox.appendChild(k.mapPanel('Salary sheet columns', FIELDS, h.headers, st.map, drawExtras));
        drawExtras();
        drop.say(f.name, h.rows.length + ' rows');
        msg.say('');
      } catch (e) { msg.say(e.message, 'error'); }
    });
    io.appendChild(drop); io.appendChild(mapBox); io.appendChild(extraBox);

    /** Columns the mapping did not claim that hold numbers: earning or deduction? */
    function drawExtras() {
      const used = new Set(Object.values(st.map));
      const keep = {};
      st.extras.forEach(x => { keep[x.col] = x.role; });
      st.extras = [];
      st.headers.forEach((h, i) => {
        if (used.has(i)) return;
        const values = st.rows.map(r => r[i]).filter(v => v !== '' && v != null);
        if (!values.length) return;
        const numeric = values.filter(v => Number.isFinite(k.toNumber(v))).length;
        if (numeric < values.length * 0.8) return;
        const guess = /ded|recover|recovery|tax|advance|loan|fine|penalt|canteen|mess|contrib/i.test(h) ? 'deduction' : 'earning';
        st.extras.push({ col: i, label: h || ('Column ' + k.S().colName(i)), role: keep[i] || guess });
      });
      extraBox.innerHTML = '';
      if (!st.extras.length) return;
      const box = k.el('div', 'biz-map');
      box.appendChild(k.el('p', 'biz-map-title', 'Extra numeric columns — earning, deduction or ignore'));
      const grid = k.el('div', 'biz-map-grid');
      st.extras.forEach(x => {
        const sel = k.select('pr-extra-' + x.col, [{ value: 'earning', label: 'Earning' }, { value: 'deduction', label: 'Deduction' }, { value: 'ignore', label: 'Ignore' }], x.role);
        sel.addEventListener('change', () => { x.role = sel.value; });
        grid.appendChild(k.field(x.label, sel));
      });
      box.appendChild(grid); extraBox.appendChild(box);
    }

    io.appendChild(k.h3('The month'));
    const monthBar = k.el('div', 'opt-bar');
    const month = k.select('pr-month', MONTHS.map((m, i) => ({ value: i, label: m })), now.getMonth());
    const year = k.textInput('pr-year', String(now.getFullYear()), '', 'number'); year.min = 2000; year.max = 2099;
    const payDate = k.textInput('pr-paydate', '', '', 'date');
    const prorate = k.select('pr-prorate', [{ value: 'yes', label: 'Pro-rate by paid days' }, { value: 'no', label: 'Pay exactly as typed' }], 'yes');
    monthBar.appendChild(k.field('Month', month));
    monthBar.appendChild(k.field('Year', year));
    monthBar.appendChild(k.field('Payment date', payDate, 'Printed on the slip'));
    monthBar.appendChild(k.field('Earnings', prorate));
    io.appendChild(monthBar);

    const statBar = k.el('div', 'opt-bar');
    const statutory = k.select('pr-statutory', [{ value: 'compute', label: 'Compute PF, ESI and PT here' }, { value: 'sheet', label: 'Take them from the sheet' }], 'compute');
    const state = k.select('pr-state', PT_STATES.map(s => ({ value: s.code, label: s.label })), 'KA');
    const pfCap = k.select('pr-pfcap', [{ value: 'yes', label: 'Capped at Rs 15,000/month' }, { value: 'no', label: 'Full Basic + DA' }], 'yes');
    statBar.appendChild(k.field('Statutory deductions', statutory));
    statBar.appendChild(k.field('State (professional tax)', state));
    statBar.appendChild(k.field('PF wage', pfCap));
    io.appendChild(statBar);

    io.appendChild(k.h3('The company block on the payslip'));
    const company = k.textarea('pr-company', 'Acme Software Pvt Ltd\n12 MG Road, Bengaluru 560001\nKarnataka, India', 'Name on the first line, then the address', 3);
    io.appendChild(k.field('Company', company));
    const coBar = k.el('div', 'opt-bar');
    const companyIds = k.textInput('pr-ids', '', 'CIN U72200KA2015PTC080123 · GSTIN 29AABCU9603R1ZX');
    const tagline = k.textInput('pr-tagline', '', 'A line in place of a logo');
    const accent = k.textInput('pr-accent', '#1f3a5f', '', 'color');
    const pageSize = k.select('pr-page', [{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }, { value: 'legal', label: 'Legal' }], 'a4');
    coBar.appendChild(k.field('CIN / GSTIN', companyIds));
    coBar.appendChild(k.field('Logo line', tagline));
    coBar.appendChild(k.field('Accent colour', accent));
    coBar.appendChild(k.field('Page size', pageSize));
    io.appendChild(coBar);
    const notes = k.textarea('pr-notes', 'This is a computer-generated payslip and does not need a signature.', 'Printed at the foot of every slip', 2);
    io.appendChild(k.field('Notes', notes));

    const run = k.el('div', 'io-actions pdf-run');
    run.appendChild(k.button('Run payroll', 'btn-primary', go));
    io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    const fmtDate = (s) => { const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m2 ? Number(m2[3]) + ' ' + MONTHS[Number(m2[2]) - 1] + ' ' + m2[1] : ''; };

    function go() {
      result.innerHTML = '';
      if (!st.rows.length) { msg.say('Choose the salary sheet first.', 'note'); return; }
      const miss = k.missing(FIELDS, st.map);
      if (miss.length) { msg.say('Map ' + miss.join(', ') + ' first.', 'error'); return; }
      const mi = Number(month.value), yr = Number(year.value) || now.getFullYear();
      const o = {
        monthIndex: mi, year: yr, period: MONTHS[mi] + ' ' + yr,
        shortPeriod: MONTHS[mi].slice(0, 3).toUpperCase() + yr,
        prorate: prorate.value === 'yes', statutory: statutory.value, state: state.value, pfCapped: pfCap.value === 'yes',
        company: company.value, companyIds: companyIds.value, tagline: tagline.value, notes: notes.value,
        accent: accent.value, pageSize: pageSize.value, payDate: fmtDate(payDate.value)
      };
      let R;
      try { R = runPayroll(st.rows, st.map, st.extras.filter(x => x.role !== 'ignore'), o); }
      catch (e) { msg.say(e.message, 'error'); return; }
      if (!R.people.length) { msg.say('No rows with an employee name were found. Check the Employee name mapping.', 'error'); return; }

      if (R.negatives.length) {
        msg.say('Nothing was written: ' + R.negatives.length + ' employee' + (R.negatives.length === 1 ? '' : 's') + ' would have negative net pay. Fix the sheet and run again.', 'error');
        result.appendChild(k.issues(R.negatives, 'negative net pay'));
        result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const S = k.S();
      const pages = R.people.map(p => payslipPage(p, o));
      const bank = bankRows(R, o);
      const sheets = [
        { name: 'Register', rows: registerRows(R, o) },
        { name: 'PF summary', rows: pfRows(R) },
        { name: 'ESI summary', rows: esiRows(R) },
        { name: 'Professional tax', rows: ptRows(R, o) },
        { name: 'TDS summary', rows: tdsRows(R) },
        { name: 'Bank transfer', rows: bank.concat([[], ['Banks differ. Some want a header row, some a fixed column order, some a debit-account line on top and a value date. These five fields are what every format is built from — reorder or rename them for your bank\'s template.']]) }
      ];
      const zipName = (p) => slug(p.empId) + '-' + slug(p.name) + '-' + slug(MONTHS[mi] + '-' + yr) + '.pdf';
      const author = String(o.company || '').split('\n')[0] || '';
      const onePdf = (p, i) => core().createPDF([pages[i]], { info: { Title: 'Payslip ' + o.period + ' - ' + p.name, Author: author, Subject: 'Payslip' } });
      const mkZip = () => window.MVRZip(R.people.map((p, i) => ({ name: zipName(p), blob: new Blob([onePdf(p, i)], { type: 'application/pdf' }) })));
      const mkCombined = () => new Blob([core().createPDF(pages, { info: { Title: 'Payslips ' + o.period, Author: author, Subject: 'Payslips' } })], { type: 'application/pdf' });

      result.appendChild(k.summaryCard(
        'Payroll for ' + R.period + ': ' + R.totals.headcount + ' employees, net payable ' + k.inr(R.totals.net),
        'Gross ' + k.inr(R.totals.gross) + ' · deductions ' + k.inr(R.totals.deductions) + ' · employer cost ' + k.inr(R.totals.employerCost),
        [
          k.downloadButton('payslips.zip', mkZip),
          k.downloadButton('payslips-combined.pdf', mkCombined, false),
          k.downloadButton('bank-transfer.csv', () => new Blob([S.toCSV(bank)], { type: 'text/csv' }), false),
          k.downloadButton('payroll-register.xlsx', () => S.writeXlsx(sheets), false)
        ]));

      result.appendChild(k.statGrid([
        ['Headcount', R.totals.headcount],
        ['Gross earnings', k.inr(R.totals.gross)],
        ['Total deductions', k.inr(R.totals.deductions)],
        ['Net payable', k.inr(R.totals.net)],
        ['Employer cost', k.inr(R.totals.employerCost)],
        ['PF — employee / employer', k.inr(R.totals.pfEmployee) + ' / ' + k.inr(R.totals.pfEmployer)],
        ['PF — pension (EPS) / EPF', k.inr(R.totals.eps) + ' / ' + k.inr(R.totals.epfEmployer)],
        ['EDLI + admin', k.inr(r2(R.totals.edli + R.totals.admin))],
        ['ESI — employee / employer', k.inr(R.totals.esiEmployee) + ' / ' + k.inr(R.totals.esiEmployer)],
        ['Professional tax', k.inr(R.totals.pt)],
        ['TDS', k.inr(R.totals.tds)],
        ['In the bank file', (bank.length - 1) + ' of ' + R.totals.headcount + ' employees']
      ]));

      const warnings = R.dayWarnings.concat(R.bankWarnings);
      if (warnings.length) result.appendChild(k.issues(warnings, 'warning'));

      result.appendChild(k.h3('Register'));
      result.appendChild(k.previewTable(sheets[0].rows, 25));
      result.appendChild(k.h3('PF summary'));
      result.appendChild(k.previewTable(sheets[1].rows, 25));
      result.appendChild(k.h3('ESI summary'));
      result.appendChild(k.previewTable(sheets[2].rows, 25));
      result.appendChild(k.h3('Bank transfer file'));
      result.appendChild(k.previewTable(bank, 25));

      msg.say('');
      result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="payroll-run"]'); if (r) mount(r); });
  window.MVRPayroll = { PF, ESI, PT_STATES, professionalTax, runPayroll, payslipPage, registerRows, pfRows, esiRows, ptRows, tdsRows, bankRows, rupeesInWords, indianWords, FIELDS };
})();
