import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Agent, Event, Task } from '../models/types';

export interface TaskTransitionRecord {
  taskId: string;
  from: string;
  to: string;
  at: string;
}

export interface AgentStatusRecord {
  agentId: string;
  from: string;
  to: string;
  at: string;
}

export interface PersistedRuntimeData {
  version: 1;
  snapshot: {
    agents: Agent[];
    tasks: Task[];
    events: Event[];
  };
  history: {
    taskTransitions: TaskTransitionRecord[];
    agentStatusChanges: AgentStatusRecord[];
  };
}

export class JsonFilePersistence {
  constructor(private readonly filePath: string) {}

  load(): PersistedRuntimeData | null {
    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw) as PersistedRuntimeData;
      if (data?.version !== 1) return null;
      if (!Array.isArray(data.snapshot?.agents) || !Array.isArray(data.snapshot?.tasks) || !Array.isArray(data.snapshot?.events)) {
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  save(data: PersistedRuntimeData): void {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    renameSync(tmpPath, this.filePath);
  }
}
