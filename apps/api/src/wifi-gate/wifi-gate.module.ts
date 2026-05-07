import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IpAllowlistGuard } from './ip-allowlist.guard';

@Module({
  imports: [ConfigModule],
  providers: [IpAllowlistGuard],
  exports: [IpAllowlistGuard],
})
export class WifiGateModule {}
