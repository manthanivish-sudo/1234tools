'use strict';
/* Story data for the Finance & Accounting section (/finance/). Contract: kit2-schema.md §1–2.
   Neutral-currency browser calculators; the page shows the visitor's own currency,
   so hooks carry plain figures and the captured example supplies the symbol. */

const PROOF = ['Free', 'No sign-up', 'Runs in your browser'];

module.exports = {
  '/finance/compound-interest/': {
    persona: 'Savers and first-time investors',
    hook: '200 a month for 30 years. Guess what it becomes.',
    pain: 'You know saving early matters. You have no idea what your monthly habit is worth in 30 years.',
    usual: ['Leaflets that show one example', 'A spreadsheet formula half remembered', 'Rules of thumb that skip top-ups'],
    promise: 'Enter a deposit, rate and monthly top-up. See balance and interest.',
    steps: ['Enter what you start with', 'Add rate, years and top-ups', 'Read the final balance'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { principal: 10000, rate: 7, years: 30, freq: 12, contribution: 200 } },
    howTo: 'How to work out compound interest with top-ups',
    cta: 'Grow my savings'
  },

  '/finance/loan-payment/': {
    persona: 'Anyone about to borrow',
    hook: 'Borrow 250,000 at 6.5%. How much do you pay back?',
    pain: 'The lender quotes a monthly payment. The total interest only shows up once the paperwork arrives.',
    usual: ['Lender calculators that lead to a form', 'Interest buried in the small print', 'Guessing the term that fits your budget'],
    promise: 'Enter amount, rate and term. See the payment and the full cost.',
    steps: ['Enter the loan amount', 'Add the rate and term', 'Compare payment and interest'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { amount: 250000, rate: 6.5, years: 30 } },
    howTo: 'How to work out the true cost of a loan',
    cta: 'Cost my loan'
  },

  '/finance/vat-sales-tax/': {
    persona: 'Sole traders and bookkeepers',
    hook: 'Receipt says 540 including VAT. How much was VAT?',
    pain: 'Taking 20% off a gross total gives the wrong answer, and the wrong figure on your return.',
    usual: ['Subtracting 20% and hoping', 'A calculator that only goes one way', 'Rebuilding the formula each quarter'],
    promise: 'Add tax to a net price or pull it out of a gross one, at any rate.',
    steps: ['Enter the amount', 'Pick net or gross, set the rate', 'Read net, tax and gross'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { amount: 540, rate: 20, mode: 'gross' } },
    howTo: 'How to take VAT out of a gross price, free',
    cta: 'Split out the VAT'
  }
};
