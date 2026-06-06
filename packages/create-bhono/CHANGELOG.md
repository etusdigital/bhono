# @etus/create-bhono

## 0.3.0

### Minor Changes

- 0cf0aac: Gateway-as-authority is now the default authorization model for scaffolded apps.

  `@etus/auth` bumped to **0.8.0**: generated apps derive permissions from the gateway (RBAC ∪ access_grants) via `scopeMap`, keeping the BFF model (no user tokens stored). Admin is expressed as a scope (`bhono:admin → ['*']`) gated with `requirePermission` — the 0.8.0 release removed the Phase 2 role-derivation (a local role persisted from gateway scopes that could not be revoked) after an adversarial review, so authorization flows scope → permission and revocations propagate within the cache TTL.

  Off by default so a freshly generated app boots before its gateway resource exists. Opt in per app with `ETUS_GATEWAY_AUTHORITY=true` + `ETUS_RESOURCE_ID` + `ETUS_INTEGRATION_KEY` after registering the app as a `web_app` resource in the gateway (see `docs/SETUP-GUIDE.md`).

  Also: sessions moved to D1 (`createSqlSessionStore`, dev-login D1-only), the frontend migrated to the Seven design system (`@etus/seven-react`), and the CLI `--version` drift (stale `0.1.5`) was corrected.

### Patch Changes

- Updated dependencies [0cf0aac]
  - @etus/bhono@0.3.0

## 0.2.0

### Minor Changes

- 803405a: Initial release as `@etus/create-bhono` — successor to the legacy `create-bhono-app` package (personal-account, unscoped). Same single-purpose CLI wrapper that delegates to `@etus/bhono` so consumers can run `npx @etus/create-bhono <project>`. Owned by the `@etus` org going forward; the old `create-bhono-app@<=0.1.4` will be unpublished/deprecated separately.

Successor to the legacy `create-bhono-app` (personal-account, unscoped) — this
package lives under the `@etus` scope owned by the org. The CLI binary
(`create-bhono`) is a thin wrapper around `@etus/bhono` so consumers can run
`npx @etus/create-bhono <project>` without thinking about which CLI to invoke.
