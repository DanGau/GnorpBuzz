#!/usr/bin/env node
'use strict';

/*  game-eyes  —  Visual verification & game interaction via raw CDP
 *
 *  Usage:
 *    node eye.cjs start                      Pre-warm Chrome + dev server
 *    node eye.cjs stop [--all]               Kill Chrome (--all = also dev server)
 *    node eye.cjs status                     What's running?
 *    node eye.cjs screenshot <name>          One screenshot
 *    node eye.cjs debug <cmd> [args...]      One window.debug command
 *    node eye.cjs click <x> <y>              Click viewport coords
 *    node eye.cjs key <key>                  Press key (Enter, Escape, a, …)
 *    node eye.cjs eval <expression>          Evaluate JS in game context
 *    node eye.cjs step [n] [name]            Pause + step n ticks + render + screenshot
 *    node eye.cjs step-sequence [tps] [n]    Step n times (tps ticks each), screenshot all
 *    node eye.cjs step-until <expr> [tps] [max]  Step until JS expr is truthy
 *    node eye.cjs play [file | -]            Execute JSON playbook
 *    node eye.cjs verify-quick               Load game + screenshot
 *
 *  Every command auto-starts Chrome & dev server if needed.
 *  All output is JSON on stdout.  Progress goes to stderr.
 */

