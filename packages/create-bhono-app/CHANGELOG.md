# create-bhono-app

## 0.1.6

### Patch Changes

- 744bf0a: Point at the renamed `@etus/bhono` package (was `@etus/bhono-app` before `8461c81`). Both `package.json` dependency and `index.js` `require.resolve` updated to the current name + version (`@etus/bhono@^0.2.0`). Without this patch, `npx create-bhono-app` would still try to fetch the deprecated `@etus/bhono-app` package.

## 0.1.1

### Patch Changes

- 92d018e: chore: setup automated releases with Changesets
- Updated dependencies [92d018e]
  - @etus/bhono-app@0.1.1
