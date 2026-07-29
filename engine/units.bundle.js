/**
 * Unit Conversion Engine
 * ----------------------
 * Every unit is defined by its factor relative to an SI base unit.
 * Conversion between ANY two units in a dimension is then:
 *     value_in_base = value * factor          (linear units)
 *     result        = value_in_base / factor  (target unit)
 *
 * Affine units (temperature) additionally carry an offset:
 *     value_in_base = value * factor + offset
 *
 * This means ONE engine + a data table produces every converter.
 * A dimension with N units yields N*(N-1) directional conversions.
 * 12 dimensions x ~10 units each = ~1,300 conversion pairs from one file.
 */

const UNITS = {
  length: {
    label: 'Length & Distance',
    base: 'm',
    units: {
      ang:  { name: 'Angstrom',        symbol: 'Å',   factor: 1e-10 },
      nm:   { name: 'Nanometer',       symbol: 'nm',  factor: 1e-9 },
      um:   { name: 'Micrometer',      symbol: 'µm',  factor: 1e-6 },
      mm:   { name: 'Millimeter',      symbol: 'mm',  factor: 0.001 },
      cm:   { name: 'Centimeter',      symbol: 'cm',  factor: 0.01 },
      m:    { name: 'Meter',           symbol: 'm',   factor: 1 },
      km:   { name: 'Kilometer',       symbol: 'km',  factor: 1000 },
      in:   { name: 'Inch',            symbol: 'in',  factor: 0.0254 },
      ft:   { name: 'Foot',            symbol: 'ft',  factor: 0.3048 },
      yd:   { name: 'Yard',            symbol: 'yd',  factor: 0.9144 },
      fath: { name: 'Fathom',          symbol: 'ftm', factor: 1.8288 },      // 6 ft
      chain:{ name: 'Chain',           symbol: 'ch',  factor: 20.1168 },     // 66 ft
      fur:  { name: 'Furlong',         symbol: 'fur', factor: 201.168 },     // 660 ft = 1/8 mile
      mi:   { name: 'Mile',            symbol: 'mi',  factor: 1609.344 },
      nmi:  { name: 'Nautical Mile',   symbol: 'nmi', factor: 1852 },
      au:   { name: 'Astronomical Unit', symbol: 'AU', factor: 149597870700 },
      ly:   { name: 'Light Year',      symbol: 'ly',  factor: 9.4607304725808e15 },
      pc:   { name: 'Parsec',          symbol: 'pc',  factor: 3.0856775814913673e16 }
    }
  },

  mass: {
    label: 'Mass & Weight',
    base: 'kg',
    units: {
      mg:  { name: 'Milligram',   symbol: 'mg', factor: 1e-6 },
      g:   { name: 'Gram',        symbol: 'g',  factor: 0.001 },
      kg:  { name: 'Kilogram',    symbol: 'kg', factor: 1 },
      t:   { name: 'Tonne',       symbol: 't',  factor: 1000 },
      oz:  { name: 'Ounce',       symbol: 'oz', factor: 0.028349523125 },
      lb:  { name: 'Pound',       symbol: 'lb', factor: 0.45359237 },
      st:  { name: 'Stone',       symbol: 'st', factor: 6.35029318 },
      ton: { name: 'Ton (US short)', symbol: 'ton', factor: 907.18474 },
      lt:  { name: 'Ton (UK long)',  symbol: 'LT',  factor: 1016.0469088 }
    }
  },

  temperature: {
    label: 'Temperature',
    base: 'K',
    affine: true,
    units: {
      C: { name: 'Celsius',    symbol: '°C', factor: 1,     offset: 273.15 },
      F: { name: 'Fahrenheit', symbol: '°F', factor: 5 / 9, offset: 255.37222222222223 },
      K: { name: 'Kelvin',     symbol: 'K',  factor: 1,     offset: 0 },
      R: { name: 'Rankine',    symbol: '°R', factor: 5 / 9, offset: 0 },
      // Historical scales. Rarely used today, but they are what people are
      // looking for when they meet one in an old text or instrument.
      Re: { name: 'Réaumur',   symbol: '°Ré', factor: 5 / 4,   offset: 273.15 },
      De: { name: 'Delisle',   symbol: '°De', factor: -2 / 3,  offset: 373.15 },
      N:  { name: 'Newton',    symbol: '°N',  factor: 100 / 33, offset: 273.15 },
      Ro: { name: 'Rømer',     symbol: '°Rø', factor: 40 / 21,  offset: 273.15 - (7.5 * 40 / 21) }
    }
  },

  volume: {
    label: 'Volume & Capacity',
    base: 'm3',
    units: {
      ml:      { name: 'Milliliter',      symbol: 'mL',  factor: 1e-6 },
      l:       { name: 'Liter',           symbol: 'L',   factor: 0.001 },
      m3:      { name: 'Cubic Meter',     symbol: 'm³',  factor: 1 },
      tsp:     { name: 'Teaspoon (US)',   symbol: 'tsp', factor: 4.92892159375e-6 },
      tbsp:    { name: 'Tablespoon (US)', symbol: 'tbsp',factor: 1.478676478125e-5 },
      floz:    { name: 'Fluid Ounce (US)',symbol: 'fl oz',factor: 2.95735295625e-5 },
      cup:     { name: 'Cup (US)',        symbol: 'cup', factor: 2.365882365e-4 },
      pt:      { name: 'Pint (US)',       symbol: 'pt',  factor: 4.73176473e-4 },
      qt:      { name: 'Quart (US)',      symbol: 'qt',  factor: 9.46352946e-4 },
      gal:     { name: 'Gallon (US)',     symbol: 'gal', factor: 0.003785411784 },
      galuk:   { name: 'Gallon (Imperial)', symbol: 'gal UK', factor: 0.00454609 },
      ft3:     { name: 'Cubic Foot',      symbol: 'ft³', factor: 0.028316846592 }
    }
  },

  area: {
    label: 'Area',
    base: 'm2',
    units: {
      mm2:  { name: 'Square Millimeter', symbol: 'mm²', factor: 1e-6 },
      cm2:  { name: 'Square Centimeter', symbol: 'cm²', factor: 1e-4 },
      m2:   { name: 'Square Meter',      symbol: 'm²',  factor: 1 },
      ha:   { name: 'Hectare',           symbol: 'ha',  factor: 10000 },
      km2:  { name: 'Square Kilometer',  symbol: 'km²', factor: 1e6 },
      in2:  { name: 'Square Inch',       symbol: 'in²', factor: 6.4516e-4 },
      ft2:  { name: 'Square Foot',       symbol: 'ft²', factor: 0.09290304 },
      yd2:  { name: 'Square Yard',       symbol: 'yd²', factor: 0.83612736 },
      acre: { name: 'Acre',              symbol: 'ac',  factor: 4046.8564224 },
      mi2:  { name: 'Square Mile',       symbol: 'mi²', factor: 2589988.110336 }
    }
  },

  time: {
    label: 'Time',
    base: 's',
    units: {
      ms:   { name: 'Millisecond', symbol: 'ms',  factor: 0.001 },
      s:    { name: 'Second',      symbol: 's',   factor: 1 },
      min:  { name: 'Minute',      symbol: 'min', factor: 60 },
      h:    { name: 'Hour',        symbol: 'h',   factor: 3600 },
      day:  { name: 'Day',         symbol: 'd',   factor: 86400 },
      week: { name: 'Week',        symbol: 'wk',  factor: 604800 },
      mo:   { name: 'Month (avg)', symbol: 'mo',  factor: 2629800 },
      yr:   { name: 'Year (Julian)', symbol: 'yr', factor: 31557600 }
    }
  },

  speed: {
    label: 'Speed & Velocity',
    base: 'mps',
    units: {
      mps:  { name: 'Meters per Second',   symbol: 'm/s',  factor: 1 },
      kph:  { name: 'Kilometers per Hour', symbol: 'km/h', factor: 1 / 3.6 },
      mph:  { name: 'Miles per Hour',      symbol: 'mph',  factor: 0.44704 },
      fps:  { name: 'Feet per Second',     symbol: 'ft/s', factor: 0.3048 },
      knot: { name: 'Knot',                symbol: 'kn',   factor: 1852 / 3600 },
      mach: { name: 'Mach (sea level)',    symbol: 'Ma',   factor: 340.29 }
    }
  },

  pressure: {
    label: 'Pressure',
    base: 'Pa',
    units: {
      Pa:   { name: 'Pascal',       symbol: 'Pa',   factor: 1 },
      kPa:  { name: 'Kilopascal',   symbol: 'kPa',  factor: 1000 },
      MPa:  { name: 'Megapascal',   symbol: 'MPa',  factor: 1e6 },
      bar:  { name: 'Bar',          symbol: 'bar',  factor: 100000 },
      mbar: { name: 'Millibar',     symbol: 'mbar', factor: 100 },
      psi:  { name: 'PSI',          symbol: 'psi',  factor: 6894.757293168361 },
      atm:  { name: 'Atmosphere',   symbol: 'atm',  factor: 101325 },
      torr: { name: 'Torr / mmHg',  symbol: 'Torr', factor: 133.32236842105263 },
      inHg: { name: 'Inches of Mercury', symbol: 'inHg', factor: 3386.388640341 }
    }
  },

  energy: {
    label: 'Energy & Work',
    base: 'J',
    units: {
      J:    { name: 'Joule',          symbol: 'J',    factor: 1 },
      kJ:   { name: 'Kilojoule',      symbol: 'kJ',   factor: 1000 },
      cal:  { name: 'Calorie (thermo)', symbol: 'cal', factor: 4.184 },
      kcal: { name: 'Kilocalorie',    symbol: 'kcal', factor: 4184 },
      Wh:   { name: 'Watt Hour',      symbol: 'Wh',   factor: 3600 },
      kWh:  { name: 'Kilowatt Hour',  symbol: 'kWh',  factor: 3600000 },
      BTU:  { name: 'British Thermal Unit', symbol: 'BTU', factor: 1055.05585262 },
      eV:   { name: 'Electronvolt',   symbol: 'eV',   factor: 1.602176634e-19 },
      ftlb: { name: 'Foot-Pound',     symbol: 'ft·lb', factor: 1.3558179483314004 }
    }
  },

  power: {
    label: 'Power',
    base: 'W',
    units: {
      mW:    { name: 'Milliwatt',      symbol: 'mW',    factor: 0.001 },
      W:     { name: 'Watt',           symbol: 'W',     factor: 1 },
      kW:    { name: 'Kilowatt',       symbol: 'kW',    factor: 1000 },
      MW:    { name: 'Megawatt',       symbol: 'MW',    factor: 1e6 },
      hp:    { name: 'Horsepower (mech)', symbol: 'hp', factor: 745.6998715822702 },
      hpM:   { name: 'Horsepower (metric)', symbol: 'PS', factor: 735.49875 },
      btuh:  { name: 'BTU per Hour',   symbol: 'BTU/h', factor: 0.29307107017222 }
    }
  },

  data: {
    label: 'Digital Storage',
    base: 'B',
    units: {
      bit: { name: 'Bit',       symbol: 'bit', factor: 0.125 },
      B:   { name: 'Byte',      symbol: 'B',   factor: 1 },
      KB:  { name: 'Kilobyte (1000)',  symbol: 'KB',  factor: 1e3 },
      MB:  { name: 'Megabyte (1000)',  symbol: 'MB',  factor: 1e6 },
      GB:  { name: 'Gigabyte (1000)',  symbol: 'GB',  factor: 1e9 },
      TB:  { name: 'Terabyte (1000)',  symbol: 'TB',  factor: 1e12 },
      KiB: { name: 'Kibibyte (1024)',  symbol: 'KiB', factor: 1024 },
      MiB: { name: 'Mebibyte (1024)',  symbol: 'MiB', factor: 1048576 },
      GiB: { name: 'Gibibyte (1024)',  symbol: 'GiB', factor: 1073741824 },
      TiB: { name: 'Tebibyte (1024)',  symbol: 'TiB', factor: 1099511627776 }
    }
  },

  angle: {
    label: 'Angle',
    base: 'rad',
    units: {
      rad:    { name: 'Radian',     symbol: 'rad',  factor: 1 },
      deg:    { name: 'Degree',     symbol: '°',    factor: Math.PI / 180 },
      grad:   { name: 'Gradian',    symbol: 'grad', factor: Math.PI / 200 },
      turn:   { name: 'Turn',       symbol: 'turn', factor: 2 * Math.PI },
      arcmin: { name: 'Arcminute',  symbol: "'",    factor: Math.PI / 10800 },
      arcsec: { name: 'Arcsecond',  symbol: '"',    factor: Math.PI / 648000 }
    }
  }
};

