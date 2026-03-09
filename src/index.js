import path from "path";
import { gatherFiles } from "./fileDiscovery.js";
import { runWorkers } from "./generator.js";
import { loadConfig } from "./config.js";
import {
  filterFilesByGitChanges,
  filterFilesByMissingTests,
  filterFilesByMtime,
  isGitRepo,
} from "./changeDetection.js";

async function main() {
  const projectDir = path.resolve(process.argv[2] || "../react-frontend");
  console.log(`Scanning project at ${projectDir}`);

  const config = loadConfig();
  const candidateFiles = gatherFiles(projectDir, config);
  console.log(`Found ${candidateFiles.length} source files by config patterns`);

  let files = candidateFiles;
  const mode = config.changeDetection || "git";

  if (mode === "all") {
    // no-op
  } else if (mode === "missing") {
    files = filterFilesByMissingTests(files);
  } else if (mode === "mtime") {
    files = filterFilesByMtime(files);
  } else if (mode === "git") {
    const canUseGit = isGitRepo(projectDir);
    if (!canUseGit) {
      console.warn(
        `Not a git repo: ${projectDir}. Fallback to changeDetection="missing".`
      );
      files = filterFilesByMissingTests(files);
    } else {
      try {
        files = filterFilesByGitChanges({
          files,
          projectDir,
          baseRef: config.gitBaseRef,
          headRef: config.gitHeadRef,
        });
      } catch (e) {
        console.warn(
          `git change detection failed. Fallback to changeDetection="missing".`,
          e
        );
        files = filterFilesByMissingTests(files);
      }
    }
  }

  console.log(`Will process ${files.length} file(s) after change detection`);

  const concurrency = Number(process.env.GENERATE_CONCURRENCY || 3);
  await runWorkers({
    files,
    concurrency,
  });
}

main().catch(console.error);
