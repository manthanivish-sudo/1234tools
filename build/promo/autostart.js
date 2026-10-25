'use strict';
/**
 * Run the desk in the background, and start it when Windows starts.
 *
 *   start({ port, open, site })  the desk on 127.0.0.1:<port> in a hidden background process
 *                                (or the one already answering there), then, if open, the browser
 *   stop({ port })               stops the background desk that start() began (PROMO_HOME/desk.pid)
 *   status({ port })             { running, pid, url, autostart }
 *   enable({ open }) / disable() / isEnabled() / info()
 *                                the "1234Tools Promotion Desk" shortcuts (Windows only)
 *
 * enable() puts one shortcut in the user's Startup folder (shell:startup) that runs
 * `node desk.js start --quiet` minimised when the owner signs in to Windows (with
 * --open it also opens the desk in the browser), and one in the Start menu's Programs
 * folder that runs `node desk.js start`, so typing "Promotion" in Start finds it.
 * No admin rights, no scheduled task, no registry key: disable() deletes both files.
 * PROMO_STARTUP_DIR and PROMO_PROGRAMS_DIR move the two folders (the tests use them).
 *
 * The background desk writes its output to PROMO_HOME/desk.log. Nothing here
 * touches the network beyond 127.0.0.1.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const cp = require('child_process');
const L = require('./log');

const NAME = '1234Tools Promotion Desk';
const DESK = path.join(__dirname, 'desk.js');
const ROOT = path.join(__dirname, '..', '..');
const ICON = path.join(ROOT, 'favicon.ico');

const pidFile = () => path.join(L.baseHome(), 'desk.pid');
const logFile = () => path.join(L.baseHome(), 'desk.log');
const urlOf = (port) => 'http://127.0.0.1:' + port + '/';

function startupDir() {
  if (process.env.PROMO_STARTUP_DIR) return process.env.PROMO_STARTUP_DIR;
  return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
}
function programsDir() {
  if (process.env.PROMO_PROGRAMS_DIR) return process.env.PROMO_PROGRAMS_DIR;
  return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
}
const startupLink = () => path.join(startupDir(), NAME + '.lnk');
const programsLink = () => path.join(programsDir(), NAME + '.lnk');

/** True when a desk answers /api/health on the port. */
function health(port) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/api/health', method: 'GET', timeout: 1500, headers: { Host: '127.0.0.1:' + port } }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => { try { resolve(res.statusCode === 200 && JSON.parse(b).ok === true); } catch (e) { resolve(false); } });
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

function readPid() {
  try { const n = parseInt(fs.readFileSync(pidFile(), 'utf8'), 10); return n > 0 ? n : null; } catch (e) { return null; }
}
function alive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** Open a URL in the default browser: a local convenience, never a network action of the desk's own. */
function openBrowser(url) {
  const o = { detached: true, stdio: 'ignore', windowsHide: true };
  try {
    if (process.platform === 'win32') cp.spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], o).unref();
    else if (process.platform === 'darwin') cp.spawn('open', [url], o).unref();
    else cp.spawn('xdg-open', [url], o).unref();
    return true;
  } catch (e) { return false; }
}

