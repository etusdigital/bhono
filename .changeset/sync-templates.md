---
"@etus/bhono-app": patch
---

Sync templates with main project:
- Update use-auth.ts with industry-standard caching (5min stale, 30min gc)
- Update rate-limit.ts with separate auth key prefix
- Update server index.ts with login-only strict rate limiting
- Remove obsolete Drizzle config from init.sh
