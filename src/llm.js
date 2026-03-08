import fs from "fs";
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

// 从大模型输出中提取可执行的测试代码（去掉 Markdown、说明文字等）
export function extractTestCode(rawContent) {
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

function buildPrompt(content, importPath) {
  return (
    "你是一个前端测试专家。" +
    "请为下面的 React/JavaScript 源码生成可直接运行的 Jest / React Testing Library 测试文件。" +
    "要求：" +
    "1) 只返回纯 JavaScript 测试代码；" +
    "2) 不要任何解释说明文字；" +
    "3) 不要用 ``` ``` 或 Markdown 包裹；" +
    "4) 代码能被 Jest 直接执行；" +
    `5) 组件或模块的导入路径必须使用相对于测试文件的路径 "${importPath}"，例如：import Component from "${importPath}";。\n\n` +
    content
  );
}

export async function generateTestsForFile(filePath, importPath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const prompt = buildPrompt(content, importPath);

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

