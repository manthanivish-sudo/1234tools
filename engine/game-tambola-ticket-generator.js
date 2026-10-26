/**
 * Tambola (Housie, 90-ball bingo) ticket generator, on the device.
 *
 * Tickets come in strips of six that between them use every number 1–90
 * once (engine/game-tambola-core.js). Each is made from a set code (seed) and
 * its number, and carries both as its ID (K7MPQ2-014): the same code always
 * makes the same tickets, so the host can reprint them, and the caller can
 * rebuild any ticket to check a claim, with nothing stored or sent.
 *
 * Out: window.print() with print CSS (A4 or US Letter, 6 or 12 a page, cut
 * lines); a PDF drawn by /engine/pdfcore.bundle.js, loaded only when asked
 * for; and ticket pictures (PNG, drawn on a canvas) one by one, shared to an
 * app where the phone allows, or all in a ZIP made by /engine/zip.js, also
 * loaded on demand.
 */
(function () {
  'use strict';
  window.GAME_TOOLS = window.GAME_TOOLS || {};
  const SLUG = 'tambola-ticket-generator';
  window.GAME_TOOLS[SLUG] = {
    order: 3,
    title: 'Tambola Ticket Generator',
    short: 'Tambola Tickets',
    description: 'Make valid Tambola (Housie) tickets in strips of six that use every number 1–90 once. Print 6 or 12 a page on A4 or Letter, download a PDF, or send each ticket as a picture on WhatsApp. Free, no sign-up.',
    keywords: ['tambola ticket generator', 'housie tickets printable', 'tambola tickets pdf', 'tambola ticket for whatsapp', 'printable tambola tickets', '90 ball bingo tickets', 'housie ticket maker', 'tambola tickets for kitty party'],
    glyph: 'i-tambola-ticket-generator',
    glyphSvg: '<symbol id="i-tambola-ticket-generator" viewBox="0 0 24 24">\n  <path d="M3 6.5h18v3.2a2.3 2.3 0 0 0 0 4.6v3.2H3v-3.2a2.3 2.3 0 0 0 0-4.6z"/>\n  <path d="M3 12h18M9 6.5v11M15 6.5v11" class="thin"/>\n  <circle cx="6" cy="9.3" r="1" class="fill"/>\n  <circle cx="12" cy="14.8" r="1" class="fill"/>\n  <circle cx="18" cy="9.3" r="1" class="fill"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/game-tambola-core.js', '/engine/game-tambola-ticket-generator.js'],
    privacy: 'Tickets are made by your own browser from the set code; nothing is uploaded, and because the same code always makes the same tickets, no list of tickets is stored anywhere. The PDF and the pictures are made on this device. Your settings and the last set code you printed are remembered on this device only.',
    how: [
      'Choose how many tickets (in strips of six), a title for the top of each ticket and a colour.',
      'Keep the fresh set code, or type one you used before to make the very same tickets again.',
      'Press Print (A4 or US Letter, 6 or 12 tickets a page, with cut lines) or Download PDF — or make ticket pictures to send on WhatsApp.',
      'Open the caller for this set: it rebuilds any ticket from the number printed on it, so claims are checked in seconds.'
    ],
    uses: [
      ['Diwali at home', 'a strip of six for every family, printed on A4 and cut along the dashed lines'],
      ['Kitty party', 'twelve tickets a page, titled with the host’s name and the date'],
      ['Video call', 'each player gets their ticket picture on WhatsApp and marks it on paper or on screen']
    ],
    tips: [
      'For 20 players make 24 tickets (four strips of six): everyone gets one and a few can play two.',
      'A strip of six uses every number from 1 to 90 exactly once, so each number called is on one ticket of every strip.',
      'Every ticket has 15 numbers, five in each row, and each column keeps its own range: 1–9, 10–19 and so on up to 80–90 in the last column, sorted top to bottom.',
      'The set code and the ticket number are printed on every ticket (K7MPQ2-014). Type the same code into Set code to reprint exactly the same tickets, or a ticket number into the caller to check a claim.',
      'Ticket pictures are PNG images, one per ticket, sized to read on a phone. Download one at a time — or share it straight to WhatsApp on phones that allow it — or all of them together in a ZIP.',
      'Show on TV puts the first strip on the big screen — handy on a video call for showing new players how to read a ticket.',
      'The PDF uses the standard PDF fonts, which cannot draw Hindi or other non-Latin letters; for a title in Hindi use Print, which uses your browser’s own fonts.'
    ],
    faq: [
      { q: 'How many tickets do I need for 20 people?', a: 'One each plus a few spare: 24 tickets, which is four strips of six, prints on four A4 pages at six a page or two pages at twelve. Tickets are always made in whole strips of six.' },
      { q: 'Are these real Tambola tickets?', a: 'Yes. Each ticket has three rows and nine columns with 15 numbers, five in every row; the first column holds 1–9, the next 10–19 and so on, with 80–90 in the last; every column has one to three numbers, sorted top to bottom; and each strip of six uses every number 1–90 once. Our tests check 10,000 strips against those rules.' },
      { q: 'Can I reprint the same tickets?', a: 'Yes. Every ticket shows its set code. Type that code into Set code with the same number of tickets and you get exactly the same tickets, in any browser. The last code you printed is also offered on this device.' },
      { q: 'What does Early Five mean?', a: 'Early Five is won by the first player to mark any five numbers on their ticket. The other usual prizes are the Top, Middle and Bottom lines, Four Corners (the first and last numbers of the top and bottom rows) and Full House, all fifteen.' },
      { q: 'How do I play on a video call?', a: 'Make the tickets here and press Ticket pictures: send each player their picture on WhatsApp. Open the Tambola Number Caller with the same set code, share its big-screen window in the call, and when a player claims, type their ticket number into Check a claim.' },
      { q: 'Do I have to keep a list of who has which ticket?', a: 'No. The ticket number is enough: the caller rebuilds the ticket from it and checks the claim against the numbers called. Writing names next to numbers is only needed if you want to know who has which ticket before they claim.' },
      { q: 'Is this the same as 90-ball bingo?', a: 'Yes. Tambola, Housie and UK 90-ball bingo use the same tickets: three rows, nine columns, fifteen numbers, six to a strip. Only the prize names differ; the caller can check One line and Two lines as well.' },
      { q: 'Is anything uploaded?', a: 'No. The tickets, the PDF and the pictures are all made by your browser on this device, and nothing is sent anywhere.' }
    ],
    related: ['/utilities/random-number-generator/', '/utilities/dice-roller/'],
    landings: [
      {
        slug: 'printable-tambola-tickets',
        title: 'Printable Tambola Tickets (Strip of 6)',
        description: 'Print Tambola tickets in strips of six: every number 1–90 once a strip, six or twelve tickets a page on A4 or Letter, with cut lines and a number on each ticket. Free.',
        lede: 'Twenty-four ready-to-print Tambola tickets — four strips of six, six to an A4 page, cut lines and a ticket number on each — or as many as you need.',
        preset: { count: 24, perPage: 6 },
        about: [
          'Set up for printing at home: 24 tickets, six to a page, so four sheets of A4 make four complete strips. Change the number, choose twelve a page to save paper, or switch to US Letter.',
          'Each strip of six uses every number 1–90 once, the way printed Tambola books do. The number on each ticket lets the Tambola Number Caller check any claim from it.'
        ],
        faq: [
          { q: 'Will they print on an ordinary home printer?', a: 'Yes. They print in colour or black and white on plain A4 or Letter paper; the dashed lines show where to cut. Set the print dialog to 100% (or “Actual size”) so twelve a page stay readable.' },
          { q: 'Can I print more later that do not repeat the first ones?', a: 'Yes. Keep the same set code and ask for more tickets: tickets 25 onwards are new strips, and tickets 1–24 come out exactly as before.' }
        ]
      },
      {
        slug: 'tambola-tickets-for-whatsapp',
        title: 'Tambola Tickets for WhatsApp and Kitty Parties',
        description: 'Make Tambola tickets as pictures to send on WhatsApp for a kitty party or a video-call game, each with its own ticket number for checking claims. Free, nothing uploaded.',
        lede: 'One picture per ticket, ready to send on WhatsApp: perfect for a kitty party or a family game on a video call, with every claim checked from the ticket number.',
        preset: { count: 12, title: 'Kitty party Tambola', pictures: true },
        about: [
          'Set up for sending: twelve tickets titled “Kitty party Tambola”, with Ticket pictures at the top. Download each picture and send it to a player, or download the lot as a ZIP and send them from your computer.',
          'On phones that can share files, Share picture opens your apps, WhatsApp among them, with the ticket attached.'
        ],
        faq: [
          { q: 'How do players mark a ticket picture?', a: 'Most write the numbers on paper, or mark the picture with their phone’s photo editor. The ticket number on the picture is what they read out when they claim.' },
          { q: 'Do the pictures work on any phone?', a: 'Yes. They are ordinary PNG images, readable on any phone that shows photos.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit, T = window.TambolaCore;

  const STR = {
    strips: (n) => n + ' tickets = ' + (n / 6) + ' strip' + (n === 6 ? '' : 's') + ' of six.',
    rounded: (a, b) => 'Tickets come in strips of six, so ' + a + ' became ' + b + '.',
    pages: (n, per) => { const p = Math.ceil(n / per); return p + ' page' + (p === 1 ? '' : 's') + ' at ' + per + ' a page.'; },
    firstStrip: (s, n) => 'The first strip (tickets 1–6 of ' + n + ') from set ' + s + '. Every number 1–90 appears once in each strip.',
    printing: 'Opening the print dialog…',
    pdfLoading: 'Making the PDF…',
    pdfDone: (name, pages) => 'Saved ' + name + ' (' + pages + ' page' + (pages === 1 ? '' : 's') + ').',
    pdfFonts: 'The PDF fonts cannot draw some letters in your title, so they print as “?”. Use Print for a title in Hindi or another script.',
    picDone: (name) => 'Saved ' + name + '.',
    zipMaking: (i, n) => 'Drawing ticket ' + i + ' of ' + n + '…',
    zipDone: (name, n) => 'Saved ' + name + ' with ' + n + ' pictures.',
    cancelled: 'Stopped. Nothing was saved.',
    lastSet: (s) => 'Use last printed set ' + s,
    caller: (s) => 'Open the caller for set ' + s,
    failed: (e) => 'That did not work: ' + e
  };
  const MAX = 600;

  /* ---------- the maths (pure; build/tests/games checks it) ---------- */

  function normCount(v) {
    const n = Math.round(Number(v) || 0);
    return Math.max(6, Math.min(MAX, Math.ceil(n / 6) * 6));
  }
  /** The print grid and the cell sizes (mm) for a ticket slot. */
  function layoutFor(paper, perPage) {
    const P = T.PAPER[paper] || T.PAPER.a4;
    const W = P.w - 2 * T.MARGIN, H = P.h - 2 * T.MARGIN;
    const cols = perPage === 12 ? 2 : 1, rows = 6;
    const slotW = W / cols, slotH = H / rows;
    const head = 5.8, pad = 5, border = 1.4;
    const cellH = Math.floor(((slotH - pad - border - head) / 3 - 0.3) * 10) / 10;
    const cellW = (slotW - pad - border) / 9;
    const fs = Math.round(Math.min(cellH * 0.55, cellW * 0.52) * 10) / 10;
    return { W, H, cols, rows, slotW, slotH, cellH, cellW, fs, head };
  }
  window.GAME_TOOLS[SLUG].maths = { normCount, layoutFor };

  /* ---------- drawing: canvas and PDF ---------- */

  function canvasTicket(t, o, tk) {
    const W = 1080, pad = 24, headH = 76, cw = (W - 2 * pad) / 9, ch = 104;
    const H = pad * 2 + headH + ch * 3;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const col = tk.t[o.colour] || tk.t[1];
    g.fillStyle = tk.paper; g.fillRect(0, 0, W, H);
    g.fillStyle = col; g.fillRect(pad, pad, W - 2 * pad, headH);
    g.fillStyle = tk.paper;
    g.textBaseline = 'middle';
    g.font = '700 38px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    g.textAlign = 'left';
    const title = o.title || 'Tambola';
    let tt = title;
    while (g.measureText(tt).width > W - 2 * pad - 330 && tt.length > 1) tt = tt.slice(0, -1);
    g.fillText(tt === title ? tt : tt + '…', pad + 18, pad + headH / 2);
    g.textAlign = 'right';
    g.fillText(t.id, W - pad - 18, pad + headH / 2);
    const top = pad + headH;
    g.strokeStyle = tk.line; g.lineWidth = 2;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) {
      const x = pad + k * cw, y = top + r * ch, v = t.rows[r][k];
      if (!v) { g.fillStyle = tk.paper; g.fillRect(x, y, cw, ch); }
      g.strokeRect(x, y, cw, ch);
      if (v) {
        g.fillStyle = tk.ink; g.textAlign = 'center';
        g.font = '800 54px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
        g.fillText(String(v), x + cw / 2, y + ch / 2 + 2);
      }
    }
    g.strokeStyle = col; g.lineWidth = 6;
    g.strokeRect(pad, pad, W - 2 * pad, H - 2 * pad);
    return c;
  }
  const toBlob = (c) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('the picture could not be made'))), 'image/png'));
  const extOf = (blob, fallback) => ({ 'image/png': 'png', 'application/pdf': 'pdf', 'application/zip': 'zip' })[blob.type] || fallback;

  const MM = 72 / 25.4;
  const rgbOp = (hex) => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex) || [0, '00', '00', '00']; return [1, 2, 3].map((i) => (parseInt(m[i], 16) / 255).toFixed(3)).join(' '); };
  function pdfPages(core, tickets, o, tk) {
    const L = layoutFor(o.paper, o.perPage);
    const P = T.PAPER[o.paper] || T.PAPER.a4;
    const pw = P.w * MM, ph = P.h * MM, m = T.MARGIN * MM;
    const per = L.cols * L.rows;
    const col = tk.t[o.colour] || tk.t[1];
    const pages = [];
    for (let i = 0; i < tickets.length; i += per) {
      const ops = [];
      const slice = tickets.slice(i, i + per);
      /* cut lines: dashed, round every slot */
      let raw = 'q ' + rgbOp(tk.cut) + ' RG 0.6 w [3 3] 0 d\n';
      for (let r = 0; r <= L.rows; r++) { const y = ph - m - r * L.slotH * MM; raw += m.toFixed(2) + ' ' + y.toFixed(2) + ' m ' + (pw - m).toFixed(2) + ' ' + y.toFixed(2) + ' l S\n'; }
      for (let c = 0; c <= L.cols; c++) { const x = m + c * L.slotW * MM; raw += x.toFixed(2) + ' ' + (ph - m).toFixed(2) + ' m ' + x.toFixed(2) + ' ' + (ph - m - L.rows * L.slotH * MM).toFixed(2) + ' l S\n'; }
      ops.push({ raw: raw + 'Q' });
      slice.forEach((t, j) => {
        const c = j % L.cols, r = Math.floor(j / L.cols);
        const x0 = m + c * L.slotW * MM + 2.5 * MM, yTop = ph - m - r * L.slotH * MM - 2.5 * MM;
        const w = (L.slotW - 5) * MM, cw = w / 9, chh = L.cellH * MM, hh = L.head * MM;
        const h = hh + 3 * chh;
        const yb = yTop - h;
        ops.push({ rect: [x0, yTop - hh, w, hh], fill: col });
        const ts = Math.min(10, hh * 0.55);
        ops.push({ text: o.title || 'Tambola', x: x0 + 2 * MM, y: yTop - hh / 2 - ts * 0.35, size: ts, font: 'Helvetica-Bold', colour: tk.paper });
        ops.push({ text: t.id, x: x0 + w - 2 * MM, y: yTop - hh / 2 - ts * 0.35, size: ts, font: 'Helvetica-Bold', colour: tk.paper, align: 'right' });
        const fs = L.fs * MM;
        for (let rr = 0; rr < 3; rr++) for (let k = 0; k < 9; k++) {
          const cx = x0 + k * cw, cy = yTop - hh - (rr + 1) * chh;
          ops.push({ rect: [cx, cy, cw, chh], stroke: tk.line, lineWidth: 0.6 });
          const v = t.rows[rr][k];
          if (v) ops.push({ text: String(v), x: cx + cw / 2, y: cy + chh / 2 - fs * 0.36, size: fs, font: 'Helvetica-Bold', colour: tk.ink, align: 'center' });
        }
        ops.push({ rect: [x0, yb, w, h], stroke: col, lineWidth: 1.6 });
      });
      pages.push({ size: [pw, ph], ops: ops });
    }
    return pages;
  }

  /* ---------- the page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const store = K.store(SLUG, 1);
    const preset = K.preset(root);
    const saved = store.get({}) || {};
    const opt = Object.assign({ count: 12, title: 'Tambola', colour: 1, paper: 'a4', perPage: 6, lastSeed: '' }, saved, preset);
    let seed = K.newSeed(6);
    let busy = null;

    const cols = K.el('div', 'game-cols');
    const left = K.el('section', 'game-panel');
    left.appendChild(K.el('h2', null, 'Your tickets'));
    const count = K.el('input'); count.type = 'number'; count.min = '6'; count.max = String(MAX); count.step = '6'; count.inputMode = 'numeric';
    count.value = String(normCount(opt.count));
    left.appendChild(K.field('How many tickets', count, '6 to 600, in strips of six.').wrap);
    const countMsg = K.el('p', 'game-msg');
    countMsg.style.marginBottom = '14px';
    left.appendChild(countMsg);
    const title = K.el('input'); title.type = 'text'; title.maxLength = 40; title.value = opt.title; title.placeholder = 'Diwali 2026 at the Sharmas';
    left.appendChild(K.field('Title on each ticket', title).wrap);
    const colour = K.el('select');
    T.COLOURS.forEach((c, i) => { const o = K.el('option', null, c); o.value = String(i + 1); colour.appendChild(o); });
    colour.value = String(opt.colour);
    left.appendChild(K.field('Colour', colour).wrap);
    const seedIn = K.el('input'); seedIn.type = 'text'; seedIn.maxLength = 16; seedIn.value = seed; seedIn.autocapitalize = 'characters'; seedIn.spellcheck = false;
    const seedF = K.field('Set code', seedIn, 'A fresh code makes new tickets. Type a code from an old ticket to print the same tickets again.');
    const seedRow = K.el('div', 'game-row');
    const fresh = K.button('New code', 'btn-ghost', () => { seed = K.newSeed(6); seedIn.value = seed; refresh(); });
    const lastB = K.button('', 'btn-ghost', () => { seed = opt.lastSeed; seedIn.value = seed; refresh(); });
    seedRow.appendChild(fresh); seedRow.appendChild(lastB);
    seedF.wrap.appendChild(seedRow);
    left.appendChild(seedF.wrap);

    const printSec = K.el('div');
    printSec.appendChild(K.el('h3', null, 'Print or PDF'));
    const paper = K.el('select');
    [['a4', 'A4'], ['letter', 'US Letter']].forEach((p) => { const o = K.el('option', null, p[1]); o.value = p[0]; paper.appendChild(o); });
    paper.value = opt.paper === 'letter' ? 'letter' : 'a4';
    const per = K.el('select');
    [['6', '6 tickets a page'], ['12', '12 tickets a page']].forEach((p) => { const o = K.el('option', null, p[1]); o.value = p[0]; per.appendChild(o); });
    per.value = String(opt.perPage === 12 ? 12 : 6);
    printSec.appendChild(K.field('Paper', paper).wrap);
    printSec.appendChild(K.field('Layout', per).wrap);
    const pRow = K.el('div', 'game-row');
    const printB = K.button('Print', 'btn-primary game-big', doPrint);
    const pdfB = K.button('Download PDF', 'btn-ghost', doPdf);
    pRow.appendChild(printB); pRow.appendChild(pdfB);
    printSec.appendChild(pRow);
    const printMsg = K.el('p', 'game-msg');
    printMsg.setAttribute('role', 'status');
    printMsg.style.marginTop = '10px';
    printSec.appendChild(printMsg);

    const picSec = K.el('div');
    picSec.appendChild(K.el('h3', null, 'Ticket pictures (for WhatsApp)'));
    const picN = K.el('input'); picN.type = 'number'; picN.min = '1'; picN.inputMode = 'numeric'; picN.value = '1';
    picSec.appendChild(K.field('Ticket number', picN).wrap);
    const picRow = K.el('div', 'game-row');
    const picB = K.button('Download picture', 'btn-primary', () => onePicture(false));
    const shareB = K.button('Share picture', 'btn-ghost', () => onePicture(true));
    const canShare = !!(navigator.canShare && window.File && (() => { try { return navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }); } catch (e) { return false; } })());
    shareB.hidden = !canShare;
    const zipB = K.button('All pictures as ZIP', 'btn-ghost', allPictures);
    const stopB = K.button('Stop', 'btn-ghost', () => { if (busy) busy.stop = true; });
    stopB.hidden = true;
    [picB, shareB, zipB, stopB].forEach((b) => picRow.appendChild(b));
    picSec.appendChild(picRow);
    const prog = K.el('progress', 'tc-progress'); prog.hidden = true; prog.max = 1; prog.value = 0;
    picSec.appendChild(prog);
    const picMsg = K.el('p', 'game-msg');
    picMsg.setAttribute('role', 'status');
    picMsg.style.marginTop = '10px';
    picSec.appendChild(picMsg);

    const callerA = K.el('a', 'btn-ghost');
    const callerRow = K.el('div', 'game-row');
    callerRow.style.marginTop = '14px';
    callerRow.appendChild(callerA);

    [printSec, picSec].forEach((s) => { s.style.marginTop = '18px'; });
    if (preset.pictures) { left.appendChild(picSec); left.appendChild(printSec); } else { left.appendChild(printSec); left.appendChild(picSec); }
    left.appendChild(callerRow);

    const right = K.el('section', 'game-panel');
    right.appendChild(K.el('h2', null, 'The first strip'));
    const stripNote = K.el('p', 'tk-note');
    stripNote.style.marginBottom = '12px';
    right.appendChild(stripNote);
    const strip = K.el('div', 'tk-strip');
    right.appendChild(strip);
    right.appendChild(stage.bar());

    cols.appendChild(left); cols.appendChild(right);
    io.appendChild(cols);

    function read() {
      const raw = Math.round(Number(count.value) || 0);
      const n = normCount(raw);
      seed = T.cleanSeed(seedIn.value) || seed;
      return { n, raw, seed, title: title.value.trim().slice(0, 40) || 'Tambola', colour: Number(colour.value) || 1, paper: paper.value, perPage: Number(per.value) === 12 ? 12 : 6 };
    }
    function persist(o) {
      store.set({ count: o.n, title: title.value.trim().slice(0, 40), colour: o.colour, paper: o.paper, perPage: o.perPage, lastSeed: opt.lastSeed });
    }
    let roundedFrom = 0;
    function refresh() {
      const o = read();
      const from = o.raw && o.raw !== o.n ? o.raw : roundedFrom;
      countMsg.textContent = (from && from !== o.n ? STR.rounded(from, o.n) + ' ' : '') + STR.strips(o.n) + ' ' + STR.pages(o.n, o.perPage);
      countMsg.className = 'game-msg' + (from && from !== o.n ? ' is-warn' : '');
      strip.textContent = '';
      T.ticketStrip(o.seed, 1).forEach((t) => strip.appendChild(T.ticketEl(t, { title: o.title, colour: o.colour })));
      stripNote.textContent = STR.firstStrip(o.seed, o.n);
      picN.max = String(o.n);
      callerA.textContent = STR.caller(o.seed);
      callerA.href = '/games/tambola-number-caller/?seed=' + encodeURIComponent(o.seed);
      lastB.hidden = !opt.lastSeed || opt.lastSeed === o.seed;
      lastB.textContent = STR.lastSet(opt.lastSeed);
      persist(o);
      stage.update({ title: o.title, seed: o.seed, colour: o.colour, strip: T.ticketStrip(o.seed, 1).map((t) => ({ id: t.id, rows: t.rows })) });
      return o;
    }
    function remember(o) { opt.lastSeed = o.seed; persist(o); }
    function tickets(o) {
      const out = [];
      for (let s = 1; s <= o.n / 6; s++) T.ticketStrip(o.seed, s).forEach((t) => out.push(t));
      return out;
    }
    function buildPrint() {
      const o = read();
      const L = layoutFor(o.paper, o.perPage);
      const items = tickets(o).map((t) => T.ticketEl(t, { title: o.title, colour: o.colour }));
      T.printSheets(items, { paper: o.paper, cols: L.cols, rows: L.rows, vars: { '--cell-h': L.cellH + 'mm', '--cell-fs': L.fs + 'mm' } });
      return o;
    }
    function doPrint() {
      const o = buildPrint();
      remember(o);
      printMsg.textContent = STR.printing;
      window.print();
      printMsg.textContent = STR.pages(o.n, o.perPage);
    }
    /* Ctrl+P prints the tickets too, with the settings on the screen now */
    window.addEventListener('beforeprint', () => { if (!document.querySelector('body > .tt-print')) buildPrint(); });
    window.addEventListener('afterprint', () => { setTimeout(T.clearPrint, 0); });

    function doPdf() {
      const o = read();
      printMsg.textContent = STR.pdfLoading;
      pdfB.disabled = true;
      T.loadPdf().then((core) => {
        const tk = T.tokens();
        const pages = pdfPages(core, tickets(o), o, tk);
        const bytes = core.createPDF(pages, { pageSize: o.paper, info: { Title: o.title + ' — Tambola tickets ' + o.seed } });
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const name = 'tambola-tickets-' + o.seed + '.' + extOf(blob, 'pdf');
        K.download(blob, name);
        remember(o);
        const warn = /[^\x20-\x7e -ÿ–—‘’“”…]/.test(o.title);
        printMsg.textContent = STR.pdfDone(name, pages.length) + (warn ? ' ' + STR.pdfFonts : '');
        printMsg.className = 'game-msg' + (warn ? ' is-warn' : '');
        K.announce(root, printMsg.textContent);
      }).catch((e) => { printMsg.textContent = STR.failed(e.message || e); printMsg.className = 'game-msg is-warn'; })
        .then(() => { pdfB.disabled = false; });
    }

    function onePicture(share) {
      const o = read();
      const n = Math.max(1, Math.min(o.n, Math.round(Number(picN.value) || 1)));
      picN.value = String(n);
      const t = T.ticket(o.seed, n);
      toBlob(canvasTicket(t, o, T.tokens())).then((blob) => {
        const name = 'tambola-' + t.id + '.' + extOf(blob, 'png');
        remember(o);
        if (share && canShare) {
          const file = new File([blob], name, { type: blob.type });
          return navigator.share({ files: [file], title: o.title + ' ' + t.id }).then(() => { picMsg.textContent = t.id; }).catch(() => {});
        }
        K.download(blob, name);
        picMsg.textContent = STR.picDone(name);
        K.announce(root, picMsg.textContent);
        if (n < o.n) picN.value = String(n + 1);
      }).catch((e) => { picMsg.textContent = STR.failed(e.message || e); });
    }
    async function allPictures() {
      if (busy) return;
      const o = read();
      busy = { stop: false };
      zipB.disabled = true; stopB.hidden = false; prog.hidden = false; prog.value = 0;
      try {
        const zip = await T.loadZip();
        const tk = T.tokens();
        const files = [];
        const list = tickets(o);
        for (let i = 0; i < list.length; i++) {
          if (busy.stop) { picMsg.textContent = STR.cancelled; return; }
          const blob = await toBlob(canvasTicket(list[i], o, tk));
          files.push({ name: 'tambola-' + list[i].id + '.' + extOf(blob, 'png'), blob: blob });
          if (i % 6 === 5 || i === list.length - 1) {
            prog.value = (i + 1) / list.length;
            picMsg.textContent = STR.zipMaking(i + 1, list.length);
            await new Promise((r) => setTimeout(r, 0));
          }
        }
        const blob = await zip(files);
        const name = 'tambola-tickets-' + o.seed + '.' + extOf(blob, 'zip');
        K.download(blob, name);
        remember(o);
        picMsg.textContent = STR.zipDone(name, files.length);
        K.announce(root, picMsg.textContent);
      } catch (e) {
        picMsg.textContent = STR.failed(e.message || e);
      } finally {
        busy = null; zipB.disabled = false; stopB.hidden = true; prog.hidden = true;
      }
    }

    count.addEventListener('change', () => { const o = read(); roundedFrom = o.raw !== o.n ? o.raw : 0; count.value = String(o.n); refresh(); });
    count.addEventListener('input', () => { roundedFrom = 0; refresh(); });
    [title, colour, paper, per].forEach((x) => x.addEventListener(x.tagName === 'INPUT' ? 'input' : 'change', refresh));
    seedIn.addEventListener('change', () => { seedIn.value = T.cleanSeed(seedIn.value) || seed; refresh(); });
    refresh();
  }

  /* the big screen: the first strip, for showing players on a video call how a ticket reads */
  function renderStage(body, s) {
    body.textContent = '';
    if (!s.strip) { body.appendChild(K.el('p', 'game-stage-wait', 'The tickets will appear here.')); return; }
    body.appendChild(K.el('h1', 'st-title', (s.title || 'Tambola') + ' · set ' + s.seed));
    const grid = K.el('div', 'tcs-strip');
    s.strip.forEach((t) => grid.appendChild(T.ticketEl(t, { title: s.title, colour: s.colour })));
    body.appendChild(grid);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K || !T) return;
    const stage = K.stage({ slug: SLUG, title: 'Tambola tickets', render: renderStage });
    if (stage.isStage) return;
    mount(root, stage);
  });
})();
