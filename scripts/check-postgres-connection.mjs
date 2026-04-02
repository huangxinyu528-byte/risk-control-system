#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("缺少 DATABASE_URL，无法检查 PostgreSQL 连通性。");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
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
