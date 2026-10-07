(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["gratuity-calculator"] = {
"currencyLocked": true,
"currencyNote": "the statutory gratuity formula (Code on Social Security, 2020)",
"currency": "INR",
"title": "Gratuity Calculator",
"category": "india",
"description": "Gratuity payable under the Code on Social Security, 2020 — which replaced the Payment of Gratuity Act, 1972 from 21 November 2025 with the same formula — and the tax-exempt portion.",
"keywords": ["gratuity calculator","gratuity formula","payment of gratuity act","gratuity exemption","gratuity 5 years"],
"formula": "gratuity = last drawn salary × 15/26 × years of service",
"inputs": [{"key":"salary","label":"Last drawn monthly basic + DA","type":"number","unit":"₹","default":60000,"min":0},{"key":"years","label":"Years of service","type":"number","default":10,"min":0,"step":0.5},{"key":"covered","label":"Employer covered by the gratuity law?","type":"select","options":[{"value":"yes","label":"Yes (10+ employees)"},{"value":"no","label":"No"}],"default":"yes"}],
"compute": ({ salary, years, covered }) => {
      const s = Number(salary) || 0;
      const y = Number(years) || 0;
      /* The Code on Social Security, 2020 came into force on 21 November
         2025 (S.O. 5319(E), https://egazette.gov.in/WriteReadData/2025/267882.pdf)
         and its section 164(1) repeals the Payment of Gratuity Act, 1972.
         Section 53 keeps the formula: "For every completed year of service
         or part thereof in excess of six months ... fifteen days' wages",
         monthly wages ÷ 26 × 15; five years' continuous service except on
         death, disablement or the end of a fixed term; establishments with
         ten or more employees. Ceiling ₹20 lakh ("as notified ... currently
         20 lakhs", Ministry of Labour FAQ). Checked 2026-10-04 at
         https://www.labour.gov.in/static/uploads/2025/07/b0620548445580767b5c0d18c95c26f7.pdf
         and https://www.labour.gov.in/static/uploads/2026/01/de4758d5bfeffc456d7de97a801891b0.pdf

         A part year counts only when it is MORE than six months, so 10.5
         years (exactly six months over) counts as 10. Math.round used to
         make it 11. */
      const whole = Math.floor(y);
      const roundedYears = covered === 'yes' ? (y - whole > 0.5 + 1e-9 ? whole + 1 : whole) : whole;
      const gratuity = covered === 'yes'
        ? s * (15 / 26) * roundedYears
        : s * (15 / 30) * roundedYears;

      const CAP = 2000000;
      const eligible = y >= 5;
      const exempt = Math.min(gratuity, CAP);

      return {
        gratuity: eligible ? gratuity : 0,
        exempt: eligible ? exempt : 0,
        taxable: eligible ? Math.max(0, gratuity - CAP) : 0,
        yearsCounted: roundedYears,
        eligibility: eligible
          ? 'Eligible — five or more years of continuous service'
          : 'Not yet eligible. Five years of continuous service is normally required, except on death or disablement — and a fixed-term employee qualifies after one year, pro rata.',
        /* The Income-tax Act, 2025 (section 19(1), Table Sl. No. 5) still
           names the repealed 1972 Act; no official clarification of how
           gratuity paid under the Code is placed was found on 2026-10-04,
           so the ₹20 lakh limit is applied and the doubt is stated. */
        note: covered === 'yes' && eligible
          ? 'Tax: the exempt amount assumes the ₹20 lakh limit. The Income-tax Act, 2025 still refers to the repealed Payment of Gratuity Act, 1972, and no official clarification for gratuity paid under the Code on Social Security had been issued when this was checked (October 2026) — confirm with your employer or a tax adviser.'
          : ''
      };
    },
"outputs": [{"key":"gratuity","label":"Gratuity payable","format":"currency","primary":true},{"key":"eligibility","label":"Eligibility","format":"text"},{"key":"exempt","label":"Tax-exempt portion","format":"currency"},{"key":"taxable","label":"Taxable portion","format":"currency"},{"key":"yearsCounted","label":"Years counted","format":"number"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.yearsCounted === undefined ? [] : ['gratuity = ' + f.money(Number(v.salary) || 0) + ' × 15 ÷ ' + (v.covered === 'yes' ? 26 : 30) + ' × ' + r.yearsCounted + ' years = ' + f.money(Number(v.salary) * 15 / (v.covered === 'yes' ? 26 : 30) * r.yearsCounted)],
"tips": ["The 15/26 factor treats a month as 26 working days and pays 15 days’ wages for each completed year of service.","Service beyond six months in the final year rounds up to a full year. Six months or less is ignored.","The lifetime tax exemption is ₹20 lakh, aggregated across all employers, not per job.","The five-year condition is waived where service ends because of death or disablement. Since 21 November 2025 a fixed-term employee qualifies after one year of service, paid pro rata.","Since the Code on Social Security took effect, \"wages\" for gratuity are basic pay, DA and retaining allowance — but if the excluded allowances come to more than half of total pay, the excess is added back to wages, which can raise the gratuity."],
"faq": [{"q":"Does gratuity use my full salary?","a":"No. It uses last drawn basic pay plus dearness allowance, not CTC and not including bonuses or allowances such as HRA. This is why the figure is usually smaller than people expect."}]
};
})();