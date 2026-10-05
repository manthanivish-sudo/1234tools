/**
 * Claims on the unit conversion pages (/conversions/): the 13 hubs and the
 * 1,048 pair pages build-conversions.js writes.
 *
 * Every figure on those pages is computed by build-conversions.js from
 * engine/units.bundle.js's own convert(). Checking a page against that same
 * engine would prove only that rendering works, never that a factor is
 * right. So everything here is checked against an INDEPENDENT reference: each
 * unit defined below from first principles (the defining documents named
 * beside it), in exact rational arithmetic (BigInt), with π carried as a
 * symbol. The engine appears in exactly two places: each unit's factor is
 * compared with the reference (the "engine factor" checks on the family
 * hubs), and the sentence "the converter above uses the full value" is
 * checked on the converter's own arithmetic.
 *
 * Per pair page (about five checks): the formula and the words under it
 * (factor, "exact" / "≈" / "about" against whether the ratio is exact by
 * definition, the reverse figure), the worked example, every table row at
 * the precision shown, the note, and the lede (units, both directions, the
 * converter it mounts); the tyre table on the four psi/bar/kPa pages. On the
 * hubs: counts, the picker's data, popular cards, quick reference, every
 * figure and statement in "About" and the FAQ, the full list, related links,
 * and the picker, swap, filter and offline behaviour in Chrome.
 *
 * Sources (read 2026-10-04):
 *   SI    BIPM, The International System of Units, 9th ed. (2019): c, ΔνCs,
 *         prefixes, Table 8 (min, h, d, °, ′, ″, ha, L, t, Å, bar, au, nautical
 *         mile, knot, eV), the binary prefixes note (kibi = 2¹⁰ …),
 *         t/°C = T/K − 273.15.
 *         https://www.bipm.org/documents/20126/41483022/SI-Brochure-9-EN.pdf
 *   N811  NIST SP 811 (2008) App. B.8, and its footnotes (fn 9: IT Btu =
 *         1.055 055 852 62 kJ exactly; fn 18: Julian year 365.25 d; fn 20:
 *         nautical mile 1852 m, Monaco 1929).
 *         https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8
 *         https://www.nist.gov/pml/special-publication-811/nist-guide-si-footnotes
 *   HB44  NIST Handbook 44 (2024) App. C: gallon = 231 in³ = 128 fl oz,
 *         cup = 8 fl oz, tablespoon = ½ fl oz, teaspoon = ⅓ tablespoon,
 *         fathom = 6 ft, chain = 66 ft, acre = 43 560 ft², short ton =
 *         2000 lb, troy ounce = 480 grains, avoirdupois pound = 7000 grains;
 *         the U.S. survey foot deprecated after 2022 (international foot used).
 *         https://www.nist.gov/document/nist-hb-44-2024-appendix-c-general-tables-units-measurement
 *   WMA   UK Weights and Measures Act 1985, Sch. 1: yard = 0.9144 m, pound =
 *         0.45359237 kg, gallon = 4.54609 dm³, pint = 0.56826125 dm³, fluid
 *         ounce = 1/20 pint, chain = 22 yd, furlong = 220 yd, mile = 1760 yd,
 *         acre = 4840 yd², stone = 14 lb, ton = 2240 lb.
 *         https://www.legislation.gov.uk/ukpga/1985/72/schedule/1
 *   IAU12 IAU 2012 Resolution B2: au = 149 597 870 700 m exactly.
 *         https://syrte.obspm.fr/IAU_resolutions/Res_IAU2012_B2.pdf
 *   IAU15 IAU 2015 Resolution B2, note 4: parsec = (648 000/π) au exactly.
 *         https://arxiv.org/pdf/1510.06262
 *   CODATA elementary charge 1.602 176 634 × 10⁻¹⁹ C (exact).
 *         https://physics.nist.gov/cgi-bin/cuu/Value?e
 *   HG    conventional mmHg = 13 595.1 kg/m³ × gₙ × 1 mm = 133.322 387 415 Pa
 *         (ISO 80000-4), https://en.wikipedia.org/wiki/Millimetre_of_mercury;
 *         cross-checked with N811 (inHg conventional 3.386 389 E+03).
 *   USSA  U.S. Standard Atmosphere 1976: T₀ = 288.15 K, R* = 8.31432
 *         J/(mol·K), M₀ = 28.9644 g/mol, γ = 1.40, 216.65 K at 11 km.
 *         https://en.wikipedia.org/wiki/U.S._Standard_Atmosphere
 *   TEMP  scale defining points (Réaumur 0/80, Delisle 150/0, Newton 0/33,
 *         Rømer 7.5/60, Rankine absolute with Fahrenheit-sized degrees).
 *         https://en.wikipedia.org/wiki/Conversion_of_scales_of_temperature
 *   COOK  imperial pint 568.26125 mL, imperial fl oz 28.4130625 mL, metric
 *         cup 250 mL, Australian tablespoon 20 mL.
 *         https://en.wikipedia.org/wiki/Cooking_weights_and_measures
 * Which calorie: the engine's "cal" is the THERMOCHEMICAL calorie (4.184 J,
 * N811), not the International Table calorie (4.1868 J); its BTU is the
 * International Table BTU. Which horsepower: "hp" is mechanical (550 ft·lbf/s),
 * "PS" metric (75 kgf·m/s). Data: KB/MB/GB/TB are decimal (10³ⁿ B), as the
 * pages say; KiB … TiB binary (2¹⁰ⁿ B).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ================================================================== */
/* exact rationals (BigInt), and values with π as a symbol            */
/* ================================================================== */

