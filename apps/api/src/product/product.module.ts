import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ProductController } from './product.controller';

@Module({
  controllers: [ProductController],
  // StudentIdentityGuard 要 PrismaService（账号状态校验）—— 少了整个 API 起不来
  providers: [PrismaService],
})
export class ProductModule {}
