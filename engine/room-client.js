/* Copied verbatim from 1234tools-relay client/room-client.js v1.0.0 (2026-10-26), sha256 2b2120212d10b0e9733b61c9c899b5caec0535c68f05b499aa59d268d06869d9; everything below this line is that file unchanged. */
/* room-client.js: browser client for the 1234Tools live-room relay (live.1234tools.com).
 * No dependencies. Nothing happens on load: a connection opens only when create() or
 * join() is called. Sets window.MVRRoom (and module.exports under CommonJS).
 *
 *   const room = MVRRoom.create({ title: 'Quiz' });      // presenter
 *   room.on('ready', r => show(r.code)); room.on('msg', m => count(m.id, m.v, m.at));
 *   room.setState({ q: 'Best colour?', opts: ['red', 'blue'] }); room.patch({ timer: 29 });
 *
 *   const me = MVRRoom.join('123456', 'Ann');            // participant
 *   me.on('state', s => render(s)); me.send({ pick: 1 });
 *
 * Protocol: PROTOCOL.md beside this file's repository.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MVRRoom = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var ENDPOINT = 'https://live.1234tools.com';
  var PING = '{"t":"ping"}';
  // Keep-alive: a ping only after 30 s with nothing received (a busy room sends none).
  // Pings are auto-answered by the server and never wake the room.
  var timing = { pingAfter: 30000, deadAfter: 75000, tick: 10000 }; // exposed for tests
  var BACKOFF_MIN = 500, BACKOFF_MAX = 15000;
  var HOST_MAX = 65536;
  // Close codes after which reconnecting is pointless (see PROTOCOL.md).
  var FINAL = { 4000: 'ended', 4001: 'full', 4002: 'locked', 4003: 'kicked', 4004: 'no-room', 4005: 'replaced', 4008: 'policy' };

  function store(kind, key, val) {
    try {
      var s = root.sessionStorage;
      if (!s) return null;
      if (kind === 'get') { var v = s.getItem(key); return v ? JSON.parse(v) : null; }
      if (kind === 'set') s.setItem(key, JSON.stringify(val));
      else s.removeItem(key);
    } catch (e) { /* private mode, blocked storage: carry on without it */ }
    return null;
  }

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  // RFC 7396 merge patch, same rules as the server.
  function merge(target, patch) {
    if (!isObj(patch)) return patch;
    if (!isObj(target)) target = {};
    for (var k in patch) {
      if (k === '__proto__' || !Object.prototype.hasOwnProperty.call(patch, k)) continue;
      var pv = patch[k];
      if (pv === null) delete target[k];
      else target[k] = isObj(pv) ? merge(target[k], pv) : pv;
    }
    return target;
  }
  // Fold patch b into pending patch a. false when the result would not equal applying
  // a then b (a scalar later patched as an object): the caller sends full state instead.
  function compose(a, b) {
    for (var k in b) {
      if (k === '__proto__' || !Object.prototype.hasOwnProperty.call(b, k)) continue;
      var bv = b[k];
      if (isObj(bv) && Object.prototype.hasOwnProperty.call(a, k)) {
        if (!isObj(a[k]) || !compose(a[k], bv)) return false;
      } else a[k] = bv;
    }
    return true;
  }

  function hidden() { return !!(root.document && root.document.hidden); }

  // ---- shared connection core ------------------------------------------------------

  function Conn(opts) {
    this.endpoint = String((opts && opts.endpoint) || ENDPOINT).replace(/\/+$/, '');
    this.sync = !(opts && opts.sync === false);
    this.handlers = {};
    this.ws = null;
    this.status = 'idle';
    this.tries = 0;
    this.done = false;
    this.offset = 0;   // server clock minus this device's clock, in ms
    this.rtt = null;   // best round trip seen
    var self = this;
    this._vis = function () { if (!hidden() && !self.done && !self.ws && self.code) { self.tries = 0; self._reconnectNow(); } };
    if (root.document && root.document.addEventListener) root.document.addEventListener('visibilitychange', this._vis);
  }
  Conn.prototype.on = function (type, fn) { (this.handlers[type] || (this.handlers[type] = [])).push(fn); return this; };
  Conn.prototype.off = function (type, fn) {
    var l = this.handlers[type];
    if (l) this.handlers[type] = l.filter(function (f) { return f !== fn; });
    return this;
  };
  Conn.prototype.emit = function (type, a) {
    var l = this.handlers[type];
    if (!l) return;
    for (var i = 0; i < l.length; i++) { try { l[i].call(this, a); } catch (e) { setTimeout(function () { throw e; }); } }
  };
  Conn.prototype.serverNow = function () { return Date.now() + this.offset; };
  Conn.prototype._status = function (s) { if (this.status !== s) { this.status = s; this.emit('status', s); } };
  Conn.prototype._raw = function (str) {
    if (this.ws && this.ws.readyState === 1) { this.ws.send(str); return true; }
    return false;
  };
  Conn.prototype._open = function (url) {
    var self = this;
    this._status(this.tries ? 'reconnecting' : 'connecting');
    var ws;
    try { ws = new root.WebSocket(url); } catch (e) { return this._retry(); }
    this.ws = ws;
    ws.onopen = function () {
      self.lastRx = Date.now();
      self._timer = setInterval(function () {
        var idle = Date.now() - self.lastRx;
        if (idle > timing.deadAfter) {
          // Silent connection: do not wait for a close handshake that will never come.
          clearInterval(self._timer);
          ws.onclose = ws.onmessage = null;
          try { ws.close(); } catch (e) { /* gone */ }
          if (self.ws === ws) self.ws = null;
          return self._retry();
        }
        if (idle > timing.pingAfter) self._raw(PING);
      }, timing.tick);
      self._opened();
      if (self.sync) self._sample(5);
    };
    ws.onmessage = function (e) {
      self.lastRx = Date.now();
      var m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'pong') return;
      if (m.t === 'time') return self._time(m);
      self._msg(m);
    };
    ws.onclose = function (e) {
      clearInterval(self._timer);
      if (self.ws === ws) self.ws = null;
      if (self.done) return;
      var why = FINAL[e.code];
      if (why) return self._end(why === 'ended' ? (self.endReason || 'ended') : why);
      self._retry();
    };
    ws.onerror = function () { /* onclose follows */ };
  };
  Conn.prototype._retry = function () {
    if (this.done) return;
    this._status('reconnecting');
    var self = this;
    var cap = Math.min(BACKOFF_MAX, BACKOFF_MIN * Math.pow(2, this.tries++));
    var wait = cap / 2 + Math.random() * cap / 2; // jittered so a room of phones does not stampede
    clearTimeout(this._rt);
    this._rt = setTimeout(function () { self._reconnectNow(); }, wait);
  };
  Conn.prototype._reconnectNow = function () { clearTimeout(this._rt); if (!this.done && !this.ws) this._connect(); };
  Conn.prototype._end = function (reason) {
    if (this.done) return;
    this.done = true;
    clearInterval(this._timer);
    clearTimeout(this._rt);
    if (root.document && root.document.removeEventListener) root.document.removeEventListener('visibilitychange', this._vis);
    if (this.ws) { try { this.ws.close(1000); } catch (e) { /* gone */ } this.ws = null; }
    this._status('closed');
    this._forget(reason);
    this.emit('closed', { reason: reason });
  };
  // Clock offset: a few {t:"time"} samples; keep the one with the shortest round trip.
  Conn.prototype._sample = function (n) {
    var self = this;
    if (n <= 0 || this.done) return;
    if (!hidden()) this._raw('{"t":"time","c":' + Date.now() + '}');
    setTimeout(function () { self._sample(n - 1); }, 400);
  };
  Conn.prototype._time = function (m) {
    var now = Date.now();
    var rtt = now - m.c;
    if (rtt < 0 || rtt > 10000) return;
    if (this.rtt === null || rtt <= this.rtt) {
      this.rtt = rtt;
      this.offset = Math.round(m.s - (m.c + rtt / 2));
      this.emit('clock', { offset: this.offset, rtt: rtt });
    }
  };

  // ---- host ------------------------------------------------------------------------------

  function Host(opts) {
    Conn.call(this, opts);
    opts = opts || {};
    // On resume, title and lock are adopted from the room unless given here.
    this.title = opts.title !== undefined ? String(opts.title) : opts.resume ? undefined : '';
    this.locked = opts.resume ? undefined : false;
    this.state = undefined;
    this.players = new Map();   // id -> nick
    this.pend = null;           // {full:true} or {patch:{...}} waiting for the next frame
    this.dirty = false;         // state changed while offline
    var self = this;
    this.whenReady = new Promise(function (res, rej) { self._res = res; self._rej = rej; });
    this.whenReady.catch(function () { /* also reported through 'closed' */ });
    if (opts.resume) {
      this.code = opts.resume.code; this.hostKey = opts.resume.hostKey; this.ticket = opts.resume.ticket;
      this.expiresAt = opts.resume.expiresAt;
      this._connect();
    } else this._createRoom(opts);
  }
  Host.prototype = Object.create(Conn.prototype);
  Host.prototype._createRoom = function (opts) {
    var self = this;
    this._status('connecting');
    var body = { title: this.title || '' };
    if (opts.plan) body.plan = opts.plan;
    root.fetch(this.endpoint + '/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'http-' + r.status); return j; }); })
      .then(function (j) {
        self.code = j.code; self.hostKey = j.hostKey; self.ticket = j.ticket; self.cap = j.cap;
        self.plan = j.plan; self.expiresAt = j.expiresAt;
        store('set', 'mvr-host', { endpoint: self.endpoint, code: j.code, hostKey: j.hostKey, ticket: j.ticket, expiresAt: j.expiresAt });
        if (!self.done) self._connect();
      })
      .catch(function (e) { self._rej(e); self._end(e && e.message === 'rate' ? 'rate' : 'create-failed'); });
  };
  Host.prototype._connect = function () {
    this._open(this.endpoint.replace(/^http/, 'ws') + '/rooms/' + this.code + '/ws?role=host&key=' +
      encodeURIComponent(this.hostKey) + '&ticket=' + encodeURIComponent(this.ticket || ''));
  };
  Host.prototype._opened = function () {};
  Host.prototype._forget = function (reason) {
    store('del', 'mvr-host');
    if (!this.isReady) this._rej(new Error(reason));
  };
  Host.prototype._msg = function (m) {
    switch (m.t) {
      case 'ready':
        this.tries = 0;
        this.cap = m.cap; this.plan = m.plan; this.expiresAt = m.exp;
        this.players = new Map();
        for (var i = 0; i < m.players.length; i++) this.players.set(m.players[i].id, m.players[i].nick);
        if (this.state !== undefined && (!m.snap || this.dirty)) this._send('{"t":"state","v":' + JSON.stringify(this.state) + '}');
        this.dirty = false; this.pend = null;
        if (this.locked === undefined) this.locked = m.locked;
        else if (m.locked !== this.locked) this._raw('{"t":"lock","v":' + this.locked + '}');
        if (this.title === undefined) this.title = m.title;
        else if (m.title !== this.title) this._raw(JSON.stringify({ t: 'title', v: this.title }));
        this.isReady = true;
        this._status('open');
        this._res(m);
        return this.emit('ready', m);
      case 'msg':
        m.nick = this.players.get(m.id);
        return this.emit('msg', m);
      case 'joined':
        this.players.set(m.id, m.nick);
        return this.emit('joined', m);
      case 'left':
        this.players.delete(m.id);
        return this.emit('left', m);
      case 'count': return this.emit('count', m.n);
      case 'need-state':
        if (this.state !== undefined) this._send('{"t":"state","v":' + JSON.stringify(this.state) + '}');
        return;
      case 'closed': this.endReason = m.reason; return;
      case 'full': this.endReason = 'hosts'; return;
      case 'error': return this.emit('error', m.c);
    }
  };
  Host.prototype._send = function (str) {
    if (str.length > HOST_MAX) { this.emit('error', 'too-big'); return false; }
    if (!this._raw(str)) { this.dirty = true; return false; }
    return true;
  };
  // Coalesce everything asked for in one frame into one message.
  Host.prototype._schedule = function () {
    if (this._sched) return;
    this._sched = true;
    var self = this;
    var run = function () { if (self._sched) { self._sched = false; self._flush(); } };
    if (!hidden() && root.requestAnimationFrame) { root.requestAnimationFrame(run); setTimeout(run, 50); } else if (root.queueMicrotask) root.queueMicrotask(run); else setTimeout(run, 0);
  };
  Host.prototype._flush = function () {
    var p = this.pend;
    this.pend = null;
    if (!p) return;
    if (p.full) this._send('{"t":"state","v":' + JSON.stringify(this.state) + '}');
    else this._send('{"t":"patch","v":' + JSON.stringify(p.patch) + '}');
  };
  Host.prototype.setState = function (v) {
    this.state = clone(v);
    this.pend = { full: true };
    this._schedule();
    return this;
  };
  Host.prototype.patch = function (p) {
    if (!isObj(p)) throw new TypeError('patch must be an object');
    p = clone(p);
    this.state = merge(this.state, clone(p));
    if (!this.pend) this.pend = { patch: p };
    else if (!this.pend.full && !compose(this.pend.patch, p)) this.pend = { full: true };
    this._schedule();
    return this;
  };
  Host.prototype.flush = function () { this._sched = false; this._flush(); return this; };
  Host.prototype.to = function (id, v) { return this._raw(JSON.stringify({ t: 'to', id: id, v: v })); };
  Host.prototype.kick = function (id) { this.players.delete(id); return this._raw(JSON.stringify({ t: 'kick', id: id })); };
  Host.prototype.lock = function (on) { this.locked = on !== false; return this._raw('{"t":"lock","v":' + this.locked + '}'); };
  Host.prototype.setTitle = function (t) { this.title = String(t || ''); return this._raw(JSON.stringify({ t: 'title', v: this.title })); };
  Host.prototype.close = function () {
    this.flush();
    this._raw('{"t":"close"}');
    this._end('host');
  };

  // ---- player ----------------------------------------------------------------------------

  function Player(code, nick, opts) {
    Conn.call(this, opts);
    this.code = String(code);
    this.nick = nick;
    this.id = null;
    this.state = undefined;
    this.queue = [];
    // One participant per tab per room: the rejoin token is kept in sessionStorage
    // unless opts.remember === false.
    this.key = opts && opts.remember === false ? null : 'mvr-rj:' + this.code;
    var saved = this.key && store('get', this.key);
    this.rejoin = saved && saved.e === this.endpoint ? saved.r : null;
    var self = this;
    this.whenReady = new Promise(function (res, rej) { self._res = res; self._rej = rej; });
    this.whenReady.catch(function () { /* also reported through 'closed' */ });
    this._connect();
  }
  Player.prototype = Object.create(Conn.prototype);
  Player.prototype._connect = function () {
    this._open(this.endpoint.replace(/^http/, 'ws') + '/rooms/' + encodeURIComponent(this.code) + '/ws?role=player');
  };
  Player.prototype._opened = function () {
    var h = { t: 'hello', nick: this.nick };
    if (this.rejoin) h.rejoin = this.rejoin;
    this._raw(JSON.stringify(h));
  };
  Player.prototype._forget = function (reason) {
    if (reason !== 'replaced' && this.key) store('del', this.key);
    if (!this.id) this._rej(new Error(reason));
  };
  Player.prototype._msg = function (m) {
    switch (m.t) {
      case 'welcome':
        this.tries = 0;
        this.id = m.id; this.rejoin = m.rejoin;
        if (this.key) store('set', this.key, { e: this.endpoint, r: m.rejoin });
        this._status('open');
        this._res(m);
        this.emit('welcome', m);
        while (this.queue.length) this._raw(this.queue.shift());
        return;
      case 'state':
        this.state = m.v;
        return this.emit('state', this.state);
      case 'patch':
        this.state = merge(this.state, m.v);
        this.emit('patch', m.v);
        return this.emit('state', this.state);
      case 'direct': return this.emit('direct', m.v);
      case 'count': return this.emit('count', m.n);
      case 'host': return this.emit('host', !!m.on);
      case 'closed': this.endReason = m.reason; return;
      case 'full': case 'locked': this.endReason = m.t; return;
      case 'error':
        if (m.c === 'bad-nick') { this.emit('error', m.c); return this._end('bad-nick'); }
        return this.emit('error', m.c);
    }
  };
  // Answers go straight out (no coalescing: buzzers are decided in milliseconds).
  // While reconnecting the last 20 are held and sent after the room welcomes us back.
  Player.prototype.send = function (v) {
    var str = '{"t":"send","v":' + JSON.stringify(v === undefined ? null : v) + '}';
    if (this.id && this._raw(str)) return true;
    if (!this.done) { this.queue.push(str); if (this.queue.length > 20) this.queue.shift(); }
    return false;
  };
  Player.prototype.leave = function () { this._end('left'); };
  Player.prototype.close = Player.prototype.leave;

  // ---- public API -----------------------------------------------------------------------

  function info(code, opts) {
    var ep = String((opts && opts.endpoint) || ENDPOINT).replace(/\/+$/, '');
    return root.fetch(ep + '/rooms/' + encodeURIComponent(code)).then(function (r) { return r.json(); });
  }

  return {
    version: '1.0.0',
    create: function (opts) { return new Host(opts); },
    // Reopen the room this tab created before a reload (sessionStorage), or null.
    resume: function (opts) {
      var s = store('get', 'mvr-host');
      var ep = String((opts && opts.endpoint) || ENDPOINT).replace(/\/+$/, '');
      if (!s || s.endpoint !== ep || !(s.expiresAt > Date.now())) return null;
      var o = {};
      for (var k in opts || {}) o[k] = opts[k];
      o.resume = s;
      return new Host(o);
    },
    join: function (code, nick, opts) { return new Player(code, nick, opts); },
    info: info,
    merge: merge,
    timing: timing,
  };
});
