/**
 * The reading part of the live audience tools (/live/), rendered by
 * build-depth.js in its file-and-text shape (howItWorks in place of
 * formula). Shape and rules: build-depth.js and build/content/_check.js.
 * One entry for each of the five tool pages. The landing pages (class
 * game-landing) are the same tool with a preset and carry no block of their own.
 *
 * Every figure comes from a run on 28 October 2026 of the page's own
 * counting code: each tool's engine file (engine/room-live-poll.js,
 * room-word-cloud.js, room-audience-qa.js, room-rating-scale.js and
 * room-live-presentation.js) loaded in Node with its browser-only half
 * switched off, and the functions the page itself calls (the tool's
 * `maths`) fed the phone messages written out below. The script is kept
 * with the wave's notes as E:/tmp/live-depth-out/runs.js and its output as
 * runs.json. Nothing in these runs involved the relay, so they say nothing
 * about speed or phone limits; the phone limit is quoted from the page.
 * Every figure is the same each time the script runs.
 */
'use strict';

module.exports = {
  '/live/live-poll/': {
    term: 'a live poll',
    whatIs: [
      'A show of hands only counts the people who dare to raise one. A live poll puts the question on the big screen and lets every person answer from a phone, so the shy and the quick are counted the same.',
      'Here the presenter types a question and up to ten answers, the room joins with a six-digit code, and the bars grow as the votes come in.'
    ],
    howItWorks: {
      text: 'Each phone has an id that stays the same if the connection drops. The vote is kept against that id in the presenter’s browser, and the totals are worked out there.',
      points: [
        'Answers are typed one per line. Blank lines and repeats are dropped, ignoring capitals, and the list stops at ten.',
        'A vote counts if the answer exists, voting is open, and the phone has not voted yet. With changes allowed, a second tap replaces the first vote instead of adding one.',
        'Percentages are whole numbers that add up to 100. Each answer gets the rounded-down share, then the leftover points go to the largest fractions.',
        'Closing voting stops new votes at once. Phones see the totals only if the presenter chooses to show them.'
      ]
    },
    worked: {
      text: 'The answers Tuesday, wednesday, Tuesday again, a blank line, Thursday and Friday became four answers: Tuesday, wednesday, Thursday and Friday. Thirteen phones voted, then one phone changed its mind, so the count stayed at 13 votes and came out 2, 3, 3 and 5. The shares were 15, 23, 23 and 39 per cent, which add up to 100. Plain rounding would have given 15, 23, 23 and 38, a total of 99.'
    },
    uses: [
      ['Lesson starter', 'Ask what the class already knows and let the answers decide where you begin.'],
      ['Event choices', 'Let the room pick the next topic, song or winner.'],
      ['Team decisions', 'Settle a date in a minute instead of a long message thread.']
    ],
    mistakes: [
      'Typing two answers that differ only by capitals. They count as one, and the second is dropped.',
      'Expecting a closed question to take late votes. Press C again to reopen it first.',
    ],
    faq: [
      { q: 'Why do the percentages never show 99 or 101?', a: 'Each share is rounded down first, and the points left over go to the answers with the biggest remainders. That keeps the total at exactly 100.' },
      { q: 'What happens to a vote cast just as I close voting?', a: 'Once voting is closed the page refuses new votes, so only votes that arrived before you pressed C are counted.' },
      { q: 'Can I run two polls in one session?', a: 'Yes. Ask the next question in the same session and the earlier results stay in the list and in the CSV. A different tool needs its own session and its own code.' }
    ],
    related: ['/live/rating-scale/', '/live/word-cloud/', '/live/live-presentation/'],
    runs: [
      { browser: { page: '/live/live-poll/', via: 'the page’s own maths, run in Node', answers: 'Tuesday, wednesday, Tuesday, blank, Thursday, Friday', phones: 13, changeAllowed: 'one phone moved to Friday' }, shown: ['13 votes', '2, 3, 3 and 5', '15, 23, 23 and 39', '15, 23, 23 and 38', '99', '100'] }
    ]
  },

  '/live/word-cloud/': {
    term: 'a live word cloud',
    whatIs: [
      'A word cloud turns many short answers into one picture. The words that most people typed are the biggest, so the mood of a room shows at a glance.',
      'The presenter asks for a word or two, each phone sends its answers, and the cloud on the big screen grows as they arrive.'
    ],
    howItWorks: {
      text: 'Answers are grouped, counted once per phone and drawn so that no two words touch.',
      points: [
        'Capitals and spaces are ignored when words are grouped, so “Team Work”, “teamwork” and “TEAMWORK” are one word. The form most people typed is the one shown; on a tie the first one sent wins.',
        'A phone may send as many words as the presenter allowed, from 1 to 3, each up to 25 characters. A phone cannot send the same word twice.',
        'Size follows the square root of the count. The most common word is about a fifth of the screen height, and the smallest is between 12 and 16 pixels.',
        'Each word is placed on a spiral from the centre at the first free spot. A word that finds no room is made smaller, then left out.'
      ]
    },
    worked: {
      text: 'With two words allowed per phone, six phones sent ten answers. Phone 1 sent Team Work, Growth and then a third word, which was refused because it was over the limit. Phone 3 sent TEAMWORK and then teamwork again, which was refused as a repeat. A 26-character word was refused as too long. The cloud held three words: Team Work with 3, growth with 3 and Change with 1. Team Work came first because it was sent first.'
    },
    uses: [
      ['Check-in', 'Ask for one word on how the week went and read the room.'],
      ['Before a lesson', 'Find out what pupils already link to the topic.'],
      ['Workshops', 'Let the most common ideas grow big so the group sees where it agrees.']
    ],
    mistakes: [
      'Allowing three words when you want one clear answer. Set the limit to 1.',
      'Reading the size as a ranking of importance. It shows only how many phones sent that word.',
      'Leaving the mask off for a public room. Rude words then show as typed until you hide them.'
    ],
    faq: [
      { q: 'Why did two spellings join into one word?', a: 'Words are matched ignoring capitals and spaces, so they count together. The big screen shows the spelling most phones used.' },
      { q: 'Does hiding a word delete it?', a: 'No. It leaves the big screen and the phones, and the count stays. Press Show to bring it back.' },
      { q: 'Why is a long word smaller than I expected?', a: 'Sizes are shrunk together until all words fit in under half the screen area. A word that cannot fit is tried smaller and then left out.' }
    ],
    related: ['/live/live-poll/', '/live/audience-qa/', '/live/live-presentation/'],
    runs: [
      { browser: { page: '/live/word-cloud/', via: 'the page’s own maths, run in Node', wordsPerPhone: 2, phones: 6, answers: 10, longWord: '26 characters' }, shown: ['Team Work with 3', 'growth with 3', 'Change with 1', 'three words'] }
    ]
  },

  '/live/audience-qa/': {
    term: 'an audience Q&A board',
    whatIs: [
      'At the end of a talk the hands that go up are not always the questions most people want answered. A Q&A board lets everyone send a question and then vote for the ones that matter.',
      'The presenter reads the board in order of demand, so the most wanted question is answered first.'
    ],
    howItWorks: {
      text: 'Questions are kept in the presenter’s browser. Phones receive only the ones the presenter has let onto the board.',
      points: [
        'Approval is on by default. A new question waits on the presenter’s page and reaches the board and the phones only after Approve.',
        'A phone can send up to 10 questions of up to 280 characters, and the board holds at most 500.',
        'Each phone has one upvote per question, and tapping again takes it back. Questions that are waiting, hidden or answered cannot be voted on.',
        'The order is unanswered questions first, then the most upvotes, then the oldest.'
      ]
    },
    worked: {
      text: 'Three questions arrived with approval on and all three waited. A vote on a waiting question was refused. After approval, one phone voted for “Is the recording shared?”, a second phone did too, and the first phone’s repeat tap was refused. A third phone voted for “Can we see the budget?”, and the first phone then took its vote back. Both questions ended on 1 vote, so the older came first. “When is the next release?” had been marked answered and moved to the bottom. One phone tried 12 questions and 10 were accepted.'
    },
    uses: [
      ['Conference talks', 'Collect questions while the speaker talks and answer the most wanted first.'],
      ['Town halls', 'Let people ask without standing up, with approval to filter the board.'],
      ['Lectures', 'Find the gaps in understanding before the lecture ends.']
    ],
    mistakes: [
      'Switching approval off in an open room. Every question then goes straight to the board.',
      'Expecting a phone to send more than 10 questions. Extra ones are refused.',
      'Hunting for an answered question near the top. Answered questions sink to the bottom.'
    ],
    faq: [
      { q: 'Why did a question not appear on the phones?', a: 'It is probably still waiting for approval. Press Approve next to it on the presenter’s page.' },
      { q: 'What does Spotlight do to the order?', a: 'Nothing. It shows one question large on the big screen while you answer it. Press it again to go back to the board.' },
      { q: 'Can the same person vote for their own question?', a: 'A phone has one upvote on any question on the board, its own included. A different phone is a different voter.' }
    ],
    related: ['/live/live-poll/', '/live/rating-scale/', '/live/live-presentation/'],
    runs: [
      { browser: { page: '/live/audience-qa/', via: 'the page’s own maths, run in Node', approval: 'on', questions: 3, phonesVoting: 3, questionsTriedByOnePhone: 12 }, shown: ['1 vote', 'moved to the bottom', '10 were accepted', '12 questions'] }
    ]
  },

  '/live/rating-scale/': {
    term: 'a live rating',
    whatIs: [
      'An average alone can hide a split room. A room that all says 5 and a room split between 0 and 10 both average 5, yet they mean different things.',
      'This tool collects one rating from each phone and shows the average, the spread and every score in a histogram, so you can see both.'
    ],
    howItWorks: {
      text: 'The scale is chosen by the presenter, and the numbers are worked out in the presenter’s browser from the ratings held.',
      points: [
        'Stars run from 1 to 5. The buttons and the slider run from 0 to 10. Only whole numbers on the scale are accepted.',
        'A phone has one rating. Rating again replaces it until the presenter closes the question.',
        'The average is the mean of the ratings. The spread is the standard deviation, which is the typical distance from the average.',
        'The histogram has a bar for every value on the scale, including the empty ones.'
      ]
    },
    worked: {
      text: 'Ten phones rated on the 0 to 10 scale with 8, 9, 9, 10, 7, 2, 9, 8, 10 and 3. The average was 7.5 and the spread 2.7. The histogram showed one 2, one 3, one 7, two 8s, three 9s and two 10s. A rating of 11 was refused, and so was 4.5. On the five-star scale, six phones gave 5, 4, 4, 3, 5 and 5, which averaged 4.3 with a spread of 0.7.'
    },
    uses: [
      ['After a session', 'Ask how useful it was and see whether opinions were split.'],
      ['Mid-lesson check', 'Ask how clear the last ten minutes were, on a slider.'],
      ['Comparing options', 'Run the same scale twice and compare the averages.']
    ],
    mistakes: [
      'Judging by the average alone. Check the spread and the histogram too.',
      'Mixing scales between questions and comparing the averages. A 5-star mean and a 0 to 10 mean are not alike.',
      'Rating outside the scale. A value that is not a whole number on the scale is refused.'
    ],
    faq: [
      { q: 'Is the spread the same as the range?', a: 'No. The range is the lowest and highest rating. The spread is the standard deviation of all ratings, so one odd score moves it less than it moves the range.' },
      { q: 'Does the spread divide by the count or by one less?', a: 'By the count. It describes the ratings in the room, not a sample taken from a larger group.' },
      { q: 'Why does the average show one decimal?', a: 'The page rounds to one place for display. The CSV and the histogram hold the whole counts.' }
    ],
    related: ['/live/live-poll/', '/live/word-cloud/', '/live/live-presentation/'],
    runs: [
      { browser: { page: '/live/rating-scale/', via: 'the page’s own maths, run in Node', scale: '0-10 buttons', phones: 10, ratings: '8, 9, 9, 10, 7, 2, 9, 8, 10, 3', stars: '5, 4, 4, 3, 5, 5', refused: '11 and 4.5' }, shown: ['7.5', '2.7', '4.3', '0.7', 'three 9s'] }
    ]
  },

  '/live/live-presentation/': {
    term: 'a live interactive presentation',
    whatIs: [
      'A deck of slides is usually one-way. Here some slides are questions, and the room answers them on phones while you present.',
      'You prepare the deck in advance, the room joins once with one code, and every phone follows you from slide to slide.'
    ],
    howItWorks: {
      text: 'The deck is edited and saved on the presenter’s laptop. Answers are counted there as well, one per phone, and slides are sent to phones as you move.',
      points: [
        'A deck holds up to 50 slides of eight kinds: multiple choice, timed quiz, open answers, word cloud, rating, Q&A, leaderboard and plain text.',
        'A quiz slide takes 5 to 120 seconds and one right answer. A right answer scores 1000 at once, falling evenly to 500 at the deadline, and a wrong or missing answer scores 0.',
        'The leaderboard sorts by points. Equal points are split by the total time of the right answers, fastest first, and a tie on both shares a place.',
        'Results are kept for every slide. Going back shows them, and phones see totals and right answers only after Reveal.'
      ]
    },
    worked: {
      text: 'A right answer 5,000 milliseconds into a 20-second question scored 875. Right answers at 0, 10 and 20 seconds scored 1000, 750 and 500, and a wrong answer scored 0. Five players then stood as follows. Asha and Ben both had 2,750 points, Asha with 9,000 ms of right-answer time and Ben with 12,500, so Asha took first place and Ben second. Cy and Di tied on 1,000 points and on time, so both took third place. Eli, on 0 points, was fifth.'
    },
    uses: [
      ['Quiz night', 'Run timed rounds with a leaderboard after each and a podium at the end.'],
      ['Training day', 'Mix a rating, a word cloud and the room’s questions in one deck.'],
      ['Lessons', 'Check understanding with a quiz, then ask what was hardest.']
    ],
    mistakes: [
      'Marking more than one right answer on a quiz slide. Only the first one counts.',
      'Setting a very short timer. A quiz slide can be as short as 5 seconds, which is hard to read on a phone.',
      'Showing results before everyone has answered. Leave the results hidden until you press R.'
    ],
    faq: [
      { q: 'Does a quiz question close early?', a: 'Yes. It closes when the timer ends or when every player in the room has answered.' },
      { q: 'Why did two players share third place?', a: 'Places are shared only when both the points and the right-answer time are equal. Otherwise the faster player ranks higher.' },
      { q: 'What if a deck file has too many slides?', a: 'Only the first fifty are opened. The rest are ignored.' }
    ],
    related: ['/live/live-poll/', '/live/word-cloud/', '/live/rating-scale/'],
    runs: [
      { browser: { page: '/live/live-presentation/', via: 'the page’s own maths, run in Node', limit: '20 seconds', answerTimes: '0, 5000 ms, 10, 20 seconds', totals: 'Asha 2750 and 9000 ms, Ben 2750 and 12500 ms, Cy 1000 and 3000 ms, Di 1000 and 3000 ms, Eli 0' }, shown: ['875', '1000, 750 and 500', '2,750 points', 'first place', 'third place', 'fifth'] }
    ]
  }
};
