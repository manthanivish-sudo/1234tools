(function(){
window.TEXT_TOOLS = window.TEXT_TOOLS || {};

/* ===== the diff =====
   Myers' O(ND) shortest edit script (the algorithm behind Git's diff), after
   trimming the lines the two texts share at each end. If the texts differ so
   much that the script would be longer than TD_MAX_D edits, the middle is
   shown as one replacement and the page says so, rather than hanging. */
const TD_MAX_D = 3000;
const TD_US = String.fromCharCode(31);
const TD_SEP = '\n' + TD_US + TD_US + TD_US + '\n';

function tdMyers(A, B, maxD) {
  const N = A.length, M = B.length;
  const max = Math.min(N + M, maxD);
  const off = max + 1;
  const V = new Int32Array(2 * max + 3);
  const trace = [];
  let found = -1;
  for (let d = 0; d <= max && found < 0; d++) {
    trace.push(V.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && V[off + k - 1] < V[off + k + 1])) x = V[off + k + 1]; else x = V[off + k - 1] + 1;
      let y = x - k;
      while (x < N && y < M && A[x] === B[y]) { x++; y++; }
      V[off + k] = x;
      if (x >= N && y >= M) { found = d; break; }
    }
  }
  if (found < 0) return null;
  const ops = [];
  let x = N, y = M;
  for (let d = found; d > 0; d--) {
    const Vd = trace[d];
    const at = function (k) { return Vd[k + d + 1]; };
    const k = x - y;
    const prevK = (k === -d || (k !== d && at(k - 1) < at(k + 1))) ? k + 1 : k - 1;
    const px = at(prevK), py = px - prevK;
    while (x > px && y > py) { x--; y--; ops.push({ t: '=', a: x, b: y }); }
    if (x === px) { y--; ops.push({ t: '+', b: y }); } else { x--; ops.push({ t: '-', a: x }); }
  }
  while (x > 0 && y > 0) { x--; y--; ops.push({ t: '=', a: x, b: y }); }
  return ops.reverse();
}
function tdDiff(KA, KB) {
  let pre = 0;
  while (pre < KA.length && pre < KB.length && KA[pre] === KB[pre]) pre++;
  let suf = 0;
  while (suf < KA.length - pre && suf < KB.length - pre && KA[KA.length - 1 - suf] === KB[KB.length - 1 - suf]) suf++;
  const midA = KA.slice(pre, KA.length - suf), midB = KB.slice(pre, KB.length - suf);
  let mid = (midA.length || midB.length) ? tdMyers(midA, midB, TD_MAX_D) : [];
  let coarse = false;
  if (!mid) {
    coarse = true;
    mid = [];
    for (let i = 0; i < midA.length; i++) mid.push({ t: '-', a: i });
    for (let j = 0; j < midB.length; j++) mid.push({ t: '+', b: j });
  }
  const ops = [];
  for (let i = 0; i < pre; i++) ops.push({ t: '=', a: i, b: i });
  mid.forEach(function (o) { ops.push(o.t === '=' ? { t: '=', a: o.a + pre, b: o.b + pre } : o.t === '-' ? { t: '-', a: o.a + pre } : { t: '+', b: o.b + pre }); });
  for (let i = 0; i < suf; i++) ops.push({ t: '=', a: KA.length - suf + i, b: KB.length - suf + i });
  /* in every run of changes, the removals come before the additions */
  const out = [];
  for (let i = 0; i < ops.length;) {
    if (ops[i].t === '=') { out.push(ops[i++]); continue; }
    const dels = [], ins = [];
    while (i < ops.length && ops[i].t !== '=') { (ops[i].t === '-' ? dels : ins).push(ops[i]); i++; }
    dels.forEach(function (o) { out.push(o); });
    ins.forEach(function (o) { out.push(o); });
  }
  return { ops: out, coarse: coarse };
}

