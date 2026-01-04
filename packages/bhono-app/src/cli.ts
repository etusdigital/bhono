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

// Single source of truth for CLI definition
function buildProgram(): Command {
  return new Command()
    .name('bhono-app')
    .description('Create a new project from the Etus boilerplate')
    .version('0.1.3')
    .argument('<project-name>', 'Name of the project')
    .option('-d, --domain <domain>', 'Production domain')
    .option('-m, --modules <modules>', 'Comma-separated modules to include')
    .option('--auth <provider>', 'Auth provider: google, github, email', 'google')
    .option('--email <provider>', 'Email provider: sendgrid, resend', 'sendgrid')
    .option('--github <visibility>', 'Create GitHub repo: public, private, none', 'none')
    .option('--provision', 'Provision Cloudflare resources', false)
    .option('-y, --yes', 'Skip prompts, use defaults', false)
}

export function parseArgs(args: string[]): CLIOptions {
  const program = buildProgram()
    .parse(['node', 'bhono-app', ...args])

  const opts = program.opts()
  const projectName = program.args[0]

  return {
    ...DEFAULT_OPTIONS,
    projectName,
    domain: opts.domain,
    modules: opts.modules ? opts.modules.split(',').map((m: string) => m.trim()) : [],
    auth: opts.auth,
    email: opts.email,
    github: opts.github,
    provision: opts.provision,
    interactive: !opts.yes,
  } as CLIOptions
}

export function createCLI(): Command {
  return buildProgram()
}
