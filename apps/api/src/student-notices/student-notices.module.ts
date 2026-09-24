import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { StudentNoticesController } from './student-notices.controller';

@Module({ controllers: [StudentNoticesController], providers: [PrismaService] })
export class StudentNoticesModule {}
