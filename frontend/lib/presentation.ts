import {
  getAgentDisplayName,
  type AgentStatus,
  type EventLevel,
  type EventType,
  type TaskPriority,
  type TaskStatus
} from '../../shared/contracts';
import type { Agent } from '@/types/models';
import type { DashboardConnectionStatus } from '@/store/dashboardStore';

const agentStatusLabels: Record<AgentStatus, string> = {
  idle: '待命',
  busy: '忙碌',
  offline: '離線'
};

const taskStatusLabels: Record<TaskStatus, string> = {
  todo: '待處理',
  in_progress: '進行中',
  blocked: '阻塞',
  done: '完成'
};

const taskPriorityLabels: Record<TaskPriority, string> = {
  low: '低',
  medium: '中',
  high: '高'
};

const eventLevelLabels: Record<EventLevel, string> = {
  info: '資訊',
  warning: '警告',
  error: '錯誤'
};

const connectionStatusLabels: Record<DashboardConnectionStatus, string> = {
  idle: '閒置',
  connecting: '連線中',
  connected: '已連線',
  degraded: '降級',
  disconnected: '已斷線'
};

const eventTypeLabels: Record<string, string> = {
  task_created: '任務建立',
  task_updated: '任務更新',
  task_retried: '任務重試',
  agent_status_changed: 'Agent 狀態變更',
  agent_paused: 'Agent 已暫停',
  agent_resumed: 'Agent 已恢復',
  system: '系統'
};

export function getAgentLabel(agent: Pick<Agent, 'name'> & Partial<Pick<Agent, 'displayName'>>): string {
  return getAgentDisplayName(agent);
}

export function getAgentStatusLabel(status: AgentStatus): string {
  return agentStatusLabels[status];
}

export function getTaskStatusLabel(status: TaskStatus): string {
  return taskStatusLabels[status];
}

export function getTaskPriorityLabel(priority: TaskPriority): string {
  return taskPriorityLabels[priority];
}

export function getEventLevelLabel(level: EventLevel): string {
  return eventLevelLabels[level];
}

export function getConnectionStatusLabel(status: DashboardConnectionStatus): string {
  return connectionStatusLabels[status];
}

export function getEventTypeLabel(type: EventType): string {
  return eventTypeLabels[type] ?? type.replace(/_/g, ' ');
}

export function formatBadgeValue(value: string): string {
  if (value in agentStatusLabels) {
    return getAgentStatusLabel(value as AgentStatus);
  }

  if (value in taskStatusLabels) {
    return getTaskStatusLabel(value as TaskStatus);
  }

  if (value in eventLevelLabels) {
    return getEventLevelLabel(value as EventLevel);
  }

  return value;
}
