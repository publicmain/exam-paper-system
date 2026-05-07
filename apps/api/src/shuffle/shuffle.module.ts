import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ShuffleService } from './shuffle.service';

@Module({
  providers: [PrismaService, ShuffleService],
  exports: [ShuffleService],
})
export class ShuffleModule {}
