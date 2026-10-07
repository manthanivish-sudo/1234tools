/**
 * Claims on the India calculator pages (/india/): the lede, the card line
 * (build/jobs.js), "Why people use it" (build/promo/stories/india.js), the
 * Formula block, the tips and FAQ (the engine spec), the depth entry
 * (build/content/india.js) and the form itself, each run on the page's own
 * engine in Node.
 *
 * Statutory pages: every rate, threshold, limit and section number the page
 * quotes is checked against the engine's constant, and the engine is run
 * either side of each boundary so the constant is seen to be applied. The
 * Example panel (examples.js) and the figures listed in each depth entry's
 * check/checks (build/content/_check.js) are checked elsewhere; here it is
 * the behaviour the words promise.
 */
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node';
  const S = (u) => K.calcSpec(u);
  /* Since wave 5 the schedules hold numbers and the page formats them with
     the reader's currency preferences. These pages' claims read the cells
     as the engines used to print them (₹, en-IN grouping, whole rupees), so
     the numbers are printed that way here; the figures are the same. */
  const PRINTED = new Set(['/india/advance-tax/', '/india/ctc-take-home/', '/india/epf-calculator/', '/india/lumpsum-returns/', '/india/ppf-calculator/']);
  const printRow = (cols) => (x) => x.map((c, i) => (typeof c === 'number' && cols[i] === 'currency' ? c.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }) : c));
  const R = (u, inputs) => {
    const r = K.calc(u, inputs);
    if (PRINTED.has(u) && r && r._table && Array.isArray(r._table.cols)) r._table = Object.assign({}, r._table, { rows: r._table.rows.map(printRow(r._table.cols)) });
    return r;
  };
  const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.005 : tol);
  const src = (u) => fs.readFileSync(path.join(K.ROOT, 'engine', K.calcEngine(u).file), 'utf8');
  const keys = (u) => (S(u).inputs || []).map((i) => i.key);
  const input = (u, key) => (S(u).inputs || []).find((i) => i.key === key);
  const output = (u, key) => (S(u).outputs || []).find((o) => o.key === key);
  const optVals = (u, key) => ((input(u, key) || {}).options || []).map((o) => String(o.value !== undefined ? o.value : o));
  const j = K.j;
  /* a rupee figure as the engine's own tables print it */
  const inr = (v) => v.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  /* ================================================================ */
  /* Advance tax: ss.404, 408, 424 and 425 of the Income-tax Act, 2025  */
  /* ================================================================ */
  const AT = '/india/advance-tax/';
  const at = (o) => R(AT, Object.assign({ taxLiability: 200000, tdsPaid: 0, paidSoFar: 0, scheme: 'four', paidJun: null, paidSep: null, paidDec: null, paidMar: null, balanceMonth: '4' }, o));
  const row = (r, i) => r._table.rows[i];

  claim(AT, 'lede', 'Quarterly advance tax instalments, and the interest if you pay late or short, worked out for each due date: sections 425 and 424 of the Income-tax Act, 2025 (formerly 234C and 234B).', 'four instalments, a row per date, s.425 and s.424 interest', N, async () => {
    const r = at({ paidJun: 0 });
    const labels = ['q1', 'q2', 'q3', 'q4', 'interest425', 'interest424'].map((k) => (output(AT, k) || {}).label);
    const ok = r._table.rows.length === 5 && r.interest425 > 0 && r.interest424 > 0 &&
      /s\.425 \(formerly 234C\)/.test(labels[4]) && /s\.424 \(formerly 234B\)/.test(labels[5]) && labels.slice(0, 4).every((l) => /15 (Jun|Sep|Dec|Mar)/.test(l));
    return [ok, labels.join(' | ') + '; ' + r._table.rows.map((x) => x[0]).join(', ')];
  });
  claim(AT, 'card', 'Quarterly advance tax instalments, and the interest if you pay late or short, worked out for each due date', 'instalments and interest per date', N, async () => {
    const r = at({ paidJun: 10000, paidSep: 20000, paidDec: 30000, paidMar: 40000 });
    const per = r._table.rows.slice(0, 4).map((x) => x[5]);
    return [per.every((x) => /^₹/.test(x)) && r.q1 + r.q2 + r.q3 + r.q4 === 200000, per.join(', ')];
  });
  claim(AT, 'why', 'Enter your tax estimate and TDS. Get all four instalments and dates.', 'four dated instalments summing to the net tax', N, async () => {
    const r = at({ taxLiability: 320000, tdsPaid: 80000 });
    const l = ['q1', 'q2', 'q3', 'q4'].map((k) => output(AT, k).label);
    return [r.q1 + r.q2 + r.q3 + r.q4 === 240000 && j(l) === j(['Instalment 1 (15 Jun)', 'Instalment 2 (15 Sep)', 'Instalment 3 (15 Dec)', 'Instalment 4 (15 Mar)']), l.join(', ') + ' = ' + [r.q1, r.q2, r.q3, r.q4].join(' + ')];
  });
  claim(AT, 'why', 'Miss the quarterly dates and interest at 1% a month adds up.', 's.424 grows 1% of the shortfall a month', N, async () => {
    const a = at({ balanceMonth: '1' }), b = at({ balanceMonth: '6' });
    return [a.interest424 === 2000 && b.interest424 === 12000, 'nothing paid on ₹2,00,000: 1 month ' + a.interest424 + ', 6 months ' + b.interest424];
  });
  claim(AT, 'what', 'For FY 2026-27 the due dates are 15 June, 15 September and 15 December 2026, and 15 March 2027.', 'the four rows are those dates', N, async () => {
    const r = at({});
    const d = r._table.rows.slice(0, 4).map((x) => x[0].replace(/ \(.*/, ''));
    return [j(d) === j(['15 June', '15 September', '15 December', '15 March']), d.join(', ')];
  });
  claim(AT, 'what', 'Each date has a cumulative target, so a late start is caught up at the next one.', 'nothing by June, 45% by September: only June costs', N, async () => {
    const r = at({ paidJun: 0, paidSep: 90000, paidDec: 150000, paidMar: 200000 });
    const per = r._table.rows.slice(0, 4).map((x) => x[5]);
    return [per[0] === '₹900' && per[1] === '₹0' && per[2] === '₹0' && per[3] === '₹0' && r.interest425 === 900, per.join(', ')];
  });
  claim(AT, 'works', 'TDS and TCS come off the estimated tax for the year, then each date’s share applies; an instalment is that target less what earlier dates required.', 'instalments 15/30/30/25% of tax less TDS', N, async () => {
    const r = at({ taxLiability: 333333, tdsPaid: 33333 });
    return [r.netLiability === 300000 && r.q1 === 45000 && near(r.q2, 90000) && near(r.q3, 90000) && near(r.q4, 75000), [r.netLiability, r.q1, r.q2, r.q3, r.q4].join(', ')];
  });
  claim(AT, 'works', 'net liability = estimated tax − TDS − TCS', 'net = tax − TDS, never below 0', N, async () => {
    const a = at({ taxLiability: 120000, tdsPaid: 45000 }), b = at({ taxLiability: 50000, tdsPaid: 80000 });
    return [a.netLiability === 75000 && b.netLiability === 0, a.netLiability + ', ' + b.netLiability];
  });
  claim(AT, 'works', 'paid by each date = net liability × 15%, 45%, 75%, 100%', 'the "Due by then" column', N, async () => {
    const r = at({ taxLiability: 100000 });
    const due = r._table.rows.slice(0, 4).map((x) => x[1]);
    return [j(due) === j(['₹15,000', '₹45,000', '₹75,000', '₹1,00,000']), due.join(', ')];
  });
  claim(AT, 'works', 'section 425 interest = shortfall × 3% (June, September, December) or 1% (March)', '3, 3, 3 and 1 months at 1%', N, async () => {
    const r = at({ taxLiability: 100000, paidJun: 5000, paidSep: 15000, paidDec: 25000, paidMar: 50000 });
    const per = r._table.rows.slice(0, 4).map((x) => x[5]);
    /* shortfalls 10,000, 30,000, 50,000, 50,000 */
    return [j(per) === j(['₹300', '₹900', '₹1,500', '₹500']) && r.interest425 === 3200, per.join(', ')];
  });
  claim(AT, 'works', 'section 424 interest = unpaid balance × 1% × months from 1 April, if under 90% was paid', '89.9% paid costs, 90% does not', N, async () => {
    const a = at({ taxLiability: 100000, paidJun: 15000, paidSep: 45000, paidDec: 75000, paidMar: 90000, balanceMonth: '3' });
    const b = at({ taxLiability: 100000, paidJun: 15000, paidSep: 45000, paidDec: 75000, paidMar: 89900, balanceMonth: '3' });
    return [a.interest424 === 0 && b.interest424 === 10100 * 3 / 100, '90,000 paid: ' + a.interest424 + '; 89,900 paid: ' + b.interest424];
  });
  claim(AT, 'works', 'the target less what was paid, cut to a whole ₹100', 'a ₹12,399 shortfall counts as ₹12,300', N, async () => {
    const r = at({ taxLiability: 100000, paidJun: 2601 });
    return [row(r, 0)[3] === '₹12,300' && row(r, 0)[5] === '₹369', row(r, 0).join(' | ')];
  });
  claim(AT, 'works', 'the whole year’s tax, including surcharge and the 4% cess', 'the tool adds no cess of its own', N, async () => {
    const r = at({ taxLiability: 104000, tdsPaid: 0 });
    return [r.netLiability === 104000 && near(r.q1, 15600), 'net ' + r.netLiability + ', June ' + r.q1];
  });
  claim(AT, 'worked', 'September is ₹18,000 short, but she had paid over 36%, so it costs nothing.', 'September row reads Nil', N, async () => {
    const r = at({ taxLiability: 320000, tdsPaid: 80000, paidJun: 36000, paidSep: 90000, paidDec: 150000, paidMar: 200000, balanceMonth: '4' });
    return [row(r, 1)[5] === 'Nil, 36% paid', row(r, 1).join(' | ')];
  });
  claim(AT, 'worked', 'Under 90% was paid by March, so section 424 adds 1% a month for four months on ₹40,000: ₹1,600.', 'July = four months', N, async () => {
    const r = at({ taxLiability: 320000, tdsPaid: 80000, paidJun: 36000, paidSep: 90000, paidDec: 150000, paidMar: 200000, balanceMonth: '4' });
    return [row(r, 4)[4] === '4' && row(r, 4)[3] === '₹40,000' && r.interest424 === 1600, row(r, 4).join(' | ')];
  });
  claim(AT, 'use', 'See whether your employer’s TDS leaves a gap that needs advance tax.', 'a gap of ₹10,000 is liable, ₹9,999 is not', N, async () => {
    const a = at({ taxLiability: 100000, tdsPaid: 90000 }), b = at({ taxLiability: 100000, tdsPaid: 90001 });
    return [/^Advance tax is payable/.test(a.liable) && /^No advance tax due/.test(b.liable), a.liable + ' | ' + b.liable];
  });
  claim(AT, 'use', 'Compare the section 424 and 425 figures with your intimation.', 'both shown separately and totalled', N, async () => {
    const r = at({ paidJun: 10000 });
    return [r.interest425 > 0 && r.interest424 > 0 && r.interestTotal === r.interest425 + r.interest424, r.interest425 + ' + ' + r.interest424 + ' = ' + r.interestTotal];
  });
  claim(AT, 'mistake', 'Entering tax before cess. The 4% health and education cess and any surcharge are part of the liability; leave them out and every instalment falls short.', 'tax without cess gives smaller instalments', N, async () => {
    const a = at({ taxLiability: 100000 }), b = at({ taxLiability: 104000 });
    return [[1, 2, 3, 4].every((i) => a['q' + i] < b['q' + i]), [1, 2, 3, 4].map((i) => a['q' + i] + '<' + b['q' + i]).join(', ')];
  });
  manual(AT, 'mistake', 'Counting TDS that no client has actually deposited. Check your Annual Information Statement first.', 'advice about the user\'s records; the tool takes the TDS figure as entered');
  claim(AT, 'mistake', 'Entering single payments in the interest fields. They take running totals, so September includes June.', 'running totals; a falling total is flagged', N, async () => {
    const tot = at({ taxLiability: 100000, paidJun: 15000, paidSep: 45000 }), single = at({ taxLiability: 100000, paidJun: 15000, paidSep: 30000 });
    return [row(tot, 1)[3] === '₹0' && row(single, 1)[3] === '₹15,000' && /lower than the one before/.test(single.interestNote) === false &&
      /lower than the one before it/.test(at({ paidJun: 30000, paidSep: 20000 }).interestNote), 'totals: ' + row(tot, 1)[3] + '; singles: ' + row(single, 1)[3]];
  });
  claim(AT, 'dfaq', 'It becomes due when other income, such as rent, interest or capital gains, leaves ₹10,000 or more uncovered.', '₹10,000 exactly is liable', N, async () => {
    const a = at({ taxLiability: 60000, tdsPaid: 50000 }), b = at({ taxLiability: 60000, tdsPaid: 50001 });
    return [/payable/.test(a.liable) && /No advance tax/.test(b.liable), a.liable + ' | ' + b.liable];
  });
  claim(AT, 'dfaq', 'A ₹60,000 liability with ₹52,000 already deducted leaves ₹8,000, and the tool reports no advance tax due.', 'no interest charged either', N, async () => {
    const r = at({ taxLiability: 60000, tdsPaid: 52000 });
    return [/^No advance tax due/.test(r.liable) && r.interestTotal === 0, r.liable + '; interest ' + r.interestTotal];
  });
  manual(AT, 'dfaq', 'Through e-Pay Tax on the income-tax e-filing portal, choosing advance tax and the correct year.', 'how to pay: a statement about the e-filing portal, not the tool');
  claim(AT, 'formula', '15% by 15 Jun, 45% by 15 Sep, 75% by 15 Dec, 100% by 15 Mar', 'cumulative targets', N, async () => {
    const r = at({ taxLiability: 1000000 });
    const due = r._table.rows.slice(0, 4).map((x) => x[1]);
    return [j(due) === j(['₹1,50,000', '₹4,50,000', '₹7,50,000', '₹10,00,000']), due.join(', ')];
  });
  claim(AT, 'formula', 's.425 (234C): 3%, 3%, 3% and 1% of each shortfall, rounded down to ₹100', 'nothing paid on ₹1,00,050', N, async () => {
    /* targets 15,007.5, 45,022.5, 75,037.5, 1,00,050 → shortfalls 15,000, 45,000, 75,000, 1,00,000 */
    const r = at({ taxLiability: 100050, paidJun: 0 });
    const sh = r._table.rows.slice(0, 4).map((x) => x[3]);
    return [j(sh) === j(['₹15,000', '₹45,000', '₹75,000', '₹1,00,000']) && r.interest425 === 450 + 1350 + 2250 + 1000, sh.join(', ') + ' → ' + r.interest425];
  });
  claim(AT, 'formula', 's.424 (234B): 1% a month from 1 April on the unpaid balance, if under 90% was paid', 'months counted from April', N, async () => {
    const r = at({ taxLiability: 100000, paidMar: 50000, balanceMonth: '12' });
    return [r.interest424 === 6000 && /^1 April to March/.test(row(r, 4)[0]), row(r, 4).join(' | ')];
  });
  claim(AT, 'tip', 'Advance tax applies once net liability after TDS reaches ₹10,000 for the year (section 404 of the Income-tax Act, 2025, formerly 208).', 'the s.404 threshold, either side', N, async () => {
    const a = at({ taxLiability: 10000 }), b = at({ taxLiability: 9999 });
    return [/payable/.test(a.liable) && /No advance tax/.test(b.liable) && b.interestTotal === 0 && /\(s\.404\)/.test(b.interestNote) && /s\.404\s+advance tax is payable once the year's tax is 10,000/.test(src(AT)),
      a.liable + ' | ' + b.liable + ' | ' + b.interestNote];
  });
  claim(AT, 'tip', 'The four instalment dates are set by section 408 (formerly 211).', 'the engine cites s.408(1) for those dates', N, async () => [/s\.408\(1\)\s+15%, 45%, 75% and 100% by 15 June, September, December, March/.test(src(AT)), 'engine comment']);
  claim(AT, 'tip', 'There is none for June if you paid at least 12% by then, and none for September if you paid at least 36%.', '12% and 36% either side; no such relief in December', N, async () => {
    const a = at({ taxLiability: 100000, paidJun: 12000, paidSep: 36000, paidDec: 74900 });
    const b = at({ taxLiability: 100000, paidJun: 11900, paidSep: 35900, paidDec: 74900 });
    return [row(a, 0)[5] === 'Nil, 12% paid' && row(a, 1)[5] === 'Nil, 36% paid' && row(a, 2)[5] === '₹3' &&
      row(b, 0)[5] === '₹93' && row(b, 1)[5] === '₹273', [row(a, 0)[5], row(a, 1)[5], row(a, 2)[5], row(b, 0)[5], row(b, 1)[5]].join(', ')];
  });
  claim(AT, 'tip', '1% for every month or part of a month from 1 April on the unpaid balance, until you pay it.', 'one rate per month chosen, 1 to 12', N, async () => {
    const m = optVals(AT, 'balanceMonth');
    const v = m.map((x) => at({ taxLiability: 100000, balanceMonth: x }).interest424);
    return [m.length === 12 && v.every((x, i) => x === 1000 * (i + 1)), v.join(', ')];
  });
  claim(AT, 'tip', 'the tool counts only what you enter for 15 March, so it can overstate section 424 interest if you paid in that fortnight.', '"already paid" does not reduce s.424', N, async () => {
    const r = at({ taxLiability: 100000, paidSoFar: 100000, paidMar: 50000 });
    return [r.interest424 === 50000 * 4 / 100 && r.outstanding === 0 && !keys(AT).some((k) => /31|late|after/i.test(k)), 's.424 ' + r.interest424 + ', still to pay ' + r.outstanding];
  });
  claim(AT, 'tip', 'Each shortfall is rounded down to a multiple of ₹100 before interest is worked out, the procedure in rule 119A of the Income-tax Rules, 1962.', 'June, March and s.424 shortfalls all cut to ₹100', N, async () => {
    const r = at({ taxLiability: 100099, paidJun: 0, paidMar: 0, balanceMonth: '1' });
    const sh = [row(r, 0)[3], row(r, 3)[3], row(r, 4)[3]];
    return [j(sh) === j(['₹15,000', '₹1,00,000', '₹1,00,000']) && /rule 119A/.test(src(AT)), sh.join(', ')];
  });
  claim(AT, 'tip', 'Interest for filing the return late, section 423 (formerly 234A), is not included.', 'no s.423 output', N, async () => {
    const o = (S(AT).outputs || []).map((x) => x.label + ' ' + x.key).join(' ');
    return [!/423|234A/.test(o) && Object.keys(at({})).filter((k) => /interest/i.test(k)).length === 4, o];
  });
  claim(AT, 'tip', 'The tool does not apply that relief, so in that case it overstates the interest.', 'no input for unforeseen gains', N, async () => [!keys(AT).some((k) => /gain|divid|relief|unfore/i.test(k)), keys(AT).join(', ')]);
  claim(AT, 'tip', 'No section 425 interest is charged on a shortfall caused by capital gains, dividends or newly started business income you could not foresee, if you pay the tax on it in the remaining instalments or by 31 March (s.425(4)).', 'the engine cites s.425(4) as the relief it leaves out', N, async () => [/Not modelled: s\.425\(4\) relief\s+for capital gains, dividends/.test(src(AT)), 'engine comment']);
  manual(AT, 'tip', 'Resident senior citizens (60 or over) with no business or professional income are exempt from advance tax entirely: s.403(3), formerly 207(2).', 'statement of law the tool does not model (it has no age input); the engine source does not cite s.403(3), so the section number rests on the Act itself');
  claim(AT, 'tip', 'choose that option and the only section 425 interest is 1% of any shortfall at 15 March (s.425(3)).', 'presumptive: one row, 1%', N, async () => {
    const r = at({ taxLiability: 100000, scheme: 'presumptive', paidJun: 0, paidSep: 0, paidDec: 0, paidMar: 60000 });
    return [r._table.rows.length === 2 && /single instalment/.test(row(r, 0)[0]) && r.interest425 === 400 && r.q1 === 0 && r.q4 === 100000, r._table.rows.map((x) => x[0] + ' ' + x[5]).join('; ')];
  });
  claim(AT, 'tip', 'Businesses and professionals declaring presumptive income under s.58 (formerly 44AD and 44ADA) pay the whole amount in a single instalment by 15 March, under s.408(2)', 'the engine cites s.408(2) and s.58', N, async () => [/s\.408\(2\)\s+presumptive income under s\.58\(2\)[\s\S]{0,60}formerly\s+44AD and 44ADA/.test(src(AT)) && optVals(AT, 'scheme').indexOf('presumptive') >= 0, 'engine comment']);
  manual(AT, 'tip', 'Goods-carriage operators taxed under the same section (formerly 44AE) still pay in four instalments.', 'statement of law; such a user picks the four-instalment option, which is the default');
  claim(AT, 'faq', 'Section 425 (formerly 234C) charges 3% of the June, September and December shortfalls of ₹7,500, ₹17,500 and ₹22,500, and 1% of the ₹30,000 March shortfall: ₹1,725.', 'the FAQ example, s.425', N, async () => {
    const r = at({ taxLiability: 150000, paidJun: 15000, paidSep: 50000, paidDec: 90000, paidMar: 120000, balanceMonth: '4' });
    const sh = r._table.rows.slice(0, 4).map((x) => x[3]);
    return [j(sh) === j(['₹7,500', '₹17,500', '₹22,500', '₹30,000']) && r.interest425 === 1725, sh.join(', ') + ' → ' + r.interest425];
  });
  claim(AT, 'faq', 'Only 80% was paid by March, under the 90% line, so section 424 (formerly 234B) adds 1% a month on ₹30,000 from April to July: ₹1,200. The total is ₹2,925.', 'the FAQ example, s.424 and total', N, async () => {
    const r = at({ taxLiability: 150000, paidJun: 15000, paidSep: 50000, paidDec: 90000, paidMar: 120000, balanceMonth: '4' });
    return [r.interest424 === 1200 && r.interestTotal === 2925, r.interest424 + ', ' + r.interestTotal];
  });
  manual(AT, 'faq', 'From tax year 2026-27 the same charges are sections 424 and 425 of the Income-tax Act, 2025, which replaced the 1961 Act on 1 April 2026.', 'statement of law; the engine cites the Gazette copy of the Act (egazette.gov.in 265620.pdf) for ss.424 and 425 and the tool works only the 2025 Act');
  claim(AT, 'faq', 'The due dates, the 3% and 1% rates, and the 12%, 36% and 90% tests are the same.', 'the engine\'s constants: 3/3/3/1 months, 12%, 36%, 90%', N, async () => {
    const s = src(AT);
    return [/pct: 0\.15, months: 3, spare: 0\.12/.test(s) && /pct: 0\.45, months: 3, spare: 0\.36/.test(s) && /pct: 0\.75, months: 3, spare: null/.test(s) && /pct: 1\.00, months: 1, spare: null/.test(s) && /net \* 0\.9 - 1e-9/.test(s), 'AT_DATES and the 90% test'];
  });
  claim(AT, 'faq', 'Estimate conservatively and revise at each instalment — the schedule is cumulative, so an increased estimate can be caught up at the next date.', 'a raised estimate paid up by December costs only the earlier dates', N, async () => {
    /* estimate raised from 1,00,000 to 2,00,000 after September: paid 15k, 45k, then on target */
    const r = at({ taxLiability: 200000, paidJun: 15000, paidSep: 45000, paidDec: 150000, paidMar: 200000 });
    const per = r._table.rows.slice(0, 4).map((x) => x[5]);
    return [per[2] === '₹0' && per[3] === '₹0' && r.interest424 === 0, per.join(', ')];
  });

  /* ================================================================ */
  /* Income tax, FY 2026-27: an independent reference from the slabs    */
  /* the income-tax page states (new: 0 to ₹4 lakh, then 5% steps to    */
  /* 30% above ₹24 lakh; old: 2.5/5/10 lakh), used by CTC as well       */
  /* ================================================================ */
  const slabTax = (x, s) => { let t = 0, lo = 0; for (const [up, r] of s) { if (x <= lo) break; t += (Math.min(x, up) - lo) * r; lo = up; } return t; };
  const NEW = [[400000, 0], [800000, 0.05], [1200000, 0.10], [1600000, 0.15], [2000000, 0.20], [2400000, 0.25], [Infinity, 0.30]];
  const OLD = [[250000, 0], [500000, 0.05], [1000000, 0.20], [Infinity, 0.30]];
  /* new regime, no surcharge: rebate to ₹12 lakh, marginal relief above, 4% cess */
  const refNew = (taxable) => { let t = slabTax(taxable, NEW); if (taxable <= 1200000) t = 0; else t = Math.min(t, taxable - 1200000); return t * 1.04; };
  const refOld = (taxable) => { let t = slabTax(taxable, OLD); if (taxable <= 500000) t = Math.max(0, t - 12500); return t * 1.04; };

  /* ================================================================ */
  const CT = '/india/ctc-take-home/';
  const ct = (o) => R(CT, Object.assign({ ctc: 1200000, basicPct: 40, regime: 'new', deductions: 150000, ptax: 2400 }, o));
  const ctcAdds = (r, c) => near(r.gross + r.employerPF + r.gratuityAccrual, c, 1e-6) && near(r.annualInHand, r.gross - r.employeePF - r.ptax - r.tax, 1e-6) && near(r.monthly * 12, r.annualInHand, 1e-6);
  claim(CT, 'lede', 'Break a cost-to-company figure into gross, deductions and monthly in-hand pay.', 'CTC → gross → in-hand, every line adds up', N, async () => {
    const r = ct({ ctc: 1800000, basicPct: 50, ptax: 2500 });
    const lab = r._table.rows.map((x) => x[0]);
    return [ctcAdds(r, 1800000) && lab[3] === 'Gross salary' && lab[7] === 'In-hand salary' && r._table.rows[7][2] === inr(r.monthly), lab.join(', ')];
  });
  claim(CT, 'card', 'Break a cost-to-company figure into gross, deductions and monthly in-hand pay.', 'the same, on another CTC', N, async () => { const r = ct({ ctc: 2500000, basicPct: 35, regime: 'old', deductions: 200000 }); return [ctcAdds(r, 2500000) && r.tax > 0, [r.gross, r.employeePF, r.ptax, r.tax, r.monthly].map(Math.round).join(', ')]; });
  claim(CT, 'why', 'Enter CTC and basic %. See gross, deductions and monthly in-hand.', 'basic % moves PF, gratuity and the in-hand', N, async () => {
    const a = ct({ ctc: 800000, basicPct: 20 }), b = ct({ ctc: 800000, basicPct: 50 });
    return [a.basic === 160000 && b.basic === 400000 && a.employerPF < b.employerPF && a.gratuityAccrual < b.gratuityAccrual && a.monthly > b.monthly, Math.round(a.monthly) + ' at 20%, ' + Math.round(b.monthly) + ' at 50%'];
  });
  claim(CT, 'why', 'CTC ÷ 12 says ₹1 lakh a month. Employer PF, gratuity and professional tax have other plans.', '₹12 lakh CTC: under ₹1 lakh a month, and those three lines are why (no income tax there)', N, async () => {
    const r = ct({ ctc: 1200000 });
    return [r.monthly < 100000 && r.employerPF > 0 && r.gratuityAccrual > 0 && r.ptax > 0 && r.tax === 0 && near(100000 - r.monthly, (r.employerPF + r.gratuityAccrual + r.employeePF + r.ptax) / 12, 1e-6), Math.round(r.monthly) + ' a month; tax ' + r.tax];
  });
  claim(CT, 'works', 'surcharge above ₹50 lakh is left out', 'no surcharge on a ₹1 crore CTC', N, async () => {
    const r = ct({ ctc: 10000000, basicPct: 40 }); const taxable = r.gross - 75000;
    return [taxable > 5000000 && near(r.tax, slabTax(taxable, NEW) * 1.04, 0.01), 'taxable ' + Math.round(taxable) + ', tax ' + Math.round(r.tax) + ' (slab × 1.04, no 10–15% surcharge)'];
  });
  claim(CT, 'works', 'after rebate and marginal relief', 'just over ₹12 lakh taxable: tax capped at the excess', N, async () => {
    let lo = 1200000, hi = 1500000; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (ct({ ctc: m }).gross - 75000 > 1210000) hi = m; else lo = m; }
    const r = ct({ ctc: hi }); const taxable = r.gross - 75000;
    return [near(r.tax, (taxable - 1200000) * 1.04, 0.01) && slabTax(taxable, NEW) > taxable - 1200000, 'taxable ' + taxable.toFixed(2) + ', tax ' + r.tax.toFixed(2)];
  });
  claim(CT, 'works', 'What remains is gross salary; your PF, professional tax and income tax come off that.', 'each comes off as a line; a nil line reads ₹0, not -₹0', N, async () => { const r = ct({ ctc: 1200000, ptax: 0 }); const t = r._table.rows.find((x) => x[0] === 'Less: income tax'), p = r._table.rows.find((x) => x[0] === 'Less: professional tax'); return [t[1] === '₹0' && t[2] === '₹0' && p[1] === '₹0', t.join(' | ') + '; ' + p.join(' | ')]; });
  claim(CT, 'what', 'The gap between the two depends mostly on how large basic pay is, because PF and gratuity are both worked out on basic', 'PF and gratuity follow basic', N, async () => {
    const a = ct({ ctc: 600000, basicPct: 10 }), b = ct({ ctc: 600000, basicPct: 20 });
    return [near(b.employerPF, 2 * a.employerPF) && near(b.gratuityAccrual, 2 * a.gratuityAccrual), a.employerPF + '→' + b.employerPF + ', ' + a.gratuityAccrual.toFixed(2) + '→' + b.gratuityAccrual.toFixed(2)];
  });
  claim(CT, 'works', 'its 12% PF, on PF wages capped at ₹15,000 a month, and a yearly gratuity accrual', 'PF wage cap at ₹1,80,000 a year, either side', N, async () => {
    const a = ct({ ctc: 1790000, basicPct: 10 }), b = ct({ ctc: 1800000, basicPct: 10 }), c = ct({ ctc: 1810000, basicPct: 10 });
    return [near(a.employerPF, 21480) && b.employerPF === 21600 && c.employerPF === 21600 && c.employeePF === 21600, [a.employerPF, b.employerPF, c.employerPF].join(', ')];
  });
  claim(CT, 'works', 'basic = CTC × basic %', 'basic', N, async () => { const r = ct({ ctc: 1234000, basicPct: 45 }); return [near(r.basic, 555300), r.basic]; });
  claim(CT, 'works', 'PF wage = lower of basic and ₹1,80,000 a year', 'employee PF on the lower of the two', N, async () => {
    const a = ct({ ctc: 1000000, basicPct: 15 }), b = ct({ ctc: 1000000, basicPct: 60 });
    return [near(a.employeePF, 18000) && near(b.employeePF, 21600), a.employeePF + ', ' + b.employeePF];
  });
  claim(CT, 'works', 'gross = CTC − 12% × PF wage − basic × 15/26 ÷ 12', 'gross', N, async () => {
    const r = ct({ ctc: 3000000, basicPct: 40 }); return [near(r.gross, 3000000 - 21600 - 1200000 * 15 / 26 / 12, 1e-6), r.gross];
  });
  claim(CT, 'works', 'in-hand = gross − 12% × PF wage − professional tax − income tax', 'in-hand', N, async () => {
    const r = ct({ ctc: 3000000, basicPct: 40, ptax: 2500 }); return [near(r.annualInHand, r.gross - 21600 - 2500 - r.tax, 1e-6) && r.tax > 0, r.annualInHand];
  });
  claim(CT, 'works', 'a year’s gratuity accrual, about 4.81% of annual basic', '15/26 ÷ 12 = 4.81%', N, async () => { const r = ct({ ctc: 1000000, basicPct: 50 }); const p = r.gratuityAccrual / r.basic * 100; return [p.toFixed(2) === '4.81', p.toFixed(4) + '%']; });
  claim(CT, 'works', 'slab tax on gross less the standard deduction, after rebate and marginal relief, plus 4% cess', 'tax against the FY 2026-27 slabs, both regimes, around ₹12 lakh', N, async () => {
    const bad = [];
    for (const c of [1000000, 1300000, 1350000, 1400000, 2000000, 3000000]) for (const reg of ['new', 'old']) {
      const r = ct({ ctc: c, basicPct: 40, regime: reg, deductions: 150000 });
      const want = reg === 'new' ? refNew(Math.max(0, r.gross - 75000)) : refOld(Math.max(0, r.gross - 50000 - 150000));
      if (!near(r.tax, want, 0.01)) bad.push(c + ' ' + reg + ': ' + r.tax.toFixed(2) + ' vs ' + want.toFixed(2));
    }
    return [!bad.length, bad.join('; ') || 'all match'];
  });
  claim(CT, 'worked', 'Employer PF stops at ₹21,600 because of the wage cap', '₹9 lakh basic', N, async () => { const r = ct({ ctc: 1800000, basicPct: 50, ptax: 2500, deductions: 0 }); return [r.employerPF === 21600 && r.basic === 900000, r.employerPF]; });
  claim(CT, 'use', 'Enter each CTC with its own basic % and compare the monthly in-hand, not the headline figure.', 'a higher CTC with more basic can pay less a month', N, async () => {
    const a = ct({ ctc: 1500000, basicPct: 30, regime: 'old', deductions: 0 }), b = ct({ ctc: 1520000, basicPct: 60, regime: 'old', deductions: 0 });
    return [b.monthly < a.monthly, Math.round(a.monthly) + ' on ₹15 lakh at 30%, ' + Math.round(b.monthly) + ' on ₹15.2 lakh at 60%'];
  });
  claim(CT, 'use', 'Run both regimes with your expected deductions before declaring one to payroll.', 'both regimes, deductions moving only the old', N, async () => {
    const n1 = ct({ ctc: 2000000, regime: 'new', deductions: 0 }), n2 = ct({ ctc: 2000000, regime: 'new', deductions: 400000 });
    const o1 = ct({ ctc: 2000000, regime: 'old', deductions: 0 }), o2 = ct({ ctc: 2000000, regime: 'old', deductions: 400000 });
    return [optVals(CT, 'regime').join() === 'new,old' && n1.tax === n2.tax && o2.tax < o1.tax, [n1.tax, n2.tax, o1.tax, o2.tax].map(Math.round).join(', ')];
  });
  claim(CT, 'use', 'Plan rent and loan instalments on the monthly figure rather than the annual package.', 'monthly = annual in-hand ÷ 12', N, async () => { const r = ct({ ctc: 900000 }); return [near(r.monthly * 12, r.annualInHand, 1e-6) && output(CT, 'monthly').primary === true, r.monthly]; });
  claim(CT, 'mistake', 'It limits PF wages to ₹15,000 a month; if your employer contributes on full basic, both PF lines are larger and in-hand is smaller.', 'both PF lines capped at ₹21,600 on ₹9 lakh basic', N, async () => {
    const r = ct({ ctc: 1800000, basicPct: 50 }); return [r.employerPF === 21600 && r.employeePF === 21600 && r.basic * 0.12 > 21600, r.employerPF + ', ' + r.employeePF + ' (12% of basic would be ' + r.basic * 0.12 + ')'];
  });
  claim(CT, 'mistake', 'The tool uses the deductions box only when the old regime is selected, and gives the new regime just its ₹75,000 standard deduction.', 'new regime: ₹75,000 off gross, deductions ignored', N, async () => {
    const a = ct({ ctc: 2400000, regime: 'new', deductions: 0 }), b = ct({ ctc: 2400000, regime: 'new', deductions: 500000 });
    return [a.tax === b.tax && near(a.tax, refNew(a.gross - 75000), 0.01), a.tax + ' / ' + b.tax];
  });
  claim(CT, 'dfaq', 'Income tax takes ₹89,630 of it for the year, because taxable income passes the ₹12 lakh rebate limit.', 'taxable over ₹12 lakh, so no rebate', N, async () => {
    const r = ct({ ctc: 1500000, basicPct: 40, ptax: 2400 }); const taxable = r.gross - 75000;
    /* the CTC whose taxable income is exactly ₹12 lakh pays nothing */
    let lo = 1200000, hi = 1500000; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (ct({ ctc: m }).gross - 75000 > 1200000) hi = m; else lo = m; }
    const at = ct({ ctc: lo });
    return [taxable > 1200000 && near(r.tax, refNew(taxable), 0.01) && r.tax > 0 && at.tax === 0, 'taxable ' + Math.round(taxable) + ', tax ' + Math.round(r.tax) + '; at taxable ₹12 lakh (CTC ' + Math.round(lo) + '), tax ' + at.tax];
  });
  manual(CT, 'dfaq', 'Payslips split gross into HRA and allowances, and TDS is spread from a projection of your yearly income.', 'how payroll works; the tool does not model a payslip');
  claim(CT, 'formula', 'in-hand = gross − PF − professional tax − income tax', 'the formula', N, async () => {
    const bad = [500000, 1200000, 2600000].map((c) => ct({ ctc: c, ptax: 2500 })).filter((r) => !near(r.annualInHand, r.gross - r.employeePF - 2500 - r.tax, 1e-6));
    return [!bad.length, bad.length + ' mismatches'];
  });
  claim(CT, 'tip', 'Employer PF, gratuity accrual and insurance premiums sit inside CTC but never reach your account.', 'employer PF and gratuity come off before gross (insurance is not an input: none is assumed)', N, async () => {
    const r = ct({ ctc: 1000000, basicPct: 40 });
    return [near(r.gross, 1000000 - r.employerPF - r.gratuityAccrual, 1e-6) && r.employerPF > 0 && !keys(CT).some((k) => /insur/i.test(k)), r.employerPF + ' + ' + r.gratuityAccrual.toFixed(2)];
  });
  claim(CT, 'tip', 'A higher basic increases PF and gratuity — better long-term savings, lower monthly cash.', '30% → 40% basic', N, async () => {
    const a = ct({ ctc: 1000000, basicPct: 10 }), b = ct({ ctc: 1000000, basicPct: 15 });
    return [b.employeePF > a.employeePF && b.gratuityAccrual > a.gratuityAccrual && b.monthly < a.monthly, [a.employeePF, b.employeePF, Math.round(a.monthly), Math.round(b.monthly)].join(', ')];
  });
  manual(CT, 'tip', 'Professional tax is levied by state and capped at ₹2,500 a year. Some states, including Delhi and Haryana, do not levy it at all.', 'constitutional cap (Article 276) and state practice; the tool takes the professional tax as entered and does not cap it');
  manual(CT, 'tip', 'Variable pay and joining bonuses are usually included in CTC but paid conditionally, which is the most common reason in-hand differs from expectation.', 'about salary structures; the tool has no variable-pay input');
  manual(CT, 'faq', 'Typically 15–25% of CTC never reaches you: employer PF, gratuity accrual, insurance and any variable component, before income tax and your own PF are deducted.', 'about typical packages: the tool models only employer PF and gratuity, which are 3.5–6% of CTC at 40–50% basic; insurance and variable pay are not inputs');

  /* ================================================================ */
  const IT = '/india/india-income-tax/';
  const it = (o) => R(IT, Object.assign({ gross: 1500000, fy: '2026-27', type: 'salaried', age: 'below60', deductions: 200000 }, o));
  /* schedule cells are numbers now, formatted by the page; these claims
     read them as the page shows them in rupees (whole rupees, en-IN) */
  const fmtR = (v) => (typeof v === 'number' ? v.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }) : v);
  const rowR = (row) => (row || []).map((c, i) => (i ? fmtR(c) : c));
  const itRow = (r, label) => rowR(r._table.rows.find((x) => x[0] === label) || []);
  /* the tax before rebate on a taxable amount, read from the table (type: other, so taxable = gross) */
  const preNew = (x) => K.num(itRow(it({ gross: x, type: 'other' }), 'Tax before rebate')[1]);
  claim(IT, 'lede', 'Compare tax under both regimes for FY 2026-27, including rebate, surcharge, cess and marginal relief.', 'both regimes, each with rebate, relief, surcharge and cess rows', N, async () => {
    const r = it({ gross: 1300000 }), s = it({ gross: 6000000, deductions: 0 });
    return [r.newRebate === 0 && r.newRelief > 0 && s.newSurcharge > 0 && r.newCess > 0 && r.newTotal > 0 && r.oldTotal > 0 && /saves/.test(r.better), r.better + '; relief ' + r.newRelief + '; surcharge on ₹60 lakh ' + s.newSurcharge];
  });
  claim(IT, 'card', 'Compare tax under both regimes for FY 2026-27, including rebate, surcharge, cess and marginal relief.', 'the rebate itself, on ₹10 lakh', N, async () => { const r = it({ gross: 1000000 }); return [r.newRebate > 0 && r.newTotal === 0, 'rebate ' + r.newRebate + ', tax ' + r.newTotal]; });
  claim(IT, 'why', 'Enter income and deductions. See both regimes side by side.', 'one table, new and old columns', N, async () => { const r = it({}); const labels = r._table.rows.map((x) => x[0]); return [j(r._table.head) === j(['', 'New regime', 'Old regime']) && ['Taxable income', 'Total tax payable', 'Income after tax'].every((l) => labels.indexOf(l) >= 0), r._table.head.join(' | ') + '; ' + labels.length + ' rows'];
  });
  claim(IT, 'what', 'The new regime has lower rates and few deductions; the old regime has higher rates but allows 80C, 80D, HRA and home-loan interest.', 'deductions reduce only the old regime', N, async () => {
    const a = it({ deductions: 0 }), b = it({ deductions: 300000 });
    return [a.newTotal === b.newTotal && b.oldTotal < a.oldTotal && /80C, 80D, HRA/.test(input(IT, 'deductions').label), [a.newTotal, b.newTotal, a.oldTotal, b.oldTotal].join(', ')];
  });
  claim(IT, 'what', 'For FY 2026-27 the new regime charges nothing on the first ₹4 lakh of taxable income and rises in 5% steps to 30% above ₹24 lakh', 'the marginal rate either side of each slab edge', N, async () => {
    const edges = [400000, 800000, 1200000, 1600000, 2000000, 2400000];
    const rates = [0, 5, 10, 15, 20, 25, 30];
    const got = [], bad = [];
    edges.forEach((e, k) => {
      const below = (preNew(e) - preNew(e - 10000)) / 100, above = (preNew(e + 10000) - preNew(e)) / 100;
      got.push(below + '|' + above);
      if (below !== rates[k] || above !== rates[k + 1]) bad.push(e);
    });
    return [!bad.length, got.join(', ')];
  });
  claim(IT, 'what', 'with a ₹75,000 standard deduction for salaried taxpayers and pensioners', 'salaried gets ₹75,000, self-employed none', N, async () => {
    const a = it({ gross: 2000000, type: 'salaried' }), b = it({ gross: 2000000, type: 'other' });
    return [a.newTaxable === 1925000 && b.newTaxable === 2000000 && /pensioner/i.test(optVals(IT, 'type').length && input(IT, 'type').options[0].label), a.newTaxable + ', ' + b.newTaxable];
  });
  claim(IT, 'works', 'Each regime is run separately: deductions, then slabs, the rebate, marginal relief and surcharge, and finally 4% cess on the total.', 'cess is 4% of tax plus surcharge', N, async () => {
    const r = it({ gross: 12000000, deductions: 0 });
    return [r.newSurcharge > 0 && near(r.newCess, (r.newTotal - r.newCess) * 0.04, 0.01) && near(r.newTotal, (r.newTotal - r.newCess - r.newSurcharge) * (1 + K.num('15') / 100) * 1.04, 0.01), 'surcharge ' + r.newSurcharge + ', cess ' + r.newCess];
  });
  claim(IT, 'works', 'taxable = gross − standard deduction − old-regime deductions', 'old taxable', N, async () => { const r = it({ gross: 1800000, deductions: 375000 }); return [r.oldTaxable === 1375000 && r.newTaxable === 1725000, r.newTaxable + ', ' + r.oldTaxable]; });
  claim(IT, 'works', 'slab tax = Σ (income in each slab × that slab’s rate)', 'against the reference slabs, both regimes', N, async () => {
    const bad = [];
    for (const x of [300000, 650000, 1150000, 1999999, 3333333]) {
      const r = it({ gross: x, type: 'other', deductions: 0 });
      if (!near(K.num(itRow(r, 'Tax before rebate')[1]), Math.round(slabTax(x, NEW)), 1) || !near(K.num(itRow(r, 'Tax before rebate')[2]), Math.round(slabTax(x, OLD)), 1)) bad.push(x);
    }
    return [!bad.length, bad.join(', ') || 'all match'];
  });
  claim(IT, 'works', 'new regime: taxable ≤ ₹12,00,000 → no tax; above it, tax ≤ taxable − ₹12,00,000', 'the rebate and marginal relief at ₹12 lakh', N, async () => {
    const a = it({ gross: 1200000, type: 'other' }), b = it({ gross: 1200100, type: 'other' }), c = it({ gross: 1250000, type: 'other' }), d = it({ gross: 1400000, type: 'other' });
    return [a.newTotal === 0 && near(b.newTotal, 104) && near(c.newTotal, 50000 * 1.04) && near(d.newTotal, slabTax(1400000, NEW) * 1.04) && d.newRelief === 0,
      [a.newTotal, b.newTotal, c.newTotal, d.newTotal].join(', ')];
  });
  claim(IT, 'works', 'total = (tax + surcharge) × 1.04', 'total', N, async () => {
    const r = it({ gross: 7000000, deductions: 0 }); const tax = slabTax(6925000, NEW);
    return [near(r.newTotal, tax * 1.1 * 1.04, 0.01), r.newTotal + ' vs ' + (tax * 1.1 * 1.04)];
  });
  claim(IT, 'works', '₹75,000 new, ₹50,000 old, for salaried taxpayers and pensioners only', 'standard deduction row', N, async () => {
    const a = it({ type: 'salaried' }), b = it({ type: 'other' });
    return [j(itRow(a, 'Standard deduction')) === j(['Standard deduction', '₹75,000', '₹50,000']) && j(itRow(b, 'Standard deduction')) === j(['Standard deduction', '₹0', '₹0']), itRow(a, 'Standard deduction').join(' | ') + ' / ' + itRow(b, 'Standard deduction').join(' | ')];
  });
  claim(IT, 'works', 'starts at 10% of tax once taxable income passes ₹50 lakh', '₹50,00,000 none, ₹50,00,100 10%', N, async () => {
    const a = it({ gross: 5000000, type: 'other', deductions: 0 }), b = it({ gross: 5000100, type: 'other', deductions: 0 });
    return [a.newSurcharge === 0 && near(b.newSurcharge, slabTax(5000100, NEW) * 0.10), a.newSurcharge + ', ' + b.newSurcharge];
  });
  claim(IT, 'worked', 'With cess the bill is ₹26,000. Under the old regime taxable income is ₹10,00,000 and tax ₹1,17,000, so the new regime saves ₹91,000.', 'the new regime is named the winner', N, async () => {
    const r = it({ gross: 1300000, deductions: 250000 }); return [r.oldTaxable === 1000000 && r.better === 'New regime — saves ₹91,000', r.better];
  });
  claim(IT, 'use', 'See how marginal relief softens the step just above the rebate limit.', '₹1,000 over the limit costs ₹1,040, not the slab tax', N, async () => {
    const r = it({ gross: 1201000, type: 'other' }); return [near(r.newTotal, 1040) && near(r.newRelief, slabTax(1201000, NEW) - 1000), 'tax ' + r.newTotal + ', relief ' + r.newRelief];
  });
  claim(IT, 'use', 'Weigh the old regime’s higher exemption limit for seniors against the new regime’s rebate.', 'age moves only the old regime', N, async () => {
    const a = it({ gross: 900000, age: 'below60' }), b = it({ gross: 900000, age: 'senior' });
    return [a.newTotal === b.newTotal && b.oldTotal < a.oldTotal, [a.newTotal, b.newTotal, a.oldTotal, b.oldTotal].join(', ')];
  });
  claim(IT, 'mistake', 'Without a salary there is no standard deduction, and ₹13 lakh of fees costs ₹78,000 under the new regime, not ₹26,000.', 'salaried ₹26,000, self-employed ₹78,000', N, async () => {
    const a = it({ gross: 1300000, type: 'salaried' }), b = it({ gross: 1300000, type: 'other' });
    return [a.newTotal === 26000 && b.newTotal === 78000, a.newTotal + ', ' + b.newTotal];
  });
  manual(IT, 'use', 'Pick the regime that sets your monthly TDS at the start of the year.', 'payroll practice; the tool compares the two regimes');
  manual(IT, 'mistake', 'Counting deductions you have not yet made. Enter only the investments and premiums you will actually pay by 31 March, or the old regime looks cheaper than it will be.', 'advice about what to enter');
  claim(IT, 'dfaq', 'In the old regime the tax-free slab rises to ₹3 lakh at 60 and ₹5 lakh at 80; the new regime has no age-based slabs.', 'old-regime nil slab by age, either side; new unchanged', N, async () => {
    const o = (g, a) => K.num(itRow(it({ gross: g, type: 'other', age: a, deductions: 0 }), 'Tax before rebate')[2]);
    const n = (a) => it({ gross: 2000000, age: a }).newTotal;
    const ok = o(300000, 'senior') === 0 && o(310000, 'senior') === 500 && o(500000, 'super') === 0 && o(510000, 'super') === 2000 && o(260000, 'below60') === 500 &&
      n('below60') === n('senior') && n('senior') === n('super');
    return [ok, [o(300000, 'senior'), o(310000, 'senior'), o(500000, 'super'), o(510000, 'super'), o(260000, 'below60')].join(', ') + '; age option labels ' + input(IT, 'age').options.map((x) => x.label).join(', ')];
  });
  claim(IT, 'dfaq', 'A 65-year-old with ₹9 lakh of pension and ₹2 lakh of deductions pays nothing under the new regime, thanks to the rebate', 'rebate wipes the tax', N, async () => { const r = it({ gross: 900000, age: 'senior' }); return [r.newTotal === 0 && r.newRebate > 0, r.newTotal + ', rebate ' + r.newRebate]; });
  claim(IT, 'dfaq', 'With marginal relief, ₹100 over ₹50 lakh adds just ₹104 of tax.', '₹50,00,000 and ₹50,00,100', N, async () => {
    const a = it({ gross: 5000000, type: 'other' }), b = it({ gross: 5000100, type: 'other' });
    return [near(b.newTotal - a.newTotal, 104, 1e-6) && b.newSurcharge > 0, 'tax rises by ' + (b.newTotal - a.newTotal).toFixed(2) + ' on ₹100 more'];
  });
  claim(IT, 'formula', 'tax = slab tax − 87A rebate + surcharge + 4% cess', 'old regime: rebate of up to ₹12,500 to ₹5 lakh', N, async () => {
    const a = it({ gross: 500000, type: 'other', deductions: 0 }), b = it({ gross: 500100, type: 'other', deductions: 0 });
    return [a.oldTotal === 0 && K.num(itRow(a, 'Rebate (s.156, formerly 87A)')[2]) === 12500 && near(b.oldTotal, (12500 + 20) * 1.04), a.oldTotal + ', ' + b.oldTotal];
  });
  manual(IT, 'tip', 'The new regime is the default. You must actively opt for the old one, and salaried taxpayers can switch each year while business income generally cannot.', 'statement of law about choosing a regime; the tool works out both');
  claim(IT, 'tip', 'Under the new regime, taxable income up to ₹12 lakh attracts no tax because of the ₹60,000 rebate — section 156 of the Income-tax Act, 2025, formerly section 87A.', '₹12 lakh: ₹60,000 slab tax, all rebated; row named s.156', N, async () => {
    const r = it({ gross: 1200000, type: 'other' });
    return [r.newRebate === 60000 && r.newTotal === 0 && itRow(r, 'Rebate (s.156, formerly 87A)')[1] === '₹60,000' && /87A rebate/.test(output(IT, 'newRebate').label), 'rebate ' + r.newRebate + '; ' + itRow(r, 'Rebate (s.156, formerly 87A)').join(' | ')];
  });
  claim(IT, 'tip', 'With the ₹75,000 standard deduction, a salary up to ₹12.75 lakh is effectively tax-free.', '₹12,75,000 nil, ₹12,76,000 not', N, async () => {
    const a = it({ gross: 1275000 }), b = it({ gross: 1276000 }); return [a.newTotal === 0 && b.newTotal > 0, a.newTotal + ', ' + b.newTotal];
  });
  claim(IT, 'tip', 'The rates and limits used here did not change, and the familiar old numbers are kept as names.', 'FY 2025-26 gives the same tax; only the rebate row name differs', N, async () => {
    const bad = [];
    for (const g of [700000, 1200000, 1300000, 2500000, 6000000, 25000000]) for (const age of ['below60', 'senior', 'super']) {
      const a = it({ gross: g, age, fy: '2026-27' }), b = it({ gross: g, age, fy: '2025-26' });
      if (a.newTotal !== b.newTotal || a.oldTotal !== b.oldTotal) bad.push(g + ' ' + age);
    }
    const r25 = it({ fy: '2025-26' });
    return [!bad.length && itRow(r25, 'Section 87A rebate').length === 3, bad.join(', ') || 'same tax in both years'];
  });
  claim(IT, 'tip', '80C is now section 123, 80D section 126, 87A section 156, 111A section 196 and 112A section 198.', 'the engines that name these sections agree (s.156 here, ss.196 and 198 on the capital gains page)', N, async () => {
    const cg = '/india/india-capital-gains/';
    const a = R(cg, { asset: 'equity', months: 13 }).basis, b = R(cg, { asset: 'equity', months: 6 }).basis;
    return [/u\/s 198 of the 2025 Act \(was 112A\)/.test(a) && /u\/s 196 of the 2025 Act \(was 111A\)/.test(b) && /Rebate \(s\.156, formerly 87A\)/.test(src(IT)), a + ' | ' + b];
  });
  claim(IT, 'tip', 'The rebate does not apply to special-rate income such as capital gains under sections 196 and 198 of the 2025 Act (formerly 111A and 112A), so those remain taxable even below ₹12 lakh.', '₹10 lakh plus ₹1 lakh of 111A gains: the slab tax is rebated, the 20% on the gains is not', N, async () => {
    const r = it({ gross: 1000000, type: 'other', stcg: 100000 });
    return [r.newRebate === slabTax(1000000, NEW) && near(r.newTotal, 20000 * 1.04, 1e-9) && near(r.newGainsTax, 20000, 1e-9), r.newRebate + ', tax ' + r.newTotal];
  });
  /* surcharge relief by hand at each threshold, new regime, no deductions:
     on income T + x the tax and surcharge may exceed those on T by x at most */
  claim(IT, 'tip', 'and the same relief at each surcharge threshold: ₹50 lakh, ₹1 crore, ₹2 crore and ₹5 crore.', 'just above each threshold, both regimes', N, async () => {
    const bad = [];
    const slabT = (y, slabs) => slabTax(y, slabs);
    for (const [T, rNew, rOld] of [[5000000, 0, 0], [10000000, 0.10, 0.10], [20000000, 0.15, 0.15], [50000000, 0.25, 0.25]]) {
      const x = 1000;
      const capNew = (slabT(T, NEW) * (1 + rNew) + x) * 1.04, capOld = (slabT(T, OLD) * (1 + rOld) + x) * 1.04;
      const r = it({ gross: T + x, type: 'other', deductions: 0 });
      if (!near(r.newTotal, Math.min(capNew, slabT(T + x, NEW) * 1.04 * (1 + (T >= 50000000 ? 0.25 : T >= 20000000 ? 0.25 : T >= 10000000 ? 0.15 : 0.10))), 1e-6)) bad.push('new ' + T + ': ' + r.newTotal + ' vs ' + capNew);
      if (!near(r.oldTotal, Math.min(capOld, slabT(T + x, OLD) * 1.04 * (1 + (T >= 50000000 ? 0.37 : T >= 20000000 ? 0.25 : T >= 10000000 ? 0.15 : 0.10))), 1e-6)) bad.push('old ' + T + ': ' + r.oldTotal + ' vs ' + capOld);
    }
    return [!bad.length, bad.join('; ') || 'relief at ₹50 lakh, ₹1 crore, ₹2 crore and ₹5 crore'];
  });
  claim(IT, 'tip', 'Marginal relief stops a small rise above ₹12 lakh producing a disproportionate jump in tax. This calculator applies it', 'relief shown and applied', N, async () => {
    const r = it({ gross: 1250000, type: 'other' }); return [near(r.newRelief, slabTax(1250000, NEW) - 50000) && near(r.newTotal, 52000), 'relief ' + r.newRelief + ', tax ' + r.newTotal];
  });
  claim(IT, 'tip', 'The old regime only wins when your deductions are large. For a salaried taxpayer under 60 it takes about ₹5.5 lakh of 80C, 80D, HRA and home-loan interest combined on a ₹15 lakh salary, and about ₹7 lakh on ₹20 lakh.', 'the smallest deduction at which the old regime wins', N, async () => {
    const be = (g) => { let lo = 0, hi = g; while (hi - lo > 1000) { const m = Math.round((lo + hi) / 2); const r = it({ gross: g, deductions: m }); if (r.oldTotal < r.newTotal) hi = m; else lo = m; } return hi; };
    const a = be(1500000), b = be(2000000);
    return [a >= 525000 && a <= 575000 && b >= 675000 && b <= 725000, '₹15 lakh: ' + a + '; ₹20 lakh: ' + b];
  });
  manual(IT, 'faq', 'As a rough guide, the new regime wins for most people with modest deductions, while the old regime can still win for those with a home loan, substantial HRA and full 80C use.', 'general guidance; the tool compares the two on the figures entered');
  manual(IT, 'faq', 'It applies the published slab structure and common reliefs, but ignores many situation-specific provisions. The Income Tax Department publishes its own calculator', 'a statement about the scope of the tool and the department\'s own calculator');

  /* ================================================================ */
  const EMI = '/india/emi-calculator/';
  const emi = (o) => R(EMI, Object.assign({ amount: 2500000, rate: 9, years: 15, prepay: 0 }, o));
  const emiRef = (p, ann, yrs) => { const r = ann / 1200, n = yrs * 12; return p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1); };
  claim(EMI, 'lede', 'Equated monthly instalment for home, car or personal loans, with the full repayment schedule.', 'a row a year to a zero balance', N, async () => {
    const r = emi({}); const last = r._table.rows[r._table.rows.length - 1];
    return [r._table.rows.length === 15 && fmtR(last[3]) === '₹0' && r.months === 180, r._table.rows.length + ' rows, last balance ' + fmtR(last[3])];
  });
  claim(EMI, 'card', 'Equated monthly instalment for home, car or personal loans, with the full repayment schedule.', 'schedule principal adds up to the loan', N, async () => {
    const r = emi({ amount: 800000, rate: 10.5, years: 5 }); const sum = r._table.rows.reduce((s, x) => s + K.num(x[1]), 0);
    return [Math.abs(sum - 800000) <= 5, 'principal column sums to ' + sum];
  });
  claim(EMI, 'why', 'Enter loan, rate and tenure, add a prepayment. See interest saved.', 'a prepayment saves interest and months', N, async () => {
    const r = emi({ prepay: 5000 }); return [r.interestSaved > 0 && r.monthsSaved > 0 && near(r.interestSaved, emiRef(2500000, 9, 15) * 180 - 2500000 - r.totalInterest, 1e-6), Math.round(r.interestSaved) + ' saved, ' + r.monthsSaved + ' months'];
  });
  claim(EMI, 'what', 'Each one pays that month’s interest on the balance first; the rest reduces the principal.', 'year 1 interest = Σ balance × r', N, async () => {
    let b = 2500000, int = 0; const e = emiRef(2500000, 9, 15);
    for (let m = 0; m < 12; m++) { const i = b * 0.0075; int += i; b -= e - i; }
    const r = emi({}); return [Math.round(r._table.rows[0][2]) === Math.round(int), fmtR(r._table.rows[0][2]) + ' vs ' + Math.round(int)];
  });
  claim(EMI, 'what', 'early EMIs are mostly interest and later ones mostly principal, even though the amount never changes', 'year 1 vs year 15', N, async () => {
    const r = emi({}); const f = r._table.rows[0], l = r._table.rows[14];
    return [K.num(f[2]) > K.num(f[1]) && K.num(l[1]) > K.num(l[2]), 'year 1 ' + f[1] + ' / ' + f[2] + '; year 15 ' + l[1] + ' / ' + l[2]];
  });
  claim(EMI, 'works', 'The formula finds the one fixed payment that, with interest added every month, leaves exactly zero after the last instalment.', 'n instalments clear the loan', N, async () => {
    const r = emi({ amount: 1234567, rate: 7.35, years: 7 }); return [r.months === 84 && near(r.emi, emiRef(1234567, 7.35, 7), 1e-6), r.months + ' months'];
  });
  claim(EMI, 'works', 'EMI = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1)', 'the formula on several loans', N, async () => {
    const cases = [[500000, 12, 3], [4000000, 8.75, 25], [100000, 18, 1], [9000000, 6.5, 30]];
    const bad = cases.filter(([p, a, y]) => !near(emi({ amount: p, rate: a, years: y }).emi, emiRef(p, a, y), 1e-6));
    return [!bad.length, bad.length + ' mismatches'];
  });
  claim(EMI, 'works', 'r = annual rate ÷ 12 ÷ 100', 'first month\'s interest', N, async () => { const r = emi({ amount: 1200000, rate: 12, years: 1 }); const m = r._table.views[1].rows[0]; return [Math.round(r._table.rows[0][2]) === Math.round(emiRef(1200000, 12, 1) * 12 - 1200000) && near(m[2], 1200000 * 12 / 12 / 100, 1e-9), fmtR(r._table.rows[0][2]) + '; month 1 interest ' + m[2]]; });
  claim(EMI, 'works', 'the number of monthly instalments', 'n = years × 12, part years too', N, async () => { const a = emi({ years: 2.5 }), b = emi({ years: 20 }); return [a.months === 30 && b.months === 240, a.months + ', ' + b.months]; });
  claim(EMI, 'worked', 'Of the ₹3,04,280 paid in the first year, ₹2,21,647 goes on interest and only ₹82,633 reduces the loan.', 'the first-year split adds to twelve EMIs', N, async () => {
    const r = emi({}); const s = Math.round(r._table.rows[0][1]) + Math.round(r._table.rows[0][2]);
    return [s === 304280 && Math.abs(r.emi * 12 - 304280) < 10, s + ' (12 × EMI = ' + (r.emi * 12).toFixed(2) + ')'];
  });
  claim(EMI, 'use', 'Compare a 15-year and a 20-year term on both the instalment and the total interest before signing.', 'longer term, lower EMI, more interest', N, async () => {
    const a = emi({ years: 15 }), b = emi({ years: 20 }); return [b.emi < a.emi && b.totalInterest > a.totalInterest, [a.emi, b.emi, a.totalInterest, b.totalInterest].map(Math.round).join(', ')];
  });
  claim(EMI, 'use', 'Add a fixed extra sum each month and see how many months and how much interest it removes.', '₹2,000 a month on ₹25 lakh', N, async () => {
    const r = emi({ prepay: 2000 }); let b = 2500000, m = 0, int = 0; const pay = emiRef(2500000, 9, 15) + 2000;
    while (b > 0.5) { const i = b * 0.0075; int += i; b -= Math.min(b, pay - i); m++; }
    return [r.months === m && r.monthsSaved === 180 - m && near(r.totalInterest, int, 0.01), r.monthsSaved + ' months, ' + Math.round(r.interestSaved) + ' saved'];
  });
  claim(EMI, 'use', 'Confirm the EMI a bank quotes matches the rate and tenure written on the letter.', 'EMI from rate and tenure alone', N, async () => { const r = emi({ amount: 3500000, rate: 8.4, years: 18 }); return [near(r.emi, emiRef(3500000, 8.4, 18), 1e-6), Math.round(r.emi)]; });
  claim(EMI, 'mistake', 'A longer tenure lowers the instalment but raises the total interest, so compare the total repayment too.', 'total repayment rises with tenure', N, async () => {
    const t = [5, 10, 20, 30].map((y) => emi({ years: y })); return [t.every((x, i) => !i || (x.emi < t[i - 1].emi && x.totalPaid > t[i - 1].totalPaid)), t.map((x) => Math.round(x.totalPaid)).join(', ')];
  });
  claim(EMI, 'mistake', 'Some car and consumer loans advertise a flat rate charged on the original amount; the reducing-balance rate this calculator needs is noticeably higher.', 'a 10% flat rate over 5 years is about 17.6% reducing', N, async () => {
    const flatEmi = 500000 * (1 + 0.10 * 5) / 60;
    let lo = 10, hi = 30; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (emi({ amount: 500000, rate: m, years: 5 }).emi < flatEmi) lo = m; else hi = m; }
    return [lo > 15, '10% flat = ' + lo.toFixed(2) + '% reducing'];
  });
  claim(EMI, 'mistake', 'Ignoring processing fees and loan insurance: neither is in the EMI, but both add to the cost.', 'a fee leaves the EMI alone and raises the yearly cost', N, async () => {
    const a = emi({}), b = emi({ feePct: 1.18 });
    return [a.emi === b.emi && b.fee === 2500000 * 0.0118 && b.apr > (Math.pow(1.0075, 12) - 1) * 100, 'EMI ' + Math.round(b.emi) + ', cost ' + b.apr.toFixed(3) + '%'];
  });
  claim(EMI, 'dfaq', 'With the reducing-balance formula above, on the outstanding balance each month.', 'interest on the outstanding balance', N, async () => {
    const r = emi({ amount: 4000000, rate: 8.75, years: 25 }); return [near(r.emi, emiRef(4000000, 8.75, 25), 1e-6) && r.months === 300, Math.round(r.emi)];
  });
  manual(EMI, 'dfaq', 'When the lender’s benchmark rate moves, the bank either changes the EMI or, more often, keeps it and lengthens or shortens the tenure.', 'lender practice; the tool works one fixed rate');
  manual(EMI, 'dfaq', 'The lender adds a late fee and interest on the overdue sum, and reports the miss to credit bureaus such as CIBIL, which lowers your score.', 'lender practice, not the tool');
  claim(EMI, 'formula', 'EMI = P × r × (1+r)ⁿ / ((1+r)ⁿ − 1)', 'and P ÷ n at 0%', N, async () => {
    const z = emi({ amount: 120000, rate: 0, years: 1 }); return [z.emi === 10000 && z.totalInterest === 0 && near(emi({ amount: 300000, rate: 11, years: 4 }).emi, emiRef(300000, 11, 4), 1e-6), 'at 0%: ' + z.emi];
  });
  claim(EMI, 'tip', 'On a 20-year home loan at 8.5%, total interest is close to the principal itself.', 'interest within 10% of the loan', N, async () => { const r = emi({ amount: 5000000, rate: 8.5, years: 20 }); return [r.interestRatio > 95 && r.interestRatio < 110, r.interestRatio.toFixed(2) + '% of principal']; });
  claim(EMI, 'tip', 'Tenure matters far more than a small rate difference.', '+5 years costs more than +0.5%', N, async () => {
    const base = emi({ amount: 5000000, rate: 8.5, years: 20 }), longer = emi({ amount: 5000000, rate: 8.5, years: 25 }), dearer = emi({ amount: 5000000, rate: 9, years: 20 });
    return [longer.totalInterest - base.totalInterest > 2 * (dearer.totalInterest - base.totalInterest), 'tenure +5y: +' + Math.round(longer.totalInterest - base.totalInterest) + '; rate +0.5%: +' + Math.round(dearer.totalInterest - base.totalInterest)];
  });
  claim(EMI, 'tip', 'Prepayments made in the early years remove the most interest, because the outstanding balance is highest then.', 'the balance falls every year, so year 1 carries the most interest', N, async () => {
    const r = emi({}); const bal = r._table.rows.map((x) => K.num(x[3])), int = r._table.rows.map((x) => K.num(x[2]));
    return [bal.every((b, i) => !i || b < bal[i - 1]) && int.every((v, i) => !i || v < int[i - 1]), 'interest by year ' + int.slice(0, 4).join(', ') + ' …'];
  });
  manual(EMI, 'tip', 'Floating-rate home loans to individuals cannot carry a prepayment penalty in India. Fixed-rate loans can.', 'RBI rule, not something the tool works out');
  manual(EMI, 'tip', 'Under the old regime, home loan interest up to ₹2 lakh a year is deductible on a self-occupied property — section 22 of the Income-tax Act, 2025, formerly section 24(b). The new regime does not allow it.', 'statement of law; no engine holds this limit or section number (the EMI tool does not work out tax)');
  claim(EMI, 'faq', 'Most banks default to keeping the EMI and cutting the tenure', 'the tool\'s prepayment keeps the EMI and cuts the tenure', N, async () => {
    const a = emi({}), b = emi({ prepay: 3000 }); return [a.emi === b.emi && b.months < a.months, 'EMI ' + Math.round(a.emi) + ' both; months ' + a.months + ' → ' + b.months];
  });
  manual(EMI, 'faq', 'Reducing the tenure saves considerably more interest. Reducing the EMI improves monthly cash flow.', 'the tool models only the keep-the-EMI option, so the comparison is general loan arithmetic, not a tool result');

  /* ================================================================ */
  const EPF = '/india/epf-calculator/';
  const epf = (o) => R(EPF, Object.assign({ basic: 25000, age: 35, retire: 58, rate: 8.25, growth: 6, existing: 0 }, o));
  claim(EPF, 'lede', 'Employees’ Provident Fund corpus at retirement, including the employer’s split into EPF and EPS.', 'employer 12% = EPF part + EPS part', N, async () => {
    const r = epf({ basic: 40000, age: 57, growth: 0 }); return [near(r.employerEPF + r.epsTotal, 40000 * 0.12 * 12, 1e-6) && near(r.epsTotal, 1249.5 * 12, 1e-6), r.employerEPF + ' + ' + r.epsTotal];
  });
  claim(EPF, 'card', 'Employees’ Provident Fund corpus at retirement, including the employer’s split into EPF and EPS.', 'the split on a small basic', N, async () => {
    const r = epf({ basic: 12000, age: 57, growth: 0 }); return [near(r.epsTotal, 999.6 * 12, 1e-6) && near(r.employerEPF, 440.4 * 12, 1e-6), r.employerEPF + ' + ' + r.epsTotal];
  });
  claim(EPF, 'why', 'Enter basic, age and growth. See your corpus and the EPS split.', 'corpus, EPS and years from age and retirement', N, async () => { const r = epf({ age: 30, retire: 58 }); return [r.years === 28 && r.corpus > 0 && r.epsTotal > 0, r.years + ' years']; });
  claim(EPF, 'why', 'Twelve per cent leaves every payslip.', 'employee share 12% of basic', N, async () => { const r = epf({ basic: 33333, age: 57, growth: 0 }); return [near(r.employeeTotal, 33333 * 0.12 * 12, 1e-6), r.employeeTotal]; });
  claim(EPF, 'what', 'You and your employer each pay 12% of basic pay plus dearness allowance into it every month', 'both shares 12%', N, async () => { const r = epf({ basic: 50000, age: 57, growth: 0 }); return [near(r.employeeTotal, 72000, 1e-6) && near(r.employerEPF + r.epsTotal, 72000, 1e-6), r.employeeTotal + ', ' + (r.employerEPF + r.epsTotal)]; });
  claim(EPF, 'what', 'Not all of the employer’s share stays in EPF: part funds the Employees’ Pension Scheme, so the balance you can withdraw grows more slowly than 24% of basic would suggest.', 'EPF credits below 24% of basic', N, async () => { const r = epf({ basic: 20000, age: 57, growth: 0 }); return [r.employeeTotal + r.employerEPF < 20000 * 0.24 * 12, (r.employeeTotal + r.employerEPF) + ' < ' + 20000 * 0.24 * 12]; });
  claim(EPF, 'works', 'Each month the tool adds your 12% and the employer’s 12% less the EPS share, then grows the balance by one twelfth of the annual rate.', 'one year by hand', N, async () => {
    let b = 0; for (let m = 0; m < 12; m++) b = (b + 3000 + 3000 - 1249.5) * (1 + 0.0825 / 12);
    const r = epf({ age: 57, growth: 0 }); return [near(r.corpus, b, 1e-6), r.corpus + ' vs ' + b];
  });
  claim(EPF, 'works', 'Basic rises by the growth rate once a year, at the start of each new year of service.', 'monthly basic column', N, async () => {
    const r = epf({ basic: 20000, age: 55, growth: 10 }); const b = r._table.rows.map((x) => x[1]);
    return [j(b) === j(['₹20,000', '₹22,000', '₹24,200']), b.join(', ')];
  });
  claim(EPF, 'works', 'EPS = 8.33% × lower of basic and ₹15,000', 'either side of ₹15,000', N, async () => {
    const e = (b) => epf({ basic: b, age: 57, growth: 0 }).epsTotal / 12;
    return [near(e(14999), 14999 * 0.0833, 1e-6) && near(e(15000), 1249.5, 1e-6) && near(e(15001), 1249.5, 1e-6), [e(14999), e(15000), e(15001)].join(', ')];
  });
  claim(EPF, 'works', 'monthly credit = 12% × basic + (12% × basic − EPS)', 'credit', N, async () => { const r = epf({ basic: 30000, age: 57, growth: 0, rate: 0 }); return [near(r.corpus, 12 * (3600 + 3600 - 1249.5), 1e-6), r.corpus]; });
  claim(EPF, 'works', 'balance = (balance + monthly credit) × (1 + rate ÷ 12)', 'an existing balance grows month by month', N, async () => { const r = epf({ basic: 0, existing: 100000, age: 48, retire: 58 }); return [near(r.corpus, 100000 * Math.pow(1 + 0.0825 / 12, 120), 1e-6), r.corpus]; });
  claim(EPF, 'works', 'the employer’s monthly pension contribution, at most ₹1,249.50', 'EPS never above ₹1,249.50', N, async () => { const r = epf({ basic: 500000, age: 57, growth: 0 }); return [near(r.epsTotal / 12, 1249.5, 1e-9), r.epsTotal / 12]; });
  claim(EPF, 'worked', 'In the first month ₹3,000 comes from their pay, ₹1,249.50 of the employer’s share goes to EPS and ₹1,750.50 reaches EPF.', 'month one', N, async () => {
    const r = epf({ age: 57, growth: 6 }); return [near(r.employeeTotal / 12, 3000) && near(r.epsTotal / 12, 1249.5) && near(r.employerEPF / 12, 1750.5), [r.employeeTotal / 12, r.epsTotal / 12, r.employerEPF / 12].join(', ')];
  });
  claim(EPF, 'worked', 'A 35-year-old on ₹25,000 basic, with ₹3,00,000 already in EPF, 6% yearly rises and 8.25% interest, has 23 years to go.', 'years to 58', N, async () => { const r = epf({ existing: 300000 }); return [r.years === 23, r.years]; });
  claim(EPF, 'use', 'Re-run at 7.5% or 8% to see how sensitive the corpus is to EPFO’s yearly declaration.', 'lower rate, lower corpus, same contributions', N, async () => {
    const a = epf({ rate: 8.25 }), b = epf({ rate: 8 }), c = epf({ rate: 7.5 }); return [a.corpus > b.corpus && b.corpus > c.corpus && a.employeeTotal === c.employeeTotal, [a.corpus, b.corpus, c.corpus].map(Math.round).join(', ')];
  });
  claim(EPF, 'use', 'Compare the balance today with what it becomes if left until retirement.', 'the existing balance compounds to retirement', N, async () => {
    const a = epf({ existing: 0 }), b = epf({ existing: 500000 }); return [near(b.corpus - a.corpus, 500000 * Math.pow(1 + 0.0825 / 12, 23 * 12), 0.01), Math.round(b.corpus - a.corpus)];
  });
  claim(EPF, 'mistake', 'Contributions are worked on basic and DA only, so a gross figure inflates every line of the projection.', 'a larger figure raises every line', N, async () => {
    const a = epf({ basic: 25000 }), b = epf({ basic: 50000 }); return [['corpus', 'employeeTotal', 'employerEPF', 'interest'].every((k) => b[k] > a[k]) && near(b.employeeTotal, 2 * a.employeeTotal, 1e-6), 'employee ' + a.employeeTotal + ' → ' + b.employeeTotal];
  });
  claim(EPF, 'mistake', 'A sum 23 years away buys far less than the same sum now, so compare it with a retirement target that also allows for inflation.', 'the corpus is in future rupees (no inflation input)', N, async () => [!keys(EPF).some((k) => /infl/i.test(k)), keys(EPF).join(', ')]);
  claim(EPF, 'dfaq', 'Only 3.67% of basic, ₹440.40 a month, because 8.33% (₹999.60) goes to EPS.', '₹12,000 basic', N, async () => { const r = epf({ basic: 12000, age: 57, growth: 0 }); return [near(r.employerEPF / 12, 440.4) && near(r.epsTotal / 12, 999.6), (r.employerEPF / 12) + ', ' + (r.epsTotal / 12)]; });
  claim(EPF, 'dfaq', 'Only the first two earn EPF interest and make up the balance you can withdraw.', 'EPS is outside the corpus and earns nothing', N, async () => {
    const r = epf({ basic: 15000, age: 57, growth: 0, rate: 0 }); return [near(r.corpus, r.employeeTotal + r.employerEPF, 1e-6) && r.interest === 0 && r.epsTotal > 0, r.corpus + ' = ' + r.employeeTotal + ' + ' + r.employerEPF];
  });
  claim(EPF, 'formula', 'employee 12% of basic; employer 12% split 8.33% to EPS (capped) and the rest to EPF', 'below and above the cap', N, async () => {
    const a = epf({ basic: 10000, age: 57, growth: 0 }), b = epf({ basic: 60000, age: 57, growth: 0 });
    return [near(a.epsTotal / 12, 833) && near(a.employerEPF / 12, 367) && near(b.epsTotal / 12, 1249.5) && near(b.employerEPF / 12, 7200 - 1249.5), [a.epsTotal / 12, a.employerEPF / 12, b.epsTotal / 12, b.employerEPF / 12].join(', ')];
  });
  claim(EPF, 'tip', 'EPS is capped at a ₹15,000 pensionable salary, so above that the whole excess flows to EPF.', '₹1 more basic, 12 paise more to EPF', N, async () => {
    const a = epf({ basic: 20000, age: 57, growth: 0 }), b = epf({ basic: 20001, age: 57, growth: 0 }); return [near((b.employerEPF - a.employerEPF) / 12, 0.12, 1e-9) && a.epsTotal === b.epsTotal, ((b.employerEPF - a.employerEPF) / 12).toFixed(4)];
  });
  manual(EPF, 'tip', 'The EPF rate is declared annually by EPFO and has drifted down over the years. A projection to retirement is indicative, not a quotation.', 'about EPFO\'s declarations; the tool holds whatever rate is entered for every year');
  manual(EPF, 'tip', 'Withdrawal is tax-free after five years of continuous service. Withdrawing earlier makes it taxable and may attract TDS.', 'statement of law; the tool does not work out tax');
  manual(EPF, 'tip', 'Voluntary Provident Fund lets you contribute more than 12% at the same rate, though interest on contributions above ₹2.5 lakh a year is taxable.', 'statement of law; the tool has no VPF input');
  manual(EPF, 'faq', 'It funds a monthly pension after 58, subject to at least ten years of eligible service.', 'EPS scheme rules; the tool shows only what is diverted to EPS');

  /* ================================================================ */
  const FD = '/india/fd-rd-calculator/';
  const fd = (o) => R(FD, Object.assign({ type: 'fd', amount: 100000, rate: 7, years: 1, slabRate: 30 }, o));
  const fdRef = (p, r, t) => p * Math.pow(1 + r / 400, 4 * t);
  const rdRef = (p, r, t) => { const n = Math.round(t * 12); let s = 0; for (let m = 0; m < n; m++) s += p * Math.pow(1 + r / 400, 4 * (n - m) / 12); return s; };
  claim(FD, 'lede', 'Fixed and recurring deposit maturity with quarterly compounding, and what is left after tax at your slab rate.', 'quarterly, not yearly or monthly; after tax = maturity − slab × interest', N, async () => {
    const r = fd({ slabRate: 20 });
    return [near(r.maturity, fdRef(100000, 7, 1), 1e-6) && Math.round(r.maturity) === 107186 && near(r.afterTax, r.maturity - 0.2 * r.interest, 1e-6), Math.round(r.maturity) + ', after tax ' + Math.round(r.afterTax)];
  });
  claim(FD, 'card', 'Fixed and recurring deposit maturity with quarterly compounding, and what is left after tax at your slab rate.', 'an RD the same way', N, async () => {
    const r = fd({ type: 'rd', amount: 5000, rate: 6.8, years: 2, slabRate: 10 });
    return [near(r.maturity, rdRef(5000, 6.8, 2), 1e-6) && near(r.afterTax, r.maturity - 0.1 * r.interest, 1e-6), Math.round(r.maturity) + ', after tax ' + Math.round(r.afterTax)];
  });
  claim(FD, 'why', 'Enter deposit, rate and slab. See maturity before and after tax.', 'the slab moves only the after-tax figure', N, async () => {
    const a = fd({ slabRate: 0 }), b = fd({ slabRate: 30 });
    return [a.maturity === b.maturity && a.afterTax === a.maturity && b.afterTax < b.maturity, Math.round(b.maturity) + ' / ' + Math.round(b.afterTax)];
  });
  claim(FD, 'why', 'The bank quotes 7%. After tax at your slab, the FD earns a lot less', '7% in the 30% slab', N, async () => { const r = fd({ years: 3 }); return [r.effectiveRate < 5.5, r.effectiveRate.toFixed(3) + '%']; });
  claim(FD, 'what', 'A recurring deposit (RD) takes the same sum every month, each instalment earning that starting rate until maturity.', 'RD = Σ instalments compounded to maturity', N, async () => {
    const r = fd({ type: 'rd', amount: 10000, rate: 7.25, years: 3 }); return [near(r.maturity, rdRef(10000, 7.25, 3), 1e-6) && r.invested === 360000, Math.round(r.maturity)];
  });
  claim(FD, 'what', 'Both are quoted as a yearly rate, but interest is added quarterly and taxed at your slab rate, so the headline figure is neither what the deposit grows at nor what you keep.', '7% grows at 7.186% and keeps 5.03% at 30%', N, async () => {
    const a = fd({ slabRate: 0 }), b = fd({ slabRate: 30 }); return [a.effectiveRate > 7 && b.effectiveRate < 7, a.effectiveRate.toFixed(3) + '%, ' + b.effectiveRate.toFixed(3) + '%'];
  });
  claim(FD, 'works', 'An FD compounds the whole deposit four times a year for the full term. An RD treats each instalment as a small FD running from its own date to maturity. Tax is your slab rate on all the interest.', 'FD, RD and tax on several inputs', N, async () => {
    const bad = [];
    for (const [p, r, t, s] of [[250000, 6.5, 2.5, 20], [1000000, 7.75, 10, 30], [5000, 5, 0.25, 5]]) {
      const f = fd({ amount: p, rate: r, years: t, slabRate: s }), d = fd({ type: 'rd', amount: p / 100, rate: r, years: t, slabRate: s });
      if (!near(f.maturity, fdRef(p, r, t), 1e-6) || !near(d.maturity, rdRef(p / 100, r, t), 1e-6) || !near(f.tax, f.interest * s / 100, 1e-6)) bad.push(p + '/' + r + '/' + t);
    }
    return [!bad.length, bad.join(', ') || 'all match'];
  });
  claim(FD, 'works', 'FD maturity = P × (1 + r ÷ 4)^(4t)', 'FD', N, async () => { const r = fd({ amount: 300000, rate: 8, years: 3 }); return [near(r.maturity, 300000 * Math.pow(1.02, 12), 1e-6), r.maturity]; });
  claim(FD, 'works', 'RD maturity = Σ R × (1 + r ÷ 4)^(4 × (n − m) ÷ 12), for m = 0 … n − 1', 'RD of one instalment: one month of interest', N, async () => {
    const r = fd({ type: 'rd', amount: 1000, rate: 12, years: 1 / 12 }); return [r.invested === 1000 && near(r.maturity, 1000 * Math.pow(1.03, 1 / 3), 1e-9), r.maturity];
  });
  claim(FD, 'works', 'after-tax maturity = maturity − slab rate × interest', 'after tax', N, async () => { const r = fd({ amount: 400000, rate: 7.1, years: 4, slabRate: 20 }); return [near(r.afterTax, r.maturity - 0.2 * (r.maturity - 400000), 1e-6), r.afterTax]; });
  claim(FD, 'works', 'the number of monthly instalments, t × 12', 'RD deposits', N, async () => { const r = fd({ type: 'rd', amount: 2500, years: 2.5 }); return [r.invested === 75000, r.invested]; });
  claim(FD, 'worked', 'Thirty-six instalments add up to ₹3,60,000', 'three years of ₹10,000', N, async () => { const r = fd({ type: 'rd', amount: 10000, rate: 7.25, years: 3, slabRate: 20 }); return [r.invested === 360000, r.invested]; });
  claim(FD, 'use', 'Put the post-tax annualised return next to a fund’s expected return before deciding where idle cash goes.', 'the return is a yearly rate on after-tax maturity', N, async () => {
    const r = fd({ amount: 500000, rate: 7, years: 5, slabRate: 20 }); return [near(r.effectiveRate, (Math.pow(r.afterTax / 500000, 1 / 5) - 1) * 100, 1e-9) && output(FD, 'effectiveRate').label === 'Post-tax annualised return', r.effectiveRate.toFixed(3) + '%'];
  });
  claim(FD, 'use', 'Run an RD to see what a fixed monthly sum reaches by a target date, such as a school fee due in three years.', 'RD option, monthly amount', N, async () => { const r = fd({ type: 'rd', amount: 8000, years: 3 }); return [optVals(FD, 'type').join() === 'fd,rd' && r.invested === 288000 && r.maturity > 288000, Math.round(r.maturity)]; });
  claim(FD, 'use', 'Try one, three and five years at the rate the bank offers for each and compare the after-tax maturity.', 'tenure and rate per run', N, async () => {
    const t = [[1, 6.8], [3, 7.1], [5, 7.0]].map(([y, r]) => fd({ amount: 100000, years: y, rate: r }).afterTax); return [t[0] < t[1] && t[1] < t[2], t.map(Math.round).join(', ')];
  });
  claim(FD, 'mistake', 'It treats the whole ₹3,60,000 as deposited on day one, so the RD above shows 3.085%; compare RDs with each other on it, not with an FD.', 'RD return measured on the whole sum from day one', N, async () => {
    const r = fd({ type: 'rd', amount: 10000, rate: 7.25, years: 3, slabRate: 20 }); return [near(r.effectiveRate, (Math.pow(r.afterTax / 360000, 1 / 3) - 1) * 100, 1e-9), r.effectiveRate.toFixed(3) + '%'];
  });
  claim(FD, 'mistake', 'A deposit that pays its interest out every quarter does not compound, so its maturity is just the principal; this calculator is for cumulative deposits.', 'no payout option: interest always compounds', N, async () => {
    const r = fd({ amount: 100000, rate: 8, years: 2 }); return [optVals(FD, 'type').join() === 'fd,rd' && r.maturity > 100000 * (1 + 0.08 * 2), Math.round(r.maturity) + ' (simple would be 116000)'];
  });
  manual(FD, 'dfaq', 'Banks sometimes advertise this higher figure next to the quoted rate.', 'bank practice, not the tool');
  manual(FD, 'dfaq', 'Normally as it accrues, so each year’s accrued interest goes in that year’s return even though the money arrives only at maturity.', 'statement of tax law; the tool shows the tax on the whole interest without timing it');
  claim(FD, 'formula', 'FD: A = P(1 + r/4)^(4t) · RD compounds each instalment quarterly', 'the formula, including part years', N, async () => { const r = fd({ amount: 75000, rate: 6, years: 1.75 }); return [near(r.maturity, 75000 * Math.pow(1.015, 7), 1e-6), r.maturity]; });
  claim(FD, 'tip', 'FD interest is fully taxable at your slab rate, which is why a 7% FD returns only about 5% a year after tax for someone in the 30% bracket.', '1 to 5 years at 7%, 30% slab', N, async () => {
    const v = [1, 2, 3, 4, 5].map((y) => fd({ years: y }).effectiveRate); return [v.every((x) => x > 4.75 && x < 5.25), v.map((x) => x.toFixed(3) + '%').join(', ')];
  });
  claim(FD, 'tip', 'Banks deduct TDS once interest exceeds the annual threshold, but TDS is not the final tax — the balance is still due at your slab rate.', 'the tax shown is slab rate on all interest, however small (no TDS step)', N, async () => {
    const r = fd({ amount: 1000, rate: 7, years: 1, slabRate: 30 }); return [near(r.tax, 0.3 * r.interest, 1e-9) && r.tax > 0 && !keys(FD).some((k) => /tds/i.test(k)), r.tax.toFixed(2) + ' on ' + r.interest.toFixed(2)];
  });
  claim(FD, 'tip', 'Most banks compound quarterly, which is what this uses.', 'quarterly, not monthly', N, async () => { const r = fd({ amount: 100000, rate: 12, years: 1 }); return [near(r.maturity, 100000 * Math.pow(1.03, 4), 1e-6), r.maturity]; });
  manual(FD, 'tip', 'Breaking an FD early usually costs a penalty of 0.5% to 1% on the applicable rate.', 'bank practice; the tool has no premature-closure option');
  claim(FD, 'faq', 'The first earns interest for the full term, the last for barely a month, so the average holding period is roughly half the tenure.', 'RD interest about half an FD\'s on the same total', N, async () => {
    const rd = fd({ type: 'rd', amount: 10000, rate: 7.25, years: 3 }), f = fd({ amount: 360000, rate: 7.25, years: 3 });
    const q = rd.interest / f.interest; return [q > 0.45 && q < 0.55, q.toFixed(3)];
  });

  /* ================================================================ */
  const GR = '/india/gratuity-calculator/';
  const gr = (o) => R(GR, Object.assign({ salary: 60000, years: 10, covered: 'yes' }, o));
  claim(GR, 'lede', 'Gratuity payable under the Code on Social Security, 2020 — which replaced the Payment of Gratuity Act, 1972 from 21 November 2025 with the same formula — and the tax-exempt portion.', '15/26 formula and the exempt part; the engine cites the Code in force 21 November 2025', N, async () => {
    const r = gr({ salary: 260000, years: 20 });
    return [near(r.gratuity, 3000000) && r.exempt === 2000000 && near(r.taxable, 1000000) && /came into force on 21 November\s+2025/.test(src(GR)) && /repeals the Payment of Gratuity Act, 1972/.test(src(GR)), r.gratuity + ' = ' + r.exempt + ' + ' + r.taxable];
  });
  claim(GR, 'card', 'Gratuity payable under the Code on Social Security, 2020 — which replaced the Payment of Gratuity Act, 1972', 'the formula', N, async () => { const r = gr({ salary: 52000, years: 8 }); return [near(r.gratuity, 52000 * 15 / 26 * 8), r.gratuity]; });
  claim(GR, 'why', 'Enter last basic + DA and years. Get gratuity and the tax-free part.', 'gratuity and exempt portion', N, async () => { const r = gr({ salary: 50000, years: 7 }); return [near(r.gratuity, 50000 * 15 / 26 * 7) && r.exempt === r.gratuity, r.gratuity]; });
  claim(GR, 'why', 'Gratuity is 15/26 of basic for each year', '15/26 a year', N, async () => { const r = gr({ salary: 26000, years: 6 }); return [near(r.gratuity, 90000), r.gratuity]; });
  claim(GR, 'what', 'It is owed by employers with ten or more employees, normally after five years of continuous service, or one year on a fixed-term contract', 'five years either side; the fixed-term rule is stated with the result', N, async () => {
    const a = gr({ years: 4.99 }), b = gr({ years: 5 });
    return [a.gratuity === 0 && /fixed-term employee qualifies after one year/.test(a.eligibility) && b.gratuity > 0 && /^Eligible/.test(b.eligibility) && /10\+ employees/.test(input(GR, 'covered').options[0].label), a.eligibility];
  });
  manual(GR, 'what', 'The employer funds it, often through a group gratuity policy, so no employee contribution comes out of your pay.', 'how gratuity is funded; not something the tool works out');
  claim(GR, 'works', 'For a covered employer the tool pays 15 days’ wages for each year, valuing a day at one twenty-sixth of monthly basic plus DA. Where the employer is not covered, it uses half a month’s salary for each year and counts only completed years.', 'covered rounds a part year over six months; not covered counts whole years', N, async () => {
    const a = gr({ salary: 40000, years: 8.9, covered: 'yes' }), b = gr({ salary: 40000, years: 8.9, covered: 'no' });
    return [a.yearsCounted === 9 && near(a.gratuity, 40000 / 26 * 15 * 9) && b.yearsCounted === 8 && near(b.gratuity, 40000 / 2 * 8), a.gratuity + ', ' + b.gratuity];
  });
  claim(GR, 'works', 'covered: gratuity = (basic + DA) × 15 ÷ 26 × years', 'covered', N, async () => { const r = gr({ salary: 75000, years: 12 }); return [near(r.gratuity, 75000 * 15 / 26 * 12), r.gratuity]; });
  claim(GR, 'works', 'not covered: gratuity = (basic + DA) × 15 ÷ 30 × completed years', 'not covered', N, async () => { const r = gr({ salary: 75000, years: 12.7, covered: 'no' }); return [near(r.gratuity, 75000 * 0.5 * 12), r.gratuity]; });
  claim(GR, 'works', 'tax-free = lower of gratuity and ₹20,00,000', 'the ₹20 lakh limit either side', N, async () => {
    /* a gratuity of exactly ₹20 lakh, and one a rupee a month of salary above it */
    const c = gr({ salary: 2000000 * 26 / 15 / 10, years: 10 }), d = gr({ salary: 2000000 * 26 / 15 / 10 + 1, years: 10 });
    return [near(c.exempt, 2000000, 1e-6) && c.taxable < 1e-6 && d.exempt === 2000000 && d.taxable > 0, [c.gratuity, c.exempt, d.gratuity, d.exempt, d.taxable].map((x) => x.toFixed(2)).join(', ')];
  });
  claim(GR, 'works', 'continuous service, where a final part-year of more than six months counts as a year', 'exactly six months does not count', N, async () => {
    const a = gr({ years: 10.5 }), b = gr({ years: 10.51 }); return [a.yearsCounted === 10 && b.yearsCounted === 11, a.yearsCounted + ', ' + b.yearsCounted];
  });
  claim(GR, 'worked', 'has 13 years counted, because the final part-year is over six months', '12.6 → 13, 12.4 → 12', N, async () => { const a = gr({ salary: 85000, years: 12.6 }), b = gr({ salary: 85000, years: 12.4 }); return [a.yearsCounted === 13 && b.yearsCounted === 12 && Math.round(a.gratuity - b.gratuity) === 49038, a.yearsCounted + ', ' + b.yearsCounted + '; difference ' + Math.round(a.gratuity - b.gratuity)]; });
  claim(GR, 'use', 'Compare the gratuity line in HR’s statement with your own figure before signing it.', 'years counted shown with the figure', N, async () => { const r = gr({ years: 9.6 }); return [r.yearsCounted === 10 && output(GR, 'yearsCounted').label === 'Years counted', r.yearsCounted]; });
  claim(GR, 'use', 'See whether a few more weeks of service take the final part-year past six months.', 'a few weeks over six months add a year', N, async () => {
    const a = gr({ years: 7 + 25 / 52 }), b = gr({ years: 7 + 28 / 52 }); return [b.yearsCounted - a.yearsCounted === 1 && near(b.gratuity - a.gratuity, 60000 * 15 / 26), a.yearsCounted + ' → ' + b.yearsCounted];
  });
  claim(GR, 'use', 'Estimate the liability for a long-serving employee at today’s salary.', 'linear in salary', N, async () => { const a = gr({ salary: 40000, years: 25 }), b = gr({ salary: 80000, years: 25 }); return [near(b.gratuity, 2 * a.gratuity), a.gratuity + ', ' + b.gratuity]; });
  claim(GR, 'mistake', 'Gratuity runs on the last drawn basic plus DA, so every increment during service raises the whole amount.', 'last salary × all years', N, async () => {
    const a = gr({ salary: 50000, years: 20 }), b = gr({ salary: 55000, years: 20 }); return [near(b.gratuity - a.gratuity, 5000 * 15 / 26 * 20) && /Last drawn/.test(input(GR, 'salary').label), (b.gratuity - a.gratuity).toFixed(2)];
  });
  claim(GR, 'mistake', 'the "No" option applies it to the salary you enter', 'half a month a completed year on the salary entered', N, async () => { const r = gr({ salary: 48000, years: 10.9, covered: 'no' }); return [near(r.gratuity, 24000 * 10) && r.exempt === r.gratuity, r.gratuity]; });
  claim(GR, 'dfaq', 'For FY 2026-27 the tool treats gratuity up to ₹20 lakh as exempt and the excess as salary taxed at your slab rate.', 'the excess is the taxable portion', N, async () => { const r = gr({ salary: 300000, years: 25 }); return [r.exempt === 2000000 && near(r.taxable, r.gratuity - 2000000), r.exempt + ' + ' + r.taxable]; });
  manual(GR, 'dfaq', 'Government employees’ gratuity is fully exempt.', 'statement of law; the tool has no government-employee option and applies the ₹20 lakh limit');
  claim(GR, 'dfaq', 'About 5.77 months of last basic plus DA, since 15 × 10 ÷ 26 is 150 ÷ 26.', 'ten years = 5.77 months', N, async () => { const r = gr({ salary: 1, years: 10 }); return [r.gratuity.toFixed(2) === '5.77', r.gratuity]; });
  claim(GR, 'dfaq', 'Choose "No" and the tool pays half a month’s salary for each completed year.', 'not covered', N, async () => { const r = gr({ salary: 40000, years: 8.9, covered: 'no' }); return [r.gratuity === 160000 && r.yearsCounted === 8, r.gratuity]; });
  claim(GR, 'formula', 'gratuity = last drawn salary × 15/26 × years of service', 'several inputs', N, async () => {
    const bad = [[30000, 5], [45000, 17], [123456, 33]].filter(([s, y]) => !near(gr({ salary: s, years: y }).gratuity, s * 15 / 26 * y, 1e-6)); return [!bad.length, bad.length + ' mismatches'];
  });
  claim(GR, 'tip', 'The 15/26 factor treats a month as 26 working days and pays 15 days’ wages for each completed year of service.', 'a day = salary ÷ 26', N, async () => { const r = gr({ salary: 52000, years: 5 }); return [near(r.gratuity, 2000 * 15 * 5), r.gratuity]; });
  claim(GR, 'tip', 'Service beyond six months in the final year rounds up to a full year. Six months or less is ignored.', '6.5 → 6, 6.6 → 7, 6.3 → 6', N, async () => { const v = [6.3, 6.5, 6.6].map((y) => gr({ years: y }).yearsCounted); return [j(v) === j([6, 6, 7]), v.join(', ')]; });
  claim(GR, 'tip', 'The lifetime tax exemption is ₹20 lakh', 'cap', N, async () => { const r = gr({ salary: 500000, years: 30 }); return [r.exempt === 2000000, r.exempt]; });
  manual(GR, 'tip', 'aggregated across all employers, not per job', 'statement of law; the tool sees one employer\'s gratuity, so it cannot apply an exemption already used');
  claim(GR, 'tip', 'The five-year condition is waived where service ends because of death or disablement. Since 21 November 2025 a fixed-term employee qualifies after one year of service, paid pro rata.', 'the result says so under five years; the engine cites the Code from that date', N, async () => {
    const r = gr({ years: 3 }); return [r.gratuity === 0 && /except on death or disablement/.test(r.eligibility) && /fixed-term employee qualifies after one year, pro rata/.test(r.eligibility) && /21 November\s+2025/.test(src(GR)), r.eligibility];
  });
  manual(GR, 'tip', 'Since the Code on Social Security took effect, "wages" for gratuity are basic pay, DA and retaining allowance — but if the excluded allowances come to more than half of total pay, the excess is added back to wages, which can raise the gratuity.', 'statement of law (the Code\'s definition of wages); the tool takes the wage figure as entered');
  claim(GR, 'faq', 'It uses last drawn basic pay plus dearness allowance, not CTC and not including bonuses or allowances such as HRA.', 'one salary input, basic + DA', N, async () => [j(keys(GR)) === j(['salary', 'years', 'covered']) && input(GR, 'salary').label === 'Last drawn monthly basic + DA', input(GR, 'salary').label]);

  /* ================================================================ */
  const GST = '/india/gst-calculator/';
  const gst = (o) => R(GST, Object.assign({ amount: 10000, mode: 'exclusive', rate: 18, supply: 'intra', qty: 1 }, o));
  claim(GST, 'lede', 'Add or remove GST at current 2026 slabs, with the CGST, SGST and IGST split for your invoice.', 'add, remove and split', N, async () => {
    const a = gst({}), b = gst({ amount: 11800, mode: 'inclusive', supply: 'inter' });
    return [a.total === 11800 && a.cgst === 900 && a.sgst === 900 && a.igst === 0 && near(b.base, 10000, 1e-9) && near(b.igst, 1800, 1e-9) && b.cgst === 0, a.splitLabel + ' | ' + b.splitLabel];
  });
  const slabVals = () => optVals(GST, 'rate').filter((v) => v !== 'custom');
  claim(GST, 'card', 'Add or remove GST at current 2026 slabs, with the CGST, SGST and IGST split for your invoice.', 'the six GST 2.0 slabs, then any other rate', N, async () => [slabVals().join() === '0,0.25,3,5,18,40' && optVals(GST, 'rate').slice(-1)[0] === 'custom', optVals(GST, 'rate').join(', ')]);
  claim(GST, 'why', 'Type the amount and rate. Get taxable value, CGST, SGST or IGST.', 'intra gives CGST + SGST, inter gives IGST', N, async () => {
    const a = gst({ rate: 5 }), b = gst({ rate: 5, supply: 'inter' }); return [a.cgst === 250 && a.sgst === 250 && a.igst === 0 && b.igst === 500 && b.cgst === 0 && a.base === 10000, a.splitLabel + ' | ' + b.splitLabel];
  });
  claim(GST, 'why', 'and 18% off is wrong', '₹11,800 inclusive is ₹10,000 taxable, not ₹9,676', N, async () => { const r = gst({ amount: 11800, mode: 'inclusive' }); return [near(r.base, 10000, 1e-9) && Math.round(11800 * 0.82) !== 10000, r.base]; });
  claim(GST, 'what', 'The seller adds it to the taxable value, collects it from the buyer', 'total = taxable value + GST', N, async () => { const r = gst({ amount: 2500, rate: 3 }); return [r.total === 2575, r.total]; });
  claim(GST, 'what', 'The calculator offers the six GST 2.0 slabs in force since 22 September 2025: 0%, 0.25%, 3%, 5%, 18% and 40%.', 'the rate options, and the engine\'s date', N, async () => [slabVals().join() === '0,0.25,3,5,18,40' && /GST 2\.0 — effective 22 September 2025/.test(src(GST)), optVals(GST, 'rate').join(', ')]);
  claim(GST, 'works', 'Removing it divides the inclusive price by one plus the rate, since the tax was charged on the taxable value, not the total.', 'inclusive at every slab', N, async () => {
    const bad = [0, 0.25, 3, 5, 18, 40].filter((rt) => !near(gst({ amount: 50000, mode: 'inclusive', rate: rt }).base, 50000 / (1 + rt / 100), 1e-9)); return [!bad.length, bad.join(', ') || 'all slabs'];
  });
  claim(GST, 'works', 'Within one state it splits equally into CGST and SGST; between states it is all IGST.', 'split', N, async () => {
    const a = gst({ amount: 777, rate: 40 }), b = gst({ amount: 777, rate: 40, supply: 'inter' }); return [a.cgst === a.sgst && near(a.cgst * 2, a.gst, 1e-9) && b.igst === b.gst && b.cgst === 0, a.cgst + ' + ' + a.sgst + ' | ' + b.igst];
  });
  claim(GST, 'works', 'line value = unit amount × quantity', 'quantity', N, async () => { const r = gst({ amount: 2450, qty: 4, rate: 5 }); return [r.base === 9800, r.base]; });
  claim(GST, 'works', 'GST = taxable value × rate', 'exclusive', N, async () => { const r = gst({ amount: 12345, rate: 18 }); return [near(r.gst, 12345 * 0.18, 1e-9), r.gst]; });
  claim(GST, 'works', 'taxable value = inclusive amount ÷ (1 + rate)', 'inclusive', N, async () => { const r = gst({ amount: 10500, mode: 'inclusive', rate: 5 }); return [near(r.base, 10000, 1e-9) && near(r.gst, 500, 1e-9), r.base]; });
  claim(GST, 'works', 'CGST = SGST = GST ÷ 2 (intra-state)', 'halves', N, async () => { const r = gst({ amount: 1000, rate: 0.25 }); return [near(r.cgst, 1.25, 1e-12) && r.splitLabel === 'CGST 0.125% + SGST 0.125%', r.splitLabel]; });
  claim(GST, 'works', 'IGST = GST (inter-state)', 'IGST', N, async () => { const r = gst({ amount: 1000, rate: 3, supply: 'inter' }); return [r.igst === 30 && r.splitLabel === 'IGST 3.00%', r.splitLabel]; });
  claim(GST, 'worked', 'because the goods cross a state border, all of it is IGST', 'no CGST or SGST between states', N, async () => { const r = gst({ amount: 2450, qty: 4, rate: 5, supply: 'inter' }); return [r.cgst === 0 && r.sgst === 0 && r.igst === 490, r.igst]; });
  claim(GST, 'worked', 'Had the buyer been in Pune, the same tax would split into CGST ₹245 and SGST ₹245.', 'intra split', N, async () => { const r = gst({ amount: 2450, qty: 4, rate: 5 }); return [r.cgst === 245 && r.sgst === 245, r.cgst + ' + ' + r.sgst]; });
  claim(GST, 'use', 'Turn a quoted net price into the taxable value, tax lines and total the invoice needs.', 'exclusive mode', N, async () => { const r = gst({ amount: 40000, rate: 18 }); return [r.base === 40000 && r.cgst === 3600 && r.total === 47200, r.total]; });
  claim(GST, 'use', 'Pull the taxable value and GST out of an inclusive bill before entering it in your books.', 'inclusive mode', N, async () => { const r = gst({ amount: 5900, mode: 'inclusive', rate: 18 }); return [near(r.base, 5000, 1e-9) && near(r.gst, 900, 1e-9) && near(r.total, 5900, 1e-9), r.base + ' + ' + r.gst]; });
  claim(GST, 'use', 'Work back from the price a customer will pay to the taxable value you keep at each slab.', 'one price, six taxable values', N, async () => {
    const v = [0, 0.25, 3, 5, 18, 40].map((rt) => gst({ amount: 1400, mode: 'inclusive', rate: rt }).base); return [v.every((x, i) => !i || x < v[i - 1]) && v[0] === 1400 && near(v[5], 1000, 1e-9), v.map((x) => x.toFixed(2)).join(', ')];
  });
  claim(GST, 'mistake', 'Charging CGST and SGST on an inter-state sale, or IGST on a local one.', 'the supply type picks the head', N, async () => [optVals(GST, 'supply').join() === 'intra,inter,ut' && /CGST \+ SGST/.test(input(GST, 'supply').options[0].label) && /IGST/.test(input(GST, 'supply').options[1].label) && /CGST \+ UTGST/.test(input(GST, 'supply').options[2].label), input(GST, 'supply').options.map((o) => o.label).join(' | ')]);
  manual(GST, 'mistake', 'Tax paid under the wrong head is not moved across: it is paid again under the right head and the wrong one refunded.', 'statement of GST law; not something the tool works out');
  claim(GST, 'mistake', 'Leaving an old billing template on 12% or 28%. Neither slab exists under GST 2.0', 'no 12% or 28% option', N, async () => [optVals(GST, 'rate').indexOf('12') < 0 && optVals(GST, 'rate').indexOf('28') < 0, optVals(GST, 'rate').join(', ')]);
  claim(GST, 'dfaq', 'Gold, silver and jewellery are at 3% under GST 2.0.', 'the 3% option names them', N, async () => { const o = input(GST, 'rate').options.find((x) => x.value === 3); return [!!o && /gold, silver, jewellery/.test(o.label), o && o.label]; });
  claim(GST, 'dfaq', 'It is the demerit rate GST 2.0 introduced for luxury and sin goods.', 'the 40% option', N, async () => { const o = input(GST, 'rate').options.find((x) => x.value === 40); return [!!o && /luxury & sin goods/.test(o.label), o && o.label]; });
  claim(GST, 'dfaq', 'split within a state as 20% CGST and 20% SGST of ₹2,000 each', 'split label at 40%', N, async () => { const r = gst({ rate: 40 }); return [r.splitLabel === 'CGST 20.00% + SGST 20.00%' && r.sgst === 2000, r.splitLabel]; });
  claim(GST, 'dfaq', 'Divide by one plus the rate, as within a state.', 'inter-state inclusive = intra-state inclusive', N, async () => { const a = gst({ amount: 1180, mode: 'inclusive' }), b = gst({ amount: 1180, mode: 'inclusive', supply: 'inter' }); return [a.base === b.base && near(b.igst, 180, 1e-9), a.base + ', ' + b.base]; });
  claim(GST, 'formula', 'GST = base × rate · base = inclusive ÷ (1 + rate)', 'both directions round-trip', N, async () => { const a = gst({ amount: 8888, rate: 5 }), b = gst({ amount: a.total, mode: 'inclusive', rate: 5 }); return [near(b.base, 8888, 1e-9) && near(b.gst, a.gst, 1e-9), b.base]; });
  claim(GST, 'tip', 'GST 2.0 took effect on 22 September 2025: the 12% and 28% slabs were removed', 'engine date and slab list', N, async () => [/effective 22 September 2025\. The 12% and 28% slabs were removed/.test(src(GST)) && optVals(GST, 'rate').indexOf('12') < 0, 'engine comment']);
  manual(GST, 'tip', 'most 12% items moved to 5% and most 28% items to 18%, and a 40% demerit rate was introduced for luxury and sin goods', 'about the rate notifications; the tool offers the slabs, not item classifications');
  claim(GST, 'tip', 'Intra-state supply splits the tax equally into CGST and SGST. Inter-state supply is a single IGST charge at the full rate.', 'full rate as IGST', N, async () => { const r = gst({ rate: 18, supply: 'inter' }); return [r.igst === 1800 && r.splitLabel === 'IGST 18.00%', r.splitLabel]; });
  claim(GST, 'tip', 'To remove 18% GST you divide by 1.18 — subtracting 18% takes off too much and understates the taxable value.', 'divide, not subtract', N, async () => { const r = gst({ amount: 11800, mode: 'inclusive' }); return [near(r.base, 10000, 1e-9) && 11800 * 0.82 < r.base, r.base + ' vs ' + 11800 * 0.82]; });
  manual(GST, 'tip', 'Place of supply, not where you are sitting, determines whether CGST+SGST or IGST applies. Getting it wrong means an amended return.', 'statement of GST law; the user picks the supply type');
  manual(GST, 'faq', 'It depends on the HSN or SAC code, not on a general category.', 'classification is outside the tool');
  claim(GST, 'faq', 'An 18% rate is therefore 9% CGST plus 9% SGST. The customer still pays 18% in total.', '9% + 9%', N, async () => { const r = gst({}); return [r.splitLabel === 'CGST 9.00% + SGST 9.00%' && r.effectiveRate === 18, r.splitLabel]; });

  /* ================================================================ */
  const HRA = '/india/hra-exemption/';
  const hra = (o) => R(HRA, Object.assign({ basic: 600000, hra: 240000, rent: 300000, metro: 'metro', year: '2026-27' }, o));
  claim(HRA, 'lede', 'Work out the house rent allowance exemption — the lowest of three tests.', 'each test can be the lowest', N, async () => {
    const a = hra({ hra: 100000 }), b = hra({ rent: 150000 }), c = hra({ hra: 400000, rent: 600000, metro: 'non' });
    return [a.which === 'Actual HRA received' && a.exempt === 100000 && b.which === 'Rent paid minus 10% of salary' && b.exempt === 90000 && c.which === '40% of salary' && c.exempt === 240000, [a.which, b.which, c.which].join(' | ')];
  });
  claim(HRA, 'card', 'Work out the house rent allowance exemption — the lowest of three tests.', 'the minimum', N, async () => { const r = hra({}); return [r.exempt === Math.min(r.t1, r.t2, r.t3), r.exempt]; });
  manual(HRA, 'lede', 'Tax year 2026-27 onwards: Income-tax Act, 2025, Schedule III (Table: Sl. No. 11)', 'statement of law; the engine cites rule 279 and rule 2A but no engine source holds the Schedule III entry');
  claim(HRA, 'lede', 'with rule 279 of the Income-tax Rules, 2026; earlier years: section 10(13A) of the 1961 Act.', 'a year choice for each set of rules; the engine cites rule 279 and rule 2A', N, async () => [optVals(HRA, 'year').join() === '2026-27,2025-26' && /rule 279 of the Income-tax Rules, 2026/.test(src(HRA)) && /rule 2A of the 1962 Rules/.test(src(HRA)), optVals(HRA, 'year').join(', ')]);
  claim(HRA, 'why', 'Enter salary, HRA and rent. Get the exempt HRA and the limiting test.', 'exempt and the test that limits it', N, async () => { const r = hra({}); return [r.exempt === 240000 && r.which === 'Actual HRA received', r.which]; });
  claim(HRA, 'what', 'whatever is not exempt is taxed with the rest of your pay', 'taxable = HRA − exempt', N, async () => { const r = hra({ rent: 200000 }); return [r.taxable === 240000 - 140000, r.taxable]; });
  manual(HRA, 'what', 'For FY 2026-27 it is claimed through payroll or in the return, and only by those who have opted for the old regime.', 'statement of law; the tool works out the exemption, not the regime');
  claim(HRA, 'works', 'Three amounts are compared and the smallest is exempt: the HRA actually received, rent paid less a tenth of salary, and half of salary in eight cities or 40% elsewhere.', 'the three tests', N, async () => { const r = hra({ basic: 500000, hra: 220000, rent: 260000, metro: 'metro8' }); return [r.t1 === 220000 && r.t2 === 210000 && r.t3 === 250000 && r.exempt === 210000, [r.t1, r.t2, r.t3].join(', ')]; });
  claim(HRA, 'works', 'From tax year 2026-27 rule 279 adds Bengaluru, Hyderabad, Pune and Ahmedabad to Delhi, Mumbai, Kolkata and Chennai.', 'the four new cities 50% in 2026-27, 40% in 2025-26', N, async () => {
    const a = hra({ metro: 'metro8', year: '2026-27' }), b = hra({ metro: 'metro8', year: '2025-26' }), c = hra({ metro: 'metro', year: '2025-26' });
    return [a.t3 === 300000 && b.t3 === 240000 && c.t3 === 300000 && /qualify for 50% only from tax year 2026-27/.test(b.note) && /Bengaluru, Hyderabad, Pune or Ahmedabad/.test(input(HRA, 'metro').options[1].label), [a.t3, b.t3, c.t3].join(', ')];
  });
  claim(HRA, 'works', 'exempt HRA = lowest of A, B and C', 'the minimum on random inputs', N, async () => {
    let bad = 0; for (let k = 1; k <= 40; k++) { const r = hra({ basic: 100000 * k, hra: 37000 * (k % 7 + 1), rent: 41000 * (k % 9), metro: ['metro', 'metro8', 'non'][k % 3] }); if (r.exempt !== Math.min(r.t1, r.t2, r.t3)) bad++; } return [!bad, bad + ' mismatches'];
  });
  claim(HRA, 'works', 'A = HRA received', 'A', N, async () => { const r = hra({ hra: 123456 }); return [r.t1 === 123456, r.t1]; });
  claim(HRA, 'works', 'B = rent paid − 10% × (basic + DA)', 'B, never below 0', N, async () => { const a = hra({ rent: 100000 }), b = hra({ rent: 50000 }); return [a.t2 === 40000 && b.t2 === 0, a.t2 + ', ' + b.t2]; });
  claim(HRA, 'works', 'C = 50% × (basic + DA) in the eight cities, 40% elsewhere', 'C', N, async () => { const a = hra({ metro: 'metro' }), b = hra({ metro: 'metro8' }), c = hra({ metro: 'non' }); return [a.t3 === 300000 && b.t3 === 300000 && c.t3 === 240000, [a.t3, b.t3, c.t3].join(', ')]; });
  claim(HRA, 'works', 'taxable HRA = A − exempt HRA', 'taxable', N, async () => { const r = hra({ hra: 300000, rent: 420000, metro: 'non' }); return [r.taxable === 60000, r.taxable]; });
  claim(HRA, 'works', 'basic pay plus dearness allowance, without HRA or other allowances', 'the salary box is basic + DA', N, async () => [input(HRA, 'basic').label === 'Basic salary + DA (annual)', input(HRA, 'basic').label]);
  claim(HRA, 'worked', 'B is the lowest, so ₹1,68,000 is exempt and ₹24,000 is taxed.', 'limiting test named', N, async () => { const r = hra({ basic: 480000, hra: 192000, rent: 216000, metro: 'non' }); return [r.which === 'Rent paid minus 10% of salary' && r.exempt === 168000, r.which]; });
  claim(HRA, 'worked', 'Moving the same job to a metro raises test C to ₹2,40,000 but changes nothing, because the rent test still binds.', 'metro: same exemption', N, async () => { const a = hra({ basic: 480000, hra: 192000, rent: 216000, metro: 'non' }), b = hra({ basic: 480000, hra: 192000, rent: 216000, metro: 'metro' }); return [b.t3 === 240000 && a.exempt === b.exempt, a.exempt + ', ' + b.exempt]; });
  manual(HRA, 'use', 'Work out the exemption before the employer’s proof deadline so monthly TDS is right from the start.', 'payroll practice');
  claim(HRA, 'use', 'Carry the exempt HRA into the income tax comparison as an old-regime deduction.', 'the income tax page\'s deductions box takes HRA', N, async () => [/HRA/.test(input(IT, 'deductions').label), input(IT, 'deductions').label]);
  claim(HRA, 'use', 'Compare the exemption in a metro and a non-metro posting on the same salary.', 'metro vs non-metro', N, async () => { const a = hra({ hra: 300000, rent: 500000, metro: 'metro' }), b = hra({ hra: 300000, rent: 500000, metro: 'non' }); return [a.exempt === 300000 && b.exempt === 240000, a.exempt + ', ' + b.exempt]; });
  claim(HRA, 'mistake', 'Assuming more rent always means more exemption. Once rent less 10% of salary exceeds the HRA received or the 40% or 50% cap, extra rent saves nothing.', 'rent past the cap', N, async () => { const a = hra({ rent: 400000 }), b = hra({ rent: 900000 }); return [a.exempt === b.exempt && a.exempt === 240000, a.exempt + ', ' + b.exempt]; });
  claim(HRA, 'mistake', 'All three amounts must cover the same period, and the tool expects annual ones.', 'annual labels', N, async () => [['basic', 'hra', 'rent'].every((k) => /\(annual\)/.test(input(HRA, k).label)), ['basic', 'hra', 'rent'].map((k) => input(HRA, k).label).join(' | ')]);
  claim(HRA, 'dfaq', 'Then test B is zero and nothing is exempt.', 'rent under 10% of salary', N, async () => { const r = hra({ rent: 59999 }), s = hra({ rent: 60001 }); return [r.t2 === 0 && r.exempt === 0 && s.exempt > 0, r.exempt + ', ' + s.exempt]; });
  claim(HRA, 'dfaq', 'In a non-metro, ₹6,00,000 basic limits the exemption to ₹2,40,000 however much rent you pay', 'any rent', N, async () => { const v = [420000, 1000000, 5000000].map((x) => hra({ hra: 300000, rent: x, metro: 'non' }).exempt); return [v.every((x) => x === 240000), v.join(', ')]; });
  claim(HRA, 'dfaq', 'If you rented only from July, enter the HRA, basic and rent for those nine months alone, so that all three tests cover the same period.', 'nine months of figures, nine twelfths of the exemption', N, async () => { const a = hra({}), b = hra({ basic: 450000, hra: 180000, rent: 225000 }); return [near(b.exempt, a.exempt * 0.75, 1e-9), a.exempt + ' → ' + b.exempt]; });
  claim(HRA, 'formula', 'exempt = least of (actual HRA, rent − 10% salary, 50%/40% of salary)', 'formula', N, async () => { const r = hra({ basic: 900000, hra: 500000, rent: 480000, metro: 'non' }); return [r.exempt === 360000 && r.which === '40% of salary', r.exempt + ' (' + r.which + ')']; });
  manual(HRA, 'tip', 'HRA exemption is only available under the old regime. The new regime removes it entirely, which is often what decides between the two.', 'statement of law; the tool has no regime choice');
  claim(HRA, 'tip', 'From tax year 2026-27 the 50% test covers eight cities — Delhi, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Pune and Ahmedabad (rule 279 of the Income-tax Rules, 2026). Before that it was the first four only.', 'city list in the engine and the options', N, async () => {
    const s = src(HRA); return [/Mumbai, Kolkata,\s+Delhi, Chennai, Hyderabad, Pune, Ahmedabad and Bengaluru\. 50%/.test(s) && /Bombay,\s+Calcutta, Delhi and Madras only/.test(s) && hra({ metro: 'metro8', year: '2025-26' }).t3 === 240000, 'engine comment and FY 2025-26 at 40%'];
  });
  claim(HRA, 'tip', '"Salary" here means basic pay plus dearness allowance that forms part of retirement benefits, not your full CTC.', 'tests B and C use basic + DA', N, async () => { const r = hra({ basic: 400000 }); return [r.t2 === 260000 && r.t3 === 200000, r.t2 + ', ' + r.t3]; });
  manual(HRA, 'tip', 'If annual rent exceeds ₹1,00,000 you must report the landlord’s PAN to your employer.', 'statement of law; not part of the calculation');
  manual(HRA, 'tip', 'Paying rent to a parent is allowed if the arrangement is genuine, the parent owns the property and declares the rental income.', 'statement of law and practice');
  manual(HRA, 'faq', 'Yes, if the circumstances are genuine — for example you own a property in one city and rent in another for work.', 'statement of law and practice');

  /* ================================================================ */
  const CG = '/india/india-capital-gains/';
  const cg = (o) => R(CG, Object.assign({ asset: 'equity', sale: 500000, cost: 300000, expenses: 0, months: 14, slabRate: 30 }, o));
  claim(CG, 'lede', 'Short and long-term capital gains on equity, mutual funds, property and other assets under current rules.', 'four asset types, short and long', N, async () => {
    const t = ['equity', 'debt', 'property', 'other'].map((a) => [cg({ asset: a, months: 6 }).term, cg({ asset: a, months: 30 }).term]);
    return [optVals(CG, 'asset').join() === 'equity,debt,property,other' && /^Short/.test(t[0][0]) && /^Long/.test(t[0][1]) && /^Short/.test(t[1][1]) && /^Long/.test(t[2][1]) && /^Long/.test(t[3][1]), j(t)];
  });
  claim(CG, 'card', 'Short and long-term capital gains on equity, mutual funds, property and other assets under current rules.', 'current rates: 20% short, 12.5% long', N, async () => { const a = cg({ months: 12 }), b = cg({ months: 13 }); return [a.rate === 20 && b.rate === 12.5, a.rate + ', ' + b.rate]; });
  claim(CG, 'why', 'Enter sale, cost and months held. Get the gain, the rate and the tax.', 'gain, rate, tax', N, async () => { const r = cg({}); return [r.gain === 200000 && r.rate === 12.5 && near(r.tax, 75000 * 0.125 * 1.04, 1e-9), r.gain + ', ' + r.rate + '%, ' + r.tax]; });
  claim(CG, 'why', 'Short or long term, the ₹1.25 lakh exemption and 12.5% all change the bill.', 'short vs long on the same gain', N, async () => { const a = cg({ months: 11 }), b = cg({ months: 14 }); return [a.exemption === 0 && b.exemption === 125000 && b.tax < a.tax, a.tax + ' vs ' + b.tax]; });
  claim(CG, 'what', 'For FY 2026-27 the tool treats listed equity as long term after more than 12 months, and property, gold and unlisted shares after more than 24; debt funds bought after April 2023 never qualify.', 'the holding thresholds either side', N, async () => {
    const t = (a, m) => /^Long/.test(cg({ asset: a, months: m }).term);
    return [!t('equity', 12) && t('equity', 13) && !t('property', 24) && t('property', 25) && !t('other', 24) && t('other', 25) && !t('debt', 120), 'equity 12/13, property 24/25, other 24/25, debt 120'];
  });
  claim(CG, 'works', 'The gain is worked out first, and the ₹1.25 lakh exemption comes off long-term gains on listed equity only.', 'no exemption on property or other long-term gains', N, async () => {
    const a = cg({ months: 30 }), b = cg({ asset: 'property', months: 30 }), c = cg({ asset: 'other', months: 30 });
    return [a.exemption === 125000 && b.exemption === 0 && c.exemption === 0, [a.exemption, b.exemption, c.exemption].join(', ')];
  });
  claim(CG, 'works', 'The rate is a flat 12.5% or 20%, or your slab rate, and 4% cess is added; surcharge is not included.', 'no surcharge on a ₹5 crore gain', N, async () => { const r = cg({ asset: 'property', sale: 60000000, cost: 10000000, months: 30 }); return [near(r.tax, 50000000 * 0.125 * 1.04, 1e-6), r.tax]; });
  claim(CG, 'works', 'gain = sale value − purchase cost − transfer expenses', 'gain', N, async () => { const r = cg({ sale: 900000, cost: 400000, expenses: 25000 }); return [r.gain === 475000, r.gain]; });
  claim(CG, 'works', 'taxable gain = gain − ₹1,25,000 (long-term listed equity), otherwise the whole gain', 'either side of ₹1.25 lakh', N, async () => {
    const a = cg({ sale: 425000 }), b = cg({ sale: 425100 }), c = cg({ sale: 425100, months: 6 });
    return [a.taxable === 0 && a.tax === 0 && b.taxable === 100 && near(b.tax, 13, 1e-9) && c.taxable === 125100, [a.tax, b.tax, c.taxable].join(', ')];
  });
  claim(CG, 'works', 'tax = taxable gain × rate × 1.04', 'tax', N, async () => { const r = cg({ asset: 'other', sale: 1000000, cost: 600000, months: 10, slabRate: 20 }); return [near(r.tax, 400000 * 0.2 * 1.04, 1e-9), r.tax]; });
  claim(CG, 'works', '12.5% long term; 20% for listed equity held 12 months or less; otherwise your slab rate', 'rates by asset and term', N, async () => {
    const v = [cg({ months: 30 }), cg({ months: 12 }), cg({ asset: 'property', months: 12, slabRate: 20 }), cg({ asset: 'debt', months: 60, slabRate: 30 }), cg({ asset: 'other', months: 25 })].map((r) => r.rate);
    return [j(v) === j([12.5, 20, 20, 30, 12.5]), v.join(', ')];
  });
  claim(CG, 'works', 'adds the 4% health and education cess', 'cess', N, async () => { const r = cg({ months: 6 }); return [near(r.cess, 200000 * 0.2 * 0.04, 1e-9), r.cess]; });
  claim(CG, 'worked', 'being long term, it is taxed at 12.5% with no indexation and no exemption', 'property at 40 months', N, async () => { const r = cg({ asset: 'property', sale: 9500000, cost: 6000000, expenses: 150000, months: 40 }); return [r.rate === 12.5 && r.exemption === 0 && /without indexation/.test(r.basis), r.basis]; });
  claim(CG, 'worked', 'Sold at 20 months instead, the same gain would be short term at a 30% slab rate', 'property at 20 months', N, async () => { const r = cg({ asset: 'property', sale: 9500000, cost: 6000000, expenses: 150000, months: 20, slabRate: 30 }); return [/^Short/.test(r.term) && r.rate === 30, r.term + ', ' + r.rate]; });
  claim(CG, 'use', 'See what waiting past the 12-month mark saves before you sell.', '12 vs 13 months', N, async () => { const a = cg({ months: 12 }), b = cg({ months: 13 }); return [b.tax < a.tax, a.tax + ' → ' + b.tax]; });
  claim(CG, 'use', 'Know the tax and the net proceeds before agreeing a price or planning a reinvestment.', 'net proceeds = sale − expenses − tax', N, async () => { const r = cg({ asset: 'property', sale: 8000000, cost: 5000000, expenses: 100000, months: 36 }); return [near(r.netProceeds, 8000000 - 100000 - r.tax, 1e-9), r.netProceeds]; });
  manual(CG, 'use', 'A large gain made mid-year can bring advance tax due; size it here first.', 'about advance tax law; the advance tax page works the instalments');
  claim(CG, 'mistake', 'It is one allowance for all listed equity gains in the year, while the tool deducts it from the single gain you enter.', 'one gain at a time', N, async () => { const r = cg({ sale: 400000 }); return [r.exemption === 125000 && r.taxable === 0 && !keys(CG).some((k) => /used|other|already/i.test(k)), keys(CG).join(', ')]; });
  claim(CG, 'mistake', 'Listed equity must be held for more than 12 months, so the tool counts a 12-month holding as short term.', '12 months short', N, async () => { const r = cg({ months: 12 }); return [/^Short term \(held 12 months\)/.test(r.term), r.term]; });
  claim(CG, 'dfaq', 'A ₹1,00,000 long-term gain on listed shares sits within the ₹1.25 lakh exemption, so the tool shows tax of ₹0.', '₹1 lakh gain', N, async () => { const r = cg({ sale: 400000, months: 20 }); return [r.tax === 0 && r.taxable === 0, r.tax]; });
  claim(CG, 'dfaq', 'Hold three more months and the tax falls to ₹9,750, because the gain becomes long term and the first ₹1.25 lakh is exempt.', '11 → 14 months', N, async () => { const a = cg({ months: 11 }), b = cg({ months: 14 }); return [a.exemption === 0 && b.exemption === 125000 && /^Long/.test(b.term), a.term + ' / ' + b.term]; });
  claim(CG, 'dfaq', 'No, only the 4% cess. Gains large enough to push total income into surcharge will cost more than the amount shown.', 'tax = rate × 1.04 even on ₹2 crore', N, async () => { const r = cg({ sale: 20300000, cost: 300000, months: 30 }); return [near(r.tax, (20000000 - 125000) * 0.125 * 1.04, 1e-6), r.tax]; });
  claim(CG, 'formula', 'LTCG on listed equity = 12.5% on gains above ₹1.25 lakh', 'formula', N, async () => { const r = cg({ sale: 1300000, cost: 300000, months: 40 }); return [near(r.tax, 875000 * 0.125 * 1.04, 1e-9) && /12\.5% above ₹1\.25 lakh/.test(r.basis), r.basis]; });
  claim(CG, 'tip', 'listed equity STCG moved to 20%, and long-term gains across most assets to 12.5% without indexation', 'equity 20% short; 12.5% long on equity, property and other', N, async () => {
    const v = [cg({ months: 6 }).rate, cg({ months: 13 }).rate, cg({ asset: 'property', months: 25 }).rate, cg({ asset: 'other', months: 25 }).rate]; return [j(v) === j([20, 12.5, 12.5, 12.5]), v.join(', ')];
  });
  claim(CG, 'tip', 'The ₹1.25 lakh annual exemption applies to long-term gains on listed equity and equity mutual funds', 'the equity option covers both', N, async () => [/Listed equity \/ equity mutual fund/.test(input(CG, 'asset').options[0].label) && cg({ months: 13 }).exemption === 125000, input(CG, 'asset').options[0].label]);
  claim(CG, 'tip', 'This calculator uses the 12.5% basis, so check both with your CA.', 'property long term: 12.5%, no indexation option', N, async () => { const r = cg({ asset: 'property', months: 100 }); return [r.rate === 12.5 && !keys(CG).some((k) => /index|cii|acquir/i.test(k)), r.basis]; });
  manual(CG, 'tip', 'Property acquired before 23 July 2024 may still be eligible for the older 20%-with-indexation route where that produces a lower tax.', 'statement of law the tool does not apply (it says so)');
  claim(CG, 'tip', 'Debt mutual funds bought on or after 1 April 2023 are taxed at slab rates regardless of holding period.', 'debt at slab for 6 and 60 months', N, async () => { const a = cg({ asset: 'debt', months: 6, slabRate: 20 }), b = cg({ asset: 'debt', months: 60, slabRate: 20 }); return [a.rate === 20 && b.rate === 20 && /^Short/.test(b.term), a.basis]; });
  manual(CG, 'faq', 'Sections 82, 86 and 85 of the Income-tax Act, 2025 (formerly 54, 54F and 54EC) allow relief where proceeds are reinvested in residential property or specified bonds within set time limits.', 'statement of law; no engine holds these sections (the tool has no reinvestment relief)');

  /* ================================================================ */
  const LS = '/india/lumpsum-returns/';
  const ls = (o) => R(LS, Object.assign({ principal: 100000, rate: 12, years: 10, inflation: 6 }, o));
  claim(LS, 'lede', 'Future value of a one-time investment, with its worth in today’s money and the real return after inflation.', 'FV, value today, real return', N, async () => {
    const r = ls({}); return [near(r.fv, 100000 * Math.pow(1.12, 10), 1e-6) && near(r.real, r.fv / Math.pow(1.06, 10), 1e-6) && near(r.realRate, (1.12 / 1.06 - 1) * 100, 1e-9), [r.fv, r.real, r.realRate].map((x) => x.toFixed(2)).join(', ')];
  });
  claim(LS, 'card', 'Future value of a one-time investment, with its worth in today’s money and the real return after inflation.', 'a second case', N, async () => { const r = ls({ principal: 250000, rate: 8, years: 7, inflation: 5 }); return [near(r.fv, 250000 * Math.pow(1.08, 7), 1e-6) && near(r.real, 250000 * Math.pow(1.08 / 1.05, 7), 1e-6), r.real]; });
  claim(LS, 'why', 'Enter the sum, return and years. See maturity and its real worth.', 'inflation moves only the real worth', N, async () => { const a = ls({ inflation: 0 }), b = ls({ inflation: 7 }); return [a.fv === b.fv && near(a.real, a.fv, 1e-9) && b.real < a.real, a.real + ', ' + b.real]; });
  claim(LS, 'why', 'The projection says your money nearly quadruples. It never says what that will buy after inflation.', '₹5 lakh, 12%, 12 years: ×3.9 nominal, much less real', N, async () => { const r = ls({ principal: 500000, rate: 12, years: 12, inflation: 6 }); return [r.multiple > 3.8 && r.multiple < 4 && r.real / 500000 < 2, '×' + r.multiple.toFixed(3) + ', real ×' + (r.real / 500000).toFixed(3)]; });
  claim(LS, 'what', 'Time matters most, because the return compounds on everything earned so far.', 'twice the time squares the multiple', N, async () => { const a = ls({ years: 10 }), b = ls({ years: 20 }); return [near(b.multiple, a.multiple * a.multiple, 1e-9), a.multiple + ' → ' + b.multiple]; });
  claim(LS, 'works', 'Each year the value is multiplied by one plus the return.', 'year-by-year table', N, async () => { const r = ls({ years: 3 }); return [j(r._table.rows.map((x) => x[1])) === j([112000, 125440, 140493].map(inr)), r._table.rows.map((x) => x[1]).join(', ')]; });
  claim(LS, 'works', 'FV = P × (1 + r)ⁿ', 'FV, part years too', N, async () => { const r = ls({ years: 2.5, rate: 9 }); return [near(r.fv, 100000 * Math.pow(1.09, 2.5), 1e-6), r.fv]; });
  claim(LS, 'works', 'value today = FV ÷ (1 + f)ⁿ', 'value today', N, async () => { const r = ls({ inflation: 4.5, years: 12 }); return [near(r.real, r.fv / Math.pow(1.045, 12), 1e-6), r.real]; });
  claim(LS, 'works', 'real return = (1 + r) ÷ (1 + f) − 1', 'real return', N, async () => { const r = ls({ rate: 10, inflation: 5 }); return [near(r.realRate, (1.1 / 1.05 - 1) * 100, 1e-9), r.realRate]; });
  claim(LS, 'works', 'years to double = ln 2 ÷ ln(1 + r)', 'doubling', N, async () => { const r = ls({ rate: 10 }); return [near(r.doubling, Math.log(2) / Math.log(1.1), 1e-12), r.doubling]; });
  claim(LS, 'worked', 'The money doubles roughly every 7.27 years, so over 15 years it doubles just over twice.', '15 ÷ 7.27', N, async () => { const r = ls({ principal: 200000, rate: 10, years: 15, inflation: 5 }); const k = 15 / r.doubling; return [k > 2 && k < 2.2 && r.multiple > 4, k.toFixed(3) + ' doublings, ×' + r.multiple.toFixed(3)]; });
  claim(LS, 'use', 'See what a one-off sum could become by a goal date at a cautious and at an optimistic return.', 'the rate is free', N, async () => { const a = ls({ rate: 7 }), b = ls({ rate: 12 }); return [b.fv > a.fv, a.fv + ', ' + b.fv]; });
  claim(LS, 'use', 'Check whether a corpus that looks large in 20 years will still cover the goal in today’s prices.', 'today\'s-money value', N, async () => { const r = ls({ years: 20 }); return [r.real < r.fv && output(LS, 'real').label === 'Worth in today’s money', Math.round(r.real) + ' of ' + Math.round(r.fv)]; });
  manual(LS, 'mistake', 'An equity fund averaging 12% can lose money in some years, and a fall just before you withdraw hurts a single lump sum more than an investment still being paid into.', 'about market returns; the tool assumes one steady rate');
  claim(LS, 'mistake', 'Overlooking a return below inflation. At 5% a year with 6% inflation', 'value today below the sum invested', N, async () => { const r = ls({ rate: 5, inflation: 6 }); return [r.fv > 100000 && r.real < 100000 && r.realRate < 0, Math.round(r.real) + ', ' + r.realRate.toFixed(3) + '%']; });
  claim(LS, 'dfaq', '9.006 years by the exact formula, which is why the rule of 72 (72 ÷ 8 = 9) is a good shortcut.', 'within a hundredth of 72 ÷ 8', N, async () => { const r = ls({ rate: 8 }); return [Math.abs(r.doubling - 9) < 0.01, r.doubling]; });
  claim(LS, 'dfaq', 'At the same return, all at once ends higher, since every rupee compounds for the full period.', 'a lump sum beats the same total as a SIP', N, async () => {
    const lump = ls({ principal: 1200000, rate: 12, years: 10 }).fv, sip = R('/india/sip-calculator/', { monthly: 10000, rate: 12 * 12 * (Math.pow(1.12, 1 / 12) - 1), years: 10, stepup: 0 }).value;
    return [lump > sip, Math.round(lump) + ' vs ' + Math.round(sip)];
  });
  manual(LS, 'dfaq', 'A systematic transfer plan gives up some growth to avoid buying everything at one price.', 'about STPs; the tool has none');
  claim(LS, 'formula', 'FV = P × (1 + r)ⁿ', 'zero and negative edges', N, async () => { const a = ls({ rate: 0 }), b = ls({ years: 0 }); return [a.fv === 100000 && b.fv === 100000 && isNaN(a.doubling), a.fv + ', ' + b.fv]; });
  claim(LS, 'tip', 'At 6% inflation, money loses roughly half its purchasing power every twelve years.', '12 years at 6%', N, async () => { const r = ls({ rate: 0, inflation: 6, years: 12 }); return [r.real / 100000 > 0.45 && r.real / 100000 < 0.55, (r.real / 1000).toFixed(1) + '%']; });
  claim(LS, 'tip', 'A 12% nominal return with 6% inflation is a real return of about 5.7%, not 6% — the two rates divide rather than subtract.', '5.66%', N, async () => { const r = ls({ rate: 12, inflation: 6 }); return [r.realRate.toFixed(1) === '5.7', r.realRate.toFixed(3)]; });
  claim(LS, 'tip', 'Nothing here accounts for exit load, expense ratio or tax, all of which reduce what you actually receive.', 'no such inputs', N, async () => [j(keys(LS)) === j(['principal', 'rate', 'years', 'inflation']), keys(LS).join(', ')]);
  claim(LS, 'faq', 'The exact relationship is (1 + nominal) ÷ (1 + inflation) − 1. Subtracting is a reasonable approximation at low rates and increasingly wrong as rates rise.', 'the gap grows with the rates', N, async () => {
    const g = (n, f) => (n - f) - ls({ rate: n, inflation: f }).realRate; return [g(3, 2) < 0.03 && g(30, 20) > 1.5, g(3, 2).toFixed(3) + ' vs ' + g(30, 20).toFixed(3)];
  });

  /* ================================================================ */
  const NPS = '/india/nps-calculator/';
  const nps = (o) => R(NPS, Object.assign({ monthly: 10000, age: 30, rate: 10, sector: 'private', annuityPct: 40, annuityRate: 6 }, o));
  const npsRef = (c, a, rt) => { const i = rt / 1200, n = (60 - a) * 12; return c * (Math.pow(1 + i, n) - 1) / i * (1 + i); };
  claim(NPS, 'lede', 'National Pension System corpus at 60, with the mandatory annuity split and estimated pension.', 'corpus, split and pension', N, async () => {
    const r = nps({}); return [near(r.corpus, npsRef(10000, 30, 10), 1e-6) && near(r.annuity, r.corpus * 0.4, 1e-6) && near(r.pension, r.annuity * 0.06 / 12, 1e-6), Math.round(r.corpus) + ', ' + Math.round(r.pension)];
  });
  claim(NPS, 'card', 'National Pension System corpus at 60, with the mandatory annuity split and estimated pension.', 'the mandatory minimum is enforced', N, async () => { const r = nps({ annuityPct: 10 }); return [near(r.annuity, r.corpus * 0.2, 1e-6) && /minimum is 20%, so 20% is used/.test(r.note), r.note]; });
  claim(NPS, 'why', 'Enter contribution, age and return. See corpus, lump sum and pension.', 'lump sum + annuity = corpus', N, async () => { const r = nps({}); return [near(r.lumpsum + r.annuity, r.corpus, 1e-6) && r.pension > 0, Math.round(r.lumpsum) + ' + ' + Math.round(r.annuity)]; });
  claim(NPS, 'what', 'you contribute while working, the money is invested in the equity and bond funds you choose, and it compounds until 60', 'years to 60', N, async () => { const a = nps({ age: 25 }), b = nps({ age: 60 }); return [a.years === 35 && b.years === 0 && b.corpus === 0, a.years + ', ' + b.years]; });
  claim(NPS, 'what', 'At least 20% must buy the annuity (40% in government service), and only 60% of the corpus is tax-free.', 'minimums 20% and 40%; exempt part 60%', N, async () => {
    const a = nps({ annuityPct: 19 }), b = nps({ annuityPct: 39, sector: 'govt' }), c = nps({ annuityPct: 20 });
    return [near(a.annuity, a.corpus * 0.2, 1e-6) && near(b.annuity, b.corpus * 0.4, 1e-6) && near(c.exemptLumpsum, c.corpus * 0.6, 1e-6) && near(c.lumpsum, c.corpus * 0.8, 1e-6) && /Only 60% of the corpus is tax-exempt/.test(c.note), (a.annuity / a.corpus).toFixed(2) + ', ' + (b.annuity / b.corpus).toFixed(2) + ', exempt ' + (c.exemptLumpsum / c.corpus).toFixed(2)];
  });
  claim(NPS, 'works', 'Each monthly contribution, paid at the start of the month, compounds at the expected return divided by 12 until you turn 60.', 'one year by hand', N, async () => { let v = 0; for (let m = 0; m < 12; m++) v = (v + 5000) * (1 + 0.12 / 12); const r = nps({ monthly: 5000, age: 59, rate: 12 }); return [near(r.corpus, v, 1e-6), r.corpus + ' vs ' + v]; });
  claim(NPS, 'works', 'corpus = C × ((1 + i)ⁿ − 1) ÷ i × (1 + i)', 'several inputs', N, async () => { const bad = [[3000, 22, 8], [25000, 45, 11], [7000, 59, 9.5]].filter(([c, a, rt]) => !near(nps({ monthly: c, age: a, rate: rt }).corpus, npsRef(c, a, rt), 1e-6)); return [!bad.length, bad.length + ' mismatches']; });
  claim(NPS, 'works', 'n = (60 − age) × 12', 'months', N, async () => { const r = nps({ age: 41, rate: 0 }); return [r.invested === 10000 * 19 * 12 && r.corpus === r.invested, r.invested]; });
  claim(NPS, 'works', 'monthly pension = annuity × annuity rate ÷ 12', 'pension', N, async () => { const r = nps({ annuityPct: 50, annuityRate: 6.5 }); return [near(r.pension, r.corpus * 0.5 * 0.065 / 12, 1e-6), r.pension]; });
  claim(NPS, 'works', 'the share used to buy the annuity, 20% (government 40%) to 100%', 'clamped to 100%; a blank share is 40%, with no minimum note', N, async () => {
    const r = nps({ annuityPct: 120 }), b = nps({ annuityPct: null });
    return [near(r.annuity, r.corpus, 1e-6) && r.lumpsum === 0 && near(b.annuity, b.corpus * 0.4, 1e-6) && !/minimum/.test(b.note), 'blank: ' + (b.annuity / b.corpus).toFixed(2) + ' "' + b.note + '"'];
  });
  claim(NPS, 'worked', 'Over 25 years that is ₹24,00,000 of contributions', '25 years from 35', N, async () => { const r = nps({ monthly: 8000, age: 35, rate: 9, annuityPct: 50, annuityRate: 6.5 }); return [r.years === 25 && r.invested === 2400000, r.years]; });
  claim(NPS, 'use', 'Work out the monthly amount that produces the pension you want at 60.', 'pension in proportion to the contribution', N, async () => { const a = nps({ monthly: 10000 }), b = nps({ monthly: 15000 }); return [near(b.pension, 1.5 * a.pension, 1e-6), a.pension + ', ' + b.pension]; });
  claim(NPS, 'use', 'See how each extra 10% put into the annuity trades lump sum for monthly income.', '10% of corpus moves each way', N, async () => { const a = nps({ annuityPct: 40 }), b = nps({ annuityPct: 50 }); return [near(a.lumpsum - b.lumpsum, a.corpus * 0.1, 1e-6) && near(b.pension - a.pension, a.corpus * 0.1 * 0.06 / 12, 1e-6), Math.round(a.lumpsum - b.lumpsum)]; });
  claim(NPS, 'use', 'Compare the corpus from starting now with starting five or ten years later.', 'later start, smaller corpus', N, async () => { const v = [30, 35, 40].map((a) => nps({ age: a }).corpus); return [v[0] > v[1] && v[1] > v[2], v.map(Math.round).join(', ')]; });
  claim(NPS, 'mistake', 'Treating the projected pension as today’s money.', 'no inflation input: the pension is in future rupees', N, async () => [!keys(NPS).some((k) => /infl/i.test(k)), keys(NPS).join(', ')]);
  claim(NPS, 'mistake', 'Entering an equity-like return for the whole period. If your mix shifts towards bonds near 60, the later years earn less; run a lower rate too.', 'one rate for every year', N, async () => { const r = nps({ age: 58, monthly: 1000, rate: 12 }); let v = 0; for (let m = 0; m < 24; m++) v = (v + 1000) * 1.01; return [near(r.corpus, v, 1e-6), r.corpus]; });
  manual(NPS, 'mistake', 'Forgetting that a level annuity loses buying power every year.', 'about annuities; the tool shows the first month\'s pension');
  claim(NPS, 'dfaq', 'The extra ten years cost ₹12 lakh and add over ₹2.49 crore.', '25 vs 35', N, async () => { const a = nps({ age: 25 }), b = nps({ age: 35 }); return [a.invested - b.invested === 1200000 && a.corpus - b.corpus > 24900000 && a.corpus - b.corpus < 25000000, Math.round(a.corpus - b.corpus)]; });
  claim(NPS, 'dfaq', 'The insurer sets the rate on the day you buy, so check current quotes as you near 60.', 'the annuity rate is an input', N, async () => [input(NPS, 'annuityRate').label === 'Expected annuity rate', input(NPS, 'annuityRate').label]);
  claim(NPS, 'dfaq', 'Yes, up to 100%. On those inputs the pension rises to ₹1,13,966 a month, with no lump sum.', 'no lump sum at 100%', N, async () => { const r = nps({ annuityPct: 100 }); return [r.lumpsum === 0 && r.exemptLumpsum === 0, r.lumpsum]; });
  claim(NPS, 'formula', 'corpus compounds monthly; at least 20% (non-government) or 40% (government) must buy an annuity', 'the minimum follows the sector', N, async () => {
    const a = nps({ annuityPct: 30, sector: 'private' }), b = nps({ annuityPct: 30, sector: 'govt' });
    return [near(a.annuity, a.corpus * 0.3, 1e-6) && near(b.annuity, b.corpus * 0.4, 1e-6) && /government-sector minimum is 40%/.test(b.note), b.note];
  });
  claim(NPS, 'tip', 'Since 16 December 2025, All Citizen and corporate subscribers must use at least 20% of the corpus to buy an annuity and can take up to 80% as a lump sum; government-sector subscribers still need 40%.', 'engine cites the 16 December 2025 amendment; 80% lump sum possible', N, async () => {
    const r = nps({ annuityPct: 20 }); return [near(r.lumpsum, r.corpus * 0.8, 1e-6) && /in force\s+16 December 2025/.test(src(NPS)) && /All Citizen or corporate \(at least 20% annuity\)/.test(input(NPS, 'sector').options[0].label), (r.lumpsum / r.corpus).toFixed(2)];
  });
  claim(NPS, 'tip', 'Only 60% of the corpus is tax-exempt when withdrawn.', '60% either side', N, async () => {
    const a = nps({ annuityPct: 40 }), b = nps({ annuityPct: 30 }); return [near(a.exemptLumpsum, a.lumpsum, 1e-6) && !/Only 60%/.test(a.note) && near(b.exemptLumpsum, b.corpus * 0.6, 1e-6) && b.lumpsum > b.exemptLumpsum, (a.exemptLumpsum / a.corpus).toFixed(2) + ', ' + (b.exemptLumpsum / b.corpus).toFixed(2)];
  });
  claim(NPS, 'tip', 'The annuity rate is quoted by the insurer at the time of purchase and is outside your control. Small differences compound into a materially different pension.', 'one point of annuity rate is a sixth more pension', N, async () => { const a = nps({ annuityRate: 6 }), b = nps({ annuityRate: 7 }); return [near(b.pension / a.pension, 7 / 6, 1e-9), (b.pension / a.pension).toFixed(4)]; });
  manual(NPS, 'tip', 'NPS offers an extra ₹50,000 deduction over and above the ₹1.5 lakh limit — section 124(3) of the Income-tax Act, 2025, formerly 80CCD(1B), on top of section 123, formerly 80C — but only under the old regime.', 'statement of law; no engine holds the ₹50,000 limit or s.124(3) (the NPS tool works no tax deduction)');
  manual(NPS, 'tip', 'Returns depend on your chosen asset allocation. Equity exposure is capped, and the cap reduces automatically with age under the auto choice.', 'scheme rules; the tool takes one expected return');
  claim(NPS, 'faq', 'The lump sum withdrawn at 60 is tax-free up to 60% of the corpus; anything taken above that is not covered by the exemption.', 'the exempt part stops at 60%', N, async () => { const r = nps({ annuityPct: 25 }); return [near(r.exemptLumpsum, 0.6 * r.corpus, 1e-6) && near(r.lumpsum, 0.75 * r.corpus, 1e-6), Math.round(r.exemptLumpsum) + ' of ' + Math.round(r.lumpsum)]; });
  manual(NPS, 'faq', 'The monthly annuity is taxed as income at your slab rate in the year received.', 'statement of law; the tool shows the pension before tax');

  /* ================================================================ */
  const PPF = '/india/ppf-calculator/';
  const ppf = (o) => R(PPF, Object.assign({ annual: 150000, rate: 7.1, years: 15 }, o));
  const ppfRef = (d, r, n) => d * (1 + r) * (Math.pow(1 + r, n) - 1) / r;
  claim(PPF, 'lede', 'Public Provident Fund maturity value over 15 years, with the year-by-year balance.', '15 rows by default, last = maturity', N, async () => { const r = ppf({}); return [r._table.rows.length === 15 && r._table.rows[14][3] === inr(r.maturity) && input(PPF, 'years').default === 15, r._table.rows.length + ' rows']; });
  claim(PPF, 'card', 'Public Provident Fund maturity value over 15 years, with the year-by-year balance.', 'closed form', N, async () => { const r = ppf({}); return [near(r.maturity, ppfRef(150000, 0.071, 15), 1e-6), Math.round(r.maturity)]; });
  claim(PPF, 'why', 'Enter the yearly deposit and rate. Get maturity, year by year.', 'a row a year', N, async () => { const r = ppf({ annual: 50000, rate: 7.5, years: 20 }); return [r._table.rows.length === 20 && r._table.rows.every((x) => x[1] === '₹50,000'), r._table.rows.length]; });
  claim(PPF, 'what', 'Interest is worked out monthly but credited once a year, on 31 March, so the balance grows in yearly steps.', 'yearly interest = rate × balance, no monthly compounding', N, async () => { const r = ppf({ annual: 100000, rate: 12, years: 1 }); return [near(r.interest, 12000, 1e-9), r.interest + ' (monthly compounding would give ' + Math.round(100000 * (Math.pow(1.01, 12) - 1)) + ')']; });
  claim(PPF, 'works', 'The calculator assumes each year’s deposit goes in before 5 April, so it earns interest for the whole year.', 'year 1 interest = deposit × rate', N, async () => { const r = ppf({ annual: 60000 }); return [r._table.rows[0][2] === '₹4,260', r._table.rows[0][2]]; });
  claim(PPF, 'works', 'Each year’s interest is the rate applied to the balance including that deposit, and it is added to the balance carried into the next year.', 'year 2 by hand', N, async () => { const r = ppf({ annual: 100000, rate: 10, years: 2 }); return [near(r.maturity, ((100000 * 1.1) + 100000) * 1.1, 1e-6) && r._table.rows[1][2] === inr(21000), r._table.rows[1].join(' | ')]; });
  claim(PPF, 'works', 'balanceₖ = (balanceₖ₋₁ + D) × (1 + r)', 'recurrence', N, async () => { let b = 0; for (let k = 0; k < 7; k++) b = (b + 80000) * 1.071; const r = ppf({ annual: 80000, years: 7 }); return [near(r.maturity, b, 1e-6), r.maturity]; });
  claim(PPF, 'works', 'maturity = D × (1 + r) × ((1 + r)ⁿ − 1) ÷ r', 'closed form, several inputs', N, async () => { const bad = [[500, 7.1, 15], [150000, 8, 25], [12500, 7.1, 15], [99999, 6.5, 1]].filter(([d, rt, n]) => !near(ppf({ annual: d, rate: rt, years: n }).maturity, ppfRef(d, rt / 100, n), 1e-6)); return [!bad.length, bad.length + ' mismatches']; });
  claim(PPF, 'works', 'the yearly deposit, up to ₹1.5 lakh', 'capped at ₹1.5 lakh, with a note', N, async () => { const a = ppf({ annual: 150000 }), b = ppf({ annual: 150001 }); return [a.maturity === b.maturity && a.capped === '' && /not permitted/.test(b.capped) && input(PPF, 'annual').max === 150000, b.capped]; });
  claim(PPF, 'works', 'the number of years, 15 or more with extensions', 'years beyond 15 accepted', N, async () => { const r = ppf({ years: 25 }); return [r._table.rows.length === 25 && input(PPF, 'years').max >= 25, r._table.rows.length]; });
  claim(PPF, 'worked', 'The five extra years add ₹10,36,031, more than the first fifteen years’ interest of ₹7,27,284.', 'years 16–20 vs 1–15', N, async () => { const a = ppf({ annual: 60000, years: 15 }), b = ppf({ annual: 60000, years: 20 }); const add = Math.round(b.maturity) - Math.round(a.maturity); return [add === 1036031 && add > a.interest, add + ' > ' + Math.round(a.interest)]; });
  claim(PPF, 'use', 'Compare the balance at 15 years with 20 or 25 years to see what an extension adds.', 'longer, larger', N, async () => { const v = [15, 20, 25].map((y) => ppf({ years: y }).maturity); return [v[0] < v[1] && v[1] < v[2], v.map(Math.round).join(', ')]; });
  claim(PPF, 'use', 'Try the full ₹1.5 lakh against a smaller sum that leaves room for other goals.', 'linear in the deposit', N, async () => { const a = ppf({ annual: 150000 }), b = ppf({ annual: 75000 }); return [near(a.maturity, 2 * b.maturity, 1e-6), Math.round(a.maturity) + ', ' + Math.round(b.maturity)]; });
  claim(PPF, 'mistake', 'A deposit made in March earns almost nothing for that year, while the projection assumes every deposit is in by early April.', 'every deposit earns a full year', N, async () => { const r = ppf({ annual: 100000, rate: 8, years: 3 }); return [r._table.rows[0][2] === inr(8000), r._table.rows[0][2]]; });
  manual(PPF, 'mistake', 'An extension without contributions only earns interest on the existing balance; to keep paying in you must choose the extension with deposits within a year of maturity.', 'scheme rule; the tool models extensions with deposits only');
  claim(PPF, 'dfaq', 'That needs two 5-year extensions with deposits after the first 15 years.', '15 years falls short of ₹1 crore, 25 crosses it', N, async () => { const a = ppf({ years: 15 }), b = ppf({ years: 20 }), c = ppf({ years: 25 }); return [a.maturity < 1e7 && b.maturity < 1e7 && c.maturity > 1e7, [a, b, c].map((x) => Math.round(x.maturity)).join(', ')]; });
  claim(PPF, 'dfaq', 'That is why the yearly interest in the schedule rises even when the deposit stays the same.', 'interest column rises', N, async () => { const v = ppf({})._table.rows.map((x) => K.num(x[2])); return [v.every((x, i) => !i || x > v[i - 1]), v.slice(0, 4).join(', ') + ' …']; });
  claim(PPF, 'dfaq', 'The calculator accepts from ₹500, the minimum that keeps an account active.', 'deposit box minimum', N, async () => [input(PPF, 'annual').min === 500, input(PPF, 'annual').min]);
  claim(PPF, 'dfaq', '₹12,500 a year, about ₹1,042 a month', '12,500 ÷ 12', N, async () => [Math.round(12500 / 12) === 1042, 12500 / 12]);
  claim(PPF, 'formula', 'interest accrues annually on the lowest balance between the 5th and end of month', 'a year\'s interest is twelve months at rate ÷ 12 on a constant balance, credited once', N, async () => { const r = ppf({ annual: 120000, rate: 7.2, years: 1 }); return [near(r.interest, 12 * 120000 * 0.072 / 12, 1e-9), r.interest]; });
  manual(PPF, 'tip', 'PPF is EEE: the deposit qualifies for the ₹1.5 lakh deduction (section 123 of the Income-tax Act, 2025, formerly 80C), the interest is exempt and the maturity amount is tax-free.', 'statement of law; no tax figure on this page (s.123 = 80C agrees with the income tax page)');
  manual(PPF, 'tip', 'The rate is set quarterly by the government and has moved over time, so treat any projection over fifteen years as indicative.', 'about the scheme; the tool uses one rate for every year');
  claim(PPF, 'tip', 'Interest is calculated on the lowest balance between the 5th and the last day of each month, so depositing before the 5th earns an extra month of interest.', 'the tool takes every deposit as made before the 5th of April', N, async () => { const r = ppf({ annual: 100000, rate: 7.1, years: 1 }); return [near(r.interest, 7100, 1e-9), r.interest]; });
  claim(PPF, 'tip', 'The maximum is ₹1.5 lakh per financial year across all PPF accounts you hold.', 'capped', N, async () => { const r = ppf({ annual: 300000 }); return [r.invested === 150000 * 15, r.invested]; });
  manual(PPF, 'tip', 'The account runs 15 years and can be extended in blocks of 5.', 'scheme rule; the period box accepts any whole number of years');
  manual(PPF, 'faq', 'The 80C deduction is not available under the new regime, which removes part of the appeal.', 'statement of law; no tax figure on this page');

  /* ================================================================ */
  const SIP = '/india/sip-calculator/';
  const sip = (o) => R(SIP, Object.assign({ monthly: 10000, rate: 12, years: 15, stepup: 0 }, o));
  const sipRef = (p, rt, y) => { const i = rt / 1200, n = y * 12; return p * (Math.pow(1 + i, n) - 1) / i * (1 + i); };
  claim(SIP, 'lede', 'Project the future value of a systematic investment plan, with optional annual step-up.', 'flat SIP = formula; step-up raises it', N, async () => { const a = sip({}), b = sip({ stepup: 5 }); return [near(a.value, sipRef(10000, 12, 15), 1e-6) && b.value > a.value && input(SIP, 'stepup').default === 0, Math.round(a.value) + ', ' + Math.round(b.value)]; });
  claim(SIP, 'card', 'Project the future value of a systematic investment plan, with optional annual step-up.', 'a second case', N, async () => { const r = sip({ monthly: 2500, rate: 9, years: 7 }); return [near(r.value, sipRef(2500, 9, 7), 1e-6), r.value]; });
  claim(SIP, 'why', 'Enter SIP, return, years and step-up. See maturity and wealth gained.', 'wealth gained = value − invested', N, async () => { const r = sip({ stepup: 10 }); return [near(r.returns, r.value - r.invested, 1e-9) && r.returns > 0, Math.round(r.returns)]; });
  claim(SIP, 'what', 'A step-up SIP raises the instalment by a set percentage once a year', 'the instalment in each year', N, async () => { const r = sip({ monthly: 10000, years: 3, stepup: 10 }); const inv = r._table.rows.map((x) => K.num(x[1])); return [j(inv) === j([120000, 252000, 397200]) && near(r.finalMonthly, 12100, 1e-9), inv.join(', ')]; });
  claim(SIP, 'works', 'The yearly return is divided by 12 to give a monthly one, and each instalment goes in at the start of the month, so it earns that month’s return too.', 'one instalment, one month', N, async () => { const r = sip({ monthly: 1000, rate: 12, years: 1 / 12 }); return [near(r.value, 1010, 1e-9), r.value]; });
  claim(SIP, 'works', 'With a step-up, the instalment rises after every twelfth payment.', 'months 12 and 13', N, async () => { const a = sip({ monthly: 1000, rate: 0, years: 1, stepup: 50 }), b = sip({ monthly: 1000, rate: 0, years: 13 / 12, stepup: 50 }); return [a.invested === 12000 && b.invested === 13500, a.invested + ', ' + b.invested]; });
  claim(SIP, 'works', 'FV = P × ((1 + i)ⁿ − 1) ÷ i × (1 + i)', 'several inputs', N, async () => { const bad = [[500, 8, 3], [20000, 12, 15], [10000, 12, 25], [7777, 14.5, 30]].filter(([p, rt, y]) => !near(sip({ monthly: p, rate: rt, years: y }).value, sipRef(p, rt, y), 1e-6)); return [!bad.length, bad.length + ' mismatches']; });
  claim(SIP, 'works', 'with step-up s: instalment in year k = P × (1 + s)ᵏ⁻¹', 'final instalment', N, async () => { const r = sip({ monthly: 15000, years: 10, stepup: 5 }); return [near(r.finalMonthly, 15000 * Math.pow(1.05, 9), 1e-6), r.finalMonthly]; });
  claim(SIP, 'worked', 'After the first year ₹1,80,000 has gone in and is worth ₹1,91,094.', 'year-1 row', N, async () => { const r = sip({ monthly: 15000, rate: 11, years: 10, stepup: 5 }); const row = rowR(r._table.rows[0]); return [row[1] === '₹1,80,000' && row[2] === '₹1,91,094', row.join(' | ')]; });
  claim(SIP, 'use', 'Find the monthly amount that reaches a target, such as a home down payment, in a set number of years.', 'value in proportion to the instalment, so the amount scales to the target', N, async () => { const a = sip({ monthly: 10000, years: 5 }), b = sip({ monthly: 25000, years: 5 }); return [near(b.value, 2.5 * a.value, 1e-6), Math.round(a.value) + ', ' + Math.round(b.value)]; });
  claim(SIP, 'use', 'Compare a flat SIP with one that rises 5% or 10% a year before you set it up.', '0, 5, 10%', N, async () => { const v = [0, 5, 10].map((s) => sip({ stepup: s }).value); return [v[0] < v[1] && v[1] < v[2], v.map(Math.round).join(', ')]; });
  claim(SIP, 'use', 'Check whether your fund’s value is ahead of or behind what your assumed return implies.', 'the year-by-year value', N, async () => { const r = sip({}); return [r._table.rows.length === 15 && j(r._table.head) === j(['Year', 'Invested', 'Value', 'Gain']), r._table.head.join(', ')]; });
  claim(SIP, 'mistake', 'The calculator compounds 1% a month, which works out at about 12.68% a year, so to project a fund’s 12% CAGR like for like, enter about 11.39%.', '12% = 1% a month; 11.39% ≈ 12% a year', N, async () => {
    const a = sip({ monthly: 1000, rate: 12, years: 1 / 12 }); const eff = (Math.pow(1.01, 12) - 1) * 100;
    const b = sip({ monthly: 10000, rate: 11.39, years: 10 }), want = sipRef(10000, 1200 * (Math.pow(1.12, 1 / 12) - 1), 10);
    return [near(a.value, 1010, 1e-9) && eff.toFixed(2) === '12.68' && Math.abs(b.value / want - 1) < 0.001, eff.toFixed(3) + '%; 11.39% gives ' + Math.round(b.value) + ' vs ' + Math.round(want)];
  });
  claim(SIP, 'mistake', 'Judging the return by gain over amount invested. ₹39,55,280 on ₹22,64,021 looks modest for 10 years', 'the tool shows a growth multiple, not a yearly return', N, async () => [!(S(SIP).outputs || []).some((o) => /xirr|cagr|annual/i.test(o.label + o.key)), (S(SIP).outputs || []).map((o) => o.label).join(', ')]);
  manual(SIP, 'mistake', 'measure a SIP’s yearly return as XIRR', 'advice; the tool does not work out XIRR');
  manual(SIP, 'mistake', 'Stopping a SIP during a market fall. The instalments made when prices are low buy the most units, so pausing then removes the part of the plan that does the most work.', 'about market behaviour; the tool assumes a steady return');
  manual(SIP, 'what', 'Each instalment buys units at that day’s NAV, so more units are bought when prices are low and fewer when they are high.', 'how SIPs work; the tool models a steady return, not NAVs');
  manual(SIP, 'dfaq', 'Fund houses let you change the amount, skip a few instalments or stop the SIP without a penalty; only units redeemed within the fund’s exit-load period cost extra.', 'fund-house practice');
  claim(SIP, 'formula', 'FV = P × [((1+i)ⁿ − 1) / i] × (1+i)', '0% return gives the sum invested', N, async () => { const r = sip({ rate: 0 }); return [r.value === 1800000 && r.invested === 1800000, r.value]; });
  manual(SIP, 'tip', 'Equity funds have historically averaged around 11–13% over long periods, but with years of double-digit losses along the way.', 'about market history, not the tool');
  claim(SIP, 'tip', 'A step-up of even 10% a year makes a dramatic difference over fifteen years — usually more than chasing a slightly better fund.', '10% step-up at 12% beats a flat SIP at 14%', N, async () => { const a = sip({ stepup: 10 }), b = sip({ rate: 14 }); return [a.value > b.value * 1.3, Math.round(a.value) + ' vs ' + Math.round(b.value)]; });
  claim(SIP, 'tip', 'Returns here are before tax. Equity fund gains above ₹1.25 lakh a year are taxed at 12.5% long term.', 'no tax here; the capital gains engine has ₹1.25 lakh and 12.5%', N, async () => {
    const r = sip({}); const c = R(CG, { asset: 'equity', sale: 425100, cost: 300000, months: 13 });
    return [near(r.returns, r.value - r.invested, 1e-9) && c.exemption === 125000 && c.rate === 12.5 && c.taxable === 100, 'capital gains: exemption ' + c.exemption + ', rate ' + c.rate + '%'];
  });
  claim(SIP, 'tip', 'This assumes contributions at the start of each month and a constant return.', 'start of month', N, async () => { const r = sip({ monthly: 1000, rate: 6, years: 2 / 12 }); return [near(r.value, (1000 * 1.005 + 1000) * 1.005, 1e-9), r.value]; });
  manual(SIP, 'faq', 'It spreads entry price across time, which reduces the risk of investing everything at a peak. Over long horizons in a rising market, lump-sum investing has often produced more.', 'about market history and behaviour');

  /* ================================================================ */
  const TDS = '/india/tds-calculator/';
  const tds = (o) => R(TDS, Object.assign({ section: '194J_prof', amount: 100000, pan: 'yes', lastRent: 0 }, o));
  const TDS_RATES = { '194C_ind': 1, '194C_oth': 2, '194J_tech': 2, '194J_prof': 10, '194I_pm': 2, '194I_land': 10, '194H': 2, '194A': 10, '194Q': 0.1, '194IB': 2 };
  claim(TDS, 'lede', 'Tax deducted at source on common payments to residents, with the higher rate where PAN is not furnished.', 'the higher rate without PAN', N, async () => { const a = tds({}), b = tds({ pan: 'no', section: '194C_ind' }); return [a.tds === 10000 && b.rate === 20 && b.tds === 20000, a.tds + ', ' + b.tds]; });
  claim(TDS, 'card', 'Tax deducted at source on common payments to residents, with the higher rate where PAN is not furnished.', 'every option at its rate', N, async () => { const bad = Object.keys(TDS_RATES).filter((k) => tds({ section: k, amount: 1000000 }).tds !== 1000000 * TDS_RATES[k] / 100); return [!bad.length && optVals(TDS, 'section').join() === Object.keys(TDS_RATES).join(), bad.join(', ') || 'all ten']; });
  claim(TDS, 'lede', 'Income-tax Act, 2025 (section 393) from 1 April 2026, with the 1961 Act section each payment used to fall under.', 'provision names s.393(1) and the old section', N, async () => { const r = tds({ section: '194I_land' }); return [r.section === 'Income-tax Act, 2025 s.393(1) Table Sl. 2(ii) (was 194-I of the 1961 Act)', r.section]; });
  claim(TDS, 'why', 'Pick the section, enter the payment. Get the TDS and the net payable.', 'net = payment − TDS', N, async () => { const r = tds({ amount: 150000, pan: 'no' }); return [r.tds === 30000 && r.netPayable === 120000, r.tds + ', ' + r.netPayable]; });
  claim(TDS, 'why', 'what if PAN is missing?', 'the PAN select', N, async () => [optVals(TDS, 'pan').join() === 'yes,no', input(TDS, 'pan').options.map((o) => o.label).join(' | ')]);
  claim(TDS, 'what', 'Each kind of payment, from contract work to rent, has its own rate, all in section 393 of the Income-tax Act, 2025 from FY 2026-27', 'every provision line names s.393(1)', N, async () => { const bad = Object.keys(TDS_RATES).filter((k) => !/^Income-tax Act, 2025 s\.393\(1\) Table Sl\./.test(tds({ section: k }).section)); return [!bad.length, bad.join(', ') || 'all ten']; });
  claim(TDS, 'what', 'The tool covers ten common payments.', 'ten options', N, async () => [optVals(TDS, 'section').length === 10, optVals(TDS, 'section').length]);
  claim(TDS, 'works', 'Without a PAN the tool applies the higher of that rate or 20% (5% for goods), caps rent paid by an individual at one month’s rent, and shows the extra separately.', 'no PAN on each option; the rent cap; the extra', N, async () => {
    const bad = Object.keys(TDS_RATES).filter((k) => k !== '194IB' && tds({ section: k, pan: 'no' }).rate !== Math.max(TDS_RATES[k], k === '194Q' ? 5 : 20));
    const rent = tds({ section: '194IB', pan: 'no', amount: 720000 }), rent2 = tds({ section: '194IB', pan: 'no', amount: 720000, lastRent: 50000 });
    const ex = tds({ section: '194J_tech', pan: 'no', amount: 100000 });
    return [!bad.length && rent.tds === 60000 && /Capped/.test(rent.note) && rent2.tds === 50000 && ex.uplift === 18000, 'rent: ' + rent.tds + ' / ' + rent2.tds + '; extra on tech ' + ex.uplift];
  });
  claim(TDS, 'works', 'TDS = payment × rate ÷ 100', 'TDS', N, async () => { const r = tds({ section: '194H', amount: 33333 }); return [near(r.tds, 666.66, 1e-9), r.tds]; });
  claim(TDS, 'works', 'net payable = payment − TDS', 'net', N, async () => { const r = tds({ section: '194A', amount: 45000 }); return [r.netPayable === 40500, r.netPayable]; });
  claim(TDS, 'works', 'without PAN: TDS = payment × max(rate, 20) ÷ 100, or max(rate, 5) for goods', 'goods 5%, others 20%', N, async () => { const a = tds({ section: '194Q', pan: 'no', amount: 1000000 }), b = tds({ section: '194I_land', pan: 'no', amount: 100000 }); return [a.tds === 50000 && b.tds === 20000, a.tds + ', ' + b.tds]; });
  claim(TDS, 'works', 'extra for missing PAN = TDS − payment × rate ÷ 100', 'uplift', N, async () => { const r = tds({ section: '194C_oth', pan: 'no', amount: 80000 }); return [r.uplift === 16000 - 1600, r.uplift]; });
  claim(TDS, 'works', 'the rate for that nature of payment, such as 1% or 2% for contract work (194C)', '194C', N, async () => [tds({ section: '194C_ind' }).baseRate === 1 && tds({ section: '194C_oth' }).baseRate === 2, 'ok']);
  claim(TDS, 'worked', 'If the contractor has not given a PAN the rate becomes 20%', '194C individual, no PAN', N, async () => { const r = tds({ section: '194C_ind', amount: 250000, pan: 'no' }); return [r.rate === 20 && r.baseRate === 1, r.rate]; });
  claim(TDS, 'use', 'Apply 194C at 1% for an individual or HUF and 2% for a firm or company.', '194C rates and labels', N, async () => { const o = input(TDS, 'section').options; return [tds({ section: '194C_ind' }).baseRate === 1 && tds({ section: '194C_oth' }).baseRate === 2 && /individual\/HUF\) 1%/.test(o[0].label), o[0].label + ' | ' + o[1].label]; });
  claim(TDS, 'use', 'Deduct 10% on land and buildings, or 2% on hired plant and machinery.', '194-I', N, async () => [tds({ section: '194I_land' }).baseRate === 10 && tds({ section: '194I_pm' }).baseRate === 2, 'ok']);
  claim(TDS, 'use', 'Separate technical services at 2% from professional fees at 10% under 194J.', '194J', N, async () => [tds({ section: '194J_tech' }).baseRate === 2 && tds({ section: '194J_prof' }).baseRate === 10, 'ok']);
  manual(TDS, 'use', 'As a payee, confirm that the TDS in your Annual Information Statement matches the invoice.', 'advice about the AIS');
  claim(TDS, 'mistake', 'Where GST is shown separately on the invoice, deduct on the amount before GST.', 'no GST input: enter the amount before GST', N, async () => [j(keys(TDS)) === j(['section', 'amount', 'pan', 'lastRent']), keys(TDS).join(', ')]);
  claim(TDS, 'mistake', 'Technical services carry 2% and professional fees 10%; on an ₹80,000 invoice that is ₹1,600 against ₹8,000.', '₹80,000 both ways', N, async () => [tds({ section: '194J_tech', amount: 80000 }).tds === 1600 && tds({ section: '194J_prof', amount: 80000 }).tds === 8000, 'ok']);
  manual(TDS, 'dfaq', 'Companies, firms and other businesses making the listed payments, and individuals or HUFs whose turnover required a tax audit in the previous year.', 'statement of law about who deducts');
  manual(TDS, 'dfaq', 'Interest runs for each month or part of a month of delay, and a late quarterly statement adds a fee for every day.', 'statement of law; the tool does not work out late-deposit interest');
  manual(TDS, 'dfaq', 'TDS is credited against the year’s tax and any surplus is refunded', 'statement of law about refunds');
  claim(TDS, 'dfaq', 'No. Salary TDS is based on the employee’s estimated tax for the year at slab rates, not a flat section rate', 'no salary option', N, async () => [!input(TDS, 'section').options.some((o) => /salary|192/i.test(o.label + o.value)), 'no 192 option']);
  claim(TDS, 'formula', 'TDS = payment × rate; without PAN, the higher of that rate or 20% (5% for purchase of goods)', 'professional fees without PAN stay at 20%', N, async () => { const r = tds({ section: '194J_prof', pan: 'no' }); return [r.rate === 20 && r.tds === 20000, r.rate]; });
  claim(TDS, 'tip', 'Since 1 April 2026 TDS on these payments is under section 393 of the Income-tax Act, 2025, which replaced sections 192 to 194T of the 1961 Act.', 'engine cites s.393(1) replacing 192–194T', N, async () => [/section 393\(1\) of the\s+Income-tax Act, 2025[\s\S]{0,80}replaced sections 192–194T/.test(src(TDS)), 'engine comment']);
  claim(TDS, 'tip', 'the option labels give the old section numbers people still use', 'every label names the old section', N, async () => [input(TDS, 'section').options.every((o) => /— was 194/.test(o.label)), input(TDS, 'section').options.map((o) => o.label.replace(/.*— /, '')).join(', ')]);
  claim(TDS, 'tip', 'The rates carried over unchanged', 'engine: the Finance Act, 2026 changed no TDS rate', N, async () => [/The Finance Act, 2026 changed no TDS rate/.test(src(TDS)), 'engine comment']);
  claim(TDS, 'tip', 'This tool applies the rate; check the current threshold before deciding not to deduct.', 'no threshold: ₹1,000 still gets TDS', N, async () => { const r = tds({ section: '194C_ind', amount: 1000 }); return [r.tds === 10, r.tds]; });
  claim(TDS, 'tip', 'Without the payee’s PAN, tax is deducted at the higher of the normal rate or 20% (5% for purchase of goods) — section 397(2) of the 2025 Act, formerly section 206AA.', 'either side of 20%, and the engine cites s.397(2)', N, async () => {
    const a = tds({ section: '194A', pan: 'no' }), b = tds({ section: '194Q', pan: 'no' }); return [a.rate === 20 && b.rate === 5 && /s\.397\(2\)\(b\)\(i\), successor of s\.206AA/.test(src(TDS)), a.rate + ', ' + b.rate];
  });
  claim(TDS, 'tip', 'It is not doubled: the twice-the-rate rule for non-filers (section 206AB) was abolished from 1 April 2025.', 'no PAN on 2% is 20%, not 4%; 0.1% goods is 5%, not 0.2%', N, async () => {
    const a = tds({ section: '194H', pan: 'no' }), b = tds({ section: '194Q', pan: 'no' }); return [a.rate === 20 && b.rate === 5 && /omitted from 1 April 2025 by the Finance Act, 2025/.test(src(TDS)), a.rate + ', ' + b.rate];
  });
  manual(TDS, 'tip', 'TDS is generally deducted at payment or credit, whichever is earlier, and must be deposited by the 7th of the following month.', 'statement of law about timing');
  manual(TDS, 'tip', 'Failure to deduct can mean the expense is disallowed, not merely a penalty — often the larger cost.', 'statement of law about disallowance');
  manual(TDS, 'faq', 'Yes, most commonly at each Union Budget, and thresholds change more often than rates.', 'about how rates change');
};
