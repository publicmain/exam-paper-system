import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  containsTarget,
  validateContentCandidate,
  wordCount,
  type ContentCandidate,
} from './content-quality';

const CandidateSchema = z.object({
  definition: z.string().min(1),
  shortExample: z.string().min(1),
  shortTranslation: z.string().min(1),
  alternateExample: z.string().min(1),
  alternateTranslation: z.string().min(1),
  alternateTopic: z.string().min(1),
  collocations: z.array(z.string()).max(6),
  wordFamily: z.array(z.string()).max(8),
  confusionWords: z.array(z.string()).max(6),
  memoryHint: z.string().nullable(),
}).strict();

type CorpusExample = {
  id: number | null;
  text: string;
  translation: string | null;
  owner: string | null;
  license: string | null;
  priority?: number;
  origin?: 'article' | 'tatoeba' | 'definition_template';
};

type GeneratedContent = {
  candidate: ContentCandidate;
  provider: string;
  shortProvenance: CorpusExample | null;
  alternateProvenance: CorpusExample | null;
};

export function azureOpenAiContentConfigured() {
  return Boolean(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_DEPLOYMENT);
}

export function vocabularyContentProviderConfigured() {
  return azureOpenAiContentConfigured() || Boolean(process.env.AZURE_TRANSLATOR_KEY);
}

function configuredProvider() {
  return azureOpenAiContentConfigured()
    ? 'azure_openai+datamuse+tatoeba'
    : 'tatoeba+azure_translator';
}

const CURRICULUM_RANK_FILTER = {
  OR: [
    { listName: 'ngsl', rank: { gte: 1001, lte: 1120 } },
    { listName: 'ngsl', rank: { gte: 1401, lte: 1520 } },
    { listName: 'ngsl', rank: { gte: 1801, lte: 1920 } },
    { listName: 'nawl', rank: { gte: 1, lte: 160 } },
  ],
} as const;

function curriculumBand(lexeme: { listName?: string; rank?: number }) {
  const rank = Number(lexeme.rank ?? 0);
  if (lexeme.listName === 'ngsl' && rank >= 1001 && rank <= 1120) return 0;
  if (lexeme.listName === 'ngsl' && rank >= 1401 && rank <= 1520) return 1;
  if (lexeme.listName === 'ngsl' && rank >= 1801 && rank <= 1920) return 2;
  if (lexeme.listName === 'nawl' && rank >= 1 && rank <= 160) return 3;
  return -1;
}

function balancedCurriculumJobs<T extends { sense: { lexeme: { listName?: string; rank?: number } } }>(candidates: T[], limit: number) {
  const bands = Array.from({ length: 4 }, () => [] as T[]);
  const remainder: T[] = [];
  for (const candidate of candidates) {
    const band = curriculumBand(candidate.sense.lexeme);
    if (band >= 0) bands[band].push(candidate);
    else remainder.push(candidate);
  }
  const result: T[] = [];
  while (result.length < limit && bands.some((band) => band.length)) {
    for (const band of bands) {
      const next = band.shift();
      if (next) result.push(next);
      if (result.length >= limit) break;
    }
  }
  return result.concat(remainder).slice(0, limit);
}

