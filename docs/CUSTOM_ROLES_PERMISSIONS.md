# Custom Roles and Permissions System

This document describes the custom roles and permissions system in PrismAuth, which allows administrators to create fine-grained access control for their applications.

## Overview

PrismAuth now supports:

1. **Custom Roles**: Admin-created roles beyond the default "user" and "admin"
2. **Application Permissions**: Per-application permission sets assigned to custom roles
3. **Flexible Permission Model**: Support for both common and custom permission strings
4. **User Role Assignment**: Users can have both a system role and a custom role

## Database Schema

### CustomRole Model

```prisma
model CustomRole {
  id          String   @id @default(cuid())
  name        String
  description String?
  isActive    Boolean  @default(true)
  tenantId    String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  users       User[]
  permissions RolePermission[]

  @@unique([name, tenantId])
  @@index([tenantId])
}
```

### RolePermission Model

```prisma
model RolePermission {
  id              String   @id @default(cuid())
  roleId          String
  applicationId   String
  permissions     String[] // Array of permission strings
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  role        CustomRole  @relation(fields: [roleId], references: [id], onDelete: Cascade)
  application OAuthClient @relation(fields: [applicationId], references: [id], onDelete: Cascade)

  @@unique([roleId, applicationId])
  @@index([roleId])
  @@index([applicationId])
}
```

### User Model Updates

```prisma
model User {
  // ... existing fields
  customRoleId String?
  customRole   CustomRole? @relation(fields: [customRoleId], references: [id], onDelete: SetNull)

  @@index([customRoleId])
}
```

## Permission Model

### Common Permissions

PrismAuth provides a set of common permission strings that cover typical use cases:

- `read` - View resources
- `write` - Create/modify resources
- `delete` - Delete resources
- `admin` - Full administrative access
- `create` - Create new resources
- `update` - Modify existing resources
- `manage` - Manage resources (between write and admin)
- `view` - Read-only access

### Custom Permissions

Administrators can define custom permission strings specific to their applications:

- `reports:generate` - Generate reports
- `users:impersonate` - Impersonate users
- `billing:manage` - Manage billing
- `settings:configure` - Configure settings
- Any other application-specific permission

### Permission Arrays

Each role can have multiple permissions for each application. Permissions are stored as string arrays and can be checked individually or in combination.

## API Endpoints

### Role Management

#### GET /api/admin/roles

List all custom roles in the tenant.

**Response:**

```json
[
  {
    "id": "role-id",
    "name": "Developer",
    "description": "Access for developers",
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z",
    "_count": {
      "users": 5,
      "permissions": 3
    }
  }
]
```

#### POST /api/admin/roles

Create a new custom role.

**Request:**

```json
{
  "name": "Developer",
  "description": "Access for developers"
}
```

**Response:**

```json
{
  "id": "role-id",
  "name": "Developer",
  "description": "Access for developers",
  "isActive": true,
  "tenantId": "tenant-id",
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z",
  "_count": {
    "users": 0,
    "permissions": 0
  }
}
```

#### GET /api/admin/roles/[id]

Get a specific role with its permissions.

**Response:**

```json
{
  "id": "role-id",
  "name": "Developer",
  "description": "Access for developers",
  "isActive": true,
  "permissions": [
    {
      "id": "perm-id",
      "permissions": ["read", "write", "create"],
      "application": {
        "id": "app-id",
        "name": "My App",
        "clientId": "client-123"
      },
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "_count": {
    "users": 5
  }
}
```

#### PATCH /api/admin/roles/[id]

Update a role.

**Request:**

```json
{
  "name": "Senior Developer",
  "description": "Updated description",
  "isActive": false
}
```

#### DELETE /api/admin/roles/[id]

Delete a role (only if no users are assigned).

**Response:**

```json
{
  "success": true
}
```

### Permission Management

#### POST /api/admin/roles/[id]/permissions

Set permissions for a role on an application.

**Request:**

```json
{
  "applicationId": "app-id",
  "permissions": ["read", "write", "create", "custom:permission"]
}
```

**Response:**

```json
{
  "id": "perm-id",
  "roleId": "role-id",
  "applicationId": "app-id",
  "permissions": ["read", "write", "create", "custom:permission"],
  "application": {
    "id": "app-id",
    "name": "My App",
    "clientId": "client-123"
  },
  "createdAt": "2025-01-01T00:00:00Z"
}
```

#### GET /api/admin/roles/[id]/permissions

Get all permissions for a role.

**Response:**

```json
[
  {
    "id": "perm-id",
    "permissions": ["read", "write"],
    "application": {
      "id": "app-id",
      "name": "My App",
      "clientId": "client-123"
    },
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

#### DELETE /api/admin/roles/[id]/permissions/[applicationId]

Remove all permissions for a role on an application.

**Response:**

```json
{
  "success": true
}
```

### User Management Updates

#### POST /api/admin/users

Create user with optional custom role.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "user",
  "customRoleId": "role-id",
  "requirePasswordChange": false
}
```

#### PATCH /api/admin/users/[id]

Update user role or custom role.

**Request:**

```json
{
  "role": "admin",
  "customRoleId": "role-id"
}
```

To remove a custom role:

```json
{
  "customRoleId": null
}
```

## User Interface

### Admin Roles Page (`/admin/roles`)

The roles management page allows administrators to:

1. **View all custom roles** with user and permission counts
2. **Create new roles** with name and description
3. **Delete roles** (only if no users assigned)
4. **Navigate to role details** to manage permissions

#### Features:

- Active/inactive status badges
- User count display
- Permission count display
- Quick access to permission management
- Delete protection for roles in use

### Role Permissions Page (`/admin/roles/[id]`)

