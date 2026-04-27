import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  controllers: [ReviewController],
  providers: [PrismaService, ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
