/**
 * Letter mail merge, on the device.
 *
 * A letter template with {{Column}} placeholders, a spreadsheet of
 * recipients, and out come the letters: one PDF each, zipped, plus a single
 * PDF with them all in a row for printing. The text is set in the standard
 * PDF fonts through the site's own PDF writer, so nothing is uploaded and
 * no library is fetched — a list of debtors, tenants or parents stays here.
 */
(function () {
  'use strict';
  window.BIZ_TOOLS = window.BIZ_TOOLS || {};
  window.BIZ_TOOLS['mail-merge'] = {
    title: 'Letter Mail Merge to PDF',
    short: 'Mail Merge',
    description: 'Write one letter with {{Name}}-style placeholders, drop a spreadsheet of recipients, and download a PDF for each row — zipped, and as one combined file for printing. Runs in your browser; nothing is uploaded.',
    keywords: ['mail merge pdf', 'mail merge from excel', 'bulk letters from spreadsheet', 'letter generator csv', 'personalised letters pdf', 'mail merge without word', 'demand letter bulk', 'fee reminder letters'],
    glyph: 'i-mail-merge',
    glyphSvg: '<symbol id="i-mail-merge" viewBox="0 0 24 24">\n  <rect x="3" y="8" width="13" height="10" rx="1.5"/>\n  <path d="M3.6 9l5.9 4.4L15.4 9" class="thin"/>\n  <path d="M18.5 15V7.5A1.5 1.5 0 0 0 17 6H7.5" class="thin"/>\n  <path d="M21 12V5a1.5 1.5 0 0 0-1.5-1.5H10" class="thin"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/pdfcore.bundle.js', '/engine/biz-mail-merge.js'],
    tips: ['A placeholder is the column heading in double braces: {{Name}}, {{Amount due}}. Case and spacing do not matter, so {{amount_due}} finds "Amount Due". A placeholder with no matching column is left in the letter as typed, and listed, so it cannot slip through unnoticed.', 'The first row of the spreadsheet is the headings. Every row after it is one letter; blank rows are skipped.', 'Put the recipient’s address in the template as placeholders — {{Name}}, {{Address}} — on the lines where you want it. The letterhead, date and signature are set once and go on every letter.', 'Amounts and dates print as the cell holds them. Format them in the spreadsheet as you want them read (12,500.00 · 15 October 2026); a date cell stored as a number is turned into a date only when the heading contains "date".', 'The standard PDF fonts cover Western European characters. Names in Devanagari, Tamil or Arabic script, and the ₹ sign, would print as "?" — the tool lists any row where that would happen. Write Rs for rupees.', 'The combined PDF starts each letter on a new page, so it prints and collates in one job; the ZIP has one file per recipient for emailing.'],
    faq: [{ q: 'Does it read Word templates or produce Word files?', a: 'No. The template is plain text typed here, and the output is PDF only. That is what makes it work without an upload: the letters are drawn directly by the site’s PDF writer, in the standard fonts a PDF reader has built in.' }, { q: 'Can a letter run over more than one page?', a: 'Yes. A long letter continues on a following page, and the signature block always stays with the text before it. Each recipient still starts on a fresh page in the combined file.' }, { q: 'What happens to a row with an empty cell?', a: 'The placeholder becomes empty text, and the row is listed under issues with the column name — a demand letter for a blank amount is worth catching. The letter is still produced so the numbering stays in step with the spreadsheet.' }]
  };
  if (typeof document === 'undefined') return;
  const K = () => window.MVRBizKit;
  const C = () => { if (!window.MVRPdfCore) throw new Error('The PDF writer did not load.'); return window.MVRPdfCore; };

  const PH = /\{\{\s*([^{}]+?)\s*\}\}/g;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const longDate = (d) => d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  /* What the standard fonts can draw: WinAnsi, plus the few characters the
     writer substitutes. Anything else prints as "?", so say so up front. */
  const EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ−‐‑―     ′″­';
  function unprintable(text) {
    const seen = new Set();
    for (const ch of String(text)) { const c = ch.codePointAt(0); if (c > 255 && EXTRA.indexOf(ch) < 0) seen.add(ch); }
    return [...seen];
  }

  /** Header row plus data rows that remember their spreadsheet row number, so an issue names the row a person can find. */
  function splitKeepIdx(rows) {
    const hi = rows.findIndex(r => r.filter(v => v !== '' && v != null).length >= 2);
    if (hi < 0) return { headers: [], rows: [], nums: [] };
    const headers = rows[hi].map(h => String(h == null ? '' : h).trim());
    const out = [], nums = [];
    for (let i = hi + 1; i < rows.length; i++) { const r = rows[i]; if (r.some(v => v !== '' && v != null)) { out.push(r); nums.push(i + 1); } }
    return { headers, rows: out, nums };
  }

  /** A cell as it should read in a letter. */
  function cellText(v, header) {
    if (v == null) return '';
    if (typeof v === 'number') {
      if (/date|dated|\bon\b|\bdob\b/i.test(header || '') && v > 20000 && v < 80000) {
        const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
        return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
      }
      return String(v);
    }
    return String(v).trim();
  }

  /** Fill one row into the template. Unknown placeholders stay as typed. */
  function merge(template, headers, index, row) {
    const missing = [], blank = [];
    const text = String(template).replace(PH, (m, name) => {
      const i = index[K().norm(name)];
      if (i === undefined) { if (!missing.includes(name)) missing.push(name); return m; }
      const v = cellText(row[i], headers[i]);
      if (v === '' && !blank.includes(headers[i])) blank.push(headers[i]);
      return v;
    });
    return { text, missing, blank };
  }

  /** The letter as pages of drawing ops. */
  function layout(body, o) {
    const core = C();
    const pages = []; let ops = []; let y = o.H - o.m;
    const flush = () => { pages.push({ size: [o.W, o.H], ops }); ops = []; y = o.H - o.m; };
    const need = (h) => { if (y - h < o.m && ops.length) flush(); };
    const xFor = (align) => align === 'right' ? o.W - o.m : align === 'center' ? o.W / 2 : o.m;
    if (o.letterhead.length) {
      o.letterhead.forEach((ln, i) => {
        const size = i === 0 ? o.size + 3 : o.size - 1, font = i === 0 ? o.bold : o.font;
        ops.push({ text: ln, x: xFor(o.lhAlign), y: y - size, size, font, align: o.lhAlign, colour: i === 0 ? '#000000' : '#444444' });
        y -= size * 1.35;
      });
      y -= 6;
      ops.push({ line: [o.m, y, o.W - o.m, y], stroke: '#999999', lineWidth: 0.6 });
      y -= o.lead * 1.6;
    }
    if (o.date) { ops.push({ text: o.date, x: o.m, y: y - o.size, size: o.size, font: o.font }); y -= o.lead * 2; }
    for (const ln of core.wrapText(body, o.font, o.size, o.W - o.m * 2)) {
      need(o.lead);
      if (ln) ops.push({ text: ln, x: o.m, y: y - o.size, size: o.size, font: o.font });
      y -= o.lead;
    }
    if (o.signature.length) {
      need(o.lead * (o.signature.length + 1));
      y -= o.lead;
      o.signature.forEach((ln) => { need(o.lead); if (ln) ops.push({ text: ln, x: o.m, y: y - o.size, size: o.size, font: o.font }); y -= o.lead; });
    }
    if (ops.length || !pages.length) flush();
    if (pages.length > 1) pages.forEach((p, i) => p.ops.push({ text: 'Page ' + (i + 1) + ' of ' + pages.length, x: o.W / 2, y: o.m / 2, size: 8, font: 'Helvetica', align: 'center', colour: '#777777' }));
    return pages;
  }

  function mount(root) {
    const k = K(); const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const st = { headers: [], rows: [], nums: [], index: {}, file: '' };
    const msg = k.msgBox();

    const ta = k.textarea('mm-template', '{{Name}}\n{{Address}}\n\nDear {{Name}},\n\nOur records show a balance of Rs {{Amount}} on invoice {{Invoice}}, due on {{Due date}}. Please arrange payment by bank transfer or UPI within seven days of this letter.\n\nIf you have already paid, thank you — please ignore this reminder.', 'Type the letter. Put column headings in double braces: {{Name}}, {{Amount}}.', 12);
    io.appendChild(k.field('Letter template', ta, 'One column heading in double braces per placeholder: {{Name}}'));

    const drop = k.dropzone('Choose the recipients (Excel or CSV)', '.xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', async (f) => {
      try {
        msg.say('Reading…', 'note');
        const t = await k.readTable(f);
        const h = splitKeepIdx(t.sheets[0].rows);
        if (!h.headers.length || !h.rows.length) throw new Error('No table found: the first row should be the headings, with one recipient per row below it.');
        st.headers = h.headers; st.rows = h.rows; st.nums = h.nums; st.file = f.name; st.index = {};
        h.headers.forEach((hh, i) => { const n = k.norm(hh); if (n && st.index[n] === undefined) st.index[n] = i; });
        nameSel.innerHTML = '';
        h.headers.forEach((hh, i) => { const o = k.el('option', null, hh || ('Column ' + k.S().colName(i))); o.value = i; nameSel.appendChild(o); });
        const guess = h.headers.findIndex(hh => /name/i.test(hh));
        nameSel.value = String(guess >= 0 ? guess : 0);
        previewRow.max = h.rows.length; previewRow.value = 1;
        drop.say(f.name, h.rows.length + ' recipient' + (h.rows.length === 1 ? '' : 's') + ' · ' + h.headers.filter(Boolean).map(x => '{{' + x + '}}').join(' '));
        msg.say(''); preview();
      } catch (e) { msg.say(e.message || String(e), 'error'); }
    });
    io.appendChild(drop);

    /* options */
    const bar = k.el('div', 'opt-bar biz-opts');
    const pageSize = k.select('mm-page', [{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }], 'a4');
    const font = k.select('mm-font', [{ value: 'Helvetica', label: 'Helvetica (sans)' }, { value: 'Times-Roman', label: 'Times (serif)' }, { value: 'Courier', label: 'Courier (monospace)' }], 'Helvetica');
    const size = k.textInput('mm-size', 11, '', 'number'); size.min = 8; size.max = 16; size.step = 0.5;
    const margin = k.textInput('mm-margin', 25, '', 'number'); margin.min = 10; margin.max = 50; margin.step = 1;
    const lhAlign = k.select('mm-lh-align', [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'center', label: 'Centred' }], 'left');
    const date = k.textInput('mm-date', longDate(new Date()), 'Leave empty for no date line');
    const nameSel = k.select('mm-namecol', [{ value: '', label: '— choose a file first —' }], '');
    bar.appendChild(k.field('Page size', pageSize));
    bar.appendChild(k.field('Font', font));
    bar.appendChild(k.field('Font size', size));
    bar.appendChild(k.field('Margins (mm)', margin));
    bar.appendChild(k.field('Letterhead alignment', lhAlign));
    bar.appendChild(k.field('Date line', date));
    bar.appendChild(k.field('Name each file by', nameSel, 'Used in the file names inside the ZIP'));
    io.appendChild(bar);
    const letterhead = k.textarea('mm-letterhead', 'Acme Traders\n12 MG Road, Bengaluru 560001\naccounts@example.com · +91 80 1234 5678', 'Sender name and address, one line each — leave empty for none', 3);
    io.appendChild(k.field('Letterhead', letterhead, 'Printed at the top of every letter; the first line is set larger'));
    const signature = k.textarea('mm-signature', 'Yours sincerely,\n\n\nPriya Sharma\nAccounts Manager', 'Closing and signature, one line each', 5);
    io.appendChild(k.field('Signature block', signature, 'Blank lines leave room to sign'));

    /* preview */
    const pvBar = k.el('div', 'io-head');
    pvBar.appendChild(k.el('span', 'io-label', 'Preview'));
    const pvCtl = k.el('div', 'io-actions');
    const previewRow = k.textInput('mm-previewrow', 1, '', 'number'); previewRow.min = 1; previewRow.max = 1; previewRow.style.width = '5.5em';
    previewRow.setAttribute('aria-label', 'Recipient row to preview');
    pvCtl.appendChild(k.el('span', 'field-hint', 'Row')); pvCtl.appendChild(previewRow);
    pvBar.appendChild(pvCtl);
    const pane = k.el('div', 'io-pane'); pane.appendChild(pvBar);
    const pre = k.el('pre', 'code-out'); pane.appendChild(pre); io.appendChild(pane);
    const pvMsg = k.el('div', 'io-msg'); io.appendChild(pvMsg);

    const run = k.el('div', 'io-actions pdf-run'); run.appendChild(k.button('Generate letters', 'btn-primary', go)); io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    const opts = () => {
      const core = C();
      const [W, H] = core.PAGE_SIZES[pageSize.value] || core.PAGE_SIZES.a4;
      const sz = Math.max(8, Math.min(16, Number(size.value) || 11));
      const f = core.FONTS[font.value] ? font.value : 'Helvetica';
      return {
        W, H, m: Math.max(10, Math.min(50, Number(margin.value) || 25)) * 72 / 25.4, pageSize: pageSize.value,
        font: f, bold: f === 'Helvetica' ? 'Helvetica-Bold' : f, size: sz, lead: sz * 1.45,
        letterhead: letterhead.value.split('\n').map(s => s.trim()).filter(Boolean), lhAlign: lhAlign.value,
        date: date.value.trim(), signature: signature.value.replace(/\s+$/, '').split('\n').map(s => s.replace(/\s+$/, ''))
      };
    };
    const asText = (body, o) => [o.letterhead.join('\n'), o.date, body, o.signature.join('\n')].filter(Boolean).join('\n\n');

    function preview() {
      const i = Math.max(1, Math.min(st.rows.length || 1, Number(previewRow.value) || 1)) - 1;
      const o = opts();
      if (!st.rows.length) {
        pre.textContent = asText(ta.value, o);
        const names = [...ta.value.matchAll(PH)].map(m => m[1]);
        pvMsg.className = 'io-msg is-note'; pvMsg.textContent = names.length ? 'Placeholders in the template: ' + [...new Set(names)].join(', ') + '. Choose a spreadsheet to fill them.' : 'No placeholders yet — write {{Name}} where a value should go.';
        return;
      }
      const r = merge(ta.value, st.headers, st.index, st.rows[i]);
      pre.textContent = asText(r.text, o);
      const notes = [];
      if (r.missing.length) notes.push('Not in the spreadsheet: ' + r.missing.map(x => '{{' + x + '}}').join(', '));
      if (r.blank.length) notes.push('Blank for this row: ' + r.blank.join(', '));
      const bad = unprintable(pre.textContent);
      if (bad.length) notes.push('Cannot be drawn in the standard fonts (prints as ?): ' + bad.slice(0, 8).join(' '));
      pvMsg.className = 'io-msg ' + (r.missing.length || bad.length ? 'is-warn' : 'is-note');
      pvMsg.textContent = notes.length ? notes.join(' · ') : 'Row ' + (i + 1) + ' of ' + st.rows.length + ' — every placeholder found.';
    }
    [ta, letterhead, signature, date, previewRow, pageSize, font, size, margin, lhAlign].forEach(c => { c.addEventListener('input', preview); c.addEventListener('change', preview); });
    preview();

    async function go() {
      result.innerHTML = '';
      if (!st.rows.length) { msg.say('Choose a spreadsheet of recipients first.', 'note'); return; }
      if (!ta.value.trim()) { msg.say('The letter template is empty.', 'note'); return; }
      const core = C(); const o = opts(); const S = k.S();
      const nameCol = Number(nameSel.value) || 0;
      const letters = [], problems = [];
      let pagesTotal = 0, blankRows = 0;
      const missing = [...new Set([...ta.value.matchAll(PH)].map(m => m[1]).filter(n => st.index[k.norm(n)] === undefined))];
      const badChars = new Set();
      st.rows.forEach((row, i) => {
        const r = merge(ta.value, st.headers, st.index, row);
        const rowNo = st.nums[i] || (i + 2);
        const who = cellText(row[nameCol], st.headers[nameCol]) || ('row ' + rowNo);
        if (r.blank.length) { blankRows++; problems.push('Row ' + rowNo + ' (' + who + '): blank ' + r.blank.join(', ')); }
        const bad = unprintable(asText(r.text, o));
        if (bad.length) { bad.forEach(c => badChars.add(c)); problems.push('Row ' + rowNo + ' (' + who + '): ' + bad.slice(0, 6).join(' ') + ' cannot be drawn in the standard fonts and will print as ?'); }
        const pages = layout(r.text, o);
        pagesTotal += pages.length;
        letters.push({ who, pages, file: String(i + 1).padStart(3, '0') + '-' + (slug(who) || 'letter') + '.pdf' });
      });
      if (missing.length) problems.unshift('Not in the spreadsheet, left as typed in every letter: ' + missing.map(x => '{{' + x + '}}').join(', '));
      const combined = core.createPDF(letters.flatMap(l => l.pages), { pageSize: o.pageSize, info: { Title: 'Letters - ' + st.file } });
      const zipName = 'letters-' + (slug(st.file.replace(/\.[^.]+$/, '')) || 'merge') + '.zip';
      result.appendChild(k.summaryCard(letters.length + ' letter' + (letters.length === 1 ? '' : 's') + ' ready', pagesTotal + ' page' + (pagesTotal === 1 ? '' : 's') + ' · ' + S.fmtBytes(combined.length) + ' combined' + (problems.length ? ' · ' + problems.length + ' issue' + (problems.length === 1 ? '' : 's') : ''), [
        k.downloadButton(zipName, async () => window.MVRZip(letters.map(l => ({ name: l.file, blob: new Blob([core.createPDF(l.pages, { pageSize: o.pageSize, info: { Title: 'Letter to ' + l.who } })], { type: 'application/pdf' }) })))),
        k.downloadButton('letters-combined.pdf', () => new Blob([combined], { type: 'application/pdf' }), false)
      ]));
      result.appendChild(k.statGrid([['Letters', letters.length], ['Pages', pagesTotal], ['Rows with a blank field', blankRows], ['Placeholders not in the sheet', missing.length ? missing.join(', ') : 'none'], ['Characters the fonts cannot draw', badChars.size ? [...badChars].slice(0, 10).join(' ') : 'none'], ['Page size', pageSize.options[pageSize.selectedIndex].text + ' · ' + o.font + ' ' + o.size + 'pt']]));
      if (problems.length) result.appendChild(k.issues(problems, 'issue'));
      result.appendChild(k.h3('Files in the ZIP'));
      result.appendChild(k.previewTable([['File', 'Recipient', 'Pages']].concat(letters.map(l => [l.file, l.who, l.pages.length])), 25));
      msg.say(''); result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="mail-merge"]'); if (r) mount(r); });
  window.MVRMailMerge = { merge, layout, unprintable, cellText, splitKeepIdx };
})();
