#!/usr/bin/env node
// packages/create-etus-app/src/index.ts

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { createCLI, parseArgs, type CLIOptions } from './cli.js'
import { runInteractivePrompts } from './prompts.js'
import { generateProject } from './generator.js'
import { CloudflareProvisioner, generateJwtSecret } from './providers/cloudflare.js'
import { GitHubProvisioner } from './providers/github.js'
import fs from 'fs-extra'
import path from 'node:path'

async function updateWranglerWithIds(
  projectPath: string,
  resources: { database: { id: string }; kvNamespace: { id: string } }
): Promise<void> {
  const wranglerPath = path.join(projectPath, 'wrangler.json')
  const wrangler = await fs.readJson(wranglerPath)

  wrangler.d1_databases[0].database_id = resources.database.id
  wrangler.kv_namespaces[0].id = resources.kvNamespace.id

  await fs.writeJson(wranglerPath, wrangler, { spaces: 2 })
}

async function main() {
  const program = createCLI()
  program.parse()

  const projectName = program.args[0]

  if (!projectName) {
    console.error(pc.red('Error: Project name is required'))
    console.log('Usage: create-etus-app <project-name> [options]')
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
    s.stop(pc.green('Projeto gerado'))

    // Provision Cloudflare
    if (options.provision) {
      s.start('Provisionando Cloudflare...')
      const cf = new CloudflareProvisioner(options.projectName)
      const hasStorage = options.modules.includes('storage')
      const resources = await cf.provisionAll(hasStorage)

      // Update wrangler.json with real IDs
      await updateWranglerWithIds(projectPath, resources)

      // Set secrets
      const jwtSecret = generateJwtSecret()
      await cf.setSecret('JWT_SECRET', jwtSecret)

      s.stop(pc.green('Cloudflare provisionado'))
      console.log(`  D1: ${resources.database.name} (${resources.database.id})`)
      console.log(`  KV: ${resources.kvNamespace.name} (${resources.kvNamespace.id})`)
      if (resources.r2Bucket) {
        console.log(`  R2: ${resources.r2Bucket.name}`)
      }
    }

    // Create GitHub repo
    if (options.github !== 'none') {
      s.start('Criando repositorio GitHub...')
      const gh = new GitHubProvisioner(options.projectName)
      const isPrivate = options.github === 'private'
      const repo = await gh.createRepo(isPrivate)

      await gh.setupRepository(projectPath, repo.fullName)

      s.stop(pc.green('Repositorio criado'))
      console.log(`  ${repo.url}`)
    }

    // Success message
    p.outro(pc.green('Projeto criado com sucesso!'))

    console.log()
    console.log('Proximos passos:')
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
