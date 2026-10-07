/* Builds the passphrase word list for the password generator.
 *
 *   node build/gen-passphrase-words.js        rewrites build/wordlist/words.txt from build/wordlist/source/*.txt
 *                                             and the marked block in engine/txt-password-generator.js
 *   node build/gen-passphrase-words.js --check  exits 1 if either file would change
 *
 * The source files are plain English words written for 1234Tools in 2026. They are not taken from the EFF
 * lists (CC-BY), the Diceware list, a dictionary or any corpus; see build/wordlist/README.txt. This script
 * keeps lower-case words of 4 to 9 letters, removes duplicates and a blocklist of words that are rude,
 * violent or drug-related, and sorts them.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(__dirname, 'wordlist', 'source');
const OUT = path.join(__dirname, 'wordlist', 'words.txt');
const ENGINE = path.join(ROOT, 'engine', 'txt-password-generator.js');
const BLOCK = new Set(('sex sexy dick dicks cock piss crap damn hell tits boob boobs anus ass arse pimp pimps drug drugs coke weed dope gun guns bomb bombs kill kills murder murders death dead suicide terror bastard bugger wanker cocaine heroin brothel slave slaves rape rapist rapes naked nude porn fuck shit cunt nigger whore slut bitch nazi hitler lick crack massage raccoon instal passion jew jews gay lesbian sperm penis vagina breast breasts nipple orgasm erotic fetish incest abuse molest gang gangster mafia thug thief steal theft robber robbery burglar arson hang hanged noose gallows execute torture bullet bullets rifle pistol grenade missile weapon weapons knife knives stab choke strangle poison poisoned toxic corpse coffin grave tomb funeral cancer tumour virus plague disease cripple retard idiot moron stupid dumb fat ugly hate hated racist').split(/\s+/));
function build() {
  const set = new Set();
  const files = fs.readdirSync(SRC).filter((f) => /\.txt$/.test(f)).sort();
  for (const f of files) {
    fs.readFileSync(path.join(SRC, f), 'utf8').split(/\s+/).forEach((w) => {
      if (/^[a-z]{4,9}$/.test(w) && !BLOCK.has(w)) set.add(w);
    });
  }
  return Array.from(set).sort();
}
const words = build();
const txt = words.join('\n') + '\n';
const START = '/* WORDS-START (build/gen-passphrase-words.js) */';
const END = '/* WORDS-END */';
let eng = fs.readFileSync(ENGINE, 'utf8').replace(/\r\n/g, '\n');
const i = eng.indexOf(START), j = eng.indexOf(END);
if (i < 0 || j < i) { console.error('markers not found in the engine'); process.exit(1); }
const lines = [];
let cur = '';
words.forEach((w) => { if (cur.length + w.length + 1 > 110) { lines.push(cur); cur = ''; } cur += (cur ? ' ' : '') + w; });
lines.push(cur);
const block = START + '\nconst PW_WORDS = (\n' + lines.map((l) => "  '" + l + " '").join(' +\n') + '\n).trim().split(/\\s+/);\n' + END;
const next = eng.slice(0, i) + block + eng.slice(j + END.length);
if (process.argv.includes('--check')) {
  const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (old !== txt || next !== eng) { console.error('word list or engine would change'); process.exit(1); }
  console.log(words.length + ' words, up to date');
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, txt);
  fs.writeFileSync(ENGINE, next);
  console.log(words.length + ' words written');
}
