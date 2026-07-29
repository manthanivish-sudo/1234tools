(function(){
window.TEXT_TOOLS = window.TEXT_TOOLS || {};
window.TEXT_TOOLS["text-diff"] = {
"title": "Text Compare & Diff Tool",
"kind": "code",
"description": "Compare two texts line by line and see exactly what was added, removed or changed.",
"keywords": ["text compare","diff tool","compare two texts","text difference checker","diff checker"],
"inputLabel": "Two texts separated by a line containing only ---",
"outputLabel": "Differences",
"placeholder": "First version\n---\nSecond version",
"sample": "The quick brown fox\njumps over the lazy dog\nand keeps running\n---\nThe quick red fox\njumps over the lazy dog\nthen stops",
"options": [{"key":"mode","label":"Compare by","type":"select","default":"line","options":[{"value":"line","label":"Line"},{"value":"word","label":"Word"}]},{"key":"ws","label":"Whitespace","type":"select","default":"trim","options":[{"value":"trim","label":"Ignore leading/trailing"},{"value":"exact","label":"Exact"}]},{"key":"case","label":"Case","type":"select","default":"sensitive","options":[{"value":"sensitive","label":"Sensitive"},{"value":"insensitive","label":"Ignore case"}]}],
"transform": (text, o) => {
      const raw = String(text || '');
      if (!raw.trim()) return { output: '', note: 'Paste two texts separated by a line containing only ---' };
      const parts = raw.split(/^\s*---\s*$/m);
      if (parts.length < 2) return { error: 'Separate the two texts with a line containing only three dashes: ---' };

      const prep = (s) => {
        // Strip the newlines that sit either side of the --- separator,
        // otherwise each part gains a phantom empty line that reads as a change.
        s = s.replace(/^\n+/, '').replace(/\n+$/, '');
        let arr = o.mode === 'word' ? s.trim().split(/\s+/) : s.split('\n');
        if (o.ws === 'trim') arr = arr.map(x => x.trim());
        return arr;
      };
      const norm = (s) => o.case === 'insensitive' ? s.toLowerCase() : s;

      const A = prep(parts[0]), B = prep(parts[1]);

      /* Standard LCS diff. Bounded because the table is O(n·m) — a pair of
         very large documents would otherwise allocate gigabytes. */
      if (A.length * B.length > 4000000) {
        return { error: 'Those texts are too large to diff here. Compare them in smaller sections.' };
      }
      const m = A.length, n = B.length;
      const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
      for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
          dp[i][j] = norm(A[i]) === norm(B[j])
            ? dp[i + 1][j + 1] + 1
            : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }

      const out = [];
      let i = 0, j = 0, added = 0, removed = 0, same = 0;
      while (i < m && j < n) {
        if (norm(A[i]) === norm(B[j])) { out.push('  ' + A[i]); i++; j++; same++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push('- ' + A[i]); i++; removed++; }
        else { out.push('+ ' + B[j]); j++; added++; }
      }
      while (i < m) { out.push('- ' + A[i++]); removed++; }
      while (j < n) { out.push('+ ' + B[j++]); added++; }

      const unit = o.mode === 'word' ? 'words' : 'lines';
      return {
        output: out.join(o.mode === 'word' ? ' ' : '\n'),
        stats: [
          ['Result', added === 0 && removed === 0 ? 'The two texts are identical' : `${added} added, ${removed} removed`],
          [`Unchanged ${unit}`, String(same)],
          [`Added ${unit}`, String(added)],
          [`Removed ${unit}`, String(removed)],
          ['Similarity', m + n ? ((2 * same / (m + n)) * 100).toFixed(1) + '%' : '—']
        ]
      };
    },
"tips": ["Lines starting with + were added, lines starting with − were removed, and lines with two spaces are unchanged.","Word mode is better for prose where sentences were reworded; line mode is better for code and lists.","Ignoring case and whitespace is useful when comparing text that has passed through different editors.","The algorithm finds the longest common subsequence, which is the same approach Git uses, so the output should look familiar."],
"faq": [{"q":"Why does one changed word show as a whole changed line?","a":"Line mode treats a line as an atom — any change makes it a removal plus an addition. Switch to word mode to see the change at word granularity."}]
};
})();