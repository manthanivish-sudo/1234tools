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

/* ============================================================
   JWT decoder, verifier and encoder (wave 3)

   Decoding is synchronous and pure (transform). Verifying and signing use
   the browser's WebCrypto (crypto.subtle), so they are async and live in
   jwtVerify / jwtSign, which the page calls from its own panel and the
   tests call in Node with Node's webcrypto. Secrets and keys are typed into
   the page's own boxes, never into the shell's options: so they are never
   saved on the device and never put in a share link.
   ============================================================ */

const JW_ENC = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const JW_DEC = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: true }) : null;

function jwB64uBytes(s) {
  const str = String(s);
  if (!/^[A-Za-z0-9_\-+/]*={0,2}$/.test(str)) throw new Error('not base64url');
  const clean = str.replace(/=+$/, '');
  if (clean.length % 4 === 1) throw new Error('not base64url');
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => {
      const c = clean[i + k];
      if (c === undefined) return 0;
      if (c === '-' || c === '+') return 62;
      if (c === '_' || c === '/') return 63;
      return T.indexOf(c);
    });
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
    out[o++] = n >>> 16;
    if (i + 2 < clean.length) out[o++] = (n >>> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out;
}
function jwBytesB64u(u8) {
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let s = '';
  for (let i = 0; i < u8.length; i += 3) {
    const a = u8[i], b = u8[i + 1], c = u8[i + 2];
    s += T[a >> 2] + T[((a & 3) << 4) | ((b || 0) >> 4)];
    if (b !== undefined) s += T[((b & 15) << 2) | ((c || 0) >> 6)];
    if (c !== undefined) s += T[c & 63];
  }
  return s;
}
const jwUtf8 = (s) => JW_ENC ? JW_ENC.encode(String(s)) : Uint8Array.from(unescape(encodeURIComponent(String(s))), (c) => c.charCodeAt(0));
function jwText(u8) {
  if (JW_DEC) return JW_DEC.decode(u8);
  return decodeURIComponent(escape(String.fromCharCode.apply(null, Array.from(u8))));
}

/* ---------- what the claims mean ---------- */
const JW_HEADER = {
  alg: 'Signing algorithm. A server should accept only the one it expects, never whatever the token names.',
  typ: 'Media type of the token, usually JWT (or at+jwt for an OAuth access token).',
  kid: 'Key ID: which of the issuer’s keys signed it. Used to pick the key from a JWKS.',
  cty: 'Content type of the payload; "JWT" means a token nested inside this one.',
  jku: 'A URL of the key set to verify with. Only trust it if the URL is on your allow-list.',
  jwk: 'A public key carried in the header itself. Never verify with a key the token brings.',
  x5u: 'A URL of an X.509 certificate chain for the signing key.',
  x5c: 'An X.509 certificate chain for the signing key, carried in the header.',
  x5t: 'SHA-1 thumbprint of the signing certificate.',
  'x5t#S256': 'SHA-256 thumbprint of the signing certificate.',
  crit: 'Header parameters the receiver must understand, or reject the token.',
  b64: 'false means the payload is not base64url-encoded (RFC 7797).',
  enc: 'Content encryption algorithm (an encrypted token, JWE).',
  zip: 'Compression applied before encryption (JWE).'
};
const JW_CLAIMS = {
  iss: 'Issuer: who created and signed the token.',
  sub: 'Subject: the user or service the token is about.',
  aud: 'Audience: who the token is for. A server must reject a token not meant for it.',
  exp: 'Expiry: after this moment the token must be refused.',
  nbf: 'Not before: the token must be refused until this moment.',
  iat: 'Issued at: when the token was created.',
  jti: 'JWT ID: a unique ID, used to stop a token being replayed.',
  scope: 'OAuth scopes granted, separated by spaces.',
  scp: 'Scopes granted (Microsoft and others use scp for scope).',
  azp: 'Authorised party: the client the token was issued to (OpenID Connect).',
  client_id: 'The OAuth client the token was issued to.',
  nonce: 'A value from the login request, echoed back to stop replay (OpenID Connect).',
  auth_time: 'When the user actually authenticated.',
  acr: 'Authentication context class: how strongly the user logged in.',
  amr: 'Authentication methods used, such as pwd, otp or mfa.',
  sid: 'Session ID at the identity provider.',
  at_hash: 'Hash of the access token issued alongside this ID token.',
  c_hash: 'Hash of the authorisation code issued alongside this ID token.',
  cnf: 'Confirmation: the key the holder must prove they have (proof-of-possession).',
  roles: 'Roles granted to the subject.',
  groups: 'Groups the subject belongs to.',
  permissions: 'Permissions granted to the subject.',
  email: 'Email address of the subject.',
  email_verified: 'Whether the identity provider has verified that email address.',
  name: 'Full name of the subject.',
  given_name: 'Given (first) name.',
  family_name: 'Family name (surname).',
  preferred_username: 'The username the subject prefers to be shown.',
  picture: 'Address of a profile picture.',
  locale: 'Language and region of the subject, such as en-GB.',
  zoneinfo: 'Time zone of the subject, such as Europe/London.',
  updated_at: 'When the subject’s profile was last changed.',
  phone_number: 'Phone number of the subject.',
  tid: 'Tenant ID (Microsoft Entra ID).',
  oid: 'Object ID of the user (Microsoft Entra ID).',
  upn: 'User principal name (Microsoft).',
  ver: 'Token format version.',
  realm_access: 'Realm roles (Keycloak).',
  resource_access: 'Client roles (Keycloak).',
  'cognito:groups': 'Groups the user belongs to (Amazon Cognito).',
  token_use: 'Whether this is an id or access token (Amazon Cognito).'
};
const JW_TIMES = { exp: 1, nbf: 1, iat: 1, auth_time: 1, updated_at: 1 };
const jwUtc = (t) => {
  const d = new Date(t * 1000);
  if (!isFinite(d.getTime())) return 'not a valid time';
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
};

