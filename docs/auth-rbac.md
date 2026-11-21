# Authentication and authorization API

Base URL: `/api/v1`. Successful and failed responses use the common envelope
defined by the API interceptor/filter.

Example successful login response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": {
    "message": "Login successful",
    "user": {
      "id": 42,
      "firstName": "Sam",
      "lastName": "Smith",
      "email": "sam@example.com",
      "phone": null,
      "status": "ACTIVE",
      "role": {
        "id": 3,
        "slug": "customer",
        "name": "Customer",
        "loginMethod": "EMAIL",
        "permissions": [
          { "id": 7, "key": "orders.read", "name": "Read orders", "description": null }
        ]
      }
    },
    "permissions": ["orders.read"],
    "tokens": {
      "accessToken": "<jwt>",
      "refreshToken": "<jwt>",
      "tokenType": "Bearer",
      "expiresIn": 900
    }
  },
  "timestamp": "<ISO-8601>",
  "path": "/api/v1/auth/login"
}
```

## Login flow

1. Call `GET /auth/login-options`. The response lists active roles and each
   role's `loginMethod` (`EMAIL` or `PHONE`) and whether public registration is
   enabled.
2. Send `POST /auth/login` with the selected `roleSlug`, `identifier`, and
   `password`. `identifier` is an email or an E.164 phone number according to
   that role's setting.
3. Keep the access token in application memory and send it as
   `Authorization: Bearer <accessToken>`. Do not store either token in
   `localStorage`. The refresh token is single-use and rotated by
   `POST /auth/refresh`; the response contains the replacement token pair.
4. Call `GET /auth/me` to load the current user, the role's available
   permissions (`user.role.permissions`), and this user's selected effective
   permission keys (`permissions`). The effective permission keys are also
   returned by login.
5. To check several permissions and role memberships in one request, call
   `POST /auth/authorization/check`.

### Public authentication endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/auth/login-options` | Active roles and their login method |
| POST | `/auth/login` | Login using role-specific email or phone |
| POST | `/auth/register` | Register only into a role explicitly enabled for self-registration |
| POST | `/auth/refresh` | Rotate refresh token and issue a new token pair |

Example login:

```json
{
  "roleSlug": "customer",
  "identifier": "person@example.com",
  "password": "StrongPass123!"
}
```

Registration additionally requires `roleSlug`, `firstName`, `lastName`, and a
12-128 character password containing uppercase, lowercase, numeric, and special
characters. Send `email` or `phone` as required by the selected role. Email
verification is not used.

### Authenticated self-service endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/auth/me` | Current user and effective permissions |
| POST | `/auth/authorization/check` | Batch-check the current user's permission keys and assigned role |
| POST | `/auth/logout` | Revoke this session |
| POST | `/auth/logout-all` | Revoke all sessions for this user |

Authorization check request:

```json
{
  "permissionKeys": ["orders.read", "orders.update"],
  "roleSlugs": ["courier", "manager"]
}
```

Both arrays are optional, but at least one must contain a value. The response
includes the current role and independent results:

```json
{
  "isSuperAdmin": false,
  "role": { "id": 7, "slug": "courier", "name": "Courier" },
  "permissions": {
    "orders.read": true,
    "orders.update": false
  },
  "roles": {
    "courier": true,
    "manager": false
  }
}
```

The role result represents the user's actual assigned role; being a
super-admin does not mean the user is assigned every other role. A
super-admin's permission checks always return `true`, and `/auth/me` returns
`permissions: ["*"]`.

The `super-admin` role is created and protected by the backend bootstrap; role
creation through the dashboard cannot create another super-admin. Configure
`INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` to seed its first user.

## Dashboard endpoints

All dashboard endpoints require a valid access token. The server re-checks
session status, account status, role status, and active permissions against
the database on each protected request; the frontend's permission checks are
only for presentation and never replace backend authorization.

### Roles

