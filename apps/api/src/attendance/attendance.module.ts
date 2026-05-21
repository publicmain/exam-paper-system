import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { QrModule } from '../qr/qr.module';
import { ShuffleModule } from '../shuffle/shuffle.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [ConfigModule, QrModule, ShuffleModule],
  controllers: [AttendanceController],
  providers: [PrismaService, AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
