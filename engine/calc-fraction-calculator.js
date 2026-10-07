(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["fraction-calculator"] = {
"title": "Fraction Calculator",
"category": "mathematics",
"description": "Add, subtract, multiply and divide fractions, with the answer simplified and as a decimal and percentage.",
"keywords": ["fraction calculator","add fractions","simplify fraction","fraction to decimal","decimal to fraction"],
"formula": "a/b + c/d = (ad + cb) / bd, then divide by the greatest common divisor",
"inputs": [{"key":"n1","label":"First numerator","type":"number","default":3},{"key":"d1","label":"First denominator","type":"number","default":4},{"key":"op","label":"Operation","type":"select","options":[{"value":"+","label":"Add"},{"value":"-","label":"Subtract"},{"value":"*","label":"Multiply"},{"value":"/","label":"Divide"}],"default":"+"},{"key":"n2","label":"Second numerator","type":"number","default":5},{"key":"d2","label":"Second denominator","type":"number","default":6}],
"compute": ({ n1, d1, op, n2, d2 }) => {
      const a = Math.round(Number(n1) || 0), b = Math.round(Number(d1) || 0);
      const c = Math.round(Number(n2) || 0), d = Math.round(Number(d2) || 0);
      if (!b || !d) return { note: 'A denominator cannot be zero.' };
      if (op === '/' && c === 0) return { note: 'Cannot divide by a fraction equal to zero.' };

      let num2, den;
      if (op === '+') { num2 = a * d + c * b; den = b * d; }
      else if (op === '-') { num2 = a * d - c * b; den = b * d; }
      else if (op === '*') { num2 = a * c; den = b * d; }
      else { num2 = a * d; den = b * c; }

      const gcd = (x, y) => { x = Math.abs(x); y = Math.abs(y); while (y) [x, y] = [y, x % y]; return x || 1; };
      const g = gcd(num2, den);
      let sn = num2 / g, sd = den / g;
      if (sd < 0) { sn = -sn; sd = -sd; }

      const whole = Math.trunc(sn / sd);
      const rem = Math.abs(sn % sd);
      const mixed = rem === 0 ? String(whole)
        : whole === 0 ? `${sn < 0 ? '-' : ''}${rem}/${sd}`
        : `${whole} ${rem}/${sd}`;

      return {
        simplified: `${sn}/${sd}`,
        mixed,
        decimal: sn / sd,
        percent: (sn / sd) * 100,
        unsimplified: `${num2}/${den}`,
        gcdUsed: g,
        note: ''
      };
    },
"outputs": [{"key":"simplified","label":"Result (simplified)","format":"text","primary":true},{"key":"mixed","label":"As a mixed number","format":"text"},{"key":"decimal","label":"As a decimal","format":"number"},{"key":"percent","label":"As a percentage","format":"percent"},{"key":"unsimplified","label":"Before simplifying","format":"text"},{"key":"gcdUsed","label":"Divided by (GCD)","format":"number"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => {
      if (!r.simplified) return [];
      const a = Math.round(Number(v.n1) || 0), b = Math.round(Number(v.d1) || 0), c = Math.round(Number(v.n2) || 0), d = Math.round(Number(v.d2) || 0);
      const how = v.op === '+' ? '(' + a + ' × ' + d + ' + ' + c + ' × ' + b + ') ÷ (' + b + ' × ' + d + ')'
        : v.op === '-' ? '(' + a + ' × ' + d + ' − ' + c + ' × ' + b + ') ÷ (' + b + ' × ' + d + ')'
        : v.op === '*' ? '(' + a + ' × ' + c + ') ÷ (' + b + ' × ' + d + ')' : '(' + a + ' × ' + d + ') ÷ (' + b + ' × ' + c + ')';
      return [a + '/' + b + ' ' + ({ '+': '+', '-': '−', '*': '×', '/': '÷' })[v.op] + ' ' + c + '/' + d + ' = ' + how + ' = ' + r.unsimplified,
        r.unsimplified + ' ÷ ' + r.gcdUsed + ' (greatest common divisor) = ' + r.simplified + (r.mixed !== r.simplified ? ' = ' + r.mixed : '')];
    },
"tips": ["To add or subtract, the denominators must match — multiplying them together always works, though it may not give the smallest common denominator.","Dividing by a fraction is the same as multiplying by its reciprocal: ÷ 2/3 is × 3/2.","A fraction is fully simplified when the numerator and denominator share no common factor other than 1."],
"faq": [{"q":"Why is my answer not the smallest denominator?","a":"It should be — the result is divided by the greatest common divisor. If it looks large, check the inputs: 1/3 + 1/7 genuinely needs 21 as the denominator."}]
};
})();