const BA = (x) => (x < 0n ? -x : x);
function gcd(a, b) { a = BA(a); b = BA(b); while (b) { const t = a % b; a = b; b = t; } return a; }
class Q {
  constructor(n, d) {
    n = BigInt(n); d = d === undefined ? 1n : BigInt(d);
    if (d === 0n) throw new Error('division by zero');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    this.n = n / g; this.d = d / g;
  }
  add(o) { o = q(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = q(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = q(o); return new Q(this.n * o.n, this.d * o.d); }
  div(o) { o = q(o); return new Q(this.n * o.d, this.d * o.n); }
  neg() { return new Q(-this.n, this.d); }
  inv() { return new Q(this.d, this.n); }
  eq(o) { o = q(o); return this.n === o.n && this.d === o.d; }
  isZero() { return this.n === 0n; }
  pow(k) { let r = new Q(1n); for (let i = 0; i < k; i++) r = r.mul(this); return r; }
  /** the nearest double, from 25 significant digits */
  num() {
    if (this.n === 0n) return 0;
    const neg = this.n < 0n, n = BA(this.n);
    const s = 25 - (n.toString().length - this.d.toString().length);
    const v = s >= 0 ? (n * 10n ** BigInt(s)) / this.d : n / (this.d * 10n ** BigInt(-s));
    return (neg ? -1 : 1) * Number(v.toString() + 'e' + (-s));
  }
  toString() { return this.d === 1n ? String(this.n) : this.n + '/' + this.d; }
}
/** a Q from an integer or a decimal string ("1,609.344", "1e-10", "9/5") */
function q(x) {
  if (x instanceof Q) return x;
  if (typeof x === 'bigint') return new Q(x);
  if (typeof x === 'number' && Number.isInteger(x)) return new Q(BigInt(x));
  const s = String(x).replace(/[,\s]/g, '').replace(/−/g, '-');
  if (s.indexOf('/') > 0) { const [a, b] = s.split('/'); return q(a).div(q(b)); }
  const m = /^(-?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s);
  if (!m || (m[2] === '' && !m[3])) throw new Error('not a number: ' + x);
  const digits = (m[2] || '0') + (m[3] || '');
  const e = (m[4] ? Number(m[4]) : 0) - (m[3] || '').length;
  const n = BigInt(digits) * (m[1] ? -1n : 1n);
  return e >= 0 ? new Q(n * 10n ** BigInt(e)) : new Q(n, 10n ** BigInt(-e));
}
/** a value q × π^k */
const P = (x, k) => ({ q: q(x), k: k || 0 });
const ZERO = P(0);
const pmul = (a, b) => ({ q: a.q.mul(b.q), k: a.k + b.k });
const pdiv = (a, b) => ({ q: a.q.div(b.q), k: a.k - b.k });
const peq = (a, b) => a.q.eq(b.q) && (a.k === b.k || a.q.isZero());
const pnum = (a) => a.q.num() * Math.pow(Math.PI, a.k);
const pstr = (a) => a.q.toString() + (a.k ? ' × π' + (a.k === 1 ? '' : '^' + a.k) : '');
function padd(a, b) {
  if (a.q.isZero()) return b;
  if (b.q.isZero()) return a;
  if (a.k !== b.k) throw new Error('adds a multiple of π to a number');
  return { q: a.q.add(b.q), k: a.k };
}
/** does x terminate as a decimal with at most maxSig significant digits? */
function shortDec(x, maxSig) {
  let d = x.d, s = 0;
  while (d % 2n === 0n) { d /= 2n; s++; }
  let s5 = 0;
  while (d % 5n === 0n) { d /= 5n; s5++; }
  if (d !== 1n) return false;
  const sc = Math.max(s, s5);
  let int = BA(x.n) * 10n ** BigInt(sc) / x.d;
  let str = int.toString().replace(/0+$/, '');
  return str.length <= maxSig;
}
/** does x terminate within maxDp decimal places? */
function shortDp(x, maxDp) { return (x.mul(10n ** BigInt(maxDp))).d === 1n; }

/* ================================================================== */
/* the reference                                                      */
/* ================================================================== */

const C_LIGHT = q(299792458);                 /* SI: c, exact */
const GN = q('9.80665');                      /* N811: standard acceleration of free fall, exact */
const YD = q('0.9144');                       /* 1959 agreement; WMA Sch.1 */
const FT = YD.div(3), IN = YD.div(36), MI = YD.mul(1760);   /* WMA Sch.1 */
const LB = q('0.45359237');                   /* 1959 agreement; WMA Sch.1 */
const DAY = q(86400);                         /* SI Table 8 */
const JYR = DAY.mul(q('365.25'));             /* Julian year, N811 fn 18 */
const AU = q(149597870700);                   /* IAU12 */
const GAL = IN.pow(3).mul(231);               /* HB44: US gallon = 231 in³ */
const FLOZ = GAL.div(128);                    /* HB44: 128 fl oz to the gallon */
const GALUK = q('0.00454609');                /* WMA: 4.54609 dm³ */
const MMHG = q('13595.1').mul(GN).div(1000);  /* HG: conventional mmHg */
const CAL_TH = q('4.184');                    /* N811: thermochemical calorie, exact */
const CAL_IT = q('4.1868');                   /* N811: IT calorie, exact */
const BTU_IT = CAL_IT.mul(LB.mul(1000)).mul(5).div(9);   /* N811 fn 9: 1055.05585262 J */
const LBF = LB.mul(GN);
const ATM = q(101325);                        /* N811, exact */
const EV = q('1.602176634e-19');              /* CODATA e, exact */
/* the ISA speed of sound, from USSA constants (not exact) */
const ISA = (T) => Math.sqrt(1.4 * 8.31432 / 0.0289644 * T);
const ISA_SL = ISA(288.15);                   /* 340.294 m/s */

const u = (v, sym, t, re, src, extra) => Object.assign({ v: v.q ? v : P(v), ex: true, sym, t, re, src }, extra || {});
const REF = {
  length: { noun: /length/i, u: {
    ang: u(q('1e-10'), 'Å', 'Angstrom', /\bangstroms?\b/i, 'SI Table 8: 1 Å = 10⁻¹⁰ m'),
    nm: u(q('1e-9'), 'nm', 'Nanometre', /\bnanomet(?:re|er)s?\b/i, 'SI prefix nano'),
    um: u(q('1e-6'), 'µm', 'Micrometre', /\bmicromet(?:re|er)s?\b/i, 'SI prefix micro'),
    mm: u(q('1e-3'), 'mm', 'Millimetre', /\bmillimet(?:re|er)s?\b/i, 'SI prefix milli'),
    cm: u(q('1e-2'), 'cm', 'Centimetre', /\bcentimet(?:re|er)s?\b/i, 'SI prefix centi'),
    m: u(q(1), 'm', 'Metre', /\bmet(?:re|er)s?\b/i, 'SI base unit'),
    km: u(q(1000), 'km', 'Kilometre', /\bkilomet(?:re|er)s?\b/i, 'SI prefix kilo'),
    in: u(IN, 'in', 'Inch', /\binch(?:es)?\b/i, 'WMA: inch = 1/36 yard'),
    ft: u(FT, 'ft', 'Foot', /\bf(?:oo|ee)t\b/i, 'WMA: foot = 1/3 yard'),
    yd: u(YD, 'yd', 'Yard', /\byards?\b/i, 'WMA; 1959: yard = 0.9144 m'),
    fath: u(FT.mul(6), 'ftm', 'Fathom', /\bfathoms?\b/i, 'HB44: fathom = 6 ft (international foot)'),
    chain: u(YD.mul(22), 'ch', 'Chain', /\bchains?\b/i, 'WMA: chain = 22 yd; HB44 66 ft'),
    fur: u(YD.mul(220), 'fur', 'Furlong', /\bfurlongs?\b/i, 'WMA: furlong = 220 yd'),
    mi: u(MI, 'mi', 'Mile', /(?<!nautical )\bmiles?\b/i, 'WMA: mile = 1760 yd'),
    nmi: u(q(1852), 'nmi', 'Nautical Mile', /\bnautical miles?\b/i, 'SI Table 8; N811 fn 20: 1852 m'),
    au: u(AU, 'AU', 'Astronomical Unit', /\bastronomical units?\b/i, 'IAU12: 149 597 870 700 m'),
    ly: u(C_LIGHT.mul(JYR), 'ly', 'Light Year', /\blight years?\b/i, 'c × Julian year (365.25 d)'),
    pc: u(P(AU.mul(648000), -1), 'pc', 'Parsec', /\bparsecs?\b/i, 'IAU15: (648 000/π) au')
  } },
  mass: { noun: /mass|weight/i, u: {
    mg: u(q('1e-6'), 'mg', 'Milligram', /\bmilligrams?\b/i, 'SI prefix'),
    g: u(q('1e-3'), 'g', 'Gram', /\bgrams?\b/i, 'SI prefix'),
    kg: u(q(1), 'kg', 'Kilogram', /\bkilograms?\b/i, 'SI base unit'),
    t: u(q(1000), 't', 'Tonne', /\btonnes?\b/i, 'SI Table 8: 1 t = 10³ kg'),
    oz: u(LB.div(16), 'oz', 'Ounce', /\bounces?\b/i, 'WMA: ounce = 1/16 lb'),
    lb: u(LB, 'lb', 'Pound', /\bpounds?\b/i, 'WMA; 1959: 0.45359237 kg'),
    st: u(LB.mul(14), 'st', 'Stone', /\bstones?\b/i, 'WMA: stone = 14 lb'),
    ton: u(LB.mul(2000), 'ton', 'US Short Ton', /short tons?|ton \(US short\)/i, 'HB44: short ton = 2000 lb'),
    lt: u(LB.mul(2240), 'LT', 'UK Long Ton', /long tons?|ton \(UK long\)/i, 'WMA: ton = 2240 lb')
  } },
  /* T/K = a·x + b; a scale fixed by its readings at the ice point (273.15 K)
     and the steam point (373.15 K) of the old definitions */
  temperature: { noun: /temperature/i, affine: true, u: {} },
  volume: { noun: /volume/i, u: {
    ml: u(q('1e-6'), 'mL', 'Millilitre', /\bmillilit(?:re|er)s?\b/i, 'SI Table 8: L = dm³'),
    l: u(q('1e-3'), 'L', 'Litre', /\blit(?:re|er)s?\b/i, 'SI Table 8: 1 L = 10⁻³ m³'),
    m3: u(q(1), 'm³', 'Cubic Metre', /\bcubic met(?:re|er)s?\b/i, 'SI'),
    tsp: u(FLOZ.div(6), 'tsp', 'US Teaspoon', /\bteaspoons?\b/i, 'HB44: ⅓ tablespoon'),
    tbsp: u(FLOZ.div(2), 'tbsp', 'US Tablespoon', /\btablespoons?\b/i, 'HB44: ½ fl oz'),
    floz: u(FLOZ, 'fl oz', 'US Fluid Ounce', /\bfluid ounces?\b/i, 'HB44: 1/128 gal'),
    cup: u(FLOZ.mul(8), 'cup', 'US Cup', /\bcups?\b/i, 'HB44: 8 fl oz'),
    pt: u(GAL.div(8), 'pt', 'US Pint', /\bpints?\b/i, 'HB44: 1/8 gal'),
    qt: u(GAL.div(4), 'qt', 'US Quart', /\bquarts?\b/i, 'HB44: 1/4 gal'),
    gal: u(GAL, 'gal', 'US Gallon', /\bUS gallons?|gallon \(US\)/i, 'HB44: 231 in³'),
    galuk: u(GALUK, 'gal UK', 'Imperial Gallon', /\bimperial gallons?|gallon \(imperial\)/i, 'WMA: 4.54609 dm³'),
    ft3: u(FT.pow(3), 'ft³', 'Cubic Foot', /\bcubic f(?:oo|ee)t\b/i, 'ft³')
  } },
  area: { noun: /area/i, u: {
    mm2: u(q('1e-6'), 'mm²', 'Square Millimetre', /\bsquare millimet(?:re|er)s?\b/i, 'mm²'),
    cm2: u(q('1e-4'), 'cm²', 'Square Centimetre', /\bsquare centimet(?:re|er)s?\b/i, 'cm²'),
    m2: u(q(1), 'm²', 'Square Metre', /\bsquare met(?:re|er)s?\b/i, 'SI'),
    ha: u(q(10000), 'ha', 'Hectare', /\bhectares?\b/i, 'SI Table 8: 1 ha = 10⁴ m²'),
    km2: u(q('1e6'), 'km²', 'Square Kilometre', /\bsquare kilomet(?:re|er)s?\b/i, 'km²'),
    in2: u(IN.pow(2), 'in²', 'Square Inch', /\bsquare inch(?:es)?\b/i, 'in²'),
    ft2: u(FT.pow(2), 'ft²', 'Square Foot', /\bsquare f(?:oo|ee)t\b/i, 'ft²'),
    yd2: u(YD.pow(2), 'yd²', 'Square Yard', /\bsquare yards?\b/i, 'yd²'),
    acre: u(YD.pow(2).mul(4840), 'ac', 'Acre', /\bacres?\b/i, 'WMA: 4840 yd²; HB44 43 560 ft²'),
    mi2: u(MI.pow(2), 'mi²', 'Square Mile', /\bsquare miles?\b/i, 'mi² (WMA: 640 acres)')
  } },
  time: { noun: /time/i, u: {
    ms: u(q('0.001'), 'ms', 'Millisecond', /\bmilliseconds?\b/i, 'SI prefix'),
    s: u(q(1), 's', 'Second', /\bseconds?\b/i, 'SI base unit'),
    min: u(q(60), 'min', 'Minute', /\bminutes?\b/i, 'SI Table 8'),
    h: u(q(3600), 'h', 'Hour', /\bhours?\b/i, 'SI Table 8'),
    day: u(DAY, 'd', 'Day', /\bdays?\b/i, 'SI Table 8: 86 400 s'),
    week: u(DAY.mul(7), 'wk', 'Week', /\bweeks?\b/i, '7 d'),
    mo: u(JYR.div(12), 'mo', 'Month (average)', /\bmonths?\b/i, 'the page’s stated convention: 1/12 Julian year'),
    yr: u(JYR, 'yr', 'Year (Julian)', /\byears?\b/i, 'Julian year, N811 fn 18')
  } },
  speed: { noun: /speed/i, u: {
    mps: u(q(1), 'm/s', 'Metres per Second', /\bmet(?:re|er)s? per second\b/i, 'SI'),
    kph: u(q(1000).div(3600), 'km/h', 'Kilometres per Hour', /\bkilomet(?:re|er)s? per hour\b/i, 'km/h'),
    mph: u(MI.div(3600), 'mph', 'Miles per Hour', /\bmiles? per hour\b/i, 'mi/h'),
    fps: u(FT, 'ft/s', 'Feet per Second', /\bf(?:ee|oo)t per second\b/i, 'ft/s'),
    knot: u(q(1852).div(3600), 'kn', 'Knot', /\bknots?\b/i, 'SI Table 8: (1852/3600) m/s'),
    /* not exact: a conventional sea-level speed of sound, as the page says;
       USSA gives 340.294 m/s */
    mach: u(q('340.29'), 'Ma', 'Mach (sea level)', /\bMach\b/, 'the page’s stated 340.29 m/s; USSA 340.294', { ex: false })
  } },
  pressure: { noun: /pressure/i, u: {
    Pa: u(q(1), 'Pa', 'Pascal', /\bpascals?\b/i, 'SI'),
    kPa: u(q(1000), 'kPa', 'Kilopascal', /\bkilopascals?\b/i, 'SI prefix'),
    MPa: u(q('1e6'), 'MPa', 'Megapascal', /\bmegapascals?\b/i, 'SI prefix'),
    bar: u(q(100000), 'bar', 'Bar', /\bbar\b/i, 'SI Table 8: 10⁵ Pa'),
    mbar: u(q(100), 'mbar', 'Millibar', /\bmillibars?\b/i, '10² Pa'),
    psi: u(LBF.div(IN.pow(2)), 'psi', 'PSI', /\bpsi\b/i, 'lbf/in² with gₙ'),
    atm: u(ATM, 'atm', 'Atmosphere', /\batmospheres?\b/i, 'N811: 101 325 Pa exactly'),
    torr: u(ATM.div(760), 'Torr', 'Torr', /\btorr\b/i, '1/760 atm'),
    inHg: u(MMHG.mul(q('25.4')), 'inHg', 'Inch of Mercury', /\binch(?:es)? of mercury\b/i, 'HG: conventional, 25.4 mmHg')
  } },
  energy: { noun: /energy/i, u: {
    J: u(q(1), 'J', 'Joule', /\bjoules?\b/i, 'SI'),
    kJ: u(q(1000), 'kJ', 'Kilojoule', /\bkilojoules?\b/i, 'SI prefix'),
    cal: u(CAL_TH, 'cal', 'Calorie', /\bcalories?\b/i, 'N811: thermochemical calorie 4.184 J'),
    kcal: u(CAL_TH.mul(1000), 'kcal', 'Kilocalorie', /\bkilocalories?\b/i, '1000 cal_th'),
    Wh: u(q(3600), 'Wh', 'Watt-hour', /\bwatt[- ]hours?\b/i, '3600 J'),
    kWh: u(q('3.6e6'), 'kWh', 'Kilowatt-hour', /\bkilowatt[- ]hours?\b/i, 'N811: 3.6 MJ'),
    BTU: u(BTU_IT, 'BTU', 'BTU', /\bBTU\b|British thermal units?/i, 'N811 fn 9: IT Btu'),
    eV: u(EV, 'eV', 'Electronvolt', /\belectronvolts?\b/i, 'SI Table 8; CODATA'),
    ftlb: u(FT.mul(LBF), 'ft·lb', 'Foot-pound', /\bfoot[- ]pounds?\b/i, 'ft × lbf')
  } },
  power: { noun: /power/i, u: {
    mW: u(q('0.001'), 'mW', 'Milliwatt', /\bmilliwatts?\b/i, 'SI prefix'),
    W: u(q(1), 'W', 'Watt', /\bwatts?\b/i, 'SI'),
    kW: u(q(1000), 'kW', 'Kilowatt', /\bkilowatts?\b/i, 'SI prefix'),
    MW: u(q('1e6'), 'MW', 'Megawatt', /\bmegawatts?\b/i, 'SI prefix'),
    hp: u(FT.mul(LBF).mul(550), 'hp', 'Horsepower', /(?<!metric )\bhorsepower\b(?! \(metric\))/i, '550 ft·lbf/s'),
    hpM: u(GN.mul(75), 'PS', 'Metric Horsepower', /\bmetric horsepower|horsepower \(metric\)/i, '75 kgf·m/s'),
    btuh: u(BTU_IT.div(3600), 'BTU/h', 'BTU per Hour', /\bBTU per hour\b/i, 'IT Btu per hour')
  } },
  data: { noun: /storage|data/i, u: {
    bit: u(q(1).div(8), 'bit', 'Bit', /\bbits?\b/i, '1/8 byte'),
    B: u(q(1), 'B', 'Byte', /\bbytes?\b/i, 'byte'),
    KB: u(q('1e3'), 'KB', 'Kilobyte', /\bkilobytes?\b/i, 'SI prefix kilo'),
    MB: u(q('1e6'), 'MB', 'Megabyte', /\bmegabytes?\b/i, 'SI prefix mega'),
    GB: u(q('1e9'), 'GB', 'Gigabyte', /\bgigabytes?\b/i, 'SI prefix giga'),
    TB: u(q('1e12'), 'TB', 'Terabyte', /\bterabytes?\b/i, 'SI prefix tera'),
    KiB: u(q(2n ** 10n), 'KiB', 'Kibibyte', /\bkibibytes?\b/i, 'SI/IEC 80000-13: kibi = 2¹⁰'),
    MiB: u(q(2n ** 20n), 'MiB', 'Mebibyte', /\bmebibytes?\b/i, 'mebi = 2²⁰'),
    GiB: u(q(2n ** 30n), 'GiB', 'Gibibyte', /\bgibibytes?\b/i, 'gibi = 2³⁰'),
    TiB: u(q(2n ** 40n), 'TiB', 'Tebibyte', /\btebibytes?\b/i, 'tebi = 2⁴⁰')
  } },
  angle: { noun: /angle/i, u: {
    rad: u(P(1), 'rad', 'Radian', /\bradians?\b/i, 'SI'),
    deg: u(P(q(1).div(180), 1), '°', 'Degree', /\bdegrees?\b/i, 'SI Table 8: (π/180) rad'),
    grad: u(P(q(1).div(200), 1), 'grad', 'Gradian', /\bgradians?\b/i, 'right angle / 100'),
    turn: u(P(2, 1), 'turn', 'Turn', /\bturns?\b/i, '2π rad'),
    arcmin: u(P(q(1).div(10800), 1), "'", 'Arcminute', /\barcminutes?\b/i, 'SI Table 8: (π/10 800) rad'),
    arcsec: u(P(q(1).div(648000), 1), '"', 'Arcsecond', /\barcseconds?\b/i, 'SI Table 8: (π/648 000) rad')
  } }
};
/* temperature scales from their defining points */
(function () {
  const ICE = q('273.15'), STEAM = q('373.15');
  const pts = (frz, boil) => { const a = STEAM.sub(ICE).div(q(boil).sub(q(frz))); return { a, b: ICE.sub(q(frz).mul(a)) }; };
  const T = REF.temperature.u;
  const t = (ab, sym, title, re, src) => Object.assign({ ex: true, sym, t: title, re, src }, ab);
  T.C = t(pts(0, 100), '°C', 'Celsius', /\bCelsius\b/, 'SI: t/°C = T/K − 273.15');
  T.F = t(pts(32, 212), '°F', 'Fahrenheit', /\bFahrenheit\b/, '32 °F ice, 212 °F steam');
  T.K = t({ a: q(1), b: q(0) }, 'K', 'Kelvin', /\bkelvins?\b/i, 'SI base unit');
  T.R = t({ a: q(5).div(9), b: q(0) }, '°R', 'Rankine', /\bRankine\b/, 'absolute, Fahrenheit-sized degree');
  T.Re = t(pts(0, 80), '°Ré', 'Réaumur', /\bRéaumur\b/, 'TEMP: 0 ice, 80 steam');
  T.De = t(pts(150, 0), '°De', 'Delisle', /\bDelisle\b/, 'TEMP: 150 ice, 0 steam');
  T.N = t(pts(0, 33), '°N', 'Newton', /\bNewton\b/, 'TEMP: 0 ice, 33 steam');
  T.Ro = t(pts('7.5', 60), '°Rø', 'Rømer', /\bRømer\b/, 'TEMP: 7.5 ice, 60 steam');
})();

/* NIST SP 811 B.8 / HB44 figures each first-principles value must round to:
   a guard on the reference itself (a typo here would otherwise pass) */
const NIST = {
  length: { ft: '0.3048', mi: '1609.344', nmi: '1852', au: '1.495979e11', ly: '9.46073e15', pc: '3.085678e16' },
  mass: { lb: '0.4535924', oz: '0.02834952', ton: '907.1847', lt: '1016.047' },
  volume: { gal: '0.003785412', galuk: '0.00454609', cup: '0.0002365882', floz: '0.00002957353', pt: '0.0004731765', qt: '0.0009463529', tbsp: '0.00001478676', tsp: '0.000004928922' },
  area: { acre: '4046.8564224' },
  time: { day: '86400', yr: '31557600' },
  speed: { knot: '0.5144444' },
  pressure: { atm: '101325', bar: '100000', inHg: '3386.389', torr: '133.3224' },
  energy: { cal: '4.184', kWh: '3600000', BTU: '1055.05585262', eV: '1.602176634e-19', ftlb: '1.355818' },
  power: { hp: '745.6999', hpM: '735.4988' },
  angle: {}, data: {}, temperature: {}
};

/* ================================================================== */
/* reference arithmetic                                               */
/* ================================================================== */

/** the conversion a → b as an affine map x ↦ A·x + B (both values with π) */
function refAff(fam, a, b) {
  const F = REF[fam];
  const A = F.u[a], Bu = F.u[b];
  if (!A || !Bu) throw new Error('the reference has no ' + fam + ' unit ' + (!A ? a : b));
  if (F.affine) return { a: P(A.a.div(Bu.a)), b: P(A.b.sub(Bu.b).div(Bu.a)) };
  return { a: pdiv(A.v, Bu.v), b: ZERO };
}
/** x in a, in b (a double) */
function R(fam, x, a, b) {
  const f = refAff(fam, a, b);
  const xs = typeof x === 'number' ? x : Number(String(x).replace(/,/g, '').replace(/−/g, '-'));
  if (f.a.k === 0 && f.b.k === 0) { try { return q(String(xs)).mul(f.a.q).add(f.b.q).num(); } catch (e) { /* not a short decimal */ } }
  return xs * pnum(f.a) + pnum(f.b);
}
const allExact = (fam, a, b) => !!(REF[fam].u[a].ex && REF[fam].u[b].ex);

/* ================================================================== */
/* figures as the converter prints them                               */
/* ================================================================== */

const clean = (s) => String(s).trim().replace(/−/g, '-').replace(/,/g, '');
function shownNum(s) { const t = clean(s); return /^-?\d*\.?\d+(?:e[+-]\d+)?$/.test(t) ? Number(t) : null; }
/** half a unit in the last place the converter's format keeps (render-core fmt.number) */
function tolOf(s) {
  const t = clean(s);
  const m = /e([+-]\d+)$/.exec(t);
  if (m) return 0.5 * Math.pow(10, Number(m[1]) - 6);
  const v = Math.abs(Number(t));
  return 0.5 * Math.pow(10, -(v >= 1000 ? 2 : v >= 1 ? 4 : 6));
}
function near(s, ref, tol) {
  const v = shownNum(s);
  if (v === null || !isFinite(ref)) return false;
  return Math.abs(v - ref) <= (tol === undefined ? tolOf(s) : tol) * (1 + 1e-9) + 1e-12 * Math.abs(ref);
}
const fmt6 = (x) => (Math.abs(x) >= 1e12 || (x !== 0 && Math.abs(x) < 1e-4) ? x.toExponential(9) : String(Number(x.toPrecision(12))));
/** [[shown, reference, label?], …] → [ok, observed] */
function nears(list) {
  const bad = list.filter(([s, r]) => !near(s, r));
  return [bad.length === 0, bad.length ? bad.map(([s, r, l]) => (l ? l + ': ' : '') + 'page ' + s + ', reference ' + fmt6(r)).join('; ') : list.map(([s]) => s).join(', ') + ' hold'];
}
const all = (checks) => {
  const bad = checks.filter((c) => !c[0]);
  return [bad.length === 0, (bad.length ? bad : checks).map((c) => c[1]).join(' | ')];
};
const is = (ok, what) => [!!ok, what];
const exact = (fam, a, b, s) => {
  const f = refAff(fam, a, b);
  return is(f.b.q.isZero() && peq(f.a, P(s)), '1 ' + a + ' = ' + s + ' ' + b + (peq(f.a, P(s)) ? ' exactly' : ' is false: reference ' + pstr(f.a)));
};

/* ================================================================== */
/* the site: pages, HTML pieces, the engine                           */
/* ================================================================== */

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node', BR = 'browser';
  const ROOT = K.ROOT;
  const FAMS = ['length', 'mass', 'temperature', 'volume', 'area', 'time', 'speed', 'pressure', 'energy', 'power', 'data', 'angle'];
  const dec = (s) => String(s).replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
  const strip = (h) => dec(String(h).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fileOf = (url) => path.join(ROOT, url.replace(/^\/+/, ''), 'index.html');
  const htmlCache = new Map();
  const read = (url) => {
    if (!htmlCache.has(url)) htmlCache.set(url, fs.existsSync(fileOf(url)) ? fs.readFileSync(fileOf(url), 'utf8') : '');
    return htmlCache.get(url);
  };
  const isStub = (h) => /name="robots" content="noindex/.test(h) && /http-equiv="refresh"/.test(h);
  const MOUNT_RE = /MVRTool\.mountConverter\('([a-z]+)', UNITS\['([a-z]+)'\], convert,\s*document\.querySelector\('\.tool'\), \{from:'([^']+)', to:'([^']+)'\}\);/;
  const articleText = (h) => {
    const a = h.indexOf('<article'), z = h.indexOf('</article>');
    const part = a >= 0 && z > a ? h.slice(a, z) : h.slice(Math.max(0, h.indexOf('<main')), h.indexOf('</main>'));
    return strip(part.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' '));
  };

  /* every pair page on disk: fam → a → b → url; and url → [fam, a, b] */
  const INDEX = {}, BY_URL = {};
  const stubs = [];
  for (const fam of FAMS) {
    INDEX[fam] = {};
    const dir = path.join(ROOT, 'conversions', fam);
    if (!fs.existsSync(dir)) continue;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const url = '/conversions/' + fam + '/' + ent.name + '/';
      const h = read(url);
      if (!h) continue;
      if (isStub(h)) { stubs.push(url); continue; }
      const m = MOUNT_RE.exec(h);
      if (!m) { BY_URL[url] = [fam, null, null]; continue; }
      (INDEX[fam][m[3]] = INDEX[fam][m[3]] || {})[m[4]] = url;
      BY_URL[url] = [m[1], m[3], m[4]];
    }
  }
  const pairUrl = (fam, a, b) => (INDEX[fam][a] || {})[b] || null;
  const nPages = (fam) => Object.values(INDEX[fam]).reduce((n, o) => n + Object.keys(o).length, 0);
  const unitKeys = (fam) => Object.keys(REF[fam].u);

