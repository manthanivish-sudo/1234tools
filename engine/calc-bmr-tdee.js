(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["bmr-tdee"] = {
"title": "BMR & Daily Energy Calculator",
"category": "health",
"description": "Estimate resting metabolic rate and total daily energy expenditure using the Mifflin-St Jeor equation.",
"keywords": ["BMR calculator","TDEE calculator","daily calorie needs","metabolic rate","maintenance calories"],
"formula": "Mifflin-St Jeor: BMR = 10w + 6.25h − 5a + s, then × activity factor",
"unitSystem": {"key":"system","imperial":"imperial","scale":{"weight":2.20462262185,"height":0.393700787402},"dp":1},
"inputs": [{"key":"system","label":"Units","type":"select","options":[{"value":"metric","label":"Metric (kg, cm)"},{"value":"imperial","label":"Imperial (lb, in)"}],"default":"metric"},{"key":"weight","label":"Weight","type":"number","default":70,"min":0},{"key":"height","label":"Height","type":"number","default":175,"min":0},{"key":"age","label":"Age","type":"number","unit":"years","default":30,"min":15,"max":100},{"key":"sex","label":"Sex assigned at birth","type":"select","options":[{"value":"male","label":"Male"},{"value":"female","label":"Female"}],"default":"male"},{"key":"activity","label":"Activity level","type":"select","options":[{"value":"1.2","label":"Sedentary — desk job, little exercise"},{"value":"1.375","label":"Lightly active — 1–3 sessions a week"},{"value":"1.55","label":"Moderately active — 3–5 sessions a week"},{"value":"1.725","label":"Very active — 6–7 sessions a week"},{"value":"1.9","label":"Extremely active — physical job or twice daily"}],"default":"1.375"}],
"compute": ({ system, weight, height, age, sex, activity }) => {
      let kg = Number(weight) || 0, cm = Number(height) || 0;
      if (system === 'imperial') { kg = kg * 0.45359237; cm = cm * 2.54; }
      const a = Number(age) || 0;
      if (!kg || !cm || !a) return { note: 'Fill in weight, height and age.' };

      const bmr = 10 * kg + 6.25 * cm - 5 * a + (sex === 'male' ? 5 : -161);
      const tdee = bmr * Number(activity);

      /* Widely cited minimum intakes below which nutritional adequacy is
         difficult and medical supervision is normally advised. Stated as a
         floor, not as a target. */
      const floor = sex === 'male' ? 1500 : 1200;

      return {
        tdee,
        bmr,
        perKgBmr: kg ? bmr / kg : NaN,
        activityBurn: tdee - bmr,
        floor,
        range: `${Math.round(tdee * 0.9)} – ${Math.round(tdee * 1.1)} kcal`,
        note: ''
      };
    },
"outputs": [{"key":"tdee","label":"Estimated daily energy use","format":"number","unit":"kcal","primary":true},{"key":"range","label":"Realistic range (±10%)","format":"text"},{"key":"bmr","label":"Basal metabolic rate (at rest)","format":"number","unit":"kcal"},{"key":"activityBurn","label":"Attributed to activity","format":"number","unit":"kcal"},{"key":"floor","label":"Intake below which supervision is advised","format":"number","unit":"kcal"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      if (r.bmr === undefined) return [];
      const imp = v.system === 'imperial';
      const kg = (Number(v.weight) || 0) * (imp ? 0.45359237 : 1), cm = (Number(v.height) || 0) * (imp ? 2.54 : 1);
      return ['BMR = 10 × ' + f.upto(kg, 2) + ' + 6.25 × ' + f.upto(cm, 2) + ' − 5 × ' + f.upto(Number(v.age), 0) + (v.sex === 'male' ? ' + 5' : ' − 161') + ' = ' + f.upto(r.bmr, 1) + ' kcal',
        'TDEE = ' + f.upto(r.bmr, 1) + ' × ' + v.activity + ' = ' + f.upto(r.tdee, 1) + ' kcal'];
    },
"tips": ["It opens in metric or imperial as set in Settings, and switching the units converts the figures already entered, so 70 kg becomes 154.3 lb rather than 70 lb.","This is an estimate from a population equation. Individual metabolic rates vary by roughly 10% in either direction even between people with identical measurements, which is why a range is shown alongside the figure.","Activity multipliers are the least reliable part. Most people overestimate their activity level — if in doubt, choose the category below the one you were about to pick.","The equation was derived from adults without medical conditions. Pregnancy, thyroid disorders, some medications and a history of significant weight change all shift the result, sometimes substantially.","Sustained intake below roughly 1,500 kcal for men or 1,200 for women makes nutritional adequacy difficult and is normally something to do under medical supervision rather than alone.","If food, weight or eating feels distressing or preoccupying, a number from a calculator is unlikely to help. Speaking to a GP or a registered dietitian is a better next step."],
"faq": [{"q":"Should I eat this many calories?","a":"This tool estimates what your body uses; it does not tell you what to eat. Appropriate intake depends on your health, goals, medical history and a great deal this calculator has no knowledge of. A registered dietitian can advise on that properly, and will account for things a formula cannot."},{"q":"Why does my figure differ from another calculator?","a":"Different equations. Mifflin-St Jeor is used here because it is the most accurate for the general adult population, but Harris-Benedict, Katch-McArdle and others exist and give different results. None is exact for an individual."},{"q":"Is a lower number better?","a":"No. A lower basal rate simply means a smaller or older body, not a worse one. It is a description, not a score."}]
};
})();