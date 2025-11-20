import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validators";
import { verifyPassword } from "@/lib/crypto";
import { createSession } from "@/lib/session";
import { ZodError } from "zod";

/**
 * User Login
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { domain: validatedData.tenantDomain },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    if (!tenant.isActive) {
      return NextResponse.json(
        { error: "Tenant is not active" },
        { status: 403 },
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: {
        email_tenantId: {
          email: validatedData.email,
          tenantId: tenant.id,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is not active" },
        { status: 403 },
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(
      validatedData.password,
      user.password,
    );
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

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
      role: user.role,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
