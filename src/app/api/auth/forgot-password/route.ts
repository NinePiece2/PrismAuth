import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emailService, emailTemplates } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email, tenantDomain } = await request.json();

    if (!email || !tenantDomain) {
      return NextResponse.json(
        { error: "Email and tenant domain are required" },
        { status: 400 }
      );
    }

    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { domain: tenantDomain },
    });

    if (!tenant) {
      // Don't reveal if tenant exists or not for security
      return NextResponse.json(
        { message: "If an account exists, a password reset email has been sent" },
        { status: 200 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: {
        email_tenantId: {
          email,
          tenantId: tenant.id,
        },
      },
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json(
        { message: "If an account exists, a password reset email has been sent" },
        { status: 200 }
      );
    }

    // Invalidate any existing reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
        expires: { gte: new Date() },
      },
      data: {
        used: true,
      },
    });

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to database
    await prisma.passwordResetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        tenantId: tenant.id,
        expires,
      },
    });

    // Generate reset URL
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    // Send email
    const emailTemplate = emailTemplates.passwordReset(resetUrl, user.name || undefined);
    const result = await emailService.send({
      to: user.email,
      from: process.env.EMAIL_FROM || "noreply@prismauth.com",
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (!result.success) {
      console.error("Failed to send password reset email:", result.error);
      return NextResponse.json(
        { error: "Failed to send password reset email" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "If an account exists, a password reset email has been sent" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
