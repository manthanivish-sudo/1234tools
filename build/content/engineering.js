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
  }
};
