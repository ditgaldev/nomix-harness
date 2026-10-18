# Loadable Harness plugin packages

This file is GENERATED from workspace manifests (`scripts/gen-plugin-packages.ts`) and verified fresh by `pnpm run verify-plugin-packages` (part of `doc-sync`); do not edit it by hand.

Every package below exports a Cordis plugin that a bundle patch can name in a Loader row. `Config` marks packages whose row accepts a `config` mapping; query `Config.listConfigs` through `cordis_inspect_query` (filter by `name`, then query the `entry` id) for the mounted schema. Packages under `experimental` are pre-stable.

## acp

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-acp` | yes | Automation-only Agent Client Protocol server for driving Nomix Harness agents over JSON-RPC stdio |

## api

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-api-account-controller` | no | Expose safe account operations over authenticated Remote |
| `@nomix-ai/nomix-api-gateway` | yes | Typert Remote Host dispatcher and Client API endpoint |
| `@nomix-ai/nomix-api-job-controller` | yes | Job Remote observation stream and the reference-counted client job-output service |
| `@nomix-ai/nomix-api-remote-access` | no | Method-level Remote access control for non-owner Peers and the per-Peer access snapshot |
| `@nomix-ai/nomix-api-remotes` | no | Remote BFF assembly for application-selected Host capabilities |
| `@nomix-ai/nomix-api-session-controller` | yes | Session Remote commands, cold reads, and live control transport |
| `@nomix-ai/nomix-api-settings-controller` | yes | Remote owner for the configuration surfaces over the settings-domain seams |
| `@nomix-ai/nomix-api-terminal-controller` | yes | Session-owned interactive terminals with shell discovery, screen recovery and typed Remote control |
| `@nomix-ai/nomix-api-workspace-controller` | yes | Workspace Remote commands and reconnect-safe state transport |
| `@nomix-ai/nomix-api-workspace-files` | yes | Workspace file service and Client resource provider: bounded reads, directory listing, and live metadata over the workspaceFiles Remote namespace |

## attachment

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-attachment-local` | yes | Private content-addressed NOMIX_HOME attachment storage |

## boot

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-config-editor` | no | Persist plugin configuration through profile patches and Loader reconciliation |
| `@nomix-ai/nomix-hmr` | yes | Coordinated module and profile configuration hot reload |
| `@nomix-ai/nomix-plugin-manager` | yes | Current-profile plugin and bundle management shared by nomix CLI, Web and agent tools |
| `@nomix-ai/nomix-plugin-market` | yes | Configured plugin market indexes for the Web Discover page and the plugin_market agent tool |

## browser-use

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-browser-use` | no | Exclusive named browser-use provider registration |

## bundle

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-acp-app` | no | The nomix ACP profile bundle: automation-only JSON-RPC stdio and process lifecycle over nomix-base |
| `@nomix-ai/nomix-headless` | yes | The nomix one-shot bundle: a direct core Agent/Session runner over nomix-base with no Host, HTTP, or browser layer |
| `@nomix-ai/nomix-sdk-app` | yes | The nomix SDK profile bundle: stdio JSON-RPC serving and process lifecycle over nomix-base |
| `@nomix-ai/nomix-web-app` | yes | The nomix browser-surface bundle: the web patch layer over nomix-base plus the runtime glue plugin (frontend dist serving, bash runtime variables, URL line) |

