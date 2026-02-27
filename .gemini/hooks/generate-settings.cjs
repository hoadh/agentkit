#!/usr/bin/env node
/**
 * generate-settings.cjs - Generate .gemini/settings.json from .gemini/settings.json
 *
 * Translates Claude Code hook configuration to Gemini CLI format.
 * Maps event names, tool matchers, and command paths.
 *
 * Usage: node .gemini/hooks/gemini/generate-settings.cjs [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { convertMatcher } = require('./lib/cli-adapter.cjs');

const PROJECT_ROOT = process.cwd();
const CLAUDE_SETTINGS = path.join(PROJECT_ROOT, '.agent', 'settings.json');
const GEMINI_DIR = path.join(PROJECT_ROOT, '.gemini');
const GEMINI_SETTINGS = path.join(GEMINI_DIR, 'settings.json');
const ADAPTER_DIR = path.join(PROJECT_ROOT, '.agent', 'hooks', 'gemini');

const dryRun = process.argv.includes('--dry-run');

// Event name mapping: Claude → Gemini
const EVENT_MAP = {
  'SessionStart': 'SessionStart',
  'UserPromptSubmit': 'BeforeAgent',
  'PreToolUse': 'BeforeTool',
  'PostToolUse': 'AfterTool',
  // No Gemini equivalent for these:
  // 'SubagentStart': null,
  // 'SubagentStop': null,
};

// Hooks that have Gemini adapters (filename must match)
const ADAPTER_MAP = {
  'session-init': 'session-init.cjs',
  'dev-rules-reminder': 'dev-rules-reminder.cjs',
  'scout-block': 'scout-block.cjs',
  'privacy-block': 'privacy-block.cjs',
  'descriptive-name': 'descriptive-name.cjs',
  'post-edit-simplify-reminder': 'post-edit-simplify-reminder.cjs',
};

/**
 * Extract hook name from command path
 * e.g., "node .gemini/hooks/scout-block.cjs" → "scout-block"
 */
function extractHookName(command) {
  const match = command.match(/([a-z-]+)\.cjs$/);
  return match ? match[1] : null;
}

/**
 * Convert a single Claude hook entry to Gemini format
 */
function convertHook(claudeHook, claudeEvent) {
  const hookName = extractHookName(claudeHook.command || '');
  if (!hookName) return null;

  // Check if we have an adapter for this hook
  const adapterFile = ADAPTER_MAP[hookName];
  if (!adapterFile) return null;

  // Verify adapter file exists
  const adapterPath = path.join(ADAPTER_DIR, adapterFile);
  if (!fs.existsSync(adapterPath)) {
    console.error(`WARN: Adapter missing for ${hookName}: ${adapterPath}`);
    return null;
  }

  return {
    name: `gk-${hookName}`,
    type: 'command',
    command: `node $GEMINI_PROJECT_DIR/.gemini/hooks/gemini/${adapterFile}`,
    timeout: claudeHook.timeout ? claudeHook.timeout * 1000 : 5000,
    description: `AgentKit adapter: ${hookName}`
  };
}

/**
 * Convert a Gemini hook group (with matcher) to Gemini format
 */
function convertHookGroup(group, claudeEvent) {
  const geminiEvent = EVENT_MAP[claudeEvent];
  if (!geminiEvent) return null;

  const hooks = (group.hooks || [])
    .map(h => convertHook(h, claudeEvent))
    .filter(Boolean);

  if (hooks.length === 0) return null;

  // Convert matcher for tool events
  let matcher = group.matcher || '*';
  if (geminiEvent === 'BeforeTool' || geminiEvent === 'AfterTool') {
    matcher = convertMatcher(matcher);
  }

  return { matcher, hooks };
}

function main() {
  // Read Gemini settings
  if (!fs.existsSync(CLAUDE_SETTINGS)) {
    console.error('ERROR: .gemini/settings.json not found');
    process.exit(1);
  }
  const gemini = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS, 'utf-8'));
  const claudeHooks = gemini.hooks || {};

  // Build Gemini hooks config
  const geminiHooks = {};

  for (const [claudeEvent, groups] of Object.entries(claudeHooks)) {
    const geminiEvent = EVENT_MAP[claudeEvent];
    if (!geminiEvent) {
      console.log(`SKIP: ${claudeEvent} (no Gemini equivalent)`);
      continue;
    }

    const converted = groups
      .map(g => convertHookGroup(g, claudeEvent))
      .filter(Boolean);

    if (converted.length > 0) {
      geminiHooks[geminiEvent] = [
        ...(geminiHooks[geminiEvent] || []),
        ...converted
      ];
    }
  }

  const geminiSettings = { hooks: geminiHooks };
  const output = JSON.stringify(geminiSettings, null, 2);

  if (dryRun) {
    console.log('=== Generated .gemini/settings.json (dry run) ===');
    console.log(output);
    return;
  }

  // Write .gemini/settings.json
  if (!fs.existsSync(GEMINI_DIR)) {
    fs.mkdirSync(GEMINI_DIR, { recursive: true });
  }

  // Merge with existing settings if present
  let existing = {};
  if (fs.existsSync(GEMINI_SETTINGS)) {
    try { existing = JSON.parse(fs.readFileSync(GEMINI_SETTINGS, 'utf-8')); } catch { /* ignore */ }
  }
  existing.hooks = geminiHooks;

  fs.writeFileSync(GEMINI_SETTINGS, JSON.stringify(existing, null, 2) + '\n');
  console.log(`Generated: ${GEMINI_SETTINGS}`);
  console.log(`  Events: ${Object.keys(geminiHooks).join(', ')}`);
  console.log(`  Hooks: ${Object.values(geminiHooks).flat().reduce((sum, g) => sum + g.hooks.length, 0)} total`);
}

main();
