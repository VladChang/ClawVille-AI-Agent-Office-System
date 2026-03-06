# Office View Specification

The office view is an optional, human‑friendly representation of agent state.  It should be built only after the underlying data and console views are stable.

## Purpose

* Provide a quick, intuitive snapshot of what agents are doing.
* Serve as an engagement layer for non‑technical stakeholders.
* Complement, not replace, the standard console views.

## Layout

The office view consists of a static 2D map divided into rooms.  Each room corresponds to an agent role:

| Room            | Role                                               |
|-----------------|----------------------------------------------------|
| Planning Room   | Planner/Coordinator agents                         |
| Research Library| Browser/Research agents                            |
| Memory Archive  | Memory/Knowledge agents                            |
| Tool Workshop   | Tool Runner/Execution agents                       |
| Review Room     | Reviewer/Critic agents                             |
| Collaboration Hub| Locations where agents meet or exchange results    |
| Break Area      | Idle agents                                        |
| Incident Desk   | Agents handling errors or blocked tasks            |

Agents are drawn as small characters (“sprites”) placed within these rooms.  Their status is indicated via animation, colour or icons.  For example:

* **Thinking** – standing at a whiteboard with a thought bubble.
* **Working** – sitting at a desk typing.
* **Waiting** – standing idle with a small clock icon.
* **Retrying** – exhibiting a looping animation (e.g. shaking head).
* **Error** – flashing red or showing an exclamation mark.
* **Idle** – moving slowly in the break area.

## Mood & Thought Bubbles

A short mood icon (😌, 🤔, 😰, 😤, 🤝, 😴) sits above each agent to convey their operational state.  A text bubble shows a one‑sentence summary of what the agent is doing or waiting for.  These summaries are generated from the agent’s latest event or task and are purely informational; they should not reveal internal chain of thought.

Example thought summaries:

* “Collecting data from external sources.”
* “Waiting for Tool Runner to finish.”
* “Retrying after an API error.”
* “Idle until a new task arrives.”

## Interaction

* Hovering over a character reveals a tooltip with the agent’s name and status.
* Clicking on a character opens the same detail panel used elsewhere in the console (via a drawer or modal) showing full agent information and controls.
* The view should update in real time as agent states change.  For example, a character may move from the planning room to the research library when a task switches.

## Limitations

The office view is not intended to provide deep debugging information.  It does not show logs, tool calls or detailed dependency graphs.  It should therefore always be accompanied by the other console pages.  If performance becomes an issue, the animation frame rate can be reduced or simplified.
