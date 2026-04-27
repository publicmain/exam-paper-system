import { Injectable } from '@nestjs/common';
import { ComplianceStatus, AllowedUsage } from '@prisma/client';

/**
 * Centralised compliance helpers. Every Prisma query that returns content
 * derived from licensed third-party material MUST go through one of these
 * filter builders so a single change here propagates everywhere.
 */
@Injectable()
export class ComplianceService {
  /**
   * Statuses that may surface in teacher-facing queries. `blocked` and
   * `expired` are excluded at the DB layer; `pending_review` is excluded
   * from production generation but visible in admin/review tools.
   */
  readonly visibleToTeachers: ComplianceStatus[] = [
    ComplianceStatus.approved_internal,
    ComplianceStatus.restricted_internal,
  ];

  readonly generationAllowedDefault: ComplianceStatus[] = [
    ComplianceStatus.approved_internal,
    ComplianceStatus.restricted_internal,
  ];

  /**
   * Question-table filter for paper generation. Always include
   * approved_internal; include restricted_internal only when the caller
   * is acting in a licensed-context flow (e.g. teacher of a CIE-registered
   * school selecting "include past paper questions").
   */
  generationFilter(opts: { includeRestricted?: boolean } = {}) {
    const statuses: ComplianceStatus[] = [ComplianceStatus.approved_internal];
    if (opts.includeRestricted) statuses.push(ComplianceStatus.restricted_internal);

    return {
      complianceStatus: { in: statuses },
      // Defence in depth: also exclude any usage scope that should never
      // be rendered as full content.
      allowedUsage: { in: [AllowedUsage.free_use, AllowedUsage.internal_classroom_only] },
    };
  }

  /**
   * Returns true if the resolved repo+file combo allows the worker to
   * actually clone and persist raw PDFs. Repos that are still pending or
   * blocked must never be cloned.
   */
  canSyncRepo(complianceStatus: ComplianceStatus): boolean {
    return (
      complianceStatus === ComplianceStatus.approved_internal ||
      complianceStatus === ComplianceStatus.restricted_internal
    );
  }
}
