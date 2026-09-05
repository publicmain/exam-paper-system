/**
 * `/mistakes/practice` —— **试点期暂停**。理由见 `Mistakes.tsx`。
 *
 * 补段（`drill`）在服务端也一并关掉了：目标恒为 0、不进今天的分母、
 * 不挡阶段推进。所以没有任何一条路会把学生导到这一页 —— 它只是深链接
 * 与旧书签的落点。
 */
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../routes.contract';
import { Unavailable } from '../ui';

export default function MistakePracticePage() {
  const navigate = useNavigate();
  return (
    <Unavailable
      title="错题重练暂未开放"
      note={
        <>
          <p>这部分正在重做，暂时进不来。</p>
          <p className="mt-2">
            今天的课只有<strong>阅读</strong>和<strong>单词</strong>两段，不用等错题重练。
          </p>
        </>
      }
      actions={
        <button
          type="button"
          data-testid="back-to-today"
          onClick={() => navigate(ROUTES.today)}
          className="w-full min-h-[44px] rounded-xl bg-blue-600 text-white py-3 text-base font-medium"
        >
          回到今天的课
        </button>
      }
    />
  );
}
