/**
 * Report cards and marksheets, drawn on the device.
 *
 * A class teacher's marks sheet — one row per student, one column per
 * subject — becomes a printed report card for every child: totals,
 * percentage, a grade per subject on the scale the board uses, rank in the
 * class, and the class average beside each mark so a parent can see where
 * the child sits. Out come a ZIP of one PDF per student, a single combined
 * PDF for printing, and a summary workbook for the school's records.
 *
 * Children's names, marks and attendance never leave the browser: the sheet
 * is read here, the PDFs are drawn here by the site's own PDF writer, and
 * nothing is uploaded, so no consent form or processing agreement is needed.
 */
(function () {
  'use strict';
  window.EDU_TOOLS = window.EDU_TOOLS || {};
  window.EDU_TOOLS['report-card'] = {
    title: 'Report Card & Marksheet Generator (PDF)',
    short: 'Report Cards',
    description: 'Turn a class marks spreadsheet into a printed report card for every student — subject grades, total, percentage, rank and the class average — as one PDF each in a ZIP, one combined PDF for printing, and a results workbook. Runs in your browser; no marks are uploaded.',
    keywords: ['report card generator', 'marksheet generator excel to pdf', 'school report card maker', 'cbse grade calculator class', 'bulk report cards from spreadsheet', 'student marksheet pdf', 'class result sheet generator', 'rank and percentage calculator school'],
    glyph: 'i-report-card',
    glyphSvg: '<symbol id="i-report-card" viewBox="0 0 24 24">\n  <path d="M5.4 3.2h9L19 7.6v13.2H5.4z"/>\n  <path d="M14.4 3.2v4.4H19" class="thin"/>\n  <path d="M8.4 11.6h7.2M8.4 14.6h7.2M8.4 17.6h4.2" class="thin"/>\n  <path d="M3.2 6.6h2.2M3.2 10.2h2.2M3.2 13.8h2.2" class="thin"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/pdfcore.bundle.js', '/engine/edu-report-card.js'],
    tips: [
      'One row per student, one column per subject. Name, roll number and class are found by their headings; every other mostly-numeric column is treated as a subject. Check the column list the tool shows and change anything it read wrongly — a "Fees paid" column belongs on Skip, not in the total.',
      'Maximum marks: set one value for every subject, or put a row in the sheet whose first cell reads Max, Maximum or Full marks and give each subject its own maximum there. That row is used and then left out of the class.',
      'Write AB (or Abs, Absent) where a child did not sit the paper: it scores zero, counts towards the total and prints as AB on the card. Leave the cell empty where a subject was not offered: it is left out of both the total and the maximum, so a child taking five subjects is not marked down against one taking six.',
      'Rank is dense: two children on the same percentage share a rank and the next child takes the one after it, so there is no gap. It is worked out within each class or section, not across the whole file, and only appears if you switch it on.',
      'The class average printed beside each mark is over the children who have a numeric mark in that subject — absentees and empty cells are left out, so one absence does not drag the comparison down.',
      'The grading scale is whatever you choose and it is printed at the foot of every card, so a parent can read the card without a circular. The rupee sign and Devanagari, Tamil or Arabic script cannot be drawn in the standard PDF fonts; names in those scripts print as "?" and the tool lists any child affected. Write Rs where you need rupees.',
      'Everything is drawn in your browser. A staff room laptop with no internet works exactly the same, and the marks of thirty-five children are never uploaded anywhere.'
    ],
    faq: [
      { q: 'Which grading scale does it apply?', a: 'The one you pick: CBSE A1–E, percentage bands, a 10-point GPA, UK GCSE 9–1, or your own written as 90=A+,80=A,33=D,0=E. Boards change their scales and schools vary them, so the tool does not guess — it applies the scale you choose and prints it on the card so the card explains itself.' },
      { q: 'Does it decide who is promoted?', a: 'No. It marks a child as failing a subject when the mark is below the pass percentage you set, and shows Pass or Fail on that basis alone. Promotion policy — grace marks, compartment, best-of-five, attendance rules — belongs to the school and the board, not to a calculator.' },
      { q: 'What do I get at the end?', a: 'Three downloads: report-cards.zip with one PDF per student named by roll number and name, report-cards-combined.pdf with one student per page for printing in a single job, and results-summary.xlsx with the full result sheet, a subject-by-subject analysis and the grade distribution.' },
      { q: 'Are the marks uploaded to check them?', a: 'Nothing is uploaded. The spreadsheet is read by your browser, the arithmetic is done there and the PDFs are drawn there. You can disconnect from the internet before you start and the tool still works.' }
    ]
  };
  if (typeof document === 'undefined') return;

  const K = () => window.MVRBizKit;
  const C = () => { if (!window.MVRPdfCore) throw new Error('The PDF writer did not load.'); return window.MVRPdfCore; };

  /* ---------- marks, grades, results ---------- */

  const ABSENT = /^(ab|abs|absent)$/i;
  const NOTHING = /^(ne|na|n\/a|-{1,2}|–|—|nil)$/i;
  const MAXROW = /^(max|maximum|max\s*marks?|full\s*marks?|total\s*marks?|out\s*of)\b/i;

  /** A marks cell as it was meant: a number, an absence, or nothing at all. */
  function readMark(v) {
    if (v === '' || v == null) return { state: 'none' };
    if (typeof v === 'number') return Number.isFinite(v) ? { state: 'mark', n: v } : { state: 'none' };
    const s = String(v).trim();
    if (!s) return { state: 'none' };
    if (ABSENT.test(s)) return { state: 'absent' };
    if (NOTHING.test(s)) return { state: 'none' };
    const n = Number(s.replace(/[^\d.]/g, ''));
    if (/\d/.test(s) && Number.isFinite(n)) return { state: 'mark', n };
    return { state: 'bad', raw: s };
  }
  const looksNumeric = (v) => { const m = readMark(v); return m.state === 'mark' || m.state === 'absent'; };
  const fmt = (n) => (Math.round(n * 100) / 100).toString();
  const pct2 = (n) => Math.round(n * 100) / 100;

  const SCALES = {
    cbse: { label: 'CBSE A1–E', bands: [[91, 'A1'], [81, 'A2'], [71, 'B1'], [61, 'B2'], [51, 'C1'], [41, 'C2'], [33, 'D'], [0, 'E']] },
    percent: { label: 'Percentage bands', bands: [[90, 'A+'], [80, 'A'], [70, 'B+'], [60, 'B'], [50, 'C'], [40, 'D'], [33, 'E'], [0, 'F']] },
    gpa10: { label: 'GPA (10-point)', points: true, bands: [[91, '10'], [81, '9'], [71, '8'], [61, '7'], [51, '6'], [41, '5'], [33, '4'], [0, '0']] },
    gcse: { label: 'UK GCSE 9–1', bands: [[90, '9'], [80, '8'], [70, '7'], [60, '6'], [50, '5'], [40, '4'], [30, '3'], [20, '2'], [10, '1'], [0, 'U']] }
  };
  /** "90=A+,80=A,33=D,0=E" -> bands, highest first. */
  function parseCustom(text) {
    const bands = [];
    for (const part of String(text || '').split(/[,;\n]+/)) {
      const m = /^\s*(\d+(?:\.\d+)?)\s*[=:]\s*(.+?)\s*$/.exec(part);
      if (m) bands.push([Number(m[1]), m[2]]);
    }
    bands.sort((a, b) => b[0] - a[0]);
    return bands;
  }
  function gradeFor(pct, bands) {
    if (pct == null || !Number.isFinite(pct)) return '';
    for (const b of bands) if (pct >= b[0] - 1e-9) return b[1];
    return 'U';
  }
  function legendOf(bands) {
    return bands.map((b, i) => i === 0 ? b[1] + ' ' + fmt(b[0]) + ' and above'
      : b[0] === 0 ? b[1] + ' below ' + fmt(bands[i - 1][0])
        : b[1] + ' ' + fmt(b[0]) + '–' + fmt(bands[i - 1][0] - 1)).join('  ·  ');
  }

  /**
   * Every computed figure, from the mapped sheet. Pure, so the whole result
   * can be checked without a browser.
   *   subjects: [{ name, max }]   students: [{ detail:{}, marks:[cell] }]
   *   o: { bands, pass, points }
   */
  function compute(subjects, students, o) {
    const rows = students.map((s) => {
      let total = 0, maxTotal = 0, absent = 0, notTaken = 0, pointSum = 0, pointN = 0;
      const failedIn = [];
      const cells = subjects.map((sub, i) => {
        const m = s.marks[i] || { state: 'none' };
        if (m.state === 'none' || m.state === 'bad') {
          if (m.state === 'none') notTaken++;
          return { subject: sub.name, max: sub.max, taken: false, show: m.state === 'bad' ? String(m.raw) : '—', grade: '—' };
        }
        const got = m.state === 'absent' ? 0 : Math.max(0, m.n);
        total += got; maxTotal += sub.max;
        const p = sub.max > 0 ? got / sub.max * 100 : 0;
        const g = m.state === 'absent' ? 'AB' : gradeFor(p, o.bands);
        if (m.state === 'absent') absent++;
        if (p < o.pass) failedIn.push(sub.name);
        if (o.points && m.state !== 'absent') { const n = Number(g); if (Number.isFinite(n)) { pointSum += n; pointN++; } }
        return { subject: sub.name, max: sub.max, taken: true, absent: m.state === 'absent', got, pct: p, show: m.state === 'absent' ? 'AB' : fmt(got), grade: g };
      });
      const pct = maxTotal > 0 ? total / maxTotal * 100 : 0;
      return Object.assign({}, s, {
        cells, total, maxTotal, pct, absent, notTaken, failedIn,
        grade: gradeFor(pct, o.bands), pass: failedIn.length === 0 && maxTotal > 0,
        gpa: o.points && pointN ? Math.round(pointSum / pointN * 100) / 100 : null
      });
    });

    /* dense rank inside each class or section, and across the file */
    const rank = (list, key) => {
      const order = list.slice().sort((a, b) => b.pct - a.pct);
      let r = 0, prev = null;
      for (const s of order) { if (prev === null || Math.abs(s.pct - prev) > 1e-9) { r++; prev = s.pct; } s[key] = r; }
    };
    rank(rows, 'rankOverall');
    const groups = {};
    rows.forEach(s => { const g = String(s.detail.class || '—'); (groups[g] = groups[g] || []).push(s); });
    Object.keys(groups).forEach(g => { rank(groups[g], 'rank'); groups[g].forEach(s => { s.classSize = groups[g].length; }); });

    const analysis = subjects.map((sub, i) => {
      const got = rows.map(s => s.cells[i]).filter(c => c.taken && !c.absent).map(c => c.got);
      const took = rows.filter(s => s.cells[i].taken).length;
      const passed = rows.filter(s => s.cells[i].taken && !s.cells[i].absent && s.cells[i].pct >= o.pass).length;
      const avg = got.length ? got.reduce((a, b) => a + b, 0) / got.length : null;
      return {
        subject: sub.name, max: sub.max, appeared: got.length, entered: took,
        average: avg === null ? null : Math.round(avg * 100) / 100,
        averagePct: avg === null || !sub.max ? null : Math.round(avg / sub.max * 10000) / 100,
        highest: got.length ? Math.max.apply(null, got) : null,
        lowest: got.length ? Math.min.apply(null, got) : null,
        passed, failed: got.length - passed,
        absent: rows.filter(s => s.cells[i].absent).length,
        notTaken: rows.filter(s => !s.cells[i].taken).length
      };
    });
    const dist = {};
    rows.forEach(s => { dist[s.grade] = (dist[s.grade] || 0) + 1; });
    const order = o.bands.map(b => b[1]);
    const distribution = Object.keys(dist).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(g => ({ grade: g, students: dist[g], percentOfClass: Math.round(dist[g] / rows.length * 10000) / 100 }));
    return { rows, analysis, distribution, groups: Object.keys(groups).sort() };
  }

  /* ---------- the columns of the sheet ---------- */

  const ROLES = [
    { key: 'name', label: 'Name' }, { key: 'roll', label: 'Roll number' }, { key: 'class', label: 'Class / Section' },
    { key: 'father', label: "Father's name" }, { key: 'mother', label: "Mother's name" }, { key: 'dob', label: 'Date of birth' },
    { key: 'admission', label: 'Admission number' }, { key: 'attendance', label: 'Attendance' },
    { key: 'subject', label: 'Subject (marks)' }, { key: 'skip', label: 'Skip this column' }
  ];
  const DETAIL_KEYS = ['name', 'roll', 'class', 'father', 'mother', 'dob', 'admission', 'attendance'];

  /** What each column is, guessed from its heading and then from its values. */
  function classify(headers, rows) {
    const k = K();
    const used = {};
    return headers.map((h, i) => {
      const n = k.norm(h);
      const claim = (role) => { if (used[role]) return null; used[role] = true; return role; };
      let r = null;
      if (/^(sno|srno|sr|sl|slno|serial|serialno|no|s)$/.test(n)) return 'skip';
      if (/^(father|fathersname|fathername|guardian|guardiansname|parentname)$/.test(n) || /father|guardian/.test(n)) r = claim('father');
      else if (/mother/.test(n)) r = claim('mother');
      else if (/^(dob|dateofbirth|birthdate|birthday)$/.test(n) || /dateofbirth/.test(n)) r = claim('dob');
      else if (/^(admission|admissionno|admno|admissionnumber|enrolment|enrolmentno|enrollmentno)$/.test(n) || /^adm(no|ission)/.test(n)) r = claim('admission');
      else if (/attendance|dayspresent|presentdays/.test(n)) r = claim('attendance');
      else if (/^(roll|rollno|rollnumber|rollnum|regno|registrationno)$/.test(n) || /^roll/.test(n)) r = claim('roll');
      else if (/^(class|std|standard|section|sec|division|div|classsection|grade|classsec)$/.test(n) || /^class|^section/.test(n)) r = claim('class');
      else if (/^(name|studentname|nameofstudent|student|pupil|childsname|childname)$/.test(n) || (/name/.test(n) && !/father|mother|guardian|school/.test(n))) r = claim('name');
      if (r) return r;
      const vals = rows.map(x => x[i]).filter(v => v !== '' && v != null);
      if (!vals.length) return 'skip';
      const num = vals.filter(looksNumeric).length;
      return (h && num / vals.length >= 0.6) ? 'subject' : 'skip';
    });
  }

  /** Header row, the Max row if there is one, and the students. */
  function splitSheet(rawRows, roles) {
    const k = K();
    const h = k.splitHeader(rawRows);
    const detailCols = roles.map((r, i) => (DETAIL_KEYS.indexOf(r) >= 0 || r === 'skip') ? i : -1).filter(i => i >= 0);
    let maxRow = null;
    const body = [];
    for (const r of h.rows) {
      const isMax = detailCols.some(i => MAXROW.test(String(r[i] == null ? '' : r[i]).trim()));
      if (isMax && maxRow === null) { maxRow = r; continue; }
      body.push(r);
    }
    return { headers: h.headers, rows: body, maxRow };
  }

  /* ---------- drawing a card ---------- */

  const HEX = /^#?([0-9a-f]{6})$/i;
  const accentOf = (v) => { const m = HEX.exec(String(v || '').trim()); return m ? '#' + m[1].toLowerCase() : null; };
  const slug = (s) => String(s == null ? '' : s).trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  const EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ−‐‑―     ′″­';
  function unprintable(text) {
    const seen = new Set();
    for (const ch of String(text == null ? '' : text)) { const c = ch.codePointAt(0); if (c > 255 && EXTRA.indexOf(ch) < 0) seen.add(ch); }
    return [...seen];
  }
  const softer = (hex) => {
    const m = HEX.exec(hex); if (!m) return '#eef2f7';
    const n = parseInt(m[1], 16);
    const mix = (c) => Math.round(c + (255 - c) * 0.88);
    return '#' + [mix(n >> 16 & 255), mix(n >> 8 & 255), mix(n & 255)].map(x => x.toString(16).padStart(2, '0')).join('');
  };

  /** One student, one page of drawing ops. */
  function cardPage(s, ctx) {
    const core = C();
    const [W, H] = core.PAGE_SIZES[ctx.pageSize] || core.PAGE_SIZES.a4;
    const m = 40, ops = [];
    const B = 'Helvetica-Bold', R = 'Helvetica';
    const grey = '#54606f', rule = '#c8cfd8';
    let y = H - m;

    /* header */
    if (ctx.logoLine) { ops.push({ text: ctx.logoLine, x: W / 2, y: y - 9, size: 8.5, font: R, align: 'center', colour: grey }); y -= 13; }
    ops.push({ text: ctx.school || 'School', x: W / 2, y: y - 18, size: 18, font: B, align: 'center', colour: '#111111' }); y -= 24;
    if (ctx.address) { ops.push({ text: ctx.address, x: W / 2, y: y - 9, size: 9, font: R, align: 'center', colour: grey }); y -= 13; }
    y -= 4;
    ops.push({ rect: [m, y, W - 2 * m, 3.2], fill: ctx.accent }); y -= 14;
    ops.push({ text: ctx.exam || 'Report Card', x: W / 2, y: y - 12, size: 12, font: B, align: 'center', colour: ctx.accent }); y -= 22;

    /* student details, two to a line, in a tinted box */
    const pairs = [];
    const push = (k, v) => { if (v !== '' && v != null) pairs.push([k, String(v)]); };
    push('Name', s.detail.name); push('Roll No.', s.detail.roll); push('Class / Section', s.detail.class);
    push("Father's Name", s.detail.father); push("Mother's Name", s.detail.mother);
    push('Date of Birth', s.detail.dob); push('Admission No.', s.detail.admission); push('Attendance', s.detail.attendance);
    const lines = Math.max(1, Math.ceil(pairs.length / 2));
    const boxH = lines * 15 + 12;
    ops.push({ rect: [m, y - boxH, W - 2 * m, boxH], fill: '#f6f8fa' });
    ops.push({ rect: [m, y - boxH, W - 2 * m, boxH], stroke: rule, lineWidth: 0.7 });
    pairs.forEach((p, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = m + 12 + col * (W - 2 * m) / 2;
      const ty = y - 18 - row * 15;
      ops.push({ text: p[0], x, y: ty, size: 8, font: R, colour: grey });
      ops.push({ text: p[1], x: x + 82, y: ty, size: 9.5, font: B, colour: '#111111' });
    });
    y -= boxH + 16;

    /* how much room is left once the foot of the card is reserved */
    const sigTop = m + 56;
    const stripH = 46;
    const floor = sigTop + 12 + (ctx.remarks ? 52 : 0) + stripH + 14 + 16;
    const nRows = s.cells.length + 1;
    const rowH = Math.max(11.5, Math.min(24, (y - floor) / nRows));
    const fs = Math.max(7.5, Math.min(11, rowH * 0.45));

    /* marks table */
    const tW = W - 2 * m;
    const cw = [tW - 250, 58, 68, 62, 62];
    const cx = []; let acc = m; cw.forEach(w => { cx.push(acc); acc += w; });
    const heads = ['Subject', 'Max', 'Obtained', 'Grade', 'Class Avg'];
    ops.push({ rect: [m, y - rowH, tW, rowH], fill: ctx.accent });
    heads.forEach((h, i) => {
      const centre = i >= 1;
      ops.push({ text: h, x: centre ? cx[i] + cw[i] / 2 : cx[i] + 7, y: y - rowH + (rowH - fs) / 2 + 1.5, size: fs, font: B, align: centre ? 'center' : undefined, colour: '#ffffff' });
    });
    y -= rowH;
    s.cells.forEach((c, i) => {
      if (i % 2 === 1) ops.push({ rect: [m, y - rowH, tW, rowH], fill: '#f5f7f9' });
      const ty = y - rowH + (rowH - fs) / 2 + 1.5;
      const a = ctx.analysis[i];
      const vals = [c.subject, c.taken ? fmt(c.max) : '—', c.show, c.grade, a && a.average !== null ? fmt(a.average) : '—'];
      vals.forEach((v, j) => ops.push({ text: String(v), x: j ? cx[j] + cw[j] / 2 : cx[j] + 7, y: ty, size: fs, font: j === 2 ? B : R, align: j ? 'center' : undefined, colour: c.absent && j === 2 ? '#a3232b' : '#111111' }));
      ops.push({ line: [m, y - rowH, m + tW, y - rowH], stroke: '#e2e7ec', lineWidth: 0.5 });
      y -= rowH;
    });
    ops.push({ rect: [m, y - rowH, tW, rowH], fill: '#e7ebf0' });
    const tty = y - rowH + (rowH - fs) / 2 + 1.5;
    ops.push({ text: 'Total', x: cx[0] + 7, y: tty, size: fs, font: B });
    ops.push({ text: fmt(s.maxTotal), x: cx[1] + cw[1] / 2, y: tty, size: fs, font: B, align: 'center' });
    ops.push({ text: fmt(s.total), x: cx[2] + cw[2] / 2, y: tty, size: fs, font: B, align: 'center' });
    ops.push({ text: s.grade, x: cx[3] + cw[3] / 2, y: tty, size: fs, font: B, align: 'center' });
    y -= rowH;
    ops.push({ rect: [m, y, tW, (s.cells.length + 2) * rowH], stroke: rule, lineWidth: 0.7 });
    y -= 18;

    /* the result, large enough to read across a table */
    const cells = [['Percentage', pct2(s.pct).toFixed(2) + '%'], ['Grade', s.grade], ['Result', s.pass ? 'PASS' : 'FAIL']];
    if (s.gpa !== null && s.gpa !== undefined) cells.push(['GPA', s.gpa.toFixed(2)]);
    if (ctx.showRank) cells.push(['Rank in class', String(s.rank) + ' of ' + s.classSize]);
    const cwid = tW / cells.length;
    ops.push({ rect: [m, y - stripH, tW, stripH], fill: softer(ctx.accent) });
    ops.push({ rect: [m, y - stripH, tW, stripH], stroke: ctx.accent, lineWidth: 0.9 });
    cells.forEach((c, i) => {
      const x = m + cwid * i + cwid / 2;
      if (i) ops.push({ line: [m + cwid * i, y - stripH + 6, m + cwid * i, y - 6], stroke: ctx.accent, lineWidth: 0.5 });
      ops.push({ text: c[0], x, y: y - 15, size: 8, font: R, align: 'center', colour: grey });
      ops.push({ text: c[1], x, y: y - 34, size: 15, font: B, align: 'center', colour: c[0] === 'Result' && !s.pass ? '#a3232b' : '#111111' });
    });
    y -= stripH + 14;

    /* the rest of the page is the teacher's to write in, so give it to them */
    if (ctx.remarks) {
      const h = Math.max(46, Math.min(230, y - (sigTop + 14)));
      ops.push({ rect: [m, y - h, tW, h], stroke: rule, lineWidth: 0.7 });
      ops.push({ text: 'Remarks', x: m + 9, y: y - 15, size: 8.5, font: R, colour: grey });
      if (s.detail.remarks) ops.push({ text: String(s.detail.remarks).slice(0, 150), x: m + 60, y: y - 15, size: 9.5, font: R });
      const ruled = Math.max(1, Math.floor((h - 24) / 26));
      for (let i = 1; i <= ruled; i++) ops.push({ line: [m + 10, y - 20 - i * 26, W - m - 10, y - 20 - i * 26], stroke: '#dfe4ea', lineWidth: 0.5 });
    }
    core.wrapText('Grading scale — ' + ctx.scaleLabel + ':  ' + ctx.legend + '.  Pass mark ' + fmt(ctx.pass) + '% of each subject.', R, 7, tW).slice(0, 2)
      .forEach((ln, i) => ops.push({ text: ln, x: m, y: m + 54 - i * 9, size: 7, font: R, colour: grey }));

    /* signatures */
    const sigs = [ctx.teacherLabel, ctx.principalLabel].filter(Boolean);
    const sw = tW / Math.max(1, sigs.length);
    sigs.forEach((lab, i) => {
      const cxx = m + sw * i + sw / 2;
      ops.push({ line: [cxx - 60, m + 26, cxx + 60, m + 26], stroke: '#6b7580', lineWidth: 0.7 });
      ops.push({ text: lab, x: cxx, y: m + 14, size: 8.5, font: R, align: 'center', colour: grey });
    });
    if (ctx.issueLine) ops.push({ text: ctx.issueLine, x: W - m, y: m - 2, size: 7, font: R, align: 'right', colour: '#8b949e' });
    return { size: [W, H], ops };
  }

  /* ---------- the page ---------- */

  function mount(root) {
    const k = K();
    const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const st = { headers: [], rows: [], roles: [], maxRow: null, file: '' };
    const msg = k.msgBox();

    const drop = k.dropzone('Choose the marks spreadsheet (Excel or CSV)', '.xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', async (f) => {
      try {
        msg.say('Reading…', 'note');
        const t = await k.readTable(f);
        const h = k.splitHeader(t.sheets[0].rows);
        if (!h.headers.length || !h.rows.length) throw new Error('No table found: the first row should be the headings, with one student per row below it.');
        st.file = f.name;
        st.roles = classify(h.headers, h.rows);
        const s = splitSheet(t.sheets[0].rows, st.roles);
        st.headers = s.headers; st.rows = s.rows; st.maxRow = s.maxRow;
        drawColumns();
        const nSub = st.roles.filter(r => r === 'subject').length;
        drop.say(f.name, st.rows.length + ' student' + (st.rows.length === 1 ? '' : 's') + ' · ' + nSub + ' subject column' + (nSub === 1 ? '' : 's') + (st.maxRow ? ' · a Max row was found and used' : ''));
        msg.say('');
      } catch (e) { msg.say(e.message || String(e), 'error'); }
    });
    io.appendChild(drop);

    const cols = k.el('div', 'biz-map'); cols.hidden = true; io.appendChild(cols);
    function drawColumns() {
      cols.innerHTML = ''; cols.hidden = false;
      cols.appendChild(k.el('p', 'biz-map-title', 'What each column is — change anything read wrongly'));
      const grid = k.el('div', 'biz-map-grid');
      st.headers.forEach((h, i) => {
        const sel = k.select('rc-col-' + i, ROLES.map(r => ({ value: r.key, label: r.label })), st.roles[i]);
        sel.addEventListener('change', () => { st.roles[i] = sel.value; });
        grid.appendChild(k.field(h || ('Column ' + k.S().colName(i)), sel));
      });
      cols.appendChild(grid);
    }

    const bar = k.el('div', 'opt-bar biz-opts');
    const school = k.textInput('rc-school', 'Sunrise Public School', 'School name');
    const address = k.textInput('rc-address', '17 Station Road, Nashik 422001 · Maharashtra', 'Address, printed small under the name');
    const logoLine = k.textInput('rc-logo', 'Affiliation No. 1130456 · Senior Secondary', 'A line above the school name');
    const exam = k.textInput('rc-exam', 'Half-Yearly Examination 2026-27', 'Exam name');
    const maxMarks = k.textInput('rc-max', 100, '', 'number'); maxMarks.min = 1; maxMarks.step = 1;
    const pass = k.textInput('rc-pass', 33, '', 'number'); pass.min = 0; pass.max = 100; pass.step = 1;
    const scale = k.select('rc-scale', [{ value: 'cbse', label: 'CBSE A1–E' }, { value: 'percent', label: 'Percentage bands (A+ to F)' }, { value: 'gpa10', label: 'GPA, 10-point' }, { value: 'gcse', label: 'UK GCSE 9–1' }, { value: 'custom', label: 'Custom…' }], 'cbse');
    const custom = k.textInput('rc-custom', '90=A+,80=A,70=B,60=C,50=D,33=E,0=F', 'e.g. 90=A+,80=A,33=D,0=E');
    const rank = k.select('rc-rank', [{ value: 'yes', label: 'Show rank in class' }, { value: 'no', label: 'Do not show rank' }], 'yes');
    const remarks = k.select('rc-remarks', [{ value: 'yes', label: 'Leave a remarks line' }, { value: 'no', label: 'No remarks line' }], 'yes');
    const pageSize = k.select('rc-page', [{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }], 'a4');
    const accent = k.textInput('rc-accent', '#0b3d6b', '#0b3d6b');
    const teacher = k.textInput('rc-teacher', 'Class Teacher', 'Signature label');
    const principal = k.textInput('rc-principal', 'Principal', 'Signature label');
    bar.appendChild(k.field('School name', school));
    bar.appendChild(k.field('Address', address));
    bar.appendChild(k.field('Logo line', logoLine, 'Printed small above the school name'));
    bar.appendChild(k.field('Exam name', exam));
    bar.appendChild(k.field('Maximum marks per subject', maxMarks, 'A Max row in the sheet overrides this'));
    bar.appendChild(k.field('Pass mark (%)', pass, 'Of each subject’s maximum'));
    bar.appendChild(k.field('Grading scale', scale));
    const customField = k.field('Custom scale', custom, 'threshold=grade, separated by commas');
    bar.appendChild(customField);
    bar.appendChild(k.field('Rank', rank));
    bar.appendChild(k.field('Remarks', remarks));
    bar.appendChild(k.field('Page size', pageSize));
    bar.appendChild(k.field('Accent colour', accent, 'Any hex colour — the header bar and table heading'));
    bar.appendChild(k.field('Left signature', teacher));
    bar.appendChild(k.field('Right signature', principal));
    io.appendChild(bar);
    const syncScale = () => { customField.hidden = scale.value !== 'custom'; };
    scale.addEventListener('change', syncScale); syncScale();

    const run = k.el('div', 'io-actions pdf-run');
    run.appendChild(k.button('Generate report cards', 'btn-primary', go));
    io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    function build() {
      const roles = st.roles;
      const subjIdx = roles.map((r, i) => r === 'subject' ? i : -1).filter(i => i >= 0);
      if (!subjIdx.length) throw new Error('No subject columns. Set at least one column to "Subject (marks)".');
      const defMax = Math.max(1, Number(maxMarks.value) || 100);
      const subjects = subjIdx.map(i => {
        let mx = defMax;
        if (st.maxRow) { const c = readMark(st.maxRow[i]); if (c.state === 'mark' && c.n > 0) mx = c.n; }
        return { name: String(st.headers[i] || ('Column ' + k.S().colName(i))).trim(), max: mx, col: i };
      });
      const detailOf = (row) => {
        const d = {};
        DETAIL_KEYS.forEach(key => {
          const i = roles.indexOf(key);
          if (i >= 0 && row[i] !== '' && row[i] != null) d[key] = typeof row[i] === 'number' && key === 'dob' ? (k.toISODate(row[i]) || row[i]) : String(row[i]).trim();
        });
        return d;
      };
      const students = st.rows.map((row, n) => ({
        detail: detailOf(row), rowNo: n + 1,
        marks: subjects.map(s => readMark(row[s.col]))
      })).filter(s => s.detail.name || s.detail.roll);
      if (!students.length) throw new Error('No students found — a row needs a name or a roll number.');
      const bands = scale.value === 'custom' ? parseCustom(custom.value) : SCALES[scale.value].bands;
      if (!bands.length) throw new Error('The custom scale is empty. Write it as 90=A+,80=A,33=D,0=E.');
      const o = { bands, pass: Math.max(0, Math.min(100, Number(pass.value) || 0)), points: scale.value !== 'custom' && !!SCALES[scale.value].points };
      const res = compute(subjects, students, o);
      const acc = accentOf(accent.value);
      const ctx = {
        school: school.value.trim(), address: address.value.trim(), logoLine: logoLine.value.trim(), exam: exam.value.trim(),
        accent: acc || '#0b3d6b', pageSize: pageSize.value, showRank: rank.value === 'yes', remarks: remarks.value === 'yes',
        teacherLabel: teacher.value.trim(), principalLabel: principal.value.trim(),
        scaleLabel: scale.value === 'custom' ? 'custom' : SCALES[scale.value].label, legend: legendOf(bands),
        pass: o.pass, analysis: res.analysis, issueLine: ''
      };
      return { subjects, res, ctx, o, accentOk: !!acc };
    }

    function sheets(subjects, res, ctx) {
      const detailCols = DETAIL_KEYS.filter(key => st.roles.indexOf(key) >= 0);
      const labelOf = { name: 'Name', roll: 'Roll No.', class: 'Class/Section', father: "Father's Name", mother: "Mother's Name", dob: 'Date of Birth', admission: 'Admission No.', attendance: 'Attendance' };
      const head = detailCols.map(c => labelOf[c])
        .concat(subjects.map(s => s.name + ' (/' + fmt(s.max) + ')'))
        .concat(subjects.map(s => s.name + ' grade'))
        .concat(['Total', 'Out of', 'Percentage', 'Overall grade', 'Result', 'Subjects failed', 'Absent', 'Not taken']);
      if (ctx.showRank) head.push('Rank in class', 'Class size', 'Rank overall');
      const results = [head].concat(res.rows.map(s => {
        const r = detailCols.map(c => s.detail[c] == null ? '' : s.detail[c])
          .concat(s.cells.map(c => c.taken ? (c.absent ? 'AB' : c.got) : ''))
          .concat(s.cells.map(c => c.grade))
          .concat([s.total, s.maxTotal, pct2(s.pct), s.grade, s.pass ? 'PASS' : 'FAIL', s.failedIn.join(', '), s.absent, s.notTaken]);
        if (ctx.showRank) r.push(s.rank, s.classSize, s.rankOverall);
        return r;
      }));
      const analysis = [['Subject', 'Max', 'Marks entered', 'Appeared', 'Absent', 'Not taken', 'Class average', 'Average %', 'Highest', 'Lowest', 'Passed', 'Failed']]
        .concat(res.analysis.map(a => [a.subject, a.max, a.entered, a.appeared, a.absent, a.notTaken, a.average == null ? '' : a.average, a.averagePct == null ? '' : a.averagePct, a.highest == null ? '' : a.highest, a.lowest == null ? '' : a.lowest, a.passed, a.failed]));
      const grades = [['Grade', 'Students', '% of class']].concat(res.distribution.map(d => [d.grade, d.students, d.percentOfClass]))
        .concat([[], ['Scale', ctx.scaleLabel], ['Bands', ctx.legend], ['Pass mark', ctx.pass + '% of each subject'], ['Exam', ctx.exam], ['Students', res.rows.length]]);
      return [{ name: 'Results', rows: results }, { name: 'Subject analysis', rows: analysis }, { name: 'Grade distribution', rows: grades }];
    }

    function go() {
      result.innerHTML = '';
      if (!st.rows.length) { msg.say('Choose a marks spreadsheet first.', 'note'); return; }
      let b;
      try { b = build(); } catch (e) { msg.say(e.message || String(e), 'error'); return; }
      const core = C(), S = k.S();
      const { subjects, res, ctx } = b;
      const problems = [];
      if (!b.accentOk) problems.push('“' + accent.value + '” is not a hex colour, so the default navy was used. Write it as #0b3d6b.');
      res.rows.forEach(s => {
        const bad = unprintable([s.detail.name, s.detail.father, s.detail.mother, ctx.school, ctx.exam].join(' '));
        if (bad.length) problems.push('Roll ' + (s.detail.roll || '—') + ' (' + (s.detail.name || '—') + '): ' + bad.slice(0, 6).join(' ') + ' cannot be drawn in the standard PDF fonts and will print as ?');
        s.cells.forEach(c => { if (!c.taken && c.show !== '—') problems.push('Roll ' + (s.detail.roll || '—') + ': “' + c.show + '” in ' + c.subject + ' is not a number, AB or blank — it was left out of the total.'); });
        if (s.maxTotal === 0) problems.push('Roll ' + (s.detail.roll || '—') + ' (' + (s.detail.name || '—') + '): no marks at all, so the card shows 0%.');
      });
      if (!st.maxRow) {
        const over = res.rows.filter(s => s.cells.some(c => c.taken && c.got > c.max)).length;
        if (over) problems.push(over + ' student(s) have a mark above the maximum of ' + fmt(subjects[0].max) + '. Set the maximum, or add a Max row to the sheet.');
      }

      const pages = res.rows.map(s => cardPage(s, ctx));
      const combined = core.createPDF(pages, { pageSize: ctx.pageSize, info: { Title: (ctx.exam || 'Report cards') + ' — ' + (ctx.school || '') } });
      const files = res.rows.map((s, i) => ({
        name: (slug(s.detail.roll) || String(i + 1).padStart(3, '0')) + '-' + (slug(s.detail.name) || 'student') + '.pdf',
        blob: new Blob([core.createPDF([pages[i]], { pageSize: ctx.pageSize, info: { Title: (s.detail.name || 'Report card') + ' — ' + ctx.exam } })], { type: 'application/pdf' })
      }));
      const passed = res.rows.filter(s => s.pass).length;
      const avg = res.rows.reduce((a, s) => a + s.pct, 0) / res.rows.length;

      result.appendChild(k.summaryCard(
        res.rows.length + ' report card' + (res.rows.length === 1 ? '' : 's') + ' ready',
        subjects.length + ' subjects · ' + passed + ' passed, ' + (res.rows.length - passed) + ' failed · class average ' + pct2(avg).toFixed(2) + '% · ' + S.fmtBytes(combined.length) + ' combined',
        [
          k.downloadButton('report-cards.zip', () => window.MVRZip(files)),
          k.downloadButton('report-cards-combined.pdf', () => new Blob([combined], { type: 'application/pdf' }), false),
          k.downloadButton('results-summary.xlsx', () => S.writeXlsx(sheets(subjects, res, ctx)), false)
        ]));
      result.appendChild(k.statGrid([
        ['Students', res.rows.length],
        ['Subjects', subjects.map(s => s.name + ' /' + fmt(s.max)).join(', ')],
        ['Passed', passed + ' of ' + res.rows.length],
        ['Class average', pct2(avg).toFixed(2) + '%'],
        ['Highest', pct2(Math.max.apply(null, res.rows.map(s => s.pct))).toFixed(2) + '% · ' + (((res.rows.find(s => s.rankOverall === 1) || {}).detail || {}).name || '')],
        ['Classes ranked separately', res.groups.join(', ')],
        ['Grading scale', ctx.scaleLabel + ' — ' + ctx.legend],
        ['Absent marks', res.rows.reduce((a, s) => a + s.absent, 0)],
        ['Blank (subject not taken)', res.rows.reduce((a, s) => a + s.notTaken, 0)]
      ]));
      if (problems.length) result.appendChild(k.issues(problems, 'thing to check'));
      result.appendChild(k.h3('Results'));
      const head = ['Roll', 'Name', 'Class'].concat(subjects.map(s => s.name)).concat(['Total', '%', 'Grade', 'Result'].concat(ctx.showRank ? ['Rank'] : []));
      result.appendChild(k.previewTable([head].concat(res.rows.map(s => [s.detail.roll || '', s.detail.name || '', s.detail.class || '']
        .concat(s.cells.map(c => c.show))
        .concat([fmt(s.total) + '/' + fmt(s.maxTotal), pct2(s.pct).toFixed(2), s.grade, s.pass ? 'PASS' : 'FAIL']).concat(ctx.showRank ? [s.rank] : []))), 40));
      result.appendChild(k.h3('Subject analysis'));
      result.appendChild(k.previewTable([['Subject', 'Max', 'Average', 'Average %', 'Highest', 'Lowest', 'Passed', 'Failed', 'Absent']]
        .concat(res.analysis.map(a => [a.subject, fmt(a.max), a.average == null ? '—' : fmt(a.average), a.averagePct == null ? '—' : fmt(a.averagePct), a.highest == null ? '—' : fmt(a.highest), a.lowest == null ? '—' : fmt(a.lowest), a.passed, a.failed, a.absent])), 30));
      result.appendChild(k.h3('Grade distribution'));
      result.appendChild(k.previewTable([['Grade', 'Students', '% of class']].concat(res.distribution.map(d => [d.grade, d.students, d.percentOfClass])), 20));
      msg.say('');
      result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="report-card"]'); if (r) mount(r); });
  window.MVRReportCard = { readMark, compute, classify, splitSheet, gradeFor, parseCustom, legendOf, SCALES, cardPage };
})();
