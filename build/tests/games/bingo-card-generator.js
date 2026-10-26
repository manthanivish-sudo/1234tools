/* The Bingo Card Generator's own rules, for build/tests/games.js.
   Cards are held to the 75-ball layout and the word rules by a checker
   written here; the caller to a uniform distribution (chi-square); printing
   to the paper with print media emulated; the PDF to its page count. */
'use strict';
const SLUG = 'bingo-card-generator';
function chiCrit(df) { const z = 3.0902, a = 2 / (9 * df); return df * Math.pow(1 - a + z * Math.sqrt(a), 3); }
const MM = 96 / 25.4;

function faults75(grid) {
  const f = [];
  if (grid.length !== 5 || grid.some((r) => r.length !== 5)) return ['not 5×5'];
  const all = new Set();
  for (let c = 0; c < 5; c++) {
    const lo = c * 15 + 1, hi = c * 15 + 15;
    const col = grid.map((r) => r[c]);
    col.forEach((x, r) => {
      if (r === 2 && c === 2) { if (x !== 0) f.push('centre is not free'); return; }
      if (!Number.isInteger(x) || x < lo || x > hi) f.push(x + ' outside ' + 'BINGO'[c] + ' ' + lo + '–' + hi);
      if (all.has(x)) f.push(x + ' twice');
      all.add(x);
    });
  }
  if (all.size !== 24) f.push(all.size + ' numbers, not 24');
  return f;
}

