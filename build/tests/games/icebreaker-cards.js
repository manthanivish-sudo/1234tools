/* The Icebreaker Question Cards' own rules, for build/tests/games.js. */
'use strict';
const KEY = 'mvr-games-icebreaker-cards-v1';
const SLUG = 'icebreaker-cards';
const Q = '[data-tool="icebreaker-cards"] ';
module.exports = {
  check: async function (page, h) {
    /* ---- the decks and the pure rules ---- */
    const r = await page.evaluate(() => {
      const M = window.GAME_TOOLS['icebreaker-cards'].maths, K = window.GameKit;
      const out = { ids: window.GAME_WORDS.icebreaker.decks.map((d) => d.id).join() };
      const blocked = /\b(money|rich|poor|pay|salary|rent|religio\w*|church|temple|mosque|god|prayer|politic\w*|election|vote|president|fat|thin|skinny|weight|diet|body|bodies|skin|hair|nose|teeth|belly)\b/i;
      out.decks = window.GAME_WORDS.icebreaker.decks.map((d) => {
        const cards = M.parseDeck(d), seen = new Set(), dups = [];
        cards.forEach((c) => { const k = c.text.toLowerCase(); if (seen.has(k)) dups.push(c.text); seen.add(k); });
        return {
          id: d.id, n: cards.length, dups,
          bad: cards.filter((c) => !c.a || (d.pair && !c.b) || c.text.length > 130 || /\s{2}|^\s|\s$/.test(c.text)).length,
          blocked: cards.filter((c) => blocked.test(c.text)).map((c) => c.text),
          questions: d.pair ? cards.length : cards.filter((c) => /\?$/.test(c.text)).length
        };
      });
      out.wyr = M.parseDeck(window.GAME_WORDS.icebreaker.decks[0])[0].text;
      out.tot = M.parseDeck(window.GAME_WORDS.icebreaker.decks[2])[0].text;
      const o1 = M.orderFor('QWE234', 60), o2 = M.orderFor('QWE234', 60);
      out.perm = o1.slice().sort((a, b) => a - b).every((v, i) => v === i) && o1.join() === o2.join() && o1.join() !== M.orderFor('QWE235', 60).join();
      const first = (n) => { const c = new Array(n).fill(0); for (let i = 0; i < 20000; i++) c[M.orderFor(K.newSeed(6), n)[0]]++; return c; };
      out.c20 = first(20); out.c40 = first(40);
      out.nav = [M.nav(0, 10, 1), M.nav(9, 10, 1), M.nav(10, 10, 1), M.nav(5, 10, -1), M.nav(0, 10, -1), M.nav(10, 10, -1)];
      out.swipe = [M.swipe(-90, 5, 200), M.swipe(90, -10, 300), M.swipe(40, 0, 200), M.swipe(-100, 90, 200), M.swipe(-100, 0, 3000), M.swipe(0, 120, 200)];
      out.size = [M.hostSize({ a: 'x', b: null, text: 'short' }), M.hostSize({ a: 'x', b: null, text: 'y'.repeat(100) }), M.stageSize({ a: 'x', b: null, text: 'short' }), M.stageSize({ a: 'x', b: null, text: 'y'.repeat(100) })];
      return out;
    });
    h.ok(r.ids === 'wyr,starters,thisorthat,classroom,party', 'icebreaker: the five decks are there', r.ids);
    r.decks.forEach((d) => {
      h.ok(d.n >= 80, 'icebreaker: deck ' + d.id + ' has at least 80 cards (' + d.n + ')');
      h.ok(d.dups.length === 0, 'icebreaker: deck ' + d.id + ' has no duplicates', d.dups.join(';'));
      h.ok(d.bad === 0, 'icebreaker: deck ' + d.id + ' has clean cards', String(d.bad));
      h.ok(d.blocked.length === 0, 'icebreaker: deck ' + d.id + ' avoids bodies, money, religion and politics', d.blocked.join(' | '));
      h.ok(d.questions === d.n, 'icebreaker: deck ' + d.id + ' is all questions or choices', d.questions + '/' + d.n);
    });
    h.ok(/^Would you rather .+ or .+\?$/.test(r.wyr), 'icebreaker: a would-you-rather card reads as a question', r.wyr);
    h.ok(/^.+ or .+\?$/.test(r.tot), 'icebreaker: a this-or-that card reads as a question', r.tot);
    h.ok(r.perm, 'icebreaker: the order is a permutation, repeatable from its seed');
    h.ok(h.chiSquare(r.c20) < h.CHI_001[19], 'icebreaker: every card equally likely first (20 cards, chi² ' + h.chiSquare(r.c20).toFixed(1) + ')');
    h.ok(h.chiSquare(r.c40) < h.CHI_001[39], 'icebreaker: every card equally likely first (40 cards, chi² ' + h.chiSquare(r.c40).toFixed(1) + ')');
    h.ok(r.nav.join() === '1,10,10,4,0,9', 'icebreaker: Next and Back stay inside the deck', r.nav.join());
    h.ok(r.swipe.join('|') === 'next|back||||', 'icebreaker: swipes need a sideways drag that is long and quick enough', r.swipe.join('|'));
    h.ok(r.size[0] > r.size[1] && r.size[2] > r.size[3], 'icebreaker: long cards get a smaller type size');

    /* ---- helpers ---- */
    const dismiss = () => page.evaluate(() => { const b = document.querySelector('.cc .cc-no, .cc button'); if (b) b.click(); });
    const reloadWith = async (o) => {
      await page.evaluate((k, v) => { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); }, KEY, o);
      await page.reload({ waitUntil: 'load' });
      await dismiss();
    };
    const clickText = (prefix) => page.evaluate((p, q) => {
      const b = Array.from(document.querySelectorAll(q + 'button')).find((x) => x.offsetParent !== null && !x.disabled && x.textContent.replace(/^[♥♡]\s*/, '').trim().indexOf(p) === 0);
      if (b) b.click();
      return !!b;
    }, prefix, Q);
    const clickExact = (label) => page.evaluate((t, q) => {
      const b = Array.from(document.querySelectorAll(q + 'button')).find((x) => x.offsetParent !== null && x.textContent.trim() === t);
      if (b) b.click();
      return !!b;
    }, label, Q);
    const cardText = () => page.evaluate((q) => { const n = document.querySelector(q + '.ib-body'); return n ? n.innerText.replace(/\s+/g, ' ').trim() : null; }, Q);
    const counter = () => page.evaluate((q) => document.querySelector(q + '.ib-counter').textContent, Q);
    const stageCard = (st) => st.evaluate(() => { const n = document.querySelector('.game-stage-body'); return n ? n.innerText.replace(/\s+/g, ' ').trim() : ''; });

    /* ---- the page: a whole deck, once each ---- */
    await reloadWith({ deck: 'starters', secs: 0 });
    h.ok(/Press Draw a card/.test(await cardText()), 'icebreaker: the page starts with a prompt, not a card');
    const stage = await h.openStage(SLUG);
    await h.sleep(300);
    h.ok(/Press Draw a card/.test(await stageCard(stage)), 'icebreaker: the TV shows the prompt too');
    h.ok(await clickText('Draw a card'), 'icebreaker: Draw a card is pressed');
    await h.sleep(150);
    const first = await cardText();
    h.ok(first && !/Press Draw/.test(first) && /card 1 of /.test(await counter()), 'icebreaker: the first card shows with its number', first + ' / ' + await counter());
    h.ok((await stageCard(stage)).indexOf(first) >= 0, 'icebreaker: the TV shows the same card', await stageCard(stage));
    await page.keyboard.press('ArrowRight'); await h.sleep(250);
    const second = await cardText();
    h.ok(second !== first && (await stageCard(stage)).indexOf(second) >= 0, 'icebreaker: the right arrow moves to the next card and the TV follows', second);
    await page.keyboard.press('ArrowLeft'); await h.sleep(100);
    h.ok((await cardText()) === first, 'icebreaker: the left arrow goes back to the last card');
    await clickText('Next card'); await h.sleep(60);
    await clickText('Skip'); await h.sleep(60);
    h.ok(/1 skipped/.test(await counter()), 'icebreaker: Skip is counted', await counter());
    const all = await page.evaluate((q) => {
      const seen = [], read = () => document.querySelector(q + '.ib-body').innerText.replace(/\s+/g, ' ').trim();
      const next = Array.from(document.querySelectorAll(q + 'button')).find((b) => b.textContent.indexOf('Next card') === 0);
      let guard = 0;
      while (!next.disabled && guard++ < 200) { seen.push(read()); next.click(); }
      return { seen, last: read(), counter: document.querySelector(q + '.ib-counter').textContent };
    }, Q);
    const total = await page.evaluate(() => window.GAME_TOOLS['icebreaker-cards'].maths.parseDeck(window.GAME_WORDS.icebreaker.decks[1]).length);
    h.ok(/last card/.test(all.last) && /all \d+ cards used/.test(all.counter), 'icebreaker: after the last card the deck says it is used up', all.last + ' / ' + all.counter);
    h.ok(all.seen.length === total - 2, 'icebreaker: Next never repeats a card on the way through the deck (' + all.seen.length + ' of ' + total + ')');
    h.ok(new Set(all.seen).size === all.seen.length, 'icebreaker: no card appeared twice');
    await h.sleep(300);
    h.ok(/last card/.test(await stageCard(stage)), 'icebreaker: the TV says the deck is used up');
    await stage.close();
    await clickText('Shuffle again'); await h.sleep(100);
    h.ok(/Press Draw a card/.test(await cardText()), 'icebreaker: Shuffle again starts a new order');
    await clickText('Draw a card'); await h.sleep(60);

    /* ---- pair cards, swipes, favourites ---- */
    await reloadWith({ deck: 'wyr', secs: 0 });
    await clickText('Draw a card'); await h.sleep(100);
    const pairText = await cardText();
    h.ok(/^.+ or .+$/i.test(pairText) && (await page.evaluate((q) => document.querySelector(q + '.ib-card .ib-lead').textContent, Q)) === 'Would you rather…', 'icebreaker: a would-you-rather card shows its lead and two choices', pairText);
    const swipe = (dx, dy) => page.evaluate((q, dx, dy) => {
      const c = document.querySelector(q + '.ib-card');
      const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerType: 'touch', clientX: x, clientY: y }));
      ev('pointerdown', 300, 300); ev('pointerup', 300 + dx, 300 + dy);
    }, Q, dx, dy);
    await swipe(-120, 5); await h.sleep(80);
    const afterSwipe = await cardText();
    h.ok(afterSwipe !== pairText, 'icebreaker: a swipe left shows the next card');
    await swipe(0, 140); await h.sleep(60);
    h.ok((await cardText()) === afterSwipe, 'icebreaker: a vertical drag does nothing');
    await swipe(130, 4); await h.sleep(80);
    h.ok((await cardText()) === pairText, 'icebreaker: a swipe right goes back');
    await clickText('Favourite'); await h.sleep(60);
    h.ok(/Favourites \(1\)/.test(await page.evaluate((q) => document.querySelector(q + '.ib-favs summary').textContent, Q)), 'icebreaker: the heart adds a favourite');
    await clickText('Next card'); await h.sleep(60);
    const afterFav = await cardText();
    await page.reload({ waitUntil: 'load' }); await dismiss();
    h.ok((await cardText()) === afterFav, 'icebreaker: a refresh keeps the place in the deck', await cardText());
    h.ok(/Favourites \(1\)/.test(await page.evaluate((q) => document.querySelector(q + '.ib-favs summary').textContent, Q)), 'icebreaker: a favourite is kept on this device');
    await page.evaluate((q) => { document.querySelector(q + '.ib-favs').open = true; }, Q);
    await clickExact('Show'); await h.sleep(80);
    h.ok((await cardText()) === pairText, 'icebreaker: Show puts a favourite on the card', await cardText());
    await clickText('Next card'); await h.sleep(80);
    h.ok((await cardText()) === afterFav, 'icebreaker: Next after a favourite returns to the deck where it was');
    await clickExact('Remove'); await h.sleep(60);
    h.ok(/Favourites \(0\)/.test(await page.evaluate((q) => document.querySelector(q + '.ib-favs summary').textContent, Q)), 'icebreaker: Remove deletes a favourite');

    /* ---- the timer follows timestamps ---- */
    await reloadWith({ deck: 'thisorthat', secs: 3 });
    const st2 = await h.openStage(SLUG);
    await clickText('Draw a card'); await h.sleep(150);
    const c0 = await page.evaluate((q) => document.querySelector(q + '.ib-clock-host').textContent, Q);
    h.ok(/0:0[23]/.test(c0), 'icebreaker: the timer starts when the card shows', c0);
    await h.sleep(300);
    h.ok(/0:0\d/.test(await st2.evaluate(() => { const n = document.querySelector('.ib-clock'); return n ? n.textContent : ''; })), 'icebreaker: the TV shows the timer');
    await page.evaluate(() => { const t = performance.now(); while (performance.now() - t < 2300); });
    await h.sleep(120);
    const c1 = await page.evaluate((q) => document.querySelector(q + '.ib-clock-host').textContent, Q);
    h.ok(c1 === '0:01' || c1 === '0:00' || c1 === 'Time!', 'icebreaker: after a frozen page the timer reads the time left', c1);
    await h.sleep(1500);
    h.ok((await page.evaluate((q) => document.querySelector(q + '.ib-clock-host').textContent, Q)) === 'Time!', 'icebreaker: the timer ends on time');
    await st2.close();
    await page.evaluate((k) => localStorage.removeItem(k), KEY);
  },
  landings: {
    'would-you-rather-questions-for-kids': async function (page, h) {
      const r = await page.evaluate(() => Array.from(document.querySelectorAll('[data-tool] .ib-deck-btn[aria-pressed="true"] strong')).map((b) => b.textContent).join());
      h.ok(/Would you rather/.test(r), 'icebreaker landing: would-you-rather opens on that deck', r);
    },
    'icebreaker-questions-for-meetings': async function (page, h) {
      const r = await page.evaluate(() => ({
        deck: Array.from(document.querySelectorAll('[data-tool] .ib-deck-btn[aria-pressed="true"] strong')).map((b) => b.textContent).join(),
        secs: Array.from(document.querySelectorAll('[data-tool] .game-seg [aria-pressed="true"]')).map((b) => b.textContent).join()
      }));
      h.ok(/Conversation starters/.test(r.deck) && r.secs === '60 s', 'icebreaker landing: meetings open on Conversation starters with a 60 s timer', JSON.stringify(r));
    }
  }
};