function jwShort(v) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 120 ? s.slice(0, 117) + '…' : s;
}

function jwClaimRows(header, payload) {
  const rows = [];
  const add = (part, obj, dict) => Object.keys(obj).forEach((k) => {
    const v = obj[k];
    const r = { part, key: k, value: jwShort(v), meaning: dict[k] || (part === 'header' ? 'A header parameter this page does not know.' : 'A private claim: its meaning is set by whoever issued the token.') };
    if (part === 'payload' && JW_TIMES[k]) {
      if (typeof v === 'number') {
        r.time = v;
        r.meaning += ' ' + jwUtc(v) + '.';
        if (v > 1e11) r.meaning += ' This looks like milliseconds; JWT times are whole seconds.';
      } else r.meaning += ' It should be a number of seconds since 1970, but is not a number.';
    }
    rows.push(r);
  });
  if (header && typeof header === 'object') add('header', header, JW_HEADER);
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) add('payload', payload, JW_CLAIMS);
  return rows;
}

/** The live status line: a pure function of the token's times and now (seconds). */
function jwStatus(exp, nbf, now) {
  const dur = (s) => {
    s = Math.max(0, Math.round(s));
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    if (d) return d + ' d ' + h + ' h ' + m + ' min';
    if (h) return h + ' h ' + m + ' min ' + x + ' s';
    if (m) return m + ' min ' + x + ' s';
    return x + ' s';
  };
  if (typeof nbf === 'number' && nbf > now) return { state: 'early', text: 'Not valid yet: it starts in ' + dur(nbf - now) + '.' };
  if (typeof exp === 'number') {
    if (exp <= now) return { state: 'expired', text: 'Expired ' + dur(now - exp) + ' ago.' };
    return { state: 'live', text: 'Expires in ' + dur(exp - now) + '.' };
  }
  return { state: 'none', text: 'No expiry (exp): it never runs out unless the server limits it.' };
}

function jwTransform(text) {
  let tok = String(text || '').trim();
  if (!tok) return { output: '', note: 'Paste a token above.' };
  let note = '';
  const bearer = /^bearer\s+/i.exec(tok);
  if (bearer) { tok = tok.slice(bearer[0].length); note = 'The "Bearer " prefix was left out: the token is what follows it.'; }
  tok = tok.replace(/\s+/g, '');
  const parts = tok.split('.');
  if (parts.length === 5) return { error: 'This has five parts, so it is an encrypted token (JWE, RFC 7516). Its payload cannot be read without the recipient’s private key; only its header is plain.' };
  if (parts.length !== 3) return { error: `A JWT has three dot-separated parts. This has ${parts.length}.` };
  const dec = (p) => JSON.parse(jwText(jwB64uBytes(p)));
  let header, payload;
  try { header = dec(parts[0]); } catch (e) { return { error: 'The header segment is not valid Base64URL-encoded JSON.' }; }
  try { payload = dec(parts[1]); } catch (e) { return { error: 'The payload segment is not valid Base64URL-encoded JSON.' }; }

  const when = (t) => t ? jwUtc(t) : '—';
  const now = Math.floor(Date.now() / 1000);
  const stats = [
    ['Algorithm', String(header.alg || '—')],
    ['Type', String(header.typ || '—')],
    ['Issued', when(payload.iat)]
  ];
  if (payload.nbf !== undefined) stats.push(['Not before', when(payload.nbf)]);
  stats.push(['Expires', when(payload.exp)]);
  if (typeof payload.nbf === 'number' && payload.nbf > now) stats.push(['Status', 'NOT YET VALID: starts in ' + humanDuration(payload.nbf - now)]);
  else if (payload.exp) stats.push(['Status', payload.exp < now ? 'EXPIRED' : 'Valid for ' + humanDuration(payload.exp - now)]);

  const alg = String(header.alg || '');
  /* the Verify panel below says the token is not verified yet; the pane only warns of an unsigned token */
  const warn = /^none$/i.test(alg) ? 'This token is unsigned ("alg": "none"). Anyone can write one; a server must refuse it.' : '';
  return {
    output: '// Header\n' + JSON.stringify(header, null, 2) + '\n\n// Payload\n' + JSON.stringify(payload, null, 2),
    stats,
    warn: [note, warn].filter(Boolean).join(' '),
    lang: 'json',
    claims: jwClaimRows(header, payload),
    token: { alg, kid: header.kid === undefined ? null : String(header.kid), input: parts[0] + '.' + parts[1], sig: parts[2],
      exp: typeof payload.exp === 'number' ? payload.exp : null, nbf: typeof payload.nbf === 'number' ? payload.nbf : null }
  };
}

