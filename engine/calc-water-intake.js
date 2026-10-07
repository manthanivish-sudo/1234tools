(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["water-intake"] = {
"title": "Daily Water Intake Estimator",
"category": "health",
"description": "A rough guide to daily fluid needs based on body weight, activity and climate.",
"keywords": ["water intake calculator","how much water should I drink","daily hydration","fluid intake calculator"],
"formula": "roughly 30–35 ml per kg of body weight, adjusted for activity and heat",
"unitSystem": {"key":"system","imperial":"imperial","scale":{"weight":2.20462262185},"dp":1},
"inputs": [{"key":"system","label":"Units","type":"select","options":[{"value":"metric","label":"Metric (kg)"},{"value":"imperial","label":"Imperial (lb)"}],"default":"metric"},{"key":"weight","label":"Weight","type":"number","default":70,"min":0},{"key":"exercise","label":"Exercise per day","type":"number","unit":"minutes","default":30,"min":0,"max":600},{"key":"climate","label":"Climate","type":"select","options":[{"value":"1","label":"Temperate"},{"value":"1.15","label":"Warm"},{"value":"1.3","label":"Hot or humid"}],"default":"1"}],
"compute": ({ system, weight, exercise, climate }) => {
      const kg = (Number(weight) || 0) * (system === 'imperial' ? 0.45359237 : 1);
      if (!kg) return { note: 'Enter a weight.' };
      const mins = Math.max(0, Math.min(600, Number(exercise) || 0));

      const base = kg * 33;                       // ml
      const fromExercise = (mins / 30) * 350;
      const total = (base + fromExercise) * Number(climate);

      return {
        litres: total / 1000,
        low: (total * 0.85) / 1000,
        high: (total * 1.15) / 1000,
        glasses: total / 250,
        fromFood: (total * 0.2) / 1000,
        fromDrinks: (total * 0.8) / 1000,
        pints: total / 568.26,
        note: ''
      };
    },
"outputs": [{"key":"litres","label":"Rough daily total","format":"number","unit":"L","primary":true},{"key":"low","label":"Lower end of the range","format":"number","unit":"L"},{"key":"high","label":"Upper end of the range","format":"number","unit":"L"},{"key":"fromDrinks","label":"Typically from drinks (~80%)","format":"number","unit":"L"},{"key":"fromFood","label":"Typically from food (~20%)","format":"number","unit":"L"},{"key":"glasses","label":"Roughly, 250 ml glasses","format":"number"},{"key":"pints","label":"Pints","format":"number"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      if (r.litres === undefined) return [];
      const kg = (Number(v.weight) || 0) * (v.system === 'imperial' ? 0.45359237 : 1);
      return ['(' + f.upto(kg, 2) + ' kg × 33 ml + ' + f.upto(Number(v.exercise) || 0, 0) + ' min ÷ 30 × 350 ml) × ' + v.climate + ' = ' + f.upto(r.litres, 2) + ' litres a day'];
    },
"tips": ["It opens in metric or imperial as set in Settings, and switching the units converts the figures already entered, so 70 kg becomes 154.3 lb rather than 70 lb.","Thirst is a good guide for most healthy adults. Pale straw-coloured urine is a more useful signal than hitting a numeric target.","Around a fifth of typical fluid intake comes from food. Tea, coffee and juice all count towards the total — the idea that caffeine dehydrates at normal intakes is not supported by the evidence.","Needs rise with exercise, heat, altitude, fever, pregnancy and breastfeeding, and fall in cold weather.","Drinking far beyond thirst is not benign. Consuming several litres in a short period can dilute blood sodium dangerously, which is a genuine medical emergency.","Kidney disease, heart failure and some medications change fluid requirements substantially. If any apply, follow your clinician’s advice rather than a general formula."],
"faq": [{"q":"Is eight glasses a day correct?","a":"It is a memorable rule with no strong evidence behind it. Actual needs vary with body size, activity, climate and diet, which is why this shows a range rather than a single figure. For most healthy people, drinking to thirst works."}]
};
})();