/* ===== reading the two texts ===== */
function tdSplit(raw) {
  const i = raw.indexOf(TD_SEP);
  if (i >= 0) return { a: raw.slice(0, i), b: raw.slice(i + TD_SEP.length), legacy: false, extra: 0 };
  /* a single box: the texts are cut at the first line holding only ---, once;
     later --- lines belong to the second text (a Markdown rule, YAML front matter) */
  const SEP = /^[ \t]*---[ \t\r]*$/m;
  const cut = SEP.exec(raw);
  if (!cut) return null;
  const second = raw.slice(cut.index + cut[0].length);
  return { a: raw.slice(0, cut.index), b: second, legacy: true, extra: (second.match(/^[ \t]*---[ \t\r]*$/gm) || []).length };
}
function tdTokens(s, mode, legacy) {
  s = String(s).replace(/\r\n?/g, '\n');
  if (legacy) s = s.replace(/^\n+/, '');
  s = s.replace(/\n+$/, '');
  if (mode === 'line') return s === '' ? [] : s.split('\n');
  if (mode === 'word') return s.match(/\s+|\S+/g) || [];
  return Array.from(s);
}
function tdKey(tok, o) {
  let k = tok;
  if (o.mode === 'word') { if (/^\s/.test(k)) return o.ws === 'exact' ? k : ' '; }
  else if (o.mode === 'line') { if (o.ws === 'trim') k = k.trim(); else if (o.ws === 'all') k = k.replace(/\s+/g, ''); }
  else if (o.ws === 'all' && /\s/.test(k)) k = '';
  if (o.case === 'insensitive') k = k.toLowerCase();
  return k;
}

/* ===== the unified diff text (line mode), and the bracketed text (word, character) ===== */
function tdUnified(ops, A, B, ctxN) {
  const idx = [];
  ops.forEach(function (o, k) { if (o.t !== '=') idx.push(k); });
  if (!idx.length) return '';
  const aBefore = new Array(ops.length + 1), bBefore = new Array(ops.length + 1);
  let ca = 0, cb = 0;
  ops.forEach(function (o, k) { aBefore[k] = ca; bBefore[k] = cb; if (o.t !== '+') ca++; if (o.t !== '-') cb++; });
  const groups = [];
  let s = -1, e = -1;
  idx.forEach(function (k) {
    if (s < 0) { s = Math.max(0, k - ctxN); e = Math.min(ops.length - 1, k + ctxN); }
    else if (k - ctxN <= e + 1) e = Math.min(ops.length - 1, k + ctxN);
    else { groups.push([s, e]); s = Math.max(0, k - ctxN); e = Math.min(ops.length - 1, k + ctxN); }
  });
  groups.push([s, e]);
  const out = ['--- original', '+++ changed'];
  groups.forEach(function (g) {
    let oc = 0, nc = 0;
    const body = [];
    for (let k = g[0]; k <= g[1]; k++) {
      const o = ops[k];
      if (o.t === '=') { oc++; nc++; body.push(' ' + A[o.a]); }
      else if (o.t === '-') { oc++; body.push('-' + A[o.a]); }
      else { nc++; body.push('+' + B[o.b]); }
    }
    const os = oc ? aBefore[g[0]] + 1 : aBefore[g[0]], ns = nc ? bBefore[g[0]] + 1 : bBefore[g[0]];
    out.push('@@ -' + os + (oc === 1 ? '' : ',' + oc) + ' +' + ns + (nc === 1 ? '' : ',' + nc) + ' @@');
    body.forEach(function (l) { out.push(l); });
  });
  return out.join('\n');
}
function tdBracketed(ops, A, B) {
  let out = '';
  for (let i = 0; i < ops.length;) {
    const o = ops[i];
    if (o.t === '=') { out += A[o.a]; i++; continue; }
    let rem = '', add = '';
    while (i < ops.length && ops[i].t !== '=') { if (ops[i].t === '-') rem += A[ops[i].a]; else add += B[ops[i].b]; i++; }
    if (rem) out += '[-' + rem + '-]';
    if (add) out += '{+' + add + '+}';
  }
  return out;
}

