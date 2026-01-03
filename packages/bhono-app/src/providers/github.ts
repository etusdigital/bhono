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
