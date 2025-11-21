import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const setPermissionsSchema = z.object({
  applicationId: z.string(),
  permissions: z.array(z.string()),
});

/**
 * Set permissions for a role on an application (Admin only)
 * POST /api/admin/roles/[id]/permissions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: roleId } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = setPermissionsSchema.parse(body);

    // Verify role belongs to tenant
    const role = await prisma.customRole.findFirst({
      where: {
        id: roleId,
        tenantId: currentUser.tenantId,
      },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Verify application belongs to tenant
    const application = await prisma.oAuthClient.findFirst({
      where: {
        id: validatedData.applicationId,
        tenantId: currentUser.tenantId,
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    // Upsert permission
    const permission = await prisma.rolePermission.upsert({
      where: {
        roleId_applicationId: {
          roleId,
          applicationId: validatedData.applicationId,
        },
      },
      update: {
        permissions: validatedData.permissions,
      },
      create: {
        roleId,
        applicationId: validatedData.applicationId,
        permissions: validatedData.permissions,
      },
      include: {
        application: {
          select: {
            id: true,
            name: true,
            clientId: true,
          },
        },
      },
    });

    return NextResponse.json(permission);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Set permissions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Get all permissions for a role (Admin only)
 * GET /api/admin/roles/[id]/permissions
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: roleId } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Verify role belongs to tenant
    const role = await prisma.customRole.findFirst({
      where: {
        id: roleId,
        tenantId: currentUser.tenantId,
      },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const permissions = await prisma.rolePermission.findMany({
      where: {
        roleId,
      },
      include: {
        application: {
          select: {
            id: true,
            name: true,
            clientId: true,
          },
        },
      },
    });

    return NextResponse.json(permissions);
  } catch (error) {
    console.error("Get permissions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Delete permission for a role on an application (Admin only)
 * DELETE /api/admin/roles/[id]/permissions/[applicationId]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: roleId } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(_request.url);
    const pathParts = url.pathname.split("/");
    const applicationId = pathParts[pathParts.length - 1];

    // Verify role belongs to tenant
    const role = await prisma.customRole.findFirst({
      where: {
        id: roleId,
        tenantId: currentUser.tenantId,
      },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Delete permission
    await prisma.rolePermission.delete({
      where: {
        roleId_applicationId: {
          roleId,
          applicationId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete permission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
