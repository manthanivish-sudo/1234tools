'use strict';
/* Story data for the India section (/india/). Contract: kit2-schema.md §1–2.
   Browser calculators: free, no sign-up, nothing typed is uploaded. Every example
   is a `calc` spec with real input keys from the tool's engine and ₹ figures; the
   capture engine runs the live page, so the kit shows the tool's own answer. */

const PROOF = ['Free', 'No sign-up', 'Runs in your browser'];

module.exports = {
  '/india/gst-calculator/': {
    persona: 'Shop owners and accountants',
    hook: '₹11,800 including GST. What is the taxable value?',
    pain: 'The bill shows one total. Your invoice needs the taxable value, CGST and SGST — and 18% off is wrong.',
    usual: ['Taking 18% off the total (wrong)', 'A spreadsheet formula rebuilt every time', 'Calculator apps buried in ads'],
    promise: 'Type the amount and rate. Get taxable value, CGST, SGST or IGST.',
    steps: ['Enter the amount', 'Pick the rate and supply type', 'Copy the split'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { amount: 11800, mode: 'inclusive', rate: 18, supply: 'intra', qty: 1 } },
    howTo: 'How to split GST out of a total, free',
    cta: 'Split my GST'
  },

  '/india/india-income-tax/': {
    persona: 'Salaried taxpayers in India',
    hook: '₹18 lakh salary, ₹3.75 lakh deductions. Which regime wins?',
    pain: 'HR wants your regime choice. Pick the wrong one and extra tax comes out of every payslip all year.',
    usual: ['Advice from colleagues on other salaries', 'Slab tables and a calculator on paper', 'Waiting for your CA to get back'],
    promise: 'Enter income and deductions. See both regimes side by side.',
    steps: ['Enter your gross income', 'Add old-regime deductions', 'See which regime saves more'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { gross: 1800000, fy: '2026-27', type: 'salaried', age: 'below60', deductions: 375000 } },
    howTo: 'How to choose between the new and old tax regime',
    cta: 'Compare both regimes'
  },

  '/india/hra-exemption/': {
    persona: 'Salaried employees who pay rent',
    hook: 'Paying ₹30,000 a month in rent? See how much HRA is tax-free.',
    pain: 'Your payslip shows HRA. How much of it is tax-free depends on three tests nobody explains.',
    usual: ['Reading Section 10(13A) yourself', 'Assuming all of your HRA is exempt', 'Waiting for payroll to reply'],
    promise: 'Enter salary, HRA and rent. Get the exempt HRA and the limiting test.',
    steps: ['Enter basic + DA and HRA', 'Add rent paid and city', 'Read the exempt HRA'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { basic: 720000, hra: 288000, rent: 360000, metro: 'metro' } },
    howTo: 'How to work out your HRA exemption, free',
    cta: 'Check my HRA'
  },

  '/india/india-capital-gains/': {
    persona: 'Investors selling shares or property',
    hook: 'Sold shares for a ₹2 lakh gain. How much of it is tax?',
    pain: 'You sold at a profit. Short or long term, the ₹1.25 lakh exemption and 12.5% all change the bill.',
    usual: ['Rules that changed in July 2024', 'Broker reports that stop at the gain', 'Forum answers from before the new rates'],
    promise: 'Enter sale, cost and months held. Get the gain, the rate and the tax.',
    steps: ['Pick the asset type', 'Enter sale, cost, months held', 'Read the tax due'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { asset: 'equity', sale: 500000, cost: 300000, expenses: 0, months: 14, slabRate: 30 } },
    howTo: 'How to calculate capital gains tax on shares',
    cta: 'Work out my tax'
  },

  '/india/tds-calculator/': {
    persona: 'Accountants and business owners',
    hook: 'Vendor has no PAN? The TDS you deduct just doubled.',
    pain: 'A ₹1.5 lakh professional fee is due today. Which section, which rate — and what if PAN is missing?',
    usual: ['Rate charts that change every Budget', 'Forgetting the 206AA higher rate', 'Messaging your CA for every payment'],
    promise: 'Pick the section, enter the payment. Get the TDS and the net payable.',
    steps: ['Pick the nature of payment', 'Enter amount and PAN status', 'Deduct the TDS shown'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { section: '194J_prof', amount: 150000, pan: 'no' } },
    howTo: 'How to calculate TDS on a payment, free',
    cta: 'Calculate TDS'
  },

  '/india/sip-calculator/': {
    persona: 'Mutual fund investors',
    hook: 'A 10% yearly step-up nearly doubles this ₹5,000 SIP.',
    pain: 'You started a ₹5,000 SIP. You have no idea whether raising it each year is worth the squeeze.',
    usual: ['Fund pages that push their own schemes', 'Projections that ignore step-ups', 'Compound maths done in your head'],
    promise: 'Enter SIP, return, years and step-up. See maturity and wealth gained.',
    steps: ['Enter your monthly SIP', 'Set return, years, step-up', 'Compare maturity and invested'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { monthly: 5000, rate: 12, years: 20, stepup: 10 } },
    howTo: 'How to see what a SIP step-up is worth',
    cta: 'Project my SIP'
  },

  '/india/lumpsum-returns/': {
    persona: 'Investors with a one-time sum',
    hook: '₹5 lakh at 12% for 12 years. What is it worth in today’s money?',
    pain: 'The projection says your money nearly quadruples. It never says what that will buy after inflation.',
    usual: ['Brochures that leave out inflation', 'Subtracting inflation from the return', 'One headline number, no context'],
    promise: 'Enter the sum, return and years. See maturity and its real worth.',
    steps: ['Enter the one-time amount', 'Set return, years, inflation', 'Read nominal and real value'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { principal: 500000, rate: 12, years: 12, inflation: 6 } },
    howTo: 'How to value a lump sum after inflation',
    cta: 'See the real value'
  },

  '/india/ppf-calculator/': {
    persona: 'PPF savers',
    hook: 'Max out PPF for 15 years. What is the tax-free total?',
    pain: 'You put ₹1.5 lakh into PPF every year. You have never seen what it adds up to at maturity.',
    usual: ['Passbook entries with no projection', 'Year-by-year sums on the back of a slip', 'Rate changes nobody factors in'],
    promise: 'Enter the yearly deposit and rate. Get maturity, year by year.',
    steps: ['Enter your yearly deposit', 'Check the rate and period', 'See maturity, year by year'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { annual: 150000, rate: 7.1, years: 15 } },
    howTo: 'How to calculate PPF maturity, free',
    cta: 'Project my PPF'
  },

  '/india/epf-calculator/': {
    persona: 'Salaried employees in India',
    hook: '₹30,000 basic at 28. What is in your EPF at 58?',
    pain: 'Twelve per cent leaves every payslip. You have no picture of what it becomes, or what goes to EPS.',
    usual: ['A passbook balance with no forecast', 'Not knowing the EPS split', 'Assuming all 12% from the employer is EPF'],
    promise: 'Enter basic, age and growth. See your corpus and the EPS split.',
    steps: ['Enter monthly basic + DA', 'Set age, retirement, growth', 'Read the corpus at retirement'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { basic: 30000, age: 28, retire: 58, rate: 8.25, growth: 7, existing: 0 } },
    howTo: 'How to estimate your EPF at retirement',
    cta: 'Project my EPF'
  },

  '/india/gratuity-calculator/': {
    persona: 'Employees about to change jobs',
    hook: 'Leaving after 7 years? Check your gratuity before you sign.',
    pain: 'You are about to resign. Gratuity is 15/26 of basic for each year, and HR’s figure is the only one you have.',
    usual: ['Using full CTC instead of basic + DA', 'Forgetting the six-month rounding rule', 'Taking the HR figure on trust'],
    promise: 'Enter last basic + DA and years. Get gratuity and the tax-free part.',
    steps: ['Enter last basic + DA', 'Enter years of service', 'Read gratuity and exemption'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { salary: 50000, years: 7, covered: 'yes' } },
    howTo: 'How to calculate your gratuity, free',
    cta: 'Check my gratuity'
  },

  '/india/fd-rd-calculator/': {
    persona: 'Savers comparing FDs',
    hook: 'A 7% FD in the 30% bracket. What do you really earn?',
    pain: 'The bank quotes 7%. After tax at your slab, the FD earns a lot less, and nobody shows you that part.',
    usual: ['Bank pages that show pre-tax maturity', 'Treating TDS as the final tax', 'Comparing FD and RD by gut feel'],
    promise: 'Enter deposit, rate and slab. See maturity before and after tax.',
    steps: ['Choose FD or RD', 'Enter amount, rate and tenure', 'Compare pre- and post-tax'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { type: 'fd', amount: 500000, rate: 7, years: 5, slabRate: 30 } },
    howTo: 'How to work out FD returns after tax',
    cta: 'Check my FD'
  },

  '/india/nps-calculator/': {
    persona: 'NPS subscribers',
    hook: '₹5,000 a month into NPS from 30. What pension at 60?',
    pain: 'You know 40% of the NPS pot must buy an annuity. You do not know what monthly pension that pays.',
    usual: ['Projections that stop at the corpus', 'Forgetting the annuity is taxed', 'Guessing an annuity rate'],
    promise: 'Enter contribution, age and return. See corpus, lump sum and pension.',
    steps: ['Enter your monthly contribution', 'Set age, return, annuity share', 'Read corpus and pension'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { monthly: 5000, age: 30, rate: 10, annuityPct: 40, annuityRate: 6 } },
    howTo: 'How to estimate your NPS pension at 60',
    cta: 'Project my NPS'
  },

  '/india/ctc-take-home/': {
    persona: 'Job seekers weighing an offer',
    hook: 'Offer letter says ₹12 LPA. What lands in your account?',
    pain: 'CTC ÷ 12 says ₹1 lakh a month. Employer PF, professional tax and income tax have other plans.',
    usual: ['Dividing CTC by twelve', 'Asking HR, then waiting', 'Salary sites that want your email first'],
    promise: 'Enter CTC and basic %. See gross, deductions and monthly in-hand.',
    steps: ['Enter your annual CTC', 'Set basic % and regime', 'Read your monthly in-hand'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { ctc: 1200000, basicPct: 40, regime: 'new', ptax: 2400 } },
    howTo: 'How to turn CTC into monthly in-hand pay',
    cta: 'See my in-hand'
  },

  '/india/emi-calculator/': {
    persona: 'Home and car loan borrowers',
    hook: '₹50 lakh loan. ₹5,000 extra a month saves ₹13.9 lakh.',
    pain: 'The bank shows your EMI. It never shows what a small monthly prepayment would save you.',
    usual: ['Bank calculators that stop at the EMI', 'Amortisation tables built by hand', 'Guessing if prepaying is worth it'],
    promise: 'Enter loan, rate and tenure, add a prepayment. See interest saved.',
    steps: ['Enter amount, rate, tenure', 'Add an extra monthly payment', 'See interest and months saved'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { amount: 5000000, rate: 8.5, years: 20, prepay: 5000 } },
    howTo: 'How to see what loan prepayments save, free',
    cta: 'Check my EMI'
  },

  '/india/advance-tax/': {
    persona: 'Freelancers and professionals',
    hook: 'Freelancing this year? 15 June is your first tax date.',
    pain: 'Nobody deducts tax from client income. Miss the quarterly dates and 234B and 234C interest adds up.',
    usual: ['Remembering four due dates alone', 'Working out cumulative percentages', 'Meeting 234C interest at filing time'],
    promise: 'Enter your tax estimate and TDS. Get all four instalments and dates.',
    steps: ['Estimate your annual tax', 'Enter TDS and tax paid so far', 'Pay each instalment shown'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { taxLiability: 180000, tdsPaid: 30000, paidSoFar: 0 } },
    howTo: 'How to work out advance tax instalments',
    cta: 'Plan my instalments'
  }
};
