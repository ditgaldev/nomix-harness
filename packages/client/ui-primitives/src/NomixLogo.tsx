import type { IconProps } from './icons/props.ts'

/** Public path copied into every built Nomix web application. */
export const NOMIX_LOGO_PATH = '/nomix-logo.jpg'

/**
 * Render the Nomix product mark supplied by the project owner.
 * @param props.size - square edge in px (default 24).
 * @param props.className - extra class for layout placement.
 * @returns the decorative Nomix logo image.
 */
export function NomixLogo({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 512 512"
      aria-hidden="true"
    >
      <image href={NOMIX_LOGO_PATH} width="512" height="512" />
    </svg>
  )
}
