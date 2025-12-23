# Design: Strong Password Generator & Enhanced Seeding

**Date:** 2025-12-23
**Status:** Approved

## Overview

Add a strong password generator utility and expand database seeding for comprehensive testing.

## Decisions

| Feature | Approach |
|---------|----------|
| Password Generator | Utility function for future use |
| Seeding Scope | 3 accounts, 10 users, invitations, audit logs |

---

## 1. Strong Password Generator

### File: `src/server/lib/password.ts`

### API

```typescript
/**
 * Generate a cryptographically strong password meeting "Excellent" policy:
 * - At least 16 characters
 * - Contains at least 3 of 4 character types (lowercase, uppercase, numbers, special)
 * - No more than 2 identical characters in a row
 */
function generateStrongPassword(length?: number): string
```

### Default Configuration

| Setting | Value |
|---------|-------|
| Default length | 20 |
| Min length | 16 |
| Character types required | 3 of 4 |
| Max consecutive repeats | 2 |

### Character Sets

```typescript
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const NUMBERS = '0123456789'
const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?'
```

---

## 2. Enhanced Database Seeding

### File: `src/server/db/seed.ts`

### Data Structure

#### Accounts (3)

| Name | Domain | Description |
|------|--------|-------------|
| Default Account | default.local | Default testing account |
| Acme Corporation | acme.local | Enterprise client |
| Tech Startup | startup.local | Small team account |

#### Users (10)

| Email | Name | isSuperAdmin |
|-------|------|--------------|
| superadmin@example.com | Super Admin | true |
| admin@example.com | Admin User | false |
| manager@example.com | Manager User | false |
| editor@example.com | Editor User | false |
| author@example.com | Author User | false |
| viewer@example.com | Viewer User | false |
| billing@example.com | Billing User | false |
| analytics@example.com | Analytics User | false |
| user1@example.com | Test User 1 | false |
| user2@example.com | Test User 2 | false |

#### User-Account Relationships (~15)

| User | Account | Role |
|------|---------|------|
| Super Admin | Default | ADMIN |
| Admin | Default | ADMIN |
| Manager | Default | MANAGER |
| Editor | Default | EDITOR |
| Viewer | Default | VIEWER |
| Admin | Acme | ADMIN |
| Author | Acme | AUTHOR |
| Billing | Acme | BILLING |
| Manager | Startup | MANAGER |
| Analytics | Startup | ANALYTICS |
| User1 | Default | AUTHOR |
| User2 | Acme | VIEWER |

#### Pending Invitations (3)

| Email | Account | Role |
|-------|---------|------|
| invited1@example.com | Startup | EDITOR |
| invited2@example.com | Startup | AUTHOR |
| invited3@example.com | Acme | VIEWER |

#### Audit Logs (10)

Sample events: SIGNUP, LOGIN, UPDATE, DELETE across different users and accounts.

---

## 3. Implementation Order

1. `lib/password.ts` - Password generator with tests
2. `db/seed.ts` - Expand seeding script

## 4. Usage

```bash
# Run seed locally
npm run db:seed

# Or with wrangler
npx wrangler d1 execute DB --local --command="..."
```