/* ---------- keys: PEM, certificates, PKCS#1, JWK and JWKS ---------- */

const JW_ALGS = {
  HS256: { kind: 'hmac', hash: 'SHA-256' }, HS384: { kind: 'hmac', hash: 'SHA-384' }, HS512: { kind: 'hmac', hash: 'SHA-512' },
  RS256: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, RS384: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' }, RS512: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
  PS256: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-256', salt: 32 }, PS384: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-384', salt: 48 }, PS512: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-512', salt: 64 },
  ES256: { kind: 'ec', curve: 'P-256', hash: 'SHA-256', size: 64 }, ES384: { kind: 'ec', curve: 'P-384', hash: 'SHA-384', size: 96 }, ES512: { kind: 'ec', curve: 'P-521', hash: 'SHA-512', size: 132 },
  EdDSA: { kind: 'okp' }, Ed25519: { kind: 'okp' }
};

function jwDer(u8) {
  /* one TLV at offset o: { tag, start, end, next } */
  return function tlv(o) {
    const tag = u8[o];
    let len = u8[o + 1], p = o + 2;
    if (len & 0x80) {
      const n = len & 0x7f;
      if (n < 1 || n > 4) throw new Error('bad DER length');
      len = 0;
      for (let i = 0; i < n; i++) len = len * 256 + u8[p++];
    }
    if (p + len > u8.length) throw new Error('DER runs past the end');
    return { tag, start: p, end: p + len, head: o };
  };
}
function jwDerLen(n) {
  if (n < 128) return [n];
  const b = [];
  while (n) { b.unshift(n & 255); n = Math.floor(n / 256); }
  return [0x80 | b.length].concat(b);
}
/** subjectPublicKeyInfo out of an X.509 certificate (RFC 5280, 4.1). */
function jwCertSpki(der) {
  const tlv = jwDer(der);
  const cert = tlv(0);
  const tbs = tlv(cert.start);
  let p = tbs.start;
  let t = tlv(p);
  if (t.tag === 0xa0) { p = t.end; t = tlv(p); }        // [0] version
  for (let i = 0; i < 5; i++) { p = t.end; t = tlv(p); } // serial, signature, issuer, validity, subject → spki
  if (t.tag !== 0x30) throw new Error('no public key in this certificate');
  return der.slice(t.head, t.end);
}
/** An RSA PUBLIC KEY (PKCS#1) wrapped as SubjectPublicKeyInfo. */
function jwPkcs1Spki(pk) {
  const algId = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const bit = [0x03].concat(jwDerLen(pk.length + 1), [0x00], Array.from(pk));
  const body = algId.concat(bit);
  return Uint8Array.from([0x30].concat(jwDerLen(body.length), body));
}
function jwPem(text) {
  const m = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(text);
  if (!m) return null;
  const b = m[2].replace(/[^A-Za-z0-9+/=]/g, '');
  return { label: m[1], der: jwB64uBytes(b) };
}

