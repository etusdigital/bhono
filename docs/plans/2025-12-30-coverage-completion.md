# Coverage Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve 90% backend, 85% frontend, and 95% shared code coverage.

**Architecture:** Add comprehensive unit tests for all uncovered services, routes, and lib modules using the existing mock infrastructure (MockD1Database, MockKVStore, MockR2Bucket). Frontend tests use React Testing Library with TanStack Router test utilities.

**Tech Stack:** Vitest, @testing-library/react, Hono testClient, existing mock infrastructure

---

## Current State

| Layer | Current | Target | Gap |
|-------|---------|--------|-----|
| Backend | 51.89% | 90% | +38.11% |
| Frontend | 45.25% | 85% | +39.75% |
| Shared | ~0% | 95% | +95% |

## Files Requiring Tests

### Backend Services (Priority 1)
- `src/server/services/auth.ts` - 215 lines, 0%
- `src/server/services/invitations.ts` - 287 lines, 0%
- `src/server/services/audits.ts` - 82 lines, 0%

### Backend Lib (Priority 2)
- `src/server/lib/session.ts` - 268 lines, ~3%
- `src/server/lib/oauth.ts` - 107 lines, 0%
- `src/server/lib/email.ts` - 82 lines, 0%
- `src/server/lib/r2-storage.ts` - 104 lines, 0%
- `src/server/lib/tokens.ts` - 60 lines, 25%

### Backend Routes (Priority 3)
- `src/server/routes/accounts/` - 431 lines, 0%
- `src/server/routes/storage/` - 262 lines, 0%
- `src/server/routes/invitations/` - 177 lines, 0%
- `src/server/routes/audits/` - 117 lines, 0%

### Shared Schemas (Priority 4)
- `src/shared/schemas/*.ts` - 44 lines, 0%

### Frontend Routes (Priority 5)
- `src/client/routes/__authenticated/account.tsx` - 378 lines, ~1%
- `src/client/routes/__authenticated/team.tsx` - 337 lines, ~9%
- `src/client/routes/__authenticated/settings.tsx` - 291 lines, ~2%
- `src/client/routes/__authenticated/integrations.tsx` - 517 lines, ~16%
- `src/client/routes/invite.$token.tsx` - 191 lines, ~8%

---

## Task 1: Auth Service Tests - findOrCreateUser

**Files:**
- Create: `src/server/services/__tests__/auth.test.ts`
- Reference: `src/server/services/auth.ts:19-95`

**Step 1: Write the failing test**

