# User Invitation Flow Design

**Date**: 2025-12-08
**Status**: Approved

---

## Overview

Allow ADMIN and MANAGER users to invite others to their account. Existing users are linked immediately; new users receive an email invitation via SendGrid.

---

## Key Decisions

| Decision | Choice |
|----------|--------|
| Existing users | Link immediately to account (no email) |
| New users | Email invitation via SendGrid |
| Invitation expiry | 7 days |
| Who can invite | ADMIN, MANAGER |
| Role assignment | Inviter chooses (up to their own level) |

---

## Database Schema

**New table: `invitations`**

```typescript
invitations = sqliteTable('invitations', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  email: text('email').notNull(),
  role: text('role').notNull(),  // Role to assign on acceptance
  token: text('token').notNull().unique(),  // Secure random token
  invitedById: text('invited_by_id').notNull().references(() => users.id),
  expiresAt: text('expires_at').notNull(),
  acceptedAt: text('accepted_at'),  // Null until accepted
  createdAt: text('created_at').notNull(),
})
```

**Constraints:**
- Unique on `(accountId, email)` - can't invite same email twice to same account
- Index on `token` for fast lookup

---

## API Endpoints

### Protected Endpoints (require JWT + account-id)

| Endpoint | Method | Role Required | Description |
|----------|--------|---------------|-------------|
| `/api/invitations` | POST | ADMIN, MANAGER | Create invitation (sends email) |
| `/api/invitations` | GET | ADMIN, MANAGER | List pending invitations for account |
| `/api/invitations/{id}` | DELETE | ADMIN, MANAGER | Revoke/cancel invitation |

### Public Endpoint (no JWT required)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/invite/{token}` | GET | Accept invitation (redirects to OAuth if needed) |

---

## Invitation Flows

### Flow 1: Inviting Existing User (Immediate Link)

```
1. ADMIN calls POST /api/invitations { email, role }
2. Backend finds existing user by email
3. Checks user not already in account
4. Creates user-account relationship immediately
5. Returns { linked: true, user: {...} }
6. No email sent, no invitation record created
```

### Flow 2: Inviting New User (Email Invitation)

```
1. ADMIN calls POST /api/invitations { email, role }
2. Backend confirms email not in system
3. Creates invitation record with secure token
4. Sends email via SendGrid with invitation link
5. Returns { invited: true, invitation: {...} }
```

### Flow 3: Accepting Invitation (New User)

```
1. User clicks /auth/invite/{token}
2. Backend validates token (exists, not expired, not accepted)
3. Stores token in cookie: pending_invitation
4. Redirects to /auth/login (Google OAuth)
5. After OAuth callback:
   - Checks for pending_invitation cookie
   - If present: links user to account with specified role
   - Marks invitation as accepted
   - Clears cookie
6. Redirects to app with access token
```

---

## Email Integration

### Environment Variables

```env
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
APP_URL=http://localhost:3000
```

### Email Content

- **Subject**: `"{inviterName}" invited you to join "{accountName}"`
- **Body**: Simple message with account name and invitation link
- **CTA**: "Accept Invitation" button

### Error Handling

- If SendGrid fails, invitation is not created (atomic operation)
- No retry logic (YAGNI)

---

## Error Cases

| Scenario | Response |
|----------|----------|
| Email already in account | 409 Conflict |
| Pending invitation exists for email | 409 Conflict (or resend option) |
| Invitation token not found | 404 Not Found |
| Invitation expired | 400 Bad Request |
| Invitation already accepted | 400 Bad Request |
| Inviter lacks permission for role | 403 Forbidden |

---

## File Structure

### New Files

```
src/
├── db/schema/
│   └── invitations.ts          # Invitations table
├── lib/
│   └── email.ts                # SendGrid integration
├── services/
│   └── invitations.ts          # Invitation business logic
├── routes/invitations/
│   ├── schemas.ts              # Zod schemas
│   ├── routes.ts               # Route definitions
│   ├── handlers.ts             # Route handlers
│   └── index.ts                # Router
```

### Modified Files

```
src/
├── db/schema/index.ts          # Export invitations
├── routes/index.ts             # Mount invitations routes
├── routes/auth/handlers.ts     # Handle pending invitation on callback
├── env.ts                      # Add SendGrid env vars
```

---

## Security Considerations

- Invitation tokens are cryptographically random (32 bytes)
- Tokens are single-use (marked accepted after use)
- 7-day expiry limits exposure window
- Role escalation prevented (can't assign role higher than own)
- MANAGER can't invite as ADMIN
