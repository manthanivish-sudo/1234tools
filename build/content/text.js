/**
 * The reading part of the Text tools, rendered by build-depth.js in its
 * file-and-text shape (howItWorks in place of formula). Shape and rules:
 * build-depth.js and build/content/_check.js.
 *
 * Every figure in a worked example comes from a run of the page's own engine
 * (its TEXT_TOOLS spec, transform or generate), recorded in `runs` with its
 * input and options; build/content/_check.js runs each one again in Node and
 * compares. The password generator is random, so only its deterministic
 * figures (entropy, pool size, cracking time) are quoted, never a password.
 */
'use strict';

module.exports = {
  '/text/caesar-cipher/': {
    term: 'a Caesar cipher',
    whatIs: [
      'A Caesar cipher replaces every letter with the one a fixed number of places further along the alphabet, wrapping from Z back to A. Suetonius wrote that Julius Caesar used a shift of three, hence the name.',
      'There are only 25 useful keys, and word lengths, capitals and punctuation all survive the shift, which makes it the classic first lesson in how patterns give a code away.'
    ],
    howItWorks: {
      text: 'The cipher is one regular expression in the page’s script: each A–Z or a–z character is replaced and everything else stays put.',
      points: [
        'A letter becomes a number from 0 to 25, the shift is added (or subtracted to decode) and the sum wrapped with `% 26`. Capitals stay capitals; é, digits and emoji are left alone.',
        'Try every shift decodes the text with all 26 shifts and scores each candidate by the average English frequency of its letters, from a fixed table in which e is 12.7% and z 0.07%.',
        'The highest average gets the star. It is a plain average, not a chi-squared test, so a short message gives it little to go on.'
      ]
    },
    worked: {
      text: 'Encode “Fix my bike” with a shift of 7 to get “Mpe tf iprl”. Paste that back with Try every shift and the star lands on 11, “Bet iu xega”, while the real message sits unmarked on row 7. Encode “Fix my bike before the race on Saturday morning” the same way and the cracker picks 7 unaided: nearly forty letters give the score something to measure. A shift of 19 also turns “Mpe tf iprl” back into “Fix my bike”: together, 7 and 19 go once round.'
    },
    uses: [
      ['Code-breaking lessons', 'Let the cracker succeed on a paragraph and fail on three words.'],
      ['Puzzle hunts', 'Use an unusual shift so solvers must find the key.'],
      ['Geocache hints', 'Cache listings often hide their hints in ROT13; decode one on the trail.']
    ],
    mistakes: [
      'Decoding with Encode selected. A message shifted by 3 needs Decode with 3, or Encode with 23.',
      'Trusting the star on a message of a few words. Read down all 26 rows yourself.'
    ],
    faq: [
      { q: 'How do you crack a Caesar cipher without the key?', a: 'Try all 25 shifts and keep the one that reads as language; Try every shift does that in one step.' },
      { q: 'Is a Vigenère cipher harder to break?', a: 'Yes. Its keyword moves neighbouring letters by different amounts, which smears out the letter frequencies, although it still falls once the keyword length is known, as Friedrich Kasiski showed in 1863.' },
      { q: 'Does the cipher change numbers too?', a: 'No. Variants such as ROT5 rotate digits and ROT47 every printable ASCII character; this tool shifts letters only.' }
    ],
    runs: [
      /* encode the short message, shift 7 */
      { input: 'Fix my bike', options: { mode: 'shift', shift: '7', dir: 'enc' }, check: [['output', 'Mpe tf iprl']] },
      /* crack the short ciphertext: the star lands on the wrong shift */
      { input: 'Mpe tf iprl', options: { mode: 'crack' }, check: [['stat:Most likely shift', '11'], ['stat:Best candidate', 'Bet iu xega']] },
      /* the longer sentence, encoded with shift 7, then cracked */
      { input: 'Fix my bike before the race on Saturday morning', options: { mode: 'shift', shift: '7', dir: 'enc' }, check: [['output', 'Mpe tf iprl']] },
      { input: 'Mpe tf iprl ilmvyl aol yhjl vu Zhabykhf tvyupun', options: { mode: 'crack' }, check: [['stat:Most likely shift', '7'], ['stat:Best candidate', 'Fix my bike before the race on Saturday morning']] },
      /* encoding with 19 undoes a shift of 7 */
      { input: 'Mpe tf iprl', options: { mode: 'shift', shift: '19', dir: 'enc' }, check: [['output', 'Fix my bike']] }
    ]
  },

  '/text/case-tools/': {
    term: 'line-based text clean-up',
    whatIs: [
      'Most lists that need tidying hold one record per line, pasted from a spreadsheet, an export or a web page. Cleaning means applying one rule to every line.',
      'Two details decide whether the result is right: what counts as the same line when capitals or trailing spaces differ, and what order means, since dictionary order is not character-code order, where every capital comes first.'
    ],
    howItWorks: {
      text: 'The text is split at line breaks and the chosen action runs over the resulting lines.',
      points: [
        'Duplicates are tracked in a `Set` keyed by the trimmed line, lower-cased with Ignore case, but the line that survives keeps its own spacing and capitals.',
        'The A–Z sorts use the browser’s `localeCompare`, so capitals and small letters interleave and Özil files among the O names instead of after zane.',
        'Numeric sort reads each line with `parseFloat`; a line not starting with a number counts as 0.',
        'Strip HTML deletes anything from < to > within each line and turns `&nbsp;` into a space; no other entity is decoded.'
      ]
    },
    worked: {
      text: 'Paste four lines of markup: <p class="intro">Open daily</p>, a link whose opening tag breaks across two lines, and <p>Tea &amp; cake&nbsp;from £3</p>. Strip HTML cuts 115 characters to 78 and returns Open daily cleanly, but <a href="/menu" survives and the next line still starts title="Menu">See the menu: each line is stripped alone, and neither half is a whole tag. The last line becomes Tea &amp; cake from £3, the non-breaking space converted and the ampersand entity left as it was.'
    },
    uses: [
      ['Mailing lists', 'Merge sign-up sheets and drop the addresses that appear twice.'],
      ['Stock lists', 'Sort part numbers numerically and remove blank lines before an import.'],
      ['Raffles and rotas', 'Shuffle a list of names into an order nobody chose.']
    ],
    mistakes: [
      'De-duplicating email addresses case-sensitively. Mail systems treat Anna@ and anna@ as one mailbox in practice, so choose Ignore case.',
            'Reversing text that contains emoji. The reversal works on UTF-16 code units, so each emoji is split in two and comes out broken.'
    ],
    faq: [
      { q: 'How do I remove duplicates ignoring capitals?', a: 'Choose Ignore case first. From Room 12, room 12, Room 12 with trailing spaces, Room 3 and ROOM 3, case-sensitive matching kept 4 lines and ignoring case kept 2, each spelt as it first appeared.' },
      { q: 'Why does my sorted list differ from Excel’s order?', a: 'Excel ignores hyphens and apostrophes when sorting text; this page does not, so co-op sorts before cook here.' },
      { q: 'Is Strip HTML safe for untrusted markup?', a: 'No. Tags split over lines and every entity but &nbsp; survive it, so never put its output back into a page as HTML.' }
    ],
    runs: [
      /* four lines of markup, the link's opening tag broken over two lines; Strip HTML */
      { input: '<p class="intro">Open daily</p>\n<a href="/menu"\n   title="Menu">See the menu</a>\n<p>Tea &amp; cake&nbsp;from £3</p>', options: { action: 'strip' }, check: [['stat:Characters in', '115'], ['stat:Characters out', '78'], ['output', 'Open daily'], ['output', '<a href="/menu"'], ['output', 'title="Menu">See the menu'], ['output', 'Tea &amp; cake from £3']] },
      /* the FAQ's room list, case-sensitive (default) */
      { input: 'Room 12\nroom 12\nRoom 12  \nRoom 3\nROOM 3', options: { action: 'dedupe' }, check: [['stat:Lines out', '4']] },
      /* the same list, ignoring case */
      { input: 'Room 12\nroom 12\nRoom 12  \nRoom 3\nROOM 3', options: { action: 'dedupe', ci: 'no' }, check: [['stat:Lines out', '2']] }
    ]
  },

  '/text/morse-code/': {
    term: 'Morse code',
    whatIs: [
      'Morse code writes each character as a short run of dots and dashes. Samuel Morse and Alfred Vail devised it for the electric telegraph in the late 1830s; the international form agreed in Paris in 1865 is now set out by the ITU in Recommendation ITU-R M.1677-1 (October 2009).',
      'The commonest letters got the shortest codes, E a single dot and T a single dash, while every digit takes five signals.'
    ],
    howItWorks: {
      text: 'Translation is a lookup in a table of 54 characters held in the page: A to Z, 0 to 9 and 18 punctuation marks, read one way to encode and reversed to decode.',
      points: [
        'Encoding upper-cases the text, writes each space as / and drops any character missing from the table, naming it under Unsupported characters.',
        'Decoding splits words at / or | and letters at whitespace; a group of signals not in the table becomes ?.',
        'Symbols out counts the dots, dashes and word slashes once the spaces are removed.',
        'A lone row of hyphens or full stops is detected as Morse, so choose Text → Morse to encode one.'
      ]
    },
    worked: {
      text: 'Encoding “Meet at Café Nero, 8:15” gives 58 symbols, but the É is skipped with a warning, so the café is sent as CAF. The ITU table does define an accented E as ..-.., which this tool lacks, so type a plain E if the name matters. Decoding has the opposite problem. Pasted without gaps, “...---...” comes back as a single ?, with 1 unrecognised symbol, while “... --- ...” gives SOS: the gaps carry as much meaning as the signals.'
    },
    uses: [
      ['Escape rooms', 'Write a clue in Morse, then decode it again to prove it reads.'],
      ['Amateur radio practice', 'Check a copied practice transmission letter by letter.'],
      ['Engraving', 'Turn a name or a date into a dot-and-dash pattern for a bracelet.']
    ],
    mistakes: [
      'Typing a dash that is not a hyphen. One em dash makes the whole input count as text, so “... — ...” is encoded, its dots becoming full stops (.-.-.-), instead of decoded.',
      'Expecting lower case back: Morse has no capitals.'
    ],
    faq: [
      { q: 'What is the Morse code for numbers?', a: 'Five signals each. 1 is a dot and four dashes, and each digit up to 5 swaps another dash for a dot; 6 to 0 swap them back, ending with 0 as five dashes.' },
      { q: 'How fast is Morse code sent?', a: 'Speed is quoted in words per minute, timed against PARIS, which is 50 dot-lengths with its gap. At 20 words per minute a dot lasts 60 milliseconds.' },
      { q: 'Is Morse code still used?', a: 'Yes: by radio amateurs and aviation navigation beacons, and as an input method, since Gboard offers a Morse keyboard.' }
    ],
    runs: [
      /* text with an accented letter, automatic direction */
      { input: 'Meet at Café Nero, 8:15', options: {}, check: [['stat:Symbols out', '58'], ['stat:Unsupported characters', 'É']] },
      /* SOS pasted with no letter gaps */
      { input: '...---...', options: {}, check: [['output', '?'], ['stat:Unrecognised symbols', '1']] },
      /* SOS with gaps */
      { input: '... --- ...', options: {}, check: [['output', 'SOS']] },
      /* the mistake: an em dash turns the input into text to encode */
      { input: '... — ...', options: {}, check: [['output', '.-.-.-'], ['stat:Unsupported characters', '—']] }
    ]
  },

  '/text/number-to-words/': {
    whatTitle: 'How numbers are written in words',
    whatIs: [
      'English names numbers in groups of three digits, each said as a number under a thousand followed by its scale word, so 4,050,017 is four million, fifty thousand and seventeen. Indian grouping pairs the digits after the first three, putting one lakh at 1,00,000 and one crore at 1,00,00,000.',
      'Cheques add words because words are harder to alter. Section 9(2) of the UK’s Bills of Exchange Act 1882 and section 18 of India’s Negotiable Instruments Act 1881 make the amount in words the one payable if the figures differ.'
    ],
    howItWorks: {
      text: 'Each line is converted separately. Commas, spaces and the £, $ and ₹ signs are removed first, so “£1,050.07” is read as 1050.07.',
      points: [
        'The whole part is divided by a billion, a million and a thousand (by crore, lakh and thousand in rupee style), and each group is spelt from tables of the words up to nineteen and the tens.',
        'Currency styles round the digits as typed to the penny, cent or paisa, half up, carrying into the whole part: 0.285 is twenty-nine pence and 2.999 is three pounds. Plain style reads every decimal digit after “point”.',
        'Ordinals change only the last word, from a short list of irregular forms and a rule that turns twenty into twentieth.'
      ]
    },
    worked: {
      text: 'Take 1,250,000.50. As pounds and pence it reads “One million two hundred and fifty thousand pounds and fifty pence only”. Typed the Indian way, ₹12,50,000.50 in rupee style becomes “Twelve lakh fifty thousand rupees and fifty paise only”: the same digits grouped differently. Plain style reads the half as “point five zero”, one word for each digit as typed.'
    },
    uses: [
      ['Cheques', 'Fill in the words line and check where the “and” goes before you sign.'],
      ['Contracts and invoices', 'State a fee in words as well as figures, as many purchase orders ask.'],
      ['Indian banking forms', 'Write amounts in lakh and crore for demand drafts and agreements.']
    ],
    mistakes: [
      'Pasting a figure with three decimal places onto a cheque. Currency styles round to the penny, so 2.999 comes out as “Three pounds only”; check the rounded amount is what you mean to pay.',
      'Leaving a euro sign on. Only £, $ and ₹ are stripped, so €40 is reported as not a number.'
    ],
    faq: [
      { q: 'How do you write 1,50,000 in words in rupees?', a: 'One lakh fifty thousand rupees only. Indian commas fall after the first three digits and then every two, so each lines up with thousand, lakh or crore.' },
      { q: 'Is it forty or fourty?', a: 'Forty. Four keeps its u in fourteen, but the tens word drops it, so 44 is Forty-four.' },
      { q: 'What is the largest number it can write?', a: '999,999,999,999, which begins Nine hundred and ninety-nine billion. A trillion or more is refused with a note.' }
    ],
    runs: [
      /* pounds and pence */
      { input: '1,250,000.50', options: { style: 'gbp' }, check: [['output', 'One million two hundred and fifty thousand pounds and fifty pence only']] },
      /* the same digits as rupees, Indian grouping */
      { input: '₹12,50,000.50', options: { style: 'inr' }, check: [['output', 'Twelve lakh fifty thousand rupees and fifty paise only']] },
      /* plain style */
      { input: '1250000.50', options: { style: 'plain' }, check: [['output', 'point five zero']] },
      /* three decimals round half up and carry; 0.285 is 29 pence; the euro sign is not stripped */
      { input: '2.999', options: { style: 'gbp' }, check: [['output', 'Three pounds only']] },
      { input: '0.285', options: { style: 'gbp' }, check: [['output', 'twenty-nine pence']] },
      { input: '€40', options: {}, check: [['output', 'not a number']] },
      /* the FAQ answers */
      { input: '1,50,000', options: { style: 'inr' }, check: [['output', 'One lakh fifty thousand rupees only']] },
      { input: '44', options: {}, check: [['output', 'Forty-four']] },
      { input: '999999999999', options: {}, check: [['output', 'Nine hundred and ninety-nine billion']] }
    ]
  },

  '/text/palindrome-anagram/': {
    whatTitle: 'What palindromes and anagrams are',
    whatIs: [
      'A palindrome reads the same backwards as forwards: a word such as level, or a sentence once spaces and punctuation are set aside. An anagram rearranges all the letters of one word or phrase into another, each used exactly as often, as earth does with heart.',
      'Both are judged on letters alone by convention. A strict reading, in which case and spaces count, can give a different verdict on the same text.'
    ],
    howItWorks: {
      text: 'Every non-empty line is tested as a palindrome; with two or more lines, the last two are also compared as anagrams.',
      points: [
        'Loose matching lower-cases each line and deletes everything except a–z and 0–9; exact matching uses the line as typed.',
        'The cleaned line is reversed character by character and compared with itself.',
        'For anagrams, the cleaned characters of each line are sorted and the two sorted strings compared, which amounts to comparing letter counts.'
      ]
    },
    worked: {
      text: 'Three lines: Never odd or even, Astronomer, Moon starer. With loose matching the panel reads Palindrome for line 1 and Anagrams for the last two lines. Switch to Exact characters and every check fails, Not a palindrome and Not anagrams, because capitals and spaces now count. Accents are a separate trap. The French palindrome “Ésope reste ici et se repose” is marked Not a palindrome even in loose mode: the cleaning deletes the É instead of reading it as e, leaving the line one letter short at the front.'
    },
    uses: [
      ['Crosswords and cryptic clues', 'Confirm that an anagram’s fodder uses exactly the letters of the answer.'],
      ['Coding practice', 'Test your own palindrome or anagram function against a second opinion.'],
      ['Palindromic dates', 'Try dates such as 02/02/2020, which pass in loose mode because digits are kept and slashes dropped.']
    ],
    mistakes: [
      'Putting the anagram pair anywhere but the end. Only the last two lines are compared, so any other lines go above them.',
      'Expecting Exact characters to forgive capitals. Racecar with a capital R is not an exact palindrome, although racecar is.'
    ],
    faq: [
      { q: 'What is the longest palindromic word in English?', a: 'Tattarrattat, coined by James Joyce in Ulysses for a knock at the door, is the longest in the Oxford English Dictionary at twelve letters.' },
      { q: 'What is a semordnilap?', a: 'A word that spells a different word backwards, such as stressed and desserts. It is not a palindrome, but the pair always share their letters, so the last-two-lines check reports them as Anagrams.' },
      { q: 'Is a single letter a palindrome?', a: 'Yes. A one-character line reads the same both ways and is marked as one; empty lines are skipped.' }
    ],
    runs: [
      /* loose matching (default) */
      { input: 'Never odd or even\nAstronomer\nMoon starer', options: { strict: 'loose' }, check: [['stat:Line 1', 'Palindrome'], ['stat:Last two lines', 'Anagrams']] },
      /* the same three lines, exact characters */
      { input: 'Never odd or even\nAstronomer\nMoon starer', options: { strict: 'strict' }, check: [['stat:Line 1', 'Not a palindrome'], ['stat:Last two lines', 'Not anagrams']] },
      /* an accented palindrome in loose mode */
      { input: 'Ésope reste ici et se repose', options: { strict: 'loose' }, check: [['stat:Line 1', 'Not a palindrome']] },
      /* the uses' date, the mistake's Racecar, the FAQ's semordnilap */
      { input: '02/02/2020', options: {}, check: [['stat:Line 1', 'Palindrome']] },
      { input: 'racecar\nRacecar', options: { strict: 'strict' }, check: [['stat:Line 1', 'Palindrome'], ['stat:Line 2', 'Not a palindrome']] },
      { input: 'stressed\ndesserts', options: {}, check: [['stat:Last two lines', 'Anagrams']] }
    ]
  },

  '/text/password-generator/': {
    term: 'password entropy',
    whatIs: [
      'Password strength is measured as entropy: the bits of randomness an attacker has to search. L characters drawn at random from a pool of N give L × log2(N) bits, and every extra bit doubles the guesses needed.',
      'That holds only for a random choice. A password built on a pattern, such as a word plus a year, has far less entropy than its length suggests.'
    ],
    howItWorks: {
      text: 'Each character or word is chosen with `crypto.getRandomValues`, the browser’s cryptographic generator.',
      points: [
        'Rejection sampling keeps it unbiased: a 32-bit draw in the top slice not divisible by the pool size is redrawn.',
        'The default pool is 80 characters: 25 lower-case letters (no l), 24 capitals (no I or O), 8 digits (no 0 or 1) and 23 symbols.',
        'Passphrases come from a built-in list of 510 four-letter words joined by hyphens, plus a number from 0 to 99 when digits are on. With capitals on, one more draw picks the capitalised word.',
        'The cracking time is 2 to the power of the entropy divided by a trillion guesses a second. No character type is forced in, so the entropy figure stays honest.'
      ]
    },
    worked: {
      text: 'A six-word passphrase with a number on the end scores 61 bits, from a pool of 510 words, with an offline cracking time of 1,759,629 seconds, about three weeks. Without the number it drops to 54 bits and 17,596 seconds, under the 60 bits the tool warns about. A 16-character password of letters and digits reaches 93 bits from a pool of 57 characters.'
    },
    uses: [
      ['New accounts', 'Make a different password for every site and paste it into a password manager.'],
      ['Wi-Fi keys', 'Generate a long router passphrase; WPA2 accepts 8 to 63 characters.'],
      ['Shared logins', 'Replace a guessable password on a team mailbox.']
    ],
    mistakes: [
      'Regenerating until one looks nice. Choosing between outputs by eye favours memorable patterns and lowers the real entropy; take the first.',
      'Switching symbols off for a fussy site without adding length. A smaller pool gives fewer bits per character, so add characters instead.'
    ],
    faq: [
      { q: 'How many bits of entropy does a strong password need?', a: 'Around 60 bits holds up against online guessing; against an offline attack on a leaked hash, aim for 80 or more. The 20-character default gives 126 bits.' },
      { q: 'How does a passphrase here compare with diceware?', a: 'Diceware rolls five dice per word to pick from 7,776 words, about 12.9 bits each. This list of 510 gives about 9 bits a word, so you need roughly 1.4 words here per diceware word.' },
      { q: 'Do lookalike characters make a password stronger?', a: 'Barely: letters and digits grow from 57 to 62 characters, taking 12 characters from 70 bits to 71 bits.' }
    ],
    runs: [
      /* six-word passphrase, digits on (other fields default) */
      { fields: { type: 'passphrase', words: 6 }, check: [['stat:Entropy', '61 bits'], ['stat:Character pool', '510 words'], ['stat:Offline cracking time*', '1,759,629 seconds']] },
      /* the same without the number */
      { fields: { type: 'passphrase', words: 6, digits: 'no' }, check: [['stat:Entropy', '54 bits'], ['stat:Offline cracking time*', '17,596 seconds'], ['warn', '60 bits']] },
      /* 16 characters, letters and digits, no symbols, lookalikes excluded */
      { fields: { type: 'password', length: 16, symbols: 'no' }, check: [['stat:Entropy', '93 bits'], ['stat:Character pool', '57 characters']] },
      /* the default: 20 characters, every type */
      { fields: {}, check: [['stat:Entropy', '126 bits'], ['stat:Character pool', '80 characters']] },
      /* 12 characters, no symbols, without and with lookalikes */
      { fields: { type: 'password', length: 12, symbols: 'no' }, check: [['stat:Entropy', '70 bits']] },
      { fields: { type: 'password', length: 12, symbols: 'no', ambiguous: 'include' }, check: [['stat:Entropy', '71 bits'], ['stat:Character pool', '62']] }
    ]
  },

  '/text/readability-score/': {
    term: 'a readability score',
    whatIs: [
      'A readability score estimates difficulty from sentence length and word length alone. Rudolf Flesch published Reading Ease in 1948; the Automated Readability Index (1967), SMOG (1969) and the Flesch-Kincaid grade, devised for the US Navy in 1975, weigh the same features differently.',
      'Grade scores are US school grades: add five or six for a reading age.'
    ],
    howItWorks: {
      text: 'The page’s script applies the published formulas, and declines to score fewer than 30 words.',
      points: [
        'Words are runs between spaces, so £5 is one. A sentence ends at . ! ? or … plus a space or the end.',
        'Syllables are estimated by rule: three letters or fewer is one; otherwise a final -e or -es after a consonant other than l is dropped and each group of one or two vowels, y included, counts once.',
        'Reading Ease is 206.835 − 1.015 × words per sentence − 84.6 × syllables per word; Flesch-Kincaid is 0.39 × words per sentence + 11.8 × syllables per word − 15.59.',
        'Gunning Fog and SMOG count any word of three or more estimated syllables as complex, with none of Gunning’s exceptions; the consensus is the mean of four grades.'
      ]
    },
    worked: {
      text: 'A 74-word letter home about a school trip, in 6 sentences, scores 85.7 for Reading Ease and grade 4.4, with 5 complex words. Add “Mr. Patel and Mrs. Okoye will travel with them.” and the counter finds 9 sentences where a reader sees seven, since the full stops after Mr and Mrs each end one. Reading Ease rises to 87.4 and the grade falls to 3.4: two abbreviations made the letter look easier. The rule also scores packed as two syllables and Science as one.'
    },
    uses: [
      ['Plain-English letters', 'Check a school or council letter before it reaches people reading in a hurry.'],
      ['Leaflets and forms', 'Score patient or customer material against the reading level your organisation sets.'],
      ['Choosing class texts', 'Pick passages whose grade level suits a year group.']
    ],
    mistakes: [
      'Scoring bullet points. Without full stops a list counts as one sentence and every score looks dire; score only the prose.',
      'Leaving headings in. A heading has no full stop, so it joins the sentence after it and makes that one look much longer.'
    ],
    faq: [
      { q: 'Can a readability score be negative?', a: 'Yes. Long sentences of long words push Reading Ease below zero, and very simple text can push a grade below zero, shown as below grade 1.' },
      { q: 'Does Microsoft Word calculate readability the same way?', a: 'Word reports Reading Ease and the Flesch-Kincaid grade from the same formulas, but counts syllables and sentences its own way, so the figures rarely match exactly.' },
      { q: 'How much text do I need for a reliable score?', a: 'At least 100 words, ideally several hundred; SMOG was designed for 30 sentences.' }
    ],
    runs: [
      /* a school-trip letter, six sentences */
      { input: 'Your child\'s class will visit the Science Museum on Friday 14 November. The coach leaves school at 8.45 am and returns by 3.30 pm. Please send a packed lunch in a bag with your child\'s name on it. Children should wear school uniform and bring a waterproof coat. The trip is free, but we welcome a voluntary contribution of £5 towards the coach. Reply by Monday so we can confirm numbers with the museum.', options: {}, check: [['stat:Words', '74'], ['stat:Sentences', '6'], ['stat:Flesch Reading Ease', '85.7'], ['output', '4.4'], ['stat:Complex words (3+ syllables)', '5']] },
      /* the same letter with the sentence naming Mr. Patel and Mrs. Okoye added after the first */
      { input: 'Your child\'s class will visit the Science Museum on Friday 14 November. Mr. Patel and Mrs. Okoye will travel with them. The coach leaves school at 8.45 am and returns by 3.30 pm. Please send a packed lunch in a bag with your child\'s name on it. Children should wear school uniform and bring a waterproof coat. The trip is free, but we welcome a voluntary contribution of £5 towards the coach. Reply by Monday so we can confirm numbers with the museum.', options: {}, check: [['stat:Sentences', '9'], ['stat:Flesch Reading Ease', '87.4'], ['output', '3.4']] }
    ]
  },

  '/text/text-diff/': {
    term: 'a text diff',
    whatIs: [
      'A diff lists the smallest set of removals and additions that turns one version of a text into the other. What it leaves out is the longest common subsequence: the lines or words both versions share, in the same order.',
      'It has no idea of a move. A paragraph cut from the top and pasted at the bottom shows as one removal and one addition.'
    ],
    howItWorks: {
      text: 'The input is cut at the first line holding only ---, and each half is split into lines, or into words in word mode.',
      points: [
        'A table of common-subsequence lengths, one cell per pair of units, is filled from the ends backwards, then walked from the start to mark each unit unchanged, removed (−) or added (+).',
        'Ties go to the removal, so a replaced block shows all its − lines before its + lines.',
        'The whitespace and case options change only the comparison, although trimmed lines are also shown trimmed.',
        'Similarity is twice the unchanged units divided by the units in both texts, as a percentage.'
      ]
    },
    worked: {
      text: 'Two versions of a site rule: “Deliveries arrive between 7am and 9am on weekdays. Drivers must sign in at the gatehouse and wear a high-visibility vest.” and the same with 6am, “and Saturdays” and “a hard hat”. Line mode can only report a replaced line: 1 added, 1 removed, similarity 0.0%. Word mode finds 16 unchanged words, 6 added and 4 removed, similarity 76.2%, and pins the 7am to 6am change. It also lists weekdays. as removed and weekdays as added: the full stop moved, and punctuation belongs to the word.'
    },
    uses: [
      ['Supplier terms', 'Compare this year’s terms with last year’s before renewing.'],
      ['Configuration files', 'Find the one setting that differs between a working and a broken config.'],
      ['Essay drafts', 'See in word mode which sentences an editor rewrote.']
    ],
    mistakes: [
      'Pasting a text with --- lines first. YAML front matter and Markdown rules use them; put that version second, and a note confirms the later lines were compared as part of the second text.',
      'Pasting from a word processor on one side only. Curly quotes and non-breaking spaces differ from plain ones, so identical-looking lines are flagged.'
    ],
    faq: [
      { q: 'How do I compare two Word documents?', a: 'Copy the text of each into the box with --- on a line of its own between them. Formatting, comments and tracked changes are not compared, only the words.' },
      { q: 'Is there a size limit?', a: 'Yes. The units in one text times those in the other may not exceed 4,000,000, so 2,000 lines against 2,000 is the most.' },
      { q: 'Does the diff ignore blank lines?', a: 'No. An extra empty line between paragraphs shows as an addition; only blank lines at the very start or end of each text are dropped.' }
    ],
    runs: [
      /* the delivery rule, line mode (defaults: trim, case-sensitive) */
      { input: 'Deliveries arrive between 7am and 9am on weekdays. Drivers must sign in at the gatehouse and wear a high-visibility vest.\n---\nDeliveries arrive between 6am and 9am on weekdays and Saturdays. Drivers must sign in at the gatehouse and wear a hard hat.', options: { mode: 'line' }, check: [['stat:Result', '1 added, 1 removed'], ['stat:Similarity', '0.0%']] },
      /* the same pair, word mode */
      { input: 'Deliveries arrive between 7am and 9am on weekdays. Drivers must sign in at the gatehouse and wear a high-visibility vest.\n---\nDeliveries arrive between 6am and 9am on weekdays and Saturdays. Drivers must sign in at the gatehouse and wear a hard hat.', options: { mode: 'word' }, check: [['stat:Unchanged words', '16'], ['stat:Added words', '6'], ['stat:Removed words', '4'], ['stat:Similarity', '76.2%']] },
      /* the mistake: front matter in the second text */
      { input: 'title: Notes\nbody\n---\n---\ntitle: Notes\n---\nbody', check: [['note', 'compared as part of the second text']] }
    ]
  },

  '/text/word-counter/': {
    term: 'a word count',
    whatIs: [
      'Every counter has to decide what a word is. This one counts runs of characters between whitespace, so e-mail is one word, “e - mail” is three, and £5 or a lone emoji counts too. Word processors decide differently, so two tools seldom agree exactly.',
      'Character limits have a catch of their own: a text message holds 160 GSM characters, but one emoji switches it to Unicode and the limit drops to 70.'
    ],
    howItWorks: {
      text: 'Every figure is recalculated by the page’s script as you type.',
      points: [
        'Characters is the JavaScript string length in UTF-16 code units, so an emoji counts as 2.',
        'A sentence ends at . ! ? or … followed by a space or the end of the text; a blank line separates paragraphs.',
        'For keyword density, words are lower-cased and cut down to letters and digits in any script, with their accents and vowel signs, plus straight apostrophes and hyphens; 48 common words are left out unless the filter is off.',
        'Unique words counts that same list, so it follows the filter. Average word length divides characters without spaces by words.'
      ]
    },
    worked: {
      text: 'A 17-word shop notice, “Grand reopening of Café Lumière on Saturday Free coffee for the first 50 customers. See you there!”, measures 98 characters. Put a party-popper emoji after Saturday and the counts become 18 words and 101 characters: the emoji is a word of its own and adds two characters, plus the space before it. The density list keeps the accents, listing café and lumière as written, only lower-cased. Unique words reads 11 with common words filtered and 17 with the filter off.'
    },
    uses: [
      ['University essays', 'Keep coursework inside its limit; your department may exclude references.'],
      ['Search snippets and adverts', 'Check a meta description or ad headline against its character limit.'],
      ['Translation quotes', 'Count a source document’s words, since translators usually price per word.']
    ],
    mistakes: [
      'Mixing straight and curly apostrophes. The density list keeps a straight one and drops a curly one, so don\'t and don’t are listed apart, as don\'t and dont.',
      'Reading Characters as bytes. Databases often limit bytes, and an accented letter takes 2 bytes in UTF-8 while counting as one character here.'
    ],
    faq: [
      { q: 'Do numbers count as words?', a: 'Yes. Anything between spaces is a word here, so “Doors open at 7 for £5 in 2026.” is 8 words.' },
      { q: 'Is a hyphenated word one word or two?', a: 'One, as long as there are no spaces round the hyphen: well-known counts once. A dash with a space either side counts as a word of its own.' },
      { q: 'How many pages is 1,000 words?', a: 'About two pages single-spaced or four double-spaced in 12-point type, though the font and margins change it.' }
    ],
    runs: [
      /* the notice without the emoji, default options (top 10, common words ignored) */
      { input: 'Grand reopening of Café Lumière on Saturday Free coffee for the first 50 customers. See you there!', options: {}, check: [['stat:Words', '17'], ['stat:Characters', '98']] },
      /* with a party-popper emoji (U+1F389) and a space after Saturday */
      { input: 'Grand reopening of Café Lumière on Saturday 🎉 Free coffee for the first 50 customers. See you there!', options: {}, check: [['stat:Words', '18'], ['stat:Characters', '101'], ['stat:Unique words', '11'], ['output', 'café'], ['output', 'lumière']] },
      /* the mistake: straight and curly apostrophes */
      { input: 'don\'t don’t', options: { ignoreCommon: 'no' }, check: [['output', 'don\'t'], ['output', 'dont']] },
      /* the same, common words not ignored */
      { input: 'Grand reopening of Café Lumière on Saturday 🎉 Free coffee for the first 50 customers. See you there!', options: { ignoreCommon: 'no' }, check: [['stat:Unique words', '17']] },
      /* the FAQ's numbers */
      { input: 'Doors open at 7 for £5 in 2026.', options: {}, check: [['stat:Words', '8']] }
    ]
  }
};
