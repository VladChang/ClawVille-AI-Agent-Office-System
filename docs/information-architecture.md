# Information Architecture

The ClawVille interface is divided into distinct pages, each with a well‑defined purpose.  This structure helps users quickly find the information or controls they need.

## Navigation

Navigation is provided via a sidebar with the following entries.  These appear on every page:

* **Overview** – summary counts and high‑level health indicators.  This page is a dashboard for at‑a‑glance monitoring.
* **Agents** – list of all agents with filters and search.  Provides quick access to agent details and operations.
* **Tasks** – list of tasks with their status, progress and responsible agents.  Includes dependency information to see where jobs are blocked.
* **Events** – chronological log of significant events.  Helps reconstruct what happened or debug issues.
* **Office** – optional immersive view that visualises agents as sprites in an office environment.  This page shares the same data as the other pages, but renders it differently.

The top of each page also includes a summary bar showing aggregated counts (e.g. number of busy agents, number of waiting tasks) and overall mood/status indicators.

## Page Breakdown

### Overview

The Overview is intended for quick status checks.  It may include:

* A count of total agents, broken down by state (working, thinking, waiting, idle, error).
* Total tasks and distribution by status (running, waiting, blocked, completed, error).
* System health score and mood indicator.
* Recent critical events or alerts.

### Agents

Displays a grid or table of all agents.  Columns might include:

* Name and role
* Status and mood
* Current task and progress
* Dependencies and collaborators
* Last event time

Selecting an agent opens a detail panel or navigates to `/agents/{id}` where more information and operations (pause, resume, retry) are available.

### Tasks

This page lists tasks and their states.  A task may show:

* Title
* Status
* Assigned agent
* Progress
* Priority
* Dependencies and dependants

Optionally, tasks can be visualised as a dependency graph or timeline to expose where the workflow is stuck.

### Events

The Events page is a time‑ordered feed of system events.  Users can filter by agent, event type, time range or severity.  Each event includes a timestamp, type and references to relevant agents or tasks.

### Office

The Office view is an alternative visualisation for the same data.  It uses a 2D map where each agent is represented by a small character.  Different rooms correspond to roles (planning room, research library, memory archive, tool workshop, review room, collaboration hub, break area).  Agent state is indicated through animations and icons.  Mood and thought summaries appear as short bubbles above the characters.  Clicking on a character shows the same detail panel used in the Agents page.

This view is optional; it should not be the default until the rest of the console is implemented and stable.
