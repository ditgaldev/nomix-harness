import { staticLinked } from '../tsdown.client.ts'

export default staticLinked(
  '@nomix-ai/nomix-client-web',
  ['lib/types/index.js', 'lib/types/invariant.js'],
)
