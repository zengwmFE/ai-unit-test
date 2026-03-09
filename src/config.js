import fs from "fs";
import path from "path";

export function loadConfig() {
  const defaultConfig = {
    // 需要处理的白名单（相对于被扫描的 React 项目根目录）
    includePatterns: ["src/components/**/*.js", "src/data/**/*.js"],
    // 不需要处理的黑名单（文件或文件夹都可以用 glob 表达）
    excludePatterns: ["**/*.test.js"],

    // 变更识别策略（优雅组合）：
    // - "git": 优先用 git diff + 工作区变更识别新增/修改文件；失败则降级为 "missing"
    // - "missing": 仅为缺失测试文件的源文件生成
    // - "mtime": 源文件 mtime > 测试文件 mtime 时更新；或测试缺失时生成
    // - "all": 全量生成
    changeDetection: "git",

    // git diff 的基准（仅 changeDetection="git" 时使用）
    gitBaseRef: "origin/main",
    gitHeadRef: "HEAD",
  };

  const configPath = path.resolve(process.cwd(), "unit-test.config.json");
  if (!fs.existsSync(configPath)) {
    return defaultConfig;
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const userConfig = JSON.parse(raw);
    return {
      includePatterns:
        Array.isArray(userConfig.includePatterns) &&
        userConfig.includePatterns.length > 0
          ? userConfig.includePatterns
          : defaultConfig.includePatterns,
      excludePatterns: Array.isArray(userConfig.excludePatterns)
        ? userConfig.excludePatterns
        : defaultConfig.excludePatterns,
      changeDetection:
        typeof userConfig.changeDetection === "string" &&
        ["git", "missing", "mtime", "all"].includes(userConfig.changeDetection)
          ? userConfig.changeDetection
          : defaultConfig.changeDetection,
      gitBaseRef:
        typeof userConfig.gitBaseRef === "string" && userConfig.gitBaseRef.trim()
          ? userConfig.gitBaseRef
          : defaultConfig.gitBaseRef,
      gitHeadRef:
        typeof userConfig.gitHeadRef === "string" && userConfig.gitHeadRef.trim()
          ? userConfig.gitHeadRef
          : defaultConfig.gitHeadRef,
    };
  } catch (e) {
    console.error(
      "Failed to read unit-test.config.json, using default patterns.",
      e
    );
    return defaultConfig;
  }
}

