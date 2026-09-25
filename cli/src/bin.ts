#!/usr/bin/env node
import { processIo } from './io.ts'
import { run } from './main.ts'

const io = processIo()
try {
  process.exitCode = await run(process.argv.slice(2), { io })
} catch (error) {
  io.err(`productownertoolkit: ${(error as Error).message}`)
  process.exitCode = 1
}
