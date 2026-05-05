import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

// ============================================================
// Types — mirror Prisma return shapes from /api/exam-boards etc.
// ============================================================
type ExamBoard = { id: string; code: string; name: string };
type Subject = {
  id: string;
  examBoardId: string;
  code: string;
  name: string;
  level: string;
  examBoard?: ExamBoard;
};
type Component = { id: string; subjectId: string; code: string; name: string };
type TopicNode = {
  id: string;
  componentId: string;
  parentTopicId: string | null;
  code: string;
  name: string;
  sortOrder: number;
  children: TopicNode[];
};

type ImportTopicNode = {
  code: string;
  name: string;
  sortOrder?: number;
  children?: ImportTopicNode[];
};

const LEVELS = ['A_LEVEL', 'AS_LEVEL', 'IGCSE', 'O_LEVEL'] as const;

// ============================================================
// Small UI helpers — kept inline to avoid pulling in new components
// ============================================================
function Pill({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const cls =
    color === 'green'
      ? 'bg-green-100 text-green-700'
      : color === 'amber'
        ? 'bg-amber-100 text-amber-700'
        : color === 'blue'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-gray-100 text-gray-700';
  return <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>{children}</span>;
}

function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn bg-red-600 text-white hover:bg-red-700"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main page
// ============================================================
export default function SyllabusAdminPage() {
  const [boards, setBoards] = useState<ExamBoard[]>([]);
  const [subjectsByBoard, setSubjectsByBoard] = useState<Record<string, Subject[]>>({});
  const [componentsBySubject, setComponentsBySubject] = useState<Record<string, Component[]>>({});
  const [topicsByComponent, setTopicsByComponent] = useState<Record<string, TopicNode[]>>({});

  const [expandedBoards, setExpandedBoards] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  // ---- Fetch helpers ----
  async function loadBoards() {
    try {
      setBoards(await api.examBoards());
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function loadSubjects(boardId: string) {
    try {
      const list = await api.subjects(boardId);
      setSubjectsByBoard((m) => ({ ...m, [boardId]: list }));
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function loadComponents(subjectId: string) {
    try {
      const list = await api.components(subjectId);
      setComponentsBySubject((m) => ({ ...m, [subjectId]: list }));
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function loadTopics(componentId: string) {
    try {
      const list = await api.topics(componentId);
      setTopicsByComponent((m) => ({ ...m, [componentId]: list }));
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadBoards();
  }, []);

  // ---- Toggles (lazy load on first expand) ----
  function toggleBoard(id: string) {
    setExpandedBoards((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else {
        n.add(id);
        if (!subjectsByBoard[id]) loadSubjects(id);
      }
      return n;
    });
  }
  function toggleSubject(id: string) {
    setExpandedSubjects((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else {
        n.add(id);
        if (!componentsBySubject[id]) loadComponents(id);
      }
      return n;
    });
  }
  function toggleComponent(id: string) {
    setExpandedComponents((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else {
        n.add(id);
        if (!topicsByComponent[id]) loadTopics(id);
      }
      return n;
    });
  }

  // ---- Mutations ----
  async function withFlash<T>(fn: () => Promise<T>, ok: string): Promise<T | null> {
    setError(null);
    setInfo(null);
    try {
      const r = await fn();
      setInfo(ok);
      return r;
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }

  async function createBoard() {
    const code = prompt('Board code (e.g. CIE, EDEXCEL)');
    if (!code) return;
    const name = prompt('Board name', code) ?? code;
    await withFlash(
      () => api.adminCreateExamBoard({ code: code.toUpperCase(), name }),
      `Board ${code} created`,
    );
    await loadBoards();
  }

  async function createSubject(boardId: string) {
    const code = prompt('Subject code (e.g. 9701)');
    if (!code) return;
    const name = prompt('Subject name (e.g. Chemistry)');
    if (!name) return;
    const level = prompt(`Level — one of ${LEVELS.join(', ')}`, 'A_LEVEL');
    if (!level) return;
    await withFlash(
      () => api.adminCreateSubject({ examBoardId: boardId, code, name, level }),
      `Subject ${code} created`,
    );
    await loadSubjects(boardId);
  }

  async function createComponent(subjectId: string) {
    const code = prompt('Component code (e.g. P1, Paper2)');
    if (!code) return;
    const name = prompt('Component name', code) ?? code;
    await withFlash(
      () => api.adminCreateComponent({ subjectId, code, name }),
      `Component ${code} created`,
    );
    await loadComponents(subjectId);
  }

  async function createTopic(componentId: string, parentTopicId: string | null = null) {
    const code = prompt('Topic code (e.g. 1.1.2)');
    if (!code) return;
    const name = prompt('Topic name');
    if (!name) return;
    await withFlash(
      () => api.adminCreateTopic({ componentId, parentTopicId, code, name }),
      `Topic ${code} created`,
    );
    await loadTopics(componentId);
  }

  async function renameTopic(t: TopicNode) {
    const name = prompt('New topic name', t.name);
    if (name === null || name === t.name) return;
    await withFlash(() => api.adminUpdateTopic(t.id, { name }), `Topic renamed`);
    await loadTopics(t.componentId);
  }

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<TopicNode | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await api.adminDeleteTopic(deleteTarget.id);
      setInfo(`Topic ${deleteTarget.code} deleted`);
      const cid = deleteTarget.componentId;
      setDeleteTarget(null);
      await loadTopics(cid);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Syllabus Admin</h1>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={createBoard}>
            + Exam Board
          </button>
          <button className="btn btn-ghost" onClick={() => setShowImport(true)}>
            Bulk Import…
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3 whitespace-pre-wrap">
          {error}
        </div>
      )}
      {info && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded p-3">
          {info}
        </div>
      )}

      <div className="bg-white border rounded-md divide-y">
        {boards.length === 0 && (
          <div className="p-6 text-sm text-gray-500">
            No exam boards yet. Click <strong>+ Exam Board</strong> or <strong>Bulk Import</strong>.
          </div>
        )}
        {boards.map((b) => {
          const open = expandedBoards.has(b.id);
          const subs = subjectsByBoard[b.id] ?? [];
          return (
            <div key={b.id} className="p-3">
              <div className="flex items-center gap-2">
                <button
                  className="text-gray-500 hover:text-black w-5"
                  onClick={() => toggleBoard(b.id)}
                  aria-label="Expand board"
                >
                  {open ? '▾' : '▸'}
                </button>
                <span className="font-semibold">{b.code}</span>
                <span className="text-sm text-gray-600">{b.name}</span>
                <Pill color="blue">board</Pill>
                <button
                  className="ml-auto text-xs text-blue-600 hover:underline"
                  onClick={() => createSubject(b.id)}
                >
                  + Subject
                </button>
              </div>
              {open && (
                <div className="ml-6 mt-2 space-y-1">
                  {subs.length === 0 && (
                    <div className="text-xs text-gray-400 italic">No subjects</div>
                  )}
                  {subs.map((s) => (
                    <SubjectRow
                      key={s.id}
                      subject={s}
                      open={expandedSubjects.has(s.id)}
                      components={componentsBySubject[s.id] ?? []}
                      topicsByComponent={topicsByComponent}
                      expandedComponents={expandedComponents}
                      onToggleSubject={() => toggleSubject(s.id)}
                      onToggleComponent={toggleComponent}
                      onAddComponent={() => createComponent(s.id)}
                      onAddTopic={createTopic}
                      onRenameTopic={renameTopic}
                      onDeleteTopic={setDeleteTarget}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete topic?"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.code} ${deleteTarget.name}"?\n\nThis fails (409) if any question still references the topic.`
            : ''
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={deleteBusy}
      />

      {showImport && (
        <BulkImportDialog
          onClose={() => setShowImport(false)}
          onSuccess={async (msg) => {
            setShowImport(false);
            setInfo(msg);
            await loadBoards();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// SubjectRow — recursive children for components + topics
// ============================================================
function SubjectRow({
  subject,
  open,
  components,
  topicsByComponent,
  expandedComponents,
  onToggleSubject,
  onToggleComponent,
  onAddComponent,
  onAddTopic,
  onRenameTopic,
  onDeleteTopic,
}: {
  subject: Subject;
  open: boolean;
  components: Component[];
  topicsByComponent: Record<string, TopicNode[]>;
  expandedComponents: Set<string>;
  onToggleSubject: () => void;
  onToggleComponent: (id: string) => void;
  onAddComponent: () => void;
  onAddTopic: (componentId: string, parentTopicId?: string | null) => void;
  onRenameTopic: (t: TopicNode) => void;
  onDeleteTopic: (t: TopicNode) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <button
          className="text-gray-500 hover:text-black w-5"
          onClick={onToggleSubject}
          aria-label="Expand subject"
        >
          {open ? '▾' : '▸'}
        </button>
        <span className="font-medium">{subject.code}</span>
        <span className="text-gray-600">{subject.name}</span>
        <Pill>{subject.level}</Pill>
        <button
          className="ml-auto text-xs text-blue-600 hover:underline"
          onClick={onAddComponent}
        >
          + Component
        </button>
      </div>
      {open && (
        <div className="ml-6 mt-1 space-y-1">
          {components.length === 0 && (
            <div className="text-xs text-gray-400 italic">No components</div>
          )}
          {components.map((c) => (
            <ComponentRow
              key={c.id}
              component={c}
              open={expandedComponents.has(c.id)}
              topics={topicsByComponent[c.id] ?? []}
              onToggle={() => onToggleComponent(c.id)}
              onAddTopic={(parentId) => onAddTopic(c.id, parentId ?? null)}
              onRenameTopic={onRenameTopic}
              onDeleteTopic={onDeleteTopic}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ComponentRow({
  component,
  open,
  topics,
  onToggle,
  onAddTopic,
  onRenameTopic,
  onDeleteTopic,
}: {
  component: Component;
  open: boolean;
  topics: TopicNode[];
  onToggle: () => void;
  onAddTopic: (parentId: string | null) => void;
  onRenameTopic: (t: TopicNode) => void;
  onDeleteTopic: (t: TopicNode) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <button
          className="text-gray-500 hover:text-black w-5"
          onClick={onToggle}
          aria-label="Expand component"
        >
          {open ? '▾' : '▸'}
        </button>
        <span className="font-medium">{component.code}</span>
        <span className="text-gray-600">{component.name}</span>
        <Pill color="amber">component</Pill>
        <button
          className="ml-auto text-xs text-blue-600 hover:underline"
          onClick={() => onAddTopic(null)}
        >
          + Root Topic
        </button>
      </div>
      {open && (
        <div className="ml-6 mt-1 space-y-0.5">
          {topics.length === 0 && (
            <div className="text-xs text-gray-400 italic">No topics</div>
          )}
          {topics.map((t) => (
            <TopicRow
              key={t.id}
              topic={t}
              depth={0}
              onAddChild={onAddTopic}
              onRename={onRenameTopic}
              onDelete={onDeleteTopic}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicRow({
  topic,
  depth,
  onAddChild,
  onRename,
  onDelete,
}: {
  topic: TopicNode;
  depth: number;
  onAddChild: (parentId: string) => void;
  onRename: (t: TopicNode) => void;
  onDelete: (t: TopicNode) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = topic.children && topic.children.length > 0;
  return (
    <div>
      <div
        className="flex items-center gap-2 text-sm py-0.5 hover:bg-gray-50 rounded px-1"
        style={{ paddingLeft: depth * 16 + 4 }}
      >
        {hasChildren ? (
          <button
            className="text-gray-500 hover:text-black w-5"
            onClick={() => setOpen((v) => !v)}
            aria-label="Expand topic"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <span className="font-mono text-xs text-gray-500">{topic.code}</span>
        <span>{topic.name}</span>
        <span className="ml-auto flex gap-2 opacity-70">
          <button
            className="text-xs text-blue-600 hover:underline"
            onClick={() => onAddChild(topic.id)}
          >
            + child
          </button>
          <button
            className="text-xs text-gray-600 hover:underline"
            onClick={() => onRename(topic)}
          >
            rename
          </button>
          <button
            className="text-xs text-red-600 hover:underline"
            onClick={() => onDelete(topic)}
          >
            delete
          </button>
        </span>
      </div>
      {open && hasChildren && (
        <div>
          {topic.children.map((c) => (
            <TopicRow
              key={c.id}
              topic={c}
              depth={depth + 1}
              onAddChild={onAddChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// BulkImportDialog — paste JSON, validate client-side, POST /import
// ============================================================
function BulkImportDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [text, setText] = useState<string>(SAMPLE_IMPORT_JSON);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const validation = useMemo(() => validateImportJson(text), [text]);

  async function submit() {
    if (!validation.ok) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.adminImportSyllabus(validation.value);
      onSuccess(
        `Import OK — board=${r.boardId} subject=${r.subjectId} components=${r.components} topics=${r.topics}`,
      );
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col p-6">
        <h3 className="font-semibold text-lg mb-2">Bulk import syllabus</h3>
        <p className="text-xs text-gray-600 mb-3">
          Paste a JSON object with <code>boardCode</code>, <code>subjectCode</code>,{' '}
          <code>subjectName</code>, <code>level</code>, and <code>components[]</code> with nested
          topics. Existing rows are upserted by code.
        </p>
        <textarea
          className="flex-1 min-h-[300px] font-mono text-xs border rounded p-2"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-2 text-xs">
          {validation.ok === true ? (
            <span className="text-green-700">
              Valid · {validation.value.components.length} component(s),{' '}
              {countTopics(validation.value.components)} topic(s)
            </span>
          ) : (
            <span className="text-red-700">{validation.error}</span>
          )}
        </div>
        {err && <div className="mt-2 text-sm text-red-700">{err}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || !validation.ok}
          >
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

function countTopics(components: { topics: ImportTopicNode[] }[]): number {
  const walk = (nodes: ImportTopicNode[]): number =>
    nodes.reduce((acc, n) => acc + 1 + (n.children ? walk(n.children) : 0), 0);
  return components.reduce((acc, c) => acc + walk(c.topics ?? []), 0);
}

type ImportPayload = {
  boardCode: string;
  boardName?: string;
  subjectCode: string;
  subjectName: string;
  level: string;
  components: { code: string; name: string; topics: ImportTopicNode[] }[];
};

function validateImportJson(
  text: string,
):
  | { ok: true; value: ImportPayload }
  | { ok: false; error: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (e: any) {
    return { ok: false, error: 'Invalid JSON: ' + e.message };
  }
  if (!parsed || typeof parsed !== 'object')
    return { ok: false, error: 'Root must be an object' };
  for (const key of ['boardCode', 'subjectCode', 'subjectName', 'level']) {
    if (typeof parsed[key] !== 'string' || !parsed[key])
      return { ok: false, error: `Missing or empty "${key}"` };
  }
  if (!LEVELS.includes(parsed.level)) {
    return { ok: false, error: `level must be one of ${LEVELS.join(', ')}` };
  }
  if (!Array.isArray(parsed.components) || parsed.components.length === 0) {
    return { ok: false, error: '"components" must be a non-empty array' };
  }
  for (const c of parsed.components) {
    if (!c || typeof c.code !== 'string' || typeof c.name !== 'string') {
      return { ok: false, error: 'Each component needs string "code" and "name"' };
    }
    if (c.topics !== undefined && !Array.isArray(c.topics)) {
      return { ok: false, error: `Component ${c.code}: "topics" must be an array` };
    }
    const walk = (nodes: any[], path: string): string | null => {
      for (const n of nodes) {
        if (!n || typeof n.code !== 'string' || typeof n.name !== 'string') {
          return `Topic at ${path}: needs string "code" and "name"`;
        }
        if (n.children !== undefined) {
          if (!Array.isArray(n.children))
            return `Topic ${n.code}: "children" must be an array`;
          const e = walk(n.children, path + '/' + n.code);
          if (e) return e;
        }
      }
      return null;
    };
    const e = walk(c.topics ?? [], c.code);
    if (e) return { ok: false, error: e };
  }
  return { ok: true, value: parsed as ImportPayload };
}

const SAMPLE_IMPORT_JSON = `{
  "boardCode": "CIE",
  "boardName": "Cambridge International",
  "subjectCode": "9701",
  "subjectName": "Chemistry",
  "level": "A_LEVEL",
  "components": [
    {
      "code": "P1",
      "name": "Multiple Choice",
      "topics": [
        { "code": "1", "name": "Atomic structure", "children": [
          { "code": "1.1", "name": "Particles" },
          { "code": "1.2", "name": "Isotopes" }
        ]},
        { "code": "2", "name": "Atoms, molecules and stoichiometry" }
      ]
    }
  ]
}`;
