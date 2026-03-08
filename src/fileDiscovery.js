import path from "path";
import { sync as globSync } from "glob";
import { loadConfig } from "./config.js";

export function gatherFiles(baseDir) {
  const { includePatterns, excludePatterns } = loadConfig();

  const includedFiles = includePatterns.flatMap((pattern) =>
    globSync(path.join(baseDir, pattern), { nodir: true })
  );

  const excludedSet = new Set(
    excludePatterns.flatMap((pattern) =>
      globSync(path.join(baseDir, pattern), { nodir: true })
    )
  );

  const uniqueIncluded = Array.from(new Set(includedFiles));
  return uniqueIncluded.filter((file) => !excludedSet.has(file));
}

