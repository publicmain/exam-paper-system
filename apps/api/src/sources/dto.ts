import { z } from 'zod';

export const CreateSourceRepoSchema = z.object({
  url: z.string().url(),
  repoType: z.enum([
    'with_pdfs',
    'notes_only',
    'downloader_script',
    'topic_page',
    'official',
    'school_upload',
    'ai_generator',
  ]),
  examBoardHint: z.string().optional(),
  copyrightOwner: z.string().optional(),
  notesForTeachers: z.string().optional(),
  syllabusAllowlist: z.array(z.string().regex(/^\d{4}$/)).optional(),
  yearAllowlist: z.array(z.number().int().min(1990).max(2100)).optional(),
});
export type CreateSourceRepoDto = z.infer<typeof CreateSourceRepoSchema>;

export const UpdateComplianceSchema = z.object({
  complianceStatus: z.enum([
    'pending_review',
    'approved_internal',
    'restricted_internal',
    'blocked',
    'expired',
  ]),
  allowedUsage: z
    .enum(['free_use', 'internal_classroom_only', 'metadata_reference_only', 'none'])
    .optional(),
  retentionPolicy: z
    .enum(['keep_indefinite', 'delete_after_review', 'delete_when_blocked', 'school_license_term'])
    .optional(),
  copyrightOwner: z.string().optional(),
  notesForTeachers: z.string().optional(),
  reason: z.string().optional(),
});
export type UpdateComplianceDto = z.infer<typeof UpdateComplianceSchema>;

export const BlockSourceSchema = z.object({
  reason: z.string().min(3),
});
export type BlockSourceDto = z.infer<typeof BlockSourceSchema>;

export const UpdateAllowlistSchema = z.object({
  // Re-uses the same 4-digit syllabus regex as create. To extend an
  // existing repo's allowlist, send the FULL desired list (additive
  // semantics on the client side); the server replaces the column.
  syllabusAllowlist: z.array(z.string().regex(/^\d{4}$/)),
  yearAllowlist: z.array(z.number().int().min(1990).max(2100)).optional(),
});
export type UpdateAllowlistDto = z.infer<typeof UpdateAllowlistSchema>;
