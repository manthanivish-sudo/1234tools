/* ============================================================
   Renderer extensions for developer / web-build tools.
   Three mount modes on top of the calculator renderer:
     mountCode      text in  -> formatted text out
     mountGenerate  form in  -> markup out
     mountFile      image in -> favicons or resized bitmaps
   The QR generator, bulk generator and scanner are in render-qr.js.
   Big inputs run in engine/render-dev-worker.js; see "the shell's shared machinery".
   ============================================================ */
(function () {
  'use strict';

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function copyButton(getText, label) {
    const b = el('button', 'btn-copy', label || 'Copy');
    b.type = 'button';
    b.addEventListener('click', function () {
      const txt = getText();
      if (!txt) return;
      navigator.clipboard?.writeText(txt).then(function () {
        const was = b.textContent;
        b.textContent = 'Copied';
        b.classList.add('ok');
        setTimeout(function () { b.textContent = was; b.classList.remove('ok'); }, 1400);
      });
    });
    return b;
  }

  function downloadButton(label, filename, makeBlob, cls) {
    const b = el('button', cls || 'btn-download', label);
    b.type = 'button';
    b.addEventListener('click', async function () {
      const blob = await makeBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = el('a');
      a.href = url;
      a.download = typeof filename === 'function' ? filename() : filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });
    return b;
  }

  function buildField(f) {
    const wrap = el('div', 'field');
    const id = 'f-' + f.key;
    const lab = el('label', null, f.label);
    lab.setAttribute('for', id);
    wrap.appendChild(lab);

    let input;
    if (f.type === 'select') {
      input = el('select', 'control');
      (f.options || []).forEach(function (o) {
        const opt = el('option', null, o.label);
        opt.value = o.value;
        if (String(o.value) === String(f.default)) opt.selected = true;
        input.appendChild(opt);
      });
    } else if (f.type === 'textarea') {
      input = el('textarea', 'control');
      input.rows = 3;
      input.value = f.default || '';
    } else if (f.type === 'color') {
      input = el('div', 'colour-field');
      const swatch = el('input');
      swatch.type = 'color';
      swatch.className = 'colour-swatch';
      swatch.value = f.default || '#000000';
      const hex = el('input', 'control colour-hex');
      hex.type = 'text';
      hex.value = f.default || '#000000';
      hex.spellcheck = false;
      swatch.addEventListener('input', function () {
        hex.value = swatch.value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      hex.addEventListener('input', function () {
        if (/^#[0-9a-f]{6}$/i.test(hex.value)) swatch.value = hex.value;
      });
      input.appendChild(swatch);
      input.appendChild(hex);
      input._value = function () { return hex.value; };
      input.dataset.name = f.key;
      wrap.appendChild(input);
      return {
        wrap: wrap, key: f.key,
        read: function () { return hex.value; },
        write: function (v) { hex.value = v; swatch.value = v; }
      };
    } else {
      input = el('input', 'control');
      const NATIVE = ['number', 'date', 'time', 'datetime-local', 'email', 'tel', 'url'];
      input.type = NATIVE.indexOf(f.type) >= 0 ? f.type : 'text';
      if (f.type === 'number') {
        input.inputMode = 'numeric';
        if (f.min !== undefined) input.min = f.min;
        if (f.max !== undefined) input.max = f.max;
      }
      input.value = f.default !== undefined ? f.default : '';
    }
    input.id = id;
    input.name = f.key;
    wrap.appendChild(input);
    return {
      wrap: wrap, key: f.key,
      read: function () { return input.value; },
      write: function (v) { input.value = v; }
    };
  }

  /* The query string and the fragment of the link, the fragment winning. The
     share bar puts what it carries after the #, which never reaches a server
     or analytics; the Tool Finder still sends ?text=. */
  const linkParams = () => { const q = new URLSearchParams(location.search); try { const h = new URLSearchParams(location.hash.replace(/^#/, '')); for (const [k, v] of h) q.set(k, v); } catch (e) {} return q; };

  /* The share bar's hand-off: the same three lines in every engine. */
  function announce(state) {
    (window.MVRTool = window.MVRTool || {}).shareState = function () { return state; };
    document.dispatchEvent(new CustomEvent('mvr:result', { detail: state }));
  }

  function renderStats(container, stats) {
    container.textContent = '';
    if (!stats || !stats.length) return;
    stats.forEach(function (row) {
      const r = el('div', 'stat-row');
      r.appendChild(el('span', 'stat-key', row[0]));
      r.appendChild(el('span', 'stat-val', row[1]));
      container.appendChild(r);
    });
  }

  /* ---------------- a rendered preview that cannot run anything ----------------

     The Markdown converter's HTML, shown rendered. The engine already escapes
     raw HTML and refuses unsafe addresses, but the preview does not take its
     word for it. The markup is parsed by DOMParser into a separate, inert
     document — scripts there never run, handlers never fire, nothing loads —
     and then rebuilt here node by node with createElement:
       - only the tags a Markdown converter writes are kept; script, style,
         iframe, svg, form and the like are dropped with their content, and any
         other unknown tag is replaced by its text;
       - no attribute is copied except a link's address, checked by the
         browser's own URL parser (http, https, mailto, tel; a relative one
         resolves to this site), and a code block's language-… class;
       - a picture is never fetched: a remote image would tell its server who
         looked, so it becomes a labelled box naming the address;
       - links open in a new tab, with no referrer and no opener. */
  const PREVIEW_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
    'pre', 'code', 'em', 'strong', 'b', 'i', 'del', 's', 'hr', 'br', 'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td']);
  const PREVIEW_DROP = new Set(['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
    'template', 'noscript', 'svg', 'math', 'link', 'meta', 'base', 'title', 'head', 'form', 'input', 'button',
    'textarea', 'select', 'option', 'audio', 'video', 'source', 'track', 'canvas', 'portal', 'xmp', 'plaintext', 'noembed', 'noframes']);

  function previewHref(href) {
    try {
      const u = new URL(String(href), location.href);
      return ['http:', 'https:', 'mailto:', 'tel:'].indexOf(u.protocol) >= 0 ? u.href : null;
    } catch (e) { return null; }
  }

  function sanitisedPreview(html) {
    const frag = document.createDocumentFragment();
    let doc;
    try { doc = new DOMParser().parseFromString('<!DOCTYPE html><body>' + String(html || ''), 'text/html'); }
    catch (e) { return frag; }
    (function copy(from, to) {
      Array.prototype.forEach.call(from.childNodes, function (n) {
        if (n.nodeType === 3) { to.appendChild(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;                       // comments, processing instructions
        const tag = n.localName;
        if (PREVIEW_DROP.has(tag)) return;
        if (!PREVIEW_TAGS.has(tag)) { copy(n, to); return; }
        if (tag === 'img') {
          const alt = n.getAttribute('alt') || '';
          const box = el('span', 'md-img', 'Image: ' + (alt || 'no description') + ' (not loaded in the preview)');
          const src = n.getAttribute('src');
          if (src) box.title = src;
          to.appendChild(box);
          return;
        }
        const out = document.createElement(tag);
        if (tag === 'a') {
          const href = previewHref(n.getAttribute('href'));
          if (href) {
            out.href = href;
            out.target = '_blank';
            out.rel = 'noopener noreferrer nofollow';
            out.referrerPolicy = 'no-referrer';
          }
        } else if (tag === 'code') {
          const cls = n.getAttribute('class') || '';
          if (/^language-[\w+-]+$/.test(cls)) out.className = cls;
        } else if (tag === 'th' || tag === 'td') {
          // a table column's alignment, from three fixed values only
          const al = /^text-align:(left|center|right)$/.exec(n.getAttribute('style') || '');
          if (al) out.style.textAlign = al[1];
        }
        copy(n, out);
        to.appendChild(out);
      });
    })(doc.body, frag);
    return frag;
  }

  /* ---------------- the shell's shared machinery (wave 3) ----------------

     What every text-in and form-in tool gets from here, without a line of its
     own: a settings memory and a draft memory on the device, share links that
     carry the options as well as the text, a debounced run, a Web Worker for
     big inputs with a Cancel, a gutter that marks the line an error names,
     a small highlighter for the output, undo-safe Load example and Clear,
     keyboard shortcuts, a two-column layout with a draggable divider and a
     full-screen mode.

     A tool's spec can add (all optional):
       download { ext, type, suffix }   what Download saves; getters are read
                                        at click time. A result's own
                                        `download` { ext, type, filename } wins.
       filename                         the saved name, or fn(opts, res)
       files { accept, label }          Open file and drop on the input
       openFile(file, ctx)              a tool that reads files itself (bytes,
                                        streaming); returns a promise
       highlight                        'json' | 'xml' | 'html' | 'css' | 'md'
                                        | 'regex' | 'yaml' | fn(opts, res); a
                                        result's `lang` wins
       worker: false                    never run in the Worker (the default
                                        runs inputs over 50 KB there)
       workerAlways, timeout            always use the Worker; stop after
                                        `timeout` ms (the regex tester)
       autosave: false                  never keep a draft (JWT decoder)
       remember: false                  never keep settings
       gutter                           line numbers on the input (default:
                                        developer tools yes, text tools no)
       share: [keys]                    which options a link carries (default:
                                        every option changed from its default)
       shareText: false                 the input never goes into a share link
                                        (a credential: the JWT decoder)
       mount(ctx), render(res, ctx)     a tool's own controls and views; run in
                                        the page only, never in the Worker
     A result can add: errorAt { line, col } (else read from "line N, column
     M" in the error), lang, download, blob (a binary download), html (unused
     here), and anything its own render() reads. */

  const BIG_INPUT = 50 * 1024;          // over this, the transform runs in the Worker
  const BIG_FILE = 2 * 1024 * 1024;     // an opened file over this stays out of the text box
  const SHOW_MAX = 1024 * 1024;         // the output pane shows at most this much
  const HL_MAX = 300 * 1024;            // and highlights output up to this size
  const DRAFT_MAX = 512 * 1024;         // drafts over this are not kept
  const DEBOUNCE = 120;

  /* One key per tool, versioned: { v, opts, draft: { text, t }, split, … } */
  function toolStore(id) {
    const key = '1234tools-dev:' + id;
    const read = function () {
      try { const o = JSON.parse(localStorage.getItem(key) || 'null'); return o && o.v === 1 ? o : { v: 1 }; }
      catch (e) { return { v: 1 }; }
    };
    return {
      get: function (k) { const o = read(); return k ? o[k] : o; },
      set: function (k, v) {
        try {
          const o = read();
          if (v === undefined || v === null) delete o[k]; else o[k] = v;
          localStorage.setItem(key, JSON.stringify(o));
        } catch (e) { /* storage full or blocked: the tool still works */ }
      }
    };
  }

  /* A checkbox (yes/no), and a range, besides buildField's types. The value
     handed to the engine is always a string, as before. */
  function buildFieldX(f) {
    if (f.type !== 'check') return buildField(f);
    const wrap = el('div', 'field field-check');
    const lab = el('label', 'check-label');
    const input = el('input');
    input.type = 'checkbox';
    input.id = 'f-' + f.key;
    input.name = f.key;
    input.checked = String(f.default) === 'yes';
    lab.appendChild(input);
    lab.appendChild(el('span', null, f.label));
    wrap.appendChild(lab);
    return {
      wrap: wrap, key: f.key,
      read: function () { return input.checked ? 'yes' : 'no'; },
      write: function (v) { input.checked = String(v) === 'yes'; }
    };
  }

  /* Is a value one this field can take? Links and saved settings are both
     untrusted: a select only takes one of its values, numbers stay numbers,
     free text is cut to 300 characters. */
  function validFor(f, v) {
    if (v === null || v === undefined) return null;
    v = String(v);
    if (f.type === 'select') return (f.options || []).some(function (o) { return String(o.value) === v; }) ? v : null;
    if (f.type === 'check') return v === 'yes' || v === 'no' ? v : null;
    if (f.type === 'number') return /^-?\d+(\.\d+)?$/.test(v) ? v : null;
    if (f.type === 'color') return /^#[0-9a-f]{6}$/i.test(v) ? v : null;
    return v.slice(0, f.type === 'textarea' ? 2000 : 300);
  }

  /* Replace a text box's whole value as an edit, so Ctrl+Z brings the old
     text back: execCommand('insertText') where the browser keeps it on the
     undo stack, setRangeText otherwise. Very long text skips the undo stack. */
  function replaceText(ta, text) {
    if (ta.value === text) return;
    if (text.length > 1024 * 1024 || ta.value.length > 1024 * 1024) { ta.value = text; return; }
    const active = document.activeElement;
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = text === '' ? document.execCommand('delete', false) : document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok || ta.value !== text) ta.setRangeText(text, 0, ta.value.length, 'end');
    if (active && active !== ta && active.focus && text === '') active.focus();
  }

  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  /* ---------------- a small highlighter ----------------
     Each language is a scanner that cuts the text into [class, text] runs;
     the runs become spans, so the pane's text is exactly the output. No
     third-party code, and nothing is ever parsed as HTML. */
  const HL = {};

  HL.json = function (s) {
    const out = [];
    const re = /("(?:[^"\\\n]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])|([^"\d\-tfn{}[\],:]+|.)/g;
    let m;
    while ((m = re.exec(s))) {
      if (m[1] !== undefined) { out.push([m[2] !== undefined ? 'key' : 'str', m[1]]); if (m[2]) out.push(['punc', m[2]]); }
      else if (m[3] !== undefined) out.push(['num', m[3]]);
      else if (m[4] !== undefined) out.push(['kw', m[4]]);
      else if (m[5] !== undefined) out.push(['punc', m[5]]);
      else out.push([null, m[0]]);
    }
    return out;
  };

  HL.xml = HL.html = function (s) {
    const out = [];
    const n = s.length;
    let i = 0;
    const push = (c, t) => { if (t) out.push([c, t]); };
    while (i < n) {
      if (s[i] !== '<') {
        let j = s.indexOf('<', i); if (j < 0) j = n;
        const text = s.slice(i, j);
        const re = /&[#\w]+;/g; let last = 0, m;
        while ((m = re.exec(text))) { push(null, text.slice(last, m.index)); push('ent', m[0]); last = m.index + m[0].length; }
        push(null, text.slice(last));
        i = j; continue;
      }
      const ends = (open, close, cls) => {
        if (!s.startsWith(open, i)) return false;
        let j = s.indexOf(close, i + open.length); j = j < 0 ? n : j + close.length;
        push(cls, s.slice(i, j)); i = j; return true;
      };
      if (ends('<!--', '-->', 'com') || ends('<![CDATA[', ']]>', 'str') || ends('<?', '?>', 'meta') || ends('<!', '>', 'meta')) continue;
      // a tag: < or </, a name, attributes, > or />
      const open = s[i + 1] === '/' ? '</' : '<';
      push('punc', open); i += open.length;
      let m = /^[^\s/>]+/.exec(s.slice(i, i + 200));
      if (m) { push('tag', m[0]); i += m[0].length; }
      while (i < n && s[i] !== '>' && s[i] !== '<') {
        if (s[i] === '/' && s[i + 1] === '>') break;
        const rest = s.slice(i, i + 4000);
        if ((m = /^\s+/.exec(rest))) { push(null, m[0]); i += m[0].length; continue; }
        if ((m = /^=/.exec(rest))) { push('punc', '='); i++; continue; }
        if ((m = /^("[^"]*"?|'[^']*'?)/.exec(rest))) { push('str', m[0]); i += m[0].length; continue; }
        m = /^[^\s=>/<"']+/.exec(rest) || /^./.exec(rest);
        push('attr', m[0]); i += m[0].length;
      }
      if (s[i] === '/' && s[i + 1] === '>') { push('punc', '/>'); i += 2; }
      else if (s[i] === '>') { push('punc', '>'); i++; }
    }
    return out;
  };

  HL.css = function (s) {
    const out = [];
    const re = /(\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(@[\w-]+)|(#[0-9a-fA-F]{3,8}\b)|(-?(?:\d+\.?\d*|\.\d+)(?:%|[a-zA-Z]+)?)|([{};:,()])|([\w-]+)|(\s+|.)/g;
    /* a bare declaration (background: …;) outside any block is a property
       when its colon is followed by a space; a:hover is a selector */
    let m, depth = 0, expectProp = false, decl = false;
    while ((m = re.exec(s))) {
      if (m[1] !== undefined) out.push(['com', m[1]]);
      else if (m[2] !== undefined) out.push(['str', m[2]]);
      else if (m[3] !== undefined) out.push(['kw', m[3]]);
      else if (m[4] !== undefined) out.push(['num', m[4]]);
      else if (m[5] !== undefined) out.push([depth || decl ? 'num' : 'tag', m[5]]);
      else if (m[6] !== undefined) {
        const c = m[6];
        if (c === '{') { depth++; expectProp = true; decl = false; } else if (c === '}') { depth = Math.max(0, depth - 1); expectProp = depth > 0; }
        else if (c === ';') { expectProp = depth > 0; decl = false; } else if (c === ':' && depth) expectProp = false;
        out.push(['punc', c]);
      } else if (m[7] !== undefined) {
        const after = s.slice(re.lastIndex).match(/^\s*(.)/);
        if (depth && expectProp && after && after[1] === ':') out.push(['attr', m[7]]);
        else if (!depth && !decl && /^\s*:\s/.test(s.slice(re.lastIndex, re.lastIndex + 3))) { out.push(['attr', m[7]]); decl = true; }
        else if (!depth && !decl) out.push(['tag', m[7]]);
        else out.push([after && after[1] === '(' ? 'kw' : null, m[7]]);
      } else out.push([null, m[8]]);
    }
    return out;
  };

  HL.md = function (s) {
    const out = [];
    let fence = false;
    s.split(/(\n)/).forEach(function (line) {
      if (line === '\n') { out.push([null, line]); return; }
      if (/^\s*(```|~~~)/.test(line)) { fence = !fence; out.push(['str', line]); return; }
      if (fence) { out.push(['str', line]); return; }
      if (/^#{1,6}\s/.test(line)) { out.push(['kw', line]); return; }
      if (/^\s*([-*_]\s*){3,}$/.test(line)) { out.push(['punc', line]); return; }
      let m = /^(\s*(?:>\s*)+)/.exec(line);
      if (m) { out.push(['com', m[1]]); line = line.slice(m[1].length); }
      m = /^(\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)/.exec(line);
      if (m) { out.push(['punc', m[1]]); line = line.slice(m[1].length); }
      const re = /(`+)([\s\S]*?)\1|(\*\*|__)(?=\S)([\s\S]*?\S)\3|(!?\[)([^\]]*)(\]\()([^)]*)(\))|(\[\^[^\]]+\])/g;
      let last = 0;
      while ((m = re.exec(line))) {
        if (m.index > last) out.push([null, line.slice(last, m.index)]);
        if (m[1]) out.push(['str', m[0]]);
        else if (m[3]) out.push(['kw', m[0]]);
        else if (m[5]) { out.push(['punc', m[5]]); out.push([null, m[6]]); out.push(['punc', m[7]]); out.push(['attr', m[8]]); out.push(['punc', m[9]]); }
        else out.push(['attr', m[0]]);
        last = m.index + m[0].length;
      }
      if (last < line.length) out.push([null, line.slice(last)]);
    });
    return out;
  };

  HL.regex = function (s) {
    const out = [];
    const re = /(\\(?:[1-9]\d*|k<[^>]*>|[pP]\{[^}]*\}|u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|c[A-Za-z]|.))|(\[\^?(?:\\.|[^\]\\])*\]?)|(\((?:\?(?:<[=!]|<[A-Za-z_$][\w$]*>|[:=!]))?|\))|([*+?](?:\?)?|\{\d+(?:,\d*)?\}\??)|([\^$|.])|([^\\[\]()*+?{}^$|.]+|.)/g;
    let m;
    while ((m = re.exec(s))) {
      if (m[1]) out.push([/^\\[bB]$/.test(m[1]) ? 'attr' : 'ent', m[1]]);
      else if (m[2]) out.push(['str', m[2]]);
      else if (m[3]) out.push(['kw', m[3]]);
      else if (m[4]) out.push(['num', m[4]]);
      else if (m[5]) out.push([m[5] === '|' ? 'punc' : 'attr', m[5]]);
      else out.push([null, m[0]]);
    }
    return out;
  };

  HL.diff = function (s) {
    const out = [];
    s.split(/(\n)/).forEach(function (line) {
      if (line === '\n' || line === '') { out.push([null, line]); return; }
      if (/^(\+\+\+|---) /.test(line)) out.push(['meta', line]);
      else if (line.charAt(0) === '@') out.push(['key', line]);
      else if (line.charAt(0) === '+') out.push(['str', line]);
      else if (line.charAt(0) === '-') out.push(['kw', line]);
      else out.push([null, line]);
    });
    return out;
  };

  HL.yaml = function (s) {
    const out = [];
    s.split(/(\n)/).forEach(function (line) {
      if (line === '\n') { out.push([null, line]); return; }
      const c = /^(\s*)(#.*)$/.exec(line);
      if (c) { out.push([null, c[1]]); out.push(['com', c[2]]); return; }
      const m = /^(\s*(?:-\s+)*)((?:"[^"]*"|'[^']*'|[^\s:#][^:#]*?)\s*:)(?=\s|$)(.*)$/.exec(line);
      let rest = line;
      if (m) { out.push(['punc', m[1]]); out.push(['key', m[2]]); rest = m[3]; }
      const v = /^(\s*)(.*)$/.exec(rest);
      out.push([null, v[1]]);
      const val = v[2];
      if (/^(-?\d+(\.\d+)?([eE][+-]?\d+)?)$/.test(val)) out.push(['num', val]);
      else if (/^(true|false|null|~)$/.test(val)) out.push(['kw', val]);
      else if (/^["']/.test(val)) out.push(['str', val]);
      else out.push([null, val]);
    });
    return out;
  };

  /** text → a fragment of spans, or null when there is no such language */
  function highlightFragment(lang, text) {
    const fn = HL[lang];
    if (!fn || !text || text.length > HL_MAX) return null;
    let runs;
    try { runs = fn(text); } catch (e) { return null; }
    if (runs.map(function (r) { return r[1]; }).join('') !== text) return null;   // never show anything but the output
    const frag = document.createDocumentFragment();
    let plain = '';
    const flush = function () { if (plain) { frag.appendChild(document.createTextNode(plain)); plain = ''; } };
    runs.forEach(function (r) {
      if (!r[1]) return;
      if (!r[0]) { plain += r[1]; return; }
      flush();
      frag.appendChild(el('span', 'hl-' + r[0], r[1]));
    });
    flush();
    return frag;
  }

  /* ---------------- the Worker ----------------
     engine/render-dev-worker.js loads the page's own engine scripts and runs the
     same transform there, so a 5 MB JSON file or a runaway regex never
     freezes the page. One worker per page, made on first need, ended on
     Cancel or a timeout and made again next time. */
  function engineScripts() {
    return Array.prototype.map.call(document.querySelectorAll('script[src]'), function (s) { return s.src; })
      .filter(function (u) { return /\/engine\/[^/]+\.js(\?|$)/.test(u) && !/\/engine\/(render-[^/]*|zip)\.js/.test(u); });
  }
  function specNamespace(spec) {
    const names = ['DEV_TOOLS', 'TEXT_TOOLS', 'IMAGE_TOOLS'];
    for (let i = 0; i < names.length; i++) { const g = window[names[i]]; if (g && g[spec.id] === spec) return names[i]; }
    return null;
  }
  function makeRunner(spec) {
    let w = null, seq = 0, pending = null;
    const ns = specNamespace(spec);
    const usable = typeof Worker === 'function' && !!ns && spec.worker !== false;
    function end() { if (w) { w.terminate(); w = null; } }
    function start() {
      if (w) return w;
      w = new Worker((window.__BASE__ || '/') + 'engine/render-dev-worker.js');
      w.onmessage = function (e) {
        const d = e.data || {};
        if (!pending || d.job !== pending.job) return;
        const p = pending; pending = null; clearTimeout(p.timer);
        if (d.fallback) p.reject(new Error('fallback')); else p.resolve(d.res || {});
      };
      w.onerror = function (e) {
        e.preventDefault && e.preventDefault();
        end();
        if (pending) { const p = pending; pending = null; clearTimeout(p.timer); p.reject(new Error('fallback')); }
      };
      return w;
    }
    return {
      usable: usable,
      run: function (text, opts, timeout) {
        if (pending) { pending.reject(new Error('superseded')); clearTimeout(pending.timer); pending = null; end(); }
        return new Promise(function (resolve, reject) {
          const job = ++seq;
          pending = { job: job, resolve: resolve, reject: reject, timer: 0 };
          if (timeout) pending.timer = setTimeout(function () {
            if (!pending || pending.job !== job) return;
            pending = null; end(); reject(new Error('timeout'));
          }, timeout);
          try { start().postMessage({ job: job, scripts: engineScripts(), ns: ns, tool: spec.id, text: text, opts: opts }); }
          catch (e) { pending = null; reject(new Error('fallback')); }
        });
      },
      cancel: function () {
        if (pending) { const p = pending; pending = null; clearTimeout(p.timer); p.reject(new Error('cancelled')); }
        end();
      }
    };
  }

  /* ---------------- shortcuts, full screen, the divider ---------------- */

  const SHORTCUTS = [
    ['Ctrl + Enter', 'Run now'],
    ['Ctrl + Shift + C', 'Copy the output'],
    ['Ctrl + S', 'Download the output'],
    ['Esc', 'Close a message, or leave full screen']
  ];
  function shortcutsButton(extra) {
    const wrap = el('div', 'dev-keys-wrap');
    const b = el('button', 'btn-ghost dev-keys-btn', 'Shortcuts');
    b.type = 'button';
    b.setAttribute('aria-expanded', 'false');
    const pop = el('div', 'dev-keys');
    pop.id = 'dev-keys-' + Math.random().toString(36).slice(2, 8);
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Keyboard shortcuts');
    b.setAttribute('aria-controls', pop.id);
    const dl = el('dl');
    SHORTCUTS.concat(extra || []).forEach(function (k) { dl.appendChild(el('dt', null, k[0])); dl.appendChild(el('dd', null, k[1])); });
    pop.appendChild(el('p', 'dev-keys-h', 'Keyboard shortcuts'));
    pop.appendChild(dl);
    pop.appendChild(el('p', 'dev-keys-note', 'On a Mac, use Cmd for Ctrl.'));
    const set = function (open) { pop.hidden = !open; b.setAttribute('aria-expanded', String(open)); };
    b.addEventListener('click', function () { set(pop.hidden); });
    document.addEventListener('click', function (e) { if (!pop.hidden && !wrap.contains(e.target)) set(false); });
    wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); set(false); b.focus(); } });
    wrap.appendChild(b);
    wrap.appendChild(pop);
    return { wrap: wrap, close: function () { set(false); }, isOpen: function () { return !pop.hidden; } };
  }

  function fullScreenButton(io) {
    const b = el('button', 'btn-ghost dev-full-btn', 'Full screen');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    const set = function (on) {
      io.classList.toggle('is-full', on);
      document.documentElement.classList.toggle('dev-full-open', on);
      b.textContent = on ? 'Exit full screen' : 'Full screen';
      b.setAttribute('aria-pressed', String(on));
    };
    b.addEventListener('click', function () { set(!io.classList.contains('is-full')); });
    return { button: b, set: set, isOn: function () { return io.classList.contains('is-full'); } };
  }

  /* The divider between the two columns (900 px and wider): drag it, or
     focus it and use the arrow keys; Home puts it back in the middle. */
  function splitDivider(split, store) {
    const d = el('div', 'dev-divider');
    d.tabIndex = 0;
    d.setAttribute('role', 'separator');
    d.setAttribute('aria-orientation', 'vertical');
    d.setAttribute('aria-label', 'Resize the input and output columns');
    d.setAttribute('aria-valuemin', '20');
    d.setAttribute('aria-valuemax', '80');
    const apply = function (pct, save) {
      pct = Math.max(20, Math.min(80, Math.round(pct)));
      split.style.setProperty('--dev-split', pct + '%');
      d.setAttribute('aria-valuenow', String(pct));
      if (save) store.set('split', pct);
    };
    apply(Number(store.get('split')) || 50, false);
    d.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      d.setPointerCapture && d.setPointerCapture(e.pointerId);
      split.classList.add('is-dragging');
      const move = function (ev) {
        const r = split.getBoundingClientRect();
        if (r.width) apply((ev.clientX - r.left) / r.width * 100, false);
      };
      const up = function () {
        d.removeEventListener('pointermove', move);
        d.removeEventListener('pointerup', up);
        d.removeEventListener('pointercancel', up);
        split.classList.remove('is-dragging');
        apply(Number(d.getAttribute('aria-valuenow')), true);
      };
      d.addEventListener('pointermove', move);
      d.addEventListener('pointerup', up);
      d.addEventListener('pointercancel', up);
    });
    d.addEventListener('keydown', function (e) {
      const now = Number(d.getAttribute('aria-valuenow')) || 50;
      if (e.key === 'ArrowLeft') { e.preventDefault(); apply(now - 5, true); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); apply(now + 5, true); }
      else if (e.key === 'Home') { e.preventDefault(); apply(50, true); }
    });
    return d;
  }

  /* Ctrl+Enter, Ctrl+Shift+C, Ctrl+S and Esc for one tool. Ctrl+S saves the
     output wherever focus is on the page; the others act only when focus is
     inside the tool, so the browser's own Ctrl+Shift+C still works elsewhere. */
  function bindKeys(root, acts) {
    document.addEventListener('keydown', function (e) {
      const mod = e.ctrlKey || e.metaKey;
      const inside = root.contains(document.activeElement) || document.activeElement === document.body;
      if (mod && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); acts.download(); return; }
      if (!inside) return;
      if (mod && e.key === 'Enter') { e.preventDefault(); acts.run(); return; }
      if (mod && e.shiftKey && !e.altKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault(); acts.copy(); return;
      }
      if (e.key === 'Escape' && !e.defaultPrevented) acts.escape(e);
    });
  }

  /* Copy a string, saying so on a button for a moment. */
  function copyText(txt, btn) {
    if (!txt || !navigator.clipboard) return;
    navigator.clipboard.writeText(txt).then(function () {
      if (!btn) return;
      const was = btn.textContent;
      btn.textContent = 'Copied';
      btn.classList.add('ok');
      setTimeout(function () { btn.textContent = was; btn.classList.remove('ok'); }, 1400);
    }, function () {});
  }

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* The output pane's text: shown up to SHOW_MAX, highlighted up to HL_MAX. */
  function showOutput(out, text, lang) {
    out.textContent = '';
    const shown = text.length > SHOW_MAX ? text.slice(0, SHOW_MAX) : text;
    const frag = lang ? highlightFragment(lang, shown) : null;
    if (frag) out.appendChild(frag); else out.textContent = shown;
    out.classList.toggle('is-hl', !!frag);
    return shown.length < text.length;
  }

  /* ---------------- text in, code out ---------------- */

  function mountCode(spec, root) {
    const io = root.querySelector('.tool-io');
    spec.id = spec.id || root.getAttribute('data-tool') || 'tool';
    const store = toolStore(spec.id);
    const isText = !!(window.TEXT_TOOLS && window.TEXT_TOOLS[spec.id] === spec);
    const remember = spec.remember !== false;
    const keepDraft = spec.autosave !== false;
    const runner = makeRunner(spec);
    io.classList.add('dev-io');
    if (isText) io.classList.add('is-prose');

    const optBar = el('div', 'opt-bar');
    const fields = spec.options || [];
    const readers = fields.map(function (o) {
      const f = buildFieldX(o);
      optBar.appendChild(f.wrap);
      return f;
    });
    const fieldOf = {};
    fields.forEach(function (f, i) { fieldOf[f.key] = { f: f, r: readers[i] }; });
    const readOpts = function () { const o = {}; readers.forEach(function (r) { o[r.key] = r.read(); }); return o; };

    /* ---- input pane ---- */
    const inWrap = el('div', 'io-pane io-in');
    const inHead = el('div', 'io-head');
    inHead.appendChild(el('span', 'io-label', spec.inputLabel || 'Input'));
    const inTools = el('div', 'io-actions');
    if (spec.sample) {
      const s = el('button', 'btn-ghost', 'Load example');
      s.type = 'button';
      s.addEventListener('click', function () { setText(spec.sample); });
      inTools.appendChild(s);
    }
    const clr = el('button', 'btn-ghost', 'Clear');
    clr.type = 'button';
    clr.addEventListener('click', function () { setText(''); ta.focus(); });
    inTools.appendChild(clr);
    const keys = shortcutsButton(spec.shortcuts);
    const full = fullScreenButton(io);
    inTools.appendChild(full.button);
    inTools.appendChild(keys.wrap);
    inHead.appendChild(inTools);

    const draftBar = el('div', 'dev-bar dev-draft');
    draftBar.hidden = true;
    const fileBar = el('div', 'dev-bar dev-file');
    fileBar.hidden = true;

    const ta = el('textarea', 'code-area');
    ta.rows = 10;
    ta.spellcheck = false;
    ta.placeholder = spec.placeholder || '';
    ta.setAttribute('aria-label', spec.inputLabel || 'Input');
    if (!isText) { ta.setAttribute('wrap', 'off'); ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocomplete', 'off'); }

    const useGutter = spec.gutter !== undefined ? !!spec.gutter : !isText;
    const codeWrap = el('div', 'code-wrap' + (useGutter ? ' has-gutter' : ''));
    const gutter = el('div', 'code-gutter');
    gutter.setAttribute('aria-hidden', 'true');
    const gutterInner = el('div', 'code-gutter-in');
    gutter.appendChild(gutterInner);
    const mark = el('div', 'code-mark');
    mark.hidden = true;
    const caret = el('div', 'code-caret');
    caret.hidden = true;
    if (useGutter) codeWrap.appendChild(gutter);
    const field = el('div', 'code-field');
    field.appendChild(ta);
    field.appendChild(caret);
    codeWrap.appendChild(field);
    codeWrap.appendChild(mark);

    const busy = el('div', 'dev-bar dev-busy');
    busy.hidden = true;
    busy.setAttribute('role', 'status');
    const busyText = el('span', 'dev-busy-text');
    const busyCancel = el('button', 'btn-ghost', 'Cancel');
    busyCancel.type = 'button';
    busy.appendChild(el('span', 'dev-spin'));
    busy.appendChild(busyText);
    busy.appendChild(busyCancel);

    inWrap.appendChild(inHead);
    inWrap.appendChild(draftBar);
    inWrap.appendChild(fileBar);
    inWrap.appendChild(codeWrap);
    inWrap.appendChild(busy);

    /* ---- files: Open, drop, and a big-file mode ---- */
    let openedName = null, bigText = null;
    if (spec.files || spec.openFile) {
      const picker = el('input', 'visually-hidden');
      picker.type = 'file';
      picker.accept = (spec.files && spec.files.accept) || '';
      picker.tabIndex = -1;
      picker.setAttribute('aria-hidden', 'true');
      const ob = el('button', 'btn-ghost', (spec.files && spec.files.label) || 'Open file');
      ob.type = 'button';
      ob.addEventListener('click', function () { picker.click(); });
      picker.addEventListener('change', function () { readFile(picker.files[0]); picker.value = ''; });
      inTools.insertBefore(ob, inTools.firstChild);
      inWrap.appendChild(picker);
      ['dragenter', 'dragover'].forEach(function (ev) {
        codeWrap.addEventListener(ev, function (e) {
          if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); ta.classList.add('over'); }
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) { codeWrap.addEventListener(ev, function () { ta.classList.remove('over'); }); });
      codeWrap.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); readFile(e.dataTransfer.files[0]); }
      });
    }
    function readFile(f) {
      if (!f) return;
      if (spec.openFile) {
        openedName = f.name;
        Promise.resolve(spec.openFile(f, ctx)).catch(function (e) {
          showMessage('error', f.name + ' could not be read: ' + ((e && e.message) || 'unknown error') + '.');
        });
        return;
      }
      f.text().then(function (t) {
        openedName = f.name;
        touched = true;
        if (t.length > BIG_FILE) {
          bigText = t;
          ta.value = '';
          fileBar.textContent = '';
          fileBar.appendChild(el('span', null, f.name + ' (' + fmtSize(f.size) + ') is loaded but not shown in the box, so the page stays quick. The output and Download use all of it.'));
          const show = el('button', 'btn-ghost', 'Show it in the box');
          show.type = 'button';
          show.addEventListener('click', function () { ta.value = bigText; bigText = null; fileBar.hidden = true; runNow(); });
          const close = el('button', 'btn-ghost', 'Close file');
          close.type = 'button';
          close.addEventListener('click', function () { bigText = null; openedName = null; fileBar.hidden = true; runNow(); });
          fileBar.appendChild(show);
          fileBar.appendChild(close);
          fileBar.hidden = false;
          runNow();
        } else {
          bigText = null;
          fileBar.hidden = true;
          setText(t);
        }
      }, function () {
        showMessage('error', f.name + ' could not be read as text.');
      });
    }
    const currentText = function () { return bigText !== null ? bigText : ta.value; };

    /* ---- output pane ---- */
    const outWrap = el('div', 'io-pane io-out');
    const outHead = el('div', 'io-head');
    outHead.appendChild(el('span', 'io-label', spec.outputLabel || 'Output'));
    const outTools = el('div', 'io-actions');
    const copyBtn = el('button', 'btn-copy', 'Copy');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', function () { settle(function () { copyText(lastOutput, copyBtn); }); });
    outTools.appendChild(copyBtn);
    const dlBtn = el('button', 'btn-download', 'Download');
    dlBtn.type = 'button';
    dlBtn.addEventListener('click', function () { settle(download); });
    outTools.appendChild(dlBtn);
    const expand = el('button', 'btn-ghost dev-expand', 'Expand');
    expand.type = 'button';
    expand.setAttribute('aria-pressed', 'false');
    expand.addEventListener('click', function () {
      const on = !outWrap.classList.contains('is-expanded');
      outWrap.classList.toggle('is-expanded', on);
      expand.setAttribute('aria-pressed', String(on));
      expand.textContent = on ? 'Collapse' : 'Expand';
    });
    outTools.appendChild(expand);
    outHead.appendChild(outTools);
    const out = el('pre', 'code-out');
    out.tabIndex = 0;
    out.setAttribute('aria-label', spec.outputLabel || 'Output');
    const msg = el('div', 'io-msg');
    msg.setAttribute('aria-live', 'polite');
    const jump = el('div', 'dev-jump');
    jump.hidden = true;
    const clip = el('div', 'dev-clip');
    clip.hidden = true;
    const stats = el('div', 'stat-grid');
    outWrap.appendChild(outHead);
    outWrap.appendChild(msg);
    outWrap.appendChild(jump);
    outWrap.appendChild(out);
    outWrap.appendChild(clip);
    outWrap.appendChild(stats);

    /* ---- layout: options, then input | divider | output ---- */
    const split = el('div', 'dev-split');
    split.appendChild(inWrap);
    split.appendChild(splitDivider(split, store));
    split.appendChild(outWrap);
    io.appendChild(optBar);
    io.appendChild(split);
    if (!fields.length) optBar.hidden = true;

    /* A tool that writes HTML (the Markdown converter) also shows it
       rendered, through sanitisedPreview: never as innerHTML. */
    let preview = null;
    if (spec.livePreview) {
      const pWrap = el('div', 'io-pane io-preview');
      const pHead = el('div', 'io-head');
      pHead.appendChild(el('span', 'io-label', 'Preview'));
      preview = el('div', 'md-preview');
      pWrap.appendChild(pHead);
      pWrap.appendChild(preview);
      io.appendChild(pWrap);
    }
    const extra = el('div', 'dev-extra');
    io.appendChild(extra);

    /* ---- state ---- */
    let touched = false, fromLink = false, lastOutput = '', lastRes = {}, timer = 0, job = 0, inflight = null;
    /* Copy and Download act on the text as it is now: a run still waiting
       out the typing pause is made first, a Worker run is waited for. */
    function settle(fn) {
      if (timer) runNow();
      if (inflight) inflight.then(fn, fn); else fn();
    }

    function shareParams() {
      const p = {};
      const t = ta.value;
      if (spec.shareText === false) return {};
      if (bigText === null && t && t.length <= 300) p.text = t;
      const keysToShare = spec.share || fields.map(function (f) { return f.key; });
      keysToShare.forEach(function (k) {
        const x = fieldOf[k];
        if (!x) return;
        const v = x.r.read();
        if (String(v) !== String(x.f.default === undefined ? '' : x.f.default) && String(v).length <= 300) p[k] = v;
      });
      /* options alone, with no text, are not worth a link */
      return p.text !== undefined ? p : {};
    }
    function share() {
      announce({ kind: 'code', params: shareParams(), summary: null, changed: touched || fromLink });
    }

    function showMessage(kind, text) {
      msg.textContent = text || '';
      msg.className = 'io-msg' + (kind && text ? ' is-' + kind : '');
    }

    function download() {
      const opts = readOpts();
      const d = (lastRes && lastRes.download) || spec.download || { ext: 'txt', type: 'text/plain' };
      const ext = d.ext || 'txt';
      let name = d.filename;
      if (!name) {
        if (openedName && spec.download) name = openedName.replace(/\.[^.]+$/, '') + (d.suffix || '') + '.' + ext;
        else if (spec.filename) name = typeof spec.filename === 'function' ? spec.filename(opts, lastRes) : spec.filename;
        else name = spec.id + '-output.' + ext;
      }
      const blob = lastRes && lastRes.blob instanceof Blob ? lastRes.blob : (lastOutput ? new Blob([lastOutput], { type: d.type || 'text/plain' }) : null);
      if (!blob) { showMessage('note', 'There is no output to download yet.'); return; }
      saveBlob(blob, name);
    }

    /* ---- the gutter and the error mark ---- */
    let lineH = 0, padT = 0, padL = 0, charW = 0;
    function metrics() {
      const cs = getComputedStyle(ta);
      lineH = parseFloat(cs.lineHeight) || 20;
      padT = parseFloat(cs.paddingTop) || 0;
      padL = parseFloat(cs.paddingLeft) || 0;
      try {
        const c = document.createElement('canvas').getContext('2d');
        c.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        charW = c.measureText('0000000000').width / 10;
      } catch (e) { charW = parseFloat(cs.fontSize) * 0.6; }
      gutterInner.style.paddingTop = cs.paddingTop;
      gutterInner.style.lineHeight = cs.lineHeight;
      gutterInner.style.fontSize = cs.fontSize;
    }
    let gutterLines = 0;
    function paintGutter() {
      if (!useGutter) return;
      if (!lineH) metrics();
      const text = ta.value;
      let n = 1;
      for (let i = text.indexOf('\n'); i >= 0 && n < 200000; i = text.indexOf('\n', i + 1)) n++;
      if (n === gutterLines) return;
      gutterLines = n;
      const parts = new Array(n);
      for (let i = 0; i < n; i++) parts[i] = i + 1;
      gutterInner.textContent = parts.join('\n');
      gutter.style.width = (String(n).length + 2) + 'ch';
    }
    let errAt = null;
    function placeMark() {
      if (!errAt) { mark.hidden = true; caret.hidden = true; return; }
      if (!lineH) metrics();
      const top = padT + (errAt.line - 1) * lineH - ta.scrollTop;
      const visible = top > -lineH && top < ta.clientHeight;
      mark.hidden = !visible;
      mark.style.top = (top + ta.offsetTop) + 'px';
      mark.style.height = lineH + 'px';
      caret.hidden = !visible || !errAt.col;
      if (errAt.col) {
        const line = ta.value.split('\n')[errAt.line - 1] || '';
        const tab = parseInt(getComputedStyle(ta).tabSize, 10) || 2;
        let vis = 0;
        for (let i = 0; i < errAt.col - 1 && i < line.length; i++) vis = line[i] === '\t' ? (Math.floor(vis / tab) + 1) * tab : vis + 1;
        caret.style.left = (padL + vis * charW - ta.scrollLeft) + 'px';
        caret.style.top = top + 'px';
        caret.style.height = lineH + 'px';
      }
    }
    ta.addEventListener('scroll', function () {
      gutterInner.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
      placeMark();
    });
    function setError(res) {
      errAt = null;
      jump.hidden = true;
      jump.textContent = '';
      if (bigText !== null) { placeMark(); return; }
      let at = res && res.errorAt;
      if (!at && res && res.error) {
        const m = /\bline (\d+)(?:,? column (\d+))?/i.exec(String(res.error));
        if (m) at = { line: Number(m[1]), col: m[2] ? Number(m[2]) : 0 };
      }
      const lines = ta.value.split('\n').length;
      if (at && at.line >= 1 && at.line <= lines) {
        errAt = { line: at.line, col: at.col || 0 };
        const b = el('button', 'btn-ghost', 'Go to line ' + errAt.line + (errAt.col ? ', column ' + errAt.col : ''));
        b.type = 'button';
        b.addEventListener('click', function () {
          const before = ta.value.split('\n').slice(0, errAt.line - 1).join('\n').length + (errAt.line > 1 ? 1 : 0);
          const pos = before + Math.max(0, errAt.col - 1);
          ta.focus();
          ta.setSelectionRange(pos, pos + 1 <= ta.value.length ? pos + 1 : pos);
          if (!lineH) metrics();
          ta.scrollTop = Math.max(0, (errAt.line - 1) * lineH - ta.clientHeight / 2);
          placeMark();
        });
        jump.appendChild(b);
        jump.hidden = false;
      }
      placeMark();
    }

    /* ---- running ---- */
    function langOf(res, opts) {
      if (res.lang !== undefined) return res.lang;
      return typeof spec.highlight === 'function' ? spec.highlight(opts, res) : spec.highlight || null;
    }

    function paint(res, opts) {
      lastRes = res || {};
      res = lastRes;
      /* a result that holds bytes (a decoded file) downloads those exact bytes */
      if (res.bytes && !res.blob && typeof Blob === 'function') res.blob = new Blob([res.bytes], { type: res.mime || 'application/octet-stream' });
      showMessage('', '');
      if (preview) preview.textContent = '';
      clip.hidden = true;
      if (res.error) {
        lastOutput = '';
        out.textContent = '';
        showMessage('error', res.error);
        renderStats(stats, null);
      } else {
        if (res.note) showMessage('note', res.note);
        if (res.warn) showMessage('warn', res.warn);
        lastOutput = res.output || '';
        const cut = showOutput(out, lastOutput, langOf(res, opts));
        if (cut) {
          clip.textContent = 'Showing the first ' + fmtSize(SHOW_MAX) + ' of ' + fmtSize(lastOutput.length) + '. Copy and Download take all of it.';
          clip.hidden = false;
        }
        if (preview && res.preview) preview.appendChild(sanitisedPreview(res.preview));
        renderStats(stats, res.stats);
      }
      setError(res);
      if (spec.render) {
        try { spec.render(res, ctx); } catch (e) { if (window.console) console.error(e); }
      }
    }

    function runMain(text, opts) {
      let res;
      try { res = spec.transform(text, opts) || {}; }
      catch (e) { res = { error: 'Something went wrong processing that input.' }; }
      return res;
    }

    let busyTimer = 0;
    function busyOn(label) {
      clearTimeout(busyTimer);
      busyTimer = setTimeout(function () { busyText.textContent = label; busy.hidden = false; }, 300);
    }
    function busyOff() { clearTimeout(busyTimer); busy.hidden = true; }
    busyCancel.addEventListener('click', function () {
      job++;
      inflight = null;
      runner.cancel();
      busyOff();
      paint({ warn: 'Stopped. Change the input or the options, or press Ctrl+Enter, to run it again.' }, readOpts());
    });

    function runNow() {
      clearTimeout(timer);
      timer = 0;
      const text = currentText();
      const opts = readOpts();
      paintGutter();
      const my = ++job;
      const big = text.length > BIG_INPUT;
      if (runner.usable && (spec.workerAlways || big)) {
        busyOn(big ? 'Working on ' + fmtSize(text.length) + ' of input…' : 'Working…');
        inflight = runner.run(text, opts, spec.timeout).then(function (res) {
          if (my !== job) return;
          inflight = null;
          busyOff();
          paint(res, opts);
        }, function (e) {
          if (my !== job) return;
          inflight = null;
          busyOff();
          const why = e && e.message;
          if (why === 'timeout') {
            paint({ error: spec.timeoutMessage || ('Stopped after ' + (spec.timeout / 1000) + ' seconds: this is taking too long.') }, opts);
          } else if (why === 'fallback') {
            paint(runMain(text, opts), opts);
          }
        });
      } else {
        runner.cancel();
        inflight = null;
        busyOff();
        paint(runMain(text, opts), opts);
      }
      share();
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(runNow, DEBOUNCE);
    }

    /* Load example, Clear, a file, a restored draft: one undoable edit. */
    function setText(t) {
      touched = true;
      bigText = null;
      fileBar.hidden = true;
      replaceText(ta, t);
      runNow();
      saveDraft();
    }

    /* ---- drafts and settings on this device ---- */
    let draftTimer = 0;
    function saveDraft() {
      if (!keepDraft) return;
      clearTimeout(draftTimer);
      draftTimer = setTimeout(function () {
        const t = ta.value;
        if (!t || t === spec.sample) store.set('draft', null);
        else if (t.length <= DRAFT_MAX) store.set('draft', { text: t, t: Date.now() });
      }, 600);
    }
    function saveOpts() { if (remember) store.set('opts', readOpts()); }
    function offerDraft() {
      if (!keepDraft) { store.set('draft', null); return; }
      const d = store.get('draft');
      if (!d || typeof d.text !== 'string' || !d.text || d.text === ta.value) return;
      draftBar.textContent = '';
      let when = '';
      try { when = new Date(d.t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { /* no date */ }
      draftBar.appendChild(el('span', null, 'You have text from ' + (when || 'earlier') + ' saved on this device (' + d.text.length.toLocaleString('en-GB') + ' characters).'));
      const yes = el('button', 'btn-ghost', 'Restore it');
      yes.type = 'button';
      yes.addEventListener('click', function () { draftBar.hidden = true; setText(d.text); });
      const no = el('button', 'btn-ghost', 'Discard');
      no.type = 'button';
      no.addEventListener('click', function () { draftBar.hidden = true; store.set('draft', null); });
      draftBar.appendChild(yes);
      draftBar.appendChild(no);
      draftBar.hidden = false;
    }

    /* ---- the context a tool's own mount() and render() get ---- */
    const ctx = {
      spec: spec, root: root, io: io, input: ta, output: out, msg: msg, stats: stats, optBar: optBar,
      inputPane: inWrap, outputPane: outWrap, outputTools: outTools, inputTools: inTools, extra: extra, split: split,
      el: el, store: store, highlight: highlightFragment, saveBlob: saveBlob, copyText: copyText, fmtSize: fmtSize,
      get text() { return currentText(); },
      get result() { return lastRes; },
      get openedName() { return openedName; },
      set openedName(v) { openedName = v; },
      opts: readOpts,
      setText: setText,
      setOption: function (k, v) { const x = fieldOf[k]; if (x) { x.r.write(v); saveOpts(); } },
      run: runNow,
      message: showMessage,
      busy: function (label, onCancel) {
        busyText.textContent = label;
        busy.hidden = false;
        const prev = busyCancel.onclick;
        busyCancel.onclick = onCancel || null;
        return {
          update: function (l) { busyText.textContent = l; },
          done: function () { busy.hidden = true; busyCancel.onclick = prev; }
        };
      },
      show: function (res) { paint(res || {}, readOpts()); share(); },
      bigText: function (t, name) { bigText = t; ta.value = ''; openedName = name || openedName; runNow(); }
    };

    /* ---- the starting state: link, else saved settings; then the draft ---- */
    let link = null;
    try { link = linkParams(); } catch (e) { link = null; }
    const given = link ? link.get('text') : null;
    if (given !== null) ta.value = given.slice(0, 4000).replace(/[\uD800-\uDBFF]$/, '');
    fromLink = given !== null && given !== '';
    const linkOpts = {};
    if (link) fields.forEach(function (f) { const v = validFor(f, link.get(f.key)); if (v !== null) linkOpts[f.key] = v; });
    const hasLinkOpts = Object.keys(linkOpts).length > 0;
    if (!fromLink && !hasLinkOpts && remember) {
      const saved = store.get('opts') || {};
      fields.forEach(function (f) { const v = validFor(f, saved[f.key]); if (v !== null) fieldOf[f.key].r.write(v); });
    }
    Object.keys(linkOpts).forEach(function (k) { fieldOf[k].r.write(linkOpts[k]); });

    if (spec.mount) { try { spec.mount(ctx); } catch (e) { if (window.console) console.error(e); } }

    ta.addEventListener('input', function () {
      touched = true;
      if (bigText !== null) { bigText = null; fileBar.hidden = true; }
      if (errAt) { errAt = null; placeMark(); }
      paintGutter();
      share();
      saveDraft();
      schedule();
    });
    const optChanged = function (e) {
      if (e && e.target && e.target.closest && !e.target.closest('.opt-bar')) return;
      touched = true; saveOpts(); runNow();
    };
    optBar.addEventListener('input', function (e) {
      // free text options (a regex pattern) are typed: debounce them like the input
      const t = e.target;
      if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /^(text|search|)$/.test(t.type)))) { touched = true; saveOpts(); schedule(); return; }
      optChanged(e);
    });
    optBar.addEventListener('change', optChanged);
    window.addEventListener('resize', function () { lineH = 0; if (useGutter) metrics(); placeMark(); });

    bindKeys(root, {
      run: runNow,
      copy: function () { settle(function () { copyText(lastOutput, copyBtn); }); },
      download: function () { settle(download); },
      escape: function (e) {
        if (keys.isOpen()) { keys.close(); return; }
        if (full.isOn()) { full.set(false); e.preventDefault(); return; }
        if (msg.textContent) { showMessage('', ''); jump.hidden = true; }
      }
    });

    paintGutter();
    runNow();
    if (!fromLink) offerDraft();
  }

  /* ---------------- form in, markup out ---------------- */

  function mountGenerate(spec, root) {
    const io = root.querySelector('.tool-io');
    spec.id = spec.id || root.getAttribute('data-tool') || 'tool';
    const store = toolStore(spec.id);
    const remember = spec.remember !== false;
    io.classList.add('dev-io', 'dev-gen');

    const form = el('div', 'gen-form');
    const fields = spec.fields || [];
    const readers = fields.map(function (f) {
      const b = buildFieldX(f);
      form.appendChild(b.wrap);
      return b;
    });
    const fieldOf = {};
    fields.forEach(function (f, i) { fieldOf[f.key] = { f: f, r: readers[i] }; });
    const readFields = function () { const o = {}; readers.forEach(function (r) { o[r.key] = r.read(); }); return o; };
    /* what is kept on the device: every field except those that say remember: false (a password to check) */
    const savableFields = function () { const o = readFields(); fields.forEach(function (f) { if (f.remember === false) delete o[f.key]; }); return o; };
    if (spec.regenerate) {
      const again = el('button', 'btn-primary', 'Generate again');
      again.type = 'button';
      again.addEventListener('click', run);
      form.appendChild(again);
    }

    const outWrap = el('div', 'io-pane io-out');
    const head = el('div', 'io-head');
    head.appendChild(el('span', 'io-label', spec.outputLabel || 'Output'));
    const acts = el('div', 'io-actions');
    const copyBtn = el('button', 'btn-copy', 'Copy');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', function () { copyText(lastOutput, copyBtn); });
    acts.appendChild(copyBtn);
    const dlBtn = el('button', 'btn-download', 'Download');
    dlBtn.type = 'button';
    dlBtn.addEventListener('click', download);
    acts.appendChild(dlBtn);
    const keys = shortcutsButton(spec.regenerate ? [['Ctrl + Enter', 'Generate again']] : null);
    acts.appendChild(keys.wrap);
    head.appendChild(acts);

    const swatch = el('div', 'swatch-preview');
    swatch.hidden = true;
    const gradient = el('div', 'gradient-preview');
    gradient.hidden = true;
    const msg = el('div', 'io-msg');
    msg.setAttribute('aria-live', 'polite');
    const out = el('pre', 'code-out');
    out.tabIndex = 0;
    out.setAttribute('aria-label', spec.outputLabel || 'Output');
    const stats = el('div', 'stat-grid');
    const extra = el('div', 'dev-extra');

    outWrap.appendChild(head);
    outWrap.appendChild(swatch);
    outWrap.appendChild(gradient);
    outWrap.appendChild(msg);
    outWrap.appendChild(out);
    outWrap.appendChild(stats);

    io.appendChild(form);
    io.appendChild(outWrap);
    io.appendChild(extra);

    let lastOutput = '', lastRes = {}, touched = false, fromLink = false;

    function shareParams() {
      if (spec.shareable === false) return {};
      const p = {};
      (spec.share || fields.map(function (f) { return f.key; })).forEach(function (k) {
        const x = fieldOf[k];
        if (!x) return;
        const v = x.r.read();
        if (String(v) !== String(x.f.default === undefined ? '' : x.f.default) && String(v).length <= 300) p[k] = v;
      });
      return p;
    }

    function download() {
      const f = readFields();
      const d = (lastRes && lastRes.download) || spec.download || {};
      let name = d.filename || (typeof spec.filename === 'function' ? spec.filename(f, lastRes) : spec.filename);
      if (!name) name = spec.id + '.' + (d.ext || 'txt');
      const blob = lastRes && lastRes.blob instanceof Blob ? lastRes.blob : (lastOutput ? new Blob([lastOutput], { type: d.type || 'text/plain' }) : null);
      if (!blob) return;
      saveBlob(blob, name);
    }

    function langOf(res, f) {
      if (res.lang !== undefined) return res.lang;
      return typeof spec.highlight === 'function' ? spec.highlight(f, res) : spec.highlight || null;
    }

    function run() {
      const f = readFields();
      let res;
      try { res = spec.generate(f) || {}; }
      catch (e) { res = { error: 'Could not generate output from those values.' }; }
      lastRes = res;

      msg.textContent = '';
      msg.className = 'io-msg';
      swatch.hidden = true;
      gradient.hidden = true;

      if (res.error) {
        lastOutput = '';
        out.textContent = '';
        msg.textContent = res.error;
        msg.className = 'io-msg is-error';
        renderStats(stats, null);
      } else {
        if (res.warn) { msg.textContent = res.warn; msg.className = 'io-msg is-warn'; }
        if (res.swatch) {
          swatch.hidden = false;
          swatch.style.background = res.swatch.bg;
          swatch.style.color = res.swatch.fg;
          swatch.textContent = 'Sample text on this background — 21px';
        }
        if (res.preview) {
          gradient.hidden = false;
          gradient.style.background = res.preview;
        }
        lastOutput = res.output || '';
        showOutput(out, lastOutput, langOf(res, f));
        renderStats(stats, res.stats);
      }
      if (spec.render) {
        try { spec.render(res, ctx); } catch (e) { if (window.console) console.error(e); }
      }
      announce({ kind: 'gen', params: shareParams(), summary: null, changed: touched || fromLink });
    }

    const ctx = {
      spec: spec, root: root, io: io, form: form, output: out, msg: msg, stats: stats, outputPane: outWrap,
      outputTools: acts, extra: extra, swatch: swatch, gradient: gradient,
      el: el, store: store, highlight: highlightFragment, saveBlob: saveBlob, copyText: copyText, fmtSize: fmtSize,
      get result() { return lastRes; },
      fields: readFields,
      setField: function (k, v) { const x = fieldOf[k]; if (x) { x.r.write(v); if (remember) store.set('opts', savableFields()); } },
      run: run
    };

    /* the link's fields win; otherwise the ones saved on this device */
    let link = null;
    try { link = linkParams(); } catch (e) { link = null; }
    const linkF = {};
    if (link) fields.forEach(function (f) { const v = validFor(f, link.get(f.key)); if (v !== null) linkF[f.key] = v; });
    fromLink = Object.keys(linkF).length > 0;
    if (!fromLink && remember) {
      const saved = store.get('opts') || {};
      fields.forEach(function (f) {
        if (f.remember === false) return;
        const v = validFor(f, saved[f.key]);
        if (v !== null) fieldOf[f.key].r.write(v);
      });
    }
    Object.keys(linkF).forEach(function (k) { fieldOf[k].r.write(linkF[k]); });

    if (spec.mount) { try { spec.mount(ctx); } catch (e) { if (window.console) console.error(e); } }

    const changed = function () { touched = true; if (remember) store.set('opts', savableFields()); run(); };
    form.addEventListener('input', changed);
    form.addEventListener('change', changed);

    bindKeys(root, {
      run: run,
      copy: function () { copyText(lastOutput, copyBtn); },
      download: download,
      escape: function () {
        if (keys.isOpen()) { keys.close(); return; }
        if (msg.textContent) { msg.textContent = ''; msg.className = 'io-msg'; }
      }
    });
    run();
  }

  /* ---------------- file in, images out ---------------- */

  const FAVICON_SIZES = [
    [16, 'favicon-16x16.png', 'Browser tab'],
    [32, 'favicon-32x32.png', 'Tab, retina'],
    [48, 'favicon-48x48.png', 'Windows shortcut'],
    [96, 'favicon-96x96.png', 'Android tab'],
    [180, 'apple-touch-icon.png', 'iOS home screen'],
    [192, 'icon-192.png', 'Android / PWA'],
    [512, 'icon-512.png', 'PWA splash'],
    [512, 'icon-maskable-512.png', 'Android maskable']
  ];

  function mountFile(spec, root) {
    const io = root.querySelector('.tool-io');
    const isFavicon = spec.kind === 'favicon';

    const drop = el('div', 'dropzone');
    drop.tabIndex = 0;
    drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Choose an image</strong><span>or drag one here — it stays on your device</span>';
    const file = el('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.className = 'visually-hidden';
    drop.appendChild(file);

    const opts = el('div', 'opt-bar');
    let readers = [];
    if (!isFavicon) {
      [
        { key: 'width', label: 'Width (px, 0 = auto)', type: 'number', default: 1200, min: 0 },
        { key: 'height', label: 'Height (px, 0 = auto)', type: 'number', default: 0, min: 0 },
        { key: 'format', label: 'Format', type: 'select', default: 'image/webp',
          options: [{ value: 'image/webp', label: 'WebP (smallest)' }, { value: 'image/jpeg', label: 'JPEG' }, { value: 'image/png', label: 'PNG' }] },
        { key: 'quality', label: 'Quality (1–100)', type: 'number', default: 80, min: 1, max: 100 }
      ].forEach(function (f) {
        const b = buildField(f);
        opts.appendChild(b.wrap);
        readers.push(b);
      });
    } else {
      const b = buildField({ key: 'bg', label: 'Background (for transparent images)', type: 'color', default: '#ffffff' });
      opts.appendChild(b.wrap);
      readers.push(b);
      const n = buildField({ key: 'appname', label: 'Site name (for site.webmanifest)', type: 'text', default: '' });
      opts.appendChild(n.wrap);
      readers.push(n);
    }

    const msg = el('div', 'io-msg');
    const results = el('div', 'file-results');
    const acts = el('div', 'io-actions');
    const stats = el('div', 'stat-grid');

    io.appendChild(drop);
    io.appendChild(opts);
    io.appendChild(msg);
    io.appendChild(results);
    io.appendChild(acts);
    io.appendChild(stats);

    let sourceImg = null, sourceFile = null, headPane = null, renderSeq = 0;

    /* A favicon tool's own sources and files (wave 3): spec.mount(ctx) adds
       controls; ctx.setSource(canvasOrImage, label) uses a drawing made on
       the page (text, an emoji) in place of an uploaded image;
       spec.prefix(ctx) is the path the snippet and manifest point at;
       spec.extraFiles(ctx, { bg, files, prefix }) resolves to
       { files: [{ name, blob, tag, use }], links: ['<link …>'] } for more
       files in the cards, the ZIP and the snippet; spec.render(ctx, info)
       runs after each render. */
    const fctx = {
      spec: spec, root: root, io: io, drop: drop, opts: opts, msg: msg, results: results, acts: acts, stats: stats,
      el: el, store: toolStore(spec.id || 'favicon'), fmtBytes: fmtBytes, downloadButton: downloadButton, copyButton: copyButton,
      option: function (k) { const x = readers.find(function (q) { return q.key === k; }); return x ? x.read() : undefined; },
      get source() { return sourceImg; },
      setSource: function (drawable, label, fromFile) {
        sourceImg = drawable;
        sourceFile = fromFile || null;
        if (label) {
          drop.innerHTML = '';
          drop.appendChild(el('strong', null, label));
          drop.appendChild(el('span', null, 'or choose an image instead — it stays on your device'));
          drop.appendChild(file);
        }
        if (sourceImg) render(); else { results.textContent = ''; acts.textContent = ''; if (headPane) { headPane.remove(); headPane = null; } renderStats(stats, null); }
      },
      render: function () { if (sourceImg) render(); },
      get file() { return sourceFile; },
      get bgField() { return readers[0].wrap; }
    };

    drop.addEventListener('click', function () { file.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); }
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) load(f);
    });
    file.addEventListener('change', function () { if (file.files[0]) load(file.files[0]); });
    opts.addEventListener('input', function () { if (sourceImg) render(); });
    opts.addEventListener('change', function () { if (sourceImg) render(); });
    if (spec.mount) { try { spec.mount(fctx); } catch (e) { if (window.console) console.error(e); } }

    function load(f) {
      if (!/^image\//.test(f.type)) {
        msg.textContent = 'That is not an image file. Choose a PNG, JPEG, SVG or WebP.';
        msg.className = 'io-msg is-error';
        return;
      }
      sourceFile = f;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = function () {
        sourceImg = img;
        drop.innerHTML = '<strong>' + f.name + '</strong><span>' +
          img.naturalWidth + '×' + img.naturalHeight + ' · ' + fmtBytes(f.size) +
          ' — click to choose another</span>';
        drop.appendChild(file);
        render();
      };
      img.onerror = function () {
        msg.textContent = 'That image could not be read. It may be corrupt or an unsupported format.';
        msg.className = 'io-msg is-error';
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }

    function drawTo(size, bg, maskable) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size); }
      ctx.imageSmoothingQuality = 'high';
      // contain, centred; maskable icons get an 80% safe zone
      const inset = maskable ? size * 0.1 : 0;
      const box = size - inset * 2;
      const sw = sourceImg.naturalWidth || sourceImg.width, sh = sourceImg.naturalHeight || sourceImg.height;
      const r = Math.min(box / sw, box / sh);
      const w = sw * r, h = sh * r;
      ctx.drawImage(sourceImg, (size - w) / 2, (size - h) / 2, w, h);
      return c;
    }

    async function render() {
      const my = ++renderSeq;
      results.textContent = '';
      acts.textContent = '';
      msg.textContent = '';
      msg.className = 'io-msg';
      if (headPane) { headPane.remove(); headPane = null; }

      if (isFavicon) {
        const bg = (spec.background && spec.background(fctx)) || readers[0].read();
        const prefix = (spec.prefix ? spec.prefix(fctx) : '/') || '/';
        const files = [];
        for (const [size, name, use] of FAVICON_SIZES) {
          let canvas = null;
          if (spec.drawIcon) { try { canvas = spec.drawIcon(fctx, size, name); } catch (e) { canvas = null; if (window.console) console.error(e); } }
          if (!canvas) canvas = drawTo(size, bg, name.indexOf('maskable') > -1);
          const blob = await new Promise(function (r) { canvas.toBlob(r, 'image/png'); });
          if (my !== renderSeq) return;   // a newer render has started
          files.push({ name: name, blob: blob, size: size });

          const card = el('div', 'file-card');
          const thumb = el('div', 'file-thumb');
          thumb.appendChild(canvas);
          canvas.style.width = Math.min(64, size) + 'px';
          canvas.style.height = Math.min(64, size) + 'px';
          card.appendChild(thumb);
          card.appendChild(el('strong', null, size + '×' + size));
          card.appendChild(el('span', 'file-use', use));
          card.appendChild(el('span', 'file-size', fmtBytes(blob.size)));
          const d = downloadButton('Save', name, function () { return blob; });
          d.className = 'btn-ghost';
          card.appendChild(d);
          results.appendChild(card);
        }

        /* favicon.ico and site.webmanifest are made here too, so the snippet
           below names exactly the files in the ZIP and nothing else. */
        const ico = await makeIco(files.filter(function (f) { return f.size <= 48; }));
        const appName = String(readers[1].read() || '').trim();
        const manifest = { };
        if (appName) { manifest.name = appName; manifest.short_name = appName; }
        manifest.icons = [
          { src: prefix + 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: prefix + 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: prefix + 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ];
        if (/^#[0-9a-f]{6}$/i.test(bg)) { manifest.theme_color = bg; manifest.background_color = bg; }
        manifest.start_url = '/';
        manifest.display = 'standalone';
        const webmanifest = new Blob([JSON.stringify(manifest, null, 2) + '\n'], { type: 'application/manifest+json' });
        const extras = [
          { name: 'favicon.ico', blob: ico, tag: 'ICO', use: '16, 32 and 48 px inside' },
          { name: 'site.webmanifest', blob: webmanifest, tag: 'JSON', use: appName ? 'Lists the app icons' : 'Lists the app icons; no site name yet' }
        ];
        let more = null;
        if (spec.extraFiles) {
          try { more = await spec.extraFiles(fctx, { bg: bg, files: files, prefix: prefix }); } catch (e) { more = null; if (window.console) console.error(e); }
          if (my !== renderSeq) return;
          ((more && more.files) || []).forEach(function (x) { extras.push(x); });
        }
        extras.forEach(function (x) {
          const card = el('div', 'file-card');
          const thumb = el('div', 'file-thumb');
          thumb.appendChild(el('span', 'file-type', x.tag));
          card.appendChild(thumb);
          card.appendChild(el('strong', null, x.name));
          card.appendChild(el('span', 'file-use', x.use));
          card.appendChild(el('span', 'file-size', fmtBytes(x.blob.size)));
          const d = downloadButton('Save', x.name, function () { return x.blob; });
          d.className = 'btn-ghost';
          card.appendChild(d);
          results.appendChild(card);
        });
        const zipFiles = files.map(function (f) { return { name: f.name, blob: f.blob }; })
          .concat(extras.map(function (x) { return { name: x.name, blob: x.blob }; }));

        acts.appendChild(downloadButton('Download all as ZIP', 'favicons.zip', function () {
          return zipStore(zipFiles);
        }));

        /* With an SVG favicon the snippet follows the usual advice: the ICO
           pinned to 32x32 so a browser that knows SVG chooses the SVG, then
           the SVG, the Apple icon and the manifest. Without one, the PNGs. */
        const svgFirst = !!(more && more.svgFirst);
        const html = [
          '<link rel="icon" href="' + prefix + 'favicon.ico" sizes="' + (svgFirst ? '32x32' : 'any') + '">'
        ].concat((more && more.links) || [], svgFirst ? [] : [
          '<link rel="icon" href="' + prefix + 'favicon-96x96.png" type="image/png" sizes="96x96">',
          '<link rel="icon" href="' + prefix + 'favicon-48x48.png" type="image/png" sizes="48x48">',
          '<link rel="icon" href="' + prefix + 'favicon-32x32.png" type="image/png" sizes="32x32">',
          '<link rel="icon" href="' + prefix + 'favicon-16x16.png" type="image/png" sizes="16x16">'
        ], [
          '<link rel="apple-touch-icon" href="' + prefix + 'apple-touch-icon.png" sizes="180x180">',
          '<link rel="manifest" href="' + prefix + 'site.webmanifest">'
        ]).join('\n');
        const pane = el('div', 'io-pane');
        const head = el('div', 'io-head');
        head.appendChild(el('span', 'io-label', 'Add this to your <head>'));
        const hacts = el('div', 'io-actions');
        hacts.appendChild(copyButton(function () { return html; }));
        head.appendChild(hacts);
        const pre = el('pre', 'code-out', html);
        pane.appendChild(head);
        pane.appendChild(pre);
        results.parentNode.insertBefore(pane, stats);
        headPane = pane;

        renderStats(stats, [
          ['Icons generated', String(files.length)],
          ['Files in the ZIP', String(zipFiles.length)],
          ['Source', (spec.sourceLabel && spec.sourceLabel(fctx)) || (sourceImg.naturalWidth || sourceImg.width) + '×' + (sourceImg.naturalHeight || sourceImg.height)],
          ['Icons total size', fmtBytes(files.reduce(function (n, f) { return n + f.blob.size; }, 0))]
        ]);
        /* An icon is enlarged when the box the source is fitted into is bigger
           than the source's longer side; name those sizes rather than hint. */
        const longSide = Math.max(sourceImg.naturalWidth || sourceImg.width, sourceImg.naturalHeight || sourceImg.height);
        const enlarged = [];
        const vector = !!(spec.isVector && spec.isVector(fctx));
        if (!vector) FAVICON_SIZES.forEach(function (s) {
          const box = s[1].indexOf('maskable') > -1 ? s[0] * 0.8 : s[0];
          const label = (s[1].indexOf('maskable') > -1 ? 'maskable ' : '') + s[0] + ' px';
          if (box > longSide) enlarged.push(label);
        });
        const notes = [];
        if (enlarged.length) {
          const list = enlarged.length > 1 ? enlarged.slice(0, -1).join(', ') + ' and ' + enlarged[enlarged.length - 1] : enlarged[0];
          notes.push('Your source is smaller than 512px, so it is scaled up to make the ' + list + ' icons, and those will look soft. A square image of 512×512 or larger keeps every size sharp.');
        }
        if (!appName) notes.push('Type a site name above to add it to site.webmanifest; browsers want a name before they offer to install a site as an app.');
        if (notes.length) {
          msg.textContent = notes.join(' ');
          msg.className = enlarged.length ? 'io-msg is-warn' : 'io-msg';
        }
        if (spec.render) { try { spec.render(fctx, { files: files, extras: extras, more: more, bg: bg, prefix: prefix, html: html, appName: appName }); } catch (e) { if (window.console) console.error(e); } }
        return;
      }

      // resizer
      const o = {};
      readers.forEach(function (r) { o[r.key] = r.read(); });
      let w = Number(o.width) || 0, h = Number(o.height) || 0;
      const nw = sourceImg.naturalWidth, nh = sourceImg.naturalHeight;
      if (!w && !h) { w = nw; h = nh; }
      else if (!h) h = Math.round(nh * (w / nw));
      else if (!w) w = Math.round(nw * (h / nh));

      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      if (o.format === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(sourceImg, 0, 0, w, h);

      const q = Math.max(1, Math.min(100, Number(o.quality) || 80)) / 100;
      const blob = await new Promise(function (r) { c.toBlob(r, o.format, q); });
      if (!blob) {
        msg.textContent = 'This browser could not encode that format. Try PNG or JPEG.';
        msg.className = 'io-msg is-error';
        return;
      }

      const card = el('div', 'file-card file-card-wide');
      const thumb = el('div', 'file-thumb');
      const prev = el('img');
      prev.src = URL.createObjectURL(blob);
      prev.alt = 'Resized preview';
      thumb.appendChild(prev);
      card.appendChild(thumb);
      results.appendChild(card);

      const ext = o.format.split('/')[1].replace('jpeg', 'jpg');
      acts.appendChild(downloadButton('Download image', function () {
        return (sourceFile.name.replace(/\.[^.]+$/, '') || 'image') + '-' + w + 'x' + h + '.' + ext;
      }, function () { return blob; }));

      const saved = sourceFile.size - blob.size;
      renderStats(stats, [
        ['Original', nw + '×' + nh + ' · ' + fmtBytes(sourceFile.size)],
        ['Result', w + '×' + h + ' · ' + fmtBytes(blob.size)],
        ['Change', (saved > 0 ? '−' : '+') + fmtBytes(Math.abs(saved)) + ' (' +
                   (saved > 0 ? '−' : '+') + Math.abs(Math.round(saved / sourceFile.size * 100)) + '%)'],
        ['Format', ext.toUpperCase()]
      ]);
      if (saved < 0) {
        msg.textContent = 'The result is larger than the original. Lower the quality, reduce the dimensions, or keep the original format.';
        msg.className = 'io-msg is-warn';
      }
    }
  }

  /* A Windows icon file whose images are stored as PNG: a 6-byte header, a
     16-byte entry per image with its size, byte length and offset, then the
     PNGs unchanged. */
  async function makeIco(pngs) {
    const bufs = await Promise.all(pngs.map(function (p) { return p.blob.arrayBuffer(); }));
    const head = new ArrayBuffer(6 + 16 * bufs.length);
    const v = new DataView(head);
    v.setUint16(0, 0, true);
    v.setUint16(2, 1, true);
    v.setUint16(4, bufs.length, true);
    let offset = head.byteLength;
    bufs.forEach(function (b, i) {
      const at = 6 + 16 * i, px = pngs[i].size >= 256 ? 0 : pngs[i].size;
      v.setUint8(at, px);
      v.setUint8(at + 1, px);
      v.setUint8(at + 2, 0);
      v.setUint8(at + 3, 0);
      v.setUint16(at + 4, 1, true);
      v.setUint16(at + 6, 32, true);
      v.setUint32(at + 8, b.byteLength, true);
      v.setUint32(at + 12, offset, true);
      offset += b.byteLength;
    });
    return new Blob([head].concat(bufs), { type: 'image/x-icon' });
  }

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  /* ZIP writing lives in engine/zip.js, shared with the image tools. The page
     loads it; if a page does not (the favicon generator once did not, so
     "Download all as ZIP" did nothing), it is fetched from this site on
     first use rather than failing silently. */
  let zipLoading = null;
  function loadZip() {
    if (window.MVRZip) return Promise.resolve();
    if (!zipLoading) {
      zipLoading = new Promise(function (resolve, reject) {
        const s = document.createElement('script');
        s.src = (window.__BASE__ || '/') + 'engine/zip.js';
        s.onload = function () { window.MVRZip ? resolve() : reject(new Error('zip.js loaded but defined no MVRZip')); };
        s.onerror = function () { zipLoading = null; reject(new Error('zip.js could not be loaded')); };
        document.head.appendChild(s);
      });
    }
    return zipLoading;
  }
  async function zipStore(files) {
    await loadZip();
    return window.MVRZip(files);
  }

  window.MVRTool = window.MVRTool || {};
  window.MVRTool.mountCode = mountCode;
  window.MVRTool.mountGenerate = mountGenerate;
  window.MVRTool.mountFile = mountFile;
  window.MVRTool._zipStore = zipStore;
})();
