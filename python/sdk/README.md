# Nomix Harness Python SDK

English | [中文](https://github.com/ditgaldev/nomix-harness/blob/master/python/sdk/README.zh.md)

Python subprocess SDK for driving Nomix Harness over JSON-RPC stdio. The runtime inherits `NOMIX_*` process configuration and any provider-specific environment variables required by the explicitly selected plugin composition.

Install the `nomix-harness-sdk` distribution from PyPI; the import module remains `nomix_harness`:

```sh
python -m pip install nomix-harness-sdk
```

Installing `nomix-harness-sdk` installs the exact same-version `nomix-harness-runtime-bin` platform wheel. The normal entry point therefore needs no executable argument:

```py
from nomix_harness import NomixHarness

with NomixHarness(
    provider="deepseek-official",
    model="deepseek-v4-flash",
    cordis="examples/jsonrpc-agent/cordis.yml",
) as harness:
    result = harness.run("Say hi.")
```

`NomixHarness` keeps its lazily started runtime subprocess for reuse across calls. Use it as a context manager, as above, or call `close()` explicitly when finished.

By default, the SDK launches the bundled single-file `nomix-jsonrpc-agent` executable from the `nomix-harness-runtime-bin` package and injects that package's provider-neutral configuration through `NOMIX_CORDIS_CONFIG`. The configuration includes the stdio JSON-RPC server, agent core, JSONL session persistence with an explicitly composed semantic checkpoint policy, and local bash. It does not register a model provider. Keep the `@nomix-ai/nomix-sdk-jsonrpc-server` entry in a custom composition, register the selected provider explicitly, and pass the Cordis config path.

```py
from nomix_harness import NomixHarness

with NomixHarness(
    provider="deepseek-official",
    model="deepseek-v4-flash",
    max_tokens=49_152,
    cordis="examples/jsonrpc-agent/cordis.yml",
) as harness:
    result = harness.run("Make the requested code change.")
```

`provider` selects a provider route registered by the chosen Cordis composition; `model` is the model id resolved by that adapter. `max_tokens` is an optional positive per-request output-token cap for the root agent and its in-process descendants; omission leaves the provider default in control. Compaction summaries keep the separate limit configured by their compaction plugin. A composition may explicitly mount the built-in DeepSeek provider or `llm-pi-ai`, configure provider-specific credentials and endpoints, and select a model exposed by that provider. An unregistered provider fails during JSON-RPC initialization.

The [Python SDK tutorial](https://github.com/ditgaldev/nomix-harness/blob/master/docs/user/guide/python-sdk.md) provides an ordered installation and first-run path without the Web UI. The [`jsonrpc-agent` example](https://github.com/ditgaldev/nomix-harness/blob/master/examples/jsonrpc-agent/README.md) owns the complete standalone Cordis file used there.

`Session.run()` owns an activity interval from its prompt's durable inbox receipt through the next whole-agent idle and returns `RunResult(session_id, final_response, finish_reason, events, notifications, session_root)`. `final_response` is the last committed root-session assistant text in the interval. `finish_reason` is the `kind` of the last root-session `turn/end` in the interval, such as `completed`, `max-tokens`, or `error`, and is `None` when no turn ended. A `turn/end` without a string `data.reason.kind` violates the runtime protocol and raises `SdkProtocolError`. Both result fields describe the owned interval rather than an output or ending causally assigned to the prompt. Steering, injected context, and other queued work may contribute before idle.

`HarnessClient` retains discovered subagent ancestry for the lifetime of the runtime process. During each `Session.run()`, `RunResult.notifications` and `on_notification` receive the root session and all known descendant notifications in wire order, including nested subagent lifecycle and session events. `RunResult.events` contains root-session events only, so descendant messages cannot replace the root response. The low-level `session_prompt()` returns the queued `MessageId` immediately; callers that bypass `Session.run()` own any later activity boundary themselves.

The same behavior can be selected for the runtime subprocess with `NOMIX_CORDIS_CONFIG`. The injection lives in `HarnessClient.start()`, so the low-level client's default launch gets it too: when the launch resolves to the bundled runtime and neither `cordis` nor a non-empty `NOMIX_CORDIS_CONFIG` is set (the runtime treats an empty value as absent, and so does the injection check), the bundled default configuration is used; an explicit `runtime_bin`, `bridge_bin`, or `launch_args_override` disables the injection entirely. See the [sdk-runtime README](https://github.com/ditgaldev/nomix-harness/blob/master/python/sdk-runtime/README.md) for the runtime carriers (production exe vs dev-only node closure) and how to obtain them.

`cwd` and `runtime_cwd` are resolved to absolute paths before subprocess launch, environment injection, and the wire handshake. The public API exposes only applied options: deployment persona and persistence belong in `cordis.yml`, while `session_root` remains the high-level convenience that sets `NOMIX_SESSION_ROOT`.
