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
    if (name === 'opps') loadSavedOpps();
    if (name === 'calendar') loadCalendar();
    if (name === 'guide') loadGuide().catch((e) => toast(e.message));
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
    loadTodayVideos();
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
    await restoreDraft();
  }

  /* Edited drafts are saved as you type (drafts.json in the desk's data
     folder) and come back when the same tool, venue, template and variant
     are opened again, after a restart too. */
  function draftId() { const d = S.draft; return { tool: d.tool, venue: d.venue, template: d.template, variant: d.variant, qurl: d.qurl, question: d.question }; }
  function editedParts() {
    const r = S.lastDraft; const out = {};
    if (!r) return out;
    for (const p of r.draft.parts) {
      const ta = $('textarea[data-key="' + p.key + '"]');
      if (ta && ta.value !== p.text) out[p.key] = ta.value;
    }
    return out;
  }
  let saveT = 0;
  function saveDraftSoon() {
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      if (!S.draft.tool) return;
      try { await api('/api/drafts', Object.assign(draftId(), { parts: editedParts() })); $('#d-saved').textContent = 'Edits saved'; } catch (e) { /* the desk keeps working without it */ }
    }, 600);
  }
  async function restoreDraft() {
    const note = $('#d-saved');
    note.textContent = '';
    let r;
    try { r = await api('/api/drafts?' + qs(draftId())); } catch (e) { return; }
    if (!r.draft || !r.draft.parts) return;
    let n = 0;
    for (const [key, text] of Object.entries(r.draft.parts)) {
      const ta = $('textarea[data-key="' + key + '"]');
      if (ta) { ta.value = text; ta.dispatchEvent(new Event('input')); n++; }
    }
    if (!n) return;
    clear(note).append('Restored your edits from ' + new Date(r.draft.updatedAt).toLocaleString() + ' · ',
      h('button', { class: 'linkish', onclick: async () => { await api('/api/drafts', Object.assign(draftId(), { parts: {} })); await loadDraft(); } }, 'Reset to the generated text'));
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
        saveDraftSoon();
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
    const fresh = r.items.filter((it) => it.status === 'new' && it.firstSeen === it.lastSeen).length;
    clear(status).appendChild(h('p', { class: 'small', text: 'Searched ' + r.venues.length + ' venues for: ' + r.queries.join(' | ') + '. ' + r.items.length + ' open questions, ' + fresh + ' new to you. All of them are saved below.' }));
    if (r.errors.length) status.appendChild(h('details', { class: 'small' }, h('summary', { text: r.errors.length + ' venue(s) did not answer' }), h('ul', null, r.errors.map((e) => h('li', { text: e })))));
    if (!r.items.length) status.appendChild(h('p', { class: 'muted', text: 'No open questions in the window. Try another tool, or come back tomorrow.' }));
    S.oppFilter = 'new';
    await loadSavedOpps();
  });

  /* The saved list: everything the finder has ever found, from
     opportunities.json in the desk's data folder, so a restart loses
     nothing and a question you dismissed stays dismissed. */
  S.oppFilter = 'new';
  async function loadSavedOpps() {
    let r;
    try { r = await api('/api/opps?' + qs({ status: S.oppFilter })); }
    catch (e) { return; }
    for (const [k, n] of Object.entries(r.counts)) { const el = document.querySelector('#o-filters [data-n="' + k + '"]'); if (el) el.textContent = String(n); }
    for (const b of document.querySelectorAll('#o-filters button')) b.classList.toggle('is-on', b.dataset.status === S.oppFilter);
    const box = clear($('#o-results'));
    if (!r.items.length) box.appendChild(h('p', { class: 'muted', text: S.oppFilter === 'new' ? 'Nothing new waiting. Search for a tool or an audience above.' : 'Nothing here yet.' }));
    for (const it of r.items) box.appendChild(oppCard(it));
  }
  function oppCard(it) {
    const tool = (it.query && it.query.tool) || '';
    const setStatus = async (status) => { await api('/api/opps', { url: it.url, status }); await loadSavedOpps(); };
    return h('div', { class: 'opp is-' + it.status },
      h('a', { class: 't', href: it.url, target: '_blank', rel: 'noopener noreferrer', text: it.title }),
      h('div', { class: 'meta' },
        h('span', { class: 'score', text: it.matchScore + '%' }),
        h('span', { text: it.venueName || it.venueId }),
        h('span', { text: ago(it.created) }),
        it.score != null ? h('span', { text: it.score + ' points' }) : null,
        it.comments != null ? h('span', { text: it.comments + ' replies' }) : null,
        tool && S.byPath[tool] ? h('span', { text: 'for ' + S.byPath[tool].title }) : (it.query && it.query.audience ? h('span', { text: 'for ' + it.query.audience }) : null),
        h('span', { class: 'badge', text: it.suggestedTemplate }),
        it.status !== 'new' ? h('span', { class: 'badge st-' + it.status, text: it.status }) : null,
        h('button', { class: 'btn', onclick: async () => { if (it.status === 'new') await api('/api/opps', { url: it.url, status: 'drafted' }); openDraft({ tool, venue: it.venueId, template: it.suggestedTemplate, question: it.title, qurl: it.url }); } }, 'Draft answer'),
        it.status !== 'answered' ? h('button', { class: 'ghost', onclick: () => setStatus('answered') }, 'Mark answered') : null,
        it.status !== 'dismissed' ? h('button', { class: 'ghost', onclick: () => setStatus('dismissed') }, 'Dismiss') : h('button', { class: 'ghost', onclick: () => setStatus('new') }, 'Restore')));
  }
  for (const b of document.querySelectorAll('#o-filters button')) b.addEventListener('click', () => { S.oppFilter = b.dataset.status; loadSavedOpps(); });

  /* -------------------------------------------------------------- KITS */
  const kPicker = makePicker($('#k-tool'), $('#k-tool-list'), (t) => { S.kitTool = t.path; $('#k-seed').value = ''; loadLooks(); });
  function kitImages(slug, files, stamp) {
    return h('div', { class: 'kitimgs' }, files.filter((f) => /\.png$/.test(f)).map((f) => h('figure', null,
      h('a', { href: '/kits/' + encodeURIComponent(slug) + '/' + f, target: '_blank', rel: 'noopener' }, h('img', { src: '/kits/' + encodeURIComponent(slug) + '/' + f + '?t=' + stamp, alt: f, loading: 'lazy' })),
      h('figcaption', { text: f }))));
  }
  function kitCard(k) {
    const pdf = (k.files || []).filter((f) => /\.pdf$/.test(f));
    return h('div', { class: 'card' },
      h('div', { class: 'head-row' }, h('h3', { text: k.title, style: 'margin:0' }), h('span', { class: 'muted small', text: k.at ? new Date(k.at).toLocaleString() : '' })),
      k.look ? h('p', { class: 'small k-lookline', text: 'Look: ' + k.look }) : null,
      h('p', { class: 'small' }, h('code', { text: k.dir })),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: async () => { try { await api('/api/reveal', { slug: k.slug }); toast('Opened in Explorer'); } catch (e) { toast(e.message); } } }, 'Open folder'),
        h('a', { class: 'btn', href: '/kits/' + encodeURIComponent(k.slug) + '/kit.md', target: '_blank', rel: 'noopener' }, 'kit.md'),
        pdf.map((f) => h('a', { class: 'btn', href: '/kits/' + encodeURIComponent(k.slug) + '/' + f, target: '_blank', rel: 'noopener' }, f)),
        h('button', { class: 'ghost', onclick: () => copyText(k.dir) }, 'Copy path')),
      kitImages(k.slug, k.files, Date.now()));
  }
  /* look controls: Auto everywhere means "the next look for this tool" */
  async function loadKitOptions() {
    if (S.kitOptions) return;
    S.kitOptions = await api('/api/kit-options');
    const fill = (sel, list) => list.forEach((o) => $(sel).appendChild(h('option', { value: o.id, text: o.label })));
    fill('#k-layout', S.kitOptions.layouts);
    fill('#k-palette', S.kitOptions.palettes);
    fill('#k-type', S.kitOptions.types);
  }
  function lookParams() {
    const o = { layout: $('#k-layout').value, palette: $('#k-palette').value, type: $('#k-type').value, copy: $('#k-copy').value };
    const seed = $('#k-seed').value.trim();
    if (/^\d+$/.test(seed)) o.seed = seed;
    return o;
  }
  let looksReq = 0;
  async function loadLooks(seed) {
    if (!S.kitTool) return;
    const box = clear($('#k-looks'));
    box.appendChild(h('span', { class: 'spinner' }));
    const n = ++looksReq;
    try {
      const p = lookParams();
      const r = await api('/api/kit-looks', Object.assign({ tool: S.kitTool, n: 6 }, p, { seed: seed != null ? seed : (p.seed || '') }));
      if (n !== looksReq) return;
      clear(box);
      r.looks.forEach((l) => box.appendChild(h('button', {
        type: 'button', 'aria-pressed': String($('#k-seed').value === String(l.variant.seed)), title: l.label + ' · seed ' + l.variant.seed, 'data-seed': l.variant.seed,
        onclick: (ev) => {
          $('#k-seed').value = String(l.variant.seed);
          box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
          ev.currentTarget.setAttribute('aria-pressed', 'true');
        },
      }, h('img', { src: l.png, alt: l.label }), h('span', { text: l.label }))));
    } catch (e) { if (n === looksReq) clear(box).appendChild(h('p', { class: 'banner wait', text: e.message })); }
  }
  ['#k-layout', '#k-palette', '#k-type', '#k-copy'].forEach((s) => $(s).addEventListener('change', () => loadLooks()));
  $('#k-shuffle').addEventListener('click', () => {
    if (!S.kitTool) { toast('Pick a tool'); return; }
    const seed = String(Math.floor(Math.random() * 4294967295));
    $('#k-seed').value = seed;
    loadLooks(seed);
  });
  async function loadKits() {
    loadKitOptions().catch(() => {});
    const r = await api('/api/kits');
    $('#k-dir').textContent = r.dir;
    const box = clear($('#k-list'));
    if (!r.kits.length) box.appendChild(h('p', { class: 'muted', text: 'No kits yet.' }));
    r.kits.forEach((k) => box.appendChild(kitCard(k)));
  }
  $('#k-go').addEventListener('click', async () => {
    if (!S.kitTool) { toast('Pick a tool'); return; }
    const box = clear($('#k-result'));
    box.appendChild(h('p', null, h('span', { class: 'spinner' }), 'Capturing the example and rendering the carousel, PDF, square, story, pin, wide and kit.md…'));
    try {
      const r = await api('/api/kit', Object.assign({ tool: S.kitTool }, lookParams()));
      const v = r.variant || {};
      clear(box).appendChild(kitCard({ slug: r.slug, title: S.byPath[S.kitTool].title, dir: r.dir, files: r.files.map((f) => f.file || f.path.split(/[\\/]/).pop()), at: new Date().toISOString(),
        look: v.layout ? v.layout + ' · ' + v.palette + ' · ' + v.type + ' · copy ' + v.copy + ' · seed ' + v.seed : '' }));
      box.firstChild.setAttribute('id', 'k-new');
      $('#k-seed').value = '';
      loadKits();
      loadLooks();
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

  /* ------------------------------------------------------------ CALENDAR */
  /* Every slot has targets (one per channel and format, calendar.js). The
     owner records each post's link, ticks a channel with no permanent link,
     or skips with a reason; the server checks the link's shape locally and
     never opens it. */
  const STATE_LABEL = { planned: 'planned', made: 'made', partly: 'partly posted', posted: 'posted', skipped: 'skipped' };
  function localDay(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function shortUrl(u) { return String(u).replace(/^https?:\/\/(www\.)?/, '').slice(0, 48) + (String(u).replace(/^https?:\/\/(www\.)?/, '').length > 48 ? '…' : ''); }

  async function loadCalendar() {
    const cal = await api('/api/calendar');
    S.cal = cal;
    $('#cal-start').value = cal.start;
    renderCalStats();
    const box = clear($('#cal-weeks'));
    let week = null, list = null, n = 0;
    for (const it of cal.items) {
      const wk = Math.floor((localDay(it.date) - localDay(cal.start)) / (7 * 864e5));
      if (wk !== week) {
        week = wk;
        list = h('div', { class: 'stack' });
        const hasToday = cal.items.some((x) => x.date === cal.today && Math.floor((localDay(x.date) - localDay(cal.start)) / (7 * 864e5)) === wk);
        box.appendChild(h('details', { class: 'card cal-week', open: n < 2 || hasToday ? '' : null }, h('summary', { text: wk < 0 ? 'Kept from an earlier plan · ' + it.date : 'Week ' + (wk + 1) + ' · from ' + it.date }), list));
        n++;
      }
      list.appendChild(calItem(it, cal.today));
    }
    loadCoverage();
  }
  function renderCalStats() {
    const cal = S.cal;
    const counts = { planned: 0, made: 0, partly: 0, posted: 0, skipped: 0 };
    for (const it of cal.items) counts[it.state] = (counts[it.state] || 0) + 1;
    $('#cal-stats').textContent = cal.items.length + ' videos from ' + cal.start + ' · ' + counts.posted + ' posted · ' + (counts.partly ? counts.partly + ' partly posted · ' : '') + counts.made + ' made · ' + counts.planned + ' planned' + (counts.skipped ? ' · ' + counts.skipped + ' skipped' : '');
  }
  function replaceItem(item) {
    const i = S.cal.items.findIndex((x) => x.id === item.id);
    if (i >= 0) S.cal.items[i] = item;
    const old = document.querySelector('.cal-item[data-id="' + item.id + '"]');
    if (old) old.replaceWith(calItem(item, S.cal.today));
    renderCalStats();
    loadCoverage();
  }
  async function doTarget(it, channel, action, extra) {
    let r;
    try { r = await api('/api/calendar/target', Object.assign({ id: it.id, channel, action }, extra || {})); }
    catch (e) { toast(e.message); return null; }
    const t = r.target;
    toast(r.message || (r.logged ? 'Recorded and added to the posting log' : action === 'post' && t && t.flagged ? 'Recorded: the link needs a check' : 'Saved'));
    replaceItem(r.item);
    return r;
  }
  function targetRow(it, t) {
    const state = t.state === 'posted' ? (t.flagged ? 'check' : 'posted') : t.state;
    const label = { due: 'due', posted: t.accepted ? 'posted · confirmed by you' : t.tick && !t.url ? 'posted (ticked)' : 'posted', check: 'check the link', skipped: t.reason ? 'skipped' : 'skipped, no reason' }[state];
    const controls = h('div', { class: 'tg-ctl' });
    if (t.state === 'due') {
      if (!t.tickOnly) {
        const inp = h('input', { type: 'url', class: 'tg-input', placeholder: 'Paste the ' + t.name + ' link', 'aria-label': t.name + ' link' });
        const rec = () => { const v = inp.value.trim(); if (!v) { toast('Paste the post\'s link first'); return; } doTarget(it, t.channel, 'post', { url: v }); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); rec(); } });
        controls.appendChild(inp);
        controls.appendChild(h('button', { class: 'btn tg-record', onclick: rec }, 'Record'));
      }
      if (t.allowsTick) controls.appendChild(h('button', { class: 'ghost tg-tick', onclick: () => { const note = window.prompt('Posted to ' + t.name + '. A note (optional):', ''); if (note === null) return; doTarget(it, t.channel, 'post', { tick: true, note: note.trim() || undefined }); } }, 'Posted (tick)'));
      controls.appendChild(h('button', { class: 'ghost tg-skip', onclick: () => { const reason = window.prompt('Why skip ' + t.name + '? (cadence, not right for this tool, account not set up…)', ''); if (!reason || !reason.trim()) return; doTarget(it, t.channel, 'skip', { reason: reason.trim() }); } }, 'Skip…'));
      if (t.extra) controls.appendChild(h('button', { class: 'ghost', onclick: () => doTarget(it, t.channel, 'remove') }, 'Remove'));
    } else {
      if (t.flagged) controls.appendChild(h('button', { class: 'ghost tg-accept', title: 'The link is right: count it as posted', onclick: () => doTarget(it, t.channel, 'accept') }, 'It is right'));
      controls.appendChild(h('button', { class: 'ghost tg-clear', onclick: () => doTarget(it, t.channel, 'clear') }, 'Clear'));
    }
    controls.appendChild(h('button', { class: 'linkish small', onclick: () => openGuide(t.channel) }, 'How to post'));
    return h('div', { class: 'tg is-' + state, 'data-channel': t.channel },
      h('div', { class: 'tg-head' },
        h('span', { class: 'tg-name', text: t.name }),
        h('span', { class: 'badge tg-state st-' + state, text: label }),
        t.extra ? h('span', { class: 'badge', text: 'added' }) : null,
        t.url ? h('a', { class: 'tg-url small', href: t.url, target: '_blank', rel: 'noopener noreferrer', text: shortUrl(t.url) }) : null,
        t.reason ? h('span', { class: 'muted small', text: t.reason }) : null,
        t.note ? h('span', { class: 'muted small', text: '· ' + t.note }) : null),
      t.issues && t.issues.length ? h('ul', { class: 'tg-issues small' }, t.issues.map((x) => h('li', { class: x.level, 'data-code': x.code, text: (x.level === 'bad' ? '✖ ' : '! ') + x.msg }))) : null,
      controls);
  }
  function addChannel(it) {
    const have = it.targets.map((t) => t.channel);
    const opts = (S.channels || []).filter((c) => !have.includes(c.id));
    if (!opts.length) return null;
    const sel = h('select', { class: 'tg-add', 'aria-label': 'Add a channel' }, h('option', { value: '', text: 'Add a channel…' }), opts.map((c) => h('option', { value: c.id, text: c.name })));
    sel.addEventListener('change', () => { if (sel.value) doTarget(it, sel.value, 'add'); });
    return sel;
  }
  function calItem(it, todayIso) {
    const set = async (status) => {
      let postedUrl;
      if (status === 'posted') { postedUrl = prompt('Link to the post (optional). Better: record each channel\'s link in its row below.', it.postedUrl || ''); if (postedUrl === null) return; }
      try { const r = await api('/api/calendar/status', { id: it.id, status, postedUrl }); replaceItem(r.item); } catch (e) { toast(e.message); }
    };
    const fmt = { problem: '#f7c948', before: '#2dd4ff', dev: '#7c5cff', india: '#ff9d2e', ai: '#ff6b9d' }[it.format] || '#f7c948';
    const st = it.state || it.status;
    return h('div', { class: 'cal-item is-' + st + (it.date === todayIso ? ' is-today' : ''), 'data-id': it.id },
      h('div', { class: 'cal-when' }, h('b', { text: it.date }), h('span', { class: 'badge', style: 'border-color:' + fmt + ';color:' + fmt, text: it.formatLabel }),
        it.progress ? h('span', { class: 'cal-prog small', text: it.progress.label }) : null,
        it.progress && it.progress.flagged ? h('span', { class: 'badge wait', text: it.progress.flagged + ' link' + (it.progress.flagged > 1 ? 's' : '') + ' to check' }) : null),
      h('div', { class: 'cal-what' },
        h('div', null, h('b', { text: it.title }), ' — ', h('span', { text: it.hook })),
        h('details', { class: 'small' }, h('summary', { text: 'Beats for the Reel' }), h('ol', null, it.beats.map((b) => h('li', { text: b })))),
        h('div', { class: 'cal-targets' }, (it.targets || []).map((t) => targetRow(it, t)), addChannel(it)),
        (it.unassigned || []).length ? h('p', { class: 'small muted' }, 'Unassigned link' + (it.unassigned.length > 1 ? 's' : '') + ' (matched no target): ', it.unassigned.map((u) => h('a', { href: u.url, target: '_blank', rel: 'noopener noreferrer', text: shortUrl(u.url) + ' ' }))) : null),
      h('div', { class: 'cal-actions' },
        h('a', { class: 'btn', href: it.reel, target: '_blank', rel: 'noopener noreferrer' }, 'Make the Reel'),
        h('button', { class: 'ghost', onclick: () => { S.kitTool = it.tool; kPicker.set(it.tool); $('#k-seed').value = ''; showTab('kits'); loadLooks(); } }, 'Kit'),
        h('button', { class: 'ghost', onclick: () => openDraft({ tool: it.tool, template: 'instagram-caption' }) }, 'Caption'),
        it.status === 'planned' ? h('button', { class: 'ghost', onclick: () => set('made') }, 'Made') : null,
        it.status !== 'posted' && st !== 'posted' ? h('button', { class: 'ghost', onclick: () => set('posted') }, 'Posted') : null,
        it.status !== 'skipped' && st !== 'posted' ? h('button', { class: 'ghost', onclick: () => set('skipped') }, 'Skip') : null,
        st !== 'planned' ? h('span', { class: 'badge st-' + st, text: STATE_LABEL[st] || st }) : null));
  }
  function goToSlot(id) {
    showTab('calendar');
    const tryIt = (n) => {
      const el = document.querySelector('.cal-item[data-id="' + id + '"]');
      if (!el) { if (n > 0) setTimeout(() => tryIt(n - 1), 200); return; }
      const d = el.closest('details'); if (d) d.open = true;
      el.scrollIntoView({ block: 'center' });
      el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600);
    };
    tryIt(20);
  }
  $('#cal-replan').addEventListener('click', async () => {
    const start = $('#cal-start').value;
    if (!start) { toast('Pick a start date'); return; }
    await api('/api/calendar/plan', { start });
    toast('Re-planned from ' + start + ' — slots with a status or any channel record are kept');
    await loadCalendar();
  });

  /* Coverage: which targets of past and today's slots are missing, which
     links fail the shape check, and per channel what went out. */
  let covReq = 0;
  async function loadCoverage() {
    const n = ++covReq;
    let c;
    try { c = await api('/api/calendar/coverage?' + qs({ days: $('#cov-days').value })); } catch (e) { return; }
    if (n !== covReq) return;
    const missing = c.slots.reduce((a, s) => a + s.missing.length, 0);
    const flagged = c.slots.reduce((a, s) => a + s.flagged.length, 0);
    $('#cov-line').textContent = c.from + ' to ' + c.today + ': ' + missing + ' target' + (missing === 1 ? '' : 's') + ' missing · ' + flagged + ' link' + (flagged === 1 ? '' : 's') + ' to check';
    const box = clear($('#cov-body'));
    const fig = (b) => h('td', null, h('span', { class: 'cov-n ok', title: 'posted', text: String(b.posted) }), ' / ', h('span', { class: 'cov-n', title: 'due today', text: String(b.due) }), ' / ', h('span', { class: 'cov-n' + (b.missed ? ' bad' : ''), title: 'missed', text: String(b.missed) }), b.flagged ? [' / ', h('span', { class: 'cov-n bad', title: 'links to check', text: b.flagged + ' to check' })] : null, b.skipped ? h('span', { class: 'muted', text: ' · ' + b.skipped + ' skipped' }) : null);
    if (c.channels.length) {
      box.appendChild(h('div', { class: 'tablewrap' }, h('table', { class: 'tbl cov-table' },
        h('thead', null, h('tr', null, h('th', { text: 'Channel' }), h('th', { text: 'Last 7 days: posted / due / missed' }), h('th', { text: 'Last 30 days: posted / due / missed' }))),
        h('tbody', null, c.channels.map((r) => h('tr', { 'data-channel': r.id }, h('td', null, r.name, r.venue ? null : h('span', { class: 'badge', title: 'No venue in venues.json: recorded without a log entry', text: 'no log' })), fig(r.week), fig(r.d30)))))));
    } else box.appendChild(h('p', { class: 'muted small', text: 'Nothing due yet in this window.' }));
    const open = c.slots.filter((s) => s.missing.length);
    const sec = h('div', { class: 'cov-missing' }, h('h4', { text: 'Missing' }));
    if (!open.length) sec.appendChild(h('p', { class: 'muted small', text: 'Nothing missing: every past and today\'s target is posted or skipped with a reason.' }));
    for (const s of open) sec.appendChild(h('div', { class: 'cov-slot', 'data-id': s.id },
      h('b', { text: s.date }), ' ', h('span', { text: s.title }), ' ', h('span', { class: 'muted small', text: s.progress.label }), ' ',
      s.missing.map((m) => h('span', { class: 'badge chip' + (m.overdue ? ' wait' : ''), 'data-channel': m.channel, text: m.name })),
      ' ', h('button', { class: 'linkish small', onclick: () => goToSlot(s.id) }, 'Go to slot')));
    box.appendChild(sec);
    const bad = c.slots.filter((s) => s.flagged.length || s.warnings.length || s.unassigned.length);
    if (bad.length) {
      const sec2 = h('div', { class: 'cov-check' }, h('h4', { text: 'Links to check' }));
      for (const s of bad) {
        for (const f of s.flagged) sec2.appendChild(h('p', { class: 'small bad', 'data-channel': f.channel }, h('b', { text: s.date + ' ' + f.name + ': ' }), h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer', text: shortUrl(f.url) }), ' — ' + f.issues.map((i) => i.msg).join(' '), ' ', h('button', { class: 'linkish', onclick: () => goToSlot(s.id) }, 'Go to slot')));
        for (const w of s.warnings) sec2.appendChild(h('p', { class: 'small warn' }, h('b', { text: s.date + ' ' + w.name + ': ' }), w.issues.map((i) => i.msg).join(' ')));
        for (const u of s.unassigned) sec2.appendChild(h('p', { class: 'small warn' }, h('b', { text: s.date + ' unassigned link: ' }), h('a', { href: u.url, target: '_blank', rel: 'noopener noreferrer', text: shortUrl(u.url) })));
      }
      box.appendChild(sec2);
    }
    if (c.noVenue.length) box.appendChild(h('p', { class: 'muted small', text: 'No venue in venues.json, so recorded without a log entry: ' + c.noVenue.join(', ') + '.' }));
  }
  $('#cov-days').addEventListener('change', loadCoverage);

  /* Today: the video slots of the day and the channels still missing. */
  async function loadTodayVideos() {
    const box = clear($('#plan-cal'));
    let c;
    try { c = await api('/api/calendar/coverage?days=1'); } catch (e) { return; }
    if (!c.todaySlots.length) return;
    const card = h('div', { class: 'card today-videos' }, h('h3', { class: 'cal-title', text: 'Today\'s videos' }));
    for (const s of c.todaySlots) {
      card.appendChild(h('div', { class: 'tv-slot', 'data-id': s.id },
        h('div', null, h('b', { text: s.title }), ' ', h('span', { class: 'muted small', text: s.formatLabel + ' · ' + s.progress.label }), ' ', h('button', { class: 'linkish small', onclick: () => goToSlot(s.id) }, 'Open in Calendar')),
        s.missing.length ? h('div', { class: 'tv-missing' }, h('span', { class: 'muted small', text: 'Still to post: ' }),
          s.missing.map((m) => h('span', { class: 'badge chip' + (m.flagged ? ' wait' : ''), 'data-channel': m.channel, title: m.cadence && !m.cadence.ok ? 'Wait: ' + m.cadence.reasons.join(' · ') : m.flagged ? 'The recorded link needs a check' : '', text: m.name + (m.cadence && !m.cadence.ok ? ' · wait' : '') + (m.flagged ? ' · check link' : '') })))
          : h('p', { class: 'small ok-line', text: 'Every channel is done for this slot.' })));
    }
    box.appendChild(card);
  }

  /* -------------------------------------------------------------- GUIDE */
  async function loadGuide() {
    if (S.guideRendered) return;
    const g = S.guide || (S.guide = await api('/api/guide'));
    S.channels = g.channels;
    $('#g-checked').textContent = 'Every number on a channel card comes from the platform\'s own help pages, with its source and the date it was read (' + g.checked + '). Where no official page states it, the card says "' + g.notConfirmed + '". Platforms change: the app\'s own upload screen has the final word.';
    const vis = clear($('#g-vision'));
    vis.appendChild(h('h3', { class: 'cal-title', text: g.vision.title }));
    vis.appendChild(h('ul', { class: 'g-list' }, g.vision.points.map((p) => h('li', { text: p }))));
    const pr = clear($('#g-process'));
    pr.appendChild(h('h3', { class: 'cal-title', text: g.process.title }));
    pr.appendChild(h('div', { class: 'g-steps' }, g.process.steps.map((s) => h('div', { class: 'g-step' }, h('b', { text: s.title }), h('p', { text: s.text })))));
    pr.appendChild(h('h4', { text: 'How it fits the week' }));
    pr.appendChild(h('div', { class: 'stack' }, g.process.fit.map((s) => h('details', { class: 'g-q' }, h('summary', { text: s.title }), h('p', { text: s.text })))));
    pr.appendChild(h('h4', { text: 'When things go differently' }));
    pr.appendChild(h('div', { class: 'stack' }, g.process.cases.map((s) => h('details', { class: 'g-q' }, h('summary', { text: s.title }), h('p', { text: s.text })))));
    const rl = clear($('#g-redlines'));
    rl.appendChild(h('h3', { class: 'cal-title', text: 'Red lines (every channel)' }));
    rl.appendChild(h('ul', { class: 'g-list' }, g.redLines.map((r) => h('li', { text: r }))));
    const grid = clear($('#g-channels'));
    for (const c of g.channels) grid.appendChild(channelCard(c, g));
    const sel = $('#g-channel');
    if (sel.options.length <= 1) g.channels.forEach((c) => sel.appendChild(h('option', { value: c.id, text: c.name })));
    const fq = clear($('#g-faq'));
    fq.appendChild(h('h3', { class: 'cal-title', text: 'Questions' }));
    fq.appendChild(h('div', { class: 'stack' }, g.faq.map((f) => h('details', { class: 'g-q' }, h('summary', { text: f.q }), h('p', { text: f.a })))));
    S.guideRendered = true;
  }
  function channelCard(c, g) {
    return h('details', { class: 'card g-card', id: 'gc-' + c.id, 'data-channel': c.id },
      h('summary', null, h('b', { text: c.name }), ' ', c.venue ? h('span', { class: 'badge kind', title: 'Recorded posts go to the log as ' + c.venue, text: c.venueName || c.venue }) : h('span', { class: 'badge', title: 'No venue in venues.json: recorded on the calendar without a log entry', text: 'no log venue' }),
        h('div', { class: 'muted small', text: c.summary })),
      h('dl', { class: 'g-specs' }, c.specs.map((s) => [h('dt', { text: s.label }), h('dd', null, s.value ? h('span', { text: s.value }) : h('span', { class: 'nc', text: g.notConfirmed }),
        s.src ? h('a', { class: 'g-src', href: s.src, target: '_blank', rel: 'noopener noreferrer', title: 'Checked ' + s.checked, text: (s.value ? 'source · ' : 'official page tried · ') + s.checked }) : null)])),
      c.cadence ? h('p', { class: 'small' }, h('b', { text: 'Cadence in the desk: ' }), c.cadence) : null,
      h('h4', { text: 'Upload' }), h('ul', { class: 'g-list small' }, c.upload.map((f) => h('li', { text: f }))),
      h('p', { class: 'small' }, h('b', { text: 'Caption: ' }), 'in Draft, template ', h('code', { text: c.template })),
      h('p', { class: 'small' }, h('b', { text: 'A right link looks like: ' }), c.linkExample ? h('code', { text: c.linkExample }) : 'no link — tick it as posted'),
      h('h4', { text: 'Checklist' }), h('ol', { class: 'g-list small' }, c.steps.map((s) => h('li', { text: s }))),
      h('h4', { text: 'Red lines here' }), h('ul', { class: 'g-list small' }, c.redLines.map((r) => h('li', { text: r }))));
  }
  function filterGuide(id) {
    $$('#g-channels .g-card').forEach((el) => { el.hidden = !!id && el.dataset.channel !== id; if (id && el.dataset.channel === id) el.open = true; });
  }
  $('#g-channel').addEventListener('change', (e) => { filterGuide(e.target.value); if (e.target.value) $('#gc-' + e.target.value).scrollIntoView({ block: 'start' }); });
  async function openGuide(channel) {
    showTab('guide');
    await loadGuide();
    $('#g-channel').value = channel || '';
    filterGuide(channel || '');
    if (channel) { const el = $('#gc-' + channel); if (el) el.scrollIntoView({ block: 'start' }); }
  }

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
    try { const g = await api('/api/guide'); S.guide = g; S.channels = g.channels; } catch (e) { /* the Guide tab retries */ }
    showTab(['today', 'draft', 'opps', 'kits', 'venues', 'log', 'reels', 'calendar', 'guide'].includes(tab) ? tab : 'today');
    document.body.setAttribute('data-ready', '1');
  })().catch((e) => { document.body.setAttribute('data-ready', 'error'); toast(e.message); });
})();
