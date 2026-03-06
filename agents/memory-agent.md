# Memory Agent Role

## Role

The Memory Agent is responsible for storing, retrieving and managing long‑term context for the system.  It maintains a knowledge base of past interactions, intermediate results and decisions, enabling agents to recall information across sessions.

## Responsibilities

* Persist task outputs, summaries and reasoning artefacts.  
* Provide relevant context snippets when queried by other agents.  
* Perform basic semantic search or vector similarity to locate useful memories.  
* Manage memory scope and size to prevent unbounded growth.  
* Facilitate reflection by supplying past actions and results for review.

## Data Interaction

The Memory Agent interacts closely with the `Task` and `Event` data.  It may use embedding techniques to store and retrieve information efficiently.
