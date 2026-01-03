// packages/bhono-app/src/templates.ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import os from 'node:os'
import { promisify } from 'node:util'
import fs from 'fs-extra'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const TEMPLATES_DIR = path.resolve(__dirname, '../templates')
const execFileAsync = promisify(execFile)
const TEMPLATE_REPO_ENV_VARS = ['BHONO_TEMPLATE_REPO', 'ETUS_TEMPLATE_REPO']
const DEFAULT_TEMPLATE_REPO = 'https://github.com/etusdigital/bhono'

export interface TemplateConfig {
  base: string
  modules: Record<string, string>
  providers: Record<string, Record<string, string>>
}

function buildTemplateConfig(templatesDir: string): TemplateConfig {
  return {
    base: path.join(templatesDir, 'base'),
    modules: {
      invitations: path.join(templatesDir, 'modules/invitations'),
      storage: path.join(templatesDir, 'modules/storage'),
      'audit-logs': path.join(templatesDir, 'modules/audit-logs'),
      billing: path.join(templatesDir, 'modules/billing'),
      webhooks: path.join(templatesDir, 'modules/webhooks'),
    },
    providers: {
      auth: {
        google: path.join(templatesDir, 'providers/auth-google'),
        github: path.join(templatesDir, 'providers/auth-github'),
        email: path.join(templatesDir, 'providers/auth-email'),
      },
      email: {
        sendgrid: path.join(templatesDir, 'providers/email-sendgrid'),
        resend: path.join(templatesDir, 'providers/email-resend'),
      },
    },
  }
}

function resolveTemplateRepo(): string | null {
  for (const envVar of TEMPLATE_REPO_ENV_VARS) {
    const value = process.env[envVar]
    if (value && value.trim().length > 0) {
      return value.trim()
    }
  }
  return DEFAULT_TEMPLATE_REPO
}

async function cloneTemplateRepo(repoUrl: string): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bhono-template-'))
  try {
    await execFileAsync('git', ['clone', '--depth', '1', repoUrl, tempDir], {
      timeout: 120000,
    })
  } catch (error) {
    throw new Error(
      `Failed to clone template repo (${repoUrl}). Ensure git is installed and the repo is accessible.`
    )
  }
  return tempDir
}

async function findTemplatesDir(repoRoot: string): Promise<string | null> {
  const candidates = [
    path.join(repoRoot, 'templates'),
    path.join(repoRoot, 'packages', 'bhono-app', 'templates'),
    path.join(repoRoot, 'packages', 'create-etus-app', 'templates'),
  ]

  for (const candidate of candidates) {
    if (await fs.pathExists(path.join(candidate, 'base'))) {
      return candidate
    }
  }

  return null
}

export async function getTemplateConfig(): Promise<TemplateConfig> {
  if (await fs.pathExists(path.join(TEMPLATES_DIR, 'base'))) {
    return buildTemplateConfig(TEMPLATES_DIR)
  }

  const repoUrl = resolveTemplateRepo()
  if (!repoUrl) {
    throw new Error(
      'Templates not found. Install the package with templates included or set BHONO_TEMPLATE_REPO to a git URL.'
    )
  }

  const repoRoot = await cloneTemplateRepo(repoUrl)
  const templatesDir = await findTemplatesDir(repoRoot)

  if (!templatesDir) {
    throw new Error(
      `Template repo does not contain templates/base. Checked ${repoRoot}/templates and ${repoRoot}/packages/*/templates.`
    )
  }

  return buildTemplateConfig(templatesDir)
}

export async function templateExists(templatePath: string): Promise<boolean> {
  return fs.pathExists(templatePath)
}
