# `@nomix-ai/nomix-harness`

English | [中文](README.zh.md)

The `nomix` command is the product launcher for profiles: ordered stacks of plugin-bundle patch layers under the user's own overrides. The npm release is one portable `@nomix-ai/nomix-harness` tarball whose install lifecycle restores the in-repository runtime packages with the host `tar` command and falls back to its JavaScript extractor when that command is unavailable; npm installs `sharp`, `koffi`, and the built-in loader for the consumer's Windows, macOS, or Linux platform. Installation must allow package lifecycle scripts and optional dependencies; `--ignore-scripts` or `--omit=optional` leaves the runtime unavailable. [`src/args.ts`](src/args.ts) owns the command grammar, and [`src/bin.ts`](src/bin.ts) loads only the selected runner. Invalid commands, options from another mode, configuration errors, and boot failures exit nonzero.

## Entry modes

| Command | Purpose |
|---|---|
| `nomix --profile <name>` | Boot the named profile under `$NOMIX_HOME/profiles/<name>`. |
| `nomix --profile headless "job"` | Run one fresh persisted session, print the final answer, and exit. |
| `nomix web` | Alias of `--profile web`. |
| `nomix plugin --profile <name> <pnpm args>` | Manage a profile's plugins by forwarding to pnpm in the profile directory. |

Without a persistent installation, npm can install and execute the same CLI from its cache:

```sh
npx --yes --package @nomix-ai/nomix-harness@0.1.2 nomix --version
npx --yes --package @nomix-ai/nomix-harness@0.1.2 nomix --profile headless "task"
```

The invoking directory is the default workspace root. The `web` and `headless` profiles auto-initialize on first use from shipped templates; any other profile must be created through `nomix plugin`.

## App arguments

The launcher parses only its own flags and hands everything after them to the booted profile, where any injected app plugin may parse the shared immutable snapshot ([`nomix-cmdline`](../../packages/boot/cmdline/README.md)). Launcher flags therefore come first, and the first token the launcher does not recognize starts the app's arguments:

```sh
nomix --profile web --port 8080       # --port belongs to the web app
nomix --profile tui --resume <id>     # example, assuming the tui profile is installed; --resume belongs to the terminal app
nomix --profile headless "run the tests"
nomix --profile web --help            # the web app's flags, not the launcher's
nomix --help                          # the launcher's own help
```

## Profiles

A profile directory holds a `package.json` (out-of-tree plugin dependencies plus the profile manifest `nomix.profile` with its ordered `bundles` list) and a `cordis.patch.yml` (the user's own patch layer).

The tree composes over an empty root:
- each bundle's patch in `nomix.profile.bundles` order
- then the profile's `cordis.patch.yml`, then the home-level `$NOMIX_HOME/cordis.patch.yml`
- then `--patch` overlays

Bundles named in `nomix.profile.bundles` resolve from the nomix installation first (`@nomix-ai/nomix-base`, `@nomix-ai/nomix-web-app`, `@nomix-ai/nomix-headless`), then from the profile's own `node_modules`, where pnpm installs out-of-tree plugins.

Use `--dump-default-config` and `--dump-config` to inspect the composed tree without booting it.

The [CLI behavior reference](reference/README.md) owns exact layer precedence, flags, shutdown behavior, deployment defaults, and source execution.

## Development

Production runs require built package and frontend artifacts. From the repository root, run `pnpm run build` separately, then use `pnpm nomix <args...>` to run the TypeScript entry and forward every argument; the [source-execution reference](reference/README.md#source-execution) owns the module-resolution contract.
