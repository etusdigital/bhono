// src/shared/types/auth.ts
//
// Mirror of what /auth/me returns from @etus/auth. Keep aligned with the
// package's AuthUser shape (id, email, name, picture, role).

export const Role = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  GUEST: 'guest',
} as const

export type Role = (typeof Role)[keyof typeof Role]

export interface AuthUser {
  id: string
  email: string
  name: string | null
  picture: string | null
  role: string
}
