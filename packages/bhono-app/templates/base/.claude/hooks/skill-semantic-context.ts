#!/usr/bin/env node
/**
 * Skill Semantic Context Hook
 *
 * Analyzes user prompts for implicit skill needs using intentPatterns
 * defined in skill-rules.json. Returns a single suggestion line or nothing.
 *
 * All patterns come from skill-rules.json - nothing hardcoded.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface HookInput {
  session_id: string;
  prompt: string;
}

interface PromptTriggers {
  keywords?: string[];
  intentPatterns?: string[];
}

interface SkillRule {
  type: string;
  enforcement: string;
  priority: string;
  description: string;
  promptTriggers?: PromptTriggers;
}

interface SkillRules {
  version: string;
  skills: Record<string, SkillRule>;
}

function findSemanticMatches(prompt: string, rules: SkillRules): string[] {
  const matches: string[] = [];

  for (const [skillName, config] of Object.entries(rules.skills)) {
    const patterns = config.promptTriggers?.intentPatterns;
    if (!patterns || patterns.length === 0) {
      continue;
    }

    // Check if any intentPattern matches
    const matched = patterns.some(pattern => {
      try {
        const regex = new RegExp(pattern, 'i');
        return regex.test(prompt);
      } catch {
        return false;
      }
    });

    if (matched) {
      matches.push(skillName);
    }
  }

  return matches;
}

function main() {
  try {
    const input = readFileSync(0, 'utf-8');
    const data: HookInput = JSON.parse(input);
    const userPrompt = data.prompt;

    // Skip short prompts or slash commands
    if (userPrompt.length < 15 || userPrompt.startsWith('/')) {
      process.exit(0);
    }

    // Load skill rules
    const rulesPath = join(__dirname, '..', 'skills', 'skill-rules.json');
    let rules: SkillRules;

    try {
      rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));
    } catch {
      process.exit(0);
    }

    // Find semantic matches
    const matches = findSemanticMatches(userPrompt, rules);

    // No matches = no output
    if (matches.length === 0) {
      process.exit(0);
    }

    // Build concise suggestion
    const skillList = matches.join(', ');
    const suggestion = `🧠 Semantic match: consider using ${skillList}`;

    const output = {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: suggestion
      }
    };

    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
