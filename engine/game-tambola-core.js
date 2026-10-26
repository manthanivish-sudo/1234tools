/**
 * Tambola (Housie, 90-ball bingo): the rules shared by the number caller and
 * the ticket generator. No page of its own and no GAME_TOOLS spec: it only
 * publishes window.TambolaCore.
 *
 *   ticketStrip(seed, stripNo) → six tickets that between them use every
 *     number 1–90 exactly once. A ticket is 3 rows × 9 columns with 15
 *     numbers, five in each row; column 1 holds 1–9, column 2 10–19 … column
 *     9 80–90; every column of a ticket has one to three numbers, sorted top
 *     to bottom. The strip comes from GameKit.seeded(seed + ':strip:' + no),
 *     so (seed, strip) gives the same tickets in every browser, for ever.
 *   ticket(seed, n) → ticket n (from 1): strip ceil(n/6), place (n-1) % 6.
 *     Its printed ID is SEED-NNN (K7MPQ2-014), so the caller rebuilds any
 *     ticket from its ID alone: nothing is stored or sent.
 *   claims(ticket, called) → for every prize, whether the ticket has won it,
 *     the numbers still missing and, when `called` is the list in call order,
 *     the call that completed it.
 *   callFor / speakText → the traditional calls and the Hindi numbers.
 *
 * Runs in Node too (build-games.js reads every engine/game-*.js): nothing here
 * touches the DOM, and GameKit is looked up only when a ticket is made.
 */
