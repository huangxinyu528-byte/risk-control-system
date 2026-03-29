import { execSync } from "node:child_process";

const ports = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007];

function findPids(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port}`, {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();

    if (!output) return [];
    return output
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const pidSet = new Set();

for (const port of ports) {
  for (const pid of findPids(port)) {
    pidSet.add(pid);
  }
}

if (pidSet.size === 0) {
  console.log("No local Next.js ports are currently in use.");
  process.exit(0);
}

const pids = [...pidSet];

try {
  execSync(`kill ${pids.join(" ")}`, { stdio: "ignore" });
  console.log(`Stopped local server processes: ${pids.join(", ")}`);
} catch (error) {
  console.error("Failed to stop some local server processes.");
  throw error;
}
