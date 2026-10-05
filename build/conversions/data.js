/**
 * The editorial half of build-conversions.js: what each unit is called in a
 * sentence, which pairs people actually look for, and the short explanation,
 * quick reference, related calculators and questions on each family hub.
 *
 * Every figure on the pages is computed by build-conversions.js from
 * engine/units.bundle.js's own convert() and formatted like the converter
 * formats it; nothing here states a converted value as a literal. The FAQ
 * answers are functions of a helper `h`:
 *
 *   h.c(5, 'in', 'cm')   "12.7 cm"   5 in converted, formatted, with symbol
 *   h.x(5, 'in', 'cm')   12.7        the raw number
 *   h.n(12.7)            "12.7"      a number formatted like the converter
 *   h.v(5, 'in')         "5 in"      a value in its own unit
 *
 * Names are British English, like the rest of the site's own writing. The
 * unit labels inside the converter itself come from units.bundle.js.
 */
'use strict';

/* key: [Title, singular, plural] — the title is used in link labels, the
   singular and plural in sentences. */
const NAMES = {
  length: {
    ang: ['Angstrom', 'angstrom', 'angstroms'],
    nm: ['Nanometre', 'nanometre', 'nanometres'],
    um: ['Micrometre', 'micrometre', 'micrometres'],
    mm: ['Millimetre', 'millimetre', 'millimetres'],
    cm: ['Centimetre', 'centimetre', 'centimetres'],
    m: ['Metre', 'metre', 'metres'],
    km: ['Kilometre', 'kilometre', 'kilometres'],
    in: ['Inch', 'inch', 'inches'],
    ft: ['Foot', 'foot', 'feet'],
    yd: ['Yard', 'yard', 'yards'],
    fath: ['Fathom', 'fathom', 'fathoms'],
    chain: ['Chain', 'chain', 'chains'],
    fur: ['Furlong', 'furlong', 'furlongs'],
    mi: ['Mile', 'mile', 'miles'],
    nmi: ['Nautical Mile', 'nautical mile', 'nautical miles'],
    au: ['Astronomical Unit', 'astronomical unit', 'astronomical units'],
    ly: ['Light Year', 'light year', 'light years'],
    pc: ['Parsec', 'parsec', 'parsecs']
  },
  mass: {
    mg: ['Milligram', 'milligram', 'milligrams'],
    g: ['Gram', 'gram', 'grams'],
    kg: ['Kilogram', 'kilogram', 'kilograms'],
    t: ['Tonne', 'tonne', 'tonnes'],
    oz: ['Ounce', 'ounce', 'ounces'],
    lb: ['Pound', 'pound', 'pounds'],
    st: ['Stone', 'stone', 'stone'],
    ton: ['US Short Ton', 'US short ton', 'US short tons'],
    lt: ['UK Long Ton', 'UK long ton', 'UK long tons']
  },
  temperature: {
    C: ['Celsius', 'degree Celsius', 'degrees Celsius'],
    F: ['Fahrenheit', 'degree Fahrenheit', 'degrees Fahrenheit'],
    K: ['Kelvin', 'kelvin', 'kelvins'],
    R: ['Rankine', 'degree Rankine', 'degrees Rankine'],
    Re: ['Réaumur', 'degree Réaumur', 'degrees Réaumur'],
    De: ['Delisle', 'degree Delisle', 'degrees Delisle'],
    N: ['Newton', 'degree Newton', 'degrees Newton'],
    Ro: ['Rømer', 'degree Rømer', 'degrees Rømer']
  },
  volume: {
    ml: ['Millilitre', 'millilitre', 'millilitres'],
    l: ['Litre', 'litre', 'litres'],
    m3: ['Cubic Metre', 'cubic metre', 'cubic metres'],
    tsp: ['US Teaspoon', 'US teaspoon', 'US teaspoons'],
    tbsp: ['US Tablespoon', 'US tablespoon', 'US tablespoons'],
    floz: ['US Fluid Ounce', 'US fluid ounce', 'US fluid ounces'],
    cup: ['US Cup', 'US cup', 'US cups'],
    pt: ['US Pint', 'US pint', 'US pints'],
    qt: ['US Quart', 'US quart', 'US quarts'],
    gal: ['US Gallon', 'US gallon', 'US gallons'],
    galuk: ['Imperial Gallon', 'imperial gallon', 'imperial gallons'],
    ft3: ['Cubic Foot', 'cubic foot', 'cubic feet']
  },
  area: {
    mm2: ['Square Millimetre', 'square millimetre', 'square millimetres'],
    cm2: ['Square Centimetre', 'square centimetre', 'square centimetres'],
    m2: ['Square Metre', 'square metre', 'square metres'],
    ha: ['Hectare', 'hectare', 'hectares'],
    km2: ['Square Kilometre', 'square kilometre', 'square kilometres'],
    in2: ['Square Inch', 'square inch', 'square inches'],
    ft2: ['Square Foot', 'square foot', 'square feet'],
    yd2: ['Square Yard', 'square yard', 'square yards'],
    acre: ['Acre', 'acre', 'acres'],
    mi2: ['Square Mile', 'square mile', 'square miles']
  },
  time: {
    ms: ['Millisecond', 'millisecond', 'milliseconds'],
    s: ['Second', 'second', 'seconds'],
    min: ['Minute', 'minute', 'minutes'],
    h: ['Hour', 'hour', 'hours'],
    day: ['Day', 'day', 'days'],
    week: ['Week', 'week', 'weeks'],
    mo: ['Month (average)', 'average month', 'average months'],
    yr: ['Year (Julian)', 'Julian year', 'Julian years']
  },
  speed: {
    mps: ['Metres per Second', 'metre per second', 'metres per second'],
    kph: ['Kilometres per Hour', 'kilometre per hour', 'kilometres per hour'],
    mph: ['Miles per Hour', 'mile per hour', 'miles per hour'],
    fps: ['Feet per Second', 'foot per second', 'feet per second'],
    knot: ['Knot', 'knot', 'knots'],
    mach: ['Mach (sea level)', 'Mach', 'Mach']
  },
  pressure: {
    Pa: ['Pascal', 'pascal', 'pascals'],
    kPa: ['Kilopascal', 'kilopascal', 'kilopascals'],
    MPa: ['Megapascal', 'megapascal', 'megapascals'],
    bar: ['Bar', 'bar', 'bar'],
    mbar: ['Millibar', 'millibar', 'millibars'],
    psi: ['PSI', 'psi', 'psi'],
    atm: ['Atmosphere', 'standard atmosphere', 'standard atmospheres'],
    torr: ['Torr', 'torr', 'torr'],
    inHg: ['Inch of Mercury', 'inch of mercury', 'inches of mercury']
  },
  energy: {
    J: ['Joule', 'joule', 'joules'],
    kJ: ['Kilojoule', 'kilojoule', 'kilojoules'],
    cal: ['Calorie', 'calorie', 'calories'],
    kcal: ['Kilocalorie', 'kilocalorie', 'kilocalories'],
    Wh: ['Watt-hour', 'watt-hour', 'watt-hours'],
    kWh: ['Kilowatt-hour', 'kilowatt-hour', 'kilowatt-hours'],
    BTU: ['BTU', 'British thermal unit', 'British thermal units'],
    eV: ['Electronvolt', 'electronvolt', 'electronvolts'],
    ftlb: ['Foot-pound', 'foot-pound', 'foot-pounds']
  },
  power: {
    mW: ['Milliwatt', 'milliwatt', 'milliwatts'],
    W: ['Watt', 'watt', 'watts'],
    kW: ['Kilowatt', 'kilowatt', 'kilowatts'],
    MW: ['Megawatt', 'megawatt', 'megawatts'],
    hp: ['Horsepower', 'mechanical horsepower', 'mechanical horsepower'],
    hpM: ['Metric Horsepower', 'metric horsepower', 'metric horsepower'],
    btuh: ['BTU per Hour', 'BTU per hour', 'BTU per hour']
  },
  data: {
    bit: ['Bit', 'bit', 'bits'],
    B: ['Byte', 'byte', 'bytes'],
    KB: ['Kilobyte', 'kilobyte', 'kilobytes'],
    MB: ['Megabyte', 'megabyte', 'megabytes'],
    GB: ['Gigabyte', 'gigabyte', 'gigabytes'],
    TB: ['Terabyte', 'terabyte', 'terabytes'],
    KiB: ['Kibibyte', 'kibibyte', 'kibibytes'],
    MiB: ['Mebibyte', 'mebibyte', 'mebibytes'],
    GiB: ['Gibibyte', 'gibibyte', 'gibibytes'],
    TiB: ['Tebibyte', 'tebibyte', 'tebibytes']
  },
  angle: {
    rad: ['Radian', 'radian', 'radians'],
    deg: ['Degree', 'degree', 'degrees'],
    grad: ['Gradian', 'gradian', 'gradians'],
    turn: ['Turn', 'turn', 'turns'],
    arcmin: ['Arcminute', 'arcminute', 'arcminutes'],
    arcsec: ['Arcsecond', 'arcsecond', 'arcseconds']
  }
};