(function () {
  'use strict';
  const T = {};

  /* ---------- tickets ---------- */

  const COLS = 9, ROWS = 3, PER_ROW = 5, PER_STRIP = 6;
  const lo = (c) => (c === 0 ? 1 : c * 10);
  const hi = (c) => (c === 8 ? 90 : c * 10 + 9);
  const colOf = (n) => (n >= 90 ? 8 : Math.floor(n / 10));
  T.colOf = colOf;
  T.COLS = COLS; T.ROWS = ROWS; T.PER_STRIP = PER_STRIP;

  function rng(seed, stripNo) {
    const K = (typeof window !== 'undefined' && window.GameKit) || null;
    if (!K) throw new Error('TambolaCore needs engine/game-kit.js loaded first');
    return K.seeded(String(seed) + ':strip:' + stripNo);
  }
  /* index of the largest value in `rem` among `ok` indices, ties broken by g */
  function pickMax(idx, score, g) {
    let best = -Infinity, ties = [];
    for (const i of idx) {
      if (score[i] > best) { best = score[i]; ties = [i]; }
      else if (score[i] === best) ties.push(i);
    }
    return ties.length ? ties[g.int(ties.length)] : -1;
  }

  /** How many numbers each of the six tickets takes from each column. */
  function columnCounts(g) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const cnt = Array.from({ length: PER_STRIP }, () => new Array(COLS).fill(1));
      const need = new Array(PER_STRIP).fill(ROWS * PER_ROW - COLS); /* 6 more each */
      const extra = [];
      for (let c = 0; c < COLS; c++) extra.push(hi(c) - lo(c) + 1 - PER_STRIP);
      /* the columns with most to place go first; equal ones in a shuffled order */
      const order = g.shuffle(Array.from({ length: COLS }, (_, c) => c)).sort((a, b) => extra[b] - extra[a]);
      let stuck = false;
      for (const c of order) {
        for (let e = 0; e < extra[c]; e++) {
          const ok = [];
          for (let t = 0; t < PER_STRIP; t++) if (need[t] > 0 && cnt[t][c] < ROWS) ok.push(t);
          const t = pickMax(ok, need, g);
          if (t < 0) { stuck = true; break; }
          cnt[t][c]++; need[t]--;
        }
        if (stuck) break;
      }
      if (!stuck && need.every((x) => x === 0)) return cnt;
    }
    throw new Error('could not share the columns between six tickets');
  }

  /** Which rows of one ticket each column's numbers go in: five per row. */
  function layout(counts, g) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const rem = new Array(ROWS).fill(PER_ROW);
      const on = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
      const byK = [[], [], [], []];
      g.shuffle(Array.from({ length: COLS }, (_, c) => c)).forEach((c) => byK[counts[c]].push(c));
      byK[3].forEach((c) => { for (let r = 0; r < ROWS; r++) { on[r][c] = true; rem[r]--; } });
      let bad = false;
      for (const k of [2, 1]) {
        for (const c of byK[k]) {
          const free = [0, 1, 2];
          for (let j = 0; j < k; j++) {
            const r = pickMax(free.filter((x) => rem[x] > 0), rem, g);
            if (r < 0) { bad = true; break; }
            on[r][c] = true; rem[r]--; free.splice(free.indexOf(r), 1);
          }
          if (bad) break;
        }
        if (bad) break;
      }
      if (!bad && rem.every((x) => x === 0)) return on;
    }
    throw new Error('could not lay out a ticket');
  }

  const pad = (n) => (n < 100 ? ('00' + n).slice(-3) : String(n));
  T.cleanSeed = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  T.ticketId = (seed, n) => T.cleanSeed(seed) + '-' + pad(n);
  /** "K7MPQ2-014", "k7mpq2 14", "K7MPQ2 #14" → { seed, n }, or null. */
  T.parseId = function (text) {
    const m = /^\s*([A-Za-z0-9]{1,16})\s*[-–—#/\s]\s*#?\s*(\d{1,4})\s*$/.exec(String(text || ''));
    if (!m) return null;
    const n = parseInt(m[2], 10);
    return n >= 1 ? { seed: m[1].toUpperCase(), n: n } : null;
  };

  /** Six tickets using 1–90 once each. stripNo counts from 1. */
  T.ticketStrip = function (seed, stripNo) {
    seed = T.cleanSeed(seed);
    stripNo = Math.max(1, Math.floor(stripNo) || 1);
    const g = rng(seed, stripNo);
    const cnt = columnCounts(g);
    /* deal each column's shuffled numbers to the tickets, sorted within each */
    const mine = Array.from({ length: PER_STRIP }, () => []);
    for (let c = 0; c < COLS; c++) {
      const nums = [];
      for (let x = lo(c); x <= hi(c); x++) nums.push(x);
      const deck = g.shuffle(nums);
      let at = 0;
      for (let t = 0; t < PER_STRIP; t++) {
        mine[t][c] = deck.slice(at, at + cnt[t][c]).sort((a, b) => a - b);
        at += cnt[t][c];
      }
    }
    const out = [];
    for (let t = 0; t < PER_STRIP; t++) {
      const on = layout(cnt[t], g);
      const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
      for (let c = 0; c < COLS; c++) {
        let k = 0;
        for (let r = 0; r < ROWS; r++) if (on[r][c]) grid[r][c] = mine[t][c][k++];
      }
      const n = (stripNo - 1) * PER_STRIP + t + 1;
      out.push({ seed: seed, n: n, id: T.ticketId(seed, n), strip: stripNo, rows: grid });
    }
    return out;
  };
  T.ticket = function (seed, n) {
    n = Math.max(1, Math.floor(n) || 1);
    return T.ticketStrip(seed, Math.ceil(n / PER_STRIP))[(n - 1) % PER_STRIP];
  };
  T.ticketFromId = function (text) {
    const p = T.parseId(text);
    return p ? T.ticket(p.seed, p.n) : null;
  };
  T.numbers = (ticket) => [].concat.apply([], ticket.rows).filter(Boolean);

  /* ---------- prizes ---------- */

  T.PRIZES = [
    { id: 'early5', name: 'Early Five', rule: 'Any five numbers on the ticket' },
    { id: 'top', name: 'Top line', rule: 'All five numbers in the top row' },
    { id: 'middle', name: 'Middle line', rule: 'All five numbers in the middle row' },
    { id: 'bottom', name: 'Bottom line', rule: 'All five numbers in the bottom row' },
    { id: 'corners', name: 'Four Corners', rule: 'The first and last numbers of the top and bottom rows' },
    { id: 'line', name: 'One line', rule: 'Any one full row' },
    { id: 'twolines', name: 'Two lines', rule: 'Any two full rows' },
    { id: 'full', name: 'Full House', rule: 'All fifteen numbers' }
  ];
  T.prize = (id) => T.PRIZES.find((p) => p.id === id) || null;

  /**
   * Which prizes this ticket has won. `called` is a Set or an array (in call
   * order: then `at` says which call, from 1, completed the prize).
   * → { early5: { won, missing: [..], need, at }, top: {..}, … }
   * `missing` lists the unmarked numbers that would complete the prize; for
   * Early Five, where any numbers do, `need` says how many more.
   */
  T.claims = function (ticket, called) {
    const list = Array.isArray(called) ? called : null;
    const set = called instanceof Set ? called : new Set(list || []);
    const pos = new Map();
    if (list) list.forEach((x, i) => { if (!pos.has(x)) pos.set(x, i + 1); });
    const has = (x) => set.has(x);
    const at = (nums) => (list && nums.every(has) ? Math.max.apply(null, nums.map((x) => pos.get(x))) : null);
    const rows = ticket.rows.map((r) => r.filter(Boolean));
    const one = (nums) => {
      const missing = nums.filter((x) => !has(x));
      return { won: missing.length === 0, missing: missing, need: missing.length, at: missing.length ? null : at(nums) };
    };
    const all = T.numbers(ticket);
    const out = {};
    const marked = all.filter(has);
    const e5at = list && marked.length >= 5 ? marked.map((x) => pos.get(x)).sort((a, b) => a - b)[4] : null;
    out.early5 = { won: marked.length >= 5, missing: marked.length >= 5 ? [] : all.filter((x) => !has(x)), need: Math.max(0, 5 - marked.length), at: e5at };
    out.top = one(rows[0]);
    out.middle = one(rows[1]);
    out.bottom = one(rows[2]);
    out.corners = one([rows[0][0], rows[0][rows[0].length - 1], rows[2][0], rows[2][rows[2].length - 1]]);
    out.full = one(all);
    const lines = [out.top, out.middle, out.bottom].map((x, i) => ({ x: x, i: i }))
      .sort((a, b) => (a.x.need - b.x.need) || ((a.x.at || 0) - (b.x.at || 0)) || (a.i - b.i));
    out.line = { won: lines[0].x.won, missing: lines[0].x.missing, need: lines[0].x.need, at: lines[0].x.at };
    const two = lines[0].x.missing.concat(lines[1].x.missing);
    const twoAt = lines[0].x.won && lines[1].x.won ? (list ? Math.max(lines[0].x.at, lines[1].x.at) : null) : null;
    out.twolines = { won: two.length === 0, missing: two, need: two.length, at: twoAt };
    return out;
  };

  /* ---------- the calls ---------- */

  /*
   * Sources: the traditional British bingo calls (folk phrases, collected in
   * e.g. the "List of British bingo nicknames" article on Wikipedia and in
   * caller handbooks) and the calls common at Indian Tambola / Housie games
   * (Republic Day, Independence Day, a cricket team, a big fat hen). Where a
   * number's best-known call is about bodies, drink, marriage or anything
   * else not fit for children (30, 40, 44, 49, 76, 88 among them) we used the
   * clean traditional alternative or wrote our own, and where a source's
   * wording is distinctive or names a brand we wrote our own (39, 49, 56, 57,
   * 64, 80, 88). These are folk phrases; nobody owns "two little ducks".
   */
  const CALLS = [null,
    'Kelly’s eye', 'One little duck', 'Cup of tea', 'Knock at the door', 'Man alive',
    'Half a dozen', 'Lucky seven', 'Garden gate', 'Doctor’s orders', 'Cock and hen',
    'Legs eleven', 'One dozen', 'Unlucky for some', 'Valentine’s Day', 'Young and keen',
    'Sweet sixteen', 'Dancing queen', 'Coming of age', 'Goodbye teens', 'One score',
    'Key of the door', 'Two little ducks', 'Thee and me', 'Two dozen', 'Duck and dive',
    'Pick and mix', 'Gateway to heaven', 'In a state', 'Rise and shine', 'Burlington Bertie',
    'Get up and run', 'Buckle my shoe', 'All the threes', 'Ask for more', 'Jump and jive',
    'Three dozen', 'More than eleven', 'Christmas cake', 'Climb the steps', 'Life begins',
    'Time for fun', 'Winnie the Pooh', 'Down on your knees', 'All the fours', 'Halfway there',
    'Up to tricks', 'Four and seven', 'Four dozen', 'Just in time', 'Half a century',
    'Tweak of the thumb', 'Deck of cards', 'Stuck in a tree', 'Clean the floor', 'Snakes alive',
    'Pick up sticks', 'All the beans', 'Make them wait', 'Brighton line', 'Five dozen',
    'Baker’s bun', 'Tickety-boo', 'Tickle me', 'Close the door', 'Stop work',
    'Clickety click', 'Made in heaven', 'Saving grace', 'Any way up', 'Three score and ten',
    'Bang on the drum', 'Six dozen', 'Queen bee', 'Candy store', 'Strive and strive',
    'Trombones', 'Sunset strip', 'Heaven’s gate', 'One more time', 'Eight and blank',
    'Stop and run', 'Straight on through', 'Time for tea', 'Seven dozen', 'Staying alive',
    'Between the sticks', 'Torquay in Devon', 'Two snowmen', 'Nearly there', 'Top of the shop'
  ];
  /* where Indian Tambola tables say it differently */
  const CALLS_IN = {
    10: 'A big fat hen', 11: 'Legs eleven, a cricket team', 15: 'Independence Day', 18: 'Voting age',
    26: 'Republic Day', 50: 'Cricket’s half century', 90: 'Top of the house'
  };
  T.CALLS = CALLS;
  T.CALLS_IN = CALLS_IN;
  /** style 'tambola' (Indian wording where it differs) or 'bingo' (British). */
  T.callFor = (n, style) => (style === 'bingo' ? CALLS[n] : (CALLS_IN[n] || CALLS[n])) || '';

  /* The Hindi numbers 1–90 (standard Hindi, as in the Central Hindi
     Directorate's lists); digit words for "दो और दो, बाईस". */
  const HI = [null,
    'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस',
    'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस', 'बीस',
    'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस', 'तीस',
    'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस', 'चालीस',
    'इकतालीस', 'बयालीस', 'तैंतालीस', 'चौवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास', 'पचास',
    'इक्यावन', 'बावन', 'तिरेपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ', 'साठ',
    'इकसठ', 'बासठ', 'तिरेसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर', 'सत्तर',
    'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उन्यासी', 'अस्सी',
    'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी', 'नब्बे'
  ];
  const HI_DIGIT = ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ'];
  T.HINDI = HI;
  T.hindi = (n) => HI[n] || '';

  const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  /** 22 → "twenty-two" (1–99). */
  T.words = function (n) {
    if (n < 20) return ONES[n] || String(n);
    return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /**
   * What the voice says. lang 'en' | 'hi'; calls true adds the traditional
   * call; style 'tambola' | 'bingo'.
   *   en, calls:  "Twenty-two… two little ducks… twenty-two."
   *   en, plain:  "Two and two, twenty-two."  (single digits: "On its own, number seven.")
   *   hi:         "दो और दो, बाईस।"           (single digits: "अकेला सात।")
   */
  T.speakText = function (n, opt) {
    const o = opt || {};
    if (o.lang === 'hi') {
      return n < 10 ? 'अकेला ' + HI[n] + '। ' + HI[n] + '।' : HI_DIGIT[Math.floor(n / 10)] + ' और ' + HI_DIGIT[n % 10] + ', ' + HI[n] + '।';
    }
    const w = T.words(n);
    if (o.calls !== false) return cap(w) + '… ' + T.callFor(n, o.style) + '… ' + w + '.';
    return n < 10 ? 'On its own, number ' + w + '.' : cap(ONES[Math.floor(n / 10)]) + ' and ' + (n % 10 ? ONES[n % 10] : 'oh') + ', ' + w + '.';
  };

  /* ---------- the draw ---------- */

  /** The numbers 1..max not yet called. */
  T.remaining = function (called, max) {
    const seen = new Set(called);
    const out = [];
    for (let x = 1; x <= (max || 90); x++) if (!seen.has(x)) out.push(x);
    return out;
  };
  /** A fair draw of the next number: randInt is a fair int(n) (crypto on the page). */
  T.draw = function (called, randInt, max) {
    const left = T.remaining(called, max);
    return left.length ? left[randInt(left.length)] : null;
  };

  /* ---------- page helpers shared by the three games (browser only) ---------- */

  T.COLOURS = ['Gold', 'Teal', 'Pink', 'Green', 'Purple', 'Orange', 'Blue', 'Grey'];
  /* paper in millimetres; margins are the same on every side */
  T.PAPER = { a4: { w: 210, h: 297, name: 'A4' }, letter: { w: 215.9, h: 279.4, name: 'US Letter' } };
  T.MARGIN = 8;

  if (typeof document !== 'undefined') {
    const el = (tag, cls, text) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text !== undefined && text !== null) n.textContent = text;
      return n;
    };
    /** A ticket as a table. o: { title, colour 1–8, called: Set, miss: Set } */
    T.ticketEl = function (ticket, o) {
      o = o || {};
      const box = el('div', 'tk');
      box.style.setProperty('--tk', 'var(--t' + (o.colour || 1) + ')');
      const head = el('div', 'tk-head');
      head.appendChild(el('span', 'tk-title', o.title || 'Tambola'));
      head.appendChild(el('span', 'tk-id', ticket.id));
      box.appendChild(head);
      const tb = el('table', 'tk-grid');
      tb.setAttribute('aria-label', 'Ticket ' + ticket.id);
      const body = el('tbody');
      ticket.rows.forEach((r) => {
        const tr = el('tr');
        r.forEach((x) => {
          const td = el('td');
          if (x) {
            td.appendChild(el('span', null, String(x)));
            if (o.called && o.called.has(x)) { td.className = 'is-called'; td.title = x + ' called'; }
            else if (o.miss && o.miss.has(x)) { td.className = 'is-miss'; td.title = x + ' not called yet'; }
          }
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      tb.appendChild(body);
      box.appendChild(tb);
      return box;
    };

    /** The colour tokens as hex, for the PDF and the canvas pictures. */
    T.tokens = function () {
      const probe = el('div', 'tk-tokens');
      probe.style.display = 'none';
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe);
      const get = (k) => cs.getPropertyValue(k).trim();
      const out = { ink: get('--tk-ink'), paper: get('--tk-paper'), line: get('--tk-line'), cut: get('--tk-cut'), t: [] };
      for (let i = 1; i <= 8; i++) out.t[i] = get('--t' + i);
      probe.remove();
      return out;
    };

    const loading = {};
    /** A same-origin script, fetched the first time it is needed only. */
    T.loadScript = function (src, ready) {
      if (ready && ready()) return Promise.resolve();
      if (loading[src]) return loading[src];
      loading[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { delete loading[src]; reject(new Error('Could not load ' + src + '. Check the connection and try again.')); };
        document.head.appendChild(s);
      });
      return loading[src];
    };
    T.loadPdf = () => T.loadScript('/engine/pdfcore.bundle.js', () => !!window.MVRPdfCore).then(() => window.MVRPdfCore);
    T.loadZip = () => T.loadScript('/engine/zip.js', () => !!window.MVRZip).then(() => window.MVRZip);

    /**
     * Lay `items` (elements) out on paper for window.print(): o = { paper:
     * 'a4'|'letter', cols, rows, vars: { '--cell-h': '11mm' } }. Everything
     * else on the page is hidden by the print stylesheet while the sheets are
     * there. Returns the sheets' root.
     */
    T.printSheets = function (items, o) {
      T.clearPrint();
      const P = T.PAPER[o.paper] || T.PAPER.a4;
      const W = P.w - 2 * T.MARGIN, H = P.h - 2 * T.MARGIN;
      const per = o.cols * o.rows;
      const root = el('div', 'tt-print');
      root.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < items.length; i += per) {
        const sheet = el('div', 'tt-sheet');
        sheet.style.width = W + 'mm';
        sheet.style.height = H + 'mm';
        sheet.style.gridTemplateColumns = 'repeat(' + o.cols + ', 1fr)';
        sheet.style.gridTemplateRows = 'repeat(' + o.rows + ', 1fr)';
        Object.keys(o.vars || {}).forEach((k) => sheet.style.setProperty(k, o.vars[k]));
        items.slice(i, i + per).forEach((it) => { const slot = el('div', 'tt-slot'); slot.appendChild(it); sheet.appendChild(slot); });
        root.appendChild(sheet);
      }
      const page = el('style');
      page.id = 'tt-page';
      page.textContent = '@page { size: ' + (o.paper === 'letter' ? 'letter' : 'A4') + ' portrait; margin: ' + T.MARGIN + 'mm; }';
      document.head.appendChild(page);
      document.body.appendChild(root);
      document.documentElement.classList.add('tt-has-print');
      return root;
    };
    T.clearPrint = function () {
      document.querySelectorAll('body > .tt-print, #tt-page').forEach((n) => n.remove());
      document.documentElement.classList.remove('tt-has-print');
    };
  }

  if (typeof window !== 'undefined') window.TambolaCore = T;
})();
