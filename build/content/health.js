/**
 * The reading part of the Health calculators, rendered by build-depth.js.
 * Shape and rules: build-depth.js and build/content/_check.js. Neutral and
 * educational, in the pages' own wording; where a page sends readers to a
 * clinician, so does this. Every figure is computed with the page's own
 * engine and listed in worked.check / checks.
 */
'use strict';

module.exports = {
  '/health/bmi/': {
    term: 'BMI',
    whatIs: [
      'Body mass index is your weight in kilograms divided by the square of your height in metres. The statistician Adolphe Quetelet devised it in the 1830s to describe populations, and it is still used that way: as a quick screening number that flags when weight may be worth a closer look.',
      'It says nothing about where fat is carried or how much of your weight is muscle, so the same BMI can mean quite different things for two people of the same height.'
    ],
    formula: {
      text: 'Height is squared, so it moves the result more than weight does. In imperial mode the calculator first converts pounds to kilograms and inches to metres, then applies the same formula.',
      expr: ['BMI = weight (kg) ÷ height (m)²', 'imperial: BMI = (lb × 0.45359237) ÷ (in × 0.0254)²'],
      vars: [['kg', 'weight in kilograms'], ['m', 'height in metres: 175 cm is 1.75 m']]
    },
    worked: {
      inputs: { system: 'imperial', weight: 154, height: 66 },
      text: 'Someone 5 ft 6 in (66 inches) tall who weighs 11 stone (154 lb) chooses imperial and enters 154 and 66. That is 69.85 kg and 1.6764 m, a BMI of 24.9: within the healthy range. The range ends at 25, so about 0.4 kg more would move the same person into the next band: the boundaries are lines on a continuous scale.',
      check: [['bmi', '24.9'], ['category', 'within the healthy range']]
    },
    uses: [
      ['Forms that ask for it', 'GP registration, insurance and gym inductions often ask for BMI.'],
      ['Following a trend', 'A reading every few months shows the direction, which says more than one figure.'],
      ['Before an appointment', 'Have the number ready when a nurse or doctor asks.']
    ],
    mistakes: [
      'Typing height in metres in metric mode. The box expects centimetres, so 1.75 m goes in as 175.',
      'Reading BMI as body fat. Two people with a BMI of 27 can carry very different amounts of fat and muscle; waist size and body composition say more.',
      'Using adult ranges for children. Under-18s are assessed on age- and sex-specific growth charts, not the adult cut-offs used here.'
    ],
    faq: [
      { q: 'What is a healthy BMI for adults?', a: 'For most adults the NHS and the World Health Organization use 18.5 to 24.9; this calculator calls 25 to 30 above that range and 30 or more well above it. Lower thresholds are often used for people of South Asian, Chinese, Black African or African-Caribbean background, so ask a GP how they apply to you.' },
      { q: 'How do I calculate BMI in pounds and inches?', a: 'Multiply your weight in pounds by 703 and divide by your height in inches squared. For 180 lb at 70 inches that is 180 × 703 ÷ 4,900, a BMI of 25.8; the imperial setting here gives the same answer.' },
      { q: 'Is BMI different for men and women?', a: 'The formula and the adult cut-offs are the same for both. At the same BMI, women on average carry more body fat than men, one reason it is a screening figure, not a diagnosis.' }
    ],
    checks: [
      { inputs: { system: 'imperial', weight: 180, height: 70 }, key: 'bmi', shown: '25.8' }
    ]
  },

  '/health/bmr-tdee/': {
    whatTitle: 'What are BMR and TDEE?',
    whatIs: [
      'Basal metabolic rate (BMR) is the energy your body would use in a day at complete rest: breathing, circulation, keeping warm and running the organs. Total daily energy expenditure (TDEE) adds everything you do on top of that.',
      'Both are measured in kilocalories, the “calories” printed on food labels. They describe energy use, which is a separate question from what anyone ought to eat.'
    ],
    formula: {
      text: 'The Mifflin-St Jeor equation, published in 1990, estimates BMR from weight, height and age, then adds a constant that differs by sex. TDEE is BMR multiplied by an activity factor between 1.2 and 1.9, and the page shows a band 10% either side of it.',
      expr: ['BMR = 10 × kg + 6.25 × cm − 5 × age + 5   (male)', 'BMR = 10 × kg + 6.25 × cm − 5 × age − 161   (female)', 'TDEE = BMR × activity factor        range = TDEE × 0.9 to TDEE × 1.1'],
      vars: [['kg', 'weight in kilograms; pounds are multiplied by 0.45359237 first'], ['cm', 'height in centimetres; inches are multiplied by 2.54'], ['age', 'age in years'], ['activity factor', '1.2 sedentary, 1.375 light, 1.55 moderate, 1.725 very active, 1.9 extremely active']]
    },
    worked: {
      inputs: { system: 'metric', weight: 62, height: 165, age: 45, sex: 'female', activity: '1.2' },
      text: 'A 45-year-old woman weighs 62 kg, stands 165 cm tall and works at a desk with little exercise. Her BMR is 620 + 1,031.25 − 225 − 161, about 1,265 kcal. Sedentary multiplies that by 1.2, giving roughly 1,518 kcal a day and a realistic band of 1366 – 1670 kcal; only 253 kcal of it is put down to activity. Choosing moderately active instead lifts the estimate to 1,961 kcal, which shows how much rests on that one menu.',
      check: [['bmr', '1,265'], ['tdee', '1,518'], ['range', '1366 – 1670 kcal'], ['activityBurn', '253']]
    },
    uses: [
      ['Comparing app figures', 'See which equation and activity factor could sit behind the number a fitness app shows you.'],
      ['Seeing a dietitian', 'Bring your measurements and the estimate as a starting point for the conversation, not as a plan.'],
      ['After your weight changes', 'Weight enters the equation directly, so rerun it once the scale has moved by a few kilograms.']
    ],
    mistakes: [
      'Entering height in metres or in feet. Metric mode wants centimetres and imperial wants total inches, so 5 ft 6 in goes in as 66.',
      'Counting exercise twice: picking a high activity level and then adding the calories a watch reports for each workout. The factor already includes typical training.'
    ],
    faq: [
      { q: 'What is the difference between BMR and RMR?', a: 'BMR is measured under strict conditions: after a night’s sleep, fasted, lying still in a warm room. Resting metabolic rate (RMR) is taken under looser conditions and usually comes out slightly higher. In everyday use the two terms are treated as the same thing.' },
      { q: 'How much does age change BMR?', a: 'In this equation, exactly 5 kcal a day for every year, whatever your size. Ten years therefore take 50 kcal off the estimate, which is small next to the effect of the activity factor.' },
      { q: 'How do I convert kcal to kilojoules?', a: 'Multiply by 4.184. UK and EU food labels show both, and 1,500 kcal is 6,276 kJ.' }
    ],
    checks: [
      { inputs: { system: 'metric', weight: 62, height: 165, age: 45, sex: 'female', activity: '1.55' }, key: 'tdee', shown: '1,961' }
    ],
    related: { conversions: ['/conversions/energy/kilocalorie-to-kilojoule/', '/conversions/mass/pound-to-kilogram/'] }
  },

  '/health/body-fat/': {
    term: 'body fat percentage',
    whatIs: [
      'Body fat percentage is the share of your total weight that is fat tissue rather than muscle, bone, organs and water.',
      'Unlike BMI it separates fat from lean mass, so it can change while the scale stays put. Clinics measure it with DEXA scans or underwater weighing; this page estimates it from a tape measure.'
    ],
    formula: {
      text: 'The US Navy method, published by Hodgdon and Beckett in 1984, predicts body density from the logarithms of circumferences and height, then turns density into a fat percentage with the Siri equation. The version for women adds the hip measurement. Imperial inputs are converted to centimetres before anything else.',
      expr: ['men: % fat = 495 ÷ (1.0324 − 0.19077 × log₁₀(waist − neck) + 0.15456 × log₁₀(height)) − 450', 'women: % fat = 495 ÷ (1.29579 − 0.35004 × log₁₀(waist + hip − neck) + 0.22100 × log₁₀(height)) − 450', 'fat mass = weight × % fat ÷ 100        lean mass = weight − fat mass'],
      vars: [['waist', 'circumference at the navel, in cm'], ['neck', 'circumference just below the larynx, in cm'], ['hip', 'circumference at the widest point, in cm (women only)'], ['height', 'standing height, in cm']]
    },
    worked: {
      inputs: { sex: 'female', system: 'metric', height: 165, neck: 33, waist: 76, hip: 98, weight: 64 },
      text: 'A woman 165 cm tall measures 33 cm at the neck, 76 cm at the navel and 98 cm at the hips, and weighs 64 kg. The female formula gives an estimate of 28.9%, with a likely range of 25.4% – 32.4%. On 64 kg that is about 18.5 kg of fat mass and 45.5 kg of lean mass. Her waist-to-height ratio is 0.46, from two of the same measurements.',
      check: [['bodyFat', '28.9%'], ['range', '25.4% – 32.4%'], ['fatMass', '18.5'], ['leanMass', '45.5'], ['waistHeight', '0.46']]
    },
    uses: [
      ['Tracking a cut or a build', 'Measure monthly and see whether fat mass or lean mass is the one moving.'],
      ['Reading it beside BMI', 'A BMI above the healthy range with a modest fat estimate often points to muscle rather than fat.'],
      ['Keeping an eye on waist size', 'The waist-to-height ratio comes with every result at no extra effort.']
    ],
    mistakes: [
      'Measuring the waist at the trouser line. The formula was fitted to a measurement at the navel, and a point higher or lower shifts the result by several points.',
      'Reading the waist while holding your breath in. Breathe out normally and take the reading at the end of the out-breath.'
    ],
    faq: [
      { q: 'Why does the female formula need a hip measurement?', a: 'Women tend to store more fat around the hips and thighs, so waist and neck alone miss much of it. The 1984 study fitted a separate equation for each sex, and the one for women uses waist plus hip minus neck.' },
      { q: 'Can body fat go down while weight stays the same?', a: 'Yes. If lean mass rises by about as much as fat mass falls, the scale barely moves while the tape does. Entering a weight shows both masses, so the shift is visible across successive readings.' },
      { q: 'What is a good waist-to-height ratio?', a: 'The usual guidance is a waist under half your height, a ratio below 0.5. For someone 165 cm tall that means a waist under 82.5 cm.' }
    ],
    related: { conversions: ['/conversions/length/inch-to-centimeter/', '/conversions/mass/pound-to-kilogram/'] }
  },

  '/health/heart-rate-zones/': {
    whatTitle: 'What are heart rate zones?',
    whatIs: [
      'Heart rate zones are five bands of intensity, each a slice of your heart’s working range, from very light recovery work to all-out efforts. Training plans use them so that “easy” and “hard” mean the same thing to every reader.',
      'The bands are anchored to an estimated maximum heart rate, worked out here from your age, and optionally to your resting heart rate.'
    ],
    formula: {
      text: 'Maximum heart rate is estimated first, with Tanaka’s equation or the older 220 − age rule. Without a resting rate, each zone is a plain percentage of that maximum in ten-point steps from 50% to 100%. With one, the Karvonen method takes the same percentages of the reserve (maximum minus resting) and adds the resting rate back on.',
      expr: ['HRmax = 208 − 0.7 × age   (Tanaka)      or      220 − age   (classic)', 'percentage of maximum: zone limit = HRmax × %', 'Karvonen: zone limit = (HRmax − HRrest) × % + HRrest', 'zone 1 = 50–60%, 2 = 60–70%, 3 = 70–80%, 4 = 80–90%, 5 = 90–100%'],
      vars: [['HRmax', 'estimated maximum heart rate, in bpm'], ['HRrest', 'resting heart rate, in bpm, measured on waking'], ['%', 'the lower and upper limit of each zone']]
    },
    worked: {
      inputs: { age: 50, resting: 0, method: 'tanaka' },
      text: 'A 50-year-old cyclist leaves the resting rate at 0 and keeps the Tanaka method. Maximum heart rate comes out at 208 − 35 = 173 bpm, and the zones are plain percentages of it: zone 2, the endurance base, is 104 – 121 bpm. Adding a waking pulse of 65 bpm switches to Karvonen. The reserve is 108 bpm and zone 2 moves up to 130 – 141 bpm, because every band is now built on top of the resting rate.',
      check: [['hrMax', '173'], ['zone2', '104 – 121 bpm']]
    },
    uses: [
      ['Zone 2 base training', 'Find the bpm range a plan means when it asks for long, easy sessions.'],
      ['Interval sessions', 'Know the zone 4 and zone 5 numbers before a threshold or interval workout.'],
      ['Following fitness over a season', 'A resting rate that falls over months shifts the Karvonen zones, so rerun it each season.']
    ],
    mistakes: [
      'Mixing methods between devices. A watch using 220 − age and this page using Tanaka disagree at most ages: at 50 the two maxima are 170 and 173 bpm.',
      'Treating the zone edges as exact. Heart rate lags effort by a minute or more, so judge a zone over a steady few minutes.'
    ],
    faq: [
      { q: 'What heart rate is zone 2?', a: 'Between 60% and 70% of your working range. On the percentage-of-maximum method that is 112 – 131 bpm at age 30; with a resting rate, Karvonen puts it higher.' },
      { q: 'What is heart rate reserve?', a: 'The gap between your maximum and resting heart rate: the beats available for exercise. It widens as resting rate falls with fitness, which is why the Karvonen zones respond to training and the plain percentages do not.' },
      { q: 'Does maximum heart rate fall with age?', a: 'On average, yes: by 0.7 bpm a year in the Tanaka equation and 1 bpm a year in the classic rule.' }
    ],
    checks: [
      { inputs: { age: 50, resting: 65, method: 'tanaka' }, key: 'reserve', shown: '108' },
      { inputs: { age: 50, resting: 65, method: 'tanaka' }, key: 'zone2', shown: '130 – 141 bpm' },
      { inputs: { age: 50, resting: 0, method: 'classic' }, key: 'hrMax', shown: '170' },
      { inputs: { age: 30, resting: 0, method: 'tanaka' }, key: 'zone2', shown: '112 – 131 bpm' }
    ]
  },

  '/health/ideal-weight/': {
    whatTitle: 'What is a reference weight range?',
    whatIs: [
      'A reference weight range is the band of weights that a formula or the BMI scale associates with a given height. The page calls it a reference rather than an ideal because no formula knows your build, age or health.',
      'The four named formulas date from 1964 to 1983; the BMI band comes from population studies.'
    ],
    formula: {
      text: 'Each formula starts from a base weight at exactly 5 ft (152.4 cm), different for men and women, and adds a fixed amount per inch above that. Below 5 ft nothing is subtracted, so every result there is the base weight. The BMI range solves the BMI formula backwards for 18.5 and 24.9.',
      expr: ['inches over 5 ft = (height in cm − 152.4) ÷ 2.54', 'Devine: 50 kg (men) or 45.5 kg (women) + 2.3 kg per inch', 'Robinson: 52 or 49 kg + 1.9 kg per inch', 'Miller: 56.2 or 53.1 kg + 1.41 kg per inch', 'Hamwi: 48 or 45.5 kg + 2.7 kg per inch', 'BMI range = 18.5 × m² to 24.9 × m²'],
      vars: [['m', 'height in metres'], ['inches over 5 ft', 'zero for anyone 152.4 cm or shorter']]
    },
    worked: {
      inputs: { sex: 'male', system: 'imperial', height: 70 },
      text: 'A man 5 ft 10 in tall enters 70 inches. That is exactly 10 inches over five feet, so the formulas are easy to follow by hand: Devine gives 73 kg, Robinson 71 kg, Miller 70.3 kg and Hamwi 75 kg. Their average is 72.3 kg and they disagree by 4.7 kg. The BMI range for the same height is far wider, 58.5 – 78.7 kg, a span of 20.2 kg that holds all four formula results.',
      check: [['devine', '73 kg'], ['miller', '70.3'], ['hamwi', '75 kg'], ['formulaAverage', '72.3'], ['spread', '4.7'], ['bmiRange', '58.5 – 78.7 kg']]
    },
    uses: [
      ['Before a clinic visit', 'See the figures a nurse or doctor may mention and where each comes from.'],
      ['Decoding a single “ideal” figure', 'Work out which formula a website used when it quotes one number.'],
      ['Heights under five feet', 'See why the formulas flatten out below 152.4 cm while the BMI range keeps shrinking.']
    ],
    mistakes: [
      'Entering feet and inches as a decimal. 5 ft 10 in is 70 inches, not 5.10; in metric mode it is 177.8 cm.',
      'Reading the BMI band for someone under 18. The 18.5 to 24.9 limits are adult ones; children and teenagers are assessed against growth charts.'
    ],
    faq: [
      { q: 'What should I weigh for my height?', a: 'There is no single answer. At 5 ft 10 in the four formulas run from 70.3 kg to 75 kg and the BMI band from 58.5 to 78.7 kg; where you sit within that depends on build and history, which a GP can weigh up.' },
      { q: 'How do I convert the result to stone?', a: 'Divide the kilograms by 6.35029318, the number of kilograms in a stone. 73 kg is about 11 st 7 lb; the kilogram-to-stone converter does the arithmetic.' },
      { q: 'Why do the formulas stop at five feet?', a: 'They were written as a base weight at 5 ft plus an amount per inch, with nothing subtracted below it. At 150 cm each one returns its base, for a woman 45.5 kg to 53.1 kg, while the BMI band keeps falling with height.' }
    ],
    checks: [
      { inputs: { sex: 'female', system: 'metric', height: 150 }, key: 'devine', shown: '45.5' },
      { inputs: { sex: 'female', system: 'metric', height: 150 }, key: 'miller', shown: '53.1' }
    ],
    related: { conversions: ['/conversions/mass/kilogram-to-stone/', '/conversions/mass/kilogram-to-pound/', '/conversions/length/foot-to-centimeter/'] }
  },

  '/health/ovulation-calculator/': {
    term: 'the fertile window',
    whatIs: [
      'The fertile window is the stretch of each menstrual cycle in which sex can lead to pregnancy: the five days before ovulation, the day of ovulation and the day after.',
      'A calendar estimate works backwards from when the next period is due, so it is only as good as the regularity of your cycles.'
    ],
    formula: {
      text: 'The next period is the first day of the last one plus your average cycle length. Ovulation is placed one luteal phase before that, 14 days unless you change it, and the window runs from five days before ovulation to one day after.',
      expr: ['next period = first day of last period + cycle length', 'ovulation = next period − luteal phase', 'fertile window = ovulation − 5 days  to  ovulation + 1 day'],
      vars: [['cycle length', 'days from the first day of one period to the first day of the next; 20 to 45 accepted'], ['luteal phase', 'days from ovulation to the next period; 9 to 17 accepted, 14 by default']]
    },
    worked: {
      inputs: { lastPeriod: '2027-01-11', cycle: 32, luteal: 12, cycles: 3 },
      text: 'A period starts on Monday 11 January 2027. Cycles average 32 days and tracking has shown a 12-day luteal phase. The next period is expected on Fri, 12 Feb 2027, so ovulation is estimated for Sun, 31 Jan 2027, day 21 of the cycle. The fertile window is Tue, 26 Jan 2027 to Mon, 1 Feb 2027. The table carries the pattern forward: the second cycle starts on 12 February, with ovulation estimated on Thu 4 Mar 2027.',
      check: [['nextPeriod', 'Fri, 12 Feb 2027'], ['ovulation', 'Sun, 31 Jan 2027'], ['fertileWindow', 'Tue, 26 Jan 2027 to Mon, 1 Feb 2027'], ['_table.rows.1.2', 'Thu 4 Mar 2027']]
    },
    uses: [
      ['Timing ovulation tests', 'Start urine LH tests a few days before the estimated date instead of guessing when to begin.'],
      ['Before a GP appointment', 'Have several cycles’ start dates and lengths ready when discussing fertility.'],
      ['Checking a period app', 'Compare its predicted dates with the arithmetic behind them.']
    ],
    mistakes: [
      'Counting the cycle from the last day of bleeding. Day 1 is the first day of full flow, and the cycle runs to the day before the next one starts.',
      'Leaving the luteal phase at 14 when tracking says otherwise. With the same 32-day cycle, the default places ovulation on Fri, 29 Jan 2027, two days earlier.'
    ],
    faq: [
      { q: 'How many days after my period starts do I ovulate?', a: 'That depends on cycle length, not on how long bleeding lasts. Ovulation falls about one luteal phase before the next period: day 15 of a 28-day cycle with a 14-day luteal phase, and day 21 of a 34-day cycle.' },
      { q: 'Does an irregular cycle make the estimate useless?', a: 'Less useful rather than useless. If cycles vary from 26 to 34 days, ovulation could fall anywhere across about eight days, so tests or temperature tracking become the main guide and the dates a rough outline.' },
      { q: 'How far ahead can the table go?', a: 'Up to 12 cycles. Each row adds one average cycle length to the previous one, so any error builds up and the later rows are the least reliable.' }
    ],
    checks: [
      { inputs: { lastPeriod: '2027-01-11', cycle: 32, luteal: 14, cycles: 3 }, key: 'ovulation', shown: 'Fri, 29 Jan 2027' }
    ]
  },

  '/health/pregnancy-due-date/': {
    whatTitle: 'What is an estimated due date?',
    whatIs: [
      'The estimated due date is the day a pregnancy reaches 40 weeks, counted from the first day of the last menstrual period (LMP). It is a midpoint, not a deadline: the full-term window shown here runs from 39 to 41 weeks.',
      'A midwife or doctor confirms the dating, usually from a first-trimester scan.'
    ],
    formula: {
      text: 'Naegele’s rule adds 280 days, or 40 weeks, to the first day of the last period. From a known conception date the tool first steps back 14 days to an equivalent LMP; from an IVF transfer it steps back 14 days plus the embryo’s age at transfer.',
      expr: ['due date = LMP + 280 days', 'from conception: LMP = conception − 14 days', 'from IVF: LMP = transfer date − (14 + embryo age in days)', 'full term = LMP + 273 days  to  LMP + 287 days'],
      vars: [['LMP', 'first day of the last menstrual period'], ['embryo age', '3, 5 or 6 days at transfer']]
    },
    worked: {
      inputs: { basis: 'ivf', date: '2027-03-10', ivfDay: '5', today: '2027-05-03' },
      text: 'A day-5 embryo is transferred on 10 March 2027. The tool steps back 19 days to an equivalent LMP of 19 February, so the estimated due date is Friday, 26 November 2027 and conception is dated to Friday, 5 March 2027. With today set to 3 May 2027 the pregnancy is 10 weeks and 3 days, in the first trimester, with 207 days to go. Full term runs from Friday, 19 November 2027 to Friday, 3 December 2027.',
      check: [['dueDate', 'Friday, 26 November 2027'], ['conception', 'Friday, 5 March 2027'], ['gestational', '10 weeks and 3 days'], ['daysRemaining', '207'], ['fullTermFrom', 'Friday, 19 November 2027'], ['fullTermTo', 'Friday, 3 December 2027']]
    },
    uses: [
      ['Planning leave', 'Work out roughly when maternity or paternity leave might start before the formal paperwork arrives.'],
      ['IVF pregnancies', 'Date the pregnancy from the transfer and the embryo’s age, which is more precise than a period date.'],
      ['Booking ahead', 'Change the today’s-date field to see which week of pregnancy a date in your diary falls in.']
    ],
    mistakes: [
      'Entering the day bleeding ended, or a day of spotting, as the LMP. Use the first day of proper flow.',
      'Entering an IVF transfer date with the LMP option still selected. For a day-5 transfer that puts the due date 19 days too late; choose IVF transfer and the embryo’s age.'
    ],
    faq: [
      { q: 'How many weeks pregnant am I?', a: 'Count whole weeks and days from the first day of your last period. With an LMP of 4 January 2027, on 1 March 2027 that is 8 weeks and 0 days; set the today’s-date field to see any other day.' },
      { q: 'What is the difference between a day-3 and a day-5 transfer?', a: 'Only the embryo’s age when it was transferred. A day-5 blastocyst is two days further on, so for the same transfer date its due date is two days earlier.' },
      { q: 'Is a due date the same as nine months?', a: 'Roughly. 280 days is nine calendar months and about a week, which is why the quick method is to add a year, take away three months and add seven days: an LMP of 4 January 2027 gives Monday, 11 October 2027.' }
    ],
    checks: [
      { inputs: { basis: 'lmp', date: '2027-01-04', cycle: 28, today: '2027-03-01' }, key: 'gestational', shown: '8 weeks and 0 days' },
      { inputs: { basis: 'lmp', date: '2027-01-04', cycle: 28, today: '2027-03-01' }, key: 'dueDate', shown: 'Monday, 11 October 2027' }
    ]
  },

  '/health/water-intake/': {
    term: 'daily water intake',
    whatIs: [
      'Daily water intake is all the fluid your body takes in over a day: water, tea, coffee, milk, soup and the water inside food. The body loses a similar amount through urine, sweat, breath and stools, and needs it replaced.',
      'How much that comes to depends mostly on body size, how much you sweat and the temperature around you.'
    ],
    formula: {
      text: 'The estimate starts at 33 ml for each kilogram of body weight, adds 350 ml for every 30 minutes of exercise, then multiplies the sum by 1 for a temperate climate, 1.15 for warm or 1.3 for hot or humid. The range is 15% either side, and the total is split 80:20 between drinks and food.',
      expr: ['base = weight (kg) × 33 ml', 'exercise = minutes ÷ 30 × 350 ml', 'total = (base + exercise) × climate factor', 'range = total × 0.85  to  total × 1.15'],
      vars: [['weight', 'in kilograms; pounds are multiplied by 0.45359237'], ['minutes', 'exercise per day, capped at 600'], ['climate factor', '1, 1.15 or 1.3']]
    },
    worked: {
      inputs: { system: 'imperial', weight: 180, exercise: 60, climate: '1.3' },
      text: 'Someone weighing 180 lb (81.6 kg) trains for an hour a day through a hot, humid summer. The base is about 2.69 litres, exercise adds 0.7 litres, and the hot-climate factor of 1.3 brings the total to 4.41 litres, with a range of 3.75 to 5.07 litres. About 3.53 litres of that would usually come from drinks, roughly 17.7 glasses of 250 ml. On a rest day in mild weather the same person’s figure falls to about 2.69 litres.',
      check: [['litres', '4.41'], ['low', '3.75'], ['high', '5.07'], ['fromDrinks', '3.53'], ['glasses', '17.7']]
    },
    uses: [
      ['Hot-weather training', 'Plan how much to carry on a long run or ride in summer.'],
      ['Travelling somewhere hot', 'See how the figure moves from temperate to hot before a trip.'],
      ['Sizing a water bottle', 'Divide the drinks figure by your bottle’s capacity to see roughly how many refills a day means.']
    ],
    mistakes: [
      'Trying to drink the whole total. About a fifth normally comes from food, so compare what you pour with the drinks figure, not the total.',
      'Leaving the hot setting on all year. Choose the climate for the day in question; the factor alone adds 30% to the estimate.'
    ],
    faq: [
      { q: 'How many litres of water should I drink a day?', a: 'For a 60 kg adult with no exercise in a temperate climate this method gives about 1.98 litres in total, roughly 1.58 litres of it from drinks. Larger bodies, exercise and heat all raise it.' },
      { q: 'How many pints is that?', a: 'The tool converts to UK pints of 568.26 ml. Its default of 70 kg with 30 minutes of exercise in a temperate climate gives 2.66 litres, about 4.7 pints.' },
      { q: 'Do I need more water when I am ill?', a: 'Fever, vomiting and diarrhoea all raise fluid losses, and this estimate does not allow for them. For anything beyond a mild illness, or for a child or an older relative, ask a pharmacist or GP.' }
    ],
    checks: [
      { inputs: { system: 'imperial', weight: 180, exercise: 0, climate: '1' }, key: 'litres', shown: '2.69' },
      { inputs: { system: 'metric', weight: 60, exercise: 0, climate: '1' }, key: 'litres', shown: '1.98' },
      { inputs: { system: 'metric', weight: 60, exercise: 0, climate: '1' }, key: 'fromDrinks', shown: '1.58' },
      { inputs: { system: 'metric', weight: 70, exercise: 30, climate: '1' }, key: 'litres', shown: '2.66' },
      { inputs: { system: 'metric', weight: 70, exercise: 30, climate: '1' }, key: 'pints', shown: '4.7' }
    ],
    related: { conversions: ['/conversions/volume/liter-to-fluid-ounce-us/', '/conversions/volume/liter-to-milliliter/', '/conversions/mass/pound-to-kilogram/'] }
  }
};