async function datamuseCandidates(headword: string, pos: string) {
  try {
    const base = (process.env.DATAMUSE_BASE_URL || 'https://api.datamuse.com').replace(/\/$/, '');
    const response = await fetch(`${base}/words?ml=${encodeURIComponent(headword)}&md=pf&max=24`, { headers: { 'user-agent': 'exam-paper-system-vocab-v2/1.0' }, signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return [];
    const rows = await response.json() as Array<{ word?: string; tags?: string[] }>;
    const posTag = pos.startsWith('noun') ? 'n' : pos.startsWith('verb') ? 'v' : pos.startsWith('adj') ? 'adj' : pos.startsWith('adv') ? 'adv' : null;
    return rows.filter((row) => row.word && row.word.toLowerCase() !== headword.toLowerCase())
      .filter((row) => !posTag || row.tags?.includes(posTag)).map((row) => row.word!).slice(0, 10);
  } catch {
    // Datamuse only enriches the Azure prompt. A temporary outage must not
    // prevent the corpus + Translator path from publishing a valid card.
    return [];
  }
}

async function tatoebaExamples(headword: string) {
  const base = (process.env.TATOEBA_BASE_URL || 'https://api.tatoeba.org').replace(/\/$/, '');
  const fetchRange = async (range: string) => {
    try {
      const response = await fetch(`${base}/v1/sentences?lang=eng&q=${encodeURIComponent(`=${headword}`)}&word_count=${range}&sort=words&showtrans=all&limit=16`, { headers: { 'user-agent': 'exam-paper-system-vocab-v2/1.0' }, signal: AbortSignal.timeout(5_000) });
      if (!response.ok) return [];
      const payload = await response.json() as { data?: Array<{
        id?: number; text?: string; owner?: string | null; license?: string | null; is_unapproved?: boolean;
        translations?: Array<{ lang?: string; text?: string; is_unapproved?: boolean }>;
      }> };
      return payload.data ?? [];
    } catch {
      // Tatoeba is a best-effort source. Public-API throttling or a timeout must
      // fall through to the definition-backed teaching templates instead of
      // leaving a curriculum word permanently unpublishable.
      return [];
    }
  };
  const rows = (await Promise.all([fetchRange('4-16'), fetchRange('5-22')])).flat();
  return rows
    .filter((row) => row.text && !row.is_unapproved && containsTarget(row.text, headword))
    .map((row) => ({
      id: row.id ?? null,
      text: row.text!.replace(/\s+/g, ' ').trim(),
      translation: row.translations?.find((item) => ['cmn', 'zho'].includes(item.lang ?? '') && !item.is_unapproved && item.text?.trim())?.text?.trim() ?? null,
      owner: row.owner ?? null,
      license: row.license ?? null,
      origin: 'tatoeba' as const,
    }))
    .filter((row, index, rows) => rows.findIndex((candidate) => candidate.text.toLowerCase() === row.text.toLowerCase()) === index)
    .slice(0, 24);
}

async function translateWithAzure(texts: string[]) {
  if (!process.env.AZURE_TRANSLATOR_KEY) throw new Error('azure_translator_not_configured');
  if (!texts.length) return [];
  const endpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com').replace(/\/$/, '');
  const region = process.env.AZURE_TRANSLATOR_REGION;
  const response = await fetch(`${endpoint}/translate?api-version=3.0&from=en&to=zh-Hans`, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'content-type': 'application/json',
      'Ocp-Apim-Subscription-Key': process.env.AZURE_TRANSLATOR_KEY,
      ...(region ? { 'Ocp-Apim-Subscription-Region': region } : {}),
    },
    body: JSON.stringify(texts.map((Text) => ({ Text }))),
  });
  if (!response.ok) throw new Error(`azure_translator_http_${response.status}`);
  const payload = await response.json() as Array<{ translations?: Array<{ text?: string }> }>;
  const translations = payload.map((row) => String(row.translations?.[0]?.text ?? '').trim());
  if (translations.length !== texts.length || translations.some((text) => !text)) throw new Error('azure_translator_incomplete');
  return translations;
}

function focusedOriginal(headword: string, sentence: string | null, translation: string | null): CorpusExample | null {
  if (!sentence) return null;
  const parts = sentence.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/);
  const text = parts.find((part) => containsTarget(part, headword) && wordCount(part) >= 4 && wordCount(part) <= 22);
  const translationMatches = text && text.trim() === sentence.replace(/\s+/g, ' ').trim();
  return text ? {
    id: null,
    text,
    translation: translationMatches ? translation?.trim() || null : null,
    owner: null,
    license: null,
    priority: 100,
    origin: 'article',
  } : null;
}

function compactDefinition(definition: string) {
  const clause = definition.replace(/\s+/g, ' ').trim().split(/[;.]/)[0].replace(/^to\s+/i, '').trim();
  const words = clause.split(/\s+/).filter(Boolean);
  return (words.length > 10 ? words.slice(0, 10) : words).join(' ') || 'the stated meaning';
}