/* The order the families appear in, and in each family the units people
   reach for first. Units not listed follow in the bundle's own order. */
const FAMILY_ORDER = ['length', 'mass', 'temperature', 'volume', 'area', 'time', 'speed', 'pressure', 'energy', 'power', 'data', 'angle'];

const UNIT_ORDER = {
  length: ['in', 'cm', 'ft', 'm', 'mi', 'km', 'mm', 'yd', 'nmi'],
  mass: ['kg', 'lb', 'g', 'oz', 'st', 't', 'mg', 'ton', 'lt'],
  temperature: ['C', 'F', 'K', 'R'],
  volume: ['l', 'ml', 'gal', 'floz', 'cup', 'tbsp', 'tsp', 'galuk', 'pt', 'qt', 'm3', 'ft3'],
  area: ['m2', 'ft2', 'acre', 'ha', 'km2', 'mi2', 'cm2', 'in2', 'yd2', 'mm2'],
  time: ['s', 'min', 'h', 'day', 'week', 'ms', 'mo', 'yr'],
  speed: ['kph', 'mph', 'mps', 'knot', 'fps', 'mach'],
  pressure: ['bar', 'psi', 'kPa', 'atm', 'Pa', 'mbar', 'MPa', 'inHg', 'torr'],
  energy: ['kWh', 'J', 'kJ', 'kcal', 'cal', 'BTU', 'Wh', 'ftlb', 'eV'],
  power: ['kW', 'W', 'hp', 'hpM', 'btuh', 'MW', 'mW'],
  data: ['MB', 'GB', 'KB', 'TB', 'B', 'bit', 'MiB', 'GiB', 'KiB', 'TiB'],
  angle: ['deg', 'rad', 'turn', 'grad', 'arcmin', 'arcsec']
};

/* How many unit groups start open in a family hub's full list. */
const OPEN_GROUPS = 4;

/* The pairs people search for, most-searched first. The first pair of each
   family is its quick-reference pair. */