window.TEXT_TOOLS["text-diff"] = {
"title": "Text Compare & Diff Tool",
"kind": "code",
"description": "Compare two texts side by side or inline, by line, word or character, with colour, merge arrows, files, and export as HTML or a unified .diff.",
"keywords": ["text compare","diff tool","compare two texts","text difference checker","diff checker","unified diff","merge text","compare files"],
"inputLabel": "Original and changed text",
"outputLabel": "Differences",
"placeholder": "First version",
"sample": "The quick brown fox\njumps over the lazy dog\nand keeps running\n---\nThe quick red fox\njumps over the lazy dog\nthen stops",
"highlight": (o) => (o.mode === 'line' ? 'diff' : null),
"gutter": false,
"autosave": true,
"options": [
  {"key":"mode","label":"Compare by","type":"select","default":"line","options":[{"value":"line","label":"Line"},{"value":"word","label":"Word"},{"value":"char","label":"Character"}]},
  {"key":"ws","label":"Whitespace","type":"select","default":"trim","options":[{"value":"trim","label":"Ignore leading/trailing"},{"value":"exact","label":"Exact"},{"value":"all","label":"Ignore all whitespace"}]},
  {"key":"case","label":"Case","type":"select","default":"sensitive","options":[{"value":"sensitive","label":"Sensitive"},{"value":"insensitive","label":"Ignore case"}]}
],
"transform": (text, o) => {
      const raw = String(text || '');
      if (!raw.trim() || raw === TD_SEP) return { output: '', note: 'Paste or open the two texts, one in each box.' };
      const parts = tdSplit(raw);
      if (!parts) return { error: 'Separate the two texts with a line containing only three dashes: ---' };
      const TA = tdTokens(parts.a, o.mode, parts.legacy), TB = tdTokens(parts.b, o.mode, parts.legacy);
      /* "ignore all whitespace" in word mode drops the spaces between words altogether */
      const dropWs = o.mode === 'word' && o.ws === 'all';
      const A = dropWs ? TA.filter((t) => !/^\s/.test(t)) : TA, B = dropWs ? TB.filter((t) => !/^\s/.test(t)) : TB;
      const d = tdDiff(A.map((t) => tdKey(t, o)), B.map((t) => tdKey(t, o)));
      const ops = d.ops;
      const isWord = (t) => o.mode !== 'word' || !/^\s/.test(t);
      let added = 0, removed = 0, same = 0, total = 0;
      ops.forEach((p) => {
        if (p.t === '=') { if (isWord(A[p.a])) same++; }
        else if (p.t === '-') { if (isWord(A[p.a])) removed++; }
        else if (isWord(B[p.b])) added++;
      });
      const m = A.filter(isWord).length, n = B.filter(isWord).length;
      const unit = o.mode === 'word' ? 'words' : o.mode === 'char' ? 'characters' : 'lines';
      const identical = added === 0 && removed === 0;
      let output;
      if (o.mode === 'line') output = identical ? '' : tdUnified(ops, A, B, 3);
      else output = identical ? '' : tdBracketed(ops, A, B);
      const notes = [];
      if (parts.extra) notes.push('The texts were split at the first --- line. ' + (parts.extra === 1 ? 'The other --- line was' : 'The other ' + parts.extra + ' --- lines were') + ' compared as part of the second text.');
      if (d.coarse) notes.push('These texts differ so much that they cannot be lined up (over ' + TD_MAX_D + ' edits), so the part between the matching start and end is shown as one replacement.');
      if (identical) notes.push(o.mode === 'line' && (o.ws !== 'exact' || o.case === 'insensitive') && TA.join('\n') !== TB.join('\n') ? 'No differences with these options (the texts differ only in ' + (o.case === 'insensitive' ? 'case or ' : '') + 'spacing).' : 'The two texts are identical.');
      return {
        output: output,
        stats: [
          ['Result', identical ? 'The two texts are identical' : added + ' added, ' + removed + ' removed'],
          ['Unchanged ' + unit, String(same)],
          ['Added ' + unit, String(added)],
          ['Removed ' + unit, String(removed)],
          ['Similarity', m + n ? ((2 * same / (m + n)) * 100).toFixed(1) + '%' : '—']
        ],
        note: notes.join(' '),
        download: o.mode === 'line' ? { ext: 'diff', type: 'text/x-diff', filename: 'text-diff.diff' } : { ext: 'txt', type: 'text/plain', filename: 'text-diff.txt' },
        diff: { mode: o.mode, A: A, B: B, ops: ops, identical: identical, legacy: parts.legacy }
      };
    },
"tips": ["In the Differences text, lines starting with + were added, lines starting with − were removed, and lines with a space are unchanged; Download saves it as a unified .diff that git apply and patch read.","Word mode is better for prose where sentences were reworded; line mode is better for code and lists; Character mode marks single-letter edits.","Ignoring case and whitespace is useful when comparing text that has passed through different editors; Ignore all whitespace also matches lines that differ only by spaces inside them.","The merge arrows beside each change copy that change into the other text, in line mode.","The algorithm is Myers' shortest edit script, the same family Git uses, so the output should look familiar."],
"faq": [{"q":"Why does one changed word show as a whole changed line?","a":"Line mode treats a line as an atom: any change makes it a removal plus an addition, though the changed words are marked inside both lines. Switch to word or character mode to see only the change."},{"q":"Are my texts uploaded?","a":"No. Both texts, and any file you open, stay in your browser."}],
"mount": tdMount,
"render": tdRender
};

