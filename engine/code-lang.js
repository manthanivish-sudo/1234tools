/* ============================================================
   code-lang.js — tokenizers, minifiers and beautifiers for JavaScript,
   CSS and HTML, this site's own code. Shared by the Code Minifier and the
   Code Beautifier (engine/dev-code-minifier.js, dev-code-beautifier.js).

   The rule both tools keep: only white space and comments change. JavaScript
   is never renamed or rewritten: a line break is kept wherever removing it
   could change how JavaScript inserts semicolons, and a space wherever two
   tokens would otherwise run together. CSS loses comments, white space, the
   last semicolon in a block, empty rules, leading zeros and long hex
   colours. HTML loses comments and the white space a browser does not show
   (runs of spaces, and spaces next to block elements); pre, textarea,
   script and style keep theirs unless their contents are minified as
   JavaScript or CSS.
   ============================================================ */
(function () {
'use strict';

/* ======================= JavaScript ======================= */
const JS_PUNCT = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=',
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '**',
  '{', '}', '(', ')', '[', ']', ';', ',', '<', '>', '+', '-', '*', '/', '%', '&', '|', '^', '!', '~', '?', ':', '=', '.', '@', '#'];
const REGEX_AFTER_KW = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const ID_START = /[A-Za-z_$\u0080-\uffff\\]/;
const ID_PART = /[\w$\u0080-\uffff\\\u200c\u200d]/;

class LexError extends Error {
  constructor(msg, src, at) {
    const before = src.slice(0, at);
    const line = before.split('\n').length, col = at - before.lastIndexOf('\n');
    super(msg + ' (line ' + line + ', column ' + col + ')');
    this.line = line; this.col = col;
  }
}

/** tokens: { t: 'ws'|'line'|'block'|'str'|'tpl'|'re'|'num'|'name'|'p', v, nl } */
function lexJs(src) {
  const s = String(src);
  const r = lexJsFrom(s, 0, false);
  return r.toks;
}
function lexJsFrom(s, start, inTpl) {
  const toks = [];
  let i = start, depth = 0;
  const n = s.length;
  const sig = () => { for (let k = toks.length - 1; k >= 0; k--) if (toks[k].t !== 'ws' && toks[k].t !== 'line' && toks[k].t !== 'block') return toks[k]; return null; };
  const sig2 = () => { let c = 0; for (let k = toks.length - 1; k >= 0; k--) if (toks[k].t !== 'ws' && toks[k].t !== 'line' && toks[k].t !== 'block') { if (++c === 2) return toks[k]; } return null; };
  const regexOk = () => {
    const p = sig();
    if (!p) return true;
    if (p.t === 'num' || p.t === 'str' || p.t === 'tpl' || p.t === 're') return false;
    if (p.t === 'name') {
      const q = sig2();
      if (q && q.t === 'p' && (q.v === '.' || q.v === '?.')) return false;
      return REGEX_AFTER_KW.has(p.v);
    }
    if (p.v === ')' || p.v === ']' || p.v === '++' || p.v === '--') return false;
    return true;      /* after } a regex is taken: a block ends there more often than an object */
  };
  while (i < n) {
    const c = s[i];
    if (/[\s\u00a0\ufeff\u2028\u2029]/.test(c)) {
      let j = i; while (j < n && /[\s\u00a0\ufeff\u2028\u2029]/.test(s[j])) j++;
      const v = s.slice(i, j);
      toks.push({ t: 'ws', v: v, nl: /[\n\r\u2028\u2029]/.test(v) }); i = j; continue;
    }
    if (c === '/' && s[i + 1] === '/') { let j = i; while (j < n && !/[\n\r\u2028\u2029]/.test(s[j])) j++; toks.push({ t: 'line', v: s.slice(i, j) }); i = j; continue; }
    if (c === '/' && s[i + 1] === '*') {
      const j = s.indexOf('*/', i + 2);
      if (j < 0) throw new LexError('this /* comment is never closed', s, i);
      const v = s.slice(i, j + 2);
      toks.push({ t: 'block', v: v, nl: /[\n\r\u2028\u2029]/.test(v) }); i = j + 2; continue;
    }
    if (c === '#' && i === 0 && s[1] === '!') { let j = i; while (j < n && s[j] !== '\n') j++; toks.push({ t: 'line', v: s.slice(i, j), hashbang: true }); i = j; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      for (;;) {
        if (j >= n || s[j] === '\n') throw new LexError('this string is never closed', s, i);
        if (s[j] === '\\') { j += s[j + 1] === '\r' && s[j + 2] === '\n' ? 3 : 2; continue; }
        if (s[j] === c) break;
        j++;
      }
      toks.push({ t: 'str', v: s.slice(i, j + 1) }); i = j + 1; continue;
    }
    if (c === '`') { const j = tplEnd(s, i); toks.push({ t: 'tpl', v: s.slice(i, j) }); i = j; continue; }
    if (c === '/' && regexOk()) {
      let j = i + 1, cls = false;
      for (;;) {
        if (j >= n || s[j] === '\n') throw new LexError('this regular expression is never closed', s, i);
        const ch = s[j];
        if (ch === '\\') { j += 2; continue; }
        if (ch === '[') cls = true; else if (ch === ']') cls = false; else if (ch === '/' && !cls) break;
        j++;
      }
      j++;
      while (j < n && ID_PART.test(s[j])) j++;
      toks.push({ t: 're', v: s.slice(i, j) }); i = j; continue;
    }
    let m;
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      m = /^(0[xX][0-9a-fA-F_]+n?|0[oO][0-7_]+n?|0[bB][01_]+n?|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?n?)/.exec(s.slice(i, i + 400));
      toks.push({ t: 'num', v: m[0] }); i += m[0].length; continue;
    }
    if (ID_START.test(c) || (c === '#' && ID_START.test(s[i + 1] || ''))) {
      let j = i + 1;
      while (j < n && ID_PART.test(s[j])) { if (s[j] === '\\') j += s[j + 1] === 'u' && s[j + 2] === '{' ? s.indexOf('}', j) - j + 1 : 6; else j++; }
      toks.push({ t: 'name', v: s.slice(i, j) }); i = j; continue;
    }
    if (c === '?' && s[i + 1] === '.' && /[0-9]/.test(s[i + 2] || '')) { toks.push({ t: 'p', v: '?' }); i++; continue; }
    let p = null;
    for (const q of JS_PUNCT) if (s.startsWith(q, i)) { p = q; break; }
    if (!p) throw new LexError('unexpected character ' + JSON.stringify(c), s, i);
    if (p === '{') depth++;
    if (p === '}') { if (inTpl && depth === 0) return { toks: toks, end: i }; depth--; }
    toks.push({ t: 'p', v: p }); i += p.length;
  }
  if (inTpl) throw new LexError('a ${ in this template is never closed', s, start);
  return { toks: toks, end: n };
}
function tplEnd(s, i) {
  let j = i + 1;
  const n = s.length;
  for (;;) {
    if (j >= n) throw new LexError('this template literal is never closed', s, i);
    const c = s[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '`') return j + 1;
    if (c === '$' && s[j + 1] === '{') { const r = lexJsFrom(s, j + 2, true); j = r.end + 1; continue; }
    j++;
  }
}

