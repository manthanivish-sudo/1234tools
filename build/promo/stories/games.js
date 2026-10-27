'use strict';
/* Kit v2 story data: Quiz & Party Games (/games/). Contract: stories/index.js (fields and limits as the
   other shards: hook <= 64, pain <= 120, promise <= 70, howTo <= 60, usual 3 x <= 46, steps 3 x <= 32).
   One story for each of the 13 game pages and each of their 26 landing pages. Every line is a claim the
   game pages make and engine/game-*.js backs (build/tests/claims/games.js checks them): nothing is
   uploaded, the draw uses the browser's cryptographic random generator, the word or question is kept off
   the TV where it should be, the games hold no songs, lyrics or song titles. The examples are schematic
   (the kit labels them as an illustration); the only figures are limits the engines enforce. A human
   publishes every post made from these. */

const FREE = ['Free', 'No sign-up', 'Nothing uploaded'];
const TV = ['Free', 'Shows on the TV', 'Nothing uploaded'];

module.exports = {
  /* ------------------------------------------------------------ the 13 games */
  '/games/team-generator/': {
    persona: 'Families, teachers and quiz-night hosts who must make fair teams',
    hook: 'Fifteen cousins. Four fair teams. One click.',
    pain: 'Picking teams by hand takes ages, someone feels left out, and the brothers end up together again.',
    usual: ['Picking captains and waiting for tears', 'Folded paper drawn from a bowl', 'Re-doing it when one child is absent'],
    promise: 'Paste the names, press once, get fair teams for the TV.',
    steps: ['Paste the names, one per line', 'Choose teams or team size', 'Press Make teams'],
    proof: TV,
    example: { kind: 'schematic', input: 'A list of names, and how many teams', output: 'Fair teams, shown big on the TV', sampleIn: 'Asha, Ravi, Meera, Kabir … (14 names, 4 teams)', sampleOut: 'Two teams of 4 and two of 3: sizes never differ by more than one' },
    howTo: 'How to make fair random teams for a quiz night or class',
    cta: 'Make the teams'
  },
  '/games/spin-the-wheel/': {
    persona: 'Parents, teachers and party hosts who need a fair, fun pick',
    hook: 'Do not argue. Let the wheel decide.',
    pain: 'Who goes first, who washes up, who answers next: every small choice becomes a small argument.',
    usual: ['Rock, paper, scissors, again', 'Drawing straws no one trusts', 'The loudest voice winning'],
    promise: 'A big spinning wheel with a fair winner, on the TV.',
    steps: ['Type the names or prizes', 'Press Spin or tap the wheel', 'Take each winner off if you like'],
    proof: TV,
    example: { kind: 'schematic', input: 'Names, prizes or forfeits, one per line', output: 'One fair winner, announced in full', sampleIn: 'Grand prize / Sweets*4 / Sticker*3', sampleOut: 'A wheel where Sweets is four times as likely as Grand prize' },
    howTo: 'How to pick a random winner with a spinning wheel',
    cta: 'Spin the wheel'
  },
  '/games/scoreboard/': {
    persona: 'Quiz-night hosts and teachers keeping score for several teams',
    hook: 'The scores, always right, always on the TV.',
    pain: 'Scores on scrap paper get lost, argued over and added up wrongly at the very end of the night.',
    usual: ['Tally marks on the back of an envelope', 'A spreadsheet nobody can read from the sofa', 'Adding it all up while guests wait'],
    promise: 'Tap points, play a joker, and a live leaderboard shows on the TV.',
    steps: ['Name the teams', 'Tap points for each team', 'Press Show on TV'],
    proof: TV,
    example: { kind: 'schematic', input: 'Teams and points, round by round', output: 'A ranked leaderboard that re-orders itself', sampleIn: 'Team 1 +5, Team 2 +1, joker played', sampleOut: 'Ranks update on the TV; Undo takes back a slip' },
    howTo: 'How to keep score for a quiz night, with a live leaderboard',
    cta: 'Keep the score'
  },
  '/games/quiz-buzzer/': {
    persona: 'Quiz-night hosts, teachers and families who argue about who pressed first',
    hook: 'Who pressed first? The buzzer knows.',
    pain: 'Shouting out, hands in the air, and "I was first!" ruin a good quiz question.',
    usual: ['Shouting the answer out', 'Hands up and a guess at who was first', 'A kitchen bell and a lot of arguing'],
    promise: 'Each team gets a pad and a key; the first press locks the rest.',
    steps: ['Name the teams, check their keys', 'Say go: the first press wins', 'Press Correct or Reset'],
    proof: TV,
    example: { kind: 'schematic', input: 'Team presses on one tablet or keyboard', output: 'The winner, and the others with their gaps', sampleIn: 'Team 2 presses first; Team 4 a moment later', sampleOut: 'Team 2 locks the buzzer; Team 4 is listed with its gap in ms' },
    howTo: 'How to run a quiz buzzer on one tablet, free',
    cta: 'Open the buzzer'
  },
  '/games/tambola-number-caller/': {
    persona: 'Families at Diwali and kitty-party hosts who play Tambola',
    hook: 'Tambola night: the numbers call themselves.',
    pain: 'Someone has to draw every number, call it clearly and remember which ones are gone.',
    usual: ['A bag of paper chits and a tired caller', 'Losing track of what was called', 'Checking a claim by hand, ticket by ticket'],
    promise: 'Calls 1 to 90 aloud, in English or Hindi, and checks each claim.',
    steps: ['Press Next number or Auto-call', 'Press Show on TV for the board', 'Type the ticket number to check'],
    proof: ['Free', 'No sign-up', 'Works offline after first visit'],
    example: { kind: 'schematic', input: 'A game of Tambola, one number at a time', output: 'The number spoken, on the TV board, none repeated', sampleIn: 'Next number, then a shout of Early Five', sampleOut: 'Ticket number checked against the numbers called' },
    howTo: 'How to call Tambola numbers aloud, free',
    cta: 'Call the numbers'
  },
  '/games/tambola-ticket-generator/': {
    persona: 'Kitty-party hosts and families printing Tambola tickets',
    hook: 'Valid Tambola tickets. Print them or WhatsApp them.',
    pain: 'Hand-made tickets break the rules, and a hundred of them take an evening to draw.',
    usual: ['Drawing grids by hand', 'Copying one ticket again and again', 'Tickets with the same number twice'],
    promise: 'Strips of six that use every number 1 to 90 once.',
    steps: ['Choose how many tickets', 'Print, or make WhatsApp pictures', 'Open the caller to check claims'],
    proof: FREE,
    example: { kind: 'schematic', input: 'How many tickets, a title and a colour', output: 'A printable PDF, or one picture per ticket', sampleIn: '24 tickets titled with the host’s name', sampleOut: 'Four strips of six; each ticket carries a ticket number' },
    howTo: 'How to make printable Tambola tickets for free',
    cta: 'Make the tickets'
  },
  '/games/bingo-card-generator/': {
    persona: 'Baby-shower hosts, teachers and families playing bingo',
    hook: 'Bingo cards for any party, with your own words.',
    pain: 'Shop-bought bingo never has your words, and writing thirty cards by hand takes all afternoon.',
    usual: ['Hand-drawn grids', 'Cards that repeat the same squares', 'Calling from a list and losing your place'],
    promise: 'Numbered 75-ball or word bingo cards, plus a caller.',
    steps: ['Choose numbers or your own words', 'Print or save a PDF', 'Call the game on the TV'],
    proof: FREE,
    example: { kind: 'schematic', input: 'A word list, or the numbers 1 to 75', output: 'Numbered cards to print, and a caller', sampleIn: 'Bottle, rattle, pram, cot, bib …', sampleOut: 'Cards with a free centre, one to four to a page' },
    howTo: 'How to make bingo cards with your own words',
    cta: 'Make bingo cards'
  },
  '/games/charades-generator/': {
    persona: 'Families at Diwali and Christmas, and youth groups playing dumb charades',
    hook: 'Dumb charades: the word is for the actor only.',
    pain: 'Someone always peeks at the chits, the words run out, and nobody is watching the clock.',
    usual: ['Folded chits in a bowl', 'Words you have used before', 'Arguing over whether time is up'],
    promise: 'Fresh words, a team timer and scores. The TV never shows the word.',
    steps: ['Pick a deck and the teams', 'Start the turn for the actor', 'Press Got it or Skip'],
    proof: ['Free', 'Word kept off the TV', 'Nothing uploaded'],
    example: { kind: 'schematic', input: 'A deck, teams and a turn length', output: 'One word at a time, a clock and scores', sampleIn: 'Bollywood films, two teams, 90 seconds', sampleOut: 'The word on the actor’s phone only; clock and scores on the TV' },
    howTo: 'How to play dumb charades with a phone and a TV',
    cta: 'Play charades'
  },
  '/games/antakshari/': {
    persona: 'Families, kitty parties and weddings who love antakshari',
    hook: 'Antakshari without a quarrel over the letter.',
    pain: 'Teams argue over whose turn it is, which letter comes next and whether the time was fair.',
    usual: ['Arguing over the starting letter', 'Counting seconds out loud', 'Scores on a napkin'],
    promise: 'A fair letter, a turn clock and scores. No songs on the page.',
    steps: ['Choose teams, time and letters', 'Press Start timer', 'Tap the last sound, Next team'],
    proof: ['Free', 'Plays no music', 'Nothing uploaded'],
    example: { kind: 'schematic', input: 'Teams, a turn clock and the letters in play', output: 'A fair random letter, a clock and the scores', sampleIn: 'Two teams, 45 seconds a turn, Hindi letters', sampleOut: 'The big letter and clock on the TV; the team sings from memory' },
    howTo: 'How to run antakshari with a fair letter and a timer',
    cta: 'Start antakshari'
  },
  '/games/icebreaker-cards/': {
    persona: 'Families at dinner, teachers in the first week of term and meeting hosts',
    hook: 'One good question gets everyone talking.',
    pain: 'The first minute of a dinner, a class or a call is awkward, and "any ideas?" never helps.',
    usual: ['Silence and phones', 'The same old questions', 'Asking "how was your day?" again'],
    promise: 'Shuffled question cards, big on the screen, none repeated.',
    steps: ['Choose a deck', 'Press Draw a card', 'Read it out and take turns'],
    proof: TV,
    example: { kind: 'schematic', input: 'A deck: would you rather, starters, this or that', output: 'One question card in large type', sampleIn: 'Would you rather … (kids’ deck)', sampleOut: 'The card on the TV; no card repeats until the deck is used' },
    howTo: 'How to start a conversation with question cards',
    cta: 'Draw a card'
  },
  '/games/quiz-maker/': {
    persona: 'Quiz-night hosts, teachers and families writing their own quiz',
    hook: 'Write the quiz. Host it on the TV.',
    pain: 'A home-made quiz means slides, answer sheets and someone adding up the scores in a corner.',
    usual: ['Slides and a printed answer list', 'Scores added up at the end', 'Pictures that will not load'],
    promise: 'Questions, picture rounds, a countdown, scores and print sheets.',
    steps: ['Type questions and answers', 'Press Host and name the teams', 'Reveal each answer on the TV'],
    proof: TV,
    example: { kind: 'schematic', input: 'Rounds of questions, with answers and pictures', output: 'A hosted quiz on the TV, or printed sheets', sampleIn: 'A multiple-choice question and a picture round', sampleOut: 'Question on the TV, answer on your phone, scores kept' },
    howTo: 'How to write and host a quiz night on the TV',
    cta: 'Make a quiz'
  },
  '/games/category-board/': {
    persona: 'Teachers and quiz hosts who want a board of categories and points',
    hook: 'Pick a square. Reveal the answer. Score it.',
    pain: 'A review lesson with a hand-drawn board is slow, and the points get lost mid-game.',
    usual: ['A grid drawn on the whiteboard', 'Slides with links to click', 'Points rubbed out by accident'],
    promise: 'A quiz board for the projector, with scores kept and a hidden double.',
    steps: ['Name topics, fill the squares', 'Press Play and name the teams', 'Pick a square, then score'],
    proof: TV,
    example: { kind: 'schematic', input: 'Categories and questions, easy to hard', output: 'A quiz board on the projector with scores', sampleIn: 'Five topics across, five rows down', sampleOut: 'Squares grey out as they are used; one hidden double' },
    howTo: 'How to make a quiz board for the classroom projector',
    cta: 'Build a board'
  },
  '/games/top-answers/': {
    persona: 'Families, party hosts and teachers who like a survey game',
    hook: 'Kids against grown-ups: name the top answers.',
    pain: 'A survey game needs a board, a scorekeeper and a buzzer for wrong guesses, and none of it is on hand.',
    usual: ['Answers hidden under sticky notes', 'Counting strikes on your fingers', 'A guess at who plays next'],
    promise: 'Hidden answers, reveals, three strikes and a steal, on the TV.',
    steps: ['Type a question and its answers', 'Press Play and name two teams', 'Press an answer to reveal it'],
    proof: TV,
    example: { kind: 'schematic', input: 'A question and its answers with points', output: 'A game board that reveals as teams guess', sampleIn: 'Name something you take to the beach', sampleOut: 'Answers hidden on the TV until found; X for a strike' },
    howTo: 'How to play a family survey game on the TV',
    cta: 'Play the survey game'
  },

  /* ------------------------------------------------- landing pages: team generator */
  '/games/random-group-generator-for-class/': {
    persona: 'Teachers who need groups for a project, a quiz or a seating plan',
    hook: 'Class groups in a click. Friends kept apart.',
    pain: 'Groups made by hand take lesson time, and the same pupils always end up together.',
    usual: ['Counting off one, two, three, four', 'Letting pupils choose their friends', 'Re-doing groups when someone is away'],
    promise: 'Paste the register, set the size, get fair groups for the board.',
    steps: ['Paste the class list', 'Choose a group size', 'Make teams, then Show on TV'],
    proof: TV,
    example: { kind: 'schematic', input: 'A class register and a group size', output: 'Random groups for the board', sampleIn: 'The register, groups of four, two pupils kept apart', sampleOut: 'A fresh fair shuffle each press; group sizes differ by one at most' },
    howTo: 'How to make random groups for a class, free',
    cta: 'Make class groups'
  },
  '/games/random-team-picker-for-quiz-night/': {
    persona: 'Quiz-night hosts and families with cousins to split up',
    hook: 'Quiz night teams: fair, mixed and ready.',
    pain: 'Friends and family sit together, so one team is strong and another cannot answer a thing.',
    usual: ['Everyone sitting where they like', 'Captains picking their friends', 'Cousins on the same team again'],
    promise: 'Mix the room into fair teams with fun names, on the TV.',
    steps: ['Type everyone’s name', 'Choose four teams', 'Show the line-up on the TV'],
    proof: TV,
    example: { kind: 'schematic', input: 'Everyone’s name, and a number of teams', output: 'Mixed teams with fun names', sampleIn: 'Fifteen names, four teams, cousins kept apart', sampleOut: 'Four teams of 4, 4, 4 and 3, revealed one at a time' },
    howTo: 'How to pick teams for a family quiz night',
    cta: 'Pick the teams'
  },

  /* ------------------------------------------------- landing pages: wheel */
  '/games/random-name-picker-wheel/': {
    persona: 'Teachers and hosts who pick one name at a time',
    hook: 'Whose turn is it? Spin and see.',
    pain: 'Asking the same hands-up pupils every time leaves the quiet ones out.',
    usual: ['Choosing the child who is looking', 'Names on lolly sticks', 'Always asking the eager hand'],
    promise: 'Spin for a fair pick; each winner leaves, so all get a turn.',
    steps: ['Paste the names', 'Press Spin', 'Winners leave the wheel'],
    proof: TV,
    example: { kind: 'schematic', input: 'A list of names', output: 'One fair pick, then the name leaves the wheel', sampleIn: 'The class list, one name per line', sampleOut: 'Nobody comes up twice until the wheel is empty' },
    howTo: 'How to pick a random name from a list, with a wheel',
    cta: 'Spin for a name'
  },
  '/games/yes-or-no-wheel/': {
    persona: 'Families deciding small things together',
    hook: 'Takeaway tonight? The wheel says.',
    pain: 'A tiny decision turns into twenty minutes of "I do not mind, you choose".',
    usual: ['Flipping a coin you cannot find', '"You choose" back and forth', 'Waiting for the loudest opinion'],
    promise: 'Two slices, one fair spin. Add Maybe if you like.',
    steps: ['Open the Yes or No wheel', 'Press Spin', 'Add Maybe or more slices'],
    proof: FREE,
    example: { kind: 'schematic', input: 'Yes and No, or your own options', output: 'A fair answer from a spin', sampleIn: 'Can we get a takeaway?', sampleOut: 'The wheel lands on one slice; Yes can have more slices' },
    howTo: 'How to settle a yes or no question with a wheel',
    cta: 'Spin yes or no'
  },
  '/games/prize-wheel-for-party-or-class/': {
    persona: 'Party hosts and teachers handing out prizes',
    hook: 'A prize wheel with rare prizes and thin slices.',
    pain: 'A prize table invites grabbing, and giving every child the best prize is not an option.',
    usual: ['A box of prizes and a free-for-all', 'Drawing numbers from a hat', 'Guessing how often a prize should win'],
    promise: 'Set the prizes and the odds with a star; each child spins.',
    steps: ['Type the prizes', 'Add *3 to make a prize likelier', 'Let each child spin'],
    proof: TV,
    example: { kind: 'schematic', input: 'Prizes, with a weight after a star', output: 'A wheel with wide and thin slices', sampleIn: 'Grand prize / Big sweet*3 / Sticker*4', sampleOut: 'A prize with *4 has four times the chance of one without' },
    howTo: 'How to run a prize wheel for a party or class',
    cta: 'Spin for a prize'
  },

  /* ------------------------------------------------- landing pages: scoreboard */
  '/games/quiz-night-scoreboard/': {
    persona: 'Quiz-night hosts running a table of teams',
    hook: 'Four teams ready. Tap to score.',
    pain: 'Halfway through the third round, nobody trusts the running total.',
    usual: ['A paper score sheet', 'Asking the tables for their own totals', 'A calculator and a lot of doubt'],
    promise: 'Four teams are ready. Tap points, play jokers, show the ranks.',
    steps: ['Rename the four teams', 'Tap points each round', 'Press Show on TV'],
    proof: TV,
    example: { kind: 'schematic', input: 'Four teams and their points by round', output: 'A ranked leaderboard for the TV', sampleIn: 'Round 3: Team 2 +5, Team 3 plays a joker', sampleOut: 'The joker doubles that team’s round; equal totals share a rank' },
    howTo: 'How to score a quiz night with a live leaderboard',
    cta: 'Start scoring'
  },
  '/games/classroom-points-tracker/': {
    persona: 'Teachers giving points to groups or houses across the week',
    hook: 'Group points, one tap at a time.',
    pain: 'Tally marks on the board get rubbed off, and the week ends in a dispute about the totals.',
    usual: ['Tally marks on the whiteboard', 'A clipboard that goes missing', 'Adding it up on Friday'],
    promise: 'Six groups to start. Points stay on your device, day to day.',
    steps: ['Rename the groups', 'Tap points for each group', 'Show the board on the projector'],
    proof: TV,
    example: { kind: 'schematic', input: 'Groups and the points they earn', output: 'A leaderboard for the classroom board', sampleIn: 'Group 2 +1 for tidying, Group 5 +5 for the quiz', sampleOut: 'Totals kept in this browser; a refresh does not lose them' },
    howTo: 'How to keep group points in the classroom',
    cta: 'Track the points'
  },

  /* ------------------------------------------------- landing pages: buzzer */
  '/games/buzzer-for-family-quiz-night/': {
    persona: 'Families with one tablet and a lot of competitive cousins',
    hook: 'One tablet. A pad each. Fastest finger wins.',
    pain: 'At a family quiz, the answer is shouted out before the question ends and nobody agrees who won.',
    usual: ['Shouting over each other', 'Hands up, and an argument', 'A toy horn from the cupboard'],
    promise: 'A big pad for each team on one tablet. The first touch wins.',
    steps: ['Set the four team names', 'Say go and watch the pads', 'Press Correct, then Reset'],
    proof: TV,
    example: { kind: 'schematic', input: 'Four teams touching pads on one screen', output: 'The first touch locks the others out', sampleIn: 'Two pads touched almost together', sampleOut: 'The earlier time stamp wins; the gap is listed in ms' },
    howTo: 'How to run a family quiz buzzer on one tablet',
    cta: 'Open the family buzzer'
  },

  /* ------------------------------------------------- landing pages: tambola caller */
  '/games/diwali-tambola-caller/': {
    persona: 'Families at Diwali playing Tambola round the TV',
    hook: 'Diwali night Tambola, called for you.',
    pain: 'The host who calls cannot play, and a rushed check of a shout of Full House spoils the moment.',
    usual: ['One person stuck being the caller', 'Ticking the numbers on a list', 'Checking a claim ticket by ticket'],
    promise: 'The family plays; the page calls and checks every claim.',
    steps: ['Press Next number', 'Show the board on the TV', 'Type the ticket to check a claim'],
    proof: ['Free', 'No sign-up', 'Works offline after first visit'],
    example: { kind: 'schematic', input: 'A family Tambola game', output: 'Numbers called aloud and shown on the TV board', sampleIn: 'Next number, again and again', sampleOut: 'Early Five and Full House checked from the ticket number' },
    howTo: 'How to call Tambola at home on Diwali night',
    cta: 'Call Diwali Tambola'
  },
  '/games/kitty-party-tambola/': {
    persona: 'Kitty-party hosts who want to play too',
    hook: 'Let the page call. You play.',
    pain: 'The host at a kitty party ends up calling numbers all afternoon and never gets to play.',
    usual: ['Calling every number yourself', 'Asking a guest to take over', 'Losing count of what was called'],
    promise: 'Auto-call in Hindi or English; claims checked by ticket number.',
    steps: ['Press Start auto-call', 'Choose Hindi or English calls', 'Type a ticket to check a claim'],
    proof: ['Free', 'No sign-up', 'Works offline after first visit'],
    example: { kind: 'schematic', input: 'Auto-call on a timer, in Hindi or English', output: 'A number spoken every few seconds, none repeated', sampleIn: 'Auto-call every ten seconds', sampleOut: 'A guest shouts; type the ticket number to check' },
    howTo: 'How to host a kitty-party Tambola and play too',
    cta: 'Start auto-call'
  },
  '/games/90-ball-bingo-caller/': {
    persona: 'Bingo-night hosts and clubs calling 90-ball games',
    hook: 'Eyes down. The caller never loses count.',
    pain: 'A 90-ball game with paper balls is slow, and checking a line against the called numbers is easy to get wrong.',
    usual: ['A bag of numbered balls', 'A marked-up master sheet', 'Checking a full house by eye'],
    promise: 'A 90-ball caller in a British voice that checks every win.',
    steps: ['Choose the British calls', 'Press Next number', 'Type the ticket to check a win'],
    proof: ['Free', 'No sign-up', 'Works offline after first visit'],
    example: { kind: 'schematic', input: 'A 90-ball bingo game', output: 'Numbers spoken, a board on the screen, wins checked', sampleIn: 'Next number until someone shouts', sampleOut: 'One line, two lines or full house checked from the ticket' },
    howTo: 'How to call 90-ball bingo with a free caller',
    cta: 'Call the numbers'
  },

  /* ------------------------------------------------- landing pages: tambola tickets */
  '/games/printable-tambola-tickets/': {
    persona: 'Hosts printing Tambola for a family or a club',
    hook: 'Twenty-four Tambola tickets, ready to print.',
    pain: 'Home-made tickets break the rules, and nobody wants to check a hundred numbers for repeats.',
    usual: ['Tickets bought by the pad', 'Photocopying one ticket many times', 'Tickets that repeat a number'],
    promise: 'Strips of six, six to an A4 page, with cut lines and numbers.',
    steps: ['Keep 24 tickets or change it', 'Press Print or Download PDF', 'Cut along the dashed lines'],
    proof: FREE,
    example: { kind: 'schematic', input: 'A number of tickets and a title', output: 'A print-ready PDF in strips of six', sampleIn: '24 tickets, six to an A4 page', sampleOut: 'Four strips; each ticket has its own ticket number' },
    howTo: 'How to print Tambola tickets, strip of six, free',
    cta: 'Print the tickets'
  },
  '/games/tambola-tickets-for-whatsapp/': {
    persona: 'Kitty-party hosts and families playing Tambola on a video call',
    hook: 'Tambola by WhatsApp: a picture for every ticket.',
    pain: 'Players on a video call cannot share paper tickets, and typing out grids is out of the question.',
    usual: ['Photographing a printed sheet', 'Typing numbers into a message', 'Everyone using a different ticket design'],
    promise: 'One picture per ticket, ready to send, checked by ticket number.',
    steps: ['Choose the number of tickets', 'Press Ticket pictures', 'Send each player theirs'],
    proof: FREE,
    example: { kind: 'schematic', input: 'How many tickets, a title and a colour', output: 'One PNG picture for each ticket', sampleIn: '12 tickets titled Kitty party Tambola', sampleOut: 'A picture each to send; the caller checks any claim' },
    howTo: 'How to send Tambola tickets on WhatsApp',
    cta: 'Make ticket pictures'
  },

  /* ------------------------------------------------- landing pages: bingo cards */
  '/games/baby-shower-bingo/': {
    persona: 'Baby-shower hosts and guests',
    hook: 'Baby shower bingo, ticked off as gifts open.',
    pain: 'Shower games feel stale, and it takes an evening to make cards that are all different.',
    usual: ['Hand-drawn cards for every guest', 'The same bingo as every shower', 'Guests with identical cards'],
    promise: 'Baby-word cards with a free centre; edit any word, then print.',
    steps: ['Edit the baby words', 'Choose the number of cards', 'Print two to a page'],
    proof: FREE,
    example: { kind: 'schematic', input: 'A list of baby words', output: 'Numbered 5 × 5 cards with a free centre', sampleIn: 'Bottle, nappy, pram, rattle, bib …', sampleOut: 'Each card shuffles the words; no word repeats on a card' },
    howTo: 'How to make baby shower bingo cards for free',
    cta: 'Make shower cards'
  },
  '/games/classroom-vocabulary-bingo/': {
    persona: 'Teachers revising this week’s words',
    hook: 'Vocabulary bingo from this week’s words.',
    pain: 'Revision lists are dull, and a printed bingo set rarely has the words you taught this week.',
    usual: ['Copying out a new grid for each class', 'Reading a word list aloud', 'Pupils copying each other'],
    promise: 'Paste the words, print a card each, call words or definitions.',
    steps: ['Paste your word list', 'Print a card for every pupil', 'Call words or read definitions'],
    proof: FREE,
    example: { kind: 'schematic', input: 'This week’s vocabulary, one word per line', output: 'A different card for every pupil', sampleIn: 'noun, verb, adjective, simile, prefix …', sampleOut: '4 × 4 cards from your list; the caller draws the words fairly' },
    howTo: 'How to make vocabulary bingo cards for a class',
    cta: 'Make word bingo'
  },
  '/games/75-ball-bingo-cards/': {
    persona: 'Families and clubs playing classic 75-ball bingo',
    hook: 'Classic bingo cards with a free centre.',
    pain: 'Bought bingo pads run out, and a call from the bag is slow without a board in front of everyone.',
    usual: ['Pads of cards that run out', 'A call-out from a paper list', 'Cards with a duplicate in the column'],
    promise: 'B-I-N-G-O cards, four to a page, and a caller for the TV.',
    steps: ['Choose 75-ball numbers', 'Print four cards to a page', 'Call the game on the TV'],
    proof: FREE,
    example: { kind: 'schematic', input: 'How many cards, and a title', output: 'Numbered 75-ball cards to print', sampleIn: '12 cards titled Bingo, four to a page', sampleOut: 'Columns B 1–15 to O 61–75, with a free centre square' },
    howTo: 'How to print 75-ball bingo cards for free',
    cta: 'Print bingo cards'
  },

  /* ------------------------------------------------- landing pages: quiz maker */
  '/games/family-quiz-night-maker/': {
    persona: 'Families planning a quiz night for all ages',
    hook: 'Four rounds, ready to fill with your questions.',
    pain: 'A family quiz that pleases a grandparent and a nine-year-old takes real work to organise.',
    usual: ['Slides for every round', 'A scoring sheet taped to the wall', 'Questions only one generation can answer'],
    promise: 'Rounds for every age, hosted on the TV with scores kept.',
    steps: ['Type your questions', 'Press Host and name the teams', 'Reveal answers on the TV'],
    proof: TV,
    example: { kind: 'schematic', input: 'Four rounds of your own questions', output: 'A quiz hosted on the TV, scores kept', sampleIn: 'General knowledge, kids, picture round, quick-fire', sampleOut: 'Question on the TV; the answer and notes on your phone' },
    howTo: 'How to host a family quiz night on the TV',
    cta: 'Make the family quiz'
  },
  '/games/christmas-quiz-host/': {
    persona: 'Families hosting a quiz on Christmas Day or Boxing Day',
    hook: 'A Christmas quiz, hosted on the TV.',
    pain: 'Everyone wants a Christmas quiz, but nobody wants to spend Christmas Eve typing the slides.',
    usual: ['A quiz book read aloud', 'Slides made at midnight', 'Scores on the back of a card'],
    promise: 'Four festive rounds to fill, hosted on the TV with the scores.',
    steps: ['Fill in the four rounds', 'Name the teams, press Host', 'Show the picture round on the TV'],
    proof: TV,
    example: { kind: 'schematic', input: 'Festive questions and photos', output: 'A Christmas quiz hosted on the TV', sampleIn: 'Traditions, films, festive food, picture round', sampleOut: 'Answers on your phone, questions and scores on the TV' },
    howTo: 'How to host a Christmas quiz on the TV, free',
    cta: 'Host a Christmas quiz'
  },
  '/games/picture-round-maker/': {
    persona: 'Quiz hosts building a picture round from their own photos',
    hook: 'A picture round from your own photos.',
    pain: 'Picture rounds mean pasting photos into slides or printing them, and one wrong order spoils the round.',
    usual: ['Photos pasted into slides', 'Printing a sheet per table', 'Image files that open in the wrong order'],
    promise: 'Pick the photos, type the answers, show them one by one.',
    steps: ['Pick photos from your device', 'Type the answer for each', 'Show on the TV, or print'],
    proof: TV,
    example: { kind: 'schematic', input: 'Photos from your device and their answers', output: 'A picture round on the TV, or printed sheets', sampleIn: 'Baby photos of the family, one answer each', sampleOut: 'Pictures resized in the page, kept on this device, nothing uploaded' },
    howTo: 'How to make a picture round for a quiz',
    cta: 'Make a picture round'
  },

  /* ------------------------------------------------- landing pages: category board, survey, charades, antakshari, icebreakers */
  '/games/classroom-review-game-board/': {
    persona: 'Teachers turning revision into a game before a test',
    hook: 'Turn the unit review into a game board.',
    pain: 'Revision lessons drag, and pupils switch off when it is just questions from the front.',
    usual: ['Questions read from the front', 'A hand-drawn grid on the board', 'A clicker nobody understands'],
    promise: 'Five topics, five questions each, scores kept on the projector.',
    steps: ['Type the five topics', 'Fill each square, easy to hard', 'Teams pick a square and score'],
    proof: TV,
    example: { kind: 'schematic', input: 'Five topics, with questions easy to hard', output: 'A review board for the projector', sampleIn: 'Topic 1 to 5, rows worth 100 to 500', sampleOut: 'Used squares grey out; one square is a hidden double' },
    howTo: 'How to turn a class review into a quiz board game',
    cta: 'Build a review board'
  },
  '/games/family-survey-game/': {
    persona: 'Families at Diwali and Christmas, kids against grown-ups',
    hook: 'Kids against grown-ups: guess the top answers.',
    pain: 'Family game night needs something every age can join in, and the usual board games take half an hour to explain.',
    usual: ['Board games with long rules', 'A quiz only the adults can win', 'Everyone on their phones'],
    promise: 'Kids v grown-ups survey game on the TV, with a steal.',
    steps: ['Keep or edit the questions', 'Press Play, check the teams', 'Press an answer to reveal'],
    proof: TV,
    example: { kind: 'schematic', input: 'A question and its hidden answers', output: 'A survey board on the TV for two teams', sampleIn: 'Kids and Grown-ups; name something found in a kitchen', sampleOut: 'Three strikes, then the other team can steal the board' },
    howTo: 'How to play a family survey game for the TV',
    cta: 'Play kids v grown-ups'
  },
  '/games/bollywood-dumb-charades-movie-names/': {
    persona: 'Families and friends who love Bollywood and dumb charades',
    hook: 'Bollywood dumb charades. Film names dealt for you.',
    pain: 'Thinking up fresh film names makes the host the only one who cannot play.',
    usual: ['Film names written on chits', 'The same few films again and again', 'The host who cannot play'],
    promise: 'Bollywood films dealt one at a time, on the actor’s screen only.',
    steps: ['Pick two teams and start', 'Pass the phone to the actor', 'Press Got it or Skip'],
    proof: ['Free', 'Word kept off the TV', 'Nothing uploaded'],
    example: { kind: 'schematic', input: 'The Bollywood films deck, two teams', output: 'One film at a time, on the actor’s phone', sampleIn: 'Bollywood films, 90 seconds, three skips', sampleOut: 'The clock and scores on the TV; the film is never sent there' },
    howTo: 'How to play Bollywood dumb charades with a phone',
    cta: 'Play Bollywood charades'
  },
  '/games/charades-ideas-for-kids/': {
    persona: 'Parents and teachers playing charades with young children',
    hook: 'Charades ideas for kids, without the stuck word.',
    pain: 'Young players freeze on a hard word, and a parent can only think of the same three animals.',
    usual: ['The same few animals', 'Words too hard for little ones', 'A child stuck while the clock runs'],
    promise: 'Easy words, 120 seconds a turn and five skips, so nobody is stuck.',
    steps: ['Keep the kids’ deck', 'Press Start game', 'Press Got it, or Skip'],
    proof: ['Free', 'Word kept off the TV', 'Nothing uploaded'],
    example: { kind: 'schematic', input: 'The easy kids’ deck and a turn length', output: 'One easy word at a time for the actor', sampleIn: 'Easy words, 120 seconds, five skips', sampleOut: 'Animals, actions and characters; none repeats in a game' },
    howTo: 'How to play charades with young children',
    cta: 'Play kids’ charades'
  },
  '/games/antakshari-for-a-family-party/': {
    persona: 'Families at a party, with grandparents who know every song',
    hook: 'Antakshari for the whole family, and a fair letter.',
    pain: 'Family antakshari gets noisy: whose turn, which letter, and how long did they take?',
    usual: ['Shouting out the next letter', 'Counting seconds on a phone', 'Scores kept in somebody’s head'],
    promise: 'Two teams, 45 seconds a turn, three rounds with a rule each.',
    steps: ['Keep two teams and 45 seconds', 'Press Start timer', 'Tap last sound, Next team'],
    proof: ['Free', 'Plays no music', 'Nothing uploaded'],
    example: { kind: 'schematic', input: 'Two teams, a clock and a rule for each round', output: 'A fair random letter and the scores', sampleIn: 'Round 2: songs from one decade', sampleOut: 'The rule shows on the TV; the team sings, the host decides' },
    howTo: 'How to run antakshari at a family party',
    cta: 'Start the family game'
  },
  '/games/would-you-rather-questions-for-kids/': {
    persona: 'Parents, grandparents and teachers who need a good question',
    hook: 'Would you rather? A silly choice every time.',
    pain: 'Car journeys, dinner tables and wet playtimes call for a game, and you cannot think of a question.',
    usual: ['Making up questions on the spot', 'The same questions as last time', 'Screens to fill the silence'],
    promise: 'Would-you-rather cards in large type, never repeated.',
    steps: ['Open the kids’ deck', 'Press Draw a card', 'Everyone answers and says why'],
    proof: FREE,
    example: { kind: 'schematic', input: 'The would-you-rather deck', output: 'One question in large type', sampleIn: 'Press Draw a card', sampleOut: 'A card on the TV; no repeat until the deck is used' },
    howTo: 'How to play would you rather with kids',
    cta: 'Draw a question'
  },
  '/games/icebreaker-questions-for-meetings/': {
    persona: 'Meeting hosts, team leads and club organisers',
    hook: 'A friendly first minute for any meeting.',
    pain: 'People join a call and stare at their screens, and the first minutes are dead air.',
    usual: ['"Can everyone hear me?" and silence', 'A round of "how was the weekend"', 'Starting late while people arrive'],
    promise: 'One conversation starter on screen, a minute each, nothing personal.',
    steps: ['Open the conversation starters', 'Press Draw a card', 'A minute each, then start'],
    proof: FREE,
    example: { kind: 'schematic', input: 'The conversation-starters deck, a 60-second timer', output: 'One question on the screen to share', sampleIn: 'Draw a card as people join', sampleOut: 'A question on screen; the timer rings but never moves on' },
    howTo: 'How to start a meeting with an icebreaker question',
    cta: 'Draw an icebreaker'
  }
};
