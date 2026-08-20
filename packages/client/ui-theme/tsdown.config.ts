import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  '@nomix-ai/nomix-client-ui-theme',
  ['lib/types/index.js', 'lib/types/invariant.js'],
  {
    lib: {
      copy: [{ from: 'src/styles/*', to: 'lib/styles' }],
    },
  },
)
