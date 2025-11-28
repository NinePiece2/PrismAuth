/**
 * Cloudflare D1 + KV Adapter
 *
 * Implementation of the data abstraction layer for Cloudflare
 * Uses D1 (SQLite) for relational data and KV for fast token lookups
 */

import type { D1Database, KVNamespace } from "../../../types/cloudflare";
import type {
  IDataAccess,
  ITenantRepository,
  IUserRepository,
  IOAuthClientRepository,
  ISessionRepository,
  IAuthorizationCodeRepository,
  IAccessTokenRepository,
  IRefreshTokenRepository,
  Tenant,
  User,
  OAuthClient,
  Session,
  AuthorizationCode,
  AccessToken,
  RefreshToken,
} from "../interfaces";

/**
 * Cloudflare bindings (injected by Workers runtime)
 */
interface CloudflareEnv {
  DB: D1Database; // D1 Database
  KV: KVNamespace; // KV for caching tokens
}

// D1 row types (SQLite stores everything as primitives)
interface D1AccessTokenRow {
  id: string;
  token: string;
  clientId: string;
  userId: string;
  scope: string; // JSON string
  expiresAt: string; // ISO date string
  revoked: number; // SQLite boolean (0/1)
  createdAt: string; // ISO date string
}

interface D1RefreshTokenRow {
  id: string;
  token: string;
  clientId: string;
  userId: string;
  scope: string; // JSON string
  expiresAt: string; // ISO date string
  revoked: number; // SQLite boolean (0/1)
  createdAt: string; // ISO date string
}

interface D1OAuthClientRow {
  id: string;
  clientId: string;
  clientSecret: string;
  name: string;
  description: string | null;
  redirectUris: string; // JSON string
  allowedScopes: string; // JSON string
  grantTypes: string; // JSON string
  tenantId: string;
  isActive: number; // SQLite boolean (0/1)
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

interface D1SessionRow {
  id: string;
  sessionToken: string;
  userId: string;
  tenantId: string;
  expires: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

interface D1AuthorizationCodeRow {
  id: string;
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string; // JSON string
  expiresAt: string; // ISO date string
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  createdAt: string; // ISO date string
  used: number; // SQLite boolean (0/1)
}

// Helper to generate IDs (Cloudflare doesn't have cuid by default)
const generateId = () => crypto.randomUUID();

// Tenant Repository
class CloudflareTenantRepository implements ITenantRepository {
  constructor(private db: D1Database) {}

  async findByDomain(domain: string): Promise<Tenant | null> {
    const result = await this.db
      .prepare("SELECT * FROM tenants WHERE domain = ?")
      .bind(domain)
      .first<Tenant>();
    return result || null;
  }

  async findById(id: string): Promise<Tenant | null> {
    const result = await this.db
      .prepare("SELECT * FROM tenants WHERE id = ?")
      .bind(id)
      .first<Tenant | null>();
    return result;
  }

  async create(
    data: Omit<Tenant, "id" | "createdAt" | "updatedAt">,
  ): Promise<Tenant> {
    const id = generateId();
    const now = new Date().toISOString();
    const settings = data.settings ? JSON.stringify(data.settings) : null;

    await this.db
      .prepare(
        "INSERT INTO tenants (id, name, domain, settings, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        data.name,
        data.domain,
        settings,
        data.isActive ? 1 : 0,
        now,
        now,
      )
      .run();

    return (await this.findById(id))!;
  }

