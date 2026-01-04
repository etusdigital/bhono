# API Catalog - BHono Platform

> Complete REST API endpoint documentation with OpenAPI 3.0 support.

## Overview

| Attribute | Value | Confidence |
|-----------|-------|------------|
| **Base URL** | `/api` (authenticated), `/auth` (public) | HIGH |
| **Format** | REST/JSON | HIGH |
| **Documentation** | OpenAPI 3.0 at `/api/doc` | HIGH |
| **Swagger UI** | Available at `/api/swagger` | HIGH |
| **Total Endpoints** | 30 | HIGH |

## Authentication

All `/api/*` endpoints require authentication via session cookie (`__Host-sid`).

| Header/Cookie | Purpose |
|---------------|---------|
| `Cookie: __Host-sid=<session_id>` | Session authentication |
| `X-Account-Id` | Multi-tenant account context |

---

## Auth Endpoints [HIGH]

Base path: `/auth`

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| `GET` | `/auth/login` | Initiate Google OAuth flow | No |
| `GET` | `/auth/callback` | OAuth callback handler | No |
| `POST` | `/auth/logout` | Destroy session | Yes |
| `GET` | `/auth/me` | Get current user info | Yes |
| `POST` | `/auth/refresh` | Refresh session token | Yes |
| `GET` | `/auth/invite/{token}` | Get invitation details | No |

### GET /auth/login

Initiates Google OAuth 2.0 authorization flow.

**Response**: Redirect to Google OAuth consent screen

```
302 Found
Location: https://accounts.google.com/o/oauth2/v2/auth?...
```

### GET /auth/callback

Handles OAuth callback from Google.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Authorization code from Google |
| `state` | string | CSRF state token |

**Response**: Redirect to dashboard with session cookie set

### POST /auth/logout

Destroys the current session.

**Response**:
```json
{
  "success": true
}
```

### GET /auth/me

Returns current authenticated user information.

**Response**:
```json
{
  "id": "01234567-89ab-cdef-0123-456789abcdef",
  "email": "user@example.com",
  "name": "John Doe",
  "avatarUrl": "https://...",
  "isSuperAdmin": false,
  "accounts": [
    {
      "id": "account-uuid",
      "name": "My Workspace",
      "role": "ADMIN"
    }
  ]
}
```

### POST /auth/refresh

Refreshes the session token.

**Response**:
```json
{
  "success": true,
  "expiresAt": "2025-01-15T12:00:00Z"
}
```

### GET /auth/invite/{token}

Gets invitation details for acceptance page.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | Invitation token |

**Response**:
```json
{
  "id": "invitation-uuid",
  "email": "invitee@example.com",
  "accountName": "Workspace Name",
  "inviterName": "John Doe",
  "role": "EDITOR",
  "expiresAt": "2025-01-20T12:00:00Z"
}
```

---

## Users Endpoints [HIGH]

Base path: `/api/users`

| Method | Path | Description | Auth | Permission |
|--------|------|-------------|------|------------|
| `GET` | `/api/users` | List users (paginated) | Yes | VIEWER+ |
| `GET` | `/api/users/{id}` | Get user by ID | Yes | VIEWER+ |
| `POST` | `/api/users` | Create user | Yes | ADMIN |
| `PATCH` | `/api/users/{id}` | Update user | Yes | ADMIN |
| `DELETE` | `/api/users/{id}` | Soft delete user | Yes | ADMIN |
| `POST` | `/api/users/{id}/restore` | Restore deleted user | Yes | ADMIN |
| `GET` | `/api/users/{id}/accounts` | Get user's accounts | Yes | VIEWER+ |
| `POST` | `/api/users/bulk/accounts` | Bulk add to accounts | Yes | ADMIN |

### GET /api/users

List users with pagination.

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `search` | string | - | Search by name/email |
| `status` | string | - | Filter by status |

**Response**:
```json
{
  "data": [
    {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### POST /api/users

Create a new user.

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "name": "New User",
  "role": "EDITOR"
}
```

