import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authorFrom } from '../src/author.ts'

test('the author is decided explicitly, with a printed reason, and never silently', () => {
  assert.deepEqual(authorFrom(['--by', 'agent'], {}), { author: 'agent', because: 'by agent — --by agent on the command line' })
  const env = authorFrom([], { CLAUDECODE: '1' })
  assert.equal('author' in env && env.author, 'agent')
  const flag = authorFrom(['--by', 'human'], { CLAUDECODE: '1', STRATA_AUTHOR: 'agent' })
  assert.equal('author' in flag && flag.author, 'human')
  const strata = authorFrom([], { STRATA_AUTHOR: 'agent' })
  assert.ok('author' in strata && strata.author === 'agent' && /STRATA_AUTHOR/.test(strata.because))
  const alias = authorFrom([], { MALLEABLE_AUTHOR: 'human', CLAUDECODE: '1' })
  assert.ok('author' in alias && alias.author === 'human' && /MALLEABLE_AUTHOR/.test(alias.because))
  const none = authorFrom([], {})
  assert.ok('author' in none && none.author === 'human' && /defaulted/.test(none.because))
  assert.ok('error' in authorFrom(['--by', 'robot'], {}))
  assert.ok('error' in authorFrom([], { STRATA_AUTHOR: 'robot' }))
})
