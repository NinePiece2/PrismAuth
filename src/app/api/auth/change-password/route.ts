import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { createSession } from "@/lib/session";
import { z } from "zod";
import { emailService, emailTemplates } from "@/lib/email";

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

const changePasswordSchema = z.object({
  userId: z.string(),
  currentPassword: z.string(),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      passwordRegex,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol (@$!%*?&)",
    ),
});

/**
 * Change password for users with requirePasswordChange flag
 * POST /api/auth/change-password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = changePasswordSchema.parse(body);

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: validatedData.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const isValidPassword = await verifyPassword(
      validatedData.currentPassword,
      user.password,
    );

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid current password" },
        { status: 401 },
      );
    }

    // Check if new password is different from current password
    const isSamePassword = await verifyPassword(
      validatedData.newPassword,
      user.password,
    );

    if (isSamePassword) {
      return NextResponse.json(
        { error: "New password must be different from current password" },
        { status: 400 },
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(validatedData.newPassword);

    // Update password and clear requirePasswordChange flag
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        requirePasswordChange: false,
      },
    });

    // Send password changed notification email
    try {
      const { config } = await import("@/lib/config");
      const emailTemplate = emailTemplates.passwordChanged(
        user.name || undefined,
      );

      await emailService.send({
        to: user.email,
        from: config.email.from,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });
    } catch (emailError) {
      console.error("Failed to send password changed email:", emailError);
      // Don't fail password change if email fails
    }

    // Check if MFA setup is required
    if (user.requireMfaSetup && !user.mfaEnabled) {
      // Create session first so user can access settings
      await createSession({
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      return NextResponse.json({
        success: true,
        requireMfaSetup: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    }

    // Check if user has MFA enabled
    if (user.mfaEnabled) {
      return NextResponse.json({
        success: true,
        requireMfa: true,
        userId: user.id,
        email: user.email,
      });
    }

    // Create session if no MFA
    await createSession({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
