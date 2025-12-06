import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as OTPAuth from "otpauth";
import { createSession } from "@/lib/session";
import { ZodError, z } from "zod";
import { createHash } from "crypto";

const verifyMfaSchema = z.object({
  userId: z.string(),
  code: z.string().min(6),
  trustDevice: z.boolean().optional(),
});

/**
 * Verify MFA code during login
 * POST /api/auth/mfa/verify-login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = verifyMfaSchema.parse(body);

    // Get user with MFA details
    const user = await prisma.user.findUnique({
      where: { id: validatedData.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        isActive: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaBackupCodes: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is not active" },
        { status: 403 },
      );
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json(
        { error: "MFA is not enabled for this account" },
        { status: 400 },
      );
    }

    // Check if it's a backup code
    const isBackupCode = user.mfaBackupCodes.includes(
      validatedData.code.toUpperCase(),
    );
    let isValid = false;

    if (isBackupCode) {
      isValid = true;
      // Remove used backup code
      await prisma.user.update({
        where: { id: user.id },
        data: {
          mfaBackupCodes: user.mfaBackupCodes.filter(
            (bc) => bc !== validatedData.code.toUpperCase(),
          ),
        },
      });
    } else {
      // Verify the TOTP code
      const totp = new OTPAuth.TOTP({
        issuer: "PrismAuth",
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(user.mfaSecret),
      });

      isValid =
        totp.validate({ token: validatedData.code, window: 1 }) !== null;
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 },
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

    // Handle trusted device if requested
    if (validatedData.trustDevice) {
      const userAgent = request.headers.get("user-agent") || "unknown";
      const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
      
      // Create a device identifier (hash of user agent + IP)
      const deviceIdentifier = createHash("sha256")
        .update(`${userAgent}-${ip}`)
        .digest("hex");

      // Check if device already exists
      const existingDevice = await prisma.mfaTrustedDevice.findUnique({
        where: {
          userId_deviceIdentifier: {
            userId: user.id,
            deviceIdentifier,
          },
        },
      });

      if (!existingDevice) {
        // Trust device for 30 days
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await prisma.mfaTrustedDevice.create({
          data: {
            userId: user.id,
            deviceIdentifier,
            userAgent,
            expiresAt,
          },
        });
      } else if (existingDevice.expiresAt < new Date()) {
        // Extend expiration if device exists but expired
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await prisma.mfaTrustedDevice.update({
          where: { id: existingDevice.id },
          data: { expiresAt },
        });
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }

    console.error("MFA verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
