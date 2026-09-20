/**
 * CTC, taken apart.
 *
 * An offer says "18 lakh CTC" and nobody can tell you what lands in the
 * bank. This builds the whole structure from the policy an employer
 * actually uses — Basic as a share of CTC, HRA as a share of Basic, PF on
 * Basic or on Basic+DA capped at Rs 15,000, gratuity accrued at 4.81%,
 * employer PF and ESI in or out of CTC — then computes the statutory
 * deductions and the income tax under both regimes, and says which one is
 * cheaper and by how much. Reverse it and it solves for the CTC that
 * produces the take-home you want. All arithmetic, on your device.
 */
(function () {
  'use strict';
  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['ctc-structure'] = {
    title: 'CTC to Take-Home Salary Calculator (India)',
    short: 'CTC Breakup',
    description: 'Turn an annual CTC into the full salary structure and the monthly in-hand: Basic, HRA, allowances, employer PF, gratuity, ESI, professional tax by state, and income tax under both the new and the old regime side by side — with a reverse mode that finds the CTC for the take-home you want. Runs in your browser; nothing is uploaded.',
    keywords: ['ctc to take home salary calculator', 'in hand salary calculator india', 'salary breakup calculator', 'ctc breakup basic hra', 'new vs old tax regime calculator', 'take home salary after pf and tax', 'salary structure calculator india', 'reverse ctc calculator'],
    glyph: 'i-ctc-split',
    glyphSvg: '<symbol id="i-ctc-split" viewBox="0 0 24 24">\n  <path d="M4 4.5h7a4 4 0 0 1 0 8H4z"/>\n  <path d="M4 12.5l7 7" class="thin"/>\n  <path d="M15 5.5h5M15 9.5h5M15 13.5h5M15 17.5h5" class="thin"/>\n  <circle cx="12.6" cy="5.5" r=".9"/>\n  <circle cx="12.6" cy="17.5" r=".9"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/biz-ctc-structure.js'],
    tips: [
      'Basic is usually 40–50% of CTC. Push it lower and the take-home rises today (less PF) while gratuity, PF and HRA exemption all shrink; push it higher and the reverse happens. Change the Basic % and watch every figure move.',
      'The tax slabs, the standard deduction, the 87A rebate and the professional tax tables are written in one clearly-marked constant at the top of this file, labelled with the financial year and the date they were last checked. Rates change with every Budget and some state PT tables change in between — check them against the current Finance Act before you rely on a rupee figure.',
      'Professional tax is a state tax and the slabs here are the common ones. Maharashtra exempts women below a higher wage, Tamil Nadu charges half-yearly through the local body, and several states (Delhi, Haryana, Uttar Pradesh, Rajasthan) do not levy it at all — pick "No professional tax" for those.',
      'ESI only applies while monthly gross wages are Rs 21,000 or less, and once an employee crosses that inside a contribution period they stay in until the period ends. This shows the steady state, not that run-out.',
      'Reverse mode solves by trying CTCs and narrowing — it does not invert the formula — so it respects every rule above, including the slab you happen to land in and the 87A rebate cliff. It reports the CTC to the nearest rupee that produces your target take-home.',
      'The in-hand figure excludes the annual bonus or variable pay, because that is not paid monthly. It is included in the taxable income, so the TDS spread over twelve months already carries it.'
    ],
    faq: [
      { q: 'Which financial year are these slabs for?', a: 'The tax constant is labelled FY 2026-27 (AY 2027-28) and carries the date it was last checked. It uses the new-regime slabs and the Rs 75,000 standard deduction and Rs 60,000 rebate introduced by the Finance Act 2025, and the long-standing old-regime slabs with a Rs 50,000 standard deduction. If a later Budget changed anything, this will be wrong until the constant is updated — so verify against the current Finance Act. The figures here are an estimate for planning, not a tax computation.' },
      { q: 'Why is my in-hand lower than a simple CTC divided by twelve?', a: 'Because CTC is the employer’s cost, not your pay. Gratuity accrual, the employer’s PF and ESI, and any bonus never reach your monthly bank credit. Then your own PF, ESI, professional tax and TDS come out of what is left. The breakup shows every rupee of the gap.' },
      { q: 'Does it handle the old regime properly?', a: 'It computes the HRA exemption as the least of actual HRA, rent paid less 10% of Basic+DA, and 50% (metro) or 40% (non-metro) of Basic+DA; deducts the Rs 50,000 standard deduction, professional tax paid, 80C (capped at Rs 1,50,000, optionally counting your own PF), 80D and anything else you enter; then applies the slabs for your age band, the Rs 12,500 rebate below Rs 5,00,000, surcharge with marginal relief and 4% cess.' },
      { q: 'Is any of this sent anywhere?', a: 'No. Every figure is computed in your browser and the spreadsheet is written there too. Salary is the most sensitive number most people have; it never leaves the device.' },
      { q: 'Can I use this to negotiate an offer?', a: 'That is what it is for. Run the offered CTC, then run reverse mode with the take-home you need and see what CTC that asks for. The annexure table is laid out the way an offer letter annexure is, so you can compare it line by line with what HR sends.' }
    ]
  };
  if (typeof document === 'undefined') return;
  const K = () => window.MVRBizKit;

  /* ============================================================
   * TAX AND STATUTORY CONSTANTS — CHECK THESE AGAINST THE BUDGET
   * ------------------------------------------------------------
   * Financial year : 2026-27  (assessment year 2027-28)
   * Last reviewed  : 2026-09-20 — but NOT verified against a Budget
   *                  notification. These are the Finance Act 2025 figures
   *                  carried forward on the assumption nothing moved.
   *
   * New regime (section 115BAC) slabs, the Rs 75,000 standard deduction
   * and the Rs 60,000 / Rs 12,00,000 rebate are those introduced by the
   * Finance Act 2025 and carried forward. Old regime slabs, the Rs 50,000
   * standard deduction and the Rs 12,500 / Rs 5,00,000 rebate are the
   * long-standing ones. Surcharge thresholds and the 4% health and
   * education cess are unchanged. If a later Budget moved any of these,
   * EDIT THIS BLOCK — nothing else in the file hard-codes a rate.
   * ============================================================ */
  const TAX = {
    fy: 'FY 2026-27 (AY 2027-28)',
    checked: '2026-09-20',
    basis: 'Finance Act 2025 rates applied to FY 2026-27 — check them against the current Budget',
    cess: 0.04,
    newRegime: {
      /* [upper limit of the band, rate on the part of income inside it] */
      slabs: [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]],
      standardDeduction: 75000,
      rebateUpTo: 1200000, rebateMax: 60000, rebateMarginalRelief: true,
      /* [income up to, surcharge rate]; the new regime is capped at 25% */
      surcharge: [[5000000, 0], [10000000, 0.10], [20000000, 0.15], [Infinity, 0.25]],
      allowsProfessionalTax: false, allowsHraExemption: false, allowsChapterVIA: false
    },
    oldRegime: {
      slabsByAge: {
        below60: [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]],
        senior: [[300000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]],      /* 60 to under 80 */
        superSenior: [[500000, 0], [1000000, 0.20], [Infinity, 0.30]]                   /* 80 and over   */
      },
      standardDeduction: 50000,
      rebateUpTo: 500000, rebateMax: 12500, rebateMarginalRelief: false,
      surcharge: [[5000000, 0], [10000000, 0.10], [20000000, 0.15], [50000000, 0.25], [Infinity, 0.37]],
      section80cCap: 150000,
      allowsProfessionalTax: true, allowsHraExemption: true, allowsChapterVIA: true
    }
  };

  /* Provident fund and ESI, as the schemes stand on the date above. */
  const PF = {
    wageCeiling: 15000,       /* Rs/month, the statutory PF wage ceiling      */
    employeeRate: 0.12,
    employerRate: 0.12,
    epsRate: 0.0833,          /* of PF wage capped at the ceiling             */
    edliRate: 0.005,          /* of PF wage capped at the ceiling             */
    adminRate: 0.005          /* of PF wage; a Rs 500/month floor per establishment, not per employee */
  };
  const ESI = {
    wageLimit: 21000,         /* Rs/month gross; Rs 25,000 for an employee with a disability */
    employeeRate: 0.0075,
    employerRate: 0.0325
  };
  const GRATUITY_ACCRUAL = 0.0481;   /* 15/26/12 of Basic, the usual CTC accrual */

  /* Professional tax. Entries are [gross up to and including, per month, per year].
     Maharashtra's yearly figure carries the Rs 300 February deduction; Tamil Nadu
     is levied on half-yearly wages by the local body, so its bands are half-yearly
     and the monthly figure is one sixth. Karnataka charges from Rs 25,000, which is
     why its nil band stops a paisa short. */
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

  /** Professional tax on a monthly gross: { monthly, annual }. */
  function professionalTax(monthlyGross, code) {
    const st = ptState(code);
    const basisAmount = st.basis === 'halfyear' ? monthlyGross * 6 : monthlyGross;
    for (const [upTo, perMonth, perYear] of st.bands) {
      if (basisAmount <= upTo) {
        return st.basis === 'halfyear'
          ? { monthly: perMonth / 6, annual: perYear, state: st.label }
          : { monthly: perMonth, annual: perYear, state: st.label };
      }
    }
    return { monthly: 0, annual: 0, state: st.label };
  }

  /* ---------- income tax ---------- */

  /** Slab tax on a taxable income, before rebate, surcharge and cess. */
  function slabTax(income, slabs) {
    let tax = 0, previous = 0;
    for (const [upTo, rate] of slabs) {
      if (income <= previous) break;
      tax += (Math.min(income, upTo) - previous) * rate;
      previous = upTo;
    }
    return tax;
  }
  const surchargeRate = (income, table) => { for (const [upTo, rate] of table) if (income <= upTo) return rate; return table[table.length - 1][1]; };

  /** Tax plus surcharge, with marginal relief at every surcharge threshold. */
  function taxPlusSurcharge(income, slabs, surcharge) {
    const base = slabTax(income, slabs);
    let total = base * (1 + surchargeRate(income, surcharge));
    for (const [threshold] of surcharge) {
      if (!isFinite(threshold) || income <= threshold) continue;
      const atThreshold = slabTax(threshold, slabs) * (1 + surchargeRate(threshold, surcharge));
      const capped = atThreshold + (income - threshold);
      if (total > capped) total = capped;
    }
    return total;
  }

  /**
   * Income tax on a taxable income under one regime.
   * Returns every step, so the page can show the working.
   */
  function incomeTax(taxableIncome, regime, ageBand) {
    const cfg = regime === 'new' ? TAX.newRegime : TAX.oldRegime;
    const slabs = regime === 'new' ? cfg.slabs : cfg.slabsByAge[ageBand || 'below60'];
    const ti = Math.max(0, taxableIncome);
    const beforeRebate = slabTax(ti, slabs);
    let afterRebate = beforeRebate;
    let rebate = 0;
    if (ti <= cfg.rebateUpTo) { rebate = Math.min(beforeRebate, cfg.rebateMax); afterRebate = beforeRebate - rebate; }
    else if (cfg.rebateMarginalRelief) {
      /* just above the rebate limit, tax cannot exceed the income above it */
      const excess = ti - cfg.rebateUpTo;
      if (afterRebate > excess) { rebate = afterRebate - excess; afterRebate = excess; }
    }
    /* surcharge and its own marginal relief work on the full slab tax */
    const withSurcharge = taxPlusSurcharge(ti, slabs, cfg.surcharge);
    const surcharge = Math.max(0, withSurcharge - beforeRebate);
    const beforeCess = Math.max(0, afterRebate + surcharge);
    const cess = beforeCess * TAX.cess;
    return {
      regime, taxableIncome: ti, slabTax: beforeRebate, rebate,
      surcharge, surchargeRate: surchargeRate(ti, cfg.surcharge),
      cess, total: Math.round(beforeCess + cess)
    };
  }

  /* ---------- the structure ---------- */

  const r2 = (n) => Math.round(n * 100) / 100;

  /**
   * Everything, from a policy. Pure arithmetic: same inputs, same numbers,
   * which is what lets the Python check reproduce it from scratch.
   *
   * o = { ctcAnnual, basicPct, daPctOfBasic, hraPctOfBasic, metro,
   *       pfOn: 'basic'|'capped', employerPfInCtc, edliAdminInCtc,
   *       employerEsiInCtc, gratuityInCtc, bonusAnnual, allowances:[{label,annual}],
   *       state, rentMonthly, deduction80c, pfIn80c, deduction80d, deductionOther, ageBand }
   */
  function buildStructure(o) {
    const ctc = Number(o.ctcAnnual) || 0;
    if (ctc <= 0) throw new Error('Enter a CTC greater than zero.');
    const basic = ctc * (Number(o.basicPct) || 0) / 100;
    const da = basic * (Number(o.daPctOfBasic) || 0) / 100;
    const hra = basic * (Number(o.hraPctOfBasic) || 0) / 100;
    const bonus = Math.max(0, Number(o.bonusAnnual) || 0);
    const allowances = (o.allowances || []).map(a => ({ label: a.label, annual: Math.max(0, Number(a.annual) || 0) }));
    const allowanceTotal = allowances.reduce((s, a) => s + a.annual, 0);

    const pfWageMonthly = o.pfOn === 'capped'
      ? Math.min((basic + da) / 12, PF.wageCeiling)
      : (basic + da) / 12;
    const employeePfAnnual = pfWageMonthly * PF.employeeRate * 12;
    const employerPfAnnual = pfWageMonthly * PF.employerRate * 12;
    const epsAnnual = Math.min(pfWageMonthly, PF.wageCeiling) * PF.epsRate * 12;
    const epfEmployerAnnual = employerPfAnnual - epsAnnual;
    const edliAnnual = Math.min(pfWageMonthly, PF.wageCeiling) * PF.edliRate * 12;
    const adminAnnual = pfWageMonthly * PF.adminRate * 12;

    const gratuity = o.gratuityInCtc ? basic * GRATUITY_ACCRUAL : 0;
    const employerPfInCtc = o.employerPfInCtc ? employerPfAnnual : 0;
    const edliAdminInCtc = (o.employerPfInCtc && o.edliAdminInCtc) ? (edliAnnual + adminAnnual) : 0;

    /* Employer ESI is 3.25% of gross, and gross is what is left of CTC after
       employer ESI — one equation, solved directly rather than by guessing. */
    const remainder = ctc - gratuity - employerPfInCtc - edliAdminInCtc - bonus;
    if (remainder <= 0) throw new Error('The retirals and bonus you have chosen use up the whole CTC. Lower the bonus, the Basic %, or take the employer PF out of CTC.');
    let grossAnnual = remainder, employerEsiAnnual = 0;
    if (o.employerEsiInCtc) {
      const withEsi = remainder / (1 + ESI.employerRate);
      if (withEsi / 12 <= ESI.wageLimit) { grossAnnual = withEsi; employerEsiAnnual = withEsi * ESI.employerRate; }
    }
    const special = grossAnnual - basic - da - hra - allowanceTotal;
    if (special < -0.005) {
      throw new Error('Basic, DA, HRA and the fixed allowances come to ' + Math.round(basic + da + hra + allowanceTotal).toLocaleString('en-IN') +
        ' a year, which is more than the ' + Math.round(grossAnnual).toLocaleString('en-IN') + ' of gross this CTC leaves. Cut the allowances by ' +
        Math.round(-special).toLocaleString('en-IN') + ' or lower the Basic %.');
    }

    const monthlyGross = grossAnnual / 12;
    const esiEligible = monthlyGross <= ESI.wageLimit;
    const employeeEsiAnnual = esiEligible ? grossAnnual * ESI.employeeRate : 0;
    const employerEsiOutsideCtc = (esiEligible && !employerEsiAnnual) ? grossAnnual * ESI.employerRate : 0;
    const pt = professionalTax(monthlyGross, o.state);

    /* ---- tax, both ways ---- */
    const grossForTax = grossAnnual + bonus;
    const newTaxable = Math.max(0, grossForTax - TAX.newRegime.standardDeduction);
    const newTax = incomeTax(newTaxable, 'new', o.ageBand);

    const rentAnnual = Math.max(0, Number(o.rentMonthly) || 0) * 12;
    const hraExemption = rentAnnual > 0 && hra > 0
      ? Math.max(0, Math.min(hra, rentAnnual - 0.10 * (basic + da), (o.metro ? 0.50 : 0.40) * (basic + da)))
      : 0;
    const eightyC = Math.min(TAX.oldRegime.section80cCap,
      Math.max(0, Number(o.deduction80c) || 0) + (o.pfIn80c ? employeePfAnnual : 0));
    const eightyD = Math.max(0, Number(o.deduction80d) || 0);
    const otherDed = Math.max(0, Number(o.deductionOther) || 0);
    const oldTaxable = Math.max(0, grossForTax - hraExemption - TAX.oldRegime.standardDeduction - pt.annual - eightyC - eightyD - otherDed);
    const oldTax = incomeTax(oldTaxable, 'old', o.ageBand);

    const cheaper = newTax.total <= oldTax.total ? 'new' : 'old';
    const saving = Math.abs(newTax.total - oldTax.total);

    const takeHome = (tax) => {
      const monthlyTds = tax / 12;
      const monthlyNet = monthlyGross - employeePfAnnual / 12 - employeeEsiAnnual / 12 - pt.monthly - monthlyTds;
      return { monthlyTds: r2(monthlyTds), monthlyNet: r2(monthlyNet), annualNet: r2(monthlyNet * 12) };
    };

    return {
      inputs: o,
      fy: TAX.fy, checked: TAX.checked, basis: TAX.basis,
      ctc, basic, da, hra, allowances, allowanceTotal, special, bonus,
      grossAnnual, monthlyGross,
      pfWageMonthly, employeePfAnnual, employerPfAnnual, epsAnnual, epfEmployerAnnual, edliAnnual, adminAnnual,
      employerPfInCtc, edliAdminInCtc, gratuity,
      esiEligible, employeeEsiAnnual, employerEsiAnnual, employerEsiOutsideCtc,
      pt,
      tax: { grossForTax, newTaxable, oldTaxable, hraExemption, eightyC, eightyD, otherDed, newTax, oldTax, cheaper, saving },
      net: { new: takeHome(newTax.total), old: takeHome(oldTax.total) },
      employerCost: ctc + employerEsiOutsideCtc + (o.employerPfInCtc ? 0 : employerPfAnnual)
    };
  }

  /**
   * Reverse: the CTC that yields a target monthly take-home, by bisection.
   * No algebra — the rebate cliff and the slab edges make the function
   * non-linear, so it is searched, not inverted.
   */
  function solveForTakeHome(target, regime, policy) {
    const netAt = (ctc) => {
      const s = buildStructure(Object.assign({}, policy, { ctcAnnual: ctc }));
      return s.net[regime].monthlyNet;
    };
    let low = Math.max(1200, target * 12), high = Math.max(low * 2, target * 12 * 5);
    let guard = 0;
    while (netAt(high) < target && guard++ < 40) { low = high; high *= 1.8; }
    if (netAt(high) < target) throw new Error('Could not reach that take-home. Check the policy — the retirals may be eating everything.');
    for (let i = 0; i < 90; i++) {
      const mid = (low + high) / 2;
      if (netAt(mid) < target) low = mid; else high = mid;
    }
    const ctc = Math.round(high);
    return { ctc, structure: buildStructure(Object.assign({}, policy, { ctcAnnual: ctc })) };
  }

  /* ---------- rows for the page and the workbook ---------- */

  const m12 = (annual) => r2(annual / 12);

  function annualRows(s) {
    const rows = [['Component', 'Annual (Rs)', 'Monthly (Rs)', 'Basis']];
    rows.push(['Basic', r2(s.basic), m12(s.basic), (s.inputs.basicPct || 0) + '% of CTC']);
    if (s.da > 0) rows.push(['Dearness allowance', r2(s.da), m12(s.da), (s.inputs.daPctOfBasic || 0) + '% of Basic']);
    rows.push(['House rent allowance', r2(s.hra), m12(s.hra), (s.inputs.hraPctOfBasic || 0) + '% of Basic']);
    s.allowances.forEach(a => rows.push([a.label, r2(a.annual), m12(a.annual), 'fixed allowance']));
    rows.push(['Special allowance', r2(s.special), m12(s.special), 'balancing figure']);
    rows.push(['Gross salary (A)', r2(s.grossAnnual), m12(s.grossAnnual), 'sum of the above']);
    if (s.employerPfInCtc) rows.push(['Employer provident fund', r2(s.employerPfInCtc), m12(s.employerPfInCtc), '12% of PF wage ' + Math.round(s.pfWageMonthly).toLocaleString('en-IN') + '/month']);
    if (s.edliAdminInCtc) rows.push(['EDLI and PF admin charges', r2(s.edliAdminInCtc), m12(s.edliAdminInCtc), '0.5% + 0.5% of PF wage']);
    if (s.employerEsiAnnual) rows.push(['Employer ESI', r2(s.employerEsiAnnual), m12(s.employerEsiAnnual), '3.25% of gross']);
    if (s.gratuity) rows.push(['Gratuity accrual', r2(s.gratuity), m12(s.gratuity), '4.81% of Basic']);
    if (s.bonus) rows.push(['Bonus / variable pay', r2(s.bonus), m12(s.bonus), 'paid annually, not monthly']);
    rows.push(['Cost to company (B)', r2(s.ctc), m12(s.ctc), 'A plus the retirals above']);
    return rows;
  }

  function monthlyRows(s, regime) {
    const n = s.net[regime];
    const rows = [['Line', 'Monthly (Rs)']];
    rows.push(['Basic', m12(s.basic)]);
    if (s.da > 0) rows.push(['Dearness allowance', m12(s.da)]);
    rows.push(['House rent allowance', m12(s.hra)]);
    s.allowances.forEach(a => rows.push([a.label, m12(a.annual)]));
    rows.push(['Special allowance', m12(s.special)]);
    rows.push(['Gross earnings', m12(s.grossAnnual)]);
    rows.push(['Less: provident fund (employee 12%)', m12(s.employeePfAnnual)]);
    if (s.employeeEsiAnnual) rows.push(['Less: ESI (employee 0.75%)', m12(s.employeeEsiAnnual)]);
    rows.push(['Less: professional tax (' + s.pt.state + ')', r2(s.pt.monthly)]);
    rows.push(['Less: income tax (TDS, ' + regime + ' regime)', n.monthlyTds]);
    rows.push(['Net take-home', n.monthlyNet]);
    return rows;
  }

  function taxRows(s) {
    const t = s.tax;
    return [
      ['Line', 'New regime (Rs)', 'Old regime (Rs)'],
      ['Gross salary including bonus', r2(t.grossForTax), r2(t.grossForTax)],
      ['Less: HRA exemption', 0, r2(t.hraExemption)],
      ['Less: standard deduction', TAX.newRegime.standardDeduction, TAX.oldRegime.standardDeduction],
      ['Less: professional tax', 0, r2(s.pt.annual)],
      ['Less: 80C', 0, r2(t.eightyC)],
      ['Less: 80D', 0, r2(t.eightyD)],
      ['Less: other Chapter VI-A', 0, r2(t.otherDed)],
      ['Taxable income', r2(t.newTaxable), r2(t.oldTaxable)],
      ['Tax on slabs', r2(t.newTax.slabTax), r2(t.oldTax.slabTax)],
      ['Less: rebate u/s 87A', r2(t.newTax.rebate), r2(t.oldTax.rebate)],
      ['Surcharge', r2(t.newTax.surcharge), r2(t.oldTax.surcharge)],
      ['Health and education cess (4%)', r2(t.newTax.cess), r2(t.oldTax.cess)],
      ['Total tax for the year', t.newTax.total, t.oldTax.total],
      ['Monthly TDS', s.net.new.monthlyTds, s.net.old.monthlyTds],
      ['Monthly take-home', s.net.new.monthlyNet, s.net.old.monthlyNet],
      ['Cheaper regime', t.cheaper === 'new' ? 'NEW, by Rs ' + Math.round(t.saving).toLocaleString('en-IN') : '', t.cheaper === 'old' ? 'OLD, by Rs ' + Math.round(t.saving).toLocaleString('en-IN') : '']
    ];
  }

  /** The table an offer letter annexure prints. */
  function annexureRows(s) {
    const rows = [['Salary annexure — ' + s.fy, 'Per month (Rs)', 'Per annum (Rs)']];
    const add = (label, annual) => rows.push([label, m12(annual), r2(annual)]);
    rows.push(['A. FIXED PAY', '', '']);
    add('Basic salary', s.basic);
    if (s.da > 0) add('Dearness allowance', s.da);
    add('House rent allowance', s.hra);
    s.allowances.forEach(a => add(a.label, a.annual));
    add('Special allowance', s.special);
    rows.push(['Total fixed pay (gross)', m12(s.grossAnnual), r2(s.grossAnnual)]);
    rows.push(['B. RETIRALS AND BENEFITS', '', '']);
    if (s.employerPfInCtc) add('Employer contribution to provident fund', s.employerPfInCtc);
    if (s.edliAdminInCtc) add('EDLI and PF administration charges', s.edliAdminInCtc);
    if (s.employerEsiAnnual) add('Employer contribution to ESI', s.employerEsiAnnual);
    if (s.gratuity) add('Gratuity (accrued at 4.81% of Basic)', s.gratuity);
    rows.push(['C. VARIABLE PAY', '', '']);
    add('Annual bonus / performance pay', s.bonus);
    rows.push(['TOTAL COST TO COMPANY', m12(s.ctc), r2(s.ctc)]);
    rows.push(['D. INDICATIVE DEDUCTIONS (' + s.tax.cheaper.toUpperCase() + ' REGIME)', '', '']);
    add('Provident fund — employee contribution', s.employeePfAnnual);
    if (s.employeeEsiAnnual) add('ESI — employee contribution', s.employeeEsiAnnual);
    add('Professional tax (' + s.pt.state + ')', s.pt.annual);
    add('Income tax (TDS)', s.tax[s.tax.cheaper === 'new' ? 'newTax' : 'oldTax'].total);
    rows.push(['INDICATIVE NET TAKE-HOME', s.net[s.tax.cheaper].monthlyNet, s.net[s.tax.cheaper].annualNet]);
    return rows;
  }

  /* ---------- UI ---------- */

  const ALLOWANCE_DEFAULT = 'Conveyance allowance 19200\nLeave travel allowance 24000\nTelephone and internet 12000';

  /** "Conveyance allowance 19200" -> { label, annual }. */
  function parseAllowances(text) {
    const out = [], bad = [];
    for (const raw of String(text || '').split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const m = /^(.*?)[\s,;:=\t]+(?:rs\.?|inr)?\s*([\d,]*\d(?:\.\d+)?)\s*$/i.exec(line);
      if (!m || !m[1].trim()) { bad.push(line); continue; }
      out.push({ label: m[1].trim().replace(/[,;:=\s]+$/, ''), annual: Number(m[2].replace(/,/g, '')) });
    }
    return { rows: out, bad };
  }

  function mount(root) {
    const k = K(); const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const yesNo = (id, v) => k.select(id, [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], v);
    const on = (sel) => sel.value === 'yes';
    const msg = k.msgBox();

    /* mode */
    const modeBar = k.el('div', 'opt-bar');
    const mode = k.select('ctc-mode', [{ value: 'forward', label: 'CTC → take-home' }, { value: 'reverse', label: 'Take-home → CTC' }], 'forward');
    const ctcAmount = k.textInput('ctc-amount', '1800000', '', 'number');
    const ctcPeriod = k.select('ctc-period', [{ value: 'annual', label: 'per year' }, { value: 'monthly', label: 'per month' }], 'annual');
    const target = k.textInput('ctc-target', '100000', '', 'number');
    const targetRegime = k.select('ctc-target-regime', [{ value: 'new', label: 'New regime' }, { value: 'old', label: 'Old regime' }], 'new');
    modeBar.appendChild(k.field('What do you know?', mode));
    const ctcField = k.field('Cost to company', ctcAmount, 'The whole package the employer pays');
    const periodField = k.field('CTC is', ctcPeriod);
    const targetField = k.field('Take-home you want (per month)', target, 'Net credited to the bank');
    const targetRegimeField = k.field('Under which regime', targetRegime);
    modeBar.appendChild(ctcField); modeBar.appendChild(periodField);
    modeBar.appendChild(targetField); modeBar.appendChild(targetRegimeField);
    io.appendChild(modeBar);
    const syncMode = () => {
      const rev = mode.value === 'reverse';
      ctcField.hidden = rev; periodField.hidden = rev;
      targetField.hidden = !rev; targetRegimeField.hidden = !rev;
    };
    mode.addEventListener('change', syncMode); syncMode();

    /* structure policy */
    io.appendChild(k.h3('Structure policy'));
    const policyBar = k.el('div', 'opt-bar');
    const basicPct = k.textInput('ctc-basic', '40', '', 'number'); basicPct.min = 1; basicPct.max = 100; basicPct.step = '0.5';
    const daPct = k.textInput('ctc-da', '0', '', 'number'); daPct.min = 0; daPct.max = 200; daPct.step = '1';
    const hraPct = k.textInput('ctc-hra', '50', '', 'number'); hraPct.min = 0; hraPct.max = 100; hraPct.step = '1';
    const metro = k.select('ctc-metro', [{ value: 'yes', label: 'Metro (Delhi, Mumbai, Kolkata, Chennai)' }, { value: 'no', label: 'Non-metro' }], 'yes');
    policyBar.appendChild(k.field('Basic (% of CTC)', basicPct, 'Commonly 40–50%'));
    policyBar.appendChild(k.field('DA (% of Basic)', daPct, 'Usually 0 in private pay'));
    policyBar.appendChild(k.field('HRA (% of Basic)', hraPct, '50% metro, 40% non-metro'));
    policyBar.appendChild(k.field('City', metro));
    io.appendChild(policyBar);

    const retBar = k.el('div', 'opt-bar');
    const pfOn = k.select('ctc-pf-on', [{ value: 'capped', label: 'Basic + DA, capped at Rs 15,000/month' }, { value: 'basic', label: 'Full Basic + DA, no cap' }], 'capped');
    const empPf = yesNo('ctc-emp-pf', 'yes');
    const edliAdmin = yesNo('ctc-edli', 'no');
    const empEsi = yesNo('ctc-emp-esi', 'yes');
    const grat = yesNo('ctc-gratuity', 'yes');
    retBar.appendChild(k.field('PF is calculated on', pfOn));
    retBar.appendChild(k.field('Employer PF inside CTC', empPf));
    retBar.appendChild(k.field('EDLI + admin (1%) inside CTC', edliAdmin));
    retBar.appendChild(k.field('Employer ESI inside CTC', empEsi, 'Only if gross ≤ Rs 21,000/month'));
    retBar.appendChild(k.field('Gratuity accrual inside CTC', grat, '4.81% of Basic'));
    io.appendChild(retBar);

    const bonusBar = k.el('div', 'opt-bar');
    const bonus = k.textInput('ctc-bonus', '0', '', 'number'); bonus.min = 0;
    const state = k.select('ctc-state', PT_STATES.map(s => ({ value: s.code, label: s.label })), 'KA');
    bonusBar.appendChild(k.field('Bonus / variable pay (per year)', bonus, 'Part of CTC, paid once'));
    bonusBar.appendChild(k.field('State (professional tax)', state));
    io.appendChild(bonusBar);

    const allow = k.textarea('ctc-allowances', ALLOWANCE_DEFAULT, 'One per line: a label, then the yearly amount', 4);
    io.appendChild(k.field('Fixed allowances (per year)', allow, 'Conveyance, LTA, telephone, food coupons — special allowance balances the rest'));

    /* old-regime inputs */
    io.appendChild(k.h3('For the old regime'));
    const oldBar = k.el('div', 'opt-bar');
    const rent = k.textInput('ctc-rent', '25000', '', 'number'); rent.min = 0;
    const d80c = k.textInput('ctc-80c', '50000', '', 'number'); d80c.min = 0;
    const pfIn80c = yesNo('ctc-pf-80c', 'yes');
    const d80d = k.textInput('ctc-80d', '25000', '', 'number'); d80d.min = 0;
    const dOther = k.textInput('ctc-other', '0', '', 'number'); dOther.min = 0;
    const age = k.select('ctc-age', [{ value: 'below60', label: 'Under 60' }, { value: 'senior', label: '60 to 79' }, { value: 'superSenior', label: '80 and over' }], 'below60');
    oldBar.appendChild(k.field('Rent paid (per month)', rent, '0 if you do not rent'));
    oldBar.appendChild(k.field('80C investments (per year)', d80c, 'ELSS, PPF, insurance, tuition'));
    oldBar.appendChild(k.field('Count my PF in 80C', pfIn80c));
    oldBar.appendChild(k.field('80D health insurance', d80d));
    oldBar.appendChild(k.field('Other Chapter VI-A', dOther, '80CCD(1B), 80E, 80G'));
    oldBar.appendChild(k.field('Age band', age));
    io.appendChild(oldBar);

    const run = k.el('div', 'io-actions pdf-run');
    run.appendChild(k.button('Calculate', 'btn-primary', go));
    io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    function policy() {
      const a = parseAllowances(allow.value);
      if (a.bad.length) throw new Error('Could not read the allowance line "' + a.bad[0].slice(0, 40) + '". Each line is a label, then the yearly amount.');
      return {
        basicPct: k.toNumber(basicPct.value), daPctOfBasic: k.toNumber(daPct.value), hraPctOfBasic: k.toNumber(hraPct.value),
        metro: on(metro), pfOn: pfOn.value, employerPfInCtc: on(empPf), edliAdminInCtc: on(edliAdmin),
        employerEsiInCtc: on(empEsi), gratuityInCtc: on(grat),
        bonusAnnual: k.toNumber(bonus.value), allowances: a.rows, state: state.value,
        rentMonthly: k.toNumber(rent.value), deduction80c: k.toNumber(d80c.value), pfIn80c: on(pfIn80c),
        deduction80d: k.toNumber(d80d.value), deductionOther: k.toNumber(dOther.value), ageBand: age.value
      };
    }

    function go() {
      result.innerHTML = '';
      let s, headline;
      try {
        const p = policy();
        if (mode.value === 'reverse') {
          const want = k.toNumber(target.value);
          if (!(want > 0)) { msg.say('Enter the monthly take-home you want.', 'note'); return; }
          const solved = solveForTakeHome(want, targetRegime.value, p);
          s = solved.structure;
          headline = 'A CTC of ' + k.inr(solved.ctc) + ' a year gives about ' + k.inr(want) + ' a month in hand under the ' + targetRegime.value + ' regime';
        } else {
          const raw = k.toNumber(ctcAmount.value);
          const annual = ctcPeriod.value === 'monthly' ? raw * 12 : raw;
          if (!(annual > 0)) { msg.say('Enter the CTC.', 'note'); return; }
          s = buildStructure(Object.assign({}, p, { ctcAnnual: annual }));
          headline = 'Take-home ' + k.inr(s.net[s.tax.cheaper].monthlyNet) + ' a month on a CTC of ' + k.inr(s.ctc);
        }
      } catch (e) { msg.say(e.message, 'error'); return; }

      const S = k.S();
      const t = s.tax;
      const sheets = [
        { name: 'Annual structure', rows: annualRows(s) },
        { name: 'Monthly', rows: monthlyRows(s, t.cheaper) },
        { name: 'Tax comparison', rows: taxRows(s) },
        { name: 'Offer annexure', rows: annexureRows(s) }
      ];
      result.appendChild(k.summaryCard(headline,
        t.cheaper.toUpperCase() + ' regime is cheaper by ' + k.inr(t.saving) + ' a year · ' + s.basis,
        [k.downloadButton('salary-structure.xlsx', () => S.writeXlsx(sheets))]));

      result.appendChild(k.statGrid([
        ['Cost to company', k.inr(s.ctc) + ' a year'],
        ['Gross salary', k.inr(s.grossAnnual) + ' a year · ' + k.inr(s.monthlyGross) + ' a month'],
        ['Basic', k.inr(s.basic) + ' (' + (s.inputs.basicPct || 0) + '% of CTC)'],
        ['Take-home, new regime', k.inr(s.net.new.monthlyNet) + ' a month'],
        ['Take-home, old regime', k.inr(s.net.old.monthlyNet) + ' a month'],
        ['Income tax, new regime', k.inr(t.newTax.total) + ' a year'],
        ['Income tax, old regime', k.inr(t.oldTax.total) + ' a year'],
        ['Cheaper regime', t.cheaper.toUpperCase() + ', saving ' + k.inr(t.saving) + ' a year'],
        ['Employee PF', k.inr(s.employeePfAnnual) + ' a year on a PF wage of ' + k.inr(s.pfWageMonthly) + '/month'],
        ['ESI', s.esiEligible ? 'applies — employee ' + k.inr(s.employeeEsiAnnual) + ' a year' : 'does not apply (gross above Rs 21,000/month)'],
        ['Professional tax', k.inr(s.pt.annual) + ' a year · ' + s.pt.state],
        ['True employer cost', k.inr(s.employerCost) + ' a year']
      ]));

      result.appendChild(k.h3('Annual structure'));
      result.appendChild(k.previewTable(sheets[0].rows, 30));
      result.appendChild(k.h3('Monthly pay (' + t.cheaper + ' regime)'));
      result.appendChild(k.previewTable(sheets[1].rows, 30));
      result.appendChild(k.h3('Tax: new regime against old'));
      result.appendChild(k.previewTable(sheets[2].rows, 30));
      result.appendChild(k.h3('Offer letter annexure'));
      result.appendChild(k.previewTable(sheets[3].rows, 40));

      const tsv = sheets[3].rows.map(r => r.join('\t')).join('\n');
      const pre = k.el('pre', 'code-out', tsv);
      const copy = k.button('Copy the annexure', 'btn-ghost', async () => {
        try { await navigator.clipboard.writeText(tsv); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy the annexure'; }, 1600); }
        catch (e) { const r2 = document.createRange(); r2.selectNodeContents(pre); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r2); copy.textContent = 'Selected — press Ctrl+C'; }
      });
      const acts = k.el('div', 'io-actions'); acts.appendChild(copy);
      result.appendChild(acts); result.appendChild(pre);

      msg.say('');
      result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="ctc-structure"]'); if (r) mount(r); });
  window.MVRCtc = { TAX, PF, ESI, PT_STATES, GRATUITY_ACCRUAL, professionalTax, slabTax, incomeTax, buildStructure, solveForTakeHome, annualRows, monthlyRows, taxRows, annexureRows, parseAllowances };
})();
