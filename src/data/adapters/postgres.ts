/**
 * PostgreSQL Adapter using Prisma
 *
 * Implementation of the data abstraction layer for PostgreSQL
 */

import { prisma } from "@/lib/db";
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
    return (await prisma.oAuthClient.findUnique({
      where: { clientId },
    })) as OAuthClient | null;
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
    return (await prisma.oAuthClient.update({
      where: { id },
      data,
    })) as OAuthClient;
  }

  async delete(id: string): Promise<void> {
    await prisma.oAuthClient.delete({ where: { id } });
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
    return (await prisma.session.findUnique({
      where: { sessionToken: token },
    })) as Session | null;
  }

  async create(
    data: Omit<Session, "id" | "createdAt" | "updatedAt">,
  ): Promise<Session> {
    return (await prisma.session.create({ data })) as Session;
  }

  async update(id: string, data: Partial<Session>): Promise<Session> {
    return (await prisma.session.update({ where: { id }, data })) as Session;
  }

  async delete(id: string): Promise<void> {
    await prisma.session.delete({ where: { id } });
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: { expires: { lt: new Date() } },
    });
    return result.count;
  }
}

// Authorization Code Repository
class PostgresAuthorizationCodeRepository
  implements IAuthorizationCodeRepository
{
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
    return await prisma.accessToken.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async create(
    data: Omit<AccessToken, "id" | "createdAt" | "revoked">,
  ): Promise<AccessToken> {
    return (await prisma.accessToken.create({ data })) as AccessToken;
  }

  async revoke(id: string): Promise<void> {
    await prisma.accessToken.update({
      where: { id },
      data: { revoked: true },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.accessToken.delete({ where: { id } });
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
    return await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async create(
    data: Omit<RefreshToken, "id" | "createdAt" | "revoked">,
  ): Promise<RefreshToken> {
    return (await prisma.refreshToken.create({ data })) as RefreshToken;
  }

  async revoke(id: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { revoked: true },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.refreshToken.delete({ where: { id } });
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
