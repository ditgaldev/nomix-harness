import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const DIST_ROOT = fileURLToPath(new URL('../dist', import.meta.url))

it('ships install metadata with the built web application', async () => {
  const index = await readFile(join(DIST_ROOT, 'index.html'), 'utf8')
  expect(index).toContain('<link rel="manifest" href="/manifest.webmanifest" />')

  const manifest: unknown = JSON.parse(await readFile(join(DIST_ROOT, 'manifest.webmanifest'), 'utf8'))
  expect(manifest).toEqual({
    id: '/',
    name: 'Nomix Harness',
    short_name: 'NOMIX',
    start_url: '/',
    scope: '/',
    display: 'fullscreen',
    icons: [{
      src: '/nomix-logo.jpg',
      sizes: '512x512',
      type: 'image/jpeg',
      purpose: 'any',
    }],
  })
})

it('ships the Nomix logo used by both browser and install metadata', async () => {
  const logo = await readFile(join(DIST_ROOT, 'nomix-logo.jpg'))
  expect(logo.byteLength).toBeGreaterThan(1_000)
  expect(logo.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
})
