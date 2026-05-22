# Security Baseline

This boilerplate uses browser cookies for authentication, so the backend must
own every security decision. Frontend checks are only UX.

## Auth Boundary

- `@etus/auth` owns OAuth, sessions, users, accounts, memberships, invitations,
  and audit logs.
- The browser never receives OAuth client secrets, refresh tokens, session
  identifiers in JavaScript, or long-lived bearer tokens.
- Sessions are stored in Cloudflare KV and referenced in D1 through
  `auth_sessions`.
- Session cookies are HTTP-only, `SameSite=Lax`, and `Secure` on HTTPS.
- Session fingerprinting is enabled in `src/server/auth/setup.ts`.

## Authorization Boundary

- Package-owned auth/admin/account/invitation/audit routes are mounted in
  `src/server/index.ts`.
- App-owned `/api/*` routes run through `auth.middleware()` and
  `auth.accountMiddleware()` before route handlers execute.
- App routes use permission guards from `src/server/auth/guards.ts`.
- Product roles are declared in `src/server/auth/matrix.ts`:
  `owner > admin > member > guest`.
- Account membership mutations intentionally accept only
  `admin | member | guest` through `src/server/auth/package-compat.ts`.
  This keeps the boilerplate contract stable while `@etus/auth` still exposes
  hard-coded account-role behavior.
- `@etus/auth` persists invitations. Sending the invitation email remains a
  product/boilerplate responsibility until the package exposes an invitation
  delivery hook.

## Browser Request Protections

- Mutating browser requests must pass `csrfProtection()`:
  trusted `Origin`/`Referer` and JSON content type for JSON endpoints. The
  boilerplate does not send a decorative CSRF token header; if `@etus/auth`
  exposes a session-bound token later, it should be validated as data, not just
  checked for presence.
- Credentialed CORS is allowlist-only. `CORS_ORIGINS=*` is rejected in
  production by `validateEnv()`.
- Request bodies are capped by `requestBodyLimit()` before route parsing.
  Direct R2 upload routes use an explicit larger upload cap instead of
  bypassing size checks.

## Frontend Protections

- Client code should use cookie-backed `fetch(..., { credentials: 'include' })`.
- Auth tokens and secrets must not be stored in `localStorage` or
  `sessionStorage`.
- Dangerous DOM and code execution sinks are forbidden in `src/client` by
  `tests/unit/client/security/frontend-security.test.ts`.
- Static assets are served with CSP, Trusted Types, referrer policy,
  frame-denial, nosniff, HSTS, and restrictive permissions policy from
  `public/_headers`.

## Required Checks

Run these before shipping auth/security changes:

```bash
pnpm typecheck
pnpm test:unit:server
pnpm test:unit:client
pnpm build
```

`pnpm lint` is also expected for source files. If the repo has local generated
agent files, lint those separately or exclude them intentionally before making
the full lint command a release gate.
