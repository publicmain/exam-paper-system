import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/auth.guard';
import { CreateConfigSchema, LogQuerySchema, UpdateConfigSchema } from './dto';
import { WechatNotifyService } from './wechat-notify.service';

/**
 * Notification config + log routes.
 *
 * NOTE: every config-mutating route is admin-only because a wrong
 * webhook URL would leak student data. The /logs route is admin-only
 * for the same reason: payloads contain assignmentId / studentId.
 *
 * The `/test/:configId` endpoint always logs to NotificationLog
 * (via service.testFire → service.dispatch), so even a noop:// stub
 * leaves an audit trail of the test ping.
 */
@Controller('wechat-notify')
@Roles('admin')
export class WechatNotifyController {
  constructor(private readonly notify: WechatNotifyService) {}

  @Get('configs')
  listConfigs() {
    return this.notify.listConfigs();
  }

  @Post('configs')
  createConfig(@Body() body: unknown) {
    const parsed = CreateConfigSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.notify.createConfig(parsed.data);
  }

  @Patch('configs/:id')
  updateConfig(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateConfigSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.notify.updateConfig(id, parsed.data);
  }

  @Post('test/:configId')
  testConfig(@Param('configId') configId: string) {
    return this.notify.testFire(configId);
  }

  @Get('logs')
  listLogs(
    @Query('event') event?: string,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = LogQuerySchema.safeParse({ event, since, limit });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.notify.listLogs(parsed.data);
  }
}
