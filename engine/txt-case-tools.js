(function(){
window.TEXT_TOOLS = window.TEXT_TOOLS || {};
window.TEXT_TOOLS["case-tools"] = {
"title": "Text Cleanup Toolkit",
"kind": "code",
"description": "Remove duplicate lines, sort, trim whitespace, strip HTML tags and reverse text.",
"keywords": ["remove duplicate lines","sort lines","remove whitespace","strip html tags","text cleaner","line sorter"],
"inputLabel": "Your text",
"outputLabel": "Cleaned text",
"placeholder": "Paste text with duplicates, extra spaces or HTML…",
"sample": "banana\napple\ncherry\napple\n  banana  \ndate\ncherry",
"options": [{"key":"action","label":"Action","type":"select","default":"dedupe","options":[{"value":"dedupe","label":"Remove duplicate lines"},{"value":"sort","label":"Sort lines A–Z"},{"value":"sortdesc","label":"Sort lines Z–A"},{"value":"sortnum","label":"Sort lines numerically"},{"value":"shuffle","label":"Shuffle lines"},{"value":"reverse","label":"Reverse line order"},{"value":"trim","label":"Trim each line"},{"value":"squash","label":"Collapse repeated spaces"},{"value":"blank","label":"Remove blank lines"},{"value":"strip","label":"Strip HTML tags"},{"value":"number","label":"Number the lines"},{"value":"reversetext","label":"Reverse the characters"}]},{"key":"ci","label":"Case sensitivity","type":"select","default":"yes","options":[{"value":"yes","label":"Case sensitive"},{"value":"no","label":"Ignore case"}]}],
"transform": (text, o) => {
      const raw = String(text || '');
      if (!raw.trim()) return { output: '', note: 'Paste some text above.' };
      let lines = raw.split('\n');
      const before = lines.length;
      const key = (s) => o.ci === 'no' ? s.toLowerCase() : s;

      switch (o.action) {
        case 'dedupe': {
          const seen = new Set();
          lines = lines.filter(l => { const k = key(l.trim()); if (seen.has(k)) return false; seen.add(k); return true; });
          break;
        }
        case 'sort':     lines.sort((a, b) => key(a).localeCompare(key(b))); break;
        case 'sortdesc': lines.sort((a, b) => key(b).localeCompare(key(a))); break;
        case 'sortnum':  lines.sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)); break;
        case 'shuffle':
          for (let i = lines.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [lines[i], lines[j]] = [lines[j], lines[i]];
          }
          break;
        case 'reverse':  lines.reverse(); break;
        case 'trim':     lines = lines.map(l => l.trim()); break;
        case 'squash':   lines = lines.map(l => l.replace(/[ \t]{2,}/g, ' ').trim()); break;
        case 'blank':    lines = lines.filter(l => l.trim()); break;
        case 'strip':    lines = lines.map(l => l.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')); break;
        case 'number':   lines = lines.map((l, i) => `${String(i + 1).padStart(String(lines.length).length)}. ${l}`); break;
        case 'reversetext': return {
          output: raw.split('').reverse().join(''),
          stats: [['Characters', String(raw.length)]]
        };
      }

      const output = lines.join('\n');
      return {
        output,
        stats: [
          ['Lines in', String(before)],
          ['Lines out', String(lines.length)],
          ['Difference', String(lines.length - before)],
          ['Characters in', raw.length.toLocaleString('en-GB')],
          ['Characters out', output.length.toLocaleString('en-GB')]
        ]
      };
    },
"tips": ["Duplicate removal compares trimmed lines, so trailing spaces do not create false uniques.","Numeric sort reads the leading number on each line, which handles \"10. item\" correctly where alphabetical sort puts it before \"2. item\".","Stripping HTML removes tags but keeps the text between them. It is not a sanitiser — do not rely on it for security."],
"faq": [{"q":"Does removing duplicates keep the first or last occurrence?","a":"The first. Later duplicates are dropped, so the original ordering of the surviving lines is preserved."}]
};
})();