## client

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-client-connection` | yes | Authenticated RPC transport and generation lifecycle |
| `@nomix-ai/nomix-client-file-upload` | no | Agent-scoped browser file upload, streaming intake, and staged receipt service |
| `@nomix-ai/nomix-client-hmr` | yes | Web client graph synchronization and rebuilt-bundle reload transport |
| `@nomix-ai/nomix-client-locale` | no | Locale plugin: Host-backed preference, extensible language catalog, browser fallback, and typed built-in dictionaries |
| `@nomix-ai/nomix-client-modules` | no | Client module system, dual-face: node half composes the __NOMIX_BOOT__ entry graph (incremental nomix.client scan, bundle route, index tap, webPlugins service); browser half is the lazy-CJS module table the vendored cordis Loader consumes as its internal seam |
| `@nomix-ai/nomix-client-product-analytics` | yes | Desktop product event collection and authenticated Host reporting |
| `@nomix-ai/nomix-client-resources` | no | Unified client resource model: protocol-registered providers turn URL addresses into live values, consumed through the useResource global standard hook |
| `@nomix-ai/nomix-client-shortcuts` | yes | Application keyboard command registry and physical-key routing |
| `@nomix-ai/nomix-client-ui-agent-preset` | no | Agent-preset surfaces: the default for later sessions, this session's seat, and the composition editor |
| `@nomix-ai/nomix-client-ui-approval` | no | Approval composer takeover over the scoped Remote Event waterfall |
| `@nomix-ai/nomix-client-ui-attachment` | no | Dynamic attachment presentation plugin for conversation input, message-image, and trajectory image slots |
| `@nomix-ai/nomix-client-ui-brand-official` | no | Official Nomix Harness brand occupants for the Web client's sidebar slots |
| `@nomix-ai/nomix-client-ui-chat` | no | Chat Conversation target, node definitions, renderers, and details surface |
| `@nomix-ai/nomix-client-ui-commands` | no | Client command surface: global directory cache, '/' source, three command UI kinds, popupSelect registry |
| `@nomix-ai/nomix-client-ui-conversation` | no | Target-neutral Conversation assembly, shell, composer, queue, and view navigation |
| `@nomix-ai/nomix-client-ui-deepseek-model-label-1017` | no | Temporary 1017 release badge for official DeepSeek Flash model labels |
| `@nomix-ai/nomix-client-ui-deliverables` | no | Changed-files card with per-file comparison tabs, delivery cards, and clickable final-response file references for Web |
| `@nomix-ai/nomix-client-ui-directory-picker-browse` | no | In-app directory browsing surface: the workspace directory-flow owner rendering the host's listing and creation primitives |
| `@nomix-ai/nomix-client-ui-directory-picker-native` | no | Native directory-picker surface: the renderless workspace directory-flow occupant driving the local Desktop or Host OS chooser |
| `@nomix-ai/nomix-client-ui-goal` | no | Session goal surface: GoalBar docked above the composer, read from the goal session projection |
| `@nomix-ai/nomix-client-ui-input-trigger` | no | Input trigger pipeline: '/' and '@' detection, candidate menu, pick routing to registered sources |
| `@nomix-ai/nomix-client-ui-jobs` | no | Session-header background-job list with on-demand streaming record panels |
| `@nomix-ai/nomix-client-ui-layout` | no | Shell plugin: three-column AppFrame with drag handles, ctx.layout viewing-state service (navigation + panels) |
| `@nomix-ai/nomix-client-ui-message-feedback` | no | The Web feedback surface: per-message Like/Dislike in the assistant-message action strip and the feedback dialog behind both ratings and /feedback, backed by the messageFeedback and sessionFeedback Host Remotes |
| `@nomix-ai/nomix-client-ui-model-selection` | no | Model selection over the shared model catalog, Session projection, and session.selectModel |
| `@nomix-ai/nomix-client-ui-open-in-app` | no | Web "Open In..." controls: the Session-header split button opening the workspace directory in an installed application, and the document preview's default-application controls for one file |
| `@nomix-ai/nomix-client-ui-permission-presets` | no | Permission surfaces: a new-session default in General settings and a current-session /permission popup over the permissions projection |
| `@nomix-ai/nomix-client-ui-plan` | no | Plan mode controls, persistent transcript plan cards, and sidebar Markdown previews |
| `@nomix-ai/nomix-client-ui-plugin-manager` | yes | Plugin management for the nomix web client: the sidebar Plugins panel installs, enables, disables, retries, and composes installed plugin packages |
| `@nomix-ai/nomix-client-ui-plugin-market` | no | Discover tab of the nomix web Plugins page: browse configured plugin market indexes and install their bundles |
| `@nomix-ai/nomix-client-ui-reference` | no | Unified Web @file and @session reference source |
| `@nomix-ai/nomix-client-ui-renderer` | no | Browser UI renderer: React slot bindings, ctx.uiRenderer, and the assembled application root |
| `@nomix-ai/nomix-client-ui-schedule` | no | Host task management page and Session reminder catalog |
| `@nomix-ai/nomix-client-ui-secret-mask` | no | Web display masking for recognized credentials in sent user text |
| `@nomix-ai/nomix-client-ui-session` | no | Session Controller adapter for React and session-scoped slots |
| `@nomix-ai/nomix-client-ui-settings` | no | Settings domain base plugin: shared configuration forms and the canonical settings slot-type contract |
| `@nomix-ai/nomix-client-ui-settings-account` | yes | Manage DeepSeek login and open Platform billing pages |
| `@nomix-ai/nomix-client-ui-settings-agent-loop` | no | Settings page of the agent loop on the nomix web client's Plugins page: the parallel tool-call cap of the agent-loop namespace |
| `@nomix-ai/nomix-client-ui-settings-general` | no | Settings ownerless-copy and product onboarding plugin: the General section, shell trigger/header chrome content, settings dictionaries, and the versioned welcome notice |
| `@nomix-ai/nomix-client-ui-settings-models` | yes | Models settings and shared product-onboarding dialogs over existing settings and credential joins |
| `@nomix-ai/nomix-client-ui-settings-plugin-inventory` | no | Read-only Cordis Loader inventory tab in Web Plugins settings |
| `@nomix-ai/nomix-client-ui-settings-plugins` | no | Built-in plugins settings section for the nomix web client: the Settings navigation entry and the tab chrome feature-owned tabs register into |
| `@nomix-ai/nomix-client-ui-settings-session-log` | no | General settings control for Session-log upload with DeepSeek API requests |
| `@nomix-ai/nomix-client-ui-settings-shell` | no | Settings page of the shell executor on the nomix web client's Plugins page: the command timeout and the per-stream output cap of the shell namespace |
| `@nomix-ai/nomix-client-ui-settings-subagent` | no | Settings page of Subagent delegation on the nomix web client's Plugins page: recursion depth, parallel capacity, and the models agents may choose for subagents |
| `@nomix-ai/nomix-client-ui-settings-web-search` | no | Settings page of the DeepSeek web-search provider on the nomix web client's Plugins page: its API key, endpoint, and per-request search budget |
| `@nomix-ai/nomix-client-ui-shortcuts` | no | Keyboard shortcut reference, recording, and local preference editing |
| `@nomix-ai/nomix-client-ui-sidebar` | no | Sidebar plugin: session multi-level tree, search, grouping, state dots |
| `@nomix-ai/nomix-client-ui-sidebar-browser` | no | Sandboxed Web browser tabs for the right Sidebar |
| `@nomix-ai/nomix-client-ui-sidebar-documentpreview` | yes | Extensible Sidebar previews for Office documents, spreadsheets, Markdown, code, images, PDF, HTML, and plain text |
| `@nomix-ai/nomix-client-ui-sidebar-files` | no | Workspace file tree tab type for the right Sidebar: lazy directory listing over the workspaceFiles Remote namespace, opening files into the Sidebar |
| `@nomix-ai/nomix-client-ui-sidebar-right` | no | Right Sidebar: the docking surface's session-bound state, its panel and header expand control, and the navigation service over it |
| `@nomix-ai/nomix-client-ui-sidebar-terminal` | no | Interactive shell tabs for the right Sidebar |
| `@nomix-ai/nomix-client-ui-skill` | no | Web skill references and the dedicated skill tool row |
| `@nomix-ai/nomix-client-ui-subagent` | no | Subagent conversation catalog, continuation routing UI, and '@' reference source |
| `@nomix-ai/nomix-client-ui-theme` | yes | Theme plugin: Host bootstrap for the pre-plugin palette; DOM-free ThemeRuntime for light/dark/system state; --dsw-* token styles and Appearance settings row |
| `@nomix-ai/nomix-client-ui-tool` | no | Client Tool call-tree renderer and keyed per-tool presentation slot |
| `@nomix-ai/nomix-client-ui-trajectory` | no | Trajectory event ledger with an interactive timing overview: pure-consumer plugin registering into the conversation ViewMap (no service) |
| `@nomix-ai/nomix-client-ui-user-questions` | no | Web ask_user_question composer takeover and plan-review presentation UI |
| `@nomix-ai/nomix-client-ui-workflow-run` | no | Durable workflow-run Conversation Node and nested member disclosure for nomix web |
| `@nomix-ai/nomix-client-ui-workspace` | no | Workspace picker plugin: one WorkspacePicker registered into the sidebar and empty-state workspace slots |

## compaction

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-command-compact` | no | Human-facing slash command for explicit session compaction |
| `@nomix-ai/nomix-compaction-basic` | yes | Token-meter-driven compaction policy and LLM summarization backend for the Nomix Harness |
| `@nomix-ai/nomix-compaction-image-offload` | no | Durable image offload for image-capable routes: replace over-budget request images with placeholders and retry |
| `@nomix-ai/nomix-compaction-tool-result-pruner` | yes | Replay-safe model-free head/middle/tail pruning for tool-result surface nodes |

