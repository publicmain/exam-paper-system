import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AudioController } from './audio.controller';

@Module({
  controllers: [AudioController],
  providers: [PrismaService],
})
export class AudioModule {}
