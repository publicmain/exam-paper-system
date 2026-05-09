import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface AuditEvent {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  diff?: unknown;
  metadata?: unknown;
  ip?: string | null;
}

/** Subset of Prisma transaction client we need for the audit row write.
 *  Allows callers in $transaction blocks to pass in `tx` and have the
 *  audit insert happen inside the same DB transaction. */
type TxLike = { auditLog: { create: (args: any) => Promise<any> } };

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist a structured audit row. Failures are swallowed and logged so audit
   * never blocks a primary action — but every compliance-critical caller must
   * still await this to keep the trail in order.
   *
   * Round-7: pass an optional `tx` to enrol the audit write in a $transaction
   * with the primary mutation. That's the right shape for "write succeeds OR
   * audit succeeds, never one without the other" — previously a teacher
   * approval could land in Paper but the audit row could fail silently and
   * the action would have no trail.
   */
  async log(event: AuditEvent, tx?: TxLike): Promise<void> {
    const target = tx ?? this.prisma;
    try {
      await target.auditLog.create({
        data: {
          actorId: event.actorId ?? null,
          actorRole: event.actorRole ?? null,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          diff: (event.diff ?? null) as any,
          metadata: (event.metadata ?? null) as any,
          ip: event.ip ?? null,
        },
      });
    } catch (e) {
      if (tx) {
        // Inside a transaction the failure MUST propagate — otherwise the
        // primary write commits without audit. Caller's $transaction will
        // roll back on rethrow.
        throw e;
      }
      // eslint-disable-next-line no-console
      console.error('[audit] failed to persist event', event.action, e);
    }
  }
}
