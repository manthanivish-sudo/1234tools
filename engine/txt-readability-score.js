(function(){
window.TEXT_TOOLS = window.TEXT_TOOLS || {};
window.TEXT_TOOLS["readability-score"] = {
"title": "Readability Score Checker",
"kind": "code",
"description": "Flesch Reading Ease, Flesch-Kincaid grade, Gunning Fog and SMOG scores for any text.",
"keywords": ["readability checker","flesch reading ease","flesch kincaid","gunning fog","reading level","readability score"],
"inputLabel": "Your text",
"outputLabel": "Readability report",
"placeholder": "Paste at least a paragraph for a meaningful score…",
"sample": "The cat sat on the mat. It was a warm day. The sun was bright and the sky was clear. Birds sang in the trees nearby, and a gentle breeze moved through the garden.",
"options": [],
"transform": (text) => {
      const t = String(text || '').trim();
      if (!t) return { output: '', note: 'Paste some text above.' };

      const words = t.split(/\s+/).filter(Boolean);
      const sentences = (t.match(/[^.!?…]+[.!?…]+(\s|$)|[^.!?…]+$/g) || []).filter(s => s.trim()).length || 1;
      if (words.length < 30) {
        return { output: '', note: 'Readability formulas need at least about 100 words to mean anything. Below 30 they are noise.' };
      }

      /* Syllable estimation. No purely mechanical rule is exact in English —
         this is the standard heuristic and is right most of the time. */
      const syllables = (w) => {
        w = w.toLowerCase().replace(/[^a-z]/g, '');
        if (!w) return 0;
        if (w.length <= 3) return 1;
        w = w.replace(/(?:[^laeiouy]es|[^laeiouy]e)$/, '').replace(/^y/, '');
        const m = w.match(/[aeiouy]{1,2}/g);
        return m ? m.length : 1;
      };

      let syl = 0, complex = 0, polysyllables = 0;
      words.forEach(w => {
        const s = syllables(w);
        syl += s;
        if (s >= 3) { complex++; polysyllables++; }
      });

      const wps = words.length / sentences;
      const spw = syl / words.length;

      const flesch = 206.835 - 1.015 * wps - 84.6 * spw;
      const fk = 0.39 * wps + 11.8 * spw - 15.59;
      const fog = 0.4 * (wps + 100 * (complex / words.length));
      const smog = 1.0430 * Math.sqrt(polysyllables * (30 / sentences)) + 3.1291;
      const ari = 4.71 * (t.replace(/\s/g, '').length / words.length) + 0.5 * wps - 21.43;

      const band =
        flesch >= 90 ? 'Very easy — around age 11' :
        flesch >= 80 ? 'Easy — around age 12' :
        flesch >= 70 ? 'Fairly easy — around age 13' :
        flesch >= 60 ? 'Plain English — ages 13 to 15' :
        flesch >= 50 ? 'Fairly difficult — ages 15 to 18' :
        flesch >= 30 ? 'Difficult — university level' :
                       'Very difficult — graduate level';

      const grade = (g) => g <= 0 ? 'below grade 1' : `grade ${g.toFixed(1)}`;
      const output = [
        `Flesch Reading Ease      ${flesch.toFixed(1)}   ${band}`,
        `Flesch-Kincaid Grade     ${fk.toFixed(1)}   ${grade(fk)}`,
        `Gunning Fog Index        ${fog.toFixed(1)}   ${grade(fog)}`,
        `SMOG Index               ${smog.toFixed(1)}   ${grade(smog)}`,
        `Automated Readability    ${ari.toFixed(1)}   ${grade(ari)}`,
        '',
        `Consensus reading level: ${grade((fk + fog + smog + ari) / 4)}`
      ].join('\n');

      return {
        output,
        stats: [
          ['Words', words.length.toLocaleString('en-GB')],
          ['Sentences', String(sentences)],
          ['Words per sentence', wps.toFixed(1)],
          ['Syllables per word', spw.toFixed(2)],
          ['Complex words (3+ syllables)', `${complex} (${((complex / words.length) * 100).toFixed(1)}%)`],
          ['Flesch Reading Ease', flesch.toFixed(1)],
          ['Reading level', band]
        ],
        warn: flesch < 30 ? 'This scores as very difficult. Shorter sentences and plainer words are usually the fastest fix.' : ''
      };
    },
"tips": ["Aim for Flesch Reading Ease of 60–70 for general audiences. UK government guidance targets a reading age of nine for public-facing content.","The single biggest lever is sentence length. Splitting long sentences improves every one of these scores at once.","These formulas count syllables and sentence length. They cannot see whether the writing is clear, accurate or well organised — a fluent nonsense passage scores well.","Syllable counting in English cannot be done perfectly by rule. Scores are indicative rather than exact, and differ slightly between tools."],
"faq": [{"q":"Which score should I use?","a":"Flesch Reading Ease for a quick judgement, Flesch-Kincaid when you need a grade level for a specification. Gunning Fog and SMOG are stricter about long words and are common in healthcare and insurance where comprehension is legally relevant."}]
};
})();