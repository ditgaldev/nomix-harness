#!/usr/bin/env node
/**
 * Binary metadata check for private platform workspaces: refuse aggregate
 * assembly when a declared binary is missing or built for the wrong architecture.
 *
 * Without it, aggregate assembly after a missing build would ship no launcher,
 * and a binary copied across workspaces could advertise an architecture it
 * cannot execute. The check is presence plus ELF `e_machine` against the
 * workspace's declared `cpu`.
 *
 * Runs from each platform package's `prepack` hook (pnpm sets the script
 * cwd to the package directory). Also callable directly with an explicit
 * package directory: `node scripts/verify-launcher-binary.mjs packages/<name>`.
 */

import path from 'node:path';
import { root, verifyPlatformBinaries } from './repo.mjs';

const packageDir = process.argv[2] ? path.resolve(root, process.argv[2]) : process.cwd();

try {
  const { name, count } = verifyPlatformBinaries(packageDir);
  console.log(`verify-launcher-binary: ${name} — ${count} binaries present with the right ELF architecture.`);
} catch (error) {
  console.error(`verify-launcher-binary: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
