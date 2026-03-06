# ClawVille - AI Agent Office System

ClawVille is a visual dashboard for OpenClaw multi-agent systems.

Instead of raw logs and queues, it presents each AI agent as a virtual office employee so you can see, at a glance:

- who is working / thinking / waiting / blocked
- what each agent is currently doing
- dependencies and collaboration patterns
- recent events and operational health signals

The office view is optional. The core of the project is a set of data models and APIs that expose agents, tasks, and events; multiple UI views (lists, graphs, office map) render the same underlying state.

## Repo contents

This repo currently focuses on specification and planning artifacts:

- `PROJECT_SPEC.md`
- `docs/` (architecture and UX notes)
- `agents/` (draft role descriptions)
- `tasks/` (roadmap + backlog)
- `frontend/` and `backend/` placeholders

## Getting started

1) Read `PROJECT_SPEC.md`

2) Skim the key docs:

- `docs/product-overview.md`
- `docs/information-architecture.md`
- `docs/data-models.md`
- `docs/office-view-spec.md`

3) See planned work items:

- `tasks/roadmap.md`
- `tasks/backlog.md`
