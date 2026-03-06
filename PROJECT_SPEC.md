# ClawVille Product Specification

## 1. Vision

ClawVille is a web-based visual management interface for OpenClaw multi-agent systems.

The system represents each AI agent as a virtual employee inside a digital office environment. The goal is to make multi-agent systems easier to understand and debug, while keeping the UI emotionally legible and enjoyable to monitor.

ClawVille separates concerns into layers:

- data layer (agents, tasks, events)
- control layer (pause/resume/retry/reassign)
- observability layer (health metrics, alerts, analytics)
- experience layer (lists, graphs, optional office map)

## 2. Core Concept Mapping

| System concept | UI representation |
| --- | --- |
| Agent | Employee |
| Tool | Equipment |
| Task | Work item |
| Memory | Knowledge archive |
| Logs / Events | Work history |
| Dependencies | Collaboration links |
| Retry / error | Stress / blockage |

## 3. Primary UX

The main dashboard should provide:

- an optional RPG-style office map as a quick status view
- a list/grid of agents with filters and search
- a detail panel/drawer for a selected agent
- task visibility (handoffs, dependencies, blocked states)
- an events timeline for debugging and auditing

The UI should feel alive, but remain practical.

## 4. Views / Pages

Recommended pages:

- Overview: high-level health, counts, recent critical events
- Agents: list of agents, status/mood, current task, dependencies
- Tasks: active/completed tasks, assignment, progress, dependencies
- Events: chronological event log with filters
- Office (optional): office map visualization of the same state

## 5. Visual Language

### Office zones

Recommended first-pass zones:

- Planning Room
- Research Library
- Memory Archive
- Tool Workshop
- Review Room
- Collaboration Hub
- Break Area
- Incident Desk

### Status to behavior

| Status | Behavior |
| --- | --- |
| thinking | standing near whiteboard |
| working | at desk / typing |
| waiting | idle standing |
| collaborating | grouped near another agent |
| idle | in break area |
| blocked | exclamation indicator |
| error | warning indicator |

### Mood

Mood is derived for presentation (not core state). Suggested moods:

- calm, focused, busy, waiting, overwhelmed, frustrated, collaborating, idle

## 6. Thought Summaries

Each agent can show a short, safe thought summary derived from the current task and recent events. This must not expose full chain-of-thought.

Examples:

- "Breaking the task into smaller steps."
- "Waiting for the Browser Agent to return data."
- "Retrying after a tool error."

## 7. Data Model Requirements

Core entities are Agent, Task, and Event. See `docs/data-models.md` for the detailed schema.

Every agent should support at least:

- id, name, role
- status (working/thinking/waiting/idle/retrying/error)
- current_task, progress
- depends_on, collaborating_with
- last_event_at, health_score

Presentation-only fields may include:

- mood
- thought_summary
- zone (office placement)

## 8. Technical Requirements (Suggested)

- Frontend: Next.js + React + Tailwind CSS; light animations with Framer Motion; state via Zustand
- Data transport: WebSocket for live updates (polling fallback optional)
- Backend: service that ingests OpenClaw events, maintains state, exposes REST + WebSocket APIs

## 9. MVP Scope

Must-have:

- Agents page + agent detail drawer
- Tasks page (status + dependencies)
- Events timeline
- an office view with mock live updates (optional but desirable)
- summary bar (team health/workload)

## 10. Development Phases

1) Console skeleton with mock data
2) Real-time integration (WebSocket/event ingestion)
3) Office view implementation
4) Advanced analytics (dependency graph, error-rate trends, playback)

## 11. Success Criteria

The project succeeds if users can:

- understand what each agent is doing at a glance
- identify blocked or unhealthy agents quickly
- observe team-level workload and collaboration patterns
- use the dashboard for operations/debugging, not just for novelty
