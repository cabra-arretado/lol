<p align="center">
  <img alt="lol" src="assets/bb-logo.png" width="128">
</p>

# lol

lol is a personal, local-first developer workspace: Markdown notes, a task
board, a code editor, Git worktrees, and AI coding agents in one desktop app.
It is a fork of [get-bb/bb](https://github.com/get-bb/bb), kept close to
upstream so security fixes stay easy to merge.

Your notes, tasks, repositories, and conversations stay on your computer. Each
agent provider (Claude Code, Codex, Kiro) is optional and uses the CLI you
already have authenticated.

## How lol differs from bb

- **No bb cloud.** A build-time capability policy denies bb account, bb
  Connect, bb Cloud AI, telemetry, automatic updates, and remote hosts. It
  fails closed in the backend and cannot be re-enabled by a setting or
  environment variable. Run `bb capabilities` to list it.
- **Egress guard.** The server and host daemon refuse outbound connections that
  are not to loopback, and only listen on loopback. Provider CLIs, `git`, and
  `gh` are child processes and keep their own network access.
- **Own identity.** The app is `lol` (`dev.lol.desktop`) with its own logo and
  stores its data in `~/.lol`, so it does not touch a normal bb installation.
- **Opt-in marketplace.** The plugin marketplace is off by default and only
  contacted when you turn it on and refresh or install. Bundled plugins work
  offline, and Docs and Tasks are installed on first start.
- **Todos.** Tasks can hold todos as real entities, with card progress and a
  Todos view (`bb tasks todo` in the CLI).
- **Vim mode.** The Monaco editor has an opt-in `vimMode` setting.
- **Kiro.** Kiro CLI is available as an ACP provider.

See [Personal edition](docs/configuration.md#personal-edition) for exact
behavior, and [GOAL.md](GOAL.md) for the roadmap.

## Run from source

Requires Node, and pnpm via corepack (see `packageManager` in `package.json`).

```bash
pnpm install
pnpm dev                                  # app, server and host daemon
pnpm exec turbo run dev --filter=@bb/desktop   # Electron shell, second terminal
pnpm desktop                              # packaged-mode desktop app
```

`pnpm dev` keeps data under `~/.lol-dev/`. Do not run `desktop:build`; it
publishes to the upstream release feed. To package locally without
publishing, use `pnpm exec turbo run package --filter=@bb/desktop`.

More: [Repository overview](docs/repository-overview.md),
[System overview](docs/system-overview.md),
[Configuration](docs/configuration.md), [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. lol is based on bb, Copyright (c) 2026 Michael Yong; see
[LICENSE](LICENSE).
