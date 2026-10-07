(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["quadratic-solver"] = {
"title": "Quadratic Equation Solver",
"category": "mathematics",
"icon": "𝑥²",
"description": "Solve ax² + bx + c = 0, including complex roots, vertex, and discriminant.",
"keywords": ["quadratic formula","equation solver","roots","discriminant"],
"formula": "x = (−b ± √(b² − 4ac)) / 2a",
"inputs": [{"key":"a","label":"Coefficient a","type":"number","default":1},{"key":"b","label":"Coefficient b","type":"number","default":-3},{"key":"c","label":"Coefficient c","type":"number","default":2}],
"compute": ({ a, b, c }) => {
      if (a === 0) {
        return { root1: b === 0 ? NaN : -c / b, root2: NaN, discriminant: NaN, vertexX: NaN, vertexY: NaN, nature: 'Linear (a = 0) — one root' };
      }
      let d = b * b - 4 * a * c;
      /* b² and 4ac that agree to rounding error are a repeated root, not a
         complex pair 0.0000i apart (0.1x² + 0.6x + 0.9 gives d = −5.6e−17) */
      if (Math.abs(d) <= 1e-14 * Math.max(b * b, Math.abs(4 * a * c))) d = 0;
      const vertexX = -b / (2 * a);
      const vertexY = a * vertexX * vertexX + b * vertexX + c;

      if (d > 0) {
        /* the root that would subtract two nearly equal numbers comes from
           the product of the roots, c ÷ a, instead: x² + 10⁸x + 1 = 0 gives
           −1e−8, not −7.45e−9 */
        const sq = Math.sqrt(d);
        let root1, root2;            // root1 is (−b + √d) ÷ 2a, root2 is (−b − √d) ÷ 2a
        if (b > 0) { root2 = (-b - sq) / (2 * a); root1 = (2 * c) / (-b - sq) + 0; }
        else if (b < 0) { root1 = (-b + sq) / (2 * a); root2 = (2 * c) / (-b + sq) + 0; }
        else { root1 = sq / (2 * a); root2 = -sq / (2 * a); }
        return { root1, root2, discriminant: d, vertexX, vertexY, nature: 'Two distinct real roots' };
      }
      if (d === 0) {
        return { root1: -b / (2 * a), root2: -b / (2 * a), discriminant: 0, vertexX, vertexY, nature: 'One repeated real root' };
      }
      const re = -b / (2 * a);
      const im = Math.sqrt(-d) / (2 * a);
      return {
        root1: `${re.toFixed(4)} + ${Math.abs(im).toFixed(4)}i`,
        root2: `${re.toFixed(4)} − ${Math.abs(im).toFixed(4)}i`,
        discriminant: d, vertexX, vertexY, nature: 'Two complex conjugate roots'
      };
    },
"outputs": [{"key":"root1","label":"Root 1","format":"auto","primary":true},{"key":"root2","label":"Root 2","format":"auto"},{"key":"nature","label":"Nature of Roots","format":"text"},{"key":"discriminant","label":"Discriminant (b² − 4ac)","format":"number"},{"key":"vertexX","label":"Vertex x","format":"number"},{"key":"vertexY","label":"Vertex y","format":"number"}],
"filled": (v, r, f) => r.discriminant === undefined ? [] : [
      'b² − 4ac = (' + f.upto(Number(v.b), 6) + ')² − 4 × ' + f.upto(Number(v.a), 6) + ' × ' + f.upto(Number(v.c), 6) + ' = ' + f.upto(r.discriminant, 6),
      'x = (' + f.upto(-Number(v.b), 6) + ' ± √' + f.upto(r.discriminant, 6) + ') ÷ ' + f.upto(2 * Number(v.a), 6) + ': ' + (typeof r.root1 === 'number' ? f.upto(r.root1, 6) : r.root1) + (r.root2 !== undefined ? ' and ' + (typeof r.root2 === 'number' ? f.upto(r.root2, 6) : r.root2) : '')],
"tips": ["The discriminant alone tells you the root type: positive gives two real roots, zero gives one, negative gives a complex pair.","The vertex is the parabola’s minimum when a > 0 and its maximum when a < 0."],
"faq": [{"q":"What if a = 0?","a":"The equation is no longer quadratic but linear (bx + c = 0), with the single root x = −c/b. The tool detects and handles this."}]
};
})();