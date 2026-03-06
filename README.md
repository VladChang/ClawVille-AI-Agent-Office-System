# ClawVille — AI Agent Office System

ClawVille is a visual dashboard for OpenClaw multi-agent systems.

It turns AI agents into virtual office employees inside a web UI, so you can see:

- who is working
- who is thinking
- who is waiting
- who is blocked
- who is collaborating with whom
- what each agent is currently doing
- each agent's mood and short thought summary

## Core idea

Instead of a cold system dashboard, ClawVille presents your agents as a living AI office.

- **Office page**: RPG-style office map
- **Agent sidebar**: compact employee cards
- **Detail panel**: selected agent details
- **Tasks page**: workflow and task handoff visibility
- **Collaboration page**: dependency and interaction graph
- **Logs page**: engineering/debug mode

## Product goals

1. Make multi-agent orchestration easier to understand.
2. Make agent status monitoring more intuitive.
3. Give OpenClaw a playful but useful “AI employee office” experience.
4. Keep the system practical for debugging and operations.

## Recommended stack

- Next.js
- React
- Tailwind CSS
- Framer Motion
- Zustand
- WebSocket

## Repo structure

```text
.
├── README.md
├── PROJECT_SPEC.md
├── docs/
│   ├── architecture.md
│   ├── ui_blueprint.md
│   ├── agent_data_model.md
│   └── development_plan.md
├── agents/
│   ├── planner-agent.md
│   ├── frontend-agent.md
│   ├── backend-agent.md
│   └── reviewer-agent.md
├── tasks/
│   ├── roadmap.md
│   └── backlog.md
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── postcss.config.js
│   ├── tailwind.config.ts
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── AgentCard.tsx
│   │   ├── AgentDetailPanel.tsx
│   │   ├── OfficeMap.tsx
│   │   └── SummaryBar.tsx
│   └── lib/
│       └── mock-data.ts
└── .github/
    └── workflows/
        └── ci.yml
```

## Getting started

### 1. Review the product spec
Read `PROJECT_SPEC.md` and `docs/ui_blueprint.md` first.

### 2. Start the frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Let OpenClaw agents work from this repo
Suggested workflow:

- Planner Agent reads `PROJECT_SPEC.md`
- Frontend Agent implements UI based on `docs/ui_blueprint.md`
- Backend Agent creates state and WebSocket APIs
- Reviewer Agent checks implementation quality

## Current status

This repo currently contains:

- project specification
- UI blueprint
- agent role instructions
- roadmap and backlog
- a minimal Next.js frontend starter

## Future phases

- real OpenClaw WebSocket integration
- multi-page navigation
- collaboration graph
- task graph
- operations / logs panel
- office themes and avatar system
