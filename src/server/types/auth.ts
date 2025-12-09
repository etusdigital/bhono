// src/types/auth.ts
export interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  id_token: string
  scope: string
  token_type: string
  refresh_token?: string
}

export interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name: string
  picture?: string
  given_name?: string
  family_name?: string
}

export interface JWTPayload {
  sub: string
  email: string
  iat: number
  exp: number
}

export interface AuthTokens {
  accessToken: string
  expiresIn: number
}

export interface OAuthState {
  codeChallenge: string
  redirectUrl?: string
}
