import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WechatNotifyController } from './wechat-notify.controller';
import { WechatNotifyService } from './wechat-notify.service';

@Module({
  controllers: [WechatNotifyController],
  providers: [PrismaService, WechatNotifyService],
  // Exported so other modules (StudentService, MarkerService) can
  // import WechatNotifyService and call .fire() at integration time.
  exports: [WechatNotifyService],
})
export class WechatNotifyModule {}
