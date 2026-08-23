# Nomix Harness

English | [中文](README.zh.md)

Nomix Harness (`nomix`) is an open-source, plugin-based agent harness.

It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Developer preview

Nomix Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @nomix-ai/nomix-harness web
```

The command starts the Web UI, served at `http://127.0.0.1:3080` by default. See [Web UI guide](docs/user/guide/index.md).

Yarn projects must use the `node-modules` linker because Nomix loads registered plugins dynamically:

```yaml
nodeLinker: node-modules
```

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/ditgaldev/nomix-harness.git
cd nomix-harness
pnpm install
pnpm nomix web
```

## Community and support

- Feel free to submit feedback or bug reports through [GitHub Discussions](https://github.com/ditgaldev/nomix-harness/discussions).
- Add the [`nomix-plugin`](https://github.com/topics/nomix-plugin) topic to your plugin repository for discoverability.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
