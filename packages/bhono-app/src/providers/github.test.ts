import { describe, it, expect } from 'vitest'
import { GitHubProvisioner } from './github.js'

describe('GitHubProvisioner', () => {
  it('generates repo name from project name', () => {
    const provisioner = new GitHubProvisioner('my-project')
    expect(provisioner.getRepoName()).toBe('my-project')
  })

  it('validates project name', () => {
    expect(() => new GitHubProvisioner('')).toThrow()
  })

  it('accepts valid project names', () => {
    expect(() => new GitHubProvisioner('valid-project')).not.toThrow()
    expect(() => new GitHubProvisioner('project123')).not.toThrow()
  })
})
