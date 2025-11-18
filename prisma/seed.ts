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

  const admin = await upsertUser(
    "admin@demo.com",
    ROLES.ADMIN,
    "Admin",
    passwordHash
  );
  const user = await upsertUser(
    "user@demo.com",
    ROLES.SITE_INCHARGE,
    "User",
    passwordHash
  );
  const pm = await upsertUser(
    "pm@demo.com",
    ROLES.PROJECT_MANAGER,
    "Project Manager",
    passwordHash
  );
  const siteEng = await upsertUser(
    "siteEng@demo.com",
    ROLES.SITE_INCHARGE,
    "Site Engineer",
    passwordHash
  );

  const HR = await upsertUser(
    "hr@demo.com",
    ROLES.SITE_INCHARGE,
    "HR",
    passwordHash
  );

  const [
    { token: adminRefresh, expiresAt: adminExp },
    { token: userRefresh, expiresAt: userExp },
  ] = await Promise.all([
    signRefreshTokenWithExpiry({ sub: String(admin.id), role: admin.role }),
    signRefreshTokenWithExpiry({ sub: String(user.id), role: user.role }),
  ]);

  await prisma.refreshToken.createMany({
    data: [
      { token: adminRefresh, userId: admin.id, expiresAt: adminExp },
      { token: userRefresh, userId: user.id, expiresAt: userExp },
    ],
    skipDuplicates: true,
  });

  // Insert 27 dummy users for pagination testing (idempotent via upsert by unique email)
  const dummyPromises: Promise<unknown>[] = [];
  for (let i = 1; i <= 5; i++) {
    const email = `dummy${i}@demo.com`;
    const name = `Dummy User ${i}`;
    dummyPromises.push(
      upsertUser(email, ROLES.SITE_INCHARGE, name, passwordHash)
    );
  }
  await Promise.all(dummyPromises);

  console.log("Seed complete:", {
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      refreshToken: adminRefresh,
    },
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      refreshToken: userRefresh,
    },
    dummyUsers: 27,
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
