#!/usr/bin/env node
/**
 * The wave 5 calculators against figures worked by hand or published by
 * the authority, never against the engines' own output.
 *
 *   node build/tests/calc-wave5.js [--root DIR]
 *
 * Each engine is loaded as build/content/_engine.js loads it: a plain
 * browser script run in a fresh vm context with a stub window. The
 * references below are written out here, independently of the engines:
 *
 *   EMI / loan    the annuity formula, a month-by-month simulation written
 *                 here (overpayments, part-prepayment, step-up), the APR by
 *                 bisection on the cash flows; published figures: ₹50 lakh
 *                 at 8.5% for 20 years is ₹43,391 a month, £250,000 at 6.5%
 *                 over 30 years is £1,580.17.
 *   SIP           FV of an annuity due, a simulation for step-ups, the goal
 *                 solved by dividing by the FV of ₹1 a month.
 *   Compound      A = P(1 + r/n)^(nt); contributions at their own frequency
 *                 at the equivalent periodic rate (1 + r/n)^(n/m) − 1.
 *   Income tax    FY 2026-27 slabs, cess, 87A and its marginal relief,
 *                 surcharge and its marginal relief at ₹50 lakh and ₹1
 *                 crore, the 80C cap, the HRA least-of-three rule, 111A /
 *                 112A rates and the ₹1.25 lakh 112A exemption: each case
 *                 is worked out line by line in the comment beside it.
 *   BMI           adults by kg ÷ m², NICE thresholds; children against the
 *                 CDC's own published centile columns (P5 … P95) in
 *                 build/tests/fixtures/cdc-bmiagerev.csv, which the engine
 *                 does not read (it carries its own L, M, S).
 *   GST, %, tip   arithmetic written out.
 *   Scientific    known values (sin 30° = 0.5, 52C5 = 2,598,960 …).
 *   Units         5 ft 11 in = 180.34 cm, 11 st 4 lb = 71.6676 kg …
 *   Rates history its shape, and its last day against assets/rates.json.
 *
 * Exit code 1 when anything fails.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));

let pass = 0, fail = 0;
function ok(cond, name, detail) {
  if (cond) pass++;
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '   (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) + ')' : '')); }
}
const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= (tol === undefined ? 0.005 : tol);
function close(a, b, name, tol) { ok(near(a, b, tol), name, { got: a, want: b }); }

function sandbox() {
  const window = { TOOLS: {} };
  return { window, ctx: vm.createContext({ window, console, Intl, Math, Date, Number, String, Array, Object, JSON, isFinite, isNaN, parseFloat, parseInt, RegExp }) };
}
const cache = {};
function tool(slug) {
  if (cache[slug]) return cache[slug];
  const { window, ctx } = sandbox();
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine', 'calc-' + slug + '.js'), 'utf8'), ctx, { filename: 'calc-' + slug + '.js' });
  const t = window.TOOLS[slug];
  const run = (over) => {
    const v = {};
    t.inputs.forEach((i) => { let d = i.default; if (i.type === 'number') d = d === null || d === undefined || d === '' ? null : Number(d); v[i.key] = d; });
    Object.assign(v, over || {});
    return t.compute(v);
  };
  cache[slug] = { t, run };
  return cache[slug];
}

/* ---------------- references written here ---------------- */
function annuity(P, annualPct, n) {
  const r = annualPct / 1200;
  return r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}
/* A reducing-balance loan month by month: interest on what is owed, the
   rest of the payment off the balance, the last payment only what is left. */
function simulate(P, annualPct, pay, o) {
  o = o || {};
  const r = annualPct / 1200;
  let bal = P, k = 0, interest = 0;
  while (bal > 0.5 && k < 1200) {
    k++;
    const i = bal * r;
    let p = pay * Math.pow(1 + (o.step || 0) / 100, Math.floor((k - 1) / 12)) + (o.extra || 0) + (k === o.lumpMonth ? o.lump || 0 : 0);
    if (p - i > bal) p = bal + i;
    bal -= p - i; interest += i;
  }
  return { months: k, interest };
}

