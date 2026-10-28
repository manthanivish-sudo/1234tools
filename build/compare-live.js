/**
 * Comparisons, third batch: the live and party tools.
 *
 * Same shape and the same three rules as build/compare.js; build-compare.js
 * polices every page here exactly as it polices the others (no disparaging
 * word, no currency amount anywhere, at least three points in the gap, a
 * table whose first row is one the paid side wins). compare-extra.js
 * concatenates this list onto its own.
 *
 * No product is named. Each page compares against a CATEGORY of paid
 * software -- live polling and presentation software, classroom quiz games,
 * audience question tools, tambola and bingo software -- because we have
 * tested none of them and will not describe one from memory. What is said of
 * the category is hedged ("commonly", "often") and sends the reader to the
 * vendor for the facts. Every claim on OUR side was checked on 2026-10-28
 * against the tool's own engine and FAQ: engine/room-live-poll.js,
 * room-word-cloud.js, room-rating-scale.js, room-audience-qa.js,
 * room-live-presentation.js, game-phones.js, game-tambola-*.js.
 *
 * The phone limit is worded exactly as the tools word it ("During the launch
 * trial a free session takes up to 1,000 phones"), and the privacy text is
 * the approved text, verbatim.
 */
'use strict';

const REF = {};
const COMPETITORS = [];

const PRIVACY = 'Answers pass through our server only to reach the presenter’s screen. They are held in memory for the room’s life and deleted when it closes (24 hours at most). No accounts, no cookies, no analytics for participants.';
const TRIAL = 'During the launch trial a free session takes up to 1,000 phones.';

