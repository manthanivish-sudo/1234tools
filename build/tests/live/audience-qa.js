/* Audience Q&A: the queue, upvotes and board order against independent
   checks, then a real session. Run by build/tests/live-rooms.js. */
'use strict';

const ask = (ph, text) => ph.page.evaluate((text) => {
  const ta = document.querySelector('#card textarea');
  const b = Array.from(document.querySelectorAll('#card button')).find((x) => /Send question/.test(x.textContent));
  if (!ta || !b || ta.disabled) return false;
  ta.value = text; b.click(); return true;
}, text);
const upvote = (ph, needle) => ph.page.evaluate((needle) => {
  const li = Array.from(document.querySelectorAll('#card ul.list li')).find((x) => x.textContent.indexOf(needle) >= 0);
  const b = li && li.querySelector('button.up');
  if (!b || b.hidden || b.disabled) return false;
  b.click(); return true;
}, needle);
const hostAct = (page, needle, label) => page.evaluate((needle, label) => {
  const li = Array.from(document.querySelectorAll('.live-qa li')).find((x) => x.querySelector('.live-qa-text span').textContent.indexOf(needle) >= 0);
  const b = li && Array.from(li.querySelectorAll('button')).find((x) => x.textContent.trim() === label);
  if (b) b.click();
  return !!b;
}, needle, label);
const board = (page) => page.evaluate(() => {
  const lists = document.querySelectorAll('.live-qa');
  return Array.from(lists[1].querySelectorAll('li')).map((li) => li.querySelector('.live-qa-text span').textContent + ' | ' + li.querySelector('.live-qa-text small').textContent);
});
const waiting = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.live-qa')[0].querySelectorAll('li')).map((li) => li.querySelector('.live-qa-text span').textContent));

