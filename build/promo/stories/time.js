'use strict';
/* Kit v2 story data: Time & Dates. Contract: kit2-schema.md, sections 1 and 2.
   Calc examples pin every date (no TODAY) so a capture next year shows the same
   figures; the three live widgets have no engine spec and get a schematic. */
module.exports = {
  '/time/date-difference/': {
    persona: 'Planners, HR teams and the curious',
    hook: 'Days to the deadline, minus the weekends?',
    pain: 'You need the exact span between two dates for a report, and months of 28 to 31 days make it fiddly.',
    usual: ['Counting squares on a wall calendar', 'Assuming every month has 30 days', 'Spreadsheet date formulas that misfire'],
    promise: 'Pick two dates. Get years, months, days, weekdays and totals, and the business days under a UK, India or US holiday calendar.',
    steps: ['Pick the start date', 'Pick the end date', 'Read the difference'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { start: '2026-10-05', end: '2026-12-18' } },
    howTo: 'How to count the days between two dates',
    cta: 'Count the days'
  },
  '/time/age-calculator/': {
    persona: 'Form-fillers, parents and HR',
    hook: 'Exactly how old are you, down to the day?',
    pain: 'The form asks for age on a set date, not today. A day out can mean the wrong school year or category.',
    usual: ['Mental arithmetic with leap years', 'Forgetting the cut-off date', 'Spreadsheet formulas that round'],
    promise: 'Enter a birth date. Get exact age, days lived and next birthday, for one person or a list of them.',
    steps: ['Enter the birth date', 'Set the “age at” date', 'Read the exact age'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { dob: '1990-06-15', on: '2026-10-04' } },
    howTo: 'How to work out an exact age',
    cta: 'Work out an age'
  },
  '/time/date-add-subtract/': {
    persona: 'Anyone with a deadline in days',
    hook: 'The letter says 90 days. What date is that?',
    pain: 'The letter gives you 90 days to reply. Counting forward across three months invites a mistake.',
    usual: ['Counting forward on a wall calendar', 'Month ends that roll over wrongly', 'Missing which weekday it lands on'],
    promise: 'Pick a date, then add or take away days, weeks, months or years.',
    steps: ['Pick the start date', 'Add or subtract the period', 'Read the new date'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { start: '2026-10-04', dir: 'add', years: 0, months: 0, weeks: 0, days: 90 } },
    howTo: 'How to add days to a date',
    cta: 'Add to a date'
  },
  '/time/week-number/': {
    persona: 'Office teams and planners',
    hook: 'What week number is it today, by ISO rules?',
    pain: 'The planner uses ISO week numbers and your spreadsheet counts weeks the US way. Someone is a week out.',
    usual: ['Counting weeks from 1 January', 'Spreadsheets on the US week rule', 'Forgetting that some years have week 53'],
    promise: 'Pick a date. Get its ISO or US week, the week’s dates, the quarter and the whole year’s weeks.',
    steps: ['Pick the date', 'Read the ISO week', 'See the week’s date range'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { date: '2026-10-04' } },
    howTo: 'How to find the ISO week number of a date',
    cta: 'Find the week'
  },
  '/time/business-days/': {
    persona: 'HR, payroll and project managers',
    hook: 'Ten working days from 18 December, round Christmas?',
    pain: 'The contract says “within 10 business days”. With weekends and bank holidays in the way, the date is unclear.',
    usual: ['Counting weekdays on a calendar', 'Forgetting the bank holidays', 'Arguing over whether day one counts'],
    promise: 'Pick the dates and a UK, India or US holiday calendar, or list your own. Get working days or the end date.',
    steps: ['Pick the start date', 'Choose a holiday calendar', 'Read the working days'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { start: '2026-12-18', mode: 'add', add: 10, holidays: '2026-12-25, 2026-12-28, 2027-01-01' } },
    howTo: 'How to count working days between dates',
    cta: 'Count working days'
  },
  '/time/timezone-converter/': {
    persona: 'Remote teams and families abroad',
    hook: '3 pm in London is what time in Sydney next month?',
    pain: 'You are booking a call across three countries, and one of them changes its clocks next week.',
    usual: ['Doing hour sums in your head', 'Forgetting the daylight-saving switch', 'Zone codes like CST that mean three things'],
    promise: 'Pick a time and add the cities. See every local time and the hours you share, with clock changes flagged.',
    steps: ['Pick the date and time', 'Add the cities', 'Read the hours you share'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: {
      kind: 'schematic',
      input: 'A date, a time and a city',
      output: 'The same moment in other cities, DST included',
      sampleIn: '15:00 in London on 2 November 2026',
      sampleOut: '10:00 in New York · 02:00 on 3 November in Sydney'
    },
    howTo: 'How to convert a time between time zones',
    cta: 'Convert a time'
  },
  '/time/countdown-timer/': {
    persona: 'Anyone counting down to a big day',
    hook: 'How many sleeps until the holiday? Put it on screen.',
    pain: 'The launch, the wedding, the exam: you keep working out how long is left, and it changes every time.',
    usual: ['Working it out again every morning', 'Countdown apps that want an account', 'Widgets full of adverts'],
    promise: 'Pick the date, time and zone. Watch it count, full screen if you like, and hear it reach zero.',
    steps: ['Pick the date and time', 'Choose a sound or a notification', 'Leave it running, or share the link'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: {
      kind: 'schematic',
      input: 'A date and a time',
      output: 'A live countdown in days, hours, minutes, seconds'
    },
    howTo: 'How to set up a countdown to a date',
    cta: 'Start a countdown'
  },
  '/time/stopwatch-timer/': {
    persona: 'Students, coaches and focused workers',
    hook: '25 minutes on, 5 off. Your Pomodoro, in a tab.',
    pain: 'You sit down to study and look up an hour later with nothing done. A timer would keep you honest.',
    usual: ['Phone timers next to the notifications', 'Apps that want an account to time', 'Lap times you forgot to write down'],
    promise: 'A stopwatch with laps, several timers and a Pomodoro cycle, with keys, alerts and a CSV of your laps.',
    steps: ['Pick stopwatch, timer, Pomodoro', 'Press start', 'Read laps or wait for the alert'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: {
      kind: 'schematic',
      input: 'Start, lap, or a set length of time',
      output: 'Lap splits, a countdown alert or Pomodoro cycles'
    },
    howTo: 'How to use a Pomodoro timer online',
    cta: 'Start the timer'
  }
};