  let engine = null;
  const E = () => {
    if (engine) return engine;
    const box = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'engine', 'units.bundle.js'), 'utf8'), box, { filename: 'units.bundle.js' });
    engine = { UNITS: box.window.UNITS, convert: box.window.convert };
    return engine;
  };

  /* ---------- reading a pair page ---------- */
  function pairInfo(url) {
    const h = read(url);
    const I = { url, ok: false };
    const m = MOUNT_RE.exec(h);
    if (!m) return I;
    I.mountFam = m[1]; I.unitsFam = m[2]; I.fam = BY_URL[url][0]; I.a = m[3]; I.b = m[4];
    I.lede = dec((/<p class="lede">([\s\S]*?)<\/p>/.exec(h) || [])[1] || '');
    I.h1 = dec((/<h1>([\s\S]*?)<\/h1>/.exec(h) || [])[1] || '');
    I.unitsScript = h.indexOf('<script src="/engine/units.bundle.js" defer></script>') >= 0;
    const conv = (/<!-- CONV: generated by build-conversions\.js, do not edit -->([\s\S]*?)<!-- \/CONV -->/.exec(h) || [])[1];
    if (!conv) return I;
    const how = (/<section class="panel conv-how"[\s\S]*?<\/section>/.exec(conv) || [''])[0];
    I.h2 = dec((/<h2 id="conv-how-h">([^<]*)<\/h2>/.exec(how) || [])[1] || '');
    I.code = dec((/<p class="conv-formula"><code>([^<]*)<\/code><\/p>/.exec(how) || [])[1] || '');
    I.words = dec((/<\/code><\/p><p>([^<]*)<\/p>/.exec(how) || [])[1] || '');
    I.ex = dec((/<span class="example-result">([^<]*)<\/span>/.exec(how) || [])[1] || '');
    I.notes = [...how.matchAll(/<p class="conv-note">([^<]*)<\/p>/g)].map((x) => dec(x[1]));
    I.next = [...((/<p class="conv-next">([\s\S]*?)<\/p>/.exec(how) || [])[1] || '').matchAll(/<a( class="conv-rev")? href="([^"]+)">([^<]*)<\/a>/g)].map((x) => ({ rev: !!x[1], href: x[2], text: dec(x[3]) }));
    const tbl = (/<table class="conv-tbl[^"]*">([\s\S]*?)<\/table>/.exec(how) || [])[1] || '';
    I.caption = dec((/<caption>([^<]*)<\/caption>/.exec(tbl) || [])[1] || '');
    I.heads = [...tbl.matchAll(/<th scope="col">([^<]*)<\/th>/g)].map((x) => dec(x[1]));
    I.rows = [...tbl.matchAll(/<tr><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)].map((x) => [dec(x[1]), dec(x[2])]);
    I.extras = [...conv.matchAll(/<section class="panel conv-extra"[\s\S]*?<\/section>/g)].map((x) => {
      const s = x[0];
      return {
        heading: dec((/<h2 id="[^"]+">([^<]*)<\/h2>/.exec(s) || [])[1] || ''),
        note: dec((/<p class="conv-note">([^<]*)<\/p>/.exec(s) || [])[1] || ''),
        links: [...s.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)].map((y) => [y[1], dec(y[2])]),
        caption: dec((/<caption>([^<]*)<\/caption>/.exec(s) || [])[1] || ''),
        heads: [...s.matchAll(/<th scope="col">([^<]*)<\/th>/g)].map((y) => dec(y[1])),
        rows: [...s.matchAll(/<tr>((?:<td>[^<]*<\/td>)+)<\/tr>/g)].map((y) => [...y[1].matchAll(/<td>([^<]*)<\/td>/g)].map((z) => dec(z[1])))
      };
    });
    I.ok = !!(I.code && I.words && I.ex && I.rows.length);
    return I;
  }
  /** "12.7 cm" → "12.7" when the symbol is sym, else null */
  const valIn = (text, sym) => (text.endsWith(' ' + sym) ? text.slice(0, -sym.length - 1) : null);

  /* ---------- the formula as an affine map, from its own words ---------- */
  const SUPD = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
  function tokens(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === ' ') { i++; continue; }
      if (c === '\u0001') { out.push({ t: 'X' }); i++; continue; }
      if (c === 'π') { out.push({ t: 'n', v: P(1, 1) }); i++; continue; }
      const m = /^(\d[\d,]*(?:\.\d+)?)(?: × 10([⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+))?/.exec(src.slice(i));
      if (m) {
        let v = q(m[1]);
        if (m[2]) v = v.mul(q('1e' + m[2].split('').map((x) => SUPD[x]).join('')));
        out.push({ t: 'n', v: P(v), s: m[0] }); i += m[0].length; continue;
      }
      if ('×÷+−-/()'.indexOf(c) >= 0) { out.push({ t: c === '-' ? '−' : c }); i++; continue; }
      throw new Error('unexpected "' + src.slice(i, i + 8) + '"');
    }
    return out;
  }
  function affine(rhs, xSym) {
    const tk = tokens(rhs.split(xSym).join('\u0001'));
    let i = 0;
    const peek = () => tk[i] && tk[i].t;
    const C = (p) => ({ a: ZERO, b: p });
    const add = (x, y, s) => ({ a: padd(x.a, s ? { q: y.a.q.neg(), k: y.a.k } : y.a), b: padd(x.b, s ? { q: y.b.q.neg(), k: y.b.k } : y.b) });
    const scale = (x, p) => ({ a: x.a.q.isZero() ? ZERO : pmul(x.a, p), b: x.b.q.isZero() ? ZERO : pmul(x.b, p) });
    const mul = (x, y) => { if (x.a.q.isZero()) return scale(y, x.b); if (y.a.q.isZero()) return scale(x, y.b); throw new Error('X times X'); };
    const div = (x, y) => { if (!y.a.q.isZero()) throw new Error('divides by X'); return scale(x, { q: y.b.q.inv(), k: -y.b.k }); };
    function atom() {
      const t = tk[i++];
      if (!t) throw new Error('ends early');
      if (t.t === 'n') return C(t.v);
      if (t.t === 'X') return { a: P(1), b: ZERO };
      if (t.t === '−') return scale(atom(), P(-1));
      if (t.t === '(') { const e = expr(); if (peek() !== ')') throw new Error('no )'); i++; return e; }
      throw new Error('unexpected ' + t.t);
    }
    function factor() { let x = atom(); while (peek() === 'n' || peek() === 'X' || peek() === '(') x = mul(x, atom()); return x; }
    function term() {
      let x = factor();
      while (peek() === '×' || peek() === '÷' || peek() === '/') { const op = tk[i++].t; const y = factor(); x = op === '×' ? mul(x, y) : div(x, y); }
      return x;
    }
    function expr() {
      let x = term();
      while (peek() === '+' || peek() === '−') { const op = tk[i++].t; x = add(x, term(), op === '−'); }
      return x;
    }
    const e = expr();
    if (i !== tk.length) throw new Error('trailing ' + tk[i].t);
    return e;
  }
  const evalAff = (f, x) => x * pnum(f.a) + pnum(f.b);

  /* ================================================================== */
  /* the pair pages                                                     */
  /* ================================================================== */

  function formulaCheck(I) {
    const { fam, a, b } = I;
    const RA = REF[fam].u[a], RB = REF[fam].u[b];
    const errs = [], seen = [];
    const m = /^(.+?) (=|≈) (.+)$/.exec(I.code);
    if (!m) return [false, 'cannot read the formula "' + I.code + '"'];
    if (m[1] !== RB.sym) errs.push('left side is "' + m[1] + '", not ' + RB.sym);
    const approx = m[2] === '≈', rhs = m[3];
    let f;
    try { f = affine(rhs, RA.sym); } catch (e) { return [false, 'cannot read "' + rhs + '": ' + e.message]; }
    const ref = refAff(fam, a, b);
    const ex = allExact(fam, a, b);
    const W = I.words;
    if (!approx) {
      if (!peq(f.a, ref.a) || !peq(f.b, ref.b)) errs.push('the formula gives ' + pstr(f.a) + '·x + ' + pstr(f.b) + ', the reference ' + pstr(ref.a) + '·x + ' + pstr(ref.b));
      else seen.push(ex ? 'formula exact' : 'formula = the page’s stated convention');
    } else if (!REF[fam].affine) {
      const F = pnum(f.a), Rv = pnum(ref.a);
      const nstr = (/[×÷] (.+)$/.exec(rhs) || [])[1] || '';
      const mant = nstr.replace(/ × 10.*$/, '').replace(/,/g, '');
      const sig = (mant.indexOf('.') >= 0 ? mant.replace('.', '').replace(/^0+/, '') : mant.replace(/0+$/, '')).length;
      const tol = 0.5 * Math.pow(10, Math.floor(Math.log10(Math.abs(Rv))) - 9);
      if (!f.b.q.isZero() || f.a.k !== 0) errs.push('an approximate factor that is not a plain number');
      else if (sig > 10 || Math.abs(F - Rv) > tol * (1 + 1e-6)) errs.push('≈ ' + fmt6(F) + ' is not the reference ' + fmt6(Rv) + ' to 10 significant figures');
      else seen.push('≈ factor = reference to 10 s.f.');
      const needed = ref.a.k !== 0 || !(shortDec(ref.a.q, 11) || shortDec(ref.a.q.inv(), 11));
      if (!needed) errs.push('"≈" although the ratio is exactly ' + pstr(ref.a) + ', which can be written in full');
    } else {
      const F = pnum(f.a), Rv = pnum(ref.a), B0 = pnum(f.b), Rb = pnum(ref.b);
      if (Math.abs(F - Rv) > 1e-9 * Math.abs(Rv) || Math.abs(B0 - Rb) > 0.5e-4 * (1 + 1e-9)) errs.push('≈ form ' + fmt6(F) + '·x + ' + fmt6(B0) + ' vs reference ' + fmt6(Rv) + '·x + ' + fmt6(Rb));
      const needed = !(shortDp(ref.b.q, 6) || shortDp(ref.b.q.div(ref.a.q), 6));
      if (!needed) errs.push('"≈" although the offset can be written exactly');
      else seen.push('≈ offset to 4 dp, exact ones impossible');
    }
    /* the words */
    const h2 = /^How to convert (.+) to (.+)$/.exec(I.h2);
    if (!h2 || !RA.re.test(h2[1]) || !RB.re.test(h2[2])) errs.push('heading "' + I.h2 + '" does not name ' + RA.t + ' then ' + RB.t);
    if (REF[fam].affine) {
      const off = !ref.b.q.isZero();
      const saysOff = /offset/.test(W), saysRatio = /only a ratio|only the ratio applies|is a single multiplication|plain ratio/.test(W);
      if (off !== saysOff || off === saysRatio) errs.push((off ? 'the zero points differ' : 'the zero points agree') + ', but the words say "' + W.slice(0, 120) + '"');
      if (/\bexact/i.test(W) || /\babout\b/.test(W)) errs.push('temperature words claim exactness or "about"');
    } else if (/π/.test(rhs)) {
      const turn = REF.angle.u.turn.v;
      const piWords = /π radians is half a turn|a full turn being 2π radians|a full turn is 2π radians|full turn is 2π radians/i.test(W);
      if (!piWords || !peq(turn, P(2, 1))) errs.push('π sentence missing or false: "' + W + '"');
      if (/\bexact|\babout\b/.test(W)) errs.push('a π formula with exact/about wording');
      if (approx) errs.push('≈ with π');
    } else {
      const mm = /^\u0001? ?/.test(rhs) && /^(.+?) (×|÷) (.+)$/.exec(rhs);
      const n = mm ? mm[3] : '';
      if (!mm || mm[1] !== RA.sym) errs.push('formula is not "' + RA.sym + ' × n" or "' + RA.sym + ' ÷ n"');
      else {
        if (W.indexOf(n) < 0) errs.push('the words do not repeat the factor ' + n);
        if (mm[2] === '×' && !/multipl/i.test(W)) errs.push('× in the formula, no "multiply" in the words');
        if (mm[2] === '÷' && !/divide/i.test(W)) errs.push('÷ in the formula, no "divide" in the words');
        const wantAbout = approx || !ex;
        if ((W.indexOf('about ' + n) >= 0) !== wantAbout) errs.push(wantAbout ? 'the factor is not exact by definition but the words do not say "about"' : 'the words say "about" for a factor exact by definition');
        const wantExact = !approx && ex;
        if (/factor is exact/.test(W) !== wantExact) errs.push(wantExact ? 'exact by definition, but the words do not say so' : 'the words call the factor exact, but ' + (approx ? 'it is rounded' : 'a unit is not exact by definition'));
        if (approx) {
          if (W.indexOf('The factor is shown to 10 significant figures; the converter above uses the full value.') < 0) errs.push('≈ without the 10-significant-figure sentence');
          const got = E().convert(1, a, b, fam), rv = pnum(ref.a);
          if (Math.abs(got - rv) > 1e-12 * Math.abs(rv)) errs.push('the converter gives ' + got + ', not the full value ' + rv);
          else seen.push('the converter uses the full value');
        }
        /* direction of the sentence */
        const one = /One (.+?) is (?:about )?\S+(?: × 10\S+)? (.+?), so/.exec(W);
        if (one) {
          const [x, y] = mm[2] === '×' ? [RA, RB] : [RB, RA];
          if (!x.re.test(one[1]) || !y.re.test(one[2])) errs.push('"One ' + one[1] + ' is … ' + one[2] + '" runs the wrong way');
        }
        const every = /There are (?:about )?\S+(?: × 10\S+)? (.+?) in every (.+?), so/.exec(W);
        if (every && (!RA.re.test(every[1]) || !RB.re.test(every[2]))) errs.push('"There are … ' + every[1] + ' in every ' + every[2] + '" runs the wrong way');
        const each = /Each (.+?) is (?:about )?\S+(?: × 10\S+)? (.+?):/.exec(W);
        if (each && (!RA.re.test(each[1]) || !RB.re.test(each[2]))) errs.push('"Each …" runs the wrong way');
        const to = /To convert (.+?) to (.+?), /.exec(W);
        if (to && (!RA.re.test(to[1]) || !RB.re.test(to[2]))) errs.push('"To convert ' + to[1] + ' to ' + to[2] + '" names the wrong units');
      }
    }
    /* the reverse figure */
    const pre = 'In the other direction, 1 ' + RB.sym + ' = ', at = W.indexOf(pre);
    if (at < 0) errs.push('no "' + pre + '…"');
    else {
      const tail = W.slice(at + pre.length).replace(/\.$/, '');
      const y = valIn(tail, RA.sym);
      const rv = R(fam, 1, b, a);
      if (y === null || !near(y, rv)) errs.push('reverse: page ' + tail + ', reference ' + fmt6(rv) + ' ' + RA.sym);
      else seen.push('reverse 1 ' + RB.sym + ' = ' + y + ' ' + RA.sym);
    }
    return errs.length ? [false, errs.join('; ')] : [true, seen.join('; ')];
  }

  function exampleCheck(I) {
    const { fam, a, b } = I;
    const RA = REF[fam].u[a], RB = REF[fam].u[b];
    const at = Math.max(I.ex.lastIndexOf(' = '), I.ex.lastIndexOf(' ≈ '));
    if (at < 0) return [false, 'no "=" or "≈" in "' + I.ex + '"'];
    const sign = I.ex.substr(at + 1, 1), fsign = (/^.+? ([=≈]) /.exec(I.code) || [])[1];
    const left = I.ex.slice(0, at), y = valIn(I.ex.slice(at + 3), RB.sym);
    if (y === null) return [false, 'the result is not in ' + RB.sym];
    const xm = new RegExp('(-?[\\d,]*\\.?\\d+(?:e[+-]\\d+)?) ' + esc(RA.sym) + '(?![\\w²³])').exec(left);
    if (!xm) return [false, 'no value in ' + RA.sym + ' in "' + left + '"'];
    const rhs = (/^.+? [=≈] (.+)$/.exec(I.code) || [])[1];
    const asWritten = left.replace(xm[0], RA.sym);
    if (asWritten !== rhs) return [false, 'the example "' + left + '" is not the formula "' + rhs + '"'];
    const x = Number(clean(xm[1]));
    const ref = R(fam, x, a, b);
    const f = affine(rhs, RA.sym);
    const byPage = evalAff(f, x);
    /* "=" promises the sum as written gives the figure shown; "≈" (a factor
       rounded to 10 significant figures) only that it is that close */
    const asSum = sign === '=' ? near(y, byPage) : near(y, byPage, Math.max(tolOf(y), 1e-9 * Math.abs(byPage)));
    return all([
      is(sign === '≈' ? fsign === '≈' : true, 'the example says "' + sign + '", the formula "' + fsign + '"'),
      is(near(y, ref), xm[1] + ' ' + RA.sym + ' ' + sign + ' ' + y + ' ' + RB.sym + (near(y, ref) ? '' : ', reference ' + fmt6(ref))),
      is(asSum, 'the sum as written gives ' + fmt6(byPage))
    ]);
  }

  function tableCheck(I) {
    const { fam, a, b } = I;
    const RA = REF[fam].u[a], RB = REF[fam].u[b];
    const errs = [];
    const cap = /^(.+) to (.+)$/.exec(I.caption);
    if (!cap || !RA.re.test(cap[1]) || !RB.re.test(cap[2])) errs.push('caption "' + I.caption + '"');
    if (I.heads.length !== 2 || !I.heads[0].endsWith('(' + RA.sym + ')') || !I.heads[1].endsWith('(' + RB.sym + ')')) errs.push('headings ' + I.heads.join(' | '));
    if (I.rows.length < 12) errs.push('only ' + I.rows.length + ' rows');
    for (const [l, r] of I.rows) {
      const x = valIn(l, RA.sym), y = valIn(r, RB.sym);
      if (x === null || y === null) { errs.push('row ' + l + ' | ' + r + ': wrong unit'); continue; }
      const ref = R(fam, Number(clean(x)), a, b);
      if (!near(y, ref)) errs.push(l + ' = ' + r + ', reference ' + fmt6(ref));
    }
    return errs.length ? [false, errs.join('; ')] : [true, I.rows.length + ' rows hold, ' + I.rows[0].join(' = ') + ' … ' + I.rows[I.rows.length - 1].join(' = ')];
  }

  function ledeCheck(I) {
    const { fam, a, b } = I;
    const RA = REF[fam].u[a], RB = REF[fam].u[b];
    const errs = [];
    const m = /^Convert (.+) \(([^()]+)\) to (.+) \(([^()]+)\) instantly\. Works in both directions, with a full (.+) table\.$/.exec(I.lede);
    if (!m) errs.push('lede not read: "' + I.lede + '"');
    else {
      if (!RA.re.test(m[1]) || m[2] !== RA.sym) errs.push('from-unit "' + m[1] + ' (' + m[2] + ')" is not ' + RA.t + ' (' + RA.sym + ')');
      if (!RB.re.test(m[3]) || m[4] !== RB.sym) errs.push('to-unit "' + m[3] + ' (' + m[4] + ')" is not ' + RB.t + ' (' + RB.sym + ')');
      if (!REF[fam].noun.test(m[5])) errs.push('"' + m[5] + '" is not the ' + fam + ' family');
    }
    if (I.mountFam !== fam || I.unitsFam !== fam || !I.unitsScript) errs.push('the converter mounts ' + I.mountFam + '/' + I.unitsFam);
    const back = pairUrl(fam, b, a);
    if (!back) errs.push('no page for ' + b + ' → ' + a);
    const rev = I.next.find((x) => x.rev);
    if (!rev || rev.href !== back) errs.push('the "Also convert" reverse link is ' + (rev ? rev.href : 'missing'));
    for (const l of I.next) {
      const t = BY_URL[l.href];
      const lm = /^(.+) to (.+)$/.exec(l.text);
      if (!t || t[0] !== fam || !lm || !REF[fam].u[t[1]].re.test(lm[1]) || !REF[fam].u[t[2]].re.test(lm[2])) errs.push('link "' + l.text + '" → ' + l.href);
    }
    return errs.length ? [false, errs.join('; ')] : [true, RA.t + ' → ' + RB.t + ', reverse page ' + back + ', ' + I.next.length + ' links'];
  }

  /* the notes under a pair's formula, each against the reference */
  function noteCheck(fam, a, b, text) {
    const has = (k) => a === k || b === k;
    const U = REF[fam].u;
    let m;
    if ((m = /^A temperature difference converts with the ratio alone: a change of 10 (.+?) is a change of (\S+) (.+)\.$/.exec(text))) {
      const r = refAff(fam, a, b).a;
      return all([is(m[1] === U[a].sym && m[3] === U[b].sym, 'units ' + m[1] + ', ' + m[3]), is(pnum(r) > 0, 'ratio positive'), nears([[m[2], 10 * pnum(r), 'change']])]);
    }
    if (text === 'Cup, spoon, pint and fluid-ounce sizes here are the US customary ones; other countries’ measures differ slightly.') {
      /* differ "slightly": the other countries' measures named in COOK, against the US ones */
      const ml = q('1e-6');
      const others = [['imperial pint', GALUK.div(8), U.pt.v.q], ['imperial fluid ounce', GALUK.div(160), U.floz.v.q], ['metric cup', ml.mul(250), U.cup.v.q], ['metric tablespoon', ml.mul(15), U.tbsp.v.q], ['Australian tablespoon', ml.mul(20), U.tbsp.v.q], ['metric teaspoon', ml.mul(5), U.tsp.v.q]];
      const big = others.map(([n, o, us]) => [n, Math.abs(o.num() / us.num() - 1)]).filter(([, d]) => d > 0.1);
      return is(big.length === 0, big.length ? 'not slight: ' + big.map(([n, d]) => n + ' ' + (d * 100).toFixed(0) + '%').join(', ') : 'all within 10%');
    }
    if ((m = /^Cup, spoon, pint and fluid-ounce sizes here are the US customary ones; other countries’ measures differ: the imperial \(UK\) pint is (\S+) mL and the imperial fluid ounce (\S+) mL\.$/.exec(text))) {
      const us = ['tsp', 'tbsp', 'floz', 'cup', 'pt', 'qt'].every((k) => Math.abs(E().UNITS.volume.units[k].factor / pnum(U[k].v) - 1) < 1e-12);
      return all([is(us, 'the spoon, cup, pint and quart factors are the US customary ones (HB44)'), nears([[m[1], GALUK.div(8).num() * 1e6, 'imperial pint (WMA)'], [m[2], GALUK.div(160).num() * 1e6, 'imperial fl oz (WMA)']])]);
    }
    if ((m = /^An imperial gallon is (\S+) gal, so check which gallon a figure means\.$/.exec(text))) return nears([[m[1], R(fam, 1, 'galuk', 'gal')]]);
    if ((m = /^This is the imperial \(UK\) gallon, (\S+) L; the US gallon is smaller\.$/.exec(text))) return all([nears([[m[1], R(fam, 1, 'galuk', 'l')]]), is(GAL.num() < GALUK.num(), 'US gallon smaller')]);
    if ((m = /^This is the US gallon, (\S+) L; the imperial \(UK\) gallon is larger\.$/.exec(text))) return all([nears([[m[1], R(fam, 1, 'gal', 'l')]]), is(GALUK.num() > GAL.num(), 'imperial gallon larger')]);
    if ((m = /^(\w+) step in powers of (1,024|1,000) and (\w+) in powers of (1,024|1,000), so the factor is not a round number\.$/.exec(text))) {
      const base = (k) => (/iB$/.test(k) ? '1,024' : '1,000');
      const ratio = refAff(fam, a, b).a.q;
      let p10 = false;
      for (let e = -15; e <= 15; e++) if (ratio.eq(q('1e' + e))) p10 = true;
      return all([is(U[a].re.test(m[1]) && U[b].re.test(m[3]), 'names ' + m[1] + ', ' + m[3]), is(m[2] === base(a) && m[4] === base(b), 'bases ' + m[2] + ', ' + m[4]),
        is(!p10, 'ratio ' + ratio + (p10 ? ' is a power of ten' : ' is not a power of ten'))]);
    }
    if (text === 'A byte is 8 bits.') return is(peq(refAff(fam, 'B', 'bit').a, P(8)) && has('bit'), '1 B = 8 bit');
    if (text === 'A knot is one nautical mile (1,852 m) per hour.') return is(peq(U.knot.v, pdiv(REF.length.u.nmi.v, P(3600))) && REF.length.u.nmi.v.q.eq(1852), 'kn = 1852 m / 3600 s');
    if (text === 'Mach here is the speed of sound at sea level in standard conditions, 340.29 m/s. Sound is slower in colder air, so Mach figures at altitude are approximate.') {
      const eng = E().UNITS.speed.units.mach.factor;
      return all([is(eng === 340.29, 'the converter uses ' + eng + ' m/s'), is(Number(ISA_SL.toPrecision(5)) === 340.29, 'USSA sea level ' + ISA_SL.toFixed(3) + ' m/s = 340.29 to 5 s.f.'), is(ISA(216.65) < ISA_SL, 'at 11 km (216.65 K) ' + ISA(216.65).toFixed(2) + ' m/s')]);
    }
    if ((m = /^A stone is 14 pounds, (\S+) kg\.$/.exec(text))) return all([is(peq(U.st.v, P(LB.mul(14))), 'st = 14 lb'), nears([[m[1], R('mass', 1, 'st', 'kg')]])]);
    if (text === 'The US short ton is 2,000 lb, the UK long ton 2,240 lb and the metric tonne 1,000 kg.') return all([exact('mass', 'ton', 'lb', '2000'), exact('mass', 'lt', 'lb', '2240'), exact('mass', 't', 'kg', '1000')]);
    if (text === 'This is the avoirdupois ounce used for food, 1/16 of a pound; the troy ounce for precious metals is heavier.') {
      /* HB44: avoirdupois pound 7000 grains, troy ounce 480 grains */
      return all([exact('mass', 'lb', 'oz', '16'), is(480 > 7000 / 16, 'troy ounce 480 gr > avoirdupois ounce 437.5 gr')]);
    }
    if (text === 'The calorie here is the thermochemical calorie, 4.184 J; the Calories on food labels are kilocalories.') {
      const eng = E().UNITS.energy.units.cal.factor;
      return all([exact('energy', 'cal', 'J', '4.184'), is(eng === 4.184 && eng !== 4.1868, 'the converter’s calorie is ' + eng + ' J (thermochemical, not IT 4.1868)'), exact('energy', 'kcal', 'cal', '1000')]);
    }
    if ((m = /^This is the International Table BTU, (\S+) J\.$/.exec(text))) {
      const th = CAL_TH.mul(LB.mul(1000)).mul(5).div(9).num();   /* thermochemical BTU 1054.35 J */
      return all([nears([[m[1], BTU_IT.num(), 'IT BTU']]), is(!near(m[1], th), 'not the thermochemical BTU ' + th.toFixed(2))]);
    }
    if (text === 'An astronomical unit is exactly 149,597,870,700 m.') return exact('length', 'au', 'm', '149597870700');
    if (text === 'A light year is the distance light travels in a Julian year of 365.25 days.') return all([is(peq(U.ly.v, P(C_LIGHT.mul(JYR))), 'ly = c × 365.25 d'), is(E().UNITS.length.units.ly.factor === C_LIGHT.mul(JYR).num(), 'the converter’s light year is c × Julian year')]);
    if ((m = /^A parsec is (\S+) ly\.$/.exec(text))) return nears([[m[1], R('length', 1, 'pc', 'ly')]]);
    if (text === 'A nautical mile is exactly 1,852 m.') return exact('length', 'nmi', 'm', '1852');
    if ((m = /^Mechanical horsepower \((\S+) W\) and metric horsepower \(PS, (\S+) W\) are different units\.$/.exec(text))) return all([nears([[m[1], R('power', 1, 'hp', 'W')], [m[2], R('power', 1, 'hpM', 'W')]]), is(!peq(U.hp.v, U.hpM.v), 'different')]);
    if (text === 'The standard atmosphere is defined as exactly 101,325 Pa.') return exact('pressure', 'atm', 'Pa', '101325');
    if (text === 'A millibar is the same as a hectopascal (hPa).') return exact('pressure', 'mbar', 'Pa', '100');
    if (text === 'A torr is 1/760 of a standard atmosphere, almost exactly one millimetre of mercury.') {
      const d = Math.abs(U.torr.v.q.num() / MMHG.num() - 1);
      return all([is(U.torr.v.q.mul(760).eq(ATM), 'torr × 760 = atm'), is(d < 1e-6, 'torr vs conventional mmHg differ by ' + d.toExponential(2))]);
    }
    if (text === 'The month here is the average month of 30.4375 days and the year the Julian year of 365.25 days; calendar months and years vary.') return all([exact('time', 'mo', 'day', '30.4375'), exact('time', 'yr', 'day', '365.25')]);
    if (text === 'A full turn is 2π radians, or 360 degrees.') return all([is(peq(refAff('angle', 'turn', 'rad').a, P(2, 1)), 'turn = 2π rad'), exact('angle', 'turn', 'deg', '360')]);
    if (text === 'A gradian is 1/400 of a turn, so a right angle is 100 grad.') return all([exact('angle', 'turn', 'grad', '400'), exact('angle', 'deg', 'grad', q(100).div(90).toString())]);
    if (text === 'A hectare is 10,000 m²; an acre is 43,560 ft².') return all([exact('area', 'ha', 'm2', '10000'), exact('area', 'acre', 'ft2', '43560')]);
    return [false, 'no check written for this note'];
  }

  function tyreCheck(X) {
    const errs = [];
    const cap = /^Tyre pressures from (\d+) to (\d+) psi, with bar to 2 decimal places and kPa to the nearest whole number$/.exec(X.caption);
    if (!cap) errs.push('caption "' + X.caption + '"');
    if (X.heads.join('|') !== 'PSI (psi)|Bar (bar)|Kilopascal (kPa)') errs.push('headings ' + X.heads.join('|'));
    const vals = X.rows.map((r) => Number(valIn(r[0], 'psi')));
    if (cap && (vals[0] !== Number(cap[1]) || vals[vals.length - 1] !== Number(cap[2]) || vals.some((v, i) => i && v !== vals[i - 1] + 1))) errs.push('rows run ' + vals.join(','));
    for (const r of X.rows) {
      const p = Number(valIn(r[0], 'psi'));
      const bar = valIn(r[1], 'bar'), kpa = valIn(r[2], 'kPa');
      if (bar === null || !/^\d+\.\d\d$/.test(bar) || !near(bar, R('pressure', p, 'psi', 'bar'), 0.005)) errs.push(r.join(' ') + ': bar, reference ' + R('pressure', p, 'psi', 'bar').toFixed(5));
      if (kpa === null || !/^\d+$/.test(kpa) || !near(kpa, R('pressure', p, 'psi', 'kPa'), 0.5)) errs.push(r.join(' ') + ': kPa, reference ' + R('pressure', p, 'psi', 'kPa').toFixed(3));
    }
    return errs.length ? [false, errs.join('; ')] : [true, X.rows.length + ' rows, ' + X.rows[0].join(' = ') + ' … ' + X.rows[X.rows.length - 1].join(' = ')];
  }
  function tyreNoteCheck(text) {
    const m = /one standard atmosphere is (\S+) psi \((\S+) kPa\)/.exec(text);
    if (!m) return [false, 'no atmosphere figures'];
    return nears([[m[1], R('pressure', 1, 'atm', 'psi')], [m[2], R('pressure', 1, 'atm', 'kPa')]]);
  }

  /* register the pair pages */
  for (const fam of FAMS) {
    for (const a of Object.keys(INDEX[fam])) {
      for (const b of Object.keys(INDEX[fam][a])) {
        const url = INDEX[fam][a][b];
        const I = pairInfo(url);
        if (!REF[fam].u[a] || !REF[fam].u[b]) { claim(url, 'formula', 'Convert', 'the reference knows the units', N, async () => [false, 'no reference for ' + fam + ' ' + a + ' or ' + b]); continue; }
        if (!I.ok) { claim(url, 'formula', 'How to convert', 'the page has its formula block', N, async () => [false, 'no CONV block, formula, example or table']); continue; }
        claim(url, 'formula', I.code, 'formula, its wording and the reverse figure against the reference', N, async () => formulaCheck(I));
        claim(url, 'example', I.ex, 'worked example', N, async () => exampleCheck(I));
        claim(url, 'table', I.caption, 'every table row', N, async () => tableCheck(I));
        claim(url, 'lede', I.lede, 'the units named, both directions, the converter mounted', N, async () => ledeCheck(I));
        for (const nt of I.notes) claim(url, 'point', nt, 'note', N, async () => noteCheck(fam, a, b, nt));
        for (const X of I.extras) {
          claim(url, 'table', X.caption, 'tyre table: every cell at the decimals the caption promises', N, async () => tyreCheck(X));
          if (X.note) claim(url, 'point', X.note.slice(0, X.note.indexOf(', and the real figure')), 'tyre note: the standard atmosphere', N, async () => tyreNoteCheck(X.note));
          for (const [href, text] of X.links) claim(url, 'point', text, 'linked page is published', N, async () => { const h = read(href); return is(h && !isStub(h), href + (h ? (isStub(h) ? ' is a redirect stub' : ' exists') : ' missing')); });
        }
      }
    }
  }
  manual('/conversions/pressure/psi-to-bar/', 'point', 'These rows are conversions, not recommendations: use the pressures in your vehicle’s handbook or on the label in the door frame.', 'advice to the reader; nothing to compute');

  /* ================================================================== */
  /* the family hubs                                                    */
  /* ================================================================== */

  const HEAD = { length: 'Length', mass: 'Weight', temperature: 'Temperature', volume: 'Volume', area: 'Area', time: 'Time', speed: 'Speed', pressure: 'Pressure', energy: 'Energy', power: 'Power', data: 'Data storage', angle: 'Angle' };
  const hubUrl = (fam) => '/conversions/' + fam + '/';
  const island = (h) => { const m = /<script type="application\/json" class="conv-data">([\s\S]*?)<\/script>/.exec(h); return m ? JSON.parse(m[1]) : null; };
  const pairOf = (fam, s) => { /* "1 in = 2.54 cm" → [x, a, y, b] */
    const at = s.indexOf(' = ');
    if (at < 0) return null;
    const l = s.slice(0, at), r = s.slice(at + 3);
    const sp = (t) => { const i = t.indexOf(' '); return i < 0 ? null : [t.slice(0, i), t.slice(i + 1)]; };
    const L = sp(l), Rr = sp(r);
    if (!L || !Rr) return null;
    const k = (sym) => unitKeys(fam).find((x) => REF[fam].u[x].sym === sym);
    return [L[0], k(L[1]), Rr[0], k(Rr[1])];
  };
  function cardsCheck(h, famOf) {
    const cards = [...h.matchAll(/<a class="conv-card" href="([^"]+)"><span class="conv-card-t">([\s\S]*?)<\/span><span class="conv-card-v">([^<]*)<\/span><\/a>/g)];
    if (!cards.length) return [false, 'no cards'];
    const errs = [];
    for (const [, href, t, v] of cards) {
      const fam = famOf(href), s = dec(v);
      const p = pairOf(fam, s), at = BY_URL[href];
      const names = strip(t).replace(' → to ', ' to ').replace(/ → /, ' to ');
      const nm = /^(.+?) to (.+)$/.exec(names);
      if (!p || !p[1] || !p[3] || !at) { errs.push(s + ' → ' + href); continue; }
      if (at[1] !== p[1] || at[2] !== p[3]) errs.push(href + ' converts ' + at[1] + '→' + at[2] + ', the card says ' + s);
      if (!nm || !REF[fam].u[p[1]].re.test(nm[1]) || !REF[fam].u[p[3]].re.test(nm[2])) errs.push('card title "' + names + '"');
      if (p[0] !== '1' || !near(p[2], R(fam, 1, p[1], p[3]))) errs.push(s + ', reference ' + fmt6(R(fam, 1, p[1], p[3])));
    }
    return errs.length ? [false, errs.join('; ')] : [true, cards.length + ' cards hold'];
  }
  function pickerDataCheck(h, fams) {
    const d = island(h);
    if (!d) return [false, 'no picker data'];
    const errs = [];
    for (const fam of fams) {
      const f = d.f[fam];
      if (!f) { errs.push('no ' + fam); continue; }
      const keys = unitKeys(fam);
      if (f.o.length !== keys.length || keys.some((k) => !f.u[k])) errs.push(fam + ' units ' + f.o.join(','));
      for (const k of keys) {
        const x = f.u[k], U = REF[fam].u[k];
        if (!x) continue;
        if (x[1] !== U.sym) errs.push(k + ' symbol ' + x[1]);
        if (REF[fam].affine) {
          if (Math.abs(x[2] - U.a.num()) > 1e-12 * Math.abs(U.a.num()) || Math.abs(x[3] - U.b.num()) > 1e-12 * 400) errs.push(k + ' ' + x[2] + '·x + ' + x[3] + ' vs ' + U.a + ', ' + U.b);
        } else if (Math.abs(x[2] - pnum(U.v)) > 1e-12 * pnum(U.v) || x[3]) errs.push(k + ' factor ' + x[2] + ' vs ' + fmt6(pnum(U.v)));
        const href = '/conversions/' + fam + '/' + x[4] + '-to-';
        if (!Object.keys(BY_URL).some((uu) => uu.indexOf(href) === 0 && BY_URL[uu][1] === k)) errs.push(k + ' slug ' + x[4] + ' leads nowhere');
      }
    }
    return errs.length ? [false, errs.join('; ')] : [true, fams.length + ' famil' + (fams.length > 1 ? 'ies' : 'y') + ': every factor, offset and symbol = reference'];
  }
  function liveCheck(h, fam) {
    const m = /<p class="conv-live conv-result" aria-live="polite"><span class="conv-live-in">([^<]*)<\/span> <span class="conv-live-out">([^<]*)<\/span><\/p>/.exec(h);
    if (!m) return [false, 'no answer on load'];
    const s = dec(m[1]).replace(/ =$/, '') + ' = ' + dec(m[2]);
    const p = pairOf(fam, s);
    return is(p && p[1] && p[3] && near(p[2], R(fam, Number(p[0]), p[1], p[3])), 'on load: ' + s);
  }
  function quickCheck(h, fam) {
    const sec = (/<section class="panel conv-ref"[\s\S]*?<\/section>/.exec(h) || [''])[0];
    const rows = [...sec.matchAll(/<tr><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)].map((x) => [dec(x[1]), dec(x[2])]);
    if (!rows.length) return [false, 'no rows'];
    const errs = [];
    for (const [l, r] of rows) {
      const p = pairOf(fam, l + ' = ' + r);
      if (!p || !p[1] || !p[3]) { errs.push(l + ' | ' + r); continue; }
      const ref = R(fam, Number(clean(p[0])), p[1], p[3]);
      if (!near(p[2], ref)) errs.push(l + ' = ' + r + ', reference ' + fmt6(ref));
    }
    return errs.length ? [false, errs.join('; ')] : [true, rows.length + ' rows hold'];
  }
  function listCheck(h, fam) {
    const keys = unitKeys(fam), n = keys.length;
    const groups = [...h.matchAll(/<details class="conv-unit"[^>]*><summary><span class="conv-u">([^<]*)<\/span><span class="conv-sym">([^<]*)<\/span><span class="conv-n">(\d+)<\/span><\/summary><ul class="conv-links">([\s\S]*?)<\/ul><\/details>/g)];
    const errs = [];
    let total = 0;
    const seen = new Set();
    for (const [, title, sym, cnt, ul] of groups) {
      const k = keys.find((x) => REF[fam].u[x].sym === dec(sym));
      const links = [...ul.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)];
      if (!k || !REF[fam].u[k].re.test(dec(title))) { errs.push('group ' + dec(title)); continue; }
      if (Number(cnt) !== links.length || links.length !== n - 1) errs.push(dec(title) + ': ' + cnt + ' shown, ' + links.length + ' links');
      for (const [, href, text] of links) {
        const t = BY_URL[href];
        total++; seen.add(href);
        if (!t || t[1] !== k) errs.push(href + ' is not from ' + k);
        else if (!pairUrl(fam, t[2], t[1])) errs.push(href + ' has no reverse');
        const lm = /^(.+) to (.+)$/.exec(dec(text));
        if (t && (!lm || !REF[fam].u[t[1]].re.test(lm[1]) || !REF[fam].u[t[2]].re.test(lm[2]))) errs.push('"' + dec(text) + '"');
      }
    }
    if (groups.length !== n) errs.push(groups.length + ' groups for ' + n + ' units');
    if (seen.size !== n * (n - 1)) errs.push(seen.size + ' distinct pairs, not ' + n * (n - 1));
    return errs.length ? [false, errs.slice(0, 8).join('; ')] : [true, n + ' groups by from-unit, ' + total + ' links, every pair with its reverse'];
  }

  const RELATED_KW = {
    '/utilities/square-footage/': ['L-shaped', 'cost'], '/mathematics/geometry-calculator/': ['perimeter', 'volume', 'cylinder'],
    '/design/aspect-ratio/': ['ratio'], '/utilities/shoe-size-converter/': ['Japan', 'EU', 'cm'], '/health/bmi/': ['height', 'weight'],
    '/health/ideal-weight/': ['height'], '/utilities/cooking-converter/': ['cup', 'gram', 'ounce', 'spoon'], '/health/bmr-tdee/': ['activity', 'kcal'],
    '/mathematics/scientific-calculator/': ['sin', 'π'], '/utilities/fuel-efficiency/': ['MPG', 'L/100', 'cost'], '/health/water-intake/': ['water'],
    '/time/date-difference/': ['days', 'weeks', 'months'], '/time/date-add-subtract/': ['add', 'subtract'], '/time/timezone-converter/': ['time zone'],
    '/time/stopwatch-timer/': ['Stopwatch', 'countdown', 'Pomodoro'], '/engineering/ohms-law/': ['voltage', 'current', 'resistance', 'power'],
    '/image/image-compressor/': ['JPEG', 'PNG', 'WebP'], '/image/bulk-image-resizer/': ['resize'], '/mathematics/number-base-converter/': ['binary', 'octal', 'decimal', 'hexadecimal'],
    '/engineering/gauge-absolute-pressure/': ['psig', 'psia', 'barg', 'bara'], '/guides/convert-pressure-units/': ['psi', 'bar', 'kPa', 'mbar', 'atm', 'mmHg']
  };

  /* the scientific calculator is linked with different words from different hubs */
  const KW_BY_TEXT = {
    'Work through a formula step by step': ['step by step'],
    'Work out a formula with powers, roots and constants': ['powers', 'roots', 'constants'],
    'Distance, time and speed sums': ['expression'],
    'Powers, roots and constants for pressure sums': ['powers', 'roots', 'constants'],
    'Powers, roots and constants': ['powers', 'roots', 'constants'],
    'Trigonometry in degrees or radians': ['trigonometr', 'degrees', 'radians']
  };
  for (const fam of FAMS) {
    const H = hubUrl(fam);
    const h = read(H);
    const keys = unitKeys(fam), n = keys.length;
    claim(H, 'lede', n * (n - 1) + ' converters across ' + n + ' units. Every pair works in both directions.', 'pair pages on disk, each with its reverse', N, async () => {
      const missing = [];
      for (const a of keys) for (const b of keys) if (a !== b && !pairUrl(fam, a, b)) missing.push(a + '→' + b);
      const extra = Object.keys(INDEX[fam]).filter((k) => !REF[fam].u[k]);
      return is(!missing.length && !extra.length && nPages(fam) === n * (n - 1), nPages(fam) + ' pages' + (missing.length ? '; missing ' + missing.join(', ') : '') + (extra.length ? '; units the reference lacks: ' + extra.join(',') : ''));
    });
    claim(H, 'ui', HEAD[fam] + ' converter', 'the picker’s unit data and its answer on load', N, async () => all([pickerDataCheck(h, [fam]), liveCheck(h, fam)]));
    claim(H, 'hub', 'Popular ' + HEAD[fam].toLowerCase() + ' conversions', 'every popular card', N, async () => cardsCheck(h, () => fam));
    claim(H, 'table', (/<h2 id="conv-ref-h">([^<]*)<\/h2>/.exec(h) || [, 'Quick reference'])[1] && dec((/<h2 id="conv-ref-h">([^<]*)<\/h2>/.exec(h) || [, 'Quick reference'])[1]), 'quick reference rows', N, async () => quickCheck(h, fam));
    claim(H, 'hub', 'All ' + (n * (n - 1)).toLocaleString('en-GB') + ' ' + HEAD[fam].toLowerCase() + ' conversions', 'the full list: grouped by from-unit, every pair, both directions', N, async () => listCheck(h, fam));
    claim(H, 'hub', 'Grouped by the unit you are converting from. Every pair works in both directions.', 'groups by from-unit; reverses', N, async () => listCheck(h, fam));
    /* the engine's own factors, unit by unit, against the reference */
    const EU = () => E().UNITS[fam] && E().UNITS[fam].units;
    for (const k of keys) {
      const U = REF[fam].u[k];
      claim(H, 'hub', U.t + ' (' + U.sym + ')', 'engine factor for ' + k + ' = ' + U.src, N, async () => {
        const e = EU() && EU()[k];
        if (!e) return [false, 'the engine has no ' + fam + ' unit ' + k];
        if (e.symbol !== U.sym) return [false, 'symbol ' + e.symbol + ', reference ' + U.sym];
        if (REF[fam].affine) {
          const okA = Math.abs(e.factor - U.a.num()) <= 1e-12 * Math.abs(U.a.num()), okB = Math.abs((e.offset || 0) - U.b.num()) <= 1e-12 * 400;
          return is(okA && okB, 'T/K = ' + e.factor + '·x + ' + (e.offset || 0) + '; reference ' + U.a + '·x + ' + U.b + ' (' + fmt6(U.b.num()) + ')');
        }
        const rv = pnum(U.v);
        const rel = Math.abs(e.factor / rv - 1);
        if (U.ex) return is(rel <= 1e-12, e.factor + ' vs reference ' + pstr(U.v) + ' = ' + fmt6(rv) + ' (exact by definition; off by ' + rel.toExponential(1) + ')');
        /* Mach: the page's stated 340.29 m/s, and that is USSA's 340.294 to the 5 figures given */
        return is(rel <= 1e-12 && Number(ISA_SL.toPrecision(5)) === e.factor, e.factor + ' = the page’s 340.29 m/s; USSA sea level ' + ISA_SL.toFixed(3) + ' m/s');
      });
    }
    claim(H, 'hub', 'About ' + (fam === 'mass' ? 'weight' : fam === 'data' ? 'data storage' : fam) + ' units', 'the reference itself agrees with NIST SP 811 / HB44 to their printed digits', N, async () => {
      const bad = [];
      for (const [k, s] of Object.entries(NIST[fam])) {
        const ref = pnum(REF[fam].u[k].v), want = Number(s);
        const digits = clean(s).replace(/e.*$/, '').replace(/[^\d]/g, '').replace(/^0+/, '').length;
        const ulp = Math.pow(10, Math.floor(Math.log10(want)) - digits + 1);
        if (Math.abs(ref - want) > 0.5 * ulp * (1 + 1e-9)) bad.push(k + ' ' + fmt6(ref) + ' vs ' + s);
      }
      if (fam === 'temperature') {
        const T = REF.temperature.u;
        if (!T.F.b.eq(q('273.15').sub(q(32).mul(5).div(9))) || !T.R.a.eq(T.F.a)) bad.push('Fahrenheit/Rankine');
      }
      return is(!bad.length, bad.length ? bad.join('; ') : Object.keys(NIST[fam]).length + ' values agree');
    });
    /* related tools and guides */
    for (const [href, kw] of Object.entries(RELATED_KW)) {
      const m = new RegExp('<li><a href="' + esc(href) + '">([^<]*)</a><span>([^<]*)</span></li>').exec(h);
      if (!m) continue;
      claim(H, 'hub', dec(m[2]), 'the linked page exists and does this', N, async () => {
        const t = read(href);
        if (!t || isStub(t)) return [false, href + ' is not a published page'];
        const txt = articleText(t);
        const kw2 = KW_BY_TEXT[dec(m[2])] || kw;
        const miss = kw2.filter((w) => txt.toLowerCase().indexOf(w.toLowerCase()) < 0);
        return is(!miss.length, href + (miss.length ? ' never mentions ' + miss.join(', ') : ' mentions ' + kw2.join(', ')));
      });
    }
  }

  /* ---------- About and FAQ: every figure and statement ---------- */
  const L = '/conversions/length/', M = '/conversions/mass/', T = '/conversions/temperature/', V = '/conversions/volume/',
    A = '/conversions/area/', TI = '/conversions/time/', S = '/conversions/speed/', PR = '/conversions/pressure/',
    EN = '/conversions/energy/', PO = '/conversions/power/', DA = '/conversions/data/', AN = '/conversions/angle/';
  const f = (page, where, quote, name, fn) => claim(page, where, quote, name, N, async () => fn());
  const r = R;

  /* length */
  f(L, 'what', 'The SI unit is the metre (m), defined since 1983 by the distance light travels in a vacuum in 1/299,792,458 of a second.', 'c in the definition (SI §2.3.1; 17th CGPM 1983)', () => all([is(C_LIGHT.eq(q('299792458')), 'c = 299 792 458 m/s'), exact('length', 'm', 'm', '1')]));
  f(L, 'what', 'Metric units step by powers of ten: a kilometre is 1,000 m, and a metre is 100 cm or 1,000 mm.', 'km, cm, mm', () => all([exact('length', 'km', 'm', '1000'), exact('length', 'm', 'cm', '100'), exact('length', 'm', 'mm', '1000')]));
  f(L, 'what', 'the international inch is exactly 2.54 cm, so a foot (12 in) is exactly 0.3048 m, a yard (3 ft) is 0.9144 m and a mile (1,760 yd) is 1,609.344 m.', '1959 inch, foot, yard, mile', () => all([exact('length', 'in', 'cm', '2.54'), exact('length', 'ft', 'in', '12'), exact('length', 'ft', 'm', '0.3048'), exact('length', 'yd', 'ft', '3'), exact('length', 'yd', 'm', '0.9144'), exact('length', 'mi', 'yd', '1760'), exact('length', 'mi', 'm', '1609.344')]));
  f(L, 'what', 'The nautical mile, exactly 1,852 m, is used at sea and in the air', 'nautical mile', () => exact('length', 'nmi', 'm', '1852'));
  manual(L, 'what', 'The UK still signs roads in miles and often gives heights in feet and inches; most of the world uses metric units for everything.', 'a statement about usage, not a figure');
  f(L, 'faq', 'One inch is exactly 2.54 cm. The international inch has been defined as 2.54 cm since 1959, so this conversion is exact.', 'inch', () => exact('length', 'in', 'cm', '2.54'));
  f(L, 'faq', 'One metre is 3.2808 ft, or 3 ft 3.3701 in. Going the other way, a foot is exactly 0.3048 m.', 'metre in feet and inches', () => all([nears([['3.2808', r('length', 1, 'm', 'ft')], ['3.3701', r('length', 1, 'm', 'in') - 36]]), is(Math.floor(r('length', 1, 'm', 'ft')) === 3, '3 whole feet'), exact('length', 'ft', 'm', '0.3048')]));
  f(L, 'faq', 'Multiply by 1.609344, the exact number of kilometres in a mile. 10 miles is 16.0934 km, and 100 km is 62.1371 mi.', 'miles to km', () => all([exact('length', 'mi', 'km', '1.609344'), nears([['16.0934', r('length', 10, 'mi', 'km')], ['62.1371', r('length', 100, 'km', 'mi')]])]));
  f(L, 'faq', '177.8 cm: 5 ft is 152.4 cm and 10 in is 25.4 cm. For any height, multiply the feet by 30.48 and the inches by 2.54, then add them.', '5 ft 10 in', () => all([nears([['177.8', r('length', 5, 'ft', 'cm') + r('length', 10, 'in', 'cm')], ['152.4', r('length', 5, 'ft', 'cm')], ['25.4', r('length', 10, 'in', 'cm')]]), exact('length', 'ft', 'cm', '30.48'), exact('length', 'in', 'cm', '2.54')]));
  f(L, 'faq', 'Exactly 25.4 mm. A millimetre is 0.03937 in.', 'inch in mm', () => all([exact('length', 'in', 'mm', '25.4'), nears([['0.03937', r('length', 1, 'mm', 'in')]])]));

  /* mass */
  f(M, 'what', 'a gram is a thousandth of a kilogram and a tonne is 1,000 kg.', 'gram, tonne', () => all([exact('mass', 'kg', 'g', '1000'), exact('mass', 't', 'kg', '1000')]));
  f(M, 'what', 'The avoirdupois pound used in the UK and the US is defined as exactly 0.45359237 kg and is divided into 16 ounces, so an ounce is about 28.35 g.', 'pound and ounce', () => all([exact('mass', 'lb', 'kg', '0.45359237'), exact('mass', 'lb', 'oz', '16'), is(r('mass', 1, 'oz', 'g').toFixed(2) === '28.35', 'oz = ' + r('mass', 1, 'oz', 'g') + ' g')]));
  f(M, 'what', 'a stone is 14 lb, about 6.35 kg.', 'stone', () => all([exact('mass', 'st', 'lb', '14'), is(r('mass', 1, 'st', 'kg').toFixed(2) === '6.35', 'st = ' + r('mass', 1, 'st', 'kg') + ' kg')]));
  f(M, 'what', 'the US short ton of 2,000 lb and the UK long ton of 2,240 lb', 'short and long ton', () => all([exact('mass', 'ton', 'lb', '2000'), exact('mass', 'lt', 'lb', '2240')]));
  f(M, 'faq', 'One kilogram is 2.2046 lb. A pound is 0.453592 kg, exactly 0.45359237 kg by definition.', 'kg and lb', () => all([nears([['2.2046', r('mass', 1, 'kg', 'lb')], ['0.453592', r('mass', 1, 'lb', 'kg')]]), exact('mass', 'lb', 'kg', '0.45359237')]));
  f(M, 'faq', 'A stone is 14 lb, which is 6.3503 kg. So 10 stone is 63.5029 kg.', 'stone in kg', () => all([exact('mass', 'st', 'lb', '14'), nears([['6.3503', r('mass', 1, 'st', 'kg')], ['63.5029', r('mass', 10, 'st', 'kg')]])]));
  f(M, 'faq', 'An ounce, the avoirdupois ounce used for food, is 28.3495 g, and there are 16 in a pound. 100 g is 3.5274 oz. Precious metals use the heavier troy ounce, which is not this one.', 'ounce; troy is heavier (HB44: 480 gr vs 437.5 gr)', () => all([nears([['28.3495', r('mass', 1, 'oz', 'g')], ['3.5274', r('mass', 100, 'g', 'oz')]]), exact('mass', 'lb', 'oz', '16'), is(480 > 7000 / 16, 'troy ounce 480 gr > 437.5 gr')]));
  f(M, 'faq', 'Convert to pounds, then take 14 lb out for every stone. 70 kg is 154.3236 lb, which is 11 st 0.323584 lb.', '70 kg in stones and pounds', () => { const lb = r('mass', 70, 'kg', 'lb'); return all([nears([['154.3236', lb], ['0.323584', lb - 14 * 11]]), is(Math.floor(lb / 14) === 11, '11 whole stone')]); });
  f(M, 'faq', 'It depends on the ton. A US short ton is 2,000 lb, a UK long ton is 2,240 lb, and a metric tonne of 1,000 kg is 2,204.62 lb.', 'three tons', () => all([exact('mass', 'ton', 'lb', '2000'), exact('mass', 'lt', 'lb', '2240'), nears([['2,204.62', r('mass', 1, 't', 'lb')]])]));

  /* temperature */
  const TU = REF.temperature.u;
  f(T, 'what', 'The Celsius scale uses degrees of the same size but starts 273.15 lower, so 0 °C is 273.15 K.', 'Celsius and kelvin', () => all([is(TU.C.a.eq(1) && TU.C.b.eq(q('273.15')), 'T/K = t/°C + 273.15'), nears([['273.15', r('temperature', 0, 'C', 'K')]])]));
  f(T, 'what', 'Water freezes at 0 °C and boils at about 100 °C at sea level. The Fahrenheit scale, still used for weather and cooking in the US, puts those points at 32 °F and 212 °F, so 180 Fahrenheit degrees span the same range as 100 Celsius degrees, which is where the factor 9/5 comes from.', 'Fahrenheit points and 9/5', () => { const fcf = refAff('temperature', 'C', 'F'); return all([nears([['32', r('temperature', 0, 'C', 'F')], ['212', r('temperature', 100, 'C', 'F')]]), is(peq(fcf.a, P('9/5')), 'ratio ' + pstr(fcf.a)), is(q(212 - 32).div(100).eq(q('9/5')), '180/100 = 9/5')]); });
  f(T, 'what', 'Because the scales have different zero points, converting a temperature needs an offset as well as a ratio, while converting a temperature difference needs only the ratio.', 'difference = ratio × difference, every pair', () => {
    const bad = [];
    for (const a of Object.keys(TU)) for (const b of Object.keys(TU)) { if (a === b) continue; const d = r('temperature', 50, a, b) - r('temperature', 40, a, b), want = 10 * pnum(refAff('temperature', a, b).a); if (Math.abs(d - want) > 1e-9) bad.push(a + '→' + b); }
    return is(!bad.length && !refAff('temperature', 'C', 'F').b.q.isZero(), bad.length ? bad.join(',') : 'every pair: a difference of 10 converts by the ratio alone; °C→°F has an offset');
  });
  f(T, 'what', 'Rankine is the absolute form of Fahrenheit', 'Rankine: zero at 0 K, Fahrenheit-sized degrees', () => all([is(TU.R.b.isZero() && TU.R.a.eq(TU.F.a), '°R zero at 0 K, degree 5/9 K'), nears([['459.67', r('temperature', 0, 'F', 'R')]])]));
  f(T, 'faq', 'Multiply by 9/5 (1.8) and add 32. 20 °C is 68 °F, and 37 °C is 98.6 °F.', 'C to F', () => { const x = refAff('temperature', 'C', 'F'); return all([is(peq(x.a, P('9/5')) && peq(x.b, P(32)) && q('9/5').eq(q('1.8')), '×9/5 + 32'), nears([['68', r('temperature', 20, 'C', 'F')], ['98.6', r('temperature', 37, 'C', 'F')]])]); });
  f(T, 'faq', 'Take away 32, then multiply by 5/9. 100 °F is 37.7778 °C, and 350 °F, a common oven setting, is 176.6667 °C.', 'F to C', () => { const x = refAff('temperature', 'F', 'C'); return all([is(peq(x.a, P('5/9')) && peq(x.b, P(q(-32).mul(q('5/9')))), '(x − 32) × 5/9'), nears([['37.7778', r('temperature', 100, 'F', 'C')], ['176.6667', r('temperature', 350, 'F', 'C')]])]); });
  manual(T, 'faq', '350 °F, a common oven setting', 'a statement about cooking practice');
  f(T, 'faq', 'At minus 40: -40 °C is -40 °F. It is the only point where the two scales meet.', 'the crossing point', () => { const x = refAff('temperature', 'C', 'F'); const cross = x.b.q.div(q(1).sub(x.a.q)); return is(cross.eq(-40) && !x.a.q.eq(1), 'x = 9/5·x + 32 only at x = ' + cross); });
  f(T, 'faq', 'Add 273.15. 0 °C is 273.15 K and 25 °C is 298.15 K. Absolute zero, 0 K, is -273.15 °C.', 'C to K', () => all([is(peq(refAff('temperature', 'C', 'K').b, P('273.15')), '+273.15'), nears([['273.15', r('temperature', 0, 'C', 'K')], ['298.15', r('temperature', 25, 'C', 'K')], ['-273.15', r('temperature', 0, 'K', 'C')]])]));
  f(T, 'faq', 'The usual figure, 37 °C, is 98.6 °F. A fever is generally taken to start at 38 °C, which is 100.4 °F.', 'body temperature', () => nears([['98.6', r('temperature', 37, 'C', 'F')], ['100.4', r('temperature', 38, 'C', 'F')]]));
  manual(T, 'faq', 'A fever is generally taken to start at 38 °C', 'a medical convention, not a conversion');

  /* volume */
  const VU = REF.volume.u;
  f(V, 'what', 'a litre is 1,000 mL and a cubic metre is 1,000 L.', 'litre, cubic metre', () => all([exact('volume', 'l', 'ml', '1000'), exact('volume', 'm3', 'l', '1000')]));
  f(V, 'what', '3 teaspoons make a tablespoon, 2 tablespoons a fluid ounce, 8 fluid ounces a cup, 2 cups a pint, 2 pints a quart and 4 quarts a gallon of 231 cubic inches, exactly 3.785411784 L.', 'the US customary ladder (HB44)', () => all([exact('volume', 'tbsp', 'tsp', '3'), exact('volume', 'floz', 'tbsp', '2'), exact('volume', 'cup', 'floz', '8'), exact('volume', 'pt', 'cup', '2'), exact('volume', 'qt', 'pt', '2'), exact('volume', 'gal', 'qt', '4'), is(VU.gal.v.q.eq(IN.pow(3).mul(231)), 'gal = 231 in³'), exact('volume', 'gal', 'l', '3.785411784')]));
  f(V, 'what', 'The imperial gallon used in the UK is bigger, exactly 4.54609 L', 'imperial gallon (WMA)', () => all([exact('volume', 'galuk', 'l', '4.54609'), is(GALUK.num() > GAL.num(), 'bigger')]));
  f(V, 'what', 'The cup and spoon measures here are the US ones; recipes from other countries may use different sizes, such as the 250 mL metric cup or the 20 mL Australian tablespoon.', 'US cup and spoons; the metric cup and Australian tablespoon (COOK) differ', () => {
    const us = ['tsp', 'tbsp', 'cup'].every((k) => Math.abs(E().UNITS.volume.units[k].factor / pnum(VU[k].v) - 1) < 1e-12);
    return all([is(us, 'the converter’s cup and spoons are US customary'), is(Math.abs(250 / r('volume', 1, 'cup', 'ml') - 1) > 0.05 && Math.abs(20 / r('volume', 1, 'tbsp', 'ml') - 1) > 0.3, 'metric cup 250 mL vs ' + r('volume', 1, 'cup', 'ml').toFixed(2) + '; AU tbsp 20 mL vs ' + r('volume', 1, 'tbsp', 'ml').toFixed(2))]);
  });
  f(V, 'faq', 'A US cup is 236.5882 mL, which is 8 US fluid ounces or 16 tablespoons. Recipes from Australia, New Zealand and Canada often use a 250 mL metric cup instead.', 'US cup; metric cup 250 mL (COOK)', () => all([nears([['236.5882', r('volume', 1, 'cup', 'ml')]]), exact('volume', 'cup', 'floz', '8'), exact('volume', 'cup', 'tbsp', '16'), is(Math.abs(250 - r('volume', 1, 'cup', 'ml')) > 10, 'a 250 mL cup is not the US cup')]));
  f(V, 'faq', 'A US gallon is 3.7854 L and an imperial (UK) gallon is 4.5461 L. An imperial gallon is 1.2009 gal.', 'gallons', () => nears([['3.7854', r('volume', 1, 'gal', 'l')], ['4.5461', r('volume', 1, 'galuk', 'l')], ['1.2009', r('volume', 1, 'galuk', 'gal')]]));
  f(V, 'faq', 'A US fluid ounce is 29.5735 mL, so 100 mL is 3.3814 fl oz. The UK fluid ounce is slightly smaller.', 'fluid ounces; UK fl oz = 1/160 imperial gallon (WMA)', () => { const uk = GALUK.div(160).num() * 1e6, us = r('volume', 1, 'floz', 'ml'); return all([nears([['29.5735', us], ['3.3814', r('volume', 100, 'ml', 'floz')]]), is(uk < us && us / uk - 1 < 0.05, 'UK ' + uk.toFixed(4) + ' mL, ' + ((1 - uk / us) * 100).toFixed(1) + '% smaller')]); });
  f(V, 'faq', '16 US tablespoons. A tablespoon is 3 teaspoons, so a cup is also 48 teaspoons.', 'cup in spoons', () => all([exact('volume', 'cup', 'tbsp', '16'), exact('volume', 'tbsp', 'tsp', '3'), exact('volume', 'cup', 'tsp', '48')]));
  f(V, 'faq', '1,000 litres. A litre is a cubic decimetre, a cube 10 cm on each side.', 'litre = dm³', () => all([exact('volume', 'm3', 'l', '1000'), is(VU.l.v.q.eq(q('0.1').pow(3)), '(0.1 m)³ = 1 L')]));

  /* area */
  f(A, 'what', 'a metre is 100 cm, so a square metre is 10,000 cm², and a foot is 0.3048 m, so a square foot is 0.09290304 m².', 'squares of length factors', () => all([exact('area', 'm2', 'cm2', '10000'), exact('area', 'ft2', 'm2', '0.09290304'), is(q('0.3048').pow(2).eq(q('0.09290304')), '0.3048² = 0.09290304')]));
  f(A, 'what', 'A hectare is 10,000 m², a square 100 m on each side; an acre is 43,560 square feet, about 4,047 m² or 0.405 ha.', 'hectare and acre', () => all([exact('area', 'ha', 'm2', '10000'), exact('area', 'acre', 'ft2', '43560'), is(Math.round(r('area', 1, 'acre', 'm2')) === 4047 && r('area', 1, 'acre', 'ha').toFixed(3) === '0.405', 'acre = ' + r('area', 1, 'acre', 'm2') + ' m²')]));
  f(A, 'what', 'a square mile is exactly 640 acres, about 2.59 km².', 'square mile', () => all([exact('area', 'mi2', 'acre', '640'), is(r('area', 1, 'mi2', 'km2').toFixed(2) === '2.59', 'mi² = ' + r('area', 1, 'mi2', 'km2') + ' km²')]));
  manual(A, 'what', 'Land is measured in hectares in most of the world and in acres in the UK and the US.', 'a statement about usage');
  f(A, 'faq', 'One square metre is 10.7639 ft². A metre is 3.2808 ft, and a square metre is that length squared.', 'm² in ft²', () => all([nears([['10.7639', r('area', 1, 'm2', 'ft2')], ['3.2808', r('length', 1, 'm', 'ft')]]), is(refAff('area', 'm2', 'ft2').a.q.eq(refAff('length', 'm', 'ft').a.q.pow(2)), 'm²/ft² = (m/ft)²')]));
  f(A, 'faq', 'One hectare is 2.4711 ac, and one acre is 0.404686 ha.', 'ha and acre', () => nears([['2.4711', r('area', 1, 'ha', 'acre')], ['0.404686', r('area', 1, 'acre', 'ha')]]));
  f(A, 'faq', 'Exactly 43,560 ft². In metric units an acre is 4,046.86 m².', 'acre', () => all([exact('area', 'acre', 'ft2', '43560'), nears([['4,046.86', r('area', 1, 'acre', 'm2')]])]));
  f(A, 'faq', 'Multiply by 0.09290304, which is exact, or divide by about 10.764. A 200 sq ft room is 18.5806 m².', 'ft² to m²', () => all([exact('area', 'ft2', 'm2', '0.09290304'), is(r('area', 1, 'm2', 'ft2').toFixed(3) === '10.764', '1/0.09290304 = ' + r('area', 1, 'm2', 'ft2')), nears([['18.5806', r('area', 200, 'ft2', 'm2')]])]));
  f(A, 'faq', 'One square mile is 2.59 km². It is also exactly 640 ac.', 'square mile', () => all([nears([['2.59', r('area', 1, 'mi2', 'km2')]]), exact('area', 'mi2', 'acre', '640')]));

  /* time */
  f(TI, 'what', 'defined by a fixed number of oscillations of the caesium-133 atom: 9,192,631,770 of them make one second.', 'ΔνCs (SI §2.3.1)', () => is(9192631770 === 9192631770 && exact('time', 's', 's', '1')[0], 'SI: ΔνCs = 9 192 631 770 Hz'));
  f(TI, 'what', '60 seconds make a minute, 60 minutes an hour and 24 hours a day, so a day is 86,400 seconds and a week is 604,800.', 'minute, hour, day, week', () => all([exact('time', 'min', 's', '60'), exact('time', 'h', 'min', '60'), exact('time', 'day', 'h', '24'), exact('time', 'day', 's', '86400'), exact('time', 'week', 's', '604800')]));
  f(TI, 'what', 'The year here is the Julian year of 365.25 days, the average over a four-year leap cycle and the year astronomers use; the month is one twelfth of it, 30.4375 days.', 'Julian year and average month', () => all([exact('time', 'yr', 'day', '365.25'), is(q(365 * 3 + 366).div(4).eq(q('365.25')), '(3 × 365 + 366)/4 = 365.25'), exact('time', 'yr', 'mo', '12'), exact('time', 'mo', 'day', '30.4375')]));
  f(TI, 'what', 'A millisecond is a thousandth of a second', 'millisecond', () => exact('time', 's', 'ms', '1000'));
  f(TI, 'faq', '86,400 seconds: 24 hours of 60 minutes of 60 seconds.', 'day in seconds', () => all([exact('time', 'day', 's', '86400'), is(24 * 60 * 60 === 86400, '24 × 60 × 60')]));
  f(TI, 'faq', '1,440 minutes, and 10,080 in a week.', 'minutes', () => all([exact('time', 'day', 'min', '1440'), exact('time', 'week', 'min', '10080')]));
  f(TI, 'faq', '168 hours: 7 days of 24 hours.', 'week in hours', () => exact('time', 'week', 'h', '168'));
  f(TI, 'faq', 'A calendar year has 365 days, or 366 in a leap year. This converter uses the Julian year, the average over a four-year leap cycle: 1 yr = 365.25 d.', 'Julian year', () => all([exact('time', 'yr', 'day', '365.25'), is(E().UNITS.time.units.yr.factor === 31557600, 'the converter’s year is ' + E().UNITS.time.units.yr.factor + ' s')]));
  f(TI, 'faq', '52.1786 wk in a Julian year of 365.25 days. A 365-day calendar year is 52 weeks and 1 day.', 'weeks in a year', () => all([nears([['52.1786', r('time', 1, 'yr', 'week')]]), is(52 * 7 + 1 === 365, '52 × 7 + 1 = 365')]));

  /* speed */
  f(S, 'what', 'A metre per second is exactly 3.6 km/h, and a mile per hour is exactly 1.609344 km/h because the mile is defined as 1,609.344 m.', 'm/s and mph in km/h', () => all([exact('speed', 'mps', 'kph', '3.6'), exact('speed', 'mph', 'kph', '1.609344'), exact('length', 'mi', 'm', '1609.344')]));
  f(S, 'what', 'Ships and aircraft use the knot, one nautical mile per hour, which is exactly 1.852 km/h or about 1.151 mph.', 'knot', () => all([exact('speed', 'knot', 'kph', '1.852'), is(r('speed', 1, 'knot', 'mph').toFixed(3) === '1.151', 'kn = ' + r('speed', 1, 'knot', 'mph') + ' mph')]));
  f(S, 'what', 'this converter uses 340.29 m/s, the standard value at sea level, so treat Mach figures for high altitude as approximate.', 'Mach: the converter’s value and USSA 1976', () => all([is(E().UNITS.speed.units.mach.factor === 340.29, 'converter ' + E().UNITS.speed.units.mach.factor + ' m/s'), is(Number(ISA_SL.toPrecision(5)) === 340.29, 'USSA ' + ISA_SL.toFixed(3) + ' m/s'), is(ISA(216.65) < ISA_SL - 40, 'at 11 km ' + ISA(216.65).toFixed(1) + ' m/s')]));
  manual(S, 'what', 'Road speeds are given in kilometres per hour in most countries and in miles per hour in the UK and the US.', 'a statement about usage');
  f(S, 'faq', 'Divide by 1.609344, the number of kilometres in a mile. 100 km/h is 62.1371 mph, and 50 km/h is 31.0686 mph.', 'km/h to mph', () => all([exact('speed', 'mph', 'kph', '1.609344'), nears([['62.1371', r('speed', 100, 'kph', 'mph')], ['31.0686', r('speed', 50, 'kph', 'mph')]])]));
  f(S, 'faq', 'Multiply by 1.609344. 30 mph is 48.2803 km/h, and 70 mph is 112.6541 km/h.', 'mph to km/h', () => all([exact('speed', 'mph', 'kph', '1.609344'), nears([['48.2803', r('speed', 30, 'mph', 'kph')], ['112.6541', r('speed', 70, 'mph', 'kph')]])]));
  f(S, 'faq', 'Multiply by 3.6: an hour is 3,600 seconds and a kilometre is 1,000 metres. 10 m/s is 36 km/h.', 'm/s to km/h', () => all([exact('speed', 'mps', 'kph', '3.6'), nears([['36', r('speed', 10, 'mps', 'kph')]])]));
  f(S, 'faq', 'A knot is one nautical mile per hour: exactly 1.852 km/h, or 1.1508 mph.', 'knot', () => all([exact('speed', 'knot', 'kph', '1.852'), nears([['1.1508', r('speed', 1, 'knot', 'mph')]])]));
  f(S, 'faq', 'This converter uses the speed of sound at sea level in standard conditions, 340.29 m/s, so Mach 1 is 1,225.04 km/h (761.2071 mph). Sound travels more slowly in colder air, so Mach 1 is slower at cruising altitude.', 'Mach 1', () => all([is(E().UNITS.speed.units.mach.factor === 340.29 && Number(ISA_SL.toPrecision(5)) === 340.29, '340.29 m/s; USSA ' + ISA_SL.toFixed(3)), nears([['1,225.04', r('speed', 1, 'mach', 'kph')], ['761.2071', r('speed', 1, 'mach', 'mph')]]), is(ISA(216.65) < ISA_SL, 'colder air at 11 km: ' + ISA(216.65).toFixed(1) + ' m/s')]));

  /* pressure */
  f(PR, 'what', 'The bar is exactly 100,000 Pa, close to the air pressure at sea level', 'bar vs the standard atmosphere', () => all([exact('pressure', 'bar', 'Pa', '100000'), is(Math.abs(r('pressure', 1, 'atm', 'bar') - 1) < 0.02, '1 atm = ' + r('pressure', 1, 'atm', 'bar') + ' bar')]));
  f(PR, 'what', 'weather maps use the millibar, which is the same as the hectopascal.', 'mbar = hPa', () => exact('pressure', 'mbar', 'Pa', '100'));
  f(PR, 'what', 'The standard atmosphere (atm) is defined as exactly 101,325 Pa.', 'atm', () => exact('pressure', 'atm', 'Pa', '101325'));
  f(PR, 'what', 'a psi is about 6.895 kPa, and a bar is about 14.5 psi.', 'psi and bar', () => is(r('pressure', 1, 'psi', 'kPa').toFixed(3) === '6.895' && r('pressure', 1, 'bar', 'psi').toFixed(1) === '14.5', 'psi = ' + r('pressure', 1, 'psi', 'kPa') + ' kPa; bar = ' + r('pressure', 1, 'bar', 'psi') + ' psi'));
  f(PR, 'what', 'The torr is exactly 1/760 of a standard atmosphere and is almost the same as the millimetre of mercury used for blood pressure.', 'torr vs mmHg', () => { const d = Math.abs(REF.pressure.u.torr.v.q.num() / MMHG.num() - 1); return all([exact('pressure', 'atm', 'torr', '760'), is(d < 1e-6, 'differ by ' + d.toExponential(2))]); });
  manual(PR, 'what', 'Inches of mercury survive in aviation for altimeter settings and in US weather reports.', 'a statement about usage');
  f(PR, 'faq', 'One bar is 14.5038 psi, and 1 psi is 0.068948 bar.', 'bar and psi', () => nears([['14.5038', r('pressure', 1, 'bar', 'psi')], ['0.068948', r('pressure', 1, 'psi', 'bar')]]));
  f(PR, 'faq', 'Multiply by about 6.895. A tyre at 32 psi is 220.6322 kPa, or 2.2063 bar.', 'psi to kPa', () => all([is(r('pressure', 1, 'psi', 'kPa').toFixed(3) === '6.895', 'psi = ' + r('pressure', 1, 'psi', 'kPa') + ' kPa'), nears([['220.6322', r('pressure', 32, 'psi', 'kPa')], ['2.2063', r('pressure', 32, 'psi', 'bar')]])]));
  f(PR, 'faq', 'One standard atmosphere is defined as exactly 101,325 Pa: 1.0132 bar, 14.6959 psi or 29.9213 inHg.', 'the standard atmosphere', () => all([exact('pressure', 'atm', 'Pa', '101325'), nears([['1.0132', r('pressure', 1, 'atm', 'bar')], ['14.6959', r('pressure', 1, 'atm', 'psi')], ['29.9213', r('pressure', 1, 'atm', 'inHg')]])]));
  f(PR, 'faq', 'Yes. 1 mbar is 100 Pa, which is one hectopascal (hPa), so a weather pressure reads the same in either unit.', 'mbar = hPa', () => exact('pressure', 'mbar', 'Pa', '100'));
  f(PR, 'faq', 'Exactly 100 kPa: a bar is 100,000 Pa.', 'bar in kPa', () => all([exact('pressure', 'bar', 'kPa', '100'), exact('pressure', 'bar', 'Pa', '100000')]));
  f(PR, 'faq', 'one standard atmosphere is 14.6959 psi or 101.325 kPa, and the real figure varies with the weather and the altitude. So with the standard atmosphere, a tyre at 32 psig is about 46.7 psia, and 2 barg is about 3.01 bara.', 'gauge plus atmosphere', () => all([nears([['14.6959', r('pressure', 1, 'atm', 'psi')], ['101.325', r('pressure', 1, 'atm', 'kPa')]]), is((32 + r('pressure', 1, 'atm', 'psi')).toFixed(1) === '46.7', '32 + 14.6959 = ' + (32 + r('pressure', 1, 'atm', 'psi'))), is((2 + r('pressure', 1, 'atm', 'bar')).toFixed(2) === '3.01', '2 + 1.01325')]));
  manual(PR, 'faq', 'Tyre and most workshop gauges read gauge pressure.', 'a statement about instruments');

  /* energy */
  f(EN, 'what', 'a kilowatt-hour is the energy of 1 kW used for one hour, exactly 3.6 million joules.', 'kWh', () => all([exact('energy', 'kWh', 'J', '3600000'), is(1000 * 3600 === 3.6e6, '1 kW × 3600 s')]));
  f(EN, 'what', 'one kilocalorie is 4.184 kJ using the thermochemical calorie this converter uses.', 'kcal; the converter’s calorie is thermochemical', () => all([exact('energy', 'kcal', 'kJ', '4.184'), is(E().UNITS.energy.units.cal.factor === 4.184, 'converter calorie ' + E().UNITS.energy.units.cal.factor + ' J (thermochemical; IT is 4.1868)')]));
  f(EN, 'what', 'a BTU is about 1,055 J, roughly the energy needed to warm a pound of water by one degree Fahrenheit.', 'BTU vs a pound of water by 1 °F', () => { const w = 453.59237 * (5 / 9) * 4.1855; return all([is(Math.round(r('energy', 1, 'BTU', 'J')) === 1055, 'BTU = ' + r('energy', 1, 'BTU', 'J') + ' J'), is(Math.abs(w / r('energy', 1, 'BTU', 'J') - 1) < 0.01, '453.59 g × 5/9 K × 4.1855 J/(g·K) = ' + w.toFixed(1) + ' J')]); });
  f(EN, 'what', 'The electronvolt is the tiny unit of atomic and particle physics', 'eV', () => exact('energy', 'eV', 'J', '1.602176634e-19'));
  manual(EN, 'what', 'Electricity is billed in kilowatt-hours', 'a statement about billing practice');
  f(EN, 'faq', 'Exactly 3,600,000 J: 1,000 watts for 3,600 seconds.', 'kWh in J', () => exact('energy', 'kWh', 'J', '3600000'));
  f(EN, 'faq', 'Yes. The "Calorie" on a food label is a kilocalorie, 4.184 kJ. A 2,000 kcal daily intake is 8,368 kJ.', 'kcal in kJ', () => all([exact('energy', 'kcal', 'kJ', '4.184'), nears([['8,368', r('energy', 2000, 'kcal', 'kJ')]])]));
  f(EN, 'faq', 'Divide by 4.184. 1,000 kJ is 239.0057 kcal.', 'kJ to kcal', () => all([exact('energy', 'kcal', 'kJ', '4.184'), nears([['239.0057', r('energy', 1000, 'kJ', 'kcal')]])]));
  f(EN, 'faq', 'One kilowatt-hour is 3,412.14 BTU, and one BTU is 1,055.06 J.', 'kWh in BTU', () => nears([['3,412.14', r('energy', 1, 'kWh', 'BTU')], ['1,055.06', r('energy', 1, 'BTU', 'J')]]));
  f(EN, 'faq', 'A kilocalorie is 1,000 cal. The calorie here is the thermochemical calorie, exactly 4.184 J.', 'calorie', () => all([exact('energy', 'kcal', 'cal', '1000'), exact('energy', 'cal', 'J', '4.184'), is(E().UNITS.energy.units.cal.factor === 4.184, 'converter calorie 4.184 J')]));

  /* power */
  f(PO, 'what', 'a kilowatt is 1,000 W and a megawatt is a million.', 'kW, MW', () => all([exact('power', 'kW', 'W', '1000'), exact('power', 'MW', 'W', '1000000')]));
  f(PO, 'what', 'the mechanical or imperial horsepower is about 745.7 W, while the metric horsepower (PS, also written cv or ch) is exactly 735.49875 W', 'two horsepowers', () => all([is(r('power', 1, 'hp', 'W').toFixed(1) === '745.7', 'hp = ' + r('power', 1, 'hp', 'W') + ' W'), exact('power', 'hpM', 'W', '735.49875')]));
  f(PO, 'what', '1,000 BTU/h is about 293 W.', 'BTU/h', () => is(Math.round(r('power', 1000, 'btuh', 'W')) === 293, '1000 BTU/h = ' + r('power', 1000, 'btuh', 'W') + ' W'));
  f(PO, 'what', 'Power is not energy: a 2 kW heater running for three hours uses 6 kWh.', 'power × time', () => is(R('energy', 2 * 3, 'kWh', 'J') === 2000 * 3 * 3600, '2 kW × 3 h = 6 kWh = 21.6 MJ'));
  f(PO, 'faq', 'One mechanical horsepower is 0.7457 kW; one metric horsepower (PS) is 0.735499 kW.', 'hp in kW', () => nears([['0.7457', r('power', 1, 'hp', 'kW')], ['0.735499', r('power', 1, 'hpM', 'kW')]]));
  f(PO, 'faq', 'Multiply by about 1.341 for mechanical horsepower, or about 1.36 for metric. A 100 kW engine is 134.1022 hp, or 135.9622 PS.', 'kW to hp', () => all([is(r('power', 1, 'kW', 'hp').toFixed(3) === '1.341' && r('power', 1, 'kW', 'hpM').toFixed(2) === '1.36', 'kW = ' + r('power', 1, 'kW', 'hp') + ' hp, ' + r('power', 1, 'kW', 'hpM') + ' PS'), nears([['134.1022', r('power', 100, 'kW', 'hp')], ['135.9622', r('power', 100, 'kW', 'hpM')]])]));
  f(PO, 'faq', '293.0711 W. An air conditioner rated at 12,000 BTU/h delivers 3.5169 kW of cooling.', 'BTU/h', () => nears([['293.0711', r('power', 1000, 'btuh', 'W')], ['3.5169', r('power', 12000, 'btuh', 'kW')]]));
  f(PO, 'faq', 'Power is how fast energy is used; energy is power multiplied by time. A 2 kW heater running for 3 hours uses 6 kWh of energy.', 'power × time', () => is(2 * 3 === 6 && peq(refAff('energy', 'kWh', 'J').a, P(1000 * 3600)), '2 kW × 3 h = 6 kWh'));
  f(PO, 'faq', 'A milliwatt is a thousandth of a watt: 1 mW = 0.001 W, so divide milliwatts by 1,000 to get watts. 500 mW is 0.5 W, and 1 W is 1,000 mW.', 'milliwatt', () => all([exact('power', 'W', 'mW', '1000'), nears([['0.001', r('power', 1, 'mW', 'W')], ['0.5', r('power', 500, 'mW', 'W')], ['1,000', r('power', 1, 'W', 'mW')]])]));
  f(PO, 'faq', 'which is 0.005 W.', '5 mW in W', () => nears([['0.005', r('power', 5, 'mW', 'W')]]));
  manual(PO, 'faq', 'in the US, for example, the FDA limits laser pointers to 5 mW of visible light', 'a regulation (21 CFR 1040), not a conversion');
  f(PO, 'faq', '0 dBm is 1 mW, 10 dBm is 10 mW, 20 dBm is 100 mW and 30 dBm is 1,000 mW, which is 1 W. Every 3 dB is close to double: 3 dBm is 1.9953 mW.', 'dBm', () => all([nears([['1', Math.pow(10, 0)], ['10', Math.pow(10, 1)], ['100', Math.pow(10, 2)], ['1,000', Math.pow(10, 3)], ['1', r('power', 1000, 'mW', 'W')], ['1.9953', Math.pow(10, 0.3)]]), is(Math.abs(Math.pow(10, 0.3) / 2 - 1) < 0.01, '10^0.3 is within 1% of 2')]));

  /* data */
  f(DA, 'what', 'A bit is a single binary digit, 0 or 1, and a byte is 8 bits.', 'byte', () => exact('data', 'B', 'bit', '8'));
  f(DA, 'what', 'The decimal SI prefixes step by 1,000: a kilobyte (KB) is 1,000 bytes, a megabyte (MB) a million and a gigabyte (GB) a billion', 'decimal units', () => all([exact('data', 'KB', 'B', '1000'), exact('data', 'MB', 'B', '1000000'), exact('data', 'GB', 'B', '1000000000')]));
  f(DA, 'what', 'The binary IEC prefixes step by 1,024: a kibibyte (KiB) is 1,024 bytes, a mebibyte (MiB) 1,048,576 and a gibibyte (GiB) 1,073,741,824.', 'binary units', () => all([exact('data', 'KiB', 'B', '1024'), exact('data', 'MiB', 'B', '1048576'), exact('data', 'GiB', 'B', '1073741824')]));
  f(DA, 'what', 'which is why a 1 TB drive shows as about 931 GB there.', '1 TB in GiB', () => is(Math.round(r('data', 1, 'TB', 'GiB')) === 931, '1 TB = ' + r('data', 1, 'TB', 'GiB') + ' GiB'));
  manual(DA, 'what', 'drive makers, macOS and iOS count this way', 'how third-party software labels sizes');
  manual(DA, 'what', 'Windows counts in binary units but labels them KB, MB and GB', 'how third-party software labels sizes');
  f(DA, 'what', 'Network speeds are quoted in bits per second, so divide by 8 to compare a download speed with a file size in bytes.', 'bits to bytes', () => exact('data', 'B', 'bit', '8'));
  f(DA, 'faq', '1,000 megabytes in a gigabyte, in decimal SI units. In binary units there are 1,024 mebibytes in a gibibyte.', 'MB in GB', () => all([exact('data', 'GB', 'MB', '1000'), exact('data', 'GiB', 'MiB', '1024')]));
  f(DA, 'faq', 'The drive holds a trillion bytes, but Windows divides by 1,024 rather than 1,000 and still calls the result GB: 1 TB is 931.3226 GiB. Nothing is missing.', '1 TB in GiB', () => all([exact('data', 'TB', 'B', '1000000000000'), nears([['931.3226', r('data', 1, 'TB', 'GiB')]])]));
  f(DA, 'faq', '8. Network speeds are given in bits per second, so a 100 Mbit/s connection moves at most 12.5 MB of data per second.', 'bits per second', () => all([exact('data', 'B', 'bit', '8'), is(R('data', 100, 'MB', 'bit') / 8 === 100e6 && 100 / 8 === 12.5, '100 Mbit = 12.5 MB')]));
  f(DA, 'faq', 'In SI units a kilobyte (KB) is 1,000 B. The 1,024-byte unit is properly the kibibyte (KiB), 1,024 B, though many programs still label it KB.', 'kilobyte and kibibyte', () => all([exact('data', 'KB', 'B', '1000'), exact('data', 'KiB', 'B', '1024')]));
  f(DA, 'faq', '1,000 GB in a terabyte, or 1,024 GiB in a tebibyte.', 'TB and TiB', () => all([exact('data', 'TB', 'GB', '1000'), exact('data', 'TiB', 'GiB', '1024')]));

  /* angle */
  f(AN, 'what', 'so a full turn is 2π radians.', 'turn', () => is(peq(refAff('angle', 'turn', 'rad').a, P(2, 1)), 'turn = 2π rad'));
  f(AN, 'what', 'Degrees divide a full turn into 360, so π radians is 180° and one radian is 180/π, about 57.2958°.', 'degree and radian', () => all([exact('angle', 'turn', 'deg', '360'), is(peq(refAff('angle', 'rad', 'deg').a, P(180, -1)), 'rad = 180/π °'), nears([['57.2958', r('angle', 1, 'rad', 'deg')]])]));
  f(AN, 'what', 'Each degree is split into 60 arcminutes and each arcminute into 60 arcseconds', 'arcminute, arcsecond', () => all([exact('angle', 'deg', 'arcmin', '60'), exact('angle', 'arcmin', 'arcsec', '60')]));
  f(AN, 'what', 'The gradian, also called the gon, divides a right angle into 100, so a full turn is 400 grad', 'gradian', () => all([exact('angle', 'turn', 'grad', '400'), is(refAff('angle', 'deg', 'grad').a.q.mul(90).eq(100), '90° = 100 grad')]));
  manual(AN, 'what', 'Most programming languages and spreadsheet trigonometry functions work in radians, so convert degrees before calling sin or cos.', 'a statement about third-party software');
  f(AN, 'faq', 'Multiply by π/180. 90° is 1.5708 rad and 180° is 3.1416 rad, which is π.', 'deg to rad', () => all([is(peq(refAff('angle', 'deg', 'rad').a, P(q(1).div(180), 1)), '× π/180'), nears([['1.5708', r('angle', 90, 'deg', 'rad')], ['3.1416', r('angle', 180, 'deg', 'rad')], ['3.1416', Math.PI]])]));
  f(AN, 'faq', 'One radian is 57.2958 °, which is 180/π.', 'radian', () => all([nears([['57.2958', r('angle', 1, 'rad', 'deg')], ['57.2958', 180 / Math.PI]])]));
  f(AN, 'faq', '60 arcminutes, or 3,600 arcseconds.', 'degree in arcminutes', () => all([exact('angle', 'deg', 'arcmin', '60'), exact('angle', 'deg', 'arcsec', '3600')]));
  f(AN, 'faq', 'A gradian, or gon, is 1/400 of a full turn, so a right angle is 100 grad and one gradian is 0.9 °.', 'gradian', () => all([exact('angle', 'turn', 'grad', '400'), exact('angle', 'grad', 'deg', '0.9')]));

  /* ================================================================== */
  /* /conversions/                                                      */
  /* ================================================================== */

  const HUB = '/conversions/';
  const hh = read(HUB);
  const total = FAMS.reduce((s, fam) => { const n = unitKeys(fam).length; return s + n * (n - 1); }, 0);
  claim(HUB, 'lede', total.toLocaleString('en-GB') + ' free tools.', 'pair pages on disk = every ordered pair of the reference units', N, async () => {
    const n = FAMS.reduce((s, fam) => s + nPages(fam), 0);
    return is(n === total, n + ' pair pages; ' + stubs.length + ' redirect stubs skipped');
  });
  manual(HUB, 'lede', 'No sign-up', 'a statement of policy');
  claim(HUB, 'ui', 'Convert any unit', 'the picker’s unit data across all families, and its answer on load', N, async () => all([pickerDataCheck(hh, FAMS), liveCheck(hh, 'length')]));
  claim(HUB, 'hub', 'Most-used conversions', 'every most-used card', N, async () => cardsCheck(hh, (href) => href.split('/')[2]));
  claim(HUB, 'hub', 'Browse by family', 'family cards: figure, conversions and units counts', N, async () => {
    const cards = [...hh.matchAll(/<a class="card conv-fam-card" href="\/conversions\/([a-z]+)\/">[\s\S]*?<span class="card-desc">([^<]*)<\/span><span class="card-count">([^<]*)<\/span><\/a>/g)];
    const errs = [];
    for (const [, fam, desc, cnt] of cards) {
      const n = unitKeys(fam).length, p = pairOf(fam, dec(desc));
      if (!p || !p[1] || !p[3] || !near(p[2], R(fam, 1, p[1], p[3]))) errs.push(fam + ': ' + dec(desc));
      if (dec(cnt) !== (n * (n - 1)).toLocaleString('en-GB') + ' conversions · ' + n + ' units') errs.push(fam + ': ' + dec(cnt));
    }
    if (cards.length !== FAMS.length) errs.push(cards.length + ' cards');
    return errs.length ? [false, errs.join('; ')] : [true, cards.length + ' families hold'];
  });
  claim(HUB, 'hub', 'Every pair, by family and then by the unit you are converting from.', 'the full list on /conversions/', N, async () => {
    const folds = [...hh.matchAll(/<details class="conv-fam" data-grp><summary><span class="conv-u">([^<]*)<\/span><span class="conv-n">(\d+)<\/span><\/summary>([\s\S]*?)<\/details>/g)];
    const errs = [];
    let links = 0;
    for (const [, , cnt, body] of folds) {
      const fam = ((/<a href="\/conversions\/([a-z]+)\/">/.exec(body)) || [])[1];
      if (!fam || !REF[fam]) { errs.push('fold without a family'); continue; }
      const n = unitKeys(fam).length;
      if (Number(cnt) !== n * (n - 1)) errs.push(fam + ' says ' + cnt);
      for (const [, sym, ul] of body.matchAll(/<h3><span class="conv-u">[^<]*<\/span><span class="conv-sym">([^<]*)<\/span><\/h3><ul class="conv-links">([\s\S]*?)<\/ul>/g)) {
        const k = unitKeys(fam).find((x) => REF[fam].u[x].sym === dec(sym));
        for (const [, href] of ul.matchAll(/<a href="([^"]+)">/g)) { links++; const t = BY_URL[href]; if (!t || t[0] !== fam || t[1] !== k) errs.push(href + ' under ' + dec(sym)); }
      }
    }
    if (folds.length !== FAMS.length || links !== total) errs.push(folds.length + ' families, ' + links + ' links');
    return errs.length ? [false, errs.slice(0, 8).join('; ')] : [true, folds.length + ' families, ' + links + ' links, each under its from-unit'];
  });

  /* ================================================================== */
  /* Chrome: the pickers, the filter, the converter's tips, offline     */
  /* ================================================================== */

  const SAMPLE = { length: ['in', 'cm'], mass: ['kg', 'lb'], temperature: ['C', 'F'], volume: ['l', 'gal'], area: ['m2', 'ft2'], time: ['s', 'min'], speed: ['kph', 'mph'], pressure: ['bar', 'psi'], energy: ['kcal', 'kJ'], power: ['hp', 'kW'], data: ['MB', 'GB'], angle: ['deg', 'rad'] };
  const setVal = (p, sel, v) => p.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }, sel, v);
  const liveIs = async (p, fam, x, a, b) => {
    const s = await p.$eval('.conv-live', (e) => e.textContent.replace(/\s+/g, ' ').trim());
    const pr = pairOf(fam, s);
    return is(pr && pr[1] === a && pr[3] === b && near(pr[2], R(fam, x, a, b)), s);
  };
  const resultOf = (p) => p.$eval('.tool-results .result-primary .result-value', (e) => e.textContent.trim());

  for (const fam of FAMS) {
    const H = hubUrl(fam);
    claim(H, 'ui', HEAD[fam] + ' converter', 'Chrome: converts as you type, other units, swap, Convert opens the pair page with the value', BR, async () => {
      const p = await K.open(H, { wait: '.conv-live' });
      try {
        const out = [];
        const sel = () => p.evaluate(() => [document.querySelector('#conv-from').value, document.querySelector('#conv-to').value]);
        await setVal(p, '#conv-v', '7');
        let [a, b] = await sel();
        out.push(await liveIs(p, fam, 7, a, b));
        const keys = await p.evaluate(() => [...document.querySelectorAll('#conv-from option')].map((o) => o.value));
        await setVal(p, '#conv-from', keys[keys.length - 1]);
        await setVal(p, '#conv-to', keys[0]);
        out.push(await liveIs(p, fam, 7, keys[keys.length - 1], keys[0]));
        await p.click('.conv-swap');
        [a, b] = await sel();
        out.push(await liveIs(p, fam, 7, keys[0], keys[keys.length - 1]));
        await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.click('.conv-go')]);
        const loc = await p.evaluate(() => location.pathname + location.hash);
        out.push(is(loc === pairUrl(fam, a, b) + '#v=7', 'Convert opened ' + loc));
        await p.waitForSelector('.tool-results .result-primary .result-value', { timeout: 30000 });
        const shown = await resultOf(p);
        out.push(is(near(valIn(shown, REF[fam].u[b].sym), R(fam, 7, a, b)), 'the converter there shows ' + shown));
        return all(out);
      } finally { await p.close(); }
    });
  }
  claim(HUB, 'ui', 'Convert any unit', 'Chrome: choosing Celsius gives the To list temperature units, and 100 °C converts', BR, async () => {
    const p = await K.open(HUB, { wait: '.conv-live' });
    try {
      await setVal(p, '#conv-from', 'C');
      const opts = await p.evaluate(() => [...document.querySelectorAll('#conv-to option')].map((o) => o.value));
      await setVal(p, '#conv-to', 'F');
      await setVal(p, '#conv-v', '100');
      return all([is(opts.length === unitKeys('temperature').length && opts.every((k) => REF.temperature.u[k]), 'To list: ' + opts.join(',')), await liveIs(p, 'temperature', 100, 'C', 'F')]);
    } finally { await p.close(); }
  });
  claim(HUB, 'hub', 'Open a family, or search across all of them.', 'Chrome: the filter searches every family', BR, async () => {
    const p = await K.open(HUB, { wait: '.conv-live' });
    try {
      await p.type('#conv-q', 'mile');
      const vis = await p.evaluate(() => [...document.querySelectorAll('.conv-all li:not([hidden]) a')].map((a) => a.getAttribute('href')));
      const fams = [...new Set(vis.map((h) => h.split('/')[2]))];
      await p.$eval('#conv-q', (e) => { e.value = ''; e.dispatchEvent(new Event('input')); });
      await p.type('#conv-q', 'psi to bar');
      const vis2 = await p.evaluate(() => [...document.querySelectorAll('.conv-all li:not([hidden]) a')].map((a) => a.getAttribute('href')));
      return all([is(fams.length >= 3, '"mile" finds pairs in ' + fams.join(', ')), is(vis2.indexOf(pairUrl('pressure', 'psi', 'bar')) >= 0 && vis2.every((h) => BY_URL[h] && BY_URL[h][1] === 'psi' && BY_URL[h][2] === 'bar'), '"psi to bar" leaves ' + vis2.join(', '))]);
    } finally { await p.close(); }
  });

  /* offline: the service worker on a fresh page, as a visitor meets it */
  const offline = () => K.once('conv-offline', async () => {
    const url = pairUrl('length', 'in', 'cm');
    const p = await K.browser.newPage();
    const notes = [];
    const tryOffline = async () => {
      await p.setOfflineMode(true);
      let shown = '';
      try {
        await p.reload({ waitUntil: 'load', timeout: 30000 });
        await p.waitForSelector('.tool-results .result-primary .result-value', { timeout: 5000 });
        await setVal(p, '#u-value', '5');
        shown = await resultOf(p);
      } catch (e) { shown = ''; }
      await p.setOfflineMode(false);
      return shown;
    };
    try {
      await p.goto(K.BASE + url, { waitUntil: 'load' });
      await p.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
      await K.sleep(500);
      let shown = await tryOffline();
      notes.push('offline after one visit: ' + (shown || 'no converter'));
      if (!shown) {
        await p.goto(K.BASE + url, { waitUntil: 'load' });
        await K.sleep(500);
        shown = await tryOffline();
        notes.push('after a second visit: ' + (shown || 'no converter'));
      }
      return [shown === '12.7 cm', notes.join('; ')];
    } finally { await p.close(); }
  });
  claim(HUB, 'lede', 'No sign-up, no server, works offline.', 'Chrome: converting makes no request, and a visited converter works offline', BR, async () => {
    const p = await K.open(pairUrl('mass', 'kg', 'lb'), { wait: '.tool-results .result-primary' });
    let quiet;
    try {
      const n0 = p.__requests.length;
      for (const v of ['3', '70.5', '1e6']) await setVal(p, '#u-value', v);
      await K.sleep(400);
      quiet = is(p.__requests.length === n0, (p.__requests.length - n0) + ' requests while converting');
    } finally { await p.close(); }
    return all([quiet, await offline()]);
  });

  /* the converter's three tips, on one page per family */
  for (const fam of FAMS) {
    const [a, b] = SAMPLE[fam];
    const url = pairUrl(fam, a, b);
    if (!url) continue;
    const U = REF[fam].u;
    const open = () => K.open(url, { wait: '.tool-results .result-primary' });
    claim(url, 'tip', 'Use the swap button to reverse the direction — every converter here works both ways.', 'Chrome: swap reverses the units and the answer', BR, async () => {
      const p = await open();
      try {
        await setVal(p, '#u-value', '3');
        await p.click('.swap');
        const s = await p.evaluate(() => [document.querySelector('#u-from').value, document.querySelector('#u-to').value]);
        const shown = await resultOf(p);
        return all([is(s[0] === b && s[1] === a, 'now ' + s.join(' → ')), is(near(valIn(shown, U[a].sym), R(fam, 3, b, a)), '3 ' + U[b].sym + ' = ' + shown)]);
      } finally { await p.close(); }
    });
    claim(url, 'tip', 'The full table below the result shows the same value in every ' + E().UNITS[fam].label.toLowerCase() + ' unit at once.', 'Chrome: every other unit, each right', BR, async () => {
      const p = await open();
      try {
        await setVal(p, '#u-value', '3');
        const rows = await p.$$eval('.all-units .result .result-value', (l) => l.map((e) => e.textContent.trim()));
        const errs = [], got = new Set();
        for (const t of rows) {
          const k = unitKeys(fam).find((x) => valIn(t, U[x].sym) !== null && shownNum(valIn(t, U[x].sym)) !== null);
          if (!k) { errs.push('row ' + t); continue; }
          got.add(k);
          if (!near(valIn(t, U[k].sym), R(fam, 3, a, k))) errs.push(t + ', reference ' + fmt6(R(fam, 3, a, k)));
        }
        const want = unitKeys(fam).filter((k) => k !== a);
        if (want.some((k) => !got.has(k))) errs.push('missing ' + want.filter((k) => !got.has(k)).join(','));
        return errs.length ? [false, errs.join('; ')] : [true, rows.length + ' units, each right'];
      } finally { await p.close(); }
    });
    claim(url, 'tip', 'All arithmetic happens in your browser, so results are instant and work offline.', 'Chrome: answers appear on input with no request' + (fam === 'length' ? '; offline after a visit' : ''), BR, async () => {
      const p = await open();
      const out = [];
      try {
        const n0 = p.__requests.length;
        for (const v of ['2', '9.5', '1234']) {
          const shown = await p.evaluate((v) => { const e = document.querySelector('#u-value'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); return document.querySelector('.tool-results .result-primary .result-value').textContent.trim(); }, v);
          out.push(is(near(valIn(shown, U[b].sym), R(fam, Number(v), a, b)), v + ' → ' + shown + ' at once'));
        }
        await K.sleep(400);
        out.push(is(p.__requests.length === n0, (p.__requests.length - n0) + ' requests'));
      } finally { await p.close(); }
      if (fam === 'length') out.push(await offline());
      return all(out);
    });
  }
};
