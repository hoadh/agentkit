#!/usr/bin/env node
/**
 * Gemini CLI Adapter: BeforeTool → descriptive-name
 *
 * Injects file naming guidance when creating files.
 * Nearly identical to Gemini version — hookSpecificOutput format is shared.
 *
 * Event: BeforeTool | Matcher: write_file
 */

const { runAdapter, formatAllow } = require('./lib/cli-adapter.cjs');
const { isHookEnabled } = require('./lib/gk-config-utils.cjs');

runAdapter('descriptive-name', async () => {
  if (!isHookEnabled('descriptive-name')) process.exit(0);

  const guidance = `## File naming guidance:
- Skip this guidance if you are creating markdown or plain text files
- Prefer kebab-case for JS/TS/Python/shell (.js, .ts, .py, .sh) with descriptive names
- Respect language conventions: C#/Java/Kotlin/Swift use PascalCase (.cs, .java, .kt, .swift), Go/Rust use snake_case (.go, .rs)
- Other languages: follow their ecosystem's standard naming convention
- Goal: self-documenting names for LLM tools (Grep, Glob, Search)`;

  const output = {
    hookSpecificOutput: {
      hookEventName: 'BeforeTool',
      permissionDecision: 'allow',
      additionalContext: guidance
    }
  };

  console.log(JSON.stringify(output));
  process.exit(0);
});
