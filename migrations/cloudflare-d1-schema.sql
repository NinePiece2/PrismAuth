-- Cloudflare D1 Database Schema
-- SQLite syntax for PrismAuth

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  settings TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);

-- Custom Roles table
CREATE TABLE IF NOT EXISTS custom_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  tenantId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_roles_name_tenant ON custom_roles(name, tenantId);
CREATE INDEX IF NOT EXISTS idx_custom_roles_tenant ON custom_roles(tenantId);

-- Role Permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY,
  roleId TEXT NOT NULL,
  applicationId TEXT NOT NULL,
  permissions TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (roleId) REFERENCES custom_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (applicationId) REFERENCES oauth_clients(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_role_app ON role_permissions(roleId, applicationId);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(roleId);
CREATE INDEX IF NOT EXISTS idx_role_permissions_app ON role_permissions(applicationId);

-- Password Reset Tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  userId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  expires TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(userId);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  emailVerified TEXT,
  password TEXT NOT NULL,
  name TEXT,
  image TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  customRoleId TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  requirePasswordChange INTEGER NOT NULL DEFAULT 0,
  requireMfaSetup INTEGER NOT NULL DEFAULT 0,
  mfaEnabled INTEGER NOT NULL DEFAULT 0,
  mfaSecret TEXT,
  mfaBackupCodes TEXT NOT NULL DEFAULT '[]',
  tenantId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (customRoleId) REFERENCES custom_roles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_tenant ON users(email, tenantId);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenantId);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_custom_role ON users(customRoleId);

-- OAuth Clients table
CREATE TABLE IF NOT EXISTS oauth_clients (
  id TEXT PRIMARY KEY,
  clientId TEXT NOT NULL UNIQUE,
  clientSecret TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  redirectUris TEXT NOT NULL,
  allowedScopes TEXT NOT NULL,
  grantTypes TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oauth_clients_tenant ON oauth_clients(tenantId);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(clientId);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  sessionToken TEXT NOT NULL UNIQUE,
  userId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  expires TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenantId);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(sessionToken);

-- Authorization Codes table
CREATE TABLE IF NOT EXISTS authorization_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  clientId TEXT NOT NULL,
  userId TEXT NOT NULL,
  redirectUri TEXT NOT NULL,
  scope TEXT NOT NULL, -- JSON array stored as TEXT
  expiresAt TEXT NOT NULL,
  codeChallenge TEXT,
  codeChallengeMethod TEXT,
  createdAt TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (clientId) REFERENCES oauth_clients(clientId) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_code ON authorization_codes(code);
CREATE INDEX IF NOT EXISTS idx_auth_codes_client ON authorization_codes(clientId);
CREATE INDEX IF NOT EXISTS idx_auth_codes_user ON authorization_codes(userId);
CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON authorization_codes(expiresAt);

-- Access Tokens table
CREATE TABLE IF NOT EXISTS access_tokens (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  clientId TEXT NOT NULL,
  userId TEXT NOT NULL,
  scope TEXT NOT NULL, -- JSON array stored as TEXT
  expiresAt TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (clientId) REFERENCES oauth_clients(clientId) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_access_tokens_token ON access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_access_tokens_client ON access_tokens(clientId);
CREATE INDEX IF NOT EXISTS idx_access_tokens_user ON access_tokens(userId);
CREATE INDEX IF NOT EXISTS idx_access_tokens_expires ON access_tokens(expiresAt);

-- Refresh Tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  clientId TEXT NOT NULL,
  userId TEXT NOT NULL,
  scope TEXT NOT NULL, -- JSON array stored as TEXT
  expiresAt TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (clientId) REFERENCES oauth_clients(clientId) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_client ON refresh_tokens(clientId);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(userId);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expiresAt);
