import { appendFile, mkdir } from 'node:fs/promises';
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

function maxRecords(): number {
  const parsed = Number(process.env.AUDIT_MAX_IN_MEMORY_RECORDS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1000;
}

function flushIntervalMs(): number {
  const parsed = Number(process.env.AUDIT_LOG_FLUSH_MS);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 200;
}

export class AuditTrail {
  private readonly records: AuditRecord[] = [];
  private pendingBuffer = '';
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  record(record: Omit<AuditRecord, 'at'>): void {
    const entry: AuditRecord = { ...record, at: new Date().toISOString() };
    this.records.push(entry);
    const overflow = this.records.length - maxRecords();
    if (overflow > 0) {
      this.records.splice(0, overflow);
    }

    if (!isEnabled()) return;

    this.pendingBuffer += `${JSON.stringify(entry)}\n`;
    this.scheduleFlush();
  }

  list(limit = 50): AuditRecord[] {
    if (limit <= 0) return [];
    return this.records.slice(-limit).reverse();
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flushPending();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;

    const delay = flushIntervalMs();
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushPending().catch((error) => {
        console.error('[audit-trail] failed to flush records', error);
      });
    }, delay);

    this.flushTimer.unref?.();
  }

  private async flushPending(): Promise<void> {
    const buffer = this.pendingBuffer;
    if (buffer.length === 0) {
      await this.writeChain;
      return;
    }

    this.pendingBuffer = '';
    const outPath = filePath();

    this.writeChain = this.writeChain
      .catch(() => undefined)
      .then(async () => {
        await mkdir(path.dirname(outPath), { recursive: true });
        await appendFile(outPath, buffer, 'utf8');
      });

    await this.writeChain;
  }
}

export const auditTrail = new AuditTrail();