/* ================= EMI (India) ================= */
(function emi() {
  const { run } = tool('emi-calculator');
  const r = run({ amount: 5000000, rate: 8.5, years: 20 });
  ok(Math.round(r.emi) === 43391, 'EMI: ₹50 lakh at 8.5% for 20 years is ₹43,391 (bank-published figure)', r.emi);
  close(r.emi, annuity(5000000, 8.5, 240), 'EMI: equals the annuity formula');
  close(r.totalInterest, annuity(5000000, 8.5, 240) * 240 - 5000000, 'EMI: total interest = 240 EMIs − principal', 0.01);
  const rows = r._table && (r._table.views ? r._table.views[0].rows : r._table.rows);
  ok(rows && rows.length === 20, 'EMI: a yearly schedule of 20 rows', rows && rows.length);
  if (rows) {
    close(rows.reduce((s, x) => s + x[1], 0), 5000000, 'EMI: yearly principal adds up to the loan', 1);
    close(rows[19][3], 0, 'EMI: the balance ends at 0', 1);
    /* year 1 interest by hand: sum over 12 months of balance × r */
    let b = 5000000, i1 = 0; const e = annuity(5000000, 8.5, 240);
    for (let m = 0; m < 12; m++) { const i = b * 8.5 / 1200; i1 += i; b -= e - i; }
    close(rows[0][2], i1, 'EMI: year 1 interest matches a hand simulation', 0.01);
  }
  const mv = r._table && r._table.views && r._table.views[1];
  ok(mv && mv.rows.length === 240, 'EMI: a monthly view of 240 rows', mv && mv.rows.length);

  const pre = run({ amount: 5000000, rate: 8.5, years: 20, prepay: 5000 });
  const sp = simulate(5000000, 8.5, annuity(5000000, 8.5, 240), { extra: 5000 });
  ok(pre.months === sp.months, 'EMI: ₹5,000 a month extra closes the loan in the simulated number of months', { got: pre.months, want: sp.months });
  close(pre.totalInterest, sp.interest, 'EMI: prepaying ₹5,000 a month: interest as simulated', 1);
  close(pre.interestSaved, r.totalInterest - sp.interest, 'EMI: interest saved = without − with', 1);

  const lump = run({ amount: 5000000, rate: 8.5, years: 20, lump: 500000, lumpMonth: 24 });
  const sl = simulate(5000000, 8.5, annuity(5000000, 8.5, 240), { lump: 500000, lumpMonth: 24 });
  ok(lump.months === sl.months, 'EMI: a ₹5 lakh part-prepayment in month 24 shortens the loan as simulated', { got: lump.months, want: sl.months });
  close(lump.totalInterest, sl.interest, 'EMI: part-prepayment interest as simulated', 1);

  const st = run({ amount: 5000000, rate: 8.5, years: 20, stepUp: 5 });
  const ss = simulate(5000000, 8.5, annuity(5000000, 8.5, 240), { step: 5 });
  ok(st.months === ss.months, 'EMI: a 5% yearly step-up closes the loan as simulated', { got: st.months, want: ss.months });
  close(st.totalInterest, ss.interest, 'EMI: step-up interest as simulated', 1);

  /* floating rate: 8.5% for 5 years, then 9.5%, keeping the tenure: the new
     EMI is the annuity on the balance after 60 EMIs over the 180 months left */
  const fl = run({ amount: 5000000, rate: 8.5, years: 20, changeYear: 5, newRate: 9.5, keep: 'tenure' });
  let b = 5000000; const e0 = annuity(5000000, 8.5, 240);
  for (let m = 0; m < 60; m++) b -= e0 - b * 8.5 / 1200;
  close(fl.emiAfter, annuity(b, 9.5, 180), 'EMI: a reset to 9.5% after 5 years, tenure kept: new EMI = annuity on the balance left', 0.01);

  /* processing fee 1%: the effective annual rate X with Σ EMI ÷ (1+X)^(k/12) = P − fee */
  const fee = run({ amount: 1000000, rate: 10, years: 5, feePct: 1 });
  const E = annuity(1000000, 10, 60), net = 990000;
  let lo = 0, hi = 1;
  for (let it = 0; it < 200; it++) { const x = (lo + hi) / 2; let pv = 0; for (let k = 1; k <= 60; k++) pv += E / Math.pow(1 + x, k / 12); if (pv > net) lo = x; else hi = x; }
  ok(near(fee.fee, 10000, 0.01), 'EMI: a 1% fee on ₹10 lakh is ₹10,000', fee.fee);
  close(fee.apr, (lo + hi) / 2 * 100, 'EMI: effective annual cost with the fee, by bisection on the cash flows', 0.01);
})();

/* ================= Loan payment (UK) ================= */
(function loan() {
  const { run } = tool('loan-payment');
  const r = run({ amount: 250000, rate: 6.5, years: 30 });
  close(r.monthly, 1580.17, '£250,000 at 6.5% over 30 years: £1,580.17 a month (published amortisation figure)', 0.005);
  close(r.totalInterest, annuity(250000, 6.5, 360) * 360 - 250000, 'loan: total interest = 360 payments − principal', 0.01);
  const ex = run({ amount: 250000, rate: 6.5, years: 30, extra: 200 });
  const se = simulate(250000, 6.5, annuity(250000, 6.5, 360), { extra: 200 });
  close(ex.totalInterest, se.interest, 'loan: £200 a month overpaid: interest as simulated', 1);
  close(ex.interestSaved, r.totalInterest - se.interest, 'loan: interest saved by overpaying', 1);
  ok(typeof ex.payoff === 'string' && ex.payoff.indexOf(String(Math.floor(se.months / 12))) >= 0, 'loan: pay-off time names ' + Math.floor(se.months / 12) + ' years', ex.payoff);
  /* APR with £1,000 upfront fees: the yearly rate X with Σ M ÷ (1+X)^(k/12) = 249,000 */
  const f = run({ amount: 250000, rate: 6.5, years: 30, fees: 1000, feeHow: 'upfront' });
  const M = annuity(250000, 6.5, 360);
  let lo = 0, hi = 1;
  for (let it = 0; it < 200; it++) { const x = (lo + hi) / 2; let pv = 0; for (let k = 1; k <= 360; k++) pv += M / Math.pow(1 + x, k / 12); if (pv > 249000) lo = x; else hi = x; }
  close(f.apr, (lo + hi) / 2 * 100, 'loan: APR with £1,000 upfront fees (FCA method, bisection here)', 0.01);
  const two = run({ amount: 250000, rate: 6.5, years: 30, rateB: 5.5, yearsB: 25, amountB: 250000 });
  close(two.monthlyB, annuity(250000, 5.5, 300), 'loan: the second loan’s payment', 0.01);
  close(two.totalInterestB, annuity(250000, 5.5, 300) * 300 - 250000, 'loan: the second loan’s interest', 0.05);
})();

