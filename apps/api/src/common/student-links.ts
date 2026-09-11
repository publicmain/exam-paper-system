/**
 * 发给外部（企业微信通知、日志）的学生端链接。
 *
 * 身份规则：canonical URL **不携带姓名或 studentId**（CLAUDE.md「学生每日英语 App」）。
 * 原来 score_ready 通知里写的是「/my-history?name=姓名」—— 旧端的按姓名查成绩页，
 * 已经退役（审计 S02），而且把姓名塞进了 URL。现在指向学生端 `routes.contract.ts`
 * 的 `/scores/:submissionId`：选择器只有答卷 id，归属由服务端按令牌判定。
 */
export function scoreResultPath(submissionId: string): string {
  return `/scores/${encodeURIComponent(submissionId)}`;
}
