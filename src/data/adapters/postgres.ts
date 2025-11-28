/**
 * PostgreSQL Adapter using Prisma
 *
 * Implementation of the data abstraction layer for PostgreSQL
 */

import { prisma } from "@/lib/db";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";
import { Prisma } from "@prisma/client";
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

// Tenant Repository
class PostgresTenantRepository implements ITenantRepository {
  async findByDomain(domain: string): Promise<Tenant | null> {
    return (await prisma.tenant.findUnique({
      where: { domain },
    })) as Tenant | null;
  }

  async findById(id: string): Promise<Tenant | null> {
    return (await prisma.tenant.findUnique({ where: { id } })) as Tenant | null;
  }

  async create(
    data: Omit<Tenant, "id" | "createdAt" | "updatedAt">,
  ): Promise<Tenant> {
    const { settings, ...rest } = data;
    return (await prisma.tenant.create({
      data: {
        ...rest,
        settings: settings as Prisma.InputJsonValue | undefined,
      },
    })) as Tenant;
  }

  async update(id: string, data: Partial<Tenant>): Promise<Tenant> {
    const { settings, ...rest } = data;
    return (await prisma.tenant.update({
      where: { id },
      data: {
        ...rest,
        settings: settings as Prisma.InputJsonValue | undefined,
      },
    })) as Tenant;
  }

  async delete(id: string): Promise<void> {
    await prisma.tenant.delete({ where: { id } });
  }

  async list(): Promise<Tenant[]> {
    return (await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
    })) as Tenant[];
  }
}

// User Repository
class PostgresUserRepository implements IUserRepository {
  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    return (await prisma.user.findUnique({
      where: { email_tenantId: { email, tenantId } },
    })) as User | null;
  }

  async findById(id: string): Promise<User | null> {
    return (await prisma.user.findUnique({ where: { id } })) as User | null;
  }

  async create(
    data: Omit<User, "id" | "createdAt" | "updatedAt">,
  ): Promise<User> {
    return (await prisma.user.create({ data })) as User;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return (await prisma.user.update({ where: { id }, data })) as User;
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    return (await prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    })) as User[];
  }
}

// OAuth Client Repository
class PostgresOAuthClientRepository implements IOAuthClientRepository {
  async findByClientId(clientId: string): Promise<OAuthClient | null> {
    // Try Redis cache first
    const cacheKey = `client:${clientId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return JSON.parse(cached) as OAuthClient;
    }

    // Fallback to database
    const client = (await prisma.oAuthClient.findUnique({
      where: { clientId },
    })) as OAuthClient | null;

    // Cache for 1 hour if found
    if (client) {
      await cacheSet(cacheKey, JSON.stringify(client), 3600);
    }

    return client;
  }

  async findById(id: string): Promise<OAuthClient | null> {
    return (await prisma.oAuthClient.findUnique({
      where: { id },
    })) as OAuthClient | null;
  }

  async create(
    data: Omit<OAuthClient, "id" | "createdAt" | "updatedAt">,
  ): Promise<OAuthClient> {
    return (await prisma.oAuthClient.create({ data })) as OAuthClient;
  }

  async update(id: string, data: Partial<OAuthClient>): Promise<OAuthClient> {
    const updated = (await prisma.oAuthClient.update({
      where: { id },
      data,
    })) as OAuthClient;

    // Invalidate cache
    await cacheDel(`client:${updated.clientId}`);

    return updated;
  }

  async delete(id: string): Promise<void> {
    const client = await prisma.oAuthClient.findUnique({ where: { id } });
    await prisma.oAuthClient.delete({ where: { id } });

    // Invalidate cache
    if (client) {
      await cacheDel(`client:${client.clientId}`);
    }
  }

  async listByTenant(tenantId: string): Promise<OAuthClient[]> {
    return (await prisma.oAuthClient.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    })) as OAuthClient[];
  }
}

// Session Repository
class PostgresSessionRepository implements ISessionRepository {
  async findByToken(token: string): Promise<Session | null> {
    // Try Redis cache first
    const cacheKey = `session:${token}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      const session = JSON.parse(cached);
      session.expires = new Date(session.expires);
      session.createdAt = new Date(session.createdAt);
      session.updatedAt = new Date(session.updatedAt);
      return session as Session;
    }

    // Fallback to database
    const session = (await prisma.session.findUnique({
      where: { sessionToken: token },
    })) as Session | null;

    // Cache until expiry if found
    if (session) {
      const ttl = Math.floor((session.expires.getTime() - Date.now()) / 1000);
      if (ttl > 0) {
        await cacheSet(cacheKey, JSON.stringify(session), ttl);
      }
    }

    return session;
  }

  async create(
    data: Omit<Session, "id" | "createdAt" | "updatedAt">,
  ): Promise<Session> {
    return (await prisma.session.create({ data })) as Session;
  }

  async update(id: string, data: Partial<Session>): Promise<Session> {
    const updated = (await prisma.session.update({
      where: { id },
      data,
    })) as Session;

    // Invalidate cache
    await cacheDel(`session:${updated.sessionToken}`);

    return updated;
  }

  async delete(id: string): Promise<void> {
    const session = await prisma.session.findUnique({ where: { id } });
    await prisma.session.delete({ where: { id } });

    // Invalidate cache
    if (session) {
      await cacheDel(`session:${session.sessionToken}`);
    }
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: { expires: { lt: new Date() } },
    });
    return result.count;
  }
}