**Response**: `201 Created`
```json
{
  "id": "new-user-uuid",
  "email": "newuser@example.com",
  "name": "New User",
  "status": "active",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### PATCH /api/users/{id}

Update user properties.

**Request Body**:
```json
{
  "name": "Updated Name",
  "status": "inactive"
}
```

### DELETE /api/users/{id}

Soft delete a user (sets `deleted_at`).

**Response**: `204 No Content`

### POST /api/users/{id}/restore

Restore a soft-deleted user.

**Response**: `200 OK`

---

## Accounts Endpoints [HIGH]

Base path: `/api/accounts`

| Method | Path | Description | Auth | Permission |
|--------|------|-------------|------|------------|
| `GET` | `/api/accounts` | List accounts | Yes | VIEWER+ |
| `GET` | `/api/accounts/{id}` | Get account | Yes | VIEWER+ |
| `POST` | `/api/accounts` | Create account | Yes | Auth only |
| `PATCH` | `/api/accounts/{id}` | Update account | Yes | ADMIN |
| `DELETE` | `/api/accounts/{id}` | Soft delete account | Yes | ADMIN |
| `POST` | `/api/accounts/{id}/restore` | Restore account | Yes | ADMIN |

### GET /api/accounts

List accounts the current user has access to.

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page |

**Response**:
```json
{
  "data": [
    {
      "id": "account-uuid",
      "name": "My Workspace",
      "description": "Team workspace",
      "domain": "myworkspace",
      "memberCount": 5,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

### POST /api/accounts

Create a new account (workspace).

**Request Body**:
```json
{
  "name": "New Workspace",
  "description": "Description of the workspace",
  "domain": "new-workspace"
}
```

**Response**: `201 Created`

---

## Invitations Endpoints [HIGH]

Base path: `/api/invitations`

| Method | Path | Description | Auth | Permission |
|--------|------|-------------|------|------------|
| `POST` | `/api/invitations` | Send invitation | Yes | MANAGER+ |
| `GET` | `/api/invitations` | List invitations | Yes | MANAGER+ |
| `DELETE` | `/api/invitations/{id}` | Revoke invitation | Yes | MANAGER+ |

### POST /api/invitations

Send a team invitation email.

**Request Body**:
```json
{
  "email": "newmember@example.com",
  "role": "EDITOR",
  "accountId": "account-uuid"
}
```

**Response**: `201 Created`
```json
{
  "id": "invitation-uuid",
  "email": "newmember@example.com",
  "role": "EDITOR",
  "status": "pending",
  "expiresAt": "2025-01-08T00:00:00Z"
}
```

### GET /api/invitations

List pending invitations for an account.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `accountId` | string | Filter by account |
| `status` | string | Filter by status (pending, accepted, expired) |

### DELETE /api/invitations/{id}

Revoke a pending invitation.

**Response**: `204 No Content`

---

## Audits Endpoints [HIGH]

Base path: `/api/audits`

| Method | Path | Description | Auth | Permission |
|--------|------|-------------|------|------------|
| `GET` | `/api/audits` | List audit logs | Yes | ANALYTICS/ADMIN |

### GET /api/audits

Query audit logs with filtering.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `limit` | integer | Items per page |
| `action` | string | Filter by action (CREATE, UPDATE, DELETE, LOGIN, LOGOUT) |
| `resourceType` | string | Filter by resource type |
| `resourceId` | string | Filter by resource ID |
| `userId` | string | Filter by user ID |
| `startDate` | string | Filter from date (ISO 8601) |
| `endDate` | string | Filter to date (ISO 8601) |

**Response**:
```json
{
  "data": [
    {
      "id": "audit-uuid",
      "action": "UPDATE",
      "resourceType": "user",
      "resourceId": "user-uuid",
      "userId": "actor-uuid",
      "changes": {
        "before": { "name": "Old Name" },
        "after": { "name": "New Name" }
      },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "transactionId": "txn-uuid",
      "createdAt": "2025-01-01T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## Storage Endpoints [HIGH]

Base path: `/api/storage`

| Method | Path | Description | Auth | Permission |
|--------|------|-------------|------|------------|
| `POST` | `/api/storage/upload-url` | Get presigned upload URL | Yes | AUTHOR+ |
| `PUT` | `/api/storage/upload/{key}` | Upload file directly | Yes | AUTHOR+ |
| `DELETE` | `/api/storage/{key}` | Delete file | Yes | EDITOR+ |

### POST /api/storage/upload-url

Generate a presigned URL for client-side upload.

**Request Body**:
```json
{
  "filename": "document.pdf",
  "contentType": "application/pdf",
  "size": 1048576
}
```

**Response**:
```json
{
  "uploadUrl": "https://r2.cloudflarestorage.com/...",
  "key": "accounts/uuid/files/uuid/document.pdf",
  "expiresAt": "2025-01-01T12:15:00Z"
}
```

### PUT /api/storage/upload/{key}

Direct file upload (alternative to presigned URL).

**Headers**:
- `Content-Type`: File MIME type
- `Content-Length`: File size in bytes

**Response**: `200 OK`
```json
{
  "key": "accounts/uuid/files/uuid/document.pdf",
  "url": "https://storage.example.com/...",
  "size": 1048576
}
```

### DELETE /api/storage/{key}

Delete a file from R2 storage.

**Response**: `204 No Content`

---

## Health Endpoints [HIGH]

Base path: `/health`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/health` | Basic health check | No |
| `GET` | `/health/ready` | Readiness probe | No |
| `GET` | `/health/live` | Liveness probe | No |

### GET /health

Basic health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### GET /health/ready

Kubernetes readiness probe - checks database connectivity.

**Response**:
```json
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "kv": "ok"
  }
}
```

### GET /health/live

Kubernetes liveness probe - basic process health.

**Response**:
```json
{
  "status": "alive"
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `204` | No Content |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized (not authenticated) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found |
| `409` | Conflict (duplicate resource) |
| `429` | Too Many Requests (rate limited) |
| `500` | Internal Server Error |

### Common Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request body/params failed validation |
| `UNAUTHORIZED` | No valid session |
| `FORBIDDEN` | Insufficient role/permissions |
| `NOT_FOUND` | Resource doesn't exist |
| `DUPLICATE_EMAIL` | Email already registered |
| `INVITATION_EXPIRED` | Invitation token expired |
| `RATE_LIMITED` | Too many requests |

---

## Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Auth endpoints | 10 req | 1 minute |
| API endpoints | 100 req | 1 minute |
| Upload endpoints | 20 req | 1 minute |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704110400
```

---

## OpenAPI Specification

Full OpenAPI 3.0 specification available at:

- **JSON**: `GET /api/doc`
- **Swagger UI**: `GET /api/swagger`

The specification includes:
- All request/response schemas (Zod-generated)
- Authentication requirements
- Example requests and responses
- Error schemas
