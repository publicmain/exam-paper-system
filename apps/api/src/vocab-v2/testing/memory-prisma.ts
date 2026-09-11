/**
 * 词汇模块回归测试用的内存假 Prisma —— **不连任何数据库**。
 *
 * 为什么要自己写一个：审计里 VOC01 / VOC02 / VOC07 这些问题都是「两个请求
 * 交错执行」才出现的，`vi.fn().mockResolvedValue` 那种桩复现不出来。这里近似
 * Postgres 默认的 READ COMMITTED：
 *
 *   · 事务内的写先进事务私有覆盖层，提交前别的请求看不见；
 *   · 写同一行要拿行锁；别人持锁时等它提交/回滚，然后按**最新提交值**重新判断
 *     where（Postgres 的 EvalPlanQual）—— 条件更新因此是原子的；
 *   · 唯一键：与已提交/自己的覆盖层冲突 → P2002；与别的**未提交**事务刚插入的
 *     键冲突 → 等它结束，提交了就 P2002，回滚了就放行；
 *   · 每条语句执行前先让出事件循环，`Promise.all` 两个服务调用就会逐语句交错；
 *   · 等待成环（死锁）→ 抛 P2034。
 *
 * 已知限制（台账里也写了）：
 *   · 不模拟 MVCC 快照细节、gap lock、SERIALIZABLE；
 *   · 只实现本模块用到的那部分 Prisma 过滤 / include / orderBy 语法，碰到不认识的
 *     写法直接抛错，而不是悄悄当成「匹配」；
 *   · 事务回滚、隔离级别等最终仍需隔离 Postgres 集成验证（§8.3 第 3 条）。
 */

type Row = Record<string, any>;

interface RelationDef {
  model: string;
  kind: 'one' | 'many';
  /** 本行的字段 */
  from: string;
  /** 对方行的字段；关系成立 = other[to] === row[from] */
  to: string;
  onDelete?: 'cascade' | 'setNull';
}

interface ModelDef {
  idField?: string;
  unique?: string[][];
  relations?: Record<string, RelationDef>;
  defaults?: () => Row;
  /** 带 @updatedAt 的模型 */
  updatedAt?: boolean;
}

const many = (model: string, to: string, from = 'id', onDelete?: 'cascade' | 'setNull'): RelationDef => ({ model, kind: 'many', from, to, onDelete });
const one = (model: string, from: string, to = 'id'): RelationDef => ({ model, kind: 'one', from, to });

