# @etus/bhono-app

## 0.4.0

### Minor Changes

- 3a8a654: feat(auth): consume gateway per-account roles (@etus/auth 0.9.1)

  The template now reads the gateway's per-account roles (viewer < editor < manager <
  admin, Auth0-Organizations model) for authorization, alongside its own local
  workspaces (hybrid model — member management stays local):

  - Bumps `@etus/auth` 0.8.0 → 0.9.1.
  - `ACCOUNT_ROLE_MAP` (`src/server/auth/matrix.ts`) + `gatewayAuthority.accountRoleMap`
    map gateway account roles → local permissions (unioned across the user's accounts).
  - `GET /api/me` exposes the user's gateway accounts + super-admin flag (safe empty
    shape when gatewayAuthority is off).
  - `useGatewayAccounts()` client hook with `hasAccountRole(slug, role)` for UI gating.
  - `auth.requireGatewayAccountRole(slug, role)` is available for precise per-account
    server-side gating.

  See the "Papéis por-conta do gateway" section in `docs/SETUP-GUIDE.md`.

## 0.3.0

### Minor Changes

- 0cf0aac: Gateway-as-authority is now the default authorization model for scaffolded apps.

  `@etus/auth` bumped to **0.8.0**: generated apps derive permissions from the gateway (RBAC ∪ access_grants) via `scopeMap`, keeping the BFF model (no user tokens stored). Admin is expressed as a scope (`bhono:admin → ['*']`) gated with `requirePermission` — the 0.8.0 release removed the Phase 2 role-derivation (a local role persisted from gateway scopes that could not be revoked) after an adversarial review, so authorization flows scope → permission and revocations propagate within the cache TTL.

  Off by default so a freshly generated app boots before its gateway resource exists. Opt in per app with `ETUS_GATEWAY_AUTHORITY=true` + `ETUS_RESOURCE_ID` + `ETUS_INTEGRATION_KEY` after registering the app as a `web_app` resource in the gateway (see `docs/SETUP-GUIDE.md`).

  Also: sessions moved to D1 (`createSqlSessionStore`, dev-login D1-only), the frontend migrated to the Seven design system (`@etus/seven-react`), and the CLI `--version` drift (stale `0.1.5`) was corrected.

## 0.2.0

### Minor Changes

- f7ce2a6: Template + CI hardening from boilerplate-hono. Significant updates to what scaffolded projects ship with.

  **Auth migration**: `@etus/auth` bumped from 0.3.0 to 0.5.0. New `MailerAdapter` wired (bridges SendGrid), `multiTenant.invitationUrl` callback, `defaultRole: 'member'` for invite-without-explicit-role, `devMode` flag for the package's dev helpers.

  **Browser request protections**:

  - CSP: `style-src-attr 'unsafe-inline'` (CSP3) added so Radix UI primitives keep working under strict `style-src` — `<style>` elements stay strict, only inline style attributes are allowed. Requires Chrome 75+, Firefox 74+, Safari 15.4+.
  - `csrfProtection()` accepts options to extend defaults: `exemptPaths`, `emptyBodyPaths`, `emptyBodyPatterns`, `nonJsonPathPrefixes`. Invitation regex widened to `(accept|decline)`. 415 error message points at the opt-out knob.
  - `MAX_UPLOAD_BYTES` env var: configurable R2 upload cap (positive integer in bytes, default 25 MiB, capped at the Workers runtime limit of ~500 MiB).
  - Wildcard `CORS_ORIGINS=*` in dev now emits a one-shot warning (memoized per env via WeakSet) so operators see that csrf's exact origin matcher silently drops the wildcard.
  - dev-login regression test asserting session cookie ships with `SameSite=Lax` — catches accidental downgrade to `None` that would silently weaken CSRF defense.

  **Release workflow**: aligned with the `@etus/auth` OAuth Gateway pattern — pnpm 11.1.1, node 24, `--access restricted`, OIDC trusted publisher. No `NPM_TOKEN` secret needed on GitHub Actions.

  **CI scoped to CLI deliverable**: workflows install only `@etus/bhono` workspace + its transitive deps via `pnpm install --filter '@etus/bhono...'`. Scaffolded projects get a CI that doesn't require an `@etus`-scoped read token in GitHub Secrets — the boilerplate's `@etus/auth` dep is verified locally via the pre-push hook (typecheck + tests) where the developer's own `~/.npmrc` has access.

  See `docs/security.md` in the scaffolded template for the full security baseline.

## 0.1.7

### Patch Changes

- 8a62924: docs: improve implement-issue workflow with git branch, commit, changeset, and PR phases

  - Add branch creation phase with naming conventions
  - Add changeset decision matrix (only for published packages)
  - Add conventional commits guidance
  - Add PR creation with Linear integration
  - Add post-merge cleanup steps

## 0.1.6

### Patch Changes

- bdb2fd2: Sync templates with main project:
  - Update use-auth.ts with industry-standard caching (5min stale, 30min gc)
  - Update rate-limit.ts with separate auth key prefix
  - Update server index.ts with login-only strict rate limiting
  - Remove obsolete Drizzle config from init.sh

## 0.1.1

### Patch Changes

- 92d018e: chore: setup automated releases with Changesets
