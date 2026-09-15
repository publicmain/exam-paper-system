import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { EnglishLevel } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UsersService } from './users.service';
import { AuthGuard, Roles } from '../common/auth.guard';
import { UserRole } from '@prisma/client';

class CreateUserDto {
  @IsEmail() @MaxLength(320) email: string;
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  // bcrypt only consumes the first 72 bytes — bound at 256 to cap memory.
  @IsString() @MinLength(6) @MaxLength(256) password: string;
  @IsEnum(UserRole) role: UserRole;
}

class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsEmail() @MaxLength(320) email?: string;
}

@Controller('admin/users')
@UseGuards(AuthGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get() list() { return this.users.list(); }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  /** R10 followup — quick-rename a student (or change their email) from
   *  the Classes UI. Teachers correct typos in roster without leaving
   *  the class detail modal. Admin-only since it can also re-target a
   *  user's email; we don't allow changing role here on purpose. */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
    // 改到学生头上时，服务里转去 renameStudent（姓名昵称一起改、同班查重、写审计）
    return this.users.updateProfile(id, dto, { id: user?.id, role: user?.role });
  }

  /**
   * 2026-09-15 —— 老师在班级名单里改学生登录名。
   *
   * 任课老师改自己班的学生；管理员 / 班主任全校（班级归属在服务里判）。与学生在账号页自己改
   * 走同一个函数：姓名 + 昵称一起改、按新名重算注册邮箱、同一个在读班里不许重名、写审计。
   */
  @Patch(':id/student-name')
  @Roles('admin', 'head_teacher', 'teacher')
  renameStudent(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any) {
    const parsed = z.object({ name: z.string().min(1).max(50) }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'bad_rename' });
    return this.users.renameStudent({ id: user.id, role: user.role }, id, parsed.data.name);
  }

  /**
   * P4 —— 教师改学生英语难度。
   *
   * 这个 controller 整体是 @Roles('admin')，但改难度是**班主任的日常
   * 动作**（「小明这层太难了，降一档」），不该要求管理员。handler 上的
   * @Roles 覆盖 class 级（AuthGuard 用 getAllAndOverride），实际班级归属
   * 由 service 里的 canActOnClass 判定 —— 普通教师只能改自己带的班。
   *
   * level: null = 清空（退回「下次扫码现选」的状态），教师纠错用。
   */
  @Patch(':id/english-level')
  @Roles('admin', 'head_teacher', 'teacher')
  setEnglishLevel(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
  ) {
    const schema = z.object({
      level: z.nativeEnum(EnglishLevel).nullable(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.users.setEnglishLevel(
      { id: user.id, role: user.role },
      id,
      parsed.data.level,
    );
  }
}
