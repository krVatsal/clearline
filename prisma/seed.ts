import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("agent123", 12);

  await prisma.user.upsert({
    where: { email: "agent@clearline.dev" },
    update: {},
    create: {
      email: "agent@clearline.dev",
      name: "Demo Agent",
      password_hash: passwordHash,
      role: "agent",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@clearline.dev" },
    update: {},
    create: {
      email: "admin@clearline.dev",
      name: "Admin User",
      password_hash: await bcrypt.hash("admin123", 12),
      role: "admin",
    },
  });

  console.log("✅ Seed complete.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Demo Agent  → agent@clearline.dev / agent123");
  console.log("  Admin       → admin@clearline.dev / admin123");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
