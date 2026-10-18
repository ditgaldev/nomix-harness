/** Dependency-free IPC names shared with the sandboxed mandatory-update preload. */
export const MANDATORY_IPC = {
  status: 'nomix-desktop:mandatory-status', state: 'nomix-desktop:mandatory-state', action: 'nomix-desktop:mandatory-action',
} as const
