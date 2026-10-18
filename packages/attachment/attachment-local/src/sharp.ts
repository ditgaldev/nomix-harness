/** Process-realm lazy access to Sharp's CommonJS-compatible entry. */

import type sharp from 'sharp'
import { createLazyRequire } from '@nomix-ai/nomix-lazy-require'

/** Load Sharp on the first raster operation and retain its callable export. */
export const requireSharp = createLazyRequire<typeof sharp>('sharp', import.meta.url)