/* ===== the page: two boxes in, a coloured view out ===== */
function tdSegments(a, b, o) {
  /* the words and symbols that differ inside a changed pair of lines */
  const re = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;
  const TA = a.match(re) || [], TB = b.match(re) || [];
  const key = function (t) { return o.case === 'insensitive' ? t.toLowerCase() : (o.ws === 'all' && /^\s/.test(t) ? ' ' : t); };
  const d = tdDiff(TA.map(key), TB.map(key));
  if (d.coarse) return null;
  const L = [], R = [];
  let changed = 0;
  d.ops.forEach(function (p) {
    if (p.t === '=') { L.push(['=', TA[p.a]]); R.push(['=', TB[p.b]]); }
    else if (p.t === '-') { L.push(['-', TA[p.a]]); changed += TA[p.a].length; }
    else { R.push(['+', TB[p.b]]); changed += TB[p.b].length; }
  });
  if (changed > 0.7 * (a.length + b.length)) return null;
  const merge = function (list) {
    const out = [];
    list.forEach(function (s) { const last = out[out.length - 1]; if (last && last[0] === s[0]) last[1] += s[1]; else out.push([s[0], s[1]]); });
    return out;
  };
  return { l: merge(L), r: merge(R) };
}

/* rows for the line views: equal rows, and changed rows pairing the i-th
   removed line with the i-th added line, each run of changes being one hunk */
function tdRows(model) {
  const rows = [];
  const ops = model.ops;
  let hunk = 0;
  for (let i = 0; i < ops.length;) {
    const p = ops[i];
    if (p.t === '=') { rows.push({ k: 'eq', l: p.a, r: p.b }); i++; continue; }
    const dels = [], ins = [];
    let a0 = -1, b0 = -1;
    while (i < ops.length && ops[i].t !== '=') { (ops[i].t === '-' ? dels : ins).push(ops[i]); i++; }
    const prev = rows.length ? rows[rows.length - 1] : null;
    const nextA = dels.length ? dels[0].a : (prev ? (prev.l >= 0 ? prev.l + 1 : 0) : 0);
    const nextB = ins.length ? ins[0].b : (prev ? (prev.r >= 0 ? prev.r + 1 : 0) : 0);
    const h = { id: hunk++, a0: nextA, a1: nextA + dels.length, b0: nextB, b1: nextB + ins.length };
    const n = Math.max(dels.length, ins.length);
    for (let k = 0; k < n; k++) rows.push({ k: 'chg', l: k < dels.length ? dels[k].a : -1, r: k < ins.length ? ins[k].b : -1, h: h, first: k === 0 });
  }
  /* long runs of unchanged lines fold away, leaving three lines of context */
  const out = [];
  for (let i = 0; i < rows.length;) {
    if (rows[i].k !== 'eq') { out.push(rows[i++]); continue; }
    let j = i;
    while (j < rows.length && rows[j].k === 'eq') j++;
    const run = rows.slice(i, j);
    const headKeep = i === 0 ? 0 : 3, tailKeep = j === rows.length ? 0 : 3;
    if (run.length > headKeep + tailKeep + 2) {
      run.slice(0, headKeep).forEach(function (r) { out.push(r); });
      out.push({ k: 'fold', rows: run.slice(headKeep, run.length - tailKeep), id: i });
      run.slice(run.length - tailKeep).forEach(function (r) { out.push(r); });
    } else run.forEach(function (r) { out.push(r); });
    i = j;
  }
  return { rows: out, hunks: hunk };
}

