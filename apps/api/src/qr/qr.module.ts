import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';

@Module({
  controllers: [QrController],
  providers: [PrismaService, QrService],
  exports: [QrService],
})
export class QrModule {}
