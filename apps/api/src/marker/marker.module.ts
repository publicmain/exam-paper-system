import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MarkerController } from './marker.controller';
import { MarkerService } from './marker.service';
import { VocabModule } from '../vocab/vocab.module';

@Module({
  imports: [VocabModule],
  controllers: [MarkerController],
  providers: [PrismaService, MarkerService],
  exports: [MarkerService],
})
export class MarkerModule {}
