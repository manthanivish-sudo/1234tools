(function(){
/* A tip, and the bill split.

   tip = base × rate, where the base is the whole bill or, with "tax before
   tip", the bill less the tax printed on it (tipping on the pre-tax
   subtotal, the stricter reading). Rounding: each share up to the next whole
   unit, or the total up.

   An uneven split: list what each person had (one amount each, separated by
   commas or new lines). Each pays their own items plus a share of the tip
   and of anything not itemised (service, tax already in the bill but not in
   the items), in proportion to what they had. When the items add up to more
   than the bill, the bill is what is shared, in the same proportions. */
function amounts(text) {
  return String(text || '').split(/[\n,;]+/).map((s) => s.replace(/[^0-9.\-]/g, '')).filter((s) => s !== '' && s !== '-' && s !== '.').map(Number).filter((n) => Number.isFinite(n) && n >= 0);
}

window.TOOLS = window.TOOLS || {};
window.TOOLS["tip-calculator"] = {
"title": "Tip Calculator & Bill Splitter",
"category": "utilities",
"currency": "GBP",
"description": "Work out a tip and split a bill between any number of people, with optional rounding.",
"keywords": ["tip calculator","split bill","gratuity calculator","bill splitter","how much to tip"],
"formula": "tip = bill × rate  ·  each = (bill + tip) / people",
"inputs": [{"key":"bill","label":"Bill amount","type":"number","unit":"£","default":85,"min":0},{"key":"tip","label":"Tip","type":"number","unit":"%","default":12.5,"min":0,"max":100,"step":0.5,"presets":[10,12.5,15,18,20]},{"key":"people","label":"Split between","type":"number","default":4,"min":1,"max":1000,"integer":true},{"key":"round","label":"Rounding","type":"select","options":[{"value":"none","label":"Exact"},{"value":"up","label":"Round each share up"},{"value":"total","label":"Round the total up"}],"default":"none"},
  {"key":"tax","label":"Tax included in the bill","type":"number","unit":"£","default":0,"min":0,"group":"Tax and an uneven split","hint":"Sales tax or VAT shown on the bill, if you tip on the amount before it."},{"key":"tipOn","label":"Work the tip out on","type":"select","options":[{"value":"total","label":"The whole bill"},{"value":"pretax","label":"The bill before tax"}],"default":"total","group":"Tax and an uneven split"},{"key":"items","label":"What each person had (uneven split)","type":"text","default":"","placeholder":"e.g. 32.50, 20, 18, 14.50","group":"Tax and an uneven split","hint":"One amount for each person. Leave empty to split equally."}],
"validate": (v) => {
      const e = {};
      if ((Number(v.tax) || 0) > (Number(v.bill) || 0)) e.tax = 'The tax cannot be more than the bill.';
      if (String(v.items || '').trim() && !amounts(v.items).length) e.items = 'List amounts such as 32.50, 20, 18.';
      return e;
    },
"compute": ({ bill, tip, people, round, tax, tipOn, items }) => {
      const b = Number(bill) || 0;
      const T = Math.min(b, Number(tax) || 0);
      const base = tipOn === 'pretax' ? b - T : b;
      const list = amounts(items);
      const n = list.length ? list.length : Math.max(1, Math.round(Number(people) || 1));
      let tipAmt = base * ((Number(tip) || 0) / 100);
      let total = b + tipAmt;

      if (round === 'total') { total = Math.ceil(total); tipAmt = total - b; }
      let each = total / n;
      if (round === 'up' && !list.length) { each = Math.ceil(each); total = each * n; tipAmt = total - b; }

      const out = {
        each, total, tipAmt,
        tipEach: tipAmt / n,
        billEach: b / n,
        effectiveTip: b ? (tipAmt / b) * 100 : 0
      };
      if (T > 0 || tipOn === 'pretax') out.tipBase = base;
      if (list.length) {
        const sum = list.reduce((a, x) => a + x, 0);
        if (sum > 0) {
          const rows = list.map((x, k) => {
            const share = x / sum;
            let pays = total * share;
            if (round === 'up') pays = Math.ceil(pays);
            /* the tip share is what this person pays over their part of the bill, so the column adds up to the tip even after rounding */
            return [k + 1, x, pays - b * share, pays];
          });
          if (round === 'up') { out.total = rows.reduce((a, r) => a + r[3], 0); out.tipAmt = out.total - b; }
          out.each = undefined;
          out.most = Math.max.apply(null, rows.map((r) => r[3]));
          out.least = Math.min.apply(null, rows.map((r) => r[3]));
          out.itemsTotal = sum;
          if (Math.abs(sum - b) > 0.005) out.note = sum < b
            ? 'The items add up to less than the bill: the difference is shared in the same proportions.'
            : 'The items add up to more than the bill: the bill is shared in the same proportions.';
          out._table = { title: 'Who pays what', head: ['Person', 'Had', 'Tip share', 'Pays'], cols: ['int', 'currency', 'currency', 'currency'], rows,
            foot: ['Total', sum, out.tipAmt, out.total] };
          out._chart = { type: 'donut', title: 'Who pays what', format: 'currency', center: { label: 'Total', value: out.total }, slices: rows.map((r, k) => ({ name: 'Person ' + r[0], value: r[3], c: k % 6 })) };
        }
      }
      return out;
    },
"outputs": [{"key":"each","label":"Each person pays","format":"currency","primary":true},{"key":"most","label":"Most anyone pays","format":"currency","primary":true},{"key":"least","label":"Least anyone pays","format":"currency"},{"key":"total","label":"Total including tip","format":"currency"},{"key":"tipAmt","label":"Tip amount","format":"currency"},{"key":"tipBase","label":"Tip worked out on","format":"currency"},{"key":"billEach","label":"Bill share each","format":"currency"},{"key":"tipEach","label":"Tip share each","format":"currency"},{"key":"effectiveTip","label":"Effective tip rate","format":"percent"},{"key":"itemsTotal","label":"Items add up to","format":"currency"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      const b = Number(v.bill) || 0, T = Math.min(b, Number(v.tax) || 0);
      const base = v.tipOn === 'pretax' ? b - T : b;
      const L = [];
      if (v.tipOn === 'pretax') L.push('before tax = ' + f.money(b) + ' − ' + f.money(T) + ' = ' + f.money(base));
      L.push('tip = ' + f.money(base) + ' × ' + f.upto(Number(v.tip) || 0, 4) + '% = ' + f.money(base * (Number(v.tip) || 0) / 100) + (v.round !== 'none' ? ' (then rounded)' : ''));
      if (r.each !== undefined) L.push('each = (' + f.money(b) + ' + ' + f.money(r.tipAmt) + ') ÷ ' + Math.round(r.total / r.each) + ' = ' + f.money(r.each));
      else L.push('each person pays their share of ' + f.money(r.total) + ', in proportion to what they had');
      return L;
    },
"tips": ["Tipping norms vary enormously: around 15–20% is customary in the US, 10–15% in the UK, and tipping is unusual or even unwelcome in Japan.","Check whether service is already included before adding a tip — many restaurants add 12.5% automatically for larger tables.","Rounding each share up is the practical option when people are paying cash and nobody wants to hunt for change.","Tap a common rate, or type any other.","For an uneven split, list what each person had: each pays their own share of the bill and of the tip, in proportion."],
"faq": [{"q":"Should I tip on the pre-tax or post-tax amount?","a":"Either is accepted. Tipping on the pre-tax subtotal is the stricter reading, since tax is not part of the service. The difference is small, and nobody will comment on it. Enter the tax shown on the bill and choose the bill before tax to tip that way."}]
};
})();
