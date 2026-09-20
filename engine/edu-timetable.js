/**
 * A school timetable, built in the browser.
 *
 * The problem is the one every school solves by hand in August: each class
 * needs so many periods of each subject, each subject is taught by a named
 * teacher, and no teacher can stand in two rooms at once. That is a
 * constraint problem with no fast exact answer, so this does what a good
 * timetabler does — place the most constrained lessons first, then keep
 * swapping until nothing is left over and the week looks sensible — and it
 * reports honestly what it could not place rather than quietly dropping it.
 *
 * Everything runs on the device: the allocation sheet holds staff names, and
 * those should not have to travel to a server to be arranged into a grid.
 */
(function () {
  'use strict';
  window.EDU_TOOLS = window.EDU_TOOLS || {};
  window.EDU_TOOLS['timetable'] = {
    title: 'School Timetable Generator',
    short: 'Timetable Generator',
    description: 'Give it the subject allocation — class, subject, teacher, periods a week — and get a clash-free timetable: a grid for every class, a grid for every teacher, double periods kept together, teacher free days honoured, and a plain list of anything that would not fit. Runs in your browser; no staff names are uploaded.',
    keywords: ['school timetable generator', 'timetable software free', 'class timetable maker', 'teacher timetable generator', 'school scheduling tool', 'clash free timetable', 'period allocation timetable', 'time table generator for school'],
    glyph: 'i-timetable',
    glyphSvg: '<symbol id="i-timetable" viewBox="0 0 24 24">\n  <rect x="3" y="5" width="18" height="16" rx="2"/>\n  <path d="M3 9.5h18M8.5 9.5V21M14 9.5V21" class="thin"/>\n  <path d="M7.5 3v4M16.5 3v4"/>\n  <circle cx="5.9" cy="12.6" r="1" class="fill"/>\n  <circle cx="11.2" cy="15.8" r="1" class="fill"/>\n  <circle cx="17.5" cy="12.6" r="1" class="fill"/>\n</symbol>',
    scripts: ['/engine/zip.js', '/engine/sheet.js', '/engine/biz-kit.js', '/engine/pdfcore.bundle.js', '/engine/edu-timetable.js'],
    tips: [
      'The one file it needs is the allocation your school already writes: one row per class–subject–teacher, with the periods a week. Column names are matched for you and can be corrected.',
      'Put the number of double periods in its own column for laboratory and games lessons. A double is placed as two periods side by side on the same day and never across a break.',
      'A teacher who is part-time, or who must have Wednesday afternoon free, goes in the unavailable box — one line per teacher, for example “R Menon: Wed 5-8, Fri”. Those slots are then left empty for that teacher, not worked around afterwards.',
      'Assembly, games and library go in the fixed periods box. They hold the class’s slot without needing a teacher, and everything else is arranged around them.',
      'If something cannot be placed the tool says so by name and explains why — usually one teacher has more periods than the week has slots, or two classes need the same teacher at the only time either is free. Fix the allocation and run it again; nothing is silently dropped.',
      'The seed makes a run repeatable. Change it to get a different arrangement of the same allocation, and keep the number of the one you liked.'
    ],
    faq: [
      { q: 'What does it guarantee?', a: 'No teacher is in two places at once, no class has two lessons at once, no teacher is booked when you said they are unavailable, no teacher exceeds the daily maximum you set, and every double period sits in two adjacent slots on one day. Those are checked after the grid is built, and the tool refuses to call a timetable finished if any of them fails.' },
      { q: 'What does it only try to do?', a: 'Spreading a subject across the week rather than twice in a day, keeping teachers’ free periods together instead of scattered, keeping the last period of the day off the subjects you name, and levelling teachers’ daily loads. These are scored, not enforced: a timetable that places every lesson with a few of these imperfect is better than no timetable.' },
      { q: 'Why did some lessons not fit?', a: 'Almost always arithmetic rather than bad luck. Add up one teacher’s periods a week: if it is more than the days times periods you have, no arrangement exists. The same goes for a class. The unplaced list names the class, subject and teacher, and the summary shows each teacher’s load against the maximum possible, so the cause is usually visible in one line.' },
      { q: 'Can it handle two teachers for one subject, or a class split into sets?', a: 'Write them as separate rows — “7A / Mathematics / R Menon / 4” and “7A / Mathematics / S Iyer / 2” — and both are placed without clashing. A split into sets that run at the same time is not supported: the tool assumes one class is in one place at a time.' },
      { q: 'Is any of this uploaded?', a: 'No. The allocation is read by your own browser, the timetable is built there, and the spreadsheet and PDF are written there. Staff names and teaching loads never leave the device.' }
    ]
  };
  if (typeof document === 'undefined') return;

  const K = () => window.MVRBizKit;
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const FIELDS = [
    { key: 'cls', label: 'Class / section', need: true, aliases: ['class', 'classsection', 'section', 'grade', 'standard', 'std', 'form', 'classname', 'div', 'division'] },
    { key: 'subject', label: 'Subject', need: true, aliases: ['subject', 'subjectname', 'paper', 'course'] },
    { key: 'teacher', label: 'Teacher', need: true, aliases: ['teacher', 'teachername', 'staff', 'staffname', 'faculty', 'tutor', 'instructor'] },
    { key: 'perWeek', label: 'Periods a week', need: true, aliases: ['periodsperweek', 'periods', 'perweek', 'noofperiods', 'weeklyperiods', 'lessons', 'periodsweek', 'frequency'] },
    { key: 'doubles', label: 'Double periods a week', aliases: ['doubles', 'doubleperiods', 'double', 'labperiods', 'combined'] },
    { key: 'room', label: 'Room (shown on the grid)', aliases: ['room', 'roomno', 'lab', 'venue', 'location'] }
  ];

  /* ---------------------------------------------------------------- */
  /* the solver                                                       */
  /* ---------------------------------------------------------------- */

  /** A small seeded generator, so a seed reproduces a timetable exactly. */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * grid: { days: [names], periods: n, breakAfter: [p,…] }
   * reqs: [{cls, subject, teacher, perWeek, doubles, room, row}]
   * cons: { maxPerDay: {teacher: n}, defaultMax, unavailable: {teacher: Set(slot)}, fixed: [{cls, slot, label}] }
   * opts: { avoidLast: [subject…], spread: bool, seed, ms }
   */
  function build(grid, reqs, cons, opts) {
    const D = grid.days.length, P = grid.periods, S = D * P;
    const slotDay = (s) => Math.floor(s / P), slotPeriod = (s) => s % P;
    const breakAfter = new Set(grid.breakAfter || []);
    /* a double may not straddle a break or a day boundary */
    const canPair = (s) => slotPeriod(s) < P - 1 && !breakAfter.has(slotPeriod(s) + 1);

    const classes = [], teachers = [];
    const classIdx = new Map(), teacherIdx = new Map();
    const idOf = (list, map, name) => { if (!map.has(name)) { map.set(name, list.length); list.push(name); } return map.get(name); };
    for (const r of reqs) { idOf(classes, classIdx, r.cls); idOf(teachers, teacherIdx, r.teacher); }
    for (const f of (cons.fixed || [])) idOf(classes, classIdx, f.cls);

    /* lessons: a requirement of 6 with 1 double becomes one 2 and four 1s */
    const lessons = [];
    const issues = [];
    reqs.forEach((r, i) => {
      const d = Math.max(0, Math.min(Math.floor(r.doubles || 0), Math.floor(r.perWeek / 2)));
      if ((r.doubles || 0) > d) issues.push(r.cls + ' ' + r.subject + ': ' + r.doubles + ' double periods do not fit in ' + r.perWeek + ' periods a week; ' + d + ' used.');
      let left = r.perWeek;
      for (let k = 0; k < d; k++) { lessons.push({ req: i, size: 2 }); left -= 2; }
      for (let k = 0; k < left; k++) lessons.push({ req: i, size: 1 });
    });
    lessons.forEach((l, i) => { l.id = i; l.cls = classIdx.get(reqs[l.req].cls); l.teacher = teacherIdx.get(reqs[l.req].teacher); l.subject = reqs[l.req].subject; });

    /* teacher availability and daily caps */
    const unavailable = teachers.map(t => (cons.unavailable && cons.unavailable[t]) || new Set());
    const maxPerDay = teachers.map(t => {
      const m = cons.maxPerDay && cons.maxPerDay[t];
      return Math.max(1, Math.min(P, Number.isFinite(m) ? m : (cons.defaultMax || P)));
    });
    const avoidLast = new Set((opts.avoidLast || []).map(x => String(x).toLowerCase()));

    /* feasibility, before any work is done */
    const capacity = [];
    const perClass = new Map(), perTeacher = new Map();
    for (const l of lessons) {
      perClass.set(l.cls, (perClass.get(l.cls) || 0) + l.size);
      perTeacher.set(l.teacher, (perTeacher.get(l.teacher) || 0) + l.size);
    }
    for (const f of (cons.fixed || [])) perClass.set(classIdx.get(f.cls), (perClass.get(classIdx.get(f.cls)) || 0) + 1);
    perClass.forEach((n, c) => { if (n > S) capacity.push(classes[c] + ' needs ' + n + ' periods a week but the week has only ' + S + '.'); });
    perTeacher.forEach((n, t) => {
      const free = S - unavailable[t].size;
      const cap = Math.min(free, maxPerDay[t] * D);
      if (n > cap) capacity.push(teachers[t] + ' teaches ' + n + ' periods a week but can work at most ' + cap + ' (' + free + ' available slots, ' + maxPerDay[t] + ' a day).');
    });

    /* ---- one attempt ---- */
    function attempt(seed) {
      const rand = rng(seed);
      const classAt = classes.map(() => new Array(S).fill(-1));   /* lesson id, -2 fixed */
      const teacherAt = teachers.map(() => new Array(S).fill(-1));
      const teacherDay = teachers.map(() => new Array(D).fill(0));
      const place = new Array(lessons.length).fill(-1);
      for (const f of (cons.fixed || [])) { const c = classIdx.get(f.cls); if (f.slot >= 0 && f.slot < S) classAt[c][f.slot] = -2; }

      const spanOk = (l, s) => {
        if (l.size === 2 && !canPair(s)) return false;
        const day = slotDay(s);
        if (teacherDay[l.teacher][day] + l.size > maxPerDay[l.teacher]) return false;
        for (let k = 0; k < l.size; k++) {
          const t = s + k;
          if (slotDay(t) !== day) return false;
          if (classAt[l.cls][t] !== -1) return false;
          if (teacherAt[l.teacher][t] !== -1) return false;
          if (unavailable[l.teacher].has(t)) return false;
        }
        return true;
      };

      /* how awkward a slot is, lower being better */
      const cost = (l, s) => {
        let c = 0;
        const day = slotDay(s);
        if (opts.spread !== false) {
          for (let p = 0; p < P; p++) {
            const other = classAt[l.cls][day * P + p];
            if (other >= 0 && lessons[other].subject === l.subject) c += 6;
          }
        }
        if (avoidLast.has(String(l.subject).toLowerCase())) {
          for (let k = 0; k < l.size; k++) if (slotPeriod(s + k) === P - 1) c += 4;
        }
        /* a teacher's free periods are better together than scattered */
        c += gapsFor(teacherAt[l.teacher], day, s, l.size) * 2;
        /* level the daily load */
        c += Math.max(0, teacherDay[l.teacher][day] + l.size - Math.ceil(perTeacher.get(l.teacher) / D)) * 1.5;
        /* a class's free periods belong at the end of the day */
        c += gapsFor(classAt[l.cls], day, s, l.size) * 1;
        return c;
      };
      function gapsFor(row, day, addAt, size) {
        let first = -1, last = -1, busy = 0;
        for (let p = 0; p < P; p++) {
          const s = day * P + p;
          const on = row[s] !== -1 || (addAt >= 0 && s >= addAt && s < addAt + size);
          if (on) { if (first < 0) first = p; last = p; busy++; }
        }
        return first < 0 ? 0 : (last - first + 1) - busy;
      }

      const put = (l, s) => {
        for (let k = 0; k < l.size; k++) { classAt[l.cls][s + k] = l.id; teacherAt[l.teacher][s + k] = l.id; }
        teacherDay[l.teacher][slotDay(s)] += l.size;
        place[l.id] = s;
      };
      const lift = (l) => {
        const s = place[l.id]; if (s < 0) return;
        for (let k = 0; k < l.size; k++) { classAt[l.cls][s + k] = -1; teacherAt[l.teacher][s + k] = -1; }
        teacherDay[l.teacher][slotDay(s)] -= l.size;
        place[l.id] = -1;
      };

      /* most constrained first: doubles, then busiest teacher, then random */
      const order = lessons.slice().sort((a, b) =>
        (b.size - a.size) ||
        ((perTeacher.get(b.teacher) + unavailable[b.teacher].size) - (perTeacher.get(a.teacher) + unavailable[a.teacher].size)) ||
        (rand() - 0.5));

      const unplaced = [];
      for (const l of order) {
        let best = -1, bestC = Infinity;
        for (let s = 0; s < S; s++) {
          if (!spanOk(l, s)) continue;
          const c = cost(l, s) + rand() * 0.9;
          if (c < bestC) { bestC = c; best = s; }
        }
        if (best >= 0) put(l, best); else unplaced.push(l);
      }

      /* repair: a lesson with nowhere to go usually needs one other lesson
         to move a slot or two, which is cheap to look for */
      for (let pass = 0; pass < 2 && unplaced.length; pass++) {
        for (let i = unplaced.length - 1; i >= 0; i--) {
          const l = unplaced[i];
          let done = false;
          for (let s = 0; s < S && !done; s++) {
            if (l.size === 2 && !canPair(s)) continue;
            if (slotDay(s) !== slotDay(s + l.size - 1)) continue;
            let blocker = -1, ok = true;
            for (let k = 0; k < l.size; k++) {
              const t = s + k;
              if (unavailable[l.teacher].has(t)) { ok = false; break; }
              const a = classAt[l.cls][t], b = teacherAt[l.teacher][t];
              if (a === -2) { ok = false; break; }
              for (const x of [a, b]) {
                if (x === -1) continue;
                if (blocker === -1) blocker = x; else if (blocker !== x) { ok = false; break; }
              }
              if (!ok) break;
            }
            if (!ok || blocker < 0) continue;
            const other = lessons[blocker];
            const was = place[other.id];
            lift(other);
            if (!spanOk(l, s)) { put(other, was); continue; }
            put(l, s);
            let moved = -1, bestC = Infinity;
            for (let s2 = 0; s2 < S; s2++) {
              if (!spanOk(other, s2)) continue;
              const c = cost(other, s2) + rand() * 0.5;
              if (c < bestC) { bestC = c; moved = s2; }
            }
            if (moved >= 0) { put(other, moved); unplaced.splice(i, 1); done = true; }
            else { lift(l); put(other, was); }
          }
        }
      }

      /* local search: move a lesson if the week gets tidier */
      const budget = Math.max(400, lessons.length * 30);
      for (let it = 0; it < budget; it++) {
        const l = lessons[Math.floor(rand() * lessons.length)];
        if (place[l.id] < 0) continue;
        const from = place[l.id];
        const before = cost(l, from);
        lift(l);
        let to = -1, bestC = before - 0.01;
        for (let tries = 0; tries < 12; tries++) {
          const s = Math.floor(rand() * S);
          if (!spanOk(l, s)) continue;
          const c = cost(l, s);
          if (c < bestC) { bestC = c; to = s; }
        }
        put(l, to >= 0 ? to : from);
      }

      /* Close teachers' free periods. A teacher with three lessons at the
         first, fourth and last period has sat through four free ones; the
         same three lessons in a row let them go home. Nothing moves unless
         the teacher's gaps across the whole week actually fall, and never
         if it would give a class the same subject twice in a day. */
      const teacherGaps = (ti) => {
        let g = 0;
        for (let d = 0; d < D; d++) {
          let f = -1, last = -1, n = 0;
          for (let p = 0; p < P; p++) if (teacherAt[ti][d * P + p] !== -1) { if (f < 0) f = p; last = p; n++; }
          if (f >= 0) g += (last - f + 1) - n;
        }
        return g;
      };
      const sameDayCount = (l, s) => {
        const day = slotDay(s); let n = 0;
        for (let p = 0; p < P; p++) {
          const other = classAt[l.cls][day * P + p];
          if (other >= 0 && other !== l.id && lessons[other].subject === l.subject) n++;
        }
        return n;
      };
      for (let pass = 0; pass < 6; pass++) {
        let moved = 0;
        for (let ti = 0; ti < teachers.length; ti++) {
          let g0 = teacherGaps(ti);
          if (!g0) continue;
          for (const l of lessons) {
            if (l.teacher !== ti || place[l.id] < 0) continue;
            const from = place[l.id];
            const wasSame = sameDayCount(l, from);
            lift(l);
            let to = from, bestG = g0;
            for (let s = 0; s < S; s++) {
              if (s === from || !spanOk(l, s)) continue;
              if (opts.spread !== false && sameDayCount(l, s) > wasSame) continue;
              put(l, s);
              const g = teacherGaps(ti);
              lift(l);
              if (g < bestG) { bestG = g; to = s; }
            }
            put(l, to);
            if (to !== from) { moved++; g0 = bestG; if (!g0) break; }
          }
        }
        if (!moved) break;
      }

      /* the score this attempt is judged on */
      let soft = 0;
      for (const l of lessons) if (place[l.id] >= 0) soft += cost(l, place[l.id]);
      return { place, unplaced: unplaced.map(l => l.id), soft, classAt, teacherAt };
    }

    return { classes, teachers, lessons, issues, capacity, attempt, D, P, S, slotDay, slotPeriod, classIdx, teacherIdx, dayName: (d) => grid.days[d] };
  }

  /** Run attempts until the time is up, keeping the best. */
  async function solve(grid, reqs, cons, opts, onProgress) {
    const model = build(grid, reqs, cons, opts);
    const until = Date.now() + (opts.ms || 3500);
    let best = null, runs = 0;
    const seed0 = Math.floor(opts.seed || 1);
    do {
      const r = model.attempt(seed0 + runs * 7919);
      runs++;
      if (!best || r.unplaced.length < best.unplaced.length || (r.unplaced.length === best.unplaced.length && r.soft < best.soft)) best = r;
      if (onProgress) onProgress(runs, best);
      if (best.unplaced.length === 0 && runs >= 3) break;
      await new Promise(res => setTimeout(res, 0));
    } while (Date.now() < until);
    return { model, best, runs };
  }

  /** Nothing is trusted until it has been checked from the other end. */
  function verify(model, best, cons) {
    const { D, P, S, lessons, classes, teachers } = model;
    const bad = [];
    const cSeen = classes.map(() => new Array(S).fill(null));
    const tSeen = teachers.map(() => new Array(S).fill(null));
    for (const l of lessons) {
      const s = best.place[l.id]; if (s < 0) continue;
      if (Math.floor(s / P) !== Math.floor((s + l.size - 1) / P)) bad.push('a double period runs past the end of a day');
      for (let k = 0; k < l.size; k++) {
        const t = s + k;
        if (cSeen[l.cls][t] !== null) bad.push(classes[l.cls] + ' has two lessons in the same period');
        if (tSeen[l.teacher][t] !== null) bad.push(teachers[l.teacher] + ' is in two classes at once');
        cSeen[l.cls][t] = l.id; tSeen[l.teacher][t] = l.id;
      }
    }
    for (const f of (cons.fixed || [])) {
      const c = model.classIdx.get(f.cls);
      if (c !== undefined && f.slot >= 0 && f.slot < S && cSeen[c][f.slot] !== null) bad.push(f.cls + ' has a lesson where ' + f.label + ' is fixed');
    }
    teachers.forEach((name, ti) => {
      const un = (cons.unavailable && cons.unavailable[name]) || new Set();
      for (const s of un) if (tSeen[ti][s] !== null) bad.push(name + ' is booked when marked unavailable');
      const cap = (cons.maxPerDay && cons.maxPerDay[name]) || cons.defaultMax || P;
      for (let d = 0; d < D; d++) {
        let n = 0; for (let p = 0; p < P; p++) if (tSeen[ti][d * P + p] !== null) n++;
        if (n > cap) bad.push(name + ' has ' + n + ' periods on ' + (model.dayName ? model.dayName(d) : 'day ' + (d + 1)) + ', above the maximum of ' + cap);
      }
    });
    return [...new Set(bad)];
  }

  /* ---------------------------------------------------------------- */
  /* reading the boxes                                                */
  /* ---------------------------------------------------------------- */

  const dayFromWord = (w, days) => {
    const s = String(w || '').trim().toLowerCase();
    for (let i = 0; i < days.length; i++) if (days[i].toLowerCase().startsWith(s.slice(0, 3)) && s.length >= 3) return i;
    return -1;
  };

  /** "R Menon: Wed 5-8, Fri" -> { 'R Menon': Set(slot) } */
  function parseUnavailable(text, grid) {
    const P = grid.periods, out = {}, issues = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim(); if (!line) continue;
      const at = line.indexOf(':');
      if (at < 0) { issues.push('“' + line + '” has no colon — write “Teacher: Mon 1-2, Fri”.'); continue; }
      const who = line.slice(0, at).trim();
      const set = out[who] || (out[who] = new Set());
      for (const part of line.slice(at + 1).split(',')) {
        const m = /^\s*([A-Za-z]{3,9})\s*(?:P?\s*(\d+)\s*(?:-\s*P?\s*(\d+))?)?\s*$/.exec(part);
        if (!m) { if (part.trim()) issues.push('“' + part.trim() + '” for ' + who + ' was not understood.'); continue; }
        const d = dayFromWord(m[1], grid.days);
        if (d < 0) { issues.push('“' + m[1] + '” for ' + who + ' is not one of the days in the week.'); continue; }
        const from = m[2] ? Number(m[2]) : 1, to = m[3] ? Number(m[3]) : (m[2] ? Number(m[2]) : P);
        for (let p = from; p <= to; p++) if (p >= 1 && p <= P) set.add(d * P + (p - 1));
      }
    }
    return { map: out, issues };
  }

  /** "6A: Mon 1 Assembly" -> [{cls, slot, label}] */
  function parseFixed(text, grid) {
    const P = grid.periods, out = [], issues = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim(); if (!line) continue;
      const at = line.indexOf(':');
      if (at < 0) { issues.push('“' + line + '” has no colon — write “6A: Mon 1 Assembly”.'); continue; }
      const cls = line.slice(0, at).trim();
      for (const part of line.slice(at + 1).split(',')) {
        const m = /^\s*([A-Za-z]{3,9})\s*P?\s*(\d+)\s*(.*)$/.exec(part);
        if (!m) { if (part.trim()) issues.push('“' + part.trim() + '” for ' + cls + ' was not understood.'); continue; }
        const d = dayFromWord(m[1], grid.days);
        const p = Number(m[2]);
        if (d < 0 || !(p >= 1 && p <= P)) { issues.push('“' + part.trim() + '” for ' + cls + ' is outside the week.'); continue; }
        out.push({ cls, slot: d * P + (p - 1), label: (m[3] || 'Fixed').trim() });
      }
    }
    return { fixed: out, issues };
  }

  /* ---------------------------------------------------------------- */
  /* the page                                                         */
  /* ---------------------------------------------------------------- */

  const SAMPLE = [
    ['Class', 'Subject', 'Teacher', 'Periods per week', 'Doubles', 'Room'],
    ['6A', 'English', 'A Fernandes', 6, 0, ''], ['6A', 'Mathematics', 'R Menon', 6, 0, ''], ['6A', 'Science', 'S Iyer', 6, 1, 'Lab 1'],
    ['6A', 'Social Studies', 'P Desai', 5, 0, ''], ['6A', 'Hindi', 'K Sharma', 4, 0, ''], ['6A', 'Computer', 'N Rao', 3, 1, 'Lab 2'],
    ['6A', 'Art', 'M Pinto', 2, 1, ''], ['6A', 'Physical Education', 'T Singh', 3, 1, 'Ground'],
    ['6B', 'English', 'A Fernandes', 6, 0, ''], ['6B', 'Mathematics', 'R Menon', 6, 0, ''], ['6B', 'Science', 'S Iyer', 6, 1, 'Lab 1'],
    ['6B', 'Social Studies', 'P Desai', 5, 0, ''], ['6B', 'Hindi', 'K Sharma', 4, 0, ''], ['6B', 'Computer', 'N Rao', 3, 1, 'Lab 2'],
    ['6B', 'Art', 'M Pinto', 2, 1, ''], ['6B', 'Physical Education', 'T Singh', 3, 1, 'Ground'],
    ['7A', 'English', 'J Mathew', 6, 0, ''], ['7A', 'Mathematics', 'R Menon', 6, 0, ''], ['7A', 'Science', 'V Kulkarni', 6, 1, 'Lab 1'],
    ['7A', 'Social Studies', 'P Desai', 5, 0, ''], ['7A', 'Hindi', 'K Sharma', 4, 0, ''], ['7A', 'Computer', 'N Rao', 3, 1, 'Lab 2'],
    ['7A', 'Art', 'M Pinto', 2, 1, ''], ['7A', 'Physical Education', 'T Singh', 3, 1, 'Ground'],
    ['7B', 'English', 'J Mathew', 6, 0, ''], ['7B', 'Mathematics', 'D Bose', 6, 0, ''], ['7B', 'Science', 'V Kulkarni', 6, 1, 'Lab 1'],
    ['7B', 'Social Studies', 'P Desai', 5, 0, ''], ['7B', 'Hindi', 'K Sharma', 4, 0, ''], ['7B', 'Computer', 'N Rao', 3, 1, 'Lab 2'],
    ['7B', 'Art', 'M Pinto', 2, 1, ''], ['7B', 'Physical Education', 'T Singh', 3, 1, 'Ground']
  ];

  function mount(root) {
    const k = K();
    const io = root.querySelector('.tool-io'); io.innerHTML = '';
    const st = { headers: [], rows: [], map: {}, name: '' };
    const msg = k.msgBox();

    /* 1. the week */
    io.appendChild(k.h3('1 · The week'));
    const bar1 = k.el('div', 'opt-bar');
    const dayCount = k.select('tt-days', [{ value: '5', label: 'Monday to Friday' }, { value: '6', label: 'Monday to Saturday' }, { value: '4', label: 'Monday to Thursday' }], '5');
    const periods = k.textInput('tt-periods', '8', '', 'number'); periods.min = 2; periods.max = 12;
    const breaks = k.textInput('tt-breaks', '3, 6', 'e.g. 3, 6');
    const startTime = k.textInput('tt-start', '08:30', 'HH:MM');
    const minutes = k.textInput('tt-minutes', '40', '', 'number'); minutes.min = 20; minutes.max = 90;
    bar1.appendChild(k.field('Days', dayCount));
    bar1.appendChild(k.field('Periods a day', periods, 'Teaching periods, not counting breaks'));
    bar1.appendChild(k.field('Break after period', breaks, 'Doubles are never split across these'));
    bar1.appendChild(k.field('First period starts', startTime, 'Only used for the printed times'));
    bar1.appendChild(k.field('Period length (minutes)', minutes));
    io.appendChild(bar1);

    /* 2. the allocation */
    io.appendChild(k.h3('2 · The subject allocation'));
    const mapBox = k.el('div');
    const drop = k.dropzone('Choose the allocation sheet (Excel or CSV)', '.xlsx,.csv', async (f) => {
      try {
        msg.say('Reading…', 'note');
        const t = await k.readTable(f); const h = k.splitHeader(t.sheets[0].rows);
        loadRows(h.headers, h.rows, f.name);
        msg.say('');
      } catch (e) { msg.say(e.message, 'error'); }
    });
    io.appendChild(drop);
    const sampleBar = k.el('div', 'io-actions');
    sampleBar.appendChild(k.button('Load a worked example (4 classes, 11 teachers)', 'btn-ghost', () => {
      const h = k.splitHeader(SAMPLE.map(r => r.slice()));
      loadRows(h.headers, h.rows, 'worked example');
      unavail.value = 'M Pinto: Mon, Tue\nT Singh: Fri 7-8\nN Rao: Wed';
      fixedTa.value = '6A: Mon 1 Assembly\n6B: Mon 1 Assembly\n7A: Mon 1 Assembly\n7B: Mon 1 Assembly';
      msg.say('Worked example loaded — press Build the timetable.', 'note');
    }));
    io.appendChild(sampleBar);
    io.appendChild(mapBox);
    function loadRows(headers, rows, name) {
      st.headers = headers; st.rows = rows; st.name = name;
      st.map = k.autoMap(FIELDS, headers);
      mapBox.innerHTML = '';
      mapBox.appendChild(k.mapPanel('Allocation columns', FIELDS, headers, st.map));
      drop.say(name, rows.length + ' rows');
    }

    /* 3. what cannot move */
    io.appendChild(k.h3('3 · Teachers and fixed periods'));
    const unavail = k.textarea('tt-unavail', '', 'One teacher per line — R Menon: Wed 5-8, Fri', 4);
    const fixedTa = k.textarea('tt-fixed', '', 'One class per line — 6A: Mon 1 Assembly, Fri 8 Games', 4);
    const two = k.el('div', 'biz-two');
    const colA = k.el('div', 'biz-col'); colA.appendChild(k.field('Unavailable', unavail, 'A day on its own means the whole day'));
    const colB = k.el('div', 'biz-col'); colB.appendChild(k.field('Fixed periods', fixedTa, 'Assembly, games, library — held without a teacher'));
    two.appendChild(colA); two.appendChild(colB); io.appendChild(two);

    const bar2 = k.el('div', 'opt-bar');
    const maxDay = k.textInput('tt-maxday', '6', '', 'number'); maxDay.min = 1; maxDay.max = 12;
    const avoidLast = k.textInput('tt-avoid', 'Mathematics, Science', 'Subjects to keep out of the last period');
    const spread = k.select('tt-spread', [{ value: 'yes', label: 'Spread across the week' }, { value: 'no', label: 'Do not mind repeats in a day' }], 'yes');
    const seed = k.textInput('tt-seed', '1', '', 'number'); seed.min = 1;
    bar2.appendChild(k.field('Most periods a teacher may take in a day', maxDay));
    bar2.appendChild(k.field('Keep out of the last period', avoidLast));
    bar2.appendChild(k.field('Same subject twice in a day', spread));
    bar2.appendChild(k.field('Seed', seed, 'The same seed gives the same timetable'));
    io.appendChild(bar2);

    const run = k.el('div', 'io-actions pdf-run');
    const goBtn = k.button('Build the timetable', 'btn-primary', go);
    run.appendChild(goBtn); io.appendChild(run); io.appendChild(msg);
    const result = k.el('div', 'biz-result'); io.appendChild(result);

    /* ---- running it ---- */
    async function go() {
      result.innerHTML = '';
      if (!st.rows.length) { msg.say('Choose the allocation sheet, or load the worked example.', 'note'); return; }
      const miss = k.missing(FIELDS, st.map);
      if (miss.length) { msg.say('Map ' + miss.join(', ') + ' first.', 'error'); return; }

      const D = Number(dayCount.value), P = Math.max(2, Math.min(12, Number(periods.value) || 8));
      const grid = {
        days: DAY_NAMES.slice(0, D),
        short: DAY_SHORT.slice(0, D),
        periods: P,
        breakAfter: String(breaks.value).split(/[,\s]+/).map(Number).filter(n => n >= 1 && n < P)
      };
      const get = (r, key) => st.map[key] === undefined ? '' : r[st.map[key]];
      const reqs = []; const rowIssues = [];
      st.rows.forEach((r, i) => {
        const cls = String(get(r, 'cls') || '').trim(), subject = String(get(r, 'subject') || '').trim(), teacher = String(get(r, 'teacher') || '').trim();
        const perWeek = Math.round(k.toNumber(get(r, 'perWeek')));
        if (!cls || !subject || !teacher) { rowIssues.push('Row ' + (i + 2) + ': class, subject and teacher are all needed.'); return; }
        if (!(perWeek > 0)) { rowIssues.push('Row ' + (i + 2) + ' (' + cls + ' ' + subject + '): periods a week is not a number above zero.'); return; }
        reqs.push({ cls, subject, teacher, perWeek, doubles: Math.round(k.toNumber(get(r, 'doubles')) || 0), room: String(get(r, 'room') || '').trim(), row: i + 2 });
      });
      if (!reqs.length) { msg.say('No usable rows. ' + (rowIssues[0] || ''), 'error'); if (rowIssues.length) result.appendChild(k.issues(rowIssues)); return; }

      const un = parseUnavailable(unavail.value, grid);
      const fx = parseFixed(fixedTa.value, grid);
      const cons = { unavailable: un.map, defaultMax: Math.max(1, Number(maxDay.value) || P), maxPerDay: {}, fixed: fx.fixed };
      const opts = {
        avoidLast: String(avoidLast.value).split(',').map(s => s.trim()).filter(Boolean),
        spread: spread.value === 'yes',
        seed: Math.max(1, Number(seed.value) || 1),
        ms: 3500
      };

      goBtn.disabled = true;
      msg.say('Arranging ' + reqs.reduce((n, r) => n + r.perWeek, 0) + ' periods…', 'note');
      let out;
      try {
        out = await solve(grid, reqs, cons, opts, (n, best) => {
          msg.say('Arranging… attempt ' + n + (best.unplaced.length ? ' — ' + best.unplaced.length + ' still unplaced' : ' — everything placed, tidying'), 'note');
        });
      } catch (e) { goBtn.disabled = false; msg.say(e.message, 'error'); return; }
      goBtn.disabled = false;

      const { model, best, runs } = out;
      model.dayName = (d) => grid.days[d];
      const broken = verify(model, best, cons);
      show(grid, model, best, reqs, cons, opts, { runs, broken, rowIssues: rowIssues.concat(un.issues, fx.issues, model.issues), capacity: model.capacity });
    }

    /* ---- what comes back ---- */
    function show(grid, model, best, reqs, cons, opts, info) {
      const S = model.S, P = grid.periods, D = grid.days.length;
      const label = (lid, forTeacher) => {
        const l = model.lessons[lid], r = reqs[l.req];
        return forTeacher ? r.cls + ' · ' + r.subject : r.subject + ' · ' + r.teacher + (r.room ? ' · ' + r.room : '');
      };
      /* a cell for every class and every teacher */
      const classGrid = model.classes.map((name, ci) => {
        const rows = [];
        for (let d = 0; d < D; d++) {
          const row = [grid.short[d]];
          for (let p = 0; p < P; p++) {
            const s = d * P + p, lid = best.classAt[ci][s];
            const fixedHere = (cons.fixed || []).find(f => f.cls === name && f.slot === s);
            row.push(lid >= 0 ? label(lid) : fixedHere ? fixedHere.label : '—');
          }
          rows.push(row);
        }
        return { name, rows };
      });
      const teacherGrid = model.teachers.map((name, ti) => {
        const rows = [];
        for (let d = 0; d < D; d++) {
          const row = [grid.short[d]];
          for (let p = 0; p < P; p++) {
            const lid = best.teacherAt[ti][d * P + p];
            const un = (cons.unavailable[name] || new Set()).has(d * P + p);
            row.push(lid >= 0 ? label(lid, true) : un ? '(not available)' : 'free');
          }
          rows.push(row);
        }
        return { name, rows };
      });
      const head = ['Day'].concat(Array.from({ length: P }, (_, i) => 'P' + (i + 1)));

      /* period times, for the printed grids */
      const times = (() => {
        const m = /^(\d{1,2}):(\d{2})$/.exec(String(startTime.value).trim());
        if (!m) return null;
        let t = Number(m[1]) * 60 + Number(m[2]);
        const len = Math.max(20, Number(minutes.value) || 40), out = [];
        for (let p = 0; p < P; p++) {
          const a = t, b = t + len;
          out.push(String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0') + '–' + String(Math.floor(b / 60)).padStart(2, '0') + ':' + String(b % 60).padStart(2, '0'));
          t = b + (grid.breakAfter.indexOf(p + 1) >= 0 ? 15 : 0);
        }
        return out;
      })();

      const placed = model.lessons.filter(l => best.place[l.id] >= 0).reduce((n, l) => n + l.size, 0);
      const total = model.lessons.reduce((n, l) => n + l.size, 0);
      const unplacedRows = [['Class', 'Subject', 'Teacher', 'Periods not placed', 'Most likely reason']];
      const byReq = new Map();
      for (const id of best.unplaced) { const l = model.lessons[id]; byReq.set(l.req, (byReq.get(l.req) || 0) + l.size); }
      byReq.forEach((n, ri) => {
        const r = reqs[ri];
        const cap = info.capacity.find(c => c.indexOf(r.teacher) === 0) || info.capacity.find(c => c.indexOf(r.cls) === 0);
        unplacedRows.push([r.cls, r.subject, r.teacher, n, cap || 'no free slot where both the class and the teacher are free']);
      });

      const loadRows = [['Teacher', 'Periods a week', 'Busiest day', 'Free periods in the week', 'Days present']];
      model.teachers.forEach((name, ti) => {
        let week = 0, busiest = 0, days = 0, gaps = 0;
        for (let d = 0; d < D; d++) {
          let n = 0, first = -1, last = -1;
          for (let p = 0; p < P; p++) if (best.teacherAt[ti][d * P + p] >= 0) { n++; if (first < 0) first = p; last = p; }
          week += n; busiest = Math.max(busiest, n); if (n) days++;
          if (first >= 0) gaps += (last - first + 1) - n;
        }
        loadRows.push([name, week, busiest, D * P - week, days]);
      });

      const S_ = k.S();
      const sheets = [{ name: 'Class timetables', rows: stack(classGrid, head, times) },
        { name: 'Teacher timetables', rows: stack(teacherGrid, head, times) },
        { name: 'Teacher load', rows: loadRows }];
      if (unplacedRows.length > 1) sheets.push({ name: 'Not placed', rows: unplacedRows });

      const ok = best.unplaced.length === 0 && info.broken.length === 0;
      result.appendChild(k.summaryCard(
        ok ? 'Timetable built: ' + model.classes.length + ' classes, ' + model.teachers.length + ' teachers, ' + placed + ' periods, no clashes'
           : placed + ' of ' + total + ' periods placed — ' + (total - placed) + ' would not fit',
        info.runs + ' attempt' + (info.runs === 1 ? '' : 's') + ' · seed ' + opts.seed + ' · ' + D + ' days × ' + P + ' periods',
        [k.downloadButton('timetable.xlsx', () => S_.writeXlsx(sheets)),
          k.downloadButton('timetables.pdf', () => pdf(grid, classGrid, teacherGrid, times, opts), false)]));

      result.appendChild(k.statGrid([
        ['Periods placed', placed + ' of ' + total],
        ['Classes', model.classes.length], ['Teachers', model.teachers.length],
        ['Double periods', model.lessons.filter(l => l.size === 2).length],
        ['Clashes found on checking', info.broken.length],
        ['Attempts', info.runs]
      ]));

      if (info.broken.length) result.appendChild(k.issues(info.broken, 'clash — please report this'));
      if (info.capacity.length) result.appendChild(k.issues(info.capacity, 'allocation that cannot fit'));
      if (info.rowIssues.length) result.appendChild(k.issues(info.rowIssues, 'row skipped or note'));
      if (unplacedRows.length > 1) { result.appendChild(k.h3('Not placed')); result.appendChild(k.previewTable(unplacedRows, 30)); }

      result.appendChild(k.h3('Class timetables'));
      for (const g of classGrid) { result.appendChild(k.h3(g.name)); result.appendChild(k.previewTable([head].concat(g.rows), D)); }
      result.appendChild(k.h3('Teacher timetables'));
      for (const g of teacherGrid) { result.appendChild(k.h3(g.name)); result.appendChild(k.previewTable([head].concat(g.rows), D)); }
      result.appendChild(k.h3('Teacher load'));
      result.appendChild(k.previewTable(loadRows, 60));

      msg.say(ok ? '' : 'Some periods could not be placed — the list above says why.', ok ? '' : 'warn');
      result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function stack(grids, head, times) {
      const rows = [];
      if (times) rows.push(['', ''].concat(times));
      for (const g of grids) {
        rows.push([g.name]);
        rows.push(head.slice());
        for (const r of g.rows) rows.push(r.slice());
        rows.push([]);
      }
      return rows;
    }

    /* one page per class, then one per teacher, landscape */
    function pdf(grid, classGrid, teacherGrid, times, opts) {
      const core = window.MVRPdfCore;
      const [h0, w0] = core.PAGE_SIZES.a4;
      const W = w0, H = h0;                                  /* landscape */
      const P = grid.periods, D = grid.days.length;
      const pages = [];
      const draw = (title, sub, g) => {
        const ops = [];
        const m = 28;
        ops.push({ rect: [0, H - 5, W, 5], fill: '#8a1c1c' });
        ops.push({ text: title, x: m, y: H - 34, size: 16, font: 'Helvetica-Bold' });
        ops.push({ text: sub, x: W - m, y: H - 34, size: 9, align: 'right', colour: '#666666' });
        const top = H - 52, left = m, right = W - m;
        const colW = (right - left - 52) / P, rowH = Math.min(84, (top - 78) / D);
        /* header */
        const headH = 32;
        ops.push({ rect: [left, top - headH, right - left, headH], fill: '#f0ece6' });
        for (let p = 0; p < P; p++) {
          const x = left + 52 + p * colW;
          ops.push({ text: 'P' + (p + 1), x: x + colW / 2, y: top - 15, size: 9, font: 'Helvetica-Bold', align: 'center' });
          if (times) ops.push({ text: times[p], x: x + colW / 2, y: top - 26, size: 5.5, align: 'center', colour: '#666666' });
          if (grid.breakAfter.indexOf(p + 1) >= 0 && p < P - 1) ops.push({ line: [x + colW, top, x + colW, top - headH - D * rowH], stroke: '#8a1c1c', lineWidth: 1.2 });
        }
        for (let d = 0; d < D; d++) {
          const y = top - headH - (d + 1) * rowH;
          ops.push({ text: grid.short[d], x: left + 8, y: y + rowH / 2 - 2, size: 9, font: 'Helvetica-Bold' });
          for (let p = 0; p < P; p++) {
            const x = left + 52 + p * colW;
            ops.push({ rect: [x, y, colW, rowH], stroke: '#cfc7bb', lineWidth: 0.5 });
            const cell = String(g.rows[d][p + 1] || '');
            if (cell === '—' || cell === 'free' || cell === '(not available)') { ops.push({ text: cell === '(not available)' ? 'not available' : 'Free', x: x + colW / 2, y: y + rowH / 2 - 2, size: 7, align: 'center', colour: '#aaaaaa' }); continue; }
            const lines = cell.split(' · ');
            let yy = y + rowH - 13;
            lines.slice(0, 3).forEach((ln, i) => {
              const fit = core.wrapText(ln, i === 0 ? 'Helvetica-Bold' : 'Helvetica', i === 0 ? 7.5 : 6.5, colW - 8)[0] || ln;
              ops.push({ text: fit, x: x + 4, y: yy, size: i === 0 ? 7.5 : 6.5, font: i === 0 ? 'Helvetica-Bold' : 'Helvetica', colour: i === 0 ? '#111111' : '#555555' });
              yy -= i === 0 ? 9 : 8;
            });
          }
        }
        ops.push({ line: [left, top, right, top], stroke: '#8a1c1c', lineWidth: 1 });
        ops.push({ text: 'Built with 1234tools.com/education/timetable/ · seed ' + opts.seed, x: m, y: 22, size: 6.5, colour: '#999999' });
        pages.push({ size: [W, H], ops });
      };
      for (const g of classGrid) draw('Class ' + g.name, 'Class timetable', g);
      for (const g of teacherGrid) draw(g.name, 'Teacher timetable', g);
      return new Blob([core.createPDF(pages, { info: { Title: 'Timetable', Creator: '1234Tools' } })], { type: 'application/pdf' });
    }
  }

  document.addEventListener('DOMContentLoaded', () => { const r = document.querySelector('[data-tool="timetable"]'); if (r) mount(r); });
  window.MVRTimetable = { solve, verify, parseUnavailable, parseFixed, rng };
})();
