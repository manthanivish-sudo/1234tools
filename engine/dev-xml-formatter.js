(function(){
/* ===================== shared helpers ===================== */

function bytes(s) {
  const n = new (typeof TextEncoder !== 'undefined' ? TextEncoder : Object)();
  const len = typeof TextEncoder !== 'undefined' ? n.encode(String(s)).length : String(s).length;
  if (len < 1024) return len + ' B';
  if (len < 1048576) return (len / 1024).toFixed(1) + ' KB';
  return (len / 1048576).toFixed(2) + ' MB';
}

function describeJsonError(e, text) {
  const msg = String(e.message || e);
  const m = msg.match(/position (\d+)/);
  if (!m) return 'Invalid JSON: ' + msg;
  const pos = Number(m[1]);
  const before = text.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  const snippet = (text.split('\n')[line - 1] || '').trim().slice(0, 60);
  return `Invalid JSON at line ${line}, column ${col}.\n${snippet ? '  ' + snippet + '\n' : ''}${msg.replace(/ in JSON.*/, '')}`;
}

function countNodes(v) {
  if (Array.isArray(v)) return v.length + v.reduce((n, x) => n + countNodes(x), 0);
  if (v && typeof v === 'object') {
    const k = Object.keys(v);
    return k.length + k.reduce((n, key) => n + countNodes(v[key]), 0);
  }
  return 0;
}

function depthOf(v, d = 1) {
  if (Array.isArray(v)) return v.length ? Math.max(...v.map(x => depthOf(x, d + 1))) : d;
  if (v && typeof v === 'object') {
    const k = Object.keys(v);
    return k.length ? Math.max(...k.map(key => depthOf(v[key], d + 1))) : d;
  }
  return d;
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

/* ================= an XML 1.0 well-formedness parser =================
   Written here from the W3C recommendation (productions 1-44, plus the
   Namespaces in XML rule that a prefix must be declared). It stops at the
   first breach, as a conforming processor must, and says where: line and
   column. It builds a light tree with source offsets, so the formatter can
   hand back an element exactly as written where indenting would change its
   meaning (mixed text and tags, xml:space="preserve"). Entities a DOCTYPE
   declares are recognised, never expanded. */
const XML_NAME = /^(?:[:A-Z_a-zÀ-ÖØ-öø-˿Ͱ-ͽͿ-῿‌-‍⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-\uFFFD]|[\uD800-\uDB7F][\uDC00-\uDFFF])(?:[-.0-9:A-Z_a-z·À-ÖØ-öø-ͽͿ-῿‌-‍‿-⁀⁰-↏Ⰰ-⿯、-퟿豈-﷏ﷰ-\uFFFD]|[\uD800-\uDB7F][\uDC00-\uDFFF])*/;
const XML_BAD_CHAR = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const XML_PREDEF = { amp: 1, lt: 1, gt: 1, quot: 1, apos: 1 };

function xmlParse(src) {
  const N = src.length;
  let pos = 0;
  const starts = [0];
  for (let i = src.indexOf('\n'); i >= 0; i = src.indexOf('\n', i + 1)) starts.push(i + 1);
  const lc = function (at) {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= at) lo = mid; else hi = mid - 1; }
    return { line: lo + 1, col: at - starts[lo] + 1 };
  };
  function fail(msg, at) {
    const p = lc(Math.min(Math.max(at, 0), N));
    return { error: msg + ' (line ' + p.line + ', column ' + p.col + ')', errorAt: p };
  }
  const entities = Object.create(null);
  const isWs = function (c) { return c === 32 || c === 9 || c === 10 || c === 13; };
  const skipWs = function () { while (pos < N && isWs(src.charCodeAt(pos))) pos++; };
  const readName = function () {
    const m = XML_NAME.exec(src.slice(pos, pos + 256));
    if (!m) return '';
    pos += m[0].length;
    return m[0];
  };
  const top = { k: 'doc', kids: [] };
  const stack = [top];
  const nsStack = [{ xml: 1, xmlns: 1 }];
  let elements = 0, attrs = 0, maxDepth = 0, depth = 0, rootSeen = false, root = null;
  const nsSeen = new Set();

  /* text between tags: characters, references, and the ]]> rule */
  function checkText(from, to, inAttr) {
    const s = src.slice(from, to);
    const bad = XML_BAD_CHAR.exec(s);
    if (bad) {
      const at = from + bad.index + (bad[0].length > 1 && !/^[\uD800-\uDBFF]/.test(bad[0]) ? bad[0].length - 1 : 0);
      const cp = src.codePointAt(at);
      return fail('Illegal character U+' + cp.toString(16).toUpperCase().padStart(4, '0') + ' (XML cannot contain this character)', at);
    }
    if (!inAttr) { const k = s.indexOf(']]>'); if (k >= 0) return fail('The sequence ]]> is not allowed in text; write ]]&gt;', from + k); }
    for (let i = s.indexOf('&'); i >= 0; i = s.indexOf('&', i + 1)) {
      const m = /^&(#x[0-9A-Fa-f]+|#[0-9]+|[^\s;&<]*)(;?)/.exec(s.slice(i, i + 80));
      const at = from + i;
      if (!m || !m[1]) return fail('A bare & must be written &amp; (a reference is &name; or &#number;)', at);
      if (!m[2]) return fail('The reference &' + m[1].slice(0, 20) + ' has no closing ; (write a bare & as &amp;)', at);
      const ref = m[1];
      if (ref.charAt(0) === '#') {
        const cp = ref.charAt(1) === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
        const ok = cp === 9 || cp === 10 || cp === 13 || (cp >= 0x20 && cp <= 0xD7FF) || (cp >= 0xE000 && cp <= 0xFFFD) || (cp >= 0x10000 && cp <= 0x10FFFF);
        if (!ok) return fail('The character reference &' + ref + '; is not a character XML allows', at);
      } else if (!XML_NAME.test(ref) || XML_NAME.exec(ref)[0].length !== ref.length) {
        return fail('"' + ref + '" is not a valid entity name; a bare & must be written &amp;', at);
      } else if (!XML_PREDEF[ref] && !entities[ref]) {
        return fail('The entity &' + ref + '; is not defined. Only &amp; &lt; &gt; &quot; &apos; exist unless a DOCTYPE declares more; for a character use &#number;', at);
      }
    }
    return null;
  }

  function parseDoctype(from) {
    // <!DOCTYPE name externalID? [ internal subset ]? >
    let i = from + 9, depthB = 0, q = '';
    for (; i < N; i++) {
      const c = src[i];
      if (q) { if (c === q) q = ''; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '[') depthB++;
      else if (c === ']') depthB--;
      else if (c === '<' && src.startsWith('<!--', i)) { const e = src.indexOf('-->', i + 4); if (e < 0) return fail('This comment is never closed with -->', i); i = e + 2; }
      else if (c === '>' && depthB <= 0) break;
    }
    if (i >= N) return fail('The DOCTYPE is never closed with >', from);
    const body = src.slice(from, i + 1);
    const L = '(?:"[^"]*"|\'[^\']*\')', WS = '[ \\t\\r\\n]';
    const head = new RegExp('^<!DOCTYPE' + WS + '+' + XML_NAME.source.slice(1) + '(?:' + WS + '+(?:SYSTEM' + WS + '+' + L + '|PUBLIC' + WS + '+' + L + WS + '+' + L + '))?' + WS + '*(?:\\[|>)');
    if (!head.test(body)) return fail('A DOCTYPE reads <!DOCTYPE name, then SYSTEM or PUBLIC with quoted text if there is an external part, then [ … ] if it declares entities', from);
    // the internal subset: only markup declarations, comments, processing instructions and %references
    const ib = body.indexOf('[');
    const q0 = body.search(/["']/);
    if (ib >= 0 && (q0 < 0 || ib < q0)) {
      const sub = body.slice(ib + 1, body.lastIndexOf(']'));
      const base = from + ib + 1;
      let k = 0;
      while (k < sub.length) {
        const rest = sub.slice(k);
        const ws = /^[ \t\r\n]+/.exec(rest);
        if (ws) { k += ws[0].length; continue; }
        if (rest.startsWith('<!--')) { const e = rest.indexOf('-->'); k += e + 3; continue; }
        if (rest.startsWith('<?')) { const e = rest.indexOf('?>'); if (e < 0) return fail('This processing instruction is never closed with ?>', base + k); k += e + 2; continue; }
        const pe = /^%[^\s;]+;/.exec(rest);
        if (pe) { k += pe[0].length; continue; }
        const decl = /^<!(ENTITY|ELEMENT|ATTLIST|NOTATION)[ \t\r\n]/.exec(rest);
        if (!decl) return fail('This is not a declaration a DOCTYPE allows (expected <!ENTITY, <!ELEMENT, <!ATTLIST or <!NOTATION, with a space after the keyword)', base + k);
        let q = '', e = k + decl[0].length;
        for (; e < sub.length; e++) { const c = sub[e]; if (q) { if (c === q) q = ''; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; }
        if (e >= sub.length) return fail('The <!' + decl[1] + ' declaration is never closed with >', base + k);
        const decltext = sub.slice(k, e + 1);
        if (decl[1] === 'ENTITY') {
          const em = /^<!ENTITY[ \t\r\n]+(%[ \t\r\n]+)?([^ \t\r\n]+)[ \t\r\n]+(?:"[^"]*"|'[^']*'|SYSTEM|PUBLIC)/.exec(decltext);
          if (!em) return fail('This <!ENTITY declaration needs a name, a space, and then a quoted value or SYSTEM or PUBLIC', base + k);
          { const nm = XML_NAME.exec(em[2]); if (!nm || nm[0].length !== em[2].length) return fail('"' + em[2] + '" is not a valid entity name', base + k); }
          const val = /^<!ENTITY[ \t\r\n]+(?:%[ \t\r\n]+)?[^ \t\r\n]+[ \t\r\n]+("[^"]*"|'[^']*')/.exec(decltext);
          if (val && val[1].slice(1, -1).replace(/&(?:#[0-9]+|#x[0-9A-Fa-f]+|[^\s;&<%"']+);/g, '').search(/[&%]/) >= 0) return fail('An entity value cannot hold a bare & or % (write &amp; or &#37;)', base + k);
          if (!em[1]) entities[em[2]] = 1;
        }
        k = e + 1;
      }
    }
    pos = i + 1;
    return null;
  }

  // BOM
  if (src.charCodeAt(0) === 0xFEFF) pos = 1;
  // XML declaration: only at the very start
  if (/^<\?xml(?=[\s?])/.test(src.slice(pos, pos + 7))) {
    const e = src.indexOf('?>', pos);
    if (e < 0) return fail('The XML declaration is never closed with ?>', pos);
    const decl = src.slice(pos + 5, e);
    const dm = /^\s+version\s*=\s*(["'])1\.\d+\1(?:\s+encoding\s*=\s*(["'])[A-Za-z][A-Za-z0-9._-]*\2)?(?:\s+standalone\s*=\s*(["'])(?:yes|no)\3)?\s*$/.exec(decl);
    if (!dm) return fail('The XML declaration is malformed: it must read <?xml version="1.0" encoding="UTF-8"?> with the parts in that order', pos);
    top.kids.push({ k: 'decl', s: pos, e: e + 2 });
    pos = e + 2;
  }

  const add = function (n) { stack[stack.length - 1].kids.push(n); };
  while (pos < N) {
    const c = src.charCodeAt(pos);
    if (c !== 60) {
      // text
      let e = src.indexOf('<', pos);
      if (e < 0) e = N;
      const t = src.slice(pos, e);
      const parent = stack[stack.length - 1];
      const blank = !/[^ \t\r\n]/.test(t);
      if (parent === top) {
        if (!blank) return fail(rootSeen ? 'Text after the root element is not allowed' : 'Text before the root element is not allowed (is this XML?)', pos + /[^ \t\r\n]/.exec(t).index);
      } else {
        const bad = checkText(pos, e, false);
        if (bad) return bad;
        if (!blank) parent.hasText = true;
      }
      add({ k: 'text', s: pos, e: e, ws: blank });
      pos = e;
      continue;
    }
    const at = pos;
    if (src.startsWith('<!--', pos)) {
      const e = src.indexOf('-->', pos + 4);
      if (e < 0) return fail('This comment is never closed with -->', at);
      const body = src.slice(pos + 4, e);
      const dd = body.indexOf('--');
      if (dd >= 0) return fail('A comment cannot contain -- (two hyphens)', pos + 4 + dd);
      if (body.charAt(body.length - 1) === '-') return fail('A comment cannot end with --->', e - 1);
      const bad = checkText(pos + 4, e, true);
      if (bad && !/Illegal/.test(bad.error)) { /* references are literal inside comments */ } else if (bad) return bad;
      add({ k: 'comment', s: pos, e: e + 3 });
      pos = e + 3;
    } else if (src.startsWith('<![CDATA[', pos)) {
      if (stack.length === 1) return fail('A CDATA section must be inside the root element', at);
      const e = src.indexOf(']]>', pos + 9);
      if (e < 0) return fail('This CDATA section is never closed with ]]>', at);
      const bad = XML_BAD_CHAR.exec(src.slice(pos + 9, e));
      if (bad) return fail('Illegal character U+' + src.codePointAt(pos + 9 + bad.index).toString(16).toUpperCase().padStart(4, '0') + ' (XML cannot contain this character)', pos + 9 + bad.index);
      add({ k: 'cdata', s: pos, e: e + 3 });
      stack[stack.length - 1].hasText = true;
      pos = e + 3;
    } else if (src.startsWith('<?', pos)) {
      pos += 2;
      const target = readName();
      if (!target) return fail('A processing instruction needs a name after <?', at);
      if (/^xml$/i.test(target)) return fail('The XML declaration must be the very first thing in the document', at);
      if (!/^(?:[ \t\r\n]|\?>)/.test(src.slice(pos, pos + 2))) return fail('A processing instruction needs a space between its name and its content', pos);
      const e = src.indexOf('?>', pos);
      if (e < 0) return fail('This processing instruction is never closed with ?>', at);
      add({ k: 'pi', s: at, e: e + 2 });
      pos = e + 2;
    } else if (src.startsWith('<!DOCTYPE', pos)) {
      if (rootSeen || stack.length > 1) return fail('A DOCTYPE must come before the root element', at);
      if (top.kids.some(function (n) { return n.k === 'doctype'; })) return fail('A document can have only one DOCTYPE', at);
      const bad = parseDoctype(pos);
      if (bad) return bad;
      top.kids.push({ k: 'doctype', s: at, e: pos });
    } else if (src.startsWith('</', pos)) {
      pos += 2;
      const name = readName();
      if (!name) return fail('An end tag needs the name of the element it closes', at);
      skipWs();
      if (src.charAt(pos) !== '>') return fail('The end tag </' + name + ' must finish with >', pos);
      pos++;
      const open = stack.length > 1 ? stack[stack.length - 1] : null;
      if (!open) return fail('Closing tag </' + name + '> has no matching opening tag.', at);
      if (open.name !== name) return fail('Mismatched tags: <' + open.name + '> is closed by </' + name + '>.', at);
      open.e = pos;
      open.endS = at;
      stack.pop();
      nsStack.pop();
      depth--;
    } else if (XML_NAME.test(src.slice(pos + 1, pos + 3))) {
      pos++;
      const name = readName();
      const parent = stack[stack.length - 1];
      if (parent === top) {
        if (rootSeen) return fail('A document can have only one root element; this is a second, <' + name + '>', at);
        rootSeen = true;
      }
      const el = { k: 'el', name: name, s: at, kids: [], attrs: [], hasText: false, hasEl: false, selfClose: false, preserve: false };
      const scope = Object.create(nsStack[nsStack.length - 1]);
      const seen = {};
      for (;;) {
        const before = pos;
        skipWs();
        const ch = src.charAt(pos);
        if (pos >= N) return fail('The start tag <' + name + ' is never closed with >', at);
        if (ch === '>') { pos++; break; }
        if (ch === '/') { if (src.charAt(pos + 1) !== '>') return fail('A / in a tag must be followed by >', pos); pos += 2; el.selfClose = true; break; }
        if (pos === before) return fail('Attributes must be separated by whitespace', pos);
        const aAt = pos;
        const an = readName();
        if (!an) return fail('"' + src.charAt(pos) + '" cannot start an attribute name', pos);
        skipWs();
        if (src.charAt(pos) !== '=') return fail('The attribute ' + an + ' needs a value: write ' + an + '="…"', pos);
        pos++;
        skipWs();
        const qc = src.charAt(pos);
        if (qc !== '"' && qc !== "'") return fail('The value of ' + an + ' must be in quotes: ' + an + '="…"', pos);
        const vs = pos + 1;
        const ve = src.indexOf(qc, vs);
        if (ve < 0) return fail('The value of ' + an + ' is never closed with ' + qc, pos);
        const lt = src.slice(vs, ve).indexOf('<');
        if (lt >= 0) return fail('A < is not allowed inside an attribute value; write &lt;', vs + lt);
        const bad = checkText(vs, ve, true);
        if (bad) return bad;
        if (seen[an]) return fail('The attribute ' + an + ' appears twice on <' + name + '>', aAt);
        seen[an] = 1;
        pos = ve + 1;
        el.attrs.push({ name: an, quote: qc, value: src.slice(vs, ve), at: aAt });
        attrs++;
        if (an === 'xmlns') { scope[''] = 1; nsSeen.add(src.slice(vs, ve)); }
        else if (an.slice(0, 6) === 'xmlns:') { scope[an.slice(6)] = 1; nsSeen.add(an.slice(6)); }
        if (an === 'xml:space' && src.slice(vs, ve) === 'preserve') el.preserve = true;
      }
      // namespaces: a prefix has to be declared
      const colon = name.indexOf(':');
      if (colon > 0 && !scope[name.slice(0, colon)]) return fail('The namespace prefix "' + name.slice(0, colon) + '" is not declared (add xmlns:' + name.slice(0, colon) + '="…")', at + 1);
      for (const a of el.attrs) {
        const ac = a.name.indexOf(':');
        if (ac > 0 && a.name.slice(0, 6) !== 'xmlns:' && !scope[a.name.slice(0, ac)]) return fail('The namespace prefix "' + a.name.slice(0, ac) + '" is not declared (add xmlns:' + a.name.slice(0, ac) + '="…")', a.at);
      }
      el.startE = pos;
      if (parent !== top) parent.hasEl = true;
      parent.kids.push(el);
      elements++;
      if (!root) root = el;
      if (el.selfClose) { el.e = pos; if (depth + 1 > maxDepth) maxDepth = depth + 1; }
      else { stack.push(el); nsStack.push(scope); depth++; if (depth > maxDepth) maxDepth = depth; }
    } else {
      const next = src.charAt(pos + 1);
      return fail(next === ' ' || next === '\n' || next === '' ? 'A < must be written &lt; in text (or it starts a tag, which needs a name right after it)' : '"' + next + '" cannot start a tag name; a literal < must be written &lt;', at);
    }
  }
  if (stack.length > 1) { const o = stack[stack.length - 1]; return fail('Unclosed tag: <' + o.name + '> is never closed.', o.s); }
  if (!root) return fail('No XML elements found.', 0);
  return { doc: top, root: root, elements: elements, attrs: attrs, depth: maxDepth, ns: nsSeen.size };
}

/* start tag rebuilt from its parts: one space between attributes, no space
   around =, the quote each value was written with, and the value itself exactly */
function xmlStartTag(el) {
  let s = '<' + el.name;
  for (const a of el.attrs) s += ' ' + a.name + '=' + a.quote + a.value + a.quote;
  return s + (el.selfClose ? '/>' : '>');
}
function xmlMinify(src, doc, keepComments) {
  const out = [];
  (function walk(list, keepWs, parent) {
    for (const n of list) {
      if (n.k === 'el') {
        out.push(xmlStartTag(n));
        if (!n.selfClose) { walk(n.kids, keepWs || n.preserve, n); out.push('</' + n.name + '>'); }
      } else if (n.k === 'text') { if (!n.ws || keepWs || (parent && parent.hasText)) out.push(src.slice(n.s, n.e)); }
      else if (n.k === 'comment' && !keepComments) { /* dropped */ }
      else out.push(src.slice(n.s, n.e));
    }
  })(doc.kids, false, null);
  return out.join('');
}
function xmlPretty(src, doc, pad, keepComments) {
  const lines = [];
  (function walk(list, depth) {
    const ind = pad.repeat(depth);
    for (const n of list) {
      if (n.k === 'text') continue;
      if (n.k === 'comment' && !keepComments) continue;
      if (n.k !== 'el') { lines.push(ind + src.slice(n.s, n.e)); continue; }
      const verbatim = n.preserve || (n.hasText && n.hasEl);
      if (verbatim) { lines.push(ind + src.slice(n.s, n.e)); continue; }
      if (n.selfClose) { lines.push(ind + xmlStartTag(n)); continue; }
      const kids = n.kids.filter(function (k) { return !(k.k === 'text' && k.ws) && !(k.k === 'comment' && !keepComments); });
      if (!kids.length) { lines.push(ind + xmlStartTag(n) + '</' + n.name + '>'); continue; }
      if (!n.hasEl) {
        // text, CDATA and comments only: the content stays on the element's line, exactly as written
        lines.push(ind + xmlStartTag(n) + n.kids.filter(function (k) { return keepComments || k.k !== 'comment'; }).map(function (k) { return src.slice(k.s, k.e); }).join('') + '</' + n.name + '>');
        continue;
      }
      lines.push(ind + xmlStartTag(n));
      walk(n.kids, depth + 1);
      lines.push(ind + '</' + n.name + '>');
    }
  })(doc.kids, 0);
  return lines.join('\n');
}

window.DEV_TOOLS["xml-formatter"] = {
"title": "XML Formatter & Validator",
"category": "developer",
"icon": "</>",
"kind": "code",
"files": {"accept": ".xml,.svg,.xsd,.xsl,.rss,.atom,application/xml,text/xml,.txt", "label": "Open file"},
"download": {"ext": "xml", "type": "application/xml", "suffix": "-formatted"},
"highlight": "xml",
"description": "Format, minify and validate XML with a real parser that names the line and column of the first error, and run XPath queries against it.",
"keywords": ["xml formatter","xml beautifier","xml validator","pretty print xml","tidy xml","xpath tester","xml well-formed check"],
"inputLabel": "XML",
"outputLabel": "Formatted output",
"placeholder": "<catalogue><item id=\"1\"><name>Widget</name></item></catalogue>",
"sample": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<catalogue><item id=\"1\"><name>Widget</name><price currency=\"GBP\">19.99</price></item><item id=\"2\"><name>Gadget</name><price currency=\"GBP\">24.50</price></item></catalogue>",
"options": [
  {"key":"mode","label":"Output","type":"select","default":"pretty","options":[{"value":"pretty","label":"Formatted (indented)"},{"value":"minify","label":"Minified"}]},
  {"key":"indent","label":"Indent","type":"select","default":"2","options":[{"value":"2","label":"2 spaces"},{"value":"4","label":"4 spaces"},{"value":"tab","label":"Tab"}]},
  {"key":"comments","label":"Comments","type":"select","default":"keep","options":[{"value":"keep","label":"Keep"},{"value":"strip","label":"Remove"}]},
  {"key":"xpath","label":"XPath 1.0 query (optional)","type":"text","default":""}
],
"transform": (text, { mode, indent, comments }) => {
      if (!text.trim()) return { output: '', note: 'Paste some XML above.' };
      const p = xmlParse(text);
      if (p.error) return { error: p.error, errorAt: p.errorAt };
      const pad = indent === 'tab' ? '\t' : ' '.repeat(Number(indent));
      const keep = comments !== 'strip';
      const output = mode === 'minify' ? xmlMinify(text, p.doc, keep) : xmlPretty(text, p.doc, pad, keep);
      const stats = [
        ['Tags balanced', 'yes'],
        ['Elements', String(p.elements)],
        ['Max depth', String(p.depth)],
        ['Attributes', String(p.attrs)],
        ['Input', bytes(text)],
        ['Output', bytes(output)]
      ];
      if (p.ns) stats.splice(4, 0, ['Namespaces', String(p.ns)]);
      return { output, stats, root: p.root.name };
    },
"tips": ["This is a well-formedness check by the XML 1.0 rules, and it stops at the first error with its line and column. It does not validate against a DTD or XSD schema.","XML is case-sensitive: <Item> and <item> are different elements.","Five characters must be escaped in text content: & < > \" and '. HTML names such as &nbsp; are errors unless a DOCTYPE declares them; write &#160;.","An element that mixes text and tags, or has xml:space=\"preserve\", is printed exactly as written so no meaningful space is added or lost.","Type an XPath 1.0 expression such as //item[@id='2']/name to list the matches. A default namespace needs *[local-name()='item']."],
"faq": [{"q":"What is the difference between well-formed and valid XML?","a":"Well-formed means the syntax is correct: tags nest and close properly, attributes are quoted, entities are defined. Valid means it also conforms to a schema that defines which elements are allowed where. This tool checks well-formedness."},{"q":"Which XPath does it use?","a":"XPath 1.0, run by your browser's own engine on a copy of your document. Nothing is sent anywhere."}],
"render": function (res, ctx) { xmlXPath(res, ctx); }
};

/* ---- XPath, by the browser's own XPath 1.0 engine ---- */
function xmlNodePath(n) {
  if (n.nodeType === 2) return xmlNodePath(n.ownerElement) + '/@' + n.name;
  if (n.nodeType === 9) return '/';
  if (n.nodeType === 3 || n.nodeType === 4) return xmlNodePath(n.parentNode) + '/text()';
  if (!n.parentNode || n.parentNode.nodeType === 9) return '/' + n.nodeName;
  let i = 1, same = 0;
  for (const s of n.parentNode.childNodes) if (s.nodeType === 1 && s.nodeName === n.nodeName) { same++; if (s === n) i = same; }
  const base = xmlNodePath(n.parentNode);
  return (base === '/' ? '' : base) + '/' + n.nodeName + (same > 1 ? '[' + i + ']' : '');
}
function xmlXPath(res, ctx) {
  const box = ctx.extra;
  box.textContent = '';
  const xp = String(ctx.opts().xpath || '').trim();
  if (!xp || !res || res.error || res.root === undefined) return;
  const wrap = ctx.el('div', 'io-pane xp-pane');
  const head = ctx.el('div', 'io-head');
  head.appendChild(ctx.el('span', 'io-label', 'XPath result'));
  wrap.appendChild(head);
  const body = ctx.el('div', 'xp-body');
  wrap.appendChild(body);
  box.appendChild(wrap);
  try {
    const doc = new DOMParser().parseFromString(ctx.text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) { body.textContent = 'The browser could not read this document for XPath.'; return; }
    const r = doc.evaluate(xp, doc, doc.createNSResolver(doc.documentElement), XPathResult.ANY_TYPE, null);
    const rows = [];
    let summary = '';
    if (r.resultType === XPathResult.NUMBER_TYPE) summary = 'A number: ' + r.numberValue;
    else if (r.resultType === XPathResult.STRING_TYPE) summary = 'A string: ' + JSON.stringify(r.stringValue);
    else if (r.resultType === XPathResult.BOOLEAN_TYPE) summary = 'A boolean: ' + r.booleanValue;
    else {
      let n, total = 0;
      const ser = new XMLSerializer();
      while ((n = r.iterateNext())) {
        total++;
        if (rows.length < 500) {
          let v = n.nodeType === 1 ? ser.serializeToString(n) : (n.nodeValue || n.textContent || '');
          if (v.length > 300) v = v.slice(0, 300) + '…';
          rows.push([xmlNodePath(n), v]);
        }
      }
      summary = total + (total === 1 ? ' match' : ' matches') + (total > rows.length ? ' (first ' + rows.length + ' shown)' : '');
    }
    body.appendChild(ctx.el('p', 'xp-sum', summary));
    if (rows.length) {
      const t = ctx.el('table', 'xp-grid');
      rows.forEach(function (x, i) {
        const tr = ctx.el('tr');
        tr.appendChild(ctx.el('td', 'xp-n', String(i + 1)));
        tr.appendChild(ctx.el('td', 'xp-path', x[0]));
        tr.appendChild(ctx.el('td', 'xp-val', x[1]));
        t.appendChild(tr);
      });
      body.appendChild(t);
      const copy = ctx.el('button', 'btn-copy', 'Copy matches');
      copy.type = 'button';
      copy.addEventListener('click', function () { ctx.copyText(rows.map(function (x) { return x[1]; }).join('\n'), copy); });
      head.appendChild(copy);
    }
  } catch (e) {
    body.textContent = 'XPath error: ' + String((e && e.message) || e).replace(/^Failed to execute 'evaluate' on 'Document': /, '');
    body.classList.add('is-error');
  }
}
})();
