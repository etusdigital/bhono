# bhono-app CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an interactive CLI that scaffolds new projects from the boilerplate with module selection, Cloudflare provisioning, and GitHub integration.

**Architecture:** Monorepo package at `packages/bhono-app/`. CLI uses Clack for prompts, copies template files from `templates/`, applies module selection via file merging, and provisions Cloudflare/GitHub via their APIs.

**Tech Stack:** Node.js, TypeScript, Clack (prompts), Commander (CLI), Handlebars (templating), Octokit (GitHub), Wrangler SDK (Cloudflare)

---

## Phase 1: CLI Foundation

### Task 1: Initialize Package Structure

**Files:**
- Create: `packages/bhono-app/package.json`
- Create: `packages/bhono-app/tsconfig.json`
- Create: `packages/bhono-app/src/index.ts`
- Modify: `package.json` (root - add workspace)

**Step 1: Create packages directory**

```bash
mkdir -p packages/bhono-app/src
```

**Step 2: Create package.json**

```json
{
  "name": "@etus/bhono-app",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "bhono-app": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "@clack/prompts": "^0.8.0",
    "commander": "^12.0.0",
    "handlebars": "^4.7.8",
    "fs-extra": "^11.2.0",
    "picocolors": "^1.1.0"
  },
  "devDependencies": {
    "@types/fs-extra": "^11.0.4",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create entry point**

```typescript
#!/usr/bin/env node
// packages/bhono-app/src/index.ts

console.log('bhono-app v0.1.0')
```

**Step 5: Update root package.json for workspaces**

Add to root `package.json`:
```json
{
  "workspaces": ["packages/*"]
}
```

**Step 6: Install and verify**

```bash
cd packages/bhono-app && pnpm install && pnpm build
node dist/index.js
```

Expected: `bhono-app v0.1.0`

**Step 7: Commit**

```bash
git add packages/bhono-app package.json
git commit -m "feat(cli): initialize bhono-app package structure"
```

---

### Task 2: Implement CLI with Commander

**Files:**
- Create: `packages/bhono-app/src/cli.ts`
- Modify: `packages/bhono-app/src/index.ts`
- Test: `packages/bhono-app/src/cli.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/bhono-app/src/cli.test.ts
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
```

**Step 2: Run test to verify it fails**

```bash
cd packages/bhono-app && pnpm test:run
```

Expected: FAIL with "Cannot find module './cli.js'"

**Step 3: Implement cli.ts**

```typescript
// packages/bhono-app/src/cli.ts
import { Command } from 'commander'

export interface CLIOptions {
  projectName: string
  domain?: string
  modules: string[]
  auth: 'google' | 'github' | 'email'
  email: 'sendgrid' | 'resend'
  github: 'public' | 'private' | 'none'
  provision: boolean
  interactive: boolean
}

const DEFAULT_OPTIONS: Partial<CLIOptions> = {
  modules: [],
  auth: 'google',
  email: 'sendgrid',
  github: 'none',
  provision: false,
  interactive: true,
}

export function parseArgs(args: string[]): CLIOptions {
  const program = new Command()
    .name('bhono-app')
    .description('Create a new project from the Etus boilerplate')
    .version('0.1.0')
    .argument('<project-name>', 'Name of the project')
    .option('-d, --domain <domain>', 'Production domain')
    .option('-m, --modules <modules>', 'Comma-separated modules to include')
    .option('--auth <provider>', 'Auth provider: google, github, email', 'google')
    .option('--email <provider>', 'Email provider: sendgrid, resend', 'sendgrid')
    .option('--github <visibility>', 'Create GitHub repo: public, private, none', 'none')
    .option('--provision', 'Provision Cloudflare resources', false)
    .option('-y, --yes', 'Skip prompts, use defaults', false)
    .parse(['node', 'bhono-app', ...args])

  const opts = program.opts()
  const projectName = program.args[0]

  return {
    ...DEFAULT_OPTIONS,
    projectName,
    domain: opts.domain,
    modules: opts.modules ? opts.modules.split(',') : [],
    auth: opts.auth,
    email: opts.email,
    github: opts.github,
    provision: opts.provision,
    interactive: !opts.yes,
  } as CLIOptions
}