function definitionTemplates(headword: string, pos: string, definition: string): [CorpusExample, CorpusExample] {
  const meaning = compactDefinition(definition);
  const quoted = `\"${headword}\"`;
  let short = `Here, ${quoted} means ${meaning}.`;
  let alternate = `In this lesson, ${quoted} means ${meaning}.`;
  if (pos.startsWith('noun')) {
    short = `The word ${quoted} refers to ${meaning}.`;
    alternate = `In this lesson, ${quoted} names ${meaning}.`;
  } else if (pos.startsWith('verb')) {
    short = `To ${quoted} means to ${meaning}.`;
    alternate = `Here, ${quoted} is used to mean ${meaning}.`;
  } else if (pos.startsWith('adj')) {
    short = `${quoted} describes something that is ${meaning}.`;
    alternate = `Here, ${quoted} is used for something ${meaning}.`;
  } else if (pos.startsWith('adv')) {
    short = `${quoted} describes doing something ${meaning}.`;
    alternate = `Here, ${quoted} explains how an action happens: ${meaning}.`;
  }
  const make = (text: string): CorpusExample => ({
    id: null,
    text,
    translation: null,
    owner: null,
    license: null,
    priority: -100,
    origin: 'definition_template',
  });
  return [make(short), make(alternate)];
}

function posFitScore(sentence: string, headword: string, pos: string) {
  const tokens = (sentence.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []).map((token) => token.toLowerCase());
  const index = tokens.findIndex((token) => containsTarget(token, headword));
  if (index < 0) return -100;
  const previous = tokens[index - 1] ?? '';
  const beforePrevious = tokens[index - 2] ?? '';
  const next = tokens[index + 1] ?? '';
  const determiners = new Set(['a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'our', 'their', 'some', 'any', 'no', 'each', 'every']);
  const modals = new Set(['can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would', 'to', 'do', 'does', 'did']);
  const copulas = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'seem', 'seems', 'feel', 'feels', 'become', 'became']);
  if (pos.startsWith('noun')) {
    return (determiners.has(previous) ? 8 : 0)
      + (determiners.has(beforePrevious) ? 4 : 0)
      + (['of', 'for', 'with', 'without', 'at', 'in', 'on'].includes(previous) ? 3 : 0)
      + (next && ['is', 'are', 'was', 'were', 'has', 'have'].includes(next) ? 2 : 0);
  }
  if (pos.startsWith('verb')) {
    return (modals.has(previous) ? 8 : 0)
      + (index === 0 ? 3 : 0)
      + (['i', 'you', 'we', 'they', 'he', 'she', 'it'].includes(previous) ? 3 : 0)
      + (['i', 'you', 'we', 'they', 'he', 'she', 'it'].includes(beforePrevious) ? 1 : 0);
  }
  if (pos.startsWith('adj')) return (copulas.has(previous) ? 8 : 0) + (next ? 4 : 0);
  if (pos.startsWith('adv')) return (headword.endsWith('ly') ? 5 : 0) + (next ? 3 : 0);
  return 0;
}

function collocationsFromExamples(headword: string, examples: string[]) {
  const phrases: string[] = [];
  for (const sentence of examples) {
    const tokens = sentence.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
    const index = tokens.findIndex((token) => containsTarget(token, headword));
    if (index < 0) continue;
    if (index > 0) phrases.push(`${tokens[index - 1]} ${tokens[index]}`.toLowerCase());
    if (index + 1 < tokens.length) phrases.push(`${tokens[index]} ${tokens[index + 1]}`.toLowerCase());
  }
  return phrases.filter((phrase, index, rows) => rows.indexOf(phrase) === index).slice(0, 4);
}

