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

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist a structured audit row. Failures are swallowed and logged so audit
   * never blocks a primary action — but every compliance-critical caller must
   * still await this to keep the trail in order.
   */
  async log(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
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
      // eslint-disable-next-line no-console
      console.error('[audit] failed to persist event', event.action, e);
    }
  }
}