const isComment = (k) => k.t === 'line' || k.t === 'block';
const keepComment = (k) => k.t === 'block' && (/^\/\*!/.test(k.v) || /@(license|preserve)\b/.test(k.v)) || k.hashbang;
/* after these a statement cannot end, so a line break after them is never a semicolon */
const CONT_AFTER = new Set(['{', '(', '[', ',', ';', ':', '?', '.', '?.', '=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '+', '-', '*', '/', '%', '**',
  '&', '|', '^', '!', '~', '&&', '||', '??', '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??=', '=>', '...']);
/* and before these one cannot start */
const CONT_BEFORE = new Set([')', ']', '}', ',', ';', '.', '?.', '?', ':', '=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '*', '%', '**',
  '&', '|', '^', '&&', '||', '??', '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??=']);
function lineBreakMatters(a, b) {
  if (a.t === 'p' && CONT_AFTER.has(a.v)) return false;
  if (b.t === 'p' && (CONT_BEFORE.has(b.v) || (b.v === '/' ))) return false;
  if (b.t === 'name' && (b.v === 'instanceof' || b.v === 'in') && a.t !== 'p') return false;
  return true;
}
/** must there be a space between the two tokens? */
function jsGap(a, b) {
  const x = a.v, y = b.v;
  const lx = x[x.length - 1], fy = y[0];
  if (ID_PART.test(lx) && (ID_PART.test(fy) || fy === '#')) return true;
  if (a.t === 're' && ID_PART.test(fy)) return true;
  if (a.t === 'num' && fy === '.' && /^\d+$/.test(x)) return true;
  if ((lx === '+' || lx === '-') && fy === lx) return true;
  if (lx === '/' && (fy === '/' || fy === '*')) return true;
  const joint = x.slice(-3) + y.slice(0, 3);
  if (/<!--|-->/.test(joint) && !/<!--|-->/.test(x.slice(-3)) && !/<!--|-->/.test(y.slice(0, 3))) return true;
  if (lx === '<' && fy === '!') return true;
  if (lx === '?' && fy === '.' && a.t === 'p') return true;
  if (lx === '.' && a.t === 'num' && ID_START.test(fy)) return true;
  return false;
}