  async update(id: string, data: Partial<Tenant>): Promise<Tenant> {
    const updates: string[] = [];
    const bindings: unknown[] = [];

    if (data.name) {
      updates.push("name = ?");
      bindings.push(data.name);
    }
    if (data.isActive !== undefined) {
      updates.push("isActive = ?");
      bindings.push(data.isActive ? 1 : 0);
    }
    if (data.settings) {
      updates.push("settings = ?");
      bindings.push(JSON.stringify(data.settings));
    }

    updates.push("updatedAt = ?");
    bindings.push(new Date().toISOString());
    bindings.push(id);

    await this.db
      .prepare(`UPDATE tenants SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...bindings)
      .run();

    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM tenants WHERE id = ?").bind(id).run();
  }

  async list(): Promise<Tenant[]> {
    const result = await this.db
      .prepare("SELECT * FROM tenants ORDER BY createdAt DESC")
      .all<Tenant>();
    return result.results || [];
  }
}

// User Repository (similar pattern)
class CloudflareUserRepository implements IUserRepository {
  constructor(private db: D1Database) {}

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    const result = await this.db
      .prepare("SELECT * FROM users WHERE email = ? AND tenantId = ?")
      .bind(email, tenantId)
      .first<User>();
    return result || null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(id)
      .first<User>();
    return result || null;
  }

  async create(
    data: Omit<User, "id" | "createdAt" | "updatedAt">,
  ): Promise<User> {
    const id = generateId();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO users (id, email, emailVerified, password, name, image, role, isActive, tenantId, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        data.email,
        data.emailVerified?.toISOString() || null,
        data.password,
        data.name || null,
        data.image || null,
        data.role,
        data.isActive ? 1 : 0,
        data.tenantId,
        now,
        now,
      )
      .run();

    return (await this.findById(id))!;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const updates: string[] = [];
    const bindings: unknown[] = [];

    if (data.name !== undefined) {
      updates.push("name = ?");
      bindings.push(data.name);
    }
    if (data.email) {
      updates.push("email = ?");
      bindings.push(data.email);
    }
    if (data.password) {
      updates.push("password = ?");
      bindings.push(data.password);
    }
    if (data.isActive !== undefined) {
      updates.push("isActive = ?");
      bindings.push(data.isActive ? 1 : 0);
    }

    updates.push("updatedAt = ?");
    bindings.push(new Date().toISOString());
    bindings.push(id);

    await this.db
      .prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...bindings)
      .run();

    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    const result = await this.db
      .prepare("SELECT * FROM users WHERE tenantId = ? ORDER BY createdAt DESC")
      .bind(tenantId)
      .all<User>();
    return result.results || [];
  }
}

// Access Token Repository with KV caching
class CloudflareAccessTokenRepository implements IAccessTokenRepository {
  constructor(
    private db: D1Database,
    private kv: KVNamespace,
  ) {}

  async findByToken(token: string): Promise<AccessToken | null> {
    // Try KV cache first
    const cached = await this.kv.get(`token:${token}`, { type: "json" });
    if (cached) return cached as AccessToken;

    // Fallback to D1
    const result = await this.db
      .prepare("SELECT * FROM access_tokens WHERE token = ?")
      .bind(token)
      .first<D1AccessTokenRow>();

    if (result) {
      const accessToken: AccessToken = {
        ...result,
        scope: JSON.parse(result.scope),
        expiresAt: new Date(result.expiresAt),
        createdAt: new Date(result.createdAt),
        revoked: Boolean(result.revoked),
      };

      // Cache in KV with TTL
      const ttl = Math.floor(
        (accessToken.expiresAt.getTime() - Date.now()) / 1000,
      );
      if (ttl > 0) {
        await this.kv.put(`token:${token}`, JSON.stringify(accessToken), {
          expirationTtl: ttl,
        });
      }

      return accessToken;
    }

    return null;
  }

  async create(
    data: Omit<AccessToken, "id" | "createdAt">,
  ): Promise<AccessToken> {
    const id = generateId();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO access_tokens (id, token, clientId, userId, scope, expiresAt, revoked, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        data.token,
        data.clientId,
        data.userId,
        JSON.stringify(data.scope),
        data.expiresAt.toISOString(),
        data.revoked ? 1 : 0,
        now,
      )
      .run();

    const token = (await this.findByToken(data.token))!;

    // Cache in KV
    const ttl = Math.floor((token.expiresAt.getTime() - Date.now()) / 1000);
    if (ttl > 0) {
      await this.kv.put(`token:${data.token}`, JSON.stringify(token), {
        expirationTtl: ttl,
      });
    }

    return token;
  }

  async revoke(id: string): Promise<void> {
    const token = await this.db
      .prepare("SELECT token FROM access_tokens WHERE id = ?")
      .bind(id)
      .first<{ token: string }>();

    await this.db
      .prepare("UPDATE access_tokens SET revoked = 1 WHERE id = ?")
      .bind(id)
      .run();

    // Remove from KV cache
    if (token) {
      await this.kv.delete(`token:${token.token}`);
    }
  }

  async delete(id: string): Promise<void> {
    const token = await this.db
      .prepare("SELECT token FROM access_tokens WHERE id = ?")
      .bind(id)
      .first<{ token: string }>();

    await this.db
      .prepare("DELETE FROM access_tokens WHERE id = ?")
      .bind(id)
      .run();

    if (token) {
      await this.kv.delete(`token:${token.token}`);
    }
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db
      .prepare("DELETE FROM access_tokens WHERE expiresAt < ?")
      .bind(new Date().toISOString())
      .run();
    return result.meta.changes || 0;
  }

  async listByUser(userId: string): Promise<AccessToken[]> {
    const result = await this.db
      .prepare(
        "SELECT * FROM access_tokens WHERE userId = ? ORDER BY createdAt DESC",
      )
      .bind(userId)
      .all<D1AccessTokenRow>();

    return (result.results || []).map((r) => ({
      ...r,
      scope: JSON.parse(r.scope),
      expiresAt: new Date(r.expiresAt),
      createdAt: new Date(r.createdAt),
      revoked: Boolean(r.revoked),
    }));
  }
}

// OAuth Client Repository
class CloudflareOAuthClientRepository implements IOAuthClientRepository {
  constructor(private db: D1Database) {}

  async findByClientId(clientId: string): Promise<OAuthClient | null> {
    const result = await this.db
      .prepare("SELECT * FROM oauth_clients WHERE clientId = ?")
      .bind(clientId)
      .first<D1OAuthClientRow>();

    if (!result) return null;

    return {
      ...result,
      description: result.description ?? undefined,
      redirectUris: JSON.parse(result.redirectUris),
      allowedScopes: JSON.parse(result.allowedScopes),
      grantTypes: JSON.parse(result.grantTypes),
      isActive: Boolean(result.isActive),
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt),
    };
  }

  async findById(id: string): Promise<OAuthClient | null> {
    const result = await this.db
      .prepare("SELECT * FROM oauth_clients WHERE id = ?")
      .bind(id)
      .first<D1OAuthClientRow>();

    if (!result) return null;

    return {
      ...result,
      description: result.description ?? undefined,
      redirectUris: JSON.parse(result.redirectUris),
      allowedScopes: JSON.parse(result.allowedScopes),
      grantTypes: JSON.parse(result.grantTypes),
      isActive: Boolean(result.isActive),
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt),
    };
  }

  async create(
    data: Omit<OAuthClient, "id" | "createdAt" | "updatedAt">,
  ): Promise<OAuthClient> {
    const id = generateId();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO oauth_clients (id, clientId, clientSecret, name, description, redirectUris, allowedScopes, grantTypes, tenantId, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        data.clientId,
        data.clientSecret,
        data.name,
        data.description || null,
        JSON.stringify(data.redirectUris),
        JSON.stringify(data.allowedScopes),
        JSON.stringify(data.grantTypes),
        data.tenantId,
        data.isActive ? 1 : 0,
        now,
        now,
      )
      .run();

    return (await this.findById(id))!;
  }

  async update(id: string, data: Partial<OAuthClient>): Promise<OAuthClient> {
    const updates: string[] = [];
    const bindings: unknown[] = [];

    if (data.name) {
      updates.push("name = ?");
      bindings.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push("description = ?");
      bindings.push(data.description);
    }
    if (data.redirectUris) {
      updates.push("redirectUris = ?");
      bindings.push(JSON.stringify(data.redirectUris));
    }
    if (data.allowedScopes) {
      updates.push("allowedScopes = ?");
      bindings.push(JSON.stringify(data.allowedScopes));
    }
    if (data.grantTypes) {
      updates.push("grantTypes = ?");
      bindings.push(JSON.stringify(data.grantTypes));
    }
    if (data.isActive !== undefined) {
      updates.push("isActive = ?");
      bindings.push(data.isActive ? 1 : 0);
    }

    updates.push("updatedAt = ?");
    bindings.push(new Date().toISOString());
    bindings.push(id);

    await this.db
      .prepare(`UPDATE oauth_clients SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...bindings)
      .run();

    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM oauth_clients WHERE id = ?")
      .bind(id)
      .run();
  }

