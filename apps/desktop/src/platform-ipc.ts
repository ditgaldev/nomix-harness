/** Shared names for the desktop Platform bridge. */
/** Private desktop channels; the Platform renderer receives bootstrap and locale updates. */
export const PLATFORM_IPC = {
  bootstrap: 'nomix-platform:bootstrap',
  localeChanged: 'nomix-platform:locale-changed',
  open: 'nomix-platform:open',
  bounds: 'nomix-platform:bounds',
  close: 'nomix-platform:close',
} as const

/** Resolved Platform language; Desktop resolves the system preference before sending it. */
export type PlatformLocale = 'en_US' | 'zh_CN'
