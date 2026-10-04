/**
 * The reading part of the Business calculators, rendered by build-depth.js.
 * Shape and rules: build-depth.js and build/content/_check.js. UK figures
 * are the engine's own constants for 2026/27; every number is computed with
 * the page's own engine and listed in worked.check / checks.
 */
'use strict';

module.exports = {
  '/business/uk-take-home-pay/': {
    term: 'take-home pay',
    whatIs: [
      'Take-home pay is what reaches your bank account after PAYE has taken off income tax, National Insurance, your pension contribution and any student loan. It is the figure to budget with: a £32,000 salary is not £2,667 a month to spend.',
      'The deductions are set on annual thresholds and spread across the year’s payslips, so a month’s pay is roughly the annual net figure divided by 12.'
    ],
    formula: {
      text: 'For 2026/27 the pension comes out first. Income tax is charged on what is left above the £12,570 personal allowance, and National Insurance on the full salary.',
      expr: [
        'take-home = salary − pension − income tax − NI − student loan',
        'taxable pay = salary − pension − £12,570',
        'income tax = 20% × taxable pay up to £37,700 + 40% × taxable pay above it',
        'NI = 8% × salary between £12,570 and £50,270 + 2% × salary above £50,270'
      ],
      vars: [['salary', 'gross annual pay before anything comes off'], ['pension', 'your contribution, a percentage of salary'], ['NI', 'Class 1 employee National Insurance']]
    },
    worked: {
      inputs: { gross: 32000, year: '2026/27', pension: 4, student: 'none' },
      text: 'On a £32,000 salary with a 4% pension and no student loan, the pension takes £1,280, leaving £30,720. Income tax is 20% of the £18,150 above the personal allowance, £3,630. National Insurance is 8% of £19,430, £1,554.40. That leaves £25,535.60 a year, or £2,127.97 a month, and the effective rate of tax and NI together is 16.201%.',
      check: [['pensionAmt', '£1,280'], ['tax', '£3,630'], ['ni', '£1,554.40'], ['net', '£25,535.60'], ['monthly', '£2,127.97'], ['effectiveRate', '16.201%']]
    },
    uses: [
      ['Weighing a job offer', 'Turn an advertised salary into the monthly amount that pays the rent.'],
      ['Testing a pension change', 'See what raising your contribution from 4% to 8% costs in monthly pay.'],
      ['Checking a pay rise', 'Find how much of a £3,000 rise survives tax and NI, especially near £50,270.']
    ],
    mistakes: [
      'Dividing the gross salary by 12 and budgeting on that. On £32,000 with a 4% pension, deductions come to about £539 a month.',
      'Using it for a Scottish taxpayer. Scotland’s income tax bands differ, so only the National Insurance figure carries over.'
    ],
    faq: [
      { q: 'What is the personal allowance for 2026/27?', a: '£12,570, the amount you can earn before income tax starts. It shrinks by £1 for every £2 of income above £100,000, so on a £110,000 salary with no pension the calculator applies £7,570.' },
      { q: 'What is the difference between my marginal and effective tax rate?', a: 'The marginal rate is the income tax on your next pound: 20% at basic rate, 40% at higher rate. The effective rate is all tax and NI divided by gross pay, and is always lower.' },
      { q: 'Does a pension contribution reduce my National Insurance?', a: 'Not as this calculator models it. The pension comes out before income tax, as in a net pay arrangement, but NI is worked out on the whole salary. Only salary sacrifice reduces NI, because your contractual pay itself goes down.' },
      { q: 'How is weekly take-home worked out?', a: 'It is the annual net figure divided by 52. Weekly payslips can differ slightly, because PAYE uses weekly thresholds and some years have 53 paydays.' }
    ],
    checks: [
      { inputs: { gross: 110000, year: '2026/27', pension: 0, student: 'none' }, key: 'personalAllowance', shown: '£7,570' }
    ]
  },

  '/business/amortization-schedule/': {
    term: 'an amortisation schedule',
    whatIs: [
      'An amortisation schedule is the table of every repayment on a loan, each row split into the interest charged that month, the principal repaid and the balance left afterwards. On a UK repayment mortgage or a business loan it shows where the money goes, rather than the single closing balance a lender’s statement gives.'
    ],
    formula: {
      text: 'Each row starts from the balance the row above left. Interest is that balance times the monthly rate; the rest of the payment comes off the balance, and M is set so the last row reaches £0.00.',
      expr: [
        'interest(k) = balance(k − 1) × r',
        'principal(k) = M + overpayment − interest(k)',
        'balance(k) = balance(k − 1) − principal(k)',
        'M = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1)        r = annual rate ÷ 12 ÷ 100'
      ],
      vars: [['k', 'the payment number, from 1 to n'], ['M', 'the contractual monthly payment'], ['P', 'the amount borrowed'], ['n', 'the term in months']]
    },
    worked: {
      inputs: { amount: 150000, rate: 4.5, years: 20, overpay: 0, view: 'monthly' },
      text: 'Borrow £150,000 at 4.5% over 20 years and the payment is £948.97 a month. In month 1 the balance is the full £150,000, so £562.50 is interest and only £386.47 comes off, leaving £149,613.53. Every later row tilts a little further towards principal: by month 60 the split is £481.98 principal to £466.99 interest. Five years in, the balance is still £124,049.99, and across the full term the interest adds up to £77,753.78.',
      check: [['monthly', '£948.97'], ['_table.rows.0.3', '£562.50'], ['_table.rows.0.2', '£386.47'], ['_table.rows.0.4', '£149,613.53'], ['_table.rows.59.4', '£124,049.99'], ['totalInterest', '£77,753.78']]
    },
    uses: [
      ['Finding the crossover year', 'Switch to the annual summary and look for the first year the Principal column is larger than the Interest column.'],
      ['Planning a remortgage', 'Read the balance at the end of a two- or five-year fixed rate to know how much you will be refinancing.'],
      ['Business loan bookkeeping', 'Split each year’s repayments into interest, which goes to the profit and loss account, and capital, which reduces the liability on the balance sheet.']
    ],
    mistakes: [
      'Assuming half the term clears half the loan. On £150,000 at 4.5% over 20 years, £76,387.04 is still owed after 12 years, more than half the original debt.',
      'Treating the Paid column as the cost of borrowing. Only the Interest column is cost; the Principal column is your own debt being handed back.'
    ],
    faq: [
      { q: 'In which year does more of my payment go to principal than interest?', a: 'It depends on the rate and term. On £150,000 at 4.5% over 20 years it is year 6, when £5,926.69 goes to principal and £5,461.00 to interest. Higher rates and longer terms push the crossover later.' },
      { q: 'How much does a £100 monthly overpayment save?', a: 'On that same £150,000 loan, £100 a month extra from the first payment saves £12,413.23 in interest and ends the loan 34 months early. The calculator keeps the payment fixed and lets the term shorten.' },
      { q: 'Is an interest-only mortgage amortised?', a: 'No. Each interest-only payment covers that month’s interest alone, so the balance never falls and the whole amount is due at the end of the term. This schedule models a capital-and-interest repayment loan.' }
    ],
    checks: [
      { inputs: { amount: 150000, rate: 4.5, years: 20, overpay: 0, view: 'monthly' }, key: '_table.rows.59.2', shown: '£481.98' },
      { inputs: { amount: 150000, rate: 4.5, years: 20, overpay: 0, view: 'monthly' }, key: '_table.rows.59.3', shown: '£466.99' },
      { inputs: { amount: 150000, rate: 4.5, years: 20, overpay: 0, view: 'annual' }, key: '_table.rows.11.4', shown: '£76,387.04' },
      { inputs: { amount: 150000, rate: 4.5, years: 20, overpay: 0, view: 'annual' }, key: '_table.rows.5.2', shown: '£5,926.69' },
      { inputs: { amount: 150000, rate: 4.5, years: 20, overpay: 0, view: 'annual' }, key: '_table.rows.5.3', shown: '£5,461.00' },
      { inputs: { amount: 150000, rate: 4.5, years: 20, overpay: 100, view: 'annual' }, key: 'interestSaved', shown: '£12,413.23' },
      { inputs: { amount: 150000, rate: 4.5, years: 20, overpay: 100, view: 'annual' }, key: 'monthsSaved', shown: '34' }
    ]
  },

  '/business/break-even/': {
    term: 'the break-even point',
    whatIs: [
      'The break-even point is the sales volume at which revenue exactly covers costs, so profit is zero. Below it each period runs at a loss; above it every extra unit adds its full contribution to profit.',
      'It matters most before committing to a new fixed cost, because a lease, a hire or a machine raises the number of units you must sell every period.'
    ],
    formula: {
      text: 'Each unit sold contributes its price less its variable cost. Fixed costs divided by that contribution give the units needed, rounded up to a whole unit; adding a target profit to the fixed costs gives the volume that earns it.',
      expr: [
        'contribution = price − variable cost',
        'break-even units = fixed costs ÷ contribution',
        'units for target = (fixed costs + target profit) ÷ contribution',
        'margin of safety = (expected units − break-even units) ÷ expected units × 100',
        'operating leverage = contribution × expected units ÷ profit at expected units'
      ],
      vars: [['fixed costs', 'costs for the period that do not move with volume'], ['variable cost', 'the cost of making or buying one more unit'], ['target profit', 'the profit wanted for the period on top of covering costs']]
    },
    worked: {
      inputs: { fixed: 18000, price: 3.2, variable: 1.1, target: 6000, actual: 11000 },
      text: 'A coffee cart carries £18,000 of fixed costs a quarter: pitch rent, van finance and insurance. A coffee sells for £3.20 and the cup, milk and beans cost £1.10, so each sale contributes £2.10, a contribution margin ratio of 65.625%. Break-even is 8,572 coffees a quarter, and earning £6,000 of profit takes 11,429. At the expected 11,000 the quarter makes £5,100, with a margin of safety of 22.1%.',
      check: [['contribution', '£2.10'], ['contributionRatio', '65.625%'], ['beUnits', '8,572'], ['targetUnits', '11,429'], ['profitAtActual', '£5,100'], ['marginOfSafety', '22.1%']]
    },
    uses: [
      ['Pricing a new product', 'Try two or three prices and watch the units needed fall as contribution per unit rises.'],
      ['Testing a fixed-cost decision', 'Add a new salary or lease to fixed costs and see how many extra units it demands each period.'],
      ['Setting a sales target', 'Enter the profit you need and hand the team a unit figure to aim at.']
    ],
    mistakes: [
      'Leaving out the owner’s drawings and loan capital repayments. If trading has to fund them, add them to fixed costs or enter them as the target profit; otherwise break-even comes out too low.',
      'Using one average variable cost for products with very different margins. The result only holds while the sales mix holds, so work out the products separately or use a weighted contribution.'
    ],
    faq: [
      { q: 'How do I calculate break-even revenue rather than units?', a: 'Divide fixed costs by the contribution margin ratio. For the coffee cart, £18,000 ÷ 65.625% gives £27,428.57 a quarter, the figure to set against the till takings.' },
      { q: 'What happens to break-even if I raise my price?', a: 'It drops quickly, because the whole increase is extra contribution. Charging £3.50 lifts contribution to £2.40 and cuts break-even from 8,572 to 7,500 coffees a quarter, provided the cart sells the same number.' },
      { q: 'Is break-even the same as payback?', a: 'No. Break-even is a volume per period; payback is the time cumulative profit takes to repay a one-off investment. A business can pass break-even every month and still need years to recover its fit-out.' }
    ],
    checks: [
      { inputs: { fixed: 18000, price: 3.2, variable: 1.1, target: 6000, actual: 11000 }, key: 'beRevenue', shown: '£27,428.57' },
      { inputs: { fixed: 18000, price: 3.5, variable: 1.1, target: 6000, actual: 11000 }, key: 'contribution', shown: '£2.40' },
      { inputs: { fixed: 18000, price: 3.5, variable: 1.1, target: 6000, actual: 11000 }, key: 'beUnits', shown: '7,500' }    ]
  },

  '/business/business-ratios/': {
    term: 'financial ratios',
    whatTitle: 'What are financial ratios?',
    whatIs: [
      'Financial ratios turn the totals on a balance sheet and profit and loss account into comparable measures: whether the business can pay what falls due within a year, how much profit each pound of sales produces, and how much of it is funded by borrowing. Because they are proportions, a firm with £400,000 of revenue can be set beside one with £4 million.'
    ],
    formula: {
      text: 'Every ratio is one figure from the accounts divided by another. Margins, returns and the structure ratios are shown as percentages; current, quick and asset turnover as plain multiples.',
      expr: [
        'current ratio = current assets ÷ current liabilities',
        'quick ratio = (current assets − inventory) ÷ current liabilities',
        'net margin = net profit ÷ revenue × 100        ROE = net profit ÷ equity × 100',
        'asset turnover = revenue ÷ total assets        gearing = total debt ÷ equity × 100',
        'debt ratio = total debt ÷ total assets × 100'
      ],
      vars: [['current assets', 'cash, debtors and stock expected to turn into cash within 12 months'], ['current liabilities', 'creditors, overdraft and other sums due within 12 months'], ['total debt', 'loans, overdrafts and finance leases that carry interest']]
    },
    worked: {
      inputs: { currentAssets: 84000, inventory: 46000, currentLiabilities: 70000, totalAssets: 210000, totalDebt: 90000, equity: 95000, revenue: 420000, grossProfit: 147000, netProfit: 16800 },
      text: 'A small wholesaler has £84,000 of current assets, £46,000 of it stock, against £70,000 of current liabilities. The current ratio is 1.2, but strip out the stock and the quick ratio is 0.54: without selling stock it could meet only about half of its short-term bills. On £420,000 of revenue it keeps a gross margin of 35% and a net margin of 4%. Debt of £90,000 against £95,000 of equity gives gearing of 94.7%, and return on equity is 17.7%.',
      check: [['current', '1.2'], ['quick', '0.54'], ['grossMargin', '35%'], ['netMargin', '4%'], ['gearing', '94.7%'], ['roe', '17.7%']]
    },
    uses: [
      ['Preparing for a bank meeting', 'Lenders often test current ratio and gearing against loan covenants, so know yours before they ask.'],
      ['Year-on-year review', 'Run last year’s accounts and this year’s in turn to see whether margins or liquidity have slipped.'],
      ['Vetting a customer or supplier', 'Take balance sheet figures from accounts filed at Companies House and test their liquidity.']
    ],
    mistakes: [
      'Mixing periods. Revenue and profit should cover the same 12 months and the balance sheet the date they end; a six-month profit against a year-end balance sheet halves ROA and ROE.',
      'Counting trade creditors as debt. Gearing here means interest-bearing borrowing, which is why debt plus equity need not equal total assets.'
    ],
    faq: [
      { q: 'What is a good quick ratio?', a: 'Around 1 means current liabilities could be paid from cash and debtors alone. Stock-heavy wholesalers and retailers often run lower, as the wholesaler above does at 0.54; service firms with little stock usually sit well above 1.' },
      { q: 'What is the difference between gearing and the debt ratio?', a: 'Gearing compares debt with equity and can pass 100% in a solvent business; the debt ratio compares debt with total assets. For the wholesaler they are 94.7% and 42.9%.' },
      { q: 'How do ROA and ROE differ?', a: 'ROA divides net profit by all the assets the business uses, however they are financed; ROE divides it by the owners’ stake alone. The wholesaler earns 8% on its assets but 17.7% on its equity, because borrowing funds part of the asset base.' }
    ],
    checks: [
      { inputs: { currentAssets: 84000, inventory: 46000, currentLiabilities: 70000, totalAssets: 210000, totalDebt: 90000, equity: 95000, revenue: 420000, grossProfit: 147000, netProfit: 16800 }, key: 'debtRatio', shown: '42.9%' },
      { inputs: { currentAssets: 84000, inventory: 46000, currentLiabilities: 70000, totalAssets: 210000, totalDebt: 90000, equity: 95000, revenue: 420000, grossProfit: 147000, netProfit: 16800 }, key: 'roa', shown: '8%' }
    ]
  },

  '/business/cagr/': {
    term: 'CAGR',
    whatIs: [
      'Compound annual growth rate is the single yearly percentage that, compounded, takes a value from where it started to where it finished over a given number of years. It is the figure annual reports and investors mean when they say revenue grew by so much a year over five years.'
    ],
    formula: {
      text: 'Divide the end value by the start value to get the growth multiple, take the root for the number of years and subtract 1. The projection then compounds the end value forward at the same rate.',
      expr: [
        'CAGR = (end ÷ begin)^(1 ÷ years) − 1',
        'total growth = (end − begin) ÷ begin × 100',
        'years to double = ln 2 ÷ ln(1 + CAGR)',
        'projected value = end × (1 + CAGR)^(years forward)'
      ],
      vars: [['begin', 'the value at the start of the first year'], ['end', 'the value at the end of the last year'], ['years', 'the years of growth between the two, not the number of data points']]
    },
    worked: {
      inputs: { begin: 48000, end: 61500, years: 5, project: 2 },
      text: 'A freelance designer’s turnover went from £48,000 to £61,500 over five years. That is 28.125% growth in total, a multiple of 1.28, but only 5.082% a year compounded, short of the 5.625% you get by dividing 28.125% by five. At 5.082% turnover takes about 14 years to double, and carrying the rate on for two more years projects £67,909.21.',
      check: [['totalGrowth', '28.125%'], ['multiple', '1.28'], ['cagr', '5.082%'], ['doubling', '14'], ['projected', '£67,909.21']]
    },
    uses: [
      ['Reporting revenue growth', 'Give investors or a lender one annual growth figure for a multi-year period.'],
      ['Comparing holdings over different periods', 'Put a fund held for seven years and a property held for four on the same yearly basis.'],
      ['Testing a business plan', 'Work out the yearly growth a five-year revenue target really requires, then judge whether it is believable.']
    ],
    mistakes: [
      'Counting data points instead of years. Revenue for 2021 to 2026 is six figures but five years of growth; entering 6 understates the rate.',
      'Comparing rates over very different lengths as if they were equally proven. 20% a year for two years says far less than 8% a year for ten.',
      'Treating the projection as a forecast. It assumes the past rate carries on unchanged, which is an assumption rather than evidence.'
    ],
    faq: [
      { q: 'Can CAGR be negative?', a: 'Yes. A value that falls from £100,000 to £81,000 over two years has a CAGR of −10% and total growth of −19%. The years-to-double figure is then blank, since a shrinking value never doubles.' },
      { q: 'How do I work out CAGR over months rather than whole years?', a: 'Enter the period as a decimal: 30 months is 2.5 years. The formula accepts fractional years unchanged, so £48,000 growing to £55,000 over 2.5 years gives 5.596% a year.' },
      { q: 'Is CAGR the same as the annual return on an investment?', a: 'Only when nothing was added or taken out. If you paid in or withdrew money during the period, CAGR on the opening and closing balances counts your own deposits as growth; a money-weighted measure such as IRR is the right one.' }
    ],
    checks: [
      { inputs: { begin: 100000, end: 81000, years: 2, project: 0 }, key: 'cagr', shown: '−10%' },
      { inputs: { begin: 100000, end: 81000, years: 2, project: 0 }, key: 'totalGrowth', shown: '−19%' },
      { inputs: { begin: 48000, end: 55000, years: 2.5, project: 0 }, key: 'cagr', shown: '5.596%' }
    ]
  },

  '/business/commission-calculator/': {
    term: 'sales commission',
    whatIs: [
      'Sales commission is the variable part of a salesperson’s pay, worked out as a percentage of the sales they close in a period. How that percentage is applied, to every pound, only above a quota or at rising rates as sales climb, changes the payout far more than the headline rate does.'
    ],
    formula: {
      text: 'Flat pays the rate on all sales. Threshold pays it only on sales above the quota. Tiered pays the base rate up to quota, 1.5 times it from quota to twice quota, and double it beyond that.',
      expr: [
        'flat: commission = sales × rate',
        'threshold: commission = max(0, sales − quota) × rate',
        'tiered: commission = tier 1 × rate + tier 2 × 1.5 × rate + tier 3 × 2 × rate',
        'effective rate = commission ÷ sales × 100        attainment = sales ÷ quota × 100'
      ],
      vars: [['quota', 'the threshold figure: where commission starts, or where tier 1 ends'], ['tier 1, 2, 3', 'sales up to quota, from quota to twice quota, and above twice quota'], ['rate', 'the base commission rate as a decimal']]
    },
    worked: {
      inputs: { sales: 85000, structure: 'threshold', rate: 8, threshold: 40000, base: 26000 },
      text: 'An account manager on a £26,000 base sells £85,000 against a £40,000 quota, with 8% paid only above quota. The first £40,000 earns nothing and the £45,000 above it earns £3,600, so total pay is £29,600. Attainment is 212.5%, yet the effective commission rate on all sales is only 4.235%, and commission makes up 12.162% of pay.',
      check: [['commission', '£3,600'], ['total', '£29,600'], ['attainment', '212.5%'], ['effectiveRate', '4.235%'], ['commissionShare', '12.162%']]
    },
    uses: [
      ['Checking a commission statement', 'Re-run the month’s sales through the plan and compare the result with the payslip line.'],
      ['Designing a plan', 'Model what the business pays at 80%, 100% and 200% of quota before the rates are published.'],
      ['Comparing job offers', 'Turn two different packages into the pay each gives at the sales you expect to close.']
    ],
    mistakes: [
      'Applying the top tier’s rate to every sale. Each rate covers only the sales inside its band, as income tax bands do, so reaching tier 3 does not re-rate the first pound.',
      'Forgetting the employer’s cost. Commission goes through PAYE like salary, so employer National Insurance, and pension where the scheme counts commission, come on top of the figure here.',
      'Paying on orders that are later cancelled or never paid. Agree before the first payout whether a sale counts when booked, invoiced or paid, and when commission is clawed back.'
    ],
    faq: [
      { q: 'Which commission structure pays the most?', a: 'At the same rate and sales, tiered pays most once sales pass quota, then flat, then threshold. On £85,000 at 8% with a £40,000 quota the three give £8,800, £6,800 and £3,600.' },
      { q: 'What are on-target earnings (OTE)?', a: 'OTE is base salary plus the commission paid at exactly 100% of quota. On a £26,000 base, an 8% flat rate and a £40,000 quota, OTE is £29,200.' },
      { q: 'How is an accelerator different from a bonus?', a: 'An accelerator raises the commission rate on sales beyond a point, so pay keeps rising with every sale. A bonus is usually a fixed sum for hitting a target, paid the same whether the rep beats it by £1 or by £50,000.' }
    ],
    checks: [
      { inputs: { sales: 85000, structure: 'tiered', rate: 8, threshold: 40000, base: 26000 }, key: 'commission', shown: '£8,800' },
      { inputs: { sales: 85000, structure: 'flat', rate: 8, threshold: 40000, base: 26000 }, key: 'commission', shown: '£6,800' },
      { inputs: { sales: 40000, structure: 'flat', rate: 8, threshold: 40000, base: 26000 }, key: 'total', shown: '£29,200' }
    ]
  },

  '/business/depreciation/': {
    term: 'depreciation',
    whatIs: [
      'Depreciation spreads the cost of a fixed asset, such as a van, a machine or a laptop, over the years it is used, so each year’s accounts bear a share instead of the year of purchase taking the whole cost. The charge reduces profit and the asset’s book value, though no cash leaves the business when it is posted.'
    ],
    formula: {
      text: 'Straight line charges the same amount every year. Reducing balance charges a fixed percentage of the opening book value, and double declining uses twice the straight-line percentage, 2 ÷ life. Sum of years’ digits takes a falling fraction of the depreciable amount each year.',
      expr: [
        'straight line = (cost − residual) ÷ life',
        'reducing balance = opening book value × rate',
        'double declining = opening book value × 2 ÷ life',
        'sum of years’ digits, year y = (cost − residual) × (life − y + 1) ÷ (life × (life + 1) ÷ 2)'
      ],
      vars: [['cost', 'purchase price plus delivery and installation'], ['residual', 'what you expect to sell it for at the end of its life'], ['life', 'the number of years you expect to use it']]
    },
    worked: {
      inputs: { method: 'ddb', cost: 36000, salvage: 4000, life: 5, dbRate: 25 },
      text: 'A van costs £36,000, should sell for £4,000 after five years, and is written down by double declining balance at 40% a year. Year 1 charges £14,400, leaving £21,600; year 2 charges £8,640. By the end of year 4 the book value is £4,665.60, so year 5 can take only £665.60 before reaching the residual value. Both this and straight line write off £32,000 in total; straight line simply spreads it evenly.',
      check: [['firstYear', '£14,400'], ['_table.rows.0.3', '£21,600'], ['_table.rows.1.1', '£8,640'], ['_table.rows.3.3', '£4,665.60'], ['_table.rows.4.1', '£665.60'], ['totalDepreciation', '£32,000']]
    },
    uses: [
      ['Keeping a fixed asset register', 'Copy the yearly charge and closing book value into the register for each asset.'],
      ['Year-end journals', 'Post the annual charge to depreciation expense and to accumulated depreciation.'],
      ['Choosing an accounting policy', 'Compare how each method shapes reported profit in the first two or three years.']
    ],
    mistakes: [
      'Depreciating land. Freehold land does not wear out and is normally not depreciated, so split a property’s cost between land and building first.',
      'Setting the residual value to zero for assets that clearly sell on, such as vans, which overstates the charge every year.'
    ],
    faq: [
      { q: 'What is the difference between reducing balance and double declining balance?', a: 'Both charge a percentage of the opening book value. Reducing balance uses whatever rate you enter, such as 25%; double declining sets it at twice the straight-line rate, so 40% for a five-year life and 20% for ten.' },
      { q: 'How is sum of years’ digits worked out?', a: 'Add the year numbers of the life: 1 + 2 + 3 + 4 + 5 = 15 for five years. Year 1 takes 5/15 of the depreciable amount, year 2 takes 4/15 and so on. On the £36,000 van that is £10,666.67 in year 1 and £2,133.33 in year 5.' },
      { q: 'What happens to depreciation when I sell the asset early?', a: 'The charge stops at the date of sale. The difference between the sale price and the book value at that point is a profit or loss on disposal in that year’s accounts.' }
    ],
    checks: [
      { inputs: { method: 'syd', cost: 36000, salvage: 4000, life: 5, dbRate: 25 }, key: 'firstYear', shown: '£10,666.67' },
      { inputs: { method: 'syd', cost: 36000, salvage: 4000, life: 5, dbRate: 25 }, key: '_table.rows.4.1', shown: '£2,133.33' }
    ]
  },

  '/business/discount-calculator/': {
    term: 'a stacked discount',
    whatIs: [
      'A stacked discount is two reductions applied one after the other, such as 25% off in a sale and a further 10% at the till. The second is taken from the already-reduced price, so the total reduction, the effective discount, is always less than the two percentages added together.',
      'For a seller what matters more is the profit left, since every pound off the price comes out of it.'
    ],
    formula: {
      text: 'Multiply the original price by what each discount leaves: 75% for 25% off, 90% for 10% off. The effective discount is the saving as a share of the original price, and both margins compare profit with the selling price.',
      expr: [
        'final = original × (1 − d₁ ÷ 100) × (1 − d₂ ÷ 100)',
        'effective discount = (original − final) ÷ original × 100',
        'margin before = (original − cost) ÷ original × 100',
        'margin after = (final − cost) ÷ final × 100'
      ],
      vars: [['d₁, d₂', 'the two discounts in per cent'], ['cost', 'what one unit costs you to buy or make'], ['margin', 'profit as a percentage of the selling price, not of cost']]
    },
    worked: {
      inputs: { original: 80, d1: 25, d2: 10, cost: 44 },
      text: 'A jacket priced at £80 costs the shop £44. A 25% sale takes it to £60, and a 10% loyalty code then takes it to £54. The customer saves £26, an effective discount of 32.5% rather than the 35% the two numbers suggest. The margin falls from 45% to 18.519%, and profit per jacket from £36 to £10, so the shop must sell 3.6 jackets at the sale price to earn what one earned at full price.',
      check: [['final', '£54'], ['saved', '£26'], ['effective', '32.5%'], ['naiveSum', '35%'], ['marginBefore', '45%'], ['marginAfter', '18.519%']]
    },
    uses: [
      ['Checking a shop’s claim', 'Confirm that an extra 10% off sale prices really gives the price on the shelf label.'],
      ['Trade pricing', 'Apply a trade discount and then a settlement discount to quote a customer’s net price.'],
      ['Comparing offers', 'Check whether one 30% discount beats 20% followed by 10%: it does, because the pair comes to 28%.']
    ],
    mistakes: [
      'Working out margin on cost. A £44 item sold at £54 makes £10: 18.519% of the price but about 22.7% of cost, which is markup and overstates the room left to discount.',
      'Expecting the order of two percentage discounts to change the price. 25% then 10% and 10% then 25% both give £54, since multiplication ignores order; order matters only when one reduction is a fixed sum off.'
    ],
    faq: [
      { q: 'How do I find the original price from a sale price?', a: 'Divide by what each discount leaves. A £54 price after 25% and then 10% off came from £54 ÷ 0.75 ÷ 0.9 = £80. Adding the percentages back onto the sale price gives the wrong answer.' },
      { q: 'How much can I discount before I make a loss?', a: 'Up to your margin before discount. On an £80 price with a £44 cost the margin is 45%, so any combined discount beyond 45%, a price under £44, sells at a loss.' },
      { q: 'How do I work out 15% off in my head?', a: 'Take 10%, add half of it again, and subtract: 15% off £45 is £45 − £6.75 = £38.25.' }
    ],
    checks: [
      { inputs: { original: 80, d1: 25, d2: 10, cost: 44 }, key: 'profitAfter', shown: '£10' },
      { inputs: { original: 80, d1: 10, d2: 25, cost: 44 }, key: 'final', shown: '£54' },
      { inputs: { original: 80, d1: 20, d2: 10, cost: 44 }, key: 'effective', shown: '28%' },
      { inputs: { original: 45, d1: 15, d2: 0, cost: 0 }, key: 'saved', shown: '£6.75' },
      { inputs: { original: 45, d1: 15, d2: 0, cost: 0 }, key: 'final', shown: '£38.25' }
    ]
  },

  '/business/employer-cost/': {
    whatTitle: 'What does an employee really cost?',
    whatIs: [
      'The true cost of an employee is the gross salary plus what the employer pays on top: employer National Insurance, the employer’s pension contribution, and the desk, laptop, software and space the job needs. None of it shows on the payslip.'
    ],
    formula: {
      text: 'For 2026/27 employer NI is 15% of the salary above a £5,000 secondary threshold, with no upper limit, less any Employment Allowance you claim (up to £10,500). Pension and other costs are added, and the total is spread over 46.4 working weeks.',
      expr: [
        'annual cost = salary + employer NI + employer pension + other costs',
        'employer NI = 15% × (salary − £5,000) − Employment Allowance claimed (up to £10,500)',
        'first-year cost = annual cost + recruitment',
        'cost per working day = annual cost ÷ (46.4 × 5)      cost per hour = annual cost ÷ (46.4 × 37.5)'
      ],
      vars: [['salary', 'gross annual pay, before the employee’s own tax and NI'], ['employer pension', 'the percentage you enter, applied to the whole salary'], ['46.4', '52 weeks less 5.6 weeks of statutory holiday']]
    },
    worked: {
      inputs: { salary: 45000, year: '2026/27', pension: 5, allowance: 'no', overheads: 2500, recruitment: 3000 },
      text: 'Hiring at £45,000 with a 5% employer pension, £2,500 a year of equipment and software, a £3,000 agency fee, and the Employment Allowance already used. Employer NI is 15% of £40,000, £6,000, and the pension adds £2,250. The yearly cost is £55,750, or £4,645.83 a month, 23.889% above the salary; the first year, with the fee, is £58,750. Each of the 232 working days costs £240.30, and each productive hour £32.04.',
      check: [['ni', '£6,000'], ['pensionAmt', '£2,250'], ['annual', '£55,750'], ['monthly', '£4,645.83'], ['onCost', '23.889%'], ['firstYear', '£58,750']]
    },
    uses: [
      ['Approving a new hire', 'Put the first-year figure, recruitment included, in the budget request instead of the advertised salary.'],
      ['Setting a charge-out rate', 'Start from the cost per productive hour and add margin, so billable time covers the person doing it.'],
      ['Pricing a pay rise', 'Every extra £1,000 of salary costs the employer £1,150 in pay and NI, before the pension on top.']
    ],
    mistakes: [
      'Assuming employer NI starts where the employee’s does. The 15% starts at £5,000, so a part-timer on £12,000 still costs £1,050 a year in employer NI.',
      'Applying the pension percentage to the wrong base. The tool takes it on the whole salary, while schemes based on qualifying earnings leave out the lowest slice of pay and cost less.',
      'Pricing as if every working day were billable: the 232 days exclude holiday, but not sickness, training or admin.'
    ],
    faq: [
      { q: 'How much employer NI is due on a £60,000 salary for 2026/27?', a: '£8,250 a year: 15% of the £55,000 above the threshold. Unlike the employee’s NI, the employer rate never drops at higher salaries.' },
      { q: 'Can one salary use up the whole Employment Allowance?', a: 'Yes, from £75,000 upwards. Employer NI on £75,000 is exactly £10,500, so claiming the allowance against one employee at that salary uses all of it.' },
      { q: 'Why is the cost per hour so much higher than salary divided by hours?', a: 'Because it divides by productive hours only: 46.4 weeks of 37.5 hours, or 1,740, not 52 weeks. For the £45,000 hire above, that is £32.04 an hour against £23.08 from salary alone.' }
    ],
    checks: [
      { inputs: { salary: 45000, year: '2026/27', pension: 5, allowance: 'no', overheads: 2500, recruitment: 3000 }, key: 'perProductiveDay', shown: '£240.30' },
      { inputs: { salary: 45000, year: '2026/27', pension: 5, allowance: 'no', overheads: 2500, recruitment: 3000 }, key: 'perProductiveHour', shown: '£32.04' },
      { inputs: { salary: 12000, year: '2026/27', pension: 0, allowance: 'no', overheads: 0, recruitment: 0 }, key: 'ni', shown: '£1,050' },
      { inputs: { salary: 60000, year: '2026/27', pension: 0, allowance: 'no', overheads: 0, recruitment: 0 }, key: 'ni', shown: '£8,250' },
      { inputs: { salary: 75000, year: '2026/27', pension: 0, allowance: 'no', overheads: 0, recruitment: 0 }, key: 'ni', shown: '£10,500' },
      { inputs: { salary: 75000, year: '2026/27', pension: 0, allowance: 'yes', overheads: 0, recruitment: 0 }, key: 'allowanceSaving', shown: '£10,500' }
    ]
  },

  '/business/invoice-payment-terms/': {
    whatTitle: 'What are invoice payment terms?',
    whatIs: [
      'Payment terms set how long a customer has to pay an invoice. “Net 30” means the full amount is due 30 calendar days after the invoice date, and terms such as “2/10 net 30” add a discount for paying within 10 days.',
      'A supplier needs the due date to know when to start chasing; a buyer needs the real cost of a discount to decide whether paying early is worth it.'
    ],
    formula: {
      text: 'The due date is the invoice date plus the net days. Passing up a discount is treated as borrowing the discounted sum from the discount deadline to the due date.',
      expr: [
        'due date = invoice date + net days',
        'annualised cost = d ÷ (1 − d) × 365 ÷ (net days − discount days)',
        'statutory interest = amount × (8% + base rate) × days late ÷ 365'
      ],
      vars: [['d', 'the discount as a decimal, so 1.5% is 0.015'], ['net days − discount days', 'the extra days of credit gained by not taking the discount'], ['base rate', 'the Bank of England rate, as assumed by the tool']]
    },
    worked: {
      inputs: { invoiceDate: '2026-11-02', terms: '60', amount: 8500, discount: 1.5, discountDays: 14, daysLate: 0 },
      text: 'A supplier invoices £8,500 on 2 November 2026 on Net 60, with 1.5% off for payment within 14 days. The discount deadline is 16 Nov 2026, and the full amount is due on Friday 1 Jan 2027, a bank holiday. Paying early costs £8,372.50, saving £127.50; keeping the cash for the other 46 days is like borrowing at 12.083% a year.',
      check: [['discountDate', '16 Nov 2026'], ['dueDate', '1 Jan 2027'], ['payIfEarly', '£8,372.50'], ['discountAmount', '£127.50'], ['effAnnual', '12.083%']]
    },
    uses: [
      ['Setting your own terms', 'See what an early-payment discount would cost you as an annual rate before printing it on invoices.'],
      ['Diarising payment runs', 'Get the exact due date for Net 45 or Net 90 terms that cross month ends and year ends.'],
      ['Preparing a late-payment claim', 'Put a figure on the fixed compensation owed on an overdue invoice before writing to the customer.']
    ],
    mistakes: [
      'Reading Net 30 as “the same date next month”: an invoice dated 31 January 2027 is due on 2 Mar 2027.',
      'Comparing the discount percentage with an interest rate. 1% for paying 20 days early on Net 30 is 18.434% a year.',
      'Expecting buyers to take a discount on long terms: 1% within 10 days on Net 90 is worth only 4.609% a year to them.'
    ],
    faq: [
      { q: 'How much compensation can I add to a late invoice?', a: 'A fixed sum set by the invoice’s size: £70 on an £8,500 invoice paid late, £40 on one for £750. It is added once per invoice, however late the payment, on top of statutory interest.' },
      { q: 'How do I enter “30 days end of month” terms?', a: 'Enter the last day of the invoice’s month as the invoice date and choose Net 30. The tool counts from whatever date you give it, so the due date then follows the end-of-month rule.' },
      { q: 'Why does the verdict say “Marginal” for some discounts?', a: 'The tool calls a discount marginal when passing it up costs 12% a year or less, roughly the price of ordinary business borrowing.' }
    ],
    checks: [
      { inputs: { invoiceDate: '2027-01-31', terms: '30', amount: 750, discount: 0, discountDays: 10, daysLate: 0 }, key: 'dueDate', shown: '2 Mar 2027' },
      { inputs: { invoiceDate: '2026-09-01', terms: '30', amount: 5000, discount: 1, discountDays: 10, daysLate: 0 }, key: 'effAnnual', shown: '18.434%' },
      { inputs: { invoiceDate: '2026-09-01', terms: '90', amount: 5000, discount: 1, discountDays: 10, daysLate: 0 }, key: 'effAnnual', shown: '4.609%' },
      { inputs: { invoiceDate: '2026-11-02', terms: '60', amount: 8500, discount: 1.5, discountDays: 14, daysLate: 20 }, key: 'compensation', shown: '£70' },
      { inputs: { invoiceDate: '2026-09-01', terms: '30', amount: 750, discount: 0, discountDays: 10, daysLate: 15 }, key: 'compensation', shown: '£40' }
    ],
    related: { guides: ['/guides/chase-unpaid-invoices/'] }
  },

  '/business/npv-irr/': {
    whatTitle: 'What are NPV and IRR?',
    whatIs: [
      'Net present value (NPV) is what a stream of future cash is worth today once each amount is discounted at your cost of capital, less the money you put in at the start. The internal rate of return (IRR) is the discount rate at which that NPV falls to exactly zero.'
    ],
    formula: {
      text: 'Each cash flow is divided by (1 + r) to the power of how many periods away it is, and the results are added. Flows count as arriving at the end of each period; IRR is found by halving the range of rates until NPV is zero.',
      expr: [
        'NPV = CF₁ ÷ (1 + r) + CF₂ ÷ (1 + r)² + … + CFₙ ÷ (1 + r)ⁿ − I',
        'IRR = the r at which NPV = 0',
        'profitability index = (NPV + I) ÷ I'
      ],
      vars: [['CFₜ', 'the cash flow in period t'], ['r', 'the discount rate per period, as a decimal'], ['I', 'the initial investment, paid at period 0']]
    },
    worked: {
      inputs: { initial: 80000, flows: '20000, 25000, 30000, 30000', rate: 8 },
      text: 'An £80,000 machine is expected to bring in £20,000, £25,000, £30,000 and £30,000 over four years, and the business’s cost of capital is 8%. The first year’s £20,000 is worth £18,518.52 today. Adding the four present values and taking off the outlay gives an NPV of £5,817.85, so the machine adds value. Its IRR is 11.003% and its profitability index 1.0727. Undiscounted, the inflows total £105,000; discounted, they cover the outlay after 3.7362 periods.',
      check: [['_table.rows.1.3', '£18,518.52'], ['npv', '£5,817.85'], ['irr', '11.003%'], ['pi', '1.0727'], ['totalUndisc', '£105,000'], ['dpb', '3.7362']]
    },
    uses: [
      ['Approving capital spending', 'Test a vehicle, machine or software purchase against the return the business needs before signing the order.'],
      ['Ranking competing projects', 'When money is short, order projects by profitability index rather than by the size of their IRR.'],
      ['Checking a supplier’s payback claim', 'Re-run their projected savings at your own discount rate to see whether the payback survives.']
    ],
    mistakes: [
      'Ignoring timing because the totals match. Reversing the same flows to £30,000, £30,000, £25,000 and £20,000 lifts the NPV from £5,817.85 to £8,044.35, because more of the money arrives sooner.',
      'Entering the outlay again as the first cash flow. It belongs in its own box at period 0; the list starts with what period 1 brings in.',
      'Mixing period lengths: quarterly cash flows need a quarterly discount rate.'
    ],
    faq: [
      { q: 'What does a negative NPV mean?', a: 'That the project earns less than your discount rate, not necessarily that it loses money. The same £80,000 machine discounted at 12% has an NPV of −£1,794.06, yet it still returns £105,000 in cash.' },
      { q: 'Is a higher IRR always better?', a: 'Not when projects differ in size. Paying £10,000 for £5,000 a year over three years gives an IRR of 23.375% but adds only £2,434.26 at 10%. Paying £100,000 for five years of £30,000 has a lower IRR, 15.238%, yet adds £13,723.60.' },
      { q: 'How is discounted payback different from simple payback?', a: 'It counts how many periods the present values, not the raw cash, take to cover the outlay, so it is always the longer of the two.' }
    ],
    checks: [
      { inputs: { initial: 80000, flows: '30000, 30000, 25000, 20000', rate: 8 }, key: 'npv', shown: '£8,044.35' },
      { inputs: { initial: 80000, flows: '20000, 25000, 30000, 30000', rate: 12 }, key: 'npv', shown: '£1,794.06', scale: -1 },
      { inputs: { initial: 10000, flows: '5000, 5000, 5000', rate: 10 }, key: 'irr', shown: '23.375%' },
      { inputs: { initial: 10000, flows: '5000, 5000, 5000', rate: 10 }, key: 'npv', shown: '£2,434.26' },
      { inputs: { initial: 100000, flows: '30000, 30000, 30000, 30000, 30000', rate: 10 }, key: 'irr', shown: '15.238%' },
      { inputs: { initial: 100000, flows: '30000, 30000, 30000, 30000, 30000', rate: 10 }, key: 'npv', shown: '£13,723.60' }
    ]
  },

  '/business/profit-margin/': {
    whatTitle: 'What are margin and markup?',
    whatIs: [
      'Gross margin is profit as a share of the selling price; markup is the same profit as a share of the cost. A product bought for £24 and sold for £30 makes £6, which is a 20% margin but a 25% markup.',
      'Margin shows how much of each pound of sales is kept before overheads; markup is the quick way from a cost to a price list.'
    ],
    formula: {
      text: 'When you solve for price, the cost is divided by the share of the price left after the margin. Margin and markup also convert into each other without knowing the cost at all.',
      expr: [
        'price = cost ÷ (1 − margin)      cost = price × (1 − margin)',
        'markup = margin ÷ (1 − margin)      margin = markup ÷ (1 + markup)',
        'price multiplier = price ÷ cost = 1 + markup'
      ],
      vars: [['margin', 'profit ÷ selling price, as a decimal'], ['markup', 'profit ÷ cost, as a decimal'], ['multiplier', 'the figure to multiply the cost by to reach the price']]
    },
    worked: {
      inputs: { solve: 'price', cost: 24, price: 100, margin: 35, units: 500 },
      text: 'A shop buys a lamp at £24 and wants a 35% margin. The price is £24 ÷ 0.65 = £36.92, leaving £12.92 of profit per lamp. As a markup that is 53.846%, a multiplier of 1.5385 on cost. Selling 500 lamps brings in £18,461.54 of revenue and £6,461.54 of gross profit.',
      check: [['price', '£36.92'], ['profit', '£12.92'], ['markupPct', '53.846%'], ['multiplier', '1.5385'], ['totalRevenue', '£18,461.54'], ['totalProfit', '£6,461.54']]
    },
    uses: [
      ['Pricing a new product line', 'Set the shelf price from the landed cost and the margin your business plan assumes.'],
      ['Negotiating with a supplier', 'Solve for cost to find the most you can pay and still hold your margin at a fixed retail price.'],
      ['Reading a trade price list', 'Turn a supplier’s quoted markup into the margin your accounts will show.'],
      ['Checking a promotion', 'Enter the discounted price as the selling price and see how much margin the offer leaves.']
    ],
    mistakes: [
      'Adding the target margin as a markup. Pricing the £24 lamp at cost plus 35% gives £32.40 and a margin of only 25.926%.',
      'Working out margin on a VAT-inclusive price. At £36 including 20% VAT, the £24 lamp seems to earn 33.333%; on the £30 the business keeps after VAT, the margin is 20%.',
      'Leaving delivery, packaging and card fees out of the unit cost.'
    ],
    faq: [
      { q: 'What is the most I can pay for a product I sell at £50 if I need a 45% margin?', a: 'Solve for cost: £50 × 0.55 = £27.50. On that cost, the £22.50 of profit is a markup of 81.818%.' },
      { q: 'What margin does a 20% markup give?', a: '16.667%. Divide the markup by one plus the markup: 0.20 ÷ 1.20. An item costing £20 and sold at £24 shows it: the £4 profit is 20% of the cost but only 16.667% of the price.' },
      { q: 'Is gross margin the same as net margin?', a: 'No. This tool works out gross margin on one product, from its own cost and price. Net margin also takes off rent, wages and other overheads, so it is always lower.' }
    ],
    checks: [
      { inputs: { solve: 'margin', cost: 24, price: 30, units: 1 }, key: 'marginPct', shown: '20%' },
      { inputs: { solve: 'margin', cost: 24, price: 30, units: 1 }, key: 'markupPct', shown: '25%' },
      { inputs: { solve: 'margin', cost: 24, price: 32.4, units: 1 }, key: 'marginPct', shown: '25.926%' },
      { inputs: { solve: 'margin', cost: 24, price: 36, units: 1 }, key: 'marginPct', shown: '33.333%' },
      { inputs: { solve: 'cost', price: 50, margin: 45, units: 1 }, key: 'cost', shown: '£27.50' },
      { inputs: { solve: 'cost', price: 50, margin: 45, units: 1 }, key: 'markupPct', shown: '81.818%' },
      { inputs: { solve: 'margin', cost: 20, price: 24, units: 1 }, key: 'marginPct', shown: '16.667%' }
    ]
  },

  '/business/roi/': {
    term: 'ROI',
    whatIs: [
      'Return on investment (ROI) is the net gain from spending money, expressed as a percentage of what was spent. If £5,000 comes back as £6,000, the gain is £1,000 and the ROI is 20%.',
      'On its own it ignores how long the money was tied up, which is why the tool also gives the annualised return and the payback period.'
    ],
    formula: {
      text: 'ROI compares the total return with the cost. The annualised figure is the steady yearly rate that would turn the cost into the total return over the holding period; payback divides the cost by one year’s cash inflow.',
      expr: [
        'ROI = (total return − cost) ÷ cost × 100',
        'annualised return = (total return ÷ cost)^(1 ÷ years) − 1',
        'return multiple = total return ÷ cost      payback = cost ÷ annual cash inflow'
      ],
      vars: [['total return', 'everything the investment brings back, gross, including any sale value'], ['years', 'the holding period'], ['annual cash inflow', 'what it brings in each year, used only for payback']]
    },
    worked: {
      inputs: { cost: 12000, gain: 18500, years: 4, annualCash: 4500 },
      text: 'A bakery spends £12,000 on a second oven. It adds £4,500 a year of profit for four years and sells for £500 at the end, a total return of £18,500. The net gain is £6,500 and the ROI 54.167%, a return multiple of 1.5417. Spread over four years, that is 11.429% a year, and the oven has paid for itself after 2.6667 years.',
      check: [['netGain', '£6,500'], ['roi', '54.167%'], ['multiple', '1.5417'], ['annualised', '11.429%'], ['payback', '2.6667']]
    },
    uses: [
      ['Judging a marketing campaign', 'Enter the spend and the gross profit it produced, not the sales, to see whether it paid.'],
      ['Comparing offers with different terms', 'Put two investments held for different lengths of time on the same yearly footing.'],
      ['Setting a payback rule', 'Screen out purchases that will not pay for themselves within, say, three years.'],
      ['Reviewing a past decision', 'Check whether a finished project returned what its business case promised.']
    ],
    mistakes: [
      'Using sales as the return. A campaign that cost £5,000 and brought in £6,000 of orders has not made 20%; only the profit on those orders counts.',
      'Typing the net gain into the total return box. It wants the gross figure: enter £6,500 instead of £18,500 for the oven and the tool reports a loss.',
      'Comparing ROI across different holding periods. The oven’s 54.167%, earned in two years instead of four, would be 24.164% a year.'
    ],
    faq: [
      { q: 'What yearly return doubles money in seven years?', a: 'About 10.409% a year. Enter any cost, twice that as the total return and 7 years: the ROI shows 100% and the annualised figure 10.409%.' },
      { q: 'What is a good ROI?', a: 'One that beats the next-best use of the money over the same period, allowing for risk. A 50% return over three years is 14.471% a year; set that against your borrowing cost or the interest on cash.' },
      { q: 'Why is no payback period shown?', a: 'Payback needs an annual cash inflow. With that box at zero, the tool has nothing to divide the cost by, so it leaves payback out.' }
    ],
    checks: [
      { inputs: { cost: 5000, gain: 6000, years: 1, annualCash: 0 }, key: 'roi', shown: '20%' },
      { inputs: { cost: 5000, gain: 6000, years: 1, annualCash: 0 }, key: 'netGain', shown: '£1,000' },
      { inputs: { cost: 12000, gain: 18500, years: 2, annualCash: 4500 }, key: 'annualised', shown: '24.164%' },
      { inputs: { cost: 10000, gain: 20000, years: 7, annualCash: 0 }, key: 'annualised', shown: '10.409%' },
      { inputs: { cost: 10000, gain: 20000, years: 7, annualCash: 0 }, key: 'roi', shown: '100%' },
      { inputs: { cost: 5000, gain: 7500, years: 3, annualCash: 0 }, key: 'annualised', shown: '14.471%' }
    ]
  },

  '/business/currency-converter/': {
    whatTitle: 'What is a mid-market rate?',
    whatIs: [
      'An exchange rate is the price of one currency in another. The mid-market rate sits halfway between what dealers pay for a currency and what they sell it for, and it is the dated figure this converter shows.',
      'It is the fair benchmark to hold a bank’s or card provider’s offer against, and the usual basis for bookkeeping.'
    ],
    formula: {
      text: 'A conversion multiplies the amount by the rate from one currency to the other. The reverse rate is one divided by the forward rate, so converting straight back at the same rate returns the original sum.',
      expr: [
        'converted amount = amount × rate (from → to)',
        'reverse rate = 1 ÷ rate',
        'provider’s margin = (amount paid − mid-market amount) ÷ mid-market amount'
      ],
      vars: [['rate', 'units of the “to” currency that one unit of the “from” currency buys'], ['amount', 'the sum in the “from” currency']]
    },
    worked: {
      illustrative: true,
      inputs: { amount: 4800, from: 'EUR', to: 'GBP' },
      text: 'This example uses an assumed rate, not today’s. At a rate of 1 EUR = £0.85, a €4,800 invoice from a German supplier converts to £4,080.00. The reverse rate is 1 ÷ 0.85, so £1 buys about €1.1765. If your bank charges £4,176.00 to pay the same invoice, it has applied 1 EUR = £0.87, and the extra £96 is its margin, about 2.35% of the mid-market figure.'
    },
    uses: [
      ['Recording a foreign bill', 'Put a sterling figure on a supplier’s euro or dollar invoice when it is entered in the books.'],
      ['Checking a card statement', 'Compare a foreign purchase on a statement with the mid-market figure for the same date to see the margin taken.'],
      ['Quoting an overseas customer', 'Price a job in the customer’s currency, then add a buffer for the rate moving before they pay.']
    ],
    mistakes: [
      'Using the rate the wrong way round. 1 EUR = £0.85 and £1 = €1.1765 describe the same rate; multiplying by one where you need the other gives a figure that is badly wrong, so check the direction in the result line.',
      'Treating the converted figure as the amount that will arrive. A transfer service converts at its own rate and may add a fixed fee, so the sum received is lower.'
    ],
    faq: [
      { q: 'How do I work out the margin my bank charged?', a: 'Divide the difference between what you paid and the mid-market amount by the mid-market amount. Paying £4,176.00 for €4,800 when the mid-market rate gives £4,080.00 is a £96 margin, about 2.35%.' },
      { q: 'Why does converting back not give my original amount?', a: 'At the mid-market rate it does: €4,800 at £0.85 is £4,080, and £4,080 divided by 0.85 is €4,800 again. A provider takes a margin on each conversion, so a round trip loses money twice.' },
      { q: 'Can I convert at a rate from a past date?', a: 'No. The converter shows the latest daily rate and its date. For an older transaction, use the rate your bank applied or the one your accounting policy names.' }
    ]
  }
};
