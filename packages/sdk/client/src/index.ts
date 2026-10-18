/**
 * TypeScript client SDK for the Nomix Harness runtime: spawn the
 * same-version `nomix --profile sdk` runtime as a subprocess and drive agent
 * turns over stdio JSON-RPC. `NomixHarness` is the high-level run API;
 * `HarnessClient` is the lower-level protocol client. A pure library — it
 * registers nothing on a Cordis context; named profiles and ordered patch
 * files customize the runtime process it spawns.
 *
 * @module @nomix-ai/nomix-sdk-client
 */

export { NomixHarness, HarnessSession, validatedSessionEvent } from './api.ts'
export type { RunOptions } from './api.ts'
export {
  HarnessClient,
  RequestTimeoutError,
  SdkProtocolError,
  TransportClosedError,
} from './client.ts'
export type { NotificationSubscription } from './client.ts'
export { JsonRpcResponseError } from '@nomix-ai/nomix-sdk-protocol'
export type {
  ContentBlock,
  SdkPromptContentBlock,
  NomixHarnessOptions,
  HarnessClientOptions,
  HarnessNotification,
  NotificationFilter,
  RunResult,
} from './types.ts'
