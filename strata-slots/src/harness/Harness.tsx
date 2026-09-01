/**
 * The repo's own harness: the generic preview, pointed at the fixtures.
 *
 * It is three lines because everything that used to be here is now in
 * `src/preview` and works against any project's views. The fixtures are one
 * consumer of that, not a special case of it.
 */
import { Gallery } from '../../fixtures/app/views/Gallery'
import { Settings } from '../../fixtures/app/views/Settings'
import { Preview } from '../preview/Preview'
import manifestJson from '../../.slots/manifest.json'
import type { Manifest } from '../schema'
import '../../fixtures/app/features/features.css'

export function Harness() {
  return (
    <Preview
      manifest={manifestJson as unknown as Manifest}
      surfaces={{ gallery: Gallery, settings: Settings }}
    />
  )
}
