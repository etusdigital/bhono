#!/usr/bin/env node
/**
 * Skill Activation Prompt Hook (UserPromptSubmit)
 *
 * Analyzes user prompts and suggests relevant skills based on:
 * - Keywords (exact match, case-insensitive)
 * - Intent patterns (regex-based semantic matching)
 *
 * Features:
 * - Skips short prompts (< 15 chars) to avoid noise
 * - Skips slash commands (already invoking a skill)
 * - Groups suggestions by priority level
 * - Returns structured JSON for Claude Code
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimum prompt length to trigger skill detection
const MIN_PROMPT_LENGTH = 15;

interface HookInput {
  session_id: string;
  transcript_path?: string;
  cwd?: string;
  permission_mode?: string;
  prompt: string;
}

interface PromptTriggers {
  keywords?: string[];
  intentPatterns?: string[];
}

interface ToolGuard {
  tool: string;
  patterns: string[];
}

interface SkillRule {
  type: 'guardrail' | 'domain';
  enforcement: 'block' | 'suggest' | 'warn';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description?: string;
  promptTriggers?: PromptTriggers;
  toolGuards?: ToolGuard[];
}

interface SkillRules {
  version: string;
  skills: Record<string, SkillRule>;
}

interface MatchedSkill {
  name: string;
  matchType: 'keyword' | 'intent';
  config: SkillRule;
}

function shouldSkipPrompt(prompt: string): boolean {
  // Skip very short prompts
  if (prompt.length < MIN_PROMPT_LENGTH) {
    return true;
  }

  // Skip slash commands (user is already invoking a skill)
  if (prompt.trim().startsWith('/')) {
    return true;
  }

  // Skip common non-task prompts
  const skipPatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure)[\s!.]*$/i,
    /^(what|how|why|when|where|who|can you|could you|would you).*\?$/i, // Pure questions without action
  ];

  // Don't skip questions that imply action
  const actionQuestionPatterns = [
    /can you (create|build|make|implement|add|fix|update|deploy)/i,
    /how (do i|to|can i) (create|build|make|implement|add|fix|update|deploy)/i,
  ];

  const isActionQuestion = actionQuestionPatterns.some(p => p.test(prompt));
  if (isActionQuestion) {
    return false;
  }

  return skipPatterns.some(p => p.test(prompt.trim()));
}

function findMatches(prompt: string, rules: SkillRules): MatchedSkill[] {
  const matches: MatchedSkill[] = [];
  const promptLower = prompt.toLowerCase();

  for (const [skillName, config] of Object.entries(rules.skills)) {
    const triggers = config.promptTriggers;
    if (!triggers) {
      continue;
    }

    // Keyword matching (exact, case-insensitive)
    if (triggers.keywords) {
      const keywordMatch = triggers.keywords.some(kw =>
        promptLower.includes(kw.toLowerCase())
      );
      if (keywordMatch) {
        matches.push({ name: skillName, matchType: 'keyword', config });
        continue; // Don't check patterns if keyword matched
      }
    }

    // Intent pattern matching (regex)
    if (triggers.intentPatterns) {
      const intentMatch = triggers.intentPatterns.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(prompt);
        } catch {
          return false;
        }
      });
      if (intentMatch) {
        matches.push({ name: skillName, matchType: 'intent', config });
      }
    }
  }

  return matches;
}

function formatOutput(matches: MatchedSkill[]): string {
  // Group by priority
  const byPriority = {
    critical: matches.filter(s => s.config.priority === 'critical'),
    high: matches.filter(s => s.config.priority === 'high'),
    medium: matches.filter(s => s.config.priority === 'medium'),
    low: matches.filter(s => s.config.priority === 'low'),
  };

  const lines: string[] = ['🎯 SKILL ACTIVATION'];

  if (byPriority.critical.length > 0) {
    lines.push(`⚠️ REQUIRED: ${byPriority.critical.map(s => s.name).join(', ')}`);
  }

  if (byPriority.high.length > 0) {
    lines.push(`📚 RECOMMENDED: ${byPriority.high.map(s => s.name).join(', ')}`);
  }

  if (byPriority.medium.length > 0) {
    lines.push(`💡 SUGGESTED: ${byPriority.medium.map(s => s.name).join(', ')}`);
  }

  if (byPriority.low.length > 0) {
    lines.push(`📌 OPTIONAL: ${byPriority.low.map(s => s.name).join(', ')}`);
  }

  lines.push('→ Use Skill tool BEFORE responding');

  return lines.join('\n');
}

function main() {
  try {
    const input = readFileSync(0, 'utf-8');
    const data: HookInput = JSON.parse(input);
    const prompt = data.prompt;

    // Early exit conditions
    if (shouldSkipPrompt(prompt)) {
      process.exit(0);
    }

    // Load skill rules
    const rulesPath = join(__dirname, '..', 'skills', 'skill-rules.json');
    let rules: SkillRules;

    try {
      rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));
    } catch {
      // Silent exit if rules file not found
      process.exit(0);
    }

    // Find matching skills
    const matches = findMatches(prompt, rules);

    // No matches = no output
    if (matches.length === 0) {
      process.exit(0);
    }

    // Format and output
    const message = formatOutput(matches);

    const output = {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: `<system-reminder>${message}</system-reminder>`
      }
    };

    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (err) {
    // Silent failure - don't break user experience
    process.exit(0);
  }
}

main();
