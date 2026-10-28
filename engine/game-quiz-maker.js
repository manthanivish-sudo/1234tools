/**
 * Quiz Maker & Host, on the device.
 *
 * Build a quiz of rounds and questions (multiple choice, true or false, typed
 * answers, numbers, pictures, put-in-order), reorder them by dragging or with
 * the arrow buttons (Alt+↑/↓ on the keyboard), add pictures from the device
 * (resized on a canvas to at most 1600 px and kept in this browser's
 * IndexedDB, never uploaded), and every change is saved on this device as
 * you type. Or start from a ready-made pack (/games/packs/, same origin).
 *
 * Host it: the TV (engine/game-kit.js's stage) shows the round, the question,
 * the picture and a countdown, and the answer only when the host presses
 * Reveal; the host's page is the presenter view, with the answer and the
 * notes in sight all along. Teams and scores are built in — a joker round per
 * team doubles its points — and can also go to the Scoreboard over
 * BroadcastChannel('mvr-games:points') as { team (1-based), name, points }.
 *
 * Print: question sheets, blank answer sheets and the host's answer key for a
 * pub-style paper quiz. Share: a quiz of up to 60 questions without pictures
 * goes in a link (after the #, so never to a server); any quiz exports to a
 * .json file with its pictures inside.
 *
 * The quiz rules (checking, scoring, the host engine) are in
 * engine/game-quiz-core.js; this file is the page.
 */