function tdMount(ctx) {
  const el = ctx.el;
  const st = { open: {}, view: ctx.store.get('view'), syncing: false, model: null, opts: null };
  if (['side', 'inline', 'unified'].indexOf(st.view) < 0) st.view = window.innerWidth >= 900 ? 'side' : 'inline';
  ctx.td = st;

  /* the shell's own input pane is replaced by two boxes */
  ctx.split.style.display = 'none';
  const wrap = el('div', 'io-pane td-input');
  const head = el('div', 'io-head');
  head.appendChild(el('span', 'io-label', 'Original and changed text'));
  const swap = el('button', 'btn-ghost', 'Swap');
  swap.type = 'button';
  swap.title = 'Swap the two texts';
  head.appendChild(ctx.inputTools);
  ctx.inputTools.insertBefore(swap, ctx.inputTools.firstChild);
  wrap.appendChild(head);
  ['.dev-draft', '.dev-file', '.dev-busy'].forEach(function (sel) { const n = ctx.inputPane.querySelector(sel); if (n) wrap.appendChild(n); });
  const cols = el('div', 'td-cols');
  wrap.appendChild(cols);
  const boxes = {};
  [['a', 'Original', 'Paste or open the original text'], ['b', 'Changed', 'Paste or open the changed text']].forEach(function (c) {
    const col = el('div', 'td-col');
    const h = el('div', 'td-col-head');
    h.appendChild(el('strong', null, c[1]));
    const open = el('button', 'btn-ghost', 'Open file');
    open.type = 'button';
    const picker = el('input', 'visually-hidden');
    picker.type = 'file';
    picker.tabIndex = -1;
    picker.setAttribute('aria-hidden', 'true');
    const count = el('span', 'td-count', '');
    h.appendChild(count);
    h.appendChild(open);
    const ta = el('textarea', 'code-area td-ta');
    ta.rows = 10;
    ta.spellcheck = false;
    ta.placeholder = c[2];
    ta.setAttribute('aria-label', c[1] + ' text');
    ta.setAttribute('wrap', 'off');
    col.appendChild(h);
    col.appendChild(ta);
    col.appendChild(picker);
    cols.appendChild(col);
    boxes[c[0]] = { ta: ta, count: count };
    open.addEventListener('click', function () { picker.click(); });
    const readInto = function (f) {
      if (!f) return;
      f.text().then(function (t) { setPane(ta, t); toShell(); }, function () { ctx.message('error', f.name + ' could not be read as text.'); });
    };
    picker.addEventListener('change', function () { readInto(picker.files[0]); picker.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { ta.addEventListener(ev, function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); ta.classList.add('over'); } }); });
    ['dragleave', 'drop'].forEach(function (ev) { ta.addEventListener(ev, function () { ta.classList.remove('over'); }); });
    ta.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); readInto(e.dataTransfer.files[0]); } });
    ta.addEventListener('input', function () { toShell(); });
  });
  ctx.io.insertBefore(wrap, ctx.split);
  ctx.io.insertBefore(ctx.outputPane, ctx.extra);
  ctx.outputPane.classList.add('td-out');

  function setPane(ta, text) {
    if (ta.value === text) return;
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = text === '' ? document.execCommand('delete', false) : document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok || ta.value !== text) ta.value = text;
  }
  function joined() {
    const a = boxes.a.ta.value, b = boxes.b.ta.value;
    return a === '' && b === '' ? '' : a + TD_SEP + b;
  }
  function counts() {
    ['a', 'b'].forEach(function (k) {
      const v = boxes[k].ta.value;
      const n = v === '' ? 0 : v.replace(/\n$/, '').split('\n').length;
      boxes[k].count.textContent = n ? n.toLocaleString('en-GB') + (n === 1 ? ' line' : ' lines') : '';
    });
  }
  function toShell() {
    counts();
    const j = joined();
    if (ctx.input.value === j) return;
    st.syncing = true;
    ctx.input.value = j;
    ctx.input.dispatchEvent(new Event('input', { bubbles: true }));
    st.syncing = false;
  }
  function fromShell() {
    const v = ctx.input.value;
    if (v === joined()) return;
    const p = tdSplit(v);
    boxes.a.ta.value = p ? p.a.replace(/^\n+/, '').replace(/\n+$/, '') : v;
    boxes.b.ta.value = p ? p.b.replace(/^\n+/, '').replace(/\n+$/, '') : '';
    counts();
  }
  st.fromShell = fromShell;
  st.boxes = boxes;
  st.toShell = toShell;
  swap.addEventListener('click', function () {
    const a = boxes.a.ta.value, b = boxes.b.ta.value;
    setPane(boxes.a.ta, b);
    setPane(boxes.b.ta, a);
    toShell();
  });
  fromShell();

  /* the views, in the output pane ahead of the text */
  st.box = el('div', 'td-view');
  ctx.outputPane.insertBefore(st.box, ctx.output);
  const seg = el('div', 'mdp-seg td-seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'View');
  st.segBtns = {};
  [['side', 'Side by side'], ['inline', 'Inline'], ['unified', 'Text']].forEach(function (v) {
    const b = el('button', 'btn-ghost', v[1]);
    b.type = 'button';
    b.addEventListener('click', function () { st.view = v[0]; ctx.store.set('view', v[0]); tdRender(ctx.result, ctx); });
    st.segBtns[v[0]] = b;
    seg.appendChild(b);
  });
  ctx.outputTools.insertBefore(seg, ctx.outputTools.firstChild);
  const exp = el('button', 'btn-ghost', 'Export HTML');
  exp.type = 'button';
  exp.addEventListener('click', function () {
    if (!st.model || st.model.identical) { ctx.message('note', 'There is nothing to export: the texts are identical or empty.'); return; }
    ctx.saveBlob(new Blob([tdExportHtml(st.model, st.opts)], { type: 'text/html' }), 'text-diff.html');
  });
  ctx.outputTools.insertBefore(exp, ctx.outputTools.children[1] || null);
}

