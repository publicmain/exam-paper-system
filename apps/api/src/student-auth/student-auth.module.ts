import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { StudentAuthController } from './student-auth.controller';
import { StudentAuthService } from './student-auth.service';

/**
 * 学生 PIN 认证（2026-08-25）。JwtModule 是全局注册的，直接注入。
 */
@Module({
  controllers: [StudentAuthController],
  providers: [PrismaService, StudentAuthService],
  exports: [StudentAuthService],
})
export class StudentAuthModule {}
