import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * 学生自助页访问埋点（2026-08-13 老师提问："到底有多少人真的打开过
 * 自己的成绩 / 错题 / 生词本？"）。
 *
 * ## 只记三件事：谁、哪类页面、哪天
 *
 * 不记 IP、不记 User-Agent、不记停留时长、不记点击轨迹。这是给老师
 * 看班级参与度的教学指标,不是行为画像 —— 学生是未成年人,能少收就
 * 少收。同一学生同一天重复打开同类页面只累加 hits,不新增行,所以
 * 表的增长上限是 33 人 × 5 类 × 每天 = 165 行/天,一学期也就两万行。
 *
 * ## 为什么分「打开成绩列表」和「点进逐题详情」两类
 *
 * 老师问的是"有多少人**去看自己的错题**"。只统计"打开成绩页"会高估
 * —— 交卷后系统会自动跳转到成绩页,那不是主动查看。真正说明"他在
 * 复盘"的是**点进某一场的逐题详情**(submission_detail),那一步必须
 * 手动点。两个指标一起看才知道:多少人来了、其中多少人真的往里走了。
 *
 * 写入失败一律静默 —— 埋点绝不能影响学生看成绩。
 */

export type PageViewKindKey =
  | 'history'
  | 'submission_detail'
  | 'vocab'
  | 'vocab_practice'
  | 'mistakes'
  | 'mistake_practice';

/** 新加坡自然日。直接用偏移算，避免服务器时区依赖。 */
export function sgtDay(d = new Date()): string {
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

@Injectable()
export class PageViewService {
  private readonly log = new Logger(PageViewService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 记一次访问。同日同类只累加计数。best-effort，永不抛。 */
  async record(studentId: string, kind: PageViewKindKey): Promise<void> {
    const day = sgtDay();
    try {
      await this.prisma.studentPageView.upsert({
        where: { studentId_kind_day: { studentId, kind: kind as any, day } },
        create: { studentId, kind: kind as any, day },
        update: { hits: { increment: 1 } },
      });
    } catch (e: any) {
      this.log.warn(`page view record failed (${kind}): ${e?.message ?? e}`);
    }
  }

  /**
   * 班级参与度。回答老师的原问题：判分结束后有多少人回来看。
   *
   * 分母用「当天真正交了卷的人数」而不是全班人数 —— 缺考的学生没有
   * 成绩可看，把他们算进分母会让参与率无谓地难看，也掩盖真正的问题。
   */
  async classEngagement(classId: string, days = 14) {
    const since = sgtDay(new Date(Date.now() - days * 86400_000));
    const rows = await this.prisma.$queryRaw<
      Array<{ day: string; kind: string; students: number }>
    >`
      SELECT v."day", v."kind"::text AS kind, COUNT(DISTINCT v."studentId")::int AS students
      FROM "StudentPageView" v
      WHERE v."day" >= ${since}
        AND EXISTS (
          SELECT 1 FROM "ClassEnrollment" e
          WHERE e."userId" = v."studentId" AND e."classId" = ${classId}
        )
      GROUP BY v."day", v."kind"
      ORDER BY v."day" DESC, v."kind"`;

    // 当天交卷人数（分母）
    const denom = await this.prisma.$queryRaw<Array<{ day: string; submitted: number }>>`
      SELECT to_char(s."date", 'YYYY-MM-DD') AS day,
             COUNT(DISTINCT sub."studentId")::int AS submitted
      FROM "MorningQuizSession" s
      JOIN "PaperAssignment" pa ON pa.id = s."paperAssignmentId"
      JOIN "StudentSubmission" sub ON sub."assignmentId" = pa.id
      WHERE s."classId" = ${classId}
        AND to_char(s."date", 'YYYY-MM-DD') >= ${since}
        AND sub.status IN ('submitted', 'marked', 'locked')
      GROUP BY 1 ORDER BY 1 DESC`;

    const byDay = new Map<string, any>();
    for (const d of denom) byDay.set(d.day, { day: d.day, submitted: d.submitted });
    for (const r of rows) {
      const e = byDay.get(r.day) ?? { day: r.day, submitted: 0 };
      e[r.kind] = r.students;
      byDay.set(r.day, e);
    }
    return {
      days: [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1)),
    };
  }

  /** 谁从来不回看 —— 老师最想知道的那份名单。 */
  async neverLookedBack(classId: string, days = 14) {
    const since = sgtDay(new Date(Date.now() - days * 86400_000));
    return this.prisma.$queryRaw<Array<{ name: string; submissions: number; views: number }>>`
      SELECT u.name,
             COUNT(DISTINCT sub.id)::int AS submissions,
             COALESCE((
               SELECT SUM(v.hits)::int FROM "StudentPageView" v
               WHERE v."studentId" = u.id AND v."day" >= ${since}
                 AND v.kind IN ('submission_detail', 'mistakes', 'vocab_practice')
             ), 0) AS views
      FROM "ClassEnrollment" e
      JOIN "User" u ON u.id = e."userId"
      JOIN "MorningQuizSession" s ON s."classId" = e."classId"
      JOIN "PaperAssignment" pa ON pa.id = s."paperAssignmentId"
      JOIN "StudentSubmission" sub ON sub."assignmentId" = pa.id AND sub."studentId" = u.id
      WHERE e."classId" = ${classId}
        AND to_char(s."date", 'YYYY-MM-DD') >= ${since}
        AND sub.status IN ('submitted', 'marked', 'locked')
      GROUP BY u.id, u.name
      ORDER BY views ASC, submissions DESC`;
  }
}
