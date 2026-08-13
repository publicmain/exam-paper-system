import { PrismaClient } from '@prisma/client';

/**
 * 贴墙码分身的核查报告：今天谁扫的是墙上那张，谁扫的是旧照片。
 *
 * 背景：贴墙码固定不变，学生可以拍成照片带回家扫，考勤分辨不出人是否
 * 真的到了墙前。做法是同一个班同时签发多张都能用的码、各带标签，
 * 悄悄换掉墙上那张 —— 当天扫到旧标签的，用的必然是之前拍的照片。
 *
 * ⚠️ 判读须知（很重要，别直接拿去处分学生）：
 *   1. 这是**一次性**证据。新码贴上去当天最干净；之后新码同样会被
 *      拍照传播，需要定期换标签才能保持效力。
 *   2. 扫到旧码 ≠ 一定在家。学生可能把旧码存在相册里图省事，人就站
 *      在墙前扫自己的截图。结论要和 IP、设备、以及他当天是否在校
 *      交叉验证。
 *   3. 反过来是硬的：扫到**新标签**的人，当天一定到过墙前。
 *
 *   CLASS_ID=... DAY=2026-08-14 npx ts-node apps/api/scripts/qr-variant-report.ts
 */

const prisma = new PrismaClient();
const CLASS_ID = process.env.CLASS_ID ?? 'cmoux0jj900m9oc28r4sptjj0';
const DAY = process.env.DAY ?? new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

(async () => {
  console.log(`\n═══ 贴墙码核查 · ${DAY} ═══\n`);

  const rows = await prisma.$queryRaw<
    Array<{
      name: string;
      variant: string | null;
      status: string;
      scan: string | null;
      ip: string | null;
      device: string | null;
    }>
  >`
    SELECT u.name,
           a."qrVariant" AS variant,
           a.status::text AS status,
           to_char(a."scanTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Singapore', 'HH24:MI:SS') AS scan,
           a."sourceIp" AS ip,
           LEFT(a."deviceUuid", 8) AS device
    FROM "Attendance" a
    JOIN "User" u ON u.id = a."studentId"
    JOIN "MorningQuizSession" s ON s.id = a."sessionId"
    WHERE s."classId" = ${CLASS_ID}
      AND s.date = ${DAY}::date
      AND a."scanTime" IS NOT NULL
    ORDER BY a."qrVariant" NULLS FIRST, a."scanTime"`;

  if (!rows.length) {
    console.log('当天没有扫码记录。');
    await prisma.$disconnect();
    return;
  }

  const byVariant = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.variant ?? '(未记录)';
    if (!byVariant.has(key)) byVariant.set(key, []);
    byVariant.get(key)!.push(r);
  }

  for (const [variant, list] of byVariant) {
    console.log(`【${variant}】${list.length} 人`);
    for (const r of list) {
      console.log(
        `   ${r.name.padEnd(12)} ${r.scan}  ${r.status.padEnd(8)} IP ${r.ip ?? '-'}  设备 ${r.device ?? '-'}`,
      );
    }
    console.log();
  }

  // 「未记录」= 换码功能上线之前的历史行，不是异常
  const legacy = byVariant.get('(未记录)')?.length ?? 0;
  if (legacy) {
    console.log(`注：${legacy} 条没有码标签，是本功能上线前的记录，不作判读。\n`);
  }

  console.log('判读：扫到新标签的人当天一定到过墙前；扫到旧标签的需要');
  console.log('结合 IP／设备／是否在校再确认，不能单凭这一条下结论。');

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
