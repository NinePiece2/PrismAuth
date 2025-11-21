/**
 * Create First Admin User Script
 * 
 * This script creates a tenant and the first admin user for PrismAuth.
 * Run this after setting up the database.
 * 
 * Usage: bun run scripts/create-admin.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashPassword } from "../src/lib/crypto";
import * as readline from "readline";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log("=".repeat(50));
  console.log("PrismAuth - Create First Admin User");
  console.log("=".repeat(50));
  console.log();

  // Get tenant information
  console.log("Step 1: Tenant Information");
  console.log("-".repeat(50));
  const tenantName = await question("Tenant Name (e.g., My Company): ");
  const tenantDomain = await question("Tenant Domain (e.g., mycompany.com): ");
  console.log();

  // Get admin user information
  console.log("Step 2: Admin User Information");
  console.log("-".repeat(50));
  const adminName = await question("Admin Name (e.g., John Doe): ");
  const adminEmail = await question("Admin Email: ");
  const adminPassword = await question("Admin Password (min 8 chars): ");
  console.log();

  // Validate inputs
  if (!tenantName || !tenantDomain || !adminEmail || !adminPassword) {
    console.error("❌ Error: All fields are required!");
    process.exit(1);
  }

  if (adminPassword.length < 8) {
    console.error("❌ Error: Password must be at least 8 characters!");
    process.exit(1);
  }

  try {
    console.log("Creating tenant and admin user...");
    console.log();

    // Check if tenant already exists
    let tenant = await prisma.tenant.findUnique({
      where: { domain: tenantDomain },
    });

    if (tenant) {
      console.log(`ℹ️  Tenant "${tenantName}" already exists. Using existing tenant.`);
    } else {
      // Create tenant
      tenant = await prisma.tenant.create({
        data: {
          name: tenantName,
          domain: tenantDomain,
          isActive: true,
        },
      });
      console.log(`✅ Created tenant: ${tenant.name} (${tenant.domain})`);
    }

    // Check if admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        email_tenantId: {
          email: adminEmail,
          tenantId: tenant.id,
        },
      },
    });

    if (existingUser) {
      console.error(`❌ Error: User with email ${adminEmail} already exists in this tenant!`);
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await hashPassword(adminPassword);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: adminName || null,
        tenantId: tenant.id,
        role: "admin",
        isActive: true,
      },
    });

    console.log(`✅ Created admin user: ${adminUser.email}`);
    console.log();
    console.log("=".repeat(50));
    console.log("✨ Setup Complete!");
    console.log("=".repeat(50));
    console.log();
    console.log("You can now log in with:");
    console.log(`  Email: ${adminUser.email}`);
    console.log(`  Tenant Domain: ${tenant.domain}`);
    console.log(`  Role: ${adminUser.role}`);
    console.log();
    console.log("Access your admin panel at:");
    console.log(`  http://localhost:4000/login`);
    console.log();
  } catch (error) {
    console.error("❌ Error creating tenant and admin user:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main();
