// src/shared/types/account.ts
export interface Invitation {
  id: string
  email: string
  role: string
  expiresAt: string
  createdAt: string
  invitedBy: {
    id: string
    name: string
  }
}
