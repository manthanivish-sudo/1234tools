(function(){
/* ===================== shared helpers ===================== */

/* Focus a tree item without the browser's own scroll (which brings the whole
   subtree into view and can slide the row under the sticky tool bar), then
   scroll just its own row into view below that bar. Page only. */
function jfShowItem(li) {
  li.focus({ preventScroll: true });
  const t = li.closest('.jf-tree');
  if (!t) return;
  const node = li.querySelector(':scope > .jf-node') || li;
  const bar = t.querySelector('.jf-tree-bar');
  const top = t.getBoundingClientRect().top + (bar ? bar.offsetHeight : 0), bottom = t.getBoundingClientRect().bottom;
  const r = node.getBoundingClientRect();
  if (r.top < top) t.scrollTop -= top - r.top;
  else if (r.bottom > bottom) t.scrollTop += r.bottom - bottom;
}

function bytes(s) {
  const n = new (typeof TextEncoder !== 'undefined' ? TextEncoder : Object)();
  const len = typeof TextEncoder !== 'undefined' ? n.encode(String(s)).length : String(s).length;
  if (len < 1024) return len + ' B';
  if (len < 1048576) return (len / 1024).toFixed(1) + ' KB';
  return (len / 1048576).toFixed(2) + ' MB';
}

/* Where is the first fault? The browser's own error message cannot be relied
   on for that: V8 has changed its wording between versions, some messages
   carry no position at all ("Unexpected end of JSON input"), and others quote
   the whole input instead. So the text is scanned here by a small RFC 8259
   checker that stops at the first character the grammar cannot accept, the
   same place JSON.parse gives up, and says why. One exception: a trailing
   comma is reported at the comma, not at the } or ] after it where the
   parser stops, because the comma is what has to go. It runs only after JSON.parse
   has refused the text, so the verdict stays the browser's. It keeps its own
   stack rather than recursing, so deep nesting cannot overflow it. */
function findJsonError(text) {
  const n = text.length;
  let i = 0;
  const stack = [];
  const isWs = (c) => c === 32 || c === 9 || c === 10 || c === 13;
  const isDigit = (ch) => ch >= '0' && ch <= '9';
  const skip = () => { while (i < n && isWs(text.charCodeAt(i))) i++; };
  const fail = (msg, at) => ({ pos: at === undefined ? i : at, msg });
  const show = (at) => {
    const cp = text.codePointAt(at);
    if (cp === 0xfeff) return 'a byte-order mark (U+FEFF)';
    if (cp < 32 || cp === 127 || (cp >= 0x80 && cp < 0xa0)) return 'the control character U+' + cp.toString(16).toUpperCase().padStart(4, '0');
    if (cp === 0xa0 || cp === 0x2028 || cp === 0x2029 || cp === 0x3000 || (cp >= 0x2000 && cp <= 0x200b)) return 'a non-ASCII space (U+' + cp.toString(16).toUpperCase().padStart(4, '0') + ', not whitespace to JSON)';
    return '"' + String.fromCodePoint(cp) + '"';
  };
  /* the input ran out: point just past the last character that is not
     whitespace, so the line shown is the one that stops short */
  const ended = (what) => { let e = n; while (e > 0 && isWs(text.charCodeAt(e - 1))) e--; return fail('The input ends ' + what + '.', e); };
  const closeWhat = () => stack.length ? (stack[stack.length - 1] === '{' ? 'before the object is closed with }' : 'before the array is closed with ]') : 'where a value was expected';
  const string = () => {
    const start = i; i++;
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 34) { i++; return null; }
      if (c === 92) {
        const e = text[i + 1];
        if (e === undefined) break;
        if ('"\\/bfnrt'.indexOf(e) >= 0) { i += 2; continue; }
        if (e === 'u') {
          let k = 0; while (k < 4 && /[0-9a-fA-F]/.test(text[i + 2 + k] || '')) k++;
          if (k === 4) { i += 6; continue; }
          if (i + 2 + k >= n) break;
          return fail('Bad escape: \\u must be followed by four hex digits.');
        }
        return fail('Bad escape \\' + (e.charCodeAt(0) < 32 ? '' : e) + ' in a string: JSON allows only \\" \\\\ \\/ \\b \\f \\n \\r \\t and \\u followed by four hex digits.');
      }
      if (c < 32) return fail('A string contains ' + show(i) + ' (a raw line break or tab, often a missing closing "); write it as \\n or \\t.');
      i++;
    }
    return ended('inside a string that was never closed (it opens at line ' + lineCol(text, start).line + ', column ' + lineCol(text, start).col + ')');
  };
  const number = () => {
    if (text[i] === '-') i++;
    if (i >= n) return ended('after a minus sign');
    if (text[i] === '0') {
      i++;
      if (isDigit(text[i] || '')) return fail('A number cannot start with 0 unless it is 0 itself.');
    } else if (isDigit(text[i])) {
      while (isDigit(text[i] || '')) i++;
    } else return fail('Expected a digit after the minus sign, found ' + show(i) + '.');
    if (text[i] === '.') {
      i++;
      if (i >= n) return ended('after a decimal point');
      if (!isDigit(text[i])) return fail('Expected a digit after the decimal point, found ' + show(i) + '.');
      while (isDigit(text[i] || '')) i++;
    }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      if (i >= n) return ended('inside an exponent');
      if (!isDigit(text[i])) return fail('Expected a digit in the exponent, found ' + show(i) + '.');
      while (isDigit(text[i] || '')) i++;
    }
    return null;
  };
  const badValue = () => {
    const ch = text[i];
    if (ch === "'") return fail('Single quotes are not allowed: JSON strings use double quotes.');
    if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) return fail('Comments are not allowed in JSON.');
    if (ch === ',') return fail('Unexpected ",": a value is missing' + (stack.length ? ', or there is an extra comma' : '') + '.');
    if (ch === '}' || ch === ']') return fail('Unexpected "' + ch + '" where a value was expected.');
    const w = /^[A-Za-z_$][\w$]*/.exec(text.slice(i, i + 40));
    if (w) {
      const word = w[0];
      if (/^(NaN|Infinity|undefined)$/.test(word)) return fail(word + ' is not a JSON value; use null or a number.');
      if (/^(True|False|Null|TRUE|FALSE|NULL|None)$/.test(word)) return fail('Unexpected word ' + word + ': JSON literals are lowercase true, false and null.');
      return fail('Unexpected word ' + word + ': text values need double quotes.');
    }
    if (i === 0 && text.charCodeAt(0) === 0xfeff) return fail('The text starts with a byte-order mark (U+FEFF), which JSON.parse refuses; save the file as UTF-8 without a BOM.');
    return fail('Found ' + show(i) + ' where a value was expected.');
  };

  let state = 'value';
  for (;;) {
    if (state === 'value') {
      skip();
      if (i >= n) return ended(closeWhat());
      const ch = text[i];
      if (ch === '{' || ch === '[') {
        const close = ch === '{' ? '}' : ']';
        i++; skip();
        if (text[i] === close) { i++; state = 'after'; continue; }
        stack.push(ch);
        state = ch === '{' ? 'key' : 'value';
        continue;
      }
      if (ch === '"') { const e = string(); if (e) return e; state = 'after'; continue; }
      if (ch === '-' || isDigit(ch)) { const e = number(); if (e) return e; state = 'after'; continue; }
      const lit = ch === 't' ? 'true' : ch === 'f' ? 'false' : ch === 'n' ? 'null' : '';
      if (lit) {
        let k = 0; while (k < lit.length && text[i + k] === lit[k]) k++;
        if (k === lit.length && !/[\w$]/.test(text[i + k] || '')) { i += k; state = 'after'; continue; }
        if (i + k >= n) return ended('in the middle of ' + lit);
        if (k === lit.length || /^[A-Za-z_$]/.test(text[i + k])) return badValue();
        return fail('Expected ' + lit + ', found ' + show(i + k) + '.', i + k);
      }
      return badValue();
    }
    if (state === 'key') {
      skip();
      if (i >= n) return ended('where a property name was expected');
      const ch = text[i];
      if (ch === '"') {
        const e = string(); if (e) return e;
        skip();
        if (i >= n) return ended('after a property name, before its colon');
        if (text[i] !== ':') return fail('Expected ":" after the property name, found ' + show(i) + '.');
        i++; state = 'value'; continue;
      }
      if (ch === "'") return fail('Single quotes are not allowed: property names use double quotes.');
      if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) return fail('Comments are not allowed in JSON.');
      if (/[A-Za-z_$0-9]/.test(ch)) return fail('Property names need double quotes.');
      return fail('Expected a property name in double quotes, found ' + show(i) + '.');
    }
    /* state 'after': a value has just ended */
    skip();
    if (!stack.length) {
      if (i >= n) return null;
      if (text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) return fail('Comments are not allowed in JSON.');
      return fail('Found ' + show(i) + ' after the end of the JSON value: one document holds one value; wrap several in an array.');
    }
    if (i >= n) return ended(closeWhat());
    const top = stack[stack.length - 1], close = top === '{' ? '}' : ']', ch = text[i];
    if (ch === ',') {
      /* a trailing comma is reported at the comma itself, not at the bracket
         where the parser gives up: look past whitespace and any comments
         (which JSON refuses too, so they are named) to the next character */
      const comma = i;
      let j = i + 1, comment = false;
      for (;;) {
        while (j < n && isWs(text.charCodeAt(j))) j++;
        if (text[j] === '/' && text[j + 1] === '/') { comment = true; while (j < n && text[j] !== '\n' && text[j] !== '\r') j++; continue; }
        if (text[j] === '/' && text[j + 1] === '*') {
          const e = text.indexOf('*/', j + 2);
          if (e < 0) break;
          comment = true; j = e + 2; continue;
        }
        break;
      }
      if (text[j] === close) return fail('Trailing comma: remove this comma (before the ' + close + ').' + (comment ? ' The comment after it is not allowed in JSON either.' : ''), comma);
      i++;
      state = top === '{' ? 'key' : 'value';
      continue;
    }
    if (ch === close) { stack.pop(); i++; continue; }
    if (ch === '}' || ch === ']') return fail('Mismatched bracket: "' + ch + '" closes ' + (top === '{' ? 'an object opened with {' : 'an array opened with [') + '; expected "' + close + '".');
    if (top === '{' && ch === ':') return fail('Unexpected ":": a property value is followed by a colon.');
    if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) return fail('Comments are not allowed in JSON.');
    return fail('Expected "," or "' + close + '", found ' + show(i) + ': a comma is probably missing.');
  }
}

