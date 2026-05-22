# API Catalog - BHono Platform

> Current API surface after the `@etus/auth` integration.

## Overview

| Attribute | Value |
|-----------|-------|
| Auth owner | `@etus/auth` |
| App-owned API base | `/api` |
| Package-owned bases | `/auth`, `/auth/admin`, `/accounts`, `/invitations`, `/audit` |
| OpenAPI JSON | `/api/doc` |
| Swagger UI | `/api/swagger` |

Package-owned routes are not re-declared under `/api/*`. The boilerplate keeps
`/api/*` for product-specific endpoints such as storage.

## Authentication

`@etus/auth` issues an HTTP-only session cookie backed by KV and D1. Browser
code should call package routes with `credentials: 'include'`; it should not
store tokens in `localStorage` or `sessionStorage`.

State-changing browser requests must include a trusted `Origin`/`Referer`; JSON
endpoints must also use JSON content type. The boilerplate intentionally does
not send a decorative CSRF token header.

## Auth Routes

Base path: `/auth`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/auth/login` | Start ETUS gateway OAuth flow | No |
| `GET` | `/auth/callback` | OAuth callback; creates/updates user session | No |
| `POST` | `/auth/logout` | Destroy session and clear cookie | Yes |
| `GET` | `/auth/me` | Return `{ user }` with package user shape | Yes |
| `POST` | `/auth/test-login` | Localhost-only E2E/dev session helper | Loopback only |

`/auth/me` response:

```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name",
    "picture": null,
    "role": "admin"
  }
}
```

## Admin User Routes

Base path: `/auth/admin`

These routes require `auth_users.role === "admin"` in the current
`@etus/auth@0.3.0` package implementation.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/admin/users` | List users; returns `{ users, total }` |
| `GET` | `/auth/admin/users/:id` | Get a user |
| `POST` | `/auth/admin/users/invite` | Create pending product user |
| `POST` | `/auth/admin/users/:id/approve` | Approve pending user |
| `POST` | `/auth/admin/users/:id/deny` | Deny pending user |
| `PATCH` | `/auth/admin/users/:id` | Update role/status |
| `DELETE` | `/auth/admin/users/:id` | Delete user and invalidate sessions |

## Account Routes

Base path: `/accounts`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/accounts` | List current user's accounts; returns `{ accounts }` |
| `POST` | `/accounts` | Create account; creator membership role is `admin` |
| `GET` | `/accounts/:id` | Return `{ account, membership }` |
| `PATCH` | `/accounts/:id` | Update account; owner only |
| `DELETE` | `/accounts/:id` | Delete account; owner only |
| `GET` | `/accounts/:id/members` | List active members; returns `{ members }` |
| `POST` | `/accounts/:id/members/invite` | Create pending invitation |
| `PATCH` | `/accounts/:id/members/:userId` | Update membership role |
| `DELETE` | `/accounts/:id/members/:userId` | Remove member |
| `GET` | `/accounts/:id/invitations` | List pending invitations |
| `DELETE` | `/accounts/:id/invitations/:invitationId` | Revoke invitation |

Account membership roles accepted by the boilerplate are:

```txt
admin | member | guest
```

`owner` is a product-level role, not an account membership role. The
compatibility guard in `src/server/auth/package-compat.ts` enforces this before
the package route runs.

## Invitation Routes

Base path: `/invitations`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/invitations/:token/accept` | Accept pending account invitation |

The current package persists invitations but does not send invitation emails.
Email delivery must be added in `@etus/auth` or via a package-supported hook
before products rely on invitation delivery.

## Audit Routes

Base path: `/audit`

These routes require `auth_users.role === "admin"` in the current package.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/audit/logs` | Query logs; returns `{ logs, total }` |
| `POST` | `/audit/cleanup` | Delete logs older than retention window |

Supported query parameters for `/audit/logs`:

| Parameter | Description |
|-----------|-------------|
| `eventType` | Filter by package event type, for example `account.created` |
| `actorId` | Filter by actor user id |
| `accountId` | Filter by account id |
| `startDate` | ISO date lower bound |
| `endDate` | ISO date upper bound |
| `limit` | Result limit, capped at 100 |
| `offset` | Offset for pagination |

## App Storage Routes

Base path: `/api/storage`

These routes are app-owned and protected by `auth.middleware()` plus
`auth.accountMiddleware()`. They also use local permission guards.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/storage/upload-url` | Create internal upload URL |
| `PUT` | `/api/storage/upload/:key` | Upload file body to R2 |
| `GET` | `/api/storage/files/:key` | Read file metadata/download target |
| `DELETE` | `/api/storage/files/:key` | Delete file from R2 |

## Health Routes

Base path: `/health`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/health` | Basic health check | No |
| `GET` | `/health/ready` | Readiness probe | No |
| `GET` | `/health/live` | Liveness probe | No |

## Error Responses

The boilerplate error handler returns:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Human-readable error message",
    "status": 400,
    "timestamp": "2026-05-22T00:00:00.000Z"
  }
}
```

Some package handlers currently return simpler `{ "error": "..." }` responses
for route-local validation errors. Tests should assert the behavior that matters
without assuming a fully normalized error body for every package-owned route.
