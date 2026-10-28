/**
 * Claims on the Quiz & Party Games pages (/games/): the privacy line (no
 * request leaves the page while the tool's buttons are pressed), the
 * fairness lines (the draw is the kit's crypto.getRandomValues with
 * rejection sampling; the chi-square checks they point at are in
 * build/tests/games.js), and the copy's numbers (500 names, 100 wheel
 * entries, 6-600 tickets and so on) against the engines in Chrome and Node.
 */
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function ({ claim, kit: K }) {
  const N = 'node', B = 'browser';
  const G = '/games/';
  const src = (f) => fs.readFileSync(path.join(K.ROOT, 'engine', f), 'utf8');
  const openG = (slug) => K.open(G + slug + '/', { wait: '[data-tool]' });
  const withPage = (slug, fn) => async () => { const p = await openG(slug); try { return await fn(p); } finally { await p.close(); } };

  /* every button of the tool's panel pressed (three rounds, none that clears or deletes); no request may leave the site */
  const play = async (p) => {
    await p.evaluate(() => {
      window.print = () => {}; window.confirm = () => true; window.open = () => null;
      const ta = document.querySelector('[data-tool] textarea');
      if (ta && !ta.value.trim()) { ta.value = Array.from({ length: 12 }, (_, i) => 'Name ' + (i + 1)).join('\n'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    /* one press at a time, the buttons found afresh each time, as a person would press them */
    const n = await p.evaluate(() => document.querySelectorAll('[data-tool] button').length);
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < n; i++) {
        await p.evaluate((i) => {
          const b = document.querySelectorAll('[data-tool] button')[i];
          /* the optional phones (Use phones, then Start a live session) are the one part that sends anything: their own claim is below */
          if (!b || b.disabled || /new game|clear|reset|delete|remove|forget|undo|use phones|live session|reopen session/i.test(b.textContent + ' ' + (b.getAttribute('aria-label') || ''))) return;
          try { b.click(); } catch (e) { /* */ }
        }, i);
        await K.sleep(60);
      }
    }
    await p.keyboard.press('Space').catch(() => {});
    await K.sleep(300);
    const bad = p.__requests.filter((r) => !r.url.startsWith(K.BASE));
    return [bad.length === 0 && p.__errors.filter((e) => !/NotAllowedError/.test(e)).length === 0,
      p.__requests.length + ' requests, ' + (bad.length ? 'outside: ' + bad.map((r) => r.url).join(', ') : 'all to the site itself') + (p.__errors.filter((e) => !/NotAllowedError/.test(e)).length ? '; error: ' + p.__errors.join(' | ') : '')];
  };
  const privacy = (slug, where, quote) => claim(G + slug + '/', where, quote, 'no request leaves the page while the tool is played', B, withPage(slug, play));
  privacy('team-generator', 'faq', 'They are never sent anywhere.');
  privacy('spin-the-wheel', 'faq', 'They are never sent anywhere.');
  privacy('scoreboard', 'faq', 'It is not sent anywhere, so it will not appear on another device.');
  privacy('quiz-buzzer', 'ui', 'Without phones, everything happens on this device.');
  privacy('tambola-number-caller', 'faq', 'Nothing is uploaded.');
  privacy('tambola-ticket-generator', 'faq', 'nothing is sent anywhere');
  privacy('bingo-card-generator', 'ui', 'nothing is uploaded');
  privacy('quiz-maker', 'ui', 'Without phones, nothing is uploaded.');
  /* the optional phones: nothing of them loads on a visit, and Use phones fetches same-origin files only; the relay is contacted
     only after Start a live session (build/tests/live/quiz-phones.js plays it with 20 phones against the relay) */
  const phonesOff = (slug, sel) => claim(G + slug + '/', 'ui', 'Phones are optional', 'nothing for phones loads on a visit; Use phones loads the kit from the site itself and contacts no server', B, withPage(slug, async (p) => {
    await K.sleep(300);
    const before = p.__requests.filter((r) => /room-|game-phones|live\.1234tools/.test(r.url)).map((r) => r.url);
    const loadedBefore = await p.evaluate(() => !!(window.LiveKit || window.GamePhones || window.MVRRoom));
    await p.evaluate((sel) => document.querySelector(sel).click(), sel).catch(() => {});
    await K.sleep(1200);
    /* the browser may serve the kit from its memory cache (no request event), so look for what it defines */
    const after = await p.evaluate(() => ['LiveKit', 'GamePhones', 'MVRRoom', 'RoomWords'].filter((k) => !!window[k]).length);
    const out = p.__requests.filter((r) => !r.url.startsWith(K.BASE));
    const start = await p.evaluate(() => !!document.querySelector('.live-start'));
    return [before.length === 0 && !loadedBefore && after === 4 && out.length === 0 && start, 'before Use phones: ' + (before.join(' ') || 'none') + '; after: ' + after + ' kit files, ' + out.length + ' outside requests, Start shown: ' + start];
  }));
  phonesOff('quiz-maker', '.qz-use-phones');
  phonesOff('quiz-buzzer', '.bz-use-phones');
  privacy('category-board', 'faq', 'Nothing is uploaded.');
  privacy('top-answers', 'faq', 'Nothing is uploaded.');
  privacy('charades-generator', 'ui', 'nothing is uploaded');
  privacy('icebreaker-cards', 'ui', 'nothing is uploaded');

  /* ---- fairness ---- */
  const fair = (slug, quote) => claim(G + slug + '/', 'faq', quote, 'the kit draws with crypto.getRandomValues and rejection sampling; build/tests/games.js tests it', N, async () => {
    const kit = src('game-kit.js'), tests = fs.readFileSync(path.join(K.ROOT, 'build', 'tests', 'games.js'), 'utf8');
    const a = /crypto\.getRandomValues/.test(kit), b = /reject/i.test(kit), c = /chi/i.test(tests);
    return [a && b && c, 'game-kit.js getRandomValues ' + a + ', rejection ' + b + '; games.js chi-square ' + c];
  });
  fair('team-generator', 'The shuffle uses your browser’s cryptographic random number generator with rejection sampling, so every arrangement is equally likely.');
  fair('spin-the-wheel', 'The winner is drawn first with your browser’s cryptographic random number generator, using rejection sampling so no entry is favoured, and weighted by slices.');
  fair('tambola-number-caller', 'Every number is drawn from those not yet called using your browser’s cryptographic random number generator with rejection sampling, so each remaining number is equally likely.');

  /* ---- limits ---- */
  claim(G + 'team-generator/', 'faq', 'Up to 500 names and 50 teams, which covers a school year group.', '600 names typed make 500 names; 80 teams asked for make 50', B, withPage('team-generator', async (p) => {
    const r = await p.evaluate(async () => {
      const root = document.querySelector('[data-tool="team-generator"]');
      const ta = root.querySelector('textarea');
      ta.value = Array.from({ length: 600 }, (_, i) => 'N' + (i + 1)).join('\n'); ta.dispatchEvent(new Event('input', { bubbles: true }));
      [...root.querySelectorAll('button')].find((b) => b.textContent === 'Make teams').click();
      await new Promise((r) => setTimeout(r, 500));
      const teams = [...document.querySelectorAll('.game-team')];
      const M = window.GAME_TOOLS['team-generator'].maths;
      const big = M.makeTeams(Array.from({ length: 500 }, (_, i) => ({ name: 'P' + i, skill: null })), { mode: 'count', count: 80 }, [], window.GameKit.randInt).teams.length;
      return { teams: big, people: teams.reduce((s, t) => s + t.querySelectorAll('li').length, 0) };
    });
    return [r.people === 500 && r.teams === 50, r.people + ' names in ' + r.teams + ' teams'];
  }));
  claim(G + 'spin-the-wheel/', 'faq', 'Up to 100 entries, each up to 40 characters.', 'parseEntries keeps 100 of 120 lines and cuts a name to 40 characters', B, withPage('spin-the-wheel', async (p) => {
    const r = await p.evaluate(() => {
      const M = window.GAME_TOOLS['spin-the-wheel'].maths;
      return { n: M.parseEntries(Array.from({ length: 120 }, (_, i) => 'N' + i).join('\n')).length, len: M.parseEntries('x'.repeat(70))[0].n.length };
    });
    return [r.n === 100 && r.len === 40, r.n + ' entries; ' + r.len + ' characters'];
  }));
  claim(G + 'spin-the-wheel/', 'faq', 'Weights from 1 to 50 are accepted; a name without one counts as 1.', 'weights *99 and *0 become 50 and 1; no weight is 1', B, withPage('spin-the-wheel', async (p) => {
    const w = await p.evaluate(() => window.GAME_TOOLS['spin-the-wheel'].maths.parseEntries('A*3\nB*99\nC*0\nD').map((e) => e.w));
    return [w.join() === '3,50,1,1', w.join(',')];
  }));
  claim(G + 'scoreboard/', 'faq', 'From 2 to 12 teams and up to 50 rounds.', 'the team count is held to 2..12 and the engine\'s round limit is 50', B, withPage('scoreboard', async (p) => {
    const r = await p.evaluate(() => { const M = window.GAME_TOOLS.scoreboard.maths; return [M.initial(1).teams.length, M.initial(20).teams.length]; });
    return [r[0] === 2 && r[1] === 12 && /MAX_ROUNDS = 50/.test(src('game-scoreboard.js')), r.join(' and ') + ' teams; MAX_ROUNDS 50'];
  }));
  claim(G + 'scoreboard/', 'faq', 'up to 300 steps back', 'the undo list is capped at 300', N, async () => [/MAX_UNDO = 300/.test(src('game-scoreboard.js')), 'MAX_UNDO = 300']);
  claim(G + 'tambola-ticket-generator/', 'faq', '24 tickets, which is four strips of six', 'a count is rounded up to a multiple of 6 (24 stays 24) and held to 6..600', B, withPage('tambola-ticket-generator', async (p) => {
    const r = await p.evaluate(() => { const M = window.GAME_TOOLS['tambola-ticket-generator'].maths; return [M.normCount(1), M.normCount(7), M.normCount(5000), M.normCount(24)]; });
    return [r.join() === '6,12,600,24', r.join(', ')];
  }));
  claim(G + 'tambola-ticket-generator/', 'faq', 'Every ticket has 15 numbers, five in each row, and each column keeps its own range: 1–9, 10–19 and so on up to 80–90 in the last column, sorted top to bottom.', '24 tickets: 15 numbers, five a row, each column in its range and sorted', B, withPage('tambola-ticket-generator', async (p) => {
    const r = await p.evaluate(() => {
      const T = window.TambolaCore; let bad = 0;
      for (let i = 1; i <= 24; i++) {
        const g = T.ticket('K7MPQ2', i).rows; let n = 0;
        for (const row of g) { const c = row.filter(Boolean); if (c.length !== 5) bad++; n += c.length; }
        if (n !== 15) bad++;
        for (let c = 0; c < 9; c++) {
          const col = g.map((row) => row[c]).filter(Boolean);
          const lo = c === 0 ? 1 : c * 10, hi = c === 8 ? 90 : c * 10 + 9;
          if (col.some((x) => x < lo || x > hi) || col.join() !== [...col].sort((a, b) => a - b).join()) bad++;
        }
      }
      return bad;
    });
    return [r === 0, '24 tickets, ' + r + ' faults'];
  }));
  claim(G + 'tambola-ticket-generator/', 'faq', 'A strip of six uses every number from 1 to 90 exactly once, so each number called is on one ticket of every strip.', 'a strip of six holds 1 to 90 once each', B, withPage('tambola-ticket-generator', async (p) => {
    const a = await p.evaluate(() => { const T = window.TambolaCore; return [].concat(...T.ticketStrip('K7MPQ2', 1).map((t) => T.numbers(t))).sort((x, y) => x - y); });
    return [a.length === 90 && a.every((x, i) => x === i + 1), a.length + ' numbers, ' + a[0] + ' to ' + a[a.length - 1]];
  }));
  claim(G + 'charades-generator/', 'faq', 'Choose My own words and type one per line, up to 300 words of up to 60 characters.', 'parseCustom keeps 300 of 400 lines, none longer than 60 characters', B, withPage('charades-generator', async (p) => {
    const r = await p.evaluate(() => {
      const out = window.GAME_TOOLS['charades-generator'].maths.parseCustom(Array.from({ length: 400 }, (_, i) => 'word' + i + ' ' + 'y'.repeat(70)).join('\n'));
      const a = Array.isArray(out) ? out : (out.words || out.list || []);
      return [a.length, Math.max(...a.map((x) => String(typeof x === 'string' ? x : (x.w || x.word || x.text || x.n || '')).length))];
    });
    return [r[0] === 300 && r[1] <= 60 && r[1] > 0, r[0] + ' words; longest ' + r[1]];
  }));
};
