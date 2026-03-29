import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function fitText(value, maxLength) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

async function main() {
  const projects = await prisma.project.findMany({
    where: {
      customer: {
        isMerged: false,
      },
    },
    select: {
      id: true,
      name: true,
      projectAlias: true,
      sourceCustomerName: true,
      projectBelonging: true,
      creditStatus: true,
      currentStatus: true,
      customer: {
        select: {
          creditStatus: true,
          creditStanding: true,
          currentStatus: true,
        },
      },
    },
  });

  let updated = 0;

  for (const project of projects) {
    const nextProjectBelonging =
      fitText(project.projectBelonging, 200) ||
      fitText(project.projectAlias, 200) ||
      fitText(project.name, 200) ||
      fitText(project.sourceCustomerName, 200);
    const nextCreditStatus =
      fitText(project.creditStatus, 100) ||
      fitText(project.customer.creditStatus, 100) ||
      fitText(project.customer.creditStanding, 100);
    const nextCurrentStatus =
      fitText(project.currentStatus, 200) ||
      fitText(project.customer.currentStatus, 200);

    const shouldUpdate =
      nextProjectBelonging !== project.projectBelonging ||
      nextCreditStatus !== project.creditStatus ||
      nextCurrentStatus !== project.currentStatus;

    if (!shouldUpdate) continue;

    await prisma.project.update({
      where: { id: project.id },
      data: {
        projectBelonging: nextProjectBelonging,
        creditStatus: nextCreditStatus,
        currentStatus: nextCurrentStatus,
      },
    });
    updated += 1;
  }

  const summary = {
    totalProjects: projects.length,
    updatedProjects: updated,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
