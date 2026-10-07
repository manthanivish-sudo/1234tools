(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["invoice-payment-terms"] = {
"currency": "GBP",
"title": "Invoice Due Date & Settlement Discount Calculator",
"category": "business",
"description": "Work out payment due dates, late payment interest, and whether an early settlement discount is worth taking.",
"keywords": ["invoice due date calculator","payment terms","net 30","late payment interest","early settlement discount","2/10 net 30"],
"formula": "effective annual cost = (d / (1 − d)) × (365 / (net − discount days))",
"inputs": [{"key":"invoiceDate","label":"Invoice date","type":"date","default":"TODAY"},{"key":"terms","label":"Payment terms","type":"select","options":[{"value":"7","label":"Net 7"},{"value":"14","label":"Net 14"},{"value":"30","label":"Net 30"},{"value":"45","label":"Net 45"},{"value":"60","label":"Net 60"},{"value":"90","label":"Net 90"}],"default":"30"},{"key":"amount","label":"Invoice amount","type":"number","unit":"£","default":10000,"min":0},{"key":"discount","label":"Early settlement discount","type":"number","unit":"%","default":2,"min":0,"step":0.1},{"key":"discountDays","label":"Discount if paid within","type":"number","unit":"days","default":10,"min":0},{"key":"daysLate","label":"Days overdue (for interest)","type":"number","default":0,"min":0},{"key":"baseRate","label":"Bank of England reference rate (3.75% for debts falling due Jul–Dec 2026, checked 4 Oct 2026)","type":"number","unit":"%","default":3.75,"min":0,"step":0.05}],
"compute": ({ invoiceDate, terms, amount, discount, discountDays, daysLate, baseRate }) => {
      /* Whole calendar days in UTC, so the browser's time zone cannot move
         the due date a day. */
      const dayOf = (s) => {
        const m = /^(-?\d{1,6})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s).trim());
        if (m) { const t = new Date(0); t.setUTCFullYear(+m[1], +m[2] - 1, +m[3]); return t; }
        const x = new Date(s);
        return isNaN(x) ? x : new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
      };
      const d0 = dayOf(invoiceDate);
      if (isNaN(d0)) return { note: 'Enter a valid invoice date.' };
      const net = Number(terms);

      const due = new Date(d0); due.setUTCDate(due.getUTCDate() + net);
      const discDue = new Date(d0); discDue.setUTCDate(discDue.getUTCDate() + Number(discountDays));

      const dFrac = discount / 100;
      const window = net - discountDays;
      // Cost of NOT taking the discount, annualised.
      const effAnnual = (dFrac > 0 && window > 0)
        ? (dFrac / (1 - dFrac)) * (365 / window) * 100 : NaN;

      /* UK statutory late payment interest is 8% over the Bank of England
         reference rate: the Bank Rate in force on 30 June (for interest
         starting 1 July–31 December) or on 31 December (for 1 January–30
         June) — Late Payment of Commercial Debts (Rate of Interest) (No. 3)
         Order 2002, art. 4, https://www.legislation.gov.uk/uksi/2002/1675/article/4.
         Default 3.75%: Bank Rate since 18 December 2025, so in force on both
         31 December 2025 and 30 June 2026, and still 3.75% after the
         17 September 2026 decision. Checked 2026-10-04 at
         https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp and
         https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate
         (next decision 5 November 2026). It is an input, so the reader can
         use the rate for their own debt's period. */
      const ref = baseRate === null || baseRate === undefined || baseRate === '' || !isFinite(Number(baseRate))
        ? 3.75 : Math.max(0, Number(baseRate));
      const statutory = 0.08 + ref / 100;
      const interest = amount * statutory * (Number(daysLate) || 0) / 365;
      const fee = amount < 1000 ? 40 : amount < 10000 ? 70 : 100;

      const fmtD = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

      return {
        dueDate: fmtD(due),
        discountDate: dFrac > 0 ? fmtD(discDue) : '—',
        discountAmount: amount * dFrac,
        payIfEarly: amount * (1 - dFrac),
        effAnnual,
        worthTaking: !isFinite(effAnnual) ? '—'
          : effAnnual > 12 ? `Yes — refusing it costs ${effAnnual.toFixed(1)}% a year`
          : `Marginal — only ${effAnnual.toFixed(1)}% a year`,
        interest,
        statutoryRate: statutory * 100,
        compensation: daysLate > 0 ? fee : 0,
        totalIfLate: amount + interest + (daysLate > 0 ? fee : 0),
        note: ''
      };
    },
"outputs": [{"key":"dueDate","label":"Payment due","format":"text","primary":true},{"key":"discountDate","label":"Discount deadline","format":"text"},{"key":"payIfEarly","label":"Pay if settled early","format":"currency"},{"key":"discountAmount","label":"Discount value","format":"currency"},{"key":"effAnnual","label":"Annualised cost of not taking it","format":"percent"},{"key":"worthTaking","label":"Verdict","format":"text"},{"key":"interest","label":"Statutory late interest","format":"currency"},{"key":"statutoryRate","label":"Statutory interest rate (reference rate + 8%)","format":"percent"},{"key":"compensation","label":"Late payment compensation","format":"currency"},{"key":"totalIfLate","label":"Total owed if late","format":"currency"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.dueDate === undefined ? [] : [
      'due = invoice date + ' + v.terms + ' days = ' + r.dueDate,
      isFinite(r.effAnnual) ? 'cost of skipping the discount = (' + f.upto(Number(v.discount) / 100, 4) + ' ÷ (1 − ' + f.upto(Number(v.discount) / 100, 4) + ')) × (365 ÷ ' + (Number(v.terms) - Number(v.discountDays)) + ') = ' + f.pct(r.effAnnual) : '',
      Number(v.daysLate) ? 'late interest = ' + f.money(Number(v.amount)) + ' × ' + f.pct(r.statutoryRate) + ' × ' + v.daysLate + ' ÷ 365 = ' + f.money(r.interest) : ''].filter(Boolean),
"tips": ["A 2% discount for paying 20 days early is worth about 37% a year. Almost any business should take it rather than hold the cash.","UK businesses can charge statutory interest at 8% above the Bank of England base rate on late commercial payments, plus fixed compensation of £40, £70 or £100 depending on invoice size.","The reference rate is the Bank of England Bank Rate on 30 June (for debts falling due July to December) or 31 December (January to June). It was 3.75% on 31 December 2025 and on 30 June 2026 (checked October 2026); change it above for an older debt, and check the Bank of England before issuing a formal demand.","Terms run from the invoice date unless the contract says otherwise. \"Net 30 from end of month\" is a materially different arrangement."],
"faq": [{"q":"Can I really charge late payment interest?","a":"In the UK, the Late Payment of Commercial Debts (Interest) Act 1998 gives businesses a statutory right to interest and fixed compensation on overdue commercial invoices, unless the contract provides a substantial alternative remedy. Many suppliers never invoke it, but the right exists."}]
};
})();