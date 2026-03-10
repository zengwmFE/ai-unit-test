import fs from "fs";
import path from "path";
import { getTestPaths } from "./generator.js";
import { gitChangedFilesTool, gitIsRepoTool } from "./gitTools.js";

export async function isGitRepo(projectDir) {
  const res = await gitIsRepoTool.invoke({ projectDir: projectDir });
  try {
    const parsed = JSON.parse(res || "{}");
    return !!parsed.isRepo;
  } catch {
    return false;
  }
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

export async function filterFilesByGitChanges({
  files,
  projectDir,
  baseRef,
  headRef,
}) {
  const res = await gitChangedFilesTool.invoke({ projectDir, baseRef, headRef });
  const { files: changedRel = [] } = JSON.parse(res || "{}");

  const changedAbs = new Set(
    Array.from(changedRel).map((rel) =>
      path.resolve(projectDir, rel).replace(/\\/g, "/")
    )
  );

  return files.filter((abs) => changedAbs.has(abs.replace(/\\/g, "/")));
}

