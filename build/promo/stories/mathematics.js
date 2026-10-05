'use strict';
/* Kit v2 story data: Mathematics. Contract: kit2-schema.md, sections 1 and 2.
   Calc inputs use the engine's own input keys (window.TOOLS[slug].inputs); every
   figure in a hook was checked by running that engine with these inputs. */
module.exports = {
  '/mathematics/percentage/': {
    persona: 'Shoppers, students and sellers',
    hook: '£80 down to £64. Is that really 20% off?',
    pain: 'The sign says “huge savings”. You want the real percentage before you believe it.',
    usual: ['Doing it twice on a phone calculator', 'Mixing up “% of” and “% change”', 'Calculator sites buried in adverts'],
    promise: 'Type two numbers. Get % of, % change and reverse % at once.',
    steps: ['Enter value A', 'Enter value B', 'Read the percentage you need'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { value: 80, total: 64 } },
    howTo: 'How to work out a percentage change',
    cta: 'Work out a percentage'
  },
  '/mathematics/quadratic-solver/': {
    persona: 'GCSE, A-level and physics students',
    hook: 'A ball thrown up at 20 m/s. When does it land?',
    pain: 'The physics question hides a quadratic: −4.9t² + 20t + 1.5 = 0. The formula has five places to slip.',
    usual: ['Sign errors in b² − 4ac', 'Calculators that stop at complex roots', 'Checking answers at the back of the book'],
    promise: 'Enter a, b and c. Get both roots, the vertex and the discriminant.',
    steps: ['Enter a', 'Enter b and c', 'Read the roots and vertex'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { a: -4.9, b: 20, c: 1.5 } },
    howTo: 'How to solve a quadratic equation',
    cta: 'Solve it'
  },
  '/mathematics/statistics/': {
    persona: 'Students, teachers and analysts',
    hook: 'Twelve test scores. What is the standard deviation?',
    pain: 'The coursework wants mean, median, SD and quartiles. Doing them by hand takes the whole lesson.',
    usual: ['Spreadsheet functions you half remember', 'Mixing up sample and population SD', 'Long tables of squared differences'],
    promise: 'Paste the numbers. Get mean, median, SD, quartiles and IQR.',
    steps: ['Paste your data', 'Read the summary', 'Read sample and population SD'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { data: '62, 71, 58, 90, 74, 66, 81, 77, 69, 95, 55, 72' } },
    howTo: 'How to find the standard deviation of data',
    cta: 'Run the stats'
  },
  '/mathematics/fraction-calculator/': {
    persona: 'Bakers, parents and pupils',
    hook: '¾ cup plus ⅔ cup. How much is that?',
    pain: 'Scaling the recipe means adding fractions with different bottoms. Homework night has the same problem.',
    usual: ['Turning everything into decimals', 'Forgetting to simplify at the end', 'Common denominators by trial and error'],
    promise: 'Enter two fractions. Get it simplified, as a mixed number and decimal.',
    steps: ['Enter the first fraction', 'Pick +, −, × or ÷', 'Read the simplified answer'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { n1: 3, d1: 4, op: '+', n2: 2, d2: 3 } },
    howTo: 'How to add fractions with different denominators',
    cta: 'Do the fractions'
  },
  '/mathematics/ratio-calculator/': {
    persona: 'Business partners, cooks and pupils',
    hook: 'Split £250 in the ratio 2:3. Who gets what?',
    pain: 'You both put in different amounts and the takings must be shared fairly. Nobody wants to do the maths.',
    usual: ['Rounding that leaves pennies over', 'Mixing up a ratio and a fraction', 'Arguing over the calculator'],
    promise: 'Enter the ratio. Simplify it, solve A:B = C:D or share a total.',
    steps: ['Enter A and B', 'Add C or a total', 'Read the shares'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { a: 2, b: 3, c: 10, total: 250 } },
    howTo: 'How to share an amount in a ratio',
    cta: 'Work out the ratio'
  },
  '/mathematics/average-calculator/': {
    persona: 'Students tracking module grades',
    hook: 'Marks of 68, 74, 59 and 81. Weighted, what is the average?',
    pain: 'Your modules carry different credits, so a plain average misleads you. You need the weighted figure.',
    usual: ['Plain averages that ignore weighting', 'A spreadsheet for four numbers', 'Doing Σw·x on paper'],
    promise: 'Enter numbers and weights. Get mean, median, mode and weighted mean.',
    steps: ['Enter the numbers', 'Add weights if any', 'Read every average'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { data: '68, 74, 59, 81', weights: '20, 30, 10, 40' } },
    howTo: 'How to work out a weighted average',
    cta: 'Find the average'
  },
  '/mathematics/prime-factorisation/': {
    persona: 'Pupils, teachers and puzzle fans',
    hook: 'Is 2027 a prime number? Find out in one go.',
    pain: 'The homework asks for the prime factors of a four-digit number. Trial division by hand is slow and error-prone.',
    usual: ['Factor trees that branch the wrong way', 'Missing a factor halfway through', 'Checking every divisor by hand'],
    promise: 'Enter a number. Get its prime factors, divisors and a prime check.',
    steps: ['Enter the number', 'Read the prime factors', 'See every divisor'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { n: 2027 } },
    howTo: 'How to find the prime factors of a number',
    cta: 'Factorise a number'
  },
  '/mathematics/lcm-gcd/': {
    persona: 'Pupils, teachers and planners',
    hook: 'Buses every 12, 18 and 30 minutes. When do all three meet?',
    pain: 'Three things repeat on different cycles and you need the next time they line up. That is an LCM question.',
    usual: ['Listing multiples until they match', 'Mixing up LCM and HCF', 'Long division for Euclid’s method'],
    promise: 'Enter the numbers. Get the LCM, the HCF and the simplest ratio.',
    steps: ['Enter the numbers', 'Read the LCM and HCF', 'Use the simplest ratio'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { nums: '12, 18, 30' } },
    howTo: 'How to find the LCM and HCF of numbers',
    cta: 'Find the LCM'
  },
  '/mathematics/geometry-calculator/': {
    persona: 'DIYers, gardeners and pupils',
    hook: 'A pot 30 cm across and 40 cm deep. How much compost?',
    pain: 'Compost is sold in litres. Your planter is a cylinder, and all you know is its size.',
    usual: ['Guessing and buying two extra bags', 'Formulas half remembered from school', 'Using the width instead of the radius'],
    promise: 'Pick the shape, enter the sizes, get area, surface and volume.',
    steps: ['Pick the shape', 'Enter the dimensions', 'Read the area and volume'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { shape: 'cylinder', a: 15, b: 40 } },
    howTo: 'How to work out the volume of a cylinder',
    cta: 'Work out the volume'
  },
  '/mathematics/roman-numerals/': {
    persona: 'Quiz fans, pupils and tattoo planners',
    hook: 'What year is MCMXCIV on the film credits?',
    pain: 'The end credits show the year in Roman numerals, and they are gone before you can work it out.',
    usual: ['Adding letters left to right, wrongly', 'Forgetting the IV and IX rules', 'A tattoo with the wrong date in it'],
    promise: 'Type a number or a numeral. Get the conversion and the breakdown.',
    steps: ['Type a number or numeral', 'Read the conversion', 'See it broken down'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { value: 'MCMXCIV' } },
    howTo: 'How to convert Roman numerals to numbers',
    cta: 'Convert a numeral'
  },
  '/mathematics/number-base-converter/': {
    persona: 'Developers, students and tinkerers',
    hook: 'What is FF5733 in binary? And in decimal?',
    pain: 'The colour code, the register value and the exam question are all in different bases. By hand it is slow.',
    usual: ['Dividing by 2 over and over', 'Programmer modes buried in menus', 'Dropping a digit in a long binary string'],
    promise: 'Enter a value in binary, octal, decimal, hex, base 32 or 36. Get all six.',
    steps: ['Enter the value', 'Pick the base it is in', 'Read every base'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { value: 'FF5733', from: '16' } },
    howTo: 'How to convert hex to binary and decimal',
    cta: 'Convert a number'
  },
  '/mathematics/scientific-calculator/': {
    persona: 'Students without their calculator',
    hook: 'Your scientific calculator is in a locker at school.',
    pain: 'Homework needs sin, log and powers, and the phone calculator hides them sideways.',
    usual: ['Phone calculators with hidden functions', 'Degree and radian mix-ups', 'Calculator sites full of pop-ups'],
    promise: 'Type the expression or tap the keys. Trig, logs, powers and roots.',
    steps: ['Type or tap the expression', 'Set degrees or radians', 'Read the result'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: {
      kind: 'schematic',
      input: 'An expression typed or tapped in',
      output: 'The result, with the angle mode shown beside it',
      sampleIn: 'sin(30) + log(100), in degrees',
      sampleOut: '2.5'
    },
    howTo: 'How to use a scientific calculator online',
    cta: 'Open the calculator'
  }
};
