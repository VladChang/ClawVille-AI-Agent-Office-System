import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export interface AuditRecord {
  at: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: 'agent' | 'task' | 'system';
  targetId?: string;
  result: 'success' | 'failure';
  reason?: string;
}

function isEnabled(): boolean {
  return process.env.AUDIT_LOG_ENABLED === '1' || process.env.AUDIT_LOG_ENABLED === 'true';
}

function filePath(): string {
  return process.env.AUDIT_LOG_FILE?.trim() || '.data/audit-log.jsonl';
}

class AuditTrail {
  private readonly records: AuditRecord[] = [];

  record(record: Omit<AuditRecord, 'at'>): void {
    const entry: AuditRecord = { ...record, at: new Date().toISOString() };
    this.records.push(entry);

    if (!isEnabled()) return;

    const outPath = filePath();
    mkdirSync(path.dirname(outPath), { recursive: true });
    appendFileSync(outPath, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  list(limit = 50): AuditRecord[] {
    if (limit <= 0) return [];
    return this.records.slice(-limit).reverse();
  }
}

export const auditTrail = new AuditTrail();
