import { z } from 'zod';

const EventEnum = z.enum(['paper_assigned', 'paper_marked', 'low_score']);
const ChannelEnum = z.enum(['wechat_work', 'dingtalk', 'email']);

/**
 * `target` is JSON-shaped per channel. We accept any object with at
 * least one recognized field rather than a strict shape so the same
 * config row can carry channel-specific extras (e.g. mention list
 * for WeChat Work) without a schema bump.
 *
 * NOOP STUB: if target.webhookUrl starts with "noop://" the
 * dispatcher logs to NotificationLog without making an HTTP call.
 */
export const TargetSchema = z.object({
  webhookUrl: z.string().min(1).optional(),
  to: z.array(z.string().email()).optional(),
  subjectPrefix: z.string().optional(),
}).passthrough();

export const CreateConfigSchema = z.object({
  event: EventEnum,
  channel: ChannelEnum,
  target: TargetSchema,
  enabled: z.boolean().default(true),
});
export type CreateConfigDto = z.infer<typeof CreateConfigSchema>;

export const UpdateConfigSchema = z.object({
  enabled: z.boolean().optional(),
  target: TargetSchema.optional(),
}).refine((d) => d.enabled !== undefined || d.target !== undefined, {
  message: 'at least one of enabled / target must be provided',
});
export type UpdateConfigDto = z.infer<typeof UpdateConfigSchema>;

export const LogQuerySchema = z.object({
  event: EventEnum.optional(),
  // ISO-8601 timestamp lower bound. Anything more recent than `since`
  // is returned. Default = last 7 days, applied in the service.
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100).optional(),
});
export type LogQueryDto = z.infer<typeof LogQuerySchema>;
