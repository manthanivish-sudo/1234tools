/**
 * The reading part of the Education calculators, rendered by build-depth.js.
 * Shape and rules: build-depth.js and build/content/_check.js. Indian
 * university and board context where the engine has it (CBSE, VTU, GTU
 * conversions, NTA-style percentiles), and only the multipliers and offsets
 * the engines use. Every figure is computed with the page's own engine and
 * listed in worked.check / checks; the exam countdown counts from today, so
 * its day-dependent figures are worked by hand for a stated date.
 */
'use strict';

module.exports = {
  '/education/attendance-calculator/': {
    term: 'attendance percentage',
    whatIs: [
      'Attendance percentage is the share of held classes you were present for. Indian colleges and universities commonly set a minimum, often 75%, below which a student can be kept out of the end-semester exams unless the shortage is condoned.',
      'The arithmetic is simple; what students need is the forward view of how many classes they can skip, or must attend, to stay above the line.'
    ],
    formula: {
      text: 'Current attendance is attended over held. The classes you can miss is the largest number for which attended ÷ (held + k) stays at or above the minimum; when you are short, the classes you must attend is the smallest number for which (attended + k) ÷ (held + k) reaches it.',
      expr: ['attendance % = attended ÷ held × 100', 'can miss = ⌊attended × 100 ÷ required − held⌋', 'must attend = ⌈(required × held − 100 × attended) ÷ (100 − required)⌉', 'best = (attended + remaining) ÷ (held + remaining) × 100      worst = attended ÷ (held + remaining) × 100'],
      vars: [['required', 'the minimum percentage, such as 75'], ['remaining', 'classes still to be held this term, if known']]
    },
    worked: {
      inputs: { attended: 50, held: 60, required: 75, remaining: 40 },
      text: 'A student has attended 50 of 60 lectures in a subject, with 40 still to come and a 75% rule. Attendance stands at 83.33%. From here the student can skip 6 and still be at 75%: 50 of 66 is 75.76%, while 50 of 67 would be 74.63%. Attending every remaining lecture ends the term at 90%; attending none ends it at 50%.',
      check: [['current', '83.33%'], ['canMiss', '6'], ['best', '90%'], ['worst', '50%']]
    },
    uses: [
      ['Planning leave', 'Before a family function or a trip home, check how many lectures the margin allows.'],
      ['Lab and theory registers', 'Practicals often keep their own register, so run them as a separate calculation.'],
      ['Before applying for condonation', 'See whether a shortfall can still be made up by attending, or only excused.']
    ],
    mistakes: [
      'Counting a double period as one class. If the register marks two hours as two attendances, add both to attended and to held.',
      'Using classes scheduled instead of classes held. Cancelled lectures do not count, so take the held figure from the register, not the timetable.',
      'Rounding 74.6% up to 75%. Unless your institution says it rounds, enter the exact counts and read the unrounded figure.'
    ],
    faq: [
      { q: 'How many classes do I need to attend to reach 75%?', a: 'Solve (attended + k) ÷ (held + k) = 0.75 for k and round up. With 30 of 45 attended, that is 15 classes in a row, taking you to 45 of 60.' },
      { q: 'What is condonation of attendance shortage?', a: 'A provision at many universities that lets a small shortfall be excused, usually with medical or other documented reasons and sometimes a fee, down to a set lower limit. The terms differ by institution, so check the regulations or ask the examination section.' },
      { q: 'Can I set a minimum other than 75%?', a: 'Yes, any value from 0 to 100. With 50 of 60 attended and an 80% minimum, the margin shrinks to 2 classes.' }
    ],
    checks: [
      { inputs: { attended: 30, held: 45, required: 75, remaining: 0 }, key: 'mustAttend', shown: '15' },
      { inputs: { attended: 50, held: 60, required: 80, remaining: 40 }, key: 'canMiss', shown: '2' }
    ]
  },

  '/education/cgpa-to-percentage/': {
    term: 'CGPA',
    whatIs: [
      'CGPA, the cumulative grade point average, is the credit-weighted average of grade points across every semester or year of a course, usually on a 10-point scale in India. A percentage is a different measure: marks scored out of marks available.',
      'Moving between the two needs the formula your board or university publishes, because grade points hide the exact marks behind them.'
    ],
    formula: {
      text: 'Every built-in formula has the same shape: subtract an offset from the CGPA, then multiply. The ten-point rule has no offset and multiplies by 10; CBSE multiplies by 9.5; VTU subtracts 0.75 and GTU 0.5 before multiplying by 10. The reverse divides by the multiplier, adds the offset back and rounds to two decimals.',
      expr: ['percentage = (CGPA − offset) × multiplier', 'CGPA = percentage ÷ multiplier + offset', 'highest possible percentage = (scale maximum − offset) × multiplier'],
      vars: [['offset', '0 for ten-point and CBSE, 0.75 for VTU, 0.5 for GTU, or your own'], ['multiplier', '10, 9.5 for CBSE, or your own'], ['scale maximum', '10 by default; 4 on a 4-point scale']]
    },
    worked: {
      inputs: { direction: 'toCgpa', value: 78, scheme: 'gtu', mult: 9.5, off: 0, scaleMax: 10 },
      text: 'A GTU graduate wants to know what CGPA matches a 78% eligibility cut-off. Choosing percentage to CGPA and the GTU formula gives 78 ÷ 10 + 0.5 = 8.3. On that rule the highest percentage any CGPA can produce is 95%, since a perfect 10 still loses 0.5 before it is multiplied. Under a plain ten-point rule the same 78% would need only 7.8.',
      check: [['cgpa', '8.3'], ['ceiling', '95%']]
    },
    uses: [
      ['Job application forms', 'Fill in a percentage field when the degree certificate shows only a CGPA.'],
      ['Eligibility cut-offs', 'Turn a 60% or 75% requirement into the CGPA you need to reach.'],
      ['Class 10 and 12 results', 'Apply the CBSE rule to a board CGPA in either direction.']
    ],
    mistakes: [
      'Converting each semester’s SGPA and averaging the percentages. Convert the final CGPA once; averaging converted SGPAs ignores the credit weights.',
      'Assuming one rule applies to every batch. Universities revise their conversion rules, so use the regulations for your year of admission.',
      'Entering a 4-point GPA with the scale left at 10. Set the maximum to 4 and use the custom formula, or the result comes out far too low.'
    ],
    faq: [
      { q: 'What is 9.2 CGPA in percentage for CBSE?', a: '9.2 × 9.5 = 87.4%. Under the same rule a perfect 10 shows as 95%.' },
      { q: 'What CGPA is 60% under the VTU formula?', a: '60 ÷ 10 + 0.75 = 6.75. Under GTU’s rule the same 60% would be 6.5, a gap that comes entirely from the different offsets.' },
      { q: 'How do I convert a 4-point GPA to a percentage?', a: 'Choose custom, set the maximum to 4 and the multiplier to 25 with no offset. A 3.4 then becomes 85%, though universities abroad usually evaluate transcripts themselves.' }
    ],
    checks: [
      { inputs: { direction: 'toCgpa', value: 78, scheme: 'ten' }, key: 'cgpa', shown: '7.8' },
      { inputs: { direction: 'toPercent', value: 9.2, scheme: 'cbse' }, key: 'percentage', shown: '87.4%' },
      { inputs: { direction: 'toPercent', value: 10, scheme: 'cbse' }, key: 'ceiling', shown: '95%' },
      { inputs: { direction: 'toCgpa', value: 60, scheme: 'vtu' }, key: 'cgpa', shown: '6.75' },
      { inputs: { direction: 'toCgpa', value: 60, scheme: 'gtu' }, key: 'cgpa', shown: '6.5' },
      { inputs: { direction: 'toPercent', value: 3.4, scheme: 'custom', mult: 25, off: 0, scaleMax: 4 }, key: 'percentage', shown: '85%' }
    ]
  },

  '/education/exam-countdown/': {
    whatTitle: 'What is an exam countdown plan?',
    whatIs: [
      'An exam countdown plan turns a fixed exam date and a syllabus into a daily workload: the hours each available study day has to carry. It works back from the deadline, the reverse of a timetable.',
      'It matters most for long syllabuses, such as board exams, university finals and entrance tests, where falling a week behind is hard to notice in time.'
    ],
    formula: {
      text: 'Days left are counted from today to the exam. The revision days come off first; the rest are scaled by the days a week you can study and rounded down to whole study days, and the syllabus hours are shared across them.',
      expr: ['study days = ⌊(days left − revision days) × days per week ÷ 7⌋', 'syllabus hours = topics × hours per topic', 'hours a day = syllabus hours ÷ study days', 'topics a week = topics ÷ ((days left − revision days) ÷ 7)'],
      vars: [['days left', 'whole days from today to the exam date'], ['revision days', 'kept free at the end, before the exam']]
    },
    worked: {
      inputs: { date: '2027-05-03', topics: 30, hoursPer: 3, daysPerWeek: 6, revision: 7 },
      text: 'A final-year student has 30 chapters left before an exam on Monday, 3 May 2027, allows 3 hours a chapter, studies six days a week and wants a week free for revision. The syllabus needs 90 hours. Opened on 1 February 2027, the tool counts 91 days left; setting aside 7 leaves 84, and six days in seven of those is 72 study days. That is 1.25 hours a day, or 2.5 chapters a week. Because the count starts from today, “Try these numbers” shows the figures for the day you open it.',
      check: [['totalHours', '90'], ['examOn', 'Monday, 3 May 2027']]
    },
    uses: [
      ['Board exam preparation', 'Spread a full syllabus across the months before class 10 or 12 papers.'],
      ['Entrance tests', 'Plan the gap between school finals and an engineering or medical entrance exam.'],
      ['Studying around a job', 'Set two or three study days a week and see what each one has to carry.']
    ],
    mistakes: [
      'Counting topics rather than workload. A chapter of numericals and a chapter of definitions do not take the same time, so split heavy chapters into two topics.',
      'Leaving out past-paper practice. Add timed papers to the topic list, or they end up eating the revision days.'
    ],
    faq: [
      { q: 'How many days are left until my exam?', a: 'The tool’s first figure, counted in whole days from today’s date to the exam date. From 1 February 2027 to 3 May 2027 is 91 days, exactly 13 weeks.' },
      { q: 'Is 2 hours of study a day enough?', a: 'That depends on the syllabus rather than on a general rule. With 72 study days, 30 topics at 3 hours each need 1.25 hours a day; 60 such topics would need 2.5.' },
      { q: 'What happens if I enter seven days a week?', a: 'Every day left after revision becomes a study day, so the daily load falls. Over the same 84 days, 90 hours works out at about 1.07 hours a day.' }
    ]
  },

  '/education/marks-percentage/': {
    term: 'marks percentage',
    whatIs: [
      'Marks percentage is your total marks across all subjects divided by the total maximum marks, multiplied by 100. Indian boards and universities use it for results, admission and job eligibility, and grade bands.',
      'When subjects carry different maximums, the aggregate weights each one by its maximum, which is not the same as averaging the subject percentages.'
    ],
    formula: {
      text: 'The tool adds every mark and every maximum, using one maximum for all subjects or one per subject, and divides. It also works out each subject against its own maximum to find the best, the weakest, the simple average and any subject under the pass mark. The grade comes from a common band: O / A+ from 90, then A, B+, B, C and D from 80, 70, 60, 50 and 40.',
      expr: ['percentage = Σ marks ÷ Σ maximums × 100', 'subject % = mark ÷ that subject’s maximum × 100', 'average subject % = Σ subject % ÷ number of subjects'],
      vars: [['Σ marks', 'the total of the marks entered'], ['Σ maximums', 'the total of the maximum marks']]
    },
    worked: {
      inputs: { marks: '72, 31, 64, 58, 45', max: '100', pass: 33 },
      text: 'Five subjects, each out of 100, score 72, 31, 64, 58 and 45, with a pass mark of 33%. The total is 270 of 500, which is 54% and a grade of C — Average. Yet 1 subject is under the pass mark: 31 out of 100 is 31%. On most boards that means a supplementary exam in that one subject, whatever the aggregate says.',
      check: [['scored', '270 of 500'], ['percentage', '54%'], ['grade', 'C — Average'], ['failed', '1'], ['worst', '31%']]
    },
    uses: [
      ['Board results', 'Total class 10 or 12 marks and check the percentage printed on the result.'],
      ['Eligibility checks', 'Compare your exact percentage with a 50% or 60% cut-off before applying.'],
      ['Semester marksheets', 'Check a university aggregate when papers carry different maximums.']
    ],
    mistakes: [
      'Averaging subject percentages when maximums differ. Scores of 40 out of 50 and 90 out of 100 average 85% subject by subject, but the aggregate is 86.667%; forms want the aggregate.',
      'Typing marks as fractions, such as 45/50. Put the marks in one box and the maximums in the other, in the same order.',
      'Adding grace marks on top of the final figures. Use the marks printed on the marksheet, which already include any moderation.'
    ],
    faq: [
      { q: 'What is aggregate percentage?', a: 'Another name for the overall figure: total marks over total maximum. Admission and job notices that ask for an aggregate mean this, not the best subject or an average of subject percentages.' },
      { q: 'What grade is 75%?', a: 'In the band this tool uses, B+ — Very good, which runs from 70% up to 80%. Boards and universities set their own bands, so the letter on your marksheet may differ.' },
      { q: 'How many marks do I need in the last paper?', a: 'Work back from the target total. To reach 60% across five 100-mark papers you need 300 marks; with 240 from the first four, the last paper needs 60.' }
    ],
    checks: [
      { inputs: { marks: '40, 90', max: '50, 100', pass: 40 }, key: 'average', shown: '85%' },
      { inputs: { marks: '40, 90', max: '50, 100', pass: 40 }, key: 'percentage', shown: '86.667%' },
      { inputs: { marks: '75', max: '100', pass: 40 }, key: 'grade', shown: 'B+ — Very good' }
    ]
  },

  '/education/percentile-rank/': {
    term: 'a percentile',
    whatIs: [
      'A percentile tells you what share of candidates finished at or below your position. The NTA, which runs JEE Main, NEET and CUET, reports results this way: a 97.5 percentile means about 97.5% of that session’s candidates were at or behind you.',
      'Rank counts the same position from the top, so a small rank and a high percentile describe one result.'
    ],
    formula: {
      text: 'From a rank, the NTA-style formula counts you among those at or below your place; the standard formula counts only those strictly below, so the two differ by one candidate. Going the other way, the tool turns the percentile back into a number of candidates and rounds to a whole rank.',
      expr: ['NTA style: percentile = (total − rank + 1) ÷ total × 100', 'standard: percentile = (total − rank) ÷ total × 100', 'rank (NTA style) = total − percentile ÷ 100 × total + 1, rounded', 'top % = rank ÷ total × 100'],
      vars: [['total', 'candidates who actually sat the exam or session'], ['rank', 'your place, 1 being the highest']]
    },
    worked: {
      inputs: { direction: 'toRank', value: 97.5, total: 250000, method: 'nta' },
      text: 'A candidate in a session sat by 250,000 people scores the 97.5 percentile and wants the rank. 97.5% of 250,000 is 243,750 candidates at or below; under the NTA-style formula the rank is 250,000 − 243,750 + 1 = 6,251. That puts the candidate in the top 2.5004%, with 6,250 ahead and 243,749 behind.',
      check: [['rank', '6,251'], ['topPct', '2.5004%'], ['ahead', '6,250'], ['behind', '243,749']]
    },
    uses: [
      ['Counselling rounds', 'Estimate a rank from a percentile before the official rank list is out.'],
      ['Comparing attempts', 'Put two sessions with different candidate totals on the same footing.'],
      ['Small and internal tests', 'Use the standard formula where a single place can matter.'],
      ['Scholarship forms', 'Turn a class or district rank into a percentile when a form asks for one.']
    ],
    mistakes: [
      'Pairing one session’s percentile with the candidate total of all sessions. Each percentile is computed within its own session, so use that session’s total.',
      'Expecting the reverse conversion to give an exact rank. Candidates are whole while percentiles are not, so the rank is rounded, and tied scores share one percentile.'
    ],
    faq: [
      { q: 'What rank is 99 percentile?', a: 'It depends on how many sat. Out of 1,200,000 candidates the NTA-style formula gives rank 12,001; out of 250,000 it gives 2,501.' },
      { q: 'Does one place matter on a small exam?', a: 'It can. Rank 10 of 400 is the 97.75 percentile NTA style and 97.5 by the standard formula, a quarter-point gap that could straddle a cut-off.' },
      { q: 'What does “top 1%” mean in ranks?', a: 'A rank no worse than 1% of the candidates. On a 330,000-candidate exam the top 1% is ranks 1 to 3,300.' },
      { q: 'Can two candidates have the same percentile?', a: 'Yes. Everyone on the same score gets the same percentile, and the rank list then separates them using the exam body’s own tie-break rules.' }
    ],
    checks: [
      { inputs: { direction: 'toRank', value: 99, total: 1200000, method: 'nta' }, key: 'rank', shown: '12,001' },
      { inputs: { direction: 'toRank', value: 99, total: 250000, method: 'nta' }, key: 'rank', shown: '2,501' },
      { inputs: { direction: 'toPercentile', value: 10, total: 400, method: 'nta' }, key: 'percentile', shown: '97.75' },
      { inputs: { direction: 'toPercentile', value: 10, total: 400, method: 'plain' }, key: 'percentile', shown: '97.5' }
    ]
  },

  '/education/sgpa-to-cgpa/': {
    whatTitle: 'What are SGPA and CGPA?',
    whatIs: [
      'SGPA, the semester grade point average, sums up one semester: the grade points in each course weighted by that course’s credits. CGPA, the cumulative grade point average, does the same across every semester completed so far.',
      'Under the credit-based systems most Indian universities follow, CGPA is the figure on the final transcript and the one recruiters and admissions offices ask for.'
    ],
    formula: {
      text: 'Each semester’s SGPA is multiplied by its total credits, the products are added, and the sum is divided by the total credits; the result is rounded to two decimals. Without a credit value for every semester the tool falls back to a plain average and says so.',
      expr: ['CGPA = Σ(SGPA × credits) ÷ Σ credits', 'unweighted: CGPA = Σ SGPA ÷ number of semesters', 'percentage = CGPA × 10   or   CGPA × 9.5'],
      vars: [['SGPA', 'the grade point average for one semester'], ['credits', 'the total credits registered in that semester']]
    },
    worked: {
      inputs: { sgpa: '7.4, 7.9, 8.3, 8.6, 8.9, 9.1', credits: '20, 22, 24, 24, 22, 18', scaleMax: 10 },
      text: 'After six semesters a B.Tech student has SGPAs of 7.4, 7.9, 8.3, 8.6, 8.9 and 9.1 on credit loads of 20, 22, 24, 24, 22 and 18. That is 130 credits and 1,087 credit points, so the CGPA is 8.36. Converted, it is 83.6% on the × 10 rule or 79.42% on × 9.5. Without the credits the plain average is 8.37: when loads are this even, weighting barely moves the figure.',
      check: [['totalCredits', '130'], ['cgpa', '8.36'], ['pctTen', '83.6%'], ['pctNineFive', '79.42%']]
    },
    uses: [
      ['Placement eligibility', 'Check a running CGPA against a recruiter’s 7.0 or 7.5 cut-off before the drive.'],
      ['Setting a target', 'Add the SGPA you hope for next semester and see where the CGPA would land.'],
      ['Checking a grade card', 'Recompute the printed CGPA from its SGPAs and credits.']
    ],
    mistakes: [
      'Giving a different number of credit values and SGPAs. Six SGPAs with five credits make the tool ignore every credit and count the semesters equally.',
      'Rounding each SGPA to one decimal before entering it. Use the two decimals on the grade card, or the CGPA can drift by a few hundredths.',
      'Quoting CGPA × 9.5 as your percentage. That rule belongs to CBSE school results; use whichever conversion your university publishes.'
    ],
    faq: [
      { q: 'What SGPA do I need next semester to reach a target CGPA?', a: 'Multiply the target by the total credits including the next semester, subtract the credit points you already have, and divide by the next semester’s credits. To reach 8.5 after a 20-credit seventh semester, the student above needs (8.5 × 150 − 1,087) ÷ 20 = 9.4.' },
      { q: 'Is CGPA the average of SGPAs?', a: 'Only when every semester carries the same credits. Otherwise each SGPA counts in proportion to its credits, so a heavy semester moves the CGPA more than a light one.' },
      { q: 'Can CGPA go down after a good semester?', a: 'No. A semester above your current CGPA always pulls it up, though by less each time as the total credits grow.' }
    ],
    checks: [
      { inputs: { sgpa: '7.4, 7.9, 8.3, 8.6, 8.9, 9.1', credits: '', scaleMax: 10 }, key: 'cgpa', shown: '8.37' },
      { inputs: { sgpa: '7.4, 7.9, 8.3, 8.6, 8.9, 9.1, 9.4', credits: '20, 22, 24, 24, 22, 18, 20', scaleMax: 10 }, key: 'cgpa', shown: '8.5' }
    ]
  }
};
