(function(){
window.TEXT_TOOLS = window.TEXT_TOOLS || {};
window.TEXT_TOOLS["word-counter"] = {
"title": "Word & Character Counter",
"kind": "code",
"description": "Count words, characters, sentences and paragraphs, with reading time and keyword density.",
"keywords": ["word counter","character counter","word count tool","reading time","letter count","text statistics"],
"inputLabel": "Your text",
"outputLabel": "Analysis",
"placeholder": "Paste or type your text here…",
"sample": "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.\n\nHow vexingly quick daft zebras jump! The five boxing wizards jump quickly.",
"options": [{"key":"density","label":"Keyword density","type":"select","default":"10","options":[{"value":"0","label":"Hide"},{"value":"10","label":"Top 10"},{"value":"25","label":"Top 25"}]},{"key":"ignoreCommon","label":"Ignore common words","type":"select","default":"yes","options":[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]}],
"transform": (text, o) => {
      const t = String(text || '');
      if (!t.trim()) return { output: '', note: 'Type or paste some text above.' };

      const words = t.trim().split(/\s+/).filter(Boolean);
      const chars = t.length;
      const noSpaces = t.replace(/\s/g, '').length;
      const sentences = (t.match(/[^.!?…]+[.!?…]+(\s|$)|[^.!?…]+$/g) || []).filter(s => s.trim()).length;
      const paragraphs = t.split(/\n\s*\n/).filter(p => p.trim()).length;
      const lines = t.split('\n').length;

      // 238 wpm reading, 140 wpm speaking — commonly cited averages
      const readMin = words.length / 238;
      const speakMin = words.length / 140;
      const mmss = (m) => {
        const s = Math.round(m * 60);
        return s < 60 ? `${s} sec` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} sec`;
      };

      const STOP = new Set(['the','a','an','and','or','but','of','to','in','on','at','for','with','is','are',
        'was','were','be','been','it','its','this','that','these','those','as','by','from','has','have','had',
        'i','you','he','she','they','we','my','your','not','no','so','if','then','than','there','their','will']);
      const freq = {};
      words.forEach(w => {
        const k = w.toLowerCase().replace(/[^a-z0-9'-]/g, '');
        if (!k) return;
        if (o.ignoreCommon === 'yes' && STOP.has(k)) return;
        freq[k] = (freq[k] || 0) + 1;
      });
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

      let output = '';
      const n = Number(o.density) || 0;
      if (n > 0 && top.length) {
        const width = Math.max(...top.slice(0, n).map(([w]) => w.length));
        output = top.slice(0, n).map(([w, c]) =>
          `${w.padEnd(width)}  ${String(c).padStart(4)}   ${((c / words.length) * 100).toFixed(2)}%`
        ).join('\n');
        output = `WORD${' '.repeat(Math.max(0, width - 4))}  COUNT   DENSITY\n${'─'.repeat(width + 18)}\n${output}`;
      }

      const longest = words.reduce((a, b) => b.replace(/[^\w'-]/g, '').length > a.length ? b.replace(/[^\w'-]/g, '') : a, '');

      return {
        output,
        stats: [
          ['Words', words.length.toLocaleString('en-GB')],
          ['Characters', chars.toLocaleString('en-GB')],
          ['Characters (no spaces)', noSpaces.toLocaleString('en-GB')],
          ['Sentences', String(sentences)],
          ['Paragraphs', String(paragraphs)],
          ['Lines', String(lines)],
          ['Unique words', String(Object.keys(freq).length)],
          ['Average word length', words.length ? (noSpaces / words.length).toFixed(1) + ' characters' : '—'],
          ['Average sentence length', sentences ? (words.length / sentences).toFixed(1) + ' words' : '—'],
          ['Longest word', longest || '—'],
          ['Reading time', mmss(readMin)],
          ['Speaking time', mmss(speakMin)]
        ]
      };
    },
"tips": ["Reading time assumes 238 words per minute and speaking time 140, both commonly cited averages for adults. Technical material reads considerably slower.","Keyword density above roughly 3% for a single term tends to read as stuffed rather than focused.","Common words are filtered from the density list by default, since \"the\" topping every list tells you nothing.","Character counts including spaces are what social platforms and SMS limits measure."],
"faq": [{"q":"How are sentences counted?","a":"By splitting on full stops, question marks, exclamation marks and ellipses. Abbreviations such as \"Dr.\" and decimal numbers will inflate the count slightly — no purely mechanical method avoids that."},{"q":"Is my text sent anywhere?","a":"No. Everything is counted in your browser. Nothing is transmitted, logged or stored, which matters if you are checking a draft that is not public yet."}]
};
})();