function tdText(parent, ctx, segs, text, cls) {
  if (!segs) { parent.appendChild(document.createTextNode(text)); return; }
  segs.forEach(function (s) {
    if (s[0] === '=') parent.appendChild(document.createTextNode(s[1]));
    else parent.appendChild(ctx.el('span', cls, s[1]));
  });
}

function tdApply(ctx, h, dir) {
  const st = ctx.td, m = st.model;
  const take = dir === 'right' ? m.A.slice(h.a0, h.a1) : m.B.slice(h.b0, h.b1);
  if (dir === 'right') {
    const lines = m.B.slice(0, h.b0).concat(take, m.B.slice(h.b1));
    const ta = st.boxes.b.ta; ta.focus(); ta.select();
    let ok = false; const t = lines.join('\n');
    try { ok = t === '' ? document.execCommand('delete', false) : document.execCommand('insertText', false, t); } catch (e) { ok = false; }
    if (!ok || ta.value !== t) ta.value = t;
  } else {
    const lines = m.A.slice(0, h.a0).concat(take, m.A.slice(h.a1));
    const ta = st.boxes.a.ta; ta.focus(); ta.select();
    let ok = false; const t = lines.join('\n');
    try { ok = t === '' ? document.execCommand('delete', false) : document.execCommand('insertText', false, t); } catch (e) { ok = false; }
    if (!ok || ta.value !== t) ta.value = t;
  }
  st.toShell();
}

