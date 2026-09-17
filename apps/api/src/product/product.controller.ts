import { BadRequestException, Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/auth.guard';
import { RequireStudentReadToken, StudentIdentityGuard } from '../common/student-identity.guard';
import { enabledModules } from './product-modules';

/**
 * 学生端问「哪些新模块开着」（2026-09-15）。只读环境变量、零写库 —— 教师只读视角可读。
 * 入口显不显示看它；真正的拦截在各模块的服务端（`assertModuleEnabled`）。
 */
@UseGuards(StudentIdentityGuard)
@Controller('product')
export class ProductController {
  @Public()
  @RequireStudentReadToken()
  @Get('modules')
  modules(@Req() req: Request) {
    const id = (req as Request & { studentAuth?: { id?: string } }).studentAuth?.id;
    if (!id) throw new BadRequestException({ code: 'student_required' });
    return { modules: enabledModules() };
  }
}
