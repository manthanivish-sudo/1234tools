(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["ideal-weight"] = {
"title": "Reference Weight Range Calculator",
"category": "health",
"description": "Weight ranges from the standard clinical formulas, with a clear account of what they can and cannot tell you.",
"keywords": ["ideal weight calculator","healthy weight range","weight for height","devine formula","BMI weight range"],
"formula": "Devine, Robinson, Miller and Hamwi formulas, plus the BMI 18.5–24.9 range",
"unitSystem": {"key":"system","imperial":"imperial","scale":{"height":0.393700787402},"dp":1},
"inputs": [{"key":"sex","label":"Sex assigned at birth","type":"select","options":[{"value":"male","label":"Male"},{"value":"female","label":"Female"}],"default":"male"},{"key":"system","label":"Units","type":"select","options":[{"value":"metric","label":"Metric (cm)"},{"value":"imperial","label":"Imperial (in)"}],"default":"metric"},{"key":"height","label":"Height","type":"number","default":175,"min":100,"max":250}],
"compute": ({ sex, system, height }) => {
      const cm = (Number(height) || 0) * (system === 'imperial' ? 2.54 : 1);
      if (cm < 120 || cm > 230) return { note: 'Enter a height between about 120 cm and 230 cm.' };
      const inchesOver5ft = Math.max(0, (cm - 152.4) / 2.54);
      const male = sex === 'male';

      const devine   = (male ? 50   : 45.5) + 2.3   * inchesOver5ft;
      const robinson = (male ? 52   : 49)   + 1.9   * inchesOver5ft;
      const miller   = (male ? 56.2 : 53.1) + 1.41  * inchesOver5ft;
      const hamwi    = (male ? 48   : 45.5) + 2.7   * inchesOver5ft;

      const m = cm / 100;
      const bmiLow = 18.5 * m * m, bmiHigh = 24.9 * m * m;
      const avg = (devine + robinson + miller + hamwi) / 4;

      return {
        bmiRange: `${bmiLow.toFixed(1)} – ${bmiHigh.toFixed(1)} kg`,
        formulaAverage: avg,
        devine, robinson, miller, hamwi,
        spread: Math.max(devine, robinson, miller, hamwi) - Math.min(devine, robinson, miller, hamwi),
        note: ''
      };
    },
"outputs": [{"key":"bmiRange","label":"Range for BMI 18.5–24.9","format":"text","primary":true},{"key":"formulaAverage","label":"Average of the four formulas","format":"number","unit":"kg"},{"key":"devine","label":"Devine (1974)","format":"number","unit":"kg"},{"key":"robinson","label":"Robinson (1983)","format":"number","unit":"kg"},{"key":"miller","label":"Miller (1983)","format":"number","unit":"kg"},{"key":"hamwi","label":"Hamwi (1964)","format":"number","unit":"kg"},{"key":"spread","label":"Disagreement between formulas","format":"number","unit":"kg"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      if (r.devine === undefined) return [];
      const cm = (Number(v.height) || 0) * (v.system === 'imperial' ? 2.54 : 1), over = Math.max(0, (cm - 152.4) / 2.54);
      return ['inches over 5 ft = (' + f.upto(cm, 2) + ' − 152.4) ÷ 2.54 = ' + f.upto(over, 3),
        'Devine = ' + (v.sex === 'male' ? '50' : '45.5') + ' + 2.3 × ' + f.upto(over, 3) + ' = ' + f.num(r.devine, 1) + ' kg',
        'BMI range = 18.5 × ' + f.upto(cm / 100, 3) + '² to 24.9 × ' + f.upto(cm / 100, 3) + '² = ' + r.bmiRange];
    },
"tips": ["It opens in metric or imperial as set in Settings, and switching the units converts the figures already entered, so 175 cm becomes 68.9 in rather than 175 in.","The four formulas are shown side by side deliberately. They never agree: for a man they are 8.2 kg apart at 5 ft, 4.7 kg apart at 5 ft 10 in and never closer than about a kilogram, which is the clearest evidence that none of them is authoritative.","Devine and Hamwi were written to calculate drug dosages, not to advise anyone on their weight. They were never intended for this use.","None of these formulas accounts for build, muscle mass, age or ethnicity. A muscular person will read as \"over\" every one of them while being perfectly healthy.","The BMI range is broad on purpose. Health outcomes vary far more within it than the range boundaries suggest, and the edges are not cliffs.","There is no single correct weight for a given height. If you are trying to decide what weight is right for you, that is a conversation with a clinician who knows your history, not an output of a formula."],
"faq": [{"q":"Which formula should I trust?","a":"None of them, individually. They are shown together to make the disagreement visible. If you need a clinically meaningful assessment, a GP will consider blood pressure, blood markers, fitness, family history and how you actually feel — none of which a height-based formula can see."},{"q":"I am outside every range. Is that a problem?","a":"Not necessarily, and not something a calculator can determine. Athletes, older adults and people with different builds sit outside these ranges routinely while being healthy. If you are concerned, that is worth raising with a GP rather than resolving with arithmetic."}]
};
})();