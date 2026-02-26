#!/usr/bin/env node
/**
 * Gemini CLI Adapter: SessionStart → session-init
 *
 * Runs project detection via shared libs and writes env cache
 * (since Gemini lacks CLAUDE_ENV_FILE). Outputs context via additionalContext.
 *
 * Event: SessionStart | Matcher: startup
 */

const { runAdapter, writeEnvCache, bridgeGeminiEnvVars, formatAllow } = require('./lib/cli-adapter.cjs');
const { isHookEnabled } = require('./lib/gk-config-utils.cjs');

runAdapter('session-init', async () => {
  if (!isHookEnabled('session-init')) process.exit(0);

  const fs = require('fs');
  const path = require('path');
  const {
    loadConfig,
    resolvePlanPath,
    getReportsPath,
    resolveNamingPattern
  } = require('./lib/gk-config-utils.cjs');
  const {
    detectProjectType,
    detectPackageManager,
    detectFramework,
    getGitBranch,
    getGitRoot,
    buildContextOutput
  } = require('./lib/project-detector.cjs');

  bridgeGeminiEnvVars();

  const stdin = fs.readFileSync(0, 'utf-8').trim();
  const data = stdin ? JSON.parse(stdin) : {};
  const source = data.source || 'unknown';

  const config = loadConfig();
  const baseDir = process.env.GEMINI_PROJECT_DIR || process.cwd();

  const detections = {
    type: detectProjectType(config.project?.type),
    pm: detectPackageManager(config.project?.packageManager),
    framework: detectFramework(config.project?.framework)
  };

  const resolved = resolvePlanPath(null, config);
  const reportsPath = getReportsPath(resolved.path, resolved.resolvedBy, config.plan, config.paths);
  const gitBranch = getGitBranch();
  const gitRoot = getGitRoot();
  const namePattern = resolveNamingPattern(config.plan, gitBranch);

  // Write env cache (Gemini equivalent of CLAUDE_ENV_FILE writes)
  writeEnvCache({
    GK_PROJECT_TYPE: detections.type || '',
    GK_PACKAGE_MANAGER: detections.pm || '',
    GK_FRAMEWORK: detections.framework || '',
    GK_REPORTS_PATH: path.join(baseDir, reportsPath),
    GK_PLANS_PATH: path.join(baseDir, config.paths?.plans || 'plans'),
    GK_DOCS_PATH: path.join(baseDir, config.paths?.docs || 'docs'),
    GK_PROJECT_ROOT: baseDir,
    GK_GIT_ROOT: gitRoot || '',
    GK_GIT_BRANCH: gitBranch || '',
    GK_NAME_PATTERN: namePattern,
    GK_ACTIVE_PLAN: resolved.resolvedBy === 'session' ? resolved.path : '',
    GK_SUGGESTED_PLAN: resolved.resolvedBy === 'branch' ? resolved.path : '',
    GK_SESSION_ID: process.env.GEMINI_SESSION_ID || '',
    GK_OS_PLATFORM: process.platform,
    GK_TIMEZONE: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const contextMsg = `Session ${source}. ${buildContextOutput(config, detections, resolved, gitRoot)}`;

  // Output context injection for Gemini
  const output = formatAllow(contextMsg, 'SessionStart');
  console.log(JSON.stringify(output));
  process.exit(0);
});
