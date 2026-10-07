(function(){
window.TOOLS = window.TOOLS || {};
/* a schedule cell: the number itself; the page formats it with the reader's currency, grouping and decimals */
const cell = (v) => v;

window.TOOLS["npv-irr"] = {
"currency": "GBP",
"title": "NPV & IRR Calculator (Discounted Cash Flow)",
"category": "business",
"description": "Value a project with net present value, internal rate of return and discounted payback.",
"keywords": ["NPV calculator","IRR calculator","discounted cash flow","net present value","internal rate of return","DCF"],
"formula": "NPV = Σ CFₜ / (1 + r)ᵗ − initial investment",
"inputs": [{"key":"initial","label":"Initial investment","type":"number","unit":"£","default":100000,"min":0},{"key":"flows","label":"Cash flows per period (comma separated)","type":"text","default":"30000, 35000, 40000, 45000, 50000"},{"key":"rate","label":"Discount rate (cost of capital)","type":"number","unit":"%","default":10,"step":0.1,"min":0,"max":100}],
"compute": ({ initial, flows, rate }) => {
      /* Empty tokens (a leading space, a trailing comma) are not zero flows:
         a phantom 0 in front would push every real flow a period later. */
      const cf = String(flows == null ? '' : flows).split(/[\s,;]+/).filter(t => t !== '').map(Number).filter(n => isFinite(n));
      if (!cf.length) return { note: 'Enter at least one cash flow.' };
      const r = rate / 100;

      const npvAt = (d) => cf.reduce((s, c, i) => s + c / Math.pow(1 + d, i + 1), 0) - initial;
      const npv = npvAt(r);

      // IRR by bisection — robust where Newton diverges on sign-flipping flows
      let irr = NaN;
      let lo = -0.9999, hi = 10;
      if (npvAt(lo) * npvAt(hi) < 0) {
        for (let i = 0; i < 200; i++) {
          const mid = (lo + hi) / 2;
          if (npvAt(lo) * npvAt(mid) <= 0) hi = mid; else lo = mid;
        }
        irr = ((lo + hi) / 2) * 100;
      }

      // discounted payback
      let cum = -initial, dpb = NaN;
      for (let i = 0; i < cf.length; i++) {
        const disc = cf[i] / Math.pow(1 + r, i + 1);
        if (cum + disc >= 0 && cum < 0) { dpb = i + (-cum / disc); break; }
        cum += disc;
      }

      const totalUndisc = cf.reduce((s, c) => s + c, 0);
      const table = {
        head: ['Period', 'Cash flow', 'Discount factor', 'Present value', 'Cumulative PV'],
        cols: ['text', 'currency', 'text', 'currency', 'currency'],
        rows: []
      };
      let run = -initial;
      table.rows.push(['0', cell(-initial), '1.0000', cell(-initial), cell(run)]);
      cf.forEach((c, i) => {
        const f = 1 / Math.pow(1 + r, i + 1);
        run += c * f;
        table.rows.push([String(i + 1), cell(c), f.toFixed(4), cell(c * f), cell(run)]);
      });

      return {
        npv, irr,
        pi: initial ? (npv + initial) / initial : NaN,
        dpb,
        totalUndisc,
        verdict: npv > 0 ? 'Accept — the project adds value at this discount rate'
               : npv < 0 ? 'Reject — the project destroys value at this discount rate'
               : 'Marginal — the project exactly earns its cost of capital',
        note: '',
        _table: table
      };
    },
"outputs": [{"key":"npv","label":"Net present value","format":"currency","primary":true},{"key":"irr","label":"Internal rate of return","format":"percent"},{"key":"verdict","label":"Decision","format":"text"},{"key":"pi","label":"Profitability index","format":"number"},{"key":"dpb","label":"Discounted payback","format":"number","unit":"periods"},{"key":"totalUndisc","label":"Total undiscounted inflows","format":"currency"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.npv === undefined ? [] : [
      'NPV = Σ cash flow ÷ (1 + ' + f.upto(Number(v.rate) / 100, 6) + ')^t − ' + f.money(Number(v.initial) || 0) + ' = ' + f.money(r.npv),
      isFinite(r.irr) ? 'IRR: the rate at which NPV is 0 = ' + f.pct(r.irr) : 'IRR: no rate between −99.99% and 1,000% makes NPV 0'].filter(Boolean),
"tips": ["NPV above zero means the project beats your cost of capital. That is the decision rule — a large IRR on a tiny project can still be worth less than a modest IRR on a large one.","IRR fails when cash flows change sign more than once, which can produce several valid answers. NPV never has that problem, so prefer it when the two disagree.","The discount rate is the assumption that matters most. Move it by two points and marginal projects flip. Test a range rather than trusting one figure.","The profitability index (PV of inflows ÷ investment) is useful for ranking projects when capital is limited."],
"faq": [{"q":"What discount rate should I use?","a":"Usually your weighted average cost of capital, or the return available on the next-best use of the money. Many companies add a risk premium for uncertain projects. Using a rate that is too low is the most common way a bad project gets approved."}]
};
})();