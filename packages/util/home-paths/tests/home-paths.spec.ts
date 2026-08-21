import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_NOMIX_HOME_DISPLAY,
  NOMIX_HOME_DIR_NAME,
  canonicalizeWatchPath,
  defaultNomixHome,
  nomixHomeDisplay,
  nomixHomePath,
  expandHomePath,
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

  it('canonicalizes a watcher ancestor while preserving a missing suffix', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nomix-watch-path-'))
    const target = join(root, 'target')
    const alias = join(root, 'alias')
    try {
      await mkdir(target)
      await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir')
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
