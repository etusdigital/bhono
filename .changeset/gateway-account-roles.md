---
"@etus/bhono": minor
---

feat(auth): consume gateway per-account roles (@etus/auth 0.9.1)

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
