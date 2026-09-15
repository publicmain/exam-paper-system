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

/**
 * 新建教职工账号（2026-09-15）。学生在学生端自助注册，不从后台建 —— 所以角色里没有 student。
 * 邮箱的去空白 / 转小写在服务里做（教职工登录按邮箱原样比对，存进去的就是登录要填的写法）。
 */
export const CreateUserSchema = z
  .object({
    email: z.string().min(3).max(200),
    name: z.string().min(1).max(80),
    role: z.enum(['teacher', 'head_teacher', 'admin']),
    password: z.string().min(8).max(200),
  })
  .strict();
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
