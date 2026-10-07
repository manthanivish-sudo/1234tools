(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["tds-calculator"] = {
"currencyLocked": true,
"currencyNote": "Indian TDS rates",
"currency": "INR",
"title": "TDS Calculator",
"category": "india",
"description": "Tax deducted at source on common payments to residents, with the higher rate where PAN is not furnished. Income-tax Act, 2025 (section 393) from 1 April 2026, with the 1961 Act section each payment used to fall under.",
"keywords": ["TDS calculator","tax deducted at source","TDS rate chart","194C","194J","194I","TDS on rent","section 393"],
"formula": "TDS = payment × rate; without PAN, the higher of that rate or 20% (5% for purchase of goods)",
"inputs": [{"key":"section","label":"Nature of payment","type":"select","options":[{"value":"194C_ind","label":"Contractor (individual/HUF) 1% — was 194C"},{"value":"194C_oth","label":"Contractor (others) 2% — was 194C"},{"value":"194J_tech","label":"Technical services 2% — was 194J"},{"value":"194J_prof","label":"Professional fees 10% — was 194J"},{"value":"194I_pm","label":"Rent: plant & machinery 2% — was 194-I"},{"value":"194I_land","label":"Rent: land & building 10% — was 194-I"},{"value":"194H","label":"Commission / brokerage 2% — was 194H"},{"value":"194A","label":"Interest (other than securities) 10% — was 194A"},{"value":"194Q","label":"Purchase of goods 0.1% — was 194Q"},{"value":"194IB","label":"Rent by individual/HUF 2% — was 194-IB"}],"default":"194J_prof"},{"key":"amount","label":"Payment amount","type":"number","unit":"₹","default":100000,"min":0},{"key":"pan","label":"PAN furnished?","type":"select","options":[{"value":"yes","label":"Yes"},{"value":"no","label":"No — higher rate applies"}],"default":"yes"},{"key":"lastRent","label":"Rent for the last month (rent by individual without PAN only; 0 = the amount is 12 equal months)","type":"number","unit":"₹","default":0,"min":0}],
"compute": ({ section, amount, pan, lastRent }) => {
      /* Rates checked 2026-10-04.
         From 1 April 2026 these payments fall under section 393(1) of the
         Income-tax Act, 2025 (Table: "for payments to resident"), which
         replaced sections 192–194T of the 1961 Act (s.1(3), s.536(1);
         CBDT FAQs on interplay and transition). Act as amended by the
         Finance Act, 2026: https://www.incometaxindia.gov.in/documents/d/guest/income_tax_act_2025_as_amended_by_fa_act_2026-pdf
         and as published, https://egazette.gov.in/WriteReadData/2025/265620.pdf
           Sl. 6(i) contractor 1% individual/HUF, 2% others · Sl. 6(iii)
           technical services 2%, professional services 10% · Sl. 2(ii) rent
           2% plant & machinery, 10% land/building/furniture · Sl. 1(ii)
           commission or brokerage 2% · Sl. 5 interest, rates in force (10%,
           Finance Act 2026 First Schedule Part II) · Sl. 8(ii) purchase of
           goods 0.1% · Sl. 2(i) rent paid by a person other than a specified
           person 2%.
         Commission (194H) and rent by individuals (194-IB) were cut from 5%
         to 2% from 1 October 2024 by the Finance (No. 2) Act, 2024, ss.57 and
         59, https://egazette.gov.in/WriteReadData/2024/256436.pdf — this
         engine had 5% for both. The Finance Act, 2026 changed no TDS rate. */
      const RATES = {
        '194C_ind': 1, '194C_oth': 2, '194J_tech': 2, '194J_prof': 10,
        '194I_pm': 2, '194I_land': 10, '194H': 2, '194A': 10,
        '194Q': 0.1, '194IB': 2
      };
      const WHERE = {
        '194C_ind': ['Sl. 6(i)', '194C'], '194C_oth': ['Sl. 6(i)', '194C'],
        '194J_tech': ['Sl. 6(iii)', '194J'], '194J_prof': ['Sl. 6(iii)', '194J'],
        '194I_pm': ['Sl. 2(ii)', '194-I'], '194I_land': ['Sl. 2(ii)', '194-I'],
        '194H': ['Sl. 1(ii)', '194H'], '194A': ['Sl. 5', '194A'],
        '194Q': ['Sl. 8(ii)', '194Q'], '194IB': ['Sl. 2(i)', '194-IB']
      };
      const key = RATES[section] !== undefined ? section : '194J_prof';
      let rate = RATES[key];
      const base = rate;
      const amt = Number(amount) || 0;

      /* No PAN: the higher of the rate above, the rate in force, or 20% —
         5% for purchase of goods (and e-commerce). Income-tax Act, 2025,
         s.397(2)(b)(i), successor of s.206AA of the 1961 Act, which said the
         same. It is never "twice the rate": that was s.206AB (non-filers),
         omitted from 1 April 2025 by the Finance Act, 2025, s.71. For rent
         paid by an individual or HUF the higher deduction may not exceed the
         rent for the last month of the tax year or tenancy, s.397(2)(e)
         (was 194-IB(4)). Checked 2026-10-04 in the Act text above and
         https://www.incometaxindia.gov.in/w/section-206aa-16 */
      let tds, note = '';
      if (pan === 'no') {
        rate = Math.max(rate, key === '194Q' ? 5 : 20);
        tds = amt * rate / 100;
        if (key === '194IB') {
          const given = Number(lastRent) || 0;
          const cap = given > 0 ? given : amt / 12;
          if (tds > cap) {
            tds = cap;
            note = given > 0
              ? 'Capped at the last month’s rent: without PAN the deduction on rent paid by an individual cannot exceed one month’s rent.'
              : 'Capped at one month’s rent, taking the amount as 12 equal months. Without PAN the deduction on rent paid by an individual cannot exceed the last month’s rent — enter it above if the months differ.';
          }
        }
      } else {
        tds = amt * rate / 100;
      }
      if (!note && key === '194IB') note = 'Rent by an individual or HUF is deducted once, from the last month’s payment of the tax year or tenancy, when the rent is over ₹50,000 a month.';
      const [sl, old] = WHERE[key];
      return {
        tds, netPayable: amt - tds, rate: note.indexOf('Capped') === 0 && amt ? (tds / amt) * 100 : rate, baseRate: base,
        uplift: pan === 'no' ? tds - (amt * base / 100) : 0,
        section: `Income-tax Act, 2025 s.393(1) Table ${sl} (was ${old} of the 1961 Act)`,
        note
      };
    },
"outputs": [{"key":"tds","label":"TDS to deduct","format":"currency","primary":true},{"key":"netPayable","label":"Net amount payable","format":"currency"},{"key":"rate","label":"Rate applied","format":"percent"},{"key":"baseRate","label":"Standard rate","format":"percent"},{"key":"uplift","label":"Extra deducted for missing PAN","format":"currency"},{"key":"section","label":"Provision","format":"text"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.tds === undefined ? [] : ['TDS = ' + f.money(Number(v.amount) || 0) + ' × ' + f.pct(r.rate, 2) + ' = ' + f.money(r.tds), 'net payable = ' + f.money(Number(v.amount) || 0) + ' − ' + f.money(r.tds) + ' = ' + f.money(r.netPayable)],
"tips": ["Since 1 April 2026 TDS on these payments is under section 393 of the Income-tax Act, 2025, which replaced sections 192 to 194T of the 1961 Act. The rates carried over unchanged; the option labels give the old section numbers people still use.","Each payment type carries its own threshold below which no TDS is required. This tool applies the rate; check the current threshold before deciding not to deduct.","Without the payee’s PAN, tax is deducted at the higher of the normal rate or 20% (5% for purchase of goods) — section 397(2) of the 2025 Act, formerly section 206AA. It is not doubled: the twice-the-rate rule for non-filers (section 206AB) was abolished from 1 April 2025.","TDS is generally deducted at payment or credit, whichever is earlier, and must be deposited by the 7th of the following month.","Failure to deduct can mean the expense is disallowed, not merely a penalty — often the larger cost."],
"faq": [{"q":"Do these rates change?","a":"Yes, most commonly at each Union Budget, and thresholds change more often than rates. Verify against the current TDS rate chart on the Income Tax Department site before running a payment cycle."}]
};
})();