import fs from "fs";
import path from "path";
import { generateTestsForFile } from "./llm.js";

export function getTestPaths(file) {
  const { dir, name } = path.parse(file);
  const testDir = path.join(dir, "__tests__");
  const importPath = path
    .relative(testDir, file)
    .replace(/\\/g, "/")
    .replace(/\.js$/, "");
  const testFilePath = path.join(testDir, `${name}.test.js`);

  return { testDir, testFilePath, importPath };
}

function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function processFile({
  file,
  workerId,
}) {
  const { testDir, testFilePath, importPath } = getTestPaths(file);
  console.log(`\n[Worker ${workerId}] --- Generating tests for ${file} ---\n`);

  try {
    const tests = await generateTestsForFile(file, importPath);
    if (!tests) {
      console.warn(`[Worker ${workerId}] Empty tests for ${file}, skip.`);
      return;
    }

    ensureDirExists(testDir);
    fs.writeFileSync(testFilePath, tests, "utf-8");
    console.log(`[Worker ${workerId}] Saved tests to ${testFilePath}`);
  } catch (err) {
    console.error(
      `[Worker ${workerId}] Failed to generate for ${file}:`,
      err
    );
  }
}

export async function runWorkers({
  files,
  concurrency,
}) {
  const CONCURRENCY = Math.min(concurrency, files.length || 1);
  let index = 0;

  async function worker(workerId) {
    // 简单的并发 worker，实现多文件并行提测
    while (true) {
      const currentIndex = index;
      if (currentIndex >= files.length) return;
      index += 1;

      const file = files[currentIndex];
      await processFile({
        file,
        workerId,
      });
    }
  }

  await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1))
  );
}

