// scripts/generate-openapi.ts
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { api } from '../src/server/routes/index.ts'
import { openApiConfig } from '../src/server/routes/openapi.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outputPath = path.join(rootDir, 'docs', 'openapi.json')

async function main() {
  const document = api.getOpenAPIDocument(openApiConfig)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(document, null, 2), 'utf-8')
  console.log(`OpenAPI spec written to ${outputPath}`)
}

main().catch((error) => {
  console.error('Failed to generate OpenAPI spec')
  console.error(error)
  process.exit(1)
})