function minifyJs(src, o) {
  const toks = lexJs(src);
  const keep = o && o.keepLicence !== false;
  let out = '';
  let prev = null, pendingNl = false, lastWasLine = false;
  for (const k of toks) {
    if (k.t === 'ws') { if (k.nl) pendingNl = true; continue; }
    if (isComment(k)) {
      if (keep && keepComment(k)) {
        if (prev && pendingNl) out += '\n'; else if (prev && !lastWasLine && out && !/\n$/.test(out)) out += '\n';
        out += k.v; out += '\n'; pendingNl = false; lastWasLine = true; continue;
      }
      if (k.t === 'line' || k.nl) pendingNl = true;
      continue;
    }
    if (prev) {
      if (lastWasLine) { /* a kept comment already ended the line */ }
      else if (pendingNl && lineBreakMatters(prev, k)) out += '\n';
      else if (jsGap(prev, k)) out += ' ';
    }
    out += k.v;
    prev = k; pendingNl = false; lastWasLine = false;
  }
  return out;
}

/** JavaScript laid out: braces open blocks, semicolons end lines; every
    line break of the original is kept (at most one blank line), so
    semicolon insertion reads the code exactly as before. */
function beautifyJs(src, o) {
  const IND = o && o.indent ? o.indent : '  ';
  const toks = lexJs(src);
  const sigs = [];
  /* collapse to significant tokens with what stood before each */
  let nlBefore = 0, comments = [];
  for (const k of toks) {
    if (k.t === 'ws') { const c = (k.v.match(/\n/g) || []).length; nlBefore += c; continue; }
    if (isComment(k)) { comments.push({ k: k, nl: nlBefore }); nlBefore = k.t === 'line' ? 0 : 0; if (k.t === 'line') nlBefore = 0; continue; }
    sigs.push({ k: k, nl: nlBefore, comments: comments });
    nlBefore = 0; comments = [];
  }
  const tail = comments;
  let out = '';
  let level = 0;
  const frames = [];      // '{', '(', '['  with kind
  let line = '';
  const flush = () => { out += line.replace(/[ \t]+$/, '') + '\n'; line = ''; };
  const newline = (blank) => {
    if (line.trim()) flush(); else line = '';
    if (blank && !/\n\n$/.test(out) && out) out += '\n';
    line = IND.repeat(Math.max(0, level));
  };
  const space = () => { if (line.trim() && !/[ \t]$/.test(line)) line += ' '; };
  let prev = null, forDepth = 0, afterBlock = false;
  const qs = [0];
  const top = () => frames[frames.length - 1];
  const KW_SPACE = new Set(['if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'else', 'do', 'try', 'finally', 'const', 'let', 'var', 'function', 'class', 'extends', 'async', 'await', 'yield', 'import', 'export', 'from', 'as', 'static', 'get', 'set']);
  const isUnaryCtx = (p) => !p || (p.t === 'p' && !/^[)\]}]$/.test(p.v) && p.v !== '++' && p.v !== '--') || (p.t === 'name' && REGEX_AFTER_KW.has(p.v));
  line = '';
  for (let x = 0; x < sigs.length; x++) {
    const { k, nl } = sigs[x];
    /* comments before this token */
    for (const c of sigs[x].comments) {
      if (c.nl > 0 || !line.trim()) newline(c.nl > 1); else space();
      line += c.k.v.replace(/\n[ \t]*/g, '\n' + IND.repeat(level) + ' ');
      if (c.k.t === 'line') newline(false);
    }
    const v = k.v;
    const closing = k.t === 'p' && (v === '}' || v === ')' || v === ']');
    if (closing) {
      const f = frames.pop();
      if (f) level = f.level;
      if (f && f.multi) newline(false);
      else if (nl > 0) newline(false);
      if (v === ')' && f && f.isFor) forDepth--;
      line += v;
      prev = k;
      afterBlock = !!(f && f.multi && v === '}');
      continue;
    }
    if (afterBlock && line.trim() && !(k.t === 'p' && /^[),;.\]:]$|^\?\.$/.test(v)) && !(k.t === 'name' && /^(else|catch|finally|while)$/.test(v)) && !(k.t === 'p' && CONT_BEFORE.has(v))) newline(false);
    afterBlock = false;
    if (nl > 0 && line.trim()) newline(nl > 1);
    else if (!line.trim() && prev) { /* already on a fresh line */ }
    if (!line) line = IND.repeat(level);
    const lastCh = line.replace(/\s+$/, '').slice(-1);
    /* spacing before this token */
    if (prev && line.trim()) {
      if (k.t === 'p') {
        if (v === ',' || v === ';' || v === '.' || v === '?.' || v === ')' || v === ']' || (v === ':' && !(top() ? top().q : qs[0])) ) { /* none */ }
        else if (v === '(' || v === '[') { if (prev.t === 'name' && KW_SPACE.has(prev.v) && !(prev.v === 'function' && v === '(') ) space(); else if (prev.t === 'p' && !/^[)\]]$/.test(prev.v) && prev.v !== '.' && prev.v !== '?.' && prev.v !== '(' && prev.v !== '[' && !prev.unary) space(); }
        else if ((v === '++' || v === '--') && (prev.t === 'name' || prev.t === 'num' || prev.v === ')' || prev.v === ']')) { /* postfix */ }
        else if (prev.t === 'p' && (prev.v === '(' || prev.v === '[' || prev.v === '.' || prev.v === '?.' || prev.v === '...' || prev.unary)) { if (jsGap(prev, k)) space(); }
        else space();
      } else {
        if (prev.t === 'p' && (prev.v === '(' || prev.v === '[' || prev.v === '.' || prev.v === '?.' || prev.v === '...' || prev.v === '#' || prev.v === '@' || prev.unary)) { if (jsGap(prev, k)) space(); }
        else space();
      }
    }
    if (jsGap({ v: lastCh || ' ', t: prev ? prev.t : 'ws' }, k) && !/[ \t]$/.test(line) && line.trim()) line += ' ';
    const tok = Object.assign({}, k);
    if (k.t === 'p' && (v === '!' || v === '~' || ((v === '-' || v === '+' || v === '++' || v === '--') && (isUnaryCtx(prev) || nl > 0))) ) tok.unary = true;
    if (k.t === 'p' && v === '?') { if (top()) top().q = (top().q || 0) + 1; else qs[0]++; }
    if (k.t === 'p' && v === ':') { if (top() && top().q) top().q--; else if (!top() && qs[0]) qs[0]--; }
    line += v;
    if (k.t === 'p' && (v === '{' || v === '(' || v === '[')) {
      const next = sigs[x + 1];
      const empty = next && next.k.t === 'p' && next.k.v === { '{': '}', '(': ')', '[': ']' }[v];
      const isFor = v === '(' && prev && prev.t === 'name' && prev.v === 'for';
      if (isFor) forDepth++;
      const objLike = v === '{' && prev && (prev.t === 'p' && /^[=(,:[?]$|^=>$|^return$/.test(prev.v) || (prev.t === 'name' && prev.v === 'return'));
      const multi = v === '{' && !empty;
      frames.push({ v: v, level: level, multi: multi, isFor: isFor, obj: objLike });
      if (multi) { level++; newline(false); }
      else if (!empty && next && next.nl > 0) { level++; frames[frames.length - 1].level = level - 1; }
    } else if (k.t === 'p' && v === ';' && !(forDepth > 0 && top() && top().isFor)) {
      const next = sigs[x + 1];
      if (next && !(next.k.t === 'p' && next.k.v === '}')) newline(false);
    } else if (k.t === 'p' && v === ',' && top() && top().v === '{') {
      newline(false);
    }
    prev = tok;
    /* after a closing brace, the next statement starts a new line */
    if (k.t === 'p' && v === '}') { /* handled when the next token comes */ }
  }
  for (const c of tail) { if (c.nl > 0 || !line.trim()) newline(false); else space(); line += c.k.v; }
  if (line.trim()) flush();
  return out.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
}