const POPULAR = {
  length: [['in', 'cm'], ['cm', 'in'], ['ft', 'm'], ['m', 'ft'], ['mi', 'km'], ['km', 'mi'], ['mm', 'in'], ['in', 'mm'], ['ft', 'cm'], ['cm', 'ft'], ['yd', 'm'], ['m', 'yd']],
  mass: [['kg', 'lb'], ['lb', 'kg'], ['g', 'oz'], ['oz', 'g'], ['st', 'kg'], ['kg', 'st'], ['st', 'lb'], ['lb', 'st'], ['oz', 'lb'], ['mg', 'g']],
  temperature: [['C', 'F'], ['F', 'C'], ['C', 'K'], ['K', 'C'], ['F', 'K'], ['K', 'F']],
  volume: [['l', 'gal'], ['gal', 'l'], ['ml', 'floz'], ['floz', 'ml'], ['cup', 'ml'], ['ml', 'cup'], ['l', 'floz'], ['tbsp', 'ml'], ['tsp', 'ml'], ['galuk', 'l']],
  area: [['m2', 'ft2'], ['ft2', 'm2'], ['acre', 'ha'], ['ha', 'acre'], ['km2', 'mi2'], ['mi2', 'km2'], ['acre', 'ft2'], ['yd2', 'm2'], ['in2', 'cm2'], ['ha', 'm2']],
  time: [['s', 'min'], ['min', 's'], ['h', 'min'], ['min', 'h'], ['day', 'h'], ['h', 'day'], ['week', 'day'], ['day', 'week'], ['ms', 's'], ['yr', 'day']],
  speed: [['kph', 'mph'], ['mph', 'kph'], ['mps', 'kph'], ['kph', 'mps'], ['knot', 'kph'], ['kph', 'knot'], ['mph', 'mps'], ['knot', 'mph']],
  pressure: [['bar', 'psi'], ['psi', 'bar'], ['kPa', 'psi'], ['psi', 'kPa'], ['bar', 'kPa'], ['kPa', 'bar'], ['mbar', 'bar'], ['bar', 'mbar'],
    ['MPa', 'bar'], ['bar', 'MPa'], ['MPa', 'psi'], ['psi', 'MPa'], ['kPa', 'MPa'], ['MPa', 'kPa'], ['inHg', 'mbar'], ['mbar', 'inHg'], ['atm', 'psi'], ['atm', 'Pa']],
  energy: [['kcal', 'kJ'], ['kJ', 'kcal'], ['kWh', 'J'], ['kWh', 'BTU'], ['cal', 'J'], ['J', 'cal'], ['cal', 'kJ'], ['Wh', 'J']],
  power: [['hp', 'kW'], ['kW', 'hp'], ['mW', 'W'], ['W', 'mW'], ['W', 'kW'], ['kW', 'W'], ['btuh', 'W'], ['W', 'btuh'], ['btuh', 'kW'], ['kW', 'btuh'],
    ['hpM', 'kW'], ['kW', 'hpM'], ['hp', 'W'], ['MW', 'kW']],
  data: [['MB', 'GB'], ['GB', 'MB'], ['GB', 'TB'], ['TB', 'GB'], ['KB', 'MB'], ['MB', 'KB'], ['GB', 'GiB'], ['GiB', 'GB'], ['TB', 'TiB'], ['B', 'bit']],
  angle: [['deg', 'rad'], ['rad', 'deg'], ['turn', 'deg'], ['deg', 'arcmin'], ['arcmin', 'deg'], ['grad', 'deg']]
};

/* The /conversions/ hub's "Most-used conversions", across families. */
const TOP = [
  ['length', 'in', 'cm'], ['length', 'cm', 'in'], ['length', 'ft', 'm'], ['length', 'm', 'ft'],
  ['length', 'mi', 'km'], ['length', 'km', 'mi'], ['mass', 'kg', 'lb'], ['mass', 'lb', 'kg'],
  ['temperature', 'C', 'F'], ['temperature', 'F', 'C'], ['mass', 'st', 'kg'], ['mass', 'g', 'oz'],
  ['mass', 'oz', 'g'], ['length', 'mm', 'in'], ['volume', 'l', 'gal'], ['volume', 'ml', 'floz'],
  ['volume', 'cup', 'ml'], ['area', 'm2', 'ft2'], ['area', 'acre', 'ha'], ['speed', 'kph', 'mph'],
  ['speed', 'mph', 'kph'], ['data', 'MB', 'GB'], ['pressure', 'bar', 'psi'], ['power', 'hp', 'kW']
];

/* Values for a pair page's table, by from-unit, where a generic 1, 2, 3 …
   would not be what anybody converts. Used only when every row stays
   readable; otherwise the generic list is scaled to the pair. */
const TABLE_VALUES = {
  temperature: {
    C: [-40, -30, -20, -10, -5, 0, 5, 10, 15, 20, 25, 30, 37, 40, 50, 60, 80, 100],
    F: [-40, 0, 10, 20, 32, 40, 50, 60, 70, 80, 90, 98.6, 100, 150, 200, 212, 350, 400],
    K: [0, 100, 200, 233.15, 250, 273.15, 283.15, 293.15, 300, 310.15, 323.15, 350, 373.15, 400, 500, 1000],
    R: [0, 100, 200, 300, 400, 459.67, 491.67, 500, 527.67, 600, 671.67, 800, 1000],
    '*': [-40, -20, -10, 0, 10, 20, 30, 40, 50, 60, 80, 100]
  },
  time: {
    ms: [1, 5, 10, 20, 50, 100, 200, 250, 500, 750, 1000, 1500, 2000, 5000, 10000, 60000],
    s: [1, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1800, 3600],
    min: [1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 720, 1440],
    h: [1, 2, 3, 4, 6, 8, 12, 18, 24, 36, 48, 72, 96, 120, 168, 720],
    day: [1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 28, 30, 60, 90, 180, 365],
    week: [1, 2, 3, 4, 5, 6, 8, 10, 12, 13, 16, 20, 26, 39, 40, 52]
  },
  speed: {
    kph: [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130],
    mph: [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130]
  },
  angle: {
    deg: [1, 5, 10, 15, 30, 45, 60, 90, 120, 135, 150, 180, 225, 270, 315, 360]
  },
  data: {
    KiB: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000, 1024],
    MiB: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000, 1024],
    GiB: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000, 1024],
    TiB: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000, 1024]
  }
};
const GENERIC_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 25, 50, 100, 500, 1000];

/* The worked example on a temperature page, by from-unit. */
const TEMP_EXAMPLE = { C: 25, F: 98.6, K: 300, R: 500, Re: 20, De: 50, N: 10, Ro: 20 };

/* What the quantity is called in a sentence ("multiply the length by …"). */
const QUANTITY = {
  length: 'length', mass: 'weight', temperature: 'temperature', volume: 'volume', area: 'area',
  time: 'duration', speed: 'speed', pressure: 'pressure', energy: 'energy', power: 'power',
  data: 'size', angle: 'angle'
};
/* The family in a heading: "Popular length conversions". */
const NOUN = {
  length: 'length', mass: 'weight', temperature: 'temperature', volume: 'volume', area: 'area',
  time: 'time', speed: 'speed', pressure: 'pressure', energy: 'energy', power: 'power',
  data: 'data storage', angle: 'angle'
};

