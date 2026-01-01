// packages/create-etus-app/src/templates.ts
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
