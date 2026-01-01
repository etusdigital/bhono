// packages/create-etus-app/src/prompts.ts
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
  p.intro(pc.bgCyan(pc.black(' create-etus-app ')))

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
