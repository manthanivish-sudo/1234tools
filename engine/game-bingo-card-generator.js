/**
 * Bingo cards and a caller, on the device.
 *
 * Two kinds of card, each made from a set code (seed) and its number, so the
 * same code reprints the same cards (the ID on a card is SEED-NNN):
 *   - 75-ball: 5×5, B 1–15, I 16–30, N 31–45 with a free centre, G 46–60,
 *     O 61–75 — five different numbers from each column's range (four in N);
 *   - word bingo from the visitor's own list: 3×3, 4×4 or 5×5, optionally a
 *     free centre (odd sizes), each word at most once on a card.
 * Print through window.print() (1, 2 or 4 cards a page), a PDF drawn by
 * /engine/pdfcore.bundle.js loaded only when asked for, and a caller for the
 * same game: a fair draw (GameKit.randInt) of the numbers or the words, the
 * board, the big screen and, if wanted, the browser's voice.
 */
(function () {
  'use strict';
  window.GAME_TOOLS = window.GAME_TOOLS || {};
  const SLUG = 'bingo-card-generator';
  const BABY = 'Bottle\nNappy\nPram\nRattle\nBib\nCot\nBlanket\nTeddy\nDummy\nBabygrow\nBooties\nLullaby\nBath time\nCuddles\nTwins\nMidwife\nBump\nSleep\nPushchair\nSocks\nMittens\nCrawling\nGiggles\nFirst tooth\nGrandma\nBedtime story\nWipes\nNursery\nFirst smile\nBaby monitor';
  const VOCAB = 'noun\nverb\nadjective\nadverb\nsynonym\nantonym\nprefix\nsuffix\nsimile\nmetaphor\nrhyme\nsyllable\nvowel\nconsonant\nplural\npronoun\nconjunction\npreposition\nparagraph\nsentence';
  window.GAME_TOOLS[SLUG] = {
    order: 5,
    title: 'Bingo Card Generator',
    short: 'Bingo Cards',
    description: 'Print bingo cards: classic 75-ball cards with a free centre, or word bingo from your own list for a baby shower or a classroom. Numbered cards, 1, 2 or 4 a page, a PDF, and a caller for the same game. Free, no sign-up.',
    keywords: ['bingo card generator', 'printable bingo cards', '75 ball bingo cards', 'word bingo generator', 'baby shower bingo', 'vocabulary bingo', 'custom bingo cards', 'bingo caller'],
    glyph: 'i-bingo-card-generator',
    glyphSvg: '<symbol id="i-bingo-card-generator" viewBox="0 0 24 24">\n  <rect x="3.5" y="3.5" width="17" height="17" rx="2"/>\n  <path d="M3.5 8.2h17M3.5 12.4h17M3.5 16.4h17M8.2 8.2v12.3M12 8.2v12.3M15.8 8.2v12.3" class="thin"/>\n  <circle cx="14" cy="14.4" r="1.1" class="fill"/>\n  <circle cx="6" cy="10.3" r="1.1" class="fill"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/game-tambola-core.js', '/engine/game-bingo-card-generator.js'],
    privacy: 'Cards are made by your browser from the set code and, for word bingo, your own list; nothing is uploaded. Your list, your settings and the game in the caller are kept on this device so a refresh loses nothing; New game clears the caller.',
    how: [
      'Choose 75-ball numbers, or Word bingo and type your words, one per line (at least as many as there are squares).',
      'Choose how many cards, the title and a colour; keep the fresh set code or type an old one to reprint the same cards.',
      'Press Print (1, 2 or 4 cards a page on A4 or US Letter) or Download PDF.',
      'On the day, open Call the game: each press of Next draws a number or a word fairly, lights it on the board and shows it big on the TV.'
    ],
    uses: [
      ['Baby shower', 'word bingo with baby words, ticked off as the presents are opened'],
      ['Classroom', 'vocabulary bingo: the teacher reads a definition, pupils find the word'],
      ['Bingo night', 'classic 75-ball cards for the family, called on the TV']
    ],
    tips: [
      '75-ball cards follow the usual columns — B 1–15, I 16–30, N 31–45, G 46–60, O 61–75 — with five different numbers in each column and a FREE square in the middle.',
      'Word cards need at least as many words as squares: 9 for 3×3, 16 for 4×4, 25 for 5×5 (one fewer with a free centre). The page says how many more you need. A longer list makes the cards more different from each other.',
      'No word appears twice on a card, and repeated words in your list are counted once.',
      'The set code and the card number are printed on each card. The same code, the same kind of card and the same list in the same order make exactly the same cards again.',
      'The caller draws from the numbers or words not yet called with your browser’s cryptographic random generator, so each is equally likely and none repeats. Undo takes back a mistake.',
      'Space or Enter calls the next one while Call the game is open; Show on TV puts the current call, the last five and the board on the big screen.'
    ],
    faq: [
      { q: 'What is 75-ball bingo?', a: 'The American style of bingo: a 5×5 card headed B-I-N-G-O, each column drawn from its own fifteen numbers, and a free square in the centre. Common wins are a line in any direction, four corners and a full card. (UK 90-ball tickets are a different shape: use the Tambola Ticket Generator.)' },
      { q: 'How many words do I need for word bingo?', a: 'At least as many as squares: 9 for a 3×3 card, 16 for 4×4 and 25 for 5×5, or one fewer with a free centre. With exactly that many, every card has the same words in a different order; add more words and the cards differ more.' },
      { q: 'Can I reprint the same cards?', a: 'Yes. Every card shows its set code and number. Type the code into Set code, with the same kind of card and, for word bingo, the same list in the same order, and the cards come out exactly the same.' },
      { q: 'How many cards fit on a page?', a: 'One, two or four, on A4 or US Letter. One a page is best for young children and older eyes; four a page saves paper for a big group.' },
      { q: 'Does it call the game too?', a: 'Yes. Open Call the game: it draws numbers 1–75 (shown as B 7, N 42 and so on) or the words from your list, one at a time, fairly and without repeats, with a board of what has been called, the last five, an optional voice and a big-screen view for the TV.' },
      { q: 'Can I use my own pictures or emoji?', a: 'Words only: cards show text from your list. Emoji usually print on the page, but the PDF uses the standard PDF fonts, which cannot draw emoji or non-Latin letters; use Print for those.' },
      { q: 'Is anything uploaded?', a: 'No. Your words and the cards stay on this device, and the PDF is made by your browser.' }
    ],
    related: ['/utilities/random-number-generator/', '/utilities/dice-roller/'],
    landings: [
      {
        slug: 'baby-shower-bingo',
        title: 'Baby Shower Bingo Cards',
        description: 'Printable baby shower bingo: 5×5 word cards with a free centre, filled from 30 baby words you can change, two to a page, plus a caller for the TV. Free, nothing uploaded.',
        lede: 'Thirty baby words — bottle, rattle, first smile — shuffled onto 5×5 cards with a free centre, two to a page. Change any word, print, and play while the presents are opened.',
        preset: { mode: 'words', size: 5, free: true, words: BABY, listKey: 'baby', title: 'Baby shower bingo', count: 20, perPage: 2, colour: 3 },
        about: [
          'Set up for a baby shower: 5×5 cards with a free centre, twenty of them, two to a page, from a list of thirty baby words. Swap in your own — the baby’s name, the nursery theme, the gifts you expect — one per line.',
          'Two ways to play: guests mark the gifts as they are opened, or open Call the game and the page draws the words for you, on the TV if you like.'
        ],
        faq: [
          { q: 'How many words should a baby shower bingo list have?', a: 'At least 24 for 5×5 cards with a free centre; 30 or more makes the cards more different, so there are fewer shared wins. The list here starts with thirty.' },
          { q: 'Will my changes to the word list be kept?', a: 'Yes, on this device: the list you edit on this page is saved in your browser and comes back next time.' }
        ]
      },
      {
        slug: 'classroom-vocabulary-bingo',
        title: 'Classroom Vocabulary Bingo Cards',
        description: 'Make vocabulary bingo cards from your class word list: 4×4 cards, each word once per card, a card for every pupil, and a caller that draws the words fairly on the board.',
        lede: 'Paste this week’s words, print a card for every pupil, and call the words — or read their definitions — from the board.',
        preset: { mode: 'words', size: 4, free: false, words: VOCAB, listKey: 'class', title: 'Vocabulary bingo', count: 30, perPage: 4, colour: 2 },
        about: [
          'Set up for a class: thirty 4×4 cards, four to a page, from a list of twenty grammar words. Replace them with your own topic words, one per line; you need at least sixteen.',
          'Open Call the game on the classroom screen: each press of Space draws a word fairly. Read out its definition instead of the word for a harder game.'
        ],
        faq: [
          { q: 'Can every pupil get a different card?', a: 'Yes. Each card is a fresh shuffle of your list, so with more words than squares the cards differ; with exactly sixteen words the same words appear in a different order on each card.' },
          { q: 'Do the cards work for younger children?', a: 'Yes. Choose 3×3 cards with a free centre and one card a page for big, easy-to-read squares.' }
        ]
      },
      {
        slug: '75-ball-bingo-cards',
        title: '75-Ball Bingo Cards to Print',
        description: 'Print classic 75-ball bingo cards: B 1–15 to O 61–75 with a free centre, four to a page with a number on each, and a 1–75 caller with a TV board. Free, no sign-up.',
        lede: 'Classic B-I-N-G-O cards with a free centre, four to a page, each with its own number — and a caller that draws 1–75 on the big screen.',
        preset: { mode: 'numbers', count: 12, perPage: 4, title: 'Bingo' },
        about: [
          'Set up for a bingo night: twelve 75-ball cards, four to a page on A4. Every column has five different numbers from its own range, and the centre square is free.',
          'Open Call the game and press Space for each ball: the call appears as B 7 or O 64, lit on a 1–75 board, and big on the TV.'
        ],
        faq: [
          { q: 'Are these the same as the bingo cards in the shops?', a: 'They follow the same 75-ball layout: B 1–15, I 16–30, N 31–45 with the free centre, G 46–60, O 61–75, five different numbers in each column.' },
          { q: 'How do I check a winning card?', a: 'Read the card number and its numbers back against the board in Call the game, which lights every number called.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit, T = window.TambolaCore;

  const STR = {
    tabCards: 'Make cards', tabCall: 'Call the game',
    modeNum: '75-ball numbers', modeWords: 'Word bingo',
    need: (have, need, size, free) => have + ' different word' + (have === 1 ? '' : 's') + '. A ' + size + '×' + size + ' card' + (free ? ' with a free centre' : '') + ' needs ' + need + (have < need ? ': add ' + (need - have) + ' more.' : '.'),
    firstCards: (n, s) => 'The first cards of ' + n + ' from set ' + s + '.',
    printing: 'Opening the print dialog…',
    pdfLoading: 'Making the PDF…',
    pdfDone: (name, pages) => 'Saved ' + name + ' (' + pages + ' page' + (pages === 1 ? '' : 's') + ').',
    pdfFonts: 'The PDF fonts cannot draw some of your letters or emoji, so they print as “?”. Use Print for those.',
    short: 'Add more words first.',
    start: 'Press Next to start.',
    allDone: 'Everything has been called.',
    next: 'Next  (Space)', undo: 'Undo last call',
    counts: (c, n) => 'Called ' + c + ' of ' + n + ' · ' + (n - c) + ' left',
    took: (x) => 'Took back ' + x + '.',
    newGame: 'New game', confirmQ: 'Clear the board and start a new game?', confirmYes: 'Yes, new game', confirmNo: 'Keep playing',
    noWords: 'Add words on Make cards to call word bingo.',
    failed: (e) => 'That did not work: ' + e
  };
  const LETTERS = 'BINGO';

  /* ---------- the maths (pure; build/tests/games checks it) ---------- */

  const pad = (n) => (n < 100 ? ('00' + n).slice(-3) : String(n));
  const letter = (n) => LETTERS[Math.floor((n - 1) / 15)] || '';
  const label = (x) => (typeof x === 'number' ? letter(x) + ' ' + x : String(x));
  function card75(seed, n) {
    seed = T.cleanSeed(seed);
    const g = K.seeded(seed + ':b75:' + n);
    const grid = Array.from({ length: 5 }, () => new Array(5).fill(0));
    for (let c = 0; c < 5; c++) {
      const nums = [];
      for (let x = c * 15 + 1; x <= c * 15 + 15; x++) nums.push(x);
      const pick = g.shuffle(nums).slice(0, c === 2 ? 4 : 5);
      if (c === 2) pick.splice(2, 0, 0);
      for (let r = 0; r < 5; r++) grid[r][c] = pick[r];
    }
    return { id: seed + '-' + pad(n), n: n, kind: 'numbers', size: 5, free: true, grid: grid };
  }
  /** The words, cleaned: trimmed, one per line, repeats (any case) dropped. */
  function wordList(text) {
    const seen = new Set();
    return K.parseList(text, { lines: true, max: 300, maxLen: 40 }).filter((w) => {
      const k = w.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }
  const hasFree = (size, free) => !!free && size % 2 === 1;
  const squares = (size, free) => size * size - (hasFree(size, free) ? 1 : 0);
  function cardWords(seed, n, words, size, free) {
    seed = T.cleanSeed(seed);
    const f = hasFree(size, free);
    const need = squares(size, free);
    if (words.length < need) return null;
    const g = K.seeded(seed + ':w' + size + (f ? 'f' : '') + ':' + n);
    const pick = g.shuffle(words).slice(0, need);
    const grid = [];
    let k = 0;
    const mid = Math.floor(size / 2);
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) row.push(f && r === mid && c === mid ? null : pick[k++]);
      grid.push(row);
    }
    return { id: seed + '-' + pad(n), n: n, kind: 'words', size: size, free: f, grid: grid };
  }
  function pool(mode, words) {
    if (mode === 'words') return words.slice();
    return Array.from({ length: 75 }, (_, i) => i + 1);
  }
  function draw(called, all, randInt) {
    const seen = new Set(called.map((x) => (typeof x === 'string' ? x.toLowerCase() : x)));
    const left = all.filter((x) => !seen.has(typeof x === 'string' ? x.toLowerCase() : x));
    return left.length ? left[randInt(left.length)] : null;
  }
  window.GAME_TOOLS[SLUG].maths = { card75, cardWords, wordList, squares, pool, draw, letter, label };

  /* ---------- cards on screen and on paper ---------- */

  function cardEl(cd, o) {
    const box = K.el('div', 'bg-card');
    box.style.setProperty('--tk', 'var(--t' + (o.colour || 1) + ')');
    const head = K.el('div', 'tk-head');
    head.appendChild(K.el('span', 'tk-title', o.title || 'Bingo'));
    head.appendChild(K.el('span', 'tk-id', cd.id));
    box.appendChild(head);
    const tb = K.el('table', 'bg-grid');
    tb.setAttribute('aria-label', 'Card ' + cd.id);
    if (cd.kind === 'numbers') {
      const th = K.el('thead'), tr = K.el('tr');
      for (const L of LETTERS) tr.appendChild(K.el('th', null, L));
      th.appendChild(tr); tb.appendChild(th);
    }
    const body = K.el('tbody');
    cd.grid.forEach((row) => {
      const tr = K.el('tr');
      row.forEach((v) => {
        const td = K.el('td');
        if (v === 0 || v === null) { td.className = 'is-free'; td.textContent = 'FREE'; }
        else td.textContent = String(v);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    tb.appendChild(body);
    box.appendChild(tb);
    return box;
  }
  /** Card size on paper (mm) for a slot. */
  function layoutFor(paper, perPage, kind, size, words) {
    const P = T.PAPER[paper] || T.PAPER.a4;
    const W = P.w - 2 * T.MARGIN, H = P.h - 2 * T.MARGIN;
    const cols = perPage === 4 ? 2 : 1, rows = perPage === 1 ? 1 : 2;
    const slotW = W / cols, slotH = H / rows;
    const head = perPage === 1 ? 10 : 8, letters = kind === 'numbers' ? (perPage === 1 ? 16 : 11) : 0;
    const cell = Math.floor(Math.min((slotW - 7) / size, (slotH - 7 - head - letters) / size) * 10) / 10;
    let longest = 4;
    (words || []).forEach((w) => w.split(/\s+/).forEach((t) => { longest = Math.max(longest, t.length); }));
    const wordFs = Math.max(2.4, Math.round(Math.min(cell * 0.2, (cell * 0.86) / (longest * 0.6)) * 10) / 10);
    return { W, H, cols, rows, slotW, slotH, cell, head, letters, numFs: Math.round(cell * 0.42 * 10) / 10, letterFs: Math.round(letters * 0.62 * 10) / 10, wordFs };
  }

  const MM = 72 / 25.4;
  function pdfPages(core, cards, o, tk, L) {
    const P = T.PAPER[o.paper] || T.PAPER.a4;
    const pw = P.w * MM, ph = P.h * MM, m = T.MARGIN * MM;
    const per = L.cols * L.rows;
    const col = tk.t[o.colour] || tk.t[1];
    const rgbOp = (hex) => { const x = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex) || [0, '99', '99', '99']; return [1, 2, 3].map((i) => (parseInt(x[i], 16) / 255).toFixed(3)).join(' '); };
    const pages = [];
    for (let i = 0; i < cards.length; i += per) {
      const ops = [];
      let raw = 'q ' + rgbOp(tk.cut) + ' RG 0.6 w [3 3] 0 d\n';
      for (let r = 0; r <= L.rows; r++) { const y = ph - m - r * L.slotH * MM; raw += m.toFixed(2) + ' ' + y.toFixed(2) + ' m ' + (pw - m).toFixed(2) + ' ' + y.toFixed(2) + ' l S\n'; }
      for (let c = 0; c <= L.cols; c++) { const x = m + c * L.slotW * MM; raw += x.toFixed(2) + ' ' + (ph - m).toFixed(2) + ' m ' + x.toFixed(2) + ' ' + (ph - m - L.rows * L.slotH * MM).toFixed(2) + ' l S\n'; }
      ops.push({ raw: raw + 'Q' });
      cards.slice(i, i + per).forEach((cd, j) => {
        const c = j % L.cols, r = Math.floor(j / L.cols);
        const cw = L.cell * MM, w = cw * cd.size;
        const hh = L.head * MM, lh = L.letters * MM, h = hh + lh + cw * cd.size;
        const sx = m + c * L.slotW * MM, sy = ph - m - r * L.slotH * MM;
        const x0 = sx + (L.slotW * MM - w) / 2, yTop = sy - (L.slotH * MM - h) / 2;
        ops.push({ rect: [x0, yTop - hh, w, hh], fill: col });
        const ts = Math.min(12, hh * 0.5);
        ops.push({ text: o.title || 'Bingo', x: x0 + 2 * MM, y: yTop - hh / 2 - ts * 0.35, size: ts, font: 'Helvetica-Bold', colour: tk.paper });
        ops.push({ text: cd.id, x: x0 + w - 2 * MM, y: yTop - hh / 2 - ts * 0.35, size: ts, font: 'Helvetica-Bold', colour: tk.paper, align: 'right' });
        if (lh) {
          ops.push({ rect: [x0, yTop - hh - lh, w, lh], fill: col });
          const ls = L.letterFs * MM;
          for (let k = 0; k < 5; k++) ops.push({ text: LETTERS[k], x: x0 + k * cw + cw / 2, y: yTop - hh - lh / 2 - ls * 0.36, size: ls, font: 'Helvetica-Bold', colour: tk.paper, align: 'center' });
        }
        const gy = yTop - hh - lh;
        cd.grid.forEach((row, rr) => row.forEach((v, k) => {
          const cx = x0 + k * cw, cy = gy - (rr + 1) * cw;
          const free = v === 0 || v === null;
          if (free) ops.push({ rect: [cx, cy, cw, cw], fill: col });
          ops.push({ rect: [cx, cy, cw, cw], stroke: tk.line, lineWidth: 0.6 });
          if (free) {
            const fs = Math.min(cw * 0.22, 14);
            ops.push({ text: 'FREE', x: cx + cw / 2, y: cy + cw / 2 - fs * 0.36, size: fs, font: 'Helvetica-Bold', colour: tk.paper, align: 'center' });
          } else if (typeof v === 'number') {
            const fs = L.numFs * MM;
            ops.push({ text: String(v), x: cx + cw / 2, y: cy + cw / 2 - fs * 0.36, size: fs, font: 'Helvetica-Bold', colour: tk.ink, align: 'center' });
          } else {
            let fs = L.wordFs * MM, lines;
            for (;;) {
              lines = core.wrapText(v, 'Helvetica-Bold', fs, cw * 0.88);
              const wide = lines.some((ln) => core.textWidth(ln, 'Helvetica-Bold', fs) > cw * 0.9);
              if ((!wide && lines.length * fs * 1.15 <= cw * 0.86) || fs <= 5) break;
              fs *= 0.9;
            }
            const lead = fs * 1.15, top = cy + cw / 2 + (lines.length * lead) / 2 - fs * 0.86;
            lines.forEach((ln, q) => ops.push({ text: ln, x: cx + cw / 2, y: top - q * lead, size: fs, font: 'Helvetica-Bold', colour: tk.ink, align: 'center' }));
          }
        }));
        ops.push({ rect: [x0, gy - cw * cd.size, w, h], stroke: col, lineWidth: 1.6 });
      });
      pages.push({ size: [pw, ph], ops: ops });
    }
    return pages;
  }

  /* ---------- the big screen ---------- */

  function renderStage(body, s) {
    let v = body._bgs;
    const kind = s.mode === 'words' ? 'words' : 'numbers';
    if (!v || v.kind !== kind || (kind === 'words' && v.key !== (s.words || []).join('\n'))) {
      body.textContent = '';
      const wrap = K.el('div', 'tcs');
      const head = K.el('div', 'tcs-head');
      const title = K.el('span'), count = K.el('span');
      head.appendChild(title); head.appendChild(count);
      const now = K.el('div', 'tcs-now');
      const num = K.el('div', 'tcs-num' + (kind === 'words' ? ' is-word' : ''));
      now.appendChild(num);
      const board = K.el('div', 'tcs-board ' + (kind === 'words' ? 'is-words' : 'is-75'));
      const cells = new Map();
      if (kind === 'numbers') {
        for (let r = 0; r < 5; r++) {
          board.appendChild(K.el('div', 'tcs-cell is-head', LETTERS[r]));
          for (let k = 1; k <= 15; k++) { const n = r * 15 + k; const c = K.el('div', 'tcs-cell', String(n)); cells.set(n, c); board.appendChild(c); }
        }
      } else {
        (s.words || []).forEach((w) => { const c = K.el('div', 'tcs-cell', w); cells.set(w.toLowerCase(), c); board.appendChild(c); });
      }
      const last = K.el('ul', 'tcs-last');
      [head, now, board, last].forEach((x) => wrap.appendChild(x));
      body.appendChild(wrap);
      v = body._bgs = { kind, key: (s.words || []).join('\n'), title, count, num, cells, last, shown: null };
    }
    const called = s.called || [];
    v.title.textContent = s.title || 'Bingo';
    v.count.textContent = called.length + ' / ' + (s.total || 0);
    const key = (x) => (typeof x === 'string' ? x.toLowerCase() : x);
    const on = new Set(called.map(key));
    const cur = called.length ? key(called[called.length - 1]) : null;
    v.cells.forEach((c, k) => { c.classList.toggle('is-on', on.has(k)); c.classList.toggle('is-last', k === cur); });
    v.num.textContent = called.length ? label(called[called.length - 1]) : '–';
    if (cur !== v.shown) { v.shown = cur; v.num.classList.remove('is-new'); void v.num.offsetWidth; v.num.classList.add('is-new'); }
    v.last.textContent = '';
    const prev = called.slice(-6, -1).reverse();
    if (prev.length) {
      v.last.appendChild(K.el('li', 'tcs-lab', 'Before:'));
      prev.forEach((x) => v.last.appendChild(K.el('li', null, label(x))));
    }
  }

  /* ---------- the page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const store = K.store(SLUG, 1);
    const preset = K.preset(root);
    const saved = store.get({}) || {};
    const listKey = preset.listKey || 'own';
    const lists = saved.lists || {};
    const opt = Object.assign({ mode: 'numbers', size: 5, free: true, count: 8, title: 'Bingo', colour: 1, paper: 'a4', perPage: 2 }, saved.opt || {}, preset);
    const wordsText = typeof lists[listKey] === 'string' ? lists[listKey] : (preset.words || '');
    const set = Object.assign({ voice: false, rate: 1 }, saved.set || {});
    let game = saved.game && Array.isArray(saved.game.called) ? saved.game : { mode: opt.mode, called: [] };
    let seed = K.newSeed(6);
    let tab = 'cards';

    /* tabs */
    const tabs = K.el('div', 'game-seg game-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Cards or caller');
    const tCards = K.button(STR.tabCards, null, () => setTab('cards'));
    const tCall = K.button(STR.tabCall, null, () => setTab('call'));
    tabs.appendChild(tCards); tabs.appendChild(tCall);
    io.appendChild(tabs);

    /* ----- make cards ----- */
    const cardsView = K.el('div', 'game-cols');
    const left = K.el('section', 'game-panel');
    left.appendChild(K.el('h2', null, 'Your cards'));
    const modeSeg = K.el('div', 'game-seg');
    modeSeg.setAttribute('role', 'group'); modeSeg.setAttribute('aria-label', 'Kind of card');
    const mNum = K.button(STR.modeNum, null, () => setMode('numbers'));
    const mWords = K.button(STR.modeWords, null, () => setMode('words'));
    modeSeg.appendChild(mNum); modeSeg.appendChild(mWords);
    left.appendChild(K.field('Kind of card', modeSeg).wrap);
    const wordsBox = K.el('div');
    const words = K.el('textarea');
    words.value = wordsText;
    words.placeholder = 'Bottle\nRattle\nTeddy';
    words.spellcheck = true;
    wordsBox.appendChild(K.field('Your words, one per line', words).wrap);
    const sizeS = K.el('select');
    [[3, '3 × 3'], [4, '4 × 4'], [5, '5 × 5']].forEach((x) => { const o = K.el('option', null, x[1]); o.value = String(x[0]); sizeS.appendChild(o); });
    sizeS.value = String([3, 4, 5].indexOf(Number(opt.size)) >= 0 ? opt.size : 5);
    wordsBox.appendChild(K.field('Card size', sizeS).wrap);
    const freeC = K.el('input'); freeC.type = 'checkbox'; freeC.checked = opt.free !== false;
    const freeL = K.el('label', 'game-check'); freeL.appendChild(freeC); freeL.appendChild(document.createTextNode('Free square in the centre (3 × 3 and 5 × 5)'));
    wordsBox.appendChild(freeL);
    const wordsMsg = K.el('p', 'game-msg');
    wordsMsg.setAttribute('role', 'status');
    wordsMsg.style.marginBottom = '14px';
    wordsBox.appendChild(wordsMsg);
    left.appendChild(wordsBox);
    const count = K.el('input'); count.type = 'number'; count.min = '1'; count.max = '200'; count.inputMode = 'numeric'; count.value = String(Math.max(1, Math.min(200, opt.count | 0 || 8)));
    left.appendChild(K.field('How many cards', count, '1 to 200.').wrap);
    const title = K.el('input'); title.type = 'text'; title.maxLength = 40; title.value = opt.title;
    left.appendChild(K.field('Title on each card', title).wrap);
    const colour = K.el('select');
    T.COLOURS.forEach((c, i) => { const o = K.el('option', null, c); o.value = String(i + 1); colour.appendChild(o); });
    colour.value = String(opt.colour || 1);
    left.appendChild(K.field('Colour', colour).wrap);
    const seedIn = K.el('input'); seedIn.type = 'text'; seedIn.maxLength = 16; seedIn.value = seed; seedIn.autocapitalize = 'characters'; seedIn.spellcheck = false;
    const seedF = K.field('Set code', seedIn, 'Type the code from an old card to print the same cards again.');
    seedF.wrap.appendChild(K.button('New code', 'btn-ghost', () => { seed = K.newSeed(6); seedIn.value = seed; refresh(); }));
    left.appendChild(seedF.wrap);
    const paper = K.el('select');
    [['a4', 'A4'], ['letter', 'US Letter']].forEach((p) => { const o = K.el('option', null, p[1]); o.value = p[0]; paper.appendChild(o); });
    paper.value = opt.paper === 'letter' ? 'letter' : 'a4';
    left.appendChild(K.field('Paper', paper).wrap);
    const per = K.el('select');
    [['1', '1 card a page'], ['2', '2 cards a page'], ['4', '4 cards a page']].forEach((p) => { const o = K.el('option', null, p[1]); o.value = p[0]; per.appendChild(o); });
    per.value = String([1, 2, 4].indexOf(Number(opt.perPage)) >= 0 ? opt.perPage : 2);
    left.appendChild(K.field('Layout', per).wrap);
    const pRow = K.el('div', 'game-row');
    const printB = K.button('Print', 'btn-primary game-big', doPrint);
    const pdfB = K.button('Download PDF', 'btn-ghost', doPdf);
    pRow.appendChild(printB); pRow.appendChild(pdfB);
    left.appendChild(pRow);
    const printMsg = K.el('p', 'game-msg');
    printMsg.setAttribute('role', 'status');
    printMsg.style.marginTop = '10px';
    left.appendChild(printMsg);
    const right = K.el('section', 'game-panel');
    right.appendChild(K.el('h2', null, 'Preview'));
    const prevNote = K.el('p', 'tk-note');
    prevNote.style.marginBottom = '12px';
    right.appendChild(prevNote);
    const preview = K.el('div', 'bg-cards');
    right.appendChild(preview);
    cardsView.appendChild(left); cardsView.appendChild(right);
    io.appendChild(cardsView);

    /* ----- call the game ----- */
    const callView = K.el('div', 'game-cols tc-cols');
    const cl = K.el('section', 'game-panel');
    cl.appendChild(K.el('h2', null, 'Call the game'));
    const callSeg = K.el('div', 'game-seg');
    callSeg.setAttribute('role', 'group'); callSeg.setAttribute('aria-label', 'Call');
    const cNum = K.button('Numbers 1–75', null, () => askMode('numbers'));
    const cWords = K.button('Words from your list', null, () => askMode('words'));
    callSeg.appendChild(cNum); callSeg.appendChild(cWords);
    cl.appendChild(K.field('Call', callSeg).wrap);
    const nowBox = K.el('div', 'tc-now');
    const num = K.el('div', 'tc-num', '–');
    const meta = K.el('p', 'tc-meta', STR.start);
    meta.setAttribute('role', 'status');
    nowBox.appendChild(num); nowBox.appendChild(meta);
    cl.appendChild(nowBox);
    const r1 = K.el('div', 'game-row');
    const nextB = K.button(STR.next, 'btn-primary game-big', () => { K.sound.unlock(); callNext(); });
    nextB.setAttribute('aria-keyshortcuts', 'Space Enter');
    const undoB = K.button(STR.undo, 'btn-ghost', undo);
    r1.appendChild(nextB); r1.appendChild(undoB);
    cl.appendChild(r1);
    const counts = K.el('p', 'tc-meta'); counts.style.marginTop = '12px';
    cl.appendChild(counts);
    const last = K.el('ul', 'tc-last');
    last.setAttribute('aria-label', 'The last five');
    cl.appendChild(last);
    const board = K.el('div');
    board.setAttribute('role', 'img');
    cl.appendChild(board);
    cl.appendChild(stage.bar());
    const newRow = K.el('div', 'game-row'); newRow.style.marginTop = '12px';
    const newB = K.button(STR.newGame, 'btn-ghost', () => askNew(null));
    newRow.appendChild(newB);
    cl.appendChild(newRow);
    const confirmBox = K.el('div', 'tc-confirm'); confirmBox.hidden = true;
    const confirmQ = K.el('p', null, STR.confirmQ);
    confirmBox.appendChild(confirmQ);
    let pendingMode = null;
    confirmBox.appendChild(K.button(STR.confirmYes, 'btn-primary', () => { confirmBox.hidden = true; startNew(pendingMode || game.mode); }));
    confirmBox.appendChild(K.button(STR.confirmNo, 'btn-ghost', () => { confirmBox.hidden = true; pendingMode = null; newB.focus(); }));
    cl.appendChild(confirmBox);
    const cr = K.el('section', 'game-panel');
    cr.appendChild(K.el('h2', null, 'Voice'));
    const vOn = K.el('input'); vOn.type = 'checkbox'; vOn.checked = !!set.voice;
    const vOnL = K.el('label', 'game-check'); vOnL.appendChild(vOn); vOnL.appendChild(document.createTextNode('Say each call aloud'));
    cr.appendChild(vOnL);
    const rateS = K.el('select');
    [['0.8', 'Slow'], ['1', 'Normal'], ['1.2', 'Quick']].forEach((r) => { const o = K.el('option', null, r[1]); o.value = r[0]; rateS.appendChild(o); });
    rateS.value = String(set.rate); if (!rateS.value) rateS.value = '1';
    cr.appendChild(K.field('Speed', rateS).wrap);
    cr.appendChild(K.el('p', 'game-msg', K.speech.supported ? 'The voice is your device’s own; with it off, the calls are shown only.' : 'This browser cannot speak, so the calls are shown only.'));
    callView.appendChild(cl); callView.appendChild(cr);
    io.appendChild(callView);

    /* ----- state ----- */
    function persist() {
      lists[listKey] = words.value.slice(0, 20000);
      store.set({ opt: { mode: opt.mode, size: Number(sizeS.value), free: freeC.checked, count: Number(count.value) || 8, title: title.value.trim().slice(0, 40), colour: Number(colour.value) || 1, paper: paper.value, perPage: Number(per.value) || 2 }, lists: lists, set: set, game: game });
    }
    function read() {
      seed = T.cleanSeed(seedIn.value) || seed;
      const list = wordList(words.value);
      const size = Number(sizeS.value) || 5;
      return { mode: opt.mode, seed, list, size, free: freeC.checked, n: Math.max(1, Math.min(200, Math.round(Number(count.value) || 1))), title: title.value.trim().slice(0, 40) || 'Bingo', colour: Number(colour.value) || 1, paper: paper.value, perPage: [1, 2, 4].indexOf(Number(per.value)) >= 0 ? Number(per.value) : 2 };
    }
    function cardsFor(o, max) {
      const out = [];
      const n = Math.min(o.n, max || o.n);
      for (let i = 1; i <= n; i++) {
        const c = o.mode === 'numbers' ? card75(o.seed, i) : cardWords(o.seed, i, o.list, o.size, o.free);
        if (!c) return null;
        out.push(c);
      }
      return out;
    }
    function setMode(m) {
      opt.mode = m === 'words' ? 'words' : 'numbers';
      mNum.setAttribute('aria-pressed', String(opt.mode === 'numbers'));
      mWords.setAttribute('aria-pressed', String(opt.mode === 'words'));
      wordsBox.hidden = opt.mode !== 'words';
      refresh();
    }
    function refresh() {
      const o = read();
      freeC.disabled = o.size % 2 === 0;
      const need = squares(o.size, o.free);
      wordsMsg.textContent = STR.need(o.list.length, need, o.size, o.size % 2 === 1 && o.free);
      wordsMsg.className = 'game-msg' + (o.list.length < need ? ' is-warn' : '');
      const cards = cardsFor(o, 4);
      preview.textContent = '';
      const ok = !!cards;
      printB.disabled = !ok; pdfB.disabled = !ok;
      if (cards) { cards.forEach((c) => preview.appendChild(cardEl(c, o))); prevNote.textContent = STR.firstCards(o.n, o.seed); }
      else prevNote.textContent = STR.short;
      persist();
      paintCaller();
      return o;
    }
    function buildPrint() {
      const o = read();
      const cards = cardsFor(o);
      if (!cards) return null;
      const L = layoutFor(o.paper, o.perPage, o.mode, o.mode === 'numbers' ? 5 : o.size, o.list);
      const items = cards.map((c) => { const e = cardEl(c, o); e.style.width = (L.cell * c.size + 1.2) + 'mm'; return e; });
      T.printSheets(items, { paper: o.paper, cols: L.cols, rows: L.rows, vars: { '--cell-h': L.cell + 'mm', '--cell-fs': (o.mode === 'numbers' ? L.numFs : L.letterFs) + 'mm', '--word-fs': (o.mode === 'numbers' ? L.numFs : L.wordFs) + 'mm' } });
      /* the letter row and the head take their own heights */
      root.ownerDocument.querySelectorAll('body > .tt-print .bg-grid th').forEach((th) => { th.style.height = L.letters + 'mm'; th.style.fontSize = L.letterFs + 'mm'; });
      return o;
    }
    function doPrint() {
      if (!buildPrint()) { printMsg.textContent = STR.short; return; }
      printMsg.textContent = STR.printing;
      window.print();
      printMsg.textContent = '';
    }
    window.addEventListener('beforeprint', () => { if (tab === 'cards' && !document.querySelector('body > .tt-print')) buildPrint(); });
    window.addEventListener('afterprint', () => { setTimeout(T.clearPrint, 0); });
    function doPdf() {
      const o = read();
      const cards = cardsFor(o);
      if (!cards) { printMsg.textContent = STR.short; return; }
      printMsg.textContent = STR.pdfLoading;
      pdfB.disabled = true;
      T.loadPdf().then((core) => {
        const L = layoutFor(o.paper, o.perPage, o.mode, o.mode === 'numbers' ? 5 : o.size, o.list);
        const pages = pdfPages(core, cards, o, T.tokens(), L);
        const bytes = core.createPDF(pages, { pageSize: o.paper, info: { Title: o.title + ' — bingo cards ' + o.seed } });
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const name = 'bingo-cards-' + o.seed + '.' + (blob.type === 'application/pdf' ? 'pdf' : 'bin');
        K.download(blob, name);
        const warn = /[^\x20-\x7e -ÿ–—‘’“”…]/.test(o.title + (o.mode === 'words' ? o.list.join('') : ''));
        printMsg.textContent = STR.pdfDone(name, pages.length) + (warn ? ' ' + STR.pdfFonts : '');
        printMsg.className = 'game-msg' + (warn ? ' is-warn' : '');
        K.announce(root, printMsg.textContent);
      }).catch((e) => { printMsg.textContent = STR.failed(e.message || e); printMsg.className = 'game-msg is-warn'; })
        .then(() => { pdfB.disabled = false; });
    }

    /* ----- the caller ----- */
    let boardKey = null, cells = new Map();
    const keyOf = (x) => (typeof x === 'string' ? x.toLowerCase() : x);
    function all() { return pool(game.mode, wordList(words.value)); }
    function buildBoard() {
      const list = all();
      const k = game.mode + '|' + (game.mode === 'words' ? list.join('\n') : '');
      if (k === boardKey) return;
      boardKey = k;
      board.textContent = '';
      cells = new Map();
      if (game.mode === 'numbers') {
        board.className = 'tc-board is-75';
        for (let r = 0; r < 5; r++) {
          board.appendChild(K.el('div', 'tc-cell is-head', LETTERS[r]));
          for (let i = 1; i <= 15; i++) { const n = r * 15 + i; const c = K.el('div', 'tc-cell', String(n)); cells.set(n, c); board.appendChild(c); }
        }
      } else {
        board.className = 'tc-words';
        list.forEach((w) => { const c = K.el('span', 'tc-word', w); cells.set(w.toLowerCase(), c); board.appendChild(c); });
      }
    }
    function paintCaller() {
      cNum.setAttribute('aria-pressed', String(game.mode === 'numbers'));
      cWords.setAttribute('aria-pressed', String(game.mode === 'words'));
      buildBoard();
      const c = game.called, total = all().length;
      const cur = c.length ? c[c.length - 1] : null;
      num.textContent = cur !== null ? label(cur) : '–';
      num.className = 'tc-num' + (game.mode === 'words' ? ' is-word' : '');
      const on = new Set(c.map(keyOf));
      cells.forEach((el, k) => { el.classList.toggle('is-on', on.has(k)); el.classList.toggle('is-last', cur !== null && k === keyOf(cur)); });
      counts.textContent = STR.counts(Math.min(c.length, total), total);
      last.textContent = '';
      const five = c.slice(-5).reverse();
      if (five.length) { last.appendChild(K.el('li', 'tc-lab', 'Last five:')); five.forEach((x) => last.appendChild(K.el('li', null, label(x)))); }
      const left = total - c.filter((x) => game.mode === 'numbers' || all().some((w) => w.toLowerCase() === keyOf(x))).length;
      nextB.disabled = left <= 0;
      undoB.disabled = !c.length;
      if (game.mode === 'words' && !total) meta.textContent = STR.noWords;
      else if (!c.length) meta.textContent = STR.start;
      else if (left <= 0) meta.textContent = STR.allDone;
      stage.update({ mode: game.mode, title: title.value.trim() || 'Bingo', called: c.slice(), total: total, words: game.mode === 'words' ? all() : null });
    }
    function say(x) {
      if (!set.voice || !K.speech.supported) return;
      const vs = window.speechSynthesis.getVoices() || [];
      const v = vs.find((y) => /^en[-_]GB/i.test(y.lang) && y.localService) || vs.find((y) => /^en[-_]GB/i.test(y.lang)) || vs.find((y) => /^en/i.test(y.lang));
      K.speech.say(typeof x === 'number' ? letter(x) + '. ' + x + '.' : String(x), { voice: v, lang: v ? v.lang : 'en-GB', rate: set.rate });
    }
    function callNext() {
      const x = draw(game.called, all(), K.randInt);
      if (x === null) { meta.textContent = all().length ? STR.allDone : STR.noWords; return; }
      game.called.push(x);
      meta.textContent = '';
      persist();
      paintCaller();
      if (num.classList) { num.classList.remove('is-new'); void num.offsetWidth; num.classList.add('is-new'); }
      say(x);
      K.announce(root, label(x));
      K.wakeLock(true);
    }
    function undo() {
      if (!game.called.length) return;
      const x = game.called.pop();
      K.speech.cancel();
      persist(); paintCaller();
      meta.textContent = STR.took(label(x));
      K.announce(root, meta.textContent);
    }
    function askNew(mode) {
      pendingMode = mode;
      if (!game.called.length) { startNew(mode || game.mode); return; }
      confirmQ.textContent = mode && mode !== game.mode ? 'Clear the board and start a new game calling ' + (mode === 'words' ? 'words' : 'numbers') + '?' : STR.confirmQ;
      confirmBox.hidden = false;
      confirmBox.querySelector('button').focus();
    }
    function askMode(mode) { if (mode !== game.mode) askNew(mode); }
    function startNew(mode) {
      pendingMode = null;
      K.speech.cancel();
      game = { mode: mode === 'words' ? 'words' : 'numbers', called: [] };
      persist(); paintCaller();
      K.announce(root, 'New game. The board is clear.');
    }
    function setTab(t) {
      tab = t === 'call' ? 'call' : 'cards';
      tCards.setAttribute('aria-pressed', String(tab === 'cards'));
      tCall.setAttribute('aria-pressed', String(tab === 'call'));
      cardsView.hidden = tab !== 'cards';
      callView.hidden = tab !== 'call';
      if (tab === 'call') paintCaller();
    }

    words.addEventListener('input', refresh);
    [sizeS, freeC, colour, paper, per].forEach((x) => x.addEventListener('change', refresh));
    [count, title].forEach((x) => x.addEventListener('input', refresh));
    count.addEventListener('change', () => { count.value = String(read().n); refresh(); });
    seedIn.addEventListener('change', () => { seedIn.value = T.cleanSeed(seedIn.value) || seed; refresh(); });
    vOn.addEventListener('change', () => { set.voice = vOn.checked; if (!set.voice) K.speech.cancel(); persist(); });
    rateS.addEventListener('change', () => { set.rate = Number(rateS.value) || 1; persist(); });
    function key(k) {
      if (tab !== 'call' && !stage.presenting) return false;
      if (k === ' ' || k === 'Enter') { K.sound.unlock(); callNext(); return true; }
      return false;
    }
    stage.onKey = (k) => { if (k === ' ' || k === 'Enter') { callNext(); } };
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'BUTTON' || t.tagName === 'A' || t.isContentEditable)) return;
      if (key(e.key)) e.preventDefault();
    });
    if (!saved.game && opt.mode) game.mode = opt.mode;
    setMode(opt.mode);
    setTab(preset.tab === 'call' ? 'call' : 'cards');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K || !T) return;
    let host = null;
    const stage = K.stage({
      slug: SLUG, title: 'Bingo', render: renderStage,
      onCommand: (m) => { if (m && m.type === 'key' && host && host.onKey) host.onKey(m.key); }
    });
    if (stage.isStage) return;
    host = stage;
    mount(root, stage);
  });
})();