/* Quick reference: the family's top pair at everyday values. */
const QUICK = {
  length: [1, 2, 3, 4, 5, 6, 8, 10, 12, 36],
  mass: [1, 2, 5, 10, 20, 50, 60, 70, 80, 100],
  temperature: [-40, -10, 0, 10, 20, 25, 30, 37, 40, 100],
  volume: [1, 2, 3, 4, 5, 10, 20, 50, 100, 200],
  area: [1, 5, 10, 20, 25, 50, 75, 100, 150, 200],
  time: [30, 60, 90, 120, 180, 300, 600, 900, 1800, 3600],
  speed: [10, 20, 30, 40, 50, 60, 70, 80, 100, 120],
  pressure: [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 10, 200],
  energy: [1, 50, 100, 200, 250, 500, 1000, 1500, 2000, 2500],
  power: [1, 5, 10, 50, 100, 150, 200, 300, 400, 500],
  data: [1, 10, 100, 250, 500, 700, 1000, 1500, 2000, 5000],
  angle: [0, 15, 30, 45, 60, 90, 120, 180, 270, 360]
};

/* What each family measures. Facts only; British English. */
const ABOUT = {
  length: 'Length is the distance between two points. The SI unit is the metre (m), defined since 1983 by the distance light travels in a vacuum in 1/299,792,458 of a second. Metric units step by powers of ten: a kilometre is 1,000 m, and a metre is 100 cm or 1,000 mm. The imperial and US customary units were redefined against the metre in 1959: the international inch is exactly 2.54 cm, so a foot (12 in) is exactly 0.3048 m, a yard (3 ft) is 0.9144 m and a mile (1,760 yd) is 1,609.344 m. The UK still signs roads in miles and often gives heights in feet and inches; most of the world uses metric units for everything. The nautical mile, exactly 1,852 m, is used at sea and in the air, and the astronomical unit, light year and parsec measure distances in space.',
  mass: 'Mass is the amount of matter in something. In everyday speech it is called weight, and kitchen and bathroom scales are marked in units of mass. The SI unit is the kilogram (kg), defined since 2019 by fixing the value of the Planck constant; a gram is a thousandth of a kilogram and a tonne is 1,000 kg. The avoirdupois pound used in the UK and the US is defined as exactly 0.45359237 kg and is divided into 16 ounces, so an ounce is about 28.35 g. In the UK, body weight is often given in stones and pounds: a stone is 14 lb, about 6.35 kg. Two older tons survive beside the metric tonne: the US short ton of 2,000 lb and the UK long ton of 2,240 lb, so "ton" always needs to be pinned down before converting.',
  temperature: 'Temperature measures how hot or cold something is. The SI unit is the kelvin (K), an absolute scale that starts at absolute zero; since 2019 it is defined by fixing the Boltzmann constant. The Celsius scale uses degrees of the same size but starts 273.15 lower, so 0 °C is 273.15 K. Water freezes at 0 °C and boils at about 100 °C at sea level. The Fahrenheit scale, still used for weather and cooking in the US, puts those points at 32 °F and 212 °F, so 180 Fahrenheit degrees span the same range as 100 Celsius degrees, which is where the factor 9/5 comes from. Because the scales have different zero points, converting a temperature needs an offset as well as a ratio, while converting a temperature difference needs only the ratio. Rankine is the absolute form of Fahrenheit; Réaumur, Delisle, Newton and Rømer are historical scales.',
  volume: 'Volume is the amount of space something takes up; capacity is the same measure for a container. The SI unit is the cubic metre (m³), but the everyday metric unit is the litre, one cubic decimetre: a litre is 1,000 mL and a cubic metre is 1,000 L. The US customary kitchen and liquid measures build on each other: 3 teaspoons make a tablespoon, 2 tablespoons a fluid ounce, 8 fluid ounces a cup, 2 cups a pint, 2 pints a quart and 4 quarts a gallon of 231 cubic inches, exactly 3.785411784 L. The imperial gallon used in the UK is bigger, exactly 4.54609 L, so a "gallon" always needs its country. Cubic feet are used for gas, storage and room volumes. The cup and spoon measures here are the US ones; recipes from other countries may use different sizes, such as the 250 mL metric cup or the 20 mL Australian tablespoon.',
  area: 'Area measures the size of a surface. The SI unit is the square metre (m²), the area of a square one metre on each side. Because area is a length squared, an area factor is the square of the length factor: a metre is 100 cm, so a square metre is 10,000 cm², and a foot is 0.3048 m, so a square foot is 0.09290304 m². Land is measured in hectares in most of the world and in acres in the UK and the US. A hectare is 10,000 m², a square 100 m on each side; an acre is 43,560 square feet, about 4,047 m² or 0.405 ha. Floor space is quoted in square metres or square feet depending on the country, and large regions in square kilometres or square miles; a square mile is exactly 640 acres, about 2.59 km².',
  time: 'Time is measured in seconds, the SI base unit, defined by a fixed number of oscillations of the caesium-133 atom: 9,192,631,770 of them make one second. Minutes, hours and days are not powers of ten: 60 seconds make a minute, 60 minutes an hour and 24 hours a day, so a day is 86,400 seconds and a week is 604,800. Months and years vary in length, so a converter has to use an average. The year here is the Julian year of 365.25 days, the average over a four-year leap cycle and the year astronomers use; the month is one twelfth of it, 30.4375 days. A millisecond is a thousandth of a second, the unit of computer timings and reaction times. For calendar sums with real dates, leap years and time zones, a date calculator is the better tool.',
  speed: 'Speed is distance travelled per unit of time. The SI unit is the metre per second (m/s). Road speeds are given in kilometres per hour in most countries and in miles per hour in the UK and the US. A metre per second is exactly 3.6 km/h, and a mile per hour is exactly 1.609344 km/h because the mile is defined as 1,609.344 m. Ships and aircraft use the knot, one nautical mile per hour, which is exactly 1.852 km/h or about 1.151 mph. Feet per second appear in ballistics and engineering. Mach gives a speed as a multiple of the speed of sound, which depends on the temperature of the air; this converter uses 340.29 m/s, the standard value at sea level, so treat Mach figures for high altitude as approximate.',
  pressure: 'Pressure is force spread over an area. The SI unit is the pascal (Pa), one newton per square metre. It is a small unit, so kilopascals and megapascals are common. The bar is exactly 100,000 Pa, close to the air pressure at sea level, and weather maps use the millibar, which is the same as the hectopascal. The standard atmosphere (atm) is defined as exactly 101,325 Pa. Tyre pressures and many gauges in the UK and the US read in pounds per square inch (psi); a psi is about 6.895 kPa, and a bar is about 14.5 psi. The torr is exactly 1/760 of a standard atmosphere and is almost the same as the millimetre of mercury used for blood pressure. Inches of mercury survive in aviation for altimeter settings and in US weather reports.',
  energy: 'Energy is the capacity to do work. The SI unit is the joule (J), the work done by a force of one newton moving through one metre. Electricity is billed in kilowatt-hours: a kilowatt-hour is the energy of 1 kW used for one hour, exactly 3.6 million joules. Food energy is given in kilocalories and kilojoules; the "Calories" on a US food label are kilocalories, and one kilocalorie is 4.184 kJ using the thermochemical calorie this converter uses. Boilers, heaters and gas in the UK and the US are often measured in British thermal units; a BTU is about 1,055 J, roughly the energy needed to warm a pound of water by one degree Fahrenheit. The electronvolt is the tiny unit of atomic and particle physics, and the foot-pound is the unit of work in imperial engineering.',
  power: 'Power is the rate at which energy is used or delivered. The SI unit is the watt (W), one joule per second; a kilowatt is 1,000 W and a megawatt is a million. Phone chargers and light bulbs are rated in watts, kettles, heaters and car engines in kilowatts, and power stations in megawatts. Engines are still often quoted in horsepower, and there are two: the mechanical or imperial horsepower is about 745.7 W, while the metric horsepower (PS, also written cv or ch) is exactly 735.49875 W, so the figures are not interchangeable. Air conditioners and heaters in the US are rated in BTU per hour; 1,000 BTU/h is about 293 W. Power is not energy: a 2 kW heater running for three hours uses 6 kWh.',
  data: 'Digital storage is counted in bits and bytes. A bit is a single binary digit, 0 or 1, and a byte is 8 bits. Bigger units come in two families. The decimal SI prefixes step by 1,000: a kilobyte (KB) is 1,000 bytes, a megabyte (MB) a million and a gigabyte (GB) a billion; drive makers, macOS and iOS count this way. The binary IEC prefixes step by 1,024: a kibibyte (KiB) is 1,024 bytes, a mebibyte (MiB) 1,048,576 and a gibibyte (GiB) 1,073,741,824. Windows counts in binary units but labels them KB, MB and GB, which is why a 1 TB drive shows as about 931 GB there. Network speeds are quoted in bits per second, so divide by 8 to compare a download speed with a file size in bytes.',
  angle: 'An angle measures an amount of turn. The SI unit is the radian (rad): the angle at the centre of a circle that cuts off an arc as long as the radius, so a full turn is 2π radians. Degrees divide a full turn into 360, so π radians is 180° and one radian is 180/π, about 57.2958°. Each degree is split into 60 arcminutes and each arcminute into 60 arcseconds, the units of astronomy, navigation and map coordinates. The gradian, also called the gon, divides a right angle into 100, so a full turn is 400 grad; it is used in surveying and appears as GRAD mode on scientific calculators. Most programming languages and spreadsheet trigonometry functions work in radians, so convert degrees before calling sin or cos.'
};

