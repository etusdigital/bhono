// src/routes/auth/handlers.ts
import type { RouteHandler } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  decodeIdToken,
} from '../../lib/oauth'
import { setOAuthStateCookieOptions } from '../../lib/tokens'
import { createSession, destroySession, getSession } from '../../lib/session'
import { authService } from '../../services/auth'
import { invitationsService } from '../../services/invitations'
import type { AuthEventContext } from '../../lib/audit'
import type { HonoEnv } from '../../types'
import type {
  loginRoute,
  callbackRoute,
  refreshRoute,
  logoutRoute,
  meRoute,
  inviteRoute,
} from './routes'

// Helper to extract auth context from Hono context
function getAuthContext(c: Context<HonoEnv>): AuthEventContext {
  return {
    transactionId: c.get('transactionId') ?? crypto.randomUUID(),
    ip: c.get('ip') ?? 'unknown',
    userAgent: c.get('userAgent') ?? 'unknown',
  }
}

export const loginHandler: RouteHandler<typeof loginRoute, HonoEnv> = async (c) => {
  const env = c.env
  const { redirect } = c.req.valid('query')

  const isProduction = env.ENVIRONMENT === 'production'

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state = generateState()

  // Store code verifier and state in cookie
  const oauthData = JSON.stringify({
    codeVerifier,
    state,
    redirect: redirect ?? null,
  })

  setCookie(c, 'oauth_state', oauthData, setOAuthStateCookieOptions(isProduction))

  const authUrl = buildGoogleAuthUrl(env, state, codeChallenge)
  return c.redirect(authUrl)
}

export const callbackHandler: RouteHandler<typeof callbackRoute, HonoEnv> = async (c) => {
  const db = c.get('db')
  const env = c.env
  const { code, state } = c.req.valid('query')
  const ctx = getAuthContext(c)

  if (!db) {
    throw new HTTPException(500, { message: 'Database not initialized' })
  }

  // Get stored OAuth state
  const oauthCookie = getCookie(c, 'oauth_state')
  if (!oauthCookie) {
    console.error('[AUTH CALLBACK] Missing OAuth state cookie')
    throw new HTTPException(400, { message: 'Missing OAuth state cookie' })
  }

  let oauthData: { codeVerifier: string; state: string; redirect: string | null }
  try {
    oauthData = JSON.parse(oauthCookie) as typeof oauthData
  } catch (e) {
    console.error('[AUTH CALLBACK] Invalid OAuth state cookie:', e)
    throw new HTTPException(400, { message: 'Invalid OAuth state cookie' })
  }

  // Validate state
  if (state !== oauthData.state) {
    console.error('[AUTH CALLBACK] State mismatch:', { received: state, expected: oauthData.state })
    throw new HTTPException(400, { message: 'Invalid state parameter' })
  }

  // Clear OAuth state cookie
  deleteCookie(c, 'oauth_state')

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(env, code, oauthData.codeVerifier)

  // Decode ID token to get user info
  const googleUser = decodeIdToken(tokens.id_token)

  // Find or create user
  const result = await authService.findOrCreateUser(db, env, googleUser, ctx)

  // Check for pending invitation
  const pendingInvitation = getCookie(c, 'pending_invitation')
  if (pendingInvitation) {
    deleteCookie(c, 'pending_invitation')

    const invitation = await invitationsService.getByToken(db, pendingInvitation)
    if (invitation) {
      await invitationsService.accept(db, invitation.id, result.user.id, ctx)
    }
  }

  // Create session (replaces JWT tokens)
  await createSession(c, {
    userId: result.user.id,
    email: result.user.email,
    name: result.user.name,
    avatarUrl: result.user.avatarUrl ?? null,
    isSuperAdmin: result.user.isSuperAdmin,
  })

  // Redirect to SPA (session cookie will be set automatically)
  const baseUrl = env.APP_URL || new URL(c.req.url).origin
  const redirectPath = oauthData.redirect ?? '/dashboard'
  const redirectUrl = new URL(redirectPath, baseUrl)
  return c.redirect(redirectUrl.toString(), 302)
}

export const refreshHandler: RouteHandler<typeof refreshRoute, HonoEnv> = async (c) => {
  const db = c.get('db')
  const env = c.env
  const refreshToken = getCookie(c, 'refresh_token')

  if (!db) {
    throw new HTTPException(500, { message: 'Database not initialized' })
  }

  if (!refreshToken) {
    throw new HTTPException(401, { message: 'No refresh token' })
  }

  const ctx = getAuthContext(c)
  const tokens = await authService.refreshAccessToken(db, env, refreshToken, ctx)

  return c.json({ tokens }, 200)
}

export const logoutHandler: RouteHandler<typeof logoutRoute, HonoEnv> = async (c) => {
  const db = c.get('db')
  const ctx = getAuthContext(c)
  const session = getSession(c)

  if (!db) {
    throw new HTTPException(500, { message: 'Database not initialized' })
  }

  // Log logout event if we have a session
  if (session) {
    const { logAuthEvent } = await import('../../lib/audit')
    await logAuthEvent(db, ctx, 'LOGOUT', session.userId, {})
  }

  // Destroy session (removes from KV and clears cookie)
  await destroySession(c)

  return c.json({ message: 'Logged out successfully' })
}

export const meHandler: RouteHandler<typeof meRoute, HonoEnv> = (c) => {
  const session = getSession(c)

  if (!session) {
    throw new HTTPException(401, { message: 'Not authenticated' })
  }

  // Return user data from session
  return c.json({
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      avatarUrl: session.avatarUrl,
      isSuperAdmin: session.isSuperAdmin,
    },
  })
}

export const inviteHandler: RouteHandler<typeof inviteRoute, HonoEnv> = async (c) => {
  const db = c.get('db')
  const env = c.env
  const { token } = c.req.valid('param')

  if (!db) {
    throw new HTTPException(500, { message: 'Database not initialized' })
  }

  const isProduction = env.ENVIRONMENT === 'production'

  // Validate invitation
  const invitation = await invitationsService.getByToken(db, token)

  if (!invitation) {
    throw new HTTPException(400, { message: 'Invalid or expired invitation' })
  }

  // Store invitation token in cookie
  setCookie(c, 'pending_invitation', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  })

  // Redirect to login
  return c.redirect('/auth/login')
}
