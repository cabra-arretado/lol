# 🚀 Project Plan — Personal Developer Workspace
**Version 0.1 · Based on [get-bb/bb](https://github.com/get-bb/bb)**

The goal is to transform bb into a **local-first developer workspace combining Obsidian, VS Code, Jira, and AI coding agents**.

My recommendation is to **get a secure, functional fork running before redesigning the UI**. bb already has much of the functionality we need, and preserving that foundation will save substantial development effort.

## 1. Product definition

### Core functionality

| Area | Features |
|---|---|
| 📝 Notes | Local Markdown vaults, editing, search, backlinks |
| 📋 Tasks | Kanban board, subtasks, priorities, agent assignments |
| 💻 IDE | File explorer, Monaco editor, integrated terminal |
| 🤖 Agents | Codex, Claude Code, Kiro, GitHub Copilot |
| 💬 Conversations | Persistent chats with multiple agents |
| 🌳 Git | Worktrees, branches, diffs, change review |
| 👥 Orchestration | Spawn agents, track subagents, manage parallel work |
| 🔗 Integration | Connect notes, tasks, repositories, and agent threads |

### Architectural principles

**Local-first:** Notes, tasks, repositories, conversations, and application state remain on the computer.

**Optional AI providers:** Each provider is independently enabled and authenticated.

**No bb cloud dependency:** No bb account, telemetry, cloud AI, remote-access tunnels, or marketplace requirements.

**Audited plugins:** Only explicitly approved plugins can be loaded.

**Maintainability:** Preserve upstream architecture where possible, making future security fixes easier to incorporate.

A local HTTP/WebSocket connection between bb's own processes is acceptable. External network communication should be limited to explicitly authorized operations, primarily the AI provider CLIs.

---

## 2. Development roadmap

I'd divide development into six milestones.

| Milestone | Objective | Deliverable |
|---|---|---|
| **M0 — Foundation** | Fork, build, and understand bb | Working development environment |
| **M1 — Local-only core** | Remove or disable unnecessary cloud/network capabilities | Hardened local application |
| **M2 — AI providers** | Configure optional providers | Claude, Codex, Kiro, Copilot support |
| **M3 — Knowledge & tasks** | Integrate notes, Kanban, and repositories | Functional developer workspace |
| **M4 — Unified interface** | Create the Obsidian + VS Code experience | Custom workspace UI |
| **M5 — Security & release** | Test, audit, and package | Personal macOS application |

### M0 — Foundation

**Objective:** Produce a clean, reproducible fork before changing its architecture.

The agent should first:

- Record the upstream commit SHA and verify the MIT license requirements.
- Install dependencies and run the existing tests.
- Build the Electron app on macOS.
- Verify that agent chat, file browsing, diffs, and worktrees function.
- Document the relevant package and plugin dependencies.
- Configure a separate application identity and data directory, so the fork cannot overwrite a normal bb installation.

bb currently uses a TypeScript monorepo with Electron, React, a local server, a host daemon, and a separate agent runtime. Its README documents `pnpm dev` and the Electron development workflow. [GitHub](https://github.com/get-bb/bb)

**Acceptance:** The unmodified fork starts locally, passes its baseline checks, and can open a test repository.

### M1 — Local-only core

**Objective:** Remove unwanted network-facing functionality without breaking agent execution.

Remove or permanently disable:

| Component | Target |
|---|---|
| bb Account | Remove |
| bb Connect | Remove |
| bb Cloud AI | Remove |
| Telemetry | Remove |
| Marketplace fetching | Remove |
| Automatic updates | Remove |
| Remote host enrollment | Remove |
| Mobile and hosted web applications | Exclude from build |
| Network-accessible server modes | Disable |
| Third-party plugin installation | Restrict to audited plugins |

**Implementation approach:** Start with a central security/capability policy. Make unsupported functionality fail closed at the backend, then remove the associated UI, routes, services, and unused packages.

Don't immediately delete directories: some remote functionality is referenced by core startup and Electron code.

**Acceptance:** With no provider running, ordinary application use makes no unapproved outbound connections. The local server cannot be configured to listen on external interfaces. All necessary IDE functionality still works.

### M2 — Optional AI providers

**Objective:** Support four providers independently.

| Provider | Protocol | Default |
|---|---|---|
| OpenAI Codex | Native App Server integration | Disabled until configured |
| Claude Code | Native Claude Code integration | Disabled until configured |
| Kiro | ACP | Disabled until configured |
| GitHub Copilot | ACP | Disabled until configured |

Reuse bb's existing provider plugins, including its native Codex/Claude bridges and configurable ACP adapter.

The application should detect provider availability, reuse existing CLI authentication, allow per-project provider selection, and report provider errors without attempting automatic fallback to another service.

Subagent execution must remain visible through bb's existing thread hierarchy.

**Acceptance:** Each configured provider can open a thread, stream responses, perform authorized file changes, and display its changes for review.

### M3 — Knowledge base and task management

**Objective:** Connect the existing Docs and Tasks functionality to coding workflows.

The initial implementation should reuse bb's Markdown vaults and Tasks board.

Then introduce relationships such as:

```text
Project
  ├── Repository
  ├── Notes
  ├── Tasks
  │    └── Assigned agent thread
  └── Agent sessions
       ├── Subagents
       └── Git worktrees
```

A task should be able to reference notes, identify its target repository, spawn an agent, and retain links to the resulting conversation and diff.

Keep Markdown files on disk and store relationships in SQLite rather than introducing an unnecessary synchronization service.

**Acceptance:** Create a task, attach a Markdown note, launch an agent in a selected repository, review its changes, and complete the task.

### M4 — Unified workspace UI

**Objective:** Replace disconnected screens with a cohesive desktop experience.

Proposed layout:

```text
┌─────────────────────────────────────────────────────────┐
│ Workspace             Project: My App          ⚙️       │
├────────────┬───────────────────────────┬────────────────┤
│ EXPLORER   │                           │ AGENT ACTIVITY │
│            │                           │                │
│ 📁 Projects│     Main Workspace        │ 🤖 Codex       │
│ 📝 Notes   │                           │   Working...   │
│ 📋 Board   │     Markdown Editor       │   └─ Subagent  │
│ 🌳 Git     │            or             │                │
│ 🤖 Agents  │     Kanban Board          │ 🤖 Claude      │
│            │            or             │   Idle         │
│            │     Code Editor           │                │
├────────────┴───────────────────────────┴────────────────┤
│ Terminal / Agent Chat / Diffs / Problems               │
└─────────────────────────────────────────────────────────┘
```

Preserve existing working views wherever practical. Add cross-navigation and workspace relationships first, then customize layout.

**Acceptance:** Notes, tasks, repositories, conversations, and diffs can be accessed within one coherent workspace.

### M5 — Security testing and packaging

Before calling the personal edition stable, verify:

- No unauthorized background network communication.
- No remote server exposure.
- Only approved plugins load.
- No unexpected provider fallback.
- No external content is loaded silently by Markdown previews, embedded HTML, or Electron views.
- Agent subprocesses and network permissions are documented.
- Local storage and logs are inspected for sensitive data.
- Reproducible macOS release build.

Network testing must cover child processes, not just Electron and the main Node.js process. An agent running `curl`, Git, or another tool can make external requests independently.

---

## 3. First agent assignment — ready to copy

I would **give your agent only M0 and the preparatory part of M1 first**. Don't ask it to implement the whole roadmap in one pass.

The first deliverable should establish a working baseline and a reviewed removal plan.

### Agent kickoff prompt

```text
You are working on a personal fork of:
https://github.com/get-bb/bb

PROJECT GOAL
Build a local-first desktop developer workspace combining
Markdown notes, a Kanban task board, code editing, Git
worktrees, and multiple AI coding agents.

The personal edition will support optional providers:
- Codex (native App Server)
- Claude Code (native integration)
- Kiro (ACP)
- GitHub Copilot (ACP)

It must not depend on bb's cloud services.

CURRENT ASSIGNMENT: M0 + M1 PREPARATION

1. Inspect the repository architecture.
2. Record the exact upstream commit.
3. Install dependencies using the repository's pinned
   package manager and lockfile.
4. Run existing typechecks, tests, and builds.
5. Verify the Electron development application starts.
6. Identify all components related to:
   - bb account
   - bb Connect
   - bb Cloud AI
   - telemetry
   - remote machines
   - mobile/cloud applications
   - plugin marketplace
   - automatic updates
   - external network communication
7. Identify dependencies between these components
   and the local application.
8. Produce a proposed removal and hardening plan.
9. Create a dedicated capability-policy design that
   will eventually enforce local-only operation.

CONSTRAINTS
- Do not redesign the UI yet.
- Do not remove the agent runtime.
- Do not break local HTTP/WebSocket communication.
- Do not remove the plugin SDK.
- Preserve Docs, Tasks, Monaco, Git, and agent threads.
- Do not introduce new cloud services.
- Do not authenticate to third-party accounts.
- Do not push commits or publish releases.
- Do not delete major components without documenting
  their dependencies and replacements.
- Keep changes small and testable.
- Preserve upstream license notices.

DELIVERABLES
- Working baseline application
- Architecture/dependency summary
- Network egress inventory
- Feature removal matrix
- Proposed security policy
- Ordered implementation plan for M1
- Test results and known issues

SUCCESS CRITERIA
The fork can build and run locally.
Existing functionality remains intact.
The next security-hardening changes are clearly scoped.

Stop after these deliverables and report findings before
starting broad deletions or UI changes.
```

---

## 4. What I would prioritize after that

The most valuable early release isn't a beautifully redesigned IDE. It's a fork that can **reliably coordinate multiple agents while storing everything locally**.

Once that works, notes and task integration should come next. The visual redesign can follow.

This approach also leaves room for a future company edition, without forcing us to build or maintain two editions right now.

### Source references

The most useful upstream documentation for your agent is:

[Repository overview](https://github.com/get-bb/bb/blob/main/docs/repository-overview.md) · [System architecture](https://github.com/get-bb/bb/blob/main/docs/system-overview.md) · [Configuration](https://github.com/get-bb/bb/blob/main/docs/configuration.md) · [Plugin SDK](https://github.com/get-bb/bb/tree/main/packages/plugin-sdk)

**Next step:** Fork bb, give the agent the kickoff prompt above, and use its M0 findings to define the actual code changes for M1. This keeps the security work evidence-based rather than removing components blindly.