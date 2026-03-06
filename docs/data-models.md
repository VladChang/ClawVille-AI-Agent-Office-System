# Data Models

ClawVille is built around structured data describing agents, tasks and events.  These models form the contract between the OpenClaw system and the dashboard.  They are language‑agnostic; any backend can implement them as JSON, database schemas or object classes.

## Agent

An agent represents a single autonomous worker in your OpenClaw deployment.

```
Agent {
  id: string,            # unique identifier
  name: string,          # human‑readable name
  role: string,          # e.g. "planner", "browser", "memory", "tool-runner"
  status: string,        # one of: working, thinking, waiting, idle, retrying, error
  current_task: string?, # ID of currently assigned task
  progress: number?,     # 0.0 – 1.0 approximate progress of current task
  depends_on: string[],  # IDs of agents being awaited
  collaborating_with: string[], # IDs of agents working together
  last_event_at: datetime,
  health_score: number    # 0 – 100 reliability metric
}
```

Additional presentation‑only fields may be derived from this base model, such as `mood` (calculated from error and retry counts) and `thought_summary` (a short string extracted from the latest reasoning).

## Task

A task is a unit of work assigned to an agent.  Tasks may form dependency trees.

```
Task {
  id: string,
  title: string,
  status: string,        # running, waiting, blocked, completed, error
  assigned_agent: string,
  priority: number?,
  dependencies: string[],
  created_at: datetime,
  updated_at: datetime
}
```

Tasks may reference other tasks via `dependencies`.  The dashboard can infer blocked tasks when their dependencies are unresolved.

## Event

Events record all significant actions within the system.  They can be stored in an append‑only log.

```
Event {
  id: string,
  timestamp: datetime,
  type: string,          # e.g. "agent.started_task", "tool.call_failed", "retry.initiated"
  agent_id: string?,     # optional reference
  task_id: string?,      # optional reference
  description: string
}
```

The Event model is intentionally generic.  New event types can be added as needed.  They underpin the Events page and help generate derived metrics such as retry rates or error counts.

## Derived Metrics

ClawVille may compute additional analytics on top of the raw models:

* **Load score** – number of tasks queued or being processed by each agent.  
* **Wait time** – time spent waiting on dependencies or external resources.  
* **Error rate** – number of errors or retries in a recent time window.  
* **Health score** – combination of load, wait and error metrics scaled to 0–100.  
* **Mood** – mapping from health score and recent behaviour to human terms like calm, busy or overwhelmed.
