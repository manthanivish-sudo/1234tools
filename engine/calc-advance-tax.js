(function(){
/* ---------- UK tax tables ----------
   England, Wales and Northern Ireland only — Scotland operates its own
   income tax bands and is handled separately in the tool.
   Checked 2026-10-04 against https://www.gov.uk/income-tax-rates and
   https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027
   (and ...-2025-to-2026): personal allowance £12,570, reduced by £1 for
   every £2 of adjusted net income over £100,000; on taxable income (after
   the allowance) basic 20% up to £37,700, higher 40% from £37,701 to
   £125,140, additional 45% above £125,140; NI primary threshold £12,570,
   upper earnings limit £50,270, 8% / 2%; employer 15% above £5,000;
   Employment Allowance £10,500. Same figures in both years. */
const UK_TAX = {
  '2026/27': {
    personalAllowance: 12570,
    taperStart: 100000,          // PA reduces £1 for every £2 above this
    bands: [                     // rate on taxable income (after PA) above `from`
      { from: 0,      rate: 0.20 },
      { from: 37700,  rate: 0.40 },
      { from: 125140, rate: 0.45 }  // the additional rate threshold is £125,140 of taxable income, not 112,570
    ],
    ni: { primary: 12570, upper: 50270, main: 0.08, upper_rate: 0.02 },
    employerNI: { secondary: 5000, rate: 0.15, employmentAllowance: 10500 }
  },
  '2025/26': {
    personalAllowance: 12570,
    taperStart: 100000,
    bands: [
      { from: 0,      rate: 0.20 },
      { from: 37700,  rate: 0.40 },
      { from: 125140, rate: 0.45 }
    ],
    ni: { primary: 12570, upper: 50270, main: 0.08, upper_rate: 0.02 },
    employerNI: { secondary: 5000, rate: 0.15, employmentAllowance: 10500 }
  }
};


/* currency formatter used inside schedule tables */
function fmtC(v) {
  if (!isFinite(v)) return '—';
  return v.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 });
}


/* ---------- Income tax, verified against the Income Tax Department position
   for AY 2027-28. Budget 2026 announced no change to slabs, so FY 2026-27
   carries forward the Budget 2025 reset. ---------- */
const IN_TAX = {
  '2026-27': {
    label: 'FY 2026-27 (AY 2027-28)',
    new: {
      slabs: [
        { upto: 400000,  rate: 0 },
        { upto: 800000,  rate: 0.05 },
        { upto: 1200000, rate: 0.10 },
        { upto: 1600000, rate: 0.15 },
        { upto: 2000000, rate: 0.20 },
        { upto: 2400000, rate: 0.25 },
        { upto: Infinity, rate: 0.30 }
      ],
      standardDeduction: 75000,
      rebateLimit: 1200000,
      rebateMax: 60000,
      surcharge: [[5000000, 0], [10000000, 0.10], [20000000, 0.15], [Infinity, 0.25]]
    },
    old: {
      slabs: [
        { upto: 250000,  rate: 0 },
        { upto: 500000,  rate: 0.05 },
        { upto: 1000000, rate: 0.20 },
        { upto: Infinity, rate: 0.30 }
      ],
      seniorExemption: 300000,
      superSeniorExemption: 500000,
      standardDeduction: 50000,
      rebateLimit: 500000,
      rebateMax: 12500,
      surcharge: [[5000000, 0], [10000000, 0.10], [20000000, 0.15], [50000000, 0.25], [Infinity, 0.37]]
    },
    cess: 0.04
  }
};
IN_TAX['2025-26'] = Object.assign({}, IN_TAX['2026-27'], { label: 'FY 2025-26 (AY 2026-27)' });

/* GST 2.0 — effective 22 September 2025. The 12% and 28% slabs were removed. */
const GST_SLABS = [
  { value: 0,    label: '0% — nil rated (essentials)' },
  { value: 0.25, label: '0.25% — rough diamonds' },
  { value: 3,    label: '3% — gold, silver, jewellery' },
  { value: 5,    label: '5% — everyday & essential goods' },
  { value: 18,   label: '18% — standard rate (most goods & services)' },
  { value: 40,   label: '40% — luxury & sin goods' }
];

const fmtR = (v) => isFinite(v)
  ? v.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
  : '—';

/* Progressive slab tax on an amount. */
function slabTax(amount, slabs) {
  let tax = 0, lower = 0;
  for (const s of slabs) {
    if (amount <= lower) break;
    tax += (Math.min(amount, s.upto) - lower) * s.rate;
    lower = s.upto;
  }
  return tax;
}

