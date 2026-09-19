/**
 * Business identifiers, checked in bulk, on the device.
 *
 * A GSTIN has a checksum character; so does an Aadhaar number (Verhoeff)
 * and an IBAN (mod 97). A PAN encodes what kind of entity holds it. An IFSC
 * names a bank and a branch. This checks a column of any of them — or a
 * mixed column, detecting the kind per value — and says exactly what is
 * wrong with each one that fails. Nothing is looked up online: a checksum
 * proves a number was typed correctly, not that it belongs to anyone.
 */
(function () {
  'use strict';
  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['id-validator'] = {
    title: 'GSTIN, PAN, IFSC & ID Validator (Bulk)',
    short: 'ID Validator',
    description: 'Check a whole column of GSTINs, PANs, Aadhaar numbers, IFSC codes, TANs, CINs, UPI IDs, IBANs, PIN codes, emails and phone numbers at once — format and checksum — with the reason for every failure. Runs in your browser; nothing is looked up or uploaded.',
    keywords: ['gstin validator bulk', 'pan number validator', 'ifsc code validator', 'aadhaar verhoeff check', 'validate gstin excel', 'bulk gst number check', 'upi id validator', 'cin number check'],
    glyph: 'i-id-check',
    glyphSvg: '<symbol id="i-id-check" viewBox="0 0 24 24">\n  <rect x="3" y="5" width="18" height="14" rx="2"/>\n  <circle cx="8.5" cy="11" r="2" class="thin"/>\n  <path d="M5.5 16c.5-1.5 1.6-2.2 3-2.2s2.5.7 3 2.2" class="thin"/>\n  <path d="M14 9.5h4M14 12.5h4" class="thin"/>\n  <path d="M14.5 15.8l1.3 1.3 2.4-2.6"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/biz-id-validator.js'],
    tips: ['Paste a column, or drop a spreadsheet and pick the column. Leave the type on Detect and each value is checked as whatever it looks like.', 'A GSTIN that fails its checksum was mistyped — a swapped pair of characters is the usual cause. The PAN inside it (characters 3–12) is shown so you can compare it with the party’s PAN.', 'PAN’s fourth character says what holds it: P person, C company, H HUF, F firm, A AOP, T trust, B body of individuals, L local authority, J artificial juridical person, G government. A supplier that says it is a company with a P-type PAN is worth a question.', 'Passing means well-formed and internally consistent, not registered or active. For GSTIN status, the portal’s search is the only source.'],
    faq: [{ q: 'What does each check actually verify?', a: 'GSTIN: the 15-character pattern, a valid state code, and the checksum character (base-36 weighted). PAN: the pattern and a recognised entity letter. Aadhaar: twelve digits not starting with 0 or 1 and the Verhoeff checksum. IFSC: four letters, a zero, six alphanumerics. TAN, CIN and UPI: their patterns. IBAN: length by country and the mod-97 remainder. Emails and phones: shape.' }, { q: 'Is anything sent to the GST portal or a bank?', a: 'No. Everything is arithmetic on your device. That is why it is instant and why it cannot tell you whether a GSTIN is active — only the portal knows that.' }]
  };
  if (typeof document === 'undefined') return;
  const K = () => window.MVRBizKit;

  const STATES = { '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory', '99': 'Centre Jurisdiction' };
  const PAN_TYPES = { P: 'Person', C: 'Company', H: 'HUF', F: 'Firm', A: 'AOP', T: 'Trust', B: 'Body of individuals', L: 'Local authority', J: 'Artificial juridical person', G: 'Government', K: 'Krish (unused)' };

  function gstin(v) {
    const g = v.toUpperCase().replace(/\s/g, '');
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return { ok: false, why: 'not the 15-character GSTIN shape (2 digits, PAN, entity number, Z, checksum)' };
    if (!STATES[g.slice(0, 2)]) return { ok: false, why: 'state code ' + g.slice(0, 2) + ' does not exist' };
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; let sum = 0;
    for (let i = 0; i < 14; i++) { const val = chars.indexOf(g[i]); const p = val * ((i % 2 === 0) ? 1 : 2); sum += Math.floor(p / 36) + (p % 36); }
    const check = chars[(36 - (sum % 36)) % 36];
    if (check !== g[14]) return { ok: false, why: 'checksum fails (expected ' + check + ' as the last character) — a character was mistyped' };
    const pan = g.slice(2, 12);
    return { ok: true, detail: STATES[g.slice(0, 2)] + ' · PAN ' + pan + ' (' + (PAN_TYPES[pan[3]] || '?') + ') · entity #' + g[12] };
  }
  function pan(v) {
    const p = v.toUpperCase().replace(/\s/g, '');
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(p)) return { ok: false, why: 'not the PAN shape (5 letters, 4 digits, 1 letter)' };
    if (!PAN_TYPES[p[3]]) return { ok: false, why: 'fourth character ' + p[3] + ' is not a recognised holder type' };
    return { ok: true, detail: PAN_TYPES[p[3]] + ' · name initial ' + p[4] };
  }
  /* Verhoeff, as UIDAI uses it */
  const V_D = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]];
  const V_P = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]];
  function verhoeffOk(num) { let c = 0; const d = num.split('').reverse().map(Number); for (let i = 0; i < d.length; i++) c = V_D[c][V_P[i % 8][d[i]]]; return c === 0; }
  function aadhaar(v) {
    const a = v.replace(/[\s-]/g, '');
    if (!/^\d{12}$/.test(a)) return { ok: false, why: 'not twelve digits' };
    if (/^[01]/.test(a)) return { ok: false, why: 'cannot start with 0 or 1' };
    if (!verhoeffOk(a)) return { ok: false, why: 'Verhoeff checksum fails — a digit was mistyped or transposed' };
    return { ok: true, detail: 'checksum valid' };
  }
  function ifsc(v) { const c = v.toUpperCase().replace(/\s/g, ''); if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(c)) return { ok: false, why: 'not the IFSC shape (4 letters, 0, 6 alphanumerics)' }; return { ok: true, detail: 'bank code ' + c.slice(0, 4) + ' · branch ' + c.slice(5) }; }
  function tan(v) { const t = v.toUpperCase().replace(/\s/g, ''); return /^[A-Z]{4}\d{5}[A-Z]$/.test(t) ? { ok: true, detail: 'TAN shape valid' } : { ok: false, why: 'not the TAN shape (4 letters, 5 digits, 1 letter)' }; }
  function cin(v) { const c = v.toUpperCase().replace(/\s/g, ''); const m = /^([LU])(\d{5})([A-Z]{2})(\d{4})([A-Z]{3})(\d{6})$/.exec(c); return m ? { ok: true, detail: (m[1] === 'L' ? 'Listed' : 'Unlisted') + ' · industry ' + m[2] + ' · state ' + m[3] + ' · incorporated ' + m[4] + ' · ' + m[5] } : { ok: false, why: 'not the 21-character CIN shape' }; }
  function upi(v) { const u = v.trim(); return /^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$/.test(u) ? { ok: true, detail: 'handle @' + u.split('@')[1] } : { ok: false, why: 'not name@handle' }; }
  function iban(v) {
    const s = v.replace(/\s/g, '').toUpperCase(); if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return { ok: false, why: 'not the IBAN shape' };
    const LEN = { GB: 22, DE: 22, FR: 27, ES: 24, IT: 27, NL: 18, AE: 23, SA: 24, IE: 22, BE: 16, CH: 21, PL: 28, PT: 25, SE: 24, NO: 15, DK: 18, FI: 18, AT: 20 };
    if (LEN[s.slice(0, 2)] && LEN[s.slice(0, 2)] !== s.length) return { ok: false, why: s.slice(0, 2) + ' IBANs are ' + LEN[s.slice(0, 2)] + ' characters; this is ' + s.length };
    const t = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55)); let rem = 0; for (let i = 0; i < t.length; i += 7) rem = Number(String(rem) + t.slice(i, i + 7)) % 97;
    return rem === 1 ? { ok: true, detail: s.slice(0, 2) + ' · mod-97 valid' } : { ok: false, why: 'mod-97 check fails — a character was mistyped' };
  }
  function pin(v) { const p = v.replace(/\s/g, ''); return /^[1-9]\d{5}$/.test(p) ? { ok: true, detail: 'region ' + p[0] } : { ok: false, why: 'PIN is six digits, not starting with 0' }; }
  function email(v) { const e = v.trim(); return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(e) && !/\.\./.test(e) ? { ok: true, detail: e.split('@')[1].toLowerCase() } : { ok: false, why: 'not a valid email shape' }; }
  function phone(v) { const d = v.replace(/\D/g, ''); const n = d.replace(/^(91|0)(?=[6-9]\d{9}$)/, ''); if (/^[6-9]\d{9}$/.test(n)) return { ok: true, detail: 'Indian mobile' }; if (/^(44)?7\d{9}$/.test(d) || /^07\d{9}$/.test(d)) return { ok: true, detail: 'UK mobile' }; if (d.length >= 10 && d.length <= 15) return { ok: true, detail: 'international (' + d.length + ' digits)' }; return { ok: false, why: 'not a phone number (' + d.length + ' digits)' }; }

  const KINDS = { gstin, pan, aadhaar, ifsc, tan, cin, upi, iban, pin, email, phone };
  function detect(v) {
    const s = v.trim(), u = s.toUpperCase().replace(/\s/g, '');
    if (/^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(u)) return 'gstin';
    if (/^[A-Z]{5}\d{4}[A-Z]$/.test(u)) return 'pan';
    if (/^[A-Z]{4}\d{5}[A-Z]$/.test(u)) return 'tan';
    if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(u)) return 'ifsc';
    if (/^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(u)) return 'cin';
    if (/@/.test(s) && /\./.test(s.split('@')[1] || '')) return 'email';
    if (/@/.test(s)) return 'upi';
    if (/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(u)) return 'iban';
    if (/^\d{12}$/.test(s.replace(/[\s-]/g, ''))) return 'aadhaar';
    if (/^[1-9]\d{5}$/.test(s.replace(/\s/g, ''))) return 'pin';
    if (/^\+?[\d\s()-]{8,}$/.test(s)) return 'phone';
    return null;
  }
  function validate(value, kind) {
    const v = String(value == null ? '' : value).trim();
    if (!v) return { value: v, type: kind === 'auto' ? '' : kind, valid: '', detail: 'empty' };
    const t = kind === 'auto' ? detect(v) : kind;
    if (!t) return { value: v, type: 'unknown', valid: 'no', detail: 'does not look like any supported identifier' };
    const r = KINDS[t](v);
    return { value: v, type: t.toUpperCase(), valid: r.ok ? 'yes' : 'no', detail: r.ok ? r.detail : r.why };
  }

  function mount(root) {
    const k = K(); const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const st = { headers: [], rows: [], col: 0 }; const msg = k.msgBox();
    const ta = k.textarea('idv-text', '', 'Paste values, one per line — GSTINs, PANs, IFSCs, anything from the list. Or choose a spreadsheet below.', 8);
    io.appendChild(k.field('Values', ta));
    const colSel = k.select('idv-col', [{ value: '', label: '— choose a file first —' }], ''); const colField = k.field('Column to check', colSel); colField.hidden = true;
    const drop = k.dropzone('Or choose a spreadsheet (Excel or CSV)', '.xlsx,.csv', async (f) => { try { const t = await k.readTable(f); const h = k.splitHeader(t.sheets[0].rows); st.headers = h.headers; st.rows = h.rows; colSel.innerHTML = ''; h.headers.forEach((hh, i) => { const o = k.el('option', null, hh || ('Column ' + k.S().colName(i))); o.value = i; colSel.appendChild(o); }); const guess = h.headers.findIndex(hh => /gstin|pan|ifsc|aadhaar|upi|email|phone|mobile|iban|cin|tan|pin/i.test(hh)); if (guess >= 0) colSel.value = String(guess); colField.hidden = false; drop.say(f.name, h.rows.length + ' rows'); msg.say(''); } catch (e) { msg.say(e.message, 'error'); } });
    io.appendChild(drop); io.appendChild(colField);
    const bar = k.el('div', 'opt-bar');
    const kind = k.select('idv-kind', [{ value: 'auto', label: 'Detect per value' }].concat(Object.keys(KINDS).map(x => ({ value: x, label: x.toUpperCase() }))), 'auto');
    bar.appendChild(k.field('Type', kind)); io.appendChild(bar);
    const run = k.el('div', 'io-actions pdf-run'); run.appendChild(k.button('Validate', 'btn-primary', go)); io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);
    function go() {
      result.innerHTML = '';
      let values = [], rows = null;
      if (st.rows.length && colSel.value !== '') { const c = Number(colSel.value); values = st.rows.map(r => r[c]); rows = st.rows; }
      else values = ta.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (!values.length) { msg.say('Paste some values or choose a file.', 'note'); return; }
      const out = values.map((v, i) => Object.assign({ row: i + (rows ? 2 : 1) }, validate(v, kind.value)));
      const ok = out.filter(x => x.valid === 'yes').length, bad = out.filter(x => x.valid === 'no').length;
      const S = k.S();
      let sheetRows;
      if (rows) { sheetRows = [st.headers.concat(['id_type', 'valid', 'detail'])].concat(rows.map((r, i) => r.concat([out[i].type, out[i].valid, out[i].detail]))); }
      else sheetRows = S.objectsToRows(out);
      result.appendChild(k.summaryCard(ok + ' valid, ' + bad + ' invalid of ' + out.length, Object.entries(out.reduce((m, x) => { if (x.type) m[x.type] = (m[x.type] || 0) + 1; return m; }, {})).map(([t, n]) => t + ' ' + n).join(' · '), [k.downloadButton('validated.xlsx', () => S.writeXlsx(sheetRows, 'Validated')), k.downloadButton('validated.csv', () => new Blob([S.toCSV(sheetRows)], { type: 'text/csv' }), false)]));
      const failed = out.filter(x => x.valid === 'no');
      if (failed.length) { result.appendChild(k.h3('Invalid (' + failed.length + ')')); result.appendChild(k.previewTable(S.objectsToRows(failed), 25)); }
      result.appendChild(k.h3('All values')); result.appendChild(k.previewTable(S.objectsToRows(out), 25));
      msg.say(''); result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="id-validator"]'); if (r) mount(r); });
  window.MVRIdCheck = { validate, detect, KINDS };
})();
