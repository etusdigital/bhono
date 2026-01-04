# @etus/bhono-app

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
