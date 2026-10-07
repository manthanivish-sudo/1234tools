(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["roman-numerals"] = {
"title": "Roman Numeral Converter",
"category": "mathematics",
"description": "Convert numbers to Roman numerals and back, with the rules explained.",
"keywords": ["roman numeral converter","roman numerals","number to roman","roman to number","XIV meaning"],
"formula": "I=1, V=5, X=10, L=50, C=100, D=500, M=1000",
"inputs": [{"key":"value","label":"Number or Roman numeral","type":"text","default":"2026"}],
"compute": ({ value }) => {
      const raw = String(value || '').trim().toUpperCase();
      if (!raw) return { note: 'Enter a number or a Roman numeral.' };

      const MAP = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],
                   [50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
      const VAL = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 };

      if (/^\d+$/.test(raw)) {
        let n = parseInt(raw, 10);
        if (n < 1 || n > 3999) {
          return { note: 'Standard Roman numerals cover 1 to 3999. Larger values needed an overbar, which has no single agreed notation.' };
        }
        let out = '';
        for (const [v, s] of MAP) while (n >= v) { out += s; n -= v; }
        const breakdown = out.replace(/(CM|CD|XC|XL|IX|IV|[MDCLXVI])/g, '$1 ').trim();
        return { result: out, breakdown, decimal: parseInt(raw, 10), direction: 'Number → Roman', note: '' };
      }

      if (!/^[MDCLXVI]+$/.test(raw)) return { note: 'Roman numerals use only M, D, C, L, X, V and I.' };
      let total = 0;
      for (let i = 0; i < raw.length; i++) {
        const v = VAL[raw[i]], nxt = VAL[raw[i + 1]] || 0;
        total += v < nxt ? -v : v;
      }
      /* past 3999 a numeral needs a fourth M or a non-standard spelling;
         read it, but say it is outside the standard range */
      if (total > 3999) {
        return { result: String(total), decimal: total, direction: 'Roman → Number',
                 breakdown: `That reads as ${total}, beyond the standard range.`,
                 note: `"${raw}" reads as ${total}, but standard Roman numerals stop at 3999, MMMCMXCIX; larger values needed an overbar.` };
      }
      // reject non-canonical spellings such as IIII or IC
      let check = '', n2 = total;
      for (const [v, s] of MAP) while (n2 >= v) { check += s; n2 -= v; }
      if (check !== raw) {
        return { result: String(total), decimal: total, direction: 'Roman → Number',
                 breakdown: `That reads as ${total}, but the standard spelling is ${check}.`,
                 note: `"${raw}" is not a canonical numeral. The usual form for ${total} is ${check}.` };
      }
      return { result: String(total), decimal: total, direction: 'Roman → Number',
               breakdown: raw.replace(/(CM|CD|XC|XL|IX|IV|[MDCLXVI])/g, '$1 ').trim(), note: '' };
    },
"outputs": [{"key":"result","label":"Result","format":"text","primary":true},{"key":"direction","label":"Conversion","format":"text"},{"key":"breakdown","label":"Broken down","format":"text"},{"key":"decimal","label":"Decimal value","format":"number"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.result ? [String(v.value).trim() + ' → ' + r.result + (r.breakdown ? ': ' + r.breakdown : '')] : [],
"tips": ["Subtractive pairs are limited to IV, IX, XL, XC, CD and CM. IC for 99 is not valid — it is XCIX.","A symbol repeats at most three times: 4 is IV, not IIII. Clock faces using IIII are a decorative exception.","There is no zero and no way to write a fraction, which is a large part of why the system was displaced."],
"faq": [{"q":"Why stop at 3999?","a":"Beyond that you need a vinculum — an overbar meaning \"multiply by a thousand\" — which has no single agreed digital representation. Most converters stop where the unambiguous notation does."}]
};
})();