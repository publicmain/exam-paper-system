import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PrintMaterialsStudentController, PrintMaterialsTeacherController } from './print-materials.controller';
import { PrintMaterialsService } from './print-materials.service';
import { DictationService } from './dictation.service';
import { DictationController } from './dictation.controller';

@Module({
  controllers: [PrintMaterialsStudentController, PrintMaterialsTeacherController, DictationController],
  providers: [PrintMaterialsService, DictationService, PrismaService],
})
export class PrintMaterialsModule {}
