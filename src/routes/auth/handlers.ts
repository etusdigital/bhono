// src/routes/auth/handlers.ts
import type { RouteHandler } from '@hono/zod-openapi'
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
import type {
  loginRoute,
  callbackRoute,
  refreshRoute,
  logoutRoute,
  meRoute,
} from './routes'

const isProduction = env.NODE_ENV === 'production'

export const loginHandler: RouteHandler<typeof loginRoute> = async (c) => {
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

export const callbackHandler: RouteHandler<typeof callbackRoute> = async (c) => {
  const { code, state } = c.req.valid('query')

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
  const result = await authService.findOrCreateUser(googleUser)

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

export const refreshHandler: RouteHandler<typeof refreshRoute> = async (c) => {
  const refreshToken = getCookie(c, 'refresh_token')

  if (!refreshToken) {
    throw new HTTPException(401, { message: 'No refresh token' })
  }

  const tokens = await authService.refreshAccessToken(refreshToken)

  return c.json({ tokens })
}

export const logoutHandler: RouteHandler<typeof logoutRoute> = async (c) => {
  const refreshToken = getCookie(c, 'refresh_token')

  if (refreshToken) {
    await authService.revokeRefreshToken(refreshToken)
  }

  deleteCookie(c, 'refresh_token')

  return c.json({ message: 'Logged out successfully' })
}

export const meHandler: RouteHandler<typeof meRoute> = async (c) => {
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, { message: 'Not authenticated' })
  }

  return c.json({ user })
}
