#!/usr/bin/env node
'use strict';

// Config Counter - Count GEMINI.md, rules, MCPs, hooks across user and project scopes

const fs = require('fs');
const path = require('path');
const os = require('os');

function getMcpServerNames(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    if (config.mcpServers && typeof config.mcpServers === 'object') {
      return new Set(Object.keys(config.mcpServers));
    }
  } catch {
    // Silent fail
  }
  return new Set();
}

function countMcpServersInFile(filePath, excludeFrom) {
  const servers = getMcpServerNames(filePath);
  if (excludeFrom) {
    const exclude = getMcpServerNames(excludeFrom);
    for (const name of exclude) {
      servers.delete(name);
    }
  }
  return servers.size;
}

function countHooksInFile(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    if (config.hooks && typeof config.hooks === 'object') {
      return Object.keys(config.hooks).length;
    }
  } catch {
    // Silent fail
  }
  return 0;
}

function countRulesInDir(rulesDir, depth = 0) {
  // Depth limit prevents symlink loops and excessive recursion
  if (depth > 5 || !fs.existsSync(rulesDir)) return 0;
  let count = 0;
  try {
    const entries = fs.readdirSync(rulesDir, { withFileTypes: true });
    for (const entry of entries) {
      // Skip symlinks to prevent loops
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(rulesDir, entry.name);
      if (entry.isDirectory()) {
        count += countRulesInDir(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        count++;
      }
    }
  } catch {
    // Silent fail
  }
  return count;
}

function countConfigs(cwd) {
  let geminiMdCount = 0, rulesCount = 0, mcpCount = 0, hooksCount = 0;
  const homeDir = os.homedir();
  const geminiDir = path.join(homeDir, '.gemini');

  // User scope
  if (fs.existsSync(path.join(geminiDir, 'GEMINI.md'))) geminiMdCount++;
  rulesCount += countRulesInDir(path.join(geminiDir, 'rules'));
  const userSettings = path.join(geminiDir, 'settings.json');
  mcpCount += countMcpServersInFile(userSettings);
  hooksCount += countHooksInFile(userSettings);
  mcpCount += countMcpServersInFile(path.join(homeDir, '.gemini.json'), userSettings);

  // Project scope
  if (cwd) {
    if (fs.existsSync(path.join(cwd, 'GEMINI.md'))) geminiMdCount++;
    if (fs.existsSync(path.join(cwd, 'GEMINI.local.md'))) geminiMdCount++;
    if (fs.existsSync(path.join(cwd, '.gemini', 'GEMINI.md'))) geminiMdCount++;
    if (fs.existsSync(path.join(cwd, '.gemini', 'GEMINI.local.md'))) geminiMdCount++;
    rulesCount += countRulesInDir(path.join(cwd, '.gemini', 'rules'));
    mcpCount += countMcpServersInFile(path.join(cwd, '.mcp.json'));
    const projectSettings = path.join(cwd, '.gemini', 'settings.json');
    mcpCount += countMcpServersInFile(projectSettings);
    hooksCount += countHooksInFile(projectSettings);
    const localSettings = path.join(cwd, '.gemini', 'settings.local.json');
    mcpCount += countMcpServersInFile(localSettings);
    hooksCount += countHooksInFile(localSettings);
  }

  return { geminiMdCount, rulesCount, mcpCount, hooksCount };
}

module.exports = { countConfigs, getMcpServerNames, countMcpServersInFile, countHooksInFile, countRulesInDir };
