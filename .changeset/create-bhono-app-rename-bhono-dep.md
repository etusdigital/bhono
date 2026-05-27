---
"create-bhono-app": patch
---

Point at the renamed `@etus/bhono` package (was `@etus/bhono-app` before `8461c81`). Both `package.json` dependency and `index.js` `require.resolve` updated to the current name + version (`@etus/bhono@^0.2.0`). Without this patch, `npx create-bhono-app` would still try to fetch the deprecated `@etus/bhono-app` package.
