/**
 * The AI tool renderer.
 *
 * One pipeline for every tool under /ai/: something to read (typed, pasted,
 * or a file the page turns into text itself), a few options, one button,
 * and a result you can copy or download. The model call goes through the
 * account gateway — the key never reaches the browser and every call is
 * counted against the month's allowance.
 *
 * These are the cloud tools, and the page says so before anything is sent:
 * what leaves the device is shown, verbatim, under "What will be sent".
 * Files are read here — a PDF's text layer, a spreadsheet's rows — and only
 * the text goes; the file itself never does.
 *
 * A tool is a spec on window.AI_TOOLS[slug]:
 *   title, description, glyph, privacy      what it is and what it sends
 *   inputs: [{ key, label, type: 'text'|'text+file', accept, rows, placeholder, required }]
 *   options: [{ key, label, type: 'select'|'text'|'number', options, default }]
 *   system(opts) -> string                  the model's standing instructions
 *   prompt(inputs, opts) -> string          the message, built from what was given
 *   output: 'text' | 'fields' | 'table'     how the answer is shown
 *   downloads(data, ctx) -> [{ name, blob }] optional, for table/fields outputs
 *   sample: { inputs, opts }                one click to see it work
 */
(function () {
  'use strict';
  window.MVRTool = window.MVRTool || {};

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const LIMITS = window.AI_LIMITS || { free: 10, pro: 300, business: 2000 };
  const MAX_CHARS = 60000;

  /** The first JSON value in a reply, however the model wrapped it. */
  function firstJson(text) {
    const s = String(text || '');
    const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
    const body = fence ? fence[1] : s;
    const starts = [body.indexOf('{'), body.indexOf('[')].filter(i => i >= 0);
    if (!starts.length) throw new Error('no JSON in the reply');
    const start = Math.min.apply(null, starts);
    const open = body[start], close = open === '{' ? '}' : ']';
    const end = body.lastIndexOf(close);
    if (end <= start) throw new Error('unterminated JSON in the reply');
    const raw = body.slice(start, end + 1);
    try { return JSON.parse(raw); }
    catch (e) { return JSON.parse(repairJson(raw)); }
  }

  /* A model writing a post with line breaks tends to put real newlines inside
     the JSON string, which the strict parser rejects. Escape control
     characters that sit inside string literals and try again. */
  function repairJson(s) {
    let out = '', inStr = false, esc = false;
    const chars = Array.from(s);
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (inStr) {
        if (esc) { out += ch; esc = false; continue; }
        if (ch === '\\') { out += ch; esc = true; continue; }
        if (ch === '"') {
          /* a quote closes the string only if what follows is structure;
             otherwise it is a quote inside the text, and must be escaped */
          let j = i + 1;
          while (j < chars.length && /\s/.test(chars[j])) j++;
          const next = chars[j];
          if (next === undefined || next === ',' || next === '}' || next === ']' || next === ':') { inStr = false; out += ch; }
          else out += '\\"';
          continue;
        }
        if (ch === '\n') { out += '\\n'; continue; }
        if (ch === '\r') { continue; }
        if (ch === '\t') { out += '\\t'; continue; }
        out += ch;
      } else {
        if (ch === '"') inStr = true;
        out += ch;
      }
    }
    /* trailing commas before a closing bracket are the other common slip */
    return out.replace(/,\s*([}\]])/g, '$1');
  }

  window.MVRTool.mountAI = function (spec, root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const A = window.Account;

    /* ---- the standing banner: who you are, what this costs ---- */
    const gate = el('div', 'ai-gate');
    io.appendChild(gate);

    /* ---- inputs ---- */
    const inputs = {};
    const attached = {};      /* key -> { name, text } for a file that was read */
    for (const inp of spec.inputs) {
      const wrap = el('div', 'field ai-input');
      const label = el('label', null, inp.label + (inp.required === false ? '' : ' *'));
      const ta = el('textarea', 'control ai-textarea');
      ta.id = 'ai-' + inp.key; ta.rows = inp.rows || 8; ta.placeholder = inp.placeholder || '';
      ta.spellcheck = false;
      label.setAttribute('for', ta.id);
      wrap.appendChild(label);
      if (inp.type === 'text+file') {
        const drop = el('div', 'ai-drop');
        drop.tabIndex = 0; drop.setAttribute('role', 'button');
        const input = el('input', 'visually-hidden'); input.type = 'file'; input.accept = inp.accept || '.pdf,.txt,.csv,.xlsx,.md';
        const say = (strong, small) => { drop.innerHTML = '<strong>' + strong + '</strong><span>' + small + '</span>'; drop.appendChild(input); };
        say('Choose a file', 'PDF, CSV, Excel or text — read here, only its text is sent');
        drop.addEventListener('click', () => input.click());
        drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
        ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
        ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
        const take = async (file) => {
          say(file.name, 'reading…');
          try {
            let text = '';
            if (/\.pdf$/i.test(file.name)) {
              if (!window.MVRPdfText) throw new Error('The PDF reader did not load.');
              const r = await window.MVRPdfText.extract(file, { maxPages: 40 });
              text = r.text;
              if (!text.trim()) throw new Error('This PDF has no text layer — it is a scan. Nothing can be read from it here; a typed or exported PDF works.');
              say(file.name, r.numPages + ' page' + (r.numPages === 1 ? '' : 's') + (r.numPages > 40 ? ', first 40 read' : '') + ' · ' + text.length.toLocaleString('en-GB') + ' characters');
            } else if (/\.(xlsx|csv|tsv)$/i.test(file.name)) {
              if (!window.MVRSheet) throw new Error('The spreadsheet reader did not load.');
              const s = await window.MVRSheet.fromFile(file);
              const rows = s.sheets[0].rows;
              const cap = inp.maxRows || 300;
              text = window.MVRSheet.rowsToText(rows, cap + 1);
              say(file.name, (rows.length - 1).toLocaleString('en-GB') + ' rows' + (rows.length - 1 > cap ? ', first ' + cap + ' taken' : '') + (s.sheets.length > 1 ? ' · first sheet' : ''));
            } else {
              text = await file.text();
              say(file.name, text.length.toLocaleString('en-GB') + ' characters');
            }
            attached[inp.key] = { name: file.name, text };
            ta.value = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
          } catch (e) { say('Choose a file', 'PDF, CSV, Excel or text'); msg.say(e.message || String(e), 'error'); }
        };
        drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) take(e.dataTransfer.files[0]); });
        input.addEventListener('change', () => { if (input.files.length) take(input.files[0]); });
        wrap.appendChild(drop);
      }
      wrap.appendChild(ta);
      const count = el('span', 'field-hint ai-count');
      wrap.appendChild(count);
      ta.addEventListener('input', () => {
        const n = ta.value.length;
        count.textContent = n ? n.toLocaleString('en-GB') + ' characters' + (n > MAX_CHARS ? ' — over the ' + MAX_CHARS.toLocaleString('en-GB') + ' limit; the rest is dropped' : '') : '';
        count.className = 'field-hint ai-count' + (n > MAX_CHARS ? ' is-over' : '');
      });
      io.appendChild(wrap);
      inputs[inp.key] = ta;
    }

    /* ---- options ---- */
    const opts = {};
    if (spec.options && spec.options.length) {
      const bar = el('div', 'opt-bar');
      for (const o of spec.options) {
        const wrap = el('div', 'field');
        const label = el('label', null, o.label);
        let c;
        if (o.type === 'select') {
          c = el('select', 'control');
          for (const x of o.options) { const op = el('option', null, x.label); op.value = x.value; if (String(x.value) === String(o.default)) op.selected = true; c.appendChild(op); }
        } else {
          c = el('input', 'control'); c.type = o.type === 'number' ? 'number' : 'text'; c.value = o.default == null ? '' : o.default;
          if (o.placeholder) c.placeholder = o.placeholder;
        }
        c.id = 'ai-opt-' + o.key; label.setAttribute('for', c.id);
        wrap.appendChild(label); wrap.appendChild(c);
        if (o.hint) wrap.appendChild(el('span', 'field-hint', o.hint));
        bar.appendChild(wrap);
        opts[o.key] = c;
      }
      io.appendChild(bar);
    }
    const readOpts = () => Object.fromEntries(Object.entries(opts).map(([k, c]) => [k, c.value]));
    const readInputs = () => Object.fromEntries(Object.entries(inputs).map(([k, ta]) => [k, ta.value.slice(0, MAX_CHARS)]));

    /* ---- personal data stays here ---- */
    const shield = el('label', 'ai-shield');
    const shieldBox = el('input'); shieldBox.type = 'checkbox'; shieldBox.checked = spec.pii !== false; shieldBox.id = 'ai-shield';
    shield.appendChild(shieldBox);
    const shieldText = el('span', 'ai-shield-text');
    shieldText.innerHTML = '<strong>Mask personal data before sending.</strong> Emails, phone numbers, PAN, Aadhaar, card, IBAN and account numbers are swapped for placeholders on your device and restored in the answer. <em>Names are not detected — redact those yourself if they matter.</em>';
    shield.appendChild(shieldText);
    const shieldNote = el('span', 'ai-shield-note');
    shield.appendChild(shieldNote);
    if (window.MVRPII) io.appendChild(shield);
    const shielded = () => !!(window.MVRPII && shieldBox.checked);

    /* ---- what will be sent ---- */
    const preview = el('details', 'ai-preview');
    const sum = el('summary', null, 'What will be sent to the model');
    preview.appendChild(sum);
    const prePre = el('pre', 'code-out ai-preview-body');
    preview.appendChild(prePre);
    const refreshPreview = () => { if (preview.open) prePre.textContent = outgoing().text || '(nothing yet)'; };
    preview.addEventListener('toggle', refreshPreview);
    shieldBox.addEventListener('change', () => { refreshPreview(); paintShield(); });
    Object.values(inputs).forEach(ta => ta.addEventListener('input', () => { paintShield(); if (preview.open) refreshPreview(); }));
    io.appendChild(preview);

    /** The prompt as it will leave the device, and the map to bring the originals back. */
    function outgoing() {
      const prompt = buildPrompt();
      if (!prompt || !shielded()) return { text: prompt, map: null, counts: {} };
      const m = window.MVRPII.mask(prompt);
      return { text: m.masked, map: m.map, counts: m.counts };
    }
    function paintShield() {
      if (!window.MVRPII) return;
      if (!shieldBox.checked) { shieldNote.textContent = 'Off — the text goes as typed.'; return; }
      const o = outgoing();
      const n = Object.values(o.counts).reduce((a, b) => a + b, 0);
      shieldNote.textContent = n ? 'Will mask ' + window.MVRPII.describe(o.counts) + '.' : '';
    }

    /* ---- run ---- */
    const runBar = el('div', 'io-actions pdf-run');
    const runBtn = el('button', 'btn-primary', spec.action || 'Run');
    runBtn.type = 'button';
    runBar.appendChild(runBtn);
    if (spec.sample) {
      const sampleBtn = el('button', 'btn-ghost', 'Try a sample');
      sampleBtn.type = 'button';
      sampleBtn.addEventListener('click', () => {
        Object.entries(spec.sample.inputs || {}).forEach(([k, v]) => { if (inputs[k]) { inputs[k].value = v; inputs[k].dispatchEvent(new Event('input', { bubbles: true })); } });
        Object.entries(spec.sample.opts || {}).forEach(([k, v]) => { if (opts[k]) opts[k].value = v; });
        msg.say('Sample loaded. Press ' + (spec.action || 'Run') + '.', 'note');
      });
      runBar.appendChild(sampleBtn);
    }
    io.appendChild(runBar);
    const msg = el('div', 'io-msg');
    msg.say = (t, k) => { msg.textContent = t || ''; msg.className = 'io-msg' + (k ? ' is-' + k : ''); };
    io.appendChild(msg);
    const result = el('div', 'ai-result');
    io.appendChild(result);

    function buildPrompt() {
      try { return spec.prompt(readInputs(), readOpts()); } catch (e) { return ''; }
    }

    /* ---- the gate ---- */
    let state = { enabled: !!(A && A.enabled), user: null, plan: 'free' };
    let usage = null;
    function paintGate() {
      gate.innerHTML = '';
      if (!state.enabled) {
        gate.appendChild(el('p', 'ai-gate-text', 'The AI tools are being switched on. Everything else on the site runs on your device and needs no account.'));
        runBtn.disabled = true;
        return;
      }
      const allowance = LIMITS[state.plan] || LIMITS.free;
      const used = usage ? (usage.calls || 0) : null;
      if (!state.user) {
        const p = el('p', 'ai-gate-text');
        p.appendChild(document.createTextNode('Sign in to run this. Free accounts get ' + LIMITS.free + ' AI calls a month; Pro gets ' + LIMITS.pro + '. '));
        const a = el('a', null, 'Sign in or create an account'); a.href = '/account/?next=' + encodeURIComponent(location.pathname);
        p.appendChild(a); p.appendChild(document.createTextNode('.'));
        gate.appendChild(p);
        runBtn.textContent = 'Sign in to ' + (spec.action || 'run').toLowerCase();
        runBtn.disabled = false;
        return;
      }
      const row = el('div', 'ai-gate-row');
      row.appendChild(el('span', 'ai-plan is-' + state.plan, state.plan === 'free' ? 'Free' : state.plan.charAt(0).toUpperCase() + state.plan.slice(1)));
      row.appendChild(el('span', 'ai-gate-text', state.user.email + ' · ' + (used === null ? '…' : Math.max(0, allowance - used)) + ' of ' + allowance + ' calls left this month'));
      if (state.plan === 'free') { const a = el('a', 'ai-upgrade', 'Get more with Pro'); a.href = '/pricing/'; row.appendChild(a); }
      gate.appendChild(row);
      runBtn.textContent = spec.action || 'Run';
      runBtn.disabled = false;
    }
    paintGate();
    if (A && A.enabled) {
      const sync = (s) => { state = { enabled: true, user: s.user, plan: s.plan }; paintGate(); if (s.user) A.usageThisMonth().then(u => { usage = u || { calls: 0 }; paintGate(); }).catch(() => {}); };
      A.ready.then(sync); A.onChange(sync);
    }

    /* ---- running ---- */
    async function run() {
      if (!state.enabled) return;
      if (!state.user) { location.href = '/account/?next=' + encodeURIComponent(location.pathname); return; }
      const ins = readInputs();
      for (const inp of spec.inputs) if (inp.required !== false && !String(ins[inp.key] || '').trim()) { msg.say('Fill in “' + inp.label + '” first.', 'note'); inputs[inp.key].focus(); return; }
      const out = outgoing();
      if (!out.text) { msg.say('Nothing to send yet.', 'note'); return; }
      let system = typeof spec.system === 'function' ? spec.system(readOpts()) : spec.system;
      if (out.map && Object.keys(out.map).length) system = (system || '') + ' Some values in the input are replaced by placeholders such as [[EMAIL_1]] or [[PHONE_2]]; treat each as the real value it stands for and copy it into your answer exactly as written.';
      result.innerHTML = '';
      runBtn.disabled = true;
      const was = runBtn.textContent; runBtn.textContent = 'Working…';
      const masked = out.map ? Object.keys(out.map).length : 0;
      msg.say('Sent' + (masked ? ' with ' + window.MVRPII.describe(out.counts) + ' masked' : '') + '. The model usually answers in a few seconds.', 'note');
      const t0 = Date.now();
      try {
        const res = await A.ai(spec.id, out.text, { system, maxTokens: spec.maxTokens || 2000 });
        if (out.map) res.text = window.MVRPII.unmask(res.text, out.map);
        msg.say('');
        usage = { calls: (usage ? usage.calls : 0) + 1 };
        paintGate();
        show(res, Date.now() - t0, masked ? window.MVRPII.describe(out.counts) : null);
      } catch (e) {
        const m = e.message || String(e);
        if (/allowance|used up|exhausted/i.test(m)) {
          msg.say(m + ' ', 'warn');
          const a = el('a', null, 'See plans'); a.href = '/pricing/'; msg.appendChild(a);
        } else msg.say(m, 'error');
      } finally { runBtn.disabled = false; runBtn.textContent = was; }
    }
    runBtn.addEventListener('click', run);

    function show(res, ms, maskedNote) {
      const text = res.text || '';
      let data = null, parseError = null;
      if (spec.output === 'fields' || spec.output === 'table') {
        try { data = firstJson(text); } catch (e) { parseError = e.message; }
      }
      const head = el('div', 'result-summary');
      const hh = el('div', 'result-summary-head');
      hh.appendChild(el('span', 'result-summary-tick', '✓'));
      const what = el('div', 'result-summary-what');
      what.appendChild(el('strong', 'result-summary-name', spec.resultTitle || 'Done'));
      what.appendChild(el('span', 'result-summary-meta', (res.model || 'model') + ' · ' + (ms / 1000).toFixed(1) + ' s' + (res.usage ? ' · ' + (res.usage.input_tokens + res.usage.output_tokens).toLocaleString('en-GB') + ' tokens' : '') + (typeof res.remaining === 'number' ? ' · ' + res.remaining + ' calls left' : '') + (maskedNote ? ' · masked on device: ' + maskedNote : '')));
      hh.appendChild(what);
      head.appendChild(hh);
      const acts = el('div', 'result-summary-actions');
      const copy = el('button', 'btn-ghost', 'Copy');
      copy.type = 'button';
      copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(data && spec.output === 'table' ? window.MVRSheet.toCSV(window.MVRSheet.objectsToRows(asList(data))) : data && spec.output === 'fields' ? JSON.stringify(data, null, 2) : text); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1500); } catch (e) { msg.say('Could not copy — select the text instead.', 'note'); } });
      acts.appendChild(copy);
      if (data && spec.downloads) {
        try { spec.downloads(data, { text, inputs: readInputs(), opts: readOpts(), sheet: window.MVRSheet }).forEach(d => { const b = el('button', 'btn-primary', 'Download ' + d.name); b.type = 'button'; b.addEventListener('click', async () => { try { window.MVRSheet.download(typeof d.blob === 'function' ? await d.blob() : d.blob, d.name); } catch (e) { msg.say(e.message, 'error'); } }); acts.appendChild(b); }); }
        catch (e) { /* a download that cannot be built is not a failure of the answer */ }
      }
      head.appendChild(acts);
      result.appendChild(head);

      if (res.stopReason === 'max_tokens') {
        result.appendChild(el('p', 'io-msg is-warn', 'The answer hit the length limit and was cut off. Give it fewer rows or items per run and it will complete.'));
      }
      if (parseError) {
        result.appendChild(el('p', 'io-msg is-warn', 'The reply was not in the expected shape (' + parseError + '), so it is shown as text.'));
        result.appendChild(textBlock(text));
      } else if (spec.output === 'table') result.appendChild(tableBlock(asList(data)));
      else if (spec.output === 'fields') result.appendChild(fieldsBlock(data));
      else result.appendChild(textBlock(text));
      result.firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const asList = (d) => Array.isArray(d) ? d : (d && Array.isArray(d.rows) ? d.rows : d && Array.isArray(d.items) ? d.items : [d]);

    function textBlock(text) {
      const box = el('div', 'ai-text');
      /* light structure: blank-line paragraphs, "- " bullets, "#" headings; everything else literal */
      const lines = String(text).split(/\r?\n/);
      let list = null, para = [];
      const flush = () => { if (para.length) { box.appendChild(el('p', null, para.join(' '))); para = []; } };
      for (const raw of lines) {
        const line = raw.replace(/\*\*(.+?)\*\*/g, '$1');
        if (!line.trim()) { flush(); list = null; continue; }
        const h = /^#{1,3}\s+(.*)/.exec(line);
        if (h) { flush(); list = null; box.appendChild(el('h3', 'ai-h3', h[1])); continue; }
        const b = /^\s*(?:[-*•]|\d+[.)])\s+(.*)/.exec(line);
        if (b) { flush(); if (!list) { list = el('ul'); box.appendChild(list); } list.appendChild(el('li', null, b[1])); continue; }
        list = null; para.push(line.trim());
      }
      flush();
      return box;
    }
    function fieldsBlock(obj) {
      const wrap = el('div', 'ai-fields');
      const dl = el('dl');
      for (const [k, v] of Object.entries(obj || {})) {
        const row = el('div');
        row.appendChild(el('dt', null, k.replace(/_/g, ' ')));
        const dd = el('dd');
        if (Array.isArray(v) && v.length && typeof v[0] === 'object') dd.appendChild(tableBlock(v));
        else if (Array.isArray(v)) { const ul = el('ul'); v.forEach(x => ul.appendChild(el('li', null, typeof x === 'object' ? JSON.stringify(x) : String(x)))); dd.appendChild(ul); }
        else if (v && typeof v === 'object') dd.appendChild(fieldsBlock(v));
        else dd.textContent = v == null || v === '' ? '—' : String(v);
        row.appendChild(dd); dl.appendChild(row);
      }
      wrap.appendChild(dl);
      return wrap;
    }
    function tableBlock(list) {
      const rows = window.MVRSheet ? window.MVRSheet.objectsToRows(list) : [[]];
      const wrap = el('div', 'table-scroll biz-preview');
      const t = el('table', 'biz-table');
      const thead = el('thead'), tr = el('tr');
      rows[0].forEach(h => tr.appendChild(el('th', null, String(h).replace(/_/g, ' '))));
      thead.appendChild(tr); t.appendChild(thead);
      const tb = el('tbody');
      rows.slice(1).forEach(r => { const tr2 = el('tr'); r.forEach(v => tr2.appendChild(el('td', null, v == null ? '' : String(v)))); tb.appendChild(tr2); });
      t.appendChild(tb); wrap.appendChild(t);
      return wrap;
    }
  };
})();
