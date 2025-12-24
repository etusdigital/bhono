// src/lib/tokens.ts
import { sign } from 'hono/jwt'
import type { Env } from '../env'

export async function createAccessToken(env: Env, userId: string, email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const expiryMinutes = parseInt(String(env.JWT_EXPIRY_MINUTES) || '15', 10)
  const payload = {
    sub: userId,
    email,
    iat: now,
    exp: now + expiryMinutes * 60,
  }
  return sign(payload, env.JWT_SECRET)
}

export function generateRefreshToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getRefreshTokenExpiry(env: Env): Date {
  const expiryDays = parseInt(String(env.REFRESH_TOKEN_EXPIRY_DAYS) || '30', 10)
  const now = new Date()
  now.setDate(now.getDate() + expiryDays)
  return now
}

export function setCookieOptions(env: Env, isProduction: boolean) {
  const expiryDays = parseInt(String(env.REFRESH_TOKEN_EXPIRY_DAYS) || '30', 10)
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: expiryDays * 24 * 60 * 60,
  }
}

export function setOAuthStateCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: 10 * 60, // 10 minutes
  }
}
