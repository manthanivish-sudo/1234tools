/**
 * The reading part of the Engineering calculators, rendered by
 * build-depth.js. Shape and rules: build-depth.js and build/content/_check.js.
 * Every figure is computed with the page's own engine (build/content/_engine.js)
 * and listed in worked.check / checks so the check can recompute it.
 */
'use strict';

module.exports = {
  '/engineering/ohms-law/': {
    term: 'Ohm’s law',
    whatIs: [
      'Ohm’s law says the current through a conductor is proportional to the voltage across it: double the voltage across a fixed resistor and the current doubles. The constant linking the two is the resistance, measured in ohms (Ω).',
      'With the power formula it settles most everyday circuit questions: what current a heater draws, how hot a resistor runs, whether a fuse is big enough.'
    ],
    formula: {
      text: 'With any two of voltage, current and resistance, the third follows by rearranging V = I × R. Power, the rate at which energy turns into heat or light, is voltage times current, which can also be written with resistance in place of either.',
      expr: ['V = I × R', 'I = V ÷ R', 'R = V ÷ I', 'P = V × I = I² × R = V² ÷ R'],
      vars: [['V', 'voltage, in volts'], ['I', 'current, in amps'], ['R', 'resistance, in ohms'], ['P', 'power, in watts']]
    },
    worked: {
      inputs: { voltage: 230, current: '', resistance: 26.45 },
      text: 'A heater element on 230 V mains measures 26.45 Ω when hot. Leave current blank and enter 230 and 26.45: the current is 8.6957 A and the power 2000 W, a 2 kW heater. That current is under 13 A, so the standard 13 A plug fuse covers it, while a 5 A fuse would blow.',
      check: [['current', '8.6957 A'], ['power', '2000 W']]
    },
    uses: [
      ['Battery projects', 'A 9 V battery across 470 Ω drives 19.15 mA and turns 0.17 W into heat.'],
      ['Pull-up resistors', 'A 10 kΩ pull-up on a 3.3 V line passes only 0.33 mA, which is why that value is common.'],
      ['Fault finding', 'Compare V ÷ I measured in a live circuit with the part’s marked value.']    ],
    mistakes: [
      'Filling in all three boxes. With voltage and current both given, resistance is recalculated from them and whatever is typed there is ignored, so clear the one you want worked out.',
      'Typing kilohms as ohms. 4.7 kΩ is 4700; at 12 V that draws 2.553 mA, while 4.7 entered by mistake gives 2.553 A, a thousand times more.',
      'Using the full supply voltage for an LED resistor. The resistor sees only the supply minus the LED’s forward voltage: from 5 V, a 2 V LED leaves 3 V across it.'
    ],
    faq: [
      { q: 'How do I work out the power a resistor dissipates?', a: 'Multiply the current squared by the resistance, or the voltage by the current. 0.5 A through 24 Ω is 0.25 × 24 = 6 W, with 12 V across it, so a 5 W part would overheat.' },
      { q: 'Why does my multimeter give a different resistance?', a: 'A multimeter measures a part cold and unpowered. A filament bulb or heater element has a much higher resistance when hot, so V ÷ I measured in use can be several times the cold reading.' },
      { q: 'Can I use Ohm’s law on AC mains?', a: 'For resistive loads such as kettles and heaters, yes, using RMS values; the 230 V UK mains figure is already RMS. Motors and capacitors add reactance, and impedance then takes the place of resistance.' }    ],
    checks: [
      { inputs: { voltage: 9, current: '', resistance: 470 }, key: 'current', shown: '19.15 mA', scale: 1000 },
      { inputs: { voltage: 9, current: '', resistance: 470 }, key: 'power', shown: '0.17 W' },
      { inputs: { voltage: 3.3, current: '', resistance: 10000 }, key: 'current', shown: '0.33 mA', scale: 1000 },
      { inputs: { voltage: 12, current: '', resistance: 4700 }, key: 'current', shown: '2.553 mA', scale: 1000 },
      { inputs: { voltage: 12, current: '', resistance: 4.7 }, key: 'current', shown: '2.553 A' },
      { inputs: { voltage: '', current: 0.5, resistance: 24 }, key: 'power', shown: '= 6 W' },
      { inputs: { voltage: '', current: 0.5, resistance: 24 }, key: 'voltage', shown: 'with 12 V' }
    ],
    related: { conversions: ['/conversions/power/watt-to-milliwatt/', '/conversions/power/watt-to-kilowatt/'] }
  },

  '/engineering/gauge-absolute-pressure/': {
    term: 'gauge and absolute pressure',
    whatTitle: 'What are gauge and absolute pressure?',
    whatIs: [
      'Absolute pressure is measured from a perfect vacuum: the whole push of a gas or liquid. Gauge pressure is measured from the air around the gauge, so a gauge open to the room reads zero even though the room’s air is pressing on it. The two differ by the atmospheric pressure at that place and time.',
      'Dials in garages, workshops and plant rooms mostly read gauge pressure, while gas law sums, vapour tables, weather reports and engine sensors use absolute. Mixing them up is an error of a whole atmosphere, about 14.7 psi.'
    ],
    formula: {
      text: 'Absolute pressure is gauge pressure plus the atmospheric pressure, and gauge is absolute minus it. Both must be in one unit, so the tool turns everything into pascals first, using exact definitions: a bar is 100,000 Pa, a psi is 6,894.757 Pa and the standard atmosphere is 101,325 Pa.',
      expr: ['p(abs) = p(gauge) + p(atm)', 'p(gauge) = p(abs) − p(atm)', '1 atm = 101,325 Pa = 1.01325 bar = 14.6959 psi'],
      vars: [['p(abs)', 'absolute pressure, above a perfect vacuum'], ['p(gauge)', 'gauge pressure, above the surrounding air'], ['p(atm)', 'atmospheric pressure, standard or local']]
    },
    worked: {
      inputs: { value: 180, unit: 'kPa', ref: 'absolute' },
      text: 'A diagnostic scanner shows a MAP sensor reading of 180 kPa under boost. MAP stands for manifold absolute pressure, so choose kPa and Absolute. At the standard atmosphere the boost a dashboard gauge would show is 78.675 kPag, which is 0.78675 barg or 11.4108 psig.',
      check: [['kpag', '78.675 kPag'], ['barg', '0.78675 barg'], ['psig', '11.4108 psig']]
    },
    uses: [
      ['Datasheets', 'A pump or valve rated in bara set against a site gauge in barg: 10 bara is 8.98675 barg at the standard atmosphere.'],
      ['Vacuum work', 'A vacuum gauge showing −0.9 barg means 0.11325 bara, the kind of figure a vacuum pump’s datasheet quotes.'],
      ['Sites above sea level', 'Enter the local barometric pressure: with 900 hPa outside, 6 barg is 6.9 bara rather than 7.01325.']
    ],
    mistakes: [
      'Changing the unit but not the reference. 30 psig is 2.0684 barg but 3.0817 bara; a plain psi to bar converter gives only the first.',
      'Assuming a bare “psi” or “bar” is one or the other. Tyre and compressor figures are gauge; barometers and vapour pressure tables are absolute.'
    ],
    faq: [
      { q: 'Can gauge pressure be negative?', a: 'Yes, under a vacuum, but no lower than minus the atmospheric pressure: at the standard atmosphere, −1.01325 barg or −14.6959 psig, a perfect vacuum. Anything lower is impossible, and the converter says so.' },
      { q: 'Which atmospheric pressure should I enter?', a: 'The standard atmosphere, 1013.25 hPa, suits most work. For precise work use the barometric pressure where and when the reading was taken. Weather reports usually give pressure corrected to sea level, which is higher than the real pressure at a site above it.' },
      { q: 'Is psia the same as bara?', a: 'Both are absolute, in different units: 1 bara is 14.5038 psia.' }
    ],
    checks: [
      { inputs: { value: 0, unit: 'psi', ref: 'gauge' }, key: 'psia', shown: 'about 14.7 psi' },
      { inputs: { value: 10, unit: 'bar', ref: 'absolute' }, key: 'barg', shown: '8.98675 barg' },
      { inputs: { value: -0.9, unit: 'bar', ref: 'gauge' }, key: 'bara', shown: '0.11325 bara' },
      { inputs: { value: 6, unit: 'bar', ref: 'gauge', atm: 900, atmUnit: 'hPa' }, key: 'bara', shown: '6.9 bara' },
      { inputs: { value: 6, unit: 'bar', ref: 'gauge' }, key: 'bara', shown: 'rather than 7.01325' },
      { inputs: { value: 30, unit: 'psi', ref: 'gauge' }, key: 'barg', shown: '2.0684 barg' },
      { inputs: { value: 30, unit: 'psi', ref: 'gauge' }, key: 'bara', shown: '3.0817 bara' },
      { inputs: { value: 0, unit: 'bar', ref: 'absolute' }, key: 'barg', shown: '−1.01325 barg' },
      { inputs: { value: 0, unit: 'bar', ref: 'absolute' }, key: 'psig', shown: '−14.6959 psig' },
      { inputs: { value: 1, unit: 'bar', ref: 'absolute' }, key: 'psia', shown: '14.5038 psia' },
      { inputs: { value: 0, unit: 'bar', ref: 'gauge' }, key: 'mbara', shown: '1013.25 hPa' }
    ],
    related: { conversions: ['/conversions/pressure/psi-to-bar/', '/conversions/pressure/bar-to-psi/', '/conversions/pressure/'] }
  }
};
