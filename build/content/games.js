/**
 * The reading part of the Quiz & Party Games (/games/), rendered by
 * build-depth.js in its file-and-text shape (howItWorks in place of
 * formula). Shape and rules: build-depth.js and build/content/_check.js.
 * One entry for each of the 13 game pages; the landing pages (class
 * game-landing) are the same game with a preset and carry no block of their own.
 *
 * Every figure comes from a run on 27 October 2026 in headless Chrome
 * (puppeteer-core, Chrome's new headless mode) against a local server of the
 * site: `node build/tests/serve.js <worktree> 9000`, then each page opened as
 * a person would open it, and the page's own code called there: the game's
 * spec.maths (the same functions its buttons call), TambolaCore (the Tambola
 * tickets and calls) and QuizCore (the quiz answer marking). The script that
 * made them is kept with the wave's notes as E:/tmp/promo-out/runs.js and its
 * output as runs.json. Counts of random draws (the 24,000 spins below) change
 * from run to run; every other figure is the same each time. Deck sizes are
 * counted from the decks that ship with the page, so they change when a deck
 * is edited; the page FAQs say "more than 80" or "more than 150" on purpose.
 */
'use strict';

module.exports = {
  '/games/team-generator/': {
    term: 'a fair random team',
    whatIs: [
      'Splitting a room into teams sounds easy until somebody feels picked last or the two cousins who always win end up together. A fair split has two parts: every person is equally likely to land anywhere, and the team sizes stay level.',
      'This page deals the names the way a dealer shares cards, then lets you add rules on top: a skill number, or a list of people to keep apart.'
    ],
    howItWorks: {
      text: 'The names are shuffled with the browser’s own secure random numbers and dealt out in turn, so no team is favoured and no seat is.',
      points: [
        'For a random split the shuffled list is dealt round the teams, which keeps the sizes within one of each other.',
        'Balanced teams sort the players by their number, break ties at random, and deal in a snake: teams 1 to 4, then 4 back to 1, and so on.',
        'A keep-apart line sends the deal round again until those names sit in different teams, and the page names any line it cannot meet.',
        'Nothing is sent anywhere: the list lives in the page, and is stored on the device only if you tick the box.'
      ]
    },
    worked: {
      text: 'In a run on a fresh page, fourteen names dealt into four teams came out as 3, 3, 4 and 4 people. Thirty names in teams of four made 8 teams, two of them with only 3 people at first glance of the sizes: they came out 3, 3 and then six teams of 4. Ten players marked 10 down to 1 and dealt into two balanced teams gave totals of 27 and 28. A line keeping three names apart held in all 200 splits of fourteen names into three teams.'
    },
    uses: [
      ['Cousins at Diwali', 'Mix the generations so the same family does not win every game.'],
      ['Sports day', 'Two even sides from a list of players marked by ability.'],
      ['School groups', 'Keep two friends apart.']
    ],
    mistakes: [
      'Mixing scales when you add skills. Use one range, such as 1 to 5.',
      'Typing a keep-apart name differently from the list. The names must match exactly or the page warns that it cannot find them.'
    ],
    faq: [
      { q: 'Why did my teams not all come out the same size?', a: 'Names rarely divide evenly. The sizes differ by one at most, so fourteen names in four teams give two teams of 4 and two of 3.' },
      { q: 'What happens if I press the button again?', a: 'You get a fresh shuffle. The page does not remember or reuse the earlier split, so press it as often as you like.' },
      { q: 'Does a skill number change who is picked?', a: 'Only in balanced mode, where it decides the order of the deal. In random mode the numbers are ignored.' }
    ],
    runs: [
      { browser: { page: '/games/team-generator/', names: 14, teams: 4, balancedSkills: '10..1 into 2 teams', keepApart: 'three names, 3 teams, 200 splits', teamsOfFour: '30 names' }, shown: ['3, 3, 4 and 4', '27 and 28', 'all 200 splits', '8 teams'] }
    ]
  },

  '/games/spin-the-wheel/': {
    term: 'a prize wheel',
    whatIs: [
      'A spinning wheel is the oldest way to settle who goes first. The fun is in the spin; the fairness has to come from somewhere else, because a wheel animation on a screen is only a picture.',
      'Here the winner is decided first, and the picture is then turned to match. That order is what keeps the odds honest however long the spin lasts.'
    ],
    howItWorks: {
      text: 'Each entry owns slices in proportion to its weight, and the winner is a draw over the total weight.',
      points: [
        'A line such as Sweets*4 gives that entry a weight of 4. A line with no star has a weight of 1, and a weight is held between 1 and 50.',
        'The page adds up the weights, draws one whole number below the total with the secure random generator, and walks along the entries until it reaches the owner of that number.',
        'The wheel is then rotated to put that slice under the pointer, so the animation cannot change the result.',
        'With remove-the-winner ticked, the winning line is deleted from the list a moment after the spin.'
      ]
    },
    worked: {
      text: 'Three prizes typed as Grand prize*1, Sweets*4 and Sticker*3 gave weights of 1, 4 and 3, a total of 8. In one run of 24,000 draws on the page, Grand prize came up 2,987 times, Sweets 12,031 times and Sticker 8,982 times, which is close to one eighth, a half and three eighths. A list of 120 names was cut to 100 entries, and a line marked *99 was held to a weight of 50.'
    },
    uses: [
      ['Prize table', 'Make the big prize thin and the sweets wide so every child wins something.'],
      ['Who answers next', 'Take each pupil off the wheel after a turn so everyone gets one.'],
      ['Family decisions', 'Choose the film or the takeaway.']
    ],
    mistakes: [
      'Typing the same name twice by accident. A repeated name is twice as likely.',
      'Expecting no repeats. Without the remove option, the same entry can win twice running.'
    ],
    faq: [
      { q: 'Can I see the chances before I spin?', a: 'Yes. The slice widths are the chances, and the count under the box shows entries and slices. In the run above, a weight of 4 in a total of 8 meant a slice half the wheel wide.' },
      { q: 'What does a very long name do?', a: 'It is shortened with an ellipsis on the wheel to fit its slice. The winner is still announced in full below the wheel.' },
      { q: 'Will the TV spin at the same moment?', a: 'The host page sends the spin to the TV window, which turns the same wheel to the same result, so the two screens agree.' }
    ],
    runs: [
      { browser: { page: '/games/spin-the-wheel/', entries: 'Grand prize*1, Sweets*4, Sticker*3', draws: 24000, listLength: 120, heavyWeight: '*99' }, shown: ['1, 4 and 3', '2,987 times', '12,031 times', '8,982 times', '100 entries', 'weight of 50'] }
    ]
  },

  '/games/scoreboard/': {
    term: 'a quiz scoreboard',
    whatIs: [
      'A quiz scoreboard has a small job done at the worst moment: totals must be right when the room is loud and someone wants the standings now. Paper and mental arithmetic are where the arguments start.',
      'This one keeps every point in a table of teams and rounds, so a total is always the sum of what you can see.'
    ],
    howItWorks: {
      text: 'The state is one small record of teams, rounds and points, and every button changes it in a way that can be undone.',
      points: [
        'Points are added to the team in the round shown as Scoring round, and a total is the sum of that team’s rounds.',
        'A joker marks one round for a team and doubles that round’s points when the totals are worked out, minus points included.',
        'Ranks count how many teams have a higher total, so equal totals share a rank and the next rank is skipped.',
        'Every change is saved in the browser as it happens, and Undo and Redo walk back and forward through up to 300 steps.'
      ]
    },
    worked: {
      text: 'With four teams, adding 5 points to Team 1 and playing its joker in round 1 gave it 10, and adding 7 to Team 2 gave 7. After a second round, with 4 more for Team 1 and 3 for Team 3, the totals were 14, 7, 3 and 0. Totals of 14, 7, 7 and 3 were ranked 1, 2, 2 and 4. The CSV file opened with the columns Rank, Team, Round 1, Round 2, Joker round and Total. The page held a game to 12 teams, even when asked for 20.'
    },
    uses: [
      ['Pub or club quiz', 'Put up to 12 teams and their round scores on one screen.'],
      ['House points in school', 'Keep a week of points on the teacher’s laptop and show the standings on Friday.'],
      ['Family game night', 'Let the youngest hold the keyboard and enter the points.']
    ],
    mistakes: [
      'Scoring into the wrong round. Check the Scoring round list before you add points, or pick the earlier round to correct it.',
      'Forgetting that a joker is for one round only. Playing it again in a later round is refused.'
    ],
    faq: [
      { q: 'Why do two teams show the same rank?', a: 'Equal totals share a rank. Totals of 14, 7, 7 and 3 are ranked 1, 2, 2 and 4, as in most sports tables.' },
      { q: 'Does a negative score count against a joker?', a: 'Yes, the joker doubles minus points as well as plus points in the round where it is played.' },
      { q: 'Is the CSV file the same as the table?', a: 'It has one row for each team with the rank, every round, the joker round and the total, with jokers already doubled.' }
    ],
    runs: [
      { browser: { page: '/games/scoreboard/', teams: 4, actions: 'Team 1 +5 with joker, Team 2 +7, next round, Team 1 +4, Team 3 +3', ranksOf: '14, 7, 7, 3', teamsAsked: 20 }, shown: ['10', '14, 7, 3 and 0', '1, 2, 2 and 4', 'Rank, Team, Round 1, Round 2, Joker round and Total', '12 teams'] }
    ]
  },

  '/games/quiz-buzzer/': {
    term: 'a quiz buzzer',
    whatIs: [
      'Who pressed first is hard to judge by ear and impossible to judge by argument. A buzzer settles it by timing each press and ordering them, so the host announces a result instead of a guess.',
      'This buzzer runs on one device: a tablet with a big pad for each team, or a keyboard with a key for each.'
    ],
    howItWorks: {
      text: 'Every press carries the time stamp the browser gave it, and the winner is the earliest stamp, not the first press the page handled.',
      points: [
        'A press is stored with its team and its time. The list is sorted by time, so the first entry is the winner.',
        'The gap shown beside each other team is its time minus the winner’s.',
        'Wrong locks that team out and clears the list, so the others can press again; Reset brings every team back.',
        'A team that has already pressed, or is locked out, is ignored, so the list never holds one team twice.'
      ]
    },
    worked: {
      text: 'In a run with three teams, team 3 pressed at 5012.4 ms, team 1 at 5011.9 ms and team 4 at 5030 ms on the shared clock. Team 1 won, although its press was handled second, and the other two were listed 0.5 ms and 18.1 ms behind. Pressing Wrong locked team 1 out and opened the buzzer. A later press from team 1 was ignored.'
    },
    uses: [
      ['Family quiz night', 'Put one tablet in the middle of the table, with a pad for each team.'],
      ['Revision in class', 'Let each table press for the answer; the first table to press speaks.'],
      ['Fastest finger round', 'Give each of four players a key on a keyboard.']
    ],
    mistakes: [
      'Using the keyboard while a name box has focus. The keys then type into the box; click outside it first.',
      'Letting two players share one key. The page keeps the first key and tells you.'
    ],
    faq: [
      { q: 'Can I set a time to answer?', a: 'Yes, choose off or a time from 5 to 30 seconds. It starts at the first press and sounds a low tone at zero, but the host still decides.' },
      { q: 'Is a zero in the gap column a fault?', a: 'Browsers round time stamps slightly, so two presses within a fraction of a millisecond can show the same time.' },
      { q: 'What do the host keys do?', a: 'R resets, C marks the answer correct and W marks it wrong. They cannot be given to a team.' }
    ],
    runs: [
      { browser: { page: '/games/quiz-buzzer/', presses: 'team 3 at 5012.4, team 1 at 5011.9, team 4 at 5030', then: 'Wrong, then a second press by the locked team' }, shown: ['5012.4 ms', '5011.9 ms', '5030 ms', '0.5 ms', '18.1 ms'] }
    ]
  },

  '/games/tambola-number-caller/': {
    term: 'a Tambola caller',
    whatIs: [
      'Tambola, also called Housie, is played with tickets of fifteen numbers drawn from 1 to 90. One person calls the numbers; everyone marks their ticket; the first to complete a pattern shouts.',
      'The caller’s job is to draw fairly, never repeat, and check a claim honestly. The page does all three.'
    ],
    howItWorks: {
      text: 'The page keeps the list of numbers called, and each draw is made from the numbers still left.',
      points: [
        'It lists the numbers not yet called, draws one position with the secure random generator, and adds that number to the list.',
        'A ticket number such as K7MPQ2-014 holds a set code and a ticket count. The same ticket generator rebuilds that exact ticket from it.',
        'A claim is checked by marking the called numbers on the rebuilt ticket and testing each prize pattern.',
        'The game is saved in the browser after every call, so a refresh keeps the board and the winners.'
      ]
    },
    worked: {
      text: 'Calling until nothing was left gave 90 numbers, all different, and a further draw returned nothing. Ticket K7MPQ2-014 was rebuilt from its number into the same ticket each time, and it belongs to the third strip. Marking only the first row of ticket K7MPQ2-001 won the top line, but not Full House. With four of its numbers called, Early Five needed one more.'
    },
    uses: [
      ['Diwali at home', 'Play round the TV with the numbers on the big board.'],
      ['Kitty party', 'Set auto-call so the host can play too.'],
      ['Care home or club', 'Use the large board and the spoken calls for players who cannot see a small list.']
    ],
    mistakes: [
      'Expecting Hindi without a Hindi voice on the device. The page says so and calls in English.',
      'Refreshing while auto-call runs. The game stays, but the timer stops until you start it again.'
    ],
    faq: [
      { q: 'Can I check a ticket that was not made here?', a: 'No. A claim is checked from the ticket number, so only tickets made by the Tambola Ticket Generator can be rebuilt.' },
      { q: 'Does the spoken call leave the device?', a: 'The numbers are spoken by the device’s own voices. Only when a browser has just an online voice does its voice service receive the spoken words, and the page tells you.' },
      { q: 'Can I take back a wrong call?', a: 'Yes. Undo last call puts the number back among those still to be drawn.' }
    ],
    runs: [
      { browser: { page: '/games/tambola-number-caller/', draws: 'until none left', ticket: 'K7MPQ2-014 rebuilt twice', claims: 'first row of K7MPQ2-001; four numbers called' }, shown: ['90 numbers', 'third strip', 'top line', 'one more'] }
    ]
  },

  '/games/tambola-ticket-generator/': {
    term: 'a Tambola ticket',
    whatIs: [
      'A proper Tambola ticket has three rows and nine columns, with five numbers in every row and the numbers of each column drawn from its own tens. Making a hundred of them by hand, with no repeats in a strip, is an evening’s work.',
      'A strip is six tickets that together use every number from 1 to 90 exactly once, so each number called lands on one ticket of the strip.'
    ],
    howItWorks: {
      text: 'A short set code seeds a shuffle, so the same code always makes the same tickets and nothing needs to be stored.',
      points: [
        'For each strip the page shuffles the numbers of every column and deals them out to the six tickets, with a count for each ticket and column.',
        'It then chooses which cells on each ticket are filled, so every row has five numbers and every column is sorted from top to bottom.',
        'The ticket number joins the set code to the ticket’s count, which is how the caller can rebuild it later.',
        'The PDF and the ticket pictures are drawn in the browser from the same tickets.'
      ]
    },
    worked: {
      text: 'The first strip of set code K7MPQ2 held 6 tickets of 15 numbers each, 90 numbers in all, and every number from 1 to 90 appeared exactly once. Every row held five numbers, and every number sat in the column for its tens. Ticket number 14 of the set belongs to the third strip, and asking for it again gave the same grid. A request for 24 tickets makes 4 strips.'
    },
    uses: [
      ['Kitty party', 'Print twelve tickets a page with the host’s name in the title.'],
      ['Video call', 'Make ticket pictures and send each player theirs on WhatsApp.'],
      ['Temple or society event', 'Print several strips and cut along the dashed lines.']
    ],
    mistakes: [
      'Changing the number of tickets and expecting the same set. Use the same code and the same count to reprint exactly.',
      'Using Download PDF for a Hindi title. Its fonts cannot draw Hindi, so print from the browser instead.'
    ],
    faq: [
      { q: 'Can two tickets in a set be identical?', a: 'Not in practice. The tickets of a strip share no number, and the strips are drawn from different shuffles.' },
      { q: 'Must I record who holds which number?', a: 'Only if you want to know who won. The ticket number alone is enough to check any claim.' },
      { q: 'Why are tickets made in sixes?', a: 'Six tickets are what it takes to cover 1 to 90 once, so a strip is the smallest set where every call is certain to land somewhere.' }
    ],
    runs: [
      { browser: { page: '/games/tambola-ticket-generator/', setCode: 'K7MPQ2', strip: 1, ticketAgain: 14, tickets: 24 }, shown: ['6 tickets of 15 numbers', '90 numbers', 'third strip', '4 strips'] }
    ]
  },

  '/games/bingo-card-generator/': {
    term: 'a bingo card',
    whatIs: [
      'Bingo comes in two common shapes: the American 75-ball game on a five-by-five card, and word or picture bingo, where the squares hold anything you like.',
      'A card is a small puzzle with rules: no repeats on a card, each column kept to its own range, and cards that differ enough that two people do not shout together.'
    ],
    howItWorks: {
      text: 'Each card is built from the set code and its number, so the same inputs rebuild the same card.',
      points: [
        'A 75-ball card takes five different numbers from each column range: 1 to 15 under B, 16 to 30 under I, and so on to 61 to 75 under O.',
        'The centre is a free square, so the card holds 24 numbers.',
        'A word card shuffles your list and takes as many words as it has squares, never repeating a word on a card.',
        'The caller draws from what has not been called, for numbers or words alike, and shows each number with its letter.'
      ]
    },
    worked: {
      text: 'Card number 1 of the set ABC234 held five different numbers in each of five columns, and its centre was empty as the free square. A five by five card with a free centre needs 24 words, a three by three card needs 9 and a four by four card needs 16. Calling a 75-ball game to the end gave 75 numbers with no repeats. Number 7 was called as B 7 and number 42 as N 42.'
    },
    uses: [
      ['Baby shower', 'Make word cards from baby words and tick them as presents are opened.'],
      ['Spelling practice', 'Put this week’s words on the cards and read out the meanings.'],
      ['Family bingo night', 'Print four to a page and call the numbers on the TV.']
    ],
    mistakes: [
      'Giving fewer words than squares. The page says how many more you need.',
      'Reordering your word list and expecting the old cards. The same list in a different order makes different cards.'
    ],
    faq: [
      { q: 'Why do my word cards look so alike?', a: 'With only as many words as squares, every card holds the same words in a different order. A longer list makes the cards more different.' },
      { q: 'Does the caller work for word bingo?', a: 'Yes. It draws your words fairly and shows the last five, so players can check what was called.' },
      { q: 'Can I print one card to a page?', a: 'Yes. One, two or four to a page, on A4 or US Letter, which suits younger players and older eyes.' }
    ],
    runs: [
      { browser: { page: '/games/bingo-card-generator/', setCode: 'ABC234', card: 1, squares: '3x3, 4x4, 5x5 with free centre', callAll: 75 }, shown: ['24 words', '9', '16', '75 numbers', 'B 7', 'N 42'] }
    ]
  },

  '/games/quiz-maker/': {
    term: 'a home-made quiz',
    whatIs: [
      'A good home quiz has a rhythm: a question, a pause, an answer, a score. Most of the effort goes into the plumbing, such as slides, sheets and arithmetic, rather than the questions.',
      'The page holds the quiz, shows each question on the TV, keeps your answer on your own screen, and adds up for you.'
    ],
    howItWorks: {
      text: 'A quiz is a list of rounds of typed questions. Marking a typed answer is done by comparing words, not letters.',
      points: [
        'The given answer and the real answer are lowercased, stripped of accents and punctuation, and the words “the”, “a” and “an” are dropped.',
        'A word of five to eight letters may have one slip, a word of nine or more two; shorter words must be exact.',
        'Spellings you list under Also accept count as right answers.',
        'Number questions accept a tolerance, and understand 1,066 and twenty-one alike.'
      ]
    },
    worked: {
      text: 'Against the answer “The Eiffel Tower”, the typed answer “EIFFEL TOWER!” was accepted as exact. Photosynthesis typed as “photosyntesis” was accepted with one slip, and “phtosyntesis” with two, because the word has 13 letters. The answer “cats” for “cast” was refused, because a four-letter word allows no slip. With a tolerance of 5, 1,066 was accepted for 1070 and 1,080 was refused. “Twenty-one” was read as 21.'
    },
    uses: [
      ['Pub or club quiz', 'Print answer sheets for each table and show questions on the projector.'],
      ['Christmas quiz', 'Start from a ready-made pack and swap in your own picture round.'],
      ['Class recap', 'Ten questions at the end of a topic, marked live on the board.']
    ],
    mistakes: [
      'Adding a picture to a quiz you want to share by link. Links carry up to 60 questions without pictures; use Export file for a picture round.',
      'Leaving a question with no note. Your note appears only on your page, so it is the place for a fact to say aloud.'
    ],
    faq: [
      { q: 'How forgiving is the marking?', a: 'It ignores capitals, accents, punctuation and the words the, a and an. One slip is allowed in a word of 5 to 8 letters and two in a word of 9 or more.' },
      { q: 'Can I reorder questions?', a: 'Yes. Drag a question, or use Alt with the up or down arrow.' },
      { q: 'What stands behind each ready-made question?', a: 'Quizzes written for the site, each question with a source for its answer and a date it was last checked.' }
    ],
    runs: [
      { browser: { page: '/games/quiz-maker/', code: 'QuizCore.checkText, checkNumber', answers: 'The Eiffel Tower; photosynthesis; cast; 1070 within 5; 21' }, shown: ['EIFFEL TOWER!', 'photosyntesis', 'phtosyntesis', '13 letters', 'cats', '1,080', 'Twenty-one', '1,066'] }
    ]
  },

  '/games/category-board/': {
    term: 'a category quiz board',
    whatIs: [
      'A board of categories and points turns a quiz into a choice: which topic, how hard, how much to risk. It suits a classroom review because the class decides the order and the questions come from the unit.',
      'The board here is a grid of squares worth 100 points in the top row, rising by 100 for each row.'
    ],
    howItWorks: {
      text: 'The board is a grid of categories across and rows down, and each square holds a question, an answer and a state.',
      points: [
        'A square’s points are 100 times its row, counting from the top as 1.',
        'When you start the game, one square is picked as the double with a secure random draw, each square equally likely.',
        'Right gives the square’s points to a team, doubled on the double; Wrong, if switched on, takes off the same amount.',
        'A used square greys out, and when none remain the TV shows the final scores.'
      ]
    },
    worked: {
      text: 'The row values on the page came out as 100, 200, 300, 400, 500 and 600 for rows 1 to 6. On a five by five board there are 25 squares, and across 25,000 draws every square was chosen between 945 and 1,074 times, close to the 1,000 each that equal chances give. The last square of the grid sits in column 5 and row 5.'
    },
    uses: [
      ['Review before a test', 'Five topics from the unit, played by teams for a point of pride.'],
      ['Family games night', 'Mix categories for every age and let the youngest pick first.'],
      ['Office social', 'A quick board on the projector to open a meeting.']
    ],
    mistakes: [
      'Putting the hard questions at the top. The top row is worth the least, so keep it easy.',
      'Shrinking the board and expecting the hidden squares to be lost. The text in them is kept until you enlarge the board again.'
    ],
    faq: [
      { q: 'Can the host see which square is the double?', a: 'No. It is drawn at the start and stays hidden even from the host until a team picks it.' },
      { q: 'What does a wrong answer cost?', a: 'Nothing, unless you tick the box before you start. Then Wrong takes the square’s value off, and twice that on the double.' },
      { q: 'What does the printout contain?', a: 'Yes. You can print the board for a whiteboard version and a host’s sheet with every question and answer.' }
    ],
    runs: [
      { browser: { page: '/games/category-board/', board: '5 x 5', draws: 25000, rows: 6 }, shown: ['100, 200, 300, 400, 500 and 600', '25 squares', '945 and 1,074', 'column 5 and row 5', '1,000'] }
    ]
  },

  '/games/top-answers/': {
    term: 'a survey game',
    whatIs: [
      'In a survey game the right answer is the popular one. A question such as “Name something you take to the beach” has a handful of common answers, and teams score by guessing what a crowd would say.',
      'The page holds the board, the strikes and the steal, and keeps the points as the answers are found.'
    ],
    howItWorks: {
      text: 'Each question holds four to eight answers with points, hidden on the TV until a team finds them.',
      points: [
        'Pressing an answer reveals it and adds its points to the bank for the round.',
        'A wrong guess is a strike. Three strikes end the playing team’s turn.',
        'Then the other team gets one guess. If it is on the board, that team takes the whole bank plus that answer; if not, the first team keeps the bank.',
        'The playing team swaps each question, and the scores carry to the final screen.'
      ]
    },
    worked: {
      text: 'Using the beach question with six answers, team A found Towel for 30 points. Two strikes later the game was still in play, and the third strike moved it to the steal, which is three strikes in all. If the other team missed, A kept 30 and B none. When B instead found Swimsuit for 18, the bank came to 48 and all of it went to B.'
    },
    uses: [
      ['Kids against grown-ups', 'Ask questions every age can answer.'],
      ['Office social', 'Survey colleagues beforehand and play back the answers.'],
      ['Classroom', 'Ask the class “name a fruit”, then play the result back as a game.']
    ],
    mistakes: [
      'Writing a question with one right answer. A survey needs many plausible answers.',
      'Inventing the points and presenting them as a real survey. The example points are made up; use your own count.'
    ],
    faq: [
      { q: 'Can I add another spelling?', a: 'Yes. Put it under Also accept and a typed guess of it counts.' },
      { q: 'What if nobody gets the steal?', a: 'The playing team keeps the bank. The round ends and the unfound answers can be revealed.' },
      { q: 'How many questions can a game hold?', a: 'As many as you add. The game shows the final scores after the last one.' }
    ],
    runs: [
      { browser: { page: '/games/top-answers/', question: 'Name something you take to the beach (6 answers)', actions: 'reveal Towel, three strikes, then a steal missed or Swimsuit found' }, shown: ['30 points', 'three strikes', 'Swimsuit for 18', '48'] }
    ]
  },

  '/games/charades-generator/': {
    term: 'a game of dumb charades',
    whatIs: [
      'Dumb charades needs a steady supply of words that are neither too easy nor too obscure, and a way to keep them secret. Folded paper does the second, but runs out and gets peeked at.',
      'The page deals words from a shuffled deck, keeps the word on the actor’s screen only, and times each turn.'
    ],
    howItWorks: {
      text: 'The deck is shuffled once, from a game code, and the words are dealt in that order, so none repeats.',
      points: [
        'The same game code, deck, level and words give the same order, which is how a game can be continued.',
        'The clock counts down from the device’s own time, so a hidden or slow tab still ends the turn on time.',
        'Got it adds to the team’s score; Skip costs no points but uses up one of the turn’s skips.',
        'The TV window is sent the team, the clock and the scores, and never the word.'
      ]
    },
    worked: {
      text: 'Counting the decks that ship with the page gave 175 Bollywood films, 172 Hollywood films, 101 animals, 84 actions, 91 jobs, 104 objects, 110 easy words for children, 80 for Christmas and 80 for Diwali. The Bollywood deck held 53 easy, 91 medium and 31 hard words. With harder words worth more, an easy word scores 1, a medium word 2 and a hard word 3.'
    },
    uses: [
      ['Family evening', 'Two teams of cousins, Bollywood films and a ninety-second clock.'],
      ['Children’s party', 'Easy words and plenty of skips.'],
      ['Festival gatherings', 'Use the Diwali or Christmas deck for a themed round.']
    ],
    mistakes: [
      'Opening “See every word in this deck” during play. It spoils the game; use it to check the deck beforehand.',
      'Passing the phone without cover mode. Anyone looking over a shoulder can read the word.'
    ],
    faq: [
      { q: 'Can I carry on after a phone call interrupts?', a: 'Yes. A game in progress is saved on the device, and Continue the last game picks up at the start of the turn.' },
      { q: 'What is the most my own list can hold?', a: 'Yes, up to 300 words of 60 characters, one for each line. They are kept only if you tick the box to keep them.' },
      { q: 'How is a film deck made?', a: 'From well-known family-friendly films, each with a year, and marked easy, medium or hard.' }
    ],
    runs: [
      { browser: { page: '/games/charades-generator/', decks: 'GAME_WORDS.charades.decks parsed by the page', levels: 'Bollywood deck by difficulty' }, shown: ['175 Bollywood films', '172 Hollywood films', '101 animals', '84 actions', '91 jobs', '104 objects', '110 easy words', '53 easy, 91 medium and 31 hard', '80 for Christmas'] }
    ]
  },

  '/games/antakshari/': {
    term: 'an antakshari game',
    whatIs: [
      'Antakshari is a singing game: one team sings a song, and the next sings one that starts with the last sound of the first. The arguments are usually about the letter, the time and the score, not the songs.',
      'The page deals with those three and leaves the singing to you. It holds no music, lyrics or song titles.'
    ],
    howItWorks: {
      text: 'The page picks the starting letter and keeps the clock and the scores. The team supplies everything else.',
      points: [
        'The letter is drawn with equal chance from the letters in play, using the secure random generator.',
        'You may leave out letters. The ones that remain are still equally likely.',
        'After a song, you tap or type its last sound and the next team receives it.',
        'Each round carries a rule that is shown on the TV; the game displays it but does not enforce it.'
      ]
    },
    worked: {
      text: 'The Hindi set held 30 consonants, or 40 with the vowels included. The English set held 26 letters, and 23 after X, Q and Z were left out. Choosing both alphabets with vowels gave 66 letters in play. The game allows 2 to 4 teams and up to 8 rounds.'
    },
    uses: [
      ['Family party', 'Two teams, forty-five seconds a turn and a rule for each decade.'],
      ['Wedding evening', 'Put the letter and clock on the projector for tables of guests.'],
      ['Journey', 'Play on one phone with no signal.']
    ],
    mistakes: [
      'Expecting the page to check the song. It cannot; the host decides whether a song counts.',
      'Choosing a rule so strict that nobody can answer. Start with any song.'
    ],
    faq: [
      { q: 'Why are some Hindi letters missing?', a: 'The letters ङ, ञ and ण are left out because words seldom begin with them, and the vowels join only if you tick the box.' },
      { q: 'Can I redraw the letter?', a: 'Yes, before the clock starts. It is a fresh equal-chance draw, so use it only when the host agrees.' },
      { q: 'Does it need a connection?', a: 'No. After the first visit it opens offline, and a game in progress is saved.' }
    ],
    runs: [
      { browser: { page: '/games/antakshari/', sets: 'letterSet hi, hi with vowels, en, en without X Q Z, both with vowels' }, shown: ['30 consonants', '40 with the vowels', '26 letters', '23 after X, Q and Z', '66 letters'] }
    ]
  },

  '/games/icebreaker-cards/': {
    term: 'a set of question cards',
    whatIs: [
      'An icebreaker is a question light enough to answer in front of strangers and interesting enough to start a conversation. The best are short, concrete and optional.',
      'The decks here are written to be kind: nothing about bodies, money, religion or politics, and nothing that assumes a particular home or family.'
    ],
    howItWorks: {
      text: 'The deck is shuffled once and dealt in order, so a card does not return until you have been through the lot.',
      points: [
        'Draw shows the next card in large type; Back shows the previous one again.',
        'Skip sets a card aside until you shuffle again.',
        'The optional timer rings after 30, 60 or 90 seconds but never moves the game on.',
        'Favourites and your place in the deck are saved on the device only.'
      ]
    },
    worked: {
      text: 'Counting the decks that ship with the page gave 82 Would you rather cards, 87 conversation starters, 93 this-or-that cards, 84 classroom get-to-know-you cards and 86 party questions. That is 432 cards in five decks, and no card is shown twice until its deck is used up.'
    },
    uses: [
      ['Family dinner', 'One card each, read out by the youngest.'],
      ['First week of term', 'The classroom deck on the board, a minute for each answer.'],
      ['Team meeting', 'A conversation starter on screen while people join.']
    ],
    mistakes: [
      'Using the party deck with children. It is written for adults; choose a family deck.',
      'Expecting to add your own questions. The decks are fixed in this version.'
    ],
    faq: [
      { q: 'How do I go back to a card I liked?', a: 'Press the heart on it. It joins Favourites, which you can show again or copy.' },
      { q: 'Can I swipe on a tablet?', a: 'Yes. Drag left for the next card and right to go back.' },
      { q: 'What does Skip do to the order?', a: 'The skipped card is set aside and does not return until you shuffle again.' }
    ],
    runs: [
      { browser: { page: '/games/icebreaker-cards/', decks: 'GAME_WORDS.icebreaker.decks parsed by the page' }, shown: ['82 Would you rather cards', '87 conversation starters', '93 this-or-that cards', '84 classroom', '86 party questions', '432 cards'] }
    ]
  }
};