function tdRender(res, ctx) {
  const st = ctx.td;
  if (!st) return;
  if (!st.syncing) st.fromShell();
  Object.keys(st.segBtns).forEach(function (k) { st.segBtns[k].setAttribute('aria-pressed', st.view === k ? 'true' : 'false'); });
  const box = st.box;
  box.textContent = '';
  const m = res && res.diff;
  st.model = m || null;
  if (!m || (res && res.error)) { box.hidden = true; ctx.output.style.display = ''; return; }
  const o = ctx.opts();
  st.opts = o;
  ctx.output.style.display = st.view === 'unified' ? '' : 'none';
  box.hidden = st.view === 'unified';
  if (st.view === 'unified') return;
  if (m.identical) { box.appendChild(ctx.el('p', 'td-same', 'No differences.')); return; }
  const el = ctx.el;
  if (m.mode !== 'line') {
    /* word and character modes: the text itself, with the changes marked */
    const mk = function (which) {
      const f = el('div', 'td-flow');
      m.ops.forEach(function (p) {
        if (p.t === '=') f.appendChild(document.createTextNode(m.A[p.a]));
        else if (p.t === '-' && which !== 'r') f.appendChild(el('span', 'td-del', m.A[p.a]));
        else if (p.t === '+' && which !== 'l') f.appendChild(el('span', 'td-ins', m.B[p.b]));
      });
      return f;
    };
    if (st.view === 'side') {
      const g = el('div', 'td-flows');
      const l = el('div', 'td-flowbox'); l.appendChild(el('div', 'td-flowhead', 'Original')); l.appendChild(mk('l'));
      const r = el('div', 'td-flowbox'); r.appendChild(el('div', 'td-flowhead', 'Changed')); r.appendChild(mk('r'));
      g.appendChild(l); g.appendChild(r);
      box.appendChild(g);
    } else box.appendChild(mk('both'));
    return;
  }
  const model = tdRows(m);
  const legend = el('p', 'td-legend');
  legend.appendChild(el('span', 'td-del', 'removed'));
  legend.appendChild(document.createTextNode(' '));
  legend.appendChild(el('span', 'td-ins', 'added'));
  legend.appendChild(document.createTextNode(' · ' + model.hunks + (model.hunks === 1 ? ' change' : ' changes') + ' · the arrows copy a change to the other text'));
  box.appendChild(legend);
  const rowSeg = function (row) { return row.l >= 0 && row.r >= 0 ? tdSegments(m.A[row.l], m.B[row.r], o) : null; };
  const arrows = function (h, parent) {
    const to = el('button', 'td-arrow', '»');
    to.type = 'button';
    to.title = 'Copy this change from the original into the changed text';
    to.setAttribute('aria-label', 'Copy change ' + (h.id + 1) + ' from the original to the changed text');
    to.addEventListener('click', function () { tdApply(ctx, h, 'right'); });
    const back = el('button', 'td-arrow', '«');
    back.type = 'button';
    back.title = 'Copy this change from the changed text into the original';
    back.setAttribute('aria-label', 'Copy change ' + (h.id + 1) + ' from the changed text to the original');
    back.addEventListener('click', function () { tdApply(ctx, h, 'left'); });
    parent.appendChild(to);
    parent.appendChild(back);
  };
  const scroll = el('div', 'td-scroll');
  if (st.view === 'side') {
    const t = el('table', 'td-sbs');
    const add = function (row) {
      if (row.k === 'fold') {
        const open = st.open[row.id];
        if (open) { row.rows.forEach(add); return; }
        const tr = el('tr', 'td-foldrow');
        const td = el('td', 'td-foldcell');
        td.colSpan = 5;
        const b = el('button', 'btn-ghost td-fold', '⋯ ' + row.rows.length.toLocaleString('en-GB') + ' unchanged lines');
        b.type = 'button';
        b.addEventListener('click', function () { st.open[row.id] = true; tdRender(ctx.result, ctx); });
        td.appendChild(b); tr.appendChild(td); t.appendChild(tr);
        return;
      }
      const tr = el('tr', row.k === 'eq' ? 'td-eq' : 'td-chg');
      const seg = row.k === 'chg' ? rowSeg(row) : null;
      tr.appendChild(el('td', 'td-n', row.l >= 0 ? String(row.l + 1) : ''));
      const l = el('td', 'td-l' + (row.k === 'chg' && row.l >= 0 ? ' is-del' : '') + (row.l < 0 ? ' is-pad' : ''));
      if (row.l >= 0) tdText(l, ctx, seg && seg.l, m.A[row.l], 'td-del-mark');
      tr.appendChild(l);
      const mid = el('td', 'td-m');
      if (row.k === 'chg' && row.first) arrows(row.h, mid);
      tr.appendChild(mid);
      const r = el('td', 'td-r' + (row.k === 'chg' && row.r >= 0 ? ' is-ins' : '') + (row.r < 0 ? ' is-pad' : ''));
      if (row.r >= 0) tdText(r, ctx, seg && seg.r, m.B[row.r], 'td-ins-mark');
      tr.appendChild(r);
      tr.appendChild(el('td', 'td-n', row.r >= 0 ? String(row.r + 1) : ''));
      t.appendChild(tr);
    };
    model.rows.forEach(add);
    scroll.appendChild(t);
  } else {
    const list = el('div', 'td-inl');
    const line = function (cls, sign, n, text, segs, mark) {
      const d = el('div', 'td-line ' + cls);
      d.appendChild(el('span', 'td-n', n));
      d.appendChild(el('span', 'td-sign', sign));
      const s = el('span', 'td-txt');
      tdText(s, ctx, segs, text, mark);
      d.appendChild(s);
      list.appendChild(d);
    };
    const add = function (row) {
      if (row.k === 'fold') {
        if (st.open[row.id]) { row.rows.forEach(add); return; }
        const b = el('button', 'btn-ghost td-fold', '⋯ ' + row.rows.length.toLocaleString('en-GB') + ' unchanged lines');
        b.type = 'button';
        b.addEventListener('click', function () { st.open[row.id] = true; tdRender(ctx.result, ctx); });
        list.appendChild(b);
        return;
      }
      if (row.k === 'eq') { line('is-eq', ' ', String(row.l + 1), m.A[row.l], null, ''); return; }
      if (row.first) {
        const hd = el('div', 'td-hunk');
        hd.appendChild(el('span', null, 'Change ' + (row.h.id + 1)));
        arrows(row.h, hd);
        list.appendChild(hd);
      }
      const seg = rowSeg(row);
      if (row.l >= 0) line('is-del', '−', String(row.l + 1), m.A[row.l], seg && seg.l, 'td-del-mark');
      if (row.r >= 0) line('is-ins', '+', String(row.r + 1), m.B[row.r], seg && seg.r, 'td-ins-mark');
    };
    /* paired rows list the removed line then the added one, so flush per hunk in order */
    model.rows.forEach(add);
    scroll.appendChild(list);
  }
  box.appendChild(scroll);
}

