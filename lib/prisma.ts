import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createUnavailablePrismaClient() {
  const createThrowingProxy = () =>
    new Proxy(function unavailablePrisma() {}, {
      get() {
        return createThrowingProxy();
      },
      apply() {
        throw new Error("DATABASE_URL 未配置，当前使用开发数据模式。");
      },
    });

  return createThrowingProxy() as unknown as PrismaClient;
}

const canUsePrisma = Boolean(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  (canUsePrisma
    ? new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
      })
    : createUnavailablePrismaClient());

if (process.env.NODE_ENV !== "production" && canUsePrisma) {
  globalForPrisma.prisma = prisma;
}
