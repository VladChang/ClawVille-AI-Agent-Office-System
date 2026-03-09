import {
  getAgentDisplayName,
  type AgentStatus,
  type EventLevel,
  type EventType,
  type TaskPriority,
  type TaskStatus
} from '../../shared/contracts';
import type { Agent, RuntimeStatusSnapshot } from '@/types/models';
import type { DashboardConnectionStatus } from '@/store/dashboardStore';

export const workforceLabels = {
  singular: '員工',
  list: '員工列表',
  total: '員工總數',
  active: '活躍員工',
  busiest: '最忙碌的員工',
  utilization: '員工利用率',
  searchPlaceholder: '搜尋名稱、別名或角色',
  loading: '正在載入員工資料…',
  empty: '目前沒有員工資料',
  filteredEmpty: '目前沒有符合篩選條件的員工',
  waitingForData: '等待 API / 即時快照回傳員工資料。',
  assignee: '負責員工',
  unknown: '未知員工',
  officeStatus: '這裡會用視覺化方式呈現與列表頁相同的員工狀態。點擊任何頭像可打開員工詳細面板。',
  officeHint: '提示：點擊任何頭像，會同步高亮員工列表並打開控制抽屜。',
  officeEmpty: '目前尚無員工資料',
  roomEmpty: '這個房間目前沒有員工。',
  analyticsPairing: '事件 / 員工',
  analyticsMentioned: '已播放範圍內的事件數 / 被提及的唯一員工',
  pauseError: '暫停員工失敗。',
  resumeError: '恢復員工失敗。',
  noBlockedTask: '這位員工目前沒有阻塞中的任務。',
  renameError: '更新員工顯示名稱失敗。'
} as const;

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
  agent_status_changed: '員工狀態變更',
  agent_paused: '員工已暫停',
  agent_resumed: '員工已恢復',
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

export function getRuntimeSourceLabel(status: RuntimeStatusSnapshot | null): string {
  if (!status) return '未知';

  switch (status.dataSource) {
    case 'mock':
      return '模擬資料';
    case 'openclaw_fixture':
      return 'OpenClaw 測試資料';
    case 'openclaw_upstream':
      return 'OpenClaw 上游';
    case 'openclaw_adapter_only':
      return 'Adapter 已連線';
    case 'openclaw_mock_fallback':
      return '模擬 fallback';
    case 'openclaw_strict_unconfigured':
      return '未設定';
    default:
      return '未知';
  }
}

export function getRuntimeSourceDetail(status: RuntimeStatusSnapshot | null): string | null {
  if (!status) return null;

  if (status.dataSource === 'openclaw_upstream') {
    return '已驗證真實 OpenClaw 上游';
  }

  if (status.dataSource === 'openclaw_fixture') {
    return '目前使用測試資料驗證路徑，不代表真實上游已通過';
  }

  if (status.dataSource === 'openclaw_mock_fallback') {
    return '目前退回模擬 fallback';
  }

  if (status.dataSource === 'openclaw_adapter_only') {
    return '轉接層可達，但上游尚未驗證成功';
  }

  if (status.dataSource === 'openclaw_strict_unconfigured') {
    return '尚未完成轉接層 / 上游設定';
  }

  return null;
}