export function createCLI(): Command {
  return new Command()
    .name('bhono-app')
    .description('Create a new project from the Etus boilerplate')
    .version('0.1.0')
    .argument('<project-name>', 'Name of the project')
    .option('-d, --domain <domain>', 'Production domain')
    .option('-m, --modules <modules>', 'Comma-separated modules to include')
    .option('--auth <provider>', 'Auth provider: google, github, email', 'google')
    .option('--email <provider>', 'Email provider: sendgrid, resend', 'sendgrid')
    .option('--github <visibility>', 'Create GitHub repo: public, private, none', 'none')
    .option('--provision', 'Provision Cloudflare resources', false)
    .option('-y, --yes', 'Skip prompts, use defaults', false)
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/bhono-app && pnpm test:run
```

Expected: All 5 tests PASS

**Step 5: Update index.ts to use CLI**

```typescript
#!/usr/bin/env node
// packages/bhono-app/src/index.ts

import { createCLI } from './cli.js'

const program = createCLI()
program.parse()

const projectName = program.args[0]
const opts = program.opts()

console.log('Creating project:', projectName)
console.log('Options:', opts)
```

**Step 6: Build and test manually**

```bash
cd packages/bhono-app && pnpm build
node dist/index.js test-project --domain=test.com --modules=storage
```

Expected: Shows "Creating project: test-project" with options

**Step 7: Commit**

```bash
git add packages/bhono-app
git commit -m "feat(cli): add Commander-based argument parsing"
```

---

### Task 3: Implement Interactive Prompts with Clack

**Files:**
- Create: `packages/bhono-app/src/prompts.ts`
- Test: `packages/bhono-app/src/prompts.test.ts`

**Step 1: Write the test**

```typescript
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
```

**Step 2: Run test to verify it fails**

```bash
cd packages/bhono-app && pnpm test:run
```

Expected: FAIL

**Step 3: Implement prompts.ts**

```typescript
// packages/bhono-app/src/prompts.ts
import * as p from '@clack/prompts'
import pc from 'picocolors'
import type { CLIOptions } from './cli.js'

export interface ModuleChoice {
  value: string
  label: string
  hint?: string
}

export interface ProviderChoice {
  value: string
  label: string
}

export const MODULES: ModuleChoice[] = [
  { value: 'invitations', label: 'Invitations', hint: 'Sistema de convites por email' },
  { value: 'storage', label: 'Storage', hint: 'Upload de arquivos (R2)' },
  { value: 'audit-logs', label: 'Audit Logs', hint: 'Histórico de ações' },
  { value: 'billing', label: 'Billing', hint: 'Integração Stripe' },
  { value: 'webhooks', label: 'Webhooks', hint: 'Sistema de webhooks' },
]

export const PROVIDERS = {
  auth: [
    { value: 'google', label: 'Google OAuth (recomendado)' },
    { value: 'github', label: 'GitHub OAuth' },
    { value: 'email', label: 'Magic Link (email)' },
  ],
  email: [
    { value: 'sendgrid', label: 'SendGrid' },
    { value: 'resend', label: 'Resend' },
  ],
}

export function getModuleChoices(): ModuleChoice[] {
  return MODULES
}

export function getAuthChoices(): ProviderChoice[] {
  return PROVIDERS.auth
}

export function getEmailChoices(): ProviderChoice[] {
  return PROVIDERS.email
}

export async function runInteractivePrompts(
  projectName: string
): Promise<Omit<CLIOptions, 'interactive'>> {
  p.intro(pc.bgCyan(pc.black(' bhono-app ')))

  const answers = await p.group(
    {
      domain: () =>
        p.text({
          message: 'Domínio de produção?',
          placeholder: `${projectName}.com`,
        }),

      modules: () =>
        p.multiselect({
          message: 'Quais módulos incluir?',
          options: MODULES.map(m => ({
            value: m.value,
            label: m.label,
            hint: m.hint,
          })),
          required: false,
        }),

      auth: () =>
        p.select({
          message: 'Provider de autenticação?',
          options: PROVIDERS.auth,
        }),

      email: () =>
        p.select({
          message: 'Provider de email?',
          options: PROVIDERS.email,
        }),

      github: () =>
        p.select({
          message: 'Criar repositório no GitHub?',
          options: [
            { value: 'private', label: 'Sim, privado' },
            { value: 'public', label: 'Sim, público' },
            { value: 'none', label: 'Não, só local' },
          ],
        }),

      provision: () =>
        p.confirm({
          message: 'Provisionar recursos Cloudflare agora?',
          initialValue: true,
        }),
    },
    {
      onCancel: () => {
        p.cancel('Operação cancelada.')
        process.exit(0)
      },
    }
  )

  return {
    projectName,
    domain: (answers.domain as string) || `${projectName}.com`,
    modules: (answers.modules as string[]) || [],
    auth: answers.auth as 'google' | 'github' | 'email',
    email: answers.email as 'sendgrid' | 'resend',
    github: answers.github as 'public' | 'private' | 'none',
    provision: answers.provision as boolean,
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd packages/bhono-app && pnpm test:run
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/bhono-app
git commit -m "feat(cli): add Clack interactive prompts"
```

---

## Phase 2: Template System

### Task 4: Create Template Directory Structure

**Files:**
- Create: `packages/bhono-app/templates/base/` (copy from main src/)
- Create: `packages/bhono-app/templates/modules/`
- Create: `packages/bhono-app/src/templates.ts`

**Step 1: Create template directories**

```bash
mkdir -p packages/bhono-app/templates/base
mkdir -p packages/bhono-app/templates/modules/invitations
mkdir -p packages/bhono-app/templates/modules/storage
mkdir -p packages/bhono-app/templates/providers/auth-google
mkdir -p packages/bhono-app/templates/providers/auth-github
```

**Step 2: Create template config**

```typescript
// packages/bhono-app/src/templates.ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const TEMPLATES_DIR = path.resolve(__dirname, '../templates')

export interface TemplateConfig {
  base: string
  modules: Record<string, string>
  providers: Record<string, Record<string, string>>
}

export function getTemplateConfig(): TemplateConfig {
  return {
    base: path.join(TEMPLATES_DIR, 'base'),
    modules: {
      invitations: path.join(TEMPLATES_DIR, 'modules/invitations'),
      storage: path.join(TEMPLATES_DIR, 'modules/storage'),
      'audit-logs': path.join(TEMPLATES_DIR, 'modules/audit-logs'),
      billing: path.join(TEMPLATES_DIR, 'modules/billing'),
      webhooks: path.join(TEMPLATES_DIR, 'modules/webhooks'),
    },
    providers: {
      auth: {
        google: path.join(TEMPLATES_DIR, 'providers/auth-google'),
        github: path.join(TEMPLATES_DIR, 'providers/auth-github'),
        email: path.join(TEMPLATES_DIR, 'providers/auth-email'),
      },
      email: {
        sendgrid: path.join(TEMPLATES_DIR, 'providers/email-sendgrid'),
        resend: path.join(TEMPLATES_DIR, 'providers/email-resend'),
      },
    },
  }
}

export async function templateExists(templatePath: string): Promise<boolean> {
  return fs.pathExists(templatePath)
}
```

**Step 3: Write test**

```typescript
// packages/bhono-app/src/templates.test.ts
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
  })

  it('includes provider paths', () => {
    const config = getTemplateConfig()
    expect(config.providers.auth).toHaveProperty('google')
    expect(config.providers.email).toHaveProperty('sendgrid')
  })
})
```

**Step 4: Run tests**

```bash
cd packages/bhono-app && pnpm test:run
```

**Step 5: Commit**

```bash
git add packages/bhono-app
git commit -m "feat(cli): add template directory structure and config"
```

---

### Task 5: Implement Project Generator

**Files:**
- Create: `packages/bhono-app/src/generator.ts`
- Test: `packages/bhono-app/src/generator.test.ts`

**Step 1: Write the test**

```typescript
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

    const projectPath = path.join(tempDir, 'test-project')
    await generateProject(options, tempDir)

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

  it('generates wrangler.json with project config', async () => {
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

    const wranglerPath = path.join(tempDir, 'my-saas', 'wrangler.json')
    const wrangler = await fs.readJson(wranglerPath)
    expect(wrangler.name).toBe('my-saas')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd packages/bhono-app && pnpm test:run
```

**Step 3: Implement generator.ts**

```typescript
// packages/bhono-app/src/generator.ts
import fs from 'fs-extra'
import path from 'node:path'
import Handlebars from 'handlebars'
import type { CLIOptions } from './cli.js'
import { getTemplateConfig } from './templates.js'

export interface GeneratorContext {
  projectName: string
  domain: string
  modules: string[]
  auth: string
  email: string
  hasStorage: boolean
  hasInvitations: boolean
  hasAuditLogs: boolean
  hasBilling: boolean
  hasWebhooks: boolean
}

function createContext(options: CLIOptions): GeneratorContext {
  return {
    projectName: options.projectName,
    domain: options.domain || `${options.projectName}.com`,
    modules: options.modules,
    auth: options.auth,
    email: options.email,
    hasStorage: options.modules.includes('storage'),
    hasInvitations: options.modules.includes('invitations'),
    hasAuditLogs: options.modules.includes('audit-logs'),
    hasBilling: options.modules.includes('billing'),
    hasWebhooks: options.modules.includes('webhooks'),
  }
}

async function processTemplate(
  content: string,
  context: GeneratorContext
): Promise<string> {
  const template = Handlebars.compile(content)
  return template(context)
}

async function copyAndProcessFile(
  src: string,
  dest: string,
  context: GeneratorContext
): Promise<void> {
  const ext = path.extname(src)
  const processableExts = ['.ts', '.tsx', '.json', '.md', '.yaml', '.yml']

  if (processableExts.includes(ext)) {
    const content = await fs.readFile(src, 'utf-8')
    const processed = await processTemplate(content, context)
    await fs.outputFile(dest, processed)
  } else {
    await fs.copy(src, dest)
  }
}

async function copyTemplateDir(
  templateDir: string,
  targetDir: string,
  context: GeneratorContext
): Promise<void> {
  if (!(await fs.pathExists(templateDir))) {
    return
  }

  const files = await fs.readdir(templateDir, { recursive: true })

  for (const file of files) {
    const srcPath = path.join(templateDir, file.toString())
    const destPath = path.join(targetDir, file.toString())

    const stat = await fs.stat(srcPath)
    if (stat.isDirectory()) {
      await fs.ensureDir(destPath)
    } else {
      await copyAndProcessFile(srcPath, destPath, context)
    }
  }
}

export async function generateProject(
  options: CLIOptions,
  outputDir: string = process.cwd()
): Promise<string> {
  const projectPath = path.join(outputDir, options.projectName)
  const context = createContext(options)
  const templates = getTemplateConfig()

  // Create project directory
  await fs.ensureDir(projectPath)

  // Copy base template
  await copyTemplateDir(templates.base, projectPath, context)

  // Copy selected modules
  for (const moduleName of options.modules) {
    const modulePath = templates.modules[moduleName]
    if (modulePath) {
      await copyTemplateDir(modulePath, projectPath, context)
    }
  }

  // Copy selected providers
  const authProvider = templates.providers.auth[options.auth]
  if (authProvider) {
    await copyTemplateDir(authProvider, projectPath, context)
  }

  const emailProvider = templates.providers.email[options.email]
  if (emailProvider) {
    await copyTemplateDir(emailProvider, projectPath, context)
  }

  // Generate package.json
  await fs.writeJson(
    path.join(projectPath, 'package.json'),
    {
      name: options.projectName,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        deploy: 'wrangler deploy',
        'db:migrate:local': `wrangler d1 migrations apply ${options.projectName}-db --local`,
        'db:migrate:remote': `wrangler d1 migrations apply ${options.projectName}-db --remote`,
        lint: 'eslint .',
        test: 'vitest',
        'test:e2e': 'playwright test',
      },
    },
    { spaces: 2 }
  )

  // Generate wrangler.json
  const wranglerConfig: Record<string, unknown> = {
    name: options.projectName,
    main: 'src/server/index.ts',
    compatibility_date: '2024-12-01',
    d1_databases: [
      {
        binding: 'DB',
        database_name: `${options.projectName}-db`,
        database_id: 'TO_BE_PROVISIONED',
      },
    ],
    kv_namespaces: [
      {
        binding: 'SESSIONS',
        id: 'TO_BE_PROVISIONED',
      },
    ],
  }

  if (context.hasStorage) {
    wranglerConfig.r2_buckets = [
      {
        binding: 'R2_BUCKET',
        bucket_name: `${options.projectName}-files`,
      },
    ]
  }

  await fs.writeJson(path.join(projectPath, 'wrangler.json'), wranglerConfig, {
    spaces: 2,
  })

  // Generate etus.config.json
  await fs.writeJson(
    path.join(projectPath, 'etus.config.json'),
    {
      name: options.projectName,
      domain: context.domain,
      modules: options.modules,
      providers: {
        auth: options.auth,
        email: options.email,
      },
    },
    { spaces: 2 }
  )

  return projectPath
}
```

**Step 4: Run tests**

```bash
cd packages/bhono-app && pnpm test:run
```

**Step 5: Commit**

```bash
git add packages/bhono-app
git commit -m "feat(cli): implement project generator with template processing"
```

---

## Phase 3: Cloud Integrations

### Task 6: Implement Cloudflare Provisioning

**Files:**
- Create: `packages/bhono-app/src/providers/cloudflare.ts`
- Test: `packages/bhono-app/src/providers/cloudflare.test.ts`

**Step 1: Add wrangler as dependency**

```bash
cd packages/bhono-app
pnpm add wrangler
```

**Step 2: Write the test (mocked)**

```typescript
// packages/bhono-app/src/providers/cloudflare.test.ts
import { describe, it, expect, vi } from 'vitest'
import { CloudflareProvisioner, type CloudflareResources } from './cloudflare.js'

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
  })
})
```

**Step 3: Implement cloudflare.ts**

```typescript
// packages/bhono-app/src/providers/cloudflare.ts
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface CloudflareResources {
  database: { id: string; name: string }
  kvNamespace: { id: string; name: string }
  r2Bucket?: { name: string }
}

