/**
 * Live Presentation: a deck of slides prepared in advance — multiple choice,
 * quiz questions with points for speed, open answers, word clouds, ratings,
 * audience Q&A, a leaderboard and plain heading slides — presented to a room
 * whose phones joined once with one code. Moving to a slide sends its card;
 * every phone switches to it at once. Results are kept per slide, so going
 * back shows them again, and they are revealed only when the presenter
 * chooses (R).
 *
 * Every answer is counted here, in the presenter's browser, against the
 * phone's id. Phones receive the slide, and the totals and correct answers
 * only after Reveal; a phone's own quiz points, total and rank reach that
 * phone alone (a `direct` message). Word cloud, rating and Q&A slides use the
 * counting rules and the big-screen drawing of engine/room-word-cloud.js,
 * room-rating-scale.js and room-audience-qa.js, fetched when a deck has such
 * a slide. engine/room-kit.js runs the session; the phone side of the new
 * cards is engine/room-join-deck.js.
 */
(function () {
  'use strict';
  window.ROOM_TOOLS = window.ROOM_TOOLS || {};
  const PRIVACY = 'Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.';

  /* ---------- sample decks (plain data; the tool starts from SAMPLE the first time) ---------- */

  const SAMPLE = {
    title: 'Sample deck',
    slides: [
      { t: 'info', q: 'Welcome! Join on your phone', body: 'Open 1234tools.com/join and type the code on the screen.' },
      { t: 'mc', q: 'Which planet is closest to the Sun?', o: ['Venus', 'Mercury', 'Mars', 'Earth'], a: [1], m: 1, ch: true, hide: true },
      { t: 'wc', q: 'One word for how you feel today', n: 1, hide: false },
      { t: 'quiz', q: 'Which is the largest ocean?', o: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], a: [2], secs: 20, hide: true },
      { t: 'lb', q: 'Leaderboard' },
      { t: 'oe', q: 'What should we talk about next time?', ch: true, hide: false }
    ]
  };
  const CLASS_DECK = {
    title: 'Class quiz',
    slides: [
      { t: 'info', q: 'Quick quiz!', body: 'Join at 1234tools.com/join with the code on the board. Use a nickname, not your full name.' },
      { t: 'quiz', q: 'What is 7 × 8?', o: ['54', '56', '64', '48'], a: [1], secs: 20, hide: true },
      { t: 'quiz', q: 'Which of these is a prime number?', o: ['21', '27', '29', '33'], a: [2], secs: 20, hide: true },
      { t: 'quiz', q: 'Water boils at sea level at…', o: ['90 °C', '100 °C', '110 °C', '120 °C'], a: [1], secs: 20, hide: true },
      { t: 'lb', q: 'Leaderboard' },
      { t: 'mc', q: 'Which topics would you like to go over again?', o: ['Times tables', 'Prime numbers', 'Science facts', 'None — all clear!'], a: [], m: 2, ch: true, hide: true },
      { t: 'oe', q: 'What was the hardest part of today?', ch: true, hide: true }
    ]
  };
  const MEETING_DECK = {
    title: 'Team meeting',
    slides: [
      { t: 'info', q: 'Team meeting', body: 'Join at 1234tools.com/join with the code on the screen.' },
      { t: 'rt', q: 'How was your week?', s: 'ten', lo: 'Rough', hi: 'Great', hide: false },
      { t: 'wc', q: 'One word for this quarter', n: 2, hide: false },
      { t: 'mc', q: 'Which two things should we fix first?', o: ['Meetings', 'Tools', 'Hand-offs', 'Documentation', 'Planning'], a: [], m: 2, ch: true, hide: true },
      { t: 'oe', q: 'One idea to make next month easier', ch: true, hide: false },
      { t: 'qa', q: 'Your questions for the team', up: true, ap: false }
    ]
  };
  const QUIZ_NIGHT_DECK = {
    title: 'Quiz night',
    slides: [
      { t: 'info', q: 'Quiz night!', body: 'Phones out: 1234tools.com/join and the code on the screen. Faster right answers score more.' },
      { t: 'quiz', q: 'How many players are on a cricket team?', o: ['9', '10', '11', '12'], a: [2], secs: 15, hide: false },
      { t: 'quiz', q: 'Which country gave the world the Olympic Games?', o: ['Italy', 'Greece', 'Egypt', 'China'], a: [1], secs: 15, hide: false },
      { t: 'quiz', q: 'What colour do you get by mixing blue and yellow?', o: ['Green', 'Purple', 'Orange', 'Brown'], a: [0], secs: 15, hide: false },
      { t: 'lb', q: 'Leaderboard after round one' },
      { t: 'quiz', q: 'How many continents are there?', o: ['5', '6', '7', '8'], a: [2], secs: 15, hide: false },
      { t: 'quiz', q: 'Which is the longest river in the world?', o: ['Amazon', 'Nile', 'Ganges', 'Yangtze'], a: [1], secs: 20, hide: false },
      { t: 'lb', q: 'Final scores' }
    ]
  };

  window.ROOM_TOOLS['live-presentation'] = {
    order: 5,
    title: 'Live Presentation',
    short: 'Live Presentation',
    description: 'Prepare a deck of questions — multiple choice, timed quiz, word cloud, open answers, rating, Q&A — then present it: phones join once with a code, follow every slide, and you reveal the answers when you choose. Free, no sign-up, no app.',
    keywords: ['interactive presentation', 'live presentation with polls', 'live quiz with phones', 'audience response system', 'quiz with leaderboard', 'free presentation polls', 'classroom quiz on phones'],
    glyph: 'i-live-presentation',
    glyphSvg: '<symbol id="i-live-presentation" viewBox="0 0 24 24">\n  <path d="M3.4 4.2h17.2v11.2H3.4z"/>\n  <path d="M12 15.4v3.6M8.4 20.4h7.2" class="thin"/>\n  <path d="M7 12.6v-2.4M10 12.6V7.4M13 12.6V9.2" class="thin"/>\n  <path d="M15.4 9.8l1.5 1.5 2.3-2.9"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/room-client.js', '/engine/room-words.js', '/engine/room-kit.js', '/engine/room-live-presentation.js'],
    privacy: PRIVACY,
    how: [
      'The sample deck is ready to try. Press a slide in “Your slides” to change it, or pick a type under “Add a slide” and press Add.',
      'For each question type the text and the answers, one per line. Tick the correct answer if there is one.',
      'Press “Start a live session”. A 6-digit code and a QR code appear.',
      'Press “Show on TV” and drag the new window to the projector, then press Full screen there.',
      'Tell the audience: open 1234tools.com/join on your phone (or scan the QR code), type the code, pick a nickname and press Join.',
      'Press “Present”. The first slide appears on the big screen and on every phone.',
      'Press Next (→ or Space) to move on and Previous (←) to go back. Press R to reveal the results, H to hide them and C to close or reopen voting. On the last slide Next becomes Finish: the big screen and every phone show the finale, with the winner and confetti after a quiz.',
      'Press “Export CSV” to save every slide’s results, then “End session” (press it twice) to close the room on every phone.'
    ],
    manual: {
      setup: [
        'Open Live Presentation on the laptop that is connected to the projector or TV.',
        'Change the sample slides, or add your own with “Add a slide”. The deck saves on this laptop as you type.',
        'To use the deck on another computer, press “Save deck file” and open the file there with “Open deck file”.',
        'Press “Start a live session”: a 6-digit code and a QR code appear.'
      ],
      play: [
        'Audience: open 1234tools.com/join on a phone, or scan the QR code with the camera.',
        'Audience: type the 6 digits, choose a nickname (or press Random nickname) and press Join.',
        'Presenter: press Present. Every phone shows the first slide.',
        'Audience: tap an answer or type one and press Send. The phone says “Your answer was sent”.',
        'Presenter: press R to reveal the results, then → (or Space) for the next slide. After a quiz answer the top 5 appear by themselves; after the last one, the winner. On the last slide press Finish for the finale.',
        'Presenter: Export CSV, then End session (press twice).'
      ],
      tv: [
        'Press “Show on TV (new window)” and drag that window to the projector or TV.',
        'Press Full screen in that window; this page stays your remote. A clicker’s Next and Back keys work in either window.',
        'With one screen only, press “Full screen here”; press Esc to come back.',
        'Untick “Show the join code on the big screen” to give the slide the whole screen.'
      ],
      troubleshooting: [
        { q: 'A phone still shows the last slide.', a: 'Phones switch by themselves when you press Next. If one is stuck, it has lost its connection: it reconnects on its own, or reload /join/ on that phone.' },
        { q: 'The results showed too early.', a: 'Tick “Hide results until I reveal” on that slide. Press H to hide them again at any time.' },
        { q: 'I reloaded the page by mistake.', a: 'Press “Reopen session” in the same tab: the code, the slide you were on and every result come back.' },
        { q: 'A quiz question closed before everyone answered.', a: 'It closes when the time runs out or when everyone in the room has answered. Give more seconds on that slide next time.' },
        { q: 'Someone joined with a rude nickname.', a: 'Open “People” in the session panel and press Remove next to it; that phone cannot rejoin.' }
      ]
    },
    uses: [
      ['Classroom', 'a quiz with a leaderboard, then an open question about what was hard'],
      ['Team meeting', 'a rating, a word cloud and the team’s questions in one deck'],
      ['Quiz night', 'rounds of timed questions on the TV with points for the fastest right answers']
    ],
    tips: [
      'One code for the whole deck: phones join once and follow you from slide to slide.',
      'Results are kept for every slide. Go back with ← and they are still there; press C to reopen voting on that slide.',
      'Quiz points: a right answer scores from 1000 (at once) down to 500 (at the last moment); a wrong answer or no answer scores 0. Equal points go to the player whose right answers took less time in total.',
      'After each quiz question’s answer, the big screen shows the top 5 by itself (points and total answering time); after the last question it reveals third, second and then the winner. Press Next to go on.',
      'Each phone sees only its own quiz points, total and place, never anyone else’s answer.',
      'Save deck file keeps the deck in a small .json file, so you can prepare it days before and present from another laptop.',
      'Export CSV saves every slide: counts per answer, every typed answer, and the quiz scores by nickname.'
    ],
    faq: [
      { q: 'Do people need an app or an account?', a: 'No. They open 1234tools.com/join in their phone’s browser, type the 6-digit code (or scan the QR code) and choose a nickname. You need no account either.' },
      { q: 'Do phones change slide by themselves?', a: 'Yes. When you press Next or Previous, every joined phone switches to that slide at once, without reloading. A content slide shows “Look at the screen”.' },
      { q: 'Can I hide the answers until I am ready?', a: 'Yes. Multiple-choice and quiz slides start with “Hide results until I reveal” ticked: the screen shows only how many have answered until you press R. Then the counts, percentages and the correct answers appear on the screen and on the phones.' },
      { q: 'How are quiz points worked out?', a: 'A right answer scores 1000 points if it arrives at once, falling evenly to 500 at the deadline; a wrong answer or no answer scores 0. The time is measured by our relay when the answer arrives, so a slow phone clock makes no difference. Players on equal points are ranked by the total time their right answers took, fastest first.' },
      { q: 'Is there a winner announcement?', a: 'Yes. Four seconds after each quiz answer is revealed the big screen shows the top 5; after the last quiz question it reveals third place, then second, then the winner. The winner’s phone says “You won!” and every other phone shows its final place. On the last slide, Finish ends the deck in celebration: the podium again with “Congratulations” and confetti on the big screen, and the winner’s name and confetti on every phone.' },
      { q: 'Where is my deck kept?', a: 'In this browser on this computer, saved as you edit. Save deck file downloads it as a .json file; Open deck file loads it on any computer. Nothing about the deck is stored on our server.' },
      { q: 'What does the server see and keep?', a: 'The relay at live.1234tools.com passes each slide to the phones and each answer to you. It keeps only the current slide in memory so late joiners see it, and forgets everything when the session ends (24 hours at most). Answers are counted on your device.' },
      { q: 'How many people can join?', a: 'During the launch trial a free session takes up to 1,000 phones at once. When it is full, the next phone is told the session is full.' },
      { q: 'Can I keep the results?', a: 'Yes. Export CSV saves every slide: votes and percentages per answer, typed answers, word counts, ratings, questions and the quiz scores by nickname. The file is made in your browser.' }
    ],
    related: ['/live/live-poll/', '/live/word-cloud/', '/games/quiz-buzzer/'],
    landings: [
      {
        slug: 'live-quiz-for-classroom',
        title: 'Live Quiz for the Classroom',
        description: 'Run a quiz on the board that pupils answer on phones or tablets with a code: timed questions, points for speed, a leaderboard, then an open question. Free, no accounts.',
        lede: 'Three quick questions, a leaderboard, then a check on what was hard — ready to change into your own lesson.',
        preset: { key: 'class', deck: CLASS_DECK },
        about: [
          'This page starts with a short class deck: three timed quiz questions, a leaderboard, a multiple-choice question where pupils may pick two answers, and an open question. The answers stay hidden until you press R, so pupils think for themselves.',
          'Pupils join at 1234tools.com/join with the code on the board and a nickname — no accounts and no e-mail addresses. Each pupil’s phone shows only their own points and place.'
        ],
        faq: [
          { q: 'Can I change the questions?', a: 'Yes. Press any slide to edit it, add more with “Add a slide”, and save the deck as a file to use again next term.' },
          { q: 'Do pupils see each other’s answers?', a: 'No. The board shows totals after you reveal them; each phone sees its own answer, whether it was right, and its own points.' }
        ]
      },
      {
        slug: 'interactive-meeting-presentation',
        title: 'Interactive Presentation for Team Meetings',
        description: 'Turn a team meeting into a conversation: a rating, a word cloud, a two-choice vote, open ideas and Q&A in one deck, answered from phones with one code. Free, no sign-up.',
        lede: 'One code at the start of the meeting, then every question on the shared screen is answered from people’s phones.',
        preset: { key: 'meeting', deck: MEETING_DECK },
        about: [
          'This page starts with a meeting deck: how the week went on a 0–10 scale, a word cloud, a vote where everyone picks two priorities, open ideas and a Q&A slide where people upvote the questions they want answered.',
          'Share the big-screen window in your video call or put it on the meeting-room screen. Answers are counted in your browser; the server only passes them on and forgets them when you end the session.'
        ],
        faq: [
          { q: 'Does it work in a video call?', a: 'Yes. Share the big-screen window (or your whole screen) in the call; people answer from their phones or another browser tab at 1234tools.com/join.' },
          { q: 'Are the answers anonymous?', a: 'Nicknames are used for joining. Votes, ratings, word clouds and typed answers are shown without names; only the quiz leaderboard shows nicknames.' }
        ]
      },
      {
        slug: 'quiz-night-with-phones',
        title: 'Quiz Night with Phones',
        description: 'Host a quiz night on the TV: everyone answers on their own phone, faster right answers score more, and a leaderboard after each round ends on a podium. Free, no app.',
        lede: 'Two rounds of timed questions on the big screen, a leaderboard after each, and a podium for the winners.',
        preset: { key: 'quiznight', deck: QUIZ_NIGHT_DECK },
        about: [
          'This page starts with a quiz-night deck: two rounds of timed questions, each followed by a leaderboard; after the last question the winner is announced on a podium. Answers are revealed as soon as the time runs out or everyone has answered.',
          'Players join at 1234tools.com/join with the code on the TV. After each question the TV shows the top 5 and every phone shows its own points, answering time, total and place; equal points go to the faster player.'
        ],
        faq: [
          { q: 'How do points work?', a: 'A right answer scores between 1000 (straight away) and 500 (at the buzzer); a wrong answer scores 0. The leaderboard adds up every quiz question before it.' },
          { q: 'Can teams play?', a: 'Yes: one phone per team, with the team name as the nickname.' }
        ]
      }
    ]
  };
  const SPEC = window.ROOM_TOOLS['live-presentation'];

  /* ---------- the rules (pure; build/tests/live/live-presentation.js checks them) ---------- */

  const TYPES = ['mc', 'quiz', 'oe', 'wc', 'rt', 'qa', 'lb', 'info'];
  const MAXQ = 200, MAXO = 10, MAXOL = 80, MAXS = 50, MAXB = 400, OEL = 200;
  const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
  const ints = (a, n) => Array.from(new Set((Array.isArray(a) ? a : []).filter((i) => Number.isInteger(i) && i >= 0 && i < n))).sort((x, y) => x - y);
  const clamp = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : d);

  /** Answers typed one per line: trimmed, blanks and repeats (ignoring case) dropped, at most 10 of 80 characters. */
  function parseOptions(text) {
    const seen = new Set(), out = [];
    for (const line of (Array.isArray(text) ? text : String(text || '').split(/\r?\n/))) {
      const s = clip(line, MAXOL);
      if (!s || seen.has(s.toLowerCase())) continue;
      seen.add(s.toLowerCase()); out.push(s);
      if (out.length === MAXO) break;
    }
    return out;
  }
  let sidSeq = 0;
  const newSlideId = () => 's' + Date.now().toString(36) + (sidSeq++).toString(36) + Math.floor(Math.random() * 1296).toString(36);
  /** One slide made safe: a known type, every field within its limits, defaults filled in. */
  function cleanSlide(x) {
    if (!x || typeof x !== 'object' || TYPES.indexOf(x.t) < 0) return null;
    const s = { id: typeof x.id === 'string' && /^[a-z0-9]{1,24}$/.test(x.id) ? x.id : newSlideId(), t: x.t, q: clip(x.q, MAXQ) };
    if (s.t === 'mc' || s.t === 'quiz') {
      s.o = parseOptions(x.o);
      while (s.o.length < 2) s.o.push(s.o.length ? 'No' : 'Yes');
      s.a = ints(x.a, s.o.length);
      if (s.t === 'quiz') { s.a = [s.a.length ? s.a[0] : 0]; s.secs = clamp(x.secs, 5, 120, 20); }
      else { s.m = clamp(x.m, 1, s.o.length, 1); s.ch = x.ch !== false; }
      s.hide = x.hide !== false;
    } else if (s.t === 'oe') { s.ch = x.ch !== false; s.hide = !!x.hide; }
    else if (s.t === 'wc') { s.n = clamp(x.n, 1, 3, 1); s.hide = !!x.hide; }
    else if (s.t === 'rt') { s.s = ['stars', 'ten', 'slider'].indexOf(x.s) >= 0 ? x.s : 'stars'; s.lo = clip(x.lo, 30); s.hi = clip(x.hi, 30); s.hide = !!x.hide; }
    else if (s.t === 'qa') { s.up = x.up !== false; s.ap = !!x.ap; }
    else if (s.t === 'info') s.body = String(x.body == null ? '' : x.body).slice(0, MAXB);
    if (s.t === 'lb' && !s.q) s.q = 'Leaderboard';
    return s;
  }
  /** A deck from a file or storage: {title, slides} with 1-50 clean slides and unique ids, or null. */
  function cleanDeck(x) {
    const list = Array.isArray(x) ? x : x && Array.isArray(x.slides) ? x.slides : null;
    if (!list) return null;
    const seen = new Set(), slides = [];
    for (const raw of list) {
      const s = cleanSlide(raw);
      if (!s) continue;
      if (seen.has(s.id)) s.id = newSlideId();
      seen.add(s.id); slides.push(s);
      if (slides.length === MAXS) break;
    }
    if (!slides.length) return null;
    return { title: clip(x && x.title, 80) || 'My deck', slides };
  }
  /** Quiz points: 1000 for an instant right answer, falling evenly to 500 at the deadline; 0 when wrong. */
  function points(right, elapsedMs, limitMs) {
    if (!right) return 0;
    const f = Math.max(0, Math.min(1, (elapsedMs || 0) / Math.max(1, limitMs)));
    return Math.round(1000 - 500 * f);
  }
  /**
   * One phone's multiple-choice answer into votes (Map id → index, or a
   * sorted array of indexes when up to m may be chosen). True when it counts:
   * voting open, a valid choice, and a first answer or an allowed change.
   */
  function mcVote(votes, id, v, card) {
    if (!card || card.cl) return false;
    const n = card.o.length, m = Math.max(1, card.m || 1);
    let val;
    if (m > 1) {
      if (!Array.isArray(v) || !v.length || v.length > m) return false;
      val = ints(v, n);
      if (val.length !== v.length) return false;
    } else {
      if (!Number.isInteger(v) || v < 0 || v >= n) return false;
      val = v;
    }
    if (votes.has(id) && (!card.ch || JSON.stringify(votes.get(id)) === JSON.stringify(val))) return false;
    votes.set(id, val);
    return true;
  }
  /** Votes per option (a multi-choice answer counts once for each option it picked). */
  function tally(votes, n) {
    const c = new Array(n).fill(0);
    votes.forEach((v) => { (Array.isArray(v) ? v : [v]).forEach((i) => { if (i >= 0 && i < n) c[i]++; }); });
    return c;
  }
  /** Whole percentages that add up to 100 (largest remainder), or all 0. */
  function percents(counts) {
    const total = counts.reduce((a, b) => a + b, 0);
    if (!total) return counts.map(() => 0);
    const raw = counts.map((c) => c * 100 / total);
    const out = raw.map(Math.floor);
    let left = 100 - out.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
    return out;
  }
  /** Percent of the people who answered (multi-choice: these need not add up to 100). */
  function share(counts, people, multi) {
    return multi ? counts.map((c) => (people ? Math.round(c * 100 / people) : 0)) : percents(counts);
  }
  /**
   * Standings: rows [{id, nick, p, tm, ct, r}] by points, most first; equal
   * points go to the lower total time of correct answers (ct, ms), then the
   * nickname. tm is the total time of every answer. r is the competition
   * rank (1, 2, 2, 4): shared only when points and correct time are equal.
   */
  function standings(totals) {
    const rows = [];
    totals.forEach((x, id) => rows.push({ id, nick: x.nick || '', p: x.p || 0, tm: x.tm || 0, ct: x.ct || 0 }));
    rows.sort((a, b) => b.p - a.p || a.ct - b.ct || a.nick.localeCompare(b.nick) || (a.id < b.id ? -1 : 1));
    rows.forEach((x, i) => { const y = rows[i - 1]; x.r = y && y.p === x.p && y.ct === x.ct ? y.r : i + 1; });
    return rows;
  }
  /** Milliseconds as seconds with one decimal, as the screens show them. */
  const secs = (ms) => (Math.round((ms || 0) / 100) / 10).toFixed(1);
  SPEC.SAMPLE = SAMPLE;

  if (typeof document === 'undefined') return;
  const K = window.GameKit, L = window.LiveKit;
  const SLUG = 'live-presentation';
  const LETTERS = 'ABCDEFGHIJ';
  const STEP_MS = 4000; /* the answer stays this long before the top 5 or the winner appear */
  /* the other live tools whose counting and big screen these slides reuse, fetched when needed */
  const LIB = { wc: ['word-cloud', '/engine/room-word-cloud.js'], rt: ['rating-scale', '/engine/room-rating-scale.js'], qa: ['audience-qa', '/engine/room-audience-qa.js'] };
  const lib = (t) => (LIB[t] && window.ROOM_TOOLS[LIB[t][0]]) || null;
  const need = (types) => Promise.all(Array.from(new Set(types)).filter((t) => LIB[t] && !(lib(t) && lib(t).render)).map((t) => L.loadScript(LIB[t][1]).catch(() => null)));

  const STR = {
    types: { mc: 'Multiple choice', quiz: 'Quiz question', oe: 'Open answers', wc: 'Word cloud', rt: 'Rating scale', qa: 'Q&A', lb: 'Leaderboard', info: 'Heading / content' },
    edit: 'Edit slides', present: 'Present', slides: 'Your slides', add: 'Add', addLabel: 'Add a slide',
    up: 'Move up', down: 'Move down', dup: 'Duplicate', del: 'Delete', delSure: 'Press again to delete',
    type: 'Slide type', q: 'Question', qInfo: 'Heading', body: 'Text under the heading', opts: 'Answers, one per line (2 to 10)',
    correct: 'Correct answer(s) — tick none for an opinion question', correctOne: 'The correct answer',
    multi: 'Let people choose more than one', max: 'At most', ch: 'Phones may change their answer', hide: 'Hide results until I reveal',
    secs: 'Seconds to answer', words: 'Words per phone', scale: 'Scale', stars: '1–5 stars', ten: '0–10', slider: 'Slider 0–10',
    lo: 'Low end label', hi: 'High end label', upv: 'Let people upvote questions', ap: 'Check questions before they show',
    deck: 'Deck', save: 'Save deck file', open: 'Open deck file', sample: 'Start again from the sample', sampleSure: 'Press again: this replaces your deck',
    badFile: 'That file is not a deck from this tool.', opened: 'Deck opened: {n} slides.', full: 'A deck holds up to 50 slides.',
    prev: '←  Previous', next: 'Next  →', reveal: 'Reveal results  (R)', hideR: 'Hide results  (H)', close: 'Close voting  (C)', reopen: 'Reopen voting  (C)',
    clear: 'Clear answers', export: 'Export CSV', of: 'Slide {i} of {n}', answered: '{a} of {n} answered', answeredN: '{a} answered',
    hiddenNote: 'Results are hidden from the big screen and phones. Press R to reveal.', closed: 'Voting closed', timeLeft: '{s} s left', timeUp: 'Time’s up',
    noResp: 'No answers yet.', hideOne: 'Hide', showOne: 'Show', approve: 'Approve', answeredQ: 'Answered', undo: 'Not answered',
    waiting: 'waiting', lbNone: 'No quiz answers yet.', pts: '{p} pts', jump: 'All slides', queued: 'Not live yet: press “Start a live session” and the phones will get this slide.',
    stageAnswered: '{a} answered', stageResp: '{n} answers so far', look: 'Look at the screen', untitled: '(no question yet)',
    questions: '{a} questions', top5: 'Top 5', winnerQ: 'And the winner is…', winner: 'Winner: {n}', time: '{s} s',
    stepBoard: 'The big screen shows the top 5. Press Next to go on.', stepWin: 'The big screen announces the winner. Press Next to go on.', stepWinEnd: 'The big screen announces the winner. Press Finish for the finale.',
    finish: 'Finish  ✓', theEnd: 'The end', thanks: 'Thank you for taking part!', congrats: 'Congratulations, {n}!', finalBoard: 'Final standings',
    endSession: 'End the session', doneNote: 'The big screen and the phones show the finale. Press ← to go back, or End the session when everyone has seen it.'
  };
  const fmt = (s, a) => s.replace(/\{(\w+)\}/g, (m, k) => (a && a[k] !== undefined ? a[k] : m));
  const mask = (t) => (window.RoomWords ? window.RoomWords.mask(t) : t);
  /* Maps and Sets survive the save made for Reopen */
  const pack = (o) => JSON.stringify(o, (k, v) => (v instanceof Map ? { $m: Array.from(v) } : v instanceof Set ? { $s: Array.from(v) } : v));
  const unpack = (s) => JSON.parse(s, (k, v) => (v && typeof v === 'object' && Array.isArray(v.$m) ? new Map(v.$m) : v && typeof v === 'object' && Array.isArray(v.$s) ? new Set(v.$s) : v));
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  /** The merge patch that turns a into b (keys gone from b become null). */
  function diff(a, b) {
    const out = {};
    let any = false;
    for (const k in b) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) continue;
      if (isObj(a[k]) && isObj(b[k])) { const d = diff(a[k], b[k]); if (d) { out[k] = d; any = true; } }
      else if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) { out[k] = b[k]; any = true; }
    }
    for (const k in a) if (Object.prototype.hasOwnProperty.call(a, k) && !Object.prototype.hasOwnProperty.call(b, k)) { out[k] = null; any = true; }
    return any ? out : null;
  }
  SPEC.maths = { parseOptions, cleanSlide, cleanDeck, points, mcVote, tally, percents, share, standings, secs, diff, pack, unpack };

  /* ---------- the big screen ---------- */

  function bars(main, s, showing) {
    const list = K.el('ol', 'st-bars deck-bars' + (showing ? '' : ' is-hidden') + (showing && s.a && s.a.length ? ' has-key' : ''));
    list.style.setProperty('--rows', String(s.o.length));
    const most = showing ? Math.max(1, ...s.c) : 1;
    const pc = showing ? share(s.c, s.n, s.m > 1) : null;
    s.o.forEach((o, i) => {
      const right = showing && s.a && s.a.indexOf(i) >= 0;
      const li = K.el('li', right ? 'is-right' : '');
      li.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
      li.appendChild(K.el('b', null, right ? '✓' : LETTERS[i]));
      li.appendChild(K.el('span', 'st-bar-label', o));
      const track = K.el('span', 'st-bar'); const fill = K.el('i');
      fill.style.width = showing ? (s.c[i] * 100 / most).toFixed(1) + '%' : '0';
      track.appendChild(fill); li.appendChild(track);
      li.appendChild(K.el('strong', null, showing ? pc[i] + '% · ' + s.c[i] : ''));
      list.appendChild(li);
    });
    main.appendChild(list);
  }
  function clockText(end) {
    const left = Math.ceil((end - Date.now()) / 1000);
    return left > 0 ? fmt(STR.timeLeft, { s: left }) : STR.timeUp;
  }
  const firsts = L.firsts;
  const podium = (main, rows, win) => L.podium(main, rows, win, (x) => fmt(STR.pts, { p: x.p }) + ' · ' + fmt(STR.time, { s: x.s }));
  const confetti = L.confetti;

  function renderStage(body, s) {
    if (!body._deckTick) {
      /* one timer per screen keeps the quiz countdown moving between updates */
      body._deckTick = setInterval(() => { const c = body.querySelector('[data-end]'); if (c) c.textContent = clockText(Number(c.getAttribute('data-end'))); }, 250);
    }
    body._deckLast = s;
    const t = s.t;
    if (LIB[t] && s.d) {
      const R = lib(t), m0 = L.stageFrame(body, s.d.join);
      m0._deckKey = null;
      if (R && R.render) { R.render(body, s.d); return; }
      need([t]).then(() => { if (body._deckLast === s) renderStage(body, s); });
      m0.textContent = '';
      m0.appendChild(K.el('h1', 'st-title', s.q || ''));
      return;
    }
    const main = L.stageFrame(body, s.join);
    const key = JSON.stringify(Object.assign({}, s, { join: null })) + body.clientWidth + 'x' + body.clientHeight;
    if (main._deckKey === key && main.firstChild) return;
    main._deckKey = key;
    main.textContent = '';
    if (!t) { main.appendChild(K.el('p', 'game-stage-wait', L.STR.stageWait)); return; }
    if (t === 'end') {
      /* the finale after the last slide: the winner (if there was a quiz) and thanks */
      const box = K.el('div', 'deck-end');
      if (s.rows.length) {
        box.appendChild(K.el('p', 'deck-end-kicker', STR.winnerQ));
        podium(box, s.rows, true);
        box.appendChild(K.el('p', 'deck-winner is-win', fmt(STR.congrats, { n: firsts(s.rows) })));
        box.appendChild(K.el('p', 'deck-end-thanks is-late', STR.thanks));
      } else {
        box.appendChild(K.el('h1', 'deck-end-title', STR.thanks));
        if (s.q) box.appendChild(K.el('p', 'deck-end-thanks', s.q));
      }
      main.appendChild(box);
      confetti(main, s.rows.length ? 3.4 : 0.2);
      return;
    }
    if (t === 'info') {
      const box = K.el('div', 'deck-info');
      box.appendChild(K.el('h1', 'deck-info-title', s.q));
      String(s.body || '').split(/\n+/).filter(Boolean).forEach((p) => box.appendChild(K.el('p', null, p)));
      main.appendChild(box);
      return;
    }
    main.appendChild(K.el('h1', 'st-title', s.q || ''));
    if (t === 'mc' || t === 'quiz') {
      const showing = !!s.c;
      bars(main, s, showing);
      const foot = K.el('p', 'st-foot');
      if (t === 'quiz' && s.end && !showing && !s.cl) {
        const c = K.el('strong', 'deck-clock', clockText(s.end));
        c.setAttribute('data-end', String(s.end));
        foot.appendChild(c);
        foot.appendChild(document.createTextNode(' · '));
      }
      foot.appendChild(document.createTextNode((showing ? fmt(STR.answeredN, { a: s.n }) : fmt(STR.stageAnswered, { a: s.n })) + (s.cl ? ' · ' + (t === 'quiz' ? STR.timeUp : STR.closed) : '')));
      main.appendChild(foot);
    } else if (t === 'oe' || LIB[t]) {
      if (!s.r) main.appendChild(K.el('p', 'st-big-n', fmt(STR.stageResp, { n: s.n })));
      else {
        const wall = K.el('ul', 'deck-wall');
        s.r.forEach((x, i) => { const li = K.el('li', null, x); li.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')'); wall.appendChild(li); });
        main.appendChild(wall);
      }
      if (s.cl) main.appendChild(K.el('p', 'st-foot', STR.closed));
    } else if (t === 'lb') {
      if (!s.rows.length) { main.appendChild(K.el('p', 'st-big-n', STR.lbNone)); return; }
      let rows = s.rows;
      if (s.fin) {
        podium(main, rows, s.win);
        main.appendChild(K.el('p', 'deck-winner' + (s.win ? ' is-win' : ''), fmt(STR.winner, { n: firsts(rows) })));
        confetti(main, s.win ? 3.4 : 0.6);
        rows = rows.slice(3);
      }
      L.lbList(main, rows, s.fin, { pts: (p) => fmt(STR.pts, { p }), time: (x) => fmt(STR.time, { s: x }) });
    }
  }

  /* ---------- the presenter's page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const preset = K.preset(root);
    const pkey = preset.key && /^[a-z0-9-]{1,20}$/.test(preset.key) ? preset.key : '';
    const store = K.store(SLUG + (pkey ? '-' + pkey : ''), 1);
    const saved = store.get(null);
    let deck = (saved && cleanDeck(saved.deck)) || cleanDeck(preset.deck || SAMPLE);
    let sel = saved && Number.isInteger(saved.sel) ? Math.min(saved.sel, deck.slides.length - 1) : 0;
    let mode = 'edit', pos = 0, started = false, done = false; /* done: the finale after the last slide */
    let R = {};                 /* slide id → its results in this session */
    let quizTimer = 0, saveT = 0;

    const cols = K.el('div', 'game-cols deck-cols');
    const left = K.el('div', 'deck-left');
    const modeRow = K.el('div', 'game-seg deck-mode');
    const editB = K.button(STR.edit, null, () => setMode('edit'));
    const presB = K.button(STR.present, null, () => setMode('present'));
    modeRow.appendChild(editB); modeRow.appendChild(presB);
    left.appendChild(modeRow);

    /* ----- the editor ----- */
    const ed = K.el('section', 'game-panel deck-edit');
    ed.appendChild(K.el('h2', null, STR.slides));
    const list = K.el('ol', 'deck-list');
    ed.appendChild(list);
    const addRow = K.el('div', 'game-row deck-add');
    const addSel = K.el('select');
    addSel.setAttribute('aria-label', STR.addLabel);
    TYPES.forEach((t) => { const o = K.el('option', null, STR.types[t]); o.value = t; addSel.appendChild(o); });
    addRow.appendChild(K.field(STR.addLabel, addSel).wrap);
    addRow.appendChild(K.button(STR.add, 'btn-primary', () => addSlide(addSel.value)));
    ed.appendChild(addRow);
    const form = K.el('div', 'deck-form');
    ed.appendChild(form);
    const edMsg = K.el('p', 'game-msg'); edMsg.setAttribute('role', 'status');
    ed.appendChild(edMsg);
    const deckRow = K.el('div', 'game-row deck-files');
    const fileIn = K.el('input'); fileIn.type = 'file'; fileIn.accept = '.json,application/json'; fileIn.hidden = true;
    let sampleArm = 0;
    const sampleB = K.button(STR.sample, 'btn-ghost', () => {
      if (Date.now() - sampleArm > 4000) { sampleArm = Date.now(); sampleB.textContent = STR.sampleSure; setTimeout(() => { sampleB.textContent = STR.sample; }, 4100); return; }
      sampleArm = 0; sampleB.textContent = STR.sample;
      deck = cleanDeck(preset.deck || SAMPLE); sel = 0; R = {}; changedDeck(); drawForm();
    });
    deckRow.appendChild(K.button(STR.save, 'btn-ghost', saveDeckFile));
    deckRow.appendChild(K.button(STR.open, 'btn-ghost', () => fileIn.click()));
    deckRow.appendChild(sampleB);
    deckRow.appendChild(fileIn);
    ed.appendChild(K.el('h3', null, STR.deck));
    ed.appendChild(deckRow);
    left.appendChild(ed);

    /* ----- the remote ----- */
    const rem = K.el('section', 'game-panel deck-remote');
    rem.hidden = true;
    const where = K.el('p', 'deck-where');
    const remQ = K.el('h2', 'deck-remote-q');
    const count = K.el('p', 'deck-count'); count.setAttribute('aria-live', 'polite');
    const clock = K.el('p', 'deck-clock-line');
    const nav = K.el('div', 'game-row deck-nav');
    const prevB = K.button(STR.prev, 'btn-ghost game-big', () => prev());
    const nextB = K.button(STR.next, 'btn-primary game-big', () => next());
    const endB = K.button(STR.endSession, 'btn-primary game-big', () => kit.end());
    endB.hidden = true;
    nav.appendChild(prevB); nav.appendChild(nextB); nav.appendChild(endB);
    const acts = K.el('div', 'game-row');
    const revealB = K.button(STR.reveal, 'btn-ghost', () => reveal(true));
    const hideB = K.button(STR.hideR, 'btn-ghost', () => reveal(false));
    const closeB = K.button(STR.close, 'btn-ghost', toggleClose);
    const clearB = K.button(STR.clear, 'btn-ghost', clearSlide);
    [revealB, hideB, closeB, clearB].forEach((b) => acts.appendChild(b));
    const note = K.el('p', 'game-msg');
    const out = K.el('div', 'deck-out');
    const jump = K.el('details', 'live-history deck-jump');
    jump.appendChild(K.el('summary', null, STR.jump));
    const jumpL = K.el('ol', 'deck-jump-list');
    jump.appendChild(jumpL);
    const expRow = K.el('div', 'game-row');
    const expB = K.button(STR.export, 'btn-ghost', exportCsv);
    expRow.appendChild(expB);
    [where, remQ, count, clock, nav, acts, note, out, jump, expRow].forEach((x) => rem.appendChild(x));
    left.appendChild(rem);

    const right = K.el('div', 'live-right');
    const kit = L.session({
      slug: SLUG, title: 'Live Presentation',
      onMsg, onChange: publish, onJoin, onRestore: restore,
      onLeft: (p) => { if (p.k) forget(p.id); },
      onEnd: () => { drawRemote(); publish(); }
    });
    right.appendChild(kit.el);
    const tv = K.el('section', 'game-panel');
    tv.appendChild(K.el('h2', null, 'Big screen'));
    tv.appendChild(stage.bar());
    right.appendChild(tv);
    cols.appendChild(left); cols.appendChild(right);
    io.appendChild(cols);

    /* ----- the deck and its editor ----- */

    function persist() {
      clearTimeout(saveT);
      saveT = setTimeout(() => store.set({ deck, sel }), 250);
    }
    function changedDeck() {
      persist();
      drawList();
      pos = Math.min(pos, deck.slides.length - 1);
      if (started) { sync(); drawRemote(); drawJump(); publish(); }
    }
    const label = (s) => (s.q || STR.untitled);
    function drawList() {
      list.textContent = '';
      deck.slides.forEach((s, i) => {
        const li = K.el('li', 'deck-row' + (i === sel ? ' is-on' : ''));
        li.draggable = true;
        li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; li.classList.add('is-drag'); });
        li.addEventListener('dragend', () => li.classList.remove('is-drag'));
        li.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
        li.addEventListener('drop', (e) => { e.preventDefault(); const from = Number(e.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) move(from, i); });
        const pick = K.button('', 'deck-pick', () => { sel = i; persist(); drawList(); drawForm(); });
        pick.setAttribute('aria-current', String(i === sel));
        pick.appendChild(K.el('b', null, String(i + 1)));
        const words = K.el('span', 'deck-pick-text');
        words.appendChild(K.el('small', null, STR.types[s.t]));
        words.appendChild(K.el('span', null, label(s)));
        pick.appendChild(words);
        li.appendChild(pick);
        const tools = K.el('span', 'deck-row-tools');
        const upB = K.button('↑', 'btn-ghost', () => move(i, i - 1), STR.up); upB.setAttribute('aria-label', STR.up + ': ' + label(s)); upB.disabled = i === 0;
        const dnB = K.button('↓', 'btn-ghost', () => move(i, i + 1), STR.down); dnB.setAttribute('aria-label', STR.down + ': ' + label(s)); dnB.disabled = i === deck.slides.length - 1;
        const dupB = K.button('⧉', 'btn-ghost', () => duplicate(i), STR.dup); dupB.setAttribute('aria-label', STR.dup + ': ' + label(s));
        let arm = 0;
        const delB = K.button('✕', 'btn-ghost', () => {
          if (deck.slides.length < 2) return;
          if (Date.now() - arm > 4000) { arm = Date.now(); delB.title = STR.delSure; delB.textContent = '?'; edMsg.textContent = STR.delSure; setTimeout(() => { delB.textContent = '✕'; }, 4100); return; }
          deck.slides.splice(i, 1);
          sel = Math.min(sel, deck.slides.length - 1);
          edMsg.textContent = '';
          changedDeck(); drawForm();
        }, STR.del);
        delB.setAttribute('aria-label', STR.del + ': ' + label(s)); delB.disabled = deck.slides.length < 2;
        [upB, dnB, dupB, delB].forEach((b) => tools.appendChild(b));
        li.appendChild(tools);
        list.appendChild(li);
      });
      drawJump();
    }
    function move(from, to) {
      if (to < 0 || to >= deck.slides.length || from === to) return;
      const [s] = deck.slides.splice(from, 1);
      deck.slides.splice(to, 0, s);
      if (sel === from) sel = to; else if (from < sel && to >= sel) sel--; else if (from > sel && to <= sel) sel++;
      changedDeck();
    }
    function duplicate(i) {
      if (deck.slides.length >= MAXS) { edMsg.textContent = STR.full; return; }
      const c = cleanSlide(Object.assign({}, deck.slides[i], { id: newSlideId() }));
      deck.slides.splice(i + 1, 0, c);
      sel = i + 1;
      changedDeck(); drawForm();
    }
    function addSlide(t) {
      if (deck.slides.length >= MAXS) { edMsg.textContent = STR.full; return; }
      const base = { t, q: '' };
      if (t === 'mc') Object.assign(base, { o: ['Yes', 'No', 'Not sure'], a: [] });
      if (t === 'quiz') Object.assign(base, { o: ['Answer A', 'Answer B', 'Answer C', 'Answer D'], a: [0] });
      deck.slides.splice(sel + 1, 0, cleanSlide(base));
      sel = sel + 1;
      changedDeck(); drawForm();
      const f = form.querySelector('input, textarea');
      if (f) f.focus();
    }
    /** The form for the selected slide; every change is saved at once. */
    function drawForm() {
      form.textContent = '';
      const s = deck.slides[sel];
      if (!s) return;
      form.appendChild(K.el('h3', null, fmt(STR.of, { i: sel + 1, n: deck.slides.length }) + ' — ' + STR.types[s.t]));
      const typeSel = K.el('select');
      TYPES.forEach((t) => { const o = K.el('option', null, STR.types[t]); o.value = t; o.selected = t === s.t; typeSel.appendChild(o); });
      typeSel.addEventListener('change', () => {
        const keep = { id: s.id, t: typeSel.value, q: s.q, o: s.o, a: s.a };
        if (keep.t === 'quiz' && (!s.o || s.t !== 'mc')) { keep.o = ['Answer A', 'Answer B', 'Answer C', 'Answer D']; keep.a = [0]; }
        if (keep.t === 'mc' && !s.o) { keep.o = ['Yes', 'No', 'Not sure']; keep.a = []; }
        deck.slides[sel] = cleanSlide(keep);
        changedDeck(); drawForm();
      });
      form.appendChild(K.field(STR.type, typeSel).wrap);
      const qIn = K.el('input'); qIn.type = 'text'; qIn.maxLength = MAXQ; qIn.value = s.q;
      qIn.className = 'deck-q';
      qIn.addEventListener('input', () => { s.q = qIn.value.slice(0, MAXQ); refreshRow(); });
      qIn.addEventListener('change', () => { s.q = clip(qIn.value, MAXQ); if (s.t === 'lb' && !s.q) s.q = 'Leaderboard'; changedDeck(); });
      form.appendChild(K.field(s.t === 'info' || s.t === 'lb' ? STR.qInfo : STR.q, qIn).wrap);
      const check = (labelText, on, fn) => {
        const l = K.el('label', 'game-check'); const c = K.el('input'); c.type = 'checkbox'; c.checked = !!on;
        c.addEventListener('change', () => { fn(c.checked); changedDeck(); });
        l.appendChild(c); l.appendChild(document.createTextNode(labelText)); form.appendChild(l); return c;
      };
      if (s.t === 'mc' || s.t === 'quiz') {
        const oIn = K.el('textarea'); oIn.rows = 5; oIn.value = s.o.join('\n'); oIn.className = 'deck-opts';
        oIn.addEventListener('change', () => {
          const old = s.o, o = parseOptions(oIn.value);
          if (o.length < 2) { oIn.value = s.o.join('\n'); return; }
          /* the ticks follow their answers when lines move */
          s.a = ints(s.a.map((i) => o.indexOf(old[i])).filter((i) => i >= 0), o.length);
          if (s.t === 'quiz' && !s.a.length) s.a = [0];
          s.o = o;
          if (s.m) s.m = Math.min(s.m, o.length);
          changedDeck(); drawForm();
        });
        form.appendChild(K.field(STR.opts, oIn).wrap);
        const box = K.el('fieldset', 'deck-correct');
        box.appendChild(K.el('legend', null, s.t === 'quiz' ? STR.correctOne : STR.correct));
        s.o.forEach((o, i) => {
          const l = K.el('label', 'game-check'); const c = K.el('input');
          c.type = s.t === 'quiz' ? 'radio' : 'checkbox'; c.name = 'deck-correct-' + s.id; c.checked = s.a.indexOf(i) >= 0;
          c.addEventListener('change', () => {
            if (s.t === 'quiz') s.a = [i];
            else s.a = ints(c.checked ? s.a.concat([i]) : s.a.filter((x) => x !== i), s.o.length);
            changedDeck();
          });
          l.appendChild(c); l.appendChild(document.createTextNode(LETTERS[i] + '  ' + o)); box.appendChild(l);
        });
        form.appendChild(box);
        if (s.t === 'mc') {
          const maxIn = K.el('input'); maxIn.type = 'number'; maxIn.min = '2'; maxIn.max = String(s.o.length); maxIn.value = String(Math.max(2, s.m)); maxIn.className = 'deck-max';
          const maxF = K.field(STR.max, maxIn);
          maxF.wrap.hidden = s.m < 2;
          check(STR.multi, s.m > 1, (on) => { s.m = on ? Math.max(2, Math.min(s.o.length, Number(maxIn.value) || 2)) : 1; maxF.wrap.hidden = !on; });
          maxIn.addEventListener('change', () => { s.m = clamp(maxIn.value, 2, s.o.length, 2); maxIn.value = String(s.m); changedDeck(); });
          form.appendChild(maxF.wrap);
          check(STR.ch, s.ch, (on) => { s.ch = on; });
        } else {
          const secIn = K.el('input'); secIn.type = 'number'; secIn.min = '5'; secIn.max = '120'; secIn.value = String(s.secs); secIn.className = 'deck-secs';
          secIn.addEventListener('change', () => { s.secs = clamp(secIn.value, 5, 120, 20); secIn.value = String(s.secs); changedDeck(); });
          form.appendChild(K.field(STR.secs, secIn).wrap);
        }
        check(STR.hide, s.hide, (on) => { s.hide = on; });
      } else if (s.t === 'oe') {
        check(STR.ch, s.ch, (on) => { s.ch = on; });
        check(STR.hide, s.hide, (on) => { s.hide = on; });
      } else if (s.t === 'wc') {
        const n = K.el('select');
        [1, 2, 3].forEach((k) => { const o = K.el('option', null, String(k)); o.value = String(k); o.selected = s.n === k; n.appendChild(o); });
        n.addEventListener('change', () => { s.n = Number(n.value); changedDeck(); });
        form.appendChild(K.field(STR.words, n).wrap);
        check(STR.hide, s.hide, (on) => { s.hide = on; });
      } else if (s.t === 'rt') {
        const sc = K.el('select');
        ['stars', 'ten', 'slider'].forEach((k) => { const o = K.el('option', null, STR[k]); o.value = k; o.selected = s.s === k; sc.appendChild(o); });
        sc.addEventListener('change', () => { s.s = sc.value; changedDeck(); });
        form.appendChild(K.field(STR.scale, sc).wrap);
        [['lo', STR.lo], ['hi', STR.hi]].forEach(([k, lab]) => {
          const x = K.el('input'); x.type = 'text'; x.maxLength = 30; x.value = s[k];
          x.addEventListener('change', () => { s[k] = clip(x.value, 30); changedDeck(); });
          form.appendChild(K.field(lab, x).wrap);
        });
        check(STR.hide, s.hide, (on) => { s.hide = on; });
      } else if (s.t === 'qa') {
        check(STR.upv, s.up, (on) => { s.up = on; });
        check(STR.ap, s.ap, (on) => { s.ap = on; });
      } else if (s.t === 'info') {
        const b = K.el('textarea'); b.rows = 3; b.maxLength = MAXB; b.value = s.body;
        b.addEventListener('change', () => { s.body = b.value.slice(0, MAXB); changedDeck(); });
        form.appendChild(K.field(STR.body, b).wrap);
      }
      function refreshRow() {
        const row = list.children[sel];
        const sp = row && row.querySelector('.deck-pick-text span');
        if (sp) sp.textContent = label(s);
      }
    }
    function saveDeckFile() {
      const name = (clip(deck.title, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck') + '.json';
      K.download(new Blob([JSON.stringify({ app: '1234tools-live-presentation', v: 1, title: deck.title, slides: deck.slides }, null, 2)], { type: 'application/json' }), name);
    }
    function openDeckText(text) {
      let d = null;
      try { d = cleanDeck(JSON.parse(text)); } catch (e) { d = null; }
      if (!d) { edMsg.textContent = STR.badFile; return false; }
      deck = d; sel = 0;
      edMsg.textContent = fmt(STR.opened, { n: d.slides.length });
      changedDeck(); drawForm();
      return true;
    }
    fileIn.addEventListener('change', () => {
      const f = fileIn.files && fileIn.files[0];
      if (!f) return;
      f.text().then(openDeckText).catch(() => { edMsg.textContent = STR.badFile; });
      fileIn.value = '';
    });

    /* ----- presenting ----- */

    const slide = () => deck.slides[pos];
    const now = () => (kit.room && kit.room.serverNow ? kit.room.serverNow() : Date.now());
    /* a signature of what phones answer to: change it and the slide's answers start again */
    const sig = (s) => JSON.stringify([s.t, s.o || null, s.t === 'mc' ? s.m : 0, s.t === 'wc' ? s.n : 0, s.t === 'rt' ? s.s : 0]);
    function res(s) {
      let r = R[s.id];
      if (!r || r.sig !== sig(s)) {
        r = R[s.id] = { cid: L.newId(), sig: sig(s), cl: 0, shown: !s.hide, votes: new Map(), hid: new Set() };
        if (s.t === 'wc') r.st = { words: new Map(), per: new Map(), seq: 0 };
        if (s.t === 'qa') r.st = { list: new Map(), per: new Map(), seq: 0 };
        if (s.t === 'qa') r.shown = true;
      }
      return r;
    }
    function setMode(m) {
      mode = m === 'present' ? 'present' : 'edit';
      done = false;
      editB.setAttribute('aria-pressed', String(mode === 'edit'));
      presB.setAttribute('aria-pressed', String(mode === 'present'));
      ed.hidden = mode !== 'edit';
      rem.hidden = mode !== 'present';
      if (mode === 'present') {
        started = true;
        need(deck.slides.map((s) => s.t)).then(() => { sync(); drawRemote(); publish(); });
        go(mode === 'present' && pos < deck.slides.length ? pos : 0, true);
      } else { drawList(); drawForm(); tickClock(); }
      save();
    }
    function go(i, force) {
      if (done && i === pos) { setDone(false); return; }
      if (i < 0 || i >= deck.slides.length || (i === pos && !force && kit.card)) return;
      const was = deck.slides[pos];
      if (was && was.t === 'quiz' && i !== pos) { const r = R[was.id]; if (r && r.qz && !r.qz.done) finishQuiz(was, r); }
      clearTimeout(stepT);
      pos = i;
      done = false;
      const s = slide(), r = res(s);
      if (s.t === 'quiz' && !r.qz) startQuiz(s, r);
      if (s.t === 'quiz' && r.qz && !r.qz.done) armQuiz(s, r);
      sync();
      if (s.t === 'lb' || (s.t === 'quiz' && r.shown && r.qz && r.qz.done)) sendScores();
      drawRemote(); drawJump(); publish(); save();
      K.announce(root, fmt(STR.of, { i: pos + 1, n: deck.slides.length }) + ': ' + label(s));
    }
    function startQuiz(s, r) {
      const t0 = now();
      r.qz = { start: t0, e: t0 + s.secs * 1000, end: Date.now() + s.secs * 1000, done: false };
    }
    function armQuiz(s, r) {
      clearTimeout(quizTimer);
      const wait = r.qz.end - Date.now();
      if (wait <= 0) { finishQuiz(s, r); return; }
      quizTimer = setTimeout(() => { if (R[s.id] === r && !r.qz.done) { finishQuiz(s, r); sync(); drawRemote(); publish(); save(); } }, wait + 300);
    }
    function finishQuiz(s, r) {
      clearTimeout(quizTimer);
      r.qz.done = true;
      r.cl = 1;
      if (!s.hide) r.shown = true;
      if (slide() === s && r.shown) { sendScores(); armStep(s, r); }
    }

    /** What the phones are shown for slide s now. */
    function cardFor(s, r) {
      const c = { k: s.t, id: r.cid, q: s.q };
      if (s.t === 'mc') {
        c.o = s.o;
        if (s.m > 1) c.m = s.m;
        if (s.ch) c.ch = 1;
        if (r.shown) { const cnt = tally(r.votes, s.o.length); c.rv = { c: cnt, n: r.votes.size }; if (s.a.length) c.rv.a = s.a; }
      } else if (s.t === 'quiz') {
        c.k = 'dq'; c.o = s.o;
        if (r.qz) c.e = r.qz.e;
        if (r.shown && r.qz && r.qz.done) c.rv = { a: s.a, c: tally(quizVotes(r), s.o.length), n: r.votes.size };
      } else if (s.t === 'oe') { c.l = OEL; if (s.ch) c.ch = 1; }
      else if (s.t === 'wc') {
        c.n = s.n; c.l = 25;
        if (r.shown && lib('wc')) c.rv = lib('wc').maths.top(r.st, r.hid, true, 20).map((x) => [x.text, x.n]);
      } else if (s.t === 'rt') {
        c.s = s.s;
        if (s.lo) c.lo = s.lo;
        if (s.hi) c.hi = s.hi;
        if (r.shown && r.votes.size && lib('rt')) { const x = lib('rt').maths.summary(r.votes, s.s); c.rv = { a: (Math.round(x.mean * 10) / 10).toFixed(1), n: x.n, h: x.h }; }
      } else if (s.t === 'qa') {
        c.l = 280;
        if (s.up) c.up = 1;
        if (s.ap) c.ap = 1;
        c.qs = {};
        r.st.list.forEach((q) => { if (q.status === 'live') c.qs[q.qid] = { t: mask(q.t), v: q.votes.size, a: q.a ? 1 : 0 }; });
      } else if (s.t === 'info') c.k = 'look';
      if (r.cl && s.t !== 'lb' && s.t !== 'info') c.cl = 1;
      return c;
    }
    /** The finale on phones: the deck's title and, after a quiz, the winner. */
    function endCard() {
      const c = { k: 'end', id: 'end', q: deck.title };
      const w = firsts(finalBoard(3));
      if (w) c.w = w;
      return c;
    }
    const quizVotes = (r) => { const m = new Map(); r.votes.forEach((x, id) => m.set(id, x.v)); return m; };
    /** Send the phones what changed: a whole card for a new slide, else a small merge patch. */
    function sync() {
      const s = slide();
      if (!s) return;
      const c = done ? endCard() : cardFor(s, res(s));
      if (!kit.card || kit.card.id !== c.id) kit.setCard(c);
      else { const d = diff(kit.card, c); if (d) kit.patch(d); }
    }
    function reveal(on) {
      const s = slide(); if (!s || s.t === 'lb' || s.t === 'info' || s.t === 'qa') return;
      const r = res(s);
      if (on && s.t === 'quiz' && r.qz && !r.qz.done) finishQuiz(s, r);
      if (r.shown === on) return;
      r.shown = on;
      if (s.t === 'quiz') { if (on) { sendScores(); armStep(s, r); } else { clearTimeout(stepT); r.step = 'ans'; } }
      sync(); drawRemote(); publish(); save();
      K.announce(root, on ? 'Results revealed' : 'Results hidden');
    }
    function toggleClose() {
      const s = slide(); if (!s || s.t === 'lb' || s.t === 'info') return;
      const r = res(s);
      if (s.t === 'quiz') { if (r.qz && !r.qz.done) { finishQuiz(s, r); sync(); drawRemote(); publish(); save(); } return; }
      r.cl = r.cl ? 0 : 1;
      sync(); drawRemote(); publish(); save();
      K.announce(root, r.cl ? STR.closed : 'Voting open');
    }
    function clearSlide() {
      const s = slide(); if (!s || s.t === 'lb' || s.t === 'info') return;
      delete R[s.id];
      const r = res(s);
      if (s.t === 'quiz') { startQuiz(s, r); armQuiz(s, r); }
      sync(); drawRemote(); publish(); save();
    }
    function forget(id) {
      const s = slide(); if (!s) return;
      const r = R[s.id]; if (!r) return;
      if (s.t === 'wc' && lib('wc')) lib('wc').maths.removePhone(r.st, id);
      else if (s.t !== 'quiz') r.votes.delete(id);
      sync(); drawRemote(); publish(); save();
    }

    /* ----- answers ----- */

    function onMsg(m) {
      const s = slide(), v = m.v;
      if (!s || !v || typeof v !== 'object') return;
      const r = res(s);
      if (v.q !== r.cid) return;
      let ok = false;
      if (s.t === 'mc') ok = mcVote(r.votes, m.id, v.v, { o: s.o, m: s.m, ch: s.ch, cl: r.cl });
      else if (s.t === 'quiz') {
        const q = r.qz;
        if (q && !q.done && !r.votes.has(m.id) && Number.isInteger(v.v) && v.v >= 0 && v.v < s.o.length) {
          const at = typeof m.at === 'number' ? m.at : now();
          /* a little grace for an answer pressed in the last moment and still on its way */
          if (at <= q.e + 750) {
            r.votes.set(m.id, { v: v.v, pts: points(v.v === s.a[0], at - q.start, q.e - q.start), ms: Math.max(0, at - q.start), nick: kit.nick(m.id) });
            ok = true;
            if (kit.count && r.votes.size >= kit.count) finishQuiz(s, r);
          }
        }
      } else if (s.t === 'oe') {
        if (typeof v.v === 'string' && !r.cl && (!r.votes.has(m.id) || s.ch)) {
          const t = clip(v.v, OEL);
          if (t && (!r.votes.has(m.id) || r.votes.get(m.id).t !== t)) { r.votes.set(m.id, { t, at: m.at || Date.now() }); r.hid.delete(m.id); ok = true; }
        }
      } else if (s.t === 'wc' && lib('wc')) ok = !!lib('wc').maths.addWord(r.st, m.id, v.v, { n: s.n, l: 25, cl: r.cl });
      else if (s.t === 'rt' && lib('rt')) ok = lib('rt').maths.rate(r.votes, m.id, v.v, { s: s.s, cl: r.cl });
      else if (s.t === 'qa' && lib('qa')) {
        const M = lib('qa').maths, card = { cl: r.cl, l: 280, ap: s.ap ? 1 : 0, up: s.up ? 1 : 0 };
        if (typeof v.ask === 'string') ok = !!M.addQuestion(r.st, m.id, kit.nick(m.id), v.ask, card, m.at);
        else if (v.up !== undefined) ok = M.upvote(r.st, m.id, v.up, !!v.on, card);
      }
      if (!ok) return;
      sync(); drawRemote(); publish(); save();
    }

    /* ----- quiz scores ----- */

    /** Totals over every finished quiz slide up to index `upto`, for everyone who answered or is here now. */
    function totals(upto) {
      const t = new Map();
      kit.players.forEach((nick, id) => t.set(id, { nick: kit.nick(id), p: 0, tm: 0, ct: 0 }));
      deck.slides.slice(0, upto + 1).forEach((s) => {
        const r = R[s.id];
        if (s.t !== 'quiz' || !r || !r.qz || !r.qz.done) return;
        r.votes.forEach((x, id) => {
          const e = t.get(id) || { nick: x.nick, p: 0, tm: 0, ct: 0 };
          if (!e.nick) e.nick = x.nick;
          e.p += x.pts;
          e.tm += x.ms || 0;
          if (x.pts > 0) e.ct += x.ms || 0;
          t.set(id, e);
        });
      });
      return t;
    }
    /** Each phone's own points, total and place, to that phone alone. */
    function directFor(id) {
      const s = slide(); if (!s) return null;
      if (done) {
        /* the finale: each phone's final place over the whole quiz */
        const all = standings(totals(deck.slides.length - 1));
        const m = finalBoard(1).length ? all.find((x) => x.id === id) : null;
        return m ? { q: 'end', t: m.p, r: m.r, of: all.length, tm: m.tm, fin: 1 } : null;
      }
      const r = res(s);
      if (s.t === 'quiz' && !(r.shown && r.qz && r.qz.done)) return null;
      if (s.t !== 'quiz' && s.t !== 'lb') return null;
      const rows = standings(totals(pos));
      const me = rows.find((x) => x.id === id);
      if (!me) return null;
      const out = { q: r.cid, t: me.p, r: me.r, of: rows.length, tm: me.tm };
      if (s.t === 'quiz') {
        const a = r.votes.get(id);
        out.p = a ? a.pts : 0;
        if (a) out.ms = a.ms;
      }
      /* the end of the quiz: the winner reveal, or the last leaderboard */
      if ((s.t === 'quiz' && r.step === 'win') || (s.t === 'lb' && board(pos, 10).fin)) out.fin = 1;
      return out;
    }
    function sendScores() {
      if (!kit.room || !kit.live) return;
      kit.players.forEach((nick, id) => { const v = directFor(id); if (v) kit.room.to(id, v); });
    }
    function onJoin(p) {
      if (!kit.room || !kit.live) return;
      const v = directFor(p.id);
      if (v) kit.room.to(p.id, v);
    }
    /**
     * The leaderboard rows for the big screen after slide `upto`: the top
     * `limit`, each with its place before the last quiz question, so the
     * rows can move from there. fin: no leaderboard slide and no quiz
     * question comes later, so this is the final board (a podium).
     */
    function board(upto, limit) {
      const top = standings(totals(upto)).slice(0, limit);
      let last = -1;
      for (let i = upto; i >= 0; i--) { const s = deck.slides[i], r = R[s.id]; if (s.t === 'quiz' && r && r.qz && r.qz.done) { last = i; break; } }
      const before = last >= 0 ? standings(totals(last - 1)).filter((x) => x.p > 0) : [];
      const was = new Map(before.map((x, i) => [x.id, i]));
      const fin = !deck.slides.slice(upto + 1).some((s) => s.t === 'lb' || s.t === 'quiz');
      return { rows: top.map((x) => ({ n: x.nick || '—', p: x.p, r: x.r, s: secs(x.tm), w: was.has(x.id) ? was.get(x.id) : -1 })), fin };
    }
    const lastQuiz = (i) => !deck.slides.slice(i + 1).some((s) => s.t === 'quiz');
    /* after a quiz question's reveal: the answer, then by itself the top 5 (or, after the last question, the winner) */
    let stepT = 0;
    function setStep(s, r, step) {
      clearTimeout(stepT);
      if (r.step === step) return;
      r.step = step;
      if (step === 'win') sendScores();
      drawRemote(); publish(); save();
      K.announce(root, step === 'win' ? STR.winnerQ : step === 'board' ? STR.top5 : '');
    }
    function armStep(s, r) {
      clearTimeout(stepT);
      r.step = 'ans';
      stepT = setTimeout(() => { if (slide() === s && r.shown && r.step === 'ans') setStep(s, r, lastQuiz(pos) ? 'win' : 'board'); }, STEP_MS);
    }
    /** A revealed quiz answer waiting for its top 5 or winner step. */
    function stepping() {
      const s = slide(), r = s && R[s.id];
      return !!(s && s.t === 'quiz' && r && r.shown && r.qz && r.qz.done && (r.step || 'ans') === 'ans');
    }
    const atEnd = () => pos >= deck.slides.length - 1 && !stepping();
    function next() {
      if (done) return;
      const s = slide(), r = s && R[s.id];
      if (stepping()) { setStep(s, r, lastQuiz(pos) ? 'win' : 'board'); return; }
      if (atEnd()) { setDone(true); return; }
      go(pos + 1);
    }
    function prev() {
      if (done) { setDone(false); return; }
      const s = slide(), r = s && R[s.id];
      if (s && s.t === 'quiz' && r && r.step && r.step !== 'ans') { setStep(s, r, 'ans'); return; }
      go(pos - 1);
    }

    /** Finish: after the last slide the big screen and the phones show the finale; ← goes back. */
    function setDone(on) {
      const s = slide(), r = s && R[s.id];
      if (on && s && s.t === 'quiz' && r && r.qz && !r.qz.done) finishQuiz(s, r);
      clearTimeout(stepT);
      done = on;
      sync(); sendScores(); drawRemote(); drawJump(); publish(); save();
      K.announce(root, on ? STR.theEnd + ': ' + STR.thanks : fmt(STR.of, { i: pos + 1, n: deck.slides.length }) + ': ' + label(s));
    }
    /** The final standings over the whole deck (empty when no quiz was answered). */
    const finalBoard = (n) => board(deck.slides.length - 1, n).rows.filter((x) => x.p > 0);

    /* ----- what the presenter and the big screen see ----- */

    function answeredOf(s, r) {
      if (s.t === 'wc') return r.st.per.size;
      if (s.t === 'qa') return r.st.list.size;
      return r.votes.size;
    }
    function drawRemote() {
      const s = slide();
      if (!s || mode !== 'present') return;
      const r = res(s);
      nextB.hidden = done; endB.hidden = !done || !kit.live; acts.hidden = done;
      if (done) {
        where.textContent = STR.theEnd;
        remQ.textContent = STR.thanks;
        count.hidden = true;
        prevB.disabled = false;
        note.textContent = STR.doneNote;
        tickClock();
        out.textContent = '';
        const rows = finalBoard(10);
        if (rows.length) {
          const ol = K.el('ol', 'deck-lb-mini');
          rows.forEach((x) => ol.appendChild(K.el('li', null, x.r + '. ' + x.n + ' — ' + fmt(STR.pts, { p: x.p }) + ' · ' + fmt(STR.time, { s: x.s }))));
          out.appendChild(K.el('h3', null, STR.finalBoard));
          out.appendChild(ol);
        }
        return;
      }
      where.textContent = fmt(STR.of, { i: pos + 1, n: deck.slides.length }) + ' · ' + STR.types[s.t];
      remQ.textContent = label(s);
      const answers = s.t !== 'lb' && s.t !== 'info';
      const a = answers ? answeredOf(s, r) : 0;
      count.textContent = !answers ? '' : s.t === 'qa' ? fmt(STR.questions, { a }) : kit.live ? fmt(STR.answered, { a, n: kit.count }) : fmt(STR.answeredN, { a });
      count.hidden = !answers;
      tickClock();
      nextB.textContent = atEnd() ? STR.finish : STR.next;
      prevB.disabled = pos === 0 && !(s.t === 'quiz' && r.step && r.step !== 'ans');
      const canR = answers && s.t !== 'qa';
      revealB.hidden = hideB.hidden = !canR;
      revealB.disabled = r.shown;
      hideB.disabled = !r.shown;
      revealB.setAttribute('aria-pressed', String(!!r.shown));
      closeB.hidden = clearB.hidden = !answers;
      closeB.textContent = r.cl ? STR.reopen : STR.close;
      closeB.disabled = s.t === 'quiz' && (!r.qz || r.qz.done);
      note.textContent = !kit.live ? STR.queued : canR && !r.shown ? STR.hiddenNote : r.step === 'board' ? STR.stepBoard : r.step === 'win' ? (atEnd() ? STR.stepWinEnd : STR.stepWin) : r.cl ? STR.closed : '';
      drawOut(s, r);
    }
    let clockT = 0;
    function tickClock() {
      clearTimeout(clockT);
      const s = slide(), r = s && R[s.id];
      const on = mode === 'present' && s && s.t === 'quiz' && r && r.qz && !r.qz.done;
      clock.textContent = on ? clockText(r.qz.end) : '';
      if (on) clockT = setTimeout(tickClock, 250);
    }
    function drawJump() {
      if (mode !== 'present') return;
      jumpL.textContent = '';
      deck.slides.forEach((s, i) => {
        const li = K.el('li');
        const b = K.button((i + 1) + '. ' + label(s), 'btn-ghost deck-jump-b', () => go(i));
        if (i === pos) b.setAttribute('aria-current', 'true');
        li.appendChild(b); jumpL.appendChild(li);
      });
    }
    /** The presenter's own view of the answers: always visible here, hidden or not on the big screen. */
    function drawOut(s, r) {
      out.textContent = '';
      if (s.t === 'mc' || s.t === 'quiz') {
        const votes = s.t === 'quiz' ? quizVotes(r) : r.votes;
        const c = tally(votes, s.o.length), pc = share(c, votes.size, s.m > 1), most = Math.max(1, ...c);
        const ol = K.el('ol', 'live-bars');
        s.o.forEach((o, i) => {
          const li = K.el('li', s.a.indexOf(i) >= 0 ? 'is-right' : '');
          li.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
          li.appendChild(K.el('b', null, s.a.indexOf(i) >= 0 ? '✓' : LETTERS[i]));
          li.appendChild(K.el('span', 'live-bar-label', o));
          const tr = K.el('span', 'live-bar'); const f = K.el('i'); f.style.width = (c[i] * 100 / most).toFixed(1) + '%'; tr.appendChild(f);
          li.appendChild(tr);
          li.appendChild(K.el('strong', null, pc[i] + '% · ' + c[i]));
          ol.appendChild(li);
        });
        out.appendChild(ol);
        if (s.t === 'quiz' && r.qz && r.qz.done) {
          const b = board(pos, 5);
          const mini = K.el('ol', 'deck-lb-mini');
          b.rows.forEach((x) => mini.appendChild(K.el('li', null, x.r + '. ' + x.n + ' — ' + fmt(STR.pts, { p: x.p }) + ' · ' + fmt(STR.time, { s: x.s }))));
          out.appendChild(K.el('h3', null, STR.top5));
          out.appendChild(mini);
        }
      } else if (s.t === 'oe') {
        if (!r.votes.size) { out.appendChild(K.el('p', 'game-msg', STR.noResp)); return; }
        const ul = K.el('ul', 'live-words deck-resp');
        Array.from(r.votes.entries()).sort((x, y) => y[1].at - x[1].at).forEach(([id, x]) => {
          const li = K.el('li', r.hid.has(id) ? 'is-hidden' : '');
          li.appendChild(K.el('span', 'live-word', mask(x.t)));
          li.appendChild(K.el('span'));
          li.appendChild(K.button(r.hid.has(id) ? STR.showOne : STR.hideOne, 'btn-ghost', () => { if (r.hid.has(id)) r.hid.delete(id); else r.hid.add(id); sync(); drawRemote(); publish(); save(); }));
          ul.appendChild(li);
        });
        out.appendChild(ul);
      } else if (s.t === 'wc' && lib('wc')) {
        const words = lib('wc').maths.top(r.st, new Set(), true, 40);
        if (!words.length) { out.appendChild(K.el('p', 'game-msg', STR.noResp)); return; }
        const ul = K.el('ul', 'live-words');
        words.forEach((w) => {
          const li = K.el('li', r.hid.has(w.key) ? 'is-hidden' : '');
          li.appendChild(K.el('span', 'live-word', w.text));
          li.appendChild(K.el('strong', null, String(w.n)));
          li.appendChild(K.button(r.hid.has(w.key) ? STR.showOne : STR.hideOne, 'btn-ghost', () => { if (r.hid.has(w.key)) r.hid.delete(w.key); else r.hid.add(w.key); sync(); drawRemote(); publish(); save(); }));
          ul.appendChild(li);
        });
        out.appendChild(ul);
      } else if (s.t === 'rt' && lib('rt')) {
        const x = lib('rt').maths.summary(r.votes, s.s);
        out.appendChild(K.el('p', 'live-q', x.n ? 'Average ' + (Math.round(x.mean * 10) / 10).toFixed(1) + ' from ' + x.n + ' (spread ± ' + (Math.round(x.sd * 10) / 10).toFixed(1) + ')' : STR.noResp));
      } else if (s.t === 'qa' && lib('qa')) {
        const qs = lib('qa').maths.order(Array.from(r.st.list.values()).filter((q) => q.status !== 'gone'));
        if (!qs.length) { out.appendChild(K.el('p', 'game-msg', STR.noResp)); return; }
        const ol = K.el('ol', 'live-qa');
        qs.forEach((q) => {
          const li = K.el('li', q.a ? 'is-done' : '');
          const tx = K.el('span', 'live-qa-text');
          tx.appendChild(K.el('span', null, mask(q.t)));
          tx.appendChild(K.el('small', null, q.votes.size + ' votes' + (q.status === 'wait' ? ' · ' + STR.waiting : '')));
          li.appendChild(tx);
          const row = K.el('div', 'game-row');
          const act = (txt, fn) => row.appendChild(K.button(txt, 'btn-ghost', () => { fn(); sync(); drawRemote(); publish(); save(); }));
          if (q.status === 'wait') act(STR.approve, () => { q.status = 'live'; });
          else act(q.a ? STR.undo : STR.answeredQ, () => { q.a = q.a ? 0 : 1; });
          act(STR.hideOne, () => { q.status = 'gone'; });
          li.appendChild(row);
          ol.appendChild(li);
        });
        out.appendChild(ol);
      } else if (s.t === 'lb') {
        const b = board(pos, 10);
        if (!b.rows.length) { out.appendChild(K.el('p', 'game-msg', STR.lbNone)); return; }
        const ol = K.el('ol', 'deck-lb-mini');
        b.rows.forEach((x) => ol.appendChild(K.el('li', null, x.r + '. ' + x.n + ' — ' + fmt(STR.pts, { p: x.p }) + ' · ' + fmt(STR.time, { s: x.s }))));
        out.appendChild(ol);
      } else if (s.t === 'info' && s.body) out.appendChild(K.el('p', 'game-msg', s.body));
    }
    function publish() {
      const s = started ? slide() : null;
      if (!s) { stage.update({ join: kit.join, t: '' }); return; }
      if (done) { stage.update({ join: kit.join, t: 'end', q: deck.title, rows: finalBoard(5) }); return; }
      const r = res(s);
      const st = { join: kit.join, t: s.t, q: s.q, i: pos + 1, of: deck.slides.length };
      if (s.t === 'info') st.body = s.body;
      else if (s.t === 'quiz' && r.shown && r.qz && r.qz.done && (r.step === 'board' || r.step === 'win')) {
        const win = r.step === 'win';
        Object.assign(st, { t: 'lb', q: win ? STR.winnerQ : STR.top5, win: win ? 1 : 0 }, board(pos, 5));
        st.fin = win;
      } else if (s.t === 'mc' || s.t === 'quiz') {
        const votes = s.t === 'quiz' ? quizVotes(r) : r.votes;
        const done = s.t !== 'quiz' || (r.qz && r.qz.done);
        Object.assign(st, { o: s.o, m: s.m || 1, n: votes.size, cl: !!r.cl });
        if (r.shown && done) { st.c = tally(votes, s.o.length); st.a = s.a; }
        if (s.t === 'quiz' && r.qz && !r.qz.done) st.end = r.qz.end;
      } else if (s.t === 'oe') {
        st.n = r.votes.size; st.cl = !!r.cl;
        if (r.shown) st.r = Array.from(r.votes.entries()).filter(([id]) => !r.hid.has(id)).sort((x, y) => y[1].at - x[1].at).slice(0, 40).map(([, x]) => mask(x.t));
      } else if (s.t === 'wc') {
        if (r.shown) st.d = { join: kit.join, q: s.q, w: lib('wc') ? lib('wc').maths.top(r.st, r.hid, true, 60).map((x) => [x.text, x.n]) : [], total: r.st.words.size, people: r.st.per.size, cl: !!r.cl };
        else { st.n = r.st.per.size; st.cl = !!r.cl; }
      } else if (s.t === 'rt') {
        st.d = { join: kit.join, q: s.q, s: s.s, lo: s.lo, hi: s.hi, n: r.votes.size, cl: !!r.cl, r: r.shown && lib('rt') ? lib('rt').maths.summary(r.votes, s.s) : null };
      } else if (s.t === 'qa') {
        const live = lib('qa') ? lib('qa').maths.order(Array.from(r.st.list.values()).filter((q) => q.status === 'live')) : [];
        st.d = { join: kit.join, q: s.q, cl: !!r.cl, spot: null, list: live.slice(0, 12).map((q) => ({ t: mask(q.t), v: q.votes.size, a: q.a, nick: '' })) };
      } else if (s.t === 'lb') Object.assign(st, board(pos, 10));
      stage.update(st);
    }
    function save() {
      if (!kit.live) return;
      kit.save({ pos, mode, done, res: pack(R) });
    }
    function restore(sv) {
      if (!sv) return;
      try { R = unpack(sv.res || '{}') || {}; } catch (e) { R = {}; }
      pos = Math.min(Math.max(0, sv.pos | 0), deck.slides.length - 1);
      mode = 'edit';
      kit.card = undefined;
      setMode('present');
      if (sv.done) setDone(true);
    }

    /* ----- CSV ----- */

    function csvRows() {
      const rows = [['Slide', 'Type', 'Question', 'Answer or response', 'Count', 'Percent', 'Correct', 'Nickname', 'Points', 'Rank', 'Time (s)']];
      deck.slides.forEach((s, i) => {
        const r = R[s.id];
        const head = [i + 1, STR.types[s.t], s.q];
        if (!r) return;
        if (s.t === 'mc' || s.t === 'quiz') {
          const votes = s.t === 'quiz' ? quizVotes(r) : r.votes;
          const c = tally(votes, s.o.length), pc = share(c, votes.size, s.m > 1);
          s.o.forEach((o, k) => rows.push(head.concat([o, c[k], pc[k], s.a.indexOf(k) >= 0 ? 'yes' : '', '', '', '', ''])));
          /* every contestant's answer: right or wrong, how long it took, the points */
          if (s.t === 'quiz') Array.from(r.votes.values()).sort((x, y) => x.ms - y.ms).forEach((x) => rows.push([i + 1, 'Quiz answer', s.q, s.o[x.v], '', '', x.v === s.a[0] ? 'right' : 'wrong', x.nick, x.pts, '', secs(x.ms)]));
        } else if (s.t === 'oe') {
          Array.from(r.votes.values()).sort((x, y) => x.at - y.at).forEach((x) => rows.push(head.concat([x.t, '', '', '', '', '', '', ''])));
        } else if (s.t === 'wc' && lib('wc')) {
          lib('wc').maths.top(r.st, new Set(), false).forEach((w) => rows.push(head.concat([w.text, w.n, '', '', '', '', '', ''])));
        } else if (s.t === 'rt' && lib('rt')) {
          const x = lib('rt').maths.summary(r.votes, s.s), lo = s.s === 'stars' ? 1 : 0;
          x.h.forEach((c, k) => rows.push(head.concat([String(k + lo), c, '', '', '', '', '', ''])));
          if (x.n) rows.push(head.concat(['Average', (Math.round(x.mean * 100) / 100).toFixed(2), '', '', '', '', '', '']));
        } else if (s.t === 'qa') {
          r.st.list.forEach((q) => { if (q.status !== 'gone') rows.push(head.concat([q.t, q.votes.size, '', q.a ? 'answered' : '', '', '', '', ''])); });
        }
      });
      const last = deck.slides.length - 1;
      standings(totals(last)).filter((x) => x.p > 0 || deck.slides.some((s) => s.t === 'quiz' && R[s.id] && R[s.id].votes.has(x.id)))
        .forEach((x) => rows.push(['', 'Quiz total', '', '', '', '', '', x.nick, x.p, x.r, secs(x.tm)]));
      return rows;
    }
    function exportCsv() { L.downloadCsv(L.fileName(SLUG), csvRows()); }

    /* ----- keys: on this page and on the big-screen window ----- */

    function key(k, e) {
      if (mode !== 'present') return false;
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Spacebar') next();
      else if (k === 'ArrowLeft' || k === 'PageUp') prev();
      else if (k === 'r' || k === 'R') reveal(true);
      else if (k === 'h' || k === 'H') reveal(false);
      else if (k === 'c' || k === 'C') toggleClose();
      else return false;
      if (e) e.preventDefault();
      return true;
    }
    document.addEventListener('keydown', (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if ((e.key === ' ' || e.key === 'Enter') && t && (t.tagName === 'BUTTON' || t.tagName === 'SUMMARY')) return;
      key(e.key, e);
    });
    stage.onKey = (k) => key(k);

    setMode('edit');
    root._live = {
      kit, deck: () => deck, setDeck: (d) => openDeckText(JSON.stringify(d)), pos: () => pos, mode: () => mode, done: () => done, finish: () => setDone(true), R: () => R,
      go, next, prev, reveal, csvRows, board, msg: onMsg, step: () => { const s = slide(), r = s && R[s.id]; return r ? r.step || '' : ''; }, totals: (i) => standings(totals(i === undefined ? pos : i)), present: () => setMode('present'),
      deckJson: () => JSON.stringify({ app: '1234tools-live-presentation', v: 1, title: deck.title, slides: deck.slides })
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K || !L) return;
    let host = null;
    const stage = K.stage({ slug: SLUG, title: 'Live Presentation', render: renderStage, onCommand: (m) => { if (m && m.type === 'key' && host && host.onKey) host.onKey(m.key); } });
    if (stage.isStage) return;
    host = stage;
    mount(root, stage);
  });
})();
