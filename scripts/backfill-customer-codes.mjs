#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

function buildCustomerCode(sequence) {
  return `KH${String(sequence).padStart(3, "0")}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("缺少 DATABASE_URL，无法执行 customerCode 回填。");
  }

  const prisma = new PrismaClient();

  try {
    const customers = await prisma.customer.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        customerCode: true,
      },
    });

    const usedNumbers = new Set(
      customers
        .map((item) => item.customerCode)
        .filter(Boolean)
        .map((code) => {
          const match = code.match(/^KH(\d+)$/);
          return match ? Number(match[1]) : 0;
        })
        .filter(Boolean),
    );

    let sequence = 1;
    let updated = 0;

    for (const customer of customers) {
      if (customer.customerCode) {
        continue;
      }

      while (usedNumbers.has(sequence)) {
        sequence += 1;
      }

      const customerCode = buildCustomerCode(sequence);
      await prisma.customer.update({
        where: { id: customer.id },
        data: { customerCode },
      });
      usedNumbers.add(sequence);
      sequence += 1;
      updated += 1;
    }

    console.log(
      JSON.stringify(
        {
          success: true,
          updated,
          message: "customerCode 回填完成",
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
