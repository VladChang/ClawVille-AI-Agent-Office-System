# Data Models

ClawVille is built around structured data describing agents, tasks and events. These models form the contract between the OpenClaw system and the dashboard.

Canonical code contract:
- Shared source of truth: `shared/contracts/index.ts`
- Backend re-export: `backend/src/models/types.ts`
- Frontend consumption: `frontend/types/models.ts`

This document explains the intent of those shapes at a product/data-model level. When there is any conflict between this document and the checked-in shared contract code, treat `shared/contracts/index.ts` as the canonical source.

UI-derived fields such as badges, severity display variants, room placement, mood, analytics aggregates, or drawer-specific summaries are presentation concerns layered on top of the shared contract.

## Agent

An agent represents a single autonomous worker in your OpenClaw deployment.

```
Agent {
  id: string,            # unique identifier
  name: string,          # human‑readable name
  role: string,          # e.g. "planner", "browser", "memory", "tool-runner"
  status: string,        # canonical contract: idle | busy | offline
  updatedAt: datetime
}
```

Additional presentation-only fields may be derived from this base model, such as `mood`, room placement, or `thought_summary`.

## Task

A task is a unit of work assigned to an agent.  Tasks may form dependency trees.

```
Task {
  id: string,
  title: string,
  description: string?,
  assigneeAgentId: string?,
  status: string,        # canonical contract: todo | in_progress | blocked | done
  priority: string,      # canonical contract: low | medium | high
  createdAt: datetime,
  updatedAt: datetime
}
```

The current shared contract is intentionally compact. More advanced dependency graphs can be layered on later, but they are not part of the canonical runtime contract today.

## Event

Events record all significant actions within the system.  They can be stored in an append‑only log.

```
Event {
  id: string,
  timestamp: datetime,
  type: string,
  message: string,
  level: string?,        # canonical shared levels: info | warning | error
  metadata: object?
}
```

The Event model remains intentionally generic. New event types can be added as needed. They underpin the Events page and help generate derived metrics such as retry rates or error counts.

## Derived Metrics

ClawVille may compute additional analytics on top of the raw models:

* **Load score** – number of tasks queued or being processed by each agent.  
* **Wait time** – time spent waiting on dependencies or external resources.  
* **Error rate** – number of errors or retries in a recent time window.  
* **Health score** – combination of load, wait and error metrics scaled to 0–100.  
* **Mood** – mapping from health score and recent behaviour to human terms like calm, busy or overwhelmed.