function lineCol(text, pos) {
  const before = text.slice(0, pos);
  const nl = before.lastIndexOf('\n');
  return { line: before.split('\n').length, col: pos - nl };
}

function describeJsonError(e, text) {
  let found = findJsonError(text);
  if (!found) {
    /* the checker found nothing: fall back to the parser's own position, if
       its message has one */
    const msg = String((e && e.message) || e);
    const m = msg.match(/position (\d+)/);
    if (!m) return 'Invalid JSON: ' + msg;
    found = { pos: Number(m[1]), msg: msg.replace(/ in JSON.*/, '') };
  }
  const { line, col } = lineCol(text, found.pos);
  /* the offending line, cut to about 60 characters around the column so the
     fault is visible even on one 4,000-character line */
  const raw = (text.split('\n')[line - 1] || '').replace(/\r$/, '').replace(/\t/g, ' ');
  let from = 0, to = raw.length;
  if (raw.length > 60) { from = Math.max(0, Math.min(col - 30, raw.length - 60)); to = from + 60; }
  let snippet = raw.slice(from, to);
  if (from === 0) snippet = snippet.replace(/^\s+/, ''); else snippet = '…' + snippet;
  snippet = snippet.replace(/\s+$/, '');
  if (to < raw.length) snippet += '…';
  return `Invalid JSON at line ${line}, column ${col}.\n${snippet ? '  ' + snippet + '\n' : ''}${found.msg}`;
}

/* Both walk with their own stack: the recursive versions overflowed on
   valid input nested a few thousand levels deep. */
function countNodes(v) {
  let n = 0;
  const todo = [v];
  while (todo.length) {
    const x = todo.pop();
    if (x && typeof x === 'object') {
      const kids = Array.isArray(x) ? x : Object.keys(x).map((k) => x[k]);
      n += kids.length;
      for (const c of kids) todo.push(c);
    }
  }
  return n;
}

function depthOf(v) {
  let max = 1;
  const todo = [[v, 1]];
  while (todo.length) {
    const [x, d] = todo.pop();
    if (d > max) max = d;
    if (x && typeof x === 'object') {
      const kids = Array.isArray(x) ? x : Object.keys(x).map((k) => x[k]);
      for (const c of kids) todo.push([c, d + 1]);
    }
  }
  return max;
}

