#!/usr/bin/env node
/**
 * Single test runner for the whole repo (Sprint 13.2). Discovers every
 * `*.test.ts` file (bdos-core, apps/web/architecture, and any future
 * location) and runs each one with `npx tsx`, aggregating pass/fail into
 * one process exit code — so CI, and a human, have exactly one command to
 * know whether the repo is green.
 *
 * This does not reimplement a test framework: every `*.test.ts` file
 * already runs its own assertions at module load time (the `runTest` /
 * `assertEqual` / `assertNoViolations` helpers already used throughout
 * bdos-core and apps/web/architecture) and throws on failure, printing
 * "ok - <name>" per passing assertion. This script only discovers and
 * executes what already exists, one child process per file for isolation.
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", ".turbo", "dist", "build", "coverage"]);
const CONCURRENCY = 4;

// A handful of test files resolve their own source path relative to
// `process.cwd()` (e.g. `resolve(process.cwd(), "src", "domain", ...)`),
// following this repo's existing convention of running each package's
// tests "in place" from within that package, not from the repo root. This
// walks up from the file to the nearest `package.json`, so every test runs
// with the same cwd it would have if invoked by hand from its own package.
function findPackageRoot(filePath) {
  let currentDir = dirname(filePath);

  while (currentDir.startsWith(REPO_ROOT) && currentDir !== REPO_ROOT) {
    if (existsSync(join(currentDir, "package.json"))) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  return REPO_ROOT;
}

function findTestFiles(dir) {
  const files = [];
  let entries;

  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) {
      continue;
    }

    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...findTestFiles(fullPath));
      continue;
    }

    if (entry.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

function runOne(file) {
  return new Promise((resolvePromise) => {
    // Passed as a single pre-quoted command string, not an argv array: with
    // `shell: true` on Windows, spawn's own array-to-command-line quoting
    // does not reliably escape a path containing spaces (this repo's own
    // path does), which silently truncates the file argument at the space.
    // Quoting it ourselves here is the reliable fix, cross-platform.
    const child = spawn(`npx tsx "${file}"`, {
      cwd: findPackageRoot(file),
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("close", (code) => {
      resolvePromise({ file, code: code ?? 1, stdout, stderr });
    });
  });
}

async function runWithConcurrency(files, limit) {
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < files.length) {
      const current = files[nextIndex];
      nextIndex += 1;
      const result = await runOne(current);
      results.push(result);
      const relPath = relative(REPO_ROOT, result.file).split("\\").join("/");
      console.log(`${result.code === 0 ? "PASS" : "FAIL"}  ${relPath}`);
    }
  }

  const workers = Array.from({ length: Math.min(limit, files.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const files = findTestFiles(REPO_ROOT).sort();

  if (files.length === 0) {
    console.error("No *.test.ts files found in the repo — that itself is suspicious, failing.");
    process.exitCode = 1;
    return;
  }

  console.log(`Discovered ${files.length} test file(s). Running with concurrency ${CONCURRENCY}...\n`);

  const startedAt = Date.now();
  const results = await runWithConcurrency(files, CONCURRENCY);
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const failures = results.filter((result) => result.code !== 0);

  console.log(`\n${results.length - failures.length}/${results.length} test file(s) passed in ${elapsedSeconds}s.`);

  if (failures.length > 0) {
    console.log(`\n${failures.length} failing file(s):\n`);

    failures
      .sort((a, b) => a.file.localeCompare(b.file))
      .forEach((failure) => {
        const relPath = relative(REPO_ROOT, failure.file).split("\\").join("/");
        console.log(`--- ${relPath} (exit code ${failure.code}) ---`);
        if (failure.stdout.trim().length > 0) {
          console.log(failure.stdout.trim());
        }
        if (failure.stderr.trim().length > 0) {
          console.log(failure.stderr.trim());
        }
        console.log("");
      });

    process.exitCode = 1;
    return;
  }

  process.exitCode = 0;
}

main();