/** What the key box holds, as a list of candidate keys: { format, data, kid?, kty, crv?, alg? }. */
function jwParseKey(text) {
  const t = String(text || '').trim();
  if (!t) return { error: 'Paste the public key first.' };
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t)) return { error: 'That is a private key. Verifying needs only the public key, and a private key should never be pasted into a web page: treat this one as exposed.' };
  const pem = jwPem(t);
  if (pem) {
    try {
      if (pem.label === 'PUBLIC KEY') return { keys: [{ format: 'spki', data: pem.der }] };
      if (pem.label === 'RSA PUBLIC KEY') return { keys: [{ format: 'spki', data: jwPkcs1Spki(pem.der), kty: 'RSA' }] };
      if (pem.label === 'CERTIFICATE') return { keys: [{ format: 'spki', data: jwCertSpki(pem.der), cert: true }] };
    } catch (e) { return { error: 'The ' + pem.label.toLowerCase() + ' could not be read: ' + e.message + '.' }; }
    return { error: 'A PEM block labelled "' + pem.label + '" is not a public key or certificate.' };
  }
  if (/^[{[]/.test(t)) {
    let j;
    try { j = JSON.parse(t); } catch (e) { return { error: 'The key looks like JSON but does not parse: ' + e.message }; }
    const list = Array.isArray(j) ? j : (j && Array.isArray(j.keys) ? j.keys : [j]);
    const keys = list.filter((k) => k && typeof k === 'object' && k.kty).map((k) => {
      if (k.d) return { error: true };
      return { format: 'jwk', data: k, kid: k.kid === undefined ? null : String(k.kid), kty: k.kty, crv: k.crv, alg: k.alg };
    });
    if (keys.some((k) => k.error)) return { error: 'This JWK holds a private key ("d"). Verifying needs only the public part; treat this key as exposed.' };
    if (!keys.length) return { error: 'No key in that JSON: a JWK needs "kty", a JWKS a "keys" list.' };
    return { keys, jwks: list.length > 1 || !!(j && j.keys) };
  }
  return { error: 'Paste a PEM public key (-----BEGIN PUBLIC KEY-----), an X.509 certificate, or a JWK or JWKS in JSON.' };
}

function jwSecretBytes(secret, enc) {
  const s = String(secret || '');
  if (enc === 'base64') return jwB64uBytes(s.replace(/\s+/g, ''));
  if (enc === 'hex') {
    const h = s.replace(/\s+/g, '');
    if (!/^([0-9a-f]{2})*$/i.test(h)) throw new Error('not hex');
    return Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16));
  }
  return jwUtf8(s);
}

function jwSubtle() {
  const c = typeof crypto !== 'undefined' ? crypto : null;
  return c && c.subtle ? c.subtle : null;
}

/**
 * Verify a token's signature. keyText is the secret (HS*) or a public key,
 * certificate, JWK or JWKS; opts.secretEnc is text | base64 | hex.
 * Resolves to { ok, text, alg, kid? } and never throws.
 */
async function jwtVerify(token, keyText, opts) {
  opts = opts || {};
  const subtle = jwSubtle();
  const fail = (text, extra) => Object.assign({ ok: false, text }, extra || {});
  const tok = String(token || '').trim().replace(/^bearer\s+/i, '').replace(/\s+/g, '');
  const parts = tok.split('.');
  if (parts.length !== 3) return fail('There is no three-part token to verify.');
  let header;
  try { header = JSON.parse(jwText(jwB64uBytes(parts[0]))); } catch (e) { return fail('The header does not decode.'); }
  const alg = String(header.alg || '');
  if (/^none$/i.test(alg)) return fail('This token is unsigned ("alg": "none"): there is no signature to verify, and a server must refuse it.', { alg });
  const a = JW_ALGS[alg];
  if (!a) return fail('The algorithm ' + (alg || '(none given)') + ' is not one this page can verify: HS256/384/512, RS256/384/512, PS256/384/512, ES256/384/512 and EdDSA are.', { alg });
  if (!subtle) return fail('This browser has no WebCrypto (crypto.subtle), which verifying needs. It is only available on https pages.', { alg });
  let sig;
  try { sig = jwB64uBytes(parts[2]); } catch (e) { return fail('The signature segment is not base64url.', { alg }); }
  const data = jwUtf8(parts[0] + '.' + parts[1]);
  const keyStr = String(keyText || '');
  if (!keyStr.trim()) return fail(a.kind === 'hmac' ? 'Type the secret to verify.' : 'Paste the public key to verify.', { alg });
  try {
    if (a.kind === 'hmac') {
      if (/-----BEGIN|"kty"/.test(keyStr)) {
        return fail('The header says ' + alg + ', which is signed with a shared secret, but this is a public key. Accepting a public key as an HMAC secret is the "algorithm confusion" attack: a server must fix the algorithm it expects, not take it from the token.', { alg });
      }
      let bytes;
      try { bytes = jwSecretBytes(keyStr, opts.secretEnc); } catch (e) { return fail('The secret is not valid ' + (opts.secretEnc === 'hex' ? 'hex' : 'Base64') + '.', { alg }); }
      const key = await subtle.importKey('raw', bytes, { name: 'HMAC', hash: a.hash }, false, ['verify']);
      const ok = await subtle.verify('HMAC', key, sig, data);
      const short = bytes.length * 8 < parseInt(a.hash.slice(4), 10);
      return { ok, alg, text: ok ? 'Signature verified: ' + alg + ' with this secret.' + (short ? ' The secret is shorter than ' + a.hash.slice(4) + ' bits, which RFC 7518 forbids for ' + alg + '.' : '')
        : 'Invalid signature: this secret did not produce it, or the token was changed.' };
    }
    const parsed = jwParseKey(keyStr);
    if (parsed.error) return fail(parsed.error, { alg });
    const ktyFor = { rsa: 'RSA', ec: 'EC', okp: 'OKP' }[a.kind];
    let cands = parsed.keys.filter((k) => !k.kty || k.kty === ktyFor);
    if (a.kind === 'ec') cands = cands.filter((k) => !k.crv || k.crv === a.curve);
    if (header.kid !== undefined && parsed.jwks) {
      const byKid = cands.filter((k) => k.kid === String(header.kid));
      if (!byKid.length) return fail('No key in this JWKS has the kid "' + header.kid + '" that the token names (' + parsed.keys.map((k) => k.kid).filter(Boolean).join(', ') + ').', { alg });
      cands = byKid;
    }
    if (cands.some((k) => k.alg)) { const same = cands.filter((k) => !k.alg || k.alg === alg); if (same.length) cands = same; }
    if (!cands.length) return fail('None of these keys suits ' + alg + ' (' + ktyFor + (a.curve ? ' ' + a.curve : '') + ' needed).', { alg });
    if (a.kind === 'ec' && sig.length !== a.size) return fail('An ' + alg + ' signature is ' + a.size + ' bytes (r and s side by side); this one is ' + sig.length + '. A DER-encoded signature is not valid in a JWT.', { alg });
    let lastErr = null;
    for (const k of cands) {
      let imp, vp;
      if (a.kind === 'rsa') { imp = { name: a.name, hash: a.hash }; vp = a.name === 'RSA-PSS' ? { name: 'RSA-PSS', saltLength: a.salt } : { name: a.name }; }
      else if (a.kind === 'ec') { imp = { name: 'ECDSA', namedCurve: a.curve }; vp = { name: 'ECDSA', hash: a.hash }; }
      else { imp = { name: 'Ed25519' }; vp = { name: 'Ed25519' }; }
      let key;
      try {
        const data2 = k.format === 'jwk' ? Object.assign({}, k.data, { alg: undefined, use: undefined, key_ops: undefined }) : k.data;
        key = await subtle.importKey(k.format, data2, imp, false, ['verify']);
      } catch (e) {
        lastErr = a.kind === 'okp' && /Unrecognized|not supported|NotSupported/i.test(String(e && (e.name + e.message)))
          ? 'This browser cannot verify EdDSA (Ed25519) yet.' : 'The key does not suit ' + alg + ': ' + ((e && e.message) || 'import failed') + '.';
        continue;
      }
      if (await subtle.verify(vp, key, sig, data)) {
        return { ok: true, alg, kid: k.kid || null, text: 'Signature verified: ' + alg + (k.kid ? ' with key "' + k.kid + '"' : k.cert ? ' with the certificate’s key' : ' with this public key') + '.' };
      }
      lastErr = null;
    }
    return fail(lastErr || ('Invalid signature: ' + (cands.length > 1 ? 'none of the ' + cands.length + ' keys made it' : 'this key did not make it') + ', or the token was changed.'), { alg });
  } catch (e) {
    return fail('Could not verify: ' + ((e && e.message) || 'unknown error') + '.', { alg });
  }
}

