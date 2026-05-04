import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';

@Module({
  controllers: [StudentController],
  providers: [PrismaService, StudentService],
  exports: [StudentService],
})
export class StudentModule {}
