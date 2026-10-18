---
kind: upgrade-guide
description: "The `agent-instructions` row no longer accepts `nomixHome`; instruction loading always resolves the harness home from `$NOMIX_HOME` or `~/.nomix`."
---

# Instruction loading resolves one harness home

English | [中文](guide.zh.md)

## Change

`@nomix-ai/nomix-agent-instructions` removed its `nomixHome` config field. The plugin resolves the harness home through `resolveNomixHome()` from `@nomix-ai/nomix-home-paths`, like every other harness consumer: the home is `$NOMIX_HOME` when it is set and non-blank, otherwise `~/.nomix`, with tilde expansion.

A `cordis.yml`, profile patch, or `--patch` overlay that still sets `nomixHome` on the `agent-instructions` row has no effect: the row keeps the stray key and the plugin ignores it, so instruction loading follows the process home. Other providers, such as `nomix-skill-filesystem` and `nomix-shell-env`, keep their own home fields; this removal covers the instruction loader only.

## Migration

1. Delete `nomixHome` from the `agent-instructions` row in `cordis.yml`, `$NOMIX_HOME/cordis.patch.yml`, `$NOMIX_HOME/profiles/<profile>/cordis.patch.yml`, and any `--patch` overlay.
2. Where the override pointed at a non-default home, export `NOMIX_HOME` for the process instead, so every harness consumer reads that home.
3. Confirm with `nomix --profile <profile> --dump-config` that the `agent-instructions` row lists only its remaining fields, and that a new session's first request shows `Instructions from: $NOMIX_HOME/AGENTS.md` (or `~/.nomix/AGENTS.md`) when that file exists.