  async listByTenant(tenantId: string): Promise<OAuthClient[]> {
    const result = await this.db
      .prepare(
        "SELECT * FROM oauth_clients WHERE tenantId = ? ORDER BY createdAt DESC",
      )
      .bind(tenantId)
      .all<D1OAuthClientRow>();

    return (result.results || []).map((r) => ({
      ...r,
      description: r.description ?? undefined,
      redirectUris: JSON.parse(r.redirectUris),
      allowedScopes: JSON.parse(r.allowedScopes),
      grantTypes: JSON.parse(r.grantTypes),
      isActive: Boolean(r.isActive),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }));
  }
}

// Session Repository
class CloudflareSessionRepository implements ISessionRepository {
  constructor(private db: D1Database) {}

  async findByToken(token: string): Promise<Session | null> {
    const result = await this.db
      .prepare("SELECT * FROM sessions WHERE sessionToken = ?")
      .bind(token)
      .first<D1SessionRow>();

    if (!result) return null;

    return {
      ...result,
      expires: new Date(result.expires),
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt),
    };
  }

  async create(
    data: Omit<Session, "id" | "createdAt" | "updatedAt">,
  ): Promise<Session> {
    const id = generateId();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO sessions (id, sessionToken, userId, tenantId, expires, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        data.sessionToken,
        data.userId,
        data.tenantId,
        data.expires.toISOString(),
        now,
        now,
      )
      .run();

    return (await this.findByToken(data.sessionToken))!;
  }