/** Sign a header and payload with an HMAC secret: resolves to the token. */
async function jwtSign(alg, payload, secret, secretEnc, extraHeader) {
  const a = JW_ALGS[alg];
  if (!a || a.kind !== 'hmac') throw new Error('Only HS256, HS384 and HS512 can be signed here.');
  const subtle = jwSubtle();
  if (!subtle) throw new Error('This browser has no WebCrypto (crypto.subtle), which signing needs.');
  const header = Object.assign({ alg, typ: 'JWT' }, extraHeader || {});
  const input = jwBytesB64u(jwUtf8(JSON.stringify(header))) + '.' + jwBytesB64u(jwUtf8(typeof payload === 'string' ? payload : JSON.stringify(payload)));
  const key = await subtle.importKey('raw', jwSecretBytes(secret, secretEnc), { name: 'HMAC', hash: a.hash }, false, ['sign']);
  const sig = new Uint8Array(await subtle.sign('HMAC', key, jwUtf8(input)));
  return input + '.' + jwBytesB64u(sig);
}

window.DEV_TOOLS["jwt-decoder"] = {
"title": "JWT Decoder",
"category": "developer",
"icon": "🎫",
"kind": "code",
"autosave": false,
"share": [],
"shareText": false,
"description": "Decode a JSON Web Token, verify its signature with a secret, public key or JWKS, watch its expiry count down, and sign a test token. Runs entirely in your browser.",
"keywords": ["jwt decoder","decode jwt","verify jwt","jwt signature","jwks","json web token","jwt viewer","jwt payload","jwt encoder"],
"inputLabel": "JWT",
"outputLabel": "Decoded token",
"placeholder": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.signature",
"sample": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEwNDIiLCJuYW1lIjoiVGVzdCBVc2VyIiwicm9sZSI6ImVkaXRvciIsImlhdCI6MTc5MDAwMDAwMCwiZXhwIjoxNzkwMDAzNjAwfQ.bm90LWEtcmVhbC1zaWduYXR1cmUtanVzdC1hLWRlbW8",
"highlight": "json",
"download": {"ext": "txt", "type": "text/plain"},
"filename": "jwt-decoded.txt",
"options": [],
"transform": jwTransform,
"mount": function (ctx) { jwMount(ctx); },
"render": function (res, ctx) { jwRender(res, ctx); },
"tips": [
  "A JWT is signed, not encrypted. Anyone holding the token can read the payload, so never put secrets in it.",
  "iat, exp and nbf are seconds since 1970 UTC, not milliseconds — a common off-by-1000 bug. The claims table flags a time that looks like milliseconds.",
  "Verify with the secret (HS256, HS384, HS512) or with a public key: PEM, an X.509 certificate, a JWK or a whole JWKS, where the key is picked by the token's kid.",
  "Secrets, keys and the token are never saved on this device and never put in a share link. Even so, test with a test key: a production secret pasted anywhere should be rotated.",
  "A server must decide which algorithm it accepts. Taking alg from the token lets an attacker send alg none, or sign HS256 with your public key; this page refuses both."
],
"faq": [
  {"q":"Is it safe to paste a real token here?","a":"Decoding and verifying happen entirely in your browser and nothing is transmitted or stored. That said, a live token is a live credential — prefer an expired or test token, and rotate anything you paste into any online tool."},
  {"q":"Can I verify a token from Auth0, Cognito or Entra ID?","a":"Yes. Open the issuer's JWKS address (usually ending /.well-known/jwks.json) in another tab, copy the JSON and paste it under Verify the signature. The key whose kid matches the token's header is used."}
]
};
window.DEV_TOOLS["jwt-decoder"].verify = jwtVerify;
window.DEV_TOOLS["jwt-decoder"].sign = jwtSign;
window.DEV_TOOLS["jwt-decoder"]._status = jwStatus;
window.DEV_TOOLS["jwt-decoder"]._parseKey = jwParseKey;

