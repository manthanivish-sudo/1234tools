(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["lcm-gcd"] = {
"title": "LCM & GCD Calculator",
"category": "mathematics",
"description": "Find the least common multiple and greatest common divisor of any list of numbers.",
"keywords": ["LCM calculator","GCD calculator","least common multiple","greatest common factor","HCF calculator"],
"formula": "gcd via the Euclidean algorithm  ·  lcm(a,b) = |ab| / gcd(a,b)",
"inputs": [{"key":"nums","label":"Numbers (comma separated)","type":"text","default":"12, 18, 24"}],
"compute": ({ nums }) => {
      const list = String(nums).split(/[\s,;]+/).map(Number)
        .filter(n => isFinite(n) && n !== 0).map(n => Math.abs(Math.round(n)));
      if (list.length < 2) return { note: 'Enter at least two non-zero whole numbers.' };
      if (list.some(n => n > 1e12)) return { note: 'Keep the numbers below a trillion.' };

      const gcd2 = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
      const g = list.reduce(gcd2);
      let l = list[0];
      for (const n of list.slice(1)) {
        l = (l / gcd2(l, n)) * n;
        if (!isFinite(l) || l > 1e15) return { note: 'The least common multiple is too large to compute reliably.' };
      }

      return {
        gcd: g, lcm: l,
        coprime: g === 1 ? 'Yes — these numbers share no common factor' : 'No',
        product: list.reduce((p, n) => p * n, 1),
        count: list.length,
        simplified: list.map(n => n / g).join(' : '),
        note: ''
      };
    },
"outputs": [{"key":"gcd","label":"Greatest common divisor (HCF)","format":"number","primary":true},{"key":"lcm","label":"Least common multiple","format":"number"},{"key":"coprime","label":"Coprime?","format":"text"},{"key":"simplified","label":"Ratio in simplest form","format":"text"},{"key":"count","label":"Numbers given","format":"number"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.gcd === undefined ? [] : ['gcd(' + String(v.nums).split(/[\s,;]+/).filter(Boolean).join(', ') + ') = ' + r.gcd + ', by the Euclidean algorithm', 'lcm = ' + r.lcm + ', each pair as |a × b| ÷ gcd(a, b)'],
"tips": ["GCD and HCF are the same thing under different names — highest common factor is the more common term in UK schools.","Use the GCD to simplify fractions and ratios, and the LCM to find a common denominator or to work out when repeating events coincide.","For two numbers, gcd × lcm always equals their product. That identity does not extend to three or more."],
"faq": [{"q":"What does coprime mean?","a":"Two numbers are coprime when their only common divisor is 1. They need not be prime themselves — 8 and 9 are coprime despite both being composite."}]
};
})();