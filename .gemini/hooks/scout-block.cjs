#!/usr/bin/env node
/**
 * Gemini CLI Adapter: BeforeTool → scout-block
 *
 * Blocks access to directories in .gemini/.ckignore.
 * Normalizes Gemini tool names to Gemini format for shared lib.
 *
 * Event: BeforeTool | Matcher: write_file|replace|read_file|shell|glob|grep
 */

const { runAdapter, normalizeToolName, formatBlock, bridgeGeminiEnvVars } = require('./lib/cli-adapter.cjs');
const { isHookEnabled } = require('./lib/gk-config-utils.cjs');

runAdapter('scout-block', async () => {
  if (!isHookEnabled('scout-block')) process.exit(0);

  const fs = require('fs');
  const path = require('path');
  const { checkScoutBlock } = require('./lib/scout-checker.cjs');

  bridgeGeminiEnvVars();

  const hookInput = fs.readFileSync(0, 'utf-8');
  if (!hookInput || !hookInput.trim()) { process.exit(0); }

  let data;
  try { data = JSON.parse(hookInput); } catch { process.exit(0); }
  if (!data.tool_input || typeof data.tool_input !== 'object') { process.exit(0); }

  const toolName = normalizeToolName(data.tool_name || 'unknown');
  const claudeDir = path.resolve(process.env.GEMINI_PROJECT_DIR || process.cwd(), '.gemini');

  const result = checkScoutBlock({
    toolName,
    toolInput: data.tool_input,
    options: {
      claudeDir,
      ckignorePath: path.join(claudeDir, '.ckignore'),
      checkBroadPatterns: true
    }
  });

  if (result.isAllowedCommand) { process.exit(0); }

  if (result.blocked) {
    const reason = result.isBroadPattern
      ? `Broad pattern blocked: ${result.reason}`
      : `Blocked path: ${result.path} (pattern: ${result.pattern})`;
    console.log(JSON.stringify(formatBlock(reason)));
    process.exit(2);
  }

  process.exit(0);
});
