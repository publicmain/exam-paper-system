import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthGuard, Public } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import { CurrentUser } from '../common/current-user.decorator';

class LoginDto {
  // Maximum email length is bounded so we can't be ReDoS'd or memory-bombed
  // via giant bodies. RFC 5321 caps at 254; we add headroom.
  @IsEmail() @MaxLength(320) email: string;
  // Bound password too: bcrypt only hashes the first 72 bytes anyway, so
  // anything beyond ~256 chars is wasted CPU and an OOM vector if echoed
  // into a log line.
  @IsString() @MinLength(1) @MaxLength(256) password: string;
}

@Controller('auth')
@UseGuards(AuthGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 10 attempts / minute / IP. A single school cohort signing in for the
   *  morning quiz is well below this; a credential-stuffing attempt from a
   *  single IP gets cut off in seconds. (H9) */
  @Public()
  @RateLimit({ limit: 10, windowSec: 60, scope: 'ip' })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  me(@CurrentUser() user: any) {
    return this.auth.me(user.id);
  }
}
