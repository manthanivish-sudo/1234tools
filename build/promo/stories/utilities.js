'use strict';
/* Story data for the Utilities section (/utilities/). Contract: kit2-schema.md §1–2.
   Everyday browser calculators: free, no sign-up, nothing uploaded. Each example
   is a `calc` spec with real engine keys; prices stay in the visitor's currency. */

const PROOF = ['Free', 'No sign-up', 'Runs in your browser'];

module.exports = {
  '/utilities/fuel-efficiency/': {
    persona: 'Drivers planning a trip',
    hook: 'A 400-mile road trip. What will the fuel cost?',
    pain: 'Splitting fuel for a trip, and the car shows MPG while the pump shows a price per litre.',
    usual: ['Mixing up US and UK gallons', 'Unit conversions on a napkin', 'Guessing, then settling up later'],
    promise: 'Enter efficiency, distance and fuel price. Get the trip cost.',
    steps: ['Enter your car’s efficiency', 'Add distance and fuel price', 'Read the trip cost'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { efficiency: 45, unit: 'mpguk', distance: 400, distUnit: 'mi', price: 1.45, priceUnit: 'l' } },
    howTo: 'How to work out fuel cost for a road trip',
    cta: 'Cost my trip'
  },

  '/utilities/tip-calculator/': {
    persona: 'Anyone splitting a bill',
    hook: 'A 146.40 bill, six friends, a 12.5% tip. Who pays what?',
    pain: 'The bill arrives, everyone looks at you, and the maths has to work with the tip and rounding.',
    usual: ['A phone calculator passed round', 'Someone always pays too much', 'Forgetting service was already added'],
    promise: 'Enter the bill, tip and how many. See what each person pays.',
    steps: ['Enter the bill amount', 'Set the tip and how many', 'Read each person’s share'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { bill: 146.4, tip: 12.5, people: 6, round: 'up' } },
    howTo: 'How to split a bill with a tip, free',
    cta: 'Split the bill'
  },

  '/utilities/square-footage/': {
    persona: 'Homeowners buying flooring',
    hook: 'L-shaped room, new flooring. How much do you order?',
    pain: 'The shop asks for square feet. Your room is L-shaped and you need 10% extra for cuts.',
    usual: ['Sketching rectangles on paper', 'Forgetting the waste allowance', 'A second delivery from another batch'],
    promise: 'Enter room sections and waste. Get area, order quantity and cost.',
    steps: ['Enter each section’s size', 'Set waste and price', 'Read area and order amount'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { unit: 'ft', l1: 14, w1: 12, l2: 6, w2: 5, waste: 10, price: 28 } },
    howTo: 'How to measure an L-shaped room for flooring',
    cta: 'Measure my room'
  },

  '/utilities/random-number-generator/': {
    persona: 'Giveaway hosts and teachers',
    hook: 'Pick 3 winners from 250 entries, with no repeats.',
    pain: 'The giveaway closes tonight. You need numbers from a sound random source, not your gut.',
    usual: ['Picking a number that feels random', 'Generators that lean to low numbers', 'Names pulled from a hat on camera'],
    promise: 'Set the range and how many. Get numbers from a cryptographic source.',
    steps: ['Set the minimum and maximum', 'Choose how many, no repeats', 'Generate and note the draw'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { min: 1, max: 250, count: 3, unique: 'no', sort: 'draw' } },
    howTo: 'How to draw random winners from a list',
    cta: 'Draw the numbers'
  },

  '/utilities/dice-roller/': {
    persona: 'Tabletop and board gamers',
    hook: 'Rolling stats tonight? 4d6, drop the lowest.',
    pain: 'Game night, and the dice bag is at home — or you need 4d6 drop-lowest six times over.',
    usual: ['Dice apps full of adverts', 'Borrowed dice rolling off the table', 'Drop-lowest maths on every roll'],
    promise: 'Pick dice, sides and modifier. Get every roll and the total.',
    steps: ['Pick the number of dice', 'Choose sides and drop rule', 'Roll and read the total'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { count: 4, sides: '6', modifier: 0, drop: 'low' } },
    howTo: 'How to roll 4d6 drop lowest online, free',
    cta: 'Roll the dice'
  },

  '/utilities/gpa-calculator/': {
    persona: 'Students applying abroad',
    hook: 'A, B+, A-, B, C+. What is that as a GPA?',
    pain: 'Applications ask for your GPA. Your transcript lists letter grades and credits, not a number.',
    usual: ['Grade-point tables looked up each time', 'Ignoring credits in the average', 'A spreadsheet for a five-line sum'],
    promise: 'Enter grades and credits. Get your weighted GPA on a 4, 5 or 10 scale.',
    steps: ['Enter your letter grades', 'Add credits in the same order', 'Read your GPA'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { grades: 'A, B+, A-, B, C+', credits: '4, 3, 3, 3, 1', scale: '4' } },
    howTo: 'How to calculate a weighted GPA, free',
    cta: 'Work out my GPA'
  },

  '/utilities/cooking-converter/': {
    persona: 'Home cooks and bakers',
    hook: '2 cups of flour is how many grams?',
    pain: 'The recipe is American, your kitchen is metric, and a cup of flour weighs nothing like a cup of sugar.',
    usual: ['Charts that disagree by 20 grams', 'Treating a cup as a fixed weight', 'Guessing and hoping it rises'],
    promise: 'Pick the ingredient and amount. Get grams, ml, spoons and ounces.',
    steps: ['Enter the amount and unit', 'Pick the ingredient', 'Read grams and millilitres'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { amount: 2, unit: 'cup', ingredient: '600', scale: 1 } },
    howTo: 'How to convert cups to grams for baking',
    cta: 'Convert my recipe'
  },

  '/utilities/shoe-size-converter/': {
    persona: 'Online shoppers buying abroad',
    hook: 'EU 42 in the online shop. What is that in UK sizes?',
    pain: 'You are ordering shoes from abroad. The site lists EU sizes, and returns cost you time.',
    usual: ['Size charts that disagree', 'Guessing between two sizes', 'Sending back a pair that does not fit'],
    promise: 'Enter your size and system. Get UK, US, EU, Japan and foot length.',
    steps: ['Enter your size', 'Pick the system it is in', 'Read the other sizes'],
    proof: PROOF,
    example: { kind: 'calc', inputs: { size: 42, system: 'eu' } },
    howTo: 'How to convert EU shoe sizes to UK and US',
    cta: 'Convert my size'
  }
};
