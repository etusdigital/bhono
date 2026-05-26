// src/shared/types/user.ts
import type { Role } from './auth'

export interface User {
  id: string
  gatewayUserId: string | null
  email: string
  name: string | null
  picture?: string | null
  role: Role
  status: 'pending' | 'active' | 'suspended' | 'denied'
  createdAt: string
  lastLoginAt: string | null
}

export interface Account {
  id: string
  name: string
  slug: string | null
  ownerId: string
  createdAt: string
  updatedAt: string | null
}

export interface UserAccount {
  id: string
  userId: string
  accountId: string
  role: 'admin' | 'member' | 'guest'
  status: 'active' | 'pending'
  joinedAt: string | null
}
