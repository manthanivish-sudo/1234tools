(function(){
window.TEXT_TOOLS = window.TEXT_TOOLS || {};
window.TEXT_TOOLS["caesar-cipher"] = {
"title": "Caesar Cipher & ROT13 Tool",
"kind": "code",
"description": "Encode and decode Caesar shift ciphers, including ROT13, with automatic cracking.",
"keywords": ["caesar cipher","rot13","shift cipher decoder","cipher solver","encode decode text"],
"inputLabel": "Text",
"outputLabel": "Result",
"placeholder": "Type a message…",
"sample": "Uryyb, guvf vf ebg13 rapbqrq.",
"options": [{"key":"mode","label":"Mode","type":"select","default":"shift","options":[{"value":"shift","label":"Shift by a set amount"},{"value":"rot13","label":"ROT13"},{"value":"crack","label":"Try every shift"}]},{"key":"shift","label":"Shift amount","type":"select","default":"3","options":[{"value":"1","label":"1"},{"value":"2","label":"2"},{"value":"3","label":"3"},{"value":"4","label":"4"},{"value":"5","label":"5"},{"value":"6","label":"6"},{"value":"7","label":"7"},{"value":"8","label":"8"},{"value":"9","label":"9"},{"value":"10","label":"10"},{"value":"11","label":"11"},{"value":"12","label":"12"},{"value":"13","label":"13"},{"value":"14","label":"14"},{"value":"15","label":"15"},{"value":"16","label":"16"},{"value":"17","label":"17"},{"value":"18","label":"18"},{"value":"19","label":"19"},{"value":"20","label":"20"},{"value":"21","label":"21"},{"value":"22","label":"22"},{"value":"23","label":"23"},{"value":"24","label":"24"},{"value":"25","label":"25"}]},{"key":"dir","label":"Direction","type":"select","default":"enc","options":[{"value":"enc","label":"Encode"},{"value":"dec","label":"Decode"}]}],
"transform": (text, o) => {
      const raw = String(text || '');
      if (!raw.trim()) return { output: '', note: 'Type a message above.' };

      const rot = (s, n) => s.replace(/[a-z]/gi, c => {
        const base = c <= 'Z' ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + n + 26) % 26) + base);
      });

      if (o.mode === 'rot13') {
        return { output: rot(raw, 13),
                 stats: [['Shift', '13'], ['Note', 'ROT13 is its own inverse — applying it twice returns the original']] };
      }

      if (o.mode === 'crack') {
        /* Score each candidate by how closely its letter frequencies match
           English. The best shift is almost always the correct one for any
           text longer than a few words. */
        const FREQ = { e:12.7,t:9.1,a:8.2,o:7.5,i:7.0,n:6.7,s:6.3,h:6.1,r:6.0,d:4.3,l:4.0,c:2.8,
                       u:2.8,m:2.4,w:2.4,f:2.2,g:2.0,y:2.0,p:1.9,b:1.5,v:1.0,k:0.8,j:0.15,x:0.15,q:0.1,z:0.07 };
        const score = (s) => {
          let total = 0, sum = 0;
          for (const c of s.toLowerCase()) if (c >= 'a' && c <= 'z') { sum += FREQ[c] || 0; total++; }
          return total ? sum / total : 0;
        };
        const cands = Array.from({ length: 26 }, (_, n) => ({ n, text: rot(raw, -n), score: score(rot(raw, -n)) }));
        const best = cands.slice().sort((a, b) => b.score - a.score)[0];
        const output = cands.map(c =>
          `${String(c.n).padStart(2)}${c.n === best.n ? ' ★' : '  '} ${c.text.slice(0, 70)}`
        ).join('\n');
        return {
          output,
          stats: [['Most likely shift', String(best.n)], ['Best candidate', best.text.slice(0, 60)],
                  ['Method', 'English letter-frequency scoring']]
        };
      }

      const n = Number(o.shift) || 3;
      const out = rot(raw, o.dir === 'dec' ? -n : n);
      return { output: out, stats: [['Shift', String(n)], ['Direction', o.dir === 'dec' ? 'Decode' : 'Encode']] };
    },
"tips": ["ROT13 is a Caesar cipher with a shift of 13. Because the alphabet has 26 letters, applying it twice restores the original.","\"Try every shift\" scores all 26 possibilities against English letter frequencies and marks the most likely with a star.","This is not encryption. A Caesar cipher has 25 possible keys and is broken instantly — it is a puzzle and a teaching tool, nothing more.","Non-letters pass through unchanged, so punctuation and spacing survive the round trip."],
"faq": [{"q":"Can I use this to protect something?","a":"No. Anyone can break a Caesar cipher by hand in under a minute, which this tool demonstrates. Use real encryption for anything that matters."}]
};
})();