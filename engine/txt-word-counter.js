(function(){
window.TEXT_TOOLS = window.TEXT_TOOLS || {};

/* ===== words ===== */
const WC_CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const WC_SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('und', { granularity: 'word' }) : null;
/* A run between spaces is one word, except Chinese and Japanese, which are written without spaces: the
   browser's own word segmenter splits those runs (and where there is none, each character is a word). */
function wcWords(text) {
  const out = [];
  (text.trim().match(/\S+/g) || []).forEach(function (tok) {
    if (!WC_CJK.test(tok)) { out.push(tok); return; }
    if (WC_SEG) {
      for (const s of WC_SEG.segment(tok)) if (s.isWordLike) out.push(s.segment);
      return;
    }
    let run = '';
    for (const ch of tok) {
      if (WC_CJK.test(ch)) { if (run && /[\p{L}\p{N}]/u.test(run)) out.push(run); run = ''; out.push(ch); } else run += ch;
    }
    if (run && /[\p{L}\p{N}]/u.test(run)) out.push(run);
  });
  return out;
}

/* ===== platform limits ===== */
const WC_GSM = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const WC_GSM_EXT = '^{}\\[~]|€\f';
function wcSms(text) {
  let units = 0, gsm = true;
  for (const ch of text) {
    if (WC_GSM.indexOf(ch) >= 0) units++;
    else if (WC_GSM_EXT.indexOf(ch) >= 0) units += 2;
    else { gsm = false; break; }
  }
  if (gsm) return { kind: 'GSM', used: units, single: 160, multi: 153 };
  return { kind: 'Unicode', used: text.length, single: 70, multi: 67 };
}
/* X: links count 23; Latin-range characters 1; most other characters, and each emoji, 2 */
function wcX(text) {
  let n = 0;
  const rest = text.replace(/https?:\/\/[^\s]+/g, function () { n += 23; return ''; });
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('und', { granularity: 'grapheme' }) : null;
  const one = function (g) {
    if (/\p{Extended_Pictographic}/u.test(g)) return 2;
    let w = 0;
    for (const ch of g) { const c = ch.codePointAt(0); w += (c <= 4351 || (c >= 8192 && c <= 8205) || (c >= 8208 && c <= 8223) || (c >= 8242 && c <= 8247)) ? 1 : 2; }
    return w;
  };
  if (seg) for (const s of seg.segment(rest.normalize('NFC'))) n += one(s.segment);
  else for (const ch of rest.normalize('NFC')) n += one(ch);
  return n;
}
function wcLimits(t, chars, custom) {
  const sms = wcSms(t);
  const list = [
    { id: 'x', label: 'X post', used: wcX(t), limit: 280, unit: 'weight', note: 'Links count 23; most non-Latin characters and emoji count 2.' },
    { id: 'sms', label: 'SMS (one message)', used: sms.used, limit: sms.single, unit: sms.kind === 'GSM' ? 'GSM characters' : 'Unicode characters', note: sms.used > sms.single ? Math.ceil(sms.used / sms.multi) + ' messages of ' + sms.multi + (sms.kind === 'GSM' ? '' : '') + ' when joined' : (sms.kind === 'Unicode' ? 'An emoji or non-GSM letter switches the message to Unicode: 70 characters' : '€ and [ ] { } count 2 in GSM') },
    { id: 'title', label: 'Page title (SEO)', used: chars, limit: 60, unit: 'characters', note: 'Google shows around 60 characters' },
    { id: 'desc', label: 'Meta description', used: chars, limit: 155, unit: 'characters', note: 'Google shows around 155 characters' },
    { id: 'yt', label: 'YouTube title', used: chars, limit: 100, unit: 'characters', note: '' },
    { id: 'ads', label: 'Google Ads headline', used: chars, limit: 30, unit: 'characters', note: '' },
    { id: 'ig', label: 'Instagram caption', used: chars, limit: 2200, unit: 'characters', note: '' },
    { id: 'li', label: 'LinkedIn post', used: chars, limit: 3000, unit: 'characters', note: '' }
  ];
  if (custom > 0) list.push({ id: 'custom', label: 'Your limit', used: chars, limit: custom, unit: 'characters', note: '' });
  return list;
}

window.TEXT_TOOLS["word-counter"] = {
"title": "Word & Character Counter",
"kind": "code",
"files": {"accept": ".txt,.md,.markdown,.csv,.html,.htm,text/plain,text/markdown,text/html", "label": "Open file"},
"description": "Count words, characters, sentences and paragraphs, with a word goal, bars for X, SMS, SEO and social limits, Chinese and Japanese counting, reading time and phrase density.",
"keywords": ["word counter","character counter","word count tool","reading time","letter count","text statistics","character limit","sms length","tweet length"],
"inputLabel": "Your text",
"outputLabel": "Analysis",
"placeholder": "Paste or type your text here…",
"sample": "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.\n\nHow vexingly quick daft zebras jump! The five boxing wizards jump quickly.",
"options": [
  {"key":"density","label":"Keyword density","type":"select","default":"10","options":[{"value":"0","label":"Hide"},{"value":"10","label":"Top 10"},{"value":"25","label":"Top 25"}]},
  {"key":"gram","label":"Count","type":"select","default":"1","options":[{"value":"1","label":"Single words"},{"value":"2","label":"Two-word phrases"},{"value":"3","label":"Three-word phrases"}]},
  {"key":"ignoreCommon","label":"Ignore common words","type":"select","default":"yes","options":[{"value":"yes","label":"Yes"},{"value":"no","label":"No"}]},
  {"key":"goal","label":"Word goal (0 = none)","type":"number","default":0,"min":0},
  {"key":"custom","label":"Your character limit (0 = none)","type":"number","default":0,"min":0},
  {"key":"limits","label":"Limit bars","type":"select","default":"show","options":[{"value":"show","label":"Show"},{"value":"hide","label":"Hide"}]}
],
"transform": (text, o) => {
      const t = String(text || '');
      if (!t.trim()) return { output: '', note: 'Type or paste some text above.' };

      const words = wcWords(t);
      const chars = t.length;
      const noSpaces = t.replace(/\s/g, '').length;
      const sentences = (t.replace(/([。！？]+)/g, '$1 ').match(/[^.!?…。！？]+[.!?…。！？]+(\s|$)|[^.!?…。！？]+$/g) || []).filter(s => s.trim()).length;
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
      /* A word for the density list keeps its letters, combining marks and
         digits in any script, plus apostrophes and hyphens. Cutting to a–z
         once turned café into caf and deleted Hindi words outright: a
         Devanagari vowel sign is a combining mark (\p{M}), not a letter, so
         it has to be kept too. NFC first, so a decomposed é matches é. */
      const NOT_WORD = /[^\p{L}\p{M}\p{N}'-]/gu;
      const clean = words.map(w => w.normalize('NFC').toLowerCase().replace(NOT_WORD, ''));
      const gram = Math.max(1, Math.min(3, Number(o.gram) || 1));
      const freq = {};
      const ignore = o.ignoreCommon === 'yes';
      if (gram === 1) {
        clean.forEach(k => {
          if (!k) return;
          if (ignore && STOP.has(k)) return;
          freq[k] = (freq[k] || 0) + 1;
        });
      } else {
        /* a phrase is gram consecutive words with no punctuation-only word inside; with the filter on it must not
           start or end with a common word */
        for (let i = 0; i + gram <= clean.length; i++) {
          const g = clean.slice(i, i + gram);
          if (g.some(x => !x)) continue;
          if (ignore && (STOP.has(g[0]) || STOP.has(g[gram - 1]))) continue;
          const k = g.join(' ');
          freq[k] = (freq[k] || 0) + 1;
        }
      }
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

      let output = '';
      const n = Number(o.density) || 0;
      if (n > 0 && top.length) {
        const width = Math.max(...top.slice(0, n).map(([w]) => w.length), gram === 1 ? 4 : 6);
        const denom = gram === 1 ? words.length : Math.max(1, clean.length - gram + 1);
        output = top.slice(0, n).map(([w, c]) =>
          `${w.padEnd(width)}  ${String(c).padStart(4)}   ${((c / denom) * 100).toFixed(2)}%`
        ).join('\n');
        const label = gram === 1 ? 'WORD' : 'PHRASE';
        output = `${label}${' '.repeat(Math.max(0, width - label.length))}  COUNT   DENSITY\n${'─'.repeat(width + 18)}\n${output}`;
      }

      const longest = words.reduce((a, b) => {
        const c = b.normalize('NFC').replace(/[^\p{L}\p{M}\p{N}_'-]/gu, '');
        return [...c].length > [...a].length ? c : a;
      }, '');

      const goal = Math.max(0, Math.floor(Number(o.goal) || 0));
      const custom = Math.max(0, Math.floor(Number(o.custom) || 0));
      const res = {
        output,
        stats: [
          ['Words', words.length.toLocaleString('en-GB')],
          ['Characters', chars.toLocaleString('en-GB')],
          ['Characters (no spaces)', noSpaces.toLocaleString('en-GB')],
          ['Sentences', String(sentences)],
          ['Paragraphs', String(paragraphs)],
          ['Lines', String(lines)],
          [gram === 1 ? 'Unique words' : 'Unique phrases', String(Object.keys(freq).length)],
          ['Average word length', words.length ? (noSpaces / words.length).toFixed(1) + ' characters' : '—'],
          ['Average sentence length', sentences ? (words.length / sentences).toFixed(1) + ' words' : '—'],
          ['Longest word', longest || '—'],
          ['Reading time', mmss(readMin)],
          ['Speaking time', mmss(speakMin)]
        ],
        counts: { words: words.length, chars: chars },
        goal: goal ? { goal: goal, words: words.length } : null
      };
      if (o.limits !== 'hide') res.limits = wcLimits(t, chars, custom);
      if (custom > 0 && o.limits === 'hide') res.limits = wcLimits(t, chars, custom).filter(x => x.id === 'custom');
      return res;
    },
"tips": ["Reading time assumes 238 words per minute and speaking time 140, both commonly cited averages for adults. Technical material reads considerably slower.","Keyword density above roughly 3% for a single term tends to read as stuffed rather than focused.","Common words are filtered from the density list by default, since \"the\" topping every list tells you nothing.","Character counts including spaces are what social platforms and SMS limits measure.","Set a word goal for an essay or article and the bar fills as you write; the limit bars show X, SMS, search-result and social limits at once.","Chinese and Japanese text has no spaces, so each word is found with your browser's own word segmenter; Korean, like English, is counted between spaces."],
"faq": [{"q":"How are sentences counted?","a":"By splitting on full stops, question marks, exclamation marks, ellipses and their Chinese and Japanese forms. Abbreviations such as \"Dr.\" and decimal numbers will inflate the count slightly — no purely mechanical method avoids that."},{"q":"Is my text sent anywhere?","a":"No. Everything is counted in your browser. Nothing is transmitted, logged or stored, which matters if you are checking a draft that is not public yet."},{"q":"Is my text kept for next time?","a":"A draft of what you type is kept in this browser only, so you can restore it after closing the tab; Clear removes it. It is never sent anywhere."}],
"render": function (res, ctx) { wcRender(res, ctx); }
};

function wcRender(res, ctx) {
  const box = ctx.extra;
  box.textContent = '';
  if (!res || res.error || (!res.limits && !res.goal)) return;
  const el = ctx.el;
  const wrap = el('div', 'io-pane wc-bars');
  const head = el('div', 'io-head');
  head.appendChild(el('span', 'io-label', 'Goal and limits'));
  wrap.appendChild(head);
  const grid = el('div', 'wc-grid');
  const bar = function (label, used, limit, unit, note) {
    const row = el('div', 'wc-row');
    const pct = limit ? Math.min(100, used / limit * 100) : 0;
    const over = limit && used > limit;
    row.appendChild(el('div', 'wc-label', label));
    const track = el('div', 'wc-track');
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', label);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(limit));
    track.setAttribute('aria-valuenow', String(Math.min(used, limit)));
    const fill = el('div', 'wc-fill' + (over ? ' is-over' : pct >= 90 ? ' is-near' : ''));
    fill.style.width = pct + '%';
    track.appendChild(fill);
    row.appendChild(track);
    const left = limit - used;
    row.appendChild(el('div', 'wc-num', used.toLocaleString('en-GB') + ' of ' + limit.toLocaleString('en-GB') + ' · ' + (over ? (-left).toLocaleString('en-GB') + ' over' : left.toLocaleString('en-GB') + ' left')));
    if (note) row.appendChild(el('div', 'wc-note', note));
    grid.appendChild(row);
  };
  if (res.goal) bar('Word goal', res.goal.words, res.goal.goal, 'words', '');
  (res.limits || []).forEach(function (l) { bar(l.label, l.used, l.limit, l.unit, l.note); });
  wrap.appendChild(grid);
  box.appendChild(wrap);
}
})();