function checkXmlBalance(xml) {
  const stack = [];
  let depth = 0, maxDepth = 0, elements = 0;
  const re = /<\/?([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>/g;
  let m;
  while ((m = re.exec(xml))) {
    const tag = m[0];
    if (!m[1]) continue;                       // declaration, comment, CDATA, doctype
    if (tag.startsWith('</')) {
      const open = stack.pop();
      if (open !== m[1]) {
        return { error: open === undefined
          ? `Closing tag </${m[1]}> has no matching opening tag.`
          : `Mismatched tags: <${open}> is closed by </${m[1]}>.` };
      }
      depth--;
    } else if (m[3] === '/') {
      elements++;
    } else {
      stack.push(m[1]); elements++; depth++;
      maxDepth = Math.max(maxDepth, depth);
    }
  }
  if (stack.length) return { error: `Unclosed tag: <${stack[stack.length - 1]}> is never closed.` };
  if (!elements) return { error: 'No XML elements found.' };
  return { elements, depth: maxDepth };
}

function minifyXml(xml) {
  return xml.replace(/>\s+</g, '><').replace(/^\s+|\s+$/g, '');
}

function formatXml(xml, pad) {
  const compact = minifyXml(xml);
  const tokens = compact.replace(/></g, '>\n<').split('\n');
  let depth = 0;
  return tokens.map(tok => {
    if (/^<\/[^>]+>$/.test(tok)) depth = Math.max(0, depth - 1);
    const line = pad.repeat(depth) + tok;
    const isOpen = /^<[^!?/][^>]*[^/]>$/.test(tok) || /^<[a-zA-Z][\w.:-]*>$/.test(tok);
    const selfClose = /\/>$/.test(tok) || /^<[?!]/.test(tok);
    const hasInline = /^<[^/][^>]*>.*<\/[^>]+>$/.test(tok);
    if (isOpen && !selfClose && !hasInline) depth++;
    return line;
  }).join('\n');
}

function parseCSV(text, delim) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function b64encode(str) {
  const bytes = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += T[b0 >> 2];
    out += T[((b0 & 3) << 4) | ((b1 || 0) >> 4)];
    out += b1 === undefined ? '=' : T[((b1 & 15) << 2) | ((b2 || 0) >> 6)];
    out += b2 === undefined ? '=' : T[b2 & 63];
  }
  return out;
}

function b64decode(b64) {
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = String(b64).replace(/[\r\n\s]/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error('bad base64');
  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map(k => {
      const ch = clean[i + k];
      return ch === undefined || ch === '=' ? -1 : T.indexOf(ch);
    });
    if (n[0] < 0 || n[1] < 0) break;
    bytes.push((n[0] << 2) | (n[1] >> 4));
    if (n[2] >= 0) bytes.push(((n[1] & 15) << 4) | (n[2] >> 2));
    if (n[3] >= 0) bytes.push(((n[2] & 3) << 6) | n[3]);
  }
  // UTF-8 decode
  let out = '', i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) { out += String.fromCharCode(b); i++; }
    else if (b < 0xe0) { out += String.fromCharCode(((b & 31) << 6) | (bytes[i + 1] & 63)); i += 2; }
    else if (b < 0xf0) { out += String.fromCharCode(((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3; }
    else {
      out += String.fromCodePoint(((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63));
      i += 4;
    }
  }
  return out;
}

function uuidV4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function humanDuration(sec) {
  if (sec < 60) return sec + ' s';
  if (sec < 3600) return Math.round(sec / 60) + ' min';
  if (sec < 86400) return Math.round(sec / 3600) + ' h';
  return Math.round(sec / 86400) + ' days';
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
  if (m) return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  const s = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(String(hex).trim());
  if (s) return { r: parseInt(s[1] + s[1], 16), g: parseInt(s[2] + s[2], 16), b: parseInt(s[3] + s[3], 16) };
  return null;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function rgbToHsb(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [Math.round(h), Math.round(mx === 0 ? 0 : (d / mx) * 100), Math.round(mx * 100)];
}

function relLum({ r, g, b }) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a, b) {
  const l1 = relLum(a), l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}



/* ===================== wave 3: the JSON formatter's own machinery =====================
   Everything below is pure and synchronous, so the same code runs in the page
   and in the Web Worker (big inputs). Nothing touches the DOM until mount()
   and render(), which run in the page only. */

/** line starts of a text, for many position → line/column look-ups */
function jfLineIndex(text) {
  const starts = [0];
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  const at = (pos) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
    return { line: lo + 1, col: pos - starts[lo] + 1 };
  };
  return { starts, at };
}

/* ---------- Repair: JSON5, comments, trailing commas and the like ----------
   A tolerant reader walks the text the way a JSON5 parser would and, instead
   of building a value, records the smallest edit that makes each fault valid
   JSON: a trailing comma removed, a comment removed, a single-quoted string
   or a bare key put in double quotes, +5 / .5 / 0x1F written as JSON numbers,
   NaN and Infinity written as null, True/False/None lower-cased, a missing
   comma added, a raw line break in a string escaped. The edits are applied
   to your own text, so the layout you wrote is kept, and the result must
   then pass JSON.parse or nothing is claimed. */
function jfRepair(text) {
  const n = text.length;
  const edits = [];
  let i = 0, depth = 0;
  const edit = (start, end, rep, why) => edits.push({ start, end, text: rep, why });
  const fail = (msg, at) => { const e = new Error(msg); e.pos = at === undefined ? i : at; e.isRepair = true; throw e; };
  const ODD_WS = /[\u00a0\u000b\u000c\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/;
  const hex4 = (c) => c.toString(16).toUpperCase().padStart(4, '0');
  const lastEnd = () => (edits.length ? edits[edits.length - 1].end : 0);
  function ws() {
    for (;;) {
      const c = text[i];
      if (c === undefined) return;
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
      if (ODD_WS.test(c)) {
        if (c === '\ufeff' && i === 0) edit(0, 1, '', 'removed a byte-order mark (U+FEFF) at the start');
        else edit(i, i + 1, ' ', 'replaced a non-JSON space (U+' + hex4(c.charCodeAt(0)) + ') with a plain space');
        i++; continue;
      }
      if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
        /* take the spaces before a comment with it, so no line is left with
           trailing blanks; never reach back over an edit already made */
        let s = i;
        while (s > lastEnd() && (text[s - 1] === ' ' || text[s - 1] === '\t')) s--;
        if (text[i + 1] === '/') {
          let j = i + 2; while (j < n && text[j] !== '\n' && text[j] !== '\r') j++;
          edit(s, j, '', 'removed a // comment'); i = j;
        } else {
          const e = text.indexOf('*/', i + 2);
          if (e < 0) fail('A /* comment is never closed.');
          edit(s, e + 2, '', 'removed a /* */ comment'); i = e + 2;
        }
        continue;
      }
      return;
    }
  }
  /* a string's body, from just after its opening quote, as JSON wants it;
     returns { body, end, why, at } where why names the first change */
  function strBody(q) {
    const start = i;
    i++;
    let out = '', why = null, at = -1;
    const note = (w, p) => { if (!why) { why = w; at = p; } };
    while (i < n) {
      const c = text[i];
      if (c === q) { i++; return { body: out, end: i, why, at, start }; }
      if (c === '"' && q === "'") { out += '\\"'; i++; continue; }
      if (c === '\\') {
        const e = text[i + 1];
        if (e === undefined) break;
        if ('"\\/bfnrt'.indexOf(e) >= 0) { out += '\\' + e; i += 2; continue; }
        if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(text.substr(i + 2, 4))) { out += text.substr(i, 6); i += 6; continue; }
        if (e === "'") { out += "'"; note("\\' is not a JSON escape: written as '", i); i += 2; continue; }
        if (e === 'x' && /^[0-9a-fA-F]{2}$/.test(text.substr(i + 2, 2))) { out += '\\u00' + text.substr(i + 2, 2).toUpperCase(); note('\\x' + text.substr(i + 2, 2) + ' written as \\u00' + text.substr(i + 2, 2).toUpperCase(), i); i += 4; continue; }
        if (e === 'v') { out += '\\u000B'; note('\\v written as \\u000B', i); i += 2; continue; }
        if (e === '0' && !/[0-9]/.test(text[i + 2] || '')) { out += '\\u0000'; note('\\0 written as \\u0000', i); i += 2; continue; }
        if (e === '\n' || e === '\u2028' || e === '\u2029') { note('removed a line continuation (a backslash at the end of a line)', i); i += 2; continue; }
        if (e === '\r') { note('removed a line continuation (a backslash at the end of a line)', i); i += text[i + 2] === '\n' ? 3 : 2; continue; }
        out += '\\\\'; note('a lone backslash before ' + (e < ' ' ? 'a control character' : e) + ': written as \\\\', i); i++; continue;
      }
      const code = c.charCodeAt(0);
      if (code < 32) {
        const esc = c === '\n' ? '\\n' : c === '\t' ? '\\t' : c === '\r' ? '\\r' : '\\u' + hex4(code);
        out += esc; note('a raw ' + (c === '\n' || c === '\r' ? 'line break' : c === '\t' ? 'tab' : 'control character') + ' inside a string: written as ' + esc, i); i++; continue;
      }
      out += c; i++;
    }
    fail('A string that opens here is never closed.', start);
  }
  function string() {
    const q = text[i];
    const r = strBody(q);
    if (q === "'") edit(r.start, r.end, '"' + r.body + '"', 'single-quoted string: written with double quotes');
    else if (r.why) edit(r.start, r.end, '"' + r.body + '"', r.why);
  }
  function number() {
    const m = /^[+-]?(?:0[xX][0-9a-fA-F]+|Infinity|NaN|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/.exec(text.slice(i, i + 400));
    if (!m) fail('Expected a number after the sign.');
    const raw = m[0];
    if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(raw)) { i += raw.length; return; }
    const neg = raw[0] === '-';
    const body = raw.replace(/^[+-]/, '');
    let rep;
    if (body === 'Infinity' || body === 'NaN') { edit(i, i + raw.length, 'null', raw + ' is not a JSON number: written as null'); i += raw.length; return; }
    if (/^0[xX]/.test(body)) rep = (neg ? '-' : '') + parseInt(body.slice(2), 16).toString();
    else {
      let s = body.replace(/^0+(?=\d)/, '');
      if (s[0] === '.') s = '0' + s;
      s = s.replace(/\.(?=[eE]|$)/, '');
      rep = (neg && !/^0(\.0*)?$/.test(s) ? '-' : '') + s;
    }
    edit(i, i + raw.length, rep, 'the number ' + raw + ' written as ' + rep);
    i += raw.length;
  }
  const WORDS = { true: 'true', false: 'false', null: 'null', True: 'true', False: 'false', None: 'null', TRUE: 'true', FALSE: 'false', NULL: 'null', Null: 'null', undefined: 'null', NaN: 'null', Infinity: 'null' };
  function value() {
    ws();
    if (i >= n) fail('The input ends where a value was expected.');
    const c = text[i];
    if (c === '{') return object();
    if (c === '[') return array();
    if (c === '"' || c === "'") return string();
    if (c === '-' || c === '+' || c === '.' || (c >= '0' && c <= '9')) return number();
    const w = /^[A-Za-z_$][\w$]*/.exec(text.slice(i, i + 64));
    if (w && Object.prototype.hasOwnProperty.call(WORDS, w[0])) {
      const word = w[0], to = WORDS[word];
      if (to !== word) edit(i, i + word.length, to, word + ' is not a JSON value: written as ' + to);
      i += word.length; return;
    }
    if (w) fail('Unexpected word ' + w[0] + ': text values need quotes.');
    fail('Found "' + c + '" where a value was expected.');
  }
  function key() {
    const c = text[i];
    if (c === '"' || c === "'") return string();
    const m = /^(?:[A-Za-z_$\u00aa-\uffff][\w$\u00aa-\uffff-]*|\d+(?:\.\d+)?)/.exec(text.slice(i, i + 200));
    if (m && !ODD_WS.test(m[0])) { edit(i, i + m[0].length, JSON.stringify(m[0]), 'the bare name ' + m[0] + ': put in double quotes'); i += m[0].length; return; }
    fail('Expected a property name, found "' + c + '".');
  }
  /* after a member: a comma (extra ones and a trailing one removed), the
     closing bracket, or a missing comma when the next thing starts a member */
  function after(close, startsNext) {
    const end = i;
    ws();
    if (text[i] === ',') {
      const comma = i; i++; ws();
      while (text[i] === ',') { edit(i, i + 1, '', 'removed an extra comma'); i++; ws(); }
      if (text[i] === close) { edit(comma, comma + 1, '', 'removed a trailing comma (before the ' + close + ')'); i++; return true; }
      if (i >= n) { edit(comma, comma + 1, '', 'removed a trailing comma at the end'); edit(n, n, close, 'added the missing ' + close + ' at the end (the text stops short)'); return true; }
      return false;
    }
    if (text[i] === close) { i++; return true; }
    if (i >= n) { edit(n, n, close, 'added the missing ' + close + ' at the end (the text stops short)'); return true; }
    if (startsNext.test(text[i])) { edit(end, end, ',', 'added a missing comma'); return false; }
    if ((text[i] === '}' || text[i] === ']')) fail('Mismatched bracket: "' + text[i] + '" where "' + close + '" was expected.');
    fail('Expected "," or "' + close + '", found "' + text[i] + '".');
  }
  function object() {
    i++; if (++depth > 2000) fail('Nested too deeply to repair.');
    ws();
    if (text[i] === '}') { i++; depth--; return; }
    if (i >= n) { edit(n, n, '}', 'added the missing } at the end (the text stops short)'); depth--; return; }
    for (;;) {
      ws();
      if (text[i] === '}' ) { i++; depth--; return; }
      if (i >= n) { edit(n, n, '}', 'added the missing } at the end (the text stops short)'); depth--; return; }
      key();
      ws();
      if (text[i] !== ':') fail('Expected ":" after the property name.');
      i++;
      value();
      if (after('}', /["'A-Za-z_$\u00aa-\uffff\d]/)) { depth--; return; }
    }
  }
  function array() {
    i++; if (++depth > 2000) fail('Nested too deeply to repair.');
    ws();
    if (text[i] === ']') { i++; depth--; return; }
    if (i >= n) { edit(n, n, ']', 'added the missing ] at the end (the text stops short)'); depth--; return; }
    for (;;) {
      value();
      if (after(']', /["'{[\-\dA-Za-z_$]/)) { depth--; return; }
    }
  }

  ws();
  const first = i;
  value();
  let ends = [i];
  ws();
  /* several values one after another (JSON Lines, or logs): wrapped in an array */
  while (i < n && /["'{[\-+.\dA-Za-z_$]/.test(text[i])) { value(); ends.push(i); ws(); }
  if (i < n) fail('Found "' + text[i] + '" after the end of the JSON value.');
  if (ends.length > 1) {
    edit(first, first, '[', 'several top-level values (' + ends.length + '): wrapped in an array');
    ends.slice(0, -1).forEach((p) => edit(p, p, ',', 'added a comma between top-level values'));
    edit(ends[ends.length - 1], ends[ends.length - 1], ']', 'closed the array around the top-level values');
  }

  edits.sort((a, b) => a.start - b.start || (a.end - a.start) - (b.end - b.start));
  let fixed = '', cur = 0;
  for (const e of edits) { fixed += text.slice(cur, e.start) + e.text; cur = Math.max(cur, e.end); }
  fixed += text.slice(cur);
  return { edits, fixed };
}

/** The changed lines, before and after, from a repair's edits. */
function jfRepairDiff(text, edits, idx) {
  const L = idx || jfLineIndex(text);
  const lineEnd = (ln) => (ln < L.starts.length ? L.starts[ln] - 1 : text.length);   // the \n ending line ln (1-based), or the end
  const ranges = [];
  edits.forEach((e) => {
    const a = L.at(e.start).line, b = L.at(Math.max(e.start, e.end - 1)).line;
    const last = ranges[ranges.length - 1];
    if (last && a <= last.to + 0) { last.to = Math.max(last.to, b); last.edits.push(e); }
    else ranges.push({ from: a, to: b, edits: [e] });
  });
  return ranges.map((r) => {
    const s = L.starts[r.from - 1], t = lineEnd(r.to);
    let after = '', cur = s;
    r.edits.forEach((e) => { after += text.slice(cur, e.start) + e.text; cur = Math.max(cur, e.end); });
    after += text.slice(cur, t);
    return { from: r.from, to: r.to, before: text.slice(s, t).replace(/\r/g, '').split('\n'), after: after.replace(/\r/g, '').split('\n') };
  });
}

/* ---------- JSONPath (RFC 9535) ----------
   An own parser and evaluator for the query language of RFC 9535: $, .name,
   ['name'], [0], [-1], [start:end:step], [*], .., unions [a,b], and filters
   [?@.price < 10 && @.isbn] with ==, !=, <, <=, >, >=, !, &&, || and the
   functions length(), count(), match(), search() and value(). The older
   ?(...) form is accepted too: its brackets are just grouping. */
function jfPathError(msg, at) { const e = new Error(msg); e.at = at; e.isPath = true; return e; }

function jfParsePath(src) {
  let s = String(src).trim();
  let p = 0;
  if (s[0] !== '$') s = (s[0] === '.' || s[0] === '[') ? '$' + s : '$.' + s;
  const err = (m) => { throw jfPathError(m + ' (at character ' + (p + 1) + ' of ' + s + ')', p); };
  const blank = () => { while (p < s.length && /[ \t\n\r]/.test(s[p])) p++; };
  const NAME1 = /[A-Za-z_\u0080-\uffff]/, NAMEC = /[A-Za-z0-9_\u0080-\uffff]/;
  function name() {
    const a = p;
    if (!NAME1.test(s[p] || '')) err('Expected a name');
    while (p < s.length && NAMEC.test(s[p])) p++;
    return s.slice(a, p);
  }
  function strLit() {
    const q = s[p]; const a = p; p++;
    let out = '';
    while (p < s.length && s[p] !== q) {
      if (s[p] === '\\') {
        const e = s[p + 1];
        const map = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', '/': '/', '\\': '\\', "'": "'", '"': '"' };
        if (map[e] !== undefined) { out += map[e]; p += 2; continue; }
        if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(s.substr(p + 2, 4))) { out += String.fromCharCode(parseInt(s.substr(p + 2, 4), 16)); p += 6; continue; }
        err('Bad escape in a string');
      }
      out += s[p]; p++;
    }
    if (p >= s.length) { p = a; err('A string is never closed'); }
    p++;
    return out;
  }
  function int() {
    const m = /^-?(0|[1-9]\d*)/.exec(s.slice(p));
    if (!m) return null;
    p += m[0].length;
    return Number(m[0]);
  }
  function selector() {
    blank();
    const c = s[p];
    if (c === "'" || c === '"') return { t: 'name', name: strLit() };
    if (c === '*') { p++; return { t: 'wild' }; }
    if (c === '?') { p++; blank(); return { t: 'filter', expr: orExpr() }; }
    const a = int();
    blank();
    if (s[p] === ':') {
      p++; blank();
      const b = int(); blank();
      let st = null;
      if (s[p] === ':') { p++; blank(); st = int(); }
      return { t: 'slice', start: a, end: b, step: st };
    }
    if (a === null) err('Expected a name in quotes, an index, a slice, * or a ?filter');
    return { t: 'index', i: a };
  }
  function bracket() {
    p++;
    const sels = [];
    for (;;) {
      sels.push(selector());
      blank();
      if (s[p] === ',') { p++; continue; }
      if (s[p] === ']') { p++; return sels; }
      err('Expected , or ]');
    }
  }
  /* segments after $ or @; stops at anything that cannot start one */
  function segments(inFilter) {
    const segs = [];
    for (;;) {
      const save = p;
      if (inFilter) blank(); else blank();
      if (s.startsWith('..', p)) {
        p += 2;
        if (s[p] === '[') segs.push({ desc: true, sels: bracket() });
        else if (s[p] === '*') { p++; segs.push({ desc: true, sels: [{ t: 'wild' }] }); }
        else segs.push({ desc: true, sels: [{ t: 'name', name: name() }] });
      } else if (s[p] === '.') {
        p++;
        if (s[p] === '*') { p++; segs.push({ desc: false, sels: [{ t: 'wild' }] }); }
        else segs.push({ desc: false, sels: [{ t: 'name', name: name() }] });
      } else if (s[p] === '[') {
        segs.push({ desc: false, sels: bracket() });
      } else { p = save; return segs; }
    }
  }
  function query() {
    const root = s[p] === '$';
    p++;
    return { t: 'query', root, segs: segments(true) };
  }
  const singular = (q) => q.segs.every((g) => !g.desc && g.sels.length === 1 && (g.sels[0].t === 'name' || g.sels[0].t === 'index'));
  const FUNCS = { length: 1, count: 1, match: 2, search: 2, value: 1 };
  function func() {
    const a = p;
    const m = /^[a-z][a-z_0-9]*/.exec(s.slice(p));
    const f = m[0];
    if (!FUNCS[f]) err('Unknown function ' + f + '()');
    p += f.length;
    blank();
    if (s[p] !== '(') err('Expected ( after ' + f);
    p++;
    const args = [];
    blank();
    if (s[p] !== ')') {
      for (;;) {
        blank();
        args.push(comparable(true));
        blank();
        if (s[p] === ',') { p++; continue; }
        if (s[p] === ')') break;
        err('Expected , or ) in ' + f + '()');
      }
    }
    p++;
    if (args.length !== FUNCS[f]) { p = a; err(f + '() takes ' + FUNCS[f] + ' argument' + (FUNCS[f] > 1 ? 's' : '')); }
    return { t: 'func', f, args };
  }
  function comparable(inArgs) {
    blank();
    const c = s[p];
    if (c === "'" || c === '"') return { t: 'lit', v: strLit() };
    const num = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(p));
    if (num && (c === '-' || /\d/.test(c))) { p += num[0].length; return { t: 'lit', v: Number(num[0]) }; }
    for (const w of ['true', 'false', 'null']) if (s.startsWith(w, p) && !NAMEC.test(s[p + w.length] || '')) { p += w.length; return { t: 'lit', v: w === 'null' ? null : w === 'true' }; }
    if (c === '@' || c === '$') return query();
    if (/[a-z]/.test(c || '')) return func();
    if (inArgs && (c === '!' || c === '(')) return orExpr();
    err('Expected a value, @, $ or a function');
  }
  function basic() {
    blank();
    if (s[p] === '!') { p++; blank(); return { t: 'not', e: basic() }; }
    if (s[p] === '(') { p++; const e = orExpr(); blank(); if (s[p] !== ')') err('Expected )'); p++; return e; }
    const left = comparable();
    blank();
    const op = /^(==|!=|<=|>=|<|>)/.exec(s.slice(p));
    if (op) {
      p += op[0].length;
      const right = comparable();
      [left, right].forEach((x) => { if (x.t === 'query' && !singular(x)) err('A query compared with ' + op[0] + ' must pick at most one value (names and indexes only)'); });
      return { t: 'cmp', op: op[0], l: left, r: right };
    }
    if (left.t === 'query') return { t: 'exists', q: left };
    if (left.t === 'func' && (left.f === 'match' || left.f === 'search')) return left;
    err('Expected a comparison such as == or <');
  }
  function andExpr() {
    let e = basic();
    for (;;) { blank(); if (s.startsWith('&&', p)) { p += 2; e = { t: 'and', a: e, b: basic() }; } else return e; }
  }
  function orExpr() {
    let e = andExpr();
    for (;;) { blank(); if (s.startsWith('||', p)) { p += 2; e = { t: 'or', a: e, b: andExpr() }; } else return e; }
  }

  if (s[0] !== '$') err('A JSONPath starts with $');
  p = 1;
  const segs = segments(false);
  blank();
  if (p < s.length) err('Unexpected "' + s[p] + '"');
  return { t: 'query', root: true, segs, text: s };
}

function jfPathName(k) {
  return "['" + String(k).replace(/[\\'\u0000-\u001f]/g, (c) => {
    const m = { '\\': '\\\\', "'": "\\'", '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
    return m[c] || '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
  }) + "']";
}

function jfRunPath(q, root, current) {
  const own = Object.prototype.hasOwnProperty;
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const children = (node) => {
    const v = node.v;
    if (Array.isArray(v)) return v.map((x, k) => ({ v: x, p: node.p + '[' + k + ']' }));
    if (isObj(v)) return Object.keys(v).map((k) => ({ v: v[k], p: node.p + jfPathName(k) }));
    return [];
  };
  const deepEq = (a, b) => {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) return a.length === b.length && a.every((x, k) => deepEq(x, b[k]));
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => own.call(b, k) && deepEq(a[k], b[k]));
  };
  const NOTHING = { nothing: true };
  const reCache = new Map();
  const iregexp = (pat, whole) => {
    const key = (whole ? '^' : '') + pat;
    if (!reCache.has(key)) {
      let re = null;
      try { re = new RegExp(whole ? '^(?:' + pat + ')$' : pat, 'u'); } catch (e) { re = null; }
      reCache.set(key, re);
    }
    return reCache.get(key);
  };
  function evalQuery(qq, at) {
    let nodes = [qq.root ? { v: root, p: '$' } : at];
    for (const seg of qq.segs) {
      const next = [];
      const apply = (node) => {
        for (const sel of seg.sels) {
          const v = node.v;
          if (sel.t === 'name') { if (isObj(v) && own.call(v, sel.name)) next.push({ v: v[sel.name], p: node.p + jfPathName(sel.name) }); }
          else if (sel.t === 'wild') children(node).forEach((c) => next.push(c));
          else if (sel.t === 'index') {
            if (Array.isArray(v)) { const k = sel.i < 0 ? v.length + sel.i : sel.i; if (k >= 0 && k < v.length) next.push({ v: v[k], p: node.p + '[' + k + ']' }); }
          } else if (sel.t === 'slice') {
            if (!Array.isArray(v)) continue;
            const len = v.length, step = sel.step === null ? 1 : sel.step;
            if (step === 0) continue;
            const norm = (x) => (x >= 0 ? x : len + x);
            if (step > 0) {
              const lo = Math.min(Math.max(norm(sel.start === null ? 0 : sel.start), 0), len);
              const hi = Math.min(Math.max(norm(sel.end === null ? len : sel.end), 0), len);
              for (let k = lo; k < hi; k += step) next.push({ v: v[k], p: node.p + '[' + k + ']' });
            } else {
              const hi = Math.min(Math.max(sel.start === null ? len - 1 : norm(sel.start), -1), len - 1);
              const lo = Math.min(Math.max(sel.end === null ? -1 : norm(sel.end), -1), len - 1);
              for (let k = hi; k > lo; k += step) next.push({ v: v[k], p: node.p + '[' + k + ']' });
            }
          } else if (sel.t === 'filter') {
            children(node).forEach((c) => { if (truth(sel.expr, c)) next.push(c); });
          }
        }
      };
      for (const node of nodes) {
        if (!seg.desc) { apply(node); continue; }
        /* the node, then every descendant, in document order, without recursion */
        const stack = [node];
        while (stack.length) {
          const x = stack.pop();
          apply(x);
          const kids = children(x);
          for (let k = kids.length - 1; k >= 0; k--) stack.push(kids[k]);
        }
      }
      nodes = next;
    }
    return nodes;
  }
  function val(e, at) {
    if (e.t === 'lit') return e.v;
    if (e.t === 'query') { const r = evalQuery(e, at); return r.length === 1 ? r[0].v : NOTHING; }
    if (e.t === 'func') return call(e, at);
    return NOTHING;
  }
  function nodelist(e, at) {
    if (e.t === 'query') return evalQuery(e, at);
    const v = val(e, at);
    return v === NOTHING ? [] : [{ v }];
  }
  function call(e, at) {
    const f = e.f;
    if (f === 'count') return nodelist(e.args[0], at).length;
    if (f === 'value') { const l = nodelist(e.args[0], at); return l.length === 1 ? l[0].v : NOTHING; }
    if (f === 'length') {
      const v = val(e.args[0], at);
      if (typeof v === 'string') return Array.from(v).length;
      if (Array.isArray(v)) return v.length;
      if (isObj(v)) return Object.keys(v).length;
      return NOTHING;
    }
    if (f === 'match' || f === 'search') {
      const a = val(e.args[0], at), b = val(e.args[1], at);
      if (typeof a !== 'string' || typeof b !== 'string') return false;
      const re = iregexp(b, f === 'match');
      return !!re && re.test(a);
    }
    return NOTHING;
  }
  function cmpEq(a, b) {
    if (a === NOTHING || b === NOTHING) return a === b;
    return deepEq(a, b);
  }
  function cmpLt(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a < b;
    if (typeof a === 'string' && typeof b === 'string') return a < b;
    return false;
  }
  function truth(e, at) {
    switch (e.t) {
      case 'or': return truth(e.a, at) || truth(e.b, at);
      case 'and': return truth(e.a, at) && truth(e.b, at);
      case 'not': return !truth(e.e, at);
      case 'exists': return evalQuery(e.q, at).length > 0;
      case 'func': return call(e, at) === true;
      case 'cmp': {
        const a = val(e.l, at), b = val(e.r, at);
        switch (e.op) {
          case '==': return cmpEq(a, b);
          case '!=': return !cmpEq(a, b);
          case '<': return cmpLt(a, b);
          case '>': return cmpLt(b, a);
          case '<=': return cmpLt(a, b) || cmpEq(a, b);
          case '>=': return cmpLt(b, a) || cmpEq(a, b);
        }
      }
    }
    return false;
  }
  return evalQuery(q, current || { v: root, p: '$' });
}

/** The values and normalised paths a JSONPath picks from a value. */
function jsonPathQuery(data, expr) {
  const q = jfParsePath(expr);
  const nodes = jfRunPath(q, data);
  return { values: nodes.map((x) => x.v), paths: nodes.map((x) => x.p) };
}

/* ---------- JSON → YAML (1.2, block style) ----------
   Strings stay plain only when a YAML reader could not take them for
   anything else (a number, true/no/on, null, a date, a key, a comment);
   otherwise they are double-quoted with JSON's own escapes, which YAML's
   double-quoted style shares. */
const JF_YAML_SPECIAL = /^(?:[-+]?(?:\.?\d[\d_]*(?:\.[\d_]*)?(?:[eE][-+]?\d+)?|0[xX][\da-fA-F_]+|0[oO]?[0-7_]+|0[bB][01_]+|\.(?:inf|Inf|INF)|\d[\d_]*(?::[0-5]?\d)+(?:\.\d*)?)|\.(?:nan|NaN|NAN)|y|Y|yes|Yes|YES|n|N|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF|null|Null|NULL|~|<<|=|\d{4}-\d\d?-\d\d?(?:[Tt ].*)?)$/;
function jfYamlScalar(s) {
  s = String(s);
  if (s === '' || JF_YAML_SPECIAL.test(s) || /^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(s) || /^[-?:](\s|$)/.test(s) ||
    /\s$/.test(s) || /:(\s|$)/.test(s) || /\s#/.test(s) || /[\u0000-\u001f\u007f\u0085\u2028\u2029\ufeff]/.test(s) || /[\ud800-\udfff]/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}
function jfYamlValue(v) {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  return jfYamlScalar(v);
}
function toYaml(value, step) {
  const pad = (d) => ' '.repeat(d * step);
  const lines = [];
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const empty = (v) => (Array.isArray(v) ? (v.length ? null : '[]') : isObj(v) ? (Object.keys(v).length ? null : '{}') : null);
  /* write v at depth d; `lead` is what starts the first line ("- " for an
     item, "" for a key's block); the first key of an object in a list sits
     on the dash's line */
  function block(v, d, lead) {
    if (Array.isArray(v)) {
      v.forEach((x, k) => {
        const pre = k === 0 && lead !== null ? lead : pad(d);
        const e = empty(x);
        if (e !== null || (x === null || typeof x !== 'object')) lines.push(pre + '- ' + (e !== null ? e : jfYamlValue(x)));
        else block(x, d + 1, pre + '- ' + (step > 2 ? ' '.repeat(step - 2) : ''));
      });
      return;
    }
    Object.keys(v).forEach((k, idx) => {
      const pre = idx === 0 && lead !== null ? lead : pad(d);
      const key = jfYamlScalar(k);
      const x = v[k];
      const e = empty(x);
      if (e !== null) lines.push(pre + key + ': ' + e);
      else if (x === null || typeof x !== 'object') lines.push(pre + key + ': ' + jfYamlValue(x));
      else if (Array.isArray(x)) { lines.push(pre + key + ':'); block(x, d + 1, null); }
      else { lines.push(pre + key + ':'); block(x, d + 1, null); }
    });
  }
  const e = empty(value);
  if (e !== null) return e;
  if (value === null || typeof value !== 'object') return jfYamlValue(value);
  block(value, 0, null);
  return lines.join('\n');
}

/* ---------- JSON → CSV: the union of every row's keys, nested keys dotted ---------- */
function jfFlatten(o, prefix, into) {
  for (const k of Object.keys(o)) {
    const v = o[k], key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) jfFlatten(v, key, into);
    else into.push([key, v]);
  }
  return into;
}
function toCsv(value) {
  const rows = Array.isArray(value) ? value : [value];
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const flat = rows.map((r) => (isObj(r) ? jfFlatten(r, '', []) : [['value', r]]));
  const cols = [...new Set(flat.flatMap((p) => p.map((x) => x[0])))];
  const cell = (v) => {
    if (v === undefined || v === null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]|^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.map(cell).join(',')];
  flat.forEach((p) => { const m = new Map(p); lines.push(cols.map((c) => cell(m.get(c))).join(',')); });
  return { text: lines.join('\n'), cols: cols.length, rows: rows.length };
}

/* ---------- JSON → XML ----------
   Each key becomes an element; an array repeats its key's element once per
   item (items at the top level, or in a nested array, are <item>); keys that
   start with @ become attributes and #text the element's text; a key that is
   not a legal XML name is made one (spaces and other characters become _,
   a leading digit gets a _ in front) and listed. */
function jfXmlName(k, renamed) {
  let s = String(k).replace(/[^A-Za-z0-9_.\-\u00b7\u00c0-\ufffd]/g, '_');
  if (!/^[A-Za-z_\u00c0-\ufffd]/.test(s)) s = '_' + s;
  if (/^xml/i.test(s)) s = '_' + s;
  if (s !== String(k)) renamed.add(String(k) + ' → ' + s);
  return s;
}
const jfXmlText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const jfXmlAttr = (s) => jfXmlText(s).replace(/"/g, '&quot;');
function toXml(value, padUnit) {
  const renamed = new Set();
  const out = ['<?xml version="1.0" encoding="UTF-8"?>'];
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const scalar = (v) => (v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  function el(name, v, d) {
    const ind = padUnit.repeat(d);
    if (Array.isArray(v)) {
      if (!v.length) { out.push(ind + '<' + name + '/>'); return; }
      v.forEach((x) => (Array.isArray(x) ? el(name, { item: x }, d) : el(name, x, d)));
      return;
    }
    if (!isObj(v)) {
      const t = scalar(v);
      out.push(ind + '<' + name + (t === '' ? '/>' : '>' + jfXmlText(t) + '</' + name + '>'));
      return;
    }
    let attrs = '', text = null;
    const kids = [];
    Object.keys(v).forEach((k) => {
      const x = v[k];
      if (k[0] === '@' && k.length > 1 && (x === null || typeof x !== 'object')) attrs += ' ' + jfXmlName(k.slice(1), renamed) + '="' + jfXmlAttr(scalar(x)) + '"';
      else if (k === '#text' && (x === null || typeof x !== 'object')) text = scalar(x);
      else kids.push(k);
    });
    if (!kids.length) {
      out.push(ind + '<' + name + attrs + (text === null || text === '' ? '/>' : '>' + jfXmlText(text) + '</' + name + '>'));
      return;
    }
    out.push(ind + '<' + name + attrs + '>' + (text ? jfXmlText(text) : ''));
    kids.forEach((k) => el(jfXmlName(k, renamed), v[k], d + 1));
    out.push(ind + '</' + name + '>');
  }
  if (Array.isArray(value)) el('root', { item: value }, 0);
  else if (isObj(value)) {
    const keys = Object.keys(value).filter((k) => k[0] !== '@' && k !== '#text');
    if (keys.length === 1 && !Array.isArray(value[keys[0]]) && Object.keys(value).length === 1) el(jfXmlName(keys[0], renamed), value[keys[0]], 0);
    else el('root', value, 0);
  } else el('root', value, 0);
  return { text: out.join('\n'), renamed: [...renamed] };
}

/* ---------- the page's own views: Text | Tree, what Repair changed, matched paths ----------
   Built by mount() and filled by render(); never run in the Worker. */
let jfUi = null;
const JF_PAGE = 500;          // children shown at a time under one node
const JF_EXPAND_MAX = 3000;   // Expand all stops after this many rows

function jfChildPath(path, k, isIndex) {
  if (isIndex) return path + '[' + k + ']';
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? path + '.' + k : path + jfPathName(k);
}

function jfMount(ctx) {
  const el = ctx.el;
  const q = ctx.optBar.querySelector('#f-query');
  if (q) { q.placeholder = '$.items[*].sku'; q.spellcheck = false; q.autocomplete = 'off'; q.classList.add('jf-query'); }

  /* Text | Tree */
  const sw = el('div', 'jf-view');
  sw.setAttribute('role', 'group');
  sw.setAttribute('aria-label', 'Show the output as');
  const bText = el('button', 'btn-ghost jf-view-btn', 'Text');
  const bTree = el('button', 'btn-ghost jf-view-btn', 'Tree');
  [bText, bTree].forEach((b) => { b.type = 'button'; sw.appendChild(b); });
  ctx.outputTools.insertBefore(sw, ctx.outputTools.firstChild);

  const tree = el('div', 'jf-tree');
  tree.hidden = true;
  ctx.outputPane.insertBefore(tree, ctx.output.nextSibling);

  const hint = el('div', 'jf-hint');
  hint.hidden = true;
  const diff = el('section', 'jf-diff');
  diff.hidden = true;
  diff.setAttribute('aria-label', 'What Repair changed');
  const paths = el('details', 'jf-paths');
  paths.hidden = true;
  ctx.extra.appendChild(hint);
  ctx.extra.appendChild(diff);
  ctx.extra.appendChild(paths);

  let view = ctx.store.get('jfView') === 'tree' ? 'tree' : 'text';
  let lastRes = null, built = null;
  const setView = (v, save) => {
    view = v;
    bText.setAttribute('aria-pressed', String(v === 'text'));
    bTree.setAttribute('aria-pressed', String(v === 'tree'));
    ctx.output.hidden = v === 'tree';
    tree.hidden = v !== 'tree';
    if (save) ctx.store.set('jfView', v === 'tree' ? 'tree' : null);
    if (v === 'tree' && lastRes && built !== lastRes) paintTree(lastRes);
  };
  bText.addEventListener('click', () => setView('text', true));
  bTree.addEventListener('click', () => { setView('tree', true); const f = tree.querySelector('[role=treeitem][tabindex="0"]'); if (f) jfShowItem(f); });

  /* the value the tree shows: the output when it is JSON, else what the
     output was made from (the input, repaired and queried as the options say) */
  function treeData(res) {
    if (res.error) return { err: 'The tree shows valid JSON. Fix the error above' + (res.repairable ? ', or turn on Repair' : '') + '.' };
    if (!ctx.text.trim()) return { err: 'Paste some JSON to see it as a tree.' };
    try {
      if (res.lang === 'json' && res.output) return { data: JSON.parse(res.output) };
      let src = ctx.text, data;
      try { data = JSON.parse(src); } catch (e) { data = JSON.parse(res.fixed || jfRepair(src).fixed); }
      const qq = (ctx.opts().query || '').trim();
      return { data: qq ? jsonPathQuery(data, qq).values : data };
    } catch (e) { return { err: 'This cannot be shown as a tree.' }; }
  }

  function paintTree(res) {
    built = res;
    const open = new Set();
    tree.querySelectorAll('li[aria-expanded="true"]').forEach((li) => open.add(li.dataset.path));
    const firstTime = !tree.firstChild;
    tree.textContent = '';
    const t = treeData(res);
    if (t.err) { tree.appendChild(el('p', 'jf-tree-msg', t.err)); return; }
    const bar = el('div', 'jf-tree-bar');
    const exp = el('button', 'btn-ghost', 'Expand all'); exp.type = 'button';
    const col = el('button', 'btn-ghost', 'Collapse all'); col.type = 'button';
    const where = el('code', 'jf-tree-path', '$');
    where.setAttribute('aria-live', 'polite');
    const use = el('button', 'btn-ghost', 'Query this path'); use.type = 'button';
    bar.appendChild(exp); bar.appendChild(col); bar.appendChild(where); bar.appendChild(use);
    const note = el('p', 'jf-tree-msg');
    note.hidden = true;
    const ul = el('ul', 'jf-tree-root');
    ul.setAttribute('role', 'tree');
    ul.setAttribute('aria-label', 'JSON tree');
    tree.appendChild(bar);
    tree.appendChild(note);
    tree.appendChild(ul);
    let rows = 0;

    const kind = (v) => (Array.isArray(v) ? 'arr' : v !== null && typeof v === 'object' ? 'obj' : 'leaf');
    function row(key, v, path, level, isIndex) {
      rows++;
      const li = el('li', 'jf-item');
      li.setAttribute('role', 'treeitem');
      li.setAttribute('aria-level', String(level));
      li.tabIndex = -1;
      li.dataset.path = path;
      const line = el('div', 'jf-node');
      const tw = el('span', 'jf-twisty');
      tw.setAttribute('aria-hidden', 'true');
      line.appendChild(tw);
      if (key !== null) {
        line.appendChild(el('span', isIndex ? 'jf-idx' : 'hl-key', isIndex ? String(key) : JSON.stringify(key)));
        line.appendChild(el('span', 'hl-punc', ': '));
      }
      const k = kind(v);
      if (k === 'leaf') {
        const cls = typeof v === 'string' ? 'hl-str' : typeof v === 'number' ? 'hl-num' : 'hl-kw';
        line.appendChild(el('span', cls + ' jf-val', JSON.stringify(v)));
      } else {
        const n = k === 'arr' ? v.length : Object.keys(v).length;
        line.appendChild(el('span', 'jf-sum', k === 'arr' ? '[' + n.toLocaleString('en-GB') + (n === 1 ? ' item]' : ' items]') : '{' + n.toLocaleString('en-GB') + (n === 1 ? ' key}' : ' keys}')));
        li.setAttribute('aria-expanded', 'false');
        li._v = v;
        li._level = level;
      }
      li.appendChild(line);
      return li;
    }
    function addKids(group, li, from) {
      const v = li._v, path = li.dataset.path, level = li._level + 1;
      const arr = Array.isArray(v), keys = arr ? null : Object.keys(v), len = arr ? v.length : keys.length;
      const to = Math.min(len, from + JF_PAGE);
      for (let i = from; i < to; i++) {
        const k = arr ? i : keys[i];
        const c = row(k, v[k], jfChildPath(path, k, arr), level, arr);
        group.appendChild(c);
        if (c._v && open.has(c.dataset.path)) toggle(c, true);
      }
      if (to < len) {
        const more = el('li', 'jf-item jf-more');
        more.setAttribute('role', 'treeitem');
        more.setAttribute('aria-level', String(level));
        more.tabIndex = -1;
        more.appendChild(el('span', 'jf-more-txt', 'Show ' + Math.min(JF_PAGE, len - to).toLocaleString('en-GB') + ' more (' + (len - to).toLocaleString('en-GB') + ' not shown)'));
        more._more = () => { const f = more.nextSibling; more.remove(); addKids(group, li, to); return f; };
        group.appendChild(more);
      }
    }
    function toggle(li, on) {
      if (!li._v) return;
      if (on && !li._group) {
        const g = el('ul', 'jf-group');
        g.setAttribute('role', 'group');
        li._group = g;
        li.appendChild(g);
        addKids(g, li, 0);
      }
      li.setAttribute('aria-expanded', String(on));
      if (li._group) li._group.hidden = !on;
    }
    const top = row(null, t.data, '$', 1, false);
    ul.appendChild(top);
    top.tabIndex = 0;
    if (top._v) {
      toggle(top, true);
      if (firstTime || !open.size) {
        /* first look: open the first two levels while it stays small */
        top._group && [...top._group.children].forEach((c) => { if (c._v && rows < 200) toggle(c, true); });
      }
    }

    const visible = () => [...ul.querySelectorAll('li[role=treeitem]')].filter((x) => !x.parentElement.closest('ul[hidden]'));
    const focusItem = (li) => {
      if (!li) return;
      ul.querySelectorAll('li[tabindex="0"]').forEach((x) => { x.tabIndex = -1; });
      li.tabIndex = 0;
      jfShowItem(li);
      if (li.dataset.path) where.textContent = li.dataset.path;
    };
    ul.addEventListener('click', (e) => {
      const li = e.target.closest('li[role=treeitem]');
      if (!li) return;
      if (li._more) { focusItem(li._more() || li.parentElement.lastChild); return; }
      if (e.target.closest('.jf-twisty') || e.target.closest('.jf-sum')) toggle(li, li.getAttribute('aria-expanded') !== 'true');
      focusItem(li);
    });
    ul.addEventListener('keydown', (e) => {
      const li = document.activeElement && document.activeElement.closest && document.activeElement.closest('li[role=treeitem]');
      if (!li) return;
      const list = visible(), i = list.indexOf(li);
      const exp = li.getAttribute('aria-expanded');
      let go = null;
      if (e.key === 'ArrowDown') go = list[i + 1];
      else if (e.key === 'ArrowUp') go = list[i - 1];
      else if (e.key === 'Home') go = list[0];
      else if (e.key === 'End') go = list[list.length - 1];
      else if (e.key === 'ArrowRight') { if (exp === 'false') toggle(li, true); else if (exp === 'true') go = li._group && li._group.firstChild; else { e.preventDefault(); return; } }
      else if (e.key === 'ArrowLeft') { if (exp === 'true') toggle(li, false); else go = li.parentElement.closest('li[role=treeitem]'); }
      else if (e.key === 'Enter' || e.key === ' ') {
        if (li._more) { e.preventDefault(); focusItem(li._more() || null); return; }
        if (exp !== null) toggle(li, exp !== 'true');
      } else return;
      e.preventDefault();
      if (go) focusItem(go);
    });
    exp.addEventListener('click', () => {
      const queue = [top];
      let capped = false;
      while (queue.length) {
        const li = queue.shift();
        if (!li._v) continue;
        if (rows > JF_EXPAND_MAX) { capped = true; break; }
        toggle(li, true);
        [...li._group.children].forEach((c) => queue.push(c));
      }
      note.hidden = !capped;
      note.textContent = capped ? 'Expanded the first ' + JF_EXPAND_MAX.toLocaleString('en-GB') + ' rows, so the page stays quick. Open deeper nodes one at a time, or narrow the tree with a JSONPath query.' : '';
    });
    col.addEventListener('click', () => {
      ul.querySelectorAll('li[aria-expanded="true"]').forEach((li) => { if (li !== top) toggle(li, false); });
      note.hidden = true;
      focusItem(top);
    });
    use.addEventListener('click', () => { ctx.setOption('query', where.textContent === '$' ? '' : where.textContent); ctx.run(); });
  }

  function paintExtras(res) {
    /* Repair can fix it: offer it */
    hint.textContent = '';
    hint.hidden = !(res.error && res.repairable);
    if (!hint.hidden) {
      hint.appendChild(el('span', null, 'Repair can make this valid JSON with ' + res.repairable + (res.repairable === 1 ? ' change' : ' changes') + ' to your text, shown before anything is replaced.'));
      const b = el('button', 'btn-ghost', 'Turn on Repair');
      b.type = 'button';
      b.addEventListener('click', () => { ctx.setOption('repair', 'yes'); ctx.run(); });
      hint.appendChild(b);
    }
    /* what Repair changed */
    diff.textContent = '';
    diff.hidden = !(res.diff && res.diff.length);
    if (!diff.hidden) {
      const h = el('h3', 'jf-diff-h', 'What Repair changed: ' + res.repairCount + (res.repairCount === 1 ? ' change' : ' changes') + ' on ' + res.diff.length + (res.diff.length === 1 ? ' line' : ' lines'));
      diff.appendChild(h);
      diff.appendChild(el('p', 'jf-diff-p', 'Each change is listed with the line before (−) and after (+). Your own text with these changes is valid JSON; the output above is that text, as the options ask.'));
      const acts = el('div', 'jf-diff-acts');
      if (res.fixed) {
        const c = el('button', 'btn-ghost', 'Copy the repaired text'); c.type = 'button';
        c.addEventListener('click', () => ctx.copyText(res.fixed, c));
        const r = el('button', 'btn-ghost', 'Put it in the input'); r.type = 'button';
        r.addEventListener('click', () => ctx.setText(res.fixed));
        acts.appendChild(c); acts.appendChild(r);
      }
      diff.appendChild(acts);
      const ol = el('ol', 'jf-diff-list');
      res.diff.forEach((d) => {
        const li = el('li', 'jf-hunk');
        li.appendChild(el('div', 'jf-hunk-h', d.from === d.to ? 'Line ' + d.from : 'Lines ' + d.from + '–' + d.to));
        const pre = el('pre', 'jf-hunk-body');
        d.before.forEach((l) => pre.appendChild(el('span', 'jf-del', '− ' + l + '\n')));
        d.after.forEach((l) => pre.appendChild(el('span', 'jf-ins', '+ ' + l + '\n')));
        li.appendChild(pre);
        const why = el('ul', 'jf-why');
        (res.repairs || []).filter((x) => x.line >= d.from && x.line <= d.to).forEach((x) => why.appendChild(el('li', null, 'Column ' + x.col + ': ' + x.why)));
        li.appendChild(why);
        ol.appendChild(li);
      });
      diff.appendChild(ol);
      if (res.diffCut) diff.appendChild(el('p', 'jf-diff-p', 'The first ' + res.diff.length + ' changed lines are shown; the output includes every change.'));
    }
    /* the paths a JSONPath query matched */
    paths.textContent = '';
    paths.hidden = !(res.paths && !res.error);
    if (!paths.hidden) {
      const n = res.matchCount;
      paths.appendChild(el('summary', null, 'Matched paths (' + n.toLocaleString('en-GB') + ')'));
      if (!n) paths.appendChild(el('p', 'jf-diff-p', 'Nothing matched. Paths start at $, the whole document; names are case-sensitive.'));
      else {
        const c = el('button', 'btn-ghost', 'Copy the paths'); c.type = 'button';
        c.addEventListener('click', () => ctx.copyText(res.paths.join('\n'), c));
        paths.appendChild(c);
        const ol = el('ol', 'jf-path-list');
        res.paths.forEach((p) => ol.appendChild(el('li', null, p)));
        paths.appendChild(ol);
        if (res.paths.length < n) paths.appendChild(el('p', 'jf-diff-p', 'The first ' + res.paths.length.toLocaleString('en-GB') + ' paths are listed.'));
      }
    }
  }

  jfUi = {
    render(res) {
      lastRes = res;
      paintExtras(res);
      if (view === 'tree') paintTree(res);
    }
  };
  setView(view, false);
}

window.DEV_TOOLS = window.DEV_TOOLS || {};
window.DEV_TOOLS["json-formatter"] = {
"title": "JSON Formatter & Validator",
"category": "developer",
"icon": "{ }",
"kind": "code",
"files": {"accept": ".json,.json5,.jsonc,.jsonl,.ndjson,application/json,.txt,text/plain", "label": "Open file"},
"download": {"ext": "json", "type": "application/json", "suffix": "-formatted"},
"highlight": "json",
"description": "Format, validate and minify JSON. Pinpoints the exact line and column of any syntax error.",
"keywords": ["json formatter","json validator","json beautifier","json minify","pretty print json","json tree viewer","jsonpath","json to yaml","json to xml","json5 to json"],
"inputLabel": "JSON",
"outputLabel": "Formatted output",
"placeholder": "{\"name\":\"MVR\",\"services\":[\"software\",\"integration\"],\"since\":2013}",
"sample": "{\"name\":\"MVR IT Services\",\"services\":[\"software\",\"integrations\",\"AI\"],\"since\":2013,\"uk\":true}",
"options": [
  {"key":"mode","label":"Output","type":"select","default":"pretty","options":[{"value":"pretty","label":"Formatted (indented)"},{"value":"minify","label":"Minified (one line)"},{"value":"sorted","label":"Formatted + keys sorted"},{"value":"yaml","label":"YAML"},{"value":"csv","label":"CSV (one row per item)"},{"value":"xml","label":"XML"}]},
  {"key":"indent","label":"Indent","type":"select","default":"2","options":[{"value":"2","label":"2 spaces"},{"value":"4","label":"4 spaces"},{"value":"tab","label":"Tab"}]},
  {"key":"repair","label":"Repair JSON5, comments and trailing commas","type":"check","default":"no"},
  {"key":"query","label":"JSONPath query","type":"text","default":""}
],
"transform": (text, { mode, indent, repair, query }) => {
      if (!text.trim()) return { output: '', note: 'Paste some JSON above.' };
      let data, fixed = null, edits = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        if (repair !== 'yes') {
          const res = { error: describeJsonError(e, text) };
          /* could Repair fix it? Said beside the error, never done unasked */
          if (text.length <= 5 * 1048576) {
            try { const r = jfRepair(text); JSON.parse(r.fixed); res.repairable = r.edits.length; } catch (x) { /* not repairable */ }
          }
          return res;
        }
        try {
          const r = jfRepair(text);
          data = JSON.parse(r.fixed);
          fixed = r.fixed; edits = r.edits;
        } catch (re) {
          if (re && re.isRepair) {
            const lc = lineCol(text, Math.min(re.pos, text.length));
            return { error: 'Repair stopped at line ' + lc.line + ', column ' + lc.col + ': ' + re.message + '\nRepair fixes comments, trailing and missing commas, single quotes, bare names, JSON5 numbers and Python’s True, False and None; this needs a hand.' };
          }
          return { error: describeJsonError(e, text) };
        }
      }

      /* JSONPath: the matches, as an array, become the value written out */
      let value = data, paths = null;
      const q = String(query || '').trim();
      if (q) {
        try { const r = jsonPathQuery(data, q); value = r.values; paths = r.paths; }
        catch (pe) { return { error: 'JSONPath: ' + (pe && pe.isPath ? pe.message : 'that query cannot be read') + '.' }; }
      }

      const pad = indent === 'tab' ? '\t' : Number(indent) || 2;
      const sortDeep = v => {
        if (Array.isArray(v)) return v.map(sortDeep);
        if (v && typeof v === 'object') {
          return Object.keys(v).sort().reduce((o, k) => (o[k] = sortDeep(v[k]), o), {});
        }
        return v;
      };
      let output, lang = 'json', download = null, warn = null;
      const extra = [];
      try {
        if (mode === 'yaml') {
          output = toYaml(value, indent === '4' ? 4 : 2);
          lang = 'yaml';
          download = { ext: 'yaml', type: 'application/yaml' };
          if (indent === 'tab') extra.push(['YAML indent', '2 spaces (YAML allows no tabs)']);
        } else if (mode === 'csv') {
          const c = toCsv(value);
          output = c.text;
          lang = null;
          download = { ext: 'csv', type: 'text/csv' };
          extra.push(['CSV rows', c.rows.toLocaleString('en-GB')], ['CSV columns', c.cols.toLocaleString('en-GB')]);
        } else if (mode === 'xml') {
          const x = toXml(value, indent === 'tab' ? '\t' : ' '.repeat(Number(indent) || 2));
          output = x.text;
          lang = 'xml';
          download = { ext: 'xml', type: 'application/xml' };
          if (x.renamed.length) warn = 'Not legal XML names, so renamed: ' + x.renamed.slice(0, 12).join(', ') + (x.renamed.length > 12 ? ' and ' + (x.renamed.length - 12) + ' more' : '') + '.';
        } else {
          const v = mode === 'sorted' ? sortDeep(value) : value;
          output = mode === 'minify' ? JSON.stringify(v) : JSON.stringify(v, null, pad);
          if (output === undefined) output = '';
        }
      } catch (e) {
        /* JSON.parse reads any depth; writing back out (and the sort) recurse,
           and run out of stack a few thousand levels down */
        return { error: `This JSON is valid, but it is nested ${depthOf(data).toLocaleString('en-GB')} levels deep, too deep for the browser to write back out.` };
      }
      const stats = [
        ['Valid', edits ? 'after repair (' + edits.length + (edits.length === 1 ? ' change)' : ' changes)') : 'yes'],
        ['Top-level type', Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data],
        ['Keys / items', countNodes(data).toLocaleString('en-GB')],
        ['Max depth', String(depthOf(data))],
        ['Input', bytes(text)],
        ['Output', bytes(output)]
      ];
      if (paths) stats.splice(4, 0, ['JSONPath matches', paths.length.toLocaleString('en-GB')]);
      extra.forEach((r) => stats.push(r));
      const res = { output, stats, lang };
      if (download) res.download = download;
      if (warn) res.warn = warn;
      if (paths) { res.matchCount = paths.length; res.paths = paths.slice(0, 2000); }
      if (edits) {
        const L = jfLineIndex(text);
        res.repairCount = edits.length;
        res.repairs = edits.slice(0, 1000).map((e) => { const lc = L.at(Math.min(e.start, text.length)); return { line: lc.line, col: lc.col, why: e.why }; });
        const d = jfRepairDiff(text, edits, L);
        res.diff = d.slice(0, 300);
        if (d.length > 300) res.diffCut = true;
        if (fixed.length <= 2 * 1048576) res.fixed = fixed;
        res.warn = (warn ? warn + ' ' : '') + 'Repaired: ' + edits.length + (edits.length === 1 ? ' change' : ' changes') + ' to your text made it valid JSON. Each one is listed below.';
      }
      return res;
    },
"mount": (ctx) => jfMount(ctx),
"render": (res) => { if (jfUi) jfUi.render(res); },
"tips": ["Tree shows the output as a collapsible tree: arrow keys move and open nodes, and Query this path puts the selected node’s path in the JSONPath box.","A JSONPath query such as $.items[?@.price > 10].sku keeps only what it matches, as an array, in every output; the matched paths are listed under the output.","Repair fixes what JSON5, JSONC and hand-edited files allow and JSON does not: comments, trailing commas, single quotes, bare names, +5, .5, 0x1F, NaN and Python’s True, False and None. It edits your own text, lists every change, and never runs unless you tick it.","YAML, CSV and XML are written from the same parsed value, and Download saves them as .yaml, .csv and .xml. CSV has one row per array item, with nested keys as dotted columns.","Minified output is what you ship; formatted output is what you read. The two parse identically.","Sorting keys makes two versions of a config file diff cleanly in Git."],
"faq": [{"q":"Is my data sent anywhere?","a":"No. Parsing and formatting happen in your browser using the built-in JSON engine. Nothing leaves the page, which is why this is safe for configuration files containing internal hostnames or keys."},{"q":"Why does my JSON fail with a trailing comma?","a":"The JSON specification does not allow a comma after the last element of an object or array, even though JavaScript does. Remove it, or tick Repair and the tool removes it for you and shows the line it changed."},{"q":"How big a file can it handle?","a":"Files over 50 KB are formatted, converted and queried in a background worker, so the page stays responsive and a Cancel button appears if it takes a while; files over 2 MB stay out of the text box."}]
};
})();
