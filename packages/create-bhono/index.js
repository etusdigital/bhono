#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const etusCliPath = require.resolve('@etus/bhono/dist/index.js')

const result = spawnSync(process.execPath, [etusCliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
