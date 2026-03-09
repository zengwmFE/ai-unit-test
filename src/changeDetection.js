import fs from "fs";
import path from "path";
import { execSync } from "node:child_process";
import { getTestPaths } from "./generator.js";

function runGit(projectDir, args) {
  const cmd = ["git", "-C", projectDir, ...args].join(" ");
  return execSync(cmd, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

function splitLines(s) {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function isGitRepo(projectDir) {
  try {
    const out = runGit(projectDir, ["rev-parse", "--is-inside-work-tree"]).trim();
    return out === "true";
  } catch {
    return false;
  }
}

export function getGitChangedFiles({
  projectDir,
  baseRef = "origin/main",
  headRef = "HEAD",
}) {
  // 返回相对于 projectDir 的路径（posix），再由调用方转绝对路径
  const changed = new Set();

  // 1) 提交范围内的变更
  try {
    const rangeOut = runGit(projectDir, [
      "diff",
      "--name-only",
      "--diff-filter=AMR",
      `${baseRef}...${headRef}`,
    ]);
    splitLines(rangeOut).forEach((p) => changed.add(p));
  } catch {
    // baseRef 不存在等情况，直接忽略范围 diff，后面仍会合并工作区变更
  }

  // 2) 工作区未暂存变更
  try {
    const out = runGit(projectDir, ["diff", "--name-only", "--diff-filter=AMR"]);
    splitLines(out).forEach((p) => changed.add(p));
  } catch {}

  // 3) 暂存区变更
  try {
    const out = runGit(projectDir, [
      "diff",
      "--name-only",
      "--diff-filter=AMR",
      "--cached",
    ]);
    splitLines(out).forEach((p) => changed.add(p));
  } catch {}

  // 4) 未跟踪的新文件
  try {
    const out = runGit(projectDir, ["ls-files", "--others", "--exclude-standard"]);
    splitLines(out).forEach((p) => changed.add(p));
  } catch {}

  return changed;
}

export function filterFilesByMissingTests(files) {
  return files.filter((file) => {
    const { testFilePath } = getTestPaths(file);
    return !fs.existsSync(testFilePath);
  });
}

export function filterFilesByMtime(files) {
  return files.filter((file) => {
    const { testFilePath } = getTestPaths(file);
    if (!fs.existsSync(testFilePath)) return true;
    try {
      const srcMtime = fs.statSync(file).mtimeMs;
      const testMtime = fs.statSync(testFilePath).mtimeMs;
      return srcMtime > testMtime;
    } catch {
      return true;
    }
  });
}

export function filterFilesByGitChanges({
  files,
  projectDir,
  baseRef,
  headRef,
}) {
  const changedRel = getGitChangedFiles({ projectDir, baseRef, headRef });
  const changedAbs = new Set(
    Array.from(changedRel).map((rel) =>
      path.resolve(projectDir, rel).replace(/\\/g, "/")
    )
  );

  return files.filter((abs) => changedAbs.has(abs.replace(/\\/g, "/")));
}

