import { Module } from '@nestjs/common';
import { PapersController } from './papers.controller';
import { PapersService } from './papers.service';
import { GenerationService } from './generation.service';
import { ValidationService } from './validation.service';
import { PrismaService } from '../common/prisma.service';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [PdfModule],
  controllers: [PapersController],
  providers: [PapersService, GenerationService, ValidationService, PrismaService],
})
export class PapersModule {}
