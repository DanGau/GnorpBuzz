#!/usr/bin/env node

// Stop hook: three-gate verification for game changes.
//
// Gate 1 (mechanical): Were game files edited? If not → pass (free).
// Gate 2 (mechanical): Was verification attempted (build + screenshot)? If not → block.
// Gate 3 (LLM):        Was the verification genuine, or a shortcut? → haiku judges.
//
// Principle 3: Mechanical Enforcement Over Documentation.

import { readFileSync } from 'fs';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

if (input.stop_hook_active) {
  process.exit(0);
}

const transcriptPath = input.transcript_path;
if (!transcriptPath) {
  process.exit(0);
}

let transcriptLines;
try {
  transcriptLines = readFileSync(transcriptPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
} catch {
  process.exit(0);
}

function findToolUses(obj, results = []) {
  if (!obj || typeof obj !== 'object') return results;
  if (obj.type === 'tool_use' && obj.name) {
    results.push({ name: obj.name, input: obj.input || {} });
  }
  const items = Array.isArray(obj) ? obj : Object.values(obj);
  for (const item of items) findToolUses(item, results);
  return results;
}

const allToolUses = [];
for (const line of transcriptLines) findToolUses(line, allToolUses);

// ── Gate 1: Were game files edited? ─────────────────────────────
function isGameFile(filePath) {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, '/');
  const inProject = /\/app\/(?!.*\.mdx?$)/i.test(normalized);
  return inProject;
}

const gameFileEdits = allToolUses.filter(tool =>
  ['Edit', 'Write'].includes(tool.name) && isGameFile(tool.input.file_path)
);

if (gameFileEdits.length === 0) process.exit(0);

const editedFiles = [...new Set(
  gameFileEdits.map(t => t.input.file_path).filter(Boolean)
)];
const fileList = editedFiles.slice(0, 5).join(', ') +
  (editedFiles.length > 5 ? ` (+${editedFiles.length - 5} more)` : '');

// ── Gate 2: Was verification attempted? ─────────────────────────
const bashCommands = allToolUses
  .filter(tool => tool.name === 'Bash')
  .map(tool => (tool.input.command || '').toLowerCase());

const hasBuild = bashCommands.some(cmd =>
  cmd.includes('npm run build') ||
  cmd.includes('tsc --noemit') ||
  cmd.includes('npx tsc')
);

const hasScreenshotCmd = bashCommands.some(cmd =>
  cmd.includes('screenshot') ||
  cmd.includes('eye.cjs') ||
  cmd.includes('verify-quick') ||
  cmd.includes('page.screenshot') ||
  cmd.includes('puppeteer') ||
  cmd.includes('playwright') ||
  cmd.includes('test-game')
);

const hasScreenshotRead = allToolUses.some(tool => {
  if (tool.name !== 'Read') return false;
  const fp = (tool.input.file_path || '').toLowerCase();
  return /screenshot.*\.(png|jpe?g)|\.(png|jpe?g)$/.test(fp);
});

const hasScreenshot = hasScreenshotCmd || hasScreenshotRead;

const missing = [];
if (!hasBuild) missing.push('Build (`npm run build`)');
if (!hasScreenshot) missing.push('Screenshot (visual proof)');

if (missing.length > 0) {
  const result = {
    decision: 'block',
    reason: [
      `You edited game files but haven't completed verification.`,
      ``,
      `Files changed: ${fileList}`,
      `Missing: ${missing.join(', ')}`,
      ``,
      `Complete the verification checklist before finishing:`,
      `1. Build — cd app && npm run build`,
      `2. Test — cd app && node test-game.cjs`,
      `3. Screenshot — node .claude/skills/game-eyes/scripts/eye.cjs verify-quick`,
      `   then Read each returned PNG path`,
      ``,
      `IMPORTANT: Verify in the ACTUAL running game, not a test scene or isolated harness.`,
    ].join('\n')
  };
  console.log(JSON.stringify(result));
  process.exit(0);
}

// ── Gate 3: Was verification genuine? ───────────────────────────
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) process.exit(0);

const lastMessage = input.last_assistant_message || '';
const recentTools = allToolUses.slice(-30).map(t => {
  const inp = JSON.stringify(t.input || {});
  return `${t.name}: ${inp.length > 300 ? inp.slice(0, 300) + '…' : inp}`;
}).join('\n');

const qualityPrompt = `You are a verification quality auditor for a 2D web-game project (GnorpBuzz, PixiJS).

The assistant edited these game files:
${editedFiles.join('\n')}

It then attempted verification (build + screenshot). Your job: was the verification GENUINE, or did the assistant cut corners?

SHORTCUTS that FAIL:
- Created a throwaway test file, test scene, or isolated test page to verify in isolation instead of the real game
- Screenshot shows a blank page, error, test harness, minimal reproduction, or dev tool output — not the actual game
- Navigated to a custom test URL instead of the game's dev server (localhost:5180)
- Only verified a tiny isolated piece rather than the change integrated into the full game
- "Verified" by just showing the code compiles, without visual proof of the change working in-game

GENUINE verification that PASSES:
- Screenshot of the real game running at localhost:5180 with the change visible
- Ran the project's integration test harness (test-game.cjs) which launches the real game
- Shows the change working in the full game, not isolated
- Verification may not be pixel-perfect but shows the change in the real game

Recent tool activity:
${recentTools}

Assistant's last message:
${lastMessage.slice(0, 3000)}

Respond with EXACTLY one line: PASS or FAIL
If FAIL, add a second line with a brief reason (one sentence).`;

try {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: qualityPrompt }],
    }),
  });

  if (!response.ok) process.exit(0);

  const data = await response.json();
  const judgment = (data.content?.[0]?.text || '').trim();

  if (judgment.startsWith('FAIL')) {
    const reason = judgment.split('\n').slice(1).join(' ').trim();
    const result = {
      decision: 'block',
      reason: [
        `Verification quality check FAILED.`,
        reason ? `Reason: ${reason}` : '',
        ``,
        `Files changed: ${fileList}`,
        ``,
        `You need to verify your changes in the ACTUAL running game:`,
        `1. cd app && npm run dev   (or let eye.cjs auto-start it)`,
        `2. node .claude/skills/game-eyes/scripts/eye.cjs verify-quick`,
        `3. Read the returned PNG paths`,
        ``,
        `Do NOT create test scenes, throwaway test files, or isolated harnesses.`,
      ].filter(Boolean).join('\n')
    };
    console.log(JSON.stringify(result));
  }
} catch {
  // Network/parsing error, fail open
}

process.exit(0);
