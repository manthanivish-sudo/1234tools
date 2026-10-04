/**
 * Guides, second batch: the everyday how-tos.
 *
 * The first batch (build/guides.js) is about finishing a business job end
 * to end. These answer the questions people actually type — how to work
 * out a percentage, how to take GST out of a price, how to get a photo
 * under a portal's size limit — and each one ends in the tool that does it.
 *
 * Same shape, same rules, same builder. build/guides.js appends this array
 * to its own when the file exists, and adds the AUTHORITIES below to its
 * list, because these guides cite bodies the business guides never needed:
 * the WHO for BMI, the RBI for loans, CBSE for its CGPA rule, the IETF for
 * JSON, the JPEG committee and ISO for file formats and paper sizes.
 *
 * Every figure in a worked example was put through the tool's own engine
 * (engine/<file>.js loaded in a vm, window.TOOLS[slug].compute) on the
 * checked date, so the guide and the tool cannot disagree. File tools are
 * described from what their pages and engines actually do.
 *
 * A step's `tool` block may carry `fill`: the inputs the tool reads from
 * the URL fragment (render-core.js and render-dev.js both read #key=value),
 * so the reader lands on the tool with the guide's example already in it.
 * `fillLabel` is the wording of that link. A builder that does not know
 * about `fill` simply ignores it, and the step still links the tool plainly
 * — which is why no `why` below promises the figures will be there.
 */
'use strict';

/* Authorities these guides cite beyond the business list in build/guides.js.
   Each is the body that sets or publishes the thing being cited. */
const AUTHORITIES = [
  'gstcouncil.gov.in', 'www.gstcouncil.gov.in',
  'rbi.org.in', 'www.rbi.org.in',
  'who.int', 'www.who.int',
  'cbse.gov.in', 'www.cbse.gov.in',
  'jpeg.org', 'www.jpeg.org',
  'iso.org', 'www.iso.org',
  'rfc-editor.org', 'www.rfc-editor.org',
  /* the third batch: units, investing, attendance */
  'nist.gov', 'www.nist.gov',
  'bipm.org', 'www.bipm.org',
  'sebi.gov.in', 'www.sebi.gov.in',
  'pib.gov.in', 'www.pib.gov.in'
];

/* Each source was opened and read on the checked date. */
const SRC = {
  gstCouncil: ['GST Council — recommendations of the 56th meeting (press release, September 2025)', 'https://gstcouncil.gov.in/sites/default/files/2025-09/press_release_press_information_bureau_0.pdf'],
  cbicGst: ['CBIC-GST — rates, notifications and the tariff', 'https://cbic-gst.gov.in/'],
  gstPortal: ['Goods and Services Tax portal', 'https://www.gst.gov.in/'],
  rbiReset: ['Reserve Bank of India — Reset of floating interest rate on EMI-based personal loans (circular of 18 August 2023)', 'https://www.rbi.org.in/scripts/NotificationUser.aspx?Id=12529&Mode=0'],
  rbiForeclosure: ['Reserve Bank of India — Levy of foreclosure charges/pre-payment penalty on floating rate term loans (7 May 2014)', 'https://www.rbi.org.in/commonman/english/scripts/Notification.aspx?Id=1381'],
  whoObesity: ['World Health Organization — Obesity and overweight (fact sheet)', 'https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight'],
  whoGho: ['World Health Organization — Global Health Observatory: body mass index', 'https://www.who.int/data/gho/data/themes/topics/topic-details/GHO/body-mass-index'],
  whoGrowth: ['World Health Organization — Growth reference data for 5 to 19 years', 'https://www.who.int/tools/growth-reference-data-for-5to19-years'],
  jpeg: ['The JPEG committee — JPEG 1 (ISO/IEC 10918)', 'https://jpeg.org/jpeg/'],
  iso216: ['ISO 216:2007 — the A and B series of paper sizes', 'https://www.iso.org/standard/36631.html'],
  rfc8259: ['IETF RFC 8259 — The JavaScript Object Notation (JSON) Data Interchange Format', 'https://www.rfc-editor.org/rfc/rfc8259'],
  cbseCgpa: ['CBSE Circular No. 24 of 28 May 2010 — grading at secondary level, and the indicative percentage', 'https://www.cbse.gov.in/circulars/cir24-2010.pdf'],
  sebiMfFaq: ['SEBI — FAQs for Mutual Fund Investors (updated as on 31 August 2024)', 'https://www.sebi.gov.in/sebi_data/faqfiles/sep-2024/1727242783639.pdf'],
  cbdtCapitalGains: ['Press Information Bureau — FAQs issued by CBDT on the new capital gains tax regime (24 July 2024)', 'https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=2036604&reg=3&lang=2'],
  itrApplicable: ['Income Tax Department e-filing — which return applies to a salaried individual', 'https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1'],
  cbseAttendance: ['CBSE — Strict compliance with attendance requirements for Board examination eligibility (circular of 4 August 2025)', 'https://www.cbse.gov.in/cbsenew/documents/Strict_Compliance_attendance_Eligibility_05082025.pdf'],
  ukBankHolidays: ['gov.uk — UK bank holidays', 'https://www.gov.uk/bank-holidays'],
  nistHb44: ['NIST Handbook 44 (2026), Appendix B — Units and Systems of Measurement', 'https://www.nist.gov/system/files/documents/2025/12/30/appb-26-HB44-20251210.pdf'],
  nistSp811: ['NIST Guide to the SI (SP 811), Appendix B.8 — conversion factors listed alphabetically', 'https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8'],
  ukWma1985: ['legislation.gov.uk — Weights and Measures Act 1985, Schedule 1', 'https://www.legislation.gov.uk/ukpga/1985/72/schedule/1'],
  bipmKg: ['BIPM — SI base unit: the kilogram', 'https://www.bipm.org/en/si-base-units/kilogram'],
  rfc4180: ['IETF RFC 4180 — Common Format and MIME Type for Comma-Separated Values (CSV) Files', 'https://www.rfc-editor.org/rfc/rfc4180']
};
const src = (key, note) => { const s = SRC[key]; return note ? [s[0], s[1], note] : [s[0], s[1]]; };

/* One date for every fact block in this file, so a review is one pass. */
const CHECKED = '2026-10-04';

/* The JSON guide's two examples, built without escape sequences so that
   nothing in this file depends on how a backslash survives an editor. */
const NL = String.fromCharCode(10);
const JSON_BROKEN = ['{', '  "invoice": "INV-0042",', '  "total": 29500,', '  "paid": false,', '}'].join(NL);
const JSON_MINIFIED = '{"invoice":"INV-0042","total":29500,"paid":false,"lines":[{"item":"Desk","qty":2},{"item":"Chair","qty":4}]}';
const textFill = (s) => 'text=' + encodeURIComponent(s);

/* The CSV guide's example, built the same way: one string per line. */
const CSV_LINES = ['invoice,customer,city,total', 'INV-0101,Asha Traders,Pune,29500', 'INV-0102,"Khan, Patel & Co",Leeds,1180.50', 'INV-0103,Riverside Café,Bristol,'];
const CSV_INVOICES = CSV_LINES.join(NL);

