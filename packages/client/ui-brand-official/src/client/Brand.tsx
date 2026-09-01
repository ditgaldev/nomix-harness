import { BrandWordmark, NomixLogo } from '@nomix-ai/nomix-client-ui-primitives'
import type { HeroBrandMarkOwnerProps } from '@nomix-ai/nomix-client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@nomix-ai/nomix-client-ui-sidebar/client'

type OfficialBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps

/**
 * Render the official mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the official Nomix mark.
 */
export function OfficialBrandMark({ size, className }: OfficialBrandMarkProps) {
  return <NomixLogo size={size} className={className} />
}

/**
 * Render the official name artwork without its independently slotted mark.
 * @returns the official name wordmark.
 */
export function OfficialBrandName() {
  return <BrandWordmark includeMark={false} />
}
