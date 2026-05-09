#!/usr/bin/env node
'use strict';

/* /launch — start Vite + open real Chrome maximized on primary monitor.
 *
 * Designed to be mechanical: one command, no flags, just runs.
 *   node .claude/skills/launch/launch.cjs
 *
 * Output: a single JSON line on stdout describing what happened.
 */

const { execSync, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const http = require('http');
const os   = require('os');

const IS_WIN   = process.platform === 'win32';
const DEV_PORT = parseInt(process.env.LAUNCH_DEV_PORT || '5180', 10);
const URL      = `http://localhost:${DEV_PORT}`;

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

const APP = findApp();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function portOpen(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

async function ensureDevServer() {
  if (await portOpen(DEV_PORT)) return { started: false, port: DEV_PORT };

  const npmCmd = IS_WIN ? 'npm.cmd' : 'npm';
  const proc = spawn(npmCmd, ['run', 'dev'], {
    cwd: APP,
    detached: !IS_WIN,
    stdio: 'ignore',
    shell: IS_WIN,
    windowsHide: true,
    env: { ...process.env, BROWSER: 'none' },
  });
  proc.unref();

  for (let i = 0; i < 120; i++) {
    await sleep(500);
    if (await portOpen(DEV_PORT)) return { started: true, port: DEV_PORT, pid: proc.pid };
  }
  throw new Error(`Dev server did not become ready on :${DEV_PORT} after 60 s`);
}

// Try real Chrome first (so the user gets a normal browser to play in), then Edge,
// then Playwright's bundled Chromium as a last resort. Headless Chromium *shells*
// are skipped — the user wants a window they can interact with.
function findChrome() {
  if (IS_WIN) {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const bin of candidates) if (fs.existsSync(bin)) return bin;

    // Playwright's full chromium (not the headless shell) as a fallback.
    const cache = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
    if (fs.existsSync(cache)) {
      const dirs = fs.readdirSync(cache)
        .filter((d) => /^chromium-\d+$/.test(d))
        .sort()
        .reverse();
      for (const d of dirs) {
        const bin = path.join(cache, d, 'chrome-win64', 'chrome.exe');
        if (fs.existsSync(bin)) return bin;
      }
    }
    return null;
  }

  // macOS / Linux fallback (the user is on Windows, but keep this portable).
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(macChrome)) return macChrome;
  for (const n of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser']) {
    try { return execSync(`which ${n}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); } catch {}
  }
  return null;
}

// On Windows, ask the OS for the primary monitor's working area so the window lands
// on the right display. Fallback: (0, 0) which is conventionally the primary monitor.
function primaryMonitorRect() {
  if (!IS_WIN) return { x: 0, y: 0, w: 1600, h: 900 };
  try {
    const out = execSync(
      'powershell.exe -NoProfile -Command "' +
      "Add-Type -AssemblyName System.Windows.Forms; " +
      '$s = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea; ' +
      'Write-Output ($s.X.ToString() + \',\' + $s.Y.ToString() + \',\' + $s.Width.ToString() + \',\' + $s.Height.ToString())' +
      '"',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 }
    ).trim();
    const [x, y, w, h] = out.split(',').map((n) => parseInt(n, 10));
    if ([x, y, w, h].every(Number.isFinite)) return { x, y, w, h };
  } catch {}
  return { x: 0, y: 0, w: 1600, h: 900 };
}

function launchChrome(bin, url) {
  const rect = primaryMonitorRect();
  // A dedicated user-data-dir keeps this window separate from the user's normal Chrome
  // profile (extensions, signed-in tabs, etc.) and from the headless game-eyes profile.
  const userData = path.join(os.tmpdir(), 'gnorpbuzz-play-profile');

  const args = [
    `--user-data-dir=${userData}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--window-position=${rect.x},${rect.y}`,
    `--window-size=${rect.w},${rect.h}`,
    '--new-window',
    url,
  ];

  const proc = spawn(bin, args, { detached: true, stdio: 'ignore', windowsHide: false });
  proc.unref();
  return { pid: proc.pid, bin, rect };
}

(async () => {
  try {
    const dev = await ensureDevServer();

    const bin = findChrome();
    if (!bin) {
      throw new Error('No Chrome/Edge installation found. Install Google Chrome from https://www.google.com/chrome/.');
    }

    const chrome = launchChrome(bin, URL);

    process.stdout.write(JSON.stringify({
      ok: true,
      url: URL,
      devServer: dev,
      chrome: { binary: chrome.bin, pid: chrome.pid, position: chrome.rect },
      message: 'GnorpBuzz launched. Have fun.',
    }) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: err.message }) + '\n');
    process.exit(1);
  }
})();