/* ================= SIP ================= */
(function sip() {
  const { run } = tool('sip-calculator');
  const i = 0.01, n = 180;
  const fv1 = ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
  const r = run({ mode: 'grow', monthly: 10000, rate: 12, years: 15 });
  ok(Math.round(r.value) === 5045760, 'SIP: ₹10,000 a month at 12% for 15 years is ₹50,45,760 (annuity due)', r.value);
  close(r.value, 10000 * fv1, 'SIP: equals 10,000 × FV of ₹1 a month', 0.01);
  ok(r.invested === 1800000, 'SIP: invested ₹18 lakh', r.invested);
  const g = run({ mode: 'goal', goal: 5000000, rate: 12, years: 15 });
  close(g.required, 5000000 / fv1, 'SIP goal: ₹50 lakh in 15 years at 12% needs ₹' + (5000000 / fv1).toFixed(2) + ' a month', 0.01);
  /* step-up 10% a year: simulate */
  let v = 0, c = 10000;
  for (let m = 1; m <= n; m++) { v = (v + c) * (1 + i); if (m % 12 === 0) c = c * 1.1; }
  const su = run({ mode: 'grow', monthly: 10000, rate: 12, years: 15, stepup: 10 });
  close(su.value, v, 'SIP: a 10% yearly step-up, simulated month by month', 1);
  let v2 = 0, c2 = 10000;
  for (let m = 1; m <= n; m++) { v2 = (v2 + c2) * (1 + i); if (m % 12 === 0) c2 = c2 + 1000; }
  const sa = run({ mode: 'grow', monthly: 10000, rate: 12, years: 15, stepAmt: 1000 });
  close(sa.value, v2, 'SIP: a fixed ₹1,000 yearly step-up, simulated', 1);
  const lu = run({ mode: 'grow', monthly: 10000, rate: 12, years: 15, lump: 100000 });
  close(lu.value, 10000 * fv1 + 100000 * Math.pow(1 + i, n), 'SIP: plus a ₹1 lakh lump sum compounded monthly for 15 years', 1);
  const inf = run({ mode: 'grow', monthly: 10000, rate: 12, years: 15, inflation: 6 });
  close(inf.realValue, 10000 * fv1 / Math.pow(1.06, 15), 'SIP: in today’s money at 6% inflation = value ÷ 1.06¹⁵', 1);
  /* goal with a step-up: the answer, invested, reaches the goal */
  const gs = run({ mode: 'goal', goal: 5000000, rate: 12, years: 15, stepup: 10 });
  let v3 = 0, c3 = gs.required;
  for (let m = 1; m <= n; m++) { v3 = (v3 + c3) * (1 + i); if (m % 12 === 0) c3 = c3 * 1.1; }
  close(v3, 5000000, 'SIP goal with a 10% step-up: the answer, simulated, reaches ₹50 lakh', 1);
})();

/* ================= Compound interest ================= */
(function ci() {
  const { run } = tool('compound-interest');
  const r = run({ principal: 10000, rate: 7, years: 10, freq: 12 });
  close(r.total, 10000 * Math.pow(1 + 0.07 / 12, 120), 'compound: £10,000 at 7% monthly for 10 years = £20,096.61', 0.01);
  close(r.total, 20096.61, 'compound: £20,096.61 to the penny', 0.005);
  close(r.effectiveRate, (Math.pow(1 + 0.07 / 12, 12) - 1) * 100, 'compound: AER 7.229%', 1e-6);
  const c = run({ principal: 0, rate: 5, years: 10, freq: 12, contribution: 100, contribFreq: 'period', timing: 'end' });
  const ic = 0.05 / 12;
  close(c.total, 100 * (Math.pow(1 + ic, 120) - 1) / ic, 'compound: £100 a month at 5% for 10 years, paid at the end', 0.01);
  const cs = run({ principal: 0, rate: 5, years: 10, freq: 12, contribution: 100, contribFreq: 'period', timing: 'start' });
  close(cs.total, 100 * (Math.pow(1 + ic, 120) - 1) / ic * (1 + ic), 'compound: the same paid at the start (annuity due)', 0.01);
  /* monthly contributions into yearly compounding: the equivalent monthly rate */
  const cy = run({ principal: 0, rate: 5, years: 10, freq: 1, contribution: 100, contribFreq: '12', timing: 'end' });
  const j = Math.pow(1.05, 1 / 12) - 1;
  close(cy.total, 100 * (Math.pow(1 + j, 120) - 1) / j, 'compound: £100 a month into yearly compounding at the equivalent monthly rate', 0.01);
  const inf = run({ principal: 10000, rate: 7, years: 10, freq: 12, inflation: 3 });
  close(inf.realTotal, 10000 * Math.pow(1 + 0.07 / 12, 120) / Math.pow(1.03, 10), 'compound: in today’s money at 3% inflation', 0.01);
})();