## computer-use

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-computer-use` | no | Exclusive named computer-use provider registration |

## context

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-agent-instructions` | yes | Workspace context loader for AGENTS.md/CLAUDE.md instruction files |
| `@nomix-ai/nomix-file-reference-local` | yes | Local-filesystem ctx.fileReferences provider with bounded fuzzy indexes |
| `@nomix-ai/nomix-harness-dev-context` | no | Model context naming the Nomix Harness checkout and Web GUI URL without letting either change the system prompt |
| `@nomix-ai/nomix-session-reference` | yes | Cross-session snapshot references and durable untrusted model context (ctx.sessionReferenceResolver) |
| `@nomix-ai/nomix-time-context` | yes | Durable per-step context with the current time and elapsed time |
| `@nomix-ai/nomix-tmux-context` | yes | Opt-in durable per-step context with this agent's tmux pane and window location |

## core

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-agent` | no | Agent interface, registry, initiator scope, and event vocabulary for the Nomix Harness |
| `@nomix-ai/nomix-agent-default-model` | yes | Default model selection shared by Agent entry points |
| `@nomix-ai/nomix-agent-loop` | yes | The concrete agent loop plugin for the Nomix Harness |
| `@nomix-ai/nomix-agent-tool-presentation` | yes | Agent-plane presentation selector: composes one agent's tools as PTC mode or native tool calls |
| `@nomix-ai/nomix-session` | no | Event-sourced session store for the Nomix Harness |
| `@nomix-ai/nomix-system-prompt` | yes | System prompt assembly registry for the Nomix Harness |
| `@nomix-ai/nomix-tools` | yes | Tool registry and execution pipeline for the Nomix Harness |

## credentials

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-authorization` | no | Authorization seam (ctx.authorization): plugin-owned flows that obtain a credential through a conversation with the human |
| `@nomix-ai/nomix-credentials-local` | yes | File-backed credentials provider ($NOMIX_HOME/.env under the live process environment) for the Nomix Harness |
| `@nomix-ai/nomix-deepseek-account-platform` | yes | Authorize DeepSeek accounts through browser PKCE |

