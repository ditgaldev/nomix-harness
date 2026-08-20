import { describe, expect, it } from 'vitest'
import { commandInvocation } from './process.ts'

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
