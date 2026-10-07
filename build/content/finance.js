/**
 * The reading part of the Finance calculators, rendered by build-depth.js.
 * Shape and rules: build-depth.js and build/content/_check.js. Every number
 * is computed with the page's own engine and listed in worked.check / checks;
 * the VAT page uses only the 20% UK standard rate the page presents.
 */
'use strict';

module.exports = {
  '/finance/compound-interest/': {
    term: 'compound interest',
    whatIs: [
      'Compound interest is interest earned on earlier interest as well as on the original deposit. Each time interest is added, the next period’s interest is worked out on the larger balance, so growth speeds up the longer the money stays put.',
      'The same mechanism works against you on a debt that adds unpaid interest to the balance.'
    ],
    formula: {
      text: 'The balance grows by the periodic rate once per compounding period. Regular contributions are added at the end of each period, and each one compounds for the periods left after it.',
      expr: [
        'A = P × (1 + r ÷ n)ⁿᵗ + PMT × ((1 + r ÷ n)ⁿᵗ − 1) ÷ (r ÷ n)',
        'effective annual rate = (1 + r ÷ n)ⁿ − 1',
        'interest = A − (P + PMT × n × t)'
      ],
      vars: [['P', 'the starting deposit'], ['r', 'the annual rate as a decimal'], ['n', 'compounding periods a year: 1, 2, 4, 12 or 365'], ['t', 'the number of years'], ['PMT', 'the contribution added each period']]
    },
    worked: {
      inputs: { principal: 5000, rate: 4.5, years: 15, freq: '12', contribution: 100 },
      text: 'Start with £5,000 at 4.5% a year, compounded monthly, and add £100 a month for 15 years. You pay in £23,000 in all. The balance reaches £35,449.24, so £12,449.24 of it is interest, more than half as much again as the money paid in. Monthly compounding turns the 4.5% headline rate into an effective 4.594% a year.',
      check: [['invested', '£23,000'], ['total', '£35,449.24'], ['interest', '£12,449.24'], ['effectiveRate', '4.594%']]
    },
    uses: [
      ['Comparing savings accounts', 'Put two accounts with different compounding on their effective annual rate before choosing.'],
      ['Planning a regular saving habit', 'See what a fixed monthly amount grows to by a target date, such as a house deposit or university fees.'],
      ['Seeing the cost of waiting', 'Run the same plan over 15 years and over 10 to see what starting five years late costs.'],
      ['Understanding debt growth', 'Model a balance that has interest added and no repayments to see how fast it climbs.']
    ],
    mistakes: [
      'Entering a monthly saving with annual compounding. The contribution is per period, so “Annually” with £100 means £100 a year; enter £1,200 instead. Even then the plan above ends at £34,617.28, below the monthly result, as each year’s savings goes in at the year end.',
      'Entering an AER as if it were the nominal rate. If a bank quotes 4.594% AER on a monthly account, entering that with monthly compounding counts the compounding twice; enter it with annual compounding instead.'
    ],
    faq: [
      { q: 'How much difference does daily compounding make?', a: 'Very little next to the rate itself. £10,000 at 5% for 10 years grows to £16,288.95 compounded annually, £16,470.09 monthly and £16,486.65 daily.' },
      { q: 'How long does it take to double money at 6%?', a: 'About 12 years. £10,000 at 6% compounded once a year reaches £20,121.96 after 12 years, which is where the rule of 72 comes from: 72 ÷ 6 = 12.' },
      { q: 'How much of the final balance comes from the regular payments?', a: 'Run it again with the starting deposit set to 0. On its own, £100 a month for 15 years at 4.5% grows to £25,641.47, of which £7,641.47 is interest.' }
    ],
    checks: [
      { inputs: { principal: 5000, rate: 4.5, years: 15, freq: '1', contribution: 1200 }, key: 'total', shown: '£34,617.28' },
      { inputs: { principal: 10000, rate: 5, years: 10, freq: '1', contribution: 0 }, key: 'total', shown: '£16,288.95' },
      { inputs: { principal: 10000, rate: 5, years: 10, freq: '12', contribution: 0 }, key: 'total', shown: '£16,470.09' },
      { inputs: { principal: 10000, rate: 5, years: 10, freq: '365', contribution: 0 }, key: 'total', shown: '£16,486.65' },
      { inputs: { principal: 10000, rate: 6, years: 12, freq: '1', contribution: 0 }, key: 'total', shown: '£20,121.96' },
      { inputs: { principal: 0, rate: 4.5, years: 15, freq: '12', contribution: 100 }, key: 'total', shown: '£25,641.47' },
      { inputs: { principal: 0, rate: 4.5, years: 15, freq: '12', contribution: 100 }, key: 'interest', shown: '£7,641.47' }
    ]
  },

  '/finance/loan-payment/': {
    whatTitle: 'What does a monthly loan payment cover?',
    whatIs: [
      'A fixed-rate personal, car or mortgage loan is usually repaid in equal monthly amounts. Each payment covers the interest charged on what you still owe that month, and whatever is left over pays down the debt, so the final payment clears it exactly.',
      'The monthly figure decides affordability; the total paid decides value, and a longer term trades one for the other.'
    ],
    formula: {
      text: 'The yearly rate is divided by 12 and the term multiplied by 12. The payment is then the sum that, with interest compounded monthly, repays the loan in exactly that many months; at a 0% rate it is simply the loan divided by the months.',
      expr: [
        'M = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1)',
        'r = annual rate ÷ 100 ÷ 12      n = years × 12',
        'total paid = M × n      total interest = M × n − P'
      ],
      vars: [['M', 'the monthly payment'], ['P', 'the amount borrowed'], ['r', 'the monthly rate as a decimal'], ['n', 'the number of monthly payments']]
    },
    worked: {
      inputs: { amount: 18000, rate: 7.9, years: 5 },
      text: 'Borrow £18,000 for a car at 7.9% over five years. The payment is £364.11 a month, and the 60 payments add up to £21,846.86, so the loan costs £3,846.86 in interest, 21.371% of the price of the car. In the first month, interest is £18,000 × 0.079 ÷ 12 = £118.50, which leaves £245.61 of that payment to reduce the balance.',
      check: [['monthly', '£364.11'], ['totalPaid', '£21,846.86'], ['totalInterest', '£3,846.86'], ['interestRatio', '21.371%']]
    },
    uses: [
      ['Choosing a car finance term', 'Compare three, five and seven years on the same price before visiting the dealer.'],
      ['Testing a remortgage rate', 'See how much a new fixed rate changes the monthly payment on the balance you still owe.'],
      ['Budgeting for a personal loan', 'Find the largest amount whose payment fits the money left after bills.']
    ],
    mistakes: [
      'Entering the APR in place of the interest rate on the agreement. APR also folds in fees, so it overstates the payment slightly.',
      'Stretching the term to make the payment fit. On £18,000 at 7.9%, seven years cuts the payment to £279.66 but raises the interest to £5,491.10, against £2,276.08 over three years at £563.22 a month.',
      'Comparing a PCP deal with this figure. PCP car finance leaves a large final payment that this calculator does not model, so its monthly amount looks lower.'
    ],
    faq: [
      { q: 'How much does a 1% rise in the rate add to a mortgage payment?', a: 'On £200,000 over 25 years, the payment is £1,111.66 a month at 4.5% and £1,228.17 at 5.5%. Over the full term the interest grows from £133,499.49 to £168,452.50.' },
      { q: 'What does a 0% loan cost each month?', a: 'The amount divided by the number of months: £18,000 over five years is £300 a month, with nothing added. Enter any arrangement fee under Fees and APR to see the APR.' },
      { q: 'Can I work out how much I can borrow from a payment I can afford?', a: 'Not directly. Try amounts until the payment matches your budget; at a fixed rate and term the payment scales in proportion, so halving the loan halves it.' }
    ],
    checks: [
      { inputs: { amount: 18000, rate: 7.9, years: 7 }, key: 'monthly', shown: '£279.66' },
      { inputs: { amount: 18000, rate: 7.9, years: 7 }, key: 'totalInterest', shown: '£5,491.10' },
      { inputs: { amount: 18000, rate: 7.9, years: 3 }, key: 'totalInterest', shown: '£2,276.08' },
      { inputs: { amount: 18000, rate: 7.9, years: 3 }, key: 'monthly', shown: '£563.22' },
      { inputs: { amount: 200000, rate: 4.5, years: 25 }, key: 'monthly', shown: '£1,111.66' },
      { inputs: { amount: 200000, rate: 5.5, years: 25 }, key: 'monthly', shown: '£1,228.17' },
      { inputs: { amount: 200000, rate: 4.5, years: 25 }, key: 'totalInterest', shown: '£133,499.49' },
      { inputs: { amount: 200000, rate: 5.5, years: 25 }, key: 'totalInterest', shown: '£168,452.50' },
      { inputs: { amount: 18000, rate: 0, years: 5 }, key: 'monthly', shown: '£300' }
    ]
  },

  '/finance/vat-sales-tax/': {
    term: 'VAT',
    whatIs: [
      'Value Added Tax is a tax on sales that a VAT-registered business adds to its prices and pays to HMRC, less the VAT on its own purchases. Sales tax works out the same on the price but is usually charged only once, at the final sale.',
      'Either way, a price has the tax still to be added (net) or already inside it (gross).'
    ],
    formula: {
      text: 'Adding tax multiplies the net price by one plus the rate. Removing it divides the gross by the same factor, and the tax is the difference. At the UK standard rate of 20%, the VAT inside any gross figure is exactly one sixth of it.',
      expr: [
        'gross = net × (1 + rate ÷ 100)',
        'net = gross ÷ (1 + rate ÷ 100)      tax = gross − net',
        'at 20%: VAT = gross ÷ 6 = net ÷ 5'
      ],
      vars: [['net', 'the price before tax'], ['gross', 'the price including tax'], ['rate', 'the tax rate in per cent, for example 20']]
    },
    worked: {
      inputs: { amount: 1875, rate: 20, mode: 'net' },
      text: 'A decorator quotes £1,875 for labour and materials, before VAT. At 20%, the VAT is £375 and the invoice total is £2,250. Working backwards from that £2,250 later, the tool returns the £1,875 net figure, and £2,250 ÷ 6 gives the same £375 of VAT.',
      check: [['tax', '£375'], ['gross', '£2,250'], ['net', '£1,875']]
    },
    uses: [
      ['Raising a VAT invoice', 'Turn a net quote into the VAT line and invoice total the customer will see.'],
      ['Recording receipts', 'Split a till receipt’s total into net and VAT for the books or the VAT return.'],
      ['Setting consumer prices', 'Work back from a round shelf price, such as £49.99 including VAT, to the £41.66 the business keeps.']
    ],
    mistakes: [
      'Rounding VAT on every line and expecting it to match VAT on the total. Three items at £1.10 including VAT carry £0.18 each, £0.54 in all, but their £3.30 total carries £0.55; pick one method and keep to it.',
      'Adding VAT to a price that already includes it, which charges the customer the tax twice. Check whether a supplier’s price list is net or gross before entering it.',
      'Applying 20% to every item. Some goods and services are taxed at a lower rate or not at all, so confirm the rate for each line before entering it.'
    ],
    faq: [
      { q: 'How do I work out VAT backwards in my head?', a: 'At 20%, divide the gross by 6 for the VAT, or by 1.2 for the net. On a £49.99 price that is £8.33 of VAT and £41.66 net.' },
      { q: 'Does it work for US sales tax?', a: 'Yes, for any single rate: enter the combined rate as a percentage and choose Net, since US shelf prices are usually shown before tax. An $80 item at an 8% rate comes to $86.40, with $6.40 of tax.' },
      { q: 'Can I reclaim the VAT this works out?', a: 'Only if your business is VAT-registered, the purchase is for the business, and you hold a valid VAT invoice.' }
    ],
    checks: [
      { inputs: { amount: 49.99, rate: 20, mode: 'gross' }, key: 'net', shown: '£41.66' },
      { inputs: { amount: 49.99, rate: 20, mode: 'gross' }, key: 'tax', shown: '£8.33' },
      { inputs: { amount: 1.10, rate: 20, mode: 'gross' }, key: 'tax', shown: '£0.18' },
      { inputs: { amount: 3.30, rate: 20, mode: 'gross' }, key: 'tax', shown: '£0.55' },
      { inputs: { amount: 80, rate: 8, mode: 'net' }, key: 'gross', shown: '$86.40' },
      { inputs: { amount: 80, rate: 8, mode: 'net' }, key: 'tax', shown: '$6.40' }
    ],
    related: { guides: ['/guides/vat-return-from-spreadsheet/'] }
  }
};
