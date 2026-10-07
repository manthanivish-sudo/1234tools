(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["ratio-calculator"] = {
"title": "Ratio Calculator",
"category": "mathematics",
"description": "Simplify ratios, solve for a missing term, and scale a ratio to a total.",
"keywords": ["ratio calculator","simplify ratio","ratio to fraction","proportion calculator","scale ratio"],
"formula": "a : b = c : d  →  d = bc / a",
"inputs": [{"key":"a","label":"A","type":"number","default":3},{"key":"b","label":"B","type":"number","default":4},{"key":"c","label":"C (for A:B = C:D)","type":"number","default":9},{"key":"total","label":"Share a total of","type":"number","default":700,"min":0}],
"compute": ({ a, b, c, total }) => {
      const A = Number(a) || 0, B = Number(b) || 0, C = Number(c) || 0;
      if (!A || !B) return { note: 'A and B must both be non-zero.' };

      const gcd = (x, y) => { x = Math.abs(x); y = Math.abs(y); while (y) [x, y] = [y, x % y]; return x || 1; };
      /* Decimals are scaled to whole numbers before simplifying — 1.5 : 2
         becomes 15 : 20 and then 3 : 4. Rounding first gave 1 : 1. The
         scale is the fewest decimal places (up to 9) that hold both terms. */
      const placesOf = (x) => {
        for (let k = 0; k <= 9; k++) {
          const s = x * Math.pow(10, k);
          if (Math.abs(s - Math.round(s)) <= 1e-9 * Math.max(1, Math.abs(s))) return k;
        }
        return 9;
      };
      const k = Math.max(placesOf(A), placesOf(B));
      const IA = Math.round(A * Math.pow(10, k)), IB = Math.round(B * Math.pow(10, k));
      const exact = Number.isSafeInteger(IA) && Number.isSafeInteger(IB);
      const g = exact ? gcd(IA, IB) : 1;
      const SA = exact ? IA / g : A, SB = exact ? IB / g : B;
      const sum = A + B;

      return {
        simplified: `${SA} : ${SB}`,
        decimal: A / B,
        missingD: A ? (B * C) / A : NaN,
        shareA: total * (A / sum),
        shareB: total * (B / sum),
        percentA: (A / sum) * 100,
        percentB: (B / sum) * 100,
        asFraction: `${SA}/${SB}`,
        note: ''
      };
    },
"outputs": [{"key":"simplified","label":"Simplified ratio","format":"text","primary":true},{"key":"decimal","label":"A ÷ B","format":"number"},{"key":"missingD","label":"D, where A:B = C:D","format":"number"},{"key":"shareA","label":"A’s share of the total","format":"number"},{"key":"shareB","label":"B’s share of the total","format":"number"},{"key":"percentA","label":"A as a percentage","format":"percent"},{"key":"percentB","label":"B as a percentage","format":"percent"},{"key":"asFraction","label":"As a fraction","format":"text"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.simplified === undefined ? [] : [
      f.upto(Number(v.a), 6) + ' : ' + f.upto(Number(v.b), 6) + ' = ' + r.simplified,
      'missing D = ' + f.upto(Number(v.b), 6) + ' × ' + f.upto(Number(v.c), 6) + ' ÷ ' + f.upto(Number(v.a), 6) + ' = ' + f.upto(r.missingD, 6),
      'split ' + f.upto(Number(v.total), 6) + ' as ' + f.upto(r.shareA, 6) + ' and ' + f.upto(r.shareB, 6)],
"tips": ["A ratio compares parts to each other; a fraction compares a part to the whole. In 3:4, A is 3/7 of the total, not 3/4.","Scaling a recipe or a mix is a proportion problem: keep A:B fixed and solve for the new quantity.","Aspect ratios are just ratios in their simplest form — 1920:1080 reduces to 16:9."],
"faq": [{"q":"What is the difference between a ratio and a rate?","a":"A ratio compares two quantities of the same kind and has no units. A rate compares different kinds — miles per hour, cost per unit — and carries units."}]
};
})();