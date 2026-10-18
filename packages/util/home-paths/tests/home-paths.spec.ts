import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AGENTS_HOME_DIR_NAME,
  DEFAULT_AGENTS_HOME_DISPLAY,
  DEFAULT_NOMIX_HOME_DISPLAY,
  NOMIX_HOME_DIR_NAME,
  agentsHomeDisplay,
  canonicalizeWatchPath,
  defaultAgentsHome,
  defaultNomixHome,
  nomixCachePath,
  nomixHomeDisplay,
  nomixHomePath,
  expandHomePath,
  resolveAgentsHome,
  resolveNomixHome,
} from '@nomix-ai/nomix-home-paths'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('nomix path helpers', () => {
  it('owns the shared default NOMIX home directory name', () => {
    expect(NOMIX_HOME_DIR_NAME).toBe('.nomix')
    expect(DEFAULT_NOMIX_HOME_DISPLAY).toBe('~/.nomix')
    expect(defaultNomixHome()).toBe(join(homedir(), '.nomix'))
  })

  it('expands tilde paths without changing non-tilde paths', () => {
    expect(expandHomePath('~')).toBe(homedir())
    expect(expandHomePath('~/.nomix')).toBe(join(homedir(), '.nomix'))
    expect(expandHomePath('~\\.nomix')).toBe(join(homedir(), '.nomix'))
    expect(expandHomePath('/tmp/.nomix')).toBe('/tmp/.nomix')
    expect(expandHomePath('~other/.nomix')).toBe('~other/.nomix')
  })

  it('resolves explicit path before NOMIX_HOME and the default', () => {
    const envHome = join(homedir(), 'env-nomix')

    expect(resolveNomixHome('/tmp/explicit-nomix', { NOMIX_HOME: '~/env-nomix' })).toBe(resolve('/tmp/explicit-nomix'))
    expect(resolveNomixHome(undefined, { NOMIX_HOME: '~/env-nomix' })).toBe(envHome)
    expect(resolveNomixHome(undefined, {})).toBe(defaultNomixHome())
  })

  it('treats an empty or whitespace-only NOMIX_HOME as unset', () => {
    expect(resolveNomixHome(undefined, { NOMIX_HOME: '' })).toBe(defaultNomixHome())
    expect(resolveNomixHome(undefined, { NOMIX_HOME: '   ' })).toBe(defaultNomixHome())
  })

  it('joins child segments onto the resolved NOMIX_HOME', () => {
    vi.stubEnv('NOMIX_HOME', '~/env-nomix')
    expect(nomixHomePath()).toBe(join(homedir(), 'env-nomix'))
    expect(nomixHomePath('storages', 'cache')).toBe(join(homedir(), 'env-nomix', 'storages', 'cache'))
  })

  it('labels a resolved home by whether it is the default root', () => {
    expect(nomixHomeDisplay(resolve(defaultNomixHome()))).toBe('~/.nomix')
    expect(nomixHomeDisplay('/some/other/root')).toBe('$NOMIX_HOME')
  })

  it('owns the shared default agents home directory name', () => {
    expect(AGENTS_HOME_DIR_NAME).toBe('.agents')
    expect(DEFAULT_AGENTS_HOME_DISPLAY).toBe('~/.agents')
    expect(defaultAgentsHome()).toBe(join(homedir(), '.agents'))
  })

  it('resolves an explicit agents home before NOMIX_AGENTS_HOME and the default', () => {
    const envHome = join(homedir(), 'env-agents')

    expect(resolveAgentsHome('/tmp/explicit-agents', { NOMIX_AGENTS_HOME: '~/env-agents' })).toBe(resolve('/tmp/explicit-agents'))
    expect(resolveAgentsHome(undefined, { NOMIX_AGENTS_HOME: '~/env-agents' })).toBe(envHome)
    expect(resolveAgentsHome(undefined, {})).toBe(defaultAgentsHome())
  })

  it('treats an empty or whitespace-only NOMIX_AGENTS_HOME as unset', () => {
    expect(resolveAgentsHome(undefined, { NOMIX_AGENTS_HOME: '' })).toBe(defaultAgentsHome())
    expect(resolveAgentsHome(undefined, { NOMIX_AGENTS_HOME: '   ' })).toBe(defaultAgentsHome())
  })

  it('labels a resolved agents home by whether it is the default root', () => {
    expect(agentsHomeDisplay(resolve(defaultAgentsHome()))).toBe('~/.agents')
    expect(agentsHomeDisplay('/some/other/root')).toBe('$NOMIX_AGENTS_HOME')
  })

  it.each([
    [undefined, join(homedir(), '.nomix')],
    ['', join(homedir(), '.nomix')],
    ['   ', join(homedir(), '.nomix')],
    ['~/env-nomix', join(homedir(), 'env-nomix')],
    ['./relative-nomix', resolve('./relative-nomix')],
  ] as const)('resolves cache paths with NOMIX_HOME=%j', (home, expectedHome) => {
    vi.stubEnv('NOMIX_HOME', home)
    try {
      expect(nomixCachePath()).toBe(join(expectedHome, 'cache'))
      expect(nomixCachePath('models', 'index.json')).toBe(join(expectedHome, 'cache', 'models', 'index.json'))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('resolves configured cache homes before the environment', () => {
    vi.stubEnv('NOMIX_HOME', '~/env-nomix')
    try {
      expect(nomixCachePath({ nomixHome: '~/explicit-nomix' })).toBe(join(homedir(), 'explicit-nomix', 'cache'))
      expect(nomixCachePath({ nomixHome: './explicit-nomix' }, 'attachments', 'request-images'))
        .toBe(resolve('./explicit-nomix/cache/attachments/request-images'))
      expect(nomixCachePath({}, 'attachments')).toBe(join(homedir(), 'env-nomix', 'cache', 'attachments'))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('canonicalizes a watcher ancestor while preserving a missing suffix', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nomix-watch-path-'))
    const target = join(root, 'target')
    const alias = join(root, 'alias')
    try {
      await mkdir(target)
      await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir')
      await expect(canonicalizeWatchPath(alias)).resolves.toBe(await realpath(target))
      await expect(canonicalizeWatchPath(join(alias, 'later', 'config.yml'))).resolves.toBe(
        join(await realpath(target), 'later', 'config.yml'),
      )
      const file = join(root, 'file')
      await writeFile(file, 'not a directory')
      await expect(canonicalizeWatchPath(join(file, 'child'))).rejects.toMatchObject({ code: 'ENOTDIR' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
