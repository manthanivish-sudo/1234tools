(function(){
window.TEXT_TOOLS = window.TEXT_TOOLS || {};
window.TEXT_TOOLS["morse-code"] = {
"title": "Morse Code Translator",
"kind": "code",
"description": "Translate text to Morse code and back, with the full reference alphabet.",
"keywords": ["morse code translator","morse code converter","text to morse","morse to text","SOS morse"],
"inputLabel": "Text or Morse code",
"outputLabel": "Translation",
"placeholder": "SOS  or  ... --- ...",
"sample": "MVR IT SERVICES",
"options": [{"key":"dir","label":"Direction","type":"select","default":"auto","options":[{"value":"auto","label":"Detect automatically"},{"value":"enc","label":"Text → Morse"},{"value":"dec","label":"Morse → Text"}]}],
"transform": (text, o) => {
      const raw = String(text || '').trim();
      if (!raw) return { output: '', note: 'Type some text or Morse code above.' };

      const M = { A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',
        K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',
        V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..','0':'-----','1':'.----','2':'..---','3':'...--',
        '4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.','.':'.-.-.-',
        ',':'--..--','?':'..--..',"'":'.----.','!':'-.-.--','/':'-..-.','(':'-.--.',')':'-.--.-',
        '&':'.-...',':':'---...',';':'-.-.-.','=':'-...-','+':'.-.-.','-':'-....-','_':'..--.-',
        '"':'.-..-.','$':'...-..-','@':'.--.-.' };
      const R = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k]));

      const isMorse = /^[.\-/\s|]+$/.test(raw);
      const dir = o.dir === 'auto' ? (isMorse ? 'dec' : 'enc') : o.dir;

      if (dir === 'enc') {
        const chars = raw.toUpperCase().split('');
        const unknown = new Set();
        const out = chars.map(c => {
          if (c === ' ') return '/';
          if (M[c]) return M[c];
          unknown.add(c);
          return '';
        }).filter(Boolean).join(' ');
        return {
          output: out,
          stats: [['Characters in', String(raw.length)], ['Symbols out', String(out.replace(/\s/g, '').length)],
                  ['Unsupported characters', unknown.size ? [...unknown].join(' ') : 'none']],
          warn: unknown.size ? `These characters have no standard Morse representation and were skipped: ${[...unknown].join(' ')}` : ''
        };
      }

      const words = raw.split(/\s*[/|]\s*/);
      let bad = 0;
      const out = words.map(w =>
        w.trim().split(/\s+/).filter(Boolean).map(sym => {
          if (R[sym]) return R[sym];
          bad++; return '?';
        }).join('')
      ).join(' ');
      return {
        output: out,
        stats: [['Words', String(words.length)], ['Unrecognised symbols', String(bad)]],
        warn: bad ? `${bad} symbol${bad > 1 ? 's were' : ' was'} not recognised and shown as "?". Letters are separated by spaces and words by / or |.` : ''
      };
    },
"tips": ["Letters are separated by a single space and words by a forward slash — that is the standard written convention.","In timing terms a dash is three dots long, the gap between letters is three dots, and between words seven.","SOS is written as one continuous prosign in real use, and was chosen because the pattern is unmistakable, not because it abbreviates anything.","Detection is automatic: input containing only dots, dashes and separators is decoded, anything else is encoded."],
"faq": [{"q":"Does Morse code support other alphabets?","a":"Extensions exist for accented Latin letters, Greek, Cyrillic, Hebrew, Arabic and Japanese kana. This tool covers the ITU international alphabet — the 26 Latin letters, digits and common punctuation."}]
};
})();