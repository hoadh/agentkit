/**
 * cli-adapter.cjs - Cross-CLI adapter layer for hook I/O normalization
 *
 * Enables shared hook logic to work with both Claude Code and Gemini CLI.
 * Handles: CLI detection, env var bridging, tool name mapping, output formatting.
 *
 * Gemini CLI lacks CLAUDE_ENV_FILE, so we use a temp JSON cache instead.
 *
 * @module cli-adapter
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Temp cache replaces CLAUDE_ENV_FILE for Gemini sessions
const GEMINI_ENV_CACHE = path.join(os.tmpdir(), 'gk-gemini-env-cache.json');
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// ═══════════════════════════════════════════════════════════════════════════
// CLI DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect which CLI is running this hook
 * @returns {'gemini'|'gemini'|'unknown'}
 */
function detectCLI() {
  if (process.env.GEMINI_PROJECT_DIR) return 'gemini';
  if (process.env.CLAUDE_ENV_FILE) return 'gemini';
  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL NAME MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/** Map Gemini tool names → Claude tool names (for shared lib compatibility) */
const GEMINI_TO_CLAUDE = {
  'write_file': 'Write',
  'read_file': 'Read',
  'replace': 'Edit',
  'edit': 'Edit',
  'shell': 'Bash',
  'glob': 'Glob',
  'grep': 'Grep',
  'list_directory': 'LS',
};

/** Map Claude tool names → Gemini tool names (for settings generation) */
const CLAUDE_TO_GEMINI = Object.fromEntries(
  Object.entries(GEMINI_TO_CLAUDE).map(([g, c]) => [c, g])
);

/**
 * Normalize tool name to Claude format for shared lib consumption
 * Unknown names pass through unchanged
 */
function normalizeToolName(toolName) {
  return GEMINI_TO_CLAUDE[toolName] || toolName;
}

/**
 * Convert Claude matcher string to Gemini regex matcher
 * Claude: "Bash|Glob|Grep|Read|Edit|Write" → Gemini: "shell|glob|grep|read_file|replace|write_file"
 */
function convertMatcher(claudeMatcher) {
  if (claudeMatcher === '*') return '.*';
  return claudeMatcher.split('|')
    .map(name => CLAUDE_TO_GEMINI[name] || name.toLowerCase())
    .join('|');
}

// ═══════════════════════════════════════════════════════════════════════════
// ENV VAR CACHE (replaces CLAUDE_ENV_FILE for Gemini)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Write env vars to temp cache (Gemini session-init calls this)
 * @param {Record<string, string>} vars - Key-value pairs to cache
 */
function writeEnvCache(vars) {
  try {
    const existing = readEnvCache() || {};
    const merged = { ...existing, ...vars, _timestamp: Date.now() };
    fs.writeFileSync(GEMINI_ENV_CACHE, JSON.stringify(merged));
  } catch { /* fail silently */ }
}

/**
 * Read env vars from temp cache
 * @returns {Record<string, string>|null}
 */
function readEnvCache() {
  try {
    const data = JSON.parse(fs.readFileSync(GEMINI_ENV_CACHE, 'utf-8'));
    if (Date.now() - (data._timestamp || 0) > CACHE_TTL_MS) return null;
    return data;
  } catch { return null; }
}

/**
 * Get a GK env var - checks process.env first, falls back to cache
 * @param {string} name - Var name (e.g., 'GK_PROJECT_ROOT')
 * @returns {string}
 */
function getEnvVar(name) {
  if (process.env[name]) return process.env[name];
  const cache = readEnvCache();
  return cache?.[name] || '';
}

/**
 * Bridge Gemini env vars into GK namespace
 * Call at adapter startup to populate GK_* from GEMINI_* equivalents
 */
function bridgeGeminiEnvVars() {
  if (detectCLI() !== 'gemini') return;
  if (!process.env.GK_PROJECT_ROOT && process.env.GEMINI_PROJECT_DIR) {
    process.env.GK_PROJECT_ROOT = process.env.GEMINI_PROJECT_DIR;
  }
  if (!process.env.GK_SESSION_ID && process.env.GEMINI_SESSION_ID) {
    process.env.GK_SESSION_ID = process.env.GEMINI_SESSION_ID;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT FORMATTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format a block response for the target CLI
 * @param {string} reason - Block reason
 * @param {string} [systemMessage] - User-facing message
 */
function formatBlock(reason, systemMessage) {
  return {
    decision: 'block',
    reason: reason || 'Blocked by hook',
    ...(systemMessage && { systemMessage })
  };
}

/**
 * Format an allow response with optional context injection
 * @param {string} [additionalContext] - Text to inject into context
 * @param {string} eventName - Hook event name
 */
function formatAllow(additionalContext, eventName) {
  if (!additionalContext) return {};
  return {
    hookSpecificOutput: {
      hookEventName: eventName || 'BeforeTool',
      additionalContext
    }
  };
}

/**
 * Standard crash wrapper for Gemini adapters
 * @param {string} hookName - Hook identifier for logging
 * @param {Function} fn - Async main function
 */
function runAdapter(hookName, fn) {
  try {
    fn().catch(err => {
      logCrash(hookName, err);
      process.exit(0); // fail-open
    });
  } catch (err) {
    logCrash(hookName, err);
    process.exit(0); // fail-open
  }
}

/** Log crash to .logs/hook-log.jsonl */
function logCrash(hookName, err) {
  try {
    const logDir = path.join(__dirname, '..', '.logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      path.join(logDir, 'hook-log.jsonl'),
      JSON.stringify({
        ts: new Date().toISOString(),
        hook: `gemini/${hookName}`,
        status: 'crash',
        error: err.message
      }) + '\n'
    );
  } catch { /* never crash the crash handler */ }
}

module.exports = {
  detectCLI,
  normalizeToolName,
  convertMatcher,
  GEMINI_TO_CLAUDE,
  CLAUDE_TO_GEMINI,
  writeEnvCache,
  readEnvCache,
  getEnvVar,
  bridgeGeminiEnvVars,
  formatBlock,
  formatAllow,
  runAdapter,
  GEMINI_ENV_CACHE
};
