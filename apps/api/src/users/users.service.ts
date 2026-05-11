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

  /** Update name and/or email. Used by the Classes UI for inline rename. */
  async updateProfile(id: string, patch: { name?: string; email?: string }) {
    const data: { name?: string; email?: string } = {};
    if (typeof patch.name === 'string' && patch.name.trim()) data.name = patch.name.trim();
    if (typeof patch.email === 'string' && patch.email.trim()) data.email = patch.email.trim();
    if (Object.keys(data).length === 0) {
      // Nothing to update — return current row instead of erroring so the
      // UI can treat this as a no-op save.
      return this.prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, name: true, role: true },
      });
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true },
    });
  }
}
