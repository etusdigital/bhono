# @etus/create-bhono

## 0.2.0

### Minor Changes

- 803405a: Initial release as `@etus/create-bhono` — successor to the legacy `create-bhono-app` package (personal-account, unscoped). Same single-purpose CLI wrapper that delegates to `@etus/bhono` so consumers can run `npx @etus/create-bhono <project>`. Owned by the `@etus` org going forward; the old `create-bhono-app@<=0.1.4` will be unpublished/deprecated separately.

Successor to the legacy `create-bhono-app` (personal-account, unscoped) — this
package lives under the `@etus` scope owned by the org. The CLI binary
(`create-bhono`) is a thin wrapper around `@etus/bhono` so consumers can run
`npx @etus/create-bhono <project>` without thinking about which CLI to invoke.