(function () {
  'use strict';
  window.GAME_TOOLS = window.GAME_TOOLS || {};
  window.GAME_TOOLS['quiz-maker'] = {
    order: 8,
    title: 'Quiz Maker & Host',
    short: 'Quiz Maker',
    description: 'Write a quiz with picture rounds, multiple choice and typed answers, host it on the TV with a countdown, a Reveal button and team scores, and let players answer on their phones if you like. Or print the sheets. Free, no sign-up.',
    keywords: ['quiz maker', 'make a quiz', 'quiz host', 'pub quiz maker', 'family quiz night', 'picture round maker', 'quiz on tv', 'printable quiz answer sheet', 'quiz with phones', 'answer on your phone'],
    glyph: 'i-quiz-maker',
    glyphSvg: '<symbol id="i-quiz-maker" viewBox="0 0 24 24">\n  <rect x="2.6" y="3.4" width="18.8" height="13.4" rx="2.4"/>\n  <path d="M8.4 20.6h7.2M12 16.8v3.8" class="thin"/>\n  <path d="M9.7 8.2a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.4v.3"/>\n  <circle cx="12" cy="14.2" r=".95" class="fill"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/game-quiz-core.js', '/engine/game-quiz-maker.js'],
    /* optional phones through the live relay (engine/game-phones.js, fetched on Use phones): build-games.js marks the page */
    phones: true,
    privacy: 'Your quiz, its pictures and the scores stay on this device: they are kept in this browser’s own storage and shown on your own screens. Without phones, nothing is uploaded. A share link carries the quiz after the “#”, a part of a link that browsers never send to a server. Phones are optional: once you press Use phones and start a live session, each question’s words and options go through our server at live.1234tools.com to the phones, and the phones’ answers come back the same way; pictures never leave this device. Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.',
    how: [
      'Type a title for the quiz in Quiz title.',
      'Choose a question type under the round (multiple choice, true or false, typed answer, number, picture or put in order) and press Add question.',
      'Type the question and its answer. For multiple choice, fill the options and press the round button beside the right one. The page saves as you type.',
      'Press Add a round for the next round. Drag a question, or press its arrows (Alt+↑ or Alt+↓), to move it.',
      'Or press Ready-made quiz and pick a quiz to start from.',
      'Press 2 Host, type the team names (one per line) and press Start the quiz.',
      'Press Show on TV and drag the new window to the TV, then press Full screen there. With one screen, press Full screen here.',
      'Press Show the question (Enter). Your page shows the answer and your note; the TV does not.',
      'Press Reveal answer (R) to show the answer on the TV.',
      'Press Right (or the team’s number key, 1 to 9) for each team that got it.',
      'Press Next (→) for the next question. Show scores (S) puts the scores on the TV.',
      'After the last question, press Final scores. To play again, press End the game, then Start the quiz.',
      'For a paper quiz, press 3 Print and choose question sheets, answer sheets or the answer key.',
      'Optional, with phones: in Host press Use phones, choose Everyone for themselves or Teams, press Start a live session, and players join at 1234tools.com/join with the 6-digit code before you press Start the quiz.'
    ],
    manual: {
      setup: [
        'Press New quiz and type a title.',
        'Add questions round by round with Add question; add rounds with Add a round.',
        'Fix anything listed under the title until it says ready to host.',
        'Press 2 Host and type the team names, one per line.',
        'Tick the joker or Closest answer wins if you want them, and set a timer if you want one.',
        'Optional: press Use phones, choose Everyone for themselves or Teams, and press Start a live session; players join at 1234tools.com/join with the code.'
      ],
      play: [
        'Press Start the quiz. The TV shows the round’s name.',
        'Press Show the question (Enter); read it out. Your page has the answer.',
        'Press Reveal answer (R), then Right (or 1 to 9) for each team that got it.',
        'Press Next (→). Back (←) goes back one step.',
        'Press Show scores (S) between rounds, and Final scores at the end.',
        'With phones: players tap or type their answer before the time runs out; Reveal tells each phone “Correct!” or “Not this time.”, the top 5 follow, and Final scores shows the winner on a podium.'
      ],
      tv: [
        'On the Host tab, press Show on TV. A new window opens.',
        'Drag that window to the TV or projector, or cast that browser tab.',
        'Press Full screen in that window. Your page stays the presenter view with the answers.',
        'With only one screen, press Full screen here; press Esc to come back.',
        'With phones, the TV shows 1234tools.com/join, the code and a QR code at the top, so people can join at any time.'
      ],
      troubleshooting: [
        { q: 'Start the quiz does nothing.', a: 'The quiz has something to fix: a question without an answer, a round without a name, or a picture question without a picture. The list under the button names each one.' },
        { q: 'The TV window says the quiz will appear here.', a: 'Keep the host page open in the same browser on the same computer and press Show the question or Next: the TV follows the host page.' },
        { q: 'I marked the wrong team.', a: 'Press that team’s Right button again to take the mark off.' },
        { q: 'My quiz is gone.', a: 'Quizzes are kept in this browser on this device. A private window forgets them when it closes; use Export file to keep a copy.' },
        { q: 'The pictures are missing on another device.', a: 'Pictures stay on the device they were added on, and a share link cannot carry them. Use Export file and open the file with Import file on the other device.' },
        { q: 'A phone cannot answer.', a: 'The phone answers multiple-choice, true-or-false, typed, number and picture questions until the time runs out; put-in-order questions say “Look at the screen”. A phone that joins during a question can still answer it until the time runs out. If it says the session ended, start a new session and give out the new code.' }
      ]
    },
    uses: [
      ['Family quiz night', 'four rounds for the whole family, with a picture round of baby photos'],
      ['Pub or club quiz', 'printed answer sheets for the tables, the questions on the projector'],
      ['Classroom', 'a ten-question recap at the end of a topic, marked on the board']
    ],
    tips: [
      'Typed answers forgive what a quizmaster would: capitals, accents, punctuation and “the”, “a” or “an” are ignored, and one slip in a word of five letters or more (two in nine or more) still counts. Add other spellings in “Also accept”.',
      'Number questions can take a tolerance (“within 5”), or tick “Closest answer wins” in Host and type each team’s guess: the nearest team gets the points.',
      'Give a question a time limit and the TV counts it down, with ticks in the last five seconds and a buzzer at the end.',
      'Each team may play its joker on one round to double its points there; pick it in Host before that round starts.',
      'Pictures are made at most 1600 pixels across before they are kept, so a phone photo does not fill the browser’s storage.',
      'A share link holds up to 60 questions without pictures. For a picture round, use Export file and send the .json: it opens with Import file on any device.',
      'With phones, every question has a time limit (its own, the default you set in Host, or 20 seconds). A right answer earns the question’s points plus up to half again for speed; equal scores go to the player with the lower total time on right answers.',
      'In Teams with phones, each team’s first answer from its phones is the team’s answer, so a team should agree before anyone taps. Phones choose their team when you pick Teams; anyone who does not is put in the smallest team, and you can move people under Phones and teams.'
    ],
    faq: [
      { q: 'Is the quiz uploaded anywhere?', a: 'Not unless you use phones. The questions, pictures and scores are kept in this browser’s storage on this device and shown on your own screens. Nothing is uploaded. A share link holds the quiz after the “#”, which browsers do not send to the website, and an exported file goes wherever you send it. With phones, each question’s words and options go through our server to the phones and their answers come back. Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.' },
      { q: 'Can players answer on their own phones?', a: 'Yes, if you want: phones are optional. In Host press Use phones, choose Everyone for themselves or Teams, and press Start a live session. Players go to 1234tools.com/join, type the 6-digit code (or scan the QR code on the TV) and answer with no app and no account. During the launch trial a free session takes up to 1,000 phones. At the end the TV shows the winner on a podium and each phone that answered shows its place. Export answers saves every phone’s answers, times and points as a CSV file.' },
      { q: 'How do I show the quiz on the TV?', a: 'In Host, press Show on TV to open the big-screen view in a new window, drag it to the TV or projector (or cast that browser tab) and press Full screen there. Your page stays the presenter view with the answers. With one screen, press Full screen here.' },
      { q: 'Does it mark typed answers?', a: 'If you type a team’s answer into its row, Reveal marks it: case, accents, punctuation and the words “the”, “a” and “an” are ignored, the spellings in “Also accept” count, and a small typo is forgiven in longer words. You can always change a mark by hand.' },
      { q: 'Can I make a picture round?', a: 'Yes. Choose Picture as the question type and pick a photo from the device. It is resized to at most 1600 pixels, kept in this browser, and shown big on the TV; the printed question sheet includes it too.' },
      { q: 'How do I print a pub quiz?', a: 'Open Print and choose question sheets (one set per table), answer sheets (numbered blank lines per round, with a space for the team name) or the answer key with your notes. Each opens your browser’s print dialogue, where you can also save a PDF.' },
      { q: 'Can I share the quiz with another quizmaster?', a: 'Yes. Copy share link puts a quiz of up to 60 questions without pictures into a link. For bigger quizzes or picture rounds, Export file saves a .json file (pictures included) that Import file opens on another device.' },
      { q: 'Does it work offline and on a phone?', a: 'Yes. After the first visit the page opens without a connection, and a ready-made pack you have opened once is kept too. It works on phones, tablets and computers; you can install it as an app from the browser’s menu. Playing with phones needs a connection.' },
      { q: 'Where are the ready-made packs from?', a: 'They are written for this site, each question with a source page that states the answer, and each pack shows the date it was last checked. The picker tells you if a pack has not been checked yet.' }
    ],
    related: ['/utilities/random-number-generator/', '/time/countdown-timer/', '/education/report-card/'],
    landings: [
      {
        slug: 'family-quiz-night-maker',
        title: 'Family Quiz Night Maker',
        description: 'Write a family quiz with a kids’ round and a picture round, host it on the TV with team scores, let everyone answer on their phones, or print the sheets. Free, no sign-up.',
        lede: 'Four rounds ready to fill — general knowledge, a kids’ round, a picture round and a quick-fire finish — then host it on the TV with the scores kept for you.',
        preset: { title: 'Family Quiz Night', rounds: ['General knowledge', 'Kids’ round', 'Picture round', 'Quick-fire'] },
        about: [
          'The quiz opens with four empty rounds named for a family evening. Write a few questions in each, or press Ready-made quiz to start from a pack and change what you like.',
          'In Host, type the teams (or make them with the Team Generator first), pick each team’s joker round, and show the questions on the TV. Your phone or laptop shows the answers before you reveal them.'
        ],
        faq: [
          { q: 'How many questions does a family quiz need?', a: 'Around 10 questions a round and four rounds fills an hour with time to talk. Make the kids’ round easy enough for the youngest player to answer on their own.' },
          { q: 'Can children read the questions on the TV?', a: 'Yes. The TV shows each question in large type, with pictures big, and a countdown only if you set one. You read the question aloud as well, so non-readers can play.' }
        ]
      },
      {
        slug: 'christmas-quiz-host',
        title: 'Christmas Quiz Host',
        description: 'Host a Christmas quiz on the TV: rounds for traditions, films and food, a countdown, a Reveal button and team scores, with answers on phones if you like. Free.',
        lede: 'A Christmas quiz in four rounds — traditions, films, food and a picture round — shown on the TV with the answers on your phone and the scores kept for you.',
        preset: { title: 'Christmas Quiz', rounds: ['Christmas traditions', 'Christmas films', 'Festive food', 'Picture round'] },
        about: [
          'The quiz opens with four Christmas rounds to fill. Questions can be multiple choice for the younger players and typed answers for the grown-ups.',
          'The TV shows a question at a time; your page is the presenter view with the answer and a note to read out. Mark the teams, press Next, and show the scores between rounds.'
        ],
        faq: [
          { q: 'Can the whole family play on one TV?', a: 'Yes. Teams write their answers on paper (print the answer sheets) or call them out, and you mark each team on your page; or press Use phones and everyone answers on their own phone. The TV only ever shows what you choose to reveal.' },
          { q: 'Will it work at a relative’s house with no Wi-Fi?', a: 'Yes, once you have opened the page on that phone or laptop before. The quiz is kept on the device and the page works offline. Only answering on phones needs a connection.' }
        ]
      },
      {
        slug: 'picture-round-maker',
        title: 'Picture Round Maker for a Quiz',
        description: 'Make a quiz picture round from photos on your phone or computer: each picture shown big on the TV, or printed on the question sheet. Your photos are never uploaded.',
        lede: 'Pick photos from the device — baby photos, famous places, logos you took yourself — type the answer for each, and show them one by one on the TV or print them.',
        preset: { title: 'Picture Round', rounds: ['Picture round'], type: 'picture' },
        about: [
          'New questions on this page start as picture questions. Each photo is resized to at most 1600 pixels on your device and kept in this browser; it is not uploaded anywhere.',
          'Host shows each picture full size on the TV with the question underneath. Print puts the pictures on the question sheet, numbered, for a table quiz.'
        ],
        faq: [
          { q: 'Can I send the picture round to someone else?', a: 'Yes: Export file saves a .json file with the pictures inside, which Import file opens on another device. A share link cannot carry pictures.' },
          { q: 'What pictures can I use?', a: 'Any JPEG, PNG, GIF or WebP your browser can open. Use your own photos, or pictures you have permission to use, especially for a public quiz.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit, C = window.QuizCore;
  const SLUG = 'quiz-maker';

  const STR = {
    untitled: 'My quiz', round: function (n) { return 'Round ' + n; },
    myQuizzes: 'My quizzes', newQuiz: 'New quiz', packs: 'Ready-made quiz', importF: 'Import file', exportF: 'Export file',
    shareL: 'Copy share link', del: 'Delete quiz', tabs: ['Build', 'Host', 'Print'],
    title: 'Quiz title', roundName: 'Round name', addRound: 'Add a round', addQ: 'Add question', qType: 'Type',
    prompt: 'Question', answer: 'Answer', accept: 'Also accept (split by commas)', tolerance: 'Within (±)', points: 'Points',
    time: 'Seconds (blank: no timer)', note: 'Note for the host (shown after the answer)', option: function (i) { return 'Option ' + 'ABCDEF'[i]; },
    rightOpt: 'Right answer', addOpt: 'Add option', items: 'Items in the right order, one per line (2 to 8)',
    pic: 'Choose picture', picAgain: 'Change picture', picGone: 'Remove picture', picMaking: 'Making the picture smaller…',
    up: 'Move up  (Alt+↑)', down: 'Move down  (Alt+↓)', drag: 'Drag to move', delQ: 'Delete question', delRound: 'Delete round',
    roundUp: 'Move round up', roundDown: 'Move round down',
    saved: 'Saved on this device.', savedMem: 'This browser blocks storage: the quiz is kept until you close the page. Use Export file to keep it.',
    problems: function (n) { return n === 1 ? '1 thing to fix before hosting:' : n + ' things to fix before hosting:'; },
    ready: function (n) { return n + (n === 1 ? ' question' : ' questions') + ' — ready to host.'; },
    noQs: 'Add a question to start.',
    packsLoading: 'Loading the list of ready-made quizzes…', packsNone: 'No ready-made quizzes could be loaded. Check the connection and try again.',
    packLine: function (p) { return p.title + ' — ages ' + p.ages + ', ' + p.count + ' questions'; },
    packOpened: function (p) { return 'Opened “' + p.title + '” as a new quiz of your own. ' + (p.reviewed ? 'Its answers were checked on ' + p.reviewed + '.' : 'Its answers have not been checked yet.'); },
    packFailed: function (m) { return 'That quiz could not be opened: ' + m; },
    shareCopied: 'Link copied. Anyone who opens it gets a copy of this quiz on their own device.',
    sharedAsk: function (t, n) { return 'This link holds a quiz: “' + t + '”, ' + n + ' questions. Open it as a new quiz on this device?'; },
    sharedOpen: 'Open it', sharedNo: 'No thanks', sharedDone: 'Opened the shared quiz.',
    imported: function (t) { return 'Imported “' + t + '”.'; }, importBad: 'That file is not a quiz this page can read.',
    deleted: 'Quiz deleted.', delAsk: 'Delete this quiz and its pictures from this device?',
    teams: 'Teams, one per line', timerDef: 'Seconds for questions without a time (blank: no timer)',
    closest: 'Closest answer wins on number questions', jokerOn: 'Each team has a joker (double points on one round)',
    toBoard: 'Also send the points to the Scoreboard (open it in another tab)', start: 'Start the quiz', resume: 'Resume the quiz in progress',
    fixFirst: 'Fix these first (in Build):', joker: 'Joker round', jokerNone: 'No joker yet',
    reveal: 'Reveal answer  (R)', next: 'Next  (→)', back: 'Back  (←)', scores: 'Show scores  (S)', hideScores: 'Hide scores  (S)',
    timerAgain: 'Restart timer  (T)', showQ: 'Show the question  (Enter)', finish: 'Final scores', endGame: 'End the game',
    right: 'Right', notRight: 'Not marked', theirAns: 'Their answer (optional)',
    answerIs: 'Answer', noteIs: 'Note', of: function (a, b) { return a + ' of ' + b; },
    roundQ: function (pq) { return 'Round ' + pq.roundNo + ' · ' + pq.round + ' · Question ' + pq.no + ' of ' + pq.inRound; },
    marked: function (t, p) { return t + ': ' + (p ? p + (p === 1 ? ' point' : ' points') : 'no points') + '.'; },
    jokerSet: function (t, r) { return t + ' plays the joker on ' + r + '.'; }, jokerLocked: 'That joker is already used.',
    revealed: 'Answer revealed.', ended: 'Final scores are on the screen.',
    printQ: 'Print question sheets', printA: 'Print answer sheets', printK: 'Print the answer key',
    printHint: 'Each opens the print dialogue; choose “Save as PDF” there for a file. Question sheets include the pictures and the options; answer sheets have a numbered line per question and a space for the team name.',
    teamName: 'Team name', answerKey: 'Answer key', questionSheet: 'Questions', answerSheet: 'Answer sheet', total: 'Total',
    tvWait: 'The quiz will appear here.', tvScores: 'Scores', tvFinal: 'Final scores', tvRound: function (n) { return 'Round ' + n; },
    tvTimeUp: 'Time’s up!', pts: function (n) { return n === 1 ? '1 point' : n + ' points'; },
    phonesH: 'Phones (optional)', usePhones: 'Use phones',
    phonesHint: 'Let players answer on their own phones at 1234tools.com/join with a 6-digit code: no app, no account. Multiple choice and true or false are answered with a tap, typed and number answers are typed in, and faster right answers earn a speed bonus. During the launch trial a free session takes up to 1,000 phones. Without phones the quiz works as before and nothing leaves this device.',
    phonesPrivacy: 'Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.',
    phonesFailed: 'The phone tools could not be loaded. Check the connection and press Use phones again.'
  };
  const TYPE_LIST = ['mcq', 'tf', 'text', 'number', 'picture', 'order'];

  /* ---------- printing (pure DOM builders; the test reads them) ---------- */

  function printDoc(quiz, kind, pics) {
    const box = K.el('div', 'qz-print');
    let n = 0;
    if (kind === 'answers') {
      quiz.rounds.forEach(function (r, ri) {
        const sec = K.el('section', 'qz-print-page');
        sec.appendChild(K.el('h1', null, quiz.title + ' — ' + STR.answerSheet));
        sec.appendChild(K.el('p', 'qz-print-team', STR.teamName + ': ______________________________'));
        sec.appendChild(K.el('h2', null, STR.round(ri + 1) + ': ' + r.name));
        const ol = K.el('ol', 'qz-print-lines');
        r.questions.forEach(function () { ol.appendChild(K.el('li', null, '')); });
        sec.appendChild(ol);
        sec.appendChild(K.el('p', 'qz-print-team', STR.total + ': ______'));
        box.appendChild(sec);
      });
      return box;
    }
    const head = K.el('h1', null, quiz.title + (kind === 'key' ? ' — ' + STR.answerKey : ''));
    box.appendChild(head);
    quiz.rounds.forEach(function (r, ri) {
      const sec = K.el('section', 'qz-print-round');
      sec.appendChild(K.el('h2', null, STR.round(ri + 1) + ': ' + r.name));
      const ol = K.el('ol');
      r.questions.forEach(function (q) {
        n++;
        const li = K.el('li');
        li.appendChild(K.el('p', 'qz-print-q', q.prompt));
        if (q.image && q.image.id && pics && pics[q.image.id]) { const im = K.el('img'); im.src = pics[q.image.id]; im.alt = ''; li.appendChild(im); }
        if (kind === 'questions') {
          if (q.type === 'mcq') { const ul = K.el('ul', 'qz-print-opts'); q.options.forEach(function (o, i) { ul.appendChild(K.el('li', null, 'ABCDEF'[i] + '. ' + o)); }); li.appendChild(ul); }
          if (q.type === 'tf') li.appendChild(K.el('p', 'qz-print-opts', STR.tTrue + ' / ' + STR.tFalse));
          if (q.type === 'order') li.appendChild(K.el('p', 'qz-print-opts', C.answerText(q).split(' → ').slice().sort().join('   ·   ')));
        } else {
          li.appendChild(K.el('p', 'qz-print-a', STR.answerIs + ': ' + C.answerText(q) + (q.accept && q.accept.length ? '  (also: ' + q.accept.join(', ') + ')' : '')));
          if (q.note) li.appendChild(K.el('p', 'qz-print-note', q.note));
        }
        ol.appendChild(li);
      });
      sec.appendChild(ol);
      box.appendChild(sec);
    });
    return box;
  }
  STR.tTrue = C.STR.tTrue; STR.tFalse = C.STR.tFalse;

  /* ---------- the big screen ---------- */

  const tvPics = new Map();
  let tvRaf = 0;
  function picUrl(id, then) {
    if (tvPics.has(id)) return tvPics.get(id);
    tvPics.set(id, null);
    C.store.getPicture(id).then(function (b) { if (b) { tvPics.set(id, URL.createObjectURL(b)); if (then) then(); } });
    return null;
  }
  function promptSize(text, withPic) {
    const n = String(text || '').length;
    const base = n < 50 ? 7 : n < 110 ? 5.6 : n < 220 ? 4.4 : 3.4;
    return (withPic ? base * 0.62 : base).toFixed(2) + 'vmin';
  }
  function renderStage(stageBody, s) {
    cancelAnimationFrame(tvRaf);
    let body = stageBody;
    /* phones in play (s.ph): the join strip on top and the phones' own views, drawn by engine/game-phones.js */
    if (s && s.ph) {
      const GP = window.GamePhones;
      if (GP && window.LiveKit) {
        body = GP.frame(stageBody, s.ph);
        if (GP.drawStage(body, s)) return;
      } else phonesStage().then(function () { renderStage(stageBody, s); }).catch(function () { /* drawn without the strip */ });
    }
    body.textContent = '';
    if (!s || !s.view || s.view === 'idle') { body.appendChild(K.el('p', 'game-stage-wait', STR.tvWait)); return; }
    const wrap = K.el('div', 'st-qz');
    if (s.view === 'scores' || s.view === 'end') {
      wrap.appendChild(K.el('h1', 'st-title', s.view === 'end' ? STR.tvFinal : STR.tvScores));
      const ol = K.el('ol', 'st-qz-scores');
      (s.scores || []).forEach(function (t, i) {
        const li = K.el('li', 'st-qz-score' + (s.view === 'end' && t.rank === 1 ? ' is-win' : ''));
        li.style.setProperty('--tc', 'var(--t' + ((t.i % 8) + 1) + ')');
        li.appendChild(K.el('span', 'st-qz-rank', String(t.rank)));
        li.appendChild(K.el('span', 'st-qz-name', t.name + (t.joker ? '  ★' : '')));
        li.appendChild(K.el('span', 'st-qz-pts', String(t.score)));
        ol.appendChild(li);
      });
      ol.style.setProperty('--rows', Math.max(1, (s.scores || []).length));
      wrap.appendChild(ol);
      body.appendChild(wrap);
      return;
    }
    if (s.view === 'round') {
      wrap.classList.add('is-round');
      wrap.appendChild(K.el('p', 'st-qz-meta', STR.tvRound(s.roundNo)));
      wrap.appendChild(K.el('h1', 'st-qz-roundname', s.round));
      body.appendChild(wrap);
      return;
    }
    wrap.appendChild(K.el('p', 'st-qz-meta', s.meta));
    let pic = null;
    if (s.image) {
      const url = picUrl(s.image, function () { renderStage(body, s); });
      pic = K.el('div', 'st-qz-pic');
      if (url) { const im = K.el('img'); im.src = url; im.alt = ''; pic.appendChild(im); }
      wrap.appendChild(pic);
    }
    const p = K.el('h1', 'st-qz-prompt', s.prompt);
    p.style.setProperty('--fs', promptSize(s.prompt, !!s.image || (s.options && s.options.length > 2)));
    wrap.appendChild(p);
    if (s.options && s.options.length) {
      const ul = K.el('ul', 'st-qz-opts' + (s.options.length > 4 ? ' is-many' : ''));
      s.options.forEach(function (o, i) {
        const li = K.el('li', 'st-qz-opt' + (s.view === 'reveal' && s.answerIndex === i ? ' is-right' : '') + (s.view === 'reveal' && s.answerIndex !== null && s.answerIndex !== i ? ' is-dim' : ''));
        li.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
        li.appendChild(K.el('b', null, s.type === 'order' ? String(i + 1) : 'ABCDEF'[i]));
        li.appendChild(K.el('span', null, o));
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
    }
    if (s.view === 'reveal') {
      const a = K.el('p', 'st-qz-answer');
      a.appendChild(K.el('span', 'st-qz-tag', STR.answerIs));
      a.appendChild(document.createTextNode(s.answer));
      wrap.appendChild(a);
      if (s.note) wrap.appendChild(K.el('p', 'st-qz-note', s.note));
    } else if (s.endsAt) {
      const t = K.el('div', 'st-qz-timer');
      const num = K.el('span', 'st-qz-secs');
      const bar = K.el('span', 'st-qz-bar');
      const fill = K.el('i'); bar.appendChild(fill);
      t.appendChild(num); t.appendChild(bar);
      t.setAttribute('role', 'timer');
      wrap.appendChild(t);
      const total = s.secs * 1000;
      const tick = function () {
        const left = Math.max(0, s.endsAt - C.now());
        num.textContent = left > 0 ? String(Math.ceil(left / 1000)) : STR.tvTimeUp;
        fill.style.transform = 'scaleX(' + (left / total).toFixed(4) + ')';
        t.classList.toggle('is-low', left > 0 && left <= 5000);
        if (left > 0) tvRaf = requestAnimationFrame(tick);
      };
      tick();
    }
    if (s.ph && window.GamePhones && s.view === 'question') window.GamePhones.answeredLine(wrap, s.ph);
    body.appendChild(wrap);
  }

  /* ---------- phones (optional): fetched only when the host presses Use phones ---------- */

  const js = {};
  function loadJs(src) {
    if (!js[src]) js[src] = new Promise(function (res, rej) {
      const sc = document.createElement('script');
      sc.src = src; sc.async = true;
      sc.onload = res; sc.onerror = function () { delete js[src]; rej(new Error(src)); };
      document.head.appendChild(sc);
    });
    return js[src];
  }
  const inOrder = function (list) { return list.reduce(function (p, src) { return p.then(function () { return loadJs(src); }); }, Promise.resolve()); };
  /* the TV window needs only the drawing parts; the host page needs the relay client too */
  function phonesStage() { return inOrder(['/engine/room-kit.js', '/engine/game-phones.js']); }
  function phonesHost() { return inOrder(['/engine/room-client.js', '/engine/room-words.js', '/engine/room-kit.js', '/engine/game-phones.js']); }

  /* ---------- the page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const prefs = K.store(SLUG, 1);
    const preset = K.preset(root);
    const P = Object.assign({ current: null, tab: 0, host: { teams: 'Team 1\nTeam 2\nTeam 3', timer: '', closest: false, joker: true, board: false }, game: null }, prefs.get({}));
    let rec = null, persistent = true, saveT = 0, game = null, view = 'idle', intro = false, showScores = false, phones = null;
    const thumbs = new Map();
    const addType = preset.type && TYPE_LIST.indexOf(preset.type) >= 0 ? preset.type : 'mcq';

    /* top bar */
    const top = K.el('section', 'game-panel qz-top');
    const pick = K.el('select'); pick.setAttribute('aria-label', STR.myQuizzes);
    const bar1 = K.el('div', 'game-row');
    bar1.appendChild(K.field(STR.myQuizzes, pick).wrap);
    const bNew = K.button(STR.newQuiz, 'btn-ghost', function () { newQuiz(); });
    const bPacks = K.button(STR.packs, 'btn-ghost', togglePacks);
    const file = K.el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
    const bImp = K.button(STR.importF, 'btn-ghost', function () { file.click(); });
    const bExp = K.button(STR.exportF, 'btn-ghost', exportQuiz);
    const bShare = K.button(STR.shareL, 'btn-ghost', shareQuiz);
    const bDel = K.button(STR.del, 'btn-ghost', deleteQuiz);
    const bar2 = K.el('div', 'game-row');
    [bNew, bPacks, bImp, bExp, bShare, bDel].forEach(function (b) { bar2.appendChild(b); });
    top.appendChild(bar1); top.appendChild(bar2); top.appendChild(file);
    const msg = K.el('p', 'game-msg'); msg.setAttribute('role', 'status');
    top.appendChild(msg);
    const ask = K.el('div', 'qz-ask'); ask.hidden = true; top.appendChild(ask);
    const packs = K.el('div', 'qz-packs'); packs.hidden = true; top.appendChild(packs);
    io.appendChild(top);

    const tabs = K.el('div', 'game-seg qz-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Mode');
    const tabB = STR.tabs.map(function (t, i) { const b = K.button((i + 1) + '  ' + t, null, function () { setTab(i); }); tabs.appendChild(b); return b; });
    io.appendChild(tabs);
    const panes = [K.el('div', 'qz-pane qz-build'), K.el('div', 'qz-pane qz-host'), K.el('div', 'qz-pane qz-printpane')];
    panes.forEach(function (p) { io.appendChild(p); });

    function say(text, warn) { msg.textContent = text; msg.className = 'game-msg' + (warn ? ' is-warn' : ''); K.announce(root, text); }
    function persistPrefs() { prefs.set(P); }
    function quiz() { return rec.quiz; }

    /* ----- saving ----- */
    function save(now) {
      clearTimeout(saveT);
      const go = function () {
        C.store.putQuiz(rec).then(function () { refreshPick(); setSaved(); }).catch(function () { persistent = false; setSaved(); });
      };
      if (now) go(); else saveT = setTimeout(go, 400);
      checkRow();
    }
    function setSaved() { saveLine.textContent = persistent ? STR.saved : STR.savedMem; }
    function refreshPick() {
      return C.store.listQuizzes('quiz').then(function (list) {
        pick.textContent = '';
        list.forEach(function (r) { const o = K.el('option', null, (r.title || STR.untitled) + ' (' + r.count + ')'); o.value = r.id; pick.appendChild(o); });
        if (rec) pick.value = rec.id;
      });
    }
    function blankQuiz(title, rounds) {
      const names = rounds && rounds.length ? rounds : [STR.round(1)];
      return { v: 1, title: title || STR.untitled, rounds: names.map(function (n, i) { return { name: n, questions: i === 0 ? [C.blankQuestion(addType)] : [] }; }) };
    }
    function useRec(r, quiet) {
      rec = r; P.current = r.id; persistPrefs();
      if (game && P.game && P.game.id !== r.id) { game = null; }
      renderBuild(); renderHost(); refreshPick();
      if (!quiet) checkRow();
    }
    function newQuiz(title, rounds) {
      const r = { id: C.newId('q'), kind: 'quiz', quiz: blankQuiz(title, rounds) };
      return C.store.putQuiz(r).then(function (saved) { useRec(saved); setTab(0); return saved; });
    }
    function adopt(q, text) {
      const r = { id: C.newId('q'), kind: 'quiz', quiz: C.cleanQuiz(q) };
      return C.store.putQuiz(r).then(function (saved) { useRec(saved); setTab(0); if (text) say(text); return saved; });
    }

    /* ----- packs ----- */
    function togglePacks() {
      if (!packs.hidden) { packs.hidden = true; return; }
      packs.hidden = false; packs.textContent = '';
      packs.appendChild(K.el('p', 'game-msg', STR.packsLoading));
      C.loadPackIndex().then(function (list) {
        packs.textContent = '';
        if (!list.length) { packs.appendChild(K.el('p', 'game-msg is-warn', STR.packsNone)); return; }
        const ul = K.el('ul', 'qz-pack-list');
        list.forEach(function (p) {
          const li = K.el('li');
          li.appendChild(K.button(STR.packLine(p), 'btn-ghost qz-pack', function () { openPack(p.id); }));
          ul.appendChild(li);
        });
        packs.appendChild(ul);
      }).catch(function () { packs.textContent = ''; packs.appendChild(K.el('p', 'game-msg is-warn', STR.packsNone)); });
    }
    function openPack(id) {
      C.loadPack(id).then(function (p) { packs.hidden = true; return adopt(p, STR.packOpened(p)); })
        .catch(function (e) { say(STR.packFailed(e.message), true); });
    }

    /* ----- share, import, export, delete ----- */
    function shareQuiz() {
      const fit = C.shareFits(quiz());
      if (!fit.ok) { say(fit.reason, true); return; }
      C.encodeShare(quiz()).then(function (code) {
        const url = location.origin + location.pathname + '#q=' + code;
        bShare.dataset.url = url;
        return K.copy(url).then(function () { say(STR.shareCopied); });
      }).catch(function (e) { say(e.message, true); });
    }
    function exportQuiz() {
      C.exportFile(quiz(), 'quiz').then(function (data) {
        const name = (quiz().title || 'quiz').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'quiz';
        K.download(new Blob([JSON.stringify(data)], { type: 'application/json' }), name + '.quiz.json');
      });
    }
    file.addEventListener('change', function () {
      const f = file.files && file.files[0];
      file.value = '';
      if (!f) return;
      f.text().then(function (t) { return C.importFile(t); }).then(function (res) {
        if (!res.quiz.rounds.length) throw new Error('empty');
        return adopt(res.quiz, STR.imported(res.quiz.title));
      }).catch(function () { say(STR.importBad, true); });
    });
    function deleteQuiz() {
      if (!window.confirm(STR.delAsk)) return;
      const id = rec.id;
      C.store.deleteQuiz(id).then(function () { return C.store.listQuizzes('quiz'); }).then(function (list) {
        say(STR.deleted);
        if (list.length) return C.store.getQuiz(list[0].id).then(useRec);
        return newQuiz();
      });
    }
    function checkShared() {
      const m = /^#q=([A-Za-z0-9_-]+)$/.exec(location.hash);
      if (!m) return;
      C.decodeShare(m[1]).then(function (q) {
        ask.hidden = false; ask.textContent = '';
        ask.appendChild(K.el('p', 'game-msg', STR.sharedAsk(q.title, C.countQuestions(q))));
        const row = K.el('div', 'game-row');
        row.appendChild(K.button(STR.sharedOpen, 'btn-primary', function () { ask.hidden = true; clearHash(); adopt(q, STR.sharedDone); }));
        row.appendChild(K.button(STR.sharedNo, 'btn-ghost', function () { ask.hidden = true; clearHash(); }));
        ask.appendChild(row);
      }).catch(function (e) { say(e.message, true); clearHash(); });
    }
    function clearHash() { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; } }

    /* ----- Build ----- */
    const build = panes[0];
    const tWrap = K.el('section', 'game-panel');
    const tIn = K.el('input'); tIn.type = 'text'; tIn.maxLength = 120;
    tIn.addEventListener('input', function () { quiz().title = tIn.value; save(); });
    tWrap.appendChild(K.field(STR.title, tIn).wrap);
    const saveLine = K.el('p', 'game-msg qz-saved');
    tWrap.appendChild(saveLine);
    const checkBox = K.el('div', 'qz-check');
    tWrap.appendChild(checkBox);
    build.appendChild(tWrap);
    const roundsBox = K.el('div', 'qz-rounds');
    build.appendChild(roundsBox);
    const addR = K.button(STR.addRound, 'btn-ghost', function () {
      quiz().rounds.push({ name: STR.round(quiz().rounds.length + 1), questions: [C.blankQuestion(addType)] });
      save(); renderBuild();
      const last = roundsBox.lastElementChild; if (last) last.querySelector('input').focus();
    });
    build.appendChild(addR);

    function checkRow() {
      checkBox.textContent = '';
      const v = C.validate(quiz());
      const n = C.countQuestions(quiz());
      if (!n) { checkBox.appendChild(K.el('p', 'game-msg', STR.noQs)); return v; }
      if (v.ok) { checkBox.appendChild(K.el('p', 'game-msg qz-ok', STR.ready(n))); return v; }
      checkBox.appendChild(K.el('p', 'game-msg is-warn', STR.problems(v.errors.length)));
      const ul = K.el('ul', 'qz-errors');
      v.errors.slice(0, 8).forEach(function (e) { ul.appendChild(K.el('li', null, e)); });
      if (v.errors.length > 8) ul.appendChild(K.el('li', null, '…'));
      checkBox.appendChild(ul);
      return v;
    }
    const qOf = new WeakMap();
    function renderBuild(focusSel) {
      tIn.value = quiz().title;
      roundsBox.textContent = '';
      quiz().rounds.forEach(function (r, ri) { roundsBox.appendChild(roundEl(r, ri)); });
      setSaved();
      checkRow();
      if (focusSel) { const f = roundsBox.querySelector(focusSel); if (f) f.focus(); }
    }
    function roundEl(r, ri) {
      const sec = K.el('section', 'game-panel qz-round');
      sec.style.setProperty('--tc', 'var(--t' + ((ri % 8) + 1) + ')');
      const head = K.el('div', 'qz-round-head');
      const name = K.el('input'); name.type = 'text'; name.value = r.name; name.maxLength = 80;
      name.addEventListener('input', function () { r.name = name.value; save(); });
      const nf = K.field(STR.round(ri + 1) + ' — ' + STR.roundName, name);
      head.appendChild(nf.wrap);
      const acts = K.el('div', 'game-row qz-round-acts');
      const rs = quiz().rounds;
      if (ri > 0) acts.appendChild(K.button('↑', 'btn-ghost qz-icon', function () { swap(rs, ri, ri - 1); save(); renderBuild(); }, STR.roundUp));
      if (ri < rs.length - 1) acts.appendChild(K.button('↓', 'btn-ghost qz-icon', function () { swap(rs, ri, ri + 1); save(); renderBuild(); }, STR.roundDown));
      if (rs.length > 1) acts.appendChild(K.button(STR.delRound, 'btn-ghost', function () { forgetPics(r.questions); rs.splice(ri, 1); save(); renderBuild(); }));
      acts.querySelectorAll('button').forEach(function (b) { if (b.title) b.setAttribute('aria-label', b.title); });
      head.appendChild(acts);
      sec.appendChild(head);
      const ol = K.el('ol', 'qz-qs');
      ol.dataset.round = String(ri);
      r.questions.forEach(function (q, qi) { ol.appendChild(questionEl(q, ri, qi)); });
      sec.appendChild(ol);
      const add = K.el('div', 'game-row qz-add');
      const sel = typeSelect(addType);
      add.appendChild(K.field(STR.qType, sel).wrap);
      add.appendChild(K.button(STR.addQ, 'btn-primary', function () {
        r.questions.push(C.blankQuestion(sel.value)); save();
        renderBuild('.qz-qs[data-round="' + ri + '"] > li:last-child textarea');
      }));
      sec.appendChild(add);
      return sec;
    }
    function typeSelect(value) {
      const sel = K.el('select');
      TYPE_LIST.forEach(function (t) { const o = K.el('option', null, C.STR.types[t]); o.value = t; sel.appendChild(o); });
      sel.value = value;
      return sel;
    }
    function swap(a, i, j) { const t = a[i]; a[i] = a[j]; a[j] = t; }
    function forgetPics(qs) { qs.forEach(function (q) { if (q.image && q.image.id) C.store.deletePicture(q.image.id); }); }
    function moveQ(ri, qi, dir) {
      const rs = quiz().rounds;
      const q = rs[ri].questions[qi];
      let ti = ri, tq = qi + dir;
      if (tq < 0) { if (ri === 0) return; ti = ri - 1; tq = rs[ti].questions.length; }
      else if (tq > rs[ri].questions.length - 1) { if (ri === rs.length - 1) return; ti = ri + 1; tq = 0; }
      rs[ri].questions.splice(qi, 1);
      rs[ti].questions.splice(tq, 0, q);
      save();
      renderBuild();
      const li = roundsBox.querySelectorAll('.qz-qs')[ti].children[tq];
      if (li) { const b = li.querySelector(dir < 0 ? '.qz-up' : '.qz-down') || li.querySelector('.qz-handle'); if (b) b.focus(); }
      K.announce(root, 'Moved to round ' + (ti + 1) + ', question ' + (tq + 1) + '.');
    }
    function questionEl(q, ri, qi) {
      const li = K.el('li', 'qz-q');
      qOf.set(li, q);
      const head = K.el('div', 'qz-q-head');
      const handle = K.button('⠿', 'btn-ghost qz-icon qz-handle', null, STR.drag);
      handle.setAttribute('aria-label', STR.drag + ' (or use the arrow buttons)');
      head.appendChild(handle);
      head.appendChild(K.el('span', 'qz-q-no', 'Q' + (qi + 1)));
      const sel = typeSelect(q.type);
      sel.setAttribute('aria-label', STR.qType);
      sel.addEventListener('change', function () {
        const nq = C.blankQuestion(sel.value);
        nq.prompt = q.prompt;
        if (q.note) nq.note = q.note;
        if (isFinite(q.points)) nq.points = q.points;
        if (isFinite(q.time)) nq.time = q.time;
        if ((sel.value === 'text' || sel.value === 'picture') && typeof q.answer === 'string') nq.answer = q.answer;
        if (sel.value === 'picture' && q.image) nq.image = q.image; else if (q.image) C.store.deletePicture(q.image.id);
        quiz().rounds[ri].questions[qi] = nq;
        save(); renderBuild('.qz-qs[data-round="' + ri + '"] > li:nth-child(' + (qi + 1) + ') select');
      });
      head.appendChild(sel);
      const up = K.button('↑', 'btn-ghost qz-icon qz-up', function () { moveQ(ri, qi, -1); }, STR.up);
      const dn = K.button('↓', 'btn-ghost qz-icon qz-down', function () { moveQ(ri, qi, 1); }, STR.down);
      const del = K.button('✕', 'btn-ghost qz-icon', function () { forgetPics([q]); quiz().rounds[ri].questions.splice(qi, 1); save(); renderBuild(); }, STR.delQ);
      [up, dn, del].forEach(function (b) { b.setAttribute('aria-label', b.title); head.appendChild(b); });
      li.appendChild(head);
      li.addEventListener('keydown', function (e) {
        if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault(); moveQ(ri, qi, e.key === 'ArrowUp' ? -1 : 1);
      });
      dragOn(handle, li);

      const pr = K.el('textarea', 'qz-prompt'); pr.rows = 2; pr.value = q.prompt; pr.maxLength = 500;
      pr.addEventListener('input', function () { q.prompt = pr.value; save(); });
      li.appendChild(K.field(STR.prompt, pr).wrap);
      li.appendChild(bodyFor(q));
      const foot = K.el('div', 'qz-q-foot');
      const pts = num(q.points, '1', function (v) { if (v === null) delete q.points; else q.points = v; });
      pts.min = '0'; pts.max = '1000';
      foot.appendChild(K.field(STR.points, pts).wrap);
      const tm = num(q.time, '—', function (v) { if (v === null) delete q.time; else q.time = v; });
      tm.min = '5'; tm.max = '600';
      foot.appendChild(K.field(STR.time, tm).wrap);
      const note = K.el('input'); note.type = 'text'; note.value = q.note || ''; note.maxLength = 500;
      note.addEventListener('input', function () { if (note.value.trim()) q.note = note.value; else delete q.note; save(); });
      const nf = K.field(STR.note, note); nf.wrap.classList.add('qz-note');
      foot.appendChild(nf.wrap);
      li.appendChild(foot);
      return li;
    }
    function num(value, ph, set) {
      const n = K.el('input'); n.type = 'number'; n.inputMode = 'decimal'; n.step = 'any';
      n.value = isFinite(value) && value !== null && value !== undefined ? String(value) : ''; n.placeholder = ph;
      n.addEventListener('input', function () { const v = n.value.trim() === '' ? null : Number(n.value); set(v === null || isNaN(v) ? null : v); save(); });
      return n;
    }
    function textIn(value, set, label) {
      const t = K.el('input'); t.type = 'text'; t.value = value || ''; t.maxLength = 200;
      t.addEventListener('input', function () { set(t.value); save(); });
      return K.field(label, t);
    }
    function bodyFor(q) {
      const b = K.el('div', 'qz-q-body');
      if (q.type === 'mcq') {
        const group = 'qz-' + C.newId('r');
        const list = K.el('div', 'qz-opts');
        const draw = function () {
          list.textContent = '';
          q.options.forEach(function (o, i) {
            const row = K.el('div', 'qz-opt');
            const rad = K.el('input'); rad.type = 'radio'; rad.name = group; rad.checked = q.answer !== '' && q.answer === o;
            rad.setAttribute('aria-label', STR.rightOpt + ': ' + STR.option(i));
            rad.addEventListener('change', function () { q.answer = q.options[i]; save(); });
            const lab = K.el('label', 'qz-opt-right'); lab.appendChild(rad); lab.appendChild(K.el('span', null, 'ABCDEF'[i]));
            const t = K.el('input'); t.type = 'text'; t.value = o; t.maxLength = 160; t.placeholder = STR.option(i);
            t.setAttribute('aria-label', STR.option(i));
            t.addEventListener('input', function () { const was = q.answer !== '' && q.options[i] === q.answer; q.options[i] = t.value; if (was) q.answer = t.value; save(); });
            row.appendChild(lab); row.appendChild(t);
            if (q.options.length > 2) {
              const x = K.button('✕', 'btn-ghost qz-icon', function () { if (q.options[i] === q.answer) q.answer = ''; q.options.splice(i, 1); save(); draw(); }, 'Remove ' + STR.option(i));
              x.setAttribute('aria-label', x.title); row.appendChild(x);
            }
            list.appendChild(row);
          });
          if (q.options.length < 6) list.appendChild(K.button(STR.addOpt, 'btn-ghost', function () { q.options.push(''); save(); draw(); list.querySelectorAll('input[type=text]')[q.options.length - 1].focus(); }));
        };
        draw();
        b.appendChild(K.el('p', 'game-field-hint', 'Tick the right answer.'));
        b.appendChild(list);
      } else if (q.type === 'tf') {
        const seg = K.el('div', 'game-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', STR.answer);
        const bt = K.button(STR.tTrue, null, function () { q.answer = true; mark(); save(); });
        const bf = K.button(STR.tFalse, null, function () { q.answer = false; mark(); save(); });
        const mark = function () { bt.setAttribute('aria-pressed', String(q.answer === true)); bf.setAttribute('aria-pressed', String(q.answer === false)); };
        mark(); seg.appendChild(bt); seg.appendChild(bf);
        b.appendChild(K.field(STR.answer, seg).wrap);
      } else if (q.type === 'number') {
        const row = K.el('div', 'game-row qz-num');
        row.appendChild(K.field(STR.answer, num(q.answer, '0', function (v) { q.answer = v === null ? null : v; })).wrap);
        row.appendChild(K.field(STR.tolerance, num(q.tolerance, '0', function (v) { if (v) q.tolerance = Math.abs(v); else delete q.tolerance; })).wrap);
        b.appendChild(row);
      } else if (q.type === 'order') {
        const t = K.el('textarea'); t.rows = 4; t.value = (q.answer || []).join('\n');
        t.addEventListener('input', function () { q.answer = K.parseList(t.value, { lines: true, max: 8, maxLen: 120 }); save(); });
        b.appendChild(K.field(STR.items, t).wrap);
      } else {
        if (q.type === 'picture') b.appendChild(pictureEl(q));
        b.appendChild(textIn(q.answer, function (v) { q.answer = v; }, STR.answer).wrap);
        b.appendChild(textIn((q.accept || []).join(', '), function (v) { const a = K.parseList(v, { maxLen: 120, max: 20 }); if (a.length) q.accept = a; else delete q.accept; }, STR.accept).wrap);
      }
      return b;
    }
    function pictureEl(q) {
      const box = K.el('div', 'qz-pic');
      const f = K.el('input'); f.type = 'file'; f.accept = 'image/*'; f.hidden = true;
      const img = K.el('img', 'qz-thumb'); img.alt = ''; img.hidden = true;
      const status = K.el('span', 'game-field-hint');
      const choose = K.button(q.image ? STR.picAgain : STR.pic, 'btn-ghost', function () { f.click(); });
      const gone = K.button(STR.picGone, 'btn-ghost', function () { if (q.image) C.store.deletePicture(q.image.id); delete q.image; img.hidden = true; gone.hidden = true; choose.textContent = STR.pic; save(); });
      gone.hidden = !q.image;
      const show = function (id) {
        if (thumbs.has(id)) { img.src = thumbs.get(id); img.hidden = false; return; }
        C.store.getPicture(id).then(function (bl) { if (!bl) return; const u = URL.createObjectURL(bl); thumbs.set(id, u); img.src = u; img.hidden = false; });
      };
      if (q.image) show(q.image.id);
      f.addEventListener('change', function () {
        const file_ = f.files && f.files[0]; f.value = '';
        if (!file_) return;
        status.textContent = STR.picMaking;
        C.resizeImage(file_).then(function (r) {
          return C.store.putPicture(r.blob, { width: r.width, height: r.height }).then(function (id) {
            if (q.image) C.store.deletePicture(q.image.id);
            q.image = { id: id };
            status.textContent = r.width + ' × ' + r.height + ' px, ' + Math.round(r.blob.size / 1024) + ' KB, kept on this device.';
            choose.textContent = STR.picAgain; gone.hidden = false;
            show(id); save();
          });
        }).catch(function () { status.textContent = 'That file could not be opened as a picture.'; });
      });
      const row = K.el('div', 'game-row'); row.appendChild(choose); row.appendChild(gone);
      box.appendChild(img); box.appendChild(row); box.appendChild(status); box.appendChild(f);
      return box;
    }
    /* drag a question by its handle (mouse, touch or pen) */
    function dragOn(handle, li) {
      handle.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        try { handle.setPointerCapture(e.pointerId); } catch (err) { /* old browser */ }
        li.classList.add('is-dragging');
        let moved = false;
        const move = function (ev) {
          if (ev.clientY < 60) window.scrollBy(0, -12); else if (ev.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
          const over = document.elementFromPoint(ev.clientX, ev.clientY);
          if (!over) return;
          const target = over.closest('.qz-q');
          if (target && target !== li && roundsBox.contains(target)) {
            const r = target.getBoundingClientRect();
            target.parentNode.insertBefore(li, ev.clientY > r.top + r.height / 2 ? target.nextSibling : target);
            moved = true;
          } else {
            const list = over.closest('.qz-qs');
            if (list && roundsBox.contains(list) && !list.querySelector('.qz-q:not(.is-dragging)')) { list.appendChild(li); moved = true; }
          }
        };
        const up = function () {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', up);
          handle.removeEventListener('pointercancel', up);
          li.classList.remove('is-dragging');
          if (!moved) return;
          const lists = roundsBox.querySelectorAll('.qz-qs');
          quiz().rounds.forEach(function (r, i) { r.questions = Array.from(lists[i].children).map(function (x) { return qOf.get(x); }).filter(Boolean); });
          save(); renderBuild();
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
        handle.addEventListener('pointercancel', up);
      });
    }

    /* ----- Host ----- */
    const host = panes[1];
    const hostSetup = K.el('section', 'game-panel qz-setup');
    const hostLive = K.el('section', 'game-panel qz-live'); hostLive.hidden = true;
    host.appendChild(hostSetup); host.appendChild(hostLive);
    const phonesBox = K.el('section', 'game-panel qz-phones');
    phonesBox.appendChild(K.el('h2', null, STR.phonesH));
    phonesBox.appendChild(K.el('p', 'game-msg', STR.phonesHint));
    const phonesB = K.button(STR.usePhones, 'btn-ghost qz-use-phones', function () {
      phonesB.disabled = true;
      phonesHost().then(function () {
        phones = window.GamePhones.quiz({
          C: C, game: function () { return game; }, view: function () { return view; },
          quizTitle: function () { return (rec && rec.quiz && rec.quiz.title) || STR.untitled; },
          teams: function () { return game ? game.teams().map(function (t) { return t.name; }) : hostOpts().teams; },
          closest: function () { return !!P.host.closest; }, publish: publish
        });
        phonesBox.textContent = '';
        phonesBox.appendChild(K.el('h2', null, STR.phonesH));
        phonesBox.appendChild(phones.el);
        root.quizMaker.phones = phones;
        publish();
      }).catch(function () { phonesB.disabled = false; say(STR.phonesFailed, true); });
    });
    phonesBox.appendChild(phonesB);
    phonesBox.appendChild(K.el('p', 'game-msg', STR.phonesPrivacy));
    host.appendChild(phonesBox);
    host.appendChild(stage.bar());

    function hostOpts() {
      return { teams: K.parseList(P.host.teams, { lines: true, max: 20, maxLen: 30 }), joker: !!P.host.joker, closest: !!P.host.closest, defaultPoints: 1 };
    }
    function renderHost() {
      hostSetup.textContent = '';
      hostSetup.appendChild(K.el('h2', null, quiz().title || STR.untitled));
      const teams = K.el('textarea'); teams.rows = 4; teams.value = P.host.teams;
      teams.addEventListener('input', function () { P.host.teams = teams.value; persistPrefs(); });
      hostSetup.appendChild(K.field(STR.teams, teams).wrap);
      const tm = K.el('input'); tm.type = 'number'; tm.min = '5'; tm.max = '600'; tm.inputMode = 'numeric'; tm.value = P.host.timer || '';
      tm.addEventListener('input', function () { P.host.timer = tm.value; persistPrefs(); });
      hostSetup.appendChild(K.field(STR.timerDef, tm).wrap);
      [['closest', STR.closest], ['joker', STR.jokerOn], ['board', STR.toBoard]].forEach(function (x) {
        const c = K.el('input'); c.type = 'checkbox'; c.checked = !!P.host[x[0]];
        c.addEventListener('change', function () { P.host[x[0]] = c.checked; persistPrefs(); });
        const l = K.el('label', 'game-check'); l.appendChild(c); l.appendChild(document.createTextNode(x[1]));
        hostSetup.appendChild(l);
      });
      const errs = K.el('div', 'qz-check');
      const row = K.el('div', 'game-row');
      row.appendChild(K.button(STR.start, 'btn-primary game-big', function () { startGame(null); }));
      if (P.game && P.game.id === rec.id && P.game.state) row.appendChild(K.button(STR.resume, 'btn-ghost', function () { startGame(P.game.state); }));
      hostSetup.appendChild(row);
      hostSetup.appendChild(errs);
      hostSetup.hidden = !!game;
      hostLive.hidden = !game;
      if (game) renderLive();
    }
    function startGame(saved) {
      K.sound.unlock();
      const v = C.validate(quiz());
      const errs = hostSetup.querySelector('.qz-check');
      errs.textContent = '';
      if (!v.ok) {
        errs.appendChild(K.el('p', 'game-msg is-warn', STR.fixFirst));
        const ul = K.el('ul', 'qz-errors'); v.errors.slice(0, 8).forEach(function (e) { ul.appendChild(K.el('li', null, e)); }); errs.appendChild(ul);
        return;
      }
      const o = hostOpts();
      const live = !!(phones && phones.live);
      if (live && phones.solo) o.teams = [];
      else if (o.teams.length < 1) o.teams = ['Team 1', 'Team 2'];
      /* with phones every question has a time limit and right answers earn the speed bonus */
      if (live) { o.speed = true; o.speedMax = 0.5; }
      game = C.createGame(live ? phones.timed(quiz(), P.host.timer) : quiz(), Object.assign(o, { rand: K.randInt }), saved);
      if (live) phones.start(); else if (phones) phones.stop();
      intro = !saved && game.current().qi === 0;
      showScores = false;
      view = intro ? 'round' : 'question';
      if (saved) view = game.phase === 'reveal' ? 'reveal' : game.phase === 'end' ? 'end' : 'question';
      K.wakeLock(true);
      keepGame();
      renderHost();
      publish();
    }
    function keepGame() { P.game = game ? { id: rec.id, state: game.toJSON() } : null; persistPrefs(); }
    function secsFor(pq) { return pq.time || (Number(P.host.timer) >= 5 ? Number(P.host.timer) : 0); }
    let lastTickSec = -1, tickRaf = 0;
    function hostTimer() {
      cancelAnimationFrame(tickRaf);
      if (!game || view !== 'question') return;
      const pq = game.publicQuestion(), secs = secsFor(pq);
      if (!secs) return;
      const endsAt = pq.shownAt + secs * 1000;
      const loop = function () {
        const left = endsAt - C.now();
        const sec = Math.ceil(left / 1000);
        const tEl = hostLive.querySelector('.qz-pres-timer');
        if (tEl) tEl.textContent = left > 0 ? sec + ' s' : STR.tvTimeUp;
        if (sec !== lastTickSec) {
          lastTickSec = sec;
          if (left > 0 && sec <= 5) K.sound.tick();
          if (left <= 0) { K.sound.buzz(); return; }
        }
        if (left > 0) tickRaf = requestAnimationFrame(loop);
      };
      lastTickSec = -1;
      tickRaf = requestAnimationFrame(loop);
    }
    function publish() {
      const out = function (st) { stage.update(phones ? phones.decorate(st, view) : st); };
      if (!game) { out({ view: 'idle' }); return; }
      if (showScores || view === 'end') { out({ view: view === 'end' ? 'end' : 'scores', scores: scoresList() }); return; }
      const pq = game.publicQuestion();
      if (view === 'round') { out({ view: 'round', roundNo: pq.roundNo, round: pq.round }); return; }
      const st = { view: view, meta: STR.roundQ(pq), prompt: pq.prompt, type: pq.type, options: pq.options || null, image: pq.image ? pq.image.id : null };
      if (view === 'question') { const secs = secsFor(pq); if (secs) { st.secs = secs; st.endsAt = pq.shownAt + secs * 1000; } }
      if (view === 'reveal') {
        const q = game.current().q, info = game.revealInfo();
        st.answer = info.answer; st.note = info.note;
        st.answerIndex = q.type === 'mcq' ? q.options.indexOf(q.answer) : q.type === 'tf' ? (q.answer ? 0 : 1) : null;
        if (q.type === 'order') { st.options = q.answer.slice(); st.answerIndex = null; }
      }
      out(st);
    }
    function scoresList() { return game.standings().map(function (t) { return { name: t.name, score: t.score, rank: t.rank, joker: t.joker !== null, i: game.teams().findIndex(function (x) { return x.name === t.name; }) }; }); }
    function sendBoard(team, delta) {
      if (!P.host.board || !delta) return;
      C.sendPoints(team, delta, game.teams().findIndex(function (t) { return t.name === team; }) + 1);
    }
    function doReveal() {
      if (!game || view === 'end') return;
      if (view === 'round') { showQuestion(); return; }
      cancelAnimationFrame(tickRaf);
      const pq = game.publicQuestion();
      hostLive.querySelectorAll('.qz-their').forEach(function (inp) {
        if (inp.value.trim()) game.submit({ team: inp.dataset.team, value: inp.value, at: pq.shownAt });
      });
      const before = game.teams().map(function (t) { return t.score; });
      game.reveal();
      if (phones) phones.reveal();
      game.teams().forEach(function (t, i) { sendBoard(t.name, t.score - before[i]); });
      view = 'reveal'; showScores = false;
      K.sound.ding();
      keepGame(); renderLive(); publish();
      K.announce(root, STR.revealed);
    }
    function showQuestion() { intro = false; view = 'question'; game.restartTimer(); keepGame(); renderLive(); publish(); }
    function step(dir) {
      if (!game) return;
      cancelAnimationFrame(tickRaf);
      showScores = false;
      if (dir > 0) {
        if (view === 'round') { showQuestion(); return; }
        if (!game.next()) { view = 'end'; K.sound.fanfare(); K.announce(root, STR.ended); keepGame(); renderLive(); publish(); return; }
      } else {
        if (view === 'end') { game.prev(); view = 'reveal'; keepGame(); renderLive(); publish(); return; }
        if (!game.prev()) return;
      }
      const c = game.current();
      view = game.phase === 'reveal' ? 'reveal' : (dir > 0 && c.qi === 0 ? 'round' : 'question');
      keepGame(); renderLive(); publish();
    }
    function toggleTeam(name) {
      if (!game || view === 'round' || view === 'end') return;
      const on = !game.marked(name);
      const d = game.mark(name, on);
      sendBoard(name, d);
      keepGame(); renderLive(); if (showScores) publish();
      K.announce(root, STR.marked(name, on ? d : 0));
    }
    function renderLive() {
      hostLive.textContent = '';
      if (!game) return;
      const pq = game.publicQuestion(), q = game.current().q, info = game.revealInfo();
      const head = K.el('div', 'qz-pres-head');
      head.appendChild(K.el('p', 'game-msg', view === 'end' ? STR.tvFinal : STR.roundQ(pq) + ' · ' + STR.of(pq.overall, pq.total)));
      head.appendChild(K.el('span', 'qz-pres-timer', ''));
      hostLive.appendChild(head);
      if (view !== 'end') {
        hostLive.appendChild(K.el('p', 'qz-pres-q', pq.prompt));
        if (pq.options) hostLive.appendChild(K.el('p', 'game-msg', pq.options.map(function (o, i) { return (q.type === 'order' ? (i + 1) + '. ' : 'ABCDEF'[i] + '. ') + o; }).join('   ')));
        const ans = K.el('div', 'qz-pres-ans' + (view === 'reveal' ? ' is-shown' : ''));
        ans.appendChild(K.el('strong', null, STR.answerIs + ': '));
        ans.appendChild(document.createTextNode(info.answer));
        if (info.note) ans.appendChild(K.el('p', 'game-field-hint', STR.noteIs + ': ' + info.note));
        hostLive.appendChild(ans);
      }
      const ctr = K.el('div', 'game-row qz-pres-ctl');
      ctr.appendChild(K.button(STR.back, 'btn-ghost', function () { step(-1); }));
      if (view === 'round') ctr.appendChild(K.button(STR.showQ, 'btn-primary game-big', showQuestion));
      else if (view === 'question') ctr.appendChild(K.button(STR.reveal, 'btn-primary game-big', doReveal));
      if (view !== 'end') ctr.appendChild(K.button(game.pos + 1 >= game.length && view === 'reveal' ? STR.finish : STR.next, view === 'reveal' ? 'btn-primary game-big' : 'btn-ghost', function () { step(1); }));
      ctr.appendChild(K.button(showScores ? STR.hideScores : STR.scores, 'btn-ghost', function () { showScores = !showScores; renderLive(); publish(); }));
      if (view === 'question' && secsFor(pq)) ctr.appendChild(K.button(STR.timerAgain, 'btn-ghost', function () { game.restartTimer(); keepGame(); publish(); hostTimer(); }));
      hostLive.appendChild(ctr);

      const tl = K.el('div', 'qz-teams');
      const teams = game.teams();
      teams.forEach(function (t, i) {
        const row = K.el('div', 'qz-teamrow');
        row.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
        row.appendChild(K.el('span', 'qz-team-name', t.name));
        row.appendChild(K.el('span', 'qz-team-score', String(t.score)));
        if (view === 'question' && q.type !== 'mcq' && q.type !== 'tf') {
          const their = K.el('input', 'qz-their'); their.type = 'text'; their.dataset.team = t.name; their.placeholder = STR.theirAns;
          their.setAttribute('aria-label', t.name + ': ' + STR.theirAns);
          row.appendChild(their);
        }
        if (view === 'question' || view === 'reveal') {
          const on = game.marked(t.name);
          const b = K.button((i < 9 ? (i + 1) + '  ' : '') + (on ? '✓ ' + STR.right : STR.notRight), 'btn-ghost qz-mark' + (on ? ' is-on' : ''), function () { toggleTeam(t.name); });
          b.setAttribute('aria-pressed', String(on));
          b.setAttribute('aria-label', t.name + ': ' + (on ? STR.right : STR.notRight));
          row.appendChild(b);
        }
        if (P.host.joker) {
          const js = K.el('select'); js.setAttribute('aria-label', t.name + ': ' + STR.joker);
          const o0 = K.el('option', null, STR.jokerNone); o0.value = ''; js.appendChild(o0);
          quiz().rounds.forEach(function (r, ri) { const o = K.el('option', null, '★ ' + STR.round(ri + 1)); o.value = String(ri); js.appendChild(o); });
          js.value = t.joker === null ? '' : String(t.joker);
          js.addEventListener('change', function () {
            const res = game.playJoker(t.name, js.value === '' ? null : Number(js.value));
            if (!res.ok) { js.value = t.joker === null ? '' : String(t.joker); say(STR.jokerLocked, true); return; }
            sendBoard(t.name, res.delta);
            keepGame(); renderLive(); if (showScores) publish();
            if (js.value !== '') K.announce(root, STR.jokerSet(t.name, STR.round(Number(js.value) + 1)));
          });
          row.appendChild(js);
        }
        tl.appendChild(row);
      });
      hostLive.appendChild(tl);
      if (phones && phones.live) hostLive.appendChild(phones.statusEl);
      hostLive.appendChild(K.button(STR.endGame, 'btn-ghost', function () { game = null; if (phones) phones.stop(); keepGame(); cancelAnimationFrame(tickRaf); K.wakeLock(false); renderHost(); publish(); }));
      hostTimer();
    }
    document.addEventListener('keydown', function (e) {
      if (!game || P.tab !== 1 || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
      if (t && t.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
      if (!host.contains(t) && t !== document.body && !(t && t.closest && t.closest('.game-stage'))) return;
      if (hostKey(e.key)) e.preventDefault();
    });
    function hostKey(key) {
      if (key === 'r' || key === 'R') { doReveal(); return true; }
      if (key === 'Enter' && view === 'round') { showQuestion(); return true; }
      if (key === 'ArrowRight') { step(1); return true; }
      if (key === 'ArrowLeft') { step(-1); return true; }
      if (key === 's' || key === 'S') { showScores = !showScores; renderLive(); publish(); return true; }
      if ((key === 't' || key === 'T') && view === 'question') { game.restartTimer(); keepGame(); publish(); hostTimer(); return true; }
      if (/^[1-9]$/.test(key)) { const tm = game.teams()[Number(key) - 1]; if (tm) { toggleTeam(tm.name); return true; } }
      return false;
    }
    stage.onKey = function (key) { if (game) hostKey(key); };

    /* ----- Print ----- */
    const pp = panes[2];
    const pPanel = K.el('section', 'game-panel');
    const pRow = K.el('div', 'game-row');
    [['questions', STR.printQ], ['answers', STR.printA], ['key', STR.printK]].forEach(function (x) {
      pRow.appendChild(K.button(x[1], 'btn-ghost', function () { doPrint(x[0]); }));
    });
    pPanel.appendChild(pRow);
    pPanel.appendChild(K.el('p', 'game-msg', STR.printHint));
    pp.appendChild(pPanel);
    function doPrint(kind) {
      const ids = C.pictureIds(quiz());
      Promise.all(ids.map(function (id) { return C.store.getPicture(id).then(function (b) { return [id, b]; }); })).then(function (pairs) {
        const pics = {};
        const urls = [];
        pairs.forEach(function (p) { if (p[1]) { pics[p[0]] = URL.createObjectURL(p[1]); urls.push(pics[p[0]]); } });
        const old = document.querySelector('.qz-print'); if (old) old.remove();
        const box = printDoc(quiz(), kind, pics);
        document.body.appendChild(box);
        document.documentElement.classList.add('qz-printing');
        const imgs = Array.from(box.querySelectorAll('img'));
        Promise.all(imgs.map(function (im) { return im.complete ? null : new Promise(function (r) { im.onload = im.onerror = r; }); })).then(function () {
          const done = function () {
            window.removeEventListener('afterprint', done);
            document.documentElement.classList.remove('qz-printing');
            box.remove(); urls.forEach(URL.revokeObjectURL);
          };
          window.addEventListener('afterprint', done);
          window.print();
        });
      });
    }

    function setTab(i) {
      P.tab = i; persistPrefs();
      tabB.forEach(function (b, j) { b.setAttribute('aria-pressed', String(i === j)); });
      panes.forEach(function (p, j) { p.hidden = i !== j; });
      if (i === 1) renderHost();
    }

    /* ----- start ----- */
    C.store.persistent().then(function (ok) {
      persistent = ok;
      return P.current ? C.store.getQuiz(P.current) : null;
    }).then(function (r) {
      /* a landing page opens its own quiz: the one already started from it
         (same title), or a fresh one; the visitor's other quizzes stay listed */
      if (preset.title) {
        if (r && r.quiz.title === preset.title) { useRec(r, true); return; }
        return C.store.listQuizzes('quiz').then(function (list) {
          const mine = list.filter(function (x) { return x.title === preset.title; })[0];
          if (mine) return C.store.getQuiz(mine.id).then(function (x) { useRec(x, true); });
          return newQuiz(preset.title, preset.rounds);
        });
      }
      if (r) { useRec(r, true); return; }
      return C.store.listQuizzes('quiz').then(function (list) {
        if (list.length) return C.store.getQuiz(list[0].id).then(function (x) { useRec(x, true); });
        return newQuiz(preset.title, preset.rounds);
      });
    }).then(function () {
      setTab(preset.title ? 0 : (P.tab | 0));
      checkShared();
      publish();
    });
    pick.addEventListener('change', function () { C.store.getQuiz(pick.value).then(function (r) { if (r) { game = null; useRec(r); } }); });
    window.addEventListener('hashchange', checkShared);
    root.quizMaker = { phones: null, get game() { return game; }, get quiz() { return rec && rec.quiz; }, get id() { return rec && rec.id; }, flush: function () { clearTimeout(saveT); return C.store.putQuiz(rec); } };
  }

  window.GAME_TOOLS[SLUG].maths = { printDoc: printDoc, promptSize: promptSize };

  document.addEventListener('DOMContentLoaded', function () {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K || !C) return;
    let host = null;
    const stage = K.stage({
      slug: SLUG,
      title: 'Quiz',
      render: renderStage,
      onCommand: function (m) { if (m && m.type === 'key' && host && host.onKey) host.onKey(m.key); }
    });
    if (stage.isStage) return;
    host = stage;
    mount(root, stage);
  });
})();
