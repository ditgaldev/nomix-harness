import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { capture, commandInvocation, pnpmCommand, runConcurrent } from './process.ts'
import { packedIdentity, tarballFiles } from './tarball.ts'

const directories: string[] = []

afterEach(async () => {
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true })
})

/**
 * Pack one manifest into a tarball shaped like `npm pack` output.
 * @returns Absolute path of the archive.
 */
async function packedTarball(name: string, version: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'nomix-tarball-'))
  directories.push(directory)
  const contents = join(directory, 'package')
  await import('node:fs/promises').then(async fs => fs.mkdir(contents))
  await writeFile(join(contents, 'package.json'), JSON.stringify({ name, version }))
  await writeFile(join(contents, 'index.js'), '')
  const archive = join(directory, `${name.replaceAll('/', '-').replace('@', '')}-${version}.tgz`)
  execFileSync('tar', ['-czf', basename(archive), 'package'], { cwd: dirname(archive) })
  return archive
}

describe('release process helpers', () => {
  it('waits for a successful child and rejects a failed exit or missing executable', async () => {
    await expect(runConcurrent(process.execPath, ['-e', 'process.exit(0)'])).resolves.toBeUndefined()
    await expect(runConcurrent(process.execPath, ['-e', 'process.exit(7)'])).rejects.toThrow('exited with 7')
    await expect(runConcurrent(join(tmpdir(), 'nomix-release-command-does-not-exist'), [])).rejects.toThrow(/ENOENT/)
  })

  it('runs pnpm through a JavaScript entry, which spawnSync can start on Windows', () => {
    const [command, ...args] = pnpmCommand()
    expect(command === 'pnpm' || /node(?:\.exe)?$/iu.test(command)).toBe(true)
    if (command !== 'pnpm') expect(args[0]).toMatch(/pnpm/u)
    expect(capture(command, [...args, '--version'])).toMatch(/^\d+\.\d+\.\d+/u)
  })
})

describe('release tarball readers', () => {
  it('lists members of an archive under an absolute path', async () => {
    // GNU tar reads the colon in a Windows drive path as a remote host, so the readers run beside the archive.
    const archive = await packedTarball('@nomix-ai/nomix-probe', '1.2.3')
    expect(tarballFiles(archive)).toEqual(expect.arrayContaining(['package/package.json', 'package/index.js']))
  })

  it('reads what an archive declares about itself', async () => {
    const archive = await packedTarball('@nomix-ai/nomix-probe', '1.2.3')
    expect(packedIdentity(archive)).toEqual({ name: '@nomix-ai/nomix-probe', version: '1.2.3' })
  })
})

describe('release process commands', () => {
  it('launches pnpm through its JavaScript entry point on Windows', () => {
    const invocation = commandInvocation('pnpm', ['pack'], {
      npm_execpath: 'C:\\corepack\\dist\\pnpm.js',
      npm_node_execpath: 'C:\\node.exe',
    }, 'win32')

    expect(invocation).toEqual({
      command: 'C:\\node.exe',
      args: ['C:\\corepack\\dist\\pnpm.js', 'pack'],
    })
  })

  it('keeps native commands and non-Windows pnpm invocations unchanged', () => {
    expect(commandInvocation('git', ['status'], {}, 'win32')).toEqual({ command: 'git', args: ['status'] })
    expect(commandInvocation('pnpm', ['pack'], { npm_execpath: '/usr/bin/pnpm.cjs' }, 'linux')).toEqual({
      command: 'pnpm',
      args: ['pack'],
    })
  })

  it('launches npm through the Node installation on Windows', () => {
    expect(commandInvocation('npm', ['install'], {
      npm_execpath: 'C:\\corepack\\dist\\pnpm.js',
      npm_node_execpath: 'C:\\node\\node.exe',
    }, 'win32')).toEqual({
      command: 'C:\\node\\node.exe',
      args: ['C:\\node\\node_modules\\npm\\bin\\npm-cli.js', 'install'],
    })
  })
})
