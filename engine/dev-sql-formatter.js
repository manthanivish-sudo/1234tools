(function () {
'use strict';
/* SQL formatter and minifier, this site's own code. The text is cut into
   tokens by a tokenizer that knows each dialect's strings, quoted names and
   comments; formatting and minifying only change the white space between
   tokens (and, if asked, the case of reserved words), so the statement
   means what it meant. */

window.DEV_TOOLS = window.DEV_TOOLS || {};

const DIALECTS = {
  generic: { backtick: true, dollar: true, hash: false, bracket: false, backslash: false, nested: false, dq: 'ident', estring: true },
  postgresql: { backtick: false, dollar: true, hash: false, bracket: false, backslash: false, nested: true, dq: 'ident', estring: true },
  mysql: { backtick: true, dollar: false, hash: true, bracket: false, backslash: true, nested: false, dq: 'string' },
  sqlite: { backtick: true, dollar: false, hash: false, bracket: true, backslash: false, nested: false, dq: 'ident' },
  tsql: { backtick: false, dollar: false, hash: false, bracket: true, backslash: false, nested: true, dq: 'ident' },
  oracle: { backtick: false, dollar: false, hash: false, bracket: false, backslash: false, nested: false, dq: 'ident', qquote: true }
};

/* reserved words: their case may change, as no unquoted name can be one */
const RESERVED = new Set(('ADD ALL ALTER AND ANY AS ASC BEGIN BETWEEN BY CASCADE CASE CAST CHECK COLUMN COMMIT CONSTRAINT CREATE CROSS CURRENT_DATE ' +
  'CURRENT_TIME CURRENT_TIMESTAMP DATABASE DECLARE DEFAULT DELETE DESC DISTINCT DROP ELSE END ESCAPE EXCEPT EXISTS EXPLAIN FALSE FETCH FIRST FOR FOREIGN ' +
  'FROM FULL GRANT GROUP HAVING IF IGNORE ILIKE IN INDEX INNER INSERT INTERSECT INTERVAL INTO IS JOIN KEY LATERAL LEFT LIKE LIMIT NATURAL NEXT NOT NULL ' +
  'OFFSET ON ONLY OR ORDER OUTER OVER PARTITION PRIMARY PROCEDURE REFERENCES REPLACE RETURNING RIGHT ROLLBACK ROW ROWS SELECT SET TABLE THEN TO TOP TRUE ' +
  'TRUNCATE UNION UNIQUE UPDATE USING VALUES VIEW WHEN WHERE WINDOW WITH RECURSIVE CONFLICT DO NOTHING NULLS SOME TRANSACTION TRIGGER ' +
  'COUNT SUM AVG MIN MAX COALESCE NULLIF EXTRACT UPPER LOWER SUBSTRING TRIM ROUND ROW_NUMBER RANK DENSE_RANK').split(' '));
/* words that start a clause on a new line, longest first */
const CLAUSES = [
  'INSERT INTO', 'INSERT IGNORE INTO', 'REPLACE INTO', 'DELETE FROM', 'GROUP BY', 'ORDER BY', 'PARTITION BY', 'UNION ALL', 'UNION', 'INTERSECT', 'EXCEPT',
  'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'INNER JOIN', 'CROSS JOIN', 'NATURAL JOIN', 'JOIN',
  'ON CONFLICT', 'ON DUPLICATE KEY UPDATE', 'SELECT', 'FROM', 'WHERE', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH', 'VALUES', 'UPDATE', 'SET', 'RETURNING', 'WITH', 'WINDOW',
  'CREATE TABLE', 'CREATE VIEW', 'CREATE INDEX', 'CREATE UNIQUE INDEX', 'ALTER TABLE', 'DROP TABLE', 'TRUNCATE TABLE', 'DO UPDATE SET', 'DO NOTHING'
].map((c) => c.split(' '));
const LIST_CLAUSES = new Set(['SELECT', 'GROUP BY', 'ORDER BY', 'SET', 'RETURNING', 'PARTITION BY', 'DO UPDATE SET', 'ON DUPLICATE KEY UPDATE']);
const COND_CLAUSES = new Set(['WHERE', 'HAVING']);

/* ---------------- the tokenizer ---------------- */
function tokenize(src, dialect) {
  const D = DIALECTS[dialect] || DIALECTS.generic;
  const s = String(src);
  const out = [];
  let i = 0;
  const n = s.length;
  const err = (m, at) => { const before = s.slice(0, at); const e = new Error(m + ' (line ' + before.split('\n').length + ', column ' + (at - before.lastIndexOf('\n')) + ')'); e.at = at; return e; };
  const push = (type, start, end) => out.push({ type: type, text: s.slice(start, end), at: start });
  const quoted = (start, q, backslash, type) => {
    let j = start + 1;
    for (;;) {
      if (j >= n) throw err('this ' + (type === 'string' ? 'string' : 'quoted name') + ' is never closed', start);
      const c = s[j];
      if (backslash && c === '\\') { j += 2; continue; }
      if (c === q) { if (s[j + 1] === q) { j += 2; continue; } j++; break; }
      j++;
    }
    push(type, start, j); return j;
  };
  while (i < n) {
    const c = s[i], c2 = s.slice(i, i + 2);
    if (/\s/.test(c)) { let j = i + 1; while (j < n && /\s/.test(s[j])) j++; push('ws', i, j); i = j; continue; }
    if (c2 === '--' || (D.hash && c === '#')) { let j = s.indexOf('\n', i); if (j < 0) j = n; push('line', i, j); i = j; continue; }
    if (c2 === '/*') {
      let j = i + 2, depth = 1;
      while (j < n && depth) {
        if (s.startsWith('*/', j)) { depth--; j += 2; continue; }
        if (D.nested && s.startsWith('/*', j)) { depth++; j += 2; continue; }
        j++;
      }
      if (depth) throw err('this /* comment is never closed', i);
      push('block', i, j); i = j; continue;
    }
    if (c === "'") { i = quoted(i, "'", D.backslash, 'string'); continue; }
    if (/^[nNxXbB]'/.test(c2) || (D.estring && /^[eE]'/.test(c2))) {
      const start = i; const j = quoted(i + 1, "'", D.backslash || /[eE]/.test(c), 'string'); out[out.length - 1].text = s.slice(start, j); out[out.length - 1].at = start; i = j; continue;
    }
    if (D.qquote && /^[qQ]'/.test(c2)) {
      const open = s[i + 2], close = { '[': ']', '{': '}', '(': ')', '<': '>' }[open] || open;
      const j = s.indexOf(close + "'", i + 3);
      if (j < 0) throw err('this q\'…\' string is never closed', i);
      push('string', i, j + 2); i = j + 2; continue;
    }
    if (c === '"') { i = quoted(i, '"', D.dq === 'string' && D.backslash, D.dq === 'string' ? 'string' : 'ident'); continue; }
    if (c === '`' && D.backtick) { i = quoted(i, '`', false, 'ident'); continue; }
    if (c === '[' && D.bracket) { const j = s.indexOf(']', i); if (j < 0) throw err('this [name] is never closed', i); push('ident', i, j + 1); i = j + 1; continue; }
    if (c === '$' && D.dollar) {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(s.slice(i, i + 64));
      if (m) { const j = s.indexOf(m[0], i + m[0].length); if (j < 0) throw err('this ' + m[0] + ' quoted text is never closed', i); push('string', i, j + m[0].length); i = j + m[0].length; continue; }
      const p = /^\$\d+/.exec(s.slice(i, i + 12));
      if (p) { push('param', i, i + p[0].length); i += p[0].length; continue; }
    }
    let m;
    const rest = s.slice(i, i + 256);
    if ((m = /^(0x[0-9a-fA-F]+|(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?)/.exec(rest)) && !(c === '.' && out.length && /^(word|ident)$/.test(lastSig(out).type) && !/\s$/.test(out[out.length - 1].text))) {
      push('number', i, i + m[0].length); i += m[0].length; continue;
    }
    if ((m = /^[A-Za-z_À-￿][\w$À-￿]*/.exec(rest))) { push('word', i, i + m[0].length); i += m[0].length; continue; }
    if ((m = /^(@@?[A-Za-z_][\w$]*|:[A-Za-z_][\w]*|\?\d*)/.exec(rest)) && !(c === ':' && s[i + 1] === ':')) { push('param', i, i + m[0].length); i += m[0].length; continue; }
    if ((m = /^(->>|#>>|::|->|#>|@>|<@|<>|!=|<=|>=|\|\||:=|==|<<|>>|&&|\*\*|!~\*?|~\*)/.exec(rest))) { push('op', i, i + m[0].length); i += m[0].length; continue; }
    if ('(),;.'.indexOf(c) >= 0) { push(c, i, i + 1); i++; continue; }
    push('op', i, i + 1); i++;
  }
  return out;
}
function lastSig(toks) { for (let k = toks.length - 1; k >= 0; k--) if (toks[k].type !== 'ws') return toks[k]; return { type: '' }; }

const upper = (t) => t.text.toUpperCase();
const isWord = (t, w) => t && t.type === 'word' && t.text.toUpperCase() === w;

/* ---------------- formatting ---------------- */
function format(src, o) {
  const all = tokenize(src, o.dialect);
  const toks = all.filter((t) => t.type !== 'ws');
  /* a line comment keeps its own line; remember which comments stood alone */
  all.forEach((t, k) => { if (t.type === 'line' || t.type === 'block') { const prev = all[k - 1]; t.own = !prev || (prev.type === 'ws' && /\n/.test(prev.text)) ; } });
  const IND = o.indent === 'tab' ? '\t' : ' '.repeat(Number(o.indent) || 2);
  const kcase = (t) => {
    if (t.type !== 'word' || !RESERVED.has(t.text.toUpperCase())) return t.text;
    return o.case === 'upper' ? t.text.toUpperCase() : o.case === 'lower' ? t.text.toLowerCase() : t.text;
  };
  const lines = [];
  let line = '', level = 0;
  const stack = [];          // paren frames: { kind: 'sub'|'list'|'inline', level, clause }
  let clause = null;          // the clause we are in at this paren level
  let caseDepth = [];
  const nl = (lvl) => { if (line.trim()) lines.push(line.replace(/\s+$/, '')); line = IND.repeat(Math.max(0, lvl)); };
  const add = (text, space) => {
    if (space && line.trim() && !/[ \t]$/.test(line)) line += ' ';
    line += text;
  };
  const lineLevel = () => { const m = /^[ \t]*/.exec(line)[0]; return IND === '\t' ? m.length : Math.floor(m.length / IND.length); };
  let prev = null;
  const needSpace = (p, t) => {
    if (!p) return false;
    if (t.type === ',' || t.type === ';' || t.type === ')' || t.type === '.') return false;
    if (p.type === '(' || p.type === '.') return false;
    if (t.type === 'op' && (t.text === '::' || t.text === '[' || t.text === ']')) return false;
    if (p.type === 'op' && p.text === '[') return false;
    if (t.type === '(' && /^(INSERT INTO|CREATE TABLE|INSERT IGNORE INTO|REPLACE INTO)$/.test(clause || '') && /^(word|ident)$/.test(p.type) && !RESERVED.has(p.text.toUpperCase())) return true;
    if (p.type === 'op' && p.text === '::') return false;
    if (t.type === '(' && (p.type === 'word' && !CLAUSE_WORD.has(p.text.toUpperCase()) && !/^(AND|OR|NOT|IN|EXISTS|AS|ON|USING|VALUES|INTO|OVER|FILTER|WITHIN|ANY|ALL|SOME|THEN|ELSE|WHEN|IS|LIKE|BETWEEN|RETURNING|TABLE|KEY|REFERENCES|CHECK|UNIQUE|DEFAULT)$/i.test(p.text) || p.type === 'ident')) return false;
    if (p.unary) return false;
    return true;
  };
  const matchClause = (k) => {
    for (const words of CLAUSES) {
      let ok = true;
      for (let w = 0; w < words.length; w++) if (!isWord(toks[k + w], words[w])) { ok = false; break; }
      if (ok) return words;
    }
    return null;
  };
  let afterClause = false;
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.type === 'line') {
      if (t.own) nl(level + (clause && !afterClause ? 1 : 0)); else if (line.trim()) line += ' ';
      line += t.text; nl(level + (clause ? 1 : 0)); prev = t; continue;
    }
    if (t.type === 'block') {
      if (t.own && line.trim()) nl(level);
      add(t.text, true); if (t.own && /\n/.test(t.text)) nl(level); prev = t; continue;
    }
    if (t.type === ';') {
      line += ';'; nl(0); lines.push(''); level = 0; stack.length = 0; clause = null; caseDepth = []; prev = null; continue;
    }
    const cw = t.type === 'word' ? matchClause(k) : null;
    /* JOIN … ON stays on the join's line; a clause inside parentheses that are a subquery starts its own line */
    if (cw && !(cw[0] === 'SET' && clause === 'UPDATE' && false)) {
      const name = cw.join(' ');
      const inInline = stack.length && stack[stack.length - 1].kind === 'inline';
      const isOnConflictSet = name === 'SET' && /CONFLICT|DUPLICATE/.test(clause || '');
      if (!inInline && !(name === 'WITH' && prev && prev.type !== ';' && prev !== null && clause) && !(name === 'SET' && isOnConflictSet)) {
        nl(level);
        cw.forEach((w, x) => { add(kcase(toks[k + x]), x > 0); });
        k += cw.length - 1;
        clause = name;
        afterClause = true;
        if (LIST_CLAUSES.has(name) || COND_CLAUSES.has(name) || name === 'FROM' || name === 'VALUES' || name === 'WITH' || name === 'UPDATE' || name === 'INSERT INTO' || name === 'LIMIT') {
          /* the clause's contents start on the next line, indented */
          if (name !== 'LIMIT' && name !== 'UPDATE' && name !== 'INSERT INTO' && name !== 'FROM') nl(level + 1);
        }
        prev = toks[k];
        continue;
      }
    }
    if (t.type === '(') {
      /* what kind of parentheses: a subquery, a column list, or inline */
      const nx = toks[k + 1];
      const sub = nx && (isWord(nx, 'SELECT') || isWord(nx, 'WITH') || isWord(nx, 'VALUES'));
      const list = !sub && (clause === 'CREATE TABLE' && stack.length === 0 && /^(word|ident)$/.test(prev && prev.type));
      add('(', needSpace(prev, t));
      const base = lineLevel();
      stack.push({ kind: sub ? 'sub' : list ? 'list' : 'inline', level: level, base: base, clause: clause, after: afterClause });
      if (sub || list) { level = base + 1; clause = null; nl(level); }
      prev = t; afterClause = false; continue;
    }
    if (t.type === ')') {
      const f = stack.pop();
      if (f && (f.kind === 'sub' || f.kind === 'list')) { nl(f.base); level = f.level; }
      if (f) { clause = f.clause; afterClause = false; }
      line += ')'; prev = t; continue;
    }
    if (t.type === ',') {
      line += ',';
      const top = stack.length ? stack[stack.length - 1] : null;
      if (top && top.kind === 'list') nl(level);
      else if (!top || top.kind === 'sub' ? true : false) {
        if (clause && (LIST_CLAUSES.has(clause) || clause === 'WITH' || clause === 'FROM')) nl(level + 1);
        else if (clause === 'VALUES') nl(level + 1);
      }
      prev = t; continue;
    }
    if (t.type === 'word') {
      const W = t.text.toUpperCase();
      if ((W === 'AND' || W === 'OR') && (!stack.length || stack[stack.length - 1].kind !== 'inline') && !(W === 'AND' && betweenOpen(toks, k))) {
        if (clause && (COND_CLAUSES.has(clause) || /JOIN/.test(clause))) { nl(level + 1); add(kcase(t), false); prev = t; continue; }
      }
      if (W === 'CASE') { caseDepth.push(level); add(kcase(t), needSpace(prev, t)); prev = t; continue; }
      if ((W === 'WHEN' || W === 'ELSE') && caseDepth.length) { nl(caseDepth[caseDepth.length - 1] + 2 + (clause ? 0 : 0)); add(kcase(t), false); prev = t; continue; }
      if (W === 'END' && caseDepth.length) { nl(caseDepth.pop() + 1 + (clause ? 0 : 0)); add(kcase(t), false); prev = t; continue; }
      if (W === 'ON' && clause && /JOIN/.test(clause)) { add(kcase(t), true); prev = t; continue; }
    }
    /* unary minus or plus: no space after it */
    if (t.type === 'op' && (t.text === '-' || t.text === '+') && (!prev || /^(op|\(|,)$/.test(prev.type) || (prev.type === 'word' && RESERVED.has(prev.text.toUpperCase()) && !/^(END|NULL|TRUE|FALSE)$/i.test(prev.text)))) {
      add(t.text, needSpace(prev, t)); prev = Object.assign({}, t, { unary: true }); continue;
    }
    add(kcase(t), needSpace(prev, t));
    prev = t;
    afterClause = false;
  }
  if (line.trim()) lines.push(line.replace(/\s+$/, ''));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}
const CLAUSE_WORD = new Set(['SELECT', 'FROM', 'WHERE', 'HAVING', 'VALUES', 'SET', 'ON', 'JOIN', 'USING', 'IN', 'EXISTS', 'AS', 'WITH', 'RETURNING', 'INTO']);
function betweenOpen(toks, k) {
  /* is this AND the one inside BETWEEN … AND …? */
  for (let j = k - 1; j >= 0 && j > k - 8; j--) {
    if (isWord(toks[j], 'BETWEEN')) return true;
    if (isWord(toks[j], 'AND') || isWord(toks[j], 'OR') || toks[j].type === ',' || toks[j].type === '(') return false;
  }
  return false;
}

/* ---------------- minifying ---------------- */
function minify(src, o) {
  const toks = tokenize(src, o.dialect).filter((t) => t.type !== 'ws' && (o.comments === 'keep' || (t.type !== 'line' && t.type !== 'block') || /^\/\*!/.test(t.text)));
  let out = '';
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    const text = o.case === 'upper' && t.type === 'word' && RESERVED.has(t.text.toUpperCase()) ? t.text.toUpperCase() : o.case === 'lower' && t.type === 'word' && RESERVED.has(t.text.toUpperCase()) ? t.text.toLowerCase() : t.text;
    if (k && needsGap(toks[k - 1], t, o.dialect)) out += toks[k - 1].type === 'line' ? '\n' : ' ';
    else if (k && toks[k - 1].type === 'line') out += '\n';
    out += text;
    if (t.type === ';' && k < toks.length - 1) out += '\n';
  }
  return out;
}
/** would the two tokens, written together, be read as something else? */
function needsGap(a, b, dialect) {
  if (a.type === 'line') return true;
  if (a.type === ';' || b.type === ';') return false;
  if (/[\w$@#'"`\]]$/.test(a.text) && /^[\w$@#'"`\[]/.test(b.text)) return true;
  let re;
  try { re = tokenize(a.text + b.text, dialect).filter((t) => t.type !== 'ws'); } catch (e) { return true; }
  return !(re.length === 2 && re[0].text === a.text && re[1].text === b.text);
}

function countStatements(toks) {
  let n = 0, any = false;
  toks.forEach((t) => { if (t.type === ';') { if (any) n++; any = false; } else if (t.type !== 'ws' && t.type !== 'line' && t.type !== 'block') any = true; });
  return n + (any ? 1 : 0);
}

window.DEV_TOOLS['sql-formatter'] = {
  title: 'SQL Formatter',
  category: 'developer',
  icon: '🗄',
  kind: 'code',
  description: 'Format or minify SQL for PostgreSQL, MySQL, SQL Server, SQLite and Oracle. Strings, quoted names and comments are kept exactly; only the spacing and the case of reserved words change.',
  keywords: ['sql formatter', 'sql beautifier', 'format sql', 'sql pretty print', 'sql minifier', 'postgresql formatter', 'mysql formatter', 'tsql formatter'],
  inputLabel: 'SQL',
  outputLabel: 'Formatted SQL',
  placeholder: 'select id, name from users where active = 1 order by name;',
  sample: "-- monthly revenue by customer\nselect c.id, c.name, count(o.id) as orders, sum(o.total) as revenue,\ncase when sum(o.total) > 1000 then 'gold' when sum(o.total) > 100 then 'silver' else 'bronze' end as tier\nfrom customers c left join orders o on o.customer_id = c.id and o.status <> 'cancelled'\nwhere o.created_at between '2026-01-01' and '2026-09-30' and c.country in ('GB', 'IN')\nand c.id not in (select customer_id from refunds where amount > 0)\ngroup by c.id, c.name having count(o.id) >= 2 order by revenue desc limit 50;",
  highlight: null,
  download: { ext: 'sql', type: 'application/sql' },
  files: { accept: '.sql,text/plain', label: 'Open .sql' },
  options: [
    { key: 'mode', label: 'Mode', type: 'select', default: 'format', options: [{ value: 'format', label: 'Format' }, { value: 'minify', label: 'Minify' }] },
    { key: 'dialect', label: 'Dialect', type: 'select', default: 'generic', options: [{ value: 'generic', label: 'Generic SQL' }, { value: 'postgresql', label: 'PostgreSQL' }, { value: 'mysql', label: 'MySQL / MariaDB' }, { value: 'tsql', label: 'SQL Server (T-SQL)' }, { value: 'sqlite', label: 'SQLite' }, { value: 'oracle', label: 'Oracle' }] },
    { key: 'case', label: 'Reserved words', type: 'select', default: 'upper', options: [{ value: 'upper', label: 'UPPER CASE' }, { value: 'lower', label: 'lower case' }, { value: 'keep', label: 'As typed' }] },
    { key: 'indent', label: 'Indent', type: 'select', default: '2', options: [{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }, { value: 'tab', label: 'Tab' }] },
    { key: 'comments', label: 'Comments when minifying', type: 'select', default: 'drop', options: [{ value: 'drop', label: 'Remove (keep /*! … */)' }, { value: 'keep', label: 'Keep' }] }
  ],
  transform: function (text, o) {
    if (!String(text).trim()) return { output: '', note: 'Paste SQL: one statement or many, separated by semicolons.' };
    let toks;
    try { toks = tokenize(text, o.dialect); }
    catch (e) { return { error: 'Cannot read this SQL: ' + e.message + '. Check the Dialect setting if the quoting is right for your database.' }; }
    let out;
    try { out = o.mode === 'minify' ? minify(text, o) : format(text, o); }
    catch (e) { return { error: 'Could not format this: ' + e.message }; }
    /* the guarantee: the same tokens in the same order */
    const sig = (s) => tokenize(s, o.dialect).filter((t) => t.type !== 'ws' && (o.mode !== 'minify' || o.comments === 'keep' || (t.type !== 'line' && t.type !== 'block') || /^\/\*!/.test(t.text))).map((t) => (t.type === 'word' && RESERVED.has(t.text.toUpperCase()) ? t.text.toUpperCase() : t.text));
    const a = sig(text), b = sig(out);
    if (a.join('\u0000') !== b.join('\u0000')) return { error: 'The formatter would have changed the meaning of this SQL, so it stopped. Please report the statement.' };
    const words = toks.filter((t) => t.type === 'word').length;
    const enc = (s) => new TextEncoder().encode(s).length;
    const sz = (n) => (n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB');
    return {
      output: out,
      stats: [['Statements', String(countStatements(toks))], ['Tokens', String(toks.filter((t) => t.type !== 'ws').length)], ['Words', String(words)], ['Lines', String(out.split('\n').length)], ['Input', sz(enc(text))], ['Output', sz(enc(out))]]
    };
  },
  tips: [
    'Pick your database under Dialect: it decides which quotes make a string or a name, and which comments exist (# in MySQL, nested /* */ in PostgreSQL and SQL Server, $$ blocks in PostgreSQL).',
    'Only the spaces and line breaks between pieces change, and the case of reserved words such as SELECT. Strings, quoted names, numbers and comments are left exactly as typed; the tool checks this on every run.',
    'Names are never re-cased, even ones that look like words, because MySQL table names can be case-sensitive.',
    'Minify keeps a space only where two pieces would otherwise run together, and removes comments except /*! … */ hints, unless you keep them.',
    'Several statements are formatted one after another, with a blank line between them.'
  ],
  faq: [
    { q: 'Can formatting break my query?', a: 'It is built not to: the formatted text is cut into tokens again and compared with your original, and if anything but spacing or reserved-word case differs, nothing is shown. The one thing to watch is the dialect: in MySQL "x" is a string, elsewhere it is a name.' },
    { q: 'Does it check that my SQL is valid?', a: 'No. It formats what it is given without running it, so a misspelt column or a missing join condition is laid out neatly but not found. Unclosed strings, quoted names and comments are reported with the line.' },
    { q: 'Which dialects are supported?', a: 'Generic SQL, PostgreSQL, MySQL and MariaDB, SQL Server, SQLite and Oracle, as far as quoting and comments go. The layout is the same for all of them.' }
  ]
};
window.DEV_TOOLS['sql-formatter']._lib = { tokenize: tokenize, format: format, minify: minify };
})();
