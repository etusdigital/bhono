import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, join } from 'node:path'

const clientRoot = join(process.cwd(), 'src/client')

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) return listSourceFiles(fullPath)
    if (/\.(ts|tsx|js|jsx)$/.test(entry)) return [fullPath]
    return []
  })
}

function readClientFiles() {
  return listSourceFiles(clientRoot).map((file) => ({
    file,
    relativePath: relative(process.cwd(), file),
    source: readFileSync(file, 'utf8'),
  }))
}

describe('frontend security guardrails', () => {
  it('does not introduce dangerous DOM/code execution sinks', () => {
    const forbidden = [
      'dangerouslySetInnerHTML',
      '.innerHTML',
      '.outerHTML',
      'insertAdjacentHTML',
      'document.write',
      'eval(',
      'new Function',
    ]

    const violations = readClientFiles().flatMap(({ relativePath, source }) =>
      forbidden
        .filter((pattern) => source.includes(pattern))
        .map((pattern) => `${relativePath}: ${pattern}`),
    )

    expect(violations).toEqual([])
  })

  it('keeps browser storage away from auth tokens and secrets', () => {
    const storageAllowlist = new Set(['src/client/hooks/use-theme.tsx'])

    const violations = readClientFiles()
      .filter(({ source }) => source.includes('localStorage') || source.includes('sessionStorage'))
      .map(({ relativePath }) => relativePath)
      .filter((relativePath) => !storageAllowlist.has(relativePath))

    expect(violations).toEqual([])
  })

  it('does not expose non-public runtime configuration through the client bundle', () => {
    const violations = readClientFiles().flatMap(({ relativePath, source }) => {
      const matches = source.match(/import\.meta\.env\.[A-Z0-9_]+/g) ?? []
      return matches
        .filter((match) => match !== 'import.meta.env.DEV')
        .map((match) => `${relativePath}: ${match}`)
    })

    expect(violations).toEqual([])
  })

  it('marks cookie-authenticated mutations as intentional browser requests', () => {
    const mutatingMethodPattern = /method:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/

    const violations = readClientFiles().flatMap(({ relativePath, source }) => {
      if (!source.includes('fetch(') || !mutatingMethodPattern.test(source)) return []
      if (source.includes('X-CSRF-Token') || source.includes('X-Requested-With')) return []
      return [relativePath]
    })

    expect(violations).toEqual([])
  })
})
