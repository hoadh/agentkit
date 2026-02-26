#!/usr/bin/env node
/**
 * Gemini CLI Adapter: BeforeTool → privacy-block
 *
 * Blocks access to sensitive files (.env, credentials, keys).
 * Uses Gemini's decision/systemMessage instead of Gemini's AskUserQuestion.
 *
 * Event: BeforeTool | Matcher: write_file|replace|read_file|shell|glob|grep
 */

const { runAdapter, normalizeToolName, formatBlock, bridgeGeminiEnvVars } = require('./lib/cli-adapter.cjs');
const { isHookEnabled } = require('./lib/gk-config-utils.cjs');

runAdapter('privacy-block', async () => {
  if (!isHookEnabled('privacy-block')) process.exit(0);

  const fs = require('fs');
  const path = require('path');
  const { checkPrivacy } = require('./lib/privacy-checker.cjs');

  bridgeGeminiEnvVars();

  let input = '';
  for await (const chunk of process.stdin) { input += chunk; }

  let hookData;
  try { hookData = JSON.parse(input); } catch { process.exit(0); }

  const toolName = normalizeToolName(hookData.tool_name || 'unknown');

  const result = checkPrivacy({
    toolName,
    toolInput: hookData.tool_input,
    options: { allowBash: true }
  });

  // Approved access (APPROVED: prefix flow)
  if (result.approved) { process.exit(0); }

  // Bash commands: warn but allow (Gemini handles shell differently)
  if (result.isBash) {
    console.error(`WARN: ${result.reason}`);
    process.exit(0);
  }

  // Blocked: use Gemini's systemMessage for user notification
  if (result.blocked) {
    const basename = path.basename(result.filePath);
    const output = formatBlock(
      `Privacy: ${basename} may contain secrets`,
      `Sensitive file "${basename}" blocked. This file may contain API keys, passwords, or tokens. The agent should ask for your approval before accessing it.`
    );
    console.log(JSON.stringify(output));
    process.exit(2);
  }

  process.exit(0);
});
