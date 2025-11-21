import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { hashPassword } from "@/lib/crypto";
import { ZodError, z } from "zod";
import { emailService, emailTemplates } from "@/lib/email";
import { config } from "@/lib/config";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  role: z.enum(["user", "admin"]),
  customRoleId: z.string().optional(),
  requirePasswordChange: z.boolean().optional(),
  requireMfaSetup: z.boolean().optional(),
});

/**
 * List all users in the tenant (Admin only)
 * GET /api/admin/users
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId: currentUser.tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        customRoleId: true,
        customRole: {
          select: {
            id: true,
            name: true,
          },
        },
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("List users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Create a new user (Admin only)
 * POST /api/admin/users
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // Check if user already exists in this tenant
    const existingUser = await prisma.user.findUnique({
      where: {
        email_tenantId: {
          email: validatedData.email,
          tenantId: currentUser.tenantId,
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

    // Verify custom role if provided
    if (validatedData.customRoleId) {
      const customRole = await prisma.customRole.findFirst({
        where: {
          id: validatedData.customRoleId,
          tenantId: currentUser.tenantId,
          isActive: true,
        },
      });

      if (!customRole) {
        return NextResponse.json(
          { error: "Invalid custom role" },
          { status: 400 },
        );
      }
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name || null,
        tenantId: currentUser.tenantId,
        role: validatedData.role,
        ...(validatedData.customRoleId && { customRoleId: validatedData.customRoleId }),
        isActive: true,
        requirePasswordChange: validatedData.requirePasswordChange ?? false,
        requireMfaSetup: validatedData.requireMfaSetup ?? false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        customRoleId: true,
        customRole: {
          select: {
            id: true,
            name: true,
          },
        },
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Send welcome email with login credentials
    try {
      const loginUrl = `${config.baseUrl}/login`;
      const emailTemplate = emailTemplates.accountCreated(
        validatedData.email,
        validatedData.password, // Send the plain password via email
        loginUrl,
        validatedData.name
      );
      
      await emailService.send({
        to: validatedData.email,
        from: config.email.from,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail user creation if email fails
    }

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
