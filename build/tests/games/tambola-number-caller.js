/* The Tambola Number Caller's own rules, for build/tests/games.js.
   Fairness is held to a uniform distribution (chi-square), the claim checker
   to what is missing worked out here from the ticket's own rows, and the page
   to what a host does: call, undo, refresh, check a claim, new game. */
'use strict';
const SLUG = 'tambola-number-caller';
const KEY = 'mvr-games-' + SLUG + '-v1';

/* chi-square critical value at p = 0.001 for any df (Wilson–Hilferty) */
function chiCrit(df) { const z = 3.0902, a = 2 / (9 * df); return df * Math.pow(1 - a + z * Math.sqrt(a), 3); }

async function clickText(page, text) {
  const ok = await page.evaluate((slug, text) => {
    const b = Array.from(document.querySelectorAll('[data-tool="' + slug + '"] button')).find((x) => x.textContent.trim().indexOf(text) === 0 && x.offsetParent !== null);
    if (b) b.click();
    return !!b;
  }, SLUG, text);
  if (!ok) throw new Error('no button "' + text + '"');
}
const hostState = (page) => page.evaluate(() => ({
  lit: Array.from(document.querySelectorAll('.tc-board .tc-cell.is-on')).map((c) => Number(c.textContent)),
  now: document.querySelector('.tc-num').textContent,
  last: document.querySelector('.tc-board .tc-cell.is-last') ? Number(document.querySelector('.tc-board .tc-cell.is-last').textContent) : null
}));

