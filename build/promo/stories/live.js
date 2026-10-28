'use strict';
/* Kit v2 story data: the live tools (/live/): Live Poll, Live Word Cloud, Audience Q&A, Live Rating Scale and
   Live Presentation, and their 11 landing pages. Contract: stories/index.js (hook <= 64, pain <= 120,
   promise <= 70, howTo <= 60, usual 3 x <= 46, steps 3 x <= 32).
   These are NOT on-device tools, so no line here says nothing is uploaded, works offline or stays private:
   once a session is started the question and the answers pass through our server (live.1234tools.com) only to
   reach the presenter's screen, are held in memory for the room's life and are deleted when it closes (24
   hours at most). What the lines do claim is what engine/room-*.js and the /join/ page back and
   build/tests/claims/live.js checks: the audience need no app, one 6-digit code (or a QR code), a nickname,
   one vote or rating per phone, results live on the big screen, no account for the presenter or the audience,
   and "During the launch trial a free session takes up to 1,000 phones". The examples are schematic (the kit
   labels them as an illustration): no invented figures. A human publishes every post made from these. */

const NOAPP = ['Free', 'No app for the audience', 'No sign-up'];
const CODE = ['Free', 'One code to join', 'No sign-up'];

module.exports = {
  /* ------------------------------------------------------------ the five tools */
  '/live/live-poll/': {
    persona: 'Teachers, trainers and team leads who want a quick show of hands',
    hook: 'A live poll. No app. Phones vote, the bars grow.',
    pain: 'A show of hands miscounts, the shy ones stay quiet, and a form means waiting for the results afterwards.',
    usual: ['Hands up and a quick count', 'A form and the results tomorrow', 'Sticky notes on a wall'],
    promise: 'Ask one question; every phone taps an answer; the bars grow live.',
    steps: ['Type the question and answers', 'Share the 6-digit code', 'Press Ask this question'],
    proof: NOAPP,
    example: { kind: 'schematic', input: 'A question and 2 to 10 answers', output: 'Live bars or a donut on the big screen, one vote per phone', sampleIn: 'Which day suits the team lunch? Tue / Wed / Thu / Fri', sampleOut: 'Bars grow as phones vote; Reveal and Close voting are yours' },
    howTo: 'How to run a live poll from your audience’s phones',
    cta: 'Run a live poll'
  },
  '/live/word-cloud/': {
    persona: 'Teachers, facilitators and hosts who open with one question',
    hook: 'Ask for one word. Watch the room fill the screen.',
    pain: 'Asking a room for a word gets three answers from the front row and silence from everyone else.',
    usual: ['Shouted answers, three people heard', 'Sticky notes sorted by hand', 'A shared document nobody opens'],
    promise: 'Phones send words; the commonest grow biggest on the screen.',
    steps: ['Type the question', 'Share the 6-digit code', 'Press Ask and watch the cloud'],
    proof: ['Free', 'No app for the audience', 'Rude words masked'],
    example: { kind: 'schematic', input: 'A question and up to three words per phone', output: 'A live word cloud, commonest word biggest', sampleIn: 'One word for how this quarter went', sampleOut: 'Team Work and teamwork count as one word; you can hide any word in a tap' },
    howTo: 'How to run a live word cloud with phones',
    cta: 'Start a word cloud'
  },
  '/live/audience-qa/': {
    persona: 'Speakers, team leads and hosts who take questions from a room',
    hook: 'Questions from every seat. You approve, they upvote.',
    pain: 'Nobody asks in front of the room, then the questions pile up in the corridor afterwards.',
    usual: ['A raised hand and a silence', 'Questions on paper slips', 'The loudest voice asking twice'],
    promise: 'Phones send questions; you approve; the room upvotes the best.',
    steps: ['Press Open questions', 'Share the 6-digit code', 'Approve and answer the top one'],
    proof: NOAPP,
    example: { kind: 'schematic', input: 'Questions typed on phones, approved by you', output: 'A board with the most upvoted questions on top', sampleIn: 'Questions for the leadership team', sampleOut: 'Approved questions rise by upvotes; Spotlight shows one large' },
    howTo: 'How to take audience questions on phones, with upvotes',
    cta: 'Open a Q&A'
  },
  '/live/rating-scale/': {
    persona: 'Trainers, teachers and speakers who want honest feedback',
    hook: 'Rate it now: stars, 0 to 10, or a slider.',
    pain: 'Feedback forms arrive after everyone has left, and an average alone hides a room that is split.',
    usual: ['A feedback form nobody fills in', 'A show of hands for good or bad', 'Asking afterwards in the corridor'],
    promise: 'Phones rate; you see the average, the spread and every value.',
    steps: ['Type the question and the ends', 'Share the 6-digit code', 'Press Ask and watch it fill'],
    proof: NOAPP,
    example: { kind: 'schematic', input: 'A question and a scale: stars, 0 to 10 or a slider', output: 'The average, the spread and a histogram, live', sampleIn: 'How well do you understand this now? Lost to Could teach it', sampleOut: 'A room split between low and high shows in the histogram' },
    howTo: 'How to collect live ratings from phones',
    cta: 'Run a rating'
  },
  '/live/live-presentation/': {
    persona: 'Teachers, trainers and quiz hosts who present to phones',
    hook: 'One code. Phones follow your slides, and a quiz crowns a winner.',
    pain: 'Slides, a quiz tool and a poll tool mean three logins, three codes and an audience lost between them.',
    usual: ['Slides plus a separate quiz tool', 'Joining three different ways', 'Adding up scores by hand'],
    promise: 'Prepared slides, one code, timed quiz points and a podium finish.',
    steps: ['Prepare the slides', 'Share the 6-digit code', 'Press Present, then Next'],
    proof: CODE,
    example: { kind: 'schematic', input: 'A deck of questions: choice, quiz, word cloud, rating, Q&A', output: 'Phones follow each slide; the quiz ends on a podium with confetti', sampleIn: 'Info, three quiz questions, a leaderboard, an open question', sampleOut: 'Top 5 after each question; third, second, then the winner' },
    howTo: 'How to present slides your audience answers on phones',
    cta: 'Present live'
  },

  /* ------------------------------------------------------------ the landing pages */
  '/live/live-poll-for-classroom/': {
    persona: 'Teachers who want a class check before the lesson',
    hook: 'Ask the class. Pupils vote from phones or tablets.',
    pain: 'Hands up shows who is bold, not who is lost, and a worksheet takes the whole lesson to read.',
    usual: ['Hands up with eyes closed', 'A mini whiteboard for every pupil', 'Marking an exit ticket later'],
    promise: 'One question on the board; results revealed when you choose.',
    steps: ['Pick the preset question', 'Share the 6-digit code', 'Press Ask, then Reveal'],
    proof: NOAPP,
    example: { kind: 'schematic', input: 'A class question with four answers', output: 'Votes hidden until you reveal them, then bars', sampleIn: 'How confident do you feel about today’s topic?', sampleOut: 'Very confident / Fairly confident / A bit unsure / Lost' },
    howTo: 'How to run a live poll in class on phones or tablets',
    cta: 'Poll the class'
  },
  '/live/live-poll-for-meetings/': {
    persona: 'Team leads running stand-ups, retros and town halls',
    hook: 'A quick vote in the meeting. The bars fill live.',
    pain: 'A vote in a meeting is a long round of voices, and the quiet ones just agree with the loud ones.',
    usual: ['Going round the room one by one', 'A chat thread of thumbs-up', 'A scheduling poll that takes days'],
    promise: 'Share your screen; everyone votes by phone; see the answer now.',
    steps: ['Type the question', 'Share the 6-digit code', 'Press Ask this question'],
    proof: NOAPP,
    example: { kind: 'schematic', input: 'A team question and four options', output: 'A donut or bars on the shared screen, one vote each', sampleIn: 'Which day suits the team lunch?', sampleOut: 'Tuesday / Wednesday / Thursday / Friday, counted live' },
    howTo: 'How to run a quick vote in a team meeting',
    cta: 'Vote in your meeting'
  },
  '/live/word-cloud-for-team-meeting/': {
    persona: 'Team leads opening a retro or an all-hands',
    hook: 'One word for the quarter. The team answers, the cloud forms.',
    pain: 'A check-in round takes ten minutes and only the senior voices set the mood of the meeting.',
    usual: ['Everyone says a word aloud in turn', 'A sticky-note wall nobody reads', 'Skipping the check-in altogether'],
    promise: 'Everyone sends one word; the team mood appears on the screen.',
    steps: ['Pick the preset question', 'Share the 6-digit code', 'Press Ask and watch it form'],
    proof: NOAPP,
    example: { kind: 'schematic', input: 'One question, one word per phone', output: 'A word cloud on the shared screen', sampleIn: 'One word for how this quarter went', sampleOut: 'The commonest words largest; any word can be hidden' },
    howTo: 'How to open a team meeting with a live word cloud',
    cta: 'Start the check-in'
  },
  '/live/word-cloud-for-classroom/': {
    persona: 'Teachers starting a lesson with a word cloud',
    hook: 'Three words for “volcano”. The class fills the board.',
    pain: 'Starting a lesson with a question gets a few hands up, and the rest of the class waits to be told.',
    usual: ['Brainstorming on the whiteboard', 'Three hands and a lot of nodding', 'A worksheet to start the lesson'],
    promise: 'Pupils send up to three words; the cloud grows on the board.',
    steps: ['Pick the preset question', 'Share the 6-digit code', 'Press Ask and read the cloud'],
    proof: ['Free', 'No app for pupils', 'Rude words masked'],
    example: { kind: 'schematic', input: 'A topic and up to three words per pupil', output: 'A live cloud on the board, rude words masked', sampleIn: 'Three words you think of when you hear “volcano”', sampleOut: 'Repeated words grow; each phone counts once per word' },
    howTo: 'How to start a lesson with a live word cloud',
    cta: 'Start the lesson'
  },
  '/live/qa-for-town-hall-meeting/': {
    persona: 'Leaders and HR running a town hall or an all-hands',
    hook: 'Staff ask on their phones. You pick what reaches the screen.',
    pain: 'Open questions in a big meeting go quiet, and the sharpest ones never get asked out loud.',
    usual: ['A box of paper slips', 'A hand-held microphone and a wait', 'An email thread of questions in advance'],
    promise: 'Nicknames only; you approve each question; the room upvotes.',
    steps: ['Open the questions', 'Share the 6-digit code', 'Approve, answer from the top'],
    proof: NOAPP,
    example: { kind: 'schematic', input: 'Questions from staff phones, each approved by you', output: 'A board ranked by upvotes, names hidden', sampleIn: 'Questions for the leadership team', sampleOut: 'Only approved questions reach the board and the phones' },
    howTo: 'How to run a town hall Q&A on phones',
    cta: 'Open the Q&A'
  },
  '/live/wedding-questions-for-the-couple/': {
    persona: 'Wedding hosts and the best man who want guests in the fun',
    hook: 'Guests ask the couple anything, from their phones.',
    pain: 'Speeches are one-way, and the funniest guest questions stay at the table.',
    usual: ['Questions on cards at each table', 'A microphone passed round, slowly', 'Nobody dares ask in front of everyone'],
    promise: 'Guests send questions; you choose the best for the big screen.',
    steps: ['Open the questions', 'Put the code on the TV', 'Approve and read them out'],
    proof: NOAPP,
    example: { kind: 'schematic', input: 'Guest questions typed on phones', output: 'The best, approved by you, on the big screen', sampleIn: 'Ask the couple anything!', sampleOut: 'Guests upvote; you approve and read the top one' },
    howTo: 'How to take guest questions for the couple at a wedding',
    cta: 'Ask the couple'
  },
  '/live/rate-a-session-live/': {
    persona: 'Trainers and speakers who want feedback before people leave',
    hook: 'Rate the session out of five stars, before you leave the room.',
    pain: 'A feedback form emailed later gets a few replies, mostly from the happiest and the angriest.',
    usual: ['A feedback email nobody answers', 'Paper forms collected at the door', 'Asking “was that useful?” and hearing yes'],
    promise: 'Everyone rates from their phone; the average shows on screen.',
    steps: ['Pick the preset question', 'Share the 6-digit code', 'Press Ask and read the average'],
    proof: NOAPP,
    example: { kind: 'schematic', input: 'One question and a five-star scale', output: 'The average, the spread and a histogram, live', sampleIn: 'How useful was this session? Not useful to Very useful', sampleOut: 'One rating per phone; rating again replaces the earlier one' },
    howTo: 'How to collect live feedback at the end of a talk',
    cta: 'Rate the session'
  },
  '/live/classroom-understanding-check/': {
    persona: 'Teachers checking understanding before moving on',
    hook: 'How well did that land? Every pupil answers, 0 to 10.',
    pain: 'Asking “does everyone understand?” gets silence, and the pupils who are lost will not say so in front of the class.',
    usual: ['Asking “any questions?” and hearing none', 'Thumbs up, sideways or down', 'Finding out at the test'],
    promise: 'A 0 to 10 slider; results stay hidden until you reveal them.',
    steps: ['Pick the preset question', 'Share the 6-digit code', 'Press Ask, then Reveal'],
    proof: NOAPP,
    example: { kind: 'schematic', input: 'A 0 to 10 slider from Lost to Could teach it', output: 'The average, the spread and a histogram after you reveal', sampleIn: 'How well do you understand this now?', sampleOut: 'A class split between low and high shows in the histogram' },
    howTo: 'How to check understanding in class on phones',
    cta: 'Check understanding'
  },
  '/live/live-quiz-for-classroom/': {
    persona: 'Teachers running quiz Fridays and revision quizzes',
    hook: 'A class quiz on the board. Pupils answer on phones.',
    pain: 'A quiz means hands up for the fastest, marking by hand, and the quiet pupils never get a go.',
    usual: ['Hands up and the loudest wins', 'Pupils marking each other’s papers', 'Adding up team points on the board'],
    promise: 'Timed questions, points for speed and a leaderboard.',
    steps: ['Edit the class quiz deck', 'Share the 6-digit code', 'Press Present, then Next'],
    proof: CODE,
    example: { kind: 'schematic', input: 'A deck: timed quiz questions, a leaderboard, an open question', output: 'Points for speed, the top 5 after each question, a winner at the end', sampleIn: 'What is 7 × 8? 20 seconds', sampleOut: 'Right answers score 1000 down to 500; wrong ones score 0' },
    howTo: 'How to run a class quiz on phones, with a leaderboard',
    cta: 'Quiz the class'
  },
  '/live/interactive-meeting-presentation/': {
    persona: 'Team leads running all-hands and monthly meetings',
    hook: 'A team meeting where everyone answers, not just the loud few.',
    pain: 'A slide deck talks at people, and the questions you needed answered go unasked until the meeting is over.',
    usual: ['Slides read aloud to a muted room', 'A separate poll tool and a chat thread', 'Questions saved for “any other business”'],
    promise: 'Rating, word cloud, vote, ideas and Q&A in one deck, one code.',
    steps: ['Edit the meeting deck', 'Share the 6-digit code', 'Press Present, then Next'],
    proof: CODE,
    example: { kind: 'schematic', input: 'A deck: a rating, a word cloud, a vote, open ideas, Q&A', output: 'Phones follow each slide; results are kept for every slide', sampleIn: 'How was your week? One word for this quarter', sampleOut: 'Export CSV saves every slide’s results' },
    howTo: 'How to run an interactive team meeting with phones',
    cta: 'Present to the team'
  },
  '/live/quiz-night-with-phones/': {
    persona: 'Families, quiz-night hosts and community groups with a TV',
    hook: 'Quiz night on the TV. Everyone answers on their phone.',
    pain: 'Quiz night means paper answer sheets, a host who marks them all, and the scores arriving an hour late.',
    usual: ['Paper answer sheets collected and marked', 'Shouting answers across the room', 'A host adding up scores on a napkin'],
    promise: 'Faster right answers score more; a podium finish with confetti.',
    steps: ['Edit the quiz night deck', 'Put the code on the TV', 'Press Present, then Next'],
    proof: CODE,
    example: { kind: 'schematic', input: 'A deck of timed questions and leaderboards', output: 'Top 5 after each question; third, second, then the winner', sampleIn: 'How many players are on a cricket team? 15 seconds', sampleOut: 'Phones show their own points and place; the TV shows the board' },
    howTo: 'How to host a quiz night with everyone on phones',
    cta: 'Host a quiz night'
  }
};
