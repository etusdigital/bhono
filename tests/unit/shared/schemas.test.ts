import { describe, it, expect } from 'vitest'
// Import from index to ensure re-exports are covered
import {
  CreateUserSchema,
  UpdateUserSchema,
  CreateAccountSchema,
  UpdateAccountSchema,
  CreateInvitationSchema,
  CreateWebhookSchema,
} from '@shared/schemas'

describe('User Schemas', () => {
  describe('CreateUserSchema', () => {
    const validRoles = ['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS'] as const

    it('should accept valid user creation data', () => {
      const validData = {
        email: 'test@example.com',
        name: 'John Doe',
        role: 'ADMIN',
      }
      const result = CreateUserSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('should accept all valid roles', () => {
      for (const role of validRoles) {
        const result = CreateUserSchema.safeParse({
          email: 'test@example.com',
          name: 'John Doe',
          role,
        })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid email format', () => {
      const invalidEmails = ['invalid', 'invalid@', '@example.com', 'test@', 'test.com', '']
      for (const email of invalidEmails) {
        const result = CreateUserSchema.safeParse({
          email,
          name: 'John Doe',
          role: 'ADMIN',
        })
        expect(result.success).toBe(false)
      }
    })

    it('should reject missing email field', () => {
      const result = CreateUserSchema.safeParse({
        name: 'John Doe',
        role: 'ADMIN',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email')
      }
    })

    it('should reject missing name field', () => {
      const result = CreateUserSchema.safeParse({
        email: 'test@example.com',
        role: 'ADMIN',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name')
      }
    })

    it('should reject empty name', () => {
      const result = CreateUserSchema.safeParse({
        email: 'test@example.com',
        name: '',
        role: 'ADMIN',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name')
      }
    })

    it('should reject missing role field', () => {
      const result = CreateUserSchema.safeParse({
        email: 'test@example.com',
        name: 'John Doe',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('role')
      }
    })

    it('should reject invalid role value', () => {
      const invalidRoles = ['admin', 'SUPERADMIN', 'USER', 'guest', '']
      for (const role of invalidRoles) {
        const result = CreateUserSchema.safeParse({
          email: 'test@example.com',
          name: 'John Doe',
          role,
        })
        expect(result.success).toBe(false)
      }
    })

    it('should accept name with minimum length (1 character)', () => {
      const result = CreateUserSchema.safeParse({
        email: 'test@example.com',
        name: 'A',
        role: 'VIEWER',
      })
      expect(result.success).toBe(true)
    })

    it('should accept name with special characters', () => {
      const result = CreateUserSchema.safeParse({
        email: 'test@example.com',
        name: "John O'Brien-Smith",
        role: 'EDITOR',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('UpdateUserSchema', () => {
    it('should accept valid update data with all fields', () => {
      const result = UpdateUserSchema.safeParse({
        name: 'Updated Name',
        status: 'active',
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty object (all fields optional)', () => {
      const result = UpdateUserSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should accept update with only name', () => {
      const result = UpdateUserSchema.safeParse({
        name: 'New Name',
      })
      expect(result.success).toBe(true)
    })

    it('should accept update with only status', () => {
      const result = UpdateUserSchema.safeParse({
        status: 'inactive',
      })
      expect(result.success).toBe(true)
    })

    it('should accept both valid status values', () => {
      for (const status of ['active', 'inactive']) {
        const result = UpdateUserSchema.safeParse({ status })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid status value', () => {
      const invalidStatuses = ['enabled', 'disabled', 'pending', 'ACTIVE', '']
      for (const status of invalidStatuses) {
        const result = UpdateUserSchema.safeParse({ status })
        expect(result.success).toBe(false)
      }
    })

    it('should reject empty name when provided', () => {
      const result = UpdateUserSchema.safeParse({
        name: '',
      })
      expect(result.success).toBe(false)
    })

    it('should accept name with minimum length when provided', () => {
      const result = UpdateUserSchema.safeParse({
        name: 'X',
      })
      expect(result.success).toBe(true)
    })
  })
})

describe('Account Schemas', () => {
  describe('CreateAccountSchema', () => {
    it('should accept valid account creation data', () => {
      const validData = {
        name: 'My Company',
        description: 'A company description',
      }
      const result = CreateAccountSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('should accept account without description (optional)', () => {
      const result = CreateAccountSchema.safeParse({
        name: 'My Company',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing name field', () => {
      const result = CreateAccountSchema.safeParse({
        description: 'Description only',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name')
      }
    })

    it('should reject empty name', () => {
      const result = CreateAccountSchema.safeParse({
        name: '',
      })
      expect(result.success).toBe(false)
    })

    it('should accept name with minimum length (1 character)', () => {
      const result = CreateAccountSchema.safeParse({
        name: 'A',
      })
      expect(result.success).toBe(true)
    })

    it('should accept name with maximum length (100 characters)', () => {
      const result = CreateAccountSchema.safeParse({
        name: 'A'.repeat(100),
      })
      expect(result.success).toBe(true)
    })

    it('should reject name exceeding maximum length (101 characters)', () => {
      const result = CreateAccountSchema.safeParse({
        name: 'A'.repeat(101),
      })
      expect(result.success).toBe(false)
    })

    it('should accept description with maximum length (500 characters)', () => {
      const result = CreateAccountSchema.safeParse({
        name: 'Company',
        description: 'D'.repeat(500),
      })
      expect(result.success).toBe(true)
    })

    it('should reject description exceeding maximum length (501 characters)', () => {
      const result = CreateAccountSchema.safeParse({
        name: 'Company',
        description: 'D'.repeat(501),
      })
      expect(result.success).toBe(false)
    })

    it('should accept empty description', () => {
      const result = CreateAccountSchema.safeParse({
        name: 'Company',
        description: '',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('UpdateAccountSchema', () => {
    it('should accept valid update data with all fields', () => {
      const result = UpdateAccountSchema.safeParse({
        name: 'Updated Company',
        description: 'Updated description',
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty object (all fields optional)', () => {
      const result = UpdateAccountSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should accept update with only name', () => {
      const result = UpdateAccountSchema.safeParse({
        name: 'New Company Name',
      })
      expect(result.success).toBe(true)
    })

    it('should accept update with only description', () => {
      const result = UpdateAccountSchema.safeParse({
        description: 'New description',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty name when provided', () => {
      const result = UpdateAccountSchema.safeParse({
        name: '',
      })
      expect(result.success).toBe(false)
    })

    it('should accept name with minimum length when provided', () => {
      const result = UpdateAccountSchema.safeParse({
        name: 'X',
      })
      expect(result.success).toBe(true)
    })

    it('should accept name with maximum length when provided (100 characters)', () => {
      const result = UpdateAccountSchema.safeParse({
        name: 'X'.repeat(100),
      })
      expect(result.success).toBe(true)
    })

    it('should reject name exceeding maximum length when provided (101 characters)', () => {
      const result = UpdateAccountSchema.safeParse({
        name: 'X'.repeat(101),
      })
      expect(result.success).toBe(false)
    })

    it('should accept description with maximum length when provided (500 characters)', () => {
      const result = UpdateAccountSchema.safeParse({
        description: 'X'.repeat(500),
      })
      expect(result.success).toBe(true)
    })

    it('should reject description exceeding maximum length when provided (501 characters)', () => {
      const result = UpdateAccountSchema.safeParse({
        description: 'X'.repeat(501),
      })
      expect(result.success).toBe(false)
    })

    it('should accept empty description when provided', () => {
      const result = UpdateAccountSchema.safeParse({
        description: '',
      })
      expect(result.success).toBe(true)
    })
  })
})

describe('Invitation Schemas', () => {
  describe('CreateInvitationSchema', () => {
    const validRoles = ['ADMIN', 'MANAGER', 'EDITOR', 'AUTHOR', 'VIEWER', 'BILLING', 'ANALYTICS'] as const

    it('should accept valid invitation creation data', () => {
      const validData = {
        email: 'invite@example.com',
        role: 'VIEWER',
      }
      const result = CreateInvitationSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('should accept all valid roles', () => {
      for (const role of validRoles) {
        const result = CreateInvitationSchema.safeParse({
          email: 'invite@example.com',
          role,
        })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid email format', () => {
      const invalidEmails = ['invalid', 'invalid@', '@example.com', 'test@', 'test.com', '']
      for (const email of invalidEmails) {
        const result = CreateInvitationSchema.safeParse({
          email,
          role: 'VIEWER',
        })
        expect(result.success).toBe(false)
      }
    })

    it('should reject missing email field', () => {
      const result = CreateInvitationSchema.safeParse({
        role: 'ADMIN',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email')
      }
    })

    it('should reject missing role field', () => {
      const result = CreateInvitationSchema.safeParse({
        email: 'invite@example.com',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('role')
      }
    })

    it('should reject invalid role value', () => {
      const invalidRoles = ['admin', 'SUPERADMIN', 'USER', 'guest', '']
      for (const role of invalidRoles) {
        const result = CreateInvitationSchema.safeParse({
          email: 'invite@example.com',
          role,
        })
        expect(result.success).toBe(false)
      }
    })

    it('should accept complex valid email formats', () => {
      const validEmails = [
        'user+tag@example.com',
        'user.name@example.com',
        'user@subdomain.example.com',
        'user123@example.co.uk',
      ]
      for (const email of validEmails) {
        const result = CreateInvitationSchema.safeParse({
          email,
          role: 'VIEWER',
        })
        expect(result.success).toBe(true)
      }
    })
  })
})

describe('Webhook Schemas', () => {
  describe('CreateWebhookSchema', () => {
    it('should accept valid webhook creation data', () => {
      const validData = {
        url: 'https://api.example.com/webhooks',
        events: ['user.created', 'user.updated'],
      }
      const result = CreateWebhookSchema.safeParse(validData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('should accept HTTPS URLs', () => {
      const httpsUrls = [
        'https://example.com/hook',
        'https://api.example.com/v1/webhooks',
        'https://subdomain.example.co.uk/receive',
        'https://localhost:3000/webhook',
      ]
      for (const url of httpsUrls) {
        const result = CreateWebhookSchema.safeParse({
          url,
          events: ['event.test'],
        })
        expect(result.success).toBe(true)
      }
    })

    it('should reject HTTP URLs (must be HTTPS)', () => {
      const result = CreateWebhookSchema.safeParse({
        url: 'http://api.example.com/webhooks',
        events: ['user.created'],
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('HTTPS')
      }
    })

    it('should reject invalid URL format', () => {
      const invalidUrls = ['not-a-url', 'ftp://example.com', 'example.com', '']
      for (const url of invalidUrls) {
        const result = CreateWebhookSchema.safeParse({
          url,
          events: ['user.created'],
        })
        expect(result.success).toBe(false)
      }
    })

    it('should reject missing url field', () => {
      const result = CreateWebhookSchema.safeParse({
        events: ['user.created'],
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('url')
      }
    })

    it('should reject missing events field', () => {
      const result = CreateWebhookSchema.safeParse({
        url: 'https://api.example.com/webhooks',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('events')
      }
    })

    it('should reject empty events array', () => {
      const result = CreateWebhookSchema.safeParse({
        url: 'https://api.example.com/webhooks',
        events: [],
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('events')
        expect(result.error.issues[0].message).toContain('pelo menos um evento')
      }
    })

    it('should accept single event in array', () => {
      const result = CreateWebhookSchema.safeParse({
        url: 'https://api.example.com/webhooks',
        events: ['user.created'],
      })
      expect(result.success).toBe(true)
    })

    it('should accept multiple events', () => {
      const result = CreateWebhookSchema.safeParse({
        url: 'https://api.example.com/webhooks',
        events: ['user.created', 'user.updated', 'user.deleted', 'team.member_added'],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.events).toHaveLength(4)
      }
    })

    it('should accept events with various naming conventions', () => {
      const result = CreateWebhookSchema.safeParse({
        url: 'https://api.example.com/webhooks',
        events: ['user.created', 'PAYMENT_RECEIVED', 'invoice-paid', 'order:completed'],
      })
      expect(result.success).toBe(true)
    })
  })
})
