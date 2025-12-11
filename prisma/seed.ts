import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signRefreshTokenWithExpiry } from "../src/lib/jwt";
import { ROLES } from "../src/config/roles";

const prisma = new PrismaClient();

async function upsertUser(
  email: string,
  role: string,
  name: string,
  passwordHash: string
) {
  return prisma.user.upsert({
    where: { email },
    update: { name, role, status: true },
    create: { email, name, role, passwordHash, status: true },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash("abcd123", 10);

  // Helper to generate users for a role code (store role code in DB; use label for display name)
  async function seedRoleBatch(
    roleCode: keyof typeof ROLES,
    count: number,
    prefix: string
  ) {
    const created: { id: number; email: string; role: string }[] = [];
    for (let i = 1; i <= count; i++) {
      const email = `${prefix}${i}@demo.com`;
      const name = `${ROLES[roleCode]} ${i}`;
      const user = await upsertUser(email, roleCode, name, passwordHash);
      // For all users except ADMIN, ensure an Employee row linked to this user exists
      if (roleCode !== "ADMIN") {
        await prisma.employee.upsert({
          where: { userId: user.id },
          update: { name },
          create: { name, userId: user.id },
        });
      }
      created.push({ id: user.id, email: user.email, role: user.role });
    }
    return created;
  }

  // Required counts
  const admins = await seedRoleBatch("ADMIN", 1, "admin");
  // const siteAdmins = await seedRoleBatch("SITE_ADMIN", 2, "siteadmin");
  const projectManagers = await seedRoleBatch("PROJECT_MANAGER", 2, "pm");
  const projectDirectors = await seedRoleBatch("PROJECT_DIRECTOR", 1, "pd");
  const purchaseExecutives = await seedRoleBatch("PURCHASE_EXECUTIVE", 2, "pe");
  // const commercialHeads = await seedRoleBatch("COMMERCIAL_HEAD", 2, "ch");
  // const managingDirectors = await seedRoleBatch("MANAGING_DIRECTOR", 1, "md");
  // const siteIncharges = await seedRoleBatch("SITE_INCHARGE", 2, "si");
  const projectCoordinators = await seedRoleBatch(
    "PROJECT_COORDINATOR",
    2,
    "pc"
  );
  const technicalDirectors = await seedRoleBatch("TECHNICAL_DIRECTOR", 2, "td");

  // Issue refresh tokens for the first Admin and first Site Admin for convenience
  const admin = admins[0];
  // const siteAdmin = siteAdmins[0];
  // const [{ token: adminRefresh, expiresAt: adminExp }, { token: saRefresh, expiresAt: saExp }] =
  await Promise.all([
    signRefreshTokenWithExpiry({ sub: String(admin.id), role: admin.role }),
    // signRefreshTokenWithExpiry({ sub: String(siteAdmin.id), role: siteAdmin.role }),
  ]);

  await prisma.refreshToken.createMany({
    data: [
      // { token: adminRefresh, userId: admin.id, expiresAt: adminExp },
      // { token: saRefresh, userId: siteAdmin.id, expiresAt: saExp },
    ],
    skipDuplicates: true,
  });

  console.log("Seed complete:", {
    totals: {
      ADMIN: admins.length,
      // SITE_ADMIN: siteAdmins.length,
      PROJECT_MANAGER: projectManagers.length,
      PROJECT_DIRECTOR: projectDirectors.length,
      PURCHASE_EXECUTIVE: purchaseExecutives.length,
      // COMMERCIAL_HEAD: commercialHeads.length,
      // MANAGING_DIRECTOR: managingDirectors.length,
      // SITE_INCHARGE: siteIncharges.length,
      PROJECT_COORDINATOR: projectCoordinators.length,
      TECHNICAL_DIRECTOR: technicalDirectors.length,
    },
    sampleTokens: {
      // admin: { email: admin.email, role: admin.role, refreshToken: adminRefresh },
      // siteAdmin: { email: siteAdmin.email, role: siteAdmin.role, refreshToken: saRefresh },
    },
  });
}

main()
  .catch((e) => {
    console.error("Seed failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
