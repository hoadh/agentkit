#!/usr/bin/env node
/**
 * Gemini CLI Adapter: AfterTool → post-edit-simplify-reminder
 *
 * Tracks file edits and reminds about code-simplifier after threshold.
 * Shares session tracking file with Gemini version.
 *
 * Event: AfterTool | Matcher: write_file|replace
 */

const { runAdapter, normalizeToolName, bridgeGeminiEnvVars } = require('./lib/cli-adapter.cjs');
const { isHookEnabled } = require('./lib/gk-config-utils.cjs');

runAdapter('post-edit-simplify-reminder', async () => {
  if (!isHookEnabled('post-edit-simplify-reminder')) process.exit(0);

  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  bridgeGeminiEnvVars();

  const SESSION_TRACK_FILE = path.join(os.tmpdir(), 'gk-simplify-session.json');
  const EDIT_THRESHOLD = 5;

  const stdin = fs.readFileSync(0, 'utf8');
  const hookData = JSON.parse(stdin || '{}');
  const toolName = normalizeToolName(hookData.tool_name || '');

  // Only track edit operations (normalized to Gemini names)
  const editTools = ['Edit', 'Write', 'MultiEdit'];
  if (!editTools.includes(toolName)) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  // Load or init session data
  let session;
  try {
    session = JSON.parse(fs.readFileSync(SESSION_TRACK_FILE, 'utf8'));
    if (Date.now() - session.startTime > 2 * 60 * 60 * 1000) throw new Error('expired');
  } catch {
    session = { startTime: Date.now(), editCount: 0, modifiedFiles: [], lastReminder: 0, simplifierRun: false };
  }

  session.editCount++;
  const filePath = hookData.tool_input?.file_path || hookData.tool_input?.path || '';
  if (filePath && !session.modifiedFiles.includes(filePath)) {
    session.modifiedFiles.push(filePath);
  }

  const shouldRemind =
    session.editCount >= EDIT_THRESHOLD &&
    !session.simplifierRun &&
    (Date.now() - session.lastReminder > 10 * 60 * 1000);

  const result = { continue: true };
  if (shouldRemind) {
    session.lastReminder = Date.now();
    result.additionalContext = `\n\n[Code Simplification Reminder] You have modified ${session.modifiedFiles.length} files. Consider running code-simplifier before code review.`;
  }

  try { fs.writeFileSync(SESSION_TRACK_FILE, JSON.stringify(session, null, 2)); } catch { /* ignore */ }

  console.log(JSON.stringify(result));
});
