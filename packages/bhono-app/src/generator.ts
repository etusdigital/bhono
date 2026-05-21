// packages/bhono-app/src/generator.ts
import fs from 'fs-extra'
import path from 'node:path'
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

function processTemplate(content: string, context: GeneratorContext): string {
  const replacements: Record<string, string> = {
    projectName: context.projectName,
    domain: context.domain,
    auth: context.auth,
    email: context.email,
    hasStorage: String(context.hasStorage),
    hasInvitations: String(context.hasInvitations),
    hasAuditLogs: String(context.hasAuditLogs),
    hasBilling: String(context.hasBilling),
    hasWebhooks: String(context.hasWebhooks),
  }

  let output = content
  for (const [key, value] of Object.entries(replacements)) {
    output = output.split(`{{${key}}}`).join(value)
  }

  return output
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
    const processed = processTemplate(content, context)
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
  const pathMap: Record<string, string> = {
    _gitignore: '.gitignore',
    _auth: '.auth',
  }

  for (const file of files) {
    const relativePath = file.toString()
    const mappedRelativePath = relativePath
      .split(path.sep)
      .map((segment) => pathMap[segment] ?? segment)
      .join(path.sep)
    const srcPath = path.join(templateDir, relativePath)
    const destPath = path.join(targetDir, mappedRelativePath)

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
  const templates = await getTemplateConfig()

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

  // Sanitize Cloudflare config (avoid shipping real IDs)
  const wranglerPath = path.join(projectPath, 'config', 'wrangler.json')
  if (await fs.pathExists(wranglerPath)) {
    const wrangler = await fs.readJson(wranglerPath)
    if (wrangler && typeof wrangler === 'object') {
      delete wrangler.account_id
      // Name the Worker after the generated project
      wrangler.name = options.projectName
      if (Array.isArray(wrangler.d1_databases)) {
        wrangler.d1_databases = wrangler.d1_databases.map((db: Record<string, unknown>) => ({
          ...db,
          database_id: 'TO_BE_PROVISIONED',
        }))
      }
      if (Array.isArray(wrangler.kv_namespaces)) {
        wrangler.kv_namespaces = wrangler.kv_namespaces.map((ns: Record<string, unknown>) => ({
          ...ns,
          id: 'TO_BE_PROVISIONED',
        }))
      }
      if (wrangler.env && typeof wrangler.env === 'object') {
        for (const envName of Object.keys(wrangler.env)) {
          const envConfig = wrangler.env[envName]
          if (!envConfig || typeof envConfig !== 'object') continue
          if (typeof envConfig.name === 'string') {
            envConfig.name = `${options.projectName}-${envName}`
          }
          if (Array.isArray(envConfig.d1_databases)) {
            envConfig.d1_databases = envConfig.d1_databases.map((db: Record<string, unknown>) => ({
              ...db,
              database_id: 'TO_BE_PROVISIONED',
            }))
          }
          if (Array.isArray(envConfig.kv_namespaces)) {
            envConfig.kv_namespaces = envConfig.kv_namespaces.map((ns: Record<string, unknown>) => ({
              ...ns,
              id: 'TO_BE_PROVISIONED',
            }))
          }
        }
      }
    }
    await fs.writeJson(wranglerPath, wrangler, { spaces: 2 })
  }

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
