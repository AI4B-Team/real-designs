#!/usr/bin/env node
/**
 * Lint gate with a temporary baseline.
 *
 * Formatting is NOT handled here — Prettier owns it (`npm run format:check`).
 * This script only looks at meaningful ESLint violations.
 *
 * - `node scripts/lint-baseline.mjs` fails when any file has more violations
 *   than the recorded baseline in `.lint-baseline.json` (so touched files can
 *   never add new violations), and also fails on any file missing from it.
 * - `node scripts/lint-baseline.mjs --update` rewrites the baseline.
 *
 * Once the baseline reaches zero entries, drop this script and make
 * `eslint .` itself the blocking CI step.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { relative } from "node:path";

const BASELINE = ".lint-baseline.json";
const update = process.argv.includes("--update");

let raw = "";
try {
  raw = execFileSync("npx", ["eslint", ".", "-f", "json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  raw = err.stdout ?? "";
  if (!raw) {
    console.error(err.stderr || err.message);
    process.exit(2);
  }
}

const results = JSON.parse(raw);
const current = {};
let totalErrors = 0;
let totalWarnings = 0;

for (const file of results) {
  totalErrors += file.errorCount;
  totalWarnings += file.warningCount;
  if (file.errorCount > 0) current[relative(process.cwd(), file.filePath)] = file.errorCount;
}

if (update) {
  writeFileSync(BASELINE, JSON.stringify(current, Object.keys(current).sort(), 2) + "\n");
  console.log(`Baseline updated: ${Object.keys(current).length} files, ${totalErrors} errors.`);
  process.exit(0);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
const regressions = [];
for (const [file, count] of Object.entries(current)) {
  const allowed = baseline[file] ?? 0;
  if (count > allowed) regressions.push(`${file}: ${count} errors (baseline ${allowed})`);
}
const improved = Object.entries(baseline).filter(([f, c]) => (current[f] ?? 0) < c).length;

console.log(
  `ESLint: ${totalErrors} errors, ${totalWarnings} warnings across ${results.length} files.`,
);
console.log(`Baseline files: ${Object.keys(baseline).length}. Improved since baseline: ${improved}.`);

if (regressions.length) {
  console.error("\nNew lint violations (not allowed):");
  for (const r of regressions) console.error(`  ${r}`);
  console.error("\nFix them, or run `npm run lint:baseline:update` if the change is intentional.");
  process.exit(1);
}
console.log("No new lint violations.");
