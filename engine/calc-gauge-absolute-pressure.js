(function(){
/* Gauge ↔ absolute pressure.
   Absolute pressure is measured from a perfect vacuum; gauge pressure from the
   air around the gauge. absolute = gauge + atmospheric, so the only extra fact
   the conversion needs is the atmospheric pressure, which the visitor can set.

   Exact unit definitions, the same factors as engine/units.bundle.js so the
   site agrees with itself:
     1 bar = 100 000 Pa (exact, by definition)
     1 atm = 101 325 Pa (exact, standard atmosphere)
     1 psi = 1 lbf/in² = 0.45359237 kg × 9.80665 m/s² ÷ (0.0254 m)²
           = 6894.757293168361 Pa
     1 inHg = 3386.388640341 Pa (conventional, as in units.bundle.js)
   The default atmosphere is the standard atmosphere, 1.01325 bar. */
const PA = {
  psi: 6894.757293168361,
  bar: 100000,
  mbar: 100,
  hPa: 100,
  kPa: 1000,
  MPa: 1000000,
  inHg: 3386.388640341
};
/* What each unit is called once the reference is written on it. */
const SUFFIX = {
  psi:  { gauge: 'psig',  absolute: 'psia' },
  bar:  { gauge: 'barg',  absolute: 'bara' },
  mbar: { gauge: 'mbarg', absolute: 'mbar(a)' },
  kPa:  { gauge: 'kPag',  absolute: 'kPa(a)' },
  MPa:  { gauge: 'MPag',  absolute: 'MPa(a)' }
};
const ATM_NAME = { bar: 'bar', hPa: 'hPa', kPa: 'kPa', psi: 'psi', inHg: 'inHg' };

/* A number as render-core.js shows one: 2 decimals from 1,000 up, 4 from 1,
   6 below; grouped the way the reader's preferences say. `dp` overrides the
   decimals, so the figure somebody typed is echoed as they typed it. */
function num(v, dp) {
  let loc = 'en-GB';
  try { if (typeof window !== 'undefined' && window.Prefs && window.Prefs.locale) loc = window.Prefs.locale('GBP'); } catch (e) { /* default */ }
  const abs = Math.abs(v);
  if (dp === undefined) dp = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  const r = Number(v.toFixed(dp));
  return (r === 0 ? 0 : r).toLocaleString(loc, { maximumFractionDigits: dp });
}
/* Float dust where the answer is exactly zero (1.01325 bara less 1.01325 bar). */
const snap = (pa) => (Math.abs(pa) < 1e-6 ? 0 : pa);

window.TOOLS = window.TOOLS || {};
window.TOOLS["gauge-absolute-pressure"] = {
"title": "Gauge to Absolute Pressure Converter",
"category": "engineering",
"icon": "🧭",
"description": "Gauge to absolute pressure and back: psig to psia, barg to bara, kPa and MPa, at your local air pressure.",
"keywords": ["gauge pressure","absolute pressure","gauge to absolute","absolute to gauge","psig","psia","barg","bara","kpag","kpaa","mpag","mpaa","mbarg","psig to psia","psia to psig","psig to barg","barg to psig","psi to barg","kpa to barg","barg to bara","bara to barg","psia to mpa","mpag to kpag","map sensor","map sensor reading","manifold absolute pressure","boost pressure","turbo boost","vacuum","atmospheric pressure","barometric pressure","tyre pressure","tire pressure"],
"formula": "absolute = gauge + atmospheric   ·   gauge = absolute − atmospheric   ·   standard atmosphere = 1.01325 bar = 101.325 kPa = 14.6959 psi",
"inputs": [
  {"key":"value","label":"Pressure","type":"number","default":30},
  {"key":"unit","label":"Unit","type":"select","default":"psi","options":[
    {"value":"psi","label":"psi"},
    {"value":"bar","label":"bar"},
    {"value":"mbar","label":"mbar"},
    {"value":"kPa","label":"kPa"},
    {"value":"MPa","label":"MPa"}
  ]},
  {"key":"ref","label":"Measured as","type":"select","default":"gauge","options":[
    {"value":"gauge","label":"Gauge (psig, barg): above the surrounding air"},
    {"value":"absolute","label":"Absolute (psia, bara): above a perfect vacuum"}
  ]},
  {"key":"atm","label":"Atmospheric pressure","type":"number","default":1.01325,"min":0},
  {"key":"atmUnit","label":"Atmospheric pressure unit","type":"select","default":"bar","options":[
    {"value":"bar","label":"bar (standard: 1.01325)"},
    {"value":"hPa","label":"hPa or mbar (standard: 1013.25)"},
    {"value":"kPa","label":"kPa (standard: 101.325)"},
    {"value":"psi","label":"psi (standard: 14.6959)"},
    {"value":"inHg","label":"inHg (standard: 29.9213)"}
  ]}
],
"compute": ({ value, unit, ref, atm, atmUnit }) => {
      const has = (v) => v !== null && v !== undefined && v !== '' && isFinite(Number(v));
      const u = PA[unit] && SUFFIX[unit] ? unit : 'psi';
      const r = ref === 'absolute' ? 'absolute' : 'gauge';
      const au = PA[atmUnit] && ATM_NAME[atmUnit] ? atmUnit : 'bar';
      if (!has(value)) return { answer: '', note: 'Enter a pressure.' };
      if (!has(atm) || Number(atm) <= 0) return { answer: '', note: 'Enter the atmospheric pressure, a number above zero. The standard atmosphere is 1.01325 bar.' };

      const v = Number(value);
      const atmPa = Number(atm) * PA[au];
      const given = num(v, 10) + ' ' + SUFFIX[u][r];
      const absPa = snap(r === 'gauge' ? v * PA[u] + atmPa : v * PA[u]);
      const gPa = snap(absPa - atmPa);
      const atmText = 'Atmospheric pressure used: ' + num(atmPa / PA.bar, 6) + ' bar (' + num(atmPa / PA.kPa) + ' kPa, ' + num(atmPa / PA.psi) + ' psi).';

      if (absPa < 0) {
        return {
          answer: 'Impossible: ' + given + ' is below a perfect vacuum',
          note: (r === 'gauge'
            ? 'A gauge reading can go no lower than minus the atmospheric pressure, here ' + num(-atmPa / PA[u]) + ' ' + SUFFIX[u].gauge + ', which is a perfect vacuum (0 ' + SUFFIX[u].absolute + '). Absolute pressure cannot be negative, so check the reading, its unit and whether it is really gauge.'
            : 'Absolute pressure is measured from a perfect vacuum, so it cannot be negative. If the reading is a gauge value, choose Gauge.') + ' ' + atmText
        };
      }

      const out = r === 'gauge' ? absPa / PA[u] : gPa / PA[u];
      const other = r === 'gauge' ? 'absolute' : 'gauge';
      let note = atmText;
      if (absPa === 0) note = 'This is a perfect vacuum: zero absolute pressure. ' + note;
      else if (gPa < 0) note = 'Below atmospheric: a partial vacuum of ' + num(-gPa / PA[u]) + ' ' + u + ' under the surrounding air, ' + num(-gPa / atmPa * 100) + '% of the way to a perfect vacuum. ' + note;
      return {
        answer: given + ' = ' + num(out) + ' ' + SUFFIX[u][other],
        psig: gPa / PA.psi, psia: absPa / PA.psi,
        barg: gPa / PA.bar, bara: absPa / PA.bar,
        kpag: gPa / PA.kPa, kpaa: absPa / PA.kPa,
        mpag: gPa / PA.MPa, mpaa: absPa / PA.MPa,
        mbarg: gPa / PA.mbar, mbara: absPa / PA.mbar,
        atma: absPa / 101325,
        note
      };
    },
"outputs": [
  {"key":"answer","label":"Result","format":"text","primary":true},
  {"key":"psig","label":"psi, gauge","format":"number","unit":"psig"},
  {"key":"psia","label":"psi, absolute","format":"number","unit":"psia"},
  {"key":"barg","label":"bar, gauge","format":"number","unit":"barg"},
  {"key":"bara","label":"bar, absolute","format":"number","unit":"bara"},
  {"key":"kpag","label":"kPa, gauge","format":"number","unit":"kPag"},
  {"key":"kpaa","label":"kPa, absolute","format":"number","unit":"kPa(a)"},
  {"key":"mpag","label":"MPa, gauge","format":"number","unit":"MPag"},
  {"key":"mpaa","label":"MPa, absolute","format":"number","unit":"MPa(a)"},
  {"key":"mbarg","label":"mbar, gauge","format":"number","unit":"mbarg"},
  {"key":"mbara","label":"mbar (hPa), absolute","format":"number","unit":"mbar(a)"},
  {"key":"atma","label":"Standard atmospheres, absolute","format":"number","unit":"atm"},
  {"key":"note","label":"","format":"text"}
],
"tips": ["Tyre, compressor and boiler gauges read gauge pressure: zero on the dial means the same pressure as the air around it, not zero pressure.","A car’s MAP sensor reads absolute pressure. Choose Absolute for its reading, and the psig or barg row is what a boost gauge would show.","For a precise answer away from sea level or in unusual weather, enter today’s local barometric pressure in place of the standard atmosphere."],
"faq": [
  {"q":"What is the difference between gauge and absolute pressure?","a":"Absolute pressure is measured from a perfect vacuum, so it is never negative. Gauge pressure is measured from the air around the gauge, so it reads zero when open to the air and goes negative under a vacuum. Absolute pressure is gauge pressure plus the atmospheric pressure."},
  {"q":"What do the g and a after psi, bar and kPa mean?","a":"g means gauge and a means absolute: psig and barg are measured above the surrounding air, psia and bara above a perfect vacuum. kPa and MPa are often written kPag and kPa(a). A plain psi or bar with no letter is usually gauge on a tyre or compressor and absolute in physics and weather; when it matters, ask."},
  {"q":"Why are tyre pressures gauge pressures?","a":"Because a tyre gauge compares the air inside with the air outside, and that difference is what holds the tyre up. A flat tyre still holds air at atmospheric pressure, and the gauge reads 0 psig, not 0 psia."},
  {"q":"Is a car MAP sensor reading gauge or absolute?","a":"Absolute: MAP stands for manifold absolute pressure. With the engine off it reads the barometric pressure. Under boost, subtract the atmospheric pressure from the MAP reading to get the boost a gauge would show; at idle the reading is below atmospheric and the gauge figure is negative, a vacuum."}
]
};
})();
