/**
 * The reading part of the India calculators, rendered by build-depth.js.
 * Shape and rules: build-depth.js and build/content/_check.js. Statutory
 * figures are the engine's own constants for FY 2026-27; every number is
 * computed with the page's own engine and listed in worked.check / checks.
 */
'use strict';

module.exports = {
  '/india/emi-calculator/': {
    term: 'EMI',
    whatIs: [
      'An EMI, or equated monthly instalment, is the fixed sum a borrower pays the lender every month until a loan is cleared. Each one pays that month’s interest on the balance first; the rest reduces the principal.',
      'Because the balance is largest at the start, early EMIs are mostly interest and later ones mostly principal, even though the amount never changes.'
    ],
    formula: {
      text: 'The formula finds the one fixed payment that, with interest added every month, leaves exactly zero after the last instalment. The yearly rate becomes a monthly one and the tenure becomes months first.',
      expr: ['EMI = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1)', 'r = annual rate ÷ 12 ÷ 100        n = years × 12'],
      vars: [['P', 'the loan amount (principal)'], ['r', 'the monthly interest rate, as a decimal'], ['n', 'the number of monthly instalments']]
    },
    worked: {
      inputs: { amount: 2500000, rate: 9, years: 15, prepay: 0 },
      text: 'Take a ₹25 lakh loan at 9% a year over 15 years. The EMI comes to ₹25,357, and across 180 instalments you repay ₹45,64,200, so ₹20,64,200 of it is interest: 82.568% of the amount borrowed. The schedule shows how front-loaded that is. Of the ₹3,04,280 paid in the first year, ₹2,21,647 goes on interest and only ₹82,633 reduces the loan.',
      check: [['emi', '₹25,357'], ['totalPaid', '₹45,64,200'], ['totalInterest', '₹20,64,200'], ['interestRatio', '82.568%'], ['_table.rows.0.2', '₹2,21,647'], ['_table.rows.0.1', '₹82,633']]
    },
    uses: [
      ['Choosing a tenure', 'Compare a 15-year and a 20-year term on both the instalment and the total interest before signing.'],
      ['Checking a sanction letter', 'Confirm the EMI a bank quotes matches the rate and tenure written on the letter.'],
      ['Planning prepayments', 'Add a fixed extra sum each month and see how many months and how much interest it removes.']
    ],
    mistakes: [
      'Comparing loans by EMI alone. A longer tenure lowers the instalment but raises the total interest, so compare the total repayment too.',
      'Entering a flat rate. Some car and consumer loans advertise a flat rate charged on the original amount; the reducing-balance rate this calculator needs is noticeably higher.',
      'Ignoring processing fees and loan insurance: neither is in the EMI, but both add to the cost.'
    ],
    faq: [
      { q: 'How is EMI calculated on a home loan?', a: 'With the reducing-balance formula above, on the outstanding balance each month. ₹40 lakh at 8.75% over 25 years works out at ₹32,886 a month.' },
      { q: 'Does a lower EMI mean a cheaper loan?', a: 'Usually the opposite. Stretching ₹25 lakh at 9% from 15 to 20 years cuts the EMI from ₹25,357 to ₹22,493, but the total interest rises from ₹20,64,200 to ₹28,98,356.' },
      { q: 'Can my EMI change during the loan?', a: 'On a floating-rate loan, yes. When the lender’s benchmark rate moves, the bank either changes the EMI or, more often, keeps it and lengthens or shortens the tenure. A fixed-rate loan keeps the same instalment throughout.' },
      { q: 'What happens if I miss an EMI?', a: 'The lender adds a late fee and interest on the overdue sum, and reports the miss to credit bureaus such as CIBIL, which lowers your score. Talk to the lender before the due date.' }
    ],
    checks: [
      { inputs: { amount: 4000000, rate: 8.75, years: 25, prepay: 0 }, key: 'emi', shown: '₹32,886' },
      { inputs: { amount: 2500000, rate: 9, years: 20, prepay: 0 }, key: 'emi', shown: '₹22,493' },
      { inputs: { amount: 2500000, rate: 9, years: 20, prepay: 0 }, key: 'totalInterest', shown: '₹28,98,356' }
    ]
  },

  '/india/advance-tax/': {
    term: 'advance tax',
    whatIs: [
      'Advance tax is income tax paid in four instalments during the year the income is earned, instead of in one sum when the return is filed. It mainly concerns freelancers, consultants, landlords and investors, whose income has little or no tax deducted from it.',
      'For FY 2026-27 the due dates are 15 June, 15 September and 15 December 2026, and 15 March 2027. Each date has a cumulative target, so a late start is caught up by paying more at the next one.'
    ],
    formula: {
      text: 'The tool takes TDS and TCS off your estimated tax for the year, then applies the share that must be paid by each date. Each instalment is that cumulative target less what the earlier dates already required.',
      expr: [
        'net liability = estimated tax − TDS − TCS',
        'paid by each date = net liability × 15%, 45%, 75%, 100%',
        'instalment = net liability × (this date’s % − previous date’s %)',
        'still to pay = net liability − advance tax already paid'
      ],
      vars: [['estimated tax', 'the whole year’s tax, including surcharge and the 4% cess'], ['TDS / TCS', 'tax others have deducted or collected']]
    },
    worked: {
      inputs: { taxLiability: 320000, tdsPaid: 80000, paidSoFar: 36000 },
      text: 'Suppose a consultant expects ₹3,20,000 of tax for FY 2026-27 and clients will deduct ₹80,000 as TDS. The net liability is ₹2,40,000. The instalments are ₹36,000 by 15 June, ₹72,000 by 15 September, ₹72,000 by 15 December and ₹60,000 by 15 March, so ₹1,80,000 should be paid by mid-December. With the June instalment already paid, ₹2,04,000 is still to pay.',
      check: [['netLiability', '₹2,40,000'], ['q1', '₹36,000'], ['q2', '₹72,000'], ['q4', '₹60,000'], ['_table.rows.2.3', '₹1,80,000'], ['outstanding', '₹2,04,000']]
    },
    uses: [
      ['Fees with partial TDS', 'Set aside each quarter’s share of tax on client income where the TDS covers only part of the bill.'],
      ['Rent or interest on top of a salary', 'Find out whether the TDS your employer deducts leaves a gap that needs advance tax.'],
      ['Revising mid-year', 'Re-run with a higher estimate before 15 December and pay the catch-up in that instalment.']
    ],
    mistakes: [
      'Entering tax before cess. The 4% health and education cess and any surcharge are part of the liability; leave them out and every instalment falls short.',
      'Splitting the bill into four equal quarters. The dates call for 15%, then 30%, 30% and 25%, so June is the smallest payment and September and December the largest.',
      'Counting TDS that no client has actually deposited. Check your Annual Information Statement first.'
    ],
    faq: [
      { q: 'Do salaried employees have to pay advance tax?', a: 'Usually not on the salary itself, because the employer deducts TDS through the year. It becomes due when other income, such as rent, interest or capital gains, leaves ₹10,000 or more uncovered.' },
      { q: 'What happens if my net tax is below ₹10,000?', a: 'You pay it as self-assessment tax before filing the return. A ₹60,000 liability with ₹52,000 already deducted leaves ₹8,000, and the tool reports no advance tax due.' },
      { q: 'How do I pay advance tax online?', a: 'Through e-Pay Tax on the income-tax e-filing portal, choosing advance tax as the type of payment and the correct year. Keep the challan details: the return asks for them.' }
    ],
    checks: [
      { inputs: { taxLiability: 60000, tdsPaid: 52000, paidSoFar: 0 }, key: 'netLiability', shown: '₹8,000' },
      { inputs: { taxLiability: 60000, tdsPaid: 52000, paidSoFar: 0 }, key: 'liable', shown: 'no advance tax due' }
    ]
  },

  '/india/ctc-take-home/': {
    term: 'CTC',
    whatIs: [
      'CTC, or cost to company, is everything an employer spends on you in a year: salary, its own PF contribution, the gratuity it sets aside and sometimes insurance or bonuses. In-hand pay is what reaches your bank after your own deductions.',
      'The gap between the two depends mostly on how large basic pay is, because PF and gratuity are both worked out on basic, and on which tax regime you choose for FY 2026-27.'
    ],
    formula: {
      text: 'The tool first removes what the employer keeps: its 12% PF, on PF wages capped at ₹15,000 a month, and a yearly gratuity accrual. What remains is gross salary; your PF, professional tax and income tax come off that.',
      expr: [
        'basic = CTC × basic %',
        'PF wage = lower of basic and ₹1,80,000 a year',
        'gross = CTC − 12% × PF wage − basic × 15/26 ÷ 12',
        'in-hand = gross − 12% × PF wage − professional tax − income tax'
      ],
      vars: [['basic %', 'basic pay as a share of CTC'], ['15/26 ÷ 12', 'a year’s gratuity accrual, about 4.81% of annual basic'], ['income tax', 'slab tax on gross less the standard deduction, after the rebate, plus 4% cess']]
    },
    worked: {
      inputs: { ctc: 1800000, basicPct: 50, regime: 'new', deductions: 0, ptax: 2500 },
      text: 'Take an ₹18 lakh CTC with basic at 50%, the new regime and ₹2,500 of professional tax. Basic is ₹9,00,000. Employer PF stops at ₹21,600 because of the wage cap, and the gratuity accrual is ₹43,269, leaving a gross salary of ₹17,35,131. After your own PF, the professional tax and ₹1,37,307 of income tax, you keep ₹15,73,724 a year, or ₹1,31,144 a month.',
      check: [['basic', '₹9,00,000'], ['gratuityAccrual', '₹43,269'], ['gross', '₹17,35,131'], ['tax', '₹1,37,307'], ['annualInHand', '₹15,73,724'], ['monthly', '₹1,31,144']]
    },
    uses: [
      ['Comparing two offers', 'Enter each CTC with its own basic % and compare the monthly in-hand, not the headline figure.'],
      ['Choosing a regime at joining', 'Run both regimes with your expected deductions before declaring one to payroll.'],
      ['Budgeting a first salary', 'Plan rent and loan instalments on the monthly figure rather than the annual package.']
    ],
    mistakes: [
      'Assuming your employer caps PF the way the tool does. It limits PF wages to ₹15,000 a month; if your employer contributes on full basic, both PF lines are larger and in-hand is smaller.',
      'Counting HRA exemption or 80C under the new regime. The tool uses the deductions box only when the old regime is selected, and gives the new regime just its ₹75,000 standard deduction.'
    ],
    faq: [
      { q: 'Is the new or old regime better on an ₹18 lakh CTC?', a: 'With 50% basic, ₹2,500 professional tax and ₹2 lakh of old-regime deductions, the new regime leaves ₹1,31,144 a month and the old regime ₹1,20,222.' },
      { q: 'What is the in-hand salary on a ₹15 lakh CTC?', a: 'With basic at 40%, ₹2,400 professional tax and the new regime, about ₹1,11,327 a month. Income tax takes ₹89,630 of it for the year, because taxable income passes the ₹12 lakh rebate limit.' },
      { q: 'Why does my payslip differ from this figure?', a: 'Payslips split gross into HRA and allowances, and TDS is spread from a projection of your yearly income. Months with arrears or a bonus will differ.' }
    ],
    checks: [
      { inputs: { ctc: 1800000, basicPct: 50, regime: 'old', deductions: 200000, ptax: 2500 }, key: 'monthly', shown: '₹1,20,222' },
      { inputs: { ctc: 1500000, basicPct: 40, regime: 'new', deductions: 0, ptax: 2400 }, key: 'monthly', shown: '₹1,11,327' },
      { inputs: { ctc: 1500000, basicPct: 40, regime: 'new', deductions: 0, ptax: 2400 }, key: 'tax', shown: '₹89,630' }
    ],
    related: { guides: ['/guides/run-payroll-india/'] }
  },

  '/india/epf-calculator/': {
    term: 'EPF',
    whatIs: [
      'The Employees’ Provident Fund is a retirement account run by EPFO. You and your employer each pay 12% of basic pay plus dearness allowance into it every month, and EPFO credits interest at a rate it declares each year.',
      'Not all of the employer’s share stays in EPF: part funds the Employees’ Pension Scheme, so the balance you can withdraw grows more slowly than 24% of basic would suggest.'
    ],
    formula: {
      text: 'Each month the tool adds your 12% and the employer’s 12% less the EPS share, then grows the balance by one twelfth of the annual rate. Basic rises by the growth rate once a year, at the start of each new year of service.',
      expr: [
        'EPS = 8.33% × lower of basic and ₹15,000',
        'monthly credit = 12% × basic + (12% × basic − EPS)',
        'balance = (balance + monthly credit) × (1 + rate ÷ 12)',
        'next year’s basic = basic × (1 + growth)'
      ],
      vars: [['basic', 'monthly basic pay plus dearness allowance'], ['EPS', 'the employer’s monthly pension contribution, at most ₹1,249.50'], ['rate', 'the EPF interest rate, as a decimal']]
    },
    worked: {
      inputs: { basic: 25000, age: 35, retire: 58, rate: 8.25, growth: 6, existing: 300000 },
      text: 'A 35-year-old on ₹25,000 basic, with ₹3,00,000 already in EPF, 6% yearly rises and 8.25% interest, has 23 years to go. In the first month ₹3,000 comes from their pay, ₹1,249.50 of the employer’s share goes to EPS and ₹1,750.50 reaches EPF. By 58 they will have paid in ₹16,91,850 and the employer ₹13,46,988, with ₹3,44,862 diverted to pension. Interest of ₹58,44,272 takes the corpus to ₹91,83,109.',
      check: [['years', '23 years'], ['employeeTotal', '₹16,91,850'], ['employerEPF', '₹13,46,988'], ['epsTotal', '₹3,44,862'], ['interest', '₹58,44,272'], ['corpus', '₹91,83,109']]
    },
    uses: [
      ['Retirement planning', 'See how much of a retirement target EPF alone will cover, and how much must come from elsewhere.'],
      ['Testing a lower rate', 'Re-run at 7.5% or 8% to see how sensitive the corpus is to EPFO’s yearly declaration.'],
      ['Deciding whether to withdraw', 'Compare the balance today with what it becomes if left until retirement.']
    ],
    mistakes: [
      'Entering gross pay or CTC instead of basic plus DA. Contributions are worked on basic and DA only, so a gross figure inflates every line of the projection.',
      'Reading the corpus as today’s money. A sum 23 years away buys far less than the same sum now, so compare it with a retirement target that also allows for inflation.'
    ],
    faq: [
      { q: 'How much does the EPF projection fall if the interest rate drops?', a: 'More than people expect over long periods. In the example above, cutting the rate from 8.25% to 7.5% lowers the corpus from ₹91,83,109 to ₹82,49,912, with contributions unchanged.' },
      { q: 'How much does the employer put in EPF on a ₹12,000 basic?', a: 'Only 3.67% of basic, ₹440.40 a month, because 8.33% (₹999.60) goes to EPS. Over 33 years from age 25 with no rises, that employer share totals ₹1,74,398, while your own contributions reach ₹5,70,240.' },
      { q: 'Does the EPF passbook show the pension part?', a: 'Yes. It lists the employee share, the employer share and the pension contribution in separate columns. Only the first two earn EPF interest and make up the balance you can withdraw.' }
    ],
    checks: [
      { inputs: { basic: 25000, age: 35, retire: 58, rate: 7.5, growth: 6, existing: 300000 }, key: 'corpus', shown: '₹82,49,912' },
      { inputs: { basic: 12000, age: 25, retire: 58, rate: 8.25, growth: 0, existing: 0 }, key: 'employerEPF', shown: '₹1,74,398' },
      { inputs: { basic: 12000, age: 25, retire: 58, rate: 8.25, growth: 0, existing: 0 }, key: 'employeeTotal', shown: '₹5,70,240' }
    ],
    related: { guides: ['/guides/run-payroll-india/'] }
  },

  '/india/gratuity-calculator/': {
    term: 'gratuity',
    whatIs: [
      'Gratuity is a lump sum an employer pays when you leave after long service, in recognition of the years worked. It is owed by employers with ten or more employees, normally once you have completed five years of continuous service.',
      'It is paid on top of your final salary and any leave encashment. The employer funds it, often through a group gratuity policy, so no employee contribution comes out of your pay.'
    ],
    formula: {
      text: 'For a covered employer the tool pays 15 days’ wages for each year, valuing a day at one twenty-sixth of monthly basic plus DA. Where the employer is not covered, it uses half a month’s salary for each year and counts only completed years.',
      expr: [
        'covered: gratuity = (basic + DA) × 15 ÷ 26 × years, rounded to the nearest whole year',
        'not covered: gratuity = (basic + DA) × 15 ÷ 30 × completed years',
        'tax-free = lower of gratuity and ₹20,00,000'
      ],
      vars: [['basic + DA', 'last drawn monthly basic pay plus dearness allowance'], ['years', 'continuous service, where a final part-year of more than six months counts as a year']]
    },
    worked: {
      inputs: { salary: 85000, years: 12.6, covered: 'yes' },
      text: 'Someone leaving after 12.6 years on a last basic plus DA of ₹85,000 has 13 years counted, because the final part-year is over six months. Gratuity is ₹85,000 × 15 ÷ 26 × 13 = ₹6,37,500, all of it within the ₹20 lakh exemption. Had they left at 12.4 years, only 12 would count and the figure would be ₹5,88,462: ₹49,038 less.',
      check: [['yearsCounted', '13 years'], ['gratuity', '₹6,37,500'], ['exempt', '₹6,37,500']]
    },
    uses: [
      ['Checking a full and final settlement', 'Compare the gratuity line in HR’s statement with your own figure before signing it.'],
      ['Timing a resignation', 'See whether a few more weeks of service take the final part-year past six months.'],
      ['Employer provisioning', 'Estimate the liability for a long-serving employee at today’s salary.']
    ],
    mistakes: [
      'Using the salary from the offer letter rather than the last payslip. Gratuity runs on the last drawn basic plus DA, so every increment during service raises the whole amount.',
      'Using the 15/26 formula for an employer outside the gratuity law. There, the tax exemption uses half a month’s average salary over the last ten months for each completed year; the "No" option applies it to the salary you enter.'
    ],
    faq: [
      { q: 'Is gratuity taxable?', a: 'For FY 2026-27 the tool treats gratuity up to ₹20 lakh as exempt and the excess as salary taxed at your slab rate. A ₹3,00,000 basic over 25 years gives ₹43,26,923, of which ₹23,26,923 is taxable. Government employees’ gratuity is fully exempt.' },
      { q: 'How much gratuity is due for 10 years of service?', a: 'About 5.77 months of last basic plus DA, since 15 × 10 ÷ 26 is 150 ÷ 26. On ₹60,000 that is ₹3,46,154.' },
      { q: 'How is gratuity worked out if my employer is not covered?', a: 'Choose "No" and the tool pays half a month’s salary for each completed year. On ₹40,000 after 8.9 years that is ₹1,60,000, against ₹2,07,692 for a covered employer, because only 8 years count instead of 9.' }    ],
    checks: [
      { inputs: { salary: 85000, years: 12.4, covered: 'yes' }, key: 'gratuity', shown: '₹5,88,462' },
      { inputs: { salary: 300000, years: 25, covered: 'yes' }, key: 'gratuity', shown: '₹43,26,923' },
      { inputs: { salary: 300000, years: 25, covered: 'yes' }, key: 'taxable', shown: '₹23,26,923' },
      { inputs: { salary: 60000, years: 10, covered: 'yes' }, key: 'gratuity', shown: '₹3,46,154' },
      { inputs: { salary: 40000, years: 8.9, covered: 'no' }, key: 'gratuity', shown: '₹1,60,000' },
      { inputs: { salary: 40000, years: 8.9, covered: 'yes' }, key: 'gratuity', shown: '₹2,07,692' }
    ],
    related: { guides: ['/guides/run-payroll-india/'] }
  },

  '/india/hra-exemption/': {
    term: 'HRA exemption',
    whatIs: [
      'House rent allowance is the part of salary an employer pays towards your rent. If you live in rented accommodation, part or all of it can be left out of taxable salary, and whatever is not exempt is taxed with the rest of your pay.',
      'For FY 2026-27 it is claimed through payroll or in the return, and only by those who have opted for the old regime.'
    ],
    formula: {
      text: 'Three amounts are compared and the smallest is exempt: the HRA actually received, rent paid less a tenth of salary, and half of salary in a metro or 40% elsewhere. Salary here is basic plus DA for the same period as the rent.',
      expr: [
        'exempt HRA = lowest of A, B and C',
        'A = HRA received',
        'B = rent paid − 10% × (basic + DA)',
        'C = 50% × (basic + DA) in a metro, 40% elsewhere',
        'taxable HRA = A − exempt HRA'
      ],
      vars: [['basic + DA', 'basic pay plus dearness allowance, without HRA or other allowances'], ['rent paid', 'rent for the same months in which HRA was received']]
    },
    worked: {
      inputs: { basic: 480000, hra: 192000, rent: 216000, metro: 'non' },
      text: 'Take basic of ₹4,80,000 a year, HRA of ₹1,92,000 and rent of ₹18,000 a month in a non-metro city. Test A is ₹1,92,000. Test B is ₹2,16,000 − ₹48,000 = ₹1,68,000. Test C, 40% of salary, is again ₹1,92,000. B is the lowest, so ₹1,68,000 is exempt and ₹24,000 is taxed. Moving the same job to a metro raises test C to ₹2,40,000 but changes nothing, because the rent test still binds.',
      check: [['t1', '₹1,92,000'], ['t2', '₹1,68,000'], ['exempt', '₹1,68,000'], ['taxable', '₹24,000'], ['t3', '₹1,92,000']]
    },
    uses: [
      ['Declaring rent to payroll', 'Work out the exemption before the employer’s proof deadline so monthly TDS is right from the start.'],
      ['Comparing regimes', 'Carry the exempt HRA into the income tax comparison as an old-regime deduction.'],
      ['Weighing a transfer', 'Compare the exemption in a metro and a non-metro posting on the same salary.']
    ],
    mistakes: [
      'Assuming more rent always means more exemption. Once rent less 10% of salary exceeds the HRA received or the 40% or 50% cap, extra rent saves nothing.',
      'Mixing monthly and annual figures. All three amounts must cover the same period, and the tool expects annual ones.'
    ],
    faq: [
      { q: 'What if my rent is less than 10% of my salary?', a: 'Then test B is zero and nothing is exempt. On ₹6,00,000 basic, ₹50,000 a year of rent is below the ₹60,000 that the 10% takes off, so all ₹2,40,000 of HRA is taxable.' },
      { q: 'Why is part of my HRA taxable even though my rent is high?', a: 'Because test C caps it. In a non-metro, ₹6,00,000 basic limits the exemption to ₹2,40,000 however much rent you pay, so with ₹3,00,000 of HRA and ₹4,20,000 of rent, ₹60,000 of the HRA stays taxable.' },
      { q: 'Can I claim HRA for part of the year?', a: 'Yes. If you rented only from July, enter the HRA, basic and rent for those nine months alone, so that all three tests cover the same period.' }    ],
    checks: [
      { inputs: { basic: 480000, hra: 192000, rent: 216000, metro: 'metro' }, key: 't3', shown: '₹2,40,000' },
      { inputs: { basic: 600000, hra: 240000, rent: 50000, metro: 'metro' }, key: 'taxable', shown: '₹2,40,000' },
      { inputs: { basic: 600000, hra: 300000, rent: 420000, metro: 'non' }, key: 'exempt', shown: '₹2,40,000' },
      { inputs: { basic: 600000, hra: 300000, rent: 420000, metro: 'non' }, key: 'taxable', shown: '₹60,000' }
    ]
  },

  '/india/india-capital-gains/': {
    term: 'capital gains tax',
    whatIs: [
      'Capital gains tax is charged on the profit from selling a capital asset such as shares, mutual fund units, property or gold.',
      'The rate depends on how long you held the asset. For FY 2026-27 the tool treats listed equity as long term after more than 12 months, and property, gold and unlisted shares after more than 24; debt funds bought after April 2023 never qualify.'
    ],
    formula: {
      text: 'The gain is worked out first, and the ₹1.25 lakh exemption comes off long-term gains on listed equity only. The rate is a flat 12.5% or 20%, or your slab rate, and 4% cess is added; surcharge is not included.',
      expr: [
        'gain = sale value − purchase cost − transfer expenses',
        'taxable gain = gain − ₹1,25,000 (long-term listed equity), otherwise the whole gain',
        'tax = taxable gain × rate × 1.04'
      ],
      vars: [['rate', '12.5% long term; 20% for listed equity held 12 months or less; otherwise your slab rate'], ['1.04', 'adds the 4% health and education cess']]
    },
    worked: {
      inputs: { asset: 'property', sale: 9500000, cost: 6000000, expenses: 150000, months: 40, slabRate: 30 },
      text: 'A flat bought for ₹60 lakh is sold after 40 months for ₹95 lakh, with ₹1,50,000 of brokerage and legal costs. The gain is ₹33,50,000 and, being long term, it is taxed at 12.5% with no indexation and no exemption: ₹4,35,500 including ₹16,750 of cess. The seller keeps ₹89,14,500. Sold at 20 months instead, the same gain would be short term at a 30% slab rate, and the bill would rise to ₹10,45,200.',
      check: [['gain', '₹33,50,000'], ['tax', '₹4,35,500'], ['cess', '₹16,750'], ['netProceeds', '₹89,14,500']]
    },
    uses: [
      ['Timing a share sale', 'See what waiting past the 12-month mark saves before you sell.'],
      ['Pricing a property sale', 'Know the tax and the net proceeds before agreeing a price or planning a reinvestment.'],
      ['Setting money aside for advance tax', 'A large gain made mid-year can bring advance tax due; size it here first.']
    ],
    mistakes: [
      'Taking the ₹1.25 lakh off every sale. It is one allowance for all listed equity gains in the year, while the tool deducts it from the single gain you enter.',
      'Treating exactly 12 months as long term. Listed equity must be held for more than 12 months, so the tool counts a 12-month holding as short term.'
    ],
    faq: [
      { q: 'How much tax is due on ₹1 lakh of long-term equity gains?', a: 'None. A ₹1,00,000 long-term gain on listed shares sits within the ₹1.25 lakh exemption, so the tool shows tax of ₹0.' },
      { q: 'Is it worth holding shares past 12 months?', a: 'Often. Selling shares bought for ₹3 lakh at ₹5 lakh after 11 months costs ₹41,600 at the 20% short-term rate. Hold three more months and the tax falls to ₹9,750, because the gain becomes long term and the first ₹1.25 lakh is exempt.' },
      { q: 'Does the figure include surcharge?', a: 'No, only the 4% cess. Gains large enough to push total income into surcharge will cost more than the amount shown.' }    ],
    checks: [
      { inputs: { asset: 'property', sale: 9500000, cost: 6000000, expenses: 150000, months: 20, slabRate: 30 }, key: 'tax', shown: '₹10,45,200' },
      { inputs: { asset: 'equity', sale: 400000, cost: 300000, expenses: 0, months: 20, slabRate: 30 }, key: 'tax', shown: '₹0' },
      { inputs: { asset: 'equity', sale: 500000, cost: 300000, expenses: 0, months: 11, slabRate: 30 }, key: 'tax', shown: '₹41,600' },
      { inputs: { asset: 'equity', sale: 500000, cost: 300000, expenses: 0, months: 14, slabRate: 30 }, key: 'tax', shown: '₹9,750' }
    ]
  },

  '/india/india-income-tax/': {
    whatTitle: 'What are the new and old tax regimes?',
    whatIs: [
      'Individuals in India choose each year between two ways of working out income tax. The new regime has lower rates and few deductions; the old regime has higher rates but allows 80C, 80D, HRA and home-loan interest.',
      'For FY 2026-27 the new regime charges nothing on the first ₹4 lakh of taxable income and rises in 5% steps to 30% above ₹24 lakh, with a ₹75,000 standard deduction for salaried taxpayers and pensioners.'
    ],
    formula: {
      text: 'Each regime is run separately: deductions, then slabs, the rebate, marginal relief and surcharge, and finally 4% cess on the total.',
      expr: [
        'taxable = gross − standard deduction − old-regime deductions',
        'slab tax = Σ (income in each slab × that slab’s rate)',
        'new regime: taxable ≤ ₹12,00,000 → no tax;  above it, tax ≤ taxable − ₹12,00,000',
        'total = (tax + surcharge) × 1.04'
      ],
      vars: [['standard deduction', '₹75,000 new, ₹50,000 old, for salaried taxpayers and pensioners only'], ['surcharge', 'starts at 10% of tax once taxable income passes ₹50 lakh'], ['1.04', 'applies the 4% health and education cess']]
    },
    worked: {
      inputs: { gross: 1300000, fy: '2026-27', type: 'salaried', age: 'below60', deductions: 250000 },
      text: 'Take a salary of ₹13 lakh for FY 2026-27 with ₹2.5 lakh of old-regime deductions. Under the new regime taxable income is ₹12,25,000 and the slab tax ₹63,750, but marginal relief caps the tax at the ₹25,000 by which income exceeds ₹12 lakh, a relief of ₹38,750. With cess the bill is ₹26,000. Under the old regime taxable income is ₹10,00,000 and tax ₹1,17,000, so the new regime saves ₹91,000.',
      check: [['newTaxable', '₹12,25,000'], ['_table.rows.3.1', '₹63,750'], ['newRelief', '₹38,750'], ['newTotal', '₹26,000'], ['oldTotal', '₹1,17,000'], ['saving', '₹91,000']]
    },
    uses: [
      ['Declaring a regime to your employer', 'Pick the regime that sets your monthly TDS at the start of the year.'],
      ['Testing a raise near ₹12 lakh', 'See how marginal relief softens the step just above the rebate limit.'],
      ['Pensioners over 60', 'Weigh the old regime’s higher exemption limit for seniors against the new regime’s rebate.']
    ],
    mistakes: [
      'Leaving the taxpayer type on salaried for professional fees. Without a salary there is no standard deduction, and ₹13 lakh of fees costs ₹78,000 under the new regime, not ₹26,000.',
      'Counting deductions you have not yet made. Enter only the investments and premiums you will actually pay by 31 March, or the old regime looks cheaper than it will be.'
    ],
    faq: [
      { q: 'Can the old regime still come out cheaper?', a: 'Yes, with large deductions. On a ₹24 lakh salary with ₹8 lakh of deductions, the old regime costs ₹2,88,600 and the new ₹2,92,500, a saving of ₹3,900.' },
      { q: 'How is tax worked out for senior citizens?', a: 'In the old regime the tax-free slab rises to ₹3 lakh at 60 and ₹5 lakh at 80; the new regime has no age-based slabs. A 65-year-old with ₹9 lakh of pension and ₹2 lakh of deductions pays nothing under the new regime, thanks to the rebate, against ₹41,600 under the old.' },
      { q: 'When does surcharge apply?', a: 'Once taxable income passes ₹50 lakh. On a ₹60 lakh salary the new regime adds ₹1,35,750 of surcharge, for a total of ₹15,52,980. The tool does not apply marginal relief on surcharge, so check incomes just above ₹50 lakh with a CA.' }    ],
    checks: [
      { inputs: { gross: 1300000, fy: '2026-27', type: 'other', age: 'below60', deductions: 250000 }, key: 'newTotal', shown: '₹78,000' },
      { inputs: { gross: 2400000, fy: '2026-27', type: 'salaried', age: 'below60', deductions: 800000 }, key: 'oldTotal', shown: '₹2,88,600' },
      { inputs: { gross: 2400000, fy: '2026-27', type: 'salaried', age: 'below60', deductions: 800000 }, key: 'newTotal', shown: '₹2,92,500' },
      { inputs: { gross: 2400000, fy: '2026-27', type: 'salaried', age: 'below60', deductions: 800000 }, key: 'saving', shown: '₹3,900' },
      { inputs: { gross: 900000, fy: '2026-27', type: 'salaried', age: 'senior', deductions: 200000 }, key: 'oldTotal', shown: '₹41,600' },
      { inputs: { gross: 6000000, fy: '2026-27', type: 'salaried', age: 'below60', deductions: 0 }, key: 'newSurcharge', shown: '₹1,35,750' },
      { inputs: { gross: 6000000, fy: '2026-27', type: 'salaried', age: 'below60', deductions: 0 }, key: 'newTotal', shown: '₹15,52,980' }    ]
  },

  '/india/tds-calculator/': {
    term: 'TDS',
    whatIs: [
      'TDS, tax deducted at source, is income tax the payer takes off a payment and deposits with the government on the payee’s behalf. The payee then gets credit for it against their own tax for the year.',
      'Each kind of payment, from contract work to rent and commission, has its own section and rate. For FY 2026-27 the tool covers ten common ones and applies a higher rate where the payee has not given a PAN.'
    ],
    formula: {
      text: 'The tool multiplies the payment by the rate for the chosen section. Without a PAN it applies 20% instead and shows the extra over the normal rate as a separate line.',
      expr: [
        'TDS = payment × section rate ÷ 100',
        'net payable = payment − TDS',
        'without PAN: TDS = payment × 20 ÷ 100',
        'extra for missing PAN = TDS − payment × section rate ÷ 100'
      ],
      vars: [['payment', 'the amount paid or credited to the payee'], ['section rate', 'the rate for that nature of payment, such as 1% or 2% under 194C']]
    },
    worked: {
      inputs: { section: '194C_ind', amount: 250000, pan: 'no' },
      text: 'A ₹2,50,000 bill from an individual contractor normally carries TDS at 1%. If the contractor has not given a PAN the rate becomes 20%: ₹50,000 is withheld, ₹47,500 more than the usual ₹2,500, and they receive ₹2,00,000.',
      check: [['baseRate', '1%'], ['rate', '20%'], ['tds', '₹50,000'], ['uplift', '₹47,500'], ['netPayable', '₹2,00,000']]
    },
    uses: [
      ['Paying a contractor', 'Apply 194C at 1% for an individual or HUF and 2% for a firm or company.'],
      ['Renting an office or equipment', 'Deduct 10% on land and buildings, or 2% on hired plant and machinery.'],
      ['Engaging professionals', 'Separate technical services at 2% from professional fees at 10% under 194J.'],
      ['Checking a client’s deduction', 'As a payee, confirm that the TDS in your Annual Information Statement matches the invoice.']
    ],
    mistakes: [
      'Deducting TDS on the GST as well. Where GST is shown separately on the invoice, deduct on the amount before GST.',
      'Picking professional fees for a technical services contract. Technical services carry 2% and professional fees 10%; on an ₹80,000 invoice that is ₹1,600 against ₹8,000.'
    ],
    faq: [
      { q: 'Who has to deduct TDS?', a: 'Companies, firms and other businesses making the listed payments, and individuals or HUFs whose turnover required a tax audit in the previous year. Other individuals deduct only in specific cases, such as paying rent above a monthly limit.' },
      { q: 'What happens if TDS is deposited late?', a: 'Interest runs for each month or part of a month of delay, and a late quarterly statement adds a fee for every day. Both fall on the deductor, not the payee.' },
      { q: 'Can the payee get excess TDS back?', a: 'Yes, by filing an income tax return. TDS is credited against the year’s tax and any surplus is refunded, so the contractor above recovers whatever part of the ₹50,000 exceeds their actual liability.' },
      { q: 'Does this cover TDS on salary?', a: 'No. Salary TDS is based on the employee’s estimated tax for the year at slab rates, not a flat section rate; the income tax calculator gives that figure.' }
    ],
    checks: [
      { inputs: { section: '194C_ind', amount: 250000, pan: 'yes' }, key: 'tds', shown: '₹2,500' },
      { inputs: { section: '194J_tech', amount: 80000, pan: 'yes' }, key: 'tds', shown: '₹1,600' },
      { inputs: { section: '194J_prof', amount: 80000, pan: 'yes' }, key: 'tds', shown: '₹8,000' }
    ]
  },

  '/india/fd-rd-calculator/': {
    whatTitle: 'What are FDs and RDs?',
    whatIs: [
      'A fixed deposit (FD) locks one lump sum with a bank for a set term at a rate agreed on day one. A recurring deposit (RD) takes the same sum every month, each instalment earning that starting rate until maturity.',
      'Both are quoted as a yearly rate, but interest is added quarterly and taxed at your slab rate, so the headline figure is neither what the deposit grows at nor what you keep.'
    ],
    formula: {
      text: 'An FD compounds the whole deposit four times a year for the full term. An RD treats each instalment as a small FD running from its own date to maturity. Tax is your slab rate on all the interest.',
      expr: [
        'FD maturity = P × (1 + r ÷ 4)^(4t)',
        'RD maturity = Σ R × (1 + r ÷ 4)^(4 × (n − m) ÷ 12), for m = 0 … n − 1',
        'after-tax maturity = maturity − slab rate × interest'
      ],
      vars: [['P', 'the FD amount'], ['R', 'the monthly RD instalment'], ['r', 'the yearly interest rate, as a decimal'], ['t', 'the tenure in years'], ['n', 'the number of monthly instalments, t × 12']]
    },
    worked: {
      inputs: { type: 'rd', amount: 10000, rate: 7.25, years: 3, slabRate: 20 },
      text: 'Put ₹10,000 a month into a 3-year RD at 7.25%, in the 20% slab. Thirty-six instalments add up to ₹3,60,000 and the deposit matures at ₹4,02,948, so the interest is ₹42,948. Tax at 20% takes ₹8,590, leaving ₹3,94,358. The same ₹3,60,000 placed as one FD on day one would have reached ₹4,46,597.',
      check: [['maturity', '₹4,02,948'], ['interest', '₹42,948'], ['tax', '₹8,590'], ['afterTax', '₹3,94,358']]
    },
    uses: [
      ['Comparing a deposit with a debt fund', 'Put the post-tax annualised return next to a fund’s expected return before deciding where idle cash goes.'],
      ['Sizing a monthly saving goal', 'Run an RD to see what a fixed monthly sum reaches by a target date, such as a school fee due in three years.'],
      ['Choosing a tenure', 'Try one, three and five years at the rate the bank offers for each and compare the after-tax maturity.']
    ],
    mistakes: [
      'Reading an RD’s post-tax annualised return as its yield. It treats the whole ₹3,60,000 as deposited on day one, so the RD above shows 3.085%; compare RDs with each other on it, not with an FD.',
      'Using this for a payout FD. A deposit that pays its interest out every quarter does not compound, so its maturity is just the principal; this calculator is for cumulative deposits.'
    ],
    faq: [
      { q: 'What is the effective annual yield of a 7% FD?', a: 'Because interest is added each quarter, ₹1 lakh at 7% grows to ₹1,07,186 in a year before tax, an effective yield of 7.186%. Banks sometimes advertise this higher figure next to the quoted rate.' },
      { q: 'How much does tax take from a five-year FD?', a: 'At 7.5% on ₹10 lakh for five years, the interest is ₹4,49,948. In the 30% slab, ₹1,34,984 of it goes in tax and the post-tax annualised return falls from 7.714% to 5.629%.' },
      { q: 'Is RD interest taxed every year or only at maturity?', a: 'Normally as it accrues, so each year’s accrued interest goes in that year’s return even though the money arrives only at maturity.' }
    ],
    checks: [
      { inputs: { type: 'fd', amount: 360000, rate: 7.25, years: 3, slabRate: 20 }, key: 'maturity', shown: '₹4,46,597' },
      { inputs: { type: 'rd', amount: 10000, rate: 7.25, years: 3, slabRate: 20 }, key: 'effectiveRate', shown: '3.085%' },
      { inputs: { type: 'fd', amount: 100000, rate: 7, years: 1, slabRate: 0 }, key: 'maturity', shown: '₹1,07,186' },
      { inputs: { type: 'fd', amount: 100000, rate: 7, years: 1, slabRate: 0 }, key: 'effectiveRate', shown: '7.186%' },
      { inputs: { type: 'fd', amount: 1000000, rate: 7.5, years: 5, slabRate: 30 }, key: 'interest', shown: '₹4,49,948' },
      { inputs: { type: 'fd', amount: 1000000, rate: 7.5, years: 5, slabRate: 30 }, key: 'tax', shown: '₹1,34,984' },
      { inputs: { type: 'fd', amount: 1000000, rate: 7.5, years: 5, slabRate: 0 }, key: 'effectiveRate', shown: '7.714%' },
      { inputs: { type: 'fd', amount: 1000000, rate: 7.5, years: 5, slabRate: 30 }, key: 'effectiveRate', shown: '5.629%' }
    ]
  },

  '/india/gst-calculator/': {
    term: 'GST',
    whatIs: [
      'Goods and Services Tax (GST) is India’s indirect tax on most supplies. The seller adds it to the taxable value, collects it from the buyer and pays it over after setting off the GST on its own purchases.',
      'The calculator offers the six GST 2.0 slabs in force since 22 September 2025: 0%, 0.25%, 3%, 5%, 18% and 40%.'
    ],
    formula: {
      text: 'Adding GST multiplies the taxable value by the rate. Removing it divides the inclusive price by one plus the rate, since the tax was charged on the taxable value, not the total. Within one state it splits equally into CGST and SGST; between states it is all IGST.',
      expr: [
        'line value = unit amount × quantity',
        'GST = taxable value × rate',
        'taxable value = inclusive amount ÷ (1 + rate)',
        'CGST = SGST = GST ÷ 2 (intra-state)        IGST = GST (inter-state)'
      ],
      vars: [['rate', 'the GST slab as a decimal, e.g. 0.05 for 5%'], ['taxable value', 'the price before GST, shown as taxable on the invoice'], ['inclusive amount', 'a price that already contains GST']]
    },
    worked: {
      inputs: { amount: 2450, mode: 'exclusive', rate: 5, supply: 'inter', qty: 4 },
      text: 'A Pune trader sells 4 units at ₹2,450 each, before GST, to a buyer in Bengaluru at 5%. The taxable value is ₹9,800 and the GST is ₹490; because the goods cross a state border, all of it is IGST. The invoice total is ₹10,290. Had the buyer been in Pune, the same tax would split into CGST ₹245 and SGST ₹245.',
      check: [['base', '₹9,800'], ['gst', '₹490'], ['igst', '₹490'], ['total', '₹10,290']]
    },
    uses: [
      ['Raising a B2B invoice', 'Turn a quoted net price into the taxable value, tax lines and total the invoice needs.'],
      ['Splitting a bill for input tax credit', 'Pull the taxable value and GST out of an inclusive bill before entering it in your books.'],
      ['Pricing to an MRP', 'Work back from the price a customer will pay to the taxable value you keep at each slab.']
    ],
    mistakes: [
      'Charging CGST and SGST on an inter-state sale, or IGST on a local one. Tax paid under the wrong head is not moved across: it is paid again under the right head and the wrong one refunded.',
      'Leaving an old billing template on 12% or 28%. Neither slab exists under GST 2.0, so re-map each item to its current rate before the next invoice goes out.'
    ],
    faq: [
      { q: 'How do I calculate GST on gold jewellery?', a: 'Gold, silver and jewellery are at 3% under GST 2.0. A ₹1,03,000 bill that includes GST has a taxable value of ₹1,00,000 and ₹3,000 of GST, which within one state is ₹1,500 CGST plus ₹1,500 SGST.' },
      { q: 'What does the 40% GST rate cover?', a: 'It is the demerit rate GST 2.0 introduced for luxury and sin goods. On ₹10,000 before tax it adds ₹4,000, an invoice of ₹14,000, split within a state as 20% CGST and 20% SGST of ₹2,000 each.' },
      { q: 'How do I take IGST out of an inclusive price?', a: 'Divide by one plus the rate, as within a state. ₹1,180 inclusive at 18% inter-state is ₹1,000 taxable and ₹180 IGST.' }
    ],
    checks: [
      { inputs: { amount: 2450, mode: 'exclusive', rate: 5, supply: 'intra', qty: 4 }, key: 'cgst', shown: '₹245' },
      { inputs: { amount: 103000, mode: 'inclusive', rate: 3, supply: 'intra', qty: 1 }, key: 'base', shown: '₹1,00,000' },
      { inputs: { amount: 103000, mode: 'inclusive', rate: 3, supply: 'intra', qty: 1 }, key: 'gst', shown: '₹3,000' },
      { inputs: { amount: 103000, mode: 'inclusive', rate: 3, supply: 'intra', qty: 1 }, key: 'cgst', shown: '₹1,500' },
      { inputs: { amount: 10000, mode: 'exclusive', rate: 40, supply: 'intra', qty: 1 }, key: 'gst', shown: '₹4,000' },
      { inputs: { amount: 10000, mode: 'exclusive', rate: 40, supply: 'intra', qty: 1 }, key: 'total', shown: '₹14,000' },
      { inputs: { amount: 10000, mode: 'exclusive', rate: 40, supply: 'intra', qty: 1 }, key: 'cgst', shown: '₹2,000' },
      { inputs: { amount: 1180, mode: 'inclusive', rate: 18, supply: 'inter', qty: 1 }, key: 'base', shown: '₹1,000' },
      { inputs: { amount: 1180, mode: 'inclusive', rate: 18, supply: 'inter', qty: 1 }, key: 'igst', shown: '₹180' }
    ],
    related: { guides: ['/guides/reconcile-gstr-2b/'] }
  },

  '/india/lumpsum-returns/': {
    whatTitle: 'What is a lumpsum investment?',
    whatIs: [
      'A lumpsum investment puts one amount to work on a single day, typically a bonus, a maturing deposit or the proceeds of a sale, and leaves it to compound with no further contributions.',
      'Its outcome depends on the amount, the yearly return and the number of years. Time matters most, because the return compounds on everything earned so far.'
    ],
    formula: {
      text: 'Each year the value is multiplied by one plus the return. To express the result in today’s money it is divided by the same growth at the inflation rate; the real return and the years to double follow from the same two rates.',
      expr: ['FV = P × (1 + r)ⁿ', 'value today = FV ÷ (1 + f)ⁿ', 'real return = (1 + r) ÷ (1 + f) − 1', 'years to double = ln 2 ÷ ln(1 + r)'],
      vars: [['P', 'the amount invested once'], ['r', 'the expected yearly return, as a decimal'], ['f', 'the assumed yearly inflation, as a decimal'], ['n', 'the number of years held']]
    },
    worked: {
      inputs: { principal: 200000, rate: 10, years: 15, inflation: 5 },
      text: '₹2 lakh left for 15 years at 10% a year grows to ₹8,35,450, a gain of ₹6,35,450 and a multiple of 4.177. At 5% inflation that sum buys what ₹4,01,866 buys today, a real return of 4.762% a year. The money doubles roughly every 7.27 years, so over 15 years it doubles just over twice.',
      check: [['fv', '₹8,35,450'], ['gain', '₹6,35,450'], ['multiple', '4.177'], ['real', '₹4,01,866'], ['realRate', '4.762%'], ['doubling', '7.27']]
    },
    uses: [
      ['Placing a bonus or windfall', 'See what a one-off sum could become by a goal date at a cautious and at an optimistic return.'],
      ['Comparing with a deposit', 'Run the same amount at an FD rate and at an equity fund’s assumed return to see what the extra risk buys.'],
      ['Testing a goal in real terms', 'Check whether a corpus that looks large in 20 years will still cover the goal in today’s prices.']
    ],
    mistakes: [
      'Assuming the yearly return arrives every year. An equity fund averaging 12% can lose money in some years, and a fall just before you withdraw hurts a single lump sum more than an investment still being paid into.',
      'Overlooking a return below inflation. At 5% a year with 6% inflation, ₹1 lakh grows to ₹1,62,889 in 10 years but is worth only ₹90,957 in today’s money, a real return of −0.943%.'
    ],
    faq: [
      { q: 'How long does money take to double at 8%?', a: '9.006 years by the exact formula, which is why the rule of 72 (72 ÷ 8 = 9) is a good shortcut. ₹1 lakh at 8% is worth ₹1,99,900 after 9 years.' },
      { q: 'Should I invest a lump sum at once or spread it out?', a: 'At the same return, all at once ends higher, since every rupee compounds for the full period. A systematic transfer plan gives up some growth to avoid buying everything at one price.' },
      { q: 'What return should I assume?', a: 'Test a range rather than one number. ₹1 lakh over 10 years becomes ₹1,96,715 at 7% and ₹3,10,585 at 12%; plan around the lower figure and treat the higher one as a good outcome.' }
    ],
    checks: [
      { inputs: { principal: 100000, rate: 5, years: 10, inflation: 6 }, key: 'fv', shown: '₹1,62,889' },
      { inputs: { principal: 100000, rate: 5, years: 10, inflation: 6 }, key: 'real', shown: '₹90,957' },
      { inputs: { principal: 100000, rate: 5, years: 10, inflation: 6 }, key: 'realRate', shown: '−0.943%' },
      { inputs: { principal: 100000, rate: 8, years: 9, inflation: 6 }, key: 'doubling', shown: '9.006' },
      { inputs: { principal: 100000, rate: 8, years: 9, inflation: 6 }, key: 'fv', shown: '₹1,99,900' },
      { inputs: { principal: 100000, rate: 7, years: 10, inflation: 6 }, key: 'fv', shown: '₹1,96,715' },
      { inputs: { principal: 100000, rate: 12, years: 10, inflation: 6 }, key: 'fv', shown: '₹3,10,585' }
    ]
  },

  '/india/nps-calculator/': {
    term: 'NPS',
    whatIs: [
      'The National Pension System (NPS) is a regulated retirement account: you contribute while working, the money is invested in the equity and bond funds you choose, and it compounds until 60.',
      'At exit the corpus is split in two. One part is paid to you as a lump sum; the other buys an annuity from an insurer, which pays the monthly pension. The calculator holds that annuity share at 40% or more.'
    ],
    formula: {
      text: 'Each monthly contribution, paid at the start of the month, compounds at the expected return divided by 12 until you turn 60. The corpus is split by the annuity share, and the pension is a twelfth of the annuity rate applied to the annuity part.',
      expr: [
        'corpus = C × ((1 + i)ⁿ − 1) ÷ i × (1 + i)',
        'i = annual return ÷ 12 ÷ 100        n = (60 − age) × 12',
        'annuity = corpus × a        lump sum = corpus − annuity',
        'monthly pension = annuity × annuity rate ÷ 12'
      ],
      vars: [['C', 'the monthly contribution'], ['i', 'the monthly return, as a decimal'], ['n', 'the months left until 60'], ['a', 'the share used to buy the annuity, 40% to 100%']]
    },
    worked: {
      inputs: { monthly: 8000, age: 35, rate: 9, annuityPct: 50, annuityRate: 6.5 },
      text: 'A 35-year-old puts ₹8,000 a month into NPS at an expected 9%. Over 25 years that is ₹24,00,000 of contributions and a corpus of ₹90,36,243 at 60. Annuitising half leaves a lump sum of ₹45,18,121, and the other half at 6.5% pays ₹24,473 a month. Keeping the annuity at 40% instead raises the lump sum to ₹54,21,746 but cuts the pension to ₹19,579.',
      check: [['invested', '₹24,00,000'], ['corpus', '₹90,36,243'], ['lumpsum', '₹45,18,121'], ['pension', '₹24,473']]
    },
    uses: [
      ['Setting a contribution', 'Work out the monthly amount that produces the pension you want at 60.'],
      ['Choosing the annuity share', 'See how each extra 10% put into the annuity trades lump sum for monthly income.'],
      ['Weighing a late start', 'Compare the corpus from starting now with starting five or ten years later.']
    ],
    mistakes: [
      'Treating the projected pension as today’s money. Compare ₹24,473 a month in 25 years with your expenses grown at inflation.',
      'Entering an equity-like return for the whole period. If your mix shifts towards bonds near 60, the later years earn less; run a lower rate too.',
      'Forgetting that a standard annuity pays a level amount for life, so its buying power falls every year.'
    ],
    faq: [
      { q: 'How much difference does starting NPS at 25 make?', a: 'At ₹10,000 a month and 10%, starting at 25 builds ₹3,82,82,767 by 60, against ₹1,33,78,903 if you start at 35. The extra ten years cost ₹12 lakh and add over ₹2.49 crore.' },
      { q: 'What does a 1% higher annuity rate do to the pension?', a: 'With ₹10,000 a month from age 30 at 10% and 40% annuitised, the pension is ₹45,587 a month at 6% and ₹53,184 at 7%. The insurer sets the rate on the day you buy, so check current quotes as you near 60.' },
      { q: 'Can I use the whole NPS corpus for the annuity?', a: 'Yes, up to 100%. On those inputs the pension rises to ₹1,13,966 a month, with no lump sum.' }
    ],
    checks: [
      { inputs: { monthly: 8000, age: 35, rate: 9, annuityPct: 40, annuityRate: 6.5 }, key: 'lumpsum', shown: '₹54,21,746' },
      { inputs: { monthly: 8000, age: 35, rate: 9, annuityPct: 40, annuityRate: 6.5 }, key: 'pension', shown: '₹19,579' },
      { inputs: { monthly: 10000, age: 25, rate: 10, annuityPct: 40, annuityRate: 6 }, key: 'corpus', shown: '₹3,82,82,767' },
      { inputs: { monthly: 10000, age: 35, rate: 10, annuityPct: 40, annuityRate: 6 }, key: 'corpus', shown: '₹1,33,78,903' },
      { inputs: { monthly: 10000, age: 30, rate: 10, annuityPct: 40, annuityRate: 6 }, key: 'pension', shown: '₹45,587' },
      { inputs: { monthly: 10000, age: 30, rate: 10, annuityPct: 40, annuityRate: 7 }, key: 'pension', shown: '₹53,184' },
      { inputs: { monthly: 10000, age: 30, rate: 10, annuityPct: 100, annuityRate: 6 }, key: 'pension', shown: '₹1,13,966' }    ]
  },

  '/india/ppf-calculator/': {
    term: 'PPF',
    whatIs: [
      'The Public Provident Fund (PPF) is a 15-year savings account backed by the Government of India, opened at a post office or a bank. Its rate is set by the government, not the market, and the balance cannot fall.',
      'Interest is worked out monthly but credited once a year, on 31 March, so the balance grows in yearly steps.'
    ],
    formula: {
      text: 'The calculator assumes each year’s deposit goes in before 5 April, so it earns interest for the whole year. Each year’s interest is the rate applied to the balance including that deposit, and it is added to the balance carried into the next year.',
      expr: ['balanceₖ = (balanceₖ₋₁ + D) × (1 + r)', 'maturity = D × (1 + r) × ((1 + r)ⁿ − 1) ÷ r'],
      vars: [['D', 'the yearly deposit, up to ₹1.5 lakh'], ['r', 'the yearly PPF rate, as a decimal'], ['n', 'the number of years, 15 or more with extensions']]
    },
    worked: {
      inputs: { annual: 60000, rate: 7.1, years: 20 },
      text: 'Deposit ₹60,000 every April at 7.1% and keep paying in through one 5-year extension, 20 years in all. Year 1 earns ₹4,260 of interest. By the end of year 15 the balance is ₹16,27,284; by year 20 it reaches ₹26,63,315 on ₹12,00,000 deposited, so ₹14,63,315 is interest. The five extra years add ₹10,36,031, more than the first fifteen years’ interest of ₹7,27,284.',
      check: [['_table.rows.0.2', '₹4,260'], ['_table.rows.14.3', '₹16,27,284'], ['maturity', '₹26,63,315'], ['invested', '₹12,00,000'], ['interest', '₹14,63,315']]
    },
    uses: [
      ['Planning the safe part of retirement savings', 'See what a steady yearly deposit becomes alongside riskier investments.'],
      ['Deciding whether to extend', 'Compare the balance at 15 years with 20 or 25 years to see what an extension adds.'],
      ['Choosing the yearly amount', 'Try the full ₹1.5 lakh against a smaller sum that leaves room for other goals.']
    ],
    mistakes: [
      'Depositing late in the year and expecting this figure. A deposit made in March earns almost nothing for that year, while the projection assumes every deposit is in by early April.',
      'Letting the account roll on after year 15 and assuming it grows as shown. An extension without contributions only earns interest on the existing balance; to keep paying in you must choose the extension with deposits within a year of maturity.'
    ],
    faq: [
      { q: 'What will ₹1.5 lakh a year in PPF be worth after 25 years?', a: 'At 7.1% throughout, ₹37,50,000 of deposits grows to ₹1,03,08,015, crossing ₹1 crore. That needs two 5-year extensions with deposits after the first 15 years.' },
      { q: 'Is PPF interest compounded annually?', a: 'Yes. Interest builds up month by month on the balance but is added only on 31 March, and from then on it earns interest itself. That is why the yearly interest in the schedule rises even when the deposit stays the same.' },
      { q: 'What is the smallest yearly PPF deposit?', a: 'The calculator accepts from ₹500, the minimum that keeps an account active. ₹12,500 a year, about ₹1,042 a month, builds ₹3,39,017 over 15 years at 7.1%.' }
    ],
    checks: [
      { inputs: { annual: 60000, rate: 7.1, years: 15 }, key: 'interest', shown: '₹7,27,284' },
      { inputs: { annual: 150000, rate: 7.1, years: 25 }, key: 'invested', shown: '₹37,50,000' },
      { inputs: { annual: 150000, rate: 7.1, years: 25 }, key: 'maturity', shown: '₹1,03,08,015' },
      { inputs: { annual: 12500, rate: 7.1, years: 15 }, key: 'maturity', shown: '₹3,39,017' }
    ]
  },

  '/india/sip-calculator/': {
    whatTitle: 'What is a SIP?',
    whatIs: [
      'A systematic investment plan (SIP) invests a fixed sum in a mutual fund on the same date every month, usually by auto-debit. Each instalment buys units at that day’s NAV, so more units are bought when prices are low and fewer when they are high.',
      'A step-up SIP raises the instalment by a set percentage once a year, which lets the saving keep pace with a rising salary.'
    ],
    formula: {
      text: 'The yearly return is divided by 12 to give a monthly one, and each instalment goes in at the start of the month, so it earns that month’s return too. With a step-up, the instalment rises after every twelfth payment.',
      expr: ['FV = P × ((1 + i)ⁿ − 1) ÷ i × (1 + i)', 'i = annual return ÷ 12 ÷ 100        n = years × 12', 'with step-up s: instalment in year k = P × (1 + s)ᵏ⁻¹'],
      vars: [['P', 'the monthly instalment'], ['i', 'the monthly return, as a decimal'], ['n', 'the number of instalments'], ['s', 'the yearly step-up, as a decimal']]
    },
    worked: {
      inputs: { monthly: 15000, rate: 11, years: 10, stepup: 5 },
      text: 'Start a ₹15,000 SIP at an expected 11% for 10 years, raising it 5% each year. After the first year ₹1,80,000 has gone in and is worth ₹1,91,094. By year 10 you have invested ₹22,64,021 and the value is ₹39,55,280, a gain of ₹16,91,259. Without the step-up, ₹18,00,000 invested grows to ₹32,84,809.',
      check: [['_table.rows.0.1', '₹1,80,000'], ['_table.rows.0.2', '₹1,91,094'], ['invested', '₹22,64,021'], ['value', '₹39,55,280'], ['returns', '₹16,91,259']]
    },
    uses: [
      ['Sizing a goal', 'Find the monthly amount that reaches a target, such as a home down payment, in a set number of years.'],
      ['Deciding on a step-up', 'Compare a flat SIP with one that rises 5% or 10% a year before you set it up.'],
      ['Reviewing an existing SIP', 'Check whether your fund’s value is ahead of or behind what your assumed return implies.']
    ],
    mistakes: [
      'Taking 12% here as 12% a year compounded. The calculator compounds 1% a month, which works out at about 12.68% a year, so to project a fund’s 12% CAGR like for like, enter about 11.39%.',
      'Judging the return by gain over amount invested. ₹39,55,280 on ₹22,64,021 looks modest for 10 years, but the average rupee was invested for far less; measure a SIP’s yearly return as XIRR.',
      'Stopping a SIP during a market fall. The instalments made when prices are low buy the most units, so pausing then removes the part of the plan that does the most work.'
    ],
    faq: [
      { q: 'How much SIP is needed for ₹1 crore?', a: 'At an expected 12%, ₹20,000 a month for 15 years reaches ₹1,00,91,520 from ₹36,00,000 invested. Given 25 years, ₹10,000 a month goes much further, to ₹1,89,76,351.' },
      { q: 'What does a 10% step-up add to a ₹10,000 SIP?', a: 'Over 15 years at 12%, a flat ₹10,000 SIP grows to ₹50,45,760. Raising it 10% a year puts in ₹38,12,698 and grows to ₹86,83,849.' },
      { q: 'Can I change or pause a SIP?', a: 'Yes. Fund houses let you change the amount, skip a few instalments or stop the SIP without a penalty; only units redeemed within the fund’s exit-load period cost extra.' }
    ],
    checks: [
      { inputs: { monthly: 15000, rate: 11, years: 10, stepup: 0 }, key: 'invested', shown: '₹18,00,000' },
      { inputs: { monthly: 15000, rate: 11, years: 10, stepup: 0 }, key: 'value', shown: '₹32,84,809' },
      { inputs: { monthly: 20000, rate: 12, years: 15, stepup: 0 }, key: 'value', shown: '₹1,00,91,520' },
      { inputs: { monthly: 20000, rate: 12, years: 15, stepup: 0 }, key: 'invested', shown: '₹36,00,000' },
      { inputs: { monthly: 10000, rate: 12, years: 25, stepup: 0 }, key: 'value', shown: '₹1,89,76,351' },
      { inputs: { monthly: 10000, rate: 12, years: 15, stepup: 0 }, key: 'value', shown: '₹50,45,760' },
      { inputs: { monthly: 10000, rate: 12, years: 15, stepup: 10 }, key: 'invested', shown: '₹38,12,698' },
      { inputs: { monthly: 10000, rate: 12, years: 15, stepup: 10 }, key: 'value', shown: '₹86,83,849' }
    ]
  }
};
