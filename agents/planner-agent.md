# Planner Agent Role

## Role

The Planner Agent acts as the coordinator for a user request.  It analyses the initial request, decomposes it into subtasks, assigns those tasks to specialised agents and monitors their completion.  It keeps track of dependencies and decides when to retry or reassign work.

## Responsibilities

* Interpret high‑level user requests and break them down into discrete tasks.  
* Prioritise tasks based on urgency and dependencies.  
* Assign tasks to appropriate agents (Browser, Memory, Tool Runner, Reviewer, etc.).  
* Monitor task progress and handle blocked tasks (e.g. reassign or retry).  
* Communicate status back to the user or higher‑level orchestration.

## Data Fields

See the core Agent model in `docs/data-models.md`.  The Planner Agent may populate `depends_on` when waiting for other agents to return results.
