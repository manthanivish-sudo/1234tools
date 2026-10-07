/**
 * Claims on the live time tools: the time zone converter, the countdown and
 * the stopwatch, timers and Pomodoro (engine/render-live.js, with the pure
 * functions in engine/live.bundle.js and the zone list in
 * engine/live-zones.js). Loaded by claims/time.js.
 *
 * Node checks run live.bundle.js in a vm; the rest run the page in headless
 * Chrome. References are worked here: clock changes from the EU and US
 * rules, gaps by plain day counting, UTC offsets by arithmetic. When the
 * alerts are heard (on the audio clock, in a hidden tab) is proved by
 * build/tests/live-fixes.js, which can listen to the page's audio output;
 * those sentences are listed as manual here with that reason.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node', B = 'browser';
  const TZ = '/time/timezone-converter/', CD = '/time/countdown-timer/', SW = '/time/stopwatch-timer/';

  let live = null;
  const L = () => {
    if (live) return live;
    const window = {};
    const ctx = vm.createContext({ window, Intl, Math, Date, Number, String, Array, Object, JSON, Set, Map, TextEncoder, console, isFinite, isNaN });
    vm.runInContext(fs.readFileSync(path.join(K.ROOT, 'engine', 'live-zones.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(K.ROOT, 'engine', 'live.bundle.js'), 'utf8'), ctx);
    live = { L: window.MVRLive, Z: window.MVRZones };
    return live;
  };
  const valid = (id) => { try { new Intl.DateTimeFormat('en-GB', { timeZone: id }); return true; } catch (e) { return false; } };
  const index = () => K.once('tz-index', () => L().L.buildZoneIndex(L().Z, { valid, country: (cc) => new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(cc) }));
  const lastSun = (y, m) => { const d = new Date(Date.UTC(y, m, 0)); while (d.getUTCDay()) d.setUTCDate(d.getUTCDate() - 1); return d.getUTCDate(); };
  /* a page with the tools' own storage empty, in London's time zone */
  const openLive = async (url, opts) => {
    const p = await K.open(url, Object.assign({ wait: '.tool-io > *' }, opts || {}));
    return p;
  };
  const fresh = async (url) => {
    const p = await K.browser.newPage();
    await p.emulateTimezone('Europe/London');
    await p.goto(K.BASE + '/404.html');
    await p.evaluate(() => { ['1234tools.stopwatch.v1', '1234tools.countdown.v1', '1234tools.timezone.v1'].forEach((k) => localStorage.removeItem(k)); localStorage.setItem('1234tools-consent', 'denied'); });
    await p.close();
    const q = await openLive(url);
    await q.emulateTimezone('Europe/London');
    await q.reload({ waitUntil: 'load' });
    await q.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
    await q.waitForSelector('.tool-io > *');
    return q;
  };
  const notes = (p) => p.evaluate(() => [...document.querySelectorAll('.tz-notes li')].map((e) => e.textContent));

  /* ================================================================ */
  /* time zone converter                                               */
  /* ================================================================ */

  claim(TZ, 'tip', 'Daylight saving is handled by your browser’s IANA time zone database, so transitions are correct without any manual adjustment.', 'London 2020–2030 changes on the last Sundays of March and October at 01:00 UTC', N, async () => {
    const bad = [];
    for (let y = 2020; y <= 2030; y++) {
      const t = L().L.zoneTransitions('Europe/London', Date.UTC(y, 0, 1), Date.UTC(y + 1, 0, 1)).map((x) => x.at);
      const want = [Date.UTC(y, 2, lastSun(y, 3), 1), Date.UTC(y, 9, lastSun(y, 10), 1)];
      if (t.join() !== want.join()) bad.push(y);
    }
    return [!bad.length, bad.length ? 'wrong in ' + bad.join(', ') : '22 changes on their days'];
  });
  claim(TZ, 'tip', 'Search by city, country, zone name, abbreviation or offset: “Mumbai”, “Japan”, “IST” and “+5:30” all work.', 'each finds the zone first', N, async () => {
    const idx = await index(), S = L().L;
    const top = (q) => (S.searchZones(idx, q, 3, { offsetOf: (z) => S.offsetAt(Date.UTC(2026, 9, 6), z) })[0] || {}).id;
    const got = ['Mumbai', 'Japan', 'IST', '+5:30', 'Europe/London'].map(top);
    return [got[0] === 'Asia/Kolkata' && got[1] === 'Asia/Tokyo' && got[2] === 'Asia/Kolkata' && S.offsetAt(Date.UTC(2026, 9, 6), got[3]) === 330 && got[4] === 'Europe/London', got.join(', ')];
  });
  claim(TZ, 'tip', 'so the list says which zone it took', 'CST is offered as an abbreviation with its zone named', N, async () => {
    const r = L().L.searchZones(await index(), 'CST', 3)[0] || {};
    return [r.id === 'America/Chicago' && /^abbreviation, taken as .*America\/Chicago$/.test(r.detail), r.title + ': ' + r.detail];
  });
  claim(TZ, 'tip', 'When a city changes its clocks within four weeks of that date, the page says so and gives the new gap.', 'London to New York on 20 October 2026', B, async () => {
    const p = await fresh(TZ + '#from=Europe/London&to=America/New_York&at=2026-10-20T12:00');
    const n = await notes(p); await p.close();
    const ok = n.some((x) => x === 'London: the clocks go back 1 hour on Sunday, 25 October 2026 at 02:00 (UTC+01:00 to UTC+00:00).') &&
      n.some((x) => x === 'New York: the clocks go back 1 hour on Sunday, 1 November 2026 at 02:00 (UTC\u221204:00 to UTC\u221205:00). From then New York is 5 hours behind London, not 4 hours.');
    return [ok, n.join(' | ')];
  });
  claim(TZ, 'tip', 'green hours are working hours on a weekday, amber the two hours before work and the four after, and striped hours fall on a weekend', 'the planner classes, London, a Tuesday and a Saturday', N, async () => {
    const S = L().L;
    const tue = S.plannerRows(Date.UTC(2026, 0, 6), 24, ['Europe/London'], 'Europe/London', { start: 9, end: 17 })[0].cells.map((c) => c.cls[0]).join('');
    const sat = S.plannerRows(Date.UTC(2026, 0, 10), 24, ['Europe/London'], 'Europe/London', { start: 9, end: 17 })[0].cells.map((c) => c.cls[0]).join('');
    const want = 'nnnnnnnee' + 'wwwwwwww' + 'eeee' + 'nnn';
    return [tue === want && sat === 'o'.repeat(24), 'Tue ' + tue + ' / Sat ' + sat];
  });
  claim(TZ, 'tip', 'Choose an hour along the top to set the time.', 'clicking 15 sets 15:00', B, async () => {
    const p = await fresh(TZ + '#from=Europe/London&to=Asia/Tokyo&at=2026-10-06T09:00');
    await p.click('.tz-hour[data-col="15"]');
    const v = await p.evaluate(() => ({ t: document.getElementById('tz-time').value, at: window.MVRTool.shareState().params.at }));
    await p.close();
    return [v.t === '15:00' && v.at === '2026-10-06T15:00', JSON.stringify(v)];
  });
  claim(TZ, 'tip', 'The .ics file stores the time in UTC, so each person’s calendar shows it in their own zone.', '09:00 London on 1 July 2026 is DTSTART 08:00Z', B, async () => {
    const p = await fresh(TZ + '#from=Europe/London&to=America/New_York&at=2026-07-01T09:00');
    await p.click('.tz-out .btn-primary');
    const d = await K.downloads(p); await p.close();
    const t = d[0] ? d[0].bytes.toString('utf8') : '';
    return [d.length === 1 && d[0].type === 'text/calendar' && /\.ics$/.test(d[0].name) && /\r\nDTSTART:20260701T080000Z\r\n/.test(t) && !/TZID/.test(t), d[0] ? d[0].name + ' ' + d[0].type + ' ' + (t.match(/DTSTART[^\r]*/) || [''])[0] : 'no file'];
  });
  claim(TZ, 'faq', 'London and New York are five hours apart most of the year, but four for three weeks in March and for one week around the start of November.', 'days at 4 hours in 2026', N, async () => {
    const S = L().L, four = [];
    for (let d = Date.UTC(2026, 0, 1, 12); d < Date.UTC(2027, 0, 1); d += 86400000) if (S.offsetAt(d, 'Europe/London') - S.offsetAt(d, 'America/New_York') === 240) four.push(new Date(d).toISOString().slice(5, 10));
    const mar = four.filter((x) => x.startsWith('03')), late = four.filter((x) => !x.startsWith('03'));
    return [mar.length === 21 && late.length === 7 && late[0] === '10-25' && late[6] === '10-31', mar[0] + '…' + mar[mar.length - 1] + ' (' + mar.length + '), ' + late[0] + '…' + late[late.length - 1] + ' (' + late.length + ')'];
  });
  claim(TZ, 'faq', 'The search covers every location in the IANA time zone database (418 in release 2026e)', 'the list holds tzdb 2026e zone.tab', N, async () => {
    const Z = L().Z, ids = new Set(Z.zones.map((z) => z.id));
    return [Z.version === '2026e' && Z.zones.length === 418 && ids.size === 418 && ids.has('Asia/Kolkata') && ids.has('America/Argentina/Buenos_Aires'), Z.version + ', ' + Z.zones.length + ' zones'];
  });
  claim(TZ, 'faq', 'the old names browsers still report', 'every name this Node’s Intl reports resolves', N, async () => {
    const idx = await index(), S = L().L, all = Intl.supportedValuesOf('timeZone');
    const lost = all.filter((z) => !S.canonicalZone(idx, z));
    return [!lost.length && S.canonicalZone(idx, 'Asia/Calcutta') === 'Asia/Kolkata', all.length + ' names, ' + lost.length + ' unresolved'];
  });
  claim(TZ, 'faq', 'A zone too new for your browser’s own copy of the database is left out rather than shown wrong.', 'a zone the browser refuses is not in the index', N, async () => {
    const idx = L().L.buildZoneIndex(L().Z, { valid: (id) => id !== 'America/Coyhaique' && valid(id) });
    return [!idx.byId['America/Coyhaique'] && !!idx.byId['America/Santiago'] && L().L.searchZones(idx, 'Coyhaique').length === 0, Object.keys(idx.byId).length + ' zones'];
  });
  claim(TZ, 'faq', '01:30 does not exist in London on Sunday 29 March 2026. The converter says so and takes it as 02:30.', 'the gap, on the page', B, async () => {
    const p = await fresh(TZ + '#from=Europe/London&to=UTC&at=2026-03-29T01:30');
    const n = await notes(p);
    const utc = await p.evaluate(() => document.querySelector('.result-primary .result-value').textContent);
    await p.close();
    return [n[0] === '01:30 does not exist in London on Sunday, 29 March 2026: the clocks go forward then, so it is taken as 02:30.' && utc === 'Sun, 29 Mar 2026, 01:30', n[0] + ' / UTC ' + utc];
  });
  claim(TZ, 'faq', 'On the morning clocks go back, 01:30 happens twice; it uses the first and says so.', 'the overlap, on the page', B, async () => {
    const p = await fresh(TZ + '#from=Europe/London&to=UTC&at=2026-10-25T01:30');
    const n = await notes(p);
    const utc = await p.evaluate(() => document.querySelector('.result-primary .result-value').textContent);
    await p.close();
    return [/^01:30 happens twice in London on Sunday, 25 October 2026, as the clocks go back\. This uses the first, at UTC\+01:00; the second is 1 hour later everywhere else\.$/.test(n[0]) && utc === 'Sun, 25 Oct 2026, 00:30', n[0] + ' / UTC ' + utc];
  });
  claim(TZ, 'faq', 'the link carries the cities, the zone and the time you chose, after the # so it never reaches a server', 'the share link with settings', B, async () => {
    const p = await fresh(TZ + '#from=Europe/London&to=Asia/Tokyo,America/New_York&at=2026-10-06T15:00');
    const u = await p.evaluate(() => window.MVRShare.url('whatsapp', true));
    await p.close();
    const url = new URL(u), h = new URLSearchParams(url.hash.slice(1));
    return [h.get('from') === 'Europe/London' && h.get('to') === 'Asia/Tokyo,America/New_York' && h.get('at') === '2026-10-06T15:00' && [...url.searchParams.keys()].every((k) => /^utm_/.test(k)), u];
  });
  claim(TZ, 'privacy', 'Your cities and working hours are kept in this browser’s own storage so they are there next time', 'a city added is there after a reload', B, async () => {
    const p = await fresh(TZ + '#from=Europe/London&to=Asia/Tokyo');
    await p.click('.tz-cities .zp-input'); await p.type('.tz-cities .zp-input', 'Nairobi'); await p.keyboard.press('Enter');
    await p.select('#tz-ws', '8');
    await p.goto(K.BASE + TZ, { waitUntil: 'load' });
    await p.waitForSelector('.tz-city');
    const r = await p.evaluate(() => ({ c: [...document.querySelectorAll('.tz-city strong')].map((e) => e.textContent).join(), ws: document.getElementById('tz-ws').value, req: performance.getEntriesByType('resource').map((e) => e.name).filter((n) => !n.startsWith(location.origin)) }));
    await p.close();
    return [r.c === 'Tokyo,Nairobi' && r.ws === '8' && !r.req.length, JSON.stringify(r)];
  });

  /* ================================================================ */
  /* countdown                                                         */
  /* ================================================================ */

  claim(CD, 'tip', 'nothing is fetched while it counts', 'no request in 3 s of counting', B, async () => {
    const p = await fresh(CD);
    const n0 = p.__requests.length;
    await K.sleep(3000);
    const extra = p.__requests.slice(n0).map((r) => r.url);
    await p.close();
    return [!extra.length, extra.join(' ') || 'none'];
  });
  claim(CD, 'tip', 'a launch at 09:00 in New York counts down to 09:00 there, and the page shows when that is where you are', 'New York 09:00 on 1 December 2026, seen from London', B, async () => {
    const p = await fresh(CD + '#name=Launch&date=2026-12-01&time=09:00&tz=America/New_York');
    const s = await p.evaluate(() => document.querySelector('.countdown-sub').textContent);
    await p.close();
    return [s === 'Tuesday 1 December 2026 at 09:00 (New York time; Tuesday 1 December 2026 at 14:00 where you are)' || s === 'Tuesday, 1 December 2026 at 09:00 (New York time; Tuesday, 1 December 2026 at 14:00 where you are)', s];
  });
  claim(CD, 'tip', 'For an anniversary, choose “Time since it” to see the years, months and days as well.', 'since 29 February 2020', B, async () => {
    const p = await fresh(CD + '#name=Wedding&date=2020-02-29&time=00:00&tz=UTC&mode=since');
    const r = await p.evaluate(() => ({ t: document.querySelector('.countdown-title').textContent, x: document.querySelector('.countdown-extra').textContent, now: Date.now() }));
    await p.close();
    const days = Math.floor((r.now - Date.UTC(2020, 1, 29)) / 86400000);
    /* whole months from 29 Feb 2020 to today (UTC), by counting */
    const n = new Date(r.now); let months = (n.getUTCFullYear() - 2020) * 12 + n.getUTCMonth() - 1;
    if (n.getUTCDate() < 29 && n.getUTCMonth() !== 1) months--;
    if (n.getUTCMonth() === 1 && n.getUTCDate() < Math.min(29, new Date(Date.UTC(n.getUTCFullYear(), 2, 0)).getUTCDate())) months--;
    const y = Math.floor(months / 12), m = months % 12;
    const ok = r.t === 'Since Wedding' && r.x.startsWith(y + ' year' + (y === 1 ? '' : 's') + (m ? ', ' + m + ' month' + (m === 1 ? '' : 's') : '') + ', ') && r.x.endsWith(' · ' + days.toLocaleString('en-GB') + ' days in all');
    return [ok, r.t + ' / ' + r.x + ' (want ' + y + 'y ' + m + 'm, ' + days + ' days)'];
  });
  claim(CD, 'tip', 'One set for the 31st falls on the last day of shorter months.', 'monthly from 31 January', N, async () => {
    const S = L().L, ev = { y: 2026, mo: 1, d: 31, h: 9, mi: 0, zone: 'UTC', repeat: 'monthly' };
    const got = [Date.UTC(2026, 1, 2), Date.UTC(2026, 2, 2), Date.UTC(2026, 3, 2), Date.UTC(2028, 1, 2)].map((now) => new Date(S.nextOccurrence(ev, now).at).toISOString().slice(0, 10));
    return [got.join() === '2026-02-28,2026-03-31,2026-04-30,2028-02-29', got.join(', ')];
  });
  claim(CD, 'tip', 'moves on to the next time by itself', 'a yearly date that has passed shows the next one', B, async () => {
    const p = await fresh(CD + '#name=Birthday&date=2020-03-15&time=10:00&tz=Europe/London&repeat=yearly');
    const r = await p.evaluate(() => ({ s: document.querySelector('.countdown-sub').textContent, x: document.querySelector('.countdown-extra').textContent, t: document.querySelector('.countdown-title').textContent, now: Date.now() }));
    await p.close();
    const n = new Date(r.now), y = n.getUTCFullYear() + (Date.UTC(n.getUTCFullYear(), 2, 15, 10) - 3600000 > r.now ? 0 : 1);
    return [r.t === 'Until Birthday' && r.s.indexOf('15 March ' + y + ' at 10:00') >= 0 && /^Repeats every year · occurrence \d+$/.test(r.x), r.t + ' / ' + r.s + ' / ' + r.x];
  });
  claim(CD, 'tip', 'the tab’s title shows the time left', 'the title starts with the time left and the name', B, async () => {
    const p = await fresh(CD + '#name=Exam&date=2030-06-01&time=09:00&tz=UTC');
    const t = await p.evaluate(() => document.title);
    await p.close();
    return [/^\d+d \d\d:\d\d:\d\d Exam – Countdown Timer/.test(t), t];
  });
  manual(CD, 'tip', 'The sound is timed by the audio clock, which keeps time in a background tab.', 'proved by build/tests/live-fixes.js (cases 6 and 12), which listens to the page’s audio output in a hidden tab');
  manual(CD, 'tip', 'Browsers block sound until you interact with the page', 'browser autoplay policy');
  claim(CD, 'faq', 'Your last countdown is remembered in this browser, and reopening the page works out the time left again from the target.', 'name and date kept across a reload', B, async () => {
    const p = await fresh(CD);
    await p.$eval('#cd-label', (i) => { i.value = 'Holiday'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.$eval('#cd-date', (i) => { i.value = '2031-08-01'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.reload({ waitUntil: 'load' });
    await p.waitForSelector('#cd-label');
    const r = await p.evaluate(() => ({ n: document.getElementById('cd-label').value, d: document.getElementById('cd-date').value, t: document.querySelector('.countdown-title').textContent, days: Number(document.querySelector('.countdown-val').textContent.replace(/,/g, '')), now: Date.now() }));
    await p.close();
    const want = Math.floor((Date.UTC(2031, 7, 1, 8) - r.now) / 86400000);
    return [r.n === 'Holiday' && r.d === '2031-08-01' && r.t === 'Until Holiday' && Math.abs(r.days - want) <= 1, JSON.stringify(r) + ' want ~' + want + ' days'];
  });
  claim(CD, 'faq', 'The link carries the event name, date, time, time zone, repeat and theme after the #', 'the share link with settings', B, async () => {
    const p = await fresh(CD + '#name=Gig&date=2027-05-01&time=20:00&tz=Europe/Paris&repeat=weekly&theme=neon');
    const u = await p.evaluate(() => window.MVRShare.url('email', true));
    await p.close();
    const h = new URLSearchParams(new URL(u).hash.slice(1));
    return [h.get('name') === 'Gig' && h.get('date') === '2027-05-01' && h.get('time') === '20:00' && h.get('tz') === 'Europe/Paris' && h.get('repeat') === 'weekly' && h.get('theme') === 'neon', u];
  });
  manual(CD, 'faq', 'Notifications need your permission, asked for when you tick “Notify me at zero”', 'a browser permission prompt; the notification at zero is checked by build/tests/live-fixes.js case 12');

  /* ================================================================ */
  /* stopwatch, timers, Pomodoro                                       */
  /* ================================================================ */

  manual(SW, 'tip', 'The stopwatch measures elapsed time from a high-resolution clock', 'implementation detail (performance.now)');
  claim(SW, 'tip', 'With three laps or more the fastest and slowest are marked, and “Download laps (CSV)” saves them for a spreadsheet.', 'three laps, marked, saved', B, async () => {
    const p = await fresh(SW);
    await p.click('.sw-panel .btn-primary');
    for (const ms of [300, 700, 400]) { await K.sleep(ms); await p.click('.sw-panel .sw-buttons .btn-ghost'); }
    const marks = await p.evaluate(() => ({ fast: document.querySelectorAll('.sw-lap.is-fast').length, slow: document.querySelectorAll('.sw-lap.is-slow').length, slowN: (document.querySelector('.sw-lap.is-slow .sw-lap-n') || {}).textContent }));
    await p.click('.sw-lap-acts .btn-ghost');
    const d = await K.downloads(p); await p.close();
    const rows = d[0] ? d[0].bytes.toString('utf8').trim().split('\r\n') : [];
    return [marks.fast === 1 && marks.slow === 1 && marks.slowN === '#2' && d[0] && d[0].type === 'text/csv' && /\.csv$/.test(d[0].name) && rows.length === 4, JSON.stringify(marks) + ' ' + (d[0] ? d[0].name + ' ' + rows.length + ' rows' : 'no file')];
  });
  claim(SW, 'tip', 'Keys: Space starts or pauses what is on screen, L records a lap and R resets. They do nothing while you are typing in a box.', 'keys on the stopwatch, and in a box', B, async () => {
    const p = await fresh(SW);
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.keyboard.press('Space'); await K.sleep(300); await p.keyboard.press('KeyL'); await p.keyboard.press('Space');
    const a = await p.evaluate(() => ({ b: document.querySelector('.sw-panel .btn-primary').textContent, laps: document.querySelectorAll('.sw-lap').length }));
    await p.keyboard.press('KeyR');
    const b = await p.evaluate(() => document.querySelector('.sw-panel .sw-display').textContent);
    await p.click('.sw-tab[data-tab=timer]');
    await p.focus('.sw-timer .sw-inputs input');
    await p.keyboard.press('KeyR'); await p.keyboard.press('Space');
    const c = await p.evaluate(() => document.querySelector('.sw-timer .btn-primary').textContent);
    await p.close();
    return [a.b === 'Resume' && a.laps === 1 && b === '00:00.00' && c === 'Start', JSON.stringify(a) + ' ' + b + ' ' + c];
  });
  claim(SW, 'tip', 'You can change how many work sessions come before the long break, and whether breaks and work start by themselves.', 'two sessions, work waiting for Start', B, async () => {
    const p = await fresh(SW);
    await p.click('.sw-tab[data-tab=pomodoro]');
    await p.evaluate(() => {
      const panel = document.querySelectorAll('.tool-io .sw-panel')[2];
      const ins = panel.querySelectorAll('.sw-inputs input');
      [0.02, 0.02, 0.02, 2].forEach((v, i) => { ins[i].value = String(v); ins[i].dispatchEvent(new Event('input', { bubbles: true })); });
      const boxes = panel.querySelectorAll('.sw-checks input');
      boxes[1].checked = false; boxes[1].dispatchEvent(new Event('change', { bubbles: true }));
      panel.querySelector('.btn-primary').click();
    });
    await K.sleep(3300);
    const a = await p.evaluate(() => { const x = document.querySelectorAll('.tool-io .sw-panel')[2]; return [x.querySelector('.sw-phase').textContent, x.querySelector('.sw-count').textContent, x.querySelector('.btn-primary').textContent].join(' / '); });
    await p.evaluate(() => document.querySelectorAll('.tool-io .sw-panel')[2].querySelector('.btn-primary').click());
    await K.sleep(1900);
    const b = await p.evaluate(() => { const x = document.querySelectorAll('.tool-io .sw-panel')[2]; return [x.querySelector('.sw-phase').textContent, x.querySelector('.sw-count').textContent].join(' / '); });
    await p.close();
    return [a === 'Work / Cycle 2 of 2 / Start' && b === 'Long break / Cycle 2 of 2', a + ' then ' + b];
  });
  manual(SW, 'tip', 'press start at least once before relying on the alert', 'browser autoplay policy');
  manual(SW, 'tip', 'The alert is set on the audio clock when you press Start, so it sounds on time even in a background tab.', 'proved by build/tests/live-fixes.js (cases 1, 3, 6 and 9), which listens to the page’s audio output in a hidden tab');
  manual(SW, 'faq', 'The alert is timed by the audio clock rather than the page’s timers, which a browser slows in a background tab.', 'as above: build/tests/live-fixes.js');
  claim(SW, 'faq', 'Add up to eight, each with its own name, length and alert. The tab’s title shows the one that ends soonest.', 'eight timers; the soonest in the title', B, async () => {
    const p = await fresh(SW);
    await p.click('.sw-tab[data-tab=timer]');
    for (let i = 0; i < 9; i++) await p.evaluate(() => document.querySelector('.sw-add').click());
    const n = await p.evaluate(() => ({ n: document.querySelectorAll('.sw-timer').length, off: document.querySelector('.sw-add').disabled }));
    await p.evaluate(() => {
      const t = document.querySelectorAll('.sw-timer');
      const set = (el, name, s) => { const l = el.querySelector('.sw-label'); l.value = name; l.dispatchEvent(new Event('input', { bubbles: true })); const i = el.querySelectorAll('.sw-inputs input'); i[1].value = '0'; i[2].value = String(s); i[2].dispatchEvent(new Event('input', { bubbles: true })); el.querySelector('.btn-primary').click(); };
      set(t[0], 'Pasta', 50); set(t[1], 'Tea', 20);
    });
    await K.sleep(600);
    const title = await p.evaluate(() => document.title);
    await p.close();
    return [n.n === 8 && n.off && /^00:(19|20) Tea – /.test(title), JSON.stringify(n) + ' ' + title];
  });
  claim(SW, 'faq', 'A timer that ended while the page was closed says when it ended.', 'closed, reopened', B, async () => {
    const p = await fresh(SW);
    await p.click('.sw-tab[data-tab=timer]');
    await p.evaluate(() => { const i = document.querySelectorAll('.sw-timer .sw-inputs input'); i[1].value = '0'; i[2].value = '1'; i[2].dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.sw-timer .btn-primary').click(); });
    await p.goto(K.BASE + '/404.html');
    await K.sleep(1800);
    await p.goto(K.BASE + SW, { waitUntil: 'load' });
    await p.waitForSelector('.sw-ended');
    const t = await p.evaluate(() => ({ e: document.querySelector('.sw-ended').textContent, b: document.querySelector('.sw-timer .btn-primary').textContent, tab: document.querySelector('.sw-tab[aria-pressed=true]').dataset.tab }));
    await p.close();
    return [/^Timer 1 ended at \d\d:\d\d:\d\d, while the page was closed\.$/.test(t.e) && t.b === 'Start' && t.tab === 'timer', JSON.stringify(t)];
  });
  claim(SW, 'faq', 'Timers, the stopwatch and the Pomodoro carry on from where the clock says they are.', 'a running stopwatch after leaving and coming back', B, async () => {
    const p = await fresh(SW);
    await p.click('.sw-panel .btn-primary');
    await p.goto(K.BASE + '/404.html');
    await K.sleep(1500);
    await p.goto(K.BASE + SW, { waitUntil: 'load' });
    await p.waitForSelector('.sw-panel .sw-display');
    await K.sleep(200);
    const d = await p.evaluate(() => ({ t: document.querySelector('.sw-panel .sw-display').textContent, b: document.querySelector('.sw-panel .btn-primary').textContent }));
    await p.close();
    const m = /^00:(\d\d)\.(\d\d)$/.exec(d.t);
    return [!!m && Number(m[1]) + Number(m[2]) / 100 >= 1.5 && d.b === 'Stop', JSON.stringify(d)];
  });
  claim(SW, 'faq', 'The sound comes back after your next click or key press, as browsers require.', 'the page says so after a reload', B, async () => {
    const p = await fresh(SW);
    await p.click('.sw-tab[data-tab=timer]');
    await p.click('.sw-timer .btn-primary');
    await p.reload({ waitUntil: 'load' });
    await p.waitForSelector('.sw-restore');
    const m = await p.evaluate(() => document.querySelector('.sw-restore').textContent);
    await p.mouse.click(4, 4);
    const after = await p.evaluate(() => document.querySelector('.sw-restore').textContent);
    await p.close();
    return [m === 'Carried on from your last visit. Click or press a key on the page to turn the alert sound back on.' && after === '', m + ' / then: "' + after + '"'];
  });
  manual(SW, 'faq', 'allow notifications when the browser asks', 'a browser permission prompt');
  claim(SW, 'privacy', 'What is running is kept in this browser’s own storage so a reload carries on', 'the storage key and nothing sent', B, async () => {
    const p = await fresh(SW);
    await p.click('.sw-panel .btn-primary');
    await K.sleep(300);
    const r = await p.evaluate(() => ({ k: Object.keys(localStorage).filter((k) => /^1234tools\.stopwatch/.test(k)), v: JSON.parse(localStorage.getItem('1234tools.stopwatch.v1') || '{}') }));
    const out = p.__requests.filter((q) => !q.url.startsWith(K.BASE));
    await p.close();
    return [r.k.join() === '1234tools.stopwatch.v1' && r.v.v === 1 && r.v.sw && r.v.sw.running === true && !out.length, JSON.stringify(r.k) + ' running ' + (r.v.sw && r.v.sw.running)];
  });
};