export interface ResourceNames {
  database: string
  kvNamespace: string
  r2Bucket: string
}

export class CloudflareProvisioner {
  private projectName: string

  constructor(projectName: string) {
    if (!/^[a-z0-9-]+$/.test(projectName)) {
      throw new Error(
        'Project name must contain only lowercase letters, numbers, and hyphens'
      )
    }
    this.projectName = projectName
  }

  getResourceNames(): ResourceNames {
    return {
      database: `${this.projectName}-db`,
      kvNamespace: `${this.projectName}-sessions`,
      r2Bucket: `${this.projectName}-files`,
    }
  }

  async createD1Database(): Promise<{ id: string; name: string }> {
    const name = this.getResourceNames().database
    const { stdout } = await execAsync(
      `wrangler d1 create ${name} --json`
    )
    const result = JSON.parse(stdout)
    return { id: result.uuid, name }
  }

  async createKVNamespace(): Promise<{ id: string; name: string }> {
    const name = this.getResourceNames().kvNamespace
    const { stdout } = await execAsync(
      `wrangler kv namespace create ${name} --json`
    )
    const result = JSON.parse(stdout)
    return { id: result.id, name }
  }

  async createR2Bucket(): Promise<{ name: string }> {
    const name = this.getResourceNames().r2Bucket
    await execAsync(`wrangler r2 bucket create ${name}`)
    return { name }
  }