function logTail(n) {
  try { return fs.readFileSync(logFile(), 'utf8').trim().split(/\r?\n/).slice(-(n || 6)).join('\n'); } catch (e) { return ''; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function start(o) {
  o = o || {};
  const port = o.port || 8797;
  const url = urlOf(port) + (o.site && o.site !== '1234tools' ? '?site=' + encodeURIComponent(o.site) : '');
  if (await health(port)) {
    if (o.open) openBrowser(url);
    return { already: true, port, url, pid: readPid() };
  }
  L.ensureHome();
  const out = fs.openSync(logFile(), 'a');
  fs.writeSync(out, '\n--- ' + new Date().toISOString() + ' desk.js start (port ' + port + ')\n');
  const argv = [DESK, 'serve', '--port', String(port)].concat(o.site ? ['--site', String(o.site)] : []);
  const child = cp.spawn(process.execPath, argv, { cwd: ROOT, detached: true, windowsHide: true, stdio: ['ignore', out, out], env: process.env });
  child.unref();
  fs.closeSync(out);
  fs.writeFileSync(pidFile(), String(child.pid));
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    if (await health(port)) {
      if (o.open) openBrowser(url);
      return { already: false, port, url, pid: child.pid };
    }
    if (!alive(child.pid)) break;
  }
  try { fs.unlinkSync(pidFile()); } catch (e) { /* not written or gone */ }
  const err = new Error('The desk did not start on port ' + port + '. Last lines of ' + logFile() + ':\n' + logTail(8));
  err.code = 'NOSTART';
  throw err;
}

async function stop(o) {
  const port = (o && o.port) || 8797;
  const pid = readPid();
  if (pid && alive(pid)) {
    try { process.kill(pid); } catch (e) { /* gone between the check and the kill */ }
    for (let i = 0; i < 20 && alive(pid); i++) await sleep(150);
  }
  try { fs.unlinkSync(pidFile()); } catch (e) { /* none */ }
  const still = await health(port);
  return { stopped: !!pid, pid, stillRunning: still,
    note: still ? 'A desk still answers on port ' + port + ': one started with `desk.js serve` in a terminal. Close that window (or press Ctrl+C in it).' : '' };
}

/* ------------------------------------------------------------ shortcuts */

function psQuote(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

/** Write one .lnk with WScript.Shell through PowerShell (present on every Windows 10 and 11). */
function writeShortcut(file, args, description) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ps = [
    '$s = (New-Object -ComObject WScript.Shell).CreateShortcut(' + psQuote(file) + ')',
    '$s.TargetPath = ' + psQuote(process.execPath),
    '$s.Arguments = ' + psQuote(args),
    '$s.WorkingDirectory = ' + psQuote(ROOT),
    '$s.WindowStyle = 7',
    '$s.Description = ' + psQuote(description),
    fs.existsSync(ICON) ? '$s.IconLocation = ' + psQuote(ICON + ',0') : '',
    '$s.Save()'
  ].filter(Boolean).join('; ');
  const r = cp.spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (r.status !== 0 || !fs.existsSync(file)) throw new Error('Could not write the shortcut ' + file + ': ' + ((r.stderr || r.stdout || (r.error && r.error.message) || '').trim().split('\n')[0] || 'PowerShell failed'));
}

const quoteArg = (s) => '"' + String(s) + '"';
function settingsFile() { return path.join(L.baseHome(), 'autostart.json'); }

function info() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch (e) { /* never set */ }
  return {
    supported: process.platform === 'win32',
    on: fs.existsSync(startupLink()),
    open: !!saved.open,
    startup: startupLink(),
    startMenu: fs.existsSync(programsLink()) ? programsLink() : '',
    command: quoteArg(process.execPath) + ' ' + quoteArg(DESK) + ' start' + (saved.open ? '' : ' --quiet'),
    log: logFile()
  };
}
const isEnabled = () => info().on;

function enable(o) {
  o = o || {};
  if (process.platform !== 'win32') throw new Error('Starting with Windows works on Windows only. On macOS or Linux, add `node ' + DESK + ' start --quiet` to your login items.');
  const open = !!o.open;
  writeShortcut(startupLink(), quoteArg(DESK) + ' start' + (open ? '' : ' --quiet'), NAME + ': starts the local desk when you sign in' + (open ? ' and opens it in the browser' : ''));
  writeShortcut(programsLink(), quoteArg(DESK) + ' start', NAME + ': starts the local desk if needed and opens it in the browser');
  L.ensureHome();
  fs.writeFileSync(settingsFile(), JSON.stringify({ open, at: new Date().toISOString() }, null, 2));
  return info();
}

function disable() {
  for (const f of [startupLink(), programsLink()]) { try { fs.unlinkSync(f); } catch (e) { /* already gone */ } }
  return info();
}

async function status(o) {
  const port = (o && o.port) || 8797;
  const pid = readPid();
  return { running: await health(port), pid: alive(pid) ? pid : null, url: urlOf(port), autostart: info() };
}

module.exports = { NAME, start, stop, status, enable, disable, isEnabled, info, health, openBrowser, startupLink, programsLink };
