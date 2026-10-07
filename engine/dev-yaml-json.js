(function () {
'use strict';
/* YAML ↔ JSON, with this site's own YAML reader and writer (no library).
   What it reads is a stated subset of YAML 1.2: block and flow collections,
   plain, quoted and block (| >) scalars, comments, several documents,
   anchors and aliases, the << merge key and the standard !! tags. It refuses,
   with the line, what it does not read: complex (?) keys, custom tags such
   as !Ref, and %TAG directives. Numbers keep every digit: a 20-digit ID is
   written to JSON exactly as typed. */

window.DEV_TOOLS = window.DEV_TOOLS || {};

class YErr extends Error { constructor(msg, line, col) { super(msg + (line ? ' (line ' + line + (col ? ', column ' + col : '') + ')' : '')); this.line = line; this.col = col; } }
/** a number with its exact text, so big integers survive */
class Num { constructor(text, value) { this.text = text; this.value = value; } }

const MAX_NODES = 1000000;

/* ---------------- scalars: the YAML 1.2 core schema ---------------- */
const YAML11_BOOL = /^(y|Y|yes|Yes|YES|n|N|no|No|NO|on|On|ON|off|Off|OFF)$/;
function resolvePlain(s, warns, line) {
  if (s === '' || s === '~' || /^(null|Null|NULL)$/.test(s)) return null;
  if (/^(true|True|TRUE)$/.test(s)) return true;
  if (/^(false|False|FALSE)$/.test(s)) return false;
  if (/^[-+]?[0-9]+$/.test(s)) {
    if (/^[-+]?0[0-9]+$/.test(s) && warns) warns.push('Line ' + line + ': ' + s + ' is read as the decimal number ' + Number(s) + ' (YAML 1.2); a YAML 1.1 reader takes a leading 0 as octal. Quote it if it is a code.');
    return intNum(s.replace(/^\+/, ''));
  }
  if (/^0o[0-7]+$/.test(s)) return intNum(BigInt('0o' + s.slice(2)).toString());
  if (/^0x[0-9a-fA-F]+$/.test(s)) return intNum(BigInt(s).toString());
  if (/^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/.test(s)) return new Num(String(Number(s)), Number(s));
  if (/^[-+]?\.(inf|Inf|INF)$/.test(s)) return new Num(s[0] === '-' ? '-Infinity' : 'Infinity', s[0] === '-' ? -Infinity : Infinity);
  if (/^\.(nan|NaN|NAN)$/.test(s)) return new Num('NaN', NaN);
  if (YAML11_BOOL.test(s) && warns) warns.push('Line ' + line + ': ' + s + ' stays the string "' + s + '" (YAML 1.2); a YAML 1.1 reader such as PyYAML reads it as ' + (/^(y|yes|on)$/i.test(s) ? 'true' : 'false') + '.');
  return s;
}
function intNum(t) {
  const neg = t[0] === '-';
  let d = (neg ? t.slice(1) : t).replace(/^0+(?=\d)/, '');
  const txt = (neg && d !== '0' ? '-' : '') + d;
  return new Num(txt, Number(txt));
}

/* ---------------- the reader ---------------- */
function parseYaml(src, warns) {
  const text = String(src).replace(/\r\n?/g, '\n').replace(/^\ufeff/, '');
  const raw = text.split('\n');
  /* documents: split at --- and ... at column 0 */
  const docs = [];
  let cur = null, sawDirective = false, explicitEnd = true;
  for (let i = 0; i < raw.length; i++) {
    const l = raw[i];
    if (/^%/.test(l) && (cur === null || explicitEnd)) {
      if (/^%TAG\b/.test(l)) throw new YErr('%TAG directives are not supported', i + 1, 1);
      if (!/^%YAML\s+1\.[0-2]\b/.test(l)) throw new YErr('unknown directive ' + l.split(/\s/)[0], i + 1, 1);
      sawDirective = true; continue;
    }
    const m = /^---(?=\s|$)(.*)$/.exec(l);
    if (m) { if (cur) docs.push(cur); cur = { start: i, lines: [] }; explicitEnd = false; sawDirective = false; if (m[1].trim()) cur.lines.push({ n: i + 1, s: ' '.repeat(4) + m[1].replace(/^\s+/, '') }); continue; }
    if (/^\.\.\.(?=\s|$)/.test(l)) { if (cur) docs.push(cur); cur = null; explicitEnd = true; continue; }
    if (sawDirective) throw new YErr('a directive must be followed by ---', i + 1, 1);
    if (!cur) { if (!l.trim() || /^\s*#/.test(l)) continue; cur = { start: i, lines: [] }; explicitEnd = false; }
    cur.lines.push({ n: i + 1, s: l });
  }
  if (cur) docs.push(cur);
  return docs.map((d) => new Doc(d.lines, warns).parse());
}

function Doc(lines, warns) {
  this.L = lines.map((x) => {
    const m = /^( *)(\t*)/.exec(x.s);
    return { n: x.n, ind: m[1].length, s: x.s, tab: m[2].length > 0 && x.s.trim() !== '' && !/^\s*#/.test(x.s) };
  });
  this.i = 0;
  this.anchors = {};
  this.nodes = 0;
  this.warns = warns;
}
Doc.prototype.isBlank = function (l) { const t = l.s.trim(); return t === '' || t[0] === '#'; };
Doc.prototype.skip = function () { while (this.i < this.L.length && this.isBlank(this.L[this.i])) this.i++; };
Doc.prototype.parse = function () {
  this.skip();
  if (this.i >= this.L.length) return null;
  const v = this.node(-1);
  this.skip();
  if (this.i < this.L.length) { const l = this.L[this.i]; throw new YErr('unexpected text; check the indentation', l.n, l.ind + 1); }
  return v;
};
Doc.prototype.count = function () { if (++this.nodes > MAX_NODES) throw new YErr('more than ' + MAX_NODES.toLocaleString('en-GB') + ' values once aliases are expanded'); };
Doc.prototype.body = function (l) { return l.s.slice(l.ind); };

/** a node whose first line is the current one and is indented more than `parent` */
Doc.prototype.node = function (parent) {
  this.skip();
  const l = this.L[this.i];
  if (!l || l.ind <= parent) return null;
  if (l.tab) throw new YErr('a tab is used for indentation; YAML allows spaces only', l.n, 1);
  const b = this.body(l);
  if (/^-( |$)/.test(b)) return this.seq(l.ind);
  if (this.keyOf(b, l) !== null) return this.map(l.ind);
  /* properties (anchor, tag) alone on a line, the node below */
  const props = this.props(b, l);
  if (props.rest === '' && (props.anchor || props.tag)) {
    this.i++;
    let v = this.node(parent);
    if (v === null) v = null;
    return this.finish(v, props, l);
  }
  return this.inlineValue(b, l, parent, l.ind);
};

/** anchor &a and tag !!x at the start of a value */
Doc.prototype.props = function (s, l) {
  let anchor = null, tag = null, m;
  for (let k = 0; k < 2; k++) {
    if (!anchor && (m = /^&([^\s,\[\]{}]+)(\s+|$)/.exec(s))) { anchor = m[1]; s = s.slice(m[0].length); continue; }
    if (!tag && (m = /^(!\S*)(\s+|$)/.exec(s))) { tag = m[1]; s = s.slice(m[0].length); continue; }
  }
  if (tag && !/^!!(str|int|float|bool|null|seq|map|binary|timestamp)$/.test(tag) && tag !== '!') throw new YErr('the tag ' + tag + ' is not supported (only the standard !! tags are)', l.n);
  return { anchor: anchor, tag: tag, rest: s.replace(/^\s+#.*$/, '').replace(/^#.*$/, '') === '' ? '' : s };
};
Doc.prototype.finish = function (v, props, l) {
  if (props.tag) v = applyTag(v, props.tag, l, props.quoted);
  if (props.anchor) this.anchors[props.anchor] = v;
  return v;
};
function applyTag(v, tag, l, quoted) {
  const t = tag.slice(2);
  const sv = v === null ? '' : v instanceof Num ? v.text : String(v);
  if (tag === '!' || t === 'str') return v instanceof Num || typeof v === 'boolean' || v === null ? (quoted !== undefined ? quoted : sv) : v;
  if (t === 'int') { const r = resolvePlain(sv); if (!(r instanceof Num) || !/^-?\d+$/.test(r.text)) throw new YErr('!!int needs a whole number, not ' + sv, l.n); return r; }
  if (t === 'float') { const r = resolvePlain(sv); if (!(r instanceof Num)) throw new YErr('!!float needs a number, not ' + sv, l.n); return new Num(String(r.value), r.value); }
  if (t === 'bool') { const r = resolvePlain(sv); if (typeof r !== 'boolean') throw new YErr('!!bool needs true or false, not ' + sv, l.n); return r; }
  if (t === 'null') return null;
  if (t === 'seq' && !Array.isArray(v)) throw new YErr('!!seq on something that is not a list', l.n);
  if (t === 'map' && (v === null || typeof v !== 'object' || Array.isArray(v) || v instanceof Num)) throw new YErr('!!map on something that is not a mapping', l.n);
  return v;
}

/** where a mapping key ends on this line: { key, rest, quoted } or null */
Doc.prototype.keyOf = function (b, l) {
  if (/^\? /.test(b) || b === '?') throw new YErr('complex keys (?) are not supported', l.n, l.ind + 1);
  let s = b, anchor = null, m;
  if ((m = /^&([^\s,\[\]{}]+)\s+/.exec(s))) { anchor = m[1]; s = s.slice(m[0].length); }
  if (s[0] === '"' || s[0] === "'") {
    const q = readQuoted(s, 0, l);
    if (q.multi) return null;
    const after = s.slice(q.end);
    const k = /^\s*:(\s|$)/.exec(after);
    if (!k) return null;
    return { key: q.value, rest: after.slice(k[0].length), anchor: anchor };
  }
  if (/^[\[{]/.test(s)) {
    if (/^[\[{][^\]}]*[\]}]\s*:(\s|$)/.test(s)) throw new YErr('a list or mapping used as a key is not supported', l.n, l.ind + 1);
    return null;
  }
  if (/^[*!|>%@`]/.test(s) || /^-( |$)/.test(s)) return null;
  for (let j = 0; j < s.length; j++) {
    if (s[j] === '#' && j > 0 && /\s/.test(s[j - 1])) return null;
    if (s[j] === ':' && (j + 1 === s.length || /\s/.test(s[j + 1]))) {
      const key = s.slice(0, j).trim();
      return { key: key, rest: s.slice(j + 1), anchor: anchor, plain: true };
    }
  }
  return null;
};

Doc.prototype.seq = function (ind) {
  const out = [];
  for (;;) {
    this.skip();
    const l = this.L[this.i];
    if (!l || l.ind !== ind || !/^-( |$)/.test(this.body(l))) {
      if (l && l.ind > ind) throw new YErr('this line is indented more than the list item above, but is not part of it', l.n, l.ind + 1);
      break;
    }
    this.count();
    const after = this.body(l).slice(1);
    const sp = /^ */.exec(after)[0].length;
    const rest = after.slice(sp);
    if (rest === '' || rest[0] === '#') { this.i++; const v = this.node(ind); out.push(v); continue; }
    /* the rest of the line is a node of its own, at its column */
    this.L[this.i] = { n: l.n, ind: ind + 1 + sp, s: ' '.repeat(ind + 1 + sp) + rest, tab: false };
    out.push(this.node(ind));
  }
  return out;
};

Doc.prototype.map = function (ind) {
  const out = {};
  const seen = Object.create(null);
  const merges = [];
  for (;;) {
    this.skip();
    const l = this.L[this.i];
    if (!l || l.ind !== ind) {
      if (l && l.ind > ind) throw new YErr('this line is indented more than the key above, but is not part of it', l.n, l.ind + 1);
      break;
    }
    const b = this.body(l);
    const k = this.keyOf(b, l);
    if (!k) throw new YErr(/^-( |$)/.test(b) ? 'a list item where a key was expected; indent the list under its key' : 'a key and a colon were expected', l.n, l.ind + 1);
    this.count();
    const key = k.plain ? String(keyText(k.key)) : k.key;
    if (key in seen && !(k.plain && k.key === '<<')) throw new YErr('the key "' + key + '" appears twice in this mapping (first on line ' + seen[key] + ')', l.n, l.ind + 1);
    seen[key] = l.n;
    let rest = k.rest.replace(/^\s+/, '');
    let v;
    if (rest === '' || rest[0] === '#') {
      this.i++;
      this.skip();
      const nx = this.L[this.i];
      /* a list may sit at the key's own indentation */
      if (nx && nx.ind === ind && /^-( |$)/.test(this.body(nx))) v = this.seq(ind);
      else v = this.node(ind);
    } else {
      const col = l.s.length - rest.length;
      const props = this.props(rest, l);
      if (props.rest === '' && (props.anchor || props.tag)) {
        this.i++;
        this.skip();
        const nx = this.L[this.i];
        v = nx && nx.ind === ind && /^-( |$)/.test(this.body(nx)) ? this.seq(ind) : this.node(ind);
        v = this.finish(v, props, l);
      } else {
        v = this.inlineValue(rest, l, ind, col);
      }
    }
    if (k.anchor) this.anchors[k.anchor] = key;
    if (k.plain && k.key === '<<') { merges.push({ merge: v, l: l }); continue; }
    merges.push({ key: key, v: v });
  }
  /* << merges, in place: keys written in the mapping win, then earlier sources */
  const own = new Set(merges.filter((m) => !m.l).map((m) => m.key));
  const put = (k, v) => {
    if (k === '__proto__') Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
    else out[k] = v;
  };
  merges.forEach((m) => {
    if (!m.l) { put(m.key, m.v); return; }
    const srcs = Array.isArray(m.merge) ? m.merge : [m.merge];
    srcs.forEach((s) => {
      if (!s || typeof s !== 'object' || Array.isArray(s) || s instanceof Num) throw new YErr('<< must name a mapping or a list of mappings', m.l.n);
      Object.keys(s).forEach((kk) => { if (!own.has(kk) && !Object.prototype.hasOwnProperty.call(out, kk)) put(kk, s[kk]); });
    });
  });
  return out;
};
function keyText(k) {
  const v = resolvePlain(k);
  return v === null ? (k === '' ? '' : 'null') : v instanceof Num ? v.text : String(v);
}

/** a value that starts on this line at column `col` (0-based) */
Doc.prototype.inlineValue = function (s, l, parent, col) {
  const props = this.props(s, l);
  s = props.rest;
  let v;
  if (s[0] === '*') {
    const m = /^\*([^\s,\[\]{}]+)\s*(#.*)?$/.exec(s);
    if (!m) throw new YErr('an alias must stand alone', l.n, col + 1);
    if (!(m[1] in this.anchors)) throw new YErr('the alias *' + m[1] + ' names no anchor defined above it', l.n, col + 1);
    this.i++;
    v = this.anchors[m[1]];
    this.nodes += countValues(v);
    if (this.nodes > MAX_NODES) throw new YErr('more than ' + MAX_NODES.toLocaleString('en-GB') + ' values once aliases are expanded', l.n);
    return v;
  }
  if (s[0] === '|' || s[0] === '>') {
    v = this.blockScalar(s, l, parent);
    return this.finish(v, props, l);
  }
  if (s[0] === '[' || s[0] === '{') {
    /* gather lines until the brackets close */
    let buf = s, j = this.i;
    const lines = [{ n: l.n, off: l.s.length - s.length }];
    let fl;
    for (;;) {
      fl = new Flow(buf, lines, this);
      const r = fl.tryParse();
      if (r.done) { v = r.value; break; }
      j++;
      if (j >= this.L.length) throw new YErr('this ' + (s[0] === '[' ? '[ list' : '{ mapping') + ' is never closed', l.n, col + 1);
      const nl = this.L[j];
      if (!this.isBlank(nl) && nl.ind <= parent) throw new YErr('this ' + (s[0] === '[' ? '[ list' : '{ mapping') + ' is never closed', l.n, col + 1);
      lines.push({ n: nl.n, off: 0, at: buf.length + 1 });
      buf += '\n' + nl.s;
    }
    this.i = j + 1;
    return this.finish(v, props, l);
  }
  if (s[0] === '"' || s[0] === "'") {
    let buf = s, j = this.i;
    let q;
    for (;;) {
      q = readQuoted(buf, 0, l);
      if (!q.multi) break;
      j++;
      if (j >= this.L.length) throw new YErr('this quoted text is never closed', l.n, col + 1);
      buf += '\n' + this.L[j].s;
    }
    const after = buf.slice(q.end).replace(/^\s+/, '');
    if (after && after[0] !== '#') throw new YErr('text after the closing quote', this.L[j].n);
    this.i = j + 1;
    props.quoted = q.value;
    return this.finish(q.value, props, l);
  }
  /* plain, perhaps over several lines */
  let txt = stripComment(s);
  if (/^[@`]/.test(txt)) throw new YErr(txt[0] + ' cannot start a plain value; quote it', l.n, col + 1);
  if (/^%/.test(txt) && col === 0) throw new YErr('% cannot start a plain value; quote it', l.n, col + 1);
  const parts = [txt.trim()];
  let blanks = 0;
  this.i++;
  if (s.indexOf(' #') < 0 && s[0] !== '#') {
    while (this.i < this.L.length) {
      const nl = this.L[this.i];
      const t = nl.s.trim();
      if (t === '') { blanks++; this.i++; continue; }
      if (nl.ind <= parent || t[0] === '#') break;
      if (this.keyOf(this.body(nl), nl) !== null || /^-( |$)/.test(this.body(nl))) {
        if (nl.ind > parent) throw new YErr('a key or list item cannot follow a plain value; check the indentation', nl.n, nl.ind + 1);
        break;
      }
      parts.push(blanks ? '\n'.repeat(blanks) : ' ');
      parts.push(stripComment(t).trim());
      blanks = 0;
      this.i++;
      if (t.indexOf(' #') >= 0) break;
    }
    if (blanks) { /* blank lines that ended the value belong to nobody */
      let back = this.i;
      while (back > 0 && this.L[back - 1].s.trim() === '') back--;
      this.i = back;
    }
  }
  txt = parts.join('').replace(/ \n/g, '\n').replace(/\n /g, '\n');
  if (/:\s/.test(parts[0]) && parts.length === 1) throw new YErr('": " inside a plain value; quote the value', l.n, col + 1 + parts[0].indexOf(': '));
  v = props.tag ? txt : resolvePlain(txt, this.warns, l.n);
  props.quoted = txt;
  return this.finish(v, props, l);
};
function stripComment(s) {
  for (let j = 0; j < s.length; j++) if (s[j] === '#' && (j === 0 || /\s/.test(s[j - 1]))) return s.slice(0, j);
  return s;
}
function countValues(v) {
  if (Array.isArray(v)) return v.reduce((n, x) => n + countValues(x), 1);
  if (v && typeof v === 'object' && !(v instanceof Num)) return Object.keys(v).reduce((n, k) => n + countValues(v[k]), 1);
  return 1;
}

/** | and > block scalars, with chomping (- +) and an indentation digit */
Doc.prototype.blockScalar = function (h, l, parent) {
  const m = /^([|>])([1-9]?)([-+]?)([1-9]?)\s*(#.*)?$/.exec(h);
  if (!m) throw new YErr('a block scalar header is | or > with an optional - or + and digit', l.n);
  const fold = m[1] === '>';
  const chomp = m[3] || '';
  const given = Number(m[2] || m[4] || 0);
  this.i++;
  let ind = given ? (parent < 0 ? 0 : parent) + given : 0;
  const body = [];
  let j = this.i;
  if (!ind) {
    for (let k = j; k < this.L.length; k++) {
      const s = this.L[k].s;
      if (s.trim() === '') continue;
      const n = /^ */.exec(s)[0].length;
      ind = n;
      break;
    }
    if (ind <= parent) ind = parent + 1;
  }
  while (j < this.L.length) {
    const s = this.L[j].s;
    const n = /^ */.exec(s)[0].length;
    if (s.trim() === '' ) { body.push(s.length > ind ? s.slice(ind) : ''); j++; continue; }
    if (n < ind) break;
    body.push(s.slice(ind));
    j++;
  }

  /* trailing blank lines are chomping's business */
  let end = body.length;
  while (end > 0 && body[end - 1].trim() === '' && body[end - 1] === '' ) end--;
  const content = body.slice(0, end), tail = body.length - end;
  let text = '';
  if (fold) text = foldBlank(content);
  else text = content.join('\n');
  if (content.length) {
    if (chomp === '-') { /* strip */ }
    else if (chomp === '+') text += '\n' + '\n'.repeat(tail);
    else text += '\n';
  } else if (chomp === '+') text = '\n'.repeat(tail);
  this.i = j;
  return text;
};
/** folding (>) as YAML 1.2 §8.1.3: a single line break between two
    non-indented lines is a space; empty lines give line breaks; lines
    indented more keep their breaks */
function foldBlank(lines) {
  let out = '';
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k];
    if (k === 0) { out = line; continue; }
    const prev = lines[k - 1];
    const more = /^[ \t]/.test(line), prevMore = /^[ \t]/.test(prev);
    if (line === '') { out += '\n'; continue; }
    if (prev === '') {
      /* after empty lines: they already gave their breaks; one more break
         unless both neighbours are plain text lines */
      let p = k - 1; while (p >= 0 && lines[p] === '') p--;
      const before = p >= 0 ? lines[p] : null;
      if (before !== null && (more || /^[ \t]/.test(before))) out += '\n';
      out += line;
      continue;
    }
    out += (more || prevMore ? '\n' : ' ') + line;
  }
  return out;
}

/* quoted scalars: '…' with '' for a quote; "…" with \ escapes; line breaks fold */
function readQuoted(s, at, l) {
  const q = s[at];
  let j = at + 1, out = '';
  const fold = () => {
    /* a line break inside quotes: trailing spaces go, the break and leading
       spaces become one space, or n-1 breaks for n breaks */
    out = out.replace(/[ \t]+$/, '');
    let breaks = 0;
    while (j < s.length && /[ \t\n]/.test(s[j])) { if (s[j] === '\n') breaks++; j++; }
    out += breaks > 1 ? '\n'.repeat(breaks - 1) : ' ';
  };
  while (j < s.length) {
    const c = s[j];
    if (q === "'") {
      if (c === "'") { if (s[j + 1] === "'") { out += "'"; j += 2; continue; } return { value: out, end: j + 1 }; }
      if (c === '\n') { fold(); continue; }
      out += c; j++; continue;
    }
    if (c === '"') return { value: out, end: j + 1 };
    if (c === '\n') { fold(); continue; }
    if (c === '\\') {
      const e = s[j + 1];
      const map = { '0': '\0', a: '\x07', b: '\b', t: '\t', '\t': '\t', n: '\n', v: '\v', f: '\f', r: '\r', e: '\x1b', ' ': ' ', '"': '"', '/': '/', '\\': '\\', N: '\x85', _: '\xa0', L: '\u2028', P: '\u2029' };
      if (e === '\n') { j += 2; while (j < s.length && /[ \t]/.test(s[j])) j++; continue; }
      if (e in map) { out += map[e]; j += 2; continue; }
      const len = { x: 2, u: 4, U: 8 }[e];
      if (len) {
        const hex = s.slice(j + 2, j + 2 + len);
        if (!new RegExp('^[0-9a-fA-F]{' + len + '}$').test(hex)) throw new YErr('\\' + e + ' needs ' + len + ' hex digits', l && l.n);
        out += String.fromCodePoint(parseInt(hex, 16));
        j += 2 + len; continue;
      }
      throw new YErr('unknown escape \\' + (e || ''), l && l.n);
    }
    out += c; j++;
  }
  return { multi: true };
}

/* ---------------- flow collections [ ] { } ---------------- */
function Flow(src, lines, doc) { this.s = src; this.j = 0; this.lines = lines; this.doc = doc; }
Flow.prototype.tryParse = function () {
  try {
    const v = this.value();
    this.ws();
    const rest = this.s.slice(this.j).replace(/^\s*(#.*)?$/, '');
    if (rest) throw this.err('text after the closing bracket');
    return { done: true, value: v };
  } catch (e) {
    if (e === EOF) return { done: false };
    throw e;
  }
};
const EOF = { eof: true };
Flow.prototype.pos = function () {
  let line = this.lines[0];
  for (const l of this.lines) if (l.at !== undefined && l.at <= this.j) line = l;
  const col = line.at !== undefined ? this.j - line.at + 1 : this.j + line.off + 1;
  return { n: line.n, col: col };
};
Flow.prototype.err = function (m) { const p = this.pos(); return new YErr(m, p.n, p.col); };
Flow.prototype.ws = function () {
  for (;;) {
    while (this.j < this.s.length && /[ \t\n]/.test(this.s[this.j])) this.j++;
    if (this.s[this.j] === '#' && (this.j === 0 || /\s/.test(this.s[this.j - 1]))) { while (this.j < this.s.length && this.s[this.j] !== '\n') this.j++; continue; }
    break;
  }
};
Flow.prototype.value = function () {
  this.ws();
  if (this.j >= this.s.length) throw EOF;
  this.doc.count();
  let anchor = null, tag = null, m;
  for (let k = 0; k < 2; k++) {
    const rest = this.s.slice(this.j);
    if (!anchor && (m = /^&([^\s,\[\]{}]+)\s*/.exec(rest))) { anchor = m[1]; this.j += m[0].length; continue; }
    if (!tag && (m = /^(!\S*?)(?=[\s,\]}])\s*/.exec(rest))) { tag = m[1]; this.j += m[0].length; continue; }
  }
  if (tag && !/^!!(str|int|float|bool|null|seq|map)$/.test(tag)) throw this.err('the tag ' + tag + ' is not supported');
  const c = this.s[this.j];
  let v, quoted;
  if (c === '[') v = this.seq();
  else if (c === '{') v = this.map();
  else if (c === '*') {
    m = /^\*([^\s,\[\]{}]+)/.exec(this.s.slice(this.j));
    if (!m || !(m[1] in this.doc.anchors)) throw this.err('the alias names no anchor defined above it');
    this.j += m[0].length;
    v = this.doc.anchors[m[1]];
  } else if (c === '"' || c === "'") {
    const q = readQuoted(this.s, this.j, null);
    if (q.multi) throw EOF;
    this.j = q.end; v = q.value; quoted = v;
  } else {
    const start = this.j;
    while (this.j < this.s.length) {
      const ch = this.s[this.j];
      if (ch === ',' || ch === ']' || ch === '}' || ch === '[' || ch === '{') break;
      if (ch === ':' && /[\s,\]}]/.test(this.s[this.j + 1] || ' ')) break;
      if (ch === '#' && /\s/.test(this.s[this.j - 1])) break;
      this.j++;
    }
    const t = this.s.slice(start, this.j).replace(/\s*\n\s*/g, ' ').trim();
    if (this.j >= this.s.length) throw EOF;
    v = tag ? t : resolvePlain(t, this.doc.warns, this.pos().n);
    quoted = t;
  }
  if (tag) v = applyTag(v, tag, { n: this.pos().n }, quoted);
  if (anchor) this.doc.anchors[anchor] = v;
  return v;
};
Flow.prototype.seq = function () {
  this.j++;
  const out = [];
  for (;;) {
    this.ws();
    if (this.j >= this.s.length) throw EOF;
    if (this.s[this.j] === ']') { this.j++; return out; }
    const v = this.value();
    this.ws();
    if (this.s[this.j] === ':' ) { /* a single pair in a list: [a: 1] */
      this.j++;
      const val = this.value();
      const o = {}; o[keyString(v)] = val; out.push(o);
      this.ws();
    } else out.push(v);
    if (this.j >= this.s.length) throw EOF;
    if (this.s[this.j] === ',') { this.j++; continue; }
    if (this.s[this.j] === ']') { this.j++; return out; }
    throw this.err('a comma or ] was expected');
  }
};
Flow.prototype.map = function () {
  this.j++;
  const out = {};
  for (;;) {
    this.ws();
    if (this.j >= this.s.length) throw EOF;
    if (this.s[this.j] === '}') { this.j++; return out; }
    if (this.s[this.j] === '[' || this.s[this.j] === '{') throw this.err('a list or mapping used as a key is not supported');
    const k = this.value();
    if (k !== null && typeof k === 'object' && !(k instanceof Num)) throw this.err('a list or mapping used as a key is not supported');
    this.ws();
    let v = null;
    if (this.s[this.j] === ':') { this.j++; this.ws(); if (this.s[this.j] !== ',' && this.s[this.j] !== '}') v = this.value(); }
    const key = keyString(k);
    if (Object.prototype.hasOwnProperty.call(out, key)) throw this.err('the key "' + key + '" appears twice in this mapping');
    if (key === '__proto__') Object.defineProperty(out, key, { value: v, enumerable: true, writable: true, configurable: true });
    else out[key] = v;
    this.ws();
    if (this.j >= this.s.length) throw EOF;
    if (this.s[this.j] === ',') { this.j++; continue; }
    if (this.s[this.j] === '}') { this.j++; return out; }
    throw this.err('a comma or } was expected');
  }
};
function keyString(k) { return k === null ? 'null' : k instanceof Num ? k.text : String(k); }

/* ---------------- JSON in, keeping number text ---------------- */
function parseJson(s) {
  let j = 0;
  const err = (m) => { const before = s.slice(0, j); const line = before.split('\n').length; const col = j - before.lastIndexOf('\n'); return new YErr(m, line, col); };
  const ws = () => { while (j < s.length && /[ \t\n\r]/.test(s[j])) j++; };
  const val = () => {
    ws();
    const c = s[j];
    if (c === '{') {
      j++; const o = {}; ws();
      if (s[j] === '}') { j++; return o; }
      for (;;) {
        ws(); if (s[j] !== '"') throw err('a key in double quotes was expected');
        const k = str(); ws();
        if (s[j] !== ':') throw err('a colon was expected'); j++;
        const v = val();
        if (k === '__proto__') Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true }); else o[k] = v;
        ws();
        if (s[j] === ',') { j++; continue; }
        if (s[j] === '}') { j++; return o; }
        throw err('a comma or } was expected');
      }
    }
    if (c === '[') {
      j++; const a = []; ws();
      if (s[j] === ']') { j++; return a; }
      for (;;) {
        a.push(val()); ws();
        if (s[j] === ',') { j++; continue; }
        if (s[j] === ']') { j++; return a; }
        throw err('a comma or ] was expected');
      }
    }
    if (c === '"') return str();
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?/.exec(s.slice(j, j + 400));
    if (m && m[0]) { j += m[0].length; const t = m[0]; return /^-?\d+$/.test(t) ? new Num(t, Number(t)) : new Num(String(Number(t)) === t ? t : t, Number(t)); }
    for (const [w, v] of [['true', true], ['false', false], ['null', null]]) if (s.startsWith(w, j)) { j += w.length; return v; }
    throw err(j >= s.length ? 'the JSON ends too early' : 'unexpected ' + JSON.stringify(s[j]));
  };
  const str = () => {
    const start = j; j++;
    while (j < s.length && s[j] !== '"') { if (s[j] === '\\') j++; else if (s[j] < ' ') throw err('a control character inside a string'); j++; }
    if (j >= s.length) throw err('a string is never closed');
    j++;
    try { return JSON.parse(s.slice(start, j)); } catch (e) { throw err('a bad escape in a string'); }
  };
  const v = val(); ws();
  if (j < s.length) throw err('text after the end of the JSON');
  return v;
}

/* ---------------- writers ---------------- */
function writeJson(v, indent, warns) {
  const nl = indent ? '\n' : '';
  const w = (x, pad) => {
    if (x === null) return 'null';
    if (x instanceof Num) {
      if (!isFinite(x.value)) { warns.push(x.text + ' has no JSON form; written as null.'); return 'null'; }
      return /^-?\d+$/.test(x.text) ? x.text : String(x.value);
    }
    if (typeof x === 'boolean') return String(x);
    if (typeof x === 'string') return JSON.stringify(x);
    const inner = pad + indent;
    if (Array.isArray(x)) {
      if (!x.length) return '[]';
      return '[' + nl + x.map((y) => inner + w(y, inner)).join(',' + nl) + nl + pad + ']';
    }
    const ks = Object.keys(x);
    if (!ks.length) return '{}';
    return '{' + nl + ks.map((k) => inner + JSON.stringify(k) + ':' + (indent ? ' ' : '') + w(x[k], inner)).join(',' + nl) + nl + pad + '}';
  };
  return w(v, '');
}

/* a string that any YAML reader, 1.1 or 1.2, reads back as the same string */
function plainSafe(s) {
  if (s === '' || s !== s.trim() || /[\n\r\t\x00-\x1f\x7f\x85\u2028\u2029\ufeff]/.test(s)) return false;
  if (/^[-?:,\[\]{}#&*!|>'"%@`]/.test(s)) return false;
  if (/: |:$| #|,\s*$/.test(s)) return false;
  if (/[\[\]{},]/.test(s)) return false;
  if (resolvePlain(s) !== s) return false;
  if (YAML11_BOOL.test(s) || /^[-+]?(0b[01_]+|0[0-7_]+|[0-9][0-9_]*(:[0-5]?[0-9])+(\.[0-9_]*)?|[0-9][0-9_]*|0x[0-9a-fA-F_]+|\.[0-9_]+|[0-9][0-9_]*\.[0-9_]*([eE][-+][0-9]+)?)$/.test(s)) return false;
  if (/^\d{4}-\d{1,2}-\d{1,2}([Tt ]|$)/.test(s) || /^(=|<<|~)$/.test(s)) return false;
  if (/^\.(inf|nan)$/i.test(s.replace(/^[-+]/, ''))) return false;
  return true;
}
function yamlString(s, pad, indent, block) {
  if (plainSafe(s)) return s;
  if (block && /\n/.test(s) && !/[\x00-\x08\x0b-\x1f\x7f\x85\u2028\u2029\ufeff]/.test(s) && !/[ \t]\n|[ \t]$/.test(s.replace(/\n+$/, ''))) {
    const trail = /\n*$/.exec(s)[0].length;
    const chomp = trail === 0 ? '-' : trail === 1 ? '' : '+';
    const body = trail ? s.slice(0, s.length - trail) : s;
    const lead = /^[ \t]/.test(body) ? String(indent.length) : '';
    const inner = pad + indent;
    const lines = body.split('\n').map((x) => (x ? inner + x : ''));
    for (let k = 1; k < trail; k++) lines.push('');
    return '|' + lead + chomp + '\n' + lines.join('\n');
  }
  return JSON.stringify(s).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
function writeYaml(v, indent, block) {
  const scalar = (x, pad) => {
    if (x === null) return 'null';
    if (x instanceof Num) return !isFinite(x.value) ? (isNaN(x.value) ? '.nan' : x.value > 0 ? '.inf' : '-.inf') : (/^-?\d+$/.test(x.text) ? x.text : String(x.value));
    if (typeof x === 'boolean') return String(x);
    return yamlString(x, pad, indent, block);
  };
  const isColl = (x) => x !== null && typeof x === 'object' && !(x instanceof Num);
  const empty = (x) => (Array.isArray(x) ? !x.length : !Object.keys(x).length);
  const w = (x, pad) => {
    if (!isColl(x) || empty(x)) return pad + (isColl(x) ? (Array.isArray(x) ? '[]' : '{}') : scalar(x, pad));
    if (Array.isArray(x)) {
      return x.map((y) => {
        if (isColl(y) && !empty(y)) {
          const sub = w(y, pad + indent);
          return pad + '-' + ' '.repeat(indent.length - 1) + sub.slice(pad.length + indent.length);
        }
        return pad + '- ' + (isColl(y) ? (Array.isArray(y) ? '[]' : '{}') : scalar(y, pad));
      }).join('\n');
    }
    return Object.keys(x).map((k) => {
      const key = yamlString(k, pad, indent, false);
      const y = x[k];
      if (isColl(y) && !empty(y)) return pad + key + ':\n' + w(y, pad + indent);
      return pad + key + ': ' + (isColl(y) ? (Array.isArray(y) ? '[]' : '{}') : scalar(y, pad));
    }).join('\n');
  };
  return w(v, '');
}

const plainValue = (v) => {
  if (v instanceof Num) return v.value;
  if (Array.isArray(v)) return v.map(plainValue);
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach((k) => { o[k] = plainValue(v[k]); }); return o; }
  return v;
};
function looksJson(t) { return /^\s*[\[{]/.test(t) && /[\]}]\s*$/.test(t); }

window.DEV_TOOLS['yaml-json'] = {
  title: 'YAML to JSON Converter',
  category: 'developer',
  icon: '⇄',
  kind: 'code',
  description: 'Convert YAML to JSON and JSON to YAML in your browser. Anchors, merge keys, block text and several documents are read; errors give the line, and big numbers keep every digit.',
  keywords: ['yaml to json', 'json to yaml', 'yaml converter', 'yaml validator', 'yaml parser', 'convert yaml', 'kubernetes yaml to json', 'docker compose yaml'],
  inputLabel: 'YAML or JSON',
  outputLabel: 'Converted',
  placeholder: 'name: 1234Tools\ntools:\n  - yaml-json\n  - json-formatter',
  sample: '# a service, as a compose-style file\ndefaults: &defaults\n  restart: unless-stopped\n  replicas: 2\nservices:\n  web:\n    <<: *defaults\n    image: nginx:1.27\n    ports: ["8080:80", "8443:443"]\n    enabled: yes\n  worker:\n    <<: *defaults\n    replicas: 4\n    command: >\n      node worker.js\n      --queue jobs\n    order_id: 12345678901234567890\nnotes: |\n  Line one\n  Line two\n',
  highlight: function (o, res) { return res && res.lang; },
  download: { ext: 'json', type: 'application/json' },
  options: [
    { key: 'dir', label: 'Direction', type: 'select', default: 'auto', options: [{ value: 'auto', label: 'Work it out' }, { value: 'y2j', label: 'YAML → JSON' }, { value: 'j2y', label: 'JSON → YAML' }] },
    { key: 'indent', label: 'Indent', type: 'select', default: '2', options: [{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }, { value: '0', label: 'JSON on one line' }] },
    { key: 'docs', label: 'Several YAML documents', type: 'select', default: 'array', options: [{ value: 'array', label: 'As one JSON array' }, { value: 'lines', label: 'As JSON Lines (one per line)' }] },
    { key: 'block', label: 'Multi-line text in YAML', type: 'select', default: 'block', options: [{ value: 'block', label: 'As | blocks' }, { value: 'quoted', label: 'As "quoted\\n" strings' }] }
  ],
  transform: function (text, o) {
    const t = String(text);
    if (!t.trim()) return { output: '', note: 'Paste YAML or JSON. The direction is worked out from the first character, or set it above.' };
    let dir = o.dir;
    if (dir === 'auto') dir = looksJson(t) ? 'j2y' : 'y2j';
    const warns = [];
    try {
      if (dir === 'j2y') {
        let v;
        try { v = parseJson(t.replace(/^\ufeff/, '')); }
        catch (e) {
          if (o.dir === 'auto') { dir = 'y2j'; throw { retry: true }; }
          throw e;
        }
        const ind = o.indent === '4' ? '    ' : '  ';
        const out = writeYaml(v, ind, o.block !== 'quoted') + '\n';
        const res = { output: out, lang: 'yaml', download: { ext: 'yaml', type: 'application/yaml' }, stats: stats(v, t, out) };
        res.note = 'JSON → YAML. Strings that a YAML 1.1 or 1.2 reader would take for a number, true, false, null or a date are quoted.';
        return res;
      }
    } catch (e) { if (!e || !e.retry) return errorRes(e); }
    let docs;
    try { docs = parseYaml(t, warns); }
    catch (e) { return errorRes(e); }
    if (!docs.length) return { output: '', note: 'The YAML holds only comments.' };
    const ind = o.indent === '0' ? '' : o.indent === '4' ? '    ' : '  ';
    let out;
    if (docs.length === 1) out = writeJson(docs[0], ind, warns);
    else if (o.docs === 'lines') out = docs.map((d) => writeJson(d, '', warns)).join('\n');
    else out = writeJson(docs, ind, warns);
    const res = { output: out + '\n', lang: 'json', download: o.docs === 'lines' && docs.length > 1 ? { ext: 'jsonl', type: 'application/x-ndjson' } : { ext: 'json', type: 'application/json' }, stats: stats(docs.length === 1 ? docs[0] : docs, t, out) };
    res.stats.unshift(['Documents', String(docs.length)]);
    if (warns.length) res.warn = warns.slice(0, 8).join(' ') + (warns.length > 8 ? ' (and ' + (warns.length - 8) + ' more)' : '');
    else res.note = 'YAML → JSON' + (docs.length > 1 ? ', ' + docs.length + ' documents' : '') + '. Comments are not carried over; JSON has none.';
    return res;
  },
  tips: [
    'Paste either kind: text that starts with { or [ and reads as JSON becomes YAML, anything else is read as YAML. Set Direction to force it.',
    'Anchors (&name), aliases (*name) and the << merge key are expanded, so a compose or CI file comes out as the full JSON a program would see.',
    'Words such as yes, no, on and off stay strings, as YAML 1.2 says. The tool warns, because older YAML 1.1 readers turn them into true and false.',
    'Numbers keep every digit: a 20-digit ID is written to the JSON exactly as typed, not rounded as JavaScript would round it.',
    'Several documents split by --- become one JSON array, or JSON Lines if you choose.',
    'Not read, with an error that says so: complex ? keys, custom tags such as !Ref or !Sub, and %TAG directives.'
  ],
  faq: [
    { q: 'Is all of YAML supported?', a: 'No, a stated part of YAML 1.2 that covers configuration files: mappings, lists, every scalar style, comments, documents, anchors, aliases, merge keys and the standard !! tags. Complex keys, custom tags and %TAG are refused with the line number rather than guessed.' },
    { q: 'Why are some strings quoted in the YAML output?', a: 'Because unquoted they would read back as something else. 1.0, true, null, 2026-10-07, 0755 and no are quoted so that both YAML 1.1 and 1.2 readers return the original string.' },
    { q: 'Are my comments kept?', a: 'No. JSON has no comments, so they are dropped on the way to JSON, and JSON brings none back.' }
  ]
};
function errorRes(e) {
  if (e instanceof YErr) return { error: 'Not valid: ' + e.message + '.', errorAt: e.line ? { line: e.line, col: e.col || 0 } : undefined };
  return { error: 'Not valid: ' + ((e && e.message) || String(e)) };
}
function stats(v, input, out) {
  let keys = 0, items = 0, depth = 0;
  const walk = (x, d) => {
    depth = Math.max(depth, d);
    if (Array.isArray(x)) { items += x.length; x.forEach((y) => walk(y, d + 1)); }
    else if (x && typeof x === 'object' && !(x instanceof Num)) { const k = Object.keys(x); keys += k.length; k.forEach((kk) => walk(x[kk], d + 1)); }
  };
  walk(v, 0);
  const b = (s) => { const n = new TextEncoder().encode(s).length; return n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB'; };
  return [['Keys', String(keys)], ['List items', String(items)], ['Depth', String(depth)], ['Input', b(input)], ['Output', b(out)]];
}

window.DEV_TOOLS['yaml-json']._lib = { parseYaml: parseYaml, writeYaml: writeYaml, writeJson: writeJson, parseJson: parseJson, plainValue: plainValue, plainSafe: plainSafe };
})();
