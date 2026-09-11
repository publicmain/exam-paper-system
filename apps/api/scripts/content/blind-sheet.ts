/**
 * 盲做：生成去掉答案的卷面，做完后逐题比对（2026-09-11）。
 *
 *   # 1. 出卷面（不含任何答案、证据、评分标准）
 *   npx ts-node apps/api/scripts/content/blind-sheet.ts --week=week3 --out=<目录>
 *
 *   # 2. 照卷面作答，写成 JSON：{ "olevel/2026-09-14": ["C", "A", …, "文字答案"], … }
 *   #    客观题填字母，主观题填自己的答案
 *
 *   # 3. 比对
 *   npx ts-node apps/api/scripts/content/blind-sheet.ts --week=week3 --check=<answers.json>
 *
 * 为什么要有：出题人最容易看不见自己题目里的歧义 —— 他知道答案，每个干扰项
 * 在他眼里都「显然不对」。照着卷面冷做一遍，客观题做错的地方就是歧义所在；
 * 主观题把自己的答案和参考答案并排列出来，看评分标准能不能给到分。
 *
 * 局限要说清：出题人自己盲做不是真正的独立审题 —— 记忆会帮忙。它能抓到
 * 答案键错位、干扰项其实也对、NOT GIVEN 其实写了这几类；抓不到「题目本身
 * 就问偏了」。后者靠上线后的题目体检（item-report.ts）补。
 */
import * as fs from 'fs';
import * as path from 'path';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const WEEK = arg('week') ?? 'week3';
const OUT = arg('out');
const CHECK = arg('check');
const DIR = path.resolve(__dirname, '..', 'pilot', 'content', WEEK);

type Q = {
  taskType: string;
  questionType: 'mcq' | 'short_answer';
  marks: number;
  options: Array<{ key: string; text: string }> | null;
  answer: string;
  stem: string;
  rubric?: string;
};
type Day = { date: string; title: string; passage: string; questions: Q[] };

function load(): Array<{ id: string; day: Day }> {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .sort()
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .map((f) => require(path.join(DIR, f)))
    .filter((m) => typeof m.LEVEL === 'string' && Array.isArray(m.DAYS))
    .flatMap((m) => (m.DAYS as Day[]).map((day) => ({ id: `${m.LEVEL}/${day.date}`, day })));
}

function sheet(id: string, day: Day): string {
  const lines = [`# ${id} — ${day.title}`, '', day.passage, '', '---', ''];
  let lastInstruction = '';
  day.questions.forEach((q, i) => {
    const cut = q.stem.lastIndexOf('\n');
    const instruction = cut >= 0 ? q.stem.slice(0, cut).trim() : '';
    const item = cut >= 0 ? q.stem.slice(cut + 1).trim() : q.stem.trim();
    if (instruction && instruction !== lastInstruction) lines.push(`_${instruction}_`, '');
    lastInstruction = instruction;
    lines.push(`**${i + 1}.** ${item}  [${q.marks}]`);
    if (q.options && q.taskType !== 'true_false_not_given') {
      for (const o of q.options) lines.push(`   ${o.key}. ${o.text}`);
    }
    if (q.taskType === 'true_false_not_given') lines.push('   A. TRUE   B. FALSE   C. NOT GIVEN');
    lines.push('');
  });
  return lines.join('\n');
}

if (OUT) {
  fs.mkdirSync(OUT, { recursive: true });
  const all = load();
  const combined = all.map(({ id, day }) => sheet(id, day)).join('\n\n');
  const file = path.join(OUT, `${WEEK}-blind.md`);
  fs.writeFileSync(file, combined, 'utf8');
  console.log(`卷面已写到 ${file}（${all.length} 份，不含答案）`);
} else if (CHECK) {
  const mine: Record<string, string[]> = JSON.parse(fs.readFileSync(CHECK, 'utf8'));
  let wrong = 0;
  let total = 0;
  for (const { id, day } of load()) {
    const answers = mine[id];
    if (!answers) {
      console.log(`- ${id}：没有作答，跳过`);
      continue;
    }
    console.log(`\n## ${id} — ${day.title}`);
    day.questions.forEach((q, i) => {
      const a = String(answers[i] ?? '').trim();
      if (q.questionType === 'mcq') {
        total += 1;
        const ok = a.toUpperCase() === q.answer.toUpperCase();
        if (!ok) wrong += 1;
        const text = (key: string) => q.options?.find((o) => o.key === key)?.text ?? key;
        console.log(`${ok ? '✓' : '✗'} ${i + 1}. 我选 ${a}${ok ? '' : `（${text(a)}）  答案 ${q.answer}（${text(q.answer)}）`}`);
      } else {
        console.log(`• ${i + 1}. [${q.marks} 分] 我答：${a}\n      参考：${q.answer}\n      评分：${q.rubric ?? '—'}`);
      }
    });
  }
  console.log(`\n客观题 ${total} 道，做错 ${wrong} 道。${wrong ? '做错的每一道都要回去看：是我读错了，还是题目有歧义。' : ''}`);
} else {
  console.log('用法：--out=<目录> 出卷面；--check=<answers.json> 比对');
}
