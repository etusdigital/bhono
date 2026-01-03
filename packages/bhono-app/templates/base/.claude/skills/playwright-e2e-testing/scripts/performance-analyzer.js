#!/usr/bin/env node

/**
 * performance-analyzer.js
 *
 * Analyze Playwright Test run duration and identify slow tests/files.
 *
 * Supports:
 * - Playwright JSON reporter output (recommended)
 *
 * Usage:
 *   # Generate JSON results
 *   PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json npx playwright test --reporter=json
 *
 *   # Analyze
 *   node scripts/performance-analyzer.js
 *   node scripts/performance-analyzer.js --report-path ./test-results/results.json --threshold 5000
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  reportPath: './test-results/results.json',
  threshold: 5000, // ms
  outputPath: './test-results/performance-report.json',
};

function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--report-path' && i + 1 < args.length) config.reportPath = args[++i];
    else if (arg === '--threshold' && i + 1 < args.length) config.threshold = parseInt(args[++i], 10);
    else if (arg === '--output' && i + 1 < args.length) config.outputPath = args[++i];
    else if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
Playwright Performance Analyzer

Defaults:
  --report-path ${DEFAULT_CONFIG.reportPath}
  --threshold   ${DEFAULT_CONFIG.threshold} (ms)
  --output      ${DEFAULT_CONFIG.outputPath}

Examples:
  node scripts/performance-analyzer.js
  node scripts/performance-analyzer.js --threshold 3000
  node scripts/performance-analyzer.js --report-path ./custom-results.json
`);
}

function readJson(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Report file not found: ${abs}`);
  }
  return JSON.parse(fs.readFileSync(abs, 'utf-8'));
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

/**
 * Extract test cases from Playwright JSON reporter output.
 * We keep this defensive because JSON schema can evolve.
 */
function extractTests(json) {
  const out = [];

  const suites = Array.isArray(json?.suites) ? json.suites : [];
  for (const suite of suites) walkSuite(suite, out, []);

  return out;

  function walkSuite(suiteNode, acc, titlePath) {
    const nextPath = appendIfTruthy(titlePath, suiteNode?.title);
    const file = suiteNode?.file;

    const specs = Array.isArray(suiteNode?.specs) ? suiteNode.specs : [];
    for (const spec of specs) {
      const specPath = appendIfTruthy(nextPath, spec?.title);
      const tests = Array.isArray(spec?.tests) ? spec.tests : [];
      for (const t of tests) {
        const results = Array.isArray(t?.results) ? t.results : [];
        const last = results.length ? results[results.length - 1] : null;

        const duration = last?.duration ?? t?.duration ?? 0;
        const status = last?.status ?? t?.status ?? 'unknown';
        const projectName = t?.projectName ?? last?.projectName ?? '';

        acc.push({
          title: appendIfTruthy(specPath, t?.title).join(' › '),
          file: file || spec?.file || '',
          project: projectName,
          status,
          duration,
          retries: results.length ? results.length - 1 : 0,
        });
      }
    }

    const childSuites = Array.isArray(suiteNode?.suites) ? suiteNode.suites : [];
    for (const child of childSuites) walkSuite(child, acc, nextPath);
  }

  function appendIfTruthy(pathArr, v) {
    if (typeof v === 'string' && v.trim()) return [...pathArr, v.trim()];
    return [...pathArr];
  }
}

function analyzeTests(tests, threshold) {
  const totalDuration = tests.reduce((sum, t) => sum + (t.duration || 0), 0);

  const durations = tests.map(t => t.duration || 0).filter(d => d > 0).sort((a, b) => a - b);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0;

  const slowTests = tests
    .filter(t => (t.duration || 0) > threshold)
    .sort((a, b) => (b.duration || 0) - (a.duration || 0))
    .slice(0, 50);

  const byFile = new Map();
  for (const t of tests) {
    const k = t.file || '(unknown)';
    const v = byFile.get(k) || { file: k, count: 0, duration: 0, slowCount: 0 };
    v.count += 1;
    v.duration += t.duration || 0;
    if ((t.duration || 0) > threshold) v.slowCount += 1;
    byFile.set(k, v);
  }

  const slowFiles = Array.from(byFile.values())
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 30);

  return {
    summary: {
      tests: tests.length,
      totalDurationMs: totalDuration,
      totalDuration: formatDuration(totalDuration),
      averageDurationMs: Math.round(avg),
      averageDuration: formatDuration(Math.round(avg)),
      medianDurationMs: median,
      medianDuration: formatDuration(median),
      slowThresholdMs: threshold,
      slowTestsCount: slowTests.length,
    },
    slowTests,
    slowFiles,
    recommendations: buildRecommendations(slowTests, slowFiles),
  };
}

function buildRecommendations(slowTests, slowFiles) {
  const recs = [];

  if (slowTests.length) {
    recs.push('Reduce slow tests by using API setup (APIRequestContext) instead of repeating UI setup flows.');
    recs.push('Prefer storageState for authenticated journeys; avoid logging in via UI in every test.');
    recs.push('Move stable common setup into fixtures; keep assertions user-visible and minimal.');
  }

  if (slowFiles.length) {
    recs.push('Split oversized spec files into smaller, focused specs to improve parallelism.');
  }

  recs.push('Use trace: on-first-retry and open traces to find the true wait bottleneck (network vs main thread vs selector).');
  recs.push('If CI is slow: shard + blob reports + merge-reports for a single HTML report.');

  return recs;
}

function printConsoleReport(analysis) {
  console.log('\nPlaywright Performance Summary');
  console.log('--------------------------------');
  console.log(`Total tests:         ${analysis.summary.tests}`);
  console.log(`Total duration:      ${analysis.summary.totalDuration}`);
  console.log(`Average duration:    ${analysis.summary.averageDuration}`);
  console.log(`Median duration:     ${analysis.summary.medianDuration}`);
  console.log(`Slow threshold:      ${analysis.summary.slowThresholdMs}ms`);
  console.log(`Slow tests (top 50): ${analysis.summary.slowTestsCount}`);

  if (analysis.slowTests.length) {
    console.log('\nSlowest Tests');
    console.log('----------------');
    for (const t of analysis.slowTests.slice(0, 10)) {
      const where = t.project ? ` [${t.project}]` : '';
      console.log(`${formatDuration(t.duration)}${where}  ${t.title}`);
    }
  }

  console.log('\nRecommendations');
  console.log('------------------');
  analysis.recommendations.forEach((r, idx) => console.log(`${idx + 1}. ${r}`));
}

async function main() {
  const cfg = parseArgs();

  const json = readJson(cfg.reportPath);
  const tests = extractTests(json);

  if (!tests.length) {
    console.error('No tests found in report. Make sure you are using the Playwright JSON reporter output.');
    process.exit(2);
  }

  const analysis = analyzeTests(tests, cfg.threshold);

  // Write JSON output
  const outPath = path.resolve(cfg.outputPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(analysis, null, 2));

  // Print console summary
  printConsoleReport(analysis);

  console.log(`\nJSON report written to: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