## deliverables

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-tool-present` | yes | Explicit workspace file delivery declarations for the Nomix Harness |
| `@nomix-ai/nomix-workspace-changes` | yes | Per-turn workspace file changes recorded from git working-tree snapshots and whole-file captures, with per-file comparisons, for the Nomix Harness |

## document

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-office-to-pdf` | yes | Shared Office-to-PDF conversion with bounded queues and caching |

## experimental

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-experimental-agent-team` | yes | Implicit-root Agent Teams roster, direct peer messaging, and shared task DAG |
| `@nomix-ai/nomix-experimental-api-speech-to-text` | yes | Authenticated experimental speech transcription for browser clients |
| `@nomix-ai/nomix-experimental-auto-review` | no | Per-tool LLM authorization review for the Nomix Harness Auto permission preset |
| `@nomix-ai/nomix-experimental-browser-use-chrome-devtools-mcp` | yes | Experimental per-Session Chromium browser tools through chrome-devtools-mcp |
| `@nomix-ai/nomix-experimental-browser-use-playwright-mcp` | yes | Experimental per-Session Chromium browser tools through @playwright/mcp |
| `@nomix-ai/nomix-experimental-browser-use-stagehand-native` | yes | Experimental Stagehand browser tools with separately configured native models |
| `@nomix-ai/nomix-experimental-claude-code-mods` | yes | Experimental bridge: load Claude Code mods (hooks modules) and run their hook chains on Nomix Harness extension points |
| `@nomix-ai/nomix-experimental-client-ui-agent-team` | no | Web Agent Teams roster, task board, and teammate navigation |
| `@nomix-ai/nomix-experimental-client-ui-claude-code-mods` | no | Web band above the prompt for Claude Code mods: draws each session's mod tree and sends button presses back to the bridge |
| `@nomix-ai/nomix-experimental-client-ui-cot-translation` | yes | Optional machine translation of expanded reasoning, preserving original Session text |
| `@nomix-ai/nomix-experimental-client-ui-voice-input` | no | Record speech and insert editable text into the conversation draft |
| `@nomix-ai/nomix-experimental-computer-use-cua-driver-mcp` | yes | Experimental computer use through an installed Cua Driver MCP executable |
| `@nomix-ai/nomix-experimental-computer-use-cua-driver-native` | no | Experimental computer-use provider embedding the Cua Driver native npm SDK |
| `@nomix-ai/nomix-experimental-cua-macos` | yes | macOS native provider for shared Computer Use application and window objects |
| `@nomix-ai/nomix-experimental-inspector` | yes | Experimental cross-realm CDP hub for Host debugging and Client Runtime inspection |
| `@nomix-ai/nomix-experimental-ptc-runtime-python` | yes | CPython subprocess implementation of the Nomix Harness PTC execution seam |
| `@nomix-ai/nomix-experimental-session-inspector` | no | Experimental virtualized Session log and live Chat group/node inspectors |
| `@nomix-ai/nomix-experimental-speech-to-text` | yes | Experimental speech recognition with independently selectable providers |
| `@nomix-ai/nomix-experimental-speech-to-text-sensevoice` | yes | Local SenseVoice ONNX transcription with a managed sherpa-onnx process |
| `@nomix-ai/nomix-experimental-tool-agent-team` | yes | Scoped model-facing Agent Teams tools over ctx.agentTeams |
| `@nomix-ai/nomix-experimental-tool-worktree` | no | Model tool that creates and enters a new Git worktree |
| `@nomix-ai/nomix-experimental-translator` | yes | Machine translation with reusable Session results |
| `@nomix-ai/nomix-experimental-worktree` | yes | Creates a named Git worktree and changes the calling Session working directory |
| `@nomix-ai/nomix-hooks-claude-code` | yes | Bridge plugin: run a Claude Code hooks.json / settings hook config on the Nomix Harness interception seams |
| `@nomix-ai/nomix-hooks-codex` | yes | Bridge plugin: run a Codex hooks.json hook config on the Nomix Harness interception seams |
| `@nomix-ai/nomix-session-title-all-prompts-llm` | yes | All-user-messages LLM provider plugin for Nomix Harness session titles |
| `@nomix-ai/nomix-skill-badge` | no | Bundled nomix badge skill provider for Nomix Harness |
| `@nomix-ai/nomix-tool-ralph` | yes | Model-facing fresh-agent Ralph loop over the workflow and subagent seams |
| `@nomix-ai/nomix-tool-session-query` | yes | Workspace-authorized model-facing session history search, trace, and event read tools |
| `@nomix-ai/nomix-tool-terminal` | yes | Six model-facing persistent PTY tools with owner isolation and generic background-job integration |
| `@nomix-ai/nomix-webhook` | no | Fire-and-forget webhook rule runtime that creates Workspace-backed Nomix Harness Sessions |
| `@nomix-ai/nomix-webhook-github` | yes | Signed GitHub HTTP webhook adapter for the Nomix Harness webhook runtime |

## extensions

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-client-ui-cordis` | no | Cordis dynamic-plugin definition card: the keyed cordis_define tool row with its run/stop switch |
| `@nomix-ai/nomix-cordis-client-runner` | no | Browser half of dynamic dual-half plugin packages: event subscription, closure evaluation, guard facade, and loader entries |
| `@nomix-ai/nomix-cordis-host-runner` | yes | Dynamic package definition registry, host-half sandbox lifecycle, and invoke handler table for model-mounted dual-half packages |
| `@nomix-ai/nomix-tool-cordis` | no | Read-only runtime API inspection for Harness plugin development |

