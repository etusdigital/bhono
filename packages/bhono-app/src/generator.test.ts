// packages/bhono-app/src/generator.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import { generateProject } from './generator.js'
import type { CLIOptions } from './cli.js'

describe('Generator', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'etus-test-'))
  })

  afterEach(async () => {
    await fs.remove(tempDir)
  })

  it('creates project directory', async () => {
    const options: CLIOptions = {
      projectName: 'test-project',
      domain: 'test.com',
      modules: [],
      auth: 'google',
      email: 'sendgrid',
      github: 'none',
      provision: false,
      interactive: false,
    }

    await generateProject(options, tempDir)
    const projectPath = path.join(tempDir, 'test-project')

    expect(await fs.pathExists(projectPath)).toBe(true)
  })

  it('generates package.json with project name', async () => {
    const options: CLIOptions = {
      projectName: 'my-saas',
      domain: 'mysaas.com',
      modules: [],
      auth: 'google',
      email: 'sendgrid',
      github: 'none',
      provision: false,
      interactive: false,
    }

    await generateProject(options, tempDir)

    const pkgPath = path.join(tempDir, 'my-saas', 'package.json')
    const pkg = await fs.readJson(pkgPath)
    expect(pkg.name).toBe('my-saas')
  })

  it('updates config/wrangler.json with project name', async () => {
    const options: CLIOptions = {
      projectName: 'my-saas',
      domain: 'mysaas.com',
      modules: ['storage'],
      auth: 'google',
      email: 'sendgrid',
      github: 'none',
      provision: false,
      interactive: false,
    }

    await generateProject(options, tempDir)

    const wranglerPath = path.join(tempDir, 'my-saas', 'config', 'wrangler.json')
    const wrangler = await fs.readJson(wranglerPath)
    expect(wrangler.name).toBe('my-saas')
  })

  it('keeps r2_buckets in core template', async () => {
    const options: CLIOptions = {
      projectName: 'my-saas',
      domain: 'mysaas.com',
      modules: ['storage'],
      auth: 'google',
      email: 'sendgrid',
      github: 'none',
      provision: false,
      interactive: false,
    }

    await generateProject(options, tempDir)

    const wranglerPath = path.join(tempDir, 'my-saas', 'config', 'wrangler.json')
    const wrangler = await fs.readJson(wranglerPath)
    expect(wrangler.r2_buckets).toBeDefined()
  })

  it('generates etus.config.json with all options', async () => {
    const options: CLIOptions = {
      projectName: 'my-saas',
      domain: 'mysaas.com',
      modules: ['storage', 'invitations'],
      auth: 'github',
      email: 'resend',
      github: 'private',
      provision: true,
      interactive: false,
    }

    await generateProject(options, tempDir)

    const configPath = path.join(tempDir, 'my-saas', 'etus.config.json')
    const config = await fs.readJson(configPath)
    expect(config.name).toBe('my-saas')
    expect(config.domain).toBe('mysaas.com')
    expect(config.modules).toEqual(['storage', 'invitations'])
    expect(config.providers.auth).toBe('github')
    expect(config.providers.email).toBe('resend')
  })

  it('uses default domain when not provided', async () => {
    const options: CLIOptions = {
      projectName: 'my-saas',
      modules: [],
      auth: 'google',
      email: 'sendgrid',
      github: 'none',
      provision: false,
      interactive: false,
    }

    await generateProject(options, tempDir)

    const configPath = path.join(tempDir, 'my-saas', 'etus.config.json')
    const config = await fs.readJson(configPath)
    expect(config.domain).toBe('my-saas.com')
  })

  it('returns the project path', async () => {
    const options: CLIOptions = {
      projectName: 'my-saas',
      modules: [],
      auth: 'google',
      email: 'sendgrid',
      github: 'none',
      provision: false,
      interactive: false,
    }

    const result = await generateProject(options, tempDir)
    expect(result).toBe(path.join(tempDir, 'my-saas'))
  })
})
