import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@nomix-ai/nomix-api-remotes',
  ['lib/types/index.js', 'lib/types/invariant.js'],
  { hostPhase: true },
)