## feedback

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-command-feedback` | no | Log-only session feedback: the record event, the sessionFeedback Host Remote, and the human-facing slash command |
| `@nomix-ai/nomix-message-feedback` | yes | Canonical Session-log ratings and notes for finalized assistant messages |

## fs

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-fs-local` | yes | Local-filesystem implementation of the Nomix Harness filesystem seam (ctx.fs) |
| `@nomix-ai/nomix-fs-observation-policy` | no | File-context policy plugin for the Nomix Harness — observed-state, read-before-edit, and version-guarded write/edit added over the ctx.fs provider seam through the fs/* event gate (no service API) |
| `@nomix-ai/nomix-fs-sandbox` | yes | Sandbox-enforcing implementation of the Nomix Harness filesystem seam: fences write/edit by the per-call sandbox mode (read-only denies mutation, workspace-write contains it to the workspace + temp roots) while reads pass through |
| `@nomix-ai/nomix-tool-fs` | yes | Model-facing filesystem tools (read, write, edit) over the Nomix Harness filesystem seam (ctx.fs) |
| `@nomix-ai/nomix-tool-fs-search` | yes | Model-facing filesystem discovery tools (glob, grep) backed by the packaged ripgrep binary (@vscode/ripgrep) |
| `@nomix-ai/nomix-tool-str-replace-editor` | yes | Model-facing view, create, literal replace, and line insert tool over the Harness filesystem service |

## goal

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-command-goal` | no | Human-facing slash command for persisted same-session goals |
| `@nomix-ai/nomix-goal` | yes | Event-sourced same-session goal state and lifecycle service for the Nomix Harness |
| `@nomix-ai/nomix-goal-round-driver` | no | Race-fenced same-session goal-round driver |
| `@nomix-ai/nomix-tool-goal` | yes | Model-facing same-session goal tools with execution-time authority checks |

## guard

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-repeat-tool-reminder` | yes | Repeat-tool-call guard plugin: advisory reminders when an agent loops on identical tool calls |
| `@nomix-ai/nomix-tool-call-timeout-policy` | no | Tool-call timeout policy: a tools/execute wrapper that arms a per-tool deadline on exec.signal and returns TOOL_TIMEOUT when it wins |

## host

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-host-directory-picker-auto` | no | Adaptive chooser of the directory-picker seam: resolves the host situation at boot and mounts the native or browse backend for the Nomix Harness web GUI host |
| `@nomix-ai/nomix-host-directory-picker-browse` | yes | In-app browsing backend of the directory-picker seam (listing/creation primitives over the host filesystem) |
| `@nomix-ai/nomix-host-directory-picker-native` | no | Native-OS-chooser backend of the directory-picker seam for the Nomix Harness web GUI host |
| `@nomix-ai/nomix-host-frontend-static` | yes | SPA dist server for the Web shell: owns the webserver fallback seat, serving explicit index entries and static assets with traversal rejection and 404 misses |
| `@nomix-ai/nomix-host-open-in-app` | yes | Host half of open-in-app: resolved application catalog, icons, and the launch endpoint as three webServer routes |
| `@nomix-ai/nomix-host-plugin-inventory` | no | Read-only Remote projection of current Cordis Loader plugin state |
| `@nomix-ai/nomix-host-product-telemetry-otel` | yes | Explicit product usage events exported through OpenTelemetry HTTP logs |
| `@nomix-ai/nomix-host-webserver` | yes | Web route-registration plugin: HTTP and upgrade routes, index transform taps, and static dist fallback; knows no harness concepts |

## interaction

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-commands` | no | Plugin-owned human command registry for Nomix Harness UIs |
| `@nomix-ai/nomix-permission-presets` | yes | User-facing permission presets (ctx.permissionPresets) for the Nomix Harness: one product-level Permissions select bundling the sandbox-mode and approval-policy knobs, written through to their own session events |
| `@nomix-ai/nomix-tool-ask-user` | yes | Model-facing ask_user_question tool over the ctx.userQuestions seam |
| `@nomix-ai/nomix-user-approval` | yes | User-approval seam (ctx.approval) for the Nomix Harness: one-shot permission decisions dispatched to composed answerers over the approval/request waterfall, fail-closed by default |
| `@nomix-ai/nomix-user-questions` | no | Abstract user-questions seam (ctx.userQuestions) for asking the human during agent runs |

## jobs

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-jobs-local` | yes | Process-local implementation of the Nomix Harness background job registry seam |
| `@nomix-ai/nomix-tool-jobs` | yes | Model-facing background job control tools (job_output, job_list, job_kill) over the ctx.jobs registry |

## llm

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-deepseek-llm-api-extensions` | no | Additive request-field registry for the official DeepSeek LLM API adapter |
| `@nomix-ai/nomix-llm` | no | Provider-neutral LLM service interface for the Nomix Harness |
| `@nomix-ai/nomix-llm-deepseek-account` | yes | DeepSeek account provider authentication and discovery |
| `@nomix-ai/nomix-llm-deepseek-api-key` | yes | DeepSeek api-key provider authentication and discovery |
| `@nomix-ai/nomix-llm-pi-ai` | yes | pi-ai-backed DeepSeek adapter for the Nomix Harness LLM seam (design-verification twin of nomix-llm-deepseek) |
| `@nomix-ai/nomix-llm-retry` | yes | Provider-routed LLM request retry policy for the Nomix Harness |
| `@nomix-ai/nomix-plugin-package-inventory-deepseek` | yes | Active Loader-backed plugin package inventory for official DeepSeek LLM API requests |
| `@nomix-ai/nomix-token-meter` | yes | Replay-aware token measurement service (ctx.tokenMeter) for the Nomix Harness |

## lsp

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-lsp` | no | Abstract LSP capability seam (ctx.lsp) for the Nomix Harness — language-server provider registry keyed by branded id and extension mapping, order-independent per-query selection, normalized definition/references/implementation/hover requests and results, and the LspError taxonomy |
| `@nomix-ai/nomix-lsp-stdio` | yes | Generic stdio language-server provider for the Nomix Harness LSP capability seam (ctx.lsp) — spawns configured servers, translates JSON-RPC, and serves transient-open goToDefinition/findReferences/goToImplementation/hover queries in the host filesystem namespace |
| `@nomix-ai/nomix-tool-lsp` | yes | Model-facing lsp tool over the Nomix Harness LSP capability seam (ctx.lsp) — one read-only tool with goToDefinition/findReferences/goToImplementation/hover operations, one-based UTF-16 cursor coordinates, bounded location rendering, and hover normalization |

## mcp

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-mcp-client` | yes | MCP client bridge: connects to MCP servers and registers their tools on ctx.tools |
| `@nomix-ai/nomix-mcp-resources` | no | Scoped MCP resource discovery and reading through shared model tools |

## plan

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-plan-mode` | yes | Logged per-agent plan mode with deployment guidance, a direct slash command, and a user-reviewed exit |

## preset

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-agent-preset` | yes | Declare an Agent capability composition in Cordis YAML |
| `@nomix-ai/nomix-agent-preset-registry` | yes | Declarative Agent preset registry and profile-backed editing |
| `@nomix-ai/nomix-persona` | yes | Composition-authored deployment persona section for the Nomix Harness |

## ptc-runtime

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-ptc-runtime-node` | yes | Node PTC execution with per-call sandboxed processes or in-memory REPL state |

## sandbox

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-sandbox-local` | yes | Local process-sandbox backends for the Nomix Harness sandbox seam: bwrap, the npm-distributed landlock-run launcher, macOS Seatbelt, or the Windows ACL restricted-token runner — functionally probed, fail-closed |
| `@nomix-ai/nomix-sandbox-policy` | yes | Per-call sandbox policy resolver and current model context: deployment fallbacks plus each session's mode and workspace root, shared by every enforcing capability family |

## schedule

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-schedule` | yes | Host-wide durable reminders with shared management and original-Session delivery |
| `@nomix-ai/nomix-tool-schedule` | no | Model-facing reminder management tools (schedule_create, schedule_list, schedule_update, schedule_delete) over the Host ctx.schedule service |

## sdk

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-sdk-jsonrpc-server` | yes | Stdio JSON-RPC server plugin for out-of-process Nomix Harness SDK clients |

## session

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-session-checkpoint-policy` | no | Semantic session durability checkpoints before model requests and tool side effects |
| `@nomix-ai/nomix-session-log-deepseek` | yes | Incremental lossless session-log request extension for the official DeepSeek LLM API |
| `@nomix-ai/nomix-session-persistence-jsonl` | yes | JSONL durable session persistence backend for the Nomix Harness |
| `@nomix-ai/nomix-session-projection` | no | Session-projection seam: the merge-extensible projection type table, the provider contract, and the ctx.sessionProjections registry serving whole current values of log-derived per-session state |
| `@nomix-ai/nomix-session-projection-cache` | yes | Persisted projection cache (ctx.sessionProjectionCache): durable per-session checkpoint records on the session_projcache storage domain (per-record layout), throttled write-behind, and the cached listing read |
| `@nomix-ai/nomix-session-stats` | no | Whole-log conversation counts and wall times projection (sessionStats) for the Nomix Harness |
| `@nomix-ai/nomix-session-telemetry-otel` | yes | Feedback-authorized Session logs over byte-bounded OpenTelemetry HTTP requests |
| `@nomix-ai/nomix-session-title` | yes | Log-backed session title service and provider registry for the Nomix Harness |
| `@nomix-ai/nomix-session-title-first-prompt-llm` | yes | First-message LLM provider plugin for Nomix Harness session titles |
| `@nomix-ai/nomix-session-turn-outline` | no | Whole-log turn outline projection (turnOutline) for the Nomix Harness |
| `@nomix-ai/nomix-tool-working-directory` | no | Read and change the active Session working directory |
| `@nomix-ai/nomix-working-directory` | yes | Session working directories with durable changes and model context |

## session-query

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-session-log-export` | yes | Web Session-log export command and shared download dialog |
| `@nomix-ai/nomix-session-query-sqlite` | yes | Concrete ctx.sessionQuery backend with SQLite FTS5 search |

## settings

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-settings` | no | Abstract user-settings seam (ctx.settings) for the Nomix Harness |

## shell

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-bash-local` | yes | Local-subprocess implementation of the Nomix Harness bash executor seam |
| `@nomix-ai/nomix-bash-sandbox` | yes | Sandbox-consuming implementation of the Nomix Harness bash executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@nomix-ai/nomix-pwsh-local` | yes | Local PowerShell implementation of the Nomix Harness bash executor seam |
| `@nomix-ai/nomix-pwsh-sandbox` | yes | Sandbox-consuming implementation of the Nomix Harness PowerShell executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@nomix-ai/nomix-shell-env` | yes | Tool-independent managed NOMIX_* shell environment registry |
| `@nomix-ai/nomix-tool-bash` | yes | Model-facing bash tool with optional generic background-job and sandbox-escalation support |
| `@nomix-ai/nomix-tool-bash-persistent` | yes | Model-facing owner-scoped persistent Bash tool backed by the Harness PTY service |
| `@nomix-ai/nomix-tool-pwsh` | yes | Model-facing pwsh tool over the bash executor seam |
| `@nomix-ai/nomix-tool-pwsh-persistent` | yes | Model-facing owner-scoped persistent PowerShell tool backed by the Harness PTY service |

## skill

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-skill` | yes | Agent skill provider registry for the Nomix Harness |
| `@nomix-ai/nomix-skill-filesystem` | yes | Local filesystem skill provider for the Nomix Harness |
| `@nomix-ai/nomix-skill-office` | yes | Bundled Word, PowerPoint, and Excel workflows and LibreOffice Kit operations |
| `@nomix-ai/nomix-tool-skill` | yes | Model-facing skill loading tool for the Nomix Harness |
| `@nomix-ai/nomix-tool-workspace-dependencies` | yes | The load_workspace_dependencies tool: absolute paths into a bundled Python, Node.js, and pnpm payload |

## spill

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-spill-local` | yes | Local-filesystem implementation of the Nomix Harness spill storage seam (private session-scoped files) |
| `@nomix-ai/nomix-spill-policy` | yes | Token-budgeted tool-result retention with recoverable text and image paths |

## ssh

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-fs-ssh` | no | Filesystem provider over the shared POSIX SSH helper |
| `@nomix-ai/nomix-sandbox-ssh` | no | Remote POSIX sandbox argv provider over the shared SSH helper |
| `@nomix-ai/nomix-ssh` | yes | Shared OpenSSH connection and versioned POSIX remote helper |
| `@nomix-ai/nomix-subprocess-ssh` | no | Subprocess and terminal provider over the shared POSIX SSH helper |

## storage

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-storage` | no | Storage hub (ctx.storage): named backend registry plus mounted data-form facilities for the Nomix Harness |
| `@nomix-ai/nomix-storage-domain` | yes | Domain data form (ctx.storage.domain): schema-validated, event-emitting KV domains over storage backends for the Nomix Harness |
| `@nomix-ai/nomix-storage-json` | yes | JSON file KV storage backend for the Nomix Harness storage hub |
| `@nomix-ai/nomix-storage-sqlite` | yes | SQLite storage backend (kv facet) for the Nomix Harness storage hub |

## subagent

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-subagent` | yes | Abstract subagent seam (ctx.subagents): named-provider registry for delegating to child agents |
| `@nomix-ai/nomix-subagent-acp` | yes | Out-of-process ACP subagent backend: drives a child agent in a spawned subprocess over the Agent Client Protocol |
| `@nomix-ai/nomix-subagent-claude-code` | yes | One-shot Claude Code subagent provider over the official Agent SDK |
| `@nomix-ai/nomix-subagent-codex` | yes | One-shot Codex subagent provider over the official app-server protocol |
| `@nomix-ai/nomix-subagent-fork-in-process` | yes | In-process fork subagent backend: runs a child agent seeded with a prefix of the parent's log |
| `@nomix-ai/nomix-subagent-nomix-sdk` | yes | Out-of-process SDK subagent backend: drives a child Nomix Harness runtime subprocess over stdio JSON-RPC through the TypeScript SDK client |
| `@nomix-ai/nomix-subagent-spawn-in-process` | yes | In-process spawn subagent backend: runs a fresh child agent on ctx.agents |
| `@nomix-ai/nomix-tool-subagent` | yes | Model-facing subagent delegation tool over the ctx.subagents seam |
| `@nomix-ai/nomix-tool-subagent-control` | no | Globally named send_message, interrupt_agent, and list_agents tools over ctx.subagents continuations |

## subprocess

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-subprocess-local` | no | Local-subprocess implementation of the Nomix Harness subprocess seam |

## telemetry

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-otel` | no | Cordis service for independent ordinary-event and byte-bounded Session-log OTLP channels |

## terminal

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-terminal` | no | Persistent PTY session seam for the Nomix Harness — owner-scoped ids, backend registry, interactive sends, reads, signals, and awaited cleanup |
| `@nomix-ai/nomix-terminal-bash` | yes | Persistent shell PTY backend over the Nomix Harness subprocess terminal primitive |

## test-support

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-llm-replay` | yes | Replay LLM plugin: short-circuits llm/stream with model chunks reconstructed from a recorded session JSONL (keyless snapshot tests) |

## todo

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-tool-todo` | yes | Model-facing todo_write tool over the Nomix Harness event-sourced session log |

## typert

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-typert-loader` | yes | Loader integration for generated Typert package contributions |

## web

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-tool-web` | yes | Model-facing web tools (web_search, web_fetch) over the Nomix Harness web capability seam (ctx.web) |
| `@nomix-ai/nomix-web` | yes | Abstract web access capability seam (ctx.web) for the Nomix Harness — search/fetch provider registry, registration-order-independent selection, request/result vocabulary, and the WebError taxonomy |
| `@nomix-ai/nomix-web-deepseek-api` | yes | DeepSeek Search and Fetch API providers for the Nomix Harness web capability seam (ctx.web) |
| `@nomix-ai/nomix-web-fetch-http` | yes | Anonymous public HTTP(S) fetch provider for the Nomix Harness web capability seam (ctx.web) |
| `@nomix-ai/nomix-web-search-deepseek` | yes | DeepSeek-backed search provider (native web_search via the Anthropic-compatible API) for the Nomix Harness web capability seam (ctx.web) |
| `@nomix-ai/nomix-web-search-exa` | yes | Exa-backed search provider for the Nomix Harness web capability seam (ctx.web) |
| `@nomix-ai/nomix-web-search-perplexity` | yes | Perplexity-backed search provider for the Nomix Harness web capability seam (ctx.web) |

## workflow

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-tool-workflow` | yes | Model-facing workflow tool: run a JavaScript orchestration script over ctx.workflowEngine |
| `@nomix-ai/nomix-workflow-ptc` | yes | Workflow orchestration in the shared sandboxed Node PTC runtime |

## workspace

| Package | Config | Description |
|---|---|---|
| `@nomix-ai/nomix-workspace` | no | Workspace entity registry (ctx.workspaceRegistry): durable workspace records with validated session attachment over the domain data form for the Nomix Harness |
