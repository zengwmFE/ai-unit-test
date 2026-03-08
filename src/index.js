/*
Simple CLI that scans a React project directory for source files
and sends their contents to OpenAI for test case generation. The
generated tests are printed to stdout or could be written to files.

Environment variable DASHSCOPE_API_KEY should contain a valid OpenAI key.
*/

import fs from "fs";
import path from "path";
import { sync as globSync } from "glob";
import { ChatOpenAI } from "@langchain/openai";

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) {
  console.error("Error: DASHSCOPE_API_KEY is not set.");
  process.exit(1);
}

const llm = new ChatOpenAI({
  model: "qwen3.5-plus",
  temperature: 0,
  configuration: {
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
});

function loadConfig() {
  const defaultConfig = {
    // 需要处理的白名单（相对于被扫描的 React 项目根目录）
    includePatterns: [
      "src/components/**/*.js",
      "src/data/**/*.js",
    ],
    // 不需要处理的黑名单（文件或文件夹都可以用 glob 表达）
    excludePatterns: [
      "**/*.test.js",
    ],
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
      "Failed to read ai-unit-test.config.json, using default patterns.",
      e
    );
    return defaultConfig;
  }
}

function gatherFiles(baseDir) {
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

// 从大模型输出中提取可执行的测试代码（去掉 Markdown、说明文字等）
function extractTestCode(rawContent) {
  if (!rawContent) return "";

  // 优先提取 ``` ``` 里的代码块
  const codeBlockRegex = /```(?:[a-zA-Z]+)?\s*([\s\S]*?)```/g;
  let match;
  const blocks = [];

  while ((match = codeBlockRegex.exec(rawContent)) !== null) {
    const block = match[1].trim();
    if (block) blocks.push(block);
  }

  if (blocks.length > 0) {
    return blocks.join("\n\n");
  }

  // 没有代码块时，简单去掉 Markdown 标题等
  return rawContent
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith("#")) return false;
      if (trimmed.startsWith("```")) return false;
      return true;
    })
    .join("\n")
    .trim();
}

async function generateTestsForFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const prompt =
    "你是一个前端测试专家。" +
    "请为下面的 React/JavaScript 源码生成可直接运行的 Jest / React Testing Library 测试文件。" +
    "要求：" +
    "1) 只返回纯 JavaScript 测试代码；" +
    "2) 不要任何解释说明文字；" +
    "3) 不要用 ``` ``` 或 Markdown 包裹；" +
    "4) 代码能被 Jest 直接执行。\n\n" +
    content;

  try {
    const aiMsg = await llm.invoke([{ role: "user", content: prompt }]);
    const raw =
      typeof aiMsg.content === "string"
        ? aiMsg.content
        : aiMsg.content
            .map((c) =>
              typeof c === "string" ? c : (c.text ?? c.toString())
            )
            .join("\n");
    return extractTestCode(raw);
  } catch (err) {
    console.error(`Model API error for ${filePath}:`, err);
    throw err;
  }
}

async function main() {
  const projectDir = path.resolve(process.argv[2] || "../react-frontend");
  console.log(`Scanning project at ${projectDir}`);

  const files = gatherFiles(projectDir);
  console.log(`Found ${files.length} source files by config patterns`);

  const CONCURRENCY = Number(process.env.GENERATE_CONCURRENCY || 3);
  let index = 0;

  async function worker(workerId) {
    // 简单的并发 worker，实现多文件并行提测
    while (true) {
      const currentIndex = index;
      if (currentIndex >= files.length) return;
      index += 1;

      const file = files[currentIndex];
      console.log(
        `\n[Worker ${workerId}] --- Generating tests for ${file} ---\n`
      );

      try {
        const tests = await generateTestsForFile(file);
        if (!tests) {
          console.warn(`[Worker ${workerId}] Empty tests for ${file}, skip.`);
          continue;
        }

        const { dir, name } = path.parse(file);
        const testDir = path.join(dir, "__tests__");
        if (!fs.existsSync(testDir)) {
          fs.mkdirSync(testDir, { recursive: true });
        }
        const testFilePath = path.join(testDir, `${name}.test.js`);
        fs.writeFileSync(testFilePath, tests, "utf-8");
        console.log(
          `[Worker ${workerId}] Saved tests to ${testFilePath}`
        );
      } catch (err) {
        console.error(
          `[Worker ${workerId}] Failed to generate for ${file}:`,
          err
        );
      }
    }
  }

  const workerCount = Math.min(CONCURRENCY, files.length || 1);
  await Promise.all(
    Array.from({ length: workerCount }, (_, i) => worker(i + 1))
  );
}

main().catch(console.error);
