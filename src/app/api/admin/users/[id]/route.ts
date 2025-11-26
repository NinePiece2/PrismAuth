import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ZodError, z } from "zod";

const updateUserSchema = z.object({
  role: z.enum(["user", "admin"]).optional(),
  customRoleIds: z.array(z.string()).optional(),
  name: z.string().nullable().optional(),
});

/**
 * Update user role (Admin only)
 * PATCH /api/admin/users/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Check if user exists in the same tenant
    const user = await prisma.user.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify custom roles if provided
    if (validatedData.customRoleIds !== undefined) {
      if (validatedData.customRoleIds.length > 0) {
        const customRoles = await prisma.customRole.findMany({
          where: {
            id: { in: validatedData.customRoleIds },
            tenantId: currentUser.tenantId,
            isActive: true,
          },
        });

        if (customRoles.length !== validatedData.customRoleIds.length) {
          return NextResponse.json(
            { error: "One or more invalid custom roles" },
            { status: 400 },
          );
        }
      }

      // Delete existing custom roles and create new ones
      await prisma.userCustomRole.deleteMany({
        where: { userId: id },
      });

      if (validatedData.customRoleIds.length > 0) {
        await prisma.userCustomRole.createMany({
          data: validatedData.customRoleIds.map((roleId) => ({
            userId: id,
            customRoleId: roleId,
          })),
        });
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(validatedData.role && { role: validatedData.role }),
        ...(validatedData.name !== undefined && { name: validatedData.name }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        customRoles: {
          select: {
            customRoleId: true,
            customRole: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Delete user (Admin only)
 * DELETE /api/admin/users/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    // Prevent deleting yourself
    if (id === currentUser.userId) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 },
      );
    }

    // Check if user exists in the same tenant
    const user = await prisma.user.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete user
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