/* ---------- the page: verify, live expiry, claims table, encoder ---------- */

function jwMount(ctx) {
  const el = ctx.el;
  const st = { res: null, timer: 0, vtimer: 0, vseq: 0 };
  ctx.jw = st;
  const wrap = el('div', 'jw-wrap');

  /* the live status */
  const clock = el('div', 'jw-clock');
  clock.setAttribute('role', 'status');
  clock.hidden = true;
  ctx.outputPane.insertBefore(clock, ctx.output);
  st.clock = clock;

  /* Verify */
  const ver = el('section', 'jw-panel jw-verify');
  ver.setAttribute('aria-labelledby', 'jw-ver-h');
  const vh = el('h2', 'jw-h', 'Verify the signature');
  vh.id = 'jw-ver-h';
  ver.appendChild(vh);
  const vAlg = el('p', 'jw-sub', 'Paste a token to verify it.');
  ver.appendChild(vAlg);
  const kLab = el('label', 'jw-label', 'Secret');
  kLab.setAttribute('for', 'jw-key');
  const key = el('textarea', 'control jw-key');
  key.id = 'jw-key';
  key.rows = 3;
  key.spellcheck = false;
  key.setAttribute('autocomplete', 'off');
  key.setAttribute('autocapitalize', 'off');
  key.setAttribute('data-lpignore', 'true');
  const encWrap = el('div', 'jw-row');
  const encLab = el('label', 'jw-label', 'Secret is');
  encLab.setAttribute('for', 'jw-enc');
  const enc = el('select', 'control jw-enc');
  enc.id = 'jw-enc';
  [['text', 'Text (UTF-8)'], ['base64', 'Base64 or base64url'], ['hex', 'Hex']].forEach((o) => { const op = el('option', null, o[1]); op.value = o[0]; enc.appendChild(op); });
  encWrap.appendChild(encLab);
  encWrap.appendChild(enc);
  const verdict = el('div', 'jw-verdict');
  verdict.setAttribute('role', 'status');
  verdict.setAttribute('aria-live', 'polite');
  ver.appendChild(kLab);
  ver.appendChild(key);
  ver.appendChild(encWrap);
  ver.appendChild(verdict);
  ver.appendChild(el('p', 'jw-fine', 'The secret or key stays in this box: it is not saved on this device and never goes into a share link.'));
  st.ver = { alg: vAlg, label: kLab, key, enc, encWrap, verdict };

  /* the claims table */
  const cl = el('section', 'jw-panel jw-claims');
  cl.setAttribute('aria-labelledby', 'jw-cl-h');
  const ch = el('h2', 'jw-h', 'What the claims mean');
  ch.id = 'jw-cl-h';
  cl.appendChild(ch);
  const tableWrap = el('div', 'jw-table-wrap');
  cl.appendChild(tableWrap);
  st.table = tableWrap;
  cl.hidden = true;
  st.claimsPanel = cl;

  /* the encoder */
  const encd = el('details', 'jw-panel jw-encoder');
  const sum = el('summary', 'jw-h', 'Make a signed test token (HS256, HS384, HS512)');
  encd.appendChild(sum);
  const eRow = el('div', 'jw-row');
  const aLab = el('label', 'jw-label', 'Algorithm');
  aLab.setAttribute('for', 'jw-e-alg');
  const eAlg = el('select', 'control');
  eAlg.id = 'jw-e-alg';
  ['HS256', 'HS384', 'HS512'].forEach((x) => { const op = el('option', null, x); op.value = x; eAlg.appendChild(op); });
  eRow.appendChild(aLab);
  eRow.appendChild(eAlg);
  encd.appendChild(eRow);
  const pLab = el('label', 'jw-label', 'Payload (JSON)');
  pLab.setAttribute('for', 'jw-e-pay');
  const pay = el('textarea', 'control jw-pay');
  pay.id = 'jw-e-pay';
  pay.rows = 6;
  pay.spellcheck = false;
  pay.value = '{\n  "sub": "user_1042",\n  "name": "Test User",\n  "role": "editor"\n}';
  encd.appendChild(pLab);
  encd.appendChild(pay);
  const quick = el('div', 'jw-actions');
  const bIat = el('button', 'btn-ghost', 'Set iat to now');
  bIat.type = 'button';
  const bExp = el('button', 'btn-ghost', 'exp in 1 hour');
  bExp.type = 'button';
  quick.appendChild(bIat);
  quick.appendChild(bExp);
  encd.appendChild(quick);
  const sLab = el('label', 'jw-label', 'Secret');
  sLab.setAttribute('for', 'jw-e-sec');
  const sec = el('input', 'control');
  sec.id = 'jw-e-sec';
  sec.type = 'text';
  sec.spellcheck = false;
  sec.setAttribute('autocomplete', 'off');
  sec.setAttribute('data-lpignore', 'true');
  encd.appendChild(sLab);
  encd.appendChild(sec);
  const eEncRow = el('div', 'jw-row');
  const eEncLab = el('label', 'jw-label', 'Secret is');
  eEncLab.setAttribute('for', 'jw-e-enc');
  const eEnc = enc.cloneNode(true);
  eEnc.id = 'jw-e-enc';
  eEncRow.appendChild(eEncLab);
  eEncRow.appendChild(eEnc);
  encd.appendChild(eEncRow);
  const acts = el('div', 'jw-actions');
  const signB = el('button', 'btn-primary', 'Sign');
  signB.type = 'button';
  acts.appendChild(signB);
  encd.appendChild(acts);
  const eMsg = el('div', 'jw-verdict');
  eMsg.setAttribute('role', 'status');
  encd.appendChild(eMsg);
  const outLab = el('label', 'jw-label', 'Signed token');
  outLab.setAttribute('for', 'jw-e-out');
  const eOut = el('textarea', 'control jw-out');
  eOut.id = 'jw-e-out';
  eOut.rows = 4;
  eOut.readOnly = true;
  eOut.spellcheck = false;
  const outActs = el('div', 'jw-actions');
  const copyB = el('button', 'btn-copy', 'Copy token');
  copyB.type = 'button';
  const useB = el('button', 'btn-ghost', 'Decode it above');
  useB.type = 'button';
  outActs.appendChild(copyB);
  outActs.appendChild(useB);
  const outBox = el('div', 'jw-outbox');
  outBox.hidden = true;
  outBox.appendChild(outLab);
  outBox.appendChild(eOut);
  outBox.appendChild(outActs);
  encd.appendChild(outBox);

  wrap.appendChild(cl);
  wrap.appendChild(ver);
  wrap.appendChild(encd);
  ctx.extra.appendChild(wrap);

  /* encoder actions */
  const editPayload = (fn) => {
    let o;
    try { o = JSON.parse(pay.value || '{}'); } catch (e) { eMsg.className = 'jw-verdict is-bad'; eMsg.textContent = 'The payload is not valid JSON: ' + e.message; return; }
    fn(o);
    pay.value = JSON.stringify(o, null, 2);
    eMsg.textContent = ''; eMsg.className = 'jw-verdict';
  };
  bIat.addEventListener('click', () => editPayload((o) => { o.iat = Math.floor(Date.now() / 1000); }));
  bExp.addEventListener('click', () => editPayload((o) => { o.exp = Math.floor(Date.now() / 1000) + 3600; }));
  signB.addEventListener('click', function () {
    let payload;
    try { payload = JSON.parse(pay.value); } catch (e) { eMsg.className = 'jw-verdict is-bad'; eMsg.textContent = 'The payload is not valid JSON: ' + e.message; return; }
    if (!sec.value) { eMsg.className = 'jw-verdict is-bad'; eMsg.textContent = 'Type a secret to sign with.'; sec.focus(); return; }
    jwtSign(eAlg.value, payload, sec.value, eEnc.value).then(function (t) {
      eOut.value = t;
      outBox.hidden = false;
      eMsg.className = 'jw-verdict is-ok';
      eMsg.textContent = 'Signed with ' + eAlg.value + '. The secret is not part of the token and was not kept.';
    }, function (e) {
      eMsg.className = 'jw-verdict is-bad';
      eMsg.textContent = (e && e.message) || 'Could not sign.';
    });
  });
  copyB.addEventListener('click', () => ctx.copyText(eOut.value, copyB));
  useB.addEventListener('click', function () {
    ctx.setText(eOut.value);
    if (/^HS/.test(eAlg.value)) { key.value = sec.value; enc.value = eEnc.value; }
    verifyNow();
    ctx.input.focus();
  });

  /* verify as the key is typed */
  function verifyNow() {
    clearTimeout(st.vtimer);
    const r = st.res;
    const v = st.ver;
    if (!r || !r.token) { v.verdict.textContent = ''; v.verdict.className = 'jw-verdict'; return; }
    const my = ++st.vseq;
    if (!v.key.value.trim()) {
      v.verdict.className = 'jw-verdict';
      v.verdict.textContent = /^none$/i.test(r.token.alg) ? 'This token is unsigned: there is nothing to verify, and a server must refuse it.' : 'Not verified yet.';
      return;
    }
    v.verdict.className = 'jw-verdict';
    v.verdict.textContent = 'Checking…';
    jwtVerify(ctx.text, v.key.value, { secretEnc: v.enc.value }).then(function (out) {
      if (my !== st.vseq) return;
      v.verdict.className = 'jw-verdict ' + (out.ok ? 'is-ok' : 'is-bad');
      v.verdict.textContent = (out.ok ? '✓ ' : '✗ ') + out.text;
    });
  }
  st.verifyNow = verifyNow;
  key.addEventListener('input', function () { clearTimeout(st.vtimer); st.vtimer = setTimeout(verifyNow, 250); });
  enc.addEventListener('change', verifyNow);
}

