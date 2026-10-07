(function(){
/* Compound interest with regular contributions.

   Interest is compounded n times a year at r ÷ n. Contributions can come
   at their own frequency m (monthly saving into an account that compounds
   daily, say); each contribution period then earns the equivalent rate
   (1 + r ÷ n)^(n ÷ m) − 1, which is the rate that gives exactly the same
   growth over a year as the compounding does. This is the convention
   savings calculators and the FCA's own illustrations use; a bank that
   credits interest only on its compounding dates pays a few pence less on
   money paid in between them.

   Contributions are whole payments: over 1.5 years, monthly, that is 18 of
   them. "At the start" (an annuity due) gives each one an extra period of
   growth. Inflation, when given, turns the final balance into today's
   money by dividing by (1 + inflation)^years. */
const FREQS = { 1: 'yearly', 2: 'half-yearly', 4: 'quarterly', 12: 'monthly', 365: 'daily' };

/* growth factor of one unit over t years */
function growth(i, n, t) { return Math.pow(1 + i, n * t); }
/* value at time T of contributions of 1 made at m a year, the first at
   1/m (end) or at 0 (start), counting only those made by T (end: at or
   before T; start: before T, as a payment at T belongs to the next period) */
function contribValue(ic, m, T, start, cap) {
  const mt = m * T;
  let c = start ? Math.ceil(mt - 1e-9) : Math.floor(mt + 1e-9);
  if (cap !== undefined) c = Math.min(c, cap);
  if (c <= 0) return { v: 0, c: 0 };
  if (ic === 0) return { v: c, c };
  const lead = start ? mt - c + 1 : mt - c;
  return { v: Math.pow(1 + ic, lead) * (Math.pow(1 + ic, c) - 1) / ic, c };
}

window.TOOLS = window.TOOLS || {};
window.TOOLS["compound-interest"] = {
"currency": "GBP",
"title": "Compound Interest Calculator",
"category": "finance",
"icon": "📈",
"description": "Calculate how an investment grows with compound interest, including regular contributions.",
"keywords": ["compound interest","investment growth","savings calculator","future value"],
"formula": "A = P(1 + r/n)^(nt) + PMT · [((1 + r/n)^(nt) − 1) / (r/n)]",
"inputs": [{"key":"principal","label":"Initial Principal","type":"number","unit":"£","default":10000,"min":0},{"key":"rate","label":"Annual Interest Rate","type":"number","unit":"%","default":7,"step":0.01,"slider":[0,20],"min":0,"max":100},{"key":"years","label":"Time Period","type":"number","unit":"years","default":10,"min":0,"max":100,"slider":{"min":1,"max":50,"step":1}},{"key":"freq","label":"Compounding Frequency","type":"select","options":[{"value":1,"label":"Annually"},{"value":2,"label":"Semi-annually"},{"value":4,"label":"Quarterly"},{"value":12,"label":"Monthly"},{"value":365,"label":"Daily"}],"default":12},{"key":"contribution","label":"Additional Contribution per Period","type":"number","unit":"£","default":0,"min":0},{"key":"contribFreq","label":"Contributions are paid","type":"select","options":[{"value":"period","label":"Every compounding period"},{"value":"12","label":"Monthly"},{"value":"4","label":"Quarterly"},{"value":"2","label":"Every six months"},{"value":"1","label":"Yearly"},{"value":"52","label":"Weekly"}],"default":"period"},{"key":"timing","label":"Each contribution goes in","type":"select","options":[{"value":"end","label":"At the end of the period"},{"value":"start","label":"At the start of the period"}],"default":"end"},{"key":"inflation","label":"Inflation (optional)","type":"number","unit":"%","default":0,"min":0,"max":50,"step":0.1,"hint":"Shows the final balance in today’s money as well."}],
"compute": ({ principal, rate, years, freq, contribution, contribFreq, timing, inflation }) => {
      const P = Number(principal) || 0;
      const r = (Number(rate) || 0) / 100;
      const n = Number(freq) || 12;
      const T = Math.max(0, Number(years) || 0);
      const C = Number(contribution) || 0;
      const m = contribFreq === undefined || contribFreq === null || contribFreq === 'period' ? n : Number(contribFreq);
      const start = timing === 'start';
      const i = r / n;
      /* the rate for one contribution period, equivalent to the compounding */
      const ic = m === n ? i : Math.pow(1 + i, n / m) - 1;
      const N = Math.floor(m * T + 1e-9);                   // whole contributions

      const fromPrincipal = P * growth(i, n, T);
      const cv = contribValue(ic, m, T, start, N);
      const fromContributions = C * cv.v;
      const total = fromPrincipal + fromContributions;
      const invested = P + C * N;
      const infl = (Number(inflation) || 0) / 100;

      /* the year-by-year and month-by-month balance, from the same closed
         form at each date (so the last row is the headline exactly) */
      const at = (t) => P * growth(i, n, t) + C * contribValue(ic, m, t, start, N).v;
      const paidBy = (t) => P + C * contribValue(0, m, t, start, N).c;
      const yearly = [], labels = [0], bal = [P], paid = [P], real = [P];
      let prevB = P, prevPaid = P;
      const whole = Math.floor(T + 1e-9);
      const stops = []; for (let y = 1; y <= whole; y++) stops.push(y);
      if (T - whole > 1e-9) stops.push(T);
      stops.forEach((t) => {
        const b = t === T ? total : at(t);
        const p = t === T ? invested : paidBy(t);
        yearly.push([Number(t.toFixed(4)), p - prevPaid, (b - prevB) - (p - prevPaid), b]);
        labels.push(Number(t.toFixed(2))); bal.push(b); paid.push(p); real.push(b / Math.pow(1 + infl, t));
        prevB = b; prevPaid = p;
      });
      const views = [{ id: 'yearly', label: 'Yearly', head: ['Year', 'Paid in', 'Interest', 'Balance'], cols: ['text', 'currency', 'currency', 'currency'], rows: yearly,
        foot: ['Total', invested - P, total - invested, total] }];
      /* months line up with the payments only when they come monthly or
         less often, in whole months; daily and weekly are shown by year */
      const monthsFit = (x) => [1, 2, 4, 12].indexOf(x) >= 0;
      if (monthsFit(m) && (n === 12 || n === 365) && T * 12 <= 1200) {
        const rows = []; let pb = P, pp = P;
        const months = Math.round(T * 12);
        if (Math.abs(months - T * 12) < 1e-9) {
          for (let k = 1; k <= months; k++) {
            const t = k / 12;
            const b = k === months ? total : at(t), p = k === months ? invested : paidBy(t);
            rows.push([k, p - pp, (b - pb) - (p - pp), b]);
            pb = b; pp = p;
          }
          views.push({ id: 'monthly', label: 'Monthly', head: ['Month', 'Paid in', 'Interest', 'Balance'], cols: ['int', 'currency', 'currency', 'currency'], rows, foot: ['Total', invested - P, total - invested, total] });
        }
      }

      const out = {
        total,
        interest: total - invested,
        invested,
        effectiveRate: (Math.pow(1 + i, n) - 1) * 100,
        _table: yearly.length ? { title: 'Balance by year', head: views[0].head, cols: views[0].cols, rows: yearly, foot: views[0].foot, views } : null,
        _chart: yearly.length ? [
          { type: 'line', title: 'Balance over time', format: 'currency', xLabel: 'Year', labels,
            series: [{ name: 'Balance', values: bal, area: true }, { name: 'Paid in', values: paid, c: 1 }].concat(infl > 0 ? [{ name: 'Balance in today’s money', values: real, c: 2, dashed: true }] : []) },
          { type: 'donut', title: 'What the balance is made of', format: 'currency', center: { label: 'Balance', value: total },
            slices: [{ name: 'Starting deposit', value: P }, { name: 'Contributions', value: C * N, c: 1 }, { name: 'Interest', value: Math.max(0, total - invested), c: 3 }] }
        ] : null
      };
      if (infl > 0) {
        out.realTotal = total / Math.pow(1 + infl, T);
        out.realInterest = out.realTotal - invested;
      }
      return out;
    },
"outputs": [{"key":"total","label":"Final Balance","format":"currency","primary":true},{"key":"interest","label":"Total Interest Earned","format":"currency"},{"key":"invested","label":"Total Amount Invested","format":"currency"},{"key":"effectiveRate","label":"Effective Annual Rate","format":"percent"},{"key":"realTotal","label":"Final balance in today’s money","format":"currency"},{"key":"realInterest","label":"Real gain after inflation","format":"currency"}],
"filled": (v, r, f) => {
      const n = Number(v.freq) || 12, P = Number(v.principal) || 0, C = Number(v.contribution) || 0, T = Number(v.years) || 0;
      const m = v.contribFreq === 'period' || !v.contribFreq ? n : Number(v.contribFreq);
      const i = (Number(v.rate) || 0) / 100 / n;
      const ic = m === n ? i : Math.pow(1 + i, n / m) - 1;
      const N = Math.floor(m * T + 1e-9);
      const g = Math.pow(1 + i, n * T);
      const L = [];
      L.push('r ÷ n = ' + f.upto(Number(v.rate) || 0, 4) + '% ÷ ' + n + ' = ' + f.upto(i, 8));
      L.push('(1 + r ÷ n)^(n × t) = (1 + ' + f.upto(i, 8) + ')^(' + n + ' × ' + f.upto(T, 4) + ') = ' + f.upto(g, 6));
      L.push('from the deposit: ' + f.money(P) + ' × ' + f.upto(g, 6) + ' = ' + f.money(P * g));
      if (C) {
        if (m !== n) L.push('rate per contribution period = (1 + ' + f.upto(i, 8) + ')^(' + n + ' ÷ ' + m + ') − 1 = ' + f.upto(ic, 8));
        const base = ic === 0 ? N : (Math.pow(1 + ic, N) - 1) / ic;
        const due = v.timing === 'start' ? (ic === 0 ? '' : ' × (1 + ' + f.upto(ic, 8) + ')') : '';
        L.push('from contributions: ' + f.money(C) + ' × ' + (ic === 0 ? N : '((1 + ' + f.upto(ic, 8) + ')^' + N + ' − 1) ÷ ' + f.upto(ic, 8)) + due + ' = ' + f.money(r.total - P * g));
        void base;
      }
      L.push('A = ' + f.money(P * g) + (C ? ' + ' + f.money(r.total - P * g) : '') + ' = ' + f.money(r.total));
      if (r.realTotal !== undefined) L.push('in today’s money: ' + f.money(r.total) + ' ÷ (1 + ' + f.upto(Number(v.inflation), 4) + '%)^' + f.upto(T, 4) + ' = ' + f.money(r.realTotal));
      return L;
    },
"tips": ["More frequent compounding increases returns, but the gain from monthly to daily is small — the rate matters far more than the frequency.","The effective annual rate (APY) is the honest comparison figure between accounts with different compounding schedules.","Contributions are treated as arriving at the end of each period unless you choose the start. Contributing at the start of each period yields slightly more.","Contributions can come on their own schedule: monthly saving into an account that compounds daily or yearly earns the equivalent rate for each month.","Give an inflation rate to see the final balance in today’s money as well as the figure on the statement."],
"faq": [{"q":"What is the difference between simple and compound interest?","a":"Simple interest is calculated only on the original principal. Compound interest is calculated on the principal plus all previously accumulated interest, so growth accelerates over time."},{"q":"Does this account for inflation or tax?","a":"Inflation, yes, if you enter a rate: the final balance is also shown in today’s money. Tax, no: interest above your personal savings allowance or outside an ISA may be taxed, and the figures here are before any tax."}]
};
})();
