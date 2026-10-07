(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["prime-factorisation"] = {
"title": "Prime Factorisation Calculator",
"category": "mathematics",
"description": "Break a number into prime factors, list all divisors, and test whether it is prime.",
"keywords": ["prime factorisation","prime factors","factor calculator","is it prime","divisors of a number"],
"formula": "trial division up to √n",
"inputs": [{"key":"n","label":"Number","type":"number","default":360,"min":1}],
"compute": ({ n }) => {
      let x = Math.abs(Math.round(Number(n) || 0));
      if (x < 1) return { note: 'Enter a positive whole number.' };
      if (x > 1e12) return { note: 'Numbers above a trillion take too long to factor by trial division here.' };
      const original = x;

      const factors = [];
      for (let d = 2; d * d <= x; d++) {
        while (x % d === 0) { factors.push(d); x /= d; }
      }
      if (x > 1) factors.push(x);

      const grouped = {};
      factors.forEach(f => grouped[f] = (grouped[f] || 0) + 1);
      const expanded = Object.keys(grouped).map(Number).sort((a, b) => a - b)
        .map(f => grouped[f] > 1 ? `${f}^${grouped[f]}` : String(f)).join(' × ');

      /* every divisor, built from the prime powers (at most 6,720 below a
         trillion), so the list is complete for any number accepted */
      let divisors = [1];
      Object.keys(grouped).map(Number).forEach((p) => {
        const next = [];
        divisors.forEach((d) => { let m = d; for (let e = 0; e <= grouped[p]; e++) { next.push(m); m *= p; } });
        divisors = next;
      });
      divisors.sort((a, b) => a - b);
      const divisorCount = Object.values(grouped).reduce((p, e) => p * (e + 1), 1);

      return {
        factorisation: original === 1 ? '1 has no prime factors' : expanded,
        isPrime: factors.length === 1 && original > 1 ? 'Yes — this is a prime number' : 'No',
        factorList: factors.join(' × ') || '—',
        distinctPrimes: Object.keys(grouped).length,
        divisorCount,
        divisorList: divisors.join(', '),
        sumOfDivisors: divisors.reduce((s, d) => s + d, 0),
        note: ''
      };
    },
"outputs": [{"key":"factorisation","label":"Prime factorisation","format":"text","primary":true},{"key":"isPrime","label":"Prime?","format":"text"},{"key":"factorList","label":"Factors written out","format":"text"},{"key":"distinctPrimes","label":"Distinct prime factors","format":"number"},{"key":"divisorCount","label":"Number of divisors","format":"number"},{"key":"divisorList","label":"All divisors","format":"text"},{"key":"sumOfDivisors","label":"Sum of divisors","format":"number"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.factorisation ? [f.upto(Number(v.n), 0) + ' = ' + r.factorisation, 'divisors: (each exponent + 1) multiplied = ' + r.divisorCount] : [],
"tips": ["Every whole number above 1 has exactly one prime factorisation — that is the fundamental theorem of arithmetic.","Trial division only needs to reach √n: any factor above the square root pairs with one below it.","1 is not prime. It has only one divisor, and treating it as prime would break unique factorisation."],
"faq": [{"q":"Why is factoring large numbers slow?","a":"Trial division scales with √n. That difficulty is not an accident of this tool — the presumed hardness of factoring very large semiprimes is what RSA encryption rests on."}]
};
})();