import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ClassifierController } from './classifier.controller';
import { RuleClassifierService } from './rule-classifier.service';

@Module({
  controllers: [ClassifierController],
  providers: [PrismaService, RuleClassifierService],
  exports: [RuleClassifierService],
})
export class ClassifierModule {}
