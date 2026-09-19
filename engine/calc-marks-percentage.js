(function(){

/* A common Indian grading band. Boards and universities vary, which the tool
   says rather than implying this is the one true scale. */
const BANDS = [
  [90, 'O / A+', 'Outstanding'],
  [80, 'A',      'Excellent'],
  [70, 'B+',     'Very good'],
  [60, 'B',      'Good'],
  [50, 'C',      'Average'],
  [40, 'D',      'Pass'],
  [0,  'F',      'Below the pass mark']
];

window.TOOLS = window.TOOLS || {};
window.TOOLS["marks-percentage"] = {
"title": "Marks Percentage Calculator",
"category": "education",
"description": "Add up marks across subjects and get the total, the percentage and the grade, with per-subject maximums where they differ.",
"keywords": ["marks percentage calculator","percentage of marks","total marks calculator","exam percentage","calculate percentage from marks","grade calculator","marks to percentage"],
"formula": "Percentage = marks obtained ÷ maximum marks × 100",
"inputs": [
  {"key":"marks","label":"Marks obtained, separated by commas","type":"text","default":"78, 65, 91, 54, 83"},
  {"key":"max","label":"Maximum per subject (one value, or one per subject)","type":"text","default":"100"},
  {"key":"pass","label":"Pass mark per subject","type":"number","unit":"%","default":40}
],
"compute": function (v) {
  const parse = function (s) {
    return String(s || '').split(/[\s,;]+/).filter(Boolean).map(Number);
  };
  const marks = parse(v.marks);
  let maxes = parse(v.max);
  const pass = Number(v.pass);

  if (!marks.length) return { note: 'Enter the marks for at least one subject.' };
  if (marks.some(function (n) { return !isFinite(n) || n < 0; })) {
    return { note: 'Marks have to be numbers, and none of them negative.' };
  }
  if (!maxes.length) maxes = [100];
  if (maxes.some(function (n) { return !isFinite(n) || n <= 0; })) {
    return { note: 'The maximum has to be a positive number.' };
  }
  /* One maximum applies to every subject; a full list applies per subject.
     Anything in between is ambiguous and is refused rather than guessed. */
  if (maxes.length !== 1 && maxes.length !== marks.length) {
    return { note: 'Give either one maximum for all ' + marks.length + ' subjects, or ' + marks.length + ' of them — you gave ' + maxes.length + '.' };
  }
  const maxOf = function (i) { return maxes.length === 1 ? maxes[0] : maxes[i]; };

  const over = marks.filter(function (m, i) { return m > maxOf(i); });
  if (over.length) {
    return { note: 'A mark of ' + over[0] + ' is higher than the maximum for that subject.' };
  }

  const total = marks.reduce(function (a, b) { return a + b; }, 0);
  const maxTotal = marks.reduce(function (a, m, i) { return a + maxOf(i); }, 0);
  const pct = total / maxTotal * 100;

  const band = BANDS.find(function (b) { return pct >= b[0]; });
  const failed = marks.filter(function (m, i) { return (m / maxOf(i) * 100) < pass; }).length;

  const each = marks.map(function (m, i) { return (m / maxOf(i) * 100); });
  const best = Math.max.apply(null, each);
  const worst = Math.min.apply(null, each);

  return {
    percentage: pct,
    scored: total + ' of ' + maxTotal,
    grade: band[1] + ' — ' + band[2],
    subjects: marks.length,
    best: best,
    worst: worst,
    average: each.reduce(function (a, b) { return a + b; }, 0) / each.length,
    failed: failed,
    /* An aggregate pass with a subject failure underneath it is the result
       people most often get wrong, so it is stated rather than left to be
       worked out from the numbers. */
    note: failed
      ? failed + ' subject' + (failed === 1 ? ' is' : 's are') + ' below the ' + pass + '% pass mark. Most boards require a pass in each subject as well as in the aggregate.'
      : '',
    caution: 'Grade bands differ between boards and universities, and many weight subjects or drop the lowest. This uses a common Indian band and an unweighted total — check your own scheme before relying on the letter.'
  };
},
"outputs": [
  {"key":"percentage","label":"Percentage","format":"percent","primary":true},
  {"key":"scored","label":"Total scored","format":"text"},
  {"key":"grade","label":"Grade","format":"text"},
  {"key":"subjects","label":"Subjects","format":"number"},
  {"key":"average","label":"Average subject percentage","format":"percent"},
  {"key":"best","label":"Best subject","format":"percent"},
  {"key":"worst","label":"Weakest subject","format":"percent"},
  {"key":"failed","label":"Subjects below the pass mark","format":"number"},
  {"key":"note","label":"","format":"text"},
  {"key":"caution","label":"","format":"text"}
],
"tips": [
  "Where subjects are out of different totals, give one maximum per subject in the same order. A 50-mark practical counted as though it were out of 100 will pull the percentage down by a lot.",
  "Passing overall is not the same as passing everything. Most boards require both, which is why the failed-subject count is shown separately.",
  "If your board drops the lowest subject or counts best-of-five, leave that subject out rather than trying to weight it here.",
  "Internal assessment usually carries its own maximum and its own pass mark. Enter it as another subject with its own maximum.",
  "Percentages are normally reported to two decimal places on a marksheet and not rounded up. A 59.97% is not a 60%, and eligibility cut-offs are applied literally."
],
"faq": [
  {"q":"How do I calculate percentage of marks?","a":"Add the marks you scored, add the maximums they were out of, divide the first by the second and multiply by a hundred. The only thing that catches people out is subjects with different maximums, which is why this takes a list rather than assuming everything is out of 100."},
  {"q":"Can I pass overall but still fail?","a":"Yes, and it is common. Most boards and universities require a pass in every subject in addition to the aggregate, so a strong average can sit on top of one subject below the line. That count is shown separately here for exactly that reason."},
  {"q":"Does this give my official grade?","a":"No. Grade bands vary between boards, and many schemes weight subjects, use relative grading against the cohort, or drop the weakest result. The band here is a common Indian one and is labelled as such."},
  {"q":"What about best-of-five?","a":"Enter only the five subjects that count. Boards that use best-of-five apply it to a specified set, and which subjects qualify is a rule the calculator cannot know."}
]
};
})();
