import { PrismaClient } from "@prisma/client";

import { PERMISSIONS, ROLES } from "../src/config/roles";

const prisma = new PrismaClient();

function uniqueStrings(values: Iterable<string>) {
  return Array.from(new Set(Array.from(values).filter(Boolean)));
}

async function main() {
  const permissionNames = uniqueStrings(Object.values(PERMISSIONS));
  const roleNames = uniqueStrings(Object.values(ROLES));

  // Upsert all permissions
  for (const permissionName of permissionNames) {
    await prisma.permission.upsert({
      where: { permissionName },
      create: { permissionName },
      update: {},
    });
  }

  // Upsert all roles
  for (const roleName of roleNames) {
    await prisma.role.upsert({
      where: { name: roleName },
      create: { name: roleName },
      update: {},
    });
  }

  // Bootstrap: ensure Admin always has all permissions (keeps system manageable on fresh DBs)
  try {
    const adminRole = await prisma.role.findUnique({
      where: { name: ROLES.ADMIN },
      select: { id: true },
    });
    if (adminRole) {
      const permIds = await prisma.permission.findMany({
        select: { id: true },
      });
      await prisma.rolePermission.createMany({
        data: permIds.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  } catch (e) {
    console.error("Admin permission bootstrap failed:", e);
  }

  try {
    const adminEmail = "admin@demo.com";

    const [adminUser, adminRole] = await Promise.all([
      prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true, email: true } }),
      prisma.role.findUnique({ where: { name: ROLES.ADMIN }, select: { id: true } }),
    ]);

    if (adminUser && adminRole?.id) {
      await prisma.$transaction(async (tx) => {
        await tx.userRole.upsert({
          where: { userId: adminUser.id },
          create: { userId: adminUser.id, roleId: adminRole.id },
          update: { roleId: adminRole.id },
        });

        const permIds = await tx.permission.findMany({ select: { id: true } });

        await tx.userPermission.deleteMany({ where: { userId: adminUser.id } });
        if (permIds.length) {
          await tx.userPermission.createMany({
            data: permIds.map((p) => ({ userId: adminUser.id, permissionId: p.id })),
            skipDuplicates: true,
          });
        }
      });
    }
  } catch (e) {
    console.error("admin@demo.com access bootstrap failed:", e);
  }

  const [roleCount, permissionCount, rolePermCount] = await Promise.all([
    prisma.role.count(),
    prisma.permission.count(),
    prisma.rolePermission.count(),
  ]);

  console.log(
    `Seed complete. roles=${roleCount}, permissions=${permissionCount}, rolePermissions=${rolePermCount}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
