/* 1234Tools Promotion Desk UI. Plain JS, no dependencies, served by desk.js on 127.0.0.1.
   Nothing here posts anywhere: "Open composer" is a plain link to a prefilled page the
   owner finishes by hand, and every log entry is written by the owner's own click. */
(function () {
  'use strict';

  /* ------------------------------------------------------------ helpers */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** h('div', {class: 'x', onclick: fn}, child, 'text', [more]) - builds DOM, never parses HTML. */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (let i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach((x) => append(el, x)); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  function glyph(id) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'gl');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '/icons.svg#' + id);
    svg.appendChild(use);
    return svg;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  async function api(path, body) {
    const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    const res = await fetch(path, opt);
    const j = await res.json().catch(() => ({ error: 'Bad response' }));
    if (!res.ok || j.error) throw new Error(j.error || ('HTTP ' + res.status));
    return j;
  }
  function qs(o) { return Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&'); }

  let toastT = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 1800);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = h('textarea', { style: 'position:fixed;left:-9999px' }); ta.value = text;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    toast('Copied');
  }
  function ago(iso) {
    if (!iso) return '';
    const d = (Date.now() - new Date(iso)) / 1000;
    if (d < 3600) return Math.max(1, Math.round(d / 60)) + ' min ago';
    if (d < 86400) return Math.round(d / 3600) + ' h ago';
    return Math.round(d / 86400) + ' d ago';
  }

  /* Character counting mirrors lint.js count(). */
  function countText(text, mode) {
    const s = String(text || '');
    if (mode === 'x') return Array.from(s.replace(/https?:\/\/\S+/g, 'x'.repeat(23))).length;
    if (mode === 'graphemes') return window.Intl && Intl.Segmenter ? Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)).length : Array.from(s).length;
    if (mode === 'words') return s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').split(/\s+/).filter((w) => /[A-Za-z0-9£₹]/.test(w)).length;
    return Array.from(s).length;
  }

  /* Mirrors venues.js composerForDraft(): the human finishes and posts. */
  function composerHref(venue, title, text, url, linkInReply) {
    if (!venue || !venue.submitUrl) return '';
    const takesText = /\{text\}/.test(venue.submitUrl);
    if (linkInReply) { if (!takesText) return ''; url = ''; }
    if (/\{url\}/.test(venue.submitUrl) && url) {
      text = text.split(url).join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
    }
    const map = { title: title || '', text, url: url || '' };
    return venue.submitUrl.replace(/\{(\w+)\}/g, (m, k) => encodeURIComponent(map[k] != null ? map[k] : ''));
  }

  /* ------------------------------------------------------------- state */
  const S = {
    tools: [], byPath: {},
    draft: { tool: '', venue: '', template: '', variant: 0, question: '', qurl: '', result: '' },
    lastDraft: null, venues: null, oppTool: '', kitTool: '',
  };

  /* -------------------------------------------------------------- tabs */
  function showTab(name) {
    $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('main .tab').forEach((s) => { s.hidden = s.dataset.tab !== name; });
    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
    if (name === 'today') loadPlan();
    if (name === 'venues') loadVenues();
    if (name === 'log') loadLog();
    if (name === 'kits') loadKits();
    if (name === 'reels') loadReels();
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  /* ------------------------------------------------------------ picker */
  function makePicker(input, list, onPick) {
    let items = [];
    let on = -1;
    function render() {
      const q = input.value.trim().toLowerCase();
      clear(list);
      if (!q) { list.hidden = true; return; }
      const words = q.split(/\s+/);
      items = S.tools.filter((t) => {
        const hay = (t.title + ' ' + t.keywords.join(' ') + ' ' + t.path + ' ' + t.sectionName).toLowerCase();
        return words.every((w) => hay.includes(w));
      }).slice(0, 14);
      on = items.length ? 0 : -1;
      items.forEach((t, i) => list.appendChild(h('li', { class: i === on ? 'on' : '', 'data-path': t.path, onmousedown: (e) => { e.preventDefault(); pick(t); } }, glyph(t.glyph), h('span', { text: t.title }), h('span', { class: 'sec', text: t.sectionName }))));
      list.hidden = !items.length;
    }
    function pick(t) { input.value = t.title; list.hidden = true; onPick(t); }
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 150));
    input.addEventListener('keydown', (e) => {
      if (list.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        on = Math.max(0, Math.min(items.length - 1, on + (e.key === 'ArrowDown' ? 1 : -1)));
        $$('li', list).forEach((li, i) => li.classList.toggle('on', i === on));
      } else if (e.key === 'Enter' && on >= 0) { e.preventDefault(); pick(items[on]); }
    });
    return { set(path) { const t = S.byPath[path]; if (t) input.value = t.title; } };
  }

  /* ------------------------------------------------------------- TODAY */
  async function loadPlan() {
    const box = clear($('#plan-tasks'));
    box.appendChild(h('p', { class: 'muted' }, h('span', { class: 'spinner' }), 'Building today\'s plan…'));
    let p;
    try { p = await api('/api/plan'); } catch (e) { clear(box).appendChild(h('p', { class: 'banner wait', text: e.message })); return; }
    $('#plan-title').textContent = p.weekday + ' · ' + p.date;
    $('#plan-work').textContent = p.routine.work + '  Linked posts today: ' + p.used + ' of ' + p.cap + '.';
    $('#today-line').textContent = p.weekday + ': ' + p.routine.work.split(':')[0] + ' · ' + p.used + '/' + p.cap + ' linked · a human publishes every post';
    clear(box);
    if (!p.tasks.length) box.appendChild(h('p', { class: 'muted', text: 'Nothing planned.' }));
    p.tasks.forEach((t) => box.appendChild(taskCard(t)));
  }

  function taskCard(t) {
    const cls = 'task' + (t.done ? ' done' : '') + (t.skipped ? ' skipped' : '');
    if (t.kind === 'info') return h('div', { class: cls }, h('div', { class: 'task-head' }, h('span', { class: 'badge kind', text: 'note' })), h('p', { class: 'what', text: t.what }));
    const head = h('div', { class: 'task-head' },
      h('span', { class: 'badge ' + (t.kind === 'help' ? 'help' : 'kind'), text: t.kind === 'help' ? 'help only' : 'linked' }),
      h('h3', { text: t.venueName }),
      t.toolTitle ? h('span', { class: 'muted', text: '· ' + t.toolTitle }) : null,
      t.template ? h('span', { class: 'badge', text: t.template }) : null,
      t.verifyFirst ? h('span', { class: 'badge verify', 'data-verify': '1', text: 'verify rules first' }) : null,
      t.status ? h('span', { class: 'badge ' + (t.status.ok ? 'ok' : 'wait'), text: t.status.ok ? 'ok today' : 'wait' }) : null,
      t.done ? h('span', { class: 'badge ok', text: 'done' }) : null,
      t.skipped ? h('span', { class: 'badge', text: 'skipped' }) : null);
    const body = [];
    if (t.what) body.push(h('p', { class: 'what', text: t.what }));
    if (t.status && !t.status.ok) body.push(h('div', { class: 'banner wait' }, 'Not today:', h('ul', null, t.status.reasons.map((r) => h('li', { text: r })))));
    if (t.draft) {
      for (const p of t.draft.parts) {
        body.push(h('div', { class: 'part' },
          h('div', { class: 'part-head' }, h('span', { class: 'lab', text: p.label }), h('span', { class: 'count' + (p.limit && p.chars > p.limit ? ' over' : ''), text: p.chars + (p.limit ? ' / ' + p.limit : '') }),
            h('button', { class: 'ghost copy', onclick: () => copyText(p.text) }, 'Copy')),
          h('textarea', { rows: Math.min(10, Math.max(2, Math.ceil(p.text.length / 90) + (p.text.match(/\n/g) || []).length)), readonly: true }, p.text)));
      }
    }
    const actions = h('div', { class: 'actions' });
    if (t.composerUrl) actions.appendChild(h('a', { class: 'btn gold', href: t.composerUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Open composer'));
    if (t.searchUrl) actions.appendChild(h('a', { class: 'btn', href: t.searchUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Search the venue'));
    if (t.kind === 'help' && t.toolPath) actions.appendChild(h('button', { class: 'btn', onclick: () => { setOppTool(t.toolPath); showTab('opps'); } }, 'Find questions'));
    if (t.kind === 'linked') actions.appendChild(h('button', { class: 'btn', onclick: () => { openDraft({ tool: t.toolPath, venue: t.venueId, template: t.template, variant: t.variant }); } }, 'Edit in Draft'));
    if (!t.done && !t.skipped) {
      actions.appendChild(h('button', { class: 'btn', onclick: () => doneTask(t) }, 'Done…'));
      actions.appendChild(h('button', { class: 'ghost', onclick: () => skipTask(t) }, 'Skip'));
    }
    body.push(actions);
    if (t.composerNote) body.push(h('p', { class: 'muted small', text: t.composerNote }));
    if (t.redLines) body.push(h('details', { class: 'redlines' }, h('summary', { text: 'Red lines' }), h('ul', null, t.redLines.map((r) => h('li', { text: r })))));
    return h('div', { class: cls, 'data-task': t.id }, head, body);
  }

  async function doneTask(t) {
    const url = window.prompt(t.kind === 'help' ? 'Link to your reply (optional):' : 'Paste the URL of the post you published:', '');
    if (url === null) return;
    await api('/api/log', { venueId: t.venueId, toolPath: t.toolPath, template: t.template, url: url.trim() || undefined, kind: t.kind === 'help' ? 'help' : 'post', text: t.draft ? t.draft.text : undefined, note: 'today ' + t.id });
    toast('Logged');
    loadPlan();
  }
  async function skipTask(t) {
    await api('/api/log', { venueId: t.venueId || 'none', toolPath: t.toolPath, template: t.template, kind: 'skip', note: t.id });
    loadPlan();
  }
  $('#plan-refresh').addEventListener('click', loadPlan);

  /* ------------------------------------------------------------- DRAFT */
  const dPicker = makePicker($('#d-tool'), $('#d-tool-list'), (t) => { S.draft.tool = t.path; S.draft.variant = 0; afterToolChange(); });

  function openDraft(o) {
    Object.assign(S.draft, { tool: '', venue: '', template: '', variant: 0, question: '', qurl: '', result: '' }, o);
    $('#d-question').value = S.draft.question || '';
    $('#d-qurl').value = S.draft.qurl || '';
    $('#d-result').value = S.draft.result || '';
    if (S.draft.question) $('#d-extra').open = true;
    showTab('draft');
    if (S.draft.tool) { dPicker.set(S.draft.tool); afterToolChange(); }
    else { $('#d-tool').focus(); $('#d-tool-chosen').textContent = S.draft.venue ? 'Pick the tool that answers this question.' : ''; }
  }

  async function afterToolChange() {
    const t = S.byPath[S.draft.tool];
    const chosen = clear($('#d-tool-chosen'));
    if (t) append(chosen, [glyph(t.glyph), ' ', h('b', { text: t.title }), ' · ' + t.io + ' · ' + (t.pricing === 'freemium' ? 'AI, 10 free runs a month' : 'free, in the browser')]);
    const sel = $('#d-venue');
    clear(sel).appendChild(h('option', { value: '', text: 'Loading venues…' }));
    const f = await api('/api/fit?' + qs({ tool: S.draft.tool }));
    clear(sel);
    sel.appendChild(h('option', { value: '', text: '(no venue: generic copy)' }));
    for (const v of f.venues) sel.appendChild(h('option', { value: v.id, text: v.name + ' · ' + v.kind + ' · ' + v.risk + ' risk' + (v.status.ok ? '' : ' · wait') + (v.verifyFirst ? ' · verify rules first' : '') + (v.autoSuggest ? '' : ' · manual only') }));
    const ids = f.venues.map((v) => v.id);
    if (S.draft.venue && !ids.includes(S.draft.venue)) {
      // a venue from a finder result that is not in the tool's fit list: keep it selectable
      sel.appendChild(h('option', { value: S.draft.venue, text: S.draft.venue + ' (from the finder)' }));
      ids.push(S.draft.venue);
    }
    if (!S.draft.venue || !ids.includes(S.draft.venue)) S.draft.venue = f.venues.length ? f.venues[0].id : '';
    sel.value = S.draft.venue;
    await loadDraft();
  }

  async function loadDraft() {
    if (!S.draft.tool) return;
    const d = S.draft;
    let r;
    try {
      r = await api('/api/draft?' + qs({ tool: d.tool, venue: d.venue, template: d.template, variant: d.variant, question: d.question, qurl: d.qurl, result: d.result }));
    } catch (e) { clear($('#d-parts')).appendChild(h('p', { class: 'banner wait', text: e.message })); return; }
    S.lastDraft = r;
    d.template = r.template;
    $('#d-vnum').textContent = String(r.variant);
    // template list: the venue's first, then the rest
    const ts = clear($('#d-template'));
    const own = r.venue ? r.venue.templates : [];
    const g1 = h('optgroup', { label: r.venue ? 'For this venue' : 'Templates' });
    const g2 = h('optgroup', { label: 'All templates' });
    for (const t of r.allTemplates) (own.includes(t.id) ? g1 : g2).appendChild(h('option', { value: t.id, text: t.label + ' (' + t.id + ')' }));
    if (g1.children.length) ts.appendChild(g1);
    ts.appendChild(g2);
    ts.value = r.template;
    renderVenueInfo(r.venue);
    renderDraft(r);
  }

  function renderVenueInfo(v) {
    const box = clear($('#d-venue-info'));
    if (!v) return;
    const st = S.lastDraft.status;
    if (v.verifyFirst) box.appendChild(h('p', { class: 'banner verifyb', id: 'd-verify' }, h('span', { class: 'badge verify', text: 'verify rules first' }), ' The register built this venue\'s rules from memory or could not capture them. Open the rules before your first post here.'));
    if (v.risk === 'high') box.appendChild(h('p', { class: 'banner wait', text: 'High-risk venue: never suggested in Today. Post here only deliberately, after reading the rules.' }));
    box.appendChild(h('dl', null,
      h('dt', { text: 'Kind' }), h('dd', null, h('span', { class: 'badge kind', text: v.kind }), ' ', h('span', { class: 'badge ' + v.risk, text: v.risk + ' risk' })),
      h('dt', { text: 'Self-promo' }), h('dd', { text: v.selfPromo + (v.promoThread ? ' · ' + v.promoThread : '') }),
      h('dt', { text: 'Links' }), h('dd', { text: v.linkPolicy }),
      h('dt', { text: 'Cadence' }), h('dd', { text: 'every ' + v.cadenceDays + ' days, at most ' + v.maxPerWeek + ' a week' }),
      h('dt', { text: 'Today' }), h('dd', null, h('span', { class: 'badge ' + (st.ok ? 'ok' : 'wait'), text: st.ok ? 'ok' : 'wait' })),
      h('dt', { text: 'Best times' }), h('dd', { text: (v.bestTimesUTC || []).join(', ') || '-' }),
      h('dt', { text: 'Rules' }), h('dd', null, v.rulesUrl ? h('a', { href: v.rulesUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Read the rules' }) : '-'),
      h('dt', { text: 'Tone' }), h('dd', { text: v.tone || '-' })));
    if (v.notes) box.appendChild(h('div', { class: 'notes', text: v.notes }));
    if (v.verifiedHow) box.appendChild(h('p', { class: 'muted small', text: 'Verified: ' + v.verifiedHow }));
  }

  function partCount(p, text) { return countText(text, p.countMode); }

  function renderDraft(r) {
    const st = r.status;
    const statusBox = clear($('#d-status'));
    if (st.ok) statusBox.appendChild(h('div', { class: 'banner ok' }, 'OK to post here today.', st.warnings && st.warnings.length ? h('ul', null, st.warnings.map((w) => h('li', { text: w }))) : null));
    else statusBox.appendChild(h('div', { class: 'banner wait' }, 'Not today:', h('ul', null, st.reasons.map((x) => h('li', { text: x }))), st.nextAt ? h('div', { class: 'small', text: 'Next allowed: ' + new Date(st.nextAt).toLocaleString() }) : null));
    $('#d-override-wrap').hidden = st.ok;
    $('#d-override').checked = false;

    const parts = clear($('#d-parts'));
    for (const p of r.draft.parts) {
      const count = h('span', { class: 'count' + (p.limit && p.chars > p.limit ? ' over' : ''), text: p.chars + (p.limit ? ' / ' + p.limit : '') + (p.countMode && p.countMode !== 'chars' ? ' ' + p.countMode : ' chars') });
      const ta = h('textarea', { 'data-key': p.key, rows: Math.min(14, Math.max(2, Math.ceil(p.text.length / 80) + (p.text.match(/\n/g) || []).length)) });
      ta.value = p.text;
      const copyBtn = h('button', { class: 'ghost copy', 'data-copy': p.key, onclick: () => copyText(ta.value) }, 'Copy');
      ta.addEventListener('input', () => {
        const n = partCount(p, ta.value);
        count.textContent = n + (p.limit ? ' / ' + p.limit : '') + (p.countMode && p.countMode !== 'chars' ? ' ' + p.countMode : ' chars');
        count.classList.toggle('over', !!(p.limit && n > p.limit));
        relint();
        updateComposer();
      });
      parts.appendChild(h('div', { class: 'part', 'data-part': p.key }, h('div', { class: 'part-head' }, h('span', { class: 'lab', text: p.label }), count, copyBtn), ta));
    }
    renderLint(r.draft.errors, r.draft.warnings);
    updateComposer();
    const th = $('#d-thread');
    th.hidden = !r.threadUrl; if (r.threadUrl) th.href = r.threadUrl;
    $('#d-composer-note').textContent = r.composerNote || '';
    const rl = clear($('#d-redlines ul'));
    for (const x of r.redLines) rl.appendChild(h('li', { text: x }));
    applyBlock();
  }

  function renderLint(errors, warnings) {
    const box = clear($('#d-lint'));
    if (!errors.length && !warnings.length) { box.appendChild(h('p', { class: 'muted small', text: 'Lint: clean.' })); return; }
    box.appendChild(h('ul', { class: 'lint' },
      errors.map((e) => h('li', { class: 'err', text: '✖ ' + (e.part ? '[' + e.part + '] ' : '') + e.msg + (e.match ? ' — "' + e.match + '"' : '') })),
      warnings.map((w) => h('li', { class: 'warn', text: '! ' + (w.part ? '[' + w.part + '] ' : '') + w.msg }))));
  }

  let lintT = 0;
  function relint() {
    clearTimeout(lintT);
    lintT = setTimeout(async () => {
      const r = S.lastDraft; if (!r) return;
      const errors = []; const warnings = [];
      for (const p of r.draft.parts) {
        if (/^(url|clean)$/.test(p.key)) continue;
        const ta = $('textarea[data-key="' + p.key + '"]');
        const res = await api('/api/lint', { text: ta.value, pricing: p.key === 'instagram' || r.template === 'bio' ? 'free' : r.tool.pricing, section: r.template === 'bio' ? '' : r.tool.section, limit: p.limit || undefined });
        res.errors.forEach((e) => errors.push(Object.assign({ part: p.key }, e)));
        res.warnings.forEach((w) => warnings.push(Object.assign({ part: p.key }, w)));
      }
      renderLint(errors, warnings);
    }, 350);
  }

  function currentText(key) { const ta = $('textarea[data-key="' + key + '"]'); return ta ? ta.value : ''; }

  function updateComposer() {
    const r = S.lastDraft; const a = $('#d-composer');
    if (!r || !r.composerUrl) { a.hidden = true; a.removeAttribute('href'); return; }
    const main = r.draft.parts.find((p) => p.text === r.draft.text) || r.draft.parts[0];
    const title = r.draft.parts.find((p) => p.key === 'title');
    const href = composerHref(r.venue, title ? currentText('title') : r.tool.title, currentText(main.key), r.draft.url, r.draft.linkInReply);
    a.hidden = !href;
    if (href) a.href = href;
  }

  function applyBlock() {
    const r = S.lastDraft; if (!r) return;
    const blocked = !r.status.ok && !$('#d-override').checked;
    $$('#d-parts [data-copy]').forEach((b) => { b.disabled = blocked; });
    $('#d-composer').classList.toggle('disabled', blocked);
  }
  $('#d-override').addEventListener('change', applyBlock);

  $('#d-venue').addEventListener('change', (e) => { S.draft.venue = e.target.value; S.draft.template = ''; S.draft.variant = 0; loadDraft(); });
  $('#d-template').addEventListener('change', (e) => { S.draft.template = e.target.value; loadDraft(); });
  $('#d-vprev').addEventListener('click', () => { S.draft.variant = Math.max(0, S.draft.variant - 1); loadDraft(); });
  $('#d-vnext').addEventListener('click', () => { S.draft.variant += 1; loadDraft(); });
  $('#d-apply').addEventListener('click', () => {
    S.draft.question = $('#d-question').value.trim(); S.draft.qurl = $('#d-qurl').value.trim(); S.draft.result = $('#d-result').value.trim();
    loadDraft();
  });
  $('#d-logpost').addEventListener('click', async () => {
    const r = S.lastDraft;
    if (!r || !r.venue) { toast('Pick a venue first'); return; }
    const url = window.prompt('Paste the URL of the post you published:', '');
    if (url === null) return;
    const main = r.draft.parts.find((p) => p.text === r.draft.text) || r.draft.parts[0];
    await api('/api/log', { venueId: r.venue.id, toolPath: r.tool.path, template: r.template, url: url.trim() || undefined, kind: 'post', text: currentText(main.key), thread: S.draft.qurl || undefined, override: !r.status.ok || undefined });
    toast('Logged');
    loadDraft();
  });

  /* ----------------------------------------------------- OPPORTUNITIES */
  const oPicker = makePicker($('#o-tool'), $('#o-tool-list'), (t) => { S.oppTool = t.path; $('#o-aud').value = ''; });
  function setOppTool(path) { S.oppTool = path; oPicker.set(path); $('#o-aud').value = ''; }
  $('#o-aud').addEventListener('change', (e) => { if (e.target.value) { S.oppTool = ''; $('#o-tool').value = ''; } });

  $('#o-go').addEventListener('click', async () => {
    const aud = $('#o-aud').value;
    if (!S.oppTool && !aud) { toast('Pick a tool or an audience'); return; }
    const status = clear($('#o-status'));
    status.appendChild(h('p', null, h('span', { class: 'spinner' }), 'Searching… Reddit allows about ten searches a minute, so this can take a minute.'));
    const box = clear($('#o-results'));
    let r;
    try { r = await api('/api/find?' + qs(S.oppTool ? { tool: S.oppTool } : { audience: aud })); }
    catch (e) { clear(status).appendChild(h('p', { class: 'banner wait', text: e.message })); return; }
    clear(status).appendChild(h('p', { class: 'small', text: 'Searched ' + r.venues.length + ' venues for: ' + r.queries.join(' | ') + '. ' + r.items.length + ' open questions.' }));
    if (r.errors.length) status.appendChild(h('details', { class: 'small' }, h('summary', { text: r.errors.length + ' venue(s) did not answer' }), h('ul', null, r.errors.map((e) => h('li', { text: e })))));
    if (!r.items.length) box.appendChild(h('p', { class: 'muted', text: 'No open questions in the window. Try another tool, or come back tomorrow.' }));
    for (const it of r.items) {
      box.appendChild(h('div', { class: 'opp' },
        h('a', { class: 't', href: it.url, target: '_blank', rel: 'noopener noreferrer', text: it.title }),
        h('div', { class: 'meta' },
          h('span', { class: 'score', text: it.matchScore + '%' }),
          h('span', { text: it.venueName || it.venueId }),
          h('span', { text: ago(it.created) }),
          it.score != null ? h('span', { text: it.score + ' points' }) : null,
          it.comments != null ? h('span', { text: it.comments + ' replies' }) : null,
          h('span', { class: 'badge', text: it.suggestedTemplate }),
          h('button', { class: 'btn', onclick: () => openDraft({ tool: r.tool || '', venue: it.venueId, template: it.suggestedTemplate, question: it.title, qurl: it.url }) }, 'Draft answer'))));
    }
  });

  /* -------------------------------------------------------------- KITS */
  makePicker($('#k-tool'), $('#k-tool-list'), (t) => { S.kitTool = t.path; });
  function kitImages(slug, files, stamp) {
    return h('div', { class: 'kitimgs' }, files.filter((f) => /\.png$/.test(f)).map((f) => h('figure', null,
      h('a', { href: '/kits/' + encodeURIComponent(slug) + '/' + f, target: '_blank', rel: 'noopener' }, h('img', { src: '/kits/' + encodeURIComponent(slug) + '/' + f + '?t=' + stamp, alt: f, loading: 'lazy' })),
      h('figcaption', { text: f }))));
  }
  function kitCard(k) {
    return h('div', { class: 'card' },
      h('div', { class: 'head-row' }, h('h3', { text: k.title, style: 'margin:0' }), h('span', { class: 'muted small', text: k.at ? new Date(k.at).toLocaleString() : '' })),
      h('p', { class: 'small' }, h('code', { text: k.dir })),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: async () => { try { await api('/api/reveal', { slug: k.slug }); toast('Opened in Explorer'); } catch (e) { toast(e.message); } } }, 'Open folder'),
        h('a', { class: 'btn', href: '/kits/' + encodeURIComponent(k.slug) + '/kit.md', target: '_blank', rel: 'noopener' }, 'kit.md'),
        h('button', { class: 'ghost', onclick: () => copyText(k.dir) }, 'Copy path')),
      kitImages(k.slug, k.files, Date.now()));
  }
  async function loadKits() {
    const r = await api('/api/kits');
    $('#k-dir').textContent = r.dir;
    const box = clear($('#k-list'));
    if (!r.kits.length) box.appendChild(h('p', { class: 'muted', text: 'No kits yet.' }));
    r.kits.forEach((k) => box.appendChild(kitCard(k)));
  }
  $('#k-go').addEventListener('click', async () => {
    if (!S.kitTool) { toast('Pick a tool'); return; }
    const box = clear($('#k-result'));
    box.appendChild(h('p', null, h('span', { class: 'spinner' }), 'Rendering four images and kit.md…'));
    try {
      const r = await api('/api/kit', { tool: S.kitTool });
      clear(box).appendChild(kitCard({ slug: r.slug, title: S.byPath[S.kitTool].title, dir: r.dir, files: r.files.map((f) => f.file || f.path.split(/[\\/]/).pop()), at: new Date().toISOString() }));
      box.firstChild.setAttribute('id', 'k-new');
      loadKits();
    } catch (e) { clear(box).appendChild(h('p', { class: 'banner wait', text: e.message })); }
  });

  /* ------------------------------------------------------------ VENUES */
  async function loadVenues() {
    if (!S.venues) {
      S.venues = await api('/api/venues');
      const kinds = [...new Set(S.venues.venues.map((v) => v.kind))].sort();
      kinds.forEach((k) => $('#v-kind').appendChild(h('option', { value: k, text: k })));
      (S.venues.meta.audienceVocabulary || []).forEach((a) => $('#v-aud').appendChild(h('option', { value: a, text: a })));
      (S.venues.meta.sectionSlugs || []).forEach((s) => $('#v-sec').appendChild(h('option', { value: s, text: s })));
      const ex = clear($('#v-excluded ul'));
      S.venues.excluded.forEach((x) => ex.appendChild(h('li', null, h('b', { text: x.name }), ' — ' + (x.why || ''))));
      $('#v-excluded summary').textContent = 'Excluded venues and why (' + S.venues.excluded.length + ')';
      const ins = clear($('#v-insights div'));
      S.venues.insights.forEach((x) => ins.appendChild(h('p', { class: 'insight' }, x.topic ? h('b', { text: x.topic.replace(/-/g, ' ') + ': ' }) : null, x.text)));
    }
    renderVenues();
  }
  function renderVenues() {
    const q = $('#v-q').value.trim().toLowerCase();
    const kind = $('#v-kind').value; const aud = $('#v-aud').value; const sec = $('#v-sec').value; const risk = $('#v-risk').value; const postOnly = $('#v-post').checked;
    const rows = S.venues.venues.filter((v) => (!q || (v.name + ' ' + v.id + ' ' + v.notes).toLowerCase().includes(q)) && (!kind || v.kind === kind) && (!aud || v.audiences.includes(aud)) && (!sec || v.sections.includes(sec)) && (!risk || v.risk === risk) && (!postOnly || v.isPost));
    const tb = clear($('#v-table tbody'));
    $('#v-count').textContent = rows.length + ' of ' + S.venues.venues.length + ' venues · register updated ' + (S.venues.meta.updated || '?');
    for (const v of rows) {
      const st = v.status;
      const tr = h('tr', { class: 'vrow' },
        h('td', null, h('a', { href: v.url, target: '_blank', rel: 'noopener noreferrer', text: v.name, onclick: (e) => e.stopPropagation() }), v.verifyFirst ? [' ', h('span', { class: 'badge verify', text: 'verify rules first' })] : null, (v.roles || []).includes('share') ? [' ', h('span', { class: 'badge', text: 'share bar' + (v.shareBar ? ': ' + v.shareBar : '') })] : null),
        h('td', null, h('span', { class: 'badge kind', text: v.kind })),
        h('td', null, h('span', { class: 'badge ' + v.risk, text: v.risk })),
        h('td', { text: v.selfPromo }), h('td', { text: v.linkPolicy }),
        h('td', { text: v.cadenceDays ? 'every ' + v.cadenceDays + ' d · ' + v.maxPerWeek + '/wk' : 'visitor share' }),
        h('td', { text: v.template }),
        h('td', null, st ? h('span', { class: 'badge ' + (st.ok ? 'ok' : 'wait'), text: st.ok ? 'ok' : 'wait', title: (st.reasons || []).join(' · ') }) : '-'));
      const detail = h('tr', { class: 'detail', hidden: true }, h('td', { colspan: 8 },
        v.notes ? h('p', { text: v.notes }) : null,
        h('p', { class: 'small' }, 'Audiences: ' + v.audiences.join(', ') + ' · Sections: ' + v.sections.join(', ') + ' · Templates: ' + v.templates.join(', ')),
        v.promoThread ? h('p', { class: 'small', text: 'Promo thread: ' + v.promoThread }) : null,
        v.verifiedHow ? h('p', { class: 'small muted', text: 'Verified: ' + v.verifiedHow }) : null,
        v.shareIntent ? h('p', { class: 'small', text: 'Share intent: ' + (v.shareIntent.submitUrl || '-') + (v.shareIntent.notes ? ' · ' + v.shareIntent.notes : '') }) : null,
        v.shareBarSections ? h('p', { class: 'small muted', text: 'Share bar on: ' + v.shareBarSections.join(', ') }) : null,
        h('p', { class: 'small' }, v.rulesUrl ? h('a', { href: v.rulesUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Rules' }) : null, v.estimatedReach ? ' · Reach: ' + v.estimatedReach : '', st && !st.ok ? ' · Waiting: ' + st.reasons.join(' · ') : '')));
      tr.addEventListener('click', () => { detail.hidden = !detail.hidden; });
      tb.appendChild(tr); tb.appendChild(detail);
    }
  }
  ['#v-q', '#v-kind', '#v-aud', '#v-sec', '#v-risk', '#v-post'].forEach((s) => $(s).addEventListener('input', () => S.venues && renderVenues()));

  /* --------------------------------------------------------------- LOG */
  async function loadLog() {
    const r = await api('/api/log?' + qs({ venue: $('#l-venue').value, tool: $('#l-tool').value.trim() }));
    $('#l-file').textContent = r.file;
    if ($('#l-venue').options.length <= 1) {
      r.statuses.forEach((s) => { $('#l-venue').appendChild(h('option', { value: s.venueId, text: s.name })); $('#la-venue').appendChild(h('option', { value: s.venueId, text: s.name })); });
    }
    const tb = clear($('#l-table tbody'));
    if (!r.entries.length) tb.appendChild(h('tr', null, h('td', { colspan: 7, class: 'muted', text: 'Nothing logged yet.' })));
    for (const e of r.entries) {
      tb.appendChild(h('tr', null, h('td', { text: new Date(e.at).toLocaleString() }), h('td', null, h('span', { class: 'badge ' + (e.kind === 'post' ? 'kind' : e.kind === 'help' ? 'help' : e.kind === 'removed' ? 'wait' : ''), text: e.kind + (e.override ? ' (override)' : '') })),
        h('td', { text: e.venueId }), h('td', { text: e.toolPath || '' }), h('td', { text: e.template || '' }),
        h('td', null, e.url ? h('a', { href: e.url, target: '_blank', rel: 'noopener noreferrer', text: 'open' }) : ''), h('td', { text: e.note || '' })));
    }
    const sb = clear($('#l-status tbody'));
    for (const s of r.statuses.filter((x) => !$('#l-venue').value || x.venueId === $('#l-venue').value)) {
      sb.appendChild(h('tr', null, h('td', { text: s.name }), h('td', { text: s.lastPost ? new Date(s.lastPost).toLocaleDateString() : '-' }), h('td', { text: s.postsThisWeek + ' / ' + s.maxPerWeek }), h('td', { text: String(s.helpsSinceLast) }),
        h('td', null, h('span', { class: 'badge ' + (s.ok ? 'ok' : 'wait'), text: s.ok ? 'ok' : 'wait' }), s.ok ? '' : ' ' + s.reasons[0] + (s.nextAt ? ' (from ' + new Date(s.nextAt).toLocaleDateString() + ')' : ''))));
    }
  }
  $('#l-refresh').addEventListener('click', loadLog);
  $('#l-venue').addEventListener('change', loadLog);
  $('#la-add').addEventListener('click', async () => {
    try {
      await api('/api/log', { venueId: $('#la-venue').value, toolPath: $('#la-tool').value.trim() || undefined, kind: $('#la-kind').value, url: $('#la-url').value.trim() || undefined, note: $('#la-note').value.trim() || undefined });
      toast('Logged'); $('#la-url').value = ''; $('#la-note').value = ''; loadLog();
    } catch (e) { toast(e.message); }
  });

  /* ------------------------------------------------------------- REELS */
  async function loadReels() {
    const r = await api('/api/reels');
    $('#r-note').textContent = r.note;
    const box = clear($('#r-sections'));
    for (const s of r.sections) {
      box.appendChild(h('div', { class: 'card reelsec' }, h('h3', { text: s.name }),
        s.tools.map((t) => h('div', { class: 'reel' }, glyph(t.glyph), h('span', { text: t.title }), h('span', { class: 'io', text: t.io }),
          r.available
            ? h('a', { class: 'btn', href: t.reelUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Open Reel Maker')
            : h('span', { class: 'btn is-off', title: 'The Reel Maker is not deployed yet', 'aria-disabled': 'true' }, 'Not live yet')))));
    }
  }

  /* -------------------------------------------------------------- boot */
  (async function boot() {
    const r = await api('/api/tools');
    S.tools = r.tools;
    r.tools.forEach((t) => { S.byPath[t.path] = t; });
    const a = await api('/api/audiences');
    const sel = $('#o-aud');
    const g1 = h('optgroup', { label: 'Collections' });
    a.collections.forEach((c) => g1.appendChild(h('option', { value: c.slug, text: c.name })));
    const g2 = h('optgroup', { label: 'Venue audiences' });
    a.vocabulary.forEach((v) => g2.appendChild(h('option', { value: v, text: v })));
    sel.appendChild(g1); sel.appendChild(g2);
    const tab = (location.hash || '#today').slice(1).split('?')[0];
    showTab(['today', 'draft', 'opps', 'kits', 'venues', 'log', 'reels'].includes(tab) ? tab : 'today');
    document.body.setAttribute('data-ready', '1');
  })().catch((e) => { document.body.setAttribute('data-ready', 'error'); toast(e.message); });
})();
