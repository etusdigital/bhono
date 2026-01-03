// packages/bhono-app/src/prompts.test.ts
import { describe, it, expect } from 'vitest'
import { MODULES, PROVIDERS, getModuleChoices, getAuthChoices } from './prompts.js'

describe('Prompts Configuration', () => {
  it('defines available modules', () => {
    expect(MODULES).toContainEqual(
      expect.objectContaining({ value: 'invitations', label: expect.any(String) })
    )
    expect(MODULES).toContainEqual(
      expect.objectContaining({ value: 'storage', label: expect.any(String) })
    )
  })

  it('defines auth providers', () => {
    expect(PROVIDERS.auth).toContainEqual(
      expect.objectContaining({ value: 'google' })
    )
  })

  it('getModuleChoices returns formatted choices', () => {
    const choices = getModuleChoices()
    expect(choices.length).toBeGreaterThan(0)
    expect(choices[0]).toHaveProperty('value')
    expect(choices[0]).toHaveProperty('label')
  })

  it('getAuthChoices marks google as recommended', () => {
    const choices = getAuthChoices()
    const google = choices.find(c => c.value === 'google')
    expect(google?.label).toContain('recomendado')
  })
})
