'use strict';
/* Kit v2 story data: Health. Contract: kit2-schema.md, sections 1 and 2.
   Tone: neutral and curious, never weight-shaming. The pages say these are
   population estimates, not advice; nothing here claims more than that. */
module.exports = {
  '/health/bmi/': {
    persona: 'Anyone filling in a health form',
    hook: 'The form asks for your BMI. You only know your weight.',
    pain: 'A health questionnaire wants your BMI. You know your height and weight, but not the formula.',
    usual: ['Sites that turn a number into a sales pitch', 'Converting feet and pounds by hand', 'Apps that want your email for a result'],
    promise: 'Enter height and weight. Get your BMI and its standard category.',
    steps: ['Pick metric or imperial', 'Enter height and weight', 'Read your BMI'],
    proof: ['Free', 'No sign-up', 'Nothing uploaded'],
    example: { kind: 'calc', inputs: { system: 'metric', weight: 70, height: 175 } },
    howTo: 'How to calculate your BMI',
    cta: 'Check your BMI'
  },
  '/health/bmr-tdee/': {
    persona: 'People planning meals or training',
    hook: 'How many calories does your body use on a normal day?',
    pain: 'Every app gives you a different calorie number, and none of them says how it got there.',
    usual: ['Apps that hide the formula they use', 'Sign-ups before you see one number', 'Activity levels set far too high'],
    promise: 'Enter your details. Get BMR, daily energy use and a ±10% range.',
    steps: ['Enter weight, height and age', 'Pick an honest activity level', 'Read the estimate and range'],
    proof: ['Free', 'No sign-up', 'Nothing uploaded'],
    example: { kind: 'calc', inputs: { system: 'metric', weight: 82, height: 178, age: 34, sex: 'male', activity: '1.55' } },
    howTo: 'How to estimate your daily calorie use',
    cta: 'Estimate your energy'
  },
  '/health/body-fat/': {
    persona: 'Gym-goers tracking progress',
    hook: 'Got a tape measure? Estimate your body fat.',
    pain: 'The scale has not moved in a month, but your clothes fit differently. Weight alone is not telling the story.',
    usual: ['Smart scales that swing with water', 'Body scans you have to book', 'Guessing from the mirror'],
    promise: 'Enter neck, waist and height. Get an estimate with its likely range.',
    steps: ['Measure neck and waist', 'Enter them with your height', 'Read the estimate and range'],
    proof: ['Free', 'No sign-up', 'Nothing uploaded'],
    example: { kind: 'calc', inputs: { sex: 'male', system: 'metric', height: 175, neck: 38, waist: 85, weight: 70 } },
    howTo: 'How to estimate body fat with a tape measure',
    cta: 'Estimate body fat'
  },
  '/health/ideal-weight/': {
    persona: 'Anyone curious about weight ranges',
    hook: 'Four formulas, one height, four different answers.',
    pain: 'Search for an “ideal weight” and every site gives one confident number. They cannot all be right.',
    usual: ['One number presented as the truth', 'Formulas written for drug doses', 'Sites selling a plan with the answer'],
    promise: 'Enter your height. See the BMI range and four formulas side by side.',
    steps: ['Pick units and sex', 'Enter your height', 'Compare the ranges'],
    proof: ['Free', 'No sign-up', 'Nothing uploaded'],
    example: { kind: 'calc', inputs: { sex: 'female', system: 'metric', height: 165 } },
    howTo: 'How to find a reference weight range',
    cta: 'See the ranges'
  },
  '/health/water-intake/': {
    persona: 'Runners, hikers and office workers',
    hook: 'Eight glasses a day? Your number is probably different.',
    pain: 'You train in summer heat and drink when you remember. You want a rough daily figure that fits you.',
    usual: ['One rule of thumb for every body', 'Apps that nag you every hour', 'Forgetting that food and tea count'],
    promise: 'Enter weight, exercise and climate. Get a daily range in litres.',
    steps: ['Enter your weight', 'Add exercise and climate', 'Read the daily range'],
    proof: ['Free', 'No sign-up', 'Nothing uploaded'],
    example: { kind: 'calc', inputs: { system: 'metric', weight: 75, exercise: 45, climate: '1.15' } },
    howTo: 'How to estimate how much water to drink',
    cta: 'Estimate your water'
  },
  '/health/heart-rate-zones/': {
    persona: 'Runners, cyclists and gym-goers',
    hook: 'Zone 2 training. What is zone 2 for you, in bpm?',
    pain: 'The plan says “run in zone 2”. Your watch shows a number, but nobody told you your zones.',
    usual: ['220 minus age for everyone', 'Watches that guess your zones', 'Ignoring your resting heart rate'],
    promise: 'Enter your age and resting heart rate. Get five zones in bpm.',
    steps: ['Enter your age', 'Add your resting heart rate', 'Read your five zones'],
    proof: ['Free', 'No sign-up', 'Nothing uploaded'],
    example: { kind: 'calc', inputs: { age: 42, resting: 58, method: 'tanaka' } },
    howTo: 'How to work out your heart rate zones',
    cta: 'Find your zones'
  },
  '/health/pregnancy-due-date/': {
    persona: 'Expecting parents',
    hook: 'Last period on 20 August. When is the baby due?',
    pain: 'The test is positive and the first appointment is weeks away. You want a date to plan around.',
    usual: ['Counting weeks on a calendar', 'Apps that want your email first', 'Forgetting to allow for your cycle'],
    promise: 'Enter the first day of your last period. Get the estimated due date.',
    steps: ['Enter the date', 'Set your cycle length', 'Read the due date'],
    proof: ['Free', 'No sign-up', 'Nothing uploaded'],
    example: { kind: 'calc', inputs: { basis: 'lmp', date: '2026-08-20', cycle: 28, today: '2026-10-04' } },
    howTo: 'How to estimate a pregnancy due date',
    cta: 'Estimate the due date'
  },
  '/health/ovulation-calculator/': {
    persona: 'People trying to conceive',
    hook: 'Which days this month are your fertile window?',
    pain: 'You are trying for a baby and timing matters. Counting days on the calendar every month is tiring.',
    usual: ['Counting days on the calendar', 'Period apps that want an account', 'Assuming every cycle is 28 days'],
    promise: 'Enter your last period and cycle length. See the next three windows.',
    steps: ['Enter your last period', 'Set your cycle length', 'Read your fertile windows'],
    proof: ['Free', 'No sign-up', 'Nothing uploaded'],
    example: { kind: 'calc', inputs: { lastPeriod: '2026-09-20', cycle: 30, luteal: 14, cycles: 3 } },
    howTo: 'How to estimate your fertile window',
    cta: 'Find your window'
  }
};