/* ================= India income tax, FY 2026-27 =================
   New regime (s.115BAC as amended by the Finance Act 2025, carried into
   FY 2026-27): 0-4L nil, 4-8L 5%, 8-12L 10%, 12-16L 15%, 16-20L 20%,
   20-24L 25%, above 24L 30%; standard deduction ₹75,000; 87A rebate up to
   ₹60,000 when total income ≤ ₹12 lakh, with marginal relief just above.
   Old regime: 0-2.5L nil, 2.5-5L 5%, 5-10L 20%, above 30%; standard
   deduction ₹50,000. Cess 4%. Surcharge 10% above ₹50 lakh, 15% above
   ₹1 crore, with marginal relief. */
(function tax() {
  const { run } = tool('india-income-tax');
  const base = { fy: '2026-27', type: 'salaried', age: 'below60', dedMode: 'total', deductions: 0 };
  // ₹15 lakh, ₹2 lakh deductions in the old regime.
  // New: 14,25,000 taxable: 20,000 + 40,000 + 15% × 2,25,000 = 33,750 → 93,750 + 4% = 97,500.
  // Old: 12,50,000 taxable: 12,500 + 1,00,000 + 30% × 2,50,000 = 75,000 → 1,87,500 + 4% = 1,95,000.
  const a = run(Object.assign({}, base, { gross: 1500000, deductions: 200000 }));
  ok(a.newTotal === 97500, 'tax: ₹15 lakh, new regime ₹97,500', a.newTotal);
  ok(a.oldTotal === 195000, 'tax: ₹15 lakh with ₹2 lakh deductions, old regime ₹1,95,000', a.oldTotal);
  // Taxable exactly ₹12 lakh (gross 12,75,000): tax 60,000, rebate 60,000 → nil.
  const b = run(Object.assign({}, base, { gross: 1275000 }));
  ok(b.newTotal === 0, 'tax: ₹12 lakh taxable in the new regime pays nothing (87A)', b.newTotal);
  // Taxable ₹12,10,000: slab tax 61,000; marginal relief caps it at the ₹10,000 above ₹12 lakh → 10,000 + 4% = 10,400.
  const c = run(Object.assign({}, base, { gross: 1285000 }));
  ok(c.newTotal === 10400, 'tax: ₹12,10,000 taxable: 87A marginal relief leaves ₹10,000 + cess = ₹10,400', c.newTotal);
  // Taxable ₹51 lakh: slab tax 3,00,000 + 30% × 27,00,000 = 11,10,000; surcharge 10% = 1,11,000.
  // Relief: tax+surcharge ≤ tax at ₹50 lakh (10,80,000) + ₹1,00,000 = 11,80,000 → relief 41,000. + 4% = 12,27,200.
  const d = run(Object.assign({}, base, { gross: 5175000 }));
  ok(d.newTotal === 1227200, 'tax: ₹51 lakh taxable: surcharge marginal relief ₹41,000, total ₹12,27,200', d.newTotal);
  ok(d.newSurRelief === 41000, 'tax: the ₹50 lakh relief is ₹41,000', d.newSurRelief);
  // Taxable ₹1.01 crore: slab tax 3,00,000 + 30% × 77,00,000 = 26,10,000; 15% surcharge = 3,91,500 → 30,01,500.
  // At ₹1 crore: 25,80,000 × 1.10 = 28,38,000; + ₹1,00,000 = 29,38,000 → relief 63,500; + 4% = 30,55,520.
  const e = run(Object.assign({}, base, { gross: 10175000 }));
  ok(e.newTotal === 3055520, 'tax: ₹1.01 crore taxable: relief at ₹1 crore, total ₹30,55,520', e.newTotal);
  // Old regime, ₹8 lakh gross: 7,50,000 taxable: 12,500 + 20% × 2,50,000 = 50,000 → 62,500 + 4% = 65,000.
  const f = run(Object.assign({}, base, { gross: 800000 }));
  ok(f.oldTotal === 65000, 'tax: ₹8 lakh, old regime ₹65,000', f.oldTotal);
  // Old regime 87A: taxable ≤ ₹5 lakh, rebate up to ₹12,500 → nil (gross 5,50,000).
  const g = run(Object.assign({}, base, { gross: 550000 }));
  ok(g.oldTotal === 0, 'tax: ₹5 lakh taxable, old regime, nil after the ₹12,500 rebate', g.oldTotal);
  // Senior citizen (60-79), old regime: exemption ₹3 lakh. Gross 10,50,000 → taxable 10,00,000:
  // 5% × 2,00,000 = 10,000 + 20% × 5,00,000 = 1,00,000 → 1,10,000 + 4% = 1,14,400.
  const h = run(Object.assign({}, base, { gross: 1050000, age: 'senior' }));
  ok(h.oldTotal === 114400, 'tax: senior, ₹10 lakh taxable, old regime ₹1,14,400', h.oldTotal);
  // Super senior (80+): exemption ₹5 lakh: 20% × 5,00,000 = 1,00,000 + 4% = 1,04,000.
  const i = run(Object.assign({}, base, { gross: 1050000, age: 'super' }));
  ok(i.oldTotal === 104000, 'tax: super senior, ₹10 lakh taxable, old regime ₹1,04,000', i.oldTotal);
  // Itemised: 80C ₹2 lakh is capped at ₹1.5 lakh; 80D self ₹25,000 (cap ₹25,000); 80CCD(1B) ₹50,000.
  // Gross 15,00,000 − 50,000 − 1,50,000 − 25,000 − 50,000 = 12,25,000: 12,500 + 1,00,000 + 67,500 = 1,80,000 + 4% = 1,87,200.
  const j = run(Object.assign({}, base, { gross: 1500000, dedMode: 'itemise', c80: 200000, d80self: 25000, nps1b: 50000 }));
  ok(j.oldDeductions === 225000, 'tax: itemised deductions with 80C capped at ₹1.5 lakh total ₹2,25,000', j.oldDeductions);
  ok(j.oldTotal === 187200, 'tax: itemised, old regime ₹1,87,200', j.oldTotal);
  // HRA, metro: basic 6,00,000, HRA 3,00,000, rent 2,40,000 → least of 3,00,000, 2,40,000 − 60,000 = 1,80,000, 50% × 6,00,000 = 3,00,000 → 1,80,000.
  const k = run(Object.assign({}, base, { gross: 1500000, basic: 600000, hraRecv: 300000, rent: 240000, city: 'metro' }));
  ok(k.hraExempt === 180000, 'tax: HRA exempt ₹1,80,000 (rent − 10% of basic, the least of three)', k.hraExempt);
  // Non-metro: 40% × 6,00,000 = 2,40,000 → still 1,80,000 is least.
  const k2 = run(Object.assign({}, base, { gross: 1500000, basic: 600000, hraRecv: 150000, rent: 240000, city: 'non' }));
  ok(k2.hraExempt === 150000, 'tax: HRA exempt capped at the HRA received, ₹1,50,000', k2.hraExempt);
  // Capital gains on top of ₹15 lakh salary: 112A ₹2,25,000 → (2,25,000 − 1,25,000) × 12.5% = 12,500;
  // 111A ₹1,00,000 × 20% = 20,000. New regime: 93,750 + 32,500 = 1,26,250 + 4% = 1,31,300.
  const l = run(Object.assign({}, base, { gross: 1500000, ltcgEq: 225000, stcg: 100000 }));
  ok(l.newGainsTax === 32500, 'tax: 112A at 12.5% over ₹1.25 lakh and 111A at 20%: ₹32,500', l.newGainsTax);
  ok(l.newTotal === 131300, 'tax: salary plus gains, new regime ₹1,31,300', l.newTotal);
  // TDS already paid ₹50,000 against ₹97,500 due → ₹47,500 still to pay.
  const m = run(Object.assign({}, base, { gross: 1500000, tdsPaid: 50000 }));
  ok(m.dueNew === 47500, 'tax: ₹50,000 TDS leaves ₹47,500 to pay in the new regime', m.dueNew);
  // FY 2025-26 used the same slabs (Finance Act 2025): ₹15 lakh → ₹97,500.
  const n = run(Object.assign({}, base, { gross: 1500000, fy: '2025-26' }));
  ok(n.newTotal === 97500, 'tax: FY 2025-26, ₹15 lakh, new regime ₹97,500', n.newTotal);
})();

