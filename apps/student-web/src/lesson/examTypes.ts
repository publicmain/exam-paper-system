/**
 * 阅读页渲染层的共享类型。
 *
 * 从 `apps/web/src/components/exam/types.ts` 搬来（S7A §1.2 第 1 项），
 * 删掉阶段 7 用不到的字段 —— 尤其是**卷子载荷里的姓名字段不搬**：
 * 它只服务于考试中查词记生词本，那条线归阶段 12，且现版本带姓名写库
 * 违反已冻结的身份契约。
 */

/** 与后端 prisma enum + level-registry.ts 一一对应。 */
export type EnglishLevel =
  | 'ielts_authentic'
  | 'ielts_light'
  | 'olevel'
  | 'olevel_intermediate'
  | 'ielts_simplified';

/**
 * 界面口味。阅读页**永远是 `test`** —— 服务端也按白名单删掉了答案键，
 * 两道闸都要在。`practice` 保留在类型里只是为了如实描述后端的取值。
 */
export type ExamMode = 'practice' | 'test';

export interface ExamOption {
  key: string;
  text: string;
}

/** 一道渲染出来的题。渲染器需要更多东西时去 `snapshotContent` 里取。 */
export interface ExamQuestion {
  id: string;
  sortOrder: number;
  marks: number;
  questionType: string;
  snapshotContent: any;
  snapshotOptions: ExamOption[] | null;
}

export interface ExamAnswer {
  selectedOption?: string;
  textAnswer?: string;
}

export interface ExamPaper {
  sessionId: string;
  quizEnd: string | null;
  level: EnglishLevel | string;
  /** `passage_pick` ⇒ 卷首一段共享原文（IELTS 阅读）。 */
  paperMode: 'passage_pick' | 'standard' | null;
  mode: ExamMode;
  /** 出卷时写死的渲染器 key，优先于一切推断。 */
  rendererKey?: string | null;
  questions: ExamQuestion[];
}

/** 注册表用来选渲染器的分类。 */
export type QuestionRenderKind =
  | 'ielts_passage_pick'
  | 'olevel_comprehension'
  | 'olevel_cloze'
  | 'olevel_vocab'
  | 'olevel_transformation'
  | 'olevel_mcq';
