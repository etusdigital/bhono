# Security Baseline

This boilerplate uses browser cookies for authentication, so the backend must
own every security decision. Frontend checks are only UX.

## Auth Boundary

- `@etus/auth` (v0.5.0+) owns OAuth, sessions, users, accounts, memberships,
  invitations (including delivery via the `MailerAdapter` configured in
  `src/server/auth/setup.ts`), and audit logs.
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
  v0.5.0's package validates roles against `access.roles` (our 4-role list),
  but we deliberately keep `owner` out of membership writes — it's a
  product-level concept tracked on `auth_accounts.owner_id`, not a membership
  role. The shim enforces that narrowing.
- `@etus/auth` v0.5.0 ships invitation delivery — we wire a `MailerAdapter`
  in `setup.ts` that bridges the package contract to our SendGrid wrapper
  (`src/server/lib/email.ts`). The invitation URL is built by the package
  using the `multiTenant.invitationUrl` callback we provide
  (`${env.APP_URL}/invite/${inv.token}`).
- `defaultRole` is `member`: invites without an explicit role land as
  `member` (collaborative), not `guest` (read-only) or `admin` (too much).
  This is a v0.5.0 change — earlier versions hardcoded `viewer`.

## Browser Request Protections

- Mutating browser requests must pass `csrfProtection()`:
  trusted `Origin`/`Referer` and JSON content type for JSON endpoints. The
  boilerplate does not send a decorative CSRF token header; if `@etus/auth`
  exposes a session-bound token later, it should be validated as data, not just
  checked for presence.
- `csrfProtection()` accepts options to extend (never replace) the defaults:
  `exemptPaths` skips all checks (for routes with their own gate, e.g.
  dev-login's localhost guard); `emptyBodyPaths` and `emptyBodyPatterns`
  allow `POST`/`PUT`/`PATCH` without `Content-Type` for legitimately empty
  requests (logout, invitation accept/decline); `nonJsonPathPrefixes` opts
  whole route trees out of the JSON-only contract (storage uploads,
  webhook receivers). The `415` error message names these options so the
  fix is discoverable from the failing request.
- Credentialed CORS is allowlist-only. `CORS_ORIGINS=*` is rejected in
  production by `validateEnv()`. Outside production it is permitted but
  `validateEnv()` emits a one-shot warning (per env object via `WeakSet`,
  so it fires once per isolate and once per test) explaining that csrf's
  exact origin matcher silently drops the wildcard — operators should
  list each origin explicitly even in dev to avoid silent rejections.
- Request bodies are capped by `requestBodyLimit()` before route parsing.
  Direct R2 upload routes use an explicit larger upload cap instead of
  bypassing size checks. The upload cap defaults to 25 MiB and can be
  raised via the `MAX_UPLOAD_BYTES` env var (positive integer in bytes,
  up to the Workers runtime cap of ~500 MiB). `validateEnv()` parses the
  value at boot so a bad value fails the first request with a clear
  message instead of crashing inside the middleware on the first upload.

## Frontend Protections

- Client code should use cookie-backed `fetch(..., { credentials: 'include' })`.
- Auth tokens and secrets must not be stored in `localStorage` or
  `sessionStorage`.
- Dangerous DOM and code execution sinks are forbidden in `src/client` by
  `tests/unit/client/security/frontend-security.test.ts`.
- Static assets are served with CSP, Trusted Types, referrer policy,
  frame-denial, nosniff, HSTS, and restrictive permissions policy from
  `public/_headers`.
- The CSP keeps `<style>` elements strict (`style-src 'self' …`) but
  explicitly allows inline style attributes via the CSP3 directive
  `style-src-attr 'unsafe-inline'`. This is required because Radix UI
  primitives (Dialog overlay, Popover positioning) emit `style="…"`
  attributes from their own code that would otherwise be blocked,
  silently breaking modals and dropdowns. Element-level injection (the
  actual XSS vector) is still rejected — `style-src-elem` falls back to
  the strict `style-src`. Both the runtime middleware
  (`src/server/middleware/security-headers.ts`) and the static
  `public/_headers` file ship this split.
- **Browser compatibility note:** `style-src-attr` is CSP3 and requires
  Chrome 75+, Firefox 74+, or Safari 15.4+ (released 2022). Older
  browsers ignore the directive and fall back to the strict `style-src`,
  which means Radix primitives will render with broken positioning. The
  boilerplate targets browsers released within the last ~3 years; if you
  need to support older Safari, either restore `'unsafe-inline'` in
  `style-src` (weaker defense) or migrate to a UI library that doesn't
  rely on inline style attributes.

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
