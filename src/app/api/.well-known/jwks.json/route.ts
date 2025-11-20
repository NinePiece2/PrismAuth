import { NextResponse } from "next/server";
import { getJWKS } from "@/lib/jwt";

/**
 * JWKS Endpoint (JSON Web Key Set)
 * GET /.well-known/jwks.json
 */
export async function GET() {
  try {
    const jwks = await getJWKS();
    return NextResponse.json(jwks);
  } catch (error) {
    console.error("JWKS error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to generate JWKS" },
      { status: 500 },
    );
  }
}