/* ================= BMI ================= */
(function bmi() {
  const { run } = tool('bmi');
  const a = run({ weight: 70, height: 175, age: 30 });
  close(a.bmi, 70 / (1.75 * 1.75), 'BMI: 70 kg, 175 cm = 22.86', 1e-9);
  ok(a.category === 'Within the healthy range', 'BMI: 22.9 is in the healthy range', a.category);
  close(a.prime, 70 / 3.0625 / 25, 'BMI prime = BMI ÷ 25', 1e-9);
  ok(/^56\.7 kg \(8 st 13 lb\) to 76\.6 kg \(12 st 1 lb\)$/.test(a.healthyRange), 'BMI: healthy weight for 175 cm is 18.5 × 1.75² = 56.7 kg to 25 × 1.75² = 76.6 kg', a.healthyRange);
  const b = run({ weight: 73.5, height: 175, age: 30, background: 'general' });
  const c = run({ weight: 73.5, height: 175, age: 30, background: 'asian' });
  ok(b.category === 'Within the healthy range' && c.category === 'Above the healthy range', 'BMI 24.0: healthy, but above 23 for a South Asian background (NICE NG246)', [b.category, c.category]);
  const d = run({ weight: 85, height: 175, age: 30, background: 'asian' });
  ok(d.category === 'Well above the healthy range', 'BMI 27.8, South Asian background: at or above 27.5', d.category);
  const w = run({ weight: 70, height: 175, age: 30, waist: 90 });
  close(w.whtr, 90 / 175, 'waist-to-height 90 ÷ 175 = 0.514', 1e-9);
  ok(/0\.5/.test(w.whtrNote || ''), 'waist-to-height 0.51 is in the 0.5 to 0.59 band', w.whtrNote);
  // 11 st 4 lb = 158 lb = 71.6676 kg: the composite field hands the engine kg
  close(158 * 0.45359237, 71.66759446, 'stones: 11 st 4 lb = 71.6676 kg', 1e-6);

  /* children: the CDC file's own centile columns at the half-month row the engine uses */
  const csv = fs.readFileSync(path.join(ROOT, 'build', 'tests', 'fixtures', 'cdc-bmiagerev.csv'), 'utf8').trim().split(/\r?\n/);
  const head = csv[0].split(',');
  const rows = csv.slice(1).map((l) => l.split(',').map(Number));
  const col = (n) => head.indexOf(n);
  let checked = 0;
  for (const sex of [1, 2]) {
    for (let age = 2; age <= 17; age++) {
      const row = rows.find((r) => r[0] === sex && r[1] === age * 12 + 0.5);
      if (!row) { ok(false, 'fixture has a row for sex ' + sex + ' at ' + (age * 12 + 0.5) + ' months'); continue; }
      for (const [p, want] of [['P5', '5th'], ['P50', '50th'], ['P85', '85th'], ['P95', '95th']]) {
        const bmiV = row[col(p)];
        const h = 1.2;   // any height: the weight is set to give the BMI
        const res = run({ weight: bmiV * h * h, height: 120, age, sex: sex === 1 ? 'male' : 'female' });
        ok(res.centile === 'the ' + want + ' centile', 'BMI-for-age: ' + (sex === 1 ? 'boy' : 'girl') + ' aged ' + age + ', BMI ' + bmiV.toFixed(2) + ' (CDC ' + p + ') reads the ' + want + ' centile', res.centile);
        checked++;
      }
    }
  }
  // bands: P85 is "above the healthy range for age", just below P85 is within it, P95 well above
  const r10 = rows.find((r) => r[0] === 1 && r[1] === 120.5);
  const k = (v) => run({ weight: v * 1.44, height: 120, age: 10, sex: 'male' }).category;
  ok(k(r10[col('P85')] - 0.05) === 'Within the healthy range for age', 'boy 10: just under the CDC 85th centile is healthy', k(r10[col('P85')] - 0.05));
  ok(k(r10[col('P85')] + 0.01) === 'Above the healthy range for age', 'boy 10: over the 85th centile is above the healthy range', k(r10[col('P85')] + 0.01));
  ok(k(r10[col('P95')] + 0.01) === 'Well above the healthy range for age', 'boy 10: over the 95th centile is well above', k(r10[col('P95')] + 0.01));
  ok(k(r10[col('P5')] - 0.05) === 'Below the healthy range for age', 'boy 10: under the 5th centile is below', k(r10[col('P5')] - 0.05));
  ok(checked === 128, '128 centile checks against the CDC table', checked);
  const tooYoung = run({ weight: 12, height: 85, age: 1, sex: 'male' });
  ok(tooYoung.category === 'Outside the age range', 'BMI: under 2 says the centiles start at 2', tooYoung.category);
})();

