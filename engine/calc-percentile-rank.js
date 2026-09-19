(function(){

window.TOOLS = window.TOOLS || {};
window.TOOLS["percentile-rank"] = {
"title": "Percentile and Rank Calculator",
"category": "education",
"description": "Convert between rank and percentile for any competitive exam, both directions, using either the standard formula or the NTA one.",
"keywords": ["percentile calculator","rank to percentile","percentile to rank","cat percentile calculator","jee percentile","nta percentile formula","exam rank calculator"],
"formula": "Percentile = (candidates below you ÷ total candidates) × 100",
"inputs": [
  {"key":"direction","label":"Work out","type":"select","default":"toPercentile","options":[
    {"value":"toPercentile","label":"Percentile, from my rank"},
    {"value":"toRank","label":"Rank, from my percentile"}
  ]},
  {"key":"value","label":"Your rank, or your percentile","type":"number","default":12500},
  {"key":"total","label":"Total candidates who sat the exam","type":"number","default":330000},
  {"key":"method","label":"Formula","type":"select","default":"nta","options":[
    {"value":"nta","label":"NTA style — your own place counts"},
    {"value":"plain","label":"Standard — strictly below you"}
  ]}
],
"compute": function (v) {
  const total = Number(v.total);
  const n = Number(v.value);
  /* The two conventions differ by one place. On a 330,000-candidate exam that
     is 0.0003 of a percentile and nobody notices; on a 400-candidate one it is
     a quarter of a point, which can decide a cut-off. Hence the choice. */
  const ntaStyle = v.method !== 'plain';

  if (!isFinite(total) || total <= 0) return { note: 'Enter how many candidates sat the exam.' };
  if (!isFinite(n)) return { note: 'Enter a rank or a percentile.' };

  const toPercentile = v.direction !== 'toRank';
  let rank, percentile;

  if (toPercentile) {
    rank = Math.round(n);
    if (rank < 1 || rank > total) {
      return { note: 'A rank of ' + rank + ' is outside 1 to ' + total.toLocaleString('en-GB') + '.' };
    }
    const below = ntaStyle ? (total - rank + 1) : (total - rank);
    percentile = below / total * 100;
  } else {
    percentile = n;
    if (percentile < 0 || percentile > 100) {
      return { note: 'A percentile has to be between 0 and 100.' };
    }
    const below = percentile / 100 * total;
    rank = ntaStyle ? Math.round(total - below + 1) : Math.round(total - below);
    rank = Math.min(total, Math.max(1, rank));
  }

  const ahead = rank - 1;
  const behind = total - rank;

  return {
    percentile: percentile,
    rank: rank,
    ahead: ahead,
    behind: behind,
    total: total,
    topPct: rank / total * 100,
    method: ntaStyle
      ? 'NTA style: (total − rank + 1) ÷ total'
      : 'Standard: (total − rank) ÷ total',
    summary: 'Rank ' + rank.toLocaleString('en-GB') + ' of ' + total.toLocaleString('en-GB') +
      ' — ahead of ' + behind.toLocaleString('en-GB') + ' candidates, behind ' + ahead.toLocaleString('en-GB') + '.',
    caution: 'This is the arithmetic relationship between rank and percentile only. Real exams normalise across sessions, break ties their own way, and publish percentiles per subject as well as overall — none of which a formula can reproduce. It will not predict a cut-off or a college.'
  };
},
"outputs": [
  {"key":"percentile","label":"Percentile","format":"number","primary":true},
  {"key":"rank","label":"Rank","format":"number"},
  {"key":"summary","label":"","format":"text"},
  {"key":"topPct","label":"You are in the top","format":"percent"},
  {"key":"behind","label":"Candidates below you","format":"number"},
  {"key":"ahead","label":"Candidates above you","format":"number"},
  {"key":"method","label":"Formula used","format":"text"},
  {"key":"caution","label":"","format":"text"}
],
"tips": [
  "Percentile is not percentage. A 99 percentile means you did better than 99% of the people who sat the exam, and says nothing about how many marks you scored.",
  "The two formulas differ by exactly one candidate. On a large national exam that is invisible; on a small one it is worth matching whichever your exam body publishes.",
  "Use the number who actually sat, not the number who registered. The gap is often ten to twenty percent and it moves the answer.",
  "Multi-session exams normalise raw scores before ranking, so your percentile is calculated against a scaled score rather than your raw marks. The relationship between rank and percentile still holds; the route to your rank does not.",
  "Percentiles compress badly at the top. The difference between 99.5 and 99.9 on a 300,000-candidate exam is well over a thousand places."
],
"faq": [
  {"q":"What is the difference between percentile and percentage?","a":"A percentage is your share of the available marks. A percentile is your position against everyone else who sat the exam. You can score 60% and be at the 99th percentile if the paper was hard, or score 90% and be at the 60th if it was not."},
  {"q":"Which formula does my exam use?","a":"NTA, which runs JEE Main, NEET and several others, counts your own place among those at or below your score, which is the first option here. Many other bodies count strictly below you. They differ by one candidate out of the total, so on a large exam the choice barely matters."},
  {"q":"Can this predict my college or my cut-off?","a":"No, and nothing honestly can from rank alone. Cut-offs move every year with the paper, the number of seats, the category and the counselling round. This gives you the arithmetic relationship between rank and percentile, which is one input into that decision rather than an answer to it."},
  {"q":"Why does my percentile look different from the official one?","a":"Usually because the total is different from what you assumed, or because the exam normalised across sessions. Official percentiles are computed on normalised scores within each session, so the rank you were given already reflects that and the conversion here is applied to it rather than to your raw marks."}
]
};
})();
