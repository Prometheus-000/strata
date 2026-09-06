#!/usr/bin/env node
/**
 * THE RECORD, OVER MCP — the same door, without a terminal.
 *
 * A launcher: tsx's loader is registered here so the server runs from
 * `npx strata-mcp` with nothing on the command line, and the server itself
 * is `mcp/main.mjs`.
 */
import { register } from 'tsx/esm/api'

const KEY = Symbol.for('strata.tsx')
if (!globalThis[KEY]) globalThis[KEY] = register({ tsconfig: false })
await import('./main.mjs')