/* ======================= CSS ======================= */
function lexCss(src) {
  const s = String(src);
  const out = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (/\s/.test(c)) { let j = i; while (j < n && /\s/.test(s[j])) j++; out.push({ t: 'ws', v: s.slice(i, j) }); i = j; continue; }
    if (c === '/' && s[i + 1] === '*') { const j = s.indexOf('*/', i + 2); if (j < 0) throw new LexError('this /* comment is never closed', s, i); out.push({ t: 'com', v: s.slice(i, j + 2) }); i = j + 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      for (;;) { if (j >= n || s[j] === '\n') throw new LexError('this string is never closed', s, i); if (s[j] === '\\') { j += 2; continue; } if (s[j] === c) break; j++; }
      out.push({ t: 'str', v: s.slice(i, j + 1) }); i = j + 1; continue;
    }
    const m = /^url\(\s*([^"')\s][^)]*?)?\s*\)/i.exec(s.slice(i, i + 4096));
    if (m && (i === 0 || !/[\w-]/.test(s[i - 1]))) { out.push({ t: 'url', v: m[0] }); i += m[0].length; continue; }
    if ('{};:,()[]>+~*=!'.indexOf(c) >= 0) { out.push({ t: 'p', v: c }); i++; continue; }
    let j = i;
    while (j < n && !/[\s{};:,()\[\]>+~*=!"'\/]/.test(s[j])) { if (s[j] === '\\') j++; j++; }
    if (j === i) { if (c === '/') { out.push({ t: 'p', v: '/' }); i++; continue; } j = i + 1; }
    out.push({ t: 'w', v: s.slice(i, j) }); i = j;
  }
  return out;
}
/** CSS as a tree: [{ type: 'decl', text } | { type: 'rule', prelude, body: [...] } | { type: 'at', text } | { type: 'com', text }] */
function parseCss(src, keepComments) {
  const toks = lexCss(src);
  let k = 0;
  const block = (closing) => {
    const items = [];
    let buf = [];
    const flushDecl = () => {
      const text = joinCss(buf);
      if (text.trim()) items.push(/^@/.test(text.trim()) ? { type: 'at', text: text.trim() } : { type: 'decl', text: text.trim() });
      buf = [];
    };
    while (k < toks.length) {
      const t = toks[k++];
      if (t.t === 'com') { if (keepComments === 'all' || (keepComments && /^\/\*!/.test(t.v))) { if (buf.some((b) => b.t !== 'ws')) buf.push({ t: 'ws', v: ' ' }); else items.push({ type: 'com', text: t.v }); } else buf.push({ t: 'ws', v: ' ' }); continue; }
      if (t.t === 'p' && t.v === '}') { if (!closing) throw new Error('a } with no { before it'); flushDecl(); return items; }
      if (t.t === 'p' && t.v === ';') { flushDecl(); continue; }
      if (t.t === 'p' && t.v === '{') {
        const prelude = joinCss(buf).trim(); buf = [];
        items.push({ type: 'rule', prelude: prelude, body: block(true) });
        continue;
      }
      if (t.t === 'p' && (t.v === '(' || t.v === '[')) {
        /* keep brackets together: a ; or { inside them belongs to them */
        const close = t.v === '(' ? ')' : ']';
        let d = 1; buf.push(t);
        while (k < toks.length && d) { const u = toks[k++]; if (u.t === 'p' && u.v === t.v) d++; if (u.t === 'p' && u.v === close) d--; buf.push(u.t === 'com' ? { t: 'ws', v: ' ' } : u); }
        continue;
      }
      buf.push(t);
    }
    if (closing) throw new Error('a { is never closed');
    flushDecl();
    return items;
  };
  return block(false);
}
function joinCss(buf) { return buf.map((b) => b.v).join(''); }

/* white space inside a value or prelude, made minimal without joining words */
function tightCss(text, kind) {
  const toks = lexCss(text);
  let out = '';
  let prevSig = null, pendingWs = false, depth = 0;
  for (const t of toks) {
    if (t.t === 'ws' || t.t === 'com') { pendingWs = true; continue; }
    const v = t.t === 'w' && kind === 'value' ? shortValue(t.v) : t.v;
    if (pendingWs && prevSig) {
      const a = prevSig, b = t;
      let drop = false;
      if (a.t === 'p' && (a.v === ',' || a.v === '(' || (a.v === ':' && kind !== 'selector') || (kind === 'selector' && /^[>~+]$/.test(a.v)))) drop = true;
      if (b.t === 'p' && (b.v === ',' || b.v === ')' || (kind === 'selector' && /^[>~+]$/.test(b.v)) || (b.v === '!' && kind === 'value'))) drop = true;
      if (kind === 'value' && a.t === 'p' && a.v === '/' && depth === 0) drop = true;
      if (kind === 'at' && b.t === 'p' && b.v === ':') drop = true;
      if (kind === 'value' && b.t === 'p' && b.v === '/' && depth === 0) drop = true;
      if (kind === 'selector' && b.t === 'p' && b.v === ':' ) drop = false;
      if (b.t === 'p' && b.v === '(' && a.t !== 'p') drop = false;
      if (!drop) out += ' ';
    }
    if (t.t === 'p' && t.v === '(') depth++;
    if (t.t === 'p' && t.v === ')') depth--;
    out += v;
    prevSig = t; pendingWs = false;
  }
  return out;
}
function shortValue(w) {
  let m;
  if ((m = /^#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3(?:([0-9a-fA-F])\4)?$/.exec(w))) return ('#' + m[1] + m[2] + m[3] + (m[4] || '')).toLowerCase();
  if ((m = /^(-?)0+(\.\d+)([a-z%]*)$/i.exec(w))) return m[1] + m[2] + m[3];
  return w;
}
function minifyCss(src, o) {
  const tree = parseCss(src, o && o.keepLicence !== false);
  const w = (items) => items.map((it) => {
    if (it.type === 'com') return it.text;
    if (it.type === 'decl') {
      const c = it.text.indexOf(':');
      if (c < 0 || /^--/.test(it.text)) return /^--/.test(it.text) ? it.text.slice(0, c).trim() + ':' + it.text.slice(c + 1).trim() : tightCss(it.text, 'value');
      return it.text.slice(0, c).trim() + ':' + tightCss(it.text.slice(c + 1).trim(), 'value');
    }
    if (it.type === 'at') return tightCss(it.text, 'at');
    const body = w(it.body);
    if (!body && !/^@/.test(it.prelude)) return '';
    return tightCss(it.prelude, /^@/.test(it.prelude) ? 'at' : 'selector') + '{' + body + '}';
  }).filter(Boolean).reduce((acc, x, i, arr) => acc + x + (/[}/]$/.test(x) && !/^\/\*/.test(x) ? '' : (i < arr.length - 1 ? ';' : '')), '');
  return w(tree);
}
function beautifyCss(src, o) {
  const IND = o && o.indent ? o.indent : '  ';
  const tree = parseCss(src, 'all');
  const lines = [];
  const w = (items, d) => {
    const pad = IND.repeat(d);
    items.forEach((it, idx) => {
      if (it.type === 'com') { lines.push(pad + it.text.replace(/\n\s*/g, '\n' + pad + ' ')); return; }
      if (it.type === 'decl') {
        const c = it.text.indexOf(':');
        if (/^--/.test(it.text)) { lines.push(pad + it.text.slice(0, c).trim() + ': ' + it.text.slice(c + 1).trim() + ';'); return; }
        lines.push(pad + (c < 0 ? normWs(it.text) : it.text.slice(0, c).trim() + ': ' + normWs(it.text.slice(c + 1).trim())) + ';');
        return;
      }
      if (it.type === 'at') { lines.push(pad + normWs(it.text) + ';'); return; }
      const pre = /^@/.test(it.prelude) ? normWs(it.prelude) : splitSelectors(it.prelude).map(prettySel).join(',\n' + pad);
      if (d === 0 && idx > 0 && lines.length && lines[lines.length - 1] !== '') lines.push('');
      lines.push(pad + pre + ' {');
      w(it.body, d + 1);
      lines.push(pad + '}');
    });
  };
  w(tree, 0);
  return lines.join('\n') + '\n';
}
function normWs(t) { return tightCss(t, 'pretty'); }
function prettySel(p) {
  /* one space round the combinators > + ~ outside brackets */
  let out = '', depth = 0;
  for (const t of lexCss(normWs(p))) {
    if (t.t === 'p' && (t.v === '(' || t.v === '[')) depth++;
    if (t.t === 'p' && (t.v === ')' || t.v === ']')) depth--;
    if (t.t === 'ws') { if (!/ $/.test(out)) out += ' '; continue; }
    if (t.t === 'p' && depth === 0 && /^[>+~]$/.test(t.v)) { out = out.replace(/ $/, '') + ' ' + t.v + ' '; continue; }
    out += t.v;
  }
  return out.replace(/ {2,}/g, ' ').trim();
}
function splitSelectors(p) {
  const parts = []; let depth = 0, cur = '';
  for (const t of lexCss(p)) {
    if (t.t === 'p' && (t.v === '(' || t.v === '[')) depth++;
    if (t.t === 'p' && (t.v === ')' || t.v === ']')) depth--;
    if (t.t === 'p' && t.v === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += t.v;
  }
  parts.push(cur.trim());
  return parts.filter(Boolean);
}

/* ======================= HTML ======================= */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title', 'pre', 'xmp', 'plaintext', 'noscript', 'template']);
const BLOCK = new Set(['html', 'head', 'body', 'title', 'meta', 'link', 'base', 'style', 'script', 'noscript', 'template', 'address', 'article', 'aside', 'blockquote', 'details',
  'dialog', 'dd', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'li', 'main', 'nav', 'ol',
  'p', 'pre', 'section', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col', 'ul', 'summary', 'menu', 'search', 'option', 'optgroup', 'source', 'track', 'picture', 'video', 'audio', 'iframe', 'canvas', 'svg', 'object']);
/* elements whose inside white space a browser draws (or keeps as value) */
const KEEP_INSIDE = new Set(['pre', 'textarea', 'xmp', 'plaintext']);

function lexHtml(src) {
  const s = String(src);
  const out = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    if (s.startsWith('<!--', i)) { let j = s.indexOf('-->', i + 4); if (j < 0) j = n - 3; out.push({ t: 'com', v: s.slice(i, j + 3) }); i = j + 3; continue; }
    if (/^<![a-z]/i.test(s.slice(i, i + 3)) || s.startsWith('<?', i)) { let j = s.indexOf('>', i); if (j < 0) j = n - 1; out.push({ t: 'decl', v: s.slice(i, j + 1) }); i = j + 1; continue; }
    if (s[i] === '<' && s.startsWith('<![CDATA[', i)) { let j = s.indexOf(']]>', i); if (j < 0) j = n - 3; out.push({ t: 'text', v: s.slice(i, j + 3) }); i = j + 3; continue; }
    const m = /^<(\/?)([a-zA-Z][\w:-]*)/.exec(s.slice(i, i + 64));
    if (m) {
      /* to the closing >, past quoted attribute values */
      let j = i + m[0].length, q = null;
      while (j < n) { const c = s[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; j++; }
      if (j >= n) throw new LexError('this <' + m[1] + m[2] + '> tag is never closed', s, i);
      const tag = { t: m[1] ? 'close' : 'open', name: m[2].toLowerCase(), v: s.slice(i, j + 1) };
      out.push(tag);
      i = j + 1;
      if (tag.t === 'open' && RAW.has(tag.name) && !/\/>$/.test(tag.v)) {
        const end = s.toLowerCase().indexOf('</' + tag.name, i);
        const e = end < 0 ? n : end;
        if (e > i) out.push({ t: 'raw', v: s.slice(i, e), of: tag.name, open: tag });
        i = e;
      }
      continue;
    }
    let j = s.indexOf('<', i + 1);
    while (j >= 0 && !/^<(\/?[a-zA-Z]|!|\?)/.test(s.slice(j, j + 3))) j = s.indexOf('<', j + 1);
    if (j < 0) j = n;
    out.push({ t: 'text', v: s.slice(i, j) });
    i = j;
  }
  return out;
}
function attrOf(tagText, name) {
  const m = new RegExp('\\s' + name + '\\s*=\\s*("[^"]*"|\'[^\']*\'|[^\\s>]+)', 'i').exec(tagText);
  return m ? m[1].replace(/^["']|["']$/g, '') : null;
}
function tightTag(v) {
  /* white space between attributes made single; values untouched */
  let out = '', q = null, ws = false;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (q) { out += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { if (ws) { out += ' '; ws = false; } q = c; out += c; continue; }
    if (/\s/.test(c)) { ws = true; continue; }
    if (ws) { if (c !== '>' && !(c === '/' && v[i + 1] === '>') && c !== '=' && out[out.length - 1] !== '=') out += ' '; ws = false; }
    out += c;
  }
  return out;
}
const isJsType = (t) => !t || /^(text\/javascript|application\/javascript|module|text\/ecmascript)$/i.test(t.trim());
const boundary = (tok) => tok && ((tok.t === 'open' || tok.t === 'close') && (BLOCK.has(tok.name) || tok.name === 'br') || tok.t === 'decl' || tok.t === 'com' || tok.t === 'raw' && BLOCK.has(tok.of));

function minifyHtml(src, o) {
  const toks = lexHtml(src);
  const keepCom = o && o.htmlComments === 'keep';
  const out = [];
  const stack = [];
  const notes = [];
  let pre = 0;
  /* drop comments first, so the white space around them can merge */
  const list = toks.filter((t) => !(t.t === 'com' && !keepCom && !/^<!--\[if|^<!--<!\[endif|^<!--\s*\[endif/i.test(t.v)));
  for (let k = 0; k < list.length; k++) {
    const t = list[k];
    if (t.t === 'open') {
      if (KEEP_INSIDE.has(t.name) && !/\/>$/.test(t.v)) pre++;
      out.push(tightTag(t.v));
      if (!VOID.has(t.name) && !/\/>$/.test(t.v)) stack.push(t.name);
      continue;
    }
    if (t.t === 'close') {
      if (KEEP_INSIDE.has(t.name)) pre = Math.max(0, pre - 1);
      const at = stack.lastIndexOf(t.name); if (at >= 0) stack.length = at;
      out.push(tightTag(t.v));
      continue;
    }
    if (t.t === 'raw') {
      let v = t.v;
      if (t.of === 'script' && isJsType(attrOf(t.open.v, 'type')) && o.inner !== 'keep') {
        try { v = minifyJs(v, o); } catch (e) { notes.push('A script was left as it is: ' + e.message + '.'); }
      } else if (t.of === 'script' && /json/i.test(attrOf(t.open.v, 'type') || '') && o.inner !== 'keep') {
        try { v = JSON.stringify(JSON.parse(v)).replace(/</g, '\\u003c'); } catch (e) { notes.push('A JSON script block was left as it is: it is not valid JSON.'); }
      } else if (t.of === 'style' && o.inner !== 'keep') {
        try { v = minifyCss(v, o); } catch (e) { notes.push('A style block was left as it is: ' + e.message + '.'); }
      } else if (t.of === 'title') v = v.replace(/\s+/g, ' ').trim();
      out.push(v);
      continue;
    }
    if (t.t === 'text') {
      if (pre) { out.push(t.v); continue; }
      let v = t.v.replace(/[ \t\n\r\f]+/g, ' ');
      if (v === ' ' || /^ /.test(v) || / $/.test(v)) {
        const prevT = list[k - 1], nextT = list[k + 1];
        if (v.trim() === '') { if (boundary(prevT) || boundary(nextT) || !prevT || !nextT) v = ''; }
        else {
          if ((boundary(prevT) || !prevT) && /^ /.test(v)) v = v.slice(1);
          if ((boundary(nextT) || !nextT) && / $/.test(v)) v = v.slice(0, -1);
        }
      }
      out.push(v);
      continue;
    }
    out.push(t.v);
  }
  return { text: out.join(''), notes: notes };
}

function beautifyHtml(src, o) {
  const IND = o && o.indent ? o.indent : '  ';
  const toks = lexHtml(src);
  const lines = [];
  let line = '', level = 0, pre = 0;
  const notes = [];
  const flush = () => { if (line.trim()) lines.push(line.replace(/\s+$/, '')); line = ''; };
  const start = () => { flush(); line = IND.repeat(level); };
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (pre) {
      line += t.t === 'open' || t.t === 'close' ? t.v : t.v;
      if (t.t === 'close' && KEEP_INSIDE.has(t.name)) pre--;
      if (t.t === 'open' && KEEP_INSIDE.has(t.name)) pre++;
      continue;
    }
    if (t.t === 'open') {
      const blk = BLOCK.has(t.name);
      if (blk) start();
      /* a block holding only inline content and short enough stays on one line */
      if (blk && !RAW.has(t.name) && !VOID.has(t.name) && !/\/>$/.test(t.v)) {
        let d = 0, j = k + 1, len = 0, okInline = true;
        for (; j < toks.length; j++) {
          const u = toks[j];
          if (u.t === 'open' && u.name === t.name && !VOID.has(u.name)) d++;
          if (u.t === 'close' && u.name === t.name) { if (d === 0) break; d--; }
          if (boundary(u) || u.t === 'raw' || (u.t === 'open' && KEEP_INSIDE.has(u.name))) { okInline = false; break; }
          len += u.v.length;
          if (len > 100) { okInline = false; break; }
        }
        if (okInline && j < toks.length) {
          let body = '';
          for (let q = k + 1; q < j; q++) body += toks[q].t === 'text' ? toks[q].v.replace(/[ \t\n\r\f]+/g, ' ') : tightTag(toks[q].v);
          line += tightTag(t.v) + body.replace(/^ | $/g, '') + tightTag(toks[j].v);
          start();
          k = j;
          continue;
        }
      }
      line += tightTag(t.v);
      if (KEEP_INSIDE.has(t.name) && !/\/>$/.test(t.v)) { pre++; continue; }
      if (!VOID.has(t.name) && !/\/>$/.test(t.v) && blk) { level++; if (!RAW.has(t.name)) start(); }
      continue;
    }
    if (t.t === 'close') {
      const blk = BLOCK.has(t.name);
      if (blk) { level = Math.max(0, level - 1); if (!RAW.has(t.name) || /\n/.test(line)) start(); }
      line += tightTag(t.v);
      if (blk) start();
      continue;
    }
    if (t.t === 'raw') {
      let v = t.v;
      const pad = IND.repeat(level);
      let inner = null;
      if (t.of === 'script' && isJsType(attrOf(t.open.v, 'type')) && v.trim()) { try { inner = beautifyJs(v, o); } catch (e) { notes.push('A script was left as it is: ' + e.message + '.'); } }
      else if (t.of === 'script' && /json/i.test(attrOf(t.open.v, 'type') || '') && v.trim()) { try { inner = JSON.stringify(JSON.parse(v), null, IND).replace(/</g, '\\u003c') + '\n'; } catch (e) { /* left */ } }
      else if (t.of === 'style' && v.trim()) { try { inner = beautifyCss(v, o); } catch (e) { notes.push('A style block was left as it is: ' + e.message + '.'); } }
      if (inner !== null) {
        flush();
        inner.replace(/\n$/, '').split('\n').forEach((x) => lines.push(x ? pad + x : ''));
        line = IND.repeat(Math.max(0, level - 1));
      } else line += v;
      continue;
    }
    if (t.t === 'com' || t.t === 'decl') { start(); line += t.v; start(); continue; }
    /* text: white space collapsed, kept where it shows */
    let v = t.v.replace(/[ \t\n\r\f]+/g, ' ');
    if (!line.trim()) v = v.replace(/^ /, '');
    const nextT = toks[k + 1];
    if (nextT && boundary(nextT)) v = v.replace(/ $/, '');
    if (v === ' ' && !line.trim()) v = '';
    line += v;
  }
  flush();
  return { text: lines.join('\n') + '\n', notes: notes };
}

function bytes(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : unescape(encodeURIComponent(s)).length; }
function size(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB'; }
/** which language is this? */
function sniff(t) {
  const s = String(t).replace(/^\uFEFF/, '').trimStart();
  if (/^<(!doctype|html|head|body|div|p|span|section|main|header|nav|ul|table|script|style|meta|link|!--|svg|a\b|img|h[1-6]|form)/i.test(s)) return 'html';
  if (/^[@.#:\w\-\[*][^{;]*\{[^}]*:[^}]*;?\s*\}/.test(s) && !/\b(function|const|let|var|=>|return)\b/.test(s.slice(0, 400))) return 'css';
  return 'js';
}

window.CODE_LANG = { lexJs: lexJs, minifyJs: minifyJs, beautifyJs: beautifyJs, lexCss: lexCss, parseCss: parseCss, minifyCss: minifyCss, beautifyCss: beautifyCss,
  lexHtml: lexHtml, minifyHtml: minifyHtml, beautifyHtml: beautifyHtml, sniff: sniff, bytes: bytes, size: size, LexError: LexError };
})();