async function corpusCandidate(input: {
  headword: string;
  pos: string;
  definition: string;
  originalSentence: string | null;
  originalTranslation: string | null;
  corpusExamples: CorpusExample[];
}): Promise<GeneratedContent> {
  const original = focusedOriginal(input.headword, input.originalSentence, input.originalTranslation);
  const templates = definitionTemplates(input.headword, input.pos, input.definition);
  const naturalPool = [original, ...input.corpusExamples]
    .filter((row): row is CorpusExample => Boolean(row))
    .filter((row, index, rows) => rows.findIndex((candidate) => candidate.text.toLowerCase() === row.text.toLowerCase()) === index)
    .sort((a, b) => (b.priority ?? posFitScore(b.text, input.headword, input.pos)) - (a.priority ?? posFitScore(a.text, input.headword, input.pos)) || wordCount(a.text) - wordCount(b.text));
  const pool = [...naturalPool, ...templates];
  const short = pool.find((row) => wordCount(row.text) >= 4 && wordCount(row.text) <= 16);
  const alternate = pool.find((row) => row !== short && wordCount(row.text) >= 5 && wordCount(row.text) <= 22);
  if (!short || !alternate) throw new Error('corpus_examples_insufficient');

  const missing = [short, alternate].filter((row) => !row.translation);
  const translated = await translateWithAzure(missing.map((row) => row.text));
  missing.forEach((row, index) => { row.translation = translated[index]; });
  const collocations = collocationsFromExamples(input.headword, naturalPool.map((row) => row.text));
  const origins = new Set([short.origin, alternate.origin]);
  const provider = `${origins.has('tatoeba') ? 'tatoeba+' : ''}${origins.has('definition_template') ? 'definition_template+' : ''}azure_translator`;

  return {
    candidate: {
      definition: input.definition,
      shortExample: short.text,
      shortTranslation: short.translation!,
      alternateExample: alternate.text,
      alternateTranslation: alternate.translation!,
      alternateTopic: 'general',
      collocations,
      wordFamily: [],
      // Semantic neighbours are not automatically shown as "confusing words".
      // That was the source of the bizarre, unfamiliar options seen in pilot QA.
      confusionWords: [],
      memoryHint: null,
    },
    provider,
    shortProvenance: short,
    alternateProvenance: alternate,
  };
}