/* ================= GST ================= */
(function gst() {
  const { run } = tool('gst-calculator');
  const a = run({ amount: 10000, mode: 'exclusive', rate: 18, supply: 'intra' });
  ok(a.gst === 1800 && a.cgst === 900 && a.sgst === 900 && a.total === 11800, 'GST: ₹10,000 + 18% = ₹1,800, CGST ₹900 + SGST ₹900, ₹11,800', [a.gst, a.cgst, a.sgst, a.total]);
  const b = run({ amount: 11800, mode: 'inclusive', rate: 18, supply: 'inter' });
  close(b.base, 10000, 'GST inclusive: ₹11,800 at 18% is ₹10,000 + ₹1,800', 1e-6);
  ok(near(b.igst, 1800, 1e-6) && !b.cgst, 'GST: inter-state is all IGST', [b.igst, b.cgst]);
  const c = run({ amount: 10000, mode: 'exclusive', rate: 18, supply: 'ut' });
  ok(c.cgst === 900 && c.utgst === 900 && !c.sgst, 'GST: a Union territory without a legislature charges CGST + UTGST', [c.cgst, c.utgst, c.sgst]);
  const d = run({ amount: 10000, mode: 'exclusive', rate: 40, supply: 'intra', cess: 12 });
  ok(near(d.cessAmt, 1200, 1e-6), 'GST: 12% compensation cess on the taxable value is ₹1,200', d.cessAmt);
  const e = run({ amount: 1000, qty: 3, mode: 'exclusive', rate: 18, amount2: 500, qty2: 2, rate2: 5 });
  // line 1: 3,000 × 18% = 540; line 2: 1,000 × 5% = 50 → base 4,000, GST 590, total 4,590
  ok(near(e.base, 4000, 1e-6) && near(e.gst, 590, 1e-6) && near(e.total, 4590, 1e-6), 'GST: two lines, ₹3,000 at 18% and ₹1,000 at 5%: ₹590 tax, ₹4,590', [e.base, e.gst, e.total]);
  const f = run({ amount: 10000, mode: 'exclusive', rate: 'custom', customRate: 7.5 });
  ok(near(f.gst, 750, 1e-6), 'GST: a custom 7.5% rate', f.gst);
  const g = run({ amount: 10000, mode: 'exclusive', rate: 18, rcm: 'yes' });
  ok(near(g.rcmTax, 1800, 1e-6) && near(g.payable, 10000, 1e-6), 'GST reverse charge: the buyer pays ₹1,800 to the government and ₹10,000 to the supplier', [g.rcmTax, g.payable]);
})();

