# Migrate to Nomix 0.2

English | [中文](migrating-to-nomix-0.2.zh.md)

Nomix 0.2 removes every pre-Nomix product alias. It does not read, copy, or delete the former `~/.dsh` directory. Copy the data once before starting 0.2 if it must be retained:

```sh
cp -a ~/.dsh/. ~/.nomix/
```

PowerShell:

```powershell
Copy-Item -LiteralPath "$HOME/.dsh" -Destination "$HOME/.nomix" -Recurse
```

After checking the copied data, remove the old directory yourself if desired. Nomix never removes it.

Rename all `DSH_*` environment variables to `NOMIX_*`, package manifest fields from `dsh` to `nomix`, and Python imports from `deepseek_harness` to `nomix_harness`. The CLI and SDK report the corresponding replacement when they encounter an old environment variable or manifest field; they do not silently fall back.

The npm package is `@nomix-ai/nomix-harness`. Internal production plugins are compiled into that package but remain inactive until a profile or business application registers them. DeepSeek remains an optional provider and must be selected explicitly.
