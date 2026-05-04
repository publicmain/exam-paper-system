import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
  controllers: [ClassesController],
  providers: [PrismaService, ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
