import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.updateProfile(id, dto);
  }
}
