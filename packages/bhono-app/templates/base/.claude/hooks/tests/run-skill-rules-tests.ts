#!/usr/bin/env npx tsx
/**
 * Automated test runner for skill-rules.json validation
 * Tests both promptTriggers and toolGuards against defined test cases
 *
 * Usage: npx tsx .claude/hooks/tests/run-skill-rules-tests.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestCases {
  version: string;
  promptTriggers: Record<string, { shouldMatch: string[]; shouldNotMatch: string[] }>;
  toolGuards: Record<string, Record<string, { shouldMatch: string[]; shouldNotMatch: string[] }>>;
  commandTests?: {
    description: string;
    commands: Record<string, { expectedSkills: string[]; reason: string }>;
  };
  realWorldPrompts?: {
    description: string;
    scenarios: Array<{ prompt: string; expectedSkills: string[]; reason: string }>;
  };
}

interface SkillRules {
  version: string;
  skills: Record<string, {
    promptTriggers?: {
      keywords?: string[];
      intentPatterns?: string[];
    };
    toolGuards?: Array<{
      tool: string;
      patterns: string[];
    }>;
  }>;
}

interface TestResult {
  skill: string;
  type: 'promptTrigger' | 'toolGuard' | 'command' | 'realWorld';
  tool?: string;
  testCase: string;
  expected: 'match' | 'no-match' | string[];
  actual: 'match' | 'no-match' | string[];
  passed: boolean;
  matchedBy?: string;
  reason?: string;
}

// Load files
const testsDir = __dirname;
const hooksDir = path.dirname(testsDir);
const claudeDir = path.dirname(hooksDir);
const skillsDir = path.join(claudeDir, 'skills');

const testCasesPath = path.join(testsDir, 'skill-rules-test-cases.json');
const skillRulesPath = path.join(skillsDir, 'skill-rules.json');

const testCases: TestCases = JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'));
const skillRules: SkillRules = JSON.parse(fs.readFileSync(skillRulesPath, 'utf-8'));

// Test prompt triggers
function testPromptTrigger(prompt: string, skill: SkillRules['skills'][string]): { matches: boolean; matchedBy?: string } {
  const triggers = skill.promptTriggers;
  if (!triggers) return { matches: false };

  const promptLower = prompt.toLowerCase();

  // Check keywords (case-insensitive substring match)
  if (triggers.keywords) {
    for (const keyword of triggers.keywords) {
      if (promptLower.includes(keyword.toLowerCase())) {
        return { matches: true, matchedBy: `keyword: "${keyword}"` };
      }
    }
  }

  // Check intent patterns (regex)
  if (triggers.intentPatterns) {
    for (const pattern of triggers.intentPatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(prompt)) {
          return { matches: true, matchedBy: `pattern: "${pattern}"` };
        }
      } catch (e) {
        console.error(`Invalid regex pattern: ${pattern}`);
      }
    }
  }

  return { matches: false };
}

// Test tool guards
function testToolGuard(tool: string, input: string, skill: SkillRules['skills'][string]): { matches: boolean; matchedBy?: string } {
  const guards = skill.toolGuards;
  if (!guards) return { matches: false };

  for (const guard of guards) {
    if (guard.tool !== tool && guard.tool !== '*') continue;

    for (const pattern of guard.patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(input)) {
          return { matches: true, matchedBy: `pattern: "${pattern}"` };
        }
      } catch (e) {
        console.error(`Invalid regex pattern: ${pattern}`);
      }
    }
  }

  return { matches: false };
}

// Find all skills that match a given prompt
function findMatchingSkills(prompt: string): string[] {
  const matchingSkills: string[] = [];

  for (const [skillName, skill] of Object.entries(skillRules.skills)) {
    const { matches } = testPromptTrigger(prompt, skill);
    if (matches) {
      matchingSkills.push(skillName);
    }
  }

  return matchingSkills;
}

// Run all tests
const results: TestResult[] = [];

console.log('═══════════════════════════════════════════════════════════════');
console.log('         SKILL RULES TEST RUNNER v2.0');
console.log('═══════════════════════════════════════════════════════════════\n');

// Test promptTriggers
console.log('📝 Testing promptTriggers...\n');

for (const [skillName, cases] of Object.entries(testCases.promptTriggers)) {
  const skill = skillRules.skills[skillName];
  if (!skill) {
    console.log(`⚠️  Skill not found in rules: ${skillName}`);
    continue;
  }

  // Test shouldMatch cases
  for (const testCase of cases.shouldMatch) {
    const { matches, matchedBy } = testPromptTrigger(testCase, skill);
    results.push({
      skill: skillName,
      type: 'promptTrigger',
      testCase,
      expected: 'match',
      actual: matches ? 'match' : 'no-match',
      passed: matches,
      matchedBy,
    });
  }

  // Test shouldNotMatch cases
  for (const testCase of cases.shouldNotMatch) {
    const { matches, matchedBy } = testPromptTrigger(testCase, skill);
    results.push({
      skill: skillName,
      type: 'promptTrigger',
      testCase,
      expected: 'no-match',
      actual: matches ? 'match' : 'no-match',
      passed: !matches,
      matchedBy,
    });
  }
}

// Test toolGuards
console.log('🛡️  Testing toolGuards...\n');

for (const [skillName, tools] of Object.entries(testCases.toolGuards)) {
  const skill = skillRules.skills[skillName];
  if (!skill) {
    console.log(`⚠️  Skill not found in rules: ${skillName}`);
    continue;
  }

  for (const [toolName, cases] of Object.entries(tools)) {
    // Test shouldMatch cases
    for (const testCase of cases.shouldMatch) {
      const { matches, matchedBy } = testToolGuard(toolName, testCase, skill);
      results.push({
        skill: skillName,
        type: 'toolGuard',
        tool: toolName,
        testCase,
        expected: 'match',
        actual: matches ? 'match' : 'no-match',
        passed: matches,
        matchedBy,
      });
    }

    // Test shouldNotMatch cases
    for (const testCase of cases.shouldNotMatch) {
      const { matches, matchedBy } = testToolGuard(toolName, testCase, skill);
      results.push({
        skill: skillName,
        type: 'toolGuard',
        tool: toolName,
        testCase,
        expected: 'no-match',
        actual: matches ? 'match' : 'no-match',
        passed: !matches,
        matchedBy,
      });
    }
  }
}

// Test commandTests
if (testCases.commandTests) {
  console.log('🎯 Testing commandTests...\n');

  for (const [command, testCase] of Object.entries(testCases.commandTests.commands)) {
    const matchingSkills = findMatchingSkills(command);
    const expectedSkills = testCase.expectedSkills;

    // Check if all expected skills are matched (order doesn't matter)
    const allExpectedMatched = expectedSkills.every(s => matchingSkills.includes(s));
    // Check if no unexpected skills matched
    const noUnexpectedMatched = matchingSkills.every(s => expectedSkills.includes(s));
    const passed = allExpectedMatched && noUnexpectedMatched;

    results.push({
      skill: command,
      type: 'command',
      testCase: command,
      expected: expectedSkills,
      actual: matchingSkills,
      passed,
      reason: testCase.reason,
    });
  }
}

// Test realWorldPrompts
if (testCases.realWorldPrompts) {
  console.log('🌍 Testing realWorldPrompts...\n');

  for (const scenario of testCases.realWorldPrompts.scenarios) {
    const matchingSkills = findMatchingSkills(scenario.prompt);
    const expectedSkills = scenario.expectedSkills;

    // Check if all expected skills are matched
    const allExpectedMatched = expectedSkills.every(s => matchingSkills.includes(s));
    // Allow additional skills (real prompts may trigger multiple skills)
    const passed = allExpectedMatched;

    results.push({
      skill: scenario.prompt.substring(0, 50) + (scenario.prompt.length > 50 ? '...' : ''),
      type: 'realWorld',
      testCase: scenario.prompt,
      expected: expectedSkills,
      actual: matchingSkills,
      passed,
      reason: scenario.reason,
    });
  }
}

// Print results
const passed = results.filter(r => r.passed);
const failed = results.filter(r => !r.passed);

console.log('═══════════════════════════════════════════════════════════════');
console.log('                       RESULTS');
console.log('═══════════════════════════════════════════════════════════════\n');

// Group by skill
const skillResults = new Map<string, { passed: number; failed: number }>();
for (const result of results) {
  const current = skillResults.get(result.skill) || { passed: 0, failed: 0 };
  if (result.passed) current.passed++;
  else current.failed++;
  skillResults.set(result.skill, current);
}

console.log('Results by skill:');
console.log('─────────────────────────────────────────────────────────────');

for (const [skill, counts] of skillResults.entries()) {
  const total = counts.passed + counts.failed;
  const status = counts.failed === 0 ? '✅' : '❌';
  console.log(`${status} ${skill}: ${counts.passed}/${total} passed`);
}

console.log('\n─────────────────────────────────────────────────────────────');

// Print failures in detail
if (failed.length > 0) {
  console.log('\n❌ FAILED TESTS:\n');

  for (const result of failed) {
    console.log(`Skill: ${result.skill}`);
    console.log(`  Type: ${result.type}${result.tool ? ` (${result.tool})` : ''}`);
    console.log(`  Test: "${result.testCase}"`);
    if (Array.isArray(result.expected)) {
      console.log(`  Expected skills: [${result.expected.join(', ')}]`);
      console.log(`  Actual skills: [${(result.actual as string[]).join(', ')}]`);
    } else {
      console.log(`  Expected: ${result.expected}, Got: ${result.actual}`);
    }
    if (result.matchedBy) {
      console.log(`  Matched by: ${result.matchedBy}`);
    }
    if (result.reason) {
      console.log(`  Reason: ${result.reason}`);
    }
    console.log('');
  }
}

// Summary
console.log('═══════════════════════════════════════════════════════════════');
console.log('                       SUMMARY');
console.log('═══════════════════════════════════════════════════════════════\n');

const promptTriggerResults = results.filter(r => r.type === 'promptTrigger');
const toolGuardResults = results.filter(r => r.type === 'toolGuard');
const commandResults = results.filter(r => r.type === 'command');
const realWorldResults = results.filter(r => r.type === 'realWorld');

console.log(`📝 promptTriggers: ${promptTriggerResults.filter(r => r.passed).length}/${promptTriggerResults.length} passed`);
console.log(`🛡️  toolGuards: ${toolGuardResults.filter(r => r.passed).length}/${toolGuardResults.length} passed`);
if (commandResults.length > 0) {
  console.log(`🎯 commandTests: ${commandResults.filter(r => r.passed).length}/${commandResults.length} passed`);
}
if (realWorldResults.length > 0) {
  console.log(`🌍 realWorldPrompts: ${realWorldResults.filter(r => r.passed).length}/${realWorldResults.length} passed`);
}
console.log(`\n📊 Total: ${passed.length}/${results.length} passed (${((passed.length / results.length) * 100).toFixed(1)}%)`);

if (failed.length === 0) {
  console.log('\n✅ All tests passed!\n');
  process.exit(0);
} else {
  console.log(`\n❌ ${failed.length} test(s) failed\n`);
  process.exit(1);
}
