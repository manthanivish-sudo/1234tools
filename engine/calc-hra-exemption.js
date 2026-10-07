(function(){
window.TOOLS = window.TOOLS || {};
/* a schedule cell: the number itself; the page formats it with the reader's currency, grouping and decimals */
const cell = (v) => v;

window.TOOLS["hra-exemption"] = {
"currencyLocked": true,
"currencyNote": "the Indian HRA exemption rules",
"currency": "INR",
"title": "HRA Exemption Calculator",
"category": "india",
"description": "Work out the house rent allowance exemption — the lowest of three tests. Tax year 2026-27 onwards: Income-tax Act, 2025, Schedule III (Table: Sl. No. 11) with rule 279 of the Income-tax Rules, 2026; earlier years: section 10(13A) of the 1961 Act.",
"keywords": ["HRA calculator","HRA exemption","house rent allowance","section 10 13A","HRA tax exemption"],
"formula": "exempt = least of (actual HRA, rent − 10% salary, 50%/40% of salary)",
"inputs": [{"key":"basic","label":"Basic salary + DA (annual)","type":"number","unit":"₹","default":600000,"min":0},{"key":"hra","label":"HRA received (annual)","type":"number","unit":"₹","default":240000,"min":0},{"key":"rent","label":"Rent paid (annual)","type":"number","unit":"₹","default":300000,"min":0},{"key":"metro","label":"City","type":"select","options":[{"value":"metro","label":"Delhi, Mumbai, Kolkata or Chennai"},{"value":"metro8","label":"Bengaluru, Hyderabad, Pune or Ahmedabad"},{"value":"non","label":"Anywhere else"}],"default":"metro"},{"key":"year","label":"Tax year","type":"select","options":[{"value":"2026-27","label":"2026-27 (Income-tax Act, 2025)"},{"value":"2025-26","label":"FY 2025-26 (Income-tax Act, 1961)"}],"default":"2026-27"}],
"compute": ({ basic, hra, rent, metro, year }) => {
      /* The 50% test applies to these cities, 40% elsewhere.
         Tax year 2026-27 on: rule 279 of the Income-tax Rules, 2026 (G.S.R.
         198(E), 20 March 2026, in force 1 April 2026) — "Mumbai, Kolkata,
         Delhi, Chennai, Hyderabad, Pune, Ahmedabad and Bengaluru. 50%";
         read 2026-10-04 in the notified rules,
         https://www.incometaxindia.gov.in/documents/d/guest/en-notified-it-rules-2026-20-03-2026-pdf
         (Web Archive copy of 12 April 2026; the site itself refused automated
         access). FY 2025-26 and earlier: rule 2A of the 1962 Rules — Bombay,
         Calcutta, Delhi and Madras only. */
      const fy2025 = year === '2025-26';
      const fifty = metro === 'metro' || (metro === 'metro8' && !fy2025);
      const pct = fifty ? 0.5 : 0.4;
      const t1 = Number(hra) || 0;
      const t2 = Math.max(0, (Number(rent) || 0) - 0.10 * (Number(basic) || 0));
      const t3 = (Number(basic) || 0) * pct;
      const exempt = Math.min(t1, t2, t3);
      const which = exempt === t1 ? 'Actual HRA received'
                  : exempt === t2 ? 'Rent paid minus 10% of salary'
                  : `${pct * 100}% of salary`;
      return {
        exempt, taxable: t1 - exempt, t1, t2, t3, which,
        note: metro === 'metro8' && fy2025 ? 'Bengaluru, Hyderabad, Pune and Ahmedabad qualify for 50% only from tax year 2026-27; for FY 2025-26 they are at 40%.' : '',
        _table: {
          head: ['Test', 'Amount'],
          cols: ['text', 'currency'],
          rows: [
            ['1. Actual HRA received', cell(t1)],
            ['2. Rent paid − 10% of salary', cell(t2)],
            [`3. ${pct * 100}% of salary (${fifty ? 'metro' : 'non-metro'})`, cell(t3)],
            ['Exempt (lowest of the three)', cell(exempt)],
            ['Taxable portion of HRA', cell(t1 - exempt)]
          ]
        }
      };
    },
"outputs": [{"key":"exempt","label":"HRA exempt from tax","format":"currency","primary":true},{"key":"taxable","label":"Taxable HRA","format":"currency"},{"key":"which","label":"Limiting test","format":"text"},{"key":"t1","label":"Test 1 — actual HRA","format":"currency"},{"key":"t2","label":"Test 2 — rent − 10% salary","format":"currency"},{"key":"t3","label":"Test 3 — % of salary","format":"currency"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.exempt === undefined ? [] : [
      '1. HRA received = ' + f.money(r.t1),
      '2. rent − 10% of salary = ' + f.money(Number(v.rent) || 0) + ' − ' + f.money((Number(v.basic) || 0) * 0.1) + ' = ' + f.money(r.t2),
      '3. ' + (r.t3 === (Number(v.basic) || 0) * 0.5 ? '50%' : '40%') + ' of salary = ' + f.money(r.t3),
      'exempt = the least = ' + f.money(r.exempt)],
"tips": ["HRA exemption is only available under the old regime. The new regime removes it entirely, which is often what decides between the two.","From tax year 2026-27 the 50% test covers eight cities — Delhi, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Pune and Ahmedabad (rule 279 of the Income-tax Rules, 2026). Before that it was the first four only.","\"Salary\" here means basic pay plus dearness allowance that forms part of retirement benefits, not your full CTC.","If annual rent exceeds ₹1,00,000 you must report the landlord’s PAN to your employer.","Paying rent to a parent is allowed if the arrangement is genuine, the parent owns the property and declares the rental income. Keep receipts and bank transfers."],
"faq": [{"q":"Can I claim HRA and a home loan together?","a":"Yes, if the circumstances are genuine — for example you own a property in one city and rent in another for work. Claiming both for the same city and property invites scrutiny."}]
};
})();