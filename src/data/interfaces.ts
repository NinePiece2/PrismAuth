/**
 * Data Abstraction Layer - Repository Interfaces
 *
 * These interfaces define the contract for data operations.
 * Implementations can use PostgreSQL, Cloudflare D1, MySQL, etc.
 */

// Core types
export interface Tenant {
  id: string;
  name: string;
  domain: string;
  settings?: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  emailVerified?: Date;
  password: string;
  name?: string;
  image?: string;
  role: string;
  isActive: boolean;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthClient {
  id: string;
  clientId: string;
  clientSecret: string;
  name: string;
  description?: string;
  redirectUris: string[];
  allowedScopes: string[];
  grantTypes: string[];
  tenantId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  sessionToken: string;
  userId: string;
  tenantId: string;
  expires: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthorizationCode {
  id: string;
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string[];
  expiresAt: Date;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  createdAt: Date;
  used: boolean;
}

export interface AccessToken {
  id: string;
  token: string;
  clientId: string;
  userId: string;
  scope: string[];
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}

export interface RefreshToken {
  id: string;
  token: string;
  clientId: string;
  userId: string;
  scope: string[];
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}

// Repository Interfaces

export interface ITenantRepository {
  findByDomain(domain: string): Promise<Tenant | null>;
  findById(id: string): Promise<Tenant | null>;
  create(data: Omit<Tenant, "id" | "createdAt" | "updatedAt">): Promise<Tenant>;
  update(id: string, data: Partial<Tenant>): Promise<Tenant>;
  delete(id: string): Promise<void>;
  list(): Promise<Tenant[]>;
}

export interface IUserRepository {
  findByEmail(email: string, tenantId: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
  listByTenant(tenantId: string): Promise<User[]>;
}

export interface IOAuthClientRepository {
  findByClientId(clientId: string): Promise<OAuthClient | null>;
  findById(id: string): Promise<OAuthClient | null>;
  create(
    data: Omit<OAuthClient, "id" | "createdAt" | "updatedAt">,
  ): Promise<OAuthClient>;
  update(id: string, data: Partial<OAuthClient>): Promise<OAuthClient>;
  delete(id: string): Promise<void>;
  listByTenant(tenantId: string): Promise<OAuthClient[]>;
}

export interface ISessionRepository {
  findByToken(token: string): Promise<Session | null>;
  create(
    data: Omit<Session, "id" | "createdAt" | "updatedAt">,
  ): Promise<Session>;
  update(id: string, data: Partial<Session>): Promise<Session>;
  delete(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
}

export interface IAuthorizationCodeRepository {
  findByCode(code: string): Promise<AuthorizationCode | null>;
  create(
    data: Omit<AuthorizationCode, "id" | "createdAt">,
  ): Promise<AuthorizationCode>;
  markAsUsed(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
}

export interface IAccessTokenRepository {
  findByToken(token: string): Promise<AccessToken | null>;
  create(data: Omit<AccessToken, "id" | "createdAt">): Promise<AccessToken>;
  revoke(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
  listByUser(userId: string): Promise<AccessToken[]>;
}

export interface IRefreshTokenRepository {
  findByToken(token: string): Promise<RefreshToken | null>;
  create(data: Omit<RefreshToken, "id" | "createdAt">): Promise<RefreshToken>;
  revoke(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  deleteExpired(): Promise<number>;
  listByUser(userId: string): Promise<RefreshToken[]>;
}

/**
 * Main Data Access Interface
 * Provides access to all repositories
 */
export interface IDataAccess {
  tenants: ITenantRepository;
  users: IUserRepository;
  oauthClients: IOAuthClientRepository;
  sessions: ISessionRepository;
  authorizationCodes: IAuthorizationCodeRepository;
  accessTokens: IAccessTokenRepository;
  refreshTokens: IRefreshTokenRepository;
}
