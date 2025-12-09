// src/shared/types/user.ts
import type { Role } from './auth'

export interface User {
  id: string
  googleId: string
  email: string
  name: string
  avatarUrl?: string | null
  status: 'active' | 'inactive'
  isSuperAdmin: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Account {
  id: string
  name: string
  description: string | null
  domain: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface UserAccount {
  userId: string
  accountId: string
  role: Role
}
