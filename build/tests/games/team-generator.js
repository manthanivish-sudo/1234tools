/* The Team Generator's own rules, for build/tests/games.js. */
'use strict';
module.exports = {
  check: async function (page, h) {
    const r = await page.evaluate(() => {
      const M = window.GAME_TOOLS['team-generator'].maths;
      const K = window.GameKit;
      const out = {};
      out.parse = [M.parsePlayer('Asha, 4'), M.parsePlayer('Ravi 3.5'), M.parsePlayer('Grandad'), M.parsePlayer('Team 7, 2')];
      out.k = [M.teamCount(14, { mode: 'count', count: 4 }), M.teamCount(30, { mode: 'size', size: 4 }), M.teamCount(3, { mode: 'count', count: 9 })];
      const names = Array.from({ length: 14 }, (_, i) => ({ name: 'P' + i, skill: null }));
      const r1 = M.makeTeams(names, { mode: 'count', count: 4 }, [], K.randInt);
      out.sizes = r1.teams.map((t) => t.length).sort();
      /* balanced: skills 10..1 into 2 teams by snake → totals 28 and 27 */
      const sk = Array.from({ length: 10 }, (_, i) => ({ name: 'S' + i, skill: 10 - i }));
      const r2 = M.makeTeams(sk, { mode: 'count', count: 2, balanced: true }, [], K.randInt);
      out.totals = r2.teams.map((t) => t.reduce((s, p) => s + p.skill, 0)).sort();
      /* keep apart: 3 siblings in 3 teams, 200 times */
      let apartFails = 0;
      for (let i = 0; i < 200; i++) {
        const r = M.makeTeams(names, { mode: 'count', count: 3 }, [['P0', 'P1', 'P2']], K.randInt);
        const where = r.teams.map((t) => t.map((p) => p.name));
        const ts = ['P0', 'P1', 'P2'].map((n) => where.findIndex((t) => t.includes(n)));
        if (new Set(ts).size !== 3 || r.failed) apartFails++;
      }
      out.apartFails = apartFails;
      const imp = M.makeTeams(names, { mode: 'count', count: 2 }, [['P0', 'P1', 'P2']], K.randInt);
      out.impossible = imp.failed;
      /* fairness: which of 6 names lands in team 1 of 2, 30 000 splits */
      const six = Array.from({ length: 6 }, (_, i) => ({ name: 'F' + i, skill: null }));
      const hits = [0, 0, 0, 0, 0, 0];
      for (let i = 0; i < 30000; i++) M.dealRandom(six, 2, K.randInt)[0].forEach((p) => hits[Number(p.name.slice(1))]++);
      out.hits = hits;
      return out;
    });
    h.ok(r.parse[0].name === 'Asha' && r.parse[0].skill === 4, 'team: "Asha, 4" parses');
    h.ok(r.parse[1].name === 'Ravi' && r.parse[1].skill === 3.5, 'team: "Ravi 3.5" parses');
    h.ok(r.parse[2].name === 'Grandad' && r.parse[2].skill === null, 'team: a bare name has no skill');
    h.ok(r.parse[3].name === 'Team 7' && r.parse[3].skill === 2, 'team: "Team 7, 2" keeps the 7 in the name');
    h.ok(r.k.join() === '4,8,3', 'team: team counts (14/4 teams, 30 in fours, 3 names 9 teams)', r.k.join());
    h.ok(r.sizes.join() === '3,3,4,4', 'team: 14 into 4 gives 4,4,3,3', r.sizes.join());
    h.ok(r.totals.join() === '27,28', 'team: snake deal of 10..1 gives totals 27 and 28', r.totals.join());
    h.ok(r.apartFails === 0, 'team: keep-apart held in 200 splits', String(r.apartFails));
    h.ok(Array.isArray(r.impossible) && r.impossible.length === 3, 'team: three apart in two teams is reported impossible');
    const chi = h.chiSquare(r.hits);
    h.ok(chi < h.CHI_001[5], 'team: every name equally likely in team 1 (chi² ' + chi.toFixed(1) + ')');

    /* the page itself: type names, make teams, the stage follows */
    await page.click('[data-tool="team-generator"] textarea');
    await page.keyboard.type('Asha\nRavi\nMeera\nGrandad\nNani\nKabir\nZoya');
    const make = await page.$$('[data-tool="team-generator"] button');
    for (const b of make) { if ((await b.evaluate((x) => x.textContent)) === 'Make teams') { await b.click(); break; } }
    await h.sleep(150);
    const shown = await page.evaluate(() => Array.from(document.querySelectorAll('.game-team li')).map((l) => l.textContent).sort().join());
    h.ok(shown === 'Asha,Grandad,Kabir,Meera,Nani,Ravi,Zoya', 'team: every name shown once in the teams', shown);
    const stage = await h.openStage('team-generator');
    await h.sleep(300);
    const onStage = await stage.evaluate(() => Array.from(document.querySelectorAll('.st-team li')).map((l) => l.textContent).sort().join());
    h.ok(onStage === shown, 'team: the TV window shows the same teams', onStage);
    await stage.close();
  },
  /* each landing page opens with its preset applied */
  landings: {
    'random-group-generator-for-class': async function (page, h) {
      const r = await page.evaluate(() => ({ label: Array.from(document.querySelectorAll('.game-field-label')).map((l) => l.textContent).join('|'), num: document.querySelector('[data-tool] input[type=number]').value }));
      h.ok(/People per team/.test(r.label) && r.num === '4', 'team landing: class groups open in fours', r.label + ' ' + r.num);
    },
    'random-team-picker-for-quiz-night': async function (page, h) {
      const r = await page.evaluate(() => ({ num: document.querySelector('[data-tool] input[type=number]').value, names: document.querySelector('[data-tool] input[type=text]').value }));
      h.ok(r.num === '4' && r.names.split(',').length === 4, 'team landing: quiz night opens with four teams and fun names', r.num + ' ' + r.names);
    }
  }
};
