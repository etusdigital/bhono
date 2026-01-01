// packages/create-etus-app/src/generator.ts
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
