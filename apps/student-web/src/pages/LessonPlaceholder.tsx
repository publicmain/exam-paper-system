/**
 * 五条课程路由的**统一占位页**。
 *
 * 阶段 6A 把这五条路由真的注册了 —— 于是 `nextAction` 能把学生送到对应
 * 的段落，而不是停在 `/today` 说「还没实现」。但每一段的功能属于阶段
 * 7–10，这里只做三件事：
 *
 *   · 说清这是哪一段；
 *   · 说清它还没做；
 *   · 给一条固定的回 `/today` 的路。
 *
 * **不发任何课程请求、不做任何业务动作** —— 占位页一旦偷偷调接口，
 * 「还没实现」就变成了半实现，最难查的那种。
 */
import { Link } from 'react-router-dom';
import { LESSON_STAGE_LABEL, ROUTES, type LessonStageKey } from '../routes.contract';
import { Card, Screen } from '../ui';

export default function LessonPlaceholder({ stage }: { stage: LessonStageKey }) {
  const label = LESSON_STAGE_LABEL[stage];
  return (
    <Screen>
      <Card>
        <h1 className="text-xl font-semibold mb-3">{label}</h1>
        <p className="text-sm text-slate-500 mb-6">
          这一段还没有做好。等它上线之后，你就能在这里{label}了。
        </p>
        <Link to={ROUTES.today} className="text-blue-600 underline text-sm">
          回到今天的课
        </Link>
      </Card>
    </Screen>
  );
}
