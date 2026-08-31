/**
 * `/mistakes` —— **试点期暂停**。
 *
 * ## 为什么整页换掉，而不是修
 *
 * S12G 的真人走查在这一页上抓到的问题不是几个 bug，是这条产品线本身
 * 还没想清楚（收录标准、销账语义、和课程内补段的关系）。试点要放真学生
 * 进来，与其给他们一个半成品，不如**明说现在不开放**。
 *
 * 三件事必须说清楚，否则学生会以为自己的错题被删了：
 *   · 为什么进不来；
 *   · 你以前的错题**还在**（服务端的采集侧一行没停）；
 *   · 它**不影响今天的完成度**（今天只有阅读 + 单词两段）。
 *
 * ## 这一页不发任何请求
 *
 * 服务端的四个错题端点在暂停期返回 503。前端如果还照打，学生会先看到
 * 一次失败再看到这段话 —— 所以这里**一个 fetch 都不发**，也不读令牌。
 *
 * 原来那 546 行（分组、销账、展开详情……）在 Git 历史里，恢复时
 * `git show` 就能拿回来，不留一份注释掉的副本在树上。
 */
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../routes.contract';
import { Unavailable } from '../ui';

export default function MistakesPage() {
  const navigate = useNavigate();
  return (
    <Unavailable
      title="错题本暂未开放"
      note={
        <>
          <p>这部分正在重做，暂时进不来。</p>
          <p className="mt-2">
            你以前的错题<strong>都还在</strong>，一条都没有删；它也
            <strong>不影响今天的完成度</strong>。
          </p>
        </>
      }
      actions={
        <>
          <button
            type="button"
            data-testid="back-to-today"
            onClick={() => navigate(ROUTES.today)}
            className="w-full min-h-[44px] rounded-xl bg-blue-600 text-white py-3 text-base font-medium"
          >
            回到今天的课
          </button>
          <button
            type="button"
            data-testid="go-vocab"
            onClick={() => navigate(ROUTES.vocab)}
            className="w-full min-h-[44px] rounded-xl border border-slate-300 py-3 text-base"
          >
            去生词本
          </button>
        </>
      }
    />
  );
}
