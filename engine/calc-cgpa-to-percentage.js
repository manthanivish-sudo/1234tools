(function(){

/**
 * CGPA and percentage, both directions.
 *
 * There is no single conversion. Every university publishes its own, and the
 * differences are large enough to matter on an application form: the same 8.2
 * CGPA is 77.9% under VTU's rule and 82% under a plain ten-point one. So the
 * formula is chosen rather than assumed, each option names whose rule it is,
 * and the tool says plainly that the transcript wins over anything computed
 * here.
 */
const SCHEMES = {
  'cbse':   { mult: 9.5, off: 0,    label: 'CBSE (CGPA × 9.5)' },
  'ten':    { mult: 10,  off: 0,    label: 'Ten-point (CGPA × 10)' },
  'vtu':    { mult: 10,  off: 0.75, label: 'VTU ((CGPA − 0.75) × 10)' },
  'gtu':    { mult: 10,  off: 0.5,  label: 'GTU ((CGPA − 0.5) × 10)' },
  'custom': { mult: null, off: null, label: 'Custom' }
};

window.TOOLS = window.TOOLS || {};
window.TOOLS["cgpa-to-percentage"] = {
"title": "CGPA to Percentage Converter",
"category": "education",
"description": "Convert CGPA to percentage and back, using your university's own formula — CBSE, VTU, GTU, a plain ten-point scale, or one you enter yourself.",
"keywords": ["cgpa to percentage","percentage to cgpa","cgpa calculator","cgpa to percentage formula","cbse cgpa to percentage","vtu cgpa to percentage","gtu cgpa","convert cgpa"],
"formula": "Percentage = (CGPA − offset) × multiplier",
"inputs": [
  {"key":"direction","label":"Convert","type":"select","default":"toPercent","options":[
    {"value":"toPercent","label":"CGPA to percentage"},
    {"value":"toCgpa","label":"Percentage to CGPA"}
  ]},
  {"key":"value","label":"Value to convert","type":"number","default":8.2},
  {"key":"scheme","label":"Formula","type":"select","default":"ten","options":[
    {"value":"ten","label":"Ten-point (CGPA × 10)"},
    {"value":"cbse","label":"CBSE (CGPA × 9.5)"},
    {"value":"vtu","label":"VTU ((CGPA − 0.75) × 10)"},
    {"value":"gtu","label":"GTU ((CGPA − 0.5) × 10)"},
    {"value":"custom","label":"Custom — set the two fields below"}
  ]},
  {"key":"mult","label":"Custom multiplier","type":"number","default":9.5},
  {"key":"off","label":"Custom offset subtracted from CGPA","type":"number","default":0},
  {"key":"scaleMax","label":"Maximum CGPA on your scale","type":"number","default":10}
],
"compute": function (v) {
  const scheme = SCHEMES[v.scheme] || SCHEMES.ten;
  const mult = v.scheme === 'custom' ? Number(v.mult) : scheme.mult;
  const off = v.scheme === 'custom' ? Number(v.off) : scheme.off;
  const max = Number(v.scaleMax) || 10;
  const n = Number(v.value);

  if (!isFinite(n)) return { note: 'Enter a number to convert.' };
  if (!isFinite(mult) || mult <= 0) {
    return { note: 'The multiplier has to be a positive number.' };
  }

  const toPercent = v.direction !== 'toCgpa';
  const cgpa = toPercent ? n : Math.round(((n / mult) + off) * 100) / 100;
  const percentage = toPercent ? (n - off) * mult : n;

  const notes = [];
  if (toPercent && (n < 0 || n > max)) {
    notes.push('A CGPA of ' + n + ' is outside the 0 to ' + max + ' scale you chose, so the result is an extrapolation.');
  }
  if (!toPercent && (n < 0 || n > 100)) {
    notes.push('A percentage of ' + n + ' is outside 0 to 100, so the result is an extrapolation.');
  }
  if (percentage > 100) {
    notes.push('This formula gives more than 100% at the top of the scale. That is the formula, not an error — several of them do.');
  }

  /* The maximum this formula can produce, which is the quickest way to see
     whether it is the right one for your institution. */
  const ceiling = (max - off) * mult;

  return {
    percentage: percentage,
    cgpa: cgpa,
    used: scheme.label === 'Custom'
      ? 'Custom: (CGPA − ' + off + ') × ' + mult
      : scheme.label,
    ceiling: ceiling,
    note: notes.join(' '),
    caution: 'Universities publish their own conversion and some use a lookup table rather than a formula. Quote the figure on your transcript or marksheet on any application — this is for working it out, not for proving it.'
  };
},
"outputs": [
  {"key":"percentage","label":"Percentage","format":"percent","primary":true},
  {"key":"cgpa","label":"CGPA","format":"number"},
  {"key":"used","label":"Formula used","format":"text"},
  {"key":"ceiling","label":"Highest percentage this formula can give","format":"percent"},
  {"key":"note","label":"","format":"text"},
  {"key":"caution","label":"","format":"text"}
],
"tips": [
  "Check your university handbook before trusting any conversion, including this one. The formula is usually printed on the back of the marksheet or in the examination regulations.",
  "CBSE's × 9.5 rule comes from the board itself and applies to the class 10 and 12 CGPA, not to a degree CGPA.",
  "A subtracted offset is what makes VTU and GTU results lower than a plain × 10. If your calculated percentage looks a point or two high, an offset is usually the reason.",
  "If your scale is not out of 10, set the maximum. A 4.0 scale with a × 25 multiplier is the usual way of reaching a percentage.",
  "Applications generally ask for the figure exactly as printed on your transcript. Where a form wants a percentage and your transcript only gives CGPA, attach the university's conversion rule with it."
],
"faq": [
  {"q":"Which formula should I use?","a":"Whichever one your university publishes. If you do not know it, the ten-point multiplication is the most common default in India, and CBSE's × 9.5 applies to school board results. Where a university uses a conversion table rather than a formula, no calculator can reproduce it and you should use the table."},
  {"q":"Why do different formulas give such different answers?","a":"Because they are measuring different things. A plain × 10 assumes the grade points map linearly onto marks; an offset formula assumes the lowest passing grade already represents a percentage well above zero. On a CGPA of 8.2 the two differ by more than four percentage points, which is enough to change an eligibility decision."},
  {"q":"Can a percentage be over 100?","a":"With some formulas, yes, at the very top of the scale. A CGPA of 10 under the ten-point rule is 100%, but under a rule with a negative offset it would be more. That is a property of the formula rather than a mistake, and it is why the tool shows the highest figure your chosen formula can produce."},
  {"q":"Is the reverse conversion exact?","a":"It is the exact inverse of the formula, but it is not a way to recover a CGPA the university never issued. Converting a percentage into a CGPA gives you the CGPA that would have produced it, which is useful for comparison and not a substitute for an official figure."}
]
};
})();
