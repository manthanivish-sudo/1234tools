/**
 * Random team generator, worked out on the device.
 *
 * A list of names goes in; fair teams come out, shown on the page and on the
 * TV (engine/game-kit.js's stage). Three ways to split:
 *   - random: a fair shuffle (crypto, rejection-sampled), dealt round the
 *     teams so sizes differ by one at most;
 *   - balanced: a name may carry a skill ("Asha, 4" or "Asha 4"); players are
 *     sorted by skill (ties broken at random) and dealt in a snake — 1, 2, 3,
 *     3, 2, 1 — so the strongest are spread and the totals stay close;
 *   - keep apart: lines like "Asha / Ravi" name people who must not share a
 *     team (siblings, couples); the split is re-dealt until every pair is
 *     apart, and when that cannot be done the page says which pair failed.
 *
 * Nothing is uploaded. The list is kept on this device only when the visitor
 * ticks "Keep this list on this device".
 */
(function () {
  'use strict';
  window.GAME_TOOLS = window.GAME_TOOLS || {};
  window.GAME_TOOLS['team-generator'] = {
    order: 2,
    title: 'Random Team Generator',
    short: 'Team Generator',
    description: 'Split a list of names into fair random teams in one click — random, balanced by skill, or with brothers and sisters kept apart — and show the teams big on the TV. Free, no sign-up, runs in your browser.',
    keywords: ['random team generator', 'team picker', 'split names into teams', 'random group generator', 'make teams for quiz', 'balanced team generator', 'team generator for kids', 'divide class into groups', 'pick teams', 'team maker'],
    glyph: 'i-team-generator',
    glyphSvg: '<symbol id="i-team-generator" viewBox="0 0 24 24">\n  <circle cx="7" cy="7.5" r="2.6"/>\n  <circle cx="17" cy="7.5" r="2.6"/>\n  <path d="M2.8 18.5c.4-3.2 2-5 4.2-5s3.8 1.8 4.2 5"/>\n  <path d="M12.8 18.5c.4-3.2 2-5 4.2-5s3.8 1.8 4.2 5"/>\n  <path d="M12 3v18" class="thin"/>\n</symbol>',
    scripts: ['/engine/game-kit.js', '/engine/game-team-generator.js'],
    privacy: 'The names you type stay on this device. The teams are worked out by your own browser and shown on your own screens; nothing is uploaded, and the list is saved only if you tick “Keep this list on this device”.',
    how: [
      'Type or paste the names, one per line. Add a skill after a comma (“Asha, 4”) if you want balanced teams.',
      'Choose how many teams, or how many people in each team.',
      'Pick Random, Balanced by skill, or add “Asha / Ravi” lines to keep people apart.',
      'Press Make teams. Show them on the TV, reveal them one at a time, or copy them into the family group chat.'
    ],
    uses: [
      ['Quiz night', 'four mixed teams from a family of fifteen, with the cousins split up'],
      ['Classroom', 'groups of four for a project, re-dealt in a second if someone is absent'],
      ['Sports', 'two even sides from a list of players marked 1 to 5']
    ],
    tips: [
      'Sizes never differ by more than one: 14 names in 4 teams gives two teams of 4 and two of 3.',
      'For balanced teams give everyone a number on the same scale, 1 to 5 or 1 to 10. Anyone without a number counts as the average, so a half-marked list still works.',
      'Keep-apart lines take two or more names: “Asha / Ravi / Meera” keeps all three in different teams. Names must match the list exactly; the page warns about any it cannot find.',
      'Press Make teams again for a different split — every press is a fresh fair shuffle. The previous split is not reused or remembered.',
      'Reveal one by one turns the TV into a little ceremony: each press of Space or the button shows the next team.',
      'Team names are editable; leave them blank for Team 1, Team 2, or press Fun names for a set kids like.'
    ],
    faq: [
      { q: 'Is the split really random?', a: 'Yes. The shuffle uses your browser’s cryptographic random number generator with rejection sampling, so every arrangement is equally likely. It does not favour the names at the top of the list.' },
      { q: 'How does “balanced by skill” work?', a: 'Players are sorted by the number after their name (ties broken at random) and dealt in a snake: first pick to team 1, then 2, 3, back 3, 2, 1 and so on. The page shows each team’s total so you can see how close they are.' },
      { q: 'Can I keep brothers and sisters apart?', a: 'Yes. Add a line such as “Asha / Ravi” to the Keep apart box. The split is re-dealt until every such group is in different teams; if that is impossible (three names that must be apart but only two teams) the page tells you which line cannot be met.' },
      { q: 'How do I show the teams on the TV?', a: 'Press Show on TV to open the big-screen view in a new window, drag it to the TV or projector (or cast that browser tab) and press Full screen there. This page stays your remote. With only one screen, press Full screen here.' },
      { q: 'Are the names saved or sent anywhere?', a: 'They are never sent anywhere. They are saved on this device only if you tick “Keep this list on this device”, and unticking it deletes them.' },
      { q: 'Does it work on a phone and offline?', a: 'Yes. It works on phones, tablets and computers, and after the first visit it opens without a connection, so a party with no signal still gets its teams. You can also install it as an app from your browser’s menu.' },
      { q: 'How many names can it take?', a: 'Up to 500 names and 50 teams, which covers a school year group. Each name can be up to 60 characters.' }
    ],
    related: ['/utilities/random-number-generator/', '/utilities/dice-roller/', '/education/exam-seating/'],
    landings: [
      {
        slug: 'random-group-generator-for-class',
        title: 'Random Group Generator for the Classroom',
        description: 'Split a class list into random groups of 3, 4 or 5 for a project or a quiz, keep chatty friends apart and show the groups on the board. Free, nothing uploaded.',
        lede: 'Paste the class register, choose the group size and the groups appear on the board — each press a fresh fair shuffle, friends kept apart if you list them.',
        preset: { mode: 'size', size: 4, fun: false },
        about: [
          'Groups of four are set by default; change the number for pairs, threes or fives. The sizes never differ by more than one, so a class of 30 in fours gives six groups of four and two of three.',
          'List pairs who should not work together in Keep apart (“Asha / Ravi”), and press Reveal one by one to show each group on the board in turn.'
        ],
        faq: [
          { q: 'Do pupils’ names leave the classroom computer?', a: 'No. The list is read and split by the browser on that computer and is not uploaded. It is saved on the computer only if you tick the box to keep it.' },
          { q: 'Can I make groups of a set size rather than a set number?', a: 'Yes. This page starts in “people per group” mode; switch to “number of teams” when you want, say, exactly six groups.' }
        ]
      },
      {
        slug: 'random-team-picker-for-quiz-night',
        title: 'Team Picker for a Family Quiz Night',
        description: 'Make fair quiz teams from the whole family in a click, keep couples and siblings apart, give the teams fun names and show them on the TV. Free, no sign-up.',
        lede: 'Type everyone’s name, choose four teams, and the quiz is ready — cousins split up, fun team names, and the line-up on the TV.',
        preset: { mode: 'count', count: 4, fun: true },
        about: [
          'Four teams with fun names are set by default. Add “Mum / Dad” to Keep apart so the parents are not on the same side, and mark the quiz experts with a number for balanced teams.',
          'Keep score on the Scoreboard and use the Buzzer for the quick-fire round — both open in the same way on the TV.'
        ],
        faq: [
          { q: 'How many teams should a family quiz have?', a: 'Three or four teams of three to five people keeps everyone involved. Fewer, larger teams let the quiet ones hide; more, smaller ones mean long waits between turns.' },
          { q: 'Can the children be spread evenly?', a: 'Yes. Give the children a lower number (say 1) and the adults a higher one (say 3) and choose Balanced: the snake deal spreads them so each team gets a mix.' }
        ]
      }
    ]
  };

  if (typeof document === 'undefined') return;
  const K = window.GameKit;
  const SLUG = 'team-generator';
  const MAX_NAMES = 500, MAX_TEAMS = 50;
  const FUN = ['Tigers', 'Rockets', 'Mangoes', 'Thunder', 'Comets', 'Pandas', 'Lightning', 'Dragons', 'Owls', 'Volcanoes', 'Sharks', 'Phoenix'];

  /* ---------- the maths (pure; build/tests/games.js checks it) ---------- */

  /** "Asha, 4" / "Asha 4" / "Asha" → { name, skill|null } */
  function parsePlayer(line) {
    const m = /^(.*?)[\s,]+(\d+(?:\.\d+)?)$/.exec(line);
    if (m && m[1].trim()) return { name: m[1].trim(), skill: Number(m[2]) };
    return { name: line.trim(), skill: null };
  }
  function teamCount(n, opt) {
    const c = opt.mode === 'size' ? Math.ceil(n / Math.max(1, opt.size | 0)) : (opt.count | 0);
    return Math.max(1, Math.min(MAX_TEAMS, c, n));
  }
  function dealRandom(players, k, rand) {
    const teams = Array.from({ length: k }, () => []);
    K.shuffle(players, rand).forEach((p, i) => teams[i % k].push(p));
    return teams;
  }
  function dealBalanced(players, k, rand) {
    const known = players.filter((p) => p.skill !== null);
    const avg = known.length ? known.reduce((s, p) => s + p.skill, 0) / known.length : 0;
    const scored = K.shuffle(players, rand).map((p) => ({ p, s: p.skill === null ? avg : p.skill }));
    scored.sort((a, b) => b.s - a.s); /* stable: the shuffle breaks ties */
    const teams = Array.from({ length: k }, () => []);
    scored.forEach((x, i) => {
      const round = Math.floor(i / k), pos = i % k;
      teams[round % 2 === 0 ? pos : k - 1 - pos].push(x.p);
    });
    return teams;
  }
  function apartOk(teams, groups) {
    const where = new Map();
    teams.forEach((t, i) => t.forEach((p) => where.set(p.name.toLowerCase(), i)));
    for (const g of groups) {
      const seen = new Set();
      for (const n of g) {
        const t = where.get(n.toLowerCase());
        if (t === undefined) continue;
        if (seen.has(t)) return g;
        seen.add(t);
      }
    }
    return null;
  }
  /**
   * The whole split. rand is a fair int(n) function (crypto on the page, a
   * seeded one in the tests). Returns { teams, failed, tries }.
   */
  function makeTeams(players, opt, groups, rand) {
    const k = teamCount(players.length, opt);
    const deal = opt.balanced ? dealBalanced : dealRandom;
    const wanted = (groups || []).filter((g) => g.length > 1);
    let teams = deal(players, k, rand), failed = apartOk(teams, wanted), tries = 1;
    /* balanced deals are re-run with fresh tie-breaks; random ones freshly shuffled */
    while (failed && tries < 400) { teams = deal(players, k, rand); failed = apartOk(teams, wanted); tries++; }
    if (failed && wanted.some((g) => g.length > k)) failed = wanted.find((g) => g.length > k);
    return { teams, failed, tries };
  }
  window.GAME_TOOLS[SLUG].maths = { parsePlayer, teamCount, dealRandom, dealBalanced, apartOk, makeTeams };

  /* ---------- the big screen ---------- */

  function renderStage(body, s) {
    body.textContent = '';
    if (!s.teams || !s.teams.length) {
      body.appendChild(K.el('p', 'game-stage-wait', 'The teams will appear here.'));
      return;
    }
    body.appendChild(K.el('h1', 'st-title', s.title || 'The teams'));
    const grid = K.el('div', 'st-teams');
    const k = s.teams.length;
    const wide = body.clientWidth / Math.max(1, body.clientHeight) > 1.2;
    const cols = Math.min(k, wide ? (k <= 4 ? k : Math.ceil(Math.sqrt(k * 1.6))) : (k <= 2 ? 1 : 2));
    const rows = Math.ceil(k / cols);
    const most = Math.max.apply(null, s.teams.map((t) => t.members.length));
    const mcols = most > 8 && rows === 1 ? 2 : 1;
    const linesPerCard = Math.ceil(most / mcols) + 1.6;
    const fs = Math.max(1.4, Math.min(6, 78 / rows / linesPerCard / 1.3, 300 / cols / 14));
    grid.style.setProperty('--cols', cols);
    grid.style.setProperty('--fs', fs.toFixed(2) + 'vmin');
    grid.style.setProperty('--mcols', mcols);
    s.teams.forEach((t, i) => {
      const card = K.el('section', 'st-team' + (i >= s.shown ? ' is-hidden' : '') + (i === s.shown - 1 && s.reveal ? ' is-new' : ''));
      card.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
      card.appendChild(K.el('h2', null, t.name));
      const ul = K.el('ul');
      t.members.forEach((m) => ul.appendChild(K.el('li', null, m)));
      card.appendChild(ul);
      grid.appendChild(card);
    });
    body.appendChild(grid);
  }

  /* ---------- the page ---------- */

  function mount(root, stage) {
    const io = root.querySelector('.tool-io');
    const store = K.store(SLUG, 1);
    const preset = K.preset(root);
    const saved = store.get({});
    const opt = Object.assign({ mode: 'count', count: 2, size: 4, balanced: false, fun: false, keep: false }, saved.opt || {}, preset);
    let result = null, shown = 0, reveal = false, names = [];

    const cols = K.el('div', 'game-cols');
    const left = K.el('section', 'game-panel');
    left.appendChild(K.el('h2', null, 'Who is playing?'));
    const list = K.el('textarea');
    list.setAttribute('aria-describedby', SLUG + '-hint');
    list.placeholder = 'Asha\nRavi\nMeera, 4\nGrandad, 2';
    list.spellcheck = false;
    list.value = saved.keep && saved.list ? saved.list : '';
    const lf = K.field('Names, one per line', list, 'Add “, 4” after a name for its skill (optional).');
    lf.wrap.querySelector('.game-field-hint').id = SLUG + '-hint';
    left.appendChild(lf.wrap);
    const count = K.el('p', 'game-msg');
    left.appendChild(count);

    const how = K.el('div', 'game-seg');
    how.setAttribute('role', 'group');
    how.setAttribute('aria-label', 'Split by');
    const bCount = K.button('Number of teams', null, () => setMode('count'));
    const bSize = K.button('People per team', null, () => setMode('size'));
    how.appendChild(bCount); how.appendChild(bSize);
    left.appendChild(K.field('Split by', how).wrap);
    const num = K.el('input');
    num.type = 'number'; num.min = '1'; num.max = String(MAX_TEAMS); num.inputMode = 'numeric';
    num.value = String(opt.mode === 'size' ? opt.size : opt.count);
    const nf = K.field('Teams', num);
    left.appendChild(nf.wrap);

    const bal = K.el('input'); bal.type = 'checkbox'; bal.checked = !!opt.balanced;
    const balL = K.el('label', 'game-check'); balL.appendChild(bal); balL.appendChild(document.createTextNode('Balance by skill (the numbers after names)'));
    left.appendChild(balL);

    const apart = K.el('textarea');
    apart.style.minHeight = '80px';
    apart.placeholder = 'Asha / Ravi';
    apart.value = saved.keep && saved.apart ? saved.apart : '';
    left.appendChild(K.field('Keep apart (optional)', apart, 'One group per line, names split by “/”.').wrap);

    const names_ = K.el('input'); names_.type = 'text';
    names_.placeholder = 'Team names, split by commas (optional)';
    names_.value = saved.teamNames || '';
    const tn = K.field('Team names', names_);
    const funB = K.button('Fun names', 'btn-ghost', () => { names_.value = K.shuffle(FUN).slice(0, Math.max(2, currentK())).join(', '); persist(); });
    tn.wrap.appendChild(funB);
    left.appendChild(tn.wrap);

    const keep = K.el('input'); keep.type = 'checkbox'; keep.checked = !!saved.keep;
    const keepL = K.el('label', 'game-check'); keepL.appendChild(keep); keepL.appendChild(document.createTextNode('Keep this list on this device'));
    left.appendChild(keepL);

    const go = K.button('Make teams', 'btn-primary game-big', make);
    const actions = K.el('div', 'game-row');
    actions.appendChild(go);
    left.appendChild(actions);

    const right = K.el('section', 'game-panel');
    right.appendChild(K.el('h2', null, 'Teams'));
    const msg = K.el('p', 'game-msg', 'Add names and press Make teams.');
    msg.setAttribute('role', 'status');
    right.appendChild(msg);
    const out = K.el('div', 'game-teams');
    right.appendChild(out);
    const after = K.el('div', 'game-row');
    const again = K.button('Shuffle again', 'btn-ghost', make);
    const revealB = K.button('Reveal one by one', 'btn-ghost', startReveal);
    const nextB = K.button('Next team  (Space)', 'btn-primary', next);
    const copyB = K.button('Copy teams', 'btn-copy', () => {
      if (!result) return;
      K.copy(result.teams.map((t) => t.name + ': ' + t.members.join(', ')).join('\n')).then(() => { copyB.textContent = 'Copied'; copyB.classList.add('ok'); setTimeout(() => { copyB.textContent = 'Copy teams'; copyB.classList.remove('ok'); }, 1600); });
    });
    [again, revealB, nextB, copyB].forEach((b) => after.appendChild(b));
    after.hidden = true;
    right.appendChild(after);
    right.appendChild(stage.bar());

    cols.appendChild(left); cols.appendChild(right);
    io.appendChild(cols);

    function currentK() { return teamCount(Math.max(1, names.length), readOpt()); }
    function readOpt() {
      const v = Math.max(1, Math.min(MAX_TEAMS, parseInt(num.value, 10) || 1));
      return { mode: opt.mode, count: opt.mode === 'count' ? v : opt.count, size: opt.mode === 'size' ? v : opt.size, balanced: bal.checked };
    }
    function setMode(m) {
      const cur = readOpt();
      opt.count = cur.count; opt.size = cur.size;
      opt.mode = m;
      bCount.setAttribute('aria-pressed', String(m === 'count'));
      bSize.setAttribute('aria-pressed', String(m === 'size'));
      nf.wrap.querySelector('.game-field-label').textContent = m === 'count' ? 'Teams' : 'People per team';
      num.value = String(m === 'count' ? opt.count : opt.size);
      refresh();
      persist();
    }
    function refresh() {
      names = K.parseList(list.value, { lines: true, max: MAX_NAMES });
      const k = currentK();
      count.textContent = names.length
        ? names.length + (names.length === 1 ? ' name' : ' names') + ' → ' + k + (k === 1 ? ' team' : ' teams')
        : '';
    }
    function persist() {
      const o = readOpt();
      opt.balanced = o.balanced; opt.count = o.count; opt.size = o.size;
      const data = { opt: { mode: opt.mode, count: opt.count, size: opt.size, balanced: opt.balanced }, teamNames: names_.value, keep: keep.checked };
      if (keep.checked) { data.list = list.value.slice(0, 40000); data.apart = apart.value.slice(0, 4000); }
      store.set(data);
    }
    function teamNames(k) {
      const typed = K.parseList(names_.value, { maxLen: 30 });
      return Array.from({ length: k }, (_, i) => typed[i] || ('Team ' + (i + 1)));
    }
    function publish() {
      stage.update({
        title: 'The teams',
        teams: result ? result.teams.map((t) => ({ name: t.name, members: t.members })) : [],
        shown: shown,
        reveal: reveal
      });
    }
    function make() {
      K.sound.unlock();
      refresh();
      if (names.length < 2) { msg.textContent = 'Add at least two names.'; msg.className = 'game-msg is-warn'; return; }
      const players = names.map(parsePlayer);
      const groups = K.parseList(apart.value, { lines: true }).map((l) => l.split('/').map((s) => s.trim()).filter(Boolean));
      const known = new Set(players.map((p) => p.name.toLowerCase()));
      const unknown = [].concat.apply([], groups).filter((n) => !known.has(n.toLowerCase()));
      const o = readOpt();
      const r = makeTeams(players, o, groups, K.randInt);
      const tnames = teamNames(r.teams.length);
      result = { teams: r.teams.map((t, i) => ({ name: tnames[i], members: t.map((p) => p.name), total: t.reduce((s, p) => s + (p.skill || 0), 0) })) };
      shown = r.teams.length; reveal = false;
      draw();
      const notes = [];
      if (r.failed) notes.push('Could not keep ' + r.failed.join(' / ') + ' apart with ' + r.teams.length + ' teams.');
      if (unknown.length) notes.push('Not in the list: ' + unknown.slice(0, 5).join(', ') + (unknown.length > 5 ? '…' : '') + '.');
      msg.textContent = notes.length ? notes.join(' ') : r.teams.length + ' teams made from ' + players.length + ' names.';
      msg.className = 'game-msg' + (notes.length ? ' is-warn' : '');
      K.announce(root, msg.textContent);
      after.hidden = false;
      nextB.hidden = true;
      K.sound.ding();
      persist();
      publish();
    }
    function draw() {
      out.textContent = '';
      if (!result) return;
      const showTotals = bal.checked;
      result.teams.forEach((t, i) => {
        const card = K.el('section', 'game-team');
        card.style.setProperty('--tc', 'var(--t' + ((i % 8) + 1) + ')');
        const h = K.el('h3', null, t.name);
        h.appendChild(K.el('small', null, t.members.length + (showTotals ? ' · skill ' + Math.round(t.total * 10) / 10 : '')));
        card.appendChild(h);
        const ol = K.el('ol');
        t.members.forEach((m) => ol.appendChild(K.el('li', null, m)));
        card.appendChild(ol);
        out.appendChild(card);
      });
    }
    function startReveal() {
      if (!result) return;
      shown = 0; reveal = true; nextB.hidden = false;
      msg.textContent = 'Press Next team (or Space) to show each team on the big screen.';
      msg.className = 'game-msg';
      publish();
    }
    function next() {
      if (!result || shown >= result.teams.length) return;
      shown++;
      K.sound.fanfare();
      if (shown >= result.teams.length) nextB.hidden = true;
      publish();
    }
    stage.onKey = function (key) { if ((key === ' ' || key === 'ArrowRight') && reveal) next(); };
    document.addEventListener('keydown', (e) => {
      if (e.key !== ' ' || !reveal || nextB.hidden) return;
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'BUTTON')) return;
      e.preventDefault(); next();
    });

    list.addEventListener('input', () => { refresh(); if (keep.checked) persist(); });
    num.addEventListener('input', () => { refresh(); persist(); });
    [bal, apart, names_].forEach((x) => x.addEventListener('change', persist));
    keep.addEventListener('change', () => { if (!keep.checked) { const s = store.get({}); delete s.list; delete s.apart; s.keep = false; store.set(s); } persist(); });
    setMode(opt.mode === 'size' ? 'size' : 'count');
    if (preset.fun && !names_.value) names_.value = K.shuffle(FUN).slice(0, 4).join(', ');
    refresh();
    publish();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-tool="' + SLUG + '"]');
    if (!root || !K) return;
    let host = null;
    const stage = K.stage({
      slug: SLUG,
      title: 'Teams',
      render: renderStage,
      onCommand: (m) => { if (m && m.type === 'key' && host && host.onKey) host.onKey(m.key); }
    });
    if (stage.isStage) return;
    host = stage;
    mount(root, stage);
  });
})();