// Authorization Code Repository
class PostgresAuthorizationCodeRepository implements IAuthorizationCodeRepository {
  async findByCode(code: string): Promise<AuthorizationCode | null> {
    return (await prisma.authorizationCode.findUnique({
      where: { code },
    })) as AuthorizationCode | null;
  }

  async create(
    data: Omit<AuthorizationCode, "id" | "createdAt" | "used">,
  ): Promise<AuthorizationCode> {
    return (await prisma.authorizationCode.create({
      data,
    })) as AuthorizationCode;
  }

  async markAsUsed(id: string): Promise<void> {
    await prisma.authorizationCode.update({
      where: { id },
      data: { used: true },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.authorizationCode.delete({ where: { id } });
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.authorizationCode.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}

// Access Token Repository
class PostgresAccessTokenRepository implements IAccessTokenRepository {
  async findByToken(token: string): Promise<AccessToken | null> {
    // Try Redis cache first
    const cacheKey = `token:${token}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      const accessToken = JSON.parse(cached);
      accessToken.expiresAt = new Date(accessToken.expiresAt);
      accessToken.createdAt = new Date(accessToken.createdAt);
      return accessToken as AccessToken;
    }

    // Fallback to database
    const accessToken = await prisma.accessToken.findUnique({
      where: { token },
      include: { user: true },
    });

    // Cache until expiry if found and not revoked
    if (accessToken && !accessToken.revoked) {
      const ttl = Math.floor(
        (accessToken.expiresAt.getTime() - Date.now()) / 1000,
      );
      if (ttl > 0) {
        await cacheSet(cacheKey, JSON.stringify(accessToken), ttl);
      }
    }

    return accessToken;
  }

  async create(
    data: Omit<AccessToken, "id" | "createdAt" | "revoked">,
  ): Promise<AccessToken> {
    return (await prisma.accessToken.create({ data })) as AccessToken;
  }

  async revoke(id: string): Promise<void> {
    const token = await prisma.accessToken.findUnique({ where: { id } });
    await prisma.accessToken.update({
      where: { id },
      data: { revoked: true },
    });

    // Invalidate cache
    if (token) {
      await cacheDel(`token:${token.token}`);
    }
  }

  async delete(id: string): Promise<void> {
    const token = await prisma.accessToken.findUnique({ where: { id } });
    await prisma.accessToken.delete({ where: { id } });

    // Invalidate cache
    if (token) {
      await cacheDel(`token:${token.token}`);
    }
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.accessToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  async listByUser(userId: string): Promise<AccessToken[]> {
    return (await prisma.accessToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })) as AccessToken[];
  }
}

// Refresh Token Repository
class PostgresRefreshTokenRepository implements IRefreshTokenRepository {
  async findByToken(token: string): Promise<RefreshToken | null> {
    // Try Redis cache first
    const cacheKey = `refresh:${token}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      const refreshToken = JSON.parse(cached);
      refreshToken.expiresAt = new Date(refreshToken.expiresAt);
      refreshToken.createdAt = new Date(refreshToken.createdAt);
      return refreshToken as RefreshToken;
    }

    // Fallback to database
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    // Cache until expiry if found and not revoked
    if (refreshToken && !refreshToken.revoked) {
      const ttl = Math.floor(
        (refreshToken.expiresAt.getTime() - Date.now()) / 1000,
      );
      if (ttl > 0) {
        await cacheSet(cacheKey, JSON.stringify(refreshToken), ttl);
      }
    }

    return refreshToken;
  }

  async create(
    data: Omit<RefreshToken, "id" | "createdAt" | "revoked">,
  ): Promise<RefreshToken> {
    return (await prisma.refreshToken.create({ data })) as RefreshToken;
  }

  async revoke(id: string): Promise<void> {
    const token = await prisma.refreshToken.findUnique({ where: { id } });
    await prisma.refreshToken.update({
      where: { id },
      data: { revoked: true },
    });

    // Invalidate cache
    if (token) {
      await cacheDel(`refresh:${token.token}`);
    }
  }

  async delete(id: string): Promise<void> {
    const token = await prisma.refreshToken.findUnique({ where: { id } });
    await prisma.refreshToken.delete({ where: { id } });

    // Invalidate cache
    if (token) {
      await cacheDel(`refresh:${token.token}`);
    }
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  async listByUser(userId: string): Promise<RefreshToken[]> {
    return (await prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })) as RefreshToken[];
  }
}

/**
 * PostgreSQL Data Access Implementation
 */
export class PostgresDataAccess implements IDataAccess {
  public readonly tenants: ITenantRepository;
  public readonly users: IUserRepository;
  public readonly oauthClients: IOAuthClientRepository;
  public readonly sessions: ISessionRepository;
  public readonly authorizationCodes: IAuthorizationCodeRepository;
  public readonly accessTokens: IAccessTokenRepository;
  public readonly refreshTokens: IRefreshTokenRepository;

  constructor() {
    this.tenants = new PostgresTenantRepository();
    this.users = new PostgresUserRepository();
    this.oauthClients = new PostgresOAuthClientRepository();
    this.sessions = new PostgresSessionRepository();
    this.authorizationCodes = new PostgresAuthorizationCodeRepository();
    this.accessTokens = new PostgresAccessTokenRepository();
    this.refreshTokens = new PostgresRefreshTokenRepository();
  }
}
