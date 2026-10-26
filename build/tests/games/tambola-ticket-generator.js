/* The Tambola Ticket Generator's own rules, for build/tests/games.js.
   10,000 strips are held to the ticket rules by a checker written here (not
   by the engine's own code); claims() to tickets worked by hand; printing to
   the paper, with print media emulated; the PDF and the pictures to what the
   files actually contain. */
'use strict';
const SLUG = 'tambola-ticket-generator';

/* ---------- an independent checker for one strip ---------- */
function stripFaults(strip) {
  const f = [];
  const seen = new Map();
  if (strip.length !== 6) f.push('strip has ' + strip.length + ' tickets');
  strip.forEach((rows, t) => {
    if (rows.length !== 3) f.push('t' + t + ': ' + rows.length + ' rows');
    let total = 0;
    rows.forEach((r, ri) => {
      if (r.length !== 9) f.push('t' + t + ' row ' + ri + ': ' + r.length + ' columns');
      const k = r.filter((x) => x !== 0).length;
      if (k !== 5) f.push('t' + t + ' row ' + ri + ': ' + k + ' numbers');
      total += k;
    });
    if (total !== 15) f.push('t' + t + ': ' + total + ' numbers');
    for (let c = 0; c < 9; c++) {
      const min = c === 0 ? 1 : c * 10, max = c === 8 ? 90 : c * 10 + 9;
      const col = rows.map((r) => r[c]).filter((x) => x !== 0);
      if (col.length < 1 || col.length > 3) f.push('t' + t + ' col ' + c + ': ' + col.length + ' numbers');
      for (let i = 0; i < col.length; i++) {
        const x = col[i];
        if (!Number.isInteger(x) || x < min || x > max) f.push('t' + t + ' col ' + c + ': ' + x + ' out of range');
        if (i && col[i] <= col[i - 1]) f.push('t' + t + ' col ' + c + ': not sorted top to bottom');
        seen.set(x, (seen.get(x) || 0) + 1);
      }
    }
  });
  for (let x = 1; x <= 90; x++) if (seen.get(x) !== 1) f.push(x + ' appears ' + (seen.get(x) || 0) + ' times');
  return f;
}

/* ---------- a hand-worked ticket ----------
     4  .  23  .  45  .  61  .  82
     . 15   . 37  48  .  66 79   .
     9 18   .  .   . 53   . 74  90          */
const HAND = { id: 'HAND-001', rows: [[4, 0, 23, 0, 45, 0, 61, 0, 82], [0, 15, 0, 37, 48, 0, 66, 79, 0], [9, 18, 0, 0, 0, 53, 0, 74, 90]] };
const CASES = [
  /* [called in order, prize, won, missing (sorted), at] — all worked out by hand */
  [[4, 23, 45, 61], 'early5', false, null, null],
  [[4, 23, 45, 61], 'top', false, [82], null],
  [[4, 23, 45, 61], 'corners', false, [9, 82, 90], null],
  [[1, 2, 4, 23, 45, 61, 82], 'top', true, [], 7],
  [[1, 2, 4, 23, 45, 61, 82], 'early5', true, [], 7],
  [[4, 15, 9, 50, 18, 3, 23], 'early5', true, [], 7],
  [[15, 37, 48, 66, 79], 'middle', true, [], 5],
  [[15, 37, 48, 66], 'middle', false, [79], null],
  [[9, 18, 53, 74, 90, 1], 'bottom', true, [], 5],
  [[9, 18, 53, 74], 'bottom', false, [90], null],
  [[90, 9, 4, 30, 82], 'corners', true, [], 5],
  [[4, 82, 9], 'corners', false, [90], null],
  [[4, 23, 45, 61, 82, 9, 18, 53, 74, 90], 'twolines', true, [], 10],
  [[4, 23, 45, 61, 82, 9, 18, 53, 74], 'twolines', false, [90], null],
  [[4, 23, 45, 61, 82], 'line', true, [], 5],
  [[4, 23, 45, 61, 82, 15, 37, 48, 66, 79, 9, 18, 53, 74, 90, 2], 'full', true, [], 15],
  [[4, 23, 45, 61, 82, 15, 37, 48, 66, 79, 9, 18, 53, 74], 'full', false, [90], null],
  [[], 'full', false, [4, 9, 15, 18, 23, 37, 45, 48, 53, 61, 66, 74, 79, 82, 90], null]
];

