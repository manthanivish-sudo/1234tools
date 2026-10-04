'use strict';
/* Kit v2 story data: Engineering & Electronics. Contract: kit2-schema.md, sections 1 and 2.
   3 V across the resistor at 20 mA gives 150 Ω and 0.06 W in the engine. */
module.exports = {
  '/engineering/ohms-law/': {
    persona: 'Hobbyists, students and makers',
    hook: '3 volts across it, 20 mA through it. Which resistor?',
    pain: 'The LED circuit needs a resistor, the shop sells dozens of values, and a wrong pick can burn the LED out.',
    usual: ['Rearranging V = IR in your head', 'Forgetting to turn mA into amps', 'Ignoring the power rating'],
    promise: 'Enter any two of voltage, current and resistance. Get the rest.',
    steps: ['Enter two known values', 'Leave the third blank', 'Read resistance and power'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { voltage: 3, current: 0.02 } },
    howTo: 'How to use Ohm’s law to pick a resistor',
    cta: 'Do the sum'
  },
  /* 30 psig at the standard atmosphere is 44.6959 psia and 2.0684 barg in the engine. */
  '/engineering/gauge-absolute-pressure/': {
    persona: 'Engineers, technicians and car tuners',
    hook: 'The spec sheet says bara. Your gauge reads psig.',
    pain: 'One document gives pressures as absolute, the gauge reads above atmosphere, and a plain psi to bar conversion leaves the two a whole atmosphere apart.',
    usual: ['Converting the unit but not the reference', 'Adding 14.7 or 1 bar from memory', 'Forgetting the air pressure changes'],
    promise: 'Enter a pressure, its unit and whether it is gauge or absolute. Get both, in every unit.',
    steps: ['Enter the pressure and unit', 'Pick gauge or absolute', 'Read psig, psia, barg and bara'],
    proof: ['Free', 'No sign-up', 'Works offline once opened'],
    example: { kind: 'calc', inputs: { value: 30, unit: 'psi', ref: 'gauge' } },
    howTo: 'How to convert gauge pressure to absolute',
    cta: 'Convert a pressure'
  }
};
