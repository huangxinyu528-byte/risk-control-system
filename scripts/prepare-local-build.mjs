import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const nextDir = path.join(root, ".next");

async function removeIfExists(target) {
  try {
    await fs.rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    console.log(`Removed: ${path.relative(root, target) || target}`);
  } catch (error) {
    console.error(`Failed to remove ${target}`);
    throw error;
  }
}

async function main() {
  await removeIfExists(nextDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
