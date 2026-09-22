import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PrintMaterialsStudentController, PrintMaterialsTeacherController } from './print-materials.controller';
import { PrintMaterialsService } from './print-materials.service';

@Module({
  controllers: [PrintMaterialsStudentController, PrintMaterialsTeacherController],
  providers: [PrintMaterialsService, PrismaService],
})
export class PrintMaterialsModule {}