The role permissions detail page allows administrators to:

1. **View role information** and user count
2. **See all application permissions** for the role
3. **Add new permissions** for applications
4. **Edit existing permissions** by removing and re-adding
5. **Remove permissions** for specific applications

#### Add Permissions Dialog:

- **Application selector** (only shows apps without permissions for this role)
- **Common permissions checkboxes** (read, write, delete, admin, etc.)
- **Custom permission input** for application-specific permissions
- **Selected permissions display** with click-to-remove
- Permission upsert (updates if exists, creates if new)

### Admin Users Page Updates

The users management page now includes:

1. **Custom Role column** in the user table
2. **Custom Role selector** for each user (dropdown with all active roles)
3. **Custom Role field** in create user dialog
4. **Separate System Role and Custom Role** management

## Use Cases

### Example 1: Developer Role

Create a "Developer" role with specific permissions:

1. Navigate to Admin > Roles
2. Click "Create Role"
3. Name: "Developer", Description: "Developer access"
4. Click "Manage Permissions"
5. Add permissions for "API Gateway":
   - read, write, create, update
6. Add permissions for "Admin Panel":
   - read, view
7. Assign users to the "Developer" role

### Example 2: Billing Manager Role

Create a role for managing billing:

1. Create role "Billing Manager"
2. Add permissions for "Billing System":
   - read, write, billing:manage, billing:refund
3. Add permissions for "Reports":
   - read, view, reports:generate
4. Assign to billing team members

### Example 3: Support Agent Role

Create a support role with limited access:

1. Create role "Support Agent"
2. Add permissions for "Customer Portal":
   - read, view, tickets:respond
3. Add permissions for "Documentation":
   - read, view, docs:edit
4. Assign to support staff

## Permission Checking

When an application needs to verify permissions, it can:

1. Request user information from PrismAuth OAuth2 flow
2. Receive user's custom role and permissions in the token
3. Check if user has required permission for the application
4. Grant or deny access based on permissions

### Example Token Payload

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "user",
  "customRole": {
    "id": "role-id",
    "name": "Developer"
  },
  "permissions": {
    "app-id": ["read", "write", "create", "update"]
  }
}
```

## Best Practices

### Role Design

1. **Keep roles focused**: Each role should represent a clear job function
2. **Use descriptive names**: "Developer", "Billing Manager", "Support Agent" vs "Role1", "Role2"
3. **Document purposes**: Always add descriptions to explain role intent
4. **Review regularly**: Audit roles and permissions periodically

### Permission Design

1. **Start with common permissions**: Use read, write, delete, admin for standard access
2. **Add custom permissions sparingly**: Only when common permissions don't fit
3. **Use namespacing**: For custom permissions, use format "resource:action" (e.g., "billing:refund")
4. **Be specific**: Prefer "users:create" over "users:manage"

### User Assignment

1. **System role vs Custom role**:
   - System role (user/admin) controls PrismAuth access
   - Custom role controls application-specific permissions
2. **Don't over-assign**: Users should only have the minimum required access
3. **Regular audits**: Review user role assignments periodically
4. **Document decisions**: Note why users have specific roles

### Application Integration

1. **Request minimal permissions**: Only check for permissions your app needs
2. **Handle missing permissions gracefully**: Show appropriate error messages
3. **Cache permission lookups**: Don't query on every request
4. **Log permission checks**: Audit who accessed what

## Security Considerations

### Role Management

- Only admins can create, modify, or delete roles
- Role names must be unique within a tenant
- Inactive roles can be reactivated
- Deleting a role requires no users be assigned

### Permission Assignment

- Permissions are tenant-isolated
- Applications must exist in the same tenant
- Permission changes take effect immediately
- No permission inheritance (explicit only)

### User Assignment

- Users can have one custom role at a time
- Changing system role doesn't affect custom role
- Setting customRoleId to null removes custom role
- Custom role deleted = users lose custom permissions

## Migration

The database migration `20251120234137_2` adds the required tables and relationships:

```sql
-- Create CustomRole table
CREATE TABLE "CustomRole" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "tenantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP,
  UNIQUE("name", "tenantId")
);

-- Create RolePermission table
CREATE TABLE "RolePermission" (
  "id" TEXT PRIMARY KEY,
  "roleId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "permissions" TEXT[],
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP,
  UNIQUE("roleId", "applicationId")
);

-- Add customRoleId to User table
ALTER TABLE "User" ADD COLUMN "customRoleId" TEXT;

-- Add foreign keys and indexes
-- (automatically handled by Prisma)
```

Existing data is not affected. All users will have `customRoleId = null` initially.

## Future Enhancements

Potential improvements for future versions:

- **Permission groups**: Bundle related permissions together
- **Role templates**: Pre-configured role templates for common scenarios
- **Role hierarchy**: Parent-child role relationships
- **Permission inheritance**: Roles can inherit from other roles
- **Time-based permissions**: Temporary permission grants
- **Conditional permissions**: Permissions based on conditions
- **Permission audit log**: Track all permission changes
- **Bulk user assignment**: Assign role to multiple users at once
- **Role cloning**: Duplicate existing roles
- **Permission testing**: Test what a user can access before assigning

## Troubleshooting

### Cannot delete role

**Issue**: "Cannot delete role that is assigned to users"  
**Solution**: Remove the role from all users first, then delete

### Permission not working

**Issue**: User has role but permission check fails  
**Solution**: Verify application ID matches between role permission and application

### Role name conflict

**Issue**: "Role with this name already exists"  
**Solution**: Choose a unique name within your tenant

### Custom role not showing

**Issue**: Custom role doesn't appear in dropdowns  
**Solution**: Ensure role is set to isActive = true
