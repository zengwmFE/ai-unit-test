import fs from "fs";
import * as z from "zod";
import { tool } from "@langchain/core/tools";

// LangChain 文件读取 Tool，给 LLM 使用
export const readFileTool = tool(
  async ({ filePath, encoding = "utf-8" }) => {
    if (!filePath) {
      throw new Error("read_file: filePath is required");
    }
    return fs.readFileSync(filePath, encoding);
  },
  {
    name: "read_file",
    description: "读取本地文件内容，用于为模型提供源码。",
    schema: z.object({
      filePath: z.string().describe("需要读取的文件路径"),
      encoding: z.string().optional().describe("文件编码，默认为 utf-8")
    }),
  }
);

// 在普通脚本里的便捷封装
export async function readFileForModel(filePath, encoding = "utf-8") {
  return readFileTool.invoke({ filePath, encoding });
}

