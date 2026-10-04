(function(){
window.TEXT_TOOLS = window.TEXT_TOOLS || {};
window.TEXT_TOOLS["number-to-words"] = {
"title": "Number to Words Converter",
"kind": "code",
"description": "Write numbers out in words, including currency form for cheques and contracts.",
"keywords": ["number to words","number spelling","amount in words","cheque amount in words","write numbers in english"],
"inputLabel": "Numbers (one per line)",
"outputLabel": "In words",
"placeholder": "1234.56",
"sample": "1234.56\n1000000\n42\n0.75",
"options": [{"key":"style","label":"Style","type":"select","default":"plain","options":[{"value":"plain","label":"Plain words"},{"value":"gbp","label":"Currency — pounds and pence"},{"value":"usd","label":"Currency — dollars and cents"},{"value":"inr","label":"Currency — rupees and paise (lakh/crore)"},{"value":"ordinal","label":"Ordinal (first, second…)"}]},{"key":"caps","label":"Capitalisation","type":"select","default":"sentence","options":[{"value":"sentence","label":"Sentence case"},{"value":"lower","label":"lowercase"},{"value":"upper","label":"UPPERCASE"}]}],
"transform": (text, o) => {
      const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) return { output: '', note: 'Enter one or more numbers.' };

      const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten',
        'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
      const TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
      const ORD = { one:'first', two:'second', three:'third', five:'fifth', eight:'eighth',
                    nine:'ninth', twelve:'twelfth' };

      const under1000 = (n) => {
        if (n === 0) return '';
        if (n < 20) return ONES[n];
        if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
        return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + under1000(n % 100) : '');
      };

      const western = (n) => {
        if (n === 0) return 'zero';
        const SCALE = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
        let out = [];
        for (const [v, name] of SCALE) {
          if (n >= v) { out.push(under1000(Math.floor(n / v)) + ' ' + name); n %= v; }
        }
        if (n) out.push((out.length && n < 100 ? 'and ' : '') + under1000(n));
        return out.join(' ').replace(/\s+/g, ' ').trim();
      };

      const indian = (n) => {
        if (n === 0) return 'zero';
        let out = [];
        if (n >= 1e7) { out.push(indian(Math.floor(n / 1e7)) + ' crore'); n %= 1e7; }
        if (n >= 1e5) { out.push(under1000(Math.floor(n / 1e5)) + ' lakh'); n %= 1e5; }
        if (n >= 1e3) { out.push(under1000(Math.floor(n / 1e3)) + ' thousand'); n %= 1e3; }
        if (n) out.push((out.length && n < 100 ? 'and ' : '') + under1000(n));
        return out.join(' ').replace(/\s+/g, ' ').trim();
      };

      const toOrdinal = (words) => {
        const parts = words.split(/([\s-])/);
        for (let i = parts.length - 1; i >= 0; i--) {
          const w = parts[i];
          if (!w.trim()) continue;
          if (ORD[w]) { parts[i] = ORD[w]; break; }
          if (/y$/.test(w)) { parts[i] = w.slice(0, -1) + 'ieth'; break; }
          parts[i] = w + 'th'; break;
        }
        return parts.join('');
      };

      const cap = (s) => o.caps === 'upper' ? s.toUpperCase()
        : o.caps === 'lower' ? s.toLowerCase()
        : s.charAt(0).toUpperCase() + s.slice(1);

      const CUR = { gbp: ['pound','pounds','penny','pence'], usd: ['dollar','dollars','cent','cents'],
                    inr: ['rupee','rupees','paisa','paise'] };

      /* The number as decimal digits, read from what was typed rather than
         from a binary float: 0.285 is held in binary as 0.28499999…, which
         rounded to 28 pence. Exponent forms such as 1.5e3 are shifted here
         too. Returns { neg, int, frac } as digit strings, or null. */
      const decimalOf = (s) => {
        const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s);
        if (!m || (!m[2] && !m[3])) return null;
        const exp = m[4] ? parseInt(m[4], 10) : 0;
        if (Math.abs(exp) > 40) return null;
        const digits = (m[2] || '') + (m[3] || '');
        const point = (m[2] || '').length + exp;
        let int, frac;
        if (point <= 0) { int = '0'; frac = '0'.repeat(-point) + digits; }
        else if (point >= digits.length) { int = digits + '0'.repeat(point - digits.length); frac = ''; }
        else { int = digits.slice(0, point); frac = digits.slice(point); }
        int = int.replace(/^0+(?=\d)/, '') || '0';
        return { neg: m[1] === '-', int, frac };
      };

      const out = lines.map(line => {
        const cleaned = line.replace(/[,\s£$₹]/g, '');
        const n = Number(cleaned);
        if (!isFinite(n)) return `${line} → not a number`;
        let d = decimalOf(cleaned);
        if (!d) d = decimalOf(String(n));          // hex and the like: Number read it, so use its value
        if (!d) return `${line} → not a number`;

        const useIndian = o.style === 'inr';
        let whole, frac = 0, fracDigits = '';
        if (CUR[o.style]) {
          /* Currency is rounded to the minor unit, half up, on the decimal
             digits: 0.285 is 29 pence, 0.005 is one penny, and 2.999 carries
             into the pounds as three pounds. */
          let minor = BigInt(d.int) * 100n + BigInt((d.frac + '00').slice(0, 2));
          if ((d.frac[2] || '0') >= '5') minor += 1n;
          whole = Number(minor / 100n);
          frac = Number(minor % 100n);
        } else {
          whole = Number(d.int);
          // plain style reads the decimals as typed: 1.5 is one point five, 1.50 one point five zero
          fracDigits = o.style === 'ordinal' ? '' : d.frac;
        }
        if (whole > 999999999999) return `${line} → too large (limit is under a trillion)`;
        // a value that rounds to nothing carries no sign: -0.004 pounds is zero pounds
        const neg = d.neg && (whole > 0 || frac > 0 || /[1-9]/.test(fracDigits));
        const w = useIndian ? indian(whole) : western(whole);

        let s;
        if (o.style === 'ordinal') s = toOrdinal(w);
        else if (CUR[o.style]) {
          const [sing, plur, csing, cplur] = CUR[o.style];
          s = `${w} ${whole === 1 ? sing : plur}`;
          if (frac) s += ` and ${western(frac)} ${frac === 1 ? csing : cplur}`;
          s += ' only';
        } else {
          s = w;
          if (fracDigits) s += ' point ' + fracDigits.split('').map(c => ONES[Number(c)]).join(' ');
        }
        return cap((neg ? 'minus ' : '') + s);
      });

      return { output: out.join('\n'), stats: [['Numbers converted', String(lines.length)]] };
    },
"tips": ["Currency style ends with \"only\", which is the convention on cheques and in contracts to stop anything being appended.","The Indian style groups in lakh and crore rather than thousands and millions, which is what Indian banking and legal documents expect.","Ordinal style handles the irregular forms — first, second, third, fifth, ninth, twelfth — rather than simply appending \"th\"."],
"faq": [{"q":"Why does it say \"one hundred and twenty\" rather than \"one hundred twenty\"?","a":"That is British usage, and it is also the form used on cheques in the UK, India and much of the Commonwealth. American English usually omits the \"and\"."}]
};
})();