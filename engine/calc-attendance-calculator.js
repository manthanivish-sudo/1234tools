(function(){

window.TOOLS = window.TOOLS || {};
window.TOOLS["attendance-calculator"] = {
"title": "Attendance Calculator",
"category": "education",
"description": "Work out your attendance percentage, how many classes you can still miss, and how many you must attend in a row to get back to the required minimum.",
"keywords": ["attendance calculator","attendance percentage","how many classes can i miss","75 percent attendance","attendance shortage","bunk calculator","minimum attendance"],
"formula": "Attendance % = classes attended ÷ classes held × 100",
"inputs": [
  {"key":"attended","label":"Classes attended","type":"number","default":42},
  {"key":"held","label":"Classes held so far","type":"number","default":60},
  {"key":"required","label":"Required minimum","type":"number","unit":"%","default":75},
  {"key":"remaining","label":"Classes still to come, if you know","type":"number","default":30}
],
"compute": function (v) {
  const attended = Math.max(0, Number(v.attended) || 0);
  const held = Math.max(0, Number(v.held) || 0);
  const req = Number(v.required);
  const remaining = Math.max(0, Number(v.remaining) || 0);

  if (!held) return { note: 'Enter how many classes have been held.' };
  if (attended > held) return { note: 'You cannot have attended more classes than were held.' };
  if (!isFinite(req) || req < 0 || req > 100) return { note: 'The required minimum has to be between 0 and 100.' };

  const current = attended / held * 100;
  const meeting = current >= req;

  /* How many more can be missed and still clear the bar:
     attended / (held + k) >= req/100  =>  k <= attended*100/req - held */
  let canMiss = null;
  if (req > 0) canMiss = Math.max(0, Math.floor(attended * 100 / req - held));

  /* How many must be attended in a row to climb back to it:
     (attended + k) / (held + k) >= req/100
     =>  k >= (req*held - 100*attended) / (100 - req) */
  let mustAttend = 0;
  let recoverable = true;
  if (!meeting) {
    if (req >= 100) {
      /* Nothing recovers a perfect-attendance requirement once one is missed:
         the shortfall stays in the denominator for good. */
      recoverable = false;
    } else {
      mustAttend = Math.ceil((req * held - 100 * attended) / (100 - req));
    }
  }

  const out = {
    current: current,
    attendedOf: attended + ' of ' + held,
    status: meeting
      ? 'Above the ' + req + '% minimum'
      : (recoverable ? 'Short of the ' + req + '% minimum' : 'Below a 100% requirement'),
    canMiss: meeting ? canMiss : 0,
    mustAttend: meeting ? 0 : mustAttend
  };

  if (remaining > 0) {
    const best = (attended + remaining) / (held + remaining) * 100;
    const worst = attended / (held + remaining) * 100;
    out.best = best;
    out.worst = worst;
    out.verdict = best >= req
      ? (meeting
          ? 'Attending every remaining class would put you at ' + best.toFixed(1) + '%.'
          : 'Reachable: attending ' + mustAttend + ' of the ' + remaining + ' classes left gets you to ' + req + '%.')
      : 'Not reachable. Even attending all ' + remaining + ' remaining classes reaches only ' + best.toFixed(1) + '%, short of ' + req + '%.';
    if (!meeting && recoverable && mustAttend > remaining) {
      out.verdict = 'Not reachable. You would need ' + mustAttend + ' more classes but only ' + remaining + ' remain.';
    }
  }

  if (!recoverable) {
    out.note = 'A 100% requirement cannot be recovered once a class has been missed, because the missed class stays in the total for the rest of the term.';
  } else if (meeting && canMiss === 0) {
    out.note = 'You are exactly on the line. Missing one more class drops you below it.';
  }

  out.caution = 'Institutions count differently — some exclude approved leave, some count by subject rather than overall, some round up. Use your own attendance record as the authority.';
  return out;
},
"outputs": [
  {"key":"current","label":"Current attendance","format":"percent","primary":true},
  {"key":"attendedOf","label":"Attended","format":"text"},
  {"key":"status","label":"Status","format":"text"},
  {"key":"canMiss","label":"Classes you can still miss","format":"number"},
  {"key":"mustAttend","label":"Classes you must attend in a row","format":"number"},
  {"key":"best","label":"Best possible by the end","format":"percent"},
  {"key":"worst","label":"If you attend none of the rest","format":"percent"},
  {"key":"verdict","label":"","format":"text"},
  {"key":"note","label":"","format":"text"},
  {"key":"caution","label":"","format":"text"}
],
"tips": [
  "\"Classes you can still miss\" assumes you attend nothing else and the total keeps growing. It is the number of future classes you can skip and stay at or above the minimum.",
  "\"Classes you must attend in a row\" assumes a perfect run from here. Miss one during that run and the figure goes up again, which is why recovering from a shortfall is harder than it looks.",
  "Attendance is usually counted per subject, not across the whole timetable. A comfortable overall figure can still hide one subject below the line, so run it per subject.",
  "Medical and approved leave is excluded from the total at many institutions rather than counted as attended. That is a different calculation and it is worth asking which one your office applies.",
  "The arithmetic gets much harder as a term goes on. Twenty classes in, one missed class costs five percentage points; a hundred in, it costs one — but there is also far less room left to recover."
],
"faq": [
  {"q":"How many classes can I miss and still have 75%?","a":"It depends on how many have been held, not just on the percentage. With 42 of 60 attended you are at 70% and already short. With 45 of 60 you are at 75% and can miss none. Enter your own numbers above — the answer changes with every class held."},
  {"q":"Why does attending more classes raise my percentage so slowly?","a":"Because each class you attend adds one to the top and one to the bottom of the fraction. Once the denominator is large, a single class moves the percentage very little. Recovering from 65% to 75% can take dozens of consecutive classes, which is why the figure is worth watching early rather than late."},
  {"q":"Does this match what my college calculates?","a":"The arithmetic is the same, but the inputs often are not. Institutions differ on whether approved leave counts, whether attendance is per subject or overall, whether labs count double, and how they round. Use this to plan and your official record to argue."},
  {"q":"What if the requirement is 100%?","a":"Then it cannot be recovered. A missed class stays in the total for the rest of the term, so the percentage can never return to 100. The tool says so rather than showing an impossible target."}
]
};
})();
