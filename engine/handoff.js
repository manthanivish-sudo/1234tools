/**
 * Tool chaining, on this device only.
 *
 * "Send to…" takes a tool's finished output to the next tool without a trip
 * through the Downloads folder: the output goes into IndexedDB under a
 * one-time id, the next tool opens with that id after the # (so it never
 * reaches a server log), reads the record and deletes it in the same
 * transaction. Nothing is uploaded; it works offline for any tool already
 * stored by the service worker.
 *
 * No shell knows this file exists. Every shell saves a file the same way —
 * an <a download> appended to the page and clicked — so a capture-phase click
 * listener sees every output, and "Send to…" asks the shell's own Download
 * button for the file and cancels the save. The same hook feeds the "Recent
 * outputs" row, and "Save to folder" asks each Download button of a batch in
 * turn.
 *
 * The same file runs in the service worker (importScripts) for the share
 * target, where only the store is defined, and in Node (build-pwa.js reads
 * INTAKE to write share_target and file_handlers into the manifests).
 *
 * Loaded on demand by assets/app.js on tool pages; pwa.js loads it for
 * launchQueue. Disclosed on /privacy/ and /cookies/ as 1234tools-handoff.
 */
(function (root) {
  'use strict';
  /* app.js and pwa.js can both ask for this file; it runs once */
  if (root.MVRHandoff && root.MVRHandoff.deliver) return;

  var DB = '1234tools-handoff';
  var DB_VER = 1;
  var TTL = 60 * 60 * 1000;             /* an unread hand-off is dropped after an hour */
  var RECENT_CAP = 50 * 1024 * 1024;    /* every tool's recent outputs together */
  var RECENT_PER_TOOL = 8;
  var PREF = '1234tools-recent-outputs';

  /* ---------------------------------------------------------- what goes where */
  var IMG = 'image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.avif,.bmp';
  var PDF = 'application/pdf,.pdf';
  var TEXT = 'text/plain,text/csv,text/markdown,text/html,application/json,application/xml,text/xml,.txt,.csv,.md,.json,.xml,.html,.diff';

  /* The "Send to…" menu. Matched against the type of the file the tool
     actually produced, never the one somebody asked for. */
  var TARGETS = [
    { path: '/image/image-cropper/', verb: 'Crop', name: 'Image Cropper', accept: IMG },
    { path: '/image/image-compressor/', verb: 'Compress', name: 'Image Compressor', accept: IMG },
    { path: '/image/image-converter/', verb: 'Convert', name: 'Image Converter', accept: IMG },
    { path: '/image/image-resizer/', verb: 'Resize', name: 'Image Resizer', accept: IMG },
    { path: '/image/image-to-pdf/', verb: 'Make a PDF', name: 'Image to PDF', accept: IMG },
    { path: '/pdf/merge-pdf/', verb: 'Merge with other PDFs', name: 'Merge PDF', accept: PDF },
    { path: '/pdf/compress-pdf/', verb: 'Compress', name: 'Compress PDF', accept: PDF },
    { path: '/pdf/pdf-to-images/', verb: 'Turn into images', name: 'PDF to Images', accept: PDF },
    { path: '/text/word-counter/', verb: 'Count words', name: 'Word Counter', accept: TEXT, text: true },
    { path: '/text/text-diff/', verb: 'Compare with another text', name: 'Text Diff', accept: TEXT, text: true }
  ];

  /* What an installed tool takes from the phone's share sheet (share_target)
     and from the desktop's "Open with" (file_handlers). build-pwa.js writes
     these into the tools' manifests; build/tests/sitewide.js hands each tool
     a real file through the same path the share sheet uses. */
  var PICS = { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'], 'image/gif': ['.gif'] };
  var PICS_MORE = { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'], 'image/gif': ['.gif'], 'image/avif': ['.avif'], 'image/bmp': ['.bmp'] };
  var PDFS = { 'application/pdf': ['.pdf'] };
  var INTAKE = [
    { path: '/image/image-compressor/', files: PICS_MORE },
    { path: '/image/image-converter/', files: PICS_MORE },
    { path: '/image/image-cropper/', files: PICS },
    { path: '/image/image-resizer/', files: PICS },
    { path: '/image/image-to-pdf/', files: PICS },
    { path: '/image/svg-optimizer/', files: { 'image/svg+xml': ['.svg'] } },
    { path: '/pdf/merge-pdf/', files: PDFS },
    { path: '/pdf/compress-pdf/', files: PDFS },
    { path: '/pdf/pdf-to-images/', files: PDFS },
    { path: '/pdf/split-pdf/', files: PDFS },
    { path: '/qr/qr-code-scanner/', files: PICS },
    { path: '/ai-video/auto-captions/', files: { 'video/mp4': ['.mp4', '.m4v'], 'video/webm': ['.webm'], 'video/quicktime': ['.mov'], 'audio/mpeg': ['.mp3'], 'audio/wav': ['.wav'], 'audio/mp4': ['.m4a'] } },
    { path: '/developer/csv-to-json/', files: { 'text/csv': ['.csv'], 'text/tab-separated-values': ['.tsv'] } },
    { path: '/developer/json-formatter/', files: { 'application/json': ['.json'] } },
    { path: '/developer/markdown-preview/', files: { 'text/markdown': ['.md', '.markdown'] } },
    { path: '/text/word-counter/', text: true, files: { 'text/plain': ['.txt'] } }
  ];

  /* ---------------------------------------------------------- the store */
  function idb() {
    return new Promise(function (resolve, reject) {
      var r;
      try { r = root.indexedDB.open(DB, DB_VER); } catch (e) { reject(e); return; }
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('handoff')) d.createObjectStore('handoff', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('recent')) {
          d.createObjectStore('recent', { keyPath: 'key', autoIncrement: true }).createIndex('tool', 'tool');
        }
      };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.onblocked = function () { reject(new Error('storage busy')); };
    });
  }
  /* One transaction; work(store, set) may set the value it resolves to. */
  function txn(name, mode, work) {
    return idb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(name, mode), out;
        work(t.objectStore(name), function (v) { out = v; });
        t.oncomplete = function () { db.close(); resolve(out); };
        t.onerror = t.onabort = function () { db.close(); reject(t.error || new Error('storage failed')); };
      });
    });
  }
  function newId() {
    var b = new Uint8Array(8);
    root.crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
  }
  /* rec: { files: [{ name, type, blob }], text, from } -> the one-time id */
  function put(rec) {
    var id = newId();
    var row = { id: id, at: Date.now(), from: rec.from || '', text: rec.text || '', files: rec.files || [] };
    return txn('handoff', 'readwrite', function (s) {
      /* anything left unread past its hour goes first */
      s.openCursor().onsuccess = function (e) {
        var c = e.target.result;
        if (!c) return;
        if (Date.now() - (c.value.at || 0) > TTL) c.delete();
        c.continue();
      };
      s.put(row);
    }).then(function () { return id; });
  }
  /* Read and delete in one transaction: an id opens once. */
  function take(id) {
    return txn('handoff', 'readwrite', function (s, set) {
      var g = s.get(id);
      g.onsuccess = function () {
        var v = g.result;
        if (v) s.delete(id);
        set(v && Date.now() - (v.at || 0) <= TTL ? v : null);
      };
    });
  }

  /* ---------------------------------------------------------- types */
  var EXT_TYPE = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
    bmp: 'image/bmp', svg: 'image/svg+xml', pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', md: 'text/markdown',
    json: 'application/json', xml: 'application/xml', html: 'text/html', zip: 'application/zip', diff: 'text/plain',
    mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', ics: 'text/calendar', srt: 'text/plain', vtt: 'text/vtt'
  };
  function extOf(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
  function typeOf(blob, name) {
    var t = (blob && blob.type || '').split(';')[0].trim().toLowerCase();
    return t || EXT_TYPE[extOf(name)] || 'application/octet-stream';
  }
  function accepts(list, type, name) {
    if (!list) return true;
    var ext = '.' + extOf(name);
    type = (type || '').toLowerCase();
    return list.split(',').some(function (a) {
      a = a.trim().toLowerCase();
      if (!a) return false;
      if (a.charAt(0) === '.') return a === ext;
      if (a.slice(-2) === '/*') return type.indexOf(a.slice(0, -1)) === 0;
      return a === type;
    });
  }
  function targetsFor(type, name, here) {
    return TARGETS.filter(function (t) { return t.path !== here && accepts(t.accept, type, name); });
  }

  var api = {
    TARGETS: TARGETS, INTAKE: INTAKE, TTL: TTL, RECENT_CAP: RECENT_CAP,
    put: put, take: take, accepts: accepts, typeOf: typeOf, targetsFor: targetsFor
  };
  root.MVRHandoff = api;
  if (typeof module === 'object' && module.exports) module.exports = api;

  /* The service worker and Node stop here: no page to work on. */
  if (typeof document === 'undefined' || !root.indexedDB) return;
  if (document.documentElement.classList.contains('is-embed') || /[?&]embed=1(?:&|$)/.test(location.search)) return;

  /* ---------------------------------------------------------- the page */
  var here = location.pathname.replace(/index\.html$/, '');
  var tool = document.querySelector('article.tool, .tool[data-tool]');
  var toolName = ((document.querySelector('main h1') || {}).textContent || '').trim();
  if (!tool) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function fmtBytes(n) {
    return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  }
  function isDownloadButton(b) {
    if (!b || b.closest('.ho-ui, .share-bar, .share-pop, [data-ho-skip]')) return false;
    var t = (b.textContent || '').trim();
    return /^Download\b/.test(t) && !/\bZIP\b|\ball\b/i.test(t);
  }
  function isZipButton(b) {
    if (!b || b.closest('.ho-ui, [data-ho-skip]')) return false;
    return /^Download\b.*\bZIP\b/i.test((b.textContent || '').trim());
  }

  /* ---- every save, seen once ---- */
  var waiting = null;   /* a Send to… or Save to folder asking a Download button for its file */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (!a || !a.href || a.hasAttribute('data-ho-skip')) return;
    var name = a.getAttribute('download') || 'download';
    var w = waiting;
    if (w) { waiting = null; e.preventDefault(); clearTimeout(w.timer); }
    /* fetch resolves the blob: URL now, before the shell revokes it */
    fetch(a.href).then(function (r) { return r.blob(); }).then(function (blob) {
      var f = { name: name, type: typeOf(blob, name), blob: blob };
      if (w) w.resolve(f);
      remember(f);
    }, function (err) { if (w) w.reject(err); });
  }, true);

  /* Ask a Download button for its file without saving it. */
  function capture(btn) {
    return new Promise(function (resolve, reject) {
      if (waiting) { reject(new Error('busy')); return; }
      var w = { resolve: resolve, reject: reject };
      w.timer = setTimeout(function () {
        if (waiting === w) waiting = null;
        reject(new Error('The tool did not hand over a file.'));
      }, 30000);
      waiting = w;
      api.capturing = true;
      try { btn.click(); } finally { setTimeout(function () { api.capturing = false; }, 0); }
    });
  }

  /* ---- Send to… ---- */
  var menu = null;
  function closeMenu(back) {
    if (!menu) return;
    var m = menu; menu = null;
    m.remove();
    document.removeEventListener('click', outside, true);
    if (back && m._opener && document.contains(m._opener)) m._opener.focus();
  }
  function outside(e) { if (menu && !menu.contains(e.target) && e.target !== menu._opener) closeMenu(false); }

  function offline() { return typeof navigator.onLine === 'boolean' && !navigator.onLine; }
  /* Offline, a tool can only open if the service worker stored it on an
     earlier visit. Says so instead of offering a page that cannot load. */
  function stored(path) {
    if (!offline() || !root.caches) return Promise.resolve(true);
    return root.caches.match(path, { ignoreSearch: true }).then(function (h) { return !!h; }, function () { return true; });
  }

  function openMenu(opener, file) {
    closeMenu(false);
    var list = targetsFor(file.type, file.name, here);
    var m = el('div', 'ho-ui ho-menu');
    m.setAttribute('role', 'menu');
    m.id = 'ho-menu';
    m._opener = opener;
    m.setAttribute('aria-label', 'Send ' + file.name + ' to');
    m.appendChild(el('p', 'ho-menu-head', 'Send ' + file.name + ' (' + fmtBytes(file.blob.size) + ') to'));
    if (!list.length) {
      m.appendChild(el('p', 'ho-menu-none', 'No tool here takes ' + (extOf(file.name) ? 'a .' + extOf(file.name) + ' file' : 'this file') + ' yet.'));
    }
    var items = [];
    list.forEach(function (t) {
      var b = el('button', 'ho-item');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.setAttribute('data-path', t.path);
      b.appendChild(el('strong', null, t.verb));
      b.appendChild(el('span', null, t.name));
      b.addEventListener('click', function () { send(t, file, b); });
      m.appendChild(b);
      items.push(b);
      stored(t.path).then(function (ok) {
        if (ok) return;
        b.disabled = true;
        b.setAttribute('aria-disabled', 'true');
        b.querySelector('span').textContent = t.name + ' — not stored for offline use yet';
      });
    });
    m.appendChild(el('p', 'ho-menu-foot', 'Opens on this device. Nothing is uploaded.'));
    m.addEventListener('keydown', function (e) {
      var live = items.filter(function (b) { return !b.disabled; });
      var i = live.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
      else if (e.key === 'ArrowDown' && live.length) { e.preventDefault(); live[(i + 1) % live.length].focus(); }
      else if (e.key === 'ArrowUp' && live.length) { e.preventDefault(); live[(i - 1 + live.length) % live.length].focus(); }
      else if (e.key === 'Home' && live.length) { e.preventDefault(); live[0].focus(); }
      else if (e.key === 'End' && live.length) { e.preventDefault(); live[live.length - 1].focus(); }
      else if (e.key === 'Tab') closeMenu(false);
    });
    opener.insertAdjacentElement('afterend', m);
    opener.setAttribute('aria-expanded', 'true');
    opener.setAttribute('aria-controls', 'ho-menu');
    menu = m;
    setTimeout(function () { document.addEventListener('click', outside, true); }, 0);
    (items[0] || m).focus();
    if (!items.length) { m.tabIndex = -1; m.focus(); }
    var obs = new MutationObserver(function () {
      if (!document.contains(m)) { opener.setAttribute('aria-expanded', 'false'); obs.disconnect(); }
    });
    obs.observe(m.parentNode, { childList: true });
  }

  function send(target, file, btn) {
    btn.disabled = true;
    put({ from: toolName, files: [{ name: file.name, type: file.type, blob: file.blob }] }).then(function (id) {
      location.href = target.path + '#handoff=' + id;
    }, function () {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Could not store the file on this device (private browsing?)';
    });
  }

  function sendButton(dl) {
    var b = el('button', 'btn-ghost ho-ui ho-send', 'Send to…');
    b.type = 'button';
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', function () {
      if (menu && menu._opener === b) { closeMenu(true); return; }
      var was = b.textContent;
      b.textContent = 'Preparing…';
      b.disabled = true;
      capture(dl).then(function (f) {
        b.textContent = was; b.disabled = false;
        openMenu(b, f);
      }, function (err) {
        b.textContent = was; b.disabled = false;
        note((err && err.message === 'busy') ? 'Another file is being prepared.' : 'That result could not be prepared to send.', 'warn');
      });
    });
    return b;
  }

  /* ---- Save to folder (batches; ZIP stays where there is no folder access) ---- */
  function folderButton(zip) {
    var b = el('button', 'btn-ghost ho-ui ho-folder', 'Save to folder…');
    b.type = 'button';
    b.title = 'Save every file into a folder you choose, instead of one ZIP';
    b.addEventListener('click', function () {
      var dir;
      root.showDirectoryPicker({ mode: 'readwrite' }).then(function (d) {
        dir = d;
        var scope = tool;
        var btns = Array.prototype.filter.call(scope.querySelectorAll('button, a'), isDownloadButton)
          .filter(function (x) { return !x.closest('.ho-recent'); });
        return saveAll(dir, btns, b);
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return;   /* the visitor closed the picker */
        note('The folder could not be written to. ' + (e && e.message ? e.message : ''), 'error');
      });
    });
    return b;
  }
  function uniqueName(dir, name) {
    var m = /^(.*?)(\.[^.]*)?$/.exec(name), stem = m[1], ext = m[2] || '', n = 1;
    function next(cand) {
      return dir.getFileHandle(cand).then(function () { n++; return next(stem + ' (' + n + ')' + ext); },
        function () { return cand; });
    }
    return next(name);
  }
  function saveAll(dir, btns, b) {
    var was = b.textContent, failed = [], saved = 0, cancel = false;
    var stop = el('button', 'btn-ghost ho-ui', 'Stop');
    stop.type = 'button';
    stop.addEventListener('click', function () { cancel = true; });
    b.insertAdjacentElement('afterend', stop);
    b.disabled = true;
    var i = 0;
    function step() {
      if (cancel || i >= btns.length) return Promise.resolve();
      var btn = btns[i++];
      b.textContent = 'Saving ' + i + ' of ' + btns.length + '…';
      var label = (btn.closest('[class*="card"], li, .file-row') || btn).textContent.trim().slice(0, 60);
      return capture(btn).then(function (f) {
        return uniqueName(dir, f.name).then(function (nm) {
          return dir.getFileHandle(nm, { create: true });
        }).then(function (h) { return h.createWritable(); }).then(function (w) {
          return w.write(f.blob).then(function () { return w.close(); });
        }).then(function () { saved++; }, function (e) { failed.push(f.name + ' (' + (e && e.message || 'write failed') + ')'); });
      }, function () { failed.push(label || ('file ' + i)); }).then(step);
    }
    return step().then(function () {
      stop.remove();
      b.disabled = false;
      b.textContent = was;
      var msg = 'Saved ' + saved + ' of ' + btns.length + ' file' + (btns.length === 1 ? '' : 's') + ' to ' + dir.name + '.';
      if (cancel) msg += ' Stopped.';
      if (failed.length) msg += ' Not saved: ' + failed.join('; ') + '.';
      note(msg, failed.length ? 'warn' : 'ok');
    });
  }

  /* ---- a short message at the top of the tool ---- */
  function note(text, kind) {
    var n = tool.querySelector(':scope > .ho-note');
    if (!n) {
      n = el('div', 'ho-ui ho-note');
      n.setAttribute('role', 'status');
      tool.insertBefore(n, tool.firstChild);
    }
    n.className = 'ho-ui ho-note' + (kind ? ' is-' + kind : '');
    n.textContent = '';
    n.appendChild(el('span', null, text));
    var x = el('button', 'ho-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss');
    x.addEventListener('click', function () { n.remove(); });
    n.appendChild(x);
    return n;
  }

  /* ---- receiving ---- */
  function primaryInput(files) {
    var inputs = Array.prototype.slice.call(tool.querySelectorAll('input[type=file]'));
    return inputs.filter(function (i) {
      return !i.disabled && files.every(function (f) { return accepts(i.accept, f.type, f.name); });
    })[0] || null;
  }
  function primaryText() {
    return Array.prototype.filter.call(tool.querySelectorAll('textarea'), function (t) {
      return !t.readOnly && !t.disabled;
    })[0] || null;
  }
  function waitFor(fn, ms) {
    return new Promise(function (resolve) {
      var v = fn();
      if (v) { resolve(v); return; }
      var done = false;
      var obs = new MutationObserver(function () {
        var x = fn();
        if (x && !done) { done = true; obs.disconnect(); resolve(x); }
      });
      obs.observe(tool, { childList: true, subtree: true });
      setTimeout(function () { if (!done) { done = true; obs.disconnect(); resolve(fn()); } }, ms);
    });
  }
  function setText(ta, text) {
    var proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    proto.set.call(ta, text);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* rec: { files: [{ name, type, blob }], text, from } */
  function deliver(rec) {
    var files = (rec.files || []).map(function (f) {
      return f instanceof File ? f : new File([f.blob], f.name, { type: f.type || typeOf(f.blob, f.name) });
    });
    var from = rec.from ? ' from ' + rec.from : '';
    armFocus();
    if (files.length) {
      return waitFor(function () { return primaryInput(files) || (files.every(isTexty) && primaryText()); }, 10000).then(function (target) {
        if (!target) {
          note('This tool cannot open ' + files.map(function (f) { return f.name; }).join(', ') + '.', 'warn');
          return false;
        }
        if (target.tagName === 'TEXTAREA') {
          return files[0].text().then(function (t) {
            setText(target, t);
            note('Opened ' + files[0].name + from + '.' + (files.length > 1 ? ' Only the first file was used.' : ''), 'ok');
            target.focus();
            return true;
          });
        }
        var use = target.multiple ? files : files.slice(0, 1);
        var dt = new DataTransfer();
        use.forEach(function (f) { dt.items.add(f); });
        target.files = dt.files;
        target.dispatchEvent(new Event('change', { bubbles: true }));
        note('Opened ' + use.map(function (f) { return f.name + ' (' + fmtBytes(f.size) + ')'; }).join(', ') + from + '.' +
          (use.length < files.length ? ' This tool takes one file at a time, so only the first was used.' : ''), 'ok');
        return true;
      });
    }
    if (rec.text) {
      return waitFor(primaryText, 10000).then(function (ta) {
        if (!ta) { note('This tool does not take text, so the shared text was not used.', 'warn'); return false; }
        setText(ta, rec.text);
        note('Opened the shared text' + from + '.', 'ok');
        ta.focus();
        return true;
      });
    }
    return Promise.resolve(false);
  }
  function isTexty(f) { return /^text\/|\/json$|\/xml$|\+json$|\+xml$/.test(f.type) && !/svg/.test(f.type); }
  api.deliver = deliver;

  var m = /(?:^#|&)handoff=([0-9a-f]{16})(?:&|$)/.exec(location.hash);
  if (m) {
    /* the id is spent whatever happens next, so it leaves the address now */
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* file: */ }
    take(m[1]).then(function (rec) {
      if (!rec) { note('That hand-off has already been opened, or was more than an hour old. Send it again from the first tool.', 'warn'); return; }
      return deliver(rec);
    }, function () { note('This browser would not open the stored file (private browsing can block it).', 'warn'); });
  }

  /* ---- recent outputs ---- */
  function keeping() { try { return localStorage.getItem(PREF) !== 'off'; } catch (e) { return true; } }
  function remember(f) {
    if (!keeping() || !f.blob || f.blob.size > RECENT_CAP) return;
    txn('recent', 'readwrite', function (s) {
      s.add({ tool: here, name: f.name, type: f.type, size: f.blob.size, at: Date.now(), blob: f.blob });
    }).then(trim).then(paintRecent).catch(function () { /* no storage: nothing kept */ });
  }
  /* Oldest first out: no more than RECENT_PER_TOOL per tool, RECENT_CAP in all. */
  function trim() {
    return txn('recent', 'readwrite', function (s) {
      var rows = [];
      s.openCursor().onsuccess = function (e) {
        var c = e.target.result;
        if (c) { rows.push({ key: c.value.key, tool: c.value.tool, size: c.value.size || 0 }); c.continue(); return; }
        var per = {}, total = 0, drop = {};
        for (var i = rows.length - 1; i >= 0; i--) {   /* newest first */
          var r = rows[i];
          per[r.tool] = (per[r.tool] || 0) + 1;
          if (per[r.tool] > RECENT_PER_TOOL || total + r.size > RECENT_CAP) { drop[r.key] = true; continue; }
          total += r.size;
        }
        Object.keys(drop).forEach(function (k) { s.delete(Number(k)); });
      };
    });
  }
  function recentRows() {
    return txn('recent', 'readonly', function (s, set) {
      var g = s.index('tool').getAll(here);
      g.onsuccess = function () { set((g.result || []).sort(function (a, b) { return b.at - a.at; })); };
    });
  }
  function clearRecent() {
    return txn('recent', 'readwrite', function (s) {
      s.index('tool').openKeyCursor(IDBKeyRange.only(here)).onsuccess = function (e) {
        var c = e.target.result;
        if (c) { s.delete(c.primaryKey); c.continue(); }
      };
    });
  }
  function ago(t) {
    var s = Math.round((Date.now() - t) / 1000);
    return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago';
  }
  var recentBox = null;
  function paintRecent() {
    return recentRows().then(function (rows) {
      if (!rows.length) { if (recentBox) { recentBox.remove(); recentBox = null; } return; }
      if (!recentBox) {
        recentBox = el('section', 'ho-ui ho-recent');
        recentBox.setAttribute('aria-label', 'Recent outputs on this device');
        tool.appendChild(recentBox);
      }
      recentBox.textContent = '';
      var head = el('div', 'ho-recent-head');
      head.appendChild(el('h2', null, 'Recent outputs on this device'));
      var clear = el('button', 'btn-ghost ho-clear', 'Clear');
      clear.type = 'button';
      clear.addEventListener('click', function () { clearRecent().then(paintRecent); });
      head.appendChild(clear);
      recentBox.appendChild(head);
      var ul = el('ul', 'ho-recent-list');
      rows.forEach(function (r) {
        var li = el('li');
        li.appendChild(el('span', 'ho-recent-name', r.name));
        li.appendChild(el('span', 'ho-recent-meta', fmtBytes(r.size) + ' · ' + ago(r.at)));
        var save = el('button', 'btn-ghost', 'Save');
        save.type = 'button';
        save.setAttribute('aria-label', 'Save ' + r.name + ' again');
        save.addEventListener('click', function () {
          var url = URL.createObjectURL(r.blob);
          var a = el('a');
          a.href = url; a.download = r.name;
          a.setAttribute('data-ho-skip', '');
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        });
        li.appendChild(save);
        var to = el('button', 'btn-ghost ho-send', 'Send to…');
        to.type = 'button';
        to.setAttribute('aria-haspopup', 'menu');
        to.setAttribute('aria-expanded', 'false');
        to.addEventListener('click', function () {
          if (menu && menu._opener === to) { closeMenu(true); return; }
          openMenu(to, { name: r.name, type: r.type, blob: r.blob });
        });
        li.appendChild(to);
        ul.appendChild(li);
      });
      recentBox.appendChild(ul);
      var foot = el('p', 'ho-recent-foot');
      var keep = el('input');
      keep.type = 'checkbox';
      keep.id = 'ho-keep';
      keep.checked = keeping();
      keep.addEventListener('change', function () {
        try { localStorage.setItem(PREF, keep.checked ? 'on' : 'off'); } catch (e) { /* private mode */ }
        if (!keep.checked) clearRecent().then(paintRecent);
      });
      var lab = el('label', null, ' Keep my last ' + RECENT_PER_TOOL + ' outputs here (up to 50 MB across all tools). They stay in this browser and are never uploaded.');
      lab.setAttribute('for', 'ho-keep');
      foot.appendChild(keep);
      foot.appendChild(lab);
      recentBox.appendChild(foot);
    }).catch(function () { /* storage blocked */ });
  }
  api.paintRecent = paintRecent;

  /* ---- results: decorate, and move focus to the first one ---- */
  var decorated = new WeakSet();
  var focusArmed = false, armedFrom = null;
  function armFocus() { focusArmed = true; armedFrom = document.activeElement; }
  tool.addEventListener('change', function (e) { if (e.target && e.target.type === 'file') armFocus(); }, true);
  tool.addEventListener('drop', armFocus, true);
  document.addEventListener('paste', function (e) {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length) armFocus();
  }, true);
  /* Only from where the visitor was when they gave the tool its input:
     never out of a field they are typing in. */
  function mayMoveFocus() {
    var a = document.activeElement;
    if (!a || a === document.body || a === armedFrom) return true;
    if (a.type === 'file' || (a.closest && a.closest('.drop, .drop-zone, .img-drop, [class*="drop"]'))) return true;
    return false;
  }
  function decorate() {
    if (!tool) return;
    var first = null;
    Array.prototype.forEach.call(tool.querySelectorAll('button, a.btn-primary, a.btn-ghost'), function (b) {
      if (decorated.has(b)) return;
      if (isDownloadButton(b)) {
        decorated.add(b);
        if (!first && b.offsetParent !== null) first = b;
        if (SEND_HERE && !(b.nextElementSibling && b.nextElementSibling.classList.contains('ho-send'))) b.insertAdjacentElement('afterend', sendButton(b));
      } else if (isZipButton(b)) {
        decorated.add(b);
        if (typeof root.showDirectoryPicker === 'function') b.insertAdjacentElement('afterend', folderButton(b));
      }
    });
    if (first && focusArmed) {
      focusArmed = false;
      if (mayMoveFocus()) {
        first.focus({ preventScroll: true });
        try { first.scrollIntoView({ block: 'nearest' }); } catch (e) { /* old */ }
      }
    }
  }
  /* Sections whose results are files another tool here can take. */
  var SEND_HERE = /^\/(image|pdf|text|developer|qr|social|ai-image|design)\//.test(here);
  if (tool) {
    var pend = 0;
    new MutationObserver(function () {
      if (pend) return;
      pend = requestAnimationFrame(function () { pend = 0; decorate(); });
    }).observe(tool, { childList: true, subtree: true });
    decorate();
    paintRecent();
  }
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
