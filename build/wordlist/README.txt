The passphrase word list of the password generator (engine/txt-password-generator.js)
=====================================================================================

What it is: a list of everyday English words of four to nine letters (names of things, places, jobs,
animals, foods, plain verbs and adjectives), one per line in words.txt, and the same words inside
the engine between the WORDS-START and WORDS-END markers.

Where it comes from: the files in source/ were written by hand for 1234Tools in 2026. They are NOT
taken from the EFF long or short lists (Creative Commons BY 3.0, which this site's rules do not
allow), from the Diceware list, from a dictionary, or from a corpus. Anything here is the site's own
and may be used under the site's licence.

How it is built: node build/gen-passphrase-words.js keeps lower-case words of 4 to 9 letters, removes
duplicates and a blocklist of rude, violent or drug-related words, sorts them, and rewrites words.txt
and the engine block. node build/gen-passphrase-words.js --check exits 1 if either would change.

How big: the engine's Character pool row shows the exact count. The entropy of a passphrase is
words x log2(count), plus what the other options add (see the page's depth copy). The list is
smaller than the EFF's 7,776 words, so each word is worth a little less than 12.9 bits.
