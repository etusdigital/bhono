// packages/bhono-app/src/providers/cloudflare.test.ts
import { describe, it, expect } from 'vitest'
import { CloudflareProvisioner, generateJwtSecret } from './cloudflare.js'

describe('CloudflareProvisioner', () => {
  it('generates resource names from project name', () => {
    const provisioner = new CloudflareProvisioner('my-project')
    const names = provisioner.getResourceNames()

    expect(names.database).toBe('my-project-db')
    expect(names.kvNamespace).toBe('my-project-sessions')
    expect(names.r2Bucket).toBe('my-project-files')
  })

  it('validates project name format', () => {
    expect(() => new CloudflareProvisioner('Invalid Name!')).toThrow()
    expect(() => new CloudflareProvisioner('valid-name')).not.toThrow()
    expect(() => new CloudflareProvisioner('valid123')).not.toThrow()
  })
})

describe('generateJwtSecret', () => {
  it('generates a 64 character string', () => {
    const secret = generateJwtSecret()
    expect(secret).toHaveLength(64)
  })

  it('generates different secrets each time', () => {
    const secret1 = generateJwtSecret()
    const secret2 = generateJwtSecret()
    expect(secret1).not.toBe(secret2)
  })
})