export const MEMORY_SCHEMA: Record<string, ModelDef> = {
  user: {
    unique: [['email']],
    relations: {
      classEnrollments: many('classEnrollment', 'userId'),
      levelChanges: many('studentLevelChange', 'studentId'),
    },
    defaults: () => ({ role: 'student', isActive: true, archivedAt: null, englishLevel: null, name: '学生', studentAuthVersion: 0 }),
  },
  studentLevelChange: {
    relations: { student: one('user', 'studentId') },
    defaults: () => ({ fromLevel: null, source: 'student_self' }),
  },
  class: {
    relations: {
      enrollments: many('classEnrollment', 'classId'),
      morningQuizSessions: many('morningQuizSession', 'classId'),
    },
    defaults: () => ({ archivedAt: null, name: '班级' }),
  },
  classEnrollment: {
    unique: [['classId', 'userId']],
    relations: { user: one('user', 'userId'), class: one('class', 'classId') },
    defaults: () => ({ role: 'student' }),
  },
  paper: {
    relations: { questions: many('paperQuestion', 'paperId') },
    defaults: () => ({ name: '试卷', config: null, totalMarksActual: 10 }),
  },
  paperQuestion: {
    relations: { paper: one('paper', 'paperId'), question: one('question', 'questionId') },
    defaults: () => ({ marks: 1 }),
  },
  question: { defaults: () => ({ content: null }) },
  paperAssignment: {
    relations: {
      paper: one('paper', 'paperId'),
      class: one('class', 'classId'),
      submissions: many('studentSubmission', 'assignmentId'),
      morningQuizSession: { model: 'morningQuizSession', kind: 'one', from: 'id', to: 'paperAssignmentId' },
    },
    defaults: () => ({ status: 'open' }),
  },
  morningQuizSession: {
    unique: [['paperAssignmentId']],
    relations: { class: one('class', 'classId'), paperAssignment: one('paperAssignment', 'paperAssignmentId') },
    defaults: () => ({ status: 'active', level: 'olevel' }),
  },
  studentSubmission: {
    relations: { assignment: one('paperAssignment', 'assignmentId'), scripts: many('answerScript', 'submissionId') },
    defaults: () => ({ status: 'in_progress', finalSubmittedAt: null, submitSource: null, maxScore: 10 }),
  },
  answerScript: { relations: { submission: one('studentSubmission', 'submissionId') } },
  dictEntry: { idField: 'word', defaults: () => ({ phonetic: null, definition: null, pos: null }) },
  wordAudio: { idField: 'headword', defaults: () => ({ voice: 'test', contentType: 'audio/mpeg', byteLength: 3 }) },
  vocabularyLexeme: {
    unique: [['listName', 'listVersion', 'headword']],
    relations: { senses: many('vocabularySense', 'lexemeId', 'id', 'cascade') },
    defaults: () => ({ rank: 0, phonetic: null, attribution: 'test' }),
    updatedAt: true,
  },
  vocabularySense: {
    unique: [['lexemeId', 'senseKey']],
    relations: {
      lexeme: one('vocabularyLexeme', 'lexemeId'),
      contexts: many('vocabularyContext', 'senseId', 'id', 'cascade'),
      students: many('studentVocabularySense', 'senseId', 'id', 'cascade'),
      events: many('vocabularyCollectionEvent', 'senseId', 'id', 'cascade'),
      items: many('vocabularyV2SessionItem', 'senseId'),
      contentJobs: many('vocabularyContentJob', 'senseId', 'id', 'cascade'),
      assignmentItems: many('vocabularyV2AssignmentItem', 'senseId'),
    },
    defaults: () => ({
      collocations: null, wordFamily: null, confusionWords: null, memoryHint: null, imageUrl: null,
      contentVersion: 1, qualityStatus: 'ready', definition: '', translation: '',
    }),
    updatedAt: true,
  },
  vocabularyContext: {
    unique: [['senseId', 'kind', 'position']],
    relations: { sense: one('vocabularySense', 'senseId') },
    defaults: () => ({
      position: 1, topic: null, difficulty: 1, sourceTitle: null, sourceRef: null, provider: null,
      attribution: null, license: null, externalId: null, qualityStatus: 'ready',
    }),
  },
  vocabularyV2Assignment: {
    unique: [['classId', 'date']],
    relations: { class: one('class', 'classId'), items: many('vocabularyV2AssignmentItem', 'assignmentId', 'id', 'cascade') },
    defaults: () => ({ status: 'published', version: 1 }),
    updatedAt: true,
  },
  vocabularyV2AssignmentItem: {
    unique: [['assignmentId', 'position'], ['assignmentId', 'senseId']],
    relations: { assignment: one('vocabularyV2Assignment', 'assignmentId'), sense: one('vocabularySense', 'senseId') },
    defaults: () => ({ force: false }),
  },
  vocabularyContentJob: {
    unique: [['senseId', 'requestedVersion']],
    relations: { sense: one('vocabularySense', 'senseId') },
    defaults: () => ({ status: 'queued', attempts: 0, candidate: null, validation: null, errorCode: null, startedAt: null, completedAt: null }),
    updatedAt: true,
  },
  studentVocabularyProfile: {
    idField: 'studentId',
    defaults: () => ({ dailyTarget: 10, taskMinutes: 8, mode: 'adaptive_coach', audioAccent: 'en-GB' }),
    updatedAt: true,
  },
  studentVocabularyCursor: {
    unique: [['studentId', 'listName', 'listVersion']],
    defaults: () => ({ nextRank: 1 }),
    updatedAt: true,
  },
  studentVocabularySense: {
    unique: [['studentId', 'senseId']],
    relations: {
      sense: one('vocabularySense', 'senseId'),
      student: one('user', 'studentId'),
      events: many('vocabularyCollectionEvent', 'studentSenseId', 'id', 'setNull'),
    },
    defaults: () => ({
      masteryStage: 1, confidence: 0, recognition: 0, contextSkill: 0, recallSkill: 0, spellingSkill: 0,
      listeningSkill: 0, speakingSkill: 0, usageSkill: 0, stability: 0, difficulty: 0, elapsedDays: 0,
      scheduledDays: 0, reps: 0, lapses: 0, lastReview: null, masteredAt: null, inNotebook: true, removedAt: null,
    }),
    updatedAt: true,
  },
  vocabularyCollectionEvent: {
    relations: { sense: one('vocabularySense', 'senseId'), studentSense: one('studentVocabularySense', 'studentSenseId') },
    defaults: () => ({ studentSenseId: null, sourceTitle: null, sourceRef: null, contextText: null, metadata: null }),
  },
  vocabularyV2Session: {
    unique: [['sessionKey']],
    relations: { items: many('vocabularyV2SessionItem', 'sessionId', 'id', 'cascade'), student: one('user', 'studentId') },
    defaults: () => ({ status: 'in_progress', cursor: 0, deferredUntil: null, completedAt: null }),
    updatedAt: true,
  },
  vocabularyV2SessionItem: {
    unique: [['sessionId', 'position']],
    relations: {
      session: one('vocabularyV2Session', 'sessionId'),
      sense: one('vocabularySense', 'senseId'),
      context: one('vocabularyContext', 'contextId'),
    },
    defaults: () => ({
      status: 'pending', response: null, isCorrect: null, attempts: 0, responseMs: null, completedAt: null,
      questionSnapshot: null, contextId: null,
    }),
    updatedAt: true,
  },
};