  async setSecret(key: string, value: string): Promise<void> {
    await execAsync(
      `echo "${value}" | wrangler secret put ${key} --name ${this.projectName}`
    )
  }

  async provisionAll(includeR2: boolean = false): Promise<CloudflareResources> {
    const database = await this.createD1Database()
    const kvNamespace = await this.createKVNamespace()

    const resources: CloudflareResources = {
      database,
      kvNamespace,
    }

    if (includeR2) {
      resources.r2Bucket = await this.createR2Bucket()
    }

    return resources
  }
}

export function generateJwtSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
```

**Step 4: Run tests**

```bash
cd packages/bhono-app && pnpm test:run
```

**Step 5: Commit**

```bash
git add packages/bhono-app
git commit -m "feat(cli): add Cloudflare provisioning via wrangler"
```

---

### Task 7: Implement GitHub Integration

**Files:**
- Create: `packages/bhono-app/src/providers/github.ts`
- Test: `packages/bhono-app/src/providers/github.test.ts`

**Step 1: Add octokit dependency**

```bash
cd packages/bhono-app
pnpm add @octokit/rest
```

**Step 2: Write test**

```typescript
// packages/bhono-app/src/providers/github.test.ts
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
})
```

**Step 3: Implement github.ts**

```typescript
// packages/bhono-app/src/providers/github.ts
import { Octokit } from '@octokit/rest'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface GitHubRepo {
  name: string
  fullName: string
  url: string
  cloneUrl: string
}

