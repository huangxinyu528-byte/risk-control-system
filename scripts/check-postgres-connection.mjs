#!/usr/bin/env node

import fs from "node:fs";

function loadEnvFile(filePath, overwrite = false) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    if (!key || (!overwrite && process.env[key] !== undefined)) {
      continue;
    }

    process.env[key] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local", true);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("缺少 DATABASE_URL，无法检查 PostgreSQL 连通性。");
  process.exit(1);
}

function formatDatabaseTarget(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}:${url.port || "default"}${url.pathname}`;
  } catch {
    return "无法解析 DATABASE_URL";
  }
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  console.log(`正在检查 PostgreSQL：${formatDatabaseTarget(databaseUrl)}`);
  const result = await prisma.$queryRaw`SELECT current_database()::text AS database_name, current_user::text AS user_name, NOW() AS server_time`;
  console.log("PostgreSQL 连接成功。");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
} catch (error) {
  console.error("PostgreSQL 连接失败。");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
