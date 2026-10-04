'use strict';
/* Kit v2 story data: Text & Writing Tools. Contract: kit2-schema.md, sections 1 and 2.
   Text examples open the tool with ?text= (mountCode) and read the output pane,
   so every input below runs against the tool's default options. */
module.exports = {
  '/text/word-counter/': {
    persona: 'Students, writers and job applicants',
    hook: 'The limit is 150 words. Are you at 140 or 165?',
    pain: 'The application box cuts you off without warning. You need the exact count before you paste.',
    usual: ['Word processors that count differently', 'Counter sites smothered in adverts', 'Counting by hand down the page'],
    promise: 'Paste your text. See words, characters, sentences and reading time.',
    steps: ['Paste or type your text', 'Read the counts', 'Trim to the limit'],
    proof: ['Free', 'Nothing uploaded', 'Works offline once opened'],
    example: {
      kind: 'text',
      input: 'I have spent four years running the front desk of a busy veterinary practice. I book appointments, calm worried owners and keep the vets on time. I want to move into practice management because I already do half the job: rotas, supplier orders and the monthly figures. I learn quickly, I stay calm when the waiting room is full, and I am good with people on their worst days.'
    },
    howTo: 'How to count words and characters',
    cta: 'Count your words'
  },
  '/text/text-diff/': {
    persona: 'Editors, landlords and reviewers',
    hook: 'They said they changed one line. Did they?',
    pain: 'The “final” version came back from the other side. Reading both copies side by side, you will miss something.',
    usual: ['Reading two versions line by line', 'Track changes someone switched off', 'Printing both and using a highlighter'],
    promise: 'Paste both versions. See every added, removed and changed line.',
    steps: ['Paste the old version', 'Add --- and the new one', 'Read the differences'],
    proof: ['Free', 'Nothing uploaded', 'Works offline once opened'],
    example: {
      kind: 'text',
      input: 'Rent is due on the 1st of each month.\nLate payment fee: £25.\nNotice period: 2 months.\nPets allowed with consent.\n---\nRent is due on the 1st of each month.\nLate payment fee: £50.\nNotice period: 1 month.\nPets allowed with consent.'
    },
    howTo: 'How to compare two texts and find the changes',
    cta: 'Compare texts'
  },
  '/text/readability-score/': {
    persona: 'Writers of letters, policies and blogs',
    hook: 'Would a 12-year-old follow your letter?',
    pain: 'Your policy letter keeps getting the same questions back. Long sentences may be the reason.',
    usual: ['Guessing whether it reads clearly', 'Asking a colleague who is too polite', 'Checkers that want an account to score'],
    promise: 'Paste the text. Get Flesch, Kincaid, Fog and SMOG scores.',
    steps: ['Paste your text', 'Read the scores', 'Shorten the long sentences'],
    proof: ['Free', 'Nothing uploaded', 'Works offline once opened'],
    example: {
      kind: 'text',
      input: 'In accordance with the provisions of the aforementioned agreement, residents are hereby notified that, notwithstanding any previous correspondence, the communal refuse collection arrangements will be subject to modification with effect from the commencement of the forthcoming quarter, and any consequential enquiries should be directed to the administrative office.'
    },
    howTo: 'How to check the reading level of your writing',
    cta: 'Check readability'
  },
  '/text/case-tools/': {
    persona: 'Admins cleaning lists and exports',
    hook: 'The mailing list has the same address three times.',
    pain: 'You pasted three exports into one list. Now it is full of duplicates and stray spaces.',
    usual: ['Sorting in a spreadsheet and squinting', 'Deleting duplicates one by one', 'Formulas you have to look up again'],
    promise: 'Paste the list. Remove duplicates, sort, trim or strip tags.',
    steps: ['Paste your text', 'Pick the clean-up action', 'Copy the tidy result'],
    proof: ['Free', 'Nothing uploaded', 'Works offline once opened'],
    example: {
      kind: 'text',
      input: 'priya@example.com\nsam@example.com\n  priya@example.com\nanna@example.com\nlee@example.com\njo@example.com\nanna@example.com  \npriya@example.com'
    },
    howTo: 'How to remove duplicate lines from a list',
    cta: 'Clean up text'
  },
  '/text/number-to-words/': {
    persona: 'Anyone writing a cheque or contract',
    hook: 'Writing 2,450 on a cheque? Spell it right first time.',
    pain: 'The cheque needs the amount in words, and you are not sure where the “and” goes.',
    usual: ['Spelling it out and second-guessing', 'Searching the web mid-cheque', 'A cheque returned for one wrong word'],
    promise: 'Type the number. Get it in words, ready to copy.',
    steps: ['Type the number', 'Pick plain, currency or Indian', 'Copy the words'],
    proof: ['Free', 'Nothing uploaded', 'Works offline once opened'],
    example: { kind: 'text', input: '2450\n18750\n1000000' },
    howTo: 'How to write a number in words for a cheque',
    cta: 'Spell a number'
  },
  '/text/morse-code/': {
    persona: 'Puzzle fans, scouts and the curious',
    hook: 'Your message in dots and dashes, in one line.',
    pain: 'The escape-room clue is a row of dots and dashes, and the reference chart is in another tab.',
    usual: ['Decoding letter by letter from a chart', 'Apps full of adverts for one phrase', 'Mixing up letter and word gaps'],
    promise: 'Type text or paste Morse. It encodes or decodes on its own.',
    steps: ['Type text or Morse', 'Read the translation', 'Copy it'],
    proof: ['Free', 'Nothing uploaded', 'Works offline once opened'],
    example: { kind: 'text', input: 'MEET AT THE OLD MILL' },
    howTo: 'How to translate text to Morse code',
    cta: 'Translate Morse'
  },
  '/text/caesar-cipher/': {
    persona: 'Teachers, puzzlers and students',
    hook: 'Write a secret message the class can crack.',
    pain: 'You are running a code-breaking lesson and need coded messages, plus a way to crack them live.',
    usual: ['Shifting letters by hand on paper', 'Slips in a 26-letter shift table', 'Puzzle apps behind a sign-up'],
    promise: 'Type a message, pick a shift, or let it try every shift.',
    steps: ['Type the message', 'Pick a shift or ROT13', 'Copy the result'],
    proof: ['Free', 'Nothing uploaded', 'Works offline once opened'],
    example: { kind: 'text', input: 'Meet me by the library at noon.' },
    howTo: 'How to encode a message with a Caesar cipher',
    cta: 'Try the cipher'
  },
  '/text/palindrome-anagram/': {
    persona: 'Word-game fans and quiz setters',
    hook: 'Is “dormitory” really an anagram of “dirty room”?',
    pain: 'You are setting a quiz and want to be sure the anagram clue works before it goes out.',
    usual: ['Counting letters on your fingers', 'Quiz answers that turn out wrong', 'Word sites full of pop-ups'],
    promise: 'Type the phrases. See if they are palindromes or anagrams.',
    steps: ['Type each phrase on a line', 'Read the checks', 'Fix the clue if needed'],
    proof: ['Free', 'Nothing uploaded', 'Works offline once opened'],
    example: { kind: 'text', input: 'Was it a car or a cat I saw\nDormitory\nDirty room' },
    howTo: 'How to check if two phrases are anagrams',
    cta: 'Check a phrase'
  },
  '/text/password-generator/': {
    persona: 'Anyone setting up a new account',
    hook: 'Your dog’s name plus 123 is not a password.',
    pain: 'Every site wants a new password with a symbol and a number, so you keep using the same three.',
    usual: ['Reusing one password everywhere', 'Pet names with a number on the end', 'Generators you cannot see inside'],
    promise: 'Set the length and rules. Get a random password or passphrase.',
    steps: ['Set the length', 'Pick characters or words', 'Copy it to your manager'],
    proof: ['Free', 'Runs in your browser', 'Nothing uploaded'],
    example: {
      kind: 'schematic',
      input: 'A length and the characters or words to use',
      output: 'A random password or passphrase, made in the browser',
      sampleIn: 'Length 20 · letters, digits and symbols · no lookalikes',
      sampleOut: 'A fresh 20-character password with no l, 1, I, O or 0 to misread'
    },
    howTo: 'How to make a strong random password',
    cta: 'Make a password'
  }
};
