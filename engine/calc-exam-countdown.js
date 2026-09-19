(function(){

window.TOOLS = window.TOOLS || {};
window.TOOLS["exam-countdown"] = {
"title": "Exam Countdown & Study Planner",
"category": "education",
"description": "Days left until your exam, how many of them are study days, and the hours a day your syllabus actually needs to fit in them.",
"keywords": ["exam countdown","study planner","days until exam","revision timetable","study hours calculator","exam preparation planner","how many days left"],
"formula": "Hours a day = (topics × hours per topic) ÷ study days remaining",
"inputs": [
  {"key":"date","label":"Exam date","type":"date","default":""},
  {"key":"topics","label":"Topics or chapters to cover","type":"number","default":40},
  {"key":"hoursPer","label":"Hours each topic needs","type":"number","default":2.5},
  {"key":"daysPerWeek","label":"Days a week you can study","type":"number","default":6},
  {"key":"revision","label":"Days to keep free at the end for revision","type":"number","default":7}
],
"compute": function (v) {
  if (!v.date) return { note: 'Pick your exam date.' };
  const exam = new Date(v.date + 'T00:00:00');
  if (isNaN(exam.getTime())) return { note: 'That date could not be read.' };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const MS = 86400000;
  const daysLeft = Math.round((exam - today) / MS);

  if (daysLeft < 0) return { note: 'That date has already passed.' };
  if (daysLeft === 0) return { daysLeft: 0, verdict: 'That is today. Good luck.', note: '' };

  const perWeek = Math.min(7, Math.max(1, Number(v.daysPerWeek) || 7));
  const revision = Math.max(0, Number(v.revision) || 0);
  const topics = Math.max(0, Number(v.topics) || 0);
  const hoursPer = Math.max(0, Number(v.hoursPer) || 0);

  /* Revision days come off the calendar before study days are counted, so the
     buffer is genuinely reserved rather than quietly spent on new material. */
  const workingCalendar = Math.max(0, daysLeft - revision);
  const studyDays = Math.floor(workingCalendar * perWeek / 7);
  const totalHours = topics * hoursPer;
  const perDay = studyDays > 0 ? totalHours / studyDays : Infinity;
  const topicsPerWeek = studyDays > 0 ? topics / (workingCalendar / 7) : Infinity;

  const weeks = Math.floor(daysLeft / 7);
  const spare = daysLeft % 7;

  let verdict;
  if (studyDays <= 0) {
    verdict = 'There are no study days left once ' + revision + ' revision days are set aside. Cut the revision buffer or accept that new material stops here.';
  } else if (perDay > 10) {
    verdict = 'That needs ' + perDay.toFixed(1) + ' hours a day, which is not a plan so much as a hope. Cut the topic list, reduce the hours per topic, or find more days.';
  } else if (perDay > 6) {
    verdict = 'At ' + perDay.toFixed(1) + ' hours a day this is full-time study. Workable if nothing else is happening, punishing otherwise.';
  } else if (perDay > 3) {
    verdict = 'At ' + perDay.toFixed(1) + ' hours a day this is demanding but realistic alongside other commitments.';
  } else {
    verdict = 'At ' + perDay.toFixed(1) + ' hours a day there is room in this plan, including for the days it does not survive contact with.';
  }

  return {
    daysLeft: daysLeft,
    calendar: (weeks ? weeks + ' week' + (weeks === 1 ? '' : 's') : '') +
      (weeks && spare ? ' and ' : '') +
      (spare || !weeks ? spare + ' day' + (spare === 1 ? '' : 's') : ''),
    studyDays: studyDays,
    totalHours: totalHours,
    perDay: isFinite(perDay) ? perDay : null,
    topicsPerWeek: isFinite(topicsPerWeek) ? topicsPerWeek : null,
    revisionDays: revision,
    examOn: exam.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    verdict: verdict,
    caution: 'Counted in whole days from today, and study days are the calendar days scaled by how many a week you said you can work. It does not know about your other deadlines, and every plan loses days it did not budget for.'
  };
},
"outputs": [
  {"key":"daysLeft","label":"Days left","format":"number","primary":true},
  {"key":"examOn","label":"Exam falls on","format":"text"},
  {"key":"calendar","label":"That is","format":"text"},
  {"key":"studyDays","label":"Study days available","format":"number"},
  {"key":"revisionDays","label":"Revision days reserved","format":"number"},
  {"key":"totalHours","label":"Hours the syllabus needs","format":"number"},
  {"key":"perDay","label":"Hours a day required","format":"number"},
  {"key":"topicsPerWeek","label":"Topics a week required","format":"number"},
  {"key":"verdict","label":"","format":"text"},
  {"key":"note","label":"","format":"text"},
  {"key":"caution","label":"","format":"text"}
],
"tips": [
  "Reserve the revision days before you plan anything else. A syllabus finished the night before is a syllabus you have read once, and reading once is not knowing.",
  "Be honest about hours per topic. Most people take roughly twice as long on the first pass as they expect, and the estimate is the part of this calculation you control.",
  "Days a week matters more than hours a day. Six days at three hours beats three days at six, because the gaps between sessions are where forgetting happens.",
  "If the hours a day come out above about six, the plan is already broken. Fix it by cutting the topic list rather than by promising longer days.",
  "Re-run it weekly. The value of this is watching the required hours climb when you lose a week, early enough to do something about it."
],
"faq": [
  {"q":"How many hours a day should I study?","a":"The honest answer is: however many the syllabus and the calendar leave you, which is what this works out. If the answer comes back above six or seven hours a day, that is a signal to change the plan rather than to attempt it — sustained study at that level for weeks is rare and usually collapses."},
  {"q":"Why reserve revision days?","a":"Because covering material and being able to recall it under time pressure are different things, and only the second one is examined. The buffer here is taken off the calendar before study days are counted, so it cannot quietly get spent on new chapters."},
  {"q":"Does it count weekends and holidays?","a":"Days left is every calendar day. Study days are that figure scaled by how many days a week you said you can work, so setting five gives you weekdays only. It does not know your public holidays or your other exam dates."},
  {"q":"What if I am already behind?","a":"Then the required hours a day will say so, which is the useful part. Cut the topic list to what actually appears on the paper, drop the hours per topic for the ones you half know already, and re-run it. A plan that admits it is not going to work is worth more than one that does not."}
]
};
})();