/* a standalone page of the same comparison: no scripts, no outside links */
function tdExportHtml(m, o) {
  const esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  const css = 'body{font:15px/1.5 system-ui,sans-serif;margin:24px;color:#1b1f2a;background:#fff}h1{font-size:1.2rem}table{border-collapse:collapse;width:100%;font:13px/1.45 ui-monospace,Consolas,monospace}td{padding:1px 8px;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}td.n{color:#8a90a0;text-align:right;width:3em;user-select:none}td.l,td.r{width:48%}.del{background:#ffe3e3}.ins{background:#ddf5df}mark.d{background:#ffb3b3}mark.i{background:#9be29f}.pad{background:#f4f5f8}.flow{white-space:pre-wrap;font:13px/1.5 ui-monospace,Consolas,monospace;border:1px solid #d6d9e2;padding:12px;border-radius:6px}.flow .del{background:#ffb3b3;text-decoration:line-through}.flow .ins{background:#9be29f}.meta{color:#5b6275}';
  const seg = function (s, cls) { return s[0] === '=' ? esc(s[1]) : '<mark class="' + cls + '">' + esc(s[1]) + '</mark>'; };
  let body = '';
  if (m.mode !== 'line') {
    body = '<div class="flow">' + m.ops.map(function (p) {
      return p.t === '=' ? esc(m.A[p.a]) : p.t === '-' ? '<span class="del">' + esc(m.A[p.a]) + '</span>' : '<span class="ins">' + esc(m.B[p.b]) + '</span>';
    }).join('') + '</div>';
  } else {
    const model = tdRows(m);
    body = '<table>';
    const row = function (r) {
      if (r.k === 'fold') { body += '<tr><td colspan="4" class="meta">⋯ ' + r.rows.length + ' unchanged lines</td></tr>'; return; }
      const sg = r.k === 'chg' && r.l >= 0 && r.r >= 0 ? tdSegments(m.A[r.l], m.B[r.r], o) : null;
      body += '<tr><td class="n">' + (r.l >= 0 ? r.l + 1 : '') + '</td><td class="l' + (r.k === 'chg' && r.l >= 0 ? ' del' : '') + (r.l < 0 ? ' pad' : '') + '">' + (r.l >= 0 ? (sg ? sg.l.map(function (s) { return seg(s, 'd'); }).join('') : esc(m.A[r.l])) : '') +
        '</td><td class="r' + (r.k === 'chg' && r.r >= 0 ? ' ins' : '') + (r.r < 0 ? ' pad' : '') + '">' + (r.r >= 0 ? (sg ? sg.r.map(function (s) { return seg(s, 'i'); }).join('') : esc(m.B[r.r])) : '') + '</td><td class="n">' + (r.r >= 0 ? r.r + 1 : '') + '</td></tr>';
    };
    model.rows.forEach(row);
    body += '</table>';
  }
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Text comparison</title><style>' + css + '</style></head><body><h1>Text comparison</h1><p class="meta">Left: original. Right: changed. Made with 1234Tools Text Compare.</p>' + body + '</body></html>\n';
}
})();
