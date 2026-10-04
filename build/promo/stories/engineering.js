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
  }
};
