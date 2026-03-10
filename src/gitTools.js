import * as z from "zod";
import { tool } from "@langchain/core/tools";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

function normalizedLines(stdout) {
  return stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// 检查是否在 git 仓库中的 Tool
export const gitIsRepoTool = tool(
  async ({ projectDir }) => {
    if (!projectDir) {
      throw new Error("git_is_repo: projectDir is required");
    }
    const cmd = ["git", "-C", projectDir, "rev-parse", "--is-inside-work-tree"];
    try {
      const { stdout } = await execAsync(cmd.join(" "));
      const isRepo = stdout.trim() === "true";
      return JSON.stringify({ isRepo });
    } catch {
      return JSON.stringify({ isRepo: false });
    }
  },
  {
    name: "git_is_repo",
    description: "检查给定目录是否是一个 git 仓库（位于 work tree 内）。输入: { projectDir }。",
    schema: z.object({
      projectDir: z.string().describe("项目目录路径"),
    }),
  }
);

// 获取变更文件列表的 Tool
export const gitChangedFilesTool = tool(
  async ({ projectDir, baseRef = "origin/main", headRef = "HEAD" }) => {
    if (!projectDir) {
      throw new Error("git_changed_files: projectDir is required");
    }

    const changed = new Set();

    const run = async (args) => {
      const cmd = ["git", "-C", projectDir, ...args].join(" ");
      try {
        const { stdout } = await execAsync(cmd);
        normalizedLines(stdout).forEach((p) => changed.add(p));
      } catch {
        // 单个命令失败可忽略
      }
    };

    // 1) 提交范围内的变更
    await run(["diff", "--name-only", "--diff-filter=AMR", `${baseRef}...${headRef}`]);

    // 2) 工作区未暂存变更
    await run(["diff", "--name-only", "--diff-filter=AMR"]);

    // 3) 暂存区变更
    await run(["diff", "--name-only", "--diff-filter=AMR", "--cached"]);

    // 4) 未跟踪的新文件
    await run(["ls-files", "--others", "--exclude-standard"]);

    return JSON.stringify({ files: Array.from(changed) });
  },
  {
    name: "git_changed_files",
    description: "返回 git 仓库中相对于 baseRef...headRef 的新增/修改文件，" +
      "并合并当前工作区与暂存区的变更，以及未跟踪文件。输入: { projectDir, baseRef, headRef }。",
    schema: z.object({
      projectDir: z.string().describe("项目目录路径"),
      baseRef: z.string().optional().describe("基础分支，默认为 origin/main"),
      headRef: z.string().optional().describe("目标分支，默认为 HEAD"),
    }),
  }
);

