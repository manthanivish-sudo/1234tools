/**
 * Engagement Rate Calculator (/social/engagement-rate-calculator/).
 *
 * window.SocialER.compute(inputs) is pure (the tests and the claims run it
 * in Node); the page mounts on the AIImg runtime like the other /social/
 * tools. The figures are totals over `posts` posts — one post by default:
 *
 *   engagements          = likes + comments + shares + saves
 *   by followers         = engagements ÷ posts ÷ followers × 100
 *   by reach             = engagements ÷ reach × 100           (reach summed over the posts)
 *   by impressions       = engagements ÷ impressions × 100     (likewise)
 *   likes and comments   = (likes + comments) ÷ posts ÷ followers × 100
 *   per post             = engagements ÷ posts
 *
 * No benchmark is given: there is no "good rate" here, because the
 * published ones disagree with each other and depend on the network, the
 * account size and the formula.
 */
(function () {
  'use strict';
  const W = window;
  const FIELDS = [
    { key: 'likes', label: 'Likes', hint: 'Reactions count here on Facebook and LinkedIn.' },
    { key: 'comments', label: 'Comments', hint: 'Replies on X and Threads.' },
    { key: 'shares', label: 'Shares', hint: 'Shares, sends, reposts or retweets.' },
    { key: 'saves', label: 'Saves', hint: 'Saves or bookmarks. Leave at 0 where a platform does not show them.' },
    { key: 'followers', label: 'Followers', hint: 'At the time of the posts.' },
    { key: 'reach', label: 'Reach', hint: 'Accounts that saw the posts, added up. Optional.' },
    { key: 'impressions', label: 'Impressions or views', hint: 'Times the posts were shown, added up. Optional.' },
    { key: 'posts', label: 'Number of posts', hint: 'How many posts the figures above add up. 1 for a single post.' }
  ];
  const OPTIONAL = new Set(['reach', 'impressions']);

  /** '1,234' → 1234; '' → null; anything else → NaN. */
  function parse(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().replace(/[,\s_]/g, '');
    if (s === '') return null;
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }

  /**
   * inputs: { likes, comments, shares, saves, followers, reach, impressions, posts }
   * as numbers or strings. Returns { ok, errors: [{ key, message }], notes: [...],
   * engagements, results: [{ id, label, value (number|null), formula, worked, why }] }.
   */
  function compute(inputs) {
    const v = {}; const errors = []; const notes = [];
    for (const f of FIELDS) {
      const raw = inputs ? inputs[f.key] : undefined;
      let n = parse(raw);
      if (n === null) n = f.key === 'posts' ? 1 : (OPTIONAL.has(f.key) || f.key === 'followers') ? null : 0;
      if (Number.isNaN(n)) { errors.push({ key: f.key, message: f.label + ' must be a number.' }); continue; }
      if (n !== null && n < 0) { errors.push({ key: f.key, message: f.label + ' cannot be negative.' }); continue; }
      if (n !== null && !Number.isInteger(n)) { errors.push({ key: f.key, message: f.label + ' is a count: use a whole number.' }); continue; }
      v[f.key] = n;
    }
    if (v.posts === 0) errors.push({ key: 'posts', message: 'Number of posts must be at least 1.' });
    if (errors.length) return { ok: false, errors, notes, results: [] };

    const eng = v.likes + v.comments + v.shares + v.saves;
    const n = v.posts;
    const pct = (a, b) => (b ? (a / b) * 100 : null);
    const fl = v.followers;
    const per = n > 1 ? ' ÷ ' + fmtN(n) + ' posts' : '';
    const res = [];
    const whyNoFollowers = fl === null ? 'Enter your followers.' : fl === 0 ? 'Followers is 0: there is nothing to divide by.' : '';
    res.push({
      id: 'followers', label: 'Engagement rate by followers',
      formula: '(likes + comments + shares + saves)' + (n > 1 ? ' ÷ posts' : '') + ' ÷ followers × 100',
      value: fl ? pct(eng / n, fl) : null, why: whyNoFollowers,
      worked: fl ? fmtN(eng) + per + ' ÷ ' + fmtN(fl) + ' × 100' : ''
    });
    const whyReach = v.reach === null ? 'Enter reach to see this one.' : v.reach === 0 ? 'Reach is 0: there is nothing to divide by.' : '';
    res.push({
      id: 'reach', label: 'Engagement rate by reach',
      formula: '(likes + comments + shares + saves) ÷ reach × 100',
      value: v.reach ? pct(eng, v.reach) : null, why: whyReach,
      worked: v.reach ? fmtN(eng) + ' ÷ ' + fmtN(v.reach) + ' × 100' : ''
    });
    const whyImp = v.impressions === null ? 'Enter impressions or views to see this one.' : v.impressions === 0 ? 'Impressions is 0: there is nothing to divide by.' : '';
    res.push({
      id: 'impressions', label: 'Engagement rate by impressions',
      formula: '(likes + comments + shares + saves) ÷ impressions × 100',
      value: v.impressions ? pct(eng, v.impressions) : null, why: whyImp,
      worked: v.impressions ? fmtN(eng) + ' ÷ ' + fmtN(v.impressions) + ' × 100' : ''
    });
    res.push({
      id: 'likes-comments', label: 'Likes and comments by followers',
      formula: '(likes + comments)' + (n > 1 ? ' ÷ posts' : '') + ' ÷ followers × 100',
      value: fl ? pct((v.likes + v.comments) / n, fl) : null, why: whyNoFollowers,
      worked: fl ? fmtN(v.likes + v.comments) + per + ' ÷ ' + fmtN(fl) + ' × 100' : ''
    });
    res.push({
      id: 'per-post', label: 'Average engagements per post',
      formula: '(likes + comments + shares + saves) ÷ posts',
      value: eng / n, unit: 'count', why: '',
      worked: fmtN(eng) + ' ÷ ' + fmtN(n)
    });

    if (fl !== null && v.reach !== null && fl > 0 && v.reach > fl * n) {
      notes.push('Reach is higher than followers' + (n > 1 ? ' times posts' : '') + '. That is allowed: reach counts every account that saw the post, including people who do not follow you, so a shared or recommended post can reach more people than you have followers. It is why the rate by reach can be lower than the rate by followers.');
    }
    if (v.reach !== null && v.impressions !== null && v.impressions > 0 && v.impressions < v.reach) {
      notes.push('Impressions are lower than reach. Impressions count every time a post was shown, so they are normally at least the reach; check the two figures come from the same posts and dates.');
    }
    if (v.reach !== null && v.reach > 0 && eng > v.reach) {
      notes.push('There are more engagements than accounts reached. One person can like, comment, share and save, so it can happen, but check the reach figure.');
    }
    return { ok: true, errors, notes, values: v, engagements: eng, results: res };
  }
  function fmtN(n) { return Number(n).toLocaleString('en-GB'); }
  /** A rate to d decimal places, as the page prints it. */
  function fmtRate(x, d) { return x === null || x === undefined ? '—' : x.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'; }
  function fmtCount(x, d) { return x.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: d }); }

  /** The results as plain text, one line each, for the clipboard. */
  function asText(r, d) {
    if (!r.ok) return '';
    const lines = r.results.map((x) => x.label + ': ' + (x.value === null ? 'n/a' : x.unit === 'count' ? fmtCount(x.value, d) : fmtRate(x.value, d)) + (x.worked ? '  (' + x.worked + ')' : ''));
    lines.unshift('Engagements: ' + fmtN(r.engagements));
    return lines.join('\n');
  }

  W.SocialER = { compute, parse, fmtRate, fmtCount, asText, FIELDS };

  /* ================================================================== */
  /* the page                                                           */
  /* ================================================================== */
  const A = W.AIImg;
  if (!A || !A.tools) return;
  const SK = W.SocialKit;
  const { el, button } = A;
  const KEY = '1234tools-social-engagement-rate-v1';

  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const store = SK ? SK.store : { get: (k, d) => d, set: () => false };
    const set = Object.assign({ decimals: 2 }, store.get(KEY, {}) || {});
    if (![0, 1, 2, 3].includes(Number(set.decimals))) set.decimals = 2;

    const wrap = el('div', 'aiimg social-er');
    const form = el('div', 'social-er-form');
    const inputs = {};
    for (const f of FIELDS) {
      const i = el('input', 'control');
      i.id = 'er-' + f.key; i.type = 'text'; i.inputMode = 'numeric'; i.autocomplete = 'off';
      i.placeholder = f.key === 'posts' ? '1' : OPTIONAL.has(f.key) ? 'optional' : '0';
      inputs[f.key] = i;
      form.appendChild(A.field(f.label, i, f.hint));
    }
    const dec = A.select('er-decimals', [['0', 'Whole numbers'], ['1', '1 decimal place'], ['2', '2 decimal places'], ['3', '3 decimal places']], String(set.decimals));
    const exampleBtn = button('Try an example', 'btn-ghost', () => { fill({ likes: 412, comments: 38, shares: 17, saves: 55, followers: 12400, reach: 9850, impressions: 14200, posts: 1 }); });
    const clearBtn = button('Clear', 'btn-ghost', () => { fill({}); });
    const copyBtn = button('Copy results', 'btn-primary', async () => {
      const ok = await SK.copy(asText(compute(read()), Number(dec.value)));
      copyBtn.textContent = ok ? 'Copied' : 'Copy failed';
      setTimeout(() => { copyBtn.textContent = 'Copy results'; }, 1600);
    });
    const row = el('div', 'aiimg-row'); row.append(exampleBtn, clearBtn, copyBtn);
    const errBox = el('div', 'io-msg'); errBox.setAttribute('role', 'alert');
    const total = el('p', 'social-er-total');
    const out = el('div', 'social-er-results'); out.setAttribute('aria-live', 'polite');
    const noteBox = el('div', 'social-er-notes');
    const side = el('div', 'social-er-side');
    side.append(A.field('Show rates to', dec), row, errBox, total, out, noteBox);
    wrap.append(form, side);
    io.appendChild(wrap);

    const read = () => { const o = {}; for (const k in inputs) o[k] = inputs[k].value; return o; };
    function fill(o) { for (const k in inputs) inputs[k].value = o[k] === undefined ? '' : String(o[k]); update(); }

    function update() {
      const d = Number(dec.value);
      const r = compute(read());
      for (const k in inputs) inputs[k].removeAttribute('aria-invalid');
      if (!r.ok) {
        errBox.className = 'io-msg is-error';
        errBox.textContent = r.errors.map((e) => e.message).join(' ');
        r.errors.forEach((e) => inputs[e.key].setAttribute('aria-invalid', 'true'));
        out.replaceChildren(); total.textContent = ''; noteBox.replaceChildren();
        return r;
      }
      errBox.className = 'io-msg'; errBox.textContent = '';
      total.textContent = 'Engagements: ' + fmtN(r.engagements) + ' (likes + comments + shares + saves)';
      out.replaceChildren(...r.results.map((x) => {
        const card = el('div', 'social-er-card' + (x.value === null ? ' is-empty' : ''));
        card.dataset.formula = x.id;
        card.append(el('span', 'social-er-label', x.label),
          el('strong', 'social-er-value', x.value === null ? '—' : x.unit === 'count' ? fmtCount(x.value, d) : fmtRate(x.value, d)),
          el('code', 'social-er-formula', x.formula));
        if (x.worked) card.appendChild(el('span', 'social-er-worked', '= ' + x.worked));
        if (x.why) card.appendChild(el('span', 'social-er-why', x.why));
        return card;
      }));
      noteBox.replaceChildren(...r.notes.map((t) => el('p', 'field-hint social-er-note', t)));
      return r;
    }
    for (const k in inputs) inputs[k].addEventListener('input', update);
    dec.addEventListener('change', () => { set.decimals = Number(dec.value); store.set(KEY, { decimals: set.decimals }); update(); });

    /* ?likes=…&followers=… fill the form, the way the calculators take a link */
    const start = {};
    try { const q = new URLSearchParams(location.search); FIELDS.forEach((f) => { if (q.has(f.key)) start[f.key] = q.get(f.key); }); } catch (e) { /* none */ }
    fill(start);
    return { update, compute, inputs };
  }

  A.tools['engagement-rate-calculator'] = { mount };
})();
