/**
 * The quiz core shared by the Quiz Maker & Host, the Category Quiz Board and
 * the Top Answers Survey Game. It adds no game of its own to GAME_TOOLS.
 *
 *   - the model: { v: 1, title, rounds: [{ name, questions: [q] }] }, where a
 *     question is { type, prompt, options?, answer, accept?, tolerance?,
 *     image?: { id }, points?, time?, note? } and type is one of mcq, tf,
 *     text, number, picture, order or survey; validate() names every problem
 *     by round and question number;
 *   - answer checking: typed answers ignore case, accents, punctuation and
 *     the words "the", "a" and "an", take the listed variants, and forgive a
 *     small typo (one slip in a word of 5+ letters, two in a word of 9+;
 *     Damerau–Levenshtein, so a swapped pair counts as one); numbers match
 *     exactly or within the question's tolerance, or closest wins;
 *   - scoring: points per question, an optional speed bonus (for answers sent
 *     from phones later), and one double-points joker round per team;
 *   - the host engine (createGame): the question the screens may show (no
 *     answer in it), answers coming in as { team, value, at }, the reveal and
 *     the totals — the live quiz only has to add the transport;
 *   - ready-made packs: same-origin JSON under /games/packs/, fetched only
 *     when chosen (the service worker keeps a copy once opened);
 *   - sharing: a quiz of up to 60 questions with no pictures travels in the
 *     link after the #, deflate-raw compressed and base64url — the part after
 *     the # is never sent to a server; anything bigger goes as a .json file;
 *   - storage on this device: quizzes and pictures in IndexedDB (pictures
 *     resized on a canvas to at most 1600 px first, never uploaded).
 *
 * The pure parts run in Node too (build/games-packs.js validates the packs
 * with this same file).
 */
