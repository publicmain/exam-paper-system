import { z } from 'zod';

export const UserRoleEnum = z.enum(['teacher', 'head_teacher', 'admin', 'student']);

export const UpdateUserSchema = z
  .object({
    role: UserRoleEnum.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.role !== undefined || d.isActive !== undefined, {
    message: 'request body must include at least one of: role, isActive',
  });
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

export const ResetPasswordSchema = z.object({
  // 8-char floor matches the auth/users CreateUserDto's @MinLength(6)+
  // we deliberately raise the bar for admin-driven resets so the new
  // password is at least as strong as a freshly-created account.
  newPassword: z.string().min(8).max(200),
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
