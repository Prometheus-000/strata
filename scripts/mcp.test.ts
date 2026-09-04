/**
 * The MCP server is a surface, not a second way in: it must speak the
 * protocol, expose the same calls, and — the part worth a test — refuse a
 * write that does not say who chose.
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..')

/** Speak line-delimited JSON-RPC at the server and collect what comes back. */
function talk(messages: unknown[]): Promise<Array<Record<string, any>>> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['--import', 'tsx/esm', path.join(REPO, 'mcp/server.mjs')], {
      cwd: REPO,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '' },
    })
    let out = ''
    child.stdout.on('data', (c) => (out += String(c)))
    child.on('error', reject)
    child.on('close', () => {
      try {
        resolve(out.split('\n').filter(Boolean).map((l) => JSON.parse(l)))
      } catch (err) {
        reject(new Error(`${String(err)}\n${out}`))
      }
    })
    for (const m of messages) child.stdin.write(JSON.stringify(m) + '\n')
    child.stdin.end()
  })
}

const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'test-harness' } } }

test('the server speaks the protocol and offers the record, not a file editor', async () => {
  const [hello, tools] = await talk([init, { jsonrpc: '2.0', id: 2, method: 'tools/list' }])
  assert.equal(hello.result.serverInfo.name, 'strata')
  assert.match(hello.result.instructions, /who could have chosen otherwise/)
  const names = tools.result.tools.map((t: { name: string }) => t.name).sort()
  assert.deepEqual(names, ['strata_check', 'strata_decide', 'strata_explain', 'strata_log', 'strata_precedent', 'strata_skill'])
  // No tool writes a file except through decide().
  assert.ok(!names.some((n: string) => /write|edit|patch|file/.test(n)))
})

test('a write that does not say who chose is refused, with the question it should have answered', async () => {
  const req = { kind: 'token', token: '--accent', action: 'keep' }
  const [, bare] = await talk([init, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'strata_decide', arguments: { request: req, reason: 'x' } } }])
  assert.equal(bare.result.isError, true)
  assert.match(bare.result.content[0].text, /who could have chosen otherwise/)
  assert.match(bare.result.content[0].text, /a tool call carries no shell to read/)

  // Stated, and it goes through — as a dry run, so the test writes nothing.
  const [, stated] = await talk([
    init,
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'strata_decide', arguments: { request: req, reason: 'the accent gate', decided: { kind: 'human', actor: 'prometheus-000' }, dryRun: true } },
    },
  ])
  assert.ok(!stated.result.isError, stated.result.content[0].text)
  const text = stated.result.content[0].text as string
  assert.match(text, /Decided by: human prometheus-000/)
  assert.match(text, /Written by: agent test-harness/, 'the calling client is the writing hand, which is the half that can be inferred safely')
  assert.match(text, /via mcp:test-harness/)
  assert.match(text, /nothing written \(dry run\)/)
})

test('the record reads through it: precedent counts hands, and a packet assembles', async () => {
  const [, precedent, packet] = await talk([
    init,
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'strata_precedent', arguments: { token: '--radius-overlay' } } },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'strata_skill', arguments: { name: 'cut-token', inputs: { token: '--accent-strong' } } } },
  ])
  assert.match(precedent.result.content[0].text, /cut --radius-overlay/)
  assert.match(packet.result.content[0].text, /## Rules that bear on this/)
  assert.match(packet.result.content[0].text, /who could have chosen otherwise/)
})