export class GitHubProvisioner {
  private projectName: string
  private octokit: Octokit | null = null

  constructor(projectName: string) {
    if (!projectName) {
      throw new Error('Project name is required')
    }
    this.projectName = projectName
  }

  getRepoName(): string {
    return this.projectName
  }

  private async getOctokit(): Promise<Octokit> {
    if (this.octokit) return this.octokit

    // Try to get token from gh CLI
    const { stdout } = await execAsync('gh auth token')
    const token = stdout.trim()

    this.octokit = new Octokit({ auth: token })
    return this.octokit
  }

  async createRepo(isPrivate: boolean = true): Promise<GitHubRepo> {
    const octokit = await this.getOctokit()

    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: this.projectName,
      private: isPrivate,
      auto_init: false,
    })

    return {
      name: data.name,
      fullName: data.full_name,
      url: data.html_url,
      cloneUrl: data.clone_url,
    }
  }

  async setSecret(repoFullName: string, name: string, value: string): Promise<void> {
    await execAsync(
      `gh secret set ${name} --repo ${repoFullName} --body "${value}"`
    )
  }

  async setupRepository(
    projectPath: string,
    repoFullName: string
  ): Promise<void> {
    const commands = [
      'git init',
      'git add .',
      'git commit -m "Initial commit from bhono-app"',
      'git branch -M main',
      `git remote add origin https://github.com/${repoFullName}.git`,
      'git push -u origin main',
    ]

    for (const cmd of commands) {
      await execAsync(cmd, { cwd: projectPath })
    }
  }
}
```

**Step 4: Run tests**

```bash
cd packages/bhono-app && pnpm test:run
```

**Step 5: Commit**

```bash
git add packages/bhono-app
git commit -m "feat(cli): add GitHub repo creation and secrets management"
```

---

## Phase 4: Final Integration

### Task 8: Wire Everything Together in index.ts

**Files:**
- Modify: `packages/bhono-app/src/index.ts`

**Step 1: Implement full CLI flow**

```typescript
#!/usr/bin/env node
// packages/bhono-app/src/index.ts

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { createCLI, parseArgs, type CLIOptions } from './cli.js'
import { runInteractivePrompts } from './prompts.js'
import { generateProject } from './generator.js'
import { CloudflareProvisioner, generateJwtSecret } from './providers/cloudflare.js'
import { GitHubProvisioner } from './providers/github.js'

