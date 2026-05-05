# B8 — Code Grader (judge0) — MERGE INSTRUCTIONS

This block adds an end-to-end code-execution grader for CS programming
questions (Cambridge 9608/9618 etc.). It runs student source against
configurable test cases via [judge0](https://github.com/judge0/judge0)
and awards marks per passed case. A **stub mode** lets us ship without a
real judge0 deployment.

## 1. Schema fragment

Concatenate `apps/api/prisma/path-b-fragments/b8.prisma` into the main
`schema.prisma`. **And** add these back-relations to existing models —
B8 cannot add them itself because the parent models live outside its
ownership:

```prisma
// In model Question (around line 270, after `usageLogs`)
codeTestCases  CodeQuestionTestCase[]

// In model AnswerScript (around line 138, after `autoCorrect`)
codeResult     CodeSubmissionResult?
```

Then run `prisma generate` + `prisma migrate dev --name b8_codegrader`
(I haven't — per agent rules, no DB migrations from a sub-agent).

## 2. Module registration

Add to `apps/api/src/app.module.ts`:

```ts
import { CodegraderModule } from './codegrader/codegrader.module';
// ...
@Module({
  imports: [
    // ... existing modules ...
    StudentModule,
    CodegraderModule, // <-- add here
  ],
  // ...
})
```

## 3. `apps/web/src/lib/api.ts` additions

Insert these into the `api` object (e.g. just after the `// student`
section):

```ts
  // codegrader
  listCodeTestCases: (questionId: string) =>
    request('GET', `/codegrader/questions/${questionId}/test-cases`),
  addCodeTestCase: (questionId: string, data: any) =>
    request('POST', `/codegrader/questions/${questionId}/test-cases`, data),
  deleteCodeTestCase: (id: string) =>
    request('DELETE', `/codegrader/test-cases/${id}`),
  submitCode: (data: { paperQuestionId: string; language: string; sourceCode: string }) =>
    request('POST', '/codegrader/submit', data),
  getCodeResult: (scriptId: string) =>
    request('GET', `/codegrader/result/${scriptId}`),
```

Once these land, **delete the inline `apiFetch` helper at the top of
`apps/web/src/pages/CodegraderTest.tsx`** and switch its call sites to
`api.listCodeTestCases` / `api.addCodeTestCase` / etc. CodegraderTest
currently uses a private fetch helper because `lib/api.ts` is owned by
another agent.

## 4. Route + nav link

In `apps/web/src/App.tsx`, add the import and a teacher-gated route:

```tsx
import CodegraderTestPage from './pages/CodegraderTest';

// inside the teacher Routes block (next to /quick-paper etc.):
<Route
  path="/codegrader-test"
  element={
    user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher' ? (
      <CodegraderTestPage />
    ) : (
      <Navigate to="/" replace />
    )
  }
/>
```

And in the nav strip:

```tsx
<NavLink to="/codegrader-test" label="Code Grader" />
```

(Show it for all teacher roles — head teachers will want to QA test
cases too.)

## 5. StudentTake.tsx integration

The `CodeAnswerInput` component is built and ready. Here's the proposed
diff to wire it up. (B8 does **not** touch StudentTake — that file is
owned by another agent.)

```tsx
// at top of file
import CodeAnswerInput, { CodeRunResult, SampleCase } from '../components/CodeAnswerInput';

// add helper that asks the API "does this question have code test cases?"
// We piggyback on the existing student GET /codegrader/.../test-cases
// route, which returns [] for non-code questions (or 404 — handled
// silently). Cache in state keyed by questionId so we only ask once
// per unique question on this paper.

// inside StudentTakePage:
const [codeCases, setCodeCases] = useState<Record<string, SampleCase[]>>({});
const [codeResults, setCodeResults] = useState<Record<string, CodeRunResult>>({});
const [codeLanguage, setCodeLanguage] = useState<Record<string, string>>({});
const [codeBusy, setCodeBusy] = useState<string | null>(null);

useEffect(() => {
  if (!paper) return;
  for (const pq of paper.questions ?? []) {
    const qid = pq.question?.id;
    if (!qid || qid in codeCases) continue;
    api.listCodeTestCases(qid)
      .then((rows: SampleCase[]) => setCodeCases(prev => ({ ...prev, [qid]: rows })))
      .catch(() => setCodeCases(prev => ({ ...prev, [qid]: [] })));
  }
}, [paper]);

async function runCode(pq: any) {
  const qid = pq.question?.id;
  setCodeBusy(pq.id);
  try {
    const lang = codeLanguage[pq.id] ?? 'python';
    const src = answers[pq.id]?.textAnswer ?? '';
    const result = await api.submitCode({
      paperQuestionId: pq.id,
      language: lang,
      sourceCode: src,
    });
    setCodeResults(prev => ({ ...prev, [pq.id]: result }));
  } catch (e: any) {
    setErr(String(e));
  } finally {
    setCodeBusy(null);
  }
}

// inside the question render, *replace* the structured-question textarea
// branch with a check for code-mode:
const qid = pq.question?.id;
const hasCode = (codeCases[qid] ?? []).length > 0;

// render:
} else if (hasCode) {
  return (
    <div className="mt-3">
      <CodeAnswerInput
        language={codeLanguage[pq.id] ?? 'python'}
        onLanguageChange={(l) => setCodeLanguage(prev => ({ ...prev, [pq.id]: l }))}
        sourceCode={answers[pq.id]?.textAnswer ?? ''}
        onSourceChange={(src) => saveAnswer(pq.id, { textAnswer: src })}
        onRun={() => runCode(pq)}
        busy={codeBusy === pq.id}
        disabled={locked}
        sampleCases={codeCases[qid] ?? []}
        lastResult={codeResults[pq.id] ?? null}
      />
    </div>
  );
} else {
  // ... existing structured textarea branch ...
}
```

Note: `submitCode` mirrors `awardedMarks` onto the `AnswerScript` row
server-side, so the existing submission-total logic already picks it up
without changes.

## 6. Authz checklist (verify before merge)

| Route                                               | Method | Allowed roles                              | Enforcement                                |
| --------------------------------------------------- | ------ | ------------------------------------------ | ------------------------------------------ |
| `/codegrader/questions/:id/test-cases`              | POST   | admin, head_teacher, teacher               | `@Roles(...)` on handler + service guard   |
| `/codegrader/questions/:id/test-cases`              | GET    | admin, head_teacher, teacher, student      | `@Roles(...)` allows all, service redacts hidden + `expectedStdout` for students |
| `/codegrader/test-cases/:id`                        | DELETE | admin, head_teacher, teacher               | `@Roles(...)` on handler                   |
| `/codegrader/submit`                                | POST   | **student only**                           | `@Roles('student')` on handler + service double-checks role |
| `/codegrader/result/:scriptId`                      | GET    | admin, head_teacher, teacher, student      | `@Roles(...)` allows all, service enforces ownership for students |

Cross-checked against the b8-codegrader.sh blackbox: it exercises every
negative case (teacher tries submit, student tries create / delete,
other student tries to read someone else's result).

## 7. Test script

`tests/blackbox/b8-codegrader.sh` — runs against a deployed API in
**stub mode only** (never makes network calls to a real judge0).
Asserts:

- teacher creates 2 test cases (visible + hidden)
- over-allocation of marks rejected (400)
- teacher list returns both, with `expectedStdout`
- student list returns 1 (hidden filtered), no `expectedStdout`
- student submit returns `{ passedCases:1, totalCases:2, awardedMarks:2, meta.stub:true }`
- AnswerScript.awardedMarks mirrored
- teacher submit -> 401/403
- student create / delete test case -> 401/403
- other student GET /result/:id -> 401/403
- empty source code -> passedCases=0

Run: `bash tests/blackbox/b8-codegrader.sh`
Override `API` env to point at a different deployment.

## 8. STUB note + production setup

**Stub mode (default).** When `process.env.JUDGE0_URL` is unset,
`CodegraderService.runStub` is used — it passes the FIRST test case if
sourceCode is non-empty, fails the rest, tags `meta.stub = true`. This
is intentionally pessimistic so we exercise both pass and fail paths in
the rest of the pipeline (mark mirroring, status updates, marker queue).

**Production setup.** To enable real judge0:

1. Deploy judge0 (one of):
   - **Self-hosted** — `docker compose` from
     [judge0/judge0](https://github.com/judge0/judge0). Requires
     PostgreSQL + Redis. Set `JUDGE0_URL=https://your-judge0.example.com`.
     If your deployment uses an `X-Auth-Token` header, also set
     `JUDGE0_AUTH_TOKEN=...`.
   - **RapidAPI** — subscribe to `judge0-ce`. Set:
     - `JUDGE0_URL=https://judge0-ce.p.rapidapi.com`
     - `JUDGE0_RAPIDAPI_KEY=<your key>`
     - `JUDGE0_RAPIDAPI_HOST=judge0-ce.p.rapidapi.com` (optional, defaults to URL host)

2. Verify language ids match. `DEFAULT_LANGUAGE_TO_JUDGE0_ID` in
   `codegrader.service.ts` uses the standard judge0-ce ids
   (Python=71, Node=63, Java=62, C++=54, C=50). If your fork differs,
   override per-language with:
   ```
   JUDGE0_LANG_OVERRIDES='{"python":71,"javascript":63}'
   ```

3. Set a network egress allowlist on Railway (or wherever the API runs)
   so the only outbound destination is the judge0 host. judge0 itself
   sandboxes student code in isolate / Docker — DO NOT run student code
   inside the API container.

4. **Cambridge pseudocode**: there's no native judge0 language for
   pseudocode. Current behaviour: pseudocode submissions are sent as
   Python and the teacher's test cases must be Python-compatible. A
   future improvement is a small pseudocode->Python transpiler upstream
   of judge0; the language slug is already in
   `SupportedLanguage` so adding it later is a service-only change.

**Health check.** Once a real judge0 URL is set, run the blackbox
script again — it will still pass because it doesn't assert
`meta.stub`. To manually verify the real path, set
`paperQuestionId` + `sourceCode` in the CodegraderTest admin page and
inspect the raw result JSON: `meta.stub` should be absent and
`meta.judge0Tokens` should be populated.

## 9. Files added / modified

Owned by B8:

- `apps/api/prisma/path-b-fragments/b8.prisma`               (schema fragment)
- `apps/api/src/codegrader/codegrader.module.ts`             (NestJS module)
- `apps/api/src/codegrader/codegrader.controller.ts`         (HTTP routes)
- `apps/api/src/codegrader/codegrader.service.ts`            (business logic + judge0 client)
- `apps/api/src/codegrader/dto.ts`                           (zod schemas)
- `apps/api/src/codegrader/MERGE_INSTRUCTIONS.md`            (this file)
- `apps/web/src/components/CodeAnswerInput.tsx`              (reusable code editor)
- `apps/web/src/pages/CodegraderTest.tsx`                    (admin test page)
- `tests/blackbox/b8-codegrader.sh`                          (e2e test)

Touched by integrator (NOT by B8):

- `apps/api/prisma/schema.prisma` — concat fragment + add 2 back-relations
- `apps/api/src/app.module.ts` — register CodegraderModule
- `apps/web/src/lib/api.ts` — add 5 helpers
- `apps/web/src/App.tsx` — add /codegrader-test route + nav link
- `apps/web/src/pages/StudentTake.tsx` — render CodeAnswerInput when question has test cases
