// packages/create-etus-app/src/templates.test.ts
import { describe, it, expect } from 'vitest'
import { getTemplateConfig, TEMPLATES_DIR } from './templates.js'

describe('Templates', () => {
  it('returns template config with base path', () => {
    const config = getTemplateConfig()
    expect(config.base).toContain('templates/base')
  })

  it('includes all module paths', () => {
    const config = getTemplateConfig()
    expect(config.modules).toHaveProperty('invitations')
    expect(config.modules).toHaveProperty('storage')
    expect(config.modules).toHaveProperty('audit-logs')
    expect(config.modules).toHaveProperty('billing')
    expect(config.modules).toHaveProperty('webhooks')
  })

  it('includes provider paths', () => {
    const config = getTemplateConfig()
    expect(config.providers.auth).toHaveProperty('google')
    expect(config.providers.auth).toHaveProperty('github')
    expect(config.providers.auth).toHaveProperty('email')
    expect(config.providers.email).toHaveProperty('sendgrid')
    expect(config.providers.email).toHaveProperty('resend')
  })
})