module.exports = {
  async maths(page, h) {
    const { ok } = h;
    const r = await page.evaluate(() => {
      const M = window.ROOM_TOOLS['audience-qa'].maths;
      const st = M.fresh();
      const ap = { l: 280, ap: 1, up: 1 }, open = { l: 280, up: 1 };
      const q1 = M.addQuestion(st, 'a', 'Ann', '  Why   so   late? ', ap, 1);
      const q2 = M.addQuestion(st, 'b', 'Bo', 'x'.repeat(400), open, 2);
      const empty = M.addQuestion(st, 'a', 'Ann', '   ', ap, 3);
      const closed = M.addQuestion(st, 'a', 'Ann', 'hi', Object.assign({ cl: 1 }, ap), 4);
      const many = [];
      for (let i = 0; i < 11; i++) many.push(!!M.addQuestion(st, 'c', 'Cy', 'q' + i, open, 10 + i));
      const ups = [M.upvote(st, 'x', q1.qid, 1, ap), M.upvote(st, 'x', q2.qid, 1, ap), M.upvote(st, 'x', q2.qid, 1, ap), M.upvote(st, 'y', q2.qid, 1, ap),
        M.upvote(st, 'x', q2.qid, 0, ap), M.upvote(st, 'x', q2.qid, 0, ap), M.upvote(st, 'z', q2.qid, 1, { l: 280 })];
      const votes = q2.votes.size;
      q2.a = 1;
      const afterAnswer = M.upvote(st, 'q', q2.qid, 1, ap);
      /* board order */
      const qs = [{ qid: '1', a: 0, votes: new Set([1]) }, { qid: '2', a: 1, votes: new Set([1, 2, 3]) }, { qid: '3', a: 0, votes: new Set([1, 2]) }, { qid: '4', a: 0, votes: new Set([1, 2]) }, { qid: '5', a: 0, votes: new Set() }];
      return { q1: [q1.t, q1.status], q2: [q2.t.length, q2.status], empty, closed, many, ups, votes, afterAnswer, order: M.order(qs).map((q) => q.qid) };
    });
    ok(r.q1[0] === 'Why so late?' && r.q1[1] === 'wait', 'audience-qa maths: with approval on a question waits, spaces tidied');
    ok(r.q2[0] === 280 && r.q2[1] === 'live', 'audience-qa maths: with approval off it goes live; cut at 280 characters');
    ok(r.empty === null && r.closed === null, 'audience-qa maths: empty and closed refused');
    ok(r.many.filter(Boolean).length === 10 && r.many[10] === false, 'audience-qa maths: 10 questions a phone');
    ok(JSON.stringify(r.ups) === JSON.stringify([false, true, false, true, true, false, false]) && r.votes === 1, 'audience-qa maths: one upvote per phone, taken back once, none on waiting questions or with upvotes off', JSON.stringify(r.ups));
    ok(r.afterAnswer === false, 'audience-qa maths: no upvotes on an answered question');
    ok(r.order.join() === '3,4,1,5,2', 'audience-qa maths: board order is unanswered, most votes, oldest', r.order.join());
  },

  async flow(h) {
    const { ok, waitFor, sleep, phones } = h;
    const N = phones.length;
    const { page: host, code } = await h.startHost('audience-qa', async (p) => {
      await p.evaluate(() => {
        const io = document.querySelector('[data-tool="audience-qa"] .tool-io');
        const q = io.querySelector('input[type="text"]');
        q.value = 'Questions for the panel'; q.dispatchEvent(new Event('change', { bubbles: true }));
        io.querySelectorAll('label.game-check').forEach((l) => { const c = l.querySelector('input'); if (!c.checked) c.click(); });
      });
    });
    if (!code) return;
    ok(await host.evaluate(() => { const b = Array.from(document.querySelectorAll('[data-tool] .tool-io button')).find((x) => /^Open questions/.test(x.textContent.trim())); if (b) b.click(); return !!b; }), 'audience-qa: Open questions');
    ok((await h.joinAll(code)) === N, 'audience-qa: ' + N + ' phones join');
    ok(await waitFor(() => Promise.all(phones.map((ph) => ph.page.evaluate(() => !!document.querySelector('#card textarea')))).then((a) => a.every(Boolean)), 8000), 'audience-qa: every phone shows the question box');
    await h.clearFrames(phones);

    ok(await ask(phones[0], 'Secret zebra question?'), 'audience-qa: a phone sends a question');
    await ask(phones[1], 'what the fuck is this plan');
    await ask(phones[3], 'Hide me please');
    ok(await waitFor(async () => (await waiting(host)).length === 3, 8000), 'audience-qa: three questions wait for approval', JSON.stringify(await waiting(host)));
    ok((await waiting(host)).some((t) => /what the f\*+ is this plan/.test(t)), 'audience-qa: the rude word is masked on the host page too');
    await sleep(600);
    let early = 0;
    for (const ph of phones) for (const f of await h.frames(ph)) if (/zebra|fuck|Hide me/i.test(JSON.stringify(f))) early++;
    ok(early === 0, 'audience-qa: a waiting question reaches no phone', String(early));

    ok(await hostAct(host, 'zebra', 'Approve'), 'audience-qa: Approve');
    ok(await hostAct(host, 'what the', 'Approve'), 'audience-qa: Approve the second');
    ok(await hostAct(host, 'Hide me', 'Hide'), 'audience-qa: Hide');
    const seen = await waitFor(() => Promise.all(phones.map((ph) => ph.page.evaluate(() => document.querySelectorAll('#card ul.list li').length === 2))).then((a) => a.every(Boolean)), 8000);
    ok(!!seen, 'audience-qa: approved questions reach every phone');
    let raw = 0, hidden = 0;
    for (const ph of phones) for (const f of await h.frames(ph)) { const s = JSON.stringify(f); if (/fuck/i.test(s)) raw++; if (/Hide me/.test(s)) hidden++; }
    ok(raw === 0, 'audience-qa: phones receive the masked text, never the rude word', String(raw));
    ok(hidden === 0, 'audience-qa: a hidden question never reaches a phone', String(hidden));

    /* upvotes: 20 phones on the zebra question, 5 on and 2 off on the other */
    const z = await Promise.all(phones.slice(2, 22).map((ph) => upvote(ph, 'zebra')));
    ok(z.every(Boolean), 'audience-qa: 20 phones upvote');
    for (const ph of phones.slice(2, 7)) await upvote(ph, 'what the');
    for (const ph of phones.slice(2, 4)) await upvote(ph, 'what the');
    const b1 = await waitFor(async () => { const b = await board(host); return b.length === 2 && /zebra/.test(b[0]) && /▲ 20/.test(b[0]) && /▲ 3\b/.test(b[1]) ? b : null; }, 8000);
    ok(!!b1, 'audience-qa: the host counts 20 and 3 upvotes, most upvoted first', JSON.stringify(await board(host)));
    const pv = await waitFor(() => phones[25].page.evaluate(() => { const li = Array.from(document.querySelectorAll('#card ul.list li')).find((x) => /zebra/.test(x.textContent)); return li && /20/.test(li.querySelector('button.up').textContent); }), 5000);
    ok(!!pv, 'audience-qa: phones see the vote count');

    /* reconnect: the upvote stays single */
    const before = await h.socketCount(phones[2]);
    await h.dropSocket(phones[2]);
    ok(await waitFor(async () => (await h.socketCount(phones[2])) > before && h.connected(phones[2]), 15000, 200), 'audience-qa: a dropped phone reconnects');
    ok(await waitFor(() => phones[2].page.evaluate(() => { const li = Array.from(document.querySelectorAll('#card ul.list li')).find((x) => /zebra/.test(x.textContent)); return li && li.querySelector('button.up').getAttribute('aria-pressed') === 'true'; }), 5000), 'audience-qa: after reconnecting the phone still shows its upvote');
    await upvote(phones[2], 'zebra');
    ok(await waitFor(async () => /▲ 19/.test((await board(host))[0] || ''), 5000), 'audience-qa: pressing again takes the one upvote back (19)');
    await upvote(phones[2], 'zebra');
    ok(await waitFor(async () => /▲ 20/.test((await board(host))[0] || ''), 5000), 'audience-qa: and once more gives it back (20, never 21)');

    /* the big screen: the board, nicknames, spotlight, answered */
    const stage = await h.open('/live/audience-qa/?stage=1');
    const st = await waitFor(() => stage.evaluate(() => { const li = document.querySelectorAll('.st-qa li'); return li.length === 2 ? Array.from(li).map((x) => x.textContent) : null; }), 8000);
    ok(st && /zebra/.test(st[0]) && /Phone 1\b/.test(st[0]) && /f\*+/.test(st[1]) && !/fuck/.test(st.join()), 'audience-qa: the big screen shows the board with nicknames, masked', JSON.stringify(st));
    ok(await hostAct(host, 'what the', 'Spotlight'), 'audience-qa: Spotlight');
    ok(await waitFor(() => stage.evaluate(() => { const q = document.querySelector('.st-spot-q'); return q && /what the f\*+ is this plan/.test(q.textContent); }), 5000), 'audience-qa: the spotlight shows one question big');
    ok(await hostAct(host, 'what the', 'Back to the board'), 'audience-qa: back to the board');
    ok(await hostAct(host, 'zebra', 'Answered'), 'audience-qa: mark answered');
    ok(await waitFor(async () => /zebra/.test((await board(host))[1] || ''), 5000), 'audience-qa: an answered question moves to the bottom');
    ok(await waitFor(() => phones[10].page.evaluate(() => { const li = Array.from(document.querySelectorAll('#card ul.list li')).find((x) => /zebra/.test(x.textContent)); return li && /Answered/.test(li.textContent) && li.querySelector('button.up').disabled; }), 5000), 'audience-qa: phones see it answered and cannot upvote it');
    await host.evaluate(() => { const l = Array.from(document.querySelectorAll('label.game-check')).find((x) => /nicknames/.test(x.textContent)); l.querySelector('input').click(); });
    ok(await waitFor(() => stage.evaluate(() => document.querySelectorAll('.st-qa li').length === 2 && !document.querySelector('.st-qa small')), 5000), 'audience-qa: nicknames can be hidden on the big screen');

    await h.endSession(host, 'audience-qa', phones);
    await stage.close();
    await host.close();
    await sleep(200);
  }
};
