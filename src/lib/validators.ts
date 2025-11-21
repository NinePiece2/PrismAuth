import { z } from "zod";

// Password validation regex
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

// User schemas
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      passwordRegex,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol (@$!%*?&)",
    ),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  tenantDomain: z.string().min(1, "Tenant domain is required"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  tenantDomain: z.string().min(1, "Tenant domain is required"),
});

// OAuth2 schemas
export const authorizeSchema = z.object({
  response_type: z.enum(["code"], {
    message: "Only authorization code flow is supported",
  }),
  client_id: z.string().min(1, "Client ID is required"),
  redirect_uri: z.string().url("Invalid redirect URI"),
  scope: z.string().default("openid profile email"),
  state: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(["plain", "S256"]).optional(),
  nonce: z.string().optional(),
});

export const tokenSchema = z.object({
  grant_type: z.enum(["authorization_code", "refresh_token"], {
    message: "Invalid grant type",
  }),
  code: z.string().optional(),
  redirect_uri: z.string().url().optional(),
  client_id: z.string().min(1, "Client ID is required"),
  client_secret: z.string().min(1, "Client secret is required"),
  code_verifier: z.string().optional(),
  refresh_token: z.string().optional(),
});

export const createClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  description: z.string().optional(),
  redirectUris: z
    .array(z.string().url("Invalid redirect URI"))
    .min(1, "At least one redirect URI is required"),
  allowedScopes: z.array(z.string()).default(["openid", "profile", "email"]),
  grantTypes: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .default(["authorization_code", "refresh_token"]),
});

export const createTenantSchema = z.object({
  name: z.string().min(1, "Tenant name is required"),
  domain: z
    .string()
    .min(1, "Domain is required")
    .regex(
      /^[a-z0-9-]+$/,
      "Domain must contain only lowercase letters, numbers, and hyphens",
    ),
  settings: z.record(z.string(), z.any()).optional(),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AuthorizeInput = z.infer<typeof authorizeSchema>;
export type TokenInput = z.infer<typeof tokenSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