module.exports = {
  check: async function (page, h) {
    /* ---- 5,000 75-ball cards ---- */
    const cards = await page.evaluate(() => {
      const M = window.GAME_TOOLS['bingo-card-generator'].maths, K = window.GameKit;
      const out = [];
      for (let i = 0; i < 5000; i++) { const c = M.card75(K.newSeed(6), 1 + K.randInt(200)); out.push(c.grid); }
      return out;
    });
    const bad = [];
    cards.forEach((g, i) => { const f = faults75(g); if (f.length && bad.length < 3) bad.push(i + ': ' + f.slice(0, 2).join('; ')); });
    h.ok(cards.length === 5000 && bad.length === 0, 'bingo: 5,000 75-ball cards keep their column ranges, 24 different numbers and a free centre', bad.join(' | '));

    const r = await page.evaluate(() => {
      const M = window.GAME_TOOLS['bingo-card-generator'].maths, K = window.GameKit;
      const out = {};
      out.same = JSON.stringify(M.card75('ABC234', 7).grid) === JSON.stringify(M.card75('abc234', 7).grid) && JSON.stringify(M.card75('ABC234', 7).grid) !== JSON.stringify(M.card75('ABC234', 8).grid);
      /* word cards: a list with repeats in other cases */
      const text = Array.from({ length: 40 }, (_, i) => 'Word ' + i).concat(['word 3', 'WORD 7', '  Word 9  ', '']).join('\n');
      const list = M.wordList(text);
      out.listLen = list.length;
      const words = [];
      for (let i = 0; i < 3000; i++) {
        const size = [3, 4, 5][i % 3], free = i % 2 === 0;
        const c = M.cardWords(K.newSeed(6), 1 + K.randInt(200), list, size, free);
        words.push({ size: size, free: free, grid: c.grid });
      }
      out.words = words;
      out.list = list;
      out.short = M.cardWords('X', 1, list.slice(0, 23), 5, true) === null && M.cardWords('X', 1, list.slice(0, 24), 5, true) !== null && M.cardWords('X', 1, list.slice(0, 24), 5, false) === null;
      out.sq = [M.squares(3, true), M.squares(4, true), M.squares(5, true), M.squares(5, false)];
      out.label = [M.label(1), M.label(15), M.label(16), M.label(45), M.label(75), M.label('Pram')];
      /* the caller: fair first draws, every ball once */
      const all = M.pool('numbers', []);
      const first = new Array(75).fill(0);
      for (let g = 0; g < 7500; g++) first[M.draw([], all, K.randInt) - 1]++;
      out.first = first;
      const ten = list.slice(0, 10), fw = new Array(10).fill(0);
      for (let g = 0; g < 10000; g++) fw[ten.indexOf(M.draw([], ten, K.randInt))]++;
      out.fw = fw;
      let full = 0;
      for (let g = 0; g < 100; g++) {
        const called = [];
        for (let i = 0; i < 75; i++) called.push(M.draw(called, all, K.randInt));
        if (called.slice().sort((a, b) => a - b).join() !== all.join() || M.draw(called, all, K.randInt) !== null) full++;
      }
      out.full = full;
      out.wordRepeat = 0;
      for (let i = 0; i < 500; i++) { const c = ['word 1', 'Word 2']; const x = M.draw(c, ten, K.randInt); if (/^word [12]$/i.test(x)) out.wordRepeat++; }
      return out;
    });
    h.ok(r.same, 'bingo: the same set code and number give the same card (any case); another number another card');
    h.ok(r.listLen === 40, 'bingo: repeated words in the list count once, whatever their case', String(r.listLen));
    const lower = new Set(r.list.map((w) => w.toLowerCase()));
    const wf = [];
    r.words.forEach((c, i) => {
      const n = c.size, mid = Math.floor(n / 2), freeOn = c.free && n % 2 === 1;
      const seen = new Set();
      let cells = 0;
      c.grid.forEach((row, ri) => row.forEach((w, ci) => {
        if (freeOn && ri === mid && ci === mid) { if (w !== null) wf.push(i + ': centre not free'); return; }
        if (typeof w !== 'string' || !lower.has(w.toLowerCase())) wf.push(i + ': ' + w + ' not in the list');
        if (seen.has(String(w).toLowerCase())) wf.push(i + ': ' + w + ' twice');
        seen.add(String(w).toLowerCase()); cells++;
      }));
      if (c.grid.length !== n || cells !== n * n - (freeOn ? 1 : 0)) wf.push(i + ': wrong shape');
    });
    h.ok(wf.length === 0, 'bingo: 3,000 word cards (3×3, 4×4, 5×5) use each word at most once, all from the list, free centre only where asked', wf.slice(0, 3).join(' | '));
    h.ok(r.short, 'bingo: a list shorter than the squares makes no card (24 words fill 5×5 with a free centre, not without)');
    h.ok(r.sq.join() === '8,16,24,25', 'bingo: squares to fill per size', r.sq.join());
    h.ok(r.label.join() === 'B 1,B 15,I 16,N 45,O 75,Pram', 'bingo: calls carry their column letter', r.label.join());
    const chi = h.chiSquare(r.first);
    h.ok(chi < chiCrit(74), 'bingo caller: the first ball is uniform over 1–75 in 7,500 games (chi² ' + chi.toFixed(1) + ')');
    const chiW = h.chiSquare(r.fw);
    h.ok(chiW < h.CHI_001[9], 'bingo caller: the first word is uniform over 10 words in 10,000 games (chi² ' + chiW.toFixed(1) + ')');
    h.ok(r.full === 0, 'bingo caller: 75 calls draw every ball once (100 games)', String(r.full));
    h.ok(r.wordRepeat === 0, 'bingo caller: a called word is never drawn again, whatever its case');

    /* ---- the page: too few words says how many more ---- */
    const setField = (label, value) => page.evaluate((label, value) => {
      const f = Array.from(document.querySelectorAll('[data-tool] .game-field')).find((x) => x.querySelector('.game-field-label').textContent === label);
      const i = f.querySelector('input, select, textarea');
      i.value = value;
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.dispatchEvent(new Event('change', { bubbles: true }));
    }, label, value);
    const click = (text) => page.evaluate((text) => {
      const b = Array.from(document.querySelectorAll('[data-tool] button')).find((x) => x.textContent.trim() === text && x.offsetParent !== null);
      if (!b) throw new Error('no button ' + text);
      b.click();
    }, text);
    await click('Word bingo');
    await setField('Your words, one per line', 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj');
    await setField('Card size', '5');
    const short = await page.evaluate(() => ({ msg: Array.from(document.querySelectorAll('[data-tool] .game-msg')).map((m) => m.textContent).join(' '), print: Array.from(document.querySelectorAll('[data-tool] button')).find((b) => b.textContent === 'Print').disabled }));
    h.ok(/add 14 more/.test(short.msg) && short.print, 'bingo: ten words for a 5×5 card with a free centre asks for 14 more', short.msg);

    /* ---- printing ---- */
    await click('75-ball numbers');
    await page.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
    const printed = async (per, n, paper) => {
      await setField('Paper', paper);
      await setField('Layout', String(per));
      await setField('How many cards', String(n));
      await click('Print');
      await page.emulateMediaType('print');
      const res = await page.evaluate(() => {
        const vis = Array.from(document.body.children).filter((x) => !x.classList.contains('tt-print') && getComputedStyle(x).display !== 'none' && x.tagName !== 'SCRIPT' && x.tagName !== 'STYLE');
        let outside = 0;
        const sheets = Array.from(document.querySelectorAll('body > .tt-print .tt-sheet')).map((s) => {
          const sr = s.getBoundingClientRect();
          const cs = Array.from(s.querySelectorAll('.bg-card'));
          cs.forEach((c) => {
            const a = c.getBoundingClientRect(), b = c.parentNode.getBoundingClientRect();
            if (a.left < b.left - 0.5 || a.right > b.right + 0.5 || a.top < b.top - 0.5 || a.bottom > b.bottom + 0.5) outside++;
            if (b.bottom > sr.bottom + 0.5) outside++;
          });
          return { n: cs.length, h: sr.height };
        });
        return { chrome: vis.length, sheets, outside, page: (document.getElementById('tt-page') || {}).textContent || '' };
      });
      await page.emulateMediaType('screen');
      return res;
    };
    const p4 = await printed(4, 8, 'a4');
    h.ok(p4.chrome === 0 && p4.sheets.length === 2 && p4.sheets.every((s) => s.n === 4 && Math.abs(s.h - (297 - 16) * MM) < 2) && p4.outside === 0, 'bingo print: 8 cards at 4 a page → 2 A4 pages, chrome hidden, all fitting', JSON.stringify(p4));
    const p1 = await printed(1, 3, 'letter');
    h.ok(p1.sheets.length === 3 && p1.sheets.every((s) => s.n === 1 && Math.abs(s.h - (279.4 - 16) * MM) < 2) && p1.outside === 0 && /letter/.test(p1.page), 'bingo print: 3 cards at 1 a page → 3 Letter pages', JSON.stringify(p1));
    await click('Word bingo');
    await setField('Your words, one per line', Array.from({ length: 30 }, (_, i) => 'Supercalifragilistic ' + i + ' and a long phrase').join('\n'));
    const pw = await printed(2, 4, 'a4');
    h.ok(pw.sheets.length === 2 && pw.sheets.every((s) => s.n === 2) && pw.outside === 0, 'bingo print: long word cards at 2 a page still fit', JSON.stringify(pw));
    await page.evaluate(() => window.TambolaCore.clearPrint());

    /* ---- PDF on demand ---- */
    await click('75-ball numbers');
    await setField('Layout', '4');
    await setField('How many cards', '8');
    const loadedBefore = await page.evaluate(() => !!window.MVRPdfCore);
    await page.evaluate(() => {
      window.GameKit.download = (blob, name) => {
        blob.arrayBuffer().then((b) => {
          const u = new Uint8Array(b); let s = '';
          for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
          window.__pdf = { name, type: blob.type, head: s.slice(0, 5), pages: (s.match(/\/Type\s*\/Page(?![s\w])/g) || []).length };
        });
      };
    });
    await click('Download PDF');
    for (let i = 0; i < 40 && !(await page.evaluate(() => !!window.__pdf)); i++) await h.sleep(100);
    const pdf = await page.evaluate(() => window.__pdf || null);
    h.ok(!loadedBefore && pdf && pdf.type === 'application/pdf' && pdf.head === '%PDF-' && pdf.pages === 2 && /^bingo-cards-.*\.pdf$/.test(pdf.name), 'bingo pdf: loaded on demand; 8 cards at 4 a page is a 2-page PDF', JSON.stringify(pdf));

    /* ---- the caller tab: call, undo, refresh, stage ---- */
    await click('Call the game');
    const mode = await page.evaluate(() => document.querySelector('[aria-label="Call"] [aria-pressed="true"]').textContent);
    if (mode !== 'Numbers 1–75') { await click('Numbers 1–75'); const yes = await page.evaluate(() => !document.querySelector('.tc-confirm').hidden); if (yes) await click('Yes, new game'); }
    const lit = () => page.evaluate(() => Array.from(document.querySelectorAll('.tc-board.is-75 .tc-cell.is-on')).map((c) => Number(c.textContent)));
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); await h.sleep(30); }
    const a = await lit();
    const shown = await page.evaluate(() => document.querySelector('.tc-num').textContent);
    h.ok(a.length === 3 && /^[BINGO] \d+$/.test(shown), 'bingo caller: Space calls a ball, shown as B 7', a.join() + ' / ' + shown);
    await click('Undo last call');
    const b = await lit();
    h.ok(b.length === 2, 'bingo caller: undo takes the last ball back');
    await page.reload({ waitUntil: 'load' });
    await click('Call the game');
    const c = await lit();
    h.ok(c.join() === b.join(), 'bingo caller: a refresh keeps the game', c.join());
    const stage = await h.openStage(SLUG);
    await h.sleep(400);
    const sv = await stage.evaluate(() => ({ lit: Array.from(document.querySelectorAll('.tcs-cell.is-on')).map((x) => Number(x.textContent)), now: document.querySelector('.tcs-num').textContent }));
    h.ok(sv.lit.join() === c.join() && /^[BINGO] \d+$/.test(sv.now), 'bingo caller: the TV shows the board and the current ball', JSON.stringify(sv));
    await stage.close();
    await page.bringToFront();
    /* word game from the list on the cards tab */
    await click('Words from your list');
    await click('Yes, new game');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Enter');
    const w = await page.evaluate(() => ({ on: document.querySelectorAll('.tc-words .tc-word.is-on').length, total: document.querySelectorAll('.tc-words .tc-word').length, now: document.querySelector('.tc-num').textContent }));
    h.ok(w.on === 1 && w.total === 30 && /Supercalifragilistic/.test(w.now), 'bingo caller: calls words from your list', JSON.stringify(w));
    await click('New game');
    await click('Yes, new game');
    await click('Numbers 1–75');
    await click('Make cards');
  },
  landings: {
    'baby-shower-bingo': async function (page, h) {
      const r = await page.evaluate(() => ({
        mode: document.querySelector('[aria-label="Kind of card"] [aria-pressed="true"]').textContent,
        words: document.querySelector('[data-tool] textarea').value.split('\n').length,
        free: document.querySelector('[data-tool] .game-check input').checked,
        cards: document.querySelectorAll('.bg-cards .bg-card').length
      }));
      h.ok(r.mode === 'Word bingo' && r.words === 30 && r.free && r.cards === 4, 'bingo landing: baby shower opens with 30 baby words on 5×5 cards', JSON.stringify(r));
    },
    'classroom-vocabulary-bingo': async function (page, h) {
      const r = await page.evaluate(() => ({
        size: Array.from(document.querySelectorAll('[data-tool] select'))[0].value,
        freeOff: document.querySelector('[data-tool] .game-check input').disabled,
        words: document.querySelector('[data-tool] textarea').value.split('\n').length
      }));
      h.ok(r.size === '4' && r.freeOff && r.words === 20, 'bingo landing: classroom opens with 4×4 cards from 20 words', JSON.stringify(r));
    },
    '75-ball-bingo-cards': async function (page, h) {
      const r = await page.evaluate(() => ({
        mode: document.querySelector('[aria-label="Kind of card"] [aria-pressed="true"]').textContent,
        heads: document.querySelector('.bg-cards .bg-grid thead').textContent
      }));
      h.ok(r.mode === '75-ball numbers' && r.heads === 'BINGO', 'bingo landing: 75-ball opens with B-I-N-G-O cards', JSON.stringify(r));
    }
  }
};
