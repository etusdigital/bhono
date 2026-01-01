// packages/create-etus-app/src/cli.test.ts
import { describe, it, expect } from 'vitest'
import { parseArgs } from './cli.js'

describe('CLI', () => {
  it('parses project name from positional argument', () => {
    const result = parseArgs(['my-project'])
    expect(result.projectName).toBe('my-project')
  })

  it('parses --domain flag', () => {
    const result = parseArgs(['my-project', '--domain', 'example.com'])
    expect(result.domain).toBe('example.com')
  })

  it('parses --modules flag as array', () => {
    const result = parseArgs(['my-project', '--modules', 'invitations,storage'])
    expect(result.modules).toEqual(['invitations', 'storage'])
  })

  it('defaults to interactive mode when no flags', () => {
    const result = parseArgs(['my-project'])
    expect(result.interactive).toBe(true)
  })

  it('sets interactive false when --yes flag', () => {
    const result = parseArgs(['my-project', '--yes'])
    expect(result.interactive).toBe(false)
  })
})
