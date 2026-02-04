import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createTenantSchema } from "@/lib/validators";
import { ZodError } from "zod";

export const runtime = "nodejs";

/**
 * Create Tenant (Super Admin only)
 * POST /api/admin/tenants
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createTenantSchema.parse(body);

    // Check if domain already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { domain: validatedData.domain },
    });

    if (existingTenant) {
      return NextResponse.json(
        { error: "Tenant with this domain already exists" },
        { status: 409 },
      );
    }

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: validatedData.name,
        domain: validatedData.domain,
        settings: validatedData.settings ?? undefined,
        isActive: true,
      },
    });

    return NextResponse.json(tenant);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Create tenant error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * List Tenants (Super Admin only)
 * GET /api/admin/tenants
 */
export async function GET() {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tenants);
  } catch (error) {
    console.error("List tenants error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
