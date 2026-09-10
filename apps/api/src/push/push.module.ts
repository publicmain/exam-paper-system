import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PushController } from './push.controller';
import { PushReminderCron } from './push-reminder.cron';
import { PushService } from './push.service';

@Module({
  controllers: [PushController],
  // StudentIdentityGuard 要 JwtService（全局 JwtModule 给）+ Reflector + PrismaService。
  // 少了 PrismaService 整个 API 起不来 —— 2026-09-09 WritingCheckModule 就是这样
  // 把生产打成 502 的。
  providers: [PrismaService, PushService, PushReminderCron],
  exports: [PushService],
})
export class PushModule {}
