(function(){
/* ===================== shared helpers ===================== */

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
   same place JSON.parse gives up, and says why. It runs only after JSON.parse
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
      i++; skip();
      if (text[i] === close) return fail('Trailing comma: remove the comma before this ' + close + '.');
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


window.DEV_TOOLS = window.DEV_TOOLS || {};
window.DEV_TOOLS["json-formatter"] = {
"title": "JSON Formatter & Validator",
"category": "developer",
"icon": "{ }",
"kind": "code",
"description": "Format, validate and minify JSON. Pinpoints the exact line and column of any syntax error.",
"keywords": ["json formatter","json validator","json beautifier","json minify","pretty print json"],
"inputLabel": "JSON",
"outputLabel": "Formatted output",
"placeholder": "{\"name\":\"MVR\",\"services\":[\"software\",\"integration\"],\"since\":2013}",
"sample": "{\"name\":\"MVR IT Services\",\"services\":[\"software\",\"integrations\",\"AI\"],\"since\":2013,\"uk\":true}",
"options": [{"key":"mode","label":"Output","type":"select","default":"pretty","options":[{"value":"pretty","label":"Formatted (indented)"},{"value":"minify","label":"Minified (one line)"},{"value":"sorted","label":"Formatted + keys sorted"}]},{"key":"indent","label":"Indent","type":"select","default":"2","options":[{"value":"2","label":"2 spaces"},{"value":"4","label":"4 spaces"},{"value":"tab","label":"Tab"}]}],
"transform": (text, { mode, indent }) => {
      if (!text.trim()) return { output: '', note: 'Paste some JSON above.' };
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return { error: describeJsonError(e, text) };
      }
      const pad = indent === 'tab' ? '\t' : Number(indent);
      const sortDeep = v => {
        if (Array.isArray(v)) return v.map(sortDeep);
        if (v && typeof v === 'object') {
          return Object.keys(v).sort().reduce((o, k) => (o[k] = sortDeep(v[k]), o), {});
        }
        return v;
      };
      let output;
      try {
        const value = mode === 'sorted' ? sortDeep(data) : data;
        output = mode === 'minify' ? JSON.stringify(value) : JSON.stringify(value, null, pad);
      } catch (e) {
        /* JSON.parse reads any depth; JSON.stringify (and the sort) recurse,
           and run out of stack a few thousand levels down */
        return { error: `This JSON is valid, but it is nested ${depthOf(data).toLocaleString('en-GB')} levels deep, too deep for the browser to write back out.` };
      }
      return {
        output,
        stats: [
          ['Valid', 'yes'],
          ['Top-level type', Array.isArray(data) ? 'array' : typeof data],
          ['Keys / items', countNodes(data).toLocaleString('en-GB')],
          ['Max depth', String(depthOf(data))],
          ['Input', bytes(text)],
          ['Output', bytes(output)]
        ]
      };
    },
"tips": ["Minified output is what you ship; formatted output is what you read. The two parse identically.","Sorting keys makes two versions of a config file diff cleanly in Git.","JSON has no comments and no trailing commas. Both are the most common causes of a parse error."],
"faq": [{"q":"Is my data sent anywhere?","a":"No. Parsing and formatting happen in your browser using the built-in JSON engine. Nothing leaves the page, which is why this is safe for configuration files containing internal hostnames or keys."},{"q":"Why does my JSON fail with a trailing comma?","a":"The JSON specification does not allow a comma after the last element of an object or array, even though JavaScript does. Remove it."}]
};
})();