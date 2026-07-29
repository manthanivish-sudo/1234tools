(function(){
window.TEXT_TOOLS = window.TEXT_TOOLS || {};
window.TEXT_TOOLS["palindrome-anagram"] = {
"title": "Palindrome & Anagram Checker",
"kind": "code",
"description": "Check whether text reads the same backwards, and test whether two phrases are anagrams.",
"keywords": ["palindrome checker","anagram checker","is it a palindrome","anagram solver","word puzzle tool"],
"inputLabel": "Text (two lines to compare as anagrams)",
"outputLabel": "Result",
"placeholder": "A man, a plan, a canal: Panama",
"sample": "A man, a plan, a canal: Panama\nlisten\nsilent",
"options": [{"key":"strict","label":"Matching","type":"select","default":"loose","options":[{"value":"loose","label":"Ignore case, spaces and punctuation"},{"value":"strict","label":"Exact characters"}]}],
"transform": (text, o) => {
      const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) return { output: '', note: 'Enter some text above.' };
      const norm = (s) => o.strict === 'strict' ? s : s.toLowerCase().replace(/[^a-z0-9]/gi, '');

      const out = [];
      const stats = [];
      lines.forEach((l, i) => {
        const n = norm(l);
        const rev = n.split('').reverse().join('');
        const isPal = n.length > 0 && n === rev;
        out.push(`${isPal ? '✓ palindrome    ' : '✗ not a palindrome'}  ${l}`);
        if (i < 3) stats.push([`Line ${i + 1}`, isPal ? 'Palindrome' : 'Not a palindrome']);
      });

      if (lines.length >= 2) {
        const sig = (s) => norm(s).split('').sort().join('');
        const a = sig(lines[lines.length - 2]), b = sig(lines[lines.length - 1]);
        const isAna = a === b && a.length > 0;
        out.push('');
        out.push(`${isAna ? '✓' : '✗'} "${lines[lines.length - 2]}" and "${lines[lines.length - 1]}" are ${isAna ? '' : 'not '}anagrams`);
        stats.push(['Last two lines', isAna ? 'Anagrams' : 'Not anagrams']);
      }

      return { output: out.join('\n'), stats };
    },
"tips": ["Loose matching ignores case, spaces and punctuation, which is how palindromes are conventionally judged — \"A man, a plan, a canal: Panama\" counts.","Every line is checked as a palindrome; the last two lines are also compared as anagrams.","Two texts are anagrams when they contain exactly the same letters with the same counts, regardless of order."],
"faq": [{"q":"Are numbers palindromes?","a":"Yes, by the same rule — 12321 reads the same in both directions. Loose matching keeps digits and discards everything else."}]
};
})();