import { describe, expect, it } from 'vitest'
import { preparePortableManifest } from './pack.ts'

describe('preparePortableManifest', () => {
  it('leaves internal dependencies bundled and installs native wrappers for the consumer platform', () => {
    const manifest = preparePortableManifest({
      dependencies: {
        '@nomix-ai/nomix-base': '^0.1.2',
        commander: '^15.0.0',
        'node-addon-require-builtin': '^0.1.4',
      },
      bundleDependencies: true,
    }, {
      koffi: '3.1.1',
      'node-addon-require-builtin': '0.1.4',
      sharp: '0.35.3',
    })

    expect(manifest.dependencies).toEqual({
      '@nomix-ai/nomix-base': '^0.1.2',
      commander: '^15.0.0',
      koffi: '3.1.1',
      'node-addon-require-builtin': '0.1.4',
      sharp: '0.35.3',
    })
    expect(manifest.bundleDependencies).toEqual([
      '@nomix-ai/nomix-base',
      'commander',
    ])
    expect(manifest.scripts).toEqual({ postinstall: 'node lib/install-runtime.js' })
  })

  it('rejects a missing platform dependency', () => {
    expect(() => preparePortableManifest({ dependencies: {} }, {
      koffi: '3.1.1',
      'node-addon-require-builtin': '0.1.4',
    })).toThrow(/missing platform dependency sharp/)
  })
})