export class FakePrismaError extends Error {
  constructor(public readonly code: string, message: string, public readonly meta?: Record<string, unknown>) {
    super(message);
  }
}

interface Tx {
  id: number;
  overlay: Map<string, Map<string, Row | null>>;
  locked: Set<string>;
  uniqueKeys: Set<string>;
  done: Promise<void>;
  finish: () => void;
  state: 'active' | 'committed' | 'rolledback';
}

export interface WriteRecord {
  model: string;
  op: string;
}

const OPERATOR_KEYS = new Set(['equals', 'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'contains', 'startsWith', 'endsWith', 'mode']);
const UPDATE_OPERATORS = new Set(['increment', 'decrement', 'multiply', 'divide', 'set']);

function isPlainObject(value: unknown): value is Row {
  return value != null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof Uint8Array);
}

function clone<T>(value: T): T {
  if (value instanceof Date) return new Date(value.getTime()) as any;
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return value.map((item) => clone(item)) as any;
  if (isPlainObject(value)) {
    const out: Row = {};
    for (const [key, item] of Object.entries(value)) out[key] = clone(item);
    return out as T;
  }
  return value;
}

function comparable(value: unknown): unknown {
  return value instanceof Date ? value.getTime() : value;
}

function equal(a: unknown, b: unknown): boolean {
  const left = comparable(a);
  const right = comparable(b);
  if (left == null && right == null) return true;
  return left === right;
}

export class MemoryPrisma {
  readonly tables = new Map<string, Map<string, Row>>();
  readonly writes: WriteRecord[] = [];
  private readonly locks = new Map<string, Tx>();
  private readonly pendingUniques = new Map<string, Tx>();
  private readonly waitsFor = new Map<Tx, Tx>();
  private txCounter = 0;
  private idCounter = 0;
  private clockMs = Date.parse('2026-09-01T00:00:00.000Z');
  /** 每条语句前让出几次事件循环；并发测试可以调大，制造更多交错 */
  yieldsPerStatement = 1;

  constructor() {
    for (const model of Object.keys(MEMORY_SCHEMA)) this.tables.set(model, new Map());
    const root = this.clientFor(null);
    Object.assign(this, root);
  }

  // ───────────────────────── 测试辅助 ─────────────────────────

  /** 直接写入「已提交」行（不经事务、不记写日志），用来搭场景。 */
  seed(model: string, data: Row): Row {
    const row = this.withDefaults(model, data);
    this.table(model).set(this.rowId(model, row), row);
    return clone(row);
  }

  rows(model: string, where: Row = {}): Row[] {
    return [...this.table(model).values()].filter((row) => this.matches(model, row, where, null)).map((row) => clone(row));
  }

  resetWrites() {
    this.writes.length = 0;
  }

  now(): Date {
    this.clockMs += 1;
    return new Date(this.clockMs);
  }

  // ───────────────────────── 基础设施 ─────────────────────────

  private table(model: string) {
    const table = this.tables.get(model);
    if (!table) throw new Error(`memory-prisma: unknown model ${model}`);
    return table;
  }

  private def(model: string): ModelDef {
    const def = MEMORY_SCHEMA[model];
    if (!def) throw new Error(`memory-prisma: unknown model ${model}`);
    return def;
  }

  private idField(model: string) {
    return this.def(model).idField ?? 'id';
  }

  private rowId(model: string, row: Row): string {
    return String(row[this.idField(model)]);
  }

  private withDefaults(model: string, data: Row): Row {
    const def = this.def(model);
    const idField = this.idField(model);
    const stamp = this.now();
    const row: Row = {
      ...(idField === 'id' ? { id: `${model}-${++this.idCounter}` } : {}),
      createdAt: stamp,
      ...(def.updatedAt ? { updatedAt: stamp } : {}),
      ...(def.defaults?.() ?? {}),
    };
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (def.relations?.[key]) continue;
      row[key] = clone(value);
    }
    // 模型里常见的「默认 now()」字段
    for (const key of ['firstSeenAt', 'due', 'startedAt', 'joinedAt', 'changedAt']) {
      if (key in row) continue;
      if (model === 'studentVocabularySense' && (key === 'firstSeenAt' || key === 'due')) row[key] = stamp;
      if (model === 'vocabularyV2Session' && key === 'startedAt') row[key] = stamp;
      if (model === 'classEnrollment' && key === 'joinedAt') row[key] = stamp;
      if (model === 'studentLevelChange' && key === 'changedAt') row[key] = stamp;
    }
    return row;
  }

  private async tick() {
    for (let i = 0; i < this.yieldsPerStatement; i += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  private newTx(): Tx {
    let finish!: () => void;
    const done = new Promise<void>((resolve) => { finish = resolve; });
    return { id: ++this.txCounter, overlay: new Map(), locked: new Set(), uniqueKeys: new Set(), done, finish, state: 'active' };
  }

  private commit(tx: Tx) {
    for (const [model, rows] of tx.overlay) {
      const table = this.table(model);
      for (const [id, row] of rows) {
        if (row === null) table.delete(id);
        else table.set(id, row);
      }
    }
    tx.state = 'committed';
    this.release(tx);
  }

  private rollback(tx: Tx) {
    tx.state = 'rolledback';
    tx.overlay.clear();
    this.release(tx);
  }

  private release(tx: Tx) {
    for (const key of tx.locked) if (this.locks.get(key) === tx) this.locks.delete(key);
    for (const key of tx.uniqueKeys) if (this.pendingUniques.get(key) === tx) this.pendingUniques.delete(key);
    this.waitsFor.delete(tx);
    tx.finish();
  }

  private wouldDeadlock(waiter: Tx, owner: Tx) {
    let cursor: Tx | undefined = owner;
    const seen = new Set<Tx>();
    while (cursor && !seen.has(cursor)) {
      if (cursor === waiter) return true;
      seen.add(cursor);
      cursor = this.waitsFor.get(cursor);
    }
    return false;
  }

  private async waitFor(tx: Tx, owner: Tx) {
    if (this.wouldDeadlock(tx, owner)) {
      throw new FakePrismaError('P2034', 'Transaction failed due to a write conflict or a deadlock. Please retry your transaction');
    }
    this.waitsFor.set(tx, owner);
    await owner.done;
    this.waitsFor.delete(tx);
  }

  private async lockRow(tx: Tx, model: string, id: string) {
    const key = `${model}:${id}`;
    for (;;) {
      const owner = this.locks.get(key);
      if (!owner || owner === tx) {
        this.locks.set(key, tx);
        tx.locked.add(key);
        return;
      }
      await this.waitFor(tx, owner);
    }
  }

  /** 这个事务眼里的全部行（已提交 + 自己的覆盖层）。 */
  private view(model: string, tx: Tx | null): Row[] {
    const table = this.table(model);
    const overlay = tx?.overlay.get(model);
    if (!overlay) return [...table.values()];
    const out: Row[] = [];
    for (const [id, row] of table) {
      if (overlay.has(id)) {
        const own = overlay.get(id);
        if (own) out.push(own);
      } else out.push(row);
    }
    for (const [id, row] of overlay) if (row && !table.has(id)) out.push(row);
    return out;
  }

  private viewRow(model: string, id: string, tx: Tx | null): Row | null {
    const overlay = tx?.overlay.get(model);
    if (overlay?.has(id)) return overlay.get(id) ?? null;
    return this.table(model).get(id) ?? null;
  }

  private stage(tx: Tx, model: string, id: string, row: Row | null) {
    if (!tx.overlay.has(model)) tx.overlay.set(model, new Map());
    tx.overlay.get(model)!.set(id, row);
  }

  // ───────────────────────── where ─────────────────────────

  private compoundKey(model: string, key: string): string[] | null {
    for (const cols of this.def(model).unique ?? []) if (cols.join('_') === key) return cols;
    return null;
  }

  matches(model: string, row: Row, where: Row | undefined, tx: Tx | null): boolean {
    if (!where) return true;
    const def = this.def(model);
    for (const [key, condition] of Object.entries(where)) {
      if (condition === undefined) continue;
      if (key === 'AND') {
        const list = Array.isArray(condition) ? condition : [condition];
        if (!list.every((item) => this.matches(model, row, item, tx))) return false;
        continue;
      }
      if (key === 'OR') {
        if (!(condition as Row[]).some((item) => this.matches(model, row, item, tx))) return false;
        continue;
      }
      if (key === 'NOT') {
        const list = Array.isArray(condition) ? condition : [condition];
        if (list.some((item) => this.matches(model, row, item, tx))) return false;
        continue;
      }
      const compound = this.compoundKey(model, key);
      if (compound && isPlainObject(condition)) {
        if (!compound.every((col) => equal(row[col], condition[col]))) return false;
        continue;
      }
      const relation = def.relations?.[key];
      if (relation) {
        if (!this.matchRelation(row, relation, condition, tx)) return false;
        continue;
      }
      if (!this.matchScalar(row[key], condition)) return false;
    }
    return true;
  }

  private related(row: Row, relation: RelationDef, tx: Tx | null): Row[] {
    const value = row[relation.from];
    if (value == null) return [];
    return this.view(relation.model, tx).filter((other) => equal(other[relation.to], value));
  }

  private matchRelation(row: Row, relation: RelationDef, condition: any, tx: Tx | null): boolean {
    const others = this.related(row, relation, tx);
    if (relation.kind === 'one') {
      const other = others[0] ?? null;
      if (condition === null) return other === null;
      if (isPlainObject(condition) && ('is' in condition || 'isNot' in condition)) {
        if ('is' in condition) {
          if (condition.is === null) return other === null;
          return other !== null && this.matches(relation.model, other, condition.is, tx);
        }
        if (condition.isNot === null) return other !== null;
        return other === null || !this.matches(relation.model, other, condition.isNot, tx);
      }
      return other !== null && this.matches(relation.model, other, condition, tx);
    }
    if (!isPlainObject(condition)) throw new Error(`memory-prisma: unsupported to-many filter ${JSON.stringify(condition)}`);
    if ('some' in condition) return others.some((other) => this.matches(relation.model, other, condition.some, tx));
    if ('every' in condition) return others.every((other) => this.matches(relation.model, other, condition.every, tx));
    if ('none' in condition) return !others.some((other) => this.matches(relation.model, other, condition.none, tx));
    throw new Error(`memory-prisma: unsupported to-many filter ${JSON.stringify(condition)}`);
  }

  private matchScalar(value: unknown, condition: any): boolean {
    if (condition === null) return value == null;
    if (!isPlainObject(condition)) return equal(value, condition);
    const keys = Object.keys(condition);
    if (!keys.every((key) => OPERATOR_KEYS.has(key))) {
      throw new Error(`memory-prisma: unsupported scalar filter ${JSON.stringify(condition)}`);
    }
    const insensitive = condition.mode === 'insensitive';
    const text = (input: unknown) => (insensitive ? String(input ?? '').toLowerCase() : String(input ?? ''));
    for (const key of keys) {
      const operand = condition[key];
      if (operand === undefined || key === 'mode') continue;
      switch (key) {
        case 'equals':
          if (!equal(value, operand)) return false;
          break;
        case 'not':
          if (isPlainObject(operand)) {
            if (this.matchScalar(value, operand)) return false;
          } else if (operand === null) {
            if (value == null) return false;
          } else if (equal(value, operand) || value == null) {
            // SQL 语义：NULL <> x 不为真
            return false;
          }
          break;
        case 'in':
          if (!(operand as unknown[]).some((item) => equal(value, item))) return false;
          break;
        case 'notIn':
          if (value == null || (operand as unknown[]).some((item) => equal(value, item))) return false;
          break;
        case 'lt':
          if (value == null || !((comparable(value) as any) < (comparable(operand) as any))) return false;
          break;
        case 'lte':
          if (value == null || !((comparable(value) as any) <= (comparable(operand) as any))) return false;
          break;
        case 'gt':
          if (value == null || !((comparable(value) as any) > (comparable(operand) as any))) return false;
          break;
        case 'gte':
          if (value == null || !((comparable(value) as any) >= (comparable(operand) as any))) return false;
          break;
        case 'contains':
          if (value == null || !text(value).includes(text(operand))) return false;
          break;
        case 'startsWith':
          if (value == null || !text(value).startsWith(text(operand))) return false;
          break;
        case 'endsWith':
          if (value == null || !text(value).endsWith(text(operand))) return false;
          break;
        default:
          throw new Error(`memory-prisma: unsupported operator ${key}`);
      }
    }
    return true;
  }

  // ───────────────────────── 读 ─────────────────────────

  private orderRows(model: string, rows: Row[], orderBy: any, tx: Tx | null): Row[] {
    if (!orderBy) return rows;
    const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
    const def = this.def(model);
    const valueOf = (row: Row, spec: Row): { value: unknown; direction: 'asc' | 'desc'; nulls?: 'first' | 'last' } => {
      const [key, raw] = Object.entries(spec)[0];
      const relation = def.relations?.[key];
      if (relation) {
        const other = this.related(row, relation, tx)[0];
        const nested = valueOf(other ?? {}, raw as Row);
        return nested;
      }
      if (isPlainObject(raw)) return { value: row[key], direction: raw.sort, nulls: raw.nulls };
      return { value: row[key], direction: raw as 'asc' | 'desc' };
    };
    return [...rows].sort((a, b) => {
      for (const spec of specs) {
        const left = valueOf(a, spec);
        const right = valueOf(b, spec);
        const lv = comparable(left.value) as any;
        const rv = comparable(right.value) as any;
        if (lv == null && rv == null) continue;
        const nullsLast = left.nulls ? left.nulls === 'last' : left.direction === 'asc';
        if (lv == null) return nullsLast ? 1 : -1;
        if (rv == null) return nullsLast ? -1 : 1;
        if (lv < rv) return left.direction === 'asc' ? -1 : 1;
        if (lv > rv) return left.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  private project(model: string, row: Row, args: Row | undefined, tx: Tx | null): Row {
    const def = this.def(model);
    const select = args?.select;
    const include = args?.include;
    const out: Row = {};
    if (select) {
      for (const [key, spec] of Object.entries(select as Row)) {
        if (!spec) continue;
        if (key === '_count') {
          out._count = this.countRelations(model, row, spec.select ?? spec, tx);
          continue;
        }
        const relation = def.relations?.[key];
        if (relation) out[key] = this.resolveRelation(row, relation, spec === true ? undefined : spec, tx);
        else out[key] = clone(row[key]);
      }
      return out;
    }
    for (const [key, value] of Object.entries(row)) out[key] = clone(value);
    if (include) {
      for (const [key, spec] of Object.entries(include as Row)) {
        if (!spec) continue;
        if (key === '_count') {
          out._count = this.countRelations(model, row, (spec as Row).select ?? spec, tx);
          continue;
        }
        const relation = def.relations?.[key];
        if (!relation) throw new Error(`memory-prisma: unknown relation ${model}.${key}`);
        out[key] = this.resolveRelation(row, relation, spec === true ? undefined : spec, tx);
      }
    }
    return out;
  }

  private countRelations(model: string, row: Row, spec: Row, tx: Tx | null) {
    const def = this.def(model);
    const out: Row = {};
    for (const [key, value] of Object.entries(spec)) {
      const relation = def.relations?.[key];
      if (!relation) throw new Error(`memory-prisma: unknown relation ${model}.${key}`);
      const where = isPlainObject(value) ? value.where : undefined;
      out[key] = this.related(row, relation, tx).filter((other) => this.matches(relation.model, other, where, tx)).length;
    }
    return out;
  }

  private resolveRelation(row: Row, relation: RelationDef, args: Row | undefined, tx: Tx | null) {
    let others = this.related(row, relation, tx);
    if (relation.kind === 'one') {
      const other = others[0];
      return other ? this.project(relation.model, other, args, tx) : null;
    }
    if (args?.where) others = others.filter((other) => this.matches(relation.model, other, args.where, tx));
    others = this.orderRows(relation.model, others, args?.orderBy, tx);
    if (args?.skip) others = others.slice(args.skip);
    if (args?.take != null) others = others.slice(0, args.take);
    return others.map((other) => this.project(relation.model, other, args, tx));
  }

  private findRows(model: string, args: Row | undefined, tx: Tx | null): Row[] {
    let rows = this.view(model, tx).filter((row) => this.matches(model, row, args?.where, tx));
    rows = this.orderRows(model, rows, args?.orderBy, tx);
    if (args?.skip) rows = rows.slice(args.skip);
    if (args?.take != null) rows = rows.slice(0, args.take);
    return rows;
  }

  // ───────────────────────── 写 ─────────────────────────

  private applyData(model: string, current: Row, data: Row): Row {
    const def = this.def(model);
    const next: Row = { ...current };
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (def.relations?.[key]) throw new Error(`memory-prisma: nested relation writes in update are not supported (${model}.${key})`);
      if (isPlainObject(value)) {
        const keys = Object.keys(value);
        if (keys.length === 1 && UPDATE_OPERATORS.has(keys[0])) {
          const op = keys[0];
          const operand = value[op];
          const base = Number(current[key] ?? 0);
          if (op === 'set') next[key] = clone(operand);
          else if (op === 'increment') next[key] = base + Number(operand);
          else if (op === 'decrement') next[key] = base - Number(operand);
          else if (op === 'multiply') next[key] = base * Number(operand);
          else if (op === 'divide') next[key] = base / Number(operand);
          continue;
        }
      }
      next[key] = clone(value);
    }
    if (def.updatedAt && !('updatedAt' in data)) next.updatedAt = this.now();
    return next;
  }

  private async checkUniques(tx: Tx, model: string, row: Row) {
    for (const cols of this.def(model).unique ?? []) {
      if (cols.some((col) => row[col] == null)) continue;
      const id = this.rowId(model, row);
      const clash = () => this.view(model, tx).some((other) => this.rowId(model, other) !== id && cols.every((col) => equal(other[col], row[col])));
      const key = `${model}|${cols.join(',')}|${cols.map((col) => String(comparable(row[col]))).join('|')}`;
      for (;;) {
        if (clash()) {
          throw new FakePrismaError('P2002', `Unique constraint failed on the fields: (${cols.join(',')})`, { target: cols });
        }
        const owner = this.pendingUniques.get(key);
        if (!owner || owner === tx) break;
        await this.waitFor(tx, owner);
      }
      this.pendingUniques.set(key, tx);
      tx.uniqueKeys.add(key);
    }
  }

  private async insert(tx: Tx, model: string, data: Row): Promise<Row> {
    const def = this.def(model);
    const row = this.withDefaults(model, data);
    const id = this.rowId(model, row);
    // 主键冲突（等别人插入同一主键的事务结束）
    const pkKey = `${model}|__pk__|${id}`;
    for (;;) {
      if (this.viewRow(model, id, tx)) {
        throw new FakePrismaError('P2002', `Unique constraint failed on the fields: (${this.idField(model)})`, { target: [this.idField(model)] });
      }
      const owner = this.pendingUniques.get(pkKey);
      if (!owner || owner === tx) break;
      await this.waitFor(tx, owner);
    }
    this.pendingUniques.set(pkKey, tx);
    tx.uniqueKeys.add(pkKey);
    await this.checkUniques(tx, model, row);
    this.stage(tx, model, id, row);
    await this.lockRow(tx, model, id);
    // 嵌套 create
    for (const [key, value] of Object.entries(data)) {
      const relation = def.relations?.[key];
      if (!relation || value === undefined) continue;
      if (!isPlainObject(value) || !('create' in value)) {
        throw new Error(`memory-prisma: only nested create is supported (${model}.${key})`);
      }
      const children = Array.isArray(value.create) ? value.create : [value.create];
      for (const child of children) {
        await this.insert(tx, relation.model, { ...child, [relation.to]: row[relation.from] });
      }
    }
    return row;
  }

  private async updateRow(tx: Tx, model: string, row: Row, where: Row | undefined, data: Row): Promise<Row | null> {
    const id = this.rowId(model, row);
    await this.lockRow(tx, model, id);
    const latest = this.viewRow(model, id, tx);
    if (!latest || !this.matches(model, latest, where, tx)) return null;
    const next = this.applyData(model, latest, data);
    await this.checkUniques(tx, model, next);
    this.stage(tx, model, id, next);
    return next;
  }

  private async deleteRow(tx: Tx, model: string, row: Row, where: Row | undefined): Promise<Row | null> {
    const id = this.rowId(model, row);
    await this.lockRow(tx, model, id);
    const latest = this.viewRow(model, id, tx);
    if (!latest || !this.matches(model, latest, where, tx)) return null;
    for (const relation of Object.values(this.def(model).relations ?? {})) {
      if (relation.kind !== 'many' || !relation.onDelete) continue;
      for (const child of this.related(latest, relation, tx)) {
        if (relation.onDelete === 'cascade') await this.deleteRow(tx, relation.model, child, undefined);
        else await this.updateRow(tx, relation.model, child, undefined, { [relation.to]: null });
      }
    }
    this.stage(tx, model, id, null);
    return latest;
  }

  // ───────────────────────── 对外 API ─────────────────────────

  private async run<T>(tx: Tx | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
    await this.tick();
    if (tx) return fn(tx);
    const own = this.newTx();
    try {
      const result = await fn(own);
      this.commit(own);
      return result;
    } catch (error) {
      this.rollback(own);
      throw error;
    }
  }

  private logWrite(model: string, op: string) {
    this.writes.push({ model, op });
  }

  private delegate(model: string, tx: Tx | null) {
    const self = this;
    return {
      async findUnique(args: Row) {
        return self.run(tx, async (t) => {
          const row = self.findRows(model, { where: args.where }, t)[0];
          return row ? self.project(model, row, args, t) : null;
        });
      },
      async findUniqueOrThrow(args: Row) {
        const row = await this.findUnique(args);
        if (!row) throw new FakePrismaError('P2025', 'No record found');
        return row;
      },
      async findFirst(args: Row = {}) {
        return self.run(tx, async (t) => {
          const row = self.findRows(model, { ...args, take: 1 }, t)[0];
          return row ? self.project(model, row, args, t) : null;
        });
      },
      async findFirstOrThrow(args: Row = {}) {
        const row = await this.findFirst(args);
        if (!row) throw new FakePrismaError('P2025', 'No record found');
        return row;
      },
      async findMany(args: Row = {}) {
        return self.run(tx, async (t) => self.findRows(model, args, t).map((row) => self.project(model, row, args, t)));
      },
      async count(args: Row = {}) {
        return self.run(tx, async (t) => self.findRows(model, { where: args.where }, t).length);
      },
      async create(args: Row) {
        self.logWrite(model, 'create');
        return self.run(tx, async (t) => {
          const row = await self.insert(t, model, args.data);
          return self.project(model, self.viewRow(model, self.rowId(model, row), t)!, args, t);
        });
      },
      async createMany(args: Row) {
        self.logWrite(model, 'createMany');
        return self.run(tx, async (t) => {
          let count = 0;
          for (const data of args.data as Row[]) {
            try {
              await self.insert(t, model, data);
              count += 1;
            } catch (error) {
              if (args.skipDuplicates && (error as FakePrismaError).code === 'P2002') continue;
              throw error;
            }
          }
          return { count };
        });
      },
      async update(args: Row) {
        self.logWrite(model, 'update');
        return self.run(tx, async (t) => {
          const candidate = self.findRows(model, { where: args.where }, t)[0];
          if (!candidate) throw new FakePrismaError('P2025', `Record to update not found (${model})`);
          const next = await self.updateRow(t, model, candidate, args.where, args.data);
          if (!next) throw new FakePrismaError('P2025', `Record to update not found (${model})`);
          return self.project(model, next, args, t);
        });
      },
      async updateMany(args: Row) {
        self.logWrite(model, 'updateMany');
        return self.run(tx, async (t) => {
          let count = 0;
          for (const candidate of self.findRows(model, { where: args.where }, t)) {
            if (await self.updateRow(t, model, candidate, args.where, args.data)) count += 1;
          }
          return { count };
        });
      },
      async upsert(args: Row) {
        self.logWrite(model, 'upsert');
        return self.run(tx, async (t) => {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const candidate = self.findRows(model, { where: args.where }, t)[0];
            if (candidate) {
              const next = await self.updateRow(t, model, candidate, args.where, args.update);
              if (next) return self.project(model, next, args, t);
              continue;
            }
            const createData = { ...args.create };
            // where 里的唯一键值也要落到新行上（与 Prisma 一致：create 必须自带，但这里防一手）
            try {
              const row = await self.insert(t, model, createData);
              return self.project(model, self.viewRow(model, self.rowId(model, row), t)!, args, t);
            } catch (error) {
              // ON CONFLICT DO UPDATE：别人先插进来了 → 回头走更新
              if ((error as FakePrismaError).code !== 'P2002') throw error;
            }
          }
          throw new FakePrismaError('P2002', `upsert kept conflicting (${model})`);
        });
      },
      async delete(args: Row) {
        self.logWrite(model, 'delete');
        return self.run(tx, async (t) => {
          const candidate = self.findRows(model, { where: args.where }, t)[0];
          if (!candidate) throw new FakePrismaError('P2025', `Record to delete does not exist (${model})`);
          const deleted = await self.deleteRow(t, model, candidate, args.where);
          if (!deleted) throw new FakePrismaError('P2025', `Record to delete does not exist (${model})`);
          return clone(deleted);
        });
      },
      async deleteMany(args: Row = {}) {
        self.logWrite(model, 'deleteMany');
        return self.run(tx, async (t) => {
          let count = 0;
          for (const candidate of self.findRows(model, { where: args.where }, t)) {
            if (await self.deleteRow(t, model, candidate, args.where)) count += 1;
          }
          return { count };
        });
      },
    };
  }

  private clientFor(tx: Tx | null): Row {
    const client: Row = {};
    for (const model of Object.keys(MEMORY_SCHEMA)) client[model] = this.delegate(model, tx);
    if (!tx) {
      client.$transaction = async (arg: any) => {
        if (Array.isArray(arg)) {
          const results: unknown[] = [];
          for (const item of arg) results.push(await item);
          return results;
        }
        const own = this.newTx();
        const scoped = this.clientFor(own);
        try {
          const result = await arg(scoped);
          await this.tick();
          this.commit(own);
          return result;
        } catch (error) {
          this.rollback(own);
          throw error;
        }
      };
    }
    return client;
  }
}

/** 类型上当成 PrismaService 用（服务只调用本假库实现了的那部分）。 */
export function memoryPrisma(): MemoryPrisma & Record<string, any> {
  return new MemoryPrisma() as MemoryPrisma & Record<string, any>;
}
