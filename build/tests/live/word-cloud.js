/* Live Word Cloud: grouping, limits and the no-overlap layout against
   independent checks, then a real session. Run by build/tests/live-rooms.js. */
'use strict';

const overlaps = (a, b, tol) => a.x < b.x + b.w - tol && b.x < a.x + a.w - tol && a.y < b.y + b.h - tol && b.y < a.y + a.h - tol;
const sendWord = (ph, w) => ph.page.evaluate((w) => {
  const i = document.querySelector('#card input.txt');
  const b = Array.from(document.querySelectorAll('#card button')).find((x) => /Send/.test(x.textContent));
  if (!i || !b || i.disabled) return false;
  i.value = w; b.click(); return true;
}, w);
const hostWords = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.live-words li')).map((li) => [li.querySelector('.live-word').textContent, Number(li.querySelector('strong').textContent), li.classList.contains('is-hidden')]));
const clickText = (page, text) => page.evaluate((text) => {
  const b = Array.from(document.querySelectorAll('[data-tool] .tool-io button')).find((x) => x.textContent.trim().startsWith(text));
  if (b) b.click();
  return !!b;
}, text);

module.exports = {
  async maths(page, h) {
    const { ok } = h;
    const r = await page.evaluate(() => {
      const M = window.ROOM_TOOLS['word-cloud'].maths;
      const st = M.fresh(), card = { n: 2, l: 25 };
      const adds = [M.addWord(st, 'a', 'Team Work', card), M.addWord(st, 'a', 'teamwork', card), M.addWord(st, 'a', 'Coffee', card), M.addWord(st, 'a', 'Third', card),
        M.addWord(st, 'b', 'TEAM   WORK', card), M.addWord(st, 'b', 'x'.repeat(26), card), M.addWord(st, 'b', 42, card), M.addWord(st, 'c', 'team work', Object.assign({ cl: 1 }, card)),
        M.addWord(st, 'c', '  team work ', card)];
      const top1 = M.top(st, new Set(), false, 10).map((x) => [x.text, x.n]);
      const hidden = M.top(st, new Set([M.keyOf('coffee')]), false, 10).map((x) => x.text);
      M.removePhone(st, 'a');
      const top2 = M.top(st, new Set(), false, 10).map((x) => [x.text, x.n]);
      /* the layout with a stand-in measure: 0.6 em a character */
      const words = Array.from({ length: 60 }, (_, i) => ({ text: (i % 7 === 0 ? 'collaboration' : 'w') + i, n: 60 - i + (i % 3) }));
      words.sort((a, b) => b.n - a.n);
      const measure = (t, px) => t.length * 0.6 * px;
      const boxes = M.layout(words, measure, 1200, 600);
      const again = M.layout(words, measure, 1200, 600);
      const small = M.layout(words, measure, 390, 300);
      return { adds, top1, hidden, top2, boxes, same: JSON.stringify(boxes) === JSON.stringify(again), small, keys: [M.keyOf('Team Work'), M.keyOf('teamwork'), M.keyOf('TEAM\tWORK')] };
    });
    ok(r.keys[0] === 'teamwork' && r.keys[1] === 'teamwork' && r.keys[2] === 'teamwork', 'word-cloud maths: grouped ignoring case and every space');
    ok(JSON.stringify(r.adds.map((x) => x !== null)) === JSON.stringify([true, false, true, false, true, false, false, false, true]), 'word-cloud maths: one per word per phone, the limit, 25 characters, closed', JSON.stringify(r.adds));
    ok(JSON.stringify(r.top1) === JSON.stringify([['Team Work', 3], ['Coffee', 1]]), 'word-cloud maths: counted once per phone, shown in the form most typed', JSON.stringify(r.top1));
    ok(JSON.stringify(r.hidden) === JSON.stringify(['Team Work']), 'word-cloud maths: hidden words left out');
    ok(JSON.stringify(r.top2) === JSON.stringify([['TEAM WORK', 2]]), 'word-cloud maths: a removed phone takes its words and its spelling with it', JSON.stringify(r.top2));
    for (const [label, boxes, W, H] of [['1200x600', r.boxes, 1200, 600], ['390x300', r.small, 390, 300]]) {
      let clash = null;
      for (let i = 0; i < boxes.length && !clash; i++) for (let j = i + 1; j < boxes.length; j++) if (overlaps(boxes[i], boxes[j], 0)) { clash = boxes[i].text + ' / ' + boxes[j].text; break; }
      ok(!clash, 'word-cloud layout ' + label + ': no two words overlap', clash);
      ok(boxes.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H), 'word-cloud layout ' + label + ': every word inside the area');
    }
    ok(r.boxes.length >= 50, 'word-cloud layout: at least 50 of 60 words find room on 1200x600', String(r.boxes.length));
    ok(r.boxes[0].text === 'collaboration0' && r.boxes[0].fs >= Math.max(...r.boxes.map((b) => b.fs)), 'word-cloud layout: the most common word is placed first and largest');
    ok(r.same, 'word-cloud layout: the same words give the same cloud (no jumping)');
  },

  async flow(h) {
    const { ok, waitFor, sleep, phones } = h;
    const N = phones.length;
    const { page: host, code } = await h.startHost('word-cloud', async (p) => {
      await p.evaluate(() => {
        const io = document.querySelector('[data-tool="word-cloud"] .tool-io');
        const q = io.querySelector('input[type="text"]');
        q.value = 'One word for this year'; q.dispatchEvent(new Event('change', { bubbles: true }));
        io.querySelector('.game-seg button:nth-child(2)').click();
        io.querySelectorAll('label.game-check').forEach((l) => {
          const c = l.querySelector('input');
          if (/Mask/.test(l.textContent) && !c.checked) c.click();
          if (/Show top answers/.test(l.textContent) && c.checked) c.click();
        });
      });
    });
    if (!code) return;
    ok(await clickText(host, 'Ask for words'), 'word-cloud: Ask for words');
    ok((await h.joinAll(code)) === N, 'word-cloud: ' + N + ' phones join');
    ok(await waitFor(() => Promise.all(phones.map((ph) => ph.page.evaluate(() => !!document.querySelector('#card input.txt')))).then((a) => a.every(Boolean)), 8000), 'word-cloud: every phone shows the word box');
    await h.clearFrames(phones);

    const forms = ['Team Work', 'teamwork', 'TEAMWORK'];
    const sent = await Promise.all(phones.map((ph) => sendWord(ph, ph.i < 10 ? forms[ph.i % 3] : ph.i === N - 1 ? 'shit' : 'idea' + ph.i)));
    ok(sent.every(Boolean), 'word-cloud: every phone sends a word');
    await sendWord(phones[0], 'Coffee');
    await sendWord(phones[1], 'coffee');
    const third = await sendWord(phones[0], 'Extra');
    ok(!third, 'word-cloud: a phone cannot send more than the limit (2)');
    const distinct = 1 + 1 + (N - 11) + 1;
    const ready = await waitFor(async () => { const w = await hostWords(host); return w.length === distinct ? w : null; }, 10000);
    ok(!!ready, 'word-cloud: the host has ' + distinct + ' different words', ready ? '' : JSON.stringify((await hostWords(host)).length));
    const w = ready || await hostWords(host);
    const find = (t) => w.find((x) => x[0] === t) || w.find((x) => x[0].toLowerCase() === t.toLowerCase());
    ok(find('Team Work') && find('Team Work')[1] === 10, 'word-cloud: "Team Work", "teamwork" and "TEAMWORK" count as one word, 10 phones', JSON.stringify(find('Team Work')));
    ok(find('Coffee') && find('Coffee')[1] === 2, 'word-cloud: "Coffee" and "coffee" from two phones count 2');
    ok(!!find('s***') && !w.some((x) => /shit/i.test(x[0])), 'word-cloud: the rude word is masked on the host page');

    /* phones never see anyone else's words while the top list is off */
    let leak = 0;
    for (const ph of phones) for (const f of await h.frames(ph)) { const s = JSON.stringify(f); if (/idea\d|Coffee|coffee|shit|s\*\*\*|teamwork|Team Work/i.test(s)) leak++; }
    ok(leak === 0, 'word-cloud: no phone receives any word (top list off)', String(leak));

    /* the big screen: real rendered boxes, none overlapping */
    const stage = await h.open('/live/word-cloud/?stage=1');
    const boxes = await waitFor(() => stage.evaluate((n) => {
      const ts = Array.from(document.querySelectorAll('.st-cloud svg text'));
      if (ts.length < n) return null;
      const svg = document.querySelector('.st-cloud svg').getBoundingClientRect();
      return { svg: { w: svg.width, h: svg.height }, t: ts.map((t) => { const b = t.getBBox(); return { text: t.textContent, x: b.x, y: b.y, w: b.width, h: b.height, fs: Number(t.getAttribute('font-size')) }; }) };
    }, distinct), 10000);
    if (ok(!!boxes, 'word-cloud: the big screen draws every word')) {
      let clash = null;
      const t = boxes.t;
      for (let i = 0; i < t.length && !clash; i++) for (let j = i + 1; j < t.length; j++) if (overlaps(t[i], t[j], 0.5)) { clash = t[i].text + ' / ' + t[j].text; break; }
      ok(!clash, 'word-cloud: on the big screen no two rendered words overlap (measured with getBBox)', clash);
      ok(t.every((b) => b.x >= -0.5 && b.y >= -0.5 && b.x + b.w <= boxes.svg.w + 0.5 && b.y + b.h <= boxes.svg.h + 0.5), 'word-cloud: every rendered word inside the cloud');
      const biggest = t.slice().sort((a, b) => b.fs - a.fs)[0];
      ok(biggest.text === 'Team Work', 'word-cloud: the most common word is the biggest', biggest.text);
      ok(!t.some((b) => /shit/i.test(b.text)) && t.some((b) => b.text === 's***'), 'word-cloud: the big screen shows the masked form');
    }

    /* hide a word: gone from the big screen */
    await host.evaluate(() => { const li = Array.from(document.querySelectorAll('.live-words li')).find((x) => x.querySelector('.live-word').textContent === 'idea12'); if (li) li.querySelector('button').click(); });
    ok(await waitFor(() => stage.evaluate(() => !Array.from(document.querySelectorAll('.st-cloud svg text')).some((t) => t.textContent === 'idea12')), 5000), 'word-cloud: Hide takes a word off the big screen');

    /* the top list on phones: hidden and rude words handled */
    await host.evaluate(() => { const l = Array.from(document.querySelectorAll('label.game-check')).find((x) => /Show top answers/.test(x.textContent)); l.querySelector('input').click(); });
    const rv = await waitFor(async () => { for (const f of await h.frames(phones[5])) if (f.v && Array.isArray(f.v.rv)) return f.v.rv; return null; }, 5000);
    ok(rv && rv.length === 20 && rv[0][0] === 'Team Work' && rv[0][1] === 10, 'word-cloud: with the top list on, phones receive the top 20 words', rv && JSON.stringify(rv.slice(0, 2)));
    ok(rv && !rv.some((x) => x[0] === 'idea12' || /shit/i.test(x[0])), 'word-cloud: the top list on phones leaves out hidden words and masks rude ones');

    /* reconnect: the phone keeps its allowance and its one count per word */
    const before = await h.socketCount(phones[2]);
    await h.dropSocket(phones[2]);
    ok(await waitFor(async () => (await h.socketCount(phones[2])) > before && h.connected(phones[2]), 15000, 200), 'word-cloud: a dropped phone reconnects');
    await sendWord(phones[2], 'Coffee');
    await sendWord(phones[2], 'More');
    ok(await waitFor(async () => { const x = (await hostWords(host)).find((y) => y[0] === 'Coffee'); return x && x[1] === 3; }, 5000), 'word-cloud: after reconnecting a phone can use its second word');
    ok(!(await hostWords(host)).some((x) => x[0] === 'More'), 'word-cloud: and no more than its limit');

    await h.endSession(host, 'word-cloud', phones);
    await stage.close();
    await host.close();
    await sleep(200);
  }
};
