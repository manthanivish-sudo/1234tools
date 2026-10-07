(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["heart-rate-zones"] = {
"title": "Heart Rate Zone Calculator",
"category": "health",
"description": "Training heart rate zones from maximum or reserve heart rate, with what each zone is for.",
"keywords": ["heart rate zones","target heart rate","max heart rate calculator","fat burning zone","training zones"],
"formula": "Tanaka: HRmax = 208 − 0.7 × age  ·  Karvonen uses heart rate reserve",
"inputs": [{"key":"age","label":"Age","type":"number","unit":"years","default":35,"min":10,"max":100},{"key":"resting","label":"Resting heart rate (optional)","type":"number","unit":"bpm","default":60,"min":0,"max":120},{"key":"method","label":"Method","type":"select","options":[{"value":"tanaka","label":"Tanaka — 208 − 0.7 × age (more accurate)"},{"value":"classic","label":"Classic — 220 − age"}],"default":"tanaka"}],
"compute": ({ age, resting, method }) => {
      const a = Number(age) || 0;
      if (a < 10 || a > 100) return { note: 'Enter an age between 10 and 100.' };
      const hrMax = method === 'classic' ? 220 - a : 208 - 0.7 * a;
      const rest = Math.max(0, Math.min(120, Number(resting) || 0));
      const reserve = rest ? hrMax - rest : 0;

      // Karvonen when a resting rate is given, otherwise a plain percentage of max
      const zone = (lo, hi) => rest
        ? `${Math.round(reserve * lo + rest)} – ${Math.round(reserve * hi + rest)} bpm`
        : `${Math.round(hrMax * lo)} – ${Math.round(hrMax * hi)} bpm`;

      return {
        hrMax: Math.round(hrMax),
        zone1: zone(0.50, 0.60),
        zone2: zone(0.60, 0.70),
        zone3: zone(0.70, 0.80),
        zone4: zone(0.80, 0.90),
        zone5: zone(0.90, 1.00),
        reserve: rest ? Math.round(reserve) : NaN,
        basis: rest ? 'Karvonen, using heart rate reserve' : 'Percentage of maximum heart rate',
        note: ''
      };
    },
"outputs": [{"key":"hrMax","label":"Estimated maximum heart rate","format":"number","unit":"bpm","primary":true},{"key":"basis","label":"Method used","format":"text"},{"key":"zone1","label":"Zone 1 — very light, recovery","format":"text"},{"key":"zone2","label":"Zone 2 — light, endurance base","format":"text"},{"key":"zone3","label":"Zone 3 — moderate, aerobic","format":"text"},{"key":"zone4","label":"Zone 4 — hard, threshold","format":"text"},{"key":"zone5","label":"Zone 5 — maximum, short intervals","format":"text"},{"key":"reserve","label":"Heart rate reserve","format":"number","unit":"bpm"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.hrMax === undefined ? [] : [
      (v.method === 'classic' ? 'HRmax = 220 − ' + f.upto(Number(v.age), 0) : 'HRmax = 208 − 0.7 × ' + f.upto(Number(v.age), 0)) + ' = ' + r.hrMax + ' bpm',
      Number(v.resting) ? 'reserve = ' + r.hrMax + ' − ' + f.upto(Number(v.resting), 0) + ' = ' + r.reserve + '; zone 2 = 60–70% of it + ' + f.upto(Number(v.resting), 0) + ' = ' + r.zone2 : 'zone 2 = 60–70% of ' + r.hrMax + ' = ' + r.zone2],
"tips": ["Age-based maximum heart rate is a population average with a standard deviation of about 10–12 bpm. Your true maximum could reasonably be twenty beats either side of this estimate.","Giving a resting heart rate switches to the Karvonen method, which accounts for fitness and gives more useful zones than a flat percentage of maximum.","The \"fat burning zone\" is a persistent misunderstanding. Lower intensities use a higher proportion of fat but fewer total calories; for most goals, total work done matters more.","Measure resting heart rate first thing in the morning, before getting up, averaged over several days.","If you have a heart condition, take medication affecting heart rate such as beta blockers, or are returning to exercise after a long break, discuss target zones with a clinician — these formulas will not apply to you."],
"faq": [{"q":"Why 208 − 0.7 × age rather than 220 − age?","a":"The 220 − age rule was never derived from careful research and systematically underestimates maximum heart rate in older adults. The Tanaka equation comes from a meta-analysis and fits observed data better across the age range."}]
};
})();