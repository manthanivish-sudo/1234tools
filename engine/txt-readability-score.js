(function(){
window.TEXT_TOOLS = window.TEXT_TOOLS || {};
window.TEXT_TOOLS["readability-score"] = {
"title": "Readability Score Checker",
"kind": "code",
"files": {"accept": ".txt,.md,.markdown,.html,.htm,text/plain,text/markdown,text/html", "label": "Open file"},
"description": "Flesch Reading Ease, Flesch-Kincaid grade, Gunning Fog and SMOG scores for any text.",
"keywords": ["readability checker","flesch reading ease","flesch kincaid","gunning fog","reading level","readability score"],
"inputLabel": "Your text",
"outputLabel": "Readability report",
"placeholder": "Paste at least a paragraph for a meaningful score…",
"sample": "The cat sat on the mat. It was a warm day. The sun was bright and the sky was clear. Birds sang in the trees nearby, and a gentle breeze moved through the garden.",
"options": [
  {"key":"highlight","label":"Mark in the text","type":"select","default":"both","options":[{"value":"both","label":"Long sentences and long words"},{"value":"sentences","label":"Long sentences"},{"value":"words","label":"Long words (3+ syllables)"},{"value":"off","label":"Nothing"}]},
  {"key":"limit","label":"Long sentence: more than (words)","type":"number","default":20,"min":5}
],
"transform": (text, o) => {
      o = o || {};
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

      /* where the hard parts are, by position in the text as typed: each sentence with its own length and
         Reading Ease, and every word of three or more estimated syllables */
      const raw = String(text || '');
      const limit = Math.max(5, Math.floor(Number(o.limit) || 20));
      const sentRe = /[^.!?…]+[.!?…]+(?:\s|$)|[^.!?…]+$/g;
      const sents = [];
      let sm;
      while ((sm = sentRe.exec(raw))) {
        if (!sm[0].trim()) continue;
        const ws = sm[0].match(/\S+/g) || [];
        const sy = ws.reduce((a, w) => a + syllables(w), 0);
        const fl = ws.length ? 206.835 - 1.015 * ws.length - 84.6 * (sy / ws.length) : 100;
        sents.push([sm.index, sm.index + sm[0].length, ws.length, Math.round(fl * 10) / 10, ws.length > limit * 1.5 ? 2 : ws.length > limit ? 1 : 0]);
      }
      const longWords = [];
      const wordRe = /\S+/g;
      let wm;
      while ((wm = wordRe.exec(raw))) if (syllables(wm[0]) >= 3) longWords.push([wm.index, wm.index + wm[0].length]);
      const overLimit = sents.filter((x) => x[4] > 0).length;
      const hardest = sents.map((x, i) => [i, x]).filter((p) => p[1][2] >= 5).sort((a, b) => a[1][3] - b[1][3] || b[1][2] - a[1][2]).slice(0, 5).map((p) => p[0]);

      return {
        output,
        marks: { sents: sents, words: longWords, hardest: hardest, limit: limit, mode: o.highlight || 'both' },
        stats: [
          ['Words', words.length.toLocaleString('en-GB')],
          ['Sentences', String(sentences)],
          ['Words per sentence', wps.toFixed(1)],
          ['Syllables per word', spw.toFixed(2)],
          ['Complex words (3+ syllables)', `${complex} (${((complex / words.length) * 100).toFixed(1)}%)`],
          ['Sentences over ' + limit + ' words', String(overLimit)],
          ['Flesch Reading Ease', flesch.toFixed(1)],
          ['Reading level', band]
        ],
        warn: flesch < 30 ? 'This scores as very difficult. Shorter sentences and plainer words are usually the fastest fix.' : ''
      };
    },
"tips": ["Long sentences are shaded amber past the limit you set (20 words by default) and red past one and a half times it; words of three or more syllables are underlined; the five hardest sentences are listed first.","Aim for Flesch Reading Ease of 60–70 for general audiences. UK government guidance targets a reading age of nine for public-facing content.","The single biggest lever is sentence length. Splitting long sentences improves every one of these scores at once.","These formulas count syllables and sentence length. They cannot see whether the writing is clear, accurate or well organised — a fluent nonsense passage scores well.","Syllable counting in English cannot be done perfectly by rule. Scores are indicative rather than exact, and differ slightly between tools."],
"faq": [{"q":"Which score should I use?","a":"Flesch Reading Ease for a quick judgement, Flesch-Kincaid when you need a grade level for a specification. Gunning Fog and SMOG are stricter about long words and are common in healthcare and insurance where comprehension is legally relevant."}],
"render": function (res, ctx) { rsRender(res, ctx); }
};

function rsRender(res, ctx) {
  const box = ctx.extra;
  box.textContent = '';
  const m = res && res.marks;
  if (!m || res.error || m.mode === 'off') return;
  const el = ctx.el;
  const text = ctx.text;
  const wrap = el('div', 'io-pane rs-view');
  const head = el('div', 'io-head');
  head.appendChild(el('span', 'io-label', 'Your text, marked'));
  const legend = el('span', 'rs-legend');
  legend.appendChild(el('span', 'rs-amber', 'over ' + m.limit + ' words'));
  legend.appendChild(el('span', 'rs-red', 'over ' + Math.round(m.limit * 1.5)));
  legend.appendChild(el('span', 'rs-long', 'long word'));
  head.appendChild(legend);
  wrap.appendChild(head);
  const showS = m.mode === 'both' || m.mode === 'sentences', showW = m.mode === 'both' || m.mode === 'words';
  const CAP = 40000;
  const body = el('div', 'rs-text');
  let wi = 0;
  const words = m.words;
  const addPlain = function (parent, from, to) {
    while (from < to) {
      while (wi < words.length && words[wi][1] <= from) wi++;
      if (showW && wi < words.length && words[wi][0] < to) {
        const w = words[wi];
        if (w[0] > from) parent.appendChild(document.createTextNode(text.slice(from, w[0])));
        parent.appendChild(el('span', 'rs-long', text.slice(w[0], Math.min(w[1], to))));
        from = Math.min(w[1], to);
        if (w[1] <= to) wi++;
      } else { parent.appendChild(document.createTextNode(text.slice(from, to))); from = to; }
    }
  };
  let at = 0;
  const end = Math.min(text.length, CAP);
  const nodes = [];
  m.sents.forEach(function (s, i) {
    if (s[0] >= end) return;
    if (s[0] > at) addPlain(body, at, s[0]);
    const e = Math.min(s[1], end);
    if (showS && s[4] > 0) {
      const sp = el('span', s[4] === 2 ? 'rs-sent rs-red' : 'rs-sent rs-amber');
      sp.id = 'rs-s' + i;
      sp.title = s[2] + ' words';
      addPlain(sp, s[0], e);
      body.appendChild(sp);
    } else {
      const sp = el('span', 'rs-sent');
      sp.id = 'rs-s' + i;
      addPlain(sp, s[0], e);
      body.appendChild(sp);
    }
    at = e;
  });
  if (at < end) addPlain(body, at, end);
  if (text.length > CAP) body.appendChild(el('p', 'rs-cut', 'The marked view shows the first ' + CAP.toLocaleString('en-GB') + ' characters; the scores use all of it.'));
  if (m.hardest.length && showS) {
    const hd = el('div', 'rs-hard');
    hd.appendChild(el('strong', null, 'Hardest sentences'));
    const ol = el('ol');
    m.hardest.forEach(function (i) {
      const s = m.sents[i];
      const li = el('li');
      const b = el('button', 'rs-jump', text.slice(s[0], s[1]).trim().replace(/\s+/g, ' ').slice(0, 140) + (s[1] - s[0] > 140 ? '…' : ''));
      b.type = 'button';
      b.addEventListener('click', function () { const t = document.getElementById('rs-s' + i); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('is-flash'); setTimeout(function () { t.classList.remove('is-flash'); }, 1500); } });
      li.appendChild(b);
      li.appendChild(el('span', 'rs-meta', ' ' + s[2] + ' words · Reading Ease ' + s[3].toFixed(1)));
      ol.appendChild(li);
    });
    hd.appendChild(ol);
    wrap.appendChild(hd);
  }
  wrap.appendChild(body);
  box.appendChild(wrap);
}
})();