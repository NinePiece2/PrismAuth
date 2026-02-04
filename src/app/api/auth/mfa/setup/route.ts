import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { randomBytes } from "crypto";
import { emailService, emailTemplates } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Setup MFA for user
 * POST /api/auth/mfa/setup
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if MFA is already enabled
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { mfaEnabled: true, mfaSecret: true },
    });

    if (dbUser?.mfaEnabled) {
      return NextResponse.json(
        { error: "MFA is already enabled" },
        { status: 400 },
      );
    }

    // Generate a new secret
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: "PrismAuth",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: secret,
    });

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      randomBytes(4).toString("hex").toUpperCase(),
    );

    // Store the secret (but don't enable MFA yet - user needs to verify first)
    await prisma.user.update({
      where: { id: user.userId },
      data: {
        mfaSecret: secret.base32,
        mfaBackupCodes: backupCodes,
      },
    });

    // Generate QR code
    const otpauthUrl = totp.toString();
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    return NextResponse.json({
      secret: secret.base32,
      qrCode,
      backupCodes,
    });
  } catch (error) {
    console.error("MFA setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Verify and enable MFA
 * POST /api/auth/mfa/verify
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 },
      );
    }

    // Get user's MFA secret
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });

    if (!dbUser?.mfaSecret) {
      return NextResponse.json(
        { error: "MFA setup not initiated" },
        { status: 400 },
      );
    }

    // Verify the code
    const totp = new OTPAuth.TOTP({
      issuer: "PrismAuth",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(dbUser.mfaSecret),
    });

    const isValid = totp.validate({ token: code, window: 1 }) !== null;

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 },
      );
    }

    // Enable MFA and clear requireMfaSetup flag
    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: {
        mfaEnabled: true,
        requireMfaSetup: false,
      },
    });

    // Send MFA enabled confirmation email
    try {
      const { config } = await import("@/lib/config");
      const emailTemplate = emailTemplates.mfaEnabled(
        updatedUser.name || undefined,
      );

      await emailService.send({
        to: updatedUser.email,
        from: config.email.from,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });
    } catch (emailError) {
      console.error("Failed to send MFA enabled email:", emailError);
      // Don't fail MFA enablement if email fails
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("MFA verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Disable MFA
 * DELETE /api/auth/mfa/setup
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 },
      );
    }

    // Get user's MFA secret
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { mfaSecret: true, mfaEnabled: true, mfaBackupCodes: true },
    });

    if (!dbUser?.mfaEnabled) {
      return NextResponse.json(
        { error: "MFA is not enabled" },
        { status: 400 },
      );
    }

    // Check if it's a backup code
    const isBackupCode = dbUser.mfaBackupCodes.includes(code.toUpperCase());
    let isValid = false;

    if (isBackupCode) {
      isValid = true;
      // Remove used backup code
      await prisma.user.update({
        where: { id: user.userId },
        data: {
          mfaBackupCodes: dbUser.mfaBackupCodes.filter(
            (bc) => bc !== code.toUpperCase(),
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
        secret: OTPAuth.Secret.fromBase32(dbUser.mfaSecret!),
      });

      isValid = totp.validate({ token: code, window: 1 }) !== null;
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 },
      );
    }

    // Disable MFA
    await prisma.user.update({
      where: { id: user.userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MFA disable error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
