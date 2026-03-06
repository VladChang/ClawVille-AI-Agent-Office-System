# ClawVille Product Specification

## 1. Vision

ClawVille is a web-based visual management interface for OpenClaw multi-agent systems.

The system represents each AI agent as a virtual employee inside a digital office environment. The user can monitor agent activity, task distribution, collaboration status, and debugging information through an RPG-inspired dashboard.

The goal is to make multi-agent systems:

- easier to understand
- easier to debug
- more emotionally legible
- more enjoyable to monitor

## 2. Core Concept

| System Concept | UI Representation |
| --- | --- |
| Agent | Employee |
| Tool | Equipment |
| Task | Work item |
| Memory | Knowledge archive |
| Logs | Work history |
| Dependencies | Collaboration links |
| Retry / error | Stress / blockage |

## 3. Primary UX Concept

The user opens the main dashboard and sees:

- an RPG-style office map in the center
- all agents as “employees” in the office
- a sidebar listing compact employee cards
- a detail panel for the selected employee
- a summary bar showing team health and workload

The UI should feel alive, but remain practical.

## 4. Main Pages

### Office
Primary page.

Includes:
- office map
- employee cards sidebar
- selected employee detail panel
- team summary bar

### Agents
A full list/grid of all agents.

Includes:
- role filters
- status filters
- search
- workload comparison

### Tasks
A task management and flow page.

Includes:
- task list
- assignment status
- owner agent
- task progress
- blocked states

### Collaboration
A graph page showing agent relationships.

Includes:
- dependency lines
- waiting states
- collaboration groups
- bottlenecks

### Logs
Engineering/debug page.

Includes:
- system logs
- tool logs
- errors
- retries
- event timeline

### Settings
Optional future page.

Includes:
- theme options
- bubble visibility
- animation speed
- office style
- compact vs cute view

## 5. Visual Language

### Office map zones
Recommended first-pass zones:

- Planning Room
- Research Library
- Memory Archive
- Tool Workshop
- Review Room
- Collaboration Hub
- Break Area
- Incident Desk

### Agent behavior mapping

| Status | Behavior |
| --- | --- |
| thinking | standing near whiteboard |
| working | at desk / typing |
| waiting | idle standing |
| collaborating | grouped near another agent |
| idle | in break area |
| blocked | exclamation indicator |
| error | red flash / warning icon |

### Mood mapping

| Mood | Meaning |
| --- | --- |
| calm | stable and healthy |
| focused | thinking deeply |
| busy | actively executing |
| waiting | paused for dependency |
| overwhelmed | high load |
| frustrated | repeated failures / retries |
| collaborating | active teamwork |
| idle | no assigned work |

## 6. Thought Summaries

Each agent can show a short, safe thought summary.

Examples:
- “I’m breaking the task into smaller steps.”
- “Waiting for Browser Agent to return data.”
- “This result looks unreliable, I want to verify it.”
- “Retrying the tool call.”

Important:
- this is not full chain-of-thought
- it is a short operational summary
- it should be generated from current task + recent events

## 7. Technical Requirements

### Frontend
- Next.js
- React
- Tailwind CSS
- Framer Motion
- Zustand for local state

### Data transport
- WebSocket for live updates
- fallback polling optional

### Data flow
1. OpenClaw emits agent state events
2. frontend receives updates
3. UI store updates selected agent / list / map positions
4. office page renders current state

## 8. Data Model Requirements

Every agent should support at least:

- id
- name
- role
- avatar
- status
- mood
- current_task
- progress
- thought_summary
- depends_on
- collaborating_with
- last_action
- last_action_time
- health_score
- zone

## 9. MVP Scope

### Must-have
- Office page
- summary bar
- sidebar employee cards
- office map
- selected employee detail panel
- mock live updates

### Nice-to-have later
- tasks page
- collaboration graph
- log console
- avatar customization
- office theme system

## 10. Development Approach

Suggested sequence:

1. create product docs
2. build static UI shell
3. create mock data and simulated updates
4. connect live state feed from OpenClaw
5. add more pages and debugging tools

## 11. Success Criteria

The project succeeds if the user can:

- understand what each agent is doing at a glance
- identify blocked or unhealthy agents quickly
- observe team-level workload and collaboration
- enjoy using the dashboard instead of avoiding it
