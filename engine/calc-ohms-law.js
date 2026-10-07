(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["ohms-law"] = {
"title": "Ohm's Law Calculator",
"category": "engineering",
"icon": "⚡",
"description": "Calculate voltage, current, resistance, and power. Enter any two values.",
"keywords": ["ohms law","voltage calculator","current resistance","electrical power"],
"formula": "V = I · R   ·   P = V · I = I²R = V²/R",
"inputs": [{"key":"voltage","label":"Voltage (V)","type":"number","unit":"V","default":12,"optional":true},{"key":"current","label":"Current (I)","type":"number","unit":"A","default":2,"optional":true},{"key":"resistance","label":"Resistance (R)","type":"number","unit":"Ω","default":null,"optional":true}],
"compute": ({ voltage, current, resistance }) => {
      const has = v => v !== null && v !== '' && isFinite(Number(v));
      let V = has(voltage) ? Number(voltage) : null;
      let I = has(current) ? Number(current) : null;
      let R = has(resistance) ? Number(resistance) : null;

      if (V !== null && I !== null) R = I === 0 ? Infinity : V / I;
      else if (V !== null && R !== null) I = R === 0 ? Infinity : V / R;
      else if (I !== null && R !== null) V = I * R;
      else return { note: 'Enter any two of voltage, current, or resistance.' };

      return { voltage: V, current: I, resistance: R, power: V * I, note: '' };
    },
"outputs": [{"key":"voltage","label":"Voltage","format":"number","unit":"V","primary":true},{"key":"current","label":"Current","format":"number","unit":"A"},{"key":"resistance","label":"Resistance","format":"number","unit":"Ω"},{"key":"power","label":"Power","format":"number","unit":"W"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.power === undefined ? [] : [
      'V = I × R: ' + f.upto(r.voltage, 6) + ' V = ' + f.upto(r.current, 6) + ' A × ' + f.upto(r.resistance, 6) + ' Ω',
      'P = V × I = ' + f.upto(r.voltage, 6) + ' × ' + f.upto(r.current, 6) + ' = ' + f.upto(r.power, 6) + ' W'],
"tips": ["Leave one field blank and fill the other two — the tool solves for the missing quantity.","Power dissipation determines the resistor wattage rating you need. Choose a rating at least double the calculated power.","Keep units consistent: milliamps must be converted to amps (divide by 1000) before entry."],
"faq": [{"q":"Does Ohm’s law apply to all components?","a":"Only to ohmic components, where resistance is constant. Diodes, transistors, and filament lamps are non-ohmic — their resistance changes with voltage or temperature."}]
};
})();