/* Real tool pages that do something next to each family. Asserted to exist. */
const RELATED = {
  length: [
    ['/utilities/square-footage/', 'Floor area of a room, including L-shaped rooms'],
    ['/mathematics/geometry-calculator/', 'Area, perimeter and volume of 2D and 3D shapes'],
    ['/design/aspect-ratio/', 'Scale an image or screen size in proportion'],
    ['/utilities/shoe-size-converter/', 'UK, US, EU and Japanese sizes and foot length in cm'],
    ['/health/bmi/', 'Body mass index from height and weight']
  ],
  mass: [
    ['/health/bmi/', 'Body mass index from height and weight'],
    ['/health/ideal-weight/', 'A reference weight range for a height'],
    ['/utilities/cooking-converter/', 'Cups, spoons, grams and ounces for common ingredients'],
    ['/health/bmr-tdee/', 'Daily energy needs from weight, height and activity']
  ],
  temperature: [
    ['/utilities/cooking-converter/', 'Cups, spoons, grams and ounces for recipes'],
    ['/mathematics/scientific-calculator/', 'Work out a formula with powers, roots and constants']
  ],
  volume: [
    ['/utilities/cooking-converter/', 'Cups, spoons, millilitres and grams for common ingredients'],
    ['/mathematics/geometry-calculator/', 'Volume of a box, cylinder, sphere and more'],
    ['/utilities/fuel-efficiency/', 'MPG to L/100 km, and the fuel cost of a trip'],
    ['/health/water-intake/', 'A rough guide to daily fluid needs']
  ],
  area: [
    ['/utilities/square-footage/', 'Floor area, materials and cost for a room'],
    ['/mathematics/geometry-calculator/', 'Area and perimeter of common shapes']
  ],
  time: [
    ['/time/date-difference/', 'Days, weeks and months between two dates'],
    ['/time/date-add-subtract/', 'Add or take away days, weeks or months'],
    ['/time/timezone-converter/', 'A time in another time zone'],
    ['/time/stopwatch-timer/', 'Stopwatch, countdown timer and Pomodoro']
  ],
  speed: [
    ['/utilities/fuel-efficiency/', 'MPG to L/100 km, and the fuel cost of a trip'],
    ['/mathematics/scientific-calculator/', 'Distance, time and speed sums']
  ],
  pressure: [
    ['/mathematics/scientific-calculator/', 'Powers, roots and constants for pressure sums']
  ],
  energy: [
    ['/health/bmr-tdee/', 'Daily energy needs in kilocalories'],
    ['/engineering/ohms-law/', 'Voltage, current, resistance and power'],
    ['/mathematics/scientific-calculator/', 'Powers, roots and constants']
  ],
  power: [
    ['/engineering/ohms-law/', 'Voltage, current, resistance and power from any two'],
    ['/mathematics/scientific-calculator/', 'Powers, roots and constants']
  ],
  data: [
    ['/image/image-compressor/', 'Make JPEG, PNG and WebP files smaller'],
    ['/image/bulk-image-resizer/', 'Resize many images at once'],
    ['/mathematics/number-base-converter/', 'Binary, octal, decimal and hexadecimal']
  ],
  angle: [
    ['/mathematics/scientific-calculator/', 'Trigonometry in degrees or radians'],
    ['/mathematics/geometry-calculator/', 'Shapes, areas and perimeters']
  ]
};