/* ================= Percentage ================= */
(function pct() {
  const { run } = tool('percentage');
  ok(near(run({ mode: 'of', p: 20, n: 150 }).result, 30, 1e-9), '20% of 150 is 30');
  ok(near(run({ mode: 'what', x: 30, n: 150 }).result, 20, 1e-9), '30 is 20% of 150');
  ok(near(run({ mode: 'whole', x: 30, p: 20 }).result, 150, 1e-9), '30 is 20% of 150 (the whole)');
  ok(near(run({ mode: 'change', from: 80, to: 100 }).result, 25, 1e-9), '80 to 100 is a 25% rise');
  ok(near(run({ mode: 'change', from: 100, to: 80 }).result, -20, 1e-9), '100 to 80 is a 20% fall');
  ok(near(run({ mode: 'diff', from: 80, to: 100 }).result, 20 / 90 * 100, 1e-9), 'the difference between 80 and 100 is 22.22% of their mean');
  ok(near(run({ mode: 'reverse', p: 20, n: 120, dir: 'rise' }).result, 100, 1e-9), '120 after a 20% rise was 100');
  ok(near(run({ mode: 'reverse', p: 20, n: 120, dir: 'cut' }).result, 150, 1e-9), '120 after a 20% cut was 150');
  const fr = run({ mode: 'frac', frac: '3/8' });
  ok(near(fr.decimal, 0.375, 1e-12) && near(fr.pctOfB !== undefined ? fr.pctOfB : fr.result, 37.5, 1e-9), '3/8 = 0.375 = 37.5%', fr);
  const all = run({ mode: 'all', value: 25, total: 200 });
  ok(near(all.aOfB, 12.5, 1e-9) && near(all.pctOfB, 50, 1e-9) && near(all.change, 700, 1e-9), 'all at once: 25 is 12.5% of 200; 25% of 200 is 50; 25 → 200 is +700%', all);
})();

/* ================= Tip ================= */
(function tip() {
  const { run } = tool('tip-calculator');
  const a = run({ bill: 85, tip: 12.5, people: 4 });
  ok(near(a.tipAmt, 10.625, 1e-9) && near(a.each, 23.90625, 1e-9), '£85 + 12.5% between 4: tip £10.63, £23.91 each', a);
  const b = run({ bill: 120, tax: 20, tipOn: 'pretax', tip: 15, people: 2 });
  ok(near(b.tipAmt, 15, 1e-9) && near(b.total, 135, 1e-9), '15% on the £100 before £20 tax: £15 tip, £135 total', b);
  const c = run({ bill: 85, tip: 12.5, people: 4, round: 'up' });
  ok(c.each === 24 && c.total === 96, 'rounding each share up: £24 each, £96', c);
  const d = run({ bill: 100, tip: 10, items: '50, 30, 20' });
  // total 110; shares 50%, 30%, 20% → 55, 33, 22
  ok(d._table && near(d._table.rows[0][3], 55, 1e-9) && near(d._table.rows[1][3], 33, 1e-9) && near(d._table.rows[2][3], 22, 1e-9), 'uneven split of £110: £55, £33, £22', d._table && d._table.rows);
  ok(near(d.most, 55, 1e-9) && near(d.least, 22, 1e-9), 'uneven split: most £55, least £22');
  const e = run({ bill: 100, tip: 12.5, items: '50, 30, 20', round: 'up' });   // £112.50 shared 56.25 / 33.75 / 22.50, rounded up to 57 / 34 / 23
  const tipCol = e._table.rows.reduce((s, r) => s + r[2], 0);
  ok(near(e.total, 114, 1e-9) && near(e.tipAmt, 14, 1e-9), 'uneven split rounded up: £114 in all, so the tip is £14', [e.total, e.tipAmt]);
  ok(near(tipCol, e.tipAmt, 1e-9) && near(e._table.foot[2], e.tipAmt, 1e-9), 'uneven split rounded up: the tip column adds up to the tip in the total', { col: tipCol, tip: e.tipAmt });
})();

/* ================= Scientific calculator ================= */
(function sci() {
  const { window, ctx } = sandbox();
  window.document = undefined;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine', 'sci-calc.js'), 'utf8'), ctx, { filename: 'sci-calc.js' });
  const S = window.MVRSci;
  ok(S && typeof S.evaluate === 'function', 'sci-calc.js exposes evaluate()');
  if (!S) return;
  const ev = (e, a, ans) => { const r = S.evaluate(e, a || 'deg', ans); return typeof r === 'object' && r !== null ? (r.value !== undefined ? r.value : r) : r; };
  close(ev('sin(30)', 'deg'), 0.5, 'sin 30° = 0.5', 1e-12);
  close(ev('sin(100)', 'grad'), 1, 'sin 100 grad = 1', 1e-12);
  close(ev('cos(pi)', 'rad'), -1, 'cos π = −1', 1e-12);
  close(ev('asin(1)', 'deg'), 90, 'asin 1 = 90°', 1e-9);
  close(ev('15%×80'), 12, '15% × 80 = 12 (% is a percentage)', 1e-12);
  close(ev('mod(17,5)'), 2, 'mod(17, 5) = 2', 1e-12);
  close(ev('ncr(52,5)'), 2598960, '52C5 = 2,598,960 poker hands', 0);
  close(ev('npr(10,3)'), 720, '10P3 = 720', 0);
  close(ev('5!'), 120, '5! = 120', 0);
  close(ev('2E3'), 2000, '2E3 = 2,000 (the EE key)', 0);
  close(ev('2^10'), 1024, '2^10 = 1,024', 0);
  close(ev('-3^2'), -9, '−3² = −9 (power binds tighter than unary minus)', 0);
  close(ev('ans×2', 'deg', 21), 42, 'ans carries the last result', 0);
  close(ev('root(27,3)'), 3, 'root(27, 3) = 3', 1e-12);
  close(ev('log(1000)'), 3, 'log 1000 = 3', 1e-12);
  close(ev('ln(e)'), 1, 'ln e = 1', 1e-12);
  const fr = S.toFraction(0.375);
  ok(fr && fr.n === 3 && fr.d === 8, '0.375 shows as 3/8', fr);
  const f3 = S.toFraction(1 / 3);
  ok(f3 && f3.n === 1 && f3.d === 3, '0.333… shows as 1/3', f3);
  const big = S.ncr(1000, 500);
  ok(isFinite(big) && big > 2.7e299 && big < 2.71e299, 'ncr(1000, 500) ≈ 2.7029e299 without overflow', big);
})();

