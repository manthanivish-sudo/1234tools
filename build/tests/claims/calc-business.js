/**
 * Claims on the Business and Finance calculator pages (/business/ and
 * /finance/): every sentence the page says about what the tool does (lede,
 * card line, "Why people use it", formula, tips, FAQ, and the depth entry's
 * how-it-works, worked-example prose, uses, mistakes and questions) put
 * through the page's own engine in Node. The figures a depth entry lists in
 * check/checks and the Example panel are checked elsewhere (build/content/
 * _check.js, claims/examples.js); here are the behaviours and the figures
 * those lists leave out.
 *
 * UK statutory pages: every rate and threshold the page quotes is tested on
 * both sides of its boundary, so a constant that drifts from the page fails.
 */
'use strict';

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node';
  const S = (u) => K.calcSpec(u);
  const at = (u, base) => (i) => K.calc(u, Object.assign({}, base || {}, i || {}));
  const near = (a, b, tol) => typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b) &&
    Math.abs(a - b) <= (tol === undefined ? 1e-6 * Math.max(1, Math.abs(b)) : tol);
  const f = (v, d) => typeof v === 'number' ? (isFinite(v) ? String(Number(v.toFixed(d === undefined ? 4 : d))) : String(v)) : K.j(v);
  /* "£1,234.56" or "-£80,000.00" from a schedule table → number */
  const money = (s) => { const t = String(s).trim(); const v = Number(t.replace(/[^0-9.]/g, '')); return /^[-−]/.test(t) ? -v : v; };
  const keys = (u) => (S(u).inputs || []).map((i) => i.key);
  const outKeys = (u) => (S(u).outputs || []).map((o) => o.key);
  const out = (u, k) => (S(u).outputs || []).find((o) => o.key === k) || {};
  const input = (u, k) => (S(u).inputs || []).find((i) => i.key === k) || {};
  const primary = (u) => ((S(u).outputs || []).find((o) => o.primary) || {}).key;
  const show = (u, k, v) => K.calcShow(S(u), k, v);
  const has = (u, list) => list.every((k) => outKeys(u).indexOf(k) >= 0);
  /* register on one page: c(where, quote, name, fn); c.lc registers the lede and the card line (the same words here) */
  const page = (P) => {
    const c = (where, quote, name, fn) => claim(P, where, quote, name, N, async () => fn());
    c.lc = (quote, name, fn) => { c('lede', quote, name, fn); c('card', quote, name, fn); };
    c.m = (where, quote, why) => manual(P, where, quote, why);
    return c;
  };

  /* ================================================================ */
  /* UK take-home pay (2026/27)                                         */
  /* ================================================================ */
  {
    const P = '/business/uk-take-home-pay/';
    const c = page(P);
    const TH = at(P, { year: '2026/27', pension: 0, student: 'none' });
    /* the rest-of-UK rules as the page states them */
    const ukTax = (t) => {
      let pa = 12570; if (t > 100000) pa = Math.max(0, pa - (t - 100000) / 2);
      const a = Math.max(0, t - pa);
      return 0.2 * Math.min(a, 37700) + 0.4 * Math.max(0, Math.min(a, 125140) - 37700) + 0.45 * Math.max(0, a - 125140);
    };
    const ukNI = (g) => 0.08 * Math.max(0, Math.min(g, 50270) - 12570) + 0.02 * Math.max(0, g - 50270);
    const dTax = (g) => TH({ gross: g + 1 }).tax - TH({ gross: g }).tax;
    const dNI = (g) => TH({ gross: g + 1 }).ni - TH({ gross: g }).ni;

    c.lc('Estimate income tax, National Insurance and net pay from a gross salary.', 'tax, NI and net on four salaries', () => {
      const rows = [20000, 45000, 80000, 140000].map((g) => { const r = TH({ gross: g }); return [near(r.tax, ukTax(g), 0.005) && near(r.ni, ukNI(g), 0.005) && near(r.net, g - r.tax - r.ni, 0.005), g + ': tax ' + f(r.tax, 2) + ', NI ' + f(r.ni, 2) + ', net ' + f(r.net, 2)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('lede', 'England, Wales and Northern Ireland.', 'rest-of-UK bands (20% from £12,570); no Scottish choice', () => {
      const r = TH({ gross: 20000 });
      return [near(r.tax, 1486, 0.005) && !keys(P).some((k) => /region|scot|country|nation/i.test(k)), 'tax on £20,000 ' + f(r.tax, 2) + '; inputs ' + keys(P).join(', ')];
    });
    c('why', 'Your rent is monthly, and tax, NI and pension all come off first.', 'monthly = (gross − tax − NI − pension) ÷ 12', () => {
      const r = TH({ gross: 48000, pension: 5 });
      return [near(r.monthly, (48000 - r.tax - r.ni - r.pensionAmt) / 12, 1e-6) && r.pensionAmt === 2400, 'monthly ' + f(r.monthly, 2) + ', pension ' + f(r.pensionAmt, 2)];
    });
    c('why', 'Enter your salary and pension. See tax, NI and take-home pay.', 'salary and pension in; tax, NI, net out', () => [
      keys(P).indexOf('gross') >= 0 && keys(P).indexOf('pension') >= 0 && has(P, ['tax', 'ni', 'net', 'monthly']), 'inputs ' + keys(P).join(', ') + '; outputs ' + outKeys(P).join(', ')]);
    c('why', 'Read monthly take-home', 'the headline result is the monthly figure', () => [primary(P) === 'monthly', 'primary ' + primary(P)]);
    c('what', 'a £32,000 salary is not £2,667 a month to spend.', '£32,000 nets less than £2,667 a month', () => {
      const a = TH({ gross: 32000 }).monthly, b = TH({ gross: 32000, pension: 4 }).monthly;
      return [a < 2667 && b < 2667, 'no pension ' + f(a, 2) + '; 4% pension ' + f(b, 2)];
    });
    c('what', 'so a month’s pay is roughly the annual net figure divided by 12.', 'monthly = net ÷ 12', () => { const r = TH({ gross: 61234, pension: 3 }); return [near(r.monthly, r.net / 12), f(r.monthly, 2) + ' vs ' + f(r.net / 12, 2)]; });
    c('works', 'For 2026/27 the pension comes out first. Income tax is charged on what is left above the £12,570 personal allowance, and National Insurance on the full salary.', '£40,000 with 5% pension', () => {
      const r = TH({ gross: 40000, pension: 5 });
      return [near(r.tax, 0.2 * (38000 - 12570), 0.005) && near(r.ni, 0.08 * (40000 - 12570), 0.005), 'tax ' + f(r.tax, 2) + ' (20% of £25,430 = 5,086), NI ' + f(r.ni, 2) + ' (8% of £27,430 = 2,194.40)'];
    });
    c('works', 'take-home = salary − pension − income tax − NI − student loan', 'net with a Plan 2 loan', () => {
      const r = TH({ gross: 40000, pension: 5, student: 'plan2' });
      return [r.loan > 0 && near(r.net, 40000 - r.pensionAmt - r.tax - r.ni - r.loan, 1e-6), 'net ' + f(r.net, 2) + ', loan ' + f(r.loan, 2)];
    });
    c('works', 'taxable pay = salary − pension − £12,570', '£40,000, 5% pension: tax on £25,430', () => { const r = TH({ gross: 40000, pension: 5 }); return [near(r.tax / 0.2, 40000 - 2000 - 12570, 0.01), 'tax ÷ 20% = ' + f(r.tax / 0.2, 2)]; });
    c('works', 'income tax = 20% × taxable pay up to £37,700 + 40% × taxable pay up to £125,140 + 45% × taxable pay above that', 'the next pound either side of £37,700 and £125,140 of taxable pay', () => {
      const a = dTax(50269), b = dTax(50270), cc = dTax(125140), t = TH({ gross: 125140 }).tax;
      return [near(a, 0.2, 1e-6) && near(b, 0.4, 1e-6) && near(cc, 0.45, 1e-6) && near(t, 0.2 * 37700 + 0.4 * (125140 - 37700), 0.005),
        'tax on the pound after £50,269 ' + f(a) + ', after £50,270 ' + f(b) + ', after £125,140 ' + f(cc) + '; tax at £125,140 ' + f(t, 2)];
    });
    c('works', 'NI = 8% × salary between £12,570 and £50,270 + 2% × salary above £50,270', 'NI either side of £12,570 and £50,270', () => {
      const z = TH({ gross: 12570 }).ni, a = dNI(12570), b = dNI(50269), cc = dNI(50270), top = TH({ gross: 50270 }).ni;
      return [z === 0 && near(a, 0.08, 1e-6) && near(b, 0.08, 1e-6) && near(cc, 0.02, 1e-6) && near(top, 3016, 0.005),
        'NI at £12,570 ' + z + '; next pound ' + f(a) + '; at £50,269→50,270 ' + f(b) + '; above £50,270 ' + f(cc) + '; at £50,270 ' + f(top, 2)];
    });
    c('works', 'your contribution, a percentage of salary', '5% of £40,000 is £2,000', () => { const r = TH({ gross: 40000, pension: 5 }); return [r.pensionAmt === 2000, f(r.pensionAmt, 2)]; });
    c('worked', 'the pension takes £1,280, leaving £30,720. Income tax is 20% of the £18,150 above the personal allowance', '£30,720 and £18,150', () => {
      const r = TH({ gross: 32000, pension: 4 });
      return [32000 - r.pensionAmt === 30720 && near(r.tax, 0.2 * 18150, 0.005), 'left after pension ' + (32000 - r.pensionAmt) + '; tax ' + f(r.tax, 2)];
    });
    c('worked', 'National Insurance is 8% of £19,430', 'NI on £32,000 is 8% of £19,430', () => { const r = TH({ gross: 32000, pension: 4 }); return [near(r.ni, 0.08 * 19430, 0.005), f(r.ni, 2)]; });
    c('use', 'See what raising your contribution from 4% to 8% costs in monthly pay.', '4% → 8% on £32,000 costs less than the 4% paid in', () => {
      const a = TH({ gross: 32000, pension: 4 }).monthly, b = TH({ gross: 32000, pension: 8 }).monthly;
      return [a - b > 0 && a - b < 32000 * 0.04 / 12, 'monthly falls by ' + f(a - b, 2) + ' for ' + f(32000 * 0.04 / 12, 2) + ' more pension'];
    });
    c('use', 'Find how much of a £3,000 rise survives tax and NI, especially near £50,270.', 'a £3,000 rise keeps £2,160 below £50,270 and £1,740 above', () => {
      const lo = TH({ gross: 50270 }).net - TH({ gross: 47270 }).net, hi = TH({ gross: 53270 }).net - TH({ gross: 50270 }).net;
      return [near(lo, 2160, 0.01) && near(hi, 1740, 0.01), 'kept ' + f(lo, 2) + ' below, ' + f(hi, 2) + ' above'];
    });
    c('mistake', 'On £32,000 with a 4% pension, deductions come to about £539 a month.', 'gross ÷ 12 less monthly take-home', () => { const d = 32000 / 12 - TH({ gross: 32000, pension: 4 }).monthly; return [Math.round(d) === 539, f(d, 2)]; });
    c.m('mistake', 'Scotland’s income tax bands differ, so only the National Insurance figure carries over.', 'Scottish income tax law; the tool has no Scottish bands (checked under the lede)');
    c('dfaq', 'It shrinks by £1 for every £2 of income above £100,000', 'allowance at £100,000, £100,002, £124,000 and £125,140', () => {
      const v = [100000, 100002, 124000, 125140].map((g) => TH({ gross: g }).personalAllowance);
      return [v[0] === 12570 && v[1] === 12569 && v[2] === 570 && v[3] === 0, v.join(', ')];
    });
    c('dfaq', '£12,570, the amount you can earn before income tax starts.', 'no tax at £12,570, tax on the next pound', () => { const a = TH({ gross: 12570 }).tax, b = TH({ gross: 12571 }).tax; return [a === 0 && b > 0, a + ' then ' + f(b, 2)]; });
    c('dfaq', 'The marginal rate is the income tax on your next pound: 20% at basic rate, 40% at higher rate, 60% between £100,000 and £125,140 while the allowance is withdrawn, and 45% above £125,140.', 'shown marginal rate = tax on the next pound, thresholds included', () => {
      const gs = [12570, 30000, 50270, 60000, 100000, 110000, 125139, 125140, 150000];
      const rows = gs.map((g) => { const m = TH({ gross: g }).marginalRate, d = Math.round(dTax(g) * 100); return [m === d, g + ': shows ' + m + '%, next pound ' + d + '%']; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('dfaq', 'The effective rate is tax, NI and any student loan divided by gross pay', 'effective = (tax + NI + loan) ÷ gross', () => {
      const r = TH({ gross: 45000, student: 'plan2' });
      return [near(r.effectiveRate, (r.tax + r.ni + r.loan) / 45000 * 100, 1e-9), f(r.effectiveRate) + '%'];
    });
    c('dfaq', 'NI and a loan can lift it above the marginal rate.', '£45,000 with Plan 2: effective above the 20% marginal', () => {
      const l = TH({ gross: 45000, student: 'plan2' }), n = TH({ gross: 30000 });
      return [l.effectiveRate > l.marginalRate && n.effectiveRate < n.marginalRate, 'Plan 2 on £45,000 ' + f(l.effectiveRate, 2) + '% vs ' + l.marginalRate + '%; £30,000, no loan ' + f(n.effectiveRate, 2) + '% vs ' + n.marginalRate + '%'];
    });
    c('dfaq', 'The pension comes out before income tax, as in a net pay arrangement, but NI is worked out on the whole salary.', 'a 10% pension cuts tax, not NI', () => {
      const a = TH({ gross: 40000 }), b = TH({ gross: 40000, pension: 10 });
      return [a.ni === b.ni && near(b.tax, ukTax(36000), 0.005), 'NI ' + f(a.ni, 2) + ' / ' + f(b.ni, 2) + '; tax ' + f(a.tax, 2) + ' → ' + f(b.tax, 2)];
    });
    c('dfaq', 'It is the annual net figure divided by 52.', 'weekly = net ÷ 52', () => { const r = TH({ gross: 61234, pension: 3 }); return [near(r.weekly, r.net / 52), f(r.weekly, 2)]; });
    c.m('dfaq', 'Weekly payslips can differ slightly, because PAYE uses weekly thresholds and some years have 53 paydays.', 'PAYE practice; the tool has no pay-period input');
    c('formula', 'net = gross − income tax − National Insurance − pension − student loan', 'the formula, with and without a loan', () => {
      const rows = [['none', 30000], ['plan2', 40000], ['plan1', 90000], ['pgl', 130000]].map(([s, g]) => { const r = TH({ gross: g, pension: 4, student: s }); return [near(r.net, g - r.tax - r.ni - r.pensionAmt - r.loan, 1e-6), s + ' ' + g + ': net ' + f(r.net, 2) + ', loan ' + f(r.loan, 2)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c.m('tip', 'Scotland has its own income tax bands and will produce a different figure.', 'Scottish income tax law; the tool offers no Scottish bands (checked under the lede)');
    c('tip', 'Between £100,000 and £125,140 the personal allowance is withdrawn at £1 for every £2 earned, creating an effective marginal rate of about 60%.', 'the pound after £110,000 costs 60p in tax', () => {
      const d = dTax(110000), r = TH({ gross: 110000 });
      return [near(d, 0.6, 1e-6) && r.marginalRate === 60 && r.personalAllowance === 7570 && TH({ gross: 125140 }).personalAllowance === 0, 'tax on next pound ' + f(d) + '; shown ' + r.marginalRate + '%; allowance ' + r.personalAllowance];
    });
    c('tip', 'It assumes the standard tax code and no benefits in kind, salary sacrifice beyond pension, or other adjustments.', 'no tax code, benefit or sacrifice input', () => [K.j(keys(P)) === K.j(['gross', 'year', 'pension', 'student']), keys(P).join(', ')]);
    c.m('tip', 'Tax rates and thresholds change. Check the current figures on GOV.UK before relying on this for a decision.', 'advice to the reader; the constants are checked against gov.uk in the engine source (2026-10-04)');
    c.m('faq', 'Common causes are a non-standard tax code, benefits in kind such as a company car or private medical cover', 'payroll practice, not something the tool does');
    c.m('faq', 'Scotland sets its own income tax bands with additional rates, so the income tax figure would be wrong. National Insurance is the same UK-wide.', 'Scottish and UK tax law');
    c('what', 'Take-home pay is what reaches your bank account after PAYE has taken off income tax, National Insurance, your pension contribution and any student loan.', 'all four come off', () => {
      const r = TH({ gross: 52000, pension: 6, student: 'plan1' });
      return [r.tax > 0 && r.ni > 0 && r.pensionAmt > 0 && r.loan > 0 && near(r.net, 52000 - r.tax - r.ni - r.pensionAmt - r.loan, 1e-6), 'tax ' + f(r.tax, 2) + ', NI ' + f(r.ni, 2) + ', pension ' + f(r.pensionAmt, 2) + ', loan ' + f(r.loan, 2)];
    });
    c('dfaq', 'Not as this calculator models it.', 'NI the same with no pension and with 8%', () => { const a = TH({ gross: 60000 }).ni, b = TH({ gross: 60000, pension: 8 }).ni; return [a === b, f(a, 2) + ' / ' + f(b, 2)]; });
    c.m('dfaq', 'Only salary sacrifice reduces NI, because your contractual pay itself goes down.', 'payroll law; the tool models a net pay arrangement only (NI on the whole salary, checked above)');
    c.m('tip', 'Your payslip is the authority.', 'advice to the reader');
  }

  /* ================================================================ */
  /* True cost of an employee (2026/27)                                 */
  /* ================================================================ */
  {
    const P = '/business/employer-cost/';
    const c = page(P);
    const E = at(P, { year: '2026/27', pension: 0, allowance: 'no', overheads: 0, recruitment: 0 });
    c.lc('Work out what an employee really costs after employer NI, pension, holiday and overheads.', 'NI, pension and overheads added; holiday out of the day and hour costs', () => {
      const r = E({ salary: 45000, pension: 5, overheads: 2500 });
      return [near(r.annual, 45000 + 6000 + 2250 + 2500, 1e-6) && near(r.perProductiveDay, r.annual / ((52 - 5.6) * 5)), 'annual ' + f(r.annual, 2) + '; per day ' + f(r.perProductiveDay, 2)];
    });
    c('why', 'Employer NI, pension and kit make the real bill much bigger.', 'defaults cost more than the salary', () => { const r = K.calc(P, {}); return [r.annual > K.calcDefaults(S(P)).salary, 'salary ' + K.calcDefaults(S(P)).salary + ', annual ' + f(r.annual, 2)]; });
    c('why', 'Enter salary and extras. See the true yearly, monthly and hourly cost.', 'yearly, monthly and hourly outputs', () => { const r = E({ salary: 30000 }); return [has(P, ['annual', 'monthly', 'perProductiveHour']) && near(r.monthly, r.annual / 12), outKeys(P).join(', ')]; });
    c('why', 'Read the true annual cost', 'the headline result is the annual cost', () => [primary(P) === 'annual', 'primary ' + primary(P)]);
    c('what', 'the gross salary plus what the employer pays on top: employer National Insurance, the employer’s pension contribution, and the desk, laptop, software and space the job needs.', 'annual = salary + NI + pension + other costs', () => {
      const r = E({ salary: 52000, pension: 4, overheads: 3100 });
      return [near(r.annual, 52000 + r.ni + r.pensionAmt + 3100, 1e-6) && /equipment, software, space/.test(input(P, 'overheads').label), 'annual ' + f(r.annual, 2) + '; label "' + input(P, 'overheads').label + '"'];
    });
    c('works', 'For 2026/27 employer NI is 15% of the salary above a £5,000 secondary threshold, with no upper limit', 'nothing at £5,000, 15p on the next pound, 15% at £1m', () => {
      const a = E({ salary: 5000 }).ni, b = E({ salary: 5001 }).ni, m = E({ salary: 1000000 }).ni, m1 = E({ salary: 1000001 }).ni;
      return [a === 0 && near(b, 0.15, 1e-9) && near(m, 0.15 * 995000, 1e-6) && near(m1 - m, 0.15, 1e-6), 'at £5,000 ' + a + '; £5,001 ' + f(b) + '; £1m ' + f(m, 2) + ', next pound ' + f(m1 - m)];
    });
    c('works', 'less any Employment Allowance you claim (up to £10,500)', 'allowance takes £10,500 off £14,250, but only £5,250 off £5,250', () => {
      const a = E({ salary: 100000, allowance: 'yes' }), b = E({ salary: 40000, allowance: 'yes' });
      return [near(a.ni, 14250 - 10500, 1e-6) && a.allowanceSaving === 10500 && b.ni === 0 && near(b.allowanceSaving, 5250, 1e-6), '£100k: NI ' + f(a.ni, 2) + ' saved ' + f(a.allowanceSaving, 2) + '; £40k: NI ' + f(b.ni, 2) + ' saved ' + f(b.allowanceSaving, 2)];
    });
    c('works', 'Pension and other costs are added, and the total is spread over 46.4 working weeks.', 'annual ÷ per-day = 232 days (46.4 weeks)', () => { const r = E({ salary: 45000, pension: 5, overheads: 2500 }); return [near(r.annual / r.perProductiveDay, 232, 1e-9), f(r.annual / r.perProductiveDay, 6) + ' days']; });
    c('works', 'first-year cost = annual cost + recruitment', 'first year adds recruitment once', () => { const r = E({ salary: 45000, recruitment: 3000 }); return [near(r.firstYear - r.annual, 3000, 1e-9), f(r.firstYear - r.annual, 2)]; });
    c('works', 'cost per working day = annual cost ÷ (46.4 × 5)', 'per day and per hour divisors', () => { const r = E({ salary: 38000, overheads: 1000 }); return [near(r.perProductiveDay, r.annual / 232) && near(r.perProductiveHour, r.annual / 1740), f(r.perProductiveDay, 2) + ' / ' + f(r.perProductiveHour, 2)]; });
    c('works', 'the percentage you enter, applied to the whole salary', '5% of all £45,000', () => { const r = E({ salary: 45000, pension: 5 }); return [r.pensionAmt === 2250, f(r.pensionAmt, 2)]; });
    c('works', '52 weeks less 5.6 weeks of statutory holiday', 'hour divisor is 46.4 × 37.5', () => { const r = E({ salary: 45000 }); return [near(r.annual / r.perProductiveHour / 37.5, 46.4, 1e-9), f(r.annual / r.perProductiveHour / 37.5, 6) + ' weeks']; });
    c('use', 'Every extra £1,000 of salary costs the employer £1,150 in pay and NI, before the pension on top.', '£45,000 → £46,000', () => {
      const a = E({ salary: 46000 }).annual - E({ salary: 45000 }).annual, b = E({ salary: 46000, pension: 5 }).annual - E({ salary: 45000, pension: 5 }).annual;
      return [near(a, 1150, 1e-6) && near(b, 1200, 1e-6), 'no pension ' + f(a, 2) + '; with 5% pension ' + f(b, 2)];
    });
    c('mistake', 'The tool takes it on the whole salary, while schemes based on qualifying earnings leave out the lowest slice of pay and cost less.', 'pension on the whole £20,000', () => { const r = E({ salary: 20000, pension: 3 }); return [r.pensionAmt === 600, f(r.pensionAmt, 2)]; });
    c('mistake', 'the 232 days exclude holiday, but not sickness, training or admin.', '232 days; no sickness or training input', () => {
      const r = E({ salary: 45000 });
      return [near(r.annual / r.perProductiveDay, 232, 1e-9) && !keys(P).some((k) => /sick|train|admin/i.test(k)), f(r.annual / r.perProductiveDay, 4) + ' days; inputs ' + keys(P).join(', ')];
    });
    c('dfaq', 'Unlike the employee’s NI, the employer rate never drops at higher salaries.', '15p on the pound at £60,000 and at £200,000', () => { const a = E({ salary: 60001 }).ni - E({ salary: 60000 }).ni, b = E({ salary: 200001 }).ni - E({ salary: 200000 }).ni; return [near(a, 0.15, 1e-6) && near(b, 0.15, 1e-6), f(a) + ' / ' + f(b)]; });
    c('dfaq', 'Yes, from £75,000 upwards.', 'the allowance is used up at £75,000, not below', () => {
      const a = E({ salary: 74999, allowance: 'yes' }).allowanceSaving, b = E({ salary: 75000, allowance: 'yes' }).allowanceSaving, cc = E({ salary: 90000, allowance: 'yes' }).allowanceSaving;
      return [a < 10500 && b === 10500 && cc === 10500, f(a, 2) + ' / ' + f(b, 2) + ' / ' + f(cc, 2)];
    });
    c('dfaq', 'Because it divides by productive hours only: 46.4 weeks of 37.5 hours, or 1,740, not 52 weeks.', 'annual ÷ per-hour = 1,740', () => { const r = E({ salary: 45000, pension: 5, overheads: 2500 }); return [near(r.annual / r.perProductiveHour, 1740, 1e-9), f(r.annual / r.perProductiveHour, 4)]; });
    c('dfaq', 'that is £32.04 an hour against £23.08 from salary alone.', '£45,000 ÷ 1,950 hours', () => [(45000 / (52 * 37.5)).toFixed(2) === '23.08', f(45000 / 1950, 4)]);
    c('formula', 'employer NI = (salary − secondary threshold) × 15%', 'the formula above the threshold, and nothing below it', () => {
      const rows = [3000, 5000, 12000, 45000, 250000].map((s) => { const n = E({ salary: s }).ni; return [near(n, Math.max(0, s - 5000) * 0.15, 1e-6), s + ': ' + f(n, 2)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('tip', 'Employer NI is 15% above a £5,000 secondary threshold, so it starts biting at low salaries', '£8,000 already pays £450', () => { const n = E({ salary: 8000 }).ni; return [near(n, 450, 1e-6), f(n, 2)]; });
    c('tip', 'The Employment Allowance offsets up to £10,500 of employer NI across the whole payroll, not per employee.', 'the offset is capped at £10,500', () => { const r = E({ salary: 300000, allowance: 'yes' }); return [r.allowanceSaving === 10500 && near(r.ni, 295000 * 0.15 - 10500, 1e-6), 'saved ' + f(r.allowanceSaving, 2)]; });
    c.m('tip', 'Companies whose only employee is also a director cannot claim it.', 'Employment Allowance eligibility is law (gov.uk); the tool only applies the allowance when told to');
    c('tip', 'Cost per productive hour assumes 5.6 weeks of statutory holiday and a 37.5-hour week.', '(52 − 5.6) × 37.5 hours', () => { const r = E({ salary: 30000 }); return [near(r.perProductiveHour, r.annual / ((52 - 5.6) * 37.5)), f(r.perProductiveHour, 4)]; });
    c('tip', 'Employer NI and a 3% pension put the on-cost at about 15–18% above salary for salaries from £25,000 to £150,000, before recruitment and equipment', 'on-cost from £25,000 to £150,000', () => {
      const rows = [25000, 30000, 45000, 60000, 100000, 150000].map((s) => { const o = E({ salary: s, pension: 3 }).onCost; return [o >= 14.95 && o < 18.5, s + ': ' + f(o, 2) + '%']; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('tip', 'a more generous pension adds to it.', 'on-cost rises with the pension rate', () => { const a = E({ salary: 40000, pension: 3 }).onCost, b = E({ salary: 40000, pension: 8 }).onCost; return [b > a, f(a, 2) + '% → ' + f(b, 2) + '%']; });
    c('faq', 'It is a single annual allowance of £10,500 set against your total employer NI bill, not a per-employee relief.', 'the allowance constant is £10,500', () => { const r = E({ salary: 120000, allowance: 'yes' }); return [r.allowanceSaving === 10500, f(r.allowanceSaving, 2)]; });
    c('faq', 'This tool shows the effect if you allocate it here', 'claiming it here lowers this employee\'s NI', () => { const a = E({ salary: 40000 }).ni, b = E({ salary: 40000, allowance: 'yes' }).ni; return [a > 0 && b < a, f(a, 2) + ' → ' + f(b, 2)]; });
    c('works', 'annual cost = salary + employer NI + employer pension + other costs', 'the sum', () => { const r = E({ salary: 33000, pension: 4, overheads: 1800, recruitment: 999 }); return [near(r.annual, 33000 + 0.15 * 28000 + 1320 + 1800, 1e-6), f(r.annual, 2)]; });
    c('works', 'employer NI = 15% × (salary − £5,000) − Employment Allowance claimed (up to £10,500)', 'with and without the allowance', () => {
      const a = E({ salary: 90000 }).ni, b = E({ salary: 90000, allowance: 'yes' }).ni, d = E({ salary: 20000, allowance: 'yes' }).ni;
      return [near(a, 12750, 1e-6) && near(b, 2250, 1e-6) && d === 0, [a, b, d].map((x) => f(x, 2)).join(', ')];
    });
    c('use', 'Put the first-year figure, recruitment included, in the budget request instead of the advertised salary.', 'first year = annual + recruitment', () => { const r = E({ salary: 45000, recruitment: 3000 }); return [near(r.firstYear, r.annual + 3000) && primary(P) === 'annual' && has(P, ['firstYear']), f(r.firstYear, 2)]; });
    c('use', 'Start from the cost per productive hour and add margin', 'per-hour output', () => [has(P, ['perProductiveHour']), outKeys(P).join(', ')]);
    c('ui', 'Recruitment cost (first year)', 'recruitment counts in the first year only', () => { const a = E({ salary: 40000, recruitment: 4000 }), b = E({ salary: 40000 }); return [a.annual === b.annual && a.firstYear === b.firstYear + 4000, 'annual ' + f(a.annual, 2) + ' / ' + f(b.annual, 2)]; });
  }

  /* ================================================================ */
  /* Profit margin & markup                                             */
  /* ================================================================ */
  {
    const P = '/business/profit-margin/';
    const c = page(P);
    const PM = at(P, { units: 1 });
    c.lc('Work out selling price, cost, margin and markup from any two of cost, price and margin.', 'all three pairs give all four', () => {
      const a = PM({ solve: 'price', cost: 24, margin: 35 }), b = PM({ solve: 'cost', price: 50, margin: 45 }), d = PM({ solve: 'margin', cost: 24, price: 30 });
      const ok = [a, b, d].every((r) => ['price', 'cost', 'marginPct', 'markupPct'].every((k) => isFinite(r[k])));
      return [ok && near(a.price, 24 / 0.65) && near(b.cost, 27.5) && near(d.marginPct, 20), 'price ' + f(a.price, 2) + '; cost ' + f(b.cost, 2) + '; margin ' + f(d.marginPct, 2) + '%'];
    });
    c('lede', 'Margin and markup are not the same thing.', '£24 → £30: 20% vs 25%', () => { const r = PM({ solve: 'margin', cost: 24, price: 30 }); return [near(r.marginPct, 20) && near(r.markupPct, 25), f(r.marginPct) + '% / ' + f(r.markupPct) + '%']; });
    c('why', 'Enter any two of cost, price and margin. Get the rest, both ways.', 'three solve modes, margin and markup each time', () => {
      const opts = (input(P, 'solve').options || []).map((o) => o.value).sort().join(',');
      const r = PM({ solve: 'cost', price: 80, margin: 25 });
      return [opts === 'cost,margin,price' && isFinite(r.marginPct) && isFinite(r.markupPct), 'modes ' + opts + '; margin ' + f(r.marginPct) + ', markup ' + f(r.markupPct)];
    });
    c('why', 'Read margin and markup', 'margin and markup outputs', () => [has(P, ['marginPct', 'markupPct']), outKeys(P).join(', ')]);
    c('what', 'A product bought for £24 and sold for £30 makes £6', 'profit £6', () => { const r = PM({ solve: 'margin', cost: 24, price: 30 }); return [near(r.profit, 6), f(r.profit, 2)]; });
    c('works', 'When you solve for price, the cost is divided by the share of the price left after the margin.', 'price = cost ÷ (1 − margin)', () => {
      const rows = [[24, 35], [60, 40], [7.5, 62.5]].map(([co, m]) => { const p = PM({ solve: 'price', cost: co, margin: m }).price; return [near(p, co / (1 - m / 100)), co + '@' + m + '%: ' + f(p, 4)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('works', 'Margin and markup also convert into each other without knowing the cost at all.', 'same margin, any cost: same markup', () => {
      const a = PM({ solve: 'price', cost: 10, margin: 30 }).markupPct, b = PM({ solve: 'price', cost: 1000, margin: 30 }).markupPct;
      return [near(a, b, 1e-9) && near(a, 30 / 0.7 * 100 / 100), f(a) + '% / ' + f(b) + '%'];
    });
    c('works', 'cost = price × (1 − margin)', 'solve for cost', () => { const r = PM({ solve: 'cost', price: 120, margin: 37.5 }); return [near(r.cost, 75), f(r.cost, 2)]; });
    c('works', 'margin = markup ÷ (1 + markup)', 'on three prices', () => {
      const rows = [[20, 24], [60, 90], [3, 10]].map(([co, p]) => { const r = PM({ solve: 'margin', cost: co, price: p }); const mk = r.markupPct / 100; return [near(r.marginPct / 100, mk / (1 + mk), 1e-12) && near(r.markupPct / 100, (r.marginPct / 100) / (1 - r.marginPct / 100), 1e-12), co + '→' + p + ': ' + f(r.marginPct) + '% / ' + f(r.markupPct) + '%']; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('works', 'price multiplier = price ÷ cost = 1 + markup', 'multiplier', () => { const r = PM({ solve: 'price', cost: 24, margin: 35 }); return [near(r.multiplier, r.price / 24) && near(r.multiplier, 1 + r.markupPct / 100), f(r.multiplier)]; });
    c('worked', 'Selling 500 lamps brings in', 'totals are per-unit × units', () => { const r = PM({ solve: 'price', cost: 24, margin: 35, units: 500 }); return [near(r.totalRevenue, r.price * 500) && near(r.totalProfit, r.profit * 500), f(r.totalRevenue, 2) + ' / ' + f(r.totalProfit, 2)]; });
    c('use', 'Solve for cost to find the most you can pay and still hold your margin at a fixed retail price.', 'the solved cost holds the margin exactly', () => { const r = PM({ solve: 'cost', price: 49.99, margin: 42 }); const back = PM({ solve: 'margin', cost: r.cost, price: 49.99 }); return [near(back.marginPct, 42, 1e-9), 'cost ' + f(r.cost, 4) + ' → margin ' + f(back.marginPct) + '%']; });
    c('use', 'Turn a supplier’s quoted markup into the margin your accounts will show.', 'a 50% markup (100 → 150) is a 33.333% margin', () => { const r = PM({ solve: 'margin', cost: 100, price: 150 }); return [near(r.marginPct, 100 / 3), f(r.marginPct, 3) + '%']; });
    c('use', 'Enter the discounted price as the selling price and see how much margin the offer leaves.', 'solve for margin at the offer price', () => { const r = PM({ solve: 'margin', cost: 24, price: 27 }); return [near(r.marginPct, 3 / 27 * 100), f(r.marginPct) + '%']; });
    c('dfaq', 'Divide the markup by one plus the markup: 0.20 ÷ 1.20.', '£20 → £24', () => { const r = PM({ solve: 'margin', cost: 20, price: 24 }); return [near(r.marginPct / 100, 0.2 / 1.2, 1e-12) && near(r.markupPct, 20), f(r.marginPct) + '%']; });
    c('dfaq', 'This tool works out gross margin on one product, from its own cost and price.', 'no overheads input', () => [!keys(P).some((k) => /overhead|rent|wage|fixed/i.test(k)), keys(P).join(', ')]);
    c('formula', 'margin = (price − cost) / price', 'margin and markup formulas', () => {
      const rows = [[60, 100], [24, 30], [99, 100]].map(([co, p]) => { const r = PM({ solve: 'margin', cost: co, price: p }); return [near(r.marginPct, (p - co) / p * 100) && near(r.markupPct, (p - co) / co * 100), co + '/' + p + ': ' + f(r.marginPct) + ', ' + f(r.markupPct)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('tip', 'a 50% markup is only a 33.3% margin, and a 100% markup is a 50% margin.', '100 → 150 and 100 → 200', () => { const a = PM({ solve: 'margin', cost: 100, price: 150 }).marginPct, b = PM({ solve: 'margin', cost: 100, price: 200 }).marginPct; return [a.toFixed(1) === '33.3' && near(b, 50), f(a) + '% / ' + f(b) + '%']; });
    c('tip', 'Margin is a share of the selling price; markup is a share of the cost.', 'labels and arithmetic', () => {
      const r = PM({ solve: 'margin', cost: 40, price: 50 });
      return [/price/.test(out(P, 'marginPct').label) && /cost/.test(out(P, 'markupPct').label) && near(r.marginPct, 20) && near(r.markupPct, 25), out(P, 'marginPct').label + ' / ' + out(P, 'markupPct').label];
    });
    c.m('tip', 'Retail and finance talk in margin, trade suppliers usually quote markup.', 'trade usage, not something the tool does');
    c('tip', 'Margin can never reach 100% — that would mean the goods cost nothing. Markup has no upper limit.', '100% margin refused; 99.99% allowed; markup 999,900%', () => {
      const a = PM({ solve: 'price', cost: 10, margin: 100 }), b = PM({ solve: 'price', cost: 10, margin: 99.99 }), d = PM({ solve: 'margin', cost: 1, price: 10000 });
      return [!!a.note && a.price === undefined && isFinite(b.price) && d.markupPct > 1000, 'note "' + (a.note || '') + '"; price at 99.99% ' + f(b.price, 2) + '; markup ' + f(d.markupPct, 0) + '%'];
    });
    c('faq', 'About 42.9%. Divide the margin by (1 − margin): 0.30 ÷ 0.70 = 0.4286.', '30% margin → markup', () => { const r = PM({ solve: 'price', cost: 100, margin: 30 }); return [r.markupPct.toFixed(1) === '42.9', f(r.markupPct) + '%']; });
    c('faq', 'Applying a 30% markup instead would leave you with only a 23% margin', '100 → 130', () => { const r = PM({ solve: 'margin', cost: 100, price: 130 }); return [Math.round(r.marginPct) === 23, f(r.marginPct) + '%']; });
    c('what', 'Gross margin is profit as a share of the selling price; markup is the same profit as a share of the cost.', 'one profit, two bases', () => { const r = PM({ solve: 'margin', cost: 37, price: 50 }); return [near(r.marginPct, 13 / 50 * 100) && near(r.markupPct, 13 / 37 * 100), f(r.marginPct) + '% / ' + f(r.markupPct) + '%']; });
    c.m('dfaq', 'Net margin also takes off rent, wages and other overheads, so it is always lower.', 'accounting definition; the tool has no overheads input (checked)');
    c.m('mistake', 'Leaving delivery, packaging and card fees out of the unit cost.', 'advice on what to enter');
    c('ui', 'Margin & markup (from cost + price)', 'that mode reads cost and price, not the target margin', () => { const a = PM({ solve: 'margin', cost: 60, price: 90, margin: 40 }), b = PM({ solve: 'margin', cost: 60, price: 90, margin: 5 }); return [near(a.marginPct, 100 / 3) && a.marginPct === b.marginPct, f(a.marginPct) + '%']; });
  }

  /* ================================================================ */
  /* Break-even                                                         */
  /* ================================================================ */
  {
    const P = '/business/break-even/';
    const c = page(P);
    const W = { fixed: 18000, price: 3.2, variable: 1.1, target: 6000, actual: 11000 };
    const BE = at(P, W);
    const profit = (units, w) => (w.price - w.variable) * units - w.fixed;
    c.lc('Find the sales volume and revenue where a product or business stops losing money.', 'a loss one unit below, none at the point', () => {
      const r = BE();
      return [profit(r.beUnits - 1, W) < 0 && profit(r.beUnits, W) >= 0 && near(r.beRevenue, W.fixed / (r.contributionRatio / 100)), r.beUnits + ' units; profit ' + f(profit(r.beUnits - 1, W), 2) + ' → ' + f(profit(r.beUnits, W), 2) + '; revenue ' + f(r.beRevenue, 2)];
    });
    c('why', 'Enter fixed costs, price and unit cost. Get your break-even point.', 'inputs and the units output', () => [['fixed', 'price', 'variable'].every((k) => keys(P).indexOf(k) >= 0) && has(P, ['beUnits']), keys(P).join(', ')]);
    c('why', 'Read units to break even', 'the headline is break-even units', () => [primary(P) === 'beUnits', 'primary ' + primary(P)]);
    c('what', 'Below it each period runs at a loss; above it every extra unit adds its full contribution to profit.', 'profit at expected sales either side', () => {
      const lo = BE({ actual: 8000 }).profitAtActual, a = BE({ actual: 9000 }).profitAtActual, b = BE({ actual: 9001 }).profitAtActual;
      return [lo < 0 && near(b - a, 2.1, 1e-9), 'at 8,000 ' + f(lo, 2) + '; 9,000 → 9,001 adds ' + f(b - a, 4)];
    });
    c('what', 'a lease, a hire or a machine raises the number of units you must sell every period.', 'more fixed cost, more units', () => { const a = BE().beUnits, b = BE({ fixed: 24000 }).beUnits; return [b > a, a + ' → ' + b]; });
    c('works', 'Fixed costs divided by that contribution give the units needed, rounded up to a whole unit', '8,571.4 → 8,572; 7,500 stays 7,500', () => {
      const a = BE().beUnits, b = BE({ price: 3.5 }).beUnits, d = BE({ fixed: 100, price: 3, variable: 1 }).beUnits;
      return [a === 8572 && b === 7500 && d === 50, a + ', ' + b + ', ' + d];
    });
    c('works', 'adding a target profit to the fixed costs gives the volume that earns it.', 'target units = ⌈(fixed + target) ÷ contribution⌉', () => {
      const r = BE();
      return [r.targetUnits === Math.ceil(24000 / 2.1) && profit(r.targetUnits, W) >= 6000 && profit(r.targetUnits - 1, W) < 6000, r.targetUnits + ' units; profit ' + f(profit(r.targetUnits, W), 2)];
    });
    c('works', 'margin of safety = (expected units − break-even units) ÷ expected units × 100', 'with break-even units = fixed ÷ contribution', () => { const r = BE(); return [near(r.marginOfSafety, (11000 - 18000 / 2.1) / 11000 * 100, 1e-9), f(r.marginOfSafety) + '%']; });
    c('works', 'operating leverage = contribution × expected units ÷ profit at expected units', 'the formula', () => { const r = BE(); return [near(r.operatingLeverage, 2.1 * 11000 / r.profitAtActual), f(r.operatingLeverage)]; });
    c('use', 'Try two or three prices and watch the units needed fall as contribution per unit rises.', '£3.20, £3.50, £4.00', () => { const v = [3.2, 3.5, 4].map((p) => BE({ price: p }).beUnits); return [v[0] > v[1] && v[1] > v[2], v.join(' → ')]; });
    c('use', 'Enter the profit you need and hand the team a unit figure to aim at.', 'target profit gives a unit figure', () => { const r = BE({ target: 10000 }); return [r.targetUnits === Math.ceil(28000 / 2.1), String(r.targetUnits)]; });
    c('mistake', 'add them to fixed costs or enter them as the target profit; otherwise break-even comes out too low.', 'both routes give the same unit figure', () => { const a = BE({ fixed: 24000, target: 0 }).beUnits, b = BE({ target: 6000 }).targetUnits; return [a === b && a > BE().beUnits, a + ' / ' + b]; });
    c.m('mistake', 'Using one average variable cost for products with very different margins.', 'advice on sales mix; the tool takes one product\'s figures');
    c('dfaq', 'Divide fixed costs by the contribution margin ratio.', 'revenue = fixed ÷ ratio', () => { const r = BE(); return [near(r.beRevenue, 18000 / (r.contributionRatio / 100)), f(r.beRevenue, 2)]; });
    c('dfaq', 'It drops quickly, because the whole increase is extra contribution.', '30p more price = 30p more contribution', () => { const a = BE().contribution, b = BE({ price: 3.5 }).contribution; return [near(b - a, 0.3, 1e-9), f(b - a, 4)]; });
    c('formula', 'break-even units = fixed costs / (price − variable cost per unit)', 'rounded up', () => {
      const rows = [[50000, 100, 60], [4500, 12, 4.5], [18000, 3.2, 1.1]].map(([fx, p, v]) => { const u = BE({ fixed: fx, price: p, variable: v }).beUnits; return [u === Math.ceil(fx / (p - v) - 1e-9), fx + '/(' + p + '−' + v + ') → ' + u]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('tip', 'Until fixed costs are covered, every sale reduces the loss rather than creating profit.', 'below break-even, profit < 0 but rising', () => { const a = BE({ actual: 5000 }).profitAtActual, b = BE({ actual: 6000 }).profitAtActual; return [a < b && b < 0, f(a, 2) + ' → ' + f(b, 2)]; });
    c('tip', 'Margin of safety is how far sales can fall before you hit break-even.', 'expected × (1 − margin) = break-even', () => { const r = BE(); return [near(11000 * (1 - r.marginOfSafety / 100), 18000 / 2.1, 1e-6), f(11000 * (1 - r.marginOfSafety / 100), 4)]; });
    c.m('tip', 'Below about 20% the business is fragile to a bad quarter.', 'business judgement, not something the tool computes');
    c('works', 'contribution = price − variable cost', 'contribution and its ratio', () => { const r = BE({ price: 7.25, variable: 2.5 }); return [near(r.contribution, 4.75) && near(r.contributionRatio, 4.75 / 7.25 * 100), f(r.contribution) + ', ' + f(r.contributionRatio) + '%']; });
    c('works', 'units for target = (fixed costs + target profit) ÷ contribution', 'rounded up', () => { const r = BE({ target: 2100 }); return [r.targetUnits === Math.ceil(20100 / 2.1 - 1e-9), String(r.targetUnits)]; });
    c('tip', 'Contribution per unit is what each sale adds towards covering fixed costs.', 'one more sale moves profit by the contribution', () => { const a = BE({ actual: 100 }).profitAtActual, b = BE({ actual: 101 }).profitAtActual; return [near(b - a, BE().contribution, 1e-9), f(b - a)]; });
    c('use', 'Add a new salary or lease to fixed costs and see how many extra units it demands each period.', '£2,000 more fixed cost = 1,000 more units at £2 contribution', () => { const a = BE({ price: 5, variable: 3, fixed: 20000 }).beUnits, b = BE({ price: 5, variable: 3, fixed: 22000 }).beUnits; return [b - a === 1000, a + ' → ' + b]; });
    c.m('faq', 'Costs that do not change with output over the period: rent, salaries, insurance, software subscriptions.', 'cost classification advice');
    c.m('dfaq', 'Break-even is a volume per period; payback is the time cumulative profit takes to repay a one-off investment.', 'definition; the tool computes break-even only');
    c('tip', 'High operating leverage — large fixed costs, small variable costs — magnifies both profit and loss when volume moves.', 'a 1% volume change moves profit by the leverage figure', () => {
      const r = BE(), up = BE({ actual: 11110 }).profitAtActual;
      return [near((up - r.profitAtActual) / r.profitAtActual * 100, r.operatingLeverage, 1e-6) && r.operatingLeverage > 1, 'leverage ' + f(r.operatingLeverage) + '; profit +' + f((up - r.profitAtActual) / r.profitAtActual * 100) + '%'];
    });
  }

  /* ================================================================ */
  /* CAGR                                                               */
  /* ================================================================ */
  {
    const P = '/business/cagr/';
    const c = page(P);
    const CG = at(P, { begin: 48000, end: 61500, years: 5, project: 2 });
    c.lc('Calculate the smoothed annual growth rate between two values, and project it forward.', 'rate and projection', () => {
      const r = CG(); const g = r.cagr / 100;
      return [near(48000 * Math.pow(1 + g, 5), 61500, 1e-6) && near(r.projected, 61500 * Math.pow(1 + g, 2), 1e-6), f(r.cagr) + '%; projected ' + f(r.projected, 2)];
    });
    c('why', 'Revenue rose 75% in three years. The investor asks for the annual growth rate, and averages mislead.', '200k → 350k: 75% total, 20.5% a year, not 25%', () => { const r = CG({ begin: 200000, end: 350000, years: 3 }); return [near(r.totalGrowth, 75) && r.cagr < 25 && r.cagr.toFixed(1) === '20.5', f(r.totalGrowth) + '% total, ' + f(r.cagr) + '% a year']; });
    c('why', 'Enter start value, end value and years. Get CAGR and a projection.', 'inputs and outputs', () => [['begin', 'end', 'years'].every((k) => keys(P).indexOf(k) >= 0) && has(P, ['cagr', 'projected']), keys(P).join(', ')]);
    c('why', 'Read CAGR and projection', 'the headline is CAGR', () => [primary(P) === 'cagr', 'primary ' + primary(P)]);
    c('what', 'the single yearly percentage that, compounded, takes a value from where it started to where it finished over a given number of years.', 'compounding the rate lands on the end value', () => {
      const rows = [[1000, 1800, 4], [100, 50, 3], [48000, 55000, 2.5]].map(([b, e, y]) => { const g = CG({ begin: b, end: e, years: y }).cagr / 100; return [near(b * Math.pow(1 + g, y), e, 1e-6), b + '→' + e + ' in ' + y + ': ' + f(g * 100) + '%']; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('works', 'Divide the end value by the start value to get the growth multiple, take the root for the number of years and subtract 1.', 'multiple and root', () => { const r = CG(); return [near(r.multiple, 61500 / 48000) && near(r.cagr, (Math.pow(61500 / 48000, 1 / 5) - 1) * 100), f(r.multiple) + ', ' + f(r.cagr) + '%']; });
    c('works', 'The projection then compounds the end value forward at the same rate.', 'year-by-year projection rows', () => {
      const r = CG({ project: 3 }); const g = r.cagr / 100;
      const rows = r._table.rows.map((x) => money(x[1]));
      return [rows.length === 3 && rows.every((v, i) => near(v, 61500 * Math.pow(1 + g, i + 1), 0.006)), rows.join(', ')];
    });
    c('works', 'total growth = (end − begin) ÷ begin × 100', 'total growth', () => { const r = CG(); return [near(r.totalGrowth, 13500 / 48000 * 100), f(r.totalGrowth) + '%']; });
    c('works', 'years to double = ln 2 ÷ ln(1 + CAGR)', 'years to double', () => { const r = CG(); return [near(r.doubling, Math.log(2) / Math.log(1 + r.cagr / 100)), f(r.doubling)]; });
    c('works', 'the years of growth between the two, not the number of data points', 'six data points means 5 years; entering 6 understates', () => { const a = CG({ years: 5 }).cagr, b = CG({ years: 6 }).cagr; return [b < a, f(a) + '% vs ' + f(b) + '%']; });
    c('worked', 'short of the 5.625% you get by dividing 28.125% by five', 'simple average 5.625% > CAGR', () => { const r = CG(); return [near(r.totalGrowth / 5, 5.625) && r.cagr < 5.625, f(r.totalGrowth / 5) + '% vs ' + f(r.cagr) + '%']; });
    c('mistake', 'entering 6 understates the rate.', 'years 6 gives a lower rate', () => { const a = CG({ years: 5 }).cagr, b = CG({ years: 6 }).cagr; return [b < a, f(b) + '% < ' + f(a) + '%']; });
    c('mistake', 'It assumes the past rate carries on unchanged', 'each projected year grows by the same factor', () => {
      const r = CG({ project: 5 }); const v = r._table.rows.map((x) => money(x[1]));
      const fs = v.slice(1).map((x, i) => x / v[i]);
      return [fs.every((x) => near(x, 1 + r.cagr / 100, 1e-6)), fs.map((x) => f(x, 6)).join(', ')];
    });
    c('dfaq', 'The years-to-double figure is then blank, since a shrinking value never doubles.', 'no doubling time when falling', () => { const r = CG({ begin: 100000, end: 81000, years: 2, project: 0 }); return [show(P, 'doubling', r.doubling) === '—', 'shows ' + show(P, 'doubling', r.doubling)]; });
    c('dfaq', 'The formula accepts fractional years unchanged', '2.5 and 2.25 years', () => {
      const a = CG({ begin: 48000, end: 55000, years: 2.5 }).cagr, b = CG({ begin: 48000, end: 55000, years: 2.25 }).cagr;
      return [near(a, (Math.pow(55000 / 48000, 1 / 2.5) - 1) * 100) && near(b, (Math.pow(55000 / 48000, 1 / 2.25) - 1) * 100), f(a) + '%, ' + f(b) + '%'];
    });
    c('dfaq', 'CAGR on the opening and closing balances counts your own deposits as growth', 'no deposits input', () => [!keys(P).some((k) => /deposit|contrib|flow|withdraw/i.test(k)), keys(P).join(', ')]);
    c('formula', 'CAGR = (ending / beginning)^(1/years) − 1', 'the formula', () => {
      const rows = [[1e6, 1.8e6, 4], [100, 81, 2], [5, 500, 10]].map(([b, e, y]) => { const r = CG({ begin: b, end: e, years: y }); return [near(r.cagr, (Math.pow(e / b, 1 / y) - 1) * 100), f(r.cagr) + '%']; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('tip', 'Two businesses with identical CAGR can have wildly different year-to-year records', 'only start, end and years go in', () => [K.j(keys(P)) === K.j(['begin', 'end', 'years', 'project']), keys(P).join(', ')]);
    c.m('tip', 'It is meaningless over very short periods, and easily manipulated by choosing a flattering start year.', 'judgement about the measure, not tool behaviour');
    c('works', 'CAGR = (end ÷ begin)^(1 ÷ years) − 1', 'the depth formula', () => { const r = CG({ begin: 250, end: 610, years: 7 }); return [near(r.cagr, (Math.pow(610 / 250, 1 / 7) - 1) * 100), f(r.cagr) + '%']; });
    c('works', 'projected value = end × (1 + CAGR)^(years forward)', 'projection', () => { const r = CG({ project: 4 }); return [near(r.projected, 61500 * Math.pow(1 + r.cagr / 100, 4), 1e-6), f(r.projected, 2)]; });
    c.m('mistake', 'Comparing rates over very different lengths as if they were equally proven.', 'judgement about evidence, not tool behaviour');
    c('use', 'Work out the yearly growth a five-year revenue target really requires', 'today and the target over 5 years', () => { const r = CG({ begin: 400000, end: 1000000, years: 5 }); return [near(400000 * Math.pow(1 + r.cagr / 100, 5), 1000000, 1e-6), f(r.cagr) + '%']; });
    c('tip', 'The rule of 72 is a decent mental check: 72 ÷ growth rate ≈ years to double.', 'within half a year at 6%, 8% and 12%', () => {
      const rows = [6, 8, 12].map((p) => { const d = CG({ begin: 100, end: Math.pow(1 + p / 100, 5) * 100, years: 5 }).doubling; return [Math.abs(d - 72 / p) < 0.5, p + '%: ' + f(d, 2) + ' vs ' + f(72 / p, 2)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('faq', 'Rising 50% then falling 50% averages to zero, but leaves you 25% down. CAGR is the geometric mean', '100 → 150 → 75', () => {
      const r = CG({ begin: 100, end: 75, years: 2 });
      return [near(r.totalGrowth, -25) && near(r.cagr, (Math.sqrt(1.5 * 0.5) - 1) * 100), f(r.totalGrowth) + '% total; ' + f(r.cagr) + '% a year'];
    });
  }

  /* ================================================================ */
  /* NPV & IRR                                                          */
  /* ================================================================ */
  {
    const P = '/business/npv-irr/';
    const c = page(P);
    const W = { initial: 80000, flows: '20000, 25000, 30000, 30000', rate: 8 };
    const NP = at(P, W);
    const npvOf = (I, cf, r) => cf.reduce((s, x, i) => s + x / Math.pow(1 + r, i + 1), 0) - I;
    c.lc('Value a project with net present value, internal rate of return and discounted payback.', 'NPV, IRR and discounted payback', () => { const r = NP(); return [has(P, ['npv', 'irr', 'dpb']) && isFinite(r.npv) && isFinite(r.irr) && isFinite(r.dpb), f(r.npv, 2) + ', ' + f(r.irr) + '%, ' + f(r.dpb)]; });
    c('why', 'Whether it is worth doing depends on when the money arrives.', 'same flows reversed, different NPV', () => { const a = NP().npv, b = NP({ flows: '30000, 30000, 25000, 20000' }).npv; return [b > a, f(a, 2) + ' → ' + f(b, 2)]; });
    c('why', 'Enter the outlay, cash flows and rate. Get NPV, IRR and payback.', 'inputs and outputs', () => [K.j(keys(P)) === K.j(['initial', 'flows', 'rate']) && has(P, ['npv', 'irr', 'dpb']), keys(P).join(', ')]);
    c('why', 'Read NPV, IRR and verdict', 'a verdict output', () => { const r = NP(); return [/^Accept/.test(r.verdict), r.verdict]; });
    c('what', 'The internal rate of return (IRR) is the discount rate at which that NPV falls to exactly zero.', 'NPV at the IRR', () => { const r = NP(); const z = NP({ rate: r.irr }).npv; return [Math.abs(z) < 0.01, 'NPV at ' + f(r.irr) + '%: ' + f(z, 6)]; });
    c('what', 'less the money you put in at the start', 'NPV falls pound for pound with the outlay', () => { const a = NP().npv, b = NP({ initial: 81000 }).npv; return [near(a - b, 1000, 1e-6), f(a - b, 6)]; });
    c('works', 'Flows count as arriving at the end of each period', '£110 in one period at 10% is worth £100', () => { const r = NP({ initial: 0, flows: '110', rate: 10 }); return [near(r.npv, 100, 1e-9), f(r.npv, 6)]; });
    c('works', 'IRR is found by halving the range of rates until NPV is zero.', 'IRR to 1e-6 on three projects', () => {
      const rows = [[80000, [20000, 25000, 30000, 30000]], [10000, [5000, 5000, 5000]], [100000, [30000, 30000, 30000, 30000, 30000]]].map(([I, cf]) => { const irr = NP({ initial: I, flows: cf.join(', ') }).irr; return [Math.abs(npvOf(I, cf, irr / 100)) < 1e-4, f(irr, 6) + '%']; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('works', 'profitability index = (NPV + I) ÷ I', 'PI', () => { const r = NP(); return [near(r.pi, (r.npv + 80000) / 80000), f(r.pi)]; });
    c('works', 'the initial investment, paid at period 0', 'row 0 is the outlay, undiscounted', () => { const t = NP()._table.rows[0]; return [t[0] === '0' && t[2] === '1.0000' && money(t[3]) === -80000, t.join(' | ')]; });
    c('worked', 'so the machine adds value', 'verdict Accept', () => { const r = NP(); return [r.npv > 0 && /^Accept/.test(r.verdict), r.verdict]; });
    c('mistake', 'It belongs in its own box at period 0; the list starts with what period 1 brings in.', 'the first listed flow is discounted once', () => { const t = NP()._table.rows[1]; return [t[0] === '1' && near(money(t[3]), 20000 / 1.08, 0.006), t.join(' | ')]; });
    c('mistake', 'Mixing period lengths: quarterly cash flows need a quarterly discount rate.', 'the rate is applied once per listed period', () => {
      const t = NP({ rate: 2 })._table.rows;
      return [t.slice(1).every((x, i) => x[2] === (1 / Math.pow(1.02, i + 1)).toFixed(4)), t.map((x) => x[2]).join(', ')];
    });
    c('dfaq', 'That the project earns less than your discount rate, not necessarily that it loses money.', 'negative NPV above the IRR, with inflows above the outlay', () => { const r = NP({ rate: 12 }); return [r.npv < 0 && 12 > r.irr && r.totalUndisc > 80000, f(r.npv, 2) + ' at 12% (IRR ' + f(r.irr) + '%)']; });
    c('dfaq', 'yet it still returns £105,000 in cash', 'undiscounted total does not depend on the rate', () => { const a = NP({ rate: 12 }).totalUndisc; return [a === 105000 && NP({ rate: 3 }).totalUndisc === 105000, String(a)]; });
    c('dfaq', 'It counts how many periods the present values, not the raw cash, take to cover the outlay, so it is always the longer of the two.', 'discounted payback > simple payback', () => {
      const simple = (I, cf) => { let cum = -I; for (let i = 0; i < cf.length; i++) { if (cum + cf[i] >= 0) return i + (-cum / cf[i]); cum += cf[i]; } return NaN; };
      const rows = [[80000, [20000, 25000, 30000, 30000], 8], [50000, [12000, 15000, 15000, 15000, 15000], 10], [1000, [600, 600], 1]].map(([I, cf, rt]) => { const d = NP({ initial: I, flows: cf.join(', '), rate: rt }).dpb, s = simple(I, cf); return [d > s, f(d) + ' vs ' + f(s)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('formula', 'NPV = Σ CFₜ / (1 + r)ᵗ − initial investment', 'against the formula', () => {
      const rows = [[80000, [20000, 25000, 30000, 30000], 8], [0, [-50, 100, 200], 15], [500, [100, 0, 700], 0]].map(([I, cf, rt]) => { const v = NP({ initial: I, flows: cf.join(', '), rate: rt }).npv; return [near(v, npvOf(I, cf, rt / 100), 1e-6), f(v, 4)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('tip', 'NPV above zero means the project beats your cost of capital.', 'NPV > 0 exactly when the rate is below the IRR', () => { const irr = NP().irr; const a = NP({ rate: irr - 0.5 }), b = NP({ rate: irr + 0.5 }); return [a.npv > 0 && b.npv < 0 && /^Reject/.test(b.verdict), f(a.npv, 2) + ' / ' + f(b.npv, 2)]; });
    c('tip', 'IRR fails when cash flows change sign more than once, which can produce several valid answers. NPV never has that problem', '−100, +230, −132: NPV 0 at 10% and 20%, no IRR shown', () => {
      const a = NP({ initial: 100, flows: '230, -132', rate: 10 }), b = NP({ initial: 100, flows: '230, -132', rate: 20 });
      return [Math.abs(a.npv) < 1e-6 && Math.abs(b.npv) < 1e-6 && show(P, 'irr', a.irr) === '—' && isFinite(NP({ initial: 100, flows: '230, -132', rate: 15 }).npv), 'NPV ' + f(a.npv, 8) + ' / ' + f(b.npv, 8) + '; IRR shows ' + show(P, 'irr', a.irr)];
    });
    c('tip', 'Move it by two points and marginal projects flip.', 'the machine at 10% and at 12%', () => { const a = NP({ rate: 10 }).npv, b = NP({ rate: 12 }).npv; return [a > 0 && b < 0, f(a, 2) + ' / ' + f(b, 2)]; });
    c('tip', 'The profitability index (PV of inflows ÷ investment)', 'PI = PV of inflows ÷ outlay', () => { const r = NP(); return [near(r.pi, npvOf(0, [20000, 25000, 30000, 30000], 0.08) / 80000), f(r.pi, 6)]; });
    c.m('faq', 'Usually your weighted average cost of capital, or the return available on the next-best use of the money.', 'finance practice, not tool behaviour');
    c('works', 'Each cash flow is divided by (1 + r) to the power of how many periods away it is, and the results are added.', 'present values in the table', () => {
      const t = NP()._table.rows.slice(1);
      return [t.every((x, i) => near(money(x[3]), [20000, 25000, 30000, 30000][i] / Math.pow(1.08, i + 1), 0.006)) && near(money(NP()._table.rows[4][4]), NP().npv, 0.006), t.map((x) => x[3]).join(', ')];
    });
    c('works', 'NPV = CF₁ ÷ (1 + r) + CF₂ ÷ (1 + r)² + … + CFₙ ÷ (1 + r)ⁿ − I', 'the depth formula', () => { const v = NP({ initial: 1000, flows: '400, 400, 400', rate: 9 }).npv; return [near(v, npvOf(1000, [400, 400, 400], 0.09), 1e-9), f(v, 4)]; });
    c('works', 'the discount rate per period, as a decimal', 'a 2% rate discounts each period by 1.02', () => { const t = NP({ rate: 2 })._table.rows; return [t[1][2] === (1 / 1.02).toFixed(4), t[1][2]]; });
    c('tip', 'a large IRR on a tiny project can still be worth less than a modest IRR on a large one.', '23.4% on £10,000 vs 15.2% on £100,000 at 10%', () => {
      const a = NP({ initial: 10000, flows: '5000, 5000, 5000', rate: 10 }), b = NP({ initial: 100000, flows: '30000, 30000, 30000, 30000, 30000', rate: 10 });
      return [a.irr > b.irr && b.npv > a.npv, 'IRR ' + f(a.irr) + ' / ' + f(b.irr) + '; NPV ' + f(a.npv, 2) + ' / ' + f(b.npv, 2)];
    });
    c.m('tip', 'The discount rate is the assumption that matters most.', 'judgement; the flip at two points is checked above');
    c('ui', 'Cash flows per period (comma separated)', 'commas, stray spaces and a trailing comma', () => { const a = NP({ flows: '20000,25000, 30000 ,30000,' }).npv, b = NP().npv; return [near(a, b, 1e-9), f(a, 2) + ' / ' + f(b, 2)]; });
  }

  /* ================================================================ */
  /* ROI                                                                */
  /* ================================================================ */
  {
    const P = '/business/roi/';
    const c = page(P);
    const RI = at(P, { cost: 12000, gain: 18500, years: 4, annualCash: 4500 });
    c.lc('Calculate return on investment, annualised return and how long an investment takes to pay for itself.', 'ROI, annualised and payback', () => { const r = RI(); return [near(r.roi, 6500 / 12000 * 100) && isFinite(r.annualised) && near(r.payback, 12000 / 4500), f(r.roi) + '%, ' + f(r.annualised) + '%, ' + f(r.payback)]; });
    c('why', 'Enter cost, return and years. Get ROI, annual return and payback.', 'inputs and outputs', () => [['cost', 'gain', 'years'].every((k) => keys(P).indexOf(k) >= 0) && has(P, ['roi', 'annualised', 'payback']), keys(P).join(', ')]);
    c('why', 'Compare ROI and annual rate', 'both shown', () => [has(P, ['roi', 'annualised']) && primary(P) === 'roi', outKeys(P).join(', ')]);
    c('what', 'On its own it ignores how long the money was tied up, which is why the tool also gives the annualised return and the payback period.', 'ROI ignores years; annualised does not', () => { const a = RI({ years: 2 }), b = RI({ years: 8 }); return [a.roi === b.roi && a.annualised > b.annualised, f(a.roi) + '% both; ' + f(a.annualised) + '% vs ' + f(b.annualised) + '%']; });
    c('works', 'The annualised figure is the steady yearly rate that would turn the cost into the total return over the holding period', 'cost × (1 + a)^years = return', () => { const r = RI(); return [near(12000 * Math.pow(1 + r.annualised / 100, 4), 18500, 1e-6), f(r.annualised) + '%']; });
    c('works', 'payback divides the cost by one year’s cash inflow.', 'cost ÷ annual cash', () => { const r = RI({ annualCash: 3000 }); return [near(r.payback, 4), f(r.payback)]; });
    c('works', 'return multiple = total return ÷ cost', 'multiple', () => { const r = RI(); return [near(r.multiple, 18500 / 12000), f(r.multiple)]; });
    c('works', 'what it brings in each year, used only for payback', 'annual cash changes nothing else', () => { const a = RI({ annualCash: 1000 }), b = RI({ annualCash: 9000 }); return [a.roi === b.roi && a.annualised === b.annualised && a.multiple === b.multiple && a.payback !== b.payback, f(a.payback) + ' / ' + f(b.payback)]; });
    c('mistake', 'enter £6,500 instead of £18,500 for the oven and the tool reports a loss.', 'return 6,500 on 12,000', () => { const r = RI({ gain: 6500 }); return [r.roi < 0 && r.netGain < 0, f(r.roi) + '%, ' + f(r.netGain, 2)]; });
    c('dfaq', 'Enter any cost, twice that as the total return and 7 years: the ROI shows 100% and the annualised figure 10.409%.', 'three costs', () => {
      const rows = [1, 12345, 1e6].map((x) => { const r = RI({ cost: x, gain: 2 * x, years: 7 }); return [near(r.roi, 100) && r.annualised.toFixed(3) === '10.409', x + ': ' + f(r.roi) + '%, ' + f(r.annualised) + '%']; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('dfaq', 'With that box at zero, the tool has nothing to divide the cost by, so it leaves payback out.', 'no payback figure at zero inflow', () => { const r = RI({ annualCash: 0 }); return [show(P, 'payback', r.payback) === '—', 'shows ' + show(P, 'payback', r.payback)]; });
    c('formula', 'ROI = (gain − cost) / cost   ·   annualised = (1 + ROI)^(1/years) − 1', 'the formula', () => {
      const rows = [[25000, 40000, 3], [5000, 4000, 2], [100, 300, 0.5]].map(([co, g, y]) => { const r = RI({ cost: co, gain: g, years: y }); const roi = (g - co) / co; return [near(r.roi, roi * 100) && near(r.annualised, (Math.pow(1 + roi, 1 / y) - 1) * 100), f(r.roi) + '%, ' + f(r.annualised) + '%']; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('tip', 'A 60% return over five years is worse than 30% over two.', 'annualised 9.86% vs 14.02%', () => { const a = RI({ cost: 100, gain: 160, years: 5 }).annualised, b = RI({ cost: 100, gain: 130, years: 2 }).annualised; return [a < b, f(a) + '% vs ' + f(b) + '%']; });
    c('tip', 'Simple ROI ignores the timing of cash flows.', 'ROI unchanged by years and annual cash', () => { const a = RI({ years: 1, annualCash: 100 }).roi, b = RI({ years: 9, annualCash: 9000 }).roi; return [a === b, f(a) + ' / ' + f(b)]; });
    c('tip', 'Payback period says nothing about what happens after payback', 'payback unchanged by the total return and years', () => { const a = RI({ gain: 13000, years: 2 }).payback, b = RI({ gain: 90000, years: 9 }).payback; return [a === b, f(a) + ' / ' + f(b)]; });
    c.m('faq', 'For a business case, yes. Excluding founder or staff time makes projects look far better than they are', 'advice on what to count, not tool behaviour');
    c('works', 'ROI = (total return − cost) ÷ cost × 100', 'ROI', () => { const r = RI({ cost: 640, gain: 1000 }); return [near(r.roi, 360 / 640 * 100), f(r.roi) + '%']; });
    c('works', 'annualised return = (total return ÷ cost)^(1 ÷ years) − 1', 'annualised', () => { const r = RI({ cost: 640, gain: 1000, years: 2.5 }); return [near(r.annualised, (Math.pow(1000 / 640, 1 / 2.5) - 1) * 100), f(r.annualised) + '%']; });
    c('tip', 'Always compare the annualised figure, not the headline ROI.', 'equal ROI, different annual rates', () => { const a = RI({ years: 2 }), b = RI({ years: 6 }); return [a.roi === b.roi && a.annualised !== b.annualised, f(a.annualised) + '% / ' + f(b.annualised) + '%']; });
    c.m('mistake', 'A campaign that cost £5,000 and brought in £6,000 of orders has not made 20%; only the profit on those orders counts.', 'advice on what to enter as the return');
  }

  /* ================================================================ */
  /* Depreciation                                                       */
  /* ================================================================ */
  {
    const P = '/business/depreciation/';
    const c = page(P);
    const DP = at(P, { method: 'sl', cost: 36000, salvage: 4000, life: 5, dbRate: 25 });
    const rows = (r) => r._table.rows.map((x) => ({ y: +x[0], charge: money(x[1]), acc: money(x[2]), book: money(x[3]) }));
    c.lc('Straight-line, reducing balance, double declining and sum-of-years digits, with a full year-by-year schedule.', 'four methods, one row a year', () => {
      const opts = (input(P, 'method').options || []).map((o) => o.value).join(',');
      const n = ['sl', 'db', 'ddb', 'syd'].map((m) => DP({ method: m, life: 12 })._table.rows.length);
      return [opts === 'sl,db,ddb,syd' && n.every((x) => x === 12), 'methods ' + opts + '; rows ' + n.join(',')];
    });
    c('why', 'Pick a method, enter cost and life. Get the year-by-year schedule.', '7-year life, 7 rows', () => { const n = DP({ method: 'db', life: 7 })._table.rows.length; return [n === 7, n + ' rows']; });
    c('what', 'The charge reduces profit and the asset’s book value', 'closing book = cost − accumulated', () => { const rs = rows(DP({ method: 'syd' })); return [rs.every((x) => near(x.book, 36000 - x.acc, 0.011)), rs.map((x) => x.book).join(', ')]; });
    c('works', 'Straight line charges the same amount every year.', 'equal charges', () => { const rs = rows(DP()); return [rs.every((x) => near(x.charge, 6400, 0.001)), rs.map((x) => x.charge).join(', ')]; });
    c('works', 'Reducing balance charges a fixed percentage of the opening book value', '25% of each opening value', () => {
      const rs = rows(DP({ method: 'db', salvage: 0 })); let open = 36000;
      const ok = rs.every((x) => { const g = near(x.charge, open * 0.25, 0.006); open = x.book; return g; });
      return [ok, rs.map((x) => x.charge).join(', ')];
    });
    c('works', 'double declining uses twice the straight-line percentage, 2 ÷ life, until straight line over the remaining years gives more.', '£10,000 over 5 years switches in year 4', () => {
      const r = DP({ method: 'ddb', cost: 10000, salvage: 0, life: 5 }); const ch = rows(r).map((x) => x.charge);
      return [K.j(ch) === K.j([4000, 2400, 1440, 1080, 1080]) && /year 4/.test(r.note), ch.join(', ') + '; ' + r.note];
    });
    c('works', 'Sum of years’ digits takes a falling fraction of the depreciable amount each year.', '5/15 … 1/15 of £32,000', () => { const ch = rows(DP({ method: 'syd' })).map((x) => x.charge); return [[5, 4, 3, 2, 1].every((k, i) => near(ch[i], 32000 * k / 15, 0.006)), ch.join(', ')]; });
    c('works', 'straight line = (cost − residual) ÷ life', 'three assets', () => { const v = [[50000, 5000, 5], [1200, 0, 3], [9999, 999, 7]].map(([co, s, l]) => [near(DP({ cost: co, salvage: s, life: l }).firstYear, Math.round((co - s) / l * 100) / 100, 0.001), DP({ cost: co, salvage: s, life: l }).firstYear]); return [v.every((x) => x[0]), v.map((x) => x[1]).join(', ')]; });
    c('works', 'double declining = larger of opening book value × 2 ÷ life and (book value − residual) ÷ years left', 'each year the larger of the two, floored at the residual', () => {
      const ok = [[36000, 4000, 5], [10000, 0, 5], [20000, 1000, 8]].every(([co, s, l]) => {
        let book = co;
        return rows(DP({ method: 'ddb', cost: co, salvage: s, life: l })).every((x, i) => { let e = Math.max(book * 2 / l, (book - s) / (l - i)); if (book - e < s) e = book - s; const g = near(x.charge, e, 0.006); book -= e; return g; });
      });
      return [ok, rows(DP({ method: 'ddb', cost: 20000, salvage: 1000, life: 8 })).map((x) => x.charge).join(', ')];
    });
    c('works', 'what you expect to sell it for at the end of its life', 'final book value = residual (sl, syd, ddb)', () => { const v = ['sl', 'syd', 'ddb'].map((m) => DP({ method: m }).finalBook); return [v.every((x) => near(x, 4000, 1e-6)), v.map((x) => f(x, 2)).join(', ')]; });
    c('worked', 'Both this and straight line write off £32,000 in total; straight line simply spreads it evenly.', 'ddb and sl totals', () => { const a = DP({ method: 'ddb' }).totalDepreciation, b = DP().totalDepreciation; return [near(a, 32000, 1e-6) && near(b, 32000, 1e-6), f(a, 2) + ' / ' + f(b, 2)]; });
    c('use', 'Copy the yearly charge and closing book value into the register for each asset.', 'schedule columns', () => { const h = DP()._table.head; return [h.indexOf('Charge') >= 0 && h.indexOf('Closing book value') >= 0, h.join(', ')]; });
    c('use', 'Post the annual charge to depreciation expense and to accumulated depreciation.', 'accumulated = running total of charges', () => { let s = 0; const rs = rows(DP({ method: 'db' })); return [rs.every((x) => { s += x.charge; return near(x.acc, s, 0.03); }), rs.map((x) => x.acc).join(', ')]; });
    c('use', 'Compare how each method shapes reported profit in the first two or three years.', 'first-year charges differ by method', () => { const v = ['sl', 'db', 'ddb', 'syd'].map((m) => DP({ method: m }).firstYear); return [new Set(v).size === 4, v.join(', ')]; });
    c.m('mistake', 'Freehold land does not wear out and is normally not depreciated', 'accounting standard (FRS 102 / IAS 16), not tool behaviour');
    c('mistake', 'Setting a zero residual for assets that sell on, such as vans: all but reducing balance then write off too much.', 'residual 0 vs £4,000: totals by method', () => {
      const tot = (m, s) => DP({ method: m, salvage: s }).totalDepreciation;
      const more = ['sl', 'syd', 'ddb'].every((m) => tot(m, 0) > tot(m, 4000));
      const db = tot('db', 0) === tot('db', 4000);
      return [more && db, ['sl', 'syd', 'ddb', 'db'].map((m) => m + ' ' + f(tot(m, 0), 2) + '/' + f(tot(m, 4000), 2)).join('; ')];
    });
    c('dfaq', 'Reducing balance uses whatever rate you enter, such as 25%; double declining sets it at twice the straight-line rate, so 40% for a five-year life and 20% for ten.', 'db follows the rate box; ddb ignores it', () => {
      const a = DP({ method: 'db', dbRate: 25 }).firstYear, b = DP({ method: 'db', dbRate: 30 }).firstYear;
      const d5 = DP({ method: 'ddb', dbRate: 25 }).firstYear, d5b = DP({ method: 'ddb', dbRate: 70 }).firstYear, d10 = DP({ method: 'ddb', life: 10 }).firstYear;
      return [a === 9000 && b === 10800 && d5 === 14400 && d5b === 14400 && d10 === 7200, [a, b, d5, d5b, d10].join(', ')];
    });
    c('dfaq', 'Year 1 takes 5/15 of the depreciable amount, year 2 takes 4/15 and so on.', 'syd year 2', () => { const ch = rows(DP({ method: 'syd' }))[1].charge; return [near(ch, 32000 * 4 / 15, 0.006), String(ch)]; });
    c.m('dfaq', 'The charge stops at the date of sale.', 'accounting treatment of a disposal; the tool has no sale date');
    c('formula', 'straight line = (cost − salvage) / life', 'the formula', () => { const r = DP({ cost: 50000, salvage: 5000, life: 5 }); return [r.firstYear === 9000, String(r.firstYear)]; });
    c('tip', 'Straight line spreads the cost evenly', 'equal charges over 8 years', () => { const ch = rows(DP({ life: 8 })).map((x) => x.charge); return [ch.every((x) => x === ch[0]), ch.join(', ')]; });
    c('tip', 'Reducing balance front-loads the charge', 'charges fall year on year', () => { const ch = rows(DP({ method: 'db', salvage: 0 })).map((x) => x.charge); return [ch.every((x, i) => i === 0 || x < ch[i - 1]), ch.join(', ')]; });
    c.m('tip', 'In the UK, capital allowances — not your depreciation policy — determine the tax deduction.', 'UK tax law');
    c('tip', 'No method may take the book value below the residual value, which is why the final year is often a smaller charge.', 'a 60% reducing balance stops at the residual', () => {
      const r = DP({ method: 'db', dbRate: 60 }); const rs = rows(r);
      const all = ['sl', 'db', 'ddb', 'syd'].every((m) => rows(DP({ method: m, dbRate: 60 })).every((x) => x.book >= 4000 - 1e-6));
      const dd = rows(DP({ method: 'ddb' }));
      return [all && near(r.finalBook, 4000, 1e-6) && dd[4].charge < dd[3].charge, rs.map((x) => x.book).join(', ') + '; ddb last ' + dd[4].charge];
    });
    c.m('faq', 'Depreciation is added back for UK corporation tax and replaced by capital allowances', 'UK tax law');
    c('works', 'reducing balance = opening book value × rate', 'year 2 is 25% of year 1\'s closing value', () => { const rs = rows(DP({ method: 'db' })); return [near(rs[1].charge, rs[0].book * 0.25, 0.006), rs[1].charge + ' = 25% of ' + rs[0].book]; });
    c('dfaq', 'Both charge a percentage of the opening book value.', 'db and ddb year 2 as a share of the opening value', () => {
      const a = rows(DP({ method: 'db' })), b = rows(DP({ method: 'ddb' }));
      return [near(a[1].charge / a[0].book, 0.25, 1e-6) && near(b[1].charge / b[0].book, 0.4, 1e-6), f(a[1].charge / a[0].book) + ', ' + f(b[1].charge / b[0].book)];
    });
  }

  /* ================================================================ */
  /* Loan amortisation schedule                                         */
  /* ================================================================ */
  {
    const P = '/business/amortization-schedule/';
    const c = page(P);
    const AM = at(P, { amount: 150000, rate: 4.5, years: 20, overpay: 0, view: 'monthly' });
    const rows = (r) => r._table.rows.map((x) => ({ k: +x[0], pay: money(x[1]), prin: money(x[2]), int: money(x[3]), bal: money(x[4]) }));
    const cross = (i) => { const rs = rows(AM(Object.assign({ view: 'annual' }, i))); const y = rs.find((x) => x.prin > x.int); return y ? y.k : NaN; };
    c.lc('Principal, interest and balance month by month for five years or year by year to the end, with overpayments.', '60 monthly rows; 20 yearly rows to £0.00; overpayment shortens', () => {
      const m = AM(), a = AM({ view: 'annual' }), o = AM({ view: 'annual', overpay: 100 });
      const last = a._table.rows[a._table.rows.length - 1];
      return [m._table.rows.length === 60 && a._table.rows.length === 20 && last[4] === '£0.00' && o.months < 240, m._table.rows.length + ' monthly, ' + a._table.rows.length + ' yearly, last balance ' + last[4] + '; with overpay ' + o.months + ' months'];
    });
    c('why', 'Enter loan, rate and term. See the schedule, with overpayments.', 'schedule and overpayment', () => { const a = AM({ overpay: 200 }); return [a._table.rows.length > 0 && keys(P).indexOf('overpay') >= 0 && a.monthsSaved > 0, a._table.rows.length + ' rows; ' + a.monthsSaved + ' months saved']; });
    c('why', 'Read the schedule and savings', 'interest and months saved', () => { const r = AM({ overpay: 100 }); return [has(P, ['interestSaved', 'monthsSaved']) && r.interestSaved > 0, f(r.interestSaved, 2) + ', ' + r.monthsSaved]; });
    c('why', 'Most of each early payment goes on interest.', 'month 1 at the default figures', () => { const t = rows(K.calc(P, { view: 'monthly' }))[0]; return [t.int > t.prin, 'interest ' + t.int + ', principal ' + t.prin]; });
    c('what', 'each row split into the interest charged that month, the principal repaid and the balance left afterwards', 'monthly columns', () => { const h = AM()._table.head; return [K.j(h) === K.j(['Month', 'Payment', 'Principal', 'Interest', 'Balance']), h.join(', ')]; });
    c('works', 'Each row starts from the balance the row above left. Interest is that balance times the monthly rate', 'every row of the first five years', () => {
      const rs = rows(AM()); let bal = 150000; const r = 0.045 / 12;
      const ok = rs.every((x) => { const g = near(x.int, bal * r, 0.006) && near(x.bal, bal - x.prin, 0.011); bal = x.bal; return g; });
      return [ok, 'month 60 balance ' + rs[59].bal];
    });
    c('works', 'and M is set so the last row reaches £0.00.', 'last yearly balance £0.00 after exactly 240 payments', () => { const a = AM({ view: 'annual' }); const t = a._table.rows; return [t[t.length - 1][4] === '£0.00' && a.months === 240, t[t.length - 1].join(' | ') + '; ' + a.months + ' months']; });
    c('works', 'principal(k) = M + overpayment − interest(k)', 'month 1 with £100 extra', () => { const r = AM({ overpay: 100 }); const t = rows(r)[0]; return [near(t.prin, r.monthly + 100 - t.int, 0.011), t.prin + ' = ' + f(r.monthly, 2) + ' + 100 − ' + t.int]; });
    c('works', 'M = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1)', 'the payment formula', () => { const r = 0.045 / 12, n = 240; const m = 150000 * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1); return [near(AM().monthly, m, 1e-9), f(AM().monthly, 4)]; });
    c('works', 'r = annual rate ÷ 12 ÷ 100', 'month 1 interest is balance × rate ÷ 1,200', () => { const t = rows(AM())[0]; return [t.int === 562.5, String(t.int)]; });
    c('worked', 'Every later row tilts a little further towards principal', 'principal rises every month', () => { const rs = rows(AM()); return [rs.every((x, i) => i === 0 || x.prin > rs[i - 1].prin), rs[0].prin + ' … ' + rs[59].prin]; });
    c('use', 'Switch to the annual summary and look for the first year the Principal column is larger than the Interest column.', 'annual columns and the crossover', () => { const h = AM({ view: 'annual' })._table.head; return [h.indexOf('Principal') >= 0 && h.indexOf('Interest') >= 0 && cross({}) === 6, h.join(', ') + '; crossover year ' + cross({})]; });
    c('use', 'Read the balance at the end of a two- or five-year fixed rate to know how much you will be refinancing.', 'annual year 2 and 5 balances = monthly rows 24 and 60', () => {
      const a = rows(AM({ view: 'annual' })), m = rows(AM());
      return [a[1].bal === m[23].bal && a[4].bal === m[59].bal, a[1].bal + ', ' + a[4].bal];
    });
    c('use', 'Split each year’s repayments into interest, which goes to the profit and loss account, and capital', 'Paid = Principal + Interest each year', () => { const a = rows(AM({ view: 'annual' })); return [a.every((x) => near(x.pay, x.prin + x.int, 0.011)), a.slice(0, 2).map((x) => x.pay + '=' + x.prin + '+' + x.int).join('; ')]; });
    c('mistake', 'more than half the original debt.', 'balance after 12 years > £75,000', () => { const b = rows(AM({ view: 'annual' }))[11].bal; return [b > 75000, String(b)]; });
    c('mistake', 'Only the Interest column is cost; the Principal column is your own debt being handed back.', 'principal sums to the loan; interest to the total interest', () => {
      const r = AM({ view: 'annual' }); const a = rows(r);
      const p = a.reduce((s, x) => s + x.prin, 0), i = a.reduce((s, x) => s + x.int, 0);
      return [near(p, 150000, 0.1) && near(i, r.totalInterest, 0.1), f(p, 2) + ' / ' + f(i, 2)];
    });
    c('dfaq', 'Higher rates and longer terms push the crossover later.', 'year 6; later at 6% and over 25 years', () => { const a = cross({}), b = cross({ rate: 6 }), d = cross({ years: 25 }); return [b > a && d > a, a + ', ' + b + ', ' + d]; });
    c('dfaq', 'The calculator keeps the payment fixed and lets the term shorten.', '£100 extra: same contractual payment, fewer months', () => { const a = AM(), b = AM({ overpay: 100 }); return [a.monthly === b.monthly && near(b.withOverpay, a.monthly + 100) && b.months < 240, f(b.withOverpay, 2) + '; ' + b.months + ' months']; });
    c('dfaq', 'This schedule models a capital-and-interest repayment loan.', 'balance falls every month', () => { const rs = rows(AM()); return [rs.every((x, i) => x.bal < (i ? rs[i - 1].bal : 150000)), 'month 60 ' + rs[59].bal]; });
    c('formula', 'M = P · [r(1+r)ⁿ] / [(1+r)ⁿ − 1]', 'the default loan', () => { const r = 0.055 / 12, n = 300; const m = 200000 * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1); const v = K.calc(P, {}).monthly; return [near(v, m, 1e-9), f(v, 4)]; });
    c('tip', 'Early payments are mostly interest because interest is charged on the outstanding balance, which is highest at the start.', 'month 1 interest share; falls after', () => { const rs = rows(K.calc(P, { view: 'monthly' })); return [rs[0].int > rs[0].pay / 2 && rs[59].int < rs[0].int, 'month 1 ' + rs[0].int + ' of ' + rs[0].pay + '; month 60 ' + rs[59].int]; });
    c('tip', 'An overpayment goes entirely to principal', 'month 1 principal rises by exactly the overpayment', () => { const a = rows(AM())[0], b = rows(AM({ overpay: 250 }))[0]; return [near(b.prin - a.prin, 250, 0.011) && a.int === b.int, f(b.prin - a.prin, 2)]; });
    c.m('tip', 'Check for early repayment charges before overpaying. Many fixed-rate deals cap annual overpayments at 10%.', 'lender terms; the tool has no repayment-charge input');
    c('works', 'interest(k) = balance(k − 1) × r', 'month 2 interest on month 1\'s balance', () => { const rs = rows(AM()); return [near(rs[1].int, rs[0].bal * 0.045 / 12, 0.006), rs[1].int + ' on ' + rs[0].bal]; });
    c('works', 'balance(k) = balance(k − 1) − principal(k)', 'month 2 balance', () => { const rs = rows(AM()); return [near(rs[1].bal, rs[0].bal - rs[1].prin, 0.011), rs[1].bal]; });
    c('tip', 'Small, early overpayments do the most work.', '£50 a month saves more than half of what £100 saves', () => { const a = AM({ overpay: 50 }).interestSaved, b = AM({ overpay: 100 }).interestSaved; return [a > b / 2 && a > 0, f(a, 2) + ' vs ' + f(b, 2)]; });
    c('faq', 'Shortening the term saves far more interest, because the balance falls faster.', '20 years against 25 on £200,000', () => { const a = K.calc(P, { years: 25 }).totalInterest, b = K.calc(P, { years: 20 }).totalInterest; return [b < a * 0.8, f(a, 2) + ' → ' + f(b, 2)]; });
    c('ui', 'Extra payment each month', 'added to every monthly payment', () => { const r = AM({ overpay: 75 }); const rs = rows(r); return [rs.slice(0, -1).every((x) => near(x.pay, r.monthly + 75, 0.011)), f(rs[0].pay, 2)]; });
  }

  /* ================================================================ */
  /* Financial ratios                                                   */
  /* ================================================================ */
  {
    const P = '/business/business-ratios/';
    const c = page(P);
    const W = { currentAssets: 84000, inventory: 46000, currentLiabilities: 70000, totalAssets: 210000, totalDebt: 90000, equity: 95000, revenue: 420000, grossProfit: 147000, netProfit: 16800 };
    const BR = at(P, W);
    const ratios = ['current', 'quick', 'grossMargin', 'netMargin', 'roa', 'roe', 'assetTurnover', 'gearing', 'debtRatio', 'equityRatio'];
    c.lc('Liquidity, profitability, efficiency and leverage ratios from balance sheet and P&L figures.', 'one of each kind', () => { const r = BR(); return [['current', 'quick', 'netMargin', 'roe', 'assetTurnover', 'gearing'].every((k) => isFinite(r[k])), ratios.map((k) => k + ' ' + f(r[k], 3)).join(', ')]; });
    c('why', 'Enter balance sheet and P&L figures. Get ten key ratios at once.', 'ten ratios and working capital', () => {
      const os = S(P).outputs.filter((o) => o.format !== 'currency').map((o) => o.key);
      return [os.length === 10 && K.j(os.slice().sort()) === K.j(ratios.slice().sort()) && out(P, 'workingCapital').format === 'currency', os.length + ': ' + os.join(', ')];
    });
    c('what', 'Because they are proportions, a firm with £400,000 of revenue can be set beside one with £4 million.', 'every figure × 10, same ratios', () => {
      const a = BR(), w10 = {}; Object.keys(W).forEach((k) => { w10[k] = W[k] * 10; }); const b = BR(w10);
      return [ratios.every((k) => near(a[k], b[k], 1e-9)), 'gearing ' + f(a.gearing) + ' / ' + f(b.gearing)];
    });
    c('works', 'Margins, returns and the structure ratios are shown as percentages; current, quick and asset turnover as plain multiples.', 'output formats', () => {
      const pc = ['grossMargin', 'netMargin', 'roa', 'roe', 'gearing', 'debtRatio', 'equityRatio'].every((k) => out(P, k).format === 'percent');
      const nm = ['current', 'quick', 'assetTurnover'].every((k) => out(P, k).format === 'number');
      return [pc && nm, ratios.map((k) => k + ':' + out(P, k).format).join(', ')];
    });
    c('works', 'current ratio = current assets ÷ current liabilities', 'current', () => { const r = BR(); return [near(r.current, 1.2), f(r.current)]; });
    c('works', 'quick ratio = (current assets − inventory) ÷ current liabilities', 'quick', () => { const r = BR(); return [near(r.quick, 38000 / 70000), f(r.quick)]; });
    c('works', 'net margin = net profit ÷ revenue × 100', 'net margin and ROE', () => { const r = BR(); return [near(r.netMargin, 4) && near(r.roe, 16800 / 95000 * 100), f(r.netMargin) + '%, ' + f(r.roe) + '%']; });
    c('works', 'asset turnover = revenue ÷ total assets', 'turnover and gearing', () => { const r = BR(); return [near(r.assetTurnover, 2) && near(r.gearing, 90000 / 95000 * 100), f(r.assetTurnover) + ', ' + f(r.gearing) + '%']; });
    c('works', 'debt ratio = total debt ÷ total assets × 100', 'debt ratio', () => { const r = BR(); return [near(r.debtRatio, 90000 / 210000 * 100), f(r.debtRatio) + '%']; });
    c('worked', 'without selling stock it could meet only about half of its short-term bills', 'quick ratio near 0.5', () => { const q = BR().quick; return [q > 0.45 && q < 0.6, f(q)]; });
    c('use', 'Lenders often test current ratio and gearing against loan covenants', 'both shown', () => [has(P, ['current', 'gearing']), outKeys(P).join(', ')]);
    c('mistake', 'a six-month profit against a year-end balance sheet halves ROA and ROE.', 'half the profit, half the returns', () => { const a = BR(), b = BR({ netProfit: 8400 }); return [near(b.roa, a.roa / 2) && near(b.roe, a.roe / 2), f(a.roa) + '→' + f(b.roa) + ', ' + f(a.roe) + '→' + f(b.roe)]; });
    c('mistake', 'Gearing here means interest-bearing borrowing, which is why debt plus equity need not equal total assets.', 'debt + equity ≠ assets is accepted', () => { const r = BR(); return [90000 + 95000 !== 210000 && isFinite(r.gearing) && near(r.debtRatio + r.equityRatio, 185000 / 210000 * 100), 'debt ratio + equity ratio = ' + f(r.debtRatio + r.equityRatio) + '%']; });
    c('dfaq', 'Around 1 means current liabilities could be paid from cash and debtors alone.', 'quick = 1 when cash and debtors equal the liabilities', () => { const r = BR({ currentAssets: 116000 }); return [near(r.quick, 1), f(r.quick)]; });
    c('dfaq', 'Gearing compares debt with equity and can pass 100% in a solvent business; the debt ratio compares debt with total assets.', 'debt 150k, equity 100k, assets 300k', () => { const r = BR({ totalDebt: 150000, equity: 100000, totalAssets: 300000 }); return [near(r.gearing, 150) && near(r.debtRatio, 50), f(r.gearing) + '%, ' + f(r.debtRatio) + '%']; });
    c('dfaq', 'ROA divides net profit by all the assets the business uses, however they are financed; ROE divides it by the owners’ stake alone.', 'ROA and ROE', () => { const r = BR(); return [near(r.roa, 8) && near(r.roe, 16800 / 95000 * 100) && r.roe > r.roa, f(r.roa) + '%, ' + f(r.roe) + '%']; });
    c('formula', 'current ratio = current assets / current liabilities', 'the formula', () => { const r = BR({ currentAssets: 250000, currentLiabilities: 150000 }); return [near(r.current, 250000 / 150000), f(r.current)]; });
    c('tip', 'The quick ratio strips out inventory, which is the hardest current asset to convert quickly. If quick is far below current, a lot of value is tied up in stock.', 'current − quick = inventory ÷ liabilities', () => { const r = BR(); return [near(r.current - r.quick, 46000 / 70000), f(r.current - r.quick)]; });
    c.m('tip', 'A current ratio near 1.5–2 is often comfortable, but the sensible range varies enormously by sector.', 'sector norms; not tool behaviour');
    c.m('tip', 'Ratios only mean something in comparison — against your own history, or against sector peers.', 'advice on reading ratios');
    c.m('faq', 'Debt is cheaper than equity and magnifies returns when the business earns more than the interest costs.', 'corporate finance judgement');
  }

  /* ================================================================ */
  /* Sales commission                                                   */
  /* ================================================================ */
  {
    const P = '/business/commission-calculator/';
    const c = page(P);
    const CM = at(P, { sales: 85000, structure: 'threshold', rate: 8, threshold: 40000, base: 26000 });
    const com = (structure, sales, o) => CM(Object.assign({ structure, sales }, o || {})).commission;
    c.lc('Flat, tiered and threshold-based commission, with on-target earnings and effective rate.', 'OTE = base + commission at 100% of quota, each structure', () => {
      const rows = ['flat', 'threshold', 'tiered'].map((s) => { const r = CM({ structure: s }); const at100 = CM({ structure: s, sales: 40000 }).total; return [near(r.ote, at100) && isFinite(r.effectiveRate), s + ' OTE ' + f(r.ote, 2) + ' (at quota ' + f(at100, 2) + '), effective ' + f(r.effectiveRate) + '%']; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('why', 'Pick the structure, enter sales. Get commission and effective rate.', 'structures and outputs', () => [(input(P, 'structure').options || []).length === 3 && has(P, ['commission', 'effectiveRate']), (input(P, 'structure').options || []).map((o) => o.label).join(', ')]);
    c('why', 'Read the commission earned', 'headline is commission', () => [primary(P) === 'commission', 'primary ' + primary(P)]);
    c('works', 'Flat pays the rate on all sales. Threshold pays it only on sales above the quota.', 'flat and threshold either side of quota', () => {
      const a = com('flat', 30000), b = com('threshold', 40000), d = com('threshold', 40001);
      return [near(a, 2400) && b === 0 && near(d, 0.08, 1e-9), 'flat 30k ' + f(a, 2) + '; threshold at quota ' + b + ', £1 over ' + f(d, 4)];
    });
    c('works', 'Tiered pays the base rate up to quota, 1.5 times it from quota to twice quota, and double it beyond that.', 'the next pound at 8%, 12%, 16%', () => {
      const d = (s) => com('tiered', s + 1) - com('tiered', s);
      const a = d(39999), b = d(40000), e = d(79999), g = d(80000);
      return [near(a, 0.08, 1e-9) && near(b, 0.12, 1e-9) && near(e, 0.12, 1e-9) && near(g, 0.16, 1e-9), [a, b, e, g].map((x) => f(x, 4)).join(', ')];
    });
    c('works', 'effective rate = commission ÷ sales × 100', 'effective rate and attainment', () => { const r = CM(); return [near(r.effectiveRate, 3600 / 85000 * 100) && near(r.attainment, 85000 / 40000 * 100), f(r.effectiveRate) + '%, ' + f(r.attainment) + '%']; });
    c('works', 'sales up to quota, from quota to twice quota, and above twice quota', 'tier rows for £85,000', () => { const t = CM({ structure: 'tiered' })._table.rows.map((x) => money(x[1])); return [K.j(t) === K.j([40000, 40000, 5000]), t.join(', ')]; });
    c('worked', 'The first £40,000 earns nothing and the £45,000 above it earns £3,600', 'threshold rows', () => { const t = CM()._table.rows; return [money(t[0][1]) === 40000 && money(t[0][3]) === 0 && money(t[1][1]) === 45000 && money(t[1][3]) === 3600, t.map((x) => x.join(' | ')).join(' / ')]; });
    c('mistake', 'Each rate covers only the sales inside its band, as income tax bands do, so reaching tier 3 does not re-rate the first pound.', '£1 into tier 3 adds 16p, no more', () => { const a = com('tiered', 80000), b = com('tiered', 80001); return [near(b - a, 0.16, 1e-9) && near(a, 3200 + 4800), f(a, 2) + ' → ' + f(b, 2)]; });
    c('mistake', 'so employer National Insurance, and pension where the scheme counts commission, come on top of the figure here.', 'total is base + commission, nothing added', () => { const r = CM(); return [r.total === 26000 + r.commission && !keys(P).some((k) => /ni|pension/i.test(k)), f(r.total, 2)]; });
    c.m('mistake', 'Agree before the first payout whether a sale counts when booked, invoiced or paid, and when commission is clawed back.', 'plan-design advice');
    c('dfaq', 'At the same rate and sales, tiered pays most once sales pass quota, then flat, then threshold.', 'tiered > flat > threshold above quota', () => {
      const rows = [40001, 60000, 85000, 200000].map((s) => { const t = com('tiered', s), fl = com('flat', s), th = com('threshold', s); return [t > fl && fl > th, s + ': ' + [t, fl, th].map((x) => f(x, 2)).join(' / ')]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('dfaq', 'OTE is base salary plus the commission paid at exactly 100% of quota.', 'flat 8%, £40,000 quota, £26,000 base', () => { const r = CM({ structure: 'flat', sales: 85000 }); return [near(r.ote, 29200), f(r.ote, 2)]; });
    c('dfaq', 'An accelerator raises the commission rate on sales beyond a point, so pay keeps rising with every sale.', 'the tiered rate never falls as sales rise', () => {
      const d = [10000, 50000, 90000, 150000].map((s) => com('tiered', s + 1) - com('tiered', s));
      return [d.every((x, i) => x > 0 && (i === 0 || x >= d[i - 1])), d.map((x) => f(x, 4)).join(', ')];
    });
    c.m('dfaq', 'A bonus is usually a fixed sum for hitting a target', 'pay practice; the tool has no bonus');
    c('formula', 'commission = Σ (sales in tier × tier rate)', 'tier rows sum to the commission', () => {
      const r = CM({ structure: 'tiered', sales: 123456 }); const s = r._table.rows.reduce((a, x) => a + money(x[3]), 0);
      return [near(s, r.commission, 0.02), f(s, 2) + ' / ' + f(r.commission, 2)];
    });
    c('tip', 'Accelerators reward over-performance and are usually cheaper than raising the base rate, because they only pay out on the sales you most want.', 'tiered = flat up to quota, more only above it', () => {
      const a = com('tiered', 35000), b = com('flat', 35000), d = com('tiered', 60000), e = com('flat', 60000);
      return [near(a, b) && d > e, f(a, 2) + '=' + f(b, 2) + '; ' + f(d, 2) + '>' + f(e, 2)];
    });
    c.m('tip', 'A common split is 50/50 base to variable for new business roles, and 70/30 or 80/20 for account management.', 'pay practice');
    c.m('tip', 'Commission on revenue can push a team towards discounting. Paying on gross profit removes that incentive.', 'plan-design advice');
    c.m('faq', 'Profit aligns the seller with the business, since discounting then costs them directly.', 'plan-design advice');
    c('works', 'flat: commission = sales × rate', 'flat', () => { const v = com('flat', 123456); return [near(v, 123456 * 0.08), f(v, 2)]; });
    c('works', 'threshold: commission = max(0, sales − quota) × rate', 'threshold below and above', () => { const a = com('threshold', 30000), b = com('threshold', 52000); return [a === 0 && near(b, 12000 * 0.08), a + ', ' + f(b, 2)]; });
    c('works', 'tiered: commission = tier 1 × rate + tier 2 × 1.5 × rate + tier 3 × 2 × rate', '£85,000 tiered', () => { const v = com('tiered', 85000); return [near(v, 40000 * 0.08 + 40000 * 0.12 + 5000 * 0.16), f(v, 2)]; });
    c('works', 'the threshold figure: where commission starts, or where tier 1 ends', 'the quota moves both', () => { const a = com('threshold', 60000, { threshold: 50000 }), b = com('tiered', 60000, { threshold: 50000 }); return [near(a, 800) && near(b, 4000 + 1200), f(a, 2) + ', ' + f(b, 2)]; });
    c('use', 'Model what the business pays at 80%, 100% and 200% of quota before the rates are published.', 'attainment follows sales', () => { const v = [32000, 40000, 80000].map((s) => CM({ sales: s }).attainment); return [K.j(v.map((x) => Math.round(x))) === K.j([80, 100, 200]), v.join(', ')]; });
  }

  /* ================================================================ */
  /* Discount & sale price                                              */
  /* ================================================================ */
  {
    const P = '/business/discount-calculator/';
    const c = page(P);
    const DC = at(P, { original: 80, d1: 25, d2: 10, cost: 44 });
    c.lc('Apply single or stacked discounts and see the effective discount and the margin impact.', 'single and stacked, effective and margins', () => {
      const a = DC({ d2: 0 }), b = DC();
      return [near(a.final, 60) && near(a.effective, 25) && near(b.final, 54) && near(b.effective, 32.5) && near(b.marginAfter, 10 / 54 * 100), 'single ' + f(a.final, 2) + ' (' + f(a.effective) + '%), stacked ' + f(b.final, 2) + ' (' + f(b.effective) + '%), margin ' + f(b.marginBefore) + '→' + f(b.marginAfter)];
    });
    c('why', 'Enter the price and discounts. See the sale price and the margin hit.', 'final price and both margins', () => [primary(P) === 'final' && has(P, ['marginBefore', 'marginAfter']), outKeys(P).join(', ')]);
    c('why', 'Check the margin after', 'margin after discount', () => { const r = DC(); return [r.marginAfter < r.marginBefore, f(r.marginBefore) + ' → ' + f(r.marginAfter)]; });
    c('what', 'The second is taken from the already-reduced price, so the total reduction, the effective discount, is always less than the two percentages added together.', 'effective < sum for six pairs', () => {
      const rows = [[25, 10], [20, 20], [50, 50], [1, 1], [90, 5], [33.3, 66.6]].map(([a, b]) => { const r = DC({ d1: a, d2: b }); return [r.effective < a + b, a + '+' + b + ': ' + f(r.effective) + '%']; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('what', 'since every pound off the price comes out of it.', 'profit = final − cost', () => { const r = DC(); return [near(r.profitAfter, r.final - 44), f(r.profitAfter, 2)]; });
    c('works', 'Multiply the original price by what each discount leaves: 75% for 25% off, 90% for 10% off.', '£80 × 0.75 × 0.9', () => { const r = DC(); return [near(r.final, 80 * 0.75 * 0.9), f(r.final, 2)]; });
    c('works', 'both margins compare profit with the selling price.', 'before on the original, after on the final price', () => { const r = DC(); return [near(r.marginBefore, 36 / 80 * 100) && near(r.marginAfter, 10 / 54 * 100), f(r.marginBefore) + '%, ' + f(r.marginAfter) + '%']; });
    c('works', 'effective discount = (original − final) ÷ original × 100', 'effective', () => { const r = DC({ original: 129.99, d1: 15, d2: 7.5 }); return [near(r.effective, (129.99 - r.final) / 129.99 * 100), f(r.effective) + '%']; });
    c('worked', 'so the shop must sell 3.6 jackets at the sale price to earn what one earned at full price.', '£36 ÷ £10', () => { const r = DC(); return [near((80 - 44) / r.profitAfter, 3.6, 1e-9), f((80 - 44) / r.profitAfter)]; });
    c('use', 'Check whether one 30% discount beats 20% followed by 10%: it does', '30% vs 20% + 10%', () => { const a = DC({ d1: 30, d2: 0 }).effective, b = DC({ d1: 20, d2: 10 }).effective; return [a > b, f(a) + '% vs ' + f(b) + '%']; });
    c('mistake', 'A £44 item sold at £54 makes £10: 18.519% of the price but about 22.7% of cost', 'margin vs markup', () => { const r = DC(); return [(10 / 44 * 100).toFixed(1) === '22.7' && r.marginAfter.toFixed(3) === '18.519', f(r.marginAfter, 3) + '% of price, ' + f(10 / 44 * 100, 3) + '% of cost']; });
    c('mistake', 'since multiplication ignores order', 'swapped discounts, same price', () => {
      const rows = [[25, 10], [12.5, 40], [3, 97]].map(([a, b]) => { const x = DC({ d1: a, d2: b }).final, y = DC({ d1: b, d2: a }).final; return [near(x, y, 1e-9), f(x, 4) + '/' + f(y, 4)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('dfaq', 'Adding the percentages back onto the sale price gives the wrong answer.', '£54 × 1.35 ≠ £80; £54 ÷ 0.75 ÷ 0.9 = £80', () => { const r = DC(); return [near(r.final / 0.75 / 0.9, 80, 1e-9) && !near(r.final * 1.35, 80, 0.5), f(r.final / 0.75 / 0.9, 2) + ' vs ' + f(r.final * 1.35, 2)]; });
    c('dfaq', 'so any combined discount beyond 45%, a price under £44, sells at a loss.', '45% breaks even, 46% loses', () => { const a = DC({ d1: 45, d2: 0 }), b = DC({ d1: 30, d2: 22.86 }); return [near(a.profitAfter, 0, 1e-9) && b.effective > 45 && b.profitAfter < 0, f(a.profitAfter, 2) + '; ' + f(b.effective) + '% → ' + f(b.profitAfter, 2)]; });
    c('dfaq', 'Take 10%, add half of it again, and subtract', '15% = 10% + 5%', () => { const r = DC({ original: 45, d1: 15, d2: 0, cost: 0 }); return [near(r.saved, 4.5 + 2.25), f(r.saved, 2)]; });
    c('formula', 'sale price = original × (1 − d₁) × (1 − d₂) …', 'the formula', () => {
      const rows = [[200, 20, 0], [99.99, 12, 8], [10, 100, 50]].map(([o, a, b]) => { const r = DC({ original: o, d1: a, d2: b }); return [near(r.final, o * (1 - a / 100) * (1 - b / 100), 1e-9), f(r.final, 4)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('tip', 'Stacked discounts do not add. 20% then 20% is 36% off, not 40%', '20% + 20%', () => { const r = DC({ d1: 20, d2: 20 }); return [near(r.effective, 36) && r.naiveSum === 40, f(r.effective) + '% vs ' + r.naiveSum + '%']; });
    c('tip', 'On a 50% margin, a 20% discount removes 40% of your profit per unit.', '£100, cost £50, 20% off', () => { const r = DC({ original: 100, cost: 50, d1: 20, d2: 0 }); return [near(r.profitAfter, 30) && near(1 - r.profitAfter / 50, 0.4), 'profit ' + f(r.profitAfter, 2)]; });
    c('tip', 'To hold profit steady after a discount you must sell disproportionately more units.', 'volume rise 67% for a 20% discount', () => { const r = DC({ original: 100, cost: 50, d1: 20, d2: 0 }); const need = 50 / r.profitAfter - 1; return [need > 0.2 / 0.8, f(need * 100, 2) + '% more units']; });
    c('faq', 'so you need roughly 67% more unit sales just to stand still.', '50 ÷ 30', () => { const r = DC({ original: 100, cost: 50, d1: 20, d2: 0 }); return [Math.round((50 / r.profitAfter - 1) * 100) === 67, f((50 / r.profitAfter - 1) * 100, 2) + '%']; });
    c('works', 'final = original × (1 − d₁ ÷ 100) × (1 − d₂ ÷ 100)', 'depth formula', () => { const r = DC({ original: 59.99, d1: 12.5, d2: 4 }); return [near(r.final, 59.99 * 0.875 * 0.96, 1e-9), f(r.final, 4)]; });
    c('works', 'margin before = (original − cost) ÷ original × 100', 'margin before', () => { const r = DC({ original: 59.99, cost: 21 }); return [near(r.marginBefore, (59.99 - 21) / 59.99 * 100), f(r.marginBefore) + '%']; });
    c('works', 'margin after = (final − cost) ÷ final × 100', 'margin after', () => { const r = DC({ original: 59.99, cost: 21 }); return [near(r.marginAfter, (r.final - 21) / r.final * 100), f(r.marginAfter) + '%']; });
    c('tip', 'Discounts hit margin far harder than they hit price.', '20% off price, 40% off profit', () => { const r = DC({ original: 100, cost: 50, d1: 20, d2: 0 }); return [(50 - r.profitAfter) / 50 > r.effective / 100, f(r.effective) + '% off price, ' + f((50 - r.profitAfter) / 50 * 100) + '% off profit']; });
    c('faq', 'Divide the current contribution per unit by the post-discount contribution.', '50 ÷ 30', () => { const r = DC({ original: 100, cost: 50, d1: 20, d2: 0 }); return [near(50 / r.profitAfter, 5 / 3), f(50 / r.profitAfter)]; });
    c('ui', 'Unit cost (optional)', 'a blank cost still prices; margins left out', () => { const r = DC({ cost: null }); return [near(r.final, 54) && show(P, 'marginAfter', r.marginAfter) === '—', 'final ' + f(r.final, 2) + '; margin ' + show(P, 'marginAfter', r.marginAfter)]; });
  }

  /* ================================================================ */
  /* Invoice due date & settlement discount                            */
  /* ================================================================ */
  {
    const P = '/business/invoice-payment-terms/';
    const c = page(P);
    const IV = at(P, { invoiceDate: '2026-11-02', terms: '60', amount: 8500, discount: 1.5, discountDays: 14, daysLate: 0, baseRate: 3.75 });
    const plusDays = (iso, n) => { const t = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400000; return new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
    const eff = (E, w) => { const x = E / 100 * w / 365; return x / (1 + x) * 100; };
    c.lc('Work out payment due dates, late payment interest, and whether an early settlement discount is worth taking.', 'due date, interest and verdict', () => { const r = IV({ daysLate: 20 }); return [r.dueDate === 'Fri, 1 Jan 2027' && r.interest > 0 && /^Yes|^Marginal/.test(r.worthTaking), r.dueDate + '; ' + f(r.interest, 2) + '; ' + r.worthTaking]; });
    c('why', 'Enter the invoice and terms. Get the due date and discount verdict.', 'due date and verdict', () => [primary(P) === 'dueDate' && has(P, ['worthTaking']), outKeys(P).join(', ')]);
    c('why', 'Read due date and verdict', 'verdict text', () => { const r = IV(); return [/^Yes/.test(r.worthTaking), r.worthTaking]; });
    c('what', '“Net 30” means the full amount is due 30 calendar days after the invoice date', 'weekends count', () => {
      const a = IV({ invoiceDate: '2026-09-01', terms: '30' }).dueDate, b = IV({ invoiceDate: '2026-10-02', terms: '7' }).dueDate;
      return [a === 'Thu, 1 Oct 2026' && b === 'Fri, 9 Oct 2026', a + '; ' + b];
    });
    c('what', 'terms such as “2/10 net 30” add a discount for paying within 10 days', 'discount deadline +10 days', () => { const r = IV({ invoiceDate: '2026-09-01', terms: '30', discount: 2, discountDays: 10 }); return [r.discountDate === 'Fri, 11 Sept 2026' || r.discountDate === 'Fri, 11 Sep 2026', r.discountDate]; });
    c('works', 'The due date is the invoice date plus the net days.', 'every term', () => {
      const rows = ['7', '14', '30', '45', '60', '90'].map((t) => { const d = IV({ invoiceDate: '2026-12-20', terms: t }).dueDate; return [d === plusDays('2026-12-20', +t), t + ': ' + d]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('works', 'Passing up a discount is treated as borrowing the discounted sum from the discount deadline to the due date.', 'discount ÷ discounted sum over the extra days', () => { const r = IV(); return [near(r.effAnnual, r.discountAmount / r.payIfEarly * 365 / 46 * 100), f(r.effAnnual) + '%']; });
    c('works', 'annualised cost = d ÷ (1 − d) × 365 ÷ (net days − discount days)', 'the formula on three terms', () => {
      const rows = [[30, 2, 10], [60, 1.5, 14], [90, 1, 10]].map(([n, d, dd]) => { const v = IV({ terms: String(n), discount: d, discountDays: dd }).effAnnual; return [near(v, (d / 100) / (1 - d / 100) * 365 / (n - dd) * 100), f(v) + '%']; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('works', 'statutory interest = amount × (8% + base rate) × days late ÷ 365', '£8,500, 20 days, 3.75%', () => { const r = IV({ daysLate: 20 }); return [near(r.interest, 8500 * 0.1175 * 20 / 365) && near(r.statutoryRate, 11.75), f(r.interest, 2) + ' at ' + f(r.statutoryRate) + '%']; });
    c('works', 'the Bank of England reference rate, an input defaulting to 3.75%', 'default 3.75, and the input is used', () => { const d = input(P, 'baseRate').default, r = IV({ baseRate: 5 }); return [d === 3.75 && near(r.statutoryRate, 13), 'default ' + d + '; at 5% → ' + f(r.statutoryRate) + '%']; });
    c('worked', 'the full amount is due on Friday 1 Jan 2027, a bank holiday', 'Net 60 lands on Friday 1 January, not moved', () => { const r = IV(); return [r.dueDate === 'Fri, 1 Jan 2027', r.dueDate]; });
    c('worked', 'keeping the cash for the other 46 days', '60 − 14', () => { const r = IV(); return [near(r.effAnnual, 0.015 / 0.985 * 365 / 46 * 100), f(r.effAnnual) + '%']; });
    c('use', 'Get the exact due date for Net 45 or Net 90 terms that cross month ends and year ends.', 'Net 90 from 15 Nov 2026; Net 45 from 30 Dec 2027', () => {
      const a = IV({ invoiceDate: '2026-11-15', terms: '90' }).dueDate, b = IV({ invoiceDate: '2027-12-30', terms: '45' }).dueDate;
      return [a === plusDays('2026-11-15', 90) && b === plusDays('2027-12-30', 45) && /2027/.test(a) && /2028/.test(b), a + '; ' + b];
    });
    c('use', 'Put a figure on the fixed compensation owed on an overdue invoice before writing to the customer.', 'compensation once overdue', () => { const a = IV({ daysLate: 0 }).compensation, b = IV({ daysLate: 1 }).compensation; return [a === 0 && b === 70, a + ' → ' + b]; });
    c('dfaq', 'It is added once per invoice, however late the payment, on top of statutory interest.', 'same fee at 1 and 400 days; total includes it once', () => {
      const a = IV({ daysLate: 1 }), b = IV({ daysLate: 400 });
      return [a.compensation === b.compensation && near(b.totalIfLate, 8500 + b.interest + b.compensation), a.compensation + ' / ' + b.compensation + '; total ' + f(b.totalIfLate, 2)];
    });
    c('dfaq', 'Enter the last day of the invoice’s month as the invoice date and choose Net 30.', '31 Jan 2026 + 30', () => { const d = IV({ invoiceDate: '2026-01-31', terms: '30' }).dueDate; return [d === 'Mon, 2 Mar 2026', d]; });
    c('dfaq', 'The tool calls a discount marginal when passing it up costs 12% a year or less', '11.99% Marginal, 12.01% Yes', () => {
      const a = IV({ terms: '30', discountDays: 10, discount: eff(11.99, 20) }).worthTaking, b = IV({ terms: '30', discountDays: 10, discount: eff(12.01, 20) }).worthTaking;
      return [/^Marginal/.test(a) && /^Yes/.test(b), a + ' | ' + b];
    });
    c('formula', 'effective annual cost = (d / (1 − d)) × (365 / (net − discount days))', 'the formula', () => { const v = IV({ terms: '30', discount: 2, discountDays: 10 }).effAnnual; return [near(v, 0.02 / 0.98 * 365 / 20 * 100), f(v) + '%']; });
    c('tip', 'A 2% discount for paying 20 days early is worth about 37% a year.', '2/10 net 30', () => { const v = IV({ terms: '30', discount: 2, discountDays: 10 }).effAnnual; return [Math.round(v) === 37, f(v) + '%']; });
    c('tip', 'UK businesses can charge statutory interest at 8% above the Bank of England base rate on late commercial payments, plus fixed compensation of £40, £70 or £100 depending on invoice size.', '8% over the rate; £40/£70/£100 by size', () => {
      const fee = (a) => IV({ amount: a, daysLate: 5 }).compensation;
      const v = [500, 999.99, 1000, 9999.99, 10000, 250000].map(fee);
      return [K.j(v) === K.j([40, 40, 70, 70, 100, 100]) && near(IV({ baseRate: 0 }).statutoryRate, 8), 'fees ' + v.join(', ') + '; rate at 0% base ' + f(IV({ baseRate: 0 }).statutoryRate) + '%'];
    });
    c('tip', 'It was 3.75% on 31 December 2025 and on 30 June 2026 (checked October 2026); change it above for an older debt', 'default 3.75; another rate is used when entered', () => { const r = IV({ baseRate: 5.25, daysLate: 10 }); return [input(P, 'baseRate').default === 3.75 && near(r.interest, 8500 * 0.1325 * 10 / 365), f(r.interest, 2)]; });
    c('tip', 'Terms run from the invoice date unless the contract says otherwise.', 'due date counts from the invoice date', () => { const a = IV({ invoiceDate: '2026-03-03', terms: '14' }).dueDate; return [a === 'Tue, 17 Mar 2026', a]; });
    c.m('faq', 'In the UK, the Late Payment of Commercial Debts (Interest) Act 1998 gives businesses a statutory right to interest and fixed compensation', 'statute (legislation.gov.uk); the engine applies the rate and sums it sets, checked above');
    c('ui', 'Bank of England reference rate (3.75% for debts falling due Jul–Dec 2026, checked 4 Oct 2026)', 'default 3.75 applied as 11.75%', () => { const r = K.calc(P, { invoiceDate: '2026-09-01' }); return [input(P, 'baseRate').default === 3.75 && near(r.statutoryRate, 11.75), f(r.statutoryRate) + '%']; });
    c('works', 'due date = invoice date + net days', 'Net 45 from 17 Feb 2027', () => { const d = IV({ invoiceDate: '2027-02-17', terms: '45' }).dueDate; return [d === plusDays('2027-02-17', 45), d]; });
    c('tip', '"Net 30 from end of month" is a materially different arrangement.', 'no end-of-month option among the terms', () => { const o = (input(P, 'terms').options || []).map((x) => x.label); return [!o.some((x) => /month|EOM/i.test(x)), o.join(', ')]; });
    c('dfaq', 'The tool counts from whatever date you give it, so the due date then follows the end-of-month rule.', 'end of Feb 2027 + 30', () => { const d = IV({ invoiceDate: '2027-02-28', terms: '30' }).dueDate; return [d === plusDays('2027-02-28', 30), d]; });
    c.m('tip', 'Almost any business should take it rather than hold the cash.', 'advice; the 37% figure is checked');
    c('ui', 'Days overdue (for interest)', 'days overdue moves only the late-payment figures', () => { const a = IV({ daysLate: 0 }), b = IV({ daysLate: 30 }); return [a.dueDate === b.dueDate && a.effAnnual === b.effAnnual && b.interest > a.interest, f(a.interest, 2) + ' → ' + f(b.interest, 2)]; });
  }

  /* ================================================================ */
  /* Compound interest                                                  */
  /* ================================================================ */
  {
    const P = '/finance/compound-interest/';
    const c = page(P);
    const CI = at(P, { principal: 5000, rate: 4.5, years: 15, freq: '12', contribution: 100 });
    const fv = (P0, r, n, t, pmt) => { const i = r / 100 / n, k = n * t; return i === 0 ? P0 + pmt * k : P0 * Math.pow(1 + i, k) + pmt * (Math.pow(1 + i, k) - 1) / i; };
    c.lc('Calculate how an investment grows with compound interest, including regular contributions.', 'balance with contributions', () => { const r = CI(); return [near(r.total, fv(5000, 4.5, 12, 15, 100), 1e-6), f(r.total, 2)]; });
    c('why', 'Enter a deposit, rate and monthly top-up. See balance and interest.', 'monthly top-up gives balance and interest', () => { const r = CI(); return [has(P, ['total', 'interest']) && near(r.interest, r.total - r.invested), f(r.total, 2) + ', ' + f(r.interest, 2)]; });
    c('why', 'Read the final balance', 'headline is the final balance', () => [primary(P) === 'total', 'primary ' + primary(P)]);
    c('what', 'Each time interest is added, the next period’s interest is worked out on the larger balance', 'year 2 earns more than year 1', () => { const y1 = CI({ freq: '1', contribution: 0, years: 1 }).total, y2 = CI({ freq: '1', contribution: 0, years: 2 }).total; return [y2 - y1 > y1 - 5000, f(y1 - 5000, 2) + ' then ' + f(y2 - y1, 2)]; });
    c('works', 'The balance grows by the periodic rate once per compounding period.', 'quarterly, no contributions', () => { const r = CI({ freq: '4', contribution: 0, years: 3 }); return [near(r.total, 5000 * Math.pow(1 + 0.045 / 4, 12), 1e-6), f(r.total, 2)]; });
    c('works', 'Regular contributions are added at the end of each period, and each one compounds for the periods left after it.', '£100 a year at 10% for 2 years is £210', () => { const r = CI({ principal: 0, rate: 10, years: 2, freq: '1', contribution: 100 }); return [near(r.total, 210, 1e-9), f(r.total, 4)]; });
    c('works', 'A = P × (1 + r ÷ n)ⁿᵗ + PMT × ((1 + r ÷ n)ⁿᵗ − 1) ÷ (r ÷ n)', 'every frequency', () => {
      const rows = ['1', '2', '4', '12', '365'].map((n) => { const v = CI({ freq: n, rate: 6.25, years: 7 }).total; return [near(v, fv(5000, 6.25, +n, 7, 100), 1e-6), n + ': ' + f(v, 2)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('works', 'effective annual rate = (1 + r ÷ n)ⁿ − 1', 'monthly and daily', () => { const a = CI().effectiveRate, b = CI({ freq: '365' }).effectiveRate; return [near(a, (Math.pow(1 + 0.045 / 12, 12) - 1) * 100) && near(b, (Math.pow(1 + 0.045 / 365, 365) - 1) * 100), f(a) + '%, ' + f(b) + '%']; });
    c('works', 'interest = A − (P + PMT × n × t)', 'interest and amount paid in', () => { const r = CI(); return [r.invested === 5000 + 100 * 12 * 15 && near(r.interest, r.total - r.invested), r.invested + '; ' + f(r.interest, 2)]; });
    c('works', 'compounding periods a year: 1, 2, 4, 12 or 365', 'the frequency choices', () => { const v = (input(P, 'freq').options || []).map((o) => String(o.value)); return [K.j(v) === K.j(['1', '2', '4', '12', '365']), v.join(', ')]; });
    c('works', 'the contribution added each period', 'quarterly × £100 over 2 years paid in £800', () => { const r = CI({ principal: 0, freq: '4', years: 2 }); return [r.invested === 800, String(r.invested)]; });
    c('worked', 'more than half as much again as the money paid in', 'interest > half of £23,000', () => { const r = CI(); return [r.interest > r.invested / 2, f(r.interest, 2) + ' of ' + r.invested]; });
    c('mistake', 'The contribution is per period, so “Annually” with £100 means £100 a year', 'annual £100 for 15 years pays in £1,500', () => { const r = CI({ freq: '1' }); return [r.invested === 5000 + 1500, String(r.invested)]; });
    c('mistake', 'as each year’s savings goes in at the year end.', 'annual £1,200 is added at the year end', () => { const r = CI({ freq: '1', contribution: 1200 }); return [near(r.total, fv(5000, 4.5, 1, 15, 1200), 1e-6) && r.total < CI({ contribution: 100 }).total, f(r.total, 2)]; });
    c('mistake', 'entering that with monthly compounding counts the compounding twice; enter it with annual compounding instead.', '4.594% annual vs monthly', () => { const a = CI({ rate: 4.594, freq: '1' }).effectiveRate, b = CI({ rate: 4.594, freq: '12' }).effectiveRate; return [near(a, 4.594, 1e-9) && b > 4.594, f(a) + '% / ' + f(b) + '%']; });
    c('dfaq', 'Run it again with the starting deposit set to 0.', 'deposit and payments add up separately', () => { const a = CI(), b = CI({ principal: 0 }); return [near(a.total - b.total, 5000 * Math.pow(1 + 0.045 / 12, 180), 1e-6), f(b.total, 2)]; });
    c('formula', 'A = P(1 + r/n)^(nt) + PMT · [((1 + r/n)^(nt) − 1) / (r/n)]', 'at 0% too', () => { const a = CI({ rate: 0 }).total, b = CI({ rate: 9.9, freq: '2', years: 40 }).total; return [near(a, 5000 + 100 * 180) && near(b, fv(5000, 9.9, 2, 40, 100), 1e-6), f(a, 2) + ', ' + f(b, 2)]; });
    c('tip', 'More frequent compounding increases returns, but the gain from monthly to daily is small — the rate matters far more than the frequency.', 'monthly → daily vs 5% → 6%', () => {
      const m = CI({ principal: 10000, rate: 5, years: 10, contribution: 0 }).total, d = CI({ principal: 10000, rate: 5, years: 10, contribution: 0, freq: '365' }).total, r6 = CI({ principal: 10000, rate: 6, years: 10, contribution: 0 }).total;
      return [d > m && (d - m) * 20 < r6 - m, 'daily +' + f(d - m, 2) + '; 1 point more +' + f(r6 - m, 2)];
    });
    c('tip', 'The effective annual rate (APY) is the honest comparison figure between accounts with different compounding schedules.', 'higher effective rate grows more', () => {
      const a = CI({ rate: 4.5, freq: '12', years: 1, contribution: 0 }), b = CI({ rate: 4.55, freq: '1', years: 1, contribution: 0 });
      return [(a.effectiveRate > b.effectiveRate) === (a.total > b.total), f(a.effectiveRate) + '% ' + f(a.total, 2) + ' / ' + f(b.effectiveRate) + '% ' + f(b.total, 2)];
    });
    c('tip', 'Contributions are treated as arriving at the end of each period. Contributing at the start of each period yields slightly more.', 'end-of-period annuity', () => {
      const r = CI({ principal: 0 }); const i = 0.045 / 12; const due = 100 * (Math.pow(1 + i, 180) - 1) / i * (1 + i);
      return [near(r.total, 100 * (Math.pow(1 + i, 180) - 1) / i, 1e-6) && due > r.total, f(r.total, 2) + ' vs ' + f(due, 2) + ' at the start'];
    });
    c('faq', 'Compound interest is calculated on the principal plus all previously accumulated interest, so growth accelerates over time.', 'beats simple interest after year 1', () => {
      const s = (t) => CI({ principal: 1000, rate: 10, years: t, freq: '1', contribution: 0 }).total - 1000;
      return [near(s(1), 100) && s(5) > 500 && s(10) - s(9) > s(2) - s(1), 'interest ' + [1, 5, 10].map((t) => f(s(t), 2)).join(', ')];
    });
    c('faq', 'No. The result is a nominal figure.', 'no inflation or tax input', () => [!keys(P).some((k) => /infl|tax/i.test(k)), keys(P).join(', ')]);
    c.m('faq', 'To estimate real purchasing power, subtract your expected inflation rate from the interest rate before calculating.', 'an approximation offered as advice; the tool has no inflation input (checked)');
  }

  /* ================================================================ */
  /* Loan payment                                                       */
  /* ================================================================ */
  {
    const P = '/finance/loan-payment/';
    const c = page(P);
    const LP = at(P, { amount: 18000, rate: 7.9, years: 5 });
    const pmt = (A, r, y) => { const i = r / 1200, n = y * 12; return i === 0 ? A / n : A * i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1); };
    const runDown = (A, r, M, n, extra) => { let b = A, paid = 0; for (let k = 1; k <= n && b > 1e-9; k++) { const int = b * r / 1200; paid += int; b = b + int - M - ((extra && extra[k]) || 0); } return { b, paid }; };
    c.lc('Calculate monthly loan payments, total interest paid, and the full cost of borrowing.', 'payment, interest and total', () => { const r = LP(); return [near(r.monthly, pmt(18000, 7.9, 5)) && near(r.totalPaid, r.monthly * 60) && near(r.totalInterest, r.totalPaid - 18000), f(r.monthly, 2) + ', ' + f(r.totalInterest, 2) + ', ' + f(r.totalPaid, 2)]; });
    c('why', 'Enter amount, rate and term. See the payment and the full cost.', 'inputs and outputs', () => [K.j(keys(P)) === K.j(['amount', 'rate', 'years']) && has(P, ['monthly', 'totalPaid']), keys(P).join(', ')]);
    c('why', 'Compare payment and interest', 'both shown', () => [has(P, ['monthly', 'totalInterest']) && primary(P) === 'monthly', outKeys(P).join(', ')]);
    c('what', 'whatever is left over pays down the debt, so the final payment clears it exactly.', 'balance after the last payment', () => { const r = LP(); const z = runDown(18000, 7.9, r.monthly, 60).b; return [Math.abs(z) < 1e-6, f(z, 9)]; });
    c('what', 'The monthly figure decides affordability; the total paid decides value, and a longer term trades one for the other.', '3, 5 and 7 years', () => { const v = [3, 5, 7].map((y) => LP({ years: y })); return [v[0].monthly > v[1].monthly && v[1].monthly > v[2].monthly && v[0].totalPaid < v[1].totalPaid && v[1].totalPaid < v[2].totalPaid, v.map((x) => f(x.monthly, 2) + '/' + f(x.totalPaid, 2)).join('; ')]; });
    c('works', 'The yearly rate is divided by 12 and the term multiplied by 12.', 'monthly rate, months', () => { const r = LP({ amount: 1000, rate: 12, years: 1 }); return [near(r.monthly, pmt(1000, 12, 1)) && near(r.totalPaid, r.monthly * 12), f(r.monthly, 4)]; });
    c('works', 'at a 0% rate it is simply the loan divided by the months.', '£18,000 over 60 months at 0%', () => { const r = LP({ rate: 0 }); return [r.monthly === 300 && r.totalInterest === 0, f(r.monthly, 2)]; });
    c('works', 'total interest = M × n − P', 'interest', () => { const r = LP({ amount: 250000, rate: 6.5, years: 30 }); return [near(r.totalInterest, r.monthly * 360 - 250000, 1e-6), f(r.totalInterest, 2)]; });
    c('worked', 'In the first month, interest is £18,000 × 0.079 ÷ 12 = £118.50, which leaves £245.61 of that payment to reduce the balance.', '£118.50 and £245.61', () => { const r = LP(); const i = 18000 * 0.079 / 12; return [i.toFixed(2) === '118.50' && (Math.round(r.monthly * 100) / 100 - 118.5).toFixed(2) === '245.61', f(i, 2) + ', ' + f(r.monthly - i, 2)]; });
    c('worked', 'the 60 payments add up to', 'total = 60 × payment', () => { const r = LP(); return [near(r.totalPaid / r.monthly, 60, 1e-9), f(r.totalPaid / r.monthly, 6)]; });
    c.m('mistake', 'Entering the APR in place of the interest rate on the agreement. APR also folds in fees, so it overstates the payment slightly.', 'consumer credit definition of APR; the tool takes the rate entered');
    c('mistake', 'PCP car finance leaves a large final payment that this calculator does not model', 'no balloon input', () => [!keys(P).some((k) => /balloon|final|residual|gfv/i.test(k)), keys(P).join(', ')]);
    c('dfaq', 'with nothing added. Check for an arrangement fee, which this tool does not include.', 'no fee input; no interest at 0%', () => { const r = LP({ rate: 0 }); return [!keys(P).some((k) => /fee/i.test(k)) && r.totalPaid === 18000, keys(P).join(', ') + '; total ' + r.totalPaid]; });
    c('dfaq', 'at a fixed rate and term the payment scales in proportion, so halving the loan halves it.', '£18,000 and £9,000', () => { const a = LP().monthly, b = LP({ amount: 9000 }).monthly; return [near(b * 2, a, 1e-9), f(a, 4) + ' / ' + f(b, 4)]; });
    c('formula', 'M = P · [r(1+r)^n] / [(1+r)^n − 1]', 'three loans', () => {
      const rows = [[250000, 6.5, 30], [18000, 7.9, 5], [5000, 19.9, 2]].map(([A, r, y]) => { const v = LP({ amount: A, rate: r, years: y }).monthly; return [near(v, pmt(A, r, y), 1e-9), f(v, 2)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('tip', 'Shortening the term raises the monthly payment but usually cuts total interest dramatically.', '£250,000: 30 years vs 20', () => { const a = LP({ amount: 250000, rate: 6.5, years: 30 }), b = LP({ amount: 250000, rate: 6.5, years: 20 }); return [b.monthly > a.monthly && b.totalInterest < a.totalInterest * 0.7, f(a.totalInterest, 2) + ' → ' + f(b.totalInterest, 2)]; });
    c('tip', 'This covers principal and interest only. Property tax, insurance, and fees are additional.', 'no tax, insurance or fee input; total = payments', () => [!keys(P).some((k) => /tax|insur|fee/i.test(k)) && near(LP().totalPaid, LP().monthly * 60), keys(P).join(', ')]);
    c('tip', 'Extra payments applied to principal reduce total interest more the earlier they are made.', '£1,000 extra in month 1 vs month 40', () => {
      const M = LP().monthly;
      const a = runDown(18000, 7.9, M, 200, { 1: 1000 }).paid, b = runDown(18000, 7.9, M, 200, { 40: 1000 }).paid, base = runDown(18000, 7.9, M, 60).paid;
      return [base - a > base - b && base - b > 0, 'saved ' + f(base - a, 2) + ' early, ' + f(base - b, 2) + ' later'];
    });
    c('works', 'M = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1)', 'depth formula', () => { const v = LP({ amount: 32000, rate: 5.25, years: 4 }).monthly; return [near(v, pmt(32000, 5.25, 4), 1e-9), f(v, 4)]; });
    c('works', 'r = annual rate ÷ 100 ÷ 12', 'one month at 12% on £1,000 owes £10 interest', () => { const M = LP({ amount: 1000, rate: 12, years: 1 }).monthly; const z = runDown(1000, 12, M, 12).b; return [Math.abs(z) < 1e-6 && near(1000 * 12 / 1200, 10), f(z, 9)]; });
    c('faq', 'Interest is charged on the outstanding balance, which is highest at the start.', 'monthly interest falls every month from month 1', () => {
      const M = LP().monthly; const ints = []; for (let k = 1; k <= 60; k++) ints.push(runDown(18000, 7.9, M, k).paid - (k > 1 ? runDown(18000, 7.9, M, k - 1).paid : 0));
      return [near(ints[0], 118.5, 1e-9) && ints.every((x, i) => i === 0 || x < ints[i - 1]), f(ints[0], 2) + ' … ' + f(ints[59], 2)];
    });
    c('faq', 'As the balance falls, a growing share of each fixed payment goes to principal.', 'principal part rises each month', () => {
      const M = LP().monthly; let b = 18000, prev = -1, ok = true;
      for (let k = 0; k < 60; k++) { const p = M - b * 0.079 / 12; if (p <= prev) ok = false; prev = p; b -= p; }
      return [ok, 'last principal ' + f(prev, 2)];
    });
  }

  /* ================================================================ */
  /* VAT & sales tax                                                    */
  /* ================================================================ */
  {
    const P = '/finance/vat-sales-tax/';
    const c = page(P);
    const VT = at(P, { amount: 1875, rate: 20, mode: 'net' });
    c.lc('Add tax to a net price or extract tax from a gross price — works in both directions.', 'net → gross → net', () => { const g = VT().gross; const back = VT({ amount: g, mode: 'gross' }); return [near(back.net, 1875) && near(back.tax, 375), f(g, 2) + ' → ' + f(back.net, 2)]; });
    c('why', 'Taking 20% off a gross total gives the wrong answer, and the wrong figure on your return.', '540 gross is 450 net, not 432', () => { const r = VT({ amount: 540, mode: 'gross' }); return [near(r.net, 450) && !near(r.net, 432, 0.5), f(r.net, 2)]; });
    c('why', 'Add tax to a net price or pull it out of a gross one, at any rate.', '5%, 17.5% and 8.875% both ways', () => {
      const rows = [5, 17.5, 8.875].map((rt) => { const g = VT({ amount: 100, rate: rt }).gross, n = VT({ amount: g, rate: rt, mode: 'gross' }).net; return [near(g, 100 * (1 + rt / 100)) && near(n, 100), rt + '%: ' + f(g, 4) + ' → ' + f(n, 4)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('why', 'Read net, tax and gross', 'three outputs', () => [has(P, ['net', 'tax', 'gross']), outKeys(P).join(', ')]);
    c('what', 'a price has the tax still to be added (net) or already inside it (gross).', 'the two modes', () => { const v = (input(P, 'mode').options || []).map((o) => o.value); return [K.j(v) === K.j(['net', 'gross']), v.join(', ')]; });
    c('works', 'Adding tax multiplies the net price by one plus the rate. Removing it divides the gross by the same factor, and the tax is the difference.', 'both directions', () => {
      const a = VT({ amount: 80, rate: 8 }), b = VT({ amount: 86.4, rate: 8, mode: 'gross' });
      return [near(a.gross, 86.4) && near(a.tax, a.gross - a.net) && near(b.net, 80) && near(b.tax, 86.4 - b.net), f(a.gross, 2) + ' / ' + f(b.net, 2)];
    });
    c('works', 'At the UK standard rate of 20%, the VAT inside any gross figure is exactly one sixth of it.', 'tax = gross ÷ 6 at the 20% default', () => {
      const rows = [540, 49.99, 1.1, 123456.78].map((g) => { const t = VT({ amount: g, mode: 'gross' }).tax; return [near(t, g / 6, 1e-9), g + ': ' + f(t, 4)]; });
      return [input(P, 'rate').default === 20 && rows.every((x) => x[0]), 'default ' + input(P, 'rate').default + '%; ' + rows.map((x) => x[1]).join('; ')];
    });
    c('works', 'at 20%: VAT = gross ÷ 6 = net ÷ 5', 'net mode', () => { const r = VT({ amount: 417 }); return [near(r.tax, 417 / 5) && near(r.tax, r.gross / 6), f(r.tax, 2)]; });
    c('worked', 'Working backwards from that £2,250 later, the tool returns the £1,875 net figure, and £2,250 ÷ 6 gives the same £375 of VAT.', 'gross mode on £2,250', () => { const r = VT({ amount: 2250, mode: 'gross' }); return [near(r.net, 1875) && near(r.tax, 2250 / 6) && near(r.tax, 375), f(r.net, 2) + ', ' + f(r.tax, 2)]; });
    c('mistake', 'Three items at £1.10 including VAT carry £0.18 each, £0.54 in all', 'rounded per line vs on the total', () => { const a = VT({ amount: 1.1, mode: 'gross' }).tax, b = VT({ amount: 3.3, mode: 'gross' }).tax; return [(3 * Number(a.toFixed(2))).toFixed(2) === '0.54' && b.toFixed(2) === '0.55', f(a, 4) + ' ×3 vs ' + f(b, 4)]; });
    c('mistake', 'Adding VAT to a price that already includes it, which charges the customer the tax twice.', 'Net mode on a gross £540', () => { const r = VT({ amount: 540, mode: 'net' }); return [near(r.gross, 648) && near(r.gross / 1.2 / 1.2, 450), f(r.gross, 2)]; });
    c('mistake', 'Some goods and services are taxed at a lower rate or not at all, so confirm the rate for each line before entering it.', 'the rate box takes 5% and 0%', () => { const a = VT({ amount: 100, rate: 5 }).tax, b = VT({ amount: 100, rate: 0 }).tax; return [near(a, 5) && b === 0, a + ', ' + b]; });
    c('dfaq', 'At 20%, divide the gross by 6 for the VAT, or by 1.2 for the net.', '£49.99', () => { const r = VT({ amount: 49.99, mode: 'gross' }); return [near(r.tax, 49.99 / 6, 1e-9) && near(r.net, 49.99 / 1.2, 1e-9), f(r.tax, 4) + ', ' + f(r.net, 4)]; });
    c('dfaq', 'Yes, for any single rate: enter the combined rate as a percentage and choose Net', '8.875% on $80', () => { const r = VT({ amount: 80, rate: 8.875 }); return [near(r.gross, 87.1), f(r.gross, 2)]; });
    c.m('dfaq', 'Only if your business is VAT-registered, the purchase is for the business, and you hold a valid VAT invoice.', 'VAT law (HMRC); not tool behaviour');
    c('formula', 'gross = net × (1 + rate)  ·  net = gross / (1 + rate)', 'the formula', () => {
      const rows = [[100, 20], [59.95, 7.5], [1e6, 0.5]].map(([a, rt]) => { const g = VT({ amount: a, rate: rt }).gross, n = VT({ amount: a, rate: rt, mode: 'gross' }).net; return [near(g, a * (1 + rt / 100)) && near(n, a / (1 + rt / 100)), f(g, 4) + '/' + f(n, 4)]; });
      return [rows.every((x) => x[0]), rows.map((x) => x[1]).join('; ')];
    });
    c('tip', 'To remove 20% tax you divide by 1.2 — you do not subtract 20%. Subtracting gives the wrong answer.', '£120 gross', () => { const r = VT({ amount: 120, mode: 'gross' }); return [near(r.net, 100) && !near(r.net, 96, 0.01), f(r.net, 2)]; });
    c('tip', 'Switch the mode selector to work backwards from a receipt total.', 'gross mode works back', () => { const r = VT({ amount: 540, mode: 'gross' }); return [near(r.net, 450) && near(r.gross, 540), f(r.net, 2)]; });
    c('works', 'net = gross ÷ (1 + rate ÷ 100)', 'gross mode', () => { const r = VT({ amount: 1234.56, rate: 13.5, mode: 'gross' }); return [near(r.net, 1234.56 / 1.135, 1e-9) && near(r.tax, 1234.56 - r.net, 1e-9), f(r.net, 4)]; });
    c('why', 'Pick net or gross, set the rate', 'mode and rate inputs', () => [keys(P).indexOf('mode') >= 0 && keys(P).indexOf('rate') >= 0, keys(P).join(', ')]);
    c('faq', 'Subtracting 20% of the gross removes too much. Dividing by 1.20 reverses the original operation correctly.', '0.8 × gross < net', () => { const r = VT({ amount: 600, mode: 'gross' }); return [600 * 0.8 < r.net && near(r.net * 1.2, 600), f(r.net, 2) + ' vs ' + 600 * 0.8]; });
  }

  /* ================================================================ */
  /* "How it works" steps in the Why panel that name the form's inputs  */
  /* ================================================================ */
  [
    ['/business/roi/', 'Add return and holding period', ['gain', 'years']],
    ['/business/depreciation/', 'Enter cost, residual and life', ['cost', 'salvage', 'life']],
    ['/business/commission-calculator/', 'Choose flat, threshold, tiered', ['structure']],
    ['/business/invoice-payment-terms/', 'Enter invoice date and amount', ['invoiceDate', 'amount']],
    ['/business/uk-take-home-pay/', 'Set pension and student loan', ['pension', 'student']],
    ['/business/employer-cost/', 'Add pension and overheads', ['pension', 'overheads']],
    ['/business/break-even/', 'Add price and variable cost', ['price', 'variable']],
    ['/business/npv-irr/', 'List the yearly cash flows', ['flows']],
    ['/finance/compound-interest/', 'Add rate, years and top-ups', ['rate', 'years', 'contribution']],
    ['/finance/loan-payment/', 'Add the rate and term', ['rate', 'years']]
  ].forEach(([P, q, ks]) => claim(P, 'why', q, 'the form has ' + ks.join(', '), N, async () => [ks.every((k) => keys(P).indexOf(k) >= 0), keys(P).join(', ')]));
  claim('/business/commission-calculator/', 'why', 'Choose flat, threshold, tiered', 'exactly those three structures', N, async () => {
    const v = (input('/business/commission-calculator/', 'structure').options || []).map((o) => o.value); return [K.j(v) === K.j(['flat', 'threshold', 'tiered']), v.join(', ')];
  });
};
