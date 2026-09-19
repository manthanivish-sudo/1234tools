(function(){

window.TOOLS = window.TOOLS || {};
window.TOOLS["sgpa-to-cgpa"] = {
"title": "SGPA to CGPA Calculator",
"category": "education",
"description": "Turn semester grade points into a cumulative CGPA, weighted by semester credits where you have them, with the equivalent percentage.",
"keywords": ["sgpa to cgpa","cgpa calculator","semester gpa to cgpa","cumulative gpa","sgpa cgpa formula","calculate cgpa from sgpa"],
"formula": "CGPA = Σ(SGPA × credits) ÷ Σ credits",
"inputs": [
  {"key":"sgpa","label":"SGPA for each semester, separated by commas","type":"text","default":"8.1, 8.6, 7.9, 8.8"},
  {"key":"credits","label":"Credits per semester, same order (optional)","type":"text","default":"22, 24, 20, 24"},
  {"key":"scaleMax","label":"Maximum on your scale","type":"number","default":10}
],
"compute": function (v) {
  const parse = function (s) {
    return String(s || '').split(/[\s,;]+/).filter(Boolean).map(Number);
  };
  const sgpa = parse(v.sgpa);
  const credits = parse(v.credits);
  const max = Number(v.scaleMax) || 10;

  if (!sgpa.length) return { note: 'Enter at least one semester SGPA.' };
  if (sgpa.some(function (n) { return !isFinite(n); })) {
    return { note: 'One of the SGPA values is not a number.' };
  }
  const outOfRange = sgpa.filter(function (n) { return n < 0 || n > max; });
  if (outOfRange.length) {
    return { note: 'SGPA ' + outOfRange[0] + ' is outside the 0 to ' + max + ' scale. Change the maximum if your scale is different.' };
  }

  /* Weighting only applies when there is a credit figure for every semester.
     A partial list would silently drop semesters, which is worse than
     ignoring the credits altogether and saying so. */
  const weighted = credits.length === sgpa.length &&
    credits.every(function (c) { return isFinite(c) && c > 0; });

  const totalCredits = weighted ? credits.reduce(function (a, b) { return a + b; }, 0) : sgpa.length;
  const points = weighted
    ? sgpa.reduce(function (a, s, i) { return a + s * credits[i]; }, 0)
    : sgpa.reduce(function (a, b) { return a + b; }, 0);
  const cgpa = Math.round(points / totalCredits * 100) / 100;

  const best = Math.max.apply(null, sgpa);
  const worst = Math.min.apply(null, sgpa);

  return {
    cgpa: cgpa,
    semesters: sgpa.length,
    method: weighted
      ? 'Weighted by credits'
      : 'Unweighted — every semester counted equally',
    totalCredits: weighted ? totalCredits : null,
    best: best,
    worst: worst,
    pctTen: cgpa * 10,
    pctNineFive: cgpa * 9.5,
    note: (credits.length && !weighted)
      ? 'You gave ' + credits.length + ' credit values for ' + sgpa.length + ' semesters, so they were ignored and every semester counted equally.'
      : '',
    caution: 'The two percentages are the two most common conversions, not your university’s. Check which rule yours publishes — they differ by half a grade at this level.'
  };
},
"outputs": [
  {"key":"cgpa","label":"CGPA","format":"number","primary":true},
  {"key":"method","label":"Method","format":"text"},
  {"key":"semesters","label":"Semesters counted","format":"number"},
  {"key":"totalCredits","label":"Total credits","format":"number"},
  {"key":"best","label":"Best semester","format":"number"},
  {"key":"worst","label":"Weakest semester","format":"number"},
  {"key":"pctTen","label":"Percentage if × 10","format":"percent"},
  {"key":"pctNineFive","label":"Percentage if × 9.5","format":"percent"},
  {"key":"note","label":"","format":"text"},
  {"key":"caution","label":"","format":"text"}
],
"tips": [
  "Give the credits if you have them. A light semester and a heavy one do not contribute equally, and an unweighted average quietly flatters whichever one went better.",
  "Credits mean the semester's total credit load, not the credits for one subject.",
  "Most universities compute CGPA weighted by credits. If yours publishes a CGPA that differs from this, an unweighted average is usually the reason.",
  "A backlog cleared in a later semester is normally counted in the semester it was cleared, not the one it was failed in. That shifts both figures.",
  "Keep the running CGPA rather than recomputing at the end. Watching it move is the only way to see how much one weak semester actually costs across a degree."
],
"faq": [
  {"q":"Should I weight by credits?","a":"If your university does, yes, and nearly all do. The unweighted average is only right when every semester carries the same credit load, which is unusual once electives and project work start."},
  {"q":"Why is my calculated CGPA different from the one on my transcript?","a":"Most often because the transcript is weighted and this was not, or because a cleared backlog is counted in a different semester. Grade replacement rules for repeated subjects also vary and are not something a calculator can guess."},
  {"q":"What percentage does my CGPA come to?","a":"That depends on your university's own rule. The two shown here are the most common — multiply by ten, or by 9.5 — and they differ by a meaningful margin. Our CGPA to percentage converter handles VTU, GTU and custom formulas as well."},
  {"q":"Can I include a semester I failed?","a":"Include it if it appears on your transcript with a grade point. If the university replaces the grade on a repeat rather than averaging both attempts, enter only the replacement."}
]
};
})();
