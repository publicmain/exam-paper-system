import { useEffect, useState } from 'react';

/**
 * Code answer input for student-take. Plain monospace textarea + a
 * language tab strip. We deliberately don't pull in CodeMirror or Monaco
 * — they're heavyweight (~1MB gzipped) and a textarea is plenty for the
 * 10-50 line programs Cambridge 9608/9618 papers ask for. If a future
 * exam needs syntax highlighting, swap the textarea for a real editor
 * here without touching anything else.
 *
 * Props:
 *   - language / onLanguageChange: controlled language slug. Allowed
 *     values match the SupportedLanguage enum on the API
 *     (codegrader/dto.ts) — keep these in sync if you add a language.
 *   - sourceCode / onSourceChange: controlled source. Parent owns state
 *     so it can autosave on blur the same way StudentTake does for
 *     textAnswer.
 *   - onRun (optional): if present, renders a "Run code" button that
 *     hits POST /codegrader/submit. Disabled while busy.
 *   - sampleCases (optional): visible test cases (hidden=false) to show
 *     so the student knows what their program is being tested against.
 *   - lastResult (optional): most recent CodeSubmissionResult — shown
 *     as a result strip under the editor (passed/total + meta.stub).
 *   - disabled: pass true once the submission is locked.
 */
export interface SampleCase {
  id: string;
  stdin: string;
  marksPerCase: number;
  label?: string | null;
  hidden: boolean;
}

export interface CodeRunResult {
  language: string;
  passedCases: number;
  totalCases: number;
  awardedMarks: number;
  runtimeMs: number;
  stdout?: string | null;
  stderr?: string | null;
  meta?: { stub?: boolean; error?: string; perCase?: Array<{ caseIndex: number; passed: boolean; runtimeMs: number; stdout: string; stderr: string }> } | null;
}

export interface CodeAnswerInputProps {
  language: string;
  onLanguageChange: (lang: string) => void;
  sourceCode: string;
  onSourceChange: (src: string) => void;
  onRun?: () => void | Promise<void>;
  busy?: boolean;
  disabled?: boolean;
  sampleCases?: SampleCase[];
  lastResult?: CodeRunResult | null;
}

const LANGUAGES: Array<{ slug: string; label: string }> = [
  { slug: 'python', label: 'Python' },
  { slug: 'pseudocode', label: 'Pseudocode' },
  { slug: 'javascript', label: 'JavaScript' },
  { slug: 'java', label: 'Java' },
  { slug: 'cpp', label: 'C++' },
  { slug: 'c', label: 'C' },
];

export default function CodeAnswerInput(props: CodeAnswerInputProps) {
  const {
    language,
    onLanguageChange,
    sourceCode,
    onSourceChange,
    onRun,
    busy = false,
    disabled = false,
    sampleCases = [],
    lastResult = null,
  } = props;

  const [localSource, setLocalSource] = useState(sourceCode);
  // Keep local state for fast typing; parent only sees final value via
  // onBlur. This mirrors how StudentTake handles its textarea. Sync
  // external changes (e.g. resume / external save) into local state
  // when the textarea isn't being actively edited.
  useEffect(() => {
    if (document.activeElement?.tagName !== 'TEXTAREA') {
      setLocalSource(sourceCode);
    }
  }, [sourceCode]);

  return (
    <div className="border rounded-md overflow-hidden bg-gray-50">
      {/* Language tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-100 border-b">
        {LANGUAGES.map((l) => (
          <button
            key={l.slug}
            type="button"
            disabled={disabled}
            onClick={() => onLanguageChange(l.slug)}
            className={`px-2.5 py-1 text-xs rounded ${
              language === l.slug
                ? 'bg-white shadow-sm font-medium'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            {l.label}
          </button>
        ))}
        <div className="flex-1" />
        {onRun && (
          <button
            type="button"
            disabled={disabled || busy || localSource.trim().length === 0}
            onClick={async () => {
              // Make sure parent has the latest source before running.
              if (localSource !== sourceCode) onSourceChange(localSource);
              await onRun();
            }}
            className="btn btn-primary text-xs px-2.5 py-1"
          >
            {busy ? 'Running…' : 'Run code'}
          </button>
        )}
      </div>

      {/* Editor */}
      <textarea
        className="w-full min-h-[260px] p-3 font-mono text-sm bg-white border-0 outline-none resize-y"
        spellCheck={false}
        placeholder={`# Write your ${language} solution here.\n# Read input from stdin, print to stdout.\n`}
        value={localSource}
        disabled={disabled}
        onChange={(e) => setLocalSource(e.target.value)}
        onBlur={() => {
          if (localSource !== sourceCode) onSourceChange(localSource);
        }}
      />

      {/* Sample cases (visible ones only) */}
      {sampleCases.length > 0 && (
        <div className="border-t bg-white px-3 py-2">
          <div className="text-xs font-semibold text-gray-700 mb-1">
            Sample test cases ({sampleCases.filter((c) => !c.hidden).length} visible
            {sampleCases.some((c) => c.hidden) ? `, ${sampleCases.filter((c) => c.hidden).length} hidden` : ''})
          </div>
          <ul className="space-y-1">
            {sampleCases
              .filter((c) => !c.hidden)
              .map((c, i) => (
                <li key={c.id} className="text-xs">
                  <span className="font-mono text-gray-500">#{i + 1}</span>
                  {c.label && <span className="ml-2 text-gray-700">{c.label}</span>}
                  <span className="ml-2 text-gray-500">[{c.marksPerCase}m]</span>
                  {c.stdin && (
                    <pre className="mt-0.5 ml-4 px-2 py-1 bg-gray-50 rounded font-mono whitespace-pre-wrap">
                      {c.stdin}
                    </pre>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Last run result strip */}
      {lastResult && (
        <div className="border-t bg-white px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`px-1.5 py-0.5 rounded font-medium ${
                lastResult.passedCases === lastResult.totalCases
                  ? 'bg-green-100 text-green-800'
                  : lastResult.passedCases === 0
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {lastResult.passedCases} / {lastResult.totalCases} passed
            </span>
            <span className="text-gray-600">{lastResult.awardedMarks} marks awarded</span>
            <span className="text-gray-500">{lastResult.runtimeMs} ms</span>
            {lastResult.meta?.stub && (
              <span className="badge bg-amber-100 text-amber-900">stub mode</span>
            )}
            {lastResult.meta?.error && (
              <span className="text-red-700 truncate">{lastResult.meta.error}</span>
            )}
          </div>
          {lastResult.stderr && (
            <pre className="mt-1 px-2 py-1 bg-red-50 text-red-800 rounded font-mono whitespace-pre-wrap max-h-32 overflow-auto">
              {lastResult.stderr}
            </pre>
          )}
          {lastResult.stdout && !lastResult.stderr && (
            <pre className="mt-1 px-2 py-1 bg-gray-50 text-gray-800 rounded font-mono whitespace-pre-wrap max-h-32 overflow-auto">
              {lastResult.stdout}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