const COMPARISONS = [

  /* ================================================================== */
  {
    slug: 'free-live-polling-software',
    glyph: 'i-live-poll',
    name: 'Free live polling software',
    crumb: 'Free live polling software',
    title: 'Free live polling software: votes, word clouds and ratings from phones, and what paid products still do better',
    lede: 'Ask a multiple-choice question, a rating or a word-cloud prompt and watch answers arrive from the audience’s phones: they join at 1234tools.com/join with a six-digit code, with no app and no account. Free, with a launch-trial cap on phones and no saved history. What paid polling products add is set out first.',
    honest: [
      'Live polling software does one job: the presenter asks, the room answers on phones, and the totals appear on the big screen. The tools here do that job for multiple-choice polls, word clouds, 0-to-10 and star ratings, open answers and timed quiz questions, and they can be strung into one prepared deck with Live Presentation. Nothing needs installing, nobody signs in, and the presenter can export every result as a CSV file.',
      'We compare against the category, not a product: we have not tested any particular polling service and will not describe one from memory. What follows is what the category commonly offers that we do not, said plainly before anything else, and the limits of the free tools in the table. Check a vendor’s own page for its current features and limits.'
    ],
    gap: {
      heading: 'What paid polling software does that we do not',
      intro: 'These are things the category commonly offers. They are the reasons a company, a school district or a conference organiser pays rather than uses a free tool.',
      points: [
        { h: 'It keeps your sessions for you.', p: 'A paid product typically has an account where past polls, results and audiences live, so last term’s results are one click away. Here nothing is stored on our side: a deck is saved in the presenter’s own browser, and results survive only if the presenter presses Export CSV before ending the session.' },
        { h: 'It sits inside the slides you already have.', p: 'Many paid products add polls to a slide deck made in other software, so the poll appears in the middle of the presentation. Live Presentation is its own deck: you write its slides in it (multiple choice, quiz, open answers, word cloud, rating, Q&A, leaderboard, a heading), and it does not import slides made elsewhere.' },
        { h: 'It takes bigger rooms, on a plan.', p: 'Paid plans commonly advertise audience sizes and event support. ' + TRIAL + ' When it is full, the next phone is told the session is full. Check a vendor’s own limit for a room larger than that.' },
        { h: 'It knows who answered.', p: 'Accounts, rosters and logins let a paid product tie answers to named people and report on them over a term. Here people join with a nickname, and the presenter’s page cannot tell you who a nickname really is.' },
        { h: 'It integrates and reports.', p: 'Links to learning platforms, calendars and spreadsheets, and dashboards across many sessions, are common in paid products. Here the report is a CSV file made in the presenter’s browser, one per session.' },
        { h: 'It comes with support and a service promise.', p: 'A paid plan usually comes with a named support route and an uptime commitment. These tools are free, in a launch trial, and carry no such promise.' }
      ]
    },
    table: {
      us: 'Here, free, no sign-up',
      them: 'Paid polling software',
      rows: [
        { edge: 'them', need: 'Past sessions kept in an account', us: 'No. Nothing is stored by us; export the CSV before you end the session.', them: 'Commonly included, with history across sessions.' },
        { edge: 'them', need: 'Polls inside slides made in other software', us: 'No. You build the deck in Live Presentation, which does not import slides.', them: 'Commonly offered as an add-in.' },
        { edge: 'them', need: 'A very large audience', us: TRIAL + ' The next phone is told the session is full.', them: 'Depends on the plan; the vendor states the limit.' },
        { edge: 'them', need: 'Knowing who answered', us: 'No. Nicknames only; the presenter’s screen shows totals, not who voted for what.', them: 'Possible where participants sign in.' },
        { edge: 'them', need: 'Integrations and cross-session dashboards', us: 'No. One CSV per session, made in your browser.', them: 'Commonly included on paid plans.' },
        { edge: 'them', need: 'A support route and a service promise', us: 'No. Free and in a launch trial.', them: 'Usually part of the plan.' },
        { edge: 'us', need: 'Getting the audience in', us: 'Open 1234tools.com/join, type a six-digit code (or scan the QR code), choose a nickname. No app, no account.', them: 'Also web-based; whether participants must sign in varies.' },
        { edge: 'us', need: 'Question types', us: 'Multiple choice (2 to 10 answers), word cloud (one to three words, up to 25 characters), rating (stars, 0 to 10 buttons or a slider), open answers, timed quiz, Q&A.', them: 'Varies by product and plan.' },
        { edge: 'us', need: 'Keeping the room honest', us: 'Results can stay hidden until you press Reveal; one vote per phone, and a reconnecting phone keeps the same vote; rude words are masked in the word cloud.', them: 'Commonly offered.' },
        { edge: 'us', need: 'Keeping the results', us: 'Export CSV: every question’s totals, typed answers and quiz scores by nickname, made in your browser.', them: 'Reports in the account.' },
        { edge: 'us', need: 'Where the data goes', us: PRIVACY, them: 'Depends on the vendor; read its privacy page before you ask a room for answers.' },
        { edge: 'us', need: 'Cost and sign-up for you', us: 'Free, and the presenter needs no account either.', them: 'A plan, usually with an account. The vendor has the current terms; we will not guess at them.' }
      ]
    },
    buy: {
      heading: 'When you should pay for polling software',
      intro: 'If polling is a regular part of your work rather than an occasional session, one of the paid products is probably the right answer.',
      points: [
        'You run sessions for audiences larger than the launch-trial cap of 1,000 phones, or need a service promise for a conference.',
        'You need to know which named person answered what, over a term or a programme, and report on it.',
        'The polls must sit inside a deck that is made in other software and presented from there.',
        'You want past sessions, audiences and reports kept for you in an account, without remembering to export a file.',
        'You need integrations with a learning platform or a spreadsheet, or a named support contact.'
      ]
    },
    freeBlurb: 'The live tools need an internet connection on the presenter’s laptop and on every phone. Answers pass through our relay only to reach the presenter’s screen and are deleted when the session closes (24 hours at most). The tools after the live ones need no connection once opened.',
    groups: [
      { name: 'Ask the room', blurb: 'One question at a time, answered on phones, with the totals on the big screen.', tools: ['/live/live-poll/', '/live/word-cloud/', '/live/rating-scale/', '/live/audience-qa/'] },
      { name: 'A prepared deck with one code', blurb: 'Questions, a timed quiz, a word cloud and Q&A in one session; phones join once and follow every slide.', tools: ['/live/live-presentation/', '/live/interactive-meeting-presentation/', '/live/quiz-night-with-phones/'] },
      { name: 'For a class or a meeting', blurb: 'The same tools, set up for the room you are in.', tools: ['/live/live-poll-for-classroom/', '/live/classroom-understanding-check/', '/live/word-cloud-for-classroom/', '/live/live-poll-for-meetings/', '/live/word-cloud-for-team-meeting/', '/live/rate-a-session-live/'] }
    ],
    faq: [
      { q: 'How many people can answer?', a: TRIAL + ' When it is full, the next phone is told the session is full.' },
      { q: 'Do people need an app or an account?', a: 'No. They open 1234tools.com/join in their phone’s browser, type the six-digit code (or scan the QR code) and choose a nickname. The presenter needs no account either.' },
      { q: 'Who sees the answers, and what does your server keep?', a: PRIVACY + ' The counting is done in the presenter’s browser.' },
      { q: 'Does it work without an internet connection?', a: 'No. The votes travel from the phones to the presenter’s screen through our relay, so the presenter’s laptop and every phone need a connection. A session also ends by itself: a room is deleted when it closes, and at the latest after 24 hours.' },
      { q: 'Can I keep the results?', a: 'Yes. Export CSV saves every question in the session: votes and percentages, typed answers, word counts, ratings and quiz scores by nickname. The file is made in your browser, and nothing is kept by us once the session ends.' },
      { q: 'Can someone vote twice?', a: 'Not from the same phone. A second vote from the same phone connection replaces the first, or is refused if you turned changing votes off. A different phone or browser counts as a different person, so this is not an identity check.' }
    ],
    guides: ['run-a-live-poll'],
    collections: ['teachers', 'schools', 'small-business'],
    sources: null
  },

  /* ================================================================== */
  {
    slug: 'free-classroom-quiz-game-with-phones',
    glyph: 'i-quiz-maker',
    name: 'Free classroom quiz game with phones',
    crumb: 'Free classroom quiz game with phones',
    title: 'Free classroom quiz game with phones: a timed quiz, a podium, no sign-up, and what paid quiz platforms still do better',
    lede: 'Write a quiz, show it on the board, and let the class answer on their own phones or tablets: speed points, the top five after each question and a podium at the end. Free, no accounts, with a launch-trial cap on phones. What paid quiz platforms add is set out first.',
    honest: [
      'A classroom quiz game asks a question on the board, the pupils answer on devices, and the points decide a winner. Two tools here do that. Live Presentation runs a timed quiz inside a prepared deck, with a right answer worth 1000 points if it arrives at once and falling evenly to 500 at the deadline, equal points ranked by total answer time, the top five after each question and a podium with confetti at the end. Quiz Maker hosts a quiz on the TV and can let players answer on their phones, singly or in teams.',
      'We compare against the category — paid quiz and classroom-game platforms — and not a product: we have not tested any and will not describe one from memory. These are the things the category commonly offers that we do not, followed by the limits of the free tools. A vendor’s own page is the place for its current features.'
    ],
    gap: {
      heading: 'What paid quiz platforms do that we do not',
      intro: 'These are commonly the reasons a school or a training company pays for a quiz platform rather than using a free tool.',
      points: [
        { h: 'It has accounts, classes and reports over a term.', p: 'Paid platforms typically tie answers to named pupils in a class and chart progress across weeks. Here pupils join with a nickname, and the only record is the CSV the teacher exports at the end of a session.' },
        { h: 'It offers a huge library of ready-made questions.', p: 'Large shared question banks are common in the category. We have ready-made packs for Quiz Maker, written for this site, and you write your own in Live Presentation; there is no searchable library of other teachers’ quizzes.' },
        { h: 'It runs self-paced homework.', p: 'Many platforms let pupils work through a quiz alone, in their own time, with the results waiting for the teacher. Both tools here are live: the teacher advances the questions, and a room closes when the session ends (24 hours at most).' },
        { h: 'It connects to the school’s learning platform.', p: 'Roster import and grade return are commonly offered. Nothing here connects to another system; results leave as a CSV file.' },
        { h: 'It has avatars, music and a lot of polish.', p: 'Commercial game platforms invest heavily in animation and rewards. Here the big screen is plain, with a podium and confetti at the end of a quiz.' },
        { h: 'It marks every kind of answer for you.', p: 'In Live Presentation a quiz question is multiple choice and is scored by speed; open answers are collected but not marked. Quiz Maker can mark a typed answer you enter for a team, ignoring case, accents and punctuation, but it is the teacher who types it in.' }
      ]
    },
    table: {
      us: 'Here, free, no sign-up',
      them: 'A paid quiz platform',
      rows: [
        { edge: 'them', need: 'Progress by named pupil across a term', us: 'No. Nicknames only; one CSV per session.', them: 'Commonly included, with class lists and reports.' },
        { edge: 'them', need: 'A large library of ready-made questions', us: 'No. Quiz Maker has ready-made packs; in Live Presentation you write your own questions.', them: 'Commonly a large searchable library.' },
        { edge: 'them', need: 'Self-paced homework quizzes', us: 'No. Both tools are live, run by the teacher.', them: 'Commonly offered.' },
        { edge: 'them', need: 'Connection to a learning platform', us: 'No. Results export as a CSV file.', them: 'Commonly offered on paid plans.' },
        { edge: 'them', need: 'A very large audience', us: TRIAL + ' The next phone is told the session is full.', them: 'Depends on the plan; the vendor states the limit.' },
        { edge: 'us', need: 'Getting the class in', us: 'Open 1234tools.com/join, type the six-digit code (or scan the QR code), choose a nickname. No app, no account, no email address.', them: 'Also web-based; whether pupils sign in varies.' },
        { edge: 'us', need: 'Scoring', us: 'Live Presentation: 1000 points for an instant right answer falling evenly to 500 at the deadline, measured by our relay, so a slow phone clock makes no difference; wrong or no answer scores 0.', them: 'Varies; the vendor explains its own.' },
        { edge: 'us', need: 'The finish', us: 'After each answer the big screen shows the top five; at the end a podium, with “You won!” on the winner’s phone and every other phone showing its place.', them: 'Commonly a leaderboard.' },
        { edge: 'us', need: 'Teams', us: 'Quiz Maker: choose Teams, and a team’s first answer from its phones is the team’s answer. Live Presentation: use one phone per team and the team name as the nickname.', them: 'Commonly offered.' },
        { edge: 'us', need: 'Picture rounds and printing', us: 'Quiz Maker has picture questions and prints question and answer sheets, so the same quiz works with no phones at all.', them: 'Varies.' },
        { edge: 'us', need: 'Where the answers go', us: PRIVACY, them: 'Depends on the vendor; read its privacy page before you ask pupils to log in.' },
        { edge: 'us', need: 'Cost and sign-up for you', us: 'Free, and the teacher needs no account.', them: 'A plan, usually with an account. The vendor has the current terms; we will not guess at them.' }
      ]
    },
    buy: {
      heading: 'When you should pay for a quiz platform',
      intro: 'If quizzing is part of how a school or a company measures learning, one of the paid platforms is probably the right answer.',
      points: [
        'You need results by named pupil across a term, and reports for a head of department or a parent.',
        'You want homework quizzes pupils complete on their own, at home.',
        'You want a ready-made library of questions for every topic, shared across a staff room.',
        'The school’s learning platform has to receive the grades, or the class list has to come in from it.',
        'You run sessions for more than the launch-trial cap of 1,000 phones, or need a vendor with a service promise.'
      ]
    },
    freeBlurb: 'Playing with phones needs an internet connection on the teacher’s computer and on every phone. A quiz without phones, on the board only, does not. Answers pass through our relay only to reach the presenter’s screen and are deleted when the room closes (24 hours at most).',
    groups: [
      { name: 'Run a quiz with phones', blurb: 'Questions on the board, answers from the class’s phones, points and a podium.', tools: ['/live/live-presentation/', '/live/live-quiz-for-classroom/', '/games/quiz-maker/', '/live/quiz-night-with-phones/'] },
      { name: 'Buzzers, scores and teams', blurb: 'For a quick-fire round, a house competition or a revision game.', tools: ['/games/quiz-buzzer/', '/games/quiz-night-scoreboard/', '/games/team-generator/', '/games/classroom-points-tracker/'] },
      { name: 'Check understanding, not just recall', blurb: 'Quick questions, ratings and word clouds, with the answers hidden until you reveal them.', tools: ['/live/classroom-understanding-check/', '/live/live-poll-for-classroom/', '/live/word-cloud-for-classroom/'] }
    ],
    faq: [
      { q: 'How many pupils can play at once?', a: TRIAL + ' When it is full, the next phone is told the session is full.' },
      { q: 'Do pupils need an account, an app or an email address?', a: 'No. They open 1234tools.com/join in their phone’s browser, type the six-digit code (or scan the QR code) and choose a nickname. The teacher needs no account either.' },
      { q: 'What happens to the pupils’ answers?', a: PRIVACY },
      { q: 'How are the points worked out in Live Presentation?', a: 'A right answer scores 1000 points if it arrives at once, falling evenly to 500 at the deadline; a wrong answer or no answer scores 0. The time is measured by our relay when the answer arrives. Players on equal points are ranked by the total time their right answers took, fastest first.' },
      { q: 'Can I run the quiz with no phones?', a: 'Yes, with Quiz Maker: host it on the board, enter each team’s answer, and print question and answer sheets. Phones are optional there.' },
      { q: 'Does it work without internet?', a: 'Not with phones. The quiz travels to the phones and the answers come back through our relay, so the teacher’s computer and every phone need a connection. Quiz Maker without phones opens offline after the first visit.' }
    ],
    guides: ['host-a-family-quiz-night', 'run-a-live-poll'],
    collections: ['teachers', 'schools', 'families'],
    sources: null
  },

  /* ================================================================== */
  {
    slug: 'free-audience-qa-tool',
    glyph: 'i-audience-qa',
    name: 'Free audience Q&A tool for events',
    crumb: 'Free audience Q&A tool',
    title: 'Free audience Q&A tool for events and meetings: questions from phones, approval and upvotes, and what paid event tools do better',
    lede: 'Take questions from the room on their phones: you approve each one, the audience upvotes, and the most wanted rise to the top of the big screen, or show one large with Spotlight. Free, no sign-up, with a launch-trial cap on phones. What paid event tools add is set out first.',
    honest: [
      'An audience Q&A tool replaces the raised hand and the silence. The audience join at 1234tools.com/join with a six-digit code and a nickname, send questions, and upvote each other’s. The presenter’s page holds every question until it is approved by default, so a rude or off-topic one never reaches the screen, and answered questions drop to the bottom of the board.',
      'We compare against the category — paid event and webinar question tools — and not a product: we have not tested any and will not describe one from memory. These are the things the category commonly offers that we do not, followed by the limits of the free tool. A vendor’s own page is the place for its current features.'
    ],
    gap: {
      heading: 'What paid event Q&A tools do that we do not',
      intro: 'These are commonly the reasons an events team or a communications department pays rather than uses a free tool.',
      points: [
        { h: 'It is built into the event platform.', p: 'Paid event and webinar tools put questions beside the video, the agenda and the registration list. This tool is a separate page next to your slides or video call; the audience join it at 1234tools.com/join.' },
        { h: 'It lets a team moderate together.', p: 'Moderation by several people, with roles, is common in the category. Here approval happens on the presenter’s page.' },
        { h: 'It knows who is asking.', p: 'Registered attendees and verified names come with an event platform. Here people join with a nickname, and you cannot verify who a nickname is; the board can hide nicknames, but your own page still shows them.' },
        { h: 'It keeps events and archives in an account.', p: 'Paid tools keep past events’ questions in an account. Here nothing is stored by us; the presenter exports a CSV before ending the session.' },
        { h: 'It takes bigger audiences, on a plan.', p: 'Plans commonly advertise audience sizes. ' + TRIAL + ' When it is full, the next phone is told the session is full.' },
        { h: 'It comes with a support route and a service promise.', p: 'A paid plan usually comes with a named support route. This tool is free, in a launch trial, and carries no such promise.' }
      ]
    },
    table: {
      us: 'Here, free, no sign-up',
      them: 'A paid event Q&A tool',
      rows: [
        { edge: 'them', need: 'Questions beside the video and the agenda', us: 'No. A separate page next to your slides or call.', them: 'Commonly part of an event platform.' },
        { edge: 'them', need: 'Several moderators with roles', us: 'No. One presenter page approves the questions.', them: 'Commonly offered.' },
        { edge: 'them', need: 'Verified names and registered attendees', us: 'No. Nicknames only.', them: 'Where attendees register or sign in.' },
        { edge: 'them', need: 'Events and archives kept in an account', us: 'No. Export the CSV before you end the session.', them: 'Commonly included.' },
        { edge: 'them', need: 'A very large audience', us: TRIAL + ' The next phone is told the session is full.', them: 'Depends on the plan; the vendor states the limit.' },
        { edge: 'us', need: 'Getting the room in', us: 'Open 1234tools.com/join, type the six-digit code (or scan the QR code), choose a nickname. No app, no account.', them: 'Also web-based; whether attendees sign in varies.' },
        { edge: 'us', need: 'Keeping bad questions off the screen', us: 'Approval is on by default: a question reaches the board and the phones only when you press Approve. “Mask rude words” is also on by default.', them: 'Moderation is commonly offered.' },
        { edge: 'us', need: 'Choosing what is answered first', us: 'One upvote per phone per question. The board puts unanswered questions first, then the most upvoted, then the oldest; answered questions move to the bottom.', them: 'Commonly offered.' },
        { edge: 'us', need: 'Showing one question', us: 'Spotlight puts a single question large on the big screen.', them: 'Commonly offered.' },
        { edge: 'us', need: 'Anonymity on the screen', us: 'Untick “Show nicknames on the big screen” and the board shows the questions alone; your own page still shows the nickname.', them: 'Varies.' },
        { edge: 'us', need: 'Where the questions go', us: PRIVACY, them: 'Depends on the vendor; read its privacy page before you ask a room for questions.' },
        { edge: 'us', need: 'Cost and sign-up for you', us: 'Free, and the presenter needs no account.', them: 'A plan, usually with an account. The vendor has the current terms; we will not guess at them.' }
      ]
    },
    buy: {
      heading: 'When you should pay for an event Q&A tool',
      intro: 'If questions are one part of a larger event that you run again and again, a paid event platform is probably the right answer.',
      points: [
        'The questions must sit beside the video, the agenda and the registration list in one place.',
        'More than one person has to moderate, or the moderators need roles.',
        'You need to know who each attendee is, or to keep past events’ questions in an account.',
        'The audience is larger than the launch-trial cap of 1,000 phones.',
        'You need a named support contact and a service promise on the day.'
      ]
    },
    freeBlurb: 'This tool needs an internet connection on the presenter’s laptop and on every phone. Questions pass through our relay only to reach the presenter’s screen and are deleted when the session closes (24 hours at most).',
    groups: [
      { name: 'Take questions from the room', blurb: 'Approve, upvote, spotlight.', tools: ['/live/audience-qa/', '/live/qa-for-town-hall-meeting/', '/live/wedding-questions-for-the-couple/'] },
      { name: 'Mix it with votes and ratings', blurb: 'One code for the whole session.', tools: ['/live/live-presentation/', '/live/live-poll/', '/live/rating-scale/', '/live/word-cloud/'] }
    ],
    faq: [
      { q: 'Are the questions anonymous?', a: 'People join with a nickname, not their real name. Untick “Show nicknames on the big screen” and the board shows the questions alone; your own page still shows the nickname so you can moderate.' },
      { q: 'Can a rude question reach the screen?', a: 'Not by default. Approval is on: a question waits on your page and reaches the board and the phones only when you press Approve. “Mask rude words” is also ticked by default. You can untick either one.' },
      { q: 'How many people can ask questions?', a: TRIAL + ' When it is full, the next phone is told the session is full.' },
      { q: 'What happens to the questions?', a: PRIVACY },
      { q: 'Does it work without internet?', a: 'No. Questions travel from the phones to the presenter’s screen through our relay, so the presenter’s laptop and every phone need a connection. A room is deleted when it closes, and at the latest after 24 hours.' },
      { q: 'Can I vote twice for a question?', a: 'No. There is one upvote per phone per question, and tapping the arrow again takes it back. Answered questions cannot be voted on.' }
    ],
    guides: ['run-a-live-poll'],
    collections: ['teachers', 'small-business', 'hr-payroll'],
    sources: null
  },

  /* ================================================================== */
  {
    slug: 'free-tambola-housie-software',
    glyph: 'i-tambola-number-caller',
    name: 'Free tambola and housie software',
    crumb: 'Free tambola and housie software',
    title: 'Free tambola (housie) software: tickets, a number caller and claim checking, and what paid game apps still do better',
    lede: 'Make valid tambola tickets in strips of six and print them or send each as a picture, call the numbers 1 to 90 aloud in English or Hindi on a board big enough for the TV, and check any claim from its ticket number. Free, no sign-up, no phones to join. What paid game apps add is set out first.',
    honest: [
      'A tambola game needs three things: tickets, a caller, and a way to settle a claim. The tools here do all three. The ticket generator makes tickets in strips of six that use every number 1 to 90 once; the caller draws each number with your browser’s cryptographic random generator and speaks it; and Check a claim rebuilds a ticket from its printed number and tells you whether the prize is won. The same tickets work for housie and for 90-ball bingo.',
      'We compare against the category — paid tambola and bingo game apps — and not a product: we have not tested any and will not describe one from memory. These are the things the category commonly offers that we do not, followed by the limits of the free tools. A vendor’s own page is the place for its current features.'
    ],
    gap: {
      heading: 'What paid tambola and bingo apps do that we do not',
      intro: 'These are commonly the reasons a club, a venue or a fundraiser pays for an app rather than uses a free tool.',
      points: [
        { h: 'It plays on the players’ phones.', p: 'Many game apps give each player a digital ticket that marks itself as numbers are called. Here no phones join the game: players hold a printed ticket or a ticket picture and mark it themselves.' },
        { h: 'It sells tickets and takes payment.', p: 'Ticket sales, payment and prize handling are common in commercial apps. Nothing here sells anything or holds money.' },
        { h: 'It runs a game for strangers online.', p: 'Public rooms, matchmaking and hosted games are an app’s business. Here you host for people you already know, over a video call or in a room.' },
        { h: 'It claims for the player.', p: 'Apps often let a player press a button to claim and settle it automatically. Here a player shouts their ticket number and the host types it into Check a claim.' },
        { h: 'It keeps a history.', p: 'Past games, winners and player lists in an account are common. Here the game is kept on the host’s device until a new game starts, and there are no accounts.' }
      ]
    },
    table: {
      us: 'Here, free, no sign-up',
      them: 'A paid tambola or bingo app',
      rows: [
        { edge: 'them', need: 'Digital tickets that mark themselves on each player’s phone', us: 'No. Printed tickets or ticket pictures that players mark themselves.', them: 'Commonly offered.' },
        { edge: 'them', need: 'Selling tickets and taking payment', us: 'No. Nothing is sold or held.', them: 'Commonly offered, subject to local gambling rules.' },
        { edge: 'them', need: 'Hosted games for strangers online', us: 'No. You host your own game for people you know.', them: 'The business of the category.' },
        { edge: 'them', need: 'Claims settled automatically from a button', us: 'No. The host types the ticket number into Check a claim.', them: 'Commonly offered.' },
        { edge: 'them', need: 'Past games and winners in an account', us: 'No. The current game stays on the host’s device until a new one starts.', them: 'Commonly included.' },
        { edge: 'us', need: 'Valid tickets', us: 'Three rows, nine columns, 15 numbers with five in every row; columns 1–9, 10–19 up to 80–90; each strip of six uses every number 1 to 90 once. Our tests check 10,000 strips against those rules.', them: 'Also generated by game apps.' },
        { edge: 'us', need: 'Printing and sharing', us: 'Print six or twelve a page on A4 or Letter with a PDF, or download each ticket as a picture to send on a messaging app, singly or in a ZIP.', them: 'Varies.' },
        { edge: 'us', need: 'Calling', us: 'Numbers 1–90 aloud with the traditional calls, in English or Hindi (a Hindi voice on the device is needed), auto-call, undo, and a board for the TV.', them: 'Commonly offered.' },
        { edge: 'us', need: 'Checking a claim', us: 'Type the ticket number printed on the ticket (such as K7MPQ2-014) and choose the prize; the page rebuilds the ticket and says whether the claim is good, and at which call it was complete. Early Five, the three lines, Four Corners, Full House, plus One line and Two lines for 90-ball bingo.', them: 'Commonly offered.' },
        { edge: 'us', need: 'Reprinting the same tickets', us: 'Every ticket shows a set code; type it with the same number of tickets to get the same tickets again, in any browser.', them: 'Varies.' },
        { edge: 'us', need: 'Working offline', us: 'After the first visit the caller opens with no connection; voices built into the device keep working. There is no server in the game at all.', them: 'Usually needs a connection.' },
        { edge: 'us', need: 'Where the game goes', us: 'Nowhere. The tickets, the PDF and the pictures are made by your browser on your device; nothing is uploaded.', them: 'Depends on the vendor; read its privacy page.' },
        { edge: 'us', need: 'Cost and sign-up for you', us: 'Free, no account.', them: 'Usually a subscription or a purchase inside an app. The vendor has the current figure; we will not guess at it.' }
      ]
    },
    buy: {
      heading: 'When you should pay for a tambola or bingo app',
      intro: 'If you are running a business or a charity event that sells tickets, a paid app is probably the right answer.',
      points: [
        'You sell tickets or take payment, and need the app to hold that for you.',
        'You want each player’s ticket to live on their phone and mark itself.',
        'You host games for people you do not know, online, on a regular schedule.',
        'You need claims settled automatically and a history of winners.',
        'The game is a regulated activity where you are, and your licence needs records an app keeps for you. We cannot advise on that; the regulator can.'
      ]
    },
    freeBlurb: 'The tambola tools need no connection once opened, and send nothing to our server. No phone joins the game: players hold printed tickets or ticket pictures.',
    groups: [
      { name: 'Make the tickets', blurb: 'Valid strips of six, to print or to send as pictures.', tools: ['/games/tambola-ticket-generator/', '/games/printable-tambola-tickets/', '/games/tambola-tickets-for-whatsapp/', '/games/bingo-card-generator/'] },
      { name: 'Call the numbers and check claims', blurb: 'A caller for the TV, in English or Hindi.', tools: ['/games/tambola-number-caller/', '/games/90-ball-bingo-caller/', '/games/75-ball-bingo-cards/'] },
      { name: 'For the occasion', blurb: 'The same game, ready for a party.', tools: ['/games/kitty-party-tambola/', '/games/diwali-tambola-caller/', '/games/baby-shower-bingo/'] }
    ],
    faq: [
      { q: 'Are these real tambola tickets?', a: 'Yes. Each ticket has three rows and nine columns with 15 numbers, five in every row; the first column holds 1–9, the next 10–19 and so on, with 80–90 in the last; every column has one to three numbers, sorted top to bottom; and each strip of six uses every number 1 to 90 once. Our tests check 10,000 strips against those rules.' },
      { q: 'How do we play tambola on a video call?', a: 'Make the tickets with the Tambola Ticket Generator and send each player their ticket picture. Open the Tambola Number Caller with the same set code, press Show on TV and share that window in the call. Players mark their own tickets and shout their ticket number when they win; check it in the caller.' },
      { q: 'Is the number draw really random?', a: 'Every number is drawn from those not yet called using your browser’s cryptographic random number generator with rejection sampling, so each remaining number is equally likely. Our tests check the first draw of 9,000 games against an even spread with a chi-square test.' },
      { q: 'Is tambola the same as housie and 90-ball bingo?', a: 'The tickets are: three rows, nine columns, fifteen numbers, six to a strip. Only the prize names differ, and the caller can check One line and Two lines as well as the tambola prizes.' },
      { q: 'Does it need the internet?', a: 'No. After the first visit the pages open offline, and nothing about the game is sent to our server. Voices built into the device keep working offline; online voices need a connection.' },
      { q: 'Can people join on their phones?', a: 'Not to play the game. The tickets are printed or sent as pictures and marked by hand; the live phone tools on this site are for polls, quizzes and questions.' }
    ],
    guides: ['run-a-tambola-game', 'plan-a-family-games-night'],
    collections: ['families', 'teachers', 'creators'],
    sources: null
  }
];

module.exports = { COMPARISONS, REF, COMPETITORS };
