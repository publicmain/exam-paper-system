import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WifiGateModule } from '../wifi-gate/wifi-gate.module';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';

@Module({
  imports: [WifiGateModule],
  controllers: [QrController],
  providers: [PrismaService, QrService],
  exports: [QrService],
})
export class QrModule {}
