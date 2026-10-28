/**
 * Claims on the live tools (/live/): Live Poll, Live Word Cloud, Audience Q&A, Live Rating Scale and Live
 * Presentation, and their 11 landing pages. Unlike the games these tools are NOT on-device: once a session
 * starts, the question and the answers pass through our server (live.1234tools.com) to the presenter's screen.
 * So the privacy claim here is the approved wording, word for word, in the engine, on every page and on the
 * phone page (/join/), and the "no accounts, no cookies, no analytics for participants" part is checked
 * against the phone page's and the phone engine's code. The copy's numbers (2 to 10 answers, one vote or
 * rating per phone, three words, 10 questions of 280 characters, 1000 down to 500 points, the top 5, the
 * 1,000-phone launch-trial limit) are run against the engines' own maths in Node. What needs a real session
 * (phones following slides, the finale with confetti) is proved by build/tests/live-rooms.js and listed here
 * as manual. The promotion desk's live stories and posts (build/promo/stories/live.js, templates-live.js)
 * say only what these checks bear out.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const APPROVED = 'Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.';
const TRIAL = 'During the launch trial a free session takes up to 1,000 phones';
const straight = (s) => String(s).replace(/[‘’]/g, "'");

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node';
  const src = (f) => fs.readFileSync(path.join(K.ROOT, f), 'utf8');
  /* an engine file run with a stub window, as build-live.js reads the specs */
  /* The pure maths sit above each engine's "if (typeof document === 'undefined') return": with a stub document
     the file runs on past it, the maths are set, and whatever needs the real page fails later and is ignored. */
  const load = (f, withDocument) => {
    const w = {};
    try { new Function('window', 'document', src('engine/' + f))(w, withDocument ? {} : undefined); } catch (e) { if (!withDocument) throw e; }
    return w;
  };
  const spec = (slug) => load('room-' + slug + '.js', true).ROOM_TOOLS[slug];
  const words = () => { const w = {}; new Function('window', src('engine/room-words.js'))(w); return w.RoomWords; };
  const L = (slug) => '/live/' + slug + '/';
  const landing = (tool, slug) => spec(tool).landings.find((x) => x.slug === slug);

  /* ---- the privacy line: the approved wording everywhere phones are used ---- */
  const pages = [['live-poll', ['live-poll-for-classroom', 'live-poll-for-meetings']], ['word-cloud', ['word-cloud-for-team-meeting', 'word-cloud-for-classroom']],
    ['audience-qa', ['qa-for-town-hall-meeting', 'wedding-questions-for-the-couple']], ['rating-scale', ['rate-a-session-live', 'classroom-understanding-check']],
    ['live-presentation', ['live-quiz-for-classroom', 'interactive-meeting-presentation', 'quiz-night-with-phones']]];
  for (const [tool, lands] of pages) {
    for (const slug of [tool].concat(lands)) {
      claim(L(slug), 'ui', APPROVED, 'the privacy line is the approved wording, word for word, in the engine and the phone page', N, async () => {
        const s = spec(tool);
        const join = straight(src('join/index.html'));
        const ok = s.privacy === APPROVED && join.indexOf(straight(APPROVED)) >= 0;
        return [ok, ok ? 'engine and /join/ carry the approved line' : 'engine: ' + (s.privacy === APPROVED) + ', join page: ' + (join.indexOf(straight(APPROVED)) >= 0)];
      });
    }
  }

  /* ---- no accounts, no cookies, no analytics for participants: the phone page and its code ---- */
  claim(L('live-poll-for-classroom'), 'faq', 'No account, no e-mail address and no cookies on their phones.', 'the phone page sets no cookies, loads no analytics and asks for no account', N, async () => {
    const html = src('join/index.html');
    const code = ['room-join.js', 'room-join-quiz.js', 'room-join-deck.js', 'room-join-hi.js', 'room-client.js'].map((f) => src('engine/' + f)).join('\n');
    const scripts = (html.match(/<script[^>]*src="[^"]*"/g) || []).join(' ');
    const bad = [/document\.cookie/.test(code) && 'document.cookie', /googletagmanager|google-analytics|gtag\(|clarity\.ms|consent/i.test(html + scripts + code) && 'analytics in the page',
      /type="(password|email)"|name="(email|password)"/i.test(html) && 'an e-mail or password field', /Set-Cookie/i.test(code) && 'Set-Cookie'].filter(Boolean);
    return [bad.length === 0, bad.length ? bad.join(', ') : 'no cookie code, no analytics, no e-mail or password field'];
  });
  claim(L('live-poll'), 'ui', 'A 6-digit code and a QR code appear.', 'the phone page takes six digits and a nickname of up to 24 characters', N, async () => {
    const html = src('join/index.html');
    const digits = (html.match(/aria-label="Digit [1-6]"/g) || []).length;
    return [digits === 6 && /id="nick" maxlength="24"/.test(html), digits + ' digit boxes, nickname maxlength 24'];
  });

  /* ---- the launch-trial phone limit ---- */
  const relay = process.env.RELAY_DIR || 'E:/projects/1234tools-relay';
  const haveRelay = fs.existsSync(path.join(relay, 'wrangler.jsonc'));
  for (const [tool] of pages) {
    if (!haveRelay) { manual(L(tool), 'faq', TRIAL, 'the relay repository (1234tools-relay) is not beside this checkout; check FREE_CAP in its wrangler.jsonc and MAX_CAP in src/lib.js by hand'); continue; }
    claim(L(tool), 'faq', TRIAL, 'the relay lets a free session take 1,000 phones (FREE_CAP) and its ceiling is 1000', N, async () => {
      const w = fs.readFileSync(path.join(relay, 'wrangler.jsonc'), 'utf8');
      const lib = fs.readFileSync(path.join(relay, 'src', 'lib.js'), 'utf8');
      const cap = /"FREE_CAP"\s*:\s*"(\d+)"/.exec(w);
      const max = /MAX_CAP:\s*(\d+)/.exec(lib);
      const inSpec = JSON.stringify(spec(tool)).indexOf(TRIAL) >= 0;
      return [!!cap && Number(cap[1]) === 1000 && !!max && Number(max[1]) >= 1000 && inSpec, 'FREE_CAP ' + (cap && cap[1]) + ', MAX_CAP ' + (max && max[1]) + ', wording in the spec: ' + inSpec];
    });
  }

  /* ---- Live Poll ---- */
  claim(L('live-poll'), 'works', 'Type your question and the answers, one answer per line (2 to 10).', 'answers are one per line, duplicates dropped, at most 10', N, async () => {
    const m = spec('live-poll').maths;
    const eleven = Array.from({ length: 12 }, (_, i) => 'Answer ' + (i + 1)).join('\n');
    const a = m.parseOptions(eleven), b = m.parseOptions('Yes\nyes\n\n No \nNo');
    const need = /Type at least two answers/.test(src('engine/room-live-poll.js'));
    return [a.length === 10 && b.length === 2 && need, 'twelve lines gave ' + a.length + '; "Yes, yes, No, No" gave ' + b.length + '; the two-answer rule: ' + need];
  });
  claim(L('live-poll'), 'tip', 'The percentages always add up to 100: they are rounded with the largest-remainder method.', 'the percentages add up to 100 for any counts', N, async () => {
    const m = spec('live-poll').maths;
    let bad = 0;
    for (let t = 0; t < 500; t++) { const c = Array.from({ length: 2 + (t % 9) }, () => Math.floor(Math.random() * 40)); const p = m.percents(c); const tot = c.reduce((x, y) => x + y, 0); if (tot && p.reduce((x, y) => x + y, 0) !== 100) bad++; }
    return [bad === 0 && m.percents([1, 1, 1]).reduce((x, y) => x + y, 0) === 100, bad + ' of 500 random sets did not sum to 100; [1,1,1] gives ' + m.percents([1, 1, 1])];
  });
  claim(L('live-poll'), 'tip', 'a second vote from it replaces the first', 'one vote per phone: a second vote replaces the first when changes are allowed', N, async () => {
    const m = spec('live-poll').maths;
    const card = { o: ['A', 'B', 'C'], ch: true };
    const votes = new Map();
    m.vote(votes, 'p1', 0, card); m.vote(votes, 'p1', 2, card); m.vote(votes, 'p2', 2, card);
    const t = m.tally(votes, 3);
    return [votes.size === 2 && t.join() === '0,0,2', 'two phones, tally ' + t.join()];
  });
  claim(L('live-poll'), 'tip', 'Untick “Phones may change their vote” for a vote that should be final as soon as it is cast.', 'with changes off the first vote stands', N, async () => {
    const m = spec('live-poll').maths;
    const card = { o: ['A', 'B'], ch: false };
    const votes = new Map();
    const first = m.vote(votes, 'p1', 0, card), second = m.vote(votes, 'p1', 1, card);
    return [first === true && second === false && votes.get('p1') === 0, 'first ' + first + ', second ' + second];
  });

  /* ---- Live Word Cloud ---- */
  claim(L('word-cloud'), 'tip', 'Words are grouped ignoring capitals and spaces', '“Team Work”, “teamwork” and “TEAMWORK” count as one word', N, async () => {
    const m = spec('word-cloud').maths;
    const st = m.fresh();
    ['Team Work', 'teamwork', 'TEAMWORK'].forEach((w, i) => m.addWord(st, 'p' + i, w, { n: 1 }));
    return [st.words.size === 1 && [...st.words.values()][0].n === 3, st.words.size + ' word(s), count ' + [...st.words.values()].map((e) => e.n)];
  });
  claim(L('word-cloud'), 'tip', 'Each phone counts once per word', 'a phone sending the same word again does not make it grow', N, async () => {
    const m = spec('word-cloud').maths;
    const st = m.fresh();
    const a = m.addWord(st, 'p1', 'sun', { n: 3 }), b = m.addWord(st, 'p1', 'SUN', { n: 3 });
    return [!!a && b === null && [...st.words.values()][0].n === 1, 'first ' + a + ', repeat ' + b];
  });
  claim(L('word-cloud'), 'faq', 'Each phone can send one, two or three words, as you choose.', 'a phone may send as many words as the card allows, never more than three', N, async () => {
    const m = spec('word-cloud').maths;
    const run = (n) => { const st = m.fresh(); let k = 0; for (const w of ['a', 'b', 'c', 'd', 'e']) if (m.addWord(st, 'p', w, { n })) k++; return k; };
    return [run(1) === 1 && run(2) === 2 && run(3) === 3 && run(9) === 3, 'allowance 1, 2, 3 and 9 accepted ' + [run(1), run(2), run(3), run(9)]];
  });
  claim(L('word-cloud'), 'tip', 'Rude words are masked to their first letter and stars, in English and Hindi or Hinglish, from a list kept in this page.', 'the mask keeps the first letter and stars, for English and Hinglish, with the list inside the page code', N, async () => {
    const R = words();
    const a = R.mask('shit'), b = R.mask('chutiya'), c = R.mask('sunshine');
    return [R.has('shit') && R.has('chutiya') && /^s\*+$/.test(a) && /^c\*+$/.test(b) && c === 'sunshine', a + ', ' + b + ', ' + c];
  });
  claim(L('word-cloud-for-classroom'), 'faq', 'Listed rude words are masked automatically, and Hide removes any word from the board and the phones at once.', 'a hidden word leaves the list the screen and the phones are drawn from', N, async () => {
    const m = spec('word-cloud').maths;
    const st = m.fresh();
    m.addWord(st, 'p1', 'volcano', { n: 3 }); m.addWord(st, 'p2', 'lava', { n: 3 });
    const all = m.top(st, new Set(), true, 20).map((x) => x.text);
    const hid = m.top(st, new Set([m.keyOf('lava')]), true, 20).map((x) => x.text);
    return [all.length === 2 && hid.length === 1 && hid[0] === 'volcano', 'all ' + all + '; with lava hidden ' + hid];
  });
  claim(L('word-cloud-for-classroom'), 'lede', 'Ask for three words each and the board shows the answer in a minute.', 'the classroom page presets three words per pupil', N, async () => {
    const p = landing('word-cloud', 'word-cloud-for-classroom').preset;
    return [p.n === 3, 'preset n=' + p.n];
  });
  claim(L('word-cloud-for-team-meeting'), 'lede', 'One word from everyone, on one screen, in a minute', 'the team page presets one word per person', N, async () => {
    const p = landing('word-cloud', 'word-cloud-for-team-meeting').preset;
    return [p.n === 1, 'preset n=' + p.n];
  });

  /* ---- Audience Q&A ---- */
  claim(L('audience-qa'), 'tip', 'Each phone can send up to 10 questions of up to 280 characters', 'the 11th question from a phone is refused and a long one is cut at 280', N, async () => {
    const m = spec('audience-qa').maths;
    const st = m.fresh();
    const card = { l: 280, ap: 0, up: 1 };
    let ok = 0;
    for (let i = 0; i < 11; i++) if (m.addQuestion(st, 'p1', 'Pat', 'Question ' + i, card, i)) ok++;
    const long = m.addQuestion(st, 'p2', 'Sam', 'x'.repeat(400), card, 99);
    return [ok === 10 && long && long.t.length === 280, ok + ' of 11 accepted; a 400-character question kept ' + (long && long.t.length)];
  });
  claim(L('audience-qa'), 'tip', 'One upvote per phone per question; tapping ▲ again takes it back.', 'a phone can upvote a question once and take it back', N, async () => {
    const m = spec('audience-qa').maths;
    const st = m.fresh();
    const card = { l: 280, ap: 0, up: 1 };
    const q = m.addQuestion(st, 'p1', 'Pat', 'Why?', card, 1);
    const a = m.upvote(st, 'p2', q.qid, true, card), b = m.upvote(st, 'p2', q.qid, true, card), size1 = q.votes.size, c = m.upvote(st, 'p2', q.qid, false, card);
    return [a && !b && size1 === 1 && c && q.votes.size === 0, 'on ' + a + ', again ' + b + ', off ' + c];
  });
  claim(L('audience-qa'), 'tip', 'The board puts unanswered questions first, then the most upvoted, then the oldest.', 'the board order is unanswered, then upvotes, then age', N, async () => {
    const m = spec('audience-qa').maths;
    const mk = (qid, a, v) => ({ qid: String(qid), a, votes: new Set(Array.from({ length: v }, (_, i) => 'v' + i)) });
    const got = m.order([mk(1, 1, 9), mk(2, 0, 1), mk(3, 0, 3), mk(4, 0, 3)]).map((q) => q.qid).join();
    return [got === '3,4,2,1', 'order ' + got];
  });
  claim(L('audience-qa'), 'tip', 'Approval is on by default: a question waits on your page and reaches the board and the phones only when you press Approve.', 'a question starts as waiting when approval is on', N, async () => {
    const m = spec('audience-qa').maths;
    const st = m.fresh();
    const q = m.addQuestion(st, 'p1', 'Pat', 'Hello?', { l: 280, ap: 1, up: 1 }, 1);
    const up = m.upvote(st, 'p2', q.qid, true, { l: 280, ap: 1, up: 1 });
    return [q.status === 'wait' && up === false && /ap: true/.test(src('engine/room-audience-qa.js')), 'status ' + q.status + ', upvote while waiting ' + up];
  });
  claim(L('qa-for-town-hall-meeting'), 'faq', 'this page hides nicknames on the big screen', 'the town-hall page presets nicknames off the big screen and approval on', N, async () => {
    const p = landing('audience-qa', 'qa-for-town-hall-meeting').preset;
    return [p.nicks === false && p.ap === true, JSON.stringify(p)];
  });
  claim(L('wedding-questions-for-the-couple'), 'lede', 'Let the guests ask and put the best questions on the screen.', 'the wedding page presets approval on, so only the questions you pick reach the screen', N, async () => {
    const p = landing('audience-qa', 'wedding-questions-for-the-couple').preset;
    return [p.ap === true, JSON.stringify(p)];
  });

  /* ---- Live Rating Scale ---- */
  claim(L('rating-scale'), 'tip', 'One rating per phone: rating again replaces the earlier one, so changing your mind never counts twice.', 'a second rating replaces the first', N, async () => {
    const m = spec('rating-scale').maths;
    const r = new Map();
    m.rate(r, 'p1', 2, { s: 'ten' }); m.rate(r, 'p1', 9, { s: 'ten' });
    return [r.size === 1 && r.get('p1') === 9, 'size ' + r.size + ', value ' + r.get('p1')];
  });
  claim(L('rating-scale'), 'tip', 'The spread is the standard deviation', 'the spread is the population standard deviation; a room split between 2 and 9 averages 5.5', N, async () => {
    const m = spec('rating-scale').maths;
    const r = new Map([['a', 2], ['b', 9]]);
    const s = m.summary(r, 'ten');
    return [Math.abs(s.mean - 5.5) < 1e-9 && Math.abs(s.sd - 3.5) < 1e-9 && s.h[2] === 1 && s.h[9] === 1, 'mean ' + s.mean + ', sd ' + s.sd + ', histogram at 2 and 9: ' + s.h[2] + ',' + s.h[9]];
  });
  claim(L('rating-scale'), 'faq', 'One to five stars, 0 to 10 as eleven buttons, or a 0 to 10 slider.', 'the three scales span 1–5, 0–10 and 0–10', N, async () => {
    const m = spec('rating-scale').maths;
    const a = m.range('stars'), b = m.range('ten'), c = m.range('slider');
    return [a.join() === '1,5' && b.join() === '0,10' && c.join() === '0,10', a + ' | ' + b + ' | ' + c];
  });
  claim(L('rate-a-session-live'), 'lede', 'five stars, one tap, and the average on the screen in seconds', 'the page presets the star scale', N, async () => {
    const p = landing('rating-scale', 'rate-a-session-live').preset;
    return [p.s === 'stars' && spec('rating-scale').maths.range('stars').join() === '1,5', JSON.stringify(p)];
  });
  claim(L('classroom-understanding-check'), 'lede', 'a 0 to 10 slider, answered privately, with the spread on the board', 'the page presets the 0–10 slider with results hidden until revealed; the summary holds totals, not who rated what', N, async () => {
    const p = landing('rating-scale', 'classroom-understanding-check').preset;
    const s = spec('rating-scale').maths.summary(new Map([['a', 3], ['b', 8]]), 'slider');
    return [p.s === 'slider' && p.hide === true && !('by' in s) && s.n === 2 && typeof s.sd === 'number', JSON.stringify(p) + '; summary keys ' + Object.keys(s)];
  });

  /* ---- Live Presentation ---- */
  claim(L('live-presentation'), 'tip', 'Quiz points: a right answer scores from 1000 (at once) down to 500 (at the last moment); a wrong answer or no answer scores 0.', 'points run 1000 to 500 evenly over the time limit; a wrong answer scores 0', N, async () => {
    const p = spec('live-presentation').maths.points;
    const v = [p(true, 0, 20000), p(true, 10000, 20000), p(true, 20000, 20000), p(true, 99999, 20000), p(false, 0, 20000)];
    return [v.join() === '1000,750,500,500,0', v.join()];
  });
  claim(L('live-presentation'), 'tip', 'Equal points go to the player whose right answers took less time in total.', 'equal points are ranked by total answering time', N, async () => {
    const m = spec('live-presentation').maths;
    const rows = m.standings(new Map([['a', { nick: 'Asha', p: 1800, ct: 9000 }], ['b', { nick: 'Ben', p: 1800, ct: 7000 }], ['c', { nick: 'Cy', p: 2000, ct: 15000 }]]));
    return [rows.map((x) => x.nick).join() === 'Cy,Ben,Asha', rows.map((x) => x.nick + ' ' + x.p + ' ' + x.ct).join('; ')];
  });
  claim(L('live-presentation'), 'tip', 'the big screen shows the top 5 by itself', 'the board shown after a quiz answer holds the top five', N, async () => {
    const code = src('engine/room-live-presentation.js');
    const calls = (code.match(/board\(pos, 5\)/g) || []).length;
    const m = spec('live-presentation').maths;
    const totals = new Map(Array.from({ length: 8 }, (_, i) => ['p' + i, { nick: 'N' + i, p: 1000 - i * 10, ct: i }]));
    return [calls >= 2 && m.standings(totals).length === 8, 'board(pos, 5) used ' + calls + ' times'];
  });
  claim(L('live-presentation'), 'tip', 'Save deck file keeps the deck in a small .json file', 'a deck survives being saved and loaded unchanged', N, async () => {
    const s = spec('live-presentation');
    const clean = s.maths.cleanDeck(s.SAMPLE);
    const again = s.maths.cleanDeck(JSON.parse(JSON.stringify(clean)));
    return [JSON.stringify(clean) === JSON.stringify(again) && clean.slides.length === s.SAMPLE.slides.length, clean.slides.length + ' slides, identical after a JSON round trip'];
  });
  claim(L('quiz-night-with-phones'), 'lede', 'Two rounds of timed questions on the big screen, a leaderboard after each, and a podium for the winners.', 'the quiz-night deck has timed questions and two leaderboards', N, async () => {
    const d = landing('live-presentation', 'quiz-night-with-phones').preset.deck;
    const q = d.slides.filter((x) => x.t === 'quiz'), lb = d.slides.filter((x) => x.t === 'lb');
    return [q.length >= 5 && q.every((x) => x.secs > 0) && lb.length === 2, q.length + ' quiz slides, all timed; ' + lb.length + ' leaderboards'];
  });
  claim(L('live-quiz-for-classroom'), 'lede', 'Three quick questions, a leaderboard, then a check on what was hard', 'the class deck has three timed questions, a leaderboard, then a vote and an open question', N, async () => {
    const d = landing('live-presentation', 'live-quiz-for-classroom').preset.deck;
    const types = d.slides.map((x) => x.t).join();
    return [d.slides.filter((x) => x.t === 'quiz').length === 3 && /lb,mc,oe$/.test(types) && d.slides.filter((x) => x.t === 'quiz').every((x) => x.secs > 0), types];
  });
  claim(L('interactive-meeting-presentation'), 'lede', 'One code at the start of the meeting, then every question on the shared screen is answered from people’s phones.', 'the meeting deck mixes a rating, a word cloud, a vote, open ideas and Q&A', N, async () => {
    const d = landing('live-presentation', 'interactive-meeting-presentation').preset.deck;
    const has = (t) => d.slides.some((x) => x.t === t);
    return [['rt', 'wc', 'mc', 'oe', 'qa'].every(has), d.slides.map((x) => x.t).join()];
  });

  /* ---- what needs a real session: build/tests/live-rooms.js ---- */
  manual(L('live-presentation'), 'tip', 'One code for the whole deck: phones join once and follow you from slide to slide.', 'needs a relay session with real phones; build/tests/live-rooms.js (live-presentation) runs one');
  manual(L('live-presentation'), 'tip', 'Each phone sees only its own quiz points, total and place, never anyone else’s answer.', 'needs a relay session; build/tests/live-rooms.js checks the cards each phone receives');
  manual(L('live-presentation'), 'tip', 'after the last question it reveals third, second and then the winner', 'a timed sequence on the big screen with confetti; build/tests/live-rooms.js runs the finale in headless Chrome');
};
