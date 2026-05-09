#!/usr/bin/env node
'use strict';

/* Integration harness: spawn Vite + Chromium (Playwright), boot the game,
 * confirm window.debug is reachable and the canvas is rendering. Exits 0 on
 * success, non-zero on failure.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const APP_DIR = __dirname;
const DEV_PORT = parseInt(process.env.EYE_DEV_PORT || '5180', 10);
const URL = `http://localhost:${DEV_PORT}`;
const IS_WIN = process.platform === 'win32';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function portOpen(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

async function startVite() {
  if (await portOpen(DEV_PORT)) {
    console.log(`[test] Dev server already on :${DEV_PORT}`);
    return null;
  }
  console.log('[test] Starting Vite dev server…');
  const npmCmd = IS_WIN ? 'npm.cmd' : 'npm';
  const proc = spawn(npmCmd, ['run', 'dev'], {
    cwd: APP_DIR,
    stdio: 'pipe',
    shell: IS_WIN,
    env: { ...process.env, BROWSER: 'none' },
  });
  proc.stdout.on('data', () => {});
  proc.stderr.on('data', () => {});
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    if (await portOpen(DEV_PORT)) { console.log('[test] Dev server ready'); return proc; }
  }
  proc.kill();
  throw new Error('Dev server not ready after 60s');
}

async function main() {
  let viteProc = null;
  let browser = null;
  try {
    viteProc = await startVite();

    const { chromium } = require(path.join(APP_DIR, 'node_modules', 'playwright'));
    console.log('[test] Launching Chromium…');
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();

    page.on('pageerror', (err) => { throw new Error(`Page error: ${err.message}`); });
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error(`[browser:error] ${msg.text()}`);
    });

    console.log(`[test] Navigating to ${URL}…`);
    await page.goto(URL, { waitUntil: 'load', timeout: 30000 });

    console.log('[test] Waiting for window.debug…');
    await page.waitForFunction(() => typeof (window).debug !== 'undefined', null, { timeout: 15000 });

    const snap = await page.evaluate(() => (window).debug.snapshot());
    console.log('[test] Initial snapshot:', JSON.stringify(snap));
    if (typeof snap.tick !== 'number') throw new Error('Snapshot missing tick field');

    const canvasOk = await page.evaluate(() => !!document.querySelector('canvas'));
    if (!canvasOk) throw new Error('No canvas element found');

    const after = await page.evaluate(() => {
      const d = (window).debug;
      d.pause();
      const before = d.snapshot();
      const result = d.stepAndRender(60);
      return { delta: result.tick - before.tick, paused: result.paused };
    });
    console.log('[test] pause + stepAndRender(60) delta:', JSON.stringify(after));
    if (after.delta !== 60) throw new Error(`stepAndRender advanced ${after.delta} ticks, expected 60`);
    if (!after.paused) throw new Error('stepAndRender did not preserve paused state');

    console.log('[test] PASS');
  } catch (err) {
    console.error('[test] FAIL:', err.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (viteProc) {
      if (IS_WIN) {
        try { require('child_process').execSync(`taskkill /F /T /PID ${viteProc.pid}`, { stdio: 'pipe' }); } catch {}
      } else {
        viteProc.kill();
      }
    }
  }
}

main();
