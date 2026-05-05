import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaperVariantsController, StudentVariantController } from './paper-variants.controller';
import { PaperVariantsService } from './paper-variants.service';

@Module({
  controllers: [PaperVariantsController, StudentVariantController],
  providers: [PrismaService, PaperVariantsService],
  exports: [PaperVariantsService],
})
export class PaperVariantsModule {}