(function (root) {
  'use strict';

  const STR = {
    types: { mcq: 'Multiple choice', tf: 'True or false', text: 'Typed answer', number: 'Number', picture: 'Picture', order: 'Put in order', survey: 'Survey answers' },
    tTrue: 'True', tFalse: 'False',
    where: function (r, q) { return 'Round ' + r + ', question ' + q + ': '; },
    whereRound: function (r) { return 'Round ' + r + ': '; },
    noTitle: 'the quiz needs a title.',
    noRounds: 'the quiz has no rounds.',
    tooManyRounds: function (n) { return 'the quiz has ' + n + ' rounds; the most is ' + LIMITS.rounds + '.'; },
    tooMany: function (n) { return 'the quiz has ' + n + ' questions; the most is ' + LIMITS.questions + '.'; },
    badVersion: 'this is not a quiz file this page knows (v must be 1).',
    noRoundName: 'the round needs a name.',
    noQuestions: 'the round has no questions.',
    badType: function (t) { return 'unknown question type “' + t + '”.'; },
    noPrompt: 'the question is empty.',
    longPrompt: 'the question is over ' + 500 + ' characters.',
    fewOptions: 'a multiple-choice question needs 2 to 6 options.',
    blankOption: 'an option is empty.',
    dupOption: function (o) { return 'the option “' + o + '” appears twice.'; },
    notAmong: function (a) { return 'the answer “' + a + '” is not one of the options.'; },
    tfAnswer: 'a true-or-false answer must be true or false.',
    noAnswer: 'the answer is empty.',
    badAccept: 'the accepted answers must be a list of words.',
    numAnswer: 'the answer must be a number.',
    badTolerance: 'the tolerance must be a number of 0 or more.',
    noImage: 'a picture question needs a picture.',
    orderItems: 'an order question needs 2 to 8 different items.',
    surveyItems: 'a survey question needs 4 to 8 answers, each with points.',
    surveyOrder: 'survey answers go most popular first (points must not go up).',
    badPoints: 'points must be a number from 0 to 1000.',
    badTime: 'the time limit must be 5 to 600 seconds.',
    longNote: 'the note is over 500 characters.',
    /* packs */
    badId: 'the pack id must be lower-case words joined by hyphens.',
    noPackField: function (f) { return 'the pack has no “' + f + '”.'; },
    badCount: function (c, n) { return 'count says ' + c + ' but the pack has ' + n + ' questions.'; },
    notReviewed: 'the pack has no “reviewed” date (YYYY-MM-DD): it has not been fact-checked.',
    badReviewed: 'the “reviewed” date must be written YYYY-MM-DD.',
    badSources: '“sources” must be a list of web addresses or site names.',
    noSource: 'the question has no source (an https:// page that states the answer).',
    dupPrompt: function (where) { return 'the same question is asked again (' + where + ').'; },
    pictureInPack: 'packs cannot hold picture questions (pictures live on one device only).',
    /* sharing */
    shareTooMany: function (n) { return 'This quiz has ' + n + ' questions; a link holds up to ' + LIMITS.share + '. Use Export file instead.'; },
    sharePictures: 'Pictures cannot travel in a link. Use Export file instead.',
    shareLong: 'This quiz is too long for a link. Use Export file instead.',
    shareBad: 'This link does not hold a quiz this page can read. It may have been cut short when it was copied.'
  };

  const TYPES = ['mcq', 'tf', 'text', 'number', 'picture', 'order', 'survey'];
  const LIMITS = { rounds: 30, perRound: 100, questions: 600, share: 60, shareChars: 30000, picture: 1600 };

  /* ---------- normalising typed answers ---------- */

  const ARTICLES = { the: 1, a: 1, an: 1 };
  const NUMWORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  const SCALES = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9 };
  const FOLD = { 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ı': 'i' };

  /** Words of a typed answer with case, accents, punctuation and articles
      taken out, and one-word numbers ("eight") written as digits. */
  function words(s) {
    let t = String(s === null || s === undefined ? '' : s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
    t = t.replace(/[ßæœøłđðþı]/g, function (c) { return FOLD[c]; }).replace(/&/g, ' and ').replace(/['’‘`´]/g, '');
    t = t.replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
    if (!t) return [];
    const all = t.split(' ').map(function (w) { return Object.prototype.hasOwnProperty.call(NUMWORDS, w) ? String(NUMWORDS[w]) : w; });
    const kept = all.filter(function (w) { return !ARTICLES[w]; });
    return kept.length ? kept : all;
  }
  function norm(s) { return words(s).join(' '); }

  /** Optimal-string-alignment distance (Damerau–Levenshtein with adjacent
      swaps), stopping early once it passes `max`. */
  function distance(a, b, max) {
    a = Array.from(a); b = Array.from(b);
    const m = a.length, n = b.length;
    if (max === undefined) max = Infinity;
    if (Math.abs(m - n) > max) return max + 1;
    let p2 = null, p1 = new Array(n + 1), cur;
    for (let j = 0; j <= n; j++) p1[j] = j;
    for (let i = 1; i <= m; i++) {
      cur = new Array(n + 1); cur[0] = i;
      let rowMin = cur[0];
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + cost);
        if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      p2 = p1; p1 = cur;
    }
    return p1[n];
  }
  /** Slips forgiven in one word of the right answer: none under 5 letters,
      one from 5, two from 9; numbers must be exact. */
  function allowance(word) {
    if (/^\d+$/.test(word)) return 0;
    const n = Array.from(word).length;
    return n >= 9 ? 2 : n >= 5 ? 1 : 0;
  }
  /** A typed answer against the answer and its accepted variants. */
  function checkText(given, answer, accept) {
    const g = words(given);
    if (!g.length) return { ok: false };
    const cands = [answer].concat(Array.isArray(accept) ? accept : []);
    let best = null;
    for (const cand of cands) {
      const c = words(cand);
      if (!c.length) continue;
      if (g.join(' ') === c.join(' ') || g.join('') === c.join('')) return { ok: true, exact: true, matched: String(cand) };
      if (g.length !== c.length) continue;
      let slips = 0, fits = true;
      for (let i = 0; i < c.length; i++) {
        const allow = allowance(c[i]);
        const d = allow ? distance(g[i], c[i], allow) : (g[i] === c[i] ? 0 : 1);
        if (d > allow) { fits = false; break; }
        slips += d;
      }
      if (fits && (!best || slips < best.slips)) best = { ok: true, typo: true, matched: String(cand), slips: slips };
    }
    return best || { ok: false };
  }

  /* ---------- numbers ---------- */

  /** A typed number: "1,066", "1 066", "-3.5", "2.5 million", "twenty-one",
      "a hundred and five". null when there is none. */
  function parseNumber(given) {
    if (typeof given === 'number') return isFinite(given) ? given : null;
    let s = String(given === null || given === undefined ? '' : given).trim().toLowerCase();
    if (!s) return null;
    s = s.replace(/(\d)[,\s_](?=\d{3}(?!\d))/g, '$1').replace(/[−–]/g, '-');
    const m = /(^|[^\d.])(-?\d+(?:\.\d+)?|-?\.\d+)/.exec(' ' + s);
    if (m) {
      let v = Number(m[2]);
      const rest = (' ' + s).slice(m.index + m[0].length);
      const sc = /^\s*(hundred|thousand|million|billion|k|m|bn)\b/.exec(rest);
      if (sc) v *= ({ k: 1e3, m: 1e6, bn: 1e9 })[sc[1]] || SCALES[sc[1]];
      if (/\bminus\b/.test(s.slice(0, m.index)) && v > 0) v = -v;
      return v;
    }
    const w = s.replace(/-/g, ' ').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
    let total = 0, part = 0, any = false, neg = false;
    for (const x of w) {
      if (x === 'minus') { neg = true; continue; }
      if (x === 'and' || x === 'a') continue;
      if (Object.prototype.hasOwnProperty.call(NUMWORDS, x)) { part += NUMWORDS[x]; any = true; }
      else if (x === 'hundred') { part = (part || 1) * 100; any = true; }
      else if (SCALES[x]) { total += (part || 1) * SCALES[x]; part = 0; any = true; }
      else if (any) break;
    }
    if (!any) return null;
    const v = total + part;
    return neg ? -v : v;
  }
  function checkNumber(given, answer, tolerance) {
    const v = parseNumber(given);
    if (v === null) return { ok: false, value: null };
    const diff = Math.abs(v - Number(answer));
    return { ok: diff <= (Number(tolerance) || 0) + 1e-9, value: v, diff: diff };
  }
  /** Closest wins: entries [{ team, value }] → the team(s) nearest the answer. */
  function closest(entries, answer) {
    let best = Infinity, winners = [];
    for (const e of entries || []) {
      const v = parseNumber(e.value);
      if (v === null) continue;
      const d = Math.abs(v - Number(answer));
      if (d < best - 1e-9) { best = d; winners = [e.team]; }
      else if (Math.abs(d - best) <= 1e-9) winners.push(e.team);
    }
    return { winners: winners, diff: winners.length ? best : null };
  }

  function parseBool(v) {
    if (v === true || v === false) return v;
    const s = norm(v);
    if (/^(true|t|yes|y|1|right|correct)$/.test(s)) return true;
    if (/^(false|f|no|n|0|wrong|incorrect)$/.test(s)) return false;
    return null;
  }

  /** Any answer against a question → { ok, ... }. mcq takes the option's
      index or its text; order takes the items in the order given; survey
      says which answer on the board it matched. */
  function check(q, given) {
    switch (q.type) {
      case 'mcq': {
        const opt = typeof given === 'number' ? q.options[given] : given;
        if (opt === undefined || opt === null) return { ok: false };
        return { ok: opt === q.answer || norm(opt) === norm(q.answer) };
      }
      case 'tf': { const b = parseBool(given); return { ok: b !== null && b === q.answer }; }
      case 'text': case 'picture': return checkText(given, q.answer, q.accept);
      case 'number': return checkNumber(given, q.answer, q.tolerance);
      case 'order': {
        const g = Array.isArray(given) ? given : [];
        let right = 0;
        q.answer.forEach(function (item, i) { if (g[i] !== undefined && norm(g[i]) === norm(item)) right++; });
        return { ok: right === q.answer.length, right: right };
      }
      case 'survey': {
        for (let i = 0; i < q.answer.length; i++) {
          const r = checkText(given, q.answer[i].text, q.answer[i].accept);
          if (r.ok) return { ok: true, index: i, typo: !!r.typo };
        }
        return { ok: false, index: -1 };
      }
    }
    return { ok: false };
  }
  /** The answer as the host and the TV show it. */
  function answerText(q) {
    switch (q.type) {
      case 'tf': return q.answer ? STR.tTrue : STR.tFalse;
      case 'number': return String(q.answer) + (q.tolerance ? ' (± ' + q.tolerance + ')' : '');
      case 'order': return q.answer.join(' → ');
      case 'survey': return q.answer.map(function (a) { return a.text + ' ' + a.points; }).join(', ');
      default: return String(q.answer);
    }
  }

  /* ---------- validation ---------- */

  const isStr = function (s) { return typeof s === 'string' && s.trim() !== ''; };
  const isNum = function (n) { return typeof n === 'number' && isFinite(n); };

  function checkQuestion(q, where, errs, o) {
    const e = function (m) { errs.push(where + m); };
    if (!q || typeof q !== 'object') { e(STR.noPrompt); return; }
    if (TYPES.indexOf(q.type) < 0) { e(STR.badType(q.type)); return; }
    if (!isStr(q.prompt)) e(STR.noPrompt);
    else if (q.prompt.length > 500) e(STR.longPrompt);
    if (q.points !== undefined && !(isNum(q.points) && q.points >= 0 && q.points <= 1000)) e(STR.badPoints);
    if (q.time !== undefined && q.time !== null && !(isNum(q.time) && q.time >= 5 && q.time <= 600)) e(STR.badTime);
    if (q.note !== undefined && q.note !== null && String(q.note).length > 500) e(STR.longNote);
    if (q.accept !== undefined && !(Array.isArray(q.accept) && q.accept.every(function (a) { return typeof a === 'string'; }))) e(STR.badAccept);
    switch (q.type) {
      case 'mcq': {
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) { e(STR.fewOptions); break; }
        const seen = {};
        q.options.forEach(function (op) {
          if (!isStr(op)) { e(STR.blankOption); return; }
          const k = norm(op);
          if (seen[k]) e(STR.dupOption(op));
          seen[k] = 1;
        });
        if (!isStr(q.answer)) e(STR.noAnswer);
        else if (q.options.indexOf(q.answer) < 0) e(STR.notAmong(q.answer));
        break;
      }
      case 'tf': if (q.answer !== true && q.answer !== false) e(STR.tfAnswer); break;
      case 'text': if (!isStr(q.answer)) e(STR.noAnswer); break;
      case 'picture':
        if (!isStr(q.answer)) e(STR.noAnswer);
        if (o.pack) e(STR.pictureInPack);
        else if (!o.draft && !(q.image && isStr(q.image.id))) e(STR.noImage);
        break;
      case 'number':
        if (!isNum(q.answer)) e(STR.numAnswer);
        if (q.tolerance !== undefined && q.tolerance !== null && !(isNum(q.tolerance) && q.tolerance >= 0)) e(STR.badTolerance);
        break;
      case 'order': {
        const a = q.answer;
        if (!Array.isArray(a) || a.length < 2 || a.length > 8 || !a.every(isStr) || new Set(a.map(norm)).size !== a.length) e(STR.orderItems);
        break;
      }
      case 'survey': {
        const a = q.answer;
        if (!Array.isArray(a) || a.length < 4 || a.length > 8 || !a.every(function (x) { return x && isStr(x.text) && isNum(x.points) && x.points >= 0; })) { e(STR.surveyItems); break; }
        for (let i = 1; i < a.length; i++) if (a[i].points > a[i - 1].points) { e(STR.surveyOrder); break; }
        break;
      }
    }
  }
  /**
   * validate(quiz, { pack, draft }) → { ok, errors: [ "Round 2, question 3: …" ] }.
   * draft: a quiz still being written (a picture question may wait for its picture).
   */
  function validate(quiz, opts) {
    const o = opts || {};
    const errs = [];
    if (!quiz || typeof quiz !== 'object') return { ok: false, errors: [STR.badVersion] };
    if (quiz.v !== 1) errs.push(STR.badVersion);
    if (!isStr(quiz.title)) errs.push(STR.noTitle);
    if (!Array.isArray(quiz.rounds) || !quiz.rounds.length) { errs.push(STR.noRounds); return { ok: false, errors: errs }; }
    if (quiz.rounds.length > LIMITS.rounds) errs.push(STR.tooManyRounds(quiz.rounds.length));
    let total = 0;
    quiz.rounds.forEach(function (r, ri) {
      if (!r || !isStr(r.name)) errs.push(STR.whereRound(ri + 1) + STR.noRoundName);
      const qs = r && Array.isArray(r.questions) ? r.questions : [];
      if (!qs.length) errs.push(STR.whereRound(ri + 1) + STR.noQuestions);
      total += qs.length;
      qs.forEach(function (q, qi) { checkQuestion(q, STR.where(ri + 1, qi + 1), errs, o); });
    });
    if (total > LIMITS.questions) errs.push(STR.tooMany(total));
    return { ok: errs.length === 0, errors: errs };
  }
  /**
   * A ready-made pack: a quiz plus { id, title, ages, region, count, reviewed,
   * sources }, every question with a source. strict (the build check) also
   * needs the reviewed date; the page opens an unreviewed pack.
   */
  function validatePack(pack, opts) {
    const o = opts || {};
    const res = validate(pack, { pack: true });
    const errs = res.errors.slice();
    if (!pack || typeof pack !== 'object') return res;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(pack.id || ''))) errs.push(STR.badId);
    ['ages', 'region'].forEach(function (f) { if (!isStr(pack[f])) errs.push(STR.noPackField(f)); });
    const n = countQuestions(pack);
    if (pack.count !== n) errs.push(STR.badCount(pack.count, n));
    if (pack.reviewed === null || pack.reviewed === undefined || pack.reviewed === '') { if (o.strict) errs.push(STR.notReviewed); }
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(pack.reviewed)) || isNaN(Date.parse(pack.reviewed))) errs.push(STR.badReviewed);
    if (!Array.isArray(pack.sources) || !pack.sources.every(isStr)) errs.push(STR.badSources);
    const seen = {};
    (pack.rounds || []).forEach(function (r, ri) {
      ((r && r.questions) || []).forEach(function (q, qi) {
        const where = STR.where(ri + 1, qi + 1);
        if (!q) return;
        if (!/^https:\/\/[^\s/]+\.[^\s]+$/.test(String(q.source || ''))) errs.push(where + STR.noSource);
        const k = norm(q.prompt);
        if (k && seen[k]) errs.push(where + STR.dupPrompt(seen[k]));
        else if (k) seen[k] = 'round ' + (ri + 1) + ', question ' + (qi + 1);
      });
    });
    return { ok: errs.length === 0, errors: errs };
  }

  function countQuestions(quiz) {
    return ((quiz && quiz.rounds) || []).reduce(function (s, r) { return s + ((r && r.questions) || []).length; }, 0);
  }
  function hasPictures(quiz) {
    return ((quiz && quiz.rounds) || []).some(function (r) { return (r.questions || []).some(function (q) { return q.type === 'picture' || (q.image && q.image.id); }); });
  }
  /** A copy holding only the fields the model knows (what is saved and shared). */
  function cleanQuestion(q) {
    const out = { type: q.type, prompt: String(q.prompt || '') };
    if (q.type === 'mcq') out.options = (q.options || []).map(String);
    out.answer = q.type === 'survey' ? (q.answer || []).map(function (a) { const x = { text: String(a.text || ''), points: Number(a.points) || 0 }; if (a.accept && a.accept.length) x.accept = a.accept.map(String); return x; })
      : q.type === 'order' ? (q.answer || []).map(String) : q.answer;
    if (Array.isArray(q.accept) && q.accept.length) out.accept = q.accept.map(String);
    if (q.type === 'number' && isNum(q.tolerance) && q.tolerance > 0) out.tolerance = q.tolerance;
    if (q.image && q.image.id) out.image = { id: String(q.image.id) };
    if (isNum(q.points)) out.points = q.points;
    if (isNum(q.time)) out.time = q.time;
    if (isStr(q.note)) out.note = String(q.note);
    if (isStr(q.source)) out.source = String(q.source);
    return out;
  }
  function cleanQuiz(quiz) {
    return {
      v: 1, title: String(quiz.title || ''),
      rounds: (quiz.rounds || []).map(function (r) { return { name: String(r.name || ''), questions: (r.questions || []).map(cleanQuestion) }; })
    };
  }
  function blankQuestion(type) {
    const t = TYPES.indexOf(type) >= 0 ? type : 'text';
    const q = { type: t, prompt: '' };
    if (t === 'mcq') { q.options = ['', '', '', '']; q.answer = ''; }
    else if (t === 'tf') q.answer = true;
    else if (t === 'number') { q.answer = 0; q.tolerance = 0; }
    else if (t === 'order') q.answer = ['', '', ''];
    else if (t === 'survey') q.answer = [{ text: '', points: 0 }, { text: '', points: 0 }, { text: '', points: 0 }, { text: '', points: 0 }];
    else q.answer = '';
    return q;
  }

  /* ---------- scoring ---------- */

  /** Points one answer earns: the question's points (or the default) when
      right; with the speed bonus on, up to `speedMax` more, falling in a
      straight line from an instant answer to one on the buzzer. */
  function pointsFor(q, res, opts) {
    const o = opts || {};
    if (!res || !res.ok) return 0;
    const base = isNum(q.points) ? q.points : (o.defaultPoints || 1);
    let bonus = 0;
    if (o.speed && isNum(res.ms) && isNum(q.time) && q.time > 0) {
      const frac = Math.max(0, Math.min(1, 1 - res.ms / (q.time * 1000)));
      bonus = Math.round(base * (o.speedMax === undefined ? 0.5 : o.speedMax) * frac);
    }
    return base + bonus;
  }

  /* ---------- the host engine (one game of one quiz) ---------- */

  const now = function () { return (typeof performance !== 'undefined' && performance.timeOrigin) ? performance.timeOrigin + performance.now() : Date.now(); };

  /**
   * createGame(quiz, { teams: [names], joker, closest, speed, speedMax,
   * defaultPoints, grace, rand, clock }, saved?) → the game.
   * Marks are kept per question per team without the joker; totals apply it,
   * so a joker played or changed later is still counted right.
   */
  function createGame(quiz, opts, saved) {
    const o = Object.assign({ teams: ['Team 1', 'Team 2'], joker: true, closest: false, speed: false, speedMax: 0.5, defaultPoints: 1, grace: 500 }, opts || {});
    const clock = o.clock || now;
    const flat = [];
    quiz.rounds.forEach(function (r, ri) { r.questions.forEach(function (q, qi) { flat.push({ ri: ri, qi: qi }); }); });
    const s = saved && saved.flatLen === flat.length ? JSON.parse(JSON.stringify(saved)) : {
      flatLen: flat.length, pos: 0, phase: 'question', shownAt: clock(),
      teams: o.teams.map(function (n) { return { name: String(n), joker: null }; }),
      marks: {}, answers: {}, orders: {}
    };
    const key = function (p) { const f = flat[p === undefined ? s.pos : p]; return f.ri + '.' + f.qi; };
    const cur = function () { const f = flat[s.pos]; return { ri: f.ri, qi: f.qi, round: quiz.rounds[f.ri], q: quiz.rounds[f.ri].questions[f.qi] }; };
    const teamOf = function (name) { return s.teams.filter(function (t) { return t.name === name; })[0] || null; };
    function shuffled(list) {
      const a = list.slice();
      const r = o.rand || function (n) { return Math.floor(Math.random() * n); };
      for (let i = a.length - 1; i > 0; i--) { const j = r(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    }
    function total(t) {
      let sum = 0;
      Object.keys(s.marks).forEach(function (k) {
        const p = s.marks[k][t.name];
        if (!p) return;
        sum += (o.joker && t.joker !== null && Number(k.split('.')[0]) === t.joker) ? p * 2 : p;
      });
      return sum;
    }
    const g = {
      get state() { return s; },
      get phase() { return s.phase; },
      get pos() { return s.pos; },
      get length() { return flat.length; },
      current: cur,
      teams: function () { return s.teams.map(function (t) { return { name: t.name, joker: t.joker, score: total(t) }; }); },
      /** What any screen may show: never the answer. */
      publicQuestion: function () {
        const c = cur(), q = c.q;
        const pq = {
          ri: c.ri, qi: c.qi, round: c.round.name, roundNo: c.ri + 1, rounds: quiz.rounds.length,
          no: c.qi + 1, inRound: c.round.questions.length, overall: s.pos + 1, total: flat.length,
          type: q.type, prompt: q.prompt, points: isNum(q.points) ? q.points : o.defaultPoints,
          time: isNum(q.time) ? q.time : null, shownAt: s.shownAt
        };
        if (q.type === 'mcq') pq.options = q.options.slice();
        if (q.type === 'tf') pq.options = [STR.tTrue, STR.tFalse];
        if (q.type === 'order') { const k = key(); if (!s.orders[k]) s.orders[k] = shuffled(q.answer); pq.options = s.orders[k].slice(); }
        if (q.type === 'survey') pq.slots = q.answer.length;
        if (q.image && q.image.id) pq.image = { id: q.image.id };
        return pq;
      },
      /** The answer side, for the presenter and the reveal. */
      revealInfo: function () { const q = cur().q; return { answer: answerText(q), note: q.note || '', marks: Object.assign({}, s.marks[key()] || {}) }; },
      /** An answer from a team (a phone, later): { team, value, at }. */
      submit: function (a) {
        if (s.phase !== 'question') return { accepted: false, reason: 'closed' };
        const t = a && teamOf(a.team);
        if (!t) return { accepted: false, reason: 'team' };
        const q = cur().q, at = isNum(a.at) ? a.at : clock();
        if (isNum(q.time) && at > s.shownAt + q.time * 1000 + o.grace) return { accepted: false, reason: 'late' };
        const k = key();
        (s.answers[k] = s.answers[k] || {})[t.name] = { value: a.value, at: at };
        return { accepted: true };
      },
      answersIn: function () { return Object.keys(s.answers[key()] || {}); },
      /** Close the question; answers sent in are marked; returns revealInfo. */
      reveal: function () {
        if (s.phase !== 'question') return g.revealInfo();
        s.phase = 'reveal';
        const k = key(), q = cur().q, got = s.answers[k] || {};
        const names = Object.keys(got);
        if (names.length) {
          const m = s.marks[k] = s.marks[k] || {};
          if (q.type === 'number' && o.closest) {
            const w = closest(names.map(function (n) { return { team: n, value: got[n].value }; }), q.answer);
            names.forEach(function (n) { m[n] = w.winners.indexOf(n) >= 0 ? pointsFor(q, { ok: true, ms: got[n].at - s.shownAt }, o) : 0; });
          } else {
            names.forEach(function (n) { const r = check(q, got[n].value); r.ms = got[n].at - s.shownAt; m[n] = pointsFor(q, r, o); });
          }
        }
        return g.revealInfo();
      },
      /** The host marks a team right or wrong (no phones). Returns the change
          in that team's total, joker included, for the Scoreboard. */
      mark: function (team, right) {
        const t = teamOf(team); if (!t) return 0;
        const before = total(t), k = key();
        const m = s.marks[k] = s.marks[k] || {};
        if (right) m[t.name] = pointsFor(cur().q, { ok: true }, { defaultPoints: o.defaultPoints }); else delete m[t.name];
        return total(t) - before;
      },
      setPoints: function (team, pts) {
        const t = teamOf(team); if (!t) return 0;
        const before = total(t), k = key();
        (s.marks[k] = s.marks[k] || {})[t.name] = Number(pts) || 0;
        return total(t) - before;
      },
      marked: function (team) { const m = s.marks[key()]; return !!(m && m[team]); },
      /** The double-points round for a team; once per game, and only for a
          round that has not started yet (or the current one before any marks). */
      playJoker: function (team, ri) {
        const t = teamOf(team); if (!t || !o.joker) return { ok: false, delta: 0 };
        if (t.joker !== null && t.joker !== ri) {
          const used = Object.keys(s.marks).some(function (k) { return Number(k.split('.')[0]) === t.joker && s.marks[k][t.name]; });
          if (used) return { ok: false, delta: 0 };
        }
        const before = total(t);
        t.joker = ri === null ? null : Number(ri);
        return { ok: true, delta: total(t) - before };
      },
      standings: function () {
        const list = g.teams().sort(function (a, b) { return b.score - a.score; });
        list.forEach(function (t, i) { t.rank = i && t.score === list[i - 1].score ? list[i - 1].rank : i + 1; });
        return list;
      },
      go: function (p) {
        if (p < 0 || p >= flat.length) return false;
        s.pos = p; s.phase = s.marks[key()] ? 'reveal' : 'question'; s.shownAt = clock();
        if (s.phase === 'reveal' && !Object.keys(s.marks[key()]).length) s.phase = 'question';
        return true;
      },
      next: function () { if (s.pos + 1 >= flat.length) { s.phase = 'end'; return false; } return g.go(s.pos + 1); },
      prev: function () { if (s.phase === 'end') { s.phase = 'reveal'; return true; } return g.go(s.pos - 1); },
      end: function () { s.phase = 'end'; },
      restartTimer: function () { s.shownAt = clock(); },
      toJSON: function () { return JSON.parse(JSON.stringify(s)); }
    };
    return g;
  }

  /* ---------- sharing in the link ---------- */

  function b64u(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(str) {
    const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(s + '==='.slice((s.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function pipe(bytes, ts) { return new Response(new Blob([bytes]).stream().pipeThrough(ts)).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function shareFits(quiz) {
    const n = countQuestions(quiz);
    if (n > LIMITS.share) return { ok: false, reason: STR.shareTooMany(n) };
    if (hasPictures(quiz)) return { ok: false, reason: STR.sharePictures };
    return { ok: true };
  }
  /** quiz → the text after "#q=": "z" + base64url(deflate-raw(JSON)), or
      "j" + base64url(JSON) in a browser without CompressionStream. */
  function encodeShare(quiz) {
    const fit = shareFits(quiz);
    if (!fit.ok) return Promise.reject(new Error(fit.reason));
    const bytes = new TextEncoder().encode(JSON.stringify(cleanQuiz(quiz)));
    let ts = null;
    try { if (typeof CompressionStream === 'function') ts = new CompressionStream('deflate-raw'); } catch (e) { ts = null; }
    const p = ts ? pipe(bytes, ts).then(function (z) { return 'z' + b64u(z); }) : Promise.resolve('j' + b64u(bytes));
    return p.then(function (s) { if (s.length > LIMITS.shareChars) throw new Error(STR.shareLong); return s; });
  }
  function decodeShare(str) {
    return Promise.resolve().then(function () {
      const s = String(str || '');
      const bytes = unb64u(s.slice(1));
      if (s[0] === 'z') return pipe(bytes, new DecompressionStream('deflate-raw'));
      if (s[0] === 'j') return bytes;
      throw new Error('prefix');
    }).then(function (bytes) {
      const quiz = cleanQuiz(JSON.parse(new TextDecoder().decode(bytes)));
      const v = validate(quiz);
      if (!v.ok) throw new Error(v.errors[0]);
      return quiz;
    }).catch(function (e) {
      const err = new Error(STR.shareBad); err.detail = e && e.message; throw err;
    });
  }

  /* ---------- packs (same origin, fetched only when chosen) ---------- */

  const PACKS = '/games/packs/';
  function loadPackIndex() {
    return fetch(PACKS + 'index.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { return (j && Array.isArray(j.packs)) ? j.packs : []; });
  }
  function loadPack(id) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(id))) return Promise.reject(new Error(STR.badId));
    return fetch(PACKS + id + '.json').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (p) { const v = validatePack(p); if (!v.ok) throw new Error(v.errors[0]); return p; });
  }

  /* ---------- storage on this device (IndexedDB) ---------- */

  const DB_NAME = 'mvr-games-quiz', DB_VER = 1;
  let dbp = null;
  const mem = { quizzes: new Map(), pictures: new Map() }; /* when IndexedDB is refused */
  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve) {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = function () {
          const d = req.result;
          if (!d.objectStoreNames.contains('quizzes')) d.createObjectStore('quizzes', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('pictures')) d.createObjectStore('pictures', { keyPath: 'id' });
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    return dbp;
  }
  function tx(storeName, mode, fn) {
    return openDb().then(function (d) {
      if (!d) return fn(null, mem[storeName]);
      return new Promise(function (resolve, reject) {
        const t = d.transaction(storeName, mode);
        const st = t.objectStore(storeName);
        let out;
        const r = fn(st, null);
        if (r && typeof r.onsuccess !== 'undefined') r.onsuccess = function () { out = r.result; };
        else out = r;
        t.oncomplete = function () { resolve(out); };
        t.onerror = t.onabort = function () { reject(t.error || new Error('IndexedDB')); };
      });
    });
  }
  function newId(prefix) {
    const r = new Uint32Array(2);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(r); else { r[0] = Math.random() * 4294967296; r[1] = Math.random() * 4294967296; }
    return (prefix || 'q') + Date.now().toString(36) + r[0].toString(36) + r[1].toString(36).slice(0, 4);
  }
  const store = {
    /** true when IndexedDB works here (false: kept for this visit only). */
    persistent: function () { return openDb().then(function (d) { return !!d; }); },
    putQuiz: function (rec) {
      const r = Object.assign({}, rec, { updated: Date.now() });
      return tx('quizzes', 'readwrite', function (st, m) { if (m) { m.set(r.id, r); return r; } st.put(r); return r; }).then(function () { return r; });
    },
    getQuiz: function (id) { return tx('quizzes', 'readonly', function (st, m) { return m ? m.get(id) : st.get(id); }); },
    deleteQuiz: function (id) {
      return store.getQuiz(id).then(function (rec) {
        const ids = rec && rec.quiz ? pictureIds(rec.quiz) : [];
        return Promise.all(ids.map(store.deletePicture)).then(function () { return tx('quizzes', 'readwrite', function (st, m) { return m ? m.delete(id) : st.delete(id); }); });
      });
    },
    /** [{ id, kind, title, updated, count }], newest first. */
    listQuizzes: function (kind) {
      return tx('quizzes', 'readonly', function (st, m) { return m ? Array.from(m.values()) : st.getAll(); }).then(function (all) {
        return (all || []).filter(function (r) { return !kind || (r.kind || 'quiz') === kind; })
          .map(function (r) { return { id: r.id, kind: r.kind || 'quiz', title: (r.quiz && r.quiz.title) || r.title || '', updated: r.updated, count: countQuestions(r.quiz) }; })
          .sort(function (a, b) { return b.updated - a.updated; });
      });
    },
    putPicture: function (blob, meta) {
      const rec = Object.assign({ id: newId('p'), blob: blob, type: blob.type, added: Date.now() }, meta || {});
      return tx('pictures', 'readwrite', function (st, m) { if (m) { m.set(rec.id, rec); return rec; } st.put(rec); return rec; }).then(function () { return rec.id; });
    },
    getPicture: function (id) { return tx('pictures', 'readonly', function (st, m) { return m ? m.get(id) : st.get(id); }).then(function (r) { return r ? r.blob : null; }); },
    deletePicture: function (id) { return tx('pictures', 'readwrite', function (st, m) { return m ? m.delete(id) : st.delete(id); }); }
  };
  function pictureIds(quiz) {
    const ids = [];
    ((quiz && quiz.rounds) || []).forEach(function (r) { (r.questions || []).forEach(function (q) { if (q.image && q.image.id) ids.push(q.image.id); }); });
    return ids;
  }

  /** A picture from the device, made at most `max` px on its long side on a
      canvas (JPEG for photos, PNG for PNG/GIF so clear areas stay clear). */
  function resizeImage(file, max) {
    const limit = max || LIMITS.picture;
    const png = /png|gif|svg/.test(file.type || '');
    const load = typeof createImageBitmap === 'function'
      ? createImageBitmap(file)
      : new Promise(function (res, rej) { const im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = URL.createObjectURL(file); });
    return load.then(function (img) {
      const w = img.width, h = img.height, k = Math.min(1, limit / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const x = c.getContext('2d');
      if (!png) { x.fillStyle = '#ffffff'; x.fillRect(0, 0, cw, ch); }
      x.drawImage(img, 0, 0, cw, ch);
      if (img.close) img.close();
      return new Promise(function (res, rej) {
        c.toBlob(function (b) { if (b) res({ blob: b, width: cw, height: ch }); else rej(new Error('canvas')); }, png ? 'image/png' : 'image/jpeg', 0.86);
      });
    });
  }
  function blobToDataUrl(blob) { return new Promise(function (res, rej) { const r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(blob); }); }
  function dataUrlToBlob(url) { return fetch(url).then(function (r) { return r.blob(); }); }

  /** The .json export: the quiz plus its pictures as data: URLs. */
  function exportFile(quiz, kind) {
    const clean = cleanQuiz(quiz);
    const ids = pictureIds(clean);
    return Promise.all(ids.map(function (id) { return store.getPicture(id).then(function (b) { return b ? blobToDataUrl(b) : null; }); }))
      .then(function (urls) {
        const images = {};
        ids.forEach(function (id, i) { if (urls[i]) images[id] = urls[i]; });
        return Object.assign({ kind: kind || 'quiz' }, clean, ids.length ? { images: images } : {});
      });
  }
  /** Reads an exported file back: pictures go into this device's store under
      new ids. → { quiz, kind, errors } */
  function importFile(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const quiz = cleanQuiz(data || {});
    const images = (data && data.images) || {};
    const jobs = [];
    quiz.rounds.forEach(function (r) {
      r.questions.forEach(function (q) {
        if (!q.image) return;
        const src = images[q.image.id];
        if (!src || !/^data:image\//.test(src)) { delete q.image; return; }
        jobs.push(dataUrlToBlob(src).then(function (b) { return store.putPicture(b); }).then(function (id) { q.image = { id: id }; }));
      });
    });
    return Promise.all(jobs).then(function () {
      const v = validate(quiz, { draft: true });
      return { quiz: quiz, kind: (data && data.kind) || 'quiz', errors: v.errors };
    });
  }

  const Core = {
    STR: STR, TYPES: TYPES, LIMITS: LIMITS,
    words: words, norm: norm, distance: distance, allowance: allowance, checkText: checkText,
    parseNumber: parseNumber, checkNumber: checkNumber, closest: closest, parseBool: parseBool,
    check: check, answerText: answerText, validate: validate, validatePack: validatePack,
    countQuestions: countQuestions, hasPictures: hasPictures, cleanQuiz: cleanQuiz, cleanQuestion: cleanQuestion,
    blankQuestion: blankQuestion, pictureIds: pictureIds, pointsFor: pointsFor, createGame: createGame,
    shareFits: shareFits, encodeShare: encodeShare, decodeShare: decodeShare, b64u: b64u, unb64u: unb64u,
    loadPackIndex: loadPackIndex, loadPack: loadPack, store: store, newId: newId,
    resizeImage: resizeImage, exportFile: exportFile, importFile: importFile, now: now,
    /** The points message the Scoreboard listens for (engine/game-scoreboard.js):
        { team: 1-based position, name, points: a whole number, not 0 }. The
        Scoreboard matches the name first, then the position. */
    sendPoints: (function () {
      let ch = null;
      return function (name, points, position) {
        points = Math.round(Number(points));
        if (!points || typeof BroadcastChannel === 'undefined') return false;
        if (!ch) ch = new BroadcastChannel('mvr-games:points');
        const msg = { name: String(name), points: points };
        if (Number.isInteger(position) && position >= 1) msg.team = position;
        ch.postMessage(msg);
        return true;
      };
    })()
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  if (root && typeof root === 'object' && !root.QuizCore) root.QuizCore = Core;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
