---
"@etus/bhono": minor
---

Template + CI hardening from boilerplate-hono. Significant updates to what scaffolded projects ship with.

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