/* ================= Units: composite input ================= */
(function units() {
  const { window, ctx } = sandbox();
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine', 'units.bundle.js'), 'utf8'), ctx, { filename: 'units.bundle.js' });
  const U = window.UNIT_PARSE;
  ok(U && typeof U.parse === 'function', 'units.bundle.js exposes UNIT_PARSE');
  if (!U) return;
  close(U.parse('5\' 11"', 'length', 'cm').value, 180.34, '5′ 11″ = 180.34 cm', 1e-9);
  close(U.parse('5 ft 11 in', 'length', 'm').value, 1.8034, '5 ft 11 in = 1.8034 m', 1e-12);
  close(U.parse('5 3/4', 'length', 'in').value, 5.75, '5 3/4 = 5.75', 1e-12);
  close(U.parse('5¾ in', 'length', 'cm').value, 14.605, '5¾ in = 14.605 cm', 1e-9);
  close(U.parse('11 st 4 lb', 'mass', 'kg').value, 71.66759446, '11 st 4 lb = 71.6676 kg', 1e-6);
  close(U.parse('3 lb 8 oz', 'mass', 'kg').value, 3.5 * 0.45359237, '3 lb 8 oz = 1.5876 kg', 1e-9);
  close(U.parse('1,250.5', 'length', 'm').value, 1250.5, 'a thousands comma is read', 1e-12);
  ok(U.parse('5 ft potato', 'length', 'm') === null, 'nonsense is refused, not guessed');
  ok(U.compound('length', 'ft', 5.75) === '5 ft 9 in', '5.75 ft reads 5 ft 9 in', U.compound('length', 'ft', 5.75));
  ok(U.compound('mass', 'st', 11.5) === '11 st 7 lb', '11.5 st reads 11 st 7 lb', U.compound('mass', 'st', 11.5));
  ok(/^5 3\/8 in/.test(U.compound('length', 'in', 5.375) || ''), '5.375 in reads 5 3/8 in', U.compound('length', 'in', 5.375));
  ok(U.ukName({ name: 'Centimeter' }) === 'Centimetre', 'British spelling of unit names');
})();

/* ================= Rates history ================= */
(function history() {
  const h = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'rates-history.json'), 'utf8'));
  const today = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'rates.json'), 'utf8'));
  ok(h.base === 'USD' && Array.isArray(h.days) && h.days.length >= 2 && h.days.length <= 90, 'rates-history: USD-based, 2 to 90 days', h.days && h.days.length);
  ok(h.days.every((d, k) => k === 0 || d > h.days[k - 1]), 'rates-history: days in order, no repeats');
  const codes = Object.keys(h.rates || {});
  ok(codes.length >= 150, 'rates-history: 150+ currencies', codes.length);
  ok(codes.every((c) => h.rates[c].length === h.days.length && h.rates[c].every((v) => v === null || (typeof v === 'number' && v > 0))), 'rates-history: one positive rate or null a day for each currency');
  const last = h.days.length - 1;
  ok(h.days[last] === String(today.date).slice(0, 10), 'rates-history: the last day is today’s rates.json (' + today.date + ')', h.days[last]);
  const off = codes.filter((c) => today.rates[c] && Math.abs(h.rates[c][last] / today.rates[c] - 1) > 1e-5);
  ok(off.length === 0, 'rates-history: the last day equals rates.json to 6 significant figures', off.slice(0, 5));
  const gbp = h.rates.GBP.filter((v) => v !== null);
  ok(gbp.every((v) => v > 0.5 && v < 1.2), 'rates-history: every GBP rate is a plausible dollar rate (0.5 to 1.2)', [Math.min(...gbp), Math.max(...gbp)]);
  const mod = require(path.join(ROOT, 'build', 'rates-history.js'));
  if (mod && typeof mod.addDay === 'function') {
    const before = JSON.stringify(h);
    const next = mod.addDay(h, { base: 'USD', date: '2099-01-01', rates: { GBP: 0.8, EUR: 0.9 } });
    ok(JSON.stringify(h) === before, 'rates-history addDay() leaves its input unchanged');
    ok(next.days[next.days.length - 1] === '2099-01-01' && next.days.length <= 90, 'addDay() appends the day and keeps at most 90', next.days.length);
    ok(next.rates.GBP[next.days.length - 1] === 0.8 && next.rates.AED[next.days.length - 1] === null, 'addDay(): a currency missing that day is null');
  } else ok(false, 'build/rates-history.js exports addDay()');
})();

console.log('calc-wave5: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
