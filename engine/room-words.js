/**
 * A small, local list of rude words for the live tools (window.RoomWords),
 * English and Hindi/Hinglish (Roman and Devanagari), used to mask words in the
 * word cloud, the Q&A board and nicknames before the big screen shows them.
 * Nothing is sent anywhere to check a word: the list is in this file.
 *
 *   RoomWords.mask('what the fuuck')  → 'what the f*****'
 *   RoomWords.has('B1tch')            → true
 *
 * A word is compared after normalising: NFKC, lower case, accents dropped,
 * look-alike digits and symbols read as letters (0→o, 1→i, 3→e, 4→a, 5→s,
 * 7→t, @→a, $→s), and letters said three or more times in a row squeezed
 * to one ("fuuuck" → "fuck") or two. A short list of unambiguous stems also
 * catches compounds ("fuckface"). No list catches everything; the presenter
 * can still hide any word or question by hand.
 */
(function (root) {
  'use strict';
  const WORDS = [
    /* English */
    'fuck', 'fucks', 'fucker', 'fuckers', 'fucking', 'fucked', 'fck', 'fuk', 'fuking', 'fking', 'fcking', 'motherfucker', 'mf', 'mofo', 'wtf', 'stfu',
    'shit', 'shits', 'shitty', 'bullshit', 'shite', 'bitch', 'bitches', 'bitchy', 'bastard', 'bastards', 'asshole', 'assholes', 'arsehole', 'arseholes',
    'arse', 'ass', 'jackass', 'dumbass', 'cunt', 'cunts', 'dick', 'dicks', 'dickhead', 'cock', 'cocks', 'cocksucker', 'pussy', 'pussies', 'wanker',
    'wankers', 'wank', 'twat', 'twats', 'slut', 'sluts', 'whore', 'whores', 'prick', 'pricks', 'bollocks', 'tosser', 'knobhead',
    'bellend', 'nigger', 'niggers', 'nigga', 'niggas', 'faggot', 'faggots', 'fag', 'fags', 'retard', 'retarded', 'tranny', 'spastic', 'spaz',
    'paki', 'chink', 'coon', 'kike', 'dyke', 'piss', 'porn', 'boobs', 'tits', 'titties', 'sht', 'btch',
    /* Hinglish, in the spellings people type */
    'chutiya', 'chutiye', 'chutia', 'chootiya', 'choot', 'chut', 'madarchod', 'maderchod', 'madarchood', 'behenchod', 'bhenchod', 'behanchod',
    'benchod', 'bhenchood', 'bsdk', 'bhosdike', 'bhosadike', 'bhosdi', 'bhosda', 'bhosdiwale', 'gandu', 'gaandu', 'gand', 'gaand',
    'randi', 'randwa', 'harami', 'haramkhor', 'haramzada', 'haramzadi', 'kamina', 'kamine', 'kaminey', 'kutiya', 'kutti', 'lund', 'lauda',
    'lavda', 'lawda', 'laude', 'loda', 'jhaat', 'jhatu', 'jhantu', 'chod', 'chodu', 'chodna', 'chudai', 
    'bakchod', 'bakchodi', 'bkl', 'mkc', 'tmkc', 'chinal', 'raand', 'kuttiya',
    /* Hindi, Devanagari */
    'चूतिया', 'चुतिया', 'चूतिये', 'चूत', 'मादरचोद', 'बहनचोद', 'भेनचोद', 'बेहेनचोद', 'भोसडीके', 'भोसड़ीके', 'भोसड़ी', 'भोसडी', 'गांडू', 'गांड',
    'रंडी', 'हरामी', 'हरामखोर', 'हरामज़ादा', 'हरामजादा', 'कमीना', 'कमीने', 'कुतिया', 'लौड़ा', 'लौडा', 'लंड', 'लण्ड', 'झाट', 'झाटू', 'चोद',
    'चोदू', 'चुदाई', 'छिनाल'
  ];
  /* Stems that only ever appear inside a rude word, so a compound is caught. */
  const STEMS = ['fuck', 'motherf', 'shithead', 'bitch', 'asshole', 'arsehole', 'dickhead', 'cocksuck', 'nigger', 'nigga', 'faggot', 'wanker',
    'chutiy', 'madarchod', 'maderchod', 'behenchod', 'bhenchod', 'behanchod', 'bhosd', 'bhosad', 'bakchod', 'haramkhor', 'haramzad',
    'चूतिय', 'मादरचोद', 'बहनचोद', 'भेनचोद', 'भोसड', 'हरामख', 'हरामज'];
  const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g' };

  function norm(word) {
    let s = String(word).normalize('NFKC').toLowerCase();
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');          /* accents (Latin only; Devanagari marks stay) */
    s = s.replace(/[01!|34@5$7+89]/g, (c) => LEET[c]);
    s = s.replace(/[​-‍⁠﻿*._\-'’]/g, '');          /* f.u.c.k, f*ck stays caught below */
    return s;
  }
  const SET = new Set(WORDS.map(norm));
  const STEMN = STEMS.map(norm);
  function squeeze(s, n) { return s.replace(/(.)\1+/gu, n === 1 ? '$1' : '$1$1'); }

  function bad(token) {
    const s = norm(token);
    if (!s) return false;
    const forms = [s, squeeze(s, 1), squeeze(s, 2)];
    for (const f of forms) {
      if (SET.has(f)) return true;
      if (f.length > 3 && /s$/.test(f) && SET.has(f.slice(0, -1))) return true;
      for (const st of STEMN) if (f.indexOf(st) >= 0) return true;
    }
    return false;
  }

  /* a token is a run of letters, marks, digits and the look-alike symbols */
  const TOKEN = /[\p{L}\p{M}\p{N}@$*!|+'’._-]+/gu;

  /** Does the text contain a word on the list? */
  function has(text) {
    const m = String(text || '').match(TOKEN);
    return !!m && m.some((t) => bad(t.replace(/^[._'’!-]+|[._'’!-]+$/g, '')));
  }
  /** The text with each listed word kept to its first letter and stars: "f***". */
  function mask(text) {
    return String(text || '').replace(TOKEN, (t) => {
      const core = t.replace(/^[._'’!-]+|[._'’!-]+$/g, '');
      if (!core || !bad(core)) return t;
      const chars = Array.from(core);
      const at = t.indexOf(core);
      return t.slice(0, at) + chars[0] + '*'.repeat(Math.max(2, chars.length - 1)) + t.slice(at + core.length);
    });
  }

  const api = { has, mask, norm, size: SET.size };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RoomWords = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