const { execSync, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const http = require('http');
const os   = require('os');

/* ================================================================
   1. DEPENDENCIES
   ================================================================ */

let WebSocket;
try {
  WebSocket = require('ws');
} catch {
  const skillDir = path.resolve(__dirname, '..');
  if (!fs.existsSync(path.join(skillDir, 'package.json'))) {
    fs.writeFileSync(path.join(skillDir, 'package.json'), '{"private":true}');
  }
  process.stderr.write('[eye] Installing ws package…\n');
  execSync('npm install ws', { cwd: skillDir, stdio: 'pipe', timeout: 120000 });
  WebSocket = require('ws');
}

/* ================================================================
   2. CONFIGURATION
   ================================================================ */

/** Walk up from __dirname until we find app/package.json */
function findApp() {
  let d = path.resolve(__dirname);
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(d, 'app');
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return path.resolve(__dirname, '../../../../app');
}

const APP         = findApp();
const SESSION_F   = path.join(os.tmpdir(), 'eye-session-gnorpbuzz.json');
const SCREENSHOTS = path.join(APP, 'screenshots');
const CDP_PORT    = parseInt(process.env.EYE_CDP_PORT  || '9222', 10);
const DEV_PORT    = parseInt(process.env.EYE_DEV_PORT  || '5180', 10);
const GAME_URL    = `http://localhost:${DEV_PORT}`;
const VW          = 1600;
const VH          = 900;
const IS_WIN      = process.platform === 'win32';

const log = msg => process.stderr.write(`[eye] ${msg}\n`);

/* ================================================================
   3. TINY HELPERS
   ================================================================ */

const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpJSON(url, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function portOpen(port) {
  return new Promise(resolve => {
    const req = http.get(`http://localhost:${port}`, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

function gitInfo() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: APP, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
    const commit = execSync('git rev-parse --short=7 HEAD',    { cwd: APP, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
    return { branch: branch.replace(/[\\\/]/g, '-'), commit };
  } catch { return { branch: 'unknown', commit: 'unknown' }; }
}

function tsLabel() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }

/* ================================================================
   4. SESSION FILE
   ================================================================ */

function sessionLoad()       { try { return JSON.parse(fs.readFileSync(SESSION_F, 'utf8')); } catch { return {}; } }
function sessionSave(patch)  { fs.writeFileSync(SESSION_F, JSON.stringify({ ...sessionLoad(), ...patch }, null, 2)); }
function sessionClear()      { try { fs.unlinkSync(SESSION_F); } catch {} }

/* ================================================================
   5. CHROME MANAGEMENT
   ================================================================ */

function findChromeBinary() {
  // Playwright-managed Chromium
  const cacheDir = IS_WIN
    ? path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright')
    : path.join(os.homedir(), '.cache', 'ms-playwright');

  if (fs.existsSync(cacheDir)) {
    const dirs = fs.readdirSync(cacheDir).filter(d => d.startsWith('chromium-')).sort().reverse();
    for (const d of dirs) {
      const candidates = IS_WIN
        ? [
            path.join(cacheDir, d, 'chrome-win64', 'chrome.exe'),
            path.join(cacheDir, d, 'chrome-win', 'chrome.exe'),
          ]
        : [
            path.join(cacheDir, d, 'chrome-linux64', 'chrome'),
            path.join(cacheDir, d, 'chrome-linux', 'chrome'),
            path.join(cacheDir, d, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
          ];
      for (const bin of candidates) {
        if (fs.existsSync(bin)) return bin;
      }
    }
  }

  // System installs
  if (IS_WIN) {
    const winCandidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const bin of winCandidates) if (fs.existsSync(bin)) return bin;
  } else {
    for (const n of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
      try { return execSync(`which ${n}`, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim(); } catch {}
    }
  }
  return null;
}

async function ensureChrome() {
  if (await portOpen(CDP_PORT)) { log(`Chrome already on :${CDP_PORT}`); return; }

  const bin = findChromeBinary();
  if (!bin) throw new Error('No Chrome/Chromium binary found. Install Chrome or run `npx playwright install chromium`.');

  log(`Launching Chrome (${path.basename(bin)})…`);
  const args = [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--window-size=${VW},${VH}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--font-render-hinting=none',
    '--mute-audio',
    `--user-data-dir=${path.join(os.tmpdir(), 'eye-chrome-profile')}`,
    'about:blank',
  ];
  if (!IS_WIN) args.unshift('--no-sandbox');

  const proc = spawn(bin, args, { detached: true, stdio: 'ignore', windowsHide: true });
  proc.unref();

  for (let i = 0; i < 60; i++) {
    await sleep(200);
    if (await portOpen(CDP_PORT)) {
      sessionSave({ chromePid: proc.pid });
      log('Chrome ready');
      return;
    }
  }
  throw new Error('Chrome failed to start — CDP port not open after 12 s');
}

/* ================================================================
   6. DEV SERVER
   ================================================================ */

async function ensureDevServer() {
  if (await portOpen(DEV_PORT)) { log(`Dev server already on :${DEV_PORT}`); return; }

  log('Starting Vite dev server…');
  const npmCmd = IS_WIN ? 'npm.cmd' : 'npm';
  const proc = spawn(npmCmd, ['run', 'dev', '--', '--host'], {
    cwd: APP,
    detached: !IS_WIN,
    stdio: 'ignore',
    shell: IS_WIN,
    windowsHide: true,
    env: { ...process.env, BROWSER: 'none' },
  });
  proc.unref();
  sessionSave({ devPid: proc.pid });

  for (let i = 0; i < 120; i++) {
    await sleep(500);
    if (await portOpen(DEV_PORT)) { log('Dev server ready'); return; }
  }
  throw new Error('Dev server not ready after 60 s');
}

/* ================================================================
   7. CDP CLIENT
   ================================================================ */

class CDP {
  constructor() { this.ws = null; this.seq = 0; this.pending = new Map(); }

  async connect() {
    const targets = await httpJSON(`http://localhost:${CDP_PORT}/json`);
    let t = targets.find(t => t.type === 'page' && t.url.includes(`localhost:${DEV_PORT}`));
    if (!t) t = targets.find(t => t.type === 'page');
    if (!t) throw new Error('No CDP page target');

    await new Promise((ok, fail) => {
      this.ws = new WebSocket(t.webSocketDebuggerUrl);
      this.ws.once('open',  ok);
      this.ws.once('error', fail);
      this.ws.on('message', raw => {
        const m = JSON.parse(raw);
        if (m.id !== undefined && this.pending.has(m.id)) {
          const { resolve, reject, timer } = this.pending.get(m.id);
          clearTimeout(timer);
          this.pending.delete(m.id);
          m.error ? reject(new Error(m.error.message)) : resolve(m.result || {});
        }
      });
    });

    await Promise.all([
      this.send('Page.enable'),
      this.send('Runtime.enable'),
      this.send('DOM.enable'),
    ]);
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout (30 s): ${method}`));
      }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() { if (this.ws) { this.ws.close(); this.ws = null; } }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    for (let i = 0; i < 150; i++) {
      await sleep(200);
      try {
        const s = await this.eval('document.readyState');
        if (s === 'complete') return;
      } catch {}
    }
    throw new Error('Navigation timeout (30 s)');
  }

  async eval(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression: String(expression),
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) {
      const msg = exceptionDetails.exception?.description
              || exceptionDetails.text
              || 'Evaluation failed';
      throw new Error(msg);
    }
    return result?.value;
  }

  async screenshot() {
    const { data } = await this.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: VW, height: VH, scale: 1 },
    });
    return Buffer.from(data, 'base64');
  }

  async setViewport() {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: VW, height: VH, deviceScaleFactor: 1, mobile: false,
    });
  }

  async click(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed',  x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  async dblclick(x, y) {
    await this.click(x, y);
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed',  x, y, button: 'left', clickCount: 2 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 2 });
  }

  async mouseMove(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  }

  async drag(fx, fy, tx, ty, steps = 10) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: fx, y: fy, button: 'left', clickCount: 1 });
    for (let i = 1; i <= steps; i++) {
      await this.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: fx + (tx - fx) * (i / steps),
        y: fy + (ty - fy) * (i / steps),
      });
    }
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tx, y: ty, button: 'left', clickCount: 1 });
  }

  async scroll(x, y, dx, dy) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: dx, deltaY: dy });
  }

  async keyPress(key) {
    const k = keyInfo(key);
    await this.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown', key: k.key, code: k.code,
      windowsVirtualKeyCode: k.keyCode, nativeVirtualKeyCode: k.keyCode,
    });
    if (k.text) {
      await this.send('Input.dispatchKeyEvent', {
        type: 'char', key: k.key, code: k.code, text: k.text, unmodifiedText: k.text,
      });
    }
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: k.key, code: k.code,
      windowsVirtualKeyCode: k.keyCode, nativeVirtualKeyCode: k.keyCode,
    });
  }

  async typeText(text) {
    for (const ch of text) { await this.keyPress(ch); await sleep(30); }
  }

  async waitFor(expr, timeout = 10000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { const v = await this.eval(expr); if (v) return v; } catch {}
      await sleep(200);
    }
    throw new Error(`Timed out (${timeout} ms) waiting for: ${expr}`);
  }
}

/* ================================================================
   8. KEY MAPPING
   ================================================================ */

const KEY_CODES = {
  Enter:13, Tab:9, Escape:27, Space:32, Backspace:8, Delete:46,
  ArrowUp:38, ArrowDown:40, ArrowLeft:37, ArrowRight:39,
  Home:36, End:35, PageUp:33, PageDown:34, F1:112, F2:113,
  F3:114, F4:115, F5:116, F6:117, F7:118, F8:119, F9:120,
  F10:121, F11:122, F12:123,
};

function keyInfo(key) {
  if (KEY_CODES[key] !== undefined) {
    return { key: key === 'Space' ? ' ' : key, code: key, keyCode: KEY_CODES[key], text: '' };
  }
  if (key.length === 1) {
    const upper = key.toUpperCase();
    const code  = /[A-Z]/.test(upper) ? `Key${upper}` : /[0-9]/.test(key) ? `Digit${key}` : '';
    return { key, code, keyCode: upper.charCodeAt(0), text: key };
  }
  return { key, code: key, keyCode: 0, text: '' };
}

/* ================================================================
   9. SCREENSHOT ARCHIVE
   ================================================================ */

let _archiveDir = null;
let _shotIdx    = 0;

function archiveDir() {
  if (_archiveDir) return _archiveDir;

  const s = sessionLoad();
  if (s.archiveDir && fs.existsSync(s.archiveDir)) {
    _archiveDir = s.archiveDir;
    _shotIdx = fs.readdirSync(_archiveDir).filter(f => f.endsWith('.png')).length;
    return _archiveDir;
  }

  const g = gitInfo();
  _archiveDir = path.join(SCREENSHOTS, g.branch, g.commit, tsLabel());
  fs.mkdirSync(_archiveDir, { recursive: true });
  sessionSave({ archiveDir: _archiveDir });
  return _archiveDir;
}

function archiveShot(buf, name) {
  const dir = archiveDir();
  _shotIdx++;
  const safe = String(name).replace(/[^a-z0-9._-]/gi, '_');
  const fname = `${String(_shotIdx).padStart(3, '0')}-${safe}.png`;
  const fp = path.join(dir, fname);
  fs.writeFileSync(fp, buf);
  return fp;
}

function writeManifest(logArr, shots, dur) {
  if (!_archiveDir) return;
  const manifest = { ...gitInfo(), timestamp: new Date().toISOString(), duration_ms: dur, screenshots: shots, log: logArr };
  fs.writeFileSync(path.join(_archiveDir, 'session.json'), JSON.stringify(manifest, null, 2));
}

/* ================================================================
   10. GAME BOOT
   ================================================================ */

async function bootGame(cdp) {
  await cdp.setViewport();

  let needsNav = true;
  try {
    const ready = await cdp.eval(
      `typeof window.debug !== "undefined" && window.location.href.includes("localhost:${DEV_PORT}")`
    );
    if (ready) {
      const healthy = await cdp.eval('!!document.querySelector("canvas")');
      if (healthy) { needsNav = false; log('Game already running'); }
    }
  } catch {}

  if (needsNav) {
    try { await cdp.eval('localStorage.clear()'); } catch {}
    log('Navigating to game…');
    await cdp.navigate(GAME_URL);
    await sleep(1000);

    log('Waiting for window.debug…');
    await cdp.waitFor('typeof window.debug !== "undefined"', 20000);

    await cdp.click(VW / 2, VH / 2);
    await sleep(300);
  }

  log('Game ready');
}

/* ================================================================
   11. ACTION HANDLERS
   ================================================================ */

async function runAction(cdp, a) {
  switch (a.action) {
    case 'screenshot': {
      const buf = await cdp.screenshot();
      return { screenshot: archiveShot(buf, a.name || 'capture') };
    }
    case 'debug': {
      const args = (a.args || []).map(v => JSON.stringify(v)).join(', ');
      const val = await cdp.eval(`window.debug.${a.cmd}(${args})`);
      return { result: val };
    }
    case 'eval': {
      return { result: await cdp.eval(a.expression) };
    }
    case 'click':    { await cdp.click(a.x, a.y);          return {}; }
    case 'dblclick': { await cdp.dblclick(a.x, a.y);       return {}; }
    case 'move':     { await cdp.mouseMove(a.x, a.y);      return {}; }
    case 'drag':     { await cdp.drag(a.from.x, a.from.y, a.to.x, a.to.y, a.steps); return {}; }
    case 'scroll':   { await cdp.scroll(a.x||VW/2, a.y||VH/2, a.deltaX||0, a.deltaY||0); return {}; }
    case 'key':      { await cdp.keyPress(a.key);          return {}; }
    case 'type':     { await cdp.typeText(a.text);         return {}; }
    case 'wait':     { await sleep(a.ms || 1000);          return {}; }
    case 'waitFor':  { return { result: await cdp.waitFor(a.expression, a.timeout) }; }
    case 'step': {
      const n = a.count || 1;
      const snap = await cdp.eval(`window.debug.stepAndRender(${n})`);
      await sleep(50);
      const buf = await cdp.screenshot();
      const shot = archiveShot(buf, a.name || `step-${snap?.tick || 'unknown'}`);
      return { snapshot: snap, screenshot: shot };
    }
    case 'step-sequence': {
      const ticksPerStep = a.ticksPerStep || 1;
      const numSteps = a.numSteps || 10;
      const prefix = a.name || 'seq';
      const frames = [];
      for (let i = 0; i < numSteps; i++) {
        const snap = await cdp.eval(`window.debug.stepAndRender(${ticksPerStep})`);
        await sleep(50);
        const buf = await cdp.screenshot();
        const shot = archiveShot(buf, `${prefix}-${String(i).padStart(3, '0')}`);
        frames.push({ frame: i, snapshot: snap, screenshot: shot });
      }
      return { frames };
    }
    case 'step-until': {
      const ticksPerStep = a.ticksPerStep || 1;
      const maxTicks = a.maxTicks || 600;
      const expression = a.expression;
      const prefix = a.name || 'until';
      let stepped = 0;
      const frames = [];
      while (stepped < maxTicks) {
        const snap = await cdp.eval(`window.debug.stepAndRender(${ticksPerStep})`);
        stepped += ticksPerStep;
        const condResult = await cdp.eval(expression);
        if (condResult || (stepped % Math.max(1, Math.floor(maxTicks / 10)) === 0)) {
          await sleep(50);
          const buf = await cdp.screenshot();
          const shot = archiveShot(buf, `${prefix}-tick${snap?.tick || stepped}`);
          frames.push({ frame: frames.length, ticksStepped: stepped, snapshot: snap, screenshot: shot, conditionMet: !!condResult });
        }
        if (condResult) break;
      }
      return { frames, totalTicksStepped: stepped, conditionMet: frames.length > 0 && frames[frames.length - 1].conditionMet };
    }
    case 'reload': {
      await cdp.navigate(GAME_URL);
      await sleep(1000);
      await cdp.waitFor('typeof window.debug !== "undefined"', 20000);
      await cdp.click(VW / 2, VH / 2);
      await sleep(300);
      return {};
    }
    default: throw new Error(`Unknown action: ${a.action}`);
  }
}

/* ================================================================
   12. PLAYBOOK RUNNER
   ================================================================ */

async function runPlaybook(actions) {
  const t0 = Date.now();
  const logArr = [], shots = [], results = [];

  await ensureDevServer();
  await ensureChrome();

  const cdp = new CDP();
  try {
    await cdp.connect();
    await bootGame(cdp);

    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      const label = a.name ? `${a.action} "${a.name}"` : `${a.action}${a.cmd ? ` ${a.cmd}` : ''}`;
      const st = Date.now();
      try {
        const r = await runAction(cdp, a);
        const ms = Date.now() - st;
        if (r.screenshot) shots.push(r.screenshot);
        if (r.frames) {
          for (const f of r.frames) { if (f.screenshot) shots.push(f.screenshot); }
          results.push(r);
        } else if (r.result !== undefined) {
          results.push(r.result);
        } else if (r.snapshot !== undefined) {
          results.push(r);
        }
        logArr.push(`[${i + 1}/${actions.length}] ${label} — ${ms} ms`);
      } catch (err) {
        logArr.push(`[${i + 1}/${actions.length}] ${label} FAILED: ${err.message}`);
        cdp.close();
        const dur = Date.now() - t0;
        writeManifest(logArr, shots, dur);
        return { ok: false, error: err.message, failedStep: i + 1, failedAction: a, log: logArr, screenshots: shots, results, duration_ms: dur, session: _archiveDir };
      }
    }

    cdp.close();
  } catch (err) {
    cdp.close();
    const dur = Date.now() - t0;
    return { ok: false, error: err.message, log: logArr, screenshots: shots, results, duration_ms: dur };
  }

  const dur = Date.now() - t0;
  writeManifest(logArr, shots, dur);
  return { ok: true, log: logArr, screenshots: shots, results, duration_ms: dur, session: _archiveDir };
}

/* ================================================================
   13. CLI COMMANDS
   ================================================================ */

async function cmdStart() {
  await ensureDevServer();
  await ensureChrome();
  const cdp = new CDP();
  await cdp.connect();
  await bootGame(cdp);
  const buf = await cdp.screenshot();
  const fp = archiveShot(buf, 'session-start');
  cdp.close();
  return { ok: true, message: 'Game running and ready', screenshots: [fp], session: _archiveDir };
}

async function cmdStop() {
  const s = sessionLoad();
  const killed = [];
  if (s.chromePid) {
    try {
      if (IS_WIN) execSync(`taskkill /F /PID ${s.chromePid}`, { stdio: 'pipe' });
      else process.kill(s.chromePid, 'SIGTERM');
      killed.push('chrome');
    } catch {}
  }
  if (process.argv.includes('--all') && s.devPid) {
    try {
      if (IS_WIN) execSync(`taskkill /F /T /PID ${s.devPid}`, { stdio: 'pipe' });
      else process.kill(-s.devPid, 'SIGTERM');
      killed.push('dev-server');
    } catch {}
  }
  sessionClear();
  return { ok: true, killed };
}

async function cmdStatus() {
  return {
    ok: true,
    chrome:    await portOpen(CDP_PORT),
    devServer: await portOpen(DEV_PORT),
    session:   sessionLoad(),
  };
}

/* ================================================================
   14. MAIN DISPATCH
   ================================================================ */

const VERIFY_QUICK = [
  { action: 'reload' },
  { action: 'wait', ms: 500 },
  { action: 'screenshot', name: 'verify-quick' },
];

function readStdin() {
  // readFileSync(0) is Windows-friendly; '/dev/stdin' is not.
  return fs.readFileSync(0, 'utf8');
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  let result;

  switch (cmd) {
    case 'start':  result = await cmdStart();  break;
    case 'stop':   result = await cmdStop();   break;
    case 'status': result = await cmdStatus(); break;

    case 'play': {
      const raw = (!args[0] || args[0] === '-') ? readStdin() : fs.readFileSync(args[0], 'utf8');
      result = await runPlaybook(JSON.parse(raw));
      break;
    }

    case 'verify-quick': result = await runPlaybook(VERIFY_QUICK); break;

    case 'snapshot': {
      result = await runPlaybook([
        { action: 'screenshot', name: args[0] || 'snapshot' },
      ]);
      break;
    }

    case 'step': {
      const n = parseInt(args[0], 10) || 1;
      result = await runPlaybook([{ action: 'step', count: n, name: args[1] || undefined }]);
      break;
    }
    case 'step-sequence': {
      const ticksPerStep = parseInt(args[0], 10) || 10;
      const numSteps = parseInt(args[1], 10) || 10;
      result = await runPlaybook([{ action: 'step-sequence', ticksPerStep, numSteps, name: args[2] || undefined }]);
      break;
    }
    case 'step-until': {
      const expression = args[0];
      const ticksPerStep = parseInt(args[1], 10) || 1;
      const maxTicks = parseInt(args[2], 10) || 600;
      result = await runPlaybook([{ action: 'step-until', expression, ticksPerStep, maxTicks, name: args[3] || undefined }]);
      break;
    }

    case 'screenshot': {
      result = await runPlaybook([{ action: 'screenshot', name: args[0] || 'capture' }]);
      break;
    }
    case 'debug': {
      const [debugCmd, ...rest] = args;
      const parsed = rest.map(a => { try { return JSON.parse(a); } catch { return a; } });
      result = await runPlaybook([{ action: 'debug', cmd: debugCmd, args: parsed }]);
      break;
    }
    case 'click': {
      result = await runPlaybook([{ action: 'click', x: +args[0], y: +args[1] }]);
      break;
    }
    case 'key': {
      result = await runPlaybook([{ action: 'key', key: args[0] }]);
      break;
    }
    case 'eval': {
      result = await runPlaybook([{ action: 'eval', expression: args.join(' ') }]);
      break;
    }

    default:
      result = {
        ok: false,
        error: cmd ? `Unknown command: ${cmd}` : 'No command given',
        usage: [
          'node eye.cjs <command>',
          '',
          'Commands:',
          '  start                           Launch Chrome & dev server, navigate to game',
          '  stop [--all]                    Kill Chrome (--all = also dev server)',
          '  status                          Check what is running',
          '  screenshot <name>               Take one screenshot',
          '  debug <cmd> [args...]           Run one window.debug command',
          '  click <x> <y>                   Click at viewport coordinates',
          '  key <key>                       Press key',
          '  eval <expression>               Evaluate JS in game context',
          '  step [n] [name]                 Pause + advance n ticks + render + screenshot',
          '  step-sequence [tps] [n] [name]  Step n times (tps ticks each), screenshot all',
          '  step-until <expr> [tps] [max]   Step until JS expr is truthy',
          '  play [file|-]                   Run JSON playbook (stdin or file)',
          '  verify-quick                    Reload + screenshot',
        ],
      };
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch(err => {
  process.stdout.write(JSON.stringify({ ok: false, error: err.message }) + '\n');
  process.exit(1);
});
