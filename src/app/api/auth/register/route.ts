import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validators";
import { hashPassword } from "@/lib/crypto";
import { createSession } from "@/lib/session";
import { ZodError } from "zod";

/**
 * User Registration
 * POST /api/auth/register
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { domain: validatedData.tenantDomain },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!tenant.isActive) {
      return NextResponse.json(
        { error: "Tenant is not active" },
        { status: 403 },
      );
    }

    // Check if user already exists in this tenant
    const existingUser = await prisma.user.findUnique({
      where: {
        email_tenantId: {
          email: validatedData.email,
          tenantId: tenant.id,
        },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists in this tenant" },
        { status: 409 },
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name || null,
        tenantId: tenant.id,
        role: "user",
        isActive: true,
      },
    });

    // Create session
    await createSession({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
