import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
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
}