/* Pages the family hub links to beside RELATED, by [href, label, what it
   does]. Unlike RELATED these are not read from the search index, so a guide
   can be named, and a page that is not built yet can be: build-conversions.js
   writes the link and says in its run that the page is missing. */
const PRESSURE_GUIDE = '/guides/convert-pressure-units/';
const GAUGE_TOOL = '/engineering/gauge-absolute-pressure/';
const LINKS = {
  pressure: [
    [GAUGE_TOOL, 'Gauge to absolute pressure converter', 'psig to psia and barg to bara, and back'],
    [PRESSURE_GUIDE, 'Guide: pressure units, and gauge vs absolute', 'What psi, bar, kPa, mbar, atm and mmHg are for, with the exact factors']
  ]
};

/* A second table on chosen pair pages, under the formula and its table:
   whole input values that people look up as a set, each converted by the
   converter's own arithmetic and rounded as `cols` says ([unit, decimals]).
   `pages` are the pairs that carry it; `note(h)` is written from the data,
   like the FAQ; `links` are [href, label], written even before the page is
   built, like LINKS. */
const EXTRA = {
  pressure: [{
    id: 'tyre',
    pages: [['psi', 'bar'], ['bar', 'psi'], ['psi', 'kPa'], ['kPa', 'psi']],
    heading: 'Tyre pressures: psi to bar and kPa',
    caption: 'Tyre pressures from 26 to 45 psi, with bar to 2 decimal places and kPa to the nearest whole number',
    from: 'psi',
    values: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45],
    cols: [['bar', 2], ['kPa', 0]],
    note: (h) => 'Tyre pressures are gauge pressures: a tyre gauge shows how far the pressure inside is above the air around it, so a flat tyre reads 0. The absolute pressure is that plus the atmosphere: one standard atmosphere is ' + h.c(1, 'atm', 'psi') + ' (' + h.c(1, 'atm', 'kPa') + '), and the real figure varies with the weather and the altitude. These rows are conversions, not recommendations: use the pressures in your vehicle’s handbook or on the label in the door frame.',
    links: [[GAUGE_TOOL, 'Convert gauge to absolute pressure'], [PRESSURE_GUIDE, 'Guide: pressure units, and gauge vs absolute']]
  }]
};

