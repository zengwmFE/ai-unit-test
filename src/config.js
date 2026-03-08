import fs from "fs";
import path from "path";

export function loadConfig() {
  const defaultConfig = {
    // 需要处理的白名单（相对于被扫描的 React 项目根目录）
    includePatterns: ["src/components/**/*.js", "src/data/**/*.js"],
    // 不需要处理的黑名单（文件或文件夹都可以用 glob 表达）
    excludePatterns: ["**/*.test.js"],
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
    };
  } catch (e) {
    console.error(
      "Failed to read unit-test.config.json, using default patterns.",
      e
    );
    return defaultConfig;
  }
}