const GUIDES = [

  /* ================================================================== */
  {
    slug: 'calculate-a-percentage',
    glyph: 'i-percentage',
    name: 'How to calculate a percentage',
    title: 'How to calculate a percentage — the formula, worked examples and the usual mistakes',
    description: 'What percentage one number is of another, a percentage of an amount, percentage increase and decrease, and how to reverse a percentage — one formula, worked through with real numbers.',
    answer: 'To find what percentage one number is of another, divide the part by the whole and multiply by 100: 36 out of 48 is 36 ÷ 48 × 100 = 75%. To take a percentage of an amount, multiply the amount by the percentage and divide by 100: 15% of 1,200 is 1,200 × 15 ÷ 100 = 180.',
    minutes: { first: 'five minutes', again: 'seconds' },
    howLong: 'Seconds, once you have decided which of the three questions you are asking — which is the only part that takes thought. If a percentage answer looks wrong, it is almost never the arithmetic; it is the wrong number on the bottom of the fraction.',
    before: [
      'The two numbers, and a clear idea of which one is the whole. Nearly every wrong percentage comes from dividing by the wrong one.',
      'For a change over time, the old value and the new value, in that order. The old value is always the one you divide by.',
      'A calculator, or the Percentage Calculator, which gives all six readings of the same two numbers at once so you can pick the one you meant.'
    ],
    steps: [
      {
        name: 'Decide which percentage question you are asking',
        body: [
          { p: 'Every everyday percentage is one of three questions, and each has its own one-line formula. Getting the question right is most of the job.' },
          { ul: [
            'What percentage is one number of another? 36 marks out of 48, 18 days absent out of 220.',
            'What is a given percentage of an amount? 15% of 1,200, 18% GST on a price, a 10% tip.',
            'By what percentage did something change? A price that went from 1,200 to 1,380, a score that fell from 80 to 60.'
          ] },
          { p: 'A fourth question — what was the number before a percentage was added or taken off — is the one people most often get wrong, and it has its own step below.' }
        ]
      },
      {
        name: 'Work out what percentage one number is of another',
        body: [
          { formula: 'percentage = part ÷ whole × 100' },
          { p: 'Divide the part by the whole, then multiply by 100. For 36 marks out of 48: 36 ÷ 48 = 0.75, and 0.75 × 100 = 75%. The whole is the total that the part belongs to — the maximum marks, the total number of days, the full bill.' },
          { p: 'A quick check that saves embarrassment: if the part is smaller than the whole, the answer must be under 100%. If you get 133%, you have divided the wrong way round.' },
          { tool: '/mathematics/percentage/', why: 'puts two numbers through every percentage reading at once — A as a share of B, A% of B, the change from A to B, and the rest', fill: 'value=36&total=48', fillLabel: 'Do it in the calculator with 36 and 48 already in — it shows 75%' }
        ]
      },
      {
        name: 'Work out a percentage of an amount — and add or take it off',
        body: [
          { formula: 'amount × percentage ÷ 100' },
          { p: '15% of 1,200 is 1,200 × 15 ÷ 100 = 180. To increase 1,200 by 15%, add that on — 1,380 — or do it in one go by multiplying by 1.15. To reduce 1,200 by 15%, multiply by 0.85 and get 1,020.' },
          { p: 'In your head, build from 10% by moving the decimal point one place left: 10% of 1,200 is 120, 5% is 60, so 15% is 180.' },
          { tool: '/mathematics/percentage/', why: 'with the percentage as A and the amount as B, it gives A% of B, B increased by A% and B decreased by A% side by side', fill: 'value=15&total=1200', fillLabel: 'Open it with 15% and 1,200 — it shows 180, 1,380 and 1,020' }
        ]
      },
      {
        name: 'Work out a percentage increase or decrease',
        body: [
          { formula: 'percentage change = (new − old) ÷ old × 100' },
          { p: 'Subtract the old value from the new one, divide by the old value, multiply by 100. A price that went from 1,200 to 1,380 rose by 180, and 180 ÷ 1,200 × 100 = 15%. A score that fell from 80 to 60 changed by −20, and −20 ÷ 80 × 100 = −25%: a fall of 25%.' },
          { p: 'The direction matters. Going back up from 60 to 80 is a rise of 20 ÷ 60 = 33.3%, not 25%, because the starting point is smaller — which is why a 25% fall needs a 33.3% rise to undo it.' },
          { p: 'When neither number is the starting point — two shops’ prices, two candidates’ scores — use percentage difference: the gap divided by the average of the two. 36 and 48 differ by 12 and average 42, so they are 28.57% apart either way round.' },
          { tool: '/mathematics/percentage/', why: 'with the old value as A and the new value as B, the “% change from A to B” line is the answer, signed', fill: 'value=1200&total=1380', fillLabel: 'Check it with 1,200 and 1,380 already in — it shows a 15% change' }
        ]
      },
      {
        name: 'Reverse a percentage to find the original number',
        body: [
          { formula: 'after a rise: original = final ÷ (1 + percentage ÷ 100)' },
          { formula: 'after a cut: original = final ÷ (1 − percentage ÷ 100)' },
          { p: 'If a price is 540 after a 20% rise, the original is 540 ÷ 1.20 = 450. It is not 540 minus 20% (432), because the 20% was worked out on 450, not on 540. If a sale price is 360 after 25% off, the full price was 360 ÷ 0.75 = 480.' },
          { p: 'Check a reversed percentage by running it forwards: put 20 and 450 into the Percentage Calculator and “B increased by A%” reads 540. The same division takes tax out of a price that includes it.' },
          { example: {
            caption: 'Illustrative figures, invented for this guide. Each answer is what the Percentage Calculator’s own engine returns for them.',
            head: ['Question', 'Working', 'Answer'],
            rows: [
              ['36 out of 48 as a percentage', '36 ÷ 48 × 100', '75%'],
              ['15% of 1,200', '1,200 × 15 ÷ 100', '180'],
              ['1,200 increased by 15%', '1,200 × 1.15', '1,380'],
              ['Change from 1,200 to 1,380', '180 ÷ 1,200 × 100', '15%'],
              ['Change from 80 to 60', '−20 ÷ 80 × 100', '−25%'],
              ['Price before a 20% rise to 540', '540 ÷ 1.20', '450']
            ]
          } }
        ]
      }
    ],
    wrong: [
      { name: 'Dividing by the wrong number', text: 'The whole goes on the bottom: marks scored over marks available, not the other way round. For a change, the old value goes on the bottom, not the new one — 1,200 to 1,380 is 15% up, but dividing by 1,380 gives 13%, which is a different and wrong answer to the question asked.' },
      { name: 'Taking a percentage off to undo one that was added', text: 'A price of 540 that includes a 20% rise came from 450, not 432. Subtracting 20% of the final figure removes too much, because the rise was a percentage of the smaller original. Divide by 1.20 instead. The same error, with tax, understates the taxable value on every invoice it touches.' },
      { name: 'Adding percentages that happen one after another', text: 'A 20% fall followed by a 20% rise does not get you back where you started: 100 becomes 80, and 80 plus 20% is 96, so you are 4% down. Two 10% rises in a row make 21%, not 20%. Successive percentages multiply; they do not add.' },
      { name: 'Confusing percent with percentage points', text: 'If an interest rate goes from 5% to 7%, it has risen by 2 percentage points — and by 40% in relative terms. Both are true, and a headline can pick whichever sounds bigger.' },
      { name: 'Rounding in the middle of the sum', text: 'Round only the final answer. Rounding 36 ÷ 48 to 0.8 before multiplying by 100 turns 75% into 80%.' }
    ],
    faq: [
      { q: 'What is the formula for percentage?', a: 'Part divided by whole, multiplied by 100. For a percentage of an amount, it runs the other way: amount multiplied by the percentage, divided by 100. For a change, the difference divided by the old value, multiplied by 100.' },
      { q: 'How do I calculate percentage increase between two numbers?', a: 'Take the old number from the new one, divide by the old number and multiply by 100. From 1,200 to 1,380 is 180 ÷ 1,200 × 100 = 15%. A negative answer means it went down.' },
      { q: 'How do I work out a percentage of marks?', a: 'Marks obtained divided by maximum marks, times 100: 36 out of 48 is 75%. For papers with different maximums, add up all the marks and all the maximums first, then divide; averaging the separate percentages gives a different answer.' },
      { q: 'What is the difference between percentage change and percentage difference?', a: 'Percentage change has a direction and a starting point: it divides by the old value. Percentage difference has neither: it divides the gap by the average of the two numbers, so it gives the same answer whichever way round you put them. 36 and 48 are 28.57% apart; going from 36 to 48 is a 33.33% increase.' },
    ],
    tools: ['/mathematics/percentage/', '/education/marks-percentage/', '/business/discount-calculator/', '/mathematics/ratio-calculator/'],
    collections: ['students'],
    related: ['calculate-gst', 'convert-cgpa-to-percentage', 'calculate-emi']
  },

  /* ================================================================== */
  {
    slug: 'calculate-gst',
    glyph: 'i-gst-calculator',
    name: 'How to calculate GST in India',
    title: 'How to calculate GST in India — adding it, removing it, and splitting CGST, SGST and IGST',
    description: 'Add GST to a price, take it out of a GST-inclusive price, and split it into CGST and SGST or IGST — with the formulas, a worked invoice and the mistakes that cost money.',
    answer: 'To add GST, multiply the price by the rate: ₹25,000 at 18% carries ₹4,500 of GST, so the invoice total is ₹29,500. To take GST out of a price that already includes it, divide by one plus the rate — ₹11,800 ÷ 1.18 = ₹10,000 before tax, with ₹1,800 of GST — and never simply subtract 18%.',
    minutes: { first: 'ten minutes', again: 'under a minute' },
    howLong: 'Under a minute per figure once you know the rate and whether your price includes tax. Finding the right rate for a product the first time can take longer than every calculation after it, because the rate follows the HSN or SAC code, not the everyday name of the thing.',
    before: [
      'The amount, and whether it includes GST or not. A quotation is usually exclusive; a shelf price or a figure marked “inclusive of all taxes” already contains the tax.',
      'The GST rate for that specific item or service, which comes from its HSN code (goods) or SAC code (services).',
      'Where the supply is going — the place of supply. It decides whether the tax is split into CGST and SGST, or charged as a single IGST.'
    ],
    steps: [
      {
        name: 'Find the rate for what you are selling',
        body: [
          { p: 'GST is charged at a rate set for each category of goods and services, identified by its HSN or SAC code. The everyday name of a product is not enough: two things that look alike can sit under different codes at different rates. Look the code up, then the rate.' },
          { fact: {
            text: 'From 22 September 2025 the main GST rates are 5% and 18%, with a 40% rate on a short list of luxury and “sin” goods; the earlier 12% and 28% slabs were removed on the GST Council’s recommendation at its 56th meeting. Special rates remain for a few goods, such as 3% on gold and silver and 0.25% on rough diamonds, and some supplies are exempt or nil-rated. The rate for a particular item is fixed by the rate notifications CBIC publishes against its HSN or SAC code. Only a supplier registered for GST may charge it on an invoice. Whether a supply is taxed as CGST plus SGST or as IGST depends on its place of supply, under rules set out in the IGST Act.',
            checked: CHECKED,
            sources: [src('gstCouncil', 'the 5%, 18% and 40% structure and the date it took effect'), src('cbicGst', 'rate notifications by HSN and SAC code, and the Acts'), src('gstPortal', 'registration and returns')]
          } }
        ]
      },
      {
        name: 'Decide whether your figure includes GST',
        body: [
          { p: 'An exclusive figure is the taxable value: GST goes on top. An inclusive figure already has GST inside it: the job is to separate the two. Getting it backwards on ₹11,800 at 18% gives ₹13,924 (tax added twice) or ₹9,676 (tax taken off the wrong base) — both wrong.' }
        ]
      },
      {
        name: 'Add GST to a price that does not include it',
        body: [
          { formula: 'GST = taxable value × rate ÷ 100' },
          { formula: 'total = taxable value + GST' },
          { p: 'For a ₹25,000 job at 18%: 25,000 × 18 ÷ 100 = ₹4,500 of GST, so the invoice total is ₹29,500. Or in one step, 25,000 × 1.18 = 29,500. For goods sold by quantity, work out the taxable value first — 40 units at ₹450 is ₹18,000 — and at 5% that carries ₹900 of GST, a total of ₹18,900.' },
          { tool: '/india/gst-calculator/', why: 'adds or removes GST at the current slabs and shows the taxable value, the tax, the total and the CGST, SGST or IGST split', fill: 'amount=25000&mode=exclusive&rate=18&supply=intra&qty=1', fillLabel: 'Do it in the GST calculator with ₹25,000 at 18% already in — it shows the working' }
        ]
      },
      {
        name: 'Take GST out of a price that already includes it',
        body: [
          { formula: 'taxable value = inclusive price ÷ (1 + rate ÷ 100)' },
          { formula: 'GST = inclusive price − taxable value' },
          { p: 'For ₹11,800 including 18%: 11,800 ÷ 1.18 = ₹10,000, so the GST inside it is ₹1,800. For ₹1,050 including 5%: 1,050 ÷ 1.05 = ₹1,000, with ₹50 of tax. A useful check: the taxable value plus the GST must add back to exactly the price you started with.' },
          { p: 'For the tax alone: inclusive price × rate ÷ (100 + rate). 11,800 × 18 ÷ 118 = ₹1,800.' },
          { tool: '/india/gst-calculator/', why: 'set “Amount is” to inclusive and it extracts the tax instead of adding it', fill: 'amount=11800&mode=inclusive&rate=18&supply=intra&qty=1', fillLabel: 'Open it with ₹11,800 inclusive of 18% — it shows ₹10,000 and ₹1,800' }
        ]
      },
      {
        name: 'Split the tax into CGST and SGST, or IGST',
        body: [
          { p: 'A supply within one state is taxed half by the Centre and half by the state: 18% becomes 9% CGST plus 9% SGST (or UTGST in a union territory without a legislature). On the ₹25,000 job that is ₹2,250 CGST and ₹2,250 SGST. A supply from one state to another is taxed as a single IGST at the full rate: ₹4,500 IGST. The customer pays the same total either way.' },
          { p: 'What decides it is the place of supply — for goods, usually where they are delivered; for services, rules of their own — not where your office is.' },
          { example: {
            caption: 'Illustrative invoices, invented for this guide. Every figure is what the GST Calculator’s own engine returns for them.',
            head: ['Invoice', 'Taxable value', 'GST', 'Split', 'Total'],
            rows: [
              ['₹25,000 exclusive, 18%, within the state', '₹25,000', '₹4,500', 'CGST ₹2,250 + SGST ₹2,250', '₹29,500'],
              ['₹25,000 exclusive, 18%, to another state', '₹25,000', '₹4,500', 'IGST ₹4,500', '₹29,500'],
              ['₹11,800 inclusive, 18%, within the state', '₹10,000', '₹1,800', 'CGST ₹900 + SGST ₹900', '₹11,800'],
              ['40 units at ₹450, 5%, within the state', '₹18,000', '₹900', 'CGST ₹450 + SGST ₹450', '₹18,900']
            ]
          } },
          { tool: '/india/gst-calculator/', why: 'switch “Type of supply” to inter-state and the same tax appears as one IGST line', fill: 'amount=25000&mode=exclusive&rate=18&supply=inter&qty=1', fillLabel: 'See the inter-state version — ₹4,500 as IGST' }
        ]
      }
    ],
    wrong: [
      { name: 'Subtracting the rate to remove GST', text: 'Knocking 18% off ₹11,800 gives ₹9,676. The real taxable value is ₹10,000, because the 18% was charged on ₹10,000, not on ₹11,800. Divide by 1.18. On a single invoice the error is ₹324; across a year of inclusive receipts it misstates both the turnover and the tax.' },
      { name: 'Using a rate from before September 2025', text: 'The 12% and 28% slabs went on 22 September 2025, but old price lists, invoice templates and many web pages still carry them. Check the current notification for the code before you invoice.' },
      { name: 'Choosing IGST or CGST plus SGST by where you sit', text: 'The split follows the place of supply. A Delhi supplier delivering goods within Delhi charges CGST and SGST; deliver the same goods to Mumbai and it is IGST. Services, and goods delivered to someone other than the buyer, have rules of their own — look them up rather than going by the addresses on the letterhead. The wrong split means the customer cannot take the credit as charged, and the fix is a corrected invoice.' },
      { name: 'Rounding the halves differently', text: 'Round CGST up and SGST down and the halves no longer add to the total, so the invoice disagrees with itself. Halve the total GST and round both halves the same way.' },
      { name: 'Leaving charges out of the taxable value', text: 'Packing, delivery and similar charges billed on the same invoice usually form part of the value the tax is worked out on. Calculating GST on the goods alone and adding the delivery charge afterwards untaxed understates the tax, which is the kind of difference that appears when a customer reconciles their purchase register.' }
    ],
    faq: [
      { q: 'How do I calculate 18% GST on ₹1,000?', a: '1,000 × 18 ÷ 100 = ₹180 of GST, so the total is ₹1,180. Within one state that is ₹90 CGST and ₹90 SGST; to another state it is ₹180 IGST.' },
      { q: 'What is the formula to remove GST from a total?', a: 'Divide the total by one plus the rate. For 18%, divide by 1.18; for 5%, divide by 1.05. The answer is the taxable value, and the GST is the total minus that.' },
      { q: 'What is the difference between CGST, SGST and IGST?', a: 'They are the same tax shared differently. On a supply within a state, the Centre collects CGST and the state collects SGST, each at half the rate. On a supply between states, the Centre collects IGST at the full rate. The total the customer pays is the same.' },
      { q: 'Does the calculator know which rate applies to my product?', a: 'No. It offers the current slabs; the rate for your item comes from the CBIC notification for its HSN or SAC code, or from your accountant.' },
      { q: 'A price says “inclusive of all taxes”. How much of it is GST?', a: 'Treat it as an inclusive amount: divide by one plus the rate to find the taxable value, and the rest is GST. At 18%, a ₹590 item holds ₹500 of value and ₹90 of tax.' }
    ],
    tools: ['/india/gst-calculator/', '/business/gst-reconciler/', '/mathematics/percentage/'],
    collections: ['shopkeepers', 'small-business'],
    related: ['calculate-a-percentage', 'reconcile-gstr-2b', 'calculate-emi']
  },

  /* ================================================================== */
  {
    slug: 'calculate-emi',
    glyph: 'i-emi-calculator',
    name: 'How to calculate EMI on a loan',
    title: 'How to calculate EMI on a loan — the formula, a worked example and flat rate versus reducing balance',
    description: 'The EMI formula worked through on a real-sized home loan, what each payment is made of, what tenure, rate and prepayment do to the total, and why a flat rate is not what it seems.',
    answer: 'EMI = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1), where P is the loan amount, r is the monthly interest rate (the annual rate ÷ 12 ÷ 100) and n is the number of monthly instalments. A ₹20,00,000 loan at 9% a year over 15 years — 180 months — has an EMI of ₹20,285.33, and costs ₹16,51,359.70 in interest over its life.',
    minutes: { first: 'fifteen minutes', again: 'a minute' },
    howLong: 'A minute in the calculator, longer by hand — the power of n is the only awkward part. The thinking worth doing is the comparison: the same loan over a different tenure, at a rate a quarter of a point apart, and with a small monthly prepayment. Five minutes there can be worth lakhs.',
    before: [
      'The loan amount (the principal you will actually receive, not including fees).',
      'The annual interest rate, and whether it is a reducing-balance rate or a flat rate. Ask the lender in writing if the paperwork does not say.',
      'The tenure in years or months.',
      'Any extra you could pay each month on top of the EMI, if you are weighing up prepayment.'
    ],
    steps: [
      {
        name: 'Turn the rate and tenure into monthly figures',
        body: [
          { p: 'EMIs are monthly, so the formula wants a monthly rate and a number of months. Divide the annual rate by 12, then by 100 to make it a fraction: 9% a year is 9 ÷ 12 ÷ 100 = 0.0075 a month. Multiply the years by 12: 15 years is 180 instalments.' }
        ]
      },
      {
        name: 'Put the three numbers into the formula',
        body: [
          { formula: 'EMI = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1)' },
          { p: 'With P = 20,00,000, r = 0.0075 and n = 180: (1.0075) to the power 180 is about 3.8380. So the EMI is 20,00,000 × 0.0075 × 3.8380 ÷ 2.8380, which is ₹20,285.33. Multiply by 180 and the total repaid is ₹36,51,359.70, of which ₹16,51,359.70 is interest — about 83% of the amount borrowed.' },
          { p: 'In a spreadsheet the same calculation is =PMT(9%/12, 180, -2000000). The minus sign makes the answer come out positive.' },
          { tool: '/india/emi-calculator/', why: 'works out the EMI, the total interest and the year-by-year amortisation table, and shows what a monthly prepayment saves', fill: 'amount=2000000&rate=9&years=15&prepay=0', fillLabel: 'Do it in the EMI calculator with this loan already in — it shows the working and the schedule' }
        ]
      },
      {
        name: 'See where each payment goes',
        body: [
          { p: 'Every EMI is interest on the outstanding balance plus a slice of principal. In month one the balance is the full ₹20,00,000, so interest is 20,00,000 × 0.0075 = ₹15,000 and only ₹5,285.33 reduces the loan. As the balance falls, the interest part shrinks and the principal part grows, until the last payments are almost all principal. That is what “reducing balance” means.' },
          { p: 'It also explains why the first few years feel as if nothing is happening: on this loan, about three quarters of the first EMI is interest.' }
        ]
      },
      {
        name: 'Compare tenure, rate and prepayment',
        body: [
          { p: 'Change one thing at a time and watch the total interest, not just the EMI.' },
          { example: {
            caption: 'Illustrative loans, invented for this guide. Every figure is what the EMI Calculator’s own engine returns for them.',
            head: ['₹20,00,000 loan', 'EMI', 'Total interest', 'Paid off in'],
            rows: [
              ['9% over 15 years', '₹20,285.33', '₹16,51,359.70', '15 years'],
              ['9% over 20 years', '₹17,994.52', '₹23,18,684.59', '20 years'],
              ['9.5% over 15 years', '₹20,884.49', '₹17,59,208.86', '15 years'],
              ['9% over 15 years, plus ₹5,000 a month', '₹20,285.33 + ₹5,000', '₹10,43,953.59', '10 years 1 month']
            ]
          } },
          { p: 'Stretching to 20 years cuts the EMI by about ₹2,300 a month and adds over ₹6.6 lakh of interest. Half a point on the rate adds about ₹1.08 lakh. And ₹5,000 a month on top clears the loan 59 months early and saves ₹6,07,406.12 of interest, because every extra rupee comes straight off the balance that interest is charged on.' },
          { tool: '/india/emi-calculator/', why: 'the “Extra payment each month” field shows the months and interest a regular prepayment saves', fill: 'amount=2000000&rate=9&years=15&prepay=5000', fillLabel: 'Open it with ₹5,000 a month extra — it shows ₹6,07,406 saved' },
          { fact: {
            text: 'The Reserve Bank of India does not allow banks to charge foreclosure charges or prepayment penalties on floating-rate term loans to individual borrowers, a rule it set in May 2014 and has since extended to other lenders. For EMI-based floating-rate personal loans, its circular of 18 August 2023 requires lenders, when the rate is reset, to let the borrower choose a higher EMI, a longer tenure or a combination, to offer a switch to a fixed rate, and to allow prepayment in part or in full at any point. Fixed-rate loans can still carry prepayment charges, as the loan agreement sets out.',
            checked: CHECKED,
            sources: [src('rbiForeclosure', 'no prepayment penalty on floating-rate loans to individuals'), src('rbiReset', 'the borrower’s options when a floating rate is reset')]
          } }
        ]
      },
      {
        name: 'If the rate is quoted flat, convert it before you compare',
        body: [
          { p: 'Some car, two-wheeler and consumer loans quote a flat rate: interest is worked out on the whole original amount for the whole term, as if you never paid any of it back. ₹5,00,000 at 9% flat for 5 years is ₹2,25,000 of interest, so the EMI is (5,00,000 + 2,25,000) ÷ 60 = ₹12,083.33.' },
          { p: 'The same ₹5,00,000 at 9% on a reducing balance costs ₹10,379.18 a month and ₹1,22,750.66 in total interest. To charge ₹12,083.33 a month on a reducing balance, the rate would have to be about 15.7%. That is the honest comparison: a 9% flat rate is roughly a 15.7% loan.' }
        ]
      }
    ],
    wrong: [
      { name: 'Putting the annual rate into the formula', text: 'The formula is monthly. Using 9 or 0.09 as r instead of 0.0075 produces an EMI many times too large. Sanity check: ₹20 lakh over 180 months is ₹11,111 a month before interest, so ₹20,285 is plausible and ₹1.8 lakh is not.' },
      { name: 'Comparing a flat rate with a reducing rate', text: 'A flat rate charges interest on money you have already repaid, so the same headline number costs far more. 9% flat over five years behaves like roughly 15.7% reducing. Convert before comparing, or compare the EMI and the total repayment directly.' },
      { name: 'Choosing the longest tenure for the lowest EMI', text: 'A longer tenure lowers the monthly figure and raises the total. Going from 15 to 20 years on the worked example saves about ₹2,300 a month and costs over ₹6.6 lakh more. Take the shortest tenure you can afford comfortably, and keep the option to prepay.' },
      { name: 'Leaving fees and bundled insurance out', text: 'A processing fee, a mandatory insurance premium added to the loan, or a fee deducted from the amount paid out all raise the real cost without changing the quoted rate. Work out the EMI on what you actually receive, and add the fees to the total cost.' },
      { name: 'Assuming the EMI on a floating loan is fixed', text: 'When the benchmark rate rises, many lenders keep the EMI the same and lengthen the tenure, which can add years without a single extra rupee leaving your account each month. Check the remaining tenure after every reset, not just the EMI.' }
    ],
    faq: [
      { q: 'How is EMI calculated?', a: 'With the reducing-balance formula P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1), using the monthly rate and the number of months. Each EMI pays that month’s interest on the outstanding balance, and the rest reduces the balance.' },
      { q: 'How do I calculate EMI in Excel?', a: 'Use =PMT(annual rate/12, number of months, -loan amount). For ₹20 lakh at 9% over 15 years, =PMT(9%/12, 180, -2000000) returns 20,285.33.' },
      { q: 'Why is my bank’s EMI slightly different?', a: 'Banks round differently, may charge interest daily rather than monthly, and often charge broken-period interest for the days between disbursement and the first EMI. A difference of a few rupees is normal; a difference of hundreds means the rate, tenure or amount is not what you think.' },
      { q: 'When I prepay, should I reduce the EMI or the tenure?', a: 'Reducing the tenure saves more interest; reducing the EMI eases the monthly budget. Ask the lender which they apply by default, because practice varies, and model both in the calculator first.' },
      { q: 'Is the EMI calculator’s answer a loan offer?', a: 'No. It is the arithmetic on the figures you enter. The rate, fees and terms that apply to you are in the lender’s sanction letter.' }
    ],
    tools: ['/india/emi-calculator/', '/finance/loan-payment/', '/business/amortization-schedule/', '/finance/compound-interest/'],
    collections: ['small-business'],
    related: ['calculate-a-percentage', 'calculate-gst']
  },

  /* ================================================================== */
  {
    slug: 'compress-an-image',
    glyph: 'i-image-compressor',
    name: 'How to compress an image and reduce JPG file size',
    title: 'How to compress an image and reduce JPG file size — without turning it to mush',
    description: 'Get a photo under a size limit by resizing it, choosing the right format and setting the quality — in that order — with what JPEG compression actually does to a picture.',
    answer: 'To compress an image, make it smaller in pixels, save it in an efficient format, and lower the quality setting — in that order, because resizing usually saves the most. In the Image Compressor: drop the photo in, choose JPEG or WebP, start the quality slider at 80, set a maximum width if the picture is bigger than it will ever be shown, and compare the before and after sizes before you download.',
    minutes: { first: 'five minutes', again: 'under a minute' },
    howLong: 'Under a minute for a single photo once you know the limit you are aiming for. The first time takes longer only because it is worth trying two or three quality settings side by side to see where the picture starts to suffer.',
    before: [
      'The original photo — the one from the camera or phone, not a copy that has already been through a messaging app or a previous compressor.',
      'The limit you have to meet, if there is one: a maximum file size in KB, a set of pixel dimensions, or a required format. Upload forms usually state all three somewhere.',
      'An idea of where the picture will be seen. A photo for a website column, a passport form and a print are three different jobs.'
    ],
    steps: [
      {
        name: 'Find out exactly what the limit is',
        body: [
          { p: 'Read the upload form or the brief before you touch the image. “Under 100 KB, JPG only, 600 × 600 pixels” is three separate instructions, and meeting two of them still gets the file rejected. If no limit is given, the target is simply the smallest file that still looks right where it will be shown.' }
        ]
      },
      {
        name: 'Resize first — it is usually the biggest saving',
        body: [
          { p: 'File size follows the number of pixels. A phone photo of 4000 × 3000 pixels holds 12 million of them; the same picture at 1600 × 1200 holds 1.92 million — 16% as many — and nobody looking at it on a screen will see the difference. Halving both dimensions quarters the pixel count.' },
          { example: {
            caption: 'Illustrative dimensions, invented for this guide. The percentages are plain arithmetic on the pixel count; the file size that results depends on the picture.',
            head: ['Dimensions', 'Pixels', 'Share of the original'],
            rows: [
              ['4000 × 3000 (a typical phone photo)', '12.0 million', '100%'],
              ['2000 × 1500', '3.0 million', '25%'],
              ['1600 × 1200', '1.92 million', '16%'],
              ['1200 × 900', '1.08 million', '9%']
            ]
          } },
          { p: 'In the Image Compressor, set “Max width” to the widest the picture will be displayed — the height follows in proportion. Leave it at 0 to keep the original size.' }
        ]
      },
      {
        name: 'Choose the format that suits the picture',
        body: [
          { ul: [
            'JPEG for photographs. It is accepted everywhere, which matters for forms and portals.',
            'WebP for the web. It is usually smaller than JPEG at the same visual quality and every current browser shows it — but some upload forms still refuse it, so check before sending one.',
            'PNG for screenshots, logos, diagrams and anything with sharp edges or flat colour. It is lossless, so it never smudges text — and it is the wrong choice for a photograph, where it is usually much larger.'
          ] },
          { fact: {
            text: 'JPEG (ISO/IEC 10918, the format the JPEG committee calls JPEG 1) is a lossy format built on the discrete cosine transform, designed for photographic images: to make the file smaller it permanently discards fine detail the eye is least likely to miss.',
            checked: CHECKED,
            sources: [src('jpeg', 'JPEG 1 as a lossy, DCT-based format for photographs')]
          } },
          { p: 'Two practical consequences follow. Every time a JPEG is opened and saved again as JPEG, detail is discarded again, so quality drops a little more with each generation. And the “quality” number is each program’s own scale rather than a fixed measure, so 80 in one program is not exactly 80 in another — judge by the preview and the size, not the number.' }
        ]
      },
      {
        name: 'Set the quality and watch the size',
        body: [
          { p: 'Start at 80, which suits most photographs, and look at the preview and the size readout. If the file is still too big, come down in steps of five. Stop at the first setting where you can see blockiness around edges or banding in a smooth sky, and go back one step. Above about 90 the file grows quickly for a difference almost nobody can see.' },
          { p: 'The tool page carries a real example made with the live tool: a landscape photo went from 147.8 KB to 48.3 KB, a 67% reduction. Your own result will depend on the picture — busy detail compresses less than a clear sky — which is why the before and after sizes are shown for every file.' },
          { tool: '/image/image-compressor/', why: 'resizes and re-encodes JPEG, PNG and WebP in your browser, with a live preview and the size before and after; nothing is uploaded' }
        ]
      },
      {
        name: 'Check the result against the limit, then keep the original',
        body: [
          { p: 'Open the compressed file and look at it at the size it will be used. Check the size the upload form will see, leaving a little headroom: some forms count a kilobyte as 1,000 bytes and others as 1,024, so a file shown as 99.5 KB can be rejected by a strict 100 KB limit. Keep the original somewhere safe — if you need a different size later, start again from it rather than from the compressed copy.' }
        ]
      }
    ],
    wrong: [
      { name: 'Compressing a copy of a copy', text: 'A photo that has been through WhatsApp, a social network or another compressor has already lost detail. Compressing it again loses more, and the damage compounds. Always go back to the original file from the camera or phone.' },
      { name: 'Turning a screenshot or logo into a JPEG', text: 'JPEG handles photographs well and sharp edges badly. A screenshot saved as JPEG gets smudged text and often a larger file than the PNG it came from. Keep screenshots, logos and diagrams as PNG, or use WebP.' },
      { name: 'Sending WebP to a form that wants JPG', text: 'WebP is the smallest option and the one many forms still reject. If the form says JPG or JPEG, choose JPEG as the output, even though the file will be a little larger.' },
      { name: 'Losing a transparent background', text: 'JPEG has no transparency. When a PNG with a transparent background is saved as JPEG, the Image Compressor fills the background with white — so a logo meant to sit on a coloured page will now have a white box around it. Keep it as PNG or WebP.' },
      { name: 'Squeezing quality instead of pixels', text: 'Dragging the quality down to 30 to hit a limit produces a blotchy picture at full resolution. Bringing a 4000-pixel photo down to 1600 pixels and leaving the quality at 80 usually gives a smaller file that looks far better.' }
    ],
    faq: [
      { q: 'How do I reduce a JPG to under 100 KB?', a: 'Resize it first — for most forms, 1200 pixels wide or less is plenty — then save as JPEG at quality 80 and check the size. If it is still over, come down in steps of five. Aim a few KB under the limit.' },
      { q: 'Does compressing a photo reduce its quality?', a: 'JPEG and lossy WebP compression always discard some detail; at sensible settings the loss is hard to see. PNG compression is lossless. Resizing removes pixels, which you will only notice if the picture is later shown or printed larger.' },
      { q: 'What quality setting should I use?', a: 'Start at 80 for photographs. Go lower only if you must meet a size limit, and look at the preview as you do. There is rarely a reason to go above 90.' },
      { q: 'Are my photos uploaded?', a: 'No. The Image Compressor reads the file in your browser, redraws it and re-encodes it there. Nothing is sent anywhere, which is why it works with the network off.' },
      { q: 'Why did my compressed file come out bigger?', a: 'Usually because a PNG screenshot was converted to JPEG, or because the original was already heavily compressed and the new quality setting is higher than the one it was saved at. Keep the original format, or lower the quality.' }
    ],
    tools: ['/image/image-compressor/', '/image/bulk-image-resizer/', '/image/image-converter/', '/image/image-cropper/'],
    collections: ['job-seekers', 'photographers', 'students'],
    related: ['convert-jpg-to-pdf', 'merge-pdf-files']
  },

  /* ================================================================== */
  {
    slug: 'merge-pdf-files',
    glyph: 'i-merge-pdf',
    name: 'How to merge PDF files into one',
    title: 'How to merge PDF files into one — in order, with only the pages you need',
    description: 'Combine several PDFs into a single file in the right order, take only some pages from each, keep stray metadata out, and check the result before you send it.',
    answer: 'To merge PDFs, add the files to a merger in the order you want them, say which pages to take from each, and save the result as one new file. In the Merge PDF tool: drop the PDFs in, arrow them into order, leave the page range as “all” or set one per file such as “all | all | 1-3”, and download merged.pdf — the files are joined in your browser and never uploaded.',
    minutes: { first: 'five minutes', again: 'a minute' },
    howLong: 'A minute or two for a handful of files. Most of the time goes on getting the order right and checking the result page by page, which is the part worth not skipping when the merged file is going to a visa office, a lender or a court.',
    before: [
      'Every PDF that has to go into the final file, saved somewhere you can find them together.',
      'The order the recipient expects. If they have published a checklist, it is usually also the order they want.',
      'Which pages of each file you actually need. A 40-page bank statement pack where only three months are required is a file the reader will not thank you for.'
    ],
    steps: [
      {
        name: 'Gather the files and name them in order',
        body: [
          { p: 'Put all the PDFs in one folder and, if there are more than a few, rename them with a number in front — 01 cover letter, 02 passport, 03 payslips — so the order is visible before you start. If any document is still a photo or a scan in JPG form, turn it into a PDF first.' },
          { tool: '/image/image-to-pdf/', why: 'turns photos and scans into PDF pages, so they can go into the merge alongside the files that are already PDFs' }
        ]
      },
      {
        name: 'Add them and put them in order',
        body: [
          { p: 'Drop the files into the Merge PDF tool. They merge in the order listed, and the arrows beside each file move it up or down. Files you add later go to the bottom of the list, which is easy to forget when a document turns up at the last minute.' }
        ]
      },
      {
        name: 'Choose the pages from each file',
        body: [
          { p: 'The page range box takes one rule for every file, or one rule per file separated by a vertical bar. “all” takes every page. “1-3” takes pages one to three. “2,5” takes pages two and five. So with three files, “all | all | 1-3” takes the first two whole and only the first three pages of the third.' },
          { p: '“8-” takes page eight to the end, and “-3” the first three. If you give fewer rules than there are files, the files without a rule go in whole. A range that runs past the end of a file stops at its last page, so “1-20” on a 12-page file takes all 12; a rule that matches no page at all stops the merge and names the file.' },
          { example: {
            caption: 'An invented set of files, to show how page ranges add up; the page counts are made up for this guide.',
            head: ['File (in merge order)', 'Pages in the file', 'Range', 'Pages taken'],
            rows: [
              ['01 cover letter.pdf', '1', 'all', '1'],
              ['02 contract.pdf', '4', 'all', '4'],
              ['03 appendix.pdf', '12', '1-3', '3'],
              ['merged.pdf', '', 'all | all | 1-3', '8']
            ]
          } }
        ]
      },
      {
        name: 'Decide what the merged file says about itself',
        body: [
          { p: 'PDFs carry metadata — an author, a title, the program that made them — that most people never see but anyone can read. By default the tool strips it all, because a merged file inheriting one source’s author and title is usually wrong and sometimes revealing. You can keep the first file’s metadata instead, and give the merged document a title of its own.' },
          { tool: '/pdf/merge-pdf/', why: 'joins PDFs in the order you set, taking all or some pages from each, and strips metadata unless you ask it not to; nothing is uploaded' }
        ]
      },
      {
        name: 'Merge, then check every page',
        body: [
          { p: 'After merging, the tool lists the files merged, how many pages it took from each, the total page count and the size of the output. Check the total against what you expected — 8 in the example above — then open merged.pdf and scroll through it. A sideways scan or a page from the wrong file is far easier to fix now than after it has been sent.' },
          { p: 'If a page is sideways, rotate it in the source file and merge again. If a portal rejects the file for size, the usual cause is a large scanned or photographed document inside it; make that one smaller at source and merge again.' }
        ]
      }
    ],
    wrong: [
      { name: 'Expecting bookmarks, forms and comments to survive', text: 'Merging rebuilds the document from its pages. Page content, images and page sizes come across; bookmarks, fillable form fields and annotations from the source files do not. Fill in and save any forms, and flatten or print to PDF anything with comments you need kept, before merging.' },
      { name: 'A late file at the bottom of the list', text: 'Files merge in the order listed, and a file added after the others goes to the end. The cover letter that arrived last ends up on page 30. Check the list order every time, not just the first time.' },
      { name: 'A page range that does not match the file order', text: 'Per-file ranges apply to the files in their current order. Reorder the files after typing “all | 1-3” and the range now applies to a different document — and because a range that overruns a file is trimmed rather than refused, the result can look plausible with the wrong pages in it. Set the order first, then the ranges, then count the pages.' },
      { name: 'Sending what the source files say about you', text: 'An author name, a company name, a template title or an internal file path can sit in a PDF’s metadata. The tool strips it by default; if you switched to keeping the first file’s metadata, look at what that is before sending.' },
      { name: 'Merging sideways scans and fixing them later', text: 'A page scanned in landscape stays in landscape in the merged file. Rotate the pages in the source file first; fixing them in a long merged document means finding them again.' }
    ],
    faq: [
      { q: 'Are my PDFs uploaded?', a: 'No. The files are read, combined and rewritten by your own browser. Nothing is sent anywhere, which is why it is reasonable to use for contracts, statements and identity documents.' },
      { q: 'Can I merge just some pages from each PDF?', a: 'Yes. Give one range per file, separated by a vertical bar, in the same order as the file list — for example “1-2 | all | 3,5”. A file with no range goes in whole.' },
      { q: 'Is there a limit on the number of files?', a: 'No upload limit, because nothing is uploaded. Very large merges are limited by the memory of the device doing the work, so a phone will reach its limit sooner than a laptop.' },
      { q: 'Why are my bookmarks missing?', a: 'Merging rebuilds the page tree from scratch, which is what makes the result reliably valid. Bookmarks from several documents with different structures are where mergers tend to produce broken files, so this one deliberately leaves them out.' },
      { q: 'How do I take pages out again afterwards?', a: 'Use Split PDF or Extract PDF Pages on the merged file, or go back to the source files and merge again with different ranges — which is usually quicker.' }
    ],
    tools: ['/pdf/merge-pdf/', '/pdf/split-pdf/', '/pdf/extract-pdf-pages/', '/pdf/rotate-pdf/', '/image/image-to-pdf/'],
    collections: ['going-paperless', 'job-seekers'],
    related: ['convert-jpg-to-pdf', 'compress-an-image']
  },

  /* ================================================================== */
  {
    slug: 'convert-jpg-to-pdf',
    glyph: 'i-image-to-pdf',
    name: 'How to convert JPG to PDF',
    title: 'How to convert JPG to PDF — one image per page, in the right order and the right size',
    description: 'Turn photos, scans and screenshots into a single PDF: getting the pictures straight, ordering them, choosing a page size and margin, and keeping the file small enough to send.',
    answer: 'To convert JPG to PDF, put the images into an image-to-PDF converter in the order you want the pages, choose a page size, and save — each image becomes one page. In the Image to PDF Converter: drop the JPGs in, reorder them, pick A4 (or “Fit to image” for screenshots), and download the PDF; it is built in your browser and nothing is uploaded.',
    minutes: { first: 'five minutes', again: 'a minute' },
    howLong: 'A minute for a few photos. Allow longer the first time for the preparation — straightening and cropping the pictures — because a crooked photo of a receipt is still a crooked photo once it is inside a PDF.',
    before: [
      'The images, as JPG or PNG files. Photos straight from a phone are fine; screenshots are fine.',
      'The order the pages should be in.',
      'Any requirement from whoever will receive it: a page size, a maximum file size, or “one PDF, all pages” — the usual instruction for expense claims and applications.'
    ],
    steps: [
      {
        name: 'Get each picture straight and cropped',
        body: [
          { p: 'The converter places each image on a page exactly as it is. If a photo of a document is tilted, has the table top around it, or is sideways, crop and rotate it first. A tightly cropped receipt fills the page and stays readable; an uncropped one prints as a small grey rectangle in a sea of desk.' },
          { tool: '/image/image-cropper/', why: 'trims the background off a photographed document before it becomes a page' }
        ]
      },
      {
        name: 'Add the images and set the order',
        body: [
          { p: 'Drop the files in the order you want the pages; the list can be reordered before the PDF is made. If the files are numbered — 01, 02, 03 — the order you need is obvious at a glance.' }
        ]
      },
      {
        name: 'Choose the page size and orientation',
        body: [
          { ul: [
            'A4 for anything that may be printed, filed or submitted in India, the UK or most of the world. US Letter and Legal are there for North American recipients, and A5 for small documents.',
            '“Fit to image” makes each page exactly the size of its picture. It suits screenshots and scans that are already the shape they should be.',
            'Orientation set to “Match each image” turns each page to suit its picture, so a landscape photo gets a landscape page in the middle of portrait ones.'
          ] },
          { fact: {
            text: 'A4 is defined by ISO 216 as 210 × 297 millimetres. Every A size has the same proportions — the long side is the short side multiplied by the square root of two — so an A4 page scales to A5 or A3 without cropping. In a PDF, page sizes are measured in points of 1/72 inch, which makes A4 about 595 × 842 points.',
            checked: CHECKED,
            sources: [src('iso216', 'the A series, including A4 at 210 × 297 mm')]
          } }
        ]
      },
      {
        name: 'Set the margin and image quality',
        body: [
          { p: 'The margin is in points; the default of 28 points is just under 10 millimetres, a white border that keeps the picture clear of where a printer cannot reach. Set it to 0 for edge-to-edge pages.' },
          { p: 'The quality slider, 88 by default, decides how the pictures are compressed as they go in. Images are embedded as JPEG, which PDF can hold as it is, so there is no second layer of compression on top. Lowering quality makes the PDF smaller; bring it down gradually and check that the small print on a photographed document is still readable.' },
          { tool: '/image/image-to-pdf/', why: 'puts JPEG and PNG images into one PDF, one per page, with the page size, orientation, margin and quality you choose; nothing is uploaded' }
        ]
      },
      {
        name: 'Make it, then check the size and every page',
        body: [
          { p: 'The tool page’s own example, made with the live tool, is a single photo of a receipt on A4: a one-page PDF of 427.1 KB. Phone photos are large, so ten of them can easily make a PDF of several megabytes. If a portal has a size limit, make the photos smaller before converting — resizing them to 1,600 pixels on the long side is usually still sharp on an A4 page — rather than squeezing the quality slider to the bottom.' },
          { tool: '/image/image-compressor/', why: 'resizes and recompresses the photos before they go into the PDF, which is the reliable way to meet a size limit' },
          { p: 'Then open the PDF and look at every page at full size: is each one the right way up, readable, and in the right place? If several PDFs have to become one, merge them as a last step.' },
          { example: {
            caption: 'An invented expense claim, to show how the settings fit together; the files are made up for this guide.',
            head: ['What you have', 'Setting', 'Why'],
            rows: [
              ['Six phone photos of receipts', 'A4, match each image, margin 28', 'Prints and files like paper, each receipt the right way round'],
              ['Two screenshots of online orders', 'Fit to image, margin 0', 'No white border around a picture that is already a page'],
              ['Portal limit of 2 MB', 'Resize photos first, then quality 80–88', 'Smaller pictures, still readable'],
              ['Everything in one file', 'Merge the PDFs at the end', 'One attachment, in the order of the claim']
            ]
          } }
        ]
      }
    ],
    wrong: [
      { name: 'Expecting the text to be searchable', text: 'A PDF made from photos holds pictures of text, not text. You cannot search it, select a sentence or copy a number out of it. If the recipient needs to do that, they need the original document or a text-recognition step, not a better JPG-to-PDF conversion.' },
      { name: 'A transparent PNG landing on white', text: 'Transparency is flattened onto white, because the images go into the PDF without an alpha channel. A logo or signature with a transparent background will sit on a white rectangle. That is usually what you want on a white page; check it if the page is meant to look otherwise.' },
      { name: 'Full-size phone photos for a portal with a limit', text: 'A modern phone photo can be several megabytes on its own. Ten of them make a PDF that no upload form will take. Resize the photos first — it costs nothing a reader can see on A4 — and keep the quality slider in the eighties.' },
      { name: 'Pages in the wrong order', text: 'Pages follow the file list, and the list follows the order the files were added. Reorder before generating, and look through the finished PDF once; it takes less time than explaining to a finance team why page four belongs on page one.' },
      { name: '“Fit to image” where A4 was required', text: 'Fit to image makes each page the size of its picture, so a phone photo becomes an oddly-shaped page that prints unpredictably. If the recipient will print it, or asked for A4, choose A4.' }
    ],
    faq: [
      { q: 'Can I convert PNG to PDF as well?', a: 'Yes. JPEG and PNG images can go into the same PDF, one per page. PNG transparency is flattened onto white.' },
      { q: 'Is there a limit on the number of images?', a: 'No artificial limit. The PDF is assembled in memory on your device, so very large batches are bounded by its memory rather than by an upload cap.' },
      { q: 'Are my images uploaded?', a: 'No. The images are read and the PDF is written by your own browser. Nothing is sent anywhere, which matters for receipts, identity documents and anything else with personal details on it.' },
      { q: 'How do I turn a PDF back into JPG images?', a: 'Use the PDF to Images tool, which renders each page as an image file.' },
      { q: 'How do I make the PDF smaller?', a: 'Make the images smaller before converting: resize them and save at quality 80 or so. Lowering the converter’s quality slider helps too, but resizing does more for less visible loss.' }
    ],
    tools: ['/image/image-to-pdf/', '/image/image-cropper/', '/image/image-compressor/', '/pdf/merge-pdf/', '/pdf/pdf-to-images/'],
    collections: ['going-paperless', 'students'],
    related: ['merge-pdf-files', 'compress-an-image']
  },

  /* ================================================================== */
  {
    slug: 'calculate-bmi',
    glyph: 'i-bmi',
    name: 'How to calculate BMI',
    title: 'How to calculate BMI — the formula, the WHO categories, and where BMI misleads',
    description: 'Body mass index from height and weight in metric or imperial units, what the WHO adult categories mean, why the adult chart does not apply to children, and when BMI gives the wrong picture.',
    answer: 'BMI is your weight in kilograms divided by the square of your height in metres: 70 kg at 1.75 m is 70 ÷ (1.75 × 1.75) = 22.9. For adults, the WHO counts under 18.5 as underweight, 25 or more as overweight and 30 or more as obese — but BMI is a quick screening number, not a diagnosis, and a doctor or nurse is the person to interpret it for you.',
    minutes: { first: 'five minutes', again: 'seconds' },
    howLong: 'Seconds once you have an accurate height and weight. Measuring properly — shoes off, same scales, same time of day — is the part that makes the number worth having.',
    before: [
      'Your weight, measured without shoes and in light clothing. Morning, before eating, gives the most repeatable figure.',
      'Your height, measured standing straight against a wall without shoes.',
      'If the BMI is for a child or teenager, their age and sex as well — the adult categories do not apply to them.'
    ],
    steps: [
      {
        name: 'Get both measurements into the same system',
        body: [
          { p: 'The metric formula needs kilograms and metres. Height is usually measured in centimetres, so divide by 100: 175 cm is 1.75 m. If you measure in pounds and inches, use the imperial version of the formula instead, which has a conversion factor built in.' },
          { formula: 'metric: BMI = weight (kg) ÷ height (m)²' },
          { formula: 'imperial: BMI = 703 × weight (lb) ÷ height (in)²' }
        ]
      },
      {
        name: 'Square the height, then divide',
        body: [
          { p: 'Multiply the height by itself: 1.75 × 1.75 = 3.0625. Divide the weight by that: 70 ÷ 3.0625 = 22.86. Round to one decimal place for everyday use: 22.9.' },
          { p: 'In imperial: someone who is 5 ft 9 in (69 inches) and 154 lb has a BMI of 703 × 154 ÷ (69 × 69) = 703 × 154 ÷ 4,761 = 22.7. The calculator converts pounds and inches exactly rather than using the 703 shortcut, and gets the same 22.7.' },
          { tool: '/health/bmi/', why: 'works out BMI from height and weight in metric or imperial units and places it in the standard adult range', fill: 'system=metric&weight=70&height=175', fillLabel: 'Do it in the BMI calculator with 70 kg and 175 cm already in' }
        ]
      },
      {
        name: 'Read the result against the adult categories',
        body: [
          { fact: {
            text: 'For adults, the World Health Organization defines underweight as a BMI below 18.5, overweight as a BMI of 25 or more, and obesity as a BMI of 30 or more, which leaves 18.5 to just under 25 as the healthy range. For children aged 5 to 19 it does not use these cut-offs at all: overweight and obesity are defined by BMI-for-age against the WHO Growth Reference, at more than one and more than two standard deviations above the median. Under the age of five, weight-for-height against the WHO Child Growth Standards is used instead.',
            checked: CHECKED,
            sources: [src('whoObesity', 'the adult cut-offs of 25 and 30, and the definitions for children'), src('whoGho', 'underweight among adults, BMI below 18.5'), src('whoGrowth', 'BMI-for-age for 5 to 19 years')]
          } },
          { example: {
            caption: 'Illustrative adults, invented for this guide. Each BMI is what the BMI Calculator’s own engine returns, and the band is the WHO adult category.',
            head: ['Height and weight', 'BMI', 'WHO adult category'],
            rows: [
              ['175 cm, 70 kg', '22.9', 'Healthy range (18.5 to under 25)'],
              ['5 ft 9 in (69 in), 154 lb', '22.7', 'Healthy range'],
              ['168 cm, 82 kg', '29.1', 'Overweight (25 or more)'],
              ['185 cm, 95 kg — a rugby forward', '27.8', 'Overweight, by the number alone']
            ]
          } },
          { p: 'The last row is there on purpose. A muscular athlete can sit in the overweight band with very little body fat, which is the clearest illustration that BMI measures weight for height, not fat and not health.' }
        ]
      },
      {
        name: 'For a child or teenager, use BMI-for-age instead',
        body: [
          { p: 'Children’s bodies change shape as they grow, so the same BMI means different things at 6 and at 16, and different things for girls and boys. The number is still worked out the same way, but it is read against a growth chart for the child’s exact age and sex, as a percentile or a standard-deviation score. The adult bands of 18.5, 25 and 30 should never be applied to a child. A health visitor, school nurse or GP can plot it on the right chart.' }
        ]
      },
      {
        name: 'Know where BMI gives the wrong picture',
        body: [
          { ul: [
            'Muscular people and athletes: muscle is heavier than fat, so BMI overstates fatness.',
            'Older adults: muscle is often lost with age, so a normal BMI can hide too little muscle and too much fat.',
            'Pregnancy: weight gain is expected, so a BMI worked out during pregnancy does not mean what it would otherwise. Ask the midwife.',
            'Ethnicity: health risk can rise at a lower BMI in some populations, and some health services use lower thresholds for people of certain ethnic backgrounds — ask what your own doctor uses.',
            'Where fat is carried: two people with the same BMI can carry it very differently. Waist measurement says something BMI cannot.'
          ] },
          { p: 'If your BMI is outside the healthy range, or you are worried about your weight for any reason, talk to a doctor, nurse or pharmacist. They will look at much more than one number.' }
        ]
      }
    ],
    wrong: [
      { name: 'Leaving the height in centimetres, or not squaring it', text: 'Dividing 70 by 175 squared gives 0.0023, which is obviously wrong. The subtler slip is forgetting to square: 70 ÷ 1.75 = 40, which can pass for an answer at a glance. Convert centimetres to metres, and square the height, not the weight.' },
      { name: 'Using the adult chart for a child', text: 'A BMI of 17 might be healthy for one ten-year-old and a concern for another, depending on age and sex. Adult categories applied to children mislabel them in both directions. Children need BMI-for-age on a growth chart.' },
      { name: 'Treating the boundary as a cliff', text: 'A BMI of 24.9 and one of 25.1 describe almost exactly the same body. The cut-offs are lines drawn for population statistics and screening, not a point at which health changes. Look at the trend over time rather than which side of a line one reading falls.' },
      { name: 'Reading a muscular build as overweight', text: 'BMI cannot tell muscle from fat. A rugby forward at 185 cm and 95 kg has a BMI of 27.8 and may be very lean. For anyone who trains hard, body composition or waist measurement says far more.' },
      { name: 'Comparing readings from different scales', text: 'Bathroom scales disagree with each other by a kilogram or more, and weight moves through the day. A change in BMI from one set of scales to another can be entirely the scales. Use the same scales at the same time of day.' }
    ],
    faq: [
      { q: 'What is a healthy BMI for adults?', a: 'The WHO adult range for a healthy weight runs from 18.5 to just under 25. It is a screening range for adults, not a target set for any individual, and it does not apply to children.' },
      { q: 'How do I calculate BMI in pounds and inches?', a: 'Multiply your weight in pounds by 703, then divide by your height in inches squared. At 154 lb and 69 inches that is 703 × 154 ÷ 4,761 = 22.7.' },
      { q: 'Is BMI accurate for athletes?', a: 'Not very. It counts all weight the same, so muscle pushes it up. An athlete can be in the overweight band with low body fat. Body composition measurements are a better guide.' },
      { q: 'What BMI is right for my child?', a: 'There is no single number. A child’s BMI is compared with others of the same age and sex on a growth chart. Ask a health visitor, school nurse or GP to plot it.' },
      { q: 'My BMI is above 25. Should I worry?', a: 'Not on the strength of one number. Speak to a doctor, nurse or pharmacist, who will consider your waist measurement, blood pressure, activity, family history and more before saying anything about your health.' }
    ],
    tools: ['/health/bmi/', '/health/body-fat/', '/health/ideal-weight/', '/health/bmr-tdee/'],
    related: ['calculate-a-percentage', 'calculate-age']
  },

  /* ================================================================== */
  {
    slug: 'calculate-age',
    glyph: 'i-age-calculator',
    name: 'How to calculate your age exactly',
    title: 'How to calculate your exact age in years, months and days',
    description: 'Work out an exact age by subtracting dates the way column subtraction works, find an age on a cut-off date for eligibility, and handle leap-day and month-end birthdays.',
    answer: 'To calculate your exact age, subtract your date of birth from today’s date in three columns — years, months, days — borrowing the days of the previous month when the day column goes negative, exactly as in column subtraction. Someone born on 15 June 1990 is 36 years, 3 months and 19 days old on 4 October 2026, and has been alive for 13,260 days.',
    minutes: { first: 'five minutes', again: 'seconds' },
    howLong: 'A minute by hand, seconds in the calculator. The time worth spending is on the reference date: an application that asks for your age “as on 1 August” wants that date, not today’s.',
    before: [
      'The date of birth, written unambiguously — day, month name and year — so that 03/04 cannot mean two different dates.',
      'The date you want the age on: today, or the cut-off date an exam, scheme or form specifies.',
      'For official purposes, the rule the organisation uses. Most count completed years, as below; a few count differently.'
    ],
    steps: [
      {
        name: 'Write both dates as year, month, day',
        body: [
          { p: 'Line the dates up like a subtraction sum, with the later date on top.' },
          { formula: '2026-10-04 (the date you want the age on)' },
          { formula: '1990-06-15 (the date of birth), subtracted' }
        ]
      },
      {
        name: 'Subtract the days, borrowing a month if you need to',
        body: [
          { p: 'Start from the right. 4 minus 15 does not go, so borrow one month and add the number of days in the month before the reference month. The month before October is September, which has 30 days: 4 + 30 − 15 = 19 days. Because a month was borrowed, the month column on top drops from 10 to 9.' }
        ]
      },
      {
        name: 'Subtract the months, borrowing a year if you need to',
        body: [
          { p: 'Now 9 − 6 = 3 months. If the top number had been smaller, you would borrow a year — add 12 to the months and take one off the years. Here there is no need, so the years are simply 2026 − 1990 = 36.' },
          { p: 'The answer: 36 years, 3 months, 19 days. The same calculation gives a whole number of years if that is all you need: you are 36 because the birthday in June has already passed this year.' },
          { tool: '/time/age-calculator/', why: 'walks the calendar the same way and adds the total months, weeks, days and hours, the weekday you were born on and the days to your next birthday', fill: 'dob=1990-06-15&on=2026-10-04', fillLabel: 'Do it in the age calculator with these two dates already in — it shows the working' }
        ]
      },
      {
        name: 'Work out an age on a cut-off date',
        body: [
          { p: 'Exams, school admissions, pension schemes and job adverts often set an age limit “as on” a particular date. Use that date as the reference, not today. Someone born on 20 November 2008 is 17 years, 10 months and 14 days old on 4 October 2026 — not yet 18, and will not be until 20 November 2026, 47 days later. If the cut-off were 1 December 2026, they would qualify.' },
          { tool: '/time/age-calculator/', why: 'change “Age at date” to the cut-off and it gives the age on that day, not today', fill: 'dob=2008-11-20&on=2026-10-04', fillLabel: 'Open it with a 2008 birthday checked on 4 October 2026' }
        ]
      },
      {
        name: 'Handle 29 February and the end of the month',
        body: [
          { p: 'Someone born on 29 February has a birthday on that date only in leap years. In other years the calculator treats the birthday as falling on 1 March: on 28 February 2027 a person born on 29 February 2004 is 22 years, 11 months and 30 days old, and turns 23 on 1 March. Rules for legal purposes differ between countries, so for anything official, check which date the organisation uses.' },
          { p: 'Month ends cause a similar wrinkle. From 31 January to 1 April is two months and one day, because the calendar walks from 31 January to 31 March and then one more day. Another calculator that counts months differently can be a day out on dates like these; neither is wrong, they follow different conventions.' },
          { example: {
            caption: 'Illustrative dates of birth, invented for this guide. Each age is what the Age Calculator’s own engine returns.',
            head: ['Born', 'Age on', 'Exact age', 'Total days'],
            rows: [
              ['15 June 1990', '4 October 2026', '36 years, 3 months, 19 days', '13,260'],
              ['20 November 2008', '4 October 2026', '17 years, 10 months, 14 days', '6,527'],
              ['29 February 2004', '28 February 2027', '22 years, 11 months, 30 days', '8,400'],
              ['29 February 2004', '1 March 2027', '23 years, 0 months, 0 days', '8,401'],
              ['31 January 2019', '1 April 2026', '7 years, 2 months, 1 day', '2,617']
            ]
          } }
        ]
      }
    ],
    wrong: [
      { name: 'Subtracting the years and stopping there', text: '2026 − 1990 is 36, but someone born in December 1990 is still 35 on 4 October 2026. The year subtraction is only right once the birthday has passed in the reference year. Check the months and days before you trust it.' },
      { name: 'Dividing the days by 365', text: 'Dividing a day count by 365 drifts by about a day every four years because of leap years, and dividing by 365.25 gives a decimal that is not how anyone states an age. Walk the calendar — years, months, days — as above.' },
      { name: 'Reading 03/04 the wrong way round', text: 'In India and the UK 03/04/2005 is 3 April; in the United States it is 4 March. A date of birth typed in the wrong order gives an age a month out, and the mistake survives because both dates are valid. Write the month as a name, or use year-month-day.' },
      { name: 'Counting both the first and the last day', text: 'The difference between two dates counts the days in between, so the day of birth itself is not an extra day lived. Counting inclusively — both ends — adds one, which matters when a rule says “at least 6,570 days”.' },
      { name: 'Using today when the form asks for a cut-off date', text: 'An age limit “as on 1 August 2026” is checked against 1 August, not the day you fill the form in. Someone eligible today can be ineligible on the cut-off, and the other way round.' }
    ],
    faq: [
      { q: 'How do I calculate my age in Excel?', a: '=DATEDIF(A2, TODAY(), "Y") gives completed years. "YM" gives the months after the last birthday and "MD" the days, though Microsoft warns that "MD" can give wrong results at some month ends — check those against a calendar.' },
      { q: 'How many days old am I?', a: 'Subtract your date of birth from today and count the days, or let the calculator do it: someone born on 15 June 1990 is 13,260 days old on 4 October 2026.' },
      { q: 'How do I work out my age on a specific date?', a: 'Use that date in place of today. In the Age Calculator, change “Age at date” to the date you need and the exact age on that day appears.' },
      { q: 'Why do two age calculators give different answers by a day?', a: 'Usually because of month-end or leap-day births, where there is more than one reasonable way to count a month. Check which convention the organisation asking for your age uses.' },
      { q: 'Is my date of birth sent anywhere?', a: 'No. The calculation runs in your browser and nothing is sent anywhere.' }
    ],
    tools: ['/time/age-calculator/', '/time/date-difference/', '/time/date-add-subtract/', '/time/business-days/'],
    collections: ['job-seekers', 'students'],
    related: ['calculate-bmi', 'calculate-a-percentage']
  },

  /* ================================================================== */
  {
    slug: 'format-json',
    glyph: 'i-json-formatter',
    name: 'How to format JSON',
    title: 'How to format JSON — pretty-print it, validate it, and fix the error it points at',
    description: 'Indent JSON so it can be read, find the line and column where broken JSON fails, fix the six faults that cause nearly every parse error, and minify or sort keys when you need to.',
    answer: 'To format JSON, parse it and write it back out with one key per line and each level of nesting indented — two spaces per level is the common choice. Paste it into the JSON Formatter and it does both at once; if the JSON is broken, it says which line and column the parser gave up on, which is where to start looking.',
    minutes: { first: 'five minutes', again: 'seconds' },
    howLong: 'Seconds for valid JSON. Broken JSON takes as long as it takes to find the fault, which is usually a minute once you know that the error position is where the parser noticed the problem, not always where the problem is.',
    before: [
      'The JSON itself: an API response, a configuration file, a log line or a webhook payload.',
      'If it came from a chat message, an email or a document, a suspicion that its quote marks may have been “improved” on the way.',
      'Nothing else. The formatter runs in the browser, so the JSON does not need to be cleaned of anything before you paste it.'
    ],
    steps: [
      {
        name: 'Paste the JSON and format it',
        body: [
          { p: 'Paste the raw JSON into the input. Valid JSON comes out indented, with each key on its own line and each nested object or array stepped in one level. Choose two spaces, four spaces or a tab — two spaces is the most common in web projects.' },
          { p: 'For the 108-byte single line below, the formatted output is 180 bytes over 15 lines, with 10 keys and items and a maximum nesting depth of 4, which the formatter reports underneath.' },
          { formula: JSON_MINIFIED },
          { tool: '/developer/json-formatter/', why: 'formats, validates and minifies JSON in the browser, and gives the line and column of any syntax error', fill: textFill(JSON_MINIFIED), fillLabel: 'Open the formatter with this JSON already pasted in' }
        ]
      },
      {
        name: 'If it will not parse, read the error position',
        body: [
          { p: 'This JSON has one fault — a comma after the last value:' },
          { formula: '{ "invoice": "INV-0042", "total": 29500, "paid": false, }' },
          { p: 'Laid out over five lines, as in the example the link below opens with, the formatter reports “Invalid JSON at line 5, column 1 — Expected double-quoted property name”. Line 5 is the closing brace. The parser read the comma, expected another key, found a brace, and stopped. The fault is on the line before the one reported, which is typical: the error marks where the parser noticed, so look just before it.' },
          { tool: '/developer/json-formatter/', why: 'paste the broken version and it names the line and column; take the comma out and it formats', fill: textFill(JSON_BROKEN), fillLabel: 'Open the formatter with the broken example in, and see the error it gives' },
          { fact: {
            text: 'JSON is defined by RFC 8259. Strings, including every object key, begin and end with double quotation marks; a comma separates one member or value from the next, so it may not follow the last one; and the grammar has no comments. The literal names are exactly true, false and null, in lower case. Object keys should be unique, and the RFC notes that software differs in what it does when they are not.',
            checked: CHECKED,
            sources: [src('rfc8259', 'the grammar for objects, arrays, strings and literals')]
          } }
        ]
      },
      {
        name: 'Fix the usual faults',
        body: [
          { example: {
            caption: 'Invented fragments, made up for this guide, showing the six faults behind most parse errors.',
            head: ['Fault', 'Looks like', 'Valid JSON'],
            rows: [
              ['Trailing comma', '"paid": false, }', '"paid": false }'],
              ['Single quotes', "{'invoice': 'INV-0042'}", '{"invoice": "INV-0042"}'],
              ['Unquoted key', '{invoice: "INV-0042"}', '{"invoice": "INV-0042"}'],
              ['A comment', '"total": 29500 // with GST', '"total": 29500'],
              ['Python or JavaScript values', 'True, None, undefined, NaN', 'true, null — or quote it'],
              ['Curly quotes from a word processor', '{“invoice”: “INV-0042”}', '{"invoice": "INV-0042"}']
            ]
          } },
          { p: 'Fix one fault, format again, and repeat. The parser stops at the first problem it meets, so a file with three faults reports them one at a time.' }
        ]
      },
      {
        name: 'Minify or sort keys when you need to',
        body: [
          { p: 'Formatted JSON is for people; minified JSON — everything on one line with no spaces — is what you send over a network or store. The two parse to exactly the same data. The worked example is 180 bytes formatted and 108 minified.' },
          { p: '“Formatted + keys sorted” puts every object’s keys in alphabetical order at every level. Two versions of a configuration file sorted this way compare cleanly line by line, because a key that moved no longer shows up as a change.' }
        ]
      }
    ],
    wrong: [
      { name: 'Quotes changed in transit', text: 'Paste JSON into a chat app, an email or a word processor and the straight double quotes may come back as curly ones. They look almost the same and are a different character. If valid-looking JSON fails at the first key, retype the quotes or copy from the original source.' },
      { name: 'A Python dictionary that looks like JSON', text: 'Printing a Python dictionary gives single quotes, True, False and None. It looks like JSON and is not. Use the language’s JSON encoder to produce real JSON rather than fixing the printed form by hand.' },
      { name: 'One object per line is not one JSON document', text: 'Logs and exports often hold one JSON object per line. Each line is valid on its own; the file as a whole is not, because there is nothing joining the objects. Format one line at a time, or wrap the lines in square brackets with commas between them.' },
      { name: 'Very large numbers quietly changing', text: 'The formatter parses JSON with the browser’s own engine, which stores numbers as double-precision floats. Integers larger than about nine thousand million million lose their last digits: 12345678901234567890 comes back as 12345678901234567000. If an ID is that long, it should travel as a string.' },
      { name: 'Duplicate keys disappearing', text: 'If the same key appears twice in one object, the browser keeps the last value and drops the first, without an error. A formatted file with fewer keys than the original is the sign. Find the duplicate in the source rather than trusting either value.' }
    ],
    faq: [
      { q: 'What is the difference between formatting and validating JSON?', a: 'Validating checks that the text follows the JSON grammar. Formatting rewrites valid JSON with indentation. The formatter does both: invalid JSON gets an error with a position instead of formatted output.' },
      { q: 'Does JSON allow comments?', a: 'No. The grammar has no comment syntax. Some tools accept JSON-like files with comments, such as some editor settings files, but those are not JSON and a strict parser will reject them.' },
      { q: 'Two spaces, four spaces or tabs?', a: 'It makes no difference to the data. Two spaces is the most common choice in web projects; match whatever the rest of your project uses so that changes compare cleanly.' },
      { q: 'Is my JSON sent anywhere?', a: 'No. It is parsed and formatted in your browser with the browser’s built-in JSON engine. Nothing leaves the page, which matters for configuration files with hostnames or keys in them.' },
      { q: 'Why does the error point at the wrong line?', a: 'It points at the place the parser could no longer continue, which is often just after the real mistake — the line after a trailing comma, or the end of the file after a missing bracket. Start at the position given and look backwards.' }
    ],
    tools: ['/developer/json-formatter/', '/developer/csv-to-json/', '/developer/xml-formatter/', '/developer/jwt-decoder/'],
    collections: ['developers'],
    related: ['calculate-a-percentage']
  },

  /* ================================================================== */
  {
    slug: 'convert-cgpa-to-percentage',
    glyph: 'i-cgpa',
    name: 'How to convert CGPA to percentage',
    title: 'How to convert CGPA to percentage — CBSE, a plain ten-point scale, VTU and GTU, and back again',
    description: 'Convert a CGPA to a percentage with the formula your board or university actually publishes, work a percentage requirement back into a CGPA, and avoid quoting a conversion nobody will accept.',
    answer: 'Multiply your CGPA by the factor your board or university publishes: for a CBSE class 10 CGPA it is 9.5, so 8.2 is 77.9%; many universities use a plain × 10, so 8.2 is 82%; and some subtract an offset first — VTU’s (CGPA − 0.75) × 10 turns 8.2 into 74.5%. Use the formula printed on your own marksheet or in your university’s regulations, because that is the only one an admissions office or employer will accept.',
    minutes: { first: 'ten minutes', again: 'seconds' },
    howLong: 'Seconds once you know your institution’s formula. Finding that formula is the real work, and it is usually printed on the back of the marksheet or in the examination regulations.',
    before: [
      'Your CGPA exactly as printed on the marksheet or transcript, to the decimal places shown.',
      'Your board’s or university’s conversion rule. Look on the reverse of the grade card, in the examination ordinance, or on the university’s website.',
      'The maximum of your scale — 10 for most Indian boards and universities, 4 for some institutions abroad.'
    ],
    steps: [
      {
        name: 'Find the formula your institution uses',
        body: [
          { p: 'There is no single national CGPA-to-percentage formula. Each board or university sets its own, and the difference matters: on a CGPA of 8.2 the common formulas give answers more than seven percentage points apart. The rule is usually printed on the back of the grade card. If it is not there, it will be in the examination regulations.' },
          { fact: {
            text: 'CBSE’s rule for the grades it introduced at secondary level from 2009–10 is an indicative percentage of 9.5 × CGPA overall, and 9.5 × the grade point for each subject. It was set out in Circular No. 24 of 28 May 2010 and applies to CBSE class 10 results reported as grades — not to a university degree CGPA.',
            checked: CHECKED,
            sources: [src('cbseCgpa', 'overall indicative percentage of marks = 9.5 × CGPA')]
          } }
        ]
      },
      {
        name: 'Apply it to your CGPA',
        body: [
          { formula: 'percentage = (CGPA − offset) × multiplier' },
          { p: 'Most formulas are this shape. A plain ten-point scale has no offset and multiplies by 10. CBSE has no offset and multiplies by 9.5. VTU subtracts 0.75, GTU subtracts 0.5, and both then multiply by 10.' },
          { example: {
            caption: 'An illustrative CGPA of 8.2, invented for this guide, put through each formula by the CGPA to Percentage Converter’s own engine.',
            head: ['Formula', 'Working', 'Percentage', 'Highest possible'],
            rows: [
              ['Ten-point', '8.2 × 10', '82%', '100%'],
              ['CBSE', '8.2 × 9.5', '77.9%', '95%'],
              ['GTU', '(8.2 − 0.5) × 10', '77%', '95%'],
              ['VTU', '(8.2 − 0.75) × 10', '74.5%', '92.5%']
            ]
          } },
          { p: 'The last column is worth a glance: it is what a perfect 10 converts to under each rule. If a formula’s ceiling does not match what your institution says a 10 is worth, it is the wrong formula.' },
          { tool: '/education/cgpa-to-percentage/', why: 'converts with the ten-point, CBSE, VTU or GTU rule, or one you enter, and shows the highest figure the formula can give', fill: 'direction=toPercent&value=8.2&scheme=vtu', fillLabel: 'Do it in the converter with 8.2 and the VTU rule already in — it shows the working' }
        ]
      },
      {
        name: 'Work a percentage requirement back into a CGPA',
        body: [
          { formula: 'CGPA = percentage ÷ multiplier + offset' },
          { p: 'An admission or job advert asking for “75% or equivalent” needs the reverse. Under the ten-point rule, 75% is a CGPA of 7.5. Under CBSE’s rule it is 75 ÷ 9.5 = 7.89. Under GTU it is 75 ÷ 10 + 0.5 = 8.0, and under VTU 75 ÷ 10 + 0.75 = 8.25. The same percentage needs a CGPA up to 0.75 higher depending on where you studied.' },
          { tool: '/education/cgpa-to-percentage/', why: 'set “Convert” to percentage to CGPA and it runs the formula backwards', fill: 'direction=toCgpa&value=75&scheme=cbse', fillLabel: 'Open it with 75% under the CBSE rule — it shows 7.89' }
        ]
      },
      {
        name: 'If your scale is not out of 10, or you only have SGPAs',
        body: [
          { p: 'On a 4-point scale, set the maximum to 4 and use the multiplier your institution publishes; × 25 is a common one, which makes 3.4 into 85%. Do not assume it — many institutions on a 4-point scale publish no percentage equivalent at all, and say so.' },
          { p: 'If your marksheets give a grade point average for each semester (SGPA) and you need the overall CGPA, it is normally the credit-weighted average: multiply each semester’s SGPA by its credits, add them up, and divide by the total credits. Then convert that CGPA.' },
          { tool: '/education/sgpa-to-cgpa/', why: 'combines semester SGPAs into a CGPA, weighted by credits, before you convert it' }
        ]
      }
    ],
    wrong: [
      { name: 'Using CBSE’s 9.5 for a university degree', text: 'The 9.5 rule is CBSE’s, for its own grades. It is widely repeated online as if it were a general rule, and a university that publishes × 10 or an offset formula will not accept a figure worked out with it. Use your own institution’s formula.' },
      { name: 'Using × 10 where your university subtracts an offset', text: 'A plain × 10 on a VTU CGPA of 8.2 gives 82% instead of 74.5% — a difference big enough to claim an eligibility you do not have. If your calculated figure looks a point or two high, an offset is usually the reason.' },
      { name: 'Rounding the CGPA before converting', text: 'Rounding 7.86 to 7.9 before multiplying by 9.5 turns 74.67% into 75.05% and crosses a 75% cut-off that the real figure does not. Convert the CGPA exactly as printed, and round only the percentage, the way your institution says to.' },
      { name: 'Quoting your own conversion as if it were official', text: 'An application that asks for a percentage usually wants the figure your institution issues, or your CGPA with its conversion rule attached. A number you worked out yourself is useful for checking eligibility, and is not evidence of it.' },
      { name: 'Mixing up SGPA and CGPA', text: 'An SGPA covers one semester; a CGPA covers all of them. Converting your best semester’s SGPA and quoting it as your overall percentage is an easy mistake to make on a form and an awkward one to explain at verification.' }
    ],
    faq: [
      { q: 'What is 7.5 CGPA in percentage?', a: 'Under a plain ten-point rule, 75%. Under CBSE’s rule, 7.5 × 9.5 = 71.25%. Under GTU it is 70% and under VTU 67.5%. Which one is right depends entirely on who issued the CGPA.' },
      { q: 'Is CGPA × 10 the correct formula?', a: 'For some universities, yes; for many, no. It is the most common default, but CBSE uses 9.5 and several universities subtract an offset first. Check your own marksheet or regulations.' },
      { q: 'What if my university uses a conversion table, not a formula?', a: 'Then use the table. No formula can reproduce a table, and a calculator that pretends to will be wrong somewhere.' },
      { q: 'Can a converted percentage be more than 100?', a: 'With some formulas, at the very top of the scale, yes — it is a property of the formula rather than a mistake. The converter shows the highest figure your chosen formula can produce so you can see it.' },
      { q: 'Is the converted figure accepted on applications?', a: 'Only if it follows your institution’s published rule, and often only alongside the CGPA itself. Quote what is on your transcript, and attach the conversion rule if a form insists on a percentage.' }
    ],
    tools: ['/education/cgpa-to-percentage/', '/education/sgpa-to-cgpa/', '/education/marks-percentage/', '/utilities/gpa-calculator/'],
    collections: ['students', 'job-seekers'],
    related: ['calculate-a-percentage', 'calculate-age']
  },

  /* ================================================================== */
  {
    slug: 'calculate-sip-returns',
    glyph: 'i-sip-calculator',
    name: 'How to calculate SIP returns',
    title: 'How to calculate SIP returns — the formula, a worked example, step-up SIPs and what a projection leaves out',
    description: 'Project what a monthly SIP could grow to with the future-value formula, see what a yearly step-up, a longer horizon and a lower return do to it, and measure what a real SIP has actually earned.',
    answer: 'To project a SIP, use FV = P × ((1 + i)ⁿ − 1) ÷ i × (1 + i), with P the monthly instalment, i the expected yearly return divided by 1,200, and n the count of months. ₹10,000 a month for 15 years at an assumed 12% a year comes to about ₹50,45,760 — ₹18,00,000 paid in and ₹32,45,760 of growth — but the 12% is an assumption, and real fund returns arrive unevenly.',
    minutes: { first: 'ten minutes', again: 'a minute' },
    howLong: 'A minute in the calculator. Spend the rest on the assumed return: run the same SIP at 8%, 10% and 12%, because the gap between those answers is the honest range of outcomes.',
    before: [
      'The monthly amount you could keep paying through bad years as well as good ones.',
      'How many years until you need the money. Over short periods a projection says much less, because a fall near the end has no time to recover.',
      'An assumed annual return — your guess, not a figure the fund gives you.',
      'For a SIP you already hold, every instalment’s date and amount and today’s value, from the account statement.'
    ],
    steps: [
      {
        name: 'Turn the yearly figures into monthly ones',
        body: [
          { p: 'Instalments are monthly, so the formula works in months. Divide the expected annual return by 12 and then by 100: 12% a year becomes 0.01 a month. Multiply the years by 12: 15 years is 180 instalments. (Compounded monthly, 1% a month is about 12.68% a year — the convention SIP calculators use.)' }
        ]
      },
      {
        name: 'Put the numbers into the future-value formula',
        body: [
          { formula: 'FV = P × ((1 + i)ⁿ − 1) ÷ i × (1 + i)' },
          { p: 'With P = 10,000, i = 0.01 and n = 180: 1.01 to the power 180 is about 5.9958, so ((1.01)¹⁸⁰ − 1) ÷ 0.01 is about 499.58. Multiply by 10,000 and then by 1.01, and the projected value is ₹50,45,760. You paid in 180 × ₹10,000 = ₹18,00,000, so ₹32,45,760 of the total is assumed growth: the money ends up 2.8 times what went in.' },
          { p: 'The final × (1 + i) assumes each instalment goes in at the start of its month. Leave it out — instalments at the end of each month — and the same SIP projects to about ₹49,95,802. In a spreadsheet: =FV(12%/12, 180, -10000, 0, 1), where the last 1 means start-of-month payments.' },
          { tool: '/india/sip-calculator/', why: 'projects a monthly SIP with an optional yearly step-up and shows the value, the amount invested and the gain for every year', fill: 'monthly=10000&rate=12&years=15&stepup=0', fillLabel: 'Do it in the SIP calculator with ₹10,000 a month at 12% for 15 years — it shows ₹50,45,760' }
        ]
      },
      {
        name: 'Read the year-by-year table, not just the last line',
        body: [
          { example: {
            caption: 'An illustrative SIP of ₹10,000 a month at an assumed 12% a year, invented for this guide. Every figure is what the SIP Calculator’s own engine returns.',
            head: ['After', 'Paid in', 'Projected value', 'Growth'],
            rows: [
              ['1 year', '₹1,20,000', '₹1,28,093', '₹8,093'],
              ['5 years', '₹6,00,000', '₹8,24,864', '₹2,24,864'],
              ['10 years', '₹12,00,000', '₹23,23,391', '₹11,23,391'],
              ['15 years', '₹18,00,000', '₹50,45,760', '₹32,45,760']
            ]
          } },
          { p: 'Most of the growth arrives late. Between year 10 and year 15 the projected value rises by ₹27,22,369, of which only ₹6,00,000 is new money — which is why stopping a SIP a few years early costs far more than the skipped instalments.' }
        ]
      },
      {
        name: 'Compare a step-up, a longer horizon and a lower return',
        body: [
          { example: {
            caption: 'Illustrative SIPs of ₹10,000 a month to start with, invented for this guide. Every figure is what the SIP Calculator’s own engine returns.',
            head: ['SIP', 'Paid in', 'Projected value'],
            rows: [
              ['12% for 15 years', '₹18,00,000', '₹50,45,760'],
              ['12% for 15 years, 10% step-up each year', '₹38,12,698', '₹86,83,849'],
              ['12% for 20 years', '₹24,00,000', '₹99,91,479'],
              ['10% for 15 years', '₹18,00,000', '₹41,79,243'],
              ['8% for 15 years', '₹18,00,000', '₹34,83,451']
            ]
          } },
          { p: 'Five more years almost doubles the projection. A 10% yearly step-up takes the last year’s instalment to ₹37,975 a month and the projection to ₹86,83,849. And on the same ₹18,00,000, assuming 12% instead of 8% adds ₹15,62,309 — the assumption matters more than the arithmetic.' },
          { tool: '/india/sip-calculator/', why: 'the “Annual step-up” field raises the instalment by that percentage after every twelve months', fill: 'monthly=10000&rate=12&years=15&stepup=10', fillLabel: 'Open it with a 10% yearly step-up — it shows ₹86,83,849' },
          { fact: {
            text: 'SEBI’s FAQ for mutual fund investors describes a SIP as investing periodically, which averages the cost of the units bought, and states that mutual fund investments are subject to market risks: the scheme’s NAV, the price of a unit, is worked out and published every day and moves with the market. On selling units of an equity-oriented fund, a gain on units held for 12 months or less is taxed at 20%, and a gain on units held for longer at 12.5% on the part above ₹1.25 lakh in a year. Those rates have applied to transfers since 23 July 2024, and the Income-tax Act, 2025, in force from 1 April 2026, keeps them. Other kinds of fund are taxed under different rules.',
            checked: CHECKED,
            sources: [src('sebiMfFaq', 'what a SIP is, how NAV is set, and market risk'), src('cbdtCapitalGains', 'the 20% and 12.5% rates, the ₹1.25 lakh exemption and the 12-month holding period for listed units'), src('itrApplicable', 'long-term gains under section 112A up to ₹1,25,000 in the return forms')]
          } }
        ]
      },
      {
        name: 'Measure what a SIP you already hold has earned',
        body: [
          { p: 'The formula projects a SIP; it cannot measure one, because a real SIP buys at a different NAV every month. For the return actually earned, use XIRR: list each instalment date with its amount as a negative number, add today’s date with the current value as a positive number, and use =XIRR(amounts, dates). The answer is the yearly return achieved, to set beside the rate you assumed.' },
          { p: 'Dividing the gain by the amount paid in gives the absolute return — 180% on the worked example — which is not a yearly figure: the first instalment was invested for 15 years and the last for one month.' }
        ]
      }
    ],
    wrong: [
      { name: 'Treating the assumed return as a forecast', text: 'A calculator multiplies whatever rate it is given. No fund promises 12%, and a run of poor years close to the end can leave the real result well below any projection. Run 8% and 10% beside it.' },
      { name: 'Using the yearly rate as the monthly one', text: 'Putting 12, or 0.12, into the formula as i instead of 0.01 produces a figure in the hundreds of crores. An absurd projection means the rate was not divided by 1,200.' },
      { name: 'Comparing calculators that time the payments differently', text: 'Start-of-month and end-of-month calculators differ by one month’s growth: ₹50,45,760 against ₹49,95,802 here. Neither is wrong; check which convention each uses before comparing them.' },
      { name: 'Quoting the absolute return as a yearly rate', text: '180% growth after 15 years is not 12% a year because 180 divided by 15 is 12. That shortcut ignores when each rupee went in. Use XIRR.' },
      { name: 'Forgetting tax and the newest instalments', text: 'Projections are before tax. Every instalment buys its own units, so redeeming a whole SIP includes units bought in the last 12 months, whose gains are short-term. Check the newest units’ holding period before you sell.' }
    ],
    faq: [
      { q: 'How is a SIP return calculated?', a: 'A projection uses the future-value formula with a monthly rate, FV = P × ((1 + i)ⁿ − 1) ÷ i × (1 + i). The return a real SIP has earned is measured with XIRR, on the dated instalments and today’s value.' },
      { q: 'What will ₹5,000 a month become in 15 years?', a: 'At an assumed 12% a year, about ₹25,22,880 from ₹9,00,000 paid in; at 10%, about ₹20,89,621. The projection scales with the instalment, so it is exactly half the ₹10,000 example.' },
      { q: 'Are SIP returns guaranteed?', a: 'No. Units are bought and sold at a NAV that changes every day with the market, and mutual fund investments are subject to market risks. The calculator’s figure is arithmetic on an assumption, not an offer.' },
      { q: 'What is a step-up SIP?', a: 'One where the instalment rises every year by a set percentage or amount. A 10% step-up on ₹10,000 a month means ₹11,000 a month in the second year and ₹37,975 a month by the fifteenth.' },
      { q: 'Should I use XIRR or CAGR to judge my SIP?', a: 'XIRR. CAGR suits a single sum invested once; a SIP is many payments on many dates, which is the problem XIRR solves. For one lump sum the two give practically the same answer.' }
    ],
    tools: ['/india/sip-calculator/', '/india/lumpsum-returns/', '/finance/compound-interest/', '/business/cagr/'],
    related: ['calculate-cagr', 'calculate-emi', 'calculate-a-percentage']
  },

  /* ================================================================== */
  {
    slug: 'calculate-cagr',
    glyph: 'i-cagr',
    name: 'How to calculate CAGR',
    title: 'How to calculate CAGR — compound annual growth rate, worked through, and why averaging the yearly growth is wrong',
    description: 'Work out the compound annual growth rate from a start value, an end value and the years between them, check it with a projection and the rule of 72, and avoid the counting, averaging and start-year traps.',
    answer: 'CAGR = (end value ÷ start value)^(1 ÷ years) − 1. An investment that grew from £10,000 to £18,000 in five years has a CAGR of 1.8^(1 ÷ 5) − 1 = 12.47% a year — the steady yearly rate that would have produced the same result, whatever actually happened in between.',
    minutes: { first: 'five minutes', again: 'seconds' },
    howLong: 'Seconds once you have the two values and the right number of years. Counting the years is where most wrong answers come from, so spend the minute there.',
    before: [
      'The value at the start and the value at the end, measured the same way — both revenue for a full year, or both the market value of the same holding.',
      'The exact time between the two measurements, in years. Six months is 0.5 of a year.',
      'Whether money was added or taken out along the way. If it was, CAGR is the wrong tool and XIRR is the right one.'
    ],
    steps: [
      {
        name: 'Count the years between the two values',
        body: [
          { p: 'The number of years is the gap between the two measurements, not the number of years named. Revenue of £250,000 in 2021 and £400,000 in 2025 spans four years of growth — 2021 to 2022, 2022 to 2023, 2023 to 2024 and 2024 to 2025 — even though five years appear in the range.' },
          { p: 'For anything measured on dates rather than in whole years, convert the gap to a decimal: seven years and six months is 7.5.' }
        ]
      },
      {
        name: 'Divide, take the root, subtract one',
        body: [
          { formula: 'CAGR = (end ÷ start)^(1 ÷ years) − 1' },
          { p: 'Divide the end value by the start value: 18,000 ÷ 10,000 = 1.8. Raise that to the power of one over the number of years — 1.8 to the power 0.2 is about 1.1247. Subtract 1 and turn it into a percentage: 12.47% a year.' },
          { p: 'In a spreadsheet, =(18000/10000)^(1/5)-1 gives the same answer, and so does =RRI(5, 10000, 18000).' },
          { tool: '/business/cagr/', why: 'works out the compound annual growth rate, the total growth, the growth multiple and the years to double, and projects the value forward at the same rate', fill: 'begin=10000&end=18000&years=5&project=3', fillLabel: 'Do it in the CAGR calculator with £10,000 to £18,000 over five years — it shows 12.475%' }
        ]
      },
      {
        name: 'Check it by running it forwards',
        body: [
          { p: 'Multiply the start value by (1 + CAGR) once for every year: 10,000 × 1.1247 × 1.1247 × 1.1247 × 1.1247 × 1.1247 comes back to £18,000. If it does not, the number of years is wrong.' },
          { p: 'The rule of 72 is a quick sense check: 72 ÷ 12.47 suggests the money doubles in about 5.8 years; the exact figure, which the calculator gives, is 5.9 years. Going forwards, the same rate would take £18,000 to £20,245.43 a year later and £25,611.56 after three — if, and only if, the rate held.' }
        ]
      },
      {
        name: 'Why the average of yearly growth rates is the wrong answer',
        body: [
          { p: 'Something that rises 50% in one year and falls 50% the next has an average yearly growth of zero. But 100 became 150 and then 75, so a quarter of the money has gone. CAGR says so: (75 ÷ 100)^(1 ÷ 2) − 1 = −13.40% a year. Averaging percentages that compound always flatters the result, and the swings decide by how much.' },
          { example: {
            caption: 'Illustrative figures, invented for this guide. Each result is what the CAGR Calculator’s own engine returns for them.',
            head: ['Start', 'End', 'Years', 'Total growth', 'CAGR'],
            rows: [
              ['£10,000', '£18,000', '5', '80%', '12.47%'],
              ['£250,000', '£400,000', '4', '60%', '12.47%'],
              ['£50,000', '£120,000', '7.5', '140%', '12.38%'],
              ['£100 (up 50%, then down 50%)', '£75', '2', '−25%', '−13.40%']
            ]
          } },
          { p: 'The first two rows are worth a second look: 80% over five years and 60% over four are the same growth rate. Total growth cannot be compared across different spans of time; CAGR can.' },
          { tool: '/business/cagr/', why: 'a falling value gives a negative rate, and the calculator shows it rather than hiding it', fill: 'begin=100&end=75&years=2&project=0', fillLabel: 'Open it with the up-50%, down-50% example — it shows −13.398%' }
        ]
      },
      {
        name: 'Know what CAGR leaves out',
        body: [
          { ul: [
            'The path. A steady 12% a year and a lurching ride that ends in the same place have the same CAGR, and very different risks.',
            'The choice of dates. Starting the count in a bad year, or ending it in a good one, can change the answer more than anything that happened in between.',
            'Money in and out. A balance that grew partly because more was paid in has not grown at its CAGR. For regular contributions, use XIRR.'
          ] }
        ]
      }
    ],
    wrong: [
      { name: 'Counting the years in the range instead of the gaps', text: 'Revenue from 2021 to 2025 is four years of growth. Dividing by five turns £250,000 to £400,000 into 9.86% a year instead of 12.47%, and the error grows the shorter the period is.' },
      { name: 'Averaging the yearly growth rates', text: 'An arithmetic average of +50% and −50% is zero; the money actually fell by a quarter. Use the start and end values, not the average of the steps between them.' },
      { name: 'Choosing a flattering start year', text: 'Measuring from the bottom of a slump makes any recovery look like fast growth. When you quote a CAGR, give the dates, and when you read one, check whether a different start year would tell a different story.' },
      { name: 'Using CAGR when money was added along the way', text: 'A portfolio that went from £10,000 to £18,000 partly because £5,000 was paid in has not grown at 12.47% a year. CAGR assumes one sum at the start and nothing else; XIRR handles deposits and withdrawals on their dates.' },
      { name: 'Reading the projection as a forecast', text: 'The projected values assume the same rate carries on. They show what the rate means in money, not what will happen next year.' }
    ],
    faq: [
      { q: 'What is the CAGR formula?', a: 'CAGR = (end value ÷ start value)^(1 ÷ number of years) − 1, multiplied by 100 for a percentage. It is the geometric mean growth rate: the single yearly rate that turns the start value into the end value.' },
      { q: 'How do I calculate CAGR in Excel?', a: 'Use =(end/start)^(1/years)-1 and format the cell as a percentage, or =RRI(years, start, end). For £10,000 to £18,000 over five years, both give 12.47%.' },
      { q: 'Can CAGR be negative?', a: 'Yes. If the end value is lower than the start value the rate is negative: £100 to £75 over two years is −13.40% a year.' },
      { q: 'What is the difference between CAGR and total growth?', a: 'Total growth is the whole change over the period: £10,000 to £18,000 is 80%. CAGR spreads it into a yearly rate, 12.47%, so that periods of different lengths can be compared.' },
      { q: 'What counts as a good CAGR?', a: 'It depends entirely on what is being measured and the alternative. Compare it with something real over the same dates — inflation, a savings rate, or an index — rather than with a number in isolation.' }
    ],
    tools: ['/business/cagr/', '/business/roi/', '/finance/compound-interest/', '/mathematics/percentage/'],
    collections: ['small-business'],
    related: ['calculate-roi', 'calculate-sip-returns', 'calculate-a-percentage']
  },

  /* ================================================================== */
  {
    slug: 'calculate-roi',
    glyph: 'i-roi',
    name: 'How to calculate ROI',
    title: 'How to calculate ROI — return on investment, the annualised return and the payback period, worked through',
    description: 'Return on investment as a percentage, turned into a yearly rate so that different time spans compare fairly, with the payback period and the costs and returns people forget to count.',
    answer: 'ROI = (total return − cost) ÷ cost × 100. A £12,000 machine that brings in £18,600 over two years has an ROI of 6,600 ÷ 12,000 × 100 = 55%; spread over the two years that is an annualised return of 24.5% a year, and at £9,300 a year it pays for itself in about 1.3 years.',
    minutes: { first: 'fifteen minutes', again: 'a minute' },
    howLong: 'A minute once the figures are agreed. Allow longer the first time for the honest part — listing every cost and deciding how much of the return the investment really caused — because that, not the division, is what decides whether the answer means anything.',
    before: [
      'Every cost of the investment: the price, delivery and installation, training, the staff time to set it up, and any financing charges.',
      'The return it produced or will produce — the extra profit, not the extra sales — over a stated period.',
      'The length of that period in years, and the yearly cash it brings in if you want the payback period.'
    ],
    steps: [
      {
        name: 'Add up the full cost',
        body: [
          { p: 'The cost is everything spent to make the investment work, not just the invoice. In the worked example the machine costs £10,500, installation £900 and training £600: £12,000 in all. Leaving out the last two would make the same result look better than it is.' }
        ]
      },
      {
        name: 'Add up the return over the same period',
        body: [
          { p: 'The return is what the investment brings back: extra profit, money saved, or the sale price if the asset is sold. Here the machine adds £9,300 a year to profit for two years, so the total return is £18,600. If its output sells for £30,000 and costs £11,400 in materials and labour to make, the return is the £18,600 that is left, not the £30,000 of sales.' }
        ]
      },
      {
        name: 'Work out the ROI',
        body: [
          { formula: 'ROI = (total return − cost) ÷ cost × 100' },
          { p: 'The net gain is 18,600 − 12,000 = £6,600. Divided by the cost and multiplied by 100: 6,600 ÷ 12,000 × 100 = 55%. Another way to say it is a return multiple of 1.55: every pound put in came back with 55p on top.' },
          { tool: '/business/roi/', why: 'works out the ROI, the net gain, the annualised return and the payback period from the cost, the return, the years and the yearly cash inflow', fill: 'cost=12000&gain=18600&years=2&annualCash=9300', fillLabel: 'Do it in the ROI calculator with this example already in — it shows 55% and the payback' }
        ]
      },
      {
        name: 'Annualise it before you compare',
        body: [
          { formula: 'annualised return = (total return ÷ cost)^(1 ÷ years) − 1' },
          { p: 'A headline ROI says nothing about how long the money was tied up. 55% in two years is (1.55)^(1 ÷ 2) − 1 = 24.5% a year; the same 55% over three years is only 15.73% a year. This is the figure to compare between projects, or with what the money would earn elsewhere.' },
          { example: {
            caption: 'Illustrative investments, invented for this guide. Every figure is what the ROI Calculator’s own engine returns for them.',
            head: ['Investment', 'ROI', 'Per year', 'Payback'],
            rows: [
              ['£12,000 in, £18,600 back over 2 years (£9,300 a year)', '55%', '24.5%', '1.29 years'],
              ['£12,000 in, £18,600 back over 3 years (£6,200 a year)', '55%', '15.73%', '1.94 years'],
              ['£5,000 in, £8,000 back over 5 years', '60%', '9.86%', '—'],
              ['£5,000 in, £6,500 back over 1 year', '30%', '30%', '—']
            ]
          } },
          { p: 'The third row has the biggest headline ROI and the worst return per year. The fourth has half the ROI and three times the yearly rate.' },
          { tool: '/business/roi/', why: 'change the holding period and the annualised figure moves while the headline ROI stays put', fill: 'cost=12000&gain=18600&years=3&annualCash=6200', fillLabel: 'Open the three-year version — the same 55%, but 15.73% a year' }
        ]
      },
      {
        name: 'Work out how long it takes to pay for itself',
        body: [
          { formula: 'payback period = cost ÷ yearly cash inflow' },
          { p: '12,000 ÷ 9,300 = 1.29 years, or about fifteen and a half months. Payback is a useful test of risk — the sooner the money is back, the less can go wrong — but it ignores everything after that date, so a short project can beat a far more valuable long one on payback alone.' },
          { p: 'For anything that runs for several years, money arriving later is worth less than money today. Net present value and IRR allow for that; ROI and payback do not.' },
          { tool: '/business/npv-irr/', why: 'discounts each year’s cash flow, for investments where the timing of the money matters' }
        ]
      }
    ],
    wrong: [
      { name: 'Counting sales as the return', text: 'Extra revenue is not extra profit. If the machine’s output sells for £30,000 but costs £11,400 to make, counting the £30,000 turns a 55% ROI into 150%. Use the profit that would not have happened without the investment.' },
      { name: 'Leaving costs out', text: 'Installation, training, staff time, software subscriptions and interest on the loan that paid for it are all part of the cost. An ROI built on the invoice price alone is the most common reason an internal business case looks better than the result.' },
      { name: 'Comparing ROIs over different periods', text: '60% over five years and 30% in one year are not “twice as good” and “half as good”. Per year, they are 9.86% and 30%. Annualise first.' },
      { name: 'Crediting the investment with everything that improved', text: 'If sales would have grown anyway — a busy season, a price rise, a competitor closing — that growth is not the investment’s return. Compare with what would have happened without it, however roughly.' },
      { name: 'Ignoring when the money arrives', text: 'Simple ROI treats £18,600 received over two years as if it arrived today. For short projects the difference is small; for long ones, use NPV or IRR.' }
    ],
    faq: [
      { q: 'What is the ROI formula?', a: '(Total return − cost) ÷ cost × 100. A £12,000 investment returning £18,600 has an ROI of 55%.' },
      { q: 'How do I calculate ROI in Excel?', a: 'With the cost in A2 and the total return in B2, =(B2-A2)/A2 formatted as a percentage. For the yearly figure, with the years in C2, use =(B2/A2)^(1/C2)-1.' },
      { q: 'What is a good ROI?', a: 'One whose yearly rate comfortably beats the cost of the money and the next best use of it. A 15% a year return funded by a loan at 12% leaves little room for anything to go wrong.' },
      { q: 'Can ROI be negative?', a: 'Yes. If less comes back than went in, the ROI is negative: £5,000 in and £4,000 back is −20%.' },
      { q: 'Is annualised ROI the same as CAGR?', a: 'For one sum invested at the start and one amount received at the end, yes — it is the same calculation. With cash coming in each year, it is an approximation, and IRR is the exact answer.' }
    ],
    tools: ['/business/roi/', '/business/npv-irr/', '/business/cagr/', '/business/break-even/'],
    collections: ['small-business'],
    related: ['calculate-cagr', 'calculate-profit-margin-and-markup', 'calculate-a-percentage']
  },

  /* ================================================================== */
  {
    slug: 'calculate-profit-margin-and-markup',
    glyph: 'i-profit-margin',
    name: 'How to calculate profit margin and markup',
    title: 'How to calculate profit margin and markup — the two formulas, converting between them, and pricing for a target margin',
    description: 'Margin is profit as a share of the price and markup is profit as a share of the cost. Work out both, set a price from a target margin, find the cost you can afford, and stop the two being confused.',
    answer: 'Profit margin is profit divided by the selling price; markup is profit divided by the cost. An item that costs £60 and sells for £100 makes £40 of profit: a 40% margin (40 ÷ 100) but a 66.67% markup (40 ÷ 60) — the same sale described two ways, and confusing them is how prices end up too low.',
    minutes: { first: 'ten minutes', again: 'seconds' },
    howLong: 'Seconds per item once you know the full cost. The part that takes time is the cost itself: delivery in, packaging, payment fees and returns all belong in it, and a margin worked out on the purchase price alone is a margin you will not actually make.',
    before: [
      'The full cost of one item: what you pay for it plus delivery in, packaging and anything else spent on each unit.',
      'The selling price before VAT or GST, or the margin you are aiming for.',
      'Which figure the person you are talking to means. Retailers and accountants usually talk about margin; trade suppliers often quote markup.'
    ],
    steps: [
      {
        name: 'Work out the profit on one item',
        body: [
          { formula: 'profit = selling price − cost' },
          { p: 'An item that costs £60 to buy and get ready for sale, sold for £100 before tax, makes £40. Everything else follows from those three numbers; the only question is what you divide the £40 by.' }
        ]
      },
      {
        name: 'Divide by the price for margin, by the cost for markup',
        body: [
          { formula: 'margin = profit ÷ selling price × 100' },
          { formula: 'markup = profit ÷ cost × 100' },
          { p: 'The margin is 40 ÷ 100 × 100 = 40%: forty pence of every pound taken is profit. The markup is 40 ÷ 60 × 100 = 66.67%: the cost was raised by two thirds to reach the price. Margin can never reach 100%, because that would mean the goods cost nothing; markup has no ceiling.' },
          { tool: '/business/profit-margin/', why: 'works out margin, markup, cost or selling price from any two of them, with profit per unit and totals for a number of units', fill: 'solve=margin&cost=60&price=100', fillLabel: 'Do it in the calculator with a £60 cost and a £100 price — it shows 40% and 66.667%' }
        ]
      },
      {
        name: 'Set a price from a target margin',
        body: [
          { formula: 'price = cost ÷ (1 − margin ÷ 100)' },
          { p: 'For a 30% margin on an item costing £42, divide by 0.70: the price is £60, with £18 of profit. It is not £42 × 1.30 = £54.60. That adds 30% of the cost — a 30% markup — and leaves a margin of only 23.08%. On 500 units the right price brings in £9,000 of profit; the wrong one, £6,300.' },
          { tool: '/business/profit-margin/', why: 'set “Solve for” to selling price and it divides by one minus the margin rather than adding a percentage on', fill: 'solve=price&cost=42&margin=30&units=500', fillLabel: 'Open it with a £42 cost and a 30% target margin — it shows a £60 price' }
        ]
      },
      {
        name: 'Convert between margin and markup',
        body: [
          { formula: 'markup = margin ÷ (1 − margin)' },
          { formula: 'margin = markup ÷ (1 + markup)' },
          { p: 'Work in fractions: a 30% margin is 0.30 ÷ 0.70 = 0.4286, a 42.86% markup. A 50% markup is 0.5 ÷ 1.5 = 0.3333, a 33.33% margin. The gap between the two widens as the numbers grow.' },
          { example: {
            caption: 'Illustrative prices, invented for this guide. Every figure is what the Profit Margin & Markup Calculator’s own engine returns for them.',
            head: ['Cost and price', 'Profit', 'Margin', 'Markup'],
            rows: [
              ['Cost £40, price £60', '£20', '33.33%', '50%'],
              ['Cost £42, price £54.60', '£12.60', '23.08%', '30%'],
              ['Cost £42, price £60', '£18', '30%', '42.86%'],
              ['Cost £60, price £100', '£40', '40%', '66.67%'],
              ['Cost £50, price £100', '£50', '50%', '100%']
            ]
          } }
        ]
      },
      {
        name: 'Work back to the most you can pay',
        body: [
          { formula: 'cost = price × (1 − margin ÷ 100)' },
          { p: 'When the market sets the price, the question turns round: what can you afford to pay? If similar items sell for £80 and you need a 35% margin, the most you can pay, all costs included, is £80 × 0.65 = £52. Any supplier quote above that either moves your price or eats your margin.' },
          { tool: '/business/profit-margin/', why: 'set “Solve for” to cost and it gives the highest cost that still leaves the margin you need', fill: 'solve=cost&price=80&margin=35', fillLabel: 'Open it with an £80 price and a 35% margin — it shows a £52 cost' }
        ]
      }
    ],
    wrong: [
      { name: 'Adding the margin percentage to the cost', text: 'Multiplying a £42 cost by 1.30 for a “30% margin” gives £54.60 and a 23.08% margin. To reach a margin, divide the cost by one minus the margin. The error is small on one item and large across a price list.' },
      { name: 'Two people meaning different things by “percentage”', text: 'A supplier who offers “50% on cost” is offering a 50% markup, which is a 33.33% margin. If you plan on a 50% margin from that, every sale falls short. Ask which one is meant whenever the word “margin” is not said out loud.' },
      { name: 'Working the margin on a price that includes tax', text: 'At 20% VAT a £120 shelf price is £100 to the business. Working the margin on £120 against a £60 cost gives 50%; the real margin is 40%. Take the tax out first, then calculate.' },
      { name: 'Leaving costs out of the cost', text: 'Inbound delivery, packaging, card or marketplace fees, and an allowance for returns all come out of the profit. A margin worked out on the supplier’s price alone overstates what you keep, sometimes by more than the margin itself.' },
      { name: 'Aiming for a margin of 100% or more', text: 'Margin is a share of the price, so 100% would mean the goods cost nothing. A target of 100% almost always means a 100% markup, which is a 50% margin.' }
    ],
    faq: [
      { q: 'What is the difference between margin and markup?', a: 'Both use the same profit. Margin divides it by the selling price; markup divides it by the cost. A £60 item sold for £100 has a 40% margin and a 66.67% markup.' },
      { q: 'How do I price for a 30% margin?', a: 'Divide the cost by 0.70. A £42 item needs a price of £60. Multiplying by 1.30 instead gives a 30% markup and only a 23.08% margin.' },
      { q: 'What markup gives a 50% margin?', a: 'A 100% markup: double the cost. An item costing £50 sold for £100 has £50 of profit, half the price.' },
      { q: 'Is this gross margin or net margin?', a: 'Gross: price less the cost of the item. Net margin also takes off rent, wages and every other overhead, and is worked out across the whole business rather than per item.' },
      { q: 'How do I calculate margin in Excel?', a: 'With the cost in A2 and the price in B2, =(B2-A2)/B2 for margin and =(B2-A2)/A2 for markup, both formatted as percentages.' }
    ],
    tools: ['/business/profit-margin/', '/business/discount-calculator/', '/business/break-even/', '/mathematics/percentage/'],
    collections: ['shopkeepers', 'online-sellers', 'small-business'],
    related: ['calculate-roi', 'calculate-gst', 'calculate-a-percentage']
  },

  /* ================================================================== */
  {
    slug: 'calculate-attendance-percentage',
    glyph: 'i-attendance',
    name: 'How to calculate attendance percentage',
    title: 'How to calculate attendance percentage — and how many classes you can miss, or must attend, to stay at 75%',
    description: 'Attendance as a percentage of classes held, how many classes in a row it takes to climb back to a minimum, how many you can still miss, and the counting rules that make two figures disagree.',
    answer: 'Attendance percentage = classes attended ÷ classes held × 100, so 42 out of 60 is 70%. To find how many classes in a row you must attend to reach 75%, solve (42 + x) ÷ (60 + x) = 0.75, which gives x = 12 — 54 out of 72.',
    minutes: { first: 'five minutes', again: 'seconds' },
    howLong: 'Seconds once you have the two counts. Getting the counts right — per subject, the way the register keeps them — is the part that decides whether the answer matches the one the office will use.',
    before: [
      'The number of classes held so far and the number you attended, from the official register or portal rather than your own memory.',
      'The minimum you must reach, and whether it applies to each subject or to the whole timetable.',
      'How many classes are still to come this term, if you want to know whether a shortfall can still be made up.'
    ],
    steps: [
      {
        name: 'Count the classes the way your institution does',
        body: [
          { p: 'Before any arithmetic, find out what is being counted. Some schools and colleges apply the minimum to each subject, some count a two-hour practical as two classes, and approved leave is handled in different ways. A figure worked out across the whole timetable can be comfortably above the line while one subject sits below it.' }
        ]
      },
      {
        name: 'Divide attended by held',
        body: [
          { formula: 'attendance % = classes attended ÷ classes held × 100' },
          { p: 'For 42 classes attended out of 60 held: 42 ÷ 60 = 0.7, so attendance is 70%. Do it for each subject that has its own requirement.' },
          { tool: '/education/attendance-calculator/', why: 'gives the attendance percentage, the classes you can still miss or must attend in a row, and whether the minimum is still reachable this term', fill: 'attended=42&held=60&required=75&remaining=30', fillLabel: 'Do it in the attendance calculator with 42 of 60 already in — it shows 70% and the 12 classes needed' }
        ]
      },
      {
        name: 'Work out how many classes you must attend to recover',
        body: [
          { formula: 'classes needed = (required × held − 100 × attended) ÷ (100 − required), rounded up' },
          { p: 'With 42 of 60 and a 75% minimum: (75 × 60 − 100 × 42) ÷ 25 = (4,500 − 4,200) ÷ 25 = 12. Attend the next 12 classes without a miss and you reach 54 of 72, exactly 75%. Every attended class adds one to both the top and the bottom of the fraction, which is why recovery is slow.' },
          { p: 'Then check it can still be done. With 30 classes left this term, it can, and attending all 30 would reach 80%. With only 10 left, it cannot: even a perfect run ends at 74.29%.' }
        ]
      },
      {
        name: 'Work out how many you can still miss',
        body: [
          { formula: 'classes you can miss = attended × 100 ÷ required − held, rounded down' },
          { p: 'With 52 of 64, attendance is 81.25%. Then 52 × 100 ÷ 75 = 69.33, and 69.33 − 64 = 5.33, rounded down to 5. Miss five more and you are at 52 of 69, 75.36%; miss a sixth and you are at 74.29%, below the line.' },
          { example: {
            caption: 'Illustrative attendance records, invented for this guide, against a 75% minimum. Every figure is what the Attendance Calculator’s own engine returns.',
            head: ['Record so far', 'Attendance', 'Against 75%', 'Best possible by the end'],
            rows: [
              ['42 of 60, 30 still to come', '70%', 'Short: attend 12 in a row', '80%'],
              ['42 of 60, 10 still to come', '70%', 'Not reachable: 12 needed, 10 left', '74.29%'],
              ['52 of 64, 26 still to come', '81.25%', 'Can miss 5', '86.67%'],
              ['36 of 48', '75%', 'Exactly on the line: can miss none', '—'],
              ['20 of 30, 50 still to come', '66.67%', 'Short: attend 10 in a row', '87.5%']
            ]
          } },
          { tool: '/education/attendance-calculator/', why: 'when you are above the minimum it shows how many classes you can still miss', fill: 'attended=52&held=64&required=75&remaining=26', fillLabel: 'Open it with 52 of 64 — it shows 81.25% and 5 classes to spare' }
        ]
      },
      {
        name: 'Check the rule that applies to you',
        body: [
          { p: 'The minimum and the way it is counted come from your board, university or college, and they differ. Find the rule in writing — the prospectus, the examination regulations or a circular — and keep a copy of any leave application you make.' },
          { fact: {
            text: 'For CBSE Class X and XII, Rules 13 and 14 of the CBSE Examination Bye-Laws require a minimum of 75% attendance for a student to be eligible to sit the Board examinations. The Board’s circular of 4 August 2025 repeats this for the 2025–26 session, says a relaxation of 25% is offered only in exigencies such as medical emergencies or taking part in national or international sports events, supported by documents, and says leave taken without a written application is treated as unauthorised absence. Colleges and universities set their own minimums in their own regulations.',
            checked: CHECKED,
            sources: [src('cbseAttendance', 'the 75% minimum, the 25% relaxation and written leave applications')]
          } }
        ]
      }
    ],
    wrong: [
      { name: 'Averaging the subjects’ percentages', text: '45 of 50 in one subject is 90% and 20 of 30 in another is 66.67%. Their average is 78.33%, and the combined figure, 65 of 80, is 81.25% — but if the rule is per subject, the second one is short whatever the overall figure says.' },
      { name: 'Planning to miss the exact number allowed', text: 'If the calculator says you can miss 5, missing 5 leaves no room for an illness, a late bus or a register error. Treat the figure as the edge, not the budget.' },
      { name: 'Assuming every missed class costs the same', text: 'Early in a term a single absence moves the percentage a lot — from 20 of 20 to 20 of 21 is a drop of nearly five points. Late in the term it moves it less, but there is also less term left to recover in.' },
      { name: 'Working from your own count', text: 'Your notes and the official register disagree more often than seems likely: a class marked absent by mistake, a lab counted twice, a cancelled lecture still recorded as held. Check the official figure early, while a mistake can still be corrected.' },
      { name: 'Assuming leave counts as attendance', text: 'Some institutions take approved leave out of the total, some count it as absence and grant a relaxation later, and some do neither. Ask which applies before relying on it, and apply for leave in writing at the time.' }
    ],
    faq: [
      { q: 'How do I calculate my attendance percentage?', a: 'Divide the classes you attended by the classes held and multiply by 100. 42 out of 60 is 70%.' },
      { q: 'How many classes can I miss and still have 75%?', a: 'Multiply the classes attended by 100, divide by 75, subtract the classes held, and round down. With 52 of 64 the answer is 5. It changes every time a class is held, so work it out again as the term goes on.' },
      { q: 'How many classes do I need to attend to get from 70% to 75%?', a: 'It depends on the counts, not the percentages. From 42 of 60 it is 12 in a row. From 36 of 60, which is 60%, it is 36 in a row.' },
      { q: 'Does medical leave count towards attendance?', a: 'That depends on the institution. CBSE offers a relaxation for documented medical emergencies; colleges set their own rules. Apply for leave in writing, with the documents, at the time.' },
      { q: 'Is the calculator’s figure the official one?', a: 'No. It does the arithmetic on the numbers you enter. The official figure is the one in your institution’s register, worked out by its own rules.' }
    ],
    tools: ['/education/attendance-calculator/', '/mathematics/percentage/', '/education/marks-percentage/', '/education/exam-countdown/'],
    collections: ['students', 'schools'],
    related: ['calculate-a-percentage', 'convert-cgpa-to-percentage', 'count-business-days']
  },

  /* ================================================================== */
  {
    slug: 'count-business-days',
    glyph: 'i-business-days',
    name: 'How to count business days between two dates',
    title: 'How to count business days between two dates — weekends, bank holidays, and whether the first day counts',
    description: 'Count the working days between two dates, add working days to a date to find a deadline, take out the right public holidays, and settle whether the first and last days count.',
    answer: 'Count the calendar days between the two dates, take out the Saturdays and Sundays, then take out any public holidays that fall on a weekday. From Tuesday 1 December 2026 up to Monday 4 January 2027 there are 34 days, 24 of them weekdays, and 21 working days once England and Wales’s Christmas Day, Boxing Day substitute on 28 December and New Year’s Day are removed.',
    minutes: { first: 'ten minutes', again: 'under a minute' },
    howLong: 'Under a minute once you have the holiday list. Deciding whether the first and last days count, and finding the holidays that apply to the people doing the work, are the two things worth getting right before you count anything.',
    before: [
      'The start date and the end date — or, for a deadline, the start date and the number of working days allowed.',
      'The public holidays that apply where the work is done, for every year the period touches.',
      'The wording you are counting against, if there is one: “within 10 business days of receipt” and “10 clear working days” are not the same instruction.'
    ],
    steps: [
      {
        name: 'Decide whether the first and last days count',
        body: [
          { p: 'There is no single convention, which is why disputes about deadlines are so common. The Business Days Calculator counts the start date and stops before the end date, the way “from 5 October until 30 October” is usually meant. Spreadsheet functions such as NETWORKDAYS count both ends. From Monday 5 October to Friday 30 October 2026 the calculator gives 19 business days; counting both ends gives 20.' },
          { p: 'If you need the end date included, move it on by one day: 5 October to 31 October gives 20.' },
          { tool: '/time/business-days/', why: 'counts business days between two dates or adds them to a date, leaving out weekends and any holidays you list', fill: 'start=2026-10-05&mode=between&end=2026-10-31', fillLabel: 'Open it with 5 to 31 October 2026 — it shows 20 business days' }
        ]
      },
      {
        name: 'Count the weekdays',
        body: [
          { p: 'Whole weeks are easy: every seven days hold five weekdays. Count the whole weeks, then walk the days left over. From 1 December 2026 there are 34 days to count before 4 January: four whole weeks, which hold 20 weekdays, and six days left over — Tuesday 29 December to Sunday 3 January — of which four are weekdays. That makes 24.' },
          { tool: '/time/business-days/', why: 'with the holiday box left empty it takes out weekends only', fill: 'start=2026-12-01&mode=between&end=2027-01-04', fillLabel: 'Do it in the calculator with these dates — it shows 24 weekdays before holidays' }
        ]
      },
      {
        name: 'Take out the public holidays',
        body: [
          { p: 'Only holidays that fall on a weekday change the count; one that falls on a Saturday or Sunday has already been removed with the weekend — unless a substitute day moves it onto a weekday. Holiday lists differ from country to country and often from region to region, so use the list for the place the work is done, not where the person counting sits.' },
          { fact: {
            text: 'In England and Wales the bank holidays left in 2026 are Christmas Day on Friday 25 December and Boxing Day, observed on Monday 28 December because 26 December falls on a Saturday. New Year’s Day 2027 is on Friday 1 January. When a bank holiday falls at a weekend, a substitute weekday, normally the following Monday, becomes the bank holiday. Scotland and Northern Ireland have bank holidays of their own, published on the same page.',
            checked: CHECKED,
            sources: [src('ukBankHolidays', 'the 2026 and 2027 dates for England and Wales, and the substitute-day rule')]
          } },
          { p: 'Type the holidays into the calculator as dates, separated by commas: 2026-12-25, 2026-12-28, 2027-01-01. All three fall on weekdays inside the period, so 24 weekdays become 21 working days.' },
          { tool: '/time/business-days/', why: 'holidays typed as YYYY-MM-DD and separated by commas are taken out of the count when they fall on a weekday', fill: 'start=2026-12-01&mode=between&end=2027-01-04&holidays=2026-12-25,2026-12-28,2027-01-01', fillLabel: 'Open it with the three holidays added — it shows 21 business days' }
        ]
      },
      {
        name: 'Add working days to a date to find a deadline',
        body: [
          { p: 'For “within 10 working days”, count forwards instead. The start date itself is not counted: day one is the next working day. From Friday 18 December 2026, ten weekdays later is Friday 1 January 2027. Take out England and Wales’s three holidays and the tenth working day becomes Wednesday 6 January 2027 — five days later than a count that ignored them.' },
          { example: {
            caption: 'Illustrative date ranges, invented for this guide. Every answer is what the Business Days Calculator’s own engine returns for them.',
            head: ['Question', 'Calendar days', 'Answer'],
            rows: [
              ['5 Oct 2026 up to 30 Oct 2026', '25', '19 business days'],
              ['1 Dec 2026 up to 4 Jan 2027, weekends only', '34', '24 business days'],
              ['The same, England and Wales bank holidays out', '34', '21 business days'],
              ['10 working days after Fri 18 Dec 2026, weekends only', '14', 'Friday 1 January 2027'],
              ['The same, England and Wales bank holidays out', '19', 'Wednesday 6 January 2027']
            ]
          } },
          { tool: '/time/business-days/', why: 'set the mode to adding business days and it returns the date, skipping weekends and the holidays you list', fill: 'start=2026-12-18&mode=add&add=10&holidays=2026-12-25,2026-12-28,2027-01-01', fillLabel: 'Open it with 10 working days from 18 December — it shows Wednesday 6 January 2027' }
        ]
      },
      {
        name: 'Check the answer against the wording',
        body: [
          { p: 'Read the clause once more with the date in hand. “Within 10 business days of receipt” usually starts the count the day after receipt; “by the end of the tenth business day” sets a time as well as a date; some rules count “clear days”, which leaves out both the first and the last. Where money or a legal right depends on it, follow the wording, and if it is ambiguous, ask in writing before the deadline rather than after it.' }
        ]
      }
    ],
    wrong: [
      { name: 'Counting both ends without noticing', text: 'NETWORKDAYS in a spreadsheet counts the start and the end; this calculator counts the start and not the end. From 1 December 2026 to 4 January 2027 that is 25 against 24. Neither is wrong, but mixing the two in one schedule moves every deadline by a day.' },
      { name: 'Using another region’s holiday list', text: 'Scotland and Northern Ireland have bank holidays that England and Wales do not, and in India holidays vary from state to state. A deadline worked out with the wrong list can be a day or two out in either direction.' },
      { name: 'Missing a substitute day', text: 'Boxing Day 2026 is a Saturday, so the bank holiday moves to Monday 28 December. A list that says “26 December” takes nothing out, because that day was already a weekend, and the real day off is counted as a working day.' },
      { name: 'Assuming everyone works Monday to Friday', text: 'Shops, hospitals and offices that work Saturdays have a different working week. The calculator treats Saturday and Sunday as the weekend; for any other pattern, count by hand or adjust the result.' },
      { name: 'Counting the day of receipt as day one', text: 'When adding business days, the start date is usually day zero. Counting it as day one makes every deadline a day early — the safe direction, but a day of your own time lost each time.' }
    ],
    faq: [
      { q: 'How many working days are there between two dates?', a: 'Count the days, take out the weekends, then take out weekday public holidays. From 1 December 2026 up to 4 January 2027 there are 24 weekdays, and 21 working days in England and Wales.' },
      { q: 'How do I count business days in Excel?', a: '=NETWORKDAYS(start, end, holidays) counts working days including both ends; NETWORKDAYS.INTL lets you choose which days are the weekend. =WORKDAY(start, days, holidays) adds working days to a date: WORKDAY on 18 December 2026 with 10 days and the three holidays returns 6 January 2027.' },
      { q: 'Does the start date count as a business day?', a: 'When counting between two dates, this calculator includes it. When adding business days to a date, it does not: day one is the next working day. Contracts vary, so check the wording.' },
      { q: 'Are bank holidays business days?', a: 'Normally not. Banks and most offices are closed, which is why payment and notice deadlines usually step over them. Check whether your contract defines a business day for itself.' },
      { q: 'Is Saturday a business day?', a: 'Not in this calculator, or in most contracts that use the phrase. Where Saturday is a working day, the contract usually says so.' }
    ],
    tools: ['/time/business-days/', '/time/date-difference/', '/time/date-add-subtract/', '/business/invoice-payment-terms/'],
    collections: ['hr-payroll', 'get-paid'],
    related: ['calculate-age', 'calculate-attendance-percentage', 'chase-unpaid-invoices']
  },

  /* ================================================================== */
  {
    slug: 'convert-inches-to-centimetres',
    glyph: 'i-length',
    name: 'How to convert inches to centimetres',
    title: 'How to convert inches to centimetres — multiply by 2.54, with feet and inches, fractions and screen sizes',
    description: 'Inches to centimetres with the exact factor, heights in feet and inches, fractions from a tape measure, screen sizes that are measured corner to corner, and centimetres back to inches.',
    answer: 'To convert inches to centimetres, multiply by 2.54: 12 inches is 12 × 2.54 = 30.48 cm. The factor is exact rather than rounded — an inch has been defined as exactly 2.54 centimetres since 1959 — so the only rounding is whatever you choose for the answer.',
    minutes: { first: 'two minutes', again: 'seconds' },
    howLong: 'Seconds. The only thing that takes thought is the input: turning feet and inches, or a fraction off a tape measure, into a single number of inches before you multiply.',
    before: [
      'The measurement in inches — or in feet and inches, or with a fraction such as 3/8.',
      'An idea of how precise the answer needs to be: a height, a parcel and a machined part need different rounding.'
    ],
    steps: [
      {
        name: 'Multiply by 2.54',
        body: [
          { formula: 'centimetres = inches × 2.54' },
          { p: '12 inches is 30.48 cm. A 55-inch television is 55 × 2.54 = 139.7 cm. A 15.6-inch laptop screen is 39.624 cm, which most people would call 39.6 cm. Because centimetres are the smaller unit, the number always gets bigger — about two and a half times bigger.' },
          { tool: '/conversions/length/inch-to-centimeter/', why: 'converts inches to centimetres with the exact factor, and shows the same length in every other unit underneath', fill: 'v=12', fillLabel: 'Do it in the converter with 12 inches — it shows 30.48 cm' },
          { fact: {
            text: 'The inch is exactly 2.54 centimetres (25.4 millimetres). The figure follows from the 1959 change to the yard, which the US has since defined as exactly 0.9144 metre; NIST notes that after 1959 the US and British inches were defined identically. UK law defines the yard as 0.9144 metre and the inch as 1/36 of a yard, which is the same 2.54 cm, and NIST lists the inch-to-centimetre factor of 2.54 as exact rather than rounded.',
            checked: CHECKED,
            sources: [src('nistHb44', 'the 1959 definition of the yard, and identical US and British inches after it'), src('nistSp811', 'inch to centimetre, 2.54, marked as exact'), src('ukWma1985', 'the yard as 0.9144 metre and the inch as 1/36 yard')]
          } }
        ]
      },
      {
        name: 'Convert feet and inches together',
        body: [
          { formula: 'total inches = feet × 12 + inches' },
          { p: 'Turn the whole measurement into inches first, then multiply. A height of 5 ft 9 in is 5 × 12 + 9 = 69 inches, and 69 × 2.54 = 175.26 cm. Six feet is 72 inches, or 182.88 cm. Converting the feet and the inches separately and adding the two works too, as long as neither part is left out.' },
          { tool: '/conversions/length/inch-to-centimeter/', why: 'enter the total in inches and read the centimetres', fill: 'v=69', fillLabel: 'Open it with 69 inches (5 ft 9 in) — it shows 175.26 cm' }
        ]
      },
      {
        name: 'Turn fractions of an inch into decimals first',
        body: [
          { p: 'Tape measures and drill bits work in halves, quarters, eighths and sixteenths. Divide the top by the bottom to get a decimal, then multiply: 3/8 inch is 0.375 inch, and 0.375 × 2.54 = 0.9525 cm, or 9.525 mm. For a measurement such as 4 3/8 inches, add the whole number back on: 4.375 × 2.54 = 11.1125 cm.' },
          { p: 'At this scale millimetres are usually the more useful answer. Multiply inches by 25.4 to get them directly.' }
        ]
      },
      {
        name: 'Round to suit the job',
        body: [
          { example: {
            caption: 'Illustrative measurements, invented for this guide. Each centimetre figure is what the converter’s own engine returns.',
            head: ['Inches', 'Centimetres'],
            rows: [
              ['1 in', '2.54 cm'],
              ['6.5 in (a phone screen)', '16.51 cm'],
              ['8.5 × 11 in (a US Letter page)', '21.59 × 27.94 cm'],
              ['12 in (one foot)', '30.48 cm'],
              ['15.6 in (a laptop screen)', '39.624 cm'],
              ['24 in', '60.96 cm'],
              ['55 in (a television)', '139.7 cm'],
              ['69 in (5 ft 9 in)', '175.26 cm']
            ]
          } },
          { p: 'Round at the end, and only as far as the job needs: a height to the nearest centimetre, a parcel to the nearest half centimetre, a part for a machine to a tenth of a millimetre. Screen sizes are measured diagonally, from one corner to the opposite one, so 139.7 cm is not the width of a 55-inch television; on a 16:9 screen the width is about 121.8 cm.' }
        ]
      },
      {
        name: 'Going the other way: centimetres to inches',
        body: [
          { formula: 'inches = centimetres ÷ 2.54' },
          { p: 'Divide by 2.54: 30 cm is 11.811 inches, a little under a foot. A height of 175 cm is 68.9 inches; take away 60 inches for five feet and it is 5 ft 8.9 in. One centimetre is about 0.3937 inch.' },
          { tool: '/conversions/length/centimeter-to-inch/', why: 'converts centimetres back to inches with the same exact factor' }
        ]
      }
    ],
    wrong: [
      { name: 'Dividing when you should multiply', text: '12 ÷ 2.54 is 4.72, which is the number of inches in 12 centimetres, not the other way round. Going from inches to centimetres, the number must get bigger.' },
      { name: 'Reading 5 ft 9 in as 5.9 feet', text: '5 ft 9 in is 5.75 feet, not 5.9. Treating it as 5.9 gives 70.8 inches and 179.83 cm, more than four centimetres too tall. Convert the feet to inches and add the inches.' },
      { name: 'Rounding the factor to 2.5', text: 'It is fine for a rough idea and poor for anything else: 55 inches comes out at 137.5 cm instead of 139.7, 2.2 cm short. The exact factor is no harder to type.' },
      { name: 'Treating a screen size as a width', text: 'Televisions, monitors and phones are sold by their diagonal. A 55-inch television will not fit a 140 cm gap only because its diagonal is 139.7 cm; its width, stand and bezel are what matter.' },
      { name: 'Rounding the inches before converting', text: 'Calling a 15.6-inch screen “16 inches” before multiplying adds just over a centimetre to the answer. Convert the measurement you have, then round the result.' }
    ],
    faq: [
      { q: 'How many centimetres are in an inch?', a: 'Exactly 2.54. The figure is a definition, not a measurement, so it does not change and has no further decimal places.' },
      { q: 'How do I convert inches to cm in my head?', a: 'Multiply by 2.5, then add a little over 1.5%. For 55 inches: 55 × 2.5 = 137.5, and 1.6% of that is 2.2, giving 139.7.' },
      { q: 'How many cm is 5 feet 9 inches?', a: '175.26 cm. Five feet nine is 69 inches, and 69 × 2.54 = 175.26.' },
      { q: 'Is an inch the same in the UK and the US?', a: 'Yes. Since 1959 both have used the same inch, exactly 2.54 cm.' },
      { q: 'How do I convert inches to millimetres?', a: 'Multiply by 25.4. 12 inches is 304.8 mm.' }
    ],
    tools: ['/conversions/length/inch-to-centimeter/', '/conversions/length/centimeter-to-inch/', '/conversions/length/inch-to-millimeter/', '/conversions/length/foot-to-centimeter/'],
    related: ['convert-kg-to-pounds', 'calculate-bmi', 'calculate-a-percentage']
  },

  /* ================================================================== */
  {
    slug: 'convert-kg-to-pounds',
    glyph: 'i-mass',
    name: 'How to convert kg to pounds',
    title: 'How to convert kg to pounds — the exact factor, stones and pounds, and a quick way to do it in your head',
    description: 'Kilograms to pounds with the exact definition behind the factor, a mental shortcut that is close enough for most things, stones and pounds for UK body weight, and pounds back to kilograms.',
    answer: 'To convert kilograms to pounds, multiply by 2.20462, or divide by 0.45359237 — the exact number of kilograms in a pound: 70 kg is 154.32 lb. For a quick estimate, double the kilograms and add 10%: 70 × 2 = 140, plus 14, is 154.',
    minutes: { first: 'two minutes', again: 'seconds' },
    howLong: 'Seconds. The only judgement is how precise the answer needs to be — a suitcase, a recipe and a dose are different jobs.',
    before: [
      'The weight in kilograms, or in grams divided by 1,000.',
      'For UK body weight, whether the answer is wanted in pounds or in stones and pounds.'
    ],
    steps: [
      {
        name: 'Multiply by 2.20462',
        body: [
          { formula: 'pounds = kilograms × 2.20462' },
          { formula: 'pounds = kilograms ÷ 0.45359237 (exact)' },
          { p: 'The pound is defined in kilograms, so the exact way is to divide by 0.45359237. Multiplying by 2.20462 gives the same answer to five decimal places, which is far more than any bathroom scale can show. 70 kg is 154.3236 lb, which for most purposes is 154.3 lb.' },
          { tool: '/conversions/mass/kilogram-to-pound/', why: 'converts kilograms to pounds with the exact definition, and lists the same weight in stones, ounces and every other mass unit', fill: 'v=70', fillLabel: 'Do it in the converter with 70 kg — it shows 154.3236 lb' },
          { fact: {
            text: 'The international avoirdupois pound — the pound used for body weight, food and luggage — is exactly 0.453 592 37 kilogram. NIST notes that after the 1959 agreement the US and British pounds were the same, and gives that definition; UK law states the same figure and defines the stone as 14 pounds and the ounce as 1/16 pound. The kilogram itself has been defined since the 2018 revision of the SI by fixing the numerical value of the Planck constant, so the pound is tied to a constant of nature through it.',
            checked: CHECKED,
            sources: [src('ukWma1985', 'the pound as 0.453 592 37 kilogram, the stone and the ounce'), src('nistHb44', 'the avoirdupois pound defined in terms of the kilogram, and the 1959 agreement'), src('bipmKg', 'the kilogram defined by the Planck constant')]
          } }
        ]
      },
      {
        name: 'Use the quick method when an estimate will do',
        body: [
          { p: 'Double the kilograms, then add a tenth of that. For a 23 kg suitcase: 23 × 2 = 46, plus 4.6, is 50.6 lb. The exact answer is 50.71 lb, so the shortcut is about 0.2% low — close enough for a suitcase, a parcel or a conversation.' },
          { p: 'It works because 2 × 1.1 = 2.2, which is just under the real factor of 2.20462.' }
        ]
      },
      {
        name: 'Turn pounds into stones and pounds',
        body: [
          { p: 'In the UK, body weight is often given in stones and pounds. A stone is 14 pounds. Convert to pounds, divide by 14 for the whole stones, and the remainder is the pounds. 82 kg is 180.78 lb; 14 goes into 180 twelve times, which is 168 lb, leaving 12.78 lb. So 82 kg is 12 st 12.8 lb.' },
          { p: '70 kg is 154.32 lb, which is 11 stone exactly (154 lb) and 0.32 lb more: 11 st 0.3 lb.' },
          { tool: '/conversions/mass/kilogram-to-pound/', why: 'the list under the answer includes stones, as a decimal', fill: 'v=82', fillLabel: 'Open it with 82 kg — it shows 180.7791 lb and 12.9128 st' }
        ]
      },
      {
        name: 'Round to suit what you are weighing',
        body: [
          { example: {
            caption: 'Illustrative weights, invented for this guide. Each pound figure is what the converter’s own engine returns, rounded to two decimal places.',
            head: ['Kilograms', 'Pounds'],
            rows: [
              ['0.5 kg', '1.10 lb'],
              ['3.5 kg', '7.72 lb'],
              ['7 kg (a cabin bag)', '15.43 lb'],
              ['20 kg', '44.09 lb'],
              ['23 kg (a checked bag)', '50.71 lb'],
              ['70 kg', '154.32 lb'],
              ['100 kg', '220.46 lb']
            ]
          } },
          { p: 'When a limit is set in one unit, convert the limit and compare in that unit. A 23 kg bag weighs 50.71 lb, so it is over a 50 lb limit; 50 lb is 22.68 kg. The two figures are often printed side by side as if they were the same, and they are not quite.' }
        ]
      },
      {
        name: 'Going the other way: pounds to kilograms',
        body: [
          { formula: 'kilograms = pounds × 0.45359237' },
          { p: 'Multiply by the exact definition: 154 lb is 69.85 kg, and 50 lb is 22.68 kg. The rough version is to halve the pounds and take off a tenth: 154 ÷ 2 = 77, less 7.7, is 69.3 — less than 1% out.' },
          { tool: '/conversions/mass/pound-to-kilogram/', why: 'converts pounds to kilograms with the same exact definition' }
        ]
      }
    ],
    wrong: [
      { name: 'Dividing by 2.2 when you meant to multiply', text: '70 ÷ 2.2 is 31.8, which is 70 pounds in kilograms. A pound is lighter than a kilogram, so going from kilograms to pounds the number must get bigger.' },
      { name: 'Reading 11.5 stone as 11 stone 5 pounds', text: 'A stone has 14 pounds, not 10, so 11.5 stone is 11 st 7 lb. The decimal part has to be multiplied by 14 before it means pounds.' },
      { name: 'Treating 23 kg and 50 lb as the same limit', text: '23 kg is 50.71 lb. A bag weighed at exactly 23 kg is over a 50 lb limit, and one at 22.7 kg is under it. Convert the limit, not the bag, and compare in the limit’s own unit.' },
      { name: 'Rounding the factor to 2', text: 'Doubling alone undershoots by about 9%: 100 kg becomes 200 lb instead of 220.46. Add the extra tenth, or use the exact factor.' },
      { name: 'Using the wrong kind of pound or ounce', text: 'Gold and silver are priced by the troy ounce, which is heavier than the ordinary ounce; the UK abolished the troy pound in 1879. The converter’s pound and ounce are the avoirdupois units used for everything else.' }
    ],
    faq: [
      { q: 'How many pounds are in a kilogram?', a: 'About 2.20462. More precisely 2.2046226218, the result of dividing 1 by 0.45359237.' },
      { q: 'How many kilograms are in a pound?', a: 'Exactly 0.45359237. It is the definition of the pound, so it has no further decimal places.' },
      { q: 'What is 70 kg in stones and pounds?', a: '11 st 0.3 lb. 70 kg is 154.32 lb, and 11 stone is 154 lb.' },
      { q: 'Is a pound the same in the UK and the US?', a: 'Yes. Both use the international avoirdupois pound of exactly 0.45359237 kg.' },
      { q: 'Why do converters give 154.3 or 154.32 for 70 kg?', a: 'Only because of rounding. The exact value is 154.32358…; how many decimals are shown is a choice, not a different answer.' }
    ],
    tools: ['/conversions/mass/kilogram-to-pound/', '/conversions/mass/pound-to-kilogram/', '/conversions/mass/kilogram-to-stone/', '/health/bmi/'],
    collections: ['online-sellers'],
    related: ['convert-inches-to-centimetres', 'calculate-bmi']
  },

  /* ================================================================== */
  {
    slug: 'convert-csv-to-json',
    glyph: 'i-csv-to-json',
    name: 'How to convert CSV to JSON',
    title: 'How to convert CSV to JSON — headers as keys, quoted commas, delimiters, and the types CSV does not carry',
    description: 'Turn a CSV file into a JSON array of objects, keep quoted fields with commas in them intact, pick the right delimiter, and deal with the fact that every value comes out as a string.',
    answer: 'To convert CSV to JSON, use the first row as the keys and turn every following row into an object, giving an array of objects: under the header invoice,customer,city,total the row INV-0101,Asha Traders,Pune,29500 becomes {"invoice": "INV-0101", "customer": "Asha Traders", "city": "Pune", "total": "29500"}. The CSV to JSON Converter does this in your browser, including quoted fields that contain commas.',
    minutes: { first: 'five minutes', again: 'seconds' },
    howLong: 'Seconds for a clean file. A file that came out of a spreadsheet in another country, or was typed by hand, can take longer — almost always because of the delimiter or an unquoted comma, both of which are quick to spot once you know to look.',
    before: [
      'The CSV, opened in a plain text editor rather than a spreadsheet, so you can see the real delimiters and quote marks.',
      'A header row. If the file has none, add one: the converter uses the first row as the keys.',
      'An idea of which columns should end up as numbers, dates or true and false — the converter will not decide that for you.'
    ],
    steps: [
      {
        name: 'Check the header row and the delimiter',
        body: [
          { p: 'Look at the first two lines. The first should name the columns; the character between the names is the delimiter. Most files use commas, but spreadsheets set up for countries that write decimals with a comma usually export with semicolons, and some systems use tabs or a vertical bar.' },
          { fact: {
            text: 'CSV is described by RFC 4180, an informational RFC that acknowledges implementations differ. Its rules are the common ground: each record on its own line; an optional header line in the same format as the records; fields containing a comma, a double quote or a line break enclosed in double quotes; a double quote inside such a field written as two double quotes; and spaces counted as part of the field. JSON is defined separately, by RFC 8259.',
            checked: CHECKED,
            sources: [src('rfc4180', 'the header line, quoting, doubled quotes and spaces in fields'), src('rfc8259', 'the JSON the conversion produces')]
          } }
        ]
      },
      {
        name: 'Paste it in and convert',
        body: [
          { p: 'This invented invoice list has a header, a customer name with a comma in it — quoted, as it should be — and an empty cell at the end of the last row:' },
          { formula: CSV_LINES[0] },
          { formula: CSV_LINES[1] },
          { formula: CSV_LINES[2] },
          { formula: CSV_LINES[3] },
          { p: 'With the direction set to CSV to JSON and the delimiter to comma, the converter reports 4 columns and 3 data rows, and the JSON comes to 246 bytes before it is indented for reading.' },
          { tool: '/developer/csv-to-json/', why: 'converts CSV or TSV to JSON and back in the browser, handling quoted fields, embedded commas and four delimiters', fill: textFill(CSV_INVOICES), fillLabel: 'Open the converter with this CSV already pasted in' }
        ]
      },
      {
        name: 'See what happened to each row',
        body: [
          { example: {
            caption: 'An invented invoice list, made up for this guide. The right-hand column is what the converter’s own engine produces from each row.',
            head: ['CSV row', 'JSON object'],
            rows: [
              [CSV_LINES[1], '{"invoice": "INV-0101", "customer": "Asha Traders", "city": "Pune", "total": "29500"}'],
              [CSV_LINES[2], '{"invoice": "INV-0102", "customer": "Khan, Patel & Co", "city": "Leeds", "total": "1180.50"}'],
              [CSV_LINES[3], '{"invoice": "INV-0103", "customer": "Riverside Café", "city": "Bristol", "total": ""}']
            ]
          } },
          { p: 'The quoted name kept its comma and lost its quote marks, which were only there to protect the comma. The empty cell became an empty string. And every value is in quotes — including 29500 and 1180.50.' }
        ]
      },
      {
        name: 'Turn the strings into the types you need',
        body: [
          { p: 'CSV has no types: it cannot say whether 29500 is a number or a code that happens to be made of digits. So the converter keeps every value as a string, which is the safe choice — a PIN code of 007 or a phone number starting with 0 survives intact. Where a column really is a number, convert it in the program that reads the JSON, and decide there what an empty string should become: zero, null, or an error.' },
          { p: 'Keep the trailing zero in mind. "1180.50" as a string still has it; the number 1180.5 does not. For money, that is a formatting question rather than a change of value, but it matters if the figure is later compared as text.' }
        ]
      },
      {
        name: 'If the columns come out wrong, check the delimiter and the quotes',
        body: [
          { p: 'A semicolon file read with the delimiter set to comma comes out as a single key holding the whole header line. Switch the delimiter to semicolon and convert again. An unquoted comma inside a value is harder to spot: the row splits into one field too many, the values shift one column to the right, and the last one is dropped. The fix is in the source — put quotes round the value — not in the JSON.' },
          { p: 'The same tool runs the other way. Set the direction to JSON to CSV and an array of objects becomes a CSV, with a column for every key that appears in any of the objects.' }
        ]
      }
    ],
    wrong: [
      { name: 'A semicolon file read as commas', text: 'Each line becomes one long value under one long key. Worse, a decimal comma such as 29500,00 is split at the comma, and the 00 is dropped without an error. Set the delimiter to match the file before converting.' },
      { name: 'An unquoted comma inside a name', text: 'INV-0102,Khan, Patel & Co,Leeds,1180.50 has five fields under a four-column header. The converter gives customer “Khan”, city “ Patel & Co” and total “Leeds”, and the 1180.50 disappears. Quote any value that contains the delimiter.' },
      { name: 'Expecting numbers and true or false', text: 'Every value arrives as a string, because CSV carries no types. Code that adds up the “total” field will join strings together instead of adding numbers unless it converts them first.' },
      { name: 'Two columns with the same name', text: 'An object cannot hold the same key twice, so when a header has two columns called “name”, only the second survives in the JSON. Rename one before converting.' },
      { name: 'Opening and saving the file in a spreadsheet first', text: 'Spreadsheets can strip leading zeros, turn long numbers into scientific notation and rewrite dates in their own format. If the CSV came from a system, paste it as it is rather than round-tripping it through a spreadsheet.' }
    ],
    faq: [
      { q: 'Does the CSV need a header row?', a: 'Yes. The first row becomes the keys. If a header cell is empty, the converter names that column column1, column2 and so on by its position.' },
      { q: 'Can I convert JSON back to CSV?', a: 'Yes. Set the direction to JSON to CSV. The JSON must be an array of objects; every key that appears in any object becomes a column, so rows with missing fields still line up.' },
      { q: 'Why are my numbers in quotes?', a: 'Because CSV does not say which values are numbers. Keeping them as strings protects codes with leading zeros; convert the real numbers in the program that reads the JSON.' },
      { q: 'Is my data uploaded?', a: 'No. The conversion runs inside the page on your own device, and the text never leaves it — which matters for customer lists and exports with personal details in them.' },
      { q: 'What does TSV mean?', a: 'Tab-separated values: the same idea as CSV with a tab between fields. Choose Tab as the delimiter.' }
    ],
    tools: ['/developer/csv-to-json/', '/developer/json-formatter/', '/developer/xml-formatter/'],
    collections: ['developers'],
    related: ['format-json']
  },

  /* ================================================================== */
  {
    slug: 'split-a-pdf',
    glyph: 'i-split-pdf',
    name: 'How to split a PDF',
    title: 'How to split a PDF — one file per page, every few pages, in half or by your own ranges',
    description: 'Divide one PDF into several files: choosing between one file per page, every N pages, halves and explicit ranges, writing ranges the splitter understands, and knowing what does and does not travel with the pages.',
    answer: 'To split a PDF, open it in a splitter, choose how to divide it — one file per page, every N pages, in half, or by page ranges such as “1-2 | 3-7 | 8-” — and download the pieces. In the Split PDF tool the file is read and divided in your browser, nothing is uploaded, and several output files come as one ZIP.',
    minutes: { first: 'five minutes', again: 'a minute' },
    howLong: 'A minute for most files. The time worth spending is before you split — working out which pages belong together — and after, opening each piece to check it starts and ends where you meant.',
    before: [
      'The PDF to split, saved on the device you are using.',
      'A plan of which pages go into which file. For a scanned batch this may be “one page each”; for a report, the page where each section starts.',
      'The page positions in the file, not the numbers printed on the pages. They often differ.'
    ],
    steps: [
      {
        name: 'Find the page positions before you start',
        body: [
          { p: 'Open the PDF and note where each piece should begin and end. The splitter counts pages by their position in the file — the first page is 1 — and ignores the numbers printed on them. A report with an unnumbered cover and contents page has its printed page 1 at position 3, and splitting at “1” would take the cover.' }
        ]
      },
      {
        name: 'Choose how to split',
        body: [
          { ul: [
            'One file per page — for a scanned pile where every page is a separate document.',
            'Every N pages — for a batch of forms that are each the same length, such as two-page timesheets.',
            'In half — two files; if the page count is odd, the first half takes the extra page.',
            'By explicit ranges — for anything else: you say which pages go into each file.'
          ] },
          { example: {
            caption: 'An invented 10-page file called statement.pdf, made up for this guide. The file names and page counts are what the Split PDF engine produces for it.',
            head: ['Split', 'Setting', 'Files produced'],
            rows: [
              ['One file per page', '—', '10 files: statement-p1.pdf to statement-p10.pdf'],
              ['Every N pages', '3 pages per file', '4 files: p1-3, p4-6, p7-9 and p10, which has one page'],
              ['In half', '—', '2 files: p1-5 and p6-10'],
              ['By explicit ranges', '1-2 | 3-7 | 8-', '3 files: p1-2, p3-7 and p8-10']
            ]
          } },
          { tool: '/pdf/split-pdf/', why: 'splits one PDF by page, by count, in half or by ranges in your browser, and offers several files as one ZIP; nothing is uploaded' }
        ]
      },
      {
        name: 'Write ranges the way the splitter reads them',
        body: [
          { ul: [
            'A vertical bar starts a new file: “1-2 | 3-7 | 8-” makes three files.',
            'A comma joins pages into the same file: “1-2, 4” makes one file of three pages.',
            '“8-” runs from page 8 to the end, and “-3” takes the first three pages.',
            'A page can go into more than one file: “1-2 | 2-4” puts page 2 in both.',
            'Pages go into a file in the order you type them, so “5, 1” puts page 5 first.'
          ] },
          { p: 'A range that runs past the end is trimmed to the last page, so “9-14” on a 10-page file takes pages 9 and 10. A group with no page of the document in it halts the split with a message saying so, and a typing slip such as a word instead of a number is named in the error, so nothing is produced half-right.' }
        ]
      },
      {
        name: 'Download the pieces and check them',
        body: [
          { p: 'A split that produces one file downloads it directly; several files come as a single ZIP. The summary shows the pages in the source, the number of files produced and their total size. The real example on the tool page, captured from the live tool, split a 3-page report.pdf of 6.3 KB into 3 files totalling 6.9 KB.' },
          { p: 'That small increase is normal. Each piece has to carry its own copy of the fonts and images its pages use, so the pieces together are usually a little larger than the original. The pages themselves are copied as they are, not re-encoded, so nothing is lost in quality. Open each file and check its first and last page before sending it anywhere.' }
        ]
      },
      {
        name: 'Know what does not travel with the pages',
        body: [
          { p: 'Splitting builds each new file from the pages alone. The original’s bookmarks do not come across, and nor does its document information — the title and author fields — which is usually what you want for a piece that is going to someone else. Complete and save any form before splitting, because form fields may not keep working once the pages are separated.' },
          { p: 'If you only need a few pages as one file, a single range such as “3-5” does it, and so does Extract PDF Pages. To put pieces back together, or to combine pages from several files, use Merge PDF.' },
          { tool: '/pdf/extract-pdf-pages/', why: 'takes the pages you name out into one new file, when one file is all you need' }
        ]
      }
    ],
    wrong: [
      { name: 'Using the printed page numbers', text: 'The splitter counts positions in the file. If the printed numbering starts on the third page, every range typed from the printed numbers is two pages out. Check the first page of each piece.' },
      { name: 'Commas where you meant bars', text: '“1-2, 3-7” is one file of seven pages, not two files. A comma joins pages into the same file; only the vertical bar starts a new one.' },
      { name: 'Trusting the file name to list the pages', text: 'The name shows the first and last page of each piece. A file made from “1, 3, 5” is called statement-p1-5.pdf but holds three pages, not five. Open it before assuming what is inside.' },
      { name: 'One file per page on a very long document', text: 'A 300-page file split page by page gives 300 files in a ZIP, which is rarely what anyone wants to receive. Above 500 files the tool refuses and asks you to narrow the split. Every N pages, or explicit ranges, usually fits the job better.' },
      { name: 'Expecting bookmarks and the title to follow', text: 'Each piece is a new document built from its pages. Bookmarks and the original title and author are not carried over, so a piece sent on its own will not open with the original’s navigation.' }
    ],
    faq: [
      { q: 'Is my PDF uploaded?', a: 'No. The file is read and divided by your own browser, and the pieces are written there. Nothing is sent anywhere, which matters for statements, contracts and identity documents.' },
      { q: 'Does splitting reduce quality?', a: 'No. Page content and images are copied as they are, without being re-encoded or recompressed.' },
      { q: 'How do I take out just a few pages as one file?', a: 'Use explicit ranges with a single group, such as “3-5”, or the Extract PDF Pages tool. Either gives one file holding only those pages.' },
      { q: 'Why are the pieces bigger in total than the original?', a: 'Fonts and images shared between pages have to be included in every piece that uses them. The original held them once; the pieces hold them once each.' },
      { q: 'How do I put the pieces back together?', a: 'Use Merge PDF: add the files in order and download one combined file.' }
    ],
    tools: ['/pdf/split-pdf/', '/pdf/extract-pdf-pages/', '/pdf/delete-pdf-pages/', '/pdf/merge-pdf/', '/pdf/rotate-pdf/'],
    collections: ['going-paperless'],
    related: ['merge-pdf-files', 'convert-jpg-to-pdf', 'compress-an-image']
  }
];

module.exports = { GUIDES, AUTHORITIES, SRC, CHECKED };