/* The questions people ask, answered from the data. */
const FAQ = {
  length: [
    ['How many centimetres are in an inch?', (h) => 'One inch is exactly ' + h.c(1, 'in', 'cm') + '. The international inch has been defined as 2.54 cm since 1959, so this conversion is exact.'],
    ['How many feet are in a metre?', (h) => 'One metre is ' + h.c(1, 'm', 'ft') + ', or 3 ft ' + h.n(h.x(1, 'm', 'in') - 36) + ' in. Going the other way, a foot is exactly ' + h.c(1, 'ft', 'm') + '.'],
    ['How do I convert miles to kilometres?', (h) => 'Multiply by 1.609344, the exact number of kilometres in a mile. 10 miles is ' + h.c(10, 'mi', 'km') + ', and 100 km is ' + h.c(100, 'km', 'mi') + '.'],
    ['What is 5 feet 10 inches in centimetres?', (h) => h.n(h.x(5, 'ft', 'cm') + h.x(10, 'in', 'cm')) + ' cm: 5 ft is ' + h.c(5, 'ft', 'cm') + ' and 10 in is ' + h.c(10, 'in', 'cm') + '. For any height, multiply the feet by 30.48 and the inches by 2.54, then add them.'],
    ['How many millimetres are in an inch?', (h) => 'Exactly ' + h.c(1, 'in', 'mm') + '. A millimetre is ' + h.c(1, 'mm', 'in') + '.']
  ],
  mass: [
    ['How many pounds are in a kilogram?', (h) => 'One kilogram is ' + h.c(1, 'kg', 'lb') + '. A pound is ' + h.c(1, 'lb', 'kg') + ', exactly 0.45359237 kg by definition.'],
    ['How many kilograms are in a stone?', (h) => 'A stone is 14 lb, which is ' + h.c(1, 'st', 'kg') + '. So 10 stone is ' + h.c(10, 'st', 'kg') + '.'],
    ['How many grams are in an ounce?', (h) => 'An ounce, the avoirdupois ounce used for food, is ' + h.c(1, 'oz', 'g') + ', and there are 16 in a pound. 100 g is ' + h.c(100, 'g', 'oz') + '. Precious metals use the heavier troy ounce, which is not this one.'],
    ['How do I convert kilograms to stones and pounds?', (h) => { const lb = h.x(70, 'kg', 'lb'); const st = Math.floor(lb / 14); return 'Convert to pounds, then take 14 lb out for every stone. 70 kg is ' + h.n(lb) + ' lb, which is ' + st + ' st ' + h.n(lb - st * 14) + ' lb.'; }],
    ['How many pounds are in a ton?', (h) => 'It depends on the ton. A US short ton is ' + h.c(1, 'ton', 'lb') + ', a UK long ton is ' + h.c(1, 'lt', 'lb') + ', and a metric tonne of 1,000 kg is ' + h.c(1, 't', 'lb') + '.']
  ],
  temperature: [
    ['How do I convert Celsius to Fahrenheit?', (h) => 'Multiply by 9/5 (1.8) and add 32. 20 °C is ' + h.c(20, 'C', 'F') + ', and 37 °C is ' + h.c(37, 'C', 'F') + '.'],
    ['How do I convert Fahrenheit to Celsius?', (h) => 'Take away 32, then multiply by 5/9. 100 °F is ' + h.c(100, 'F', 'C') + ', and 350 °F, a common oven setting, is ' + h.c(350, 'F', 'C') + '.'],
    ['At what temperature are Celsius and Fahrenheit the same?', (h) => 'At minus 40: ' + h.v(-40, 'C') + ' is ' + h.c(-40, 'C', 'F') + '. It is the only point where the two scales meet.'],
    ['How do I convert Celsius to kelvin?', (h) => 'Add 273.15. 0 °C is ' + h.c(0, 'C', 'K') + ' and 25 °C is ' + h.c(25, 'C', 'K') + '. Absolute zero, 0 K, is ' + h.c(0, 'K', 'C') + '.'],
    ['What is body temperature in Fahrenheit?', (h) => 'The usual figure, 37 °C, is ' + h.c(37, 'C', 'F') + '. A fever is generally taken to start at 38 °C, which is ' + h.c(38, 'C', 'F') + '.']
  ],
  volume: [
    ['How many millilitres are in a cup?', (h) => 'A US cup is ' + h.c(1, 'cup', 'ml') + ', which is 8 US fluid ounces or ' + h.n(h.x(1, 'cup', 'tbsp')) + ' tablespoons. Recipes from Australia, New Zealand and Canada often use a 250 mL metric cup instead.'],
    ['How many litres are in a gallon?', (h) => 'A US gallon is ' + h.c(1, 'gal', 'l') + ' and an imperial (UK) gallon is ' + h.c(1, 'galuk', 'l') + '. An imperial gallon is ' + h.c(1, 'galuk', 'gal') + '.'],
    ['How many millilitres are in a fluid ounce?', (h) => 'A US fluid ounce is ' + h.c(1, 'floz', 'ml') + ', so 100 mL is ' + h.c(100, 'ml', 'floz') + '. The UK fluid ounce is slightly smaller.'],
    ['How many tablespoons are in a cup?', (h) => h.n(h.x(1, 'cup', 'tbsp')) + ' US tablespoons. A tablespoon is 3 teaspoons, so a cup is also ' + h.n(h.x(1, 'cup', 'tsp')) + ' teaspoons.'],
    ['How many litres are in a cubic metre?', (h) => h.n(h.x(1, 'm3', 'l')) + ' litres. A litre is a cubic decimetre, a cube 10 cm on each side.']
  ],
  area: [
    ['How many square feet are in a square metre?', (h) => 'One square metre is ' + h.c(1, 'm2', 'ft2') + '. A metre is ' + h.c(1, 'm', 'ft', 'length') + ', and a square metre is that length squared.'],
    ['How many acres are in a hectare?', (h) => 'One hectare is ' + h.c(1, 'ha', 'acre') + ', and one acre is ' + h.c(1, 'acre', 'ha') + '.'],
    ['How many square feet are in an acre?', (h) => 'Exactly ' + h.c(1, 'acre', 'ft2') + '. In metric units an acre is ' + h.c(1, 'acre', 'm2') + '.'],
    ['How do I convert square feet to square metres?', (h) => 'Multiply by 0.09290304, which is exact, or divide by about 10.764. A 200 sq ft room is ' + h.c(200, 'ft2', 'm2') + '.'],
    ['How many square kilometres are in a square mile?', (h) => 'One square mile is ' + h.c(1, 'mi2', 'km2') + '. It is also exactly ' + h.c(1, 'mi2', 'acre') + '.']
  ],
  time: [
    ['How many seconds are in a day?', (h) => h.n(h.x(1, 'day', 's')) + ' seconds: 24 hours of 60 minutes of 60 seconds.'],
    ['How many minutes are in a day?', (h) => h.n(h.x(1, 'day', 'min')) + ' minutes, and ' + h.n(h.x(1, 'week', 'min')) + ' in a week.'],
    ['How many hours are in a week?', (h) => h.n(h.x(1, 'week', 'h')) + ' hours: 7 days of 24 hours.'],
    ['How many days are in a year?', (h) => 'A calendar year has 365 days, or 366 in a leap year. This converter uses the Julian year, the average over a four-year leap cycle: 1 yr = ' + h.c(1, 'yr', 'day') + '.'],
    ['How many weeks are in a year?', (h) => h.c(1, 'yr', 'week') + ' in a Julian year of 365.25 days. A 365-day calendar year is 52 weeks and 1 day.']
  ],
  speed: [
    ['How do I convert km/h to mph?', (h) => 'Divide by 1.609344, the number of kilometres in a mile. 100 km/h is ' + h.c(100, 'kph', 'mph') + ', and 50 km/h is ' + h.c(50, 'kph', 'mph') + '.'],
    ['How do I convert mph to km/h?', (h) => 'Multiply by 1.609344. 30 mph is ' + h.c(30, 'mph', 'kph') + ', and 70 mph is ' + h.c(70, 'mph', 'kph') + '.'],
    ['How do I convert m/s to km/h?', (h) => 'Multiply by 3.6: an hour is 3,600 seconds and a kilometre is 1,000 metres. 10 m/s is ' + h.c(10, 'mps', 'kph') + '.'],
    ['How fast is a knot?', (h) => 'A knot is one nautical mile per hour: exactly ' + h.c(1, 'knot', 'kph') + ', or ' + h.c(1, 'knot', 'mph') + '.'],
    ['What is Mach 1 in km/h?', (h) => 'This converter uses the speed of sound at sea level in standard conditions, 340.29 m/s, so Mach 1 is ' + h.c(1, 'mach', 'kph') + ' (' + h.c(1, 'mach', 'mph') + '). Sound travels more slowly in colder air, so Mach 1 is slower at cruising altitude.']
  ],
  pressure: [
    ['How many psi is 1 bar?', (h) => 'One bar is ' + h.c(1, 'bar', 'psi') + ', and 1 psi is ' + h.c(1, 'psi', 'bar') + '.'],
    ['How do I convert psi to kPa?', (h) => 'Multiply by about 6.895. A tyre at 32 psi is ' + h.c(32, 'psi', 'kPa') + ', or ' + h.c(32, 'psi', 'bar') + '.'],
    ['What is standard atmospheric pressure?', (h) => 'One standard atmosphere is defined as exactly ' + h.c(1, 'atm', 'Pa') + ': ' + h.c(1, 'atm', 'bar') + ', ' + h.c(1, 'atm', 'psi') + ' or ' + h.c(1, 'atm', 'inHg') + '.'],
    ['Is a millibar the same as a hectopascal?', (h) => 'Yes. 1 mbar is ' + h.c(1, 'mbar', 'Pa') + ', which is one hectopascal (hPa), so a weather pressure reads the same in either unit.'],
    ['How many kPa is 1 bar?', (h) => 'Exactly ' + h.c(1, 'bar', 'kPa') + ': a bar is ' + h.c(1, 'bar', 'Pa') + '.'],
    ['What do psig, psia, barg and bara mean?', (h) => 'The g is gauge pressure, measured from the pressure of the air around the gauge; the a is absolute pressure, measured from a vacuum. Absolute is gauge plus atmospheric pressure; one standard atmosphere is ' + h.c(1, 'atm', 'psi') + ' or ' + h.c(1, 'atm', 'kPa') + ', and the real figure varies with the weather and the altitude. So with the standard atmosphere, a tyre at 32 psig is about ' + h.n(Math.round((32 + h.x(1, 'atm', 'psi')) * 10) / 10) + ' psia, and 2 barg is about ' + h.n(Math.round((2 + h.x(1, 'atm', 'bar')) * 100) / 100) + ' bara. Tyre and most workshop gauges read gauge pressure.']
  ],
  energy: [
    ['How many joules are in a kilowatt-hour?', (h) => 'Exactly ' + h.c(1, 'kWh', 'J') + ': 1,000 watts for 3,600 seconds.'],
    ['Are food Calories the same as kilocalories?', (h) => 'Yes. The "Calorie" on a food label is a kilocalorie, ' + h.c(1, 'kcal', 'kJ') + '. A 2,000 kcal daily intake is ' + h.c(2000, 'kcal', 'kJ') + '.'],
    ['How do I convert kJ to kcal?', (h) => 'Divide by 4.184. ' + h.v(1000, 'kJ') + ' is ' + h.c(1000, 'kJ', 'kcal') + '.'],
    ['How many BTU are in a kilowatt-hour?', (h) => 'One kilowatt-hour is ' + h.c(1, 'kWh', 'BTU') + ', and one BTU is ' + h.c(1, 'BTU', 'J') + '.'],
    ['What is the difference between a calorie and a kilocalorie?', (h) => 'A kilocalorie is ' + h.c(1, 'kcal', 'cal') + '. The calorie here is the thermochemical calorie, exactly ' + h.c(1, 'cal', 'J') + '.']
  ],
  power: [
    ['How many kilowatts is one horsepower?', (h) => 'One mechanical horsepower is ' + h.c(1, 'hp', 'kW') + '; one metric horsepower (PS) is ' + h.c(1, 'hpM', 'kW') + '.'],
    ['How do I convert kW to hp?', (h) => 'Multiply by about 1.341 for mechanical horsepower, or about 1.36 for metric. A 100 kW engine is ' + h.c(100, 'kW', 'hp') + ', or ' + h.c(100, 'kW', 'hpM') + '.'],
    ['How many watts is 1,000 BTU per hour?', (h) => h.c(1000, 'btuh', 'W') + '. An air conditioner rated at 12,000 BTU/h delivers ' + h.c(12000, 'btuh', 'kW') + ' of cooling.'],
    ['What is the difference between power and energy?', () => 'Power is how fast energy is used; energy is power multiplied by time. A 2 kW heater running for 3 hours uses 6 kWh of energy.'],
    ['How many watts is a milliwatt?', (h) => 'A milliwatt is a thousandth of a watt: 1 mW = ' + h.c(1, 'mW', 'W') + ', so divide milliwatts by 1,000 to get watts. 500 mW is ' + h.c(500, 'mW', 'W') + ', and 1 W is ' + h.c(1, 'W', 'mW') + '. Small outputs are given in milliwatts: in the US, for example, the FDA limits laser pointers to 5 mW of visible light, which is ' + h.c(5, 'mW', 'W') + '.'],
    ['How do I convert dBm to milliwatts?', (h) => 'dBm is power on a decibel scale measured from 1 mW, as radio and Wi-Fi figures are often given: milliwatts = 10 to the power of (dBm ÷ 10). 0 dBm is 1 mW, 10 dBm is 10 mW, 20 dBm is 100 mW and 30 dBm is 1,000 mW, which is ' + h.c(1000, 'mW', 'W') + '. Every 3 dB is close to double: 3 dBm is ' + h.n(Math.pow(10, 0.3)) + ' mW.']
  ],
  data: [
    ['How many MB are in a GB?', (h) => h.n(h.x(1, 'GB', 'MB')) + ' megabytes in a gigabyte, in decimal SI units. In binary units there are ' + h.n(h.x(1, 'GiB', 'MiB')) + ' mebibytes in a gibibyte.'],
    ['Why does a 1 TB drive show less space?', (h) => 'The drive holds a trillion bytes, but Windows divides by 1,024 rather than 1,000 and still calls the result GB: 1 TB is ' + h.c(1, 'TB', 'GiB') + '. Nothing is missing.'],
    ['How many bits are in a byte?', (h) => h.n(h.x(1, 'B', 'bit')) + '. Network speeds are given in bits per second, so a 100 Mbit/s connection moves at most 12.5 MB of data per second.'],
    ['Is a kilobyte 1,000 or 1,024 bytes?', (h) => 'In SI units a kilobyte (KB) is ' + h.c(1, 'KB', 'B') + '. The 1,024-byte unit is properly the kibibyte (KiB), ' + h.c(1, 'KiB', 'B') + ', though many programs still label it KB.'],
    ['How many GB are in a TB?', (h) => h.n(h.x(1, 'TB', 'GB')) + ' GB in a terabyte, or ' + h.n(h.x(1, 'TiB', 'GiB')) + ' GiB in a tebibyte.']
  ],
  angle: [
    ['How do I convert degrees to radians?', (h) => 'Multiply by π/180. 90° is ' + h.c(90, 'deg', 'rad') + ' and 180° is ' + h.c(180, 'deg', 'rad') + ', which is π.'],
    ['How many degrees is one radian?', (h) => 'One radian is ' + h.c(1, 'rad', 'deg') + ', which is 180/π.'],
    ['How many arcminutes are in a degree?', (h) => h.n(h.x(1, 'deg', 'arcmin')) + ' arcminutes, or ' + h.n(h.x(1, 'deg', 'arcsec')) + ' arcseconds.'],
    ['What is a gradian?', (h) => 'A gradian, or gon, is 1/400 of a full turn, so a right angle is 100 grad and one gradian is ' + h.c(1, 'grad', 'deg') + '.']
  ]
};

module.exports = {
  NAMES, FAMILY_ORDER, UNIT_ORDER, OPEN_GROUPS, POPULAR, TOP, TABLE_VALUES, GENERIC_VALUES,
  TEMP_EXAMPLE, QUANTITY, NOUN, QUICK, ABOUT, RELATED, FAQ, LINKS, EXTRA
};
