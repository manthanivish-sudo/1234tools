(function(){
/* GST 2.0 — effective 22 September 2025. The 12% and 28% slabs were removed,
   most 12% items moving to 5% and most 28% items to 18%, and a 40% rate was
   introduced for luxury and sin goods (56th GST Council meeting, 3 September
   2025; rate notifications of 17 September 2025). The six slabs below are the
   ones in force; "Another rate" takes any other, for a special-rate item or
   an old invoice.

   Heads of tax: within a state CGST and SGST, half each (CGST Act, 2017
   s.9(1) and the state Acts); in a Union territory without a legislature
   CGST and UTGST, half each (UTGST Act, 2017 s.7); between states IGST at
   the full rate (IGST Act, 2017 s.5(1)).
   Cess: compensation cess (GST (Compensation to States) Act, 2017 s.8) is
   charged on the same taxable value, on top of GST; after GST 2.0 it is
   left on only a few tobacco products, so it is an optional percentage.
   Reverse charge: for the supplies notified under CGST Act s.9(3)/(4) and
   IGST Act s.5(3)/(4) the recipient pays the GST to the government, so the
   supplier is paid the taxable value only. */
const SLAB_OPTIONS = [
  { value: 0,    label: '0% — nil rated (essentials)' },
  { value: 0.25, label: '0.25% — rough diamonds' },
  { value: 3,    label: '3% — gold, silver, jewellery' },
  { value: 5,    label: '5% — everyday & essential goods' },
  { value: 18,   label: '18% — standard rate (most goods & services)' },
  { value: 40,   label: '40% — luxury & sin goods' },
  { value: 'custom', label: 'Another rate…' }
];
const LINE_RATES = [{ value: 'same', label: 'Same as line 1' }].concat(SLAB_OPTIONS.filter((o) => o.value !== 'custom'));
const line = (n) => [
  { key: 'amount' + n, label: 'Line ' + n + ' amount', type: 'number', unit: '₹', default: 0, min: 0, group: 'More invoice lines' },
  { key: 'qty' + n, label: 'Line ' + n + ' quantity', type: 'number', default: 1, min: 0, group: 'More invoice lines' },
  { key: 'rate' + n, label: 'Line ' + n + ' GST rate', type: 'select', options: LINE_RATES, default: 'same', group: 'More invoice lines' }
];

/* Two decimals, or three when the rate needs them: 0.25% splits into
   CGST 0.125% + SGST 0.125%, not 0.13% each. */
const pc = (x) => {
  const t = Number(x.toFixed(6));
  return Math.abs(t * 100 - Math.round(t * 100)) < 1e-6 ? t.toFixed(2) : String(t);
};

window.TOOLS = window.TOOLS || {};
window.TOOLS["gst-calculator"] = {
"currencyLocked": true,
"currencyNote": "Indian GST rates",
"currency": "INR",
"title": "GST Calculator (India)",
"category": "india",
"description": "Add or remove GST at current 2026 slabs, with the CGST, SGST and IGST split for your invoice.",
"keywords": ["GST calculator","GST India","CGST SGST IGST","GST inclusive exclusive","GST 18 percent","reverse GST"],
"formula": "GST = base × rate   ·   base = inclusive ÷ (1 + rate)",
"inputs": [{"key":"amount","label":"Amount","type":"number","unit":"₹","default":10000,"min":0},{"key":"mode","label":"Amount is","type":"select","options":[{"value":"exclusive","label":"Exclusive of GST (add GST)"},{"value":"inclusive","label":"Inclusive of GST (extract GST)"}],"default":"exclusive"},{"key":"rate","label":"GST rate","type":"select","options":SLAB_OPTIONS,"default":18},{"key":"customRate","label":"Rate","type":"number","unit":"%","default":1,"min":0,"max":100,"step":0.01,"showIf":{"key":"rate","is":"custom"}},{"key":"supply","label":"Type of supply","type":"select","options":[{"value":"intra","label":"Intra-state (CGST + SGST)"},{"value":"inter","label":"Inter-state (IGST)"},{"value":"ut","label":"Within a Union territory (CGST + UTGST)"}],"default":"intra"},{"key":"qty","label":"Quantity","type":"number","default":1,"min":0},
  {"key":"cess","label":"Compensation cess","type":"number","unit":"%","default":0,"min":0,"max":300,"step":0.01,"group":"Cess and reverse charge"},{"key":"rcm","label":"Reverse charge applies","type":"select","options":[{"value":"no","label":"No"},{"value":"yes","label":"Yes: the recipient pays the GST"}],"default":"no","group":"Cess and reverse charge"}]
  .concat(line(2), line(3), line(4)),
"compute": (v) => {
      const { mode, rate, supply, qty } = v;
      const rateOf = (x) => (x === 'custom' ? Number(v.customRate) || 0 : Number(x) || 0);
      const r1 = rateOf(rate);
      const c = (Number(v.cess) || 0) / 100;
      const lines = [{ n: 1, amount: Number(v.amount), qty: Number(qty) || 1, rate: r1 }];
      [2, 3, 4].forEach((n) => {
        const a = Number(v['amount' + n]) || 0;
        if (a > 0) lines.push({ n, amount: a, qty: Number(v['qty' + n]) || 1, rate: v['rate' + n] === 'same' || v['rate' + n] === undefined ? r1 : rateOf(v['rate' + n]) });
      });
      let base = 0, gst = 0, cessAmt = 0;
      const rows = [];
      lines.forEach((L) => {
        const r = L.rate / 100;
        const value = L.amount * L.qty;
        const b = mode === 'inclusive' ? value / (1 + r + c) : value;
        const g = b * r;
        const ce = b * c;
        base += b; gst += g; cessAmt += ce;
        rows.push([L.n, L.qty, b, L.rate, g, ce, b + g + ce]);
      });
      const total = base + gst + cessAmt;
      const intra = supply !== 'inter';
      const rates = lines.filter((L) => L.amount * L.qty > 0).map((L) => L.rate);
      const one = rates.every((x) => x === (rates[0] === undefined ? r1 : rates[0]));
      const R = one ? (rates[0] === undefined ? r1 : rates[0]) : null;
      const second = supply === 'ut' ? 'UTGST' : 'SGST';
      const out = {
        total, base, gst,
        cgst: intra ? gst / 2 : 0,
        sgst: supply === 'intra' ? gst / 2 : 0,
        utgst: supply === 'ut' ? gst / 2 : 0,
        igst: supply === 'inter' ? gst : 0,
        splitLabel: R === null
          ? (intra ? 'CGST + ' + second + ' at half of each line’s rate' : 'IGST at each line’s rate')
          : intra ? `CGST ${pc(R / 2)}% + ${second} ${pc(R / 2)}%` : `IGST ${pc(R)}%`,
        effectiveRate: base ? (gst / base) * 100 : 0
      };
      if (c > 0) out.cessAmt = cessAmt;
      if (v.rcm === 'yes') {
        out.payable = base;
        out.rcmTax = gst + cessAmt;
        out.note = 'Reverse charge: the recipient pays the ' + (c > 0 ? 'GST and cess' : 'GST') + ' to the government and pays the supplier the taxable value only. The invoice must say that tax is payable on reverse charge.';
      }
      if (lines.length > 1 || c > 0) {
        const head = ['Line', 'Qty', 'Taxable value', 'Rate %', intra ? 'CGST + ' + second : 'IGST', 'Cess', 'Line total'];
        out._table = { title: 'Invoice', head, cols: ['int', 'number', 'currency', 'number', 'currency', 'currency', 'currency'], rows,
          foot: ['Total', '', base, '', gst, cessAmt, total] };
      }
      return out;
    },
"outputs": [{"key":"total","label":"Invoice total","format":"currency","primary":true},{"key":"base","label":"Taxable value","format":"currency"},{"key":"gst","label":"Total GST","format":"currency"},{"key":"splitLabel","label":"Tax split","format":"text"},{"key":"cgst","label":"CGST","format":"currency"},{"key":"sgst","label":"SGST","format":"currency"},{"key":"utgst","label":"UTGST","format":"currency"},{"key":"igst","label":"IGST","format":"currency"},{"key":"cessAmt","label":"Compensation cess","format":"currency"},{"key":"payable","label":"Paid to the supplier","format":"currency"},{"key":"rcmTax","label":"Paid by the recipient under reverse charge","format":"currency"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      const R = v.rate === 'custom' ? Number(v.customRate) || 0 : Number(v.rate) || 0;
      const c = Number(v.cess) || 0;
      const value = Number(v.amount) * (Number(v.qty) || 1);
      const L = [];
      if ((Number(v.qty) || 1) !== 1) L.push('line value = ' + f.money(Number(v.amount)) + ' × ' + f.upto(Number(v.qty), 4) + ' = ' + f.money(value));
      if (v.mode === 'inclusive') L.push('base = ' + f.money(value) + ' ÷ (1 + ' + f.upto(R / 100, 6) + (c ? ' + ' + f.upto(c / 100, 6) : '') + ') = ' + f.money(value / (1 + R / 100 + c / 100)));
      const b = v.mode === 'inclusive' ? value / (1 + R / 100 + c / 100) : value;
      L.push('GST = ' + f.money(b) + ' × ' + f.upto(R, 4) + '% = ' + f.money(b * R / 100));
      if (c) L.push('cess = ' + f.money(b) + ' × ' + f.upto(c, 4) + '% = ' + f.money(b * c / 100));
      if (r._table) L.push('all lines: taxable ' + f.money(r.base) + ' + GST ' + f.money(r.gst) + (r.cessAmt ? ' + cess ' + f.money(r.cessAmt) : '') + ' = ' + f.money(r.total));
      return L;
    },
"steps": (v, r, f) => {
      const S = [];
      if (v.supply === 'inter') S.push('Between states the whole ' + f.money(r.gst) + ' is IGST.');
      else S.push('Within ' + (v.supply === 'ut' ? 'a Union territory' : 'a state') + ' the ' + f.money(r.gst) + ' splits in half: CGST ' + f.money(r.cgst) + ' and ' + (v.supply === 'ut' ? 'UTGST ' + f.money(r.utgst) : 'SGST ' + f.money(r.sgst)) + '.');
      S.push('Invoice total: ' + f.money(r.base) + ' + ' + f.money(r.gst) + (r.cessAmt ? ' + ' + f.money(r.cessAmt) : '') + ' = ' + f.money(r.total) + '.');
      if (v.rcm === 'yes') S.push('Under reverse charge the supplier is paid ' + f.money(r.payable) + ' and the recipient pays ' + f.money(r.rcmTax) + ' to the government.');
      return S;
    },
"tips": ["GST 2.0 took effect on 22 September 2025: the 12% and 28% slabs were removed, most 12% items moved to 5% and most 28% items to 18%, and a 40% demerit rate was introduced for luxury and sin goods.","Intra-state supply splits the tax equally into CGST and SGST. Inter-state supply is a single IGST charge at the full rate.","To remove 18% GST you divide by 1.18 — subtracting 18% takes off too much and understates the taxable value.","Place of supply, not where you are sitting, determines whether CGST+SGST or IGST applies. Getting it wrong means an amended return.","Add up to three more lines, each at its own rate, to total a whole invoice; the schedule below lists every line and can be printed.","Compensation cess now applies to only a few tobacco products; enter it only when your goods carry it, and it is charged on the same taxable value."],
"faq": [{"q":"Which GST rate applies to my product?","a":"It depends on the HSN or SAC code, not on a general category. The GST Council publishes rate notifications against specific codes, and misclassification is a common cause of demand notices. Check the current notification or ask your CA rather than assuming."},{"q":"Why do CGST and SGST each show half the rate?","a":"For supplies within one state the tax is shared between the Centre and the state. An 18% rate is therefore 9% CGST plus 9% SGST. The customer still pays 18% in total."},{"q":"What changes under reverse charge?","a":"The recipient, not the supplier, pays the GST to the government, so the supplier is paid only the taxable value. Choose reverse charge to see both amounts; whether it applies depends on the service and who is supplying it, as notified under section 9(3) and 9(4) of the CGST Act."}]
};
})();
