(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["body-fat"] = {
"title": "Body Fat Percentage Estimator",
"category": "health",
"description": "Estimate body fat percentage from tape measurements using the US Navy circumference method.",
"keywords": ["body fat calculator","body fat percentage","navy method body fat","lean mass calculator"],
"formula": "US Navy circumference method — a logarithmic fit to tape measurements",
"unitSystem": {"key":"system","imperial":"imperial","scale":{"height":0.393700787402,"neck":0.393700787402,"waist":0.393700787402,"hip":0.393700787402,"weight":2.20462262185},"dp":1},
"inputs": [{"key":"sex","label":"Sex assigned at birth","type":"select","options":[{"value":"male","label":"Male"},{"value":"female","label":"Female"}],"default":"male"},{"key":"system","label":"Units","type":"select","options":[{"value":"metric","label":"Metric (cm, kg)"},{"value":"imperial","label":"Imperial (in, lb)"}],"default":"metric"},{"key":"height","label":"Height","type":"number","default":175,"min":0},{"key":"neck","label":"Neck circumference","type":"number","default":38,"min":0},{"key":"waist","label":"Waist circumference (at the navel)","type":"number","default":85,"min":0},{"key":"hip","label":"Hip circumference (widest point, female only)","type":"number","default":95,"min":0},{"key":"weight","label":"Weight (optional, for lean mass)","type":"number","default":70,"min":0}],
"compute": ({ sex, system, height, neck, waist, hip, weight }) => {
      const f = system === 'imperial' ? 2.54 : 1;
      const h = (Number(height) || 0) * f;
      const n = (Number(neck) || 0) * f;
      const w = (Number(waist) || 0) * f;
      const hp = (Number(hip) || 0) * f;
      const kg = (Number(weight) || 0) * (system === 'imperial' ? 0.45359237 : 1);

      if (!h || !n || !w) return { note: 'Height, neck and waist are all needed.' };
      if (sex === 'female' && !hp) return { note: 'The female formula also needs a hip measurement.' };
      if (w <= n) return { note: 'The waist measurement should be larger than the neck. Check both.' };

      let bf;
      if (sex === 'male') {
        bf = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
      } else {
        bf = 495 / (1.29579 - 0.35004 * Math.log10(w + hp - n) + 0.22100 * Math.log10(h)) - 450;
      }
      if (!isFinite(bf) || bf <= 0 || bf > 70) {
        return { note: 'Those measurements produce an implausible result. Check that each was taken in the stated units and at the stated point.' };
      }

      const fatMass = kg ? kg * (bf / 100) : NaN;
      return {
        bodyFat: bf,
        range: `${(bf - 3.5).toFixed(1)}% – ${(bf + 3.5).toFixed(1)}%`,
        fatMass,
        leanMass: kg ? kg - fatMass : NaN,
        waistHeight: h ? w / h : NaN,
        note: ''
      };
    },
"outputs": [{"key":"bodyFat","label":"Estimated body fat","format":"percent","primary":true},{"key":"range","label":"Likely range (±3.5 points)","format":"text"},{"key":"fatMass","label":"Estimated fat mass","format":"number","unit":"kg"},{"key":"leanMass","label":"Estimated lean mass","format":"number","unit":"kg"},{"key":"waistHeight","label":"Waist-to-height ratio","format":"number"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      if (r.bodyFat === undefined) return [];
      const k = v.system === 'imperial' ? 2.54 : 1;
      const h = Number(v.height) * k, n = Number(v.neck) * k, w = Number(v.waist) * k, hp = Number(v.hip) * k;
      return v.sex === 'male'
        ? ['body fat = 495 ÷ (1.0324 − 0.19077 × log₁₀(' + f.upto(w, 2) + ' − ' + f.upto(n, 2) + ') + 0.15456 × log₁₀(' + f.upto(h, 2) + ')) − 450 = ' + f.pct(r.bodyFat, 1)]
        : ['body fat = 495 ÷ (1.29579 − 0.35004 × log₁₀(' + f.upto(w, 2) + ' + ' + f.upto(hp, 2) + ' − ' + f.upto(n, 2) + ') + 0.22100 × log₁₀(' + f.upto(h, 2) + ')) − 450 = ' + f.pct(r.bodyFat, 1)];
    },
"tips": ["It opens in metric or imperial as set in Settings, and switching the units converts the figures already entered, so 70 kg becomes 154.3 lb rather than 70 lb.","The Navy method is accurate to roughly ±3.5 percentage points against a DEXA scan, and can be further out for very lean or very heavy people. Treat the range as the real answer, not the single figure.","Measure at the same time of day, unclothed at the measurement point, with the tape snug but not compressing. Small differences in tape placement move the result more than most real change does.","Waist-to-height ratio is a simpler measure with better evidence behind it for health risk. Below 0.5 is the usual guidance, and it needs only two measurements.","Body fat percentage is one descriptive number among many. It says nothing about fitness, strength, blood markers or how you feel, and a single reading says nothing at all about a trend."],
"faq": [{"q":"What is a healthy body fat percentage?","a":"Ranges published by fitness organisations vary widely and are not clinical thresholds. Essential fat is roughly 3% for men and 12% for women, below which health is compromised. Beyond that, there is no single healthy figure — it depends on age, sex, genetics and context. A clinician can interpret it alongside things that matter more."},{"q":"Why does my result differ from a smart scale?","a":"Bioelectrical impedance scales estimate from body water, which swings with hydration, food, exercise and time of day. Neither method is a direct measurement. Both are more useful for tracking a direction over months than for a single number today."}]
};
})();