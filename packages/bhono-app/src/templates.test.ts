// packages/bhono-app/src/templates.test.ts
import { describe, it, expect } from 'vitest'
import { getTemplateConfig } from './templates.js'

describe('Templates', () => {
  it('returns template config with base path', async () => {
    const config = await getTemplateConfig()
    expect(config.base).toContain('templates/base')
  })

  it('includes all module paths', async () => {
    const config = await getTemplateConfig()
    expect(config.modules).toHaveProperty('invitations')
    expect(config.modules).toHaveProperty('storage')
    expect(config.modules).toHaveProperty('audit-logs')
    expect(config.modules).toHaveProperty('billing')
    expect(config.modules).toHaveProperty('webhooks')
  })

  it('includes provider paths', async () => {
    const config = await getTemplateConfig()
    expect(config.providers.auth).toHaveProperty('google')
    expect(config.providers.auth).toHaveProperty('github')
    expect(config.providers.auth).toHaveProperty('email')
    expect(config.providers.email).toHaveProperty('sendgrid')
    expect(config.providers.email).toHaveProperty('resend')
  })
})
