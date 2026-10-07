/**
 * Claims on the everyday calculators: /health/ and /education/
 * (the pages that mount a calculator; /time/ moved to claims/time.js in wave 4,
 * the school-office file tools are other tool types).
 *
 * Every check runs the page's own engine in Node (K.calc), with the clock
 * held at 2026-10-04 12:00 unless the claim is about the clock. The date
 * oracles in four time zones live in build/tests/engines.js; these check
 * the sentences: boundaries either side of every category limit, the
 * clamps the page names, inclusive and exclusive counting, month ends,
 * leap days and ISO week 53. Medical, legal and study advice is listed as
 * manual with the reason.
 */
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node';
  const NOW = '2026-10-04T12:00:00';
  const run = (url, inputs, now) => K.calc(url, inputs, { now: now || NOW });
  const specOf = (url) => K.calcSpec(url, { now: NOW });
  const close = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol) * Math.max(1, Math.abs(b));
  const input = (url, key) => (specOf(url).inputs || []).find((i) => i.key === key) || {};
  const output = (url, key) => (specOf(url).outputs || []).find((o) => o.key === key) || {};
  const optVals = (url, key) => (input(url, key).options || []).map((o) => String(o.value));
  const optLabels = (url, key) => (input(url, key).options || []).map((o) => String(o.label));
  /* the first case that fails, or a pass naming how many were tried */
  const every = (cases, fn) => { for (const c of cases) { const r = fn(c); if (!r[0]) return r; } return [true, cases.length + ' cases hold']; };
  /* calendar dates as plain UTC days */
  const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const dow = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
  const shortD = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const longD = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  /* a seeded generator, so a failing case reproduces */
  let seed = 0x5eed;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const randISO = (y0, y1) => addDays(y0 + '-01-01', int(0, daysBetween(y0 + '-01-01', y1 + '-12-31')));

  /* ================================================================ */
  /* /health/                                                          */
  /* ================================================================ */

  const BMI = '/health/bmi/';
  const bmi = (i) => run(BMI, i);
  /* at a height of 100 cm the BMI is the weight itself, so a boundary can be hit exactly */
  const bmiCat = (b) => bmi({ height: 100, weight: b }).category;
  {
    const both = async () => {
      const a = bmi({ weight: 70, height: 175 }), up = specOf(BMI).linkUpgrade({ system: 'imperial', weight: String(70 / 0.45359237), height: String(175 / 2.54) }), b = bmi({ weight: Number(up.weight), height: Number(up.height) });
      return [close(a.bmi, 70 / (1.75 * 1.75)) && close(b.bmi, a.bmi), a.bmi + ' metric, ' + b.bmi + ' imperial'];
    };
    claim(BMI, 'lede', 'Calculate Body Mass Index from height and weight, in metric or imperial units.', 'the same person in both unit systems', N, both);
    claim(BMI, 'card', 'Calculate Body Mass Index from height and weight, in metric or imperial units.', 'the same person in both unit systems', N, both);
    claim(BMI, 'why', 'Enter height and weight. Get your BMI and its standard category.', 'a BMI and a category come back', N, async () => {
      const r = bmi({ weight: 82, height: 180 }); return [close(r.bmi, 82 / 3.24) && r.category === 'Above the healthy range', K.j(r)];
    });
    claim(BMI, 'what', 'Body mass index is your weight in kilograms divided by the square of your height in metres.', 'kg ÷ m² on three people', N, async () =>
      every([[50, 160], [70, 175], [120, 192]], ([w, h]) => { const r = bmi({ weight: w, height: h }); return [close(r.bmi, w / Math.pow(h / 100, 2)), w + ' kg ' + h + ' cm → ' + r.bmi]; }));
    claim(BMI, 'works', 'Height is squared, so it moves the result more than weight does.', '1% more height vs 1% more weight', N, async () => {
      const b = bmi({ weight: 70, height: 175 }).bmi, h = bmi({ weight: 70, height: 176.75 }).bmi, w = bmi({ weight: 70.7, height: 175 }).bmi;
      return [Math.abs(h - b) > Math.abs(w - b), 'height +1%: ' + (h - b).toFixed(3) + ', weight +1%: ' + (w - b).toFixed(3)];
    });
    claim(BMI, 'works', 'Weight in stones and pounds and height in feet and inches are first turned into kilograms and metres, then the same formula applies.', 'the weight and height fields hold kg and cm, entered in any of their units', N, async () => {
      const ins = specOf(BMI).inputs || [];
      const w = ins.find((i) => i.key === 'weight') || {}, h = ins.find((i) => i.key === 'height') || {};
      const lb = 154, st = 11, inch = 66;
      const r = bmi({ weight: st * 14 * 0.45359237, height: inch * 2.54 });
      const want = lb * 0.45359237 / Math.pow(inch * 0.0254, 2);
      return [w.type === 'weight' && h.type === 'height' && close(r.bmi, want), w.type + '/' + h.type + '; 11 st, 5 ft 6 in → ' + r.bmi];
    });
    claim(BMI, 'works', 'imperial: BMI = (lb × 0.45359237) ÷ (in × 0.0254)²', '(lb × 0.45359237) ÷ (in × 0.0254)², and an old imperial link is read the same', N, async () =>
      every([[154, 66], [180, 70], [250, 75]], ([lb, inch]) => {
        const r = bmi({ weight: lb * 0.45359237, height: inch * 2.54 });
        const up = specOf(BMI).linkUpgrade({ system: 'imperial', weight: String(lb), height: String(inch) });
        const viaLink = bmi({ weight: Number(up.weight), height: Number(up.height) });
        const want = lb * 0.45359237 / Math.pow(inch * 0.0254, 2);
        return [close(r.bmi, want) && close(viaLink.bmi, want) && up.system === undefined, lb + ' lb ' + inch + ' in → ' + r.bmi + ' (want ' + want + ')'];
      }));
    claim(BMI, 'worked', 'The range ends at 25, so about 0.4 kg more would move them into the next band.', 'the kilograms to the next band at 1.6764 m', N, async () => {
      const kg = 154 * 0.45359237, need = 25 * 1.6764 * 1.6764 - kg;
      const under = bmi({ weight: kg + need - 0.01, height: 167.64 }).category, over = bmi({ weight: kg + need + 0.01, height: 167.64 }).category;
      return [need > 0.35 && need < 0.45 && under === 'Within the healthy range' && over === 'Above the healthy range', need.toFixed(3) + ' kg; ' + under + ' → ' + over];
    });
    claim(BMI, 'mistake', 'It expects centimetres, so 1.75 m goes in as 175', '175 vs 1.75 in the centimetre box', N, async () => {
      const a = bmi({ weight: 70, height: 175 }).bmi, b = bmi({ weight: 70, height: 1.75 }).bmi; return [a > 22 && a < 23 && b > 1000, a + ' vs ' + b];
    });
    claim(BMI, 'mistake', 'Under 18, enter the age and sex: the result is then a centile for age, not an adult category.', 'age 10 gives a centile and a for-age category; 18 the adult one', N, async () => {
      const c = bmi({ weight: 30, height: 135, age: 10, sex: 'female' }), a = bmi({ weight: 30, height: 135, age: 18, sex: 'female' });
      return [/centile/.test(c.centile || '') && /for age$/.test(c.category) && !a.centile && !/for age/.test(a.category), c.centile + ' / ' + c.category + ' | ' + a.category];
    });
    claim(BMI, 'dfaq', 'For most adults the NHS uses 18.5 to 24.9', 'healthy from 18.5 to under 25', N, async () => {
      const r = [18.49, 18.5, 24.9, 24.99].map(bmiCat); return [r[0] === 'Below the healthy range' && r.slice(1).every((c) => c === 'Within the healthy range'), r.join(' | ')];
    });
    claim(BMI, 'dfaq', '25 to 30 is above that range and 30 or more well above it', '25, 29.99, 30 and 45', N, async () => {
      const r = [25, 29.99, 30, 45].map(bmiCat); return [r[0] === 'Above the healthy range' && r[1] === 'Above the healthy range' && r[2] === 'Well above the healthy range' && r[3] === r[2], r.join(' | ')];
    });
    const asianCat = (b) => bmi({ height: 100, weight: b, background: 'asian' }).category;
    claim(BMI, 'dfaq', 'Lower thresholds, 23 and 27.5, are used for people of South Asian, Chinese, other Asian, Middle Eastern, Black African or African-Caribbean background; choose that background above to apply them.', '22.99, 23, 27.49, 27.5', N, async () => {
      const r = [22.99, 23, 27.49, 27.5].map(asianCat);
      return [r[0] === 'Within the healthy range' && r[1] === 'Above the healthy range' && r[2] === 'Above the healthy range' && r[3] === 'Well above the healthy range', r.join(' | ')];
    });
    claim(BMI, 'tip', 'the NHS and NICE use lower thresholds: overweight from 23 and obesity from 27.5. Choose that background to apply them.', 'the background option and its thresholds', N, async () => {
      const o = ((specOf(BMI).inputs || []).find((i) => i.key === 'background') || {}).options || [];
      return [o.length === 2 && /South Asian, Chinese, other Asian, Middle Eastern, Black African or African-Caribbean/.test(o[1].label) && asianCat(23) === 'Above the healthy range' && asianCat(27.5) === 'Well above the healthy range', o.map((x) => x.label).join(' | ')];
    });
    claim(BMI, 'dfaq', 'For 180 lb at 70 inches that is 180 × 703 ÷ 4,900, a BMI of 25.8; entering 180 lb and 5 ft 10 in here gives the same answer.', '180 lb, 70 in', N, async () => {
      const r = bmi({ weight: 180 * 0.45359237, height: 70 * 2.54 }).bmi; return [r.toFixed(1) === '25.8' && (180 * 703 / 4900).toFixed(1) === '25.8', r];
    });
    claim(BMI, 'dfaq', 'The formula and the adult cut-offs are the same for both.', 'adults: sex changes nothing', N, async () => {
      const a = bmi({ weight: 82, height: 180, sex: 'male' }), b = bmi({ weight: 82, height: 180, sex: 'female' });
      return [K.j(a) === K.j(b), a.bmi + ' ' + a.category];
    });
    /* children: the centile against the CDC's own published centile curves
       (build/tests/fixtures/cdc-bmiagerev.csv, columns P5, P85 and P95), not
       against the engine's arithmetic */
    const CDC = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'cdc-bmiagerev.csv'), 'utf8').trim().split(/\r?\n/).slice(1).map((l) => l.split(',').map(Number));
    const childAt = (sex, months, b) => bmi({ weight: b, height: 100, age: (months - 0.5) / 12, sex: sex === 1 ? 'male' : 'female' });
    claim(BMI, 'tip', 'Under 18, a BMI is read against centiles for age and sex. This calculator uses the CDC 2000 BMI-for-age reference', 'just under and over the CDC 5th, 85th and 95th centile curves, both sexes, ages 2 to 17', N, async () => {
      const bad = [];
      CDC.filter((r) => r[1] >= 24.5 && r[1] < 216 && (r[1] - 24.5) % 18 === 0).forEach((r) => {
        [[6, 'Below the healthy range for age', 'Within the healthy range for age'], [11, 'Within the healthy range for age', 'Above the healthy range for age'], [13, 'Above the healthy range for age', 'Well above the healthy range for age']].forEach(([col, below, above]) => {
          const p = r[col];
          const a = childAt(r[0], r[1], p * (1 - 1e-4)).category, b = childAt(r[0], r[1], p * (1 + 1e-4)).category;
          if (a !== below || b !== above) bad.push((r[0] === 1 ? 'boy ' : 'girl ') + r[1] + ' mo P' + ({ 6: 5, 11: 85, 13: 95 })[col] + ': ' + a + ' / ' + b);
        });
      });
      return [!bad.length, bad.slice(0, 3).join('; ') || 'every curve, both sides'];
    });
    claim(BMI, 'faq', 'The US Centers for Disease Control and Prevention’s 2000 BMI-for-age charts, from 2 to 18 years, by sex.', 'a centile at 2 and at 17, none at 18; the median is the 50th', N, async () => {
      const med = CDC.find((r) => r[0] === 2 && r[1] === 120.5)[9];
      const m = childAt(2, 120.5, med).centile, y2 = bmi({ weight: 16, height: 100, age: 2 }).centile, y17 = bmi({ weight: 20, height: 100, age: 17 }).centile, y18 = bmi({ weight: 20, height: 100, age: 18 }).centile;
      return [m === 'the 50th centile' && !!y2 && !!y17 && !y18, m + '; ' + y2 + '; ' + y17 + '; 18: ' + y18];
    });
    claim(BMI, 'tip', 'A waist measurement more than half your height means increased health risk whatever the BMI, which is why the waist-to-height ratio is shown when you give one.', 'waist ÷ height, and its bands', N, async () => {
      const r = [79, 87.5, 105].map((w) => bmi({ weight: 70, height: 175, waist: w }));
      const none = bmi({ weight: 70, height: 175 });
      return [close(r[0].whtr, 79 / 175) && /no increased/.test(r[0].whtrNote) && /^0\.5 to 0\.59: increased/.test(r[1].whtrNote) && /high/.test(r[2].whtrNote) && none.whtr === undefined, r.map((x) => x.whtr.toFixed(3) + ' ' + x.whtrNote).join(' | ')];
    });
    claim(BMI, 'tip', 'Weight and height can be entered in kilograms or stones and pounds, and in centimetres or feet and inches; the units preference in Settings sets which opens first.', 'composite fields; the shell opens them on the preference', N, async () => {
      const ins = specOf(BMI).inputs || [];
      const src = K.read('engine/render-core.js').toString('utf8');
      return [ins.find((i) => i.key === 'weight').type === 'weight' && ins.find((i) => i.key === 'height').type === 'height' && /stlb: \{ label: 'st \+ lb'/.test(src) && /ftin: \{ label: 'ft \+ in'/.test(src) && /P\(\)\.units\(\) === 'imperial'/.test(src), ins.map((i) => i.key + ':' + i.type).join(', ')];
    });
    claim(BMI, 'tip', 'The healthy weight for your height is shown as 18.5 × height² up to 25 × height² (23 for the backgrounds above), in kilograms and in stones and pounds.', '18.5 × m² to 25 × m², in kg and st/lb', N, async () => {
      const r = bmi({ weight: 70, height: 175 });
      const lo = 18.5 * 1.75 * 1.75, hi = 25 * 1.75 * 1.75;
      const stlb = (kg) => { const lb = kg / 0.45359237; let s = Math.floor(lb / 14), l = Math.round(lb - s * 14); if (l === 14) { s++; l = 0; } return s + ' st ' + l + ' lb'; };
      const want = lo.toFixed(1) + ' kg (' + stlb(lo) + ') to ' + hi.toFixed(1) + ' kg (' + stlb(hi) + ')';
      return [r.healthyRange === want && close(r.prime, r.bmi / 25), r.healthyRange];
    });
    claim(BMI, 'formula', 'BMI = weight(kg) / height(m)²', 'compute() follows it, and a zero height gives no figure', N, async () => {
      const r = every([[0.5, 40], [70, 175], [300, 250]], ([w, h]) => { const x = bmi({ weight: w, height: h }); return [close(x.bmi, w / Math.pow(h / 100, 2)), w + '/' + h + ' → ' + x.bmi]; });
      const z = bmi({ weight: 70, height: 0 });
      return [r[0] && z.bmi === undefined, r[1] + '; height 0 → ' + K.j(z)];
    });
    claim(BMI, 'tip', 'It does not distinguish muscle from fat, so it misclassifies athletes and very muscular people.', 'only weight and height go in: a 100 kg, 185 cm athlete reads as above the range', N, async () => {
      const r = bmi({ weight: 100, height: 185 }); return [r.category === 'Above the healthy range', r.bmi + ' ' + r.category];
    });
    manual(BMI, 'tip', 'BMI is a population-level screening measure, not a diagnosis or a measure of health.', 'medical framing; no behaviour to test');
    manual(BMI, 'tip', 'Treat any result as a prompt for a conversation with a clinician rather than a conclusion in itself.', 'advice to see a clinician');
    manual(BMI, 'faq', 'Waist circumference, body composition, blood markers, fitness, and clinical history all say considerably more', 'medical guidance');
  }

  const BMR = '/health/bmr-tdee/';
  const bmr = (i) => run(BMR, i);
  const msj = (kg, cm, age, sex) => 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161);
  {
    const people = [[70, 175, 30, 'male', '1.375'], [62, 165, 45, 'female', '1.2'], [95, 190, 60, 'male', '1.9'], [50, 152, 19, 'female', '1.725']];
    const follows = async () => every(people, ([kg, cm, age, sex, act]) => {
      const r = bmr({ weight: kg, height: cm, age, sex, activity: act }); const b = msj(kg, cm, age, sex);
      return [close(r.bmr, b) && close(r.tdee, b * Number(act)), [kg, cm, age, sex, act].join('/') + ' → ' + r.bmr + ', ' + r.tdee];
    });
    claim(BMR, 'lede', 'Estimate resting metabolic rate and total daily energy expenditure using the Mifflin-St Jeor equation.', 'BMR and TDEE on four people', N, follows);
    claim(BMR, 'card', 'Estimate resting metabolic rate and total daily energy expenditure using the Mifflin-St Jeor equation.', 'BMR and TDEE on four people', N, follows);
    claim(BMR, 'formula', 'Mifflin-St Jeor: BMR = 10w + 6.25h − 5a + s, then × activity factor', 'four people, both sexes, all factors', N, follows);
    claim(BMR, 'works', 'BMR = 10 × kg + 6.25 × cm − 5 × age + 5 (male)', 'male constant +5', N, follows);
    claim(BMR, 'works', 'BMR = 10 × kg + 6.25 × cm − 5 × age − 161 (female)', 'female constant −161', N, async () => {
      const m = bmr({ sex: 'male' }).bmr, f = bmr({ sex: 'female' }).bmr; return [close(m - f, 166) && close(f, msj(70, 175, 30, 'female')), m + ' − ' + f];
    });
    claim(BMR, 'why', 'Enter your details. Get BMR, daily energy use and a ±10% range.', 'the range is TDEE × 0.9 to × 1.1, rounded', N, async () => every(people, ([kg, cm, age, sex, act]) => {
      const r = bmr({ weight: kg, height: cm, age, sex, activity: act }); const want = Math.round(r.tdee * 0.9) + ' – ' + Math.round(r.tdee * 1.1) + ' kcal';
      return [r.range === want && isFinite(r.bmr), r.range + ' (want ' + want + ')'];
    }));
    claim(BMR, 'works', 'TDEE is BMR multiplied by an activity factor between 1.2 and 1.9, and the page shows a band 10% either side of it.', 'factors run 1.2 to 1.9', N, async () => {
      const v = optVals(BMR, 'activity').map(Number); return [Math.min(...v) === 1.2 && Math.max(...v) === 1.9, v.join(', ')];
    });
    claim(BMR, 'what', 'Total daily energy expenditure (TDEE) adds everything you do on top of that.', 'TDEE − BMR is the activity share', N, async () => { const r = bmr({}); return [r.tdee > r.bmr && close(r.activityBurn, r.tdee - r.bmr), K.j(r)]; });
    claim(BMR, 'works', 'weight in kilograms; pounds are multiplied by 0.45359237 first', 'imperial weight', N, async () => {
      const a = bmr({ system: 'imperial', weight: 154, height: 66 }).bmr; return [close(a, msj(154 * 0.45359237, 66 * 2.54, 30, 'male')), a];
    });
    claim(BMR, 'works', 'height in centimetres; inches are multiplied by 2.54', 'imperial height = metric', N, async () => {
      const a = bmr({ system: 'imperial', weight: 70 / 0.45359237, height: 175 / 2.54 }).bmr, b = bmr({}).bmr; return [close(a, b), a + ' vs ' + b];
    });
    claim(BMR, 'works', '1.2 sedentary, 1.375 light, 1.55 moderate, 1.725 very active, 1.9 extremely active', 'the activity menu', N, async () => {
      const v = optVals(BMR, 'activity'), l = optLabels(BMR, 'activity');
      const ok = v.join() === '1.2,1.375,1.55,1.725,1.9' && /^Sedentary/.test(l[0]) && /^Lightly active/.test(l[1]) && /^Moderately active/.test(l[2]) && /^Very active/.test(l[3]) && /^Extremely active/.test(l[4]);
      return [ok, v.map((x, i) => x + ' ' + l[i]).join(' | ')];
    });
    claim(BMR, 'mistake', 'Metric mode wants centimetres and imperial wants total inches, so 5 ft 6 in goes in as 66.', '66 in = 167.64 cm', N, async () => {
      const a = bmr({ system: 'imperial', weight: 70 / 0.45359237, height: 66 }).bmr, b = bmr({ height: 167.64 }).bmr; return [close(a, b), a + ' vs ' + b];
    });
    claim(BMR, 'mistake', 'The factor already includes typical training.', 'the activity choices are described in training sessions', N, async () => {
      const l = optLabels(BMR, 'activity'); return [l.filter((x) => /session|exercise|physical/i.test(x)).length === 5, l.join(' | ')];
    });
    claim(BMR, 'dfaq', 'In this equation, exactly 5 kcal a day for every year, whatever your size. Ten years therefore take 50 kcal off the estimate', 'ten years at two sizes, both sexes', N, async () => every([[70, 175, 'male'], [120, 195, 'female']], ([kg, cm, sex]) => {
      const a = bmr({ weight: kg, height: cm, sex, age: 30 }).bmr, b = bmr({ weight: kg, height: cm, sex, age: 40 }).bmr, c = bmr({ weight: kg, height: cm, sex, age: 31 }).bmr;
      return [close(a - b, 50) && close(a - c, 5), kg + ' kg: ' + (a - b) + ' per decade'];
    }));
    claim(BMR, 'dfaq', 'Multiply by 4.184. UK and EU food labels show both, and 1,500 kcal is 6,276 kJ.', '1,500 × 4.184', N, async () => [close(1500 * 4.184, 6276), 1500 * 4.184]);
    claim(BMR, 'tip', 'which is why a range is shown alongside the figure', 'the ±10% range is an output', N, async () => { const r = bmr({}); return [/^\d+ – \d+ kcal$/.test(r.range), r.range]; });
    claim(BMR, 'tip', 'Sustained intake below roughly 1,500 kcal for men or 1,200 for women', 'the floor shown for each sex', N, async () => {
      const m = bmr({ sex: 'male' }).floor, f = bmr({ sex: 'female' }).floor; return [m === 1500 && f === 1200, m + ' / ' + f];
    });
    claim(BMR, 'faq', 'Mifflin-St Jeor is used here', 'not Harris-Benedict', N, async () => {
      const r = bmr({}).bmr, hb = 88.362 + 13.397 * 70 + 4.799 * 175 - 5.677 * 30; return [close(r, msj(70, 175, 30, 'male')) && Math.abs(r - hb) > 20, r + ' (Harris-Benedict would give ' + hb.toFixed(1) + ')'];
    });
    manual(BMR, 'tip', 'Activity multipliers are the least reliable part.', 'advice on choosing a level');
    manual(BMR, 'tip', 'The equation was derived from adults without medical conditions.', 'medical guidance');
    manual(BMR, 'tip', 'Speaking to a GP or a registered dietitian is a better next step.', 'advice to see a clinician');
    manual(BMR, 'faq', 'A registered dietitian can advise on that properly', 'advice to see a professional');
    manual(BMR, 'faq', 'It is a description, not a score.', 'framing; no behaviour to test');
    manual(BMR, 'dfaq', 'In everyday use the two terms are treated as the same thing.', 'usage of terms; no behaviour to test');
  }

  const BF = '/health/body-fat/';
  const bf = (i) => run(BF, i);
  const navyM = (h, n, w) => 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
  const navyF = (h, n, w, hp) => 495 / (1.29579 - 0.35004 * Math.log10(w + hp - n) + 0.22100 * Math.log10(h)) - 450;
  {
    const male = async () => every([[175, 38, 85], [180, 40, 95], [168, 36, 78]], ([h, n, w]) => {
      const r = bf({ height: h, neck: n, waist: w }); return [close(r.bodyFat, navyM(h, n, w)), [h, n, w].join('/') + ' → ' + r.bodyFat];
    });
    claim(BF, 'lede', 'Estimate body fat percentage from tape measurements using the US Navy circumference method.', 'the Navy equation for men', N, male);
    claim(BF, 'card', 'Estimate body fat percentage from tape measurements using the US Navy circumference method.', 'the Navy equation for men', N, male);
    claim(BF, 'formula', 'US Navy circumference method — a logarithmic fit to tape measurements', 'the Navy equation for men', N, male);
    claim(BF, 'works', 'men: % fat = 495 ÷ (1.0324 − 0.19077 × log₁₀(waist − neck) + 0.15456 × log₁₀(height)) − 450', 'three men', N, male);
    claim(BF, 'works', 'women: % fat = 495 ÷ (1.29579 − 0.35004 × log₁₀(waist + hip − neck) + 0.22100 × log₁₀(height)) − 450', 'three women', N, async () => every([[165, 33, 76, 98], [170, 34, 80, 100], [158, 31, 70, 92]], ([h, n, w, hp]) => {
      const r = bf({ sex: 'female', height: h, neck: n, waist: w, hip: hp }); return [close(r.bodyFat, navyF(h, n, w, hp)), [h, n, w, hp].join('/') + ' → ' + r.bodyFat];
    }));
    claim(BF, 'why', 'Enter neck, waist and height. Get an estimate with its likely range.', 'range = estimate ± 3.5 points', N, async () => {
      const r = bf({}); const want = (r.bodyFat - 3.5).toFixed(1) + '% – ' + (r.bodyFat + 3.5).toFixed(1) + '%'; return [r.range === want, r.range];
    });
    claim(BF, 'tip', 'The Navy method is accurate to roughly ±3.5 percentage points against a DEXA scan', 'the likely range is ±3.5 points', N, async () => {
      const r = bf({ sex: 'female', height: 165, neck: 33, waist: 76, hip: 98 }); const [lo, hi] = r.range.split(' – ').map(parseFloat);
      return [Math.abs(hi - lo - 7) < 0.11 && Math.abs((lo + hi) / 2 - r.bodyFat) < 0.06, r.range + ' around ' + r.bodyFat];
    });
    claim(BF, 'works', 'The version for women adds the hip measurement.', 'hip moves the female result, not the male', N, async () => {
      const m1 = bf({ hip: 90 }).bodyFat, m2 = bf({ hip: 110 }).bodyFat, f1 = bf({ sex: 'female', hip: 90 }).bodyFat, f2 = bf({ sex: 'female', hip: 110 }).bodyFat;
      return [m1 === m2 && f2 > f1, 'male ' + m1 + '/' + m2 + ', female ' + f1 + '/' + f2];
    });
    claim(BF, 'works', 'Imperial inputs are converted to centimetres before anything else.', 'the same person in inches and pounds', N, async () => {
      const a = bf({ sex: 'female', height: 165, neck: 33, waist: 76, hip: 98, weight: 64 });
      const b = bf({ sex: 'female', system: 'imperial', height: 165 / 2.54, neck: 33 / 2.54, waist: 76 / 2.54, hip: 98 / 2.54, weight: 64 / 0.45359237 });
      return [close(a.bodyFat, b.bodyFat, 1e-9) && close(a.fatMass, b.fatMass, 1e-9), a.bodyFat + ' vs ' + b.bodyFat];
    });
    claim(BF, 'works', 'fat mass = weight × % fat ÷ 100 lean mass = weight − fat mass', 'the two masses', N, async () => {
      const r = bf({ weight: 82 }); return [close(r.fatMass, 82 * r.bodyFat / 100) && close(r.leanMass, 82 - r.fatMass), r.fatMass + ' + ' + r.leanMass];
    });
    claim(BF, 'works', 'circumference at the navel, in cm', 'the waist box says "at the navel"', N, async () => { const l = input(BF, 'waist').label; return [/navel/.test(l), l]; });
    claim(BF, 'works', 'circumference at the widest point, in cm (women only)', 'the hip box says "widest point, female only"', N, async () => { const l = input(BF, 'hip').label; return [/widest point/.test(l) && /female only/.test(l), l]; });
    claim(BF, 'what', 'Unlike BMI it separates fat from lean mass', 'fat mass + lean mass = weight', N, async () => { const r = bf({ weight: 70 }); return [close(r.fatMass + r.leanMass, 70) && r.leanMass > r.fatMass, r.fatMass + ' / ' + r.leanMass]; });
    claim(BF, 'worked', 'Her waist-to-height ratio is 0.46, from two of the same measurements.', 'waist ÷ height', N, async () => { const r = bf({ sex: 'female', height: 165, neck: 33, waist: 76, hip: 98, weight: 64 }); return [close(r.waistHeight, 76 / 165), r.waistHeight]; });
    claim(BF, 'use', 'The waist-to-height ratio comes with every result at no extra effort.', 'shown without a weight, for both sexes', N, async () => {
      const a = bf({ weight: 0 }), b = bf({ sex: 'female', weight: 0 }); return [isFinite(a.waistHeight) && isFinite(b.waistHeight), a.waistHeight + ' / ' + b.waistHeight];
    });
    claim(BF, 'tip', 'Below 0.5 is the usual guidance, and it needs only two measurements.', 'neck, hip, weight and sex do not move it', N, async () => {
      const a = bf({}).waistHeight, b = bf({ sex: 'female', neck: 34, hip: 120, weight: 99 }).waistHeight; return [a === b && close(a, 85 / 175), a + ' / ' + b];
    });
    claim(BF, 'dfaq', 'The 1984 study fitted a separate equation for each sex, and the one for women uses waist plus hip minus neck.', 'waist + hip − neck', N, async () => {
      /* moving 5 cm from hip to waist leaves waist + hip − neck, and the result, unchanged */
      const a = bf({ sex: 'female', waist: 80, hip: 100 }).bodyFat, b = bf({ sex: 'female', waist: 85, hip: 95 }).bodyFat; return [close(a, b), a + ' / ' + b];
    });
    claim(BF, 'dfaq', 'Entering a weight shows both masses', 'masses only with a weight', N, async () => {
      const a = bf({ weight: 0 }), b = bf({ weight: 70 }); return [isNaN(a.fatMass) && isNaN(a.leanMass) && b.fatMass > 0 && b.leanMass > 0, K.j([a.fatMass, a.leanMass, b.fatMass, b.leanMass])];
    });
    claim(BF, 'dfaq', 'For someone 165 cm tall that means a waist under 82.5 cm.', '82.5 ÷ 165', N, async () => {
      const a = bf({ height: 165, waist: 82.5 }).waistHeight, b = bf({ height: 165, waist: 82.4 }).waistHeight; return [a === 0.5 && b < 0.5, a + ' / ' + b];
    });
    manual(BF, 'tip', 'Measure at the same time of day, unclothed at the measurement point', 'measuring advice');
    manual(BF, 'tip', 'Body fat percentage is one descriptive number among many.', 'framing; no behaviour to test');
    manual(BF, 'faq', 'Essential fat is roughly 3% for men and 12% for women, below which health is compromised.', 'physiology the tool does not apply');
    manual(BF, 'faq', 'Bioelectrical impedance scales estimate from body water', 'about other devices');
    manual(BF, 'use', 'A BMI above the healthy range with a modest fat estimate often points to muscle rather than fat.', 'interpretation advice');
    manual(BF, 'mistake', 'Breathe out normally and take the reading at the end of the out-breath.', 'measuring advice');
  }

  const HR = '/health/heart-rate-zones/';
  const hr = (i) => run(HR, i);
  const pcts = [[0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1]];
  const zonesOf = (max, rest) => pcts.map(([lo, hi]) => rest
    ? Math.round((max - rest) * lo + rest) + ' – ' + Math.round((max - rest) * hi + rest) + ' bpm'
    : Math.round(max * lo) + ' – ' + Math.round(max * hi) + ' bpm');
  const zonesGot = (r) => [r.zone1, r.zone2, r.zone3, r.zone4, r.zone5];
  {
    const plain = async () => every([20, 35, 50, 80], (age) => {
      const r = hr({ age, resting: 0 }); const z = zonesOf(208 - 0.7 * age, 0); return [K.j(zonesGot(r)) === K.j(z) && r.basis === 'Percentage of maximum heart rate', age + ': ' + zonesGot(r).join(', ')];
    });
    const karv = async () => every([[30, 60], [50, 65], [70, 48]], ([age, rest]) => {
      const r = hr({ age, resting: rest }); const z = zonesOf(208 - 0.7 * age, rest); return [K.j(zonesGot(r)) === K.j(z) && r.basis === 'Karvonen, using heart rate reserve' && r.reserve === Math.round(208 - 0.7 * age - rest), age + '/' + rest + ': ' + zonesGot(r).join(', ')];
    });
    claim(HR, 'lede', 'Training heart rate zones from maximum or reserve heart rate, with what each zone is for.', 'both bases, and a purpose on each zone', N, async () => {
      const a = await plain(), b = await karv(); const labels = [1, 2, 3, 4, 5].map((i) => output(HR, 'zone' + i).label);
      return [a[0] && b[0] && labels.every((l) => /^Zone \d — \w/.test(l)), labels.join(' | ') + '; ' + a[1] + '; ' + b[1]];
    });
    claim(HR, 'card', 'Training heart rate zones from maximum or reserve heart rate, with what each zone is for.', 'both bases', N, async () => { const a = await plain(), b = await karv(); return [a[0] && b[0], a[1] + '; ' + b[1]]; });
    claim(HR, 'why', 'Enter your age and resting heart rate. Get five zones in bpm.', 'five zones, each in bpm', N, async () => { const z = zonesGot(hr({ age: 40, resting: 62 })); return [z.length === 5 && z.every((s) => /^\d+ – \d+ bpm$/.test(s)), z.join(', ')]; });
    claim(HR, 'works', 'Without a resting rate, each zone is a plain percentage of that maximum in ten-point steps from 50% to 100%.', 'resting 0 at four ages', N, plain);
    claim(HR, 'works', 'With one, the Karvonen method takes the same percentages of the reserve (maximum minus resting) and adds the resting rate back on.', 'three age/resting pairs', N, karv);
    claim(HR, 'works', 'HRmax = 208 − 0.7 × age (Tanaka) or 220 − age (classic)', 'both maxima at five ages', N, async () => every([10, 25, 47, 63, 100], (age) => {
      const t = hr({ age }).hrMax, c = hr({ age, method: 'classic' }).hrMax; return [t === Math.round(208 - 0.7 * age) && c === 220 - age, age + ': ' + t + ' / ' + c];
    }));
    claim(HR, 'formula', 'Tanaka: HRmax = 208 − 0.7 × age · Karvonen uses heart rate reserve', 'Tanaka by default, Karvonen with a resting rate', N, async () => {
      const r = hr({ age: 40, resting: 55 }); return [r.hrMax === 180 && r.reserve === 125 && /Karvonen/.test(r.basis), K.j([r.hrMax, r.reserve, r.basis])];
    });
    claim(HR, 'works', 'zone 1 = 50–60%, 2 = 60–70%, 3 = 70–80%, 4 = 80–90%, 5 = 90–100%', 'zone limits at 187 bpm', N, async () => { const z = zonesGot(hr({ age: 30, resting: 0 })); return [z[0] === '94 – 112 bpm' && z[4] === '168 – 187 bpm', z.join(', ')]; });
    claim(HR, 'worked', 'Adding a waking pulse of 65 bpm switches to Karvonen.', 'the method line changes', N, async () => {
      const a = hr({ age: 50, resting: 0 }).basis, b = hr({ age: 50, resting: 65 }).basis; return [/maximum/.test(a) && /Karvonen/.test(b), a + ' → ' + b];
    });
    claim(HR, 'tip', 'Giving a resting heart rate switches to the Karvonen method', 'resting rate on and off', N, async () => {
      const a = hr({ resting: 0 }), b = hr({ resting: 1 }); return [/maximum/.test(a.basis) && /Karvonen/.test(b.basis) && isNaN(a.reserve), a.basis + ' → ' + b.basis];
    });
    claim(HR, 'use', 'A resting rate that falls over months shifts the Karvonen zones, so rerun it each season.', 'resting 60 → 50 moves zone 2', N, async () => { const a = hr({ resting: 60 }).zone2, b = hr({ resting: 50 }).zone2; return [a !== b, a + ' → ' + b]; });
    claim(HR, 'dfaq', 'which is why the Karvonen zones respond to training and the plain percentages do not', 'plain zones depend on age alone', N, async () => {
      const a = zonesGot(hr({ age: 35, resting: 0 })), b = zonesGot(hr({ age: 35, resting: 0, method: 'tanaka' })), k1 = hr({ age: 35, resting: 70 }).zone3, k2 = hr({ age: 35, resting: 50 }).zone3;
      return [K.j(a) === K.j(b) && k1 !== k2, a.join(', ') + '; Karvonen zone 3 ' + k1 + ' → ' + k2];
    });
    claim(HR, 'mistake', 'at 50 the two maxima are 170 and 173 bpm', 'classic and Tanaka at 50', N, async () => { const c = hr({ age: 50, method: 'classic' }).hrMax, t = hr({ age: 50 }).hrMax; return [c === 170 && t === 173, c + ' / ' + t]; });
    claim(HR, 'dfaq', 'On the percentage-of-maximum method that is 112 – 131 bpm at age 30; with a resting rate, Karvonen puts it higher.', 'zone 2 at 30, with and without resting 60', N, async () => {
      const a = hr({ age: 30, resting: 0 }).zone2, b = hr({ age: 30, resting: 60 }).zone2; return [a === '112 – 131 bpm' && parseInt(b, 10) > 112 && parseInt(b.split('– ')[1], 10) > 131, a + ' / ' + b];
    });
    claim(HR, 'dfaq', 'by 0.7 bpm a year in the Tanaka equation and 1 bpm a year in the classic rule', 'a decade: 7 and 10 bpm', N, async () => {
      const t = hr({ age: 30 }).hrMax - hr({ age: 40 }).hrMax, c = hr({ age: 30, method: 'classic' }).hrMax - hr({ age: 31, method: 'classic' }).hrMax; return [t === 7 && c === 1, t + ' / ' + c];
    });
    claim(HR, 'faq', 'Why 208 − 0.7 × age rather than 220 − age?', 'Tanaka is the default method', N, async () => { const d = input(HR, 'method').default; return [d === 'tanaka' && hr({ age: 60 }).hrMax === 166, d]; });
    claim(HR, 'what', 'The bands are anchored to an estimated maximum heart rate, worked out here from your age, and optionally to your resting heart rate.', 'age moves every band; resting is optional', N, async () => {
      const a = hr({ age: 30, resting: 0 }), b = hr({ age: 60, resting: 0 }); return [zonesGot(a).every((z, i) => z !== zonesGot(b)[i]) && !a.note, a.zone1 + ' vs ' + b.zone1];
    });
    manual(HR, 'tip', 'Age-based maximum heart rate is a population average with a standard deviation of about 10–12 bpm.', 'published variability; no behaviour to test');
    manual(HR, 'tip', 'The "fat burning zone" is a persistent misunderstanding.', 'exercise physiology');
    manual(HR, 'tip', 'Measure resting heart rate first thing in the morning', 'measuring advice');
    manual(HR, 'tip', 'discuss target zones with a clinician — these formulas will not apply to you.', 'advice to see a clinician');
    manual(HR, 'faq', 'The Tanaka equation comes from a meta-analysis and fits observed data better across the age range.', 'research history');
    manual(HR, 'mistake', 'Heart rate lags effort by a minute or more', 'physiology');
  }

  const IW = '/health/ideal-weight/';
  const iw = (i) => run(IW, i);
  const IWF = { male: [[50, 2.3], [52, 1.9], [56.2, 1.41], [48, 2.7]], female: [[45.5, 2.3], [49, 1.9], [53.1, 1.41], [45.5, 2.7]] };
  const iwWant = (sex, cm) => { const x = Math.max(0, (cm - 152.4) / 2.54); return IWF[sex].map(([b, k]) => b + k * x); };
  const iwGot = (r) => [r.devine, r.robinson, r.miller, r.hamwi];
  {
    const formulas = async () => every([['male', 160], ['male', 175], ['male', 190], ['female', 155], ['female', 168], ['female', 182]], ([sex, cm]) => {
      const r = iw({ sex, height: cm }); const w = iwWant(sex, cm); return [iwGot(r).every((v, i) => close(v, w[i])), sex + ' ' + cm + ': ' + iwGot(r).map((v) => v.toFixed(2)).join(', ')];
    });
    claim(IW, 'lede', 'Weight ranges from the standard clinical formulas, with a clear account of what they can and cannot tell you.', 'four formulas and the BMI range come back', N, async () => {
      const r = iw({}); const f = await formulas(); return [f[0] && /^\d+\.\d – \d+\.\d kg$/.test(r.bmiRange), r.bmiRange + '; ' + f[1]];
    });
    claim(IW, 'card', 'Weight ranges from the standard clinical formulas, with a clear account of what they can and cannot tell you.', 'four formulas at six heights', N, formulas);
    claim(IW, 'why', 'Enter your height. See the BMI range and four formulas side by side.', 'the range plus Devine, Robinson, Miller and Hamwi', N, async () => {
      const r = iw({}); return [typeof r.bmiRange === 'string' && iwGot(r).every(isFinite) && isFinite(r.formulaAverage), K.j(r)];
    });
    claim(IW, 'works', 'Devine: 50 kg (men) or 45.5 kg (women) + 2.3 kg per inch Robinson: 52 or 49 kg + 1.9 kg per inch Miller: 56.2 or 53.1 kg + 1.41 kg per inch Hamwi: 48 or 45.5 kg + 2.7 kg per inch', 'six heights, both sexes', N, formulas);
    claim(IW, 'formula', 'Devine, Robinson, Miller and Hamwi formulas, plus the BMI 18.5–24.9 range', 'the formulas, and the range ends at 24.9 not 25', N, async () => {
      const f = await formulas(); const r = iw({ height: 175 }); const want = (18.5 * 1.75 * 1.75).toFixed(1) + ' – ' + (24.9 * 1.75 * 1.75).toFixed(1) + ' kg';
      return [f[0] && r.bmiRange === want, r.bmiRange + ' (BMI 25 would end at ' + (25 * 1.75 * 1.75).toFixed(1) + ')'];
    });
    claim(IW, 'what', 'The four named formulas date from 1964 to 1983', 'the years in the result labels', N, async () => {
      const ys = ['devine', 'robinson', 'miller', 'hamwi'].map((k) => Number((output(IW, k).label.match(/\((\d{4})\)/) || [])[1])); return [Math.min(...ys) === 1964 && Math.max(...ys) === 1983, ys.join(', ')];
    });
    claim(IW, 'works', 'Each formula starts from a base weight at exactly 5 ft (152.4 cm), different for men and women, and adds a fixed amount per inch above that.', 'the bases at 152.4 cm', N, async () => {
      const m = iwGot(iw({ height: 152.4 })), f = iwGot(iw({ sex: 'female', height: 152.4 })); return [K.j(m) === K.j([50, 52, 56.2, 48]) && K.j(f) === K.j([45.5, 49, 53.1, 45.5]), K.j(m) + ' / ' + K.j(f)];
    });
    claim(IW, 'works', 'Below 5 ft nothing is subtracted, so every result there is the base weight.', '125, 140 and 150 cm', N, async () => every([125, 140, 150], (cm) => { const m = iwGot(iw({ height: cm })); return [K.j(m) === K.j([50, 52, 56.2, 48]), cm + ': ' + K.j(m)]; }));
    claim(IW, 'works', 'zero for anyone 152.4 cm or shorter', 'just above 152.4 cm the inches start', N, async () => { const a = iw({ height: 152.4 }).devine, b = iw({ height: 153 }).devine; return [a === 50 && b > 50, a + ' → ' + b]; });
    claim(IW, 'works', 'The BMI range solves the BMI formula backwards for 18.5 and 24.9.', '18.5 × m² to 24.9 × m² at three heights', N, async () => every([150, 170, 195], (cm) => {
      const m = cm / 100, want = (18.5 * m * m).toFixed(1) + ' – ' + (24.9 * m * m).toFixed(1) + ' kg', r = iw({ height: cm }).bmiRange; return [r === want, cm + ': ' + r];
    }));
    claim(IW, 'worked', 'a span of 20.2 kg that holds all four formula results', 'all four inside the BMI band at 70 in', N, async () => {
      const r = iw({ system: 'imperial', height: 70 }); const [lo, hi] = r.bmiRange.split(' – ').map(parseFloat); return [iwGot(r).every((v) => v >= lo && v <= hi), r.bmiRange + ' holds ' + iwGot(r).map((v) => v.toFixed(1)).join(', ')];
    });
    claim(IW, 'use', 'See why the formulas flatten out below 152.4 cm while the BMI range keeps shrinking.', '145 vs 150 cm', N, async () => {
      const a = iw({ height: 145 }), b = iw({ height: 150 }); return [K.j(iwGot(a)) === K.j(iwGot(b)) && parseFloat(a.bmiRange) < parseFloat(b.bmiRange), a.bmiRange + ' vs ' + b.bmiRange];
    });
    claim(IW, 'mistake', '5 ft 10 in is 70 inches, not 5.10; in metric mode it is 177.8 cm.', '70 in = 177.8 cm; 5.10 is refused', N, async () => {
      const a = iw({ system: 'imperial', height: 70 }), b = iw({ height: 177.8 }), c = iw({ system: 'imperial', height: 5.1 });
      return [close(a.devine, b.devine) && a.bmiRange === b.bmiRange && !!c.note && c.devine === undefined, a.devine + ' / ' + b.devine + '; 5.10 → ' + c.note];
    });
    claim(IW, 'mistake', 'The 18.5 to 24.9 limits are adult ones', 'the range is labelled 18.5–24.9', N, async () => { const l = output(IW, 'bmiRange').label; return [/18\.5–24\.9/.test(l), l]; });
    claim(IW, 'dfaq', 'Divide the kilograms by 6.35029318, the number of kilograms in a stone. 73 kg is about 11 st 7 lb', '73 ÷ 6.35029318', N, async () => {
      const st = 73 / 6.35029318, lb = Math.round((st - Math.floor(st)) * 14); return [Math.floor(st) === 11 && lb === 7, st];
    });
    claim(IW, 'dfaq', 'At 150 cm each one returns its base, for a woman 45.5 kg to 53.1 kg, while the BMI band keeps falling with height.', 'a woman at 150 cm', N, async () => {
      const r = iw({ sex: 'female', height: 150 }), s = iw({ sex: 'female', height: 152.4 }); const g = iwGot(r);
      return [Math.min(...g) === 45.5 && Math.max(...g) === 53.1 && parseFloat(r.bmiRange) < parseFloat(s.bmiRange), g.join(', ') + '; ' + r.bmiRange];
    });
    claim(IW, 'tip', 'They never agree: for a man they are 8.2 kg apart at 5 ft, 4.7 kg apart at 5 ft 10 in and never closer than about a kilogram', 'the spread at 5 ft, 5 ft 10 in and its minimum, 120–230 cm', N, async () => {
      const a = iw({ height: 152.4 }).spread, b = iw({ system: 'imperial', height: 70 }).spread;
      let min = Infinity, at = 0; for (const sex of ['male', 'female']) for (let cm = 120; cm <= 230; cm += 0.1) { const s = iw({ sex, height: cm }).spread; if (s < min) { min = s; at = sex + ' ' + cm.toFixed(1); } }
      return [a.toFixed(1) === '8.2' && b.toFixed(1) === '4.7' && min >= 0.9 && min < 1.5, a.toFixed(2) + ', ' + b.toFixed(2) + ', min ' + min.toFixed(2) + ' (' + at + ')'];
    });
    claim(IW, 'tip', 'None of these formulas accounts for build, muscle mass, age or ethnicity.', 'only sex, units and height go in', N, async () => { const keys = (specOf(IW).inputs || []).map((i) => i.key); return [keys.join() === 'sex,system,height', keys.join()]; });
    manual(IW, 'tip', 'Devine and Hamwi were written to calculate drug dosages', 'history of the formulas');
    manual(IW, 'tip', 'The BMI range is broad on purpose.', 'interpretation');
    manual(IW, 'tip', 'that is a conversation with a clinician who knows your history', 'advice to see a clinician');
    manual(IW, 'faq', 'a GP will consider blood pressure, blood markers, fitness, family history', 'advice to see a clinician');
    manual(IW, 'faq', 'Athletes, older adults and people with different builds sit outside these ranges routinely while being healthy.', 'medical guidance');
  }

  const OV = '/health/ovulation-calculator/';
  const ov = (i, now) => run(OV, i, now);
  /* the engine's own date style: "Sun, 31 Jan 2027" */
  const ovD = (iso) => shortD(iso);
  const ovShort = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  {
    const base = async () => every([['2027-01-11', 28, 14], ['2026-02-20', 32, 12], ['2026-03-20', 26, 14], ['2026-10-25', 45, 17]], ([lp, cyc, lut]) => {
      const r = ov({ lastPeriod: lp, cycle: cyc, luteal: lut }); const o = addDays(lp, cyc - lut);
      const ok = r.nextPeriod === ovD(addDays(lp, cyc)) && r.ovulation === ovD(o) && r.fertileWindow === ovD(addDays(o, -5)) + ' to ' + ovD(addDays(o, 1));
      return [ok, [lp, cyc, lut].join('/') + ': ' + r.ovulation + ', ' + r.fertileWindow];
    });
    claim(OV, 'lede', 'Estimate ovulation and the fertile window from cycle length and last period date.', 'four cycles, across the clock changes', N, base);
    claim(OV, 'card', 'Estimate ovulation and the fertile window from cycle length and last period date.', 'four cycles', N, base);
    claim(OV, 'works', 'next period = first day of last period + cycle length ovulation = next period − luteal phase fertile window = ovulation − 5 days to ovulation + 1 day', 'four cycles', N, base);
    claim(OV, 'formula', 'ovulation ≈ next period − 14 days; fertile window is the five days before through the day after', 'the default luteal phase', N, async () => {
      const r = ov({ lastPeriod: '2026-09-01' }); return [r.ovulation === ovD('2026-09-15') && r.fertileWindow === ovD('2026-09-10') + ' to ' + ovD('2026-09-16'), r.ovulation + ', ' + r.fertileWindow];
    });
    claim(OV, 'what', 'the five days before ovulation, the day of ovulation and the day after', 'a seven-day window', N, async () => {
      const r = ov({ lastPeriod: '2026-09-01' }); const [a, b] = r.fertileWindow.split(' to '); return [a === ovD('2026-09-10') && b === ovD('2026-09-16'), r.fertileWindow];
    });
    claim(OV, 'tip', 'The fertile window runs from about five days before ovulation to the day after', 'window around ovulation', N, base);
    claim(OV, 'why', 'Enter your last period and cycle length. See the next three windows.', 'three rows by default', N, async () => {
      const r = ov({ lastPeriod: '2026-09-01' }); return [input(OV, 'cycles').default === 3 && r._table.rows.length === 3, r._table.rows.length + ' rows'];
    });
    claim(OV, 'works', 'Ovulation is placed one luteal phase before that, 14 days unless you change it', 'default luteal 14', N, async () => [input(OV, 'luteal').default === 14, input(OV, 'luteal').default]);
    claim(OV, 'works', 'days from the first day of one period to the first day of the next; 20 to 45 accepted', 'a cycle of 19 counts as 20, 46 as 45', N, async () => {
      const a = ov({ lastPeriod: '2026-09-01', cycle: 19 }).nextPeriod, b = ov({ lastPeriod: '2026-09-01', cycle: 46 }).nextPeriod;
      return [a === ovD('2026-09-21') && b === ovD('2026-10-16') && input(OV, 'cycle').min === 20 && input(OV, 'cycle').max === 45, a + ' / ' + b];
    });
    claim(OV, 'works', 'days from ovulation to the next period; 9 to 17 accepted, 14 by default', 'a luteal phase of 8 counts as 9, 18 as 17', N, async () => {
      const a = ov({ lastPeriod: '2026-09-01', luteal: 8 }).ovulation, b = ov({ lastPeriod: '2026-09-01', luteal: 18 }).ovulation;
      return [a === ovD('2026-09-20') && b === ovD('2026-09-12'), a + ' / ' + b];
    });
    claim(OV, 'worked', 'so ovulation is estimated for Sun, 31 Jan 2027, day 21 of the cycle', 'the cycle day on the ovulation date', N, async () => {
      const r = ov({ lastPeriod: '2027-01-11', cycle: 32, luteal: 12 }, '2027-01-31T12:00:00'); return [r.cycleDay === 21 && r.ovulation === ovD('2027-01-31'), r.cycleDay + ' on ' + r.ovulation];
    });
    claim(OV, 'worked', 'The table carries the pattern forward', 'row 2 starts one cycle later, with its own ovulation', N, async () => {
      const r = ov({ lastPeriod: '2027-01-11', cycle: 32, luteal: 12 })._table.rows; return [r[1][0].indexOf('12 Feb 2027') >= 0 && r[1][2].indexOf('4 Mar 2027') >= 0, K.j(r[1])];
    });
    claim(OV, 'mistake', 'Day 1 is the first day of full flow', 'the period start is cycle day 1', N, async () => {
      const a = ov({ lastPeriod: '2026-10-04' }).cycleDay, b = ov({ lastPeriod: '2026-10-01' }, '2026-10-04T00:30:00').cycleDay; return [a === 1 && b === 4, a + ' / ' + b];
    });
    claim(OV, 'mistake', 'the default places ovulation on Fri, 29 Jan 2027, two days earlier', 'luteal 14 vs 12 on a 32-day cycle', N, async () => {
      const a = ov({ lastPeriod: '2027-01-11', cycle: 32 }).ovulation, b = ov({ lastPeriod: '2027-01-11', cycle: 32, luteal: 12 }).ovulation; return [a === ovD('2027-01-29') && b === ovD('2027-01-31'), a + ' / ' + b];
    });
    claim(OV, 'dfaq', 'day 15 of a 28-day cycle with a 14-day luteal phase, and day 21 of a 34-day cycle', 'cycle day on the ovulation date', N, async () => {
      const a = ov({ lastPeriod: '2026-09-20', cycle: 28 }, '2026-10-04T12:00:00'), b = ov({ lastPeriod: '2026-09-14', cycle: 34 }, '2026-10-04T12:00:00');
      return [a.ovulation === ovD('2026-10-04') && a.cycleDay === 15 && b.ovulation === ovD('2026-10-04') && b.cycleDay === 21, a.cycleDay + ' / ' + b.cycleDay];
    });
    claim(OV, 'dfaq', 'If cycles vary from 26 to 34 days, ovulation could fall anywhere across about eight days', '26 vs 34 days', N, async () => {
      const a = ov({ lastPeriod: '2026-09-01', cycle: 26 }).ovulation, b = ov({ lastPeriod: '2026-09-01', cycle: 34 }).ovulation; return [a === ovD('2026-09-13') && b === ovD('2026-09-21'), a + ' → ' + b];
    });
    claim(OV, 'dfaq', 'Up to 12 cycles. Each row adds one average cycle length to the previous one', '12 rows at most, each one cycle on', N, async () => {
      const r = ov({ lastPeriod: '2026-01-05', cycle: 30, cycles: 13 })._table.rows; const starts = r.map((x) => x[0]);
      const want = [...Array(12)].map((_, i) => ovShort(addDays('2026-01-05', 30 * i)));
      return [r.length === 12 && starts.every((s, i) => s.indexOf(want[i]) >= 0) && input(OV, 'cycles').max === 12, r.length + ' rows: ' + starts.join(', ')];
    });
    claim(OV, 'faq', 'If you know yours from tracking, entering it gives a better estimate than assuming 14.', 'the luteal phase moves ovulation', N, async () => {
      const a = ov({ lastPeriod: '2026-09-01', luteal: 12 }).ovulation, b = ov({ lastPeriod: '2026-09-01', luteal: 16 }).ovulation; return [a === ovD('2026-09-17') && b === ovD('2026-09-13'), a + ' / ' + b];
    });
    manual(OV, 'tip', 'Ovulation timing varies between cycles even for people with regular periods.', 'physiology');
    manual(OV, 'tip', 'Ovulation predictor kits, basal body temperature tracking and cervical mucus observation all give better information than dates alone.', 'medical guidance');
    manual(OV, 'tip', 'This is not a contraceptive method.', 'medical guidance');
    manual(OV, 'tip', 'that is the usual point to speak to a GP', 'advice to see a clinician');
    manual(OV, 'faq', 'Calendar-based prediction is among the least reliable approaches to avoiding pregnancy', 'medical guidance');
  }

  const PG = '/health/pregnancy-due-date/';
  const pg = (i) => run(PG, Object.assign({ today: '2026-10-04' }, i));
  {
    const lmp = async () => every(['2026-01-04', '2027-01-04', '2027-03-28', '2028-02-29'], (d) => {
      const r = pg({ date: d }); return [r.dueDate === longD(addDays(d, 280)), d + ' → ' + r.dueDate];
    });
    claim(PG, 'lede', 'Estimate a due date from the last menstrual period or conception date, with current gestational age.', 'LMP, conception and gestational age', N, async () => {
      const a = pg({ date: '2026-08-01' }), b = pg({ basis: 'conception', date: '2026-08-15' });
      return [a.dueDate === longD('2027-05-08') && b.dueDate === a.dueDate && a.gestational === '9 weeks and 1 days', K.j([a.dueDate, b.dueDate, a.gestational])];
    });
    claim(PG, 'card', 'Estimate a due date from the last menstrual period or conception date, with current gestational age.', 'LMP + 280 on four dates', N, lmp);
    claim(PG, 'why', 'Enter the first day of your last period. Get the estimated due date.', 'LMP + 280 on four dates', N, lmp);
    claim(PG, 'works', 'Naegele’s rule adds 280 days, or 40 weeks, to the first day of the last period.', 'LMP + 280 on four dates, one a leap day', N, lmp);
    claim(PG, 'formula', 'Naegele\'s rule: LMP + 280 days + (cycle length − 28) days', 'cycle 21, 28, 35, and the 20–45 clamp', N, async () => every([[21, -7], [28, 0], [35, 7], [45, 17], [50, 17], [15, -8]], ([cyc, shift]) => {
      const r = pg({ date: '2027-01-04', cycle: cyc }); return [r.dueDate === longD(addDays('2027-01-04', 280 + shift)), cyc + ' → ' + r.dueDate];
    }));
    claim(PG, 'tip', 'Adjusting the cycle length above corrects for that', 'a 30-day cycle moves the date 2 days later', N, async () => {
      const a = pg({ date: '2027-01-04', cycle: 30 }).dueDate; return [a === longD(addDays('2027-01-04', 282)), a];
    });
    claim(PG, 'what', 'The estimated due date is the day a pregnancy reaches 40 weeks, counted from the first day of the last menstrual period (LMP).', '40 weeks and 0 days on the due date', N, async () => {
      const r = pg({ date: '2027-01-04', today: addDays('2027-01-04', 280) }); return [r.gestational === '40 weeks and 0 days' && r.daysRemaining === 0, r.gestational];
    });
    claim(PG, 'what', 'the full-term window shown here runs from 39 to 41 weeks', 'full term from 39+0 to 41+0', N, async () => {
      const r = pg({ date: '2027-01-04' }); return [r.fullTermFrom === longD(addDays('2027-01-04', 273)) && r.fullTermTo === longD(addDays('2027-01-04', 287)), r.fullTermFrom + ' to ' + r.fullTermTo];
    });
    claim(PG, 'works', 'full term = LMP + 273 days to LMP + 287 days', 'from a conception date too', N, async () => {
      const r = pg({ basis: 'conception', date: '2027-01-18' }); return [r.fullTermFrom === longD(addDays('2027-01-04', 273)) && r.fullTermTo === longD(addDays('2027-01-04', 287)), r.fullTermFrom + ' to ' + r.fullTermTo];
    });
    claim(PG, 'works', 'From a known conception date the tool first steps back 14 days to an equivalent LMP; from an IVF transfer it steps back 14 days plus the embryo’s age at transfer.', 'conception and day 3/5/6 transfers', N, async () => {
      const c = pg({ basis: 'conception', date: '2027-03-10' }).dueDate, ivf = ['3', '5', '6'].map((k) => pg({ basis: 'ivf', date: '2027-03-10', ivfDay: k }).dueDate);
      const ok = c === longD(addDays('2027-03-10', 266)) && ivf[0] === longD(addDays('2027-03-10', 263)) && ivf[1] === longD(addDays('2027-03-10', 261)) && ivf[2] === longD(addDays('2027-03-10', 260));
      return [ok, c + ' | ' + ivf.join(' | ')];
    });
    claim(PG, 'works', '3, 5 or 6 days at transfer', 'the embryo-age choices', N, async () => [optVals(PG, 'ivfDay').join() === '3,5,6', optVals(PG, 'ivfDay').join()]);
    claim(PG, 'worked', 'the pregnancy is 10 weeks and 3 days, in the first trimester', 'the stage line', N, async () => { const r = pg({ basis: 'ivf', date: '2027-03-10', today: '2027-05-03' }); return [r.trimester === 'First trimester' && r.gestational === '10 weeks and 3 days', r.gestational + ', ' + r.trimester]; });
    claim(PG, 'use', 'Change the today’s-date field to see which week of pregnancy a date in your diary falls in.', 'the today field moves the week', N, async () => {
      const a = pg({ date: '2027-01-04', today: '2027-03-01' }).gestational, b = pg({ date: '2027-01-04', today: '2027-06-14' }).gestational; return [a === '8 weeks and 0 days' && b === '23 weeks and 0 days', a + ' / ' + b];
    });
    claim(PG, 'mistake', 'For a day-5 transfer that puts the due date 19 days too late', 'LMP option vs IVF day 5, same date', N, async () => {
      const a = pg({ date: '2027-03-10' }).dueDate, b = pg({ basis: 'ivf', ivfDay: '5', date: '2027-03-10' }).dueDate; return [a === longD(addDays('2027-03-10', 280)) && b === longD(addDays('2027-03-10', 261)), a + ' vs ' + b];
    });
    claim(PG, 'dfaq', 'Count whole weeks and days from the first day of your last period.', 'whole weeks, not rounded: 62 days is 8 weeks and 6 days', N, async () => { const r = pg({ date: '2027-01-04', today: '2027-03-07' }).gestational; return [r === '8 weeks and 6 days', r]; });
    claim(PG, 'dfaq', 'A day-5 blastocyst is two days further on, so for the same transfer date its due date is two days earlier.', 'day 3 vs day 5', N, async () => {
      const a = pg({ basis: 'ivf', ivfDay: '3', date: '2027-03-10' }).dueDate, b = pg({ basis: 'ivf', ivfDay: '5', date: '2027-03-10' }).dueDate; return [a === longD('2027-11-28') && b === longD('2027-11-26'), a + ' / ' + b];
    });
    claim(PG, 'dfaq', 'the quick method is to add a year, take away three months and add seven days: an LMP of 4 January 2027 gives Monday, 11 October 2027', 'the engine agrees with the quick method here', N, async () => { const r = pg({ date: '2027-01-04' }).dueDate; return [r === 'Monday, 11 October 2027', r]; });
    claim(PG, 'tip', 'which is why you are considered "two weeks pregnant" at conception', 'conception date as today', N, async () => { const r = pg({ basis: 'conception', date: '2027-01-18', today: '2027-01-18' }).gestational; return [r === '2 weeks and 0 days', r]; });
    manual(PG, 'tip', 'Only about 4% of babies arrive on the estimated due date.', 'birth statistics; not the tool\'s arithmetic');
    manual(PG, 'tip', 'A dating ultrasound in the first trimester is more accurate than any calculation from dates', 'medical guidance');
    manual(PG, 'faq', 'First-trimester ultrasound dating is accurate to within about five days', 'medical guidance');
    manual(PG, 'faq', 'With irregular cycles the estimate can be out by a week or more', 'medical guidance');
    manual(PG, 'what', 'A midwife or doctor confirms the dating, usually from a first-trimester scan.', 'clinical practice');
  }

  const WI = '/health/water-intake/';
  const wi = (i) => run(WI, i);
  const wiWant = (kg, mins, f) => (kg * 33 + Math.min(600, mins) / 30 * 350) * f;
  {
    const follows = async () => every([[70, 30, '1'], [60, 0, '1'], [81.6, 60, '1.3'], [95, 120, '1.15']], ([kg, m, f]) => {
      const r = wi({ weight: kg, exercise: m, climate: f }); return [close(r.litres * 1000, wiWant(kg, m, Number(f))), [kg, m, f].join('/') + ' → ' + r.litres];
    });
    claim(WI, 'lede', 'A rough guide to daily fluid needs based on body weight, activity and climate.', 'weight, exercise and climate each move it', N, async () => {
      const a = wi({}).litres, b = wi({ weight: 80 }).litres, c = wi({ exercise: 60 }).litres, d = wi({ climate: '1.15' }).litres; return [b > a && c > a && d > a, [a, b, c, d].join(', ')];
    });
    claim(WI, 'card', 'A rough guide to daily fluid needs based on body weight, activity and climate.', 'the formula on four people', N, follows);
    claim(WI, 'why', 'Enter weight, exercise and climate. Get a daily range in litres.', 'a low and a high in litres', N, async () => { const r = wi({}); return [r.low < r.litres && r.high > r.litres && output(WI, 'low').unit === 'L' && output(WI, 'high').unit === 'L', r.low + '–' + r.high]; });
    claim(WI, 'works', 'The estimate starts at 33 ml for each kilogram of body weight, adds 350 ml for every 30 minutes of exercise, then multiplies the sum by 1 for a temperate climate, 1.15 for warm or 1.3 for hot or humid.', 'four people', N, follows);
    claim(WI, 'works', 'base = weight (kg) × 33 ml exercise = minutes ÷ 30 × 350 ml total = (base + exercise) × climate factor', 'four people', N, follows);
    claim(WI, 'works', 'climate factor 1, 1.15 or 1.3', 'the climate menu', N, async () => {
      const v = optVals(WI, 'climate'), l = optLabels(WI, 'climate'); return [v.join() === '1,1.15,1.3' && l.join() === 'Temperate,Warm,Hot or humid', v.map((x, i) => x + ' ' + l[i]).join(' | ')];
    });
    claim(WI, 'works', 'The range is 15% either side, and the total is split 80:20 between drinks and food.', 'range and split', N, async () => {
      const r = wi({ weight: 81.6, exercise: 60, climate: '1.3' }); return [close(r.low, r.litres * 0.85) && close(r.high, r.litres * 1.15) && close(r.fromDrinks, r.litres * 0.8) && close(r.fromFood, r.litres * 0.2), K.j(r)];
    });
    claim(WI, 'works', 'range = total × 0.85 to total × 1.15', 'range', N, async () => { const r = wi({}); return [close(r.low, r.litres * 0.85) && close(r.high, r.litres * 1.15), r.low + '–' + r.high]; });
    claim(WI, 'works', 'in kilograms; pounds are multiplied by 0.45359237', '180 lb', N, async () => { const a = wi({ system: 'imperial', weight: 180 }).litres, b = wi({ weight: 180 * 0.45359237 }).litres; return [close(a, b), a + ' vs ' + b]; });
    claim(WI, 'works', 'exercise per day, capped at 600', '700 minutes counts as 600', N, async () => {
      const a = wi({ exercise: 600 }).litres, b = wi({ exercise: 700 }).litres, c = wi({ exercise: 590 }).litres; return [a === b && c < a, [c, a, b].join(', ')];
    });
    claim(WI, 'mistake', 'About a fifth normally comes from food, so compare what you pour with the drinks figure, not the total.', 'food is 20% of the total', N, async () => { const r = wi({}); return [close(r.fromFood, 0.2 * r.litres) && close(r.fromDrinks + r.fromFood, r.litres), r.fromFood + ' of ' + r.litres]; });
    claim(WI, 'tip', 'Around a fifth of typical fluid intake comes from food.', 'food is 20% of the total', N, async () => { const r = wi({ weight: 55 }); return [close(r.fromFood / r.litres, 0.2), r.fromFood / r.litres]; });
    claim(WI, 'mistake', 'the factor alone adds 30% to the estimate', 'hot ÷ temperate', N, async () => { const a = wi({}).litres, b = wi({ climate: '1.3' }).litres; return [close(b / a, 1.3), b / a]; });
    claim(WI, 'dfaq', 'The tool converts to UK pints of 568.26 ml.', 'pints = ml ÷ 568.26', N, async () => { const r = wi({}); return [close(r.pints, r.litres * 1000 / 568.26), r.pints]; });
    claim(WI, 'dfaq', 'Its default of 70 kg with 30 minutes of exercise in a temperate climate gives 2.66 litres, about 4.7 pints.', 'the defaults', N, async () => {
      const d = K.calcDefaults(specOf(WI)); const r = wi({}); return [d.weight === 70 && d.exercise === 30 && d.climate === '1' && d.system === 'metric' && r.litres.toFixed(2) === '2.66' && r.pints.toFixed(1) === '4.7', K.j(d) + ' → ' + r.litres];
    });
    claim(WI, 'dfaq', 'Fever, vomiting and diarrhoea all raise fluid losses, and this estimate does not allow for them.', 'no illness input', N, async () => { const keys = (specOf(WI).inputs || []).map((i) => i.key); return [keys.join() === 'system,weight,exercise,climate', keys.join()]; });
    claim(WI, 'formula', 'roughly 30–35 ml per kg of body weight, adjusted for activity and heat', '33 ml/kg at rest, temperate; more with exercise and heat', N, async () => {
      const a = wi({ weight: 50, exercise: 0 }).litres * 1000 / 50, b = wi({ weight: 50, exercise: 30, climate: '1.3' }).litres * 1000 / 50; return [a >= 30 && a <= 35 && b > a, a + ' ml/kg, then ' + b];
    });
    claim(WI, 'faq', 'which is why this shows a range rather than a single figure', 'low and high are shown', N, async () => { const r = wi({}); return [isFinite(r.low) && isFinite(r.high) && r.high > r.low, r.low + '–' + r.high]; });
    claim(WI, 'works', 'roughly 17.7 glasses of 250 ml', 'glasses are 250 ml', N, async () => { const r = wi({ weight: 81.6, exercise: 60, climate: '1.3' }); return [close(r.glasses, r.litres * 4), r.glasses]; });
    manual(WI, 'tip', 'Thirst is a good guide for most healthy adults.', 'medical guidance');
    manual(WI, 'tip', 'the idea that caffeine dehydrates at normal intakes is not supported by the evidence', 'medical evidence');
    manual(WI, 'tip', 'Needs rise with exercise, heat, altitude, fever, pregnancy and breastfeeding, and fall in cold weather.', 'physiology; the tool itself covers exercise and heat only (checked above)');
    manual(WI, 'tip', 'Drinking far beyond thirst is not benign.', 'medical guidance');
    manual(WI, 'tip', 'follow your clinician’s advice rather than a general formula', 'advice to see a clinician');
    manual(WI, 'faq', 'It is a memorable rule with no strong evidence behind it.', 'medical evidence');
    manual(WI, 'dfaq', 'ask a pharmacist or GP', 'advice to see a professional');
  }

  /* ================================================================ */
  /* /education/                                                       */
  /* ================================================================ */

  const AT = '/education/attendance-calculator/';
  const at = (i) => run(AT, Object.assign({ remaining: 0 }, i));
  /* the brute-force answers the page describes */
  const bruteMiss = (a, h, req) => { let k = 0; while (a / (h + k + 1) * 100 >= req) k++; return k; };
  const bruteMust = (a, h, req) => { let k = 0; while ((a + k) / (h + k) * 100 < req) k++; return k; };
  {
    const grid = [];
    for (let h = 1; h <= 80; h += 3) for (let a = 0; a <= h; a += 2) for (const req of [60, 65, 75, 80, 85]) grid.push([a, h, req]);
    claim(AT, 'lede', 'Work out your attendance percentage, how many classes you can still miss, and how many you must attend in a row to get back to the required minimum.', 'percentage, can miss and must attend', N, async () => {
      const a = at({ attended: 42, held: 60 }), b = at({ attended: 50, held: 60 }); return [close(a.current, 70) && a.mustAttend === 12 && a.canMiss === 0 && b.canMiss === 6 && b.mustAttend === 0, K.j([a.current, a.mustAttend, b.canMiss])];
    });
    claim(AT, 'card', 'Your attendance percentage, how many classes you can still miss, and how many you must attend in a row.', 'the three figures', N, async () => { const a = at({ attended: 42, held: 60 }); return [close(a.current, 70) && a.mustAttend === 12, K.j(a)]; });
    claim(AT, 'why', 'Enter classes attended and held. See classes to attend, or to spare.', 'short shows classes to attend; over shows classes to spare', N, async () => {
      const a = at({ attended: 30, held: 45 }), b = at({ attended: 50, held: 60 }); return [a.mustAttend === 15 && a.canMiss === 0 && b.canMiss === 6 && b.mustAttend === 0, a.mustAttend + ' / ' + b.canMiss];
    });
    claim(AT, 'what', 'Indian colleges and universities commonly set a minimum, often 75%', 'the default minimum', N, async () => [input(AT, 'required').default === 75, input(AT, 'required').default]);
    claim(AT, 'works', 'The classes you can miss is the largest number for which attended ÷ (held + k) stays at or above the minimum', 'against brute force on ' + grid.length + ' cases', N, async () => every(grid, ([a, h, req]) => {
      const r = at({ attended: a, held: h, required: req }); const want = a / h * 100 >= req ? bruteMiss(a, h, req) : 0; return [r.canMiss === want, a + '/' + h + ' at ' + req + '%: ' + r.canMiss + ' (want ' + want + ')'];
    }));
    claim(AT, 'works', 'when you are short, the classes you must attend is the smallest number for which (attended + k) ÷ (held + k) reaches it', 'against brute force on ' + grid.length + ' cases', N, async () => every(grid, ([a, h, req]) => {
      const r = at({ attended: a, held: h, required: req }); const want = a / h * 100 >= req ? 0 : bruteMust(a, h, req); return [r.mustAttend === want, a + '/' + h + ' at ' + req + '%: ' + r.mustAttend + ' (want ' + want + ')'];
    }));
    claim(AT, 'tip', 'It is the number of future classes you can skip and stay at or above the minimum.', 'one more skip drops below', N, async () => every(grid.filter(([a, h, r]) => a / h * 100 >= r).slice(0, 300), ([a, h, req]) => {
      const k = at({ attended: a, held: h, required: req }).canMiss; return [a / (h + k) * 100 >= req && a / (h + k + 1) * 100 < req, a + '/' + h + ' ' + req + '%: ' + k];
    }));
    claim(AT, 'works', 'best = (attended + remaining) ÷ (held + remaining) × 100 worst = attended ÷ (held + remaining) × 100', 'best and worst', N, async () => {
      const r = at({ attended: 50, held: 60, remaining: 40 }); return [close(r.best, 90) && close(r.worst, 50), r.best + ' / ' + r.worst];
    });
    claim(AT, 'works', 'classes still to be held this term, if known', 'no best or worst without it', N, async () => { const r = at({ attended: 50, held: 60, remaining: 0 }); return [r.best === undefined && r.worst === undefined && r.verdict === undefined, K.j(r)]; });
    claim(AT, 'use', 'See whether a shortfall can still be made up by attending, or only excused.', 'reachable vs not reachable', N, async () => {
      const a = at({ attended: 42, held: 60, remaining: 30 }).verdict, b = at({ attended: 30, held: 60, remaining: 30 }).verdict; return [/^Reachable/.test(a) && /^Not reachable/.test(b), a + ' | ' + b];
    });
    claim(AT, 'mistake', 'Rounding 74.6% up to 75%. Unless your institution says it rounds, enter the exact counts and read the unrounded figure.', '373 of 500', N, async () => {
      const r = at({ attended: 373, held: 500 }); return [close(r.current, 74.6) && /^Short/.test(r.status) && r.mustAttend === 8 && K.calcShow(specOf(AT), 'current', r.current) === '74.6%', r.status + ', ' + K.calcShow(specOf(AT), 'current', r.current)];
    });
    claim(AT, 'dfaq', 'Solve (attended + k) ÷ (held + k) = 0.75 for k and round up.', 'a fractional k is rounded up', N, async () => { const r = at({ attended: 40, held: 60, required: 70 }); return [r.mustAttend === 7 && (70 * 60 - 4000) / 30 < 7, r.mustAttend + ' (k = 6.67 rounded up)']; });
    claim(AT, 'dfaq', 'Yes, any value from 0 to 100.', '0 and 100 accepted; −1 and 101 refused', N, async () => {
      const a = at({ attended: 0, held: 10, required: 0 }), b = at({ attended: 10, held: 10, required: 100 }), c = at({ attended: 5, held: 10, required: 101 }), d = at({ attended: 5, held: 10, required: -1 });
      return [!a.note && /Above/.test(a.status) && /Above/.test(b.status) && !!c.note && c.current === undefined && !!d.note && d.current === undefined, [a.status, b.status, c.note, d.note].join(' | ')];
    });
    claim(AT, 'formula', 'Attendance % = classes attended ÷ classes held × 100', 'three cases and zero held', N, async () => {
      const r = every([[42, 60], [0, 10], [37, 37]], ([a, h]) => { const x = at({ attended: a, held: h }); return [close(x.current, a / h * 100), a + '/' + h + ' → ' + x.current]; });
      const z = at({ attended: 0, held: 0 }); return [r[0] && !!z.note && z.current === undefined, r[1] + '; 0 held → ' + z.note];
    });
    claim(AT, 'tip', 'Miss one during that run and the figure goes up again', 'attend one vs miss one', N, async () => every(grid.filter(([a, h, r]) => a / h * 100 < r).slice(0, 300), ([a, h, req]) => {
      const m = at({ attended: a, held: h, required: req }).mustAttend, x = at({ attended: a + 1, held: h + 1, required: req }).mustAttend, y = at({ attended: a, held: h + 1, required: req }).mustAttend;
      return [x === Math.max(0, m - 1) && y > m, a + '/' + h + ' ' + req + '%: ' + m + ', attend → ' + x + ', miss → ' + y];
    }));
    claim(AT, 'tip', 'Twenty classes in, one missed class costs five percentage points; a hundred in, it costs one', '20 and 100 classes', N, async () => {
      const a = at({ attended: 20, held: 20 }).current - at({ attended: 19, held: 20 }).current, b = at({ attended: 100, held: 100 }).current - at({ attended: 99, held: 100 }).current; return [close(a, 5) && close(b, 1), a + ' / ' + b];
    });
    claim(AT, 'faq', 'With 42 of 60 attended you are at 70% and already short. With 45 of 60 you are at 75% and can miss none.', '42 and 45 of 60', N, async () => {
      const a = at({ attended: 42, held: 60 }), b = at({ attended: 45, held: 60 }); return [close(a.current, 70) && /^Short/.test(a.status) && close(b.current, 75) && /^Above/.test(b.status) && b.canMiss === 0 && /exactly on the line/.test(b.note), a.status + ' / ' + b.status + ', ' + b.canMiss + ', ' + b.note];
    });
    claim(AT, 'faq', 'Recovering from 65% to 75% can take dozens of consecutive classes', '65 of 100', N, async () => { const r = at({ attended: 65, held: 100 }).mustAttend; return [r >= 24, r]; });
    claim(AT, 'faq', 'Then it cannot be recovered. A missed class stays in the total for the rest of the term, so the percentage can never return to 100. The tool says so rather than showing an impossible target.', '59 of 60 at 100%', N, async () => {
      const r = at({ attended: 59, held: 60, required: 100, remaining: 50 }); return [r.status === 'Below a 100% requirement' && r.mustAttend === 0 && /cannot be recovered/.test(r.note) && /^Not reachable/.test(r.verdict), K.j(r)];
    });
    manual(AT, 'tip', 'Attendance is usually counted per subject, not across the whole timetable.', 'institutional practice');
    manual(AT, 'tip', 'Medical and approved leave is excluded from the total at many institutions rather than counted as attended.', 'institutional practice');
    manual(AT, 'faq', 'Institutions differ on whether approved leave counts', 'institutional practice');
    manual(AT, 'dfaq', 'A provision at many universities that lets a small shortfall be excused', 'university regulations');
  }

  const CG = '/education/cgpa-to-percentage/';
  const cg = (i) => run(CG, i);
  const SCH = { ten: [10, 0], cbse: [9.5, 0], vtu: [10, 0.75], gtu: [10, 0.5] };
  {
    const each = async () => every(Object.keys(SCH).flatMap((s) => [5.5, 7.25, 8.2, 10].map((c) => [s, c])), ([s, c]) => {
      const r = cg({ scheme: s, value: c }); const [m, o] = SCH[s]; return [close(r.percentage, (c - o) * m), s + ' ' + c + ' → ' + r.percentage];
    });
    claim(CG, 'lede', 'Convert CGPA to percentage and back, using your university\'s own formula — CBSE, VTU, GTU, a plain ten-point scale, or one you enter yourself.', 'the five schemes, both ways', N, async () => {
      const v = optVals(CG, 'scheme'), b = cg({ direction: 'toCgpa', value: 74.5, scheme: 'vtu' }).cgpa, c = cg({ scheme: 'custom', mult: 25, off: 0, value: 3.4 }).percentage;
      return [v.join() === 'ten,cbse,vtu,gtu,custom' && b === 8.2 && close(c, 85), v.join() + '; ' + b + '; ' + c];
    });
    claim(CG, 'card', 'Convert CGPA to percentage and back, using your university’s own formula or one you enter yourself.', 'there and back, and custom', N, async () => {
      const a = cg({ value: 8.2 }).percentage, b = cg({ direction: 'toCgpa', value: 82 }).cgpa, c = cg({ scheme: 'custom', mult: 9, off: 1, value: 8 }).percentage; return [close(a, 82) && b === 8.2 && close(c, 63), [a, b, c].join(', ')];
    });
    claim(CG, 'why', 'Pick CBSE, VTU, GTU or custom', 'the formula menu', N, async () => { const l = optLabels(CG, 'scheme').join(' | '); return [/CBSE/.test(l) && /VTU/.test(l) && /GTU/.test(l) && /Custom/.test(l), l]; });
    claim(CG, 'why', 'Enter your CGPA, pick your university’s formula. Get the percentage.', 'four schemes on four CGPAs', N, each);
    claim(CG, 'formula', 'Percentage = (CGPA − offset) × multiplier', 'four schemes on four CGPAs', N, each);
    claim(CG, 'works', 'The ten-point rule has no offset and multiplies by 10; CBSE multiplies by 9.5; VTU subtracts 0.75 and GTU 0.5 before multiplying by 10.', 'the four built-in schemes', N, each);
    claim(CG, 'works', '0 for ten-point and CBSE, 0.75 for VTU, 0.5 for GTU, or your own', 'custom offset is used', N, async () => { const r = cg({ scheme: 'custom', mult: 10, off: 0.6, value: 8 }).percentage; return [close(r, 74), r]; });
    claim(CG, 'works', '10, 9.5 for CBSE, or your own', 'custom multiplier is used; a zero multiplier is refused', N, async () => {
      const r = cg({ scheme: 'custom', mult: 8, off: 0, value: 8 }).percentage, z = cg({ scheme: 'custom', mult: 0, value: 8 }); return [close(r, 64) && !!z.note && z.percentage === undefined, r + '; ' + z.note];
    });
    claim(CG, 'works', 'The reverse divides by the multiplier, adds the offset back and rounds to two decimals.', 'percentage to CGPA', N, async () => every([['gtu', 78, 8.3], ['vtu', 60, 6.75], ['cbse', 80, 8.42], ['gtu', 77.777, 8.28], ['gtu', 60, 6.5]], ([s, p, want]) => {
      const r = cg({ direction: 'toCgpa', scheme: s, value: p }).cgpa; return [r === want, s + ' ' + p + ' → ' + r + ' (want ' + want + ')'];
    }));
    claim(CG, 'works', 'highest possible percentage = (scale maximum − offset) × multiplier', 'the ceiling', N, async () => {
      const a = cg({ scheme: 'gtu' }).ceiling, b = cg({ scheme: 'cbse' }).ceiling, c = cg({ scheme: 'custom', mult: 25, off: 0, scaleMax: 4 }).ceiling; return [close(a, 95) && close(b, 95) && close(c, 100), [a, b, c].join(', ')];
    });
    claim(CG, 'works', '10 by default; 4 on a 4-point scale', 'the default scale maximum', N, async () => [input(CG, 'scaleMax').default === 10, input(CG, 'scaleMax').default]);
    claim(CG, 'what', 'usually on a 10-point scale in India', 'a CGPA above 10 is flagged as off the scale', N, async () => { const r = cg({ value: 10.5 }); return [/outside the 0 to 10 scale/.test(r.note), r.note]; });
    claim(CG, 'mistake', 'Entering a 4-point GPA with the scale left at 10. Set the maximum to 4 and use the custom formula, or the result comes out far too low.', '3.4 on the ten-point rule vs custom × 25', N, async () => {
      const a = cg({ value: 3.4 }).percentage, b = cg({ value: 3.4, scheme: 'custom', mult: 25, off: 0, scaleMax: 4 }); return [close(a, 34) && close(b.percentage, 85) && !b.note, a + ' vs ' + b.percentage];
    });
    claim(CG, 'dfaq', 'a gap that comes entirely from the different offsets', 'VTU vs GTU for 60%', N, async () => { const a = cg({ direction: 'toCgpa', scheme: 'vtu', value: 60 }).cgpa, b = cg({ direction: 'toCgpa', scheme: 'gtu', value: 60 }).cgpa; return [close(a - b, 0.25), a + ' − ' + b]; });
    claim(CG, 'tip', 'A subtracted offset is what makes VTU and GTU results lower than a plain × 10.', 'VTU < GTU < ten-point at every CGPA', N, async () => every([4, 6, 8.2, 10], (c) => {
      const t = cg({ value: c }).percentage, v = cg({ value: c, scheme: 'vtu' }).percentage, g = cg({ value: c, scheme: 'gtu' }).percentage; return [v < g && g < t && close(t - v, 7.5) && close(t - g, 5), c + ': ' + [t, g, v].join(', ')];
    }));
    claim(CG, 'tip', 'A 4.0 scale with a × 25 multiplier is the usual way of reaching a percentage.', '4.0 → 100%', N, async () => { const r = cg({ value: 4, scheme: 'custom', mult: 25, off: 0, scaleMax: 4 }); return [close(r.percentage, 100) && close(r.ceiling, 100), r.percentage]; });
    claim(CG, 'faq', 'If you do not know it, the ten-point multiplication is the most common default in India', 'ten-point is the default', N, async () => [input(CG, 'scheme').default === 'ten', input(CG, 'scheme').default]);
    claim(CG, 'faq', 'On a CGPA of 8.2 the two differ by more than four percentage points', 'ten-point vs VTU and GTU at 8.2', N, async () => {
      const t = cg({ value: 8.2 }).percentage, v = cg({ value: 8.2, scheme: 'vtu' }).percentage, g = cg({ value: 8.2, scheme: 'gtu' }).percentage; return [t - v > 4 && t - g > 4, t + ' / ' + v + ' / ' + g];
    });
    claim(CG, 'faq', 'A CGPA of 10 under the ten-point rule is 100%, but under a rule with a negative offset it would be more.', 'ceiling over 100 is shown and noted', N, async () => {
      const a = cg({ value: 10 }), b = cg({ value: 10, scheme: 'custom', mult: 10, off: -0.5 }); return [close(a.percentage, 100) && close(a.ceiling, 100) && close(b.percentage, 105) && close(b.ceiling, 105) && /more than 100%/.test(b.note), a.percentage + ' / ' + b.percentage + ' ' + b.note];
    });
    claim(CG, 'faq', 'It is the inverse of the formula, rounded to two decimal places', 'a round trip, and the rounding', N, async () => {
      const r = every(Object.keys(SCH).flatMap((s) => [6.75, 8.2, 9.43].map((c) => [s, c])), ([s, c]) => { const p = cg({ scheme: s, value: c }).percentage; const back = cg({ scheme: s, direction: 'toCgpa', value: p }).cgpa; return [back === c, s + ' ' + c + ' → ' + p + ' → ' + back]; });
      const x = cg({ scheme: 'cbse', direction: 'toCgpa', value: 80 }).cgpa; return [r[0] && x === 8.42, r[1] + '; 80% CBSE → ' + x];
    });
    manual(CG, 'tip', 'Check your university handbook before trusting any conversion, including this one.', 'advice');
    manual(CG, 'tip', 'CBSE\'s × 9.5 rule comes from the board itself and applies to the class 10 and 12 CGPA, not to a degree CGPA.', 'board rules');
    manual(CG, 'tip', 'Applications generally ask for the figure exactly as printed on your transcript.', 'advice');
    manual(CG, 'mistake', 'Universities revise their conversion rules, so use the regulations for your year of admission.', 'university regulations');
    manual(CG, 'mistake', 'averaging converted SGPAs ignores the credit weights', 'about a different calculation (the SGPA to CGPA page weights by credits, checked there)');
    manual(CG, 'faq', 'Where a university uses a conversion table rather than a formula, no calculator can reproduce it', 'university practice');
  }

  const EX = '/education/exam-countdown/';
  const ex = (i, now) => run(EX, i, now);
  {
    const study = (d, r, p) => Math.floor(Math.max(0, d - r) * p / 7);
    claim(EX, 'lede', 'Days left until your exam, how many of them are study days, and the hours a day your syllabus actually needs to fit in them.', 'days left, study days, hours a day', N, async () => {
      const r = ex({ date: '2027-05-03', topics: 30, hoursPer: 3, daysPerWeek: 6, revision: 7 }, '2027-02-01T12:00:00'); return [r.daysLeft === 91 && r.studyDays === 72 && close(r.perDay, 1.25), K.j([r.daysLeft, r.studyDays, r.perDay])];
    });
    claim(EX, 'card', 'Days left until your exam, how many of them are study days, and the hours a day your syllabus needs.', 'the default plan', N, async () => {
      const r = ex({ date: '2027-03-01' }); return [r.daysLeft === 148 && r.studyDays === study(148, 7, 6) && close(r.perDay, 100 / r.studyDays), K.j([r.daysLeft, r.studyDays, r.perDay])];
    });
    claim(EX, 'why', 'Enter the exam date and syllabus. Get study days and hours a day.', 'study days and hours a day come back', N, async () => { const r = ex({ date: '2026-12-01', topics: 20, hoursPer: 2 }); return [Number.isInteger(r.studyDays) && r.studyDays > 0 && close(r.perDay, 40 / r.studyDays), K.j(r)]; });
    claim(EX, 'works', 'Days left are counted from today to the exam.', 'whole days, whatever the hour, across a clock change', N, async () => {
      const a = ex({ date: '2026-10-11' }, '2026-10-04T00:30:00').daysLeft, b = ex({ date: '2026-10-11' }, '2026-10-04T23:30:00').daysLeft, c = ex({ date: '2027-04-01' }, '2027-03-01T12:00:00').daysLeft, d = ex({ date: '2026-11-01' }, '2026-10-20T12:00:00').daysLeft;
      return [a === 7 && b === 7 && c === 31 && d === 12, [a, b, c, d].join(', ')];
    });
    claim(EX, 'works', 'whole days from today to the exam date', 'the exam today, and past', N, async () => {
      const a = ex({ date: '2026-10-04' }), b = ex({ date: '2026-10-03' }); return [a.daysLeft === 0 && /today/.test(a.verdict) && /passed/.test(b.note), K.j(a) + ' / ' + b.note];
    });
    claim(EX, 'works', 'The revision days come off first; the rest are scaled by the days a week you can study and rounded down to whole study days, and the syllabus hours are shared across them.', 'revision before scaling, rounded down', N, async () => every([[30, 7, 5], [148, 7, 6], [10, 3, 4], [9, 9, 7], [100, 0, 1]], ([d, r, p]) => {
      const x = ex({ date: addDays('2026-10-04', d), revision: r, daysPerWeek: p, topics: 10, hoursPer: 1 }); return [x.studyDays === study(d, r, p) && (x.studyDays ? close(x.perDay, 10 / x.studyDays) : x.perDay === null), [d, r, p].join('/') + ' → ' + x.studyDays];
    }));
    claim(EX, 'works', 'study days = ⌊(days left − revision days) × days per week ÷ 7⌋ syllabus hours = topics × hours per topic hours a day = syllabus hours ÷ study days topics a week = topics ÷ ((days left − revision days) ÷ 7)', 'the four lines', N, async () => {
      const r = ex({ date: addDays('2026-10-04', 60), revision: 4, daysPerWeek: 5, topics: 25, hoursPer: 1.5 }); const sd = study(60, 4, 5);
      return [r.studyDays === sd && close(r.totalHours, 37.5) && close(r.perDay, 37.5 / sd) && close(r.topicsPerWeek, 25 / (56 / 7)), K.j([r.studyDays, r.totalHours, r.perDay, r.topicsPerWeek])];
    });
    claim(EX, 'formula', 'Hours a day = (topics × hours per topic) ÷ study days remaining', 'three plans', N, async () => every([[40, 2.5], [12, 4], [90, 1]], ([t, h]) => {
      const r = ex({ date: '2027-01-15', topics: t, hoursPer: h }); return [close(r.perDay, t * h / r.studyDays), t + '×' + h + ' → ' + r.perDay];
    }));
    claim(EX, 'worked', 'Because the count starts from today, “Try these numbers” shows the figures for the day you open it.', 'a later day gives fewer days left', N, async () => { const a = ex({ date: '2027-05-03' }, '2027-02-01T12:00:00').daysLeft, b = ex({ date: '2027-05-03' }, '2027-02-08T12:00:00').daysLeft; return [a === 91 && b === 84, a + ' / ' + b]; });
    claim(EX, 'dfaq', 'The tool’s first figure, counted in whole days from today’s date to the exam date.', 'days left is the primary result', N, async () => { const o = (specOf(EX).outputs || []).find((x) => x.primary); return [o && o.key === 'daysLeft', o && o.key]; });
    claim(EX, 'dfaq', 'Every day left after revision becomes a study day, so the daily load falls.', 'seven days a week', N, async () => {
      const a = ex({ date: '2027-05-03', topics: 30, hoursPer: 3, daysPerWeek: 7, revision: 7 }, '2027-02-01T12:00:00'), b = ex({ date: '2027-05-03', topics: 30, hoursPer: 3, daysPerWeek: 6, revision: 7 }, '2027-02-01T12:00:00');
      return [a.studyDays === 84 && a.perDay < b.perDay && a.perDay.toFixed(2) === '1.07', a.studyDays + ', ' + a.perDay];
    });
    claim(EX, 'tip', 'Reserve the revision days before you plan anything else.', 'revision comes off before scaling', N, async () => { const r = ex({ date: addDays('2026-10-04', 30), revision: 7, daysPerWeek: 5 }); return [r.studyDays === 16 && r.revisionDays === 7, r.studyDays + ' (21 − 7 = 14 if scaled first)']; });
    claim(EX, 'faq', 'The buffer here is taken off the calendar before study days are counted, so it cannot quietly get spent on new chapters.', 'more revision, fewer study days', N, async () => { const a = ex({ date: '2027-03-01', revision: 0 }).studyDays, b = ex({ date: '2027-03-01', revision: 14 }).studyDays; return [a - b === 12, a + ' → ' + b]; });
    claim(EX, 'tip', 'If the hours a day come out above about six, the plan is already broken.', 'the verdict stops calling it realistic above six', N, async () => {
      const v = (t) => ex({ date: addDays('2026-10-04', 7), revision: 0, daysPerWeek: 7, topics: t, hoursPer: 1 }).verdict;
      const a = v(42), b = v(45.5), c = v(77); return [/realistic/.test(a) && !/realistic/.test(b) && /full-time/.test(b) && /Cut the topic list/.test(c), [a, b, c].join(' | ')];
    });
    claim(EX, 'faq', 'If the answer comes back above six or seven hours a day, that is a signal to change the plan rather than to attempt it', 'above six the verdict warns', N, async () => {
      const v = ex({ date: addDays('2026-10-04', 7), revision: 0, daysPerWeek: 7, topics: 49, hoursPer: 1 }).verdict; return [/full-time|not a plan/.test(v) && !/room in this plan|realistic/.test(v), v];
    });
    claim(EX, 'faq', 'Study days are that figure, less the revision days, scaled by how many days a week you said you can work, so setting five gives five study days in every seven, the weekdays of each whole week.', 'five a week over whole weeks = the weekdays', N, async () => every([[7, 0], [14, 0], [35, 7], [70, 14]], ([d, r]) => {
      const x = ex({ date: addDays('2026-10-04', d), revision: r, daysPerWeek: 5 }); let wd = 0; for (let k = 0; k < d - r; k++) { const w = dow(addDays('2026-10-04', k)); if (w !== 0 && w !== 6) wd++; }
      return [x.studyDays === wd && x.studyDays === (d - r) * 5 / 7, d + '/' + r + ': ' + x.studyDays + ' study days, ' + wd + ' weekdays'];
    }));
    claim(EX, 'faq', 'It does not know your public holidays or your other exam dates.', 'no holiday input', N, async () => { const keys = (specOf(EX).inputs || []).map((i) => i.key); return [keys.join() === 'date,topics,hoursPer,daysPerWeek,revision', keys.join()]; });
    manual(EX, 'tip', 'Most people take roughly twice as long on the first pass as they expect', 'study advice');
    manual(EX, 'tip', 'Six days at three hours beats three days at six', 'study advice');
    manual(EX, 'tip', 'Re-run it weekly.', 'study advice');
    manual(EX, 'faq', 'Cut the topic list to what actually appears on the paper', 'study advice');
    manual(EX, 'mistake', 'A chapter of numericals and a chapter of definitions do not take the same time', 'study advice');
  }

  const MK = '/education/marks-percentage/';
  const mk = (marks, max, pass) => run(MK, Object.assign({ marks, max: max === undefined ? '100' : max }, pass === undefined ? {} : { pass }));
  {
    claim(MK, 'lede', 'Add up marks across subjects and get the total, the percentage and the grade, with per-subject maximums where they differ.', 'per-subject maximums', N, async () => {
      const r = mk('78, 65, 91, 54, 38', '100, 100, 100, 100, 50'); return [r.scored === '326 of 450' && close(r.percentage, 326 / 4.5) && r.grade === 'B+ — Very good', K.j([r.scored, r.percentage, r.grade])];
    });
    claim(MK, 'card', 'Add up marks across subjects and get the total, the percentage and the grade.', 'one maximum for all', N, async () => { const r = mk('78, 65, 91, 54, 83'); return [r.scored === '371 of 500' && close(r.percentage, 74.2) && r.grade === 'B+ — Very good', K.j([r.scored, r.percentage, r.grade])]; });
    claim(MK, 'why', 'Enter marks and maximums. Get total, percentage, grade and any fails.', 'a fail is counted and named', N, async () => { const r = mk('72, 31, 64, 58, 45', '100', 33); return [r.failed === 1 && /1 subject is below the 33% pass mark/.test(r.note), r.failed + ' ' + r.note]; });
    claim(MK, 'what', 'When subjects carry different maximums, the aggregate weights each one by its maximum, which is not the same as averaging the subject percentages.', 'aggregate vs average', N, async () => { const r = mk('40, 90', '50, 100'); return [close(r.percentage, 130 / 1.5) && close(r.average, 85), r.percentage + ' vs ' + r.average]; });
    claim(MK, 'works', 'The tool adds every mark and every maximum, using one maximum for all subjects or one per subject, and divides.', 'one, a full list, and a short list refused', N, async () => {
      const a = mk('40, 50, 60', '80'), b = mk('40, 50, 60', '80, 100, 120'), c = mk('40, 50, 60', '80, 100');
      return [close(a.percentage, 150 / 240 * 100) && close(b.percentage, 50) && !!c.note && c.percentage === undefined, a.percentage + ' / ' + b.percentage + ' / ' + c.note];
    });
    claim(MK, 'works', 'It also works out each subject against its own maximum to find the best, the weakest, the simple average and any subject under the pass mark.', 'best, weakest, average, fails', N, async () => {
      const r = mk('45, 30, 80', '50, 100, 100', 33); return [close(r.best, 90) && close(r.worst, 30) && close(r.average, (90 + 30 + 80) / 3) && r.failed === 1, K.j([r.best, r.worst, r.average, r.failed])];
    });
    claim(MK, 'works', 'The grade comes from a common band: O / A+ from 90, then A, B+, B, C and D from 80, 70, 60, 50 and 40.', 'either side of every band edge', N, async () => every([[9000, 'O / A+'], [8999, 'A'], [8000, 'A'], [7999, 'B+'], [7000, 'B+'], [6999, 'B'], [6000, 'B'], [5999, 'C'], [5000, 'C'], [4999, 'D'], [4000, 'D'], [3999, 'F'], [0, 'F'], [10000, 'O / A+']], ([m, g]) => {
      const r = mk(String(m), '10000'); return [r.grade.split(' — ')[0] === g, (m / 100) + '% → ' + r.grade];
    }));
    claim(MK, 'works', 'percentage = Σ marks ÷ Σ maximums × 100 subject % = mark ÷ that subject’s maximum × 100 average subject % = Σ subject % ÷ number of subjects', 'the three lines', N, async () => {
      const r = mk('18, 70, 33', '20, 100, 50'); return [close(r.percentage, 121 / 170 * 100) && close(r.best, 90) && close(r.average, (90 + 70 + 66) / 3), K.j([r.percentage, r.best, r.average])];
    });
    claim(MK, 'mistake', 'Scores of 40 out of 50 and 90 out of 100 average 85% subject by subject, but the aggregate is 86.667%; forms want the aggregate.', 'the primary result is the aggregate', N, async () => {
      const r = mk('40, 90', '50, 100'); const p = (specOf(MK).outputs || []).find((o) => o.primary); return [p.key === 'percentage' && K.calcShow(specOf(MK), 'percentage', r.percentage) === '86.667%' && close(r.average, 85), K.calcShow(specOf(MK), 'percentage', r.percentage)];
    });
    claim(MK, 'mistake', 'Typing marks as fractions, such as 45/50.', '45/50 is refused', N, async () => { const r = mk('45/50, 60'); return [!!r.note && r.percentage === undefined, r.note]; });
    claim(MK, 'dfaq', 'In the band this tool uses, B+ — Very good, which runs from 70% up to 80%.', '75%', N, async () => { const r = mk('75'); return [r.grade === 'B+ — Very good', r.grade]; });
    claim(MK, 'dfaq', 'with 240 from the first four, the last paper needs 60', '240 + 60 of 500', N, async () => { const r = mk('70, 50, 60, 60, 60'), s = mk('70, 50, 60, 60, 59'); return [close(r.percentage, 60) && s.percentage < 60, r.percentage + ' / ' + s.percentage]; });
    claim(MK, 'formula', 'Percentage = marks obtained ÷ maximum marks × 100', 'three lists', N, async () => every([['50', '100', 50], ['1, 2, 3', '10', 20], ['0, 0', '25, 75', 0]], ([m, x, want]) => { const r = mk(m, x); return [close(r.percentage, want), m + ' of ' + x + ' → ' + r.percentage]; }));
    claim(MK, 'tip', 'A 50-mark practical counted as though it were out of 100 will pull the percentage down by a lot.', 'the example with and without the 50', N, async () => {
      const a = mk('78, 65, 91, 54, 38', '100, 100, 100, 100, 50').percentage, b = mk('78, 65, 91, 54, 38', '100').percentage; return [a - b > 5, a + ' vs ' + b];
    });
    claim(MK, 'tip', 'Passing overall is not the same as passing everything. Most boards require both, which is why the failed-subject count is shown separately.', 'an aggregate pass with a failed subject', N, async () => { const r = mk('95, 90, 20'); return [r.percentage > 40 && r.failed === 1 && /D|C|B|A|O/.test(r.grade[0]), r.grade + ', ' + r.failed + ' failed']; });
    claim(MK, 'faq', 'That count is shown separately here for exactly that reason.', 'the fail count is its own result', N, async () => [output(MK, 'failed').label === 'Subjects below the pass mark', output(MK, 'failed').label]);
    claim(MK, 'tip', 'A 59.97% is not a 60%, and eligibility cut-offs are applied literally.', '5,997 of 10,000', N, async () => {
      const r = mk('5997', '10000'); return [K.calcShow(specOf(MK), 'percentage', r.percentage) === '59.97%' && r.grade === 'C — Average', K.calcShow(specOf(MK), 'percentage', r.percentage) + ' ' + r.grade];
    });
    claim(MK, 'faq', 'Add the marks you scored, add the maximums they were out of, divide the first by the second and multiply by a hundred.', 'Σ marks ÷ Σ maximums', N, async () => { const r = mk('12, 30', '20, 40'); return [close(r.percentage, 70), r.percentage]; });
    claim(MK, 'faq', 'The band here is a common Indian one and is labelled as such.', 'the caution names it', N, async () => { const r = mk('60'); return [/common Indian band/.test(r.caution), r.caution]; });
    claim(MK, 'ui', 'Pass mark per subject (%)', 'a subject exactly on the pass mark passes', N, async () => { const a = mk('40, 39', '100', 40); return [a.failed === 1, a.failed]; });
    manual(MK, 'tip', 'If your board drops the lowest subject or counts best-of-five, leave that subject out', 'board rules');
    manual(MK, 'tip', 'Internal assessment usually carries its own maximum and its own pass mark.', 'board rules');
    manual(MK, 'faq', 'Boards that use best-of-five apply it to a specified set', 'board rules');
    manual(MK, 'worked', 'On most boards that means a supplementary exam in that one subject', 'board rules');
    manual(MK, 'mistake', 'Use the marks printed on the marksheet, which already include any moderation.', 'board practice');
  }

  const PR = '/education/percentile-rank/';
  const pr = (i) => run(PR, i);
  {
    const both = async () => every([[12500, 1200000], [1, 400], [10, 400], [400, 400], [6251, 250000]], ([rank, total]) => {
      const n = pr({ value: rank, total }).percentile, s = pr({ value: rank, total, method: 'plain' }).percentile;
      return [close(n, (total - rank + 1) / total * 100) && close(s, (total - rank) / total * 100), rank + '/' + total + ': ' + n + ' / ' + s];
    });
    claim(PR, 'lede', 'Convert between rank and percentile for any competitive exam, both directions, using either the standard formula or the NTA one.', 'both formulas, both directions', N, async () => {
      const a = await both(); const b = pr({ direction: 'toRank', value: 97.5, total: 250000 }).rank, c = pr({ direction: 'toRank', value: 97.5, total: 250000, method: 'plain' }).rank; return [a[0] && b === 6251 && c === 6250, a[1] + '; ' + b + ' / ' + c];
    });
    claim(PR, 'card', 'Convert between rank and percentile for any competitive exam, with the standard or the NTA formula.', 'both formulas', N, both);
    claim(PR, 'why', 'Enter your rank and the total. Get the percentile, or the reverse.', 'there and back', N, async () => {
      const p = pr({ value: 12500, total: 1200000 }).percentile, r = pr({ direction: 'toRank', value: p, total: 1200000 }).rank; return [r === 12500, p + ' → ' + r];
    });
    claim(PR, 'what', 'a 97.5 percentile means about 97.5% of that session’s candidates were at or behind you', 'NTA: you and everyone behind', N, async () => {
      const r = pr({ direction: 'toRank', value: 97.5, total: 250000 }); return [close((r.behind + 1) / r.total * 100, 97.5), r.behind + 1 + ' of ' + r.total];
    });
    claim(PR, 'what', 'Rank counts the same position from the top, so a small rank and a high percentile describe one result.', 'percentile falls as rank grows', N, async () => {
      const ps = [1, 10, 100, 1000, 10000].map((k) => pr({ value: k, total: 50000 }).percentile); return [ps.every((p, i) => !i || p < ps[i - 1]), ps.join(', ')];
    });
    claim(PR, 'works', 'From a rank, the NTA-style formula counts you among those at or below your place; the standard formula counts only those strictly below, so the two differ by one candidate.', 'five rank/total pairs', N, both);
    claim(PR, 'works', 'NTA style: percentile = (total − rank + 1) ÷ total × 100 standard: percentile = (total − rank) ÷ total × 100', 'five rank/total pairs', N, both);
    claim(PR, 'works', 'Going the other way, the tool turns the percentile back into a number of candidates and rounds to a whole rank.', 'whole ranks from fractional percentiles', N, async () => every([[99, 1200000, 12001], [99, 250000, 2501], [97.75, 400, 10], [99.123, 333, 4], [0, 1000, 1000], [100, 1000, 1]], ([p, t, want]) => {
      const r = pr({ direction: 'toRank', value: p, total: t }).rank; return [r === want && Number.isInteger(r), p + ' of ' + t + ' → ' + r + ' (want ' + want + ')'];
    }));
    claim(PR, 'works', 'rank (NTA style) = total − percentile ÷ 100 × total + 1, rounded', 'the reverse formula', N, async () => every([[98.9584, 1200000], [50, 1001], [12.3456, 9999]], ([p, t]) => { const r = pr({ direction: 'toRank', value: p, total: t }).rank; return [r === Math.min(t, Math.max(1, Math.round(t - p / 100 * t + 1))), p + '/' + t + ' → ' + r]; }));
    claim(PR, 'works', 'top % = rank ÷ total × 100', 'top %', N, async () => { const r = pr({ value: 6251, total: 250000 }); return [close(r.topPct, 6251 / 2500), r.topPct]; });
    claim(PR, 'works', 'your place, 1 being the highest', 'rank 1 is the 100th percentile, NTA style', N, async () => { const a = pr({ value: 1, total: 5000 }).percentile, b = pr({ value: 0, total: 5000 }); return [a === 100 && !!b.note, a + '; rank 0 → ' + b.note]; });
    claim(PR, 'mistake', 'Candidates are whole while percentiles are not, so the rank is rounded', 'percentiles a hair apart give one rank', N, async () => { const a = pr({ direction: 'toRank', value: 98.95841, total: 1200000 }).rank, b = pr({ direction: 'toRank', value: 98.95842, total: 1200000 }).rank; return [a === b && a === 12500, a + ' / ' + b]; });
    claim(PR, 'dfaq', 'On a 330,000-candidate exam the top 1% is ranks 1 to 3,300.', 'ranks 3,300 and 3,301', N, async () => { const a = pr({ value: 3300, total: 330000 }).topPct, b = pr({ value: 3301, total: 330000 }).topPct; return [close(a, 1) && b > 1, a + ' / ' + b]; });
    claim(PR, 'formula', 'Percentile = (total − rank + 1) ÷ total × 100 (NTA) or (total − rank) ÷ total × 100 (standard)', 'five rank/total pairs', N, both);
    claim(PR, 'tip', 'The two formulas differ by exactly one candidate.', '100 ÷ total apart', N, async () => every([[5, 400], [12500, 330000], [77, 78]], ([r, t]) => {
      const n = pr({ value: r, total: t }).percentile, s = pr({ value: r, total: t, method: 'plain' }).percentile; return [close(n - s, 100 / t), r + '/' + t + ': ' + (n - s)];
    }));
    claim(PR, 'tip', 'The difference between 99.5 and 99.9 on a 300,000-candidate exam is well over a thousand places.', 'ranks at 99.5 and 99.9', N, async () => { const a = pr({ direction: 'toRank', value: 99.5, total: 300000 }).rank, b = pr({ direction: 'toRank', value: 99.9, total: 300000 }).rank; return [a - b > 1000, a + ' − ' + b + ' = ' + (a - b)]; });
    claim(PR, 'faq', 'counts your own place among those at or below your score, which is the first option here', 'NTA is the first option and the default', N, async () => [optVals(PR, 'method')[0] === 'nta' && input(PR, 'method').default === 'nta', optVals(PR, 'method').join()]);
    claim(PR, 'faq', 'They differ by one candidate out of the total, so on a large exam the choice barely matters.', 'on 1,200,000 the gap is under 0.0001', N, async () => { const n = pr({ value: 12500, total: 1200000 }).percentile, s = pr({ value: 12500, total: 1200000, method: 'plain' }).percentile; return [n - s < 0.0001 && n - s > 0, n - s]; });
    claim(PR, 'tip', 'Use the number who actually sat, not the number who registered.', 'the total moves the answer', N, async () => { const a = pr({ value: 5000, total: 1000000 }).percentile, b = pr({ value: 5000, total: 850000 }).percentile; return [a > b, a + ' / ' + b]; });
    manual(PR, 'tip', 'Percentile is not percentage.', 'definition; the tool has no marks input');
    manual(PR, 'tip', 'Multi-session exams normalise raw scores before ranking', 'exam-body practice');
    manual(PR, 'faq', 'Cut-offs move every year with the paper, the number of seats, the category and the counselling round.', 'exam-body practice');
    manual(PR, 'faq', 'Official percentiles are computed on normalised scores within each session', 'exam-body practice');
    manual(PR, 'dfaq', 'Everyone on the same score gets the same percentile, and the rank list then separates them using the exam body’s own tie-break rules.', 'exam-body practice');
    manual(PR, 'mistake', 'Each percentile is computed within its own session, so use that session’s total.', 'exam-body practice');
  }

  const SG = '/education/sgpa-to-cgpa/';
  const sg = (sgpa, credits) => run(SG, { sgpa, credits: credits === undefined ? '' : credits });
  const r2 = (x) => Math.round(x * 100) / 100;
  {
    const weighted = async () => every([['9.2, 7.1, 8.4, 8.0', '18, 26, 22, 24'], ['7.4, 7.9, 8.3, 8.6, 8.9, 9.1', '20, 22, 24, 24, 22, 18'], ['6.05, 9.99', '30, 10']], ([s, c]) => {
      const a = s.split(',').map(Number), b = c.split(',').map(Number); const want = r2(a.reduce((t, x, i) => t + x * b[i], 0) / b.reduce((t, x) => t + x, 0));
      const r = sg(s, c); return [r.cgpa === want && r.method === 'Weighted by credits', s + ' → ' + r.cgpa + ' (want ' + want + ')'];
    });
    claim(SG, 'lede', 'Turn semester grade points into a cumulative CGPA, weighted by semester credits where you have them, with the equivalent percentage.', 'weighted with credits, plain without', N, async () => {
      const a = sg('9.2, 7.1', '18, 26'), b = sg('9.2, 7.1'); return [a.cgpa === r2((9.2 * 18 + 7.1 * 26) / 44) && b.cgpa === 8.15 && close(a.pctTen, a.cgpa * 10), a.cgpa + ' / ' + b.cgpa + ', ' + a.pctTen];
    });
    claim(SG, 'card', 'Turn semester grade points into a cumulative CGPA, weighted by credits, with the equivalent percentage.', 'credit weighting', N, weighted);
    claim(SG, 'why', 'Enter each SGPA and its credits. Get a weighted CGPA and percentage.', 'credit weighting', N, weighted);
    claim(SG, 'formula', 'CGPA = Σ(SGPA × credits) ÷ Σ credits', 'three grade cards', N, weighted);
    claim(SG, 'works', 'Each semester’s SGPA is multiplied by its total credits, the products are added, and the sum is divided by the total credits; the result is rounded to two decimals.', 'three grade cards, rounded', N, weighted);
    claim(SG, 'works', 'Without a credit value for every semester the tool falls back to a plain average and says so.', 'no credits; too few credits', N, async () => {
      const a = sg('8, 9, 7'), b = sg('8, 9, 7', '20, 22'); return [a.cgpa === 8 && /Unweighted/.test(a.method) && b.cgpa === 8 && /Unweighted/.test(b.method) && /ignored/.test(b.note), a.method + ' / ' + b.note];
    });
    claim(SG, 'mistake', 'Six SGPAs with five credits make the tool ignore every credit and count the semesters equally.', 'six SGPAs, five credits', N, async () => {
      const r = sg('7.4, 7.9, 8.3, 8.6, 8.9, 9.1', '20, 22, 24, 24, 22'); return [r.cgpa === r2((7.4 + 7.9 + 8.3 + 8.6 + 8.9 + 9.1) / 6) && /You gave 5 credit values for 6 semesters/.test(r.note), r.cgpa + ' ' + r.note];
    });
    claim(SG, 'works', 'percentage = CGPA × 10 or CGPA × 9.5', 'both percentages from the rounded CGPA', N, async () => { const r = sg('7.4, 7.9, 8.3, 8.6, 8.9, 9.1', '20, 22, 24, 24, 22, 18'); return [close(r.pctTen, r.cgpa * 10) && close(r.pctNineFive, r.cgpa * 9.5) && r.cgpa === 8.36, r.cgpa + ' → ' + r.pctTen + ' / ' + r.pctNineFive]; });
    claim(SG, 'faq', 'The two shown here are the most common — multiply by ten, or by 9.5', 'the two percentage results', N, async () => [output(SG, 'pctTen').label === 'Percentage if × 10' && output(SG, 'pctNineFive').label === 'Percentage if × 9.5', output(SG, 'pctTen').label + ' / ' + output(SG, 'pctNineFive').label]);
    claim(SG, 'mistake', 'Use the two decimals on the grade card, or the CGPA can drift by a few hundredths.', 'one-decimal SGPAs move the CGPA', N, async () => { const a = sg('8.24, 7.66, 9.04', '20, 24, 22').cgpa, b = sg('8.2, 7.7, 9.0', '20, 24, 22').cgpa; const d = Math.abs(a - b); return [d > 0 && d < 0.1, a + ' vs ' + b]; });
    claim(SG, 'dfaq', '(8.5 × 150 − 1,087) ÷ 20 = 9.4', 'the seventh semester lands the target', N, async () => { const r = sg('7.4, 7.9, 8.3, 8.6, 8.9, 9.1, 9.4', '20, 22, 24, 24, 22, 18, 20').cgpa; return [r === 8.5, r]; });
    claim(SG, 'dfaq', 'Only when every semester carries the same credits.', 'equal credits = plain average; unequal do not', N, async () => {
      const a = sg('6.5, 8.75, 9.1', '20, 20, 20').cgpa, b = sg('6.5, 8.75, 9.1').cgpa, c = sg('6.5, 8.75, 9.1', '30, 20, 10').cgpa; return [a === b && c !== b, [a, b, c].join(', ')];
    });
    claim(SG, 'dfaq', 'A semester above your current CGPA always pulls it up, though by less each time as the total credits grow.', 'random grade cards', N, async () => every([...Array(200)].map(() => { const n = int(1, 6); return [[...Array(n)].map(() => int(500, 950) / 100), [...Array(n)].map(() => int(16, 26))]; }), ([s, c]) => {
      const now = sg(s.join(','), c.join(',')).cgpa; const next = Math.min(10, r2(now + int(5, 100) / 100)); const cr = 22;
      const one = sg(s.concat(next).join(','), c.concat(cr).join(',')).cgpa, two = sg(s.concat(next, next).join(','), c.concat(cr, cr).join(',')).cgpa;
      return [one >= now && two - one <= one - now + 0.01, s.join(',') + ' (' + now + ') + ' + next + ' → ' + one + ' → ' + two];
    }));
    claim(SG, 'tip', 'Credits mean the semester\'s total credit load, not the credits for one subject.', 'credits weight whole semesters', N, weighted);
    manual(SG, 'tip', 'an unweighted average quietly flatters whichever one went better', 'advice; the weighting itself is checked above');
    manual(SG, 'tip', 'Most universities compute CGPA weighted by credits.', 'university practice');
    manual(SG, 'tip', 'A backlog cleared in a later semester is normally counted in the semester it was cleared', 'university practice');
    manual(SG, 'tip', 'Keep the running CGPA rather than recomputing at the end.', 'advice');
    manual(SG, 'faq', 'If your university does, yes, and nearly all do.', 'university practice');
    manual(SG, 'faq', 'Grade replacement rules for repeated subjects also vary', 'university practice');
    manual(SG, 'faq', 'If the university replaces the grade on a repeat rather than averaging both attempts, enter only the replacement.', 'university practice');
    manual(SG, 'mistake', 'That rule belongs to CBSE school results', 'board rules');
  }
};
