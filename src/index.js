import path from "path";
import { gatherFiles } from "./fileDiscovery.js";
import { runWorkers } from "./generator.js";

async function main() {
  const projectDir = path.resolve(process.argv[2] || "../react-frontend");
  console.log(`Scanning project at ${projectDir}`);

  const files = gatherFiles(projectDir);
  console.log(`Found ${files.length} source files by config patterns`);

  const concurrency = Number(process.env.GENERATE_CONCURRENCY || 3);
  await runWorkers(files, concurrency);
}

main().catch(console.error);