  async update(id: string, data: Partial<Session>): Promise<Session> {
    const updates: string[] = [];
    const bindings: unknown[] = [];

    if (data.expires) {
      updates.push("expires = ?");
      bindings.push(data.expires.toISOString());
    }

    updates.push("updatedAt = ?");
    bindings.push(new Date().toISOString());
    bindings.push(id);

    await this.db
      .prepare(`UPDATE sessions SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...bindings)
      .run();

    const session = await this.db
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .bind(id)
      .first<D1SessionRow>();

    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    return {
      ...session,
      expires: new Date(session.expires),
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
    };
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db
      .prepare("DELETE FROM sessions WHERE expires < ?")
      .bind(new Date().toISOString())
      .run();
    return result.meta.changes || 0;
  }
}

// Authorization Code Repository
class CloudflareAuthorizationCodeRepository implements IAuthorizationCodeRepository {
  constructor(private db: D1Database) {}

  async findByCode(code: string): Promise<AuthorizationCode | null> {
    const result = await this.db
      .prepare("SELECT * FROM authorization_codes WHERE code = ?")
      .bind(code)
      .first<D1AuthorizationCodeRow>();

    if (!result) return null;

    return {
      ...result,
      codeChallenge: result.codeChallenge ?? undefined,
      codeChallengeMethod: result.codeChallengeMethod ?? undefined,
      scope: JSON.parse(result.scope),
      expiresAt: new Date(result.expiresAt),
      createdAt: new Date(result.createdAt),
      used: Boolean(result.used),
    };
  }

  async create(
    data: Omit<AuthorizationCode, "id" | "createdAt">,
  ): Promise<AuthorizationCode> {
    const id = generateId();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO authorization_codes (id, code, clientId, userId, redirectUri, scope, expiresAt, codeChallenge, codeChallengeMethod, createdAt, used)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        data.code,
        data.clientId,
        data.userId,
        data.redirectUri,
        JSON.stringify(data.scope),
        data.expiresAt.toISOString(),
        data.codeChallenge || null,
        data.codeChallengeMethod || null,
        now,
        data.used ? 1 : 0,
      )
      .run();

    return (await this.findByCode(data.code))!;
  }

  async markAsUsed(id: string): Promise<void> {
    await this.db
      .prepare("UPDATE authorization_codes SET used = 1 WHERE id = ?")
      .bind(id)
      .run();
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM authorization_codes WHERE id = ?")
      .bind(id)
      .run();
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db
      .prepare("DELETE FROM authorization_codes WHERE expiresAt < ?")
      .bind(new Date().toISOString())
      .run();
    return result.meta.changes || 0;
  }
}

// Refresh Token Repository with KV caching
class CloudflareRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(
    private db: D1Database,
    private kv: KVNamespace,
  ) {}

  async findByToken(token: string): Promise<RefreshToken | null> {
    // Try KV cache first
    const cached = await this.kv.get(`refresh:${token}`, { type: "json" });
    if (cached) return cached as RefreshToken;

    // Fallback to D1
    const result = await this.db
      .prepare("SELECT * FROM refresh_tokens WHERE token = ?")
      .bind(token)
      .first<D1RefreshTokenRow>();

    if (result) {
      const refreshToken: RefreshToken = {
        ...result,
        scope: JSON.parse(result.scope),
        expiresAt: new Date(result.expiresAt),
        createdAt: new Date(result.createdAt),
        revoked: Boolean(result.revoked),
      };

      // Cache in KV with TTL
      const ttl = Math.floor(
        (refreshToken.expiresAt.getTime() - Date.now()) / 1000,
      );
      if (ttl > 0) {
        await this.kv.put(`refresh:${token}`, JSON.stringify(refreshToken), {
          expirationTtl: ttl,
        });
      }

      return refreshToken;
    }

    return null;
  }

  async create(
    data: Omit<RefreshToken, "id" | "createdAt">,
  ): Promise<RefreshToken> {
    const id = generateId();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO refresh_tokens (id, token, clientId, userId, scope, expiresAt, revoked, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        data.token,
        data.clientId,
        data.userId,
        JSON.stringify(data.scope),
        data.expiresAt.toISOString(),
        data.revoked ? 1 : 0,
        now,
      )
      .run();

    const token = (await this.findByToken(data.token))!;

    // Cache in KV
    const ttl = Math.floor((token.expiresAt.getTime() - Date.now()) / 1000);
    if (ttl > 0) {
      await this.kv.put(`refresh:${data.token}`, JSON.stringify(token), {
        expirationTtl: ttl,
      });
    }

    return token;
  }

  async revoke(id: string): Promise<void> {
    const token = await this.db
      .prepare("SELECT token FROM refresh_tokens WHERE id = ?")
      .bind(id)
      .first<{ token: string }>();

    await this.db
      .prepare("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?")
      .bind(id)
      .run();

    // Remove from KV cache
    if (token) {
      await this.kv.delete(`refresh:${token.token}`);
    }
  }

  async delete(id: string): Promise<void> {
    const token = await this.db
      .prepare("SELECT token FROM refresh_tokens WHERE id = ?")
      .bind(id)
      .first<{ token: string }>();

    await this.db
      .prepare("DELETE FROM refresh_tokens WHERE id = ?")
      .bind(id)
      .run();

    if (token) {
      await this.kv.delete(`refresh:${token.token}`);
    }
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db
      .prepare("DELETE FROM refresh_tokens WHERE expiresAt < ?")
      .bind(new Date().toISOString())
      .run();
    return result.meta.changes || 0;
  }

  async listByUser(userId: string): Promise<RefreshToken[]> {
    const result = await this.db
      .prepare(
        "SELECT * FROM refresh_tokens WHERE userId = ? ORDER BY createdAt DESC",
      )
      .bind(userId)
      .all<D1RefreshTokenRow>();

    return (result.results || []).map((r) => ({
      ...r,
      scope: JSON.parse(r.scope),
      expiresAt: new Date(r.expiresAt),
      createdAt: new Date(r.createdAt),
      revoked: Boolean(r.revoked),
    }));
  }
}

/**
 * Cloudflare Data Access Implementation
 */
export class CloudflareDataAccess implements IDataAccess {
  public readonly tenants: ITenantRepository;
  public readonly users: IUserRepository;
  public readonly oauthClients: IOAuthClientRepository;
  public readonly sessions: ISessionRepository;
  public readonly authorizationCodes: IAuthorizationCodeRepository;
  public readonly accessTokens: IAccessTokenRepository;
  public readonly refreshTokens: IRefreshTokenRepository;

  constructor(env: CloudflareEnv) {
    this.tenants = new CloudflareTenantRepository(env.DB);
    this.users = new CloudflareUserRepository(env.DB);
    this.oauthClients = new CloudflareOAuthClientRepository(env.DB);
    this.sessions = new CloudflareSessionRepository(env.DB);
    this.authorizationCodes = new CloudflareAuthorizationCodeRepository(env.DB);
    this.accessTokens = new CloudflareAccessTokenRepository(env.DB, env.KV);
    this.refreshTokens = new CloudflareRefreshTokenRepository(env.DB, env.KV);
  }
}
