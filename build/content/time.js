/**
 * The reading part of the Time calculators, rendered by build-depth.js.
 * Shape and rules: build-depth.js and build/content/_check.js. Every worked
 * input is a fixed date, never TODAY, and every figure is computed with the
 * page's own engine and listed in worked.check / checks.
 */
'use strict';

module.exports = {
  '/time/age-calculator/': {
    whatTitle: 'What is an exact age?',
    whatIs: [
      'An exact age is the time from a date of birth to a chosen date, counted in whole years, then whole months, then the days left over. Eligibility rules rely on it: a school intake or a youth sports category can hinge on the age reached on one named day.',
      'Age in years only moves on the birthday itself, so two children born a day apart can sit on opposite sides of a cut-off for a whole year.'
    ],
    formula: {
      text: 'Whole months are counted from the date of birth to the “age at” date, then the days left over; a birth day missing from a shorter month, such as the 31st, becomes that month’s last day. Adding the answer to the date of birth with the date add calculator lands on the “age at” date. Total days is the plain count between the dates.',
      expr: [
        'months = whole months from date of birth to age-at date        years = ⌊months ÷ 12⌋',
        'days = age-at date − (date of birth + months)',
        'total days = age-at date − date of birth',
        'total weeks = ⌊total days ÷ 7⌋        total hours = total days × 24'
      ],
      vars: [['date of birth + months', 'the birth date moved on by those months'], ['⌊ ⌋', 'round down to a whole number']]
    },
    worked: {
      inputs: { dob: '2012-09-01', on: '2026-08-31' },
      text: 'A junior football club counts ages on 31 August 2026 for its under-14 squad. A player born on 1 September 2012 is 13 years, 11 months, 30 days old on that date, so still eligible: the birthday is 1 day later. By then the player has lived 5,112 days, or 730 complete weeks. Move the “age at” date on by a single day and the age in years becomes 14.',
      check: [['exact', '13 years, 11 months, 30 days'], ['daysToNext', '1 day'], ['totalDays', '5,112'], ['totalWeeks', '730']]
    },
    uses: [
      ['Eligibility cut-offs', 'School admissions, junior leagues and age-banded competitions all fix the age on a set date.'],
      ['Ages in years and months', 'Nursery applications and child development reviews often record a young child’s age in months.'],
      ['Ages on past dates', 'Find how old someone was in a census entry or an old photograph.']
    ],
    mistakes: [
      'Leaving the second box on today when a rule names a date: an age “on 31 August” must be measured on 31 August.',
      'Dividing total days by 365 to get years. Leap days push that upwards: the player above is not yet 14, yet 5,112 ÷ 365 is just over 14.'
    ],
    faq: [
      { q: 'How old is someone born on 29 February on 28 February?', a: 'Still a year short here. A person born on 29 February 2008 is 18 years, 11 months, 30 days old on 28 February 2027, and the next birthday shows as Monday, 1 March 2027.' },
      { q: 'How do I find my age in days?', a: 'Enter both dates and read Total days, which includes every leap day between them. From 15 June 1990 to 1 January 2027 is 13,349 days.' },
      { q: 'How do I work out a baby’s age in months?', a: 'Read Total months. A baby born on 20 March 2026 is 0 years, 6 months, 14 days old on 4 October 2026: 6 completed months, with the seventh reached on 20 October.' }
    ],
    checks: [
      { inputs: { dob: '2012-09-01', on: '2026-09-01' }, key: 'years', shown: 'becomes 14' },
      { inputs: { dob: '2008-02-29', on: '2027-02-28' }, key: 'exact', shown: '18 years, 11 months, 30 days' },
      { inputs: { dob: '2008-02-29', on: '2027-02-28' }, key: 'nextBirthday', shown: 'Monday, 1 March 2027' },
      { inputs: { dob: '1990-06-15', on: '2027-01-01' }, key: 'totalDays', shown: '13,349' },
      { inputs: { dob: '2026-03-20', on: '2026-10-04' }, key: 'exact', shown: '0 years, 6 months, 14 days' },
      { inputs: { dob: '2026-03-20', on: '2026-10-04' }, key: 'totalMonths', shown: '6 completed' }
    ]
  },

  '/time/business-days/': {
    term: 'a business day',
    whatIs: [
      'A business day is a weekday that is not a public holiday. Payment terms, delivery promises and many legal deadlines are written in business days, so a “10 day” period can stretch past two calendar weeks.',
      'Which days are holidays depends on the country, and within the UK on the nation: Scotland and Northern Ireland each have bank holidays that England does not.'
    ],
    formula: {
      text: 'In count mode the tool walks from the start date to the day before the end date, sorting each day into weekend, listed holiday or business day. In add mode it steps forward from the day after the start and stops on the business day that reaches your number.',
      expr: [
        'business days = calendar days − weekend days − listed holidays on weekdays',
        'calendar days = end date − start date'
      ],
      vars: [['calendar days', 'every day from the start date up to the end date'], ['listed holidays on weekdays', 'dates from the holiday box that fall Monday to Friday']]
    },
    worked: {
      inputs: { start: '2027-05-01', mode: 'between', end: '2027-06-01', holidays: '2027-05-03, 2027-05-31' },
      text: 'How many working days does May 2027 have in the UK? Set the start to 1 May and the end to 1 June, and list the two May bank holidays, 2027-05-03 and 2027-05-31. Of the 31 calendar days, 10 fall at weekends because the month opens on a Saturday, and 2 are holidays, leaving 19 business days. With the holiday box empty the same month would have 21.',
      check: [['businessDays', '19 business days'], ['calendarDays', '31 calendar days'], ['weekendDays', '10 fall'], ['holidaysUsed', '2 are holidays']]
    },
    uses: [
      ['Payment terms', 'Turn “payment within 20 working days” into a date for the diary or the invoice.'],
      ['Pro-rating pay', 'Find the working days in a month to split a salary or a day rate fairly.'],
      ['Delivery estimates', 'Check what “3 to 5 working days” means for an order placed the Thursday before a bank holiday.']
    ],
    mistakes: [
      'Listing a holiday that falls at a weekend. When Christmas Day is a Saturday it is already excluded; enter the substitute weekday the bank holiday moves to instead.',
      'Using another nation’s list. Easter Monday is a bank holiday in England, Wales and Northern Ireland but not in Scotland.',
      'Typing holidays day first. The box reads YYYY-MM-DD only: entered as 31/05/2027, the spring bank holiday is not recognised and May shows 21 business days instead of 19.'
    ],
    faq: [
      { q: 'How many working days are there in a year?', a: 'It depends on the year and the holidays. 2027 has 261 weekdays; listing the 8 bank holidays of England and Wales brings it down to 253.' },
      { q: 'Is 14 calendar days always 10 working days?', a: 'Before holidays, yes: any 14 consecutive days contain exactly two of each weekday, so 10 of them fall Monday to Friday. A bank holiday inside the fortnight takes it to 9.' },
      { q: 'What date is 5 working days after a Friday?', a: 'The following Friday, if no holiday intervenes. In add mode, 5 business days from Friday 4 June 2027 gives Friday, 11 June 2027.' }
    ],
    checks: [
      { inputs: { start: '2027-05-01', mode: 'between', end: '2027-06-01', holidays: '' }, key: 'businessDays', shown: 'would have 21' },
      { inputs: { start: '2027-05-01', mode: 'between', end: '2027-06-01', holidays: '31/05/2027' }, key: 'businessDays', shown: '21 business days instead' },
      { inputs: { start: '2027-01-01', mode: 'between', end: '2028-01-01', holidays: '' }, key: 'businessDays', shown: '261 weekdays' },
      { inputs: { start: '2027-01-01', mode: 'between', end: '2028-01-01', holidays: '2027-01-01, 2027-03-26, 2027-03-29, 2027-05-03, 2027-05-31, 2027-08-30, 2027-12-27, 2027-12-28' }, key: 'businessDays', shown: 'down to 253' },
      { inputs: { start: '2027-06-04', mode: 'add', add: 5, holidays: '' }, key: 'result', shown: 'Friday, 11 June 2027' }
    ]
  },

  '/time/date-add-subtract/': {
    whatTitle: 'What does adding a month to a date mean?',
    whatIs: [
      'Adding days to a date is plain counting, but months and years have no fixed length. A month after 15 March is 15 April, 31 days on, while a month after 15 April is 15 May, only 30. Calendar arithmetic changes the month and year numbers and keeps the day of the month wherever it can.',
      'When that day does not exist in the target month, the tool settles on the month’s last day and adds a note saying it did.'
    ],
    formula: {
      text: 'Years and months move first, on the month and year numbers alone; a day past the end of the new month becomes that month’s last day. Weeks are then turned into days and counted on the calendar. Subtract runs the same steps backwards.',
      expr: [
        'target month = start month ± (years × 12 + months)',
        'day = min(start day, last day of the target month)',
        'result = that date ± (weeks × 7 + days)'
      ],
      vars: [['±', '+ for Add, − for Subtract'], ['min', 'the smaller of the two']]
    },
    worked: {
      inputs: { start: '2026-08-31', dir: 'add', years: 0, months: 6, weeks: 0, days: 0 },
      text: 'A six-month probation period starts on 31 August 2026. Adding 6 months reaches February 2027, which has no 31st, so the result is Sunday, 28 February 2027. That is 181 days later. Counting days would not get there: six 30-day months make 180, and 26 weeks make 182.',
      check: [['result', 'Sunday, 28 February 2027'], ['totalDays', '181 days']]
    },
    uses: [
      ['Contract and probation dates', 'Add months to a start date the way an employment contract or tenancy counts them.'],
      ['Renewals', 'Find when a 12-month plan renews, including one that began on the 29th, 30th or 31st.'],
      ['Looking back', 'Subtract to find when a 3-month window opened, or the date 90 days before a deadline.']
    ],
    mistakes: [
      'Forgetting that Months starts at 1. With 6 in Weeks and Months left alone, Monday 4 January 2027 moves to Thursday, 18 March 2027, not Monday, 15 February 2027.',
      'Treating a month as 30 days. Three months before 31 May 2027 is Sunday, 28 February 2027, which is 92 days earlier, not 90.',
      'Expecting add and subtract to cancel out. 31 August plus 6 months is 28 February, but 28 February 2027 minus 6 months is Friday, 28 August 2026: clamping loses the extra days.'
    ],
    faq: [
      { q: 'What happens when I subtract a year from 29 February?', a: 'The year before has no 29 February, so the day becomes the 28th. 29 February 2028 minus 1 year is Sunday, 28 February 2027, which is 366 days earlier because the span contains the 2028 leap day.' },
      { q: 'Can I add years, months and days in one go?', a: 'Yes, fill in any combination. 1 year, 2 months and 10 days after 20 November 2026 is Sunday, 30 January 2028: the year and months take it to 20 January, then the 10 days are counted.' },
      { q: 'How many days is 6 weeks?', a: '42, always. From Monday 4 January 2027, with every other box at 0, 6 weeks lands on Monday, 15 February 2027.' }
    ],
    checks: [
      { inputs: { start: '2027-01-04', dir: 'add', weeks: 6 }, key: 'result', shown: 'Thursday, 18 March 2027' },
      { inputs: { start: '2027-01-04', dir: 'add', years: 0, months: 0, weeks: 6, days: 0 }, key: 'result', shown: 'Monday, 15 February 2027' },
      { inputs: { start: '2027-01-04', dir: 'add', years: 0, months: 0, weeks: 6, days: 0 }, key: 'totalDays', shown: '42, always' },
      { inputs: { start: '2027-05-31', dir: 'sub', years: 0, months: 3, weeks: 0, days: 0 }, key: 'result', shown: 'Sunday, 28 February 2027' },
      { inputs: { start: '2027-05-31', dir: 'sub', years: 0, months: 3, weeks: 0, days: 0 }, key: 'totalDays', shown: '92 days earlier' },
      { inputs: { start: '2027-02-28', dir: 'sub', years: 0, months: 6, weeks: 0, days: 0 }, key: 'result', shown: 'Friday, 28 August 2026' },
      { inputs: { start: '2028-02-29', dir: 'sub', years: 1, months: 0, weeks: 0, days: 0 }, key: 'totalDays', shown: '366 days earlier' },
      { inputs: { start: '2026-11-20', dir: 'add', years: 1, months: 2, weeks: 0, days: 10 }, key: 'result', shown: 'Sunday, 30 January 2028' }
    ]
  },

  '/time/date-difference/': {
    whatTitle: 'What is the difference between two dates?',
    whatIs: [
      'The gap between two dates can be stated two ways: as a count of days, which is exact, or as years, months and days, which is how people say it but depends on the months in between. 1 June to 1 July 2027 is one month, or 30 days; 1 July to 1 August is also one month, but 31 days.',
      'Invoices and contracts usually want one of the two, and sometimes the weekdays too.'
    ],
    formula: {
      text: 'Total days is the end date minus the start date, so the start day is counted and the end day is not. The breakdown counts whole months from the start date, then the days left; a start day missing from a shorter month becomes its last day, so adding the answer back with the date add calculator gives the end date.',
      expr: [
        'total days = end − start',
        'weeks = total days ÷ 7      hours = total days × 24      minutes = total days × 1,440',
        'weekdays = days from the start up to the end that fall Monday to Friday'
      ],
      vars: [['start', 'the first date, counted'], ['end', 'the last date, not counted']]
    },
    worked: {
      inputs: { start: '2025-11-17', end: '2026-08-14' },
      text: 'A fixed-term contract runs from 17 November 2025 to 14 August 2026. The difference is 0 years, 8 months, 28 days, or 270 days in total, which is 38.5714 weeks. Of those days, 194 are weekdays, before bank holidays are taken off. If the contract counts 14 August as a working day too, add one.',
      check: [['breakdown', '0 years, 8 months, 28 days'], ['totalDays', '270'], ['totalWeeks', '38.5714'], ['weekdays', '194']]
    },
    uses: [
      ['Invoice ageing', 'Count how many days an invoice is overdue before a reminder or a late-payment claim.'],
      ['Length of service', 'State time in a job in years, months and days for a reference or a leaving letter.'],
      ['Project reporting', 'Say how long a phase took in weeks, or how many weekdays remain before a deadline.']
    ],
    mistakes: [
      'Forgetting whether both ends count. A hotel stay from 1 to 5 July 2027 is 4 nights, which is what the tool gives; a conference on the same dates runs for 5 days.',
      'Reading Total Months as rounded. It counts complete months only, so 8 months and 28 days shows as 8, not 9.'
    ],
    faq: [
      { q: 'How do I count the days between two dates including both?', a: 'Add one to Total Days: 17 November 2025 to 14 August 2026 is 270 days here, or 271 counting both ends.' },
      { q: 'How many days are left until Christmas?', a: 'Put today in the start box and 25 December in the end box. Counted from 4 October 2026, it is 82 days, or 0 years, 2 months, 21 days.' },
      { q: 'Does the day count allow for leap years?', a: 'Yes, because it counts real calendar days. 1 January 2028 to 1 January 2029 is 366 days, as 2028 is a leap year; the same span a year earlier is 365.' },
      { q: 'How many weekdays are in a month?', a: 'Set the first of the month and the first of the next. June 2027, from 1 June to 1 July, has 22 weekdays out of 30 days.' }
    ],
    checks: [
      { inputs: { start: '2027-07-01', end: '2027-07-05' }, key: 'totalDays', shown: '4 nights' },
      { inputs: { start: '2025-11-17', end: '2026-08-14' }, key: 'totalMonths', shown: 'shows as 8' },
      { inputs: { start: '2026-10-04', end: '2026-12-25' }, key: 'totalDays', shown: '82 days' },
      { inputs: { start: '2026-10-04', end: '2026-12-25' }, key: 'breakdown', shown: '0 years, 2 months, 21 days' },
      { inputs: { start: '2028-01-01', end: '2029-01-01' }, key: 'totalDays', shown: '366 days' },
      { inputs: { start: '2027-01-01', end: '2028-01-01' }, key: 'totalDays', shown: 'is 365' },
      { inputs: { start: '2027-06-01', end: '2027-07-01' }, key: 'weekdays', shown: '22 weekdays' },
      { inputs: { start: '2027-06-01', end: '2027-07-01' }, key: 'totalDays', shown: 'out of 30' }
    ],
    related: { conversions: ['/conversions/time/day-to-week/', '/conversions/time/day-to-hour/'], guides: ['/guides/chase-unpaid-invoices/'] }
  },

  '/time/week-number/': {
    term: 'an ISO week number',
    whatIs: [
      'An ISO week number labels each Monday-to-Sunday week of the year from 1 to 52, or to 53 in some years, under the international standard ISO 8601. Manufacturers and hauliers plan by it, so “week 12” means the same seven days to everyone using it.',
      'Weeks do not divide evenly into a year, so an ISO year can begin a few days before 1 January or end a few days after 31 December.'
    ],
    formula: {
      text: 'Every week belongs to the year that contains its Thursday. The tool moves the date to the Thursday of its own week, finds the Thursday of week 1 in that year, and counts the whole weeks between the two.',
      expr: [
        'weekday: Monday = 1 … Sunday = 7',
        'Thursday of the week = date − weekday + 4',
        'week = 1 + (that Thursday − Thursday of week 1) ÷ 7'
      ],
      vars: [['week 1', 'the week containing 4 January, which is always the week with the year’s first Thursday']]
    },
    worked: {
      inputs: { date: '2026-12-31' },
      text: 'New Year’s Eve 2026 is a Thursday, as was 1 January 2026, so ISO 2026 runs to 53 weeks. The tool places 31 December 2026 in Week 53 of 2026, a week that runs 28 Dec 2026 to 3 Jan 2027. It is day 365 of the year, with 0 days left, in Q4. The first three days of 2027 sit in the same week 53, and week 1 of 2027 starts on Monday 4 January.',
      check: [['label', 'Week 53 of 2026'], ['range', '28 Dec 2026 to 3 Jan 2027'], ['dayOfYear', 'day 365'], ['daysLeft', '0 days left'], ['quarter', 'Q4']]
    },
    uses: [
      ['Production and delivery plans', 'Suppliers across much of Europe quote lead times and delivery slots as week numbers.'],
      ['Rotas and timesheets', 'Shift patterns and weekly timesheets are often filed under the week number.'],
      ['Sprints and term plans', 'Teams that plan in weeks can check exactly which dates a week covers, from any day in it.']
    ],
    mistakes: [
      'Filing early-January figures under the calendar year. Sales from 1 to 3 January 2027 belong to week 53 of 2026, and filing them under 2027 breaks the year totals.',
      'Assuming every year has 52 weeks. 2026 has 53, so a weekly plan built on 52 leaves its last week unassigned.',
      'Using a spreadsheet’s plain WEEKNUM. In Excel it starts weeks on Sunday by default; ISOWEEKNUM, or WEEKNUM with return type 21, gives the ISO number.'
    ],
    faq: [
      { q: 'Which years have 53 ISO weeks?', a: 'Those that start on a Thursday, plus leap years that start on a Wednesday. 2026 is one; the next is 2032, whose last day falls in Week 53 of 2032.' },
      { q: 'Can a date in December be in week 1?', a: 'Yes. Monday 30 December 2024 shares its week with Thursday 2 January 2025, so it is Week 1 of 2025.' },
      { q: 'Is the quarter based on the ISO week?', a: 'No, Quarter follows the calendar month of the date. 31 March 2027 is Q1 and 1 April 2027 is Q2, though both are in Week 13 of 2027.' }
    ],
    checks: [
      { inputs: { date: '2027-01-04' }, key: 'label', shown: 'week 1 of 2027' },
      { inputs: { date: '2027-01-01' }, key: 'label', shown: 'week 53 of 2026' },
      { inputs: { date: '2032-12-31' }, key: 'label', shown: 'Week 53 of 2032' },
      { inputs: { date: '2024-12-30' }, key: 'label', shown: 'Week 1 of 2025' },
      { inputs: { date: '2027-03-31' }, key: 'quarter', shown: 'Q1' },
      { inputs: { date: '2027-04-01' }, key: 'quarter', shown: 'Q2' },
      { inputs: { date: '2027-04-01' }, key: 'label', shown: 'Week 13 of 2027' }
    ]
  }
};