async function generateCandidate(input: {
  headword: string; pos: string; definition: string; translation: string; originalSentence: string | null;
  distractorCandidates: string[]; corpusExamples: Array<{ id: number | null; text: string; owner: string | null; license: string | null }>;
}): Promise<ContentCandidate> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, '');
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT!;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
  const schema = { name: 'vocabulary_teaching_content', strict: true, schema: {
    type: 'object', additionalProperties: false,
    required: ['definition', 'shortExample', 'shortTranslation', 'alternateExample', 'alternateTranslation', 'alternateTopic', 'collocations', 'wordFamily', 'confusionWords', 'memoryHint'],
    properties: {
      definition: { type: 'string' }, shortExample: { type: 'string' }, shortTranslation: { type: 'string' },
      alternateExample: { type: 'string' }, alternateTranslation: { type: 'string' }, alternateTopic: { type: 'string' },
      collocations: { type: 'array', items: { type: 'string' }, minItems: 0, maxItems: 6 },
      wordFamily: { type: 'array', items: { type: 'string' }, maxItems: 8 },
      confusionWords: { type: 'array', items: { type: 'string' }, maxItems: 6 },
      memoryHint: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    },
  } };
  const response = await fetch(`${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`, {
    method: 'POST', signal: AbortSignal.timeout(30_000), headers: { 'content-type': 'application/json', 'api-key': process.env.AZURE_OPENAI_API_KEY! },
    body: JSON.stringify({ temperature: 0.2, response_format: { type: 'json_schema', json_schema: schema }, messages: [
      { role: 'system', content: 'Create concise English vocabulary teaching content. Preserve the supplied part of speech and exact sense. Corpus examples are candidates only: reject any that use another sense, are awkward, culturally unsafe, or too complex. Examples must have one unambiguous use of the target word, be age-appropriate, and differ in topic. Return only the required JSON.' },
      { role: 'user', content: JSON.stringify(input) },
    ] }),
  });
  if (!response.ok) throw new Error(`azure_openai_http_${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('azure_openai_empty');
  return CandidateSchema.parse(JSON.parse(content));
}

async function generateContent(input: {
  headword: string;
  pos: string;
  definition: string;
  translation: string;
  originalSentence: string | null;
  originalTranslation: string | null;
  distractorCandidates: string[];
  corpusExamples: CorpusExample[];
}): Promise<GeneratedContent> {
  if (azureOpenAiContentConfigured()) {
    try {
      const candidate = await generateCandidate(input);
      if (validateContentCandidate(input.headword, candidate).publishable) {
        return {
          candidate,
          provider: 'azure_openai',
          shortProvenance: null,
          alternateProvenance: null,
        };
      }
      if (!process.env.AZURE_TRANSLATOR_KEY) {
        return {
          candidate,
          provider: 'azure_openai',
          shortProvenance: null,
          alternateProvenance: null,
        };
      }
    } catch (error) {
      if (!process.env.AZURE_TRANSLATOR_KEY) throw error;
    }
  }
  return corpusCandidate(input);
}

export async function enqueueVocabularyContent(prisma: PrismaClient, limit = 100) {
  const bounded = Math.max(1, Math.min(800, limit));
  const senses: Array<{ id: string; contentVersion: number }> = [];
  const seen = new Set<string>();
  const missingContexts = {
    OR: [
      { contexts: { none: { kind: 'short_same_meaning', qualityStatus: 'ready' } } },
      { contexts: { none: { kind: 'alternate_topic', qualityStatus: 'ready' } } },
    ],
  };
  const priorities: Array<{ where: Record<string, unknown>; quota: number }> = [
    { where: {
      OR: [
        { students: { some: { masteryStage: { lt: 8 } } } },
        { events: { some: { action: { in: ['learn', 'later'] } } } },
        { assignmentItems: { some: {} } },
      ],
    }, quota: Math.ceil(bounded * 0.4) },
    { where: { lexeme: CURRICULUM_RANK_FILTER }, quota: Math.ceil(bounded * 0.6) },
    { where: {}, quota: bounded },
  ];
  for (const priority of priorities) {
    const remaining = Math.min(bounded - senses.length, priority.quota);
    if (remaining <= 0) break;
    const rows = await prisma.vocabularySense.findMany({
      where: {
        AND: [
          { qualityStatus: 'ready' },
          missingContexts,
          priority.where,
          ...(seen.size ? [{ id: { notIn: [...seen] } }] : []),
        ],
      },
      select: { id: true, contentVersion: true },
      take: remaining,
      orderBy: { updatedAt: 'asc' },
    });
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      senses.push(row);
    }
  }
  for (const sense of senses) await prisma.vocabularyContentJob.upsert({
    where: { senseId_requestedVersion: { senseId: sense.id, requestedVersion: sense.contentVersion + 1 } },
    create: { senseId: sense.id, requestedVersion: sense.contentVersion + 1, provider: configuredProvider() },
    update: { provider: configuredProvider() },
  });
  return senses.length;
}

export async function runVocabularyContentBatch(prisma: PrismaClient, requestedLimit = 25) {
  const limit = Math.max(1, Math.min(200, requestedLimit));
  await enqueueVocabularyContent(prisma, limit * 4);
  const candidates = await prisma.vocabularyContentJob.findMany({
    where: { status: { in: ['queued', 'failed'] }, attempts: { lt: 3 } },
    include: { sense: { include: { lexeme: true, contexts: { orderBy: [{ difficulty: 'asc' }, { position: 'asc' }] } } } },
    orderBy: { createdAt: 'asc' },
    take: Math.min(800, limit * 8),
  });
  const jobs = balancedCurriculumJobs(candidates, limit);
  const outcomes: Array<'published' | 'rejected' | 'failed'> = [];
  const concurrency = Math.max(1, Math.min(8, Number(process.env.VOCAB_CONTENT_CONCURRENCY || 1)));
  for (let offset = 0; offset < jobs.length; offset += concurrency) {
    const chunk = jobs.slice(offset, offset + concurrency);
    outcomes.push(...await Promise.all(chunk.map(async (job): Promise<'published' | 'rejected' | 'failed'> => {
    await prisma.vocabularyContentJob.update({ where: { id: job.id }, data: { status: 'running', attempts: { increment: 1 }, startedAt: new Date(), errorCode: null } });
    try {
      const [distractorCandidates, corpusExamples] = await Promise.all([datamuseCandidates(job.sense.lexeme.headword, job.sense.pos), tatoebaExamples(job.sense.lexeme.headword)]);
      const original = job.sense.contexts.find((context) => context.kind === 'article_original') ?? null;
      const generatedContent = await generateContent({
        headword: job.sense.lexeme.headword,
        pos: job.sense.pos,
        definition: job.sense.definition,
        translation: job.sense.translation,
        originalSentence: original?.sentence ?? null,
        originalTranslation: original?.translation ?? null,
        distractorCandidates,
        corpusExamples,
      });
      const candidate = generatedContent.candidate;
      const validation = validateContentCandidate(job.sense.lexeme.headword, candidate);
      if (!validation.publishable) {
        await prisma.vocabularyContentJob.update({ where: { id: job.id }, data: { status: 'rejected', candidate: candidate as any, validation: validation as any, errorCode: 'publication_gate_failed', completedAt: new Date() } });
        return 'rejected';
      }
      await prisma.$transaction(async (tx) => {
        const provenance = (source: CorpusExample | null) => generatedContent.provider === 'azure_openai'
          ? { provider: 'azure_openai', attribution: 'AI-assisted school content', license: null, externalId: null }
          : source?.id
            ? {
              provider: generatedContent.provider,
              attribution: `Tatoeba sentence${source.owner ? ` by ${source.owner}` : ''}`,
              license: source.license,
              externalId: `tatoeba:${source.id}`,
            }
            : source?.origin === 'definition_template'
              ? { provider: generatedContent.provider, attribution: 'official definition teaching template + Azure Translator', license: null, externalId: null }
              : { provider: generatedContent.provider, attribution: 'student reading context + Azure Translator', license: null, externalId: null };
        const shortSource = provenance(generatedContent.shortProvenance);
        const alternateSource = provenance(generatedContent.alternateProvenance);
        await tx.vocabularyContext.upsert({ where: { senseId_kind_position: { senseId: job.senseId, kind: 'short_same_meaning', position: 1 } }, create: { senseId: job.senseId, kind: 'short_same_meaning', position: 1, sentence: candidate.shortExample, translation: candidate.shortTranslation, difficulty: 2, qualityStatus: 'ready', ...shortSource }, update: { sentence: candidate.shortExample, translation: candidate.shortTranslation, difficulty: 2, qualityStatus: 'ready', ...shortSource } });
        await tx.vocabularyContext.upsert({ where: { senseId_kind_position: { senseId: job.senseId, kind: 'alternate_topic', position: 1 } }, create: { senseId: job.senseId, kind: 'alternate_topic', position: 1, sentence: candidate.alternateExample, translation: candidate.alternateTranslation, topic: candidate.alternateTopic, difficulty: 3, qualityStatus: 'ready', ...alternateSource }, update: { sentence: candidate.alternateExample, translation: candidate.alternateTranslation, topic: candidate.alternateTopic, difficulty: 3, qualityStatus: 'ready', ...alternateSource } });
        await tx.vocabularySense.update({ where: { id: job.senseId }, data: { definition: candidate.definition, collocations: candidate.collocations, wordFamily: candidate.wordFamily, confusionWords: candidate.confusionWords, memoryHint: candidate.memoryHint, qualityStatus: 'ready', contentVersion: job.requestedVersion } });
        await tx.vocabularyContentJob.update({ where: { id: job.id }, data: { status: 'published', provider: generatedContent.provider, candidate: candidate as any, validation: validation as any, completedAt: new Date() } });
      });
      return 'published';
    } catch (error) {
      await prisma.vocabularyContentJob.update({ where: { id: job.id }, data: { status: 'failed', errorCode: String((error as Error).message || error).slice(0, 200), completedAt: new Date() } });
      return 'failed';
    }
    })));
  }
  const published = outcomes.filter((outcome) => outcome === 'published').length;
  const rejected = outcomes.filter((outcome) => outcome === 'rejected').length;
  const failed = outcomes.filter((outcome) => outcome === 'failed').length;
  return { selected: jobs.length, published, rejected, failed };
}
