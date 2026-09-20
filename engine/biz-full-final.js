/**
 * What a leaver is owed, itemised.
 *
 * Full and final settlement is where an otherwise clean exit turns into an
 * argument, because nobody writes down how each figure was reached. This
 * takes the dates, the salary and the balances, and produces a statement
 * that shows the working: the last month's pro-rated pay, leave
 * encashment, gratuity with the 15/26 formula and the rounding rule
 * spelled out, notice pay recovered or paid in lieu, every deduction, and
 * the net. It prints as a statement the employee can sign. Nothing leaves
 * the device.
 */
(function () {
  'use strict';
  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['full-final-settlement'] = {
    title: 'Full & Final Settlement Calculator',
    short: 'Full & Final',
    description: 'Work out exactly what a leaving employee is owed: pro-rated salary for the final month, leave encashment, gratuity under the 15/26 formula with the rounding rule and the Rs 20 lakh cap, notice pay recovered or paid in lieu, reimbursements, advances, loans and asset recovery — then download a signable settlement statement as PDF and the working as a spreadsheet. Runs in your browser; nothing is uploaded.',
    keywords: ['full and final settlement calculator', 'fnf settlement india', 'gratuity calculator 15/26', 'leave encashment calculator', 'notice period recovery calculation', 'final settlement statement format', 'resignation settlement calculator', 'fnf statement pdf'],
    glyph: 'i-fnf',
    glyphSvg: '<symbol id="i-fnf" viewBox="0 0 24 24">\n  <path d="M5 2.8h9l5 5v13.4H5z"/>\n  <path d="M14 2.8v5h5" class="thin"/>\n  <path d="M8 12h8M8 15h8" class="thin"/>\n  <path d="M8 18.2c1.4-1.6 2.6-1.6 4 0s2.6 1.6 4 0"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/pdfcore.bundle.js', '/engine/biz-kit.js', '/engine/biz-full-final.js'],
    tips: [
      'Service is counted from the date of joining to the last working day inclusive, so 1 April 2019 to 31 March 2024 is exactly five years. The statement prints the years, months and days it counted, so a dispute is about a date rather than about arithmetic.',
      'Gratuity here follows the Payment of Gratuity Act wording: 15 ÷ 26 × last drawn Basic+DA × completed years, where a part year of more than six months counts as a whole year, capped at Rs 20,00,000. Five years of continuous service is the usual threshold; courts have read four years and 240 days as enough in some cases, and death or permanent disablement removes the threshold altogether — set eligibility by hand for those.',
      'Leave encashment is on Basic or on gross depending on your policy, and the per-day rate divides by 26 working days or by 30 calendar days — again, your policy. Both switches are on the page and both are printed on the statement, so the employee can see which was used.',
      'Notice can go three ways and the statement says which: the shortfall recovered from the employee, waived by the company, or paid to the employee in lieu when the company cuts the notice short. The per-day rate uses the same basis and divisor as leave encashment.',
      'Statutory rates and the professional tax slabs are in one clearly-marked constant at the top of this file with the date they were last checked. Rates move with the Budget and state PT tables change in between — check them before you pay.',
      'TDS is typed in, not computed: a leaver\'s final deduction depends on the whole year\'s income, the regime, what is exempt and what has already been deducted. Ask payroll or your accountant for the figure and enter it.',
      'The rupee sign cannot be drawn with the standard PDF fonts, so the statement prints "Rs". Every bank and auditor reads it the same way.'
    ],
    faq: [
      { q: 'How is gratuity worked out, exactly?', a: 'Fifteen days\' wages for every completed year of service, where a day\'s wages is the last drawn Basic plus DA divided by 26 — so 15 ÷ 26 × (Basic+DA) × years. A part year of more than six months counts as a whole year; anything less is dropped. The total is capped at Rs 20,00,000. Gratuity received under the Act is exempt up to the least of the amount received, the formula figure and the cap, so an ex-gratia amount above the formula shows as taxable on the statement.' },
      { q: 'When does the money have to be paid?', a: 'Wages due on termination are payable within two working days of the last working day under section 5(2) of the Payment of Wages Act, 1936, and the Code on Wages, 2019 repeats that in section 17(2). Gratuity must be paid within 30 days of becoming payable, with simple interest after that, under sections 7(3) and 7(3A) of the Payment of Gratuity Act, 1972. Many employers in practice settle in 30 to 45 days. This is a note on what the statutes say, not legal advice — check the rules that apply in your state, and take advice if the settlement is disputed.' },
      { q: 'Can the company recover notice pay and hold the settlement until assets are returned?', a: 'Notice recovery is normally contractual and is shown here as a deduction with the number of days and the per-day rate printed. Whether an employer may set off an asset that was not returned, and whether it may withhold the whole settlement, depends on the contract and on state law — the statement itemises the recovery so that it can be challenged line by line rather than as a single unexplained number.' },
      { q: 'Does the employee\'s data leave my computer?', a: 'No. Every figure is computed in your browser and the PDF and the spreadsheet are written there. Salary, PAN and bank details never go anywhere.' }
    ]
  };
  if (typeof document === 'undefined') return;
  const K = () => window.MVRBizKit;
  const core = () => { if (!window.MVRPdfCore) throw new Error('The PDF engine did not load.'); return window.MVRPdfCore; };

  /* ============================================================
   * STATUTORY CONSTANTS — CHECK BEFORE YOU PAY
   * Last checked: 2026-09-20
   * ============================================================ */
  const GRATUITY = { numerator: 15, denominator: 26, cap: 2000000, qualifyingYears: 5, partYearMonths: 6 };
  const PF_EMPLOYEE_RATE = 0.12;
  const PF_WAGE_CEILING = 15000;
  const PT_STATES = [
    { code: 'none', label: 'No professional tax (Delhi, Haryana, UP, Rajasthan, …)', basis: 'month', bands: [[Infinity, 0]] },
    { code: 'MH', label: 'Maharashtra', basis: 'month', bands: [[7500, 0], [10000, 175], [Infinity, 200]] },
    { code: 'KA', label: 'Karnataka', basis: 'month', bands: [[24999.99, 0], [Infinity, 200]] },
    { code: 'WB', label: 'West Bengal', basis: 'month', bands: [[10000, 0], [15000, 110], [25000, 130], [40000, 150], [Infinity, 200]] },
    { code: 'TN', label: 'Tamil Nadu (half-yearly)', basis: 'halfyear', bands: [[21000, 0], [30000, 135], [45000, 315], [60000, 690], [75000, 1025], [Infinity, 1250]] },
    { code: 'AP', label: 'Andhra Pradesh / Telangana', basis: 'month', bands: [[15000, 0], [20000, 150], [Infinity, 200]] },
    { code: 'GJ', label: 'Gujarat', basis: 'month', bands: [[12000, 0], [Infinity, 200]] },
    { code: 'MP', label: 'Madhya Pradesh', basis: 'month', bands: [[18750, 0], [25000, 125], [33333, 166.67], [Infinity, 208.33]] }
  ];
  const ptState = (c) => PT_STATES.find(s => s.code === c) || PT_STATES[0];
  function professionalTax(monthlyGross, code) {
    const st = ptState(code);
    const basis = st.basis === 'halfyear' ? monthlyGross * 6 : monthlyGross;
    for (const [upTo, amount] of st.bands) if (basis <= upTo) return r2(st.basis === 'halfyear' ? amount / 6 : amount);
    return 0;
  }

  /* ---------- money, dates, words ---------- */

  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  function inr(n) {
    const neg = n < 0;
    const s = Math.abs(Number(n) || 0).toFixed(2);
    const i = s.slice(0, -3), d = s.slice(-2);
    const head = i.length > 3 ? i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + i.slice(-3) : i;
    return (neg ? '-' : '') + head + '.' + d;
  }
  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => x < 20 ? ONES[x] : TENS[Math.floor(x / 10)] + (x % 10 ? '-' + ONES[x % 10] : '');
  /* Copied from the single-payslip tool rather than shared: a change to one
     tool must never silently move another tool's numbers. */
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
  const pad = (n) => String(n).padStart(2, '0');
  const parts = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso)); if (!m) return null; return { y: +m[1], m: +m[2], d: +m[3] }; };
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();   /* m is 1-12 */
  const longDate = (iso) => { const p = parts(iso); return p ? p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y : String(iso || ''); };
  const addDay = (iso) => { const p = parts(iso); const d = new Date(Date.UTC(p.y, p.m - 1, p.d + 1)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };

  /** Service from joining to the last working day, inclusive, as y/m/d. */
  function serviceSpan(dojIso, lwdIso) {
    const a = parts(dojIso), endIso = addDay(lwdIso), b = parts(endIso);
    if (!a || !b) throw new Error('Check the dates.');
    if (Date.parse(endIso) <= Date.parse(dojIso)) throw new Error('The last working day must be on or after the date of joining.');
    let y = b.y - a.y, m = b.m - a.m, d = b.d - a.d;
    if (d < 0) { m -= 1; const pm = b.m === 1 ? 12 : b.m - 1, py = b.m === 1 ? b.y - 1 : b.y; d += daysInMonth(py, pm); }
    if (m < 0) { y -= 1; m += 12; }
    const totalDays = Math.round((Date.parse(endIso) - Date.parse(dojIso)) / 86400000);
    return { years: y, months: m, days: d, totalDays };
  }

  /**
   * The settlement. Pure arithmetic from the inputs, so the Python check can
   * reproduce every line from scratch.
   */
  function settle(o) {
    const doj = o.doj, lwd = o.lwd;
    if (!parts(doj) || !parts(lwd)) throw new Error('Enter both the date of joining and the last working day.');
    const span = serviceSpan(doj, lwd);
    const basic = Math.max(0, Number(o.monthlyBasic) || 0);     /* Basic + DA */
    const gross = Math.max(0, Number(o.monthlyGross) || 0);
    if (gross < basic) throw new Error('The monthly gross cannot be less than Basic + DA.');

    /* last month, pro-rated */
    const lw = parts(lwd);
    const dim = daysInMonth(lw.y, lw.m);
    const dj = parts(doj);
    const joinedThisMonth = dj.y === lw.y && dj.m === lw.m;
    const autoWorked = joinedThisMonth ? (lw.d - dj.d + 1) : lw.d;
    const worked = o.finalDaysWorked === '' || o.finalDaysWorked == null ? autoWorked : Math.max(0, Number(o.finalDaysWorked) || 0);
    const finalSalary = r2(gross * worked / dim);
    const finalBasic = r2(basic * worked / dim);

    /* per-day rate for leave and notice */
    const divisor = Number(o.divisor) === 26 ? 26 : 30;
    const leaveBase = o.leaveOn === 'gross' ? gross : basic;
    const leaveRate = leaveBase / divisor;
    const leaveDays = Math.max(0, Number(o.leaveDays) || 0);
    const leaveEncashment = r2(leaveDays * leaveRate);

    const noticeBase = o.noticeOn === 'gross' ? gross : basic;
    const noticeRate = noticeBase / divisor;
    const required = Math.max(0, Number(o.noticeRequiredDays) || 0);
    const served = Math.max(0, Number(o.noticeServedDays) || 0);
    const shortfall = Math.max(0, required - served);
    let noticeRecovery = 0, noticePayInLieu = 0;
    if (o.noticeTreatment === 'recover') noticeRecovery = r2(shortfall * noticeRate);
    else if (o.noticeTreatment === 'inlieu') noticePayInLieu = r2(shortfall * noticeRate);

    /* gratuity */
    const eligibleByService = span.years >= GRATUITY.qualifyingYears;
    const eligible = o.gratuityEligibility === 'yes' ? true : o.gratuityEligibility === 'no' ? false : eligibleByService;
    const partCountsAsYear = span.months > GRATUITY.partYearMonths || (span.months === GRATUITY.partYearMonths && span.days > 0);
    const gratuityYears = eligible ? span.years + (partCountsAsYear ? 1 : 0) : 0;
    const formula = eligible ? r2(GRATUITY.numerator / GRATUITY.denominator * basic * gratuityYears) : 0;
    const statutory = Math.min(formula, GRATUITY.cap);
    const override = o.gratuityOverride === '' || o.gratuityOverride == null ? null : Math.max(0, Number(o.gratuityOverride) || 0);
    const gratuityPaid = override === null ? r2(statutory) : r2(override);
    const gratuityExempt = r2(Math.min(gratuityPaid, statutory, GRATUITY.cap));
    const gratuityTaxable = r2(gratuityPaid - gratuityExempt);

    /* statutory deductions on the final month */
    let pf = 0, pt = 0;
    if (o.statutory === 'compute') {
      const pfWage = o.pfCapped ? Math.min(finalBasic, PF_WAGE_CEILING) : finalBasic;
      pf = Math.round(pfWage * PF_EMPLOYEE_RATE);
      pt = professionalTax(finalSalary, o.state);
    }

    const num = (v) => Math.max(0, Number(v) || 0);
    const earnings = [
      ['Salary for ' + worked + ' of ' + dim + ' days in ' + MONTHS[lw.m - 1] + ' ' + lw.y, finalSalary],
      ['Leave encashment — ' + leaveDays + ' days at Rs ' + inr(leaveRate) + '/day (' + (o.leaveOn === 'gross' ? 'gross' : 'Basic+DA') + ' ÷ ' + divisor + ')', leaveEncashment],
      ['Gratuity' + (eligible ? ' — ' + GRATUITY.numerator + '/' + GRATUITY.denominator + ' × Rs ' + inr(basic) + ' × ' + gratuityYears + ' year' + (gratuityYears === 1 ? '' : 's') : ' — not payable'), gratuityPaid],
      ['Notice pay in lieu — ' + shortfall + ' days at Rs ' + inr(noticeRate) + '/day', noticePayInLieu],
      ['Pending reimbursements', r2(num(o.reimbursements))],
      ['Bonus / incentive due', r2(num(o.bonusDue))],
      [String(o.otherAdditionLabel || 'Other payable').trim() || 'Other payable', r2(num(o.otherAddition))]
    ].filter(row => row[1] > 0 || /^Salary for/.test(row[0]));

    const deductions = [
      ['Notice shortfall recovered — ' + shortfall + ' days at Rs ' + inr(noticeRate) + '/day', noticeRecovery],
      ['Provident fund on the final month', r2(pf)],
      ['Professional tax (' + ptState(o.state).label + ')', r2(pt)],
      ['Income tax (TDS)', r2(num(o.tds))],
      ['Salary advance outstanding', r2(num(o.advance))],
      ['Loan outstanding', r2(num(o.loan))],
      ['Assets not returned', r2(num(o.assetRecovery))],
      [String(o.otherDeductionLabel || 'Other recovery').trim() || 'Other recovery', r2(num(o.otherDeduction))]
    ].filter(row => row[1] > 0);

    const totalEarnings = r2(earnings.reduce((s, r) => s + r[1], 0));
    const totalDeductions = r2(deductions.reduce((s, r) => s + r[1], 0));
    const net = r2(totalEarnings - totalDeductions);

    return {
      inputs: o, span, doj, lwd,
      basic, gross, dim, worked, finalSalary, finalBasic,
      divisor, leaveDays, leaveRate: r2(leaveRate), leaveEncashment,
      noticeRequired: required, noticeServed: served, shortfall, noticeRate: r2(noticeRate), noticeRecovery, noticePayInLieu,
      eligible, eligibleByService, partCountsAsYear, gratuityYears, gratuityFormula: r2(formula), gratuityStatutory: r2(statutory),
      gratuityPaid, gratuityExempt, gratuityTaxable, gratuityCapped: formula > GRATUITY.cap,
      pf: r2(pf), pt: r2(pt),
      earnings, deductions, totalEarnings, totalDeductions, net,
      words: rupeesInWords(net)
    };
  }

  const DEADLINE_NOTE = 'Wages due on termination are payable within two working days of the last working day (Payment of Wages Act, 1936, s.5(2); Code on Wages, 2019, s.17(2)). Gratuity is payable within 30 days of becoming payable, with simple interest after that (Payment of Gratuity Act, 1972, s.7(3) and s.7(3A)). This is a note on what the statutes say, not legal advice.';

  /* ---------- rows ---------- */

  function statementRows(s) {
    const rows = [['Line', 'Amount (Rs)']];
    rows.push(['A. AMOUNTS PAYABLE', '']);
    s.earnings.forEach(r => rows.push([r[0], r[1]]));
    rows.push(['Total payable (A)', s.totalEarnings]);
    rows.push(['B. RECOVERIES AND DEDUCTIONS', '']);
    if (!s.deductions.length) rows.push(['None', 0]);
    s.deductions.forEach(r => rows.push([r[0], r[1]]));
    rows.push(['Total deductions (B)', s.totalDeductions]);
    rows.push(['NET PAYABLE (A − B)', s.net]);
    rows.push(['In words', s.words]);
    return rows;
  }

  function basisRows(s) {
    return [
      ['Item', 'Value', 'How it was reached'],
      ['Date of joining', longDate(s.doj), 'as entered'],
      ['Last working day', longDate(s.lwd), 'as entered'],
      ['Service', s.span.years + ' years, ' + s.span.months + ' months, ' + s.span.days + ' days', s.span.totalDays + ' days, counting both end dates'],
      ['Monthly Basic + DA', s.basic, 'as entered — the last drawn figure'],
      ['Monthly gross', s.gross, 'as entered'],
      ['Days worked in the final month', s.worked + ' of ' + s.dim, 'pro-rated salary = gross × days worked ÷ days in month'],
      ['Per-day rate', s.leaveRate, (s.inputs.leaveOn === 'gross' ? 'gross' : 'Basic + DA') + ' ÷ ' + s.divisor],
      ['Leave balance encashed', s.leaveDays + ' days', s.leaveDays + ' × ' + s.leaveRate],
      ['Notice required / served', s.noticeRequired + ' / ' + s.noticeServed + ' days', 'shortfall ' + s.shortfall + ' days at ' + s.noticeRate + '/day, ' +
        (s.inputs.noticeTreatment === 'recover' ? 'recovered from the employee' : s.inputs.noticeTreatment === 'inlieu' ? 'paid by the company in lieu' : 'waived by the company')],
      ['Gratuity eligibility', s.eligible ? 'eligible' : 'not eligible', s.inputs.gratuityEligibility === 'auto'
        ? (s.eligibleByService ? 'service of ' + s.span.years + ' years meets the ' + GRATUITY.qualifyingYears + '-year threshold' : 'service is under ' + GRATUITY.qualifyingYears + ' years')
        : 'set by hand'],
      ['Gratuity years counted', s.gratuityYears, s.eligible ? s.span.years + ' completed years' + (s.partCountsAsYear ? ' plus the part year of ' + s.span.months + ' months ' + s.span.days + ' days, which exceeds six months' : ' (the part year of ' + s.span.months + ' months ' + s.span.days + ' days does not exceed six months)') : 'not payable'],
      ['Gratuity by the formula', s.gratuityFormula, GRATUITY.numerator + '/' + GRATUITY.denominator + ' × ' + s.basic + ' × ' + s.gratuityYears],
      ['Gratuity after the statutory cap', s.gratuityStatutory, 'cap Rs ' + GRATUITY.cap.toLocaleString('en-IN') + (s.gratuityCapped ? ' — applied' : ' — not reached')],
      ['Gratuity paid', s.gratuityPaid, s.inputs.gratuityOverride === '' || s.inputs.gratuityOverride == null ? 'the statutory figure' : 'entered by hand'],
      ['Gratuity exempt from tax', s.gratuityExempt, 'least of the amount paid, the formula figure and the cap'],
      ['Gratuity taxable', s.gratuityTaxable, 'the balance above the exempt amount'],
      ['Statutory deductions', s.inputs.statutory === 'compute' ? 'computed here' : 'not applied', s.inputs.statutory === 'compute' ? 'PF 12% of the final month\'s Basic' + (s.inputs.pfCapped ? ' capped at Rs 15,000' : '') + '; professional tax from ' + ptState(s.inputs.state).label : 'enter them as other recoveries if they apply'],
      ['Payment deadline', 'see the note', DEADLINE_NOTE]
    ];
  }

  /* ---------- the PDF ---------- */

  function settlementPdf(s, o) {
    const c = core();
    const [W, H] = c.PAGE_SIZES[o.pageSize] || c.PAGE_SIZES.a4;
    const accent = /^#[0-9a-f]{6}$/i.test(o.accent || '') ? o.accent : '#1f3a5f';
    const GREY = '#666666', LIGHT = '#f3f4f6', RULE = '#e2e4e8';
    const m = 46, ops = [];
    const fit = (t, font, size, maxW) => {
      let x = String(t == null ? '' : t);
      if (c.textWidth(x, font, size) <= maxW) return x;
      while (x.length > 1 && c.textWidth(x + '…', font, size) > maxW) x = x.slice(0, -1);
      return x + '…';
    };
    ops.push({ rect: [0, H - 6, W, 6], fill: accent });
    const company = String(o.company || '').split('\n').map(x => x.trim()).filter(Boolean);
    let y = H - 56;
    ops.push({ text: fit(company[0] || 'Company', 'Helvetica-Bold', 15, W * 0.55), x: m, y, size: 15, font: 'Helvetica-Bold' });
    let yl = y - 16;
    company.slice(1).forEach(ln => { ops.push({ text: fit(ln, 'Helvetica', 9, W * 0.55), x: m, y: yl, size: 9, colour: GREY }); yl -= 12; });
    if (String(o.companyIds || '').trim()) { ops.push({ text: fit(o.companyIds.trim(), 'Helvetica', 9, W * 0.55), x: m, y: yl, size: 9, colour: GREY }); yl -= 12; }
    ops.push({ text: 'FULL & FINAL', x: W - m, y, size: 17, font: 'Helvetica-Bold', align: 'right', colour: accent });
    ops.push({ text: 'SETTLEMENT STATEMENT', x: W - m, y: y - 15, size: 11, font: 'Helvetica-Bold', align: 'right', colour: accent });
    ops.push({ text: 'Prepared ' + longDate(o.today), x: W - m, y: y - 30, size: 9, align: 'right', colour: GREY });
    y = Math.min(yl, y - 42) - 6;
    ops.push({ line: [m, y, W - m, y], stroke: accent, lineWidth: 1.2 });
    y -= 18;

    const items = [
      ['EMPLOYEE NAME', o.empName], ['EMPLOYEE ID', o.empId], ['DESIGNATION', o.designation],
      ['DEPARTMENT', o.department], ['PAN', o.pan], ['UAN', o.uan],
      ['DATE OF JOINING', longDate(s.doj)], ['LAST WORKING DAY', longDate(s.lwd)],
      ['SERVICE', s.span.years + 'y ' + s.span.months + 'm ' + s.span.days + 'd']
    ].map(([kk, v]) => [kk, String(v == null ? '' : v).trim() || '—']);
    const cols = 3, colW = (W - m * 2 - 24) / cols, rowH = 29;
    const boxH = Math.ceil(items.length / cols) * rowH + 14;
    ops.push({ rect: [m, y - boxH, W - m * 2, boxH], fill: LIGHT });
    items.forEach(([kk, v], i) => {
      const cx = m + 12 + (i % cols) * colW, cy = y - 20 - Math.floor(i / cols) * rowH;
      ops.push({ text: kk, x: cx, y: cy, size: 7, font: 'Helvetica-Bold', colour: GREY });
      ops.push({ text: fit(v, 'Helvetica', 9.5, colW - 14), x: cx, y: cy - 12, size: 9.5 });
    });
    y -= boxH + 16;

    const lineH = 14, amtX = W - m - 8, labelW = W - m * 2 - 120;
    const section = (title, list, total, totalLabel) => {
      ops.push({ rect: [m, y - 18, W - m * 2, 18], fill: accent });
      ops.push({ text: title, x: m + 8, y: y - 13, size: 8, font: 'Helvetica-Bold', colour: '#ffffff' });
      ops.push({ text: 'AMOUNT (Rs)', x: amtX, y: y - 13, size: 8, font: 'Helvetica-Bold', align: 'right', colour: '#ffffff' });
      y -= 18 + 13;
      if (!list.length) { ops.push({ text: 'None', x: m + 8, y, size: 9.5, colour: GREY }); y -= lineH; }
      list.forEach(([label, amount]) => {
        ops.push({ text: fit(label, 'Helvetica', 9.5, labelW), x: m + 8, y, size: 9.5 });
        ops.push({ text: inr(amount), x: amtX, y, size: 9.5, align: 'right' });
        ops.push({ line: [m, y - 5, W - m, y - 5], stroke: RULE, lineWidth: 0.5 });
        y -= lineH;
      });
      ops.push({ text: totalLabel, x: m + 8, y: y - 2, size: 10, font: 'Helvetica-Bold' });
      ops.push({ text: inr(total), x: amtX, y: y - 2, size: 10, font: 'Helvetica-Bold', align: 'right' });
      y -= lineH + 8;
    };
    section('A · AMOUNTS PAYABLE', s.earnings, s.totalEarnings, 'Total payable (A)');
    section('B · RECOVERIES AND DEDUCTIONS', s.deductions, s.totalDeductions, 'Total deductions (B)');

    ops.push({ rect: [m, y - 32, W - m * 2, 32], fill: accent });
    ops.push({ text: 'NET PAYABLE', x: m + 12, y: y - 20, size: 11, font: 'Helvetica-Bold', colour: '#ffffff' });
    ops.push({ text: 'Rs ' + inr(s.net), x: W - m - 12, y: y - 21, size: 14, font: 'Helvetica-Bold', align: 'right', colour: '#ffffff' });
    y -= 32 + 14;
    c.wrapText('In words: ' + s.words, 'Helvetica', 9, W - m * 2).forEach((ln, i) => ops.push({ text: ln, x: m, y: y - i * 11, size: 9, colour: '#333333' }));
    y -= 24;

    const grat = s.eligible
      ? 'Gratuity: ' + GRATUITY.numerator + '/' + GRATUITY.denominator + ' x Rs ' + inr(s.basic) + ' (last drawn Basic + DA) x ' + s.gratuityYears + ' year(s) = Rs ' + inr(s.gratuityFormula) +
        (s.gratuityCapped ? ', capped at Rs ' + inr(GRATUITY.cap) : '') + '. Exempt Rs ' + inr(s.gratuityExempt) + ', taxable Rs ' + inr(s.gratuityTaxable) + '.'
      : 'Gratuity is not payable: service of ' + s.span.years + ' years ' + s.span.months + ' months is under the ' + GRATUITY.qualifyingYears + '-year threshold, unless the exit is by death or permanent disablement.';
    /* leave and notice can sit on different bases, so name each one */
    const perDay = (on, rate) => (on === 'gross' ? 'gross' : 'Basic + DA') + ' divided by ' + s.divisor + ' (Rs ' + inr(rate) + ' a day)';
    const basisText = grat + ' Leave encashment uses ' + perDay(s.inputs.leaveOn, s.leaveRate) +
      '; notice pay uses ' + perDay(s.inputs.noticeOn, s.noticeRate) + '.';
    c.wrapText(basisText, 'Helvetica', 8, W - m * 2).forEach((ln, i) => ops.push({ text: ln, x: m, y: y - i * 10, size: 8, colour: '#444444' }));
    y -= c.wrapText(basisText, 'Helvetica', 8, W - m * 2).length * 10 + 8;
    c.wrapText(DEADLINE_NOTE, 'Helvetica', 7.5, W - m * 2).forEach((ln, i) => ops.push({ text: ln, x: m, y: y - i * 9.5, size: 7.5, colour: GREY }));
    y -= c.wrapText(DEADLINE_NOTE, 'Helvetica', 7.5, W - m * 2).length * 9.5 + 14;

    if (y > 110) {
      const decl = 'I confirm that I have received the amount shown above in full and final settlement of all my dues, and that I have returned all company property in my possession.';
      c.wrapText(decl, 'Helvetica', 8.5, W - m * 2).forEach((ln, i) => ops.push({ text: ln, x: m, y: y - i * 11, size: 8.5, colour: '#333333' }));
      y -= c.wrapText(decl, 'Helvetica', 8.5, W - m * 2).length * 11 + 34;
      const half = (W - m * 2 - 40) / 2;
      [['Employee signature', o.empName], ['For ' + (company[0] || 'the company'), o.signatory || 'Authorised signatory']].forEach(([label, who], i) => {
        const x0 = m + i * (half + 40);
        ops.push({ line: [x0, y, x0 + half, y], stroke: '#333333', lineWidth: 0.6 });
        ops.push({ text: label, x: x0, y: y - 12, size: 8, font: 'Helvetica-Bold', colour: GREY });
        ops.push({ text: fit(who, 'Helvetica', 9, half), x: x0, y: y - 24, size: 9 });
        ops.push({ text: 'Date:', x: x0, y: y - 38, size: 8, colour: GREY });
      });
    }
    ops.push({ line: [m, 40, W - m, 40], stroke: RULE, lineWidth: 0.5 });
    ops.push({ text: fit((company[0] || '') + ' · Full and final settlement · ' + (o.empName || ''), 'Helvetica', 7.5, W - m * 2 - 90), x: m, y: 28, size: 7.5, colour: GREY });
    ops.push({ text: 'Confidential', x: W - m, y: 28, size: 7.5, align: 'right', colour: GREY });
    return c.createPDF([{ size: [W, H], ops }], { info: { Title: 'Full and final settlement - ' + (o.empName || ''), Author: company[0] || '', Subject: 'Full and final settlement' } });
  }

  /* ---------- UI ---------- */

  function mount(root) {
    const k = K(); const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const msg = k.msgBox();
    const today = new Date();
    const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

    io.appendChild(k.h3('The employee'));
    const empBar = k.el('div', 'opt-bar');
    const empName = k.textInput('ff-name', 'Priya Sharma');
    const empId = k.textInput('ff-id', 'EMP-0042');
    const designation = k.textInput('ff-desig', 'Senior Developer');
    const department = k.textInput('ff-dept', 'Engineering');
    const pan = k.textInput('ff-pan', '');
    const uan = k.textInput('ff-uan', '');
    empBar.appendChild(k.field('Employee name', empName));
    empBar.appendChild(k.field('Employee ID', empId));
    empBar.appendChild(k.field('Designation', designation));
    empBar.appendChild(k.field('Department', department));
    empBar.appendChild(k.field('PAN', pan));
    empBar.appendChild(k.field('UAN', uan));
    io.appendChild(empBar);

    const dateBar = k.el('div', 'opt-bar');
    const doj = k.textInput('ff-doj', '2019-04-01', '', 'date');
    const lwd = k.textInput('ff-lwd', iso(today), '', 'date');
    const finalDays = k.textInput('ff-final-days', '', '', 'number'); finalDays.min = 0;
    dateBar.appendChild(k.field('Date of joining', doj));
    dateBar.appendChild(k.field('Last working day', lwd));
    dateBar.appendChild(k.field('Days worked in the final month', finalDays, 'Leave blank to count to the last working day'));
    io.appendChild(dateBar);

    io.appendChild(k.h3('Salary and policy'));
    const payBar = k.el('div', 'opt-bar');
    const basic = k.textInput('ff-basic', '60000', '', 'number'); basic.min = 0;
    const gross = k.textInput('ff-gross', '150000', '', 'number'); gross.min = 0;
    const divisor = k.select('ff-divisor', [{ value: 26, label: '26 working days' }, { value: 30, label: '30 calendar days' }], 26);
    const leaveOn = k.select('ff-leave-on', [{ value: 'basic', label: 'Basic + DA' }, { value: 'gross', label: 'Gross' }], 'basic');
    const leaveDays = k.textInput('ff-leave-days', '18', '', 'number'); leaveDays.min = 0; leaveDays.step = '0.5';
    payBar.appendChild(k.field('Monthly Basic + DA', basic, 'The last drawn figure — gratuity uses this'));
    payBar.appendChild(k.field('Monthly gross', gross));
    payBar.appendChild(k.field('Per-day rate divides by', divisor));
    payBar.appendChild(k.field('Leave encashment on', leaveOn));
    payBar.appendChild(k.field('Leave balance (days)', leaveDays));
    io.appendChild(payBar);

    const noticeBar = k.el('div', 'opt-bar');
    const noticeReq = k.textInput('ff-notice-req', '60', '', 'number'); noticeReq.min = 0;
    const noticeServed = k.textInput('ff-notice-served', '60', '', 'number'); noticeServed.min = 0;
    const noticeOn = k.select('ff-notice-on', [{ value: 'basic', label: 'Basic + DA' }, { value: 'gross', label: 'Gross' }], 'gross');
    const noticeTreat = k.select('ff-notice-treat', [
      { value: 'recover', label: 'Shortfall recovered from the employee' },
      { value: 'waive', label: 'Shortfall waived by the company' },
      { value: 'inlieu', label: 'Company pays in lieu of notice' }
    ], 'recover');
    noticeBar.appendChild(k.field('Notice required (days)', noticeReq, '30 days is one month'));
    noticeBar.appendChild(k.field('Notice served (days)', noticeServed));
    noticeBar.appendChild(k.field('Notice pay on', noticeOn));
    noticeBar.appendChild(k.field('Shortfall is', noticeTreat));
    io.appendChild(noticeBar);

    const gratBar = k.el('div', 'opt-bar');
    const gratEligible = k.select('ff-grat', [
      { value: 'auto', label: 'Automatic — 5 years of service' },
      { value: 'yes', label: 'Eligible (death or permanent disablement)' },
      { value: 'no', label: 'Not eligible' }
    ], 'auto');
    const gratOverride = k.textInput('ff-grat-amount', '', '', 'number'); gratOverride.min = 0;
    gratBar.appendChild(k.field('Gratuity eligibility', gratEligible));
    gratBar.appendChild(k.field('Gratuity paid (override)', gratOverride, 'Leave blank for the statutory figure'));
    io.appendChild(gratBar);

    io.appendChild(k.h3('Other amounts'));
    const otherBar = k.el('div', 'opt-bar');
    const reimb = k.textInput('ff-reimb', '0', '', 'number'); reimb.min = 0;
    const bonusDue = k.textInput('ff-bonus', '0', '', 'number'); bonusDue.min = 0;
    const otherAddLabel = k.textInput('ff-other-add-label', 'Other payable');
    const otherAdd = k.textInput('ff-other-add', '0', '', 'number'); otherAdd.min = 0;
    otherBar.appendChild(k.field('Pending reimbursements', reimb));
    otherBar.appendChild(k.field('Bonus / incentive due', bonusDue));
    otherBar.appendChild(k.field('Other payable — label', otherAddLabel));
    otherBar.appendChild(k.field('Other payable — amount', otherAdd));
    io.appendChild(otherBar);

    const dedBar = k.el('div', 'opt-bar');
    const advance = k.textInput('ff-advance', '0', '', 'number'); advance.min = 0;
    const loan = k.textInput('ff-loan', '0', '', 'number'); loan.min = 0;
    const asset = k.textInput('ff-asset', '0', '', 'number'); asset.min = 0;
    const tds = k.textInput('ff-tds', '0', '', 'number'); tds.min = 0;
    const otherDedLabel = k.textInput('ff-other-ded-label', 'Other recovery');
    const otherDed = k.textInput('ff-other-ded', '0', '', 'number'); otherDed.min = 0;
    dedBar.appendChild(k.field('Salary advance outstanding', advance));
    dedBar.appendChild(k.field('Loan outstanding', loan));
    dedBar.appendChild(k.field('Assets not returned', asset));
    dedBar.appendChild(k.field('Income tax (TDS)', tds, 'Not computed — ask payroll'));
    dedBar.appendChild(k.field('Other recovery — label', otherDedLabel));
    dedBar.appendChild(k.field('Other recovery — amount', otherDed));
    io.appendChild(dedBar);

    const statBar = k.el('div', 'opt-bar');
    const statutory = k.select('ff-statutory', [{ value: 'compute', label: 'Deduct PF and professional tax' }, { value: 'none', label: 'Do not deduct them' }], 'compute');
    const state = k.select('ff-state', PT_STATES.map(s => ({ value: s.code, label: s.label })), 'KA');
    const pfCap = k.select('ff-pfcap', [{ value: 'yes', label: 'Capped at Rs 15,000/month' }, { value: 'no', label: 'Full Basic + DA' }], 'yes');
    statBar.appendChild(k.field('Final month statutory', statutory));
    statBar.appendChild(k.field('State (professional tax)', state));
    statBar.appendChild(k.field('PF wage', pfCap));
    io.appendChild(statBar);

    io.appendChild(k.h3('The company block on the statement'));
    const company = k.textarea('ff-company', 'Acme Software Pvt Ltd\n12 MG Road, Bengaluru 560001\nKarnataka, India', 'Name on the first line, then the address', 3);
    io.appendChild(k.field('Company', company));
    const coBar = k.el('div', 'opt-bar');
    const companyIds = k.textInput('ff-ids', '', 'CIN U72200KA2015PTC080123');
    const signatory = k.textInput('ff-signatory', 'Authorised signatory');
    const accent = k.textInput('ff-accent', '#1f3a5f', '', 'color');
    const pageSize = k.select('ff-page', [{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }, { value: 'legal', label: 'Legal' }], 'a4');
    coBar.appendChild(k.field('CIN / GSTIN', companyIds));
    coBar.appendChild(k.field('Signed for the company by', signatory));
    coBar.appendChild(k.field('Accent colour', accent));
    coBar.appendChild(k.field('Page size', pageSize));
    io.appendChild(coBar);

    const run = k.el('div', 'io-actions pdf-run');
    run.appendChild(k.button('Calculate settlement', 'btn-primary', go));
    io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    function go() {
      result.innerHTML = '';
      let s;
      const o = {
        doj: doj.value, lwd: lwd.value,
        monthlyBasic: k.toNumber(basic.value), monthlyGross: k.toNumber(gross.value),
        finalDaysWorked: finalDays.value === '' ? '' : k.toNumber(finalDays.value),
        divisor: Number(divisor.value), leaveOn: leaveOn.value, leaveDays: k.toNumber(leaveDays.value),
        noticeRequiredDays: k.toNumber(noticeReq.value), noticeServedDays: k.toNumber(noticeServed.value),
        noticeOn: noticeOn.value, noticeTreatment: noticeTreat.value,
        gratuityEligibility: gratEligible.value, gratuityOverride: gratOverride.value === '' ? '' : k.toNumber(gratOverride.value),
        reimbursements: k.toNumber(reimb.value), bonusDue: k.toNumber(bonusDue.value),
        otherAdditionLabel: otherAddLabel.value, otherAddition: k.toNumber(otherAdd.value),
        advance: k.toNumber(advance.value), loan: k.toNumber(loan.value), assetRecovery: k.toNumber(asset.value),
        tds: k.toNumber(tds.value), otherDeductionLabel: otherDedLabel.value, otherDeduction: k.toNumber(otherDed.value),
        statutory: statutory.value, state: state.value, pfCapped: pfCap.value === 'yes'
      };
      try { s = settle(o); } catch (e) { msg.say(e.message, 'error'); return; }

      const pdfOpts = {
        empName: empName.value, empId: empId.value, designation: designation.value, department: department.value,
        pan: pan.value, uan: uan.value, company: company.value, companyIds: companyIds.value, signatory: signatory.value,
        accent: accent.value, pageSize: pageSize.value, leaveOn: leaveOn.value, today: iso(new Date())
      };
      const S = k.S();
      const sheets = [
        { name: 'Settlement', rows: statementRows(s) },
        { name: 'Service and basis', rows: basisRows(s) }
      ];
      result.appendChild(k.summaryCard(
        (s.net >= 0 ? 'Net payable to ' : 'Net recoverable from ') + (empName.value.trim() || 'the employee') + ': ' + k.inr(Math.abs(s.net)),
        'Payable ' + k.inr(s.totalEarnings) + ' · deductions ' + k.inr(s.totalDeductions) + ' · service ' + s.span.years + 'y ' + s.span.months + 'm ' + s.span.days + 'd',
        [
          k.downloadButton('full-and-final-settlement.pdf', () => new Blob([settlementPdf(s, pdfOpts)], { type: 'application/pdf' })),
          k.downloadButton('settlement.xlsx', () => S.writeXlsx(sheets), false)
        ]));

      result.appendChild(k.statGrid([
        ['Service', s.span.years + ' years, ' + s.span.months + ' months, ' + s.span.days + ' days'],
        ['Final month salary', k.inr(s.finalSalary) + ' for ' + s.worked + ' of ' + s.dim + ' days'],
        ['Leave encashment', k.inr(s.leaveEncashment) + ' — ' + s.leaveDays + ' days at ' + k.inr(s.leaveRate) + '/day'],
        ['Gratuity', s.eligible ? k.inr(s.gratuityPaid) + ' — ' + s.gratuityYears + ' year' + (s.gratuityYears === 1 ? '' : 's') + ' counted' : 'not payable (under ' + GRATUITY.qualifyingYears + ' years)'],
        ['Gratuity exempt / taxable', k.inr(s.gratuityExempt) + ' / ' + k.inr(s.gratuityTaxable)],
        ['Notice', s.shortfall + ' days short' + (s.noticeRecovery ? ' — recovered ' + k.inr(s.noticeRecovery) : s.noticePayInLieu ? ' — paid in lieu ' + k.inr(s.noticePayInLieu) : ' — waived')],
        ['Total payable', k.inr(s.totalEarnings)],
        ['Total deductions', k.inr(s.totalDeductions)],
        ['Net payable', k.inr(s.net)],
        ['In words', s.words]
      ]));
      if (s.net < 0) result.appendChild(k.issues(['The deductions exceed what is owed, so this is a recovery from the employee of ' + k.inr(-s.net) + ', not a payment. Check the notice shortfall, the advance and the loan before you send it.'], 'warning'));
      if (s.gratuityCapped) result.appendChild(k.issues(['The gratuity formula gives ' + k.inr(s.gratuityFormula) + ', above the statutory cap of ' + k.inr(GRATUITY.cap) + '. The capped figure is used.'], 'note'));

      result.appendChild(k.h3('Settlement statement'));
      result.appendChild(k.previewTable(sheets[0].rows, 40));
      result.appendChild(k.h3('How every figure was reached'));
      result.appendChild(k.previewTable(sheets[1].rows, 40));
      result.appendChild(k.h3('Payment deadline'));
      const note = k.el('p', 'field-hint', DEADLINE_NOTE);
      result.appendChild(note);

      msg.say('');
      result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="full-final-settlement"]'); if (r) mount(r); });
  window.MVRFullFinal = { GRATUITY, PT_STATES, professionalTax, serviceSpan, settle, statementRows, basisRows, settlementPdf, rupeesInWords, DEADLINE_NOTE };
})();
