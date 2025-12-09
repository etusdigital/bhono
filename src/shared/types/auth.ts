// src/shared/types/auth.ts
export const Role = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EDITOR: 'EDITOR',
  AUTHOR: 'AUTHOR',
  VIEWER: 'VIEWER',
  BILLING: 'BILLING',
  ANALYTICS: 'ANALYTICS',
} as const

export type Role = (typeof Role)[keyof typeof Role]

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
}

export interface AuthTokens {
  accessToken: string
  expiresIn: number
}