const MM = 96 / 25.4;

module.exports = {
  stripFaults,
  check: async function (page, h) {
    /* ---- 10,000 strips from random seeds ---- */
    let faults = [], strips = 0;
    for (let chunk = 0; chunk < 5; chunk++) {
      const got = await page.evaluate(() => {
        const T = window.TambolaCore, K = window.GameKit;
        const out = [];
        for (let i = 0; i < 2000; i++) {
          const seed = K.newSeed(4 + K.randInt(8)), no = 1 + K.randInt(100);
          const st = T.ticketStrip(seed, no);
          out.push({ seed: seed, no: no, t: st.map((t) => t.rows), idl: st.map((t) => t.id) });
        }
        return out;
      });
      for (const s of got) {
        strips++;
        const f = stripFaults(s.t);
        const want = Array.from({ length: 6 }, (_, i) => s.seed + '-' + String((s.no - 1) * 6 + i + 1).padStart(3, '0'));
        if (s.idl.join() !== want.join()) f.push('ids ' + s.idl.join() + ' want ' + want.join());
        if (f.length && faults.length < 5) faults.push(s.seed + '/' + s.no + ': ' + f.slice(0, 3).join('; '));
        else if (f.length) faults.push('…');
      }
    }
    h.ok(strips === 10000 && faults.length === 0, 'tickets: 10,000 random strips obey every rule (3×9, 5 a row, 15, column ranges, 1–3 a column, sorted, 1–90 once)', faults.slice(0, 5).join(' | '));

    const r = await page.evaluate((hand, cases) => {
      const T = window.TambolaCore, K = window.GameKit;
      const out = {};
      const a = T.ticket('ABC234', 50), b = T.ticket('ABC234', 50), c = T.ticketStrip('ABC234', 9)[1];
      out.same = JSON.stringify(a.rows) === JSON.stringify(b.rows) && JSON.stringify(a.rows) === JSON.stringify(c.rows) && a.id === 'ABC234-050';
      out.diff = JSON.stringify(T.ticket('ABC234', 50).rows) !== JSON.stringify(T.ticket('ABC235', 50).rows);
      out.lower = JSON.stringify(T.ticket('abc234', 50).rows) === JSON.stringify(a.rows);
      out.golden = T.ticket('K7MPQ2', 14);
      /* ID round trip: 300 random tickets rebuilt from their printed IDs */
      let rt = 0;
      for (let i = 0; i < 300; i++) {
        const seed = K.newSeed(6), n = 1 + K.randInt(600);
        const t = T.ticket(seed, n);
        const back = T.ticketFromId(t.id), back2 = T.ticketFromId(' ' + seed.toLowerCase() + ' ' + n + ' ');
        const all = T.claims(back, T.numbers(t));
        if (!back || JSON.stringify(back.rows) !== JSON.stringify(t.rows) || JSON.stringify(back2.rows) !== JSON.stringify(t.rows) || !all.full.won || !all.early5.won) rt++;
      }
      out.roundTrip = rt;
      out.parse = ['K7MPQ2-014', 'k7mpq2 14', 'K7MPQ2#14', 'K7MPQ2', '-14', 'K7MPQ2-0'].map((x) => T.parseId(x));
      out.cases = cases.map((cs) => {
        const res = T.claims(hand, cs[0])[cs[1]];
        const res2 = T.claims(hand, new Set(cs[0]))[cs[1]];
        return { won: res.won, missing: res.missing.slice().sort((x, y) => x - y), at: res.at, need: res.need, setWon: res2.won };
      });
      return out;
    }, HAND, CASES);
    h.ok(r.same, 'tickets: the same (seed, n) gives the same ticket, by ticket() and by its strip');
    h.ok(r.diff, 'tickets: a different seed gives different tickets');
    h.ok(r.lower, 'tickets: the set code is not case-sensitive');
    /* the tickets printed today must come out the same next year */
    const GOLD = [[1, 11, 0, 0, 0, 56, 0, 75, 87], [0, 12, 20, 35, 0, 0, 60, 0, 90], [4, 0, 21, 0, 49, 57, 61, 0, 0]];
    h.ok(JSON.stringify(r.golden.rows) === JSON.stringify(GOLD) && r.golden.id === 'K7MPQ2-014', 'tickets: K7MPQ2-014 is still the ticket first printed', JSON.stringify(r.golden.rows));
    h.ok(r.roundTrip === 0, 'tickets: 300 ticket IDs round-trip through the claim checker', String(r.roundTrip));
    const P = r.parse;
    h.ok(P[0] && P[0].seed === 'K7MPQ2' && P[0].n === 14 && P[1] && P[1].n === 14 && P[2] && P[2].n === 14 && !P[3] && !P[4] && !P[5], 'tickets: ticket numbers are read leniently and nonsense refused', JSON.stringify(P));
    CASES.forEach((cs, i) => {
      const got = r.cases[i];
      const want = cs[3];
      const okWon = got.won === cs[2] && got.setWon === cs[2];
      const okMiss = want === null ? (cs[1] === 'early5' ? got.need === 5 - cs[0].filter((x) => [].concat.apply([], HAND.rows).indexOf(x) >= 0).length : true) : got.missing.join() === want.join();
      const okAt = got.at === cs[4];
      h.ok(okWon && okMiss && okAt, 'claims: ' + cs[1] + ' after ' + (cs[0].join(' ') || 'nothing') + ' → ' + (cs[2] ? 'won at ' + cs[4] : 'not yet'), JSON.stringify(got));
    });

    /* ---- the page: the first strip, the set code, the caller link ---- */
    const ui = await page.evaluate(() => {
      const strip = Array.from(document.querySelectorAll('.tk-strip .tk'));
      const nums = [].concat.apply([], strip.map((t) => Array.from(t.querySelectorAll('td')).map((td) => Number(td.textContent) || 0))).filter(Boolean).sort((a, b) => a - b);
      const seed = document.querySelector('[data-tool] input[autocapitalize="characters"]').value;
      return { n: strip.length, ids: strip.map((t) => t.querySelector('.tk-id').textContent), nums: nums.join(), seed: seed, link: (document.querySelector('[data-tool] a[href*="tambola-number-caller"]') || {}).href || '' };
    });
    h.ok(ui.n === 6 && ui.ids.join() === [1, 2, 3, 4, 5, 6].map((i) => ui.seed + '-00' + i).join(), 'tickets: the first strip is on screen with its IDs', ui.ids.join());
    h.ok(ui.nums === Array.from({ length: 90 }, (_, i) => i + 1).join(), 'tickets: the strip on screen uses 1–90 once');
    h.ok(/^[A-HJKMNP-Z2-9]{6}$/.test(ui.seed), 'tickets: a fresh set code by default', ui.seed);
    h.ok(ui.link.indexOf('/games/tambola-number-caller/?seed=' + ui.seed) > 0, 'tickets: links to the caller with the same set code', ui.link);
    const sel = (label) => page.evaluate((label) => {
      const f = Array.from(document.querySelectorAll('[data-tool] .game-field')).find((x) => x.querySelector('.game-field-label').textContent === label);
      return f ? true : false;
    }, label);
    const setField = (label, value) => page.evaluate((label, value) => {
      const f = Array.from(document.querySelectorAll('[data-tool] .game-field')).find((x) => x.querySelector('.game-field-label').textContent === label);
      const i = f.querySelector('input, select');
      i.value = value;
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.dispatchEvent(new Event('change', { bubbles: true }));
    }, label, value);
    h.ok(await sel('Set code'), 'tickets: has a set code field');
    await setField('Set code', 'k7mpq2');
    await setField('How many tickets', '14');
    const re = await page.evaluate(() => ({
      first: Array.from(document.querySelectorAll('.tk-strip .tk')).map((t) => t.querySelector('.tk-id').textContent)[2],
      cells: Array.from(document.querySelectorAll('.tk-strip .tk')[2].querySelectorAll('td')).map((td) => Number(td.textContent) || 0).join(),
      count: document.querySelector('[data-tool] input[type=number]').value,
      msg: document.querySelector('[data-tool] .game-msg').textContent
    }));
    h.ok(re.first === 'K7MPQ2-003' && re.cells === [].concat.apply([], (await page.evaluate(() => window.TambolaCore.ticket('K7MPQ2', 3).rows))).join(), 'tickets: typing an old set code reprints its tickets', re.first);
    h.ok(re.count === '18' && /14 became 18/.test(re.msg), 'tickets: the count is rounded up to whole strips and says so', re.count + ' / ' + re.msg);

    /* ---- printing, with print media emulated ---- */
    await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    const clickText = (text) => page.evaluate((text) => {
      const b = Array.from(document.querySelectorAll('[data-tool] button')).find((x) => x.textContent.trim() === text);
      b.click();
    }, text);
    const printed = async (paper, per, count) => {
      await setField('Paper', paper);
      await setField('Layout', String(per));
      await setField('How many tickets', String(count));
      await clickText('Print');
      await page.emulateMediaType('print');
      const res = await page.evaluate(() => {
        const vis = Array.from(document.body.children).filter((n) => !n.classList.contains('tt-print') && getComputedStyle(n).display !== 'none' && n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE');
        const sheets = Array.from(document.querySelectorAll('body > .tt-print .tt-sheet'));
        let outside = 0;
        const per = sheets.map((s) => {
          const sr = s.getBoundingClientRect();
          const ts = Array.from(s.querySelectorAll('.tk'));
          ts.forEach((t) => {
            const r = t.getBoundingClientRect(), slot = t.parentNode.getBoundingClientRect();
            if (r.left < slot.left - 0.5 || r.right > slot.right + 0.5 || r.top < slot.top - 0.5 || r.bottom > slot.bottom + 0.5) outside++;
            if (slot.bottom > sr.bottom + 0.5 || slot.right > sr.right + 0.5) outside++;
            if (t.scrollHeight > t.clientHeight + 1) outside++;
          });
          return { n: ts.length, h: sr.height, w: sr.width };
        });
        return {
          printed: window.__printed,
          chrome: vis.map((n) => n.tagName + '.' + n.className).slice(0, 4),
          header: getComputedStyle(document.querySelector('header')).display,
          sheets: per, outside: outside,
          page: (document.getElementById('tt-page') || {}).textContent || '',
          printShown: getComputedStyle(document.querySelector('body > .tt-print')).display
        };
      });
      await page.emulateMediaType('screen');
      return res;
    };
    const p6 = await printed('a4', 6, 12);
    h.ok(p6.printed === 1, 'print: Print calls window.print');
    h.ok(p6.chrome.length === 0 && p6.header === 'none' && p6.printShown === 'block', 'print: the print stylesheet hides the site chrome and shows the tickets', p6.chrome.join(' | '));
    const a4h = (297 - 16) * MM, a4w = (210 - 16) * MM;
    h.ok(p6.sheets.length === 2 && p6.sheets.every((s) => s.n === 6 && Math.abs(s.h - a4h) < 2 && Math.abs(s.w - a4w) < 2), 'print: 12 tickets at 6 a page → 2 A4 pages of 6', JSON.stringify(p6.sheets));
    h.ok(p6.outside === 0, 'print: every ticket fits inside its slot on the page', String(p6.outside));
    h.ok(/size: A4 portrait/.test(p6.page), 'print: the page size is set to A4', p6.page);
    const p12 = await printed('letter', 12, 36);
    const lh = (279.4 - 16) * MM;
    h.ok(p12.sheets.length === 3 && p12.sheets.every((s) => s.n === 12 && Math.abs(s.h - lh) < 2), 'print: 36 tickets at 12 a page → 3 US Letter pages of 12', JSON.stringify(p12.sheets));
    h.ok(p12.outside === 0 && /size: letter/.test(p12.page), 'print: 12 a page fit on Letter', p12.outside + ' ' + p12.page);
    const big = await printed('a4', 12, 600);
    h.ok(big.sheets.length === 50 && big.outside === 0, 'print: 600 tickets → 50 pages, all fitting', big.sheets.length + ' / ' + big.outside);
    await page.evaluate(() => window.TambolaCore.clearPrint());

    /* ---- PDF on demand ---- */
    const before = await page.evaluate(() => ({ core: !!window.MVRPdfCore, tag: !!document.querySelector('script[src*="pdfcore"]'), zip: !!window.MVRZip }));
    h.ok(!before.core && !before.tag && !before.zip, 'pdf: the PDF and ZIP writers are not loaded until asked for');
    await setField('How many tickets', '18');
    await setField('Layout', '6');
    await setField('Paper', 'a4');
    await page.evaluate(() => {
      window.__dl = [];
      window.GameKit.download = (blob, name) => {
        const rec = { name: name, type: blob.type, size: blob.size };
        window.__dl.push(rec);
        blob.arrayBuffer().then((b) => {
          const u = new Uint8Array(b);
          let s = '';
          for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
          rec.head = s.slice(0, 8);
          rec.pages = (s.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
          rec.zipEntries = (s.match(/PK\x03\x04/g) || []).length;
          rec.png = s.slice(1, 4) === 'PNG';
          if (rec.png) { const v = new DataView(b); rec.w = v.getUint32(16); rec.h = v.getUint32(20); }
          rec.done = true;
        });
      };
    });
    await clickText('Download PDF');
    for (let i = 0; i < 40; i++) { await h.sleep(100); if (await page.evaluate(() => window.__dl.length && window.__dl[0].done)) break; }
    const pdf = await page.evaluate(() => window.__dl[0] || null);
    h.ok(pdf && pdf.type === 'application/pdf' && pdf.head.indexOf('%PDF-') === 0 && /\.pdf$/.test(pdf.name), 'pdf: Download PDF makes a PDF', JSON.stringify(pdf));
    h.ok(pdf && pdf.pages === 3, 'pdf: 18 tickets at 6 a page is 3 pages', pdf && String(pdf.pages));
    h.ok(await page.evaluate(() => !!window.MVRPdfCore && !!document.querySelector('script[src="/engine/pdfcore.bundle.js"]')), 'pdf: the PDF writer was loaded on demand from /engine/');

    /* ---- pictures ---- */
    await setField('Ticket number', '5');
    await clickText('Download picture');
    for (let i = 0; i < 40; i++) { await h.sleep(100); if (await page.evaluate(() => window.__dl.length > 1 && window.__dl[1].done)) break; }
    const png = await page.evaluate(() => window.__dl[1] || null);
    h.ok(png && png.type === 'image/png' && png.png && png.name === 'tambola-K7MPQ2-005.png' && png.w === 1080, 'pictures: one ticket as a PNG named by its ID', JSON.stringify(png));
    await setField('How many tickets', '12');
    await clickText('All pictures as ZIP');
    for (let i = 0; i < 80; i++) { await h.sleep(100); if (await page.evaluate(() => window.__dl.length > 2 && window.__dl[2].done)) break; }
    const zip = await page.evaluate(() => window.__dl[2] || null);
    h.ok(zip && zip.type === 'application/zip' && zip.zipEntries === 12 && /\.zip$/.test(zip.name), 'pictures: all 12 as a ZIP of 12 files', JSON.stringify(zip));
    h.ok(await page.evaluate(() => !!window.MVRZip), 'pictures: the ZIP writer was loaded on demand');

    /* ---- the stage shows the first strip ---- */
    const stage = await h.openStage(SLUG);
    await h.sleep(400);
    const st = await stage.evaluate(() => Array.from(document.querySelectorAll('.tcs-strip .tk-id')).map((x) => x.textContent));
    h.ok(st.length === 6 && st[0] === 'K7MPQ2-001', 'tickets: the TV shows the first strip', st.join());
    await stage.close();
    await page.bringToFront();
  },
  landings: {
    'printable-tambola-tickets': async function (page, h) {
      const r = await page.evaluate(() => ({ n: document.querySelector('[data-tool] input[type=number]').value, per: Array.from(document.querySelectorAll('[data-tool] select')).map((s) => s.value) }));
      h.ok(r.n === '24' && r.per.indexOf('6') >= 0, 'tickets landing: printable opens with 24 tickets, 6 a page', JSON.stringify(r));
    },
    'tambola-tickets-for-whatsapp': async function (page, h) {
      const r = await page.evaluate(() => ({
        n: document.querySelector('[data-tool] input[type=number]').value,
        title: document.querySelector('[data-tool] input[type=text]').value,
        firstH3: document.querySelector('[data-tool] .game-panel h3').textContent
      }));
      h.ok(r.n === '12' && r.title === 'Kitty party Tambola' && /pictures/i.test(r.firstH3), 'tickets landing: WhatsApp opens with twelve titled tickets and the pictures first', JSON.stringify(r));
    }
  }
};
