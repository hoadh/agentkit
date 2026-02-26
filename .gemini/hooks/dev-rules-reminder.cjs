#!/usr/bin/env node
/**
 * Gemini CLI Adapter: BeforeAgent → dev-rules-reminder
 *
 * Injects session context, rules, and plan info before agent processes prompt.
 * Reads from env cache instead of CLAUDE_ENV_FILE.
 *
 * Event: BeforeAgent | Matcher: (none — fires on all prompts)
 */

const { runAdapter, bridgeGeminiEnvVars, formatAllow } = require('./lib/cli-adapter.cjs');
const { isHookEnabled } = require('./lib/gk-config-utils.cjs');

runAdapter('dev-rules-reminder', async () => {
  if (!isHookEnabled('dev-rules-reminder')) process.exit(0);

  const fs = require('fs');
  const { buildReminderContext, wasRecentlyInjected } = require('./lib/context-builder.cjs');

  bridgeGeminiEnvVars();

  const stdin = fs.readFileSync(0, 'utf-8').trim();
  if (!stdin) process.exit(0);

  const payload = JSON.parse(stdin);
  if (wasRecentlyInjected(payload.transcript_path)) process.exit(0);

  const sessionId = payload.session_id || process.env.GEMINI_SESSION_ID || null;
  const baseDir = process.env.GEMINI_PROJECT_DIR || process.cwd();

  const { content } = buildReminderContext({ sessionId, baseDir });

  const output = formatAllow(content, 'BeforeAgent');
  console.log(JSON.stringify(output));
  process.exit(0);
});
