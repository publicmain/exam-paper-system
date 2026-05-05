import { z } from 'zod';

// Levels we support across the system. Kept loose (string + enum) so a school
// can extend without a schema migration.
const LEVEL_VALUES = ['A_LEVEL', 'AS_LEVEL', 'IGCSE', 'O_LEVEL'] as const;

export const CreateExamBoardSchema = z.object({
  code: z.string().min(2).max(20).regex(/^[A-Z0-9_-]+$/),
  name: z.string().min(2).max(120),
});
export type CreateExamBoardDto = z.infer<typeof CreateExamBoardSchema>;

export const CreateSubjectSchema = z.object({
  examBoardId: z.string().min(1),
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  level: z.enum(LEVEL_VALUES),
});
export type CreateSubjectDto = z.infer<typeof CreateSubjectSchema>;

export const CreateComponentSchema = z.object({
  subjectId: z.string().min(1),
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
});
export type CreateComponentDto = z.infer<typeof CreateComponentSchema>;

export const CreateTopicSchema = z.object({
  componentId: z.string().min(1),
  parentTopicId: z.string().nullable().optional(),
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});
export type CreateTopicDto = z.infer<typeof CreateTopicSchema>;

export const UpdateTopicSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    code: z.string().min(1).max(60).optional(),
    parentTopicId: z.string().nullable().optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateTopicDto = z.infer<typeof UpdateTopicSchema>;

// Fix #15: PATCH/DELETE for boards / subjects / components.
export const UpdateExamBoardSchema = z
  .object({
    code: z.string().min(2).max(20).regex(/^[A-Z0-9_-]+$/).optional(),
    name: z.string().min(2).max(120).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateExamBoardDto = z.infer<typeof UpdateExamBoardSchema>;

export const UpdateSubjectSchema = z
  .object({
    code: z.string().min(1).max(40).optional(),
    name: z.string().min(1).max(120).optional(),
    level: z.enum(LEVEL_VALUES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateSubjectDto = z.infer<typeof UpdateSubjectSchema>;

export const UpdateComponentSchema = z
  .object({
    code: z.string().min(1).max(40).optional(),
    name: z.string().min(1).max(120).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateComponentDto = z.infer<typeof UpdateComponentSchema>;

// Bulk-import schema — mirrors the runtime shape of syllabi/topics-9709.ts so a
// migration from code-defined to DB-defined is a literal JSON paste.
const TopicNodeSchema: z.ZodType<TopicNode> = z.lazy(() =>
  z.object({
    code: z.string().min(1).max(60),
    name: z.string().min(1).max(200),
    sortOrder: z.number().int().min(0).max(10000).optional(),
    children: z.array(TopicNodeSchema).optional(),
  }),
);
export interface TopicNode {
  code: string;
  name: string;
  sortOrder?: number;
  children?: TopicNode[];
}

export const ImportComponentSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  topics: z.array(TopicNodeSchema).default([]),
});
export type ImportComponent = z.infer<typeof ImportComponentSchema>;

export const ImportSyllabusSchema = z.object({
  boardCode: z.string().min(2).max(20),
  // boardName is used only when the board doesn't already exist (upsert by code)
  boardName: z.string().min(2).max(120).optional(),
  subjectCode: z.string().min(1).max(40),
  subjectName: z.string().min(1).max(120),
  level: z.enum(LEVEL_VALUES),
  components: z.array(ImportComponentSchema).min(1).max(50),
});
export type ImportSyllabusDto = z.infer<typeof ImportSyllabusSchema>;
