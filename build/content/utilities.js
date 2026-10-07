/**
 * The reading part of the Utilities calculators, rendered by build-depth.js.
 * Shape and rules: build-depth.js and build/content/_check.js. Every figure is
 * computed with the page's own engine and listed in worked.check / checks.
 * The dice roller and random number generator are random: their worked
 * examples check only the deterministic outputs (notation, count, range,
 * notes), and the probabilities quoted are exact arithmetic, not results.
 */
'use strict';

module.exports = {
  '/utilities/cooking-converter/': {
    term: 'a cup measure',
    whatIs: [
      'A cup is a measure of volume, not weight. American recipes use it for everything from milk to flour, while British and European recipes weigh dry ingredients, so converting one means turning a volume into a mass, and that depends on how dense the ingredient is.',
      'This tool takes the US cup as 240 ml, the size used on US nutrition labels, with a 15 ml tablespoon and a 5 ml teaspoon. The older US customary cup is about 236.6 ml, a difference too small to matter in most kitchens.'
    ],
    formula: {
      text: 'The amount is turned into millilitres and multiplied by the scale factor. Grams follow from the ingredient’s density in grams per litre, and every other unit is a division of the same millilitre figure.',
      expr: [
        'ml = amount × ml per unit × scale',
        'grams = ml × density ÷ 1,000',
        'ounces = grams ÷ 28.3495        fl oz = ml ÷ 29.5735'
      ],
      vars: [['ml per unit', 'cup 240, tablespoon 15, teaspoon 5, US fluid ounce 29.5735'], ['density', 'grams per litre: water 1,000, granulated sugar 845, butter 911']]
    },
    worked: {
      inputs: { amount: 0.75, unit: 'cup', ingredient: '845', scale: 1.5 },
      text: 'A US cookie recipe asks for ¾ cup of granulated sugar and you are making one and a half batches. Enter 0.75 cups, choose granulated sugar and scale by 1.5: that is 270 ml, which weighs 228.15 g, or 18 tablespoons if the scales are out of batteries. Packed brown sugar in the same volume would weigh 216 g, because the tool uses 800 g per litre for brown against 845 for white.',
      check: [['ml', '270 ml'], ['grams', '228.15 g'], ['tbsp', '18 tablespoons']]
    },
    uses: [
      ['American recipes on metric scales', 'Turn cup amounts of sugar, oats or rice into grams.'],
      ['Scaling a recipe', 'Halve, double or multiply by 1.5 in the same step as the conversion.'],
      ['Small quantities', 'Convert a tablespoon of honey or cocoa when the amount is too small to weigh well.'],
      ['Liquids', 'Read cups of milk or stock as millilitres on a measuring jug.']
    ],
    mistakes: [
      'Using the water figure for dry ingredients. One cup is 240 g of water but only 81.6 g of cocoa powder.',
      'Mixing up fluid ounces and ounces. Fluid ounces measure volume and ounces weight: a cup of butter is 8.1 fl oz but 7.7 oz.'
    ],
    faq: [
      { q: 'How many grams of butter are in a cup?', a: 'With butter at 911 g per litre, one 240 ml cup weighs 218.64 g.' },
      { q: 'How many tablespoons are in a cup?', a: '16, since 240 ml ÷ 15 ml is 16. A teaspoon is a third of a tablespoon, so a cup is also 48 teaspoons.' },
      { q: 'How much does a tablespoon of honey weigh?', a: 'About 15.45 g. Honey is denser than water, at 1,030 g per litre here, so a spoonful weighs a little more than its volume in millilitres.' },
      { q: 'How do I convert millilitres of flour to grams?', a: 'Choose millilitres and the flour that matches how it was measured. 100 ml of sifted plain flour is 52.9 g.' }
    ],
    checks: [
      { inputs: { amount: 0.75, unit: 'cup', ingredient: '800', scale: 1.5 }, key: 'grams', shown: '216 g' },
      { inputs: { amount: 1, unit: 'cup', ingredient: '1000', scale: 1 }, key: 'grams', shown: '240 g' },
      { inputs: { amount: 1, unit: 'cup', ingredient: '340', scale: 1 }, key: 'grams', shown: '81.6 g' },
      { inputs: { amount: 1, unit: 'cup', ingredient: '911', scale: 1 }, key: 'floz', shown: '8.1 fl oz' },
      { inputs: { amount: 1, unit: 'cup', ingredient: '911', scale: 1 }, key: 'ounces', shown: '7.7 oz' },
      { inputs: { amount: 1, unit: 'cup', ingredient: '911', scale: 1 }, key: 'grams', shown: '218.64 g' },
      { inputs: { amount: 1, unit: 'cup', ingredient: '911', scale: 1 }, key: 'tbsp', shown: '16, since' },
      { inputs: { amount: 1, unit: 'cup', ingredient: '911', scale: 1 }, key: 'tsp', shown: '48 teaspoons' },
      { inputs: { amount: 1, unit: 'tbsp', ingredient: '1030', scale: 1 }, key: 'grams', shown: '15.45 g' },
      { inputs: { amount: 100, unit: 'ml', ingredient: '529', scale: 1 }, key: 'grams', shown: '52.9 g' }
    ],
    related: { conversions: ['/conversions/volume/cup-us-to-milliliter/', '/conversions/volume/tablespoon-us-to-milliliter/', '/conversions/mass/gram-to-ounce/'] }
  },

  '/utilities/dice-roller/': {
    term: 'dice notation',
    whatIs: [
      'Dice notation is the shorthand tabletop games use for a roll: NdS means N dice with S sides, and a number after a plus or minus sign is added to the total. 2d20+5 is two twenty-sided dice plus five; d100, or percentile dice, gives a number from 1 to 100.',
      'It lets a rulebook say exactly what to roll, and this roller takes the same pieces from its four boxes.'
    ],
    formula: {
      text: 'Each die is an independent whole number from 1 to S, every face equally likely. With a drop rule, the single lowest or highest die is removed before the kept dice are summed; the modifier is added last. A drop needs at least two dice.',
      expr: [
        'total = sum of kept dice + modifier',
        'average of one die = (S + 1) ÷ 2',
        'range with no drop = N + M  to  N × S + M'
      ],
      vars: [['N', 'number of dice'], ['S', 'sides on each die'], ['M', 'the modifier, which can be negative']]
    },
    worked: {
      inputs: { count: 2, sides: '20', modifier: 5, drop: 'low' },
      text: 'In many role-playing games, advantage means rolling two d20s and keeping the higher. Set 2 dice, d20, Drop the lowest and a modifier of 5: the roll is 2d20+5, and the total can be anything from 6 to 25. Keeping the higher die lifts the average die from 10.5 to 13.825 before the +5. If you need 15 or more on the die, a single d20 manages it 30% of the time; with advantage it is 51%, because only 14 × 14 = 196 of the 400 pairs miss.',
      check: [['notation', '2d20+5'], ['modifier', '+5']]
    },
    uses: [
      ['Tabletop role-playing games', 'Roll attacks, damage and ability scores without a dice bag.'],
      ['Board games with a missing die', 'Stand in for a lost d6, or the pair a game needs.'],
      ['Teaching probability', 'Roll up to 200 dice at once and compare the total with the expected average.']
    ],
    mistakes: [
      'Adding the modifier to every die. In 3d6+2 the 2 is added once, so totals run from 5 to 20, not 9 to 24.',
      'Choosing a drop rule with one die. Nothing is removed, and Dropped shows —.',
      'Reading Average per die as the long-run average. It is the mean of the dice kept on this roll; over many rolls a d6 averages 3.5.'
    ],
    faq: [
      { q: 'What is the average of 4d6 drop the lowest?', a: 'Exactly 15,869 ÷ 1,296, about 12.24, against 10.5 for a plain 3d6.' },
      { q: 'What does d100 mean?', a: 'A roll from 1 to 100, at the table often made with two ten-sided dice, one for tens and one for units. Choose d100 here and every value has a 1% chance.' },
      { q: 'What are the odds of rolling 10 on 3d6?', a: '27 of the 216 combinations add up to 10, so 12.5%. A 3 or an 18 each come up once in 216.' },
      { q: 'Can the modifier be negative?', a: 'Yes. One d20 with a modifier of −1 shows as 1d20-1, and the total runs from 0 to 19.' }
    ],
    checks: [
      { inputs: { count: 3, sides: '6', modifier: 2, drop: 'none' }, key: 'notation', shown: '3d6+2' },
      { inputs: { count: 1, sides: '20', modifier: 0, drop: 'low' }, key: 'droppedValue', shown: '—' },
      { inputs: { count: 1, sides: '20', modifier: -1, drop: 'none' }, key: 'notation', shown: '1d20-1' }
    ]
  },

  '/utilities/fuel-efficiency/': {
    term: 'fuel efficiency',
    whatIs: [
      'Fuel efficiency is how far a vehicle travels on a set amount of fuel, or how much fuel it burns over a set distance. The UK quotes miles per imperial gallon although pumps sell litres, the US uses miles per US gallon, and most of Europe uses litres per 100 km, so one car carries three different-looking figures.',
      'For a trip budget, the number that matters is the fuel burned over the distance, and the cost is built on that.'
    ],
    formula: {
      text: 'Every efficiency is converted to litres per 100 km first. The distance becomes kilometres, the fuel needed is the rate times the distance, and the cost is that volume at the pump price, turned into a price per litre if it was entered per US gallon.',
      expr: [
        'L/100 km = 282.481 ÷ MPG (UK) = 235.215 ÷ MPG (US) = 100 ÷ km per litre',
        'litres = L/100 km ÷ 100 × km',
        'cost = litres × price per litre'
      ],
      vars: [['282.481', 'litres per 100 km at one mile per imperial gallon (4.54609 L ÷ 1.609344 km × 100)'], ['235.215', 'the same for a 3.785 L US gallon']]
    },
    worked: {
      inputs: { efficiency: 5.8, unit: 'l100', distance: 350, distUnit: 'mi', price: 1.52, priceUnit: 'l' },
      text: 'A hire car’s trip computer shows 5.8 L/100 km, the round trip is 350 miles and fuel is £1.52 a litre. Choose L/100 km, Miles and Litre: the car needs 32.67 litres and the trip costs £49.66, or £0.14 a mile. On a British dashboard the same car would read 48.7 MPG; on an American one, 40.6 MPG.',
      check: [['litres', '32.67 litres'], ['cost', '£49.66'], ['costPerDistance', '£0.14'], ['mpguk', '48.7 MPG'], ['mpgus', '40.6 MPG']]
    },
    uses: [
      ['Comparing cars', 'Put a UK brochure’s MPG and a European L/100 km figure on one scale before buying or hiring.'],
      ['Budgeting a road trip', 'Price a holiday drive at the fuel price where you will fill up.'],
      ['Checking the trip computer', 'Fill the tank twice, note the litres and miles between fills, and compare with the dashboard.']
    ],
    mistakes: [
      'Entering imperial MPG as US MPG. 40 MPG from a UK brochure is 7.06 L/100 km; read as US gallons it becomes 5.88, and the fuel estimate falls by about 17%.',
      'Leaving Price Per on US Gallon. That is the default, and a UK price per litre entered against it is spread over 3.785 litres, so the cost comes out far too low.'
    ],
    faq: [
      { q: 'How do I convert UK MPG to US MPG?', a: 'Multiply by about 0.833, the ratio of the two gallons. 50 MPG in imperial gallons is 41.6 MPG in US gallons.' },
      { q: 'How much does it cost to drive 100 miles?', a: 'At 40 MPG (UK) and £1.50 a litre, 100 miles uses 11.37 litres and costs £17.05.' },
      { q: 'How do I work out km per litre?', a: 'Divide 100 by the L/100 km figure, or read the km/L result: 5.8 L/100 km is 17.24 km per litre.' },
      { q: 'Why is my real consumption worse than the official figure?', a: 'Official figures come from a standard test cycle. Short trips from cold, motorway speeds, roof boxes and air conditioning all raise real use.' }
    ],
    checks: [
      { inputs: { efficiency: 40, unit: 'mpguk', distance: 100, distUnit: 'mi', price: 1.5, priceUnit: 'l' }, key: 'l100', shown: '7.06 L/100 km' },
      { inputs: { efficiency: 40, unit: 'mpgus', distance: 100, distUnit: 'mi', price: 1.5, priceUnit: 'l' }, key: 'l100', shown: 'becomes 5.88' },
      { inputs: { efficiency: 50, unit: 'mpguk', distance: 100, distUnit: 'mi', price: 1.5, priceUnit: 'l' }, key: 'mpgus', shown: '41.6 MPG' },
      { inputs: { efficiency: 40, unit: 'mpguk', distance: 100, distUnit: 'mi', price: 1.5, priceUnit: 'l' }, key: 'litres', shown: '11.37 litres' },
      { inputs: { efficiency: 40, unit: 'mpguk', distance: 100, distUnit: 'mi', price: 1.5, priceUnit: 'l' }, key: 'cost', shown: '£17.05' },
      { inputs: { efficiency: 5.8, unit: 'l100', distance: 350, distUnit: 'mi', price: 1.52, priceUnit: 'l' }, key: 'kml', shown: '17.24 km' }
    ],
    related: { conversions: ['/conversions/volume/gallon-imperial-to-liter/', '/conversions/length/mile-to-kilometer/'] }
  },

  '/utilities/gpa-calculator/': {
    term: 'a GPA',
    whatIs: [
      'A grade point average turns letter grades into one number by giving each grade a point value, from 4.0 for an A down to 0 for an F, and averaging them. US colleges and many graduate programmes ask for it, and Indian universities report the similar CGPA on a 10-point scale.',
      'When courses carry different credits the average is weighted, so a heavy module pulls the result harder than a short one.'
    ],
    formula: {
      text: 'Each grade becomes points, and points times credits gives quality points. Total quality points divided by total credits is the GPA on the 4.0 scale; the 10- and 5-point results are straight multiples of it.',
      expr: [
        'GPA (4.0) = Σ(points × credits) ÷ Σ credits',
        'GPA (10) = GPA (4.0) × 2.5        GPA (5) = GPA (4.0) × 1.25',
        'percentage = GPA (4.0) ÷ 4 × 100'
      ],
      vars: [['points', 'A+ and A 4.0, A− 3.7, B+ 3.3, B 3.0, B− 2.7, C+ 2.3, C 2.0, C− 1.7, D+ 1.3, D 1.0, D− 0.7, F 0'], ['credits', 'each course’s credit hours or weight']]
    },
    worked: {
      inputs: { grades: 'A, A-, B, C+', credits: '2, 3, 3, 6', scale: '4' },
      text: 'A term has four courses: an A in a 2-credit seminar, an A− and a B in two 3-credit courses, and a C+ in a 6-credit lab. The quality points are 8 + 11.1 + 9 + 13.8 = 41.9 over 14 credits, a GPA of 2.99. Leave the credits box empty and the same grades average 3.25, because the lab then counts no more than the seminar.',
      check: [['gpa', '2.99'], ['qualityPoints', '41.9'], ['totalCredits', '14 credits']]
    },
    uses: [
      ['Applications', 'Graduate schools, scholarships and some employers set a minimum GPA.'],
      ['Exchange and transfer forms', 'Restate a 4.0-scale GPA on a 10-point scale as a first estimate; for the reverse, divide by 2.5.'],
      ['Planning next term', 'Enter the grades you expect to see how far a strong term can lift the figure.'],
      ['Checking a transcript', 'Confirm the GPA a registrar printed from your own grades and credits.']
    ],
    mistakes: [
      'Giving fewer credits than grades. With grades A, B, C and credits 3, 3 the tool notes “You gave 2 credit values for 3 grades” and averages without weights.',
      'Averaging semester GPAs directly. A 3.8 over 12 credits and a 3.0 over 18 credits make 3.32, not 3.4; enter the two GPAs as grades with their credits to weight them.'
    ],
    faq: [
      { q: 'What is a 3.5 GPA as a percentage?', a: 'On this tool’s proportional conversion, 87.5%. Universities that publish their own table may give a different figure.' },
      { q: 'How do I convert a GPA to the 10-point scale?', a: 'Choose the 10.0 scale and enter the grades or the GPA itself: 3.2 on the 4.0 scale becomes 8.0.' },
      { q: 'What is a quality point?', a: 'A grade’s points multiplied by its credits. A B+ in a 4-credit course earns 13.2 quality points.' },
      { q: 'Does an F count in a GPA?', a: 'Yes, as 0 points with its full credits. An A and an F in two 3-credit courses average 2.0.' }
    ],
    checks: [
      { inputs: { grades: 'A, A-, B, C+', credits: '', scale: '4' }, key: 'gpa', shown: '3.25' },
      { inputs: { grades: 'A, B, C', credits: '3, 3', scale: '4' }, key: 'note', shown: 'You gave 2 credit values for 3 grades' },
      { inputs: { grades: '3.8, 3.0', credits: '12, 18', scale: '4' }, key: 'gpa', shown: 'make 3.32' },
      { inputs: { grades: '3.5', credits: '', scale: '4' }, key: 'percentage', shown: '87.5%' },
      { inputs: { grades: '3.2', credits: '', scale: '10' }, key: 'gpa', shown: 'becomes 8.0' },
      { inputs: { grades: 'B+', credits: '4', scale: '4' }, key: 'qualityPoints', shown: '13.2' },
      { inputs: { grades: 'A, F', credits: '3, 3', scale: '4' }, key: 'gpa', shown: 'average 2.0' }
    ]
  },

  '/utilities/random-number-generator/': {
    term: 'a random number generator',
    whatIs: [
      'A random number generator picks whole numbers from a range so that every value is equally likely and no result can be predicted from earlier ones. Raffles, giveaways and audit samples depend on that, and people asked to choose at random tend to avoid repeats and favour certain numbers.',
      'With No duplicates, each number can come out once, like balls from a drum; with duplicates allowed, every draw starts from the full range again.'
    ],
    formula: {
      text: 'The range holds max − min + 1 whole numbers. Each draw takes a random 32-bit value, rejects it if it falls in the incomplete slice at the top, and keeps the remainder after dividing by the span. Spans over 2³², about 4.3 billion, join two values into 53 bits. Without duplicates, a drawn number leaves the pool.',
      expr: [
        'span = max − min + 1',
        'number = min + (v mod span), keeping only v < 2³² − (2³² mod span)',
        'chance of a given number on one draw = 1 ÷ span'
      ],
      vars: [['v', 'a random 32-bit value from crypto.getRandomValues'], ['mod', 'the remainder after division']]
    },
    worked: {
      inputs: { min: 1, max: 59, count: 6, unique: 'no', sort: 'asc' },
      text: 'To draw six numbers from 1 to 59 like a lottery machine, set the range, ask for 6, choose No duplicates and Lowest first. Every press holds 6 numbers in the range 1 to 59, a different set each time. Any particular set of six has a 1 in 45,057,474 chance of being drawn: 59 × 58 × 57 × 56 × 55 × 54 ÷ 720, the orders six numbers can come in.',
      check: [['count', '6 numbers'], ['range', '1 to 59']]
    },
    uses: [
      ['Prize draws', 'Number the entries and draw a winner, plus a reserve or two.'],
      ['Classrooms and meetings', 'Pick who answers next or the order of presentations.'],
      ['Sampling', 'Choose which rows of a list to audit or survey.']
    ],
    mistakes: [
      'Allowing duplicates in a draw. Six numbers from 1 to 59 with duplicates allowed contain a repeat about 23.1% of the time.',
      'Asking for more unique numbers than the range holds. Sixty from 1 to 59 cannot be done, and the tool replies that the range only holds 59.',
      'Drawing again because a result looks too neat. 1, 2, 3, 4, 5, 6 is exactly as likely as any other set, and discarding it makes the draw less fair, not more.'
    ],
    faq: [
      { q: 'How do I pick a random winner from a list?', a: 'Number the entries and ask for 1 number. With 312 entries the range is 1 to 312, and each entry has a 1 in 312 chance.' },
      { q: 'Can it generate negative numbers?', a: 'Yes. A minimum of -10 and a maximum of 10 gives the range -10 to 10, which is 21 values including zero.' },
      { q: 'How likely is the same number twice in a row?', a: 'With duplicates allowed, 1 in the size of the range: 1 in 100 for numbers from 1 to 100.' },
      { q: 'Does Lowest first change which numbers are drawn?', a: 'No, it only sorts the numbers already drawn. Keep Draw order when the order matters, such as first, second and third prize.' }
    ],
    checks: [
      { inputs: { min: 1, max: 59, count: 60, unique: 'no', sort: 'asc' }, key: 'note', shown: 'the range only holds 59' },
      { inputs: { min: 1, max: 312, count: 1, unique: 'no', sort: 'draw' }, key: 'range', shown: '1 to 312' },
      { inputs: { min: -10, max: 10, count: 3, unique: 'yes', sort: 'draw' }, key: 'range', shown: '-10 to 10' }
    ]
  },

  '/utilities/shoe-size-converter/': {
    whatTitle: 'How do shoe sizes work?',
    whatIs: [
      'A shoe size is a length written in a local unit. The UK and US step in thirds of an inch, the EU in two-thirds of a centimetre, and Japan uses the foot length in centimetres, so converting between them means going through the length of the foot.',
      'US men’s sizes sit one above UK sizes and US women’s two and a half above, which is how the same shoe can be labelled 9, 10 and 11.5.'
    ],
    formula: {
      text: 'Every size is first turned into a foot length. The UK and EU formulas include an allowance for the last, the mould a shoe is built on, so a size describes a shoe slightly longer than the foot. Results are rounded to the nearest half size.',
      expr: [
        'foot (in) = (UK + 23) ÷ 3',
        'US men = UK + 1        US women = UK + 2.5',
        'EU = 1.5 × (foot cm + 1.5)        Japan = foot cm'
      ],
      vars: [['23', 'sets the UK origin about two-thirds of an inch beyond the foot, the allowance for the last'], ['1.5', 'Paris points per centimetre, and the 1.5 cm allowance for the last']]
    },
    worked: {
      inputs: { size: 8, system: 'usw' },
      text: 'A US women’s 8 works back to a foot length of 24.1 cm, or 9.5 in. That is a UK 5.5, an EU 38.5 and a Japanese 24, and the same foot in a men’s or unisex trainer is a US 6.5. If a brand makes only whole EU sizes, the choice is between 38 and 39, and the foot length is the better guide.',
      check: [['cm', '24.1 cm'], ['inches', '9.5 in'], ['uk', 'UK 5.5'], ['eu', 'EU 38.5'], ['usMen', 'US 6.5']]
    },
    uses: [
      ['Ordering from abroad', 'Find the EU or centimetre size that matches your usual UK one.'],
      ['Unisex and men’s styles', 'Trainers and boots are often sized in men’s numbers; convert a women’s size across.'],
      ['Gifts', 'Translate a size someone gives you into the system the shop uses.'],
      ['Starting from a measurement', 'Measure the foot in centimetres and read every system from that one length.']
    ],
    mistakes: [
      'Measuring an old insole instead of the foot. The cm box expects foot length, and an insole is already longer, so it overstates the size.',
      'Assuming UK and US numbers match. A UK 10 is a US men’s 11 and a US women’s 12.5.'
    ],
    faq: [
      { q: 'What size is a 27 cm foot?', a: 'UK 9, US men’s 10, US women’s 11.5 and EU 43; in Japan the size is simply 27.' },
      { q: 'What is an EU 38 in UK sizes?', a: 'A UK 5, or US women’s 7.5, from a foot about 23.8 cm long.' },
      { q: 'Are Japanese shoe sizes the same as foot length?', a: 'Yes, they are the foot length in centimetres, which is why they are the easiest system to check with a tape measure. The tool rounds them to the nearest half centimetre.' }
    ],
    checks: [
      { inputs: { size: 10, system: 'uk' }, key: 'usMen', shown: 'US men’s 11' },
      { inputs: { size: 10, system: 'uk' }, key: 'usWomen', shown: 'US women’s 12.5' },
      { inputs: { size: 27, system: 'cm' }, key: 'uk', shown: 'UK 9' },
      { inputs: { size: 27, system: 'cm' }, key: 'usMen', shown: 'US men’s 10' },
      { inputs: { size: 27, system: 'cm' }, key: 'usWomen', shown: 'US women’s 11.5' },
      { inputs: { size: 27, system: 'cm' }, key: 'eu', shown: 'EU 43' },
      { inputs: { size: 38, system: 'eu' }, key: 'uk', shown: 'A UK 5' },
      { inputs: { size: 38, system: 'eu' }, key: 'usWomen', shown: 'US women’s 7.5' },
      { inputs: { size: 38, system: 'eu' }, key: 'cm', shown: '23.8 cm' }
    ],
    related: { conversions: ['/conversions/length/centimeter-to-inch/'] }
  },

  '/utilities/square-footage/': {
    term: 'square footage',
    whatIs: [
      'Square footage is floor area in square feet: length times width for a rectangular room, or the sum of several rectangles for an L-shaped one. Flooring, tiles and underlay are sold by area, and rents and property listings are often compared per square foot.',
      'British suppliers usually quote square metres instead, so the tool gives both, plus square yards.'
    ],
    formula: {
      text: 'Each section’s length and width are converted to feet and multiplied, and the sections are added. The waste allowance goes on top as a percentage, and boxes are the order area divided by 20 square feet, rounded up.',
      expr: [
        'area = L₁ × W₁ + L₂ × W₂',
        'order area = area × (1 + waste ÷ 100)',
        'm² = sq ft ÷ 10.7639      sq yd = sq ft ÷ 9      boxes = ⌈order area ÷ 20⌉'
      ],
      vars: [['L, W', 'length and width of each section, in feet, metres or inches'], ['⌈ ⌉', 'round up to the next whole box']]
    },
    worked: {
      inputs: { unit: 'm', l1: 4.2, w1: 3.6, l2: 0, w2: 0, waste: 15, price: 0 },
      text: 'A bedroom measures 4.2 m by 3.6 m and the new floor will be laid on the diagonal, so the waste allowance goes up to 15%. With Metres selected the room is 15.12 m², or 162.75 sq ft, and the order with waste is 17.388 m². In packs covering 20 sq ft each, that is 10 boxes.',
      check: [['sqm', '15.12 m²'], ['sqft', '162.75 sq ft'], ['withWasteM', '17.388 m²'], ['boxes', '10 boxes']]
    },
    uses: [
      ['Flooring orders', 'Work out how much laminate, tile or vinyl to buy, with a margin for cuts.'],
      ['Comparing rents and prices', 'Turn a listing’s room sizes into area to compare price per square foot or metre.'],
      ['Reading overseas listings', 'Restate a US listing in square feet as square metres, or the reverse.']
    ],
    mistakes: [
      'Mixing units across the boxes. All four lengths use the one unit selected, so an alcove measured in centimetres must be converted to metres first.',
      'Converting area with the length factor. 1 m is 3.28 ft, but 1 m² is 10.76 sq ft: a 4 m by 3 m room is 12 m² and 129.17 sq ft, not 39.4.',
      'Adding waste twice. If the supplier’s own pack calculator already adds a margin, set the allowance here to 0.'
    ],
    faq: [
      { q: 'How do I work out square feet from inches?', a: 'Choose Inches and enter the sizes as measured: 144 by 120 inches is 120 sq ft, because 144 square inches make one square foot.' },
      { q: 'What is a square yard?', a: 'Nine square feet, a square 3 ft each way. The 4.2 by 3.6 m bedroom is 18.08 sq yd.' },
      { q: 'Does a waste percentage apply to carpet?', a: 'Not in the same way. Carpet is cut from rolls, commonly 4 m or 5 m wide in the UK, so the waste depends on how the room fits the roll width; a fitter will measure for it.' }
    ],
    checks: [
      { inputs: { unit: 'm', l1: 4, w1: 3, l2: 0, w2: 0, waste: 0, price: 0 }, key: 'sqm', shown: '12 m²' },
      { inputs: { unit: 'm', l1: 4, w1: 3, l2: 0, w2: 0, waste: 0, price: 0 }, key: 'sqft', shown: '129.17 sq ft' },
      { inputs: { unit: 'in', l1: 144, w1: 120, l2: 0, w2: 0, waste: 0, price: 0 }, key: 'sqft', shown: '120 sq ft' },
      { inputs: { unit: 'm', l1: 4.2, w1: 3.6, l2: 0, w2: 0, waste: 15, price: 0 }, key: 'sqyd', shown: '18.08 sq yd' }
    ],
    related: { conversions: ['/conversions/area/square-meter-to-square-foot/', '/conversions/area/square-foot-to-square-yard/'] }
  },

  '/utilities/tip-calculator/': {
    whatTitle: 'What is a tip, and how is it split?',
    whatIs: [
      'A tip, or gratuity, is money added to a bill for the staff, usually a percentage of the bill. Splitting then divides the bill and tip between the people at the table.',
      'Rounding decides who absorbs the odd pence: rounding the total up adds a little to the tip once, while rounding every share up adds a little per person.'
    ],
    formula: {
      text: 'The tip is the bill times the rate; bill plus tip is the total, and each share is the total divided by the number of people. When the total or the shares are rounded up, the tip is recalculated as the new total less the bill, so the effective rate rises slightly.',
      expr: [
        'tip = bill × rate ÷ 100',
        'each = (bill + tip) ÷ people',
        'shares rounded up: each = ⌈each⌉, total = each × people, effective rate = (total − bill) ÷ bill × 100'
      ],
      vars: [['rate', 'the tip percentage'], ['⌈ ⌉', 'round up to the next whole pound']]
    },
    worked: {
      inputs: { bill: 64.8, tip: 15, people: 3, round: 'total' },
      text: 'Three friends have a £64.80 bill and want to leave 15%. Exactly, the tip is £9.72 and the total £74.52. With Round the total up, the total becomes £75.00, so each pays £25.00, and the tip is really £10.20, an effective rate of 15.741%.',
      check: [['total', '£75.00'], ['each', '£25.00'], ['tipAmt', '£10.20'], ['effectiveTip', '15.741%']]
    },
    uses: [
      ['Restaurant bills', 'Add a tip and split evenly before the card machine comes round.'],
      ['Taxis and deliveries', 'Round a fare up to a whole number and see what tip that implies.'],
      ['Group bookings', 'Share a guide’s or a boat skipper’s gratuity across everyone on the trip.'],
      ['Bills with service included', 'Set the tip to 0% and use the tool only to split.']
    ],
    mistakes: [
      'Tipping on a total that already includes service. A £120 bill with 12.5% service is £135; a further 12.5% on top pays the gratuity twice.',
      'Rounding each share up for a big table. Every share can rise by almost £1, so ten people can add nearly £10 to the tip without meaning to.',
      'Splitting evenly when one person only had a drink. Put what each person had in the uneven-split box instead: the bill and tip are then shared in proportion, so the person who had £8 pays for £8 and a tip on £8.'
    ],
    faq: [
      { q: 'How much is a 10% tip on £47?', a: '£4.70, which makes the total £51.70.' },
      { q: 'How do I split a bill and tip between 4 people?', a: 'Enter the bill, the tip rate and 4. A £120 bill with a 12.5% tip is £135 in total, or £33.75 each.' },
      { q: 'What is the effective tip rate?', a: 'The tip as a share of the bill after rounding. It matches the rate you entered when rounding is off, and creeps above it when the total or the shares are rounded up.' }
    ],
    checks: [
      { inputs: { bill: 64.8, tip: 15, people: 3, round: 'none' }, key: 'tipAmt', shown: '£9.72' },
      { inputs: { bill: 64.8, tip: 15, people: 3, round: 'none' }, key: 'total', shown: '£74.52' },
      { inputs: { bill: 120, tip: 12.5, people: 4, round: 'none' }, key: 'total', shown: '£135' },
      { inputs: { bill: 120, tip: 12.5, people: 4, round: 'none' }, key: 'each', shown: '£33.75' },
      { inputs: { bill: 47, tip: 10, people: 1, round: 'none' }, key: 'tipAmt', shown: '£4.70' },
      { inputs: { bill: 47, tip: 10, people: 1, round: 'none' }, key: 'total', shown: '£51.70' }
    ]
  }
};
