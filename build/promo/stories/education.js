'use strict';
/* Story data for the Education & Exams section (/education/). Contract: kit2-schema.md §1–2.
   Browser tools: free, no sign-up, marks and names stay in the page. Calculators
   carry `calc` specs with real engine keys; the timetable, seating and report-card
   generators take files, so they carry `schematic` specs of their true in → out. */

const CALC = ['Free', 'No sign-up', 'Runs in your browser'];
const FILES = ['Free, no sign-up', 'Nothing uploaded', 'Runs in your browser'];

module.exports = {
  '/education/cgpa-to-percentage/': {
    persona: 'Students and graduates in India',
    hook: 'CGPA 8.2. Is that 82%, 77.9% or 74.5%?',
    pain: 'The job form wants a percentage. Your marksheet has a CGPA, and every university converts differently.',
    usual: ['Multiplying by 9.5 for every university', 'Formulas buried in a handbook', 'Seniors who each say something else'],
    promise: 'Enter your CGPA, pick your university’s formula. Get the percentage.',
    steps: ['Enter your CGPA', 'Pick CBSE, VTU, GTU or custom', 'Read the percentage'],
    proof: CALC,
    example: { kind: 'calc', inputs: { direction: 'toPercent', value: 8.2, scheme: 'vtu' } },
    howTo: 'How to convert CGPA to percentage, free',
    cta: 'Convert my CGPA'
  },

  '/education/sgpa-to-cgpa/': {
    persona: 'University students',
    hook: 'Four semesters, four SGPAs. So what is your CGPA?',
    pain: 'Your weakest semester carried the most credits. A plain average of SGPAs flatters you.',
    usual: ['Averaging SGPAs without credits', 'Waiting for the transcript', 'Calculator apps full of ads'],
    promise: 'Enter each SGPA and its credits. Get a weighted CGPA and percentage.',
    steps: ['List each semester’s SGPA', 'Add credits per semester', 'Read your CGPA'],
    proof: CALC,
    example: { kind: 'calc', inputs: { sgpa: '9.2, 7.1, 8.4, 8.0', credits: '18, 26, 22, 24', scaleMax: 10 } },
    howTo: 'How to calculate CGPA from SGPA with credits',
    cta: 'Work out my CGPA'
  },

  '/education/marks-percentage/': {
    persona: 'Students and parents',
    hook: 'Four papers out of 100, one out of 50. Your percentage?',
    pain: 'The practical was out of 50, not 100. Count it as 100 and your percentage drops.',
    usual: ['Assuming every paper is out of 100', 'Adding marks on a phone calculator', 'Missing a failed subject'],
    promise: 'Enter marks and maximums. Get total, percentage, grade and any fails.',
    steps: ['Enter your marks', 'Add maximums where they differ', 'Read percentage and grade'],
    proof: CALC,
    example: { kind: 'calc', inputs: { marks: '78, 65, 91, 54, 38', max: '100, 100, 100, 100, 50', pass: 40 } },
    howTo: 'How to calculate marks percentage correctly',
    cta: 'Check my percentage'
  },

  '/education/attendance-calculator/': {
    persona: 'College students',
    hook: 'At 70% with a 75% rule. How many classes to catch up?',
    pain: 'The 75% cut-off is close. You need to know exactly how many classes to attend from here.',
    usual: ['Tallying attendance in a notebook', 'Guessing how many you can skip', 'Finding out when the list goes up'],
    promise: 'Enter classes attended and held. See classes to attend, or to spare.',
    steps: ['Enter attended and held', 'Set the required minimum', 'Read the classes you need'],
    proof: CALC,
    example: { kind: 'calc', inputs: { attended: 42, held: 60, required: 75, remaining: 30 } },
    howTo: 'How to work out attendance to reach 75%',
    cta: 'Check my attendance'
  },

  '/education/percentile-rank/': {
    persona: 'Competitive exam candidates',
    hook: 'Rank 12,500 out of 12 lakh. What percentile is that?',
    pain: 'Counselling cut-offs talk in percentiles, your result talks in rank, and the formulas differ.',
    usual: ['Confusing percentile with percentage', 'Using registered, not appeared, totals', 'Guesswork on coaching forums'],
    promise: 'Enter your rank and the total. Get the percentile, or the reverse.',
    steps: ['Pick rank or percentile', 'Enter total candidates', 'Read where you stand'],
    proof: CALC,
    example: { kind: 'calc', inputs: { direction: 'toPercentile', value: 12500, total: 1200000, method: 'nta' } },
    howTo: 'How to convert exam rank to percentile',
    cta: 'Find my percentile'
  },

  '/education/exam-countdown/': {
    persona: 'Students with a big exam ahead',
    hook: '40 chapters left. How many hours a day, really?',
    pain: 'The exam date is fixed and the syllabus is long. You need hours per day, not a vague plan.',
    usual: ['Timetables with no revision days', 'Plans that assume seven-day weeks', 'Realising too late you are behind'],
    promise: 'Enter the exam date and syllabus. Get study days and hours a day.',
    steps: ['Pick the exam date', 'Enter topics and hours each', 'Read hours a day needed'],
    proof: CALC,
    example: { kind: 'calc', inputs: { date: '2027-03-01', topics: 40, hoursPer: 2.5, daysPerWeek: 6, revision: 7 } },
    howTo: 'How to plan study hours before an exam',
    cta: 'Plan my study'
  },

  '/education/timetable/': {
    persona: 'School timetable coordinators',
    hook: 'A clash-free timetable for every class and every teacher.',
    pain: 'Each term one person spends days on the timetable, then a part-time teacher’s day off breaks it.',
    usual: ['Weeks of sticky notes on a wall', 'One change that breaks five classes', 'Software sized for large school groups'],
    promise: 'Drop the subject allocation. Get class and teacher grids, clash-free.',
    steps: ['Drop the allocation sheet', 'Add doubles and free days', 'Download every grid'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'Subject allocation: class, subject, teacher, periods',
      output: 'A grid per class and per teacher, plus anything unplaced',
      sampleIn: '8B · Science · R Menon · 6 a week, 1 double · R Menon: Wed 5-8, Fri',
      sampleOut: 'Doubles kept side by side · Wednesday afternoon left free · unplaced: none'
    },
    howTo: 'How to make a clash-free school timetable',
    cta: 'Build the timetable'
  },

  '/education/exam-seating/': {
    persona: 'Exam officers and school offices',
    hook: 'No two from the same class side by side. Every room.',
    pain: 'Exam week: hundreds of students, a dozen rooms, and nobody may sit beside a classmate.',
    usual: ['Seating charts drawn by hand', 'Reshuffling after one late change', 'Door charts typed room by room'],
    promise: 'Drop the student list and rooms. Get a seating plan and door charts.',
    steps: ['Drop the student list', 'Type the rooms and layout', 'Print door charts and sheets'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'Student list (roll no., class) + rooms with rows and seats',
      output: 'Seating plan, a chart for each door, attendance sheets',
      sampleIn: 'Room 101, 6, 5 · Hall A, 40 · classes 9A, 9B, 10A alternating',
      sampleOut: 'No same-class neighbours · a door chart per room · a sheet per room to sign'
    },
    howTo: 'How to make an exam seating plan',
    cta: 'Seat the exam'
  },

  '/education/report-card/': {
    persona: 'Class teachers and school offices',
    hook: 'A whole class of report cards from one marks sheet.',
    pain: 'Results day. Forty report cards to fill, each with grades, total, rank and the class average.',
    usual: ['Filling every card by hand', 'Rank errors from a sorted sheet', 'Templates that break on an absent pupil'],
    promise: 'Drop the marks sheet. Get a PDF report card for every student.',
    steps: ['Drop the class marks sheet', 'Check subjects and maximums', 'Download the PDFs'],
    proof: FILES,
    example: {
      kind: 'schematic',
      input: 'A class marks sheet: one row per student',
      output: 'A PDF report card each, a combined PDF, a workbook',
      sampleIn: 'Roll, Name, English, Maths, Science… “AB” where a child was absent',
      sampleOut: 'Grades, total, percentage, rank and class average on every card; AB printed as AB'
    },
    howTo: 'How to make report cards from a marks sheet',
    cta: 'Make the report cards'
  }
};
