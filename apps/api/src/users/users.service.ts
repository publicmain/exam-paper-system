import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true, lastLogin: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: { email: string; name: string; password: string; role: UserRole }) {
    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash, role: input.role },
      select: { id: true, email: true, name: true, role: true },
    });
  }
}
