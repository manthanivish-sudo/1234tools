(function(){
/* ---------- Indian income tax, new and old regimes ----------

   Rates, read against the Finance Act, 2025 and carried unchanged into tax
   year 2026-27 under the Income-tax Act, 2025 (the Finance Act, 2026 changed
   no slab, rebate or deduction limit used here):

   New regime (s.115BAC(1A) of the 1961 Act as amended by the Finance Act,
   2025; the 2025 Act's new-regime section for 2026-27): 0 to ₹4 lakh nil,
   then 5%, 10%, 15%, 20%, 25% in ₹4 lakh steps to ₹24 lakh, 30% above.
   Standard deduction on salary ₹75,000 (s.16(ia) as amended by the Finance
   (No. 2) Act, 2024). Rebate (s.87A, s.156 of the 2025 Act): up to ₹60,000
   where total income is at most ₹12 lakh, and not against tax on
   special-rate income such as capital gains (the Finance Act, 2025 proviso).

   Old regime: ₹2.5 lakh nil (₹3 lakh at 60–79, ₹5 lakh at 80+), 5% to
   ₹5 lakh, 20% to ₹10 lakh, 30% above. Standard deduction ₹50,000. Rebate
   up to ₹12,500 where total income is at most ₹5 lakh; it may be set
   against tax on s.111A gains but not on s.112A gains (s.112A(6)).

   Surcharge (Part I of the First Schedule to each Finance Act): 10% above
   ₹50 lakh, 15% above ₹1 crore, 25% above ₹2 crore, 37% above ₹5 crore in
   the old regime only (the new regime stops at 25%). On capital gains under
   s.111A, s.112 and s.112A the surcharge is capped at 15% (Finance Act,
   2022). Marginal relief at every threshold: the tax and surcharge on an
   income above a threshold may not exceed the tax and surcharge on the
   threshold itself by more than the income above it (the provisos to the
   same Part I).
   Health and education cess: 4% of tax and surcharge.

   Capital gains (Finance (No. 2) Act, 2024, from 23 July 2024): short-term
   gains on listed equity and equity funds (s.111A, s.196 of the 2025 Act)
   20%; long-term gains on them (s.112A, s.198) 12.5% on the gains above
   ₹1.25 lakh a year; other long-term gains (s.112) 12.5% without indexation.
   A resident individual whose other income is below the basic exemption
   limit sets the unused part against these gains (the provisos to s.111A(1)
   and s.112A(2)); it is used against the 20% gains first, as that saves most.

   Old-regime deductions, when itemised: s.80C (s.123) with 80CCC and
   80CCD(1), at most ₹1,50,000 (s.80CCE); s.80D (s.126) health insurance,
   ₹25,000 for yourself and family (₹50,000 if you are 60 or over) and
   ₹25,000 for parents (₹50,000 if they are); s.80CCD(1B) NPS, ₹50,000;
   s.24(b) (s.22 of the 2025 Act) interest on a self-occupied home, ₹2 lakh;
   HRA, the least of the HRA received, rent less 10% of salary, and 50% of
   salary in the listed cities (40% elsewhere) — s.10(13A) with rule 2A for
   FY 2025-26 (Bombay, Calcutta, Delhi, Madras), and rule 279 of the
   Income-tax Rules, 2026 from tax year 2026-27 (those four and Hyderabad,
   Pune, Ahmedabad and Bengaluru).
   Employer's NPS contribution, s.80CCD(2), in both regimes: up to 14% of
   salary (basic and DA) in the new regime, 10% in the old (Finance (No. 2)
   Act, 2024).

   Not modelled: rounding of income and tax to ₹10 (s.288A/288B), other
   special rates (lotteries, s.115BBH crypto), agricultural income, losses
   carried forward, AMT. The page says so. */
const SLABS = {
  new: [{ upto: 400000, rate: 0 }, { upto: 800000, rate: 0.05 }, { upto: 1200000, rate: 0.10 }, { upto: 1600000, rate: 0.15 }, { upto: 2000000, rate: 0.20 }, { upto: 2400000, rate: 0.25 }, { upto: Infinity, rate: 0.30 }],
  old: [{ upto: 250000, rate: 0 }, { upto: 500000, rate: 0.05 }, { upto: 1000000, rate: 0.20 }, { upto: Infinity, rate: 0.30 }]
};
const RULES = {
  new: { sd: 75000, rebateLimit: 1200000, rebateMax: 60000, surcharge: [[5000000, 0], [10000000, 0.10], [20000000, 0.15], [Infinity, 0.25]], npsEmployer: 0.14 },
  old: { sd: 50000, rebateLimit: 500000, rebateMax: 12500, surcharge: [[5000000, 0], [10000000, 0.10], [20000000, 0.15], [50000000, 0.25], [Infinity, 0.37]], npsEmployer: 0.10 }
};
const CESS = 0.04;
const CAP = { c80: 150000, d80: 25000, d80Senior: 50000, homeLoan: 200000, nps1b: 50000, ltcgExempt: 125000 };
const LABEL = { '2026-27': 'FY 2026-27 (tax year 2026-27, Income-tax Act, 2025)', '2025-26': 'FY 2025-26 (AY 2026-27, Income-tax Act, 1961)' };

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
/* the lower edge of the surcharge band an income is in (0 below the first) */
function bandStart(income, table) {
  let prev = 0;
  for (const [upto] of table) { if (income <= upto) return prev; prev = upto; }
  return prev;
}
const fmtR = (v) => isFinite(v)
  ? v.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
  : '—';

/* Tax on one regime: normal income and special-rate gains, everything
   after deductions. Returns each step, so the page can show its working. */
function taxOn(regime, normal, gains, age, noRelief) {
  const R = RULES[regime];
  let slabs = SLABS[regime];
  let exemptLimit = slabs[0].upto;
  if (regime === 'old' && age !== 'below60') {
    exemptLimit = age === 'super' ? 500000 : 300000;
    slabs = slabs.map((s) => ({ upto: s.upto, rate: s.rate }));
    slabs[0] = { upto: exemptLimit, rate: 0 };
    if (slabs[1].upto <= exemptLimit) slabs.splice(1, 1);
  }
  const total = normal + gains.stcg + gains.ltcgEq + gains.ltcgOther;
  /* unused basic exemption against the gains: 20% gains first */
  let unused = Math.max(0, exemptLimit - normal);
  const take = (x) => { const t = Math.min(unused, x); unused -= t; return x - t; };
  const stcgT = take(gains.stcg);
  const eqAbove = Math.max(0, gains.ltcgEq - CAP.ltcgExempt);
  const ltcgEqT = take(eqAbove);
  const ltcgOtherT = take(gains.ltcgOther);
  const slab = slabTax(normal, slabs);
  const stcgTax = stcgT * 0.20, ltcgTax = ltcgEqT * 0.125 + ltcgOtherT * 0.125;
  const special = stcgTax + ltcgTax;

  let rebate = 0, relief = 0;
  if (total <= R.rebateLimit) rebate = Math.min(regime === 'new' ? slab : slab + stcgTax, R.rebateMax);
  /* Marginal relief on the rebate (new regime): just above ₹12 lakh the
     extra tax cannot exceed the extra income, which is what stops a ₹1 raise
     creating a ₹60,000 bill. */
  let normalTax = slab - Math.min(rebate, slab);
  const fromSpecial = rebate - Math.min(rebate, slab);
  if (regime === 'new' && total > R.rebateLimit) {
    const excess = total - R.rebateLimit;
    if (normalTax > excess) { relief = normalTax - excess; normalTax = excess; }
  }
  const specialAfter = special - fromSpecial;
  const tax = normalTax + specialAfter;
  const rate = surchargeRate(total, R.surcharge);
  const surcharge = normalTax * rate + specialAfter * Math.min(rate, 0.15);
  /* marginal relief on the surcharge, at whichever threshold was crossed */
  let surRelief = 0;
  if (rate > 0 && !noRelief) {
    const T = bandStart(total, R.surcharge);
    let cut = total - T;
    const n2 = Math.max(0, normal - cut); cut -= normal - n2;
    const g2 = { stcg: gains.stcg, ltcgEq: gains.ltcgEq, ltcgOther: gains.ltcgOther };
    ['ltcgOther', 'ltcgEq', 'stcg'].forEach((k) => { const t = Math.min(cut, g2[k]); g2[k] -= t; cut -= t; });
    const atT = taxOn(regime, n2, g2, age, false);
    const cap = atT.tax + atT.surcharge - atT.surRelief + (total - T);
    if (tax + surcharge > cap) surRelief = Math.min(surcharge, tax + surcharge - cap);
  }
  const cess = (tax + surcharge - surRelief) * CESS;
  const out = tax + surcharge - surRelief + cess;
  return { normal, total, slab, stcgTax, ltcgTax, special, rebate, relief, tax, rate, surcharge, surRelief, cess, totalTax: out, exemptLimit };
}

window.TOOLS = window.TOOLS || {};
window.TOOLS["india-income-tax"] = {
"currencyLocked": true,
"currencyNote": "Indian income-tax rules",
"currency": "INR",
"title": "Income Tax Calculator (New vs Old Regime)",
"category": "india",
"description": "Compare tax under both regimes for FY 2026-27, including rebate, surcharge, cess and marginal relief.",
"keywords": ["income tax calculator India","new tax regime","old tax regime","income tax slab","87A rebate","tax calculator FY 2026-27"],
"formula": "tax = slab tax − 87A rebate + surcharge + 4% cess",
"inputs": [{"key":"gross","label":"Gross annual income","type":"number","unit":"₹","default":1500000,"min":0,"hint":"Salary and other income taxed at slab rates, before any deduction. Capital gains go further down."},{"key":"fy","label":"Financial year","type":"select","options":[{"value":"2026-27","label":LABEL['2026-27']},{"value":"2025-26","label":LABEL['2025-26']}],"default":"2026-27"},{"key":"type","label":"Taxpayer","type":"select","options":[{"value":"salaried","label":"Salaried / pensioner"},{"value":"other","label":"Self-employed / other"}],"default":"salaried"},{"key":"age","label":"Age (old regime only)","type":"select","options":[{"value":"below60","label":"Below 60"},{"value":"senior","label":"Senior (60–79)"},{"value":"super","label":"Super senior (80+)"}],"default":"below60"},
  {"key":"dedMode","label":"Old-regime deductions","type":"select","options":[{"value":"total","label":"One total"},{"value":"itemise","label":"Itemise them (limits applied)"}],"default":"total"},
  {"key":"deductions","label":"Old-regime deductions (80C, 80D, HRA…)","type":"number","unit":"₹","default":200000,"min":0,"showIf":{"key":"dedMode","is":"total"}},
  {"key":"c80","label":"80C: EPF, PPF, ELSS, life cover, home-loan principal","type":"number","unit":"₹","default":0,"min":0,"showIf":{"key":"dedMode","is":"itemise"},"hint":"Capped at ₹1,50,000 with 80CCC and 80CCD(1)."},
  {"key":"d80self","label":"80D: health insurance for you and family","type":"number","unit":"₹","default":0,"min":0,"showIf":{"key":"dedMode","is":"itemise"}},
  {"key":"d80parents","label":"80D: health insurance for parents","type":"number","unit":"₹","default":0,"min":0,"showIf":{"key":"dedMode","is":"itemise"}},
  {"key":"parentsSenior","label":"Parents are 60 or over","type":"select","options":[{"value":"no","label":"No"},{"value":"yes","label":"Yes"}],"default":"no","showIf":{"key":"dedMode","is":"itemise"}},
  {"key":"homeLoan","label":"Home-loan interest, self-occupied (24(b))","type":"number","unit":"₹","default":0,"min":0,"showIf":{"key":"dedMode","is":"itemise"}},
  {"key":"nps1b","label":"80CCD(1B): your own extra NPS","type":"number","unit":"₹","default":0,"min":0,"showIf":{"key":"dedMode","is":"itemise"}},
  {"key":"otherDed","label":"Other deductions (80E, 80G, 80TTA…)","type":"number","unit":"₹","default":0,"min":0,"showIf":{"key":"dedMode","is":"itemise"}},
  {"key":"basic","label":"Basic salary + DA (a year)","type":"number","unit":"₹","default":0,"min":0,"group":"Salary breakup: HRA and employer NPS","hint":"Needed for the HRA tests and the employer NPS limit."},
  {"key":"hraRecv","label":"HRA received (a year)","type":"number","unit":"₹","default":0,"min":0,"group":"Salary breakup: HRA and employer NPS"},
  {"key":"rent","label":"Rent paid (a year)","type":"number","unit":"₹","default":0,"min":0,"group":"Salary breakup: HRA and employer NPS"},
  {"key":"city","label":"City","type":"select","options":[{"value":"metro","label":"Delhi, Mumbai, Kolkata or Chennai"},{"value":"metro8","label":"Bengaluru, Hyderabad, Pune or Ahmedabad"},{"value":"non","label":"Anywhere else"}],"default":"non","group":"Salary breakup: HRA and employer NPS"},
  {"key":"employerNps","label":"Employer’s NPS contribution, 80CCD(2)","type":"number","unit":"₹","default":0,"min":0,"group":"Salary breakup: HRA and employer NPS","hint":"Part of your salary: include it in the gross income too."},
  {"key":"stcg","label":"Short-term gains on listed shares and equity funds (111A)","type":"number","unit":"₹","default":0,"min":0,"group":"Capital gains (special rates)"},
  {"key":"ltcgEq","label":"Long-term gains on listed shares and equity funds (112A)","type":"number","unit":"₹","default":0,"min":0,"group":"Capital gains (special rates)"},
  {"key":"ltcgOther","label":"Other long-term gains: property, gold, unlisted (112)","type":"number","unit":"₹","default":0,"min":0,"group":"Capital gains (special rates)"},
  {"key":"tdsPaid","label":"TDS and TCS already deducted","type":"number","unit":"₹","default":0,"min":0,"group":"Tax already paid"},
  {"key":"advancePaid","label":"Advance and self-assessment tax paid","type":"number","unit":"₹","default":0,"min":0,"group":"Tax already paid"}],
"compute": (v) => {
      const { gross, fy, type, age } = v;
      const g = Math.max(0, Number(gross) || 0);
      const salaried = type === 'salaried';
      const num = (k) => Math.max(0, Number(v[k]) || 0);
      const gains = { stcg: num('stcg'), ltcgEq: num('ltcgEq'), ltcgOther: num('ltcgOther') };
      const basic = num('basic');

      /* HRA, the least of three tests (old regime, salaried only) */
      const fifty = v.city === 'metro' || (v.city === 'metro8' && fy !== '2025-26');
      const h1 = num('hraRecv'), h2 = Math.max(0, num('rent') - 0.10 * basic), h3 = basic * (fifty ? 0.5 : 0.4);
      const hraExempt = salaried ? Math.min(h1, h2, h3) : 0;

      /* old-regime deductions: one total, or itemised with the limits */
      let oldDed, items = null;
      if (v.dedMode === 'itemise') {
        const selfSenior = age === 'senior' || age === 'super';
        items = {
          c80: Math.min(num('c80'), CAP.c80),
          d80: Math.min(num('d80self'), selfSenior ? CAP.d80Senior : CAP.d80) + Math.min(num('d80parents'), v.parentsSenior === 'yes' ? CAP.d80Senior : CAP.d80),
          homeLoan: Math.min(num('homeLoan'), CAP.homeLoan),
          nps1b: Math.min(num('nps1b'), CAP.nps1b),
          other: num('otherDed'),
          hra: hraExempt
        };
        oldDed = items.c80 + items.d80 + items.homeLoan + items.nps1b + items.other + items.hra;
      } else oldDed = Number(v.deductions) || 0;
      const npsCap = (regime) => Math.min(num('employerNps'), basic * RULES[regime].npsEmployer);
      const npsNew = salaried ? npsCap('new') : 0, npsOld = salaried ? npsCap('old') : 0;

      const run = (regime) => {
        const sd = salaried ? RULES[regime].sd : 0;
        const ded = regime === 'old' ? oldDed + npsOld : npsNew;
        const normal = Math.max(0, g - sd - ded);
        const t = taxOn(regime, normal, gains, regime === 'old' ? age : 'below60');
        const income = g + gains.stcg + gains.ltcgEq + gains.ltcgOther;
        return Object.assign(t, { sd, ded, net: income - t.totalTax, effective: income ? (t.totalTax / income) * 100 : 0 });
      };
      const n = run('new'), o = run('old');
      const better = n.totalTax <= o.totalTax ? 'new' : 'old';
      const paid = num('tdsPaid') + num('advancePaid');
      const anyGains = gains.stcg + gains.ltcgEq + gains.ltcgOther > 0;
      const reb = fy === '2025-26' ? 'Section 87A rebate' : 'Rebate (s.156, formerly 87A)';

      const rows = [
        ['Standard deduction', n.sd, o.sd],
        [v.dedMode === 'itemise' ? 'Deductions (limits applied)' : 'Other deductions', n.ded, o.ded],
        ['Taxable income', n.normal, o.normal]
      ];
      if (items) {
        rows.splice(2, 0,
          ['   of which 80C', 0, items.c80], ['   of which 80D', 0, items.d80], ['   of which HRA exemption', 0, items.hra],
          ['   of which home-loan interest', 0, items.homeLoan], ['   of which 80CCD(1B)', 0, items.nps1b], ['   of which other', 0, items.other]);
      }
      if (npsNew || npsOld) rows.splice(rows.length - 1, 0, ['   of which employer NPS, 80CCD(2)', npsNew, npsOld]);
      if (anyGains) rows.push(['Capital gains at special rates', gains.stcg + gains.ltcgEq + gains.ltcgOther, gains.stcg + gains.ltcgEq + gains.ltcgOther], ['Tax at slab rates', n.slab, o.slab], ['Tax on capital gains', n.special, o.special]);
      rows.push(['Tax before rebate', n.slab + n.special, o.slab + o.special], [reb, n.rebate, o.rebate], ['Marginal relief', n.relief, o.relief],
        ['Surcharge', n.surcharge, o.surcharge], ['Marginal relief on surcharge', n.surRelief, o.surRelief],
        ['Health & education cess (4%)', n.cess, o.cess], ['Total tax payable', n.totalTax, o.totalTax], ['Income after tax', n.net, o.net]);
      if (paid > 0) rows.push(['Tax already paid', paid, paid], ['Balance payable (refund if negative)', n.totalTax - paid, o.totalTax - paid]);
      /* the rows before this change were text; the figures are the same */
      const out = {
        newTotal: n.totalTax, oldTotal: o.totalTax,
        saving: Math.abs(n.totalTax - o.totalTax),
        better: better === 'new'
          ? `New regime — saves ${fmtR(o.totalTax - n.totalTax)}`
          : `Old regime — saves ${fmtR(n.totalTax - o.totalTax)}`,
        newTaxable: n.normal, oldTaxable: o.normal,
        newRebate: n.rebate, newRelief: n.relief,
        newCess: n.cess, newSurcharge: n.surcharge,
        newNet: n.net, newEffective: n.effective, oldEffective: o.effective,
        _table: { title: 'Computation, ' + (LABEL[fy] || LABEL['2026-27']), head: ['', 'New regime', 'Old regime'], cols: ['text', 'currency', 'currency'], rows }
      };
      if (n.surRelief || o.surRelief) { out.newSurRelief = n.surRelief; out.oldSurRelief = o.surRelief; }
      if (v.dedMode === 'itemise' || hraExempt > 0) { out.oldDeductions = o.ded; out.hraExempt = hraExempt; }
      if (anyGains) { out.newGainsTax = n.special; out.oldGainsTax = o.special; }
      if (paid > 0) { out.paid = paid; out.dueNew = n.totalTax - paid; out.dueOld = o.totalTax - paid; }
      out._chart = { type: 'bar', stacked: false, title: 'Tax under each regime', format: 'currency', labels: ['New regime', 'Old regime'],
        series: [{ name: 'Tax and surcharge', values: [n.tax + n.surcharge - n.surRelief, o.tax + o.surcharge - o.surRelief] }, { name: 'Cess', values: [n.cess, o.cess], c: 3 }] };
      return out;
    },
"outputs": [{"key":"better","label":"Better regime","format":"text","primary":true},{"key":"newTotal","label":"Tax — new regime","format":"currency"},{"key":"oldTotal","label":"Tax — old regime","format":"currency"},{"key":"saving","label":"Difference","format":"currency"},{"key":"newTaxable","label":"Taxable income (new)","format":"currency"},{"key":"newRebate","label":"87A rebate applied","format":"currency"},{"key":"newRelief","label":"Marginal relief applied","format":"currency"},{"key":"newSurRelief","label":"Marginal relief on surcharge (new)","format":"currency"},{"key":"oldSurRelief","label":"Marginal relief on surcharge (old)","format":"currency"},{"key":"oldDeductions","label":"Old-regime deductions allowed","format":"currency"},{"key":"hraExempt","label":"HRA exemption (old regime)","format":"currency"},{"key":"newGainsTax","label":"Tax on capital gains (new)","format":"currency"},{"key":"oldGainsTax","label":"Tax on capital gains (old)","format":"currency"},{"key":"newEffective","label":"Effective rate (new)","format":"percent"},{"key":"oldEffective","label":"Effective rate (old)","format":"percent"},{"key":"newNet","label":"Income after tax (new)","format":"currency"},{"key":"paid","label":"Tax already paid","format":"currency"},{"key":"dueNew","label":"Balance payable, new regime (refund if negative)","format":"currency"},{"key":"dueOld","label":"Balance payable, old regime (refund if negative)","format":"currency"}],
"steps": (v, r, f) => {
      const t = r._table.rows;
      const get = (label, col) => { const row = t.find((x) => x[0] === label); return row ? row[col] : 0; };
      const S = [];
      [['New regime', 1], ['Old regime', 2]].forEach(([name, c]) => {
        const dedRow = t.find((x) => /deductions/i.test(x[0]) && x[0][0] !== ' ');
        S.push(name + ': taxable income ' + f.money(get('Taxable income', c)) + ' after a standard deduction of ' + f.money(get('Standard deduction', c)) + ' and deductions of ' + f.money(dedRow ? dedRow[c] : 0) + '.');
        S.push(name + ': tax ' + f.money(get('Tax before rebate', c)) + ', less a rebate of ' + f.money((t.find((x) => /^(Section 87A rebate|Rebate \(s\.156)/.test(x[0])) || [0, 0, 0])[c]) + ' and marginal relief of ' + f.money(get('Marginal relief', c)) + ', plus surcharge ' + f.money(get('Surcharge', c) - get('Marginal relief on surcharge', c)) + ' and cess ' + f.money(get('Health & education cess (4%)', c)) + ' = ' + f.money(get('Total tax payable', c)) + '.');
      });
      return S;
    },
"report": (v, r) => ({
      title: 'Income tax computation',
      subtitle: (LABEL[v.fy] || LABEL['2026-27']) + ' — worked out on 1234tools.com from the figures entered. Not an official computation.',
      columns: ['', 'New regime', 'Old regime'],
      rows: r._table.rows,
      cols: r._table.cols,
      notes: ['Result: ' + r.better + '.', 'Rates: Finance Act, 2025, carried into the Income-tax Act, 2025 for tax year 2026-27. Rounding to ₹10 (s.288A/288B) is not applied.']
    }),
"tips": ["The new regime is the default. You must actively opt for the old one, and salaried taxpayers can switch each year while business income generally cannot.","Under the new regime, taxable income up to ₹12 lakh attracts no tax because of the ₹60,000 rebate — section 156 of the Income-tax Act, 2025, formerly section 87A. With the ₹75,000 standard deduction, a salary up to ₹12.75 lakh is effectively tax-free.","From tax year 2026-27 the Income-tax Act, 2025 replaces the 1961 Act and renumbers its sections: 80C is now section 123, 80D section 126, 87A section 156, 111A section 196 and 112A section 198. The rates and limits used here did not change, and the familiar old numbers are kept as names.","The rebate does not apply to special-rate income such as capital gains under sections 196 and 198 of the 2025 Act (formerly 111A and 112A), so those remain taxable even below ₹12 lakh.","Marginal relief stops a small rise above ₹12 lakh producing a disproportionate jump in tax. This calculator applies it, and the same relief at each surcharge threshold: ₹50 lakh, ₹1 crore, ₹2 crore and ₹5 crore.","The old regime only wins when your deductions are large. For a salaried taxpayer under 60 it takes about ₹5.5 lakh of 80C, 80D, HRA and home-loan interest combined on a ₹15 lakh salary, and about ₹7 lakh on ₹20 lakh.","Choose “Itemise them” to enter 80C, 80D, home-loan interest, NPS and HRA separately: each limit is applied for you, and HRA is worked out from your basic pay, rent and city.","Download the computation as a PDF to keep with your return papers or to check against your employer’s Form 16."],
"faq": [{"q":"Which regime should I choose?","a":"Enter your actual deductions above and compare. As a rough guide, the new regime wins for most people with modest deductions, while the old regime can still win for those with a home loan, substantial HRA and full 80C use. Run your own numbers rather than following a rule of thumb."},{"q":"Is this an official calculation?","a":"No. It applies the published slab structure and common reliefs, but ignores many situation-specific provisions. The Income Tax Department publishes its own calculator, and for anything consequential you should confirm with a chartered accountant."},{"q":"How are capital gains taxed here?","a":"At their own rates, outside the slabs: 20% on short-term gains from listed shares and equity funds, 12.5% on long-term gains from them above ₹1.25 lakh, and 12.5% on other long-term gains. Surcharge on them stops at 15%, the rebate does not reduce them, and any unused basic exemption is set against them first."}]
};
})();
