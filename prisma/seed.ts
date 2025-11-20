import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { domain: "default" },
    update: {},
    create: {
      name: "Default Tenant",
      domain: "default",
      isActive: true,
      settings: {},
    },
  });

  console.log("✓ Created tenant:", tenant.name);

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);
  const adminUser = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: "admin@prismauth.local",
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      email: "admin@prismauth.local",
      password: hashedPassword,
      name: "Admin User",
      role: "admin",
      isActive: true,
      tenantId: tenant.id,
      emailVerified: new Date(),
    },
  });

  console.log("✓ Created admin user:", adminUser.email);
  console.log("  Password: admin123");

  // Create demo user
  const demoPassword = await bcrypt.hash("demo123", 12);
  const demoUser = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: "demo@prismauth.local",
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      email: "demo@prismauth.local",
      password: demoPassword,
      name: "Demo User",
      role: "user",
      isActive: true,
      tenantId: tenant.id,
      emailVerified: new Date(),
    },
  });

  console.log("✓ Created demo user:", demoUser.email);
  console.log("  Password: demo123");

  console.log("\n🎉 Database seeded successfully!");
  console.log("\nYou can now:");
  console.log("1. Login as admin: admin@prismauth.local / admin123");
  console.log("2. Login as demo user: demo@prismauth.local / demo123");
  console.log("3. Create OAuth2 clients via the admin API");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
