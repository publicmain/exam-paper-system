import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WritingCheckController } from './writing-check.controller';
import { WritingCheckService } from './writing-check.service';

/** 写作自查（LanguageTool）。没配 LANGUAGETOOL_URL 时整个功能自动关闭。 */
@Module({
  controllers: [WritingCheckController],
  // StudentIdentityGuard 要 JwtService（全局 JwtModule 给）+ Reflector + PrismaService。
  // 少了 PrismaService 整个 API 起不来 —— 2026-09-09 就是这样把生产打成 502 的。
  providers: [PrismaService, WritingCheckService],
})
export class WritingCheckModule {}
