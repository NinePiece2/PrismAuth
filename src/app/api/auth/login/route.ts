import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validators";
import { verifyPassword } from "@/lib/crypto";
import { createSession } from "@/lib/session";
import { ZodError } from "zod";
import { createHash } from "crypto";

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
      console.error(
        `Tenant not found for domain: ${validatedData.tenantDomain}`,
      );
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
      console.error(
        `User not found for email: ${validatedData.email}, tenantId: ${tenant.id}`,
      );
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
      console.error(`Invalid password for user: ${validatedData.email}`);
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Check if user needs to change password
    if (user.requirePasswordChange) {
      return NextResponse.json({
        requirePasswordChange: true,
        userId: user.id,
        email: user.email,
      });
    }

    // Check if user needs to set up MFA
    if (user.requireMfaSetup && !user.mfaEnabled) {
      return NextResponse.json({
        requireMfaSetup: true,
        userId: user.id,
        email: user.email,
      });
    }

    // Check if user has MFA enabled
    if (user.mfaEnabled) {
      // Check for trusted device
      const userAgent = request.headers.get("user-agent") || "unknown";
      const ip =
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown";

      const deviceIdentifier = createHash("sha256")
        .update(`${userAgent}-${ip}`)
        .digest("hex");

      const trustedDevice = await prisma.mfaTrustedDevice.findUnique({
        where: {
          userId_deviceIdentifier: {
            userId: user.id,
            deviceIdentifier,
          },
        },
      });

      // If device is trusted and not expired, skip MFA
      if (trustedDevice && trustedDevice.expiresAt > new Date()) {
        // Create session and skip MFA
        await createSession({
          id: user.id,
          tenantId: user.tenantId,
          email: user.email,
          name: user.name,
          role: user.role,
        });

        return NextResponse.json({
          success: true,
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          role: user.role,
        });
      }

      return NextResponse.json({
        requireMfa: true,
        userId: user.id,
        email: user.email,
      });
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
      success: true,
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