module.exports = {
  check: async function (page, h) {
    const r = await page.evaluate(() => {
      const T = window.TambolaCore, K = window.GameKit, M = window.GAME_TOOLS['tambola-number-caller'].maths;
      const out = {};
      /* 200 games of 90 calls: every number exactly once */
      let bad = 0;
      for (let g = 0; g < 200; g++) {
        const called = [];
        for (let i = 0; i < 90; i++) called.push(M.draw(called, K.randInt));
        const s = called.slice().sort((a, b) => a - b);
        if (s.join() !== Array.from({ length: 90 }, (_, i) => i + 1).join()) bad++;
        if (M.draw(called, K.randInt) !== null) bad++;
      }
      out.bad = bad;
      /* the first draw of 9,000 games */
      const first = new Array(90).fill(0);
      for (let g = 0; g < 9000; g++) first[M.draw([], K.randInt) - 1]++;
      out.first = first;
      /* a draw from a part-played game only ever gives a number not yet called */
      const part = [5, 17, 22, 90, 1];
      let repeat = 0;
      for (let i = 0; i < 2000; i++) if (part.indexOf(M.draw(part, K.randInt)) >= 0) repeat++;
      out.repeat = repeat;
      out.en = T.CALLS.slice(1);
      out.hi = T.HINDI.slice(1);
      out.say22 = T.speakText(22, { calls: true, style: 'tambola' });
      out.plain22 = T.speakText(22, { calls: false });
      out.hi22 = T.speakText(22, { lang: 'hi' });
      out.in26 = T.callFor(26, 'tambola'); out.gb26 = T.callFor(26, 'bingo');
      out.words = [1, 13, 20, 22, 45, 90].map(T.words);
      return out;
    });
    h.ok(r.bad === 0, 'caller: 90 calls draw every number exactly once (200 games)', String(r.bad));
    const chi = h.chiSquare(r.first);
    h.ok(chi < chiCrit(89), 'caller: the first draw is uniform over 1–90 in 9,000 games (chi² ' + chi.toFixed(1) + ' < ' + chiCrit(89).toFixed(1) + ')');
    h.ok(r.repeat === 0, 'caller: a draw never repeats a called number');
    h.ok(r.en.length === 90 && r.en.every((s) => typeof s === 'string' && s.length > 2), 'caller: 90 English calls');
    h.ok(r.hi.length === 90 && r.hi.every((s) => /^[ऀ-ॿ\s]+$/.test(s)), 'caller: 90 Hindi numbers in Devanagari');
    h.ok(new Set(r.hi).size === 90, 'caller: the Hindi numbers are all different');
    const banned = /\b(fat|dirty|naughty|drawers|knickers|sex|beer|drunk|booze|heinz|kiss|bed)\b/i;
    h.ok(!r.en.some((s) => banned.test(s)), 'caller: no call unfit for children', r.en.filter((s) => banned.test(s)).join(' | '));
    h.ok(r.say22 === 'Twenty-two… Two little ducks… twenty-two.', 'caller: 22 is said with its call', r.say22);
    h.ok(r.plain22 === 'Two and two, twenty-two.', 'caller: 22 without calls', r.plain22);
    h.ok(r.hi22 === 'दो और दो, बाईस।', 'caller: 22 in Hindi', r.hi22);
    h.ok(r.in26 === 'Republic Day' && r.gb26 === 'Pick and mix', 'caller: Indian and British wording differ where they should');
    h.ok(r.words.join() === 'one,thirteen,twenty,twenty-two,forty-five,ninety', 'caller: number words', r.words.join());

    /* ---- the page: call, undo, refresh ---- */
    await page.evaluate((k) => { localStorage.removeItem(k); }, KEY);
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Space'); await h.sleep(30); }
    let s = await hostState(page);
    h.ok(s.lit.length === 5, 'caller: Space calls a number (5 presses, 5 lit)', String(s.lit.length));
    h.ok(String(s.last) === s.now, 'caller: the current number is the one outlined on the board', s.now + ' vs ' + s.last);
    await clickText(page, 'Undo last call');
    const u = await hostState(page);
    h.ok(u.lit.length === 4 && u.lit.indexOf(Number(s.now)) < 0, 'caller: undo takes back the last number', u.lit.join());
    await page.reload({ waitUntil: 'load' });
    const back = await hostState(page);
    h.ok(back.lit.join() === u.lit.join() && back.now === u.now, 'caller: a refresh keeps the game', back.lit.join() + ' / ' + back.now);

    /* ---- the stage follows ---- */
    const stage = await h.openStage(SLUG);
    await h.sleep(400);
    const st = () => stage.evaluate(() => ({
      lit: Array.from(document.querySelectorAll('.tcs-cell.is-on')).map((c) => Number(c.textContent)),
      now: (document.querySelector('.tcs-num') || {}).textContent
    }));
    let sv = await st();
    h.ok(sv.lit.join() === back.lit.join() && sv.now === back.now, 'caller: the TV shows the board and the current number', sv.lit.join() + ' / ' + sv.now);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Enter');
    await h.sleep(400);
    const after = await hostState(page);
    sv = await st();
    h.ok(after.lit.length === 5 && sv.now === after.now && sv.lit.length === 5, 'caller: the TV follows the next call', sv.now + ' vs ' + after.now);
    /* a key pressed in the TV window calls a number on the host */
    await stage.bringToFront();
    await stage.keyboard.press('Space');
    await h.sleep(400);
    const viaTv = await hostState(page);
    h.ok(viaTv.lit.length === 6, 'caller: Space on the TV window calls the next number', String(viaTv.lit.length));
    const sent = await stage.evaluate(() => document.querySelector('.tcs-call').textContent);
    h.ok(sent && sent !== 'Eyes down…', 'caller: the call is shown under the number on the TV', sent);

    /* ---- check a claim from a ticket ID ---- */
    const setup = await page.evaluate((k) => {
      const T = window.TambolaCore;
      const t = T.ticket('TESTS1', 7);
      const top = t.rows[0].filter(Boolean), mid = t.rows[1].filter(Boolean);
      const called = [91 - top[0]].filter((x) => top.concat(mid).indexOf(x) < 0 && t.rows[2].indexOf(x) < 0)
        .concat(top, [mid[1]]);
      const saved = JSON.parse(localStorage.getItem(k));
      saved.game.called = called;
      localStorage.setItem(k, JSON.stringify(saved));
      return { id: t.id, rows: t.rows, called: called };
    }, KEY);
    await page.bringToFront();
    await page.reload({ waitUntil: 'load' });
    const idSel = '[data-tool="' + SLUG + '"] input[placeholder="K7MPQ2-014"]';
    await page.click(idSel, { clickCount: 3 });
    await page.keyboard.type('tests1 7');
    const claim = async (prize) => {
      await page.evaluate((slug, prize) => {
        const sel = Array.from(document.querySelectorAll('[data-tool="' + slug + '"] select')).find((s) => Array.from(s.options).some((o) => o.value === 'full'));
        sel.value = prize; sel.dispatchEvent(new Event('change'));
      }, SLUG, prize);
      await clickText(page, 'Check claim');
      await h.sleep(50);
      return page.evaluate(() => ({
        verdict: document.querySelector('.tc-verdict').textContent,
        good: document.querySelector('.tc-verdict').classList.contains('is-good'),
        nums: Array.from(document.querySelectorAll('.tk-wrap .tk-grid td')).map((td) => Number(td.textContent) || 0),
        marked: Array.from(document.querySelectorAll('.tk-wrap .tk-grid td.is-called')).map((td) => Number(td.textContent)),
        id: (document.querySelector('.tk-wrap .tk-id') || {}).textContent,
        award: !document.querySelector('.tc-verdict ~ .game-row').hidden
      }));
    };
    const top = await claim('top');
    const flat = [].concat.apply([], setup.rows);
    h.ok(top.id === 'TESTS1-007' && top.nums.join() === flat.join(), 'caller: the ticket ID rebuilds the same ticket on the page', top.id);
    const onTicket = flat.filter((x) => x && setup.called.indexOf(x) >= 0).sort((a, b) => a - b);
    h.ok(top.marked.slice().sort((a, b) => a - b).join() === onTicket.join(), 'caller: the called numbers are marked on the ticket', top.marked.join());
    h.ok(top.good && /Good claim: Top line/.test(top.verdict), 'caller: a complete top line is a good claim', top.verdict);
    h.ok(/latest call/.test(top.verdict), 'caller: a claim completed before the last call is flagged as late', top.verdict);
    h.ok(top.award, 'caller: a good claim can be awarded');
    const midMissing = setup.rows[1].filter((x) => x && setup.called.indexOf(x) < 0);
    const mid = await claim('middle');
    h.ok(!mid.good && mid.verdict.indexOf(midMissing.join(', ')) >= 0, 'caller: a short middle line lists exactly its missing numbers', mid.verdict + ' (want ' + midMissing.join(', ') + ')');
    const early = await claim('early5');
    h.ok(early.good, 'caller: six numbers on the ticket is a good Early Five', early.verdict);
    const full = await claim('full');
    h.ok(!full.good && new RegExp('still needs ' + (15 - onTicket.length) + '|needs').test(full.verdict), 'caller: Full House is not yet won', full.verdict);
    await claim('top');
    await page.click('[data-tool="' + SLUG + '"] input[placeholder="Asha"]');
    await page.keyboard.type('Nani');
    await clickText(page, 'Award Top line');
    await h.sleep(400);
    const prizesOnTv = await stage.evaluate(() => Array.from(document.querySelectorAll('.tcs-prizes li.is-won')).map((l) => l.textContent));
    h.ok(prizesOnTv.length === 1 && /Top line: Nani/.test(prizesOnTv[0]), 'caller: the winner appears on the TV', prizesOnTv.join(' | '));
    await stage.close();

    /* ---- new game asks first ---- */
    await clickText(page, 'New game');
    const asked = await page.evaluate(() => ({ box: !document.querySelector('.tc-confirm').hidden, lit: document.querySelectorAll('.tc-board .tc-cell.is-on').length }));
    h.ok(asked.box && asked.lit === setup.called.length, 'caller: New game asks before clearing', JSON.stringify(asked));
    await clickText(page, 'Yes, new game');
    const cleared = await page.evaluate(() => ({ lit: document.querySelectorAll('.tc-board .tc-cell.is-on').length, won: document.querySelectorAll('.tc-won').length }));
    h.ok(cleared.lit === 0 && cleared.won === 0, 'caller: a new game clears the board and the winners', JSON.stringify(cleared));

    /* ---- auto-call: a countdown, then a call (voice off: headless Chrome has no voices) ---- */
    await page.evaluate(() => { const c = Array.from(document.querySelectorAll('.game-check')).find((l) => /Speak the numbers/.test(l.textContent)).querySelector('input'); if (c.checked) c.click(); });
    await page.evaluate(() => { const i = document.querySelector('[data-tool="tambola-number-caller"] input[type=number]'); i.value = '3'; i.dispatchEvent(new Event('change')); });
    await clickText(page, 'Start auto-call');
    await h.sleep(1200);
    const a1 = await page.evaluate(() => ({ lit: document.querySelectorAll('.tc-board .tc-cell.is-on').length, meta: document.querySelector('.tc-meta').textContent }));
    h.ok(a1.lit === 1 && /Next number in \d s|Waiting/.test(a1.meta), 'caller: auto-call calls one at once and counts down', JSON.stringify(a1));
    await h.sleep(2600);
    const a2 = await page.evaluate(() => document.querySelectorAll('.tc-board .tc-cell.is-on').length);
    h.ok(a2 === 2, 'caller: auto-call calls the next after the interval', String(a2));
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('p');
    await h.sleep(3600);
    const a3 = await page.evaluate(() => ({ lit: document.querySelectorAll('.tc-board .tc-cell.is-on').length, meta: document.querySelector('.tc-meta').textContent }));
    h.ok(a3.lit === 2 && /paused/.test(a3.meta), 'caller: P pauses auto-call', JSON.stringify(a3));
    await clickText(page, 'New game');
    await clickText(page, 'Yes, new game');
  },
  landings: {
    'diwali-tambola-caller': async function (page, h) {
      const r = await page.evaluate(() => ({ lang: document.querySelector('[data-tool] select').value, title: Array.from(document.querySelectorAll('[data-tool] input[type=text]')).map((i) => i.value) }));
      h.ok(r.lang === 'en-IN' && r.title.indexOf('Diwali Tambola') >= 0, 'caller landing: Diwali opens with Indian calls and its title', JSON.stringify(r));
    },
    'kitty-party-tambola': async function (page, h) {
      const r = await page.evaluate(() => ({ lang: document.querySelector('[data-tool] select').value, secs: document.querySelector('[data-tool] input[type=number]').value }));
      h.ok(r.lang === 'hi' && r.secs === '10', 'caller landing: kitty party opens in Hindi, ten seconds apart', JSON.stringify(r));
    },
    '90-ball-bingo-caller': async function (page, h) {
      const r = await page.evaluate(() => ({
        lang: document.querySelector('[data-tool] select').value,
        on: Array.from(document.querySelectorAll('.tc-prizes input:checked')).map((i) => i.parentNode.textContent.trim())
      }));
      h.ok(r.lang === 'en-GB' && r.on.join() === 'One line,Two lines,Full House', 'caller landing: 90-ball bingo opens with British calls and its three prizes', JSON.stringify(r));
    }
  }
};
