import { describe, it, expect } from 'vitest'
import { UpdateProfileSchema, CreateWebhookSchema } from '@shared/schemas'

describe('UpdateProfileSchema', () => {
  it('accepts a valid name', () => {
    const result = UpdateProfileSchema.safeParse({ name: 'Alberto' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = UpdateProfileSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a name longer than 100 characters', () => {
    const result = UpdateProfileSchema.safeParse({ name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts a name at the 100-character boundary', () => {
    const result = UpdateProfileSchema.safeParse({ name: 'a'.repeat(100) })
    expect(result.success).toBe(true)
  })

  it('rejects a missing name', () => {
    const result = UpdateProfileSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('CreateWebhookSchema', () => {
  it('accepts a valid https URL with at least one event', () => {
    const result = CreateWebhookSchema.safeParse({
      url: 'https://example.com/hook',
      events: ['user.created'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-https URL', () => {
    const result = CreateWebhookSchema.safeParse({
      url: 'http://example.com/hook',
      events: ['user.created'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed URL', () => {
    const result = CreateWebhookSchema.safeParse({
      url: 'not-a-url',
      events: ['user.created'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty events array', () => {
    const result = CreateWebhookSchema.safeParse({
      url: 'https://example.com/hook',
      events: [],
    })
    expect(result.success).toBe(false)
  })

  it('accepts multiple events', () => {
    const result = CreateWebhookSchema.safeParse({
      url: 'https://example.com/hook',
      events: ['user.created', 'user.deleted', 'account.updated'],
    })
    expect(result.success).toBe(true)
  })
})
