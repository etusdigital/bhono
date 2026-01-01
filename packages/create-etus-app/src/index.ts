#!/usr/bin/env node
// packages/create-etus-app/src/index.ts

import { createCLI } from './cli.js'

const program = createCLI()
program.parse()

const projectName = program.args[0]
const opts = program.opts()

console.log('Creating project:', projectName)
console.log('Options:', opts)
