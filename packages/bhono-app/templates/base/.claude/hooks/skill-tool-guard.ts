#!/usr/bin/env node
/**
 * Skill Tool Guard Hook (PreToolUse)
 *
 * Recommends or blocks tool usage based on skill rules.
 * Reads toolGuards from skill-rules.json to determine which
 * skills should be used before specific tool patterns.
 *
 * Supported tools:
 * - Bash: checks command content
 * - Edit/Write: checks file_path
 * - Read: checks file_path
 * - Glob/Grep: checks pattern/path
 * - Task: checks prompt
 * - WebFetch: checks url
 * - All others: checks JSON stringified input
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PreToolUseInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
}

interface ToolGuard {
  tool: string;
  patterns: string[];
}

interface SkillRule {
  type: string;
  enforcement: 'suggest' | 'warn' | 'block';
  priority: string;
  description?: string;
  toolGuards?: ToolGuard[];
}

interface SkillRules {
  version: string;
  skills: Record<string, SkillRule>;
}

interface MatchedGuard {
  skillName: string;
  enforcement: string;
  description?: string;
}

/**
 * Extract the content to check based on tool type
 */
function getContentToCheck(toolName: string, toolInput: Record<string, unknown>): string {
  switch (toolName) {
    case 'Bash':
      return String(toolInput.command || '');

    case 'Edit':
    case 'Write':
    case 'Read':
      return String(toolInput.file_path || '');

    case 'Glob':
      return String(toolInput.pattern || '') + ' ' + String(toolInput.path || '');

    case 'Grep':
      return String(toolInput.pattern || '') + ' ' + String(toolInput.path || '');

    case 'Task':
      return String(toolInput.prompt || '') + ' ' + String(toolInput.description || '');

    case 'WebFetch':
      return String(toolInput.url || '');

    case 'WebSearch':
      return String(toolInput.query || '');

    default:
      // For unknown tools, stringify the entire input
      return JSON.stringify(toolInput);
  }
}

/**
 * Check if a pattern matches the content
 */
function matchesPattern(content: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(content);
  } catch {
    // If regex fails, try simple includes
    return content.toLowerCase().includes(pattern.toLowerCase());
  }
}

function main() {
  try {
    const input = readFileSync(0, 'utf-8');
    const data: PreToolUseInput = JSON.parse(input);

    // Load skill rules
    const rulesPath = join(__dirname, '..', 'skills', 'skill-rules.json');
    let rules: SkillRules;

    try {
      rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));
    } catch {
      process.exit(0);
    }

    const contentToCheck = getContentToCheck(data.tool_name, data.tool_input);
    const matchedGuards: MatchedGuard[] = [];

    // Check each skill's toolGuards
    for (const [skillName, config] of Object.entries(rules.skills)) {
      const guards = config.toolGuards;
      if (!guards || guards.length === 0) {
        continue;
      }

      for (const guard of guards) {
        // Check if tool matches (exact match or wildcard)
        if (guard.tool !== data.tool_name && guard.tool !== '*') {
          continue;
        }

        // Check if any pattern matches
        const matched = guard.patterns.some(pattern =>
          matchesPattern(contentToCheck, pattern)
        );

        if (matched) {
          matchedGuards.push({
            skillName,
            enforcement: config.enforcement,
            description: config.description
          });
          break; // Only match once per skill
        }
      }
    }

    // No matches = no output
    if (matchedGuards.length === 0) {
      process.exit(0);
    }

    // Group by enforcement level
    const critical = matchedGuards.filter(g => g.enforcement === 'block');
    const warnings = matchedGuards.filter(g => g.enforcement === 'warn');
    const suggestions = matchedGuards.filter(g => g.enforcement === 'suggest');

    // Build message
    const lines: string[] = [`⚡ TOOL GUARD (${data.tool_name})`];

    if (critical.length > 0) {
      lines.push(`🚫 BLOCKED: ${critical.map(g => g.skillName).join(', ')}`);
    }

    if (warnings.length > 0) {
      lines.push(`⚠️ WARNING: ${warnings.map(g => g.skillName).join(', ')}`);
    }

    if (suggestions.length > 0) {
      lines.push(`💡 CONSIDER: ${suggestions.map(g => g.skillName).join(', ')}`);
    }

    lines.push('→ Use relevant skill before proceeding');

    const message = lines.join('\n');

    // Determine permission decision based on enforcement
    // For now, only 'suggest' - block/warn not implemented yet
    const permissionDecision = critical.length > 0 ? 'block' : 'allow';

    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision,
        additionalContext: `<system-reminder>${message}</system-reminder>`
      }
    };

    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (err) {
    // Silent failure - don't break tool execution
    process.exit(0);
  }
}

main();