/**
 * Convert a value between two units of the same dimension.
 * Bidirectional by construction — from/to are symmetric.
 */
function convert(value, fromKey, toKey, dimension) {
  const dim = UNITS[dimension];
  if (!dim) throw new Error(`Unknown dimension: ${dimension}`);

  const from = dim.units[fromKey];
  const to = dim.units[toKey];
  if (!from) throw new Error(`Unknown unit '${fromKey}' in ${dimension}`);
  if (!to) throw new Error(`Unknown unit '${toKey}' in ${dimension}`);

  const v = Number(value);
  if (!isFinite(v)) return NaN;

  // to base
  const base = v * from.factor + (from.offset || 0);
  // base to target
  return (base - (to.offset || 0)) / to.factor;
}

/** Convert one value into every other unit in its dimension (for "show all" tables). */
function convertAll(value, fromKey, dimension) {
  const dim = UNITS[dimension];
  return Object.keys(dim.units).map(key => ({
    key,
    name: dim.units[key].name,
    symbol: dim.units[key].symbol,
    value: convert(value, fromKey, key, dimension)
  }));
}

/** Every ordered unit pair — this is what generates the individual converter pages. */
function enumeratePairs(dimension) {
  const keys = Object.keys(UNITS[dimension].units);
  const pairs = [];
  for (const a of keys) {
    for (const b of keys) {
      if (a !== b) pairs.push([a, b]);
    }
  }
  return pairs;
}

function totalConversionPairs() {
  return Object.keys(UNITS).reduce((sum, d) => sum + enumeratePairs(d).length, 0);
}


window.UNITS=UNITS;window.convert=convert;window.convertAll=convertAll;