function surchargeRate(income, table) {
  for (const [upto, rate] of table) if (income <= upto) return rate;
  return table[table.length - 1][1];
}


function countWeekdays(a, b) {
  const MS = 86400000;
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  const days = Math.max(0, Math.round((end - start) / MS));

  const whole = Math.floor(days / 7);
  let count = whole * 5;

  let dow = new Date(start).getUTCDay();
  for (let i = 0; i < days % 7; i++) {
    if (dow !== 0 && dow !== 6) count++;
    dow = (dow + 1) % 7;
  }
  return count;
}


/* ---------- Interest on advance tax, Income-tax Act, 2025 ----------
   Read 2026-10-04 in the Act as published in the Gazette of India on
   21 August 2025 (https://egazette.gov.in/WriteReadData/2025/265620.pdf).
   The Finance Act, 2026 (https://egazette.gov.in/WriteReadData/2026/271439.pdf,
   ss.94 and 95) changes only the tax-credit clause of ss.424(2) and 425(5).
     s.404     advance tax is payable once the year's tax is 10,000 or more.
     s.408(1)  15%, 45%, 75% and 100% by 15 June, September, December, March.
     s.408(2)  presumptive income under s.58(2) Table Sl. 1 or 3 (formerly
               44AD and 44ADA): the whole amount by 15 March.
     s.425(1)  on the shortfall against those shares of the tax due on
               returned income: 3%, 3%, 3% and 1% (formerly 234C, 1% a month
               for three months, and for one).
     s.425(2)  none if 12% was paid by 15 June, or 36% by 15 September; read
               per instalment, as the proviso to 234C was.
     s.425(3)  presumptive: 1% of the shortfall at 15 March.
     s.424     paid under 90% of the assessed tax: 1% for every month or part
               of a month from the 1st April after the tax year, on the
               shortfall, up to the date it is paid (s.424(4)); formerly 234B.
   The sum interest is charged on is rounded down to a multiple of 100
   (rule 119A of the Income-tax Rules, 1962). Not modelled: s.425(4) relief
   for capital gains, dividends and the like that could not be foreseen. */
const AT_DATES = [
  { when: '15 June', pct: 0.15, months: 3, spare: 0.12 },
  { when: '15 September', pct: 0.45, months: 3, spare: 0.36 },
  { when: '15 December', pct: 0.75, months: 3, spare: null },
  { when: '15 March', pct: 1.00, months: 1, spare: null }
];
const AT_MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
/* the float dust in 150000 × 0.15 must not cost a whole 100 */
const down100 = (x) => Math.max(0, Math.floor((x + 1e-6) / 100) * 100);

