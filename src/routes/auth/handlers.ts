// src/routes/auth/handlers.ts
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { env } from '../../env'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  decodeIdToken,
} from '../../lib/oauth'
import { setCookieOptions, setOAuthStateCookieOptions } from '../../lib/tokens'
import { authService } from '../../services/auth'
import type { AuthEventContext } from '../../lib/audit'

const isProduction = env.NODE_ENV === 'production'

// Helper to extract auth context from Hono context
function getAuthContext(c: any): AuthEventContext {
  return {
    transactionId: c.get('transactionId') || crypto.randomUUID(),
    ip: c.get('ip') || 'unknown',
    userAgent: c.get('userAgent') || 'unknown',
  }
}

// Note: Handler types are inferred from route definitions by @hono/zod-openapi
// Using 'any' is the standard pattern for openapi handlers
export const loginHandler = async (c: any) => {
  const { redirect } = c.req.valid('query')

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state = generateState()

  // Store code verifier and state in cookie
  const oauthData = JSON.stringify({
    codeVerifier,
    state,
    redirect: redirect || null,
  })

  setCookie(c, 'oauth_state', oauthData, setOAuthStateCookieOptions(isProduction))

  const authUrl = buildGoogleAuthUrl(state, codeChallenge)
  return c.redirect(authUrl)
}

export const callbackHandler = async (c: any) => {
  const { code, state } = c.req.valid('query')
  const ctx = getAuthContext(c)

  // Get stored OAuth state
  const oauthCookie = getCookie(c, 'oauth_state')
  if (!oauthCookie) {
    throw new HTTPException(400, { message: 'Missing OAuth state cookie' })
  }

  let oauthData: { codeVerifier: string; state: string; redirect: string | null }
  try {
    oauthData = JSON.parse(oauthCookie)
  } catch {
    throw new HTTPException(400, { message: 'Invalid OAuth state cookie' })
  }

  // Validate state
  if (state !== oauthData.state) {
    throw new HTTPException(400, { message: 'Invalid state parameter' })
  }

  // Clear OAuth state cookie
  deleteCookie(c, 'oauth_state')

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code, oauthData.codeVerifier)

  // Decode ID token to get user info
  const googleUser = decodeIdToken(tokens.id_token)

  // Find or create user
  const result = await authService.findOrCreateUser(googleUser, ctx)

  // Set refresh token cookie
  setCookie(c, 'refresh_token', result.refreshToken, setCookieOptions(isProduction))

  // If redirect URL provided, redirect with token in query (for SPA)
  if (oauthData.redirect) {
    const redirectUrl = new URL(oauthData.redirect)
    redirectUrl.searchParams.set('token', result.tokens.accessToken)
    return c.redirect(redirectUrl.toString())
  }

  return c.json({
    user: result.user,
    tokens: result.tokens,
  })
}

export const refreshHandler = async (c: any) => {
  const refreshToken = getCookie(c, 'refresh_token')

  if (!refreshToken) {
    throw new HTTPException(401, { message: 'No refresh token' })
  }

  const ctx = getAuthContext(c)
  const tokens = await authService.refreshAccessToken(refreshToken, ctx)

  return c.json({ tokens })
}

export const logoutHandler = async (c: any) => {
  const ctx = getAuthContext(c)
  const user = c.get('user')
  const refreshToken = getCookie(c, 'refresh_token')

  if (refreshToken) {
    await authService.revokeRefreshToken(refreshToken, ctx, user?.id || null)
  }

  deleteCookie(c, 'refresh_token')

  return c.json({ message: 'Logged out successfully' })
}

export const meHandler = async (c: any) => {
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, { message: 'Not authenticated' })
  }

  return c.json({ user })
}
