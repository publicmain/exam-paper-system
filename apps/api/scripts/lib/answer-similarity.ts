/**
 * 学生答案与参考答案的语义相似度 —— 判分队列的**排序**依据。
 *
 * ## 为什么要有
 *
 * 首发第一周三天判了 111 道简答题，判分是最先撑不住的一环。铁律是零 Anthropic
 * 调用，所以不能让模型代判；但可以让它把队列排好，明显对的和明显错的各在一头，
 * 人只在中间那段费脑子。
 *
 * ## 它不做什么
 *
 * **不给分。** 分永远是人在聊天里判的，这里只输出一个 0–1 的数字用来排序。
 * 相似度高不等于答对（可以整句照抄原文却没答到点上），低也不等于错（可以用完全
 * 不同的说法说对）。所以输出只进 dump，不进任何写回数据库的路径。
 *
 * ## 模型
 *
 * all-MiniLM-L6-v2，本地跑，约 90 MB，第一次用会下载到 HuggingFace 缓存目录，
 * 之后离线可用。选它是因为在自动简答判分的对比研究里，它给出的分数与教师最接近，
 * 而且小到能在判分脚本里顺手跑完。
 *
 * 2026-09-09 用首发周真实答案实测（参考答案是「开水更安全 + 加糖提供热量」）：
 *
 *   0.68  两点都答到的满分答案
 *   0.57  只答到一点的一分答案
 *   0.13  跑题（答成「他想逗老师开心」）
 *   0.02  乱写（「nice」）
 *
 * ## 为什么不写进 package.json
 *
 * `apps/api/Dockerfile` 的构建阶段跑的是 `npm install --include=dev`，写进
 * dependencies 会把这个包连同 onnxruntime 的原生二进制拉进**每一次生产构建**，
 * 白白拖慢部署 —— 而判分只在我这台机器上跑。所以它是「判分机按需装」：
 *
 *     npm i -D --workspace @app/api @huggingface/transformers   # 装完别提交
 *
 * 没装、装坏、模型下不下来，都**静默降级**：返回空 Map，队列按原顺序排，
 * 判分流程照常，只是少了排序这个便利。
 */

type Extractor = (text: string, opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: ArrayLike<number> }>;

let extractor: Extractor | null | undefined;

/** 懒加载。第一次调用会下载模型（约 90 MB），之后走缓存。 */
async function load(): Promise<Extractor | null> {
  if (extractor !== undefined) return extractor;
  try {
    // 动态 import：这个包只在判分时用，装不上也不该让整个脚本挂掉
    const mod: any = await import('@huggingface/transformers');
    extractor = (await mod.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      dtype: 'fp32',
    })) as Extractor;
  } catch (e) {
    console.warn(`[similarity] 模型没起来，队列不排序：${(e as Error).message}`);
    extractor = null;
  }
  return extractor;
}

async function embed(run: Extractor, text: string): Promise<Float32Array> {
  const out = await run(text.replace(/\s+/g, ' ').trim().slice(0, 1500), {
    pooling: 'mean',
    normalize: true,
  });
  return Float32Array.from(out.data as ArrayLike<number>);
}

function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

export interface SimilarityInput {
  id: string;
  studentAnswer: string;
  /** 参考答案，可以给多条（accept 列表）—— 取最高的那条。 */
  references: string[];
}

/**
 * 批量算相似度。返回 `id → 0–1`；模型不可用时返回空 Map。
 *
 * 空答案直接给 0，不浪费一次前向。
 */
export async function scoreSimilarity(items: SimilarityInput[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (items.length === 0) return out;
  const run = await load();
  if (!run) return out;

  // 参考答案会大量重复（同一道题所有学生共用），缓存起来
  const refCache = new Map<string, Float32Array>();
  const embedRef = async (text: string) => {
    const key = text.trim().toLowerCase();
    const hit = refCache.get(key);
    if (hit) return hit;
    const v = await embed(run, text);
    refCache.set(key, v);
    return v;
  };

  for (const item of items) {
    const answer = String(item.studentAnswer ?? '').trim();
    const refs = item.references.map((r) => String(r ?? '').trim()).filter(Boolean);
    if (!answer || refs.length === 0) {
      out.set(item.id, 0);
      continue;
    }
    try {
      const a = await embed(run, answer);
      let best = 0;
      for (const r of refs) best = Math.max(best, cosine(a, await embedRef(r)));
      out.set(item.id, Number(best.toFixed(3)));
    } catch (e) {
      console.warn(`[similarity] ${item.id} 算不出来：${(e as Error).message}`);
    }
  }
  return out;
}

/** 排序用的粗分档。阈值是 2026-09-09 用首发周真实答案标定的，不是理论值。 */
export function similarityBand(score: number | null | undefined): '像满分' | '要细看' | '像零分' | '未知' {
  if (score == null) return '未知';
  if (score >= 0.62) return '像满分';
  if (score <= 0.25) return '像零分';
  return '要细看';
}