window.TOOLS = window.TOOLS || {};
window.TOOLS["advance-tax"] = {
"currencyLocked": true,
"currencyNote": "Indian income-tax rules",
"currency": "INR",
"title": "Advance Tax Calculator",
"category": "india",
"description": "Quarterly advance tax instalments, and the interest if you pay late or short, worked out for each due date: sections 425 and 424 of the Income-tax Act, 2025 (formerly 234C and 234B).",
"keywords": ["advance tax calculator","advance tax interest calculator","234B and 234C interest calculator","advance tax due dates","section 234C","section 234B","section 425","section 424","quarterly tax India"],
"formula": "15% by 15 Jun, 45% by 15 Sep, 75% by 15 Dec, 100% by 15 Mar\ns.425 (234C): 3%, 3%, 3% and 1% of each shortfall, rounded down to ₹100\ns.424 (234B): 1% a month from 1 April on the unpaid balance, if under 90% was paid",
"inputs": [{"key":"taxLiability","label":"Estimated annual tax liability","type":"number","unit":"₹","default":200000,"min":0},{"key":"tdsPaid","label":"TDS / TCS already deducted","type":"number","unit":"₹","default":50000,"min":0},{"key":"paidSoFar","label":"Advance tax already paid","type":"number","unit":"₹","default":0,"min":0},
  {"key":"scheme","label":"How you pay","type":"select","default":"four","options":[{"value":"four","label":"Four instalments (most people)"},{"value":"presumptive","label":"Once, by 15 March (presumptive)"}]},
  {"key":"paidJun","label":"For interest: advance tax paid by 15 June (blank = none)","type":"number","unit":"₹","default":null,"min":0},
  {"key":"paidSep","label":"Total paid by 15 September, June included (blank = no more)","type":"number","unit":"₹","default":null,"min":0},
  {"key":"paidDec","label":"Total paid by 15 December, earlier dates included (blank = no more)","type":"number","unit":"₹","default":null,"min":0},
  {"key":"paidMar","label":"Total paid by 15 March, everything included (blank = no more)","type":"number","unit":"₹","default":null,"min":0},
  {"key":"balanceMonth","label":"Month you pay the rest as self-assessment tax","type":"select","default":"4","options":[{"value":"1","label":"April (1 month)"},{"value":"2","label":"May (2 months)"},{"value":"3","label":"June (3 months)"},{"value":"4","label":"July (4 months)"},{"value":"5","label":"August (5 months)"},{"value":"6","label":"September (6 months)"},{"value":"7","label":"October (7 months)"},{"value":"8","label":"November (8 months)"},{"value":"9","label":"December (9 months)"},{"value":"10","label":"January (10 months)"},{"value":"11","label":"February (11 months)"},{"value":"12","label":"March (12 months)"}]}],
"compute": ({ taxLiability, tdsPaid, paidSoFar, scheme, paidJun, paidSep, paidDec, paidMar, balanceMonth }) => {
      const net = Math.max(0, (Number(taxLiability) || 0) - (Number(tdsPaid) || 0));
      const liable = net >= 10000;
      const single = scheme === 'presumptive';

      /* Running totals by each date. A blank date carries the last total
         forward: nothing more was paid. A total cannot fall, so one that
         does is read as the earlier figure, and the note says so. */
      const given = [paidJun, paidSep, paidDec, paidMar].map((v) =>
        v === null || v === undefined || v === '' || !isFinite(Number(v)) ? null : Math.max(0, Number(v)));
      const anyGiven = given.some((v) => v !== null);
      let run = 0, fell = false;
      const paid = given.map((v) => {
        if (v !== null) { if (v < run) fell = true; run = Math.max(run, v); }
        return run;
      });

      /* s.425 (formerly 234C), one row per due date */
      const rows = [];
      let i425 = 0;
      const spared = [];
      AT_DATES.forEach((d, i) => {
        if (single && i < 3) return;
        const due = net * d.pct;
        const short = liable ? down100(due - paid[i]) : 0;
        const spare = !single && d.spare !== null && short > 0 && paid[i] >= net * d.spare - 1e-9;
        const interest = spare ? 0 : short * d.months / 100;
        if (spare) spared.push(d.when + ' (' + (d.spare * 100) + '% paid)');
        i425 += interest;
        rows.push([
          d.when + (single ? ' (100%, single instalment)' : ' (' + (d.pct * 100) + '%)'),
          fmtR(due), fmtR(paid[i]), fmtR(short), String(d.months),
          spare ? 'Nil, ' + (d.spare * 100) + '% paid' : fmtR(interest)
        ]);
      });

      /* s.424 (formerly 234B): under 90% paid by the year end */
      const months = Math.min(12, Math.max(1, parseInt(balanceMonth, 10) || 4));
      const under90 = liable && paid[3] < net * 0.9 - 1e-9;
      const short424 = under90 ? down100(net - paid[3]) : 0;
      const i424 = short424 * months / 100;
      rows.push([
        '1 April to ' + AT_MONTHS[months - 1] + ' (s.424)',
        fmtR(net), fmtR(paid[3]), fmtR(short424), String(months),
        !liable ? 'Nil' : under90 ? fmtR(i424) : 'Nil, 90% paid'
      ]);

      const note = [];
      if (!liable) {
        note.push('No interest under sections 424 and 425: advance tax applies only once net tax reaches ₹10,000 (s.404).');
      } else {
        if (!anyGiven) note.push('This is the interest if no advance tax is paid by any due date. Enter what you paid by each date to see your own figure.');
        if (fell) note.push('A total you entered is lower than the one before it. Enter running totals, each including the earlier payments.');
        if (spared.length) note.push('No interest for ' + spared.join(' or ') + ' (s.425(2)).');
        note.push(under90
          ? 'Section 424 interest runs from 1 April to ' + AT_MONTHS[months - 1] + ', the month you pay the rest.'
          : 'No section 424 interest: at least 90% was paid by 15 March.');
        note.push('Each shortfall is rounded down to a multiple of ₹100 before the interest is worked out.');
      }

      const already = Number(paidSoFar) || 0;
      return {
        netLiability: net,
        liable: liable
          ? 'Advance tax is payable — net liability is ₹10,000 or more'
          : 'No advance tax due — net liability is below ₹10,000',
        q1: single ? 0 : net * 0.15, q2: single ? 0 : net * 0.30, q3: single ? 0 : net * 0.30, q4: single ? net : net * 0.25,
        outstanding: Math.max(0, net - (anyGiven ? Math.max(already, paid[3]) : already)),
        interest425: i425,
        interest424: i424,
        interestTotal: i425 + i424,
        interestNote: note.join(' '),
        _table: { head: ['Due date', 'Due by then', 'Paid by then', 'Shortfall', 'Months at 1%', 'Interest'], rows }
      };
    },
"outputs": [{"key":"liable","label":"Liability","format":"text","primary":true},{"key":"netLiability","label":"Net tax payable","format":"currency"},{"key":"q1","label":"Instalment 1 (15 Jun)","format":"currency"},{"key":"q2","label":"Instalment 2 (15 Sep)","format":"currency"},{"key":"q3","label":"Instalment 3 (15 Dec)","format":"currency"},{"key":"q4","label":"Instalment 4 (15 Mar)","format":"currency"},{"key":"outstanding","label":"Still to pay","format":"currency"},{"key":"interest425","label":"Interest on late instalments, s.425 (formerly 234C)","format":"currency"},{"key":"interest424","label":"Interest for paying under 90%, s.424 (formerly 234B)","format":"currency"},{"key":"interestTotal","label":"Total interest","format":"currency"},{"key":"interestNote","label":"","format":"text"}],
"tips": ["Advance tax applies once net liability after TDS reaches ₹10,000 for the year (section 404 of the Income-tax Act, 2025, formerly 208). The four instalment dates are set by section 408 (formerly 211).","Section 425 of the Income-tax Act, 2025 (formerly 234C) charges 3% of the shortfall against 15%, 45% and 75% of the tax at 15 June, 15 September and 15 December, and 1% of the shortfall at 15 March. There is none for June if you paid at least 12% by then, and none for September if you paid at least 36%.","Section 424 (formerly 234B) applies if the advance tax paid by the end of the year is under 90% of the tax: 1% for every month or part of a month from 1 April on the unpaid balance, until you pay it. Payments made from 16 to 31 March count as advance tax for this test but miss the 15 March instalment; the tool counts only what you enter for 15 March, so it can overstate section 424 interest if you paid in that fortnight.","Each shortfall is rounded down to a multiple of ₹100 before interest is worked out, the procedure in rule 119A of the Income-tax Rules, 1962. The tool assumes your return shows the tax you enter and that you pay the whole balance in the month you choose. Interest for filing the return late, section 423 (formerly 234A), is not included.","No section 425 interest is charged on a shortfall caused by capital gains, dividends or newly started business income you could not foresee, if you pay the tax on it in the remaining instalments or by 31 March (s.425(4)). The tool does not apply that relief, so in that case it overstates the interest.","Resident senior citizens (60 or over) with no business or professional income are exempt from advance tax entirely: s.403(3), formerly 207(2).","Businesses and professionals declaring presumptive income under s.58 (formerly 44AD and 44ADA) pay the whole amount in a single instalment by 15 March, under s.408(2); choose that option and the only section 425 interest is 1% of any shortfall at 15 March (s.425(3)). Goods-carriage operators taxed under the same section (formerly 44AE) still pay in four instalments."],
"faq": [{"q":"How is advance tax interest calculated?","a":"As two charges, each on a shortfall rounded down to ₹100. Take ₹1,50,000 of net tax with ₹15,000 paid by 15 June, ₹50,000 by 15 September, ₹90,000 by 15 December and ₹1,20,000 by 15 March, and the rest paid in July. Section 425 (formerly 234C) charges 3% of the June, September and December shortfalls of ₹7,500, ₹17,500 and ₹22,500, and 1% of the ₹30,000 March shortfall: ₹1,725. Only 80% was paid by March, under the 90% line, so section 424 (formerly 234B) adds 1% a month on ₹30,000 from April to July: ₹1,200. The total is ₹2,925."},{"q":"Are sections 234B and 234C still charged?","a":"From tax year 2026-27 the same charges are sections 424 and 425 of the Income-tax Act, 2025, which replaced the 1961 Act on 1 April 2026. The due dates, the 3% and 1% rates, and the 12%, 36% and 90% tests are the same. FY 2025-26 and earlier years stay under 234B and 234C."},{"q":"What if my income is unpredictable?","a":"Estimate conservatively and revise at each instalment — the schedule is cumulative, so an increased estimate can be caught up at the next date. Capital gains, dividends and new business income you could not foresee are treated specially: no section 425 interest is charged on the shortfall they cause if the tax on them is paid in the remaining instalments or by 31 March."}]
};
})();