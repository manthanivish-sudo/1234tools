(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["random-number-generator"] = {
"title": "Random Number Generator",
"category": "utilities",
"description": "Generate random numbers in any range, with or without duplicates, using a cryptographic source.",
"keywords": ["random number generator","random picker","lottery numbers","random integer","pick a number"],
"formula": "crypto.getRandomValues with rejection sampling to avoid modulo bias",
"regenerate": true,
"inputs": [{"key":"min","label":"Minimum","type":"number","default":1},{"key":"max","label":"Maximum","type":"number","default":100},{"key":"count","label":"How many","type":"number","default":6,"min":1,"max":1000},{"key":"unique","label":"Duplicates","type":"select","options":[{"value":"yes","label":"Allow duplicates"},{"value":"no","label":"No duplicates"}],"default":"no"},{"key":"sort","label":"Order","type":"select","options":[{"value":"draw","label":"Draw order"},{"value":"asc","label":"Lowest first"}],"default":"draw"}],
"validate": (v) => {
      const e = {};
      if (v.min !== null && v.max !== null && Number(v.min) > Number(v.max)) e.max = 'The maximum must be at least the minimum.';
      return e;
    },
"compute": ({ min, max, count, unique, sort }) => {
      let lo = Math.round(Number(min) || 0), hi = Math.round(Number(max) || 0);
      if (lo > hi) [lo, hi] = [hi, lo];
      const span = hi - lo + 1;
      if (!isFinite(span) || span < 1 || span > Number.MAX_SAFE_INTEGER) {
        return { note: 'That range is too large. Keep the minimum and maximum within a sensible span.' };
      }
      let n = Math.max(1, Math.min(1000, Math.round(Number(count) || 1)));
      if (unique === 'no' && n > span) {
        return { note: `You asked for ${n} unique numbers but the range only holds ${span}.` };
      }

      /* Rejection sampling: taking a random value modulo the span skews the
         result towards the low end whenever the span does not divide evenly. */
      const rand = (limit) => {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          const max32 = 4294967296;
          const buf = new Uint32Array(1);
          let v;
          if (limit <= max32) {
            const bound = max32 - (max32 % limit);
            do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= bound);
            return v % limit;
          }
          /* a span wider than 2³² needs more bits: 21 + 32 make a whole
             number below 2⁵³, exact in a double, with the same rejection
             (a span this wide used to leave the bound at 0 and loop for ever) */
          const max53 = 9007199254740992;
          const bound = max53 - (max53 % limit);
          do {
            crypto.getRandomValues(buf); const hi = buf[0] >>> 11;
            crypto.getRandomValues(buf); v = hi * max32 + buf[0];
          } while (v >= bound);
          return v % limit;
        }
        return Math.floor(Math.random() * limit);
      };

      let out = [];
      if (unique === 'no') {
        /* Building a pool array is clean for small ranges but catastrophic
           for large ones — a range of a billion would try to allocate a
           billion-element array and kill the tab. Above a modest threshold,
           draw and reject instead: with n far smaller than the span,
           collisions are vanishingly rare. */
        if (span <= 100000) {
          const pool = Array.from({ length: span }, (_, i) => lo + i);
          for (let i = 0; i < n; i++) out.push(pool.splice(rand(pool.length), 1)[0]);
        } else {
          const seen = new Set();
          let guard = 0;
          while (out.length < n && guard < n * 100) {
            guard++;
            const v = lo + rand(span);
            if (!seen.has(v)) { seen.add(v); out.push(v); }
          }
        }
      } else {
        for (let i = 0; i < n; i++) out.push(lo + rand(span));
      }
      if (sort === 'asc') out = out.slice().sort((a, b) => a - b);

      return {
        numbers: out.join(', '),
        first: out[0],
        count: out.length,
        range: `${lo} to ${hi}`,
        sum: out.reduce((s, x) => s + x, 0),
        source: (typeof crypto !== 'undefined' && crypto.getRandomValues) ? 'crypto.getRandomValues' : 'Math.random fallback',
        note: ''
      };
    },
"outputs": [{"key":"numbers","label":"Numbers","format":"text","primary":true},{"key":"count","label":"Generated","format":"number"},{"key":"range","label":"Range","format":"text"},{"key":"sum","label":"Sum","format":"number"},{"key":"source","label":"Random source","format":"text"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.numbers ? ['each number is drawn uniformly from ' + v.min + ' to ' + v.max + ' by the browser’s cryptographic generator' + (v.unique === 'yes' ? ', without repeats' : '') + ': ' + r.numbers] : [],
"tips": ["Numbers come from the browser’s cryptographic random source, not Math.random, and use rejection sampling so every value in the range is equally likely.","Naive generators take a random number modulo the range, which quietly favours the lower values. This one does not.","Turn duplicates off for lottery-style draws or picking winners; leave them on for dice-style rolls."],
"faq": [{"q":"Is this random enough for a prize draw?","a":"The randomness is sound. Whether a draw is *fair* is a separate question about process — who ran it, whether it can be re-run, and whether anyone can verify it. For anything with legal weight, use a documented procedure with witnesses."}]
};
})();