async function main() {
  const program = createCLI()
  program.parse()

  const projectName = program.args[0]

  if (!projectName) {
    console.error(pc.red('Error: Project name is required'))
    console.log('Usage: bhono-app <project-name> [options]')
    process.exit(1)
  }

  const opts = program.opts()
  let options: CLIOptions

  if (opts.yes) {
    // Non-interactive mode
    options = parseArgs(process.argv.slice(2))
  } else {
    // Interactive mode
    const answers = await runInteractivePrompts(projectName)
    options = { ...answers, interactive: true }
  }

  const s = p.spinner()

  try {
    // Generate project
    s.start('Gerando projeto...')
    const projectPath = await generateProject(options)
    s.stop(pc.green('✔ Projeto gerado'))

    // Provision Cloudflare
    if (options.provision) {
      s.start('Provisionando Cloudflare...')
      const cf = new CloudflareProvisioner(options.projectName)
      const hasStorage = options.modules.includes('storage')
      const resources = await cf.provisionAll(hasStorage)

      // Update wrangler.json with real IDs
      // ... (update file with resource IDs)

      // Set secrets
      const jwtSecret = generateJwtSecret()
      await cf.setSecret('JWT_SECRET', jwtSecret)

      s.stop(pc.green('✔ Cloudflare provisionado'))
      console.log(`  D1: ${resources.database.name} (${resources.database.id})`)
      console.log(`  KV: ${resources.kvNamespace.name} (${resources.kvNamespace.id})`)
      if (resources.r2Bucket) {
        console.log(`  R2: ${resources.r2Bucket.name}`)
      }
    }

    // Create GitHub repo
    if (options.github !== 'none') {
      s.start('Criando repositório GitHub...')
      const gh = new GitHubProvisioner(options.projectName)
      const isPrivate = options.github === 'private'
      const repo = await gh.createRepo(isPrivate)

      await gh.setupRepository(projectPath, repo.fullName)

      s.stop(pc.green('✔ Repositório criado'))
      console.log(`  ${repo.url}`)
    }

    // Success message
    p.outro(pc.green('Projeto criado com sucesso!'))

    console.log()
    console.log('Próximos passos:')
    console.log(pc.cyan(`  cd ${options.projectName}`))
    console.log(pc.cyan('  pnpm install'))
    console.log(pc.cyan('  pnpm dev'))
    console.log()

    if (options.github !== 'none') {
      console.log('Deploy:')
      console.log(pc.cyan('  git push origin main'))
    }
  } catch (error) {
    s.stop(pc.red('Erro'))
    console.error(pc.red(error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}

main()
```

**Step 2: Build and test manually**

```bash
cd packages/bhono-app && pnpm build
node dist/index.js test-project --yes
```

**Step 3: Commit**

```bash
git add packages/bhono-app
git commit -m "feat(cli): wire up full CLI flow with all integrations"
```

---

### Task 9: Prepare Base Template

**Files:**
- Create: `packages/bhono-app/templates/base/` (selective copy from src/)

**Step 1: Copy essential files from boilerplate**

This step involves copying the core boilerplate files to templates/base/, with placeholders for project-specific values.

Key files to copy:
- `src/server/` - Core server code
- `src/client/` - Core client code
- `src/shared/` - Shared types and schemas
- `migrations/` - Base migrations
- Config files: `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`, etc.

Replace hardcoded values with Handlebars placeholders:
- `hono-boilerplate` → `{{projectName}}`
- Database names → `{{projectName}}-db`

**Step 2: Commit**

```bash
git add packages/bhono-app/templates
git commit -m "feat(cli): add base template from boilerplate"
```

---

### Task 10: Add Module Templates

**Files:**
- Create: `packages/bhono-app/templates/modules/invitations/`
- Create: `packages/bhono-app/templates/modules/storage/`

Each module contains:
- Server routes
- Client components
- DB migrations
- Merge instructions (`module.json`)

**Step 1: Create module.json spec**

```json
// templates/modules/invitations/module.json
{
  "name": "invitations",
  "description": "Team invitation system",
  "files": {
    "merge": [
      "src/server/routes/index.ts"
    ],
    "copy": [
      "src/server/routes/invitations/",
      "src/client/components/InviteModal.tsx"
    ]
  },
  "dependencies": {},
  "migrations": ["add_invitations_table"]
}
```

**Step 2: Commit**

```bash
git add packages/bhono-app/templates/modules
git commit -m "feat(cli): add module templates for invitations and storage"
```

---

## Summary

| Phase | Tasks | Estimated Steps |
|-------|-------|-----------------|
| 1. CLI Foundation | Tasks 1-3 | ~21 steps |
| 2. Template System | Tasks 4-5 | ~10 steps |
| 3. Cloud Integrations | Tasks 6-7 | ~10 steps |
| 4. Final Integration | Tasks 8-10 | ~6 steps |

**Total:** 10 tasks, ~47 steps

Each step is 2-5 minutes, with commits after each task.
