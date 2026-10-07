(function(){
window.TOOLS = window.TOOLS || {};
/* a schedule cell: the number itself; the page formats it with the reader's currency, grouping and decimals */
const cell = (v) => v;

window.TOOLS["commission-calculator"] = {
"currency": "GBP",
"title": "Sales Commission Calculator",
"category": "business",
"description": "Flat, tiered and threshold-based commission, with on-target earnings and effective rate.",
"keywords": ["commission calculator","sales commission","tiered commission","OTE calculator","sales compensation"],
"formula": "commission = Σ (sales in tier × tier rate)",
"inputs": [{"key":"sales","label":"Total sales","type":"number","unit":"£","default":120000,"min":0},{"key":"structure","label":"Structure","type":"select","options":[{"value":"flat","label":"Flat rate"},{"value":"threshold","label":"Above a threshold only"},{"value":"tiered","label":"Tiered (accelerating)"}],"default":"tiered"},{"key":"rate","label":"Base commission rate","type":"number","unit":"%","default":5,"step":0.1,"min":0,"max":100},{"key":"threshold","label":"Threshold / quota","type":"number","unit":"£","default":50000,"min":0},{"key":"base","label":"Base salary","type":"number","unit":"£","default":30000,"min":0}],
"compute": ({ sales, structure, rate, threshold, base }) => {
      let commission = 0;
      const rows = [];

      if (structure === 'flat') {
        commission = sales * (rate / 100);
        rows.push(['All sales', cell(sales), rate.toFixed(2) + '%', cell(commission)]);
      } else if (structure === 'threshold') {
        const eligible = Math.max(0, sales - threshold);
        commission = eligible * (rate / 100);
        rows.push(['Below quota', cell(Math.min(sales, threshold)), '0.00%', cell(0)]);
        rows.push(['Above quota', cell(eligible), rate.toFixed(2) + '%', cell(commission)]);
      } else {
        // accelerating: base rate to quota, 1.5x to 2x quota, 2x beyond
        const tiers = [
          { from: 0, to: threshold, mult: 1 },
          { from: threshold, to: threshold * 2, mult: 1.5 },
          { from: threshold * 2, to: Infinity, mult: 2 }
        ];
        tiers.forEach((t, i) => {
          const amt = Math.max(0, Math.min(sales, t.to) - t.from);
          if (amt <= 0) return;
          const r = (rate / 100) * t.mult;
          const c = amt * r;
          commission += c;
          rows.push([`Tier ${i + 1} (${(t.mult * rate).toFixed(1)}%)`, cell(amt), (r * 100).toFixed(2) + '%', cell(c)]);
        });
      }

      /* On-target earnings: base plus the commission paid at exactly 100% of
         quota. Flat and tiered pay the base rate on the quota itself; a
         threshold plan pays nothing until sales pass it. */
      const ote = base + (structure === 'threshold' ? 0 : threshold * (rate / 100));

      return {
        commission,
        total: base + commission,
        ote,
        effectiveRate: sales ? (commission / sales) * 100 : 0,
        attainment: threshold ? (sales / threshold) * 100 : NaN,
        commissionShare: (base + commission) ? (commission / (base + commission)) * 100 : 0,
        _table: { head: ['Tier', 'Sales', 'Rate', 'Commission'], cols: ['text', 'currency', 'text', 'currency'], rows }
      };
    },
"outputs": [{"key":"commission","label":"Commission earned","format":"currency","primary":true},{"key":"total","label":"Total earnings (base + commission)","format":"currency"},{"key":"ote","label":"On-target earnings (base + commission at 100% of quota)","format":"currency"},{"key":"effectiveRate","label":"Effective commission rate","format":"percent"},{"key":"attainment","label":"Quota attainment","format":"percent"},{"key":"commissionShare","label":"Variable share of pay","format":"percent"}],
"filled": (v, r, f) => {
      const L = (r._table && r._table.rows || []).map((x) => x[0] + ': ' + f.money(x[1]) + ' × ' + x[2] + ' = ' + f.money(x[3]));
      L.push('commission = ' + f.money(r.commission) + '; with the base ' + f.money(Number(v.base) || 0) + ', total ' + f.money(r.total));
      return L;
    },
"tips": ["Accelerators reward over-performance and are usually cheaper than raising the base rate, because they only pay out on the sales you most want.","A common split is 50/50 base to variable for new business roles, and 70/30 or 80/20 for account management.","Commission on revenue can push a team towards discounting. Paying on gross profit removes that incentive."],
"faq": [{"q":"Should commission be paid on revenue or profit?","a":"Profit aligns the seller with the business, since discounting then costs them directly. Revenue is simpler to administer and easier for sellers to forecast. Many companies compromise by paying on revenue but capping the discount a rep can authorise."}]
};
})();