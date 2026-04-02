import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const defaultTargets = [".next", ".next-dev", ".next-prod"];
const explicitArgTargets = process.argv.slice(2).filter(Boolean);
const envTarget = process.env.NEXT_DIST_DIR?.trim();

async function removeIfExists(target) {
  try {
    await fs.rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    console.log(`Removed: ${path.relative(root, target) || target}`);
  } catch (error) {
    console.error(`Failed to remove ${target}`);
    throw error;
  }
}

async function listManagedArtifacts() {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => {
      if (!entry.isDirectory()) return false;
      return (
        entry.name === ".next" ||
        entry.name === ".next-dev" ||
        entry.name === ".next-prod" ||
        entry.name.startsWith(".next_stale_") ||
        entry.name.startsWith(".next_after_build_") ||
        entry.name.startsWith(".next_bak_")
      );
    })
    .map((entry) => path.join(root, entry.name));
}

async function main() {
  const managedTargets = await listManagedArtifacts();
  const requestedTargets = explicitArgTargets.length
    ? explicitArgTargets
    : envTarget
      ? [envTarget, ".next"]
      : defaultTargets;

  const normalizedTargets = new Set(
    [...requestedTargets.map((target) => path.join(root, target)), ...managedTargets].filter(Boolean),
  );

  for (const target of normalizedTargets) {
    await removeIfExists(target);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
