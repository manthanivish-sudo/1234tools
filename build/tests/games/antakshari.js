/* The Antakshari Scorekeeper's own rules, for build/tests/games.js. */
'use strict';
const KEY = 'mvr-games-antakshari-v1';
const SLUG = 'antakshari';
const Q = '[data-tool="antakshari"] ';
module.exports = {
  check: async function (page, h) {
    /* ---- the pure rules ---- */
    const r = await page.evaluate(() => {
      const M = window.GAME_TOOLS['antakshari'].maths, K = window.GameKit;
      const out = {};
      out.hi = [M.HI_CONS.length, new Set(M.HI_CONS).size, M.HI_CONS.every((c) => { const n = c.codePointAt(0); return n >= 0x0915 && n <= 0x0939; })];
      out.vow = [M.HI_VOW.length, M.HI_VOW.every((c) => { const n = c.codePointAt(0); return n >= 0x0905 && n <= 0x0914; })];
      out.en = M.EN.join('');
      out.sets = [M.letterSet('hi', false, '').length, M.letterSet('hi', true, '').length, M.letterSet('en', false, 'xqz').length,
        M.letterSet('en', false, 'xqz').some((l) => 'XQZ'.includes(l)), M.letterSet('both', true, '').length, M.letterSet('en', false, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ').length];
      out.pad = [M.keypad('hi').length, M.keypad('en').length, M.keypad('both').length];
      const draws = (set, n) => { const idx = new Map(set.map((l, i) => [l, i])); const c = new Array(set.length).fill(0); for (let i = 0; i < n; i++) c[idx.get(M.pickLetter(set, K.randInt))]++; return c; };
      out.c30 = draws(M.letterSet('hi', false, ''), 30000);
      out.c23 = draws(M.letterSet('en', false, 'XQZ'), 23000);
      out.c36 = draws(M.letterSet('hi', true, '').slice(0, 36), 36000);
      out.clean = ['a', ' क', 'का', '12', '', 'ts'].map((s) => M.cleanLetter(s));
      out.turns = [M.turnInfo(0, 2, 2, 2), M.turnInfo(3, 2, 2, 2), M.turnInfo(4, 2, 2, 2), M.turnInfo(8, 2, 2, 2)];
      out.rules = [M.ruleText(['any', '']), M.ruleText(['decade', '1990s']), M.ruleText(['own', 'Songs about trains']), M.ruleText(['own', '']), M.ruleText(undefined)];
      return out;
    });
    h.ok(r.hi[0] === 30 && r.hi[1] === 30 && r.hi[2], 'antakshari: 30 distinct Devanagari consonants', r.hi.join());
    h.ok(r.vow[0] === 10 && r.vow[1], 'antakshari: 10 Devanagari vowels');
    h.ok(r.en === 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'antakshari: A to Z');
    h.ok(r.sets.join() === '30,40,23,false,66,26', 'antakshari: letter sets (Hindi 30, with vowels 40, English minus XQZ 23, both 66, leaving everything out is ignored)', r.sets.join());
    h.ok(r.pad.join() === '40,26,66', 'antakshari: the tap grid has every letter, vowels included', r.pad.join());
    const chi30 = h.chiSquare(r.c30), chi23 = h.chiSquare(r.c23), chi36 = h.chiSquare(r.c36);
    h.ok(chi30 < h.CHI_001[29], 'antakshari: the random Hindi letter is uniform (chi² ' + chi30.toFixed(1) + ')');
    h.ok(chi23 < h.CHI_001[22], 'antakshari: the random English letter is uniform after leaving letters out (chi² ' + chi23.toFixed(1) + ')');
    h.ok(chi36 < h.CHI_001[35], 'antakshari: 36 letters with vowels are uniform (chi² ' + chi36.toFixed(1) + ')');
    h.ok(r.clean.join('|') === 'A|क|का|||T', 'antakshari: a typed letter is cleaned to one letter', r.clean.join('|'));
    h.ok(r.turns.map((t) => t.team + ':' + t.round + ':' + t.over).join() === '0:0:false,1:0:false,0:1:false,0:2:true', 'antakshari: turns alternate and rounds advance', JSON.stringify(r.turns));
    h.ok(r.rules.join('|') === 'Any song|Songs from one decade: 1990s|Songs about trains|My own rule|Any song', 'antakshari: round rules read as plain text', r.rules.join('|'));

    /* ---- helpers ---- */
    const dismiss = () => page.evaluate(() => { const b = document.querySelector('.cc .cc-no, .cc button'); if (b) b.click(); });
    const reloadWith = async (opt) => {
      await page.evaluate((k, o) => { localStorage.setItem(k, JSON.stringify({ opt: o })); }, KEY, opt);
      await page.reload({ waitUntil: 'load' });
      await dismiss();
    };
    const clickText = (prefix) => page.evaluate((p, q) => {
      const b = Array.from(document.querySelectorAll(q + 'button')).find((x) => x.offsetParent !== null && x.textContent.trim().indexOf(p) === 0);
      if (b) b.click();
      return !!b;
    }, prefix, Q);
    const text = (sel) => page.evaluate((s) => { const n = document.querySelector(s); return n && n.offsetParent !== null ? n.textContent : null; }, Q + sel);
    const stageText = (st, sel) => st.evaluate((s) => { const n = document.querySelector(s); return n ? n.textContent : null; }, sel);

    /* ---- the page ---- */
    await reloadWith({ teams: 2, names: 'Tigers, Lions', secs: 5, points: 2, alphabet: 'hi', vowels: false, leave: '', rounds: 2, turnsPer: 1, rules: [['any', ''], ['decade', '1990s']] });
    h.ok(await clickText('Start game'), 'antakshari: Start game is pressed');
    await h.sleep(150);
    const letter0 = await text('.ak-letter-host');
    const hiSet = await page.evaluate(() => window.GAME_TOOLS['antakshari'].maths.letterSet('hi', false, ''));
    h.ok(hiSet.includes(letter0), 'antakshari: the first letter is one of the 30 Hindi consonants', letter0);
    h.ok(/Tigers/.test((await text('.ak-team')) || '') && /Round 1 of 2 · Any song/.test((await text('.ak-rule-line')) || ''), 'antakshari: the first team and the round’s rule show', await text('.ak-rule-line'));
    const stage = await h.openStage(SLUG);
    await h.sleep(300);
    h.ok((await stageText(stage, '.ak-letter')) === letter0 && /Tigers/.test((await stageText(stage, '.cg-st-team')) || ''), 'antakshari: the TV shows the same letter and team', await stageText(stage, '.ak-letter'));
    h.ok(/Round 1 of 2 · Any song/.test((await stageText(stage, '.cg-st-sub')) || ''), 'antakshari: the TV shows the round’s rule');
    let changed = false;
    for (let i = 0; i < 30 && !changed; i++) { await clickText('New random letter'); changed = (await text('.ak-letter-host')) !== letter0; }
    h.ok(changed, 'antakshari: New random letter draws another letter');
    await h.sleep(200);
    const letter1 = await text('.ak-letter-host');
    h.ok((await stageText(stage, '.ak-letter')) === letter1, 'antakshari: the TV follows the new letter');
    await page.keyboard.press('n');
    await h.sleep(150);
    h.ok(/\d:\d\d/.test((await text('.cg-clock-host')) || ''), 'antakshari: N starts the timer', await text('.cg-clock-host'));
    h.ok(await page.evaluate(() => document.querySelectorAll('audio, video').length) === 0, 'antakshari: the page has no audio or video element');
    await h.sleep(250);
    h.ok(/\d:\d\d/.test((await stageText(stage, '.ak-clock')) || ''), 'antakshari: the TV shows the clock', await stageText(stage, '.ak-clock'));
    await clickText('Song sung'); await h.sleep(150);
    h.ok(/Tigers scored 2 points/.test((await text('.cg-between-msg')) || ''), 'antakshari: Song sung scores the points', await text('.cg-between-msg'));
    const sc1 = await page.evaluate((q) => Array.from(document.querySelectorAll(q + '.cg-scores-host .cg-sc-n')).map((n) => n.textContent).join(), Q);
    h.ok(sc1 === '2,0', 'antakshari: the scores read 2 and 0', sc1);
    await clickText('Undo the points'); await h.sleep(60);
    const sc2 = await page.evaluate((q) => Array.from(document.querySelectorAll(q + '.cg-scores-host .cg-sc-n')).map((n) => n.textContent).join(), Q);
    h.ok(sc2 === '0,0' && await clickText('Give the points'), 'antakshari: the points can be taken back and given again', sc2);
    const keyBox = await page.evaluate((q) => { const k = document.querySelector(q + '.ak-key'); return k ? k.getBoundingClientRect().height : 0; }, Q);
    h.ok(keyBox >= 44, 'antakshari: the letter keys are at least 44 px tall', String(keyBox));
    await page.evaluate((q) => { Array.from(document.querySelectorAll(q + '.ak-key')).find((b) => b.dataset.l === 'र').click(); }, Q);
    await h.sleep(60);
    h.ok(/Next team: र/.test(await page.evaluate((q) => Array.from(document.querySelectorAll(q + 'button')).map((b) => b.textContent).join('|'), Q)), 'antakshari: tapping a letter puts it on the Next team button');
    await clickText('Next team'); await h.sleep(250);
    h.ok((await text('.ak-letter-host')) === 'र' && /Lions/.test((await text('.ak-team')) || ''), 'antakshari: the next team gets the tapped letter', await text('.ak-letter-host'));
    h.ok((await stageText(stage, '.ak-letter')) === 'र', 'antakshari: the TV shows the tapped letter');
    /* a turn that runs out of time, with the page frozen for most of it */
    await clickText('Start timer'); await h.sleep(100);
    await page.evaluate(() => { const t = performance.now(); while (performance.now() - t < 3200); });
    await h.sleep(120);
    const clock = await text('.cg-clock-host');
    h.ok(clock === '0:02' || clock === '0:01', 'antakshari: after a frozen page the clock reads the time left', clock);
    await h.sleep(2000);
    h.ok(/Time’s up/.test((await text('.cg-between-msg')) || ''), 'antakshari: the turn ends on time and scores nothing', await text('.cg-between-msg'));
    await clickText('Give the points'); await h.sleep(60);
    /* a typed letter */
    await page.type(Q + '.ak-between input[type=text]', 'k');
    await h.sleep(60);
    h.ok(/Next team: K/.test(await page.evaluate((q) => Array.from(document.querySelectorAll(q + 'button')).map((b) => b.textContent).join('|'), Q)), 'antakshari: a typed letter is upper-cased on the button');
    await page.evaluate((q) => { const i = document.querySelector(q + '.ak-between input[type=text]'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); }, Q);
    await clickText('Next team'); await h.sleep(250);
    const letter3 = await text('.ak-letter-host');
    h.ok(hiSet.includes(letter3), 'antakshari: with no letter chosen the next team gets a random one', letter3);
    h.ok(/Round 2 of 2 · Songs from one decade: 1990s/.test((await text('.ak-rule-line')) || '') && /Round 2 of 2/.test((await stageText(stage, '.cg-st-sub')) || ''), 'antakshari: round 2 has its own rule, on the page and on the TV', await text('.ak-rule-line'));
    /* finish: turns 3 and 4 passed */
    await clickText('Start timer'); await h.sleep(80); await clickText('Pass'); await h.sleep(80);
    h.ok(/Passed/.test((await text('.cg-between-msg')) || ''), 'antakshari: Pass scores nothing');
    await clickText('Next team'); await h.sleep(100);
    await clickText('Start timer'); await h.sleep(80); await clickText('Song sung'); await h.sleep(80);
    await clickText('Next team'); await h.sleep(200);
    const end = await text('.cg-end .cg-between-msg');
    h.ok(/Lions win/.test(end || ''), 'antakshari: after the last turn the winner is shown', end);
    h.ok(/Lions win/.test((await stageText(stage, '.cg-st-line')) || ''), 'antakshari: the TV shows the winner', await stageText(stage, '.cg-st-line'));
    await stage.close();
    /* resume */
    await clickText('Play again');
    await reloadWith({ teams: 2, names: '', secs: 30, points: 1, alphabet: 'en', vowels: false, leave: 'XQZ', rounds: 1, turnsPer: 1, rules: [['any', '']] });
    await clickText('Start game'); await h.sleep(100);
    const L = await text('.ak-letter-host');
    h.ok(/^[A-Z]$/.test(L) && !'XQZ'.includes(L), 'antakshari: English letters with XQZ left out give a letter outside XQZ', L);
    await page.reload({ waitUntil: 'load' }); await dismiss();
    h.ok(await clickText('Continue the last game'), 'antakshari: Continue the last game is offered after a refresh');
    await h.sleep(100);
    h.ok((await text('.ak-letter-host')) === L, 'antakshari: the resumed game keeps its letter', await text('.ak-letter-host'));
    await page.evaluate((k) => localStorage.removeItem(k), KEY);
  },
  landings: {
    'antakshari-for-a-family-party': async function (page, h) {
      const r = await page.evaluate(() => ({
        pressed: Array.from(document.querySelectorAll('[data-tool] .game-seg [aria-pressed="true"]')).map((b) => b.textContent).join('|'),
        rounds: document.querySelectorAll('[data-tool] input[type=number]')[1].value,
        rules: Array.from(document.querySelectorAll('.ak-rule')).filter((x) => !x.hidden).map((x) => x.querySelector('select').value + ':' + x.querySelector('input').value).join()
      }));
      h.ok(/45 seconds/.test(r.pressed) && r.rounds === '3' && r.rules === 'any:,decade:1990s,theme:rain', 'antakshari landing: opens with 45 s, three rounds and their rules', JSON.stringify(r));
    }
  }
};