function jwRender(res, ctx) {
  const st = ctx.jw;
  if (!st) return;
  st.res = res && res.token ? res : null;
  const t = st.res && st.res.token;
  /* the live countdown */
  clearInterval(st.timer);
  const tick = function () {
    const s = jwStatus(t.exp, t.nbf, Date.now() / 1000);
    st.clock.textContent = s.text;
    st.clock.className = 'jw-clock is-' + s.state;
  };
  if (t) { st.clock.hidden = false; tick(); st.timer = setInterval(tick, 1000); }
  else st.clock.hidden = true;
  /* the verify panel follows the algorithm */
  const v = st.ver;
  const alg = t ? t.alg : '';
  const a = JW_ALGS[alg];
  const hmac = !a || a.kind === 'hmac';
  v.label.textContent = hmac ? 'Secret' : 'Public key: PEM, certificate, JWK or JWKS';
  v.encWrap.hidden = !hmac;
  v.key.placeholder = hmac ? 'The shared secret the token was signed with' : '-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----   or   {"keys": [ … ]}';
  v.alg.textContent = !t ? 'Paste a token to verify it.'
    : /^none$/i.test(alg) ? 'The header says "alg": "none": the token carries no signature.'
    : !a ? 'The header names ' + (alg || 'no algorithm') + ', which this page cannot verify.'
    : 'The header says ' + alg + (t.kid ? ', key ID "' + t.kid + '"' : '') + '. ' + (hmac ? 'Type the secret it was signed with.' : 'Paste the issuer’s public key.');
  st.verifyNow();
  /* the claims table */
  const rows = (res && res.claims) || [];
  st.table.textContent = '';
  st.claimsPanel.hidden = !rows.length;
  if (rows.length) {
    const table = ctx.el('table', 'jw-table');
    const thead = ctx.el('thead');
    const hr = ctx.el('tr');
    ['Claim', 'Value', 'What it means'].forEach((h) => { const th = ctx.el('th', null, h); th.scope = 'col'; hr.appendChild(th); });
    thead.appendChild(hr);
    table.appendChild(thead);
    const tb = ctx.el('tbody');
    rows.forEach((r) => {
      const tr = ctx.el('tr');
      const th = ctx.el('th', null, r.key);
      th.scope = 'row';
      if (r.part === 'header') th.appendChild(ctx.el('span', 'jw-part', ' header'));
      tr.appendChild(th);
      tr.appendChild(ctx.el('td', 'jw-val', r.value));
      const td = ctx.el('td', null, r.meaning);
      if (r.time !== undefined) {
        const d = new Date(r.time * 1000);
        if (isFinite(d.getTime())) {
          let local = '';
          try { local = d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' }); } catch (e) { local = d.toString(); }
          td.appendChild(ctx.el('span', 'jw-local', ' Your time: ' + local + '.'));
        }
      }
      tr.appendChild(td);
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    st.table.appendChild(table);
  }
}
})();