```typescript
// src/server/services/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from '../auth'
import type { GoogleUserInfo } from '../../types/auth'
import type { AuthEventContext } from '../../lib/audit'

// Mock dependencies
vi.mock('../../lib/tokens', () => ({
  createAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  generateRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
  hashToken: vi.fn().mockReturnValue('hashed-token'),
  getRefreshTokenExpiry: vi.fn().mockReturnValue('2025-01-07T00:00:00Z'),
}))

vi.mock('../../lib/audit', () => ({
  logAuthEvent: vi.fn(),
}))

function createMockDb(existingUser: any = null) {
  const mockDb: any = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(existingUser ? [existingUser] : []),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'new-user-id', email: 'new@test.com', name: 'New User' }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([existingUser]),
        }),
      }),
    }),
  }
  return mockDb
}

const mockEnv = {
  JWT_SECRET: 'test-secret',
  GOOGLE_CLIENT_ID: 'test-client-id',
} as any

const mockGoogleUser: GoogleUserInfo = {
  sub: 'google-123',
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/avatar.jpg',
  email_verified: true,
}

const mockCtx: AuthEventContext = {
  ip: '127.0.0.1',
  userAgent: 'test-agent',
}

describe('authService', () => {
  describe('findOrCreateUser', () => {
    it('should create new user when not found', async () => {
      const db = createMockDb(null)

      const result = await authService.findOrCreateUser(db, mockEnv, mockGoogleUser, mockCtx)

      expect(result.isNewUser).toBe(true)
      expect(db.insert).toHaveBeenCalled()
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/server/services/__tests__/auth.test.ts`
Expected: PASS (service exists, we're testing behavior)

**Step 3: Add more test cases**

```typescript
    it('should return existing user when found by googleId', async () => {
      const existingUser = {
        id: 'existing-id',
        googleId: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
      }
      const db = createMockDb(existingUser)

      const result = await authService.findOrCreateUser(db, mockEnv, mockGoogleUser, mockCtx)

      expect(result.isNewUser).toBe(false)
      expect(result.user.id).toBe('existing-id')
    })

    it('should update user profile when info changed', async () => {
      const existingUser = {
        id: 'existing-id',
        googleId: 'google-123',
        email: 'old@example.com', // Different email
        name: 'Old Name',
        avatarUrl: null,
      }
      const db = createMockDb(existingUser)

      await authService.findOrCreateUser(db, mockEnv, mockGoogleUser, mockCtx)

      expect(db.update).toHaveBeenCalled()
    })

    it('should generate access and refresh tokens', async () => {
      const db = createMockDb(null)

      const result = await authService.findOrCreateUser(db, mockEnv, mockGoogleUser, mockCtx)

      expect(result.tokens.accessToken).toBe('mock-access-token')
      expect(result.refreshToken).toBe('mock-refresh-token')
    })
```

**Step 4: Run tests**

Run: `npm run test:run -- src/server/services/__tests__/auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/__tests__/auth.test.ts
git commit -m "test: add auth service findOrCreateUser tests"
```

---

## Task 2: Auth Service Tests - refreshTokens & revokeTokens

**Files:**
- Modify: `src/server/services/__tests__/auth.test.ts`
- Reference: `src/server/services/auth.ts:97-215`

**Step 1: Add refreshTokens tests**

```typescript
  describe('refreshTokens', () => {
    it('should throw UnauthorizedError when refresh token not found', async () => {
      const db = createMockDb()
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      await expect(
        authService.refreshTokens(db, mockEnv, 'invalid-token', mockCtx)
      ).rejects.toThrow('Invalid refresh token')
    })

    it('should throw UnauthorizedError when token is expired', async () => {
      const expiredToken = {
        id: 'token-id',
        userId: 'user-id',
        expiresAt: '2020-01-01T00:00:00Z', // Past date
        revokedAt: null,
      }
      const db = createMockDb()
      db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([expiredToken]),
        }),
      })

      await expect(
        authService.refreshTokens(db, mockEnv, 'expired-token', mockCtx)
      ).rejects.toThrow('Refresh token expired')
    })

    it('should return new tokens when refresh token is valid', async () => {
      const validToken = {
        id: 'token-id',
        userId: 'user-id',
        expiresAt: '2099-01-01T00:00:00Z',
        revokedAt: null,
      }
      const mockUser = { id: 'user-id', email: 'test@test.com', name: 'Test' }
      const db = createMockDb()

      // Token lookup
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([validToken]),
        }),
      })
      // User lookup
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      })

      const result = await authService.refreshTokens(db, mockEnv, 'valid-token', mockCtx)

      expect(result.tokens.accessToken).toBe('mock-access-token')
    })
  })

  describe('revokeTokens', () => {
    it('should revoke refresh token by marking revokedAt', async () => {
      const db = createMockDb()
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      await authService.revokeTokens(db, 'user-id', mockCtx)

      expect(db.update).toHaveBeenCalled()
    })
  })
```

**Step 2: Run tests**

Run: `npm run test:run -- src/server/services/__tests__/auth.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/services/__tests__/auth.test.ts
git commit -m "test: add auth service refreshTokens and revokeTokens tests"
```

---

## Task 3: Invitations Service Tests - create

**Files:**
- Create: `src/server/services/__tests__/invitations.test.ts`
- Reference: `src/server/services/invitations.ts:47-120`

**Step 1: Write the failing test**

```typescript
// src/server/services/__tests__/invitations.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invitationsService } from '../invitations'
import { ForbiddenError, ConflictError } from '../../lib/errors'
import type { ServiceContext } from '../../types'

vi.mock('../../lib/email', () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/audit', () => ({
  logAuthEvent: vi.fn(),
}))

function createMockDb() {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 'inv-1',
          email: 'invite@test.com',
          role: 'member',
          expiresAt: '2025-01-07T00:00:00Z',
        }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as any
}

const mockEnv = { RESEND_API_KEY: 'test-key' } as any

const mockCtx: ServiceContext = {
  accountId: 'account-1',
  user: { id: 'user-1', email: 'admin@test.com', name: 'Admin' } as any,
  userRole: 'admin',
  transactionId: 'tx-1',
  ip: '127.0.0.1',
  userAgent: 'test',
}

describe('invitationsService', () => {
  describe('create', () => {
    it('should throw ForbiddenError when assigning higher role than own', async () => {
      const db = createMockDb()
      const memberCtx = { ...mockCtx, userRole: 'member' as const }

      await expect(
        invitationsService.create(db, mockEnv, memberCtx, { email: 'test@test.com', role: 'admin' })
      ).rejects.toThrow(ForbiddenError)
    })

    it('should throw ConflictError when user already in account', async () => {
      const db = createMockDb()
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ userId: 'existing-user' }]),
          }),
        }),
      })

      await expect(
        invitationsService.create(db, mockEnv, mockCtx, { email: 'existing@test.com', role: 'member' })
      ).rejects.toThrow(ConflictError)
    })

    it('should create invitation and send email when valid', async () => {
      const db = createMockDb()

      const result = await invitationsService.create(db, mockEnv, mockCtx, {
        email: 'newuser@test.com',
        role: 'member',
      })

      expect(result.invited).toBe(true)
      expect(db.insert).toHaveBeenCalled()
    })
  })
})
```

**Step 2: Run test**

Run: `npm run test:run -- src/server/services/__tests__/invitations.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/services/__tests__/invitations.test.ts
git commit -m "test: add invitations service create tests"
```

---

## Task 4: Invitations Service Tests - accept, list, cancel

**Files:**
- Modify: `src/server/services/__tests__/invitations.test.ts`
- Reference: `src/server/services/invitations.ts:121-287`

**Step 1: Add remaining tests**

```typescript
  describe('accept', () => {
    it('should throw NotFoundError when invitation not found', async () => {
      const db = createMockDb()

      await expect(
        invitationsService.accept(db, 'invalid-token', 'user-1', mockCtx)
      ).rejects.toThrow('Invitation not found or expired')
    })

    it('should add user to account when invitation valid', async () => {
      const db = createMockDb()
      const validInvitation = {
        id: 'inv-1',
        accountId: 'account-1',
        email: 'test@test.com',
        role: 'member',
        expiresAt: '2099-01-01T00:00:00Z',
        acceptedAt: null,
      }
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([validInvitation]),
          }),
        }),
      })

      await invitationsService.accept(db, 'valid-token', 'user-1', mockCtx)

      expect(db.insert).toHaveBeenCalled()
      expect(db.update).toHaveBeenCalled()
    })
  })

  describe('list', () => {
    it('should return pending invitations for account', async () => {
      const db = createMockDb()
      const pendingInvitations = [
        { id: 'inv-1', email: 'a@test.com', role: 'member', expiresAt: '2099-01-01' },
        { id: 'inv-2', email: 'b@test.com', role: 'admin', expiresAt: '2099-01-01' },
      ]
      db.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(pendingInvitations),
        }),
      })

      const result = await invitationsService.list(db, 'account-1')

      expect(result).toHaveLength(2)
    })
  })

  describe('cancel', () => {
    it('should throw NotFoundError when invitation not found', async () => {
      const db = createMockDb()
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      await expect(
        invitationsService.cancel(db, 'inv-1', 'account-1', mockCtx)
      ).rejects.toThrow('Invitation not found')
    })

    it('should cancel invitation successfully', async () => {
      const db = createMockDb()
      db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'inv-1' }]),
        }),
      })

      await invitationsService.cancel(db, 'inv-1', 'account-1', mockCtx)

      expect(db.update).toHaveBeenCalled()
    })
  })
```

**Step 2: Run tests**

Run: `npm run test:run -- src/server/services/__tests__/invitations.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/services/__tests__/invitations.test.ts
git commit -m "test: add invitations service accept, list, cancel tests"
```

---

## Task 5: Audits Service Tests

**Files:**
- Create: `src/server/services/__tests__/audits.test.ts`
- Reference: `src/server/services/audits.ts`

**Step 1: Write tests**

```typescript
// src/server/services/__tests__/audits.test.ts
import { describe, it, expect, vi } from 'vitest'
import { auditsService } from '../audits'
import type { ServiceContext } from '../../types'

function createMockDb(data: any[] = [], count = 0) {
  return {
    select: vi.fn().mockImplementation((fields?: any) => {
      if (fields && 'count' in fields) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count }]),
          }),
        }
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(data),
              }),
            }),
          }),
        }),
      }
    }),
  } as any
}

const mockCtx: ServiceContext = {
  accountId: 'account-1',
  user: { id: 'user-1' } as any,
  transactionId: 'tx-1',
  ip: '127.0.0.1',
  userAgent: 'test',
}

describe('auditsService', () => {
  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = [
        { id: 'log-1', action: 'create', entityType: 'user', createdAt: '2025-01-01' },
        { id: 'log-2', action: 'update', entityType: 'user', createdAt: '2025-01-02' },
      ]
      const db = createMockDb(mockLogs, 2)

      const result = await auditsService.findAll(db, mockCtx, { page: 1, limit: 10 })

      expect(result.data).toHaveLength(2)
      expect(result.pagination.total).toBe(2)
    })

    it('should filter by entityType when provided', async () => {
      const db = createMockDb([], 0)

      await auditsService.findAll(db, mockCtx, { page: 1, limit: 10, entityType: 'user' })

      expect(db.select).toHaveBeenCalled()
    })

    it('should filter by action when provided', async () => {
      const db = createMockDb([], 0)

      await auditsService.findAll(db, mockCtx, { page: 1, limit: 10, action: 'create' })

      expect(db.select).toHaveBeenCalled()
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:run -- src/server/services/__tests__/audits.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/services/__tests__/audits.test.ts
git commit -m "test: add audits service tests"
```

---

## Task 6: Session Library Tests

**Files:**
- Create: `src/server/lib/session.test.ts`
- Reference: `src/server/lib/session.ts`

**Step 1: Write tests**

```typescript
// src/server/lib/session.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionManager } from './session'
import { MockKVStore } from '../__tests__/mocks/kv'

describe('SessionManager', () => {
  let kv: MockKVStore
  let sessionManager: SessionManager

  beforeEach(() => {
    kv = new MockKVStore()
    sessionManager = new SessionManager(kv as any)
  })

  describe('createSession', () => {
    it('should create session and return session ID', async () => {
      const sessionId = await sessionManager.createSession({
        userId: 'user-1',
        accountId: 'account-1',
        role: 'admin',
      })

      expect(sessionId).toBeDefined()
      expect(typeof sessionId).toBe('string')
    })

    it('should store session data in KV', async () => {
      const sessionId = await sessionManager.createSession({
        userId: 'user-1',
        accountId: 'account-1',
        role: 'member',
      })

      const stored = await kv.get(`session:${sessionId}`, 'json')
      expect(stored).toBeDefined()
      expect(stored.userId).toBe('user-1')
    })
  })

  describe('getSession', () => {
    it('should return null for non-existent session', async () => {
      const session = await sessionManager.getSession('non-existent')
      expect(session).toBeNull()
    })

    it('should return session data for valid session', async () => {
      const sessionId = await sessionManager.createSession({
        userId: 'user-1',
        accountId: 'account-1',
        role: 'admin',
      })

      const session = await sessionManager.getSession(sessionId)
      expect(session).toBeDefined()
      expect(session?.userId).toBe('user-1')
    })
  })

  describe('deleteSession', () => {
    it('should remove session from KV', async () => {
      const sessionId = await sessionManager.createSession({
        userId: 'user-1',
        accountId: 'account-1',
        role: 'admin',
      })

      await sessionManager.deleteSession(sessionId)

      const session = await sessionManager.getSession(sessionId)
      expect(session).toBeNull()
    })
  })

  describe('refreshSession', () => {
    it('should extend session expiry', async () => {
      const sessionId = await sessionManager.createSession({
        userId: 'user-1',
        accountId: 'account-1',
        role: 'admin',
      })

      await sessionManager.refreshSession(sessionId)

      const session = await sessionManager.getSession(sessionId)
      expect(session).toBeDefined()
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:run -- src/server/lib/session.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/lib/session.test.ts
git commit -m "test: add session manager tests"
```

---

## Task 7: OAuth Library Tests

**Files:**
- Create: `src/server/lib/oauth.test.ts`
- Reference: `src/server/lib/oauth.ts`

**Step 1: Write tests**

```typescript
// src/server/lib/oauth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateState, generateCodeVerifier, generateCodeChallenge, buildGoogleAuthUrl, exchangeCodeForTokens } from './oauth'

// Mock fetch for token exchange
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('OAuth utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateState', () => {
    it('should generate random state string', () => {
      const state = generateState()
      expect(typeof state).toBe('string')
      expect(state.length).toBeGreaterThan(0)
    })

    it('should generate unique states', () => {
      const state1 = generateState()
      const state2 = generateState()
      expect(state1).not.toBe(state2)
    })
  })

  describe('generateCodeVerifier', () => {
    it('should generate code verifier of correct length', () => {
      const verifier = generateCodeVerifier()
      expect(verifier.length).toBeGreaterThanOrEqual(43)
      expect(verifier.length).toBeLessThanOrEqual(128)
    })
  })

  describe('generateCodeChallenge', () => {
    it('should generate code challenge from verifier', async () => {
      const verifier = generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)

      expect(typeof challenge).toBe('string')
      expect(challenge.length).toBeGreaterThan(0)
    })
  })

  describe('buildGoogleAuthUrl', () => {
    it('should build valid Google OAuth URL', () => {
      const url = buildGoogleAuthUrl({
        clientId: 'test-client-id',
        redirectUri: 'http://localhost:3000/callback',
        state: 'test-state',
        codeChallenge: 'test-challenge',
      })

      expect(url).toContain('accounts.google.com')
      expect(url).toContain('client_id=test-client-id')
      expect(url).toContain('state=test-state')
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-access-token',
          id_token: 'test-id-token',
        }),
      })

      const tokens = await exchangeCodeForTokens({
        code: 'auth-code',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'http://localhost/callback',
        codeVerifier: 'verifier',
      })

      expect(tokens.access_token).toBe('test-access-token')
    })

    it('should throw error when exchange fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      })

      await expect(
        exchangeCodeForTokens({
          code: 'invalid-code',
          clientId: 'client-id',
          clientSecret: 'client-secret',
          redirectUri: 'http://localhost/callback',
          codeVerifier: 'verifier',
        })
      ).rejects.toThrow()
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:run -- src/server/lib/oauth.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/lib/oauth.test.ts
git commit -m "test: add OAuth utility tests"
```

---

## Task 8: Email Library Tests

**Files:**
- Create: `src/server/lib/email.test.ts`
- Reference: `src/server/lib/email.ts`

**Step 1: Write tests**

```typescript
// src/server/lib/email.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendInvitationEmail } from './email'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Email utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendInvitationEmail', () => {
    const mockEnv = {
      RESEND_API_KEY: 'test-api-key',
      APP_URL: 'http://localhost:3000',
    } as any

    it('should send invitation email successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-id' }),
      })

      await sendInvitationEmail(mockEnv, {
        to: 'invite@test.com',
        inviterName: 'John Doe',
        accountName: 'Test Account',
        inviteToken: 'token-123',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      )
    })

    it('should throw error when API call fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      })

      await expect(
        sendInvitationEmail(mockEnv, {
          to: 'invite@test.com',
          inviterName: 'John',
          accountName: 'Account',
          inviteToken: 'token',
        })
      ).rejects.toThrow()
    })

    it('should include correct invite link in email', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'email-id' }),
      })

      await sendInvitationEmail(mockEnv, {
        to: 'invite@test.com',
        inviterName: 'John',
        accountName: 'Account',
        inviteToken: 'my-token',
      })

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.html).toContain('my-token')
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:run -- src/server/lib/email.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/lib/email.test.ts
git commit -m "test: add email utility tests"
```

---

## Task 9: R2 Storage Library Tests

**Files:**
- Create: `src/server/lib/r2-storage.test.ts`
- Reference: `src/server/lib/r2-storage.ts`

**Step 1: Write tests**

```typescript
// src/server/lib/r2-storage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { R2StorageService } from './r2-storage'
import { MockR2Bucket } from '../__tests__/mocks/r2'

describe('R2StorageService', () => {
  let bucket: MockR2Bucket
  let storage: R2StorageService

  beforeEach(() => {
    bucket = new MockR2Bucket()
    storage = new R2StorageService(bucket as any)
  })

  describe('upload', () => {
    it('should upload file and return key', async () => {
      const file = new Blob(['test content'], { type: 'text/plain' })

      const key = await storage.upload('test.txt', file)

      expect(key).toBeDefined()
      expect(typeof key).toBe('string')
    })

    it('should store file with correct content type', async () => {
      const file = new Blob(['{}'], { type: 'application/json' })

      const key = await storage.upload('data.json', file)
      const stored = await bucket.get(key)

      expect(stored?.httpMetadata?.contentType).toBe('application/json')
    })
  })

  describe('download', () => {
    it('should return null for non-existent file', async () => {
      const result = await storage.download('non-existent.txt')
      expect(result).toBeNull()
    })

    it('should return file content for existing file', async () => {
      const content = 'test file content'
      const file = new Blob([content], { type: 'text/plain' })
      const key = await storage.upload('test.txt', file)

      const result = await storage.download(key)

      expect(result).not.toBeNull()
    })
  })

  describe('delete', () => {
    it('should remove file from bucket', async () => {
      const file = new Blob(['content'], { type: 'text/plain' })
      const key = await storage.upload('delete-me.txt', file)

      await storage.delete(key)

      const result = await storage.download(key)
      expect(result).toBeNull()
    })
  })

  describe('list', () => {
    it('should return list of files with prefix', async () => {
      await storage.upload('folder/file1.txt', new Blob(['1']))
      await storage.upload('folder/file2.txt', new Blob(['2']))
      await storage.upload('other/file3.txt', new Blob(['3']))

      const files = await storage.list('folder/')

      expect(files.length).toBe(2)
    })
  })

  describe('getSignedUrl', () => {
    it('should generate signed URL for file', async () => {
      const file = new Blob(['content'])
      const key = await storage.upload('signed.txt', file)

      const url = await storage.getSignedUrl(key, 3600)

      expect(url).toContain(key)
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:run -- src/server/lib/r2-storage.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/lib/r2-storage.test.ts
git commit -m "test: add R2 storage service tests"
```

---

## Task 10: Tokens Library Tests

**Files:**
- Modify: `src/server/lib/tokens.test.ts` (create if not exists)
- Reference: `src/server/lib/tokens.ts`

**Step 1: Write tests**

```typescript
// src/server/lib/tokens.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
} from './tokens'

describe('Token utilities', () => {
  const mockEnv = {
    JWT_SECRET: 'test-secret-key-for-jwt-signing',
  } as any

  describe('createAccessToken', () => {
    it('should create valid JWT token', async () => {
      const token = await createAccessToken(mockEnv, {
        userId: 'user-1',
        accountId: 'account-1',
        role: 'admin',
      })

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
    })
  })

  describe('verifyAccessToken', () => {
    it('should verify valid token', async () => {
      const token = await createAccessToken(mockEnv, {
        userId: 'user-1',
        accountId: 'account-1',
        role: 'admin',
      })

      const payload = await verifyAccessToken(mockEnv, token)

      expect(payload.userId).toBe('user-1')
      expect(payload.accountId).toBe('account-1')
    })

    it('should throw for invalid token', async () => {
      await expect(
        verifyAccessToken(mockEnv, 'invalid-token')
      ).rejects.toThrow()
    })
  })

  describe('generateRefreshToken', () => {
    it('should generate unique tokens', () => {
      const token1 = generateRefreshToken()
      const token2 = generateRefreshToken()

      expect(token1).not.toBe(token2)
    })

    it('should generate tokens of consistent length', () => {
      const token = generateRefreshToken()
      expect(token.length).toBeGreaterThan(32)
    })
  })

  describe('hashToken', () => {
    it('should hash token consistently', () => {
      const token = 'my-refresh-token'
      const hash1 = hashToken(token)
      const hash2 = hashToken(token)

      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token-1')
      const hash2 = hashToken('token-2')

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('getRefreshTokenExpiry', () => {
    it('should return future date', () => {
      const expiry = getRefreshTokenExpiry()
      const expiryDate = new Date(expiry)
      const now = new Date()

      expect(expiryDate.getTime()).toBeGreaterThan(now.getTime())
    })

    it('should return ISO string format', () => {
      const expiry = getRefreshTokenExpiry()
      expect(expiry).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:run -- src/server/lib/tokens.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/lib/tokens.test.ts
git commit -m "test: add token utility tests"
```

---

## Task 11: Accounts Routes Tests

**Files:**
- Create: `src/server/routes/accounts/__tests__/handlers.test.ts`
- Reference: `src/server/routes/accounts/handlers.ts`

**Step 1: Write tests**

```typescript
// src/server/routes/accounts/__tests__/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { testClient } from 'hono/testing'
import { accountsRoutes } from '../routes'

// Mock accountsService
vi.mock('../../../services', () => ({
  accountsService: {
    findAll: vi.fn().mockResolvedValue({
      data: [{ id: 'acc-1', name: 'Test Account' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    }),
    findById: vi.fn().mockResolvedValue({ id: 'acc-1', name: 'Test Account' }),
    update: vi.fn().mockResolvedValue({ id: 'acc-1', name: 'Updated Account' }),
    delete: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue({ id: 'acc-1', name: 'Restored Account' }),
  },
}))

function createTestApp() {
  const app = new Hono()

  // Add mock middleware
  app.use('*', async (c, next) => {
    c.set('db', {})
    c.set('accountId', 'acc-1')
    c.set('user', { id: 'user-1', email: 'test@test.com' })
    c.set('userRole', 'admin')
    c.set('transactionId', 'tx-1')
    c.set('ip', '127.0.0.1')
    c.set('userAgent', 'test')
    await next()
  })

  app.route('/accounts', accountsRoutes)
  return app
}

describe('Accounts Routes', () => {
  describe('GET /accounts', () => {
    it('should return list of accounts', async () => {
      const app = createTestApp()
      const res = await app.request('/accounts?page=1&limit=10')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeDefined()
    })
  })

  describe('GET /accounts/:id', () => {
    it('should return account by id', async () => {
      const app = createTestApp()
      const res = await app.request('/accounts/acc-1')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe('acc-1')
    })
  })

  describe('PATCH /accounts/:id', () => {
    it('should update account', async () => {
      const app = createTestApp()
      const res = await app.request('/accounts/acc-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Account' }),
      })

      expect(res.status).toBe(200)
    })
  })

  describe('DELETE /accounts/:id', () => {
    it('should delete account', async () => {
      const app = createTestApp()
      const res = await app.request('/accounts/acc-1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
    })
  })

  describe('POST /accounts/:id/restore', () => {
    it('should restore deleted account', async () => {
      const app = createTestApp()
      const res = await app.request('/accounts/acc-1/restore', {
        method: 'POST',
      })

      expect(res.status).toBe(200)
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:run -- src/server/routes/accounts/__tests__/handlers.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/routes/accounts/__tests__/handlers.test.ts
git commit -m "test: add accounts routes tests"
```

---

## Task 12: Storage Routes Tests

**Files:**
- Create: `src/server/routes/storage/__tests__/handlers.test.ts`
- Reference: `src/server/routes/storage/handlers.ts`

**Step 1: Write tests**

```typescript
// src/server/routes/storage/__tests__/handlers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { storageRoutes } from '../routes'
import { MockR2Bucket } from '../../../__tests__/mocks/r2'

vi.mock('../../../lib/r2-storage', () => ({
  R2StorageService: vi.fn().mockImplementation(() => ({
    upload: vi.fn().mockResolvedValue('files/test-file.txt'),
    download: vi.fn().mockResolvedValue(new Blob(['content'])),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([
      { key: 'files/file1.txt', size: 100 },
      { key: 'files/file2.txt', size: 200 },
    ]),
    getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com'),
  })),
}))

function createTestApp() {
  const app = new Hono()

  app.use('*', async (c, next) => {
    c.set('db', {})
    c.set('accountId', 'acc-1')
    c.set('user', { id: 'user-1' })
    c.set('userRole', 'admin')
    c.env = { STORAGE_BUCKET: new MockR2Bucket() }
    await next()
  })

  app.route('/storage', storageRoutes)
  return app
}

describe('Storage Routes', () => {
  describe('POST /storage/upload', () => {
    it('should upload file', async () => {
      const app = createTestApp()
      const formData = new FormData()
      formData.append('file', new Blob(['test content']), 'test.txt')

      const res = await app.request('/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(201)
    })
  })

  describe('GET /storage/files', () => {
    it('should list files', async () => {
      const app = createTestApp()
      const res = await app.request('/storage/files')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
    })
  })

  describe('GET /storage/files/:key', () => {
    it('should download file', async () => {
      const app = createTestApp()
      const res = await app.request('/storage/files/test-file.txt')

      expect(res.status).toBe(200)
    })
  })

  describe('DELETE /storage/files/:key', () => {
    it('should delete file', async () => {
      const app = createTestApp()
      const res = await app.request('/storage/files/test-file.txt', {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
    })
  })

  describe('GET /storage/signed-url/:key', () => {
    it('should generate signed URL', async () => {
      const app = createTestApp()
      const res = await app.request('/storage/signed-url/test-file.txt')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.url).toBeDefined()
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:run -- src/server/routes/storage/__tests__/handlers.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/routes/storage/__tests__/handlers.test.ts
git commit -m "test: add storage routes tests"
```

---

## Task 13: Invitations Routes Tests

**Files:**
- Create: `src/server/routes/invitations/__tests__/handlers.test.ts`
- Reference: `src/server/routes/invitations/handlers.ts`

**Step 1: Write tests**

```typescript
// src/server/routes/invitations/__tests__/handlers.test.ts
import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { invitationsRoutes } from '../routes'

vi.mock('../../../services', () => ({
  invitationsService: {
    create: vi.fn().mockResolvedValue({
      invited: true,
      invitation: { id: 'inv-1', email: 'test@test.com', role: 'member' },
    }),
    list: vi.fn().mockResolvedValue([
      { id: 'inv-1', email: 'a@test.com', role: 'member' },
      { id: 'inv-2', email: 'b@test.com', role: 'admin' },
    ]),
    cancel: vi.fn().mockResolvedValue(undefined),
    accept: vi.fn().mockResolvedValue(undefined),
  },
}))

function createTestApp() {
  const app = new Hono()

  app.use('*', async (c, next) => {
    c.set('db', {})
    c.set('accountId', 'acc-1')
    c.set('user', { id: 'user-1', email: 'admin@test.com', name: 'Admin' })
    c.set('userRole', 'admin')
    c.set('transactionId', 'tx-1')
    c.set('ip', '127.0.0.1')
    c.set('userAgent', 'test')
    c.env = { RESEND_API_KEY: 'test-key' }
    await next()
  })

  app.route('/invitations', invitationsRoutes)
  return app
}

describe('Invitations Routes', () => {
  describe('POST /invitations', () => {
    it('should create invitation', async () => {
      const app = createTestApp()
      const res = await app.request('/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'newuser@test.com', role: 'member' }),
      })

      expect(res.status).toBe(201)
    })
  })

  describe('GET /invitations', () => {
    it('should list invitations', async () => {
      const app = createTestApp()
      const res = await app.request('/invitations')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body)).toBe(true)
    })
  })

  describe('DELETE /invitations/:id', () => {
    it('should cancel invitation', async () => {
      const app = createTestApp()
      const res = await app.request('/invitations/inv-1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(204)
    })
  })

  describe('POST /invitations/:token/accept', () => {
    it('should accept invitation', async () => {
      const app = createTestApp()
      const res = await app.request('/invitations/valid-token/accept', {
        method: 'POST',
      })

      expect(res.status).toBe(200)
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:run -- src/server/routes/invitations/__tests__/handlers.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/routes/invitations/__tests__/handlers.test.ts
git commit -m "test: add invitations routes tests"
```

---

## Task 14: Audits Routes Tests

**Files:**
- Create: `src/server/routes/audits/__tests__/handlers.test.ts`
- Reference: `src/server/routes/audits/handlers.ts`

**Step 1: Write tests**

```typescript
// src/server/routes/audits/__tests__/handlers.test.ts
import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { auditsRoutes } from '../routes'

vi.mock('../../../services', () => ({
  auditsService: {
    findAll: vi.fn().mockResolvedValue({
      data: [
        { id: 'log-1', action: 'create', entityType: 'user', createdAt: '2025-01-01' },
        { id: 'log-2', action: 'update', entityType: 'account', createdAt: '2025-01-02' },
      ],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    }),
  },
}))

function createTestApp() {
  const app = new Hono()

  app.use('*', async (c, next) => {
    c.set('db', {})
    c.set('accountId', 'acc-1')
    c.set('user', { id: 'user-1' })
    c.set('userRole', 'admin')
    c.set('transactionId', 'tx-1')
    c.set('ip', '127.0.0.1')
    c.set('userAgent', 'test')
    await next()
  })

  app.route('/audits', auditsRoutes)
  return app
}

describe('Audits Routes', () => {
  describe('GET /audits', () => {
    it('should return paginated audit logs', async () => {
      const app = createTestApp()
      const res = await app.request('/audits?page=1&limit=10')

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(body.pagination).toBeDefined()
    })

    it('should filter by entityType', async () => {
      const app = createTestApp()
      const res = await app.request('/audits?entityType=user')

      expect(res.status).toBe(200)
    })

    it('should filter by action', async () => {
      const app = createTestApp()
      const res = await app.request('/audits?action=create')

      expect(res.status).toBe(200)
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:run -- src/server/routes/audits/__tests__/handlers.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/routes/audits/__tests__/handlers.test.ts
git commit -m "test: add audits routes tests"
```

---

## Task 15: Shared Schemas Tests

**Files:**
- Create: `src/shared/schemas/__tests__/schemas.test.ts`
- Reference: `src/shared/schemas/*.ts`

**Step 1: Write tests**

```typescript
// src/shared/schemas/__tests__/schemas.test.ts
import { describe, it, expect } from 'vitest'
import { userSchema, createUserSchema, updateUserSchema } from '../user'
import { accountSchema, createAccountSchema, updateAccountSchema } from '../account'
import { invitationSchema, createInvitationSchema } from '../invitation'

describe('Shared Schemas', () => {
  describe('userSchema', () => {
    it('should validate valid user', () => {
      const validUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }

      const result = userSchema.safeParse(validUser)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const invalidUser = {
        id: 'user-1',
        email: 'not-an-email',
        name: 'Test',
      }

      const result = userSchema.safeParse(invalidUser)
      expect(result.success).toBe(false)
    })
  })

  describe('createUserSchema', () => {
    it('should validate user creation input', () => {
      const input = {
        email: 'new@example.com',
        name: 'New User',
      }

      const result = createUserSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('should require email', () => {
      const input = { name: 'No Email' }

      const result = createUserSchema.safeParse(input)
      expect(result.success).toBe(false)
    })
  })

  describe('accountSchema', () => {
    it('should validate valid account', () => {
      const validAccount = {
        id: 'acc-1',
        name: 'Test Account',
        slug: 'test-account',
        createdAt: '2025-01-01T00:00:00Z',
      }

      const result = accountSchema.safeParse(validAccount)
      expect(result.success).toBe(true)
    })
  })

  describe('invitationSchema', () => {
    it('should validate valid invitation', () => {
      const validInvitation = {
        id: 'inv-1',
        email: 'invite@example.com',
        role: 'member',
        expiresAt: '2025-01-07T00:00:00Z',
      }

      const result = invitationSchema.safeParse(validInvitation)
      expect(result.success).toBe(true)
    })

    it('should validate role enum', () => {
      const invalidRole = {
        id: 'inv-1',
        email: 'invite@example.com',
        role: 'invalid-role',
        expiresAt: '2025-01-07T00:00:00Z',
      }

      const result = invitationSchema.safeParse(invalidRole)
      expect(result.success).toBe(false)
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:run -- src/shared/schemas/__tests__/schemas.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/shared/schemas/__tests__/schemas.test.ts
git commit -m "test: add shared schemas validation tests"
```

---

## Task 16: Frontend Account Page Tests

**Files:**
- Create: `src/client/routes/__authenticated/__tests__/account.test.tsx`
- Reference: `src/client/routes/__authenticated/account.tsx`

**Step 1: Write tests**

```typescript
// src/client/routes/__authenticated/__tests__/account.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the API hooks
vi.mock('@/hooks/use-account', () => ({
  useAccount: vi.fn(() => ({
    data: {
      id: 'acc-1',
      name: 'Test Account',
      slug: 'test-account',
      createdAt: '2025-01-01',
    },
    isLoading: false,
  })),
  useUpdateAccount: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}))

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', email: 'test@test.com', name: 'Test User' },
    isAuthenticated: true,
  })),
}))

// Import after mocks
import AccountPage from '../account'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('Account Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render account name', async () => {
    render(<AccountPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Test Account')).toBeInTheDocument()
    })
  })

  it('should render account settings form', async () => {
    render(<AccountPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    })
  })

  it('should show loading state', async () => {
    const { useAccount } = await import('@/hooks/use-account')
    vi.mocked(useAccount).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any)

    render(<AccountPage />, { wrapper: createWrapper() })

    expect(screen.getByRole('status')).toBeInTheDocument() // Loading spinner
  })

  it('should handle form submission', async () => {
    const user = userEvent.setup()
    const mockMutate = vi.fn()
    const { useUpdateAccount } = await import('@/hooks/use-account')
    vi.mocked(useUpdateAccount).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any)

    render(<AccountPage />, { wrapper: createWrapper() })

    const nameInput = screen.getByLabelText(/name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Account')

    const submitButton = screen.getByRole('button', { name: /save/i })
    await user.click(submitButton)

    expect(mockMutate).toHaveBeenCalled()
  })
})
```

**Step 2: Run tests**

Run: `npm run test:client -- run src/client/routes/__authenticated/__tests__/account.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/client/routes/__authenticated/__tests__/account.test.tsx
git commit -m "test: add account page tests"
```

---

## Task 17: Frontend Team Page Tests

**Files:**
- Create: `src/client/routes/__authenticated/__tests__/team.test.tsx`
- Reference: `src/client/routes/__authenticated/team.tsx`

**Step 1: Write tests**

```typescript
// src/client/routes/__authenticated/__tests__/team.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/hooks/use-team', () => ({
  useTeamMembers: vi.fn(() => ({
    data: [
      { id: 'user-1', name: 'Alice', email: 'alice@test.com', role: 'admin' },
      { id: 'user-2', name: 'Bob', email: 'bob@test.com', role: 'member' },
    ],
    isLoading: false,
  })),
  useInvitations: vi.fn(() => ({
    data: [
      { id: 'inv-1', email: 'pending@test.com', role: 'member', expiresAt: '2025-01-07' },
    ],
    isLoading: false,
  })),
  useInviteMember: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useRemoveMember: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useCancelInvitation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}))

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', role: 'admin' },
    isAuthenticated: true,
  })),
}))

import TeamPage from '../team'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('Team Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render team members list', async () => {
    render(<TeamPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })
  })

  it('should render pending invitations', async () => {
    render(<TeamPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('pending@test.com')).toBeInTheDocument()
    })
  })

  it('should show invite form for admins', async () => {
    render(<TeamPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /invite/i })).toBeInTheDocument()
    })
  })

  it('should handle invite submission', async () => {
    const user = userEvent.setup()
    const mockMutate = vi.fn()
    const { useInviteMember } = await import('@/hooks/use-team')
    vi.mocked(useInviteMember).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any)

    render(<TeamPage />, { wrapper: createWrapper() })

    const emailInput = screen.getByPlaceholderText(/email/i)
    await user.type(emailInput, 'newmember@test.com')

    const inviteButton = screen.getByRole('button', { name: /invite/i })
    await user.click(inviteButton)

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'newmember@test.com' })
    )
  })

  it('should show role badges', async () => {
    render(<TeamPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument()
      expect(screen.getByText('member')).toBeInTheDocument()
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:client -- run src/client/routes/__authenticated/__tests__/team.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/client/routes/__authenticated/__tests__/team.test.tsx
git commit -m "test: add team page tests"
```

---

## Task 18: Frontend Settings Page Tests

**Files:**
- Create: `src/client/routes/__authenticated/__tests__/settings.test.tsx`
- Reference: `src/client/routes/__authenticated/settings.tsx`

**Step 1: Write tests**

```typescript
// src/client/routes/__authenticated/__tests__/settings.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
    },
    isAuthenticated: true,
  })),
  useUpdateProfile: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useLogout: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}))

import SettingsPage from '../settings'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render user profile section', async () => {
    render(<SettingsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
      expect(screen.getByText('test@test.com')).toBeInTheDocument()
    })
  })

  it('should render profile form with current values', async () => {
    render(<SettingsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      const nameInput = screen.getByLabelText(/name/i)
      expect(nameInput).toHaveValue('Test User')
    })
  })

  it('should handle profile update', async () => {
    const user = userEvent.setup()
    const mockMutate = vi.fn()
    const { useUpdateProfile } = await import('@/hooks/use-auth')
    vi.mocked(useUpdateProfile).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any)

    render(<SettingsPage />, { wrapper: createWrapper() })

    const nameInput = screen.getByLabelText(/name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Name')

    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    expect(mockMutate).toHaveBeenCalled()
  })

  it('should have logout button', async () => {
    render(<SettingsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /logout|sign out/i })).toBeInTheDocument()
    })
  })

  it('should handle logout', async () => {
    const user = userEvent.setup()
    const mockMutate = vi.fn()
    const { useLogout } = await import('@/hooks/use-auth')
    vi.mocked(useLogout).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any)

    render(<SettingsPage />, { wrapper: createWrapper() })

    const logoutButton = screen.getByRole('button', { name: /logout|sign out/i })
    await user.click(logoutButton)

    expect(mockMutate).toHaveBeenCalled()
  })
})
```

**Step 2: Run tests**

Run: `npm run test:client -- run src/client/routes/__authenticated/__tests__/settings.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/client/routes/__authenticated/__tests__/settings.test.tsx
git commit -m "test: add settings page tests"
```

---

## Task 19: Frontend Integrations Page Tests

**Files:**
- Create: `src/client/routes/__authenticated/__tests__/integrations.test.tsx`
- Reference: `src/client/routes/__authenticated/integrations.tsx`

**Step 1: Write tests**

```typescript
// src/client/routes/__authenticated/__tests__/integrations.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/hooks/use-integrations', () => ({
  useIntegrations: vi.fn(() => ({
    data: [
      { id: 'int-1', name: 'Slack', status: 'connected', icon: 'slack' },
      { id: 'int-2', name: 'GitHub', status: 'disconnected', icon: 'github' },
    ],
    isLoading: false,
  })),
  useConnectIntegration: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useDisconnectIntegration: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}))

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', role: 'admin' },
    isAuthenticated: true,
  })),
}))

import IntegrationsPage from '../integrations'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('Integrations Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render integrations list', async () => {
    render(<IntegrationsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Slack')).toBeInTheDocument()
      expect(screen.getByText('GitHub')).toBeInTheDocument()
    })
  })

  it('should show connected status', async () => {
    render(<IntegrationsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument()
    })
  })

  it('should show connect button for disconnected integrations', async () => {
    render(<IntegrationsPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      const connectButtons = screen.getAllByRole('button', { name: /connect/i })
      expect(connectButtons.length).toBeGreaterThan(0)
    })
  })

  it('should handle connect action', async () => {
    const user = userEvent.setup()
    const mockMutate = vi.fn()
    const { useConnectIntegration } = await import('@/hooks/use-integrations')
    vi.mocked(useConnectIntegration).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any)

    render(<IntegrationsPage />, { wrapper: createWrapper() })

    await waitFor(async () => {
      const connectButton = screen.getAllByRole('button', { name: /connect/i })[0]
      await user.click(connectButton)
    })

    expect(mockMutate).toHaveBeenCalled()
  })

  it('should handle disconnect action', async () => {
    const user = userEvent.setup()
    const mockMutate = vi.fn()
    const { useDisconnectIntegration } = await import('@/hooks/use-integrations')
    vi.mocked(useDisconnectIntegration).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any)

    render(<IntegrationsPage />, { wrapper: createWrapper() })

    await waitFor(async () => {
      const disconnectButton = screen.getByRole('button', { name: /disconnect/i })
      await user.click(disconnectButton)
    })

    expect(mockMutate).toHaveBeenCalled()
  })

  it('should show loading state', async () => {
    const { useIntegrations } = await import('@/hooks/use-integrations')
    vi.mocked(useIntegrations).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any)

    render(<IntegrationsPage />, { wrapper: createWrapper() })

    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
```

**Step 2: Run tests**

Run: `npm run test:client -- run src/client/routes/__authenticated/__tests__/integrations.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/client/routes/__authenticated/__tests__/integrations.test.tsx
git commit -m "test: add integrations page tests"
```

---

## Task 20: Frontend Invite Token Page Tests

**Files:**
- Create: `src/client/routes/__tests__/invite-token.test.tsx`
- Reference: `src/client/routes/invite.$token.tsx`

**Step 1: Write tests**

```typescript
// src/client/routes/__tests__/invite-token.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/hooks/use-invitation', () => ({
  useInvitationDetails: vi.fn(() => ({
    data: {
      id: 'inv-1',
      email: 'invited@test.com',
      accountName: 'Test Account',
      inviterName: 'Admin User',
      role: 'member',
      expiresAt: '2025-01-07T00:00:00Z',
    },
    isLoading: false,
    error: null,
  })),
  useAcceptInvitation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
  })),
}))

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', email: 'invited@test.com' },
    isAuthenticated: true,
  })),
}))

// Mock route params
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: vi.fn(() => ({ token: 'valid-token' })),
  }
})

import InviteTokenPage from '../invite.$token'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('Invite Token Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render invitation details', async () => {
    render(<InviteTokenPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Test Account')).toBeInTheDocument()
      expect(screen.getByText(/Admin User/)).toBeInTheDocument()
    })
  })

  it('should show accept button', async () => {
    render(<InviteTokenPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
    })
  })

  it('should handle accept invitation', async () => {
    const user = userEvent.setup()
    const mockMutate = vi.fn()
    const { useAcceptInvitation } = await import('@/hooks/use-invitation')
    vi.mocked(useAcceptInvitation).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
    } as any)

    render(<InviteTokenPage />, { wrapper: createWrapper() })

    await waitFor(async () => {
      const acceptButton = screen.getByRole('button', { name: /accept/i })
      await user.click(acceptButton)
    })

    expect(mockMutate).toHaveBeenCalled()
  })

  it('should show error for expired invitation', async () => {
    const { useInvitationDetails } = await import('@/hooks/use-invitation')
    vi.mocked(useInvitationDetails).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Invitation expired'),
    } as any)

    render(<InviteTokenPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/expired|invalid/i)).toBeInTheDocument()
    })
  })

  it('should show loading state', async () => {
    const { useInvitationDetails } = await import('@/hooks/use-invitation')
    vi.mocked(useInvitationDetails).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any)

    render(<InviteTokenPage />, { wrapper: createWrapper() })

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should show success state after accepting', async () => {
    const { useAcceptInvitation } = await import('@/hooks/use-invitation')
    vi.mocked(useAcceptInvitation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: true,
    } as any)

    render(<InviteTokenPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/success|joined/i)).toBeInTheDocument()
    })
  })
})
```

**Step 2: Run tests**

Run: `npm run test:client -- run src/client/routes/__tests__/invite-token.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/client/routes/__tests__/invite-token.test.tsx
git commit -m "test: add invite token page tests"
```

---

## Task 21: Tabs Component Tests

**Files:**
- Create: `src/client/components/ui/__tests__/tabs.test.tsx`
- Reference: `src/client/components/ui/tabs.tsx`

**Step 1: Write tests**

```typescript
// src/client/components/ui/__tests__/tabs.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs'

describe('Tabs Component', () => {
  it('should render tabs with triggers', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeInTheDocument()
  })

  it('should show default tab content', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    expect(screen.getByText('Content 1')).toBeVisible()
  })

  it('should switch tabs on click', async () => {
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    await user.click(screen.getByRole('tab', { name: 'Tab 2' }))

    expect(screen.getByText('Content 2')).toBeVisible()
  })

  it('should mark active tab as selected', async () => {
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    const tab1 = screen.getByRole('tab', { name: 'Tab 1' })
    const tab2 = screen.getByRole('tab', { name: 'Tab 2' })

    expect(tab1).toHaveAttribute('aria-selected', 'true')
    expect(tab2).toHaveAttribute('aria-selected', 'false')

    await user.click(tab2)

    expect(tab1).toHaveAttribute('aria-selected', 'false')
    expect(tab2).toHaveAttribute('aria-selected', 'true')
  })

  it('should support disabled tabs', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2" disabled>Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )

    expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeDisabled()
  })

  it('should apply custom className', () => {
    render(
      <Tabs defaultValue="tab1" className="custom-tabs">
        <TabsList className="custom-list">
          <TabsTrigger value="tab1" className="custom-trigger">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="custom-content">Content 1</TabsContent>
      </Tabs>
    )

    expect(screen.getByRole('tablist')).toHaveClass('custom-list')
  })

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3">Tab 3</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
        <TabsContent value="tab3">Content 3</TabsContent>
      </Tabs>
    )

    const tab1 = screen.getByRole('tab', { name: 'Tab 1' })
    tab1.focus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveFocus()
  })
})
```

**Step 2: Run tests**

Run: `npm run test:client -- run src/client/components/ui/__tests__/tabs.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/client/components/ui/__tests__/tabs.test.tsx
git commit -m "test: add tabs component tests"
```

---

## Task 22: Update Coverage Thresholds

**Files:**
- Modify: `vitest.config.ts`
- Modify: `vitest.config.frontend.ts`

**Step 1: Update backend thresholds**

```typescript
// vitest.config.ts - update thresholds section
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
```

**Step 2: Update frontend thresholds**

```typescript
// vitest.config.frontend.ts - update thresholds section
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
      },
```

**Step 3: Run all tests to verify coverage**

Run: `npm run test:coverage && npm run test:coverage:client`
Expected: All thresholds met

**Step 4: Commit**

```bash
git add vitest.config.ts vitest.config.frontend.ts
git commit -m "chore: update coverage thresholds to target values (90%/85%)"
```

---

## Task 23: Run Full Test Suite and Verify Coverage

**Step 1: Run all backend tests with coverage**

Run: `npm run test:coverage`
Expected:
- All tests pass
- Coverage >= 90% for statements, branches, functions, lines

**Step 2: Run all frontend tests with coverage**

Run: `npm run test:coverage:client`
Expected:
- All tests pass
- Coverage >= 85% for statements, branches, functions, lines

**Step 3: Run E2E tests**

Run: `npm run test:e2e -- --project=chromium-unauth`
Expected: All E2E tests pass

**Step 4: Commit final verification**

```bash
git add -A
git commit -m "test: complete coverage targets (90% backend, 85% frontend)"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1-2 | Auth service tests | `services/__tests__/auth.test.ts` |
| 3-4 | Invitations service tests | `services/__tests__/invitations.test.ts` |
| 5 | Audits service tests | `services/__tests__/audits.test.ts` |
| 6 | Session lib tests | `lib/session.test.ts` |
| 7 | OAuth lib tests | `lib/oauth.test.ts` |
| 8 | Email lib tests | `lib/email.test.ts` |
| 9 | R2 storage tests | `lib/r2-storage.test.ts` |
| 10 | Tokens lib tests | `lib/tokens.test.ts` |
| 11 | Accounts routes tests | `routes/accounts/__tests__/handlers.test.ts` |
| 12 | Storage routes tests | `routes/storage/__tests__/handlers.test.ts` |
| 13 | Invitations routes tests | `routes/invitations/__tests__/handlers.test.ts` |
| 14 | Audits routes tests | `routes/audits/__tests__/handlers.test.ts` |
| 15 | Shared schemas tests | `shared/schemas/__tests__/schemas.test.ts` |
| 16 | Account page tests | `routes/__authenticated/__tests__/account.test.tsx` |
| 17 | Team page tests | `routes/__authenticated/__tests__/team.test.tsx` |
| 18 | Settings page tests | `routes/__authenticated/__tests__/settings.test.tsx` |
| 19 | Integrations page tests | `routes/__authenticated/__tests__/integrations.test.tsx` |
| 20 | Invite token page tests | `routes/__tests__/invite-token.test.tsx` |
| 21 | Tabs component tests | `components/ui/__tests__/tabs.test.tsx` |
| 22 | Update thresholds | `vitest.config.ts`, `vitest.config.frontend.ts` |
| 23 | Final verification | Run all tests |

## Coverage Targets (Updated)

| Layer | Statements | Branches | Functions | Lines |
|-------|------------|----------|-----------|-------|
| **Shared** | **95%** | **90%** | **95%** | **95%** |
| **Backend** | **90%** | **85%** | **90%** | **90%** |
| **Frontend** | **85%** | **80%** | **85%** | **85%** |
