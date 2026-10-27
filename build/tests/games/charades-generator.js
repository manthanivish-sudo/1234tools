/* The Dumb Charades Generator's own rules, for build/tests/games.js. */
'use strict';
const KEY = 'mvr-games-charades-generator-v1';
const SLUG = 'charades-generator';
const Q = '[data-tool="charades-generator"] ';
module.exports = {
  check: async function (page, h) {
    /* ---- the decks and the pure rules ---- */
    const r = await page.evaluate(() => {
      const spec = window.GAME_TOOLS['charades-generator'], M = spec.maths, K = window.GameKit;
      const decks = window.GAME_WORDS.charades.decks.map((d) => {
        const items = M.parseDeck(d);
        const seen = new Set(), dups = [];
        items.forEach((i) => { const k = i.w.toLowerCase(); if (seen.has(k)) dups.push(i.w); seen.add(k); });
        return {
          id: d.id, film: !!d.film, n: items.length,
          diffs: [1, 2, 3].map((x) => items.filter((i) => i.d === x).length),
          badDiff: items.filter((i) => ![1, 2, 3].includes(i.d)).length,
          badYear: items.filter((i) => d.film ? !(Number.isInteger(i.y) && i.y >= 1930 && i.y <= 2026) : i.y !== null).length,
          empty: items.filter((i) => !i.w || i.w !== i.w.trim() || /@|\|/.test(i.w)).length,
          dups
        };
      });
      const out = { decks };
      out.ids = window.GAME_WORDS.charades.decks.map((d) => d.id).join();
      const o1 = M.orderFor('ABC234', 50), o2 = M.orderFor('ABC234', 50), o3 = M.orderFor('ABC235', 50);
      out.perm = o1.slice().sort((a, b) => a - b).every((v, i) => v === i);
      out.same = o1.join() === o2.join();
      out.diff = o1.join() !== o3.join();
      const items = Array.from({ length: 80 }, (_, i) => ({ w: 'w' + i, d: 1, y: null }));
      const seen = new Set(); for (let p = 0; p < 80; p++) seen.add(M.wordAt(items, 'GAME42', p).w);
      out.noRepeat = seen.size;
      out.pass2 = Array.from({ length: 80 }, (_, p) => M.wordAt(items, 'GAME42', 80 + p).w).sort().join() === items.map((i) => i.w).sort().join();
      const first = (n) => { const c = new Array(n).fill(0); for (let i = 0; i < 20000; i++) c[M.orderFor(K.newSeed(6), n)[0]]++; return c; };
      out.c20 = first(20); out.c40 = first(40);
      out.pool = [M.pool(M.parseDeck(window.GAME_WORDS.charades.decks[0]), 1).length, M.pool(M.parseDeck(window.GAME_WORDS.charades.decks[0]), 3).length];
      out.custom = M.parseCustom('Mango\n mango \nTea  time\n\nSoup').map((i) => i.w).join('|');
      out.turns = [M.turnInfo(0, 3, 2), M.turnInfo(4, 3, 2), M.turnInfo(6, 3, 2)];
      out.rem = [M.remaining(1000, 400), M.remaining(1000, 1500)];
      out.win = [M.winners([3, 5, 5]).join(), M.winners([1, 0]).join()];
      out.clock = [M.clock(90000), M.clock(59001), M.clock(0), M.clock(9500)];
      out.pts = [M.points({ d: 3 }, true), M.points({ d: 3 }, false)];
      return out;
    });
    h.ok(r.ids === 'bollywood,hollywood,animals,actions,jobs,objects,kids,christmas,diwali', 'charades: the nine decks are there', r.ids);
    r.decks.forEach((d) => {
      h.ok(d.n >= (d.film ? 150 : 80), 'charades: deck ' + d.id + ' has enough words (' + d.n + ')');
      h.ok(d.badDiff === 0 && d.diffs.every((x) => x > 0), 'charades: deck ' + d.id + ' has difficulties 1-3 ' + d.diffs.join('/'));
      h.ok(d.badYear === 0, 'charades: deck ' + d.id + ': ' + (d.film ? 'every film has a year' : 'no years'), String(d.badYear));
      h.ok(d.empty === 0, 'charades: deck ' + d.id + ' has clean entries', String(d.empty));
      h.ok(d.dups.length === 0, 'charades: deck ' + d.id + ' has no duplicates', d.dups.join(';'));
    });
    h.ok(r.perm && r.same && r.diff, 'charades: the order is a permutation, repeatable from its code');
    h.ok(r.noRepeat === 80 && r.pass2, 'charades: no word twice in a pass, and the next pass reshuffles all of them', String(r.noRepeat));
    h.ok(h.chiSquare(r.c20) < h.CHI_001[19], 'charades: every word equally likely first (20 words, chi² ' + h.chiSquare(r.c20).toFixed(1) + ')');
    h.ok(h.chiSquare(r.c40) < h.CHI_001[39], 'charades: every word equally likely first (40 words, chi² ' + h.chiSquare(r.c40).toFixed(1) + ')');
    h.ok(r.pool[0] > 0 && r.pool[0] < r.pool[1], 'charades: level 1 is a smaller pool than all', r.pool.join('/'));
    h.ok(r.custom === 'Mango|Tea time|Soup', 'charades: typed words are trimmed and de-duplicated', r.custom);
    h.ok(r.turns[0].team === 0 && r.turns[1].team === 1 && r.turns[1].round === 2 && !r.turns[1].over && r.turns[2].over, 'charades: turn order cycles through the teams and ends after the last round');
    h.ok(r.rem[0] === 600 && r.rem[1] === 0, 'charades: remaining time is deadline minus now, never negative');
    h.ok(r.win[0] === '1,2' && r.win[1] === '0', 'charades: ties share the win', r.win.join(' '));
    h.ok(r.clock.join() === '1:30,1:00,0:00,0:10', 'charades: the clock rounds up to whole seconds', r.clock.join());
    h.ok(r.pts[0] === 3 && r.pts[1] === 1, 'charades: harder words score their difficulty only when asked');

    /* ---- helpers ---- */
    const dismiss = () => page.evaluate(() => { const b = document.querySelector('.cc .cc-no, .cc button'); if (b) b.click(); });
    const reloadWith = async (opt) => {
      await page.evaluate((k, o) => { localStorage.setItem(k, JSON.stringify(o)); }, KEY, { opt });
      await page.reload({ waitUntil: 'load' });
      await dismiss();
    };
    const clickText = (prefix) => page.evaluate((p, q) => {
      const b = Array.from(document.querySelectorAll(q + 'button')).find((x) => x.offsetParent !== null && x.textContent.trim().indexOf(p) === 0);
      if (b) b.click();
      return !!b;
    }, prefix, Q);
    const text = (sel) => page.evaluate((s) => { const n = document.querySelector(s); return n && n.offsetParent !== null ? n.textContent : null; }, Q + sel);
    const blank = async (sel) => { const t = await text(sel); return t === null || t === ''; };

    /* ---- the page: a short custom game; nothing on the stage may carry a word ---- */
    const WORDS = ['Zebracorn', 'Quokkaberry', 'Mangosteen', 'Pickleball', 'Thunderpuff', 'Wobblewick', 'Jellyfax', 'Crumpetone', 'Snorklewit', 'Blimpoon', 'Fizzbucket', 'Gloopernaut'];
    await reloadWith({ deck: 'custom', level: 3, teams: 2, names: 'Tigers, Lions', secs: 5, skips: 1, rounds: 1, harder: false, cover: false });
    await page.evaluate(() => {
      window.__msgs = [];
      const c = new BroadcastChannel('mvr-games:charades-generator');
      c.onmessage = (e) => window.__msgs.push(JSON.stringify(e.data));
      window.__chan = c;
    });
    await page.type(Q + 'textarea', WORDS.join('\n'));
    h.ok(await clickText('Start game'), 'charades: Start game is pressed');
    await h.sleep(150);
    h.ok(/Tigers/.test((await text('.cg-ready-msg')) || ''), 'charades: the first team is up', await text('.cg-ready-msg'));
    h.ok(await blank('.cg-word'), 'charades: no word is shown before the turn starts');
    const stage = await h.openStage(SLUG);
    await h.sleep(300);
    h.ok(/Tigers/.test(await stage.evaluate(() => document.body.innerText)), 'charades: the TV names the team that is up');
    await clickText('Start turn');
    await h.sleep(150);
    const w1 = await text('.cg-word');
    h.ok(WORDS.includes(w1), 'charades: a word from the deck shows on the host page', w1);
    const seen = [w1];
    await clickText('Got it'); await h.sleep(60); seen.push(await text('.cg-word'));
    await clickText('Skip'); await h.sleep(60); seen.push(await text('.cg-word'));
    const skipDisabled = await page.evaluate((q) => Array.from(document.querySelectorAll(q + 'button')).find((x) => x.textContent.indexOf('Skip') === 0).disabled, Q);
    h.ok(skipDisabled, 'charades: the skip limit disables Skip once used');
    await clickText('Skip'); await h.sleep(60);
    h.ok((await text('.cg-word')) === seen[2], 'charades: a further Skip does nothing');
    await clickText('Got it'); await h.sleep(60); seen.push(await text('.cg-word'));
    h.ok(new Set(seen).size === seen.length && seen.every((x) => WORDS.includes(x)), 'charades: no word repeats within the game', seen.join());
    const tally = await text('.cg-tally');
    h.ok(/Got it: 2/.test(tally) && /Skips left: 0/.test(tally), 'charades: the tally counts got-its and skips', tally);
    await h.sleep(300);
    const stText = await stage.evaluate(() => document.body.innerText);
    h.ok(/Got it: 2/.test(stText) && /\d:\d\d/.test(stText), 'charades: the TV shows the clock and the tally', stText.replace(/\s+/g, ' ').slice(0, 120));
    /* the clock follows timestamps: freeze the page for 3.2 s of a 5 s turn */
    await page.evaluate(() => { const t = performance.now(); while (performance.now() - t < 3200); });
    await h.sleep(120);
    const clock = await text('.cg-clock-host');
    h.ok(clock === '0:02' || clock === '0:01', 'charades: after a frozen page the clock reads the time left, not ticks counted', clock);
    await h.sleep(2000);
    const bm = (await text('.cg-between-msg')) || '';
    h.ok(/Tigers got 2 words: 2 points/.test(bm), 'charades: the turn ends on time and scores 2', bm);
    h.ok(await blank('.cg-word'), 'charades: the word is cleared at the buzzer');
    await page.evaluate((q) => { document.querySelector(q + '.cg-log-btn').click(); }, Q);
    await h.sleep(80);
    h.ok(/1 word: 1 point/.test((await text('.cg-between-msg')) || ''), 'charades: tapping a word in the list takes its point back', await text('.cg-between-msg'));
    await h.sleep(300);
    const msgs = await page.evaluate(() => window.__msgs.slice());
    const stText2 = await stage.evaluate(() => document.body.innerText + document.body.innerHTML);
    const leak = WORDS.filter((w) => msgs.some((m) => m.indexOf(w) >= 0) || stText2.indexOf(w) >= 0);
    h.ok(msgs.length > 3, 'charades: the host sent the TV states (' + msgs.length + ')');
    h.ok(leak.length === 0, 'charades: no word ever reached the TV', leak.join());
    const keys = msgs.map((m) => Object.keys(JSON.parse(m).s || {}).join()).filter((v, i, a) => a.indexOf(v) === i);
    h.ok(!keys.some((k) => /word|item|current|log/.test(k)), 'charades: the state sent to the TV has no word field', keys.join(' | '));
    await stage.close();
    await clickText('Next team'); await h.sleep(100);
    h.ok(/Lions/.test((await text('.cg-ready-msg')) || ''), 'charades: the next team is up', await text('.cg-ready-msg'));
    await clickText('Start turn'); await h.sleep(5600);
    await clickText('Next team'); await h.sleep(150);
    const endMsg = await text('.cg-end .cg-between-msg');
    h.ok(endMsg !== null && /Tigers win/.test(endMsg), 'charades: after the last turn the winner is shown', endMsg);

    /* ---- 12 words, 13 draws: all distinct, then a reshuffle with a notice ---- */
    await reloadWith({ deck: 'custom', level: 3, teams: 2, names: '', secs: 60, skips: -1, rounds: 1, harder: false, cover: false });
    await page.type(Q + 'textarea', WORDS.join('\n'));
    await clickText('Start game'); await h.sleep(100);
    await clickText('Start turn'); await h.sleep(100);
    const all = [];
    for (let i = 0; i < 12; i++) { all.push(await text('.cg-word')); await clickText('Got it'); await h.sleep(30); }
    h.ok(new Set(all).size === 12, 'charades: 12 draws from 12 words use each once', all.join());
    h.ok(/shuffled again/.test((await text('.cg-status')) || ''), 'charades: a used-up deck says it was shuffled again');
    await clickText('Pause'); await h.sleep(100);
    h.ok(await blank('.cg-word'), 'charades: pausing hides the word');
    await clickText('Carry on'); await h.sleep(100);
    h.ok(WORDS.includes(await text('.cg-word')), 'charades: carrying on shows a word again');

    /* ---- a built-in deck, cover mode, and resuming after a refresh ---- */
    await reloadWith({ deck: 'animals', level: 1, teams: 3, names: '', secs: 60, skips: 3, rounds: 2, harder: false, cover: true });
    await clickText('Start game'); await h.sleep(100);
    const code = (await text('.cg-code')) || '';
    await clickText('Start turn'); await h.sleep(100);
    h.ok(await blank('.cg-word'), 'charades: cover mode hides the word until held');
    const holdPoint = async () => {
      const hb = await page.$(Q + '.cg-hold');
      await hb.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      const box = await hb.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      return box;
    };
    const box = await holdPoint();
    h.ok(box.height >= 44, 'charades: the hold button is at least 44 px tall', String(box.height));
    await page.mouse.down(); await h.sleep(80);
    const held = await text('.cg-word');
    await page.mouse.up(); await h.sleep(80);
    h.ok(held && held.length > 1, 'charades: holding the button shows the word', held);
    h.ok(await blank('.cg-word'), 'charades: letting go hides it again');
    const savedSeed = await page.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k)); return d.game && d.game.seed; }, KEY);
    h.ok(savedSeed && code.indexOf(savedSeed) >= 0, 'charades: a game in progress is saved with its code', code + ' / ' + savedSeed);
    await page.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k)); d.game.turn = 4; d.game.scores = [3, 1, 2]; d.game.pos = 9; localStorage.setItem(k, JSON.stringify(d)); }, KEY);
    await page.reload({ waitUntil: 'load' });
    await dismiss();
    h.ok(await clickText('Continue the last game'), 'charades: Continue the last game is offered after a refresh');
    await h.sleep(100);
    h.ok(/Team 2, you are up \(round 2 of 2\)/.test((await text('.cg-ready-msg')) || ''), 'charades: the game resumes at the saved turn', await text('.cg-ready-msg'));
    h.ok(((await text('.cg-code')) || '').indexOf(savedSeed) >= 0, 'charades: the resumed game has the same code');
    const sc = await page.evaluate((q) => Array.from(document.querySelectorAll(q + '.cg-scores-host .cg-sc-n')).map((n) => n.textContent).join(), Q);
    h.ok(sc === '3,1,2', 'charades: the scores are kept', sc);
    const nextWord = await page.evaluate((k) => {
      const d = JSON.parse(localStorage.getItem(k)).game, M = window.GAME_TOOLS['charades-generator'].maths;
      const items = M.pool(M.parseDeck(window.GAME_WORDS.charades.decks.find((x) => x.id === d.deckId)), d.level);
      return M.wordAt(items, d.seed, d.pos).w;
    }, KEY);
    await clickText('Start turn'); await h.sleep(80);
    await holdPoint(); await page.mouse.down(); await h.sleep(80);
    const got = await text('.cg-word');
    await page.mouse.up();
    h.ok(got === nextWord, 'charades: a resumed game deals the next word of the same order', nextWord + ' vs ' + got);
    await page.evaluate((k) => localStorage.removeItem(k), KEY);
  },
  landings: {
    'bollywood-dumb-charades-movie-names': async function (page, h) {
      const r = await page.evaluate(() => ({
        deck: document.querySelector('[data-tool] select').value,
        pressed: Array.from(document.querySelectorAll('[data-tool] .game-seg [aria-pressed="true"]')).map((b) => b.textContent).join('|')
      }));
      h.ok(r.deck === 'bollywood' && /All/.test(r.pressed) && /90 seconds/.test(r.pressed), 'charades landing: Bollywood opens on the Bollywood deck, all words, 90 s', r.deck + ' ' + r.pressed);
    },
    'charades-ideas-for-kids': async function (page, h) {
      const r = await page.evaluate(() => ({
        deck: document.querySelector('[data-tool] select').value,
        pressed: Array.from(document.querySelectorAll('[data-tool] .game-seg [aria-pressed="true"]')).map((b) => b.textContent).join('|'),
        skips: document.querySelectorAll('[data-tool] select')[1].value
      }));
      h.ok(r.deck === 'kids' && r.pressed.split('|')[0] === 'Easy' && /120 seconds/.test(r.pressed) && r.skips === '5', 'charades landing: kids opens on the kids deck, easy words, 120 s, 5 skips', JSON.stringify(r));
    }
  }
};