Role endpoints require `roles.manage`; replacing permission assignments
requires both `roles.manage` and `permissions.manage`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/roles` | List roles and assigned permissions |
| GET | `/roles/:id` | Read a role |
| POST | `/roles` | Create a role |
| PATCH | `/roles/:id` | Update name, login method, activity, or registration setting |
| PUT | `/roles/:id/permissions` | Replace a role's permission assignments |
| DELETE | `/roles/:id` | Delete an unused, non-system role |

Create role body:

```json
{
  "slug": "store-manager",
  "name": "Store manager",
  "description": "Manages store operations",
  "loginMethod": "PHONE",
  "selfRegistrationEnabled": false,
  "isActive": true
}
```

Replace role permissions:

```json
{
  "permissionIds": [1, 3, 5]
}
```

A role's login method cannot be changed while any assigned user lacks the
required email or phone. The system super-admin role cannot be disabled,
deleted, or enabled for public registration.

### Permissions

All permission endpoints require `permissions.manage`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/permissions` | List permission definitions |
| GET | `/permissions/:id` | Read a permission |
| POST | `/permissions` | Create a permission key |
| PATCH | `/permissions/:id` | Update its display fields or active state |
| DELETE | `/permissions/:id` | Delete a permission and detach it from roles |

Permission keys are lowercase identifiers such as `orders.read` or
`inventory.update`. Keys are returned from `/auth/me` and can drive Next.js
navigation and button visibility. A newly created key only authorizes backend
routes that explicitly require that key using the server-side permission
decorator.

The frontend can also use the batched authorization endpoint to decide which
controls to display. These checks are only for presentation; protected API
routes still enforce permissions on the backend.

### Dashboard user management

| Method | Path | Required permission | Purpose |
| --- | --- | --- | --- |
| GET | `/users?page=1&limit=20` | `users.read` | List users (limit is capped at 100) |
| GET | `/users/:id` | `users.read` | Read a user, role permission options, and that user's selected permissions |
| POST | `/users` | `users.create`, `users.assign-role`, and `users.permissions.manage` | Create an active user, assign one role, and select a subset of its permissions |
| PATCH | `/users/:id` | `users.update` | Update profile, password, or account status |
| PUT | `/users/:id/permissions` | `users.permissions.manage` | Replace that user's selected permissions |

Example create user request:

```json
{
  "firstName": "Rana",
  "lastName": "Saleh",
  "email": "rana@example.com",
  "password": "StrongPass123!",
  "roleId": 4,
  "permissionIds": [2, 5]
}
```

The role's permissions are the **allowed permission options**, not automatic
grants. A user receives only the explicitly selected `permissionIds`, and
those IDs must be active and assigned to that user's role. Send
`"permissionIds": []` to create the account with no permissions. Two users
with the same role may therefore have different permissions.

Role assignments are stored in the separate `user_roles` table, not in
`users`. Its unique `userId` constraint currently enforces one role per user;
`roleId` in the API request is only the assignment input.

`GET /roles/:id` provides the role's available permission options.
`GET /users/:id` returns both `role.permissions` (available options) and
`permissions` (the user's selected permissions). In `GET /auth/me`, `role`
includes available role permissions and the top-level `permissions` field
contains only this user's effective permission keys.

To replace a user's selected permissions:

```json
{
  "permissionIds": [2, 5]
}
```

The role-specific permission validator applies to both user creation and the
replace-permissions endpoint. Changing a user's role clears the old
user-specific selection; select new permissions with `PUT /users/:id/permissions`.
Changing a user's role, identifier, password, or status revokes all their
active sessions. Only a super administrator can assign or modify a
super-admin account or assign a role that grants user-management permissions.

## Permission enforcement

Use the `@RequirePermissions('resource.action')` decorator on each protected
backend handler together with the access-token and permissions guards. The
seeded management permissions are `roles.manage`, `permissions.manage`,
`users.read`, `users.create`, `users.update`, `users.assign-role`, and
`users.permissions.manage`. The super-admin role is created by bootstrap and
can manage all guarded routes.

## Database and bootstrap

Schema synchronization is disabled. In development, the application applies
the migration on startup. In production, apply it as a deployment step before
starting the application:

```powershell
npm run migration:run
```

The development startup migration list includes the migrations for
user-specific permissions and moving role assignments into `user_roles`.
Apply all pending migrations before starting a production instance.

To create the first dashboard administrator, provide
`INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` in the process environment
before the first start. Optional name variables are
`INITIAL_ADMIN_FIRST_NAME` and `INITIAL_ADMIN_LAST_NAME`. Keep these values
outside source control and use a unique, high-entropy password. The bootstrap
does not overwrite an existing account's password or role.

Configure `CORS_ORIGINS` as a comma-separated allowlist of frontend origins.
The throttler currently uses per-process memory; deployments with multiple
instances should configure a shared throttling store.

`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be different values of at
least 32 bytes. `JWT_ACCESS_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN` accept
seconds as an integer or durations such as `15m` and `7d`; refresh lifetime
must exceed access lifetime.
