# 迁移到 Nomix 0.2

[English](migrating-to-nomix-0.2.md) | 中文

Nomix 0.2 删除全部旧产品名称兼容入口。它不会读取、复制或删除原来的 `~/.dsh` 目录。如需保留数据，请在启动 0.2 前执行一次复制：

```sh
cp -a ~/.dsh/. ~/.nomix/
```

PowerShell：

```powershell
Copy-Item -LiteralPath "$HOME/.dsh" -Destination "$HOME/.nomix" -Recurse
```

确认复制结果后，可自行删除旧目录；Nomix 不会代为删除。

请把所有 `DSH_*` 环境变量改为 `NOMIX_*`，把 package manifest 的 `dsh` 字段改为 `nomix`，并把 Python 导入从 `deepseek_harness` 改为 `nomix_harness`。CLI 和 SDK 检测到旧环境变量或 manifest 字段时会报告对应的新名称，不会静默回退。

npm 包名为 `@nomix-ai/nomix-harness`。全部内部生产插件都编译进该包，但只有被 Profile 或业务应用显式注册时才会激活。DeepSeek 仍是可选 Provider，必须显式选择。
