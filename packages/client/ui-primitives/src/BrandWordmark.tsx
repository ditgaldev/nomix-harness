import type { IconProps } from './icons/props.ts'

/** Display options for the Nomix brand wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading Nomix mark; defaults to true. */
  includeMark?: boolean | undefined
}

/**
 * Render the Nomix Harness brand wordmark.
 * @param props.size - height in px (default 24).
 * @param props.className - extra class for layout placement.
 * @param props.includeMark - whether to include the leading Nomix mark.
 * @returns the decorative logo, product name, and Harness badge.
 */
export function BrandWordmark({ size = 24, className, includeMark = true }: BrandWordmarkProps) {
  const width = includeMark ? 148 : 117
  return (
    <svg
      width={(size * width) / 24}
      height={size}
      className={className}
      viewBox={includeMark ? '0 0 148 24' : '31 0 117 24'}
      aria-hidden="true"
    >
      {includeMark && <image href="/nomix-logo.jpg" width="24" height="24" />}
      <text
        x="31"
        y="17.5"
        fill="currentColor"
        fontFamily="Arial, sans-serif"
        fontSize="17"
        fontWeight="650"
        letterSpacing="-0.35"
      >Nomix</text>
      <rect x="84" y="5" width="62" height="15" rx="2.5" fill="currentColor" />
      <text
        x="90"
        y="15.5"
        fill="var(--dsw-alias-label-primary-inverted)"
        fontFamily="Arial, sans-serif"
        fontSize="9"
        fontWeight="700"
        letterSpacing="0.5"
      >HARNESS</text>
    </svg>
  )
}
