# Google OAuth2 Authentication Design

**Date**: 2025-12-07
**Status**: Approved

---

## Overview

Implement Google OAuth2 authentication using Authorization Code flow with PKCE, replacing the need for Auth0. Users authenticate via Google, and the backend issues its own JWT tokens for API access.

---

## Key Decisions

| Aspect | Decision |
|--------|----------|
| **OAuth Flow** | Authorization Code with PKCE |
| **User Identifier** | Google `sub` claim (unique, stable) |
| **Email** | Required, stored for display/contact, not unique identifier |
| **Token Strategy** | Hono JWT (15min) + refresh token (30 days, HTTP-only cookie) |
| **Google Accounts** | One-to-one mapping (single Google account per user) |
| **First Login** | Auto-create user + personal account with EDITOR role |
| **Logout** | Local only (clear tokens, user stays logged into Google) |

---

## Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│ Backend  │────▶│  Google  │────▶│ Backend  │
│   SPA    │     │ /login   │     │  OAuth   │     │ /callback│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                                                   │
     │◀──────────────────────────────────────────────────┘
     │         JWT (body) + Refresh Token (cookie)
```

### Flow Steps

1. Client calls `GET /auth/login` with PKCE `code_verifier` stored locally
2. Backend generates `code_challenge`, stores `state` + `code_challenge` in short-lived cookie, redirects to Google
3. User authenticates with Google
4. Google redirects to `GET /auth/callback` with `code` + `state`
5. Backend validates `state`, exchanges code for tokens using PKCE
6. Backend extracts Google `sub` from ID token, finds or creates user + account
7. Backend issues JWT (response body) + refresh token (HTTP-only cookie)
8. Client stores JWT in memory, uses for API calls

---

## API Endpoints

All auth routes under `/auth/*`:

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/auth/login` | GET | No | Generates PKCE challenge, state cookie, redirects to Google |
| `/auth/callback` | GET | No | Handles Google redirect, exchanges code, issues tokens |
| `/auth/refresh` | POST | No (uses cookie) | Validates refresh cookie, issues new JWT |
| `/auth/logout` | POST | No (uses cookie) | Clears refresh token cookie, revokes token in DB |
| `/auth/me` | GET | Yes (JWT) | Returns current user info |

---

## Database Schema Changes

### Users Table Modification

```typescript
// Before
email: text('email').notNull().unique()

// After
googleId: text('google_id').notNull().unique(),  // Google 'sub' claim - PRIMARY IDENTIFIER
email: text('email').notNull(),                   // Required but NOT unique identifier
name: text('name'),                               // From Google profile
avatarUrl: text('avatar_url'),                    // Google profile picture
```

### New: Refresh Tokens Table

```typescript
refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),                    // UUID
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),        // SHA-256 hash, never store plain
  expiresAt: integer('expires_at').notNull(),     // Unix timestamp
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
  revokedAt: integer('revoked_at'),               // Set on logout/revocation
});
```

---

## First Login - User & Account Creation

When a new Google user authenticates:

1. **Extract from Google ID token:**
   - `sub` → `googleId` (unique identifier)
   - `email` → `email` (required, for display)
   - `name` → `name`
   - `picture` → `avatarUrl`

2. **Create user record** with status `active`

3. **Create personal account:**
   - Name: `"{user.name}'s Account"`
   - No domain set

4. **Create user-account relationship** with role `EDITOR`

5. **Issue tokens** and respond to client

**Returning users:** Look up by `googleId`, update email/name/avatar if changed, issue tokens.

---

## Token Details

### JWT Payload

```typescript
{
  sub: string,          // Internal user ID (UUID)
  email: string,        // For convenience
  iat: number,          // Issued at
  exp: number,          // Expires (15 min default)
}
```

**Note:** Account context (`account-id`) stays in request header - JWT is account-agnostic since users can belong to multiple accounts.

### Cookie Configuration

| Cookie | HTTP-Only | Secure | SameSite | Max-Age |
|--------|-----------|--------|----------|---------|
| `refresh_token` | Yes | Yes (prod) | Lax | 30 days |
| `oauth_state` | Yes | Yes (prod) | Lax | 10 min |

---

## Security Measures

- **PKCE**: Prevents authorization code interception attacks
- **State parameter**: Validated to prevent CSRF
- **Refresh tokens hashed**: SHA-256 before storage
- **Short JWT expiry**: 15 minutes limits exposure window
- **HTTP-only cookies**: Prevents XSS access to refresh tokens
- **Token revocation**: Logout invalidates refresh token in DB

---

## Environment Variables

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
REFRESH_TOKEN_EXPIRY_DAYS=30
JWT_EXPIRY_MINUTES=15
```

---

## File Structure

### New Files

```
src/
├── routes/
│   └── auth.ts              # Auth routes (login, callback, refresh, logout, me)
├── services/
│   └── auth.ts              # OAuth logic, token generation, user creation
├── db/schema/
│   └── refresh-tokens.ts    # Refresh tokens table schema
├── lib/
│   ├── oauth.ts             # Google OAuth helpers (PKCE, token exchange)
│   └── tokens.ts            # JWT & refresh token utilities
└── types/
    └── auth.ts              # Auth-related types (GoogleProfile, TokenPayload)
```

### Modified Files

```
src/
├── db/schema/
│   └── users.ts             # Add googleId, add avatarUrl, keep email required
├── db/schema/
│   └── index.ts             # Export refresh-tokens schema
├── app.ts                   # Register auth routes
├── env.ts                   # Add Google OAuth env vars
└── middleware/
    └── auth.ts              # Update to use googleId for lookup
```

---

## Dependencies

No new npm packages required. Using:
- `hono/jwt` - Already installed for JWT handling
- Native `crypto` - For PKCE and token hashing
- Native `fetch` - For Google token exchange
