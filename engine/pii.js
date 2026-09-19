/**
 * Personal data, kept on the device.
 *
 * Before an AI tool sends text anywhere, the identifiers that make a person
 * findable are replaced with placeholders — [[EMAIL_1]], [[PHONE_2]] — and
 * only the placeholders travel. The model works with the structure of the
 * text, which is all it needs, and copies the placeholders into its answer;
 * on the way back they are swapped for the originals, so what the reader
 * sees is complete and what left the device was not.
 *
 * Deterministic and pattern-based, so it is fast and predictable: every
 * pattern here has a check (Luhn for cards, mod-97 for IBANs, the fixed
 * shapes of PAN and Aadhaar) that keeps false positives rare. Names are not
 * detected — no pattern finds them reliably — and the pages say so.
 *
 *   MVRPII.mask(text)          -> { masked, map, counts }
 *   MVRPII.unmask(text, map)   -> text with the originals back
 *   MVRPII.describe(counts)    -> "3 emails, 2 phone numbers"
 */
(function () {
  'use strict';

  const luhn = (digits) => {
    let sum = 0, alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits.charCodeAt(i) - 48;
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d; alt = !alt;
    }
    return sum % 10 === 0;
  };
  const ibanOk = (s) => {
    const t = (s.slice(4) + s.slice(0, 4)).toUpperCase().replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let rem = 0;
    for (let i = 0; i < t.length; i += 7) rem = Number(String(rem) + t.slice(i, i + 7)) % 97;
    return rem === 1;
  };

  /* Order matters: longer, more specific shapes first, so a card number is
     not eaten piecemeal by the phone pattern. */
  const KINDS = [
    { kind: 'EMAIL', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
    { kind: 'IBAN', re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}[ ]?[A-Z0-9]{1,4}\b/g, ok: (m) => ibanOk(m.replace(/\s/g, '')) },
    { kind: 'CARD', re: /\b(?:\d[ -]?){12,18}\d\b/g, ok: (m) => { const d = m.replace(/\D/g, ''); return d.length >= 13 && d.length <= 19 && luhn(d); } },
    { kind: 'AADHAAR', re: /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g },
    /* PAN: masking favours recall, so the entity letter is not checked. A
       GSTIN contains a PAN but never at a word boundary, so it is untouched. */
    { kind: 'PAN', re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
    { kind: 'NINO', re: /\b[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/g },
    { kind: 'ACCOUNT', re: /\b(?:a\/c|acct?\.?|account)(?:\s*(?:no|number|#)\.?)?\s*[:\-]?\s*(\d[\d -]{7,20}\d)\b/gi, group: 1 },
    /* Phones: with a country code first (any separator), then the national
       shapes — Indian mobile, UK mobile and landline, North American — each
       guarded so a date, a decimal or an invoice number is not taken. */
    { kind: 'PHONE', re: /(?<![\d.])\+\d{1,3}[ -]?(?:\(0\)[ -]?)?\(?\d{2,5}\)?[ -]?\d{3,5}(?:[ -]?\d{2,5})?(?![\d.])|(?<![\d.\/-])(?:0?[6-9]\d{4}[ -]?\d{5}|07\d{3}[ -]?\d{6}|\(?0\d{2,4}\)?[ -]?\d{3,4}[ -]?\d{3,4}|\d{3}[ -]\d{3}[ -]\d{4})(?![\d.\/-])/g, ok: (m) => { const d = m.replace(/\D/g, ''); return d.length >= 10 && d.length <= 13; } }
  ];

  function mask(text) {
    const src = String(text || '');
    const map = {};            /* placeholder -> original */
    const byValue = {};        /* normalised value -> placeholder */
    const counts = {};
    const spans = [];          /* { start, end, kind, value } */
    const taken = new Array(src.length).fill(false);

    for (const k of KINDS) {
      k.re.lastIndex = 0;
      let m;
      while ((m = k.re.exec(src))) {
        const value = k.group ? m[k.group] : m[0];
        const start = k.group ? m.index + m[0].indexOf(value) : m.index;
        const end = start + value.length;
        if (k.ok && !k.ok(value)) continue;
        let clash = false;
        for (let i = start; i < end; i++) if (taken[i]) { clash = true; break; }
        if (clash) continue;
        for (let i = start; i < end; i++) taken[i] = true;
        spans.push({ start, end, kind: k.kind, value });
      }
    }
    spans.sort((a, b) => a.start - b.start);

    let out = '', last = 0;
    for (const s of spans) {
      const norm = s.kind + ':' + s.value.replace(/[\s-]/g, '').toLowerCase();
      let ph = byValue[norm];
      if (!ph) {
        counts[s.kind] = (counts[s.kind] || 0) + 1;
        ph = '[[' + s.kind + '_' + counts[s.kind] + ']]';
        byValue[norm] = ph;
        map[ph] = s.value;
      }
      out += src.slice(last, s.start) + ph;
      last = s.end;
    }
    out += src.slice(last);
    return { masked: out, map, counts };
  }

  function unmask(text, map) {
    let out = String(text || '');
    for (const [ph, value] of Object.entries(map || {})) {
      /* the model sometimes drops the brackets or a bracket; take those too */
      const core = ph.slice(2, -2);
      out = out.split(ph).join(value)
        .replace(new RegExp('\\[?\\[?' + core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\]?\\]?', 'g'), value);
    }
    return out;
  }

  const LABEL = { EMAIL: ['email', 'emails'], PHONE: ['phone number', 'phone numbers'], PAN: ['PAN', 'PANs'], AADHAAR: ['Aadhaar number', 'Aadhaar numbers'], CARD: ['card number', 'card numbers'], IBAN: ['IBAN', 'IBANs'], NINO: ['NI number', 'NI numbers'], ACCOUNT: ['account number', 'account numbers'] };
  function describe(counts) {
    const parts = Object.entries(counts || {}).map(([k, n]) => n + ' ' + (LABEL[k] ? LABEL[k][n === 1 ? 0 : 1] : k.toLowerCase()));
    return parts.length ? parts.join(', ') : 'nothing that looked like personal data';
  }

  window.MVRPII = { mask, unmask, describe };
})();
