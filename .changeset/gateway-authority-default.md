---
"@etus/bhono": minor
"@etus/create-bhono": minor
---

Gateway-as-authority is now the default authorization model for scaffolded apps.

`@etus/auth` bumped to **0.8.0**: generated apps derive permissions from the gateway (RBAC ∪ access_grants) via `scopeMap`, keeping the BFF model (no user tokens stored). Admin is expressed as a scope (`bhono:admin → ['*']`) gated with `requirePermission` — the 0.8.0 release removed the Phase 2 role-derivation (a local role persisted from gateway scopes that could not be revoked) after an adversarial review, so authorization flows scope → permission and revocations propagate within the cache TTL.

Off by default so a freshly generated app boots before its gateway resource exists. Opt in per app with `ETUS_GATEWAY_AUTHORITY=true` + `ETUS_RESOURCE_ID` + `ETUS_INTEGRATION_KEY` after registering the app as a `web_app` resource in the gateway (see `docs/SETUP-GUIDE.md`).

Also: sessions moved to D1 (`createSqlSessionStore`, dev-login D1-only), the frontend migrated to the Seven design system (`@etus/seven-react`), and the CLI `--version` drift (stale `0.1.5`) was corrected.
