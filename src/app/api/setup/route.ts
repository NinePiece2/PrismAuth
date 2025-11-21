/**
 * Initial Setup API Route
 * Creates the first tenant and admin user
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantName, tenantDomain, adminName, adminEmail, adminPassword } = body;

    // Validate inputs
    if (!tenantName || !tenantDomain || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (adminPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if any tenants exist (only allow setup if no tenants)
    const tenantCount = await prisma.tenant.count();
    if (tenantCount > 0) {
      return NextResponse.json(
        { error: "Setup has already been completed" },
        { status: 400 }
      );
    }

    // Validate tenant domain format
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(tenantDomain)) {
      return NextResponse.json(
        { error: "Invalid domain format" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Create tenant and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          domain: tenantDomain,
          isActive: true,
        },
      });

      // Hash password
      const hashedPassword = await hashPassword(adminPassword);

      // Create admin user
      const adminUser = await tx.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: adminName || null,
          tenantId: tenant.id,
          role: "admin",
          isActive: true,
        },
      });

      return { tenant, adminUser };
    });

    return NextResponse.json({
      success: true,
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        domain: result.tenant.domain,
      },
      user: {
        id: result.adminUser.id,
        email: result.adminUser.email,
        name: result.adminUser.name,
        role: result.adminUser.role,
      },
    });
  } catch (error: unknown) {
    console.error("Error during initial setup:", error);

    // Handle unique constraint violations
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const prismaError = error as { meta?: { target?: string[] } };
      const field = prismaError.meta?.target?.[0];
      if (field === "domain") {
        return NextResponse.json(
          { error: "A tenant with this domain already exists" },
          { status: 400 }
        );
      }
      if (field === "email") {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to complete setup. Please try again." },
      { status: 500 }
    );
  }
}
