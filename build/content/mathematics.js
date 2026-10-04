/**
 * The reading part of the Mathematics calculators, rendered by
 * build-depth.js. Shape and rules: build-depth.js and build/content/_check.js.
 * Every figure is computed with the page's own engine (build/content/_engine.js)
 * and listed in worked.check / checks so the check can recompute it.
 */
'use strict';

module.exports = {
  '/mathematics/percentage/': {
    term: 'a percentage',
    whatIs: [
      'A percentage is a number of parts per hundred: 35% means 35 out of every 100, or 0.35 as a decimal. It puts amounts of different sizes on one scale, which is why a 6-mark gain means more on a 40-mark test than on a 120-mark one.',
      'Almost every percentage question is one of three sums: a part of a whole, the change from an old value to a new one, or the amount before a percentage was added or taken away.'
    ],
    formula: {
      text: 'Each result rearranges part = whole × rate ÷ 100 for the missing number. Percentage change divides by the starting value, so swapping A and B changes the answer.',
      expr: [
        'A as a % of B = A ÷ B × 100',
        '% change from A to B = (B − A) ÷ A × 100',
        'B increased by A% = B × (1 + A ÷ 100)',
        '% difference = |A − B| ÷ ((A + B) ÷ 2) × 100'
      ],
      vars: [['A', 'the first box, Value A'], ['B', 'the second box, Value B']]
    },
    worked: {
      inputs: { value: 60, total: 75 },
      text: 'A shop raises a price from £60 to £75. With 60 as Value A and 75 as Value B, the % change from A to B is 25%. Read the other way, 60 is 80% of 75, so going back from £75 to £60 would be a 20% cut: the same £15, measured against a larger starting point. The symmetric % difference, 22.222%, sits between the two because it measures the gap against the average, £67.50.',
      check: [['change', '25%'], ['aOfB', '80%'], ['difference', '22.222%']]
    },
    uses: [
      ['Discounts and price rises', 'Check whether “was £75, now £60” really is the 20% off the label claims.'],
      ['Exam marks', 'Turn 54 out of 72 into a percentage, or find how many marks 65% of a paper needs.'],
      ['Pay rises and inflation', 'Set a rise in pounds against the percentage an employer quoted, or against inflation.']
    ],
    mistakes: [
      'Dividing by the wrong base. Percentage change always divides by the starting value: a rise from 50 to 60 is 20%, not 16.7%.',
      'Undoing a rise by subtracting the same percentage. A £120 price that includes a 20% increase came from £100 (120 ÷ 1.2), not £96.'
    ],
    faq: [
      { q: 'How do I calculate a percentage of a number?', a: 'Multiply the number by the percentage and divide by 100: 15% of 240 is 240 × 15 ÷ 100 = 36. Here, put 15 in Value A and 240 in Value B and read “A% of B”.' },
      { q: 'How do I work out the percentage increase between two numbers?', a: 'Divide the rise by the old value and multiply by 100: from 80 to 92 is 12 ÷ 80 × 100 = 15%. Enter the old value as A.' },
      { q: 'How do I find the original price before a discount?', a: 'Divide the sale price by one minus the discount as a decimal. A coat at £68 after 15% off was £68 ÷ 0.85 = £80. Adding 15% back to £68 gives £78.20, which is wrong.' },
      { q: 'Can a percentage be more than 100%?', a: 'A share cannot, but a change can: sales rising from 40 to 100 units is a 150% increase.' }
    ],
    checks: [
      { inputs: { value: 15, total: 240 }, key: 'pctOfB', shown: '= 36' },
      { inputs: { value: 80, total: 92 }, key: 'change', shown: '15%' },
      { inputs: { value: 40, total: 100 }, key: 'change', shown: '150%' }
    ]
  },

  '/mathematics/average-calculator/': {
    term: 'an average',
    whatIs: [
      'An average is one number that stands in for a whole list. The mean shares the total out equally, the median is the middle value once the list is sorted, and the mode is the most frequent value.',
      'On lopsided data the three drift apart, so the gap between them is information in itself.'
    ],
    formula: {
      text: 'The weighted mean multiplies each value by its weight before adding, then divides by the total weight, so weights of 1, 2 and 1 count the middle value twice. The geometric mean takes the nth root of the product; the harmonic mean divides the count by the sum of reciprocals.',
      expr: [
        'mean = (x₁ + x₂ + … + xₙ) ÷ n',
        'weighted mean = Σ(wᵢ × xᵢ) ÷ Σwᵢ',
        'median = middle of the sorted list (mean of the middle two when n is even)',
        'geometric mean = (x₁ × x₂ × … × xₙ)^(1/n)',
        'harmonic mean = n ÷ Σ(1 ÷ xᵢ)'
      ],
      vars: [['xᵢ', 'each number in the list'], ['wᵢ', 'the weight for that number, in the same order'], ['n', 'how many numbers there are']]
    },
    worked: {
      inputs: { data: '12, 15, 15, 18, 40' },
      text: 'A part-time worker logs 12, 15, 15, 18 and 40 hours over five weeks, the 40 covering holidays. The mean is 20 hours, yet four of the five weeks fell below it. The median, 15, and the mode, 15, describe a usual week far better, and the range of 28 hours shows how far one busy week stretched the spread.',
      check: [['mean', '20 hours'], ['median', 'The median, 15'], ['mode', 'the mode, 15'], ['range', '28 hours']]
    },
    uses: [
      ['Weighted module marks', 'Combine marks from 20-, 30- and 40-credit modules into the figure a university uses for classification.'],
      ['Investment returns', 'Average yearly growth factors with the geometric mean, the only one that compounds back to the real end value.'],
      ['Typical bills', 'A median of monthly bills ignores one freak month.']
    ],
    mistakes: [
      'Averaging two averages directly. Class averages of 60% from 10 pupils and 80% from 30 pupils do not make 70% overall; weight each by its class size and it is 75%.',
      'Not checking Count after pasting. Two numbers run together without a separator become one value, so make sure Count matches what you meant to enter.'
    ],
    faq: [
      { q: 'How do I calculate a weighted average?', a: 'Multiply each value by its weight, add the products and divide by the sum of the weights. Marks of 62, 70 and 55 with weights 1, 2 and 1 give (62 + 140 + 55) ÷ 4 = 64.25, against a plain mean of 62.333.' },
      { q: 'Why does a 10% rise followed by a 10% fall not get back to the start?', a: 'The fall applies to a bigger base. The growth factors are 1.10 and 0.90, and their geometric mean is 0.99499, so over the two years you keep 99% of the starting value. The arithmetic mean of the factors, exactly 1, hides that loss.' },
      { q: 'What is the average speed if I drive out at 30 km/h and back at 60 km/h?', a: 'It is 40 km/h, the harmonic mean, not 45, because the slow leg takes twice as long and so fills more of the journey time.' }
    ],
    checks: [
      { inputs: { data: '60, 80', weights: '10, 30' }, key: 'weighted', shown: 'it is 75%' },
      { inputs: { data: '62, 70, 55', weights: '1, 2, 1' }, key: 'weighted', shown: '64.25' },
      { inputs: { data: '62, 70, 55', weights: '1, 2, 1' }, key: 'mean', shown: '62.333' },
      { inputs: { data: '1.10, 0.90' }, key: 'geometric', shown: '0.99499' },
      { inputs: { data: '1.10, 0.90' }, key: 'mean', shown: 'exactly 1' },
      { inputs: { data: '30, 60' }, key: 'harmonic', shown: 'It is 40 km/h' }
    ]
  },

  '/mathematics/fraction-calculator/': {
    term: 'a fraction',
    whatIs: [
      'A fraction is a division written out: 3/4 means 3 parts of a whole cut into 4 equal parts, and equals 0.75. The top number, the numerator, counts the parts; the bottom number, the denominator, says how big each part is.',
      'Fractions keep values exact where decimals round them off: 1/3 is exact, 0.3333 is not.'
    ],
    formula: {
      text: 'Adding and subtracting cross-multiply onto the shared denominator b × d. Multiplying multiplies tops and bottoms; dividing multiplies by the second fraction turned upside down. The result is then divided by the greatest common divisor of its top and bottom.',
      expr: [
        'a/b + c/d = (a×d + c×b) ÷ (b×d)',
        'a/b − c/d = (a×d − c×b) ÷ (b×d)',
        'a/b × c/d = (a×c) ÷ (b×d)',
        'a/b ÷ c/d = (a×d) ÷ (b×c)',
        'simplified = (top ÷ g) / (bottom ÷ g), where g = gcd(top, bottom)'
      ],
      vars: [['a, b', 'the first numerator and denominator'], ['c, d', 'the second numerator and denominator'], ['g', 'the greatest common divisor, shown as “Divided by (GCD)”']]
    },
    worked: {
      inputs: { n1: 2, d1: 3, op: '/', n2: 4, d2: 9 },
      text: 'How many 4/9-litre jugs does it take to fill a 2/3-litre bowl? Divide 2/3 by 4/9: flip the second fraction and multiply, 2 × 9 over 3 × 4, which is 18/12 before simplifying. Top and bottom both divide by 6, leaving 3/2, which is 1 1/2 as a mixed number and 1.5 as a decimal. One and a half jugs, then.',
      check: [['unsimplified', '18/12'], ['gcdUsed', 'divide by 6'], ['simplified', '3/2'], ['mixed', '1 1/2'], ['decimal', '1.5 as a decimal']]
    },
    uses: [
      ['Scaling recipes', 'Three quarters of a recipe that needs 2/3 of a cup of flour is 3/4 × 2/3 = 1/2 a cup.'],
      ['Imperial sizes', 'Add 5/8 in and 3/16 in timber or drill sizes without converting to decimals: 13/16 in.'],
      ['Probability', 'Multiply 1/6 by 1/6 for the chance of two sixes in a row, 1/36.']
    ],
    mistakes: [
      'Adding tops and bottoms straight across. 1/2 + 1/3 is not 2/5; over a shared denominator it is 3/6 + 2/6 = 5/6.',
      'Typing a mixed number into one box. The boxes take whole numbers and round decimals, so 2 1/4 goes in as the improper fraction 9/4 (2 × 4 + 1 over 4).'
    ],
    faq: [
      { q: 'How do I subtract fractions with different denominators?', a: 'Bring both onto one denominator, subtract the tops, then simplify. 5/8 − 1/6 becomes 30/48 − 8/48 = 22/48, which halves to 11/24. Using 24, the lowest common multiple of 8 and 6, reaches the same answer in one step.' },
      { q: 'How do I turn a fraction into a percentage?', a: 'Divide the top by the bottom and multiply by 100: 7/8 is 0.875, or 87.5%. To get it here, multiply the fraction by 1/1 and read the percentage line.' },
      { q: 'What is an improper fraction?', a: 'One whose numerator is at least as large as its denominator, such as 7/6. It is worth more than one whole, and as a mixed number 7/6 is 1 1/6; 7/4 × 2/3 comes to exactly that.' },
      { q: 'Can the answer be negative?', a: 'Yes. Taking a larger fraction from a smaller one, or entering a negative numerator, gives a negative result with the minus sign kept on top: 1/4 − 2/3 = −5/12.' }
    ],
    checks: [
      { inputs: { n1: 3, d1: 4, op: '*', n2: 2, d2: 3 }, key: 'simplified', shown: '1/2' },
      { inputs: { n1: 5, d1: 8, op: '+', n2: 3, d2: 16 }, key: 'simplified', shown: '13/16' },
      { inputs: { n1: 1, d1: 6, op: '*', n2: 1, d2: 6 }, key: 'simplified', shown: '1/36' },
      { inputs: { n1: 1, d1: 2, op: '+', n2: 1, d2: 3 }, key: 'simplified', shown: '5/6' },
      { inputs: { n1: 5, d1: 8, op: '-', n2: 1, d2: 6 }, key: 'unsimplified', shown: '22/48' },
      { inputs: { n1: 5, d1: 8, op: '-', n2: 1, d2: 6 }, key: 'simplified', shown: '11/24' },
      { inputs: { n1: 7, d1: 8, op: '*', n2: 1, d2: 1 }, key: 'percent', shown: '87.5%' },
      { inputs: { n1: 7, d1: 4, op: '*', n2: 2, d2: 3 }, key: 'simplified', shown: '7/6' },
      { inputs: { n1: 7, d1: 4, op: '*', n2: 2, d2: 3 }, key: 'mixed', shown: '1 1/6' },
      { inputs: { n1: 1, d1: 4, op: '-', n2: 2, d2: 3 }, key: 'simplified', shown: '5/12' }
    ]
  },

  '/mathematics/geometry-calculator/': {
    whatTitle: 'What are area and volume?',
    whatIs: [
      'Area is the flat space a shape covers, in square units; volume is the space a solid takes up, in cubic units. Surface area totals a solid’s outer faces, the part paint or lining must cover.',
      'Most real objects, from a lawn to a heap of gravel, are close enough to one of these eight shapes to give a usable figure.'
    ],
    formula: {
      text: 'The three boxes change meaning with the shape: radius and height for a cylinder or cone; length, width and depth for a cuboid; the two parallel sides and the height for a trapezium. A cone’s surface adds its round base to the sloping side.',
      expr: [
        'rectangle: A = l × w,  perimeter = 2(l + w)',
        'triangle: A = ½ × base × height',
        'trapezium: A = ½ × (a + c) × h',
        'cuboid: V = l × w × d,  surface = 2(lw + wd + ld)',
        'cylinder: V = πr²h,  surface = 2πr(r + h)',
        'sphere: V = 4/3 × πr³,  surface = 4πr²',
        'cone: V = ⅓ × πr²h,  surface = πr(r + √(r² + h²))'
      ],
      vars: [['r', 'radius, half the diameter, in the first box'], ['h', 'height, in the second box'], ['l, w, d', 'length, width and depth of a box'], ['a, c', 'the two parallel sides of a trapezium']]
    },
    worked: {
      inputs: { shape: 'cuboid', a: 2, b: 1, c: 0.3 },
      text: 'A raised bed is 2 m long, 1 m wide and 0.3 m deep. Choose Cuboid and enter 2, 1 and 0.3. The volume is 0.6 cubic metres, which is 600 litres of soil, or 15 bags of 40 litres. The surface area, 5.8 m², counts all six faces; to line only the four sides and the base, subtract the open top (2 m²) and buy 3.8 m² of membrane.',
      check: [['volume', '0.6 cubic'], ['surface', '5.8 m²'], ['area', '(2 m²)']]
    },
    uses: [
      ['Soil, gravel and concrete', 'These are sold by volume, so a bed, a path or a slab is a cuboid sum.'],
      ['Tanks and planters', 'A water butt or round pot is a cylinder, so its capacity follows from the radius and height.'],
      ['Heaps and hoppers', 'Sand or grain piles into roughly a cone, holding a third of the matching cylinder.']
    ],
    mistakes: [
      'Entering a diameter as the radius. A pot 30 cm across has a radius of 15 cm; using 30 makes the volume four times too large.',
      'Mixing units across the boxes. A bed 2 m by 50 cm by 30 cm goes in as 2, 0.5 and 0.3, all in metres.'
    ],
    faq: [
      { q: 'How do I work out the volume of a sphere?', a: 'Cube the radius, then multiply by π and by 4/3. A ball 22 cm across has an 11 cm radius, so its volume is 5,575.28 cm³, about 5.6 litres, and its surface 1,520.53 cm².' },
      { q: 'How is the area of a trapezium found?', a: 'Average the two parallel sides and multiply by the height between them. Sides of 6 m and 10 m, 4 m apart, give ½ × 16 × 4 = 32 m².' },
      { q: 'Why does the triangle give no perimeter?', a: 'A base and a perpendicular height fix the area but not the two sloping sides, so the perimeter cannot be known from them. A base of 8 and a height of 5 give an area of 20 whatever the slope.' }
    ],
    checks: [
      { inputs: { shape: 'sphere', a: 11 }, key: 'volume', shown: '5,575.28' },
      { inputs: { shape: 'sphere', a: 11 }, key: 'surface', shown: '1,520.53' },
      { inputs: { shape: 'trapezium', a: 6, b: 4, c: 10 }, key: 'area', shown: '= 32 m²' },
      { inputs: { shape: 'triangle', a: 8, b: 5 }, key: 'area', shown: 'area of 20' }
    ],
    related: { conversions: ['/conversions/volume/cubic-meter-to-liter/', '/conversions/area/square-meter-to-square-foot/'] }
  },

  '/mathematics/lcm-gcd/': {
    whatTitle: 'What are the LCM and GCD?',
    whatIs: [
      'The greatest common divisor (GCD, or highest common factor, HCF) is the largest whole number that divides every number in a list exactly. The least common multiple (LCM) is the smallest whole number that every number in the list divides into.',
      'One looks down to shared factors, the other up to shared multiples: for 15 and 20 the GCD is 5 and the LCM is 60.'
    ],
    formula: {
      text: 'The GCD comes from Euclid’s algorithm: replace the larger number by its remainder after dividing by the smaller, and repeat until the remainder is 0; the last non-zero value is the GCD. A longer list is folded two numbers at a time, and the LCM is built the same way from each pair’s GCD.',
      expr: [
        'gcd(a, b) = gcd(b, a mod b), until b = 0',
        'lcm(a, b) = a ÷ gcd(a, b) × b',
        'gcd(a, b, c) = gcd(gcd(a, b), c)',
        'lcm(a, b, c) = lcm(lcm(a, b), c)'
      ],
      vars: [['a mod b', 'the remainder when a is divided by b'], ['a, b, c', 'the whole numbers you enter; signs are dropped and zeros left out']]
    },
    worked: {
      inputs: { nums: '45, 60, 75' },
      text: 'Tiles come in 45, 60 and 75 mm widths. The widest module that divides all three exactly is 15 mm, the GCD, so in those units the widths are 3 : 4 : 5. Laid in three separate rows, the runs first finish level at 900 mm, the LCM, which takes 20 tiles of 45 mm, 15 of 60 mm and 12 of 75 mm.',
      check: [['gcd', '15 mm'], ['simplified', '3 : 4 : 5'], ['lcm', '900 mm']]
    },
    uses: [
      ['Shift patterns', 'Someone on a 4-day cycle and someone on a 6-day cycle share a day off every 12 days.'],
      ['Common denominators', 'The LCM of 8 and 12, which is 24, is the smallest denominator for adding eighths and twelfths.'],
      ['Cutting without waste', 'Lengths of 84 cm and 126 cm cut into equal pieces with nothing left over can be up to 42 cm long.']
    ],
    mistakes: [
      'Multiplying the numbers to get the LCM. 84 × 126 is 10,584, a common multiple, but the least is 252; the product counts their shared factor of 42 twice.',
      'Entering decimals. Each entry is rounded to a whole number, so prices of £2.50 and £3.75 should go in as pence, 250 and 375, giving a GCD of 125.'
    ],
    faq: [
      { q: 'How do I find the HCF of two numbers by hand?', a: 'Use Euclid’s method. For 126 and 84: 126 ÷ 84 leaves 42, and 84 ÷ 42 leaves 0, so the HCF is 42. It is far quicker than listing factors once the numbers pass 100.' },
      { q: 'When is the LCM just the two numbers multiplied together?', a: 'When they share no factor except 1. 8 and 9 have a GCD of 1, so their LCM is 72, the plain product.' },
      { q: 'How do I find when three repeating events next happen together?', a: 'Enter their cycle lengths and read the LCM. Services due every 6, 8 and 10 weeks all fall in the same week every 120 weeks.' }
    ],
    checks: [
      { inputs: { nums: '15, 20' }, key: 'gcd', shown: 'GCD is 5' },
      { inputs: { nums: '15, 20' }, key: 'lcm', shown: 'LCM is 60' },
      { inputs: { nums: '4, 6' }, key: 'lcm', shown: 'every 12 days' },
      { inputs: { nums: '8, 12' }, key: 'lcm', shown: 'which is 24' },
      { inputs: { nums: '84, 126' }, key: 'gcd', shown: 'up to 42 cm' },
      { inputs: { nums: '84, 126' }, key: 'lcm', shown: 'least is 252' },
      { inputs: { nums: '250, 375' }, key: 'gcd', shown: 'GCD of 125' },
      { inputs: { nums: '126, 84' }, key: 'gcd', shown: 'HCF is 42' },
      { inputs: { nums: '8, 9' }, key: 'lcm', shown: 'LCM is 72' },
      { inputs: { nums: '6, 8, 10' }, key: 'lcm', shown: 'every 120 weeks' }
    ]
  },

  '/mathematics/number-base-converter/': {
    whatTitle: 'What is a number base?',
    whatIs: [
      'A number base is how many digits a counting system uses before it carries into the next column. Decimal uses ten, binary two, octal eight and hexadecimal sixteen (0–9, then A–F). The quantity is the same in every base; only the way it is written changes.',
      'Computers store everything in binary, and octal and hex are compact ways for people to read it: one octal digit stands for three bits, one hex digit for four.'
    ],
    formula: {
      text: 'Each digit is multiplied by the base raised to the power of its position, counting from 0 on the right, and the results are added. Going the other way, divide by the target base again and again and read the remainders from last to first.',
      expr: [
        'value = dₖ × baseᵏ + … + d₁ × base¹ + d₀ × base⁰',
        '7EA in hex = 7 × 16² + 14 × 16 + 10 = 2026',
        'to base b: divide by b, keep the remainder, repeat with the quotient'
      ],
      vars: [['dᵢ', 'the digit in position i, where A = 10, B = 11 … Z = 35'], ['base', '2, 8, 10, 16, 32 or 36'], ['k', 'the position of the leftmost digit']]
    },
    worked: {
      inputs: { value: '755', from: '8' },
      text: 'On Linux, chmod 755 sets a file’s permissions in octal. Enter 755 with From base set to Octal: the decimal value is 493 and the binary is 111101101. Split that into threes, 111 101 101, and each group is read, write and execute for the owner, the group and everyone else: rwx, r-x, r-x. In hex the same number is 1ED.',
      check: [['decimal', 'is 493'], ['binary', '111101101'], ['hex', '1ED']]
    },
    uses: [
      ['Networking', 'Subnet masks make sense in binary: 240 is 11110000, the first four bits set.'],
      ['Web colours', 'A colour such as #1E90FF is three hex bytes, one each for red, green and blue.'],
      ['Computer science exams', 'GCSE and A-level papers ask for binary, denary and hex conversions by hand; check the working here.']
    ],
    mistakes: [
      'Leaving From base on the wrong setting. 101 read as decimal is one hundred and one; read as binary it is 5. The answer is only as right as the base you say the input is in.',
      'Equating bits with bytes. Bytes required rounds the bit length up to whole bytes, so 2026 needs 11 bits but occupies 2 bytes.'
    ],
    faq: [
      { q: 'How do I convert binary to decimal by hand?', a: 'Write the place values over the bits, 128, 64, 32, 16, 8, 4, 2, 1 for eight bits, and add the ones that sit over a 1. 11000000 is 128 + 64 = 192.' },
      { q: 'What is the largest number that fits in 8 bits?', a: '255, which is 11111111 in binary and FF in hex. Sixteen bits reach 65,535, or FFFF, which is why so many old software limits sit at those two numbers.' },
      { q: 'What is base 36 used for?', a: 'Short identifiers. Ten digits plus 26 letters pack large numbers into few characters: 2026 is 1KA in base 36 and 1VA in base 32.' }
    ],
    checks: [
      { inputs: { value: '240', from: '10' }, key: 'binary', shown: '11110000' },
      { inputs: { value: '101', from: '2' }, key: 'decimal', shown: 'it is 5' },
      { inputs: { value: '2026', from: '10' }, key: 'bits', shown: '11 bits' },
      { inputs: { value: '2026', from: '10' }, key: 'bytes', shown: '2 bytes' },
      { inputs: { value: '11000000', from: '2' }, key: 'decimal', shown: '= 192' },
      { inputs: { value: '255', from: '10' }, key: 'binary', shown: '11111111' },
      { inputs: { value: '255', from: '10' }, key: 'hex', shown: 'FF' },
      { inputs: { value: '65535', from: '10' }, key: 'decimal', shown: '65,535' },
      { inputs: { value: '65535', from: '10' }, key: 'hex', shown: 'FFFF' },
      { inputs: { value: '2026', from: '10' }, key: 'base36', shown: '1KA' },
      { inputs: { value: '2026', from: '10' }, key: 'base32', shown: '1VA' }
    ],
    related: { conversions: ['/conversions/data/bit-to-byte/'] }
  },

  '/mathematics/prime-factorisation/': {
    term: 'prime factorisation',
    whatIs: [
      'Prime factorisation writes a whole number as a product of primes, the numbers above 1 that only 1 and themselves divide. 360 is 2 × 2 × 2 × 3 × 3 × 5, written compactly as 2³ × 3² × 5.',
      'Once you have it, most questions about how a number divides follow directly: how many divisors it has, whether it is a perfect square, and what it shares with another number.'
    ],
    formula: {
      text: 'Divide by 2 as many times as it goes, then by 3, then 4, 5 and upwards; stop once the divisor squared passes what is left, and anything still above 1 is the last prime. From the exponents, the number of divisors is each exponent plus one, multiplied together.',
      expr: [
        'n = p₁^e₁ × p₂^e₂ × … × pₖ^eₖ',
        'number of divisors = (e₁ + 1) × (e₂ + 1) × … × (eₖ + 1)',
        'sum of divisors = Σ d, for every d that divides n exactly'
      ],
      vars: [['p', 'a prime factor'], ['e', 'its exponent: how many times it divides n'], ['k', 'the number of distinct primes']]
    },
    worked: {
      inputs: { n: 504 },
      text: '504 halves three times to 63, then divides by 3 twice to 7, which is prime: 504 = 2^3 × 3^2 × 7. The exponents 3, 2 and 1 give (3 + 1) × (2 + 1) × (1 + 1) = 24 divisors, and together they add up to 1,560. Because 2 and 7 appear to odd powers, 504 is not a perfect square; multiplying it by 14 makes every exponent even.',
      check: [['factorisation', '2^3 × 3^2 × 7'], ['divisorCount', '24 divisors'], ['sumOfDivisors', '1,560']]
    },
    uses: [
      ['Simplifying fractions', 'Factor top and bottom and cancel shared primes: 504/1001 share a 7 and reduce to 72/143.'],
      ['HCF and LCM by hand', 'Take the lowest power of each shared prime for the HCF, and the highest power of every prime for the LCM.'],
      ['Square and cube roots', 'A number is a perfect square when every exponent is even, and its square root halves each exponent.']
    ],
    mistakes: [
      'Stopping at a composite factor. 504 = 8 × 63 is a factorisation but not a prime one; both 8 and 63 must be broken down further.',
      'Expecting a divisor list for every number. Above ten million the tool gives the prime factors and the divisor count but stops listing the divisors.'
    ],
    faq: [
      { q: 'Is 1001 a prime number?', a: 'No, though it looks like one: 1001 = 7 × 11 × 13. That is why 7, 11 and 13 all divide any six-digit number made of a three-digit block written twice, such as 123123.' },
      { q: 'How can I tell if a number is prime?', a: 'Try each prime up to its square root; if none divides it, it is prime. For 97 that means testing 2, 3, 5 and 7 only, since 11² is 121, and none goes, so its only divisors are 1, 97.' },
      { q: 'What is a perfect number?', a: 'One equal to the sum of its divisors other than itself. 28 qualifies: all its divisors add up to 56, and 56 − 28 = 28.' }
    ],
    checks: [
      { inputs: { n: 1001 }, key: 'factorisation', shown: '7 × 11 × 13' },
      { inputs: { n: 97 }, key: 'divisorList', shown: '1, 97' },
      { inputs: { n: 28 }, key: 'sumOfDivisors', shown: 'add up to 56' }
    ]
  },

  '/mathematics/quadratic-solver/': {
    term: 'a quadratic equation',
    whatIs: [
      'A quadratic equation has the form ax² + bx + c = 0, with a not zero. Its graph is a parabola, and its roots are the x-values where the curve meets the horizontal axis: two crossings, one point where it just touches, or none on the real number line.',
      'Quadratics appear wherever something is squared: areas, the path of a thrown ball, revenue that rises and then falls as price goes up.'
    ],
    formula: {
      text: 'The quadratic formula comes from completing the square. The part under the square root, the discriminant, decides how many real roots there are. The vertex sits halfway between the roots, at x = −b ÷ 2a, and its height comes from putting that x back into the equation.',
      expr: [
        'x = (−b + √(b² − 4ac)) ÷ 2a  and  x = (−b − √(b² − 4ac)) ÷ 2a',
        'discriminant D = b² − 4ac',
        'vertex: x = −b ÷ 2a,  y = c − b² ÷ 4a',
        'when D < 0: x = −b ÷ 2a ± (√(−D) ÷ 2a) i'
      ],
      vars: [['a', 'the coefficient of x², which sets how steep the curve is and which way it opens'], ['b', 'the coefficient of x'], ['c', 'the constant, where the curve crosses the y-axis']]
    },
    worked: {
      inputs: { a: 2, b: -4, c: -6 },
      text: 'Solve 2x² − 4x − 6 = 0 by entering 2, −4 and −6. The discriminant is 16 + 48 = 64, a perfect square, so the roots come out whole: x = 3 and x = −1. The vertex is at x = 1, y = −8, the lowest point of an upward-opening curve. Every term shares a factor of 2, and x² − 2x − 3 = (x − 3)(x + 1) confirms both roots.',
      check: [['discriminant', '= 64'], ['root1', 'x = 3'], ['root2', 'x = −1'], ['vertexX', 'at x = 1'], ['vertexY', 'y = −8']]
    },
    uses: [
      ['Area problems', 'A rectangle 3 m longer than it is wide with an area of 40 m² gives x² + 3x − 40 = 0, so the width is 5 m.'],
      ['Best price', 'When profit is a quadratic in price, the roots are the break-even prices and the vertex is the most profitable one.'],
      ['Checking factorisation', 'Whole-number roots mean the expression factorises neatly; long decimals mean it does not.']
    ],
    mistakes: [
      'Dropping the sign of b. For x² − 5x + 6, b is −5; entering 5 gives roots of −2 and −3 instead of 3 and 2.',
      'Reading off a, b and c before rearranging. x² = 3x + 10 must become x² − 3x − 10 = 0 first, with every term on one side.'
    ],
    faq: [
      { q: 'How should a negative discriminant be read?', a:'The parabola never reaches the x-axis, so there are no real roots, only a complex pair. For x² + 2x + 5 the discriminant is −16 and the roots are −1 ± 2i; the vertex, at (−1, 4), sits above the axis.' },
      { q: 'When does a quadratic have only one root?', a:'The discriminant is 0 and the vertex lies on the x-axis, so the curve just touches it. x² − 6x + 9 = 0 is (x − 3)², with the repeated root 3.' },
      { q: 'Can the solver give irrational roots?', a: 'Yes, as decimals. x² − 2 = 0 has roots of plus or minus √2, shown as 1.41421 and −1.41421; enter b as 0 when there is no x term.' }
    ],
    checks: [
      { inputs: { a: 1, b: 3, c: -40 }, key: 'root1', shown: 'width is 5 m' },
      { inputs: { a: 1, b: 5, c: 6 }, key: 'root1', shown: 'roots of −2' },
      { inputs: { a: 1, b: 5, c: 6 }, key: 'root2', shown: 'and −3' },
      { inputs: { a: 1, b: -5, c: 6 }, key: 'root1', shown: 'instead of 3' },
      { inputs: { a: 1, b: 2, c: 5 }, key: 'discriminant', shown: '−16' },
      { inputs: { a: 1, b: 2, c: 5 }, key: 'vertexX', shown: '(−1,' },
      { inputs: { a: 1, b: 2, c: 5 }, key: 'vertexY', shown: ', 4)' },
      { inputs: { a: 1, b: -6, c: 9 }, key: 'discriminant', shown: 'is 0' },
      { inputs: { a: 1, b: -6, c: 9 }, key: 'root1', shown: 'root 3' },
      { inputs: { a: 1, b: 0, c: -2 }, key: 'root1', shown: '1.41421' },
      { inputs: { a: 1, b: 0, c: -2 }, key: 'root2', shown: '−1.41421' }
    ]
  },

  '/mathematics/ratio-calculator/': {
    term: 'a ratio',
    whatIs: [
      'A ratio compares the sizes of two amounts: 3 : 4 means for every 3 of the first there are 4 of the second. It fixes the proportion, not the quantities, so 30 : 40 and 300 : 400 are the same ratio.',
      'Mixes, shares and scale drawings are specified as ratios because the proportion stays put while the quantity changes.'
    ],
    formula: {
      text: 'Simplifying divides both terms by their greatest common divisor. A proportion A : B = C : D is solved by cross-multiplying. Sharing a total gives each side its own part of A + B.',
      expr: [
        'simplified = (A ÷ g) : (B ÷ g), where g = gcd(A, B)',
        'A : B = C : D  →  D = B × C ÷ A',
        'A’s share = total × A ÷ (A + B)',
        'B’s share = total × B ÷ (A + B)',
        'A as a % = A ÷ (A + B) × 100'
      ],
      vars: [['A, B', 'the two terms of the ratio'], ['C', 'a known amount on A’s side of a second, equal ratio'], ['D', 'the matching amount on B’s side'], ['g', 'the greatest common divisor of A and B']]
    },
    worked: {
      inputs: { a: 5, b: 3, c: 15, total: 1200 },
      text: 'Two partners put in £5,000 and £3,000, a ratio of 5 : 3, and the year’s profit is £1,200. Enter A = 5, B = 3 and share a total of 1200: A takes £750 and B £450, which is 62.5% and 37.5%. With C = 15, the proportion 5 : 3 = 15 : D gives D = 9, so a later £15,000 stake on A’s side would be matched by £9,000 on B’s.',
      check: [['simplified', '5 : 3'], ['shareA', '£750'], ['shareB', '£450'], ['percentA', '62.5%'], ['missingD', 'D = 9']]
    },
    uses: [
      ['Scale drawings and maps', 'At 1 : 50, 9 cm on the drawing is 450 cm, or 4.5 m, on site.'],
      ['Bike gearing', 'A 48-tooth chainring driving a 16-tooth sprocket simplifies to 3 : 1, three wheel turns per turn of the pedals.'],
      ['Dilution', 'A 1 : 4 squash or a 1 : 3 mortar keeps its strength as the batch grows.']
    ],
    mistakes: [
      'Entering decimal terms. The simplified ratio is built from whole numbers, so scale 1.5 : 2 up to 3 : 4 before entering it; the shares and percentages work either way.',
      'Putting C on the wrong side. C has to correspond to A; if your known amount belongs with B, swap A and B first.'
    ],
    faq: [
      { q: 'How do I share an amount in a ratio?', a: 'Add the parts, divide the amount by that total, then multiply by each part. £900 shared 2 : 7 is £900 ÷ 9 = £100 a part, so £200 and £700.' },
      { q: 'How do I simplify a ratio?', a: 'Divide both terms by the largest number that goes into each. 45 : 60 shares a factor of 15 and becomes 3 : 4.' },
      { q: 'How do I write a ratio as a percentage?', a: 'Put each term over the total of both and multiply by 100. In a class of girls to boys at 3 : 2, girls are 3 ÷ 5 = 60% and boys 40%.' },
      { q: 'Can a ratio have three parts?', a: 'Yes, such as 1 : 2 : 3 for a concrete mix, but this calculator takes two terms. For a three-way split, add the parts to 6 and give each 1/6, 2/6 and 3/6 of the total.' }
    ],
    checks: [
      { inputs: { a: 1, b: 50, c: 9 }, key: 'missingD', shown: '450 cm' },
      { inputs: { a: 48, b: 16 }, key: 'simplified', shown: '3 : 1' },
      { inputs: { a: 2, b: 7, total: 900 }, key: 'shareA', shown: '£200' },
      { inputs: { a: 2, b: 7, total: 900 }, key: 'shareB', shown: '£700' },
      { inputs: { a: 45, b: 60 }, key: 'simplified', shown: '3 : 4' },
      { inputs: { a: 3, b: 2 }, key: 'percentA', shown: '= 60%' },
      { inputs: { a: 3, b: 2 }, key: 'percentB', shown: 'boys 40%' }
    ]
  },

  '/mathematics/roman-numerals/': {
    whatTitle: 'What are Roman numerals?',
    whatIs: [
      'Roman numerals write numbers with seven letters, I, V, X, L, C, D and M, added together from left to right, largest first. A smaller symbol placed before a larger one is subtracted instead, so XL is 40 and CM is 900.',
      'They survive on clock faces, in book prefaces, in the names of monarchs and popes, and in the copyright year at the end of films and television programmes.'
    ],
    formula: {
      text: 'From a number, the converter takes the largest of thirteen values that fits, writes its symbol, subtracts and repeats. From a numeral, it adds each symbol’s value, or subtracts it when the next symbol is larger, then rewrites the total in standard form to test the spelling you typed.',
      expr: [
        'M = 1000, CM = 900, D = 500, CD = 400, C = 100, XC = 90',
        'L = 50, XL = 40, X = 10, IX = 9, V = 5, IV = 4, I = 1',
        'value = Σ (+ symbol, or − symbol when the next one is larger)'
      ],
      vars: [['I, V, X', '1, 5 and 10'], ['L, C', '50 and 100'], ['D, M', '500 and 1000']]
    },
    worked: {
      inputs: { value: '3888' },
      text: '3888 gives the longest numeral in the standard range: MMMDCCCLXXXVIII, fifteen characters. Each place takes its longest form, three Ms for 3000, D and three Cs for 800, L and three Xs for 80, then V and three Is for 8. By contrast, 1666 uses each of the seven symbols exactly once, in descending order: MDCLXVI.',
      check: [['result', 'MMMDCCCLXXXVIII']]
    },
    uses: [
      ['Monarchs and popes', 'Tell Henry VIII from Henry VII, or count the regnal numbers in a family tree.'],
      ['Engraving and tattoos', 'Check a date before it becomes permanent: 1999 is MCMXCIX.'],
      ['Outlines and legal documents', 'Clause and schedule numbers such as (xiv) are read the same way in lower case.']
    ],
    mistakes: [
      'Writing 499 as ID. Only I, X and C are subtracted, and only from the next two symbols up, so 499 is CDXCIX: 400, 90 and 9.',
      'Reading strictly left to right. In MCMXL the first C belongs to CM, 900, not to the M before it, so the numeral is 1940.'
    ],
    faq: [
      { q: 'How do you write 2026 in Roman numerals?', a: 'MMXXVI: MM for 2000, XX for 20 and VI for 6. The hundreds place is empty, and an empty place is simply left out.' },
      { q: 'What is the largest Roman numeral?', a: 'In standard notation, 3999, written MMMCMXCIX. Enter it here and the breakdown shows the pieces: M M M CM XC IX.' },
      { q: 'Can Roman numerals be written in lower case?', a: 'Yes. Lower case is the convention for a book’s preliminary pages and for list items, and the converter reads xiv and XIV alike as 14.' },
      { q: 'Will the converter accept IIII?', a: 'It reads it as 4 but flags that the standard spelling is IV. Any non-standard numeral gets the same treatment: its value, plus the form to use instead.' }
    ],
    checks: [
      { inputs: { value: '1666' }, key: 'result', shown: 'MDCLXVI' },
      { inputs: { value: '1999' }, key: 'result', shown: 'MCMXCIX' },
      { inputs: { value: '499' }, key: 'result', shown: 'CDXCIX' },
      { inputs: { value: 'MCMXL' }, key: 'decimal', shown: 'is 1940' },
      { inputs: { value: '2026' }, key: 'result', shown: 'MMXXVI' },
      { inputs: { value: '3999' }, key: 'result', shown: 'MMMCMXCIX' },
      { inputs: { value: '3999' }, key: 'breakdown', shown: 'M M M CM XC IX' },
      { inputs: { value: 'xiv' }, key: 'decimal', shown: 'as 14' },
      { inputs: { value: 'IIII' }, key: 'decimal', shown: 'as 4' }
    ]
  },

  '/mathematics/statistics/': {
    whatTitle: 'What do summary statistics tell you?',
    whatIs: [
      'Summary statistics describe a data set in a handful of numbers: where its centre is (mean, median, mode) and how spread out it is (range, standard deviation, variance, quartiles).',
      'Standard deviation is the usual measure of spread, roughly the typical distance of a value from the mean, in the same units as the data.'
    ],
    formula: {
      text: 'Variance is the average squared distance from the mean, and standard deviation is its square root. Quartiles are interpolated along the sorted list: Q1 sits at position (N − 1) × 0.25, counting the smallest value as position 0, and Q3 at (N − 1) × 0.75.',
      expr: [
        'mean x̄ = Σx ÷ N',
        'sample: s² = Σ(x − x̄)² ÷ (N − 1),  s = √s²',
        'population: σ² = Σ(x − x̄)² ÷ N,  σ = √σ²',
        'Qp = x₍ₖ₎ + (x₍ₖ₊₁₎ − x₍ₖ₎) × f,  where (N − 1) × p = k + f',
        'IQR = Q3 − Q1'
      ],
      vars: [['x', 'each value'], ['N', 'how many values there are'], ['p', '0.25 for Q1, 0.75 for Q3'], ['k, f', 'the whole and fractional parts of the position in the sorted list']]
    },
    worked: {
      inputs: { data: '4, 8, 6, 5, 3, 7, 9, 5, 6, 5' },
      text: 'Ten pupils score 4, 8, 6, 5, 3, 7, 9, 5, 6 and 5 out of 10 on a quiz. The mean is 5.8, the median 5.5 and the mode 5. The sample standard deviation is 1.8135 and the population one 1.7205; if these ten are the whole class, report the second. Q1 is 5 and Q3 is 6.75, so the middle half of the class sits within an IQR of 1.75 marks.',
      check: [['mean', '5.8'], ['median', '5.5'], ['sampSD', '1.8135'], ['popSD', '1.7205'], ['q3', '6.75'], ['iqr', '1.75 marks']]
    },
    uses: [
      ['Lab and fieldwork reports', 'Give a mean with its standard deviation, or a median with its IQR, as science mark schemes expect.'],
      ['Quality control', 'A machine filling 500 g bags is judged on the standard deviation of the weights as much as on their mean.'],
      ['Comparing groups', 'Two teams with similar average response times can differ widely in consistency.']
    ],
    mistakes: [
      'Pasting numbers with thousands separators. Commas separate values, so 1,250 is read as two numbers, 1 and 250; remove the separators first.',
      'Comparing quartiles from different methods. The rule here matches a spreadsheet’s QUARTILE.INC; QUARTILE.EXC or a textbook method can give a slightly different Q1 and Q3 for the same data.'
    ],
    faq: [
      { q: 'What is a good standard deviation?', a: 'There is no fixed good value; it only means something next to the mean and the units. The textbook set 2, 4, 4, 4, 5, 5, 7, 9 has a mean of 5 and a population SD of exactly 2, which is wide; the same 2 on a mean of 500 would be tiny.' },
      { q: 'How much does one outlier move the mean and standard deviation?', a: 'A lot. Commutes of 21, 23, 22, 24, 22 and 58 minutes have a mean of 28.33 but a median of 22.5, and a sample SD of 14.57; the IQR, 1.75, barely registers the 58.' },
      { q: 'Can I paste a column straight from a spreadsheet?', a: 'Yes. Values separated by new lines, spaces, commas or semicolons are all read, so a copied column or row works as it is.' }
    ],
    checks: [
      { inputs: { data: '2, 4, 4, 4, 5, 5, 7, 9' }, key: 'mean', shown: 'mean of 5' },
      { inputs: { data: '2, 4, 4, 4, 5, 5, 7, 9' }, key: 'popSD', shown: 'exactly 2' },
      { inputs: { data: '21, 23, 22, 24, 22, 58' }, key: 'mean', shown: '28.33' },
      { inputs: { data: '21, 23, 22, 24, 22, 58' }, key: 'median', shown: '22.5' },
      { inputs: { data: '21, 23, 22, 24, 22, 58' }, key: 'sampSD', shown: '14.57' },
      { inputs: { data: '21, 23, 22, 24, 22, 58' }, key: 'iqr', shown: 'IQR, 1.75' }
    ]
  }
};
