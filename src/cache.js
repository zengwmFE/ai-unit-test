import fs from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_VERSION = 1;

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadCache(cacheFilePath) {
  const defaultCache = { version: CACHE_VERSION, projects: {} };

  if (!cacheFilePath) return defaultCache;
  if (!fs.existsSync(cacheFilePath)) return defaultCache;

  try {
    const raw = fs.readFileSync(cacheFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultCache;
    if (parsed.version !== CACHE_VERSION) return defaultCache;
    if (!parsed.projects || typeof parsed.projects !== "object") {
      return defaultCache;
    }
    return parsed;
  } catch {
    return defaultCache;
  }
}

export function saveCache(cacheFilePath, cache) {
  if (!cacheFilePath) return;
  ensureParentDir(cacheFilePath);
  fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2), "utf-8");
}

export function computeFileHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha1").update(buf).digest("hex");
}

export function toProjectRelativePosixPath(projectDir, absoluteFilePath) {
  return path
    .relative(projectDir, absoluteFilePath)
    .replace(/\\/g, "/");
}

export function shouldGenerateForFile({
  projectDir,
  absoluteFilePath,
  absoluteTestFilePath,
  cache,
  currentHash,
}) {
  if (!fs.existsSync(absoluteTestFilePath)) return true;

  const rel = toProjectRelativePosixPath(projectDir, absoluteFilePath);
  const projectCache = cache.projects?.[projectDir];
  const entry = projectCache?.[rel];
  if (!entry) return true;

  return entry.hash !== currentHash;
}

export function upsertCacheEntry({
  projectDir,
  absoluteFilePath,
  absoluteTestFilePath,
  cache,
  currentHash,
}) {
  const rel = toProjectRelativePosixPath(projectDir, absoluteFilePath);
  const testRel = toProjectRelativePosixPath(projectDir, absoluteTestFilePath);

  if (!cache.projects[projectDir]) cache.projects[projectDir] = {};
  cache.projects[projectDir][rel] = {
    hash: currentHash,
    testFile: testRel,
    updatedAt: new Date().toISOString(),
  };
}

