/**
 * Exam seating plans, worked out on the device.
 *
 * A list of students and a set of rooms go in; a seat for every student
 * comes out, with the rule the school actually cares about — no two
 * children of the same class sitting next to each other — enforced where it
 * can be and reported where it cannot. Out come the plan as a workbook, a
 * chart per room big enough to pin on the door, an attendance sheet per
 * room in seat order, and a notice to paste into a circular.
 *
 * A plan is reproducible: the same list, the same rooms and the same seed
 * give the same seats, so a re-print after a correction is not a new plan.
 * Nothing is uploaded — the student list stays in the browser.
 */
(function () {
  'use strict';
  window.EDU_TOOLS = window.EDU_TOOLS || {};
  window.EDU_TOOLS['exam-seating'] = {
    title: 'Exam Seating Plan Generator',
    short: 'Exam Seating',
    description: 'Seat a whole exam from a student list and a set of rooms: no two of the same class side by side, classes alternating down a column or across a row, every n-th seat left empty. Download the plan as a workbook, a chart for every room door and an attendance sheet per room. Runs in your browser.',
    keywords: ['exam seating plan generator', 'seating arrangement for exams', 'exam hall seating chart', 'invigilation seating plan excel', 'random seating plan students', 'exam room chart pdf', 'seating plan no two same class', 'attendance sheet exam room'],
    glyph: 'i-exam-seating',
    glyphSvg: '<symbol id="i-exam-seating" viewBox="0 0 24 24">\n  <rect x="3.2" y="3.4" width="6" height="5.2" rx="1"/>\n  <rect x="14.8" y="3.4" width="6" height="5.2" rx="1"/>\n  <rect x="3.2" y="11.6" width="6" height="5.2" rx="1"/>\n  <rect x="14.8" y="11.6" width="6" height="5.2" rx="1"/>\n  <path d="M8.4 20.8h7.2" class="thin"/>\n  <path d="M12 19.2v3.2" class="thin"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/pdfcore.bundle.js', '/engine/edu-exam-seating.js'],
    tips: [
      'The student list needs a roll number; a name, a class or section and a subject or paper are used if they are there. The class column is what the “no two of the same class together” rule works on — without it every student counts as one group and the rule has nothing to separate.',
      'Rooms are typed one per line as “Room 101, 6, 5” — name, rows, seats per row. A line with a single number (“Hall A, 40”) is laid out for you and the seats past the count are marked unavailable. A rooms spreadsheet with those columns works too.',
      'Alternating down a column suits a hall where students face the front in columns; alternating across a row suits benches. Keeping a class together in one room is the opposite policy — it switches the adjacency rule off, and the report says so rather than pretending the plan is mixed.',
      'A seed makes a shuffle reproducible: the same seed, list and rooms give the same plan, so a re-print after one correction is not a different seating. Change the seed and you get a genuinely different arrangement.',
      'When a rule cannot be met — one class is more than half the students in a room, so two of them must sit together somewhere — the plan is still produced, and every seat where the rule was relaxed is listed by room, row and seat, with a count. Nothing is quietly broken.',
      'Names in Devanagari, Tamil or Arabic script cannot be drawn in the standard PDF fonts and print as “?”. The room charts show roll numbers, which are safe; the attendance sheets show names, and any student affected is listed.'
    ],
    faq: [
      { q: 'How does it stop two students of the same class sitting together?', a: 'It fills the seats in the order you choose — down each column or across each row — and at every seat takes the class with the most students still waiting that is not already beside that seat. After the plan is built, every pair of neighbours is checked again and any that share a class is reported with its room, row and seat. That second pass is why the violation count can be trusted.' },
      { q: 'What if it is impossible?', a: 'It says so. If one class is more than half the students in a room, at least one pair must end up adjacent — that is arithmetic, not a bug. The tool names the room, says which class is over half, produces the best plan it can, and counts the seats where the rule was relaxed.' },
      { q: 'What do I get?', a: 'seating-plan.xlsx with a row per student, a grid per room and a summary; room-charts.pdf with one landscape page per room showing the seats, the roll numbers and the door; attendance-sheets.pdf with a signature sheet per room in seat order; and a notice you can paste into a circular.' },
      { q: 'Is the student list uploaded?', a: 'No. The spreadsheet is read by your browser and the plan, the workbook and both PDFs are made there. Roll numbers and names never leave the device.' }
    ]
  };
  if (typeof document === 'undefined') return;

  const K = () => window.MVRBizKit;
  const C = () => { if (!window.MVRPdfCore) throw new Error('The PDF writer did not load.'); return window.MVRPdfCore; };

  /* ---------- rooms ---------- */

  /** "Room 101, 6, 5" or "Hall A, 40" -> a room. */
  function parseRooms(text) {
    const rooms = [], bad = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || /^#/.test(line)) continue;
      const parts = line.split(/\s*[,;|\t]\s*/).filter(x => x !== '');
      const name = (parts[0] || '').trim();
      const nums = parts.slice(1).map(x => Number(String(x).replace(/[^\d.]/g, ''))).filter(n => Number.isFinite(n) && n > 0);
      if (!name || !nums.length) { bad.push(line); continue; }
      rooms.push(roomOf(name, nums));
    }
    return { rooms, bad };
  }
  function roomOf(name, nums) {
    if (nums.length >= 2) {
      const rows = Math.max(1, Math.round(nums[0])), cols = Math.max(1, Math.round(nums[1]));
      return { name: String(name).trim(), rows, cols, seats: rows * cols, given: 'grid' };
    }
    const seats = Math.max(1, Math.round(nums[0]));
    const cols = Math.min(10, Math.max(3, Math.round(Math.sqrt(seats * 1.3))));
    return { name: String(name).trim(), rows: Math.ceil(seats / cols), cols, seats, given: 'total' };
  }

  /* ---------- ordering ---------- */

  function hash32(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function mulberry32(a) { return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rollNum = (v) => { const m = /(\d+)\s*$/.exec(String(v == null ? '' : v)); return m ? Number(m[1]) : NaN; };
  function byRoll(a, b) {
    const x = rollNum(a.roll), y = rollNum(b.roll);
    if (Number.isFinite(x) && Number.isFinite(y) && x !== y) return x - y;
    return String(a.roll).localeCompare(String(b.roll), 'en');
  }
  function orderStudents(list, o) {
    const out = list.slice();
    if (o.order === 'shuffle') {
      const rnd = mulberry32(hash32(String(o.seed || '') + '|' + list.length));
      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = out[i]; out[i] = out[j]; out[j] = t; }
      return out;
    }
    return out.sort(byRoll);
  }

  /* ---------- the plan ---------- */

  /** Seats in the order they are filled, with the unavailable ones marked. */
  function seatsOf(room, o) {
    const list = [];
    const push = (r, c) => list.push({ r, c });
    if (o.arrange === 'column') { for (let c = 0; c < room.cols; c++) for (let r = 0; r < room.rows; r++) push(r, c); }
    else { for (let r = 0; r < room.rows; r++) for (let c = 0; c < room.cols; c++) push(r, c); }
    const cap = room.seats && room.seats < room.rows * room.cols ? room.seats : room.rows * room.cols;
    let n = 0;
    for (const s of list) {
      if (s.r * room.cols + s.c >= cap) { s.blocked = 'no seat'; continue; }
      n++;
      if (o.skip > 1 && n % o.skip === 0) s.blocked = 'left empty';
    }
    return list;
  }
  const capacityOf = (room, o) => seatsOf(room, o).filter(s => !s.blocked).length;

  /** One room filled from its pool, largest class first, avoiding neighbours. */
  function placeRoom(room, pool, o) {
    const seats = seatsOf(room, o);
    const grid = []; for (let r = 0; r < room.rows; r++) grid.push(new Array(room.cols).fill(null));
    const q = {};
    pool.forEach(s => { (q[s.section] = q[s.section] || []).push(s); });
    const relaxed = [];
    const left = () => Object.keys(q).filter(kk => q[kk].length);
    for (const seat of seats) {
      if (seat.blocked) continue;
      const keys = left();
      if (!keys.length) break;
      const banned = new Set();
      if (o.apart !== 'off') {
        const nb = [[seat.r, seat.c - 1], [seat.r, seat.c + 1]];
        if (o.apart === 'both') nb.push([seat.r - 1, seat.c], [seat.r + 1, seat.c]);
        for (const p of nb) { const g = grid[p[0]] && grid[p[0]][p[1]]; if (g) banned.add(g.section); }
      }
      const rank = (a, b) => (q[b].length - q[a].length) || (a < b ? -1 : 1);
      const free = keys.filter(x => !banned.has(x)).sort(rank);
      let pick = free[0];
      if (pick === undefined) {
        pick = keys.slice().sort(rank)[0];
        relaxed.push({ room: room.name, row: seat.r + 1, seat: seat.c + 1, section: pick });
      }
      const st = q[pick].shift();
      st.room = room.name; st.row = seat.r + 1; st.seat = seat.c + 1;
      grid[seat.r][seat.c] = st;
    }
    const leftover = [];
    Object.keys(q).forEach(x => leftover.push.apply(leftover, q[x]));
    const repaired = repairRoom({ room, grid }, o);
    return { room, grid, seats, relaxed, leftover, repaired, seated: [].concat.apply([], grid).filter(Boolean).length };
  }

  /**
   * Filling seat by seat can leave the last two students of one class side
   * by side when an earlier swap would have avoided it. This walks the
   * finished room and trades places between two students wherever that
   * clears a clash without making a new one. Whatever it cannot clear is
   * still counted and reported.
   */
  function repairRoom(p, o) {
    if (o.apart === 'off') return 0;
    const room = p.room;
    const at = (r, c) => (p.grid[r] && p.grid[r][c]) || null;
    const nbs = (r, c) => { const l = [[r, c - 1], [r, c + 1]]; if (o.apart === 'both') l.push([r - 1, c], [r + 1, c]); return l; };
    const clash = (r, c, section) => nbs(r, c).some(n => { const g = at(n[0], n[1]); return g && g.section === section; });
    const filled = [];
    for (let r = 0; r < room.rows; r++) for (let c = 0; c < room.cols; c++) if (at(r, c)) filled.push([r, c]);
    let fixed = 0;
    for (let pass = 0; pass < 4; pass++) {
      let any = false;
      for (const seat of filled) {
        const a = at(seat[0], seat[1]);
        if (!a || !clash(seat[0], seat[1], a.section)) continue;
        for (const other of filled) {
          if (other[0] === seat[0] && other[1] === seat[1]) continue;
          const b = at(other[0], other[1]);
          if (!b || b.section === a.section) continue;
          p.grid[seat[0]][seat[1]] = b; p.grid[other[0]][other[1]] = a;
          if (!clash(seat[0], seat[1], b.section) && !clash(other[0], other[1], a.section)) {
            const row = a.row, st = a.seat;
            a.row = b.row; a.seat = b.seat; b.row = row; b.seat = st;
            fixed++; any = true; break;
          }
          p.grid[seat[0]][seat[1]] = a; p.grid[other[0]][other[1]] = b;
        }
      }
      if (!any) break;
    }
    return fixed;
  }

  /** Every neighbour pair checked again, once the plan is built. */
  function scanViolations(plans, o) {
    const out = [];
    if (o.apart === 'off') return out;
    for (const p of plans) {
      for (let r = 0; r < p.room.rows; r++) {
        for (let c = 0; c < p.room.cols; c++) {
          const a = p.grid[r][c]; if (!a) continue;
          const pairs = [[r, c + 1]];
          if (o.apart === 'both') pairs.push([r + 1, c]);
          for (const n of pairs) {
            const b = p.grid[n[0]] && p.grid[n[0]][n[1]];
            if (b && b.section === a.section) out.push({ room: p.room.name, section: a.section, a, b, where: 'row ' + (r + 1) + ' seat ' + (c + 1) + ' and ' + (n[0] === r ? 'seat ' + (n[1] + 1) : 'row ' + (n[0] + 1) + ' seat ' + (n[1] + 1)) });
          }
        }
      }
    }
    return out;
  }

  /**
   * The whole plan. Pure: the same students, rooms and options always give
   * the same seats, and the result can be checked without a browser.
   */
  function planSeating(studentsIn, rooms, o) {
    const students = studentsIn.map(s => Object.assign({}, s));
    const bySection = {};
    students.forEach(s => { (bySection[s.section] = bySection[s.section] || []).push(s); });
    const sections = Object.keys(bySection).sort();
    const q = {};
    sections.forEach(x => { q[x] = orderStudents(bySection[x], o); });
    const notes = [];

    const caps = rooms.map(r => capacityOf(r, o));
    const totalCap = caps.reduce((a, b) => a + b, 0);
    let takes;
    if (o.fill === 'even' && totalCap > 0) {
      takes = caps.map(c => Math.min(c, Math.floor(c / totalCap * students.length)));
      let left = Math.min(students.length, totalCap) - takes.reduce((a, b) => a + b, 0);
      let guard = 0;
      while (left > 0 && guard++ < 10000) {
        let best = -1;
        for (let i = 0; i < caps.length; i++) if (takes[i] < caps[i] && (best < 0 || (caps[i] - takes[i]) > (caps[best] - takes[best]))) best = i;
        if (best < 0) break;
        takes[best]++; left--;
      }
    } else {
      let left = students.length;
      takes = caps.map(c => { const t = Math.min(c, left); left -= t; return t; });
    }

    /* which students go to which room */
    const pools = rooms.map(() => []);
    if (o.arrange === 'block') {
      /* a class goes whole into the smallest room that holds it */
      const space = caps.slice();
      const spread = {};
      for (const s of sections.slice().sort((a, b) => q[b].length - q[a].length)) {
        let guard = 0;
        while (q[s].length && guard++ < 1000) {
          let pick = -1;
          for (let i = 0; i < rooms.length; i++) if (space[i] >= q[s].length && (pick < 0 || space[i] < space[pick])) pick = i;
          if (pick < 0) for (let i = 0; i < rooms.length; i++) if (space[i] > 0 && (pick < 0 || space[i] > space[pick])) pick = i;
          if (pick < 0) break;
          const n = Math.min(space[pick], q[s].length);
          pools[pick].push.apply(pools[pick], q[s].splice(0, n));
          space[pick] -= n;
          spread[s] = (spread[s] || 0) + 1;
        }
      }
      Object.keys(spread).sort().forEach(s => { if (spread[s] > 1) notes.push(s + ' does not fit in one room, so it was split across ' + spread[s] + ' rooms.'); });
      notes.push('Keep-a-class-together was chosen: each class was given the smallest room that holds it, the room-filling setting does not apply, and the “no two of the same class adjacent” rule was not applied — that is the point of this mode.');
    } else {
      rooms.forEach((room, i) => {
        const take = takes[i];
        if (take <= 0) return;
        const remaining = sections.reduce((a, s) => a + q[s].length, 0) || 1;
        const quota = {}; let given = 0;
        sections.forEach(s => { quota[s] = Math.min(q[s].length, Math.floor(q[s].length / remaining * take)); given += quota[s]; });
        let left = take - given, guard = 0;
        while (left > 0 && guard++ < 10000) {
          let best = null;
          for (const s of sections) if (quota[s] < q[s].length && (best === null || (q[s].length - quota[s]) > (q[best].length - quota[best]))) best = s;
          if (best === null) break;
          quota[best]++; left--;
        }
        sections.forEach(s => pools[i].push.apply(pools[i], q[s].splice(0, quota[s])));
      });
    }

    const plans = [];
    rooms.forEach((room, i) => {
      const pool = pools[i];
      /* say up front where the rule cannot hold */
      if (o.apart !== 'off' && o.arrange !== 'block' && pool.length) {
        const count = {};
        pool.forEach(s => { count[s.section] = (count[s.section] || 0) + 1; });
        const worst = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
        if (count[worst] > Math.ceil(pool.length / 2)) notes.push(room.name + ': ' + worst + ' is ' + count[worst] + ' of the ' + pool.length + ' students in the room — more than half, so some same-class neighbours are unavoidable there.');
      }
      plans.push(placeRoom(room, pool, o));
    });

    const unseated = [];
    sections.forEach(s => unseated.push.apply(unseated, q[s]));
    plans.forEach(p => unseated.push.apply(unseated, p.leftover));
    if (unseated.length) notes.push(unseated.length + ' student(s) have no seat: the rooms hold ' + totalCap + ' and there are ' + students.length + '. Add a room or seats.');

    const violations = scanViolations(plans, o);
    const relaxed = [].concat.apply([], plans.map(p => p.relaxed));
    const repaired = plans.reduce((a, p) => a + (p.repaired || 0), 0);
    const seated = students.filter(s => s.room);
    return { plans, students, seated, unseated, violations, relaxed, repaired, notes, sections, caps, totalCap };
  }

  /* ---------- text ---------- */

  const EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ−‐‑―     ′″­';
  function unprintable(text) {
    const seen = new Set();
    for (const ch of String(text == null ? '' : text)) { const c = ch.codePointAt(0); if (c > 255 && EXTRA.indexOf(ch) < 0) seen.add(ch); }
    return [...seen];
  }
  /** 1,2,3,7,9,10 -> "1-3, 7, 9-10" */
  function rollRanges(rolls) {
    const nums = rolls.map(rollNum).filter(Number.isFinite).sort((a, b) => a - b);
    if (!nums.length) return rolls.slice(0, 6).join(', ');
    const parts = []; let a = nums[0], b = nums[0];
    for (let i = 1; i <= nums.length; i++) {
      if (i < nums.length && nums[i] === b + 1) { b = nums[i]; continue; }
      if (i < nums.length && nums[i] === b) continue;
      parts.push(a === b ? String(a) : a + '-' + b);
      a = b = nums[i];
    }
    return parts.join(', ');
  }
  function noticeText(plan, o) {
    const lines = [];
    lines.push((o.school || 'School').toUpperCase());
    lines.push('NOTICE — SEATING ARRANGEMENT');
    lines.push('');
    lines.push(o.exam + (o.date ? ' · ' + o.date : '') + (o.time ? ' · ' + o.time : ''));
    lines.push('');
    lines.push('The seating for the above examination is as follows. Students must be in their seats ten minutes before the paper begins. A chart is displayed on the door of every room; find your roll number on it.');
    lines.push('');
    for (const p of plan.plans) {
      const seated = [].concat.apply([], p.grid).filter(Boolean);
      if (!seated.length) { lines.push(p.room.name + ' — not used.'); continue; }
      const bySec = {};
      seated.forEach(s => { (bySec[s.section] = bySec[s.section] || []).push(s.roll); });
      const who = Object.keys(bySec).sort().map(s => s + ' (roll ' + rollRanges(bySec[s]) + ')').join('; ');
      lines.push(p.room.name + ' — ' + seated.length + ' students, ' + p.room.rows + ' rows of ' + p.room.cols + '. ' + who + '.');
    }
    lines.push('');
    if (plan.violations.length) lines.push('Note for invigilators: ' + plan.violations.length + ' pair(s) of seats hold students of the same class because the numbers left no alternative. They are marked in the room chart list given to invigilators.');
    lines.push('Students must bring their admit card and school identity card. Mobile phones, smart watches and written material of any kind are not permitted in the examination room.');
    lines.push('');
    lines.push((o.principal || 'Principal'));
    return lines.join('\n');
  }

  /* ---------- PDFs ---------- */

  const HEX = /^#?([0-9a-f]{6})$/i;
  const accentOf = (v) => { const m = HEX.exec(String(v || '').trim()); return m ? '#' + m[1].toLowerCase() : null; };

  /** One landscape page per room: a grid of seats, big enough to read. */
  function chartPages(plan, o) {
    const core = C();
    const base = core.PAGE_SIZES[o.pageSize] || core.PAGE_SIZES.a4;
    const W = base[1], H = base[0];
    const B = 'Helvetica-Bold', R = 'Helvetica';
    const m = 34, grey = '#54606f';
    return plan.plans.map((p) => {
      const ops = [];
      const room = p.room;
      const seated = [].concat.apply([], p.grid).filter(Boolean);
      ops.push({ rect: [0, H - 8, W, 8], fill: o.accent });
      ops.push({ text: room.name, x: m, y: H - 40, size: 24, font: B });
      ops.push({ text: (o.exam || '') + (o.date ? '  ·  ' + o.date : '') + (o.time ? '  ·  ' + o.time : ''), x: m, y: H - 56, size: 10, font: R, colour: grey });
      ops.push({ text: (o.school || ''), x: W - m, y: H - 40, size: 11, font: B, align: 'right', colour: grey });
      ops.push({ text: seated.length + ' students · ' + room.rows + ' rows × ' + room.cols + ' seats', x: W - m, y: H - 56, size: 10, font: R, align: 'right', colour: grey });

      const top = H - 78, bottom = m + 52, labelW = 40, headH = 34;
      const availW = W - 2 * m - labelW, availH = top - bottom - headH;
      const cw = Math.min(110, availW / room.cols), ch = Math.min(78, availH / room.rows);
      const gx = m + labelW + Math.max(0, (availW - cw * room.cols) / 2);
      const gy = top - headH - ch * room.rows;
      ops.push({ text: 'FRONT OF ROOM — BOARD / INVIGILATOR', x: gx + cw * room.cols / 2, y: top - 10, size: 9, font: B, align: 'center', colour: grey });
      ops.push({ line: [gx, top - 15, gx + cw * room.cols, top - 15], stroke: grey, lineWidth: 0.8 });
      for (let c = 0; c < room.cols; c++) ops.push({ text: 'Seat ' + (c + 1), x: gx + cw * c + cw / 2, y: gy + ch * room.rows + 6, size: 8, font: R, align: 'center', colour: grey });
      for (let r = 0; r < room.rows; r++) {
        const y = gy + ch * (room.rows - 1 - r);
        ops.push({ text: 'Row ' + (r + 1), x: gx - 8, y: y + ch / 2 - 3, size: 8.5, font: R, align: 'right', colour: grey });
        for (let c = 0; c < room.cols; c++) {
          const x = gx + cw * c;
          const s = p.grid[r][c];
          const blocked = p.seats.find(q => q.r === r && q.c === c && q.blocked);
          if (!s) ops.push({ rect: [x + 2, y + 2, cw - 4, ch - 4], fill: blocked && blocked.blocked === 'no seat' ? '#eceff2' : '#f8f9fa' });
          ops.push({ rect: [x + 2, y + 2, cw - 4, ch - 4], stroke: s ? o.accent : '#c3c9d1', lineWidth: s ? 1 : 0.6 });
          ops.push({ text: (r + 1) + '-' + (c + 1), x: x + 6, y: y + ch - 11, size: 6.5, font: R, colour: '#96a0aa' });
          if (s) {
            const size = Math.min(22, ch * 0.34, cw * 0.42);
            ops.push({ text: String(s.roll), x: x + cw / 2, y: y + ch / 2 - size * 0.28, size, font: B, align: 'center' });
            ops.push({ text: String(s.section || ''), x: x + cw / 2, y: y + 9, size: Math.min(9, ch * 0.16), font: R, align: 'center', colour: grey });
          } else {
            ops.push({ text: blocked && blocked.blocked === 'no seat' ? '' : 'EMPTY', x: x + cw / 2, y: y + ch / 2 - 4, size: 8, font: R, align: 'center', colour: '#a8b0b8' });
          }
        }
      }
      /* the door, so the chart is the right way round on the wall */
      ops.push({ line: [m, m + 30, m + 74, m + 30], stroke: '#111111', lineWidth: 3 });
      ops.push({ text: 'DOOR', x: m + 37, y: m + 18, size: 9, font: B, align: 'center' });
      const bySec = {};
      seated.forEach(s => { bySec[s.section] = (bySec[s.section] || 0) + 1; });
      const legend = Object.keys(bySec).sort().map(s => s + ': ' + bySec[s]).join('   ·   ');
      ops.push({ text: legend || 'No students seated in this room', x: m + 96, y: m + 30, size: 10, font: R });
      const empt = p.seats.filter(q => q.blocked === 'left empty').length;
      ops.push({ text: (empt ? empt + ' seat(s) deliberately left empty.  ' : '') + 'Seat numbers run left to right as you face the front.', x: m + 96, y: m + 16, size: 8, font: R, colour: grey });
      ops.push({ text: 'Row-Seat is printed in the corner of every seat.', x: W - m, y: m + 16, size: 8, font: R, align: 'right', colour: grey });
      return { size: [W, H], ops };
    });
  }

  /** One signature sheet per room, in seat order. */
  function attendancePages(plan, o) {
    const core = C();
    const size = core.PAGE_SIZES[o.pageSize] || core.PAGE_SIZES.a4;
    const W = size[0], H = size[1];
    const B = 'Helvetica-Bold', R = 'Helvetica';
    const m = 40, grey = '#54606f', pages = [];
    const cw = [34, 52, 66, W - 2 * m - 34 - 52 - 66 - 72 - 130, 72, 130];
    const heads = ['S.No', 'Seat', 'Roll No.', 'Name', 'Class', 'Signature'];
    for (const p of plan.plans) {
      const seated = [].concat.apply([], p.grid).filter(Boolean)
        .sort((a, b) => (a.row - b.row) || (a.seat - b.seat));
      if (!seated.length) continue;
      const perPage = 28;
      const nPages = Math.max(1, Math.ceil(seated.length / perPage));
      for (let pg = 0; pg < nPages; pg++) {
        const ops = [];
        let y = H - m;
        ops.push({ text: (o.school || 'School'), x: W / 2, y: y - 14, size: 14, font: B, align: 'center' }); y -= 20;
        ops.push({ text: (o.exam || '') + (o.date ? '  ·  ' + o.date : '') + (o.time ? '  ·  ' + o.time : ''), x: W / 2, y: y - 10, size: 10, font: R, align: 'center', colour: grey }); y -= 16;
        ops.push({ rect: [m, y, W - 2 * m, 2.5], fill: o.accent }); y -= 16;
        ops.push({ text: 'Attendance — ' + p.room.name, x: m, y: y - 12, size: 12, font: B });
        ops.push({ text: seated.length + ' students' + (nPages > 1 ? '  ·  page ' + (pg + 1) + ' of ' + nPages : ''), x: W - m, y: y - 12, size: 9.5, font: R, align: 'right', colour: grey });
        y -= 24;
        const rowH = 22;
        const cx = []; let acc = m; cw.forEach(w => { cx.push(acc); acc += w; });
        ops.push({ rect: [m, y - 18, W - 2 * m, 18], fill: o.accent });
        heads.forEach((h, i) => ops.push({ text: h, x: cx[i] + 6, y: y - 12.5, size: 8.5, font: B, colour: '#ffffff' }));
        y -= 18;
        seated.slice(pg * perPage, (pg + 1) * perPage).forEach((s, i) => {
          const n = pg * perPage + i + 1;
          if (i % 2 === 1) ops.push({ rect: [m, y - rowH, W - 2 * m, rowH], fill: '#f6f8fa' });
          const vals = [String(n), s.row + '-' + s.seat, String(s.roll), String(s.name || ''), String(s.section || ''), ''];
          vals.forEach((v, j) => { if (v) ops.push({ text: v, x: cx[j] + 6, y: y - rowH + 7, size: 9, font: j === 2 ? B : R }); });
          ops.push({ line: [m, y - rowH, W - m, y - rowH], stroke: '#dde2e8', lineWidth: 0.5 });
          y -= rowH;
        });
        ops.push({ rect: [m, y, W - 2 * m, (Math.min(perPage, seated.length - pg * perPage)) * rowH + 18], stroke: '#c3c9d1', lineWidth: 0.7 });
        ops.push({ text: 'Present: ________    Absent: ________', x: m, y: m + 34, size: 10, font: R });
        ops.push({ line: [W - m - 170, m + 30, W - m, m + 30], stroke: '#6b7580', lineWidth: 0.7 });
        ops.push({ text: 'Invigilator’s signature', x: W - m - 85, y: m + 18, size: 8.5, font: R, align: 'center', colour: grey });
        pages.push({ size: [W, H], ops });
      }
    }
    return pages;
  }

  /* ---------- the page ---------- */

  const SFIELDS = [
    { key: 'roll', label: 'Roll number', need: true, aliases: ['rollno', 'roll', 'rollnumber', 'regno', 'registrationno', 'admissionno', 'admno', 'id'] },
    { key: 'name', label: 'Name', aliases: ['name', 'studentname', 'nameofstudent', 'student', 'pupil'] },
    { key: 'section', label: 'Class / Section', aliases: ['class', 'section', 'classsection', 'std', 'standard', 'division', 'div', 'sec', 'grade', 'group'] },
    { key: 'paper', label: 'Subject / Paper', aliases: ['subject', 'paper', 'exam', 'papercode', 'subjectcode', 'course'] }
  ];
  const RFIELDS = [
    { key: 'room', label: 'Room name', need: true, aliases: ['room', 'roomname', 'hall', 'roomno', 'hallname', 'venue', 'name'] },
    { key: 'rows', label: 'Rows', aliases: ['rows', 'row', 'norows', 'numberofrows', 'benches'] },
    { key: 'cols', label: 'Seats per row', aliases: ['cols', 'columns', 'seatsperrow', 'perrow', 'column', 'seatsrow'] },
    { key: 'seats', label: 'Total seats', aliases: ['seats', 'totalseats', 'capacity', 'strength'] }
  ];

  function mount(root) {
    const k = K();
    const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const st = { headers: [], rows: [], map: {}, file: '', roomRows: null };
    const msg = k.msgBox();

    const two = k.el('div', 'biz-two');
    const colA = k.el('div', 'biz-col'), colB = k.el('div', 'biz-col');
    two.appendChild(colA); two.appendChild(colB); io.appendChild(two);

    const mapBox = k.el('div');
    const drop = k.dropzone('Choose the student list (Excel or CSV)', '.xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', async (f) => {
      try {
        msg.say('Reading…', 'note');
        const t = await k.readTable(f);
        const h = k.splitHeader(t.sheets[0].rows);
        if (!h.headers.length || !h.rows.length) throw new Error('No table found: the first row should be the headings, with one student per row below it.');
        st.headers = h.headers; st.rows = h.rows; st.file = f.name;
        st.map = k.autoMap(SFIELDS, h.headers);
        mapBox.innerHTML = '';
        mapBox.appendChild(k.mapPanel('Student columns', SFIELDS, h.headers, st.map, () => { }));
        drop.say(f.name, h.rows.length + ' student' + (h.rows.length === 1 ? '' : 's'));
        msg.say('');
      } catch (e) { msg.say(e.message || String(e), 'error'); }
    });
    colA.appendChild(drop); colA.appendChild(mapBox);

    const roomsText = k.textarea('es-rooms', 'Room 101, 6, 5\nRoom 102, 5, 6\nHall A, 8, 4', 'One room per line: name, rows, seats per row', 6);
    colB.appendChild(k.field('Rooms', roomsText, 'Name, rows, seats per row — or name and a total (Hall A, 40)'));
    const roomMapBox = k.el('div');
    const roomDrop = k.dropzone('Or a rooms spreadsheet', '.xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', async (f) => {
      try {
        const t = await k.readTable(f);
        const h = k.splitHeader(t.sheets[0].rows);
        const map = k.autoMap(RFIELDS, h.headers);
        if (map.room === undefined) throw new Error('No room-name column found in that file.');
        const lines = h.rows.map(r => {
          const name = String(r[map.room] == null ? '' : r[map.room]).trim();
          const rw = map.rows === undefined ? null : Number(r[map.rows]);
          const cl = map.cols === undefined ? null : Number(r[map.cols]);
          const se = map.seats === undefined ? null : Number(r[map.seats]);
          if (!name) return '';
          if (Number.isFinite(rw) && rw > 0 && Number.isFinite(cl) && cl > 0) return name + ', ' + Math.round(rw) + ', ' + Math.round(cl);
          if (Number.isFinite(se) && se > 0) return name + ', ' + Math.round(se);
          return '';
        }).filter(Boolean);
        if (!lines.length) throw new Error('That file has room names but no rows, seats per row or total seats.');
        roomsText.value = lines.join('\n');
        roomMapBox.innerHTML = '';
        roomDrop.say(f.name, lines.length + ' room' + (lines.length === 1 ? '' : 's') + ' read into the box above');
        msg.say('');
      } catch (e) { msg.say(e.message || String(e), 'error'); }
    });
    colB.appendChild(roomDrop); colB.appendChild(roomMapBox);

    const bar = k.el('div', 'opt-bar biz-opts');
    const school = k.textInput('es-school', 'Sunrise Public School', 'School name');
    const exam = k.textInput('es-exam', 'Half-Yearly Examination 2026-27', 'Exam name');
    const date = k.textInput('es-date', '', 'e.g. 12 October 2026');
    const time = k.textInput('es-time', '10:00 – 13:00', 'e.g. 10:00 – 13:00');
    const arrange = k.select('es-arrange', [
      { value: 'column', label: 'Alternate classes down each column' },
      { value: 'row', label: 'Alternate classes across each row' },
      { value: 'block', label: 'Keep each class together in one room' }], 'column');
    const apart = k.select('es-apart', [
      { value: 'side', label: 'Not beside each other (left / right)' },
      { value: 'both', label: 'Not beside, in front or behind' },
      { value: 'off', label: 'No adjacency rule' }], 'side');
    const skip = k.textInput('es-skip', 0, '', 'number'); skip.min = 0; skip.max = 9; skip.step = 1;
    const fill = k.select('es-fill', [{ value: 'order', label: 'Fill rooms in order' }, { value: 'even', label: 'Spread evenly across rooms' }], 'order');
    const order = k.select('es-order', [{ value: 'roll', label: 'By roll number' }, { value: 'shuffle', label: 'Shuffle (with a seed)' }], 'roll');
    const seed = k.textInput('es-seed', 'exam-2026', 'Any word — the same seed gives the same plan');
    const pageSize = k.select('es-page', [{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }], 'a4');
    const accent = k.textInput('es-accent', '#0b3d6b', '#0b3d6b');
    const principal = k.textInput('es-principal', 'Principal', 'Signature on the notice');
    bar.appendChild(k.field('School name', school));
    bar.appendChild(k.field('Exam name', exam));
    bar.appendChild(k.field('Date', date));
    bar.appendChild(k.field('Time', time));
    bar.appendChild(k.field('Arrangement', arrange));
    bar.appendChild(k.field('Same class may sit…', apart));
    bar.appendChild(k.field('Leave every n-th seat empty', skip, '0 for none, 3 for every third seat'));
    bar.appendChild(k.field('Rooms', fill));
    bar.appendChild(k.field('Order within a class', order));
    bar.appendChild(k.field('Shuffle seed', seed));
    bar.appendChild(k.field('Page size', pageSize));
    bar.appendChild(k.field('Accent colour', accent, 'Any hex colour'));
    bar.appendChild(k.field('Notice signed by', principal));
    io.appendChild(bar);

    const run = k.el('div', 'io-actions pdf-run');
    run.appendChild(k.button('Build the seating plan', 'btn-primary', go));
    io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    function readStudents() {
      const miss = k.missing(SFIELDS, st.map);
      if (miss.length) throw new Error('Choose the column for: ' + miss.join(', ') + '.');
      const cell = (r, key) => st.map[key] === undefined ? '' : String(r[st.map[key]] == null ? '' : r[st.map[key]]).trim();
      const out = [];
      st.rows.forEach((r, i) => {
        const roll = cell(r, 'roll');
        if (!roll) return;
        out.push({ roll, name: cell(r, 'name'), section: cell(r, 'section') || 'All students', paper: cell(r, 'paper'), rowNo: i + 2 });
      });
      if (!out.length) throw new Error('No students with a roll number were found.');
      return out;
    }

    function sheetsOf(plan, o) {
      const planRows = [['S.No', 'Room', 'Row', 'Seat', 'Seat label', 'Roll No.', 'Name', 'Class / Section', 'Subject / Paper']];
      plan.seated.slice()
        .sort((a, b) => String(a.room).localeCompare(String(b.room)) || (a.row - b.row) || (a.seat - b.seat))
        .forEach((s, i) => planRows.push([i + 1, s.room, s.row, s.seat, s.row + '-' + s.seat, s.roll, s.name, s.section, s.paper]));
      plan.unseated.forEach((s, i) => planRows.push([plan.seated.length + i + 1, 'NOT SEATED', '', '', '', s.roll, s.name, s.section, s.paper]));

      const chart = [];
      plan.plans.forEach(p => {
        chart.push([p.room.name + ' — ' + p.room.rows + ' rows × ' + p.room.cols + ' seats', 'FRONT OF ROOM']);
        chart.push([''].concat(Array.from({ length: p.room.cols }, (_, c) => 'Seat ' + (c + 1))));
        for (let r = 0; r < p.room.rows; r++) {
          chart.push(['Row ' + (r + 1)].concat(p.grid[r].map((s, c) => {
            if (s) return s.roll + ' (' + s.section + ')';
            const b = p.seats.find(q => q.r === r && q.c === c && q.blocked);
            return b ? (b.blocked === 'no seat' ? '—' : 'EMPTY') : '';
          })));
        }
        chart.push(['DOOR']); chart.push([]);
      });

      const summary = [['Room', 'Rows', 'Seats per row', 'Usable seats', 'Students seated', 'Seats empty'].concat(plan.sections)];
      plan.plans.forEach((p, i) => {
        const seated = [].concat.apply([], p.grid).filter(Boolean);
        const count = {}; seated.forEach(s => { count[s.section] = (count[s.section] || 0) + 1; });
        summary.push([p.room.name, p.room.rows, p.room.cols, plan.caps[i], seated.length, plan.caps[i] - seated.length].concat(plan.sections.map(s => count[s] || 0)));
      });
      const tot = {}; plan.seated.forEach(s => { tot[s.section] = (tot[s.section] || 0) + 1; });
      summary.push(['TOTAL', '', '', plan.totalCap, plan.seated.length, plan.totalCap - plan.seated.length].concat(plan.sections.map(s => tot[s] || 0)));
      summary.push([]);
      summary.push(['Rule', o.apart === 'off' ? 'no adjacency rule' : o.apart === 'both' ? 'not beside, in front or behind' : 'not beside each other']);
      summary.push(['Arrangement', arrange.options[arrange.selectedIndex].text]);
      summary.push(['Order', order.options[order.selectedIndex].text + (o.order === 'shuffle' ? ' · seed ' + o.seed : '')]);
      summary.push(['Every n-th seat empty', o.skip > 1 ? o.skip : 'none']);
      summary.push(['Students', plan.students.length]);
      summary.push(['Not seated', plan.unseated.length]);
      summary.push(['Same-class neighbours', plan.violations.length]);
      plan.violations.forEach(v => summary.push(['Violation', v.room + ' ' + v.where + ' — both ' + v.section + ' (' + v.a.roll + ', ' + v.b.roll + ')']));
      plan.notes.forEach(n => summary.push(['Note', n]));

      return [{ name: 'Plan', rows: planRows }, { name: 'Room charts', rows: chart }, { name: 'Summary', rows: summary }];
    }

    function go() {
      result.innerHTML = '';
      if (!st.rows.length) { msg.say('Choose a student list first.', 'note'); return; }
      let students, rooms;
      try {
        students = readStudents();
        const parsed = parseRooms(roomsText.value);
        rooms = parsed.rooms;
        if (!rooms.length) throw new Error('No rooms. Write one per line: Room 101, 6, 5');
        if (parsed.bad.length) msg.say('Ignored ' + parsed.bad.length + ' room line(s) with no size: ' + parsed.bad.slice(0, 3).join(' · '), 'warn');
        else msg.say('');
      } catch (e) { msg.say(e.message || String(e), 'error'); return; }

      const acc = accentOf(accent.value);
      const o = {
        arrange: arrange.value, apart: arrange.value === 'block' ? 'off' : apart.value,
        skip: Math.max(0, Math.min(9, Math.round(Number(skip.value) || 0))),
        fill: fill.value, order: order.value, seed: seed.value || 'seed',
        pageSize: pageSize.value, accent: acc || '#0b3d6b',
        school: school.value.trim(), exam: exam.value.trim(), date: date.value.trim(), time: time.value.trim(),
        principal: principal.value.trim()
      };
      const plan = planSeating(students, rooms, o);
      const core = C(), S = k.S();
      const charts = core.createPDF(chartPages(plan, o), { pageSize: o.pageSize, info: { Title: 'Room charts — ' + o.exam } });
      const att = core.createPDF(attendancePages(plan, o), { pageSize: o.pageSize, info: { Title: 'Attendance — ' + o.exam } });
      const notice = noticeText(plan, o);

      const problems = plan.notes.slice();
      if (!acc) problems.push('“' + accent.value + '” is not a hex colour, so the default navy was used.');
      const byRoom = {};
      plan.violations.forEach(v => { (byRoom[v.room] = byRoom[v.room] || []).push(v); });
      Object.keys(byRoom).sort().forEach(r => {
        byRoom[r].slice(0, 12).forEach(v => problems.push(r + ': ' + v.where + ' are both ' + v.section + ' (roll ' + v.a.roll + ' and ' + v.b.roll + ') — the rule was relaxed here.'));
        if (byRoom[r].length > 12) problems.push(r + ': and ' + (byRoom[r].length - 12) + ' more relaxed seat pairs.');
      });
      const badNames = plan.seated.filter(s => unprintable(s.name).length);
      if (badNames.length) problems.push(badNames.length + ' name(s) use characters the standard PDF fonts cannot draw and print as "?" on the attendance sheets: ' + badNames.slice(0, 4).map(s => s.roll).join(', ') + '. The room charts show roll numbers, which are safe.');

      result.appendChild(k.summaryCard(
        plan.seated.length + ' of ' + plan.students.length + ' students seated in ' + plan.plans.filter(p => p.seated).length + ' rooms',
        plan.sections.length + ' class' + (plan.sections.length === 1 ? '' : 'es') + ' · ' + plan.totalCap + ' usable seats · ' +
        (o.apart === 'off' ? 'no adjacency rule' : plan.violations.length ? plan.violations.length + ' same-class neighbour pair(s), all listed' : 'no two of the same class adjacent'),
        [
          k.downloadButton('seating-plan.xlsx', () => S.writeXlsx(sheetsOf(plan, o))),
          k.downloadButton('room-charts.pdf', () => new Blob([charts], { type: 'application/pdf' }), false),
          k.downloadButton('attendance-sheets.pdf', () => new Blob([att], { type: 'application/pdf' }), false),
          k.downloadButton('seating-notice.txt', () => new Blob([notice], { type: 'text/plain' }), false)
        ]));

      const secCount = {}; plan.seated.forEach(s => { secCount[s.section] = (secCount[s.section] || 0) + 1; });
      result.appendChild(k.statGrid([
        ['Students', plan.students.length],
        ['Seated', plan.seated.length],
        ['Not seated', plan.unseated.length],
        ['Rooms', plan.plans.map(p => p.room.name + ' (' + p.room.rows + '×' + p.room.cols + ')').join(', ')],
        ['Usable seats', plan.totalCap + (o.skip > 1 ? ' · every ' + o.skip + 'th seat left empty' : '')],
        ['Classes', Object.keys(secCount).sort().map(s => s + ' ' + secCount[s]).join(' · ')],
        ['Rule', o.apart === 'off' ? 'none (classes kept together)' : o.apart === 'both' ? 'no same class beside, in front or behind' : 'no same class beside'],
        ['Same-class neighbours', plan.violations.length],
        ['Seats swapped to meet the rule', plan.repaired],
        ['Reproducible by', o.order === 'shuffle' ? 'seed “' + o.seed + '”' : 'roll number order']
      ]));
      if (problems.length) result.appendChild(k.issues(problems, 'thing to check'));

      result.appendChild(k.h3('Seating plan'));
      result.appendChild(k.previewTable([['Room', 'Row', 'Seat', 'Roll No.', 'Name', 'Class']].concat(
        plan.seated.slice().sort((a, b) => String(a.room).localeCompare(String(b.room)) || (a.row - b.row) || (a.seat - b.seat))
          .map(s => [s.room, s.row, s.seat, s.roll, s.name, s.section])), 40));
      plan.plans.forEach(p => {
        result.appendChild(k.h3(p.room.name + ' — ' + p.room.rows + ' rows × ' + p.room.cols + ' seats'));
        result.appendChild(k.previewTable([[''].concat(Array.from({ length: p.room.cols }, (_, c) => 'Seat ' + (c + 1)))]
          .concat(Array.from({ length: p.room.rows }, (_, r) => ['Row ' + (r + 1)].concat(p.grid[r].map((s, c) => {
            if (s) return s.roll + ' (' + s.section + ')';
            const b = p.seats.find(q => q.r === r && q.c === c && q.blocked);
            return b ? (b.blocked === 'no seat' ? '—' : 'EMPTY') : '';
          })))), 40));
      });
      result.appendChild(k.h3('Notice for the circular'));
      const pane = k.el('div', 'io-pane');
      const pre = k.el('pre', 'code-out'); pre.textContent = notice;
      pane.appendChild(pre); result.appendChild(pane);
      result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="exam-seating"]'); if (r) mount(r); });
  window.MVRExamSeating = { parseRooms, roomOf, planSeating, seatsOf, capacityOf, scanViolations, orderStudents, rollRanges, noticeText };
})();
