(function(){
window.TOOLS = window.TOOLS || {};
window.TOOLS["number-base-converter"] = {
"title": "Number Base Converter",
"category": "mathematics",
"description": "Convert between binary, octal, decimal and hexadecimal, plus base 32 and base 36.",
"keywords": ["binary to decimal","decimal to binary","hex converter","number base converter","binary converter","octal to hex"],
"formula": "positional notation: Σ digitᵢ × baseⁱ",
"inputs": [{"key":"value","label":"Value","type":"text","default":"255"},{"key":"from","label":"From base","type":"select","options":[{"value":"2","label":"Binary (2)"},{"value":"8","label":"Octal (8)"},{"value":"10","label":"Decimal (10)"},{"value":"16","label":"Hexadecimal (16)"},{"value":"32","label":"Base 32"},{"value":"36","label":"Base 36"}],"default":"10"}],
"compute": ({ value, from }) => {
      const chosen = Number(from) || 10;
      let base = chosen;
      let raw = String(value || '').trim().replace(/[\s_]/g, '');
      if (!raw) return { note: 'Enter a value.' };

      /* A minus sign is kept apart and the size converted. */
      const neg = /^[-−]/.test(raw);
      if (neg) raw = raw.slice(1);
      /* 0b, 0o and 0x name their base. They are read as a prefix when From
         base is that base, or Decimal (where b, o and x cannot be digits);
         in hex, base 32 or base 36, "0b12" is an ordinary number. */
      const pre = /^0([box])/i.exec(raw);
      if (pre) {
        const pb = { b: 2, o: 8, x: 16 }[pre[1].toLowerCase()];
        if (chosen === pb || chosen === 10) { base = pb; raw = raw.slice(2); }
      }
      if (!raw) return { note: 'Enter the digits after the prefix.' };
      if (/[.,]/.test(raw)) return { note: `Whole numbers only: "${raw}" has a fractional part.` };
      /* every character checked against the base's digits first: parseInt
         would stop quietly at the first one that does not belong */
      const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, base);
      if ([...raw.toLowerCase()].some((ch) => digits.indexOf(ch) < 0)) {
        return { note: `"${raw}" contains digits that do not exist in base ${base}.` };
      }
      const n = parseInt(raw, base);
      if (!isFinite(n) || isNaN(n)) return { note: `"${raw}" is not a valid base-${base} number.` };
      if (n > Number.MAX_SAFE_INTEGER) return { note: 'That value exceeds the range JavaScript can represent exactly (2⁵³ − 1).' };

      const sign = neg && n !== 0 ? '-' : '';
      const bin = n.toString(2);
      const NAME = { 2: 'binary', 8: 'octal', 16: 'hexadecimal' };
      return {
        decimal: sign ? -n : n,
        binary: sign + bin,
        octal: sign + n.toString(8),
        hex: sign + n.toString(16).toUpperCase(),
        base32: sign + n.toString(32).toUpperCase(),
        base36: sign + n.toString(36).toUpperCase(),
        bits: bin.length,
        bytes: Math.ceil(bin.length / 8),
        grouped: sign + bin.replace(/\B(?=(\d{4})+(?!\d))/g, ' '),
        note: [base !== chosen ? `Read as ${NAME[base]} because of the 0${pre[1].toLowerCase()} prefix.` : '',
          sign ? 'The minus sign is kept apart: bits and bytes count the size of the number, not a two’s-complement form.' : ''].filter(Boolean).join(' ')
      };
    },
"outputs": [{"key":"decimal","label":"Decimal","format":"number","primary":true},{"key":"binary","label":"Binary","format":"text"},{"key":"grouped","label":"Binary (grouped in 4s)","format":"text"},{"key":"octal","label":"Octal","format":"text"},{"key":"hex","label":"Hexadecimal","format":"text"},{"key":"base32","label":"Base 32","format":"text"},{"key":"base36","label":"Base 36","format":"text"},{"key":"bits","label":"Bits required","format":"number"},{"key":"bytes","label":"Bytes required","format":"number"},{"key":"note","label":"","format":"text"}],
"filled": (v, r, f) => r.decimal === undefined || !isFinite(r.decimal) ? [] : ['value = Σ digit × ' + v.from + '^position = ' + f.upto(r.decimal, 0), 'in binary ' + r.binary + ', octal ' + r.octal + ', hex ' + r.hex],
"tips": ["Prefixes are understood: 0b1010, 0xFF and 0o777 are read as binary, hex and octal with From base on Decimal or on their own base.","Each hex digit is exactly four binary digits, which is why hex is the convention for reading raw bytes.","Bases above 16 use letters up to Z. Base 36 is the highest that fits in digits plus the Latin alphabet."],
"faq": [{"q":"Why does my long binary string lose precision?","a":"JavaScript numbers are exact only up to 2⁵³. Beyond about 53 bits the value cannot be represented precisely, so the tool refuses rather than returning a quietly wrong answer."}]
};
})();