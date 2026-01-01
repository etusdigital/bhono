// packages/create-etus-app/src/providers/cloudflare.ts
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
    const { stdout } = await execAsync(`wrangler d1 create ${name} --json`)
    const result = JSON.parse(stdout)
    return { id: result.uuid, name }
  }

  async createKVNamespace(): Promise<{ id: string; name: string }> {
    const name = this.getResourceNames().kvNamespace
    const { stdout } = await execAsync(`wrangler kv namespace create ${name} --json`)
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
