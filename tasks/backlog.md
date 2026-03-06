# Task Backlog

This backlog lists granular tasks that should be tackled as the ClawVille system is developed.  It can be imported into GitHub Issues for assignment to AI or human developers.

## Foundation

1. **Set up project scaffold** – Initialise a Next.js project under `frontend/`, configure Tailwind and state management.  
2. **Define data models** – Create TypeScript interfaces representing Agent, Task and Event models.  
3. **Build layout** – Implement sidebar navigation, summary bar and main content area components.  
4. **Stub API layer** – Mock an API service that returns hard‑coded agent/task/event data.

## Pages

5. **Overview page** – Render counts of agents and tasks, display recent events.  
6. **Agents page** – List agents with status, role, current task and filter options.  
7. **Agent detail drawer** – Show full information and controls when an agent is selected.  
8. **Tasks page** – List tasks, progress, assigned agents and dependencies.  
9. **Events page** – Build a scrollable timeline of events with filters.

## Real‑time Integration

10. **Implement WebSocket client** – Connect to a mock WebSocket server and update UI state on messages.  
11. **Replace mock API** – Integrate with real OpenClaw event stream.  
12. **Implement agent controls** – Pause, resume, retry tasks via API calls.  
13. **Handle errors and alerts** – Display toast notifications or badges on errors and retries.

## Office View

14. **Design office map** – Draw or import a simple 2D layout with rooms.  
15. **Implement agent sprites** – Create components for animated characters responding to status changes.  
16. **Add mood and thought bubbles** – Compute derived mood and text for each agent and display as overlays.  
17. **Synchronise selection** – Ensure selecting an agent in the map highlights the corresponding entry in lists and vice versa.

## Analytics

18. **Compute derived metrics** – Add functions to calculate busiest agents, average wait times and error rates.  
19. **Build dependency graph view** – Visualise tasks and their dependencies as a directed graph.  
20. **Implement incident playback** – Allow users to replay sequences of events to debug workflows.

This backlog should evolve as the project matures.  Bugs, refactorings and feedback‑driven improvements should be added along the way.
